import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
import { Modal } from '../../components/ui/Modal';
import { ForgotRegistrationModal } from '../../components/auth/ForgotRegistrationModal';
import { INITIAL_USERS } from '../../services/mockData';
import type { UserRole } from '../../types';
import { scaleInVariants, formErrorVariants } from '../../utils/motion';

import { canRoleAccessView, getDefaultViewForRole } from '../../utils/rbac';

interface LoginPageProps {
  initialTab?: 'staff' | 'borrower' | 'register';
}

export const LoginPage: React.FC<LoginPageProps> = ({ initialTab = 'staff' }) => {
  const {
    setActiveView,
    registerApplicant,
    login,
    pendingRedirectView,
    applications,
    setActiveApplicationId,
  } = useApp();
  const shouldReduceMotion = useReducedMotion();

  const [activeTab, setActiveTab] = useState<'staff' | 'borrower' | 'register'>(initialTab);

  // Form states - completely empty by default for all new users (no demo/dummy prefill)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [applicantRef, setApplicantRef] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [forgotRegistrationOpen, setForgotRegistrationOpen] = useState(false);

  // Registration form states
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPan, setRegPan] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regConsent, setRegConsent] = useState(false);

  // Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);

  const triggerLogin = (role: UserRole, userEmail: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    setTimeout(() => {
      setIsLoading(false);
      console.info(`[CredVidhi Gateway] Authenticated ${userEmail} as ${role}`);

      let targetView = getDefaultViewForRole(role);
      if (pendingRedirectView && canRoleAccessView(role, pendingRedirectView)) {
        targetView = pendingRedirectView;
      }

      login(role, userEmail, targetView);
    }, 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (activeTab === 'register') {
      if (!regFirstName.trim() || !regLastName.trim()) {
        setErrorMessage('Please provide your full legal first and last name.');
        return;
      }
      if (!regEmail || !regEmail.includes('@')) {
        setErrorMessage('Please provide a valid email address.');
        return;
      }
      if (regPassword.length < 8) {
        setErrorMessage('Password must be at least 8 characters long.');
        return;
      }
      if (regPassword !== regConfirmPassword) {
        setErrorMessage('Passwords do not match. Please re-enter.');
        return;
      }
      if (regPan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(regPan.trim())) {
        setErrorMessage('Invalid PAN format. PAN must be 10 characters (e.g. ABCDE1234F).');
        return;
      }
      if (!regConsent) {
        setErrorMessage('You must consent to identity verification and credit assessment.');
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      const res = await registerApplicant({
        email: regEmail.trim(),
        password: regPassword,
        firstName: regFirstName.trim(),
        lastName: regLastName.trim(),
        phone: regPhone.trim() || undefined,
        pan: regPan.trim().toUpperCase() || undefined,
      });
      setIsLoading(false);
      if (!res.success) {
        setErrorMessage(res.error || 'Registration failed.');
      }
      return;
    }

    if (activeTab === 'staff') {
      if (!email || !email.includes('@')) {
        setErrorMessage('Please enter a valid institutional bank email address.');
        return;
      }

      // Check known staff roles
      const matchedUser = INITIAL_USERS.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.role !== 'APPLICANT'
      );

      if (matchedUser && matchedUser.password && password !== matchedUser.password) {
        setErrorMessage('Invalid password. Please check your credentials and try again.');
        return;
      }

      const targetRole: UserRole = matchedUser ? matchedUser.role : 'LOAN_OFFICER';
      triggerLogin(targetRole, email);
    } else {
      const cleanRef = applicantRef.trim();
      const cleanPhone = applicantPhone.trim();

      if (!cleanRef || !cleanPhone) {
        setErrorMessage('Please enter both your Application Reference Number and Registered Mobile Number.');
        return;
      }

      // Check credentials against active borrower applications
      const cleanInputDigits = cleanPhone.replace(/\D/g, '').slice(-10);
      const matchedApp = applications.find((a) => {
        const refMatch = a.referenceNumber.trim().toUpperCase() === cleanRef.toUpperCase();
        const appPhoneDigits = (a.personal.phone || '').replace(/\D/g, '').slice(-10);
        const phoneMatch = appPhoneDigits.length >= 8 && appPhoneDigits === cleanInputDigits;
        return refMatch && phoneMatch;
      });

      if (!matchedApp) {
        setErrorMessage(
          'Invalid Application Reference Number or Mobile Number. Please check your information or use Forgot Registration Number.'
        );
        return;
      }

      setActiveApplicationId(matchedApp.id);
      triggerLogin('APPLICANT', matchedApp.personal.email || matchedApp.referenceNumber);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      {/* Top Header with Back Link */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-200 bg-white">
        <motion.button
          whileHover={!shouldReduceMotion ? { x: -2 } : undefined}
          whileTap={!shouldReduceMotion ? { scale: 0.98 } : undefined}
          onClick={() => setActiveView('landing')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-orange-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to CredVidhi Home</span>
        </motion.button>

        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-orange-600" />
          <span className="font-extrabold text-sm tracking-tight text-slate-900 font-sans">
            CREDVIDHI GATEWAY
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-emerald-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>SYSTEM OPERATIONAL</span>
        </div>
      </header>

      {/* Main Split-Screen Container with smooth entrance */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <motion.div
          variants={shouldReduceMotion ? undefined : scaleInVariants}
          initial="initial"
          animate="animate"
          className="w-full grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-slate-200/90 shadow-elevated overflow-hidden bg-white"
        >
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
                    <span className="text-emerald-400">[03:12:45]</span> SANCTION_ISSUED: Ref APP-2026-**** (₹45,000)
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
                <h1 className="text-xl font-bold text-slate-900">
                  {activeTab === 'register' ? 'Register as New Borrower | CredVidhi' : 'Sign In to CredVidhi'}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  {activeTab === 'register'
                    ? 'Create your applicant account to select loan products, upload proof, and track live status.'
                    : 'Select your portal and enter your credentials to access your active queue.'}
                </p>
              </div>

              {/* Segmented Tab Switcher with gliding pill */}
              <div role="tablist" aria-label="Authentication Options" className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-slate-950/70 rounded-lg border border-slate-200 dark:border-slate-800/80 mb-6 font-mono text-xs relative">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'staff'}
                  onClick={() => {
                    setActiveTab('staff');
                    setErrorMessage(null);
                  }}
                  className={`relative py-2 rounded-md font-semibold transition-colors cursor-pointer z-10 text-center ${
                    activeTab === 'staff'
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {activeTab === 'staff' && (
                    <motion.div
                      layoutId={shouldReduceMotion ? undefined : 'auth-tab-pill'}
                      className="absolute inset-0 bg-white dark:bg-slate-800/90 rounded-md shadow-xs dark:shadow-none border border-transparent dark:border-slate-700/60 -z-10"
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                  <span>Staff SSO</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'borrower'}
                  onClick={() => {
                    setActiveTab('borrower');
                    setErrorMessage(null);
                  }}
                  className={`relative py-2 rounded-md font-semibold transition-colors cursor-pointer z-10 text-center ${
                    activeTab === 'borrower'
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {activeTab === 'borrower' && (
                    <motion.div
                      layoutId={shouldReduceMotion ? undefined : 'auth-tab-pill'}
                      className="absolute inset-0 bg-white dark:bg-slate-800/90 rounded-md shadow-xs dark:shadow-none border border-transparent dark:border-slate-700/60 -z-10"
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'register'}
                  onClick={() => {
                    setActiveTab('register');
                    setErrorMessage(null);
                  }}
                  className={`relative py-2 rounded-md font-semibold transition-colors cursor-pointer z-10 text-center ${
                    activeTab === 'register'
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {activeTab === 'register' && (
                    <motion.div
                      layoutId={shouldReduceMotion ? undefined : 'auth-tab-pill'}
                      className="absolute inset-0 bg-white dark:bg-slate-800/90 rounded-md shadow-xs dark:shadow-none border border-transparent dark:border-slate-700/60 -z-10"
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                  <span className="flex items-center justify-center gap-1">
                    <span>Register</span>
                    <span className="text-[9px] bg-orange-600 text-white px-1 py-0.5 rounded font-sans">NEW</span>
                  </span>
                </button>
              </div>

              {/* Error Message Display with fluid animation */}
              <AnimatePresence>
                {errorMessage && (
                  <motion.div
                    variants={shouldReduceMotion ? undefined : formErrorVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="mb-4 p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 overflow-hidden"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>

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
                          className="w-full text-xs p-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 pr-10 font-mono transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
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
                          className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 accent-orange-600"
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
                ) : activeTab === 'borrower' ? (
                  <>
                    <Input
                      label="Application Reference Number"
                      value={applicantRef}
                      onChange={(e) => {
                        setApplicantRef(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Enter application reference number"
                      isMono
                      required
                    />

                    <Input
                      label="Registered Mobile Number"
                      value={applicantPhone}
                      onChange={(e) => {
                        setApplicantPhone(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Enter registered mobile number"
                      isMono
                      required
                    />

                    <div className="p-3 bg-orange-50/70 border border-orange-200 rounded text-xs text-orange-950">
                      <div className="font-semibold mb-0.5">Quick Self-Service Access:</div>
                      <p className="text-[11px] text-orange-700 leading-normal">
                        No permanent password needed. Real-time application tracker is secured via reference and mobile matching.
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

                    <div className="flex items-center justify-between pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMessage(null);
                          setForgotRegistrationOpen(true);
                        }}
                        className="text-xs font-semibold text-orange-600 hover:text-orange-700 underline cursor-pointer"
                      >
                        Forgot Registration Number?
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('register');
                          setErrorMessage(null);
                        }}
                        className="text-xs text-slate-500 hover:text-orange-600 cursor-pointer"
                      >
                        New borrower? <span className="font-semibold underline">Register</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Legal First Name"
                        value={regFirstName}
                        onChange={(e) => {
                          setRegFirstName(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="e.g. Aarav"
                        required
                      />
                      <Input
                        label="Legal Last Name"
                        value={regLastName}
                        onChange={(e) => {
                          setRegLastName(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="e.g. Sharma"
                        required
                      />
                    </div>

                    <Input
                      label="Email Address"
                      type="email"
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="e.g. aarav.sharma@gmail.com"
                      autoComplete="email"
                      required
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Mobile (+91)"
                        value={regPhone}
                        onChange={(e) => {
                          setRegPhone(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="Enter mobile number"
                        autoComplete="tel"
                        isMono
                      />
                      <Input
                        label="PAN Number"
                        value={regPan}
                        onChange={(e) => {
                          setRegPan(e.target.value.toUpperCase());
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="ABCDE1234F"
                        maxLength={10}
                        isMono
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          Password (Min 8 chars)
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={regPassword}
                            onChange={(e) => {
                              setRegPassword(e.target.value);
                              if (errorMessage) setErrorMessage(null);
                            }}
                            placeholder="Create password"
                            autoComplete="new-password"
                            required
                            className="w-full text-xs p-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 pr-10 font-mono transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                            aria-label="Toggle password visibility"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          Confirm Password
                        </label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={regConfirmPassword}
                          onChange={(e) => {
                            setRegConfirmPassword(e.target.value);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          placeholder="Re-enter password"
                          autoComplete="new-password"
                          required
                          className="w-full text-xs p-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 font-mono transition-colors"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-orange-50/70 border border-orange-200 rounded text-xs text-orange-950">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={regConsent}
                          onChange={(e) => setRegConsent(e.target.checked)}
                          className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 accent-orange-600 mt-0.5 shrink-0"
                          required
                        />
                        <span className="text-[11px] text-orange-900 leading-normal">
                          I declare that the information provided is accurate and consent to identity verification and deterministic credit assessment under RBI regulations.
                        </span>
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
                      Complete Registration & Open Application
                    </Button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('borrower')}
                        className="text-xs text-slate-500 hover:text-orange-600 cursor-pointer"
                      >
                        Already registered? <span className="font-semibold underline">Sign In to Borrower Portal</span>
                      </button>
                    </div>
                  </>
                )}
              </form>

            </div>

            {/* Bottom Footnote */}
            <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-600 font-mono flex items-center justify-between">
              <span>Security Clearance: Level 3</span>
              <span>All authentication events are logged</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Simplified Footer */}
      <footer className="px-6 py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        © 2026 CredVidhi Architecture. Deterministic Underwriting & Loan Management Platform.
      </footer>

      {/* Forgot Password Modal with Framer Motion AnimatePresence */}
      <Modal
        isOpen={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
        title="Institutional Password Recovery"
        maxWidth="sm"
        footer={
          <Button
            variant="primary"
            className="w-full justify-center"
            onClick={() => setForgotModalOpen(false)}
          >
            Understood
          </Button>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          Staff passwords are managed via your institution's LDAP / Active Directory service.
          Please contact your IT Security Administrator for password resets.
        </p>
      </Modal>

      {/* Borrower Application Reference Recovery Modal */}
      <ForgotRegistrationModal
        isOpen={forgotRegistrationOpen}
        onClose={() => setForgotRegistrationOpen(false)}
        onReturnToSignIn={() => {
          setActiveTab('borrower');
          setErrorMessage(null);
        }}
      />
    </div>
  );
};
