"""Comprehensive Verification Suite for Document Storage & Verification Pipeline (Phase 04)."""

import io
import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.loan_product import LoanProduct
from app.models.user import User, UserRole


async def create_test_product(db_session: AsyncSession) -> LoanProduct:
    """Helper to create loan product requiring PAN_CARD and SALARY_SLIP."""
    product = LoanProduct(
        id=uuid.uuid4(),
        code=f"DOC_PROD_{uuid.uuid4().hex[:6].upper()}",
        name="Doc Test Loan Product",
        description="Testing doc requirements",
        min_amount=Decimal("50000.00"),
        max_amount=Decimal("1000000.00"),
        min_tenor_months=6,
        max_tenor_months=36,
        base_apr=Decimal("12.00"),
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
        first_name="DocTest",
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
async def test_magic_byte_validation_rejection(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify that disguised executable files or corrupt headers are rejected."""
    product = await create_test_product(db_session)
    applicant, app_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "magic_byte_app@test.com"
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

    # 1. Disguised .exe uploaded as application/pdf (starts with MZ PE header instead of %PDF-)
    fake_exe_bytes = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"
    res_fake = await async_client.post(
        f"/api/v1/applications/{app_id}/documents/upload",
        data={"document_type": "PAN_CARD"},
        files={"file": ("malicious.pdf", io.BytesIO(fake_exe_bytes), "application/pdf")},
        headers=headers,
    )
    assert res_fake.status_code == 422
    assert res_fake.json()["error"]["code"] == "INVALID_FILE_SIGNATURE"

    # 2. Valid PDF header (%PDF-1.4...) accepted
    valid_pdf_bytes = b"%PDF-1.4\n%Valid test PDF content for institutional verification\n%%EOF"
    res_valid = await async_client.post(
        f"/api/v1/applications/{app_id}/documents/upload",
        data={"document_type": "PAN_CARD"},
        files={"file": ("pan_card.pdf", io.BytesIO(valid_pdf_bytes), "application/pdf")},
        headers=headers,
    )
    assert res_valid.status_code == 201
    assert res_valid.json()["data"]["document_type"] == "PAN_CARD"
    assert res_valid.json()["data"]["verification_status"] == "PENDING"
    assert res_valid.json()["data"]["download_url"] is not None


@pytest.mark.asyncio
async def test_file_size_exceeded_and_empty_rejection(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify that files > 10MB and empty files (0 bytes) are strictly rejected."""
    product = await create_test_product(db_session)
    applicant, app_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "size_app@test.com"
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

    # 1. Presign request with size exceeding 10MB (10,485,761 bytes)
    presign_bad = await async_client.post(
        f"/api/v1/applications/{app_id}/documents/presign",
        json={
            "document_type": "SALARY_SLIP",
            "original_filename": "giant_salary.pdf",
            "mime_type": "application/pdf",
            "file_size_bytes": 11 * 1024 * 1024,
        },
        headers=headers,
    )
    assert presign_bad.status_code == 422

    # 2. Direct upload with empty bytes (0 bytes)
    res_empty = await async_client.post(
        f"/api/v1/applications/{app_id}/documents/upload",
        data={"document_type": "SALARY_SLIP"},
        files={"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")},
        headers=headers,
    )
    assert res_empty.status_code == 422
    assert res_empty.json()["error"]["code"] == "EMPTY_FILE"


@pytest.mark.asyncio
async def test_presign_and_confirm_workflow(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify the presign and confirmation lifecycle for direct S3 client uploads."""
    product = await create_test_product(db_session)
    applicant, app_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "presign_app@test.com"
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

    # Step 1: Request presigned upload URL
    presign_res = await async_client.post(
        f"/api/v1/applications/{app_id}/documents/presign",
        json={
            "document_type": "PAN_CARD",
            "original_filename": "my_pan.pdf",
            "mime_type": "application/pdf",
            "file_size_bytes": 102400,
        },
        headers=headers,
    )
    assert presign_res.status_code == 200
    presign_data = presign_res.json()["data"]
    assert "upload_url" in presign_data
    assert presign_data["storage_path"].startswith(f"documents/{app_id}/")

    # Step 2: Confirm successful upload
    confirm_res = await async_client.post(
        f"/api/v1/applications/{app_id}/documents/confirm",
        json={
            "document_type": "PAN_CARD",
            "original_filename": "my_pan.pdf",
            "storage_path": presign_data["storage_path"],
            "mime_type": "application/pdf",
            "file_size_bytes": 102400,
            "file_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
        headers=headers,
    )
    assert confirm_res.status_code == 201
    doc_data = confirm_res.json()["data"]
    assert doc_data["document_type"] == "PAN_CARD"
    assert doc_data["verification_status"] == "PENDING"
    assert doc_data["download_url"] is not None


@pytest.mark.asyncio
async def test_document_access_control(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Verify RBAC and IDOR prevention on document endpoints."""
    product = await create_test_product(db_session)
    victim, victim_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "doc_victim@test.com"
    )
    attacker, attacker_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "doc_attacker@test.com"
    )
    officer, officer_token = await create_user_with_role(
        db_session, UserRole.LOAN_OFFICER, "doc_officer@test.com"
    )

    victim_headers = {"Authorization": f"Bearer {victim_token}"}
    attacker_headers = {"Authorization": f"Bearer {attacker_token}"}
    officer_headers = {"Authorization": f"Bearer {officer_token}"}

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

    # Victim uploads PAN
    valid_pdf = b"%PDF-1.4\nTest PDF"
    upload_res = await async_client.post(
        f"/api/v1/applications/{victim_app_id}/documents/upload",
        data={"document_type": "PAN_CARD"},
        files={"file": ("victim_pan.pdf", io.BytesIO(valid_pdf), "application/pdf")},
        headers=victim_headers,
    )
    doc_id = upload_res.json()["data"]["id"]

    # Attacker tries to view victim's documents -> 403 Forbidden
    attacker_list = await async_client.get(
        f"/api/v1/applications/{victim_app_id}/documents",
        headers=attacker_headers,
    )
    assert attacker_list.status_code == 403

    # Attacker tries to upload document to victim's application -> 403 Forbidden
    attacker_upload = await async_client.post(
        f"/api/v1/applications/{victim_app_id}/documents/presign",
        json={
            "document_type": "PAN_CARD",
            "original_filename": "exploit.pdf",
            "mime_type": "application/pdf",
            "file_size_bytes": 1024,
        },
        headers=attacker_headers,
    )
    assert attacker_upload.status_code == 403

    # Attacker tries to verify document -> 403 Forbidden (requires LOAN_OFFICER or ADMIN)
    attacker_verify = await async_client.post(
        f"/api/v1/documents/{doc_id}/verify",
        json={"verification_status": "VERIFIED"},
        headers=attacker_headers,
    )
    assert attacker_verify.status_code == 403

    # Officer CAN view victim's documents
    officer_list = await async_client.get(
        f"/api/v1/applications/{victim_app_id}/documents",
        headers=officer_headers,
    )
    assert officer_list.status_code == 200
    assert len(officer_list.json()["data"]) == 1


