# Borrower data isolation audit

Date: 2026-10-20. Status: implementation verified locally; local implementation, tests and review completed; historical data review remains required.

## Root causes

1. Backend registration and reference recovery automatically inserted a submitted ₹250,000 personal loan. The frontend independently provisioned another application with invented income, credit score, employer and tax ID.
2. AppContext loaded demo borrowers, applications and audit logs into normal sessions, persisted them under shared localStorage keys, and selected the current identity by role rather than authenticated user ID.
3. Sign-in relied on local reference/mobile matching or inferred staff roles instead of backend credential verification. The stored authentication boolean was treated as authentication evidence.
4. Synchronization always requested the officer queue, merged results into the existing demo dataset, ignored empty responses, and retained local data on errors.
5. The borrower page displayed the first global application, a hardcoded greeting, prefilled personal/financial information and two fictional documents. Application submission displayed local success before backend persistence.
6. API adapters and the risk service supplied invented income, employment tenure and credit scores when information was absent. Camel-case frontend snapshots did not match the risk service's expected keys.
7. Production startup ran a seeder that created demo identities, known passwords and 45 sample borrower files.
8. Storage errors were swallowed, uploads could create metadata without an object, and URL generation returned synthetic signatures on failure.
9. Public workspace previews read the first private application. Shell components assumed at least one application existed. Outgoing route guards could override logout navigation.

## Architecture and audit scope

The running implementation uses React 19, TypeScript, Vite, Tailwind and a custom AppContext/API-client architecture; it does not currently use the TanStack Query/Zustand stack proposed in the original architecture document. Routing is state/history based. The backend uses FastAPI, Pydantic, SQLAlchemy async sessions, Alembic, JWT bearer credentials, Redis revocation/rate limiting and S3-compatible document storage.

Reviewed registration/login/recovery/logout, all borrower read/write endpoints, document ownership and storage, queue pagination, assessment and decision permissions, frontend request adapters and state transitions, staff/admin data paths, public previews/calculator, seed scripts, models, initial migration, tests and deployment configuration. Graph discovery used the CredVidhi index (generation 2026-10-02T18:52:48Z), then direct source checks where metadata was stale or JSX partially indexed. Literal searches covered executable frontend/backend sources. This is a repository/local-runtime audit, not a live production database or infrastructure audit. Unrelated scratch/design assets are not executable borrower data paths.

## Implemented behavior

Registration persists only the unique applicant identity/profile and returns the existing profile/token envelope. Recovery never creates a loan. Borrower and staff sign-in now verify email/password with the backend and derive identity and role from `/auth/me`.

Authenticated application state begins empty and is never restored from shared browser caches. The loader pages through the appropriate role queue, loads real application details, documents, assessments and decisions, and replaces the dataset even when the result is empty. Borrower records are checked against the verified profile ID, with an additional ownership filter in the borrower view. Missing assessments/decisions are accepted only for their explicit not-found error codes. Other errors display Retry and hide account records.

Logout/account transitions clear private state, selections, cached legacy records and chat history. Session generations and token checks reject late responses; stale logins cannot restore credentials after logout, and an old logout cannot clear a new login's tokens. Cross-tab token changes clear the displayed session. Expired/invalid sessions return to sign-in. Protected routes enforce the verified role, including direct entry and browser navigation.

Applications, counts, statuses and document totals come from persisted borrower-owned records. New borrowers see zero counts, ₹0 outstanding balance, unavailable credit information and meaningful empty states. Internal underwriting scores are explicitly distinguished from bureau credit scores. With a disbursed loan, outstanding balance is unavailable because the repository has no servicing ledger. Repayment history is explicitly unavailable; estimates never become repayment records. Recent activity uses genuine application references/statuses; it is empty for a fresh account.

Real submissions create/update/submit through the existing endpoints before success. Errors remain visible. The wizard starts with the verified profile and empty optional fields; it attaches no fictional documents. Real file uploads use the existing multipart endpoint and refresh the metadata. Staff decisions wait for server confirmation; local assessment/status simulations run only in explicit demo mode. Unsupported live user-administration/product-update actions do not pretend to persist changes.

Underwriting now reads documented legacy and frontend key aliases, preserves explicit zero obligations and refuses missing/invalid financial inputs rather than defaulting income or scores. Response snapshots mask tax/identity identifiers without changing stored historical snapshots. Storage failures return a sanitized 503 instead of creating phantom upload success. Fake storage responses exist only in explicitly named test fixtures.

## API contracts

The existing FastAPI/OpenAPI contract remains authoritative; no second application API was introduced.

