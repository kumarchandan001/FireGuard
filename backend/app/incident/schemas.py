"""
FireGuard AI — Incident Pydantic Schemas
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class IncidentResponse(BaseModel):
    """Single incident in API responses."""

    id: int
    detection_type: str
    confidence: float
    status: str
    screenshot_path: Optional[str]
    detected_at: datetime
    acknowledged_at: Optional[datetime]
    resolved_at: Optional[datetime]
    resolution_note: Optional[str]
    camera_id: Optional[str]
    zone_id: Optional[str]

    # Fire Intelligence Engine fields
    severity: Optional[str] = None
    estimated_cause: Optional[str] = None
    observed_behaviour: Optional[str] = None
    ai_summary: Optional[str] = None
    recommended_actions: Optional[str] = None
    explanation: Optional[str] = None
    operator_decision: Optional[str] = None

    model_config = {"from_attributes": True}


class IncidentListResponse(BaseModel):
    """Paginated incident list."""

    data: list[IncidentResponse]
    meta: dict[str, Any]


class ResolveRequest(BaseModel):
    """Request body for resolving an incident."""

    note: Optional[str] = Field(None, max_length=1000, description="Resolution note")


class OperatorDecisionRequest(BaseModel):
    """Request body for submitting an operator decision."""

    decision: str = Field(..., description="confirmed | false_alarm | resolved")
    note: Optional[str] = Field(None, max_length=1000, description="Operator notes/reasoning")


class IncidentReplayEventResponse(BaseModel):
    """Timeline event response schema."""

    id: int
    incident_id: int
    event_type: str
    description: str
    timestamp: datetime

    model_config = {"from_attributes": True}


class IncidentReplayFrameResponse(BaseModel):
    """Replay frame response schema."""

    id: int
    incident_id: int
    frame_index: int
    file_path: str
    timestamp: datetime
    confidence: float
    detection_type: str
    bbox_count: int

    model_config = {"from_attributes": True}
