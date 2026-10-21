from typing import Optional
from pathlib import Path
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_PATH = BASE_DIR / ".env"


class Settings(BaseSettings):
    PROJECT_NAME: str = "AssignFlow"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    DATABASE_URL: str = "postgresql+psycopg2://support_app:rishi12@127.0.0.1:5432/ai_support_platform?options=-csearch_path%3Dassignflow,public"
    ALLOWED_ORIGINS: str = "*"
    CANONICAL_URL: Optional[str] = None

    # Authentication configuration
    SECRET_KEY: str = "assignflow-super-secret-jwt-key-2026-production-ready"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    COOKIE_NAME: str = "access_token"
    COOKIE_SECURE: Optional[bool] = None

    # Persistent Storage configuration
    STORAGE_DIR: Optional[Path] = None
    UPLOAD_DIR: Path = BASE_DIR / "backend" / "app" / "uploads" / "assignments"
    SUBMISSIONS_UPLOAD_DIR: Path = BASE_DIR / "backend" / "app" / "uploads" / "submissions"
    MAX_UPLOAD_SIZE_MB: int = 10

    # Email / SMTP configuration (configurable provider with safe fallback)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = True
    EMAILS_FROM_EMAIL: str = "noreply@assignflow.edu"
    EMAILS_FROM_NAME: str = "AssignFlow Notifications"

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    model_config = SettingsConfigDict(
        env_file=(str(ENV_PATH), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        # Resolve persistent storage directory if configured
        if self.STORAGE_DIR:
            storage_path = Path(self.STORAGE_DIR).resolve()
            default_asgn = BASE_DIR / "backend" / "app" / "uploads" / "assignments"
            default_sub = BASE_DIR / "backend" / "app" / "uploads" / "submissions"
            if self.UPLOAD_DIR == default_asgn:
                self.UPLOAD_DIR = storage_path / "assignments"
            if self.SUBMISSIONS_UPLOAD_DIR == default_sub:
                self.SUBMISSIONS_UPLOAD_DIR = storage_path / "submissions"

        self.UPLOAD_DIR = Path(self.UPLOAD_DIR).resolve()
        self.SUBMISSIONS_UPLOAD_DIR = Path(self.SUBMISSIONS_UPLOAD_DIR).resolve()

        env = self.ENVIRONMENT.lower()
        if env in ("production", "staging"):
            if self.SECRET_KEY == "assignflow-super-secret-jwt-key-2026-production-ready":
                raise ValueError(f"Insecure SECRET_KEY: A custom secret key must be set in {env}.")
            if self.DEBUG:
                raise ValueError(f"Insecure DEBUG mode: DEBUG must be set to False in {env}.")
            if self.ALLOWED_ORIGINS == "*" or not self.ALLOWED_ORIGINS.strip():
                raise ValueError(f"Insecure ALLOWED_ORIGINS: Wildcard origins ('*') are prohibited in {env}.")
        return self


settings = Settings()

# Ensure uploads directories exist on startup
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.SUBMISSIONS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
