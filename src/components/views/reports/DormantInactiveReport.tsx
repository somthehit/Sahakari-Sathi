import React, { useState, useMemo } from 'react';
import { useCoop } from '../../../context/CoopContext';
import { Moon, Download, FileSpreadsheet, Printer, Filter, RefreshCw } from 'lucide-react';
import { formatNPR } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';

export const DormantInactiveReport: React.FC = () => {
  const { members } = useCoop();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'inactive' | 'dormant'>('all');

  const filtered = useMemo(() => {
    let result = members.filter(m => m.status === 'Inactive' || m.status === 'Terminated');
    if (typeFilter === 'inactive') result = result.filter(m => m.status === 'Inactive');
    else if (typeFilter === 'dormant') result = result.filter(m => m.status === 'Terminated');
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(m => m.fullName.toLowerCase().includes(q) || m.memberNo.toLowerCase().includes(q));
    }
    return result;
  }, [members, search, typeFilter]);

  const stats = useMemo(() => ({
    total: filtered.length,
    inactive: filtered.filter(m => m.status === 'Inactive').length,
    dormant: filtered.filter(m => m.status === 'Terminated').length,
    totalSavings: filtered.reduce((s, m) => s + m.totalSavingsBalance, 0),
    totalLoans: filtered.reduce((s, m) => s + m.totalLoanBalance, 0),
  }), [filtered]);

  const handlePrint = () => window.print();

  const handleExportPdf = () => {
    const headers = ['Member No', 'Name', 'Group', 'Phone', 'Status', 'Savings (NPR)', 'Loan (NPR)'];
    const rows = filtered.map(m => [m.memberNo, m.fullName, m.groupName || '-', m.phone, m.status, m.totalSavingsBalance, m.totalLoanBalance]);
    exportToPdf('Dormant_Inactive_Report', 'Dormant & Inactive Account Report', `Total: ${filtered.length} accounts`, headers, rows);
  };

  const handleExportExcel = () => {
    const headers = ['Member No', 'Name', 'Group', 'Phone', 'Status', 'Savings', 'Loan'];
    const rows = filtered.map(m => [m.memberNo, m.fullName, m.groupName || '-', m.phone, m.status, m.totalSavingsBalance, m.totalLoanBalance]);
    exportToExcel('Dormant_Inactive_Report', 'Dormant_Inactive', headers, rows);
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Dormant / Inactive Account Report</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Moon className="w-3.5 h-3.5 text-slate-500" />
            Members with inactive or terminated accounts requiring attention
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
          { label: 'Total Dormant/Inactive', value: String(stats.total), color: 'amber' },
          { label: 'Inactive', value: String(stats.inactive), color: 'slate' },
          { label: 'Terminated', value: String(stats.dormant), color: 'rose' },
          { label: 'Locked Savings', value: formatNPR(stats.totalSavings), color: 'violet' },
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
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
          <option value="all">All Dormant/Inactive</option>
          <option value="inactive">Inactive Only</option>
          <option value="dormant">Terminated Only</option>
        </select>
        <span className="text-[10px] text-slate-400 font-semibold">{filtered.length} accounts</span>
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
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Savings</th>
                <th className="p-3 text-right">Loan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map((m, idx) => (
                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 text-slate-400">{idx + 1}</td>
                  <td className="p-3 font-mono text-slate-500">{m.memberNo}</td>
                  <td className="p-3 font-bold text-slate-900">{m.fullName}</td>
                  <td className="p-3">{m.groupName || '-'}</td>
                  <td className="p-3 font-mono">{m.phone}</td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.status === 'Inactive' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono font-semibold text-emerald-700">{formatNPR(m.totalSavingsBalance)}</td>
                  <td className="p-3 text-right font-mono font-semibold text-amber-700">{formatNPR(m.totalLoanBalance)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400">No dormant/inactive accounts found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
