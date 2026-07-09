"""
FireGuard AI — Application Configuration

Centralized configuration using Pydantic Settings.
All values can be overridden via environment variables
prefixed with FIREGUARD_ (e.g., FIREGUARD_DEBUG=true).
"""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


# Resolve project root (backend/ directory)
_BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application-wide configuration with environment variable support."""

    model_config = SettingsConfigDict(
        env_prefix="FIREGUARD_",
        env_file=str(_BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────
    app_name: str = "FireGuard AI"
    app_version: str = "1.0.0"
    env: str = "development"
    debug: bool = False

    # ── Server ───────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8000

    # ── Database ─────────────────────────────────────────────
    database_url: str = f"sqlite:///{_BACKEND_DIR / 'data' / 'fireguard.db'}"

    # ── CORS ─────────────────────────────────────────────────
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # ── Camera ───────────────────────────────────────────────
    camera_index: int = 0
    camera_fps: int = 30

    # ── AI Engine ────────────────────────────────────────────
    model_path: str = str(_BACKEND_DIR / "models" / "yolov8n_fire.pt")
    confidence_threshold: float = 0.80
    detection_cooldown_seconds: int = 30

    # ── Storage ──────────────────────────────────────────────
    screenshot_dir: str = str(_BACKEND_DIR / "data" / "screenshots")
    screenshot_quality: int = 85
    screenshot_retention_days: int = 90

    # ── Replay Timeline ──────────────────────────────────────
    replay_pre_trigger_frames: int = 5
    replay_post_trigger_frames: int = 5

    # ── Alarm ────────────────────────────────────────────────
    alarm_enabled: bool = True
    alarm_confirmation_seconds: int = 2

    # ── Computed Properties ──────────────────────────────────

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def is_development(self) -> bool:
        return self.env == "development"

    @property
    def backend_dir(self) -> Path:
        return _BACKEND_DIR
