"""Loan Application Lifecycle Endpoints."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.responses import error_response, success_response
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.application import ApplicationStatus, LoanApplication
from app.models.loan_product import LoanProduct
from app.models.user import User, UserRole
from app.schemas.application import (
    ApplicationCreateRequest,
    ApplicationDetailResponse,
    ApplicationTransitionRequest,
    ApplicationUpdateDraftRequest,
)
from app.services.fsm_service import IllegalStateTransitionError, execute_transition

router = APIRouter(prefix="/applications", tags=["Loan Applications"])


def generate_reference_number() -> str:
    """Generate canonical institutional loan reference number: CV-YYYYMM-XXXXXXXX."""
    now = datetime.now(timezone.utc)
    short_suffix = uuid.uuid4().hex[:8].upper()
    return f"CV-{now.strftime('%Y%m')}-{short_suffix}"


@router.post(
    "",
    summary="Initialize New Loan Application",
    description="Creates a fresh loan application draft linked to the authenticated applicant.",
)
async def create_application(
    payload: ApplicationCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.APPLICANT, UserRole.ADMIN])),
) -> JSONResponse:
    """Create new draft loan application."""
    # Verify product eligibility
    result = await db.execute(
        select(LoanProduct).where(
            LoanProduct.id == payload.product_id, LoanProduct.is_active.is_(True)
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        return error_response(
            code="PRODUCT_NOT_FOUND",
            message="Selected loan product is invalid or inactive.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Validate financial limits
    if (
        payload.requested_amount < product.min_amount
        or payload.requested_amount > product.max_amount
    ):
        return error_response(
            code="INVALID_AMOUNT",
            message=(
                f"Requested amount must be between ₹{product.min_amount:,.2f} "
                f"and ₹{product.max_amount:,.2f}."
            ),
            details={
                "min_amount": product.min_amount,
                "max_amount": product.max_amount,
            },
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    if (
        payload.requested_tenor_months < product.min_tenor_months
        or payload.requested_tenor_months > product.max_tenor_months
    ):
        return error_response(
            code="INVALID_TENOR",
            message=(
                f"Requested tenor must be between {product.min_tenor_months} "
                f"and {product.max_tenor_months} months."
            ),
            details={
                "min_tenor_months": product.min_tenor_months,
                "max_tenor_months": product.max_tenor_months,
            },
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    temp_reference = f"DRAFT-{uuid.uuid4().hex[:8].upper()}"
    new_app = LoanApplication(
        id=uuid.uuid4(),
        reference_number=temp_reference,
        applicant_id=current_user.id,
        product_id=product.id,
        status=ApplicationStatus.DRAFT,
        requested_amount=payload.requested_amount,
        requested_tenor_months=payload.requested_tenor_months,
        purpose=payload.purpose.strip() if payload.purpose else None,
    )

    db.add(new_app)
    await db.commit()
    await db.refresh(new_app)

    dto = ApplicationDetailResponse.model_validate(new_app).model_dump()
    return success_response(data=dto, status_code=status.HTTP_201_CREATED)


@router.put(
    "/{app_id}/draft",
    summary="Update Application Draft",
    description="Updates draft application details and snapshots before submission.",
)
async def update_draft(
    app_id: uuid.UUID,
    payload: ApplicationUpdateDraftRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Save draft application progress."""
    result = await db.execute(select(LoanApplication).where(LoanApplication.id == app_id))
    application = result.scalar_one_or_none()
    if not application:
        return error_response(
            code="APPLICATION_NOT_FOUND",
            message="Application does not exist.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Permission check: Only owner or admin can edit draft
    if application.applicant_id != current_user.id and current_user.role != UserRole.ADMIN:
        return error_response(
            code="ACCESS_FORBIDDEN",
            message="You do not have permission to modify this application.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    if application.status != ApplicationStatus.DRAFT:
        return error_response(
            code="ILLEGAL_MUTATION",
            message="Cannot update an application that has already been submitted.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Validate financial bounds if loan terms are being mutated
    if payload.requested_amount is not None or payload.requested_tenor_months is not None:
        prod_result = await db.execute(
            select(LoanProduct).where(LoanProduct.id == application.product_id)
        )
        product = prod_result.scalar_one_or_none()
        if product:
            new_amount = (
                payload.requested_amount
                if payload.requested_amount is not None
                else application.requested_amount
            )
            new_tenor = (
                payload.requested_tenor_months
                if payload.requested_tenor_months is not None
                else application.requested_tenor_months
            )

            if new_amount < product.min_amount or new_amount > product.max_amount:
                return error_response(
                    code="INVALID_AMOUNT",
                    message=(
                        f"Requested amount must be between ₹{product.min_amount:,.2f} "
                        f"and ₹{product.max_amount:,.2f}."
                    ),
                    details={
                        "min_amount": product.min_amount,
                        "max_amount": product.max_amount,
                    },
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

            if new_tenor < product.min_tenor_months or new_tenor > product.max_tenor_months:
                return error_response(
                    code="INVALID_TENOR",
                    message=(
                        f"Requested tenor must be between {product.min_tenor_months} "
                        f"and {product.max_tenor_months} months."
                    ),
                    details={
                        "min_tenor_months": product.min_tenor_months,
                        "max_tenor_months": product.max_tenor_months,
                    },
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

    if payload.requested_amount is not None:
        application.requested_amount = payload.requested_amount
    if payload.requested_tenor_months is not None:
        application.requested_tenor_months = payload.requested_tenor_months
    if payload.purpose is not None:
        application.purpose = payload.purpose
    if payload.applicant_personal_snapshot is not None:
        application.applicant_personal_snapshot = payload.applicant_personal_snapshot
    if payload.applicant_financial_snapshot is not None:
        application.applicant_financial_snapshot = payload.applicant_financial_snapshot

    await db.commit()
    await db.refresh(application)

    dto = ApplicationDetailResponse.model_validate(application).model_dump()
    return success_response(data=dto)


@router.post(
    "/{app_id}/submit",
    summary="Submit Loan Application",
    description="Transitions an application from DRAFT to SUBMITTED and issues an official reference number.",
)
async def submit_application(
    app_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Submit application for institutional processing."""
    result = await db.execute(select(LoanApplication).where(LoanApplication.id == app_id))
    application = result.scalar_one_or_none()
    if not application:
        return error_response(
            code="APPLICATION_NOT_FOUND",
            message="Application does not exist.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    if application.applicant_id != current_user.id and current_user.role != UserRole.ADMIN:
        return error_response(
            code="ACCESS_FORBIDDEN",
            message="You can only submit your own loan applications.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    # Assign canonical institutional reference number upon formal submission
    if application.reference_number.startswith("DRAFT-"):
        application.reference_number = generate_reference_number()

    try:
        await execute_transition(
            session=db,
            application=application,
            target_status=ApplicationStatus.SUBMITTED,
            actor_id=current_user.id,
            actor_role=current_user.role,
            reason="Formally submitted by applicant",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
        await db.refresh(application)
    except IllegalStateTransitionError as exc:
        await db.rollback()
        return error_response(
            code="ILLEGAL_STATE_TRANSITION",
            message=exc.message,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    dto = ApplicationDetailResponse.model_validate(application).model_dump()
    return success_response(data=dto)


@router.get(
    "/{app_id}",
    summary="Get Loan Application Details",
    description="Returns full application metadata for owner applicant or institutional staff.",
)
async def get_application(
    app_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Retrieve application details."""
    result = await db.execute(select(LoanApplication).where(LoanApplication.id == app_id))
    application = result.scalar_one_or_none()
    if not application:
        return error_response(
            code="APPLICATION_NOT_FOUND",
            message="Application does not exist.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Access check: Applicant can only access own, staff can access all
    is_staff = current_user.role in (
        UserRole.LOAN_OFFICER,
        UserRole.RISK_ANALYST,
        UserRole.ADMIN,
        UserRole.OPERATIONS,
    )
    if not is_staff and application.applicant_id != current_user.id:
        return error_response(
            code="ACCESS_FORBIDDEN",
            message="You do not have permission to view this application.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    dto = ApplicationDetailResponse.model_validate(application).model_dump()
    return success_response(data=dto)


@router.post(
    "/{app_id}/transition",
    summary="Trigger Manual Status Transition",
    description="Executes a verified lifecycle transition governed by the FSM rules.",
)
async def transition_application_status(
    app_id: uuid.UUID,
    payload: ApplicationTransitionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Transition application to next lifecycle state."""
    result = await db.execute(select(LoanApplication).where(LoanApplication.id == app_id))
    application = result.scalar_one_or_none()
    if not application:
        return error_response(
            code="APPLICATION_NOT_FOUND",
            message="Application does not exist.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # IDOR Protection: Applicant can only trigger transitions on their own applications
    if current_user.role == UserRole.APPLICANT and application.applicant_id != current_user.id:
        return error_response(
            code="ACCESS_FORBIDDEN",
            message="You do not have permission to transition this application.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    try:
        await execute_transition(
            session=db,
            application=application,
            target_status=payload.target_status,
            actor_id=current_user.id,
            actor_role=current_user.role,
            reason=payload.reason,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
        await db.refresh(application)
    except IllegalStateTransitionError as exc:
        await db.rollback()
        return error_response(
            code="ILLEGAL_STATE_TRANSITION",
            message=exc.message,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    dto = ApplicationDetailResponse.model_validate(application).model_dump()
    return success_response(data=dto)


@router.post(
    "/{app_id}/cancel",
    summary="Cancel Application",
    description="Cancels an application in DRAFT, SUBMITTED, or UNDER_REVIEW status.",
)
async def cancel_application(
    app_id: uuid.UUID,
    request: Request,
    reason: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Cancel an active application."""
    result = await db.execute(select(LoanApplication).where(LoanApplication.id == app_id))
    application = result.scalar_one_or_none()
    if not application:
        return error_response(
            code="APPLICATION_NOT_FOUND",
            message="Application does not exist.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Only owner applicant or admin/officer can cancel
    if application.applicant_id != current_user.id and current_user.role not in (
        UserRole.ADMIN,
        UserRole.LOAN_OFFICER,
    ):
        return error_response(
            code="ACCESS_FORBIDDEN",
            message="You do not have permission to cancel this application.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    cancellation_reason = reason.strip() if reason and reason.strip() else "Cancelled by applicant"

    try:
        await execute_transition(
            session=db,
            application=application,
            target_status=ApplicationStatus.REJECTED,
            actor_id=current_user.id,
            actor_role=current_user.role,
            reason=cancellation_reason,
            metadata={"cancelled": True},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
        await db.refresh(application)
    except IllegalStateTransitionError as exc:
        await db.rollback()
        return error_response(
            code="ILLEGAL_STATE_TRANSITION",
            message=exc.message,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    dto = ApplicationDetailResponse.model_validate(application).model_dump()
    return success_response(data=dto)
