import React, { useState, useMemo } from 'react';
import { useCoop } from '../../../context/CoopContext';
import { Percent, Download, FileSpreadsheet, Printer, Filter } from 'lucide-react';
import { formatNPR, getTodayBS } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';
import { NepaliDatePicker } from '../../common/NepaliDatePicker';

export const SavingAccountsInterest: React.FC = () => {
  const { savingsTxnHistory } = useCoop();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo] = useState(getTodayBS());
  const [search, setSearch] = useState('');

  const interestTxns = useMemo(() => {
    let result = savingsTxnHistory.filter(t => t.type === 'Interest_Posting');
    if (dateFrom) result = result.filter(t => t.dateBS >= dateFrom);
    if (dateTo) result = result.filter(t => t.dateBS <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.accountNo.toLowerCase().includes(q) ||
        t.memberName.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => b.dateBS.localeCompare(a.dateBS));
  }, [savingsTxnHistory, dateFrom, dateTo, search]);

  const stats = useMemo(() => ({
    count: interestTxns.length,
    total: interestTxns.reduce((s, t) => s + t.amount, 0),
    avg: interestTxns.length > 0 ? interestTxns.reduce((s, t) => s + t.amount, 0) / interestTxns.length : 0,
    accounts: new Set(interestTxns.map(t => t.accountId)).size,
  }), [interestTxns]);

  const handlePrint = () => window.print();

  const handleExportPdf = () => {
    const headers = ['Date (BS)', 'Account No', 'Member Name', 'Interest Amount (NPR)', 'Balance After', 'Voucher'];
    const rows = interestTxns.map(t => [t.dateBS, t.accountNo, t.memberName, t.amount, t.balanceAfter, t.voucherNo]);
    exportToPdf('Saving_Interest_Report', 'Saving Accounts Interest Report', `Total: ${interestTxns.length} postings | NPR ${stats.total.toLocaleString()}`, headers, rows);
  };

  const handleExportExcel = () => {
    const headers = ['Date (BS)', 'Account No', 'Member Name', 'Interest Amount (NPR)', 'Balance After', 'Voucher'];
    const rows = interestTxns.map(t => [t.dateBS, t.accountNo, t.memberName, t.amount, t.balanceAfter, t.voucherNo]);
    exportToExcel('Saving_Interest_Report', 'Interest', headers, rows);
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Saving Accounts Interest Report</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Percent className="w-3.5 h-3.5 text-slate-500" />
            Interest postings credited to savings accounts with date filtering
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
          { label: 'Interest Postings', value: String(stats.count) },
          { label: 'Total Interest', value: formatNPR(stats.total) },
          { label: 'Average Posting', value: formatNPR(stats.avg) },
          { label: 'Accounts Credited', value: String(stats.accounts) },
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
        <NepaliDatePicker value={dateFrom} onChange={(bs) => setDateFrom(bs)} label="From Date" mode="dropdowns" />
        <NepaliDatePicker value={dateTo} onChange={() => {}} label="To Date" mode="dropdowns" disabled />
        <input type="text" placeholder="Search account no or member name..." value={search} onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[200px] flex-1" />
        <span className="text-[10px] text-slate-400 font-semibold">{interestTxns.length} postings</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Date (BS)</th>
                <th className="p-3">Account No</th>
                <th className="p-3">Member Name</th>
                <th className="p-3 text-right">Interest (NPR)</th>
                <th className="p-3 text-right">Balance After</th>
                <th className="p-3">Voucher No</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {interestTxns.map((t, idx) => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 text-slate-400">{idx + 1}</td>
                  <td className="p-3 font-mono text-slate-500">{t.dateBS}</td>
                  <td className="p-3 font-mono font-bold text-slate-900">{t.accountNo}</td>
                  <td className="p-3 font-bold text-slate-900">{t.memberName}</td>
                  <td className="p-3 text-right font-mono font-semibold text-violet-600">{formatNPR(t.amount)}</td>
                  <td className="p-3 text-right font-mono text-slate-600">{formatNPR(t.balanceAfter)}</td>
                  <td className="p-3 font-mono text-slate-500">{t.voucherNo}</td>
                </tr>
              ))}
              {interestTxns.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">No interest postings found for the selected period.</td></tr>
              )}
            </tbody>
            {interestTxns.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                <tr>
                  <td className="p-3" colSpan={4}>Total ({interestTxns.length} postings)</td>
                  <td className="p-3 text-right font-mono text-violet-600">{formatNPR(stats.total)}</td>
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
