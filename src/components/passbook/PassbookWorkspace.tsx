import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, Loader2, Printer, BookOpen, RefreshCw, AlertTriangle, Plus, FileText,
  LayoutGrid, Palette, X, CheckCircle2, Ban, ScrollText, Ruler, Eye, Trash2,
  Pencil, Star, FileSignature, BookMarked, Layers, ChevronRight, Home,
} from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { useToast } from '../../context/ToastContext';
import {
  lookupAccount, getPassbookSummary,
  buildPassbookPrintPayload, confirmPassbookPrint,
  listPassbookBooks, issuePassbookBook, renewPassbookBook,
  listPassbookPrintLog, voidPassbookPrintRun,
  PassbookSummary, AccountLookup, PassbookPrintPayload, PassbookPrintMode,
  PassbookBook, PassbookPrintLogEntry, PassbookIssuanceReason,
} from '../../api/savingsDeposits';
import {
  fetchPassbookDesigns, deletePassbookDesign, PassbookDesignRecord,
} from '../../api/passbookDesigns';
import {
  sanitizeLayout, DEFAULT_PASSBOOK_LAYOUT, DEFAULT_A4_STATEMENT_LAYOUT,
  groupRowsByPage, PassbookLayoutConfig, linesRemainingInBook,
} from '../../utils/passbookLayout';
import { PassbookPage, PassbookPositionedRowData, toPassbookRow } from './PassbookPage';
import { printPassbook } from '../../utils/printPassbook';
import { PassbookDesignerModal } from '../modals/PassbookDesignerModal';
import { ReasonPromptModal } from '../modals/ReasonPromptModal';

const PX_PER_MM = 96 / 25.4;
const PRINT_ROOT_ID = 'passbook-workspace-print';

type Tab = 'print' | 'books' | 'records' | 'design';

const MODE_LABEL: Record<PassbookPrintMode, string> = {
  booklet: 'Passbook booklet',
  a4: 'A4 statement',
  thermal: 'Thermal 80 mm',
};

