import React, { useState } from 'react';
import { X, FileSignature, Loader2, Save, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { ChequeDesignStudio, ChequeSample, DEFAULT_CHEQUE_SAMPLE } from '../cheque/ChequeDesignStudio';
import { ChequeDesignConfig, DEFAULT_CHEQUE_CONFIG } from '../cheque/ChequeLeafCanvas';
import {
  ChequeDesignRecord, createChequeDesign, updateChequeDesign,
} from '../../api/chequeDesigns';
import { printChequeLeaf } from '../../utils/printChequeLeaf';

interface ChequeDesignerModalProps {
  /** Existing design to edit; omit/null to create a new one. */
  design?: ChequeDesignRecord | null;
  onClose: () => void;
  onSaved: (design: ChequeDesignRecord) => void;
}

const PRINT_ID = 'cheque-designer-leaf';

/**
 * Full-screen studio modal for the consolidated cheque workspace → Design tab.
 * Owns the design metadata (code/name/default) plus the visual ChequeDesignConfig,
 * embeds the ChequeDesignStudio, and persists via POST/PUT /cheque-designs.
 */
export const ChequeDesignerModal: React.FC<ChequeDesignerModalProps> = ({ design, onClose, onSaved }) => {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState(design?.code ?? '');
  const [name, setName] = useState(design?.name ?? '');
  const [isDefault, setIsDefault] = useState(!!design?.isDefault);
  const [isActive, setIsActive] = useState(design?.isActive ?? true);

  const [config, setConfig] = useState<ChequeDesignConfig>(() => {
    const base = { ...DEFAULT_CHEQUE_CONFIG, ...(design?.config || {}) };
    // Keep the mm dimensions consistent with the structured row if the config predates them.
    if (design?.widthMm) base.widthMm = Number(design.widthMm) || base.widthMm;
    if (design?.heightMm) base.heightMm = Number(design.heightMm) || base.heightMm;
    return base;
  });
  const [sample, setSample] = useState<ChequeSample>(DEFAULT_CHEQUE_SAMPLE);

  const handleSave = async () => {
    if (!code.trim()) { toast.showError('A design code is required.', 'Missing code'); return; }
    if (!name.trim()) { toast.showError('A design name is required.', 'Missing name'); return; }

    setSaving(true);
    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        isActive,
        isDefault,
        widthMm: config.widthMm,
        heightMm: config.heightMm,
        configJson: config,
      };
      const saved = design?.id
        ? await updateChequeDesign(design.id, payload)
        : await createChequeDesign(payload);
      toast.showSuccess(`Cheque design "${saved.name}" saved.`);
      onSaved(saved);
    } catch (err: any) {
      toast.showError(
        err?.response?.data?.error ?? err?.message ?? 'Failed to save cheque design.',
        'Save failed',
      );
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9500] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-50 border border-slate-200 w-full max-w-[1400px] h-[94vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm">
                {design?.id ? 'Edit Cheque Design' : 'New Cheque Design'}
              </h2>
              <p className="text-xs text-slate-500">Design the leaf visually, then save. Books can print this exact layout.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => printChequeLeaf(PRINT_ID, config.widthMm, config.heightMm)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Print sample
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-md"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save design'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <X className="w-4 h-4" /> Close
            </button>
          </div>
        </div>

        {/* Metadata bar */}
        <div className="px-4 sm:px-5 py-3 bg-white/70 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs shrink-0">
          <div>
            <span className="text-[10px] text-slate-500 font-semibold">Design code *</span>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. STANDARD-GREEN"
              className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="sm:col-span-2">
            <span className="text-[10px] text-slate-500 font-semibold">Design name *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard cheque (emerald)"
              className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-end gap-4 pb-1">
            <label className="flex items-center gap-1.5 text-slate-600 font-semibold">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" /> Default
            </label>
            <label className="flex items-center gap-1.5 text-slate-600 font-semibold">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" /> Active
            </label>
          </div>
        </div>

        {/* Studio */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <ChequeDesignStudio
            config={config}
            onConfigChange={setConfig}
            sample={sample}
            onSampleChange={setSample}
            idForPrint={PRINT_ID}
          />
        </div>
      </div>
    </div>
  );
};
