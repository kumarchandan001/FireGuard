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

    model_config = {"from_attributes": True}


class IncidentListResponse(BaseModel):
    """Paginated incident list."""

    data: list[IncidentResponse]
    meta: dict[str, Any]


class ResolveRequest(BaseModel):
    """Request body for resolving an incident."""

    note: Optional[str] = Field(None, max_length=1000, description="Resolution note")
