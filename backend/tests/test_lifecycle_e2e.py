"""End-to-End Multi-Persona Loan Origination Lifecycle Integration Test."""

import io
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import ApplicationStatus
from app.models.user import UserRole
from tests.test_security_rbac import create_product, create_user


@pytest.mark.asyncio
async def test_full_origination_lifecycle_e2e(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Execute the complete multi-persona loan origination lifecycle from intake to disbursement."""
    # 0. Setup Personas & Product
    product = await create_product(db_session)
    _, officer_token = await create_user(
        db_session, UserRole.LOAN_OFFICER, "e2e_officer@credvidhi.com"
    )
    _, analyst_token = await create_user(
        db_session, UserRole.RISK_ANALYST, "e2e_analyst@credvidhi.com"
    )
    _, ops_token = await create_user(db_session, UserRole.OPERATIONS, "e2e_ops@credvidhi.com")
    _, admin_token = await create_user(db_session, UserRole.ADMIN, "e2e_admin@credvidhi.com")

    officer_headers = {"Authorization": f"Bearer {officer_token}"}
    analyst_headers = {"Authorization": f"Bearer {analyst_token}"}
    ops_headers = {"Authorization": f"Bearer {ops_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Step 1: Applicant Registration
    reg_payload = {
        "email": "e2e_borrower@gmail.com",
        "password": "BorrowerPass123!",
        "first_name": "Jordan",
        "last_name": "Miller",
        "phone": "+919876543210",
        "pan_number": "ABCDE1234F",
    }
    reg_res = await async_client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": reg_payload["email"], "password": reg_payload["password"]},
    )
    assert login_res.status_code == 200
    applicant_token = login_res.json()["data"]["access_token"]
    applicant_headers = {"Authorization": f"Bearer {applicant_token}"}

    # Step 2: Fetch Products & Create Draft
    draft_res = await async_client.post(
        "/api/v1/applications",
        headers=applicant_headers,
        json={
            "product_id": str(product.id),
            "requested_amount": "250000.00",
            "requested_tenor_months": 24,
            "purpose": "Home Improvement and Modernization",
        },
    )
    assert draft_res.status_code == 201
    app_id = draft_res.json()["data"]["id"]
    assert draft_res.json()["data"]["status"] == ApplicationStatus.DRAFT.value

    # Step 3: Populate Snapshots and Submit Application
    update_res = await async_client.put(
        f"/api/v1/applications/{app_id}/draft",
        headers=applicant_headers,
        json={
            "applicant_personal_snapshot": {
                "full_name": "Jordan Miller",
                "residential_address": "742 Evergreen Terrace, Mumbai",
                "pan": "ABCDE1234F",
            },
            "applicant_financial_snapshot": {
                "gross_monthly_income": "95000.00",
                "existing_monthly_debt": "15000.00",
                "housing_expense": "20000.00",
                "credit_score_declared": 780,
                "years_employed": 5,
            },
        },
    )
    assert update_res.status_code == 200

    submit_res = await async_client.post(
        f"/api/v1/applications/{app_id}/submit",
        headers=applicant_headers,
    )
    assert submit_res.status_code == 200
    assert submit_res.json()["data"]["status"] == ApplicationStatus.SUBMITTED.value
    assert submit_res.json()["data"]["reference_number"].startswith("CV-")

    # Step 4: Loan Officer inspects Queue & Transitions to UNDER_REVIEW
    queue_res = await async_client.get("/api/v1/queues/officer", headers=officer_headers)
    assert queue_res.status_code == 200
    officer_queue_apps = [item["id"] for item in queue_res.json()["data"]]
    assert str(app_id) in officer_queue_apps

    trans_res = await async_client.post(
        f"/api/v1/applications/{app_id}/transition",
        headers=officer_headers,
        json={"target_status": "UNDER_REVIEW", "notes": "Initiating document verification."},
    )
    assert trans_res.status_code == 200
    assert trans_res.json()["data"]["status"] == ApplicationStatus.UNDER_REVIEW.value

    # Step 5: Applicant Uploads Required Document (Multipart with PDF header)
    pdf_content = b"%PDF-1.4 Mock verification document payload for KYC checklist."
    files = {"file": ("pan_card.pdf", io.BytesIO(pdf_content), "application/pdf")}
    upload_res = await async_client.post(
        f"/api/v1/applications/{app_id}/documents/upload",
        headers=applicant_headers,
        data={"document_type": "PAN_CARD"},
        files=files,
    )
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["data"]["id"]

    # Step 6: Loan Officer Verifies Document
    verify_res = await async_client.post(
        f"/api/v1/documents/{doc_id}/verify",
        headers=officer_headers,
        json={
            "verification_status": "VERIFIED",
            "verification_remarks": "PAN card verified against identity records.",
        },
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["data"]["verification_status"] == "VERIFIED"

    # Step 7: Application auto-advances to DOCUMENTS_VERIFIED
    app_details = await async_client.get(f"/api/v1/applications/{app_id}", headers=officer_headers)
    assert app_details.status_code == 200
    assert app_details.json()["data"]["status"] == ApplicationStatus.DOCUMENTS_VERIFIED.value

    # Step 8: Risk Analyst Evaluates Financial Metrics & Scorecard
    eval_res = await async_client.post(
        f"/api/v1/applications/{app_id}/evaluate",
        headers=analyst_headers,
    )
    assert eval_res.status_code == 200
    eval_data = eval_res.json()["data"]
    assert eval_data["risk_tier"] in ["LOW", "MEDIUM", "HIGH"]
    assert Decimal(str(eval_data["calculated_emi"])) > 0
    assert Decimal(str(eval_data["calculated_dti"])) > 0

    # Verify status is now RISK_ASSESSED
    app_details_risk = await async_client.get(
        f"/api/v1/applications/{app_id}", headers=analyst_headers
    )
    assert app_details_risk.json()["data"]["status"] == ApplicationStatus.RISK_ASSESSED.value

    # Step 9: Risk Analyst Records Final Underwriting Decision (APPROVED)
    decision_res = await async_client.post(
        f"/api/v1/applications/{app_id}/decision",
        headers=analyst_headers,
        json={
            "decision": "APPROVED",
            "approved_amount": "250000.00",
            "approved_apr": "10.50",
            "approved_tenor_months": 24,
            "conditions": "Standard auto-debit ECS mandate required.",
            "underwriter_notes": "Applicant demonstrated solid liquidity buffer and prime employment tenure.",
        },
    )
    assert decision_res.status_code == 200
    assert decision_res.json()["data"]["decision"] == "APPROVED"

    # Step 10: Operations / Admin issues Disbursement
    disburse_res = await async_client.post(
        f"/api/v1/applications/{app_id}/transition",
        headers=ops_headers,
        json={"target_status": "DISBURSED", "notes": "Funds transferred via NEFT/RTGS batch."},
    )
    assert disburse_res.status_code == 200
    assert disburse_res.json()["data"]["status"] == ApplicationStatus.DISBURSED.value

    # Step 11: Admin Verifies Complete Immutable Audit Trail
    audit_res = await async_client.get(
        f"/api/v1/audit/logs?entity_id={app_id}",
        headers=admin_headers,
    )
    assert audit_res.status_code == 200
    audit_data = audit_res.json()["data"]
    assert audit_data["total"] >= 5

    recorded_app_events = [item["event_type"] for item in audit_data["items"]]
    assert "STATUS_TRANSITION_SUBMITTED" in recorded_app_events
    assert "STATUS_TRANSITION_UNDER_REVIEW" in recorded_app_events
    assert "STATUS_TRANSITION_DOCUMENTS_VERIFIED" in recorded_app_events
    assert "STATUS_TRANSITION_RISK_ASSESSED" in recorded_app_events
    assert "STATUS_TRANSITION_APPROVED" in recorded_app_events
    assert "STATUS_TRANSITION_DISBURSED" in recorded_app_events

    # Verify global ledger captures document and decision events
    all_audit_res = await async_client.get(
        "/api/v1/audit/logs",
        headers=admin_headers,
    )
    assert all_audit_res.status_code == 200
    all_events = [item["event_type"] for item in all_audit_res.json()["data"]["items"]]
    assert "DOCUMENT_UPLOADED" in all_events
    assert "DOCUMENT_VERIFIED" in all_events
    assert "DECISION_RECORDED" in all_events