/** Sample rows used to render design-tab thumbnails at true mm scale. */
const THUMB_SAMPLE = [
  { bsDate: '२०८३-०४-०१', dateAd: '2026-07-16', voucherNo: 'DP-2201', particulars: 'नगद जम्मा', debit: 0, credit: 5000, balance: 5000, tellerName: 'Sita' },
  { bsDate: '२०८३-०४-०३', dateAd: '2026-07-18', voucherNo: 'DP-2210', particulars: 'Cash deposit', debit: 0, credit: 12000, balance: 17000, tellerName: 'Sita' },
  { bsDate: '२०८३-०४-०७', dateAd: '2026-07-22', voucherNo: 'WD-3301', particulars: 'नगद भुक्तानी', debit: 2500, credit: 0, balance: 14500, tellerName: 'Ram' },
  { bsDate: '२०८३-०४-१२', dateAd: '2026-07-27', voucherNo: 'INT-9001', particulars: 'ब्याज जम्मा', debit: 0, credit: 187.5, balance: 14687.5, tellerName: 'Sys' },
  { bsDate: '२०८३-०४-१५', dateAd: '2026-07-30', voucherNo: 'WD-3340', particulars: 'ATM withdrawal', debit: 3000, credit: 0, balance: 11687.5, tellerName: 'Ram' },
  { bsDate: '२०८३-०४-२०', dateAd: '2026-08-04', voucherNo: 'DP-2255', particulars: 'चेक जम्मा', debit: 0, credit: 8000, balance: 19687.5, tellerName: 'Gita' },
];

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : status === 'full' ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : status === 'replaced' ? 'bg-slate-100 text-slate-600 ring-slate-200'
          : status === 'void' ? 'bg-rose-50 text-rose-700 ring-rose-200'
            : status === 'printed' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-slate-100 text-slate-600 ring-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone}`}>
      {status}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────
// PRINT TAB — two-step continuation print (build → print → confirm)
// ───────────────────────────────────────────────────────────────

interface PrintTabProps {
  account: PassbookSummary;
  designs: PassbookDesignRecord[];
  onAccountUpdate: (next: PassbookSummary) => void;
}

const PrintTab: React.FC<PrintTabProps> = ({ account, designs, onAccountUpdate }) => {
  const toast = useToast();
  const [mode, setMode] = useState<PassbookPrintMode>('booklet');
  const [designId, setDesignId] = useState<string>('');
  const [rangeMode, setRangeMode] = useState<'since_last' | 'custom'>('since_last');
  const [fromDateBs, setFromDateBs] = useState('');
  const [toDateBs, setToDateBs] = useState('');
  const [payload, setPayload] = useState<PassbookPrintPayload | null>(null);
  const [building, setBuilding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [didPrint, setDidPrint] = useState(false);

  // Designs available for the currently-selected stationery.
  const modeDesigns = useMemo(
    () => designs.filter((d) => d.mode === mode && d.isActive),
    [designs, mode],
  );

  // Reset a stale payload whenever the print parameters change.
  useEffect(() => { setPayload(null); setDidPrint(false); }, [mode, designId, rangeMode, fromDateBs, toDateBs, account.id]);

  const layout: PassbookLayoutConfig = useMemo(
    () => (payload
      ? sanitizeLayout(payload.layout, payload.mode === 'a4' ? DEFAULT_A4_STATEMENT_LAYOUT : DEFAULT_PASSBOOK_LAYOUT)
      : DEFAULT_PASSBOOK_LAYOUT),
    [payload],
  );

  const pages: PassbookPositionedRowData[][] = useMemo(() => {
    if (!payload) return [];
    return groupRowsByPage(payload.pagination.rows).map((group) =>
      group.map((r) => ({
        data: toPassbookRow(payload.transactions[r.rowIndex], layout.dateFormat),
        line: r.line,
        topMm: r.topMm,
      })),
    );
  }, [payload, layout]);

  const titleLines = useMemo(() => {
    if (!payload || payload.mode !== 'a4') return undefined;
    return [
      'SAHAKARI SATHI SACCOS',
      `Account Statement — ${account.memberName} (A/C ${account.accountNumber})`,
      `Passbook ${account.passbookSerial || '—'}  ·  Printed ${new Date().toISOString().slice(0, 10)}`,
    ];
  }, [payload, account]);

  const handleBuild = async () => {
    setBuilding(true);
    setDidPrint(false);
    try {
      const built = await buildPassbookPrintPayload(account.id, {
        mode,
        designId: designId || null,
        rangeMode,
        fromDateBs: rangeMode === 'custom' ? fromDateBs : undefined,
        toDateBs: rangeMode === 'custom' ? toDateBs : undefined,
      });
      setPayload(built);
      if (built.transactions.length === 0) {
        toast.showInfo('No transactions to print for this selection.', 'Nothing pending');
      }
    } catch (err: any) {
      toast.showError(err?.response?.data?.error || err?.message || 'Failed to build the print job.', 'Build failed');
    } finally {
      setBuilding(false);
    }
  };

  const handlePrint = () => {
    if (!payload || pages.length === 0) return;
    printPassbook(PRINT_ROOT_ID, mode, {
      pageWidthMm: layout.pageWidthMm,
      pageHeightMm: layout.pageHeightMm,
      thermalWidthMm: layout.pageWidthMm,
    });
    setDidPrint(true);
  };

  const handleConfirm = async () => {
    if (!payload) return;
    setConfirming(true);
    try {
      const { account: updated } = await confirmPassbookPrint(account.id, payload.confirm);
      onAccountUpdate(updated);
      toast.showSuccess(
        payload.confirm.advanceMarker
          ? 'Print recorded — passbook continuation marker advanced.'
          : 'Reprint recorded in the passbook print history.',
        'Print confirmed',
      );
      setPayload(null);
      setDidPrint(false);
    } catch (err: any) {
      toast.showError(err?.response?.data?.error || err?.message || 'Failed to record the print.', 'Confirm failed');
    } finally {
      setConfirming(false);
    }
  };

  const previewScale = Math.min(1.35, 620 / (layout.pageWidthMm * PX_PER_MM));
  const book = payload?.book ?? null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Controls */}
      <div className="space-y-4 lg:col-span-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Printer className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Print job</h3>
          </div>

          {/* Stationery */}
          <label className="text-[11px] font-semibold text-slate-500">Stationery</label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {(['booklet', 'a4', 'thermal'] as PassbookPrintMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg border px-2 py-2 text-[11.5px] font-semibold transition cursor-pointer ${mode === m ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>

          {/* Design */}
          <label className="mt-4 block text-[11px] font-semibold text-slate-500">Layout design</label>
          <select
            value={designId}
            onChange={(e) => setDesignId(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[12.5px] font-medium text-slate-800 focus:border-emerald-500 focus:outline-none"
          >
            <option value="">
              {mode === 'a4' ? 'Default A4 statement' : mode === 'thermal' ? 'Default thermal slip' : 'Default booklet layout'}
            </option>
            {modeDesigns.map((d) => (
              <option key={d.id} value={d.id}>{d.name}{d.isDefault ? ' (default)' : ''}</option>
            ))}
          </select>

          {/* Range */}
          <label className="mt-4 block text-[11px] font-semibold text-slate-500">Range</label>
          <div className="mt-1.5 flex flex-col gap-1.5 text-[12.5px]">
            <label className="flex cursor-pointer items-center gap-2 text-slate-700">
              <input type="radio" checked={rangeMode === 'since_last'} onChange={() => setRangeMode('since_last')} className="accent-emerald-600" />
              Since last print (continuation)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-slate-700">
              <input type="radio" checked={rangeMode === 'custom'} onChange={() => setRangeMode('custom')} className="accent-emerald-600" />
              Custom date range
            </label>
          </div>
          {rangeMode === 'custom' && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input value={fromDateBs} onChange={(e) => setFromDateBs(e.target.value)} placeholder="From (BS)" className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12.5px] focus:border-emerald-500 focus:outline-none" />
              <input value={toDateBs} onChange={(e) => setToDateBs(e.target.value)} placeholder="To (BS)" className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12.5px] focus:border-emerald-500 focus:outline-none" />
            </div>
          )}

          <button
            type="button"
            onClick={handleBuild}
            disabled={building}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-slate-900 disabled:opacity-60"
          >
            {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            {building ? 'Building…' : 'Build preview'}
          </button>
        </div>

        {/* Continuation marker + book status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-[12.5px] shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Continuation marker</h3>
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 text-slate-600">
            <span>Passbook serial</span><span className="text-right font-mono font-semibold text-slate-800">{account.passbookSerial || '—'}</span>
            <span>Last printed line</span><span className="text-right font-mono font-semibold text-slate-800">{account.lastPrintedLine} / {account.linesPerPage}</span>
            {book && (
              <>
                <span>Book capacity used</span><span className="text-right font-mono font-semibold text-slate-800">{book.linesUsed} / {book.capacity}</span>
                <span>Lines remaining</span>
                <span className="text-right font-mono font-semibold text-slate-800">
                  {book.remaining ?? linesRemainingInBook(book.capacity, book.linesUsed)}
                </span>
              </>
            )}
          </div>
          {book?.willFill && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This print fills the booklet. Issue a renewal book (Books tab) after confirming.
            </div>
          )}
        </div>
      </div>

      {/* Preview + actions */}
      <div className="space-y-3 lg:col-span-7">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <LayoutGrid className="h-4 w-4 text-emerald-600" /> Print preview
          </span>
          {payload && (
            <span className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500">
              {payload.transactions.length} txn · {payload.pagination.pageCount} page{payload.pagination.pageCount !== 1 ? 's' : ''} · line {payload.confirm.startLine}→{payload.confirm.endLine} · {MODE_LABEL[payload.mode]}
            </span>
          )}
        </div>

        {!payload ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-20 text-center">
            <Printer className="h-8 w-8 text-slate-300" />
            <p className="mt-3 text-[13px] font-medium text-slate-500">Build a preview to see the exact print output</p>
            <p className="mt-1 text-[12px] text-slate-400">The preview renders at true millimetre scale — pixel-for-pixel what the printer overprints.</p>
          </div>
        ) : pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-20 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            <p className="mt-3 text-[13px] font-medium text-slate-600">Nothing pending to print</p>
            <p className="mt-1 text-[12px] text-slate-400">This account has no transactions in the selected range.</p>
          </div>
        ) : (
          <>
            <div className="max-h-[62vh] space-y-4 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {pages.map((rows, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="self-start font-mono text-[10px] text-slate-400">Page {i + 1}</span>
                  <div style={{ width: layout.pageWidthMm * PX_PER_MM * previewScale, height: layout.pageHeightMm * PX_PER_MM * previewScale }}>
                    <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left', width: layout.pageWidthMm * PX_PER_MM }}>
                      <PassbookPage layout={layout} rows={rows} titleLines={titleLines} screenBorder />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" /> {didPrint ? 'Reprint' : 'Print'}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-bold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {payload.confirm.advanceMarker ? 'Confirm & advance marker' : 'Confirm reprint'}
              </button>
              <p className="ml-auto max-w-[46%] text-[11px] leading-snug text-slate-400">
                Print first; confirm only once it landed cleanly. A jam loses nothing — the marker moves on confirm.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Offscreen 1:1 print portal (the real print target). */}
      {payload && pages.length > 0 && (
        <div id={PRINT_ROOT_ID} style={{ position: 'fixed', left: -100000, top: 0 }} aria-hidden>
          {pages.map((rows, i) => (
            <PassbookPage key={i} layout={layout} rows={rows} titleLines={titleLines} />
          ))}
        </div>
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────
// BOOKS TAB — issuance + renewal (wires the previously-dead button)
// ───────────────────────────────────────────────────────────────

interface BookFormState {
  serial: string;
  pageCount: string;
  linesPerPage: string;
  issuedDateBs: string;
  reason: PassbookIssuanceReason;
  remarks: string;
}

interface BooksTabProps {
  account: PassbookSummary;
  onAccountUpdate: (next: PassbookSummary) => void;
}

const BooksTab: React.FC<BooksTabProps> = ({ account, onAccountUpdate }) => {
  const toast = useToast();
  const [books, setBooks] = useState<PassbookBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasActive = books.some((b) => b.status === 'active');
  const [form, setForm] = useState<BookFormState>({
    serial: '', pageCount: '20', linesPerPage: String(account.linesPerPage || 30), issuedDateBs: '', reason: 'new', remarks: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBooks(await listPassbookBooks(account.id));
    } catch (err: any) {
      toast.showError(err?.response?.data?.error || err?.message || 'Failed to load passbook books.');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [account.id, toast]);

  useEffect(() => { load(); }, [load]);

  const openForm = () => {
    setForm({
      serial: '',
      pageCount: '20',
      linesPerPage: String(account.linesPerPage || 30),
      issuedDateBs: '',
      reason: hasActive ? 'renewal' : 'new',
      remarks: '',
    });
    setFormOpen(true);
  };

  const submit = async () => {
    if (!form.serial.trim()) { toast.showError('A book serial is required.', 'Missing serial'); return; }
    setSaving(true);
    try {
      const common = {
        serial: form.serial.trim(),
        pageCount: Number(form.pageCount) || undefined,
        linesPerPage: Number(form.linesPerPage) || undefined,
        issuedDateBs: form.issuedDateBs.trim() || undefined,
        remarks: form.remarks.trim() || undefined,
      };
      if (hasActive) {
        await renewPassbookBook(account.id, { ...common, reason: form.reason as 'renewal' | 'lost' | 'damaged' | 'full' });
        toast.showSuccess(`Renewal book ${common.serial} issued — continuation preserved on a fresh page.`);
      } else {
        await issuePassbookBook(account.id, { ...common, reason: 'new' });
        toast.showSuccess(`Passbook ${common.serial} issued.`);
      }
      setFormOpen(false);
      await load();
      try { onAccountUpdate(await getPassbookSummary(account.id)); } catch { /* summary refresh is best-effort */ }
    } catch (err: any) {
      toast.showError(err?.response?.data?.error || err?.message || 'Failed to issue the book.', 'Issue failed');
    } finally {
      setSaving(false);
    }
  };

  const renewalReasons: { key: PassbookIssuanceReason; label: string }[] = [
    { key: 'renewal', label: 'Routine renewal' },
    { key: 'full', label: 'Previous book full' },
    { key: 'lost', label: 'Lost book' },
    { key: 'damaged', label: 'Damaged book' },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">Passbook books</h2>
          <p className="mt-0.5 text-[12.5px] text-slate-500">Physical booklets issued against this account. Renewal preserves the continuation marker on a fresh page.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openForm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
          >
            {hasActive ? <RefreshCw size={15} /> : <Plus size={15} strokeWidth={2.5} />}
            {hasActive ? 'Issue renewal book' : 'Issue passbook'}
          </button>
        </div>
      </div>

      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="text-[11.5px] uppercase tracking-wide text-slate-400">
            <th className="px-5 py-2.5 font-medium">Serial</th>
            <th className="px-5 py-2.5 font-medium">Status</th>
            <th className="px-5 py-2.5 font-medium">Capacity</th>
            <th className="px-5 py-2.5 font-medium">Issued</th>
            <th className="px-5 py-2.5 font-medium">Reason</th>
            <th className="px-5 py-2.5 font-medium">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {books.map((b) => {
            const pct = b.capacity > 0 ? Math.min(100, Math.round((b.linesUsed / b.capacity) * 100)) : 0;
            return (
              <tr key={b.id} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                <td className="px-5 py-3 font-mono text-[12.5px] font-semibold text-emerald-700">{b.serial}</td>
                <td className="px-5 py-3"><StatusPill status={b.status} /></td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full ${pct >= 90 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-mono text-[11.5px] text-slate-500">{b.linesUsed}/{b.capacity}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-slate-500">{b.issuedDateBs || '—'}</td>
                <td className="px-5 py-3 text-slate-600">{b.issuanceReason}</td>
                <td className="px-5 py-3 text-slate-500">{b.remarks || '—'}</td>
              </tr>
            );
          })}
          {books.length === 0 && !loading && (
            <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">No passbook books issued for this account yet.</td></tr>
          )}
        </tbody>
      </table>
      {loading && books.length === 0 && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>}

      {/* Issue / renew modal */}
      {formOpen && (
        <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[2px]" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }} onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setFormOpen(false); }}>
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  {hasActive ? <RefreshCw size={18} /> : <BookOpen size={18} />}
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900">{hasActive ? 'Issue renewal book' : 'Issue passbook'}</h3>
                  <p className="mt-0.5 text-[12.5px] text-slate-500">{account.memberName} · <span className="font-mono">#{account.accountNumber}</span></p>
                </div>
              </div>
              <button onClick={() => setFormOpen(false)} disabled={saving} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"><X size={18} /></button>
            </div>

            <div className="space-y-3 px-5 py-4 text-[12.5px]">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">Book serial *</label>
                <input value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} placeholder="e.g. PB-000431" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono focus:border-emerald-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">Pages</label>
                  <input type="number" min={1} value={form.pageCount} onChange={(e) => setForm({ ...form, pageCount: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-emerald-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">Lines / page</label>
                  <input type="number" min={1} value={form.linesPerPage} onChange={(e) => setForm({ ...form, linesPerPage: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-emerald-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">Issued date (BS)</label>
                <input value={form.issuedDateBs} onChange={(e) => setForm({ ...form, issuedDateBs: e.target.value })} placeholder="e.g. 2083-04-15 (blank = today)" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-emerald-500 focus:outline-none" />
              </div>
              {hasActive && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">Renewal reason</label>
                  <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value as PassbookIssuanceReason })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-emerald-500 focus:outline-none">
                    {renewalReasons.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">Remarks</label>
                <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Optional" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-emerald-500 focus:outline-none" />
              </div>
              {hasActive && (
                <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500">
                  <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  The current active book will be closed and this new book opened. Printing resumes on a fresh page; the transaction history marker is preserved.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">
              <button onClick={() => setFormOpen(false)} disabled={saving} className="rounded-lg px-4 py-2 text-[13px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">Cancel</button>
              <button onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-medium text-white shadow-sm shadow-emerald-600/20 transition enabled:hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Issuing…' : hasActive ? 'Issue renewal' : 'Issue passbook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────
// RECORDS TAB — print history + void
// ───────────────────────────────────────────────────────────────

interface RecordsTabProps {
  account: PassbookSummary;
  onAccountUpdate: (next: PassbookSummary) => void;
}

const RecordsTab: React.FC<RecordsTabProps> = ({ account, onAccountUpdate }) => {
  const toast = useToast();
  const [log, setLog] = useState<PassbookPrintLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLog(await listPassbookPrintLog(account.id));
    } catch (err: any) {
      toast.showError(err?.response?.data?.error || err?.message || 'Failed to load print history.');
      setLog([]);
    } finally {
      setLoading(false);
    }
  }, [account.id, toast]);

  useEffect(() => { load(); }, [load]);

  const confirmVoid = async (reason: string) => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      const { account: updated } = await voidPassbookPrintRun(voidTarget, reason || undefined);
      onAccountUpdate(updated);
      toast.showSuccess('Print run voided. Its transactions are unmarked and can be reprinted.');
      setVoidTarget(null);
      await load();
    } catch (err: any) {
      toast.showError(err?.response?.data?.error || err?.message || 'Failed to void the print run.', 'Void failed');
    } finally {
      setVoiding(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">Print history</h2>
          <p className="mt-0.5 text-[12.5px] text-slate-500">Every confirmed print run. Voiding a booklet run rolls the continuation marker back so it can be reprinted.</p>
        </div>
        <button onClick={load} className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50" title="Refresh">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="text-[11.5px] uppercase tracking-wide text-slate-400">
            <th className="px-5 py-2.5 font-medium">When</th>
            <th className="px-5 py-2.5 font-medium">Mode</th>
            <th className="px-5 py-2.5 font-medium">Range</th>
            <th className="px-5 py-2.5 font-medium">Txns</th>
            <th className="px-5 py-2.5 font-medium">Lines</th>
            <th className="px-5 py-2.5 font-medium">Pages</th>
            <th className="px-5 py-2.5 font-medium">By</th>
            <th className="px-5 py-2.5 font-medium">Status</th>
            <th className="px-5 py-2.5 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {log.map((r) => (
            <tr key={r.id} className="border-t border-slate-100 transition hover:bg-slate-50/70">
              <td className="px-5 py-3 text-slate-500">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</td>
              <td className="px-5 py-3 text-slate-600">{MODE_LABEL[r.mode] ?? r.mode}</td>
              <td className="px-5 py-3 font-mono text-[12px] text-slate-500">{r.fromDateBs || '—'}{r.toDateBs ? ` → ${r.toDateBs}` : ''}</td>
              <td className="px-5 py-3 text-slate-600">{r.txnCount}</td>
              <td className="px-5 py-3 font-mono text-[12px] text-slate-500">{r.startLine}→{r.endLine} ({r.linesPrinted})</td>
              <td className="px-5 py-3 text-slate-600">{r.pageCount}</td>
              <td className="px-5 py-3 text-slate-500">{r.printedByName || '—'}</td>
              <td className="px-5 py-3"><StatusPill status={r.status} /></td>
              <td className="px-5 py-3 text-right">
                {r.status === 'printed' && (
                  <button
                    onClick={() => setVoidTarget(r.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Ban size={13} /> Void
                  </button>
                )}
              </td>
            </tr>
          ))}
          {log.length === 0 && !loading && (
            <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">No print runs recorded for this account yet.</td></tr>
          )}
        </tbody>
      </table>
      {loading && log.length === 0 && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>}

      <ReasonPromptModal
        open={!!voidTarget}
        title="Void print run"
        description="Marks this run as void and unmarks its transactions. For a booklet run the continuation marker rolls back so it can be reprinted."
        label="Reason"
        placeholder="e.g. Printer jammed halfway / wrong booklet inserted"
        required
        confirmLabel="Void run"
        tone="danger"
        busy={voiding}
        onCancel={() => setVoidTarget(null)}
        onConfirm={confirmVoid}
      />
    </div>
  );
};

// ───────────────────────────────────────────────────────────────
// DESIGN TAB — saved layouts grid + designer modal (mirrors cheque)
// ───────────────────────────────────────────────────────────────

const THUMB_TARGET_PX = 300;

function DesignThumbnail({ record }: { record: PassbookDesignRecord }) {
  const layout = sanitizeLayout(record.config ?? null, record.mode === 'a4' ? DEFAULT_A4_STATEMENT_LAYOUT : DEFAULT_PASSBOOK_LAYOUT);
  const scale = THUMB_TARGET_PX / (layout.pageWidthMm * PX_PER_MM);
  const boxH = layout.pageHeightMm * PX_PER_MM * scale;
  const rowCount = Math.min(6, layout.linesPerPage, THUMB_SAMPLE.length);
  const rows: PassbookPositionedRowData[] = Array.from({ length: rowCount }, (_, i) => ({
    data: toPassbookRow(THUMB_SAMPLE[i % THUMB_SAMPLE.length], layout.dateFormat),
    line: i,
    topMm: layout.marginTopMm + i * layout.lineHeightMm,
  }));
  return (
    <div className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50" style={{ height: boxH }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: layout.pageWidthMm * PX_PER_MM }}>
        <PassbookPage layout={layout} rows={rows} showBaselines={!layout.showColumnRules} />
      </div>
    </div>
  );
}

interface DesignTabProps {
  designs: PassbookDesignRecord[];
  loading: boolean;
  onReload: () => void;
}

const DesignTab: React.FC<DesignTabProps> = ({ designs, loading, onReload }) => {
  const toast = useToast();
  const [editing, setEditing] = useState<PassbookDesignRecord | null | undefined>(undefined); // undefined = closed, null = new
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (d: PassbookDesignRecord) => {
    if (!window.confirm(`Delete passbook design "${d.name}" (${d.code})? This cannot be undone.`)) return;
    setDeletingId(d.id);
    try {
      await deletePassbookDesign(d.id);
      toast.showSuccess(`Design "${d.name}" deleted.`);
      onReload();
    } catch (err: any) {
      toast.showError(err?.response?.data?.error || err?.message || 'Failed to delete design.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">Passbook layouts</h2>
          <p className="mt-0.5 text-[12.5px] text-slate-500">Calibrate named layouts for the booklet, A4 statement, and thermal slip. The Print tab picks one per job.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onReload} className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setEditing(null)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700">
            <Plus size={15} strokeWidth={2.5} /> New layout
          </button>
        </div>
      </div>

      {loading && designs.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : designs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
          <FileSignature size={30} className="mx-auto text-slate-300" />
          <p className="mt-3 text-[13.5px] font-medium text-slate-600">No passbook layouts yet</p>
          <p className="mt-1 text-[12.5px] text-slate-400">Create a layout to calibrate exactly where each line and column overprints.</p>
          <button onClick={() => setEditing(null)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700">
            <Plus size={15} strokeWidth={2.5} /> New layout
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {designs.map((d) => (
            <div key={d.id} className={`overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md ${d.isDefault ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200'}`}>
              <div className="p-3"><DesignThumbnail record={d} /></div>
              <div className="flex items-start justify-between gap-2 border-t border-slate-100 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-[13.5px] font-semibold text-slate-900">{d.name}</p>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">{MODE_LABEL[d.mode] ?? d.mode}</span>
                    {d.isDefault && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        <Star size={10} className="fill-emerald-500 text-emerald-500" /> Default
                      </span>
                    )}
                    {!d.isActive && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">Inactive</span>}
                  </div>
                  <p className="mt-0.5 font-mono text-[11.5px] text-slate-500">{d.code} · {Number(d.widthMm)}×{Number(d.heightMm)} mm</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => setEditing(d)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-emerald-700" title="Edit layout"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(d)} disabled={deletingId === d.id} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50" title="Delete layout">
                    {deletingId === d.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <PassbookDesignerModal
          design={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); onReload(); }}
        />
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────
// WORKSPACE SHELL — account search + tabs
// ───────────────────────────────────────────────────────────────

