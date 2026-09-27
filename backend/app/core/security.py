"""Cryptographic primitives, Password Hashing, and JWT Management."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()

# Modern cryptographic hashing context prioritizing Argon2
pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    deprecated="auto",
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify raw password against cryptographic hash."""
    return bool(pwd_context.verify(plain_password, hashed_password))


def get_password_hash(password: str) -> str:
    """Generate salted Argon2 hash for password."""
    return str(pwd_context.hash(password))


def create_jwt_token(
    claims: Dict[str, Any],
    expires_delta: timedelta,
    token_type: str = "access",
) -> str:
    """Encode JWT token with unique JTI, expiration, and token type."""
    now = datetime.now(timezone.utc)
    expire = now + expires_delta

    payload = {
        **claims,
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": token_type,
    }

    return str(jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM))


def create_access_token(
    user_id: str,
    email: str,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Generate an API access JWT token."""
    delta = expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    claims = {
        "sub": user_id,
        "email": email,
        "role": role,
    }
    return create_jwt_token(claims=claims, expires_delta=delta, token_type="access")


def create_refresh_token(
    user_id: str,
    email: str,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Generate a long-lived session refresh JWT token."""
    delta = expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    claims = {
        "sub": user_id,
        "email": email,
        "role": role,
    }
    return create_jwt_token(claims=claims, expires_delta=delta, token_type="refresh")


def decode_jwt_token(token: str) -> Dict[str, Any]:
    """Decode and validate signature and expiration of JWT token."""
    try:
        payload: Dict[str, Any] = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError as exc:
        raise ValueError(f"Invalid or expired token: {exc}") from exc
