from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.assignments import router as assignments_router
from app.api.classes import router as classes_router
from app.api.dashboard import router as dashboard_router
from app.api.submissions import router as submissions_router
from app.api.semesters import router as semesters_router
from app.api.workflow import router as workflow_router
from app.api.analytics import router as analytics_router
from app.api.notifications import router as notifications_router

# Path to the frontend directory
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup validation: verify production settings are secure
    settings.validate_production_settings()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Assignment Management Platform for College Teachers and Students",
    version="0.3.0",
    debug=settings.DEBUG,
    lifespan=lifespan,
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Safely serializes RequestValidationError details.
    Prevents UnicodeDecodeError crashes when request bodies contain non-UTF-8 binary bytes.
    """
    safe_errors = []
    for err in exc.errors():
        err_dict = dict(err)
        if "input" in err_dict and isinstance(err_dict["input"], bytes):
            try:
                err_dict["input"] = err_dict["input"].decode("utf-8")
            except UnicodeDecodeError:
                err_dict["input"] = f"<binary data: {len(err_dict['input'])} bytes>"
        if "ctx" in err_dict and isinstance(err_dict["ctx"], dict):
            safe_ctx = {}
            for k, v in err_dict["ctx"].items():
                safe_ctx[k] = str(v) if isinstance(v, Exception) else v
            err_dict["ctx"] = safe_ctx
        safe_errors.append(err_dict)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": safe_errors},
    )


# Configure CORS so browser requests from trusted origins with credentials work securely
origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
if "*" in origins or not origins:
    allow_origins = [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
else:
    allow_origins = origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(assignments_router, prefix="/api")
app.include_router(classes_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(submissions_router, prefix="/api")
app.include_router(semesters_router, prefix="/api")
app.include_router(workflow_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")

# Serve frontend static assets (CSS, JS) if frontend directory exists
if FRONTEND_DIR.exists():
    css_dir = FRONTEND_DIR / "css"
    js_dir = FRONTEND_DIR / "js"
    if css_dir.exists():
        app.mount("/css", StaticFiles(directory=str(css_dir)), name="css")
    if js_dir.exists():
        app.mount("/js", StaticFiles(directory=str(js_dir)), name="js")

    @app.get("/", include_in_schema=False)
    def serve_frontend_root():
        """Serves the frontend entry point index.html."""
        index_file = FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"message": "AssignFlow API is running. Frontend index.html not found."}
