import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { authApi, applicationsApi, mapBackendApplication, mapBackendProduct, clearAuthTokens, AUTH_TOKEN_KEY, ApiError } from '../services/api.ts';

const values = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) },
  window: new EventTarget(),
});
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; clearAuthTokens(); values.clear(); });
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ success: status < 400, data,
  error: status >= 400 ? { code: 'UNAVAILABLE', message: 'Please retry.' } : null }), { status });

test('application adapter never manufactures missing identity, income or credit scores', () => {
  const product = mapBackendProduct({ id: 'p', required_documents: ['PAN_CARD'] });
  const app = mapBackendApplication({ id: 'a', applicant_id: 'borrower-a', product_id: 'p', requested_amount: 10000 }, product);
  assert.equal(app.applicantId, 'borrower-a');
  assert.equal(app.financial.creditScoreDeclared, null);
  assert.equal(app.financial.grossMonthlyIncome, 0);
  assert.equal(app.personal.email, '');
  assert.equal(app.personal.dateOfBirth, '');
  assert.equal(app.personal.taxIdMasked, '');
  assert.deepEqual(app.documents, []);
  assert.equal(app.riskAssessment, undefined);
  assert.equal(app.decision, undefined);
  assert.throws(() => mapBackendApplication({ id: 'a' }), /product information/);
});

test('failed API requests reject and never return a local application', async () => {
  globalThis.fetch = async () => response(null, 500);
  await assert.rejects(applicationsApi.getById('a'), (error: unknown) => error instanceof ApiError && error.statusCode === 500);
});

test('private requests attach the current token and disable HTTP caching', async () => {
  values.set(AUTH_TOKEN_KEY, 'borrower-b-token');
  globalThis.fetch = async (_url, options) => {
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer borrower-b-token');
    assert.equal(options?.cache, 'no-store');
    return response({ id: 'borrower-b' });
  };
  assert.deepEqual(await authApi.getMe(), { id: 'borrower-b' });
});

test('late responses cannot cross from one borrower session to another', async () => {
  values.set(AUTH_TOKEN_KEY, 'a-token');
  let finish!: (response: Response) => void;
  globalThis.fetch = () => new Promise<Response>(resolve => { finish = resolve; });
  const pending = applicationsApi.getById('a-application');
  values.set(AUTH_TOKEN_KEY, 'b-token');
  finish(response({ id: 'a-application' }));
  await assert.rejects(pending, (error: unknown) => error instanceof ApiError && error.code === 'SESSION_CHANGED');
});

test('logout invalidates an in-flight login before it can store credentials', async () => {
  let finish!: (response: Response) => void;
  globalThis.fetch = () => new Promise<Response>(resolve => { finish = resolve; });
  const pending = authApi.login('a@example.com', 'test-password');
  clearAuthTokens();
  finish(response({ access_token: 'late-a-token', refresh_token: 'late-refresh' }));
  await assert.rejects(pending, (error: unknown) => error instanceof ApiError && error.code === 'SESSION_CHANGED');
  assert.equal(values.get(AUTH_TOKEN_KEY), undefined);
});

test('an old logout response cannot erase a later login', async () => {
  values.set(AUTH_TOKEN_KEY, 'a-token');
  let finish!: (response: Response) => void;
  globalThis.fetch = () => new Promise<Response>(resolve => { finish = resolve; });
  const pending = authApi.logout();
  values.set(AUTH_TOKEN_KEY, 'b-token');
  finish(response(null));
  await pending;
  assert.equal(values.get(AUTH_TOKEN_KEY), 'b-token');
});