export interface PassbookWorkspaceProps {
  /** Pre-select an account (modal entry point). */
  initialAccountId?: string | null;
  /** Which tab to open on mount. */
  defaultTab?: Tab;
  /** Hide the breadcrumb/title chrome when embedded in a modal. */
  embedded?: boolean;
}

export const PassbookWorkspace: React.FC<PassbookWorkspaceProps> = ({ initialAccountId, defaultTab = 'print', embedded = false }) => {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(defaultTab);

  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<AccountLookup[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [account, setAccount] = useState<PassbookSummary | null>(null);

  const [designs, setDesigns] = useState<PassbookDesignRecord[]>([]);
  const [designsLoading, setDesignsLoading] = useState(false);

  const loadDesigns = useCallback(async () => {
    setDesignsLoading(true);
    try {
      setDesigns(await fetchPassbookDesigns(true));
    } catch {
      setDesigns([]);
    } finally {
      setDesignsLoading(false);
    }
  }, []);

  const loadAccount = useCallback(async (id: string) => {
    setLoadingAccount(true);
    try {
      setAccount(await getPassbookSummary(id));
      setMatches([]);
      setQuery('');
    } catch (err: any) {
      toast.showError(err?.response?.data?.error || err?.message || 'Failed to load passbook summary.');
    } finally {
      setLoadingAccount(false);
    }
  }, [toast]);

  useEffect(() => { loadDesigns(); }, [loadDesigns]);
  useEffect(() => { if (initialAccountId) loadAccount(initialAccountId); }, [initialAccountId, loadAccount]);

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const rows = await lookupAccount(query.trim());
      if (rows.length === 0) toast.showError('No matching account found.');
      else if (rows.length === 1) await loadAccount(rows[0].id);
      else setMatches(rows);
    } catch (err: any) {
      toast.showError(err?.response?.data?.error || err?.message || 'Account lookup failed.');
    } finally {
      setSearching(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode; needsAccount: boolean }[] = [
    { key: 'print', label: 'Print', icon: <Printer size={15} />, needsAccount: true },
    { key: 'books', label: 'Books', icon: <BookOpen size={15} />, needsAccount: true },
    { key: 'records', label: 'Records', icon: <ScrollText size={15} />, needsAccount: true },
    { key: 'design', label: 'Design', icon: <Palette size={15} />, needsAccount: false },
  ];

  return (
    <div className="w-full text-slate-800" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
      {!embedded && (
        <div className="border-b border-slate-200 bg-white px-6 py-3.5">
          <div className="mx-auto flex max-w-6xl items-center gap-1.5 text-[13px] text-slate-500">
            <Home size={14} />
            <span>Dashboard</span>
            <ChevronRight size={13} className="text-slate-300" />
            <span className="font-medium text-slate-800">Passbook Management</span>
          </div>
        </div>
      )}

      <div className={embedded ? '' : 'mx-auto max-w-6xl px-6 py-8'}>
        {!embedded && (
          <div className="mb-6">
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Passbook</h1>
            <p className="mt-1 text-[13.5px] text-slate-500">Continuation printing onto physical booklets, an A4 / thermal fallback, book issuance, print records, and layout calibration — one workspace.</p>
          </div>
        )}

        {/* Account search */}
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                placeholder="Search account number or member name"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[13px] text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <button onClick={runSearch} disabled={searching} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Find
            </button>
          </div>
          {matches.length > 0 && (
            <ul className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200">
              {matches.map((m) => (
                <li key={m.id}>
                  <button onClick={() => loadAccount(m.id)} className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] transition hover:bg-slate-50">
                    <span>{m.memberName} — <span className="font-mono text-slate-500">#{m.accountNumber}</span></span>
                    <span className="font-mono text-[12px] text-slate-400">{formatNPR(m.balance)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {account && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-emerald-50/60 px-3.5 py-2.5 text-[12.5px] ring-1 ring-inset ring-emerald-100">
              <span className="font-semibold text-slate-900">{account.memberName}</span>
              <span className="font-mono text-slate-500">#{account.accountNumber}</span>
              <span className="text-slate-400">Passbook <span className="font-mono text-slate-600">{account.passbookSerial || '—'}</span></span>
              <span className="text-slate-400">Marker <span className="font-mono text-slate-600">{account.lastPrintedLine}/{account.linesPerPage}</span></span>
              {loadingAccount && <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-5 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] transition cursor-pointer ${tab === t.key ? 'bg-emerald-600 font-semibold text-white shadow-sm shadow-emerald-600/20' : 'border border-slate-200 bg-white font-medium text-slate-600 hover:bg-slate-50'}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Tab bodies */}
        {tab === 'design' ? (
          <DesignTab designs={designs} loading={designsLoading} onReload={loadDesigns} />
        ) : !account ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-5 py-20 text-center">
            <BookOpen className="h-8 w-8 text-slate-300" />
            <p className="mt-3 text-[13.5px] font-medium text-slate-600">Search for an account to begin</p>
            <p className="mt-1 text-[12.5px] text-slate-400">Print, books, and records all work against a selected account.</p>
          </div>
        ) : tab === 'print' ? (
          <PrintTab account={account} designs={designs} onAccountUpdate={setAccount} />
        ) : tab === 'books' ? (
          <BooksTab account={account} onAccountUpdate={setAccount} />
        ) : (
          <RecordsTab account={account} onAccountUpdate={setAccount} />
        )}
      </div>
    </div>
  );
};
