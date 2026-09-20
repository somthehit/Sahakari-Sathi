import React, { useState, useEffect, useCallback } from 'react';
import {
  History, Search, Filter, Download, User, Globe, AlertTriangle, Info, CheckCircle2, RefreshCw
} from 'lucide-react';
import { useSuperAdminAuth } from '../../../stores/superAdminAuthStore';
import { superAdminApi } from '../../../lib/superAdminApi';

interface AuditLog {
  id: string;
  username: string | null;
  organizationCode: string | null;
  event: string;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  reason: string | null;
  createdAt: string;
}

const severityColors: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
};

const severityIcons: Record<string, React.ReactNode> = {
  info: <Info className="w-4 h-4 text-blue-600" />,
  success: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-600" />,
  danger: <AlertTriangle className="w-4 h-4 text-red-600" />,
};

function severityFor(log: AuditLog): 'info' | 'success' | 'warning' | 'danger' {
  const ev = (log.event || '').toUpperCase();
  if (!log.success) return 'danger';
  if (ev.includes('FAILED') || ev.includes('LOCKED') || ev.includes('SUSPENDED')) return 'danger';
  if (ev.includes('LOGIN') || ev.includes('SUCCESS') || ev.includes('APPROVED') || ev.includes('CREATED')) return 'success';
  if (ev.includes('WARNING') || ev.includes('RESET')) return 'warning';
  return 'info';
}

export const PlatformAuditLogsView: React.FC = () => {
  const { accessToken } = useSuperAdminAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [orgFilter, setOrgFilter] = useState('all');

  const loadLogs = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await superAdminApi.getAuditLogs(accessToken, 500);
      setLogs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const orgs = Array.from(new Set(logs.map(l => l.organizationCode).filter((c): c is string => !!c))).sort();

  const filtered = logs.filter(l => {
    if (orgFilter !== 'all' && (l.organizationCode || 'SYSTEM') !== orgFilter) return false;
    const sev = severityFor(l);
    if (severityFilter !== 'all' && sev !== severityFilter) return false;
    if (!search) return true;
    const t = search.toLowerCase();
    return (l.event || '').toLowerCase().includes(t)
      || (l.reason || '').toLowerCase().includes(t)
      || (l.username || '').toLowerCase().includes(t)
      || (l.ipAddress || '').toLowerCase().includes(t);
  });

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <History className="w-6 h-6 text-emerald-700" />
              <span>Platform Audit Logs</span>
              <span className="text-xs font-normal bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">{logs.length} entries</span>
            </h1>
            <p className="text-slate-500 text-xs mt-1">Record of all login and authentication activity across the platform and all tenants.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadLogs} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
            <input type="text" placeholder="Search logs by action, user, org, or IP..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-600 transition" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="bg-transparent text-slate-700 font-medium outline-none cursor-pointer">
                <option value="all">All Severities</option>
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="danger">Danger</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)} className="bg-transparent text-slate-700 font-medium outline-none cursor-pointer">
                <option value="all">All Organizations</option>
                <option value="SYSTEM">SYSTEM</option>
                {orgs.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
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
                <th className="w-10 px-4 py-3"></th>
                {['Timestamp', 'Action', 'Organization', 'User', 'IP Address', 'Details'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(log => {
                const sev = severityFor(log);
                return (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition group cursor-pointer">
                    <td className="px-4 py-3">{severityIcons[sev]}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-slate-700">{log.event}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${!log.organizationCode || log.organizationCode === 'SYSTEM' ? 'bg-slate-50 text-slate-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {log.organizationCode || 'SYSTEM'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium flex items-center gap-1.5">
                      <User className="w-3 h-3 text-slate-500" /> {log.username || 'system'}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">{log.ipAddress || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-[300px] truncate">{log.reason || log.event}</td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">No audit logs found.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">Loading audit logs...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
