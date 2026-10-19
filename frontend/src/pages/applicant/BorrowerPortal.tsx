import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LoanApplicationWizard } from './LoanApplicationWizard';
import {
  calculateEmi,
  formatCurrency,
  formatDateTime,
} from '../../utils/financial';
import { documentsApi } from '../../services/api';

export const BorrowerPortal: React.FC = () => {
  const { applications: allApplications, products, currentUser, isSyncing, dataError,
    refreshFromBackend } = useApp();
  const applications = allApplications.filter(a => a.applicantId === currentUser.id);

  // Find applicant's current active application
  const [selectedAppId, setSelectedAppId] = useState<string>(applications[0]?.id || '');
  const activeApp = applications.find((a) => a.id === selectedAppId) || applications[0];

  // Wizard Modal State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [resumeId, setResumeId] = useState<string | undefined>();
  const [success, setSuccess] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [documentType, setDocumentType] = useState('');
  const activeDocumentType = activeApp?.product.requiredDocuments.some(d => d.code === documentType) ? documentType : activeApp?.product.requiredDocuments[0]?.code || '';
  const handleUpload = async (file?: File) => {
    if (!file || !activeApp || isUploading) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const type = activeDocumentType;
      if (!type) throw new Error('Select a document category.');
      await documentsApi.uploadMultipart(activeApp.id, file, type);
      await refreshFromBackend();
    } catch (err: any) { setUploadError(err.message || 'Document upload failed. Please retry.'); }
    finally { setIsUploading(false); }
  };

  const openWizard = () => {
    if (isSyncing || dataError) return;
    setResumeId(undefined); setSuccess(''); setIsWizardOpen(true);
  };

  // Milestone Progress Definition
  const milestones = [
    {
      id: 'sub',
      title: 'Application Submitted',
      description: 'Docket received and locked for triage',
      isComplete: ['SUBMITTED', 'UNDER_REVIEW', 'DOCUMENTS_PENDING', 'DOCUMENTS_VERIFIED', 'RISK_ASSESSED', 'APPROVED', 'DISBURSED'].includes(activeApp?.status || ''),
      isActive: activeApp?.status === 'SUBMITTED',
    },
    {
      id: 'ver',
      title: 'Document & KYC Verification',
      description: activeApp?.status === 'DOCUMENTS_PENDING' ? 'Action Required: Deficiency flagged' : 'Checklist certified by Loan Officer',
      isComplete: ['DOCUMENTS_VERIFIED', 'RISK_ASSESSED', 'APPROVED', 'DISBURSED'].includes(activeApp?.status || ''),
      isActive: ['UNDER_REVIEW', 'DOCUMENTS_PENDING'].includes(activeApp?.status || ''),
      isWarning: activeApp?.status === 'DOCUMENTS_PENDING',
    },
    {
      id: 'risk',
      title: 'Credit Risk Underwriting',
      description: 'Deterministic DTI and credit policy assessment',
      isComplete: ['RISK_ASSESSED', 'APPROVED', 'DISBURSED'].includes(activeApp?.status || ''),
      isActive: activeApp?.status === 'DOCUMENTS_VERIFIED',
    },
    {
      id: 'dec',
      title: 'Underwriting Sanction',
      description: activeApp?.status === 'REJECTED' ? 'Application rejected under policy criteria' : 'Formal loan sanction issued',
      isComplete: ['APPROVED', 'DISBURSED', 'REJECTED'].includes(activeApp?.status || ''),
      isActive: activeApp?.status === 'RISK_ASSESSED',
    },
    {
      id: 'disb',
      title: 'Disbursement',
      description: 'Operational disbursement completed',
      isComplete: activeApp?.status === 'DISBURSED',
      isActive: activeApp?.status === 'APPROVED',
    },
  ];

  return (
    <div className="space-y-6">
      {success && <p role="status" className="text-emerald-500">{success}</p>}
      {activeApp?.status === 'DRAFT' && <Button variant="outline" onClick={() => { setResumeId(activeApp.id); setIsWizardOpen(true); }}>Resume Draft Application</Button>}
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
        <div>
          <span className="text-xs font-mono uppercase text-orange-600 dark:text-orange-400 font-semibold tracking-wider">
            Applicant Self-Service Portal
          </span>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-0.5">
            Welcome, {currentUser.fullName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track real-time status, manage uploaded documents, and access formal approval letters.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={openWizard}
          disabled={isSyncing || !!dataError || products.length === 0}
          icon={<PlusCircle className="w-4 h-4" />}
        >
          New Loan Application
        </Button>
      </div>

      {isSyncing ? <p role="status">Loading your account…</p> : dataError ? (
        <div role="alert"><p>{dataError}</p><Button onClick={() => void refreshFromBackend()}>Retry</Button></div>
      ) : <>
      {applications.length > 1 && <label className="block text-sm">Application
        <select value={activeApp?.id || ''} onChange={e => setSelectedAppId(e.target.value)} className="p-2 border rounded bg-white dark:bg-slate-900">
          {applications.map(a => <option key={a.id} value={a.id}>{a.referenceNumber} — {a.status}</option>)}
        </select>
      </label>}
      {products.length === 0 && <p>No loan products are currently available. Please try again later.</p>}
      <dl className="flex flex-wrap gap-6 text-sm">
        {[
          ['Total Applications', applications.length],
          ['Active Loans', applications.filter(a => a.status === 'DISBURSED').length],
          ['Approved Loans', applications.filter(a => a.status === 'APPROVED').length],
          ['Pending Applications', applications.filter(a => ['SUBMITTED', 'UNDER_REVIEW', 'DOCUMENTS_PENDING', 'DOCUMENTS_VERIFIED', 'RISK_ASSESSED'].includes(a.status)).length],
          ['Outstanding Balance', applications.some(a => a.status === 'DISBURSED') ? 'Not Available' : '₹0'],
          ['Documents Uploaded', applications.reduce((n, a) => n + a.documents.length, 0)],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="font-mono font-semibold">{value}</dd></div>)}
      </dl>
      <Card title={activeApp?.riskAssessment ? 'Internal Risk Assessment' : 'Credit Score Not Available'}>
        {activeApp?.riskAssessment ? <p>{activeApp.riskAssessment.internalRiskScore} / 1000 — Internal assessment; not a bureau credit score.</p> : <p>Your credit assessment will appear here once the required evaluation is completed.</p>}
      </Card>
      <Card title="Repayment History"><p>No repayment history available.</p><p className="text-xs">Repayment servicing records are not available in this portal.</p></Card>
      <Card title="Recent Activity">{applications.length ? applications.map(a => <p key={a.id}>{a.referenceNumber}: {a.status}</p>) : <p>No recent activity.</p>}</Card>
      {!activeApp ? <Card title="No loan applications yet."><p>Start your first loan application to begin your borrowing journey.</p><Button onClick={openWizard}>Apply for a Loan</Button><p>No documents uploaded yet.</p><Button onClick={openWizard}>Upload Documents</Button></Card> : <>
      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Active Milestone Status Tracker (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card
            title={`Application Tracker — ${activeApp.referenceNumber}`}
            subtitle={`${activeApp.product.name} • Submitted ${formatDateTime(activeApp.submittedAt || activeApp.createdAt)}`}
            headerAction={<Badge status={activeApp?.status} />}
          >
            {/* Sanction Letter Banner if Approved */}
            {activeApp?.status === 'APPROVED' && activeApp.decision && (
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
            {activeApp?.status === 'DOCUMENTS_PENDING' && (
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
            <label className="block text-sm">Document category
              <select value={activeDocumentType} onChange={e => setDocumentType(e.target.value)} className="block p-2 border rounded bg-white dark:bg-slate-900">
                {activeApp.product.requiredDocuments.map(d => <option key={d.code} value={d.code}>{d.title}</option>)}
              </select>
            </label>
            <label className="block text-sm my-3">Upload Documents
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={isUploading || ['REJECTED', 'DISBURSED'].includes(activeApp.status)} onChange={e => { void handleUpload(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            {isUploading && <p role="status">Uploading document…</p>}
            {uploadError && <p role="alert">{uploadError}</p>}

            <div className="space-y-2.5 text-xs">
              {activeApp.documents.length === 0 ? (
                <p className="text-slate-400 dark:text-slate-500 italic py-2">No documents uploaded yet.</p>
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

      </>}
      </>}
      <LoanApplicationWizard key={resumeId || "new"} isOpen={isWizardOpen} resumeId={resumeId} onClose={() => setIsWizardOpen(false)} onSubmitted={id => { setSelectedAppId(id); setIsWizardOpen(false); setSuccess('Your application was submitted successfully.'); }} />
    </div>
  );
};
