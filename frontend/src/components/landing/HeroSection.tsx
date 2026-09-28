import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Activity, Sliders } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { calculateEmi, calculateDti, formatCurrency } from '../../utils/financial';
import { fadeUpVariants, scaleInVariants } from '../../utils/motion';

export const HeroSection: React.FC = () => {
  const { setActiveView, switchRole, products } = useApp();
  const shouldReduceMotion = useReducedMotion();

  // Dynamic loan calculator state in Hero
  const [loanAmount, setLoanAmount] = useState(1500000);
  const [tenorMonths, setTenorMonths] = useState(36);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);

  const activeProduct = products[selectedProductIndex] || products[0];
  const apr = activeProduct ? activeProduct.baseApr : 10.5;

  const liveEmi = calculateEmi(loanAmount, apr, tenorMonths);
  const assumedMonthlyIncome = Math.round(loanAmount / 8);
  const liveDti = calculateDti(assumedMonthlyIncome, 15000, liveEmi);

  const containerVariants = {
    initial: {},
    animate: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
      },
    },
  };

  return (
    <section className="relative overflow-hidden pt-8 pb-16 md:pt-14 md:pb-24 border-b border-slate-200 bg-slate-50 bg-gradient-to-b from-white via-slate-50/60 to-slate-100/40">
      {/* Background Decorative FinTech Grid & Subtle Ambient Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f01f_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f01f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      
      {!shouldReduceMotion && (
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.35, 0.45, 0.35],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -top-24 right-1/4 w-96 h-96 rounded-full bg-orange-200/25 blur-3xl pointer-events-none"
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* LEFT COLUMN: Strategic FinTech Value Proposition (7 Cols) */}
          <motion.div
            variants={containerVariants}
            initial="initial"
            animate="animate"
            className="lg:col-span-7 space-y-6 text-left"
          >
            {/* System Status Pill */}
            <motion.div variants={fadeUpVariants}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/90 text-orange-800 text-[11px] font-mono font-medium shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse"></span>
                <span>CREDVIDHI CORE V2.4 • DETERMINISTIC UNDERWRITING</span>
              </div>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              variants={fadeUpVariants}
              className="text-3xl sm:text-5xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.12]"
            >
              Deterministic credit underwriting.{' '}
              <span className="text-orange-600 block sm:inline">
                Sanctioned in minutes, not days.
              </span>
            </motion.h1>

            {/* Sub-headline directly derived from PRD Section 1.1 */}
            <motion.p
              variants={fadeUpVariants}
              className="text-base sm:text-lg text-slate-600 max-w-2xl font-normal leading-relaxed"
            >
              Transition your lending operations from fragmented paper trails to an automated,
              auditable digital pipeline. End-to-end governance with rule-based risk engines,
              instant document verification, and immutable audit logs.
            </motion.p>

            {/* Key Value Checklist */}
            <motion.div variants={fadeUpVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>60% Faster Turnaround Time (TAT)</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero Black-Box Scoring Biases</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Strict Role-Based Access Control (RBAC)</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>100% Immutable Audit Trail</span>
              </div>
            </motion.div>

            {/* CTAs */}
            <motion.div variants={fadeUpVariants} className="pt-3 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  setActiveView('register');
                }}
                icon={<ArrowRight className="w-4 h-4" />}
                className="shadow-sm"
              >
                Apply for Loan
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  switchRole('LOAN_OFFICER');
                  setActiveView('officer-queue');
                }}
                icon={<Activity className="w-4 h-4 text-orange-600" />}
              >
                Launch Staff Workbench Demo
              </Button>
            </motion.div>

            {/* Micro Footnote */}
            <motion.p variants={fadeUpVariants} className="text-[11px] font-mono text-slate-600">
              *Full stack live demonstration with simulated credit evaluation and document verification.
            </motion.p>
          </motion.div>

          {/* RIGHT COLUMN: Interactive Live Loan & EMI Calculator (5 Cols) */}
          <motion.div
            variants={scaleInVariants}
            initial="initial"
            animate="animate"
            className="lg:col-span-5"
          >
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-card p-6 relative overflow-hidden transition-all duration-200 hover:shadow-lg">
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Live Repayment Calculator
                    </h2>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Compound Amortization Formula
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono uppercase bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-200">
                  REAL-TIME PREVIEW
                </span>
              </div>

              {/* Product Selector Pills */}
              <div className="mb-5">
                <label className="block text-[10px] font-mono font-semibold uppercase text-slate-500 tracking-wider mb-2">
                  Select Loan Product
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {products.map((p, idx) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProductIndex(idx)}
                      className={`px-2 py-2 rounded text-xs font-semibold text-center truncate transition-all cursor-pointer ${
                        selectedProductIndex === idx
                          ? 'bg-orange-600 text-white shadow-2xs font-bold'
                          : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {p.name.replace(' Loan', '').replace(' Unsecured', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Loan Amount Slider */}
              <div className="space-y-2 mb-5">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] font-mono font-semibold uppercase text-slate-500 tracking-wider">
                    Requested Amount
                  </span>
                  <span className="text-lg font-bold font-mono text-orange-600">
                    {formatCurrency(loanAmount)}
                  </span>
                </div>
                <input
                  type="range"
                  min={100000}
                  max={5000000}
                  step={50000}
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full accent-orange-600 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>₹1,00,000</span>
                  <span>₹25,00,000</span>
                  <span>₹50,00,000</span>
                </div>
              </div>

              {/* Tenor Selection */}
              <div className="space-y-2 mb-6">
                <span className="block text-[10px] font-mono font-semibold uppercase text-slate-500 tracking-wider">
                  Repayment Tenor (Months)
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {[12, 24, 36, 60].map((m) => (
                    <button
                      key={m}
                      onClick={() => setTenorMonths(m)}
                      className={`py-1.5 rounded font-mono text-xs font-bold transition-all cursor-pointer ${
                        tenorMonths === m
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {m} Mos
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Calculation Result Box */}
              <div className="bg-slate-900 text-white rounded-lg p-4 font-mono space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-400">Monthly EMI:</span>
                  <span className="text-2xl font-extrabold text-emerald-400">
                    {formatCurrency(liveEmi)}
                    <span className="text-xs text-slate-400 font-normal"> / mo</span>
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-800 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">BASE APR:</span>
                    <span className="text-slate-200 font-semibold">{apr}% Fixed</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">EST. DTI:</span>
                    <span className="text-emerald-400 font-semibold">{liveDti}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">EST. TOTAL:</span>
                    <span className="text-slate-200 font-semibold truncate">
                      {formatCurrency(liveEmi * tenorMonths)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Direct Action Link */}
              <div className="pt-4">
                <Button
                  variant="primary"
                  className="w-full justify-center"
                  onClick={() => {
                    setActiveView('register');
                  }}
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  Apply at this Rate ({apr}% APR)
                </Button>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
