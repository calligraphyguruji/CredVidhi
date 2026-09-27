"""Document Management and Verification Pydantic DTOs."""

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.document import DocumentType, DocumentVerificationStatus


class DocumentPresignRequest(BaseModel):
    """Payload to request presigned upload URL."""

    document_type: DocumentType
    original_filename: str = Field(
        ..., min_length=1, max_length=255, description="Original filename with extension"
    )
    mime_type: str = Field(
        ..., max_length=100, description="Declared MIME type (PDF, JPEG, or PNG)"
    )
    file_size_bytes: int = Field(
        ..., gt=0, le=10_485_760, description="File size in bytes (max 10MB)"
    )


class DocumentPresignResponse(BaseModel):
    """Presigned upload metadata response."""

    upload_url: str
    document_id: uuid.UUID
    storage_path: str
    expires_in_seconds: int = 900


class DocumentConfirmRequest(BaseModel):
    """Payload to register document metadata in database after S3 upload."""

    document_type: DocumentType
    original_filename: str = Field(..., min_length=1, max_length=255)
    storage_path: str = Field(..., max_length=512)
    mime_type: str = Field(..., max_length=100)
    file_size_bytes: int = Field(..., gt=0, le=10_485_760, description="File size in bytes")
    file_hash: Optional[str] = Field(
        None,
        max_length=64,
        pattern=r"^[a-fA-F0-9]{64}$",
        description="SHA-256 integrity hash",
    )


class DocumentVerifyRequest(BaseModel):
    """Loan officer checklist verification payload."""

    verification_status: DocumentVerificationStatus = Field(
        ..., description="Audit outcome: VERIFIED, DEFICIENT, or REJECTED"
    )
    verification_remarks: Optional[str] = Field(
        None, max_length=1000, description="Required justification if DEFICIENT or REJECTED"
    )


class DocumentResponse(BaseModel):
    """Comprehensive document response DTO."""

    id: uuid.UUID
    application_id: uuid.UUID
    document_type: DocumentType
    original_filename: str
    storage_path: str
    mime_type: str
    file_size_bytes: int
    file_hash: Optional[str] = None
    verification_status: DocumentVerificationStatus
    verified_by: Optional[uuid.UUID] = None
    verification_remarks: Optional[str] = None
    download_url: Optional[str] = None
    uploaded_at: datetime
    verified_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DocumentChecklistResponse(BaseModel):
    """Status grid of mandatory product documents vs verified uploads."""

    application_id: uuid.UUID
    required_documents: List[str]
    verified_documents: List[str]
    missing_documents: List[str]
    all_verified: bool
    documents: List[DocumentResponse]
