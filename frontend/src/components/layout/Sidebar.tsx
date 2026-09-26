import React from 'react';
import {
  CheckSquare,
  Activity,
  UserCheck,
  Shield,
  Layers,
  Building2,
  FileCheck2,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/financial';

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView, applications, activeApplicationId, resetAllData } = useApp();

  const activeApp = applications.find((a) => a.id === activeApplicationId) || applications[0];

  const navItems = [
    {
      group: 'Underwriting Rails',
      items: [
        { id: 'officer-queue', label: 'Officer Queue', icon: CheckSquare },
        { id: 'document-workbench', label: 'Document Workbench', icon: FileCheck2 },
        { id: 'underwriting-cockpit', label: 'Underwriting Cockpit', icon: Activity },
        { id: 'borrower-portal', label: 'Borrower Portal', icon: UserCheck },
      ],
    },
    {
      group: 'Audit & Governance',
      items: [
        { id: 'compliance-audit', label: 'Compliance Audit', icon: Shield },
        { id: 'loan-products', label: 'Loan Products', icon: Layers },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 shrink-0 flex flex-col h-screen fixed left-0 top-0 z-30 select-none">
      {/* Brand Header */}
      <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-700 text-white flex items-center justify-center rounded shadow-xs">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-slate-900 leading-none">LAPS</div>
            <div className="text-[10px] font-mono tracking-wider text-slate-500 uppercase mt-0.5">
              Adjudication Hub
            </div>
          </div>
        </div>
      </div>

      {/* Active File Telemetry Card (From Stitch Reference) */}
      <div className="px-3.5 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          <span>Active Docket</span>
          <span className="flex items-center gap-1 text-emerald-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ACTIVE
          </span>
        </div>
        <div className="font-mono text-xs font-bold text-blue-700 mt-1 truncate">
          {activeApp.referenceNumber}
        </div>
        <div className="text-xs text-slate-600 truncate mt-0.5 font-medium">
          {activeApp.personal.fullName}
        </div>
        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
          {formatCurrency(activeApp.requestedAmount)} • {activeApp.product.name}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navItems.map((group) => (
          <div key={group.group}>
            <div className="px-2 pb-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-600">
              {group.group}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Regulatory & Reset Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/50 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>TIER 1 CAPITAL ADQ</span>
          <span className="text-emerald-700 font-semibold">PASS (14.2%)</span>
        </div>
        <button
          onClick={resetAllData}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded border border-slate-200 transition-colors"
          title="Reset to original mock database state"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Reset Demo Data</span>
        </button>
      </div>
    </aside>
  );
};
