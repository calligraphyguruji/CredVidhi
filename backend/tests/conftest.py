"""Test fixtures and HTTP client configuration for CredVidhi Backend."""

import os
from typing import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Set testing environment variable before app import
os.environ["ENVIRONMENT"] = "test"
os.environ["DEBUG"] = "true"

from app.database import get_db
from app.main import app
from app.models import Base

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture(scope="function", autouse=True)
async def setup_test_database() -> AsyncGenerator[None, None]:
    """Create fresh in-memory SQLite schema and reset rate limits for each test run."""
    from app.core.redis import _memory_rate_limits, _memory_recovery_sessions, _memory_revoked_tokens
    from app.database import get_redis_client, close_redis_client

    _memory_rate_limits.clear()
    _memory_recovery_sessions.clear()
    _memory_revoked_tokens.clear()

    try:
        r_client = await get_redis_client()
        rate_keys = await r_client.keys("rate:*")
        if rate_keys:
            await r_client.delete(*rate_keys)
        rec_keys = await r_client.keys("reg_recovery:*")
        if rec_keys:
            await r_client.delete(*rec_keys)
    except Exception:
        pass

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await close_redis_client()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield test database session."""
    async with TestingSessionLocal() as session:
        yield session


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Provide an asynchronous HTTP client configured against the FastAPI app with DB override."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with TestingSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    app.dependency_overrides.clear()
