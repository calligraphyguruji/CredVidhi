"""Wizard API contract, security, retries and persisted upload integration."""

import uuid
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import func, select

from app.models.application import LoanApplication
from app.models.audit_log import AuditLog
from app.models.document import ApplicationDocument
from app.models.user import UserRole
from app.services.application_validation import (
    ApplicationValidationError,
    FinancialSnapshot,
    PersonalSnapshot,
    document_requirements,
    snapshot_errors,
)
from app.services.storage_service import StorageService, StorageUnavailableError, storage_service
from tests.test_security_rbac import create_product, create_user
from tests.wizard_helpers import FINANCIAL, PERSONAL, complete_draft


async def setup(client, db):
    product = await create_product(db)
    _, token = await create_user(db, UserRole.APPLICANT, "wizard@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    draft_id = str(uuid.uuid4())
    payload = {
        "draft_id": draft_id,
        "product_id": str(product.id),
        "requested_amount": 50000,
        "requested_tenor_months": 24,
        "purpose": "Personal renovation",
    }
    response = await client.post("/api/v1/applications", headers=headers, json=payload)
    assert response.status_code == 201
    return product, headers, draft_id, payload


@pytest.mark.asyncio
async def test_required_data_gate_cannot_be_bypassed_and_retries_are_idempotent(
    async_client, db_session
):
    product, headers, app_id, payload = await setup(async_client, db_session)
    again = await async_client.post("/api/v1/applications", headers=headers, json=payload)
    assert again.status_code == 200 and again.json()["data"]["id"] == app_id
    for suffix, body in [("submit", None), ("transition", {"target_status": "SUBMITTED"})]:
        response = await async_client.post(
            f"/api/v1/applications/{app_id}/{suffix}", headers=headers, json=body
        )
        assert response.status_code == 422
        fields = response.json()["error"]["details"]["fields"]
        assert (
            "personal.fullName" in fields
            and "financial.grossMonthlyIncome" in fields
            and "documents.PAN_CARD" in fields
        )
    detail = await async_client.get(f"/api/v1/applications/{app_id}", headers=headers)
    assert (
        detail.json()["data"]["status"] == "DRAFT" and detail.json()["data"]["submitted_at"] is None
    )
    await complete_draft(async_client, app_id, headers, product.required_documents)
    first = await async_client.post(f"/api/v1/applications/{app_id}/submit", headers=headers)
    second = await async_client.post(f"/api/v1/applications/{app_id}/submit", headers=headers)
    assert first.status_code == second.status_code == 200
    assert first.json()["data"]["reference_number"] == second.json()["data"]["reference_number"]
    assert (
        await db_session.execute(select(func.count()).select_from(LoanApplication))
    ).scalar_one() == 1
    assert (
        await db_session.execute(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.event_type == "STATUS_TRANSITION_SUBMITTED")
        )
    ).scalar_one() == 1
    changed = await async_client.put(
        f"/api/v1/applications/{app_id}/draft", headers=headers, json={"purpose": "changed"}
    )
    assert changed.status_code == 400


