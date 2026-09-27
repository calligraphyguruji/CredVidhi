"""Initial relational schema for CredVidhi LAPS.

Revision ID: 0001
Revises:
Create Date: 2026-09-27 15:45:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Users Table
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("phone_number", sa.String(20), nullable=True),
        sa.Column("pan_number", sa.String(10), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])

    # 2. Loan Products Table
    op.create_table(
        "loan_products",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("min_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("max_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("min_tenor_months", sa.Integer(), nullable=False),
        sa.Column("max_tenor_months", sa.Integer(), nullable=False),
        sa.Column("base_apr", sa.Numeric(5, 2), nullable=False),
        sa.Column("max_dti_ratio", sa.Numeric(5, 2), nullable=False, server_default="45.00"),
        sa.Column("required_documents", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_loan_products_code", "loan_products", ["code"], unique=True)

    # 3. Loan Applications Table
    op.create_table(
        "loan_applications",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("reference_number", sa.String(64), nullable=False),
        sa.Column("applicant_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "product_id", sa.Uuid(as_uuid=True), sa.ForeignKey("loan_products.id"), nullable=False
        ),
        sa.Column(
            "assigned_officer_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id"), nullable=True
        ),
        sa.Column("status", sa.String(50), nullable=False, server_default="DRAFT"),
        sa.Column("requested_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("requested_tenor_months", sa.Integer(), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=True),
        sa.Column("applicant_personal_snapshot", sa.JSON(), nullable=True),
        sa.Column("applicant_financial_snapshot", sa.JSON(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index(
        "ix_loan_applications_reference_number",
        "loan_applications",
        ["reference_number"],
        unique=True,
    )
    op.create_index("ix_loan_applications_applicant_id", "loan_applications", ["applicant_id"])
    op.create_index("ix_loan_applications_product_id", "loan_applications", ["product_id"])
    op.create_index(
        "ix_loan_applications_assigned_officer_id", "loan_applications", ["assigned_officer_id"]
    )
    op.create_index("ix_loan_applications_status", "loan_applications", ["status"])

    # 4. Application Documents Table
    op.create_table(
        "application_documents",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "application_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("loan_applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("document_type", sa.String(50), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("storage_path", sa.String(512), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("file_hash", sa.String(64), nullable=True),
        sa.Column("verification_status", sa.String(50), nullable=False, server_default="PENDING"),
        sa.Column("verified_by", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("verification_remarks", sa.Text(), nullable=True),
        sa.Column(
            "uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index(
        "ix_application_documents_application_id", "application_documents", ["application_id"]
    )
    op.create_index(
        "ix_application_documents_verification_status",
        "application_documents",
        ["verification_status"],
    )

    # 5. Risk Assessments Table
    op.create_table(
        "risk_assessments",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "application_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("loan_applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("calculated_dti", sa.Numeric(5, 2), nullable=False),
        sa.Column("calculated_emi", sa.Numeric(14, 2), nullable=False),
        sa.Column("disposable_income", sa.Numeric(14, 2), nullable=False),
        sa.Column("internal_risk_score", sa.Integer(), nullable=False),
        sa.Column("risk_tier", sa.String(20), nullable=False),
        sa.Column("recommendation", sa.String(50), nullable=False),
        sa.Column("score_factors_breakdown", sa.JSON(), nullable=True),
        sa.Column(
            "evaluated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index(
        "ix_risk_assessments_application_id", "risk_assessments", ["application_id"], unique=True
    )

    # 6. Loan Decisions Table
    op.create_table(
        "loan_decisions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "application_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("loan_applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "underwriter_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("decision", sa.String(50), nullable=False),
        sa.Column("approved_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("approved_apr", sa.Numeric(5, 2), nullable=True),
        sa.Column("approved_tenor_months", sa.Integer(), nullable=True),
        sa.Column("rejection_reason_code", sa.String(100), nullable=True),
        sa.Column("underwriter_notes", sa.Text(), nullable=True),
        sa.Column(
            "decided_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index(
        "ix_loan_decisions_application_id", "loan_decisions", ["application_id"], unique=True
    )
    op.create_index("ix_loan_decisions_underwriter_id", "loan_decisions", ["underwriter_id"])

    # 7. Audit Logs Table
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("entity_name", sa.String(100), nullable=False),
        sa.Column("entity_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("actor_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("actor_role", sa.String(50), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("prior_state", sa.JSON(), nullable=True),
        sa.Column("subsequent_state", sa.JSON(), nullable=True),
        sa.Column("metadata_snapshot", sa.JSON(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_audit_logs_event_type", "audit_logs", ["event_type"])
    op.create_index("ix_audit_logs_entity_name", "audit_logs", ["entity_name"])
    op.create_index("ix_audit_logs_entity_id", "audit_logs", ["entity_id"])
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("loan_decisions")
    op.drop_table("risk_assessments")
    op.drop_table("application_documents")
    op.drop_table("loan_applications")
    op.drop_table("loan_products")
    op.drop_table("users")
