# Comprehensive Testing Strategy (TESTING.md)
## System: Loan Approval Processing System (LAPS)

This document establishes the official testing philosophy, test tiers, mandatory test matrices, commands, and verification criteria for LAPS. It is engineered to enable both human engineers and autonomous AI agents (operating in iterative or Ralph Loop workflows) to verify system integrity automatically before marking any task complete.

---

## 1. Testing Philosophy & Guardrails

1. **Zero Unverified Commits:** No code change shall be merged without passing its corresponding unit, integration, and security checks.
2. **Deterministic & Isolated:** Tests must never depend on external network services, public third-party APIs, or live clock state. Use fixed seeds, frozen timestamps (`freezegun`), and isolated test database transactions.
3. **The Testing Pyramid:**
   - **Unit Tests (60%):** Pure math calculations, state machine transitions, password hashing, DTO validation schemas.
   - **Integration & API Tests (30%):** FastAPI endpoints, database transaction rollbacks, RBAC access guards, document storage.
   - **End-to-End Tests (10%):** Critical end-to-end browser journeys via Playwright (e.g., Application submission $\to$ Officer document verification $\to$ Underwriter approval).
4. **Autonomous Agent Compatibility:** All test suites must return standard exit codes (`0` for success, non-zero for failure) and structured error output for rapid programmatic parsing.

---

## 2. Test Environments & Database Isolation

- **Backend Test Runner:** `pytest` with `pytest-asyncio` and `httpx.AsyncClient`.
- **Database Isolation Strategy:** Tests run against a dedicated PostgreSQL test container (`laps_test_db`). Each test function executes within a nested database savepoint/transaction that automatically rolls back upon test completion, guaranteeing pristine state for subsequent tests without slow table drops.
- **Frontend Test Runner:** `vitest` with `@testing-library/react` and `jsdom` for unit/component tests; `playwright` for end-to-end user flows.

---

## 3. Core Feature Testing Checklists

### 3.1 Authentication & Authorization Matrix
- [ ] **Registration:** Valid user registration creates record with Argon2id hashed password; duplicate email returns `409 Conflict`.
- [ ] **Login:** Valid credentials return short-lived access JWT and set `HttpOnly` refresh cookie; invalid credentials return `401 Unauthorized` without leaking user existence.
- [ ] **Token Expiration & Refresh:** Expired access token rejected (`401`); refresh endpoint returns valid new token and rotates refresh cookie; revoked refresh token rejected.
- [ ] **RBAC Enforcement Matrix:**
  - `APPLICANT` accessing `/api/v1/applications/queue` $\to$ `403 Forbidden`.
  - `APPLICANT` accessing another user's application $\to$ `403 Forbidden` / `404 Not Found`.
  - `LOAN_OFFICER` executing `/api/v1/applications/{id}/decision` $\to$ `403 Forbidden`.
  - `RISK_ANALYST` executing `/api/v1/applications/{id}/decision` $\to$ `200 OK`.
  - `LOAN_OFFICER` or `RISK_ANALYST` accessing `/api/v1/audit-logs` $\to$ `403 Forbidden`.
  - `ADMIN` has access to audit logs, product configurations, and system queues.

### 3.2 Loan Application Submission & Management
- [ ] **Draft Creation:** User can create draft application with partial data (`status = 'DRAFT'`).
- [ ] **Draft Editing:** User can update draft fields freely.
- [ ] **Validation on Submission:** Missing mandatory fields (income, requested amount, tenor) triggers `422 Unprocessable Entity`.
- [ ] **Transition to Submitted:** Submitting a complete application changes status to `SUBMITTED` and populates `submitted_at` timestamp.
- [ ] **Locking Post-Submission:** Any applicant attempt to modify application payload while in `SUBMITTED` returns `400 Bad Request`.
- [ ] **Reference Number Generation:** Each submission assigns a unique human-readable reference number (e.g., `APP-2026-XXXX`).

### 3.3 Document Upload & Verification
- [ ] **File MIME & Magic Byte Validation:** Renaming a `.exe` to `.pdf` is detected and rejected with `400 Bad Request`.
- [ ] **File Size Boundary:** Uploading a file $>10\text{MB}$ is rejected (`413 Payload Too Large`).
- [ ] **Secure Storage Key:** Stored file path uses UUID, not original client filename.
- [ ] **Officer Verification Actions:** Officer can mark document `VERIFIED` or `REJECTED` (with required remark).
- [ ] **Mandatory Document Gate:** Transitioning application to `DOCUMENTS_VERIFIED` fails if any mandatory document for the loan product is missing or not `VERIFIED`.
- [ ] **Deficiency Loop:** If officer rejects a document, application transitions to `DOCUMENTS_PENDING` and notifies applicant.

