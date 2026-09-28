"""Database Seeding Script for CredVidhi.

Idempotently populates default institutional accounts (Admin, Loan Officer, Underwriter, Applicant)
and core loan products (Home Loan Prime, SME Growth, Personal Flex).
"""

import asyncio
import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.logging import logger
from app.core.security import get_password_hash
from app.database import async_session_factory, engine
from app.models.base import Base
from app.models.loan_product import LoanProduct
from app.models.user import User, UserRole

DEFAULT_USERS = [
    {
        "email": "admin@credvidhi.in",
        "password": "Admin@CredVidhi2026",
        "first_name": "CredVidhi",
        "last_name": "Administrator",
        "role": UserRole.ADMIN,
        "phone_number": "+919876543210",
        "pan_number": "ABCDE1234F",
    },
    {
        "email": "officer@credvidhi.in",
        "password": "Officer@CredVidhi2026",
        "first_name": "Arjun",
        "last_name": "Mehta",
        "role": UserRole.LOAN_OFFICER,
        "phone_number": "+919876543211",
        "pan_number": "BCDEF2345G",
    },
    {
        "email": "underwriter@credvidhi.in",
        "password": "Underwriter@CredVidhi2026",
        "first_name": "Priya",
        "last_name": "Sharma",
        "role": UserRole.RISK_ANALYST,
        "phone_number": "+919876543212",
        "pan_number": "CDEFG3456H",
    },
    {
        "email": "borrower@credvidhi.in",
        "password": "Borrower@CredVidhi2026",
        "first_name": "Rahul",
        "last_name": "Verma",
        "role": UserRole.APPLICANT,
        "phone_number": "+919876543213",
        "pan_number": "DEFGH4567I",
    },
]

DEFAULT_PRODUCTS = [
    {
        "code": "HOME_PRIME",
        "name": "Home Loan Prime",
        "description": "Competitive home financing with floating and fixed interest options for salaried and self-employed professionals.",
        "min_amount": Decimal("500000.00"),
        "max_amount": Decimal("50000000.00"),
        "min_tenor_months": 12,
        "max_tenor_months": 360,
        "base_apr": Decimal("8.50"),
        "max_dti_ratio": Decimal("50.00"),
        "required_documents": [
            "PAN_CARD",
            "AADHAAR_CARD",
            "SALARY_SLIP",
            "BANK_STATEMENT",
            "PROPERTY_DEED",
        ],
    },
    {
        "code": "SME_GROWTH",
        "name": "SME Growth Capital",
        "description": "Fast-tracked working capital and term equipment financing for growing micro and small businesses.",
        "min_amount": Decimal("200000.00"),
        "max_amount": Decimal("20000000.00"),
        "min_tenor_months": 6,
        "max_tenor_months": 84,
        "base_apr": Decimal("11.25"),
        "max_dti_ratio": Decimal("45.00"),
        "required_documents": [
            "PAN_CARD",
            "BUSINESS_REGISTRATION",
            "BANK_STATEMENT",
            "ITR_V",
        ],
    },
    {
        "code": "PERSONAL_FLEX",
        "name": "Personal Flexi Loan",
        "description": "Unsecured personal loan for medical, travel, wedding, or sudden financial liquidity needs.",
        "min_amount": Decimal("50000.00"),
        "max_amount": Decimal("2500000.00"),
        "min_tenor_months": 3,
        "max_tenor_months": 60,
        "base_apr": Decimal("12.75"),
        "max_dti_ratio": Decimal("40.00"),
        "required_documents": [
            "PAN_CARD",
            "AADHAAR_CARD",
            "SALARY_SLIP",
            "BANK_STATEMENT",
        ],
    },
]


async def seed_data(
    session: Optional[AsyncSession] = None,
    engine_to_use: Optional[AsyncEngine] = None,
) -> None:
    """Seed initial records into database."""

    async def _do_seed(s: AsyncSession) -> None:
        logger.info("Seeding default institutional users...")
        for user_data in DEFAULT_USERS:
            res = await s.execute(select(User).where(User.email == user_data["email"]))
            existing = res.scalar_one_or_none()
            if not existing:
                user = User(
                    id=uuid.uuid4(),
                    email=user_data["email"],
                    password_hash=get_password_hash(user_data["password"]),
                    first_name=user_data["first_name"],
                    last_name=user_data["last_name"],
                    role=user_data["role"],
                    is_active=True,
                    phone_number=user_data.get("phone_number"),
                    pan_number=user_data.get("pan_number"),
                )
                s.add(user)
                logger.info(f"Created seed user: {user.email} [{user.role.value}]")
            else:
                logger.info(f"User already exists: {user_data['email']}")

        logger.info("Seeding default loan products...")
        for prod_data in DEFAULT_PRODUCTS:
            res = await s.execute(select(LoanProduct).where(LoanProduct.code == prod_data["code"]))
            existing = res.scalar_one_or_none()
            if not existing:
                product = LoanProduct(
                    id=uuid.uuid4(),
                    code=prod_data["code"],
                    name=prod_data["name"],
                    description=prod_data["description"],
                    min_amount=prod_data["min_amount"],
                    max_amount=prod_data["max_amount"],
                    min_tenor_months=prod_data["min_tenor_months"],
                    max_tenor_months=prod_data["max_tenor_months"],
                    base_apr=prod_data["base_apr"],
                    max_dti_ratio=prod_data["max_dti_ratio"],
                    required_documents=prod_data["required_documents"],
                    is_active=True,
                )
                s.add(product)
                logger.info(f"Created seed product: {product.code} - {product.name}")
            else:
                logger.info(f"Product already exists: {prod_data['code']}")

        await s.commit()
        logger.info("Database core seeding completed successfully. Now seeding Indian borrowers...")
        from app.scripts.seed_indian_borrowers import seed_indian_borrowers_data
        await seed_indian_borrowers_data(s)
        logger.info("All database seed data populated successfully.")

    if session is not None:
        await _do_seed(session)
    else:
        eng = engine_to_use or engine
        async with eng.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with async_session_factory() as sess:
            await _do_seed(sess)


if __name__ == "__main__":
    asyncio.run(seed_data())
