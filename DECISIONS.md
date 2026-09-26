# Architecture Decision Records (DECISIONS.md)
## System: Loan Approval Processing System (LAPS)

This document tracks all formal architectural and engineering decisions using the standard Architecture Decision Record (ADR) format.

---

## Index of Decisions

- [ADR-001: Backend Framework Selection (FastAPI)](#adr-001-backend-framework-selection-fastapi)
- [ADR-002: Primary Database Selection (PostgreSQL)](#adr-002-primary-database-selection-postgresql)
- [ADR-003: Frontend Architecture & Tooling (React + Vite + TypeScript)](#adr-003-frontend-architecture--tooling-react--vite--typescript)
- [ADR-004: Authentication Strategy (Stateless JWT + Rotating HttpOnly Refresh Tokens)](#adr-004-authentication-strategy-stateless-jwt--rotating-httponly-refresh-tokens)
- [ADR-005: Role-Based Access Control (RBAC) Enforcement Model](#adr-005-role-based-access-control-rbac-enforcement-model)
- [ADR-006: Loan Application Lifecycle State Machine Design](#adr-006-loan-application-lifecycle-state-machine-design)
- [ADR-007: Document Storage and Access Architecture](#adr-007-document-storage-and-access-architecture)
- [ADR-008: Deterministic Internal Risk & Underwriting Scoring Engine](#adr-008-deterministic-internal-risk--underwriting-scoring-engine)
- [ADR-009: Immutable Audit Logging Architecture](#adr-009-immutable-audit-logging-architecture)
- [ADR-010: Database Migration Strategy with Alembic](#adr-010-database-migration-strategy-with-alembic)

---

### ADR-001: Backend Framework Selection (FastAPI)
- **Status:** Proposed
- **Date:** 2026-09-10
- **Decision:** Select **FastAPI (Python 3.11+)** with ASGI (`uvicorn`) as the primary backend API framework.
- **Context:** The system requires high concurrency for document uploads, strict data validation for financial formulas, auto-generated API specifications, and robust asynchronous database access.
- **Reasoning:**
  - Native integration with Pydantic v2 ensures bulletproof request/response validation with zero runtime overhead.
  - Asynchronous endpoint handling (`async`/`await`) excels at concurrent I/O (document streaming, database queries).
  - Automatically generates interactive OpenAPI (Swagger) documentation, improving frontend-backend contract adherence.
  - Python ecosystem provides top-tier libraries for financial computations, risk modeling, and future machine learning integrations.
- **Alternatives Considered:**
  - *Django / Django REST Framework:* Highly mature with built-in admin, but heavier, synchronous by default, and less flexible for custom async state machine pipelines.
  - *Node.js / Express or NestJS:* Strong concurrency, but lacks Python's mathematical ecosystem for financial underwriting models.
- **Consequences:** All backend engineers must adhere to async Python patterns and SQLAlchemy 2.0 async sessions.

---

### ADR-002: Primary Database Selection (PostgreSQL)
- **Status:** Proposed
- **Date:** 2026-09-10
- **Decision:** Use **PostgreSQL 16** as the central relational data store.
- **Context:** Financial applications require strict ACID transactional guarantees, strong foreign key constraints, high concurrency row locking, and immutable audit persistence.
- **Reasoning:**
  - Uncompromising ACID transactional semantics prevent race conditions during application state transitions.
  - Native `NUMERIC` data types prevent floating-point rounding errors in currency and interest rate calculations.
  - Robust `JSONB` support allows structured snapshot storage (e.g., historical financial snapshots, audit deltas) alongside relational tables.
  - Superior ecosystem for database migration tooling (Alembic) and connection pooling.
- **Alternatives Considered:**
  - *MongoDB:* Lacks native multi-table relational foreign key constraints and strict relational integrity required for financial workflows.
  - *MySQL:* Viable, but PostgreSQL provides better JSONB indexing, enum type handling, and advanced transactional features.
- **Consequences:** Requires PostgreSQL instance in docker-compose for local development and managed RDS/Cloud SQL in production.

---

### ADR-003: Frontend Architecture & Tooling (React + Vite + TypeScript)
- **Status:** Proposed
- **Date:** 2026-09-10
- **Decision:** Build the client as a Single Page Application (SPA) using **React 18+, TypeScript, Vite, Tailwind CSS, TanStack Query, and Zustand**.
- **Context:** The application features two distinct rich user workspaces: a multi-step applicant submission wizard and a dense, split-screen staff review dashboard.
- **Reasoning:**
  - Strict TypeScript interfaces shared with backend API contracts eliminate runtime schema mismatches.
  - TanStack Query provides automated cache invalidation, background synchronization, and optimistic UI updates for queue management.
  - Tailwind CSS enables precise implementation of the fintech design tokens specified in `DESIGN.md` without CSS bundle bloat.
  - Vite offers rapid HMR and lightweight production builds.
- **Alternatives Considered:**
  - *Next.js (App Router):* Excellent for public-facing SSR/SEO, but LAPS is an authenticated intranet/portal application where SSR complexity and server action overhead are unnecessary.
  - *Vue 3:* Capable, but React has deeper ecosystem support for complex data tables, PDF viewers, and charts.
- **Consequences:** Client routing handled client-side via React Router; static distribution via CDN or Nginx container.

---

### ADR-004: Authentication Strategy (Stateless JWT + Rotating HttpOnly Refresh Tokens)
- **Status:** Proposed
- **Date:** 2026-09-10
- **Decision:** Implement **short-lived stateless JWT access tokens (15 minutes)** paired with **rotating, secure HTTP-only refresh tokens (7 days)** backed by Redis session revocation.
- **Context:** Need secure authentication that protects against XSS token theft while minimizing database lookup overhead on every authenticated API request.
- **Reasoning:**
  - Storing refresh tokens in `HttpOnly`, `Secure`, `SameSite=Strict` cookies completely prevents JavaScript XSS access.
  - Short 15-minute access token lifespan limits exposure window if a token is compromised.
  - Redis-backed refresh token registry allows immediate revocation on logout or suspected security events.
- **Alternatives Considered:**
  - *Pure Server-Side Sessions (Session Cookies):* Simpler revocation, but requires database or cache lookup on every single API request, increasing latency under high load.
  - *Long-lived JWT in LocalStorage:* Severe security risk; highly vulnerable to client-side XSS attacks.
- **Consequences:** Requires cross-origin cookie configuration (`credentials: 'include'`) and token refresh interceptors on the frontend.

---

### ADR-005: Role-Based Access Control (RBAC) Enforcement Model
- **Status:** Proposed
- **Date:** 2026-09-10
- **Decision:** Enforce authorization at the FastAPI route boundary using declarative dependency injection (`Depends(require_roles([Role.LOAN_OFFICER, Role.ADMIN]))`).
- **Context:** LAPS supports 4 roles (`APPLICANT`, `LOAN_OFFICER`, `RISK_ANALYST`, `ADMIN`) with distinct privilege boundaries that must be strictly audited.
- **Reasoning:**
  - FastAPI dependencies execute before route handlers, guaranteeing unprivileged requests are rejected at the edge with standard `403 Forbidden` responses.
  - Prevents authorization leakage or forgotten checks inside deep business logic.
  - Resource-level ownership checks (e.g., verifying that an applicant only views their own application) are enforced in the service layer using explicit entity ownership guards.
- **Alternatives Considered:**
  - *Attribute-Based Access Control (ABAC) with Casbin/OPA:* Powerful, but overengineered for the 4 explicit user roles in this project.
- **Consequences:** Every single new endpoint must declare its security dependencies explicitly; missing dependencies will fail automated security tests.

---

### ADR-006: Loan Application Lifecycle State Machine Design
- **Status:** Proposed
- **Date:** 2026-09-10
- **Decision:** Implement an explicit, deterministic **Finite State Machine (FSM)** in a dedicated `state_machine.py` service.
- **Context:** Application status progression (`DRAFT` $\to$ `SUBMITTED` $\to$ `UNDER_REVIEW` $\to$ `DOCUMENTS_PENDING` / `DOCUMENTS_VERIFIED` $\to$ `RISK_ASSESSED` $\to$ `APPROVED` / `REJECTED` $\to$ `DISBURSED`) must prevent illegal transitions, race conditions, and bypass of verification checks.
- **Reasoning:**
  - Centralizing allowed transitions in a single transition map prevents fragmented conditional logic scattered across multiple controllers.
  - Transition calls automatically enforce pre-conditions (e.g., "Cannot transition to `DOCUMENTS_VERIFIED` unless all mandatory documents have status `VERIFIED`").
  - Automatically triggers audit logging and in-app notifications on every valid transition.
- **Alternatives Considered:**
  - *Ad-hoc status updates in controller endpoints:* Highly error-prone and vulnerable to state manipulation bugs.
- **Consequences:** Any new status or transition must be formally added to the transition matrix and covered by unit tests.

---

### ADR-007: Document Storage and Access Architecture
- **Status:** Proposed
- **Date:** 2026-09-10
- **Decision:** Store documents in an isolated, non-public storage volume using an abstract **StorageService** interface, referencing files solely by UUID.
- **Context:** Loan documents contain confidential identity and income information (passports, payslips, bank statements) that must be protected against unauthorized access and filename traversal attacks.
- **Reasoning:**
  - Obfuscating filenames with UUIDs prevents path traversal and guessing attacks.
  - Abstracting storage behind an interface allows seamless switching between local sandboxed storage in development and S3/MinIO in production.
  - Serving files via authenticated streaming endpoints ensures every document download verifies user authorization and writes an audit event.
- **Alternatives Considered:**
  - *Storing binaries directly in PostgreSQL (BYTEA):* Dramatically bloats database backups and degrades relational query performance.
  - *Public static asset folders:* Inadmissible security violation for sensitive financial records.
- **Consequences:** File downloads require passing through FastAPI streaming handlers or short-lived signed URLs.

---

### ADR-008: Deterministic Internal Risk & Underwriting Scoring Engine
- **Status:** Proposed
- **Date:** 2026-09-10
- **Decision:** Implement a pure-function, deterministic risk evaluation engine calculating standard DTI, EMI, and a 0–1000 weighted risk score without external API dependencies for MVP.
- **Context:** The system requires consistent underwriting recommendations without relying on unconfigured or costly third-party credit bureau APIs during initial development.
- **Reasoning:**
  - Eliminates external API dependencies and simulation flakiness during testing.
  - Pure deterministic functions are 100% testable across edge cases (extreme incomes, negative cashflows, boundary DTIs).
  - Clear separation allows future integration of external credit bureaus (Experian/CIBIL) as pluggable strategy providers in Phase 3.
- **Alternatives Considered:**
  - *Simulated live calls to credit bureau mock endpoints:* Adds network failure modes and misleading claims of third-party integration.
- **Consequences:** Clear documentation in UI that the score is an internal rule-based qualification score, not an external bureau score.

---

### ADR-009: Immutable Audit Logging Architecture
- **Status:** Proposed
- **Date:** 2026-09-10
- **Decision:** Record all lifecycle transitions, document reviews, and decision actions in an append-only `audit_logs` database table within the primary ACID transaction.
- **Context:** Regulatory compliance and internal accountability require non-repudiable audit trails of who took what action on an application and when.
- **Reasoning:**
  - Wrapping audit log creation in the same transaction as the state change ensures that if the audit log fails, the state change is aborted (guaranteeing zero untracked state mutations).
  - Database permissions can be configured to disallow `UPDATE` and `DELETE` on the `audit_logs` table.
  - Captures `old_state` and `new_state` as JSONB for detailed forensic diffs.
- **Alternatives Considered:**
  - *Asynchronous audit logging via message queue:* Faster write performance, but introduces risk of lost audit records if the message queue crashes before state synchronization.
- **Consequences:** Slight write latency overhead per status change, deemed acceptable for financial compliance.

---

### ADR-010: Database Migration Strategy with Alembic
- **Status:** Proposed
- **Date:** 2026-09-10
- **Decision:** Manage all PostgreSQL database schema changes through version-controlled **Alembic** migration scripts.
- **Context:** Need safe, reproducible, and verifiable database schema evolution across all development and production environments.
- **Reasoning:**
  - Provides bidirectional schema versioning (`upgrade()` and `downgrade()`).
  - Auto-generation from SQLAlchemy metadata detects drift between Python models and SQL schemas.
  - Integrates directly into CI/CD pipelines to verify schema migration validity on every PR.
- **Alternatives Considered:**
  - *Raw SQL migration files:* Difficult to maintain and lacks automatic drift detection with SQLAlchemy models.
- **Consequences:** Developers must run `alembic revision --autogenerate` and inspect generated migration scripts for every model modification.
