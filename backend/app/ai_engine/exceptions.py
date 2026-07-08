"""
FireGuard AI — AI Engine Exceptions
"""

from app.core.exceptions import AIEngineError


class ModelNotLoadedError(AIEngineError):
    """Raised when inference is attempted before model is loaded."""

    def __init__(self):
        super().__init__(reason="AI model is not loaded")


class InferenceError(AIEngineError):
    """Raised when inference fails."""

    def __init__(self, detail: str = ""):
        super().__init__(reason=f"Inference failed: {detail}" if detail else "Inference failed")
