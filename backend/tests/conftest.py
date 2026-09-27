"""Test fixtures and HTTP client configuration for CredVidhi Backend."""

import os
from typing import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient

# Set testing environment variable before app import
os.environ["ENVIRONMENT"] = "test"
os.environ["DEBUG"] = "true"

from app.main import app


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    """Configure anyio backend for pytest-asyncio."""
    return "asyncio"


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Provide an asynchronous HTTP client configured against the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
