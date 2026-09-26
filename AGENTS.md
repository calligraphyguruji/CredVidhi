# AI Agent Operating Manual (AGENTS.md)
## System: Loan Approval Processing System (LAPS)

This document outlines the mandatory operating instructions, protocols, and architectural guardrails for all autonomous and pair-programming AI coding agents working on this repository (including **Antigravity**, **Claude Code**, **Codex**, **Cursor**, and any other autonomous LLM agent).

---

## 1. Prime Directives for AI Agents

> [!IMPORTANT]
> **"Before implementing any non-trivial task, inspect the relevant existing code and documentation instead of assuming the structure."**

> [!IMPORTANT]
> **"Never mark a task complete without running the relevant tests/build/checks defined in TESTING.md."**

---

## 2. Mandatory 9-Step Development Pipeline

Every development task undertaken on this codebase must strictly execute through the following 9-step pipeline in sequential order:

```text
PRD.md
   ↓
ARCHITECTURE.md
   ↓
DESIGN.md + RULES.md + DECISIONS.md
   ↓
AGENTS.md
   ↓
IMPLEMENTATION
   ↓
TESTING.md
   ↓
CodeRabbit Review
   ↓
Fix Valid Findings
   ↓
Re-run Tests
   ↓
Git / GitHub
   ↓
MEMORY.md
```

### Detailed Pipeline Steps

1. **`PRD.md`**
   - Read requirements, user roles, lifecycle, business rules, and acceptance criteria.
2. **`ARCHITECTURE.md`**
   - Read the approved stack, architecture, schemas, database design, layers, and API contracts.
3. **`DESIGN.md` + `RULES.md` + `DECISIONS.md`**
   - Read UI/UX specifications, non-negotiable rules, security/financial constraints, and accepted/proposed ADRs.
4. **`AGENTS.md`**
   - Follow all agent directives and development protocols defined in this file.
5. **IMPLEMENTATION**
   - Make only the minimum targeted code changes required for the task.
   - Inspect existing code before modifying it.
   - Do not rewrite unrelated working functionality.
   - Do not introduce unapproved architectural changes.
6. **`TESTING.md`**
   - Execute all relevant verification gates.
   - Run tests, type checks, linting, formatting, build checks, and E2E checks where applicable.
   - Do not declare the task complete if required gates fail.
7. **CodeRabbit Review**
   - Run CodeRabbit / code-review after implementation and tests.
   - Treat CodeRabbit as an additional AI review / quality gate.
   - Review every finding rather than blindly applying autofixes.
   - Fix valid bugs, security issues, correctness problems, and maintainability issues.
   - Do not accept a CodeRabbit suggestion if it conflicts with `PRD.md`, `ARCHITECTURE.md`, `RULES.md`, or `DECISIONS.md`.
   - After fixing CodeRabbit findings, rerun the relevant tests and verification gates.
   - If CodeRabbit reports a finding that cannot or should not be fixed, document the reason before proceeding.
8. **Git / GitHub**
   - Only commit after implementation, testing, and CodeRabbit review have passed.
   - Review `git diff` and `git status` before committing.
   - Use conventional commits.
   - Never commit secrets, credentials, `.env` files, generated junk, or unrelated changes.
   - Push only when explicitly requested or when the task workflow requires it.
