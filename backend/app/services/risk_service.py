"""Deterministic Financial Risk Assessment and Underwriting Service.

Implements rule-based scorecard evaluation, factor extraction, risk tiering,
automated underwriting recommendations, and atomic persistence.
"""

import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.application import ApplicationStatus, LoanApplication
from app.models.base import utc_now
from app.models.loan_product import LoanProduct
from app.models.risk_assessment import (
    RiskAssessment,
    RiskTier,
    UnderwritingRecommendation,
)
from app.models.user import User
from app.services.audit_service import record_audit_event
from app.services.financial_engine import (
    calculate_disposable_income,
    calculate_dti,
    calculate_emi,
)
from app.services.fsm_service import execute_transition

SUPERVISOR_APPROVAL_THRESHOLD = Decimal("5000000.00")  # 50 Lakhs INR


def _safe_decimal(val: Any, default: str) -> Decimal:
    """Safely convert value to Decimal, falling back to default if None, empty, or invalid."""
    if val is None or val == "":
        return Decimal(default)
    try:
        return Decimal(str(val))
    except Exception:
        return Decimal(default)


def _safe_int(val: Any, default: int) -> int:
    """Safely convert value to int, falling back to default if None, empty, or invalid."""
    if val is None or val == "":
        return default
    try:
        return int(val)
    except Exception:
        return default


def evaluate_financial_metrics(
    application: LoanApplication,
    product: LoanProduct,
) -> Dict[str, Any]:
    """Calculate deterministic financial metrics from application snapshots."""
    financial_data = application.applicant_financial_snapshot or {}
    personal_data = application.applicant_personal_snapshot or {}

    gross_monthly_income = _safe_decimal(financial_data.get("gross_monthly_income"), "75000.00")
    existing_debts = _safe_decimal(
        financial_data.get("existing_monthly_debts") or financial_data.get("existing_debts"),
        "0.00",
    )
    housing_expenses = _safe_decimal(
        financial_data.get("housing_expenses") or financial_data.get("monthly_rent"),
        "0.00",
    )
    employment_type = str(personal_data.get("employment_type") or "SALARIED").upper()
    experience_years = _safe_int(personal_data.get("experience_years"), 3)
    bureau_score = _safe_int(
        financial_data.get("bureau_score") or financial_data.get("cibil_score"),
        720,
    )

    # Calculate financial core metrics
    emi = calculate_emi(
        principal=application.requested_amount,
        annual_rate=product.base_apr,
        tenor_months=application.requested_tenor_months,
    )
    dti = calculate_dti(
        gross_monthly_income=gross_monthly_income,
        existing_debts=existing_debts,
        proposed_emi=emi,
    )
    disposable_surplus = calculate_disposable_income(
        gross_monthly_income=gross_monthly_income,
        existing_debts=existing_debts,
        housing_expenses=housing_expenses,
        proposed_emi=emi,
    )

    # Deterministic Score Calculation (Baseline: 650, Range: 300 - 900)
    score = 650
    score_factors: List[str] = []

    # 1. Bureau History Impact
    if bureau_score >= 750:
        score += 50
        score_factors.append("EXCELLENT_BUREAU_HISTORY")
    elif bureau_score >= 680:
        score += 20
        score_factors.append("GOOD_BUREAU_HISTORY")
    elif bureau_score < 600:
        score -= 70
        score_factors.append("SUBPRIME_BUREAU_HISTORY")
    else:
        score_factors.append("FAIR_BUREAU_HISTORY")

    # 2. Employment Stability
    if employment_type == "SALARIED":
        score += 25
        score_factors.append("SALARIED_STABLE_PROFILE")
    else:
        score += 10
        score_factors.append("SELF_EMPLOYED_PROFILE")

    if experience_years >= 3:
        score += 20
        score_factors.append("EXTENSIVE_EMPLOYMENT_EXPERIENCE")
    elif experience_years < 1:
        score -= 20
        score_factors.append("LIMITED_EMPLOYMENT_TENURE")

    # 3. Debt-To-Income (DTI) Impact
    if dti <= Decimal("30.00"):
        score += 45
        score_factors.append("OPTIMAL_DEBT_TO_INCOME_RATIO")
    elif dti <= Decimal("40.00"):
        score += 15
        score_factors.append("ACCEPTABLE_DEBT_TO_INCOME_RATIO")
    elif dti <= product.max_dti_ratio:
        score -= 25
        score_factors.append("ELEVATED_DEBT_TO_INCOME_RATIO")
    else:
        score -= 85
        score_factors.append("DTI_EXCEEDS_POLICY_THRESHOLD")

    # 4. Disposable Surplus Impact
    if disposable_surplus >= Decimal("30000.00"):
        score += 35
        score_factors.append("SUBSTANTIAL_DISPOSABLE_SURPLUS")
    elif disposable_surplus >= Decimal("15000.00"):
        score += 15
        score_factors.append("ADEQUATE_DISPOSABLE_SURPLUS")
    elif disposable_surplus > Decimal("0.00"):
        score -= 15
        score_factors.append("TIGHT_DISPOSABLE_SURPLUS")
    else:
        score -= 90
        score_factors.append("INSUFFICIENT_DISPOSABLE_SURPLUS")

    # 5. Loan-To-Annual-Income Leverage
    annual_income = max(Decimal("1.00"), gross_monthly_income * Decimal("12"))
    leverage = application.requested_amount / annual_income
    if leverage <= Decimal("1.50"):
        score += 25
        score_factors.append("CONSERVATIVE_LOAN_LEVERAGE")
    elif leverage <= Decimal("3.00"):
        score_factors.append("MODERATE_LOAN_LEVERAGE")
    else:
        score -= 40
        score_factors.append("HIGH_LOAN_LEVERAGE")

    # Clamping deterministic score to standard 300 - 900 range
    final_score = max(300, min(900, score))

    # Determine Risk Tier
    if final_score >= 750 and dti <= Decimal("35.00") and disposable_surplus >= Decimal("20000.00"):
        risk_tier = RiskTier.LOW
    elif (
        final_score >= 620 and dti <= product.max_dti_ratio and disposable_surplus > Decimal("0.00")
    ):
        risk_tier = RiskTier.MEDIUM
    else:
        risk_tier = RiskTier.HIGH

    # Determine Recommendation
    if dti > product.max_dti_ratio or disposable_surplus <= Decimal("0.00") or final_score < 580:
        recommendation = UnderwritingRecommendation.REJECT
    elif risk_tier == RiskTier.LOW:
        recommendation = UnderwritingRecommendation.APPROVE
    else:
        recommendation = UnderwritingRecommendation.CONDITIONAL

    return {
        "calculated_emi": emi,
        "calculated_dti": dti,
        "disposable_income": disposable_surplus,
        "internal_risk_score": final_score,
        "risk_tier": risk_tier,
        "recommendation": recommendation,
        "score_factors_breakdown": {
            "factors": score_factors,
            "bureau_score": bureau_score,
            "employment_type": employment_type,
            "experience_years": experience_years,
            "leverage_ratio": str(round(leverage, 2)),
            "policy_max_dti": str(product.max_dti_ratio),
        },
    }


