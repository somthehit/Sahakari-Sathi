import React, { useState, useEffect } from 'react';
import { Coins, RefreshCw, Printer, FileSpreadsheet, Loader2 } from 'lucide-react';
import { formatNPR, getTodayBS } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';
import { fetchTdsDeductionReport, type TdsDeductionReport } from '../../../api/regulatoryReports';

export const TdsDeductionPage: React.FC = () => {
  const [data, setData] = useState<TdsDeductionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = async () => {
    try { setLoading(true); setError(null); setData(await fetchTdsDeductionReport(startDate || undefined, endDate || undefined)); }
    catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleExportPdf = () => {
    if (!data) return;
    const headers = ['Voucher No', 'Date (BS)', 'Narration', 'Debit (NPR)', 'Credit (NPR)'];
    const rows = data.entries.map(e => [e.voucherNo, e.dateBs, e.narration, formatNPR(e.debit), formatNPR(e.credit)]);
    rows.push(['TOTAL', '', `${data.summary.totalEntries} entries`, formatNPR(data.summary.totalTdsDebit), formatNPR(data.summary.totalTdsCredit)]);
    exportToPdf('TDS_Deduction_Report', `${data.organization.name} — TDS Deduction Report`, `FY: ${data.fiscalYear?.code || 'N/A'} | Period: ${data.dateRange.startDate} — ${data.dateRange.endDate}`, headers, rows);
  };

  const handleExportExcel = () => {
    if (!data) return;
    const headers = ['Voucher No', 'Date (BS)', 'Narration', 'Debit', 'Credit'];
    const rows = data.entries.map(e => [e.voucherNo, e.dateBs, e.narration, e.debit, e.credit]);
    rows.push(['TOTAL', '', `${data.summary.totalEntries} entries`, data.summary.totalTdsDebit, data.summary.totalTdsCredit]);
    exportToExcel('TDS_Deduction_Report', 'TDS_Report', headers, rows);
  };

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /><span className="ml-2 text-sm text-slate-500">Loading TDS Report…</span></div>;
  if (error) return <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>;
  if (!data) return null;

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">TDS Deduction Report (करकट्टी विवरण)</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Coins className="w-3.5 h-3.5 text-slate-500" />
            Tax Deducted at Source — Interest, Dividend & Salary Deductions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
          <button onClick={handleExportPdf} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><Printer className="w-3.5 h-3.5" />PDF</button>
          <button onClick={handleExportExcel} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</button>
        </div>
      </div>

      {/* Org Info + Date Filter */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-4">
          <div><span className="text-slate-500 font-semibold">Cooperative</span><p className="font-bold text-slate-900">{data.organization.name}</p></div>
          <div><span className="text-slate-500 font-semibold">Registration No.</span><p className="font-bold text-slate-900">{data.organization.registrationNo}</p></div>
          <div><span className="text-slate-500 font-semibold">Fiscal Year</span><p className="font-bold text-slate-900">{data.fiscalYear?.code || 'N/A'}</p></div>
          <div><span className="text-slate-500 font-semibold">Period</span><p className="font-bold text-slate-900">{data.dateRange.startDate || 'All'} — {data.dateRange.endDate || 'All'}</p></div>
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3">
          <div>
            <label className="block text-slate-600 font-semibold text-[11px] mb-1">Start Date (BS)</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-mono focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-slate-600 font-semibold text-[11px] mb-1">End Date (BS)</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-mono focus:border-emerald-500 focus:outline-none" />
          </div>
          <button onClick={load} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer text-xs">Apply Filter</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center">
          <p className="text-[10px] font-semibold text-slate-500 uppercase">Total Entries</p>
          <p className="text-xl font-black text-slate-900 mt-1">{data.summary.totalEntries}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center">
          <p className="text-[10px] font-semibold text-slate-500 uppercase">Total TDS Debit</p>
          <p className="text-xl font-black text-emerald-700 mt-1">{formatNPR(data.summary.totalTdsDebit)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center">
          <p className="text-[10px] font-semibold text-slate-500 uppercase">Total TDS Credit</p>
          <p className="text-xl font-black text-rose-600 mt-1">{formatNPR(data.summary.totalTdsCredit)}</p>
        </div>
      </div>

      {/* Entries Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3">TDS Entries (करकट्टी विवरण)</h2>
        {data.entries.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No TDS entries found for the selected period.</p>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-amber-50 text-amber-800 border-b border-amber-200 text-[11px] font-semibold">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Voucher No</th>
                  <th className="p-3">Date (BS)</th>
                  <th className="p-3">Narration</th>
                  <th className="p-3 text-right">Debit (NPR)</th>
                  <th className="p-3 text-right">Credit (NPR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.entries.map((e, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="p-3 text-slate-400">{i + 1}</td>
                    <td className="p-3 font-mono font-bold text-slate-900">{e.voucherNo}</td>
                    <td className="p-3 font-mono text-slate-600">{e.dateBs}</td>
                    <td className="p-3 text-slate-700 max-w-[300px] truncate">{e.narration}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">{e.debit > 0 ? formatNPR(e.debit) : '—'}</td>
                    <td className="p-3 text-right font-mono font-bold text-rose-600">{e.credit > 0 ? formatNPR(e.credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-extrabold">
                <tr>
                  <td className="p-3" colSpan={4}>TOTAL ({data.summary.totalEntries} entries)</td>
                  <td className="p-3 text-right font-mono text-emerald-700">{formatNPR(data.summary.totalTdsDebit)}</td>
                  <td className="p-3 text-right font-mono text-rose-600">{formatNPR(data.summary.totalTdsCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
