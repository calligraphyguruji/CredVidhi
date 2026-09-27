"""Loan Application Pydantic Schemas and DTOs."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.application import ApplicationStatus


class ApplicationCreateRequest(BaseModel):
    """Initial loan application draft creation schema."""

    product_id: uuid.UUID
    requested_amount: Decimal = Field(..., gt=0, description="Principal amount requested in INR")
    requested_tenor_months: int = Field(..., gt=0, description="Repayment duration in months")
    purpose: Optional[str] = Field(None, max_length=500)


class ApplicationUpdateDraftRequest(BaseModel):
    """Draft application update schema before submission."""

    requested_amount: Optional[Decimal] = Field(None, gt=0)
    requested_tenor_months: Optional[int] = Field(None, gt=0)
    purpose: Optional[str] = Field(None, max_length=500)
    applicant_personal_snapshot: Optional[Dict[str, Any]] = None
    applicant_financial_snapshot: Optional[Dict[str, Any]] = None


class ApplicationTransitionRequest(BaseModel):
    """Manual lifecycle status transition request."""

    target_status: ApplicationStatus
    reason: Optional[str] = Field(
        None, max_length=500, description="Mandatory for rejections or exceptions"
    )


class ApplicationDetailResponse(BaseModel):
    """Comprehensive application response."""

    id: uuid.UUID
    reference_number: str
    applicant_id: uuid.UUID
    product_id: uuid.UUID
    assigned_officer_id: Optional[uuid.UUID] = None
    status: ApplicationStatus
    requested_amount: Decimal
    requested_tenor_months: int
    purpose: Optional[str] = None
    applicant_personal_snapshot: Optional[Dict[str, Any]] = None
    applicant_financial_snapshot: Optional[Dict[str, Any]] = None
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApplicationSummaryResponse(BaseModel):
    """Lightweight summary schema tailored for queue grids."""

    id: uuid.UUID
    reference_number: str
    applicant_id: uuid.UUID
    product_id: uuid.UUID
    status: ApplicationStatus
    requested_amount: Decimal
    requested_tenor_months: int
    submitted_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
