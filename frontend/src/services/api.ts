/**
 * CredVidhi Native Production API Client.
 *
 * Communicates with the FastAPI backend over REST with typed request/response
 * contracts, automatic JWT token attachment, and standardized error envelopes.
 */

import type { LoanApplication, LoanProduct, AuditLog } from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const AUTH_TOKEN_KEY = 'credvidhi_access_token';
export const REFRESH_TOKEN_KEY = 'credvidhi_refresh_token';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export class ApiError extends Error {
  code: string;
  details?: Record<string, any>;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number, details?: Record<string, any>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Standard HTTP fetch wrapper with authorization injection and response unwrapping.
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = new Headers(options.headers || {});

  if (!headers.has('Authorization') && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || (body && body.success === false)) {
    const errCode = body?.error?.code || `HTTP_${response.status}`;
    const errMsg = body?.error?.message || response.statusText || 'An unexpected server error occurred.';
    throw new ApiError(errCode, errMsg, response.status, body?.error?.details);
  }

  return (body?.data !== undefined ? body.data : body) as T;
}

// ==========================================
// 1. System Health Probes
// ==========================================
export const healthApi = {
  checkLive: () => request<{ status: string }>('/health/live'),
  checkReady: () => request<{ status: string }>('/health/ready'),
  checkDetailed: () => request<{ status: string; dependencies?: { database: string; redis: string } }>('/health'),
};

// ==========================================
// 2. Authentication & Profile
// ==========================================
export const authApi = {
  login: async (email: string, password: string) => {
    const data = await request<{
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in_seconds: number;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.access_token) {
      localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    }
    return data;
  },

  register: (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone_number?: string;
    pan_number?: string;
  }) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    try {
      if (refreshToken) {
        await request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } finally {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  },

  getMe: () => request('/auth/me'),
};

