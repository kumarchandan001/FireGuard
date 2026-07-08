"""
FireGuard AI — Camera API Router

Control endpoints for starting/stopping camera and checking status.
"""

from typing import Any

from fastapi import APIRouter, Depends

from app.dependencies import get_settings
from app.config import Settings

router = APIRouter(prefix="/camera", tags=["Camera"])

# Camera service is managed as a singleton via app state
# It will be injected via the detection pipeline in main.py
_camera_service = None


def set_camera_service(service: Any) -> None:
    """Set the camera service instance (called during app startup)."""
    global _camera_service
    _camera_service = service


def _get_camera():
    if _camera_service is None:
        from app.core.exceptions import ServiceUnavailableError
        raise ServiceUnavailableError("Camera", "Camera service not initialized")
    return _camera_service


@router.post("/start")
def start_camera(settings: Settings = Depends(get_settings)) -> dict:
    """Start the camera capture."""
    camera = _get_camera()
    if camera.is_running:
        return {"data": {"message": "Camera is already running"}, "meta": {}}

    success = camera.start()
    if not success:
        from app.core.exceptions import CameraError
        raise CameraError("Failed to open camera. Check if a webcam is connected.")

    return {"data": {"message": "Camera started"}, "meta": {}}


@router.post("/stop")
def stop_camera() -> dict:
    """Stop the camera capture."""
    camera = _get_camera()
    camera.stop()
    return {"data": {"message": "Camera stopped"}, "meta": {}}


@router.get("/status")
def camera_status(settings: Settings = Depends(get_settings)) -> dict:
    """Get camera status."""
    camera = _get_camera()
    return {
        "data": {
            "is_running": camera.is_running,
            "actual_fps": camera.actual_fps,
            "frame_count": camera.frame_count,
            "camera_index": settings.camera_index,
        },
        "meta": {},
    }
