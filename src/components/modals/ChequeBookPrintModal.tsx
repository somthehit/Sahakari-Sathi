import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Loader2, FileText, Landmark, Info } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { fetchChequeDesigns, ChequeDesignRecord } from '../../api/chequeDesigns';
import { listChequeLeaves, ChequeBook, ChequeLeaf } from '../../api/savingsDeposits';
import {
  ChequeLeafCanvas,
  ChequeDesignConfig,
  DEFAULT_CHEQUE_CONFIG,
} from '../cheque/ChequeLeafCanvas';
import { toBlankLeafConfig, blankLeafContext } from '../../utils/blankChequeLeaf';
import { printChequeBook } from '../../utils/printChequeBook';
import { DateConverter } from '../../utils/DateConverter';
import { formatNPR } from '../../utils/nepaliCalendar';

const PRINT_ROOT_ID = 'cheque-book-print-root';
const MM_TO_PX = 3.7795;
const LEAF_PREVIEW_PX = 540;

interface ChequeBookPrintModalProps {
  open: boolean;
  book: ChequeBook | null;
  onClose: () => void;
}

/** A key/value line used in the acknowledgement slip. */
function SlipRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-slate-200 py-1.5">
      <span className="text-[11.5px] uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-right text-[13px] font-medium text-slate-800">{value || '—'}</span>
    </div>
  );
}

/**
 * The A4 acknowledgement page handed to (and signed by) the member. Fluid width
 * so the same markup fills an A4 print page and the on-screen preview card.
 */
