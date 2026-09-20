import React, { useState, useMemo } from 'react';
import { useCoop } from '../../../context/CoopContext';
import { Coins, Download, FileSpreadsheet, Printer, Filter, RefreshCw } from 'lucide-react';
import { formatNPR } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';

export const DividendDistributionReport: React.FC = () => {
  const { members } = useCoop();
  const [search, setSearch] = useState('');
  const [dividendRate, setDividendRate] = useState(10);

  const eligibleMembers = useMemo(() => {
    let result = members.filter(m => m.status === 'Active' && m.totalSavingsBalance > 0);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(m => m.fullName.toLowerCase().includes(q) || m.memberNo.toLowerCase().includes(q));
    }
    return result.sort((a, b) => b.totalSavingsBalance - a.totalSavingsBalance);
  }, [members, search]);

  const dividendData = useMemo(() => {
    return eligibleMembers.map(m => ({
      ...m,
      dividend: Math.round(m.totalSavingsBalance * dividendRate / 100),
    }));
  }, [eligibleMembers, dividendRate]);

  const stats = useMemo(() => ({
    eligible: dividendData.length,
    totalDividend: dividendData.reduce((s, m) => s + m.dividend, 0),
    avgDividend: dividendData.length > 0 ? dividendData.reduce((s, m) => s + m.dividend, 0) / dividendData.length : 0,
    maxDividend: dividendData.length > 0 ? Math.max(...dividendData.map(m => m.dividend)) : 0,
  }), [dividendData]);

  const handlePrint = () => window.print();

  const handleExportPdf = () => {
    const headers = ['Member No', 'Name', 'Group', 'Savings Balance', `Dividend @${dividendRate}%`];
    const rows = dividendData.map(m => [m.memberNo, m.fullName, m.groupName || '-', m.totalSavingsBalance, m.dividend]);
    exportToPdf('Dividend_Distribution', 'Dividend Distribution Report (लाभांश वितरण)', `Rate: ${dividendRate}% | Eligible: ${dividendData.length} members`, headers, rows);
  };

  const handleExportExcel = () => {
    const headers = ['Member No', 'Name', 'Group', 'Savings Balance', `Dividend @${dividendRate}%`];
    const rows = dividendData.map(m => [m.memberNo, m.fullName, m.groupName || '-', m.totalSavingsBalance, m.dividend]);
    exportToExcel('Dividend_Distribution', 'Dividend_Distribution', headers, rows);
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Dividend Distribution Report (लाभांश विवरण)</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Coins className="w-3.5 h-3.5 text-slate-500" />
            Savings-based dividend calculation for eligible active members
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"><Printer className="w-3.5 h-3.5" />Print</button>
          <button onClick={handleExportPdf} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><Download className="w-3.5 h-3.5" />PDF</button>
          <button onClick={handleExportExcel} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Eligible Members', value: String(stats.eligible), color: 'emerald' },
          { label: 'Total Dividend', value: formatNPR(stats.totalDividend), color: 'violet' },
          { label: 'Average Dividend', value: formatNPR(stats.avgDividend), color: 'sky' },
          { label: 'Max Dividend', value: formatNPR(stats.maxDividend), color: 'amber' },
        ].map((c, i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{c.label}</p>
            <p className="text-lg font-black text-slate-900 mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Filter className="w-4 h-4 text-slate-500 shrink-0" />
        <input type="text" placeholder="Search name or member no..." value={search} onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[200px] flex-1" />
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-slate-500 font-semibold">Dividend Rate %:</label>
          <input type="number" value={dividendRate} onChange={e => setDividendRate(Number(e.target.value))} min={0} max={100}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-20" />
        </div>
        <span className="text-[10px] text-slate-400 font-semibold">{eligibleMembers.length} eligible</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Member No</th>
                <th className="p-3">Name</th>
                <th className="p-3">Group</th>
                <th className="p-3">Phone</th>
                <th className="p-3 text-right">Savings Balance</th>
                <th className="p-3 text-right">Dividend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {dividendData.map((m, idx) => (
                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 text-slate-400">{idx + 1}</td>
                  <td className="p-3 font-mono text-slate-500">{m.memberNo}</td>
                  <td className="p-3 font-bold text-slate-900">{m.fullName}</td>
                  <td className="p-3">{m.groupName || '-'}</td>
                  <td className="p-3 font-mono">{m.phone}</td>
                  <td className="p-3 text-right font-mono font-semibold text-emerald-700">{formatNPR(m.totalSavingsBalance)}</td>
                  <td className="p-3 text-right font-mono font-bold text-violet-700">{formatNPR(m.dividend)}</td>
                </tr>
              ))}
              {dividendData.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">No eligible members found.</td></tr>
              )}
            </tbody>
            {dividendData.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900">
                <tr>
                  <td colSpan={5} className="p-3 text-right">Total Dividend:</td>
                  <td className="p-3 text-right font-mono text-emerald-700">{formatNPR(dividendData.reduce((s, m) => s + m.totalSavingsBalance, 0))}</td>
                  <td className="p-3 text-right font-mono text-violet-700">{formatNPR(stats.totalDividend)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
