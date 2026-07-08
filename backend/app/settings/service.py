"""
FireGuard AI — Settings Service

Business logic for application configuration management.
Handles type-safe value casting, validation, and default seeding.
"""

from typing import Any

from sqlalchemy.orm import Session

from app.core.base_service import BaseService
from app.settings.exceptions import SettingNotFoundError
from app.settings.models import Setting
from app.settings.repository import SettingsRepository
from app.settings.schemas import SettingResponse, SettingsByCategoryResponse


# Valid setting value types and their cast functions
_TYPE_CASTERS: dict[str, type] = {
    "int": int,
    "float": float,
    "bool": lambda v: v.lower() in ("true", "1", "yes"),  # type: ignore[dict-item]
    "string": str,
}


class SettingsService(BaseService):
    """
    Manages application configuration with type-safe access.

    All setting values are stored as strings in the database.
    This service handles casting to the appropriate Python type
    based on the value_type column.
    """

    def __init__(self, session: Session) -> None:
        super().__init__()
        self._repo = SettingsRepository(session)
        self._session = session

    def seed_defaults(self) -> int:
        """Seed default settings if they don't exist. Returns count created."""
        count = self._repo.seed_defaults()
        if count > 0:
            self.logger.info("Seeded %d default settings", count)
        return count

    def get_all(self) -> list[SettingResponse]:
        """Retrieve all settings as response objects."""
        settings = self._repo.get_all(order_by=Setting.key)
        return [self._to_response(s) for s in settings]

    def get_by_category(self, category: str) -> list[SettingResponse]:
        """Retrieve settings filtered by category."""
        settings = self._repo.get_by_category(category)
        return [self._to_response(s) for s in settings]

    def get_grouped(self) -> SettingsByCategoryResponse:
        """Retrieve all settings grouped by category for the UI."""
        grouped = self._repo.get_all_grouped()
        return SettingsByCategoryResponse(
            detection=[self._to_response(s) for s in grouped.get("detection", [])],
            alarm=[self._to_response(s) for s in grouped.get("alarm", [])],
            camera=[self._to_response(s) for s in grouped.get("camera", [])],
            system=[self._to_response(s) for s in grouped.get("system", [])],
        )

    def get_value(self, key: str) -> Any:
        """
        Retrieve a setting's value, cast to the appropriate Python type.

        Raises:
            SettingNotFoundError: If the key does not exist.
        """
        setting = self._repo.get_by_key(key)
        if setting is None:
            raise SettingNotFoundError(key)
        return self._cast_value(setting.value, setting.value_type)

    def get_raw(self, key: str) -> SettingResponse:
        """Retrieve a setting as a response object (uncasted)."""
        setting = self._repo.get_by_key(key)
        if setting is None:
            raise SettingNotFoundError(key)
        return self._to_response(setting)

    def update_value(self, key: str, new_value: str) -> SettingResponse:
        """
        Update a setting's value.

        Validates that the new value can be cast to the setting's
        declared type before persisting.

        Raises:
            SettingNotFoundError: If the key does not exist.
            ValueError: If the value cannot be cast to the declared type.
        """
        setting = self._repo.get_by_key(key)
        if setting is None:
            raise SettingNotFoundError(key)

        # Validate the value can be cast
        self._validate_value(new_value, setting.value_type)

        setting.value = new_value
        self._repo.update(setting)
        self._repo.commit()

        self.logger.info("Updated setting '%s' to '%s'", key, new_value)
        return self._to_response(setting)

    def reset_all(self) -> int:
        """Reset all settings to their defaults. Returns count reset."""
        from app.settings.repository import DEFAULT_SETTINGS

        reset_count = 0
        for default in DEFAULT_SETTINGS:
            setting = self._repo.get_by_key(default["key"])
            if setting and setting.value != default["value"]:
                setting.value = default["value"]
                self._repo.update(setting)
                reset_count += 1

        if reset_count > 0:
            self._repo.commit()
            self.logger.info("Reset %d settings to defaults", reset_count)
        return reset_count

    # ── Private Helpers ──────────────────────────────────────

    @staticmethod
    def _cast_value(value: str, value_type: str) -> Any:
        """Cast a string value to the appropriate Python type."""
        caster = _TYPE_CASTERS.get(value_type, str)
        return caster(value)

    @staticmethod
    def _validate_value(value: str, value_type: str) -> None:
        """Validate that a value can be cast to the declared type."""
        try:
            caster = _TYPE_CASTERS.get(value_type, str)
            caster(value)
        except (ValueError, TypeError) as exc:
            raise ValueError(
                f"Value '{value}' cannot be converted to type '{value_type}'"
            ) from exc

    @staticmethod
    def _to_response(setting: Setting) -> SettingResponse:
        """Convert an ORM Setting to a response schema."""
        return SettingResponse(
            key=setting.key,
            value=setting.value,
            value_type=setting.value_type,
            category=setting.category,
            description=setting.description,
            updated_at=setting.updated_at,
        )