async def assess_and_persist_risk(
    session: AsyncSession,
    application_id: uuid.UUID,
    actor: User,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> RiskAssessment:
    """Evaluate financial risk, persist/update RiskAssessment snapshot, and transition FSM."""
    stmt = (
        select(LoanApplication)
        .where(LoanApplication.id == application_id)
        .options(
            selectinload(LoanApplication.product),
            selectinload(LoanApplication.risk_assessment),
        )
    )
    res = await session.execute(stmt)
    application = res.scalar_one_or_none()
    if not application:
        raise ValueError(f"Application with ID '{application_id}' not found.")

    if not application.product:
        raise ValueError("Application is not associated with an active loan product.")

    # Execute math evaluation
    metrics = evaluate_financial_metrics(application, application.product)

    # Persist or update RiskAssessment record
    assessment = application.risk_assessment
    if assessment is None:
        assessment = RiskAssessment(
            id=uuid.uuid4(),
            application_id=application.id,
            calculated_dti=metrics["calculated_dti"],
            calculated_emi=metrics["calculated_emi"],
            disposable_income=metrics["disposable_income"],
            internal_risk_score=metrics["internal_risk_score"],
            risk_tier=metrics["risk_tier"],
            recommendation=metrics["recommendation"],
            score_factors_breakdown=metrics["score_factors_breakdown"],
            evaluated_at=utc_now(),
        )
        session.add(assessment)
    else:
        assessment.calculated_dti = metrics["calculated_dti"]
        assessment.calculated_emi = metrics["calculated_emi"]
        assessment.disposable_income = metrics["disposable_income"]
        assessment.internal_risk_score = metrics["internal_risk_score"]
        assessment.risk_tier = metrics["risk_tier"]
        assessment.recommendation = metrics["recommendation"]
        assessment.score_factors_breakdown = metrics["score_factors_breakdown"]
        assessment.evaluated_at = utc_now()

    # If application is in DOCUMENTS_VERIFIED, transition to RISK_ASSESSED
    if application.status == ApplicationStatus.DOCUMENTS_VERIFIED:
        await execute_transition(
            session=session,
            application=application,
            target_status=ApplicationStatus.RISK_ASSESSED,
            actor_id=actor.id,
            actor_role=actor.role,
            reason=f"Risk assessed: Tier {metrics['risk_tier'].value}, Score {metrics['internal_risk_score']}",
            metadata={
                "risk_tier": metrics["risk_tier"].value,
                "score": metrics["internal_risk_score"],
                "recommendation": metrics["recommendation"].value,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

    # Record RISK_EVALUATED audit event
    await record_audit_event(
        session=session,
        event_type="RISK_EVALUATED",
        entity_name="risk_assessments",
        entity_id=assessment.id,
        actor_id=actor.id,
        actor_role=actor.role.value,
        ip_address=ip_address,
        user_agent=user_agent,
        subsequent_state={
            "application_id": str(application.id),
            "calculated_dti": str(assessment.calculated_dti),
            "calculated_emi": str(assessment.calculated_emi),
            "disposable_income": str(assessment.disposable_income),
            "internal_risk_score": assessment.internal_risk_score,
            "risk_tier": assessment.risk_tier.value,
            "recommendation": assessment.recommendation.value,
        },
    )

    await session.flush()
    return assessment
