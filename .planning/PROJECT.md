# Loan Approval Processing System (LAPS)

## What This Is

The **Loan Approval Processing System (LAPS)** is a secure, compliant, auditable, full-stack financial platform designed to manage the end-to-end lifecycle of retail and commercial loan applications. It transitions lending institutions from fragmented, manual underwriting to an automated, deterministic digital workflow with strict role-based access control, document verification, mathematical risk underwriting, and immutable audit trails.

## Core Value

Deterministic, auditable loan lifecycle execution with zero math error, strict role segregation, and tamper-proof state transitions.

## Business Context

- **Customer**: Non-Banking Financial Companies (NBFCs), retail banks, and digital lending institutions.
- **Revenue model**: Enterprise lending operations platform.
- **Success metric**: 60% reduction in loan turnaround time (TAT) while maintaining 100% mathematical determinism and compliance auditability.
- **Strategy notes**: Follows specifications defined in [PRD.md](file:///Users/calligraphyguruji/Loan%20Processing/PRD.md) and [ARCHITECTURE.md](file:///Users/calligraphyguruji/Loan%20Processing/ARCHITECTURE.md).

## Requirements

### Validated

- [x] Initial governance, PRD, Architecture, Rules, and ADR documentation established in repo.

### Active

- [ ] Multi-role authentication & RBAC (`APPLICANT`, `LOAN_OFFICER`, `RISK_ANALYST`, `ADMIN`).
- [ ] Strict loan application Finite State Machine (`DRAFT` $\to$ `SUBMITTED` $\to$ `UNDER_REVIEW` $\to$ `DOCUMENTS_PENDING` / `DOCUMENTS_VERIFIED` $\to$ `RISK_ASSESSED` $\to$ `APPROVED` / `REJECTED` $\to$ `DISBURSED`).
- [ ] Sandboxed document upload & checklist verification system with secure obfuscated storage.
- [ ] Purely deterministic, fixed-point financial calculation engine (EMI, DTI, disposable income, risk tiers).
- [ ] ACID transaction envelopes with append-only immutable audit logging.
- [ ] Responsive modern React frontend with role-specific dashboards (Applicant, Officer, Analyst, Admin).
- [ ] Automated end-to-end and unit testing verification pipelines.

### Out of Scope

- **Live External Credit Bureaus (CIBIL/Experian)** — Simulated internally via deterministic scoring to isolate external dependencies during initial release.
- **Automated Payment Gateway / ACH Disbursement** — Recorded as operational milestones; direct wire transfers are handled by external banking cores.
- **Post-Disbursement Servicing & Collections** — Dedicated Loan Management Systems (LMS) handle multi-year installment collections.
- **Multi-Tenant SaaS Partitioning** — Initial release targets a single-institution enterprise deployment model.

## Context

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand, Lucide React.
- **Backend**: FastAPI (Python 3.11+), Pydantic v2, SQLAlchemy 2.0 (Async), Alembic.
- **Database & Cache**: PostgreSQL 16 (strict ACID, NUMERIC fixed-point arithmetic), Redis 7 (sessions, revocation, queues).
- **Storage**: Sandboxed object storage abstraction (MinIO / S3 compatible).
- **Environment**: Docker & Docker Compose.

## Constraints

- Zero floating-point calculations for monetary values (strictly use `Decimal` / `NUMERIC(14,2)`).
- All status transitions and document verifications must execute inside atomic transactions (`async with db.begin():`).
- Audit logs and loan records are strictly append-only (no hard deletes).
- PII (SSN, PAN, Tax ID) must be masked (`***-**-1234`) in logs and external responses.
- Every API endpoint must enforce explicit role permissions (`require_roles`).
