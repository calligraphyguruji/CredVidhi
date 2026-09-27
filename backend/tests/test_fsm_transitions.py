"""Comprehensive Verification Suite for Loan Lifecycle FSM and Queue Segregation."""

import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.audit_log import AuditLog
from app.models.loan_product import LoanProduct
from app.models.user import User, UserRole


async def create_test_product(db_session: AsyncSession) -> LoanProduct:
    """Helper to create active test loan product."""
    product = LoanProduct(
        id=uuid.uuid4(),
        code=f"TEST_PROD_{uuid.uuid4().hex[:6].upper()}",
        name="Test Loan Product",
        description="Testing product",
        min_amount=Decimal("50000.00"),
        max_amount=Decimal("2000000.00"),
        min_tenor_months=6,
        max_tenor_months=60,
        base_apr=Decimal("10.50"),
        max_dti_ratio=Decimal("45.00"),
        required_documents=["PAN_CARD", "SALARY_SLIP"],
        is_active=True,
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product


async def create_user_with_role(
    db_session: AsyncSession, role: UserRole, email: str
) -> tuple[User, str]:
    """Helper to create user and access token."""
    user = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=get_password_hash("Password123!"),
        first_name="Test",
        last_name=role.value,
        role=role,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token = create_access_token(user_id=str(user.id), email=user.email, role=user.role.value)
    return user, token


@pytest.mark.asyncio
async def test_full_happy_path_fsm_lifecycle(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify standard happy path progression from DRAFT to DISBURSED with audit logs."""
    # 1. Setup actors & product
    product = await create_test_product(db_session)
    applicant, app_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "happy_applicant@test.com"
    )
    officer, officer_token = await create_user_with_role(
        db_session, UserRole.LOAN_OFFICER, "happy_officer@test.com"
    )
    underwriter, uw_token = await create_user_with_role(
        db_session, UserRole.RISK_ANALYST, "happy_uw@test.com"
    )
    ops_user, ops_token = await create_user_with_role(
        db_session, UserRole.OPERATIONS, "happy_ops@test.com"
    )

    app_headers = {"Authorization": f"Bearer {app_token}"}
    officer_headers = {"Authorization": f"Bearer {officer_token}"}
    uw_headers = {"Authorization": f"Bearer {uw_token}"}
    ops_headers = {"Authorization": f"Bearer {ops_token}"}

    # 2. Applicant creates DRAFT
    create_res = await async_client.post(
        "/api/v1/applications",
        json={
            "product_id": str(product.id),
            "requested_amount": 500000.00,
            "requested_tenor_months": 24,
            "purpose": "Home renovation and interior design",
        },
        headers=app_headers,
    )
    assert create_res.status_code == 201
    app_data = create_res.json()["data"]
    app_id = app_data["id"]
    assert app_data["status"] == "DRAFT"
    assert app_data["reference_number"].startswith("DRAFT-")

    # 3. Applicant submits application -> SUBMITTED
    submit_res = await async_client.post(
        f"/api/v1/applications/{app_id}/submit",
        headers=app_headers,
    )
    assert submit_res.status_code == 200
    submitted_data = submit_res.json()["data"]
    assert submitted_data["status"] == "SUBMITTED"
    assert submitted_data["reference_number"].startswith("CV-")
    assert submitted_data["submitted_at"] is not None

    # 4. Officer picks up application -> UNDER_REVIEW
    t1_res = await async_client.post(
        f"/api/v1/applications/{app_id}/transition",
        json={"target_status": "UNDER_REVIEW", "reason": "Officer started document audit"},
        headers=officer_headers,
    )
    assert t1_res.status_code == 200
    assert t1_res.json()["data"]["status"] == "UNDER_REVIEW"

    # 5. Officer marks documents verified -> DOCUMENTS_VERIFIED
    t2_res = await async_client.post(
        f"/api/v1/applications/{app_id}/transition",
        json={"target_status": "DOCUMENTS_VERIFIED", "reason": "All KYC verified"},
        headers=officer_headers,
    )
    assert t2_res.status_code == 200
    assert t2_res.json()["data"]["status"] == "DOCUMENTS_VERIFIED"

    # 6. Underwriter completes quantitative analysis -> RISK_ASSESSED
    t3_res = await async_client.post(
        f"/api/v1/applications/{app_id}/transition",
        json={"target_status": "RISK_ASSESSED", "reason": "DTI 32% verified"},
        headers=uw_headers,
    )
    assert t3_res.status_code == 200
    assert t3_res.json()["data"]["status"] == "RISK_ASSESSED"

    # 7. Underwriter approves application -> APPROVED
    t4_res = await async_client.post(
        f"/api/v1/applications/{app_id}/transition",
        json={"target_status": "APPROVED", "reason": "Credit score 780, approved"},
        headers=uw_headers,
    )
    assert t4_res.status_code == 200
    assert t4_res.json()["data"]["status"] == "APPROVED"

    # 8. Operations disburses loan -> DISBURSED
    t5_res = await async_client.post(
        f"/api/v1/applications/{app_id}/transition",
        json={"target_status": "DISBURSED", "reason": "UTR NEFT-202609-881920"},
        headers=ops_headers,
    )
    assert t5_res.status_code == 200
    assert t5_res.json()["data"]["status"] == "DISBURSED"

    # 9. Verify AuditLog entries generated
    audit_res = await db_session.execute(
        select(AuditLog).where(AuditLog.entity_id == uuid.UUID(app_id))
    )
    logs = audit_res.scalars().all()
    assert len(logs) >= 5
    event_types = [log.event_type for log in logs]
    assert "STATUS_TRANSITION_SUBMITTED" in event_types
    assert "STATUS_TRANSITION_UNDER_REVIEW" in event_types
    assert "STATUS_TRANSITION_DOCUMENTS_VERIFIED" in event_types
    assert "STATUS_TRANSITION_RISK_ASSESSED" in event_types
    assert "STATUS_TRANSITION_APPROVED" in event_types
    assert "STATUS_TRANSITION_DISBURSED" in event_types


@pytest.mark.asyncio
async def test_illegal_state_transition_jumps_rejected(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify illegal status transitions fail with HTTP 400 ILLEGAL_STATE_TRANSITION."""
    product = await create_test_product(db_session)
    applicant, app_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "jump_applicant@test.com"
    )
    admin_user, admin_token = await create_user_with_role(
        db_session, UserRole.ADMIN, "jump_admin@test.com"
    )

    app_headers = {"Authorization": f"Bearer {app_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create DRAFT
    create_res = await async_client.post(
        "/api/v1/applications",
        json={
            "product_id": str(product.id),
            "requested_amount": 100000.0,
            "requested_tenor_months": 12,
        },
        headers=app_headers,
    )
    app_id = create_res.json()["data"]["id"]

    # Attempt illegal jump: DRAFT -> APPROVED
    bad_jump = await async_client.post(
        f"/api/v1/applications/{app_id}/transition",
        json={"target_status": "APPROVED"},
        headers=admin_headers,
    )
    assert bad_jump.status_code == 400
    payload = bad_jump.json()
    assert payload["success"] is False
    assert payload["error"]["code"] == "ILLEGAL_STATE_TRANSITION"

    # Attempt illegal jump: DRAFT -> DISBURSED
    bad_jump2 = await async_client.post(
        f"/api/v1/applications/{app_id}/transition",
        json={"target_status": "DISBURSED"},
        headers=admin_headers,
    )
    assert bad_jump2.status_code == 400
    assert bad_jump2.json()["error"]["code"] == "ILLEGAL_STATE_TRANSITION"


@pytest.mark.asyncio
async def test_role_authorization_barriers(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify that unauthorized roles cannot trigger protected transitions."""
    product = await create_test_product(db_session)
    applicant, app_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "barrier_app@test.com"
    )
    officer, officer_token = await create_user_with_role(
        db_session, UserRole.LOAN_OFFICER, "barrier_officer@test.com"
    )

    app_headers = {"Authorization": f"Bearer {app_token}"}
    officer_headers = {"Authorization": f"Bearer {officer_token}"}

    create_res = await async_client.post(
        "/api/v1/applications",
        json={
            "product_id": str(product.id),
            "requested_amount": 100000.0,
            "requested_tenor_months": 12,
        },
        headers=app_headers,
    )
    app_id = create_res.json()["data"]["id"]

    # Submit
    await async_client.post(f"/api/v1/applications/{app_id}/submit", headers=app_headers)

    # Loan officer moves to UNDER_REVIEW
    await async_client.post(
        f"/api/v1/applications/{app_id}/transition",
        json={"target_status": "UNDER_REVIEW"},
        headers=officer_headers,
    )

    # Loan officer tries to directly APPROVE -> should fail (only RISK_ANALYST or ADMIN can approve)
    officer_bad_approve = await async_client.post(
        f"/api/v1/applications/{app_id}/transition",
        json={"target_status": "APPROVED"},
        headers=officer_headers,
    )
    assert officer_bad_approve.status_code == 400
    assert officer_bad_approve.json()["error"]["code"] == "ILLEGAL_STATE_TRANSITION"


@pytest.mark.asyncio
async def test_queue_segregation_and_rbac(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify role-specific queue filtering and access control."""
    product = await create_test_product(db_session)
    applicant1, app1_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "q_app1@test.com"
    )
    applicant2, app2_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "q_app2@test.com"
    )
    officer, officer_token = await create_user_with_role(
        db_session, UserRole.LOAN_OFFICER, "q_officer@test.com"
    )

    app1_headers = {"Authorization": f"Bearer {app1_token}"}
    app2_headers = {"Authorization": f"Bearer {app2_token}"}
    officer_headers = {"Authorization": f"Bearer {officer_token}"}

    # App1 creates application
    res1 = await async_client.post(
        "/api/v1/applications",
        json={
            "product_id": str(product.id),
            "requested_amount": 100000.0,
            "requested_tenor_months": 12,
        },
        headers=app1_headers,
    )
    app1_id = res1.json()["data"]["id"]

    # Applicant 1 sees their application
    q1 = await async_client.get("/api/v1/queues/applicant", headers=app1_headers)
    assert q1.status_code == 200
    ids1 = [item["id"] for item in q1.json()["data"]]
    assert app1_id in ids1

    # Applicant 2 does NOT see Applicant 1's application in their queue
    q2 = await async_client.get("/api/v1/queues/applicant", headers=app2_headers)
    assert q2.status_code == 200
    ids2 = [item["id"] for item in q2.json()["data"]]
    assert app1_id not in ids2

    # Applicant 2 cannot view Applicant 1's application detail directly (403 Forbidden)
    forbidden_view = await async_client.get(f"/api/v1/applications/{app1_id}", headers=app2_headers)
    assert forbidden_view.status_code == 403

    # Applicant cannot access officer queue (403 Forbidden)
    forbidden_queue = await async_client.get("/api/v1/queues/officer", headers=app1_headers)
    assert forbidden_queue.status_code == 403

    # Officer can access officer queue
    officer_q = await async_client.get("/api/v1/queues/officer", headers=officer_headers)
    assert officer_q.status_code == 200


@pytest.mark.asyncio
async def test_rejection_requires_mandatory_reason(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify that rejecting an application strictly requires a non-empty reason."""
    product = await create_test_product(db_session)
    applicant, app_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "reason_app@test.com"
    )
    officer, officer_token = await create_user_with_role(
        db_session, UserRole.LOAN_OFFICER, "reason_off@test.com"
    )

    app_headers = {"Authorization": f"Bearer {app_token}"}
    officer_headers = {"Authorization": f"Bearer {officer_token}"}

    create_res = await async_client.post(
        "/api/v1/applications",
        json={
            "product_id": str(product.id),
            "requested_amount": 100000.0,
            "requested_tenor_months": 12,
        },
        headers=app_headers,
    )
    app_id = create_res.json()["data"]["id"]
    await async_client.post(f"/api/v1/applications/{app_id}/submit", headers=app_headers)

    # Officer attempts to reject WITHOUT a reason
    bad_reject = await async_client.post(
        f"/api/v1/applications/{app_id}/transition",
        json={"target_status": "REJECTED", "reason": ""},
        headers=officer_headers,
    )
    assert bad_reject.status_code == 400
    assert bad_reject.json()["error"]["code"] == "ILLEGAL_STATE_TRANSITION"
    assert "mandatory" in bad_reject.json()["error"]["message"].lower()

    # Officer rejects WITH valid reason
    good_reject = await async_client.post(
        f"/api/v1/applications/{app_id}/transition",
        json={
            "target_status": "REJECTED",
            "reason": "Applicant credit score below institutional threshold",
        },
        headers=officer_headers,
    )
    assert good_reject.status_code == 200
    assert good_reject.json()["data"]["status"] == "REJECTED"


@pytest.mark.asyncio
async def test_applicant_can_cancel_active_applications(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify borrower can cancel application in SUBMITTED and UNDER_REVIEW statuses."""
    product = await create_test_product(db_session)
    applicant, app_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "cancel_app@test.com"
    )
    officer, officer_token = await create_user_with_role(
        db_session, UserRole.LOAN_OFFICER, "cancel_off@test.com"
    )

    app_headers = {"Authorization": f"Bearer {app_token}"}
    officer_headers = {"Authorization": f"Bearer {officer_token}"}

    # Case 1: Cancel from SUBMITTED via /cancel endpoint
    res1 = await async_client.post(
        "/api/v1/applications",
        json={
            "product_id": str(product.id),
            "requested_amount": 100000.0,
            "requested_tenor_months": 12,
        },
        headers=app_headers,
    )
    app1_id = res1.json()["data"]["id"]
    await async_client.post(f"/api/v1/applications/{app1_id}/submit", headers=app_headers)

    cancel1 = await async_client.post(
        f"/api/v1/applications/{app1_id}/cancel",
        params={"reason": "Decided not to proceed with loan"},
        headers=app_headers,
    )
    assert cancel1.status_code == 200
    assert cancel1.json()["data"]["status"] == "REJECTED"

    # Case 2: Cancel from UNDER_REVIEW via /cancel endpoint
    res2 = await async_client.post(
        "/api/v1/applications",
        json={
            "product_id": str(product.id),
            "requested_amount": 150000.0,
            "requested_tenor_months": 18,
        },
        headers=app_headers,
    )
    app2_id = res2.json()["data"]["id"]
    await async_client.post(f"/api/v1/applications/{app2_id}/submit", headers=app_headers)
    await async_client.post(
        f"/api/v1/applications/{app2_id}/transition",
        json={"target_status": "UNDER_REVIEW"},
        headers=officer_headers,
    )

    cancel2 = await async_client.post(
        f"/api/v1/applications/{app2_id}/cancel",
        headers=app_headers,
    )
    assert cancel2.status_code == 200
    assert cancel2.json()["data"]["status"] == "REJECTED"


@pytest.mark.asyncio
async def test_applicant_idor_transition_forbidden(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify an applicant cannot trigger transitions on another user's application."""
    product = await create_test_product(db_session)
    victim, victim_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "victim@test.com"
    )
    attacker, attacker_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "attacker@test.com"
    )

    victim_headers = {"Authorization": f"Bearer {victim_token}"}
    attacker_headers = {"Authorization": f"Bearer {attacker_token}"}

    create_res = await async_client.post(
        "/api/v1/applications",
        json={
            "product_id": str(product.id),
            "requested_amount": 100000.0,
            "requested_tenor_months": 12,
        },
        headers=victim_headers,
    )
    victim_app_id = create_res.json()["data"]["id"]

    # Attacker tries to transition victim's draft
    idor_res = await async_client.post(
        f"/api/v1/applications/{victim_app_id}/transition",
        json={"target_status": "SUBMITTED"},
        headers=attacker_headers,
    )
    assert idor_res.status_code == 403
    assert idor_res.json()["error"]["code"] == "ACCESS_FORBIDDEN"


