export type UserRole = 'APPLICANT' | 'LOAN_OFFICER' | 'RISK_ANALYST' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  password?: string;
  isActive: boolean;
}

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'DOCUMENTS_PENDING'
  | 'DOCUMENTS_VERIFIED'
  | 'RISK_ASSESSED'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISBURSED'
  | 'CANCELLED';

export interface DocumentChecklistItem {
  code: string;
  title: string;
  description: string;
  mandatory: boolean;
}

export interface LoanProduct {
  id: string;
  code: string;
  name: string;
  description: string;
  minAmount: number;
  maxAmount: number;
  minTenorMonths: number;
  maxTenorMonths: number;
  baseApr: number;
  maxDtiRatio: number;
  requiredDocuments: DocumentChecklistItem[];
  isActive: boolean;
}

export interface ApplicationDocument {
  id: string;
  applicationId: string;
  documentType: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'DEFICIENT';
  verificationRemarks?: string;
  uploadedAt: string;
  verifiedAt?: string;
  verifiedByName?: string;
}

export interface ScoreFactor {
  name: string;
  evaluated: string;
  threshold: string;
  status: 'PASS' | 'FLAG' | 'FAIL';
}

export interface RiskAssessment {
  id: string;
  applicationId: string;
  calculatedDti: number;
  calculatedEmi: number;
  disposableIncome: number;
  internalRiskScore: number;
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
  scoreFactors: ScoreFactor[];
  evaluatedAt: string;
}

export interface LoanDecision {
  id: string;
  applicationId: string;
  decision: 'APPROVED' | 'REJECTED' | 'CONDITIONAL';
  approvedAmount?: number;
  approvedApr?: number;
  approvedTenorMonths?: number;
  conditions?: string;
  rejectionReasonCode?: string;
  underwriterNotes: string;
  decidedByName: string;
  decidedAt: string;
}

export interface ApplicantPersonalData {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  residentialAddress: string;
  taxIdMasked: string;
}

export interface ApplicantFinancialData {
  employmentType: 'SALARIED' | 'SELF_EMPLOYED';
  employerName: string;
  jobTitle: string;
  yearsEmployed: number;
  grossMonthlyIncome: number;
  existingMonthlyDebt: number;
  housingExpense: number;
  creditScoreDeclared: number;
}

export interface LoanApplication {
  id: string;
  referenceNumber: string;
  applicantId: string;
  productId: string;
  product: LoanProduct;
  assignedOfficerId?: string;
  assignedOfficerName?: string;
  status: ApplicationStatus;
  requestedAmount: number;
  requestedTenorMonths: number;
  purpose: string;
  personal: ApplicantPersonalData;
  financial: ApplicantFinancialData;
  documents: ApplicationDocument[];
  riskAssessment?: RiskAssessment;
  decision?: LoanDecision;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  applicationId?: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  eventType: string;
  beforeState?: string;
  afterState?: string;
  notes?: string;
  timestamp: string;
}
