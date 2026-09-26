# Non-Negotiable Project Rules (RULES.md)
## System: Loan Approval Processing System (LAPS)

This document establishes the mandatory, binding engineering, security, and architectural rules governing the LAPS codebase. Every human developer and AI agent must adhere to these rules without exception.

---

## 1. Security & Privacy Rules

- **SEC-01: Zero Hardcoded Secrets:** Never hardcode credentials, private keys, JWT secrets, database connection strings, or API tokens in source code or configuration files tracked by version control. All secrets must be loaded via environment variables and validated at startup using Pydantic `BaseSettings`.
- **SEC-02: Zero Credentials in Git:** `.env`, private keys, and local credentials files must be explicitly ignored in `.gitignore`. Never commit temporary test credentials to git.
- **SEC-03: Zero Sensitive Data in Logs:** Passwords, full credit card numbers, unmasked Tax IDs (SSN, PAN, National ID), and JWT tokens must never appear in application logs, standard output, or telemetry streams.
- **SEC-04: Strict Input Validation at Boundaries:** Every piece of external data entering via API request, file upload, or query parameter must be validated against a strict Pydantic v2 schema or TypeScript type guard before touching business logic.
- **SEC-05: Mandatory Authentication & Authorization Enforcement:** Every API route (except public `/auth/login` and `/auth/register`) must enforce authentication and explicit role-based access checks (`require_roles(...)`). Never rely on client-side route hiding as a security mechanism.
- **SEC-06: Principle of Least Privilege:**
  - Database user accounts must have only the minimum required grants.
  - Staff users can only access applications and workflows permitted by their active assigned role.
  - Applicants can strictly only access records where `applicant_id == current_user.id`.
- **SEC-07: Document Storage Isolation:** Uploaded files must never be written with their original user-provided filename to disk. They must be assigned a cryptographic UUID, stored in a sandboxed directory or bucket, and served only through authenticated streaming endpoints after verifying caller authorization.
- **SEC-08: Sensitive PII Masking:** Any PII exposed in API responses or UI screens must be masked by default (e.g., Tax ID: `***-**-5678`).

---

## 2. Data Integrity & Persistence Rules

- **DAT-01: Strict Schema Validation:** Database columns must have explicit data types, nullability constraints, and foreign keys. No unconstrained text fields where an enum or foreign key is required.
- **DAT-02: Preserve Data Integrity via ACID Transactions:** Any operation modifying an application status, recording a decision, or verifying a document must execute within an atomic transaction. If an audit log write fails, the entire transaction must abort and roll back.
- **DAT-03: Version-Controlled Migrations Only:** Never create or alter database tables through ad-hoc SQL or administrative GUIs. All changes must be codified in **Alembic** migration scripts tested against fresh databases.
- **DAT-04: No Destructive Schema Changes:** Never drop tables or columns in production-facing branches without an approved deprecation path and verified backward-compatibility strategy.
- **DAT-05: No Silent Deletion:** Core domain entities (Users, Applications, Documents, Decisions, Audit Logs) must never be permanently deleted (`DELETE FROM`). If an application is withdrawn or cancelled, update its status flag (`status = 'CANCELLED'`). Audit records are strictly immutable.
- **DAT-06: Precise Financial Decimal Arithmetic:** Financial amounts (loan amounts, interest rates, DTI ratios, monthly installments) must be stored and calculated using fixed-point `NUMERIC` types in the database and `Decimal` in Python. Never use binary floating-point numbers (`float`) for monetary calculations.

---

## 3. Financial & Business Logic Rules

- **FIN-01: Never Invent Financial Rules:** All financial rules, DTI thresholds, amortization calculations, and qualification criteria must strictly adhere to the specifications defined in `PRD.md` and approved ADRs in `DECISIONS.md`. Never invent arbitrary thresholds or heuristic shortcuts.
- **FIN-02: Deterministic & Testable Calculations:** The risk evaluation engine and eligibility calculators must be pure, deterministic functions: given the exact same input financial parameters, they must always produce the exact same score and decision recommendation.
- **FIN-03: Decouple Business Rules from the UI:** The frontend React client must never be the authoritative source of financial validation, interest calculation, or approval decisions. The backend service layer is the sole source of truth; frontend calculations are for instant visual feedback only.
- **FIN-04: Document Assumptions Explicitly:** Any business logic rule implemented without an explicit formal specification must be documented as an assumption in `DECISIONS.md` under `Status: Proposed`.
- **FIN-05: No Fake Integrations Presented as Real:** Never claim or present simulated credit bureau responses, mock identity lookups, or simulated payment transfers as live external bank or bureau integrations. Clearly prefix all local simulation services with `Mock` or `DeterministicLocal`.

---

## 4. Code Quality & Architecture Rules

- **COD-01: Prefer Existing Utilities & Primitives:** Before writing helper functions (formatting currency, parsing dates, verifying tokens, modal dialogs), inspect the existing codebase. Never duplicate existing functionality.
- **COD-02: Keep Dependencies Lean:** Do not add third-party libraries for trivial operations that can be achieved with standard libraries or small, clean utilities. Every new dependency in `package.json` or `pyproject.toml` must have clear engineering justification.
- **COD-03: Strict Layer Separation:** Controllers/Routers must only handle HTTP concerns (status codes, serialization). Business logic belongs exclusively in `services/`. Data access belongs in models and repositories. Never write raw database queries inside route handlers.
- **COD-04: Avoid Giant Files:** Files must maintain high cohesion and single responsibility. Decompose files exceeding 300 lines into focused sub-modules.
- **COD-05: No Unjustified Rewrites:** Do not rewrite or refactor working modules unless explicitly instructed or required to satisfy a specific new requirement. Preserve established and tested logic.

---

## 5. AI Agent Rules

- **AI-01: Zero Fabricated Integrations:** AI agents must never create mock API clients and represent them to the user or system as working third-party integrations (e.g., CIBIL, Experian, Bank APIs).
- **AI-02: Inspect Before Modifying:** Never assume code structure, method signatures, or database schemas. Always inspect existing source files and documentation before making modifications.
- **AI-03: Never Commit Broken Code:** Every agent task must be verified against the test and lint commands in `TESTING.md` before being marked complete.
- **AI-04: No Modifying Unrelated Files:** AI agents must keep their edits scoped exclusively to files relevant to the active task. Do not touch or reformat unrelated files.
