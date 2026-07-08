"""
FireGuard AI — Camera Schemas

Pydantic schemas for camera API responses.
"""

from pydantic import BaseModel


class CameraStatusResponse(BaseModel):
    """Camera status information."""

    is_running: bool
    actual_fps: float
    frame_count: int
    camera_index: int
