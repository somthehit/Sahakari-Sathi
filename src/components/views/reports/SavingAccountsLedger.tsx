import React, { useState, useMemo } from 'react';
import { useCoop } from '../../../context/CoopContext';
import { BookMarked, Download, FileSpreadsheet, Printer, Filter, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { formatNPR, getTodayBS } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';
import { NepaliDatePicker } from '../../common/NepaliDatePicker';
import type { SavingsAccount, SavingsTransaction } from '../../../types/coop';

const CREDIT_TYPES = ['Deposit', 'Interest_Posting', 'Transfer_In'];
const DEBIT_TYPES = ['Withdrawal', 'Transfer_Out', 'Penalty'];

interface AccountLedgerEntry {
  account: SavingsAccount;
  transactions: SavingsTransaction[];
  openingBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalInterest: number;
}

export const SavingAccountsLedger: React.FC = () => {
  const { savingsAccounts, savingsTxnHistory } = useCoop();
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo] = useState(getTodayBS());
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);

  const ledgers = useMemo(() => {
    let accounts = [...savingsAccounts];
    if (productFilter !== 'all') accounts = accounts.filter(a => a.productType === productFilter);
    if (search) {
      const q = search.toLowerCase();
      accounts = accounts.filter(a =>
        a.accountNo.toLowerCase().includes(q) ||
        a.memberName.toLowerCase().includes(q) ||
        a.memberNo.toLowerCase().includes(q)
      );
    }

    return accounts.map(account => {
      let txns = savingsTxnHistory
        .filter(t => t.accountId === account.id)
        .filter(t => !dateFrom || t.dateBS >= dateFrom)
        .filter(t => !dateTo || t.dateBS <= dateTo)
        .sort((a, b) => a.dateBS.localeCompare(b.dateBS));

      let deposits = 0;
      let withdrawals = 0;
      let interest = 0;
      for (const t of txns) {
        if (t.type === 'Deposit') deposits += t.amount;
        else if (t.type === 'Withdrawal') withdrawals += t.amount;
        else if (t.type === 'Interest_Posting') interest += t.amount;
      }

      const closingBalance = account.balance;
      const openingBalance = Math.round((closingBalance - deposits + withdrawals - interest) * 100) / 100;

      return {
        account,
        transactions: txns,
        openingBalance,
        totalDeposits: deposits,
        totalWithdrawals: withdrawals,
        totalInterest: interest,
      } as AccountLedgerEntry;
    }).sort((a, b) => a.account.accountNo.localeCompare(b.account.accountNo));
  }, [savingsAccounts, savingsTxnHistory, search, productFilter, dateFrom, dateTo]);

  const grandTotal = useMemo(() => ({
    accounts: ledgers.length,
    openingBalance: ledgers.reduce((s, l) => s + l.openingBalance, 0),
    deposits: ledgers.reduce((s, l) => s + l.totalDeposits, 0),
    withdrawals: ledgers.reduce((s, l) => s + l.totalWithdrawals, 0),
    interest: ledgers.reduce((s, l) => s + l.totalInterest, 0),
    closingBalance: ledgers.reduce((s, l) => s + l.account.balance, 0),
  }), [ledgers]);

  const handlePrint = () => window.print();

  const handleExportPdf = () => {
    const headers = ['Account No', 'Member No', 'Member Name', 'Opening Bal', 'Deposits', 'Withdrawals', 'Interest', 'Closing Bal'];
    const rows = ledgers.map(l => [l.account.accountNo, l.account.memberNo, l.account.memberName, l.openingBalance, l.totalDeposits, l.totalWithdrawals, l.totalInterest, l.account.balance]);
    rows.push(['TOTAL', '', '', grandTotal.openingBalance, grandTotal.deposits, grandTotal.withdrawals, grandTotal.interest, grandTotal.closingBalance]);
    exportToPdf('Saving_Ledger_Report', 'Saving Accounts Ledger', `Total: ${ledgers.length} accounts`, headers, rows);
  };

  const handleExportExcel = () => {
    const headers = ['Account No', 'Member No', 'Member Name', 'Opening Bal', 'Deposits', 'Withdrawals', 'Interest', 'Closing Bal'];
    const rows = ledgers.map(l => [l.account.accountNo, l.account.memberNo, l.account.memberName, l.openingBalance, l.totalDeposits, l.totalWithdrawals, l.totalInterest, l.account.balance]);
    rows.push(['TOTAL', '', '', grandTotal.openingBalance, grandTotal.deposits, grandTotal.withdrawals, grandTotal.interest, grandTotal.closingBalance]);
    exportToExcel('Saving_Ledger_Report', 'Ledger', headers, rows);
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Saving Accounts Ledger</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <BookMarked className="w-3.5 h-3.5 text-slate-500" />
            Per-account ledger with opening/closing balances and transaction breakdown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"><Printer className="w-3.5 h-3.5" />Print</button>
          <button onClick={handleExportPdf} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><Download className="w-3.5 h-3.5" />PDF</button>
          <button onClick={handleExportExcel} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</button>
        </div>
      </div>

      {/* Grand Total Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Accounts', value: String(grandTotal.accounts) },
          { label: 'Opening Balance', value: formatNPR(grandTotal.openingBalance) },
          { label: 'Total Deposits', value: formatNPR(grandTotal.deposits) },
          { label: 'Total Withdrawals', value: formatNPR(grandTotal.withdrawals) },
          { label: 'Closing Balance', value: formatNPR(grandTotal.closingBalance) },
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
        <input type="text" placeholder="Search account no, member name..." value={search} onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[220px] flex-1" />
        <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
          <option value="all">All Products</option>
          <option value="regular">Regular Savings</option>
          <option value="recurring">Recurring Deposit</option>
          <option value="fixed">Fixed Deposit</option>
          <option value="daily_deposit">Daily Deposit</option>
        </select>
        <NepaliDatePicker value={dateFrom} onChange={(bs) => setDateFrom(bs)} label="From" mode="dropdowns" />
        <NepaliDatePicker value={dateTo} onChange={() => {}} label="To" mode="dropdowns" disabled />
        <span className="text-[10px] text-slate-400 font-semibold">{ledgers.length} accounts</span>
      </div>

      {/* Ledger Cards */}
      <div className="space-y-3">
        {ledgers.map(ledger => {
          const isExpanded = expandedAccount === ledger.account.id;
          return (
            <div key={ledger.account.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedAccount(isExpanded ? null : ledger.account.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/80 transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-mono font-bold text-slate-900">{ledger.account.accountNo}</div>
                    <div className="text-[10px] text-slate-500">{ledger.account.memberName} ({ledger.account.memberNo})</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize">
                    {ledger.account.productType.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">Deposits</div>
                    <div className="font-mono font-semibold text-emerald-700">{formatNPR(ledger.totalDeposits)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">Withdrawals</div>
                    <div className="font-mono font-semibold text-rose-600">{formatNPR(ledger.totalWithdrawals)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">Balance</div>
                    <div className="font-mono font-bold text-slate-900">{formatNPR(ledger.account.balance)}</div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[10px]">
                        <tr>
                          <th className="p-2.5">Date (BS)</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5 text-right">Amount (NPR)</th>
                          <th className="p-2.5 text-right">Balance After</th>
                          <th className="p-2.5">Voucher</th>
                          <th className="p-2.5">Payment Mode</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ledger.transactions.length === 0 && (
                          <tr><td colSpan={6} className="p-4 text-center text-slate-400">No transactions in this period.</td></tr>
                        )}
                        {ledger.transactions.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50/60">
                            <td className="p-2.5 font-mono text-slate-500">{t.dateBS}</td>
                            <td className="p-2.5">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                t.type === 'Deposit' ? 'bg-emerald-100 text-emerald-800' :
                                t.type === 'Withdrawal' ? 'bg-rose-100 text-rose-800' :
                                t.type === 'Interest_Posting' ? 'bg-violet-100 text-violet-800' :
                                'bg-slate-100 text-slate-700'
                              }`}>{t.type}</span>
                            </td>
                            <td className={`p-2.5 text-right font-mono font-semibold ${
                              CREDIT_TYPES.includes(t.type) ? 'text-emerald-700' : 'text-rose-600'
                            }`}>{formatNPR(t.amount)}</td>
                            <td className="p-2.5 text-right font-mono text-slate-600">{formatNPR(t.balanceAfter)}</td>
                            <td className="p-2.5 font-mono text-slate-500">{t.voucherNo}</td>
                            <td className="p-2.5">{t.paymentMode}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-[10px]">
                        <tr>
                          <td className="p-2.5" colSpan={2}>Opening: {formatNPR(ledger.openingBalance)} | Closing: {formatNPR(ledger.account.balance)}</td>
                          <td className="p-2.5 text-right font-mono" colSpan={4}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {ledgers.length === 0 && (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">No accounts found matching your filters.</div>
        )}
      </div>
    </div>
  );
};
