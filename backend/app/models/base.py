"""Base Declarative Model and Audit Mixins.

Standardizes UUID primary keys and UTC timestamp tracking across all database entities.
"""

import uuid
from datetime import datetime, timezone
from typing import Annotated

from sqlalchemy import DateTime, Uuid
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utc_now() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(timezone.utc)


class Base(AsyncAttrs, DeclarativeBase):
    """Base declarative class with async attribute support."""

    pass


# Reusable UUID Primary Key Annotated Type
uuid_pk = Annotated[
    uuid.UUID,
    mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
        sort_order=-100,
    ),
]


class TimestampMixin:
    """Provides automatic UTC created_at and updated_at timestamps."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )
