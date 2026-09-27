#!/bin/bash
set -e

echo "=== CredVidhi Production Boot Sequence ==="

# 1. Apply version-controlled database schema migrations
echo "Applying Alembic database migrations..."
alembic upgrade head || echo "Alembic notice: migrations skipped or database connection pending."

# 2. Idempotently seed default institutional accounts and products
echo "Seeding initial institutional accounts and loan products..."
python -m app.scripts.seed_db || echo "Seeding notice: already seeded or database connection pending."

# 3. Launch production Uvicorn ASGI server
echo "Starting Uvicorn ASGI server on port 8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
