from tests.wizard_helpers import complete_draft
"""Regression checks for clean accounts, ownership, and genuine underwriting inputs."""
from decimal import Decimal
from importlib import import_module
from types import SimpleNamespace

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import LoanApplication
from app.models.audit_log import AuditLog
from app.models.decision import LoanDecision
from app.models.document import ApplicationDocument
from app.models.loan_product import LoanProduct
from app.models.risk_assessment import RiskAssessment
from app.scripts.seed_db import DEFAULT_PRODUCTS
from app.services.risk_service import evaluate_financial_metrics


async def register(client: AsyncClient, name: str) -> dict:
    response = await client.post('/api/v1/auth/register', json={
        'email': f'{name}@example.com', 'password': 'BorrowerPass123!',
        'first_name': name, 'last_name': 'Borrower', 'phone_number': '+919123456789',
    })
    assert response.status_code == 201, response.text
    return response.json()['data']


def headers(user: dict) -> dict:
    return {'Authorization': f"Bearer {user['access_token']}"}


@pytest.mark.asyncio
async def test_new_borrower_has_no_business_records_even_with_products(async_client: AsyncClient, db_session: AsyncSession) -> None:
    db_session.add(LoanProduct(**DEFAULT_PRODUCTS[0]))
    await db_session.commit()
    user = await register(async_client, 'fresh')
    queue = await async_client.get('/api/v1/queues/applicant', headers=headers(user))
    assert queue.status_code == 200
    assert queue.json()['data'] == []
    for model in [LoanApplication, ApplicationDocument, RiskAssessment, LoanDecision, AuditLog]:
        assert (await db_session.execute(select(func.count()).select_from(model))).scalar_one() == 0
    recovery = await async_client.post('/api/v1/auth/forgot-registration', json={
        'fullName': 'fresh Borrower', 'mobile': '+919123456789', 'dateOfBirth': '1990-01-01',
    })
    assert recovery.status_code == 400
    assert (await db_session.execute(select(func.count()).select_from(LoanApplication))).scalar_one() == 0


@pytest.mark.asyncio
async def test_borrowers_cannot_read_or_mutate_each_others_records(async_client: AsyncClient, db_session: AsyncSession) -> None:
    product = LoanProduct(**DEFAULT_PRODUCTS[0])
    db_session.add(product)
    await db_session.commit()
    borrower_a = await register(async_client, 'borrowera')
    borrower_b = await register(async_client, 'borrowerb')
    draft = await async_client.post('/api/v1/applications', headers=headers(borrower_a), json={
        'product_id': str(product.id), 'requested_amount': 500000, 'requested_tenor_months': 24,
    })
    assert draft.status_code == 201, draft.text
    app_id = draft.json()['data']['id']
    updated = await async_client.put(f'/api/v1/applications/{app_id}/draft', headers=headers(borrower_a), json={
        'applicant_personal_snapshot': {'fullName': 'borrowera Borrower', 'pan': 'ABCDE1234F'},
    })
    assert updated.status_code == 200
    assert updated.json()['data']['applicant_personal_snapshot']['pan'] == '***-**-1234'
    await complete_draft(async_client, app_id, headers(borrower_a), product.required_documents)
    submitted = await async_client.post(f'/api/v1/applications/{app_id}/submit', headers=headers(borrower_a))
    assert submitted.status_code == 200
    assert submitted.json()['data']['status'] == 'SUBMITTED'
    own_queue = await async_client.get('/api/v1/queues/applicant', headers=headers(borrower_a))
    assert [a['id'] for a in own_queue.json()['data']] == [app_id]
    other_queue = await async_client.get('/api/v1/queues/applicant', headers=headers(borrower_b))
    assert other_queue.json()['data'] == []
    profile = await async_client.get('/api/v1/auth/me', headers=headers(borrower_b))
    assert profile.json()['data']['id'] == borrower_b['id']
    for path in [f'/applications/{app_id}', f'/applications/{app_id}/documents',
                 f'/applications/{app_id}/documents/checklist', f'/applications/{app_id}/assessment',
                 f'/applications/{app_id}/decision']:
        denied = await async_client.get('/api/v1' + path, headers=headers(borrower_b))
        assert denied.status_code == 403, (path, denied.text)
        assert denied.json()['data'] is None
    for suffix in ['submit', 'evaluate', 'transition']:
        denied = await async_client.post(f'/api/v1/applications/{app_id}/{suffix}', headers=headers(borrower_b), json={'target_status': 'APPROVED'})
        assert denied.status_code == 403
    denied = await async_client.post(f'/api/v1/applications/{app_id}/documents/upload', headers=headers(borrower_b),
                                    data={'document_type': 'PAN_CARD'}, files={'file': ('proof.pdf', b'%PDF-1.4\nexample', 'application/pdf')})
    assert denied.status_code == 403
    assert (await async_client.get('/api/v1/queues/officer', headers=headers(borrower_b))).status_code == 403
    assert (await async_client.get('/api/v1/queues/applicant')).status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize('module_name', ['app.scripts.seed_db', 'app.scripts.seed_indian_borrowers'])
