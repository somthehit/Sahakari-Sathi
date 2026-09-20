import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
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
  ChevronRight,
  Check,
  Users,
  Copy,
  Download,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  CheckSquare,
  Square,
  Play,
  Pause,
  Eye,
  ArrowUpDown,
  Key,
  LayoutGrid,
  Globe,
  Coins,
  History,
  ScrollText,
} from 'lucide-react';
import { useCoop } from '../../context/CoopContext';
import {
  fetchRoles,
  fetchCloneSources,
  fetchRolePermissions,
  updateRolePermissions,
  fetchRoleUsers,
  fetchRoleDataScope,
  updateRoleDataScope,
  createRole,
  updateRole,
  updateRoleStatus,
  deleteRole,
  fetchRoleApprovalLimits,
  updateRoleApprovalLimits,
  type RoleRow,
  type RolesQuery,
  type AssignedUser,
  type RoleDataScope,
} from '../../api/roles';
import {
  PERMISSION_CATEGORIES,
  PERMISSION_ACTIONS,
  emptyPermissionMatrix,
  grantsToMatrix,
  matrixToGrants,
  type PermissionMatrix,
  type PermissionGrant,
} from '../../types/permissions';

interface Props {
  activeSubKey?: string;
}

const DEFAULT_WIDTHS: Record<string, number> = {
  select: 44,
  code: 90,
  name: 180,
  nameNepali: 150,
  users: 70,
  system: 90,
  status: 110,
  createdAt: 130,
  actions: 150,
};

const PAGE_SIZES = [10, 25, 50, 100];

/** Build a permission matrix with every action granted. */
const grantAll = (): PermissionMatrix => {
  const m = emptyPermissionMatrix();
  for (const k of Object.keys(m)) m[k] = Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a.key, true]));
  return m;
};

/** Build a permission matrix granting the listed actions per category. */
const grantActions = (cats: Record<string, string[]>): PermissionMatrix => {
  const m = emptyPermissionMatrix();
  for (const [cat, actions] of Object.entries(cats)) {
    if (!m[cat]) continue;
    for (const a of actions) if (m[cat][a] !== undefined) m[cat][a] = true;
  }
  return m;
};

/** Built-in role templates used by the "Use Template" create flow. */
const ROLE_TEMPLATES = [
  { id: 'super_admin', name: 'Super Administrator', description: 'Full access to every module and every action', apply: grantAll },
  {
    id: 'manager', name: 'Branch Manager', description: 'Broad operational control with approval powers',
    apply: () => grantActions({
      dashboard: ['view'], members: ['view', 'create', 'edit', 'approve'], savings: ['view', 'create', 'edit', 'approve', 'print'], loans: ['view', 'create', 'edit', 'approve', 'print'], accounting: ['view', 'create', 'edit', 'approve', 'export', 'print'], shares: ['view', 'create', 'edit'], inventory: ['view', 'create', 'edit'], hr: ['view', 'edit', 'approve'], reports: ['view', 'export', 'print'], admin: ['view', 'assign'], settings: ['view'], audit: ['view'],
    }),
  },
  {
    id: 'teller', name: 'Teller / Cashier', description: 'Counter operations — deposits, withdrawals and vault',
    apply: () => grantActions({
      dashboard: ['view'], members: ['view'], savings: ['view', 'create', 'edit', 'print'], loans: ['view'], accounting: ['view', 'create'], inventory: ['view'],
    }),
  },
  {
    id: 'loan_officer', name: 'Loan Officer', description: 'Loan appraisal, disbursement and recovery',
    apply: () => grantActions({
      dashboard: ['view'], members: ['view', 'create', 'edit'], loans: ['view', 'create', 'edit', 'approve', 'print'], shares: ['view'], accounting: ['view'], reports: ['view', 'export'],
    }),
  },
  {
    id: 'accountant', name: 'Accountant', description: 'Financial entries, vouchers and reconciliation',
    apply: () => grantActions({
      dashboard: ['view'], members: ['view'], savings: ['view', 'edit'], loans: ['view', 'edit'], accounting: ['view', 'create', 'edit', 'export', 'print'], shares: ['view'], reports: ['view', 'export', 'print'], admin: ['view'], settings: ['view'],
    }),
  },
  {
    id: 'auditor', name: 'Internal Auditor', description: 'Read-only access across ledgers plus audit trail',
    apply: () => grantActions({
      members: ['view'], savings: ['view'], loans: ['view'], accounting: ['view', 'export', 'print'], shares: ['view'], inventory: ['view'], hr: ['view'], reports: ['view', 'export', 'print'], audit: ['view', 'export', 'print'],
    }),
  },
  {
    id: 'viewer', name: 'Read-only Viewer', description: 'View-only access to dashboards and reports',
    apply: () => grantActions({
      dashboard: ['view'], members: ['view'], savings: ['view'], loans: ['view'], accounting: ['view'], shares: ['view'], reports: ['view', 'export', 'print'],
    }),
  },
];

const rolesKeys = {
  all: ['roles'] as const,
  list: (q: RolesQuery) => ['roles', q] as const,
  detail: (id: string) => ['roles', 'detail', id] as const,
  permissions: (id: string) => ['roles', 'permissions', id] as const,
  dataScope: (id: string) => ['roles', 'data-scope', id] as const,
  users: (id: string) => ['roles', 'users', id] as const,
  cloneSources: ['roles', 'clone-sources'] as const,
};