@pytest.mark.asyncio
async def test_document_replacement_withdrawal_security_and_reload(async_client, db_session):
    _, headers, app_id, payload = await setup(async_client, db_session)
    await complete_draft(async_client, app_id, headers, [])
    _, other_token = await create_user(db_session, UserRole.APPLICANT, "otherwizard@example.com")
    other = {"Authorization": f"Bearer {other_token}"}
    stolen_id = await async_client.post("/api/v1/applications", headers=other, json=payload)
    assert stolen_id.status_code == 403

    async def upload(content=b"%PDF-1.4\nactual test document", **extra):
        return await async_client.post(
            f"/api/v1/applications/{app_id}/documents/upload",
            headers=headers,
            data={"document_type": "PAN_CARD", **extra},
            files={"file": ("../../proof.pdf", content, "application/pdf")},
        )

    initial = await upload()
    assert initial.status_code == 201
    doc = initial.json()["data"]
    assert doc["original_filename"] == "proof.pdf"
    assert (await upload()).json()["data"]["id"] == doc["id"]
    for path, method in [
        (f"/documents/{doc['id']}/download", "get"),
        (f"/applications/{app_id}/documents/{doc['id']}/withdraw", "post"),
    ]:
        assert (
            await getattr(async_client, method)("/api/v1" + path, headers=other)
        ).status_code == 403
        assert (await getattr(async_client, method)("/api/v1" + path)).status_code == 401
    replaced = await upload(b"%PDF-1.4\nreplacement", replace_document_id=doc["id"])
    assert replaced.status_code == 201
    replacement_id = replaced.json()["data"]["id"]
    visible = await async_client.get(f"/api/v1/applications/{app_id}/documents", headers=headers)
    assert [d["id"] for d in visible.json()["data"]] == [replacement_id]
    assert (
        await async_client.get(f"/api/v1/documents/{doc['id']}/download", headers=headers)
    ).status_code == 404
    invalid = await upload(replace_document_id=doc["id"])
    assert invalid.status_code == 400
    for _ in range(2):
        response = await async_client.post(
            f"/api/v1/applications/{app_id}/documents/{replacement_id}/withdraw", headers=headers
        )
        assert response.status_code == 200
    assert (
        await async_client.get(f"/api/v1/applications/{app_id}/documents", headers=headers)
    ).json()["data"] == []
    assert (
        await async_client.post(f"/api/v1/applications/{app_id}/submit", headers=headers)
    ).status_code == 422
    assert (
        await db_session.execute(select(func.count()).select_from(ApplicationDocument))
    ).scalar_one() == 2
    assert (
        await async_client.get(
            f"/api/v1/applications/{app_id}/documents/checklist", headers=headers
        )
    ).json()["data"]["missing_documents"] == ["PAN_CARD"]


@pytest.mark.asyncio
async def test_storage_failure_does_not_withdraw_existing_document(
    async_client, db_session, monkeypatch
):
    _, headers, app_id, _ = await setup(async_client, db_session)
    docs = await complete_draft(async_client, app_id, headers, ["PAN_CARD"])
    monkeypatch.setattr(
        storage_service,
        "upload_file_bytes",
        AsyncMock(side_effect=StorageUnavailableError("Please retry.")),
    )
    failed = await async_client.post(
        f"/api/v1/applications/{app_id}/documents/upload",
        headers=headers,
        data={"document_type": "PAN_CARD", "replace_document_id": docs[0]["id"]},
        files={"file": ("replacement.pdf", b"%PDF-1.4\nreplacement", "application/pdf")},
    )
    assert failed.status_code == 503
    remaining = (
        await async_client.get(f"/api/v1/applications/{app_id}/documents", headers=headers)
    ).json()["data"]
    assert len(remaining) == 1 and remaining[0]["id"] == docs[0]["id"]


@pytest.mark.asyncio
async def test_optional_docs_and_changed_product_constraints(async_client, db_session):
    product, headers, app_id, _ = await setup(async_client, db_session)
    product.required_documents = [
        {"code": "PAN_CARD", "mandatory": True},
        {"code": "BANK_STATEMENT", "mandatory": False},
    ]
    await db_session.commit()
    await complete_draft(async_client, app_id, headers, ["PAN_CARD"])
    assert (
        await async_client.post(f"/api/v1/applications/{app_id}/submit", headers=headers)
    ).status_code == 200


@pytest.mark.parametrize(
    "field,value",
    [
        ("grossMonthlyIncome", 0),
        ("grossMonthlyIncome", -1),
        ("housingExpense", -1),
        ("existingMonthlyDebt", -1),
        ("yearsEmployed", -1),
        ("creditScoreDeclared", 299),
        ("creditScoreDeclared", 901),
        ("creditScoreDeclared", 700.5),
        ("employmentType", ""),
        ("employerName", " "),
        ("jobTitle", ""),
        ("grossMonthlyIncome", "NaN"),
    ],
)
def test_invalid_financial_fields_rejected(field, value):
    assert snapshot_errors(FinancialSnapshot, {**FINANCIAL, field: value}, "financial")


def test_zero_expenses_optional_score_and_self_employed_are_valid():
    assert not snapshot_errors(
        FinancialSnapshot,
        {**FINANCIAL, "yearsEmployed": 0, "employmentType": "SELF_EMPLOYED", "jobTitle": ""},
        "financial",
    )
    assert snapshot_errors(
        PersonalSnapshot, {**PERSONAL, "phone": "invalid", "dateOfBirth": "2025-02-30"}, "personal"
    )
    assert snapshot_errors(PersonalSnapshot, {**PERSONAL, "dateOfBirth": "2999-01-01"}, "personal")


