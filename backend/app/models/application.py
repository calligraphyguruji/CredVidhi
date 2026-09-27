"""Loan Application Entity and Lifecycle Status Transitions."""

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from app.models.decision import LoanDecision
    from app.models.document import ApplicationDocument
    from app.models.loan_product import LoanProduct
    from app.models.risk_assessment import RiskAssessment
    from app.models.user import User


class ApplicationStatus(str, enum.Enum):
    """Finite State Machine Loan Lifecycle statuses."""

    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    DOCUMENTS_PENDING = "DOCUMENTS_PENDING"
    DOCUMENTS_VERIFIED = "DOCUMENTS_VERIFIED"
    RISK_ASSESSED = "RISK_ASSESSED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    DISBURSED = "DISBURSED"


class LoanApplication(Base, TimestampMixin):
    """Core loan application tracking lifecycle from submission to disbursement."""

    __tablename__ = "loan_applications"

    id: Mapped[uuid_pk]
    reference_number: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    applicant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("loan_products.id"), nullable=False, index=True
    )
    assigned_officer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )

    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, native_enum=False, length=50),
        default=ApplicationStatus.DRAFT,
        nullable=False,
        index=True,
    )

    requested_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    requested_tenor_months: Mapped[int] = mapped_column(nullable=False)
    purpose: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Auditable historical borrower snapshots at time of submission
    applicant_personal_snapshot: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON, nullable=True
    )
    applicant_financial_snapshot: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON, nullable=True
    )

    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    applicant: Mapped["User"] = relationship("User", foreign_keys=[applicant_id])
    assigned_officer: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[assigned_officer_id]
    )
    product: Mapped["LoanProduct"] = relationship("LoanProduct")
    documents: Mapped[List["ApplicationDocument"]] = relationship(
        "ApplicationDocument", back_populates="application", cascade="all, delete-orphan"
    )
    risk_assessment: Mapped[Optional["RiskAssessment"]] = relationship(
        "RiskAssessment", back_populates="application", uselist=False, cascade="all, delete-orphan"
    )
    decision: Mapped[Optional["LoanDecision"]] = relationship(
        "LoanDecision", back_populates="application", uselist=False, cascade="all, delete-orphan"
    )
