"""
FireGuard AI — Settings Exceptions
"""

from app.core.exceptions import NotFoundError


class SettingNotFoundError(NotFoundError):
    """Raised when a setting key does not exist."""

    def __init__(self, key: str):
        super().__init__(resource="Setting", identifier=key)
