import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  FileText,
  UserCheck,
  FileCheck2,
  Activity,
  Award,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const WorkflowSection: React.FC = () => {
  const { setActiveView, switchRole } = useApp();
  const [activeStep, setActiveStep] = useState(2); // Default to Document Verification step
  const shouldReduceMotion = useReducedMotion();

  const steps = [
    {
      step: 1,
      id: 'submission',
      title: 'Digital Application',
      role: 'Applicant',
      statusTag: 'SUBMITTED',
      icon: FileText,
      summary: 'Applicant selects loan product, declares financials, and uploads mandatory proof.',
      details: [
        'Multi-step guided wizard with live EMI preview',
        'Automated input validation and masking of sensitive identifiers',
        'Document upload with file format and size verification',
      ],
      targetView: 'borrower-portal',
      targetRole: 'APPLICANT' as const,
    },
    {
      step: 2,
      id: 'review',
      title: 'Queue Triage & Locking',
      role: 'Loan Officer',
      statusTag: 'UNDER_REVIEW',
      icon: UserCheck,
      summary: 'Front-desk officers claim incoming applications and execute initial policy checks.',
      details: [
        'Deterministic queue sorting by submission SLA',
        'Exclusive lock mechanism to prevent race conditions',
        'Applicant identity cross-check',
      ],
      targetView: 'officer-queue',
      targetRole: 'LOAN_OFFICER' as const,
    },
    {
      step: 3,
      id: 'verification',
      title: 'Document Workbench',
      role: 'Loan Officer',
      statusTag: 'DOCUMENTS_VERIFIED',
      icon: FileCheck2,
      summary: 'Side-by-side split screen verification of salary slips, Form 16, and bank statements.',
      details: [
        'High-resolution PDF viewer with zoom and rotation',
        'Automated OCR data extraction & income alignment check',
        'Checklist-driven audit sign-off per document',
      ],
      targetView: 'document-workbench',
      targetRole: 'LOAN_OFFICER' as const,
    },
    {
      step: 4,
      id: 'risk',
      title: 'Underwriting Cockpit',
      role: 'Risk Analyst',
      statusTag: 'RISK_ASSESSED',
      icon: Activity,
      summary: 'Mathematical risk scoring evaluating DTI ratio, disposable income, and credit score.',
      details: [
        'Fixed-point compound amortization mathematics',
        'Transparent rule breakdown: PASS / FLAG / FAIL',
        'Tier categorization: LOW / MEDIUM / HIGH risk',
      ],
      targetView: 'underwriting-cockpit',
      targetRole: 'RISK_ANALYST' as const,
    },
    {
      step: 5,
      id: 'decision',
      title: 'Committee Decision',
      role: 'Credit Committee',
      statusTag: 'APPROVED',
      icon: Award,
      summary: 'Sanction letter issuance with approved APR and tenor, or regulatory rejection code.',
      details: [
        'Dual-signoff requirement for high-value loans (> ₹5,00,000)',
        'Mandatory underwriter audit rationale log',
        'Preset regulatory rejection codes with adverse action notice',
      ],
      targetView: 'underwriting-cockpit',
      targetRole: 'RISK_ANALYST' as const,
    },
    {
      step: 6,
      id: 'audit',
      title: 'Disbursal & Audit Trail',
      role: 'Administrator / Auditor',
      statusTag: 'DISBURSED',
      icon: ShieldCheck,
      summary: 'Operational milestone recording and immutable event logging for banking compliance.',
      details: [
        'Tamper-evident chronological audit event trail',
        'Before/After state tracking on all data mutations',
        'Exportable CSV and PDF regulatory compliance dossiers',
      ],
      targetView: 'compliance-audit',
      targetRole: 'ADMIN' as const,
    },
  ];

  const current = steps[activeStep] || steps[0];
  const CurrentIcon = current.icon;

  return (
    <section id="workflow" className="py-16 md:py-24 bg-white border-b border-slate-200 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading with scroll reveal */}
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.3 }}
          className="max-w-3xl mb-12"
        >
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase text-orange-700 bg-orange-50 px-2.5 py-1 rounded border border-orange-200 mb-3">
            <span>FINITE STATE MACHINE ARCHITECTURE</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            The 6-stage deterministic lending lifecycle.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            Every loan application transitions through strict, auditable states governed by
            enterprise business rules. Skip transitions and unauthorized state modifications are strictly prohibited.
          </p>
        </motion.div>

        {/* Stepper Tabs Bar */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-8">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isSelected = activeStep === idx;
            return (
              <motion.button
                key={s.id}
                whileHover={!shouldReduceMotion ? { y: -2 } : undefined}
                whileTap={!shouldReduceMotion ? { scale: 0.98 } : undefined}
                onClick={() => setActiveStep(idx)}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-orange-50/70 border-orange-600 shadow-xs'
                    : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/70 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold transition-colors ${
                      isSelected ? 'bg-orange-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    0{s.step}
                  </span>
                  <Icon
                    className={`w-4 h-4 transition-colors ${isSelected ? 'text-orange-600' : 'text-slate-400'}`}
                  />
                </div>
                <div className="font-semibold text-xs text-slate-900 truncate">{s.title}</div>
                <div className="text-[10px] font-mono text-slate-600 truncate mt-0.5">
                  {s.role}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Interactive Step Detail Card with Animated Content Crossfade */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="bg-slate-50 rounded-xl border border-slate-200 p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
          >
            {/* Left Details */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded">
                  STAGE 0{current.step}
                </span>
                <span className="text-xs font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                  ACTOR: {current.role.toUpperCase()}
                </span>
                <span className="text-xs font-mono bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                  STATE: {current.statusTag}
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                <CurrentIcon className="w-6 h-6 text-orange-600 shrink-0" />
                <span>{current.title}</span>
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed">{current.summary}</p>

              <div className="space-y-2 pt-2">
                {current.details.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex items-center gap-3">
                <motion.button
                  whileHover={!shouldReduceMotion ? { scale: 1.02 } : undefined}
                  whileTap={!shouldReduceMotion ? { scale: 0.98 } : undefined}
                  onClick={() => {
                    switchRole(current.targetRole);
                    setActiveView(current.targetView);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded text-xs font-semibold hover:bg-orange-700 transition-colors shadow-2xs cursor-pointer"
                >
                  <span>Launch {current.title} Interface</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </div>

            {/* Right Visual State Simulation */}
            <div className="lg:col-span-5 bg-white p-5 rounded-lg border border-slate-200 shadow-2xs font-mono text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3 text-[11px] text-slate-500">
                <span>STATE TRANSITION LOG</span>
                <span className="text-emerald-700 font-bold">● VERIFIED TRANSITION</span>
              </div>

              <div className="space-y-2.5 text-[11px]">
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">CURRENT TRANSITION ENVELOPE</span>
                  <span className="text-orange-600 font-bold">
                    {current.step === 1 ? 'DRAFT' : steps[activeStep - 1]?.statusTag || 'SUBMITTED'} →{' '}
                    {current.statusTag}
                  </span>
                </div>

                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">ROLE PRIVILEGE VALIDATION</span>
                  <span className="text-slate-800">RBAC: Authorized for {current.role}</span>
                </div>

                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">AUDIT METADATA ATTACHMENT</span>
                  <span className="text-slate-800">
                    Actor ID, Timestamp, Mutation Delta, Cryptographic Nonce
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                <span>ACID Enforced</span>
                <span>PRD Section 4.1</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

      </div>
    </section>
  );
};
