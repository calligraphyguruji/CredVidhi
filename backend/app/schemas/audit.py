"""Pydantic Schemas for Immutable Audit Log Queries."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AuditLogResponseSchema(BaseModel):
    """Normalized schema representation of an immutable audit record."""

    id: uuid.UUID
    event_type: str = Field(..., description="Action/Mutation event code")
    entity_name: str = Field(..., description="Target database table/domain entity")
    entity_id: uuid.UUID = Field(..., description="Target entity primary key")
    actor_id: Optional[uuid.UUID] = Field(None, description="Initiating user UUID")
    actor_role: Optional[str] = Field(None, description="RBAC role of the initiating user")
    ip_address: Optional[str] = Field(None, description="Client IPv4/IPv6 address")
    user_agent: Optional[str] = Field(None, description="Truncated HTTP client User-Agent")
    prior_state: Optional[Dict[str, Any]] = Field(None, description="Previous state snapshot")
    subsequent_state: Optional[Dict[str, Any]] = Field(
        None, description="Subsequent state snapshot"
    )
    metadata_snapshot: Optional[Dict[str, Any]] = Field(
        None, description="Contextual payload metadata"
    )
    created_at: datetime = Field(..., description="UTC creation timestamp")

    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponseSchema(BaseModel):
    """Paginated response envelope for administrative audit logs."""

    items: List[AuditLogResponseSchema]
    total: int = Field(..., description="Total matching audit records")
    limit: int = Field(..., description="Requested page limit")
    offset: int = Field(..., description="Requested page offset")
