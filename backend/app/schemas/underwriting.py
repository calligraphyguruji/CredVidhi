"""Pydantic v2 DTOs for Financial Risk Engine and Underwriting Decisioning."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.decision import DecisionType
from app.models.risk_assessment import RiskTier, UnderwritingRecommendation


class AmortizationRowSchema(BaseModel):
    """Monthly amortization installment row."""

    month: int = Field(..., ge=1)
    payment: Decimal
    principal: Decimal
    interest: Decimal
    remaining_balance: Decimal


class RiskAssessmentResponseSchema(BaseModel):
    """Evaluated risk assessment output snapshot."""

    id: uuid.UUID
    application_id: uuid.UUID
    calculated_dti: Decimal
    calculated_emi: Decimal
    disposable_income: Decimal
    internal_risk_score: int
    risk_tier: RiskTier
    recommendation: UnderwritingRecommendation
    score_factors_breakdown: Optional[Dict[str, Any]] = None
    evaluated_at: datetime
    amortization_preview: Optional[List[AmortizationRowSchema]] = None

    model_config = ConfigDict(from_attributes=True)


class UnderwritingDecisionRequestSchema(BaseModel):
    """Underwriting decision submission payload."""

    decision: DecisionType
    approved_amount: Optional[Decimal] = Field(None, gt=0)
    approved_apr: Optional[Decimal] = Field(None, ge=0)
    approved_tenor_months: Optional[int] = Field(None, gt=0)
    rejection_reason_code: Optional[str] = Field(None, max_length=100)
    underwriter_notes: Optional[str] = Field(None, max_length=2000)

    @model_validator(mode="after")
    def validate_decision_parameters(self) -> "UnderwritingDecisionRequestSchema":
        """Enforce approval terms for approvals and mandatory reason for rejections."""
        if self.decision in (DecisionType.APPROVED, DecisionType.CONDITIONAL):
            if self.approved_amount is None:
                raise ValueError("Approved amount is mandatory for approval decisions.")
            if self.approved_apr is None:
                raise ValueError("Approved APR is mandatory for approval decisions.")
            if self.approved_tenor_months is None:
                raise ValueError("Approved tenor is mandatory for approval decisions.")
        elif self.decision == DecisionType.REJECTED:
            if not self.rejection_reason_code:
                raise ValueError(
                    "Rejection reason code is mandatory when rejecting an application."
                )
            if not self.underwriter_notes or not self.underwriter_notes.strip():
                raise ValueError("Underwriter notes explaining the rejection are mandatory.")
        return self


class UnderwritingDecisionResponseSchema(BaseModel):
    """Recorded formal underwriter decision record."""

    id: uuid.UUID
    application_id: uuid.UUID
    underwriter_id: uuid.UUID
    decision: DecisionType
    approved_amount: Optional[Decimal] = None
    approved_apr: Optional[Decimal] = None
    approved_tenor_months: Optional[int] = None
    rejection_reason_code: Optional[str] = None
    underwriter_notes: Optional[str] = None
    decided_at: datetime

    model_config = ConfigDict(from_attributes=True)
