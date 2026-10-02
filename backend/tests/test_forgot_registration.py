"""Tests for Forgot Registration Number recovery and OTP verification."""

import uuid
from decimal import Decimal
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import ApplicationStatus, LoanApplication
from app.models.loan_product import LoanProduct
from app.models.user import User, UserRole
from app.core.security import get_password_hash


@pytest.fixture
async def sample_borrower_with_application(db_session: AsyncSession):
    """Seed test applicant with loan application having DOB in snapshot."""
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="rohit.sharma@example.com",
        password_hash=get_password_hash("SecretPassword123!"),
        first_name="Rohit",
        last_name="Sharma",
        role=UserRole.APPLICANT,
        is_active=True,
        phone_number="+919876500001",
        pan_number="ABCDE9999F",
    )
    db_session.add(user)

    product = LoanProduct(
        id=uuid.uuid4(),
        code="TEST_FLEX",
        name="Test Flex Product",
        description="Testing product",
        min_amount=Decimal("10000.00"),
        max_amount=Decimal("100000.00"),
        min_tenor_months=12,
        max_tenor_months=36,
        base_apr=Decimal("12.50"),
        max_dti_ratio=Decimal("45.00"),
        required_documents=[],
        is_active=True,
    )
    db_session.add(product)
    await db_session.flush()

    app = LoanApplication(
        id=uuid.uuid4(),
        reference_number="APP-2026-TEST-7788",
        applicant_id=user.id,
        product_id=product.id,
        status=ApplicationStatus.SUBMITTED,
        requested_amount=Decimal("50000.00"),
        requested_tenor_months=24,
        applicant_personal_snapshot={
            "full_name": "Rohit Sharma",
            "email": "rohit.sharma@example.com",
            "phone": "+919876500001",
            "dateOfBirth": "1991-07-24",
        },
    )
    db_session.add(app)
    await db_session.commit()
    return user, app


@pytest.mark.asyncio
async def test_forgot_registration_invalid_details_returns_generic_error(
    async_client: AsyncClient,
    sample_borrower_with_application,
):
    """Submitting non-matching details returns generic verification failure."""
    res = await async_client.post(
        "/api/v1/auth/forgot-registration",
        json={
            "fullName": "Wrong Name",
            "mobile": "+91 99999 99999",
            "dateOfBirth": "1999-01-01",
        },
    )
    assert res.status_code == 400
    body = res.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VERIFICATION_FAILED"
    assert "We could not verify your details" in body["error"]["message"]


@pytest.mark.asyncio
async def test_forgot_registration_valid_details_success_and_otp_flow(
    async_client: AsyncClient,
    sample_borrower_with_application,
):
    """Submitting valid details issues challenge and returns reference number upon valid OTP."""
    _, app = sample_borrower_with_application

    # 1. Initiate recovery
    init_res = await async_client.post(
        "/api/v1/auth/forgot-registration",
        json={
            "fullName": "Rohit Sharma",
            "mobile": "+91 98765 00001",
            "dateOfBirth": "1991-07-24",
            "email": "rohit.sharma@example.com",
        },
    )
    assert init_res.status_code == 200
    init_body = init_res.json()
    assert init_body["success"] is True
    data = init_body["data"]
    assert data["step"] == "OTP_REQUIRED"
    assert "verification_token" in data
    assert "demo_code" in data
    verification_token = data["verification_token"]
    otp = data["demo_code"]

    # 2. Test invalid OTP rejection
    bad_otp_res = await async_client.post(
        "/api/v1/auth/verify-registration-otp",
        json={
            "verificationToken": verification_token,
            "otp": "000000",
        },
    )
    assert bad_otp_res.status_code == 400
    bad_body = bad_otp_res.json()
    assert bad_body["error"]["code"] == "INVALID_OTP"

    # 3. Test valid OTP verification
    valid_res = await async_client.post(
        "/api/v1/auth/verify-registration-otp",
        json={
            "verificationToken": verification_token,
            "otp": otp,
        },
    )
    assert valid_res.status_code == 200
    valid_body = valid_res.json()
    assert valid_body["success"] is True
    assert valid_body["data"]["reference_number"] == app.reference_number
    assert "Identity verified successfully" in valid_body["data"]["message"]

    # 4. Token cannot be reused (consumed session)
    reused_res = await async_client.post(
        "/api/v1/auth/verify-registration-otp",
        json={
            "verificationToken": verification_token,
            "otp": otp,
        },
    )
    assert reused_res.status_code == 400
    assert reused_res.json()["error"]["code"] == "SESSION_EXPIRED"


@pytest.mark.asyncio
async def test_top_level_route_alias_accessible(
    async_client: AsyncClient,
    sample_borrower_with_application,
):
    """Ensure both /api/v1/auth and /api/auth endpoints are accessible."""
    res = await async_client.post(
        "/api/auth/forgot-registration",
        json={
            "fullName": "Wrong Name",
            "mobile": "+91 99999 99999",
            "dateOfBirth": "1999-01-01",
        },
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "VERIFICATION_FAILED"
