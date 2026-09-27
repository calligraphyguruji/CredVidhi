"""Verification Suite for Immutable Audit Ledger & Administrative Query API."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.user import User, UserRole
from app.services.audit_service import record_audit_event


async def create_user(db: AsyncSession, role: UserRole, email: str) -> tuple[User, str]:
    """Helper to create user and JWT token."""
    user = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=get_password_hash("AuditTestPass123!"),
        first_name="Audit",
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


@pytest.mark.asyncio
async def test_record_and_query_audit_logs(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify recording compliance events and querying via administrative endpoint."""
    admin_user, admin_token = await create_user(
        db_session, UserRole.ADMIN, "audit_admin@credvidhi.com"
    )
    officer_user, _ = await create_user(
        db_session, UserRole.LOAN_OFFICER, "audit_officer@credvidhi.com"
    )

    app_id = uuid.uuid4()

    # Record 3 distinct audit events
    await record_audit_event(
        session=db_session,
        event_type="APPLICATION_SUBMITTED",
        entity_name="loan_applications",
        entity_id=app_id,
        actor_id=admin_user.id,
        actor_role=admin_user.role.value,
        ip_address="192.168.1.100",
        user_agent="Mozilla/5.0 Test Client",
        subsequent_state={"status": "SUBMITTED"},
    )
    await record_audit_event(
        session=db_session,
        event_type="DOCUMENT_VERIFIED",
        entity_name="loan_applications",
        entity_id=app_id,
        actor_id=officer_user.id,
        actor_role=officer_user.role.value,
        ip_address="192.168.1.101",
        metadata_snapshot={"document_type": "PAN_CARD"},
    )
    await record_audit_event(
        session=db_session,
        event_type="RISK_ASSESSED",
        entity_name="loan_applications",
        entity_id=app_id,
        actor_id=admin_user.id,
        actor_role=admin_user.role.value,
        prior_state={"status": "DOCUMENTS_VERIFIED"},
        subsequent_state={"status": "RISK_ASSESSED"},
    )
    await db_session.commit()

    # Admin queries audit logs
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = await async_client.get("/api/v1/audit/logs", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["total"] >= 3
    assert len(body["data"]["items"]) >= 3

    # Check structure of the top item
    item = body["data"]["items"][0]
    assert "id" in item
    assert "event_type" in item
    assert "entity_name" in item
    assert "created_at" in item


@pytest.mark.asyncio
async def test_audit_log_filtering(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Verify multi-criteria filtering by entity_id, actor_id, event_type, and dates."""
    _, admin_token = await create_user(db_session, UserRole.ADMIN, "filter_admin@credvidhi.com")
    officer1, _ = await create_user(db_session, UserRole.LOAN_OFFICER, "filter_off1@credvidhi.com")
    officer2, _ = await create_user(db_session, UserRole.LOAN_OFFICER, "filter_off2@credvidhi.com")

    app1 = uuid.uuid4()
    app2 = uuid.uuid4()

    await record_audit_event(
        session=db_session,
        event_type="KYC_CHECK",
        entity_name="loan_applications",
        entity_id=app1,
        actor_id=officer1.id,
        actor_role="LOAN_OFFICER",
    )
    await record_audit_event(
        session=db_session,
        event_type="CREDIT_PULL",
        entity_name="loan_applications",
        entity_id=app1,
        actor_id=officer2.id,
        actor_role="LOAN_OFFICER",
    )
    await record_audit_event(
        session=db_session,
        event_type="KYC_CHECK",
        entity_name="loan_applications",
        entity_id=app2,
        actor_id=officer1.id,
        actor_role="LOAN_OFFICER",
    )
    await db_session.commit()

    headers = {"Authorization": f"Bearer {admin_token}"}

    # Filter by entity_id
    res1 = await async_client.get(f"/api/v1/audit/logs?entity_id={app1}", headers=headers)
    assert res1.status_code == 200
    assert res1.json()["data"]["total"] == 2

    # Filter by actor_id
    res2 = await async_client.get(f"/api/v1/audit/logs?actor_id={officer2.id}", headers=headers)
    assert res2.status_code == 200
    assert res2.json()["data"]["total"] == 1
    assert res2.json()["data"]["items"][0]["event_type"] == "CREDIT_PULL"

    # Filter by event_type
    res3 = await async_client.get("/api/v1/audit/logs?event_type=KYC_CHECK", headers=headers)
    assert res3.status_code == 200
    assert res3.json()["data"]["total"] == 2

    # Filter by date window
    now = datetime.now(timezone.utc)
    res4 = await async_client.get(
        "/api/v1/audit/logs",
        headers=headers,
        params={
            "start_date": (now - timedelta(hours=1)).isoformat(),
            "end_date": (now + timedelta(hours=1)).isoformat(),
        },
    )
    assert res4.status_code == 200
    assert res4.json()["data"]["total"] >= 3


@pytest.mark.asyncio
async def test_audit_rbac_protection(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Verify RBAC guards restrict audit querying to ADMIN and OPERATIONS only."""
    _, admin_token = await create_user(db_session, UserRole.ADMIN, "rbac_admin@credvidhi.com")
    _, ops_token = await create_user(db_session, UserRole.OPERATIONS, "rbac_ops@credvidhi.com")
    _, officer_token = await create_user(
        db_session, UserRole.LOAN_OFFICER, "rbac_officer@credvidhi.com"
    )
    _, applicant_token = await create_user(db_session, UserRole.APPLICANT, "rbac_app@credvidhi.com")

    # ADMIN: Allowed (200)
    res_admin = await async_client.get(
        "/api/v1/audit/logs", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_admin.status_code == 200

    # OPERATIONS: Allowed (200)
    res_ops = await async_client.get(
        "/api/v1/audit/logs", headers={"Authorization": f"Bearer {ops_token}"}
    )
    assert res_ops.status_code == 200

    # LOAN_OFFICER: Forbidden (403)
    res_off = await async_client.get(
        "/api/v1/audit/logs", headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert res_off.status_code == 403

    # APPLICANT: Forbidden (403)
    res_app = await async_client.get(
        "/api/v1/audit/logs", headers={"Authorization": f"Bearer {applicant_token}"}
    )
    assert res_app.status_code == 403

    # Unauthenticated: Unauthorized (401)
    res_anon = await async_client.get("/api/v1/audit/logs")
    assert res_anon.status_code == 401


@pytest.mark.asyncio
async def test_audit_immutability_guarantee(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Ensure no mutation endpoints (POST/PUT/DELETE) exist for audit logs."""
    _, admin_token = await create_user(db_session, UserRole.ADMIN, "immu_admin@credvidhi.com")
    headers = {"Authorization": f"Bearer {admin_token}"}

    dummy_id = uuid.uuid4()

    # Attempt POST (creation via endpoint is banned)
    res_post = await async_client.post("/api/v1/audit/logs", headers=headers, json={})
    assert res_post.status_code in [404, 405]

    # Attempt PUT (modification is banned)
    res_put = await async_client.put(f"/api/v1/audit/logs/{dummy_id}", headers=headers, json={})
    assert res_put.status_code in [404, 405]

    # Attempt DELETE (deletion is banned)
    res_del = await async_client.delete(f"/api/v1/audit/logs/{dummy_id}", headers=headers)
    assert res_del.status_code in [404, 405]
