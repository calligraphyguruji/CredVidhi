import React, { createContext, useContext, useState, useEffect } from 'react';
import type {
  LoanApplication,
  LoanProduct,
  User,
  UserRole,
  AuditLog,
  ApplicationStatus,
  RiskAssessment,
  ScoreFactor,
} from '../types';
import {
  INITIAL_APPLICATIONS,
  INITIAL_PRODUCTS,
  INITIAL_USERS,
  INITIAL_AUDIT_LOGS,
} from '../services/mockData';
import { calculateEmi, calculateDti, calculateDisposableIncome } from '../utils/financial';

interface AppContextType {
  currentUser: User;
  currentRole: UserRole;
  switchRole: (role: UserRole) => void;
  applications: LoanApplication[];
  products: LoanProduct[];
  auditLogs: AuditLog[];
  activeApplicationId: string;
  setActiveApplicationId: (id: string) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  selectedDocId: string | null;
  setSelectedDocId: (id: string | null) => void;
  // Lifecycle Actions
  submitNewApplication: (data: {
    productId: string;
    requestedAmount: number;
    requestedTenorMonths: number;
    purpose: string;
    personal: any;
    financial: any;
    uploadedDocs: Array<{ title: string; filename: string; size: number }>;
  }) => string;
  verifyDocument: (
    applicationId: string,
    documentId: string,
    status: 'VERIFIED' | 'DEFICIENT',
    remarks: string
  ) => void;
  transitionApplicationStatus: (
    applicationId: string,
    nextStatus: ApplicationStatus,
    notes: string
  ) => void;
  runRiskAssessment: (applicationId: string) => void;
  recordUnderwritingDecision: (
    applicationId: string,
    decision: 'APPROVED' | 'REJECTED' | 'CONDITIONAL',
    payload: {
      approvedAmount?: number;
      approvedApr?: number;
      approvedTenorMonths?: number;
      conditions?: string;
      rejectionReasonCode?: string;
      underwriterNotes: string;
    }
  ) => void;
  resetAllData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  APPLICATIONS: 'laps_applications_v2',
  AUDIT_LOGS: 'laps_audit_logs_v2',
  CURRENT_ROLE: 'laps_current_role_v2',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_ROLE);
    return (saved as UserRole) || 'LOAN_OFFICER';
  });

  const currentUser = INITIAL_USERS.find((u) => u.role === currentRole) || INITIAL_USERS[0];

  const [applications, setApplications] = useState<LoanApplication[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse cached applications', e);
      }
    }
    return INITIAL_APPLICATIONS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse cached audit logs', e);
      }
    }
    return INITIAL_AUDIT_LOGS;
  });

  const [activeApplicationId, setActiveApplicationId] = useState<string>('app-001');
  const [selectedDocId, setSelectedDocId] = useState<string | null>('doc-002');
  const [activeView, setActiveView] = useState<string>('landing');

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(applications));
  }, [applications]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_ROLE, currentRole);
  }, [currentRole]);

  const addAuditLog = (entry: Omit<AuditLog, 'id' | 'timestamp' | 'actorId' | 'actorName' | 'actorRole'>) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      ...entry,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const switchRole = (role: UserRole) => {
    setCurrentRole(role);
    if (role === 'LOAN_OFFICER') setActiveView('officer-queue');
    else if (role === 'RISK_ANALYST') setActiveView('underwriting-cockpit');
    else if (role === 'APPLICANT') setActiveView('borrower-portal');
    else if (role === 'ADMIN') setActiveView('compliance-audit');
  };

  const transitionApplicationStatus = (
    applicationId: string,
    nextStatus: ApplicationStatus,
    notes: string
  ) => {
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id !== applicationId) return app;
        const prevStatus = app.status;
        addAuditLog({
          applicationId: app.id,
          eventType: 'STATE_TRANSITION',
          beforeState: prevStatus,
          afterState: nextStatus,
          notes,
        });
        return {
          ...app,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const verifyDocument = (
    applicationId: string,
    documentId: string,
    status: 'VERIFIED' | 'DEFICIENT',
    remarks: string
  ) => {
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id !== applicationId) return app;

        const updatedDocs = app.documents.map((doc) => {
          if (doc.id !== documentId) return doc;
          return {
            ...doc,
            verificationStatus: status,
            verificationRemarks: remarks,
            verifiedAt: new Date().toISOString(),
            verifiedByName: currentUser.fullName,
          };
        });

        // Add audit trail entry
        const targetDoc = app.documents.find((d) => d.id === documentId);
        addAuditLog({
          applicationId: app.id,
          eventType: status === 'VERIFIED' ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_FLAGGED',
          beforeState: targetDoc?.verificationStatus,
          afterState: status,
          notes: `${targetDoc?.documentType}: ${remarks}`,
        });

        // Check if all mandatory documents are verified
        const allMandatoryVerified = app.product.requiredDocuments.every((req) => {
          const match = updatedDocs.find((d) => d.documentType.toLowerCase().includes(req.title.toLowerCase()) || req.title.toLowerCase().includes(d.documentType.toLowerCase()));
          return match && match.verificationStatus === 'VERIFIED';
        });

        let nextStatus = app.status;
        if (status === 'DEFICIENT') {
          nextStatus = 'DOCUMENTS_PENDING';
        } else if (allMandatoryVerified && app.status === 'UNDER_REVIEW') {
          nextStatus = 'DOCUMENTS_VERIFIED';
        }

        return {
          ...app,
          status: nextStatus,
          documents: updatedDocs,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const runRiskAssessment = (applicationId: string) => {
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id !== applicationId) return app;

        const emi = calculateEmi(app.requestedAmount, app.product.baseApr, app.requestedTenorMonths);
        const dti = calculateDti(
          app.financial.grossMonthlyIncome,
          app.financial.existingMonthlyDebt,
          emi
        );
        const disposable = calculateDisposableIncome(
          app.financial.grossMonthlyIncome,
          app.financial.existingMonthlyDebt,
          app.financial.housingExpense,
          emi
        );

        // Deterministic Score Calculation (0 - 1000)
        let score = 500;
        // Credit score contribution
        if (app.financial.creditScoreDeclared >= 750) score += 250;
        else if (app.financial.creditScoreDeclared >= 680) score += 180;
        else if (app.financial.creditScoreDeclared >= 620) score += 80;

        // DTI contribution
        if (dti <= 30) score += 150;
        else if (dti <= 40) score += 80;
        else if (dti > 45) score -= 100;

        // Employment contribution
        if (app.financial.yearsEmployed >= 3) score += 100;
        else if (app.financial.yearsEmployed >= 1) score += 50;

        score = Math.min(950, Math.max(350, score));

        let tier: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
        let recommendation = '';
        if (score >= 750 && dti <= app.product.maxDtiRatio) {
          tier = 'LOW';
          recommendation = 'PRE-APPROVED: Low credit risk, prime metrics qualify for preferred APR.';
        } else if (score >= 650 && dti <= app.product.maxDtiRatio + 3) {
          tier = 'MEDIUM';
          recommendation = 'CONDITIONAL APPROVAL: Meets standard criteria. Review income stability and debts.';
        } else {
          tier = 'HIGH';
          recommendation = 'ELEVATED RISK: Elevated DTI or lower credit tier. Requires senior underwriter signoff.';
        }

        const scoreFactors: ScoreFactor[] = [
          {
            name: 'Debt-to-Income (DTI)',
            evaluated: `${dti}%`,
            threshold: `<= ${app.product.maxDtiRatio}%`,
            status: dti <= app.product.maxDtiRatio ? 'PASS' : 'FLAG',
          },
          {
            name: 'Credit Score',
            evaluated: `${app.financial.creditScoreDeclared}`,
            threshold: '>= 650',
            status: app.financial.creditScoreDeclared >= 650 ? 'PASS' : 'FAIL',
          },
          {
            name: 'Employment Tenure',
            evaluated: `${app.financial.yearsEmployed} Years`,
            threshold: '>= 2.0 Years',
            status: app.financial.yearsEmployed >= 2.0 ? 'PASS' : 'FLAG',
          },
          {
            name: 'Disposable Income Buffer',
            evaluated: `₹${disposable.toLocaleString('en-IN')} / mo`,
            threshold: '>= ₹1,500.00',
            status: disposable >= 1500 ? 'PASS' : 'FAIL',
          },
        ];

        const assessment: RiskAssessment = {
          id: `risk-${Date.now()}`,
          applicationId: app.id,
          calculatedDti: dti,
          calculatedEmi: emi,
          disposableIncome: disposable,
          internalRiskScore: score,
          riskTier: tier,
          recommendation,
          scoreFactors,
          evaluatedAt: new Date().toISOString(),
        };

        addAuditLog({
          applicationId: app.id,
          eventType: 'RISK_ASSESSED',
          beforeState: app.status,
          afterState: 'RISK_ASSESSED',
          notes: `Computed Risk Score: ${score} (${tier} RISK). DTI: ${dti}%. Recommended: ${recommendation}`,
        });

        return {
          ...app,
          status: 'RISK_ASSESSED',
          riskAssessment: assessment,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const recordUnderwritingDecision = (
    applicationId: string,
    decision: 'APPROVED' | 'REJECTED' | 'CONDITIONAL',
    payload: {
      approvedAmount?: number;
      approvedApr?: number;
      approvedTenorMonths?: number;
      conditions?: string;
      rejectionReasonCode?: string;
      underwriterNotes: string;
    }
  ) => {
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id !== applicationId) return app;

        const nextStatus: ApplicationStatus = decision === 'REJECTED' ? 'REJECTED' : 'APPROVED';

        addAuditLog({
          applicationId: app.id,
          eventType: 'DECISION_RECORDED',
          beforeState: app.status,
          afterState: nextStatus,
          notes: `${decision}: ${payload.underwriterNotes} (Approved Amount: ₹${(payload.approvedAmount ?? app.requestedAmount).toLocaleString('en-IN')})`,
        });

        return {
          ...app,
          status: nextStatus,
          decision: {
            id: `dec-${Date.now()}`,
            applicationId: app.id,
            decision,
            approvedAmount: payload.approvedAmount ?? app.requestedAmount,
            approvedApr: payload.approvedApr ?? app.product.baseApr,
            approvedTenorMonths: payload.approvedTenorMonths ?? app.requestedTenorMonths,
            conditions: payload.conditions,
            rejectionReasonCode: payload.rejectionReasonCode,
            underwriterNotes: payload.underwriterNotes,
            decidedByName: currentUser.fullName,
            decidedAt: new Date().toISOString(),
          },
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const submitNewApplication = (data: {
    productId: string;
    requestedAmount: number;
    requestedTenorMonths: number;
    purpose: string;
    personal: any;
    financial: any;
    uploadedDocs: Array<{ title: string; filename: string; size: number }>;
  }) => {
    const selectedProd = INITIAL_PRODUCTS.find((p) => p.id === data.productId) || INITIAL_PRODUCTS[0];
    const newId = `app-${Date.now().toString().slice(-4)}`;
    const refNumber = `APP-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const newDocs = data.uploadedDocs.map((doc, idx) => ({
      id: `doc-${newId}-${idx + 1}`,
      applicationId: newId,
      documentType: doc.title,
      originalFilename: doc.filename,
      mimeType: doc.filename.endsWith('.png') ? 'image/png' : 'application/pdf',
      fileSizeBytes: doc.size,
      verificationStatus: 'PENDING' as const,
      uploadedAt: new Date().toISOString(),
    }));

    const newApp: LoanApplication = {
      id: newId,
      referenceNumber: refNumber,
      applicantId: currentUser.id,
      productId: selectedProd.id,
      product: selectedProd,
      assignedOfficerId: 'usr-officer-1',
      assignedOfficerName: 'David Vance',
      status: 'SUBMITTED',
      requestedAmount: data.requestedAmount,
      requestedTenorMonths: data.requestedTenorMonths,
      purpose: data.purpose,
      personal: {
        fullName: data.personal.fullName,
        email: data.personal.email,
        phone: data.personal.phone,
        dateOfBirth: data.personal.dateOfBirth,
        residentialAddress: data.personal.residentialAddress,
        taxIdMasked: `***-**-${data.personal.taxId ? data.personal.taxId.slice(-4) : '7721'}`,
      },
      financial: {
        employmentType: data.financial.employmentType,
        employerName: data.financial.employerName,
        jobTitle: data.financial.jobTitle,
        yearsEmployed: Number(data.financial.yearsEmployed) || 2.0,
        grossMonthlyIncome: Number(data.financial.grossMonthlyIncome) || 5000,
        existingMonthlyDebt: Number(data.financial.existingMonthlyDebt) || 500,
        housingExpense: Number(data.financial.housingExpense) || 1200,
        creditScoreDeclared: Number(data.financial.creditScoreDeclared) || 720,
      },
      documents: newDocs,
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setApplications((prev) => [newApp, ...prev]);
    setActiveApplicationId(newId);

    addAuditLog({
      applicationId: newId,
      eventType: 'APPLICATION_SUBMITTED',
      afterState: 'SUBMITTED',
      notes: `New application submitted by ${data.personal.fullName} for ₹${data.requestedAmount.toLocaleString('en-IN')} (${selectedProd.name})`,
    });

    return newId;
  };

  const resetAllData = () => {
    localStorage.removeItem(STORAGE_KEYS.APPLICATIONS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ROLE);
    setApplications(INITIAL_APPLICATIONS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setCurrentRole('LOAN_OFFICER');
    setActiveApplicationId('app-001');
    setActiveView('officer-queue');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        currentRole,
        switchRole,
        applications,
        products: INITIAL_PRODUCTS,
        auditLogs,
        activeApplicationId,
        setActiveApplicationId,
        activeView,
        setActiveView,
        selectedDocId,
        setSelectedDocId,
        submitNewApplication,
        verifyDocument,
        transitionApplicationStatus,
        runRiskAssessment,
        recordUnderwritingDecision,
        resetAllData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
