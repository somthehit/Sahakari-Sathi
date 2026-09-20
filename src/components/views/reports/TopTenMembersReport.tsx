import React, { useState, useMemo } from 'react';
import { useCoop } from '../../../context/CoopContext';
import { Trophy, Download, FileSpreadsheet, Printer, TrendingUp, PiggyBank, CreditCard, RefreshCw } from 'lucide-react';
import { formatNPR } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';

type TopCategory = 'high_saver' | 'regular_saver' | 'regular_repayer';

export const TopTenMembersReport: React.FC = () => {
  const { members } = useCoop();
  const [category, setCategory] = useState<TopCategory>('high_saver');

  const topTen = useMemo(() => {
    const sorted = [...members];
    if (category === 'high_saver') {
      sorted.sort((a, b) => b.totalSavingsBalance - a.totalSavingsBalance);
    } else if (category === 'regular_saver') {
      sorted.sort((a, b) => b.totalShares - a.totalShares);
    } else {
      sorted.sort((a, b) => {
        const aHasLoan = a.totalLoanBalance > 0 ? 1 : 0;
        const bHasLoan = b.totalLoanBalance > 0 ? 1 : 0;
        if (aHasLoan !== bHasLoan) return bHasLoan - aHasLoan;
        return b.totalSavingsBalance - a.totalSavingsBalance;
      });
    }
    return sorted.filter(m => m.status === 'Active').slice(0, 10);
  }, [members, category]);

  const categoryMeta = {
    high_saver: { label: 'Top 10 High Savers', desc: 'Members with highest savings balance', icon: PiggyBank, color: 'emerald' },
    regular_saver: { label: 'Top 10 Regular Savers', desc: 'Members with most share units (regular contributors)', icon: TrendingUp, color: 'sky' },
    regular_repayer: { label: 'Top 10 Regular Loan Repayers', desc: 'Active loan members with highest savings (good standing)', icon: CreditCard, color: 'violet' },
  };

  const meta = categoryMeta[category];
  const Icon = meta.icon;

  const handlePrint = () => window.print();

  const handleExportPdf = () => {
    const headers = ['Rank', 'Member No', 'Name', 'Group', 'Savings (NPR)', 'Shares', 'Loan (NPR)', 'Status'];
    const rows = topTen.map((m, i) => [
      `#${i + 1}`, m.memberNo, m.fullName, m.groupName || '-',
      m.totalSavingsBalance, m.totalShares, m.totalLoanBalance, m.status
    ]);
    exportToPdf('Top_10_Members', meta.label, meta.desc, headers, rows);
  };

  const handleExportExcel = () => {
    const headers = ['Rank', 'Member No', 'Name', 'Group', 'Savings', 'Shares', 'Loan', 'Status'];
    const rows = topTen.map((m, i) => [
      `#${i + 1}`, m.memberNo, m.fullName, m.groupName || '-',
      m.totalSavingsBalance, m.totalShares, m.totalLoanBalance, m.status
    ]);
    exportToExcel('Top_10_Members', 'Top_10', headers, rows);
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Top Ten Members Report</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Trophy className="w-3.5 h-3.5 text-slate-500" />
            Top performing members based on savings, regularity, and loan repayment
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"><Printer className="w-3.5 h-3.5" />Print</button>
          <button onClick={handleExportPdf} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><Download className="w-3.5 h-3.5" />PDF</button>
          <button onClick={handleExportExcel} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(categoryMeta) as TopCategory[]).map(key => {
          const cm = categoryMeta[key];
          const CIcon = cm.icon;
          return (
            <button key={key} onClick={() => setCategory(key)}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-2 ${category === key ? `bg-${cm.color}-600 text-white shadow-xs` : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <CIcon className="w-4 h-4" />
              {cm.label}
            </button>
          );
        })}
      </div>

      {/* Top 3 Podium */}
      {topTen.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {[1, 0, 2].map(rank => {
            const m = topTen[rank];
            if (!m) return <div key={rank} />;
            const medals = ['bg-yellow-400', 'bg-slate-300', 'bg-amber-600'];
            const sizes = ['h-28', 'h-24', 'h-20'];
            return (
              <div key={rank} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full ${medals[rank]} flex items-center justify-center text-white font-black text-lg mb-2 shadow-sm`}>
                  {rank === 0 ? '1' : rank === 1 ? '2' : '3'}
                </div>
                <p className="font-bold text-slate-900 text-sm truncate max-w-full">{m.fullName}</p>
                <p className="text-[10px] text-slate-500 font-mono">{m.memberNo}</p>
                <p className={`font-black text-lg mt-1 ${category === 'high_saver' ? 'text-emerald-700' : category === 'regular_saver' ? 'text-sky-700' : 'text-violet-700'}`}>
                  {category === 'regular_saver' ? `${m.totalShares} units` : formatNPR(category === 'high_saver' ? m.totalSavingsBalance : m.totalSavingsBalance)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Icon className="w-4 h-4" /> {meta.label}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
              <tr>
                <th className="p-3 w-12">Rank</th>
                <th className="p-3">Member No</th>
                <th className="p-3">Name</th>
                <th className="p-3">Group</th>
                <th className="p-3">Phone</th>
                <th className="p-3 text-right">Savings</th>
                <th className="p-3 text-right">Shares</th>
                <th className="p-3 text-right">Loan Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {topTen.map((m, i) => (
                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black ${i < 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-600'}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-500">{m.memberNo}</td>
                  <td className="p-3 font-bold text-slate-900">{m.fullName}</td>
                  <td className="p-3">{m.groupName || '-'}</td>
                  <td className="p-3 font-mono">{m.phone}</td>
                  <td className="p-3 text-right font-mono font-semibold text-emerald-700">{formatNPR(m.totalSavingsBalance)}</td>
                  <td className="p-3 text-right font-mono font-semibold text-sky-700">{m.totalShares}</td>
                  <td className="p-3 text-right font-mono font-semibold text-amber-700">{formatNPR(m.totalLoanBalance)}</td>
                </tr>
              ))}
              {topTen.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400">No active members found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
