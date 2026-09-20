import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Key, Search, Plus, Trash2, X, AlertTriangle, Loader2, RefreshCw,
  Copy, CheckCircle2, XCircle, Eye, EyeOff, RotateCw, Ban, Shield,
  Clock, Hash, Building2, ChevronDown, ChevronRight, AlertCircle,
} from 'lucide-react';
import { useCoop } from '../../../context/CoopContext';
import { useSuperAdminAuth } from '../../../stores/superAdminAuthStore';
import { superAdminApi } from '../../../lib/superAdminApi';

/* ── Types ─────────────────────────────────────────────────────────────── */

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  keyPreview: string;
  scopes: string[];
  rateLimit: number;
  organizationId: string | null;
  status: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiKeyStats {
  totalKeys: number;
  activeKeys: number;
  revokedKeys: number;
  expiredKeys: number;
}

interface CreateKeyResult {
  key: string;
  secret: string;
  keyPrefix: string;
  keyPreview: string;
  id: string;
  name: string;
  scopes: string[];
  rateLimit: number;
  organizationId: string | null;
  expiresAt: string | null;
  status: string;
  createdAt: string;
}

/* ── Constants ─────────────────────────────────────────────────────────── */

const STATUS_BADGE: Record<string, string> = {
  Active: 'bg-emerald-100/80 text-emerald-800 border-emerald-200',
  Revoked: 'bg-rose-100/80 text-rose-800 border-rose-200',
  Expired: 'bg-slate-100 text-slate-600 border-slate-200',
};

const SCOPE_OPTIONS = [
  { value: '*', label: 'All (*)' },
  { value: 'orgs:read', label: 'Organizations Read' },
  { value: 'orgs:write', label: 'Organizations Write' },
  { value: 'members:read', label: 'Members Read' },
  { value: 'members:write', label: 'Members Write' },
  { value: 'finance:read', label: 'Finance Read' },
  { value: 'finance:write', label: 'Finance Write' },
];

