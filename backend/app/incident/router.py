"""
FireGuard AI — Incident API Router
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_settings
from app.incident.schemas import IncidentResponse, ResolveRequest
from app.incident.service import IncidentService

router = APIRouter(prefix="/incidents", tags=["Incidents"])


def _get_service(session: Session = Depends(get_db)) -> IncidentService:
    settings = get_settings()
    return IncidentService(
        session,
        screenshot_dir=settings.screenshot_dir,
        screenshot_quality=settings.screenshot_quality,
    )


@router.get("")
def list_incidents(
    detection_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    service: IncidentService = Depends(_get_service),
) -> dict[str, Any]:
    """List incidents with filters and pagination."""
    offset = (page - 1) * per_page
    items, total = service.get_incidents(
        detection_type=detection_type,
        status=status,
        offset=offset,
        limit=per_page,
    )
    return {
        "data": [IncidentResponse.model_validate(i) for i in items],
        "meta": {"page": page, "per_page": per_page, "total": total},
    }


@router.get("/recent")
def recent_incidents(
    limit: int = Query(10, ge=1, le=50),
    service: IncidentService = Depends(_get_service),
) -> dict[str, Any]:
    """Get the most recent incidents."""
    items = service.get_recent(limit)
    return {
        "data": [IncidentResponse.model_validate(i) for i in items],
        "meta": {"total": len(items)},
    }


@router.get("/summary")
def incident_summary(
    service: IncidentService = Depends(_get_service),
) -> dict[str, Any]:
    """Get incident summary statistics."""
    return {
        "data": {
            "today": service.count_today(),
            "by_status": service.count_by_status(),
        },
        "meta": {},
    }


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(
    incident_id: int,
    service: IncidentService = Depends(_get_service),
) -> IncidentResponse:
    """Get a specific incident."""
    incident = service.get_incident(incident_id)
    return IncidentResponse.model_validate(incident)


@router.patch("/{incident_id}/acknowledge")
def acknowledge_incident(
    incident_id: int,
    service: IncidentService = Depends(_get_service),
) -> dict[str, Any]:
    """Acknowledge an incident."""
    incident = service.acknowledge_incident(incident_id)
    return {"data": IncidentResponse.model_validate(incident), "meta": {}}


@router.patch("/{incident_id}/resolve")
def resolve_incident(
    incident_id: int,
    body: ResolveRequest = ResolveRequest(),
    service: IncidentService = Depends(_get_service),
) -> dict[str, Any]:
    """Resolve an incident."""
    incident = service.resolve_incident(incident_id, note=body.note)
    return {"data": IncidentResponse.model_validate(incident), "meta": {}}


@router.get("/{incident_id}/screenshot")
def get_screenshot(
    incident_id: int,
    service: IncidentService = Depends(_get_service),
) -> FileResponse:
    """Get the screenshot for an incident."""
    from pathlib import Path

    incident = service.get_incident(incident_id)

    if not incident.screenshot_path or not Path(incident.screenshot_path).exists():
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Screenshot", incident_id)

    return FileResponse(
        incident.screenshot_path,
        media_type="image/jpeg",
        filename=f"incident_{incident_id}.jpg",
    )
