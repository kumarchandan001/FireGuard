"""
FireGuard AI — Exception Hierarchy

Structured exception classes for consistent error handling
across all modules. Maps to HTTP status codes for the API layer.
"""


class FireGuardError(Exception):
    """Base exception for all FireGuard application errors."""

    def __init__(self, message: str = "An unexpected error occurred", code: str = "INTERNAL_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)


# ── Client Errors (4xx) ─────────────────────────────────────


class NotFoundError(FireGuardError):
    """Resource not found (HTTP 404)."""

    def __init__(self, resource: str, identifier: str | int):
        super().__init__(
            message=f"{resource} with identifier '{identifier}' not found",
            code=f"{resource.upper()}_NOT_FOUND",
        )
        self.resource = resource
        self.identifier = identifier


class ValidationError(FireGuardError):
    """Input validation failure (HTTP 422)."""

    def __init__(self, message: str, field: str | None = None):
        super().__init__(message=message, code="VALIDATION_ERROR")
        self.field = field


class ConflictError(FireGuardError):
    """Resource state conflict (HTTP 409)."""

    def __init__(self, message: str):
        super().__init__(message=message, code="CONFLICT")


class InvalidStateTransitionError(FireGuardError):
    """Invalid state machine transition (HTTP 409)."""

    def __init__(self, current_state: str, target_state: str, entity: str = "resource"):
        super().__init__(
            message=f"Cannot transition {entity} from '{current_state}' to '{target_state}'",
            code="INVALID_STATE_TRANSITION",
        )
        self.current_state = current_state
        self.target_state = target_state


# ── Server Errors (5xx) ─────────────────────────────────────


class ServiceUnavailableError(FireGuardError):
    """External dependency or service unavailable (HTTP 503)."""

    def __init__(self, service: str, reason: str = ""):
        detail = f": {reason}" if reason else ""
        super().__init__(
            message=f"{service} is currently unavailable{detail}",
            code="SERVICE_UNAVAILABLE",
        )
        self.service = service


class CameraError(ServiceUnavailableError):
    """Camera-specific errors."""

    def __init__(self, reason: str = "Failed to access camera"):
        super().__init__(service="Camera", reason=reason)


class AIEngineError(ServiceUnavailableError):
    """AI engine-specific errors."""

    def __init__(self, reason: str = "AI engine encountered an error"):
        super().__init__(service="AI Engine", reason=reason)


class StorageError(FireGuardError):
    """File storage operation failure (HTTP 500)."""

    def __init__(self, message: str = "Storage operation failed"):
        super().__init__(message=message, code="STORAGE_ERROR")
