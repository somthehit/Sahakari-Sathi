import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, RefreshCw, FileSpreadsheet, FileText, Printer, Loader2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { exportToExcel, exportToPdf } from '../../utils/exportUtils';
import { printDocumentById } from '../../utils/printDocument';
import {
  fetchChequeRegister, ChequeRegisterRow, ChequeLeafStatus,
} from '../../api/chequeRegistry';

const PRINT_ID = 'cheque-register-print';
const PAGE_SIZE = 50;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'unused', label: 'Unused' },
  { value: 'issued', label: 'Issued' },
  { value: 'presented', label: 'Presented' },
  { value: 'used', label: 'Used' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'stopped', label: 'Stopped' },
  { value: 'cancelled', label: 'Cancelled' },
];

function statusPill(status: ChequeLeafStatus): string {
  switch (status) {
    case 'cleared': return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'used': return 'bg-violet-50 text-violet-700 ring-violet-200';
    case 'presented': return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'issued': return 'bg-sky-50 text-sky-700 ring-sky-200';
    case 'bounced': return 'bg-rose-50 text-rose-700 ring-rose-200';
    case 'stopped':
    case 'cancelled': return 'bg-red-50 text-red-700 ring-red-200';
    default: return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

const EXPORT_HEADERS = ['Cheque No', 'Account', 'Member', 'Book', 'Status', 'Payee', 'Amount', 'Cheque Date (BS)', 'Issued (BS)', 'Branch'];

function toRow(r: ChequeRegisterRow, formatted: boolean): (string | number)[] {
  const amt = r.amount == null || r.amount === '' ? '' : Number(r.amount);
  return [
    r.chequeNumber,
    r.accountNo,
    r.memberName || '',
    r.bookNumber,
    r.status,
    r.payeeName || '',
    formatted ? (amt === '' ? '' : formatNPR(amt as number)) : (amt === '' ? '' : (amt as number)),
    r.chequeDateBs || '',
    r.issuedDateBs || '',
    r.branchName || '',
  ];
}

export const ChequeRegisterTab: React.FC = () => {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const registerQuery = useQuery({
    queryKey: ['cheque-book-register', 'register', { search, status, page }],
    queryFn: () => fetchChequeRegister({
      search: search || undefined,
      status,
      page,
      limit: PAGE_SIZE,
    }),
  });

  const data = registerQuery.data;
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const applySearch = () => { setPage(1); setSearch(searchInput.trim()); };

  const subtitle = useMemo(() => {
    const bits = [`${total} leaves`];
    if (search) bits.push(`search "${search}"`);
    if (status !== 'all') bits.push(`status ${status}`);
    return bits.join(' · ');
  }, [total, search, status]);

  /** Pull every filtered row (across pages, capped) for a complete export. */
  const gatherAll = async (): Promise<ChequeRegisterRow[]> => {
    const acc: ChequeRegisterRow[] = [];
    let p = 1;
    const HARD_CAP = 5000;
    // Server caps limit at 200 per page.
    for (;;) {
      const res = await fetchChequeRegister({ search: search || undefined, status, page: p, limit: 200 });
      acc.push(...res.rows);
      if (acc.length >= res.total || res.rows.length === 0 || acc.length >= HARD_CAP) break;
      p += 1;
    }
    return acc;
  };

  const handleExcel = async () => {
    setExporting(true);
    try {
      const all = await gatherAll();
      exportToExcel('cheque-register', 'Cheque Register', EXPORT_HEADERS, all.map((r) => toRow(r, false)));
    } finally { setExporting(false); }
  };

  const handlePdf = async () => {
    setExporting(true);
    try {
      const all = await gatherAll();
      exportToPdf('cheque-register', 'Cheque Register', subtitle, EXPORT_HEADERS, all.map((r) => toRow(r, true)));
    } finally { setExporting(false); }
  };

  const handlePrint = () => printDocumentById(PRINT_ID, 'Cheque Register');

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 className="text-[15px] font-semibold text-slate-900">Unified cheque register</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Cheque no / account / member / book"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              className="w-72 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-[12.5px] outline-none transition focus:border-emerald-400 focus:bg-white"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12.5px] text-slate-700 outline-none focus:border-emerald-400"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={applySearch} className="rounded-lg bg-slate-800 px-3 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-slate-700">
            Search
          </button>
          <button
            onClick={() => registerQuery.refetch()}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={registerQuery.isFetching ? 'animate-spin' : ''} />
          </button>
          <div className="mx-1 h-6 w-px bg-slate-200" />
          <button
            onClick={handleExcel}
            disabled={exporting || total === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12.5px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />} Excel
          </button>
          <button
            onClick={handlePdf}
            disabled={exporting || total === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12.5px] font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} PDF
          </button>
          <button
            onClick={handlePrint}
            disabled={total === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-[11.5px] uppercase tracking-wide text-slate-400">
              <th className="px-5 py-2.5 font-medium">Cheque No</th>
              <th className="px-5 py-2.5 font-medium">Account</th>
              <th className="px-5 py-2.5 font-medium">Member</th>
              <th className="px-5 py-2.5 font-medium">Book</th>
              <th className="px-5 py-2.5 font-medium">Payee</th>
              <th className="px-5 py-2.5 font-medium">Amount</th>
              <th className="px-5 py-2.5 font-medium">Cheque Date</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                <td className="px-5 py-3 font-mono text-[12.5px] font-semibold text-emerald-700">{r.chequeNumber}</td>
                <td className="px-5 py-3 font-mono text-slate-600">{r.accountNo}</td>
                <td className="px-5 py-3 text-slate-700">{r.memberName || '—'}</td>
                <td className="px-5 py-3 font-mono text-slate-500">{r.bookNumber}</td>
                <td className="px-5 py-3 text-slate-600">{r.payeeName || '—'}</td>
                <td className="px-5 py-3 font-mono font-semibold text-slate-800">{r.amount == null || r.amount === '' ? '—' : formatNPR(Number(r.amount))}</td>
                <td className="px-5 py-3 text-slate-500">{r.chequeDateBs || '—'}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${statusPill(r.status)}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !registerQuery.isFetching && (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">No cheque leaves match these filters.</td></tr>
            )}
          </tbody>
        </table>
        {registerQuery.isFetching && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-[12.5px] text-slate-500">
        <span>{total.toLocaleString('en-IN')} leaves · page {page} of {totalPages}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Hidden printable table (current page) */}
      <div id={PRINT_ID} className="hidden">
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>Cheque Register</h2>
        <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>{subtitle}</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr>
              {EXPORT_HEADERS.map((h) => (
                <th key={h} style={{ border: '1px solid #e2e8f0', padding: '5px 7px', textAlign: 'left', background: '#f1f5f9' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {toRow(r, true).map((cell, i) => (
                  <td key={i} style={{ border: '1px solid #e2e8f0', padding: '4px 7px' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