@pytest.mark.asyncio
async def test_update_draft_bounds_and_pagination(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify draft financial bounds validation and queue pagination."""
    product = await create_test_product(db_session)  # min 50k, max 2M, tenor 6-60
    applicant, app_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "draft_bounds@test.com"
    )
    headers = {"Authorization": f"Bearer {app_token}"}

    create_res = await async_client.post(
        "/api/v1/applications",
        json={
            "product_id": str(product.id),
            "requested_amount": 100000.0,
            "requested_tenor_months": 12,
        },
        headers=headers,
    )
    app_id = create_res.json()["data"]["id"]

    # Update draft with amount exceeding max limit
    bad_amount = await async_client.put(
        f"/api/v1/applications/{app_id}/draft",
        json={"requested_amount": 5000000.0},  # Exceeds 2M
        headers=headers,
    )
    assert bad_amount.status_code == 422
    assert bad_amount.json()["error"]["code"] == "INVALID_AMOUNT"

    # Update draft with tenor exceeding max limit
    bad_tenor = await async_client.put(
        f"/api/v1/applications/{app_id}/draft",
        json={"requested_tenor_months": 120},  # Exceeds 60
        headers=headers,
    )
    assert bad_tenor.status_code == 422
    assert bad_tenor.json()["error"]["code"] == "INVALID_TENOR"

    # Valid update
    good_update = await async_client.put(
        f"/api/v1/applications/{app_id}/draft",
        json={
            "requested_amount": 200000.0,
            "requested_tenor_months": 36,
            "purpose": "Updated valid purpose",
        },
        headers=headers,
    )
    assert good_update.status_code == 200
    assert Decimal(str(good_update.json()["data"]["requested_amount"])) == Decimal("200000.00")

    # Queue pagination check
    q_paginated = await async_client.get(
        "/api/v1/queues/applicant",
        params={"limit": 1, "offset": 0},
        headers=headers,
    )
    assert q_paginated.status_code == 200
    assert len(q_paginated.json()["data"]) <= 1
