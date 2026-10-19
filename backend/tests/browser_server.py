"""Isolated local HTTP backend for browser regressions; never uses production storage."""
import os
import sys
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['ENVIRONMENT'] = 'test'
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:////tmp/credvidhi-browser-tests.sqlite'
os.environ['DEBUG'] = 'false'
os.environ['REDIS_URL'] = 'redis://127.0.0.1:1/0'
os.environ['MINIO_ENDPOINT'] = '127.0.0.1:1'
os.environ['CORS_ORIGINS'] = '["http://127.0.0.1:5174", "http://localhost:5174"]'
from app.database import engine, async_session_factory
from app.models import Base
from app.models.loan_product import LoanProduct
from app.scripts.seed_db import DEFAULT_PRODUCTS
from app.main import app
async def initialize():
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with async_session_factory() as session:
        from sqlalchemy import select
        if not (await session.execute(select(LoanProduct.id))).first():
            session.add_all([LoanProduct(**product) for product in DEFAULT_PRODUCTS])
            await session.commit()
asyncio.run(initialize())
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8000)
