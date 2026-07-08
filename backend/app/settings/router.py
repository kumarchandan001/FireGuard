"""
FireGuard AI — Settings API Router

Thin API layer — delegates all business logic to SettingsService.
"""

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.settings.schemas import (
    SettingResponse,
    SettingsByCategoryResponse,
    SettingsListResponse,
    SettingUpdateRequest,
)
from app.settings.service import SettingsService

router = APIRouter(prefix="/settings", tags=["Settings"])


def _get_service(session: Session = Depends(get_db)) -> SettingsService:
    return SettingsService(session)


@router.get("", response_model=SettingsListResponse)
def list_settings(service: SettingsService = Depends(_get_service)) -> dict[str, Any]:
    """Retrieve all application settings."""
    settings = service.get_all()
    return {"data": settings, "meta": {"total": len(settings)}}


@router.get("/grouped", response_model=SettingsByCategoryResponse)
def get_settings_grouped(
    service: SettingsService = Depends(_get_service),
) -> SettingsByCategoryResponse:
    """Retrieve all settings grouped by category (for settings UI)."""
    return service.get_grouped()


@router.get("/{key}", response_model=SettingResponse)
def get_setting(
    key: str,
    service: SettingsService = Depends(_get_service),
) -> SettingResponse:
    """Retrieve a specific setting by key."""
    return service.get_raw(key)


@router.put("/{key}", response_model=SettingResponse)
def update_setting(
    key: str,
    body: SettingUpdateRequest,
    service: SettingsService = Depends(_get_service),
) -> SettingResponse:
    """Update a setting's value."""
    return service.update_value(key, body.value)


@router.post("/reset", response_model=dict)
def reset_settings(
    service: SettingsService = Depends(_get_service),
) -> dict[str, Any]:
    """Reset all settings to factory defaults."""
    count = service.reset_all()
    return {"data": {"reset_count": count}, "meta": {}}
