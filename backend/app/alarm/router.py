"""
FireGuard AI — Alarm API Router
"""

from fastapi import APIRouter


router = APIRouter(prefix="/alarm", tags=["Alarm"])

_alarm_service = None


def set_alarm_service(service):
    global _alarm_service
    _alarm_service = service


@router.get("/status")
def alarm_status() -> dict:
    """Get current alarm state."""
    if _alarm_service is None:
        return {"data": {"state": "idle"}, "meta": {}}
    return {"data": _alarm_service.state_dict, "meta": {}}


@router.post("/acknowledge")
async def acknowledge_alarm() -> dict:
    """Acknowledge the active alarm."""
    if _alarm_service is None:
        return {"data": {"success": False, "message": "Alarm service not initialized"}, "meta": {}}

    success = await _alarm_service.acknowledge()
    return {
        "data": {
            "success": success,
            "state": _alarm_service.state.value,
        },
        "meta": {},
    }


@router.post("/dismiss")
async def dismiss_alarm() -> dict:
    """Dismiss the alarm and return to idle."""
    if _alarm_service is None:
        return {"data": {"success": False, "message": "Alarm service not initialized"}, "meta": {}}

    success = await _alarm_service.dismiss()
    return {
        "data": {
            "success": success,
            "state": _alarm_service.state.value,
        },
        "meta": {},
    }


@router.post("/test-trigger")
async def test_trigger(
    detection_type: str = "fire",
    confidence: float = 0.92,
    device_id: str = "CAM_01",
) -> dict:
    """Manually trigger a simulated detection for testing."""
    if _alarm_service is None:
        return {"data": {"success": False, "message": "Alarm service not initialized"}, "meta": {}}

    from app.ai_engine.events import DETECTION_EVENT
    from app.core.event_bus import Event
    from app.core.utils import utc_now, format_timestamp
    from app.dependencies import get_event_bus
    import cv2
    import numpy as np

    # Generate a red dummy frame indicating simulated threat
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    dummy_frame[:, :] = (20, 20, 35) # dark background
    cv2.putText(
        dummy_frame,
        f"SIMULATED {detection_type.upper()}",
        (80, 240),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.0,
        (0, 0, 255) if detection_type == "fire" else (0, 165, 255),
        2,
    )
    cv2.rectangle(dummy_frame, (50, 50), (590, 430), (0, 0, 255) if detection_type == "fire" else (0, 165, 255), 2)
    _, buffer = cv2.imencode(".jpg", dummy_frame)
    frame_bytes = buffer.tobytes() if buffer is not None else b""

    event = Event(
        name=DETECTION_EVENT,
        data={
            "detection_type": detection_type,
            "confidence": confidence,
            "device_id": device_id,
            "detections": [
                {
                    "class_name": detection_type,
                    "confidence": confidence,
                    "bbox": (50, 50, 590, 430),
                }
            ],
            "frame_bytes": frame_bytes,
            "timestamp": format_timestamp(utc_now()),
            "inference_time_ms": 10.0,
        },
    )

    # Publish to event bus to persist the incident and trigger the alarm in sequence
    bus = get_event_bus()
    await bus.publish(event)

    return {
        "data": {
            "success": True,
            "state": _alarm_service.state.value,
            "incident_id": _alarm_service._state_machine.incident_id,
        },
        "meta": {},
    }


@router.post("/dispatch")
async def dispatch_alarm() -> dict:
    """Manually trigger emergency dispatch, notifying response teams."""
    if _alarm_service is None:
        return {"data": {"success": False, "message": "Alarm service not initialized"}, "meta": {}}

    success = await _alarm_service.dispatch()
    return {
        "data": {
            "success": success,
            "state": _alarm_service.state.value,
            "dispatched": _alarm_service.state_dict.get("dispatched", False),
        },
        "meta": {},
    }


