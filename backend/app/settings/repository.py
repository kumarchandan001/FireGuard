"""
FireGuard AI — Settings Repository

Data access layer for the settings key-value store.
Extends BaseRepository with settings-specific query methods.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.base_repository import BaseRepository
from app.settings.models import Setting


# Default settings seeded on first run
DEFAULT_SETTINGS: list[dict] = [
    # Detection settings
    {
        "key": "detection_confidence_threshold",
        "value": "0.65",
        "value_type": "float",
        "category": "detection",
        "description": "Minimum confidence score (0.0–1.0) to trigger an alarm",
    },
    {
        "key": "detection_cooldown_seconds",
        "value": "30",
        "value_type": "int",
        "category": "detection",
        "description": "Seconds to wait between duplicate detections from the same fire",
    },
    {
        "key": "detection_frame_skip",
        "value": "2",
        "value_type": "int",
        "category": "detection",
        "description": "Process every Nth frame (1 = every frame, 2 = every other frame)",
    },
    # Alarm settings
    {
        "key": "alarm_sound_enabled",
        "value": "true",
        "value_type": "bool",
        "category": "alarm",
        "description": "Enable audible alarm sound in the browser",
    },
    {
        "key": "alarm_confirmation_seconds",
        "value": "2",
        "value_type": "int",
        "category": "alarm",
        "description": "Seconds to confirm detection before triggering full alarm",
    },
    {
        "key": "alarm_auto_resolve_seconds",
        "value": "60",
        "value_type": "int",
        "category": "alarm",
        "description": "Auto-resolve incident after this many seconds of no detection",
    },
    # Camera settings
    {
        "key": "camera_fps",
        "value": "15",
        "value_type": "int",
        "category": "camera",
        "description": "Camera capture frames per second",
    },
    {
        "key": "camera_resolution_width",
        "value": "640",
        "value_type": "int",
        "category": "camera",
        "description": "Camera capture width in pixels",
    },
    {
        "key": "camera_resolution_height",
        "value": "480",
        "value_type": "int",
        "category": "camera",
        "description": "Camera capture height in pixels",
    },
    # System settings
    {
        "key": "screenshot_quality",
        "value": "85",
        "value_type": "int",
        "category": "system",
        "description": "JPEG quality for incident screenshots (1–100)",
    },
    {
        "key": "screenshot_retention_days",
        "value": "90",
        "value_type": "int",
        "category": "system",
        "description": "Days to retain screenshot files before auto-cleanup",
    },
    {
        "key": "replay_pre_trigger_frames",
        "value": "5",
        "value_type": "int",
        "category": "system",
        "description": "Number of pre-trigger frames to record in incident replay (1–10)",
    },
    {
        "key": "replay_post_trigger_frames",
        "value": "5",
        "value_type": "int",
        "category": "system",
        "description": "Number of post-trigger frames to record in incident replay (1–10)",
    },
]


class SettingsRepository(BaseRepository[Setting]):
    """Data access for application settings."""

    def __init__(self, session: Session) -> None:
        super().__init__(Setting, session)

    def get_by_key(self, key: str) -> Setting | None:
        """Retrieve a setting by its unique key."""
        stmt = select(Setting).where(Setting.key == key)
        result = self._session.execute(stmt)
        return result.scalar_one_or_none()

    def get_by_category(self, category: str) -> list[Setting]:
        """Retrieve all settings in a specific category."""
        stmt = (
            select(Setting)
            .where(Setting.category == category)
            .order_by(Setting.key)
        )
        result = self._session.execute(stmt)
        return list(result.scalars().all())

    def get_all_grouped(self) -> dict[str, list[Setting]]:
        """Retrieve all settings grouped by category."""
        all_settings = self.get_all(order_by=Setting.key)
        grouped: dict[str, list[Setting]] = {}
        for setting in all_settings:
            grouped.setdefault(setting.category, []).append(setting)
        return grouped

    def upsert(self, key: str, value: str) -> Setting:
        """Update a setting's value, or raise if key doesn't exist."""
        setting = self.get_by_key(key)
        if setting is None:
            raise KeyError(f"Setting '{key}' not found")
        setting.value = value
        return self.update(setting)

    def seed_defaults(self) -> int:
        """
        Insert default settings that don't already exist.
        Returns the number of settings created.
        """
        created = 0
        for default in DEFAULT_SETTINGS:
            existing = self.get_by_key(default["key"])
            if existing is None:
                setting = Setting(**default)
                self.create(setting)
                created += 1
        if created > 0:
            self.commit()
        return created
