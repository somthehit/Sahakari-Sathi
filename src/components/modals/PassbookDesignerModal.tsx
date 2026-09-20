import React, { useState } from 'react';
import { X, Save, Loader2, Star } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
  PassbookDesignRecord, PassbookDesignMode,
  createPassbookDesign, updatePassbookDesign,
} from '../../api/passbookDesigns';
import {
  PassbookLayoutConfig, sanitizeLayout,
  DEFAULT_PASSBOOK_LAYOUT, DEFAULT_A4_STATEMENT_LAYOUT,
} from '../../utils/passbookLayout';
import { PassbookDesignStudio } from '../passbook/PassbookDesignStudio';

const PRINT_ID = 'passbook-designer-print';

const MODE_OPTIONS: { key: PassbookDesignMode; label: string }[] = [
  { key: 'booklet', label: 'Booklet' },
  { key: 'a4', label: 'A4 statement' },
  { key: 'thermal', label: 'Thermal 80 mm' },
];

const baseFor = (mode: PassbookDesignMode): PassbookLayoutConfig =>
  mode === 'a4' ? DEFAULT_A4_STATEMENT_LAYOUT : DEFAULT_PASSBOOK_LAYOUT;

interface PassbookDesignerModalProps {
  /** Existing design to edit, or null to create a new one. */
  design?: PassbookDesignRecord | null;
  onClose: () => void;
  onSaved: (saved: PassbookDesignRecord) => void;
}

/**
 * Full-screen editor wrapping the PassbookDesignStudio for one saved layout —
 * mirrors ChequeDesignerModal. Adds a stationery (mode) selector because passbook
 * designs are typed per stationery (booklet / A4 / thermal); switching mode resets
 * the geometry to that stationery's sensible default so column X positions stay valid.
 */
export const PassbookDesignerModal: React.FC<PassbookDesignerModalProps> = ({ design, onClose, onSaved }) => {
  const toast = useToast();
  const editing = !!design?.id;

  const [code, setCode] = useState(design?.code ?? '');
  const [name, setName] = useState(design?.name ?? '');
  const [description, setDescription] = useState(design?.description ?? '');
  const [mode, setMode] = useState<PassbookDesignMode>(design?.mode ?? 'booklet');
  const [isActive, setIsActive] = useState(design?.isActive ?? true);
  const [isDefault, setIsDefault] = useState(design?.isDefault ?? false);
  const [config, setConfig] = useState<PassbookLayoutConfig>(
    () => sanitizeLayout(design?.config ?? null, baseFor(design?.mode ?? 'booklet')),
  );
  const [saving, setSaving] = useState(false);

  // Switching stationery resets geometry to that stationery's default — booklet
  // (105 mm) and A4 (210 mm) column positions are not interchangeable.
  const changeMode = (next: PassbookDesignMode) => {
    if (next === mode) return;
    setMode(next);
    setConfig({ ...baseFor(next) });
  };

  const handleSave = async () => {
    if (!code.trim()) { toast.showError('A short code is required.', 'Missing code'); return; }
    if (!name.trim()) { toast.showError('A layout name is required.', 'Missing name'); return; }
    setSaving(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || null,
        mode,
        isActive,
        isDefault,
        widthMm: config.pageWidthMm,
        heightMm: config.pageHeightMm,
        configJson: config,
      };
      const saved = editing
        ? await updatePassbookDesign(design!.id, payload)
        : await createPassbookDesign(payload);
      toast.showSuccess(`Layout "${saved.name}" ${editing ? 'updated' : 'created'}.`);
      onSaved(saved);
    } catch (err: any) {
      toast.showError(err?.response?.data?.error || err?.message || 'Failed to save the layout.', 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9500] flex items-center justify-center bg-slate-900/20 px-4 backdrop-blur-sm"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="flex h-[94vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl ring-1 ring-black/5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold text-slate-900">{editing ? 'Edit passbook layout' : 'New passbook layout'}</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">Calibrate exactly where each line and column overprints the {MODE_OPTIONS.find((m) => m.key === mode)?.label.toLowerCase()} stationery.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create layout'}
            </button>
            <button onClick={onClose} disabled={saving} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Metadata bar */}
        <div className="flex flex-wrap items-end gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <div className="w-32">
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Code</label>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="PB-STD" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[12.5px] uppercase focus:border-emerald-500 focus:outline-none" />
          </div>
          <div className="min-w-[16rem] flex-1">
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard booklet" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12.5px] focus:border-emerald-500 focus:outline-none" />
          </div>
          <div className="w-44">
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Stationery</label>
            <select value={mode} onChange={(e) => changeMode(e.target.value as PassbookDesignMode)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12.5px] focus:border-emerald-500 focus:outline-none">
              {MODE_OPTIONS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 pb-1.5 text-[12.5px] font-medium text-slate-700">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
            <Star size={13} className={isDefault ? 'fill-emerald-500 text-emerald-500' : 'text-slate-400'} /> Default
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 pb-1.5 text-[12.5px] font-medium text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Active
          </label>
        </div>

        {/* Studio */}
        <div className="flex-1 overflow-auto p-6">
          <PassbookDesignStudio config={config} onConfigChange={setConfig} mode={mode} idForPrint={PRINT_ID} />
        </div>
      </div>
    </div>
  );
};
