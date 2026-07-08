"""
FireGuard AI — Application Entry Point

FastAPI application factory with lifespan management.
This is the single point of assembly — all modules register
their routers here, and all startup/shutdown logic lives
in the lifespan context manager.

Run:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import Settings
from app.core.exceptions import (
    FireGuardError,
    NotFoundError,
    ValidationError,
    ConflictError,
    InvalidStateTransitionError,
    ServiceUnavailableError,
)
from app.dependencies import init_dependencies, get_db
from app.websocket.manager import ConnectionManager

# ── Logging Configuration ────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("fireguard")


# ── Lifespan ─────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan — runs startup and shutdown logic.

    Startup:
    1. Initialize dependency injection (DB engine, session factory, event bus)
    2. Create database tables
    3. Seed default settings
    4. Initialize camera, AI engine, alarm, and detection pipeline
    5. Start detection pipeline
    """
    settings: Settings = application.state.settings
    logger.info("🚀 Starting %s v%s [env=%s]", settings.app_name, settings.app_version, settings.env)

    # ── 1. Initialize DI ─────────────────────────────────────
    init_dependencies(settings)

    # ── 2. Create tables ─────────────────────────────────────
    from app.core.base_model import Base
    from app.core.database import create_database_engine

    import app.incident.models  # noqa: F401
    import app.settings.models  # noqa: F401
    import app.alarm.models  # noqa: F401

    engine = create_database_engine(settings.database_url, settings.debug)
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables verified")

    # ── 3. Seed settings ─────────────────────────────────────
    session_gen = get_db()
    session = next(session_gen)
    try:
        from app.settings.service import SettingsService
        settings_service = SettingsService(session)
        seeded = settings_service.seed_defaults()
        if seeded > 0:
            logger.info("🌱 Seeded %d default settings", seeded)
        next(session_gen, None)
    except Exception:
        next(session_gen, None)
        raise

    # ── 4. Initialize services ───────────────────────────────
    from app.dependencies import get_event_bus
    from app.camera.service import CameraService
    from app.ai_engine.detector import FireDetector
    from app.ai_engine.service import DetectionService
    from app.alarm.service import AlarmService

    event_bus = get_event_bus()
    ws_manager = application.state.ws_manager

    # Camera
    camera_service = CameraService(
        camera_index=settings.camera_index,
        fps=settings.camera_fps,
    )

    # AI Detector
    detector = FireDetector(
        model_path=settings.model_path,
        confidence_threshold=settings.confidence_threshold,
    )

    # Incident event handler (creates incidents from detections)
    # Using a dedicated session for the async event handler
    from app.core.database import create_session_factory
    incident_session_factory = create_session_factory(engine)

    from app.incident.service import IncidentService
    from app.ai_engine.events import DETECTION_EVENT

    async def incident_on_detection(event):
        """Create incident in a fresh session (since events are async)."""
        session = incident_session_factory()
        try:
            svc = IncidentService(
                session,
                screenshot_dir=settings.screenshot_dir,
                screenshot_quality=settings.screenshot_quality,
            )
            await svc._on_detection(event)
        finally:
            session.close()

    # Subscribe incident creation handler FIRST so it enriches the event with incident_id
    event_bus.subscribe(DETECTION_EVENT, incident_on_detection)

    # Alarm (subscribes to DETECTION_EVENT second, so it sees the enriched incident_id)
    alarm_service = AlarmService(
        event_bus=event_bus,
        ws_manager=ws_manager,
        confirmation_seconds=settings.alarm_confirmation_seconds,
    )

    # Detection pipeline
    detection_service = DetectionService(
        camera=camera_service,
        detector=detector,
        event_bus=event_bus,
        ws_manager=ws_manager,
        cooldown_seconds=settings.detection_cooldown_seconds,
    )

    # Store services for router access
    from app.camera.router import set_camera_service
    from app.ai_engine.router import set_detection_service
    from app.alarm.router import set_alarm_service
    from app.websocket.router import set_ws_dependencies

    set_camera_service(camera_service)
    set_detection_service(detection_service)
    set_alarm_service(alarm_service)
    set_ws_dependencies(ws_manager, alarm_service, detection_service)

    # Store on app state for other access
    application.state.camera_service = camera_service
    application.state.detection_service = detection_service
    application.state.alarm_service = alarm_service

    # Start the detection pipeline loop in the background
    await detection_service.start()

    logger.info("✅ All services initialized")

    # ── 5. Auto-start (optional — can also be triggered via API) ──
    # Don't auto-start camera — let the user start it from the dashboard
    logger.info("✅ %s is ready — start camera from the dashboard or POST /api/v1/camera/start", settings.app_name)

    yield  # ── Application runs here ──

    # ── Shutdown ─────────────────────────────────────────────
    logger.info("🛑 Shutting down %s", settings.app_name)
    await detection_service.stop()
    camera_service.stop()
    alarm_service.reset()
    await ws_manager.close_all()
    logger.info("👋 Shutdown complete")


