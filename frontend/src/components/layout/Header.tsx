import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Lock, Bell, User as UserIcon, Home, LogOut, Sun, Moon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { UserRole } from '../../types';

export const Header: React.FC = () => {
  const {
    currentUser,
    currentRole,
    switchRole,
    applications,
    activeApplicationId,
    setActiveView,
    auditLogs,
    isBackendConnected,
    isSyncing,
    refreshFromBackend,
    theme,
    toggleTheme,
  } = useApp();
  const shouldReduceMotion = useReducedMotion();
  const [showNotifications, setShowNotifications] = useState(false);

  const activeApp = applications.find((a) => a.id === activeApplicationId) || applications[0] || {
    referenceNumber: 'CV-STANDBY',
    status: 'DRAFT',
  };

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
        <button
          disabled={isSyncing}
          aria-label={
            isBackendConnected
              ? 'Connected to FastAPI backend. Click to re-sync.'
              : 'Operating in Local Mode. Click to probe backend.'
          }
          onClick={() => {
            if (!isSyncing) void refreshFromBackend();
          }}
          title={
            isBackendConnected
              ? 'Connected to FastAPI REST Backend (:8000). Click to re-sync.'
              : 'Operating in Local Autonomous Engine Mode. Click to probe backend.'
          }
          className={`flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded transition-colors ${
            isSyncing ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
          } ${
            isBackendConnected
              ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
              : 'text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isBackendConnected
                ? isSyncing
                  ? 'bg-emerald-400 animate-ping'
                  : 'bg-emerald-500 animate-pulse'
                : 'bg-slate-400'
            }`}
          />
          <span>{isBackendConnected ? (isSyncing ? 'Syncing...' : 'Live API') : 'Local Mode'}</span>
        </button>
      </div>

      {/* Center: Interactive Role Switcher Bar with gliding pill */}
      <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-md border border-slate-200 gap-0.5 relative">
        <span className="text-[10px] font-mono uppercase text-slate-600 px-2 font-semibold">
          Role Persona:
        </span>
        {roles.map((r) => {
          const isCurrent = currentRole === r.role;
          return (
            <button
              key={r.role}
              onClick={() => switchRole(r.role)}
              className={`relative px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                isCurrent
                  ? 'text-orange-600 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {isCurrent && (
                <motion.div
                  layoutId={shouldReduceMotion ? undefined : 'active-role-pill'}
                  className="absolute inset-0 bg-white rounded shadow-xs"
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <span className="relative z-10">{r.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Security, Notifications, User */}
      <div className="flex items-center gap-3.5 relative">
        <div className="hidden md:flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>256-BIT ENCRYPTED</span>
        </div>

        <motion.button
          whileHover={!shouldReduceMotion ? { scale: 1.02 } : undefined}
          whileTap={!shouldReduceMotion ? { scale: 0.98 } : undefined}
          onClick={() => setActiveView('landing')}
          className="flex items-center gap-1 text-xs text-slate-600 hover:text-orange-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          title="Return to Public Landing Page"
        >
          <Home className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Public Site</span>
        </motion.button>

        {/* Notifications Popover Trigger */}
        <div className="relative">
          <motion.button
            whileHover={!shouldReduceMotion ? { scale: 1.05 } : undefined}
            whileTap={!shouldReduceMotion ? { scale: 0.95 } : undefined}
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="System Notifications"
            className="relative p-1.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-600 ring-2 ring-white"></span>
          </motion.button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-10 w-80 bg-white rounded-lg border border-slate-200 shadow-xl p-3 z-50 select-none"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                  <span className="text-xs font-semibold text-slate-900">Recent Audit Stream</span>
                  <span className="text-[10px] font-mono text-emerald-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live
                  </span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {auditLogs.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">No recent audit activity.</p>
                  ) : (
                    auditLogs.slice(0, 4).map((log) => (
                      <div key={log.id} className="text-left p-2 rounded bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                          <span className="font-semibold text-orange-600 truncate">{log.eventType}</span>
                          <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-xs text-slate-700 mt-0.5 line-clamp-2 leading-relaxed">{log.notes}</p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Theme Toggle Button */}
        <motion.button
          whileHover={!shouldReduceMotion ? { scale: 1.05 } : undefined}
          whileTap={!shouldReduceMotion ? { scale: 0.95 } : undefined}
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-1.5 text-slate-500 hover:text-orange-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </motion.button>

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
          <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-medium shadow-xs">
            <UserIcon className="w-4 h-4" />
          </div>
          <motion.button
            whileHover={!shouldReduceMotion ? { scale: 1.05 } : undefined}
            whileTap={!shouldReduceMotion ? { scale: 0.95 } : undefined}
            onClick={() => setActiveView('login')}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            title="Sign Out / Switch Account"
          >
            <LogOut className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </header>
  );
};
