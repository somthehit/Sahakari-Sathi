/**
 * MasterDataFormModal
 *
 * Shared, standardized modal used by ALL Member, Share, Savings, and Loan Setup master forms.
 * Guarantees a consistent layout across catalogs:
 *
 *   HEADER            → icon + "Add/Edit {Master}" + contextual description
 *   BASIC INFORMATION → Code* (uppercase + auto-generate), Name*, Name (Nepali), Description
 *   CONFIGURATION     → optional type-specific slot
 *   DISPLAY & STATUS  → Sort Order, Active/Inactive switch
 *   FOOTER            → Cancel / Save
 */
import React, { useEffect, useRef } from 'react';
import { Loader2, ShieldCheck, Tags, Sparkles, RefreshCw } from 'lucide-react';
import { useLocalization } from '../../context/LocalizationContext';
import { transliterateToNepali } from '../../utils/transliterate';

export interface MasterDataFormConfigCtx {
  values: Record<string, any>;
  errors: Record<string, string>;
  onChange: (field: string, value: any) => void;
}

interface MasterDataFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Heading for the optional type-specific CONFIGURATION section. */
  configSectionLabel?: string;
  values: Record<string, any>;
  errors: Record<string, string>;
  onChange: (field: string, value: any) => void;
  onSave: () => void;
  onClose: () => void;
  saving?: boolean;
  /** Grey out / disable the footer Save button (e.g. dynamic pool validation). */
  disableSave?: boolean;
  saveLabel?: string;
  codePrefix?: string;
  codePlaceholder?: string;
  namePlaceholder?: string;
  nepaliNamePlaceholder?: string;
  descriptionPlaceholder?: string;
  /** Type-specific fields rendered between BASIC INFORMATION and DISPLAY & STATUS. */
  renderConfig?: (ctx: MasterDataFormConfigCtx) => React.ReactNode;
}

const inputBase =
  'w-full bg-slate-50 border placeholder-slate-400 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 transition text-xs';

const sectionHeader = (label: string) => (
  <div className="flex items-center gap-2">
    <Tags className="w-3.5 h-3.5 text-emerald-600" />
    <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wide">
      {label}
    </p>
    <div className="flex-1 h-px bg-slate-100" />
  </div>
);

export function generateCodeFromName(name: string, defaultPrefix = 'ITM'): string {
  const clean = (name || '').trim().replace(/[^a-zA-Z0-9\s]/g, '');
  if (!clean) return `${defaultPrefix}-${Math.floor(100 + Math.random() * 900)}`;

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const word = words[0].toUpperCase();
    return word.length <= 4 ? word : word.slice(0, 4);
  }
  
  // Multiple words -> Take initials or first word abbreviation
  const initials = words.map(w => w[0].toUpperCase()).join('');
  if (initials.length >= 2 && initials.length <= 5) {
    return initials;
  }
  return `${words[0].slice(0, 3).toUpperCase()}-${words[1].slice(0, 3).toUpperCase()}`;
}

