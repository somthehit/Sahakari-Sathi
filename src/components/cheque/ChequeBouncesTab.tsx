import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, AlertOctagon, Loader2, FileSpreadsheet, FileText, Printer,
} from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { exportToExcel, exportToPdf } from '../../utils/exportUtils';
import { printDocumentById } from '../../utils/printDocument';
import { fetchBounceRegister, BounceRecord } from '../../api/chequeSettings';

const PRINT_ID = 'cheque-bounce-print';
const EXPORT_HEADERS = ['Cheque No', 'Account', 'Member', 'Amount', 'Reason', 'Charge', 'Reported'];

function toRow(r: BounceRecord, formatted: boolean): (string | number)[] {
  const amt = Number(r.amount) || 0;
  const charge = Number(r.bounceCharge) || 0;
  return [
    r.chequeNumber,
    r.accountNo,
    r.memberName || '',
    formatted ? formatNPR(amt) : amt,
    r.bounceReason || '',
    formatted ? formatNPR(charge) : charge,
    r.reportedDate || '',
  ];
}

export const ChequeBouncesTab: React.FC = () => {
  const [rows, setRows] = useState<BounceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchBounceRegister());
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    const amount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const charges = rows.reduce((s, r) => s + (Number(r.bounceCharge) || 0), 0);
    return { amount, charges };
  }, [rows]);

  const subtitle = `${rows.length} dishonoured cheques · ${formatNPR(totals.amount)} · ${formatNPR(totals.charges)} charges`;

  const handleExcel = () => exportToExcel('cheque-bounces', 'Bounced Cheques', EXPORT_HEADERS, rows.map((r) => toRow(r, false)));
  const handlePdf = () => exportToPdf('cheque-bounces', 'Bounced Cheque Register', subtitle, EXPORT_HEADERS, rows.map((r) => toRow(r, true)));
  const handlePrint = () => printDocumentById(PRINT_ID, 'Bounced Cheque Register');

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
          <AlertOctagon size={16} className="text-rose-600" /> Bounced cheque register
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={load} className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExcel}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12.5px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
          >
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button
            onClick={handlePdf}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12.5px] font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
          >
            <FileText size={13} /> PDF
          </button>
          <button
            onClick={handlePrint}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-[11.5px] uppercase tracking-wide text-slate-400">
              <th className="px-5 py-2.5 font-medium">Cheque No</th>
              <th className="px-5 py-2.5 font-medium">Account</th>
              <th className="px-5 py-2.5 font-medium">Member</th>
              <th className="px-5 py-2.5 font-medium">Amount</th>
              <th className="px-5 py-2.5 font-medium">Reason</th>
              <th className="px-5 py-2.5 font-medium">Charge</th>
              <th className="px-5 py-2.5 font-medium">Reported</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                <td className="px-5 py-3 font-mono text-[12.5px] font-semibold text-rose-700">{r.chequeNumber}</td>
                <td className="px-5 py-3 font-mono text-slate-600">{r.accountNo}</td>
                <td className="px-5 py-3 text-slate-700">{r.memberName || '—'}</td>
                <td className="px-5 py-3 font-mono font-semibold text-slate-800">{formatNPR(Number(r.amount) || 0)}</td>
                <td className="px-5 py-3 max-w-[260px] truncate text-slate-600" title={r.bounceReason}>{r.bounceReason || '—'}</td>
                <td className="px-5 py-3 font-mono text-slate-600">{formatNPR(Number(r.bounceCharge) || 0)}</td>
                <td className="px-5 py-3 text-slate-500">{r.reportedDate || '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">No bounced cheques recorded.</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/70 text-[12.5px] font-semibold text-slate-700">
                <td className="px-5 py-2.5" colSpan={3}>Totals</td>
                <td className="px-5 py-2.5 font-mono">{formatNPR(totals.amount)}</td>
                <td className="px-5 py-2.5"></td>
                <td className="px-5 py-2.5 font-mono">{formatNPR(totals.charges)}</td>
                <td className="px-5 py-2.5"></td>
              </tr>
            </tfoot>
          )}
        </table>
        {loading && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>}
      </div>

      {/* Hidden printable table */}
      <div id={PRINT_ID} className="hidden">
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>Bounced Cheque Register</h2>
        <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>{subtitle}</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr>{EXPORT_HEADERS.map((h) => (
              <th key={h} style={{ border: '1px solid #e2e8f0', padding: '5px 7px', textAlign: 'left', background: '#f1f5f9' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>{toRow(r, true).map((cell, i) => (
                <td key={i} style={{ border: '1px solid #e2e8f0', padding: '4px 7px' }}>{cell}</td>
              ))}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
