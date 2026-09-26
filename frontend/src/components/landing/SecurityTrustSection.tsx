import React from 'react';
import { ShieldCheck, Lock, EyeOff, FileText, Database, Key } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SecurityTrustSection: React.FC = () => {
  const { setActiveView, switchRole } = useApp();

  const trustPillars = [
    {
      icon: EyeOff,
      title: 'Tax Identifier & PII Masking',
      description:
        'Sensitive borrower identifiers (PAN, SSN, bank accounts) are automatically masked throughout logs, telemetry, and unprivileged views (***-**-1234).',
    },
    {
      icon: Lock,
      title: 'Role-Based Access Control (RBAC)',
      description:
        'Four strictly separated operational personas: Applicant, Loan Officer, Risk Analyst, and Administrator. Officers cannot approve loans; analysts cannot bypass verification.',
    },
    {
      icon: Database,
      title: 'ACID Atomic Transitions',
      description:
        'Every status transition and document verification runs within atomic transaction boundaries. If audit persistence fails, the workflow rolls back instantly.',
    },
    {
      icon: Key,
      title: 'Obfuscated Document Storage',
      description:
        'Uploaded borrower files are assigned cryptographically random UUID storage identifiers, never exposing raw user-supplied file system paths.',
    },
    {
      icon: FileText,
      title: 'Immutable Audit Trail',
      description:
        'Every status modification, underwriter note, document verification, and committee approval creates a permanent, non-deletable audit log entry.',
    },
    {
      icon: ShieldCheck,
      title: 'Fair Lending Transparency',
      description:
        'Deterministic calculations ensure identical financial profiles receive identical evaluations, eliminating arbitrary human bias and compliance risk.',
    },
  ];

  return (
    <section id="security" className="py-16 md:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 mb-3">
            <span>FINANCIAL GOVERNANCE & PRIVACY</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Security & audit safeguards built-in.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            CredVidhi enforces institutional banking standards from the database transaction boundary
            to the front-end user experience.
          </p>
        </div>

        {/* 6-Pillar Security Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trustPillars.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <div
                key={i}
                className="p-6 bg-slate-50/70 rounded-xl border border-slate-200 hover:border-slate-300 transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center font-bold mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">
                  {pillar.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Live Audit Log Stream Callout */}
        <div className="mt-10 p-6 bg-slate-900 text-white rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-left">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                AUDIT LOGS ACTIVE & IMMUTABLE
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Inspect the live event stream, actor credentials, and before/after transition snapshots in the Compliance Console.
            </p>
          </div>

          <button
            onClick={() => {
              switchRole('ADMIN');
              setActiveView('compliance-audit');
            }}
            className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
          >
            Open Compliance Audit Stream
          </button>
        </div>

      </div>
    </section>
  );
};
