/**
 * GroupsView — operational community groups (समूह) under Member Settings.
 *
 * Org-scoped CRUD against the `/groups` API. Unlike the lookup catalogs, groups
 * carry real entity detail: address, chairperson + contact person, a recurring
 * monthly meeting schedule (day of month + time), and a capacity cap.
 * RBAC is enforced on the backend; only org_admins can create/edit/delete.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, AlertTriangle, Info, Sparkles } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { AdminSetupSearchFilterBar } from '../common/AdminSetupSearchFilterBar';
import { transliterateToNepali } from '../../utils/transliterate';
import {
  fetchGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  type Group,
} from '../../api/groups';

function generateNextGroupCode(existingGroups: Group[] = []): string {
  let maxNum = 0;
  for (const g of existingGroups) {
    const match = (g.code || '').match(/GRP-?(\d+)/i) || (g.code || '').match(/G-?(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  return `GRP-${String(maxNum + 1).padStart(3, '0')}`;
}

interface FormState {
  code: string;
  name: string;
  nameNepali: string;
  address: string;
  chairpersonName: string;
  chairpersonContact: string;
  chairpersonAddress: string;
  contactPersonName: string;
  contactPersonPhone: string;
  meetingDayOfMonth: string;
  meetingTime: string;
  meetingPlace: string;
  maxMembers: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  nameNepali: '',
  address: '',
  chairpersonName: '',
  chairpersonContact: '',
  chairpersonAddress: '',
  contactPersonName: '',
  contactPersonPhone: '',
  meetingDayOfMonth: '',
  meetingTime: '',
  meetingPlace: '',
  maxMembers: '',
  isActive: true,
};

export const GroupsView: React.FC = () => {
  const toast = useToast();

  const [rows, setRows] = useState<Group[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGroups({
        search: searchTerm.trim() || undefined,
        active: activeFilter === 'all' ? undefined : activeFilter === 'active' ? 'true' : 'false',
      });
      setRows(data);
      setTotal(data.length);
    } catch (err: any) {
      toast.showError(err.response?.data?.error ?? err.message, 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, activeFilter, toast]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      code: generateNextGroupCode(rows),
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleRegenerateCode = () => {
    setForm((prev) => ({ ...prev, code: generateNextGroupCode(rows) }));
  };

  const openEdit = (row: Group) => {
    setEditingId(row.id);
    setForm({
      code: row.code,
      name: row.name,
      nameNepali: row.nameNepali ?? '',
      address: row.address ?? '',
      chairpersonName: row.chairpersonName ?? '',
      chairpersonContact: row.chairpersonContact ?? '',
      chairpersonAddress: row.chairpersonAddress ?? '',
      contactPersonName: row.contactPersonName ?? '',
      contactPersonPhone: row.contactPersonPhone ?? '',
      meetingDayOfMonth: row.meetingDayOfMonth != null ? String(row.meetingDayOfMonth) : '',
      meetingTime: row.meetingTime ?? '',
      meetingPlace: row.meetingPlace ?? '',
      maxMembers: row.maxMembers != null ? String(row.maxMembers) : '',
      isActive: row.isActive,
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

  const handleFieldChange = (field: keyof FormState, value: any) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'name' && typeof value === 'string') {
        const transliterated = transliterateToNepali(value);
        if (transliterated && transliterated !== value) {
          updated.nameNepali = transliterated;
        }
      }
      return updated;
    });
    if (formErrors[field]) {
      setFormErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.code.trim()) errors.code = 'Code is required';
    else if (form.code.trim().length > 20) errors.code = 'Code max 20 characters';
    if (!form.name.trim()) errors.name = 'Name is required';
    else if (form.name.trim().length > 100) errors.name = 'Name max 100 characters';
    if (form.meetingDayOfMonth.trim()) {
      const day = Number(form.meetingDayOfMonth);
      if (!Number.isInteger(day) || day < 1 || day > 31) errors.meetingDayOfMonth = 'Meeting day must be between 1 and 31';
    }
    if (form.maxMembers.trim()) {
      const cap = Number(form.maxMembers);
      if (!Number.isInteger(cap) || cap < 1) errors.maxMembers = 'Max members must be at least 1 (or leave empty for no cap)';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        nameNepali: form.nameNepali.trim() || null,
        address: form.address.trim() || null,
        chairpersonName: form.chairpersonName.trim() || null,
        chairpersonContact: form.chairpersonContact.trim() || null,
        chairpersonAddress: form.chairpersonAddress.trim() || null,
        contactPersonName: form.contactPersonName.trim() || null,
        contactPersonPhone: form.contactPersonPhone.trim() || null,
        meetingDayOfMonth: form.meetingDayOfMonth.trim() ? Number(form.meetingDayOfMonth) : null,
        meetingTime: form.meetingTime.trim() || null,
        meetingPlace: form.meetingPlace.trim() || null,
        maxMembers: form.maxMembers.trim() ? Number(form.maxMembers) : null,
        isActive: form.isActive,
      };

      if (editingId) {
        await updateGroup(editingId, payload);
        toast.showSuccess('Group updated successfully.');
      } else {
        await createGroup(payload);
        toast.showSuccess('Group created successfully.');
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

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteGroup(id);
      toast.showSuccess('Group deleted.');
      setDeletingId(null);
      fetchRows();
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Delete failed';
      toast.showError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const meetingLabel = (row: Group) => {
    if (row.meetingDayOfMonth == null && !row.meetingTime) return '—';
    const day = row.meetingDayOfMonth != null ? `Day ${row.meetingDayOfMonth}` : 'Day —';
    return [day, row.meetingTime].filter(Boolean).join(' · ');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-sky-50 /20 border border-sky-200 /40 rounded-xl p-4 text-xs text-sky-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          <strong>Note:</strong> Groups are operational community groups (समूह). A group can be
          assigned to members once member-to-group linkage is enabled; until then groups are managed
          standalone. Meeting schedule is recurring monthly (day of month + time).
        </p>
      </div>

      <AdminSetupSearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search groups by code or name…"
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
          { label: 'Groups', value: total, color: 'text-emerald-700 ' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Groups</h3>
          <p className="text-slate-500 text-xs mt-0.5">
            Manage community savings-and-credit groups, their leaders and meeting schedules.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Group
        </button>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm text-xs">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading groups…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
            <AlertTriangle className="w-8 h-8" />
            <p className="font-semibold">No groups found.</p>
            <p className="text-xs">Click "+ Add Group" to create one.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Name</th>
                <th className="p-3">Chairperson</th>
                <th className="p-3">Meeting</th>
                <th className="p-3">Max Members</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 /50 transition">
                  <td className="p-3 font-mono text-emerald-600 font-bold">{row.code}</td>
                  <td className="p-3 font-semibold text-slate-800">
                    {row.name}
                    {row.nameNepali && <span className="ml-2 text-slate-500 font-normal">{row.nameNepali}</span>}
                    {row.isSystem && (
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                        SYSTEM
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-slate-600">
                    {row.chairpersonName || '—'}
                    {row.chairpersonContact && (
                      <span className="block text-[10px] text-slate-500 font-mono">{row.chairpersonContact}</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-600">{meetingLabel(row)}</td>
                  <td className="p-3 font-mono text-slate-600">
                    {row.maxMembers != null ? row.maxMembers : '—'}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ row.isActive ? 'bg-emerald-100 /20 text-emerald-700 border-emerald-300 /30' : 'bg-slate-100 text-slate-500 border-slate-300 ' }`}>
                      {row.isActive ? 'Active' : 'Inactive'}
                    </span>
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
                        disabled={row.isSystem}
                        title={row.isSystem ? 'System record' : 'Delete'}
                        className={`flex items-center gap-1 font-bold transition ${ row.isSystem ? 'text-slate-600 cursor-not-allowed' : 'text-rose-500 hover:text-rose-700 cursor-pointer' }`}
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

      {/* ── Create / Edit Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">
                {editingId ? 'Edit Group' : 'Add Group'}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-500 hover:text-slate-700 transition text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-semibold">
                      Code <span className="text-emerald-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleRegenerateCode}
                      className="text-[10px] text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-0.5"
                      title="Auto-generate next sequential group code"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-emerald-600" /> Auto
                    </button>
                  </div>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => handleFieldChange('code', e.target.value.toUpperCase())}
                    maxLength={20}
                    className={`w-full bg-slate-50 border placeholder-slate-400 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 focus:outline-none focus:border-emerald-500 transition ${formErrors.code ? 'border-rose-400' : 'border-slate-200 '}`}
                    placeholder="e.g. GRP-001"
                  />
                  {formErrors.code ? (
                    <p className="text-rose-500 mt-1">{formErrors.code}</p>
                  ) : (
                    <p className="text-slate-400 mt-1 text-[10px]">Unique uppercase identifier code</p>
                  )}
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Name (Nepali)</label>
                  <input
                    type="text"
                    value={form.nameNepali}
                    onChange={(e) => handleFieldChange('nameNepali', e.target.value)}
                    maxLength={100}
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                    placeholder="उदा: श्रीमाया बचत समूह"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Group Name <span className="text-emerald-600">*</span>
                  <span className="ml-1 text-slate-400 font-normal italic">(auto-transliterated)</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  maxLength={100}
                  className={`w-full bg-slate-50 border placeholder-slate-400 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 transition ${formErrors.name ? 'border-rose-400' : 'border-slate-200 '}`}
                  placeholder="e.g. Shreemaya Saving Group"
                />
                {formErrors.name && <p className="text-rose-500 mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Operating Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  maxLength={500}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                  placeholder="e.g. Kirtipur-04, Kathmandu"
                />
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wide">
                  Chairperson Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Chairperson Name</label>
                    <input
                      type="text"
                      value={form.chairpersonName}
                      onChange={(e) => handleFieldChange('chairpersonName', e.target.value)}
                      maxLength={100}
                      className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                      placeholder="e.g. Sita Sharma"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={form.chairpersonContact}
                      onChange={(e) => handleFieldChange('chairpersonContact', e.target.value)}
                      maxLength={50}
                      className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                      placeholder="e.g. 9841234567"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Address</label>
                    <input
                      type="text"
                      value={form.chairpersonAddress}
                      onChange={(e) => handleFieldChange('chairpersonAddress', e.target.value)}
                      maxLength={500}
                      className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                      placeholder="e.g. Ward-04, Kirtipur"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wide">
                  Contact Person / Secretary
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Contact Person Name</label>
                    <input
                      type="text"
                      value={form.contactPersonName}
                      onChange={(e) => handleFieldChange('contactPersonName', e.target.value)}
                      maxLength={100}
                      className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                      placeholder="e.g. Gita Devi Thapa"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={form.contactPersonPhone}
                      onChange={(e) => handleFieldChange('contactPersonPhone', e.target.value)}
                      maxLength={50}
                      className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                      placeholder="e.g. 9851000000"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wide">
                  Meeting Schedule & Capacity
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Day of Month (1–32)</label>
                    <input
                      type="number"
                      min={1}
                      max={32}
                      step={1}
                      value={form.meetingDayOfMonth}
                      onChange={(e) => handleFieldChange('meetingDayOfMonth', e.target.value)}
                      className={`w-full bg-slate-50 border placeholder-slate-400 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-none focus:border-emerald-500 transition ${formErrors.meetingDayOfMonth ? 'border-rose-400' : 'border-slate-200 '}`}
                      placeholder="e.g. 15"
                    />
                    {formErrors.meetingDayOfMonth && <p className="text-rose-500 mt-1">{formErrors.meetingDayOfMonth}</p>}
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Meeting Time</label>
                    <input
                      type="text"
                      value={form.meetingTime}
                      onChange={(e) => handleFieldChange('meetingTime', e.target.value)}
                      maxLength={20}
                      className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                      placeholder="e.g. 11:00 AM"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Max Members</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={form.maxMembers}
                      onChange={(e) => handleFieldChange('maxMembers', e.target.value)}
                      className={`w-full bg-slate-50 border placeholder-slate-400 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-none focus:border-emerald-500 transition ${formErrors.maxMembers ? 'border-rose-400' : 'border-slate-200 '}`}
                      placeholder="e.g. 25 (empty = no cap)"
                    />
                    {formErrors.maxMembers && <p className="text-rose-500 mt-1">{formErrors.maxMembers}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Meeting Place</label>
                  <input
                    type="text"
                    value={form.meetingPlace}
                    onChange={(e) => handleFieldChange('meetingPlace', e.target.value)}
                    maxLength={500}
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                    placeholder="e.g. Community Hall, Ward 4"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-slate-100 pt-4">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => handleFieldChange('isActive', !form.isActive)}
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${form.isActive ? 'bg-emerald-500' : 'bg-slate-300 '}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <span className="font-semibold text-slate-700">
                    {form.isActive ? 'Active' : 'Inactive'}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                Are you sure you want to delete this group?
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
