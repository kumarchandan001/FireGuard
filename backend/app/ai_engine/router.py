"""
FireGuard AI — AI Engine API Router
"""

from fastapi import APIRouter

router = APIRouter(prefix="/ai-engine", tags=["AI Engine"])

# AI engine status is managed via the detection service singleton
_detection_service = None


def set_detection_service(service):
    global _detection_service
    _detection_service = service


@router.get("/status")
def ai_engine_status() -> dict:
    """Get AI engine status."""
    if _detection_service is None:
        return {"data": {"status": "not_initialized", "model_loaded": False}, "meta": {}}

    return {
        "data": {
            "status": "running" if _detection_service.is_running else "stopped",
            "model_loaded": True,
        },
        "meta": {},
    }
