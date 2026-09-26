import React from 'react';
import type { ApplicationStatus } from '../../types';

interface BadgeProps {
  children?: React.ReactNode;
  status?: ApplicationStatus | 'LOW' | 'MEDIUM' | 'HIGH' | 'PASS' | 'FLAG' | 'FAIL' | 'ACTIVE';
  variant?: 'draft' | 'review' | 'pending' | 'verified' | 'approved' | 'rejected' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  status,
  variant,
  size = 'md',
  className = '',
}) => {
  let badgeText = children;
  let bgClasses = 'bg-slate-100 text-slate-700 border-slate-300';

  if (status) {
    switch (status) {
      case 'DRAFT':
        badgeText = badgeText || 'Draft';
        bgClasses = 'bg-slate-100 text-slate-600 border-slate-300';
        break;
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        badgeText = badgeText || (status === 'SUBMITTED' ? 'Submitted' : 'Under Review');
        bgClasses = 'bg-amber-50 text-amber-700 border-amber-300';
        break;
      case 'DOCUMENTS_PENDING':
        badgeText = badgeText || 'Docs Pending';
        bgClasses = 'bg-orange-50 text-orange-700 border-orange-300';
        break;
      case 'DOCUMENTS_VERIFIED':
        badgeText = badgeText || 'Docs Verified';
        bgClasses = 'bg-blue-50 text-blue-700 border-blue-300';
        break;
      case 'RISK_ASSESSED':
        badgeText = badgeText || 'Risk Assessed';
        bgClasses = 'bg-indigo-50 text-indigo-700 border-indigo-300';
        break;
      case 'APPROVED':
      case 'DISBURSED':
        badgeText = badgeText || (status === 'APPROVED' ? 'Approved' : 'Disbursed');
        bgClasses = 'bg-emerald-50 text-emerald-700 border-emerald-300';
        break;
      case 'REJECTED':
      case 'CANCELLED':
        badgeText = badgeText || (status === 'REJECTED' ? 'Rejected' : 'Cancelled');
        bgClasses = 'bg-rose-50 text-rose-700 border-rose-300';
        break;
      case 'LOW':
      case 'PASS':
        badgeText = badgeText || status;
        bgClasses = 'bg-emerald-50 text-emerald-700 border-emerald-300 font-mono';
        break;
      case 'MEDIUM':
      case 'FLAG':
        badgeText = badgeText || status;
        bgClasses = 'bg-amber-50 text-amber-700 border-amber-300 font-mono';
        break;
      case 'HIGH':
      case 'FAIL':
        badgeText = badgeText || status;
        bgClasses = 'bg-rose-50 text-rose-700 border-rose-300 font-mono';
        break;
    }
  } else if (variant) {
    switch (variant) {
      case 'approved':
        bgClasses = 'bg-emerald-50 text-emerald-700 border-emerald-300';
        break;
      case 'review':
        bgClasses = 'bg-amber-50 text-amber-700 border-amber-300';
        break;
      case 'pending':
        bgClasses = 'bg-orange-50 text-orange-700 border-orange-300';
        break;
      case 'verified':
        bgClasses = 'bg-blue-50 text-blue-700 border-blue-300';
        break;
      case 'rejected':
        bgClasses = 'bg-rose-50 text-rose-700 border-rose-300';
        break;
      default:
        bgClasses = 'bg-slate-100 text-slate-700 border-slate-300';
    }
  }

  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded border ${sizeClasses} ${bgClasses} ${className}`}
    >
      {badgeText}
    </span>
  );
};
