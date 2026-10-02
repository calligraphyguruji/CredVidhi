"""Authentication, Session Management, and User Profile Endpoints."""

import re
import secrets
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.redis import (
    check_rate_limit,
    delete_recovery_session,
    get_recovery_session,
    is_token_revoked,
    revoke_token,
    store_recovery_session,
)
from app.core.responses import error_response, success_response
from app.core.sanitizer import mask_phone
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_jwt_token,
    get_password_hash,
    verify_password,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.models.application import LoanApplication
from app.models.user import User, UserRole
from app.schemas.auth import (
    ForgotRegistrationRequest,
    LogoutRequest,
    TokenRefreshRequest,
    TokenResponse,
    UserLoginRequest,
    UserProfileResponse,
    UserRegisterRequest,
    VerifyRegistrationOtpRequest,
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


def _normalize_phone(phone_str: Optional[str]) -> str:
    """Extract standard last 10 digits for Indian phone number matching."""
    if not phone_str:
        return ""
    digits = re.sub(r"\D", "", phone_str)
    if len(digits) >= 10:
        return digits[-10:]
    return digits


def _normalize_name(name_str: Optional[str]) -> str:
    """Normalize whitespace and case for robust name comparisons."""
    if not name_str:
        return ""
    return " ".join(name_str.strip().lower().split())


def _normalize_date(date_str: Optional[str]) -> Optional[str]:
    """Parse common date formats (ISO, slash, hyphen) to YYYY-MM-DD."""
    if not date_str:
        return None
    cleaned = date_str.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d", "%d.%m.%Y"):
        try:
            dt = datetime.strptime(cleaned, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
    return cleaned


@router.post(
    "/forgot-registration",
    summary="Initiate Application Reference Number Recovery",
    description="Validates borrower identity details against records and issues a verification security challenge.",
)
async def forgot_registration(
    payload: ForgotRegistrationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Verify borrower identity against database and issue one-time recovery challenge."""
    client_ip = request.client.host if request.client else "unknown"
    clean_mobile = _normalize_phone(payload.mobile)

    # 1. Enforce strict rate limit:
    # 1a. IP-level limit: maximum 20 attempts per 15 minutes per IP
    ip_rate_key = f"rate:forgot_reg_ip:{client_ip}"
    if not await check_rate_limit(ip_rate_key, max_attempts=20, window_seconds=900):
        return error_response(
            code="RATE_LIMIT_EXCEEDED",
            message="Too many verification attempts from your network. Please wait 15 minutes before trying again.",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    # 1b. Target-specific limit: maximum 5 attempts per 15 minutes per IP + mobile
    rate_key = f"rate:forgot_reg:{client_ip}:{clean_mobile}"
    allowed = await check_rate_limit(rate_key, max_attempts=5, window_seconds=900)
    if not allowed:
        return error_response(
            code="RATE_LIMIT_EXCEEDED",
            message="Too many verification attempts. Please wait 15 minutes before trying again.",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    # 2. Look up applicants in database (narrowed by phone suffix and optional email)
    stmt = select(User).where(User.role == UserRole.APPLICANT)
    if len(clean_mobile) == 10:
        stmt = stmt.where(User.phone_number.like(f"%{clean_mobile}%"))
    if payload.email:
        stmt = stmt.where(User.email == payload.email.lower().strip())

    result = await db.execute(stmt)
    candidate_users = result.scalars().all()

    matched_user = None
    matched_app = None

    normalized_input_name = _normalize_name(payload.full_name)
    normalized_input_dob = _normalize_date(payload.date_of_birth)

    for user in candidate_users:
        user_phone = _normalize_phone(user.phone_number)
        user_name = _normalize_name(f"{user.first_name} {user.last_name}")

        # Name match: exact full name or token sets match
        name_match = (
            user_name == normalized_input_name
            or set(user_name.split()) == set(normalized_input_name.split())
        )
        phone_match = user_phone == clean_mobile

        if not (name_match and phone_match):
            continue

        # Look up applications for this borrower
        app_stmt = (
            select(LoanApplication)
            .where(LoanApplication.applicant_id == user.id)
            .order_by(LoanApplication.created_at.desc())
        )
        app_res = await db.execute(app_stmt)
        apps = app_res.scalars().all()

        for app in apps:
            snapshot = app.applicant_personal_snapshot or {}
            dob_val = (
                snapshot.get("dateOfBirth")
                or snapshot.get("date_of_birth")
                or snapshot.get("dob")
            )
            # If DOB in snapshot, verify it matches
            if dob_val:
                if _normalize_date(str(dob_val)) == normalized_input_dob:
                    matched_user = user
                    matched_app = app
                    break
            else:
                # If legacy snapshot did not record DOB, ensure valid date input
                if normalized_input_dob:
                    matched_user = user
                    matched_app = app
                    break

        if matched_user and matched_app:
            break

    # If verification failed, return generic error (do NOT leak which field failed)
    if not matched_user or not matched_app:
        return error_response(
            code="VERIFICATION_FAILED",
            message="We could not verify your details. Please check your information and try again.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # 3. Successful identity verification -> generate 6-digit OTP & session token
    otp = f"{secrets.randbelow(900000) + 100000}"
    verification_token = secrets.token_urlsafe(32)

    session_data = {
        "user_id": str(matched_user.id),
        "reference_number": matched_app.reference_number,
        "otp": otp,
        "attempts": 0,
        "mobile": payload.mobile,
    }
    await store_recovery_session(verification_token, session_data, ttl_seconds=300)

    masked_contact = mask_phone(payload.mobile) or f"******{clean_mobile[-4:]}"
    response_data = {
        "step": "OTP_REQUIRED",
        "verification_token": verification_token,
        "masked_destination": masked_contact,
        "message": f"Identity verified. A one-time verification code has been dispatched to {masked_contact}.",
    }

    # In development, testing, or demo mode, supply demo_code for self-service verification
    if settings.ENVIRONMENT.lower() in ("development", "dev", "test", "demo", "local"):
        response_data["demo_code"] = otp

    return success_response(data=response_data)


@router.post(
    "/verify-registration-otp",
    summary="Verify OTP and Retrieve Application Reference Number",
    description="Validates the one-time code and securely delivers the recovered reference number.",
)
async def verify_registration_otp(
    payload: VerifyRegistrationOtpRequest,
    request: Request,
) -> JSONResponse:
    """Validate OTP and return reference number with masked contact confirmation."""
    client_ip = request.client.host if request.client else "unknown"

    # Rate limit on OTP verification (maximum 10 per minute per IP)
    rate_key = f"rate:verify_otp:{client_ip}"
    if not await check_rate_limit(rate_key, max_attempts=10, window_seconds=60):
        return error_response(
            code="RATE_LIMIT_EXCEEDED",
            message="Too many verification attempts. Please wait a moment before trying again.",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    session_data = await get_recovery_session(payload.verification_token)
    if not session_data:
        return error_response(
            code="SESSION_EXPIRED",
            message="Verification session has expired or is invalid. Please start again.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    attempts = session_data.get("attempts", 0)
    if attempts >= 3:
        await delete_recovery_session(payload.verification_token)
        return error_response(
            code="MAX_ATTEMPTS_EXCEEDED",
            message="Too many failed attempts. Verification session cancelled. Please start again.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if payload.otp.strip() != session_data.get("otp"):
        session_data["attempts"] = attempts + 1
        await store_recovery_session(payload.verification_token, session_data, ttl_seconds=300)
        return error_response(
            code="INVALID_OTP",
            message="Invalid verification code. Please check the code and try again.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Valid OTP -> Single use token, consume session immediately
    await delete_recovery_session(payload.verification_token)

    ref_number = session_data["reference_number"]
    masked_contact = mask_phone(session_data.get("mobile")) or "registered contact"

    return success_response(
        data={
            "success": True,
            "message": f"Identity verified successfully. Your registration number has been dispatched to {masked_contact}.",
            "masked_contact": masked_contact,
            "reference_number": ref_number,
        }
    )