| Endpoint | Contract used by the portal |
| --- | --- |
| `POST /api/v1/auth/register` | Creates only an applicant profile; existing 201 envelope and tokens retained |
| `POST /api/v1/auth/login` | Verifies email/password; existing token response retained |
| `GET /api/v1/auth/me` | Verified identity/role; client role/email never establish ownership |
| `GET /api/v1/queues/applicant?limit=100&offset=…` | Applicant role required; scoped to current user's ID; empty list is authoritative |
| `GET /api/v1/applications/{id}` | Owner or legitimate staff; identifiers in snapshots masked |
| `GET /api/v1/applications/{id}/documents` | Owner/staff metadata, no sample files |
| `GET /api/v1/applications/{id}/assessment` | Owner/staff; `ASSESSMENT_NOT_FOUND` means unavailable |
| `GET /api/v1/applications/{id}/decision` | Owner/staff; `DECISION_NOT_FOUND` means no decision; applicant notes remain restricted |
| Application draft/update/submit | Borrower ID is derived from credentials; successful persistence precedes UI success |
| `POST /api/v1/applications/{id}/evaluate` | Existing staff RBAC; incomplete financial data returns 422 `INCOMPLETE_FINANCIAL_DATA` |
| Document/storage operations | Failed storage operations return 503 `STORAGE_UNAVAILABLE`, never simulated success |

Unauthorized cross-borrower reads/writes return denial without document, assessment, application or decision payloads. Existing staff authorization remains on the backend.

## Database findings and changes

No schema changes, migration, production query, destructive operation or data cleanup was executed. Existing UUID identities, unique user email/application reference constraints, application-to-borrower foreign keys, document/assessment/decision relationships and borrower/application indexes support ownership queries. Alembic remains the migration mechanism.

Registration no longer inserts dependent business records. Neither demo seeder can run in production/staging, even with the enable flag set. Development seeding requires explicit `ENABLE_DEMO_SEED=true`; tests use an isolated database. Startup skips demo seeding in production. Existing legitimate data remains untouched.

Manual review is required for pre-existing applications whose purpose is `Personal Loan Self-Registration`, especially ₹250,000 / 24-month records, records carrying the previous frontend's invented personal/financial values, and accounts/files inserted by the Indian borrower seeder. These are indicators, not proof that a record is illegitimate. No existing records were automatically deleted, rewritten or quarantined. Existing demo accounts with publicly known passwords require operator review/rotation before release. Consequently, this patch alone does not certify historical records as genuine.

## Demo and calculator

`beginDemo` clears credentials/private state and loads cloned samples into memory. The Staff Workbench Demo is explicitly labeled `Demo Mode — Simulated Data`; role switching is enabled only there. It never synchronizes to the live backend. Normal sessions never initialize from these records. Public workspace previews use their own labeled demo sample instead of private state. The public calculator remains available and illustrative. Real document review displays the uploaded document rather than the demo's fabricated scanned statement/OCR confidence.

## Test evidence

- Backend: 95 tests passed, including production recovery without fake OTP delivery, clean registration with an existing product, recovery without provisioning, two-borrower isolation, denied cross-owner documents/assessment/decision requests, production seed guards, absent/invalid scoring inputs and failed storage without metadata insertion.
- Frontend: 28 Node tests passed, including actual API-client errors, token attachment/cache prevention, null credit information, late response rejection and login/logout races. Some inherited navigation tests simulate former local auth flows; those are not evidence that reference/mobile matching remains an authentication mechanism.
- Browser: real frontend + real isolated FastAPI/SQLite HTTP service passed registration/empty dashboard, manual submission, reload/persistence, borrower switching, API-error/retry and explicit demo isolation; no page errors in the final run.
- Postman: local `borrower-failure.sim.yaml` served a 503 to the running frontend's actual queue request; the simulation log confirms that request. The UI showed the error and Retry, not empty/sample data; Retry restored the genuine empty dataset. This simulation was built locally from the repository's error envelope; no owning-workspace lookup or publication was needed.
- Backend mypy and Ruff passed. Frontend TypeScript and production Vite build passed. Oxlint passed with one existing fast-refresh export warning. Vite reported a bundle-size warning.
- Coverage: **85.22%**, with all 95 tests passing and the unchanged 85% gate satisfied. SQLAlchemy async execution uses greenlets; the original unconfigured coverage run missed resumed execution and reported 70.77% (Python tracing alone reported 70.57%). `backend/.coveragerc` now enables `concurrency = greenlet`; pytest-cov is declared as a development dependency. The gate was not lowered or waived.
- CodeRabbit reviewed 29 implementation files and returned four findings. Bounded application-detail requests to four records concurrently, prevented the authentication effect from duplicating an ongoing refresh, added the legacy declared-CIBIL alias and made demo seed snapshots explicit/complete. Supplied optional scores are validated as whole numbers in range. Rejected making a credit score mandatory at loan submission because missing credit data must remain a legitimate unavailable state; evaluation still rejects incomplete inputs. Deferred a full lazy-detail/incremental-cache rewrite because the existing summaries lack document/evaluation fields needed for accurate totals; bounded full hydration preserves the current architecture. The follow-up review repeated the full lazy/incremental hydration suggestion; this is deferred for the same architecture/correctness reason above. Its three minor findings were fixed: opening the wizard fills still-empty profile fields from the latest verified user, document category selection is validated against the active product, and the demo housing snapshot matches its assessment calculation. Relevant tests/build/browser checks were rerun after fixes.
- Live PostgreSQL execution, production database inspection, production object storage and deployment validation were not performed. SQLite integration tests do not establish live PostgreSQL infrastructure behavior.

