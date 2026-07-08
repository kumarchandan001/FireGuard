"""
FireGuard AI — AI Engine Service (Detection Pipeline)

Orchestrates the full detection pipeline:
Camera → Frame → AI Inference → Cooldown Check → Event Emission → WebSocket Broadcast

Runs as a background asyncio task, processing frames from the camera
and broadcasting results to all connected WebSocket clients.
"""

import asyncio
import collections
import logging
from pathlib import Path
import time
from typing import Any

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
        session_factory: Any = None,
        *,
        cooldown_seconds: int = 30,
        frame_skip: int = 2,
        jpeg_quality: int = 70,
        pre_trigger_frames: int = 5,
        post_trigger_frames: int = 5,
    ):
        self._camera = camera
        self._detector = detector
        self._event_bus = event_bus
        self._ws_manager = ws_manager
        self._session_factory = session_factory

        self._cooldown_seconds = cooldown_seconds
        self._frame_skip = max(1, frame_skip)
        self._jpeg_quality = jpeg_quality

        self._pre_trigger_max = max(1, pre_trigger_frames)
        self._post_trigger_max = max(1, post_trigger_frames)
        self._pre_trigger_buffer = collections.deque(maxlen=self._pre_trigger_max)
        self._active_replays = {}

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
        self._event_bus.subscribe(DETECTION_EVENT, self.on_detection)
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

                # Push to pre-trigger rolling buffer
                self._pre_trigger_buffer.append({
                    "frame": frame.copy(),
                    "timestamp": utc_now(),
                    "confidence": detection_result.max_confidence if (detection_result and detection_result.has_detection) else 0.0,
                    "detection_type": detection_result.detection_type if detection_result else "none",
                    "bbox_count": len(detection_result.detections) if detection_result else 0
                })

                # Append to active post-trigger sessions
                if self._active_replays:
                    completed_incidents = []
                    for inc_id, session in list(self._active_replays.items()):
                        if session["post_frames_remaining"] > 0:
                            session["frames"].append({
                                "frame": frame.copy(),
                                "timestamp": utc_now(),
                                "confidence": detection_result.max_confidence if (detection_result and detection_result.has_detection) else 0.0,
                                "detection_type": detection_result.detection_type if detection_result else "none",
                                "bbox_count": len(detection_result.detections) if detection_result else 0
                            })
                            session["post_frames_remaining"] -= 1

                        if session["post_frames_remaining"] == 0:
                            # Replay complete! Trigger async saving of frames
                            asyncio.create_task(self._save_replay_session(inc_id, session["frames"]))
                            completed_incidents.append(inc_id)

                    for inc_id in completed_incidents:
                        if inc_id in self._active_replays:
                            del self._active_replays[inc_id]

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

    async def on_detection(self, event: Event) -> None:
        """Listen to detection events to retrieve the generated incident_id."""
        incident_id = event.data.get("incident_id")
        if not incident_id or incident_id in self._active_replays:
            return

        # Start a replay capture session for this incident
        pre_frames = list(self._pre_trigger_buffer)
        
        self._active_replays[incident_id] = {
            "frames": pre_frames,
            "post_frames_remaining": self._post_trigger_max
        }
        logger.info("Initialized replay recording for incident #%d with %d pre-trigger frames", incident_id, len(pre_frames))

    async def _save_replay_session(self, incident_id: int, frames: list[dict]) -> None:
        """Save replay frames to disk and insert database records."""
        try:
            if not self._session_factory:
                logger.warning("No session factory provided, skipping database replay save.")
                return
            await asyncio.get_event_loop().run_in_executor(
                None, self._save_replay_disk_and_db, incident_id, frames
            )
        except Exception:
            logger.exception("Failed to save replay frames for incident #%d", incident_id)

    def _save_replay_disk_and_db(self, incident_id: int, frames: list[dict]) -> None:
        session = self._session_factory()
        try:
            replay_dir = Path("data/replays") / str(incident_id)
            replay_dir.mkdir(parents=True, exist_ok=True)

            pre_count = self._pre_trigger_max

            # Log camera active event
            camera_active_time = self._camera.started_at
            if camera_active_time:
                from app.incident.models import IncidentReplayEvent
                camera_event = IncidentReplayEvent(
                    incident_id=incident_id,
                    event_type="camera_active",
                    description="Camera active (surveillance stream initialized)",
                    timestamp=camera_active_time
                )
                session.add(camera_event)

            for idx, f in enumerate(frames):
                frame_index = idx - pre_count
                file_path = replay_dir / f"frame_{frame_index}.jpg"
                
                # Save JPEG
                _, buffer = cv2.imencode(".jpg", f["frame"], [cv2.IMWRITE_JPEG_QUALITY, self._jpeg_quality])
                if buffer is not None:
                    file_path.write_bytes(buffer.tobytes())

                # DB Replay Frame entry
                from app.incident.models import IncidentReplayFrame
                db_frame = IncidentReplayFrame(
                    incident_id=incident_id,
                    frame_index=frame_index,
                    file_path=str(file_path).replace("\\", "/"),
                    timestamp=f["timestamp"],
                    confidence=f["confidence"],
                    detection_type=f["detection_type"],
                    bbox_count=f["bbox_count"]
                )
                session.add(db_frame)

                # Record detection events
                if f["detection_type"] in ("fire", "smoke"):
                    from app.incident.models import IncidentReplayEvent
                    det_event = IncidentReplayEvent(
                        incident_id=incident_id,
                        event_type=f"{f['detection_type']}_detected",
                        description=f"{f['detection_type'].capitalize()} detected via AI analysis (confidence: {f['confidence']*100:.1f}%)",
                        timestamp=f["timestamp"]
                    )
                    session.add(det_event)

                # Record alarm trigger
                if frame_index == 0:
                    from app.incident.models import IncidentReplayEvent
                    alarm_event = IncidentReplayEvent(
                        incident_id=incident_id,
                        event_type="alarm_triggered",
                        description="System alarm triggered (sirens activated)",
                        timestamp=f["timestamp"]
                    )
                    session.add(alarm_event)

            session.commit()
            logger.info("Saved %d replay frames and timeline events for incident #%d", len(frames), incident_id)
        except Exception:
            session.rollback()
            logger.exception("Failed to write replay DB records for incident #%d", incident_id)
        finally:
            session.close()
