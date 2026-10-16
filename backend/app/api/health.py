from fastapi import APIRouter, Response, status
from app.core.config import settings
from app.db.session import ping_db

router = APIRouter()


@router.get("/health", summary="Service and Database Health Check")
def health_check(response: Response):
    """
    Checks the status of the FastAPI backend and validates connectivity to PostgreSQL.
    """
    db_status = ping_db()

    is_healthy = db_status["connected"]
    if not is_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "healthy" if is_healthy else "degraded",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
    }
