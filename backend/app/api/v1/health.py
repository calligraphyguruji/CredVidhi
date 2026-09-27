"""System Health and Readiness Verification Endpoints.

Provides deep operational diagnostics for PostgreSQL, Redis, and overall service status.
"""

import time
from typing import Dict

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.core.responses import error_response, success_response
from app.database import check_db_health, check_redis_health

router = APIRouter(prefix="/health", tags=["Health & Diagnostics"])

# Record service boot time
START_TIME = time.time()


@router.get(
    "",
    summary="Comprehensive Service Health Check",
    description="Validates API uptime and deep connectivity to PostgreSQL and Redis.",
    response_model=None,
)
async def get_health() -> JSONResponse:
    """Perform full health audit of the service and upstream dependencies."""
    uptime_seconds = round(time.time() - START_TIME, 2)
    db_ok = await check_db_health()
    redis_ok = await check_redis_health()

    dependencies: Dict[str, str] = {
        "database": "UP" if db_ok else "DOWN",
        "redis": "UP" if redis_ok else "DOWN",
    }

    all_healthy = db_ok and redis_ok

    payload = {
        "status": "HEALTHY" if all_healthy else "DEGRADED",
        "uptime_seconds": uptime_seconds,
        "dependencies": dependencies,
    }

    if all_healthy:
        return success_response(data=payload, status_code=status.HTTP_200_OK)

    return error_response(
        code="DEPENDENCY_UNHEALTHY",
        message="One or more critical dependencies are degraded or unreachable",
        details=payload,
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


@router.get(
    "/live",
    summary="Liveness Probe",
    description="Lightweight probe to verify that the HTTP process is alive.",
)
async def get_liveness() -> JSONResponse:
    """Return 200 OK if process is responding."""
    return success_response(
        data={"status": "ALIVE", "uptime_seconds": round(time.time() - START_TIME, 2)},
        status_code=status.HTTP_200_OK,
    )


@router.get(
    "/ready",
    summary="Readiness Probe",
    description="Validates whether the service can accept incoming production traffic.",
)
async def get_readiness() -> JSONResponse:
    """Return 200 OK only when essential persistence stores are operational."""
    db_ok = await check_db_health()
    if db_ok:
        return success_response(data={"status": "READY"}, status_code=status.HTTP_200_OK)

    return error_response(
        code="SERVICE_NOT_READY",
        message="Primary database is not ready to accept transactions",
        details={"database": "DOWN"},
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    )
