"""
FireGuard AI — Alarm Service

Business logic for alarm management. Listens to detection events
from the AI engine and controls the alarm state machine.
"""

import asyncio
import logging

from app.alarm.state_machine import AlarmStateMachine, AlarmState
from app.alarm.events import ALARM_TRIGGERED_EVENT, ALARM_STATE_CHANGED_EVENT
from app.ai_engine.events import DETECTION_EVENT, NO_DETECTION_EVENT
from app.core.event_bus import Event, EventBus
from app.websocket.manager import ConnectionManager

logger = logging.getLogger(__name__)


class AlarmService:
    """
    Manages the alarm lifecycle in response to detection events.

    Responsibilities:
    - Listen for detection events from the AI engine
    - Control the alarm state machine
    - Broadcast alarm state changes via WebSocket
    - Auto-confirm triggered alarms after confirmation delay
    """

    def __init__(
        self,
        event_bus: EventBus,
        ws_manager: ConnectionManager,
        confirmation_seconds: int = 2,
    ):
        self._event_bus = event_bus
        self._ws_manager = ws_manager
        self._state_machine = AlarmStateMachine()
        self._confirmation_seconds = confirmation_seconds
        self._confirmation_task: asyncio.Task | None = None

        # Subscribe to events
        self._event_bus.subscribe(DETECTION_EVENT, self._on_detection)
        self._event_bus.subscribe(NO_DETECTION_EVENT, self._on_clear)

    @property
    def state(self) -> AlarmState:
        return self._state_machine.state

    @property
    def state_dict(self) -> dict:
        return self._state_machine.to_dict()

    async def acknowledge(self) -> bool:
        """User acknowledges the alarm."""
        success = self._state_machine.acknowledge()
        if success:
            await self._broadcast_alarm_state()
        return success

    async def dismiss(self) -> bool:
        """User dismisses the alarm."""
        if self._confirmation_task and not self._confirmation_task.done():
            self._confirmation_task.cancel()

        success = self._state_machine.dismiss()
        if success:
            await self._broadcast_alarm_state()
        return success

    async def _on_detection(self, event: Event) -> None:
        """Handle a detection event from the AI engine."""
        incident_id = event.data.get("incident_id", 0)
        detection_type = event.data.get("detection_type", "unknown")
        confidence = event.data.get("confidence", 0.0)
        device_id = event.data.get("device_id", "CAM_01")

        if self._state_machine.state == AlarmState.IDLE:
            # Trigger the alarm
            triggered = self._state_machine.trigger(incident_id, detection_type, confidence, device_id)
            if triggered:
                await self._broadcast_alarm_state()
                # Auto-confirm after delay
                self._confirmation_task = asyncio.create_task(
                    self._auto_confirm()
                )

    async def _on_clear(self, event: Event) -> None:
        """Handle prolonged no-detection (auto-resolve)."""
        if self._state_machine.state in (AlarmState.ACKNOWLEDGED,):
            self._state_machine.dismiss()
            await self._broadcast_alarm_state()

    async def _auto_confirm(self) -> None:
        """Auto-confirm a triggered alarm after the confirmation delay."""
        try:
            await asyncio.sleep(self._confirmation_seconds)
            if self._state_machine.state == AlarmState.TRIGGERED:
                self._state_machine.activate()
                await self._broadcast_alarm_state()

                # Emit alarm triggered event
                event = Event(
                    name=ALARM_TRIGGERED_EVENT,
                    data=self._state_machine.to_dict(),
                )
                await self._event_bus.publish(event)
        except asyncio.CancelledError:
            pass

    async def _broadcast_alarm_state(self) -> None:
        """Broadcast alarm state change to all WebSocket clients."""
        message = {
            "type": "alarm",
            "data": self._state_machine.to_dict(),
        }
        await self._ws_manager.broadcast_json(message)

    async def dispatch(self) -> bool:
        """Trigger emergency dispatch."""
        # 1. If idle, trigger a manual panic alarm
        if self._state_machine.state == AlarmState.IDLE:
            from app.core.database import SessionLocal
            from app.incident.repository import IncidentRepository
            from app.incident.models import Incident
            from app.core.utils import utc_now
            import cv2
            import numpy as np
            from pathlib import Path
            from app.core.utils import build_screenshot_path

            db = SessionLocal()
            try:
                repo = IncidentRepository(db)
                now = utc_now()
                # Generate a manual screenshot
                dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
                dummy_frame[:, :] = (20, 20, 35) # dark background
                cv2.putText(
                    dummy_frame,
                    "MANUAL PANIC TRIGGER",
                    (80, 240),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1.0,
                    (0, 0, 255),
                    2,
                )
                _, buffer = cv2.imencode(".jpg", dummy_frame)
                frame_bytes = buffer.tobytes() if buffer is not None else b""

                incident = Incident(
                    detection_type="manual_panic",
                    confidence=1.0,
                    status="active",
                    detected_at=now,
                    resolution_note="[EMERGENCY DISPATCH INITIATED VIA MANUAL PANIC BUTTON]",
                )
                incident = repo.create(incident)
                incident_id = incident.id
                
                # Save screenshot
                screenshot_dir = Path("data/screenshots")
                screenshot_dir.mkdir(parents=True, exist_ok=True)
                screenshot_path = build_screenshot_path(str(screenshot_dir), incident.id, now)
                screenshot_path.write_bytes(frame_bytes)
                incident.screenshot_path = str(screenshot_path)
                repo.update(incident)
                db.commit()
            except Exception as e:
                logger.error(f"Failed to create manual panic incident: {e}")
                incident_id = 0
            finally:
                db.close()

            # Trigger, activate, and mark dispatched
            self._state_machine.trigger(incident_id, "manual_panic", 1.0, "MANUAL_PANIC")
            self._state_machine.activate()
            self._state_machine.dispatch()
            await self._broadcast_alarm_state()
            
            # Emit alarm state changed event
            event = Event(
                name=ALARM_STATE_CHANGED_EVENT,
                data=self._state_machine.to_dict(),
            )
            await self._event_bus.publish(event)
            return True
        else:
            # 2. If already triggered/active/acknowledged, update the active incident notes
            incident_id = self._state_machine.incident_id
            if incident_id and incident_id > 0:
                from app.core.database import SessionLocal
                from app.incident.repository import IncidentRepository
                db = SessionLocal()
                try:
                    repo = IncidentRepository(db)
                    incident = repo.get_by_id(incident_id)
                    if incident:
                        note = incident.resolution_note or ""
                        if "[EMERGENCY DISPATCH INITIATED]" not in note:
                            incident.resolution_note = (note + "\n[EMERGENCY DISPATCH INITIATED]").strip()
                            db.commit()
                except Exception as e:
                    logger.error(f"Failed to update incident for dispatch: {e}")
                finally:
                    db.close()

            success = self._state_machine.dispatch()
            if success:
                await self._broadcast_alarm_state()
                
                # Emit alarm state changed event
                event = Event(
                    name=ALARM_STATE_CHANGED_EVENT,
                    data=self._state_machine.to_dict(),
                )
                await self._event_bus.publish(event)
            return success

    def reset(self) -> None:
        """Reset alarm state (used during shutdown)."""
        self._state_machine.reset()

