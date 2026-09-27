"""Database & Redis Engine Initialization and Session Management.

Provides asynchronous session management with connection pooling, transaction safety,
and graceful degradation checks.
"""

import asyncio
from typing import AsyncGenerator, Optional

import redis.asyncio as aioredis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncAttrs,
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings
from app.core.logging import logger

settings = get_settings()


class Base(AsyncAttrs, DeclarativeBase):
    """Base model class with async attribute access."""

    pass


# Global engine and session factory
engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=settings.DEBUG,
    future=True,
)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Global Redis client and initialization lock
redis_client: Optional[aioredis.Redis] = None
redis_lock = asyncio.Lock()


async def get_redis_client() -> aioredis.Redis:
    """Retrieve or safely initialize the async Redis connection."""
    global redis_client
    if redis_client is None:
        async with redis_lock:
            if redis_client is None:
                redis_client = aioredis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_timeout=3.0,
                    socket_connect_timeout=3.0,
                )
    return redis_client


async def close_redis_client() -> None:
    """Close the global Redis client if open."""
    global redis_client
    if redis_client is not None:
        await redis_client.aclose()
        redis_client = None


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency yielding transactional async database session."""
    async with async_session_factory() as session:
        try:
            yield session
        except Exception as exc:
            await session.rollback()
            logger.error(f"Database session error: {exc}")
            raise
        finally:
            await session.close()


async def check_db_health() -> bool:
    """Execute a lightweight SELECT 1 query to verify database connectivity."""
    try:
        async with async_session_factory() as session:
            await asyncio.wait_for(session.execute(text("SELECT 1")), timeout=3.0)
            return True
    except Exception as exc:
        logger.warning(f"Database health check failed: {exc}")
        return False


async def check_redis_health() -> bool:
    """Execute a PING command to verify Redis connectivity."""
    try:
        client = await get_redis_client()
        result = await client.ping()
        return bool(result)
    except Exception as exc:
        logger.warning(f"Redis health check failed: {exc}")
        return False
