/**
 * Document Template Design Studio — Main View
 * Canvas-based drag-and-drop editor for receipt, voucher, certificate, and report templates.
 *
 * Architecture:
 *   TemplateStudioView → TemplateList | StudioEditor | PreviewModal
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus, Search, Trash2, Copy, Eye, Save, Undo2, Redo2, ZoomIn, ZoomOut,
  Download, CheckCircle2, AlertCircle, Clock, X, ChevronDown, ChevronRight,
  FileText, Image as ImageIcon, Table2, Minus, QrCode, PenTool, Type,
  Grid3X3, MousePointer2, Move, RotateCcw, Lock, Unlock, Layers,
  LayoutTemplate, Settings, ChevronUp, RefreshCw, Pencil, Loader2, Upload,
} from 'lucide-react';
import { useCoop } from '../../../context/CoopContext';
import { documentTemplateApi, type DocumentTemplate, type DocumentTemplateVersion } from '../../../api/documentTemplates';
import { uploadMedia, resolveMediaUrl } from '../../../api/storage';
import type { ElementBorder } from '../../../utils/templateTokens';
import {
  PAGE_SIZES, TOKEN_REGISTRY, TABLE_DATA_SOURCES,
  getTokensForCategory, getTableDataSourcesForCategory, getSampleData,
  resolveToken, resolveTextContent, validateTemplate,
  type TemplateLayout, type TemplateElement, type TokenCategory,
  type TextStyle, type TableColumn,
} from '../../../utils/templateTokens';

// ── Helpers ────────────────────────────────────────────────────────────────

const MM_TO_PX = 3.7795; // 1mm ≈ 3.78px at 96dpi
const generateId = () => Math.random().toString(36).slice(2, 10);

const CATEGORY_LABELS: Record<TokenCategory, string> = {
  receipt: 'Receipt Templates',
  voucher: 'Voucher Templates',
  certificate: 'Certificate Templates',
  report: 'Report Templates',
  shared: 'Shared',
};

const CATEGORY_SINGULAR: Record<TokenCategory, string> = {
  receipt: 'Receipt',
  voucher: 'Voucher',
  certificate: 'Certificate',
  report: 'Report',
  shared: 'Shared',
};

const CATEGORY_ICONS: Record<TokenCategory, string> = {
  receipt: '🧾', voucher: '📋', certificate: '📜', report: '📊', shared: '🔗',
};

const SUBTYPES: Record<TokenCategory, { value: string; label: string }[]> = {
  receipt: [
    { value: 'cash_receipt', label: 'Cash Receipt' },
    { value: 'bank_deposit_receipt', label: 'Bank Deposit Receipt' },
    { value: 'share_payment_receipt', label: 'Share Payment Receipt' },
  ],
  voucher: [
    { value: 'cash_receipt_voucher', label: 'Cash Receipt Voucher' },
    { value: 'cash_payment_voucher', label: 'Cash Payment Voucher' },
    { value: 'bank_receipt_voucher', label: 'Bank Receipt Voucher' },
    { value: 'bank_payment_voucher', label: 'Bank Payment Voucher' },
    { value: 'journal_voucher', label: 'Journal Voucher' },
    { value: 'contra_voucher', label: 'Contra Voucher' },
  ],
  certificate: [
    { value: 'share_certificate', label: 'Share Certificate' },
    { value: 'membership_certificate', label: 'Membership Certificate' },
  ],
  report: [
    { value: 'balance_sheet', label: 'Balance Sheet' },
    { value: 'income_statement', label: 'Income Statement' },
    { value: 'trial_balance', label: 'Trial Balance' },
    { value: 'cash_flow', label: 'Cash Flow Statement' },
    { value: 'general_report', label: 'General Report' },
  ],
  shared: [],
};

const EMPTY_STYLE: TextStyle = { fontFamily: 'Inter', fontSize: 12, fontWeight: 'normal', fontStyle: 'normal', color: '#1e293b', textAlign: 'left', lineHeight: 1.5 };

// ── Palette Element Definitions ────────────────────────────────────────────

const PALETTE_ITEMS = [
  { type: 'text' as const, icon: Type, label: 'Text', defaults: { width: 80, height: 10, content: 'Text block' } },
  { type: 'field' as const, icon: FileText, label: 'Data Field', defaults: { width: 60, height: 8, token: '', format: '' } },
  { type: 'image' as const, icon: ImageIcon, label: 'Image', defaults: { width: 40, height: 30, source: '' } },
  { type: 'table' as const, icon: Table2, label: 'Table', defaults: { width: 170, height: 60, dataSource: '', columns: [] } },
  { type: 'line' as const, icon: Minus, label: 'Line', defaults: { width: 80, height: 0, x2: 80, y2: 0, strokeColor: '#94a3b8', strokeWidth: 0.5 } },
  { type: 'qrcode' as const, icon: QrCode, label: 'QR Code', defaults: { width: 25, height: 25, dataToken: 'org.code' } },
  { type: 'signatureLine' as const, icon: PenTool, label: 'Signature', defaults: { width: 50, height: 15, label: 'Authorized Signature' } },
];

// ── Main View ──────────────────────────────────────────────────────────────

interface Props { activeSubKey?: string; }

export const TemplateStudioView: React.FC<Props> = ({ activeSubKey }) => {
  const { addNotification } = useCoop();
  const [category, setCategory] = useState<TokenCategory>(() => {
    if (activeSubKey?.includes('receipt')) return 'receipt';
    if (activeSubKey?.includes('voucher')) return 'voucher';
    if (activeSubKey?.includes('cert')) return 'certificate';
    return 'report';
  });
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSubType, setCreateSubType] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Sync category with activeSubKey
  useEffect(() => {
    if (activeSubKey?.includes('receipt')) setCategory('receipt');
    else if (activeSubKey?.includes('voucher')) setCategory('voucher');
    else if (activeSubKey?.includes('cert')) setCategory('certificate');
    else if (activeSubKey?.includes('report')) setCategory('report');
  }, [activeSubKey]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await documentTemplateApi.list(category);
      setTemplates(data);
    } catch (err: any) {
      addNotification('Load Failed', err.message, 'alert');
    } finally {
      setLoading(false);
    }
  }, [category, addNotification]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const filtered = useMemo(() => {
    if (!search) return templates;
    const q = search.toLowerCase();
    return templates.filter(t => t.name.toLowerCase().includes(q) || t.subType?.toLowerCase().includes(q));
  }, [templates, search]);

  const handleOpenCreate = () => {
    const subtypes = SUBTYPES[category];
    setCreateName(`New ${CATEGORY_SINGULAR[category]} Template`);
    setCreateSubType(subtypes.length > 0 ? subtypes[0].value : '');
    setShowCreateDialog(true);
  };

  const handleCreateSubmit = async () => {
    try {
      const tmpl = await documentTemplateApi.create({
        category,
        subType: createSubType || undefined,
        name: createName || `New ${CATEGORY_SINGULAR[category]} Template`,
        pageSize: 'A4',
        layoutJson: { pageSize: PAGE_SIZES.A4, elements: [] },
      });
      setShowCreateDialog(false);
      setEditingTemplate(tmpl);
      addNotification('Created', 'New template created.', 'success');
    } catch (err: any) {
      addNotification('Create Failed', err.message, 'alert');
    }
  };

  const handleClone = async (t: DocumentTemplate) => {
    try {
      const cloned = await documentTemplateApi.clone(t.id, `${t.name} (Copy)`);
      setTemplates(prev => [...prev, cloned]);
      addNotification('Cloned', `"${t.name}" duplicated.`, 'success');
    } catch (err: any) {
      addNotification('Clone Failed', err.message, 'alert');
    }
  };

  const handleDelete = async (t: DocumentTemplate) => {
    if (t.isSystem) return addNotification('Cannot Delete', 'System templates cannot be deleted.', 'warning');
    if (!confirm(`Delete "${t.name}"?`)) return;
    try {
      await documentTemplateApi.delete(t.id);
      setTemplates(prev => prev.filter(x => x.id !== t.id));
      addNotification('Deleted', `"${t.name}" removed.`, 'success');
    } catch (err: any) {
      addNotification('Delete Failed', err.message, 'alert');
    }
  };

  // ── If editing, show the full-screen Studio Editor ───────────────────
  if (editingTemplate) {
    return (
      <StudioEditor
        template={editingTemplate}
        category={category}
        onBack={() => { setEditingTemplate(null); loadTemplates(); }}
      />
    );
  }

  // ── Template List View ───────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900">{CATEGORY_LABELS[category]}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Design and manage document templates for your cooperative.</p>
        </div>
        <button onClick={handleOpenCreate} className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl flex items-center gap-2 cursor-pointer shadow-xs">
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2">
        {(['receipt', 'voucher', 'certificate', 'report'] as TokenCategory[]).map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${category === cat ? 'bg-emerald-700 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Search — only show when templates exist (PRD §6.1) */}
      {templates.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…"
            className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
        </div>
      )}

      {/* Template Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600 mr-2" /> Loading…
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <LayoutTemplate className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-600">No templates yet</p>
          <p className="text-xs mt-1">Create your first {category} template to get started.</p>
          <button onClick={handleOpenCreate} className="mt-4 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer">
            <Plus className="w-3.5 h-3.5 inline mr-1" /> Create Template
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Search className="w-10 h-10 text-slate-400 mb-3" />
          <p className="text-sm font-bold text-slate-600">No templates match "{search}"</p>
          <button onClick={() => setSearch('')} className="mt-3 px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl cursor-pointer">
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <div key={t.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition group">
              {/* Thumbnail */}
              <div className="h-36 bg-slate-50 border-b border-slate-100 flex items-center justify-center relative">
                <div className="w-20 h-28 bg-white border border-slate-200 rounded shadow-sm flex items-center justify-center text-slate-400 text-xs">
                  {t.pageSize || 'A4'}
                </div>
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {t.status}
                  </span>
                </div>
                {t.isStarterTemplate && (
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Starter</span>
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="p-3">
                <h3 className="text-xs font-bold text-slate-800 truncate">{t.name}</h3>
                {t.subType && (
                  <p className="text-[10px] text-emerald-700 font-semibold mt-0.5 capitalize">{t.subType.replace(/_/g, ' ')}</p>
                )}
                <p className="text-[10px] text-slate-500 mt-0.5">v{t.version || 1} · {t.orientation || 'portrait'}</p>
                {/* Actions */}
                <div className="flex gap-1.5 mt-3">
                  <button onClick={() => setEditingTemplate(t)} className="flex-1 px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer flex items-center justify-center gap-1">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => handleClone(t)} title="Clone" className="px-2 py-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {!t.isSystem && (
                    <button onClick={() => handleDelete(t)} title="Delete" className="px-2 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create Template Dialog ─────────────────────────────────────── */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreateDialog(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">New {CATEGORY_SINGULAR[category]} Template</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Configure your {category} template before editing.</p>
              </div>
              <button onClick={() => setShowCreateDialog(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Sub-Type */}
            {SUBTYPES[category].length > 0 && (
              <div className="mb-4">
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Sub-Type *</label>
                <select value={createSubType} onChange={e => setCreateSubType(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-700 bg-white cursor-pointer">
                  {SUBTYPES[category].map(st => (
                    <option key={st.value} value={st.value}>{st.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Template Name */}
            <div className="mb-5">
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Template Name *</label>
              <input value={createName} onChange={e => setCreateName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-700"
                placeholder="e.g. Bilingual Cash Payment Voucher"
                onKeyDown={e => { if (e.key === 'Enter') handleCreateSubmit(); }} />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreateDialog(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">
                Cancel
              </button>
              <button onClick={handleCreateSubmit}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Create Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// STUDIO EDITOR — Full-screen canvas editor
// ════════════════════════════════════════════════════════════════════════════

interface StudioEditorProps {
  template: DocumentTemplate;
  category: TokenCategory;
  onBack: () => void;
}

const StudioEditor: React.FC<StudioEditorProps> = ({ template, category, onBack }) => {
  const { addNotification } = useCoop();

  // ── State ────────────────────────────────────────────────────────────
  const [layout, setLayout] = useState<TemplateLayout>(
    (template.layoutJson as TemplateLayout) || { pageSize: PAGE_SIZES.A4, elements: [] }
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [gridSnap, setGridSnap] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ past: TemplateLayout[]; future: TemplateLayout[] }>({ past: [], future: [] });
  const [showPreview, setShowPreview] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<DocumentTemplateVersion[]>([]);
  const [publishNotes, setPublishNotes] = useState('');
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [dragOverCanvas, setDragOverCanvas] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const pageWidthPx = (layout.pageSize?.width || 210) * MM_TO_PX * zoom;
  const pageHeightPx = (layout.pageSize?.height || 297) * MM_TO_PX * zoom;

  const selectedElement = useMemo(
    () => layout.elements.find(el => el.id === selectedId) ?? null,
    [layout.elements, selectedId]
  );

  const availableTokens = useMemo(() => getTokensForCategory(category), [category]);

  // ── History (undo/redo) ──────────────────────────────────────────────
  const pushHistory = useCallback((prev: TemplateLayout) => {
    setHistory(h => ({ past: [...h.past.slice(-50), prev], future: [] }));
  }, []);

  const undo = useCallback(() => {
    setHistory(h => {
      if (h.past.length === 0) return h;
      const prev = h.past[h.past.length - 1];
      setLayout(l => {
        setHistory(hh => ({ past: hh.past.slice(0, -1), future: [...hh.future, l] }));
        return prev;
      });
      return h;
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(h => {
      if (h.future.length === 0) return h;
      const next = h.future[h.future.length - 1];
      setLayout(l => {
        setHistory(hh => ({ past: [...hh.past, l], future: hh.future.slice(0, -1) }));
        return next;
      });
      return h;
    });
  }, []);

  // ── Autosave ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(async () => {
      try {
        await documentTemplateApi.update(template.id, { layoutJson: layout });
        setIsDirty(false);
      } catch { /* silent */ }
    }, 30_000);
    return () => clearTimeout(timer);
  }, [layout, isDirty, template.id]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          deleteElement(selectedId);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, undo, redo]);

  // ── Element CRUD ─────────────────────────────────────────────────────
  const addElement = useCallback((type: TemplateElement['type'], defaults: Partial<TemplateElement>, dropX?: number, dropY?: number) => {
    const el: TemplateElement = {
      id: generateId(),
      type,
      x: dropX ?? 20,
      y: dropY ?? 20,
      style: { ...EMPTY_STYLE },
      ...defaults,
    } as TemplateElement;
    pushHistory(layout);
    setLayout(l => ({ ...l, elements: [...l.elements, el] }));
    setSelectedId(el.id);
    setIsDirty(true);
  }, [layout, pushHistory]);

  const updateElement = useCallback((id: string, patch: Partial<TemplateElement>) => {
    setLayout(l => ({
      ...l,
      elements: l.elements.map(el => el.id === id ? { ...el, ...patch } : el),
    }));
    setIsDirty(true);
  }, []);

  const deleteElement = useCallback((id: string) => {
    pushHistory(layout);
    setLayout(l => ({ ...l, elements: l.elements.filter(el => el.id !== id) }));
    setSelectedId(prev => prev === id ? null : prev);
    setIsDirty(true);
  }, [layout, pushHistory]);

  const moveElementOrder = useCallback((id: string, direction: 'up' | 'down') => {
    setLayout(l => {
      const idx = l.elements.findIndex(el => el.id === id);
      if (idx < 0) return l;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= l.elements.length) return l;
      const els = [...l.elements];
      [els[idx], els[newIdx]] = [els[newIdx], els[idx]];
      return { ...l, elements: els };
    });
    setIsDirty(true);
  }, []);

  // ── Drag from Palette ────────────────────────────────────────────────
  const handlePaletteDragStart = (e: React.DragEvent, type: string, defaults: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type, defaults }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCanvas(false);
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    try {
      const { type, defaults } = JSON.parse(data);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.round(((e.clientX - rect.left) / zoom) / 5) * 5;
      const y = Math.round(((e.clientY - rect.top) / zoom) / 5) * 5;
      addElement(type, defaults, x, y);
    } catch { /* ignore */ }
  };

  // ── Save / Publish ───────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await documentTemplateApi.update(template.id, { layoutJson: layout });
      setIsDirty(false);
      addNotification('Saved', 'Template draft saved.', 'success');
    } catch (err: any) {
      addNotification('Save Failed', err.message, 'alert');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const validation = validateTemplate(layout, category);
    if (!validation.valid) {
      addNotification('Validation Error', validation.errors[0], 'alert');
      return;
    }
    try {
      await documentTemplateApi.update(template.id, { layoutJson: layout });
      await documentTemplateApi.publish(template.id, publishNotes || undefined);
      setIsDirty(false);
      setShowPublishDialog(false);
      addNotification('Published', 'Template is now live.', 'success');
    } catch (err: any) {
      addNotification('Publish Failed', err.message, 'alert');
    }
  };

  const handleUnpublish = async () => {
    try {
      await documentTemplateApi.unpublish(template.id);
      addNotification('Unpublished', 'Template reverted to draft.', 'success');
    } catch (err: any) {
      addNotification('Unpublish Failed', err.message, 'alert');
    }
  };

  const loadVersions = async () => {
    try {
      const v = await documentTemplateApi.listVersions(template.id);
      setVersions(v);
      setShowVersions(true);
    } catch (err: any) {
      addNotification('Load Failed', err.message, 'alert');
    }
  };

  const handleRestore = async (versionId: string) => {
    try {
      const result = await documentTemplateApi.restoreVersion(template.id, versionId);
      setLayout(result.template.layoutJson as TemplateLayout);
      setShowVersions(false);
      addNotification('Restored', 'Template restored to selected version.', 'success');
    } catch (err: any) {
      addNotification('Restore Failed', err.message, 'alert');
    }
  };

  // ── Page Size Change ─────────────────────────────────────────────────
  const handlePageSizeChange = (size: string) => {
    const dims = PAGE_SIZES[size];
    if (dims) {
      pushHistory(layout);
      setLayout(l => ({ ...l, pageSize: { width: dims.width, height: dims.height } }));
      setIsDirty(true);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-100">
      {/* Top Toolbar */}
      <div className="h-12 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0">
        <button onClick={onBack} className="text-xs font-bold text-slate-600 hover:text-emerald-700 cursor-pointer">← Back</button>
        <div className="h-5 w-px bg-slate-200" />
        <span className="text-xs font-extrabold text-slate-800 truncate max-w-48">{template.name}</span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          {CATEGORY_SINGULAR[category]}{template.subType ? ` — ${template.subType.replace(/_/g, ' ')}` : ''}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${template.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
          {template.status}
        </span>
        <div className="flex-1" />
        {/* Undo/Redo */}
        <button onClick={undo} disabled={history.past.length === 0} title="Undo (Ctrl+Z)"
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 cursor-pointer"><Undo2 className="w-4 h-4" /></button>
        <button onClick={redo} disabled={history.future.length === 0} title="Redo (Ctrl+Y)"
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 cursor-pointer"><Redo2 className="w-4 h-4" /></button>
        <div className="h-5 w-px bg-slate-200" />
        {/* Zoom */}
        <button onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><ZoomOut className="w-4 h-4" /></button>
        <span className="text-[11px] font-mono text-slate-600 w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><ZoomIn className="w-4 h-4" /></button>
        <div className="h-5 w-px bg-slate-200" />
        {/* Grid Snap */}
        <button onClick={() => setGridSnap(g => !g)} title="Snap to grid"
          className={`p-1.5 rounded-lg cursor-pointer ${gridSnap ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-slate-100'}`}>
          <Grid3X3 className="w-4 h-4" />
        </button>
        {/* Page Size */}
        <select value={Object.keys(PAGE_SIZES).find(k => PAGE_SIZES[k].width === layout.pageSize?.width && PAGE_SIZES[k].height === layout.pageSize?.height) || 'custom'}
          onChange={e => handlePageSizeChange(e.target.value)}
          className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 bg-white cursor-pointer">
          {Object.keys(PAGE_SIZES).map(k => <option key={k} value={k}>{k}</option>)}
          <option value="custom">Custom</option>
        </select>
        <div className="h-5 w-px bg-slate-200" />
        {/* Actions */}
        <button onClick={loadVersions} className="px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" /> Versions
        </button>
        <button onClick={() => setShowPreview(true)} className="px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer flex items-center gap-1">
          <Eye className="w-3.5 h-3.5" /> Preview
        </button>
        <button onClick={handleSave} disabled={!isDirty || saving}
          className="px-3 py-1.5 text-[11px] font-bold text-white bg-slate-700 hover:bg-slate-800 rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
        </button>
        {template.status === 'published' ? (
          <button onClick={handleUnpublish} className="px-3 py-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg cursor-pointer">
            Unpublish
          </button>
        ) : (
          <button onClick={() => setShowPublishDialog(true)} className="px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1 cursor-pointer">
            <CheckCircle2 className="w-3.5 h-3.5" /> Publish
          </button>
        )}
      </div>

      {/* Main Layout: Palette + Canvas + Properties */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Palette */}
        <div className="w-52 bg-white border-r border-slate-200 overflow-y-auto shrink-0 p-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Elements</p>
          <div className="space-y-1.5">
            {PALETTE_ITEMS.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.type} draggable onDragStart={e => handlePaletteDragStart(e, item.type, item.defaults)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 cursor-grab text-xs font-medium text-slate-700 transition">
                  <Icon className="w-4 h-4 text-slate-500" /> {item.label}
                </div>
              );
            })}
          </div>

          {/* Available Tokens */}
          <div className="mt-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Data Tokens</p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {availableTokens.filter(t => t.dataType !== 'image').map(t => (
                <div key={t.token} className="text-[10px] text-slate-600 px-2 py-1 rounded hover:bg-slate-50 font-mono truncate" title={t.label}>
                  {`{{${t.token}}}`}
                </div>
              ))}
            </div>
          </div>

          {/* Element Layers */}
          <div className="mt-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Layers ({layout.elements.length})</p>
            <div className="space-y-0.5">
              {[...layout.elements].reverse().map(el => (
                <div key={el.id}
                  onClick={() => setSelectedId(el.id)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] cursor-pointer transition ${selectedId === el.id ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <span className="truncate flex-1">{el.type === 'field' ? el.token || 'field' : el.type === 'text' ? (el.content || 'text').slice(0, 20) : el.type}</span>
                  <button onClick={e => { e.stopPropagation(); moveElementOrder(el.id, 'up'); }} className="opacity-50 hover:opacity-100"><ChevronUp className="w-3 h-3" /></button>
                  <button onClick={e => { e.stopPropagation(); moveElementOrder(el.id, 'down'); }} className="opacity-50 hover:opacity-100"><ChevronDown className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto p-8 flex justify-center"
          onClick={() => setSelectedId(null)}>
          <div ref={canvasRef}
            className={`relative bg-white shadow-lg border border-slate-300 ${dragOverCanvas ? 'ring-2 ring-emerald-400' : ''}`}
            style={{ width: pageWidthPx, height: pageHeightPx }}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOverCanvas(true); }}
            onDragLeave={() => setDragOverCanvas(false)}
            onDrop={handleCanvasDrop}
            onClick={e => e.stopPropagation()}>
            {/* Grid lines */}
            <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
              {gridSnap && Array.from({ length: Math.ceil(pageWidthPx / (5 * MM_TO_PX * zoom)) }).map((_, i) => (
                <line key={`v${i}`} x1={i * 5 * MM_TO_PX * zoom} y1={0} x2={i * 5 * MM_TO_PX * zoom} y2={pageHeightPx} stroke="#f1f5f9" strokeWidth={0.5} />
              ))}
              {gridSnap && Array.from({ length: Math.ceil(pageHeightPx / (5 * MM_TO_PX * zoom)) }).map((_, i) => (
                <line key={`h${i}`} x1={0} y1={i * 5 * MM_TO_PX * zoom} x2={pageWidthPx} y2={i * 5 * MM_TO_PX * zoom} stroke="#f1f5f9" strokeWidth={0.5} />
              ))}
            </svg>
            {/* Elements */}
            {layout.elements.map(el => (
              <CanvasElement key={el.id} element={el} zoom={zoom} isSelected={selectedId === el.id}
                onSelect={e => { e.stopPropagation(); setSelectedId(el.id); }}
                onMove={(x, y) => {
                  const nx = gridSnap ? Math.round(x / 5) * 5 : x;
                  const ny = gridSnap ? Math.round(y / 5) * 5 : y;
                  updateElement(el.id, { x: nx, y: ny });
                }}
                onResize={(w, h) => updateElement(el.id, { width: w, height: h })}
              />
            ))}
          </div>
        </div>

        {/* Right Properties Panel */}
        <div className="w-72 bg-white border-l border-slate-200 overflow-y-auto shrink-0 p-4">
          {selectedElement ? (
            <PropertiesPanel element={selectedElement} tokens={availableTokens} category={category}
              onChange={patch => updateElement(selectedElement.id, patch)}
              onDelete={() => deleteElement(selectedElement.id)} />
          ) : (
            <div className="text-center py-12 text-slate-500">
              <MousePointer2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-xs font-bold text-slate-600">No element selected</p>
              <p className="text-[10px] mt-1">Click an element on the canvas to edit its properties.</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <PreviewModal layout={layout} category={category} onClose={() => setShowPreview(false)} />
      )}

      {/* Version History Modal */}
      {showVersions && (
        <VersionHistoryModal versions={versions} onRestore={handleRestore} onClose={() => setShowVersions(false)} />
      )}

      {/* Publish Dialog */}
      {showPublishDialog && (
        <div className="fixed inset-0 z-[60] bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-sm font-extrabold text-slate-900 mb-2">Publish Template</h3>
            <p className="text-xs text-slate-500 mb-4">This will make the template live for document generation.</p>
            <textarea value={publishNotes} onChange={e => setPublishNotes(e.target.value)}
              placeholder="Change notes (optional)" rows={3}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700 mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPublishDialog(false)} className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer">Cancel</button>
              <button onClick={handlePublish} className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// CANVAS ELEMENT — Individual draggable element on the canvas
// ════════════════════════════════════════════════════════════════════════════

interface CanvasElementProps {
  element: TemplateElement;
  zoom: number;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
}

const CanvasElement: React.FC<CanvasElementProps> = ({ element: el, zoom, isSelected, onSelect, onMove, onResize }) => {
  const elRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, elX: 0, elY: 0 });

  const style: React.CSSProperties = {
    position: 'absolute',
    left: el.x * MM_TO_PX * zoom,
    top: el.y * MM_TO_PX * zoom,
    width: (el.width || 40) * MM_TO_PX * zoom,
    minHeight: el.type === 'line' ? 2 : (el.height || 10) * MM_TO_PX * zoom,
    fontFamily: el.style?.fontFamily || 'Inter',
    fontSize: (el.style?.fontSize || 12) * zoom,
    fontWeight: el.style?.fontWeight || 'normal',
    fontStyle: el.style?.fontStyle || 'normal',
    color: el.style?.color || '#1e293b',
    textAlign: el.style?.textAlign || 'left',
    lineHeight: el.style?.lineHeight || 1.5,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: isSelected ? 20 : 10,
    borderWidth: el.border?.width,
    borderColor: el.border?.color,
    borderStyle: el.border?.style || 'none',
    borderRadius: el.border?.radius,
  };

  // Drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(e);
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, elX: el.x, elY: el.y };

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - dragStart.current.x) / (MM_TO_PX * zoom);
      const dy = (ev.clientY - dragStart.current.y) / (MM_TO_PX * zoom);
      onMove(dragStart.current.elX + dx, dragStart.current.elY + dy);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Resize handle
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = el.width || 40;
    const startH = el.height || 10;

    const handleMouseMove = (ev: MouseEvent) => {
      const dw = (ev.clientX - startX) / (MM_TO_PX * zoom);
      const dh = (ev.clientY - startY) / (MM_TO_PX * zoom);
      onResize(Math.max(10, startW + dw), Math.max(5, startH + dh));
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Render content based on type
  const renderContent = () => {
    switch (el.type) {
      case 'text':
        return <div className="whitespace-pre-wrap break-words">{el.content || 'Text'}</div>;
      case 'field':
        return <div className="font-mono text-emerald-700 bg-emerald-50 px-1 rounded">{el.token ? `{{${el.token}}}` : '{field}'}</div>;
      case 'image':
        return el.source ? <img src={el.source} className="w-full h-full object-contain" alt="" /> : <div className="flex items-center justify-center h-full text-slate-400"><ImageIcon className="w-6 h-6" /></div>;
      case 'table':
        return (
          <div className="border border-slate-300 rounded text-[8px]">
            <div className="bg-slate-100 px-1 py-0.5 font-bold border-b border-slate-300">
              {(el.columns || []).map((c, i) => <span key={i} className="mr-2">{c.label || c.token}</span>)}
            </div>
            <div className="px-1 py-0.5 text-slate-500">[Table: {el.dataSource || 'no source'}]</div>
          </div>
        );
      case 'line':
        return <div style={{ width: '100%', height: (el.strokeWidth || 0.5) * zoom, backgroundColor: el.strokeColor || '#94a3b8' }} />;
      case 'qrcode':
        return <div className="w-full h-full border border-slate-300 flex items-center justify-center text-[8px] text-slate-500">QR: {el.dataToken || '?'}</div>;
      case 'signatureLine':
        return (
          <div className="flex flex-col items-center justify-end h-full">
            <div className="w-full border-b border-slate-400 mb-1" />
            <span className="text-[8px] text-slate-500">{el.label || 'Signature'}</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div ref={elRef} style={style}
      onMouseDown={handleMouseDown}
      className={`group ${isSelected ? 'ring-2 ring-emerald-500 ring-offset-1' : 'hover:ring-1 hover:ring-slate-300 hover:ring-offset-1'}`}>
      {renderContent()}
      {/* Resize handle */}
      {isSelected && (
        <div onMouseDown={handleResizeMouseDown}
          className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-sm cursor-se-resize border border-white shadow-sm" />
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// PROPERTIES PANEL — Right sidebar for editing selected element
// ════════════════════════════════════════════════════════════════════════════

interface PropertiesPanelProps {
  element: TemplateElement;
  tokens: ReturnType<typeof getTokensForCategory>;
  category: TokenCategory;
  onChange: (patch: Partial<TemplateElement>) => void;
  onDelete: () => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ element: el, tokens, category, onChange, onDelete }) => {
  const updateStyle = (patch: Partial<TextStyle>) => {
    onChange({ style: { ...el.style, ...patch } });
  };

  const dataSources = getTableDataSourcesForCategory(category);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-slate-900 uppercase">{el.type}</h3>
        <button onClick={onDelete} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>

      {/* Position */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Position (mm)</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-slate-600">X
            <input type="number" value={el.x} onChange={e => onChange({ x: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] mt-0.5" />
          </label>
          <label className="text-[10px] text-slate-600">Y
            <input type="number" value={el.y} onChange={e => onChange({ y: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] mt-0.5" />
          </label>
        </div>
      </div>

      {/* Size */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Size (mm)</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-slate-600">Width
            <input type="number" value={el.width || 0} onChange={e => onChange({ width: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] mt-0.5" />
          </label>
          <label className="text-[10px] text-slate-600">Height
            <input type="number" value={el.height || 0} onChange={e => onChange({ height: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] mt-0.5" />
          </label>
        </div>
      </div>

      {/* Type-specific: Text */}
      {el.type === 'text' && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Content</p>
          <textarea value={el.content || ''} onChange={e => onChange({ content: e.target.value })} rows={3}
            className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] resize-none" />
          <p className="text-[9px] text-slate-400 mt-0.5">Use {'{{token.name}}'} for dynamic values</p>
        </div>
      )}

      {/* Type-specific: Field */}
      {el.type === 'field' && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Data Token</p>
          <select value={el.token || ''} onChange={e => onChange({ token: e.target.value })}
            className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] bg-white">
            <option value="">Select token…</option>
            {tokens.map(t => <option key={t.token} value={t.token}>{t.label} ({`{{${t.token}}}`})</option>)}
          </select>
          <p className="text-[10px] font-bold text-slate-500 uppercase mt-2 mb-1">Format</p>
          <select value={el.format || ''} onChange={e => onChange({ format: e.target.value })}
            className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] bg-white">
            <option value="">Default</option>
            <option value="words">Nepali Words</option>
            <option value="both">Digits + Words</option>
            <option value="digits">Digits Only</option>
          </select>
          <label className="flex items-center gap-2 mt-2 text-[11px] text-slate-600 cursor-pointer">
            <input type="checkbox" checked={!!el.style?.devanagariDigits}
              onChange={e => updateStyle({ devanagariDigits: e.target.checked })}
              className="w-3.5 h-3.5 accent-emerald-700" />
            Devanagari Numerals
          </label>
        </div>
      )}

      {/* Type-specific: Table */}
      {el.type === 'table' && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Data Source</p>
          <select value={el.dataSource || ''} onChange={e => {
            const ds = dataSources.find(d => d.key === e.target.value);
            onChange({ dataSource: e.target.value, columns: ds?.columns.map(c => ({ token: c.token, label: c.label, align: 'left' as const })) || [] });
          }} className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] bg-white">
            <option value="">Select data source…</option>
            {dataSources.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
          {el.columns && el.columns.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Columns</p>
              {el.columns.map((col, i) => (
                <div key={i} className="flex gap-1 items-center">
                  <span className="text-[10px] text-slate-600 flex-1 truncate">{col.label}</span>
                  <select value={col.align || 'left'} onChange={e => {
                    const cols = [...el.columns!];
                    cols[i] = { ...cols[i], align: e.target.value as any };
                    onChange({ columns: cols });
                  }} className="text-[10px] border border-slate-200 rounded px-1 py-0.5">
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Type-specific: Image */}
      {el.type === 'image' && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Image Source</p>
          <input value={el.source || ''} onChange={e => onChange({ source: e.target.value })}
            placeholder="URL or {{org.logo}}" className="w-full border border-slate-200 rounded px-2 py-1 text-[11px]" />
          <div className="mt-1.5">
            <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer transition">
              <Upload className="w-3 h-3" /> Upload Image
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async () => {
                  try {
                    const dataUrl = reader.result as string;
                    const result = await uploadMedia('document' as any, dataUrl, { fileName: file.name });
                    onChange({ source: result.url || result.storagePath });
                  } catch (err: any) {
                    alert('Upload failed: ' + err.message);
                  }
                };
                reader.readAsDataURL(file);
              }} />
            </label>
          </div>
          {el.source && (
            <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center h-20">
              <img src={resolveMediaUrl(el.source) || el.source} alt="" className="max-h-full max-w-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
        </div>
      )}

      {/* Type-specific: QR Code */}
      {el.type === 'qrcode' && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Data Token</p>
          <select value={el.dataToken || ''} onChange={e => onChange({ dataToken: e.target.value })}
            className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] bg-white">
            <option value="">Select token…</option>
            {tokens.filter(t => t.dataType !== 'image').map(t => <option key={t.token} value={t.token}>{t.label}</option>)}
          </select>
        </div>
      )}

      {/* Type-specific: Signature */}
      {el.type === 'signatureLine' && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Label</p>
          <input value={el.label || ''} onChange={e => onChange({ label: e.target.value })}
            className="w-full border border-slate-200 rounded px-2 py-1 text-[11px]" />
        </div>
      )}

      {/* Type-specific: Line */}
      {el.type === 'line' && (
        <>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Stroke Color</p>
            <div className="flex items-center gap-2">
              <input type="color" value={el.strokeColor || '#94a3b8'} onChange={e => onChange({ strokeColor: e.target.value })}
                className="w-8 h-7 border border-slate-200 rounded cursor-pointer" />
              <input value={el.strokeColor || '#94a3b8'} onChange={e => onChange({ strokeColor: e.target.value })}
                className="flex-1 border border-slate-200 rounded px-2 py-1 text-[11px] font-mono" />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Stroke Width</p>
            <input type="number" step={0.1} min={0.1} value={el.strokeWidth || 0.5} onChange={e => onChange({ strokeWidth: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded px-2 py-1 text-[11px]" />
          </div>
        </>
      )}

      {/* Conditional Visibility */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Conditional Visibility</p>
        <div className="grid grid-cols-3 gap-1">
          <select value={el.condition?.token || ''} onChange={e => {
            if (e.target.value) onChange({ condition: { token: e.target.value, operator: '==', value: '', ...el.condition } });
            else onChange({ condition: undefined });
          }} className="col-span-3 text-[10px] border border-slate-200 rounded px-1 py-1 bg-white">
            <option value="">Always visible</option>
            {tokens.filter(t => t.dataType !== 'image').map(t => <option key={t.token} value={t.token}>{t.label}</option>)}
          </select>
          {el.condition && (
            <>
              <select value={el.condition.operator} onChange={e => onChange({ condition: { ...el.condition!, operator: e.target.value as any } })}
                className="text-[10px] border border-slate-200 rounded px-1 py-1 bg-white">
                <option value="==">==</option>
                <option value="!=">!=</option>
                <option value=">">{'>'}</option>
                <option value="<">{'<'}</option>
                <option value="contains">contains</option>
              </select>
              <input value={el.condition.value} onChange={e => onChange({ condition: { ...el.condition!, value: e.target.value } })}
                placeholder="value" className="col-span-2 text-[10px] border border-slate-200 rounded px-1 py-1" />
            </>
          )}
        </div>
      </div>

      {/* Style Controls */}
      {(el.type === 'text' || el.type === 'field' || el.type === 'table') && (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Typography</p>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] text-slate-600">Font
                <select value={el.style?.fontFamily || 'Inter'} onChange={e => updateStyle({ fontFamily: e.target.value })}
                  className="w-full border border-slate-200 rounded px-1 py-0.5 text-[10px] bg-white mt-0.5">
                  {['Inter', 'Noto Sans', 'Mukta', 'Kalimatti', 'serif', 'monospace'].map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="text-[10px] text-slate-600">Size
                <input type="number" min={6} max={72} value={el.style?.fontSize || 12} onChange={e => updateStyle({ fontSize: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded px-1 py-0.5 text-[10px] mt-0.5" />
              </label>
            </div>
            <div className="flex gap-1">
              <button onClick={() => updateStyle({ fontWeight: el.style?.fontWeight === 'bold' ? 'normal' : 'bold' })}
                className={`px-2 py-1 text-[10px] rounded border cursor-pointer ${el.style?.fontWeight === 'bold' ? 'bg-slate-200 font-bold' : 'border-slate-200'}`}>B</button>
              <button onClick={() => updateStyle({ fontStyle: el.style?.fontStyle === 'italic' ? 'normal' : 'italic' })}
                className={`px-2 py-1 text-[10px] rounded border cursor-pointer italic ${el.style?.fontStyle === 'italic' ? 'bg-slate-200' : 'border-slate-200'}`}>I</button>
              <button onClick={() => updateStyle({ textAlign: 'left' })} className={`px-2 py-1 text-[10px] rounded border cursor-pointer ${el.style?.textAlign === 'left' ? 'bg-slate-200' : 'border-slate-200'}`}>L</button>
              <button onClick={() => updateStyle({ textAlign: 'center' })} className={`px-2 py-1 text-[10px] rounded border cursor-pointer ${el.style?.textAlign === 'center' ? 'bg-slate-200' : 'border-slate-200'}`}>C</button>
              <button onClick={() => updateStyle({ textAlign: 'right' })} className={`px-2 py-1 text-[10px] rounded border cursor-pointer ${el.style?.textAlign === 'right' ? 'bg-slate-200' : 'border-slate-200'}`}>R</button>
            </div>
            <div>
              <label className="text-[10px] text-slate-600">Color
                <div className="flex items-center gap-2 mt-0.5">
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(el.style?.color || '') ? el.style!.color! : '#1e293b'}
                    onChange={e => updateStyle({ color: e.target.value })} className="w-8 h-6 border border-slate-200 rounded cursor-pointer" />
                  <input value={el.style?.color || '#1e293b'} onChange={e => updateStyle({ color: e.target.value })}
                    className="flex-1 border border-slate-200 rounded px-1 py-0.5 text-[10px] font-mono" />
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ── Border ────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Border</p>
        <div className="grid grid-cols-4 gap-1.5">
          <label className="text-[10px] text-slate-600 col-span-2">Style
            <select value={el.border?.style || 'none'}
              onChange={e => onChange({ border: { ...el.border, style: e.target.value as ElementBorder['style'] } })}
              className="w-full border border-slate-200 rounded px-1 py-0.5 text-[10px] bg-white">
              <option value="none">None</option>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </label>
          <label className="text-[10px] text-slate-600">Width
            <input type="number" min={0} max={10} value={el.border?.width || 0}
              onChange={e => onChange({ border: { ...el.border, width: Number(e.target.value) } })}
              className="w-full border border-slate-200 rounded px-1 py-0.5 text-[10px]" />
          </label>
          <label className="text-[10px] text-slate-600">Radius
            <input type="number" min={0} max={50} value={el.border?.radius || 0}
              onChange={e => onChange({ border: { ...el.border, radius: Number(e.target.value) } })}
              className="w-full border border-slate-200 rounded px-1 py-0.5 text-[10px]" />
          </label>
        </div>
        {(el.border?.style || 'none') !== 'none' && (
          <div className="mt-1.5">
            <label className="text-[10px] text-slate-600">Color
              <div className="flex items-center gap-2 mt-0.5">
                <input type="color" value={el.border?.color || '#000000'}
                  onChange={e => onChange({ border: { ...el.border, color: e.target.value } })}
                  className="w-8 h-6 border border-slate-200 rounded cursor-pointer" />
                <input value={el.border?.color || '#000000'}
                  onChange={e => onChange({ border: { ...el.border, color: e.target.value } })}
                  className="flex-1 border border-slate-200 rounded px-1 py-0.5 text-[10px] font-mono" />
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// PREVIEW MODAL — Renders template with sample data
// ════════════════════════════════════════════════════════════════════════════

interface PreviewModalProps {
  layout: TemplateLayout;
  category: TokenCategory;
  onClose: () => void;
}

const PreviewModal: React.FC<PreviewModalProps> = ({ layout, category, onClose }) => {
  const sampleData = useMemo(() => getSampleData(category), [category]);
  const pageWidthPx = (layout.pageSize?.width || 210) * MM_TO_PX;
  const pageHeightPx = (layout.pageSize?.height || 297) * MM_TO_PX;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-sm font-extrabold text-slate-900">Preview — Sample Data</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-slate-100 flex justify-center">
          <div className="bg-white shadow-lg border border-slate-300" style={{ width: pageWidthPx, minHeight: pageHeightPx, padding: 0 }}>
            {layout.elements.map(el => {
              const x = el.x * MM_TO_PX;
              const y = el.y * MM_TO_PX;
              const w = (el.width || 40) * MM_TO_PX;

              if (el.type === 'line') {
                return <div key={el.id} style={{ position: 'absolute', left: x, top: y, width: w, height: (el.strokeWidth || 0.5), backgroundColor: el.strokeColor || '#94a3b8' }} />;
              }

              let content = '';
              if (el.type === 'text') {
                content = resolveTextContent(el.content || '', sampleData);
              } else if (el.type === 'field') {
                content = el.token ? resolveToken(el.token, sampleData, el.format, el.style?.devanagariDigits) : '';
              } else if (el.type === 'image') {
                return <img key={el.id} src={el.source || ''} style={{ position: 'absolute', left: x, top: y, width: w, height: (el.height || 30) * MM_TO_PX, objectFit: 'contain' }} alt="" />;
              } else if (el.type === 'qrcode') {
                return <div key={el.id} style={{ position: 'absolute', left: x, top: y, width: w, height: w, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#94a3b8' }}>QR: {el.dataToken ? resolveToken(el.dataToken, sampleData) : '?'}</div>;
              } else if (el.type === 'signatureLine') {
                return (
                  <div key={el.id} style={{ position: 'absolute', left: x, top: y, width: w, textAlign: 'center' }}>
                    <div style={{ borderBottom: '1px solid #94a3b8', marginBottom: 4 }} />
                    <div style={{ fontSize: 8, color: '#94a3b8' }}>{el.label || 'Signature'}</div>
                  </div>
                );
              } else if (el.type === 'table') {
                const ds = TABLE_DATA_SOURCES.find(d => d.key === el.dataSource);
                return (
                  <div key={el.id} style={{ position: 'absolute', left: x, top: y, width: w, fontSize: 9, border: '1px solid #e2e8f0' }}>
                    <div style={{ background: '#f8fafc', padding: '2px 4px', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0' }}>
                      {el.columns?.map((c, i) => <span key={i} style={{ marginRight: 8 }}>{c.label}</span>)}
                    </div>
                    {ds && (
                      <div style={{ padding: '2px 4px' }}>
                        {ds.columns.slice(0, 3).map((c, i) => (
                          <div key={i}>{c.label}: {resolveToken(c.token, sampleData, undefined, el.style?.devanagariDigits) || '—'}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={el.id} style={{ position: 'absolute', left: x, top: y, width: w, fontFamily: el.style?.fontFamily || 'Inter', fontSize: el.style?.fontSize || 12, fontWeight: el.style?.fontWeight, fontStyle: el.style?.fontStyle, color: el.style?.color || '#1e293b', textAlign: el.style?.textAlign, lineHeight: el.style?.lineHeight || 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// VERSION HISTORY MODAL
// ════════════════════════════════════════════════════════════════════════════

interface VersionHistoryModalProps {
  versions: DocumentTemplateVersion[];
  onRestore: (versionId: string) => void;
  onClose: () => void;
}

const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({ versions, onRestore, onClose }) => (
  <div className="fixed inset-0 z-[60] bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
        <h3 className="text-sm font-extrabold text-slate-900">Version History</h3>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {versions.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">No published versions yet.</p>
        ) : versions.map(v => (
          <div key={v.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-slate-50">
            <div>
              <p className="text-xs font-bold text-slate-800">Version {v.version}</p>
              <p className="text-[10px] text-slate-500">{v.publishedAt ? new Date(v.publishedAt).toLocaleString() : '—'}{v.changeNotes ? ` · ${v.changeNotes}` : ''}</p>
            </div>
            <button onClick={() => onRestore(v.id)} className="px-3 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer">
              Restore
            </button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default TemplateStudioView;
