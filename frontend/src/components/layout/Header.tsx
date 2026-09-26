import { Lock, Bell, User as UserIcon, Home, LogOut } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { UserRole } from '../../types';

export const Header: React.FC = () => {
  const { currentUser, currentRole, switchRole, applications, activeApplicationId, setActiveView } = useApp();

  const activeApp = applications.find((a) => a.id === activeApplicationId) || applications[0];

  const roles: { role: UserRole; label: string }[] = [
    { role: 'LOAN_OFFICER', label: 'Loan Officer' },
    { role: 'RISK_ANALYST', label: 'Risk Analyst' },
    { role: 'APPLICANT', label: 'Applicant' },
    { role: 'ADMIN', label: 'Admin' },
  ];

  return (
    <header className="fixed top-0 left-64 right-0 z-20 bg-white border-b border-slate-200 h-14 flex items-center justify-between px-6 select-none">
      {/* Left: Active File Breadcrumb & Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
          <span className="font-mono text-xs font-semibold text-slate-800 uppercase">
            {activeApp.referenceNumber}
          </span>
          <span className="text-[11px] text-slate-500 font-mono">({activeApp.status})</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Auto-synced</span>
        </div>
      </div>

      {/* Center: Interactive Role Switcher Bar */}
      <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-md border border-slate-200 gap-0.5">
        <span className="text-[10px] font-mono uppercase text-slate-600 px-2 font-semibold">
          Role Persona:
        </span>
        {roles.map((r) => {
          const isCurrent = currentRole === r.role;
          return (
            <button
              key={r.role}
              onClick={() => switchRole(r.role)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                isCurrent
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Right: Security, Notifications, User */}
      <div className="flex items-center gap-3.5">
        <div className="hidden md:flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>256-BIT ENCRYPTED</span>
        </div>

        <button
          onClick={() => setActiveView('landing')}
          className="flex items-center gap-1 text-xs text-slate-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
          title="Return to Public Landing Page"
        >
          <Home className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Public Site</span>
        </button>

        <button
          aria-label="System Notifications"
          className="relative p-1.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white"></span>
        </button>

        <div className="h-4 w-px bg-slate-200"></div>

        {/* User Card */}
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-900 leading-tight">
              {currentUser.fullName}
            </div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              {currentUser.role.replace('_', ' ')}
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center font-medium shadow-xs">
            <UserIcon className="w-4 h-4" />
          </div>
          <button
            onClick={() => setActiveView('login')}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition-colors"
            title="Sign Out / Switch Account"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
