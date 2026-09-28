"""Tests for Indian Borrowers Database Seeder."""

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import LoanApplication
from app.models.audit_log import AuditLog
from app.models.decision import LoanDecision
from app.models.document import ApplicationDocument
from app.models.risk_assessment import RiskAssessment
from app.models.user import User, UserRole
from app.scripts.seed_indian_borrowers import INDIAN_BORROWERS, seed_indian_borrowers_data


@pytest.mark.asyncio
async def test_seed_indian_borrowers_execution(db_session: AsyncSession) -> None:
    """Verify 45 Indian borrowers, applications, and artifacts are created idempotently."""
    # 1. Run seeder
    await seed_indian_borrowers_data(db_session)

    # 2. Verify total applicants created matches data definition (45)
    user_count_res = await db_session.execute(
        select(func.count(User.id)).where(User.role == UserRole.APPLICANT)
    )
    applicant_count = user_count_res.scalar_one()
    assert applicant_count == len(INDIAN_BORROWERS)
    assert applicant_count >= 40

    # 3. Verify total applications created matches data definition
    app_count_res = await db_session.execute(select(func.count(LoanApplication.id)))
    app_count = app_count_res.scalar_one()
    assert app_count == len(INDIAN_BORROWERS)

    # 4. Verify specific Indian applicant snapshot integrity
    first_app_res = await db_session.execute(
        select(LoanApplication).where(LoanApplication.reference_number == "APP-2026-0001")
    )
    first_app = first_app_res.scalar_one()
    assert first_app.applicant_personal_snapshot["full_name"] == "Aarav Sharma"
    assert first_app.applicant_personal_snapshot["city"] == "New Delhi, Delhi"
    assert first_app.applicant_personal_snapshot["masked_pan"] == "******201A"
    assert first_app.status.value == "APPROVED"

    # 5. Verify child entity creation (documents, risk assessments, decisions, audit logs)
    doc_count_res = await db_session.execute(select(func.count(ApplicationDocument.id)))
    assert doc_count_res.scalar_one() == len(INDIAN_BORROWERS) * 4

    risk_count_res = await db_session.execute(select(func.count(RiskAssessment.id)))
    assert risk_count_res.scalar_one() > 20

    dec_count_res = await db_session.execute(select(func.count(LoanDecision.id)))
    assert dec_count_res.scalar_one() > 10

    audit_count_res = await db_session.execute(select(func.count(AuditLog.id)))
    assert audit_count_res.scalar_one() >= len(INDIAN_BORROWERS)

    # 6. Verify idempotency - running again should not duplicate records
    await seed_indian_borrowers_data(db_session)
    second_count_res = await db_session.execute(select(func.count(LoanApplication.id)))
    assert second_count_res.scalar_one() == len(INDIAN_BORROWERS)