function AcknowledgementSlip({
  book,
  config,
  leafCount,
  firstCheque,
  lastCheque,
}: {
  book: ChequeBook;
  config: ChequeDesignConfig;
  leafCount: number;
  firstCheque: string;
  lastCheque: string;
}) {
  const accent = config.accentColor || '#047857';
  const charge =
    book.issuanceCharge != null && book.issuanceCharge !== ''
      ? formatNPR(Number(book.issuanceCharge))
      : null;

  return (
    <div
      className="mx-auto w-full bg-white text-slate-800"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Institution header */}
      <div className="flex items-center gap-3 border-b-2 pb-3" style={{ borderColor: accent }}>
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
          style={{ borderColor: accent, color: accent }}
        >
          {config.logoUrl ? (
            <img src={config.logoUrl} alt="" className="h-full w-full rounded-full object-contain" />
          ) : (
            <Landmark size={22} />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-bold text-slate-900">{config.bankNameEn}</p>
          <p className="truncate text-[12.5px] text-slate-500">{config.bankNameNp}</p>
          <p className="truncate text-[11.5px] text-slate-400">{config.branchName}</p>
        </div>
      </div>

      {/* Title */}
      <div className="py-4 text-center">
        <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
          Cheque Book Issuance Acknowledgement
        </h3>
        <p className="text-[12px] text-slate-500">चेक बुक हस्तान्तरण रसिद</p>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-8">
        <SlipRow label="Member" value={book.memberName} />
        <SlipRow label="Member No." value={book.memberNo} />
        <SlipRow label="Account No." value={<span className="font-mono">{book.accountNo}</span>} />
        <SlipRow label="Book No." value={<span className="font-mono">{book.bookNumber}</span>} />
        <SlipRow
          label="Cheque range"
          value={<span className="font-mono">{firstCheque} – {lastCheque}</span>}
        />
        <SlipRow label="Leaves" value={String(leafCount)} />
        <SlipRow label="Issued (BS)" value={DateConverter.formatBs(book.issuedDateBs)} />
        <SlipRow label="Status" value={<span className="capitalize">{book.status}</span>} />
        {charge && <SlipRow label="Issuance charge" value={charge} />}
      </div>

      {/* Undertaking */}
      <p className="mt-5 text-[12.5px] leading-relaxed text-slate-600">
        I hereby acknowledge receipt of the above cheque book comprising{' '}
        <span className="font-semibold text-slate-800">{leafCount}</span> leaves (cheque numbers{' '}
        <span className="font-mono">{firstCheque}</span> to <span className="font-mono">{lastCheque}</span>)
        in good order. I undertake to keep the leaves secure and to notify the co-operative immediately
        of any loss, theft, or misuse.
      </p>

      {/* Signatures */}
      <div className="mt-10 grid grid-cols-2 gap-10">
        <div>
          <div className="border-t border-slate-400" />
          <p className="mt-1 text-[12px] font-medium text-slate-700">Received by (Member)</p>
          <p className="text-[11px] text-slate-400">{book.memberName}</p>
          <p className="mt-2 text-[11px] text-slate-400">Date (मिति): ____________________</p>
        </div>
        <div>
          <div className="border-t border-slate-400" />
          <p className="mt-1 text-[12px] font-medium text-slate-700">Issued by (Authorised Officer)</p>
          <p className="text-[11px] text-slate-400">Name &amp; signature</p>
          <p className="mt-2 text-[11px] text-slate-400">Date (मिति): ____________________</p>
        </div>
      </div>

      <p className="mt-8 text-center text-[10.5px] text-slate-400">
        Printed on {DateConverter.formatBs(DateConverter.getTodayBs())} (BS) · Sahakari Sathi
      </p>
    </div>
  );
}

export function ChequeBookPrintModal({ open, book, onClose }: ChequeBookPrintModalProps) {
  const toast = useToast();
  const [leaves, setLeaves] = useState<ChequeLeaf[]>([]);
  const [designs, setDesigns] = useState<ChequeDesignRecord[]>([]);
  const [selectedDesignId, setSelectedDesignId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!open || !book) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setLeaves([]);
    (async () => {
      try {
        const [leafRows, designRows] = await Promise.all([
          listChequeLeaves({ bookId: book.id }),
          fetchChequeDesigns(false),
        ]);
        if (cancelled) return;
        setLeaves(leafRows);
        setDesigns(designRows);
        const preferred = designRows.find((d) => d.isDefault) || designRows[0];
        setSelectedDesignId(preferred ? preferred.id : '');
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.error || err?.message || 'Failed to load cheque book details.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, book]);

  // Chosen design → full config (reconciling the record's mm dimensions), then
  // its blank-print variant.
  const baseConfig = useMemo<ChequeDesignConfig>(() => {
    const d = designs.find((x) => x.id === selectedDesignId);
    if (!d) return DEFAULT_CHEQUE_CONFIG;
    const base = { ...DEFAULT_CHEQUE_CONFIG, ...(d.config || {}) };
    if (d.widthMm) base.widthMm = Number(d.widthMm) || base.widthMm;
    if (d.heightMm) base.heightMm = Number(d.heightMm) || base.heightMm;
    return base;
  }, [designs, selectedDesignId]);

  const blankConfig = useMemo(() => toBlankLeafConfig(baseConfig), [baseConfig]);

  const orderedLeaves = useMemo(
    () => [...leaves].sort((a, b) => (a.leafNo ?? 0) - (b.leafNo ?? 0)),
    [leaves],
  );

  const firstCheque = orderedLeaves[0]?.chequeNumber || String(book?.leafStartNumber ?? '');
  const lastCheque =
    orderedLeaves[orderedLeaves.length - 1]?.chequeNumber || String(book?.leafEndNumber ?? '');

  const repCtx = blankLeafContext({
    chequeNumber: firstCheque,
    accountNo: book?.accountNo,
    accountName: book?.memberName,
  });

  const leafScale = LEAF_PREVIEW_PX / (blankConfig.widthMm * MM_TO_PX);
  const leafBoxH = blankConfig.heightMm * MM_TO_PX * leafScale;

  const handlePrint = () => {
    if (!book || orderedLeaves.length === 0) return;
    setPrinting(true);
    // The hidden print root is already mounted; give the browser a frame to
    // ensure it has painted before invoking the print dialog.
    window.requestAnimationFrame(() => {
      printChequeBook(PRINT_ROOT_ID, blankConfig.widthMm, blankConfig.heightMm);
      setPrinting(false);
    });
  };

  if (!open || !book) return null;

  const canPrint = !loading && !error && orderedLeaves.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[2px]"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Printer size={18} strokeWidth={2.5} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Print cheque book</h2>
              <p className="mt-0.5 text-[13px] leading-snug text-slate-500">
                Acknowledgement slip plus every blank leaf, ready to hand to the member
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          {/* Book summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <FileText size={16} className="text-emerald-600" />
              <div>
                <p className="font-mono text-[13px] font-semibold text-emerald-700">{book.bookNumber}</p>
                <p className="text-[12px] text-slate-500">
                  {book.memberName || '—'} · <span className="font-mono">{book.accountNo}</span>
                </p>
              </div>
            </div>
            <div className="text-right text-[12px] text-slate-500">
              <p>
                <span className="font-mono">{firstCheque}</span> –{' '}
                <span className="font-mono">{lastCheque}</span>
              </p>
              <p>{book.leafCount} leaves</p>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="mt-2 text-[12.5px]">Loading leaves and cheque designs…</p>
            </div>
          ) : error ? (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700">
              {error}
            </p>
          ) : (
            <>
              {/* Design picker */}
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-600">Cheque design</label>
                {designs.length > 0 ? (
                  <select
                    value={selectedDesignId}
                    onChange={(e) => setSelectedDesignId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  >
                    {designs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({Number(d.widthMm)}×{Number(d.heightMm)} mm){d.isDefault ? ' — default' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[12.5px] text-slate-500">
                    <Info size={13} />
                    No saved designs — using the built-in default layout.
                  </p>
                )}
              </div>

              {/* Acknowledgement slip preview */}
              <div>
                <p className="mb-1.5 text-[12px] font-medium text-slate-600">Acknowledgement slip (A4)</p>
                <div className="max-h-[320px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-inner">
                  <AcknowledgementSlip
                    book={book}
                    config={baseConfig}
                    leafCount={orderedLeaves.length || book.leafCount}
                    firstCheque={firstCheque}
                    lastCheque={lastCheque}
                  />
                </div>
              </div>

              {/* Representative blank leaf preview */}
              <div>
                <p className="mb-1.5 text-[12px] font-medium text-slate-600">
                  Blank leaf preview{' '}
                  <span className="text-slate-400">
                    (× {orderedLeaves.length} {orderedLeaves.length === 1 ? 'leaf' : 'leaves'})
                  </span>
                </p>
                <div
                  className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                  style={{ height: leafBoxH }}
                >
                  <div
                    style={{
                      transform: `scale(${leafScale})`,
                      transformOrigin: 'top left',
                      width: `${blankConfig.widthMm}mm`,
                    }}
                  >
                    <ChequeLeafCanvas config={blankConfig} ctx={repCtx} readOnly />
                  </div>
                </div>
              </div>

              {/* Print scope note */}
              <p className="flex items-start gap-1.5 text-[12px] text-slate-400">
                <Info size={13} className="mt-0.5 shrink-0" />
                Prints one A4 acknowledgement page followed by {orderedLeaves.length} cheque{' '}
                {orderedLeaves.length === 1 ? 'leaf' : 'leaves'} at {blankConfig.widthMm}×
                {blankConfig.heightMm} mm. Load cheque stationery before the leaf pages print.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            disabled={!canPrint || printing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-medium text-white shadow-sm shadow-emerald-600/20 transition enabled:hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {printing ? 'Preparing…' : 'Print book'}
          </button>
        </div>
      </div>

      {/* Hidden print root — the full handover package. Shown only for print by
          printChequeBook's injected @media print stylesheet. */}
      {canPrint &&
        createPortal(
          <div id={PRINT_ROOT_ID} style={{ display: 'none' }}>
            <div className="cheque-print-slip">
              <AcknowledgementSlip
                book={book}
                config={baseConfig}
                leafCount={orderedLeaves.length}
                firstCheque={firstCheque}
                lastCheque={lastCheque}
              />
            </div>
            {orderedLeaves.map((leaf) => (
              <div className="cheque-print-leaf" key={leaf.id}>
                <ChequeLeafCanvas
                  config={blankConfig}
                  ctx={blankLeafContext({
                    chequeNumber: leaf.chequeNumber,
                    accountNo: book.accountNo,
                    accountName: book.memberName,
                  })}
                  readOnly
                />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
