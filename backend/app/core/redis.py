"""Redis Session Management and Token Revocation Cache."""

import time
from typing import Dict

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
