# CredVidhi Backend

High-performance, auditable loan origination, risk assessment, and verification API for **CredVidhi**.

## Tech Stack
- **Framework:** FastAPI (Python 3.11+)
- **Validation:** Pydantic v2 + Pydantic Settings
- **Database:** PostgreSQL 16 + SQLAlchemy 2.0 (Async) + asyncpg + Alembic
- **Cache & Session:** Redis 7
- **Document Store:** MinIO (S3-compatible)
- **Containerization:** Docker & Docker Compose

## Quick Start

### 1. Environment Setup
```bash
uv venv
source .venv/bin/activate
uv pip install -e ".[dev]"
```

### 2. Infrastructure Services
```bash
docker compose up -d
```

### 3. Run Development Server
```bash
uvicorn app.main:app --reload --port 8000
```

### 4. Run Test Suite
```bash
pytest
```

## Production & Render Deployment

The backend is containerized via a multi-stage Docker build with non-root security.

- **Port Binding:** Automatically adapts to the host environment port (`$PORT` dynamically assigned by Render, defaulting to `8000`).
- **Boot Sequence:** `docker-entrypoint.sh` executes migrations (`alembic upgrade head`), verifies/seeds institutional accounts and benchmark loan data in a non-blocking loop, and starts `uvicorn` on `0.0.0.0:${PORT}`.
- **Healthcheck:** Liveness probe exposed at `/api/v1/health/live`.
- **Database Pooler & Supabase Compatibility:** Automatically normalizes `sslmode=` query params for `asyncpg` compatibility and configures `statement_cache_size=0` for transaction connection poolers (e.g. Supabase Supavisor/PgBouncer on port 6543).
- **Borrower Registration Security:** Incorporates disposable/temporary email filtering (`python-disposable`) and DNS deliverability checks with bounded caching resolvers.

