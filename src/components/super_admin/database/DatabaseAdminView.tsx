import React, { useState, useEffect, useCallback } from 'react';
import {
  Database, Table2, Hash, Trash2, Terminal, RefreshCw, AlertTriangle,
  HardDrive, Activity, Server, Rows3, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, XCircle, Clock, Search, PlayCircle, ChevronDown, ChevronUp,
  Link2, ScanLine, AlertCircle, Info, Zap,
} from 'lucide-react';
import { useSuperAdminAuth } from '../../../stores/superAdminAuthStore';
import { superAdminApi } from '../../../lib/superAdminApi';

type Tab = 'tables' | 'indexes' | 'vacuum' | 'queries';

interface Overview {
  total_size: string;
  active_connections: number;
  max_connections: string;
  shared_buffers: string;
  work_mem: string;
  total_tables: number;
  total_rows: number;
}

interface TableStat {
  schemaname: string;
  table_name: string;
  row_count: number;
  total_size: string;
  index_size: string;
  seq_scan: number;
  idx_scan: number;
  n_tup_ins: number;
  n_tup_upd: number;
  n_tup_del: number;
  last_vacuum: string | null;
  last_autovacuum: string | null;
  last_analyze: string | null;
}

interface IndexStat {
  schemaname: string;
  tablename: string;
  indexname: string;
  index_size: string;
  scans: number;
}

interface VacuumStat {
  relname: string;
  last_vacuum: string | null;
  last_autovacuum: string | null;
  last_analyze: string | null;
  last_autoanalyze: string | null;
  n_dead_tup: number;
  n_live_tup: number;
}

interface QueryResult {
  rows: Record<string, any>[];
  rowCount: number;
  executionTimeMs: number;
}

type SortField = 'table_name' | 'row_count' | 'total_size' | 'index_size' | 'seq_scan' | 'idx_scan' | 'n_tup_ins' | 'n_tup_upd' | 'n_tup_del';
type SortDir = 'asc' | 'desc';

