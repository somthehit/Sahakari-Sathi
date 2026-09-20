import React from 'react';
import {
  SlidersHorizontal, RefreshCw, Palette, Building2, Image as ImageIcon, Upload, X,
  UserCheck, ScanLine, Grid3x3, Plus, Trash2, Eye, Ruler, Tag, Landmark,
} from 'lucide-react';
import {
  ChequeLeafCanvas, ChequeDesignConfig, ChequeDraggableElement, ChequeElementType,
  DEFAULT_CHEQUE_CONFIG,
} from './ChequeLeafCanvas';
import { AVAILABLE_CHEQUE_TAGS } from '../../utils/chequeTagEngine';

export interface ChequeSample {
  payeeName: string;
  amountFigures: number | string;
  dateBs: string;
  dateAd: string;
  accountNo: string;
  accountName: string;
  chequeNumber: string;
  micrCode?: string;
  branchName?: string;
}

export const DEFAULT_CHEQUE_SAMPLE: ChequeSample = {
  payeeName: 'राम बहादुर श्रेष्ठ',
  amountFigures: 5000,
  dateBs: '२०८३-०४-१५',
  dateAd: '2026-07-31',
  accountNo: '001-0100-0000123',
  accountName: 'सीता देवी',
  chequeNumber: 'CHQ-100234',
  micrCode: '977001234',
  branchName: 'कोटेश्वर शाखा',
};

const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: 'CTS-2010 (200 × 92 mm)', w: 200, h: 92 },
  { label: 'Nepali Standard (175 × 80 mm)', w: 175, h: 80 },
  { label: 'Compact (152 × 70 mm)', w: 152, h: 70 },
];

let elemSeq = 0;
const newId = () => `f_${Date.now()}_${elemSeq++}`;

const FIELD_PRESETS: { key: string; label: string; make: () => ChequeDraggableElement }[] = [
  { key: 'payee', label: 'Payee line', make: () => ({ id: newId(), type: 'tag_text', label: 'Payee', tagValue: '{payee_name}  —  {or_bearer}', x: 34, y: 30, fontSizePt: 11, color: '#0f172a' }) },
  { key: 'amount_words', label: 'Amount in words', make: () => ({ id: newId(), type: 'tag_text', label: 'Amount in words', tagValue: '{amount_words}', x: 34, y: 42, fontSizePt: 10, color: '#0f172a' }) },
  { key: 'amount_box', label: 'Amount box', make: () => ({ id: newId(), type: 'amount_box', label: 'Amount', tagValue: '{amount_figures}', x: 150, y: 40, widthMm: 44, heightMm: 11, fontSizePt: 12, bold: true }) },
  { key: 'date_boxes', label: 'Date boxes (BS)', make: () => ({ id: newId(), type: 'date_boxes', label: 'Date', tagValue: '{date_boxes_bs}', x: 150, y: 10, widthMm: 5, heightMm: 6, boxCount: 8, fontSizePt: 10, bold: true }) },
  { key: 'branch', label: 'Branch', make: () => ({ id: newId(), type: 'tag_text', label: 'Branch', tagValue: '{branch_name}', x: 24, y: 15.5, fontSizePt: 7.5, color: '#475569' }) },
  { key: 'account_no', label: 'Account number', make: () => ({ id: newId(), type: 'tag_text', label: 'A/C No.', tagValue: '{account_no}', x: 34, y: 66, fontSizePt: 9.5, bold: true }) },
  { key: 'signature', label: 'Signature block', make: () => ({ id: newId(), type: 'signature_block', label: 'Signature', x: 138, y: 62, widthMm: 56, heightMm: 18, fontSizePt: 7.5, color: '#475569' }) },
  { key: 'crossing', label: 'A/C Payee crossing', make: () => ({ id: newId(), type: 'crossing', label: 'A/C Payee', x: 8, y: 3, widthMm: 30, heightMm: 12 }) },
  { key: 'logo', label: 'Logo', make: () => ({ id: newId(), type: 'logo', label: 'Logo', x: 6, y: 5, widthMm: 16, heightMm: 16 }) },
  { key: 'label', label: 'Field label', make: () => ({ id: newId(), type: 'field_label', label: 'Label', x: 10, y: 10, fontSizePt: 9, bold: true }) },
  { key: 'custom', label: 'Custom text', make: () => ({ id: newId(), type: 'custom_text', label: 'Custom text', x: 10, y: 10, fontSizePt: 10 }) },
  { key: 'line', label: 'Line / rule', make: () => ({ id: newId(), type: 'line', label: 'Line', x: 10, y: 25, widthMm: 60, heightMm: 0.4, color: '#0f172a' }) },
  { key: 'rect', label: 'Square / box', make: () => ({ id: newId(), type: 'rect', label: 'Box', x: 10, y: 25, widthMm: 24, heightMm: 16, color: '#0f172a' }) },
];

