import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package, Search, Plus, Edit, Trash2, X, AlertTriangle, Loader2, RefreshCw,
  CheckSquare, Square, Download, Upload, Sparkles, Settings, Users, Activity,
  GitBranch, Key, LayoutGrid, History, FileText, Lock, Layers, Star, Bell,
  Building2, DollarSign, TrendingUp, Filter, Ban, ListChecks, CheckCircle2,
  XCircle, Link2, ArrowRight, Boxes, LayoutDashboard, Box, Info,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { useCoop } from '../../../context/CoopContext';
import { useSuperAdminAuth } from '../../../stores/superAdminAuthStore';
import { superAdminApi } from '../../../lib/superAdminApi';

/* ── Types ─────────────────────────────────────────────────────────────── */

interface ModuleCategory {
  id: string; code: string; name: string; icon: string | null; color: string | null;
  description: string | null; sortOrder: number; isActive: boolean; moduleCount: number;
}

interface ModuleRow {
  id: string; code: string; name: string; nameNepali: string | null;
  shortDescription: string | null; longDescription: string | null;
  categoryId: string | null; type: string; icon: string | null; color: string | null;
  developer: string | null; website: string | null;
  versionCurrent: string | null; versionLatest: string | null;
  licenseType: string; status: string; isRequired: boolean; isSystem: boolean;
  isHidden: boolean; autoUpdate: boolean; releaseChannel: string;
  lastReleasedAt: string | null; lastCheckedAt: string | null; rating: string | null;
  downloadCount: number; installCount: number; sortOrder: number;
  createdAt: string; updatedAt: string | null;
  category: { id: string; name: string; code: string; color: string | null; icon: string | null } | null;
  featureCount: number; dependencyCount: number; organizationCount: number;
  health: { status: string; responseMs: number | null; uptime: string | null };
  needsUpdate: boolean;
  features?: any[]; dependencies?: any[]; versions?: any[]; settings?: any[];
  permissions?: any[]; licenses?: any[]; marketplace?: any;
  healthHistory?: any[]; usage?: any;
}

interface ModuleStats {
  totalModules: number; coreModules: number; optionalModules: number; premiumModules: number;
  enabledModules: number; disabledModules: number; organizationsUsingModules: number;
  activeOrganizations: number; mostUsedModule: { moduleId: string; count: number } | null;
  latestReleasedModule: { id: string; name: string; code: string; versionCurrent: string | null } | null;
  catalogValue: number;
}

interface Paginated<T> { data: T[]; total: number; page: number; limit: number; totalPages: number; }

interface OrgRow { id: string; organizationCode: string; organizationName: string; organizationType: string | null; status: string; }
interface AssignmentRow {
  id: string; organizationId: string; moduleId: string; status: string;
  licenseId: string | null; isTrial: boolean; activationDate: string | null;
  expiryDate: string | null; autoRenew: boolean; notes: string | null;
  versionInstalled: string | null; createdAt: string; updatedAt: string | null;
  orgName: string; orgCode: string; orgStatus: string; licenseName: string | null; licenseType: string | null;
}

/* ── Constants ─────────────────────────────────────────────────────────── */

const TYPE_BADGE: Record<string, string> = {
  Core: 'bg-emerald-100/80 text-emerald-800 border-emerald-200',
  Optional: 'bg-sky-100/80 text-sky-800 border-sky-200',
  Premium: 'bg-amber-100/80 text-amber-800 border-amber-200',
  Enterprise: 'bg-indigo-100/80 text-indigo-800 border-indigo-200',
  Marketplace: 'bg-fuchsia-100/80 text-fuchsia-800 border-fuchsia-200',
  Partner: 'bg-violet-100/80 text-violet-800 border-violet-200',
  Custom: 'bg-cyan-100/80 text-cyan-800 border-cyan-200',
  Experimental: 'bg-orange-100/80 text-orange-800 border-orange-200',
  Beta: 'bg-blue-100/80 text-blue-800 border-blue-200',
  Deprecated: 'bg-rose-100/80 text-rose-800 border-rose-200',
  Hidden: 'bg-slate-200/80 text-slate-700 border-slate-300',
};

const STATUS_BADGE: Record<string, string> = {
  Active: 'bg-emerald-100/80 text-emerald-800 border-emerald-200',
  Inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  Draft: 'bg-slate-100 text-slate-600 border-slate-200',
  Beta: 'bg-blue-100/80 text-blue-800 border-blue-200',
  Deprecated: 'bg-rose-100/80 text-rose-800 border-rose-200',
};

