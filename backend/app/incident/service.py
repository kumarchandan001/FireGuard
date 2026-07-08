"""
FireGuard AI — Incident Service

Business logic for incident lifecycle management.
Listens to detection events and creates incidents with screenshots.
"""

import logging

from sqlalchemy.orm import Session

from app.ai_engine.events import DETECTION_EVENT
from app.core.base_service import BaseService
from app.core.event_bus import Event, EventBus
from app.core.exceptions import NotFoundError, InvalidStateTransitionError
from app.core.utils import utc_now, build_screenshot_path
from app.incident.models import Incident
from app.incident.repository import IncidentRepository

logger = logging.getLogger(__name__)


class IncidentService(BaseService):
    """
    Manages the incident lifecycle.

    Responsibilities:
    - Create incidents from detection events
    - Save screenshots
    - Handle state transitions (acknowledge, resolve)
    """

    def __init__(
        self,
        session: Session,
        event_bus: EventBus | None = None,
        screenshot_dir: str = "data/screenshots",
        screenshot_quality: int = 85,
    ):
        super().__init__()
        self._session = session
        self._repo = IncidentRepository(session)
        self._screenshot_dir = screenshot_dir
        self._screenshot_quality = screenshot_quality

        # Subscribe to detection events if event bus provided
        if event_bus is not None:
            event_bus.subscribe(DETECTION_EVENT, self._on_detection)

    async def _on_detection(self, event: Event) -> None:
        """Handle a detection event — create a new incident."""
        try:
            detection_type = event.data.get("detection_type", "unknown")
            confidence = event.data.get("confidence", 0.0)
            frame_bytes = event.data.get("frame_bytes", b"")

            incident = self.create_incident(
                detection_type=detection_type,
                confidence=confidence,
                frame_bytes=frame_bytes,
            )

            # Update the event with the incident ID for downstream consumers
            event.data["incident_id"] = incident.id

            logger.info("Created incident #%d: type=%s, confidence=%.1f%%",
                        incident.id, detection_type, confidence * 100)
        except Exception:
            logger.exception("Failed to create incident from detection event")

    def create_incident(
        self,
        detection_type: str,
        confidence: float,
        frame_bytes: bytes = b"",
    ) -> Incident:
        """Create a new incident and save screenshot."""
        now = utc_now()

        incident = Incident(
            detection_type=detection_type,
            confidence=confidence,
            status="active",
            detected_at=now,
        )
        incident = self._repo.create(incident)

        # Save screenshot if frame data provided
        if frame_bytes:
            try:
                screenshot_path = build_screenshot_path(
                    self._screenshot_dir, incident.id, now
                )
                screenshot_path.write_bytes(frame_bytes)
                incident.screenshot_path = str(screenshot_path)
                self._repo.update(incident)
            except Exception:
                logger.exception("Failed to save screenshot for incident #%d", incident.id)

        self._repo.commit()
        return incident

    def get_incident(self, incident_id: int) -> Incident:
        """Get a single incident by ID."""
        incident = self._repo.get_by_id(incident_id)
        if incident is None:
            raise NotFoundError("Incident", incident_id)
        return incident

    def get_incidents(
        self,
        *,
        detection_type: str | None = None,
        status: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Incident], int]:
        """Get paginated, filtered incidents."""
        return self._repo.get_filtered(
            detection_type=detection_type,
            status=status,
            offset=offset,
            limit=limit,
        )

    def get_recent(self, limit: int = 10) -> list[Incident]:
        """Get recent incidents."""
        return self._repo.get_recent(limit)

    def acknowledge_incident(self, incident_id: int) -> Incident:
        """Acknowledge an incident."""
        incident = self.get_incident(incident_id)

        if incident.status not in ("detected", "active"):
            raise InvalidStateTransitionError(incident.status, "acknowledged", "Incident")

        incident.status = "acknowledged"
        incident.acknowledged_at = utc_now()
        self._repo.update(incident)
        self._repo.commit()
        return incident

    def resolve_incident(self, incident_id: int, note: str | None = None) -> Incident:
        """Resolve an incident."""
        incident = self.get_incident(incident_id)

        if incident.status == "resolved":
            raise InvalidStateTransitionError(incident.status, "resolved", "Incident")

        incident.status = "resolved"
        incident.resolved_at = utc_now()
        if note:
            incident.resolution_note = note
        self._repo.update(incident)
        self._repo.commit()
        return incident

    def count_today(self) -> int:
        """Count incidents from today."""
        return self._repo.count_today()

    def count_by_status(self) -> dict[str, int]:
        """Get incident counts by status."""
        return self._repo.count_by_status()
