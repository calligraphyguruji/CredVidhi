"""Comprehensive verification suite for Service Scaffolding, Health & Logging."""

from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.core.logging import PIIMaskingFormatter


@pytest.mark.asyncio
async def test_root_endpoint(async_client: AsyncClient) -> None:
    """Verify root endpoint returns system metadata in standardized envelope."""
    response = await async_client.get("/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["error"] is None
    assert payload["data"]["service"] == "CredVidhi API"
    assert "version" in payload["data"]
    assert payload["data"]["api_v1_prefix"] == "/api/v1"


@pytest.mark.asyncio
async def test_liveness_probe(async_client: AsyncClient) -> None:
    """Verify liveness probe returns HTTP 200 with ALIVE status."""
    response = await async_client.get("/api/v1/health/live")
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["status"] == "ALIVE"
    assert "uptime_seconds" in payload["data"]


@pytest.mark.asyncio
async def test_health_check_healthy(async_client: AsyncClient) -> None:
    """Verify health check returns HTTP 200 when all dependencies are UP."""
    with (
        patch("app.api.v1.health.check_db_health", return_value=True),
        patch("app.api.v1.health.check_redis_health", return_value=True),
    ):
        response = await async_client.get("/api/v1/health")
        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True
        assert payload["error"] is None
        assert payload["data"]["status"] == "HEALTHY"
        assert payload["data"]["dependencies"]["database"] == "UP"
        assert payload["data"]["dependencies"]["redis"] == "UP"


@pytest.mark.asyncio
async def test_health_check_degraded(async_client: AsyncClient) -> None:
    """Verify health check returns HTTP 503 when dependencies are unreachable."""
    with (
        patch("app.api.v1.health.check_db_health", return_value=False),
        patch("app.api.v1.health.check_redis_health", return_value=True),
    ):
        response = await async_client.get("/api/v1/health")
        assert response.status_code == 503
        payload = response.json()
        assert payload["success"] is False
        assert payload["data"] is None
        assert payload["error"]["code"] == "DEPENDENCY_UNHEALTHY"
        assert payload["error"]["details"]["status"] == "DEGRADED"
        assert payload["error"]["details"]["dependencies"]["database"] == "DOWN"
        assert payload["error"]["details"]["dependencies"]["redis"] == "UP"


@pytest.mark.asyncio
async def test_readiness_probe_ready(async_client: AsyncClient) -> None:
    """Verify readiness returns 200 when primary database is reachable."""
    with patch("app.api.v1.health.check_db_health", return_value=True):
        response = await async_client.get("/api/v1/health/ready")
        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True
        assert payload["data"]["status"] == "READY"


@pytest.mark.asyncio
async def test_readiness_probe_not_ready(async_client: AsyncClient) -> None:
    """Verify readiness returns 503 when primary database is down."""
    with patch("app.api.v1.health.check_db_health", return_value=False):
        response = await async_client.get("/api/v1/health/ready")
        assert response.status_code == 503
        payload = response.json()
        assert payload["success"] is False
        assert payload["error"]["code"] == "SERVICE_NOT_READY"


@pytest.mark.asyncio
async def test_standardized_404_error_envelope(async_client: AsyncClient) -> None:
    """Verify non-existent routes return standardized error envelope."""
    response = await async_client.get("/api/v1/non-existent-endpoint")
    assert response.status_code == 404
    payload = response.json()
    assert payload["success"] is False
    assert payload["data"] is None
    assert payload["error"]["code"] == "HTTP_404"
    assert "Not Found" in payload["error"]["message"]


def test_pii_masking_in_logs() -> None:
    """Verify PII masking filters PAN, Aadhaar, and credentials."""
    raw_message = (
        "Borrower with PAN ABCDE1234F and Aadhaar 1234 5678 9012 submitted form. "
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID enabled with password: 'secret_pass_123'."
    )
    masked = PIIMaskingFormatter.mask_sensitive_data(raw_message)

    # PAN check: ABCDE1234F -> ******1234F
    assert "ABCDE1234F" not in masked
    assert "1234F" in masked

    # Aadhaar check: 1234 5678 9012 -> ********9012
    assert "1234 5678" not in masked
    assert "9012" in masked

    # Bearer check
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in masked
    assert "Bearer [REDACTED_TOKEN]" in masked

    # Password check (quoted and unquoted)
    assert "secret_pass_123" not in masked
    assert "[REDACTED]" in masked

    unquoted = "login attempt with password=unquoted_pass123; user_id=42"
    masked_unquoted = PIIMaskingFormatter.mask_sensitive_data(unquoted)
    assert "unquoted_pass123" not in masked_unquoted
    assert "[REDACTED]" in masked_unquoted


def test_decimal_and_uuid_response_serialization() -> None:
    """Verify that Decimal and UUID instances serialize cleanly in responses without TypeError."""
    import json
    import uuid
    from decimal import Decimal

    from app.core.responses import error_response, success_response

    test_uuid = uuid.uuid4()
    test_decimal = Decimal("1250000.50")
    test_data = {
        "id": test_uuid,
        "amount": test_decimal,
        "tenor_months": 36,
    }

    resp = success_response(data=test_data)
    assert resp.status_code == 200
    parsed = json.loads(bytes(resp.body).decode("utf-8"))
    assert parsed["success"] is True
    assert parsed["data"]["id"] == str(test_uuid)
    assert parsed["data"]["amount"] == 1250000.50

    err_resp = error_response(
        code="INVALID_AMOUNT",
        message="Amount exceeds limit",
        details={"requested": test_decimal},
        status_code=400,
    )
    assert err_resp.status_code == 400
    err_parsed = json.loads(bytes(err_resp.body).decode("utf-8"))
    assert err_parsed["success"] is False
    assert err_parsed["error"]["details"]["requested"] == 1250000.50


def test_config_production_guard() -> None:
    """Verify that using default development secrets in production environment raises ValueError."""
    import pytest

    from app.config import Settings

    # In development, default secret is accepted
    dev_settings = Settings(ENVIRONMENT="development")
    assert dev_settings.ENVIRONMENT == "development"

    # In production, default secret must be rejected
    with pytest.raises(ValueError, match="Default development JWT_SECRET cannot be used"):
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET="credvidhi-super-secret-development-key-change-in-production",
        )
