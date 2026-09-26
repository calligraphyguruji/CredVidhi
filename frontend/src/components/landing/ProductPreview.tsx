import React, { useState } from 'react';
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

  const app = applications[0]; // Reference app-001 (Alex Taylor)

  return (
    <section className="py-16 md:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 mb-3">
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
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
            <button
              onClick={() => setPreviewTab('workbench')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                previewTab === 'workbench'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Doc Workbench</span>
            </button>
            <button
              onClick={() => setPreviewTab('underwriting')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                previewTab === 'underwriting'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Risk Cockpit</span>
            </button>
            <button
              onClick={() => setPreviewTab('borrower')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                previewTab === 'borrower'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Borrower Portal</span>
            </button>
          </div>
        </div>

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
                credvidhi.internal.bank/workspace/{previewTab} • {app.referenceNumber}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                LIVE CONNECTED
              </span>
              <button
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
                className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded text-xs font-sans font-semibold transition-colors cursor-pointer"
              >
                <span>Open in App</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* TAB 1: Document Workbench Preview */}
          {previewTab === 'workbench' && (
            <div className="p-4 sm:p-6 bg-slate-900 grid grid-cols-1 lg:grid-cols-12 gap-6 text-slate-900">
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

                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-md">
                    <span className="text-[10px] font-mono font-bold text-blue-700 uppercase block">
                      Confirmed Gross Wages
                    </span>
                    <span className="text-xl font-bold font-mono text-blue-950">
                      ₹{(app.financial.grossMonthlyIncome * 12).toLocaleString('en-IN')}.00
                    </span>
                    <span className="text-[11px] text-blue-700 block mt-0.5 font-mono">
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
                    <span className="text-[11px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-semibold">
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
                  <span className="text-xs font-bold text-blue-700">66% Complete</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Underwriting Cockpit Preview */}
          {previewTab === 'underwriting' && (
            <div className="p-4 sm:p-6 bg-slate-900 grid grid-cols-1 lg:grid-cols-12 gap-6 text-slate-900">
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
                    <span className="text-lg font-bold text-blue-700">785 / 1000</span>
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
                      <span className="font-bold text-blue-700">{formatCurrency(app.requestedAmount)}</span>
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
            </div>
          )}

          {/* TAB 3: Borrower Application Tracker Preview */}
          {previewTab === 'borrower' && (
            <div className="p-4 sm:p-6 bg-slate-900 grid grid-cols-1 lg:grid-cols-12 gap-6 text-slate-900">
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
                    <span className="font-bold text-blue-700">{formatCurrency(app.requestedAmount)}</span>
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
            </div>
          )}

        </div>

      </div>
    </section>
  );
};
