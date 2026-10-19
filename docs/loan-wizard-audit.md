# Loan application wizard audit — 2026-10-20

## Root causes

The borrower wizard was embedded in BorrowerPortal with a 576px modal. Next only incremented a step counter; numeric financial fields defaulted to zero, conflating an unanswered field with a valid zero. Documents had no upload control in the wizard. Final submission created a fresh draft every time, so interrupted retries could create duplicates. Backend submission checked lifecycle permissions but did not enforce complete snapshots, consent, or the product's document checklist.

## Implementation

- Extracted the existing wizard into one LoanApplicationWizard component. Its modal is up to 960px wide, within 95vw, and 88dvh tall, with a scrolling body and visible header/footer. Desktop fields use two columns; mobile uses one. Added dialog semantics, focus trapping/restoration, required indicators, inline errors and focus on the first invalid field. Existing theme tokens and orange accents remain.
- The frontend validates each step and every preceding step when a future tab is clicked. Back navigation preserves inputs. Name/email come from the authenticated profile. Blank financial numbers are distinct from zero: income must be positive; expenses, debt and experience accept zero. Salaried applicants supply a job title; both configured employment types supply employer/business name. Declared score remains optional and, when supplied, must be a whole number from 300 through 900. Product amount/tenure limits come from the existing product API.
- Entering Documents creates or reuses one real draft with a client-generated UUID. Create retries reuse the primary key, draft updates remain owner-checked, and submitted applications return their existing result on repeat submission. Row locks serialize application mutations on PostgreSQL. SQLite tests validate retry behavior; they do not certify PostgreSQL lock scheduling.
- Step 4 uploads actual files through the existing authenticated multipart API. File selection, drag/drop, multiple files per category, upload progress, failed-upload retry, replacement and removal are supported. Uploaded filenames/sizes/categories and upload status are shown. Required and optional categories come from product configuration; aliases are normalized. Missing mandatory files block submission. Earlier uploads remain on the same draft after closing or reloading and choosing Resume Draft Application.
- Multipart uploads enforce extension/MIME agreement, magic signatures, bounded 10MB reads, safe display filenames, UUID storage keys and borrower ownership. Identical upload retries reuse existing metadata. Replacement stores the new file before withdrawing the old metadata. Removal marks metadata withdrawn with an audit event; rows and stored files are retained. Withdrawn documents are excluded from lists/checklists, cannot be downloaded or verified, and cannot satisfy submission requirements.
- Every transition into SUBMITTED, including the general transition endpoint, invokes the same backend snapshot/product/document validation. The UI also displays field errors returned by that contract. Drafts may remain incomplete, but supplied invalid snapshot fields are rejected. Submit remains disabled during processing; no success appears until the backend confirms. Dashboard refresh uses the existing authenticated data-fetching architecture.
- Default storage remains S3/MinIO. An explicit LOCAL_DOCUMENT_STORAGE_PATH setting enables actual filesystem storage only in development/tests; production/staging reject it. Local preview uses /tmp/credvidhi-browser-documents, isolated SQLite and authenticated downloads. It never falls back to fabricated upload success.

## Database/API compatibility

No tables, columns, indexes, enums or migrations changed. No production records or environment variables were modified. Existing draft/update/submit/upload routes are reused. Additive fields: optional draft_id on draft creation, optional product_id on draft update, and optional replace_document_id in multipart upload. Additive routes: POST /applications/{app_id}/documents/{document_id}/withdraw and GET /documents/{document_id}/download. DRAFT records lacking complete snapshots/documents remain drafts until the borrower completes them; existing submitted records are not rewritten.

The pre-existing direct S3 presign/confirm flow remains available. Confirmation now reads bounded stored bytes, checks actual size and magic signatures, verifies the integrity hash when supplied, validates filename extension/MIME agreement and reuses confirmed metadata on retry. Both upload paths inspect actual content; the wizard uses multipart. No antivirus/content-disarm service was added, and file signature checks do not establish that a PDF is harmless.

## Files modified

