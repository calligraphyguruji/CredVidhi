import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  FileCheck2,
  Activity,
  UserCheck,
  Check,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge } from '../ui/Badge';
import { formatCurrency } from '../../utils/financial';

export const ProductPreview: React.FC = () => {
  const { setActiveView, switchRole, applications } = useApp();
  const [previewTab, setPreviewTab] = useState<'workbench' | 'underwriting' | 'borrower'>('workbench');
  const shouldReduceMotion = useReducedMotion();

  const app = applications[0]; // Reference app-001 (Alex Taylor)

  return (
    <section className="py-16 md:py-24 bg-white border-b border-slate-200 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.3 }}
          className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4"
        >
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase text-orange-700 bg-orange-50 px-2.5 py-1 rounded border border-orange-200 mb-3">
              <span>UNIFIED OPERATIONAL WORKSPACES</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              A high-density operational cockpit.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-2xl">
              Inspect the real application workspaces built with native design tokens,
              deterministic scoring engines, and live document OCR telemetry.
            </p>
          </div>

          {/* Interactive Workspace Tab Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0 relative">
            <button
              onClick={() => setPreviewTab('workbench')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                previewTab === 'workbench'
                  ? 'text-orange-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {previewTab === 'workbench' && (
                <motion.div
                  layoutId={shouldReduceMotion ? undefined : 'preview-tab-pill'}
                  className="absolute inset-0 bg-white rounded-md shadow-xs"
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <FileCheck2 className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">Doc Workbench</span>
            </button>
            <button
              onClick={() => setPreviewTab('underwriting')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                previewTab === 'underwriting'
                  ? 'text-orange-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {previewTab === 'underwriting' && (
                <motion.div
                  layoutId={shouldReduceMotion ? undefined : 'preview-tab-pill'}
                  className="absolute inset-0 bg-white rounded-md shadow-xs"
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <Activity className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">Risk Cockpit</span>
            </button>
            <button
              onClick={() => setPreviewTab('borrower')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                previewTab === 'borrower'
                  ? 'text-orange-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {previewTab === 'borrower' && (
                <motion.div
                  layoutId={shouldReduceMotion ? undefined : 'preview-tab-pill'}
                  className="absolute inset-0 bg-white rounded-md shadow-xs"
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <UserCheck className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">Borrower Portal</span>
            </button>
          </div>
        </motion.div>

        {/* Live Interface Preview Window */}
        <div className="rounded-xl border border-slate-300/80 shadow-elevated bg-slate-900 overflow-hidden text-slate-100">
          
          {/* Simulated Browser / Workspace Header */}
          <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
              </div>
              <span className="text-slate-500 ml-2">|</span>
              <span className="text-slate-400 font-semibold truncate">
                dhanexa.internal.bank/workspace/{previewTab} • {app.referenceNumber}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                LIVE CONNECTED
              </span>
              <motion.button
                whileHover={!shouldReduceMotion ? { scale: 1.03 } : undefined}
                whileTap={!shouldReduceMotion ? { scale: 0.97 } : undefined}
                onClick={() => {
                  if (previewTab === 'workbench') {
                    switchRole('LOAN_OFFICER');
                    setActiveView('document-workbench');
                  } else if (previewTab === 'underwriting') {
                    switchRole('RISK_ANALYST');
                    setActiveView('underwriting-cockpit');
                  } else {
                    switchRole('APPLICANT');
                    setActiveView('borrower-portal');
                  }
                }}
                className="inline-flex items-center gap-1 bg-orange-600 hover:bg-orange-500 text-white px-2.5 py-1 rounded text-xs font-sans font-semibold transition-colors cursor-pointer"
              >
                <span>Open in App</span>
                <ExternalLink className="w-3 h-3" />
              </motion.button>
            </div>
          </div>

          {/* TAB CONTENT WITH ANIMATE PRESENCE */}
          <AnimatePresence mode="wait">
            {previewTab === 'workbench' && (
              <motion.div
                key="workbench"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="p-4 sm:p-6 bg-slate-900 grid grid-cols-1 lg:grid-cols-12 gap-6 text-slate-900"
              >
                {/* Left Pane: Document Canvas */}
                <div className="lg:col-span-7 bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                          FORM 16 / OFFICIAL EARNINGS STATEMENT
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">
                          Apex Industrial Technologies — FY 2025-26
                        </h4>
                      </div>
                      <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                        OCR MATCH 98.4%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs font-mono mb-4">
                      <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                        <span className="text-[10px] text-slate-500 block uppercase">Employee Name</span>
                        <span className="font-bold text-slate-800">{app.personal.fullName}</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                        <span className="text-[10px] text-slate-500 block uppercase">PAN / Tax ID</span>
                        <span className="font-bold text-slate-800">{app.personal.taxIdMasked}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-orange-50/70 border border-orange-200 rounded-md">
                      <span className="text-[10px] font-mono font-bold text-orange-700 uppercase block">
                        Confirmed Gross Wages
                      </span>
                      <span className="text-xl font-bold font-mono text-orange-950">
                        ₹{(app.financial.grossMonthlyIncome * 12).toLocaleString('en-IN')}.00
                      </span>
                      <span className="text-[11px] text-orange-700 block mt-0.5 font-mono">
                        = {formatCurrency(app.financial.grossMonthlyIncome)} / month
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500">
                    <span>File: W2_ApexIndustrial_2025.pdf</span>
                    <span className="text-emerald-700 font-semibold">● Sign-off Recorded</span>
                  </div>
                </div>

                {/* Right Pane: Officer Verification Checklist */}
                <div className="lg:col-span-5 bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                        Verification Checklist
                      </h4>
                      <span className="text-[11px] font-mono text-orange-700 bg-orange-50 px-2 py-0.5 rounded font-semibold">
                        v1.2 Policy
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="p-2.5 bg-emerald-50/60 rounded border border-emerald-200 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-900">1. Identity & Government ID</div>
                          <div className="text-[11px] text-slate-500">Matches name and PAN {app.personal.taxIdMasked}</div>
                        </div>
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      </div>

                      <div className="p-2.5 bg-emerald-50/60 rounded border border-emerald-200 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-900">2. Income & Salary Proof</div>
                          <div className="text-[11px] text-slate-500">Gross wages align with declared application</div>
                        </div>
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-900">3. 90-Day Bank Statement</div>
                          <div className="text-[11px] text-slate-500">Verifying recurring salary deposit credits</div>
                        </div>
                        <span className="text-[10px] font-mono font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          IN PROGRESS
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-500">Officer: David Vance</span>
                    <span className="text-xs font-bold text-orange-600">66% Complete</span>
                  </div>
                </div>
              </motion.div>
            )}

            {previewTab === 'underwriting' && (
              <motion.div
                key="underwriting"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="p-4 sm:p-6 bg-slate-900 grid grid-cols-1 lg:grid-cols-12 gap-6 text-slate-900"
              >
                {/* Gauges & Summary */}
                <div className="lg:col-span-7 bg-white rounded-lg p-5 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase block">
                        QUANTITATIVE CREDIT UNDERWRITING
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        Automated Risk Assessment Metrics
                      </h4>
                    </div>
                    <Badge variant="approved">LOW RISK (TIER 1)</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-3 font-mono text-center">
                    <div className="p-3 bg-slate-50 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase block">Calculated DTI</span>
                      <span className="text-lg font-bold text-emerald-700">31.4%</span>
                      <span className="text-[10px] text-slate-400 block">Cap: 45.0%</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase block">Proprietary Score</span>
                      <span className="text-lg font-bold text-orange-600">785 / 1000</span>
                      <span className="text-[10px] text-slate-400 block">Floor: 650</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase block">Disposable Buffer</span>
                      <span className="text-lg font-bold text-slate-800">₹4,537/mo</span>
                      <span className="text-[10px] text-slate-400 block">Min: ₹1,500</span>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded text-xs">
                    <span className="font-bold text-emerald-800 block mb-0.5">Automated Recommendation:</span>
                    <span className="text-emerald-900">
                      PRE-APPROVED for full requested amount ({formatCurrency(app.requestedAmount)}) at baseline 10.5% APR.
                    </span>
                  </div>
                </div>

                {/* Sanction Decision Drawer */}
                <div className="lg:col-span-5 bg-white rounded-lg p-5 border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="border-b border-slate-100 pb-3 mb-3">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                        Sanction Terms & Sign-off
                      </h4>
                    </div>

                    <div className="space-y-3 font-mono text-xs">
                      <div className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-200">
                        <span className="text-slate-500">Sanctioned Limit:</span>
                        <span className="font-bold text-orange-600">{formatCurrency(app.requestedAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-200">
                        <span className="text-slate-500">Approved APR:</span>
                        <span className="font-bold text-slate-800">10.5% Fixed</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-200">
                        <span className="text-slate-500">Tenor:</span>
                        <span className="font-bold text-slate-800">36 Months</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono text-[11px]">Analyst: Katherine Reed</span>
                    <span className="font-semibold text-emerald-700">Ready to Sanction</span>
                  </div>
                </div>
              </motion.div>
            )}

            {previewTab === 'borrower' && (
              <motion.div
                key="borrower"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="p-4 sm:p-6 bg-slate-900 grid grid-cols-1 lg:grid-cols-12 gap-6 text-slate-900"
              >
                <div className="lg:col-span-8 bg-white rounded-lg p-5 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase block">
                        BORROWER SELF-SERVICE DASHBOARD
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        Application Status: {app.referenceNumber}
                      </h4>
                    </div>
                    <Badge variant="review">UNDER REVIEW</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-400 block uppercase">Requested</span>
                      <span className="font-bold text-orange-600">{formatCurrency(app.requestedAmount)}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-400 block uppercase">Estimated EMI</span>
                      <span className="font-bold text-slate-800">₹1,462.93 / mo</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-400 block uppercase">Tenor</span>
                      <span className="font-bold text-slate-800">36 Months</span>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded p-3 text-xs bg-slate-50">
                    <span className="font-semibold text-slate-800 block mb-1">
                      Operational Status Notice:
                    </span>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Your application is currently being verified by Loan Officer David Vance. All identity checks
                      have passed; currently validating 90-day bank records.
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-4 bg-white rounded-lg p-5 border border-slate-200 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase font-mono mb-3">
                      Uploaded Documents
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="p-2 bg-emerald-50 rounded border border-emerald-200 flex items-center justify-between">
                        <span className="font-medium text-slate-800 truncate">Govt Photo ID</span>
                        <span className="text-emerald-700 font-bold text-[10px] font-mono">VERIFIED</span>
                      </div>
                      <div className="p-2 bg-emerald-50 rounded border border-emerald-200 flex items-center justify-between">
                        <span className="font-medium text-slate-800 truncate">Form 16 Tax Return</span>
                        <span className="text-emerald-700 font-bold text-[10px] font-mono">VERIFIED</span>
                      </div>
                      <div className="p-2 bg-amber-50 rounded border border-amber-200 flex items-center justify-between">
                        <span className="font-medium text-slate-800 truncate">Bank Statements</span>
                        <span className="text-amber-700 font-bold text-[10px] font-mono">PENDING</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 font-mono">
                    SLA Target: 24h
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>
    </section>
  );
};