export const MasterDataFormModal: React.FC<MasterDataFormModalProps> = ({
  open,
  mode,
  icon,
  title,
  description,
  configSectionLabel = 'Configuration',
  values,
  errors,
  onChange,
  onSave,
  onClose,
  saving = false,
  disableSave = false,
  saveLabel,
  codePrefix = 'CAT',
  codePlaceholder = 'e.g. IND',
  namePlaceholder = 'e.g. Individual Member',
  nepaliNamePlaceholder = 'उदा: व्यक्तिगत सदस्य',
  descriptionPlaceholder = 'Enter details or description for this record…',
  renderConfig,
}) => {
  const { settings } = useLocalization();
  const autoEnabled = settings.enableAutoTransliteration;
  const manualEdit = useRef(false);
  const manualCodeEdit = useRef(false);

  useEffect(() => {
    manualEdit.current = false;
    manualCodeEdit.current = mode === 'edit';
  }, [open, mode]);

  if (!open) return null;

  const name = String(values.name ?? '');
  const nameNepali = String(values.nameNepali ?? '');
  const descriptionLen = String(values.description ?? '').length;
  const DESCRIPTION_MAX = 500;
  const descErr = errors.description;

  const handleEnglishName = (value: string) => {
    onChange('name', value);
    
    // Auto-fill Nepali name if enabled
    if (autoEnabled && !manualEdit.current) {
      const transliterated = transliterateToNepali(value);
      if (transliterated && transliterated !== value) {
        onChange('nameNepali', transliterated);
      }
    }

    // Auto-generate code when creating if user hasn't manually typed a custom code
    if (mode === 'create' && !manualCodeEdit.current && (!values.code || values.code.length <= 10)) {
      const generated = generateCodeFromName(value, codePrefix);
      if (generated) {
        onChange('code', generated);
      }
    }
  };

  const handleNepaliName = (value: string) => {
    manualEdit.current = value.trim() !== '';
    onChange('nameNepali', value);
  };

  const handleManualCodeChange = (value: string) => {
    manualCodeEdit.current = value.trim() !== '';
    onChange('code', value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''));
  };

  const handleRegenerateCode = () => {
    const generated = generateCodeFromName(name || title, codePrefix);
    onChange('code', generated);
    manualCodeEdit.current = false;
  };

  const ctx: MasterDataFormConfigCtx = { values, errors, onChange };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* ── HEADER ── */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-slate-100">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            {icon ?? <ShieldCheck className="w-5 h-5 text-emerald-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-slate-700 transition text-lg leading-none cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>
            {description && <p className="text-slate-500 text-xs mt-1">{description}</p>}
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="px-6 py-5 space-y-5 text-xs">
          {/* BASIC INFORMATION */}
          <div className="space-y-4">
            {sectionHeader('Basic Information')}

            {/* Code with Auto Generator */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-semibold">
                  Code <span className="text-emerald-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleRegenerateCode}
                  className="text-[10px] text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
                  title="Auto-generate code from name"
                >
                  <Sparkles className="w-2.5 h-2.5 text-emerald-600" /> Auto-Generate
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={String(values.code ?? '')}
                  onChange={(e) => handleManualCodeChange(e.target.value)}
                  maxLength={20}
                  className={`${inputBase} font-mono font-bold ${errors.code ? 'border-rose-400' : 'border-slate-200'}`}
                  placeholder={codePlaceholder}
                />
              </div>
              {errors.code ? (
                <p className="text-rose-500 mt-1">{errors.code}</p>
              ) : (
                <p className="text-slate-400 mt-1 text-[10px]">
                  Unique uppercase identifier code
                </p>
              )}
            </div>

            {/* Name (English) */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Name <span className="text-emerald-600">*</span>
                {autoEnabled && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                    ✨ auto
                  </span>
                )}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleEnglishName(e.target.value)}
                maxLength={100}
                className={`${inputBase} ${errors.name ? 'border-rose-400' : 'border-slate-200'}`}
                placeholder={namePlaceholder}
              />
              {errors.name && <p className="text-rose-500 mt-1">{errors.name}</p>}
            </div>

            {/* Name (Nepali) */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Name (Nepali)
                <span className="ml-1 text-slate-400 font-normal italic">(auto-transliterated)</span>
              </label>
              <input
                type="text"
                value={nameNepali}
                onChange={(e) => handleNepaliName(e.target.value)}
                maxLength={100}
                className={`${inputBase} border-slate-200`}
                placeholder={nepaliNamePlaceholder}
              />
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-semibold">Description</label>
                <span className={`text-[10px] font-mono ${descErr ? 'text-rose-500' : 'text-slate-400'}`}>
                  {descriptionLen}/{DESCRIPTION_MAX}
                </span>
              </div>
              <textarea
                value={String(values.description ?? '')}
                onChange={(e) => onChange('description', e.target.value)}
                maxLength={DESCRIPTION_MAX}
                rows={2}
                className={`${inputBase} resize-none ${descErr ? 'border-rose-400' : 'border-slate-200'}`}
                placeholder={descriptionPlaceholder}
              />
              {descErr && <p className="text-rose-500 mt-1">{descErr}</p>}
            </div>
          </div>

          {/* CONFIGURATION (type-specific) */}
          {renderConfig && (
            <div className="space-y-4">
              {sectionHeader(configSectionLabel)}
              {renderConfig(ctx)}
            </div>
          )}

          {/* DISPLAY & STATUS */}
          <div className="space-y-4">
            {sectionHeader('Display & Status')}
            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Sort Order
                  <span className="ml-1 text-slate-400 font-normal">(smaller first)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={String(values.sortOrder ?? 0)}
                  onChange={(e) => onChange('sortOrder', parseInt(e.target.value, 10) || 0)}
                  className={`${inputBase} font-mono ${errors.sortOrder ? 'border-rose-400' : 'border-slate-200'}`}
                  placeholder="e.g. 1"
                />
                {errors.sortOrder && <p className="text-rose-500 mt-1">{errors.sortOrder}</p>}
              </div>
              <div className="flex flex-col justify-end pt-5">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => onChange('isActive', values.isActive === false)}
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${values.isActive !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${values.isActive !== false ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </div>
                  <span className="font-semibold text-slate-700">
                    {values.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || disableSave}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Saving…' : saveLabel ?? (mode === 'edit' ? 'Save Changes' : 'Create Record')}
          </button>
        </div>
      </div>
    </div>
  );
};
