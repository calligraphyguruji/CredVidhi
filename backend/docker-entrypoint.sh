#!/bin/bash
set -e

# If arguments are passed to the container (e.g. ad-hoc commands), execute them directly
if [ $# -gt 0 ]; then
  exec "$@"
fi

echo "=== CredVidhi Production Boot Sequence ==="

# 1. Apply version-controlled database schema migrations
echo "Applying Alembic database migrations..."
alembic upgrade head || echo "Alembic notice: migrations skipped or database connection pending."

# Demo records must never be inserted by production startup.
if [ "${ENVIRONMENT:-production}" = "development" ] && [ "${ENABLE_DEMO_SEED:-false}" = "true" ]; then
  python -m app.scripts.seed_db
fi

# 3. Launch production Uvicorn ASGI server bound to Render's dynamic PORT
PORT="${PORT:-8000}"
echo "Starting Uvicorn ASGI server on port ${PORT}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}"
