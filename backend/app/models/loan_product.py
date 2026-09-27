"""Loan Product Catalog Entity.

Governs product-specific eligibility boundaries, interest rates, and required documentation.
"""

from decimal import Decimal
from typing import Any, List, Optional

from sqlalchemy import JSON, Boolean, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, uuid_pk


class LoanProduct(Base, TimestampMixin):
    """Institutional loan product catalog definition."""

    __tablename__ = "loan_products"

    id: Mapped[uuid_pk]
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Financial Boundaries using strict NUMERIC precision
    min_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, comment="Minimum loan principal in INR"
    )
    max_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, comment="Maximum loan principal in INR"
    )
    min_tenor_months: Mapped[int] = mapped_column(nullable=False)
    max_tenor_months: Mapped[int] = mapped_column(nullable=False)
    base_apr: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, comment="Base annual percentage rate"
    )
    max_dti_ratio: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("45.00"),
        comment="Maximum permissible Debt-To-Income percentage",
    )

    # Dynamic document requirements list
    required_documents: Mapped[List[Any]] = mapped_column(JSON, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
