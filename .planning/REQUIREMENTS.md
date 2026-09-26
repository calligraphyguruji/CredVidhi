# Requirements: Loan Approval Processing System (LAPS)

**Defined:** 2026-09-27  
**Core Value:** Deterministic, auditable loan lifecycle execution with zero math error, strict role segregation, and tamper-proof state transitions.

## v1 Requirements

### 1. Project Foundations & Infrastructure (INFRA)

- [ ] **INFRA-01**: Docker Compose environment orchestrating PostgreSQL 16, Redis 7, MinIO S3 storage, and application containers.
- [ ] **INFRA-02**: FastAPI backend skeleton with async SQLAlchemy 2.0 engine, Alembic migrations, and standardized error envelopes.
- [ ] **INFRA-03**: React 18 + Vite + TypeScript frontend skeleton with Tailwind CSS design tokens, routing, and TanStack Query provider.

### 2. Authentication & Authorization (AUTH)

- [ ] **AUTH-01**: User registration and login with email, hashed passwords (Argon2 / bcrypt), and role assignment (`APPLICANT`, `LOAN_OFFICER`, `RISK_ANALYST`, `ADMIN`).
- [ ] **AUTH-02**: JWT token generation (short-lived access token, rotating refresh token stored/blacklisted in Redis).
- [ ] **AUTH-03**: FastAPI RBAC dependency guard (`require_roles`) enforcing endpoint authorization.
- [ ] **AUTH-04**: Frontend auth state management (Zustand) with route protection by role.

### 3. Core Data Modeling & Loan Products (DATA)

- [ ] **DATA-01**: Relational schemas with UUID primary keys for Users, Loan Products, Applications, Documents, Risk Assessments, Decisions, and Audit Logs.
- [ ] **DATA-02**: Loan Products catalog API supporting personal, auto, and mortgage loans with configurable interest rates, tenors, and maximum DTI thresholds.
- [ ] **DATA-03**: Seed scripts populating initial loan products and administrative accounts.

### 4. Loan Application State Machine (FSM)

- [ ] **FSM-01**: Finite State Machine enforcing valid status transitions (`DRAFT` $\to$ `SUBMITTED` $\to$ `UNDER_REVIEW` $\to$ `DOCUMENTS_PENDING` / `DOCUMENTS_VERIFIED` $\to$ `RISK_ASSESSED` $\to$ `APPROVED` / `REJECTED` $\to$ `DISBURSED`).
- [ ] **FSM-02**: State transitions executed within atomic ACID transaction blocks; rollback occurs if state or audit logging fails.
- [ ] **FSM-03**: Rejection of illegal transitions with standardized HTTP 400 `ILLEGAL_STATE_TRANSITION` error envelopes.
- [ ] **FSM-04**: Role-filtered queue endpoints for loan officers, risk underwriters, and applicants.

### 5. Document Management & Verification (DOC)

- [ ] **DOC-01**: Secure multipart file upload API with UUID storage paths, mime validation (PDF, PNG, JPEG), and 10MB size limit.
- [ ] **DOC-02**: Presigned time-limited URLs for authorized document viewing and download.
- [ ] **DOC-03**: Loan officer document checklist review API (mark `VERIFIED`, mark `DEFICIENT` with comments, request re-upload).
- [ ] **DOC-04**: Automatic transition to `DOCUMENTS_VERIFIED` when all mandatory checklist items are validated.

### 6. Deterministic Financial & Risk Engine (FIN)

- [ ] **FIN-01**: Arbitrary-precision fixed-point math (`Decimal`) for all financial amounts, zero floating-point arithmetic.
- [ ] **FIN-02**: Exact monthly EMI computation using standard compound amortization formula.
- [ ] **FIN-03**: Debt-to-Income (DTI) ratio and disposable income calculations with configurable product caps.
- [ ] **FIN-04**: Deterministic credit risk tier classification (Low Risk $\ge 750$, Medium Risk 650–749, High Risk $< 650$) and automated recommendation engine.
- [ ] **FIN-05**: Underwriter decision recording (`APPROVED` / `REJECTED`), conditional approval terms, and supervisor escalation threshold rules.

### 7. Audit Logging & Governance (AUDIT)

- [ ] **AUDIT-01**: Append-only audit trail recording user ID, IP address, user-agent, action, before-state, after-state, and timestamp for all critical mutations.
- [ ] **AUDIT-02**: Immutable audit log table preventing updates or deletions.
- [ ] **AUDIT-03**: Sensitive PII masking (National ID / SSN masked to last 4 digits) across logs and responses.
- [ ] **AUDIT-04**: Admin audit query API with multi-field filtering (application ID, actor ID, date range, action type).

### 8. Frontend User Experiences (UI)

- [ ] **UI-01**: Multi-step Applicant wizard (Personal info, Employment/Income, Loan requirements, Document upload, Review & Submit).
- [ ] **UI-02**: Applicant real-time status tracker with progress timeline and transparent decision rationale.
- [ ] **UI-03**: Loan Officer workbench: queue table, triage filters, split-screen document inspector, and verification checklist.
- [ ] **UI-04**: Risk Analyst workspace: applicant financial overview, interactive DTI visualization, risk scoring matrix, and approval/rejection modal.
- [ ] **UI-05**: Admin Portal: product configuration panel, staff management, and system-wide immutable audit trail browser.

### 9. Quality, Testing & Hardening (TEST)

- [ ] **TEST-01**: Backend pytest suite covering financial math precision, state machine transition validity, auth RBAC, and atomic rollback.
- [ ] **TEST-02**: Frontend test suite with Vitest / React Testing Library for core form steppers and role guards.
- [ ] **TEST-03**: End-to-end integration tests validating a full application lifecycle from submission to decision.

---

## Traceability Matrix

| Requirement Group | Phase | Status |
| :--- | :--- | :--- |
| INFRA-01 - INFRA-03 | Phase 1: Infrastructure & Scaffolding | Pending |
| AUTH-01 - AUTH-04, DATA-01 - DATA-03 | Phase 2: Auth, RBAC & Core Data Models | Pending |
| FSM-01 - FSM-04 | Phase 3: Loan Lifecycle & State Machine | Pending |
| DOC-01 - DOC-04 | Phase 4: Document Storage & Verification | Pending |
| FIN-01 - FIN-05 | Phase 5: Deterministic Financial Risk Engine | Pending |
| UI-01 - UI-05 | Phase 6: Frontend Portals & Dashboards | Pending |
| AUDIT-01 - AUDIT-04, TEST-01 - TEST-03 | Phase 7: Audit Verification & System Hardening | Pending |
