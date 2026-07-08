"""
FireGuard AI — Incident API Router
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_settings
from app.incident.schemas import (
    IncidentResponse,
    ResolveRequest,
    OperatorDecisionRequest,
    IncidentReplayEventResponse,
    IncidentReplayFrameResponse,
)
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


@router.patch("/{incident_id}/decision")
def update_operator_decision(
    incident_id: int,
    body: OperatorDecisionRequest,
    service: IncidentService = Depends(_get_service),
) -> dict[str, Any]:
    """Update operator decision and status."""
    incident = service.update_operator_decision(
        incident_id, decision=body.decision, note=body.note
    )
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


@router.get("/{incident_id}/report")
def get_report(
    incident_id: int,
    service: IncidentService = Depends(_get_service),
):
    """Generate and stream a PDF audit report for a specific incident."""
    from fastapi.responses import StreamingResponse
    import io
    from app.incident.report_generator import generate_incident_pdf
 
    # Query database and fetch events to inject into report generator if needed
    db = service._session
    from app.incident.repository import IncidentRepository
    repo = IncidentRepository(db)
    events = repo.get_replay_events(incident_id)
    frames = repo.get_replay_frames(incident_id)

    incident = service.get_incident(incident_id)
    pdf_bytes = generate_incident_pdf(incident, events, frames)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=incident_report_{incident_id}.pdf"
        }
    )


@router.get("/{incident_id}/replay/timeline", response_model=list[IncidentReplayEventResponse])
def get_replay_timeline(
    incident_id: int,
    service: IncidentService = Depends(_get_service),
):
    """Get chronological sequence of significant events for an incident."""
    return service.get_replay_timeline(incident_id)


@router.get("/{incident_id}/replay/frames", response_model=list[IncidentReplayFrameResponse])
def get_replay_frames(
    incident_id: int,
    service: IncidentService = Depends(_get_service),
):
    """Get the list of captured replay frames metadata."""
    return service.get_replay_frames(incident_id)


@router.get("/{incident_id}/replay/frames/{frame_index}")
def get_replay_frame_image(
    incident_id: int,
    frame_index: int,
    service: IncidentService = Depends(_get_service),
):
    """Return the raw JPEG image of a specific replay frame."""
    frame = service.get_replay_frame_by_index(incident_id, frame_index)
    from fastapi import HTTPException
    from pathlib import Path
    if not frame or not frame.file_path:
        raise HTTPException(status_code=404, detail="Frame not found")
    
    path = Path(frame.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Frame file not found on disk")
        
    return FileResponse(str(path), media_type="image/jpeg")