def test_document_configuration_aliases_and_bad_config():
    from types import SimpleNamespace

    assert document_requirements(
        SimpleNamespace(required_documents=["GOV_ID", {"code": "PAN_CARD", "mandatory": False}])
    ) == [{"code": "PAN_CARD", "title": "Pan Card", "mandatory": True}]
    with pytest.raises(ApplicationValidationError):
        document_requirements(SimpleNamespace(required_documents=["UNSUPPORTED"]))


@pytest.mark.asyncio
async def test_local_storage_private_download_and_path_guards(
    async_client, db_session, tmp_path, monkeypatch
):
    _, headers, app_id, _ = await setup(async_client, db_session)
    local = StorageService()
    local.local_root = tmp_path
    monkeypatch.setattr(storage_service, "local_root", tmp_path)
    monkeypatch.setattr(storage_service, "upload_file_bytes", local.upload_file_bytes)
    monkeypatch.setattr(
        storage_service, "generate_presigned_download_url", local.generate_presigned_download_url
    )
    docs = await complete_draft(async_client, app_id, headers, ["PAN_CARD"])
    record = await db_session.get(ApplicationDocument, uuid.UUID(docs[0]["id"]))
    assert await local.check_object_exists(record.storage_path)
    downloaded = await async_client.get(f"/api/v1/documents/{record.id}/download", headers=headers)
    assert downloaded.status_code == 200 and downloaded.content.startswith(b"%PDF-")
    assert "no-store" in downloaded.headers["cache-control"]
    assert local.local_path(record.storage_path).stat().st_mode & 0o777 == 0o600
    for key in ["../escape.pdf", "/", "."]:
        with pytest.raises(StorageUnavailableError):
            local.local_path(key)
    with pytest.raises(StorageUnavailableError):
        await local.generate_presigned_upload_url("test", "application/pdf")
    local.local_root = None
    with pytest.raises(StorageUnavailableError):
        local.local_path("test")


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["DEFICIENT", "REJECTED"])
async def test_reupload_rejected_or_deficient_file_creates_new_pending_record(
    async_client, db_session, status
):
    from app.models.document import DocumentVerificationStatus

    _, headers, app_id, _ = await setup(async_client, db_session)
    docs = await complete_draft(async_client, app_id, headers, ["PAN_CARD"])
    old = await db_session.get(ApplicationDocument, uuid.UUID(docs[0]["id"]))
    old.verification_status = DocumentVerificationStatus(status)
    old.verification_remarks = "Please provide a new scan."
    await db_session.commit()
    uploaded = await async_client.post(
        f"/api/v1/applications/{app_id}/documents/upload",
        headers=headers,
        data={"document_type": "PAN_CARD"},
        files={"file": ("PAN_CARD.pdf", b"%PDF-1.4\nPAN_CARD", "application/pdf")},
    )
    assert uploaded.status_code == 201
    assert uploaded.json()["data"]["id"] != docs[0]["id"]
    assert uploaded.json()["data"]["verification_status"] == "PENDING"


@pytest.mark.asyncio
async def test_api_financial_validation_and_invalid_file_extensions(async_client, db_session):
    _, headers, app_id, _ = await setup(async_client, db_session)
    saved = await async_client.put(
        f"/api/v1/applications/{app_id}/draft",
        headers=headers,
        json={"applicant_personal_snapshot": {"taxId": "ABCDE1234F"}},
    )
    assert saved.status_code == 200
    edited = await async_client.put(
        f"/api/v1/applications/{app_id}/draft",
        headers=headers,
        json={"applicant_personal_snapshot": {"fullName": "Corrected Borrower"}},
    )
    assert edited.status_code == 200
    assert edited.json()["data"]["applicant_personal_snapshot"]["taxId"] == "***-**-1234"
    for field, value in [
        ("grossMonthlyIncome", 0),
        ("housingExpense", -1),
        ("existingMonthlyDebt", -1),
        ("creditScoreDeclared", 901),
    ]:
        invalid = await async_client.put(
            f"/api/v1/applications/{app_id}/draft",
            headers=headers,
            json={"applicant_financial_snapshot": {**FINANCIAL, field: value}},
        )
        assert invalid.status_code == 422
        assert f"financial.{field}" in invalid.json()["error"]["details"]["fields"]
    for name, mime in [
        ("malware.exe", "application/pdf"),
        ("proof.pdf", "image/png"),
        ("x" * 256 + ".pdf", "application/pdf"),
    ]:
        invalid = await async_client.post(
            f"/api/v1/applications/{app_id}/documents/upload",
            headers=headers,
            data={"document_type": "PAN_CARD"},
            files={"file": (name, b"%PDF-1.4\nproof", mime)},
        )
        assert invalid.status_code == 422
    assert (
        await db_session.execute(select(func.count()).select_from(ApplicationDocument))
    ).scalar_one() == 0