# ── App Factory ──────────────────────────────────────────────


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = Settings()

    app = FastAPI(
        title=settings.app_name,
        description="Intelligent Fire Detection, Alarm & Emergency Response Platform",
        version=settings.app_version,
        docs_url="/docs" if settings.is_development else None,
        redoc_url="/redoc" if settings.is_development else None,
        lifespan=lifespan,
    )

    # Store settings and WS manager on app state
    app.state.settings = settings
    app.state.ws_manager = ConnectionManager()

    # ── Middleware ────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Exception Handlers ───────────────────────────────────
    _register_exception_handlers(app, settings)

    # ── Routers ──────────────────────────────────────────────
    _register_routers(app)

    return app


def _register_routers(app: FastAPI) -> None:
    """Register all module routers under /api/v1/."""
    from app.settings.router import router as settings_router
    from app.health.router import router as health_router
    from app.camera.router import router as camera_router
    from app.ai_engine.router import router as ai_engine_router
    from app.alarm.router import router as alarm_router
    from app.incident.router import router as incident_router
    from app.websocket.router import router as ws_router

    api_prefix = "/api/v1"

    app.include_router(settings_router, prefix=api_prefix)
    app.include_router(health_router, prefix=api_prefix)
    app.include_router(camera_router, prefix=api_prefix)
    app.include_router(ai_engine_router, prefix=api_prefix)
    app.include_router(alarm_router, prefix=api_prefix)
    app.include_router(incident_router, prefix=api_prefix)

    # WebSocket route (no API prefix)
    app.include_router(ws_router)


def _register_exception_handlers(app: FastAPI, settings: Settings) -> None:
    """Register custom exception handlers for consistent error responses."""

    @app.exception_handler(NotFoundError)
    async def not_found_handler(_: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content=_error_envelope(exc.code, exc.message),
        )

    @app.exception_handler(ValidationError)
    async def validation_handler(_: Request, exc: ValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_error_envelope(exc.code, exc.message, field=getattr(exc, "field", None)),
        )

    @app.exception_handler(ConflictError)
    async def conflict_handler(_: Request, exc: ConflictError) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content=_error_envelope(exc.code, exc.message),
        )

    @app.exception_handler(InvalidStateTransitionError)
    async def state_transition_handler(_: Request, exc: InvalidStateTransitionError) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content=_error_envelope(exc.code, exc.message),
        )

    @app.exception_handler(ServiceUnavailableError)
    async def service_unavailable_handler(_: Request, exc: ServiceUnavailableError) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content=_error_envelope(exc.code, exc.message),
        )

    @app.exception_handler(FireGuardError)
    async def fireguard_handler(_: Request, exc: FireGuardError) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content=_error_envelope(exc.code, exc.message),
        )

    @app.exception_handler(Exception)
    async def generic_handler(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception: %s", exc)
        message = str(exc) if settings.is_development else "An unexpected error occurred"
        return JSONResponse(
            status_code=500,
            content=_error_envelope("INTERNAL_ERROR", message),
        )


def _error_envelope(
    code: str,
    message: str,
    field: str | None = None,
) -> dict:
    """Build a consistent error response envelope."""
    return {
        "data": None,
        "meta": None,
        "errors": [
            {
                "code": code,
                "message": message,
                "field": field,
            }
        ],
    }


# ── Create the app instance ─────────────────────────────────
app = create_app()
