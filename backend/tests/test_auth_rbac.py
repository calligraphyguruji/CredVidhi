"""Comprehensive Verification Suite for Authentication, RBAC, and Product Catalog."""

import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.scripts.seed_db import seed_data


@pytest.mark.asyncio
async def test_applicant_registration_success(async_client: AsyncClient) -> None:
    """Verify applicant can register and receives masked PII profile."""
    payload = {
        "email": "testborrower@example.com",
        "password": "StrongPassword123!",
        "first_name": "Aarav",
        "last_name": "Patel",
        "phone_number": "+919876543219",
        "pan_number": "ABCDE1234F",
    }
    response = await async_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    user = data["data"]
    assert user["email"] == "testborrower@example.com"
    assert user["role"] == "APPLICANT"
    assert user["masked_pan"] == "******1234F"
    assert "access_token" in user and len(user["access_token"]) > 20
    assert "refresh_token" in user and len(user["refresh_token"]) > 20
    assert "password_hash" not in user

    # Verify issued token can authenticate immediately against /auth/me
    me_res = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {user['access_token']}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["data"]["email"] == "testborrower@example.com"


@pytest.mark.asyncio
async def test_duplicate_registration_conflict(async_client: AsyncClient) -> None:
    """Verify duplicate registration with existing email returns 409 Conflict."""
    payload = {
        "email": "duplicate@example.com",
        "password": "StrongPassword123!",
        "first_name": "Test",
        "last_name": "User",
    }
    res1 = await async_client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = await async_client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 409
    data = res2.json()
    assert data["success"] is False
    assert data["error"]["code"] == "EMAIL_ALREADY_EXISTS"


@pytest.mark.asyncio
async def test_login_flow_and_token_issuance(async_client: AsyncClient) -> None:
    """Verify login with correct credentials yields access and refresh tokens."""
    # Register first
    await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "loginuser@example.com",
            "password": "CorrectPassword123!",
            "first_name": "Login",
            "last_name": "User",
        },
    )

    # Valid Login
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "loginuser@example.com", "password": "CorrectPassword123!"},
    )
    assert login_res.status_code == 200
    token_data = login_res.json()["data"]
    assert "access_token" in token_data
    assert "refresh_token" in token_data
    assert token_data["token_type"] == "bearer"

    # Invalid Password
    bad_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "loginuser@example.com", "password": "WrongPassword!"},
    )
    assert bad_login.status_code == 401
    assert bad_login.json()["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_token_refresh_flow(async_client: AsyncClient) -> None:
    """Verify refresh token can be exchanged for a new access token."""
    await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "refreshtest@example.com",
            "password": "Password123!",
            "first_name": "Refresh",
            "last_name": "Tester",
        },
    )
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "refreshtest@example.com", "password": "Password123!"},
    )
    refresh_token = login_res.json()["data"]["refresh_token"]

    refresh_res = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_res.status_code == 200
    new_tokens = refresh_res.json()["data"]
    assert "access_token" in new_tokens


@pytest.mark.asyncio
async def test_logout_and_revocation(async_client: AsyncClient) -> None:
    """Verify that logged out tokens are revoked and cannot access protected endpoints."""
    await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "logoutuser@example.com",
            "password": "Password123!",
            "first_name": "Logout",
            "last_name": "User",
        },
    )
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "logoutuser@example.com", "password": "Password123!"},
    )
    access_token = login_res.json()["data"]["access_token"]
    auth_header = {"Authorization": f"Bearer {access_token}"}

    # Verify access works prior to logout
    me_res = await async_client.get("/api/v1/auth/me", headers=auth_header)
    assert me_res.status_code == 200

    # Logout with refresh_token in payload
    refresh_token = login_res.json()["data"]["refresh_token"]
    logout_res = await async_client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_token},
        headers=auth_header,
    )
    assert logout_res.status_code == 200

    # Verify access token is now rejected
    rejected_res = await async_client.get("/api/v1/auth/me", headers=auth_header)
    assert rejected_res.status_code == 401

    # Verify refresh token is also revoked and cannot be refreshed
    rejected_refresh = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert rejected_refresh.status_code == 401
    assert rejected_refresh.json()["error"]["code"] == "TOKEN_REVOKED"


@pytest.mark.asyncio
async def test_refresh_token_malformed_uuid(async_client: AsyncClient) -> None:
    """Verify refresh endpoint returns 401 on non-UUID subject claim without crashing."""
    from datetime import timedelta

    from app.core.security import create_jwt_token

    malformed_token = create_jwt_token(
        claims={"sub": "not-a-valid-uuid", "email": "test@example.com", "role": "APPLICANT"},
        expires_delta=timedelta(days=1),
        token_type="refresh",
    )
    response = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": malformed_token},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_TOKEN_SUBJECT"


@pytest.mark.asyncio
async def test_rbac_loan_product_creation(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify RBAC defense: APPLICANT is forbidden from creating products, ADMIN succeeds."""
    # 1. Create an ADMIN user directly in DB
    admin_user = User(
        id=uuid.uuid4(),
        email="admin@test.com",
        password_hash=get_password_hash("AdminPass123!"),
        first_name="Admin",
        last_name="Superuser",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(admin_user)
    await db_session.commit()

    # 2. Register normal APPLICANT
    await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "applicant@test.com",
            "password": "ApplicantPass123!",
            "first_name": "Regular",
            "last_name": "Applicant",
        },
    )

    # Log in as Applicant
    app_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "applicant@test.com", "password": "ApplicantPass123!"},
    )
    applicant_token = app_login.json()["data"]["access_token"]

    # Log in as Admin
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "AdminPass123!"},
    )
    admin_token = admin_login.json()["data"]["access_token"]

    product_payload = {
        "code": "AUTO_DRIVE",
        "name": "Auto Loan Prime",
        "description": "Vehicle financing",
        "min_amount": 100000.00,
        "max_amount": 3000000.00,
        "min_tenor_months": 12,
        "max_tenor_months": 84,
        "base_apr": 9.50,
        "max_dti_ratio": 45.00,
        "required_documents": ["PAN_CARD", "SALARY_SLIP"],
        "is_active": True,
    }

    # Applicant attempt -> 403 Forbidden
    applicant_res = await async_client.post(
        "/api/v1/products",
        json=product_payload,
        headers={"Authorization": f"Bearer {applicant_token}"},
    )
    assert applicant_res.status_code == 403

    # Admin attempt -> 201 Created
    admin_res = await async_client.post(
        "/api/v1/products",
        json=product_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_res.status_code == 201
    prod_data = admin_res.json()["data"]
    assert prod_data["code"] == "AUTO_DRIVE"
    assert Decimal(str(prod_data["base_apr"])) == Decimal("9.50")

    # Public list endpoint
    list_res = await async_client.get("/api/v1/products")
    assert list_res.status_code == 200
    assert len(list_res.json()["data"]) >= 1

    # Inverted ranges: min_amount > max_amount -> 422
    bad_range_res = await async_client.post(
        "/api/v1/products",
        json={
            **product_payload,
            "code": "BAD_RANGE",
            "min_amount": 5000000.00,
            "max_amount": 100000.00,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert bad_range_res.status_code == 422


@pytest.mark.asyncio
async def test_seed_db_idempotency(db_session: AsyncSession) -> None:
    """Verify seed_data script runs without crashing."""
    # Seed once
    await seed_data(session=db_session)
    # Seed twice to confirm idempotency
    await seed_data(session=db_session)
