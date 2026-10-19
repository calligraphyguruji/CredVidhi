import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
import { ToastContainer, type ToastMessage } from '../components/ui/Toast';
import { applyRouteSEO, resolveViewFromUrl, isPublicRoute } from '../utils/seo';
import { canRoleAccessView, getDefaultViewForRole, isValidAppView } from '../utils/rbac';
import {
  authApi,
  clearAuthTokens,
  auditApi,
  mapBackendAuditLog,
  AUTH_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  productsApi,
  applicationsApi,
  queuesApi,
  documentsApi,
  underwritingApi,
  mapBackendProduct,
  mapBackendApplication,
} from '../services/api';

interface AppContextType {
  currentUser: User;
  currentRole: UserRole;
  switchRole: (role: UserRole, targetView?: string) => void;
  applications: LoanApplication[];
  products: LoanProduct[];
  auditLogs: AuditLog[];
  activeApplicationId: string;
  setActiveApplicationId: (id: string) => void;
  activeView: string;
  setActiveView: (view: string, redirectTarget?: string) => void;
  pendingRedirectView: string | null;
  setPendingRedirectView: (view: string | null) => void;
  selectedDocId: string | null;
  setSelectedDocId: (id: string | null) => void;
  // Authentication & Session
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  beginDemo: () => void;
  isDemoMode: boolean;
  dataError: string | null;
  logout: (redirectView?: string) => Promise<void>;
  // Backend Live Connectivity
  isBackendConnected: boolean;
  backendHealth: { database: boolean; redis: boolean } | null;
  isSyncing: boolean;
  refreshFromBackend: () => Promise<void>;
  // Theme (Light / Dark)
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  // Notifications / Toasts
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  // Lifecycle Actions
  submitNewApplication: (draftId: string) => Promise<string>;
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
  ) => Promise<void>;
  users: User[];
  addLoanProduct: (product: Omit<LoanProduct, 'id'>) => void;
  updateLoanProduct: (id: string, updates: Partial<LoanProduct>) => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  registerApplicant: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    pan?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  resetAllData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  APPLICATIONS: 'credvidhi_applications_v1',
  AUDIT_LOGS: 'credvidhi_audit_logs_v1',
  CURRENT_ROLE: 'credvidhi_current_role_v1',
  PRODUCTS: 'credvidhi_products_v1',
  USERS: 'credvidhi_users_v1',
  IS_AUTHENTICATED: 'credvidhi_is_authenticated_v1',
  PENDING_REDIRECT: 'credvidhi_pending_redirect_v1',
};