interface ChequeDesignStudioProps {
  config: ChequeDesignConfig;
  onConfigChange: (next: ChequeDesignConfig) => void;
  sample: ChequeSample;
  onSampleChange: (next: ChequeSample) => void;
  idForPrint?: string;
}

const inputCls = 'w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 focus:outline-none focus:border-emerald-500';
const sectionCls = 'space-y-2.5 pt-3 border-t border-slate-100';

export const ChequeDesignStudio: React.FC<ChequeDesignStudioProps> = ({
  config, onConfigChange, sample, onSampleChange, idForPrint = 'cheque-leaf-print',
}) => {
  const [selectedElemId, setSelectedElemId] = React.useState<string | null>(null);
  const [addKey, setAddKey] = React.useState<string>(FIELD_PRESETS[0].key);

  const patch = (p: Partial<ChequeDesignConfig>) => onConfigChange({ ...config, ...p });

  const patchElem = (id: string, p: Partial<ChequeDraggableElement>) =>
    onConfigChange({
      ...config,
      draggableElements: config.draggableElements.map((el) => (el.id === id ? { ...el, ...p } : el)),
    });

  const removeElem = (id: string) => {
    onConfigChange({ ...config, draggableElements: config.draggableElements.filter((el) => el.id !== id) });
    if (selectedElemId === id) setSelectedElemId(null);
  };

  const addElem = () => {
    const preset = FIELD_PRESETS.find((p) => p.key === addKey);
    if (!preset) return;
    const el = preset.make();
    onConfigChange({ ...config, draggableElements: [...config.draggableElements, el] });
    setSelectedElemId(el.id);
  };

  const appendTagToSelected = (tag: string) => {
    if (!selectedElemId) return;
    const el = config.draggableElements.find((e) => e.id === selectedElemId);
    if (!el) return;
    patchElem(selectedElemId, { tagValue: `${el.tagValue ?? ''}${el.tagValue ? ' ' : ''}${tag}` });
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    key: 'logoUrl' | 'signatureUrl',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => patch({ [key]: ev.target?.result as string } as Partial<ChequeDesignConfig>);
    reader.readAsDataURL(file);
  };

  const selectedElem = config.draggableElements.find((e) => e.id === selectedElemId) || null;
  const textLikeSelected = selectedElem && ['tag_text', 'field_label', 'custom_text', 'amount_box', 'date_boxes'].includes(selectedElem.type);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs text-slate-800">
      {/* Controls */}
      <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">Cheque Leaf Layout & Style</h3>
          </div>
          <button
            type="button"
            onClick={() => onConfigChange({ ...DEFAULT_CHEQUE_CONFIG })}
            className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-medium cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Reset
          </button>
        </div>

        {/* Leaf size */}
        <div className="space-y-2">
          <label className="font-bold text-slate-800 flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5 text-emerald-600" /> Leaf Size (mm)
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {SIZE_PRESETS.map((p) => {
              const active = config.widthMm === p.w && config.heightMm === p.h;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => patch({ widthMm: p.w, heightMm: p.h })}
                  className={`px-2.5 py-1.5 rounded-lg border text-left transition cursor-pointer ${active ? 'border-emerald-600 bg-emerald-50 font-bold text-emerald-900' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Width (mm)</span>
              <input type="number" min={80} max={500} value={config.widthMm}
                onChange={(e) => patch({ widthMm: Number(e.target.value) || config.widthMm })} className={inputCls} />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Height (mm)</span>
              <input type="number" min={50} max={400} value={config.heightMm}
                onChange={(e) => patch({ heightMm: Number(e.target.value) || config.heightMm })} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Institution */}
        <div className={sectionCls}>
          <label className="font-bold text-slate-800 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-emerald-600" /> Institution
          </label>
          <div>
            <span className="text-[10px] text-slate-500 font-semibold">Name (Nepali)</span>
            <input type="text" value={config.bankNameNp} onChange={(e) => patch({ bankNameNp: e.target.value })} className={inputCls} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-semibold">Name (English)</span>
            <input type="text" value={config.bankNameEn} onChange={(e) => patch({ bankNameEn: e.target.value })} className={inputCls} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-semibold">Branch</span>
            <input type="text" value={config.branchName} onChange={(e) => patch({ branchName: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Accent colour</span>
              <input type="color" value={config.accentColor} onChange={(e) => patch({ accentColor: e.target.value })} className="w-full mt-0.5 h-9 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Background</span>
              <input type="color" value={config.bgColor} onChange={(e) => patch({ bgColor: e.target.value })} className="w-full mt-0.5 h-9 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer" />
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-800 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-emerald-600" /> Logo / Crest
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-slate-500">
              Show
              <input type="checkbox" checked={config.showLogo} onChange={(e) => patch({ showLogo: e.target.checked })} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-lg border border-slate-200 bg-white p-1 flex items-center justify-center shrink-0">
              {config.logoUrl ? <img src={config.logoUrl} alt="Logo" className="w-10 h-10 object-contain" /> : <Landmark className="w-6 h-6 text-slate-300" />}
            </div>
            <div className="flex-1 space-y-1">
              <label className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition inline-flex items-center gap-1 cursor-pointer">
                <Upload className="w-3 h-3" /> Upload logo
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'logoUrl')} className="hidden" />
              </label>
              {config.logoUrl && (
                <button type="button" onClick={() => patch({ logoUrl: '' })} className="text-[10px] text-rose-500 hover:underline flex items-center gap-0.5 ml-1">
                  <X className="w-3 h-3" /> Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Signature */}
        <div className={sectionCls}>
          <label className="font-bold text-slate-800 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Authorised Signature
          </label>
          <div>
            <span className="text-[10px] text-slate-500 font-semibold">Signatory caption</span>
            <input type="text" value={config.signatoryTitle ?? ''} onChange={(e) => patch({ signatoryTitle: e.target.value })} className={inputCls} />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-10 rounded-lg border border-slate-200 bg-white p-1 flex items-center justify-center shrink-0">
              {config.signatureUrl ? <img src={config.signatureUrl} alt="Signature" className="max-h-8 object-contain" /> : <span className="text-[9px] text-slate-400">none</span>}
            </div>
            <div className="flex-1 space-y-1">
              <label className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-100 text-slate-700 rounded-lg text-[10px] font-bold transition inline-flex items-center gap-1 cursor-pointer border border-dashed border-slate-300">
                <Upload className="w-3 h-3" /> Upload signature
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'signatureUrl')} className="hidden" />
              </label>
              {config.signatureUrl && (
                <button type="button" onClick={() => patch({ signatureUrl: '' })} className="text-[10px] text-rose-500 hover:underline flex items-center gap-0.5 ml-1">
                  <X className="w-3 h-3" /> Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MICR & crossing */}
        <div className={sectionCls}>
          <label className="font-bold text-slate-800 flex items-center gap-1.5">
            <ScanLine className="w-3.5 h-3.5 text-emerald-600" /> Clearing (MICR) & Crossing
          </label>
          <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
            <span className="font-medium text-slate-700">A/C Payee crossing</span>
            <input type="checkbox" checked={config.showAccountPayeeCrossing} onChange={(e) => patch({ showAccountPayeeCrossing: e.target.checked })} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" />
          </div>
          <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
            <span className="font-medium text-slate-700">MICR band</span>
            <input type="checkbox" checked={config.showMicrBand} onChange={(e) => patch({ showMicrBand: e.target.checked })} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" />
          </div>
          {config.showMicrBand && (
            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-slate-500 font-semibold">MICR template</span>
                <input type="text" value={config.micrTemplate} onChange={(e) => patch({ micrTemplate: e.target.value })} className={`${inputCls} font-mono`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold">MICR code</span>
                  <input type="text" value={config.micrCode ?? ''} onChange={(e) => patch({ micrCode: e.target.value })} className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold">MICR font (pt)</span>
                  <input type="number" min={7} max={18} value={config.micrFontSizePt} onChange={(e) => patch({ micrFontSizePt: Number(e.target.value) || 11 })} className={inputCls} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Snap to grid */}
        <div className={sectionCls}>
          <label className="font-bold text-slate-800 flex items-center gap-1.5">
            <Grid3x3 className="w-3.5 h-3.5 text-emerald-600" /> Alignment Grid
          </label>
          <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
            <span className="font-medium text-slate-700">Snap to grid</span>
            <input type="checkbox" checked={config.enableSnapToGrid} onChange={(e) => patch({ enableSnapToGrid: e.target.checked })} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" />
          </div>
          <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
            <span className="font-medium text-slate-700">Show grid lines</span>
            <input type="checkbox" checked={config.showGridLines} onChange={(e) => patch({ showGridLines: e.target.checked })} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-semibold">Grid step (mm)</span>
            <input type="number" min={0.5} max={10} step={0.5} value={config.gridSizeMm} onChange={(e) => patch({ gridSizeMm: Number(e.target.value) || 2.5 })} className={inputCls} />
          </div>
        </div>

        {/* Element manager */}
        <div className={sectionCls}>
          <label className="font-bold text-slate-800 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-emerald-600" /> Fields ({config.draggableElements.length})
          </label>
          <div className="flex items-center gap-2">
            <select value={addKey} onChange={(e) => setAddKey(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold">
              {FIELD_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <button type="button" onClick={addElem} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          <div className="space-y-1.5">
            {config.draggableElements.map((el) => {
              const isSel = selectedElemId === el.id;
              return (
                <div key={el.id} className={`rounded-xl border p-2 transition ${isSel ? 'border-emerald-500 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => setSelectedElemId(isSel ? null : el.id)} className="flex items-center gap-1.5 text-left cursor-pointer min-w-0">
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500 shrink-0">{el.type.replace('_', ' ')}</span>
                      <span className="font-semibold text-slate-800 truncate">{el.label}</span>
                      <span className="text-[9px] font-mono text-slate-400 shrink-0">({el.x},{el.y})</span>
                    </button>
                    <button type="button" onClick={() => removeElem(el.id)} className="text-rose-400 hover:text-rose-600 cursor-pointer shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isSel && (
                    <div className="mt-2 space-y-2 border-t border-slate-200 pt-2">
                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold">Label</span>
                        <input type="text" value={el.label} onChange={(e) => patchElem(el.id, { label: e.target.value })} className={inputCls} />
                      </div>
                      {textLikeSelected && (
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold">Content / template</span>
                          <input type="text" value={el.tagValue ?? ''} onChange={(e) => patchElem(el.id, { tagValue: e.target.value })} className={`${inputCls} font-mono`} placeholder="Type text or insert {tags}" />
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {AVAILABLE_CHEQUE_TAGS.map((t) => (
                              <button key={t.tag} type="button" onClick={() => appendTagToSelected(t.tag)} title={t.description}
                                className="px-1.5 py-0.5 rounded bg-white border border-emerald-200 text-emerald-700 text-[9px] font-mono hover:bg-emerald-100 cursor-pointer">
                                {t.tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold">Font (pt)</span>
                          <input type="number" min={5} max={28} step={0.5} value={el.fontSizePt ?? 10} onChange={(e) => patchElem(el.id, { fontSizePt: Number(e.target.value) || 10 })} className={inputCls} />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold">Colour</span>
                          <input type="color" value={el.color ?? '#0f172a'} onChange={(e) => patchElem(el.id, { color: e.target.value })} className="w-full mt-0.5 h-9 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer" />
                        </div>
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-1.5 text-[10px] text-slate-600 font-semibold">
                            <input type="checkbox" checked={!!el.bold} onChange={(e) => patchElem(el.id, { bold: e.target.checked })} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" /> Bold
                          </label>
                        </div>
                      </div>
                      {(el.type === 'amount_box' || el.type === 'signature_block' || el.type === 'logo' || el.type === 'crossing' || el.type === 'line' || el.type === 'rect' || el.type === 'date_boxes') && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-500 font-semibold">{el.type === 'date_boxes' ? 'Cell width (mm)' : 'Width (mm)'}</span>
                            <input type="number" min={0.1} step={0.1} max={config.widthMm} value={el.widthMm ?? 40} onChange={(e) => patchElem(el.id, { widthMm: Number(e.target.value) || undefined })} className={inputCls} />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 font-semibold">{el.type === 'date_boxes' ? 'Cell height (mm)' : 'Height (mm)'}</span>
                            <input type="number" min={0.1} step={0.1} max={config.heightMm} value={el.heightMm ?? 12} onChange={(e) => patchElem(el.id, { heightMm: Number(e.target.value) || undefined })} className={inputCls} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sample preview data */}
        <div className={sectionCls}>
          <label className="font-bold text-slate-800 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-emerald-600" /> Preview Sample Data
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <span className="text-[10px] text-slate-500 font-semibold">Payee name</span>
              <input type="text" value={sample.payeeName} onChange={(e) => onSampleChange({ ...sample, payeeName: e.target.value })} className={inputCls} />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Amount</span>
              <input type="number" value={sample.amountFigures} onChange={(e) => onSampleChange({ ...sample, amountFigures: e.target.value })} className={inputCls} />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Cheque no.</span>
              <input type="text" value={sample.chequeNumber} onChange={(e) => onSampleChange({ ...sample, chequeNumber: e.target.value })} className={inputCls} />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Date (BS)</span>
              <input type="text" value={sample.dateBs} onChange={(e) => onSampleChange({ ...sample, dateBs: e.target.value })} className={inputCls} />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Date (AD)</span>
              <input type="text" value={sample.dateAd} onChange={(e) => onSampleChange({ ...sample, dateAd: e.target.value })} className={inputCls} />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Account no.</span>
              <input type="text" value={sample.accountNo} onChange={(e) => onSampleChange({ ...sample, accountNo: e.target.value })} className={inputCls} />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Account name</span>
              <input type="text" value={sample.accountName} onChange={(e) => onSampleChange({ ...sample, accountName: e.target.value })} className={inputCls} />
            </div>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="lg:col-span-7 space-y-3">
        <div className="flex items-center justify-between bg-slate-100 px-4 py-2.5 rounded-2xl border border-slate-200">
          <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-emerald-600" /> Live Cheque Preview
          </span>
          <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
            {config.widthMm} × {config.heightMm} mm · drag fields to position
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <ChequeLeafCanvas
            config={config}
            ctx={sample}
            onUpdateConfig={onConfigChange}
            idForPrint={idForPrint}
          />
        </div>
        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <Grid3x3 className="w-3.5 h-3.5" /> Tip: select a field on the left to edit its text, size and colour, then drag it on the preview to place it precisely.
        </p>
      </div>
    </div>
  );
};

export type { ChequeElementType };
