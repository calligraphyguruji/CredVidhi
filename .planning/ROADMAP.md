# Roadmap: Loan Approval Processing System (LAPS)

## Overview

This roadmap defines the 7-phase implementation trajectory for the **Loan Approval Processing System (LAPS)**. The project proceeds from low-level infrastructure foundations, authentication, and database schemas up through lifecycle state engines, document verification, deterministic financial underwriting, and comprehensive role-specific user interfaces, concluding with full-suite test automation and security hardening.

---

## Phases

- [ ] **Phase 1: Project Scaffolding & Infrastructure Foundations** - Containerized environment (PostgreSQL 16, Redis 7, MinIO), FastAPI backend skeleton, and React Vite frontend baseline.
- [ ] **Phase 2: Authentication, RBAC & Core Domain Data Models** - User identity, JWT authentication with Redis session store, role-based access control, loan product models, and initial database migrations.
- [ ] **Phase 3: Loan Application State Machine & Lifecycle Workflows** - Finite State Machine enforcing loan lifecycle transitions, atomic transaction envelopes, and queue management endpoints.
- [ ] **Phase 4: Document Upload, Storage & Verification Service** - Sandboxed S3-compatible document storage, presigned URLs, MIME/size validation, and officer verification checklist APIs.
- [ ] **Phase 5: Deterministic Financial Risk Engine & Underwriting** - Arbitrary-precision fixed-point math (`Decimal`), compound EMI calculation, DTI analysis, credit scoring rules, and underwriter decision recording.
- [ ] **Phase 6: Frontend Portals & Role-Based Workspaces** - Applicant self-service wizard, Loan Officer triage & document split-screen, Underwriter assessment cockpit, and Admin operations portal.
- [ ] **Phase 7: Comprehensive Testing, Audit Assurance & Production Hardening** - Full-suite automated test coverage (Pytest, Vitest, E2E), immutable audit trail verification, PII redaction, and deployment packaging.

---

## Phase Details

### Phase 1: Project Scaffolding & Infrastructure Foundations
**Goal**: Establish a reproducible, containerized local development environment and basic application scaffolds for both backend and frontend.  
**Depends on**: Nothing (first phase)  
**Requirements**: INFRA-01, INFRA-02, INFRA-03  
**Success Criteria**:
1. `docker compose up` spins up PostgreSQL 16, Redis 7, and MinIO with persistent volumes and health checks passing.
2. FastAPI backend boots with SQLAlchemy 2.0 async database connection and returns `200 OK` on `/api/health`.
3. React Vite frontend builds cleanly with Tailwind CSS, custom design tokens, and renders the application shell.

Plans:
- [ ] 01-01: Containerized infrastructure setup with Docker Compose (PostgreSQL, Redis, MinIO) and environment configuration.
- [ ] 01-02: FastAPI backend structure setup (async SQLAlchemy 2.0, Alembic configuration, standardized API error envelopes).
- [ ] 01-03: React 18 + TypeScript + Vite frontend scaffolding with Tailwind tokens, TanStack Query, and routing.

---

### Phase 2: Authentication, RBAC & Core Domain Data Models
**Goal**: Implement complete authentication, role-based authorization, and core relational database entities.  
**Depends on**: Phase 1  
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, DATA-01, DATA-02, DATA-03  
**Success Criteria**:
1. Users can register and log in to receive signed JWT access and refresh tokens.
2. Endpoint dependencies (`require_roles`) reject unauthorized role access with HTTP 403 Forbidden.
3. Database migrations create tables for Users, Loan Products, Applications, Documents, Assessments, Decisions, and Audit Logs.
4. Database seed command populates default loan products and administrative user accounts.

Plans:
- [ ] 02-01: SQLAlchemy models, UUID primary keys, and initial Alembic migration.
- [ ] 02-02: Password hashing, JWT token service, Redis session store, and FastAPI RBAC dependencies.
- [ ] 02-03: Loan products catalog endpoints and database seed script.
- [ ] 02-04: Frontend auth state management (Zustand) and protected route guards.

---

### Phase 3: Loan Application State Machine & Lifecycle Workflows
**Goal**: Build the finite state machine that governs the loan application lifecycle with atomic transactions and role queues.  
**Depends on**: Phase 2  
**Requirements**: FSM-01, FSM-02, FSM-03, FSM-04  
**Success Criteria**:
1. Application transitions strictly follow `DRAFT` $\to$ `SUBMITTED` $\to$ `UNDER_REVIEW` $\to$ `DOCUMENTS_PENDING` / `DOCUMENTS_VERIFIED` $\to$ `RISK_ASSESSED` $\to$ `APPROVED` / `REJECTED` $\to$ `DISBURSED`.
2. Attempting any illegal status jump raises `400 Bad Request` with code `ILLEGAL_STATE_TRANSITION`.
3. All status changes execute within atomic database transactions with automatic rollback on error.
4. Role-based queue APIs return appropriately filtered applications for applicants, loan officers, and risk underwriters.

