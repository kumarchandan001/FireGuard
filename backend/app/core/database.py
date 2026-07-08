"""
FireGuard AI — Database Engine & Session Management

Provides SQLAlchemy engine creation and session factory.
SQLite is the default for MVP; designed for seamless migration
to PostgreSQL by changing only the connection string.
"""

from pathlib import Path

from sqlalchemy import create_engine, Engine
from sqlalchemy.orm import sessionmaker, Session


def create_database_engine(database_url: str, debug: bool = False) -> Engine:
    """
    Create a SQLAlchemy engine from the given database URL.

    Handles SQLite-specific configuration (check_same_thread)
    and enables echo mode when debug is True.
    """
    connect_args: dict = {}

    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False

        # Ensure the SQLite database directory exists
        db_path = database_url.replace("sqlite:///", "")
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(
        database_url,
        connect_args=connect_args,
        echo=debug,
        pool_pre_ping=True,
    )
    return engine


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    """Create a session factory bound to the given engine."""
    return sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )
