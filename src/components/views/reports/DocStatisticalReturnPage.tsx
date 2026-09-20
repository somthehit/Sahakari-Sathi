import React, { useState, useEffect } from 'react';
import { BarChart3, RefreshCw, Printer, FileSpreadsheet, Loader2 } from 'lucide-react';
import { formatNPR } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';
import { fetchDocStatisticalReturn, type DocStatisticalReturn } from '../../../api/regulatoryReports';

export const DocStatisticalReturnPage: React.FC = () => {
  const [data, setData] = useState<DocStatisticalReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try { setLoading(true); setError(null); setData(await fetchDocStatisticalReturn()); }
    catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleExportPdf = () => {
    if (!data) return;
    const m = data.memberStatistics; const f = data.financialVolume; const o = data.operational;
    const headers = ['Category', 'Parameter', 'Value'];
    const rows = [
      ['Members', 'Total Members', m.totalMembers], ['Members', 'Active', m.activeMembers],
      ['Members', 'Inactive', m.inactiveMembers], ['Members', 'Pending', m.pendingMembers],
      ['Financial', 'Share Capital', formatNPR(f.totalShareCapital)], ['Financial', 'Savings', formatNPR(f.totalSavings)],
      ['Financial', 'Loan Disbursed', formatNPR(f.totalLoanDisbursed)], ['Financial', 'Outstanding Loan', formatNPR(f.outstandingLoanBalance)],
      ['Operations', 'Branches', o.totalBranches], ['Operations', 'Loan Applications', o.loanApplicationsReceived],
      ['Operations', 'Total Assets', formatNPR(o.totalAssets)], ['Operations', 'Total Liabilities', formatNPR(o.totalLiabilities)],
    ];
    exportToPdf('DoC_Statistical_Return', `${data.organization.name} — DoC Statistical Return`, `FY: ${data.fiscalYear?.code || 'N/A'}`, headers, rows);
  };

  const handleExportExcel = () => {
    if (!data) return;
    const m = data.memberStatistics; const f = data.financialVolume; const o = data.operational;
    const headers = ['Category', 'Parameter', 'Value'];
    const rows = [
      ['Members', 'Total', m.totalMembers], ['Members', 'Active', m.activeMembers],
      ['Financial', 'Share Capital', f.totalShareCapital], ['Financial', 'Savings', f.totalSavings],
      ['Financial', 'Loan Disbursed', f.totalLoanDisbursed], ['Financial', 'Outstanding', f.outstandingLoanBalance],
      ['Ops', 'Branches', o.totalBranches], ['Ops', 'Applications', o.loanApplicationsReceived],
    ];
    exportToExcel('DoC_Statistical_Return', 'DoC_Stats', headers, rows);
  };

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /><span className="ml-2 text-sm text-slate-500">Loading Statistical Return…</span></div>;
  if (error) return <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>;
  if (!data) return null;

  const m = data.memberStatistics; const f = data.financialVolume; const o = data.operational;

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">DoC Statistical Return (साधारण संख्या फा.)</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
            Department of Cooperatives — Statistical Data Summary
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
          <button onClick={handleExportPdf} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><Printer className="w-3.5 h-3.5" />PDF</button>
          <button onClick={handleExportExcel} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</button>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div><span className="text-slate-500 font-semibold">Cooperative</span><p className="font-bold text-slate-900">{data.organization.name}</p></div>
          <div><span className="text-slate-500 font-semibold">Registration No.</span><p className="font-bold text-slate-900">{data.organization.registrationNo}</p></div>
          <div><span className="text-slate-500 font-semibold">Fiscal Year</span><p className="font-bold text-slate-900">{data.fiscalYear?.code || 'N/A'}</p></div>
        </div>
      </div>

      {/* Member Statistics */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3">Member Statistics (सदस्य तथ्यांक)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Members', value: m.totalMembers, color: 'text-slate-900' },
            { label: 'Active', value: m.activeMembers, color: 'text-emerald-700' },
            { label: 'Inactive', value: m.inactiveMembers, color: 'text-rose-600' },
            { label: 'Pending', value: m.pendingMembers, color: 'text-amber-600' },
          ].map((c, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">{c.label}</p>
              <p className={`text-xl font-black ${c.color} mt-1`}>{c.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Financial Volume */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3">Financial Volume (वित्तीय कारोबार)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Total Share Capital', value: formatNPR(f.totalShareCapital), sub: `${f.shareAccountCount} accounts` },
            { label: 'Total Savings', value: formatNPR(f.totalSavings), sub: `${f.savingsAccountCount} accounts` },
            { label: 'Total Loan Disbursed', value: formatNPR(f.totalLoanDisbursed), sub: `${f.activeLoans} active loans` },
            { label: 'Outstanding Loan Balance', value: formatNPR(f.outstandingLoanBalance), color: 'text-amber-700' },
            { label: 'Total Assets', value: formatNPR(o.totalAssets), color: 'text-emerald-700' },
            { label: 'Total Liabilities', value: formatNPR(o.totalLiabilities), color: 'text-rose-600' },
          ].map((r, i) => (
            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-600 font-semibold text-[11px]">{r.label}</span>
                {r.sub && <p className="text-[10px] text-slate-400">{r.sub}</p>}
              </div>
              <span className={`font-mono font-bold text-sm ${r.color || 'text-slate-900'}`}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Operational */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3">Operational Statistics (संचालन तथ्यांक)</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-600 font-semibold">Total Branches</span>
            <span className="font-mono font-bold text-slate-900">{o.totalBranches}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-600 font-semibold">Loan Applications Received</span>
            <span className="font-mono font-bold text-slate-900">{o.loanApplicationsReceived}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
