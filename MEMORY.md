# Project Memory (MEMORY.md)
## System: CredVidhi (formerly LAPS)

- **Project Name:** CredVidhi (Loan Approval Processing & Verification System)
- **Primary Objective:** Deliver a secure, auditable, production-ready full-stack platform managing the complete loan origination, document verification, deterministic risk underwriting, and approval lifecycle.
- **Current Phase:** Phase 1: Frontend Client Scaffolding & Visual Identity
- **Last Updated:** 2026-09-27

---

## 1. Current Project State & Milestones

- **Phase 0 (Completed):** Creation of foundational governance, architecture, design, and testing specifications (`PRD.md`, `AGENTS.md`, `DESIGN.md`, `ARCHITECTURE.md`, `RULES.md`, `MEMORY.md`, `DECISIONS.md`, `TESTING.md`).
- **Phase 1 (Completed):** Scaffolding of complete frontend client (`frontend/`) in React + TypeScript + Vite + Tailwind CSS. Rebranded to **Dhanexa** with royal Saffron (`#EA580C`, `orange-600`) fintech aesthetics. Built and integrated a comprehensive production-grade motion and micro-interaction system using Framer Motion (`motion.ts`, `AnimatedCounter`, `Toast`, gliding `layoutId` pills, page transitions, and `prefers-reduced-motion` accessibility). CodeRabbit review verified and closed.
- **Phase 2 (Next):** FastAPI backend service endpoints, PostgreSQL models, and Alembic migrations.

---

## 2. Planned Architecture Summary

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand, Lucide Icons, Recharts.
- **Backend:** FastAPI (Python 3.11+), Pydantic v2, SQLAlchemy 2.0 (Async), Alembic.
- **Database:** PostgreSQL 16 (strict ACID transactions, UUID keys, NUMERIC precision).
- **Cache & Queue:** Redis 7 (session revocation, rate limiting, async tasks).
- **Storage:** Sandboxed filesystem with S3-compatible object storage interface.
- **Containerization:** Docker & Docker Compose.

---

## 3. Core Domain Terminology

- **DTI (Debt-to-Income Ratio):** Percentage of gross monthly income allocated to total monthly debt obligations including the new loan EMI.
- **EMI (Equated Monthly Installment):** Fixed payment amount made by a borrower to a lender at a specified date each calendar month.
- **FSM (Finite State Machine):** The strict sequence of allowed lifecycle statuses for an application (`DRAFT` $\to$ `SUBMITTED` $\to$ `UNDER_REVIEW` $\to$ `DOCUMENTS_PENDING` / `DOCUMENTS_VERIFIED` $\to$ `RISK_ASSESSED` $\to$ `APPROVED` / `REJECTED` $\to$ `DISBURSED`).
- **RBAC (Role-Based Access Control):** Permissions partitioned into `APPLICANT`, `LOAN_OFFICER`, `RISK_ANALYST`, and `ADMIN`.
- **Audit Trail:** Append-only, immutable record capturing every actor, event, prior state, and post state.

---

## 4. Key Constraints & Initial Assumptions

### Constraints
1. No external credit bureau APIs (CIBIL, Experian, Equifax) in MVP. Risk assessment must use deterministic internal scoring.
2. No live payment gateway/ACH integration in MVP. Disbursement is recorded as an operational milestone.
3. Strict zero-tolerance for floating-point math in financial fields; use fixed-point `Decimal` / `NUMERIC(14, 2)`.
4. High-sensitivity PII must be encrypted at rest and masked in responses.

### Initial Assumptions (Pending User Confirmation)
- Maximum allowable DTI default threshold: 45% (configurable per loan product).
- Document file size limit: 10MB; permitted types: PDF, JPEG, PNG.
- Single-institution enterprise deployment model (not multi-tenant SaaS).

---

## 5. Known Unknowns

1. Specific organizational requirements for committee approvals vs. single-underwriter signoff on loans above high-value thresholds.
2. Target cloud provider storage preference (AWS S3, Azure Blob, Google Cloud Storage, or self-hosted MinIO).
3. Email notification provider selection for post-MVP asynchronous alerts (e.g., SendGrid, AWS SES, or SMTP).

---

## 6. Agent Learnings

This section will be updated later as agents discover important project-specific information.
*(No learnings recorded yet - project is in Phase 0 planning).*
