"""Underwriting and Financial Risk Engine API Endpoints.

Handles quantitative risk assessment execution, amortization schedule generation,
underwriting review inspection, and formal credit decision recording.
"""

import logging
import uuid

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.responses import error_response, success_response
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.application import ApplicationStatus, LoanApplication
from app.models.base import utc_now
from app.models.decision import DecisionType, LoanDecision
from app.models.user import User, UserRole
from app.schemas.underwriting import (
    AmortizationRowSchema,
    RiskAssessmentResponseSchema,
    UnderwritingDecisionRequestSchema,
    UnderwritingDecisionResponseSchema,
)
from app.services.audit_service import record_audit_event
from app.services.financial_engine import generate_amortization_schedule
from app.services.fsm_service import (
    IllegalStateTransitionError,
    execute_transition,
)
from app.services.risk_service import (
    SUPERVISOR_APPROVAL_THRESHOLD,
    assess_and_persist_risk,
)

logger = logging.getLogger("underwriting_api")
router = APIRouter(prefix="/applications", tags=["Underwriting & Risk Engine"])


@router.post(
    "/{app_id}/evaluate",
    summary="Evaluate Quantitative Financial Risk",
    description="Calculates compound EMI, DTI ratio, disposable surplus, internal score, and persists RiskAssessment.",
)
async def evaluate_application_risk(
    app_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.RISK_ANALYST, UserRole.ADMIN])),
) -> JSONResponse:
    """Execute deterministic underwriting risk evaluation."""
    stmt = (
        select(LoanApplication)
        .where(LoanApplication.id == app_id)
        .options(
            selectinload(LoanApplication.product),
            selectinload(LoanApplication.risk_assessment),
        )
    )
    res = await db.execute(stmt)
    application = res.scalar_one_or_none()
    if not application:
        return error_response(
            code="APPLICATION_NOT_FOUND",
            message=f"Loan application '{app_id}' was not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Risk evaluation is permitted only once documents are verified or if already assessed
    if application.status not in (
        ApplicationStatus.DOCUMENTS_VERIFIED,
        ApplicationStatus.RISK_ASSESSED,
    ):
        return error_response(
            code="ILLEGAL_APPLICATION_STATE",
            message=(
                f"Cannot evaluate risk for application in '{application.status.value}' state. "
                "All mandatory documents must first be verified (DOCUMENTS_VERIFIED)."
            ),
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        assessment = await assess_and_persist_risk(
            session=db,
            application_id=app_id,
            actor=current_user,
            ip_address=client_ip,
            user_agent=user_agent,
        )
        await db.commit()
        await db.refresh(assessment)
    except IllegalStateTransitionError as e:
        await db.rollback()
        return error_response(
            code="ILLEGAL_STATE_TRANSITION",
            message=e.message,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Error evaluating risk for application {app_id}: {e}", exc_info=True)
        return error_response(
            code="EVALUATION_FAILED",
            message="Internal error during financial risk assessment.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Build response with amortization schedule preview
    amort_raw = generate_amortization_schedule(
        principal=application.requested_amount,
        annual_rate=application.product.base_apr,
        tenor_months=application.requested_tenor_months,
    )
    amort_preview = [AmortizationRowSchema.model_validate(row) for row in amort_raw]

    response_data = RiskAssessmentResponseSchema(
        id=assessment.id,
        application_id=assessment.application_id,
        calculated_dti=assessment.calculated_dti,
        calculated_emi=assessment.calculated_emi,
        disposable_income=assessment.disposable_income,
        internal_risk_score=assessment.internal_risk_score,
        risk_tier=assessment.risk_tier,
        recommendation=assessment.recommendation,
        score_factors_breakdown=assessment.score_factors_breakdown,
        evaluated_at=assessment.evaluated_at,
        amortization_preview=amort_preview,
    )

    return success_response(
        data=response_data.model_dump(),
        status_code=status.HTTP_200_OK,
    )


@router.get(
    "/{app_id}/assessment",
    summary="Get Financial Risk Assessment",
    description="Retrieves the detailed risk assessment, score breakdown, and amortization schedule.",
)
async def get_risk_assessment(
    app_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Retrieve financial risk analysis."""
    stmt = (
        select(LoanApplication)
        .where(LoanApplication.id == app_id)
        .options(
            selectinload(LoanApplication.product),
            selectinload(LoanApplication.risk_assessment),
        )
    )
    res = await db.execute(stmt)
    application = res.scalar_one_or_none()
    if not application:
        return error_response(
            code="APPLICATION_NOT_FOUND",
            message=f"Loan application '{app_id}' was not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Access control: Applicant can only inspect their own application
    if current_user.role == UserRole.APPLICANT and application.applicant_id != current_user.id:
        return error_response(
            code="FORBIDDEN_RESOURCE",
            message="You do not have permission to view this risk assessment.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    assessment = application.risk_assessment
    if not assessment:
        return error_response(
            code="ASSESSMENT_NOT_FOUND",
            message="Risk assessment has not yet been executed for this application.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    amort_raw = generate_amortization_schedule(
        principal=application.requested_amount,
        annual_rate=application.product.base_apr,
        tenor_months=application.requested_tenor_months,
    )
    amort_preview = [AmortizationRowSchema.model_validate(row) for row in amort_raw]

    response_data = RiskAssessmentResponseSchema(
        id=assessment.id,
        application_id=assessment.application_id,
        calculated_dti=assessment.calculated_dti,
        calculated_emi=assessment.calculated_emi,
        disposable_income=assessment.disposable_income,
        internal_risk_score=assessment.internal_risk_score,
        risk_tier=assessment.risk_tier,
        recommendation=assessment.recommendation,
        score_factors_breakdown=assessment.score_factors_breakdown,
        evaluated_at=assessment.evaluated_at,
        amortization_preview=amort_preview,
    )

    return success_response(data=response_data.model_dump())


@router.post(
    "/{app_id}/decision",
    summary="Record Underwriting Decision",
    description="Underwriter records formal approval, rejection, or conditional offer.",
)
async def record_underwriting_decision(
    app_id: uuid.UUID,
    payload: UnderwritingDecisionRequestSchema,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.RISK_ANALYST, UserRole.ADMIN])),
) -> JSONResponse:
    """Record formal binding underwriting decision and advance lifecycle state."""
    stmt = (
        select(LoanApplication)
        .where(LoanApplication.id == app_id)
        .with_for_update()
        .options(
            selectinload(LoanApplication.product),
            selectinload(LoanApplication.decision),
        )
    )
    res = await db.execute(stmt)
    application = res.scalar_one_or_none()
    if not application:
        return error_response(
            code="APPLICATION_NOT_FOUND",
            message=f"Loan application '{app_id}' was not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Decision can only be made on applications in RISK_ASSESSED status
    if application.status != ApplicationStatus.RISK_ASSESSED:
        return error_response(
            code="ILLEGAL_APPLICATION_STATE",
            message=(
                f"Cannot record decision for application in '{application.status.value}' state. "
                "Application must be in RISK_ASSESSED state."
            ),
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    product = application.product
    if not product:
        return error_response(
            code="PRODUCT_NOT_FOUND",
            message="Associated loan product not found.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Product terms boundary check for approvals
    if payload.decision in (DecisionType.APPROVED, DecisionType.CONDITIONAL):
        approved_amt = payload.approved_amount or application.requested_amount
        approved_tenor = payload.approved_tenor_months or application.requested_tenor_months

        if approved_amt < product.min_amount or approved_amt > product.max_amount:
            return error_response(
                code="INVALID_OFFER_TERMS",
                message=(
                    f"Approved amount {approved_amt} must be between "
                    f"{product.min_amount} and {product.max_amount}."
                ),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if approved_tenor < product.min_tenor_months or approved_tenor > product.max_tenor_months:
            return error_response(
                code="INVALID_OFFER_TERMS",
                message=(
                    f"Approved tenor {approved_tenor} months must be between "
                    f"{product.min_tenor_months} and {product.max_tenor_months}."
                ),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # High-value escalation guard (> 5,000,000 INR strictly requires ADMIN role)
        if approved_amt > SUPERVISOR_APPROVAL_THRESHOLD and current_user.role != UserRole.ADMIN:
            return error_response(
                code="SUPERVISOR_ESCALATION_REQUIRED",
                message=(
                    f"Loans exceeding ₹{SUPERVISOR_APPROVAL_THRESHOLD:,.2f} require "
                    "formal supervisor escalation and ADMIN authorization."
                ),
                status_code=status.HTTP_403_FORBIDDEN,
            )

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    target_status = (
        ApplicationStatus.APPROVED
        if payload.decision in (DecisionType.APPROVED, DecisionType.CONDITIONAL)
        else ApplicationStatus.REJECTED
    )

    try:
        # 1. Advance lifecycle status via FSM service
        await execute_transition(
            session=db,
            application=application,
            target_status=target_status,
            actor_id=current_user.id,
            actor_role=current_user.role,
            reason=payload.underwriter_notes or payload.rejection_reason_code,
            metadata={
                "decision": payload.decision.value,
                "approved_amount": str(payload.approved_amount)
                if payload.approved_amount
                else None,
                "approved_apr": str(payload.approved_apr) if payload.approved_apr else None,
                "approved_tenor_months": payload.approved_tenor_months,
                "rejection_reason_code": payload.rejection_reason_code,
            },
            ip_address=client_ip,
            user_agent=user_agent,
        )

        # 2. Persist LoanDecision record
        decision_record = application.decision
        if decision_record is None:
            decision_record = LoanDecision(
                id=uuid.uuid4(),
                application_id=application.id,
                underwriter_id=current_user.id,
                decision=payload.decision,
                approved_amount=payload.approved_amount,
                approved_apr=payload.approved_apr,
                approved_tenor_months=payload.approved_tenor_months,
                rejection_reason_code=payload.rejection_reason_code,
                underwriter_notes=payload.underwriter_notes,
                decided_at=utc_now(),
            )
            db.add(decision_record)
        else:
            decision_record.underwriter_id = current_user.id
            decision_record.decision = payload.decision
            decision_record.approved_amount = payload.approved_amount
            decision_record.approved_apr = payload.approved_apr
            decision_record.approved_tenor_months = payload.approved_tenor_months
            decision_record.rejection_reason_code = payload.rejection_reason_code
            decision_record.underwriter_notes = payload.underwriter_notes
            decision_record.decided_at = utc_now()

        # 3. Explicit DECISION_RECORDED audit compliance log
        await record_audit_event(
            session=db,
            event_type="DECISION_RECORDED",
            entity_name="loan_decisions",
            entity_id=decision_record.id,
            actor_id=current_user.id,
            actor_role=current_user.role.value,
            ip_address=client_ip,
            user_agent=user_agent,
            subsequent_state={
                "application_id": str(application.id),
                "decision": decision_record.decision.value,
                "approved_amount": str(decision_record.approved_amount)
                if decision_record.approved_amount
                else None,
                "approved_apr": str(decision_record.approved_apr)
                if decision_record.approved_apr
                else None,
                "approved_tenor_months": decision_record.approved_tenor_months,
                "rejection_reason_code": decision_record.rejection_reason_code,
            },
        )

        await db.commit()
        await db.refresh(decision_record)
    except IllegalStateTransitionError as e:
        await db.rollback()
        return error_response(
            code="ILLEGAL_STATE_TRANSITION",
            message=e.message,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Error recording decision for application {app_id}: {e}", exc_info=True)
        return error_response(
            code="DECISION_FAILED",
            message="Internal error while recording underwriting decision.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    response_data = UnderwritingDecisionResponseSchema.model_validate(decision_record)
    return success_response(
        data=response_data.model_dump(),
        status_code=status.HTTP_200_OK,
    )


@router.get(
    "/{app_id}/decision",
    summary="Get Underwriting Decision",
    description="Retrieves the recorded formal underwriting decision record.",
)
async def get_underwriting_decision(
    app_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Retrieve underwriting decision details."""
    stmt = (
        select(LoanApplication)
        .where(LoanApplication.id == app_id)
        .options(selectinload(LoanApplication.decision))
    )
    res = await db.execute(stmt)
    application = res.scalar_one_or_none()
    if not application:
        return error_response(
            code="APPLICATION_NOT_FOUND",
            message=f"Loan application '{app_id}' was not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    if current_user.role == UserRole.APPLICANT and application.applicant_id != current_user.id:
        return error_response(
            code="FORBIDDEN_RESOURCE",
            message="You do not have permission to view this decision.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    if not application.decision:
        return error_response(
            code="DECISION_NOT_FOUND",
            message="No decision has been recorded yet for this application.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    response_dict = UnderwritingDecisionResponseSchema.model_validate(
        application.decision
    ).model_dump()
    if current_user.role == UserRole.APPLICANT:
        response_dict["underwriter_notes"] = None
    return success_response(data=response_dict)
