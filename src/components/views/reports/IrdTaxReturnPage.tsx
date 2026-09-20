import React, { useState, useEffect } from 'react';
import { Receipt, RefreshCw, Printer, FileSpreadsheet, Loader2 } from 'lucide-react';
import { formatNPR } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';
import { fetchIrdTaxReturnSummary, type IrdTaxReturnSummary } from '../../../api/regulatoryReports';

export const IrdTaxReturnPage: React.FC = () => {
  const [data, setData] = useState<IrdTaxReturnSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try { setLoading(true); setError(null); setData(await fetchIrdTaxReturnSummary()); }
    catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleExportPdf = () => {
    if (!data) return;
    const s = data.summary;
    const headers = ['Parameter', 'Amount (NPR)'];
    const rows = [
      ['Total Income', formatNPR(s.totalIncome)], ['Total Expense', formatNPR(s.totalExpense)],
      ['Net Profit', formatNPR(s.netProfit)], ['Taxable Income', formatNPR(s.taxableIncome)],
      [`Tax Rate (${(s.taxRate * 100).toFixed(0)}%)`, formatNPR(s.estimatedTax)],
    ];
    data.incomeBreakdown.forEach(a => rows.push([`Income: ${a.name}`, formatNPR(a.amount)]));
    data.expenseBreakdown.forEach(a => rows.push([`Expense: ${a.name}`, formatNPR(a.amount)]));
    exportToPdf('IRD_Tax_Return', `${data.organization.name} — IRD Tax Return Summary`, `FY: ${data.fiscalYear?.code || 'N/A'} | PAN: ${data.organization.panNumber}`, headers, rows);
  };

  const handleExportExcel = () => {
    if (!data) return;
    const headers = ['Type', 'Code', 'Name', 'Amount (NPR)'];
    const rows: (string | number)[][] = [
      ['Summary', '', 'Total Income', data.summary.totalIncome],
      ['Summary', '', 'Total Expense', data.summary.totalExpense],
      ['Summary', '', 'Net Profit', data.summary.netProfit],
      ['Summary', '', 'Estimated Tax', data.summary.estimatedTax],
      ...data.incomeBreakdown.map(a => ['Income', a.code, a.name, a.amount]),
      ...data.expenseBreakdown.map(a => ['Expense', a.code, a.name, a.amount]),
    ];
    exportToExcel('IRD_Tax_Return', 'IRD_Tax_Return', headers, rows);
  };

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /><span className="ml-2 text-sm text-slate-500">Loading Tax Return…</span></div>;
  if (error) return <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>;
  if (!data) return null;

  const s = data.summary;

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">IRD Tax Return Summary (आयकर विवरण)</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Receipt className="w-3.5 h-3.5 text-slate-500" />
            Inland Revenue Department — Income Tax Summary for Cooperative
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
          <button onClick={handleExportPdf} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><Printer className="w-3.5 h-3.5" />PDF</button>
          <button onClick={handleExportExcel} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</button>
        </div>
      </div>

      {/* Org Info */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div><span className="text-slate-500 font-semibold">Cooperative</span><p className="font-bold text-slate-900">{data.organization.name}</p></div>
          <div><span className="text-slate-500 font-semibold">Registration No.</span><p className="font-bold text-slate-900">{data.organization.registrationNo}</p></div>
          <div><span className="text-slate-500 font-semibold">PAN No.</span><p className="font-bold text-slate-900">{data.organization.panNumber}</p></div>
          <div><span className="text-slate-500 font-semibold">Fiscal Year</span><p className="font-bold text-slate-900">{data.fiscalYear?.code || 'N/A'}</p></div>
        </div>
      </div>

      {/* Tax Summary */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3">Tax Summary (कर सारांश)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Total Income', value: s.totalIncome, color: 'text-emerald-700' },
            { label: 'Total Expense', value: s.totalExpense, color: 'text-rose-600' },
            { label: 'Net Profit', value: s.netProfit, color: s.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700' },
            { label: 'Taxable Income', value: s.taxableIncome, color: 'text-sky-700' },
            { label: `Tax Rate (${(s.taxRate * 100).toFixed(0)}%)`, value: s.estimatedTax, color: 'text-amber-700' },
          ].map((r, i) => (
            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-600 font-semibold">{r.label}</span>
              <span className={`font-mono font-bold ${r.color}`}>{formatNPR(r.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Income Breakdown */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3">Income Breakdown (आम्दानी विवरण)</h2>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-emerald-50 text-emerald-800 border-b border-emerald-200 text-[11px] font-semibold">
              <tr><th className="p-3">Code</th><th className="p-3">Account Name</th><th className="p-3 text-right">Amount (NPR)</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.incomeBreakdown.map((a, i) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="p-3 font-mono text-slate-600">{a.code}</td>
                  <td className="p-3 font-semibold text-slate-900">{a.name}</td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-700">{formatNPR(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Breakdown */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3">Expense Breakdown (खर्च विवरण)</h2>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-rose-50 text-rose-800 border-b border-rose-200 text-[11px] font-semibold">
              <tr><th className="p-3">Code</th><th className="p-3">Account Name</th><th className="p-3 text-right">Amount (NPR)</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.expenseBreakdown.map((a, i) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="p-3 font-mono text-slate-600">{a.code}</td>
                  <td className="p-3 font-semibold text-slate-900">{a.name}</td>
                  <td className="p-3 text-right font-mono font-bold text-rose-600">{formatNPR(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
