import React, { useState, useEffect } from 'react';
import { useCoop } from '../../../context/CoopContext';
import { Building2, Download, FileSpreadsheet, Printer, Loader2, RefreshCw } from 'lucide-react';
import { formatNPR } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';
import { fetchDocAnnualReturn, type DocAnnualReturn } from '../../../api/regulatoryReports';

export const DocAnnualReturnPage: React.FC = () => {
  const { activeBranchId } = useCoop();
  const [data, setData] = useState<DocAnnualReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try { setLoading(true); setError(null); setData(await fetchDocAnnualReturn()); }
    catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleExportPdf = () => {
    if (!data) return;
    const s = data.summary; const fp = data.financialPosition;
    const headers = ['Parameter', 'Value (NPR)'];
    const rows = [
      ['Total Members', s.totalMembers], ['Active Members', s.activeMembers],
      ['Total Share Capital', formatNPR(s.totalShareCapital)], ['Total Savings', formatNPR(s.totalSavings)],
      ['Total Loan Outstanding', formatNPR(s.totalLoanOutstanding)], ['Active Loans', s.activeLoans],
      ['Total Assets', formatNPR(fp.totalAssets)], ['Total Liabilities', formatNPR(fp.totalLiabilities)],
      ['Total Equity', formatNPR(fp.totalEquity)], ['Total Income', formatNPR(fp.totalIncome)],
      ['Total Expense', formatNPR(fp.totalExpense)], ['Net Surplus', formatNPR(fp.netSurplus)],
    ];
    exportToPdf('DoC_Annual_Return', `${data.organization.name} — DoC Annual Return`, `FY: ${data.fiscalYear?.code || 'N/A'} | Registration: ${data.organization.registrationNo}`, headers, rows);
  };

  const handleExportExcel = () => {
    if (!data) return;
    const s = data.summary; const fp = data.financialPosition;
    const headers = ['Parameter', 'Value'];
    const rows = [
      ['Total Members', s.totalMembers], ['Active Members', s.activeMembers],
      ['Share Capital', s.totalShareCapital], ['Savings', s.totalSavings],
      ['Loan Outstanding', s.totalLoanOutstanding], ['Active Loans', s.activeLoans],
      ['Assets', fp.totalAssets], ['Liabilities', fp.totalLiabilities],
      ['Equity', fp.totalEquity], ['Income', fp.totalIncome],
      ['Expense', fp.totalExpense], ['Net Surplus', fp.netSurplus],
    ];
    exportToExcel('DoC_Annual_Return', 'DoC_Annual_Return', headers, rows);
  };

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /><span className="ml-2 text-sm text-slate-500">Loading Annual Return…</span></div>;
  if (error) return <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>;
  if (!data) return null;

  const s = data.summary; const fp = data.financialPosition;

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">DoC Annual Return (वार्षिक कारोबार विवरण)</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            Department of Cooperatives — Annual Financial Position Statement
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
          <div><span className="text-slate-500 font-semibold">Fiscal Year</span><p className="font-bold text-slate-900">{data.fiscalYear?.code || 'N/A'}</p></div>
          <div><span className="text-slate-500 font-semibold">Period</span><p className="font-bold text-slate-900">{data.fiscalYear?.startDate || ''} — {data.fiscalYear?.endDate || ''}</p></div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Members', value: String(s.totalMembers), sub: `${s.activeMembers} active`, color: 'emerald' },
          { label: 'Share Capital', value: formatNPR(s.totalShareCapital), color: 'sky' },
          { label: 'Total Savings', value: formatNPR(s.totalSavings), color: 'violet' },
          { label: 'Loan Outstanding', value: formatNPR(s.totalLoanOutstanding), sub: `${s.activeLoans} loans`, color: 'amber' },
        ].map((c, i) => (
          <div key={i} className={`bg-white p-4 rounded-xl border border-slate-200 shadow-xs`}>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{c.label}</p>
            <p className="text-lg font-black text-slate-900 mt-1">{c.value}</p>
            {c.sub && <p className="text-[10px] text-slate-400 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Financial Position */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3">Financial Position (वित्तीय अवस्था)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Total Assets (सम्पत्ति)', value: fp.totalAssets, color: 'text-emerald-700' },
            { label: 'Total Liabilities (दायित्व)', value: fp.totalLiabilities, color: 'text-rose-600' },
            { label: 'Total Equity (पुँजी)', value: fp.totalEquity, color: 'text-sky-700' },
            { label: 'Total Income (आम्दानी)', value: fp.totalIncome, color: 'text-emerald-600' },
            { label: 'Total Expense (खर्च)', value: fp.totalExpense, color: 'text-rose-500' },
            { label: 'Net Surplus (नाफा)', value: fp.netSurplus, color: fp.netSurplus >= 0 ? 'text-emerald-700' : 'text-rose-700' },
          ].map((r, i) => (
            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-600 font-semibold">{r.label}</span>
              <span className={`font-mono font-bold ${r.color}`}>{formatNPR(r.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
