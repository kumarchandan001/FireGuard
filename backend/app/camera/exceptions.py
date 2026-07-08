"""
FireGuard AI — Camera Exceptions
"""

from app.core.exceptions import CameraError


class CameraNotAvailableError(CameraError):
    """Raised when the camera cannot be opened."""

    def __init__(self, camera_index: int = 0):
        super().__init__(reason=f"Camera at index {camera_index} is not available")


class CameraAlreadyRunningError(CameraError):
    """Raised when trying to start an already running camera."""

    def __init__(self):
        super().__init__(reason="Camera is already running")
