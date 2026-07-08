"""
FireGuard AI — Shared Utilities

Pure helper functions with no side effects.
Used across all modules for consistent formatting and operations.
"""

import base64
from datetime import datetime, timezone
from pathlib import Path


def utc_now() -> datetime:
    """Return the current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


def format_timestamp(dt: datetime) -> str:
    """Format a datetime as ISO 8601 string."""
    return dt.isoformat()


def encode_image_base64(image_bytes: bytes) -> str:
    """Encode raw image bytes to a base64 string."""
    return base64.b64encode(image_bytes).decode("utf-8")


def decode_image_base64(encoded: str) -> bytes:
    """Decode a base64 string back to raw image bytes."""
    return base64.b64decode(encoded)


def ensure_directory(path: str | Path) -> Path:
    """Create a directory (and parents) if it doesn't exist. Returns the Path."""
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def build_screenshot_path(
    base_dir: str | Path,
    incident_id: int,
    timestamp: datetime | None = None,
) -> Path:
    """
    Build a screenshot file path following the convention:
    {base_dir}/YYYY/MM/DD/{incident_id}_{timestamp}.jpg

    Creates intermediate directories as needed.
    """
    ts = timestamp or utc_now()
    date_dir = Path(base_dir) / ts.strftime("%Y") / ts.strftime("%m") / ts.strftime("%d")
    ensure_directory(date_dir)
    filename = f"{incident_id}_{ts.strftime('%H%M%S')}.jpg"
    return date_dir / filename


def clamp(value: float, min_val: float, max_val: float) -> float:
    """Clamp a value between min and max bounds."""
    return max(min_val, min(value, max_val))


def truncate(text: str, max_length: int = 255) -> str:
    """Truncate a string to max_length, appending '...' if truncated."""
    if len(text) <= max_length:
        return text
    return text[: max_length - 3] + "..."
