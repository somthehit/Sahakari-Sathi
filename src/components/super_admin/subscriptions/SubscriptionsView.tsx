import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard, Search, Plus, Edit, Trash2, X, AlertTriangle, Loader2, RefreshCw,
  Building2, DollarSign, TrendingUp, Users, HardDrive, Sparkles, CheckCircle2,
  Clock, BarChart3, Filter, Info, Package, Zap, Shield, ArrowRight,
} from 'lucide-react';
import { useCoop } from '../../../context/CoopContext';
import { useSuperAdminAuth } from '../../../stores/superAdminAuthStore';
import { superAdminApi } from '../../../lib/superAdminApi';

/* ── Types ─────────────────────────────────────────────────────────────── */

interface SubscriptionPlan {
  id: string; code: string; name: string; description: string | null;
  priceMonthlyNpr: string; priceYearlyNpr: string;
  maxMembers: number; maxUsers: number; maxBranches: number;
  storageLimitMb: number; aiEnabled: boolean; aiCredits: number;
  features: string[] | null; isPublic: boolean; sortOrder: number;
  status: string; createdBy: string | null; updatedBy: string | null;
  createdAt: string; updatedAt: string;
}

interface OrgSubscriptionRow {
  id: string; organizationCode: string; organizationName: string;
  orgStatus: string; subscriptionPlan: string | null;
  subscriptionStatus: string | null; subscriptionStart: string | null;
  subscriptionEnd: string | null; trialEnd: string | null;
  storageLimitMb: number | null; storageUsedMb: number | null;
  maxMembers: number | null; maxUsers: number | null;
  maxBranches: number | null; aiEnabled: boolean | null;
  aiCredit: number | null;
}

interface SubscriptionStats {
  perPlan: Array<{ plan: string; count: number }>;
  perStatus: Array<{ status: string; count: number }>;
  mrr: number; activeTrials: number; expiringSoon: number; totalOrganizations: number;
}

interface PlanUsageRow {
  planCode: string; planName: string; priceMonthlyNpr: string; orgCount: number;
}

/* ── Constants ─────────────────────────────────────────────────────────── */

const PLAN_STATUS_BADGE: Record<string, string> = {
  Active: 'bg-emerald-100/80 text-emerald-800 border-emerald-200',
  Archived: 'bg-slate-100 text-slate-600 border-slate-200',
  Draft: 'bg-amber-100/80 text-amber-800 border-amber-200',
  Inactive: 'bg-rose-100/80 text-rose-800 border-rose-200',
};

const SUB_STATUS_BADGE: Record<string, string> = {
  Trial: 'bg-sky-100/80 text-sky-800 border-sky-200',
  Active: 'bg-emerald-100/80 text-emerald-800 border-emerald-200',
  Suspended: 'bg-amber-100/80 text-amber-800 border-amber-200',
  Past_Due: 'bg-orange-100/80 text-orange-800 border-orange-200',
  Cancelled: 'bg-rose-100/80 text-rose-800 border-rose-200',
  Expired: 'bg-slate-100 text-slate-600 border-slate-200',
};

const ORG_STATUS_BADGE: Record<string, string> = {
  Active: 'bg-emerald-100/80 text-emerald-800 border-emerald-200',
  Suspended: 'bg-amber-100/80 text-amber-800 border-amber-200',
  Inactive: 'bg-slate-100 text-slate-600 border-slate-200',
};

type TabId = 'plans' | 'orgs' | 'usage';

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'plans', label: 'Plans', icon: Package },
  { id: 'orgs', label: 'Organization Subscriptions', icon: Building2 },
  { id: 'usage', label: 'Plan Usage', icon: BarChart3 },
];

const PLAN_STATUSES = ['All', 'Active', 'Archived', 'Draft', 'Inactive'];
const SUB_STATUSES = ['All', 'Trial', 'Active', 'Suspended', 'Past_Due', 'Cancelled', 'Expired'];

/* ── Helpers ───────────────────────────────────────────────────────────── */

function formatNpr(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'NPR 0';
  return `NPR ${Number(n).toLocaleString('en-NP')}`;
}