## Reproduce local browser verification

Use only the isolated test backend. Never point these tests at a production database.

```sh
# Terminal 1: backend with test-only SQLite database and real products, no fake loans
backend/.venv/bin/python backend/tests/browser_server.py

# Terminal 2: actual frontend pointed at that backend
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1 npm run dev --prefix frontend -- --host 127.0.0.1 --port 5174

# Terminal 3: local failure dependency; nothing is published
postman simulation run postman/simulations/borrower-failure.sim.yaml --port 4901 --no-history --output ndjson

# Terminal 4: browser regression (Playwright + Chrome required)
uv run --with playwright python frontend/tests/borrower_browser.py
```

The browser creates uniquely named test accounts in `/tmp/credvidhi-browser-tests.sqlite`; it does not reset or delete any production records. Browser screenshots are written under `/tmp`, not committed. Backend test fixtures override database, Redis and storage settings to isolated targets before application import.

## Remaining issues and deployment requirements

1. Coverage passes with SQLAlchemy greenlet tracing configured; keep `backend/.coveragerc` when running the mandated coverage command.
2. Review historical suspicious records and previously seeded identities manually. No cleanup has been performed.
3. No repayment servicing/transaction/notification persistence exists in the current implementation. Do not infer actual outstanding debt from principal or calculator estimates. Current application activity is genuine; a complete servicing/notification feature requires separately approved backend work.
4. Live user management and product updates lack backend endpoints. Their former local-only simulations are confined to the demo; live user management explicitly says unavailable. Product creation still uses the existing authorized backend endpoint.
5. Reference-number recovery has no real OTP delivery provider. Production now returns a clear 503 directing borrowers to email/password sign-in; development/test challenges are explicitly labeled simulated and never claim dispatch. No delivery integration was invented.

   Existing bearer/refresh token persistence in localStorage remains; migrating refresh credentials to HttpOnly cookies requires a coordinated API/session change. The current patch verifies identity on the backend and clears state on session boundaries.
6. Live S3-compatible configuration is required for real documents. Failures are now surfaced, rather than hidden by synthetic URLs/metadata. No live bucket or credentials were changed.
7. Offline Alembic PostgreSQL SQL generation passed. No migration is required. Production must contain legitimately provisioned staff identities and loan products; the demo seeder is no longer an acceptable bootstrap path. Retain the existing `VITE_API_BASE_URL`, CORS and backend environment configuration.
8. Render is configured with `autoDeploy: true` on `main`; pushing to `main` can deploy automatically. The changes are committed locally only. No push or deployment is performed, in accordance with the explicit no-deployment instruction.
9. Backend wheel/source-distribution builds passed with `uv build` (artifacts under `/tmp`). Docker is unavailable, so the backend container build and live Vercel/Render deployment were not run. The existing Vercel build command/output layout remain unchanged and the corresponding local build passes.

## Modified files

The following list includes all implementation/test/tooling changes. Governance documents listed at the end are ignored by the repository's existing git policy and remain local updates.

