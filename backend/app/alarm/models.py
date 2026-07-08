"""
FireGuard AI — Alarm Log ORM Model

Audit trail for every alarm state transition.
Used for compliance reporting and incident forensics.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base


class AlarmLog(Base):
    """
    Record of each alarm state transition.

    Every time the alarm state machine transitions
    (triggered → active → acknowledged → idle), a log entry is created.
    """

    __tablename__ = "alarm_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("incidents.id", ondelete="SET NULL"),
        nullable=True,
    )
    state: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="triggered | active | acknowledged | dismissed",
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<AlarmLog(id={self.id}, state={self.state}, incident={self.incident_id})>"