@pytest.mark.asyncio
async def test_officer_verification_and_automated_fsm_triggers(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify document verification checklist and automated FSM transitions."""
    # Product requires: PAN_CARD and SALARY_SLIP
    product = await create_test_product(db_session)
    applicant, app_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "fsm_doc_app@test.com"
    )
    officer, officer_token = await create_user_with_role(
        db_session, UserRole.LOAN_OFFICER, "fsm_doc_officer@test.com"
    )

    app_headers = {"Authorization": f"Bearer {app_token}"}
    officer_headers = {"Authorization": f"Bearer {officer_token}"}

    # 1. Applicant creates and submits application
    create_res = await async_client.post(
        "/api/v1/applications",
        json={
            "product_id": str(product.id),
            "requested_amount": 200000.0,
            "requested_tenor_months": 24,
        },
        headers=app_headers,
    )
    app_id = create_res.json()["data"]["id"]
    await async_client.post(f"/api/v1/applications/{app_id}/submit", headers=app_headers)

    # 2. Officer transitions application to UNDER_REVIEW
    await async_client.post(
        f"/api/v1/applications/{app_id}/transition",
        json={"target_status": "UNDER_REVIEW"},
        headers=officer_headers,
    )

    # 3. Applicant uploads PAN_CARD
    valid_pdf = b"%PDF-1.4\nPAN Card Content"
    pan_res = await async_client.post(
        f"/api/v1/applications/{app_id}/documents/upload",
        data={"document_type": "PAN_CARD"},
        files={"file": ("pan.pdf", io.BytesIO(valid_pdf), "application/pdf")},
        headers=app_headers,
    )
    pan_doc_id = pan_res.json()["data"]["id"]

    # 4. Check checklist before any verification
    chk1 = await async_client.get(
        f"/api/v1/applications/{app_id}/documents/checklist",
        headers=app_headers,
    )
    assert chk1.status_code == 200
    chk1_data = chk1.json()["data"]
    assert chk1_data["all_verified"] is False
    assert "PAN_CARD" in chk1_data["missing_documents"]
    assert "SALARY_SLIP" in chk1_data["missing_documents"]

    # 5. Officer marks PAN_CARD as DEFICIENT (blurry scan)
    # Verification without remarks must fail with 400
    bad_deficient = await async_client.post(
        f"/api/v1/documents/{pan_doc_id}/verify",
        json={"verification_status": "DEFICIENT", "verification_remarks": ""},
        headers=officer_headers,
    )
    assert bad_deficient.status_code == 400
    assert bad_deficient.json()["error"]["code"] == "REMARKS_MANDATORY"

    # With proper remarks -> Application automatically transitions to DOCUMENTS_PENDING!
    good_deficient = await async_client.post(
        f"/api/v1/documents/{pan_doc_id}/verify",
        json={
            "verification_status": "DEFICIENT",
            "verification_remarks": "Photo on PAN card is blurry; please re-upload high-resolution copy",
        },
        headers=officer_headers,
    )
    assert good_deficient.status_code == 200
    assert good_deficient.json()["data"]["verification_status"] == "DEFICIENT"

    # Verify application status automatically shifted to DOCUMENTS_PENDING
    app_check1 = await async_client.get(f"/api/v1/applications/{app_id}", headers=app_headers)
    assert app_check1.json()["data"]["status"] == "DOCUMENTS_PENDING"

    # 6. Applicant re-uploads clean PAN_CARD and uploads SALARY_SLIP
    pan_res2 = await async_client.post(
        f"/api/v1/applications/{app_id}/documents/upload",
        data={"document_type": "PAN_CARD"},
        files={"file": ("clean_pan.pdf", io.BytesIO(valid_pdf), "application/pdf")},
        headers=app_headers,
    )
    new_pan_doc_id = pan_res2.json()["data"]["id"]

    salary_res = await async_client.post(
        f"/api/v1/applications/{app_id}/documents/upload",
        data={"document_type": "SALARY_SLIP"},
        files={"file": ("salary.pdf", io.BytesIO(valid_pdf), "application/pdf")},
        headers=app_headers,
    )
    salary_doc_id = salary_res.json()["data"]["id"]

    # 7. Officer verifies PAN_CARD
    v_pan = await async_client.post(
        f"/api/v1/documents/{new_pan_doc_id}/verify",
        json={"verification_status": "VERIFIED", "verification_remarks": "Clear copy verified"},
        headers=officer_headers,
    )
    assert v_pan.status_code == 200
    assert v_pan.json()["data"]["verification_status"] == "VERIFIED"

    # At this point, SALARY_SLIP is still pending, so application is not fully verified yet
    # 8. Officer verifies SALARY_SLIP -> Triggers auto-advancement to DOCUMENTS_VERIFIED!
    v_salary = await async_client.post(
        f"/api/v1/documents/{salary_doc_id}/verify",
        json={
            "verification_status": "VERIFIED",
            "verification_remarks": "Salary slips match bank statement figures",
        },
        headers=officer_headers,
    )
    assert v_salary.status_code == 200
    assert v_salary.json()["data"]["verification_status"] == "VERIFIED"

    # 9. Verify application state is now DOCUMENTS_VERIFIED
    app_check2 = await async_client.get(f"/api/v1/applications/{app_id}", headers=app_headers)
    assert app_check2.json()["data"]["status"] == "DOCUMENTS_VERIFIED"

    # 10. Check checklist confirms all_verified is True
    chk2 = await async_client.get(
        f"/api/v1/applications/{app_id}/documents/checklist",
        headers=app_headers,
    )
    assert chk2.status_code == 200
    assert chk2.json()["data"]["all_verified"] is True
    assert len(chk2.json()["data"]["missing_documents"]) == 0


@pytest.mark.asyncio
async def test_confirm_document_idor_storage_path_rejection(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify that confirming a document with a forged or cross-tenant storage path is blocked."""
    product = await create_test_product(db_session)
    victim, victim_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "victim_idor@test.com"
    )
    attacker, attacker_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "attacker_idor@test.com"
    )

    victim_headers = {"Authorization": f"Bearer {victim_token}"}
    attacker_headers = {"Authorization": f"Bearer {attacker_token}"}

    v_res = await async_client.post(
        "/api/v1/applications",
        json={
            "product_id": str(product.id),
            "requested_amount": 100000.0,
            "requested_tenor_months": 12,
        },
        headers=victim_headers,
    )
    victim_app_id = v_res.json()["data"]["id"]

    a_res = await async_client.post(
        "/api/v1/applications",
        json={
            "product_id": str(product.id),
            "requested_amount": 100000.0,
            "requested_tenor_months": 12,
        },
        headers=attacker_headers,
    )
    attacker_app_id = a_res.json()["data"]["id"]

    # Attacker tries to confirm upload pointing to victim's storage key
    fake_path = f"documents/{victim_app_id}/stolen_pan.pdf"
    bad_confirm = await async_client.post(
        f"/api/v1/applications/{attacker_app_id}/documents/confirm",
        json={
            "document_type": "PAN_CARD",
            "original_filename": "pan.pdf",
            "storage_path": fake_path,
            "mime_type": "application/pdf",
            "file_size_bytes": 1024,
            "file_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
        headers=attacker_headers,
    )
    assert bad_confirm.status_code == 403
    assert bad_confirm.json()["error"]["code"] == "INVALID_STORAGE_PATH"


@pytest.mark.asyncio
async def test_verify_document_rejected_state_forbidden(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify document verification cannot be executed on rejected or terminal applications."""
    product = await create_test_product(db_session)
    applicant, app_token = await create_user_with_role(
        db_session, UserRole.APPLICANT, "term_app@test.com"
    )
    officer, officer_token = await create_user_with_role(
        db_session, UserRole.LOAN_OFFICER, "term_officer@test.com"
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

    # Upload document
    valid_pdf = b"%PDF-1.4\nTest PDF"
    upload_res = await async_client.post(
        f"/api/v1/applications/{app_id}/documents/upload",
        data={"document_type": "PAN_CARD"},
        files={"file": ("pan.pdf", io.BytesIO(valid_pdf), "application/pdf")},
        headers=app_headers,
    )
    doc_id = upload_res.json()["data"]["id"]

    # Reject application
    await async_client.post(
        f"/api/v1/applications/{app_id}/cancel",
        params={"reason": "Applicant requested cancellation"},
        headers=app_headers,
    )

    # Officer attempts to verify document on rejected application -> 400 Bad Request
    bad_verify = await async_client.post(
        f"/api/v1/documents/{doc_id}/verify",
        json={"verification_status": "VERIFIED"},
        headers=officer_headers,
    )
    assert bad_verify.status_code == 400
    assert bad_verify.json()["error"]["code"] == "ILLEGAL_MUTATION"
