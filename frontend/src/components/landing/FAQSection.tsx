import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown, HelpCircle, FileText, CheckCircle2 } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    category: 'Underwriting Engine',
    question: 'How does CredVidhi calculate deterministic loan underwriting decisions?',
    answer: 'CredVidhi evaluates applications using mathematical, rule-based algorithms without black-box bias. The engine computes strict Debt-to-Income (DTI) thresholds, verified monthly disposable income, and deterministic credit bureau scores to output transparent APPROVE, CONDITIONAL, or REJECT recommendations with exact justification codes.',
  },
  {
    category: 'Loan Processing',
    question: 'What types of loan products are supported on the platform?',
    answer: 'CredVidhi supports configured enterprise lending products including Home Mortgages (up to ₹1.5 Cr at 8.75% APR), SME Working Capital Loans (up to ₹50 Lakh at 11.5% APR), and Personal Loans (up to ₹15 Lakh at 13.25% APR) with customizable tenure and collateral parameters.',
  },
  {
    category: 'Document Management',
    question: 'How does automated KYC and document verification work?',
    answer: 'Borrowers upload government identity proofs (PAN card, Aadhaar), salary slips, and bank statements through the self-service portal. The loan officer document workbench provides side-by-side inspection, automated checksum verification, and structured status transitions (PENDING, VERIFIED, DEFICIENT).',
  },
  {
    category: 'Application Tracking',
    question: 'Can borrowers track their loan approval status in real time?',
    answer: 'Yes. The Borrower Application Portal provides complete visibility into the 6-stage lifecycle (Draft → Submitted → Under Review → Approved/Rejected → Disbursed). Borrowers receive instant status updates and clear deficiency notices if additional documentation is required.',
  },
  {
    category: 'Security & Compliance',
    question: 'How does CredVidhi maintain regulatory compliance and audit trails?',
    answer: 'Every state transition, document verification, and underwriting decision is permanently committed to an immutable append-only audit ledger with cryptographic timestamps and actor identifiers. The platform enforces strict Role-Based Access Control (RBAC) across Loan Officers, Underwriters, and Compliance Auditors.',
  },
  {
    category: 'Operations',
    question: 'How does CredVidhi accelerate loan processing turnaround time (TAT)?',
    answer: 'By replacing manual spreadsheets and disconnected document handoffs with an integrated finite state machine and automated risk calculation, CredVidhi reduces loan origination turnaround time by up to 60%, resolving qualified applications in under 24 hours.',
  },
];

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const shouldReduceMotion = useReducedMotion();

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-16 md:py-24 bg-slate-50 border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-xs font-mono font-medium">
            <HelpCircle className="w-3.5 h-3.5 text-orange-600" />
            <span>FREQUENTLY ASKED QUESTIONS</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Institutional Lending Questions, Answered.
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
            Everything you need to know about our deterministic underwriting pipeline,
            document management workbench, and compliance ledger.
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3">
          {FAQ_DATA.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className={`border rounded-lg transition-all duration-200 ${
                  isOpen
                    ? 'border-orange-300 bg-white shadow-xs ring-1 ring-orange-200/50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <h3 className="m-0 p-0 font-normal">
                  <button
                    onClick={() => toggleAccordion(index)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                    id={`faq-question-${index}`}
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-lg"
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                        {item.category}
                      </span>
                      <span className="block text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                        {item.question}
                      </span>
                    </div>
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>
                </h3>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-answer-${index}`}
                      role="region"
                      aria-labelledby={`faq-question-${index}`}
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                        {item.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Bottom Documentation Anchor Card */}
        <div className="mt-10 p-5 rounded-lg bg-orange-50/70 dark:bg-slate-900/90 border border-orange-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                Need more architectural specifications?
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Explore our comprehensive PRD, underwriting formulas, and security compliance matrices.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-orange-800 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>100% Deterministic & Audit-Ready</span>
          </div>
        </div>
      </div>
    </section>
  );
};
