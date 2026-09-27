"""Immutable Audit Log Service.

Records all compliance events, state transitions, and operational actions into the audit ledger.
"""

import uuid
from typing import Any, Dict, Optional

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
