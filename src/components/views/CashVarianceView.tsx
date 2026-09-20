/**
 * CashVarianceView — Variance Analysis & Exception Handling
 * ---------------------------------------------------------------------------
 * Dashboard for reviewing cash/bank variances across reconciliation sessions.
 * Features:
 * - Summary KPIs (open exceptions, resolved, total amount)
 * - Filterable list of variance logs
 * - Resolve / ignore exceptions with resolution notes
 * - Create new variance entries for ad-hoc investigation
 * - Variance by type breakdown
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle, CheckCircle2, XCircle, Search, Filter, RefreshCw,
  Plus, ChevronDown, Clock, Eye, MessageSquare, Loader2, Scale,
  TrendingDown, TrendingUp, Landmark, FileWarning, Activity,
} from 'lucide-react';
import { useCoop } from '../../context/CoopContext';
import {
  fetchVarianceLogs,
  createVarianceLog,
  resolveVarianceLog,
  fetchVarianceSummary,
  type VarianceLog,
  type VarianceSummary,
} from '../../api/reconciliation';
import { formatNPR } from '../../utils/nepaliCalendar';

interface Props {
  activeSubKey?: string;
}

type FilterStatus = 'all' | 'open' | 'investigating' | 'resolved' | 'ignored';
type FilterType = 'all' | 'cash_short' | 'cash_over' | 'bank_difference' | 'unmatched_entry' | 'missing_entry';

export function CashVarianceView({ activeSubKey }: Props) {
  const { activeBranch, addNotification } = useCoop();

  // State
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<VarianceLog[]>([]);
  const [summary, setSummary] = useState<VarianceSummary>({ totalOpen: 0, totalResolved: 0, totalAmount: 0, byType: {} });
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newVariance, setNewVariance] = useState({
    varianceType: 'cash_short' as const,
    amount: '',
    description: '',
  });

  // Resolve modal
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolvingLog, setResolvingLog] = useState<VarianceLog | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolveAction, setResolveAction] = useState<'resolved' | 'ignored'>('resolved');

  // =============================================
  // Load data
  // =============================================
  const loadData = useCallback(async () => {
    if (!activeBranch) return;
    setLoading(true);
    try {
      const [logsData, summaryData] = await Promise.all([
        fetchVarianceLogs({
          branchId: activeBranch.id,
          status: filterStatus === 'all' ? undefined : filterStatus,
          varianceType: filterType === 'all' ? undefined : filterType,
        }),
        fetchVarianceSummary(activeBranch.id),
      ]);
      setLogs(logsData);
      setSummary(summaryData);
    } catch (err: any) {
      addNotification('Error', err.message || 'Failed to load variance data', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeBranch, filterStatus, filterType, addNotification]);

  useEffect(() => { loadData(); }, [loadData]);

  // =============================================
  // Create new variance log
  // =============================================
  const handleCreateVariance = async () => {
    if (!activeBranch || !newVariance.amount) {
      addNotification('Validation', 'Amount is required', 'warning');
      return;
    }

    setLoading(true);
    try {
      await createVarianceLog({
        branchId: activeBranch.id,
        varianceType: newVariance.varianceType,
        amount: parseFloat(newVariance.amount),
        description: newVariance.description,
      });
      setShowCreateModal(false);
      setNewVariance({ varianceType: 'cash_short', amount: '', description: '' });
      addNotification('Created', 'Variance log entry created', 'success');
      loadData();
    } catch (err: any) {
      addNotification('Error', err.message || 'Failed to create variance log', 'error');
    } finally {
      setLoading(false);
    }
  };

  // =============================================
  // Resolve variance
  // =============================================
  const handleResolve = async () => {
    if (!resolvingLog || !resolutionNote) {
      addNotification('Validation', 'Resolution note is required', 'warning');
      return;
    }

    setLoading(true);
    try {
      await resolveVarianceLog(resolvingLog.id, resolutionNote, resolveAction);
      setShowResolveModal(false);
      setResolvingLog(null);
      setResolutionNote('');
      addNotification('Resolved', `Variance ${resolveAction} successfully`, 'success');
      loadData();
    } catch (err: any) {
      addNotification('Error', err.message || 'Failed to resolve variance', 'error');
    } finally {
      setLoading(false);
    }
  };

  // =============================================
  // Computed
  // =============================================
  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(l =>
      l.description?.toLowerCase().includes(q) ||
      l.varianceType.toLowerCase().includes(q) ||
      l.resolutionNote?.toLowerCase().includes(q)
    );
  }, [logs, searchQuery]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-50 text-red-700 border-red-200';
      case 'investigating': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'resolved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'ignored': return 'bg-slate-100 text-slate-500 border-slate-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'cash_short': return 'text-red-600';
      case 'cash_over': return 'text-emerald-600';
      case 'bank_difference': return 'text-blue-600';
      case 'unmatched_entry': return 'text-amber-600';
      case 'missing_entry': return 'text-purple-600';
      default: return 'text-slate-600';
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'cash_short': return 'Cash Short';
      case 'cash_over': return 'Cash Over';
      case 'bank_difference': return 'Bank Difference';
      case 'unmatched_entry': return 'Unmatched Entry';
      case 'missing_entry': return 'Missing Entry';
      default: return type;
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'cash_short': return <TrendingDown className="w-4 h-4" />;
      case 'cash_over': return <TrendingUp className="w-4 h-4" />;
      case 'bank_difference': return <Landmark className="w-4 h-4" />;
      case 'unmatched_entry': return <FileWarning className="w-4 h-4" />;
      case 'missing_entry': return <Activity className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  // =============================================
  // RENDER
  // =============================================
  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Variance Analysis & Exception Handling
          </h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
            <span>Investigate and resolve cash/bank variances, unmatched entries, and missing records</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-3.5 h-3.5" /> Log Variance
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-red-50 rounded-lg"><AlertTriangle className="w-4 h-4 text-red-500" /></div>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Open Exceptions</span>
          </div>
          <div className="text-2xl font-black text-red-600 font-mono mt-1">{summary.totalOpen}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-emerald-50 rounded-lg"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></div>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Resolved</span>
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono mt-1">{summary.totalResolved}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-amber-50 rounded-lg"><Scale className="w-4 h-4 text-amber-500" /></div>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Total Variance Amount</span>
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono mt-1">{formatNPR(summary.totalAmount)}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-blue-50 rounded-lg"><Activity className="w-4 h-4 text-blue-500" /></div>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">By Type Breakdown</span>
          </div>
          <div className="mt-2 space-y-1">
            {Object.entries(summary.byType).map(([type, data]) => (
              <div key={type} className="flex items-center justify-between text-[10px]">
                <span className={`${typeColor(type)} font-medium`}>{typeLabel(type)}</span>
                <span className="font-mono text-slate-600">{data.count} ({formatNPR(data.amount)})</span>
              </div>
            ))}
            {Object.keys(summary.byType).length === 0 && (
              <span className="text-[10px] text-slate-400">No variances</span>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500"
              placeholder="Search variances..."
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'open', 'investigating', 'resolved', 'ignored'] as FilterStatus[]).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  filterStatus === s ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(['all', 'cash_short', 'cash_over', 'bank_difference', 'unmatched_entry', 'missing_entry'] as FilterType[]).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  filterType === t ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {t === 'all' ? 'All Types' : typeLabel(t)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Variance List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No variances found</p>
          <p className="text-xs text-slate-400 mt-1">All accounts are within expected ranges</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Type</th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Description</th>
                <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Amount</th>
                <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Status</th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Reported By</th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Created</th>
                <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">
                    <div className={`flex items-center gap-1.5 ${typeColor(log.varianceType)}`}>
                      {typeIcon(log.varianceType)}
                      <span className="font-medium">{typeLabel(log.varianceType)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 max-w-[250px] truncate">
                    {log.description || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                    {formatNPR(Number(log.amount))}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColor(log.status)}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{log.reportedBy || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {new Date(log.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {(log.status === 'open' || log.status === 'investigating') && (
                      <button
                        onClick={() => {
                          setResolvingLog(log);
                          setResolutionNote('');
                          setResolveAction('resolved');
                          setShowResolveModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <MessageSquare className="w-4 h-4 inline" />
                      </button>
                    )}
                    {log.status === 'resolved' && (
                      <span className="text-[10px] text-emerald-600 font-medium">
                        {log.resolvedBy}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================
          CREATE MODAL
          ============================================ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Log New Variance</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Variance Type</label>
                <select
                  value={newVariance.varianceType}
                  onChange={e => setNewVariance(p => ({ ...p, varianceType: e.target.value as any }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cash_short">Cash Short</option>
                  <option value="cash_over">Cash Over</option>
                  <option value="bank_difference">Bank Difference</option>
                  <option value="unmatched_entry">Unmatched Entry</option>
                  <option value="missing_entry">Missing Entry</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Amount (NPR)</label>
                <input
                  type="number"
                  value={newVariance.amount}
                  onChange={e => setNewVariance(p => ({ ...p, amount: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Description</label>
                <textarea
                  value={newVariance.description}
                  onChange={e => setNewVariance(p => ({ ...p, description: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Describe the variance..."
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateVariance}
                disabled={loading || !newVariance.amount}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          RESOLVE MODAL
          ============================================ */}
      {showResolveModal && resolvingLog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Resolve Variance</h3>
              <button onClick={() => setShowResolveModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Variance info */}
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${typeColor(resolvingLog.varianceType)}`}>
                    {typeLabel(resolvingLog.varianceType)}
                  </span>
                  <span className="text-sm font-bold font-mono">{formatNPR(Number(resolvingLog.amount))}</span>
                </div>
                {resolvingLog.description && (
                  <p className="text-[10px] text-slate-500 mt-1">{resolvingLog.description}</p>
                )}
              </div>

              {/* Action */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Action</label>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setResolveAction('resolved')}
                    className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                      resolveAction === 'resolved'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> Resolve
                  </button>
                  <button
                    onClick={() => setResolveAction('ignored')}
                    className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                      resolveAction === 'ignored'
                        ? 'bg-slate-100 border-slate-300 text-slate-600'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5 inline mr-1" /> Ignore
                  </button>
                </div>
              </div>

              {/* Resolution note */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">
                  {resolveAction === 'resolved' ? 'Resolution Note' : 'Reason for Ignoring'} *
                </label>
                <textarea
                  value={resolutionNote}
                  onChange={e => setResolutionNote(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder={resolveAction === 'resolved'
                    ? 'Describe how the variance was resolved...'
                    : 'Explain why this variance is being ignored...'
                  }
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowResolveModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={loading || !resolutionNote}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50 ${
                  resolveAction === 'resolved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-600 hover:bg-slate-700'
                }`}
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : resolveAction === 'resolved' ? 'Resolve' : 'Ignore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
