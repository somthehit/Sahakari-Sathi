import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, Search, RefreshCw, Plus, X, Loader2, AlertTriangle,
  Eye, EyeOff, CheckCircle2, Lock, Unlock, Pencil, Key,
} from 'lucide-react';
import { useCoop } from '../../../context/CoopContext';
import { useSuperAdminAuth } from '../../../stores/superAdminAuthStore';
import { superAdminApi } from '../../../lib/superAdminApi';

interface SuperAdmin {
  id: string;
  username: string;
  email: string | null;
  fullName: string | null;
  status: string;
  lastLogin: string | null;
  createdAt: string;
}

const EMPTY_FORM = { username: '', fullName: '', email: '', password: '', confirmPassword: '' };
const EMPTY_EDIT = { fullName: '', email: '', status: 'Active' };

const statusColors: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-800',
  Inactive: 'bg-slate-100 text-slate-600',
  Suspended: 'bg-red-100 text-red-700',
};

export const SuperAdminUsersView: React.FC = () => {
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();

  const [admins, setAdmins] = useState<SuperAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<SuperAdmin | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_EDIT });
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<SuperAdmin | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);

  const loadAdmins = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await superAdminApi.getSuperAdmins(accessToken);
      setAdmins(Array.isArray(data) ? data : []);
    } catch (err: any) {
      addNotification('Load Failed', err.message || 'Could not fetch super admins.', 'alert');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  const filtered = admins.filter(a => {
    if (!search) return true;
    const t = search.toLowerCase();
    return (a.fullName || '').toLowerCase().includes(t) || a.username.toLowerCase().includes(t) || (a.email || '').toLowerCase().includes(t);
  });

  // ── Add ──────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!addForm.username.trim() || !addForm.password.trim()) { setAddError('Username and password are required.'); return; }
    if (addForm.password !== addForm.confirmPassword) { setAddError('Passwords do not match.'); return; }
    if (addForm.password.length < 8) { setAddError('Password must be at least 8 characters.'); return; }
    setAddLoading(true);
    try {
      await superAdminApi.createSuperAdmin(accessToken!, {
        username: addForm.username.trim(),
        fullName: addForm.fullName.trim() || addForm.username.trim(),
        email: addForm.email.trim(),
        password: addForm.password,
      });
      addNotification('Super Admin Created', `Account "${addForm.username}" created successfully.`, 'success');
      setShowAdd(false);
      setAddForm({ ...EMPTY_FORM });
      loadAdmins();
    } catch (err: any) {
      setAddError(err.message || 'Failed to create account.');
    } finally {
      setAddLoading(false);
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────
  const openEdit = (a: SuperAdmin) => {
    setEditTarget(a);
    setEditForm({ fullName: a.fullName || '', email: a.email || '', status: a.status });
    setEditError('');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError('');
    setEditLoading(true);
    try {
      await superAdminApi.updateSuperAdminUser(accessToken!, editTarget.id, editForm);
      setAdmins(prev => prev.map(a => a.id === editTarget.id ? { ...a, ...editForm } : a));
      addNotification('Admin Updated', `${editForm.fullName || editTarget.username} updated successfully.`, 'success');
      setEditTarget(null);
    } catch (err: any) {
      setEditError(err.message || 'Update failed.');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Toggle status ─────────────────────────────────────────────────
  const toggleStatus = async (a: SuperAdmin) => {
    const newStatus = a.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await superAdminApi.updateSuperAdminUser(accessToken!, a.id, { status: newStatus });
      setAdmins(prev => prev.map(x => x.id === a.id ? { ...x, status: newStatus } : x));
      addNotification('Status Updated', `${a.fullName || a.username} → ${newStatus}`, newStatus === 'Active' ? 'success' : 'warning');
    } catch (err: any) {
      addNotification('Update Failed', err.message, 'alert');
    }
  };

  // ── Reset password ────────────────────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError('');
    if (!resetPw || resetPw.length < 8) { setResetError('Password must be at least 8 characters.'); return; }
    if (resetPw !== resetConfirm) { setResetError('Passwords do not match.'); return; }
    setResetLoading(true);
    try {
      await superAdminApi.resetPlatformUserPassword(accessToken!, resetTarget.id, resetPw);
      addNotification('Password Reset', `Password for "${resetTarget.username}" has been reset.`, 'success');
      setResetTarget(null);
      setResetPw(''); setResetConfirm('');
    } catch (err: any) {
      setResetError(err.message || 'Reset failed.');
    } finally {
      setResetLoading(false);
    }
  };

  const inputCls = 'w-full bg-slate-50 border placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/20 transition';

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <ShieldAlert className="w-6 h-6 text-violet-600" />
              <span>Super Admin Users</span>
              <span className="text-xs font-normal bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">{admins.length} total</span>
            </h1>
            <p className="text-slate-500 text-xs mt-1">Manage platform-level administrator accounts. Only super admins can access this panel.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadAdmins} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => { setShowAdd(true); setAddError(''); setAddForm({ ...EMPTY_FORM }); }}
              className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm">
              <Plus className="w-4 h-4" /> Add Super Admin
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input type="text" placeholder="Search by name, username or email..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-violet-400 transition" />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Admin', 'Email', 'Status', 'Last Login', 'Created', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-slate-800 font-bold text-[11px] shrink-0">
                        {(a.fullName || a.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{a.fullName || a.username}</div>
                        <div className="text-slate-500 text-[11px]">@{a.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${statusColors[a.status] || 'bg-slate-100 text-slate-600'}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{a.lastLogin ? new Date(a.lastLogin).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(a)} title="Edit" className="p-1.5 hover:bg-violet-50 hover:text-violet-600 rounded-lg text-slate-500 transition cursor-pointer">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setResetTarget(a); setResetPw(''); setResetConfirm(''); setResetError(''); }} title="Reset Password" className="p-1.5 hover:bg-amber-50 hover:text-amber-600 rounded-lg text-slate-500 transition cursor-pointer">
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleStatus(a)} title={a.status === 'Active' ? 'Deactivate' : 'Activate'} className={`p-1.5 rounded-lg transition cursor-pointer ${a.status === 'Active' ? 'hover:bg-red-50 hover:text-red-600 text-slate-500' : 'hover:bg-emerald-50 hover:text-emerald-600 text-slate-500'}`}>
                        {a.status === 'Active' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500">No super admin accounts found.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin text-violet-400 mx-auto" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center"><ShieldAlert className="w-4 h-4 text-violet-600" /></div>
                <div><h2 className="text-sm font-bold text-slate-900">Add Super Admin</h2><p className="text-[10px] text-slate-500">Create a new platform-level administrator</p></div>
              </div>
              <button onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAdd} className="px-6 py-5 space-y-4">
              {addError && <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl px-3 py-2.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {addError}</div>}
              <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Username <span className="text-emerald-600">*</span></label>
                <input type="text" value={addForm.username} onChange={e => setAddForm(p => ({ ...p, username: e.target.value }))} placeholder="e.g. admin2" className={inputCls} autoFocus /></div>
              <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Full Name</label>
                <input type="text" value={addForm.fullName} onChange={e => setAddForm(p => ({ ...p, fullName: e.target.value }))} placeholder="e.g. Rajesh Sharma" className={inputCls} /></div>
              <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Email</label>
                <input type="email" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} placeholder="admin@sahakari.com" className={inputCls} /></div>
              <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Password <span className="text-emerald-600">*</span></label>
                <div className="relative"><input type={showPw ? 'text' : 'password'} value={addForm.password} onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 8 characters" className={`${inputCls} pr-9`} />
                  <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-2.5 top-2 text-slate-500">{showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button></div></div>
              <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Confirm Password <span className="text-emerald-600">*</span></label>
                <input type={showPw ? 'text' : 'password'} value={addForm.confirmPassword} onChange={e => setAddForm(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="Repeat password" className={inputCls} /></div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
                <button type="submit" disabled={addLoading} className="px-4 py-2 text-xs font-bold text-slate-800 bg-violet-600 hover:bg-violet-700 rounded-xl flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm transition">
                  {addLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}{addLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div><h2 className="text-sm font-bold text-slate-900">Edit Admin</h2><p className="text-[10px] text-slate-500">@{editTarget.username}</p></div>
              <button onClick={() => setEditTarget(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleEdit} className="px-6 py-5 space-y-4">
              {editError && <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl px-3 py-2.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {editError}</div>}
              <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Full Name</label>
                <input type="text" value={editForm.fullName} onChange={e => setEditForm(p => ({ ...p, fullName: e.target.value }))} className={inputCls} /></div>
              <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} className={inputCls} /></div>
              <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Status</label>
                <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))} className={inputCls}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspended">Suspended</option>
                </select></div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setEditTarget(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
                <button type="submit" disabled={editLoading} className="px-4 py-2 text-xs font-bold text-slate-800 bg-violet-600 hover:bg-violet-700 rounded-xl flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm transition">
                  {editLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}{editLoading ? 'Saving...' : 'Save Changes'}
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
              <div><h2 className="text-sm font-bold text-slate-900">Reset Password</h2><p className="text-[10px] text-slate-500">@{resetTarget.username}</p></div>
              <button onClick={() => setResetTarget(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleReset} className="px-6 py-5 space-y-4">
              {resetError && <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl px-3 py-2.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {resetError}</div>}
              <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">New Password <span className="text-emerald-600">*</span></label>
                <div className="relative"><input type={showResetPw ? 'text' : 'password'} value={resetPw} onChange={e => setResetPw(e.target.value)} placeholder="Min 8 characters" className={`${inputCls} pr-9`} />
                  <button type="button" onClick={() => setShowResetPw(p => !p)} className="absolute right-2.5 top-2 text-slate-500">{showResetPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button></div></div>
              <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Confirm Password <span className="text-emerald-600">*</span></label>
                <input type={showResetPw ? 'text' : 'password'} value={resetConfirm} onChange={e => setResetConfirm(e.target.value)} placeholder="Repeat new password" className={inputCls} /></div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setResetTarget(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
                <button type="submit" disabled={resetLoading} className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm transition">
                  {resetLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}{resetLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
