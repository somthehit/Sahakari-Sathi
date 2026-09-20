import React, { useState, useMemo } from 'react';
import { useCoop } from '../../../context/CoopContext';
import { BookOpen, Download, FileSpreadsheet, Printer, Filter, Search } from 'lucide-react';
import { formatNPR } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';

export const SavingAccountsRegister: React.FC = () => {
  const { savingsAccounts } = useCoop();
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    let result = [...savingsAccounts];
    if (productFilter !== 'all') result = result.filter(a => a.productType === productFilter);
    if (statusFilter !== 'all') result = result.filter(a => a.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.accountNo.toLowerCase().includes(q) ||
        a.memberName.toLowerCase().includes(q) ||
        a.memberNo.toLowerCase().includes(q) ||
        a.productName.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => a.accountNo.localeCompare(b.accountNo));
  }, [savingsAccounts, search, productFilter, statusFilter]);

  const stats = useMemo(() => ({
    count: filtered.length,
    totalBalance: filtered.reduce((s, a) => s + a.balance, 0),
    avgBalance: filtered.length > 0 ? filtered.reduce((s, a) => s + a.balance, 0) / filtered.length : 0,
  }), [filtered]);

  const handlePrint = () => window.print();

  const handleExportPdf = () => {
    const headers = ['Account No', 'Member No', 'Member Name', 'Product', 'Type', 'Rate (%)', 'Balance (NPR)', 'Status', 'Opened (BS)'];
    const rows = filtered.map(a => [a.accountNo, a.memberNo, a.memberName, a.productName, a.productType, a.interestRate, a.balance, a.status, a.openedDateBS]);
    exportToPdf('Saving_Accounts_Register', 'Saving Accounts Register', `Total: ${filtered.length} accounts | Balance: NPR ${stats.totalBalance.toLocaleString()}`, headers, rows);
  };

  const handleExportExcel = () => {
    const headers = ['Account No', 'Member No', 'Member Name', 'Product', 'Type', 'Rate (%)', 'Balance (NPR)', 'Status', 'Opened (BS)'];
    const rows = filtered.map(a => [a.accountNo, a.memberNo, a.memberName, a.productName, a.productType, a.interestRate, a.balance, a.status, a.openedDateBS]);
    exportToExcel('Saving_Accounts_Register', 'Register', headers, rows);
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Saving Accounts Register</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            Complete listing of all savings accounts with member details
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"><Printer className="w-3.5 h-3.5" />Print</button>
          <button onClick={handleExportPdf} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><Download className="w-3.5 h-3.5" />PDF</button>
          <button onClick={handleExportExcel} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Accounts', value: String(stats.count) },
          { label: 'Total Balance', value: formatNPR(stats.totalBalance) },
          { label: 'Average Balance', value: formatNPR(stats.avgBalance) },
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
        <input type="text" placeholder="Search account no, member name, member no..." value={search} onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[220px] flex-1" />
        <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
          <option value="all">All Products</option>
          <option value="regular">Regular Savings</option>
          <option value="recurring">Recurring Deposit</option>
          <option value="fixed">Fixed Deposit</option>
          <option value="daily_deposit">Daily Deposit</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="Dormant">Dormant</option>
          <option value="Closed">Closed</option>
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
                <th className="p-3">Account No</th>
                <th className="p-3">Member No</th>
                <th className="p-3">Member Name</th>
                <th className="p-3">Product</th>
                <th className="p-3">Type</th>
                <th className="p-3 text-right">Rate (%)</th>
                <th className="p-3 text-right">Balance (NPR)</th>
                <th className="p-3">Status</th>
                <th className="p-3">Opened (BS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map((a, idx) => (
                <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 text-slate-400">{idx + 1}</td>
                  <td className="p-3 font-mono font-bold text-slate-900">{a.accountNo}</td>
                  <td className="p-3 font-mono text-slate-500">{a.memberNo}</td>
                  <td className="p-3 font-bold text-slate-900">{a.memberName}</td>
                  <td className="p-3">{a.productName}</td>
                  <td className="p-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize">
                      {a.productType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono">{a.interestRate}%</td>
                  <td className="p-3 text-right font-mono font-semibold text-emerald-700">{formatNPR(a.balance)}</td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      a.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                      a.status === 'Dormant' ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>{a.status}</span>
                  </td>
                  <td className="p-3 font-mono text-slate-500">{a.openedDateBS}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="p-8 text-center text-slate-400">No accounts found matching your filters.</td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                <tr>
                  <td className="p-3" colSpan={7}>Total ({filtered.length} accounts)</td>
                  <td className="p-3 text-right font-mono text-emerald-700">{formatNPR(stats.totalBalance)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
