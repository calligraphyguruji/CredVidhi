"""Financial Risk Assessment and Underwriting Engine Output Entity."""

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Dict, Optional

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Integer, Numeric, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, utc_now, uuid_pk

if TYPE_CHECKING:
    from app.models.application import LoanApplication


class RiskTier(str, enum.Enum):
    """Institutional underwriting risk grading."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class UnderwritingRecommendation(str, enum.Enum):
    """Automated underwriting recommendation."""

    APPROVE = "APPROVE"
    CONDITIONAL = "CONDITIONAL"
    REJECT = "REJECT"


class RiskAssessment(Base, TimestampMixin):
    """Deterministic mathematical risk evaluation for a loan application."""

    __tablename__ = "risk_assessments"

    id: Mapped[uuid_pk]
    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("loan_applications.id"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Deterministic fixed-point financial outputs
    calculated_dti: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, comment="Debt-To-Income percentage (e.g. 38.50%)"
    )
    calculated_emi: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, comment="Equated Monthly Installment in INR"
    )
    disposable_income: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        comment="Net remaining monthly disposable income",
    )

    internal_risk_score: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Deterministic creditworthiness score (300-900)"
    )
    risk_tier: Mapped[RiskTier] = mapped_column(
        Enum(RiskTier, native_enum=False, length=20), nullable=False
    )
    recommendation: Mapped[UnderwritingRecommendation] = mapped_column(
        Enum(UnderwritingRecommendation, native_enum=False, length=50), nullable=False
    )

    score_factors_breakdown: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # Relationships
    application: Mapped["LoanApplication"] = relationship(
        "LoanApplication", back_populates="risk_assessment"
    )