const isUUID = (str: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const urlTheme = new URLSearchParams(window.location.search).get('theme');
    if (urlTheme === 'dark' || urlTheme === 'light') return urlTheme;
    const saved = localStorage.getItem('credvidhi_theme');
    if (saved === 'dark') return 'dark';
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('credvidhi_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const demoRef = useRef(false);
  const sessionVersion = useRef(0);
  const refreshingSession = useRef<number | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('APPLICANT');
  const [users, setUsers] = useState<User[]>([]);
  const [identity, setIdentity] = useState<User | null>(null);
  const [products, setProducts] = useState<LoanProduct[]>(INITIAL_PRODUCTS);
  const currentUser: User = identity || { id: '', email: '', fullName: '', role: 'APPLICANT', isActive: false };
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);

  const clearPrivateData = () => {
    sessionVersion.current += 1;
    setApplications([]);
    setAuditLogs([]);
    setUsers([]);
    setIdentity(null);
    setActiveApplicationId('');
    setSelectedDocId(null);
    setToasts([]);
    for (const key of [STORAGE_KEYS.APPLICATIONS, STORAGE_KEYS.AUDIT_LOGS, STORAGE_KEYS.USERS,
      STORAGE_KEYS.IS_AUTHENTICATED, STORAGE_KEYS.CURRENT_ROLE, STORAGE_KEYS.PRODUCTS]) localStorage.removeItem(key);
  };

  const applyProfile = (profile: any): User => {
    const user: User = { id: String(profile.id), email: profile.email, fullName: profile.full_name,
      role: profile.role, phone: profile.phone_number, isActive: profile.is_active };
    setIdentity(user);
    setUsers([user]);
    setCurrentRole(user.role);
    setIsAuthenticated(true);
    return user;
  };

  const [pendingRedirectView, setPendingRedirectViewState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const urlRedirect = new URLSearchParams(window.location.search).get('redirect');
    if (urlRedirect && isValidAppView(urlRedirect) && !isPublicRoute(urlRedirect)) {
      return urlRedirect;
    }
    return localStorage.getItem(STORAGE_KEYS.PENDING_REDIRECT);
  });

  const setPendingRedirectView = (view: string | null) => {
    setPendingRedirectViewState(view);
    if (typeof window !== 'undefined') {
      if (view) {
        localStorage.setItem(STORAGE_KEYS.PENDING_REDIRECT, view);
      } else {
        localStorage.removeItem(STORAGE_KEYS.PENDING_REDIRECT);
      }
    }
  };

  const [activeApplicationId, setActiveApplicationId] = useState<string>('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [activeView, setActiveViewState] = useState<string>(() => {
    const initialView = resolveViewFromUrl();
    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem(AUTH_TOKEN_KEY);
    const isAuth = hasToken;
    if (!isPublicRoute(initialView) && !isAuth) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.PENDING_REDIRECT, initialView);
      }
      return 'register';
    }
    return initialView;
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newToast: ToastMessage = { id, ...toast };
    setToasts((prev) => [...prev.slice(-3), newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const setActiveView = (view: string, redirectTarget?: string) => {
    const isAuthed = isAuthenticated;

    if (!isPublicRoute(view) && !isAuthed) {
      const target = redirectTarget || view;
      setPendingRedirectView(target);
      setActiveViewState('register');
      return;
    }

    if (isAuthed && !isPublicRoute(view)) {
      if (!canRoleAccessView(currentRole, view)) {
        const fallbackView = getDefaultViewForRole(currentRole);
        setActiveViewState(fallbackView);
        addToast({
          type: 'error',
          title: 'Access Restricted (RBAC)',
          message: `Your account (${currentRole}) does not have permission for the requested view. Navigated to your primary workspace.`,
        });
        return;
      }
    }

    if (isPublicRoute(view) && redirectTarget) {
      if (isValidAppView(redirectTarget) && !isPublicRoute(redirectTarget)) {
        setPendingRedirectView(redirectTarget);
      }
    }

    setActiveViewState(view);
  };

  const login = async (email: string, password: string) => {
    clearPrivateData();
    demoRef.current = false;
    setIsDemoMode(false);
    setIsAuthenticated(false);
    setDataError(null);
    const version = sessionVersion.current;
    await authApi.login(email, password);
    if (version !== sessionVersion.current) return;
    const profile = await authApi.getMe();
    if (version !== sessionVersion.current) return;
    setIsSyncing(true);
    const user = applyProfile(profile);
    const target = pendingRedirectView;
    setPendingRedirectView(null);
    setActiveViewState(target && canRoleAccessView(user.role, target) ? target : getDefaultViewForRole(user.role));
  };

  const logout = async (redirectView = 'landing') => {
    const request = demoRef.current ? Promise.resolve() : authApi.logout();
    clearPrivateData();
    demoRef.current = false;
    setIsDemoMode(false);
    setIsAuthenticated(false);
    setDataError(null);
    clearAuthTokens();
    setPendingRedirectView(null);
    setActiveViewState(isPublicRoute(redirectView) ? redirectView : 'landing');
    await request.catch(() => undefined);
  };

  const beginDemo = () => {
    clearPrivateData();
    clearAuthTokens();
    demoRef.current = true;
    setIsDemoMode(true);
    setIsBackendConnected(false);
    setIsSyncing(false);
    setDataError(null);
    setUsers(structuredClone(INITIAL_USERS));
    setIdentity(INITIAL_USERS.find(u => u.role === 'LOAN_OFFICER')!);
    setCurrentRole('LOAN_OFFICER');
    setApplications(structuredClone(INITIAL_APPLICATIONS));
    setProducts(structuredClone(INITIAL_PRODUCTS));
    setAuditLogs(structuredClone(INITIAL_AUDIT_LOGS));
    setActiveApplicationId(INITIAL_APPLICATIONS[0]?.id || '');
    setIsAuthenticated(true);
    setActiveViewState('officer-queue');
  };

  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [backendHealth, setBackendHealth] = useState<{ database: boolean; redis: boolean } | null>(null);
  const [isSyncing, setIsSyncing] = useState(true);

  const refreshFromBackend = async () => {
    if (demoRef.current) { setIsSyncing(false); return; }
    const version = sessionVersion.current;
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const isCurrent = () => version === sessionVersion.current && token === localStorage.getItem(AUTH_TOKEN_KEY) && !demoRef.current;
    if (!token) { setIsSyncing(false); return; }
    refreshingSession.current = version;
    setIsSyncing(true);
    setDataError(null);
    try {
      const profile: any = await authApi.getMe();
      if (!isCurrent()) return;
      applyProfile(profile);
      const catalog = (await productsApi.list()).map(mapBackendProduct);
      if (!isCurrent()) return;
      const summaries: any[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = profile.role === 'APPLICANT' ? await queuesApi.getApplicantQueue(100, offset)
          : profile.role === 'RISK_ANALYST' ? await queuesApi.getUnderwriterQueue(100, offset)
          : await queuesApi.getOfficerQueue(100, offset);
        if (!isCurrent()) return;
        summaries.push(...page);
        if (page.length < 100) break;
      }
      const loadRecord = async (summary: any): Promise<LoanApplication> => {
        const app = await applicationsApi.getById(summary.id);
        if (!isCurrent()) throw new Error('Session changed.');
        if (profile.role === 'APPLICANT' && String(app.applicant_id) !== String(profile.id)) throw new Error('Unexpected application ownership.');
        app.documents = await documentsApi.list(app.id);
        if (!isCurrent()) throw new Error('Session changed.');
        for (const [key, fetcher, missing] of [
          ['risk_assessment', underwritingApi.getAssessment, 'ASSESSMENT_NOT_FOUND'],
          ['decision', underwritingApi.getDecision, 'DECISION_NOT_FOUND'],
        ] as const) {
          if (!isCurrent()) throw new Error('Session changed.');
          try { app[key] = await fetcher(app.id); }
          catch (err: any) { if (err.code !== missing) throw err; }
        }
        const product = catalog.find(p => p.id === String(app.product_id));
        if (!product) throw new Error('Loan product information is unavailable.');
        return mapBackendApplication(app, product);
      };
      const records: LoanApplication[] = [];
      for (let offset = 0; offset < summaries.length; offset += 4) {
        if (!isCurrent()) return;
        records.push(...await Promise.all(summaries.slice(offset, offset + 4).map(loadRecord)));
      }
      if (!isCurrent()) return;
      if (profile.role === 'ADMIN') {
        const logs = await auditApi.getLogs({ limit: 100 });
        if (!isCurrent()) return;
        setAuditLogs(logs.items.map(mapBackendAuditLog));
      }
      setProducts(catalog);
      setApplications(records);
      setIsBackendConnected(true);
      setBackendHealth({ database: true, redis: false });
    } catch (err: any) {
      if (!isCurrent()) return;
      setApplications([]);
      setAuditLogs([]);
      setIsBackendConnected(false);
      setDataError(err.message || 'Unable to load your account. Please retry.');
      if (err.statusCode === 401 || err.statusCode === 403) {
        clearPrivateData();
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        setIsAuthenticated(false);
        setActiveViewState('login-borrower');
      }
    } finally {
      if (refreshingSession.current === version) refreshingSession.current = null;
      if (isCurrent()) setIsSyncing(false);
    }
  };

  useEffect(() => {
    for (const key of [STORAGE_KEYS.APPLICATIONS, STORAGE_KEYS.AUDIT_LOGS, STORAGE_KEYS.USERS, STORAGE_KEYS.IS_AUTHENTICATED]) localStorage.removeItem(key);
    const timer = setTimeout(() => { if (refreshingSession.current !== sessionVersion.current) void refreshFromBackend(); }, 0);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_TOKEN_KEY) {
        clearPrivateData();
        setIsAuthenticated(false);
        setActiveViewState('login');
      }
    };
    const expire = () => { void logout('login-borrower'); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('credvidhi:session-expired', expire);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('credvidhi:session-expired', expire); };
  }, []);

  // Dynamic Route SEO and Meta Tag Synchronization
  const isInitialMount = useRef(true);
  useEffect(() => {
    const shouldReplace = isInitialMount.current && !isPublicRoute(resolveViewFromUrl());
    applyRouteSEO(activeView, true, shouldReplace);
    isInitialMount.current = false;
  }, [activeView]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const targetView = (event.state && event.state.view) || resolveViewFromUrl();
      const isAuthed = isAuthenticated;
      if (!isPublicRoute(targetView) && !isAuthed) {
        setActiveViewState('register');
      } else if (isAuthed && !isPublicRoute(targetView) && !canRoleAccessView(currentRole, targetView)) {
        setActiveViewState(getDefaultViewForRole(currentRole));
        addToast({
          type: 'error',
          title: 'Access Restricted (RBAC)',
          message: `Your account (${currentRole}) does not have permission for the requested view. Navigated to your primary workspace.`,
        });
      } else {
        setActiveViewState(targetView);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthenticated, currentRole]);

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

  const switchRole = (role: UserRole, targetView?: string) => {
    if (!demoRef.current) return;
    setCurrentRole(role);
    setIdentity(INITIAL_USERS.find(u => u.role === role)!);
    setActiveViewState(targetView && canRoleAccessView(role, targetView) ? targetView : getDefaultViewForRole(role));
  };

  const transitionApplicationStatus = (
    applicationId: string,
    nextStatus: ApplicationStatus,
    notes: string
  ) => {
    if (!demoRef.current) {
      const version = sessionVersion.current;
      void applicationsApi.transition(applicationId, nextStatus, notes).then(() => { if (version === sessionVersion.current) return refreshFromBackend(); })
        .catch((err: any) => { if (version === sessionVersion.current) addToast({ type: 'error', title: 'Request failed', message: err.message || 'Please retry.' }); });
      return;
    }
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

    if (isBackendConnected && isUUID(applicationId)) {
      applicationsApi.transition(applicationId, nextStatus, notes).catch((err) => {
        console.warn('Backend status transition sync failed (local state preserved):', err);
      });
    }
  };

  const verifyDocument = (
    applicationId: string,
    documentId: string,
    status: 'VERIFIED' | 'DEFICIENT',
    remarks: string
  ) => {
    if (!demoRef.current) {
      const version = sessionVersion.current;
      void documentsApi.verify(documentId, status, remarks).then(() => { if (version === sessionVersion.current) return refreshFromBackend(); })
        .catch((err: any) => { if (version === sessionVersion.current) addToast({ type: 'error', title: 'Request failed', message: err.message || 'Please retry.' }); });
      return;
    }
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
          addToast({
            type: 'warning',
            title: 'Deficiency Flagged',
            message: `${targetDoc?.documentType || 'Document'} marked deficient: ${remarks}`,
          });
        } else if (allMandatoryVerified && app.status === 'UNDER_REVIEW') {
          nextStatus = 'DOCUMENTS_VERIFIED';
          addToast({
            type: 'success',
            title: 'All Documents Verified',
            message: `Docket ${app.referenceNumber} is ready for risk assessment.`,
          });
        } else {
          addToast({
            type: 'success',
            title: 'Document Verified',
            message: `${targetDoc?.documentType || 'Document'} verified by ${currentUser.fullName}.`,
          });
        }

        return {
          ...app,
          status: nextStatus,
          documents: updatedDocs,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    if (isBackendConnected && isUUID(documentId)) {
      documentsApi.verify(documentId, status, remarks).catch((err) => {
        console.warn('Backend document verification sync failed (local state preserved):', err);
      });
    }
  };

  const runRiskAssessment = (applicationId: string) => {
    if (!demoRef.current) {
      const version = sessionVersion.current;
      void underwritingApi.evaluate(applicationId).then(() => { if (version === sessionVersion.current) return refreshFromBackend(); })
        .catch((err: any) => { if (version === sessionVersion.current) addToast({ type: 'error', title: 'Request failed', message: err.message || 'Please retry.' }); });
      return;
    }
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
        if ((app.financial.creditScoreDeclared ?? 0) >= 750) score += 250;
        else if ((app.financial.creditScoreDeclared ?? 0) >= 680) score += 180;
        else if ((app.financial.creditScoreDeclared ?? 0) >= 620) score += 80;

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
            status: (app.financial.creditScoreDeclared ?? 0) >= 650 ? 'PASS' : 'FAIL',
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

        addToast({
          type: 'info',
          title: 'Risk Evaluation Complete',
          message: `Calculated score: ${score}/1000 (${tier} Tier), DTI: ${dti}%.`,
        });

        return {
          ...app,
          status: 'RISK_ASSESSED',
          riskAssessment: assessment,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    if (isBackendConnected && isUUID(applicationId)) {
      underwritingApi.evaluate(applicationId).catch((err) => {
        console.warn('Backend risk evaluation sync failed (local state preserved):', err);
      });
    }
  };

  const recordUnderwritingDecision = async (
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
    if (!demoRef.current) {
      const version = sessionVersion.current;
      try {
        await underwritingApi.recordDecision(applicationId, { decision, approved_amount: payload.approvedAmount,
          approved_apr: payload.approvedApr, approved_tenor_months: payload.approvedTenorMonths,
          conditions: payload.conditions, rejection_reason_code: payload.rejectionReasonCode, underwriter_notes: payload.underwriterNotes });
        if (version !== sessionVersion.current) throw new Error('Session changed. Please sign in again.');
        await refreshFromBackend();
      } catch (err: any) {
        if (version === sessionVersion.current) addToast({ type: 'error', title: 'Request failed', message: err.message || 'Please retry.' });
        throw err;
      }
      return;
    }
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

        if (decision === 'REJECTED') {
          addToast({
            type: 'error',
            title: 'Application Rejected',
            message: `Docket ${app.referenceNumber} rejected (${payload.rejectionReasonCode || 'Credit Policy'}).`,
          });
        } else {
          addToast({
            type: 'success',
            title: 'Application Approved',
            message: `Docket ${app.referenceNumber} approved for ₹${(payload.approvedAmount ?? app.requestedAmount).toLocaleString('en-IN')}.`,
          });
        }

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

    if (isBackendConnected && isUUID(applicationId)) {
      underwritingApi
        .recordDecision(applicationId, {
          decision,
          approved_amount: payload.approvedAmount,
          approved_apr: payload.approvedApr,
          approved_tenor_months: payload.approvedTenorMonths,
          conditions: payload.conditions,
          rejection_reason_code:
            payload.rejectionReasonCode || (decision === 'REJECTED' ? 'CREDIT_POLICY' : undefined),
          underwriter_notes: payload.underwriterNotes,
        })
        .catch((err) => {
          console.warn('Backend decision sync failed (local state preserved):', err);
        });
    }
  };

  const submitNewApplication = async (draftId: string): Promise<string> => {
    if (!isAuthenticated || currentRole !== 'APPLICANT' || demoRef.current) throw new Error('Please sign in with a borrower account to submit an application.');
    const version = sessionVersion.current;
    const submitted = await applicationsApi.submit(draftId);
    if (version !== sessionVersion.current) throw new Error('Session changed. Please sign in to view your application.');
    await refreshFromBackend();
    return String(submitted.id);
  };

  const addLoanProduct = (newProductData: Omit<LoanProduct, 'id'>) => {
    if (!demoRef.current) {
      const version = sessionVersion.current;
      void productsApi.create({ code: newProductData.code, name: newProductData.name,
        description: newProductData.description, min_amount: newProductData.minAmount,
        max_amount: newProductData.maxAmount, min_tenor_months: newProductData.minTenorMonths,
        max_tenor_months: newProductData.maxTenorMonths, base_apr: newProductData.baseApr,
        max_dti_ratio: newProductData.maxDtiRatio, required_documents: newProductData.requiredDocuments })
        .then(() => { if (version === sessionVersion.current) return refreshFromBackend(); })
        .catch((err: any) => { if (version === sessionVersion.current) addToast({ type: 'error', title: 'Product creation failed', message: err.message || 'Please retry.' }); });
      return;
    }
    const newProduct: LoanProduct = {
      ...newProductData,
      id: `prod-${Date.now().toString().slice(-4)}`,
    };
    setProducts((prev) => [...prev, newProduct]);
    addAuditLog({
      eventType: 'LOAN_PRODUCT_CREATED',
      notes: `Configured loan product '${newProduct.name}' (${newProduct.code}) with base APR ${newProduct.baseApr}%.`,
    });
    addToast({
      type: 'success',
      title: 'Loan Product Configured',
      message: `Product ${newProduct.name} successfully created.`,
    });

    if (isBackendConnected) {
      productsApi
        .create({
          code: newProductData.code,
          name: newProductData.name,
          description: newProductData.description,
          min_amount: newProductData.minAmount,
          max_amount: newProductData.maxAmount,
          min_tenor_months: newProductData.minTenorMonths,
          max_tenor_months: newProductData.maxTenorMonths,
          base_apr: newProductData.baseApr,
          max_dti_ratio: newProductData.maxDtiRatio,
          required_documents: newProductData.requiredDocuments,
        })
        .catch((err) => {
          console.warn('Backend product create sync failed (local state preserved):', err);
        });
    }
  };

  const updateLoanProduct = (id: string, updates: Partial<LoanProduct>) => {
    if (!demoRef.current) {
      addToast({ type: 'error', title: 'Action unavailable', message: 'This action is supported only in the Staff Workbench Demo. No records have been changed.' });
      return;
    }
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, ...updates };
        addAuditLog({
          eventType: 'LOAN_PRODUCT_UPDATED',
          notes: `Updated parameters for loan product '${updated.name}' (${updated.code}).`,
        });
        return updated;
      })
    );
    addToast({
      type: 'info',
      title: 'Loan Product Updated',
      message: 'Product policy parameters have been saved.',
    });
  };

  const addUser = (userData: Omit<User, 'id'>) => {
    if (!demoRef.current) {
      addToast({ type: 'error', title: 'Action unavailable', message: 'This action is supported only in the Staff Workbench Demo. No records have been changed.' });
      return;
    }
    const newUser: User = {
      ...userData,
      id: `usr-${Date.now().toString().slice(-4)}`,
    };
    setUsers((prev) => [...prev, newUser]);
    addAuditLog({
      eventType: 'USER_CREATED',
      notes: `Registered identity '${newUser.fullName}' (${newUser.email}) with role ${newUser.role}.`,
    });
    addToast({
      type: 'success',
      title: 'User Created',
      message: `Account for ${newUser.fullName} added successfully.`,
    });
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    if (!demoRef.current) {
      addToast({ type: 'error', title: 'Action unavailable', message: 'This action is supported only in the Staff Workbench Demo. No records have been changed.' });
      return;
    }
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        const updated = { ...u, ...updates };
        addAuditLog({
          eventType: 'USER_UPDATED',
          notes: `Updated profile for '${updated.fullName}' (Role: ${updated.role}, Active: ${updated.isActive}).`,
        });
        return updated;
      })
    );
    addToast({
      type: 'info',
      title: 'User Profile Updated',
      message: 'User permissions and status updated.',
    });
  };

  const registerApplicant = async (payload: {
    email: string; password: string; firstName: string; lastName: string; phone?: string; pan?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    clearPrivateData();
    demoRef.current = false;
    setIsDemoMode(false);
    setIsAuthenticated(false);
    setDataError(null);
    clearAuthTokens();
    const version = sessionVersion.current;
    try {
      const res: any = await authApi.register({ email: payload.email, password: payload.password,
        first_name: payload.firstName, last_name: payload.lastName, phone_number: payload.phone, pan_number: payload.pan });
      if (version !== sessionVersion.current) return { success: false, error: 'Session changed. Please sign in.' };
      localStorage.setItem(AUTH_TOKEN_KEY, res.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, res.refresh_token);
      const profile = await authApi.getMe();
      if (version !== sessionVersion.current) return { success: false, error: 'Session changed. Please sign in.' };
      setIsSyncing(true);
      applyProfile(profile);
      setPendingRedirectView(null);
      setActiveViewState('borrower-portal');
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message || 'Registration failed. Please retry.' }; }
  };

  const resetAllData = () => {
    localStorage.removeItem(STORAGE_KEYS.APPLICATIONS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ROLE);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.IS_AUTHENTICATED);
    localStorage.removeItem(STORAGE_KEYS.PENDING_REDIRECT);
    clearAuthTokens();
    setPendingRedirectViewState(null);
    setIsAuthenticated(false);
    clearPrivateData();
    demoRef.current = false;
    setIsDemoMode(false);
    setApplications([]);
    setAuditLogs([]);
    setProducts(INITIAL_PRODUCTS);
    setUsers([]);
    setCurrentRole('LOAN_OFFICER');
    setActiveApplicationId('app-001');
    setActiveViewState('landing');
    addToast({
      type: 'info',
      title: 'Data Reset',
      message: 'Platform state restored to default seeds.',
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        currentRole,
        switchRole,
        applications,
        products,
        users,
        auditLogs,
        activeApplicationId,
        setActiveApplicationId,
        activeView,
        setActiveView,
        pendingRedirectView,
        setPendingRedirectView,
        selectedDocId,
        setSelectedDocId,
        isAuthenticated,
        login,
        logout,
        isBackendConnected,
        backendHealth,
        isSyncing,
        refreshFromBackend,
        theme,
        toggleTheme,
        toasts,
        addToast,
        dismissToast,
        submitNewApplication,
        verifyDocument,
        transitionApplicationStatus,
        runRiskAssessment,
        recordUnderwritingDecision,
        addLoanProduct,
        updateLoanProduct,
        addUser,
        updateUser,
        registerApplicant,
        beginDemo,
        isDemoMode,
        dataError,
        resetAllData,
      }}
    >
      {isDemoMode && <div role="status" className="bg-orange-100 text-orange-950 px-4 py-2 text-center text-sm">Demo Mode — Simulated Data</div>}
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
