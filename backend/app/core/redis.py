"""Redis Session Management and Token Revocation Cache."""

import json
import time
from typing import Dict, Optional

from app.core.logging import logger
from app.database import get_redis_client

# In-memory fallback mapping jti -> exp_timestamp with automatic expiration pruning
_memory_revoked_tokens: Dict[str, int] = {}


async def revoke_token(jti: str, exp_timestamp: int) -> None:
    """Blacklist a token JTI until its expiration timestamp."""
    ttl = int(exp_timestamp - time.time())
    if ttl <= 0:
        return

    try:
        client = await get_redis_client()
        key = f"revoked_token:{jti}"
        await client.set(key, "revoked", ex=ttl)
    except Exception as exc:
        logger.warning(
            f"Redis connection failed during token revocation; using memory fallback: {exc}"
        )
        _memory_revoked_tokens[jti] = exp_timestamp


async def is_token_revoked(jti: str) -> bool:
    """Verify if a JWT token has been revoked / logged out."""
    now = int(time.time())
    if jti in _memory_revoked_tokens:
        if _memory_revoked_tokens[jti] > now:
            return True
        else:
            del _memory_revoked_tokens[jti]

    try:
        client = await get_redis_client()
        key = f"revoked_token:{jti}"
        exists = await client.exists(key)
        return bool(exists)
    except Exception as exc:
        logger.warning(f"Redis connection failed checking token revocation status: {exc}")
        return jti in _memory_revoked_tokens and _memory_revoked_tokens[jti] > now


# In-memory rate limiting fallback: key -> (count, reset_timestamp)
_memory_rate_limits: Dict[str, tuple[int, float]] = {}

# In-memory recovery sessions fallback: token -> (dict, expiration_timestamp)
_memory_recovery_sessions: Dict[str, tuple[dict, float]] = {}


async def check_rate_limit(key: str, max_attempts: int, window_seconds: int) -> bool:
    """Check if key has exceeded max_attempts within window_seconds.

    Returns True if allowed, False if limit exceeded.
    """
    now = time.time()
    try:
        client = await get_redis_client()
        current = await client.incr(key)
        if current == 1:
            await client.expire(key, window_seconds)
        return current <= max_attempts
    except Exception as exc:
        logger.warning(f"Redis rate limit check failed; using in-memory fallback: {exc}")
        if key in _memory_rate_limits:
            count, reset_at = _memory_rate_limits[key]
            if now > reset_at:
                _memory_rate_limits[key] = (1, now + window_seconds)
                return True
            if count >= max_attempts:
                return False
            _memory_rate_limits[key] = (count + 1, reset_at)
            return True
        else:
            _memory_rate_limits[key] = (1, now + window_seconds)
            return True


async def store_recovery_session(token: str, data: dict, ttl_seconds: int = 300) -> None:
    """Store temporary identity verification OTP recovery session."""
    now = time.time()
    try:
        client = await get_redis_client()
        await client.set(f"reg_recovery:{token}", json.dumps(data), ex=ttl_seconds)
    except Exception as exc:
        logger.warning(f"Redis store_recovery_session failed; using in-memory fallback: {exc}")
        _memory_recovery_sessions[token] = (data, now + ttl_seconds)


async def get_recovery_session(token: str) -> Optional[dict]:
    """Retrieve recovery session if valid and not expired."""
    now = time.time()
    try:
        client = await get_redis_client()
        val = await client.get(f"reg_recovery:{token}")
        if val:
            return json.loads(val)
    except Exception as exc:
        logger.warning(f"Redis get_recovery_session failed; using in-memory fallback: {exc}")

    if token in _memory_recovery_sessions:
        data, exp = _memory_recovery_sessions[token]
        if exp > now:
            return data
        else:
            del _memory_recovery_sessions[token]
    return None


async def delete_recovery_session(token: str) -> None:
    """Delete recovery session upon completion or cancellation."""
    try:
        client = await get_redis_client()
        await client.delete(f"reg_recovery:{token}")
    except Exception:
        pass
    _memory_recovery_sessions.pop(token, None)
