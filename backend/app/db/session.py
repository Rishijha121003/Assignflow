from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Create the SQLAlchemy engine using DATABASE_URL from settings
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Automatically check connection health before using from pool
    echo=False,
)

# Session factory for handling database transactions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative Base for models
Base = declarative_base()


def get_db() -> Generator:
    """Dependency that provides an active database session for a request and closes it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ping_db() -> dict:
    """Execute a simple query to verify active connectivity with PostgreSQL."""
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1")).scalar()
            return {
                "connected": result == 1,
                "message": "Database connection healthy",
            }
    except Exception as exc:
        return {
            "connected": False,
            "message": f"Database connection error: {str(exc)}",
        }
