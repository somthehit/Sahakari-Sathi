import React, { useState, useEffect } from 'react';
import { Coins, Download, FileSpreadsheet, Printer, Loader2, RefreshCw, Filter } from 'lucide-react';
import { formatNPR } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';
import { fetchShareRegister, fetchShareSummary, type ShareRegisterRow, type ShareDashboardSummary } from '../../../api/shares';

export const ShareDividendReport: React.FC = () => {
  const [data, setData] = useState<ShareRegisterRow[]>([]);
  const [summary, setSummary] = useState<ShareDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dividendRate, setDividendRate] = useState(0);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [register, sum] = await Promise.all([fetchShareRegister(), fetchShareSummary()]);
      setData(register);
      setSummary(sum);
      if (sum) setDividendRate(sum.dividendRate);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = data.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.memberName.toLowerCase().includes(q) || r.memberNo.toLowerCase().includes(q);
  });

  const dividendData = filtered.map(r => ({
    ...r,
    dividend: Math.round(r.totalCapital * dividendRate / 100),
  }));

  const stats = {
    totalMembers: dividendData.length,
    totalCapital: dividendData.reduce((s, r) => s + r.totalCapital, 0),
    totalDividend: dividendData.reduce((s, r) => s + r.dividend, 0),
    avgDividend: dividendData.length > 0 ? Math.round(dividendData.reduce((s, r) => s + r.dividend, 0) / dividendData.length) : 0,
  };

  const handlePrint = () => window.print();

  const handleExportPdf = () => {
    const headers = ['Account No', 'Member No', 'Name', 'Total Shares', 'Capital (NPR)', `Dividend @${dividendRate}%`];
    const rows = dividendData.map(r => [r.accountNo, r.memberNo, r.memberName, r.totalShares, r.totalCapital, r.dividend]);
    exportToPdf('Share_Dividend_Report', 'Share Dividend Distribution Report (शेयर लाभांश)', `Rate: ${dividendRate}% | Eligible: ${dividendData.length} members`, headers, rows);
  };

  const handleExportExcel = () => {
    const headers = ['Account No', 'Member No', 'Name', 'Total Shares', 'Capital', `Dividend @${dividendRate}%`];
    const rows = dividendData.map(r => [r.accountNo, r.memberNo, r.memberName, r.totalShares, r.totalCapital, r.dividend]);
    exportToExcel('Share_Dividend_Report', 'Share_Dividend', headers, rows);
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Share Dividend Report (शेयर लाभांश)</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Coins className="w-3.5 h-3.5 text-slate-500" />
            Dividend distribution based on share capital at configurable rate
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
          <button onClick={handlePrint} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"><Printer className="w-3.5 h-3.5" />Print</button>
          <button onClick={handleExportPdf} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><Download className="w-3.5 h-3.5" />PDF</button>
          <button onClick={handleExportExcel} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /><span className="ml-2 text-sm text-slate-500">Loading Share Dividend…</span></div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Eligible Members', value: String(stats.totalMembers), color: 'emerald' },
              { label: 'Total Share Capital', value: formatNPR(stats.totalCapital), color: 'sky' },
              { label: 'Total Dividend', value: formatNPR(stats.totalDividend), color: 'violet' },
              { label: 'Avg Dividend/Member', value: formatNPR(stats.avgDividend), color: 'amber' },
            ].map((c, i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{c.label}</p>
                <p className="text-lg font-black text-slate-900 mt-1">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <input type="text" placeholder="Search member name or no..." value={search} onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[200px] flex-1" />
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-slate-500 font-semibold">Dividend Rate %:</label>
              <input type="number" value={dividendRate} onChange={e => setDividendRate(Number(e.target.value))} min={0} max={100}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-20" />
            </div>
            <span className="text-[10px] text-slate-400 font-semibold">{dividendData.length} members</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Account No</th>
                    <th className="p-3">Member No</th>
                    <th className="p-3">Member Name</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Total Shares</th>
                    <th className="p-3 text-right">Capital (NPR)</th>
                    <th className="p-3 text-right">Dividend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {dividendData.map((r, idx) => (
                    <tr key={r.accountId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono text-slate-500">{r.accountNo}</td>
                      <td className="p-3 font-mono text-slate-500">{r.memberNo}</td>
                      <td className="p-3 font-bold text-slate-900">{r.memberName}</td>
                      <td className="p-3">{r.membershipType}</td>
                      <td className="p-3 text-right font-mono font-semibold text-sky-700">{r.totalShares.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-700">{formatNPR(r.totalCapital)}</td>
                      <td className="p-3 text-right font-mono font-bold text-violet-700">{formatNPR(r.dividend)}</td>
                    </tr>
                  ))}
                  {dividendData.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-400">No eligible members found.</td></tr>}
                </tbody>
                {dividendData.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900">
                    <tr>
                      <td colSpan={5} className="p-3 text-right">Totals:</td>
                      <td className="p-3 text-right font-mono text-sky-700">{dividendData.reduce((s, r) => s + r.totalShares, 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-mono text-emerald-700">{formatNPR(stats.totalCapital)}</td>
                      <td className="p-3 text-right font-mono text-violet-700">{formatNPR(stats.totalDividend)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
