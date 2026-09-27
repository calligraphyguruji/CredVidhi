"""Application Configuration Module for CredVidhi Backend.

Loads environment variables using Pydantic Settings v2 with strict type validation.
"""

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Core settings schema validated at application boot."""

    APP_NAME: str = "CredVidhi API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Database & Storage
    DATABASE_URL: str = (
        "postgresql+asyncpg://credvidhi:credvidhi_dev_password@localhost:5432/credvidhi"
    )
    REDIS_URL: str = "redis://localhost:6379/0"

    # MinIO / S3 Storage Configuration
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "credvidhi_minio"
    MINIO_SECRET_KEY: str = "credvidhi_minio_secret"
    MINIO_BUCKET_NAME: str = "credvidhi-documents"
    MINIO_SECURE: bool = False

    # Security & Authentication
    JWT_SECRET: str = "credvidhi-super-secret-development-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS Allowed Origins
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://credvidhi.vercel.app",
    ]

    # Logging
    LOG_LEVEL: str = "INFO"

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        """Disallow default development secrets when running in staging or production."""
        if self.ENVIRONMENT.lower() in ("production", "staging"):
            if "development" in self.JWT_SECRET.lower():
                raise ValueError(
                    "Default development JWT_SECRET cannot be used in production or staging environments."
                )
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
