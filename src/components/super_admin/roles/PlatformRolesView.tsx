import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  AlertTriangle,
  Loader2,
  ChevronUp,
  ChevronDown,
  Check,
  Key,
  Globe,
  LayoutGrid,
  RefreshCw,
  CheckSquare,
  Square,
  Eye,
  ArrowUpDown,
} from 'lucide-react';
import { useCoop } from '../../../context/CoopContext';
import { useSuperAdminAuth } from '../../../stores/superAdminAuthStore';
import { superAdminApi } from '../../../lib/superAdminApi';
import {
  PERMISSION_CATEGORIES,
  PERMISSION_ACTIONS,
  emptyPermissionMatrix,
  grantsToMatrix,
  matrixToGrants,
  type PermissionMatrix,
  type PermissionGrant,
} from '../../../types/permissions';

interface PlatformRoleRow {
  id: string;
  code: string | null;
  name: string;
  nameNepali: string | null;
  description: string | null;
  permissions: string;
  isSystem: boolean;
  status: 'Active' | 'Inactive';
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface PlatformRoleQuery {
  search?: string;
  status?: string;
  system?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type PlatformDataScope = 'all' | 'branch' | 'self';

const platformRolesKeys = {
  all: ['platform-roles'] as const,
  list: (q: PlatformRoleQuery) => ['platform-roles', q] as const,
  permissions: (id: string) => ['platform-roles', 'permissions', id] as const,
  dataScope: (id: string) => ['platform-roles', 'data-scope', id] as const,
};

type SortBy = 'name' | 'code' | 'createdAt';

type RoleSection = 'general' | 'permissions' | 'access' | 'scope';

const PAGE_SIZES = [10, 25, 50, 100];

const grantAll = (): PermissionMatrix => {
  const m = emptyPermissionMatrix();
  for (const k of Object.keys(m)) m[k] = Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a.key, true]));
  return m;
};

const grantActions = (cats: Record<string, string[]>): PermissionMatrix => {
  const m = emptyPermissionMatrix();
  for (const [cat, actions] of Object.entries(cats)) {
    if (!m[cat]) continue;
    for (const a of actions) if (m[cat][a] !== undefined) m[cat][a] = true;
  }
  return m;
};

/** Built-in templates used by the "Use Template" create flow. */
const PLATFORM_ROLE_TEMPLATES = [
  { id: 'plt_admin', name: 'Platform Administrator', description: 'Full access to every platform module and action', apply: grantAll },
  {
    id: 'plt_ops', name: 'Platform Operations', description: 'Organizations, users, monitoring and support',
    apply: () => grantActions({
      dashboard: ['view'], members: ['view'], savings: ['view'], loans: ['view'], accounting: ['view'], shares: ['view'], inventory: ['view'], hr: ['view'], reports: ['view', 'export', 'print'], admin: ['view', 'assign'], settings: ['view', 'edit'], audit: ['view', 'export'],
    }),
  },
  {
    id: 'plt_auditor', name: 'Platform Auditor', description: 'Read-only oversight of platform activity',
    apply: () => grantActions({
      dashboard: ['view'], members: ['view'], savings: ['view'], loans: ['view'], accounting: ['view', 'export', 'print'], shares: ['view'], inventory: ['view'], hr: ['view'], reports: ['view', 'export', 'print'], audit: ['view', 'export', 'print'],
    }),
  },
  {
    id: 'plt_support', name: 'Platform Support', description: 'Member and organization support with limited access',
    apply: () => grantActions({
      dashboard: ['view'], members: ['view'], savings: ['view'], loans: ['view'], accounting: ['view'], reports: ['view'], admin: ['view'], settings: ['view'], audit: ['view'],
    }),
  },
];