async def test_demo_seed_refuses_production(module_name: str, monkeypatch, db_session: AsyncSession) -> None:
    module = import_module(module_name)
    monkeypatch.setattr(module, 'get_settings', lambda: SimpleNamespace(ENVIRONMENT='production', ENABLE_DEMO_SEED=True))
    seed = module.seed_data if module_name.endswith('seed_db') else module.seed_indian_borrowers_data
    with pytest.raises(RuntimeError, match='Demo seeding'):
        await seed(db_session)
    assert (await db_session.execute(select(func.count()).select_from(LoanApplication))).scalar_one() == 0


@pytest.mark.parametrize('value', [None, '', 'invalid', '-1', 'NaN', 'Infinity'])
def test_risk_engine_refuses_missing_or_invalid_income(value) -> None:
    application = SimpleNamespace(applicant_financial_snapshot={'gross_monthly_income': value}, applicant_personal_snapshot={})
    with pytest.raises(ValueError):
        evaluate_financial_metrics(application, SimpleNamespace())


def test_risk_engine_does_not_invent_a_credit_score() -> None:
    application = SimpleNamespace(applicant_financial_snapshot={
        'grossMonthlyIncome': 95000, 'existingMonthlyDebt': 0, 'housingExpense': 0,
        'employmentType': 'SALARIED', 'yearsEmployed': 5, 'creditScoreDeclared': None,
    }, applicant_personal_snapshot={})
    with pytest.raises(ValueError, match='bureau_score'):
        evaluate_financial_metrics(application, SimpleNamespace())


def test_risk_engine_preserves_zero_obligations_and_accepts_actual_inputs() -> None:
    application = SimpleNamespace(applicant_financial_snapshot={
        'grossMonthlyIncome': 95000, 'existingMonthlyDebt': 0, 'housingExpense': 0,
        'employmentType': 'SALARIED', 'yearsEmployed': 5, 'creditScoreDeclared': 780,
    }, applicant_personal_snapshot={}, requested_amount=Decimal('500000'), requested_tenor_months=24)
    product = SimpleNamespace(base_apr=Decimal('10'), max_dti_ratio=Decimal('45'))
    result = evaluate_financial_metrics(application, product)
    assert result['calculated_dti'] > 0
    assert result['disposable_income'] == Decimal('95000') - result['calculated_emi']


@pytest.mark.asyncio
async def test_failed_storage_does_not_create_document_metadata(async_client: AsyncClient, db_session: AsyncSession, monkeypatch) -> None:
    from unittest.mock import AsyncMock

    from app.services.storage_service import StorageUnavailableError, storage_service
    product = LoanProduct(**DEFAULT_PRODUCTS[0])
    db_session.add(product)
    await db_session.commit()
    borrower = await register(async_client, 'uploadfailure')
    draft = await async_client.post('/api/v1/applications', headers=headers(borrower), json={
        'product_id': str(product.id), 'requested_amount': 500000, 'requested_tenor_months': 24,
    })
    app_id = draft.json()['data']['id']
    monkeypatch.setattr(storage_service, 'upload_file_bytes', AsyncMock(side_effect=StorageUnavailableError('Document upload failed. Please retry.')))
    response = await async_client.post(f'/api/v1/applications/{app_id}/documents/upload', headers=headers(borrower),
                                      data={'document_type': 'PAN_CARD'}, files={'file': ('proof.pdf', b'%PDF-1.4\nreal submitted file', 'application/pdf')})
    assert response.status_code == 503
    assert response.json()['error']['code'] == 'STORAGE_UNAVAILABLE'
    assert (await db_session.execute(select(func.count()).select_from(ApplicationDocument))).scalar_one() == 0


@pytest.mark.asyncio
async def test_production_recovery_never_claims_fake_otp_delivery(async_client: AsyncClient, monkeypatch) -> None:
    from app.api.v1.auth import settings
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    response = await async_client.post('/api/v1/auth/forgot-registration', json={
        'fullName': 'Real Borrower', 'mobile': '+919123456789', 'dateOfBirth': '1990-01-01',
    })
    assert response.status_code == 503
    assert response.json()['error']['code'] == 'RECOVERY_DELIVERY_UNAVAILABLE'
    assert response.json()['data'] is None
