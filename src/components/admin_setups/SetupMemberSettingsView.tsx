/**
 * SetupMemberSettingsView
 * Single generic component that handles all 7 member-settings entity types.
 * entityType prop determines which entity is being managed.
 *
 * The add/edit form is rendered by the shared MasterDataFormModal so every
 * Member Setup catalog shares the same standardized structure
 * (HEADER / BASIC INFORMATION / CONFIGURATION / DISPLAY & STATUS / FOOTER).
 * member-types supplies a type-specific CONFIGURATION section (share & fees);
 * the other six catalogs use only the common fields.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, AlertTriangle, Info,
  UserRound, Users, Briefcase, GraduationCap, UserCheck, HeartHandshake, BadgeCheck,
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../../context/ToastContext';
import { AdminSetupSearchFilterBar } from '../common/AdminSetupSearchFilterBar';
import { MasterDataFormModal, type MasterDataFormConfigCtx } from './MasterDataFormModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type MemberSettingsEntityType =
  | 'member-types'
  | 'member-categories'
  | 'occupations'
  | 'education-levels'
  | 'nominee-types'
  | 'relationship-types'
  | 'member-statuses';

interface LookupEntity {
  id: string;
  code: string;
  name: string;
  nameNepali?: string | null;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  isSystem: boolean;
  usageCount: number;
  // member-types extended
  minShareUnits?: number;
  entranceFee?: string;
  shareValuePerUnit?: string;
}

interface FormState {
  code: string;
  name: string;
  nameNepali: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  minShareUnits: number;
  entranceFee: string;
  shareValuePerUnit: string;
}


interface Props {
  entityType: MemberSettingsEntityType;
}

// ---------------------------------------------------------------------------
// Entity metadata
// ---------------------------------------------------------------------------
interface EntityMeta {
  label: string;
  labelPlural: string;
  description: string;
  icon: React.ReactNode;
}

const ENTITY_META: Record<MemberSettingsEntityType, EntityMeta> = {
  'member-types': {
    label: 'Member Type',
    labelPlural: 'Member Types',
    description: 'Define membership categories with minimum share requirements and entrance fees.',
    icon: <UserRound className="w-5 h-5 text-emerald-600" />,
  },
  'member-categories': {
    label: 'Member Category',
    labelPlural: 'Member Categories',
    description: 'Group members into administrative categories for reporting and policy.',
    icon: <Users className="w-5 h-5 text-emerald-600" />,
  },
  'occupations': {
    label: 'Occupation',
    labelPlural: 'Occupations',
    description: 'Create an occupation that can be used during member registration.',
    icon: <Briefcase className="w-5 h-5 text-emerald-600" />,
  },
  'education-levels': {
    label: 'Education Level',
    labelPlural: 'Education Levels',
    description: 'Education qualification levels used in member registration.',
    icon: <GraduationCap className="w-5 h-5 text-emerald-600" />,
  },
  'nominee-types': {
    label: 'Nominee Type',
    labelPlural: 'Nominee Types',
    description: 'Categories of nominees that can be assigned to members.',
    icon: <UserCheck className="w-5 h-5 text-emerald-600" />,
  },
  'relationship-types': {
    label: 'Relationship Type',
    labelPlural: 'Relationship Types',
    description: 'Family relationship types used for nominees and family records.',
    icon: <HeartHandshake className="w-5 h-5 text-emerald-600" />,
  },
  'member-statuses': {
    label: 'Member Status',
    labelPlural: 'Member Statuses',
    description: 'Post-approval operational statuses applied to active members only.',
    icon: <BadgeCheck className="w-5 h-5 text-emerald-600" />,
  },
};

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  nameNepali: '',
  description: '',
  isActive: true,
  sortOrder: 0,
  minShareUnits: 0,
  entranceFee: '0.00',
  shareValuePerUnit: '0.00',
};


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const SetupMemberSettingsView: React.FC<Props> = ({ entityType }) => {
  const toast = useToast();
  const meta = ENTITY_META[entityType];

  const [rows, setRows] = useState<LookupEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch list
  // ---------------------------------------------------------------------------
  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (activeFilter !== 'all') params.active = activeFilter === 'active' ? 'true' : 'false';

      const res = await apiClient.get(`/member-settings/${entityType}`, { params });
      const data = Array.isArray(res.data) ? res.data : [];
      setRows(data);
      setTotal(data.length);
    } catch (err: any) {
      toast.showError(err.response?.data?.error ?? err.message, 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [entityType, searchTerm, activeFilter, toast]);

  useEffect(() => {
    setRows([]);
    setSearchTerm('');
    setActiveFilter('all');
  }, [entityType]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // ---------------------------------------------------------------------------
  // Open modal helpers
  // ---------------------------------------------------------------------------
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (row: LookupEntity) => {
    setEditingId(row.id);
    setForm({
      code: row.code,
      name: row.name,
      nameNepali: row.nameNepali ?? '',
      description: row.description ?? '',
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      minShareUnits: row.minShareUnits ?? 0,
      entranceFee: row.entranceFee ?? '0.00',
      shareValuePerUnit: row.shareValuePerUnit ?? '0.00',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
  };


  // ---------------------------------------------------------------------------
  // Form field change (transliteration for Name → Name (Nepali) is handled
  // inside MasterDataFormModal so manual Devanagari edits are never overwritten)
  // ---------------------------------------------------------------------------
  const handleFieldChange = (field: keyof FormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
    }
  };

  // ---------------------------------------------------------------------------
  // Client-side validation
  // ---------------------------------------------------------------------------
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.code.trim()) errors.code = 'Code is required';
    else if (form.code.trim().length > 20) errors.code = 'Code max 20 characters';
    if (!form.name.trim()) errors.name = 'Name is required';
    else if (form.name.trim().length > 100) errors.name = 'Name max 100 characters';
    if (!Number.isInteger(Number(form.sortOrder)) || Number(form.sortOrder) < 0) {
      errors.sortOrder = 'Sort order must be an integer ≥ 0';
    }
    if (entityType === 'member-types') {
      if (form.minShareUnits < 0) errors.minShareUnits = 'Min share units must be ≥ 0';
      if (Number(form.entranceFee) < 0) errors.entranceFee = 'Entrance fee must be ≥ 0';
      if (Number(form.shareValuePerUnit) < 0) errors.shareValuePerUnit = 'Share value must be ≥ 0';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ---------------------------------------------------------------------------
  // Save (create or update)
  // ---------------------------------------------------------------------------
  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        code: form.code.trim(),
        name: form.name.trim(),
        nameNepali: form.nameNepali.trim() || null,
        description: form.description.trim() || null,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder),
      };
      if (entityType === 'member-types') {
        payload.minShareUnits = Number(form.minShareUnits);
        payload.entranceFee = String(form.entranceFee);
        payload.shareValuePerUnit = String(form.shareValuePerUnit);
      }

      if (editingId) {
        await apiClient.put(`/member-settings/${entityType}/${editingId}`, payload);
        toast.showSuccess(`${meta.label} updated successfully.`);
      } else {
        await apiClient.post(`/member-settings/${entityType}`, payload);
        toast.showSuccess(`${meta.label} created successfully.`);
      }

      closeModal();
      fetchRows();
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Save failed';
      toast.showError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await apiClient.delete(`/member-settings/${entityType}/${id}`);
      toast.showSuccess(`${meta.label} deleted.`);
      setDeletingId(null);
      fetchRows();
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Delete failed';
      toast.showError(msg);
    } finally {
      setDeleting(false);
    }
  };


  // ---------------------------------------------------------------------------
  // Render table columns per entity type
  // ---------------------------------------------------------------------------
  const renderExtraColumns = (row: LookupEntity) => {
    if (entityType === 'member-types') {
      return (
        <>
          <td className="p-3 font-mono text-slate-700">{row.minShareUnits ?? 0}</td>
          <td className="p-3 font-mono text-emerald-700 font-semibold">
            रु. {Number(row.entranceFee ?? 0).toLocaleString()}
          </td>
          <td className="p-3 font-mono text-slate-700">
            रु. {Number(row.shareValuePerUnit ?? 0).toLocaleString()}
          </td>
        </>
      );
    }
    return null;
  };

  const renderExtraHeaders = () => {
    if (entityType === 'member-types') {
      return (
        <>
          <th className="p-3">Min Share Units</th>
          <th className="p-3">Entrance Fee</th>
          <th className="p-3">Share Value/Unit</th>
        </>
      );
    }
    return null;
  };

  // ---------------------------------------------------------------------------
  // Type-specific CONFIGURATION section (only member-types carries extras)
  // ---------------------------------------------------------------------------
  const renderConfigSection = (ctx: MasterDataFormConfigCtx) => {
    const fieldCls =
      'w-full bg-slate-50 border placeholder-slate-400 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-none focus:border-emerald-500 transition';
    const errCls = (key: string) => (ctx.errors[key] ? 'border-rose-400' : 'border-slate-200 ');
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-slate-600 font-semibold mb-1">Min Share Units</label>
          <input
            type="number"
            min={0}
            step={1}
            value={String(ctx.values.minShareUnits ?? 0)}
            onChange={(e) => ctx.onChange('minShareUnits', parseInt(e.target.value, 10) || 0)}
            className={`${fieldCls} ${errCls('minShareUnits')}`}
          />
          {ctx.errors.minShareUnits && <p className="text-rose-500 mt-1">{ctx.errors.minShareUnits}</p>}
        </div>
        <div>
          <label className="block text-slate-600 font-semibold mb-1">Entrance Fee (NPR)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={String(ctx.values.entranceFee ?? 0)}
            onChange={(e) => ctx.onChange('entranceFee', e.target.value)}
            className={`${fieldCls} ${errCls('entranceFee')}`}
          />
          {ctx.errors.entranceFee && <p className="text-rose-500 mt-1">{ctx.errors.entranceFee}</p>}
        </div>
        <div>
          <label className="block text-slate-600 font-semibold mb-1">Share Value/Unit (NPR)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={String(ctx.values.shareValuePerUnit ?? 0)}
            onChange={(e) => ctx.onChange('shareValuePerUnit', e.target.value)}
            className={`${fieldCls} ${errCls('shareValuePerUnit')}`}
          />
          {ctx.errors.shareValuePerUnit && <p className="text-rose-500 mt-1">{ctx.errors.shareValuePerUnit}</p>}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Member Status notice */}
      {entityType === 'member-statuses' && (
        <div className="flex items-start gap-3 bg-amber-50 /20 border border-amber-200 /40 rounded-xl p-4 text-xs text-amber-800">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            <strong>Note:</strong> These statuses apply only to members after activation (post-approval).
            Member status during registration (Draft → Submitted → Verified → Approved → Active)
            is assigned automatically by the workflow engine and cannot be manually set here.
          </p>
        </div>
      )}

      {/* Search / filter bar */}
      <AdminSetupSearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={`Search ${meta.labelPlural.toLowerCase()} by code or name…`}
        filterGroups={[
          {
            id: 'active',
            label: 'Status',
            value: activeFilter,
            options: [
              { label: 'All', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ],
            onChange: (v) => setActiveFilter(v as any),
          },
        ]}
        quickStats={[
          { label: meta.labelPlural, value: total, color: 'text-emerald-700 ' },
        ]}
      />

      {/* Table header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">{meta.labelPlural}</h3>
          <p className="text-slate-500 text-xs mt-0.5">{meta.description}</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add {meta.label}
        </button>
      </div>


      {/* Data table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm text-xs">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading {meta.labelPlural.toLowerCase()}…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
            <AlertTriangle className="w-8 h-8" />
            <p className="font-semibold">No {meta.labelPlural.toLowerCase()} found.</p>
            <p className="text-xs">Click "+ Add {meta.label}" to create one.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Name</th>
                <th className="p-3">Name (Nepali)</th>
                {renderExtraHeaders()}
                <th className="p-3">Sort</th>
                <th className="p-3">Status</th>
                <th className="p-3">Usage</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 /50 transition">
                  <td className="p-3 font-mono text-emerald-600 font-bold">{row.code}</td>
                  <td className="p-3 font-semibold text-slate-800">
                    {row.name}
                    {row.isSystem && (
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                        SYSTEM
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-slate-600">{row.nameNepali || '—'}</td>
                  {renderExtraColumns(row)}
                  <td className="p-3 font-mono text-slate-500">{row.sortOrder}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ row.isActive ? 'bg-emerald-100 /20 text-emerald-700 border-emerald-300 /30' : 'bg-slate-100 text-slate-500 border-slate-300 ' }`}>
                      {row.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3">
                    {row.usageCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 /20 text-sky-700 border border-sky-200 /30">
                        {row.usageCount} member{row.usageCount !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(row)}
                        className="text-emerald-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit →
                      </button>
                      <button
                        onClick={() => setDeletingId(row.id)}
                        disabled={row.usageCount > 0 || row.isSystem}
                        title={row.usageCount > 0 ? `In use by ${row.usageCount} member(s)` : row.isSystem ? 'System record' : 'Delete'}
                        className={`flex items-center gap-1 font-bold transition ${ row.usageCount > 0 || row.isSystem ? 'text-slate-600 cursor-not-allowed' : 'text-rose-500 hover:text-rose-700 cursor-pointer' }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>


      {/* ── Create / Edit Modal (standardized via MasterDataFormModal) ── */}
      <MasterDataFormModal
        open={modalOpen}
        mode={editingId ? 'edit' : 'create'}
        icon={meta.icon}
        title={editingId ? `Edit ${meta.label}` : `Add ${meta.label}`}
        description={meta.description}
        configSectionLabel="Share & Fee Requirements"
        values={form as any}
        errors={formErrors}
        onChange={(field, value) => handleFieldChange(field as keyof FormState, value)}
        onSave={handleSave}
        onClose={closeModal}
        saving={saving}
        saveLabel={editingId ? 'Save Changes' : `Create ${meta.label}`}
        renderConfig={entityType === 'member-types' ? renderConfigSection : undefined}
      />


      {/* ── Delete Confirmation Modal ── */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm">
            <div className="px-6 py-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 /20 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Confirm Delete</h3>
                  <p className="text-slate-500 text-xs mt-0.5">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                Are you sure you want to delete this {meta.label.toLowerCase()}?
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setDeletingId(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                disabled={deleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