@pytest.mark.asyncio
async def test_direct_storage_confirmation_inspects_bytes_and_is_retry_safe(
    async_client, db_session, monkeypatch, tmp_path
):
    _, headers, app_id, _ = await setup(async_client, db_session)
    local = StorageService()
    local.local_root = tmp_path
    monkeypatch.setattr(storage_service, "validate_stored_document", local.validate_stored_document)
    key = f"documents/{app_id}/{uuid.uuid4()}.pdf"
    content = b"%PDF-1.4\nConfirmed stored document"
    await local.upload_file_bytes(key, content, "application/pdf")
    payload = {
        "document_type": "PAN_CARD",
        "original_filename": "identity.pdf",
        "storage_path": key,
        "mime_type": "application/pdf",
        "file_size_bytes": len(content),
        "file_hash": local.compute_sha256(content),
    }
    for field, value in [
        ("file_hash", "f" * 64),
        ("file_size_bytes", len(content) + 1),
        ("original_filename", "malware.exe"),
    ]:
        invalid = await async_client.post(
            f"/api/v1/applications/{app_id}/documents/confirm",
            headers=headers,
            json={**payload, field: value},
        )
        assert invalid.status_code == 422
    first = await async_client.post(
        f"/api/v1/applications/{app_id}/documents/confirm", headers=headers, json=payload
    )
    assert first.status_code == 201
    again = await async_client.post(
        f"/api/v1/applications/{app_id}/documents/confirm", headers=headers, json=payload
    )
    assert again.status_code == 200 and again.json()["data"]["id"] == first.json()["data"]["id"]
    for data in [b"MZ disguised executable", b"", b"%PDF-" + b"x" * 10485760]:
        await local.upload_file_bytes(key, data, "application/pdf")
        valid, error = await local.validate_stored_document(
            key, "application/pdf", len(data), local.compute_sha256(data)
        )
        assert not valid and error
    with pytest.raises(StorageUnavailableError):
        await local.validate_stored_document("missing.pdf", "application/pdf", 10, "f" * 64)


@pytest.mark.asyncio
async def test_s3_confirmation_reads_bounded_body(monkeypatch):
    from contextlib import asynccontextmanager
    from types import SimpleNamespace

    content = b"%PDF-1.4\nActual bytes"
    body = AsyncMock()
    body.__aenter__.return_value = body
    body.read.return_value = content
    client = SimpleNamespace(get_object=AsyncMock(return_value={"Body": body}))

    @asynccontextmanager
    async def create_client(*args, **kwargs):
        yield client

    storage = StorageService()
    storage.local_root = None
    monkeypatch.setattr(storage._session, "create_client", create_client)
    assert await storage.validate_stored_document(
        "documents/key.pdf", "application/pdf", len(content), storage.compute_sha256(content)
    ) == (True, None)
    body.read.assert_awaited_once_with(10485761)


@pytest.mark.asyncio
async def test_draft_creation_collision_rolls_back_without_expired_identity_access(
    async_client, db_session, monkeypatch
):
    from sqlalchemy.ext.asyncio import AsyncSession

    _, headers, app_id, payload = await setup(async_client, db_session)
    original_get = AsyncSession.get
    hidden = False

    async def get_after_racing_insert(session, model, key, *args, **kwargs):
        nonlocal hidden
        if model is LoanApplication and str(key) == app_id and not hidden:
            hidden = True
            return None  # Another request commits this UUID after our initial lookup.
        return await original_get(session, model, key, *args, **kwargs)

    monkeypatch.setattr(AsyncSession, "get", get_after_racing_insert)
    repeated = await async_client.post("/api/v1/applications", headers=headers, json=payload)
    assert repeated.status_code == 200 and repeated.json()["data"]["id"] == app_id
    assert (
        await db_session.execute(select(func.count()).select_from(LoanApplication))
    ).scalar_one() == 1