export const PlatformRolesView: React.FC = () => {
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();

  const [section, setSection] = useState<RoleSection>('general');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [systemFilter, setSystemFilter] = useState<'All' | 'System' | 'Custom'>('All');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [roleModal, setRoleModal] = useState<{ mode: 'add' | 'edit'; role?: PlatformRoleRow } | null>(null);
  const [permRole, setPermRole] = useState<PlatformRoleRow | null>(null);
  const [deleteRoleRow, setDeleteRoleRow] = useState<PlatformRoleRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const queryParams: PlatformRoleQuery = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter,
      system: systemFilter,
      sortBy,
      sortDir,
      page,
      limit: pageSize,
    }),
    [search, statusFilter, systemFilter, sortBy, sortDir, page, pageSize]
  );

  const listQuery = useQuery({
    queryKey: platformRolesKeys.list(queryParams),
    queryFn: () => superAdminApi.getPlatformRoles(accessToken!, queryParams) as Promise<Paginated<PlatformRoleRow>>,
    enabled: !!accessToken,
    placeholderData: (prev) => prev,
  });

  const data = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, listQuery.data?.totalPages ?? 1);

  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: platformRolesKeys.all });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => superAdminApi.createPlatformRole(accessToken!, payload),
    onSuccess: () => {
      invalidateAll();
      addNotification('Role Created', 'Platform role created successfully.', 'success');
      setRoleModal(null);
    },
    onError: (err: any) => {
      addNotification('Role Creation Failed', err?.message || 'Could not create role.', 'alert');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, any> }) =>
      superAdminApi.updatePlatformRole(accessToken!, id, payload),
    onSuccess: () => {
      invalidateAll();
      addNotification('Role Updated', 'Platform role updated successfully.', 'success');
      setRoleModal(null);
    },
    onError: (err: any) => {
      addNotification('Role Update Failed', err?.message || 'Could not update role.', 'alert');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'Active' | 'Inactive' }) =>
      superAdminApi.updatePlatformRole(accessToken!, id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: platformRolesKeys.all });
      const previous = queryClient.getQueriesData({ queryKey: platformRolesKeys.all });
      queryClient.setQueriesData<Paginated<PlatformRoleRow>>({ queryKey: platformRolesKeys.all }, (old) =>
        old ? { ...old, data: old.data.map((r) => (r.id === id ? { ...r, status } : r)) } : old
      );
      return { previous };
    },
    onError: (err: any, _vars, context: any) => {
      if (context?.previous) {
        for (const [key, value] of context.previous) queryClient.setQueryData(key, value);
      }
      addNotification('Status Update Failed', err?.message || 'Could not update status.', 'alert');
    },
    onSettled: () => invalidateAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.deletePlatformRole(accessToken!, id),
    onSuccess: () => {
      invalidateAll();
      addNotification('Role Deleted', 'Platform role deleted successfully.', 'success');
      setDeleteRoleRow(null);
    },
    onError: (err: any) => {
      addNotification('Delete Failed', err?.message || 'Could not delete role.', 'alert');
    },
  });

  const permsMutation = useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: PermissionGrant[] }) =>
      superAdminApi.updatePlatformRolePermissions(accessToken!, id, { permissions }),
    onSuccess: () => {
      invalidateAll();
      addNotification('Permissions Saved', 'Platform role permissions updated successfully.', 'success');
      setPermRole(null);
    },
    onError: (err: any) => {
      addNotification('Permissions Save Failed', err?.message || 'Could not save permissions.', 'alert');
    },
  });

  const handleStatusToggle = (role: PlatformRoleRow) => {
    statusMutation.mutate({ id: role.id, status: role.status === 'Active' ? 'Inactive' : 'Active' });
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const bulkActivate = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    Promise.allSettled(ids.map((id) => superAdminApi.updatePlatformRole(accessToken!, id, { status: 'Active' })))
      .then((res) => {
        const failed = res.filter((r) => r.status === 'rejected').length;
        invalidateAll();
        if (failed === 0) addNotification('Bulk Action', `Activated ${ids.length} role${ids.length === 1 ? '' : 's'}.`, 'success');
        else addNotification('Bulk Action', `${ids.length - failed} succeeded, ${failed} failed.`, 'warning');
        setSelected(new Set());
      });
  };

  const bulkDeactivate = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    Promise.allSettled(ids.map((id) => superAdminApi.updatePlatformRole(accessToken!, id, { status: 'Inactive' })))
      .then((res) => {
        const failed = res.filter((r) => r.status === 'rejected').length;
        invalidateAll();
        if (failed === 0) addNotification('Bulk Action', `Deactivated ${ids.length} role${ids.length === 1 ? '' : 's'}.`, 'success');
        else addNotification('Bulk Action', `${ids.length - failed} succeeded, ${failed} failed.`, 'warning');
        setSelected(new Set());
      });
  };

  const handleSort = (key: SortBy) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir(key === 'createdAt' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const sortIndicator = (key: SortBy) => {
    if (sortBy !== key) return <ArrowUpDown className="w-3 h-3 text-slate-500 ml-1" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 text-emerald-600 ml-1" />
      : <ChevronDown className="w-3.5 h-3.5 text-emerald-600 ml-1" />;
  };

  const allPageSelected = data.length > 0 && data.every((r) => selected.has(r.id));
  const hasFilters = !!(search || statusFilter !== 'All' || systemFilter !== 'All');

  return (
    <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
            <Shield className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Roles & Access</h1>
            <p className="text-xs text-slate-500">Platform-level role and permission management (database driven)</p>
          </div>
        </div>
        <button
          onClick={() => setRoleModal({ mode: 'add' })}
          className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Platform Role</span>
        </button>
      </div>

      {/* SECTION TABS */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 border border-slate-200 rounded-xl p-1.5">
        {([
          { id: 'general', label: 'General', icon: Shield },
          { id: 'permissions', label: 'Permissions', icon: Key },
          { id: 'access', label: 'Access Matrix', icon: LayoutGrid },
          { id: 'scope', label: 'Data Scope', icon: Globe },
        ] as { id: RoleSection; label: string; icon: any }[]).map((t) => {
          const TabIcon = t.icon;
          const isActive = section === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSection(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${ isActive ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-2xs' }`}
            >
              <TabIcon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* GENERAL — role CRUD table */}
      {section === 'general' && (<>

        {/* TOOLBAR */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <div className="relative flex-1 min-w-52">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by code, role name, or Nepali name..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer min-w-28"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <select
            value={systemFilter}
            onChange={(e) => { setSystemFilter(e.target.value as any); setPage(1); }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer min-w-28"
          >
            <option value="All">System + Custom</option>
            <option value="System">System</option>
            <option value="Custom">Custom</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => handleSort(e.target.value as SortBy)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer min-w-32"
          >
            <option value="name">Sort: Name</option>
            <option value="code">Sort: Code</option>
            <option value="createdAt">Sort: Created Date</option>
          </select>

          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
          </select>

          <button onClick={() => invalidateAll()} title="Refresh" className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer shadow-2xs">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* BULK BAR */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-emerald-50/70 border border-emerald-200 rounded-xl px-3 py-2 text-xs">
            <span className="font-bold text-emerald-800">{selected.size} selected</span>
            <button
              onClick={bulkActivate}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer"
            >
              Activate
            </button>
            <button
              onClick={bulkDeactivate}
              className="px-2.5 py-1.5 bg-slate-600 hover:bg-slate-200 text-slate-800 rounded-lg font-bold cursor-pointer"
            >
              Deactivate
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-2.5 py-1.5 border border-emerald-300 text-emerald-800 rounded-lg font-bold hover:bg-emerald-100 cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}

        {/* TABLE */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          {listQuery.isPending ? (
            <div className="p-8 space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-11 bg-slate-100/80 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : listQuery.isError ? (
            <div className="p-10 text-center">
              <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800 mb-1">Failed to load platform roles</p>
              <p className="text-xs text-slate-500 mb-4">{(listQuery.error as any)?.message}</p>
              <button onClick={() => invalidateAll()} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer">
                Retry
              </button>
            </div>
          ) : data.length === 0 ? (
            <div className="p-10 text-center">
              <Shield className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800 mb-1">No platform roles found</p>
              <p className="text-xs text-slate-500 mb-4">
                {hasFilters ? 'No roles match your current filters.' : 'Create your first platform role to get started.'}
              </p>
              {!hasFilters && (
                <button onClick={() => setRoleModal({ mode: 'add' })} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 mx-auto">
                  <Plus className="w-3.5 h-3.5" /> Add Platform Role
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[560px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs table-fixed">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                    <th className="p-3 pl-4 w-11">
                      <button onClick={toggleAll} className="cursor-pointer text-slate-600 hover:text-emerald-700">
                        {allPageSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                    <th onClick={() => handleSort('code')} className="p-3 cursor-pointer select-none">
                      <div className="flex items-center">Code {sortIndicator('code')}</div>
                    </th>
                    <th onClick={() => handleSort('name')} className="p-3 cursor-pointer select-none">
                      <div className="flex items-center">Role Name {sortIndicator('name')}</div>
                    </th>
                    <th className="p-3">Nepali Name</th>
                    <th className="p-3 text-center">Type</th>
                    <th className="p-3 text-center">Status</th>
                    <th onClick={() => handleSort('createdAt')} className="p-3 cursor-pointer select-none">
                      <div className="flex items-center">Created {sortIndicator('createdAt')}</div>
                    </th>
                    <th className="p-3 pr-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((r) => (
                    <tr key={r.id} className={`hover:bg-slate-50/80 transition ${selected.has(r.id) ? 'bg-emerald-50/40' : ''}`}>
                      <td className="p-3 pl-4">
                        <button onClick={() => toggleRow(r.id)} className="cursor-pointer text-slate-600 hover:text-emerald-700">
                          {selected.has(r.id) ? <CheckSquare className="w-4 h-4 text-emerald-700" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-slate-700">{r.code ?? '—'}</td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {r.name}
                        {r.isSystem && <span className="ml-2 align-middle inline-block px-1.5 py-0.5 rounded-full font-bold text-[9px] bg-amber-100/80 text-amber-800 border border-amber-200">SYSTEM</span>}
                      </td>
                      <td className="p-3.5 text-slate-700 font-medium">{r.nameNepali || '—'}</td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] ${ r.isSystem ? 'bg-amber-100/80 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200' }`}>
                          {r.isSystem ? 'System' : 'Custom'}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] ${ r.status === 'Active' ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200' }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500 text-[10px]">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-3 pr-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setPermRole(r)}
                            title="Manage Permissions"
                            className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition cursor-pointer"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setRoleModal({ mode: 'edit', role: r })}
                            title="Edit Role"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteRoleRow(r)}
                            title={r.isSystem ? 'System roles cannot be deleted' : 'Delete Role'}
                            disabled={r.isSystem}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-600 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleStatusToggle(r)}
                            title={r.status === 'Active' ? 'Deactivate Role' : 'Activate Role'}
                            className={`w-9 h-5 rounded-full p-0.5 transition cursor-pointer flex items-center ${ r.status === 'Active' ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start' }`}
                          >
                            <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION */}
          {!listQuery.isPending && !listQuery.isError && total > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/60">
              <span className="text-xs text-slate-500">
                Showing <b className="text-slate-800">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</b> of <b className="text-slate-800">{total}</b> roles
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold cursor-pointer ${ p === page ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100' }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ADD / EDIT ROLE MODAL */}
        {roleModal && (
          <PlatformRoleFormModal
            mode={roleModal.mode}
            role={roleModal.role}
            submitting={createMutation.isPending || updateMutation.isPending}
            onClose={() => setRoleModal(null)}
            onSubmit={(payload) => {
              if (roleModal.mode === 'edit' && roleModal.role) {
                updateMutation.mutate({ id: roleModal.role.id, payload });
              } else {
                createMutation.mutate(payload);
              }
            }}
          />
        )}

        {/* PERMISSIONS DRAWER */}
        {permRole && (
          <PlatformPermissionDrawer
            role={permRole}
            onClose={() => setPermRole(null)}
            onSave={(permissions) => permsMutation.mutate({ id: permRole.id, permissions })}
            saving={permsMutation.isPending}
          />
        )}

        {/* DELETE CONFIRM MODAL */}
        {deleteRoleRow && (
          <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">Delete Platform Role</h3>
                <button onClick={() => setDeleteRoleRow(null)} className="text-slate-500 hover:text-slate-600 font-bold text-sm cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 text-xs space-y-3">
                <div className="flex items-start gap-2.5 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Are you sure you want to delete <b>{deleteRoleRow.name}</b> ({deleteRoleRow.code ?? '—'})? This action cannot be undone.
                  </span>
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button onClick={() => setDeleteRoleRow(null)} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer">
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteRoleRow.id)}
                  disabled={deleteRoleRow.isSystem || deleteMutation.isPending}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {deleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </>)}

      {/* PERMISSIONS — role selector + full matrix editor */}
      {section === 'permissions' && <PlatformPermissionsTab roles={data} onEditRole={(r) => setPermRole(r)} />}

      {/* ACCESS MATRIX — roles × modules grant overview */}
      {section === 'access' && <PlatformAccessMatrixTab roles={data} onEditRole={(r) => setPermRole(r)} />}

      {/* DATA SCOPE — per-role data access scope */}
      {section === 'scope' && <PlatformDataScopeTab roles={data} />}
    </div>
  );
};

/* ===================================================================== */
/*  ADD / EDIT ROLE MODAL                                                 */
/* ===================================================================== */
function PlatformRoleFormModal(props: {
  mode: 'add' | 'edit';
  role?: PlatformRoleRow;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, any>) => void;
}) {
  const { mode, role, submitting, onClose, onSubmit } = props;
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const [code, setCode] = useState(role?.code ?? '');
  const [name, setName] = useState(role?.name ?? '');
  const [nameNepali, setNameNepali] = useState(role?.nameNepali ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [status, setStatus] = useState<'Active' | 'Inactive'>(role?.status ?? 'Active');
  const [sortOrder, setSortOrder] = useState(role?.sortOrder ?? 0);
  const [source, setSource] = useState<'blank' | 'template'>('blank');
  const [templateId, setTemplateId] = useState('');
  const [matrix, setMatrix] = useState<PermissionMatrix>(emptyPermissionMatrix());
  const [formError, setFormError] = useState('');
  const [loadingPerms, setLoadingPerms] = useState(false);

  // Load existing permissions when editing.
  useEffect(() => {
    if (mode === 'edit' && role && accessToken) {
      setLoadingPerms(true);
      superAdminApi.getPlatformRolePermissions(accessToken, role.id)
        .then((grants) => setMatrix(grantsToMatrix(grants as PermissionGrant[])))
        .catch(() => setMatrix(emptyPermissionMatrix()))
        .finally(() => setLoadingPerms(false));
    }
  }, [mode, role, accessToken]);

  // When creating, initialize permissions from the selected template.
  useEffect(() => {
    if (mode !== 'add') return;
    if (source === 'template' && templateId) {
      const tpl = PLATFORM_ROLE_TEMPLATES.find((t) => t.id === templateId);
      setMatrix(tpl ? tpl.apply() : emptyPermissionMatrix());
    } else {
      setMatrix(emptyPermissionMatrix());
    }
  }, [mode, source, templateId]);

  const toggleCell = (key: string, action: string) => {
    setMatrix((prev) => ({ ...prev, [key]: { ...prev[key], [action]: !prev[key]?.[action] } }));
  };

  const toggleCategoryAll = (key: string) => {
    const current = Object.values(matrix[key] ?? {}).every(Boolean);
    setMatrix((prev) => ({
      ...prev,
      [key]: Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a.key, !current])),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!code.trim() && mode === 'add') return setFormError('Role code is required.');
    if (!name.trim()) return setFormError('Role name is required.');
    onSubmit({
      ...(mode === 'add' ? { code: code.trim().toUpperCase() } : {}),
      name: name.trim(),
      nameNepali: nameNepali.trim(),
      description: description.trim(),
      status,
      sortOrder: Number(sortOrder) || 0,
      permissions: matrixToGrants(matrix),
    });
  };

  const isEdit = mode === 'edit';

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              {isEdit ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <h3 className="font-bold text-slate-900 text-sm">{isEdit ? 'Edit Platform Role' : 'Add Platform Role'}</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 font-bold text-sm cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs overflow-y-auto custom-scrollbar flex-1">
          {formError && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{formError}</span>
            </div>
          )}

          {isEdit && (
            <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-600">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Code</div>
                <div className="font-mono font-bold text-slate-800">{role?.code ?? '—'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">System Flag</div>
                <div>{role?.isSystem ? 'System' : 'Custom'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Created</div>
                <div>{role?.createdAt ? new Date(role.createdAt).toLocaleString() : '—'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Sort Order</div>
                <div>{role?.sortOrder ?? 0}</div>
              </div>
            </div>
          )}

          {!isEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Role Code <span className="text-emerald-600">*</span>
                  <span className="ml-1 text-[10px] text-slate-500 font-medium">(e.g. PLT_ADMIN)</span>
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PLT_ADMIN"
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Role Name <span className="text-emerald-600">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Platform Administrator"
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Role Name (Nepali)</label>
            <input
              type="text"
              value={nameNepali}
              onChange={(e) => setNameNepali(e.target.value)}
              placeholder="e.g. प्लेटफर्म प्रशासक"
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description of this role's responsibilities..."
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {isEdit && (
            <div>
              <label className="block text-slate-700 font-bold mb-1">Sort Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* Role source — Blank / Template (add only) */}
          {!isEdit && (
            <div className="space-y-2">
              <label className="block text-slate-700 font-bold mb-1">Initialize Permissions</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  { id: 'blank', label: 'Blank Role', desc: 'Start with no permissions', icon: Square },
                  { id: 'template', label: 'Use Template', desc: 'Start from a built-in template', icon: LayoutGrid },
                ] as { id: 'blank' | 'template'; label: string; desc: string; icon: any }[]).map((opt) => {
                  const OptIcon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSource(opt.id)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${ source === opt.id ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-300' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50' }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                        <OptIcon className="w-3.5 h-3.5 text-emerald-700" /> {opt.label}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>

              {source === 'template' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Choose Template</label>
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="">— Select a template —</option>
                    {PLATFORM_ROLE_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {templateId && (
                    <p className="text-[10px] text-slate-500 mt-1">{PLATFORM_ROLE_TEMPLATES.find((t) => t.id === templateId)?.description}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-slate-700 font-bold">Permissions</label>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setMatrix(emptyPermissionMatrix())} className="px-2 py-1 rounded-lg border border-slate-300 text-slate-600 text-[10px] font-bold hover:bg-slate-100 cursor-pointer">Clear All</button>
                <button
                  type="button"
                  onClick={() => setMatrix(grantAll())}
                  className="px-2 py-1 rounded-lg border border-emerald-300 text-emerald-700 text-[10px] font-bold hover:bg-emerald-50 cursor-pointer"
                >
                  Grant All
                </button>
              </div>
            </div>
            {loadingPerms ? (
              <div className="flex items-center gap-2 text-slate-500 py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading permissions...
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0">
                    <tr className="bg-slate-100 text-slate-800 font-bold">
                      <th className="p-2 pl-3">Category</th>
                      {PERMISSION_ACTIONS.map((a) => (
                        <th key={a.key} className="p-2 text-center">{a.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {PERMISSION_CATEGORIES.map((c) => (
                      <tr key={c.key} className="hover:bg-slate-50">
                        <td className="p-2 pl-3 font-semibold text-slate-700">
                          <button type="button" onClick={() => toggleCategoryAll(c.key)} title="Toggle all" className="cursor-pointer hover:text-emerald-700">
                            {c.label}
                          </button>
                        </td>
                        {PERMISSION_ACTIONS.map((a) => (
                          <td key={a.key} className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={!!matrix[c.key]?.[a.key]}
                              onChange={() => toggleCell(c.key, a.key)}
                              className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </form>

        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  PERMISSION MANAGEMENT DRAWER                                          */
/* ===================================================================== */
function PlatformPermissionDrawer(props: {
  role: PlatformRoleRow;
  onClose: () => void;
  onSave: (permissions: PermissionGrant[]) => void;
  saving: boolean;
}) {
  const { role, onClose, onSave, saving } = props;
  const { accessToken } = useSuperAdminAuth();
  const [matrix, setMatrix] = useState<PermissionMatrix>(emptyPermissionMatrix());
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [menuSearch, setMenuSearch] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    superAdminApi.getPlatformRolePermissions(accessToken, role.id)
      .then((grants) => setMatrix(grantsToMatrix(grants as PermissionGrant[])))
      .catch(() => setMatrix(emptyPermissionMatrix()))
      .finally(() => setLoading(false));
  }, [role.id, accessToken]);

  const toggleCell = (key: string, action: string) => {
    setMatrix((prev) => ({ ...prev, [key]: { ...prev[key], [action]: !prev[key]?.[action] } }));
  };

  const setCategory = (key: string, value: boolean) => {
    setMatrix((prev) => ({ ...prev, [key]: Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a.key, value])) }));
  };

  const bulkSelect = (action: string | 'all' | 'clear') => {
    const m = emptyPermissionMatrix();
    for (const k of Object.keys(m)) {
      m[k] = Object.fromEntries(
        PERMISSION_ACTIONS.map((a) => {
          if (action === 'all') return [a.key, true];
          if (action === 'clear') return [a.key, false];
          return [a.key, a.key === action];
        })
      );
    }
    setMatrix(m);
  };

  const visibleCategories = PERMISSION_CATEGORIES.filter((c) =>
    c.label.toLowerCase().includes(menuSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-4xl h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Platform Role Permissions</h2>
              <p className="text-xs text-slate-500">
                {role.name} {role.code ? `(${role.code})` : ''} · {role.isSystem ? 'System Default' : 'Custom Role'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b border-slate-200 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              placeholder="Search categories..."
              className="w-full bg-slate-50 border placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[10px] text-slate-500 font-mono mr-0.5">Bulk:</span>
            <button onClick={() => bulkSelect('all')} className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"><Check className="w-3 h-3 inline mr-1" />All</button>
            <button onClick={() => bulkSelect('view')} className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"><Eye className="w-3 h-3 inline mr-1" />View Only</button>
            <button onClick={() => bulkSelect('clear')} className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold cursor-pointer"><X className="w-3 h-3 inline mr-1" />Clear</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading permissions...
            </div>
          ) : (
            <div className="space-y-2">
              {visibleCategories.length === 0 && (
                <div className="text-center text-slate-500 text-xs py-8">No categories match your search.</div>
              )}
              {visibleCategories.map((c) => {
                const grantedCount = PERMISSION_ACTIONS.filter((a) => matrix[c.key]?.[a.key]).length;
                const isCollapsed = !!collapsed[c.key];
                return (
                  <div key={c.key} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 cursor-pointer select-none"
                      onClick={() => setCollapsed((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}>
                      <div className="flex items-center gap-2">
                        {isCollapsed ? <ChevronDown className="w-4 h-4 text-emerald-700" /> : <ChevronDown className="w-4 h-4 text-emerald-700" />}
                        <span className="font-bold text-slate-900 text-xs">{c.label}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{grantedCount}/{PERMISSION_ACTIONS.length} granted</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setCategory(c.key, true); }} className="px-1.5 py-0.5 text-[10px] rounded border border-emerald-300 text-emerald-700 font-bold hover:bg-emerald-50 cursor-pointer">All</button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setCategory(c.key, false); }} className="px-1.5 py-0.5 text-[10px] rounded border border-slate-300 text-slate-500 font-bold hover:bg-slate-100 cursor-pointer">None</button>
                      </div>
                    </div>
                    {!isCollapsed && (
                      <div className="grid grid-cols-4 gap-1.5 p-3">
                        {PERMISSION_ACTIONS.map((a) => {
                          const on = !!matrix[c.key]?.[a.key];
                          return (
                            <button
                              key={a.key}
                              type="button"
                              onClick={() => toggleCell(c.key, a.key)}
                              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${ on ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50' }`}
                            >
                              {on ? <Check className="w-3 h-3 text-emerald-700" /> : <span className="w-3 h-3" />}
                              {a.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs">
            {PERMISSION_ACTIONS.map((a) => (
              <span key={a.key} className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                {a.label}: <b className="text-emerald-700">{Object.keys(matrix).filter((k) => matrix[k]?.[a.key]).length}</b>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer">
              Cancel
            </button>
            <button
              onClick={() => onSave(matrixToGrants(matrix))}
              disabled={saving}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Permissions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  PERMISSIONS TAB — inline matrix editor for a selected role            */
/* ===================================================================== */
function PlatformPermissionsTab(props: { roles: PlatformRoleRow[]; onEditRole: (r: PlatformRoleRow) => void }) {
  const { roles, onEditRole } = props;
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');
  const selectedRole = roles.find((r) => r.id === roleId);
  const [matrix, setMatrix] = useState<PermissionMatrix>(emptyPermissionMatrix());
  const [loading, setLoading] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');

  useEffect(() => {
    if (!roleId || !accessToken) return;
    setLoading(true);
    superAdminApi.getPlatformRolePermissions(accessToken, roleId)
      .then((grants) => setMatrix(grantsToMatrix(grants as PermissionGrant[])))
      .catch(() => setMatrix(emptyPermissionMatrix()))
      .finally(() => setLoading(false));
  }, [roleId, accessToken]);

  const toggleCell = (key: string, action: string) => {
    setMatrix((prev) => ({ ...prev, [key]: { ...prev[key], [action]: !prev[key]?.[action] } }));
  };

  const setCategory = (key: string, value: boolean) => {
    setMatrix((prev) => ({ ...prev, [key]: Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a.key, value])) }));
  };

  const handleSave = () => {
    if (!roleId || !selectedRole || !accessToken) return;
    superAdminApi.updatePlatformRolePermissions(accessToken, roleId, { permissions: matrixToGrants(matrix) })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: platformRolesKeys.all });
        addNotification('Permissions Saved', `Permissions updated for ${selectedRole.name}.`, 'success');
      })
      .catch((err: any) => addNotification('Save Failed', err?.message || 'Could not save permissions.', 'alert'));
  };

  const visibleCategories = PERMISSION_CATEGORIES.filter((c) =>
    c.label.toLowerCase().includes(menuSearch.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-700">Role:</span>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer min-w-56"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name} {r.code ? `(${r.code})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
            placeholder="Search categories..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        {selectedRole && (
          <button
            onClick={() => onEditRole(selectedRole)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" /> Open Full Editor
          </button>
        )}
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-xs py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading permissions...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-slate-100">
                <tr className="text-slate-800 font-bold">
                  <th className="p-2.5 pl-4 w-64">Module Category</th>
                  {PERMISSION_ACTIONS.map((a) => (
                    <th key={a.key} className="p-2.5 text-center min-w-20">{a.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleCategories.length === 0 && (
                  <tr><td colSpan={PERMISSION_ACTIONS.length + 1} className="p-8 text-center text-slate-500 text-xs">No categories match your search.</td></tr>
                )}
                {visibleCategories.map((c) => {
                  const allOn = PERMISSION_ACTIONS.every((a) => matrix[c.key]?.[a.key]);
                  return (
                    <tr key={c.key} className="hover:bg-slate-50">
                      <td className="p-2.5 pl-4">
                        <button onClick={() => setCategory(c.key, !allOn)} title="Toggle all actions" className="cursor-pointer font-semibold text-slate-700 hover:text-emerald-700 flex items-center gap-1.5">
                          {c.label}
                          <span className="text-[10px] text-slate-500 font-mono font-normal">{PERMISSION_ACTIONS.filter((a) => matrix[c.key]?.[a.key]).length}/{PERMISSION_ACTIONS.length}</span>
                        </button>
                      </td>
                      {PERMISSION_ACTIONS.map((a) => (
                        <td key={a.key} className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={!!matrix[c.key]?.[a.key]}
                            onChange={() => toggleCell(c.key, a.key)}
                            className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">
          {selectedRole ? `${selectedRole.name} (${selectedRole.code ?? '—'})` : 'Select a role to edit permissions'} · changes apply immediately on save
        </span>
        <button
          onClick={handleSave}
          disabled={!selectedRole || loading}
          className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" /> Save Permissions
        </button>
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  ACCESS MATRIX TAB — roles × modules grant overview                    */
/* ===================================================================== */
function PlatformAccessMatrixTab(props: { roles: PlatformRoleRow[]; onEditRole: (r: PlatformRoleRow) => void }) {
  const { roles, onEditRole } = props;
  const { accessToken } = useSuperAdminAuth();
  const [matrixByRole, setMatrixByRole] = useState<Record<string, PermissionMatrix>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (roles.length === 0 || !accessToken) return;
    let cancelled = false;
    setLoading(true);
    Promise.all(
      roles.map((r) => superAdminApi.getPlatformRolePermissions(accessToken, r.id).catch(() => [] as PermissionGrant[]))
    )
      .then((all) => {
        if (cancelled) return;
        const next: Record<string, PermissionMatrix> = {};
        roles.forEach((r, i) => { next[r.id] = grantsToMatrix(all[i]); });
        setMatrixByRole(next);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [roles, accessToken]);

  const cellColor = (granted: number, total: number) => {
    const ratio = total === 0 ? 0 : granted / total;
    if (ratio === 0) return 'bg-slate-100 text-slate-500';
    if (ratio < 0.5) return 'bg-amber-50 text-amber-700 border border-amber-200';
    if (ratio < 1) return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    return 'bg-emerald-600 text-white';
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Read-only overview of granted permissions per platform role across every module. Click a role row to open the full permission editor.
      </p>
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-xs py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Building access matrix...
          </div>
        ) : roles.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-xs">No platform roles to display.</div>
        ) : (
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-[11px] border-collapse table-fixed">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100 text-slate-800 font-bold">
                  <th className="p-2.5 pl-4 w-48 sticky left-0 bg-slate-100 z-20">Role</th>
                  {PERMISSION_CATEGORIES.map((c) => (
                    <th key={c.key} className="p-2.5 text-center min-w-24" title={c.label}>{c.label.split(' ')[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roles.map((r) => {
                  const m = matrixByRole[r.id] ?? emptyPermissionMatrix();
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onEditRole(r)} title={`Edit ${r.name} permissions`}>
                      <td className="p-2.5 pl-4 sticky left-0 bg-white z-10">
                        <span className="font-bold text-slate-900">{r.name}</span>
                        <span className="ml-1.5 text-[9px] font-mono text-slate-500">{r.code}</span>
                      </td>
                      {PERMISSION_CATEGORIES.map((c) => {
                        const granted = PERMISSION_ACTIONS.filter((a) => m[c.key]?.[a.key]).length;
                        return (
                          <td key={c.key} className="p-1.5 text-center">
                            <span className={`inline-flex min-w-10 justify-center px-1.5 py-0.5 rounded-full font-bold text-[10px] ${cellColor(granted, PERMISSION_ACTIONS.length)}`}>
                              {granted}/{PERMISSION_ACTIONS.length}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  DATA SCOPE TAB — per-role data access scope                           */
/* ===================================================================== */
const DEFAULT_SCOPE_ACTIONS: Record<string, boolean> = {
  view: true, create: false, edit: false, delete: false, approve: false, export: false,
};

function PlatformDataScopeTab(props: { roles: PlatformRoleRow[] }) {
  const { roles } = props;
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const queryClient = useQueryClient();
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');
  const selectedRole = roles.find((r) => r.id === roleId);
  const [scope, setScope] = useState<PlatformDataScope>('all');
  const [actions, setActions] = useState<Record<string, boolean>>({ ...DEFAULT_SCOPE_ACTIONS });
  const [error, setError] = useState('');

  const scopeQuery = useQuery({
    queryKey: platformRolesKeys.dataScope(roleId),
    queryFn: () => superAdminApi.getPlatformRoleDataScope(accessToken!, roleId) as Promise<{
      roleId: string; scope: PlatformDataScope; actions: Record<string, boolean>;
    }>,
    enabled: !!roleId && !!accessToken,
  });

  useEffect(() => {
    if (scopeQuery.data) {
      setScope(scopeQuery.data.scope);
      setActions({ ...DEFAULT_SCOPE_ACTIONS, ...scopeQuery.data.actions });
      setError('');
    }
  }, [scopeQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: { roleId: string; scope: PlatformDataScope; actions: Record<string, boolean> }) =>
      superAdminApi.updatePlatformRoleDataScope(accessToken!, payload.roleId, { scope: payload.scope, actions: payload.actions }),
    onMutate: async (payload) => {
      setError('');
      await queryClient.cancelQueries({ queryKey: platformRolesKeys.dataScope(payload.roleId) });
      const previous = queryClient.getQueryData<{ roleId: string; scope: PlatformDataScope; actions: Record<string, boolean> }>(
        platformRolesKeys.dataScope(payload.roleId)
      );
      queryClient.setQueryData(platformRolesKeys.dataScope(payload.roleId), {
        roleId: payload.roleId,
        scope: payload.scope,
        actions: payload.actions,
      });
      return { previous };
    },
    onError: (err: any, payload, context: any) => {
      console.error('Save Data Scope failed:', err);
      if (context?.previous) {
        queryClient.setQueryData(platformRolesKeys.dataScope(payload.roleId), context.previous);
      }
      const msg = err?.message || 'Could not save data scope.';
      addNotification('Save Data Scope Failed', msg, 'alert');
      setError(msg);
    },
    onSuccess: (saved, payload) => {
      queryClient.setQueryData(platformRolesKeys.dataScope(payload.roleId), saved);
      addNotification('Data Scope Saved', 'Platform role data scope updated successfully.', 'success');
    },
    onSettled: (_, __, payload) => {
      queryClient.invalidateQueries({ queryKey: platformRolesKeys.dataScope(payload.roleId) });
      queryClient.invalidateQueries({ queryKey: platformRolesKeys.all });
    },
  });

  const handleSave = () => {
    setError('');
    if (!selectedRole || !roleId) {
      addNotification('No Role Selected', 'Select a role before saving data scope.', 'alert');
      return;
    }
    if (!['all', 'branch', 'self'].includes(scope)) {
      addNotification('Invalid Scope', 'Record access scope must be All Records, Branch Only, or Self Only.', 'alert');
      return;
    }
    saveMutation.mutate({ roleId, scope, actions });
  };

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-bold text-slate-700">Role:</span>
        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer min-w-56"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name} {r.code ? `(${r.code})` : ''}</option>
          ))}
        </select>
      </div>

      {scopeQuery.isLoading && (
        <div className="text-[11px] text-slate-500 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading saved data scope...
        </div>
      )}

      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-sm font-bold text-slate-900">Record Access Scope</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Controls how much data users with this platform role can see and act on.</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { id: 'all', label: 'All Records', desc: 'View & manage records across every branch and user' },
            { id: 'branch', label: 'Branch Only', desc: 'Restrict access to the user\'s assigned branch' },
            { id: 'self', label: 'Self Only', desc: 'Users only see records they created themselves' },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setScope(opt.id)}
              className={`text-left p-3.5 rounded-xl border transition cursor-pointer ${scope === opt.id ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-300' : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'}`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${scope === opt.id ? 'border-emerald-600' : 'border-slate-300'}`}>
                  {scope === opt.id && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                </span>
                <span className="font-bold text-xs text-slate-900">{opt.label}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-sm font-bold text-slate-900">Action Permissions</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Fine-grained capabilities enabled for this role within its scope.</p>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries({
            view: 'View Records', create: 'Create Records', edit: 'Edit Records', delete: 'Delete Records', approve: 'Approve Records', export: 'Export Data',
          }).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setActions((prev) => ({ ...prev, [k]: !prev[k] }))}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${actions[k] ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              {actions[k] ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <span className="w-3.5 h-3.5" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      <div className="flex items-center justify-end">
        <button
          onClick={handleSave}
          disabled={!selectedRole || saveMutation.isPending}
          className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saveMutation.isPending ? 'Saving...' : 'Save Data Scope'}
        </button>
      </div>
    </div>
  );
}
