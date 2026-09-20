import React, { useMemo } from 'react';
import { useCoop } from '../../../context/CoopContext';
import { Landmark, Download, FileSpreadsheet, Printer, TrendingUp, Users, Wallet, AlertTriangle } from 'lucide-react';
import { formatNPR } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';

export const SavingAccountsSummary: React.FC = () => {
  const { savingsAccounts, savingsTxnHistory } = useCoop();

  const stats = useMemo(() => {
    const active = savingsAccounts.filter(a => a.status === 'Active');
    const dormant = savingsAccounts.filter(a => a.status === 'Dormant');
    const closed = savingsAccounts.filter(a => a.status === 'Closed');
    const totalBalance = savingsAccounts.reduce((s, a) => s + a.balance, 0);
    const activeBalance = active.reduce((s, a) => s + a.balance, 0);

    const byProduct: Record<string, { count: number; balance: number }> = {};
    for (const a of savingsAccounts) {
      const key = a.productType || 'regular';
      if (!byProduct[key]) byProduct[key] = { count: 0, balance: 0 };
      byProduct[key].count++;
      byProduct[key].balance += a.balance;
    }

    const totalDeposits = savingsTxnHistory
      .filter(t => t.type === 'Deposit')
      .reduce((s, t) => s + t.amount, 0);
    const totalWithdrawals = savingsTxnHistory
      .filter(t => t.type === 'Withdrawal')
      .reduce((s, t) => s + t.amount, 0);
    const totalInterest = savingsTxnHistory
      .filter(t => t.type === 'Interest_Posting')
      .reduce((s, t) => s + t.amount, 0);

    return { active, dormant, closed, totalBalance, activeBalance, byProduct, totalDeposits, totalWithdrawals, totalInterest };
  }, [savingsAccounts, savingsTxnHistory]);

  const handlePrint = () => window.print();

  const handleExportPdf = () => {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Accounts', savingsAccounts.length],
      ['Active Accounts', stats.active.length],
      ['Dormant Accounts', stats.dormant.length],
      ['Closed Accounts', stats.closed.length],
      ['Total Balance (NPR)', stats.totalBalance],
      ['Active Balance (NPR)', stats.activeBalance],
      ['Total Deposits (NPR)', stats.totalDeposits],
      ['Total Withdrawals (NPR)', stats.totalWithdrawals],
      ['Total Interest Posted (NPR)', stats.totalInterest],
    ];
    exportToPdf('Saving_Accounts_Summary', 'Saving Accounts Summary Report', `Total Accounts: ${savingsAccounts.length}`, headers, rows);
  };

  const handleExportExcel = () => {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Accounts', savingsAccounts.length],
      ['Active Accounts', stats.active.length],
      ['Dormant Accounts', stats.dormant.length],
      ['Closed Accounts', stats.closed.length],
      ['Total Balance (NPR)', stats.totalBalance],
      ['Active Balance (NPR)', stats.activeBalance],
      ['Total Deposits (NPR)', stats.totalDeposits],
      ['Total Withdrawals (NPR)', stats.totalWithdrawals],
      ['Total Interest Posted (NPR)', stats.totalInterest],
    ];
    exportToExcel('Saving_Accounts_Summary', 'Summary', headers, rows);
  };

  const productLabels: Record<string, string> = {
    regular: 'Regular Savings',
    recurring: 'Recurring Deposit',
    fixed: 'Fixed Deposit',
    daily_deposit: 'Daily Deposit',
  };

  const productColors: Record<string, string> = {
    regular: 'emerald',
    recurring: 'blue',
    fixed: 'violet',
    daily_deposit: 'amber',
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Saving Accounts Summary</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Landmark className="w-3.5 h-3.5 text-slate-500" />
            Portfolio overview of all savings products and member balances
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"><Printer className="w-3.5 h-3.5" />Print</button>
          <button onClick={handleExportPdf} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><Download className="w-3.5 h-3.5" />PDF</button>
          <button onClick={handleExportExcel} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Accounts', value: String(savingsAccounts.length), icon: Users, color: 'slate' },
          { label: 'Total Balance', value: formatNPR(stats.totalBalance), icon: Wallet, color: 'emerald' },
          { label: 'Active Accounts', value: String(stats.active.length), icon: TrendingUp, color: 'blue' },
          { label: 'Dormant / Closed', value: String(stats.dormant.length + stats.closed.length), icon: AlertTriangle, color: 'amber' },
        ].map((c, i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 mb-1">
              <c.icon className={`w-4 h-4 text-${c.color}-500`} />
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{c.label}</p>
            </div>
            <p className="text-lg font-black text-slate-900 mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Transaction Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Total Deposits', value: formatNPR(stats.totalDeposits), color: 'emerald' },
          { label: 'Total Withdrawals', value: formatNPR(stats.totalWithdrawals), color: 'rose' },
          { label: 'Total Interest Posted', value: formatNPR(stats.totalInterest), color: 'violet' },
        ].map((c, i) => (
          <div key={i} className={`bg-${c.color}-50 p-4 rounded-xl border border-${c.color}-200`}>
            <p className={`text-[10px] font-semibold text-${c.color}-600 uppercase tracking-wider`}>{c.label}</p>
            <p className={`text-xl font-black text-${c.color}-800 mt-1`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Product Breakdown */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-4">Breakdown by Product Type</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
              <tr>
                <th className="p-3">Product Type</th>
                <th className="p-3 text-right">Accounts</th>
                <th className="p-3 text-right">Total Balance (NPR)</th>
                <th className="p-3 text-right">% of Portfolio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {Object.entries(stats.byProduct).map(([type, data]) => (
                <tr key={type} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 font-bold text-slate-900">
                    <span className={`inline-block w-2 h-2 rounded-full bg-${productColors[type] || 'slate'}-500 mr-2`} />
                    {productLabels[type] || type}
                  </td>
                  <td className="p-3 text-right font-mono">{data.count}</td>
                  <td className="p-3 text-right font-mono font-semibold text-emerald-700">{formatNPR(data.balance)}</td>
                  <td className="p-3 text-right font-mono">{stats.totalBalance > 0 ? ((data.balance / stats.totalBalance) * 100).toFixed(1) : '0.0'}%</td>
                </tr>
              ))}
              {Object.keys(stats.byProduct).length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-slate-400">No savings accounts found.</td></tr>
              )}
            </tbody>
            {Object.keys(stats.byProduct).length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                <tr>
                  <td className="p-3">Total</td>
                  <td className="p-3 text-right font-mono">{savingsAccounts.length}</td>
                  <td className="p-3 text-right font-mono text-emerald-700">{formatNPR(stats.totalBalance)}</td>
                  <td className="p-3 text-right font-mono">100.0%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-4">Account Status Distribution</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Active', count: stats.active.length, balance: stats.activeBalance, color: 'emerald' },
            { label: 'Dormant', count: stats.dormant.length, balance: stats.dormant.reduce((s, a) => s + a.balance, 0), color: 'amber' },
            { label: 'Closed', count: stats.closed.length, balance: stats.closed.reduce((s, a) => s + a.balance, 0), color: 'rose' },
          ].map((s, i) => (
            <div key={i} className={`p-4 rounded-xl border-2 border-${s.color}-200 bg-${s.color}-50/50`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold text-${s.color}-700`}>{s.label}</span>
                <span className={`text-lg font-black text-${s.color}-800`}>{s.count}</span>
              </div>
              <div className="text-[10px] text-slate-500">Balance: <span className={`font-bold text-${s.color}-700`}>{formatNPR(s.balance)}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
