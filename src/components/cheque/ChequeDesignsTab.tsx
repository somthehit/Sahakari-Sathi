import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus, RefreshCw, Pencil, Trash2, Loader2, Star, FileSignature,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
  fetchChequeDesigns, deleteChequeDesign, ChequeDesignRecord,
} from '../../api/chequeDesigns';
import { ChequeDesignerModal } from '../modals/ChequeDesignerModal';
import { ChequeLeafCanvas, ChequeDesignConfig, DEFAULT_CHEQUE_CONFIG } from './ChequeLeafCanvas';
import { DEFAULT_CHEQUE_SAMPLE } from './ChequeDesignStudio';

const MM_TO_PX = 3.7795;
const PREVIEW_TARGET_PX = 300;

/** A scaled, non-interactive thumbnail of a saved design. */
function DesignThumbnail({ config }: { config: ChequeDesignConfig }) {
  const scale = PREVIEW_TARGET_PX / (config.widthMm * MM_TO_PX);
  const boxH = config.heightMm * MM_TO_PX * scale;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50" style={{ height: boxH }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: `${config.widthMm}mm` }}>
        <ChequeLeafCanvas config={config} ctx={DEFAULT_CHEQUE_SAMPLE} readOnly />
      </div>
    </div>
  );
}

export const ChequeDesignsTab: React.FC = () => {
  const toast = useToast();
  const [designs, setDesigns] = useState<ChequeDesignRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ChequeDesignRecord | null | undefined>(undefined); // undefined = closed, null = new
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDesigns(await fetchChequeDesigns(true));
    } catch (err: any) {
      toast.showError(err?.response?.data?.error || err?.message || 'Failed to load cheque designs.');
      setDesigns([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleSaved = () => {
    setEditing(undefined);
    load();
  };

  const handleDelete = async (d: ChequeDesignRecord) => {
    if (!window.confirm(`Delete cheque design "${d.name}" (${d.code})? This cannot be undone.`)) return;
    setDeletingId(d.id);
    try {
      await deleteChequeDesign(d.id);
      toast.showSuccess(`Design "${d.name}" deleted.`);
      load();
    } catch (err: any) {
      toast.showError(err?.response?.data?.error || err?.message || 'Failed to delete design.');
    } finally {
      setDeletingId(null);
    }
  };

  const resolveConfig = (d: ChequeDesignRecord): ChequeDesignConfig => {
    const base = { ...DEFAULT_CHEQUE_CONFIG, ...(d.config || {}) };
    if (d.widthMm) base.widthMm = Number(d.widthMm) || base.widthMm;
    if (d.heightMm) base.heightMm = Number(d.heightMm) || base.heightMm;
    return base;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">Cheque leaf designs</h2>
          <p className="mt-0.5 text-[12.5px] text-slate-500">Design the printed cheque leaf visually. The default design is used when printing from any leaf.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setEditing(null)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
          >
            <Plus size={15} strokeWidth={2.5} /> New design
          </button>
        </div>
      </div>

      {loading && designs.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : designs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
          <FileSignature size={30} className="mx-auto text-slate-300" />
          <p className="mt-3 text-[13.5px] font-medium text-slate-600">No cheque designs yet</p>
          <p className="mt-1 text-[12.5px] text-slate-400">Create your first design to control how printed cheque leaves look.</p>
          <button
            onClick={() => setEditing(null)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
          >
            <Plus size={15} strokeWidth={2.5} /> New design
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {designs.map((d) => (
            <div key={d.id} className={`overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md ${d.isDefault ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200'}`}>
              <div className="p-3">
                <DesignThumbnail config={resolveConfig(d)} />
              </div>
              <div className="flex items-start justify-between gap-2 border-t border-slate-100 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13.5px] font-semibold text-slate-900">{d.name}</p>
                    {d.isDefault && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        <Star size={10} className="fill-emerald-500 text-emerald-500" /> Default
                      </span>
                    )}
                    {!d.isActive && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">Inactive</span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-[11.5px] text-slate-500">{d.code} · {Number(d.widthMm)}×{Number(d.heightMm)} mm</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setEditing(d)}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-emerald-700"
                    title="Edit design"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(d)}
                    disabled={deletingId === d.id}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    title="Delete design"
                  >
                    {deletingId === d.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <ChequeDesignerModal
          design={editing}
          onClose={() => setEditing(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};
