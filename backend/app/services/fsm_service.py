"""Finite State Machine (FSM) Service for Loan Applications.

Enforces deterministic lifecycle transitions, role barriers, and atomic audit records.
"""

import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import ApplicationStatus, LoanApplication
from app.models.base import utc_now
from app.models.user import UserRole
from app.services.audit_service import record_audit_event


class IllegalStateTransitionError(Exception):
    """Domain exception raised when a forbidden status transition is attempted."""

    def __init__(
        self,
        current_status: ApplicationStatus,
        target_status: ApplicationStatus,
        actor_role: UserRole,
        message: str,
    ) -> None:
        super().__init__(message)
        self.current_status = current_status
        self.target_status = target_status
        self.actor_role = actor_role
        self.message = message


# Directed Graph of Authorized Lifecycle Transitions
ALLOWED_TRANSITIONS: Dict[ApplicationStatus, Dict[ApplicationStatus, List[UserRole]]] = {
    ApplicationStatus.DRAFT: {
        ApplicationStatus.SUBMITTED: [UserRole.APPLICANT, UserRole.ADMIN],
        ApplicationStatus.REJECTED: [UserRole.APPLICANT, UserRole.ADMIN],
    },
    ApplicationStatus.SUBMITTED: {
        ApplicationStatus.UNDER_REVIEW: [UserRole.LOAN_OFFICER, UserRole.ADMIN],
        ApplicationStatus.REJECTED: [UserRole.APPLICANT, UserRole.LOAN_OFFICER, UserRole.ADMIN],
    },
    ApplicationStatus.UNDER_REVIEW: {
        ApplicationStatus.DOCUMENTS_PENDING: [UserRole.LOAN_OFFICER, UserRole.ADMIN],
        ApplicationStatus.DOCUMENTS_VERIFIED: [UserRole.LOAN_OFFICER, UserRole.ADMIN],
        ApplicationStatus.REJECTED: [UserRole.APPLICANT, UserRole.LOAN_OFFICER, UserRole.ADMIN],
    },
    ApplicationStatus.DOCUMENTS_PENDING: {
        ApplicationStatus.UNDER_REVIEW: [
            UserRole.APPLICANT,
            UserRole.LOAN_OFFICER,
            UserRole.ADMIN,
        ],
        ApplicationStatus.REJECTED: [UserRole.APPLICANT, UserRole.LOAN_OFFICER, UserRole.ADMIN],
    },
    ApplicationStatus.DOCUMENTS_VERIFIED: {
        ApplicationStatus.RISK_ASSESSED: [UserRole.RISK_ANALYST, UserRole.ADMIN],
        ApplicationStatus.UNDER_REVIEW: [UserRole.LOAN_OFFICER, UserRole.ADMIN],
        ApplicationStatus.REJECTED: [UserRole.RISK_ANALYST, UserRole.ADMIN],
    },
    ApplicationStatus.RISK_ASSESSED: {
        ApplicationStatus.APPROVED: [UserRole.RISK_ANALYST, UserRole.ADMIN],
        ApplicationStatus.REJECTED: [UserRole.RISK_ANALYST, UserRole.ADMIN],
        ApplicationStatus.DOCUMENTS_PENDING: [UserRole.RISK_ANALYST, UserRole.ADMIN],
    },
    ApplicationStatus.APPROVED: {
        ApplicationStatus.DISBURSED: [UserRole.OPERATIONS, UserRole.ADMIN],
        ApplicationStatus.REJECTED: [UserRole.ADMIN],
    },
    ApplicationStatus.REJECTED: {},
    ApplicationStatus.DISBURSED: {},
}


def validate_transition(
    current_status: ApplicationStatus,
    target_status: ApplicationStatus,
    actor_role: UserRole,
    reason: Optional[str] = None,
) -> None:
    """Validate whether an FSM transition is permitted in the graph and by actor role."""
    allowed_targets = ALLOWED_TRANSITIONS.get(current_status, {})
    if target_status not in allowed_targets:
        raise IllegalStateTransitionError(
            current_status=current_status,
            target_status=target_status,
            actor_role=actor_role,
            message=(
                f"Illegal state transition: Cannot transition application from "
                f"'{current_status.value}' to '{target_status.value}'."
            ),
        )

    authorized_roles = allowed_targets[target_status]
    if actor_role not in authorized_roles:
        role_names = [r.value for r in authorized_roles]
        raise IllegalStateTransitionError(
            current_status=current_status,
            target_status=target_status,
            actor_role=actor_role,
            message=(
                f"Unauthorized role: Role '{actor_role.value}' is not permitted to trigger "
                f"transition from '{current_status.value}' to '{target_status.value}'. "
                f"Permitted roles: {role_names}."
            ),
        )

    if target_status == ApplicationStatus.REJECTED and (not reason or not reason.strip()):
        raise IllegalStateTransitionError(
            current_status=current_status,
            target_status=target_status,
            actor_role=actor_role,
            message="A non-empty reason is mandatory when rejecting or cancelling an application.",
        )


async def execute_transition(
    session: AsyncSession,
    application: LoanApplication,
    target_status: ApplicationStatus,
    actor_id: Optional[uuid.UUID],
    actor_role: UserRole,
    reason: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> LoanApplication:
    """Execute lifecycle transition and write audit log atomically."""
    prior_status = application.status
    validate_transition(prior_status, target_status, actor_role, reason=reason)

    # Apply mutation
    application.status = target_status
    if target_status == ApplicationStatus.SUBMITTED and not application.submitted_at:
        application.submitted_at = utc_now()

    # Append audit trail in same transaction envelope
    audit_metadata = metadata or {}
    if reason:
        audit_metadata["reason"] = reason

    await record_audit_event(
        session=session,
        event_type=f"STATUS_TRANSITION_{target_status.value}",
        entity_name="loan_applications",
        entity_id=application.id,
        actor_id=actor_id,
        actor_role=actor_role.value,
        ip_address=ip_address,
        user_agent=user_agent,
        prior_state={"status": prior_status.value},
        subsequent_state={"status": target_status.value},
        metadata_snapshot=audit_metadata,
    )

    return application