| File | Purpose |
| --- | --- |
| backend/app/api/v1/applications.py | Idempotent draft create/submit, product changes, draft validation and mutation locks |
| backend/app/api/v1/documents.py | Safe multipart filenames/types, retry reuse, replace/withdraw/private download, normalized checklists |
| backend/app/config.py | Development/test-only real local storage configuration |
| backend/app/main.py | Structured application validation error response |
| backend/app/schemas/application.py | Additive draft UUID and product update fields |
| backend/app/services/application_validation.py | Shared authoritative personal/financial/submission/document requirements |
| backend/app/services/fsm_service.py | Enforce submission contract on every entry point |
| backend/app/services/storage_service.py | Real private filesystem storage for explicit local development/tests |
| backend/tests/conftest.py | Explicit test-only storage inspection fixture |
| backend/tests/browser_server.py | Isolated preview uses real local file storage |
| backend/tests/test_application_wizard.py | Submission gates, ownership, persistence, retries, replacement, withdrawal, storage failures and validation boundaries |
| backend/tests/wizard_helpers.py | Complete draft prerequisites through real API requests in lifecycle tests |
| backend/tests/test_borrower_initialization.py | Supply legitimate complete submission prerequisites |
| backend/tests/test_document_service.py | Supply legitimate complete submission prerequisites |
| backend/tests/test_fsm_transitions.py | Supply legitimate complete submission prerequisites |
| backend/tests/test_lifecycle_e2e.py | Complete snapshots and upload requirements before submission |
| frontend/src/components/ui/Input.tsx | Required markers, accessible names/errors and invalid styling |
| frontend/src/components/ui/Modal.tsx | Larger wizard variant, bounded scrolling layout, portal and focus management |
| frontend/src/context/AppContext.tsx | Submit an existing authenticated draft and refresh real dashboard records |
| frontend/src/pages/applicant/BorrowerPortal.tsx | Use extracted wizard, resume drafts, backend-confirmed success |
| frontend/src/pages/applicant/LoanApplicationWizard.tsx | Step validation, persisted draft workflow and upload UI |
| frontend/src/services/api.ts | Draft/replacement/withdraw adapters and authenticated XHR upload progress |
| frontend/src/utils/applicationValidation.ts | Reusable pure frontend field/file validators |
| frontend/src/tests/borrower-api.test.ts | Canonical alias merging preserves mandatory document requirements |
| frontend/src/tests/applicationValidation.test.ts | Required/partial/zero/optional/dependent validation cases |
| frontend/tests/borrower_browser.py | Full wizard, responsive layout, persistence, uploads, failure/retry and session/demo checks |
| docs/loan-wizard-audit.md | Audit, compatibility, verification and operational limitations |

## Verification

- Backend: 120 tests passed; total coverage 86.03% before final review. Mypy and Ruff passed.
- Frontend: 49 tests passed. TypeScript and production Vite build passed. Oxlint passed with the pre-existing AppContext fast-refresh warning; Vite retains its existing bundle-size warning.
- Real Chrome browser: new borrower empty dashboard; blocked empty/partial steps and future-tab bypass; zero financial expenses/debt; backward navigation; uploads with retry/replacement/removal; required documents; saved draft resume after reload; double-click submission produces one application; dashboard reload; borrower A/B isolation; dashboard failure/retry through local Postman simulation; explicit staff demo/workbench. Modal dimensions/overflow checked at 1440, 768 and 390px viewport widths.
- Local Postman health assertion passed against the real backend. Initial assertion used an incorrect expected status string and was corrected to the existing ALIVE contract.
- Production S3, PostgreSQL concurrency under load, Docker image builds, live Vercel/Render deployment and antivirus scanning are not certified by the local checks. No deployment was performed as part of these checks.
- CodeRabbit first review and follow-up findings are recorded below; final checks remain mandatory before commit.

## Running locally / deployment

Frontend preview: http://127.0.0.1:5174/ ; API: http://127.0.0.1:8000/api/v1 . Run backend/tests/browser_server.py for the isolated preview; run Vite with VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1. Create a new borrower or use an account you registered yourself; no sample borrower is initialized.

No migration is required. Deploy the matched backend/frontend changes using existing configuration. Production requires the existing private S3/MinIO bucket credentials and connectivity; never enable local filesystem storage there. Preserved withdrawn blobs may be reviewed under the organization's retention policy; no automatic deletion was introduced. Saved drafts appear in the real application total but do not count as submitted/pending until submitted. Existing public calculator and explicit Staff Workbench Demo remain separate from production borrower data.

CodeRabbit first review completed across all 25 staged files with two minor findings. Both were verified and fixed: read-only queries no longer acquire row locks, and duplicate uploads reuse only pending/verified records. Regression tests cover reuploading deficient/rejected documents. Direct-storage confirmation hardening and resume-load retry protection were added during the final security/UX pass.

Final checks: 120 backend tests, 49 frontend tests, 86.03% coverage, mypy, Ruff, TypeScript, Oxlint, frontend production build, backend wheel/sdist build, offline PostgreSQL Alembic SQL generation and the real Chrome browser workflow passed. Browser verification includes dark mode, actual drag-and-drop, multiple optional uploads, failed draft load/retry and confirmed persisted restoration. The follow-up review identified duplicate normalized document aliases in the frontend catalog mapper; these now merge once per canonical code and preserve mandatory=true if any source requires the document. A dedicated regression test passes. Draft-creation collision handling captures the verified owner before rollback, and optional stored personal identifiers are preserved during resume edits.