const apiKeysQueryKeys = {
  all: ['apiKeys'] as const,
  stats: ['apiKeys', 'stats'] as const,
  list: (params: Record<string, string>) => ['apiKeys', 'list', params] as const,
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

function formatDate(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function timeAgo(v: string | null | undefined): string {
  if (!v) return 'Never';
  const d = new Date(v);
  if (isNaN(d.getTime())) return 'Never';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  MAIN VIEW                                                              */
/* ════════════════════════════════════════════════════════════════════════ */

export const ApiKeysView: React.FC = () => {
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailKey, setDetailKey] = useState<ApiKeyRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<ApiKeyRow | null>(null);
  const [revokeRow, setRevokeRow] = useState<ApiKeyRow | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<CreateKeyResult | null>(null);
  const [rotatedCredentials, setRotatedCredentials] = useState<CreateKeyResult | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p.search = search;
    if (statusFilter !== 'All') p.status = statusFilter;
    p.page = String(page);
    p.limit = String(pageSize);
    return p;
  }, [search, statusFilter, page, pageSize]);

  const statsQuery = useQuery({
    queryKey: apiKeysQueryKeys.stats,
    queryFn: () => superAdminApi.getApiKeyStats(accessToken!) as Promise<ApiKeyStats>,
    enabled: !!accessToken,
    placeholderData: (prev) => prev,
  });

  const listQuery = useQuery({
    queryKey: apiKeysQueryKeys.list(queryParams),
    queryFn: () => superAdminApi.getApiKeys(accessToken!, queryParams) as Promise<{ data: ApiKeyRow[]; total: number; page: number; limit: number; totalPages: number }>,
    enabled: !!accessToken,
    placeholderData: (prev) => prev,
  });

  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: apiKeysQueryKeys.all });

  const stats = statsQuery.data;
  const data = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, listQuery.data?.totalPages ?? 1);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.deleteApiKey(accessToken!, id),
    onSuccess: () => {
      invalidateAll();
      addNotification('API Key Deleted', 'The API key has been permanently deleted.', 'success');
      setDeleteRow(null);
      setDetailKey(null);
    },
    onError: (err: any) => addNotification('Delete Failed', err?.message || 'Could not delete API key.', 'alert'),
  });

  const revokeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      superAdminApi.revokeApiKey(accessToken!, id, reason),
    onSuccess: () => {
      invalidateAll();
      addNotification('API Key Revoked', 'The API key has been revoked and can no longer be used.', 'success');
      setRevokeRow(null);
      setDetailKey(null);
    },
    onError: (err: any) => addNotification('Revoke Failed', err?.message || 'Could not revoke API key.', 'alert'),
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.rotateApiKey(accessToken!, id),
    onSuccess: (result: any) => {
      invalidateAll();
      setRotatedCredentials(result);
      setShowSecret(true);
      addNotification('API Key Rotated', 'A new key pair has been generated. The old key has been revoked.', 'success');
    },
    onError: (err: any) => addNotification('Rotate Failed', err?.message || 'Could not rotate API key.', 'alert'),
  });

  const statCards = [
    { label: 'Total Keys', value: stats?.totalKeys ?? 0, icon: Key, color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700' },
    { label: 'Active', value: stats?.activeKeys ?? 0, icon: CheckCircle2, color: '#16a34a', bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700' },
    { label: 'Revoked', value: stats?.revokedKeys ?? 0, icon: Ban, color: '#dc2626', bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700' },
    { label: 'Expired', value: stats?.expiredKeys ?? 0, icon: Clock, color: '#64748b', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' },
  ];

  return (
    <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
            <Key className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">API Keys</h1>
            <p className="text-xs text-slate-500">Manage platform API keys for external integrations and mobile app access</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => invalidateAll()} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer shadow-2xs" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowCreateModal(true)} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>Create API Key</span>
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl ${s.bg} border ${s.border} flex items-center justify-center shrink-0`}>
                  <Icon className="w-4.5 h-4.5" style={{ color: s.color }} />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{s.label}</div>
                  <div className="text-xl font-extrabold text-slate-900">{s.value}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-52">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search keys by name..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer min-w-28"
        >
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Revoked">Revoked</option>
          <option value="Expired">Expired</option>
        </select>
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
        >
          {[10, 20, 50, 100].map((s) => <option key={s} value={s}>{s} / page</option>)}
        </select>
      </div>

      {/* TABLE */}
      {listQuery.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-slate-100/80 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800 mb-1">Failed to load API keys</p>
          <p className="text-xs text-slate-500 mb-4">{(listQuery.error as any)?.message}</p>
          <button onClick={() => invalidateAll()} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer">Retry</button>
        </div>
      ) : data.length === 0 ? (
        <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl">
          <Key className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800 mb-1">No API keys found</p>
          <p className="text-xs text-slate-500 mb-4">
            {search || statusFilter !== 'All' ? 'No keys match your filters.' : 'Create your first API key to get started.'}
          </p>
          {!search && statusFilter === 'All' && (
            <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 mx-auto">
              <Plus className="w-3.5 h-3.5" /> Create API Key
            </button>
          )}
        </div>
      ) : (
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-bold text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-600">Key</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-600">Scopes</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-600">Rate Limit</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-600">Last Used</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-600">Created</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((k) => (
                  <tr
                    key={k.id}
                    className="border-b border-slate-100 hover:bg-slate-50/60 transition cursor-pointer"
                    onClick={() => setDetailKey(k)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                          <Key className="w-3.5 h-3.5 text-emerald-700" />
                        </div>
                        <span className="font-bold text-slate-900 truncate max-w-[180px]">{k.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {k.keyPrefix}****{k.keyPreview?.slice(-4) || '****'}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(k.scopes || []).slice(0, 2).map((s) => (
                          <span key={s} className="px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[9px] font-bold">{s}</span>
                        ))}
                        {(k.scopes || []).length > 2 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-bold">+{k.scopes.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{k.rateLimit.toLocaleString()}/hr</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${STATUS_BADGE[k.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {k.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500" title={formatDateTime(k.lastUsedAt)}>
                      {timeAgo(k.lastUsedAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(k.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setDetailKey(k)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {k.status === 'Active' && (
                          <button
                            onClick={() => setRevokeRow(k)}
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition cursor-pointer"
                            title="Revoke"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteRow(k)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAGINATION */}
      {!listQuery.isPending && !listQuery.isError && total > 0 && (
        <div className="px-4 py-3 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-2 bg-slate-50/60">
          <span className="text-xs text-slate-500">
            Showing <b className="text-slate-800">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</b> of <b className="text-slate-800">{total}</b> keys
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">Prev</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-xs font-bold cursor-pointer ${p === page ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">Next</button>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <CreateKeyModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(result) => {
            setShowCreateModal(false);
            setCreatedCredentials(result);
            setShowSecret(true);
            invalidateAll();
          }}
        />
      )}

      {/* CREDENTIALS SHOW-ONCE MODAL (create) */}
      {createdCredentials && showSecret && (
        <CredentialsModal
          title="API Key Created"
          credentials={createdCredentials}
          onClose={() => { setCreatedCredentials(null); setShowSecret(false); }}
        />
      )}

      {/* CREDENTIALS SHOW-ONCE MODAL (rotate) */}
      {rotatedCredentials && showSecret && (
        <CredentialsModal
          title="API Key Rotated"
          credentials={rotatedCredentials}
          onClose={() => { setRotatedCredentials(null); setShowSecret(false); }}
        />
      )}

      {/* DETAIL DRAWER */}
      {detailKey && (
        <KeyDetailDrawer
          apiKey={detailKey}
          onClose={() => setDetailKey(null)}
          onRotate={(id) => rotateMutation.mutate(id)}
          onRevoke={(key) => { setDetailKey(null); setRevokeRow(key); }}
          onDelete={(key) => { setDetailKey(null); setDeleteRow(key); }}
          isRotating={rotateMutation.isPending}
        />
      )}

      {/* REVOKE MODAL */}
      {revokeRow && (
        <RevokeModal
          apiKey={revokeRow}
          onConfirm={(reason) => revokeMutation.mutate({ id: revokeRow.id, reason })}
          onClose={() => setRevokeRow(null)}
          isPending={revokeMutation.isPending}
        />
      )}

      {/* DELETE MODAL */}
      {deleteRow && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Delete API Key</h3>
              <button onClick={() => setDeleteRow(null)} className="text-slate-500 hover:text-slate-600 font-bold text-sm cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 text-xs space-y-3">
              <div className="flex items-start gap-2.5 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Are you sure you want to permanently delete <b>{deleteRow.name}</b>? This action cannot be undone.
                </span>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button onClick={() => setDeleteRow(null)} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteRow.id)} disabled={deleteMutation.isPending} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
                {deleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════ */
/*  CREATE KEY MODAL                                                       */
/* ════════════════════════════════════════════════════════════════════════ */

function CreateKeyModal(props: { onClose: () => void; onCreated: (result: CreateKeyResult) => void }) {
  const { onClose, onCreated } = props;
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();

  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['*']);
  const [rateLimit, setRateLimit] = useState('1000');
  const [expiresAt, setExpiresAt] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      superAdminApi.createApiKey(accessToken!, {
        name,
        scopes,
        rateLimit: parseInt(rateLimit, 10) || 1000,
        expiresAt: expiresAt || undefined,
      }) as Promise<CreateKeyResult>,
    onSuccess: (result) => onCreated(result),
    onError: (err: any) => addNotification('Create Failed', err?.message || 'Could not create API key.', 'alert'),
  });

  const toggleScope = (s: string) => {
    if (s === '*') {
      setScopes(scopes.includes('*') ? [] : ['*']);
      return;
    }
    const next = scopes.filter((x) => x !== '*');
    if (next.includes(s)) {
      setScopes(next.filter((x) => x !== s));
    } else {
      setScopes([...next, s]);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-700" />
            Create API Key
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 font-bold text-sm cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-4 text-xs">
          {/* Name */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Key Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mobile App, External Integration"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Scopes */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Scopes</label>
            <div className="grid grid-cols-2 gap-1.5">
              {SCOPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition ${
                    scopes.includes(opt.value)
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={scopes.includes(opt.value)}
                    onChange={() => toggleScope(opt.value)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-medium">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Rate Limit */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Rate Limit (requests/hour)</label>
            <input
              type="number"
              value={rateLimit}
              onChange={(e) => setRateLimit(e.target.value)}
              min="1"
              max="100000"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Expiration */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Expiration Date (optional)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">Leave empty for no expiration.</p>
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer">Cancel</button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || createMutation.isPending}
            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create Key
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  CREDENTIALS SHOW-ONCE MODAL                                            */
/* ════════════════════════════════════════════════════════════════════════ */

function CredentialsModal(props: { title: string; credentials: CreateKeyResult; onClose: () => void }) {
  const { title, credentials, onClose } = props;
  const { addNotification } = useCoop();
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const copyToClipboard = async (text: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      addNotification('Copied', 'Copied to clipboard.', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addNotification('Copy Failed', 'Could not copy to clipboard.', 'alert');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-700" />
            {title}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 font-bold text-sm cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3 text-xs">
          {/* Warning */}
          <div className="flex items-start gap-2.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-medium">
              <b>Store these credentials securely.</b> This is the only time the secret will be shown. You won't be able to see it again.
            </span>
          </div>

          {/* API Key */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">API Key</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono text-[11px] text-slate-800 break-all">
                {credentials.key}
              </code>
              <button
                onClick={() => copyToClipboard(credentials.key, setCopiedKey)}
                className="shrink-0 p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                title="Copy API Key"
              >
                {copiedKey ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Secret */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Secret</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono text-[11px] text-slate-800 break-all">
                {credentials.secret}
              </code>
              <button
                onClick={() => copyToClipboard(credentials.secret, setCopiedSecret)}
                className="shrink-0 p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                title="Copy Secret"
              >
                {copiedSecret ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Name</span>
              <p className="font-bold text-slate-800">{credentials.name}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Scopes</span>
              <div className="flex gap-1 mt-0.5">
                {(credentials.scopes || []).map((s) => (
                  <span key={s} className="px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[9px] font-bold">{s}</span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Rate Limit</span>
              <p className="font-bold text-slate-800">{credentials.rateLimit.toLocaleString()}/hr</p>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex items-center justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs">
            I've Saved the Credentials
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  KEY DETAIL DRAWER                                                      */
/* ════════════════════════════════════════════════════════════════════════ */

function KeyDetailDrawer(props: {
  apiKey: ApiKeyRow;
  onClose: () => void;
  onRotate: (id: string) => void;
  onRevoke: (key: ApiKeyRow) => void;
  onDelete: (key: ApiKeyRow) => void;
  isRotating: boolean;
}) {
  const { apiKey, onClose, onRotate, onRevoke, onDelete, isRotating } = props;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-lg h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* HEADER */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              <Key className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 leading-tight truncate">{apiKey.name}</h2>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border mt-1 ${STATUS_BADGE[apiKey.status] ?? ''}`}>{apiKey.status}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition cursor-pointer shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Key Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">API Key</span>
            </div>
            <code className="block font-mono text-[11px] text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 break-all">
              {apiKey.keyPrefix}****{(apiKey.keyPreview || '').slice(-4) || '****'}
            </code>
            <p className="text-[10px] text-slate-400">Only the key prefix is shown for security. The full key was displayed at creation time.</p>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Scopes</span>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {(apiKey.scopes || []).map((s) => (
                  <span key={s} className="px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[9px] font-bold">{s}</span>
                ))}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Rate Limit</span>
              <p className="font-bold text-slate-900 mt-1">{apiKey.rateLimit.toLocaleString()} req/hr</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Created</span>
              <p className="font-bold text-slate-900 mt-1">{formatDate(apiKey.createdAt)}</p>
              <p className="text-[10px] text-slate-500">by {apiKey.createdBy}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Last Used</span>
              <p className="font-bold text-slate-900 mt-1">{timeAgo(apiKey.lastUsedAt)}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Expires</span>
              <p className="font-bold text-slate-900 mt-1">{apiKey.expiresAt ? formatDate(apiKey.expiresAt) : 'Never'}</p>
            </div>
            {apiKey.organizationId && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Organization</span>
                <p className="font-bold text-slate-900 mt-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> {apiKey.organizationId.slice(0, 8)}...</p>
              </div>
            )}
          </div>

          {/* Revocation info */}
          {apiKey.revokedAt && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 space-y-1">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wide">Revoked</span>
              <p className="font-bold text-rose-800">{formatDateTime(apiKey.revokedAt)}</p>
              {apiKey.revokedReason && <p className="text-[11px] text-rose-600">{apiKey.revokedReason}</p>}
            </div>
          )}
        </div>

        {/* ACTIONS */}
        <div className="p-4 border-t border-slate-200 flex items-center gap-2 shrink-0">
          {apiKey.status === 'Active' && (
            <>
              <button
                onClick={() => onRotate(apiKey.id)}
                disabled={isRotating}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isRotating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                Rotate Key
              </button>
              <button
                onClick={() => onRevoke(apiKey)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Ban className="w-3.5 h-3.5" /> Revoke
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(apiKey)}
            className="px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  REVOKE MODAL                                                           */
/* ════════════════════════════════════════════════════════════════════════ */

function RevokeModal(props: {
  apiKey: ApiKeyRow;
  onConfirm: (reason?: string) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const { apiKey, onConfirm, onClose, isPending } = props;
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Revoke API Key</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 font-bold text-sm cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 text-xs space-y-3">
          <div className="flex items-start gap-2.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Revoking <b>{apiKey.name}</b> will immediately prevent any application using this key from accessing the API.
            </span>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Compromised, no longer needed"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer">Cancel</button>
          <button onClick={() => onConfirm(reason || undefined)} disabled={isPending} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Revoke Key
          </button>
        </div>
      </div>
    </div>
  );
}
