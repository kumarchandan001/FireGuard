"""
FireGuard AI — Camera Service

Manages webcam lifecycle: open, capture frames, release.
Designed with a CameraSource abstraction for future IP camera support.
"""

from datetime import datetime
import logging
import threading
import time
from typing import Protocol

import cv2
import numpy as np

from app.core.utils import utc_now

logger = logging.getLogger(__name__)


class CameraSource(Protocol):
    """Abstract camera source interface for future extensibility."""

    def open(self) -> bool: ...
    def read(self) -> tuple[bool, np.ndarray | None]: ...
    def release(self) -> None: ...
    def is_opened(self) -> bool: ...


class MockCameraSource:
    """Simulated camera source for environments without physical webcams."""

    def __init__(self, width: int = 640, height: int = 480):
        self._width = width
        self._height = height
        self._opened = False
        self._frame_index = 0

    def open(self) -> bool:
        self._opened = True
        logger.info("Mock camera source opened (simulated feed active)")
        return True

    def read(self) -> tuple[bool, np.ndarray | None]:
        if not self._opened:
            return False, None

        # Create a dark grid background matching command center aesthetics
        frame = np.zeros((self._height, self._width, 3), dtype=np.uint8)
        frame[:, :] = (20, 22, 27) # Dark slate background

        # Draw scanning grid lines
        for y in range(0, self._height, 40):
            cv2.line(frame, (0, y), (self._width, y), (30, 35, 42), 1)
        for x in range(0, self._width, 40):
            cv2.line(frame, (x, 0), (x, self._height), (30, 35, 42), 1)

        # Draw static camera details
        cv2.putText(
            frame,
            "CAM 01 : NORTH SERVER HQ (SIMULATED)",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 122, 255),
            1,
            cv2.LINE_AA
        )

        # Draw dynamic timestamp overlay
        t_str = time.strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(
            frame,
            f"TIME: {t_str}",
            (20, 70),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (150, 150, 150),
            1,
            cv2.LINE_AA
        )

        # Add scanning horizontal line
        scan_y = (self._frame_index * 8) % self._height
        cv2.line(frame, (0, scan_y), (self._width, scan_y), (0, 122, 255), 1)

        # Add subtle analogue camera grain noise
        noise = np.random.randint(0, 12, (self._height, self._width, 3), dtype=np.uint8)
        frame = cv2.add(frame, noise)

        self._frame_index += 1
        time.sleep(0.06) # Simulate capture frame latency (approx 15 FPS)
        return True, frame

    def release(self) -> None:
        self._opened = False
        logger.info("Mock camera source released")

    def is_opened(self) -> bool:
        return self._opened


class WebcamSource:
    """OpenCV webcam capture implementation with automatic mock fallback."""

    def __init__(self, camera_index: int = 0, width: int = 640, height: int = 480):
        self._camera_index = camera_index
        self._width = width
        self._height = height
        self._cap: cv2.VideoCapture | None = None
        self._mock_source: MockCameraSource | None = None

    def open(self) -> bool:
        try:
            self._cap = cv2.VideoCapture(self._camera_index)
            if self._cap.isOpened():
                # Perform a test read to ensure it actually streams (prevents blocking lock issues)
                success, frame = self._cap.read()
                if not success or frame is None:
                    logger.warning("Camera index %d opened but failed to read frames. Releasing.", self._camera_index)
                    self._cap.release()
                    self._cap = None
        except Exception as e:
            logger.warning("Error opening hardware camera: %s", e)
            self._cap = None

        if self._cap is None or not self._cap.isOpened():
            logger.warning("Failed to open physical webcam at index %d. Activating simulated MockCameraSource.", self._camera_index)
            self._mock_source = MockCameraSource(self._width, self._height)
            return self._mock_source.open()

        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self._width)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self._height)
        logger.info(
            "Camera opened: index=%d, resolution=%dx%d",
            self._camera_index,
            self._width,
            self._height,
        )
        return True

    def read(self) -> tuple[bool, np.ndarray | None]:
        if self._mock_source is not None:
            return self._mock_source.read()
        if self._cap is None or not self._cap.isOpened():
            return False, None
        return self._cap.read()

    def release(self) -> None:
        if self._mock_source is not None:
            self._mock_source.release()
            self._mock_source = None
        if self._cap is not None:
            self._cap.release()
            self._cap = None
            logger.info("Camera released")

    def is_opened(self) -> bool:
        if self._mock_source is not None:
            return self._mock_source.is_opened()
        return self._cap is not None and self._cap.isOpened()


class CameraService:
    """
    Manages camera capture lifecycle with thread-safe frame access.

    The camera runs in a background thread, continuously capturing
    frames into a buffer. Consumers call get_frame() to get the
    latest frame without blocking the capture thread.
    """

    def __init__(self, camera_index: int = 0, fps: int = 15, width: int = 640, height: int = 480):
        self._source = WebcamSource(camera_index, width, height)
        self._target_fps = fps
        self._frame_interval = 1.0 / fps

        self._current_frame: np.ndarray | None = None
        self._frame_lock = threading.Lock()
        self._running = False
        self._capture_thread: threading.Thread | None = None
        self._started_at: datetime | None = None

        self._frame_count: int = 0
        self._actual_fps: float = 0.0
        self._last_fps_time: float = 0.0
        self._fps_frame_count: int = 0

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def started_at(self) -> datetime | None:
        return self._started_at

    @property
    def actual_fps(self) -> float:
        return round(self._actual_fps, 1)

    @property
    def frame_count(self) -> int:
        return self._frame_count

    def start(self) -> bool:
        """Start camera capture in a background thread."""
        if self._running:
            logger.warning("Camera is already running")
            return True

        if not self._source.open():
            return False

        self._running = True
        self._started_at = utc_now()
        self._last_fps_time = time.monotonic()
        self._capture_thread = threading.Thread(
            target=self._capture_loop,
            daemon=True,
            name="camera-capture",
        )
        self._capture_thread.start()
        logger.info("Camera capture started at target %d FPS", self._target_fps)
        return True

    def stop(self) -> None:
        """Stop camera capture and release resources."""
        self._running = False
        self._started_at = None
        if self._capture_thread is not None:
            self._capture_thread.join(timeout=3.0)
            self._capture_thread = None
        self._source.release()
        with self._frame_lock:
            self._current_frame = None
        logger.info("Camera capture stopped")

    def get_frame(self) -> np.ndarray | None:
        """Get the latest captured frame (thread-safe). Returns None if no frame available."""
        with self._frame_lock:
            return self._current_frame.copy() if self._current_frame is not None else None

    def _capture_loop(self) -> None:
        """Background thread: continuously capture frames at target FPS."""
        while self._running:
            start_time = time.monotonic()

            success, frame = self._source.read()
            if not success or frame is None:
                logger.warning("Failed to read frame from camera")
                time.sleep(0.1)
                continue

            with self._frame_lock:
                self._current_frame = frame

            self._frame_count += 1
            self._update_fps(start_time)

            # Rate limiting to target FPS
            elapsed = time.monotonic() - start_time
            sleep_time = self._frame_interval - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

    def _update_fps(self, current_time: float) -> None:
        """Calculate actual FPS over a 1-second window."""
        self._fps_frame_count += 1
        elapsed = current_time - self._last_fps_time
        if elapsed >= 1.0:
            self._actual_fps = self._fps_frame_count / elapsed
            self._fps_frame_count = 0
            self._last_fps_time = current_time
