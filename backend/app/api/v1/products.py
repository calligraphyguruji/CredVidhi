"""Loan Product Catalog API Endpoints."""

import uuid

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.responses import error_response, success_response
from app.database import get_db
from app.dependencies import require_roles
from app.models.loan_product import LoanProduct
from app.models.user import UserRole
from app.schemas.product import LoanProductCreateRequest, LoanProductResponse

router = APIRouter(prefix="/products", tags=["Loan Products"])


@router.get(
    "",
    summary="List Active Loan Products",
    description="Returns list of all available active institutional loan products.",
)
async def list_products(
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Retrieve catalog of available loan products."""
    result = await db.execute(
        select(LoanProduct).where(LoanProduct.is_active.is_(True)).order_by(LoanProduct.name)
    )
    products = result.scalars().all()
    dtos = [LoanProductResponse.model_validate(p).model_dump() for p in products]
    return success_response(data=dtos)


@router.get(
    "/{code}",
    summary="Get Loan Product by Code",
    description="Returns detailed parameters for a specific loan product.",
)
async def get_product_by_code(
    code: str,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Retrieve single loan product by its unique code."""
    result = await db.execute(select(LoanProduct).where(LoanProduct.code == code.upper().strip()))
    product = result.scalar_one_or_none()
    if not product:
        return error_response(
            code="PRODUCT_NOT_FOUND",
            message=f"Loan product with code '{code}' does not exist.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    dto = LoanProductResponse.model_validate(product).model_dump()
    return success_response(data=dto)


@router.post(
    "",
    summary="Create Institutional Loan Product",
    description="Creates a new loan product with boundaries and interest rate. Restricted to ADMIN.",
)
async def create_product(
    payload: LoanProductCreateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: None = Depends(require_roles([UserRole.ADMIN])),
) -> JSONResponse:
    """Create new loan product (Admin only)."""
    # Verify unique code
    existing = await db.execute(
        select(LoanProduct).where(LoanProduct.code == payload.code.upper().strip())
    )
    if existing.scalar_one_or_none():
        return error_response(
            code="PRODUCT_CODE_EXISTS",
            message=f"Product with code '{payload.code}' already exists.",
            status_code=status.HTTP_409_CONFLICT,
        )

    product = LoanProduct(
        id=uuid.uuid4(),
        code=payload.code.upper().strip(),
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        min_amount=payload.min_amount,
        max_amount=payload.max_amount,
        min_tenor_months=payload.min_tenor_months,
        max_tenor_months=payload.max_tenor_months,
        base_apr=payload.base_apr,
        max_dti_ratio=payload.max_dti_ratio,
        required_documents=payload.required_documents,
        is_active=payload.is_active,
    )

    db.add(product)
    try:
        await db.commit()
        await db.refresh(product)
    except IntegrityError:
        await db.rollback()
        return error_response(
            code="PRODUCT_CODE_EXISTS",
            message=f"Product with code '{payload.code}' already exists.",
            status_code=status.HTTP_409_CONFLICT,
        )

    dto = LoanProductResponse.model_validate(product).model_dump()
    return success_response(data=dto, status_code=status.HTTP_201_CREATED)
