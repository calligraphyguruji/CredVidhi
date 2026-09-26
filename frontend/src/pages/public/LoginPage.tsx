import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { INITIAL_USERS } from '../../services/mockData';
import type { UserRole } from '../../types';

export const LoginPage: React.FC = () => {
  const { setActiveView, switchRole } = useApp();

  const [activeTab, setActiveTab] = useState<'staff' | 'borrower'>('staff');

  // Form states
  const [email, setEmail] = useState('d.vance@credvidhi.com');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [applicantRef, setApplicantRef] = useState('APP-2026-0891');
  const [applicantPhone, setApplicantPhone] = useState('+91 98765 43210');

  // Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);

  // Quick Demo Logins
  const handleQuickLogin = (role: UserRole) => {
    const user = INITIAL_USERS.find((u) => u.role === role) || INITIAL_USERS[0];
    setEmail(user.email);
    setPassword('demoSecure2026!');
    setErrorMessage(null);

    // Auto submit after a micro-delay for smooth UX
    triggerLogin(user.role, user.email);
  };

  const triggerLogin = (role: UserRole, userEmail: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    setTimeout(() => {
      setIsLoading(false);
      console.info(`[CredVidhi Gateway] Authenticated ${userEmail} as ${role}`);
      switchRole(role);

      // Route based on role
      if (role === 'LOAN_OFFICER') {
        setActiveView('officer-queue');
      } else if (role === 'RISK_ANALYST') {
        setActiveView('underwriting-cockpit');
      } else if (role === 'ADMIN') {
        setActiveView('compliance-audit');
      } else {
        setActiveView('borrower-portal');
      }
    }, 600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeTab === 'staff') {
      if (!email || !email.includes('@')) {
        setErrorMessage('Please enter a valid institutional bank email address.');
        return;
      }

      // Check known staff roles
      const matchedUser = INITIAL_USERS.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.role !== 'APPLICANT'
      );

      const targetRole: UserRole = matchedUser ? matchedUser.role : 'LOAN_OFFICER';
      triggerLogin(targetRole, email);
    } else {
      if (!applicantRef && !applicantPhone) {
        setErrorMessage('Please provide your application reference number or registered mobile.');
        return;
      }
      triggerLogin('APPLICANT', applicantRef || 'alex.taylor@gmail.com');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      {/* Top Header with Back Link */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-200 bg-white">
        <button
          onClick={() => setActiveView('landing')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-orange-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to CredVidhi Home</span>
        </button>

        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-orange-600" />
          <span className="font-extrabold text-sm tracking-tight text-slate-900 font-sans">
            CREDIVIDHI GATEWAY
          </span>
          <span className="text-[10px] font-mono bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200">
            PORT 443
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-emerald-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>SYSTEM OPERATIONAL</span>
        </div>
      </header>

      {/* Main Split-Screen Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-slate-200/90 shadow-elevated overflow-hidden bg-white">
          
          {/* LEFT PANEL: Security Telemetry & System Status (5 Cols) */}
          <div className="lg:col-span-5 bg-slate-950 text-slate-100 p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 relative overflow-hidden">
            {/* Background grid accent */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#33415510_1px,transparent_1px),linear-gradient(to_bottom,#33415510_1px,transparent_1px)] bg-[size:2rem_2rem] pointer-events-none" />

            <div className="relative z-10 space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 text-orange-400 border border-slate-800 text-[11px] font-mono mb-3">
                  <Lock className="w-3.5 h-3.5" />
                  <span>256-BIT TLS ENCRYPTED SESSION</span>
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Institutional Credit Operations
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Authenticate using authorized bank credentials or applicant verification tokens.
                </p>
              </div>

              {/* Real-time System Metrics */}
              <div className="space-y-3 pt-2">
                <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                  Today's Underwriting Telemetry
                </div>
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div className="p-3 bg-slate-900/90 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">APPLICATIONS REVIEWED</span>
                    <span className="text-xl font-bold text-white">1,248</span>
                  </div>
                  <div className="p-3 bg-slate-900/90 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">VOLUME SANCTIONED</span>
                    <span className="text-xl font-bold text-emerald-400">₹42.8 Cr</span>
                  </div>
                  <div className="p-3 bg-slate-900/90 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">AVG TURNAROUND (TAT)</span>
                    <span className="text-xl font-bold text-orange-400">4.2 Min</span>
                  </div>
                  <div className="p-3 bg-slate-900/90 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">DECISION INTEGRITY</span>
                    <span className="text-xl font-bold text-emerald-400">100% ACID</span>
                  </div>
                </div>
              </div>

              {/* Simulated Live Audit Stream */}
              <div className="space-y-2 pt-2">
                <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider flex items-center justify-between">
                  <span>Live Audit Stream</span>
                  <span className="text-emerald-400 text-[9px]">● STREAMING</span>
                </div>
                <div className="bg-black/60 rounded p-3 font-mono text-[10px] text-slate-400 space-y-1.5 border border-slate-800/80">
                  <div className="truncate">
                    <span className="text-orange-400">[03:14:02]</span> AUTH_SUCCESS: d.vance@credvidhi.com
                  </div>
                  <div className="truncate">
                    <span className="text-emerald-400">[03:12:45]</span> SANCTION_ISSUED: Ref APP-2026-0891 (₹45,000)
                  </div>
                  <div className="truncate">
                    <span className="text-amber-400">[03:10:19]</span> DOC_VERIFIED: W2_ApexIndustrial_2025.pdf
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Compliance Badge */}
            <div className="relative z-10 pt-6 mt-6 border-t border-slate-900 text-[10px] text-slate-400 font-mono flex items-center justify-between">
              <span>PRD v1.0 • RBAC SECURED</span>
              <span>ISO 27001 ALIGNED</span>
            </div>
          </div>

          {/* RIGHT PANEL: Authentication Form (7 Cols) */}
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between">
            <div>
              {/* Header Title */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900">
                  Sign In to CredVidhi
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Select your portal and enter your credentials to access your active queue.
                </p>
              </div>

              {/* Segmented Tab Switcher */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg border border-slate-200 mb-6 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('staff');
                    setEmail('d.vance@credvidhi.com');
                    setErrorMessage(null);
                  }}
                  className={`py-2 rounded-md font-semibold transition-all cursor-pointer ${
                    activeTab === 'staff'
                      ? 'bg-white text-orange-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Staff SSO Portal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('borrower');
                    setApplicantRef('APP-2026-0891');
                    setErrorMessage(null);
                  }}
                  className={`py-2 rounded-md font-semibold transition-all cursor-pointer ${
                    activeTab === 'borrower'
                      ? 'bg-white text-orange-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Borrower Portal
                </button>
              </div>

              {/* Error Message Display */}
              {errorMessage && (
                <div className="mb-4 p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* FORM */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {activeTab === 'staff' ? (
                  <>
                    <Input
                      label="Institutional Email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. d.vance@credvidhi.com"
                      autoComplete="username"
                      required
                    />

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                          Directory Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setForgotModalOpen(true)}
                          className="text-[11px] text-orange-700 hover:underline cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your security password"
                          autoComplete="current-password"
                          required
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white pr-10 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                          aria-label="Toggle password visibility"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                        />
                        <span>Remember workstation session</span>
                      </label>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full justify-center mt-2"
                      size="md"
                      isLoading={isLoading}
                      icon={<ArrowRight className="w-4 h-4" />}
                    >
                      Authenticate with Bank SSO
                    </Button>
                  </>
                ) : (
                  <>
                    <Input
                      label="Application Reference Number"
                      value={applicantRef}
                      onChange={(e) => setApplicantRef(e.target.value)}
                      placeholder="e.g. APP-2026-0891"
                      isMono
                      required
                    />

                    <Input
                      label="Registered Mobile Number"
                      value={applicantPhone}
                      onChange={(e) => setApplicantPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      isMono
                      required
                    />

                    <div className="p-3 bg-orange-50/70 border border-orange-200 rounded text-xs text-orange-950">
                      <div className="font-semibold mb-0.5">Quick Self-Service Access:</div>
                      <p className="text-[11px] text-orange-700 leading-normal">
                        No permanent password needed. Real-time application tracker is secured via reference matching.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full justify-center mt-2"
                      size="md"
                      isLoading={isLoading}
                      icon={<ArrowRight className="w-4 h-4" />}
                    >
                      Access Borrower Portal
                    </Button>
                  </>
                )}
              </form>

              {/* QUICK DEMO CREDENTIAL SELECTOR (Evaluator Convenience) */}
              <div className="mt-8 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                    1-Click Demo Personas (Evaluation Mode)
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    INSTANT LOGIN
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('LOAN_OFFICER')}
                    className="p-2.5 bg-slate-50 hover:bg-orange-50/60 border border-slate-200 hover:border-orange-300 rounded text-left transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-slate-800 group-hover:text-orange-700 flex items-center justify-between">
                      <span>David Vance</span>
                      <span className="text-[9px] font-mono bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded">
                        OFFICER
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Officer Queue & Docs
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin('RISK_ANALYST')}
                    className="p-2.5 bg-slate-50 hover:bg-orange-50/60 border border-slate-200 hover:border-orange-300 rounded text-left transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-slate-800 group-hover:text-orange-700 flex items-center justify-between">
                      <span>Katherine Reed</span>
                      <span className="text-[9px] font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded">
                        ANALYST
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Underwriting Cockpit
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin('ADMIN')}
                    className="p-2.5 bg-slate-50 hover:bg-orange-50/60 border border-slate-200 hover:border-orange-300 rounded text-left transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-slate-800 group-hover:text-orange-700 flex items-center justify-between">
                      <span>Sarah Sterling</span>
                      <span className="text-[9px] font-mono bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                        ADMIN
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Audit Logs & Matrix
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin('APPLICANT')}
                    className="p-2.5 bg-slate-50 hover:bg-orange-50/60 border border-slate-200 hover:border-orange-300 rounded text-left transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-slate-800 group-hover:text-orange-700 flex items-center justify-between">
                      <span>Alex Taylor</span>
                      <span className="text-[9px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                        APPLICANT
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Loan Tracker Portal
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Footnote */}
            <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-600 font-mono flex items-center justify-between">
              <span>Security Clearance: Level 3</span>
              <span>All authentication events are logged</span>
            </div>
          </div>

        </div>
      </div>

      {/* Simplified Footer */}
      <footer className="px-6 py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        © 2026 CredVidhi Architecture. Deterministic Underwriting & Loan Management Platform.
      </footer>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6 max-w-sm w-full space-y-4 shadow-elevated">
            <h4 className="text-sm font-bold text-slate-900">
              Institutional Password Recovery
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Staff passwords are managed via your institution's LDAP / Active Directory service.
              Please reach out to the IT Security Administrator or click below to use the 1-click evaluation personas.
            </p>
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={() => setForgotModalOpen(false)}
            >
              Understood
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
