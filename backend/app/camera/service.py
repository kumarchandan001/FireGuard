"""
FireGuard AI — Camera Service

Manages webcam lifecycle: open, capture frames, release.
Designed with a CameraSource abstraction for future IP camera support.
"""

import logging
import threading
import time
from typing import Protocol

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class CameraSource(Protocol):
    """Abstract camera source interface for future extensibility."""

    def open(self) -> bool: ...
    def read(self) -> tuple[bool, np.ndarray | None]: ...
    def release(self) -> None: ...
    def is_opened(self) -> bool: ...


class WebcamSource:
    """OpenCV webcam capture implementation."""

    def __init__(self, camera_index: int = 0, width: int = 640, height: int = 480):
        self._camera_index = camera_index
        self._width = width
        self._height = height
        self._cap: cv2.VideoCapture | None = None

    def open(self) -> bool:
        self._cap = cv2.VideoCapture(self._camera_index)
        if not self._cap.isOpened():
            logger.error("Failed to open camera at index %d", self._camera_index)
            return False

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
        if self._cap is None or not self._cap.isOpened():
            return False, None
        return self._cap.read()

    def release(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None
            logger.info("Camera released")

    def is_opened(self) -> bool:
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

        self._frame_count: int = 0
        self._actual_fps: float = 0.0
        self._last_fps_time: float = 0.0
        self._fps_frame_count: int = 0

    @property
    def is_running(self) -> bool:
        return self._running

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
