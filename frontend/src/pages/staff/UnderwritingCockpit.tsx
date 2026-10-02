import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Activity,
  CheckCircle,
  Play,
  FileCheck,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { AnimatedCounter } from '../../components/ui/AnimatedCounter';
import { formatCurrency } from '../../utils/financial';

export const UnderwritingCockpit: React.FC = () => {
  const {
    applications,
    activeApplicationId,
    runRiskAssessment,
    recordUnderwritingDecision,
  } = useApp();

  const shouldReduceMotion = useReducedMotion();
  const application = applications.find((a) => a.id === activeApplicationId) || applications[0];
  const assessment = application.riskAssessment;

  // Underwriter Decision Form State
  const [selectedDecision, setSelectedDecision] = useState<'APPROVED' | 'CONDITIONAL' | 'REJECTED'>(
    application.decision?.decision || 'APPROVED'
  );
  const [approvedAmount, setApprovedAmount] = useState<number>(
    application.decision?.approvedAmount || application.requestedAmount
  );
  const [approvedApr, setApprovedApr] = useState<number>(
    application.decision?.approvedApr || application.product.baseApr
  );
  const [approvedTenor, setApprovedTenor] = useState<number>(
    application.decision?.approvedTenorMonths || application.requestedTenorMonths
  );
  const [rejectionCode, setRejectionCode] = useState<string>(
    application.decision?.rejectionReasonCode || 'HIGH_DTI'
  );
  const [underwriterNotes, setUnderwriterNotes] = useState<string>(
    application.decision?.underwriterNotes ||
      'Applicant satisfies risk criteria with low DTI, verified income, and prime credit history.'
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  const handleRunEvaluation = () => {
    runRiskAssessment(application.id);
  };

  const handleCommitDecision = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      recordUnderwritingDecision(application.id, selectedDecision, {
        approvedAmount: selectedDecision !== 'REJECTED' ? approvedAmount : undefined,
        approvedApr: selectedDecision !== 'REJECTED' ? approvedApr : undefined,
        approvedTenorMonths: selectedDecision !== 'REJECTED' ? approvedTenor : undefined,
        rejectionReasonCode: selectedDecision === 'REJECTED' ? rejectionCode : undefined,
        underwriterNotes,
      });
      setIsSubmitting(false);
      setShowSuccessBanner(true);
    }, 400);
  };

  const isHighValue = approvedAmount > 500000;

  return (
    <div className="space-y-5">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
            <span>DOCKET: {application.referenceNumber}</span>
            <span>•</span>
            <Badge status={application.status} size="sm" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Quantitative Underwriting Cockpit — {application.personal.fullName}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {!assessment && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunEvaluation}
              icon={<Play className="w-3.5 h-3.5" />}
            >
              Execute Risk Engine
            </Button>
          )}
          {assessment && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunEvaluation}
              icon={<Activity className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />}
            >
              Re-Calculate Risk
            </Button>
          )}
        </div>
      </div>

      {/* Decision Success Banner */}
      <AnimatePresence>
        {showSuccessBanner && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
            className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 rounded-md text-xs flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>
                Decision successfully recorded and signed into the immutable audit trail.
              </span>
            </div>
            <button
              onClick={() => setShowSuccessBanner(false)}
              className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 font-bold cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top 4 KPI Metrics with Animated Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          whileHover={!shouldReduceMotion ? { y: -2 } : undefined}
          className="bg-white dark:bg-slate-900 p-4 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs transition-shadow hover:shadow-md"
        >
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Credit Score
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            <AnimatedCounter value={application.financial.creditScoreDeclared} duration={0.6} />
          </div>
          <div className="mt-1">
            <Badge status={application.financial.creditScoreDeclared >= 750 ? 'LOW' : 'MEDIUM'} size="sm">
              {application.financial.creditScoreDeclared >= 750 ? 'PRIME (750+)' : 'STANDARD'}
            </Badge>
          </div>
        </motion.div>

        <motion.div
          whileHover={!shouldReduceMotion ? { y: -2 } : undefined}
          className="bg-white dark:bg-slate-900 p-4 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs transition-shadow hover:shadow-md"
        >
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Calculated DTI Ratio
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {assessment ? (
              <AnimatedCounter value={assessment.calculatedDti} duration={0.6} suffix="%" decimals={1} />
            ) : (
              'Pending'
            )}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1">
            Cap: {application.product.maxDtiRatio}% (Safe &lt; 45%)
          </div>
        </motion.div>

        <motion.div
          whileHover={!shouldReduceMotion ? { y: -2 } : undefined}
          className="bg-white dark:bg-slate-900 p-4 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs transition-shadow hover:shadow-md"
        >
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Disposable Income Cushion
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
            {assessment ? (
              <AnimatedCounter
                value={assessment.disposableIncome}
                duration={0.6}
                formatter={(val) => formatCurrency(val)}
              />
            ) : (
              'Pending'
            )}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1">Net Monthly Surplus</div>
        </motion.div>

        <motion.div
          whileHover={!shouldReduceMotion ? { y: -2 } : undefined}
          className="bg-white dark:bg-slate-900 p-4 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs transition-shadow hover:shadow-md"
        >
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Estimated Monthly EMI
          </div>
          <div className="text-2xl font-bold font-mono text-orange-600 dark:text-orange-400 mt-1">
            {assessment ? (
              <AnimatedCounter
                value={assessment.calculatedEmi}
                duration={0.6}
                formatter={(val) => formatCurrency(val)}
              />
            ) : (
              'Pending'
            )}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1">
            At {application.product.baseApr}% Fixed APR
          </div>
        </motion.div>
      </div>

      {/* Main Underwriting 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* COLUMN 1: Applicant Financial Health (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card title="Financial Capacity & Breakdown">
            <div className="space-y-4 text-xs">
              {/* Financial Progress Bar */}
              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1">
                  <span>Gross Income: {formatCurrency(application.financial.grossMonthlyIncome)}</span>
                  <span>100%</span>
                </div>
                <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                  <motion.div
                    initial={shouldReduceMotion ? undefined : { width: 0 }}
                    animate={{
                      width: `${Math.min(
                        100,
                        (application.financial.existingMonthlyDebt /
                          application.financial.grossMonthlyIncome) *
                          100
                      )}%`,
                    }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-amber-500"
                    title="Existing Debt"
                  />
                  <motion.div
                    initial={shouldReduceMotion ? undefined : { width: 0 }}
                    animate={{
                      width: `${Math.min(
                        100,
                        (application.financial.housingExpense /
                          application.financial.grossMonthlyIncome) *
                          100
                      )}%`,
                    }}
                    transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-slate-400"
                    title="Housing Expense"
                  />
                  <motion.div
                    initial={shouldReduceMotion ? undefined : { width: 0 }}
                    animate={{
                      width: `${Math.min(
                        100,
                        ((assessment?.calculatedEmi || 0) /
                          application.financial.grossMonthlyIncome) *
                          100
                      )}%`,
                    }}
                    transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-orange-600"
                    title="Proposed Loan EMI"
                  />
                  <div className="flex-1 bg-emerald-500" title="Disposable Surplus" />
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span>Existing Debt: {formatCurrency(application.financial.existingMonthlyDebt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                    <span>Housing: {formatCurrency(application.financial.housingExpense)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-600"></span>
                    <span>Proposed EMI: {formatCurrency(assessment?.calculatedEmi || 0)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>Surplus: {formatCurrency(assessment?.disposableIncome || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Employment Profile */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 font-semibold block">
                  Employment Stability
                </span>
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded border border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {application.financial.employerName}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {application.financial.jobTitle} • {application.financial.employmentType}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {application.financial.yearsEmployed} Yrs
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* COLUMN 2: Deterministic Rules Engine (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card
            title="Rules Engine & Risk Scoring"
            subtitle="Deterministic mathematical underwriting criteria"
          >
            {assessment ? (
              <div className="space-y-4 text-xs">
                {/* Score & Tier Banner */}
                <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">
                      Risk Score Rating
                    </div>
                    <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                      <AnimatedCounter value={assessment.internalRiskScore} duration={0.8} /> / 1000
                    </div>
                  </div>
                  <Badge status={assessment.riskTier} size="md">
                    {assessment.riskTier} RISK
                  </Badge>
                </div>

                <div className="text-xs text-slate-700 dark:text-slate-300 bg-orange-50/60 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/60 p-2.5 rounded">
                  <span className="font-semibold text-orange-950 dark:text-orange-300 block mb-0.5">
                    System Recommendation:
                  </span>
                  {assessment.recommendation}
                </div>

                {/* Granular Evaluated Rules */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 font-semibold block">
                    Evaluated Underwriting Policies
                  </span>
                  {assessment.scoreFactors.map((factor, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-slate-50 dark:bg-slate-950/60 rounded border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">{factor.name}</div>
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          Result: {factor.evaluated} (Threshold: {factor.threshold})
                        </div>
                      </div>
                      <Badge status={factor.status} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 space-y-3">
                <Activity className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto animate-pulse" />
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Risk score and DTI ratios have not been executed yet for this application.
                </p>
                <Button size="sm" onClick={handleRunEvaluation}>
                  Run Risk Engine Now
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* COLUMN 3: Underwriting Decision Cockpit (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card
            title="Underwriting Disposition"
            subtitle="Codify binding approval or rejection"
            className="border-slate-300 dark:border-slate-700"
          >
            <div className="space-y-3.5 text-xs">
              {/* Decision Tabs */}
              <div>
                <label className="block text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Adjudication Decision
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-950/70 p-1 rounded border border-transparent dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedDecision('APPROVED')}
                    className={`py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                      selectedDecision === 'APPROVED'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    APPROVE
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDecision('CONDITIONAL')}
                    className={`py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                      selectedDecision === 'CONDITIONAL'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    CONDITIONAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDecision('REJECTED')}
                    className={`py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                      selectedDecision === 'REJECTED'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    REJECT
                  </button>
                </div>
              </div>

              {selectedDecision !== 'REJECTED' ? (
                <>
                  {/* Approved Terms */}
                  <Input
                    label="Sanctioned Loan Amount"
                    type="number"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(Number(e.target.value))}
                    prefixText="₹"
                    isMono
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Approved APR (%)"
                      type="number"
                      step="0.05"
                      value={approvedApr}
                      onChange={(e) => setApprovedApr(Number(e.target.value))}
                      suffixText="%"
                      isMono
                    />
                    <Input
                      label="Approved Tenor"
                      type="number"
                      value={approvedTenor}
                      onChange={(e) => setApprovedTenor(Number(e.target.value))}
                      suffixText="Mos"
                      isMono
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Regulatory Rejection Code
                  </label>
                  <select
                    value={rejectionCode}
                    onChange={(e) => setRejectionCode(e.target.value)}
                    className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded font-mono text-slate-900 dark:text-slate-100 transition-colors cursor-pointer"
                  >
                    <option value="HIGH_DTI">HIGH_DTI — Exceeds product maximum DTI ratio</option>
                    <option value="POOR_CREDIT">CREDIT_BELOW_MINIMUM — Below 650 score floor</option>
                    <option value="UNVERIFIED_INCOME">UNVERIFIED_INCOME — Failed income validation</option>
                    <option value="POLICY_CAP">POLICY_BREACH — Insufficient employment history</option>
                  </select>
                </div>
              )}

              {/* Underwriter Rationale */}
              <div>
                <label className="block text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Audit-Logged Decision Rationale
                </label>
                <textarea
                  rows={3}
                  value={underwriterNotes}
                  onChange={(e) => setUnderwriterNotes(e.target.value)}
                  placeholder="Mandatory rationale for credit committee and regulatory audit..."
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
                ></textarea>
              </div>

              {/* High-Value Escalation Flag */}
              {isHighValue && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-900/80 rounded flex items-center gap-2 text-[11px] text-amber-800 dark:text-amber-300">
                  <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    High-Value Loan (&gt; ₹5,00,000) flagged for mandatory Senior Committee cosign.
                  </span>
                </div>
              )}

              {/* Commit Button */}
              <div className="pt-2">
                <Button
                  variant={selectedDecision === 'REJECTED' ? 'danger' : 'primary'}
                  className="w-full justify-center"
                  isLoading={isSubmitting}
                  onClick={handleCommitDecision}
                  icon={<FileCheck className="w-4 h-4" />}
                >
                  Commit Decision & Sign Audit Trail
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
