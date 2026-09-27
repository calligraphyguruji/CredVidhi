"""Role-Segregated Queue Endpoints for Loan Processing Workspaces."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.responses import success_response
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.application import ApplicationStatus, LoanApplication
from app.models.user import User, UserRole
from app.schemas.application import ApplicationSummaryResponse

router = APIRouter(prefix="/queues", tags=["Workflow Queues"])


@router.get(
    "/applicant",
    summary="Borrower Application History Queue",
    description="Returns all applications submitted by the current authenticated borrower.",
)
async def get_applicant_queue(
    limit: int = Query(50, ge=1, le=100, description="Page size limit"),
    offset: int = Query(0, ge=0, description="Page offset"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Retrieve applicant's personal application queue."""
    result = await db.execute(
        select(LoanApplication)
        .where(LoanApplication.applicant_id == current_user.id)
        .order_by(LoanApplication.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    applications = result.scalars().all()
    dtos = [ApplicationSummaryResponse.model_validate(app).model_dump() for app in applications]
    return success_response(data=dtos)


@router.get(
    "/officer",
    summary="Loan Officer Processing Queue",
    description="Returns applications awaiting document checks and initial review (SUBMITTED, UNDER_REVIEW, DOCUMENTS_PENDING).",
)
async def get_officer_queue(
    limit: int = Query(50, ge=1, le=100, description="Page size limit"),
    offset: int = Query(0, ge=0, description="Page offset"),
    db: AsyncSession = Depends(get_db),
    _officer: User = Depends(require_roles([UserRole.LOAN_OFFICER, UserRole.ADMIN])),
) -> JSONResponse:
    """Retrieve queue for loan officers."""
    target_statuses = [
        ApplicationStatus.SUBMITTED,
        ApplicationStatus.UNDER_REVIEW,
        ApplicationStatus.DOCUMENTS_PENDING,
    ]
    result = await db.execute(
        select(LoanApplication)
        .where(LoanApplication.status.in_(target_statuses))
        .order_by(LoanApplication.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    applications = result.scalars().all()
    dtos = [ApplicationSummaryResponse.model_validate(app).model_dump() for app in applications]
    return success_response(data=dtos)


@router.get(
    "/underwriter",
    summary="Risk Underwriting Cockpit Queue",
    description="Returns applications with verified documents ready for quantitative underwriting (DOCUMENTS_VERIFIED, RISK_ASSESSED).",
)
async def get_underwriter_queue(
    limit: int = Query(50, ge=1, le=100, description="Page size limit"),
    offset: int = Query(0, ge=0, description="Page offset"),
    db: AsyncSession = Depends(get_db),
    _underwriter: User = Depends(require_roles([UserRole.RISK_ANALYST, UserRole.ADMIN])),
) -> JSONResponse:
    """Retrieve queue for risk underwriters."""
    target_statuses = [
        ApplicationStatus.DOCUMENTS_VERIFIED,
        ApplicationStatus.RISK_ASSESSED,
    ]
    result = await db.execute(
        select(LoanApplication)
        .where(LoanApplication.status.in_(target_statuses))
        .order_by(LoanApplication.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    applications = result.scalars().all()
    dtos = [ApplicationSummaryResponse.model_validate(app).model_dump() for app in applications]
    return success_response(data=dtos)


@router.get(
    "/disbursement",
    summary="Operations Disbursement Queue",
    description="Returns approved applications ready for final loan disbursement.",
)
async def get_disbursement_queue(
    limit: int = Query(50, ge=1, le=100, description="Page size limit"),
    offset: int = Query(0, ge=0, description="Page offset"),
    db: AsyncSession = Depends(get_db),
    _ops: User = Depends(require_roles([UserRole.OPERATIONS, UserRole.ADMIN])),
) -> JSONResponse:
    """Retrieve queue for operations disbursement team."""
    result = await db.execute(
        select(LoanApplication)
        .where(LoanApplication.status == ApplicationStatus.APPROVED)
        .order_by(LoanApplication.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    applications = result.scalars().all()
    dtos = [ApplicationSummaryResponse.model_validate(app).model_dump() for app in applications]
    return success_response(data=dtos)
