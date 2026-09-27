"""Security, RBAC, PII Sanitization, and IDOR Defense Test Suite."""

import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.sanitizer import (
    mask_aadhaar,
    mask_email,
    mask_pan,
    mask_phone,
    sanitize_pii_dict,
)
from app.core.security import create_access_token, get_password_hash
from app.models.application import ApplicationStatus, LoanApplication
from app.models.loan_product import LoanProduct
from app.models.user import User, UserRole


async def create_user(db: AsyncSession, role: UserRole, email: str) -> tuple[User, str]:
    """Helper to create user and JWT token."""
    user = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=get_password_hash("SecurityPass123!"),
        first_name="Sec",
        last_name=role.value,
        role=role,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_access_token(
        user_id=str(user.id),
        email=user.email,
        role=user.role.value,
    )
    return user, token


async def create_product(db: AsyncSession) -> LoanProduct:
    """Helper to create a standard loan product."""
    product = LoanProduct(
        id=uuid.uuid4(),
        code=f"SEC_{uuid.uuid4().hex[:6].upper()}",
        name="Security Test Loan",
        description="Loan product for security tests",
        min_amount=Decimal("10000.00"),
        max_amount=Decimal("1000000.00"),
        min_tenor_months=12,
        max_tenor_months=60,
        base_apr=Decimal("10.00"),
        max_dti_ratio=Decimal("45.00"),
        required_documents=["PAN_CARD"],
        is_active=True,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


def test_pii_masking_unit_helpers() -> None:
    """Verify regex and truncation masking across Indian financial identifiers."""
    # PAN masking
    assert mask_pan("ABCDE1234F") == "***-**-1234"
    assert mask_pan("abcde9999z") == "***-**-9999"
    assert mask_pan(None) is None
    assert mask_pan("12") == "***"

    # Aadhaar masking
    assert mask_aadhaar("123456789012") == "XXXX-XXXX-9012"
    assert mask_aadhaar("1234 5678 9012") == "XXXX-XXXX-9012"
    assert mask_aadhaar(None) is None

    # Phone masking
    assert mask_phone("+919876543210") == "*********3210"
    assert mask_phone("123") == "****"
    assert mask_phone(None) is None

    # Email masking
    assert mask_email("alex.taylor@example.com") == "a*********r@example.com"
    assert mask_email("a@b.com") == "a*@b.com"
    assert mask_email("invalid") is None

    # Recursive dictionary sanitization
    raw_payload = {
        "pan_number": "ABCDE1234F",
        "aadhaar": "987654321098",
        "auth_token": "secret_bearer_token",
        "nested": {
            "tax_id": "XYZAB9999K",
            "applicant_name": "Test User",
        },
        "safe_int": 42000,
    }
    sanitized = sanitize_pii_dict(raw_payload)
    assert sanitized["pan_number"] == "***-**-1234"
    assert sanitized["aadhaar"] == "XXXX-XXXX-1098"
    assert sanitized["auth_token"] == "[REDACTED]"
    assert sanitized["nested"]["tax_id"] == "***-**-9999"
    assert sanitized["nested"]["applicant_name"] == "Test User"
    assert sanitized["safe_int"] == 42000


@pytest.mark.asyncio
async def test_idor_defense_cross_applicant_isolation(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Ensure Applicant A cannot read, transition, or cancel Applicant B's application."""
    app_a, token_a = await create_user(db_session, UserRole.APPLICANT, "app_a@credvidhi.com")
    _, token_b = await create_user(db_session, UserRole.APPLICANT, "app_b@credvidhi.com")
    product = await create_product(db_session)

    # Applicant A creates an application
    application_b = LoanApplication(
        id=uuid.uuid4(),
        reference_number="CV-202609-TESTIDOR01",
        applicant_id=app_a.id,
        product_id=product.id,
        status=ApplicationStatus.DRAFT,
        requested_amount=Decimal("150000.00"),
        requested_tenor_months=24,
    )
    db_session.add(application_b)
    await db_session.commit()

    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Applicant B attempts to view Applicant A's application
    res_get = await async_client.get(f"/api/v1/applications/{application_b.id}", headers=headers_b)
    assert res_get.status_code == 403

    # Applicant B attempts to cancel Applicant A's application
    res_cancel = await async_client.post(
        f"/api/v1/applications/{application_b.id}/cancel",
        headers=headers_b,
        json={"reason": "Malicious attempt"},
    )
    assert res_cancel.status_code == 403

    # Applicant B attempts to update Applicant A's draft
    res_update = await async_client.put(
        f"/api/v1/applications/{application_b.id}/draft",
        headers=headers_b,
        json={"requested_amount": "200000.00"},
    )
    assert res_update.status_code == 403


@pytest.mark.asyncio
async def test_rbac_unauthorized_role_rejection(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify endpoint-level role barriers across modules."""
    _, applicant_token = await create_user(db_session, UserRole.APPLICANT, "role_app@credvidhi.com")
    headers = {"Authorization": f"Bearer {applicant_token}"}
    dummy_id = uuid.uuid4()

    # Applicant attempts to create loan product (Requires ADMIN)
    res1 = await async_client.post(
        "/api/v1/products",
        headers=headers,
        json={
            "code": "HACK_PROD",
            "name": "Hack",
            "min_amount": "1000.00",
            "max_amount": "100000.00",
            "min_tenor_months": 6,
            "max_tenor_months": 36,
            "base_apr": "5.00",
            "max_dti_ratio": "40.00",
            "required_documents": [],
        },
    )
    assert res1.status_code == 403

    # Applicant attempts to run risk evaluation (Requires RISK_ANALYST, ADMIN)
    res2 = await async_client.post(
        f"/api/v1/applications/{dummy_id}/evaluate",
        headers=headers,
    )
    assert res2.status_code == 403

    # Applicant attempts to record underwriting decision (Requires RISK_ANALYST, ADMIN)
    res3 = await async_client.post(
        f"/api/v1/applications/{dummy_id}/decision",
        headers=headers,
        json={
            "decision": "APPROVED",
            "approved_amount": "50000.00",
            "approved_apr": "10.00",
            "approved_tenor_months": 12,
            "underwriter_notes": "Self approved",
        },
    )
    assert res3.status_code == 403

    # Applicant attempts to verify document (Requires LOAN_OFFICER, ADMIN)
    res4 = await async_client.post(
        f"/api/v1/documents/{dummy_id}/verify",
        headers=headers,
        json={"status": "VERIFIED", "remarks": "Approved myself"},
    )
    assert res4.status_code == 403


@pytest.mark.asyncio
async def test_error_envelope_sanitization(async_client: AsyncClient) -> None:
    """Ensure standard 404/422/400 errors adhere to the API contract without leaking internals."""
    # 404 Not Found check
    res_404 = await async_client.get("/api/v1/nonexistent/route")
    assert res_404.status_code == 404
    body = res_404.json()
    assert body["success"] is False
    assert body["error"]["code"] == "HTTP_404"
    assert "data" not in body or body["data"] is None

    # 422 Unprocessable Content (validation failure)
    res_422 = await async_client.post("/api/v1/auth/login", json={"email": "bad"})
    assert res_422.status_code in [400, 422]
    body_422 = res_422.json()
    assert body_422["success"] is False
    assert "error" in body_422
    assert "code" in body_422["error"]
