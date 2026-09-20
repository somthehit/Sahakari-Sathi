import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Filter, Lock, Unlock, RefreshCw,
  Mail, Clock, CheckCircle2, AlertTriangle,
  Download, Key, Loader2, EyeOff, Eye, X, Pencil, UserPlus, Building2
} from 'lucide-react';
import { useCoop } from '../../../context/CoopContext';
import { useSuperAdminAuth } from '../../../stores/superAdminAuthStore';
import { superAdminApi } from '../../../lib/superAdminApi';

interface PlatformUser {
  id: string;
  username: string;
  email: string | null;
  emailVerified: boolean;
  authUserId: string | null;
  fullName: string | null;
  employeeCode: string | null;
  role: string | null;
  department: string | null;
  designation: string | null;
  status: string;
  requiresPasswordChange: boolean;
  twoFactor: number;
  lastLogin: string | null;
  orgCode: string | null;
  orgName: string | null;
}

const statusColors: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-800',
  Locked: 'bg-amber-100 text-amber-800',
  Suspended: 'bg-red-100 text-red-700',
  'Pending Activation': 'bg-indigo-100 text-indigo-800',
  Archived: 'bg-slate-100 text-slate-600',
};

export const PlatformUsersView: React.FC = () => {
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Edit modal
  const [editTarget, setEditTarget] = useState<PlatformUser | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', email: '', status: 'Active' });
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<PlatformUser | null>(null);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Create platform user modal
  const [showCreate, setShowCreate] = useState(false);
  const [orgs, setOrgs] = useState<{ id: string; organizationCode: string; organizationName: string }[]>([]);
  const [orgRoles, setOrgRoles] = useState<{ id: string; name: string }[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [createForm, setCreateForm] = useState({ organizationId: '', username: '', employeeEmail: '', temporaryPassword: '', confirmPassword: '', roleId: '' });
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [showCreatePw, setShowCreatePw] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await superAdminApi.getPlatformUsers(accessToken);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load platform users.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // Load orgs for dropdown when create modal is opened
  const openCreate = async () => {
    setCreateForm({ organizationId: '', username: '', employeeEmail: '', temporaryPassword: '', confirmPassword: '', roleId: '' });
    setOrgRoles([]);
    setCreateError('');
    setShowCreate(true);
    if (orgs.length === 0 && accessToken) {
      try {
        const data = await superAdminApi.getOrganizations(accessToken, { limit: 200 });
        setOrgs(Array.isArray(data?.organizations) ? data.organizations : Array.isArray(data) ? data : []);
      } catch { /* non-blocking */ }
    }
  };

  // Load roles when org selection changes
  const handleOrgChange = async (orgId: string) => {
    setCreateForm(p => ({ ...p, organizationId: orgId, roleId: '' }));
    setOrgRoles([]);
    if (!orgId || !accessToken) return;
    setRolesLoading(true);
    try {
      const data = await superAdminApi.getOrgRoles(accessToken, orgId);
      setOrgRoles(Array.isArray(data) ? data : []);
    } catch { /* non-blocking */ } finally {
      setRolesLoading(false);
    }
  };

  const filtered = users.filter(u => {
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (!search) return true;
    const t = search.toLowerCase();
    const name = (u.fullName || u.username || '').toLowerCase();
    return name.includes(t) || u.username.toLowerCase().includes(t) || (u.email || '').toLowerCase().includes(t) || (u.orgCode || '').toLowerCase().includes(t);
  });

  // Open edit modal
  const openEdit = (u: PlatformUser) => {
    setEditTarget(u);
    setEditForm({ fullName: u.fullName || '', email: u.email || '', status: u.status });
    setEditError('');
    setActiveMenu(null);
  };

  // Save edits
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError('');
    setEditLoading(true);
    try {
      await superAdminApi.updatePlatformUser(accessToken!, editTarget.id, editForm);
      setUsers(prev => prev.map(u => u.id === editTarget.id ? { ...u, ...editForm } : u));
      addNotification('User Updated', `${editForm.fullName || editTarget.username} updated successfully.`, 'success');
      setEditTarget(null);
    } catch (err: any) {
      setEditError(err.message || 'Update failed.');
    } finally {
      setEditLoading(false);
    }
  };

  // Toggle Active/Locked status
  const toggleStatus = async (u: PlatformUser) => {
    const newStatus = u.status === 'Active' ? 'Locked' : 'Active';
    try {
      await superAdminApi.updatePlatformUser(accessToken!, u.id, { status: newStatus });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status: newStatus } : x));
      addNotification('Status Updated', `${u.fullName || u.username} → ${newStatus}`, newStatus === 'Active' ? 'success' : 'warning');
    } catch (err: any) {
      addNotification('Update Failed', err.message, 'alert');
    }
    setActiveMenu(null);
  };

  // Open reset password modal
  const openReset = (u: PlatformUser) => {
    setResetTarget(u);
    setNewPw(''); setConfirmPw(''); setResetError('');
    setActiveMenu(null);
  };

  // Submit reset password
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError('');
    if (!newPw || newPw.length < 8) { setResetError('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setResetError('Passwords do not match.'); return; }
    setResetLoading(true);
    try {
      await superAdminApi.resetPlatformUserPassword(accessToken!, resetTarget.id, newPw);
      addNotification('Password Reset', `Password for "${resetTarget.username}" reset successfully.`, 'success');
      setResetTarget(null);
    } catch (err: any) {
      setResetError(err.message || 'Reset failed.');
    } finally {
      setResetLoading(false);
    }
  };

  // Submit create platform user
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!createForm.organizationId) { setCreateError('Please select an organization.'); return; }
    if (!createForm.username.trim()) { setCreateError('Username is required.'); return; }
    if (!createForm.employeeEmail.trim()) { setCreateError('Email is required.'); return; }
    if (!createForm.temporaryPassword || createForm.temporaryPassword.length < 8) { setCreateError('Password must be at least 8 characters.'); return; }
    if (createForm.temporaryPassword !== createForm.confirmPassword) { setCreateError('Passwords do not match.'); return; }
    setCreateLoading(true);
    try {
      await superAdminApi.createPlatformUser(accessToken!, {
        organizationId: createForm.organizationId,
        username: createForm.username.trim(),
        employeeEmail: createForm.employeeEmail.trim(),
        temporaryPassword: createForm.temporaryPassword,
        ...(createForm.roleId ? { roleId: createForm.roleId } : {}),
      });
      addNotification('User Created', `Account "@${createForm.username}" created successfully.`, 'success');
      setShowCreate(false);
      loadUsers();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create user.');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-5">      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <Users className="w-6 h-6 text-emerald-700" />
              <span>Platform Users</span>
              <span className="text-xs font-normal bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">{users.length} total</span>
            </h1>
            <p className="text-slate-500 text-xs mt-1">Manage all users across all organizations. Lock, reset, and inspect login history.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadUsers} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer">
              <Download className="w-4 h-4" /> Export
            </button>
            <button
              onClick={openCreate}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <UserPlus className="w-4 h-4" /> Add User
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
            <input type="text" placeholder="Search by name, username, email, or org..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-600 transition" />
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-transparent text-slate-700 font-medium outline-none cursor-pointer">
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Locked">Locked</option>
              <option value="Suspended">Suspended</option>
              <option value="Pending Activation">Pending Activation</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['User', 'Organization', 'Role', '2FA', 'Email', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-700 flex items-center justify-center text-white font-bold text-[11px] shrink-0">
                        {(u.fullName || u.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{u.fullName || u.username}</div>
                        <div className="text-slate-500 text-[11px]">@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-emerald-700 text-[11px]">{u.orgCode || '—'}</div>
                    <div className="text-slate-500 text-[11px] max-w-[120px] truncate">{u.orgName || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-700 font-medium">{u.role || '—'}</div>
                    {u.department && <div className="text-slate-500 text-[11px]">{u.department}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {(u.twoFactor ?? 0) >= 50
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      : <AlertTriangle className="w-4 h-4 text-slate-600" />}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {u.emailVerified
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        : <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      <span className="truncate max-w-[140px] text-slate-600">{u.email || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${statusColors[u.status] || 'bg-slate-100 text-slate-600'}`}>{u.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(u)} title="Edit" className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-500 transition cursor-pointer">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openReset(u)} title="Reset Password" className="p-1.5 hover:bg-amber-50 hover:text-amber-600 rounded-lg text-slate-500 transition cursor-pointer">
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleStatus(u)} title={u.status === 'Active' ? 'Lock Account' : 'Unlock Account'}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${u.status === 'Active' ? 'hover:bg-red-50 hover:text-red-500 text-slate-500' : 'hover:bg-emerald-50 hover:text-emerald-600 text-slate-500'}`}>
                        {u.status === 'Active' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">No platform users found.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">Loading platform users...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create Platform User Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Create Platform User</h2>
                  <p className="text-[10px] text-slate-500">Add a user to an existing organization</p>
                </div>
              </div>
              <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              {createError && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl px-3 py-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {createError}
                </div>
              )}

              {/* Organization */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Organization <span className="text-emerald-600">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                  <select
                    value={createForm.organizationId}
                    onChange={e => handleOrgChange(e.target.value)}
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 transition appearance-none cursor-pointer"
                  >
                    <option value="">— Select organization —</option>
                    {orgs.map(o => (
                      <option key={o.id} value={o.id}>{o.organizationCode} · {o.organizationName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Username <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={e => setCreateForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                  placeholder="e.g. john.doe"
                  className="w-full bg-slate-50 border placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
                  autoFocus
                />
                <p className="text-[10px] text-slate-500 mt-1">Lowercase, no spaces. Will be used for login.</p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Email <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="email"
                  value={createForm.employeeEmail}
                  onChange={e => setCreateForm(p => ({ ...p, employeeEmail: e.target.value }))}
                  placeholder="user@organization.com"
                  className="w-full bg-slate-50 border placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Role
                </label>
                <select
                  value={createForm.roleId}
                  onChange={e => setCreateForm(p => ({ ...p, roleId: e.target.value }))}
                  disabled={!createForm.organizationId || rolesLoading}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 transition disabled:opacity-60 disabled:cursor-not-allowed appearance-none cursor-pointer"
                >
                  <option value="">
                    {!createForm.organizationId ? '— Select an organization first —' : rolesLoading ? 'Loading roles…' : orgRoles.length === 0 ? '— No roles found —' : '— Select role (optional) —'}
                  </option>
                  {orgRoles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                {createForm.organizationId && orgRoles.length === 0 && !rolesLoading && (
                  <p className="text-[10px] text-amber-600 mt-1">No roles found for this organization. You can assign a role later.</p>
                )}
              </div>

              {/* Temporary Password */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Temporary Password <span className="text-emerald-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCreatePw ? 'text' : 'password'}
                    value={createForm.temporaryPassword}
                    onChange={e => setCreateForm(p => ({ ...p, temporaryPassword: e.target.value }))}
                    placeholder="Min 8 characters"
                    className="w-full bg-slate-50 border placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
                  />
                  <button type="button" onClick={() => setShowCreatePw(p => !p)} className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-600">
                    {showCreatePw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">User will be required to change this on first login.</p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Confirm Password <span className="text-emerald-600">*</span>
                </label>
                <input
                  type={showCreatePw ? 'text' : 'password'}
                  value={createForm.confirmPassword}
                  onChange={e => setCreateForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="Repeat password"
                  className="w-full bg-slate-50 border placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Info note */}
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-700">The user's login will be <span className="font-mono font-bold">{createForm.username || 'username'}@{orgs.find(o => o.id === createForm.organizationId)?.organizationCode?.toLowerCase() || 'orgcode'}.coop</span> internally. Their actual email receives notifications.</p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm transition"
                >
                  {createLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  {createLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Edit User</h2>
                <p className="text-[10px] text-slate-500">@{editTarget.username} · {editTarget.orgCode || 'No org'}</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleEdit} className="px-6 py-5 space-y-4">
              {editError && <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl px-3 py-2.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {editError}</div>}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Full Name</label>
                <input type="text" value={editForm.fullName} onChange={e => setEditForm(p => ({ ...p, fullName: e.target.value }))}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 transition" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 transition" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Status</label>
                <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 transition">
                  <option value="Active">Active</option>
                  <option value="Locked">Locked</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Pending Activation">Pending Activation</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setEditTarget(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
                <button type="submit" disabled={editLoading} className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm transition">
                  {editLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Reset Password</h2>
                <p className="text-[10px] text-slate-500">@{resetTarget.username}</p>
              </div>
              <button onClick={() => setResetTarget(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleReset} className="px-6 py-5 space-y-4">
              {resetError && <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl px-3 py-2.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {resetError}</div>}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">New Password <span className="text-emerald-600">*</span></label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min 8 characters"
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl px-3 py-2 pr-9 text-xs focus:outline-none focus:border-amber-400 transition" />
                  <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-2.5 top-2 text-slate-500">{showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Confirm Password <span className="text-emerald-600">*</span></label>
                <input type={showPw ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password"
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-400 transition" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setResetTarget(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
                <button type="submit" disabled={resetLoading} className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm transition">
                  {resetLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                  {resetLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
