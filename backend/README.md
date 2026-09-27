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
