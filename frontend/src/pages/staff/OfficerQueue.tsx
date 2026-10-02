import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Search,
  ExternalLink,
  TrendingUp,
  FileCheck2,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { AnimatedCounter } from '../../components/ui/AnimatedCounter';
import { formatCurrency, formatDateTime } from '../../utils/financial';
import { tableRowVariants } from '../../utils/motion';

export const OfficerQueue: React.FC = () => {
  const {
    applications,
    setActiveApplicationId,
    setActiveView,
    setSelectedDocId,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const shouldReduceMotion = useReducedMotion();

  // KPI Metrics
  const totalCount = applications.length;
  const underReviewCount = applications.filter(
    (a) => a.status === 'UNDER_REVIEW' || a.status === 'SUBMITTED'
  ).length;
  const readyForRiskCount = applications.filter((a) => a.status === 'DOCUMENTS_VERIFIED').length;
  const approvedCount = applications.filter(
    (a) => a.status === 'APPROVED' || a.status === 'DISBURSED'
  ).length;

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.personal.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.product.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'ACTIVE_TRIAGE'
        ? ['SUBMITTED', 'UNDER_REVIEW', 'DOCUMENTS_PENDING'].includes(app.status)
        : app.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleOpenWorkbench = (appId: string) => {
    setActiveApplicationId(appId);
    const targetApp = applications.find((a) => a.id === appId);
    if (targetApp && targetApp.documents.length > 0) {
      setSelectedDocId(targetApp.documents[0].id);
    }
    setActiveView('document-workbench');
  };

  const handleOpenCockpit = (appId: string) => {
    setActiveApplicationId(appId);
    setActiveView('underwriting-cockpit');
  };

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Adjudication & Verification Queue
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Incoming retail & commercial loan applications awaiting officer triage and verification.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveView('borrower-portal')}
            icon={<ExternalLink className="w-3.5 h-3.5" />}
          >
            Borrower Portal View
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards with Animated Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          whileHover={!shouldReduceMotion ? { y: -2 } : undefined}
          className="bg-white dark:bg-slate-900 p-4 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs transition-shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Total Inbound Docket</span>
            <TrendingUp className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-2">
            <AnimatedCounter value={totalCount} duration={0.6} />
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Active institutional portfolio</div>
        </motion.div>

        <motion.div
          whileHover={!shouldReduceMotion ? { y: -2 } : undefined}
          className="bg-white dark:bg-slate-900 p-4 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs transition-shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Pending Document Triage</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-2">
            <AnimatedCounter value={underReviewCount} duration={0.6} />
          </div>
          <div className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1">Awaiting KYC checklist signoff</div>
        </motion.div>

        <motion.div
          whileHover={!shouldReduceMotion ? { y: -2 } : undefined}
          className="bg-white dark:bg-slate-900 p-4 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs transition-shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Ready for Underwriting</span>
            <FileCheck2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-orange-600 dark:text-orange-400 mt-2">
            <AnimatedCounter value={readyForRiskCount} duration={0.6} />
          </div>
          <div className="text-[11px] text-orange-600/80 dark:text-orange-400/80 mt-1">Documents 100% certified</div>
        </motion.div>

        <motion.div
          whileHover={!shouldReduceMotion ? { y: -2 } : undefined}
          className="bg-white dark:bg-slate-900 p-4 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs transition-shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Sanctioned / Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-2">
            <AnimatedCounter value={approvedCount} duration={0.6} />
          </div>
          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">Decisions completed</div>
        </motion.div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 transition-colors">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Reference ID, Applicant, or Product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
          />
        </div>

        {/* Filter Pills with gliding indicator */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs relative">
          <span className="text-slate-400 mr-1 text-[11px] font-mono">STATUS:</span>
          {[
            { id: 'ALL', label: 'All Files' },
            { id: 'ACTIVE_TRIAGE', label: 'In Triage' },
            { id: 'DOCUMENTS_VERIFIED', label: 'Docs Verified' },
            { id: 'RISK_ASSESSED', label: 'Risk Evaluated' },
            { id: 'APPROVED', label: 'Approved' },
          ].map((pill) => {
            const isSelected = statusFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setStatusFilter(pill.id)}
                className={`relative px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-700/80'
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId={shouldReduceMotion ? undefined : 'queue-filter-pill'}
                    className="absolute inset-0 bg-orange-600 rounded shadow-xs"
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
                <span className="relative z-10">{pill.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* High-Density Applications Table */}
      <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4">Ref Docket</th>
                <th className="py-2.5 px-4">Applicant & Contact</th>
                <th className="py-2.5 px-4">Product Category</th>
                <th className="py-2.5 px-4 text-right">Requested</th>
                <th className="py-2.5 px-4 text-center">DTI / Risk</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4">Assigned Staff</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No applications match criteria</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try adjusting your filters or search query.</p>
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app) => (
                  <motion.tr
                    key={app.id}
                    variants={shouldReduceMotion ? undefined : tableRowVariants}
                    initial="initial"
                    animate="animate"
                    className="hover:bg-orange-50/40 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                    onClick={() => handleOpenWorkbench(app.id)}
                  >
                    {/* Ref Docket */}
                    <td className="py-3 px-4 font-mono font-semibold text-orange-600 dark:text-orange-400">
                      {app.referenceNumber}
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                        {formatDateTime(app.submittedAt || app.createdAt)}
                      </div>
                    </td>

                    {/* Applicant & Contact */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{app.personal.fullName}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {app.personal.taxIdMasked} • {app.personal.phone}
                      </div>
                    </td>

                    {/* Product */}
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      <div className="font-medium truncate max-w-[160px]">{app.product.name}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">APR: {app.product.baseApr}%</div>
                    </td>

                    {/* Requested Amount & Tenor */}
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(app.requestedAmount)}
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
                        {app.requestedTenorMonths} Mos Tenor
                      </div>
                    </td>

                    {/* DTI / Risk */}
                    <td className="py-3 px-4 text-center">
                      {app.riskAssessment ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {app.riskAssessment.calculatedDti}% DTI
                          </span>
                          <Badge status={app.riskAssessment.riskTier} size="sm" className="mt-0.5" />
                        </div>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 italic">Unassessed</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <Badge status={app.status} />
                    </td>

                    {/* Assigned Staff */}
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-medium text-[11px]">
                      {app.assignedOfficerName || 'Unassigned'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenWorkbench(app.id)}
                      >
                        Workbench
                      </Button>
                      {(app.status === 'DOCUMENTS_VERIFIED' || app.status === 'RISK_ASSESSED') && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenCockpit(app.id)}
                        >
                          Underwrite
                        </Button>
                      )}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
