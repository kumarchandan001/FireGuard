"""
FireGuard AI — Health Check Router

Basic system health endpoint for monitoring.
"""

from typing import Any

from fastapi import APIRouter

from app.core.utils import utc_now, format_timestamp

router = APIRouter(prefix="/health", tags=["Health"])

# Track startup time
_startup_time = utc_now()


@router.get("")
def health_check() -> dict[str, Any]:
    """Basic health check endpoint."""
    now = utc_now()
    uptime = (now - _startup_time).total_seconds()
    return {
        "data": {
            "status": "healthy",
            "version": "1.0.0",
            "uptime_seconds": round(uptime, 1),
            "timestamp": format_timestamp(now),
        },
        "meta": {},
        "errors": None,
    }
