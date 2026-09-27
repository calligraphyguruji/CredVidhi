"""Underwriter Final Decision Entity."""

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, utc_now, uuid_pk

if TYPE_CHECKING:
    from app.models.application import LoanApplication
    from app.models.user import User


class DecisionType(str, enum.Enum):
    """Institutional underwriting decisions."""

    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CONDITIONAL = "CONDITIONAL"


class LoanDecision(Base, TimestampMixin):
    """Final, binding loan underwriting decision recorded by an authenticated underwriter."""

    __tablename__ = "loan_decisions"

    id: Mapped[uuid_pk]
    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("loan_applications.id"),
        unique=True,
        nullable=False,
        index=True,
    )
    underwriter_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    decision: Mapped[DecisionType] = mapped_column(
        Enum(DecisionType, native_enum=False, length=50), nullable=False
    )
    approved_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    approved_apr: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    approved_tenor_months: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rejection_reason_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    underwriter_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    decided_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # Relationships
    application: Mapped["LoanApplication"] = relationship(
        "LoanApplication", back_populates="decision"
    )
    underwriter: Mapped["User"] = relationship("User", foreign_keys=[underwriter_id])