type SortBy = 'name' | 'code' | 'users' | 'createdAt';

type RoleSection = 'general' | 'permissions' | 'access' | 'menu' | 'scope' | 'limits' | 'audit';

export const AdminRolesPermissionsView: React.FC<Props> = () => {
  const { addNotification } = useCoop();
  const queryClient = useQueryClient();

  // ── Section tabs (General | Permissions | Access Matrix | Menu Visibility | Data Scope | Approval Limits | Audit History) ──
  const [section, setSection] = useState<RoleSection>('general');

  // ── Table state ──────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [systemFilter, setSystemFilter] = useState<'All' | 'System' | 'Custom'>('All');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [colWidths, setColWidths] = useState<Record<string, number>>({ ...DEFAULT_WIDTHS });

  // ── Modals ───────────────────────────────────────────────────────────────
  const [roleModal, setRoleModal] = useState<{ mode: 'add' | 'edit'; role?: RoleRow } | null>(null);
  const [permRole, setPermRole] = useState<RoleRow | null>(null);
  const [usersRole, setUsersRole] = useState<RoleRow | null>(null);
  const [deleteRoleRow, setDeleteRoleRow] = useState<RoleRow | null>(null);

  // Debounce search input (400ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const queryParams: RolesQuery = useMemo(
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

  // ── Data ────────────────────────────────────────────────────────────────
  const rolesQuery = useQuery({
    queryKey: rolesKeys.list(queryParams),
    queryFn: () => fetchRoles(queryParams),
    placeholderData: (prev) => prev,
  });

  const cloneSourcesQuery = useQuery({
    queryKey: rolesKeys.cloneSources,
    queryFn: fetchCloneSources,
    enabled: roleModal?.mode === 'add',
  });

  const data = rolesQuery.data?.data ?? [];
  const total = rolesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, rolesQuery.data?.totalPages ?? 1);

  // ── Mutations ───────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createRole>[0]) => createRole(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.all });
      addNotification('Role Created', 'New role created successfully.', 'success');
      setRoleModal(null);
    },
    onError: (err: any) => {
      addNotification('Role Creation Failed', err?.response?.data?.error || err.message, 'alert');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateRole>[1] }) =>
      updateRole(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.all });
      addNotification('Role Updated', 'Role updated successfully.', 'success');
      setRoleModal(null);
    },
    onError: (err: any) => {
      addNotification('Role Update Failed', err?.response?.data?.error || err.message, 'alert');
    },
  });

  // Optimistic status toggle with rollback.
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'Active' | 'Inactive' }) =>
      updateRoleStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: rolesKeys.all });
      const previous = queryClient.getQueriesData({ queryKey: rolesKeys.all });
      queryClient.setQueriesData<typeof rolesQuery.data>({ queryKey: rolesKeys.all }, (old) =>
        old ? { ...old, data: old.data.map((r) => (r.id === id ? { ...r, status } : r)) } : old
      );
      return { previous };
    },
    onError: (err: any, vars, context: any) => {
      if (context?.previous) {
        for (const [key, value] of context.previous) {
          queryClient.setQueryData(key, value);
        }
      }
      addNotification('Status Update Failed', err?.response?.data?.error || err.message, 'alert');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.all });
      addNotification('Role Deleted', 'Role deleted successfully.', 'success');
      setDeleteRoleRow(null);
    },
    onError: (err: any) => {
      addNotification('Delete Failed', err?.response?.data?.error || err.message, 'alert');
    },
  });

  const permsMutation = useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: PermissionGrant[] }) =>
      updateRolePermissions(id, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.all });
      addNotification('Permissions Saved', 'Role permissions updated successfully.', 'success');
      setPermRole(null);
    },
    onError: (err: any) => {
      addNotification('Permissions Save Failed', err?.response?.data?.error || err.message, 'alert');
    },
  });

  const handleStatusToggle = (role: RoleRow) => {
    statusMutation.mutate({
      id: role.id,
      status: role.status === 'Active' ? 'Inactive' : 'Active',
    });
  };

  const bulkRun = async (
    fn: (id: string) => Promise<any>,
    successMsg: string
  ) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const results = await Promise.allSettled(ids.map((id) => fn(id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    queryClient.invalidateQueries({ queryKey: rolesKeys.all });
    if (failed === 0) {
      addNotification('Bulk Action', `${successMsg} (${ids.length} role${ids.length === 1 ? '' : 's'}).`, 'success');
    } else {
      addNotification('Bulk Action', `${ids.length - failed} succeeded, ${failed} failed. Review system roles / assigned users.`, 'warning');
    }
    setSelected(new Set());
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

  const handleSort = (key: SortBy) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir(key === 'users' || key === 'createdAt' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  // ── Exports / Print ─────────────────────────────────────────────────────
  const exportCSV = () => {
    if (data.length === 0) return;
    const header = ['Code', 'Role Name', 'Nepali Name', 'Description', 'Users', 'Type', 'Status'];
    const lines = data.map((r) => [
      r.code ?? '', r.name, r.nameNepali ?? '', r.description ?? '',
      r.usersCount, r.isSystem ? 'System' : 'Custom', r.status,
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roles.csv';
    a.click();
    URL.revokeObjectURL(url);
    addNotification('Export', 'Roles exported to CSV.', 'success');
  };

  const exportExcel = () => {
    if (data.length === 0) return;
    const rows = data.map((r) => ({
      Code: r.code ?? '',
      'Role Name': r.name,
      'Nepali Name': r.nameNepali ?? '',
      Description: r.description ?? '',
      Users: r.usersCount,
      Type: r.isSystem ? 'System' : 'Custom',
      Status: r.status,
      'Created': r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Roles');
    XLSX.writeFile(wb, 'roles.xlsx');
    addNotification('Export', 'Roles exported to Excel.', 'success');
  };

  const handlePrint = () => {
    if (data.length === 0) return;
    const w = window.open('', '_blank', 'width=1000,height=700');
    if (!w) return;
    const rows = data
      .map(
        (r) =>
          `<tr><td>${r.code ?? ''}</td><td>${r.name}</td><td>${r.nameNepali ?? ''}</td><td>${r.usersCount}</td><td>${r.isSystem ? 'System' : 'Custom'}</td><td>${r.status}</td></tr>`
      )
      .join('');
    w.document.write(`<html><head><title>Roles</title><style>
      *{font-family:system-ui,sans-serif} h2{color:#065f46}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:left;font-size:12px}
      th{background:#f1f5f9;font-weight:700}
      </style></head><body>
      <h2>Roles</h2>
      <p>Generated on ${new Date().toLocaleString()}</p>
      <table><thead><tr><th>Code</th><th>Role Name</th><th>Nepali Name</th><th>Users</th><th>Type</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table>
      </body></html>`);
    w.document.close();
    w.print();
  };

  // ── Column resize ───────────────────────────────────────────────────────
  const startResize = (e: React.PointerEvent, col: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[col] ?? DEFAULT_WIDTHS[col];
    const onMove = (ev: PointerEvent) => {
      const next = Math.max(60, startW + (ev.clientX - startX));
      setColWidths((prev) => ({ ...prev, [col]: next }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const retry = () => queryClient.invalidateQueries({ queryKey: rolesKeys.all });

  const sortIndicator = (key: SortBy) => {
    if (sortBy !== key) return <ArrowUpDown className="w-3 h-3 text-slate-500 ml-1" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 text-emerald-600 ml-1" />
      : <ChevronDown className="w-3.5 h-3.5 text-emerald-600 ml-1" />;
  };

  const allPageSelected = data.length > 0 && data.every((r) => selected.has(r.id));

  return (
    <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
            <Shield className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Roles</h1>
            <p className="text-xs text-slate-500">Enterprise role & permission management (database driven)</p>
          </div>
        </div>
        <button
          onClick={() => setRoleModal({ mode: 'add' })}
          className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Role</span>
        </button>
      </div>

      {/* SECTION TABS */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 border border-slate-200 rounded-xl p-1.5">
        {([
          { id: 'general', label: 'General', icon: Shield },
          { id: 'permissions', label: 'Permissions', icon: Key },
          { id: 'access', label: 'Access Matrix', icon: LayoutGrid },
          { id: 'menu', label: 'Menu Visibility', icon: Eye },
          { id: 'scope', label: 'Data Scope', icon: Globe },
          { id: 'limits', label: 'Approval Limits', icon: Coins },
          { id: 'audit', label: 'Audit History', icon: History },
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

      {/* GENERAL — Role CRUD table */}
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
          <option value="users">Sort: Users Count</option>
          <option value="createdAt">Sort: Created Date</option>
        </select>

        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
        >
          {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
        </select>

        <button onClick={retry} title="Refresh" className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer shadow-2xs">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* BULK BAR */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-emerald-50/70 border border-emerald-200 rounded-xl px-3 py-2 text-xs">
          <span className="font-bold text-emerald-800">{selected.size} selected</span>
          <button
            onClick={() => bulkRun((id) => updateRoleStatus(id, 'Active'), 'Activated')}
            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
          >
            <Play className="w-3 h-3" /> Activate
          </button>
          <button
            onClick={() => bulkRun((id) => updateRoleStatus(id, 'Inactive'), 'Deactivated')}
            className="px-2.5 py-1.5 bg-slate-600 hover:bg-slate-200 text-slate-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
          >
            <Pause className="w-3 h-3" /> Deactivate
          </button>
          <button
            onClick={() => bulkRun((id) => deleteRole(id), 'Deleted')}
            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-2.5 py-1.5 border border-emerald-300 text-emerald-800 rounded-lg font-bold hover:bg-emerald-100 cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* EXPORT BAR */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={exportCSV} className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center gap-1 cursor-pointer">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
        <button onClick={exportExcel} className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center gap-1 cursor-pointer">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
        </button>
        <button onClick={handlePrint} className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center gap-1 cursor-pointer">
          <Printer className="w-3.5 h-3.5" /> Print
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        {rolesQuery.isPending ? (
          <div className="p-8 space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-11 bg-slate-100/80 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : rolesQuery.isError ? (
          <div className="p-10 text-center">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800 mb-1">Failed to load roles</p>
            <p className="text-xs text-slate-500 mb-4">{(rolesQuery.error as any)?.response?.data?.error || (rolesQuery.error as any)?.message}</p>
            <button onClick={retry} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer">
              Retry
            </button>
          </div>
        ) : data.length === 0 ? (
          <div className="p-10 text-center">
            <Shield className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800 mb-1">No roles found</p>
            <p className="text-xs text-slate-500 mb-4">
              {search || statusFilter !== 'All' || systemFilter !== 'All'
                ? 'No roles match your current filters.'
                : 'Create your first role to get started.'}
            </p>
            {!(search || statusFilter !== 'All' || systemFilter !== 'All') && (
              <button onClick={() => setRoleModal({ mode: 'add' })} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 mx-auto">
                <Plus className="w-3.5 h-3.5" /> Add Role
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs table-fixed">
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                  <th style={{ width: colWidths.select }} className="p-3 pl-4 relative">
                    <button onClick={toggleAll} className="cursor-pointer text-slate-600 hover:text-emerald-700">
                      {allPageSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th onClick={() => handleSort('code')} className="p-3 relative cursor-pointer select-none">
                    <div className="flex items-center">Code {sortIndicator('code')}</div>
                    <span onPointerDown={(e) => startResize(e, 'code')} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-emerald-300/50" />
                  </th>
                  <th onClick={() => handleSort('name')} className="p-3 relative cursor-pointer select-none">
                    <div className="flex items-center">Role Name {sortIndicator('name')}</div>
                    <span onPointerDown={(e) => startResize(e, 'name')} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-emerald-300/50" />
                  </th>
                  <th className="p-3 relative">
                    <div className="flex items-center">Nepali Name</div>
                    <span onPointerDown={(e) => startResize(e, 'nameNepali')} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-emerald-300/50" />
                  </th>
                  <th onClick={() => handleSort('users')} className="p-3 relative cursor-pointer select-none text-center">
                    <div className="flex items-center justify-center">Users {sortIndicator('users')}</div>
                    <span onPointerDown={(e) => startResize(e, 'users')} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-emerald-300/50" />
                  </th>
                  <th className="p-3 relative text-center">
                    <div className="flex items-center justify-center">Type</div>
                    <span onPointerDown={(e) => startResize(e, 'system')} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-emerald-300/50" />
                  </th>
                  <th className="p-3 relative text-center">
                    <div className="flex items-center justify-center">Status</div>
                    <span onPointerDown={(e) => startResize(e, 'status')} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-emerald-300/50" />
                  </th>
                  <th onClick={() => handleSort('createdAt')} className="p-3 relative cursor-pointer select-none">
                    <div className="flex items-center">Created {sortIndicator('createdAt')}</div>
                    <span onPointerDown={(e) => startResize(e, 'createdAt')} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-emerald-300/50" />
                  </th>
                  <th className="p-3 pr-4 text-center sticky right-0 bg-slate-100 z-10">
                    <div className="flex items-center justify-center">Actions</div>
                  </th>
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
                      <button
                        onClick={() => setUsersRole(r)}
                        title="View assigned users"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 font-bold cursor-pointer transition"
                      >
                        <Users className="w-3.5 h-3.5 text-emerald-700" />
                        {r.usersCount}
                      </button>
                    </td>
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
                    <td className="p-3 pr-4 sticky right-0 bg-white z-10">
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
        {!rolesQuery.isPending && !rolesQuery.isError && total > 0 && (
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
                let start = Math.max(1, Math.min(page - 2, totalPages - 4));
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
        <RoleFormModal
          mode={roleModal.mode}
          role={roleModal.role}
          cloneSources={cloneSourcesQuery.data ?? []}
          submitting={createMutation.isPending || updateMutation.isPending}
          onClose={() => setRoleModal(null)}
          onSubmit={async (payload) => {
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
        <PermissionDrawer
          role={permRole}
          onClose={() => setPermRole(null)}
          onSave={async (permissions) => permsMutation.mutate({ id: permRole.id, permissions })}
          saving={permsMutation.isPending}
        />
      )}

      {/* ASSIGNED USERS MODAL */}
      {usersRole && (
        <UsersModal role={usersRole} onClose={() => setUsersRole(null)} />
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteRoleRow && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Delete Role</h3>
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
              {deleteRoleRow.usersCount > 0 && (
                <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <b>This role is assigned to {deleteRoleRow.usersCount} user{deleteRoleRow.usersCount === 1 ? '' : 's'}.</b>{' '}
                  Please reassign users before deleting.
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button onClick={() => setDeleteRoleRow(null)} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer">
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteRoleRow.id)}
                disabled={deleteRoleRow.usersCount > 0 || deleteRoleRow.isSystem || deleteMutation.isPending}
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
      {section === 'permissions' && <PermissionsTab roles={data} onEditRole={(r) => setPermRole(r)} />}

      {/* ACCESS MATRIX — roles × modules grant overview */}
      {section === 'access' && <AccessMatrixTab roles={data} onEditRole={(r) => setPermRole(r)} />}

      {/* MENU VISIBILITY — per-role menu item toggles */}
      {section === 'menu' && <MenuVisibilityTab roles={data} />}

      {/* DATA SCOPE — per-role data access scope */}
      {section === 'scope' && <DataScopeTab roles={data} />}

      {/* APPROVAL LIMITS — per-role financial limits */}
      {section === 'limits' && <ApprovalLimitsTab roles={data} />}

      {/* AUDIT HISTORY — roles module audit trail */}
      {section === 'audit' && <RolesAuditHistoryTab />}
    </div>
  );
};

/* ===================================================================== */
/*  ADD / EDIT ROLE MODAL                                                 */
/* ===================================================================== */
function RoleFormModal(props: {
  mode: 'add' | 'edit';
  role?: RoleRow;
  cloneSources: RoleRow[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => void;
}) {
  const { mode, role, cloneSources, submitting, onClose, onSubmit } = props;
  const { addNotification } = useCoop();
  const [code, setCode] = useState(role?.code ?? '');
  const [name, setName] = useState(role?.name ?? '');
  const [nameNepali, setNameNepali] = useState(role?.nameNepali ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [status, setStatus] = useState<'Active' | 'Inactive'>(role?.status ?? 'Active');
  const [sortOrder, setSortOrder] = useState(role?.sortOrder ?? 0);
  const [source, setSource] = useState<'blank' | 'clone' | 'template'>('blank');
  const [cloneFromId, setCloneFromId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [matrix, setMatrix] = useState<PermissionMatrix>(emptyPermissionMatrix());
  const [formError, setFormError] = useState('');
  const [loadingPerms, setLoadingPerms] = useState(false);

  // Load existing permissions when editing.
  useEffect(() => {
    if (mode === 'edit' && role) {
      setLoadingPerms(true);
      fetchRolePermissions(role.id)
        .then((grants) => setMatrix(grantsToMatrix(grants)))
        .catch(() => setMatrix(emptyPermissionMatrix()))
        .finally(() => setLoadingPerms(false));
    }
  }, [mode, role]);

  // When creating, initialize permissions from the selected source.
  useEffect(() => {
    if (mode !== 'add') return;
    setLoadingPerms(true);
    if (source === 'clone' && cloneFromId) {
      fetchRolePermissions(cloneFromId)
        .then((grants) => setMatrix(grantsToMatrix(grants)))
        .catch(() => addNotification('Clone', 'Could not load source permissions.', 'warning'))
        .finally(() => setLoadingPerms(false));
      return;
    }
    if (source === 'template' && templateId) {
      const tpl = ROLE_TEMPLATES.find((t) => t.id === templateId);
      setMatrix(tpl ? tpl.apply() : emptyPermissionMatrix());
      setLoadingPerms(false);
      return;
    }
    setMatrix(emptyPermissionMatrix());
    setLoadingPerms(false);
  }, [mode, source, cloneFromId, templateId, addNotification]);

  const toggleCell = (key: string, action: string) => {
    setMatrix((prev) => {
      const next = { ...prev, [key]: { ...prev[key], [action]: !prev[key]?.[action] } };
      return next;
    });
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
      ...(mode === 'add' && source === 'clone' && cloneFromId ? { cloneFromId } : {}),
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
            <h3 className="font-bold text-slate-900 text-sm">{isEdit ? 'Edit Role' : 'Add New Role'}</h3>
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
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Assigned Users</div>
                <div>{role?.usersCount ?? 0}</div>
              </div>
            </div>
          )}

          {!isEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Role Code <span className="text-emerald-600">*</span>
                  <span className="ml-1 text-[10px] text-slate-500 font-medium">(e.g. ACC)</span>
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ACC"
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
              placeholder="e.g. Accountant"
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Role Name (Nepali)</label>
            <input
              type="text"
              value={nameNepali}
              onChange={(e) => setNameNepali(e.target.value)}
              placeholder="e.g. लेखापाल"
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
            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <label className="block text-slate-700 font-bold mb-1">Sort Order</label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Role source — Blank / Clone / Template (add only) */}
          {!isEdit && (
            <div className="space-y-2">
              <label className="block text-slate-700 font-bold mb-1">Initialize Permissions</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  { id: 'blank', label: 'Blank Role', desc: 'Start with no permissions', icon: Square },
                  { id: 'clone', label: 'Clone Existing Role', desc: 'Copy permissions from another role', icon: Copy },
                  { id: 'template', label: 'Use Template', desc: 'Start from a built-in template', icon: LayoutGrid },
                ] as { id: 'blank' | 'clone' | 'template'; label: string; desc: string; icon: any }[]).map((opt) => {
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

              {source === 'clone' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Clone From Role</label>
                  <select
                    value={cloneFromId}
                    onChange={(e) => setCloneFromId(e.target.value)}
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="">— Select a role to clone —</option>
                    {cloneSources
                      .filter((c) => c.status === 'Active')
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.name} {c.code ? `(${c.code})` : ''}</option>
                      ))}
                  </select>
                </div>
              )}

              {source === 'template' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Choose Template</label>
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="">— Select a template —</option>
                    {ROLE_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {templateId && (
                    <p className="text-[10px] text-slate-500 mt-1">{ROLE_TEMPLATES.find((t) => t.id === templateId)?.description}</p>
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
                  onClick={() => {
                    const m = emptyPermissionMatrix();
                    for (const k of Object.keys(m)) m[k] = Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a.key, true]));
                    setMatrix(m);
                  }}
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
function PermissionDrawer(props: {
  role: RoleRow;
  onClose: () => void;
  onSave: (permissions: PermissionGrant[]) => void;
  saving: boolean;
}) {
  const { role, onClose, onSave, saving } = props;
  const [matrix, setMatrix] = useState<PermissionMatrix>(emptyPermissionMatrix());
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [menuSearch, setMenuSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchRolePermissions(role.id)
      .then((grants) => setMatrix(grantsToMatrix(grants)))
      .catch(() => setMatrix(emptyPermissionMatrix()))
      .finally(() => setLoading(false));
  }, [role.id]);

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

  const counts = PERMISSION_ACTIONS.reduce<Record<string, number>>((acc, a) => {
    acc[a.key] = Object.keys(matrix).filter((k) => matrix[k]?.[a.key]).length;
    return acc;
  }, {});

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
              <h2 className="text-base font-bold text-slate-900 leading-tight">Role Permissions</h2>
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
                        {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-emerald-700" />}
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
                {a.label}: <b className="text-emerald-700">{counts[a.key]}</b>
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
/*  ASSIGNED USERS MODAL                                                  */
/* ===================================================================== */
function UsersModal(props: { role: RoleRow; onClose: () => void }) {
  const { role, onClose } = props;
  const usersQuery = useQuery({
    queryKey: rolesKeys.users(role.id),
    queryFn: () => fetchRoleUsers(role.id),
    enabled: true,
  });

  const users: AssignedUser[] = usersQuery.data ?? [];

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              Users in <span className="text-emerald-800">{role.name}</span>
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 font-bold text-sm cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">
          {usersQuery.isPending ? (
            <div className="flex items-center gap-2 text-slate-500 text-xs py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading assigned users...
            </div>
          ) : users.length === 0 ? (
            <div className="text-center text-slate-500 text-xs py-6">No users are assigned to this role.</div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold">
                    <th className="p-2.5 pl-3">Username</th>
                    <th className="p-2.5">Email</th>
                    <th className="p-2.5 pr-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="p-2.5 pl-3 font-bold text-slate-900">{u.username}</td>
                      <td className="p-2.5 text-slate-600">{u.email || '—'}</td>
                      <td className="p-2.5 pr-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${ u.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600' }`}>{u.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-slate-100 flex items-center justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  PERMISSIONS TAB — inline matrix editor for a selected role            */
/* ===================================================================== */
function PermissionsTab(props: { roles: RoleRow[]; onEditRole: (r: RoleRow) => void }) {
  const { roles, onEditRole } = props;
  const { addNotification } = useCoop();
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');
  const selectedRole = roles.find((r) => r.id === roleId);
  const [matrix, setMatrix] = useState<PermissionMatrix>(emptyPermissionMatrix());
  const [loading, setLoading] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');

  useEffect(() => {
    if (!roleId) return;
    setLoading(true);
    fetchRolePermissions(roleId)
      .then((grants) => setMatrix(grantsToMatrix(grants)))
      .catch(() => setMatrix(emptyPermissionMatrix()))
      .finally(() => setLoading(false));
  }, [roleId]);

  const toggleCell = (key: string, action: string) => {
    setMatrix((prev) => ({ ...prev, [key]: { ...prev[key], [action]: !prev[key]?.[action] } }));
  };

  const setCategory = (key: string, value: boolean) => {
    setMatrix((prev) => ({ ...prev, [key]: Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a.key, value])) }));
  };

  const handleSave = () => {
    if (!roleId || !selectedRole) return;
    updateRolePermissions(roleId, matrixToGrants(matrix))
      .then(() => addNotification('Permissions Saved', `Permissions updated for ${selectedRole.name}.`, 'success'))
      .catch(() => addNotification('Save Failed', 'Could not save permissions.', 'alert'));
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
function AccessMatrixTab(props: { roles: RoleRow[]; onEditRole: (r: RoleRow) => void }) {
  const { roles, onEditRole } = props;
  const [matrixByRole, setMatrixByRole] = useState<Record<string, PermissionMatrix>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (roles.length === 0) return;
    let cancelled = false;
    setLoading(true);
    Promise.all(roles.map((r) => fetchRolePermissions(r.id).catch(() => [] as PermissionGrant[])))
      .then((all) => {
        if (cancelled) return;
        const next: Record<string, PermissionMatrix> = {};
        roles.forEach((r, i) => { next[r.id] = grantsToMatrix(all[i]); });
        setMatrixByRole(next);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [roles]);

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
        Read-only overview of granted permissions per role across every module. Click a role row to open the full permission editor.
      </p>
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-xs py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Building access matrix...
          </div>
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
/*  MENU VISIBILITY TAB — per-role menu item toggles                      */
/* ===================================================================== */
const MENU_ITEMS = [
  { key: 'home', label: 'Dashboard', group: 'Operational' },
  { key: 'member_directory', label: 'Members', group: 'Operational' },
  { key: 'shares_issue', label: 'Shares', group: 'Operational' },
  { key: 'savings_deposit', label: 'Savings & Deposits', group: 'Operational' },
  { key: 'loan_appraisal', label: 'Loans', group: 'Operational' },
  { key: 'cash_vault', label: 'Cash & Bank', group: 'Operational' },
  { key: 'accounts_vouchers', label: 'Accounting', group: 'Operational' },
  { key: 'inventory_items', label: 'Inventory', group: 'Operational' },
  { key: 'fixed_assets_register', label: 'Assets', group: 'Operational' },
  { key: 'hr_staff', label: 'HR & Payroll', group: 'Operational' },
  { key: 'billing_fees', label: 'Billing', group: 'Operational' },
  { key: 'reports_pearls', label: 'Reports', group: 'Operational' },
  { key: 'notifications_sms', label: 'Notifications', group: 'Operational' },
  { key: 'documents_kyc', label: 'Documents', group: 'Operational' },
  { key: 'ai_copilot', label: 'AI Copilot & Help', group: 'Operational' },
  { key: 'admin_roles', label: 'Admin', group: 'Administration' },
  { key: 'setup_coop_profile', label: 'Setups', group: 'Administration' },
];

function MenuVisibilityTab(props: { roles: RoleRow[] }) {
  const { roles } = props;
  const { addNotification } = useCoop();
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');
  const selectedRole = roles.find((r) => r.id === roleId);
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!roleId) return;
    try {
      const saved = localStorage.getItem(`role_menu_visibility_${roleId}`);
      if (saved) setVisible(JSON.parse(saved));
      else setVisible(Object.fromEntries(MENU_ITEMS.map((m) => [m.key, true])));
    } catch {
      setVisible(Object.fromEntries(MENU_ITEMS.map((m) => [m.key, true])));
    }
  }, [roleId]);

  const toggle = (key: string) => setVisible((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = () => {
    if (!selectedRole) return;
    localStorage.setItem(`role_menu_visibility_${roleId}`, JSON.stringify(visible));
    addNotification('Menu Visibility Saved', `Menu visibility updated for ${selectedRole.name}.`, 'success');
  };

  const groupCount = (g: string) => MENU_ITEMS.filter((m) => m.group === g && visible[m.key] !== false).length;
  const totalItems = MENU_ITEMS.length;

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
        <span className="text-[11px] text-slate-500 font-mono">{Object.values(visible).filter(Boolean).length}/{totalItems} menus visible</span>
        <button
          onClick={() => setVisible(Object.fromEntries(MENU_ITEMS.map((m) => [m.key, true])))}
          className="px-2.5 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 text-[10px] font-bold hover:bg-emerald-50 cursor-pointer"
        >
          Show All
        </button>
        <button
          onClick={() => setVisible(Object.fromEntries(MENU_ITEMS.map((m) => [m.key, false])))}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-[10px] font-bold hover:bg-slate-100 cursor-pointer"
        >
          Hide All
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {['Operational', 'Administration'].map((g) => (
          <div key={g} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{g}</span>
              <span className="text-[10px] font-mono text-slate-500">{groupCount(g)}/{MENU_ITEMS.filter((m) => m.group === g).length}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {MENU_ITEMS.filter((m) => m.group === g).map((m) => (
                <button
                  key={m.key}
                  onClick={() => toggle(m.key)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-xs transition cursor-pointer ${visible[m.key] !== false ? 'text-slate-800 hover:bg-emerald-50/40' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <span className="font-semibold">{m.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${visible[m.key] !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                    {visible[m.key] !== false ? 'Visible' : 'Hidden'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end">
        <button
          onClick={handleSave}
          disabled={!selectedRole}
          className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" /> Save Menu Visibility
        </button>
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

function DataScopeTab(props: { roles: RoleRow[] }) {
  const { roles } = props;
  const { addNotification } = useCoop();
  const queryClient = useQueryClient();
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');
  const selectedRole = roles.find((r) => r.id === roleId);
  const [scope, setScope] = useState<RoleDataScope>('all');
  const [actions, setActions] = useState<Record<string, boolean>>({ ...DEFAULT_SCOPE_ACTIONS });
  const [error, setError] = useState('');

  // Load the persisted data scope from the backend whenever the role changes.
  const scopeQuery = useQuery({
    queryKey: rolesKeys.dataScope(roleId),
    queryFn: () => fetchRoleDataScope(roleId),
    enabled: !!roleId,
  });

  useEffect(() => {
    if (scopeQuery.data) {
      setScope(scopeQuery.data.scope);
      setActions({ ...DEFAULT_SCOPE_ACTIONS, ...scopeQuery.data.actions });
      setError('');
    }
  }, [scopeQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: { roleId: string; scope: RoleDataScope; actions: Record<string, boolean> }) =>
      updateRoleDataScope(payload.roleId, payload.scope, payload.actions),
    onMutate: async (payload) => {
      setError('');
      await queryClient.cancelQueries({ queryKey: rolesKeys.dataScope(payload.roleId) });
      const previous = queryClient.getQueryData<{ scope: RoleDataScope; actions: Record<string, boolean> }>(
        rolesKeys.dataScope(payload.roleId)
      );
      queryClient.setQueryData(rolesKeys.dataScope(payload.roleId), {
        roleId: payload.roleId,
        scope: payload.scope,
        actions: payload.actions,
      });
      return { previous };
    },
    onError: (err: any, payload, context: any) => {
      console.error('Save Data Scope failed:', err);
      if (context?.previous) {
        queryClient.setQueryData(rolesKeys.dataScope(payload.roleId), context.previous);
      }
      const msg = err?.response?.data?.error || err?.message || 'Could not save data scope.';
      addNotification('Save Data Scope Failed', msg, 'alert');
      setError(msg);
    },
    onSuccess: (saved, payload) => {
      queryClient.setQueryData(rolesKeys.dataScope(payload.roleId), saved);
      addNotification('Data Scope Saved', 'Role data scope updated successfully.', 'success');
    },
    onSettled: (_, __, payload) => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.dataScope(payload.roleId) });
      queryClient.invalidateQueries({ queryKey: rolesKeys.all });
    },
  });

  const handleSave = () => {
    setError('');
    if (!selectedRole) {
      addNotification('No Role Selected', 'Select a role before saving data scope.', 'alert');
      return;
    }
    if (!roleId) {
      addNotification('No Role Selected', 'Select a role before saving data scope.', 'alert');
      return;
    }
    if (!['all', 'branch', 'self'].includes(scope)) {
      addNotification('Invalid Scope', 'Record access scope must be All Records, Branch Only, or Self Only.', 'alert');
      return;
    }
    console.log('Saving role scope');
    console.log({ roleId, scope, actions });
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
          <p className="text-[11px] text-slate-500 mt-0.5">Controls how much data users with this role can see and act on.</p>
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

/* ===================================================================== */
/*  APPROVAL LIMITS TAB — per-role financial limits                       */
/* ===================================================================== */
const APPROVAL_MODULES = [
  { key: 'savings_deposit', label: 'Savings Deposit' },
  { key: 'savings_withdraw', label: 'Savings Withdrawal' },
  { key: 'loan_disbursement', label: 'Loan Disbursement' },
  { key: 'loan_writeoff', label: 'Loan Write-off' },
  { key: 'voucher_posting', label: 'Voucher Posting' },
  { key: 'expense_claim', label: 'Expense Claim' },
  { key: 'discount_waiver', label: 'Discount / Fee Waiver' },
];

function ApprovalLimitsTab(props: { roles: RoleRow[] }) {
  const { roles } = props;
  const { addNotification } = useCoop();
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');
  const selectedRole = roles.find((r) => r.id === roleId);
  const [limits, setLimits] = useState<Record<string, { min: string; max: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!roleId) return;
    let cancelled = false;
    fetchRoleApprovalLimits(roleId).then((rows) => {
      if (cancelled) return;
      const base = Object.fromEntries(APPROVAL_MODULES.map((m) => [m.key, { min: '', max: '' }]));
      for (const r of rows) {
        if (base[r.moduleKey]) {
          base[r.moduleKey] = {
            min: r.min == null ? '' : String(r.min),
            max: r.max == null ? '' : String(r.max),
          };
        }
      }
      setLimits(base);
    });
    return () => { cancelled = true; };
  }, [roleId]);

  const setLimit = (key: string, field: 'min' | 'max', value: string) =>
    setLimits((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const rows = APPROVAL_MODULES.map((m) => ({
        moduleKey: m.key,
        min: limits[m.key]?.min === '' ? null : Number(limits[m.key]?.min),
        max: limits[m.key]?.max === '' ? null : Number(limits[m.key]?.max),
      }));
      await updateRoleApprovalLimits(roleId, rows);
      addNotification('Approval Limits Saved', `Approval limits updated for ${selectedRole.name}.`, 'success');
    } catch (error: any) {
      addNotification('Save Failed', error?.response?.data?.error || error?.message || 'Could not save approval limits.', 'alert');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 max-w-3xl">
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
        <span className="text-[11px] text-slate-500">Amounts in NPR. Leave empty for no limit.</span>
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-800 font-bold">
              <th className="p-3 pl-4">Transaction Module</th>
              <th className="p-3 w-44">Minimum Amount (NPR)</th>
              <th className="p-3 w-44">Maximum Amount (NPR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {APPROVAL_MODULES.map((m) => (
              <tr key={m.key} className="hover:bg-slate-50">
                <td className="p-3 pl-4 font-semibold text-slate-800">{m.label}</td>
                <td className="p-3">
                  <input
                    type="number"
                    min="0"
                    value={limits[m.key]?.min ?? ''}
                    onChange={(e) => setLimit(m.key, 'min', e.target.value)}
                    placeholder="—"
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    min="0"
                    value={limits[m.key]?.max ?? ''}
                    onChange={(e) => setLimit(m.key, 'max', e.target.value)}
                    placeholder="—"
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end">
        <button
          onClick={() => void handleSave()}
          disabled={!selectedRole || saving}
          className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saving ? 'Saving…' : 'Save Approval Limits'}
        </button>
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  ROLES AUDIT HISTORY TAB                                               */
/* ===================================================================== */
function RolesAuditHistoryTab() {
  const { auditLogs } = useCoop();
  const [query, setQuery] = useState('');

  const filtered = auditLogs.filter((log) => {
    if ((log.module || '').toLowerCase() !== 'roles') return false;
    const q = (query || '').toLowerCase();
    return !q || (log.details || '').toLowerCase().includes(q) || (log.action || '').toLowerCase().includes(q) || (log.userName || '').toLowerCase().includes(q);
  });

  const exportCsv = () => {
    const header = ['Timestamp BS', 'Timestamp AD', 'User', 'Role', 'Module', 'Action', 'Details', 'IP Address'];
    const rows = filtered.map((l) => [l.timestampBS, l.timestampAD, l.userName, l.userRole, l.module, l.action, l.details, l.ipAddress]);
    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'role_audit_history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search role audit events..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <span className="text-[11px] text-slate-500 font-mono">{filtered.length} events</span>
        <button onClick={exportCsv} className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <ScrollText className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800 mb-1">No role audit events yet</p>
            <p className="text-xs text-slate-500">Role create, update, permission and status changes will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-100">
                <tr className="text-slate-800 font-bold">
                  <th className="p-3 pl-4">Timestamp (BS)</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Details</th>
                  <th className="p-3 pr-4 text-right">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="p-3 pl-4 font-mono text-[10px] text-slate-500">{l.timestampBS}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{l.userName}</div>
                      <div className="text-[10px] text-slate-500">{l.userRole}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">{l.action}</span>
                    </td>
                    <td className="p-3 text-slate-600">{l.details}</td>
                    <td className="p-3 pr-4 text-right font-mono text-[10px] text-slate-500">{l.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
