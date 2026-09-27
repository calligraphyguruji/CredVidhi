# Multi-stage production-ready Dockerfile for CredVidhi Backend
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pinned uv binary from official image
COPY --from=ghcr.io/astral-sh/uv:0.4.18 /uv /uvx /bin/

COPY pyproject.toml README.md ./

# Create virtual environment and install production dependencies
RUN uv venv /opt/venv
ENV VIRTUAL_ENV="/opt/venv"
ENV PATH="/opt/venv/bin:${PATH}"
RUN uv pip install --no-cache-dir .

# Stage 2: Runtime
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root application user
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/bash -m appuser

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV VIRTUAL_ENV="/opt/venv"
ENV PATH="/opt/venv/bin:${PATH}"

# Copy application source code and migrations
COPY --chown=appuser:appgroup app /app/app
COPY --chown=appuser:appgroup alembic /app/alembic
COPY --chown=appuser:appgroup alembic.ini /app/alembic.ini
COPY --chown=appuser:appgroup README.md /app/README.md
COPY --chown=appuser:appgroup docker-entrypoint.sh /app/docker-entrypoint.sh

USER appuser

EXPOSE 8000

# Liveness probe avoids restarting container during temporary downstream DB/Redis latency
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health/live || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
