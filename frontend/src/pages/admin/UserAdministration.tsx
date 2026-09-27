import React, { useState, useMemo } from 'react';
import { UserPlus, CheckCircle2, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { DataTable, type Column } from '../../components/ui/DataTable';
import type { User, UserRole } from '../../types';

export const UserAdministration: React.FC = () => {
  const { users, addUser, updateUser } = useApp();

  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New User Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('LOAN_OFFICER');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Metrics
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.isActive).length;
  const officerCount = users.filter((u) => u.role === 'LOAN_OFFICER').length;
  const analystCount = users.filter((u) => u.role === 'RISK_ANALYST').length;

  const handleOpenCreateModal = () => {
    setFullName('');
    setEmail('');
    setRole('LOAN_OFFICER');
    setPhone('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleSaveUser = () => {
    if (!fullName.trim() || !email.trim()) return;
    addUser({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      role,
      phone: phone.trim() || undefined,
      isActive,
    });
    setIsModalOpen(false);
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
          ? user.isActive
          : !user.isActive;
      return matchesRole && matchesStatus;
    });
  }, [users, roleFilter, statusFilter]);

  const columns: Column<User>[] = [
    {
      key: 'fullName',
      header: 'User Identity',
      sortable: true,
      sortValue: (u) => u.fullName,
      render: (u) => (
        <div>
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            {u.fullName}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Assigned Role',
      sortable: true,
      sortValue: (u) => u.role,
      render: (u) => {
        const roleColors: Record<UserRole, string> = {
          ADMIN: 'bg-purple-50 text-purple-700 border-purple-300',
          LOAN_OFFICER: 'bg-blue-50 text-blue-700 border-blue-300',
          RISK_ANALYST: 'bg-orange-50 text-orange-700 border-orange-300',
          APPLICANT: 'bg-slate-100 text-slate-700 border-slate-300',
        };
        return (
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              roleColors[u.role] || 'bg-slate-100 text-slate-700'
            }`}
          >
            {u.role.replace('_', ' ')}
          </span>
        );
      },
    },
    {
      key: 'phone',
      header: 'Direct Phone',
      render: (u) => (
        <span className="font-mono text-[11px] text-slate-600">
          {u.phone || '—'}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      sortValue: (u) => (u.isActive ? 1 : 0),
      render: (u) => (
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
            u.isActive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : 'bg-rose-50 text-rose-700 border-rose-300'
          }`}
        >
          {u.isActive ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ACTIVE
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3 text-rose-500" /> SUSPENDED
            </>
          )}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Permissions & Actions',
      render: (u) => (
        <div className="flex items-center gap-2">
          {/* Role selector */}
          <select
            value={u.role}
            onChange={(e) => updateUser(u.id, { role: e.target.value as UserRole })}
            aria-label={`Change role for ${u.fullName}`}
            className="text-[11px] font-mono py-1 px-1.5 bg-slate-50 border border-slate-200 rounded font-medium text-slate-700 hover:bg-white cursor-pointer"
          >
            <option value="APPLICANT">APPLICANT</option>
            <option value="LOAN_OFFICER">LOAN_OFFICER</option>
            <option value="RISK_ANALYST">RISK_ANALYST</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          {/* Toggle status */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateUser(u.id, { isActive: !u.isActive })}
          >
            {u.isActive ? 'Suspend' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-md border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-mono uppercase text-orange-600 font-semibold tracking-wider">
            Identity & Access Management (RBAC)
          </span>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">
            User Administration & System Roles
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Provision staff profiles, assign cryptographic roles, and manage active session authorization policies.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenCreateModal}
          icon={<UserPlus className="w-4 h-4" />}
        >
          Add System User
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-md border border-slate-200 shadow-xs">
          <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
            Total Identities
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {totalCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Configured profiles</div>
        </div>

        <div className="bg-white p-4 rounded-md border border-slate-200 shadow-xs">
          <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
            Active Accounts
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
            {activeCount}
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Authorized for login</div>
        </div>

        <div className="bg-white p-4 rounded-md border border-slate-200 shadow-xs">
          <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
            Loan Officers
          </div>
          <div className="text-2xl font-bold font-mono text-blue-600 mt-1">
            {officerCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Triage & verification</div>
        </div>

        <div className="bg-white p-4 rounded-md border border-slate-200 shadow-xs">
          <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
            Risk Analysts
          </div>
          <div className="text-2xl font-bold font-mono text-orange-600 mt-1">
            {analystCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Underwriting cockpits</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3 rounded-md border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto font-mono">
          <span className="text-slate-400 text-[11px] mr-1">ROLE:</span>
          {['ALL', 'LOAN_OFFICER', 'RISK_ANALYST', 'APPLICANT', 'ADMIN'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                roleFilter === r
                  ? 'bg-orange-600 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 font-mono">
          <span className="text-slate-400 text-[11px] mr-1">STATUS:</span>
          {['ALL', 'ACTIVE', 'INACTIVE'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                statusFilter === s
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* User Data Table */}
      <DataTable
        columns={columns}
        data={filteredUsers}
        rowKey={(u) => u.id}
        searchable
        searchPlaceholder="Search users by name, email, or role..."
        searchFilter={(u, q) =>
          u.fullName.toLowerCase().includes(q.toLowerCase()) ||
          u.email.toLowerCase().includes(q.toLowerCase()) ||
          u.role.toLowerCase().includes(q.toLowerCase())
        }
      />

      {/* Create User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        maxWidth="md"
        title="Register New System Identity"
        description="Provision access credentials and assign role permissions across the CredVidhi platform."
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveUser}>
              Provision User
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Rachel Adams"
            required
          />

          <Input
            label="Official Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. r.adams@credvidhi.com"
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider mb-1">
                System Role (RBAC)
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded font-medium"
              >
                <option value="LOAN_OFFICER">Loan Officer (Triage & KYC)</option>
                <option value="RISK_ANALYST">Risk Analyst (Underwriting)</option>
                <option value="APPLICANT">Borrower / Applicant</option>
                <option value="ADMIN">System Administrator</option>
              </select>
            </div>

            <Input
              label="Contact Phone (Optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-800 block">Initial Account Status</span>
              <span className="text-[11px] text-slate-400">
                Determines whether user can authenticate immediately
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`text-xs px-3 py-1.5 rounded border font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-slate-100 text-slate-500 border-slate-300'
              }`}
            >
              {isActive ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5" /> Suspended
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
