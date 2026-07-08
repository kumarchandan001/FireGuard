"""
FireGuard AI — Incident Repository

Data access layer for incident CRUD with filtering and pagination.
"""

from datetime import datetime

from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.incident.models import Incident


class IncidentRepository(BaseRepository[Incident]):
    """Incident-specific data access methods."""

    def __init__(self, session: Session) -> None:
        super().__init__(Incident, session)

    def get_recent(self, limit: int = 10) -> list[Incident]:
        """Get the most recent incidents."""
        stmt = (
            select(Incident)
            .order_by(desc(Incident.detected_at))
            .limit(limit)
        )
        result = self._session.execute(stmt)
        return list(result.scalars().all())

    def get_filtered(
        self,
        *,
        detection_type: str | None = None,
        status: str | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Incident], int]:
        """Get incidents with filters and pagination. Returns (items, total_count)."""
        stmt = select(Incident)
        count_stmt = select(func.count()).select_from(Incident)

        if detection_type:
            stmt = stmt.where(Incident.detection_type == detection_type)
            count_stmt = count_stmt.where(Incident.detection_type == detection_type)

        if status:
            stmt = stmt.where(Incident.status == status)
            count_stmt = count_stmt.where(Incident.status == status)

        if start_date:
            stmt = stmt.where(Incident.detected_at >= start_date)
            count_stmt = count_stmt.where(Incident.detected_at >= start_date)

        if end_date:
            stmt = stmt.where(Incident.detected_at <= end_date)
            count_stmt = count_stmt.where(Incident.detected_at <= end_date)

        total = self._session.execute(count_stmt).scalar_one()
        items = list(
            self._session.execute(
                stmt.order_by(desc(Incident.detected_at)).offset(offset).limit(limit)
            ).scalars().all()
        )

        return items, total

    def count_by_status(self) -> dict[str, int]:
        """Count incidents grouped by status."""
        stmt = (
            select(Incident.status, func.count())
            .group_by(Incident.status)
        )
        result = self._session.execute(stmt)
        return {status: count for status, count in result.all()}

    def count_today(self) -> int:
        """Count incidents detected today."""
        from app.core.utils import utc_now
        today = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
        stmt = select(func.count()).select_from(Incident).where(Incident.detected_at >= today)
        return self._session.execute(stmt).scalar_one()

    def get_by_date_range(
        self, start: datetime, end: datetime
    ) -> list[Incident]:
        """Get all incidents in a date range."""
        stmt = (
            select(Incident)
            .where(Incident.detected_at >= start)
            .where(Incident.detected_at <= end)
            .order_by(desc(Incident.detected_at))
        )
        return list(self._session.execute(stmt).scalars().all())
