"""
FireGuard AI — AI Engine Service (Detection Pipeline)

Orchestrates the full detection pipeline:
Camera → Frame → AI Inference → Cooldown Check → Event Emission → WebSocket Broadcast

Runs as a background asyncio task, processing frames from the camera
and broadcasting results to all connected WebSocket clients.
"""

import asyncio
import logging
import time

import cv2
import numpy as np

from app.ai_engine.detector import FireDetector, DetectionResult
from app.ai_engine.events import DETECTION_EVENT, NO_DETECTION_EVENT
from app.camera.service import CameraService
from app.core.event_bus import Event, EventBus
from app.core.utils import encode_image_base64, utc_now, format_timestamp
from app.websocket.manager import ConnectionManager

logger = logging.getLogger(__name__)


class DetectionService:
    """
    Main detection pipeline orchestrator.

    Coordinates:
    1. Camera frame capture
    2. AI inference (with frame skipping)
    3. Cooldown logic (prevents duplicate incidents)
    4. Event emission for alarm/incident modules
    5. WebSocket broadcasting of annotated frames
    """

    def __init__(
        self,
        camera: CameraService,
        detector: FireDetector,
        event_bus: EventBus,
        ws_manager: ConnectionManager,
        *,
        cooldown_seconds: int = 30,
        frame_skip: int = 2,
        jpeg_quality: int = 70,
    ):
        self._camera = camera
        self._detector = detector
        self._event_bus = event_bus
        self._ws_manager = ws_manager

        self._cooldown_seconds = cooldown_seconds
        self._frame_skip = max(1, frame_skip)
        self._jpeg_quality = jpeg_quality

        self._running = False
        self._task: asyncio.Task | None = None
        self._last_detection_time: float = 0.0
        self._frame_counter: int = 0
        self._consecutive_clear: int = 0
        self._auto_resolve_threshold = 60  # frames without detection → clear

    @property
    def is_running(self) -> bool:
        return self._running

    async def start(self) -> None:
        """Start the detection pipeline."""
        if self._running:
            logger.warning("Detection pipeline already running")
            return

        self._running = True
        self._task = asyncio.create_task(self._detection_loop())
        logger.info("Detection pipeline started")

    async def stop(self) -> None:
        """Stop the detection pipeline."""
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("Detection pipeline stopped")

    def update_settings(
        self,
        cooldown_seconds: int | None = None,
        frame_skip: int | None = None,
        confidence_threshold: float | None = None,
    ) -> None:
        """Update pipeline settings at runtime."""
        if cooldown_seconds is not None:
            self._cooldown_seconds = cooldown_seconds
        if frame_skip is not None:
            self._frame_skip = max(1, frame_skip)
        if confidence_threshold is not None:
            self._detector.update_threshold(confidence_threshold)

    async def _detection_loop(self) -> None:
        """Main detection loop — runs as an asyncio task."""
        logger.info("Detection loop started (frame_skip=%d, cooldown=%ds)", self._frame_skip, self._cooldown_seconds)

        while self._running:
            try:
                frame = self._camera.get_frame()
                if frame is None:
                    await asyncio.sleep(0.1)
                    continue

                self._frame_counter += 1

                # Frame skipping — only run inference on every Nth frame
                should_infer = (self._frame_counter % self._frame_skip) == 0

                detection_result: DetectionResult | None = None
                if should_infer:
                    # Run inference in a thread pool to avoid blocking asyncio
                    detection_result = await asyncio.get_event_loop().run_in_executor(
                        None, self._detector.detect, frame
                    )

                # Build and broadcast the frame message
                await self._broadcast_frame(frame, detection_result)

                # Handle detection events
                if detection_result is not None and detection_result.has_detection:
                    await self._handle_detection(detection_result, frame)
                    self._consecutive_clear = 0
                elif detection_result is not None:
                    self._consecutive_clear += 1
                    if self._consecutive_clear >= self._auto_resolve_threshold:
                        await self._handle_clear()
                        self._consecutive_clear = 0

                # Rate control — target ~15-30 FPS for WebSocket broadcast
                await asyncio.sleep(0.033)  # ~30 FPS max

            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Error in detection loop")
                await asyncio.sleep(0.5)

    async def _handle_detection(self, result: DetectionResult, frame: np.ndarray) -> None:
        """Handle a positive detection — apply cooldown and emit events."""
        now = time.monotonic()
        elapsed = now - self._last_detection_time

        if elapsed < self._cooldown_seconds:
            # Within cooldown period — don't emit a new event
            return

        self._last_detection_time = now

        # Encode the detection frame for screenshot storage
        _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        frame_bytes = buffer.tobytes() if buffer is not None else b""

        # Emit detection event to alarm + incident modules
        event = Event(
            name=DETECTION_EVENT,
            data={
                "detection_type": result.detection_type,
                "confidence": result.max_confidence,
                "detections": [
                    {
                        "class_name": d.class_name,
                        "confidence": d.confidence,
                        "bbox": d.bbox,
                    }
                    for d in result.detections
                ],
                "frame_bytes": frame_bytes,
                "timestamp": result.timestamp,
                "inference_time_ms": result.inference_time_ms,
            },
        )
        await self._event_bus.publish(event)

        logger.info(
            "🔥 Detection: type=%s, confidence=%.1f%%, inference=%.0fms",
            result.detection_type,
            result.max_confidence * 100,
            result.inference_time_ms,
        )

    async def _handle_clear(self) -> None:
        """Handle prolonged no-detection state."""
        event = Event(
            name=NO_DETECTION_EVENT,
            data={"timestamp": format_timestamp(utc_now())},
        )
        await self._event_bus.publish(event)

    async def _broadcast_frame(
        self,
        frame: np.ndarray,
        detection_result: DetectionResult | None,
    ) -> None:
        """Encode frame as JPEG, annotate with detections, and broadcast via WebSocket."""
        if self._ws_manager.client_count == 0:
            return  # No clients — skip encoding overhead

        display_frame = frame.copy()

        # Draw detection bounding boxes
        if detection_result is not None:
            for det in detection_result.detections:
                x1, y1, x2, y2 = det.bbox
                color = (0, 0, 255) if det.class_name == "fire" else (0, 165, 255)  # Red for fire, Orange for smoke
                cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, 2)

                label = f"{det.class_name} {det.confidence:.0%}"
                label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
                cv2.rectangle(
                    display_frame,
                    (x1, y1 - label_size[1] - 8),
                    (x1 + label_size[0] + 4, y1),
                    color,
                    -1,
                )
                cv2.putText(
                    display_frame,
                    label,
                    (x1 + 2, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (255, 255, 255),
                    2,
                )

        # Encode to JPEG
        _, buffer = cv2.imencode(
            ".jpg",
            display_frame,
            [cv2.IMWRITE_JPEG_QUALITY, self._jpeg_quality],
        )
        if buffer is None:
            return

        image_b64 = encode_image_base64(buffer.tobytes())

        # Build WebSocket message
        message = {
            "type": "frame",
            "data": {
                "image": image_b64,
                "timestamp": format_timestamp(utc_now()),
                "fps": self._camera.actual_fps,
                "detections": (
                    [
                        {
                            "class_name": d.class_name,
                            "confidence": d.confidence,
                            "bbox": list(d.bbox),
                        }
                        for d in detection_result.detections
                    ]
                    if detection_result
                    else []
                ),
            },
        }

        await self._ws_manager.broadcast_json(message)
