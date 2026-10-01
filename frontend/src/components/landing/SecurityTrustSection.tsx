import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck, Lock, EyeOff, FileText, Database, Key } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SecurityTrustSection: React.FC = () => {
  const { setActiveView, switchRole, isAuthenticated } = useApp();
  const shouldReduceMotion = useReducedMotion();

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
    <section id="security" className="py-16 md:py-24 bg-white dark:bg-transparent border-b border-slate-200 dark:border-slate-800/80 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.3 }}
          className="max-w-3xl mb-12"
        >
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1 rounded border border-orange-200 dark:border-orange-500/30 mb-3">
            <span>FINANCIAL GOVERNANCE & PRIVACY</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Security & audit safeguards built-in.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            CredVidhi enforces institutional banking standards from the database transaction boundary
            to the front-end user experience.
          </p>
        </motion.div>

        {/* 6-Pillar Security Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trustPillars.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={i}
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.28, delay: shouldReduceMotion ? 0 : i * 0.06 }}
                whileHover={!shouldReduceMotion ? { y: -2, transition: { duration: 0.2 } } : undefined}
                className="p-6 bg-slate-50/80 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800/80 hover:border-orange-500/50 dark:hover:border-orange-500/50 transition-colors group shadow-xs dark:shadow-black/20"
              >
                <div className="w-9 h-9 rounded-lg bg-orange-100/90 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 border border-orange-200/50 dark:border-orange-500/30 flex items-center justify-center font-bold mb-4 group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors mb-2">
                  {pillar.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {pillar.description}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Live Audit Log Stream Callout */}
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.3 }}
          className="mt-10 p-6 bg-slate-900 dark:bg-slate-950/90 text-white rounded-xl border border-slate-800 dark:border-orange-500/20 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg shadow-black/20"
        >
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

          <motion.button
            whileHover={!shouldReduceMotion ? { scale: 1.02 } : undefined}
            whileTap={!shouldReduceMotion ? { scale: 0.98 } : undefined}
            onClick={() => {
              if (!isAuthenticated) {
                setActiveView('register');
                return;
              }
              switchRole('ADMIN');
              setActiveView('compliance-audit');
            }}
            className="shrink-0 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer shadow-xs shadow-orange-950/40"
          >
            Open Compliance Audit Stream
          </motion.button>
        </motion.div>

      </div>
    </section>
  );
};