Plans:
- [ ] 03-01: Core state machine engine and transition validator with atomic transactional envelopes.
- [ ] 03-02: Application CRUD, draft auto-save, and submission endpoints.
- [ ] 03-03: Role queue endpoints (Officer inbox, Underwriter queue, Applicant application list).

---

### Phase 4: Document Upload, Storage & Verification Service
**Goal**: Deliver secure file upload, storage, retrieval, and compliance checklist verification for applicant documents.  
**Depends on**: Phase 3  
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04  
**Success Criteria**:
1. Applicants can upload documents (PDF, JPEG, PNG, $\le$ 10MB) stored with UUID keys in S3/MinIO.
2. Authorized users can view documents via time-limited presigned URLs.
3. Loan officers can mark individual checklist items as `VERIFIED` or `DEFICIENT` with explanatory comments.
4. Application automatically advances to `DOCUMENTS_VERIFIED` once all mandatory documents pass verification.

Plans:
- [ ] 04-01: Storage service abstraction (S3/MinIO) with MIME detection, file size validation, and presigned URL generation.
- [ ] 04-02: Document upload and metadata persistence endpoints.
- [ ] 04-03: Officer verification checklist API and deficiency re-upload notification triggers.

---

### Phase 5: Deterministic Financial Risk Engine & Underwriting
**Goal**: Implement mathematical loan calculations, debt-to-income analysis, credit risk evaluation, and decision recording.  
**Depends on**: Phase 4  
**Requirements**: FIN-01, FIN-02, FIN-03, FIN-04, FIN-05  
**Success Criteria**:
1. EMI calculations use fixed-point `Decimal` arithmetic matching standard financial amortization tables to 2 decimal places.
2. DTI and disposable income are deterministically computed and compared against loan product threshold caps.
3. Deterministic risk engine assigns risk bands (Low/Medium/High) and generates an automated underwriting recommendation.
4. Underwriter can record final decision (`APPROVED`, `REJECTED`) with rationale, interest rate adjustments, and supervisor threshold flags.

Plans:
- [ ] 05-01: Financial math engine (fixed-point EMI amortization formula, DTI ratio, disposable income calculator).
- [ ] 05-02: Deterministic risk scoring and automated recommendation rules engine.
- [ ] 05-03: Underwriting assessment review and decision submission API.

---

### Phase 6: Frontend Portals & Role-Based Workspaces
**Goal**: Deliver high-fidelity, responsive React interfaces tailored to Applicants, Loan Officers, Risk Analysts, and Administrators.  
**Depends on**: Phase 5  
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05  
**Success Criteria**:
1. Applicant can complete the multi-step loan application form and view real-time status progression.
2. Loan Officer can triage queue items, inspect documents side-by-side, and submit checklist reviews.
3. Risk Analyst can evaluate application financials, view interactive DTI and risk breakdowns, and record decisions.
4. Admin can configure loan products and browse system audit logs.

Plans:
- [ ] 06-01: Shared UI components (steppers, status badges, metrics cards, data tables, modals, alerts).
- [ ] 06-02: Applicant Portal (Multi-step application stepper, file uploader, timeline status dashboard).
- [ ] 06-03: Loan Officer Dashboard (Triage queue, split-screen document review, deficiency request modal).
- [ ] 06-04: Risk Analyst Underwriting Workspace (Financial summary, DTI gauge, decision submission).
- [ ] 06-05: Admin Portal (Loan product management, user administration, audit log explorer).

---

### Phase 7: Comprehensive Testing, Audit Assurance & Production Hardening
**Goal**: Validate full system integrity, verify immutable audit trails and PII masking, and harden for production deployment.  
**Depends on**: Phase 6  
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, TEST-01, TEST-02, TEST-03  
**Success Criteria**:
1. Pytest suite passes with $\ge 90\%$ coverage on financial math and state machine rules.
2. Audit trail immutability verified; all status transitions and decisions produce corresponding audit logs with masked PII.
3. End-to-end integration tests execute full loan origination lifecycle from submission through disbursement.
4. Production Docker containers build cleanly and pass healthchecks.

Plans:
- [ ] 07-01: Backend unit & integration test suite (FSM transitions, math accuracy, RBAC security, audit persistence).
- [ ] 07-02: Frontend component and integration tests (Vitest + React Testing Library).
- [ ] 07-03: End-to-end full lifecycle integration tests and security verification (PII redaction, rate limiting, error sanitation).
- [ ] 07-04: Production Docker configuration, health check endpoints, and deployment documentation.
