import React from 'react';
import {
  Cpu,
  FileCheck,
  ShieldCheck,
  Lock,
  Layers,
  FileCode,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const KeyCapabilities: React.FC = () => {
  const { setActiveView, switchRole } = useApp();

  const capabilities = [
    {
      icon: Cpu,
      title: 'Deterministic Risk Evaluation',
      description:
        'Purely mathematical underwriting using fixed-point compound amortization, DTI ratio ceilings, and transparent score factors. Zero black-box hallucinations.',
      tag: 'FINANCIAL ACCURACY',
      actionView: 'underwriting-cockpit',
      actionRole: 'RISK_ANALYST' as const,
    },
    {
      icon: FileCheck,
      title: 'Dual-Pane Document Workbench',
      description:
        'Side-by-side inspection canvas with automated salary & Form 16 OCR telemetry. Structured audit checklists eliminate document verification friction.',
      tag: 'FRAUD PREVENTION',
      actionView: 'document-workbench',
      actionRole: 'LOAN_OFFICER' as const,
    },
    {
      icon: Lock,
      title: 'Queue Locking & Collision Control',
      description:
        'Real-time operational lock mechanism ensures incoming loan applications are handled by a single dedicated officer, preventing duplicate reviews and race conditions.',
      tag: 'CONCURRENCY SAFE',
      actionView: 'officer-queue',
      actionRole: 'LOAN_OFFICER' as const,
    },
    {
      icon: ShieldCheck,
      title: 'Immutable Audit Trail',
      description:
        'Every status modification, underwriter note, document sign-off, and committee vote is permanently recorded in a tamper-evident audit ledger with before/after state diffs.',
      tag: 'REGULATORY COMPLIANT',
      actionView: 'compliance-audit',
      actionRole: 'ADMIN' as const,
    },
    {
      icon: Layers,
      title: 'Dynamic Product Engine',
      description:
        'Configure lending products with customized interest rates, min/max loan limits, repayment tenors, maximum DTI tolerances, and mandatory document checklists.',
      tag: 'OPERATIONAL AGILITY',
      actionView: 'loan-products',
      actionRole: 'ADMIN' as const,
    },
    {
      icon: FileCode,
      title: 'Adverse Action Rejection Codes',
      description:
        'Structured regulatory rejection reason codes and mandatory underwriter rationale logging ensure compliance with fair lending disclosures and credit transparency.',
      tag: 'FAIR LENDING',
      actionView: 'underwriting-cockpit',
      actionRole: 'RISK_ANALYST' as const,
    },
  ];

  return (
    <section id="engine" className="py-16 md:py-24 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase text-orange-700 bg-orange-50 px-2.5 py-1 rounded border border-orange-200 mb-3">
            <span>ENGINEERED FOR BANK-GRADE OPERATIONS</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Comprehensive core lending infrastructure.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            Built from first principles to satisfy credit committee rigor, risk underwriting policies,
            and strict institutional compliance mandates.
          </p>
        </div>

        {/* Bento Grid Layout (Taste-Skill compliant: Asymmetric, clean cards with micro-borders) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <div
                key={i}
                className="bg-white rounded-xl border border-slate-200/90 p-6 flex flex-col justify-between hover:shadow-card hover:border-slate-300 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-bold group-hover:bg-orange-600 group-hover:text-white transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {cap.tag}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-2 group-hover:text-orange-600 transition-colors">
                    {cap.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {cap.description}
                  </p>
                </div>

                <div className="pt-6 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => {
                      switchRole(cap.actionRole);
                      setActiveView(cap.actionView);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-800 cursor-pointer"
                  >
                    <span>Inspect Capability</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono text-slate-600">CredVidhi v2.4</span>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