export const DatabaseAdminView: React.FC = () => {
  const { accessToken } = useSuperAdminAuth();

  const [activeTab, setActiveTab] = useState<Tab>('tables');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tables, setTables] = useState<TableStat[]>([]);
  const [indexes, setIndexes] = useState<IndexStat[]>([]);
  const [vacuum, setVacuum] = useState<VacuumStat[]>([]);
  const [queries, setQueries] = useState<{ available: boolean; queries: any[]; note?: string }>({ available: false, queries: [] });

  const [loading, setLoading] = useState(true);
  const [loadingTab, setLoadingTab] = useState(false);
  const [error, setError] = useState('');

  const [sortField, setSortField] = useState<SortField>('row_count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [sqlInput, setSqlInput] = useState('SELECT schemaname, tablename, indexname, idx_scan FROM pg_stat_user_indexes WHERE schemaname = \'public\' ORDER BY idx_scan ASC LIMIT 10;');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState('');

  const loadOverview = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await superAdminApi.getDbOverview(accessToken);
      setOverview(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load database overview.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const loadTables = useCallback(async () => {
    if (!accessToken) return;
    setLoadingTab(true);
    try {
      const data = await superAdminApi.getDbTables(accessToken);
      setTables(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load table stats.');
    } finally {
      setLoadingTab(false);
    }
  }, [accessToken]);

  const loadIndexes = useCallback(async () => {
    if (!accessToken) return;
    setLoadingTab(true);
    try {
      const data = await superAdminApi.getDbIndexes(accessToken);
      setIndexes(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load index stats.');
    } finally {
      setLoadingTab(false);
    }
  }, [accessToken]);

  const loadVacuum = useCallback(async () => {
    if (!accessToken) return;
    setLoadingTab(true);
    try {
      const data = await superAdminApi.getDbVacuum(accessToken);
      setVacuum(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load vacuum status.');
    } finally {
      setLoadingTab(false);
    }
  }, [accessToken]);

  const loadQueries = useCallback(async () => {
    if (!accessToken) return;
    setLoadingTab(true);
    try {
      const data = await superAdminApi.getDbQueries(accessToken);
      setQueries(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load query stats.');
    } finally {
      setLoadingTab(false);
    }
  }, [accessToken]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => {
    if (activeTab === 'tables') loadTables();
    else if (activeTab === 'indexes') loadIndexes();
    else if (activeTab === 'vacuum') loadVacuum();
    else if (activeTab === 'queries') loadQueries();
  }, [activeTab, loadTables, loadIndexes, loadVacuum, loadQueries]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedTables = [...tables].sort((a, b) => {
    let av: any = a[sortField];
    let bv: any = b[sortField];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleRunQuery = async () => {
    if (!accessToken || !sqlInput.trim()) return;
    setQueryLoading(true);
    setQueryError('');
    setQueryResult(null);
    try {
      const result = await superAdminApi.runDbQuery(accessToken, sqlInput.trim());
      setQueryResult(result);
    } catch (err: any) {
      setQueryError(err.message || 'Query failed.');
    } finally {
      setQueryLoading(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-emerald-600" />
      : <ArrowDown className="w-3 h-3 text-emerald-600" />;
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'tables', label: 'Tables', icon: Table2 },
    { key: 'indexes', label: 'Indexes', icon: Hash },
    { key: 'vacuum', label: 'Vacuum', icon: Trash2 },
    { key: 'queries', label: 'Query Console', icon: Terminal },
  ];

  const overviewCards = overview ? [
    { label: 'Total DB Size', value: overview.total_size, icon: HardDrive, color: 'bg-emerald-100 text-emerald-800' },
    { label: 'Active Connections', value: `${overview.active_connections} / ${overview.max_connections}`, icon: Activity, color: 'bg-indigo-100 text-indigo-800' },
    { label: 'Total Tables', value: String(overview.total_tables), icon: Table2, color: 'bg-teal-100 text-teal-800' },
    { label: 'Total Rows', value: overview.total_rows.toLocaleString(), icon: Rows3, color: 'bg-amber-100 text-amber-800' },
  ] : [];

  const statsSummary = overview ? [
    { label: 'Shared Buffers', value: overview.shared_buffers },
    { label: 'Work Memory', value: overview.work_mem },
    { label: 'Max Connections', value: overview.max_connections },
  ] : [];

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <Database className="w-6 h-6 text-emerald-700" />
              <span>Database Administration</span>
            </h1>
            <p className="text-slate-500 text-xs mt-1">Monitor PostgreSQL performance, table sizes, indexes, and vacuum status.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { loadOverview(); if (activeTab === 'tables') loadTables(); else if (activeTab === 'indexes') loadIndexes(); else if (activeTab === 'vacuum') loadVacuum(); else if (activeTab === 'queries') loadQueries(); }} className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition cursor-pointer" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto text-rose-500 hover:text-rose-700 cursor-pointer">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Overview Cards */}
      {loading && !overview ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs animate-pulse">
              <div className="h-4 w-10 bg-slate-200 rounded mb-3" />
              <div className="h-6 w-20 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-24 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {overviewCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-emerald-300 hover:shadow-sm transition group">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-xl ${card.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-lg font-extrabold text-slate-900">{card.value}</div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">{card.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Server Settings Bar */}
      {overview && (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-3 shadow-xs">
          <div className="flex items-center gap-6 text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-400" /> Server Settings
            </span>
            {statsSummary.map(s => (
              <span key={s.label} className="text-slate-600">
                <span className="text-slate-400">{s.label}:</span>{' '}
                <span className="font-semibold text-slate-800">{s.value}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex border-b border-slate-200">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? 'text-emerald-700 border-b-2 border-emerald-700 bg-emerald-50/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {loadingTab && (
            <div className="flex items-center justify-center py-12 text-slate-500 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading data...
            </div>
          )}

          {/* ─── Tables Tab ─── */}
          {activeTab === 'tables' && !loadingTab && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">
                      <button onClick={() => handleSort('table_name')} className="flex items-center gap-1 cursor-pointer hover:text-emerald-700">
                        Table <SortIcon field="table_name" />
                      </button>
                    </th>
                    <th className="text-right py-2.5 px-3 font-semibold text-slate-600">
                      <button onClick={() => handleSort('row_count')} className="flex items-center gap-1 cursor-pointer hover:text-emerald-700">
                        Rows <SortIcon field="row_count" />
                      </button>
                    </th>
                    <th className="text-right py-2.5 px-3 font-semibold text-slate-600">
                      <button onClick={() => handleSort('total_size')} className="flex items-center gap-1 cursor-pointer hover:text-emerald-700">
                        Total Size <SortIcon field="total_size" />
                      </button>
                    </th>
                    <th className="text-right py-2.5 px-3 font-semibold text-slate-600">
                      <button onClick={() => handleSort('index_size')} className="flex items-center gap-1 cursor-pointer hover:text-emerald-700">
                        Index Size <SortIcon field="index_size" />
                      </button>
                    </th>
                    <th className="text-right py-2.5 px-3 font-semibold text-slate-600">
                      <button onClick={() => handleSort('seq_scan')} className="flex items-center gap-1 cursor-pointer hover:text-emerald-700">
                        Seq Scans <SortIcon field="seq_scan" />
                      </button>
                    </th>
                    <th className="text-right py-2.5 px-3 font-semibold text-slate-600">
                      <button onClick={() => handleSort('idx_scan')} className="flex items-center gap-1 cursor-pointer hover:text-emerald-700">
                        Idx Scans <SortIcon field="idx_scan" />
                      </button>
                    </th>
                    <th className="text-right py-2.5 px-3 font-semibold text-slate-600">
                      <button onClick={() => handleSort('n_tup_ins')} className="flex items-center gap-1 cursor-pointer hover:text-emerald-700">
                        Inserts <SortIcon field="n_tup_ins" />
                      </button>
                    </th>
                    <th className="text-right py-2.5 px-3 font-semibold text-slate-600">
                      <button onClick={() => handleSort('n_tup_upd')} className="flex items-center gap-1 cursor-pointer hover:text-emerald-700">
                        Updates <SortIcon field="n_tup_upd" />
                      </button>
                    </th>
                    <th className="text-right py-2.5 px-3 font-semibold text-slate-600">
                      <button onClick={() => handleSort('n_tup_del')} className="flex items-center gap-1 cursor-pointer hover:text-emerald-700">
                        Deletes <SortIcon field="n_tup_del" />
                      </button>
                    </th>
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Last Vacuum</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Last Auto-vacuum</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTables.map((t, i) => {
                    const lowIdx = t.seq_scan > 0 && t.idx_scan === 0;
                    const warnRatio = t.seq_scan > 100 && t.idx_scan > 0 && (t.seq_scan / (t.idx_scan || 1)) > 10;
                    return (
                      <tr key={t.table_name} className={`border-b border-slate-100 hover:bg-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                        <td className="py-2 px-3 font-semibold text-slate-800">{t.table_name}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">{t.row_count.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-slate-600">{t.total_size}</td>
                        <td className="py-2 px-3 text-right text-slate-600">{t.index_size}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={`font-mono ${lowIdx ? 'text-amber-600 font-bold' : 'text-slate-700'}`}>
                            {t.seq_scan.toLocaleString()}
                            {lowIdx && <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold">LOW IDX</span>}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className={`font-mono ${t.idx_scan === 0 ? 'text-rose-500 font-bold' : 'text-slate-700'}`}>
                            {t.idx_scan.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">{t.n_tup_ins.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">{t.n_tup_upd.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">{t.n_tup_del.toLocaleString()}</td>
                        <td className="py-2 px-3 text-slate-500 text-[10px] whitespace-nowrap">
                          {t.last_vacuum ? new Date(t.last_vacuum).toLocaleString() : <span className="text-slate-400">never</span>}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[10px] whitespace-nowrap">
                          {t.last_autovacuum ? new Date(t.last_autovacuum).toLocaleString() : <span className="text-slate-400">never</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {sortedTables.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-slate-500">
                        <Table2 className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        No table statistics found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── Indexes Tab ─── */}
          {activeTab === 'indexes' && !loadingTab && (
            <div className="overflow-x-auto">
              <div className="mb-3 flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Info className="w-3.5 h-3.5" /> Indexes with 0 scans are candidates for removal
                </span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Table</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Index Name</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-slate-600">Size</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-slate-600">Scans</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {indexes.map((idx, i) => {
                    const unused = !idx.scans;
                    return (
                      <tr key={idx.indexname} className={`border-b border-slate-100 hover:bg-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                        <td className="py-2 px-3 text-slate-700">{idx.tablename}</td>
                        <td className="py-2 px-3 font-mono text-slate-800 text-[11px]">{idx.indexname}</td>
                        <td className="py-2 px-3 text-right text-slate-600">{idx.index_size}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">{(idx.scans ?? 0).toLocaleString()}</td>
                        <td className="py-2 px-3">
                          {unused ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                              <AlertCircle className="w-3 h-3" /> Unused
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {indexes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500">
                        <Hash className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        No index statistics found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── Vacuum Tab ─── */}
          {activeTab === 'vacuum' && !loadingTab && (
            <div className="overflow-x-auto">
              <div className="mb-3 flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Info className="w-3.5 h-3.5" /> Tables with dead tuples may need vacuuming to reclaim space
                </span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Table</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-slate-600">Live Rows</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-slate-600">Dead Rows</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-slate-600">Dead Ratio</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Last Vacuum</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Last Auto-vacuum</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Last Analyze</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vacuum.map((v, i) => {
                    const ratio = v.n_live_tup > 0 ? (v.n_dead_tup / (v.n_dead_tup + v.n_live_tup)) * 100 : 0;
                    const needsVacuum = ratio > 20 || v.n_dead_tup > 10000;
                    return (
                      <tr key={v.relname} className={`border-b border-slate-100 hover:bg-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                        <td className="py-2 px-3 font-semibold text-slate-800">{v.relname}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">{v.n_live_tup.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-600 font-bold">{v.n_dead_tup.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${ratio > 20 ? 'bg-rose-500' : ratio > 10 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(ratio, 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-slate-600 w-10 text-right">{ratio.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[10px] whitespace-nowrap">
                          {v.last_vacuum ? new Date(v.last_vacuum).toLocaleString() : <span className="text-slate-400">never</span>}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[10px] whitespace-nowrap">
                          {v.last_autovacuum ? new Date(v.last_autovacuum).toLocaleString() : <span className="text-slate-400">never</span>}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[10px] whitespace-nowrap">
                          {v.last_analyze ? new Date(v.last_analyze).toLocaleString() : <span className="text-slate-400">never</span>}
                        </td>
                        <td className="py-2 px-3">
                          {needsVacuum ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                              <AlertTriangle className="w-3 h-3" /> Needs Vacuum
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3" /> OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {vacuum.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500">
                        <Trash2 className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        No tables with dead tuples. All clean!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── Query Console Tab ─── */}
          {activeTab === 'queries' && !loadingTab && (
            <div className="space-y-5">
              {/* Recent Queries (if available) */}
              {queries.available && queries.queries.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-600" /> Top Queries by Total Time
                  </h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left py-2 px-3 font-semibold text-slate-600">Query</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-600">Calls</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-600">Avg Time (ms)</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-600">Total Time (ms)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queries.queries.slice(0, 10).map((q: any, i: number) => (
                          <tr key={i} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 px-3 font-mono text-slate-700 text-[11px] max-w-md truncate" title={q.query}>
                              {q.query?.substring(0, 120)}{q.query?.length > 120 ? '...' : ''}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">{Number(q.calls).toLocaleString()}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">{Number(q.mean_exec_time).toFixed(2)}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">{Number(q.total_exec_time).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {queries.note && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium rounded-xl px-4 py-3">
                  <Info className="w-4 h-4 shrink-0" /> {queries.note}
                </div>
              )}

              {/* Query Console */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-600" /> SQL Query Console
                </h3>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-3">
                  <div className="flex items-center gap-2 text-amber-700 text-[11px] font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Read-only mode. Only SELECT, WITH, EXPLAIN, SHOW, TABLE, and DESCRIBE queries are allowed. Write operations (INSERT, UPDATE, DELETE, DROP, etc.) are blocked.
                  </div>
                </div>
                <div className="relative">
                  <textarea
                    value={sqlInput}
                    onChange={(e) => setSqlInput(e.target.value)}
                    placeholder="Enter a SQL query..."
                    className="w-full h-36 bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-xl border border-slate-700 focus:border-emerald-500 focus:outline-none resize-none placeholder:text-slate-500"
                    spellCheck={false}
                  />
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] text-slate-400">{sqlInput.length} characters</span>
                  <button
                    onClick={handleRunQuery}
                    disabled={queryLoading || !sqlInput.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    {queryLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PlayCircle className="w-3.5 h-3.5" />
                    )}
                    {queryLoading ? 'Running...' : 'Run Query'}
                  </button>
                </div>
              </div>

              {queryError && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-4 py-3">
                  <XCircle className="w-4 h-4 shrink-0" /> {queryError}
                </div>
              )}

              {/* Query Results */}
              {queryResult && (
                <div>
                  <div className="flex items-center gap-4 mb-3 text-xs">
                    <span className="text-slate-500">
                      <span className="font-bold text-slate-800">{queryResult.rowCount}</span> rows returned
                    </span>
                    <span className="text-slate-500">
                      in <span className="font-bold text-slate-800">{queryResult.executionTimeMs}</span> ms
                    </span>
                  </div>
                  {queryResult.rows.length > 0 ? (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            {Object.keys(queryResult.rows[0]).map(col => (
                              <th key={col} className="text-left py-2 px-3 font-semibold text-slate-600 whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResult.rows.slice(0, 200).map((row, i) => (
                            <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                              {Object.entries(row).map(([key, val]) => (
                                <td key={key} className="py-2 px-3 font-mono text-slate-700 text-[11px] max-w-xs truncate" title={String(val ?? '')}>
                                  {val === null ? <span className="text-slate-400 italic">null</span> : String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {queryResult.rows.length > 200 && (
                        <div className="text-center py-2 text-[10px] text-slate-500 bg-slate-50 border-t border-slate-200">
                          Showing first 200 of {queryResult.rowCount} rows
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      Query returned no rows.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
