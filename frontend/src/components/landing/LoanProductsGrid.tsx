import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils/financial';

export const LoanProductsGrid: React.FC = () => {
  const { products, setActiveView, switchRole, isAuthenticated } = useApp();
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="products" className="py-16 md:py-24 bg-slate-50 border-b border-slate-200 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.3 }}
          className="max-w-3xl mb-12"
        >
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase text-orange-700 bg-orange-50 px-2.5 py-1 rounded border border-orange-200 mb-3">
            <span>TRANSPARENT INSTITUTIONAL FINANCING</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Configured loan products & terms.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            Every loan product enforces explicit eligibility thresholds, maximum Debt-to-Income (DTI)
            ceilings, and mandatory document verification checklists.
          </p>
        </motion.div>

        {/* 3-Column Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {products.map((product, i) => (
            <motion.div
              key={product.id}
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.3, delay: shouldReduceMotion ? 0 : i * 0.08 }}
              whileHover={!shouldReduceMotion ? { y: -3, transition: { duration: 0.2 } } : undefined}
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between hover:shadow-card hover:border-slate-300 transition-colors"
            >
              <div>
                {/* Product Badge */}
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-[10px] font-bold uppercase text-orange-700 bg-orange-50 px-2.5 py-1 rounded border border-orange-200">
                    {product.code}
                  </span>
                  <span className="text-xs font-mono text-emerald-700 font-semibold">
                    From {product.baseApr}% APR
                  </span>
                </div>

                {/* Title & Description */}
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {product.name}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-5">
                  {product.description}
                </p>

                {/* Financial Parameters */}
                <div className="space-y-2.5 py-4 border-y border-slate-100 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Loan Range:</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(product.minAmount)} – {formatCurrency(product.maxAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Tenor:</span>
                    <span className="font-bold text-slate-900">
                      {product.minTenorMonths} to {product.maxTenorMonths} Mos
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Max DTI Ceiling:</span>
                    <span className="font-bold text-orange-700">{product.maxDtiRatio}%</span>
                  </div>
                </div>

                {/* Mandatory Checklist Items */}
                <div className="pt-4 mb-6">
                  <span className="block text-[10px] font-mono font-semibold uppercase text-slate-400 tracking-wider mb-2">
                    Mandatory Documents
                  </span>
                  <div className="space-y-1.5">
                    {product.requiredDocuments.map((doc) => (
                      <div key={doc.code} className="flex items-center gap-2 text-[11px] text-slate-700">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{doc.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <Button
                variant="primary"
                className="w-full justify-center"
                onClick={() => {
                  if (!isAuthenticated) {
                    setActiveView('register');
                    return;
                  }
                  switchRole('APPLICANT');
                  setActiveView('borrower-portal');
                }}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Apply for {product.name.replace(' Loan', '').replace(' Unsecured', '')}
              </Button>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};
