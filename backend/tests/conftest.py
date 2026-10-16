import sys
import uuid
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Ensure 'backend' directory is in Python path for test discovery
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app
from app.db.session import engine
from app.models.user import User
from app.core.security import hash_password, create_access_token


@pytest.fixture(scope="session")
def client():
    """Provides a TestClient instance for testing FastAPI endpoints."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def db_engine():
    """Provides the active SQLAlchemy engine."""
    return engine


@pytest.fixture(scope="session")
def teacher_user(db_engine):
    """Provides a seeded test teacher in PostgreSQL."""
    with Session(db_engine) as session:
        email = f"fixture_teacher_{uuid.uuid4().hex[:8]}@example.com"
        user = User(
            email=email,
            full_name="Dr. Jane Foster",
            hashed_password=hash_password("TeacherPassword123!"),
            role="teacher",
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        user_id = user.id
    return {"id": user_id, "email": email, "role": "teacher"}


@pytest.fixture(scope="session")
def teacher_headers(teacher_user):
    """Provides valid Bearer authorization headers for a teacher."""
    token = create_access_token({
        "sub": str(teacher_user["id"]),
        "role": "teacher",
        "email": teacher_user["email"],
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def student_user(db_engine):
    """Provides a seeded test student in PostgreSQL."""
    with Session(db_engine) as session:
        email = f"fixture_student_{uuid.uuid4().hex[:8]}@example.com"
        user = User(
            email=email,
            full_name="Miles Morales",
            hashed_password=hash_password("StudentPassword123!"),
            role="student",
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        user_id = user.id
    return {"id": user_id, "email": email, "role": "student"}


@pytest.fixture(scope="session")
def student_headers(student_user):
    """Provides valid Bearer authorization headers for a student."""
    token = create_access_token({
        "sub": str(student_user["id"]),
        "role": "student",
        "email": student_user["email"],
    })
    return {"Authorization": f"Bearer {token}"}
