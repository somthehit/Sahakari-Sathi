import React, { useState, useMemo } from 'react';
import { useCoop } from '../../../context/CoopContext';
import { FileText, Download, FileSpreadsheet, Printer, Filter, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { formatNPR, getTodayBS } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';
import { NepaliDatePicker } from '../../common/NepaliDatePicker';
import type { SavingsAccount, SavingsTransaction } from '../../../types/coop';

const CREDIT_TYPES = ['Deposit', 'Interest_Posting', 'Transfer_In'];
const DEBIT_TYPES = ['Withdrawal', 'Transfer_Out', 'Penalty'];

export const SavingAccountsStatement: React.FC = () => {
  const { savingsAccounts, savingsTxnHistory } = useCoop();
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo] = useState(getTodayBS());
  const [typeFilter, setTypeFilter] = useState('');

  const selectedAccount = useMemo(() =>
    savingsAccounts.find(a => a.id === selectedAccountId) || null,
    [savingsAccounts, selectedAccountId]
  );

  const transactions = useMemo(() => {
    if (!selectedAccountId) return [];
    let txns = savingsTxnHistory
      .filter(t => t.accountId === selectedAccountId)
      .filter(t => !dateFrom || t.dateBS >= dateFrom)
      .filter(t => !dateTo || t.dateBS <= dateTo)
      .filter(t => !typeFilter || t.type === typeFilter)
      .sort((a, b) => a.dateBS.localeCompare(b.dateBS));
    return txns;
  }, [savingsTxnHistory, selectedAccountId, dateFrom, dateTo, typeFilter]);

  const statement = useMemo(() => {
    if (!selectedAccount) return null;
    let deposits = 0;
    let withdrawals = 0;
    let interest = 0;
    for (const t of transactions) {
      if (t.type === 'Deposit') deposits += t.amount;
      else if (t.type === 'Withdrawal') withdrawals += t.amount;
      else if (t.type === 'Interest_Posting') interest += t.amount;
    }
    const closingBalance = selectedAccount.balance;
    const openingBalance = Math.round((closingBalance - deposits + withdrawals - interest) * 100) / 100;

    let running = openingBalance;
    const rows = transactions.map(t => {
      if (CREDIT_TYPES.includes(t.type)) running += t.amount;
      else if (DEBIT_TYPES.includes(t.type)) running -= t.amount;
      return { ...t, runningBalance: Math.round(running * 100) / 100 };
    });

    return { openingBalance, totalDeposits: deposits, totalWithdrawals: withdrawals, totalInterest: interest, closingBalance, rows };
  }, [selectedAccount, transactions]);

  const handlePrint = () => window.print();

  const handleExportPdf = () => {
    if (!selectedAccount || !statement) return;
    const headers = ['Date (BS)', 'Type', 'Description', 'Deposit (NPR)', 'Withdrawal (NPR)', 'Running Balance'];
    const rows = statement.rows.map(t => [
      t.dateBS,
      t.type,
      t.remarks || t.voucherNo || '-',
      CREDIT_TYPES.includes(t.type) ? t.amount : '',
      DEBIT_TYPES.includes(t.type) ? t.amount : '',
      t.runningBalance,
    ]);
    rows.push(['', '', 'Opening Balance', '', '', statement.openingBalance]);
    rows.push(['', '', 'Closing Balance', '', '', statement.closingBalance]);
    exportToPdf(`Statement_${selectedAccount.accountNo}`, `Savings Statement - ${selectedAccount.accountNo}`, `${selectedAccount.memberName} | ${selectedAccount.productName}`, headers, rows);
  };

  const handleExportExcel = () => {
    if (!selectedAccount || !statement) return;
    const headers = ['Date (BS)', 'Type', 'Description', 'Deposit (NPR)', 'Withdrawal (NPR)', 'Running Balance'];
    const rows = statement.rows.map(t => [
      t.dateBS,
      t.type,
      t.remarks || t.voucherNo || '-',
      CREDIT_TYPES.includes(t.type) ? t.amount : '',
      DEBIT_TYPES.includes(t.type) ? t.amount : '',
      t.runningBalance,
    ]);
    exportToExcel(`Statement_${selectedAccount.accountNo}`, 'Statement', headers, rows);
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Saving Accounts Statement</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Detailed account statement with running balance for any savings account
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"><Printer className="w-3.5 h-3.5" />Print</button>
          <button onClick={handleExportPdf} disabled={!selectedAccount} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs disabled:opacity-50"><Download className="w-3.5 h-3.5" />PDF</button>
          <button onClick={handleExportExcel} disabled={!selectedAccount} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs disabled:opacity-50"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</button>
        </div>
      </div>

      {/* Account Selector & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Filter className="w-4 h-4 text-slate-500 shrink-0" />
        <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[280px]">
          <option value="">-- Select Savings Account --</option>
          {savingsAccounts
            .filter(a => a.status === 'Active')
            .sort((a, b) => a.accountNo.localeCompare(b.accountNo))
            .map(a => (
              <option key={a.id} value={a.id}>{a.accountNo} - {a.memberName} ({a.productName})</option>
            ))}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
          <option value="">All Transaction Types</option>
          <option value="Deposit">Deposit</option>
          <option value="Withdrawal">Withdrawal</option>
          <option value="Interest_Posting">Interest Posting</option>
          <option value="Transfer_In">Transfer In</option>
          <option value="Transfer_Out">Transfer Out</option>
        </select>
        <NepaliDatePicker value={dateFrom} onChange={(bs) => setDateFrom(bs)} label="From" mode="dropdowns" />
        <NepaliDatePicker value={dateTo} onChange={() => {}} label="To" mode="dropdowns" disabled />
      </div>

      {selectedAccount && statement && (
        <>
          {/* Account Info Card */}
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-5 rounded-2xl text-white shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="text-xs text-emerald-100 font-semibold">Account Statement</div>
                <div className="text-xl font-black mt-1">{selectedAccount.accountNo}</div>
                <div className="text-xs text-emerald-100 mt-1">{selectedAccount.memberName} ({selectedAccount.memberNo})</div>
                <div className="text-xs text-emerald-200 mt-0.5">{selectedAccount.productName} | Rate: {selectedAccount.interestRate}%</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-emerald-100">Current Balance</div>
                <div className="text-2xl font-black">{formatNPR(selectedAccount.balance)}</div>
                <div className="text-[10px] text-emerald-200 mt-1">Status: {selectedAccount.status}</div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Opening Balance', value: formatNPR(statement.openingBalance), color: 'slate' },
              { label: 'Total Deposits', value: formatNPR(statement.totalDeposits), color: 'emerald' },
              { label: 'Total Withdrawals', value: formatNPR(statement.totalWithdrawals), color: 'rose' },
              { label: 'Interest Earned', value: formatNPR(statement.totalInterest), color: 'violet' },
              { label: 'Closing Balance', value: formatNPR(statement.closingBalance), color: 'blue' },
            ].map((c, i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{c.label}</p>
                <p className="text-lg font-black text-slate-900 mt-1">{c.value}</p>
              </div>
            ))}
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Transaction History ({transactions.length} entries)</h2>
              <div className="flex items-center gap-1 text-[10px]">
                <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Credit</span>
                <span className="text-slate-300 mx-1">|</span>
                <ArrowUpRight className="w-3 h-3 text-rose-600" />
                <span className="text-rose-700 font-semibold">Debit</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Date (BS)</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Deposit</th>
                    <th className="p-3 text-right">Withdrawal</th>
                    <th className="p-3 text-right">Running Balance</th>
                    <th className="p-3">Payment Mode</th>
                    <th className="p-3">Voucher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {statement.rows.map((t, idx) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono text-slate-500">{t.dateBS}</td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          t.type === 'Deposit' ? 'bg-emerald-100 text-emerald-800' :
                          t.type === 'Withdrawal' ? 'bg-rose-100 text-rose-800' :
                          t.type === 'Interest_Posting' ? 'bg-violet-100 text-violet-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>{t.type}</span>
                      </td>
                      <td className="p-3">{t.remarks || t.voucherNo || '-'}</td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-700">
                        {CREDIT_TYPES.includes(t.type) ? formatNPR(t.amount) : ''}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-rose-600">
                        {DEBIT_TYPES.includes(t.type) ? formatNPR(t.amount) : ''}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">{formatNPR(t.runningBalance)}</td>
                      <td className="p-3">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{t.paymentMode}</span>
                      </td>
                      <td className="p-3 font-mono text-slate-500">{t.voucherNo}</td>
                    </tr>
                  ))}
                  {statement.rows.length === 0 && (
                    <tr><td colSpan={9} className="p-8 text-center text-slate-400">No transactions found for the selected period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!selectedAccount && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold">Select a savings account to view its statement</p>
          <p className="text-xs text-slate-300 mt-1">Choose an account from the dropdown above</p>
        </div>
      )}
    </div>
  );
};
