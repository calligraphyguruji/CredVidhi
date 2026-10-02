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
  healthApi,
  authApi,
  AUTH_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  productsApi,
  applicationsApi,
  queuesApi,
  documentsApi,
  underwritingApi,
  auditApi,
  mapBackendProduct,
  mapBackendApplication,
  mapBackendAuditLog,
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
  login: (role: UserRole, userEmail?: string, redirectView?: string) => void;
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
  provisionInitialApplication: (user: User, phone: string, dob?: string) => LoanApplication;
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

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem(AUTH_TOKEN_KEY);
    const hasAuth = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.IS_AUTHENTICATED) === 'true';
    return hasToken || hasAuth;
  });

  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_ROLE);
    return (saved as UserRole) || 'LOAN_OFFICER';
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse cached users', e);
      }
    }
    return INITIAL_USERS;
  });

  const [products, setProducts] = useState<LoanProduct[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse cached products', e);
      }
    }
    return INITIAL_PRODUCTS;
  });

  const currentUser = users.find((u) => u.role === currentRole) || users[0];

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

  const [activeApplicationId, setActiveApplicationId] = useState<string>('app-001');
  const [selectedDocId, setSelectedDocId] = useState<string | null>('doc-002');
  const [activeView, setActiveViewState] = useState<string>(() => {
    const initialView = resolveViewFromUrl();
    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem(AUTH_TOKEN_KEY);
    const hasAuth = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.IS_AUTHENTICATED) === 'true';
    const isAuth = hasToken || hasAuth;
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
    const isAuthed =
      isAuthenticated ||
      (typeof window !== 'undefined' &&
        (!!localStorage.getItem(AUTH_TOKEN_KEY) ||
          localStorage.getItem(STORAGE_KEYS.IS_AUTHENTICATED) === 'true'));

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

  const login = (role: UserRole, userEmail?: string, redirectView?: string) => {
    setIsAuthenticated(true);
    localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, 'true');
    setCurrentRole(role);
    if (userEmail) {
      const matched = users.find((u) => u.email.toLowerCase() === userEmail.toLowerCase());
      if (matched) {
        // user recognized
      }
    }

    const target = redirectView || pendingRedirectView;
    setPendingRedirectView(null);

    if (target && !isPublicRoute(target)) {
      if (canRoleAccessView(role, target)) {
        setActiveViewState(target);
        return;
      }
      // Role not permitted to target view: route to role default and toast warning
      const fallbackView = getDefaultViewForRole(role);
      setActiveViewState(fallbackView);
      addToast({
        type: 'error',
        title: 'Access Restricted (RBAC)',
        message: `Your account (${role}) does not have permission for the requested view. Navigated to your primary workspace.`,
      });
      return;
    }

    if (redirectView) {
      setActiveViewState(redirectView);
    } else {
      setActiveViewState(getDefaultViewForRole(role));
    }
  };

  const logout = async (redirectView = 'landing') => {
    try {
      if (isBackendConnected) {
        await authApi.logout();
      }
    } catch (err) {
      console.warn('Backend logout failed:', err);
    } finally {
      setIsAuthenticated(false);
      localStorage.removeItem(STORAGE_KEYS.IS_AUTHENTICATED);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(STORAGE_KEYS.PENDING_REDIRECT);
      setPendingRedirectViewState(null);
      const safeRedirect = isPublicRoute(redirectView) ? redirectView : 'landing';
      setActiveViewState(safeRedirect);
    }
  };

  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [backendHealth, setBackendHealth] = useState<{ database: boolean; redis: boolean } | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshFromBackend = async () => {
    try {
      setIsSyncing(true);
      const ready = await healthApi.checkReady();
      setIsBackendConnected(ready.status === 'READY');
      setBackendHealth({ database: true, redis: false });

      // Optionally inspect detailed dependencies without failing on degraded Redis
      healthApi.checkDetailed().then((detailed) => {
        const isDbUp = detailed?.dependencies?.database === 'UP';
        const isRedisUp = detailed?.dependencies?.redis === 'UP';
        setBackendHealth({ database: isDbUp, redis: isRedisUp });
      }).catch(() => {
        // Redis degraded or offline, database operational
      });

      // Synchronize catalog products from live backend
      try {
        const liveProducts = await productsApi.list();
        if (Array.isArray(liveProducts) && liveProducts.length > 0) {
          setProducts(liveProducts.map(mapBackendProduct));
        }
      } catch (err) {
        console.warn('Backend products fetch failed, using local products catalog', err);
      }

      // Synchronize queue applications from live backend (non-destructively merge)
      try {
        const liveApps = await queuesApi.getOfficerQueue();
        if (Array.isArray(liveApps) && liveApps.length > 0) {
          setApplications((prev) => {
            const liveMap = new Map(liveApps.map((a: any) => [String(a.id), a]));
            const updated = prev.map((app) => {
              const live = liveMap.get(app.id);
              if (!live) return app;
              liveMap.delete(app.id);
              return { ...app, status: live.status, requestedAmount: Number(live.requested_amount) };
            });
            for (const [, newApp] of liveMap) {
              updated.push(mapBackendApplication(newApp));
            }
            return updated;
          });
        }
      } catch (err) {
        console.warn('Backend officer queue fetch failed, using local applications', err);
      }

      // Synchronize immutable audit logs from live backend
      try {
        const liveLogs = await auditApi.getLogs({ limit: 50 });
        if (liveLogs && Array.isArray(liveLogs.items) && liveLogs.items.length > 0) {
          setAuditLogs(liveLogs.items.map(mapBackendAuditLog));
        }
      } catch (err) {
        console.warn('Backend audit logs fetch failed, using local audit ledger', err);
      }
    } catch {
      // Backend is offline or unreachable - gracefully operate in autonomous local mode
      setIsBackendConnected(false);
      setBackendHealth(null);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshFromBackend();
    }, 0);
    return () => clearTimeout(timer);
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
      const isAuthed =
        isAuthenticated ||
        (typeof window !== 'undefined' &&
          (!!localStorage.getItem(AUTH_TOKEN_KEY) ||
            localStorage.getItem(STORAGE_KEYS.IS_AUTHENTICATED) === 'true'));
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

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
    const isAuthed =
      isAuthenticated ||
      (typeof window !== 'undefined' &&
        (!!localStorage.getItem(AUTH_TOKEN_KEY) ||
          localStorage.getItem(STORAGE_KEYS.IS_AUTHENTICATED) === 'true'));
    if (!isAuthed) {
      setActiveViewState('register');
      return;
    }
    setCurrentRole(role);
    if (targetView) {
      if (canRoleAccessView(role, targetView)) {
        setActiveViewState(targetView);
      } else {
        setActiveViewState(getDefaultViewForRole(role));
        addToast({
          type: 'error',
          title: 'Access Restricted (RBAC)',
          message: `Role ${role} is not permitted to access ${targetView}. Navigated to default view.`,
        });
      }
      return;
    }
    setActiveViewState(getDefaultViewForRole(role));
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

    addToast({
      type: 'success',
      title: 'Application Submitted',
      message: `Docket ${refNumber} created for ₹${data.requestedAmount.toLocaleString('en-IN')}.`,
    });

    if (isBackendConnected) {
      const backendProdId = isUUID(selectedProd.id)
        ? selectedProd.id
        : products.find((p) => isUUID(p.id))?.id;

      if (backendProdId) {
        applicationsApi
          .createDraft({
            product_id: backendProdId,
            requested_amount: data.requestedAmount,
            requested_tenor_months: data.requestedTenorMonths,
            purpose: data.purpose,
          })
          .then((draft) => {
            return applicationsApi
              .updateDraft(draft.id, {
                applicant_personal_snapshot: data.personal,
                applicant_financial_snapshot: data.financial,
              })
              .then(() => applicationsApi.submit(draft.id))
              .then((submitted) => {
                const liveId = String(submitted.id || draft.id);
                const liveRef = submitted.reference_number || refNumber;
                setApplications((prev) =>
                  prev.map((a) =>
                    a.id === newId
                      ? {
                          ...a,
                          id: liveId,
                          referenceNumber: liveRef,
                        }
                      : a
                  )
                );
                setActiveApplicationId(liveId);
              });
          })
          .catch((err) => {
            console.warn('Backend application submit sync failed (local state preserved):', err);
          });
      }
    }

    return newId;
  };

  const addLoanProduct = (newProductData: Omit<LoanProduct, 'id'>) => {
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

  const provisionInitialApplication = (
    user: User,
    phone: string,
    dob?: string
  ): LoanApplication => {
    const existing = applications.find(
      (a) => a.applicantId === user.id || a.personal.email.toLowerCase() === user.email.toLowerCase()
    );
    if (existing) return existing;

    const selectedProd = products[0] || INITIAL_PRODUCTS[0];
    const newRef = `APP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newApp: LoanApplication = {
      id: `app-reg-${Date.now().toString().slice(-6)}`,
      referenceNumber: newRef,
      applicantId: user.id,
      productId: selectedProd.id,
      product: selectedProd,
      assignedOfficerId: 'usr-officer-1',
      assignedOfficerName: 'David Vance',
      status: 'SUBMITTED',
      requestedAmount: 250000,
      requestedTenorMonths: 24,
      purpose: 'Personal Loan Self-Registration',
      personal: {
        fullName: user.fullName,
        email: user.email,
        phone: phone || user.phone || '',
        dateOfBirth: dob || '',
        residentialAddress: 'Primary Residential Address',
        taxIdMasked: '******1234F',
      },
      financial: {
        employmentType: 'SALARIED',
        employerName: 'Declared Employer',
        jobTitle: 'Professional',
        yearsEmployed: 3.0,
        grossMonthlyIncome: 85000,
        existingMonthlyDebt: 10000,
        housingExpense: 18000,
        creditScoreDeclared: 750,
      },
      documents: [],
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setApplications((prev) => {
      const nextApps = [newApp, ...prev.filter((a) => a.applicantId !== user.id && a.personal.email.toLowerCase() !== user.email.toLowerCase())];
      localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(nextApps));
      return nextApps;
    });
    return newApp;
  };

  const registerApplicant = async (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    pan?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      let backendUserId: string | undefined;
      if (isBackendConnected) {
        const res = await authApi.register({
          email: payload.email,
          password: payload.password,
          first_name: payload.firstName,
          last_name: payload.lastName,
          phone_number: payload.phone,
          pan_number: payload.pan,
        });
        if (res && (res as any).access_token) {
          localStorage.setItem(AUTH_TOKEN_KEY, (res as any).access_token);
          if ((res as any).refresh_token) {
            localStorage.setItem(REFRESH_TOKEN_KEY, (res as any).refresh_token);
          }
        }
        if (res && (res as any).id) {
          backendUserId = String((res as any).id);
        }
      }

      const fullName = `${payload.firstName} ${payload.lastName}`.trim();
      const existingUser = users.find((u) => u.email.toLowerCase() === payload.email.toLowerCase());
      if (existingUser && !isBackendConnected) {
        return { success: false, error: 'An account with this email address already exists.' };
      }

      const newUser: User = {
        id: backendUserId || `usr-${Date.now().toString().slice(-4)}`,
        email: payload.email,
        fullName,
        role: 'APPLICANT',
        phone: payload.phone,
        isActive: true,
      };

      // Prepend so newUser becomes the active user for APPLICANT role
      setUsers((prev) => {
        const nextUsers = [newUser, ...prev.filter((u) => u.email.toLowerCase() !== newUser.email.toLowerCase())];
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(nextUsers));
        return nextUsers;
      });

      // Automatically provision initial loan application with reference number for this borrower
      const initialApp = provisionInitialApplication(
        newUser,
        payload.phone || '',
        (payload as any).dateOfBirth || ''
      );
      setActiveApplicationId(initialApp.id);

      setCurrentRole('APPLICANT');
      setIsAuthenticated(true);
      localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, 'true');
      addAuditLog({
        eventType: 'USER_REGISTERED',
        notes: `Borrower self-registration: '${fullName}' (${payload.email}) registered with Docket ${initialApp.referenceNumber}.`,
      });
      // Determine target redirect after registration
      const target = pendingRedirectView;
      setPendingRedirectView(null);

      if (target && !isPublicRoute(target)) {
        if (canRoleAccessView('APPLICANT', target)) {
          setActiveViewState(target);
        } else {
          setActiveViewState('borrower-portal');
          addToast({
            type: 'error',
            title: 'Access Restricted (RBAC)',
            message: 'Your applicant account is not authorized for that staff workspace. Navigated to borrower portal.',
          });
        }
      } else {
        setActiveViewState('borrower-portal');
      }

      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Registration failed. Please check your details.';
      return { success: false, error: msg };
    }
  };

  const resetAllData = () => {
    localStorage.removeItem(STORAGE_KEYS.APPLICATIONS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ROLE);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.IS_AUTHENTICATED);
    localStorage.removeItem(STORAGE_KEYS.PENDING_REDIRECT);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setPendingRedirectViewState(null);
    setIsAuthenticated(false);
    setApplications(INITIAL_APPLICATIONS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setProducts(INITIAL_PRODUCTS);
    setUsers(INITIAL_USERS);
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
        provisionInitialApplication,
        resetAllData,
      }}
    >
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