function formatBytes(mb: number | null | undefined): string {
  if (!mb || mb === 0) return '0 MB';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function formatDate(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function subKeys(all: any) {
  return {
    all: ['subscriptions'] as const,
    plans: ['subscriptions', 'plans'] as const,
    orgs: (q: Record<string, any>) => ['subscriptions', 'orgs', q] as const,
    stats: ['subscriptions', 'stats'] as const,
    usage: ['subscriptions', 'usage'] as const,
  };
}

/* ── Color scale for usage bars ────────────────────────────────────────── */
const BAR_COLORS = ['#059669', '#0ea5e9', '#d97706', '#7c3aed', '#ec4899', '#06b6d4', '#84cc16', '#f43f5e'];

/* ════════════════════════════════════════════════════════════════════════ */
/*  MAIN VIEW                                                              */
/* ════════════════════════════════════════════════════════════════════════ */

export const SubscriptionsView: React.FC = () => {
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<TabId>('plans');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [createModal, setCreateModal] = useState(false);
  const [editPlan, setEditPlan] = useState<SubscriptionPlan | null>(null);
  const [deletePlan, setDeletePlan] = useState<SubscriptionPlan | null>(null);
  const [changePlanOrg, setChangePlanOrg] = useState<OrgSubscriptionRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const statsQuery = useQuery({
    queryKey: subKeys({}).stats,
    queryFn: () => superAdminApi.getSubscriptionStats(accessToken!) as Promise<SubscriptionStats>,
    enabled: !!accessToken,
    placeholderData: (prev) => prev,
  });

  const plansQuery = useQuery({
    queryKey: subKeys({}).plans,
    queryFn: () => superAdminApi.getSubscriptionPlans(accessToken!) as Promise<SubscriptionPlan[]>,
    enabled: !!accessToken,
    placeholderData: (prev) => prev,
  });

  const orgSubParams = useMemo(() => ({
    search: search || undefined,
    planCode: planFilter === 'All' ? undefined : planFilter,
    status: statusFilter === 'All' ? undefined : statusFilter,
  }), [search, planFilter, statusFilter]);

  const orgSubsQuery = useQuery({
    queryKey: subKeys({}).orgs(orgSubParams),
    queryFn: () => superAdminApi.getOrgSubscriptions(accessToken!, orgSubParams) as Promise<OrgSubscriptionRow[]>,
    enabled: !!accessToken && tab === 'orgs',
    placeholderData: (prev) => prev,
  });

  const usageQuery = useQuery({
    queryKey: subKeys({}).usage,
    queryFn: () => superAdminApi.getPlanUsage(accessToken!) as Promise<PlanUsageRow[]>,
    enabled: !!accessToken && tab === 'usage',
    placeholderData: (prev) => prev,
  });

  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: subKeys({}).all });

  const stats = statsQuery.data;
  const plans = plansQuery.data ?? [];
  const orgSubs = orgSubsQuery.data ?? [];
  const usage = usageQuery.data ?? [];

  const maxUsageCount = Math.max(1, ...usage.map((u) => u.orgCount));

  // Mutations
  const deletePlanMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.deleteSubscriptionPlan(accessToken!, id),
    onSuccess: () => {
      invalidateAll();
      addNotification('Plan Archived', 'Subscription plan archived successfully.', 'success');
      setDeletePlan(null);
    },
    onError: (err: any) => addNotification('Archive Failed', err?.message || 'Could not archive plan.', 'alert'),
  });

  const changePlanMutation = useMutation({
    mutationFn: ({ orgId, planCode }: { orgId: string; planCode: string }) =>
      superAdminApi.changeOrgPlan(accessToken!, orgId, planCode),
    onSuccess: (_v, { planCode }) => {
      invalidateAll();
      addNotification('Plan Changed', `Organization plan changed to ${planCode}.`, 'success');
      setChangePlanOrg(null);
    },
    onError: (err: any) => addNotification('Change Failed', err?.message || 'Could not change plan.', 'alert'),
  });

  const statCards = [
    { label: 'MRR (NPR)', value: formatNpr(stats?.mrr), icon: DollarSign, color: '#059669' },
    { label: 'Total Orgs', value: String(stats?.totalOrganizations ?? 0), icon: Building2, color: '#0ea5e9' },
    { label: 'Active Subscriptions', value: String(stats?.perStatus?.find((s) => s.status === 'Active')?.count ?? 0), icon: CheckCircle2, color: '#16a34a' },
    { label: 'Active Trials', value: String(stats?.activeTrials ?? 0), icon: Sparkles, color: '#7c3aed' },
    { label: 'Expiring Soon', value: String(stats?.expiringSoon ?? 0), icon: Clock, color: '#d97706' },
    { label: 'Active Plans', value: String(plans.filter((p) => p.status === 'Active').length), icon: Package, color: '#059669' },
  ];

  return (
    <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
            <CreditCard className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Subscription Management</h1>
            <p className="text-xs text-slate-500">Manage pricing plans, organization subscriptions & billing metrics</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => invalidateAll()} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer shadow-2xs" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          {tab === 'plans' && (
            <button onClick={() => setCreateModal(true)} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer">
              <Plus className="w-4 h-4" />
              <span>New Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
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

      {/* STATUS BREAKDOWN STRIP */}
      {stats?.perStatus && stats.perStatus.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.perStatus.map((s) => (
            <div key={s.status} className="px-3 py-2 rounded-xl bg-slate-50/70 border border-slate-200 text-xs flex items-center gap-2">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${SUB_STATUS_BADGE[s.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{s.status}</span>
              <span className="font-bold text-slate-900">{s.count}</span>
              <span className="text-slate-500">org(s)</span>
            </div>
          ))}
        </div>
      )}

      {/* TABS */}
      <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto custom-scrollbar">
        {TABS.map((t) => {
          const TabIcon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <TabIcon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      <div className="min-h-[400px]">
        {tab === 'plans' && (
          <PlansTab
            plans={plans}
            isLoading={plansQuery.isPending}
            isError={plansQuery.isError}
            error={(plansQuery.error as any)?.message}
            onEdit={(p) => setEditPlan(p)}
            onDelete={(p) => setDeletePlan(p)}
            onRefresh={() => invalidateAll()}
            onCreate={() => setCreateModal(true)}
          />
        )}
        {tab === 'orgs' && (
          <OrgsTab
            orgSubs={orgSubs}
            plans={plans}
            isLoading={orgSubsQuery.isPending}
            isError={orgSubsQuery.isError}
            error={(orgSubsQuery.error as any)?.message}
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            planFilter={planFilter}
            onPlanFilterChange={setPlanFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onChangePlan={(org) => setChangePlanOrg(org)}
            onRefresh={() => invalidateAll()}
          />
        )}
        {tab === 'usage' && (
          <UsageTab
            usage={usage}
            isLoading={usageQuery.isPending}
            isError={usageQuery.isError}
            error={(usageQuery.error as any)?.message}
            maxCount={maxUsageCount}
            onRefresh={() => invalidateAll()}
          />
        )}
      </div>

      {/* MODALS */}
      {createModal && <CreatePlanModal onClose={() => setCreateModal(false)} plans={plans} />}
      {editPlan && <EditPlanModal plan={editPlan} onClose={() => setEditPlan(null)} plans={plans} />}
      {deletePlan && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Archive Plan</h3>
              <button onClick={() => setDeletePlan(null)} className="text-slate-500 hover:text-slate-600 font-bold text-sm cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 text-xs space-y-3">
              <div className="flex items-start gap-2.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Are you sure you want to archive <b>{deletePlan.name}</b> ({deletePlan.code})?
                  This will set the plan status to Archived. Existing organizations on this plan will not be affected.
                </span>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button onClick={() => setDeletePlan(null)} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer">Cancel</button>
              <button
                onClick={() => deletePlanMutation.mutate(deletePlan.id)}
                disabled={deletePlanMutation.isPending}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {deletePlanMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
      {changePlanOrg && (
        <ChangePlanModal
          org={changePlanOrg}
          plans={plans}
          onClose={() => setChangePlanOrg(null)}
          onConfirm={(planCode) => changePlanMutation.mutate({ orgId: changePlanOrg.id, planCode })}
          isPending={changePlanMutation.isPending}
        />
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════ */
/*  PLANS TAB                                                              */
/* ════════════════════════════════════════════════════════════════════════ */

function PlansTab(props: {
  plans: SubscriptionPlan[];
  isLoading: boolean;
  isError: boolean;
  error?: string;
  onEdit: (p: SubscriptionPlan) => void;
  onDelete: (p: SubscriptionPlan) => void;
  onRefresh: () => void;
  onCreate: () => void;
}) {
  const { plans, isLoading, isError, error, onEdit, onDelete, onRefresh, onCreate } = props;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-56 bg-slate-100/80 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-800 mb-1">Failed to load plans</p>
        <p className="text-xs text-slate-500 mb-4">{error}</p>
        <button onClick={onRefresh} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer">Retry</button>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl">
        <Package className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-800 mb-1">No plans configured</p>
        <p className="text-xs text-slate-500 mb-4">Create your first subscription plan to get started.</p>
        <button onClick={onCreate} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 mx-auto">
          <Plus className="w-3.5 h-3.5" /> New Plan
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {plans.map((p) => (
        <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:shadow-md transition">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                {p.name}
                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${PLAN_STATUS_BADGE[p.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{p.status}</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">{p.code}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onEdit(p)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer" title="Edit">
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(p)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition cursor-pointer" title="Archive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {p.description && <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">{p.description}</p>}

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl px-3 py-2">
              <div className="text-[9px] font-bold text-emerald-600 uppercase">Monthly</div>
              <div className="text-sm font-extrabold text-emerald-800">{formatNpr(Number(p.priceMonthlyNpr))}</div>
            </div>
            <div className="bg-sky-50/70 border border-sky-200 rounded-xl px-3 py-2">
              <div className="text-[9px] font-bold text-sky-600 uppercase">Yearly</div>
              <div className="text-sm font-extrabold text-sky-800">{formatNpr(Number(p.priceYearlyNpr))}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <span className="px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[9px] font-bold text-slate-500 flex items-center gap-1">
              <Users className="w-2.5 h-2.5" /> {p.maxMembers.toLocaleString()} members
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[9px] font-bold text-slate-500 flex items-center gap-1">
              <Users className="w-2.5 h-2.5" /> {p.maxUsers} users
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[9px] font-bold text-slate-500 flex items-center gap-1">
              <Building2 className="w-2.5 h-2.5" /> {p.maxBranches} branches
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[9px] font-bold text-slate-500 flex items-center gap-1">
              <HardDrive className="w-2.5 h-2.5" /> {formatBytes(p.storageLimitMb)}
            </span>
            {p.aiEnabled && (
              <span className="px-1.5 py-0.5 rounded-md bg-violet-50 border border-violet-200 text-[9px] font-bold text-violet-700 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> AI ({p.aiCredits})
              </span>
            )}
          </div>

          {Array.isArray(p.features) && p.features.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {p.features.slice(0, 4).map((f, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[9px] font-medium text-emerald-700">{String(f)}</span>
              ))}
              {p.features.length > 4 && (
                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[9px] font-medium text-slate-500">+{p.features.length - 4} more</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  ORGS TAB                                                               */
/* ════════════════════════════════════════════════════════════════════════ */

function OrgsTab(props: {
  orgSubs: OrgSubscriptionRow[];
  plans: SubscriptionPlan[];
  isLoading: boolean;
  isError: boolean;
  error?: string;
  searchInput: string;
  onSearchChange: (v: string) => void;
  planFilter: string;
  onPlanFilterChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  onChangePlan: (org: OrgSubscriptionRow) => void;
  onRefresh: () => void;
}) {
  const {
    orgSubs, plans, isLoading, isError, error,
    searchInput, onSearchChange,
    planFilter, onPlanFilterChange,
    statusFilter, onStatusFilterChange,
    onChangePlan, onRefresh,
  } = props;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-100/80 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-800 mb-1">Failed to load subscriptions</p>
        <p className="text-xs text-slate-500 mb-4">{error}</p>
        <button onClick={onRefresh} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer">Retry</button>
      </div>
    );
  }

  const hasFilters = !!(searchInput || planFilter !== 'All' || statusFilter !== 'All');

  return (
    <div className="space-y-3">
      {/* FILTERS */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-52">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by org code or name..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => onPlanFilterChange(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer min-w-32"
        >
          <option value="All">All Plans</option>
          {plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer min-w-32"
        >
          {SUB_STATUSES.map((s) => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
        </select>
        {hasFilters && (
          <button
            onClick={() => { onSearchChange(''); onPlanFilterChange('All'); onStatusFilterChange('All'); }}
            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {orgSubs.length === 0 ? (
        <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl">
          <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800 mb-1">No organizations found</p>
          <p className="text-xs text-slate-500">
            {hasFilters ? 'No organizations match your current filters.' : 'No organizations have subscriptions configured yet.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wide">Org</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wide">Plan</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wide">Org Status</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wide">Start Date</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wide">End Date</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wide">Trial End</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wide">Storage</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wide">Limits</th>
                <th className="text-right py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {orgSubs.map((o) => {
                const storagePct = o.storageLimitMb && o.storageLimitMb > 0
                  ? Math.min(100, Math.round(((o.storageUsedMb ?? 0) / o.storageLimitMb) * 100))
                  : 0;
                return (
                  <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{o.organizationCode}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-40">{o.organizationName}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                        {o.subscriptionPlan || 'None'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${SUB_STATUS_BADGE[o.subscriptionStatus ?? ''] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {o.subscriptionStatus || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${ORG_STATUS_BADGE[o.orgStatus] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {o.orgStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{formatDate(o.subscriptionStart)}</td>
                    <td className="py-2.5 px-3 text-slate-600">{formatDate(o.subscriptionEnd)}</td>
                    <td className="py-2.5 px-3 text-slate-600">{formatDate(o.trialEnd)}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${storagePct > 90 ? 'bg-rose-500' : storagePct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${storagePct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">{formatBytes(o.storageUsedMb ?? 0)}/{formatBytes(o.storageLimitMb ?? 0)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-[10px] text-slate-500 space-y-0.5">
                        <div>{o.maxMembers?.toLocaleString() ?? '—'} members</div>
                        <div>{o.maxUsers ?? '—'} users · {o.maxBranches ?? '—'} branches</div>
                        {o.aiEnabled && <div className="text-violet-600 font-bold">AI: {o.aiCredit ?? 0} credits</div>}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onChangePlan(o)}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-[10px] transition cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        <ArrowRight className="w-3 h-3" /> Change Plan
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  USAGE TAB                                                             */
/* ════════════════════════════════════════════════════════════════════════ */

function UsageTab(props: {
  usage: PlanUsageRow[];
  isLoading: boolean;
  isError: boolean;
  error?: string;
  maxCount: number;
  onRefresh: () => void;
}) {
  const { usage, isLoading, isError, error, maxCount, onRefresh } = props;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 bg-slate-100/80 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-800 mb-1">Failed to load usage data</p>
        <p className="text-xs text-slate-500 mb-4">{error}</p>
        <button onClick={onRefresh} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer">Retry</button>
      </div>
    );
  }

  if (usage.length === 0) {
    return (
      <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl">
        <BarChart3 className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-800 mb-1">No usage data</p>
        <p className="text-xs text-slate-500">No organizations have been assigned plans yet.</p>
      </div>
    );
  }

  const totalOrgs = usage.reduce((s, u) => s + u.orgCount, 0);
  const totalMrr = usage.reduce((s, u) => s + u.orgCount * Number(u.priceMonthlyNpr), 0);

  return (
    <div className="space-y-4">
      {/* SUMMARY */}
      <div className="flex flex-wrap gap-3">
        <div className="px-4 py-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs flex items-center gap-2">
          <Building2 className="w-4 h-4 text-emerald-700" />
          <span className="text-slate-600">Total Orgs on Plans:</span>
          <span className="font-bold text-slate-900">{totalOrgs}</span>
        </div>
        <div className="px-4 py-3 rounded-xl bg-sky-50/70 border border-sky-200 text-xs flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-sky-700" />
          <span className="text-slate-600">Projected MRR:</span>
          <span className="font-bold text-slate-900">{formatNpr(totalMrr)}</span>
        </div>
      </div>

      {/* BAR CHART (CSS-based) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
        <h3 className="text-xs font-bold text-slate-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-700" /> Organizations per Plan
        </h3>
        <div className="space-y-3">
          {usage.map((u, i) => {
            const pct = maxCount > 0 ? (u.orgCount / maxCount) * 100 : 0;
            const color = BAR_COLORS[i % BAR_COLORS.length];
            return (
              <div key={u.planCode} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-right">
                  <div className="text-xs font-bold text-slate-900 truncate">{u.planName}</div>
                  <div className="text-[10px] text-slate-500">{formatNpr(Number(u.priceMonthlyNpr))}/mo</div>
                </div>
                <div className="flex-1 h-8 bg-slate-100 rounded-xl overflow-hidden relative">
                  <div
                    className="h-full rounded-xl transition-all duration-500"
                    style={{ width: `${Math.max(4, pct)}%`, backgroundColor: color }}
                  />
                  <span className="absolute inset-y-0 right-2 flex items-center text-[11px] font-bold text-slate-700">
                    {u.orgCount}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CARD GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {usage.map((u, i) => (
          <div key={u.planCode} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BAR_COLORS[i % BAR_COLORS.length]}18` }}>
                <Package className="w-4 h-4" style={{ color: BAR_COLORS[i % BAR_COLORS.length] }} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">{u.planName}</div>
                <div className="text-[10px] font-mono text-slate-500">{u.planCode}</div>
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{u.orgCount}</div>
            <div className="text-[10px] text-slate-500">organization(s)</div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
              <span className="text-slate-500">MRR contribution</span>
              <span className="font-bold text-slate-900">{formatNpr(u.orgCount * Number(u.priceMonthlyNpr))}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  CREATE PLAN MODAL                                                     */
/* ════════════════════════════════════════════════════════════════════════ */

function CreatePlanModal(props: { onClose: () => void; plans: SubscriptionPlan[] }) {
  const { onClose, plans } = props;
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    code: '', name: '', description: '',
    priceMonthlyNpr: '0', priceYearlyNpr: '0',
    maxMembers: 1000, maxUsers: 50, maxBranches: 5,
    storageLimitMb: 5120, aiEnabled: false, aiCredits: 0,
    isPublic: true, sortOrder: plans.length, status: 'Active',
  });

  const createMutation = useMutation({
    mutationFn: (data: object) => superAdminApi.createSubscriptionPlan(accessToken!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subKeys({}).all });
      addNotification('Plan Created', 'Subscription plan created successfully.', 'success');
      onClose();
    },
    onError: (err: any) => addNotification('Create Failed', err?.message || 'Could not create plan.', 'alert'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      addNotification('Validation Error', 'Code and Name are required.', 'alert');
      return;
    }
    createMutation.mutate(form);
  };

  const update = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-700" /> Create Subscription Plan
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 font-bold text-sm cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Code *</label>
              <input value={form.code} onChange={(e) => update('code', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" placeholder="e.g. starter" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Name *</label>
              <input value={form.name} onChange={(e) => update('name', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" placeholder="e.g. Starter Plan" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Description</label>
            <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={2} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1 resize-none" placeholder="Plan description..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Monthly Price (NPR)</label>
              <input type="number" value={form.priceMonthlyNpr} onChange={(e) => update('priceMonthlyNpr', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Yearly Price (NPR)</label>
              <input type="number" value={form.priceYearlyNpr} onChange={(e) => update('priceYearlyNpr', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Max Members</label>
              <input type="number" value={form.maxMembers} onChange={(e) => update('maxMembers', Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Max Users</label>
              <input type="number" value={form.maxUsers} onChange={(e) => update('maxUsers', Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Max Branches</label>
              <input type="number" value={form.maxBranches} onChange={(e) => update('maxBranches', Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Storage Limit (MB)</label>
              <input type="number" value={form.storageLimitMb} onChange={(e) => update('storageLimitMb', Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.aiEnabled} onChange={(e) => update('aiEnabled', e.target.checked)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span className="text-xs font-bold text-slate-700">AI Enabled</span>
              </label>
            </div>
            {form.aiEnabled && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">AI Credits</label>
                <input type="number" value={form.aiCredits} onChange={(e) => update('aiCredits', Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Status</label>
              <select value={form.status} onChange={(e) => update('status', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1 cursor-pointer">
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Sort Order</label>
              <input type="number" value={form.sortOrder} onChange={(e) => update('sortOrder', Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isPublic} onChange={(e) => update('isPublic', e.target.checked)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span className="text-xs font-bold text-slate-700">Public</span>
              </label>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer text-xs">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs">
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  EDIT PLAN MODAL                                                       */
/* ════════════════════════════════════════════════════════════════════════ */

function EditPlanModal(props: { plan: SubscriptionPlan; onClose: () => void; plans: SubscriptionPlan[] }) {
  const { plan, onClose, plans } = props;
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    code: plan.code, name: plan.name, description: plan.description ?? '',
    priceMonthlyNpr: plan.priceMonthlyNpr, priceYearlyNpr: plan.priceYearlyNpr,
    maxMembers: plan.maxMembers, maxUsers: plan.maxUsers, maxBranches: plan.maxBranches,
    storageLimitMb: plan.storageLimitMb, aiEnabled: plan.aiEnabled, aiCredits: plan.aiCredits,
    isPublic: plan.isPublic, sortOrder: plan.sortOrder, status: plan.status,
  });

  const updateMutation = useMutation({
    mutationFn: (data: object) => superAdminApi.updateSubscriptionPlan(accessToken!, plan.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subKeys({}).all });
      addNotification('Plan Updated', 'Subscription plan updated successfully.', 'success');
      onClose();
    },
    onError: (err: any) => addNotification('Update Failed', err?.message || 'Could not update plan.', 'alert'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      addNotification('Validation Error', 'Code and Name are required.', 'alert');
      return;
    }
    updateMutation.mutate(form);
  };

  const update = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Edit className="w-4 h-4 text-emerald-700" /> Edit Plan — {plan.name}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 font-bold text-sm cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Code *</label>
              <input value={form.code} onChange={(e) => update('code', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Name *</label>
              <input value={form.name} onChange={(e) => update('name', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Description</label>
            <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={2} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Monthly Price (NPR)</label>
              <input type="number" value={form.priceMonthlyNpr} onChange={(e) => update('priceMonthlyNpr', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Yearly Price (NPR)</label>
              <input type="number" value={form.priceYearlyNpr} onChange={(e) => update('priceYearlyNpr', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Max Members</label>
              <input type="number" value={form.maxMembers} onChange={(e) => update('maxMembers', Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Max Users</label>
              <input type="number" value={form.maxUsers} onChange={(e) => update('maxUsers', Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Max Branches</label>
              <input type="number" value={form.maxBranches} onChange={(e) => update('maxBranches', Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Storage Limit (MB)</label>
              <input type="number" value={form.storageLimitMb} onChange={(e) => update('storageLimitMb', Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.aiEnabled} onChange={(e) => update('aiEnabled', e.target.checked)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span className="text-xs font-bold text-slate-700">AI Enabled</span>
              </label>
            </div>
            {form.aiEnabled && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">AI Credits</label>
                <input type="number" value={form.aiCredits} onChange={(e) => update('aiCredits', Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Status</label>
              <select value={form.status} onChange={(e) => update('status', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1 cursor-pointer">
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Inactive">Inactive</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Sort Order</label>
              <input type="number" value={form.sortOrder} onChange={(e) => update('sortOrder', Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isPublic} onChange={(e) => update('isPublic', e.target.checked)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span className="text-xs font-bold text-slate-700">Public</span>
              </label>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer text-xs">Cancel</button>
            <button type="submit" disabled={updateMutation.isPending} className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs">
              {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  CHANGE PLAN MODAL                                                     */
/* ════════════════════════════════════════════════════════════════════════ */

function ChangePlanModal(props: {
  org: OrgSubscriptionRow;
  plans: SubscriptionPlan[];
  onClose: () => void;
  onConfirm: (planCode: string) => void;
  isPending: boolean;
}) {
  const { org, plans, onClose, onConfirm, isPending } = props;
  const [selectedPlan, setSelectedPlan] = useState(org.subscriptionPlan || '');

  const activePlans = plans.filter((p) => p.status === 'Active');

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Change Subscription Plan</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 font-bold text-sm cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
            <div className="font-bold text-slate-900">{org.organizationCode} — {org.organizationName}</div>
            <div className="text-slate-500 mt-1">Current plan: <span className="font-bold text-slate-700">{org.subscriptionPlan || 'None'}</span></div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Select New Plan</label>
            <div className="mt-2 space-y-2">
              {activePlans.map((p) => (
                <button
                  key={p.code}
                  onClick={() => setSelectedPlan(p.code)}
                  className={`w-full text-left p-3 rounded-xl border transition cursor-pointer ${
                    selectedPlan === p.code
                      ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-500">{p.code} · {formatNpr(Number(p.priceMonthlyNpr))}/mo</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
                      <span>{p.maxMembers.toLocaleString()} members</span>
                      <span>·</span>
                      <span>{formatBytes(p.storageLimitMb)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedPlan && selectedPlan !== org.subscriptionPlan && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span className="text-amber-800">
                This will immediately change the organization's plan and update their limits (members, users, branches, storage, AI) to match the new plan definition.
              </span>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer text-xs">Cancel</button>
          <button
            onClick={() => onConfirm(selectedPlan)}
            disabled={isPending || !selectedPlan || selectedPlan === org.subscriptionPlan}
            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Change Plan
          </button>
        </div>
      </div>
    </div>
  );
}
