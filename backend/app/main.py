"""CredVidhi Loan Approval Processing & Verification System (LAPS).

Main FastAPI application factory, middleware configuration, and exception envelope handlers.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1 import api_v1_router
from app.config import get_settings
from app.core.logging import logger
from app.core.responses import error_response, success_response
from app.database import close_redis_client, engine

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifecycle hooks managing connections and graceful shutdown."""
    logger.info(f"Starting {settings.APP_NAME} in [{settings.ENVIRONMENT}] mode")
    yield
    logger.info(f"Shutting down {settings.APP_NAME}...")
    await close_redis_client()
    await engine.dispose()
    logger.info("Graceful shutdown completed.")


def create_application() -> FastAPI:
    """Factory function for initializing the FastAPI application."""
    app = FastAPI(
        title=settings.APP_NAME,
        description=(
            "Enterprise-grade, auditable loan origination, document verification, "
            "and deterministic risk underwriting API for CredVidhi."
        ),
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception Handlers
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        """Handle standard HTTP exceptions with normalized envelope."""
        logger.warning(
            f"HTTPException [{exc.status_code}] on {request.method} {request.url.path}: {exc.detail}"
        )
        return error_response(
            code=f"HTTP_{exc.status_code}",
            message=str(exc.detail),
            status_code=exc.status_code,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Normalize Pydantic request validation errors into standard format."""
        formatted_errors = []
        for err in exc.errors():
            formatted_errors.append(
                {
                    "loc": [str(item) for item in err.get("loc", [])],
                    "msg": err.get("msg", ""),
                    "type": err.get("type", ""),
                }
            )
        logger.warning(
            f"Validation error on {request.method} {request.url.path}: {formatted_errors}"
        )
        return error_response(
            code="VALIDATION_ERROR",
            message="Invalid request payload or parameters",
            details={"fields": formatted_errors},
            status_code=422,
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Intercept unhandled exceptions to prevent leaking server internal details."""
        logger.error(
            f"Unhandled exception on {request.method} {request.url.path}: {exc}",
            exc_info=True,
        )
        return error_response(
            code="INTERNAL_SERVER_ERROR",
            message="An internal server error occurred. Please contact the administrator.",
            status_code=500,
        )

    # Root Discovery Endpoint
    @app.get(
        "/",
        summary="API Root Information",
        description="Returns service metadata and active API version endpoints.",
        tags=["System"],
    )
    async def root() -> JSONResponse:
        return success_response(
            data={
                "service": settings.APP_NAME,
                "environment": settings.ENVIRONMENT,
                "version": "0.1.0",
                "api_v1_docs": "/docs",
                "api_v1_prefix": settings.API_V1_PREFIX,
            }
        )

    # Mount API v1 router
    app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

    return app


app = create_application()
