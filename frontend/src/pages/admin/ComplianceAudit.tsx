import React, { useState } from 'react';
import { Search, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDateTime } from '../../utils/financial';

export const ComplianceAudit: React.FC = () => {
  const { auditLogs, applications } = useApp();
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = auditLogs.filter((log) => {
    const matchesFilter = filterType === 'ALL' || log.eventType === filterType;
    const matchesSearch =
      log.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.notes && log.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.applicationId && log.applicationId.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-md border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-700 font-semibold mb-1">
            <Lock className="w-3.5 h-3.5" />
            <span>IMMUTABLE WRITE-ONCE AUDIT TRAIL</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Regulatory Compliance & Event Journal
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-proof record capturing every actor action, status mutation, document signoff, and underwriter decision.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[11px] font-mono text-slate-500 bg-slate-50 px-3 py-1.5 rounded border border-slate-200">
            Total Audited Events: <span className="font-bold text-slate-900">{auditLogs.length}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 rounded-md border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Actor Name, Application ID, or remarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto text-xs font-mono">
          <span className="text-slate-400 mr-1 text-[11px]">EVENT:</span>
          {['ALL', 'STATE_TRANSITION', 'DOCUMENT_VERIFIED', 'RISK_ASSESSED', 'DECISION_RECORDED'].map(
            (t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                  filterType === t
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            )
          )}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-md border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-4">Timestamp (UTC)</th>
                <th className="py-2.5 px-4">Event Type</th>
                <th className="py-2.5 px-4">Actor & Role</th>
                <th className="py-2.5 px-4">Application Docket</th>
                <th className="py-2.5 px-4">State Transition</th>
                <th className="py-2.5 px-4">Audit Record Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredLogs.map((log) => {
                const targetApp = applications.find((a) => a.id === log.applicationId);
                return (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Timestamp */}
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>

                    {/* Event Type */}
                    <td className="py-2.5 px-4">
                      <span className="font-mono text-[11px] font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-800 border border-slate-200">
                        {log.eventType}
                      </span>
                    </td>

                    {/* Actor */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{log.actorName}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {log.actorRole}
                      </div>
                    </td>

                    {/* Application Docket */}
                    <td className="py-2.5 px-4 font-mono text-orange-600 font-medium">
                      {targetApp ? targetApp.referenceNumber : log.applicationId || 'SYSTEM'}
                    </td>

                    {/* State Transition */}
                    <td className="py-2.5 px-4 font-mono text-[11px] whitespace-nowrap">
                      {log.beforeState && log.afterState ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">{log.beforeState}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-orange-600 font-semibold">{log.afterState}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    {/* Audit Details */}
                    <td className="py-2.5 px-4 text-slate-700 text-xs max-w-[340px] truncate">
                      {log.notes || 'Routine lifecycle mutation recorded'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
