import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RotateCw,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { authApi, ApiError } from '../../services/api';
import { useApp } from '../../context/AppContext';
import {
  parseDateParts,
  isDobMatching,
  normalizePhoneDigits,
  isPhoneMatching,
  isNameMatching,
  isEmailMatching,
} from '../../utils/identityVerification';

interface ForgotRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReturnToSignIn: () => void;
}

type RecoveryStep = 'IDENTIFY' | 'OTP' | 'SUCCESS';

export const ForgotRegistrationModal: React.FC<ForgotRegistrationModalProps> = ({
  isOpen,
  onClose,
  onReturnToSignIn,
}) => {
  const { isBackendConnected, applications, users, provisionInitialApplication } = useApp();

  const [step, setStep] = useState<RecoveryStep>('IDENTIFY');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');

  // OTP Verification state
  const [otp, setOtp] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [maskedContact, setMaskedContact] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);

  // Success state
  const [recoveredRefNumber, setRecoveredRefNumber] = useState('');
  const [copied, setCopied] = useState(false);

  // Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(30);

  const resetState = () => {
    setStep('IDENTIFY');
    setFullName('');
    setMobile('');
    setDateOfBirth('');
    setEmail('');
    setOtp('');
    setVerificationToken('');
    setMaskedContact('');
    setDemoCode(null);
    setRecoveredRefNumber('');
    setErrorMessage(null);
    setIsLoading(false);
    setCopied(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleReturnToSignIn = () => {
    resetState();
    onClose();
    onReturnToSignIn();
  };

  // Resend OTP countdown timer
  useEffect(() => {
    let timer: any;
    if (step === 'OTP' && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  const handleCopy = () => {
    if (!recoveredRefNumber) return;
    navigator.clipboard.writeText(recoveredRefNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setErrorMessage(null);

    const cleanName = fullName.trim();
    const cleanMobile = mobile.trim();
    const cleanDob = dateOfBirth.trim();

    if (!cleanName) {
      setErrorMessage('Please enter your full legal name.');
      return;
    }
    if (!cleanMobile || cleanMobile.replace(/\D/g, '').length < 8) {
      setErrorMessage('Please enter a valid registered mobile number.');
      return;
    }
    if (!cleanDob) {
      setErrorMessage('Please provide your date of birth for identity verification.');
      return;
    }

    const inputDobParts = parseDateParts(cleanDob);
    if (!inputDobParts) {
      setErrorMessage('Please provide a valid date of birth (e.g. DD/MM/YYYY or YYYY-MM-DD).');
      return;
    }

    setIsLoading(true);

    try {
      if (isBackendConnected) {
        try {
          // Live backend verification
          const res = await authApi.forgotRegistration({
            fullName: cleanName,
            mobile: cleanMobile,
            dateOfBirth: cleanDob,
            email: email.trim() || undefined,
          });

          setVerificationToken(res.verification_token);
          setMaskedContact(res.masked_destination);
          setDemoCode(res.demo_code || null);
          setResendCooldown(30);
          setStep('OTP');
          return;
        } catch (apiErr) {
          // If backend returned client validation failure or rate limit, rethrow so user sees exact message
          if (
            apiErr instanceof ApiError &&
            (apiErr.statusCode === 400 || apiErr.statusCode === 422 || apiErr.statusCode === 429)
          ) {
            throw apiErr;
          }
          // Network or server connection issue: fall through to client-side verification
          console.warn('Backend recovery endpoint unavailable, using deterministic verification:', apiErr);
        }
      }

      // Client-side deterministic verification
      // 1. Search active applications
      let matchedApp = applications.find((app) => {
        const phoneOk = isPhoneMatching(cleanMobile, app.personal.phone);
        const nameOk = isNameMatching(cleanName, app.personal.fullName);
        const dobOk = isDobMatching(cleanDob, app.personal.dateOfBirth);
        const emailOk = isEmailMatching(email, app.personal.email);
        return phoneOk && nameOk && dobOk && emailOk;
      });

      // 2. If not found in applications, also search registered users
      if (!matchedApp) {
        const matchedUser = users.find((u) => {
          const phoneOk = isPhoneMatching(cleanMobile, u.phone);
          const nameOk = isNameMatching(cleanName, u.fullName);
          const emailOk = isEmailMatching(email, u.email);
          return phoneOk && nameOk && emailOk;
        });

        if (matchedUser) {
          // Retrieve or auto-provision application docket for this registered borrower
          matchedApp = provisionInitialApplication(matchedUser, cleanMobile, cleanDob);
        }
      }

      if (!matchedApp) {
        throw new Error('We could not verify your details. Please check your information and try again.');
      }

      const cleanPhoneDigits = normalizePhoneDigits(cleanMobile);
      const maskedPhone =
        cleanPhoneDigits.length >= 4
          ? `+91 ******${cleanPhoneDigits.slice(-4)}`
          : '+91 ******3210';
      const simulatedToken = `demo_token_${Date.now()}`;
      const simulatedOtp = '849201';

      setVerificationToken(simulatedToken);
      setMaskedContact(maskedPhone);
      setDemoCode(simulatedOtp);
      setRecoveredRefNumber(matchedApp.referenceNumber);
      setResendCooldown(30);
      setStep('OTP');
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err?.message || 'We could not verify your details. Please check your information and try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      setErrorMessage('Please enter the complete verification code.');
      return;
    }

    setIsLoading(true);

    try {
      if (isBackendConnected && !verificationToken.startsWith('demo_token_')) {
        const res = await authApi.verifyRegistrationOtp({
          verificationToken,
          otp: cleanOtp,
        });
        setRecoveredRefNumber(res.reference_number);
        setMaskedContact(res.masked_contact);
        setStep('SUCCESS');
      } else {
        // Offline demo validation
        if (cleanOtp !== '849201' && (!demoCode || cleanOtp !== demoCode)) {
          throw new Error('Invalid verification code. Please check the code and try again.');
        }
        setStep('SUCCESS');
      }
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err?.message || 'Invalid verification code. Please check the code and try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setErrorMessage(null);
    setIsLoading(true);
    try {
      if (isBackendConnected) {
        const res = await authApi.forgotRegistration({
          fullName: fullName.trim(),
          mobile: mobile.trim(),
          dateOfBirth: dateOfBirth.trim(),
          email: email.trim() || undefined,
        });
        setVerificationToken(res.verification_token);
        setDemoCode(res.demo_code || null);
      }
      setResendCooldown(30);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-orange-600" />
          <span className="font-extrabold text-slate-900 tracking-tight text-sm font-sans">
            Recover Registration Number
          </span>
        </div>
      }
      maxWidth="md"
    >
      <div className="font-sans space-y-4">
        {/* Error Banner */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="p-3 bg-red-50/90 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div className="leading-snug">{errorMessage}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* STEP 1: IDENTITY VERIFICATION FORM */}
        {step === 'IDENTIFY' && (
          <form onSubmit={handleIdentitySubmit} className="space-y-3.5">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-900 block mb-0.5">
                Institutional Identity Verification
              </span>
              Under RBI digital lending guidelines, your registration number is protected.
              Please provide your matching verification details to recover it.
            </div>

            <Input
              label="Full Legal Name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="e.g. Aarav Sharma"
              required
              autoComplete="name"
            />

            <Input
              label="Registered Mobile Number"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="e.g. +91 98112 34501"
              isMono
              required
              autoComplete="tel"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="w-full">
                <label
                  htmlFor="recovery-dob"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 transition-colors"
                >
                  Date of Birth <span className="text-orange-600">*</span>
                </label>
                <div className="relative flex items-center rounded-md shadow-xs">
                  <input
                    id="recovery-dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => {
                      setDateOfBirth(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    required
                    aria-label="Date of Birth"
                    className="block w-full text-sm text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 focus:ring-orange-500 focus:border-orange-500 rounded-md px-3 py-2 bg-white dark:bg-slate-900 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 font-mono transition-all duration-150 [color-scheme:light] dark:[color-scheme:dark] dark:[&::-webkit-calendar-picker-indicator]:invert dark:[&::-webkit-calendar-picker-indicator]:brightness-125 dark:[&::-webkit-calendar-picker-indicator]:opacity-100 cursor-pointer"
                  />
                </div>
              </div>

              <Input
                label="Email Address (Optional)"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="e.g. aarav.sharma@gmail.com"
                autoComplete="email"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center"
                size="md"
                isLoading={isLoading}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Verify Identity
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: OTP VERIFICATION */}
        {step === 'OTP' && (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="p-3 bg-orange-50/70 border border-orange-200 rounded text-xs text-orange-950">
              <div className="font-semibold mb-1 flex items-center gap-1.5 text-orange-900">
                <ShieldCheck className="w-4 h-4 text-orange-600" />
                Security Verification Code Dispatched
              </div>
              <p className="text-[11px] text-orange-800 leading-normal">
                A 6-digit one-time verification code has been dispatched to{' '}
                <span className="font-mono font-bold">{maskedContact}</span>.
              </p>
            </div>

            {demoCode && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded text-[11px] text-amber-900 flex items-center justify-between font-mono">
                <span>Demo Simulation Code: <strong>{demoCode}</strong></span>
                <button
                  type="button"
                  onClick={() => setOtp(demoCode)}
                  className="text-orange-700 underline font-semibold text-[10px] cursor-pointer"
                >
                  Auto-Fill
                </button>
              </div>
            )}

            <div>
              <Input
                label="Enter 6-Digit Verification Code (OTP)"
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="e.g. 849201"
                maxLength={6}
                isMono
                required
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <button
                type="button"
                onClick={() => setStep('IDENTIFY')}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Details
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isLoading}
                className={`inline-flex items-center gap-1 font-semibold ${
                  resendCooldown > 0
                    ? 'text-slate-400 cursor-not-allowed'
                    : 'text-orange-600 hover:text-orange-700 cursor-pointer'
                }`}
              >
                <RotateCw className="w-3 h-3" />
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center mt-2"
              size="md"
              isLoading={isLoading}
              icon={<ShieldCheck className="w-4 h-4" />}
            >
              Confirm Verification
            </Button>
          </form>
        )}

        {/* STEP 3: SUCCESS & SECURE DELIVERY */}
        {step === 'SUCCESS' && (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h4 className="font-extrabold text-slate-900 text-base">
                Identity Verified Successfully
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                Your application reference number has been sent to your registered contact:{' '}
                <span className="font-mono font-semibold text-slate-800">{maskedContact}</span>.
              </p>
            </div>

            {recoveredRefNumber && (
              <div className="p-4 bg-slate-900 rounded-lg border border-slate-800 text-left space-y-2 max-w-md mx-auto">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Application Reference Number</span>
                  <span className="text-emerald-400 font-semibold text-[9px]">● VERIFIED</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-mono font-bold text-white tracking-wide">
                    {recoveredRefNumber}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                    aria-label="Copy application reference number"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 text-[11px]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-300" />
                        <span className="text-[11px]">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 text-left leading-normal">
              <strong>Security Protocol:</strong> For your security, you have not been logged in automatically.
              Please return to Sign In and enter your Application Reference Number and Mobile Number.
            </div>

            <Button
              type="button"
              variant="primary"
              className="w-full justify-center"
              size="md"
              onClick={handleReturnToSignIn}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Return to Sign In
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