const LIC_BADGE: Record<string, string> = {
  Free: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Trial: 'bg-sky-50 text-sky-700 border-sky-200',
  Monthly: 'bg-amber-50 text-amber-700 border-amber-200',
  Quarterly: 'bg-orange-50 text-orange-700 border-orange-200',
  Yearly: 'bg-violet-50 text-violet-700 border-violet-200',
  Lifetime: 'bg-slate-50 text-slate-700 border-slate-200',
  Enterprise: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Custom: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

const HEALTH_BADGE: Record<string, string> = {
  Healthy: 'bg-emerald-100/80 text-emerald-800 border-emerald-200',
  Degraded: 'bg-amber-100/80 text-amber-800 border-amber-200',
  Down: 'bg-rose-100/80 text-rose-800 border-rose-200',
  Unknown: 'bg-slate-100 text-slate-600 border-slate-200',
};

const ORG_STATUS_BADGE: Record<string, string> = {
  Enabled: 'bg-emerald-100/80 text-emerald-800 border-emerald-200',
  Disabled: 'bg-slate-100 text-slate-600 border-slate-200',
  Trial: 'bg-sky-100/80 text-sky-800 border-sky-200',
  Pending: 'bg-amber-100/80 text-amber-800 border-amber-200',
  Expired: 'bg-rose-100/80 text-rose-800 border-rose-200',
};

const MODULE_TYPES = ['All', 'Core', 'Optional', 'Premium', 'Enterprise', 'Marketplace', 'Partner', 'Custom', 'Experimental', 'Beta', 'Deprecated', 'Hidden'];
const MODULE_STATUSES = ['All', 'Active', 'Inactive', 'Draft', 'Beta', 'Deprecated'];
const LICENSE_TYPES = ['All', 'Free', 'Trial', 'Monthly', 'Quarterly', 'Yearly', 'Lifetime', 'Enterprise', 'Custom'];
const SORTS = [
  { value: 'name', label: 'Sort: Name' },
  { value: 'createdAt', label: 'Sort: Created' },
  { value: 'installCount', label: 'Sort: Installs' },
  { value: 'sortOrder', label: 'Sort: Default' },
];
const PAGE_SIZES = [12, 24, 48, 96];

const ICON_MAP: Record<string, any> = {
  Users, Percent: Package, PiggyBank: Package, HandCoins: Package, BookOpen: Package, BarChart3: Package,
  Briefcase: Package, Wallet: Package, Clock: Package, Landmark: Package, Contact: Package,
  MessageSquare: Package, Mail: Package, Sparkles, Smartphone: Package, ShieldCheck: Package,
  Building2, Puzzle: Package, Lock, Package, Boxes, Layers, Settings, Activity, Globe: Box,
  LayoutDashboard, FileText, Link2, Cpu: Box, Wheat: Box, Factory: Box, Building: Building2,
  ShoppingBag: Box, Wrench: Box,
};

const moduleKeys = {
  all: ['modules'] as const,
  stats: ['modules', 'stats'] as const,
  list: (q: Record<string, any>) => ['modules', 'list', q] as const,
  categories: ['modules', 'categories'] as const,
  detail: (id: string) => ['modules', 'detail', id] as const,
  usage: (id: string, days: number) => ['modules', 'usage', id, days] as const,
  assignments: (id: string) => ['modules', 'assignments', id] as const,
  audit: ['modules', 'audit'] as const,
  notifications: ['modules', 'notifications'] as const,
  templates: ['modules', 'templates'] as const,
  recommendations: ['modules', 'recommendations'] as const,
  orgs: (q: Record<string, any>) => ['modules', 'orgs', q] as const,
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatBytes(n: number | null | undefined): string {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

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

function moduleIcon(icon: string | null | undefined, size = 'w-5 h-5', color: string | null | undefined = '#059669') {
  const key = icon || 'Package';
  const Icon = ICON_MAP[key] ?? Package;
  return <Icon className={size} style={{ color }} />;
}

function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  MAIN VIEW                                                              */
/* ════════════════════════════════════════════════════════════════════════ */

export const ModuleManagementView: React.FC = () => {
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [licenseFilter, setLicenseFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);

  // Selection & dialogs
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerModule, setDrawerModule] = useState<ModuleRow | null>(null);
  const [assignDialog, setAssignDialog] = useState<{ moduleIds: string[] } | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [deleteRow, setDeleteRow] = useState<ModuleRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const queryParams = useMemo(() => ({
    search: search || undefined,
    categoryId: categoryId === 'All' ? undefined : categoryId,
    type: typeFilter,
    status: statusFilter,
    licenseType: licenseFilter,
    sortBy,
    sortDir,
    page,
    limit: pageSize,
  }), [search, categoryId, typeFilter, statusFilter, licenseFilter, sortBy, sortDir, page, pageSize]);

  const statsQuery = useQuery({
    queryKey: moduleKeys.stats,
    queryFn: () => superAdminApi.getModuleStats(accessToken!) as Promise<ModuleStats>,
    enabled: !!accessToken,
    placeholderData: (prev) => prev,
  });

  const categoriesQuery = useQuery({
    queryKey: moduleKeys.categories,
    queryFn: () => superAdminApi.getModuleCategories(accessToken!) as Promise<ModuleCategory[]>,
    enabled: !!accessToken,
    placeholderData: (prev) => prev,
  });

  const listQuery = useQuery({
    queryKey: moduleKeys.list(queryParams),
    queryFn: () => superAdminApi.getModules(accessToken!, queryParams) as Promise<Paginated<ModuleRow>>,
    enabled: !!accessToken,
    placeholderData: (prev) => prev,
  });

  const notificationsQuery = useQuery({
    queryKey: moduleKeys.notifications,
    queryFn: () => superAdminApi.getModuleNotifications(accessToken!, { limit: 20 }),
    enabled: !!accessToken && showNotifications,
  });

  const recommendationsQuery = useQuery({
    queryKey: moduleKeys.recommendations,
    queryFn: () => superAdminApi.getModuleRecommendations(accessToken!),
    enabled: !!accessToken,
  });

  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: moduleKeys.all });

  const stats = statsQuery.data;
  const categories = categoriesQuery.data ?? [];
  const data = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, listQuery.data?.totalPages ?? 1);

  // Mutations
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      superAdminApi.updateModule(accessToken!, id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: moduleKeys.all });
      const previous = queryClient.getQueriesData({ queryKey: moduleKeys.all });
      queryClient.setQueriesData<Paginated<ModuleRow>>({ queryKey: moduleKeys.list(queryParams) }, (old) =>
        old ? { ...old, data: old.data.map((r) => (r.id === id ? { ...r, status } : r)) } : old
      );
      return { previous };
    },
    onSuccess: (_v, { status }) => addNotification('Status Updated', `Module ${status === 'Active' ? 'enabled' : 'disabled'} successfully.`, 'success'),
    onError: (err: any, _vars, context: any) => {
      if (context?.previous) for (const [k, v] of context.previous) queryClient.setQueryData(k, v);
      addNotification('Status Update Failed', err?.message || 'Could not update module status.', 'alert');
    },
    onSettled: () => invalidateAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.deleteModule(accessToken!, id),
    onSuccess: () => { invalidateAll(); addNotification('Module Deleted', 'Module deleted successfully.', 'success'); setDeleteRow(null); },
    onError: (err: any) => addNotification('Delete Failed', err?.message || 'Could not delete module.', 'alert'),
  });

  const recommendationsMutation = useMutation({
    mutationFn: () => superAdminApi.generateModuleRecommendations(accessToken!),
    onSuccess: (r: any) => {
      invalidateAll();
      addNotification('Recommendations', `Generated ${r.generated ?? 0} new recommendation(s).`, 'success');
    },
    onError: (err: any) => addNotification('Generate Failed', err?.message || 'Could not generate recommendations.', 'alert'),
  });

  const toggleRow = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (data.length === 0) return;
    const allSelected = data.every((r) => selected.has(r.id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) data.forEach((r) => next.delete(r.id));
      else data.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const bulkEnable = (enabled: boolean) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    Promise.allSettled(ids.map((id) => superAdminApi.updateModule(accessToken!, id, { status: enabled ? 'Active' : 'Inactive' })))
      .then((res) => {
        const failed = res.filter((r) => r.status === 'rejected').length;
        invalidateAll();
        addNotification('Bulk Action', failed === 0
          ? `${ids.length} module(s) ${enabled ? 'enabled' : 'disabled'}.`
          : `${ids.length - failed} succeeded, ${failed} failed (check dependencies).`, failed === 0 ? 'success' : 'warning');
        setSelected(new Set());
      });
  };

  const bulkExport = () => {
    if (selected.size === 0) return;
    const rows = data.filter((r) => selected.has(r.id)).map((r) => ({
      code: r.code, name: r.name, nameNepali: r.nameNepali, type: r.type, categoryId: r.categoryId,
      shortDescription: r.shortDescription, licenseType: r.licenseType, status: r.status,
      isRequired: r.isRequired, versionCurrent: r.versionCurrent, versionLatest: r.versionLatest,
      icon: r.icon, color: r.color, sortOrder: r.sortOrder,
    }));
    downloadJSON(`modules-export-${Date.now()}.json`, rows);
    addNotification('Export', `Exported ${rows.length} module(s).`, 'success');
  };

  const allPageSelected = data.length > 0 && data.every((r) => selected.has(r.id));
  const hasFilters = !!(search || categoryId !== 'All' || typeFilter !== 'All' || statusFilter !== 'All' || licenseFilter !== 'All');
  const statCards = [
    { label: 'Total Modules', value: formatNumber(stats?.totalModules), icon: Box, color: '#059669' },
    { label: 'Core Modules', value: formatNumber(stats?.coreModules), icon: LayoutDashboard, color: '#059669' },
    { label: 'Optional Modules', value: formatNumber(stats?.optionalModules), icon: Boxes, color: '#0ea5e9' },
    { label: 'Premium Modules', value: formatNumber(stats?.premiumModules), icon: Star, color: '#d97706' },
    { label: 'Enabled', value: formatNumber(stats?.enabledModules), icon: CheckCircle2, color: '#16a34a' },
    { label: 'Disabled', value: formatNumber(stats?.disabledModules), icon: XCircle, color: '#64748b' },
    { label: 'Orgs Using Modules', value: formatNumber(stats?.organizationsUsingModules), icon: Building2, color: '#7c3aed' },
    { label: 'Catalog Value (NPR)', value: formatNumber(stats?.catalogValue), icon: TrendingUp, color: '#059669' },
  ];

  return (
    <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
            <Package className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Module Management</h1>
            <p className="text-xs text-slate-500">Enterprise module catalog, licensing & organization assignments</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowNotifications((v) => !v)}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer relative shadow-2xs"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-11 z-50 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Module Notifications</span>
                  <button onClick={() => setShowNotifications(false)} className="text-slate-500 hover:text-slate-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  {(notificationsQuery.data ?? []).length === 0 ? (
                    <p className="p-4 text-xs text-slate-500 text-center">No notifications</p>
                  ) : (notificationsQuery.data ?? []).map((n: any) => (
                    <div key={n.id} className="px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{n.type}</span>
                        <span className="ml-auto text-[10px] text-slate-500">{formatDateTime(n.createdAt)}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{n.title}</p>
                      {n.body && <p className="text-[11px] text-slate-500 mt-0.5">{n.body}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setImportOpen(true)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer shadow-2xs" title="Import Modules">
            <Upload className="w-4 h-4" />
          </button>
          <button onClick={bulkExport} disabled={selected.size === 0} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed" title="Export Selected">
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => recommendationsMutation.mutate()}
            disabled={recommendationsMutation.isPending}
            className="px-3 py-2 rounded-xl border border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold transition cursor-pointer shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
            title="Generate AI-style module recommendations"
          >
            {recommendationsMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate AI
          </button>
          <button onClick={() => setCreateModal(true)} className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>New Module</span>
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-2.5">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-tight">{s.label}</div>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-1.5">{s.value}</div>
            </div>
          );
        })}
      </div>

      {/* MOST USED / LATEST STRIP */}
      {(stats?.mostUsedModule || stats?.latestReleasedModule) && (
        <div className="flex flex-wrap gap-2.5">
          {stats?.mostUsedModule && (
            <div className="px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-slate-600">Most used module:</span>
              <span className="font-bold text-slate-900">#{stats.mostUsedModule.count} installs</span>
            </div>
          )}
          {stats?.latestReleasedModule && (
            <div className="px-3 py-2 rounded-xl bg-sky-50/70 border border-sky-200 text-xs flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-sky-700" />
              <span className="text-slate-600">Latest release:</span>
              <span className="font-bold text-slate-900">{stats.latestReleasedModule.name} <span className="text-slate-500 font-medium">v{stats.latestReleasedModule.versionCurrent}</span></span>
            </div>
          )}
          {(recommendationsQuery.data ?? []).length > 0 && (
            <div className="px-3 py-2 rounded-xl bg-violet-50/70 border border-violet-200 text-xs flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-violet-700" />
              <span className="text-slate-600">{recommendationsQuery.data.length} AI recommendation(s) available</span>
            </div>
          )}
        </div>
      )}

      {/* BODY: SIDEBAR + CONTENT */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* LEFT SIDEBAR */}
        <aside className="lg:w-60 shrink-0 space-y-3">
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <Filter className="w-3 h-3" /> Categories
              </span>
              {(categoryId !== 'All' || typeFilter !== 'All' || statusFilter !== 'All' || licenseFilter !== 'All') && (
                <button onClick={() => { setCategoryId('All'); setTypeFilter('All'); setStatusFilter('All'); setLicenseFilter('All'); }} className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer">
                  Clear
                </button>
              )}
            </div>
            <button
              onClick={() => setCategoryId('All')}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-between mb-1 ${ categoryId === 'All' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-700 hover:bg-white hover:shadow-2xs' }`}
            >
              <span className="flex items-center gap-2"><LayoutDashboard className="w-3.5 h-3.5" /> All Modules</span>
              <span className={`text-[10px] font-bold ${categoryId === 'All' ? 'text-emerald-100' : 'text-slate-500'}`}>{total}</span>
            </button>
            <div className="max-h-96 overflow-y-auto custom-scrollbar pr-0.5 space-y-0.5">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCategoryId(categoryId === c.id ? 'All' : c.id); setPage(1); }}
                  className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer flex items-center justify-between ${ categoryId === c.id ? 'bg-emerald-100/80 text-emerald-900 border border-emerald-200' : 'text-slate-600 hover:bg-white hover:shadow-2xs' }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.color || '#059669' }} />
                    {c.name}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">{c.moduleCount}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Module Type</span>
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
              {MODULE_TYPES.map((t) => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
            </select>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Status</span>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
              {MODULE_STATUSES.map((s) => <option key={s} value={s}>{s === 'All' ? 'All Status' : s}</option>)}
            </select>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">License</span>
            <select value={licenseFilter} onChange={(e) => { setLicenseFilter(e.target.value); setPage(1); }} className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
              {LICENSE_TYPES.map((l) => <option key={l} value={l}>{l === 'All' ? 'All Licenses' : l}</option>)}
            </select>
          </div>
        </aside>

        {/* CONTENT */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* TOOLBAR */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-52">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search modules by name, code, or description..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
              />
            </div>
            <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer min-w-32">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer shadow-2xs" title="Toggle direction">
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer">
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
            </select>
            <button onClick={() => invalidateAll()} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer shadow-2xs" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* BULK BAR */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-emerald-50/70 border border-emerald-200 rounded-xl px-3 py-2 text-xs animate-in fade-in duration-100">
              <span className="font-bold text-emerald-800">{selected.size} selected</span>
              <button onClick={() => setAssignDialog({ moduleIds: Array.from(selected) })} className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer">
                Assign to Organizations
              </button>
              <button onClick={() => bulkEnable(true)} className="px-2.5 py-1.5 bg-slate-600 hover:bg-slate-200 text-slate-800 rounded-lg font-bold cursor-pointer">Enable</button>
              <button onClick={() => bulkEnable(false)} className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold cursor-pointer">Disable</button>
              <button onClick={bulkExport} className="px-2.5 py-1.5 border border-emerald-300 text-emerald-800 rounded-lg font-bold hover:bg-emerald-100 cursor-pointer">Export</button>
              <button onClick={() => setSelected(new Set())} className="px-2.5 py-1.5 border border-emerald-300 text-emerald-800 rounded-lg font-bold hover:bg-emerald-100 cursor-pointer">Clear</button>
            </div>
          )}

          {/* GRID */}
          {listQuery.isPending ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-44 bg-slate-100/80 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : listQuery.isError ? (
            <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl">
              <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800 mb-1">Failed to load modules</p>
              <p className="text-xs text-slate-500 mb-4">{(listQuery.error as any)?.message}</p>
              <button onClick={() => invalidateAll()} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer">Retry</button>
            </div>
          ) : data.length === 0 ? (
            <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl">
              <Package className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800 mb-1">No modules found</p>
              <p className="text-xs text-slate-500 mb-4">
                {hasFilters ? 'No modules match your current filters.' : 'Create your first module to get started.'}
              </p>
              {!hasFilters && (
                <button onClick={() => setCreateModal(true)} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 mx-auto">
                  <Plus className="w-3.5 h-3.5" /> New Module
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {data.map((m) => {
                const Icon = ICON_MAP[m.icon || 'Package'] ?? Package;
                return (
                  <div
                    key={m.id}
                    className={`bg-white border rounded-2xl p-4 shadow-2xs transition hover:shadow-md hover:border-emerald-200 cursor-pointer ${selected.has(m.id) ? 'border-emerald-400 ring-1 ring-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}
                    onClick={() => setDrawerModule(m)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleRow(m.id); }}
                          className={`mt-0.5 cursor-pointer shrink-0 ${selected.has(m.id) ? 'text-emerald-700' : 'text-slate-600 hover:text-slate-500'}`}
                          title="Select"
                        >
                          {selected.has(m.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>
                        <div className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0" style={{ backgroundColor: `${m.color || '#059669'}18`, borderColor: `${m.color || '#059669'}30` }}>
                          <Icon className="w-5 h-5" style={{ color: m.color || '#059669' }} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-900 truncate flex items-center gap-1.5">
                            {m.name}
                            {m.needsUpdate && (
                              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-bold shrink-0" title="Update available">v{m.versionLatest}</span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">{m.code}{m.isRequired ? ' · REQUIRED' : ''}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${TYPE_BADGE[m.type] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>{m.type}</span>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${STATUS_BADGE[m.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{m.status}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-2.5 line-clamp-2 min-h-8">{m.shortDescription || 'No description provided.'}</p>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[9px] font-bold text-slate-500">v{m.versionCurrent}</span>
                      {m.category && <span className="px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[9px] font-bold text-slate-500">{m.category.name}</span>}
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold border" style={{ color: '#059669', borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' }}>{m.licenseType}</span>
                    </div>

                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400" /> {m.rating ?? '0'}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3 text-emerald-600" /> {m.organizationCount} orgs</span>
                      <span className="flex items-center gap-1"><ListChecks className="w-3 h-3 text-sky-600" /> {m.featureCount} features</span>
                      <span className="flex items-center gap-1"><Link2 className="w-3 h-3 text-violet-600" /> {m.dependencyCount} deps</span>
                      <span className={`ml-auto inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${HEALTH_BADGE[m.health?.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{m.health?.status ?? 'Unknown'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PAGINATION */}
          {!listQuery.isPending && !listQuery.isError && total > 0 && (
            <div className="px-4 py-3 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-2 bg-slate-50/60">
              <span className="text-xs text-slate-500">
                Showing <b className="text-slate-800">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</b> of <b className="text-slate-800">{total}</b> modules
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
        </div>
      </div>

      {/* DRAWER */}
      {drawerModule && (
        <ModuleDetailDrawer
          moduleId={drawerModule.id}
          initial={drawerModule}
          onClose={() => setDrawerModule(null)}
          onAssign={() => { setDrawerModule(null); setAssignDialog({ moduleIds: [drawerModule.id] }); }}
        />
      )}

      {/* ASSIGN DIALOG */}
      {assignDialog && (
        <AssignModulesDialog
          moduleIds={assignDialog.moduleIds}
          onClose={() => setAssignDialog(null)}
        />
      )}

      {/* CREATE MODAL */}
      {createModal && <CreateModuleModal onClose={() => setCreateModal(false)} />}

      {/* DELETE MODAL */}
      {deleteRow && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Delete Module</h3>
              <button onClick={() => setDeleteRow(null)} className="text-slate-500 hover:text-slate-600 font-bold text-sm cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 text-xs space-y-3">
              <div className="flex items-start gap-2.5 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Are you sure you want to delete <b>{deleteRow.name}</b> ({deleteRow.code})? This action cannot be undone.
                  {deleteRow.organizationCount > 0 && <span className="block mt-1 font-bold">Assigned to {deleteRow.organizationCount} organization(s) — unassign them first.</span>}
                </span>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button onClick={() => setDeleteRow(null)} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteRow.id)} disabled={deleteMutation.isPending} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
                {deleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {importOpen && <ImportModulesModal onClose={() => setImportOpen(false)} />}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════ */
/*  MODULE DETAIL DRAWER (11 tabs)                                         */
/* ════════════════════════════════════════════════════════════════════════ */

type DrawerTab = 'overview' | 'features' | 'organizations' | 'dependencies' | 'permissions' | 'license' | 'versions' | 'usage' | 'settings' | 'audit' | 'api';

const DRAWER_TABS: { id: DrawerTab; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'features', label: 'Features', icon: ListChecks },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'dependencies', label: 'Dependencies', icon: GitBranch },
  { id: 'permissions', label: 'Permissions', icon: Key },
  { id: 'license', label: 'License', icon: DollarSign },
  { id: 'versions', label: 'Version History', icon: History },
  { id: 'usage', label: 'Usage Analytics', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'audit', label: 'Audit Logs', icon: FileText },
  { id: 'api', label: 'API', icon: Key },
];

function ModuleDetailDrawer(props: {
  moduleId: string;
  initial: ModuleRow;
  onClose: () => void;
  onAssign: () => void;
}) {
  const { moduleId, initial, onClose, onAssign } = props;
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<DrawerTab>('overview');
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: moduleKeys.detail(moduleId),
    queryFn: () => superAdminApi.getModule(accessToken!, moduleId) as Promise<ModuleRow>,
    enabled: !!accessToken,
    placeholderData: (prev) => prev,
  });

  const assignmentsQuery = useQuery({
    queryKey: moduleKeys.assignments(moduleId),
    queryFn: () => superAdminApi.listModuleAssignments(accessToken!, moduleId) as Promise<AssignmentRow[]>,
    enabled: !!accessToken,
  });

  const m = detailQuery.data ?? initial;
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: moduleKeys.detail(moduleId) });
    queryClient.invalidateQueries({ queryKey: moduleKeys.assignments(moduleId) });
    queryClient.invalidateQueries({ queryKey: moduleKeys.all });
  };

  const toggleMutation = useMutation({
    mutationFn: (status: string) => superAdminApi.updateModule(accessToken!, moduleId, { status }),
    onSuccess: (_v, status) => { invalidate(); addNotification('Status Updated', `Module ${status === 'Active' ? 'enabled' : 'disabled'}.`, 'success'); },
    onError: (err: any) => addNotification('Status Update Failed', err?.message || 'Could not update status.', 'alert'),
  });

  const Icon = ICON_MAP[m.icon || 'Package'] ?? Package;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-6xl h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* HEADER */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl border flex items-center justify-center shrink-0" style={{ backgroundColor: `${m.color || '#059669'}18`, borderColor: `${m.color || '#059669'}30` }}>
              <Icon className="w-6 h-6" style={{ color: m.color || '#059669' }} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 leading-tight truncate">{m.name}</h2>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${TYPE_BADGE[m.type] ?? ''}`}>{m.type}</span>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${STATUS_BADGE[m.status] ?? ''}`}>{m.status}</span>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${LIC_BADGE[m.licenseType] ?? ''}`}>{m.licenseType}</span>
                {m.isRequired && <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border bg-rose-50 text-rose-700 border-rose-200">REQUIRED</span>}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                <span className="font-mono font-bold text-slate-500">{m.code}</span>
                {m.category?.name && <> · {m.category.name}</>}
                <> · v{m.versionCurrent}</>
                {m.needsUpdate && <span className="text-amber-600 font-bold"> · update available (v{m.versionLatest})</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setTab('usage')} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer" title="Analytics"><Activity className="w-4 h-4" /></button>
            <button onClick={() => setTab('audit')} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer" title="Logs"><FileText className="w-4 h-4" /></button>
            <button onClick={onAssign} className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Assign</button>
            <button
              onClick={() => toggleMutation.mutate(m.status === 'Active' ? 'Inactive' : 'Active')}
              disabled={toggleMutation.isPending}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 ${m.status === 'Active' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-700 hover:bg-emerald-800 text-white'}`}
            >
              {toggleMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : m.status === 'Active' ? 'Disable' : 'Enable'}
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* TABS */}
        <div className="px-4 pt-2 border-b border-slate-200 flex items-center gap-1 overflow-x-auto custom-scrollbar shrink-0">
          {DRAWER_TABS.map((t) => {
            const TabIcon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-bold transition cursor-pointer whitespace-nowrap border-b-2 ${ isActive ? 'border-emerald-700 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-800' }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {tab === 'overview' && <OverviewTab m={m} />}
          {tab === 'features' && <FeaturesTab m={m} />}
          {tab === 'organizations' && <OrganizationsTab m={m} assignments={assignmentsQuery.data ?? []} onAssign={onAssign} />}
          {tab === 'dependencies' && <DependenciesTab m={m} />}
          {tab === 'permissions' && <PermissionsTab m={m} />}
          {tab === 'license' && <LicenseTab m={m} />}
          {tab === 'versions' && <VersionsTab m={m} />}
          {tab === 'usage' && <UsageTab m={m} />}
          {tab === 'settings' && <SettingsTab m={m} />}
          {tab === 'audit' && <AuditTab moduleId={moduleId} />}
          {tab === 'api' && <ApiTab m={m} />}
        </div>
      </div>
    </div>
  );
}

/* ── Overview tab ──────────────────────────────────────────────────────── */
function OverviewTab({ m }: { m: ModuleRow }) {
  const meta = [
    { label: 'Developer', value: m.developer || '—' },
    { label: 'Website', value: m.website || '—' },
    { label: 'Release Channel', value: m.releaseChannel || '—' },
    { label: 'Auto Update', value: m.autoUpdate ? 'Yes' : 'No' },
    { label: 'Rating', value: `${m.rating ?? '0'} / 5` },
    { label: 'Downloads', value: formatNumber(m.downloadCount) },
    { label: 'Installs', value: formatNumber(m.installCount) },
    { label: 'Last Checked', value: formatDateTime(m.lastCheckedAt) },
    { label: 'Last Released', value: formatDateTime(m.lastReleasedAt) },
    { label: 'Created', value: formatDateTime(m.createdAt) },
  ];
  return (
    <div className="p-5 space-y-5">
      {m.longDescription && (
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Description</h3>
          <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3">{m.longDescription || m.shortDescription}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <MetricCard label="Organizations" value={formatNumber(m.organizationCount)} icon={Building2} color="#059669" />
        <MetricCard label="Features" value={formatNumber(m.featureCount)} icon={ListChecks} color="#0ea5e9" />
        <MetricCard label="Dependencies" value={formatNumber(m.dependencyCount)} icon={GitBranch} color="#7c3aed" />
        <MetricCard label="Health" value={m.health?.status ?? 'Unknown'} icon={Activity} color={m.health?.status === 'Healthy' ? '#16a34a' : '#d97706'} />
        <MetricCard label="Latest Version" value={m.versionLatest ?? '—'} icon={History} color="#059669" />
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Module Details</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {meta.map((row) => (
            <div key={row.label} className="bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{row.label}</div>
              <div className="text-xs font-bold text-slate-900 mt-0.5 break-all">{row.value}</div>
            </div>
          ))}
        </div>
      </div>

      {m.healthHistory && m.healthHistory.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Health History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead><tr className="bg-slate-100 text-slate-800 font-bold"><th className="p-2.5 rounded-l-lg">Status</th><th className="p-2.5">Response</th><th className="p-2.5">Uptime</th><th className="p-2.5 rounded-r-lg">Checked At</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(m.healthHistory ?? []).map((h: any, i: number) => (
                  <tr key={i}>
                    <td className="p-2.5"><span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${HEALTH_BADGE[h.status] ?? ''}`}>{h.status}</span></td>
                    <td className="p-2.5 text-slate-700 font-mono">{h.responseMs} ms</td>
                    <td className="p-2.5 text-slate-700">{h.uptime}%</td>
                    <td className="p-2.5 text-slate-500">{formatDateTime(h.checkedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {m.marketplace && (
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Marketplace</h3>
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap gap-2 items-center text-xs">
            <span className={`px-2 py-0.5 rounded-full font-bold border ${m.marketplace.status === 'Featured' ? 'bg-violet-100 text-violet-800 border-violet-200' : m.marketplace.status === 'Published' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{m.marketplace.status}</span>
            {m.marketplace.price > 0 && <span className="font-bold text-slate-900">NPR {Number(m.marketplace.price).toLocaleString()}</span>}
            {m.marketplace.featured && <span className="text-violet-700 font-bold flex items-center gap-1"><Star className="w-3 h-3" /> Featured</span>}
            {m.marketplace.docsUrl && <a href={m.marketplace.docsUrl} target="_blank" rel="noreferrer" className="text-emerald-700 font-bold flex items-center gap-1 hover:underline">Docs <ArrowRight className="w-3 h-3" /></a>}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center"><Icon className="w-3.5 h-3.5" style={{ color }} /></div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{label}</div>
      </div>
      <div className="text-lg font-extrabold text-slate-900 mt-1.5">{value}</div>
    </div>
  );
}

/* ── Features tab ──────────────────────────────────────────────────────── */
function FeaturesTab({ m }: { m: ModuleRow }) {
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const features = m.features ?? [];

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      superAdminApi.updateModuleFeature(accessToken!, m.id, id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moduleKeys.detail(m.id) });
      queryClient.invalidateQueries({ queryKey: moduleKeys.all });
      addNotification('Feature Updated', 'Feature flag updated.', 'success');
    },
    onError: (err: any) => addNotification('Update Failed', err?.message || 'Could not update feature.', 'alert'),
  });

  const createMutation = useMutation({
    mutationFn: () => superAdminApi.createModuleFeature(accessToken!, m.id, { code: code.trim(), name: name.trim(), description, isActive: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moduleKeys.detail(m.id) });
      queryClient.invalidateQueries({ queryKey: moduleKeys.all });
      setShowForm(false); setCode(''); setName(''); setDescription('');
      addNotification('Feature Added', 'Feature added successfully.', 'success');
    },
    onError: (err: any) => addNotification('Add Failed', err?.message || 'Could not add feature.', 'alert'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.deleteModuleFeature(accessToken!, m.id, id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: moduleKeys.detail(m.id) }); queryClient.invalidateQueries({ queryKey: moduleKeys.all }); addNotification('Feature Deleted', 'Feature removed.', 'success'); },
    onError: (err: any) => addNotification('Delete Failed', err?.message || 'Could not delete feature.', 'alert'),
  });

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Feature Flags</h3>
          <p className="text-xs text-slate-500">{features.length} features — each can be toggled per organization.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Feature</button>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5 animate-in fade-in duration-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Feature code (e.g. fixed_deposit)" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Feature name" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
            <button onClick={() => createMutation.mutate()} disabled={!code.trim() || !name.trim() || createMutation.isPending} className="px-4 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
              {createMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Add Feature
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {features.length === 0 && <p className="p-4 text-xs text-slate-500 text-center">No features defined for this module.</p>}
        {features.map((f: any) => (
          <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/70">
            <div className={`w-2 h-2 rounded-full shrink-0 ${f.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">{f.name}</span>
                <span className="font-mono text-[10px] text-slate-500">{f.code}</span>
                {f.isRequired && <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-bold">REQUIRED</span>}
              </div>
              {f.description && <p className="text-[11px] text-slate-500 mt-0.5">{f.description}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[10px] font-bold ${f.isActive ? 'text-emerald-700' : 'text-slate-500'}`}>{f.isActive ? 'On' : 'Off'}</span>
              <button
                onClick={() => toggleMutation.mutate({ id: f.id, isActive: !f.isActive })}
                className={`w-9 h-5 rounded-full p-0.5 transition cursor-pointer flex items-center ${f.isActive ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'}`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
              </button>
              <button onClick={() => deleteMutation.mutate(f.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Organizations tab ─────────────────────────────────────────────────── */
function OrganizationsTab({ m, assignments, onAssign }: { m: ModuleRow; assignments: AssignmentRow[]; onAssign: () => void }) {
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: ({ orgId, status }: { orgId: string; status: string }) =>
      superAdminApi.toggleOrgModule(accessToken!, orgId, m.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moduleKeys.assignments(m.id) });
      queryClient.invalidateQueries({ queryKey: moduleKeys.all });
      addNotification('Assignment Updated', 'Organization module status updated.', 'success');
    },
    onError: (err: any) => addNotification('Update Failed', err?.message || 'Could not update assignment.', 'alert'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) =>
      superAdminApi.updateModuleAssignment(accessToken!, id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: moduleKeys.assignments(m.id) }); queryClient.invalidateQueries({ queryKey: moduleKeys.all }); addNotification('Assignment Updated', 'Assignment details updated.', 'success'); },
    onError: (err: any) => addNotification('Update Failed', err?.message || 'Could not update assignment.', 'alert'),
  });

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Organization Assignments</h3>
          <p className="text-xs text-slate-500">{assignments.length} organization(s) using this module.</p>
        </div>
        <button onClick={onAssign} className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Assign</button>
      </div>

      {assignments.length === 0 ? (
        <div className="p-8 text-center bg-white border border-dashed border-slate-300 rounded-xl">
          <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No organizations yet</p>
          <p className="text-xs text-slate-500 mt-1 mb-4">Assign this module to organizations to enable it.</p>
          <button onClick={onAssign} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer">Assign to Organizations</button>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead><tr className="bg-slate-100 text-slate-800 font-bold">
              <th className="p-2.5 pl-3 rounded-l-lg">Organization</th>
              <th className="p-2.5">Status</th>
              <th className="p-2.5">License</th>
              <th className="p-2.5">Version</th>
              <th className="p-2.5">Activation</th>
              <th className="p-2.5">Expiry</th>
              <th className="p-2.5 pr-3 rounded-r-lg text-center">Toggle</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {assignments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/70">
                  <td className="p-2.5 pl-3">
                    <div className="font-bold text-slate-900">{a.orgName}</div>
                    <div className="text-[10px] font-mono text-slate-500">{a.orgCode}{a.isTrial ? ' · TRIAL' : ''}</div>
                  </td>
                  <td className="p-2.5"><span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${ORG_STATUS_BADGE[a.status] ?? ''}`}>{a.status}</span></td>
                  <td className="p-2.5 text-slate-700">{a.licenseName || '—'}</td>
                  <td className="p-2.5 font-mono text-slate-600">{a.versionInstalled || '—'}</td>
                  <td className="p-2.5 text-slate-500">{formatDate(a.activationDate)}</td>
                  <td className="p-2.5 text-slate-500">{formatDate(a.expiryDate)}</td>
                  <td className="p-2.5 pr-3 text-center">
                    <button
                      onClick={() => toggleMutation.mutate({ orgId: a.organizationId, status: a.status === 'Enabled' ? 'Disabled' : 'Enabled' })}
                      disabled={toggleMutation.isPending}
                      className={`w-9 h-5 rounded-full p-0.5 transition cursor-pointer flex items-center inline-flex ${a.status === 'Enabled' ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'}`}
                      title={a.status === 'Enabled' ? 'Disable' : 'Enable'}
                    >
                      <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Dependencies tab ──────────────────────────────────────────────────── */
function DependenciesTab({ m }: { m: ModuleRow }) {
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [depModuleId, setDepModuleId] = useState('');
  const [minVersion, setMinVersion] = useState('');
  const [note, setNote] = useState('');

  const deps = m.dependencies ?? [];

  const addMutation = useMutation({
    mutationFn: () => superAdminApi.addModuleDependency(accessToken!, m.id, { dependsOnModuleId: depModuleId, minVersion: minVersion || null, note: note || null }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: moduleKeys.detail(m.id) }); queryClient.invalidateQueries({ queryKey: moduleKeys.all }); setShowForm(false); setDepModuleId(''); setMinVersion(''); setNote(''); addNotification('Dependency Added', 'Dependency added successfully.', 'success'); },
    onError: (err: any) => addNotification('Add Failed', err?.message || 'Could not add dependency.', 'alert'),
  });

  const removeMutation = useMutation({
    mutationFn: (depId: string) => superAdminApi.removeModuleDependency(accessToken!, m.id, depId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: moduleKeys.detail(m.id) }); queryClient.invalidateQueries({ queryKey: moduleKeys.all }); addNotification('Dependency Removed', 'Dependency removed.', 'success'); },
    onError: (err: any) => addNotification('Remove Failed', err?.message || 'Could not remove dependency.', 'alert'),
  });

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Module Dependencies</h3>
          <p className="text-xs text-slate-500">Required modules are enforced by the dependency engine on disable/assign.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Dependency</button>
      </div>

      {showForm && <AddDependencyForm m={m} onCancel={() => setShowForm(false)} onSubmit={addMutation.mutate} submitting={addMutation.isPending} depModuleId={depModuleId} setDepModuleId={setDepModuleId} minVersion={minVersion} setMinVersion={setMinVersion} note={note} setNote={setNote} />}

      {deps.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl">This module has no dependencies.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {deps.map((d: any) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/70">
              <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">{moduleIcon(d.depIcon, 'w-4 h-4', d.depColor)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{d.depName}</span>
                  <span className="font-mono text-[10px] text-slate-500">{d.depCode}</span>
                  {d.isRequired && <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-bold">REQUIRED</span>}
                </div>
                {d.minVersion && <p className="text-[10px] text-slate-500 mt-0.5">Min version <b className="font-mono">{d.minVersion}</b></p>}
                {d.note && <p className="text-[10px] text-slate-500 mt-0.5">{d.note}</p>}
              </div>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${STATUS_BADGE[d.depStatus] ?? ''}`}>{d.depStatus}</span>
              <button onClick={() => removeMutation.mutate(d.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddDependencyForm(props: {
  m: ModuleRow; onCancel: () => void; onSubmit: () => void; submitting: boolean;
  depModuleId: string; setDepModuleId: (v: string) => void;
  minVersion: string; setMinVersion: (v: string) => void;
  note: string; setNote: (v: string) => void;
}) {
  const { onCancel, onSubmit, submitting, depModuleId, setDepModuleId, minVersion, setMinVersion, note, setNote } = props;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5 animate-in fade-in duration-100">
      <input value={depModuleId} onChange={(e) => setDepModuleId(e.target.value)} placeholder="Dependency module ID (UUID)" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      <div className="grid grid-cols-2 gap-2.5">
        <input value={minVersion} onChange={(e) => setMinVersion(e.target.value)} placeholder="Min version (e.g. 1.0.0)" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
        <button onClick={onSubmit} disabled={!depModuleId.trim() || submitting} className="px-4 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
          {submitting && <Loader2 className="w-3 h-3 animate-spin" />} Add Dependency
        </button>
      </div>
    </div>
  );
}

/* ── Permissions tab ───────────────────────────────────────────────────── */
function PermissionsTab({ m }: { m: ModuleRow }) {
  const perms = m.permissions ?? [];
  return (
    <div className="p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Permission Catalog</h3>
        <p className="text-xs text-slate-500">Standard actions exposed by this module. Grant or revoke per organization role in the matrix below.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {perms.map((p: any) => (
          <span key={p.id} className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 capitalize">{p.action}</span>
        ))}
        {perms.length === 0 && <p className="text-xs text-slate-500">No permission actions defined.</p>}
      </div>
      <OrgPermissionMatrix m={m} />
    </div>
  );
}

function OrgPermissionMatrix({ m }: { m: ModuleRow }) {
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [orgId, setOrgId] = useState('');
  const [perms, setPerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    superAdminApi.getModuleOrgList(accessToken, { limit: 100 })
      .then((res: any) => setOrgs(res.data ?? []))
      .catch(() => setOrgs([]));
  }, [accessToken]);

  useEffect(() => {
    if (!orgId || !accessToken) { setPerms([]); return; }
    setLoading(true);
    superAdminApi.listOrgModulePermissions(accessToken, orgId, m.id)
      .then((rows: any) => {
        const permsByRole: Record<string, Record<string, boolean>> = {};
        const roles = ['org_admin', 'manager', 'teller', 'cashier', 'accountant', 'loan_officer', 'member_service'];
        roles.forEach((r) => { permsByRole[r] = {}; (m.permissions ?? []).forEach((p: any) => { permsByRole[r][p.action] = true; }); });
        (rows ?? []).forEach((row: any) => {
          if (!permsByRole[row.role]) permsByRole[row.role] = {};
          permsByRole[row.role][row.action] = row.granted;
        });
        setPerms([{ role: 'org_admin', granted: permsByRole['org_admin'] }, { role: 'manager', granted: permsByRole['manager'] }, { role: 'teller', granted: permsByRole['teller'] }, { role: 'cashier', granted: permsByRole['cashier'] }, { role: 'accountant', granted: permsByRole['accountant'] }, { role: 'loan_officer', granted: permsByRole['loan_officer'] }, { role: 'member_service', granted: permsByRole['member_service'] }]);
      })
      .catch(() => setPerms([]))
      .finally(() => setLoading(false));
  }, [orgId, accessToken, m.id, m.permissions]);

  const setMutation = useMutation({
    mutationFn: ({ role, action, granted }: { role: string; action: string; granted: boolean }) =>
      superAdminApi.setOrgModulePermission(accessToken!, orgId, m.id, role, action, granted),
    onError: (err: any) => addNotification('Permission Update Failed', err?.message || 'Could not update permission.', 'alert'),
  });

  const handleToggle = (role: string, action: string, granted: boolean) => {
    setPerms((prev) => prev.map((r) => (r.role === role ? { ...r, granted: { ...r.granted, [action]: granted } } : r)));
    setMutation.mutate({ role, action, granted });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-3 border-b border-slate-200 bg-slate-50/70">
        <label className="text-xs font-bold text-slate-700">Organization (override matrix)</label>
        <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
          <option value="">— Select an organization —</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.organizationName}</option>)}
        </select>
      </div>
      {orgId && (loading ? (
        <div className="p-6 flex items-center justify-center text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading matrix...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead><tr className="bg-slate-100 text-slate-800 font-bold">
              <th className="p-2 pl-3">Role</th>
              {(m.permissions ?? []).map((p: any) => <th key={p.id} className="p-2 text-center">{p.action}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {perms.map((r: any) => (
                <tr key={r.role} className="hover:bg-slate-50">
                  <td className="p-2 pl-3 font-bold text-slate-700">{r.role}</td>
                  {(m.permissions ?? []).map((p: any) => (
                    <td key={p.id} className="p-2 text-center">
                      <input type="checkbox" checked={!!r.granted[p.action]} onChange={(e) => handleToggle(r.role, p.action, e.target.checked)} className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/* ── License tab ───────────────────────────────────────────────────────── */
function LicenseTab({ m }: { m: ModuleRow }) {
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();
  const licenses = m.licenses ?? [];

  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) => superAdminApi.createModuleLicense(accessToken!, m.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: moduleKeys.detail(m.id) }); queryClient.invalidateQueries({ queryKey: moduleKeys.all }); addNotification('License Added', 'License plan created.', 'success'); },
    onError: (err: any) => addNotification('Add Failed', err?.message || 'Could not add license.', 'alert'),
  });

  const deleteMutation = useMutation({
    mutationFn: (licenseId: string) => superAdminApi.deleteModuleLicense(accessToken!, m.id, licenseId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: moduleKeys.detail(m.id) }); queryClient.invalidateQueries({ queryKey: moduleKeys.all }); addNotification('License Deleted', 'License plan removed.', 'success'); },
    onError: (err: any) => addNotification('Delete Failed', err?.message || 'Could not delete license.', 'alert'),
  });

  return (
    <div className="p-5 space-y-3">
      <h3 className="text-sm font-bold text-slate-900">License Plans</h3>
      {licenses.length === 0 && <p className="text-xs text-slate-500">No license plans defined.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {licenses.map((l: any) => (
          <div key={l.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700"><DollarSign className="w-4 h-4" /></div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{l.name}</div>
                  <div className="font-mono text-[10px] text-slate-500">{l.code}</div>
                </div>
              </div>
              <button onClick={() => deleteMutation.mutate(l.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-xl font-extrabold text-slate-900">NPR {Number(l.price ?? 0).toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 capitalize">{l.billingPeriod || l.type}</div>
              </div>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${LIC_BADGE[l.type] ?? ''}`}>{l.type}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-3 text-[10px] text-slate-500">
              {l.maxUsers != null && <span>Max users: <b className="text-slate-800">{l.maxUsers}</b></span>}
              {l.maxBranches != null && <span>Branches: <b className="text-slate-800">{l.maxBranches}</b></span>}
              {l.trialDays > 0 && <span>Trial: <b className="text-slate-800">{l.trialDays} days</b></span>}
              {!l.isActive && <span className="text-slate-500 font-bold">INACTIVE</span>}
            </div>
          </div>
        ))}
      </div>
      <LicenseAddForm m={m} onSubmit={createMutation.mutate} submitting={createMutation.isPending} />
    </div>
  );
}

function LicenseAddForm(props: { m: ModuleRow; onSubmit: (d: Record<string, any>) => void; submitting: boolean }) {
  const { onSubmit, submitting } = props;
  const [code, setCode] = useState(''); const [name, setName] = useState('');
  const [type, setType] = useState('Monthly'); const [price, setPrice] = useState('');
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
      <div className="text-xs font-bold text-slate-700 mb-2">Add License Plan</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (e.g. starter)" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
          {['Free', 'Trial', 'Monthly', 'Quarterly', 'Yearly', 'Lifetime', 'Enterprise', 'Custom'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (NPR)" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <button
          onClick={() => onSubmit({ code: code.trim(), name: name.trim(), type, price: price || '0', currency: 'NPR', billingPeriod: type.toLowerCase(), trialDays: type === 'Trial' ? 14 : 0, isActive: true, sortOrder: 0 })}
          disabled={!code.trim() || !name.trim() || submitting}
          className="col-span-2 sm:col-span-1 px-4 py-2.5 bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {submitting && <Loader2 className="w-3 h-3 animate-spin" />} Create License
        </button>
      </div>
    </div>
  );
}

/* ── Versions tab ──────────────────────────────────────────────────────── */
function VersionsTab({ m }: { m: ModuleRow }) {
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [version, setVersion] = useState(''); const [channel, setChannel] = useState('Stable');
  const [notes, setNotes] = useState(''); const [isLatest, setIsLatest] = useState(true);
  const versions = m.versions ?? [];

  const createMutation = useMutation({
    mutationFn: () => superAdminApi.createModuleVersion(accessToken!, m.id, { version: version.trim(), channel, releaseNotes: notes, isLatest, releaseDate: new Date().toISOString(), sizeBytes: 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: moduleKeys.detail(m.id) }); queryClient.invalidateQueries({ queryKey: moduleKeys.all }); setShowForm(false); setVersion(''); setNotes(''); addNotification('Version Released', `v${version} released.`, 'success'); },
    onError: (err: any) => addNotification('Release Failed', err?.message || 'Could not release version.', 'alert'),
  });

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Version History</h3>
          <p className="text-xs text-slate-500">Current: <b className="font-mono">{m.versionCurrent}</b> · Latest: <b className="font-mono">{m.versionLatest}</b></p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Release Version</button>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5 animate-in fade-in duration-100">
          <div className="grid grid-cols-2 gap-2.5">
            <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Version (e.g. 1.2.0)" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
              {['Stable', 'Beta', 'LTS'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Release notes" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <label className="flex items-center gap-2 text-xs text-slate-700 font-bold cursor-pointer">
            <input type="checkbox" checked={isLatest} onChange={(e) => setIsLatest(e.target.checked)} className="accent-emerald-600" /> Mark as latest
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
            <button onClick={() => createMutation.mutate()} disabled={!version.trim() || createMutation.isPending} className="px-4 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
              {createMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Release
            </button>
          </div>
        </div>
      )}

      <div className="relative pl-6 space-y-4">
        <div className="absolute left-2 top-1 bottom-1 w-px bg-slate-200" />
        {versions.length === 0 && <p className="text-xs text-slate-500">No version history.</p>}
        {versions.map((v: any) => (
          <div key={v.id} className="relative">
            <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-2xs" />
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900">{v.version}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${v.channel === 'Stable' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : v.channel === 'LTS' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{v.channel}</span>
                {v.isCurrent && <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold">CURRENT</span>}
                {v.isLatest && <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-bold">LATEST</span>}
                <span className="ml-auto text-[10px] text-slate-500">{formatDateTime(v.releaseDate)}</span>
              </div>
              {v.releaseNotes && <p className="text-xs text-slate-600 mt-2">{v.releaseNotes}</p>}
              <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-slate-500">
                {v.sizeBytes > 0 && <span>Size: <b>{formatBytes(v.sizeBytes)}</b></span>}
                {v.minAppVersion && <span>Min app: <b className="font-mono">{v.minAppVersion}</b></span>}
                {v.checksum && <span className="font-mono">SHA: {v.checksum.slice(0, 16)}…</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Usage tab ─────────────────────────────────────────────────────────── */
function UsageTab({ m }: { m: ModuleRow }) {
  const { accessToken } = useSuperAdminAuth();
  const [days, setDays] = useState(30);

  const usageQuery = useQuery({
    queryKey: moduleKeys.usage(m.id, days),
    queryFn: () => superAdminApi.getModuleUsage(accessToken!, m.id, days),
    enabled: !!accessToken,
  });

  const usage = usageQuery.data as any;
  const totals = usage?.totals ?? {};
  const timeSeries = usage?.timeSeries ?? [];
  const topOrganizations = usage?.topOrganizations ?? [];

  const chartData = timeSeries.map((row: any) => ({
    date: row.date,
    'DAU': row.dau,
    'MAU': row.mau,
    'Transactions': row.transactions,
    'API Calls': row.apiCalls,
  }));

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Usage Analytics</h3>
          <p className="text-xs text-slate-500">Aggregated module usage across organizations.</p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
          {[7, 14, 30, 90, 180].map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <MetricCard label="DAU" value={formatNumber(totals.dau)} icon={Users} color="#059669" />
        <MetricCard label="MAU" value={formatNumber(totals.mau)} icon={Users} color="#0ea5e9" />
        <MetricCard label="Transactions" value={formatNumber(totals.transactions)} icon={TrendingUp} color="#d97706" />
        <MetricCard label="API Calls" value={formatNumber(totals.apiCalls)} icon={Activity} color="#7c3aed" />
        <MetricCard label="Storage" value={formatBytes(totals.storageBytes)} icon={Box} color="#64748b" />
        <MetricCard label="Avg Response" value={`${totals.avgResponseMs ?? 0} ms`} icon={Activity} color="#0e7490" />
      </div>

      {usageQuery.isPending ? (
        <div className="h-72 bg-slate-100/80 rounded-2xl animate-pulse" />
      ) : chartData.length === 0 ? (
        <p className="p-8 text-center text-xs text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl">No usage data for the selected period.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gDau" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#059669" stopOpacity={0.35} /><stop offset="95%" stopColor="#059669" stopOpacity={0} /></linearGradient>
                <linearGradient id="gTx" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d97706" stopOpacity={0.35} /><stop offset="95%" stopColor="#d97706" stopOpacity={0} /></linearGradient>
                <linearGradient id="gApi" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} /><stop offset="95%" stopColor="#7c3aed" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={45} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="DAU" stroke="#059669" fill="url(#gDau)" strokeWidth={2} />
              <Area type="monotone" dataKey="Transactions" stroke="#d97706" fill="url(#gTx)" strokeWidth={2} />
              <Area type="monotone" dataKey="API Calls" stroke="#7c3aed" fill="url(#gApi)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Top Organizations</h3>
        {topOrganizations.length === 0 ? (
          <p className="text-xs text-slate-500">No organization usage data.</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {topOrganizations.map((o: any) => (
              <div key={o.organizationId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/70">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{o.orgName}</div>
                  <div className="font-mono text-[10px] text-slate-500">{o.orgCode}</div>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-slate-500 shrink-0">
                  <span><b className="text-slate-800">{formatNumber(o.transactions)}</b> tx</span>
                  <span><b className="text-slate-800">{formatNumber(o.apiCalls)}</b> api</span>
                  <span><b className="text-slate-800">{formatNumber(o.dau)}</b> dau</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Settings tab ──────────────────────────────────────────────────────── */
function SettingsTab({ m }: { m: ModuleRow }) {
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [key, setKey] = useState(''); const [label, setLabel] = useState(''); const [type, setType] = useState('text'); const [def, setDef] = useState('');
  const settings = m.settings ?? [];

  const upsertMutation = useMutation({
    mutationFn: () => superAdminApi.upsertModuleSetting(accessToken!, m.id, { key: key.trim(), label: label.trim(), type, defaultValue: def }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: moduleKeys.detail(m.id) }); queryClient.invalidateQueries({ queryKey: moduleKeys.all }); setShowForm(false); setKey(''); setLabel(''); setDef(''); addNotification('Setting Saved', 'Setting definition saved.', 'success'); },
    onError: (err: any) => addNotification('Save Failed', err?.message || 'Could not save setting.', 'alert'),
  });

  const deleteMutation = useMutation({
    mutationFn: (settingId: string) => superAdminApi.deleteModuleSetting(accessToken!, m.id, settingId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: moduleKeys.detail(m.id) }); queryClient.invalidateQueries({ queryKey: moduleKeys.all }); addNotification('Setting Deleted', 'Setting removed.', 'success'); },
    onError: (err: any) => addNotification('Delete Failed', err?.message || 'Could not delete setting.', 'alert'),
  });

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Module Settings</h3>
          <p className="text-xs text-slate-500">Dynamic setting definitions for this module.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Setting</button>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5 animate-in fade-in duration-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Setting key (e.g. interest_rate)" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
              {['text', 'number', 'boolean', 'select', 'json'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={def} onChange={(e) => setDef(e.target.value)} placeholder="Default value" className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
            <button onClick={() => upsertMutation.mutate()} disabled={!key.trim() || !label.trim() || upsertMutation.isPending} className="px-4 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
              {upsertMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Save Setting
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {settings.length === 0 && <p className="p-4 text-xs text-slate-500 text-center">No settings defined.</p>}
        {settings.map((s: any) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/70">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">{s.label}</span>
                <span className="font-mono text-[10px] text-slate-500">{s.key}</span>
                {s.isRequired && <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold">REQUIRED</span>}
              </div>
              <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-slate-500">
                <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200">{s.type}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200">{s.groupName || 'General'}</span>
                {s.defaultValue != null && <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">default: {typeof s.defaultValue === 'object' ? JSON.stringify(s.defaultValue) : String(s.defaultValue)}</span>}
              </div>
            </div>
            <button onClick={() => deleteMutation.mutate(s.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Audit tab ─────────────────────────────────────────────────────────── */
function AuditTab({ moduleId }: { moduleId: string }) {
  const { accessToken } = useSuperAdminAuth();
  const auditQuery = useQuery({
    queryKey: moduleKeys.audit,
    queryFn: () => superAdminApi.getModuleAuditLogs(accessToken!, { moduleId, limit: 100 }),
    enabled: !!accessToken,
  });

  const logs = (auditQuery.data as any)?.data ?? [];

  const actionColor = (action: string) =>
    action.includes('CREATE') || action.includes('ASSIGN') || action.includes('INSTALL') || action.includes('ENABLE')
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : action.includes('DELETE') || action.includes('UNASSIGN') || action.includes('UNINSTALL') || action.includes('DISABLE')
        ? 'text-rose-700 bg-rose-50 border-rose-200'
        : 'text-sky-700 bg-sky-50 border-sky-200';

  return (
    <div className="p-5 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Audit Logs</h3>
        <p className="text-xs text-slate-500">Every change made to this module is recorded here.</p>
      </div>
      {auditQuery.isPending ? (
        <div className="space-y-2"><div className="h-10 bg-slate-100/80 rounded-lg animate-pulse" /><div className="h-10 bg-slate-100/80 rounded-lg animate-pulse" /></div>
      ) : logs.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl">No audit activity yet.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {logs.map((log: any) => (
            <div key={log.id} className="px-4 py-3 hover:bg-slate-50/70">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${actionColor(log.action)}`}>{log.action}</span>
                <span className="text-xs font-bold text-slate-800">{log.orgName || 'Platform'}</span>
                <span className="ml-auto text-[10px] text-slate-500">{formatDateTime(log.createdAt)}</span>
              </div>
              {log.newValue && (
                <pre className="mt-2 text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2 overflow-x-auto">{JSON.stringify(log.newValue, null, 2)}</pre>
              )}
              {log.oldValue && (
                <pre className="mt-1 text-[10px] text-rose-600 bg-rose-50/50 border border-rose-200 rounded-lg p-2 overflow-x-auto">before: {JSON.stringify(log.oldValue)}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── API tab ───────────────────────────────────────────────────────────── */
function ApiTab({ m }: { m: ModuleRow }) {
  const endpoints = [
    { method: 'GET', path: `/api/v1/modules/${m.code}`, desc: 'Retrieve module details' },
    { method: 'PUT', path: `/api/v1/modules/${m.code}`, desc: 'Update module configuration' },
    { method: 'GET', path: `/api/v1/modules/${m.code}/features`, desc: 'List module feature flags' },
    { method: 'POST', path: `/api/v1/modules/${m.code}/usage`, desc: 'Record usage analytics' },
    { method: 'POST', path: `/api/v1/marketplace/install`, desc: 'Install for an organization' },
    { method: 'POST', path: `/api/v1/marketplace/update`, desc: 'Upgrade to latest version' },
    { method: 'POST', path: `/api/v1/marketplace/remove`, desc: 'Uninstall from organization' },
  ];
  const methodColor: Record<string, string> = {
    GET: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    POST: 'bg-sky-100 text-sky-800 border-sky-200',
    PUT: 'bg-amber-100 text-amber-800 border-amber-200',
    DELETE: 'bg-rose-100 text-rose-800 border-rose-200',
  };
  return (
    <div className="p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Module API</h3>
        <p className="text-xs text-slate-500">Programmatic access to this module. Requires a super-admin bearer token.</p>
      </div>
      <div className="bg-white rounded-2xl p-4">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Authentication</div>
        <pre className="text-xs text-emerald-300 font-mono whitespace-pre-wrap">Authorization: Bearer &lt;super_admin_access_token&gt;</pre>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {endpoints.map((e, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50/70">
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border w-14 text-center shrink-0 ${methodColor[e.method] ?? ''}`}>{e.method}</span>
            <code className="text-xs font-mono text-slate-700 flex-1 break-all">{e.path}</code>
            <span className="text-[10px] text-slate-500 shrink-0">{e.desc}</span>
          </div>
        ))}
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-500">
        <b className="text-slate-700">Note:</b> When organization scoping is active, endpoints accept an <code className="font-mono text-emerald-700">X-Organization-Code</code> header. Feature toggles and settings can be overridden per organization.
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  ASSIGN DIALOG                                                          */
/* ════════════════════════════════════════════════════════════════════════ */

function AssignModulesDialog(props: { moduleIds: string[]; onClose: () => void }) {
  const { moduleIds, onClose } = props;
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [totalOrgs, setTotalOrgs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('Enabled');
  const [isTrial, setIsTrial] = useState(false);
  const [autoRenew, setAutoRenew] = useState(true);
  const [expiry, setExpiry] = useState('');
  const [notes, setNotes] = useState('');

  const loadOrgs = (s: string) => {
    setLoading(true);
    superAdminApi.getModuleOrgList(accessToken!, { search: s || undefined, limit: 100 })
      .then((res: any) => { setOrgs(res.data ?? []); setTotalOrgs(res.total ?? 0); })
      .catch(() => setOrgs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(() => loadOrgs(search), 300);
    return () => clearTimeout(t);
  }, [search, accessToken]);

  const assignMutation = useMutation({
    mutationFn: () => superAdminApi.assignModules(accessToken!, {
      organizationIds: Array.from(selectedOrgs),
      moduleIds,
      status,
      isTrial,
      autoRenew,
      expiryDate: expiry || null,
      notes: notes || null,
    }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: moduleKeys.all });
      queryClient.invalidateQueries({ queryKey: moduleKeys.assignments(moduleIds[0]) });
      addNotification('Modules Assigned', `Assigned to ${res.count ?? selectedOrgs.size} organization(s).`, 'success');
      onClose();
    },
    onError: (err: any) => addNotification('Assignment Failed', err?.message || 'Could not assign modules.', 'alert'),
  });

  const toggleOrg = (id: string) => setSelectedOrgs((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center"><Users className="w-4 h-4" /></div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Assign Modules</h3>
              <p className="text-[10px] text-slate-500">{moduleIds.length} module(s) · select organizations</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 font-bold text-sm cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search organizations..." className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
                {['Enabled', 'Disabled', 'Trial', 'Pending', 'Expired'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Expiry</span>
              <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Notes</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note" className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={isTrial} onChange={(e) => setIsTrial(e.target.checked)} className="accent-emerald-600" /> Trial
            </label>
            <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} className="accent-emerald-600" /> Auto-renew
            </label>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">Organizations ({selectedOrgs.size} selected / {totalOrgs})</span>
            {selectedOrgs.size > 0 && <button onClick={() => setSelectedOrgs(new Set())} className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer">Clear</button>}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-slate-100/80 rounded-xl animate-pulse" />)}
            </div>
          ) : orgs.length === 0 ? (
            <p className="p-6 text-center text-slate-500">No organizations found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto custom-scrollbar">
              {orgs.map((o) => (
                <button
                  key={o.id}
                  onClick={() => toggleOrg(o.id)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition cursor-pointer ${ selectedOrgs.has(o.id) ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-300' : 'border-slate-200 hover:border-slate-300 bg-white' }`}
                >
                  {selectedOrgs.has(o.id) ? <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" /> : <Square className="w-4 h-4 text-slate-600 shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">{o.organizationName}</div>
                    <div className="font-mono text-[10px] text-slate-500">{o.organizationCode}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer">Cancel</button>
          <button
            onClick={() => assignMutation.mutate()}
            disabled={selectedOrgs.size === 0 || assignMutation.isPending}
            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {assignMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Assign to {selectedOrgs.size} Organization{selectedOrgs.size === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  CREATE MODULE MODAL                                                    */
/* ════════════════════════════════════════════════════════════════════════ */

function CreateModuleModal(props: { onClose: () => void }) {
  const { onClose } = props;
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({
    queryKey: moduleKeys.categories,
    queryFn: () => superAdminApi.getModuleCategories(accessToken!) as Promise<ModuleCategory[]>,
    enabled: !!accessToken,
  });
  const categories = categoriesQuery.data ?? [];

  const [code, setCode] = useState(''); const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(''); const [type, setType] = useState('Optional');
  const [licenseType, setLicenseType] = useState('Free'); const [status, setStatus] = useState('Active');
  const [description, setDescription] = useState(''); const [isRequired, setIsRequired] = useState(false);
  const [color, setColor] = useState('#059669'); const [formError, setFormError] = useState('');

  const createMutation = useMutation({
    mutationFn: () => superAdminApi.createModule(accessToken!, {
      code: code.trim(), name: name.trim(), categoryId: categoryId || undefined,
      type, licenseType, status, shortDescription: description, isRequired, color, icon: 'Package',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moduleKeys.all });
      addNotification('Module Created', `${name.trim()} created successfully.`, 'success');
      onClose();
    },
    onError: (err: any) => setFormError(err?.message || 'Could not create module.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!code.trim()) return setFormError('Module code is required.');
    if (!name.trim()) return setFormError('Module name is required.');
    createMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center"><Plus className="w-4 h-4" /></div>
            <h3 className="font-bold text-slate-900 text-sm">Create Module</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 font-bold text-sm cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs overflow-y-auto custom-scrollbar flex-1">
          {formError && <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{formError}</span></div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Module Code <span className="text-emerald-600">*</span></label>
              <input value={code} onChange={(e) => setCode(e.target.value.toLowerCase())} placeholder="e.g. savings" className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Module Name <span className="text-emerald-600">*</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Savings & Deposits" className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
                <option value="">— Select category —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Module Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
                {MODULE_TYPES.filter((t) => t !== 'All').map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">License Type</label>
              <select value={licenseType} onChange={(e) => setLicenseType(e.target.value)} className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
                {LICENSE_TYPES.filter((t) => t !== 'All').map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
                {MODULE_STATUSES.filter((s) => s !== 'All').map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Accent Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-8 rounded cursor-pointer border border-slate-200" />
              <span className="font-mono text-xs text-slate-600">{color}</span>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Short Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="One-line description..." className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} className="accent-emerald-600" /> Required module (cannot be disabled)
          </label>
        </form>
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={createMutation.isPending} className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
            {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create Module
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  IMPORT MODULES MODAL                                                   */
/* ════════════════════════════════════════════════════════════════════════ */

function ImportModulesModal(props: { onClose: () => void }) {
  const { onClose } = props;
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Record<string, any>[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const arr = Array.isArray(parsed) ? parsed : parsed?.modules ?? [];
        if (!Array.isArray(arr) || arr.length === 0) return setError('No modules found in the file.');
        setItems(arr);
        setFileName(file.name);
      } catch (err: any) {
        setError('Invalid JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      let created = 0; let skipped = 0; let failed = 0;
      for (const item of items) {
        try {
          await superAdminApi.createModule(accessToken!, {
            code: item.code, name: item.name, nameNepali: item.nameNepali,
            shortDescription: item.shortDescription, longDescription: item.longDescription,
            type: item.type, licenseType: item.licenseType, status: item.status,
            isRequired: item.isRequired, versionCurrent: item.versionCurrent, versionLatest: item.versionLatest,
            icon: item.icon, color: item.color, sortOrder: item.sortOrder,
            features: item.features,
          });
          created++;
        } catch (err: any) {
          if (String(err?.message).includes('already exists')) skipped++;
          else failed++;
        }
      }
      return { created, skipped, failed };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: moduleKeys.all });
      addNotification('Import Complete', `${res.created} created, ${res.skipped} skipped, ${res.failed} failed.`, res.failed > 0 ? 'warning' : 'success');
      onClose();
    },
    onError: (err: any) => setError(err?.message || 'Import failed.'),
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center"><Upload className="w-4 h-4" /></div>
            <h3 className="font-bold text-slate-900 text-sm">Import Modules</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 font-bold text-sm cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 text-xs space-y-3">
          {error && <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span></div>}
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition">
            <Upload className="w-6 h-6 text-slate-500" />
            <span className="text-xs font-bold text-slate-700">{fileName || 'Click to choose a JSON file'}</span>
            <span className="text-[10px] text-slate-500">Expects an array of module objects (code, name, type, licenseType, status, features...)</span>
            <input type="file" accept="application/json" className="hidden" onChange={onFile} />
          </label>
          {items.length > 0 && <p className="text-[11px] text-emerald-700 font-bold">Found {items.length} module(s) in the file.</p>}
        </div>
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer">Cancel</button>
          <button
            onClick={() => importMutation.mutate()}
            disabled={items.length === 0 || importMutation.isPending}
            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
          >
            {importMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Import {items.length > 0 ? `${items.length}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
