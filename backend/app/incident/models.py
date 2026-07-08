"""
FireGuard AI — Incident ORM Model

Represents a fire/smoke detection incident with full lifecycle
tracking (detected → active → acknowledged → resolved).
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, TimestampMixin


class Incident(Base, TimestampMixin):
    """
    A single fire/smoke detection incident.

    Lifecycle:
        detected → active → acknowledged → resolved
                         └→ auto_resolved → resolved
    """

    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Detection details
    detection_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="fire | smoke | fire_and_smoke",
    )
    confidence: Mapped[float] = mapped_column(Float, nullable=False)

    # Lifecycle status
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="detected",
        comment="detected | active | acknowledged | resolved",
    )

    # Screenshot
    screenshot_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Timestamps for lifecycle events
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Resolution
    resolution_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Future: FK to cameras and zones tables
    camera_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    zone_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    def __repr__(self) -> str:
        return (
            f"<Incident(id={self.id}, type={self.detection_type}, "
            f"confidence={self.confidence:.2f}, status={self.status})>"
        )
