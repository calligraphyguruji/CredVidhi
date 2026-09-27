import asyncio
import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.responses import error_response, success_response
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.application import ApplicationStatus, LoanApplication
from app.models.base import utc_now
from app.models.document import ApplicationDocument, DocumentType, DocumentVerificationStatus
from app.models.loan_product import LoanProduct
from app.models.user import User, UserRole
from app.schemas.document import (
    DocumentChecklistResponse,
    DocumentConfirmRequest,
    DocumentPresignRequest,
    DocumentPresignResponse,
    DocumentResponse,
    DocumentVerifyRequest,
)
from app.services.audit_service import record_audit_event
from app.services.fsm_service import IllegalStateTransitionError, execute_transition
from app.services.storage_service import MAX_FILE_SIZE_BYTES, storage_service

router = APIRouter(tags=["Document Management & Verification"])


@router.post(
    "/applications/{app_id}/documents/presign",
    summary="Generate Presigned Upload URL",
    description="Validates metadata and generates a secure, time-limited presigned S3/MinIO upload URL.",
)
async def generate_document_upload_url(
    app_id: uuid.UUID,
    payload: DocumentPresignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Issue presigned upload URL for direct storage transfer."""
    result = await db.execute(select(LoanApplication).where(LoanApplication.id == app_id))
    application = result.scalar_one_or_none()
    if not application:
        return error_response(
            code="APPLICATION_NOT_FOUND",
            message="Application does not exist.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Permission check: Only applicant owner or admin can request upload URLs
    if application.applicant_id != current_user.id and current_user.role != UserRole.ADMIN:
        return error_response(
            code="ACCESS_FORBIDDEN",
            message="You do not have permission to upload documents for this application.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    if application.status in (ApplicationStatus.REJECTED, ApplicationStatus.DISBURSED):
        return error_response(
            code="ILLEGAL_MUTATION",
            message=f"Cannot upload documents for application in '{application.status.value}' status.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Validate file size and MIME type
    is_valid, err_msg = storage_service.validate_file_metadata(
        mime_type=payload.mime_type, file_size_bytes=payload.file_size_bytes
    )
    if not is_valid:
        return error_response(
            code="INVALID_FILE_METADATA",
            message=err_msg or "Invalid document metadata.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    storage_key = storage_service.generate_storage_key(
        application_id=application.id, mime_type=payload.mime_type
    )
    upload_url = await storage_service.generate_presigned_upload_url(
        storage_key=storage_key, mime_type=payload.mime_type
    )

    doc_id = uuid.uuid4()
    response_data = DocumentPresignResponse(
        upload_url=upload_url,
        document_id=doc_id,
        storage_path=storage_key,
        expires_in_seconds=900,
    )
    return success_response(data=response_data.model_dump())


@router.post(
    "/applications/{app_id}/documents/confirm",
    summary="Confirm Document Upload",
    description="Registers uploaded document in database after successful storage transfer.",
)
async def confirm_document_upload(
    app_id: uuid.UUID,
    payload: DocumentConfirmRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Record verified document entity in database."""
    result = await db.execute(select(LoanApplication).where(LoanApplication.id == app_id))
    application = result.scalar_one_or_none()
    if not application:
        return error_response(
            code="APPLICATION_NOT_FOUND",
            message="Application does not exist.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    if application.applicant_id != current_user.id and current_user.role != UserRole.ADMIN:
        return error_response(
            code="ACCESS_FORBIDDEN",
            message="You do not have permission to register documents for this application.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    if application.status in (ApplicationStatus.REJECTED, ApplicationStatus.DISBURSED):
        return error_response(
            code="ILLEGAL_MUTATION",
            message=f"Cannot add documents to application in '{application.status.value}' status.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    is_valid, err_msg = storage_service.validate_file_metadata(
        mime_type=payload.mime_type, file_size_bytes=payload.file_size_bytes
    )
    if not is_valid:
        return error_response(
            code="INVALID_FILE_METADATA",
            message=err_msg or "Invalid document metadata.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    # CRIT-01 Fix: Enforce sandboxed storage path prefix and prevent cross-tenant hijacking
    expected_prefix = f"documents/{application.id}/"
    if (
        not payload.storage_path.startswith(expected_prefix)
        or ".." in payload.storage_path
        or len(payload.storage_path.split("/")) != 3
    ):
        return error_response(
            code="INVALID_STORAGE_PATH",
            message="Storage path does not belong to this application sandbox.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    # HIGH-01 Fix: Verify object presence in storage bucket
    object_exists = await storage_service.check_object_exists(payload.storage_path)
    if not object_exists:
        return error_response(
            code="OBJECT_NOT_FOUND_IN_STORAGE",
            message="Document object was not found in storage. Complete file upload before confirming.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    sanitized_filename = Path(payload.original_filename.strip()).name

    new_doc = ApplicationDocument(
        id=uuid.uuid4(),
        application_id=application.id,
        document_type=payload.document_type,
        original_filename=sanitized_filename,
        storage_path=payload.storage_path,
        mime_type=payload.mime_type,
        file_size_bytes=payload.file_size_bytes,
        file_hash=payload.file_hash,
        verification_status=DocumentVerificationStatus.PENDING,
    )
    db.add(new_doc)

    await record_audit_event(
        session=db,
        event_type="DOCUMENT_UPLOADED",
        entity_name="application_documents",
        entity_id=new_doc.id,
        actor_id=current_user.id,
        actor_role=current_user.role.value,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        subsequent_state={"verification_status": new_doc.verification_status.value},
        metadata_snapshot={
            "document_type": new_doc.document_type.value,
            "filename": new_doc.original_filename,
            "file_size": new_doc.file_size_bytes,
        },
    )

    await db.commit()
    await db.refresh(new_doc)

    download_url = await storage_service.generate_presigned_download_url(new_doc.storage_path)
    dto = DocumentResponse.model_validate(new_doc).model_dump()
    dto["download_url"] = download_url
    return success_response(data=dto, status_code=status.HTTP_201_CREATED)


@router.post(
    "/applications/{app_id}/documents/upload",
    summary="Direct Multipart Document Upload",
    description="Inspects magic bytes, validates file limits, streams to storage, and registers document.",
)
async def upload_document_multipart(
    app_id: uuid.UUID,
    request: Request,
    document_type: DocumentType = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Upload document directly via multipart form."""
    result = await db.execute(select(LoanApplication).where(LoanApplication.id == app_id))
    application = result.scalar_one_or_none()
    if not application:
        return error_response(
            code="APPLICATION_NOT_FOUND",
            message="Application does not exist.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    if application.applicant_id != current_user.id and current_user.role != UserRole.ADMIN:
        return error_response(
            code="ACCESS_FORBIDDEN",
            message="You do not have permission to upload documents for this application.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    if application.status in (ApplicationStatus.REJECTED, ApplicationStatus.DISBURSED):
        return error_response(
            code="ILLEGAL_MUTATION",
            message=f"Cannot add documents to application in '{application.status.value}' status.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # CRIT-02 Fix: Stream file reading in bounded chunks to prevent memory exhaustion DoS
    chunk_size = 64 * 1024
    content_buffer = bytearray()
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        content_buffer.extend(chunk)
        if len(content_buffer) > MAX_FILE_SIZE_BYTES:
            return error_response(
                code="FILE_TOO_LARGE",
                message=f"File exceeds maximum allowable limit of {MAX_FILE_SIZE_BYTES:,} bytes (10 MB).",
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

    file_size = len(content_buffer)
    if file_size == 0:
        return error_response(
            code="EMPTY_FILE",
            message="Uploaded file is empty (0 bytes).",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    content = bytes(content_buffer)

    # Magic byte inspection
    declared_mime = file.content_type or "application/octet-stream"
    is_valid, err_msg = storage_service.validate_magic_bytes(
        header_bytes=content[:32], declared_mime_type=declared_mime
    )
    if not is_valid:
        return error_response(
            code="INVALID_FILE_SIGNATURE",
            message=err_msg or "File header check failed.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    # Compute SHA-256 integrity hash
    file_hash = storage_service.compute_sha256(content)
    storage_key = storage_service.generate_storage_key(
        application_id=application.id, mime_type=declared_mime
    )

    # Stream to MinIO / S3
    await storage_service.upload_file_bytes(
        storage_key=storage_key, file_bytes=content, mime_type=declared_mime
    )

    sanitized_filename = Path(file.filename or f"doc_{uuid.uuid4().hex[:6]}.bin").name

    new_doc = ApplicationDocument(
        id=uuid.uuid4(),
        application_id=application.id,
        document_type=document_type,
        original_filename=sanitized_filename,
        storage_path=storage_key,
        mime_type=declared_mime,
        file_size_bytes=file_size,
        file_hash=file_hash,
        verification_status=DocumentVerificationStatus.PENDING,
    )
    db.add(new_doc)

    await record_audit_event(
        session=db,
        event_type="DOCUMENT_UPLOADED",
        entity_name="application_documents",
        entity_id=new_doc.id,
        actor_id=current_user.id,
        actor_role=current_user.role.value,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        subsequent_state={"verification_status": new_doc.verification_status.value},
        metadata_snapshot={
            "document_type": new_doc.document_type.value,
            "filename": new_doc.original_filename,
            "file_size": new_doc.file_size_bytes,
            "file_hash": file_hash,
        },
    )

    await db.commit()
    await db.refresh(new_doc)

    download_url = await storage_service.generate_presigned_download_url(new_doc.storage_path)
    dto = DocumentResponse.model_validate(new_doc).model_dump()
    dto["download_url"] = download_url
    return success_response(data=dto, status_code=status.HTTP_201_CREATED)


@router.get(
    "/applications/{app_id}/documents",
    summary="List Application Documents",
    description="Returns all uploaded documents with fresh presigned download URLs.",
)
async def list_application_documents(
    app_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Retrieve all documents attached to an application."""
    result = await db.execute(select(LoanApplication).where(LoanApplication.id == app_id))
    application = result.scalar_one_or_none()
    if not application:
        return error_response(
            code="APPLICATION_NOT_FOUND",
            message="Application does not exist.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    is_staff = current_user.role in (
        UserRole.LOAN_OFFICER,
        UserRole.RISK_ANALYST,
        UserRole.ADMIN,
        UserRole.OPERATIONS,
    )
    if not is_staff and application.applicant_id != current_user.id:
        return error_response(
            code="ACCESS_FORBIDDEN",
            message="You do not have permission to view documents for this application.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    doc_result = await db.execute(
        select(ApplicationDocument)
        .where(ApplicationDocument.application_id == app_id)
        .order_by(ApplicationDocument.uploaded_at.desc())
    )
    documents = doc_result.scalars().all()

    # MED-02 Fix: Concurrently generate download URLs
    download_urls = await asyncio.gather(
        *[storage_service.generate_presigned_download_url(doc.storage_path) for doc in documents]
    )
    dtos = []
    for doc, url in zip(documents, download_urls, strict=True):
        dto = DocumentResponse.model_validate(doc).model_dump()
        dto["download_url"] = url
        dtos.append(dto)

    return success_response(data=dtos)


@router.get(
    "/applications/{app_id}/documents/checklist",
    summary="Get Document Verification Checklist",
    description="Returns required checklist status comparing product specifications against verified attachments.",
)
async def get_document_checklist(
    app_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Evaluate document compliance status against loan product requirements."""
    result = await db.execute(select(LoanApplication).where(LoanApplication.id == app_id))
    application = result.scalar_one_or_none()
    if not application:
        return error_response(
            code="APPLICATION_NOT_FOUND",
            message="Application does not exist.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    is_staff = current_user.role in (
        UserRole.LOAN_OFFICER,
        UserRole.RISK_ANALYST,
        UserRole.ADMIN,
        UserRole.OPERATIONS,
    )
    if not is_staff and application.applicant_id != current_user.id:
        return error_response(
            code="ACCESS_FORBIDDEN",
            message="You do not have permission to view this application's checklist.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    prod_result = await db.execute(
        select(LoanProduct).where(LoanProduct.id == application.product_id)
    )
    product = prod_result.scalar_one_or_none()
    required_docs: List[str] = product.required_documents if product else []

    doc_result = await db.execute(
        select(ApplicationDocument)
        .where(ApplicationDocument.application_id == app_id)
        .order_by(ApplicationDocument.uploaded_at.desc())
    )
    documents = doc_result.scalars().all()

    verified_types = {
        d.document_type.value
        for d in documents
        if d.verification_status == DocumentVerificationStatus.VERIFIED
    }
    missing_docs = [req for req in required_docs if req not in verified_types]
    all_verified = len(missing_docs) == 0 and len(required_docs) > 0

    download_urls = await asyncio.gather(
        *[storage_service.generate_presigned_download_url(doc.storage_path) for doc in documents]
    )
    doc_dtos: List[DocumentResponse] = []
    for doc, url in zip(documents, download_urls, strict=True):
        dto = DocumentResponse.model_validate(doc)
        dto.download_url = url
        doc_dtos.append(dto)

    checklist = DocumentChecklistResponse(
        application_id=application.id,
        required_documents=required_docs,
        verified_documents=sorted(list(verified_types)),
        missing_documents=missing_docs,
        all_verified=all_verified,
        documents=doc_dtos,
    )
    return success_response(data=checklist.model_dump())


@router.post(
    "/documents/{doc_id}/verify",
    summary="Verify or Flag Document",
    description="Loan officer marks a document VERIFIED, DEFICIENT, or REJECTED with audit recording and automated FSM advancement.",
)
async def verify_document(
    doc_id: uuid.UUID,
    payload: DocumentVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LOAN_OFFICER, UserRole.ADMIN])),
) -> JSONResponse:
    """Execute loan officer verification check on a document attachment."""
    result = await db.execute(select(ApplicationDocument).where(ApplicationDocument.id == doc_id))
    document = result.scalar_one_or_none()
    if not document:
        return error_response(
            code="DOCUMENT_NOT_FOUND",
            message="Document does not exist.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Enforce non-empty justification for DEFICIENT or REJECTED outcomes
    if payload.verification_status in (
        DocumentVerificationStatus.DEFICIENT,
        DocumentVerificationStatus.REJECTED,
    ) and (not payload.verification_remarks or not payload.verification_remarks.strip()):
        return error_response(
            code="REMARKS_MANDATORY",
            message="Verification remarks are mandatory when marking a document DEFICIENT or REJECTED.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    app_result = await db.execute(
        select(LoanApplication).where(LoanApplication.id == document.application_id)
    )
    application = app_result.scalar_one_or_none()
    if not application:
        return error_response(
            code="APPLICATION_NOT_FOUND",
            message="Associated application does not exist.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # MED-01 Fix: Restrict document verification to active operational review states
    if application.status in (
        ApplicationStatus.DRAFT,
        ApplicationStatus.REJECTED,
        ApplicationStatus.DISBURSED,
    ):
        return error_response(
            code="ILLEGAL_MUTATION",
            message=f"Cannot verify documents for application in '{application.status.value}' status.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    prior_status = document.verification_status
    document.verification_status = payload.verification_status
    document.verified_by = current_user.id
    document.verification_remarks = (
        payload.verification_remarks.strip() if payload.verification_remarks else None
    )
    document.verified_at = utc_now()

    await record_audit_event(
        session=db,
        event_type=f"DOCUMENT_{payload.verification_status.value}",
        entity_name="application_documents",
        entity_id=document.id,
        actor_id=current_user.id,
        actor_role=current_user.role.value,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        prior_state={"verification_status": prior_status.value},
        subsequent_state={"verification_status": document.verification_status.value},
        metadata_snapshot={
            "application_id": str(application.id),
            "document_type": document.document_type.value,
            "remarks": document.verification_remarks,
        },
    )

    try:
        # MED-03 Fix: If application is in SUBMITTED, transition to UNDER_REVIEW first
        if application.status == ApplicationStatus.SUBMITTED:
            await execute_transition(
                session=db,
                application=application,
                target_status=ApplicationStatus.UNDER_REVIEW,
                actor_id=current_user.id,
                actor_role=current_user.role,
                reason="Initiating document verification review",
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )

        # Lifecycle FSM Trigger 1: If document is DEFICIENT and app is UNDER_REVIEW, transition to DOCUMENTS_PENDING
        if (
            payload.verification_status == DocumentVerificationStatus.DEFICIENT
            and application.status == ApplicationStatus.UNDER_REVIEW
        ):
            await execute_transition(
                session=db,
                application=application,
                target_status=ApplicationStatus.DOCUMENTS_PENDING,
                actor_id=current_user.id,
                actor_role=current_user.role,
                reason=f"Document '{document.document_type.value}' flagged DEFICIENT: {document.verification_remarks}",
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )

        # Lifecycle FSM Trigger 2: If document is VERIFIED, evaluate if ALL mandatory product documents are verified
        elif payload.verification_status == DocumentVerificationStatus.VERIFIED:
            prod_result = await db.execute(
                select(LoanProduct).where(LoanProduct.id == application.product_id)
            )
            product = prod_result.scalar_one_or_none()
            if product and product.required_documents:
                # Query all documents for this application
                all_docs_res = await db.execute(
                    select(ApplicationDocument).where(
                        ApplicationDocument.application_id == application.id
                    )
                )
                all_docs = all_docs_res.scalars().all()
                verified_types = {
                    d.document_type.value
                    for d in all_docs
                    if d.verification_status == DocumentVerificationStatus.VERIFIED
                }
                # Add currently verified document type
                verified_types.add(document.document_type.value)

                required_set = set(product.required_documents)
                if required_set.issubset(verified_types):
                    # All mandatory checklist documents are verified!
                    if application.status == ApplicationStatus.DOCUMENTS_PENDING:
                        # Move to UNDER_REVIEW first
                        await execute_transition(
                            session=db,
                            application=application,
                            target_status=ApplicationStatus.UNDER_REVIEW,
                            actor_id=current_user.id,
                            actor_role=current_user.role,
                            reason="All previously deficient documents re-submitted and verified",
                            ip_address=request.client.host if request.client else None,
                            user_agent=request.headers.get("user-agent"),
                        )

                    if application.status == ApplicationStatus.UNDER_REVIEW:
                        await execute_transition(
                            session=db,
                            application=application,
                            target_status=ApplicationStatus.DOCUMENTS_VERIFIED,
                            actor_id=current_user.id,
                            actor_role=current_user.role,
                            reason="All mandatory product checklist documents verified by loan officer",
                            ip_address=request.client.host if request.client else None,
                            user_agent=request.headers.get("user-agent"),
                        )

        await db.commit()
        await db.refresh(document)
    except IllegalStateTransitionError as exc:
        await db.rollback()
        return error_response(
            code="ILLEGAL_STATE_TRANSITION",
            message=exc.message,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    download_url = await storage_service.generate_presigned_download_url(document.storage_path)
    dto = DocumentResponse.model_validate(document).model_dump()
    dto["download_url"] = download_url
    return success_response(data=dto)
