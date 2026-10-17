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

    # Authentication configuration
    SECRET_KEY: str = "assignflow-super-secret-jwt-key-2026-production-ready"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    COOKIE_NAME: str = "access_token"

    # Upload configuration
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
        if self.ENVIRONMENT.lower() == "production":
            if self.SECRET_KEY == "assignflow-super-secret-jwt-key-2026-production-ready":
                raise ValueError("Insecure SECRET_KEY: A custom secret key must be set in production.")
            if self.DEBUG:
                raise ValueError("Insecure DEBUG mode: DEBUG must be set to False in production.")
            if self.ALLOWED_ORIGINS == "*" or not self.ALLOWED_ORIGINS.strip():
                raise ValueError("Insecure ALLOWED_ORIGINS: Wildcard origins ('*') are prohibited in production.")
        return self


settings = Settings()

# Ensure uploads directories exist on startup
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.SUBMISSIONS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
