"""User entity and Role-Based Access Control (RBAC) definitions."""

import enum
from typing import Optional

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, uuid_pk


class UserRole(str, enum.Enum):
    """Institutional access roles."""

    APPLICANT = "APPLICANT"
    LOAN_OFFICER = "LOAN_OFFICER"
    RISK_ANALYST = "RISK_ANALYST"
    ADMIN = "ADMIN"
    OPERATIONS = "OPERATIONS"


class User(Base, TimestampMixin):
    """Institutional User model supporting multi-role access."""

    __tablename__ = "users"

    id: Mapped[uuid_pk]
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, native_enum=False, length=50),
        default=UserRole.APPLICANT,
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    phone_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    pan_number: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    @property
    def full_name(self) -> str:
        """Convenience property for borrower / officer full name."""
        return f"{self.first_name} {self.last_name}".strip()
