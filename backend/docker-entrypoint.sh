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

# 2. Idempotently seed default institutional accounts and products (non-blocking safeguard)
echo "Seeding initial institutional accounts and loan products..."
python -m app.scripts.seed_db &
SEED_PID=$!

# Wait up to 5 seconds for seeding to complete; if still executing, allow it to finish in background
for i in {1..5}; do
  if ! kill -0 "$SEED_PID" 2>/dev/null; then
    break
  fi
  sleep 1
done

# 3. Launch production Uvicorn ASGI server bound to Render's dynamic PORT
PORT="${PORT:-8000}"
echo "Starting Uvicorn ASGI server on port ${PORT}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}"
