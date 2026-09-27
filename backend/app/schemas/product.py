"""Loan Product Catalog Pydantic DTOs."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class LoanProductCreateRequest(BaseModel):
    """Institutional loan product creation schema."""

    code: str = Field(..., min_length=2, max_length=50, description="e.g. HOME_PRIME")
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    min_amount: Decimal = Field(..., gt=0)
    max_amount: Decimal = Field(..., gt=0)
    min_tenor_months: int = Field(..., gt=0)
    max_tenor_months: int = Field(..., gt=0)
    base_apr: Decimal = Field(..., gt=0, le=100)
    max_dti_ratio: Decimal = Field(default=Decimal("45.00"), gt=0, le=100)
    required_documents: List[Any] = Field(default_factory=list)
    is_active: bool = True

    @model_validator(mode="after")
    def validate_ranges(self) -> "LoanProductCreateRequest":
        """Assert minimum values do not exceed maximum values."""
        if self.min_amount > self.max_amount:
            raise ValueError("min_amount cannot exceed max_amount")
        if self.min_tenor_months > self.max_tenor_months:
            raise ValueError("min_tenor_months cannot exceed max_tenor_months")
        return self


class LoanProductResponse(BaseModel):
    """Catalog loan product output schema."""

    id: uuid.UUID
    code: str
    name: str
    description: Optional[str] = None
    min_amount: Decimal
    max_amount: Decimal
    min_tenor_months: int
    max_tenor_months: int
    base_apr: Decimal
    max_dti_ratio: Decimal
    required_documents: List[Any]
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
