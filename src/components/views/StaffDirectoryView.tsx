import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, UserPlus, Search, Pencil, Eye, Trash2, Briefcase, LogIn, Ban, RefreshCw, Filter } from 'lucide-react';
import { useCoop } from '../../context/CoopContext';
import { fetchStaffList, deleteStaff, Staff } from '../../api/staff';

const fmtDate = (v: string | null): string => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const fmtDateTime = (v: string | null): string => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const StaffDirectoryView: React.FC<{ activeSubKey?: string }> = ({ activeSubKey = 'hr_staff' }) => {
  const { addNotification, openStaffForm, staffRefreshKey, bumpStaffRefresh } = useCoop();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [erpFilter, setErpFilter] = useState<'all' | 'erp' | 'no-erp'>('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchStaffList();
      console.log('[StaffDirectory] raw API response:', data);
      console.log('[StaffDirectory] isArray:', Array.isArray(data));
      console.log('[StaffDirectory] type:', typeof data);
      if (!Array.isArray(data)) {
        console.log('[StaffDirectory] keys:', Object.keys(data as any));
      }
      const list = Array.isArray(data)
        ? data
        : (data as any)?.staff ?? (data as any)?.data ?? (data as any)?.items ?? [];
      console.log('[StaffDirectory] resolved list length:', list.length, list);
      setStaffList(list);
    } catch (e: any) {
      console.error('[StaffDirectory] fetch error:', e);
      console.error('[StaffDirectory] response data:', e?.response?.data);
      console.error('[StaffDirectory] status:', e?.response?.status);
      addNotification('Staff Load Failed', e?.response?.data?.error || 'Could not load staff directory.', 'alert');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { load(); }, [load, staffRefreshKey]);

  // "Add / Edit Staff" nav item opens the create form directly — only once per navigation
  const didOpenRef = useRef(false);
  useEffect(() => {
    if (activeSubKey === 'hr_staff_form' && !didOpenRef.current) {
      didOpenRef.current = true;
      openStaffForm('add');
    }
    if (activeSubKey !== 'hr_staff_form') {
      didOpenRef.current = false;
    }
  }, [activeSubKey, openStaffForm]);

  const handleDelete = async (s: Staff) => {
    if (!window.confirm(`Delete staff member "${s.fullName}" (${s.employeeCode})? This also removes any linked ERP login account.`)) return;
    setDeleting(s.id);
    try {
      await deleteStaff(s.id);
      addNotification('Staff Deleted', `Staff record for ${s.fullName} deleted.`, 'success');
      bumpStaffRefresh();
      load();
    } catch (e: any) {
      addNotification('Staff Delete Failed', e?.response?.data?.error || 'Could not delete staff.', 'alert');
    } finally {
      setDeleting(null);
    }
  };

  const filtered = staffList.filter(s => {
    const term = searchTerm.toLowerCase();
    if (term && !(
      s.fullName.toLowerCase().includes(term) ||
      (s.employeeCode || '').toLowerCase().includes(term) ||
      (s.email || '').toLowerCase().includes(term) ||
      (s.department || '').toLowerCase().includes(term) ||
      (s.designation || '').toLowerCase().includes(term) ||
      (s.erp?.username || '').toLowerCase().includes(term)
    )) return false;
    if (erpFilter === 'erp' && !s.erp) return false;
    if (erpFilter === 'no-erp' && s.erp) return false;
    return true;
  });

  const total = staffList.length;
  const erpCount = staffList.filter(s => s.erp).length;
  const noErpCount = total - erpCount;

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center"><Briefcase className="w-5 h-5 text-emerald-700" /></div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{total}</div>
            <div className="text-xs text-slate-500 font-medium">Total Staff</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-700 flex items-center justify-center"><LogIn className="w-5 h-5 text-slate-800" /></div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{erpCount}</div>
            <div className="text-xs text-slate-500 font-medium">ERP Logins</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center"><Ban className="w-5 h-5 text-slate-500" /></div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{noErpCount}</div>
            <div className="text-xs text-slate-500 font-medium">No Login</div>
          </div>
        </div>
      </div>

      {/* Header + Add Staff */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <Users className="w-6 h-6 text-emerald-700" />
              <span>Staff Directory</span>
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              Staff is the master record. ERP login accounts are optional, created only when enabled.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={() => openStaffForm('add')} className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs">
              <UserPlus className="w-4 h-4" />
              <span>Add Staff</span>
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by name, employee code, email, department..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-600 transition"
            />
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500 font-medium">Login:</span>
            <select value={erpFilter} onChange={e => setErpFilter(e.target.value as any)} className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer">
              <option value="all">All Staff</option>
              <option value="erp">ERP Login</option>
              <option value="no-erp">No Login</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead className="bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Staff</th>
                  <th className="p-3.5">Department</th>
                  <th className="p-3.5">Branch</th>
                  <th className="p-3.5">ERP Access</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {loading ? (
                  <tr><td colSpan={6} className="p-10 text-center text-slate-500">Loading staff directory…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center text-slate-500">No staff records found. Add your first staff member.</td></tr>
                ) : filtered.map(s => {
                  const initials = s.fullName.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      {/* Staff */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shrink-0 ${s.erp ? 'bg-emerald-700' : 'bg-slate-400'}`}>
                            {initials || 'S'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{s.fullName}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{s.employeeCode} • {s.email}</div>
                            {s.designation && <div className="text-[10px] text-emerald-700 font-semibold">{s.designation}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="p-3.5">
                        <span className="text-slate-800 font-medium">{s.department || '—'}</span>
                      </td>

                      {/* Branch */}
                      <td className="p-3.5">
                        <span className="text-slate-800">{s.branchName || '—'}</span>
                      </td>

                      {/* ERP Access */}
                      <td className="p-3.5">
                        {s.erp ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <LogIn className="w-3 h-3" /> ERP LOGIN
                            </span>
                            <div className="text-[11px] text-slate-600">
                              <span className="font-mono font-bold">@{s.erp.username}</span>
                              {s.erp.role && <span className="text-slate-500"> • {s.erp.role}</span>}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Last login: {fmtDateTime(s.erp.lastLoginAt)}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              <Ban className="w-3 h-3" /> NO LOGIN
                            </span>
                            <div className="text-[10px] text-slate-500">No ERP access</div>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${ s.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : s.status === 'On Leave' || s.status === 'Suspended' ? 'bg-amber-50 text-amber-700 border-amber-200' : s.status === 'Resigned' || s.status === 'Retired' || s.status === 'Terminated' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-50 text-slate-600 border-slate-200' }`}>
                          {s.status}
                        </span>
                        {s.joiningDate && <div className="text-[10px] text-slate-500 mt-1">Joined {fmtDate(s.joiningDate)}</div>}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="inline-flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 gap-1">
                          <button onClick={() => openStaffForm('edit', s)} title="View / Edit Staff" className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-200/60 transition cursor-pointer">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openStaffForm('edit', s)} title="Edit Staff" className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-200/60 transition cursor-pointer">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            disabled={deleting === s.id}
                            title="Delete Staff"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-200/60 transition cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
    </div>
  );
};