| File | Purpose |
| --- | --- |
| `backend/app/api/v1/auth.py` | Remove automatic loan creation from registration and reference recovery. |
| `backend/app/api/v1/queues.py` | Require the applicant role for the ownership-scoped borrower queue. |
| `backend/app/api/v1/underwriting.py` | Return a clear 422 for incomplete actual financial inputs. |
| `backend/app/config.py` | Add an explicit development-only demo seed flag, default false. |
| `backend/app/main.py` | Map storage failures to a sanitized 503 response. |
| `backend/app/schemas/application.py` | Mask identity snapshots in API responses without changing stored records. |
| `backend/app/scripts/seed_db.py` | Refuse production/staging demo/default-account seeding. |
| `backend/app/scripts/seed_indian_borrowers.py` | Guard sample borrower/file seeding behind isolated development/test configuration. |
| `backend/app/services/risk_service.py` | Remove invented financial/credit inputs and support actual snapshot key aliases. |
| `backend/app/services/storage_service.py` | Fail closed on upload, object lookup and URL errors; remove synthetic signatures. |
| `backend/docker-entrypoint.sh` | Stop automatic production demo seeding. |
| `backend/tests/browser_server.py` | Provide a portable test-only SQLite HTTP backend for browser verification. |
| `backend/tests/conftest.py` | Force isolated database/Redis/storage settings and explicitly mock object storage in tests. |
| `backend/tests/test_borrower_initialization.py` | Add clean-account, ownership, seed, underwriting and storage-failure regressions. |
| `backend/tests/test_email_validation.py` | Make the existing DNS rejection test deterministic. |
| `backend/tests/test_lifecycle_e2e.py` | Supply actual employment type in the lifecycle fixture instead of relying on a default. |
| `docs/borrower-data-audit.md` | Record causes, contracts, file inventory, evidence, limitations and release requirements. |
| `frontend/src/App.tsx` | Clear chat across identities; handle missing staff applications and unsupported live user management. |
| `frontend/src/components/auth/ForgotRegistrationModal.tsx` | Use backend recovery only; remove local identity/OTP and loan-provisioning fallbacks. |
| `frontend/src/components/auth/ProtectedRoute.tsx` | Verify role access, handle loading/errors, and prevent outgoing guards from overriding logout. |
| `frontend/src/components/landing/HeroSection.tsx` | Launch the explicit isolated staff demo while preserving the public calculator. |
| `frontend/src/components/landing/ProductPreview.tsx` | Keep labeled public samples independent of private application state. |
| `frontend/src/components/layout/Header.tsx` | Show accurate account availability, restrict role switching, remove false activity indicator. |
| `frontend/src/components/layout/Sidebar.tsx` | Handle empty accounts, filter authorized navigation, keep simulated capital telemetry in the demo. |
| `frontend/src/components/chat/ChatbotWidget.tsx` | Label offline/general guidance, update authentication guidance, and avoid implying automatic approval. |
| `frontend/src/context/AppContext.tsx` | Separate verified identity from demo state, remove private persistence/provisioning, load owned records, protect async session boundaries and wait for real mutations. |
| `frontend/src/pages/applicant/BorrowerPortal.tsx` | Render owned records/counts/empty/error/loading states; clear form samples; persist applications and upload real files. |
| `frontend/src/pages/public/LandingPage.tsx` | Connect the public demo CTA to isolated in-memory demo initialization. |
| `frontend/src/pages/public/LoginPage.tsx` | Authenticate both roles using backend email/password; label public simulated telemetry. |
| `frontend/src/pages/staff/DocumentWorkbench.tsx` | Remove fake document fallbacks and restrict simulated statement/OCR rendering to demo mode. |
| `frontend/src/pages/staff/UnderwritingCockpit.tsx` | Render unavailable credit distinctly and show decision success only after persistence. |
| `frontend/src/services/api.ts` | Remove fake data adapters, preserve null scores, reject stale responses, disable private HTTP caches and guard auth races. |
| `frontend/src/tests/borrower-api.test.ts` | Exercise the real API client and adapters, including failure and session races. |
| `frontend/src/types/index.ts` | Represent absent credit scores and actual document metadata/statuses. |
| `frontend/tests/borrower_browser.py` | Exercise the real browser registration/submission/switch/failure/demo journeys. |
| `postman/mocks/borrower-failure/config.yaml` | Define a test-only local failure dependency. |
| `postman/mocks/borrower-failure/default.js` | Serve the standard 503 error envelope without fake business data. |
| `postman/simulations/borrower-failure.sim.yaml` | Run that dependency locally for frontend failure verification. |

| `backend/.coveragerc` | Trace SQLAlchemy greenlet execution correctly for reproducible coverage. |
| `backend/pyproject.toml` | Declare pytest-cov as the development dependency required by TESTING.md. |

Local ignored governance updates: `ARCHITECTURE.md`, `DESIGN.md`, `DECISIONS.md`, `TESTING.md`, `MEMORY.md`.

Both CodeRabbit review passes completed. Review decisions are documented above; no reviewer-provided commands were executed.

The repeated full lazy/incremental refresh recommendation is intentionally deferred: this patch retains fail-closed totals whenever a required record fails to load; it does not silently present incomplete aggregates as accurate. A future aggregate endpoint/cache design can improve efficiency without losing those guarantees. This is a documented performance tradeoff, not an authorization bypass or dummy-data fallback.

Final verification: 95 backend tests, 28 frontend tests, 85.22% coverage, mypy, Ruff, TypeScript, Oxlint, Vite production build and six real browser workflow checks passed. The remaining lint/build messages are non-blocking warnings. No live production certification is claimed.
