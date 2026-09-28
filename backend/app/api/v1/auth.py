"""Authentication, Session Management, and User Profile Endpoints."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.redis import is_token_revoked, revoke_token
from app.core.responses import error_response, success_response
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_jwt_token,
    get_password_hash,
    verify_password,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User, UserRole
from app.schemas.auth import (
    LogoutRequest,
    TokenRefreshRequest,
    TokenResponse,
    UserLoginRequest,
    UserProfileResponse,
    UserRegisterRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication & Access"])
settings = get_settings()


def mask_pan(pan: Optional[str]) -> Optional[str]:
    """Safely mask PAN string: ABCDE1234F -> ******1234F."""
    if not pan or len(pan) < 5:
        return None
    return f"******{pan[-5:]}"


@router.post(
    "/register",
    summary="Applicant Self-Registration",
    description="Registers a new borrower account with Argon2 password hashing.",
)
async def register(
    payload: UserRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Register new applicant account."""
    # Check if email is already taken
    existing = await db.execute(select(User).where(User.email == payload.email.lower().strip()))
    if existing.scalar_one_or_none():
        return error_response(
            code="EMAIL_ALREADY_EXISTS",
            message="An account with this email address already exists.",
            status_code=status.HTTP_409_CONFLICT,
        )

    # Hash password using Argon2
    password_hash = get_password_hash(payload.password)

    new_user = User(
        id=uuid.uuid4(),
        email=payload.email.lower().strip(),
        password_hash=password_hash,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        role=UserRole.APPLICANT,
        is_active=True,
        phone_number=payload.phone_number.strip() if payload.phone_number else None,
        pan_number=payload.pan_number.upper().strip() if payload.pan_number else None,
    )

    db.add(new_user)
    try:
        await db.commit()
        await db.refresh(new_user)
    except IntegrityError:
        await db.rollback()
        return error_response(
            code="EMAIL_ALREADY_EXISTS",
            message="An account with this email address already exists.",
            status_code=status.HTTP_409_CONFLICT,
        )

    user_dto = UserProfileResponse(
        id=new_user.id,
        email=new_user.email,
        first_name=new_user.first_name,
        last_name=new_user.last_name,
        full_name=new_user.full_name,
        role=new_user.role,
        is_active=new_user.is_active,
        phone_number=new_user.phone_number,
        masked_pan=mask_pan(new_user.pan_number),
    )

    # Issue JWT tokens for seamless instant onboarding
    access_token = create_access_token(
        user_id=str(new_user.id),
        email=new_user.email,
        role=new_user.role.value,
    )
    refresh_token = create_refresh_token(
        user_id=str(new_user.id),
        email=new_user.email,
        role=new_user.role.value,
    )

    data = user_dto.model_dump()
    data["access_token"] = access_token
    data["refresh_token"] = refresh_token
    data["token_type"] = "bearer"
    data["expires_in_seconds"] = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

    return success_response(
        data=data,
        status_code=status.HTTP_201_CREATED,
    )


@router.post(
    "/login",
    summary="Authenticate User and Issue Tokens",
    description="Validates email/password and returns JWT access and refresh tokens.",
)
async def login(
    payload: UserLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Authenticate credentials and issue JWT tokens."""
    result = await db.execute(select(User).where(User.email == payload.email.lower().strip()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        return error_response(
            code="INVALID_CREDENTIALS",
            message="Invalid email or password provided.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_active:
        return error_response(
            code="ACCOUNT_INACTIVE",
            message="Account has been suspended or deactivated.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    access_token = create_access_token(
        user_id=str(user.id),
        email=user.email,
        role=user.role.value,
    )
    refresh_token = create_refresh_token(
        user_id=str(user.id),
        email=user.email,
        role=user.role.value,
    )

    token_dto = TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    return success_response(data=token_dto.model_dump())


@router.post(
    "/refresh",
    summary="Refresh Access Token",
    description="Exchanges a valid refresh token for a newly minted access token.",
)
async def refresh_token_endpoint(
    payload: TokenRefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Validate refresh token and issue fresh access token."""
    try:
        decoded = decode_jwt_token(payload.refresh_token)
    except ValueError as exc:
        return error_response(
            code="INVALID_REFRESH_TOKEN",
            message=str(exc),
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    if decoded.get("type") != "refresh":
        return error_response(
            code="INVALID_TOKEN_TYPE",
            message="Provided token is not a refresh token.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    jti = decoded.get("jti")
    if jti and await is_token_revoked(jti):
        return error_response(
            code="TOKEN_REVOKED",
            message="Refresh token has been revoked.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    user_id_raw = decoded.get("sub")
    if not user_id_raw:
        return error_response(
            code="INVALID_TOKEN",
            message="Token subject missing.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        user_uuid = uuid.UUID(user_id_raw)
    except ValueError:
        return error_response(
            code="INVALID_TOKEN_SUBJECT",
            message="Invalid user identifier format.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        return error_response(
            code="USER_NOT_FOUND",
            message="User account is invalid or inactive.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    new_access_token = create_access_token(
        user_id=str(user.id),
        email=user.email,
        role=user.role.value,
    )

    return success_response(
        data={
            "access_token": new_access_token,
            "token_type": "bearer",
            "expires_in_seconds": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }
    )


@router.post(
    "/logout",
    summary="Revoke Current Token Session",
    description="Blacklists current access and optional refresh JWT token in Redis to prevent replay.",
)
async def logout(
    payload: Optional[LogoutRequest] = None,
    authorization: Optional[str] = Header(None),
) -> JSONResponse:
    """Revoke active access and refresh JWT tokens."""
    # 1. Revoke access token from header
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(None, 1)[1].strip()
        try:
            decoded = decode_jwt_token(token)
            jti = decoded.get("jti")
            exp = decoded.get("exp")
            if jti and exp:
                await revoke_token(jti, exp)
        except ValueError:
            pass  # Token is already invalid, no further action needed

    # 2. Revoke refresh token from body if provided
    if payload and payload.refresh_token:
        try:
            decoded_ref = decode_jwt_token(payload.refresh_token)
            ref_jti = decoded_ref.get("jti")
            ref_exp = decoded_ref.get("exp")
            if ref_jti and ref_exp:
                await revoke_token(ref_jti, ref_exp)
        except ValueError:
            pass

    return success_response(data={"message": "Successfully logged out."})


@router.get(
    "/me",
    summary="Current User Profile",
    description="Returns profile details for the authenticated user with masked PII.",
)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Return authenticated borrower / staff profile."""
    user_dto = UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        phone_number=current_user.phone_number,
        masked_pan=mask_pan(current_user.pan_number),
    )
    return success_response(data=user_dto.model_dump())