// ==========================================
// 3. Loan Products Catalog
// ==========================================
export const productsApi = {
  list: () => request<any[]>('/products'),
  getById: (id: string) => request<any>(`/products/${id}`),
  create: (payload: {
    code: string;
    name: string;
    description?: string;
    min_amount: number;
    max_amount: number;
    min_tenor_months: number;
    max_tenor_months: number;
    base_apr: number;
    max_dti_ratio: number;
    required_documents: any[];
  }) =>
    request<any>('/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// ==========================================
// 4. Loan Application Lifecycle
// ==========================================
export const applicationsApi = {
  createDraft: (payload: {
    product_id: string;
    requested_amount: number;
    requested_tenor_months: number;
    purpose?: string;
  }) =>
    request<any>('/applications', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getById: (id: string) => request<any>(`/applications/${id}`),

  updateDraft: (
    id: string,
    payload: {
      requested_amount?: number;
      requested_tenor_months?: number;
      purpose?: string;
      applicant_personal_snapshot?: any;
      applicant_financial_snapshot?: any;
    }
  ) =>
    request<any>(`/applications/${id}/draft`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  submit: (id: string) =>
    request<any>(`/applications/${id}/submit`, {
      method: 'POST',
    }),

  transition: (id: string, target_status: string, notes: string) =>
    request<any>(`/applications/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ target_status, reason: notes, notes }),
    }),

  cancel: (id: string, reason: string) =>
    request<any>(`/applications/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

// ==========================================
// 5. Workflow Queues
// ==========================================
export const queuesApi = {
  getApplicantQueue: (limit = 50, offset = 0) =>
    request<any[]>(`/queues/applicant?limit=${limit}&offset=${offset}`),

  getOfficerQueue: (limit = 50, offset = 0) =>
    request<any[]>(`/queues/officer?limit=${limit}&offset=${offset}`),

  getUnderwriterQueue: (limit = 50, offset = 0) =>
    request<any[]>(`/queues/underwriter?limit=${limit}&offset=${offset}`),

  getDisbursementQueue: (limit = 50, offset = 0) =>
    request<any[]>(`/queues/disbursement?limit=${limit}&offset=${offset}`),
};

// ==========================================
// 6. Documents & KYC Verification
// ==========================================
export const documentsApi = {
  uploadMultipart: (appId: string, file: File, documentType: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);
    return request<any>(`/applications/${appId}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
  },

  list: (appId: string) => request<any[]>(`/applications/${appId}/documents`),

  getChecklist: (appId: string) =>
    request<any>(`/applications/${appId}/documents/checklist`),

  verify: (docId: string, verification_status: 'VERIFIED' | 'DEFICIENT' | 'REJECTED', verification_remarks?: string) =>
    request<any>(`/documents/${docId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ verification_status, verification_remarks }),
    }),
};

// ==========================================
// 7. Deterministic Underwriting & Decisioning
// ==========================================
export const underwritingApi = {
  evaluate: (appId: string) =>
    request<any>(`/applications/${appId}/evaluate`, {
      method: 'POST',
    }),

  getAssessment: (appId: string) =>
    request<any>(`/applications/${appId}/assessment`),

  recordDecision: (
    appId: string,
    payload: {
      decision: 'APPROVED' | 'REJECTED' | 'CONDITIONAL';
      approved_amount?: number;
      approved_apr?: number;
      approved_tenor_months?: number;
      conditions?: string;
      rejection_reason_code?: string;
      underwriter_notes: string;
    }
  ) =>
    request<any>(`/applications/${appId}/decision`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getDecision: (appId: string) =>
    request<any>(`/applications/${appId}/decision`),
};

// ==========================================
// 8. Immutable Audit Ledger
// ==========================================
export const auditApi = {
  getLogs: (params: {
    entity_id?: string;
    actor_id?: string;
    event_type?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.entity_id) searchParams.set('entity_id', params.entity_id);
    if (params.actor_id) searchParams.set('actor_id', params.actor_id);
    if (params.event_type) searchParams.set('event_type', params.event_type);
    if (params.start_date) searchParams.set('start_date', params.start_date);
    if (params.end_date) searchParams.set('end_date', params.end_date);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    const qs = searchParams.toString();
    return request<{ items: any[]; total: number; limit: number; offset: number }>(
      `/audit/logs${qs ? `?${qs}` : ''}`
    );
  },
};

// ==========================================
// 8.1 AI Chatbot & Customer Support
// ==========================================
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  reply: string;
  suggested_questions: string[];
  provider: string;
  model: string;
}

export const chatApi = {
  sendMessage: (payload: {
    message: string;
    history?: ChatMessage[];
    context?: Record<string, any>;
  }) =>
    request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};


// ==========================================
// 9. Domain Model Adapters
// ==========================================
export function mapBackendProduct(p: any): LoanProduct {
  return {
    id: String(p.id),
    code: p.code,
    name: p.name,
    description: p.description || '',
    minAmount: Number(p.min_amount),
    maxAmount: Number(p.max_amount),
    minTenorMonths: Number(p.min_tenor_months),
    maxTenorMonths: Number(p.max_tenor_months),
    baseApr: Number(p.base_apr),
    maxDtiRatio: Number(p.max_dti_ratio),
    requiredDocuments: Array.isArray(p.required_documents) ? p.required_documents : [],
    isActive: Boolean(p.is_active ?? true),
  };
}

export function mapBackendApplication(app: any, fallbackProduct?: LoanProduct): LoanApplication {
  const product: LoanProduct = app.product
    ? mapBackendProduct(app.product)
    : fallbackProduct || {
        id: String(app.product_id || 'prod-001'),
        code: 'DEFAULT',
        name: 'Standard Loan',
        description: '',
        minAmount: 50000,
        maxAmount: 5000000,
        minTenorMonths: 6,
        maxTenorMonths: 60,
        baseApr: 10.5,
        maxDtiRatio: 45,
        requiredDocuments: [],
        isActive: true,
      };

  const personal = app.applicant_personal_snapshot || {};
  const financial = app.applicant_financial_snapshot || {};

  return {
    id: String(app.id),
    referenceNumber: app.reference_number || `APP-${String(app.id).slice(0, 8)}`,
    applicantId: String(app.applicant_id || ''),
    productId: String(app.product_id || product.id),
    product,
    assignedOfficerId: app.assigned_officer_id ? String(app.assigned_officer_id) : undefined,
    assignedOfficerName: app.assigned_officer_name || undefined,
    status: app.status,
    requestedAmount: Number(app.requested_amount),
    requestedTenorMonths: Number(app.requested_tenor_months),
    purpose: app.purpose || '',
    personal: {
      fullName: personal.fullName || personal.full_name || 'Applicant',
      email: personal.email || 'applicant@credvidhi.in',
      phone: personal.phone || '+91 98765 43210',
      dateOfBirth: personal.dateOfBirth || personal.date_of_birth || '1990-01-01',
      residentialAddress: personal.residentialAddress || personal.residential_address || '',
      taxIdMasked: personal.taxIdMasked || personal.tax_id_masked || '***-**-7721',
    },
    financial: {
      employmentType: financial.employmentType || financial.employment_type || 'SALARIED',
      employerName: financial.employerName || financial.employer_name || '',
      jobTitle: financial.jobTitle || financial.job_title || '',
      yearsEmployed: Number(financial.yearsEmployed ?? financial.years_employed ?? 2.0),
      grossMonthlyIncome: Number(financial.grossMonthlyIncome ?? financial.gross_monthly_income ?? 50000),
      existingMonthlyDebt: Number(financial.existingMonthlyDebt ?? financial.existing_monthly_debt ?? 0),
      housingExpense: Number(financial.housingExpense ?? financial.housing_expense ?? 0),
      creditScoreDeclared: Number(financial.creditScoreDeclared ?? financial.credit_score_declared ?? 750),
    },
    documents: Array.isArray(app.documents)
      ? app.documents.map((d: any) => ({
          id: String(d.id),
          applicationId: String(d.application_id || app.id),
          documentType: d.document_type || d.documentType,
          originalFilename: d.original_filename || d.originalFilename || 'document.pdf',
          mimeType: d.mime_type || d.mimeType || 'application/pdf',
          fileSizeBytes: Number(d.file_size_bytes ?? d.fileSizeBytes ?? 0),
          verificationStatus: d.verification_status || d.verificationStatus || 'PENDING',
          verificationRemarks: d.verification_remarks || d.verificationRemarks,
          uploadedAt: d.uploaded_at || d.uploadedAt || new Date().toISOString(),
          verifiedAt: d.verified_at || d.verifiedAt,
          verifiedByName: d.verified_by_name || d.verifiedByName,
        }))
      : [],
    riskAssessment: app.risk_assessment
      ? {
          id: String(app.risk_assessment.id),
          applicationId: String(app.id),
          calculatedDti: Number(app.risk_assessment.calculated_dti),
          calculatedEmi: Number(app.risk_assessment.calculated_emi),
          disposableIncome: Number(app.risk_assessment.disposable_income),
          internalRiskScore: Number(app.risk_assessment.internal_risk_score),
          riskTier: app.risk_assessment.risk_tier,
          recommendation: app.risk_assessment.recommendation,
          scoreFactors: app.risk_assessment.score_factors || [],
          evaluatedAt: app.risk_assessment.evaluated_at || new Date().toISOString(),
        }
      : undefined,
    decision: app.decision
      ? {
          id: String(app.decision.id),
          applicationId: String(app.id),
          decision: app.decision.decision,
          approvedAmount: app.decision.approved_amount ? Number(app.decision.approved_amount) : undefined,
          approvedApr: app.decision.approved_apr ? Number(app.decision.approved_apr) : undefined,
          approvedTenorMonths: app.decision.approved_tenor_months ? Number(app.decision.approved_tenor_months) : undefined,
          conditions: app.decision.conditions,
          rejectionReasonCode: app.decision.rejection_reason_code,
          underwriterNotes: app.decision.underwriter_notes || '',
          decidedByName: app.decision.decided_by_name || 'System / Underwriter',
          decidedAt: app.decision.decided_at || new Date().toISOString(),
        }
      : undefined,
    submittedAt: app.submitted_at,
    createdAt: app.created_at || new Date().toISOString(),
    updatedAt: app.updated_at || new Date().toISOString(),
  };
}

export function mapBackendAuditLog(log: any): AuditLog {
  const notes =
    log.notes ||
    (log.metadata_snapshot
      ? typeof log.metadata_snapshot === 'string'
        ? log.metadata_snapshot
        : JSON.stringify(log.metadata_snapshot)
      : undefined) ||
    (log.payload ? JSON.stringify(log.payload) : undefined);

  const beforeState =
    log.before_state ||
    (typeof log.prior_state === 'object' && log.prior_state
      ? JSON.stringify(log.prior_state)
      : log.prior_state);

  const afterState =
    log.after_state ||
    (typeof log.subsequent_state === 'object' && log.subsequent_state
      ? JSON.stringify(log.subsequent_state)
      : log.subsequent_state);

  return {
    id: String(log.id),
    applicationId: log.application_id || log.entity_id,
    actorId: String(log.actor_id || ''),
    actorName: log.actor_name || 'System Service',
    actorRole: log.actor_role || 'ADMIN',
    eventType: log.event_type,
    beforeState,
    afterState,
    notes,
    timestamp: log.created_at || log.timestamp || new Date().toISOString(),
  };
}
