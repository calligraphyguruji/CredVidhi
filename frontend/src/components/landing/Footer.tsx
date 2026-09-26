import React from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Footer: React.FC = () => {
  const { setActiveView, switchRole } = useApp();

  return (
    <footer className="bg-slate-950 text-slate-400 text-xs border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Brand & Purpose (4 Cols) */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-white font-sans">
                  LAPS
                </span>
                <span className="text-[10px] font-mono text-slate-500 block">
                  Loan Approval Processing System
                </span>
              </div>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              An institutional-grade, full-stack digital lending platform designed to automate
              retail and commercial loan underwriting with deterministic rules and immutable compliance.
            </p>

            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>ACID Enforced • 256-Bit Encrypted Workspaces</span>
            </div>
          </div>

          {/* Nav Column 1: Lending Workspaces (3 Cols) */}
          <div className="md:col-span-3 space-y-3">
            <div className="text-xs font-mono font-semibold uppercase text-slate-200 tracking-wider">
              Lending Rails
            </div>
            <ul className="space-y-2 text-slate-400">
              <li>
                <button
                  onClick={() => {
                    switchRole('LOAN_OFFICER');
                    setActiveView('officer-queue');
                  }}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Officer Queue (Triage)
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    switchRole('LOAN_OFFICER');
                    setActiveView('document-workbench');
                  }}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Document Verification Workbench
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    switchRole('RISK_ANALYST');
                    setActiveView('underwriting-cockpit');
                  }}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Underwriting & Risk Cockpit
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    switchRole('APPLICANT');
                    setActiveView('borrower-portal');
                  }}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Borrower Self-Service Portal
                </button>
              </li>
            </ul>
          </div>

          {/* Nav Column 2: Governance & Settings (2 Cols) */}
          <div className="md:col-span-2 space-y-3">
            <div className="text-xs font-mono font-semibold uppercase text-slate-200 tracking-wider">
              Governance
            </div>
            <ul className="space-y-2 text-slate-400">
              <li>
                <button
                  onClick={() => {
                    switchRole('ADMIN');
                    setActiveView('compliance-audit');
                  }}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Compliance Audit Logs
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    switchRole('ADMIN');
                    setActiveView('loan-products');
                  }}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Loan Product Matrix
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveView('login')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Staff SSO Authentication
                </button>
              </li>
            </ul>
          </div>

          {/* Nav Column 3: Architecture Specs (3 Cols) */}
          <div className="md:col-span-3 space-y-3">
            <div className="text-xs font-mono font-semibold uppercase text-slate-200 tracking-wider">
              Engineering Specs
            </div>
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5 font-mono text-[11px]">
              <div className="text-slate-300 font-semibold">PRD & Architecture v1.0</div>
              <div className="text-slate-500">Fixed-Point Amortization (Decimal)</div>
              <div className="text-slate-500">Deterministic Score Calculation</div>
              <div className="text-emerald-400 pt-1">● Finite State Machine Active</div>
            </div>
          </div>

        </div>

        {/* Bottom Disclaimer & Copyright */}
        <div className="mt-12 pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p>© 2026 LAPS Architecture. All rights reserved.</p>
          <p className="text-center sm:text-right">
            Deterministic Lending & Underwriting System • Built to PRD.md & RULES.md Specifications
          </p>
        </div>
      </div>
    </footer>
  );
};
