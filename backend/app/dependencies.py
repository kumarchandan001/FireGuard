"""
FireGuard AI — Dependency Injection

FastAPI dependency functions providing shared resources
to route handlers via Depends().
"""

from collections.abc import Generator

from sqlalchemy.orm import Session

from app.config import Settings
from app.core.database import create_database_engine, create_session_factory
from app.core.event_bus import EventBus

# ── Singletons (initialized once at startup) ────────────────
# These are set by the app factory in main.py

_settings: Settings | None = None
_session_factory: type[Session] | None = None
_event_bus: EventBus | None = None


def init_dependencies(settings: Settings) -> None:
    """
    Initialize global dependencies. Called once during app startup.

    This function creates the database engine, session factory,
    and event bus used throughout the application's lifetime.
    """
    global _settings, _session_factory, _event_bus

    _settings = settings

    engine = create_database_engine(
        database_url=settings.database_url,
        debug=settings.debug,
    )
    _session_factory = create_session_factory(engine)
    _event_bus = EventBus()


def get_settings() -> Settings:
    """FastAPI dependency: inject application settings."""
    if _settings is None:
        raise RuntimeError("Dependencies not initialized. Call init_dependencies() first.")
    return _settings


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency: inject a database session.

    Yields a session that is automatically closed after the request.
    The session uses a transaction that is committed on success
    or rolled back on error.
    """
    if _session_factory is None:
        raise RuntimeError("Dependencies not initialized. Call init_dependencies() first.")

    session = _session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_event_bus() -> EventBus:
    """FastAPI dependency: inject the event bus."""
    if _event_bus is None:
        raise RuntimeError("Dependencies not initialized. Call init_dependencies() first.")
    return _event_bus