### 3.4 Deterministic Risk Engine & Underwriting Calculations
- [ ] **Standard Amortization Formula (EMI):** Verify calculated EMI against reference amortization tables across multiple interest rates ($5\%$, $10.5\%$, $18\%$) and tenors ($12$, $36$, $60$, $120$, $240$ months).
- [ ] **Debt-to-Income (DTI) Precision:** Verify correct decimal handling with zero existing debt, moderate existing debt, and high existing debt.
- [ ] **Disposable Income Cushion:** Verify calculation when expenses exceed income (negative disposable income flags high risk).
- [ ] **Scoring Engine Matrix:**
  - Optimal borrower (High income, $<20\%$ DTI, salaried $>5$ yrs) $\to$ Score $\ge 750$, Category `LOW RISK`, Recommendation `APPROVE`.
  - Borderline borrower ($42\%$ DTI, self-employed) $\to$ Score $600-749$, Category `MEDIUM RISK`, Recommendation `REFER`.
  - Excessive debt borrower ($>55\%$ DTI) $\to$ Score $<600$, Category `HIGH RISK`, Recommendation `REJECT`.
- [ ] **Edge Cases:** Zero income, negative expenses, loan amount exceeding product maximum, tenor below product minimum.

### 3.5 Approval, Rejection & Disbursement Workflow
- [ ] **Approval Payload Validation:** Approved amount, APR, and tenor must be recorded.
- [ ] **Rejection Payload Validation:** Rejection requires valid enum reason code (e.g., `DTI_EXCEEDED`) and explanatory notes.
- [ ] **State Machine Enforcement:** Rejecting or approving an application not in `RISK_ASSESSED` or `DOCUMENTS_VERIFIED` state returns `400 Bad Request`.
- [ ] **Terminal State Lock:** Once `REJECTED` or `DISBURSED`, no further state transitions are permitted.

### 3.6 Audit Trail & Notifications
- [ ] **Transaction Atomicity:** If writing to `audit_logs` fails during state transition, the entire transaction rolls back; application status remains unchanged.
- [ ] **Log Payload Content:** Audit entry records `actor_id`, `actor_role`, `event_type`, `old_state`, `new_state`, `ip_address`, and timestamp.
- [ ] **Notification Generation:** Appropriate in-app notification is inserted for applicant upon submission, document request, approval, and rejection.

---

## 4. Verification Commands for Developers & AI Agents

Before marking any task complete, the following command suite must be executed with all checks passing:

### 4.1 Backend Verification Suite
```bash
# 1. Run static type checking
cd backend && poetry run mypy app

# 2. Run code style and linter
cd backend && poetry run ruff check app

# 3. Run full unit and integration test suite with coverage
cd backend && poetry run pytest tests/ -v --cov=app --cov-report=term-missing --cov-fail-under=85
```

### 4.2 Frontend Verification Suite
```bash
# 1. Run TypeScript type compilation check
cd frontend && npm run typecheck

# 2. Run linter
cd frontend && npm run lint

# 3. Run unit and component test suite
cd frontend && npm run test:run

# 4. Run frontend build verification
cd frontend && npm run build
```

### 4.3 End-to-End Verification Suite (Milestone Runs)
```bash
# Run Playwright end-to-end integration tests
cd frontend && npx playwright test
```

---

## 5. Definition of Done (DoD) for Task Completion

A feature, bugfix, or architectural task is considered **Done** if and only if:
1. All relevant tests in `TESTING.md` have been executed and passed (`Exit Code: 0`).
2. Test coverage on new/modified business logic is $\ge 85\%$.
3. Zero static typing errors (`mypy` and `tsc` report no errors).
4. No hardcoded credentials or unmasked PII exist in code or logs.
5. All database schema modifications are captured in an Alembic migration script.
6. Documentation in `ARCHITECTURE.md`, `DESIGN.md`, `RULES.md`, `MEMORY.md`, and `DECISIONS.md` has been updated to reflect any changes.
