"""Verification Suite for Financial Risk Engine and Underwriting Decisioning."""

import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.application import ApplicationStatus, LoanApplication
from app.models.audit_log import AuditLog
from app.models.loan_product import LoanProduct
from app.models.user import User, UserRole


async def create_product(
    db: AsyncSession, max_amount: Decimal = Decimal("10000000.00")
) -> LoanProduct:
    """Helper to create loan product."""
    product = LoanProduct(
        id=uuid.uuid4(),
        code=f"UW_PROD_{uuid.uuid4().hex[:6].upper()}",
        name="Underwriting Test Product",
        description="Product for testing underwriting rules",
        min_amount=Decimal("50000.00"),
        max_amount=max_amount,
        min_tenor_months=6,
        max_tenor_months=60,
        base_apr=Decimal("11.50"),
        max_dti_ratio=Decimal("50.00"),
        required_documents=["PAN_CARD", "PAYSLIP"],
        is_active=True,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


async def create_user(db: AsyncSession, role: UserRole, email: str) -> tuple[User, str]:
    """Helper to create user and JWT token."""
    user = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=get_password_hash("ValidPass123!"),
        first_name="Test",
        last_name=role.value,
        role=role,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_access_token(user_id=str(user.id), email=user.email, role=user.role.value)
    return user, token


async def setup_application_in_state(
    db: AsyncSession,
    applicant: User,
    product: LoanProduct,
    target_status: ApplicationStatus,
    amount: Decimal = Decimal("500000.00"),
    tenor: int = 24,
    gross_income: Decimal = Decimal("85000.00"),
    debts: Decimal = Decimal("10000.00"),
    bureau_score: int = 760,
) -> LoanApplication:
    """Helper to quickly seed application in a given lifecycle status."""
    app = LoanApplication(
        id=uuid.uuid4(),
        reference_number=f"CV-UW-{uuid.uuid4().hex[:8].upper()}",
        applicant_id=applicant.id,
        product_id=product.id,
        status=target_status,
        requested_amount=amount,
        requested_tenor_months=tenor,
        purpose="Business expansion",
        applicant_personal_snapshot={
            "full_name": "Applicant Test",
            "employment_type": "SALARIED",
            "experience_years": 4,
        },
        applicant_financial_snapshot={
            "gross_monthly_income": str(gross_income),
            "existing_monthly_debts": str(debts),
            "housing_expenses": "15000.00",
            "bureau_score": bureau_score,
        },
    )
    db.add(app)
    await db.commit()
    await db.refresh(app)
    return app


@pytest.mark.asyncio
async def test_risk_evaluation_happy_path(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify quantitative evaluation triggers FSM transition and computes valid risk output."""
    product = await create_product(db_session)
    applicant, _ = await create_user(db_session, UserRole.APPLICANT, "eval_app@test.com")
    analyst, analyst_token = await create_user(
        db_session, UserRole.RISK_ANALYST, "eval_analyst@test.com"
    )

    app = await setup_application_in_state(
        db_session,
        applicant,
        product,
        target_status=ApplicationStatus.DOCUMENTS_VERIFIED,
        amount=Decimal("500000.00"),
        tenor=24,
        gross_income=Decimal("100000.00"),
        debts=Decimal("10000.00"),
        bureau_score=780,
    )

    headers = {"Authorization": f"Bearer {analyst_token}"}
    eval_res = await async_client.post(
        f"/api/v1/applications/{app.id}/evaluate",
        headers=headers,
    )
    assert eval_res.status_code == 200
    res_data = eval_res.json()["data"]

    assert res_data["application_id"] == str(app.id)
    assert Decimal(str(res_data["calculated_emi"])) > Decimal("0")
    assert Decimal(str(res_data["calculated_dti"])) > Decimal("0")
    assert Decimal(str(res_data["disposable_income"])) > Decimal("0")
    assert res_data["risk_tier"] in ["LOW", "MEDIUM", "HIGH"]
    assert res_data["recommendation"] in ["APPROVE", "CONDITIONAL", "REJECT"]
    assert len(res_data["amortization_preview"]) == 24
    assert "factors" in res_data["score_factors_breakdown"]

    # Verify application status transitioned to RISK_ASSESSED in DB
    refreshed_stmt = (
        select(LoanApplication)
        .where(LoanApplication.id == app.id)
        .execution_options(populate_existing=True)
    )
    refreshed_app = (await db_session.execute(refreshed_stmt)).scalar_one()
    assert refreshed_app.status == ApplicationStatus.RISK_ASSESSED

    # Verify RISK_EVALUATED audit event
    audit_res = await db_session.execute(
        select(AuditLog).where(
            AuditLog.entity_id == app.id,
            AuditLog.event_type == "STATUS_TRANSITION_RISK_ASSESSED",
        )
    )
    assert audit_res.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_risk_evaluation_illegal_state_guard(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify application cannot be evaluated before documents are verified."""
    product = await create_product(db_session)
    applicant, _ = await create_user(db_session, UserRole.APPLICANT, "draft_eval@test.com")
    _, analyst_token = await create_user(
        db_session, UserRole.RISK_ANALYST, "draft_analyst@test.com"
    )

    app = await setup_application_in_state(
        db_session, applicant, product, target_status=ApplicationStatus.DRAFT
    )

    headers = {"Authorization": f"Bearer {analyst_token}"}
    eval_res = await async_client.post(
        f"/api/v1/applications/{app.id}/evaluate",
        headers=headers,
    )
    assert eval_res.status_code == 400
    assert eval_res.json()["error"]["code"] == "ILLEGAL_APPLICATION_STATE"


@pytest.mark.asyncio
async def test_underwriting_rbac_barriers(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify strict role-based access barriers on underwriting endpoints."""
    product = await create_product(db_session)
    applicant, app_token = await create_user(db_session, UserRole.APPLICANT, "rbac_app1@test.com")
    other_app, other_token = await create_user(db_session, UserRole.APPLICANT, "rbac_app2@test.com")
    officer, officer_token = await create_user(
        db_session, UserRole.LOAN_OFFICER, "rbac_off@test.com"
    )
    analyst, analyst_token = await create_user(
        db_session, UserRole.RISK_ANALYST, "rbac_uw@test.com"
    )

    app = await setup_application_in_state(
        db_session, applicant, product, target_status=ApplicationStatus.DOCUMENTS_VERIFIED
    )

    # 1. Applicant cannot evaluate
    res1 = await async_client.post(
        f"/api/v1/applications/{app.id}/evaluate",
        headers={"Authorization": f"Bearer {app_token}"},
    )
    assert res1.status_code == 403

    # 2. Loan officer cannot evaluate
    res2 = await async_client.post(
        f"/api/v1/applications/{app.id}/evaluate",
        headers={"Authorization": f"Bearer {officer_token}"},
    )
    assert res2.status_code == 403

    # 3. Analyst evaluates application -> RISK_ASSESSED
    eval_res = await async_client.post(
        f"/api/v1/applications/{app.id}/evaluate",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert eval_res.status_code == 200

    # 4. Other applicant cannot view assessment (IDOR guard)
    res_idor = await async_client.get(
        f"/api/v1/applications/{app.id}/assessment",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_idor.status_code == 403

    # 5. Application owner can view assessment
    res_owner = await async_client.get(
        f"/api/v1/applications/{app.id}/assessment",
        headers={"Authorization": f"Bearer {app_token}"},
    )
    assert res_owner.status_code == 200

    # 6. Officer cannot record formal decision
    res_dec_officer = await async_client.post(
        f"/api/v1/applications/{app.id}/decision",
        json={
            "decision": "APPROVED",
            "approved_amount": 500000.00,
            "approved_apr": 11.50,
            "approved_tenor_months": 24,
        },
        headers={"Authorization": f"Bearer {officer_token}"},
    )
    assert res_dec_officer.status_code == 403


@pytest.mark.asyncio
async def test_underwriting_decision_approved_and_rejected(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify underwriter formal approval and rejection workflows."""
    product = await create_product(db_session)
    applicant, _ = await create_user(db_session, UserRole.APPLICANT, "dec_app@test.com")
    analyst, analyst_token = await create_user(
        db_session, UserRole.RISK_ANALYST, "dec_analyst@test.com"
    )
    headers = {"Authorization": f"Bearer {analyst_token}"}

    # Case A: Approval
    app_to_approve = await setup_application_in_state(
        db_session, applicant, product, target_status=ApplicationStatus.RISK_ASSESSED
    )
    approve_res = await async_client.post(
        f"/api/v1/applications/{app_to_approve.id}/decision",
        json={
            "decision": "APPROVED",
            "approved_amount": 450000.00,
            "approved_apr": 11.00,
            "approved_tenor_months": 24,
            "underwriter_notes": "Prime credit profile, approved with preferential APR.",
        },
        headers=headers,
    )
    assert approve_res.status_code == 200
    approve_data = approve_res.json()["data"]
    assert approve_data["decision"] == "APPROVED"
    assert Decimal(str(approve_data["approved_amount"])) == Decimal("450000.00")

    # Verify status in DB
    refreshed_app_stmt = (
        select(LoanApplication)
        .where(LoanApplication.id == app_to_approve.id)
        .execution_options(populate_existing=True)
    )
    refreshed_approved = (await db_session.execute(refreshed_app_stmt)).scalar_one()
    assert refreshed_approved.status == ApplicationStatus.APPROVED

    # Case B: Rejection
    app_to_reject = await setup_application_in_state(
        db_session, applicant, product, target_status=ApplicationStatus.RISK_ASSESSED
    )
    reject_res = await async_client.post(
        f"/api/v1/applications/{app_to_reject.id}/decision",
        json={
            "decision": "REJECTED",
            "rejection_reason_code": "HIGH_DTI_EXCEEDED",
            "underwriter_notes": "Existing debt burden exceeds institutional risk threshold.",
        },
        headers=headers,
    )
    assert reject_res.status_code == 200
    reject_data = reject_res.json()["data"]
    assert reject_data["decision"] == "REJECTED"
    assert reject_data["rejection_reason_code"] == "HIGH_DTI_EXCEEDED"

    # Verify status in DB
    refreshed_rej_stmt = (
        select(LoanApplication)
        .where(LoanApplication.id == app_to_reject.id)
        .execution_options(populate_existing=True)
    )
    refreshed_rejected = (await db_session.execute(refreshed_rej_stmt)).scalar_one()
    assert refreshed_rejected.status == ApplicationStatus.REJECTED


@pytest.mark.asyncio
async def test_underwriting_validation_and_escalation(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify input validation, bounds checks, and high-value supervisor escalation."""
    product = await create_product(db_session, max_amount=Decimal("10000000.00"))
    applicant, _ = await create_user(db_session, UserRole.APPLICANT, "val_app@test.com")
    analyst, analyst_token = await create_user(
        db_session, UserRole.RISK_ANALYST, "val_analyst@test.com"
    )
    admin, admin_token = await create_user(db_session, UserRole.ADMIN, "val_admin@test.com")

    analyst_headers = {"Authorization": f"Bearer {analyst_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    app = await setup_application_in_state(
        db_session,
        applicant,
        product,
        target_status=ApplicationStatus.RISK_ASSESSED,
        amount=Decimal("6000000.00"),
    )

    # 1. Validation error: Approval missing required parameters
    res_missing = await async_client.post(
        f"/api/v1/applications/{app.id}/decision",
        json={"decision": "APPROVED"},
        headers=analyst_headers,
    )
    assert res_missing.status_code == 422

    # 2. Validation error: Rejection missing reason code
    res_no_reason = await async_client.post(
        f"/api/v1/applications/{app.id}/decision",
        json={"decision": "REJECTED", "underwriter_notes": "Test notes"},
        headers=analyst_headers,
    )
    assert res_no_reason.status_code == 422

    # 3. Product terms bound violation: Amount > product.max_amount (10,000,000)
    res_bounds = await async_client.post(
        f"/api/v1/applications/{app.id}/decision",
        json={
            "decision": "APPROVED",
            "approved_amount": 15000000.00,
            "approved_apr": 11.50,
            "approved_tenor_months": 24,
        },
        headers=analyst_headers,
    )
    assert res_bounds.status_code == 400
    assert res_bounds.json()["error"]["code"] == "INVALID_OFFER_TERMS"

    # 4. Supervisor escalation: Loan > 5,000,000 rejected without supervisor note or admin role
    res_escalation = await async_client.post(
        f"/api/v1/applications/{app.id}/decision",
        json={
            "decision": "APPROVED",
            "approved_amount": 6000000.00,
            "approved_apr": 11.50,
            "approved_tenor_months": 36,
            "underwriter_notes": "Standard approval without supervisor note",
        },
        headers=analyst_headers,
    )
    assert res_escalation.status_code == 403
    assert res_escalation.json()["error"]["code"] == "SUPERVISOR_ESCALATION_REQUIRED"

    # 5. Supervisor escalation: Admin can approve high-value loan
    res_admin_ok = await async_client.post(
        f"/api/v1/applications/{app.id}/decision",
        json={
            "decision": "APPROVED",
            "approved_amount": 6000000.00,
            "approved_apr": 11.50,
            "approved_tenor_months": 36,
            "underwriter_notes": "Executive committee authorization granted.",
        },
        headers=admin_headers,
    )
    assert res_admin_ok.status_code == 200
    assert res_admin_ok.json()["data"]["decision"] == "APPROVED"
