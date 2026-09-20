import React, { useState, useEffect, useCallback } from 'react';
import { useCoop } from '../../context/CoopContext';
import {
  Users, Search, Key, History, Laptop, Lock, Unlock, RefreshCw, CheckCircle2,
  Info, Eye, Shield, Mail, Power, Ban, UserX, ShieldCheck, LogOut, Filter, X, Loader2,
} from 'lucide-react';
import {
  fetchOrgUsers, OrgUser, lockOrgUser, unlockOrgUser, activateOrgUser, deactivateOrgUser,
  resetUserPassword, resendWelcomeEmail, terminateUserSessions, forcePasswordReset, updateOrgUser,
} from '../../api/users';
import { fetchOrgReference, RefRole, RefBranch } from '../../api/staff';

interface Props {
  activeSubKey?: string;
}

const fmtDateTime = (v: string | null): string => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const STATUS_STYLE: Record<string, string> = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Pending Activation': 'bg-amber-50 text-amber-700 border-amber-200',
  Locked: 'bg-rose-50 text-rose-700 border-rose-200',
  Suspended: 'bg-rose-50 text-rose-700 border-rose-200',
  Archived: 'bg-slate-100 text-slate-600 border-slate-200',
  Draft: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const AdminUsersView: React.FC<Props> = ({ activeSubKey = 'admin_users' }) => {
  const { addNotification } = useCoop();
  const [subTab, setSubTab] = useState<string>(activeSubKey);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Locked' | 'Suspended'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tempPasswordResult, setTempPasswordResult] = useState<{ username: string; password: string } | null>(null);

  // Edit-role modal
  const [roleUser, setRoleUser] = useState<OrgUser | null>(null);
  const [roleOptions, setRoleOptions] = useState<RefRole[]>([]);
  const [branchOptions, setBranchOptions] = useState<RefBranch[]>([]);
  const [roleForm, setRoleForm] = useState({ roleId: '', branchId: '', dataScope: 'own' });

  useEffect(() => {
    if (activeSubKey) setSubTab(activeSubKey);
  }, [activeSubKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOrgUsers();
      setUsers(data);
    } catch (e: any) {
      console.warn('[AdminUsers] fetch failed:', e);
      addNotification('Users Load Failed', e?.response?.data?.error || 'Could not load users.', 'alert');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { load(); }, [load]);

  const runAction = async (id: string, fn: () => Promise<unknown>, successMsg: string) => {
    setBusyId(id);
    try {
      await fn();
      addNotification('User Management', successMsg, 'success');
      load();
    } catch (e: any) {
      addNotification('Action Failed', e?.response?.data?.error || e?.message || 'Action failed.', 'alert');
    } finally {
      setBusyId(null);
    }
  };

  const openRoleModal = async (u: OrgUser) => {
    setRoleUser(u);
    setRoleForm({ roleId: u.roleId || '', branchId: u.branchId || '', dataScope: 'own' });
    try {
      const ref = await fetchOrgReference();
      setRoleOptions(ref.roles);
      setBranchOptions(ref.branches);
    } catch { /* dropdowns stay empty */ }
  };

  const saveRole = async () => {
    if (!roleUser) return;
    setBusyId(roleUser.id);
    try {
      await updateOrgUser(roleUser.id, { roleId: roleForm.roleId || null, branchId: roleForm.branchId || null, dataScope: roleForm.dataScope || 'own' });
      addNotification('Role Updated', `Assigned role updated for ${roleUser.fullName}.`, 'success');
      setRoleUser(null);
      load();
    } catch (e: any) {
      addNotification('Role Update Failed', e?.response?.data?.error || e?.message || 'Could not update role.', 'alert');
    } finally {
      setBusyId(null);
    }
  };

  const handleResetPassword = async (u: OrgUser) => {
    setBusyId(u.id);
    try {
      const { temporaryPassword } = await resetUserPassword(u.id);
      setTempPasswordResult({ username: u.username, password: temporaryPassword });
      addNotification('Password Reset', `Temporary password generated for @${u.username} and welcome email sent.`, 'success');
      load();
    } catch (e: any) {
      addNotification('Password Reset Failed', e?.response?.data?.error || e?.message || 'Could not reset password.', 'alert');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = users.filter(u => {
    const term = searchTerm.toLowerCase();
    if (term && !(
      (u.fullName || '').toLowerCase().includes(term) ||
      (u.username || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.employeeCode || '').toLowerCase().includes(term) ||
      (u.role || '').toLowerCase().includes(term) ||
      (u.department || '').toLowerCase().includes(term)
    )) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* In-page module navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'admin_users', label: 'User Accounts', icon: Users, hint: 'Manage system accounts' },
            { id: 'admin_login_history', label: 'Login History', icon: History, hint: 'Authentication audit trail' },
            { id: 'admin_user_sessions', label: 'Active Sessions', icon: Laptop, hint: 'Currently logged-in devices' },
          ].map((t) => {
            const TabIcon = t.icon;
            const isActive = subTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                title={t.hint}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${ isActive ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' }`}
              >
                <TabIcon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. USER ACCOUNTS — MANAGEMENT DASHBOARD */}
      {subTab === 'admin_users' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
                <Users className="w-6 h-6 text-emerald-700" />
                <span>Users</span>
              </h1>
              <p className="text-slate-500 text-xs mt-1">
                Management dashboard for existing accounts. User accounts are created from staff records — no direct user creation here.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={load} className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>
          </div>

          {tempPasswordResult && (
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-emerald-900">Temporary password generated for @{tempPasswordResult.username}</p>
                <p className="text-emerald-800 mt-0.5">Copy it now — it will not be shown again. The welcome email has been sent.</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="bg-white border border-emerald-200 rounded-lg px-3 py-1.5 font-mono font-bold text-sm text-slate-900">{tempPasswordResult.password}</code>
                  <button onClick={() => { navigator.clipboard?.writeText(tempPasswordResult.password); }} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition cursor-pointer text-xs">
                    Copy
                  </button>
                  <button onClick={() => setTempPasswordResult(null)} className="px-3 py-1.5 text-slate-500 hover:text-slate-700 font-bold rounded-lg transition cursor-pointer text-xs">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search by name, username, email, employee ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-600 transition"
              />
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500 font-medium">Status:</span>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer">
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Locked">Locked</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[980px]">
                <thead className="bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Employee ID</th>
                    <th className="p-3.5">Department</th>
                    <th className="p-3.5">Branch</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Last Login</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {loading ? (
                    <tr><td colSpan={8} className="p-10 text-center text-slate-500">Loading user accounts…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={8} className="p-10 text-center text-slate-500">No user accounts found. Create staff with ERP login enabled to add users.</td></tr>
                  ) : filtered.map(u => {
                    const initials = (u.fullName || u.username).split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
                    const isBusy = busyId === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition">
                        {/* User */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center font-bold text-white text-xs shrink-0">
                              {initials || 'U'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-xs">{u.fullName || u.username}</div>
                              <div className="text-[11px] text-slate-500 font-mono">@{u.username}</div>
                              <div className="text-[10px] text-slate-500">{u.email || '—'}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span className="font-mono text-slate-700">{u.employeeCode || '—'}</span>
                          {u.designation && <div className="text-[10px] text-slate-500">{u.designation}</div>}
                        </td>

                        <td className="p-3.5"><span className="text-slate-800">{u.department || '—'}</span></td>
                        <td className="p-3.5"><span className="text-slate-800">{u.branchName || '—'}</span></td>

                        <td className="p-3.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">{u.role || 'Unassigned'}</span>
                          {u.requiresPasswordChange && <div className="text-[10px] text-amber-600 font-semibold mt-1">Must change password</div>}
                        </td>

                        <td className="p-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLE[u.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {u.status}
                          </span>
                          {u.securitySetupCompleted ? (
                            <div className="text-[10px] text-emerald-600 font-semibold mt-1">Security setup done</div>
                          ) : (
                            <div className="text-[10px] text-slate-500 mt-1">Setup pending</div>
                          )}
                        </td>

                        <td className="p-3.5">
                          <div className="text-slate-700 font-mono text-[11px]">{fmtDateTime(u.lastLoginAt)}</div>
                          <div className="text-[10px] text-slate-500">Activity: {fmtDateTime(u.lastActivityAt)}</div>
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-right">
                          <div className="inline-flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 gap-1">
                            <button title="View Profile" onClick={() => openRoleModal(u)} className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-200/60 transition cursor-pointer">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button title="Edit Role / Branch" onClick={() => openRoleModal(u)} className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-200/60 transition cursor-pointer">
                              <Shield className="w-4 h-4" />
                            </button>
                            <button title="Reset Password" disabled={isBusy} onClick={() => handleResetPassword(u)} className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-200/60 transition cursor-pointer disabled:opacity-50">
                              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                            </button>
                            <button title="Force Password Change" disabled={isBusy} onClick={() => runAction(u.id, async () => {
                              const pwd = `Temp${Math.random().toString(36).slice(2, 8)}@1`;
                              await forcePasswordReset(u.id, pwd);
                            }, `Force password change set for @${u.username}.`)} className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-200/60 transition cursor-pointer disabled:opacity-50">
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button title="Send Welcome Email Again" disabled={isBusy} onClick={() => runAction(u.id, () => resendWelcomeEmail(u.id), `Welcome email resent to @${u.username}.`)} className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-slate-200/60 transition cursor-pointer disabled:opacity-50">
                              <Mail className="w-4 h-4" />
                            </button>
                            <button title="Terminate All Sessions" disabled={isBusy} onClick={() => runAction(u.id, () => terminateUserSessions(u.id), `All sessions terminated for @${u.username}.`)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-200/60 transition cursor-pointer disabled:opacity-50">
                              <LogOut className="w-4 h-4" />
                            </button>
                            {u.status === 'Locked' ? (
                              <button title="Unlock Account" disabled={isBusy} onClick={() => runAction(u.id, () => unlockOrgUser(u.id), `@${u.username} unlocked.`)} className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-200/60 transition cursor-pointer disabled:opacity-50">
                                <Unlock className="w-4 h-4" />
                              </button>
                            ) : (
                              <button title="Lock Account" disabled={isBusy} onClick={() => runAction(u.id, () => lockOrgUser(u.id), `@${u.username} locked.`)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-200/60 transition cursor-pointer disabled:opacity-50">
                                <Lock className="w-4 h-4" />
                              </button>
                            )}
                            {u.status === 'Active' ? (
                              <button title="Deactivate Account" disabled={isBusy} onClick={() => runAction(u.id, () => deactivateOrgUser(u.id), `@${u.username} deactivated.`)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-200/60 transition cursor-pointer disabled:opacity-50">
                                <Ban className="w-4 h-4" />
                              </button>
                            ) : (
                              <button title="Activate Account" disabled={isBusy} onClick={() => runAction(u.id, () => activateOrgUser(u.id), `@${u.username} activated.`)} className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-200/60 transition cursor-pointer disabled:opacity-50">
                                <Power className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. LOGIN HISTORY */}
      {subTab === 'admin_login_history' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-700" />
            <span>Recent Authentication Activity</span>
          </h3>
          <p className="text-xs text-slate-500">
            Full login audit trail is available in the <span className="font-bold">Audit Trail</span> module under Admin. Last-login timestamps for each account are shown in the Users table above.
          </p>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl text-xs">
            <Info className="w-4 h-4 shrink-0 text-emerald-700" />
            <span>Login timestamps are captured per account (Last Login / Last Activity columns) and in the authentication audit log.</span>
          </div>
        </div>
      )}

      {/* 3. ACTIVE SESSIONS */}
      {subTab === 'admin_user_sessions' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Laptop className="w-5 h-5 text-emerald-700" />
              <span>Manage User Sessions</span>
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Use the <span className="font-bold">Terminate Sessions</span> action in the Users table above to forcefully sign out a user from all devices.
          </p>
        </div>
      )}

      {/* Edit Role / View Profile Modal */}
      {roleUser && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Role, Branch & Access</h3>
                  <p className="text-slate-500 text-xs">{roleUser.fullName || roleUser.username} (@{roleUser.username})</p>
                </div>
              </div>
              <button onClick={() => setRoleUser(null)} className="text-slate-500 hover:text-slate-700 p-1 font-bold cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 text-[11px] font-semibold mb-1.5 uppercase">Assigned Role</label>
                <select value={roleForm.roleId} onChange={e => setRoleForm(prev => ({ ...prev, roleId: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-700">
                  <option value="">Unassigned</option>
                  {roleOptions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-500 text-[11px] font-semibold mb-1.5 uppercase">Branch Scope</label>
                <select value={roleForm.branchId} onChange={e => setRoleForm(prev => ({ ...prev, branchId: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-700">
                  <option value="">All Branches</option>
                  {branchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-500 text-[11px] font-semibold mb-1.5 uppercase">Data Scope</label>
                <select value={roleForm.dataScope} onChange={e => setRoleForm(prev => ({ ...prev, dataScope: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-700">
                  <option value="own">Own Data Only</option>
                  <option value="branch">Branch-wide</option>
                  <option value="organization">Organization-wide</option>
                  <option value="all">All Data</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button onClick={() => setRoleUser(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer">Cancel</button>
              <button onClick={saveRole} disabled={busyId === roleUser.id} className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-60">
                {busyId === roleUser.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
