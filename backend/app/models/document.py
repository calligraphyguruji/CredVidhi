"""Application Document and Verification Tracking Entity."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, utc_now, uuid_pk

if TYPE_CHECKING:
    from app.models.application import LoanApplication
    from app.models.user import User


class DocumentType(str, enum.Enum):
    """Institutional document classification types."""

    PAN_CARD = "PAN_CARD"
    AADHAAR_CARD = "AADHAAR_CARD"
    SALARY_SLIP = "SALARY_SLIP"
    BANK_STATEMENT = "BANK_STATEMENT"
    ITR_V = "ITR_V"
    PROPERTY_DEED = "PROPERTY_DEED"
    BUSINESS_REGISTRATION = "BUSINESS_REGISTRATION"
    OTHER = "OTHER"


class DocumentVerificationStatus(str, enum.Enum):
    """Document audit and verification status."""

    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    DEFICIENT = "DEFICIENT"
    REJECTED = "REJECTED"


class ApplicationDocument(Base, TimestampMixin):
    """Auditable document attachment linked to a specific loan application."""

    __tablename__ = "application_documents"

    id: Mapped[uuid_pk]
    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("loan_applications.id"), nullable=False, index=True
    )
    document_type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType, native_enum=False, length=50), nullable=False
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        comment="MinIO / S3 object key with sandboxed UUID prefix",
    )
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    file_hash: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, comment="SHA-256 integrity digest"
    )

    verification_status: Mapped[DocumentVerificationStatus] = mapped_column(
        Enum(DocumentVerificationStatus, native_enum=False, length=50),
        default=DocumentVerificationStatus.PENDING,
        nullable=False,
        index=True,
    )
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    verification_remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    application: Mapped["LoanApplication"] = relationship(
        "LoanApplication", back_populates="documents"
    )
    verifier: Mapped[Optional["User"]] = relationship("User", foreign_keys=[verified_by])