9. **`MEMORY.md`**
   - Update `MEMORY.md` only when meaningful project knowledge, state, discoveries, or completed work has changed.
   - Keep `MEMORY.md` concise.
   - Do not duplicate information already maintained in `PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `RULES.md`, or `DECISIONS.md`.

---

## 3. Mandatory Agent Rules

- **No implementation before understanding the relevant project documentation.**
- **No commit before testing and CodeRabbit review.**
- **No blind CodeRabbit autofixes.**
- **No skipping failed tests merely to complete a task.**
- **No architectural changes without documenting the decision.**
- **No modification of unrelated files unless technically necessary.**
- **Documentation must remain consistent with the actual implementation.**

---

## 4. Definition of Done (DoD)

A task is **DONE** only when:

- [ ] Requirements from `PRD.md` are satisfied.
- [ ] Architecture is respected.
- [ ] Design requirements are satisfied where applicable.
- [ ] `RULES.md` constraints are satisfied.
- [ ] Required tests pass.
- [ ] Type checking passes.
- [ ] Lint/format checks pass.
- [ ] Build passes.
- [ ] Relevant E2E tests pass.
- [ ] CodeRabbit review has been completed.
- [ ] Valid CodeRabbit findings have been resolved.
- [ ] Relevant tests have been rerun after fixes.
- [ ] `git diff` has been reviewed.
- [ ] No secrets or unrelated changes are present.
- [ ] `MEMORY.md` is updated if meaningful project knowledge changed.

---

## 5. Mandatory Governance & Code Rules

### 5.1 Financial and Business Logic Rules
- **Deterministic Underwriting:** The loan evaluation calculations (DTI, EMI, disposable income, risk scores) must be purely mathematical, reproducible, and deterministic. Never introduce arbitrary heuristics or random variables into financial calculations.
- **Formulas are Invariant:** Standard amortization and DTI formulas documented in `PRD.md` must be followed to the decimal point using appropriate fixed-point arithmetic (`Decimal` in Python, scaled integers or BigNumber libraries in frontend) to avoid IEEE 754 floating-point errors.
- **Never Claim Fake External Integrations:** If an external credit bureau (e.g., CIBIL, Experian) or identity verification service is simulated or mocked for local development, it must be explicitly named `MockCreditBureauService` or `DeterministicScoreEvaluator`. Never present mock calculations as a live bank or bureau integration.

### 5.2 Database & Migration Rules
- **No Direct Schema Manipulation:** Never alter database schemas using raw ad-hoc SQL statements or manual GUI edits. All database schema modifications must be executed via version-controlled **Alembic** migrations.
- **Non-Destructive Schema Evolution:** Avoid dropping columns or tables without backward-compatible deprecation.
- **ACID Transaction Envelopes:** All loan state transitions and document verification events must be wrapped inside atomic database transactions (`async with db.begin():`). If an audit record fails to save, the state transition must roll back.
- **Soft Deletes and Audit Immutability:** Audit records (`audit_logs`) and loan application records must never be permanently deleted. Use status flags (`CANCELLED`, `ARCHIVED`) if an entity is retired.

### 5.3 Security, Privacy & Sensitive Data
- **Zero Secrets in Code:** Never commit API keys, private keys, database passwords, JWT secrets, or environment variables to git. All credentials must come from environment variables validated via Pydantic `BaseSettings`.
- **Mask Sensitive Information in APIs & Logs:**
  - Tax identifiers (SSN, PAN, National ID): Mask all but the last 4 digits (`***-**-1234`).
  - Passwords and auth tokens: Strictly exclude from all log output and error messages.
  - Documents: Files must be stored with obfuscated UUID keys, never using user-supplied filenames directly on disk.
- **Enforce RBAC on Every Endpoint:** Every API route must explicitly declare required role dependencies (e.g., `Depends(require_roles([Role.LOAN_OFFICER, Role.ADMIN]))`). Never assume an endpoint is secure just because it is not displayed in the frontend navigation.

### 5.4 API Design & Frontend Integration
- **RESTful Standardization:** Follow standard HTTP status codes:
  - `200 OK` (Standard success)
  - `201 Created` (Resource created)
  - `400 Bad Request` (Client validation error / illegal state transition)
  - `401 Unauthorized` (Unauthenticated / invalid token)
  - `403 Forbidden` (Authenticated but insufficient role permissions)
  - `404 Not Found` (Resource does not exist)
  - `422 Unprocessable Entity` (Pydantic schema validation error)
  - `500 Internal Server Error` (Unhandled exception - sanitize error before output)
- **Standardized Error Envelope:**
  ```json
  {
    "success": false,
    "error": {
      "code": "ILLEGAL_STATE_TRANSITION",
      "message": "Cannot transition application from SUBMITTED directly to APPROVED.",
      "details": {}
    }
  }
  ```

---

## 6. How to Handle Uncertainty and Ambiguity

When encountering an undocumented business requirement or ambiguity:
1. **Do not invent business rules or regulatory compliance parameters.**
2. Formulate a reasonable, minimally invasive engineering assumption.
3. Record the assumption in `DECISIONS.md` with status `Status: Proposed`.
4. Surface the open question clearly to the user in your response summary.
5. If the uncertainty blocks a destructive or irreversible change, STOP and ask the user before proceeding.
