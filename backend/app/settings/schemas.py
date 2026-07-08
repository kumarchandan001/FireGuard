"""
FireGuard AI — Settings Pydantic Schemas

Request/response schemas for the Settings API.
Separate from ORM models — these define the API contract.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SettingResponse(BaseModel):
    """Single setting in API responses."""

    key: str
    value: Any
    value_type: str
    category: str
    description: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class SettingUpdateRequest(BaseModel):
    """Request body for updating a setting value."""

    value: str = Field(..., min_length=1, max_length=500, description="New setting value")


class SettingsListResponse(BaseModel):
    """Response for listing all settings, grouped by category."""

    data: list[SettingResponse]
    meta: dict[str, Any] = Field(default_factory=dict)


class SettingsByCategoryResponse(BaseModel):
    """Settings organized by category for the UI."""

    detection: list[SettingResponse] = []
    alarm: list[SettingResponse] = []
    camera: list[SettingResponse] = []
    system: list[SettingResponse] = []
