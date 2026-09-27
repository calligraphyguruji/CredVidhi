"""Append-Only Immutable Audit Log Entity.

Captures all state transitions, document approvals, credit assessments, and security events.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utc_now, uuid_pk

if TYPE_CHECKING:
    from app.models.user import User


class AuditLog(Base):
    """Immutable audit trail of all loan origination events."""

    __tablename__ = "audit_logs"

    id: Mapped[uuid_pk]
    event_type: Mapped[str] = mapped_column(
        String(100), index=True, nullable=False, comment="e.g. APPLICATION_SUBMITTED"
    )
    entity_name: Mapped[str] = mapped_column(
        String(100), index=True, nullable=False, comment="Target entity, e.g. loan_applications"
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    actor_role: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # State delta snapshots
    prior_state: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    subsequent_state: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    metadata_snapshot: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )

    # Relationship
    actor: Mapped[Optional["User"]] = relationship("User", foreign_keys=[actor_id])
