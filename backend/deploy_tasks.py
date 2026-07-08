"""
FireGuard AI — Deployment Database Initialization

This script is run at startup before starting the web server. It ensures
the database directory is created, creates all tables if they do not exist,
and stamps the database with the latest Alembic revision.
"""

import sys
import os
import logging
from pathlib import Path

# Ensure the backend directory is in the Python path for imports
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine
from alembic.config import Config
from alembic import command

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("deploy_tasks")

def main():
    logger.info("Starting database initialization...")
    try:
        # 1. Resolve database URL from environment or configuration fallback
        db_url = os.environ.get("FIREGUARD_DATABASE_URL")
        if not db_url:
            from app.config import Settings
            settings = Settings()
            db_url = settings.database_url
        
        logger.info(f"Target Database URL: {db_url}")
        
        # 2. Ensure parent directory exists for SQLite
        if db_url.startswith("sqlite"):
            db_path = db_url.replace("sqlite:///", "")
            db_dir = Path(db_path).parent.resolve()
            db_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"Verified directory for SQLite database at: {db_dir}")
            
        # 3. Create all tables using SQLAlchemy models
        from app.core.base_model import Base
        import app.incident.models  # noqa: F401
        import app.settings.models  # noqa: F401
        import app.alarm.models  # noqa: F401
        
        engine = create_engine(db_url)
        Base.metadata.create_all(bind=engine)
        logger.info("SQLAlchemy tables verified/created successfully.")
        
        # 4. Stamp Alembic migrations to head
        try:
            backend_dir = Path(__file__).resolve().parent
            os.chdir(backend_dir)
            
            alembic_cfg = Config("alembic.ini")
            command.stamp(alembic_cfg, "head")
            logger.info("Alembic schema version successfully stamped to HEAD.")
        except Exception as e:
            logger.error(f"Failed to stamp Alembic schema: {e}")
            # Note: We do not raise the exception so the app can still try to start 
            # if the tables were successfully created by metadata.create_all.
    except Exception as err:
        logger.critical(f"FATAL database initialization error: {err}", exc_info=True)
        raise err

if __name__ == "__main__":
    main()
