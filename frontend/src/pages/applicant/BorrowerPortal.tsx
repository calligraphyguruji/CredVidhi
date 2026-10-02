import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Upload,
  ArrowLeft,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import {
  calculateEmi,
  calculateDti,
  calculateDisposableIncome,
  formatCurrency,
  formatDateTime,
} from '../../utils/financial';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export const BorrowerPortal: React.FC = () => {
  const { applications, products, submitNewApplication } = useApp();
  const shouldReduceMotion = useReducedMotion();

  // Find applicant's current active application
  const [selectedAppId, setSelectedAppId] = useState<string>(applications[0]?.id || '');
  const activeApp = applications.find((a) => a.id === selectedAppId) || applications[0];

  // Wizard Modal State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [step, setStep] = useState(1);

  // Wizard Form State
  const [selectedProductId, setSelectedProductId] = useState(products[0].id);
  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const [loanAmount, setLoanAmount] = useState(30000);
  const [tenorMonths, setTenorMonths] = useState(36);
  const [loanPurpose, setLoanPurpose] = useState('Debt Consolidation');

  const [personalForm, setPersonalForm] = useState({
    fullName: 'Jordan Miller',
    email: 'jordan.miller@example.com',
    phone: '+1 (555) 621-8899',
    dateOfBirth: '1992-08-25',
    residentialAddress: '342 Maple Street, Portland, OR 97201',
    taxId: '8832',
  });

  const [financialForm, setFinancialForm] = useState({
    employmentType: 'SALARIED' as 'SALARIED' | 'SELF_EMPLOYED',
    employerName: 'Cascade Software Group',
    jobTitle: 'Frontend Engineer',
    yearsEmployed: 3.5,
    grossMonthlyIncome: 8200,
    existingMonthlyDebt: 1200,
    housingExpense: 1750,
    creditScoreDeclared: 745,
  });

  const [uploadedFiles] = useState<
    Array<{ title: string; filename: string; size: number }>
  >([
    { title: 'Government Photo ID', filename: 'Passport_JordanMiller.pdf', size: 1850000 },
    { title: 'W-2 / Tax Return (2025)', filename: 'W2_CascadeSoftware_2025.pdf', size: 2100000 },
  ]);

  const [declarationConsent, setDeclarationConsent] = useState(true);

  // Live Calculations for Wizard
  const liveEmi = calculateEmi(loanAmount, selectedProduct.baseApr, tenorMonths);
  const liveDti = calculateDti(
    financialForm.grossMonthlyIncome,
    financialForm.existingMonthlyDebt,
    liveEmi
  );
  const liveDisposable = calculateDisposableIncome(
    financialForm.grossMonthlyIncome,
    financialForm.existingMonthlyDebt,
    financialForm.housingExpense,
    liveEmi
  );

  const handleFinishWizard = () => {
    const newId = submitNewApplication({
      productId: selectedProductId,
      requestedAmount: loanAmount,
      requestedTenorMonths: tenorMonths,
      purpose: loanPurpose,
      personal: personalForm,
      financial: financialForm,
      uploadedDocs: uploadedFiles,
    });
    setSelectedAppId(newId);
    setIsWizardOpen(false);
    setStep(1);
  };

  // Milestone Progress Definition
  const milestones = [
    {
      id: 'sub',
      title: 'Application Submitted',
      description: 'Docket received and locked for triage',
      isComplete: ['SUBMITTED', 'UNDER_REVIEW', 'DOCUMENTS_PENDING', 'DOCUMENTS_VERIFIED', 'RISK_ASSESSED', 'APPROVED', 'DISBURSED'].includes(activeApp.status),
      isActive: activeApp.status === 'SUBMITTED',
    },
    {
      id: 'ver',
      title: 'Document & KYC Verification',
      description: activeApp.status === 'DOCUMENTS_PENDING' ? 'Action Required: Deficiency flagged' : 'Checklist certified by Loan Officer',
      isComplete: ['DOCUMENTS_VERIFIED', 'RISK_ASSESSED', 'APPROVED', 'DISBURSED'].includes(activeApp.status),
      isActive: ['UNDER_REVIEW', 'DOCUMENTS_PENDING'].includes(activeApp.status),
      isWarning: activeApp.status === 'DOCUMENTS_PENDING',
    },
    {
      id: 'risk',
      title: 'Credit Risk Underwriting',
      description: 'Deterministic DTI and credit policy assessment',
      isComplete: ['RISK_ASSESSED', 'APPROVED', 'DISBURSED'].includes(activeApp.status),
      isActive: activeApp.status === 'DOCUMENTS_VERIFIED',
    },
    {
      id: 'dec',
      title: 'Underwriting Sanction',
      description: activeApp.status === 'REJECTED' ? 'Application rejected under policy criteria' : 'Formal loan sanction issued',
      isComplete: ['APPROVED', 'DISBURSED', 'REJECTED'].includes(activeApp.status),
      isActive: activeApp.status === 'RISK_ASSESSED',
    },
    {
      id: 'disb',
      title: 'Disbursement',
      description: 'Operational disbursement completed',
      isComplete: activeApp.status === 'DISBURSED',
      isActive: activeApp.status === 'APPROVED',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
        <div>
          <span className="text-xs font-mono uppercase text-orange-600 dark:text-orange-400 font-semibold tracking-wider">
            Applicant Self-Service Portal
          </span>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-0.5">
            Welcome back, Alex Taylor
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track real-time status, manage uploaded documents, and access formal approval letters.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsWizardOpen(true)}
          icon={<PlusCircle className="w-4 h-4" />}
        >
          New Loan Application
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Active Milestone Status Tracker (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card
            title={`Application Tracker — ${activeApp.referenceNumber}`}
            subtitle={`${activeApp.product.name} • Submitted ${formatDateTime(activeApp.submittedAt || activeApp.createdAt)}`}
            headerAction={<Badge status={activeApp.status} />}
          >
            {/* Sanction Letter Banner if Approved */}
            {activeApp.status === 'APPROVED' && activeApp.decision && (
              <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/80 rounded-md">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                      Congratulations! Your Loan Has Been Approved
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                      Sanctioned Amount: {formatCurrency(activeApp.decision.approvedAmount || activeApp.requestedAmount)} at {activeApp.decision.approvedApr}% APR for {activeApp.decision.approvedTenorMonths} months.
                    </p>
                    {activeApp.decision.conditions && (
                      <div className="mt-2 text-[11px] bg-white/70 dark:bg-slate-900/80 p-2 rounded text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                        <strong>Pre-disbursement Conditions:</strong> {activeApp.decision.conditions}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Deficiency Warning Banner if Documents Pending */}
            {activeApp.status === 'DOCUMENTS_PENDING' && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/80 rounded-md flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Action Required: Document Clarification
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    Our reviewing officer flagged one of your documents. Please review the deficiency notice in the documents tab below.
                  </p>
                </div>
              </div>
            )}

            {/* Vertical Milestone Tracker */}
            <div className="space-y-6 pl-2 pt-2">
              {milestones.map((m, idx) => {
                const isLast = idx === milestones.length - 1;
                return (
                  <div key={m.id} className="relative flex items-start gap-3.5">
                    {/* Connecting line */}
                    {!isLast && (
                      <div
                        className={`absolute left-3.5 top-7 -bottom-6 w-0.5 ${
                          m.isComplete ? 'bg-orange-600' : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                      ></div>
                    )}

                    {/* Milestone Icon Circle */}
                    <div
                      className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${
                        m.isComplete
                          ? 'bg-orange-600 text-white border-orange-600'
                          : m.isActive
                          ? 'bg-white dark:bg-slate-900 text-orange-600 border-orange-600 ring-2 ring-orange-100 dark:ring-orange-950/50'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {m.isComplete ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <span className="text-xs font-mono font-bold">{idx + 1}</span>
                      )}
                    </div>

                    {/* Step Info */}
                    <div className="flex-1 pb-1">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold ${
                            m.isComplete || m.isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {m.title}
                        </span>
                        {m.isActive && (
                          <span className="text-[10px] font-mono font-semibold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 px-2 py-0.5 rounded border border-orange-200/50 dark:border-orange-800/60">
                            IN PROGRESS
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{m.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: Loan Summary & Uploaded Documents (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card title="Loan Financial Summary">
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Requested Principal</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(activeApp.requestedAmount)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Tenor Period</span>
                <span className="font-mono text-slate-900 dark:text-slate-100 font-medium">
                  {activeApp.requestedTenorMonths} Months
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Annual Interest Rate (APR)</span>
                <span className="font-mono text-slate-900 dark:text-slate-100 font-medium">
                  {activeApp.product.baseApr}% Fixed
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Estimated Monthly EMI</span>
                <span className="font-mono font-bold text-orange-600 dark:text-orange-400 text-sm">
                  {formatCurrency(calculateEmi(activeApp.requestedAmount, activeApp.product.baseApr, activeApp.requestedTenorMonths))} / mo
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500 dark:text-slate-400">Declared Loan Purpose</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium text-right truncate max-w-[200px]">
                  {activeApp.purpose}
                </span>
              </div>
            </div>
          </Card>

          <Card title="Uploaded Verification Documents">
            <div className="space-y-2.5 text-xs">
              {activeApp.documents.length === 0 ? (
                <p className="text-slate-400 dark:text-slate-500 italic py-2">No documents attached.</p>
              ) : (
                activeApp.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-2.5 bg-slate-50 dark:bg-slate-950/60 rounded border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                      <div className="truncate">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {doc.documentType}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {doc.originalFilename}
                        </div>
                      </div>
                    </div>
                    <Badge status={doc.verificationStatus === 'VERIFIED' ? 'DOCUMENTS_VERIFIED' : doc.verificationStatus === 'DEFICIENT' ? 'DOCUMENTS_PENDING' : 'UNDER_REVIEW'} size="sm">
                      {doc.verificationStatus}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Multi-Step New Loan Application Wizard Modal */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        maxWidth="xl"
        title="Multi-Step Loan Application Wizard"
        description="Complete all 4 steps to submit your verified application directly to underwriting."
        footer={
          <div className="flex items-center justify-between w-full">
            {step > 1 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
                icon={<ArrowLeft className="w-3.5 h-3.5" />}
              >
                Back
              </Button>
            ) : (
              <div></div>
            )}

            {step < 4 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setStep((s) => s + 1)}
              >
                Save & Proceed →
              </Button>
            ) : (
              <Button
                variant="success"
                size="sm"
                disabled={!declarationConsent}
                onClick={handleFinishWizard}
              >
                Submit Application to CredVidhi
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-5 text-xs">
          {/* Stepper Progress Bar with animated track */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-4 gap-2 text-center select-none">
              {[
                { num: 1, label: 'Specifications' },
                { num: 2, label: 'Personal' },
                { num: 3, label: 'Financials' },
                { num: 4, label: 'Documents' },
              ].map((st) => (
                <div
                  key={st.num}
                  className={`py-1.5 px-2 rounded border text-xs font-semibold transition-colors ${
                    step === st.num
                      ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800/60'
                      : step > st.num
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      : 'text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-800'
                  }`}
                >
                  {st.num}. {st.label}
                </div>
              ))}
            </div>
            <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={false}
                animate={{ width: `${(step / 4) * 100}%` }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-orange-600 rounded-full"
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* STEP 1: Loan Specifications & Calculator */}
              {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Loan Product Selection
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded font-medium focus:outline-hidden focus:ring-1 focus:ring-orange-500"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.baseApr}% APR)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Requested Loan Amount
                    </label>
                    <span className="font-mono font-bold text-sm text-orange-600 dark:text-orange-400">
                      {formatCurrency(loanAmount)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={selectedProduct.minAmount}
                    max={selectedProduct.maxAmount}
                    step={1000}
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(Number(e.target.value))}
                    className="w-full accent-orange-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
                    <span>{formatCurrency(selectedProduct.minAmount)}</span>
                    <span>{formatCurrency(selectedProduct.maxAmount)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Repayment Tenor
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
                    {[12, 24, 36, 60].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTenorMonths(m)}
                        className={`py-1.5 rounded border text-center font-medium ${
                          tenorMonths === m
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {m} Mos
                      </button>
                    ))}
                  </div>
                </div>

                <Input
                  label="Declared Loan Purpose"
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                  placeholder="e.g. Debt Consolidation, Home Renovation"
                />
              </div>

              {/* Dynamic Repayment Preview Card */}
              <div className="bg-slate-50 dark:bg-slate-950/70 p-4 rounded-md border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">
                    Live Calculation Preview
                  </div>
                  <div className="text-2xl font-bold font-mono text-orange-600 dark:text-orange-400 mt-1">
                    {formatCurrency(liveEmi)} / mo
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    Fixed rate: {selectedProduct.baseApr}% APR
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Estimated DTI:</span>
                      <span
                        className={`font-mono font-semibold ${
                          liveDti <= selectedProduct.maxDtiRatio
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {liveDti}% (Cap: {selectedProduct.maxDtiRatio}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Estimated Disposable Surplus:</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(liveDisposable)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 mt-3">
                  *Calculations use fixed-point arithmetic adhering to PRD compound amortization rules.
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Personal & Identity */}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-3.5">
              <Input
                label="Full Legal Name"
                value={personalForm.fullName}
                onChange={(e) => setPersonalForm({ ...personalForm, fullName: e.target.value })}
              />
              <Input
                label="Email Address"
                type="email"
                value={personalForm.email}
                onChange={(e) => setPersonalForm({ ...personalForm, email: e.target.value })}
              />
              <Input
                label="Contact Phone"
                value={personalForm.phone}
                onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
              />
              <Input
                label="Date of Birth"
                type="date"
                value={personalForm.dateOfBirth}
                onChange={(e) =>
                  setPersonalForm({ ...personalForm, dateOfBirth: e.target.value })
                }
              />
              <div className="col-span-2">
                <Input
                  label="Residential Address"
                  value={personalForm.residentialAddress}
                  onChange={(e) =>
                    setPersonalForm({ ...personalForm, residentialAddress: e.target.value })
                  }
                />
              </div>
              <Input
                label="SSN / National ID (Last 4 Digits)"
                value={personalForm.taxId}
                onChange={(e) => setPersonalForm({ ...personalForm, taxId: e.target.value })}
                prefixText="***-**-"
                isMono
              />
            </div>
          )}

          {/* STEP 3: Employment & Financial Information */}
          {step === 3 && (
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Employment Status
                </label>
                <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-950/80 p-1 rounded font-mono text-xs border border-transparent dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() =>
                      setFinancialForm({ ...financialForm, employmentType: 'SALARIED' })
                    }
                    className={`py-1.5 rounded font-medium transition-colors ${
                      financialForm.employmentType === 'SALARIED'
                        ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    SALARIED
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFinancialForm({ ...financialForm, employmentType: 'SELF_EMPLOYED' })
                    }
                    className={`py-1.5 rounded font-medium transition-colors ${
                      financialForm.employmentType === 'SELF_EMPLOYED'
                        ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    SELF EMPLOYED
                  </button>
                </div>
              </div>

              <Input
                label="Employer / Business Name"
                value={financialForm.employerName}
                onChange={(e) =>
                  setFinancialForm({ ...financialForm, employerName: e.target.value })
                }
              />

              <Input
                label="Job Title"
                value={financialForm.jobTitle}
                onChange={(e) =>
                  setFinancialForm({ ...financialForm, jobTitle: e.target.value })
                }
              />

              <Input
                label="Years with Current Employer"
                type="number"
                step="0.5"
                value={financialForm.yearsEmployed}
                onChange={(e) =>
                  setFinancialForm({ ...financialForm, yearsEmployed: Number(e.target.value) })
                }
                suffixText="Yrs"
                isMono
              />

              <Input
                label="Gross Monthly Income"
                type="number"
                value={financialForm.grossMonthlyIncome}
                onChange={(e) =>
                  setFinancialForm({
                    ...financialForm,
                    grossMonthlyIncome: Number(e.target.value),
                  })
                }
                prefixText="₹"
                isMono
              />

              <Input
                label="Existing Monthly Debt Commitments"
                type="number"
                value={financialForm.existingMonthlyDebt}
                onChange={(e) =>
                  setFinancialForm({
                    ...financialForm,
                    existingMonthlyDebt: Number(e.target.value),
                  })
                }
                prefixText="₹"
                isMono
              />
            </div>
          )}

          {/* STEP 4: Document Upload & Declaration */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 p-4 rounded-md text-center bg-slate-50 dark:bg-slate-950/50">
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  Drag & Drop mandatory KYC files (PDF, PNG, JPEG up to 10MB)
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Required: Government Photo ID and 2025 W-2 / Tax Return
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 font-semibold block">
                  Attached Files ({uploadedFiles.length})
                </span>
                {uploadedFiles.map((f, i) => (
                  <div
                    key={i}
                    className="p-2.5 bg-slate-50 dark:bg-slate-950/60 rounded border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                      <span className="font-medium text-slate-900 dark:text-slate-100">{f.title}:</span>
                      <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{f.filename}</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                      READY
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="consent"
                  checked={declarationConsent}
                  onChange={(e) => setDeclarationConsent(e.target.checked)}
                  className="mt-1 accent-orange-600 cursor-pointer"
                />
                <label htmlFor="consent" className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed cursor-pointer">
                  I certify that all information provided in this application is true and complete. I consent to deterministic credit underwriting, income verification, and immutable audit logging in accordance with regulatory banking compliance.
                </label>
              </div>
            </div>
          )}
          </motion.div>
        </AnimatePresence>
        </div>
      </Modal>
    </div>
  );
};
