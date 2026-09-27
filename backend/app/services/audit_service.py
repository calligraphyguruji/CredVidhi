"""Immutable Audit Log Service.

Records all compliance events, state transitions, and operational actions into the audit ledger.
Provides querying interfaces with strict filter and pagination controls.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.audit_log import AuditLog


async def record_audit_event(
    session: AsyncSession,
    event_type: str,
    entity_name: str,
    entity_id: uuid.UUID,
    actor_id: Optional[uuid.UUID] = None,
    actor_role: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    prior_state: Optional[Dict[str, Any]] = None,
    subsequent_state: Optional[Dict[str, Any]] = None,
    metadata_snapshot: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """Append an immutable audit entry to the active database session."""
    sanitized_ip = ip_address[:45] if ip_address else None
    sanitized_ua = user_agent[:255] if user_agent else None

    log_entry = AuditLog(
        id=uuid.uuid4(),
        event_type=event_type,
        entity_name=entity_name,
        entity_id=entity_id,
        actor_id=actor_id,
        actor_role=actor_role,
        ip_address=sanitized_ip,
        user_agent=sanitized_ua,
        prior_state=prior_state,
        subsequent_state=subsequent_state,
        metadata_snapshot=metadata_snapshot,
    )
    session.add(log_entry)
    logger.info(
        f"Audit record queued: [{event_type}] on {entity_name}:{entity_id} "
        f"by {actor_role or 'SYSTEM'}:{actor_id or 'NONE'}"
    )
    return log_entry


async def get_audit_logs(
    session: AsyncSession,
    entity_id: Optional[uuid.UUID] = None,
    entity_name: Optional[str] = None,
    actor_id: Optional[uuid.UUID] = None,
    event_type: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = 50,
    offset: int = 0,
) -> Tuple[List[AuditLog], int]:
    """Retrieve paginated audit records matching administrative filters."""
    query = select(AuditLog)
    count_query = select(func.count()).select_from(AuditLog)

    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
        count_query = count_query.where(AuditLog.entity_id == entity_id)
    if entity_name:
        query = query.where(AuditLog.entity_name == entity_name)
        count_query = count_query.where(AuditLog.entity_name == entity_name)
    if actor_id:
        query = query.where(AuditLog.actor_id == actor_id)
        count_query = count_query.where(AuditLog.actor_id == actor_id)
    if event_type:
        query = query.where(AuditLog.event_type == event_type)
        count_query = count_query.where(AuditLog.event_type == event_type)
    if start_time:
        query = query.where(AuditLog.created_at >= start_time)
        count_query = count_query.where(AuditLog.created_at >= start_time)
    if end_time:
        query = query.where(AuditLog.created_at <= end_time)
        count_query = count_query.where(AuditLog.created_at <= end_time)

    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    query = query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(query)
    records = list(result.scalars().all())

    return records, total
