"""Immutable Audit Ledger Query Endpoints.

Provides administrative and compliance access to the system-wide audit trail.
No mutation or deletion endpoints exist; the ledger is strictly append-only.
"""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.responses import success_response
from app.database import get_db
from app.dependencies import require_roles
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogListResponseSchema, AuditLogResponseSchema
from app.services.audit_service import get_audit_logs

router = APIRouter(prefix="/audit", tags=["Compliance & Audit Ledger"])


@router.get(
    "/logs",
    summary="Query Immutable Audit Trail",
    description="Filter chronological compliance logs by entity ID, actor, event type, and date boundaries.",
    response_model=None,
)
async def query_audit_trail(
    entity_id: Optional[uuid.UUID] = Query(
        None, description="Target entity/application identifier"
    ),
    actor_id: Optional[uuid.UUID] = Query(None, description="UUID of actor who triggered event"),
    event_type: Optional[str] = Query(None, description="Event action code, e.g. STATE_TRANSITION"),
    start_date: Optional[datetime] = Query(None, description="Earliest UTC timestamp boundary"),
    end_date: Optional[datetime] = Query(None, description="Latest UTC timestamp boundary"),
    limit: int = Query(50, ge=1, le=100, description="Page limit"),
    offset: int = Query(0, ge=0, description="Page offset"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATIONS])),
) -> JSONResponse:
    """Administrative retrieval of tamper-proof audit records."""
    records, total = await get_audit_logs(
        session=db,
        entity_id=entity_id,
        actor_id=actor_id,
        event_type=event_type,
        start_time=start_date,
        end_time=end_date,
        limit=limit,
        offset=offset,
    )

    items = [AuditLogResponseSchema.model_validate(log) for log in records]
    response_payload = AuditLogListResponseSchema(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    ).model_dump()

    return success_response(data=response_payload)
