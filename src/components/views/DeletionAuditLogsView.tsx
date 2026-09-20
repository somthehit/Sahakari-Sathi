/**
 * Deletion Audit Logs View (admin only)
 *
 * Read-only viewer for the immutable audit_deletion_logs trail written by
 * every hard delete. Rows can never be edited or removed (DB-level
 * `DO INSTEAD NOTHING` rules), so this is the forensic record of who deleted
 * what, when, why, and from which IP — including the full JSON snapshot.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCoop } from '../../context/CoopContext';
import { Download, FileSpreadsheet, Filter, Loader2, RefreshCw, ShieldAlert, Trash2, UserX } from 'lucide-react';
import { getDeletionLogs, DeletionLog } from '../../api/hardDelete';
import { exportToPdf, exportToExcel } from '../../utils/exportUtils';
import { convertADToBS } from '../../utils/nepaliCalendar';

const ENTITY_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
  MEMBER: { label: 'Member', cls: 'bg-rose-50 text-rose-700 border-rose-200', icon: UserX },
  SAVINGS_ACCOUNT: { label: 'Savings Account', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: Trash2 },
  USER: { label: 'User', cls: 'bg-slate-100 text-slate-700 border-slate-200', icon: ShieldAlert },
};

const TYPE_LABEL: Record<string, string> = {
  MEMBER: 'Member',
  SAVINGS_ACCOUNT: 'Savings Account',
  USER: 'User',
};

function bsDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const date = new Date(iso);
    const day = String(date.getUTCFullYear()).padStart(4, '0') + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
    const bs = convertADToBS(day);
    return `${bs} BS`;
  } catch {
    return new Date(iso).toLocaleDateString();
  }
}

function adDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Compact summary of the snapshot's top-level sections, e.g. "account (1), transactions (3)". */
function snapshotSummary(snapshot: Record<string, any>): { label: string; count: string }[] {
  return Object.entries(snapshot || {}).map(([key, value]) => {
    if (Array.isArray(value)) return { label: key, count: `${value.length} rows` };
    if (value && typeof value === 'object') return { label: key, count: 'detail' };
    return { label: key, count: String(value ?? '') };
  });
}

export const DeletionAuditLogsView: React.FC = () => {
  const { activeRole } = useCoop();
  const [logs, setLogs] = useState<DeletionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'MEMBER' | 'SAVINGS_ACCOUNT' | 'USER'>('ALL');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const isAdmin =
    (activeRole as string) === 'org_admin' || (activeRole as string) === 'admin' || (activeRole as string) === 'super_admin';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setLogs(await getDeletionLogs());
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load deletion audit logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (typeFilter !== 'ALL' && log.entityType !== typeFilter) return false;
      if (!q) return true;
      const haystack = [log.entityCode, log.entityId, log.deletedByUserName, log.deletionReason, log.ipAddress]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, typeFilter, search]);

  const stats = useMemo(() => {
    const total = logs.length;
    const members = logs.filter((l) => l.entityType === 'MEMBER').length;
    const accounts = logs.filter((l) => l.entityType === 'SAVINGS_ACCOUNT').length;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const last7 = logs.filter((l) => new Date(l.createdAt).getTime() >= weekAgo).length;
    return { total, members, accounts, last7 };
  }, [logs]);

  const exportHeaders = ['Timestamp (AD)', 'Timestamp (BS)', 'Entity Type', 'Entity Code', 'Entity ID', 'Deleted By', 'Role', 'Reason', 'IP Address'];

  const exportRows = (rows: DeletionLog[]): (string | number)[][] =>
    rows.map((l) => [
      adDateTime(l.createdAt),
      bsDate(l.createdAt),
      TYPE_LABEL[l.entityType] ?? l.entityType,
      l.entityCode ?? '—',
      l.entityId,
      l.deletedByUserName,
      l.deletedByUserRole ?? '—',
      l.deletionReason,
      l.ipAddress ?? '—',
    ]);

  const handleExportPdf = () =>
    exportToPdf(
      'Deletion_Audit_Log_2083',
      'Immutable Hard-Delete Audit Trail',
      `Total Hard Deletes: ${filtered.length} | Forensic record of permanently removed records (append-only)`,
      exportHeaders,
      exportRows(filtered),
    );

  const handleExportExcel = () =>
    exportToExcel('Deletion_Audit_Log_2083', 'Deletion_Logs', exportHeaders, exportRows(filtered));

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Deletion Audit Logs</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>
              Immutable, append-only trail of every hard delete — who, what, when, why, from which IP, plus a full JSON snapshot.
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-slate-800 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"
          >
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {!isAdmin && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-rose-700 font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> This view is restricted to organization administrators.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Hard Deletes', value: stats.total, cls: 'text-slate-900' },
          { label: 'Members Deleted', value: stats.members, cls: 'text-rose-700' },
          { label: 'Savings Accounts Deleted', value: stats.accounts, cls: 'text-amber-700' },
          { label: 'Last 7 Days', value: stats.last7, cls: 'text-indigo-700' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{c.label}</div>
            <div className={`text-2xl font-bold ${c.cls}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 font-semibold">
          {(['ALL', 'MEMBER', 'SAVINGS_ACCOUNT', 'USER'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                typeFilter === t ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              {t === 'ALL' ? 'All' : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search code, admin, reason, IP…"
          className="flex-1 min-w-[200px] bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-rose-400 focus:outline-none shadow-xs"
        />
        <span className="text-slate-500 font-semibold">{filtered.length} of {logs.length} records</span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-rose-700 font-semibold">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-2 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-rose-600" />
            <span className="font-semibold">Loading immutable deletion trail…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500 font-semibold">
            {logs.length === 0
              ? 'No hard deletes have been recorded yet. Deletion audit entries appear here automatically.'
              : 'No records match the current filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Entity</th>
                  <th className="p-3">Deleted By</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">IP Address</th>
                  <th className="p-3">Snapshot</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((log) => {
                  const badge = ENTITY_BADGE[log.entityType] ?? ENTITY_BADGE.USER;
                  const BadgeIcon = badge.icon;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors align-top">
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{bsDate(log.createdAt)}</div>
                          <div className="text-[10px] text-slate-500">{adDateTime(log.createdAt)}</div>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded border ${badge.cls}`}>
                            <BadgeIcon className="w-3 h-3" /> {badge.label}
                          </span>
                          <div className="mt-1 font-mono font-bold text-slate-900">{log.entityCode || '—'}</div>
                          <div className="text-[10px] font-mono text-slate-400">{log.entityId}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{log.deletedByUserName}</div>
                          <div className="text-[10px] text-slate-500">{log.deletedByUserRole || '—'}</div>
                        </td>
                        <td className="p-3 text-slate-600 max-w-[280px]">{log.deletionReason}</td>
                        <td className="p-3 font-mono text-slate-500">{log.ipAddress || '—'}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {snapshotSummary(log.snapshotData).map((s) => (
                              <span key={s.label} className="bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                {s.label}: {s.count}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-bold transition cursor-pointer"
                          >
                            {expanded === log.id ? 'Hide' : 'JSON'}
                          </button>
                        </td>
                      </tr>
                      {expanded === log.id && (
                        <tr className="bg-slate-50">
                          <td colSpan={7} className="p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-slate-700">Full archived snapshot</span>
                              <span className="text-[10px] text-slate-400 font-mono">audit_deletion_logs · id {log.id}</span>
                            </div>
                            <pre className="bg-slate-900 text-emerald-300 rounded-xl p-4 overflow-x-auto text-[10px] leading-relaxed max-h-[420px] overflow-y-auto">
                              {JSON.stringify(log.snapshotData, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
