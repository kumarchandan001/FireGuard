"""
FireGuard AI — Incident ORM Model

Represents a fire/smoke detection incident with full lifecycle
tracking (detected → active → acknowledged → resolved).
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
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

    # Fire Intelligence Engine fields
    severity: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    estimated_cause: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    observed_behaviour: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recommended_actions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Operator Decision fields
    operator_decision: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="none")

    # Future: FK to cameras and zones tables
    camera_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    zone_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    def __repr__(self) -> str:
        return (
            f"<Incident(id={self.id}, type={self.detection_type}, "
            f"confidence={self.confidence:.2f}, status={self.status})>"
        )


class IncidentReplayEvent(Base):
    """Chronological replay event log linked to an incident."""

    __tablename__ = "incident_replay_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "camera_active", "smoke_detected"
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    def __repr__(self) -> str:
        return f"<IncidentReplayEvent(incident_id={self.incident_id}, type={self.event_type}, time={self.timestamp})>"


class IncidentReplayFrame(Base):
    """Replay buffer frame with per-frame detection telemetry and file links."""

    __tablename__ = "incident_replay_frames"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    frame_index: Mapped[int] = mapped_column(Integer, nullable=False)
    file_path: Mapped[str] = mapped_column(String(255), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    detection_type: Mapped[str] = mapped_column(String(20), nullable=False, default="none")  # "fire" | "smoke" | "none"
    bbox_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<IncidentReplayFrame(incident_id={self.incident_id}, index={self.frame_index}, type={self.detection_type}, conf={self.confidence:.2f})>"
