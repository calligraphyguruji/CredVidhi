import React, { useState } from 'react';
import {
  ArrowLeft,
  HelpCircle,
  AlertTriangle,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  Check,
  Send,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency } from '../../utils/financial';

export const DocumentWorkbench: React.FC = () => {
  const {
    applications,
    activeApplicationId,
    setActiveView,
    selectedDocId,
    setSelectedDocId,
    verifyDocument,
    transitionApplicationStatus,
  } = useApp();

  const application = applications.find((a) => a.id === activeApplicationId) || applications[0];

  const activeDoc =
    application.documents.find((d) => d.id === selectedDocId) ||
    application.documents[0] || {
      id: 'mock-doc',
      documentType: 'W-2 / Tax Return (2025)',
      originalFilename: 'W2_ApexIndustrial_2025.pdf',
      verificationStatus: 'VERIFIED',
      verificationRemarks: 'Income matches declared gross.',
      uploadedAt: new Date().toISOString(),
    };

  const [zoomLevel, setZoomLevel] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isClarificationModalOpen, setIsClarificationModalOpen] = useState(false);
  const [clarificationReason, setClarificationReason] = useState('BLURRY_SCAN');
  const [clarificationNotes, setClarificationNotes] = useState('');
  const [activeOfficerNotes, setActiveOfficerNotes] = useState('');

  const handleVerifyCurrentDoc = () => {
    verifyDocument(
      application.id,
      activeDoc.id,
      'VERIFIED',
      'Verified by officer during split-screen review.'
    );
  };

  const handleDeficientCurrentDoc = () => {
    setIsClarificationModalOpen(true);
  };

  const handleConfirmDeficiency = () => {
    verifyDocument(
      application.id,
      activeDoc.id,
      'DEFICIENT',
      `${clarificationReason}: ${clarificationNotes || 'Document requires re-submission.'}`
    );
    setIsClarificationModalOpen(false);
    setClarificationNotes('');
  };

  const handleCertifyAllAndForward = () => {
    // Certify all pending docs
    application.documents.forEach((doc) => {
      if (doc.verificationStatus === 'PENDING') {
        verifyDocument(application.id, doc.id, 'VERIFIED', 'Bulk certified by reviewing officer');
      }
    });
    transitionApplicationStatus(
      application.id,
      'DOCUMENTS_VERIFIED',
      'Officer certified all mandatory KYC and income documents. Forwarded to Risk Assessment queue.'
    );
    setActiveView('underwriting-cockpit');
  };

  return (
    <div className="space-y-4">
      {/* Top Sub-Header Bar (From Stitch Reference) */}
      <div className="bg-white px-4 py-3 rounded-md border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView('officer-queue')}
            className="flex items-center gap-1.5 text-slate-500 hover:text-blue-700 transition-colors text-xs font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Queue [{application.referenceNumber}]</span>
          </button>

          <div className="h-4 w-px bg-slate-200"></div>

          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-slate-900">{application.personal.fullName}</span>
            <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              SSN: {application.personal.taxIdMasked}
            </span>
          </div>

          <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-mono text-xs font-semibold">
            <span>{formatCurrency(application.requestedAmount)}</span>
            <span className="uppercase text-[10px] text-blue-600 font-normal">
              • {application.product.name}
            </span>
          </div>
        </div>

        {/* Quick Disposition Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeficientCurrentDoc}
            icon={<HelpCircle className="w-3.5 h-3.5 text-amber-600" />}
          >
            Request Clarification
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDeficientCurrentDoc}
            icon={<AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
          >
            Flag Discrepancy
          </Button>

          <Button
            variant="success"
            size="sm"
            onClick={handleCertifyAllAndForward}
            icon={<ShieldCheck className="w-4 h-4" />}
          >
            Certify & Forward to Risk
          </Button>
        </div>
      </div>

      {/* Split Work Area: 7 Columns Left (Viewport) / 5 Columns Right (Checklist) */}
      <div className="grid grid-cols-12 gap-4">
        {/* LEFT PANE: Document Telemetry & Viewport (7 Cols) */}
        <div className="col-span-12 xl:col-span-7 flex flex-col gap-3">
          {/* Document Tabs Strip */}
          <div className="flex items-center justify-between bg-white p-1 rounded-md border border-slate-200 shadow-xs">
            <div className="flex items-center gap-1 overflow-x-auto">
              {application.documents.length === 0 ? (
                <span className="text-xs text-slate-400 p-2 italic">No documents uploaded yet</span>
              ) : (
                application.documents.map((doc) => {
                  const isSelected = activeDoc.id === doc.id;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium transition-all ${
                        isSelected
                          ? 'bg-blue-700 text-white shadow-xs'
                          : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[140px] uppercase text-[11px]">
                        {doc.documentType}
                      </span>
                      {doc.verificationStatus === 'VERIFIED' && (
                        <Check className="w-3 h-3 text-emerald-300 ml-0.5" />
                      )}
                      {doc.verificationStatus === 'DEFICIENT' && (
                        <AlertTriangle className="w-3 h-3 text-amber-300 ml-0.5" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Document Status Pill */}
            <div className="px-2">
              <Badge status={activeDoc.verificationStatus === 'VERIFIED' ? 'DOCUMENTS_VERIFIED' : activeDoc.verificationStatus === 'DEFICIENT' ? 'DOCUMENTS_PENDING' : 'UNDER_REVIEW'} size="sm">
                {activeDoc.verificationStatus}
              </Badge>
            </div>
          </div>

          {/* Viewport Canvas with Scanned Document Simulation */}
          <div className="bg-slate-900 rounded-md border border-slate-800 shadow-xs overflow-hidden flex flex-col relative min-h-[460px]">
            {/* Viewport Zoom & Control Toolbar */}
            <div className="h-10 bg-slate-950/80 backdrop-blur-xs border-b border-slate-800 px-3 flex items-center justify-between text-slate-300 select-none">
              <div className="text-xs font-mono text-slate-400 truncate">
                {activeDoc.originalFilename || 'Document_Preview.pdf'} • {(activeDoc.fileSizeBytes / 1024 / 1024).toFixed(2)} MB
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] px-1 text-slate-400">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(200, z + 15))}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <div className="h-3 w-px bg-slate-800 mx-1"></div>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* High-Fidelity Scanned Document Canvas */}
            <div className="flex-1 p-6 flex items-center justify-center overflow-auto bg-slate-950/50">
              <div
                style={{
                  transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out',
                }}
                className="w-full max-w-[500px] bg-white text-slate-900 p-6 rounded shadow-2xl border border-slate-300 font-sans select-text text-left"
              >
                {/* Simulated Official Tax / Income Statement Header */}
                <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start">
                  <div>
                    <div className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">
                      Form W-2 / Official Earnings Statement
                    </div>
                    <div className="text-base font-bold tracking-tight text-slate-900">
                      TAX YEAR 2025 WAGE & TAX STATEMENT
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                      OMB No. 1545-0008
                    </span>
                  </div>
                </div>

                {/* Form Boxes Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  <div className="border border-slate-300 p-2 rounded-xs bg-slate-50">
                    <span className="block text-[9px] font-mono text-slate-400 uppercase">
                      a. Employee Social Security Number
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {application.personal.taxIdMasked}
                    </span>
                  </div>
                  <div className="border border-slate-300 p-2 rounded-xs bg-slate-50">
                    <span className="block text-[9px] font-mono text-slate-400 uppercase">
                      b. Employer Identification Number (EIN)
                    </span>
                    <span className="font-mono font-bold text-slate-800">94-3829104</span>
                  </div>
                </div>

                <div className="border border-slate-300 p-2.5 rounded-xs mb-3">
                  <span className="block text-[9px] font-mono text-slate-400 uppercase">
                    c. Employer Name & Registered Address
                  </span>
                  <div className="font-semibold text-slate-900">
                    {application.financial.employerName}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    100 Innovation Way, Suite 400, Industrial District
                  </div>
                </div>

                <div className="border border-slate-300 p-2.5 rounded-xs mb-4">
                  <span className="block text-[9px] font-mono text-slate-400 uppercase">
                    e. Employee Full Legal Name
                  </span>
                  <div className="font-semibold text-slate-900">
                    {application.personal.fullName}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {application.personal.residentialAddress}
                  </div>
                </div>

                {/* Financial Boxes */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="border border-blue-200 bg-blue-50/50 p-2.5 rounded-xs">
                    <span className="block text-[9px] font-mono text-blue-700 uppercase font-semibold">
                      1. Wages, tips, other compensation
                    </span>
                    <span className="text-base font-bold font-mono text-blue-900">
                      ₹{(application.financial.grossMonthlyIncome * 12).toLocaleString('en-IN')}.00
                    </span>
                    <span className="block text-[10px] text-blue-600 mt-0.5">
                      = ₹{application.financial.grossMonthlyIncome.toLocaleString('en-IN')} / mo
                    </span>
                  </div>
                  <div className="border border-slate-300 p-2.5 rounded-xs">
                    <span className="block text-[9px] font-mono text-slate-500 uppercase font-semibold">
                      2. Federal income tax withheld
                    </span>
                    <span className="text-base font-bold font-mono text-slate-800">
                      ₹{Math.round(application.financial.grossMonthlyIncome * 12 * 0.22).toLocaleString('en-IN')}.00
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Extracted Data OCR Telemetry Overlay Bar (From Stitch Reference) */}
            <div className="bg-slate-900/90 border-t border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between text-xs font-mono text-slate-300">
              <div className="flex items-center gap-3">
                <span className="text-slate-400">Detected Wages:</span>
                <span className="text-emerald-400 font-bold">
                  ₹{application.financial.grossMonthlyIncome.toLocaleString('en-IN')}/mo
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">Employer:</span>
                <span className="text-slate-200">{application.financial.employerName}</span>
              </div>
              <div className="inline-flex items-center gap-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded text-[11px]">
                <Check className="w-3 h-3" />
                <span>Auto-match: 98.4% Confidence</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Verification Checklist & Adjudication Controls (5 Cols) */}
        <div className="col-span-12 xl:col-span-5 flex flex-col gap-3">
          {/* Active Checklist Panel */}
          <div className="bg-white rounded-md border border-slate-200 shadow-xs p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Verification Checklist</h3>
                <p className="text-[11px] text-slate-500">
                  Audit-logged compliance requirements for {application.product.name}
                </p>
              </div>
              <span className="text-xs font-mono text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                Checklist v1.2
              </span>
            </div>

            {/* Checklist Items */}
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    1. Identity & Government ID Validation
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Matches name, photo, and SSN {application.personal.taxIdMasked}.
                  </div>
                </div>
                <Button
                  variant="success"
                  size="sm"
                  onClick={handleVerifyCurrentDoc}
                  icon={<Check className="w-3.5 h-3.5" />}
                >
                  Verified
                </Button>
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    2. Income Proof & Tax Alignment
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Salary earnings of ₹{(application.financial.grossMonthlyIncome * 12).toLocaleString('en-IN')}/yr align with declared income.
                  </div>
                </div>
                <Button
                  variant="success"
                  size="sm"
                  onClick={handleVerifyCurrentDoc}
                  icon={<Check className="w-3.5 h-3.5" />}
                >
                  Verified
                </Button>
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    3. 90-Day Bank Statement Continuity
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Consecutive deposits with zero overdraft notices in past 3 months.
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeficientCurrentDoc}
                  icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                >
                  Flag Check
                </Button>
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    4. Active Employer Confirmation
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Verified employment at {application.financial.employerName} ({application.financial.yearsEmployed} yrs).
                  </div>
                </div>
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 font-medium">
                  PASSED
                </span>
              </div>
            </div>

            {/* Officer Audit Notes Input */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Add Adjudication Note (Audit Logged)
              </label>
              <textarea
                rows={2}
                value={activeOfficerNotes}
                onChange={(e) => setActiveOfficerNotes(e.target.value)}
                placeholder="Enter regulatory verification comments for underwriter..."
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white"
              ></textarea>
              <div className="flex justify-end mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!activeOfficerNotes.trim()}
                  onClick={() => {
                    verifyDocument(
                      application.id,
                      activeDoc.id,
                      activeDoc.verificationStatus === 'DEFICIENT' ? 'DEFICIENT' : 'VERIFIED',
                      activeOfficerNotes
                    );
                    setActiveOfficerNotes('');
                  }}
                  icon={<Send className="w-3 h-3" />}
                >
                  Append Note to Docket
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Financial Snapshot Card */}
          <div className="bg-white rounded-md border border-slate-200 shadow-xs p-4">
            <h4 className="text-xs font-mono uppercase font-semibold text-slate-500 tracking-wider mb-3">
              Declared vs Verified Metrics
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block font-mono">Gross Monthly</span>
                <span className="text-sm font-bold font-mono text-slate-900">
                  {formatCurrency(application.financial.grossMonthlyIncome)}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block font-mono">Existing Debt</span>
                <span className="text-sm font-bold font-mono text-slate-900">
                  {formatCurrency(application.financial.existingMonthlyDebt)}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block font-mono">Declared Credit</span>
                <span className="text-sm font-bold font-mono text-emerald-700">
                  {application.financial.creditScoreDeclared} (Prime)
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block font-mono">Housing Obligation</span>
                <span className="text-sm font-bold font-mono text-slate-900">
                  {formatCurrency(application.financial.housingExpense)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deficiency / Clarification Modal */}
      <Modal
        isOpen={isClarificationModalOpen}
        onClose={() => setIsClarificationModalOpen(false)}
        title="Request Document Clarification or Re-upload"
        description={`Flagging ${activeDoc.documentType} for application ${application.referenceNumber}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsClarificationModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmDeficiency}>
              Flag Deficient & Notify Borrower
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Deficiency Reason Code
            </label>
            <select
              value={clarificationReason}
              onChange={(e) => setClarificationReason(e.target.value)}
              className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="BLURRY_OR_ILLEGIBLE">Blurry or Illegible Scanned File</option>
              <option value="EXPIRED_DOCUMENT">Document Expired or Outdated</option>
              <option value="NAME_MISMATCH">Name or Identifier Mismatch</option>
              <option value="MISSING_PAGES">Missing Pages or Incomplete Statement</option>
              <option value="SUSPECTED_TAMPERING">Formatting Discrepancy / Integrity Flag</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Specific Instructions to Applicant
            </label>
            <textarea
              rows={3}
              value={clarificationNotes}
              onChange={(e) => setClarificationNotes(e.target.value)}
              placeholder="e.g. Please upload pages 1 through 4 of your December bank statement showing full employer deposit stamps."
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
            ></textarea>
          </div>
        </div>
      </Modal>
    </div>
  );
};
