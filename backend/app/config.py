"""Application Configuration Module for CredVidhi Backend.

Loads environment variables using Pydantic Settings v2 with strict type validation.
"""

import json
from functools import lru_cache
from typing import Any, List, Union

from pydantic import field_validator, model_validator
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

    # CORS Allowed Origins (Flexible parsing: supports JSON list, single string, or comma-separated)
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://credvidhi.vercel.app",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> List[str]:
        """Safely parse CORS_ORIGINS from JSON array, comma-delimited string, or list."""
        if isinstance(v, list):
            return [str(item).strip() for item in v if str(item).strip()]
        if isinstance(v, str):
            v_stripped = v.strip()
            if not v_stripped:
                return []
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    parsed = json.loads(v_stripped)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except Exception:
                    inner = v_stripped[1:-1]
                    return [
                        item.strip().strip("'\"")
                        for item in inner.split(",")
                        if item.strip().strip("'\"")
                    ]
            return [
                item.strip().strip("'\"")
                for item in v_stripped.split(",")
                if item.strip().strip("'\"")
            ]
        return []

    # Logging
    LOG_LEVEL: str = "INFO"

    # LLM / AI Configuration (Server-Side Only)
    LLM_PROVIDER: str = "groq"
    LLM_MODEL: str = "openai/gpt-oss-120b"
    LLM_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    LLM_BASE_URL: str = ""
    LLM_TIMEOUT_SECONDS: float = 30.0

    @model_validator(mode="after")
    def validate_and_normalize_settings(self) -> "Settings":
        """Normalize Render/Postgres URLs to postgresql+asyncpg and validate production secrets."""
        # Auto-configure Gemini if GEMINI_API_KEY is supplied
        if self.GEMINI_API_KEY and not self.LLM_API_KEY:
            self.LLM_API_KEY = self.GEMINI_API_KEY
            self.LLM_PROVIDER = "gemini"
            if self.LLM_MODEL == "openai/gpt-oss-120b":
                self.LLM_MODEL = "gemini-2.0-flash"

        if self.DATABASE_URL.startswith("postgres://"):
            self.DATABASE_URL = self.DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
        elif self.DATABASE_URL.startswith("postgresql://") and not self.DATABASE_URL.startswith(
            "postgresql+asyncpg://"
        ):
            self.DATABASE_URL = self.DATABASE_URL.replace(
                "postgresql://", "postgresql+asyncpg://", 1
            )

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
