import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCoop } from '../../context/CoopContext';
import {
  FileText,
  Search,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  AlertCircle,
  Loader2,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
} from 'lucide-react';
import { formatNPR, getTodayBS } from '../../utils/nepaliCalendar';
import { getAccountStatement, type SavingsStatement } from '../../api/savings';
import { exportToExcel, exportToPdf } from '../../utils/exportUtils';
import { printDocumentById } from '../../utils/printDocument';
import type { SavingsAccount, SavingsTransaction } from '../../types/coop';

const CREDIT_TYPES = ['Deposit', 'Interest_Posting', 'Transfer_In'];
const DEBIT_TYPES = ['Withdrawal', 'Transfer_Out', 'Penalty'];

const TXN_TYPE_OPTIONS = [
  { value: '', label: 'All Transaction Types' },
  { value: 'Deposit', label: 'Deposit' },
  { value: 'Withdrawal', label: 'Withdrawal' },
  { value: 'Interest_Posting', label: 'Interest Posting' },
  { value: 'Transfer_In', label: 'Transfer In' },
  { value: 'Transfer_Out', label: 'Transfer Out' },
  { value: 'Penalty', label: 'Penalty' },
];

interface StatementFilters {
  dateFromBs: string;
  dateToBs: string;
  type: string;
}

/**
 * Reconstructs a ledger statement from a savings account + its transaction
 * history. Used as the offline/prototype fallback when the Express backend is
 * not connected (mirrors the server-side computation).
 */
function buildLocalStatement(
  account: SavingsAccount,
  history: SavingsTransaction[],
  filters: StatementFilters
): SavingsStatement {
  const txns = history
    .filter((t) => t.accountId === account.id)
    .filter((t) => !filters.dateFromBs || t.dateBS >= filters.dateFromBs)
    .filter((t) => !filters.dateToBs || t.dateBS <= filters.dateToBs)
    .filter((t) => !filters.type || t.type === filters.type)
    .sort((a, b) =>
      a.dateBS === b.dateBS ? a.dateAD.localeCompare(b.dateAD) : a.dateBS.localeCompare(b.dateBS)
    );

  let deposits = 0;
  let withdrawals = 0;
  for (const t of txns) {
    if (CREDIT_TYPES.includes(t.type)) deposits += t.amount;
    else if (DEBIT_TYPES.includes(t.type)) withdrawals += t.amount;
  }

  const closingBalance = account.balance;
  const openingBalance = Math.round((closingBalance - deposits + withdrawals) * 100) / 100;

  let running = openingBalance;
  const rows = txns.map((t) => {
    if (CREDIT_TYPES.includes(t.type)) running += t.amount;
    else if (DEBIT_TYPES.includes(t.type)) running -= t.amount;
    return {
      ...t,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      runningBalance: Math.round(running * 100) / 100,
    };
  });

  return {
    account,
    transactions: rows,
    openingBalance,
    totalDeposits: Math.round(deposits * 100) / 100,
    totalWithdrawals: Math.round(withdrawals * 100) / 100,
    closingBalance,
  };
}

export const AccountStatementsView: React.FC = () => {
  const { savingsAccounts = [], fiscalYears = [], activeFiscalYearCode, savingsTxnHistory = [] } = useCoop();

  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [filters, setFilters] = useState<StatementFilters>(() => ({
    dateFromBs: '',
    dateToBs: getTodayBS(),
    type: '',
  }));
  const [appliedFilters, setAppliedFilters] = useState<StatementFilters>(filters);

  const [statement, setStatement] = useState<SavingsStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'server' | 'local'>('server');

  const activeFiscalYear = useMemo(
    () => fiscalYears.find((f) => f.code === activeFiscalYearCode) || fiscalYears[0],
    [fiscalYears, activeFiscalYearCode]
  );

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return savingsAccounts
      .filter((a) => !productFilter || a.productType === productFilter)
      .filter((a) => !statusFilter || a.status === statusFilter)
      .filter(
        (a) =>
          !q ||
          a.accountNo.toLowerCase().includes(q) ||
          a.memberName.toLowerCase().includes(q) ||
          a.memberNo.toLowerCase().includes(q)
      )
      .sort((a, b) => a.accountNo.localeCompare(b.accountNo));
  }, [savingsAccounts, search, productFilter, statusFilter]);

  const selectedAccount = useMemo(
    () => savingsAccounts.find((a) => a.id === selectedAccountId) || null,
    [savingsAccounts, selectedAccountId]
  );

  const productTypes = useMemo(() => {
    const set = new Set(savingsAccounts.map((a) => a.productType));
    return [...set].sort();
  }, [savingsAccounts]);

  const loadStatement = useCallback(
    async (account: SavingsAccount, f: StatementFilters) => {
      setLoading(true);
      setError(null);
      try {
        const res = await getAccountStatement(account.id, {
          dateFromBs: f.dateFromBs || undefined,
          dateToBs: f.dateToBs || undefined,
          type: f.type || undefined,
        });
        setStatement(res);
        setSource('server');
      } catch {
        const local = buildLocalStatement(account, savingsTxnHistory, f);
        setStatement(local);
        setSource('local');
        if (local.transactions.length === 0) {
          setError('No transactions found for the selected account and period.');
        }
      } finally {
        setLoading(false);
      }
    },
    [savingsTxnHistory]
  );

  // Auto-select the first account when the list is available.
  useEffect(() => {
    if (!selectedAccountId && filteredAccounts.length > 0) {
      setSelectedAccountId(filteredAccounts[0].id);
    }
  }, [filteredAccounts, selectedAccountId]);

  // Load the statement for the selected account.
  useEffect(() => {
    if (selectedAccount) {
      loadStatement(selectedAccount, appliedFilters);
    } else {
      setStatement(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, appliedFilters]);

  const applyFilters = () => setAppliedFilters({ ...filters });

  const resetFilters = () => {
    const fresh: StatementFilters = { dateFromBs: '', dateToBs: getTodayBS(), type: '' };
    setFilters(fresh);
    setAppliedFilters(fresh);
  };

  const setFiscalYearRange = () => {
    if (!activeFiscalYear) return;
    const fresh: StatementFilters = {
      dateFromBs: activeFiscalYear.startDateBS,
      dateToBs: getTodayBS(),
      type: filters.type,
    };
    setFilters(fresh);
    setAppliedFilters(fresh);
  };

  const handleExportExcel = () => {
    if (!statement) return;
    const rows = statement.transactions.map((t, i) => [
      i + 1,
      t.dateBS,
      t.dateAD,
      t.voucherNo,
      t.remarks || t.type,
      t.paymentMode,
      CREDIT_TYPES.includes(t.type) ? t.amount : '',
      DEBIT_TYPES.includes(t.type) ? t.amount : '',
      t.runningBalance,
    ]);
    exportToExcel(
      `savings_statement_${selectedAccount?.accountNo || 'account'}`,
      'Statement',
      ['S.N.', 'Date (BS)', 'Date (AD)', 'Voucher No', 'Particulars', 'Mode', 'Deposit', 'Withdrawal', 'Balance'],
      rows
    );
  };

  const handleExportPdf = () => {
    if (!statement) return;
    const rows = statement.transactions.map((t, i) => [
      i + 1,
      t.dateBS,
      t.dateAD,
      t.voucherNo,
      t.remarks || t.type,
      t.paymentMode,
      CREDIT_TYPES.includes(t.type) ? formatNPR(t.amount) : '',
      DEBIT_TYPES.includes(t.type) ? formatNPR(t.amount) : '',
      formatNPR(t.runningBalance),
    ]);
    exportToPdf(
      `savings_statement_${selectedAccount?.accountNo || 'account'}`,
      `Account Statement - ${selectedAccount?.accountNo || ''}`,
      `${selectedAccount?.memberName || ''} | ${selectedAccount?.productName || ''} | From ${
        appliedFilters.dateFromBs || 'Beginning'
      } to ${appliedFilters.dateToBs || 'Present'} (BS)`,
      ['S.N.', 'Date (BS)', 'Date (AD)', 'Voucher No', 'Particulars', 'Mode', 'Deposit', 'Withdrawal', 'Balance'],
      rows
    );
  };

  const renderTypeBadge = (type: string) => {
    if (CREDIT_TYPES.includes(type)) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
          <ArrowDownLeft className="w-3 h-3" />
          {type.replace('_', ' ')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded font-semibold">
        <ArrowUpRight className="w-3 h-3" />
        {type.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      {/* Module Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Account Statements</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            <span>Date-wise savings ledger with running balance, exports and print for member passbook verification</span>
          </p>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Statement Date (BS): <span className="font-mono font-bold text-emerald-700">{getTodayBS()}</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
        <div className="lg:col-span-2 space-y-1">
          <label className="text-slate-600 font-semibold flex items-center gap-1">
            <Search className="w-3.5 h-3.5" /> Search Account
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="A/C No, member name or member no..."
            className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none shadow-xs"
          />
        </div>

        <div className="space-y-1">
          <label className="text-slate-600 font-semibold">Product Type</label>
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none shadow-xs"
          >
            <option value="">All Products</option>
            {productTypes.map((p) => (
              <option key={p} value={p}>
                {p.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-slate-600 font-semibold">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none shadow-xs"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Dormant">Dormant</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-slate-600 font-semibold">From (BS)</label>
          <input
            type="text"
            value={filters.dateFromBs}
            onChange={(e) => setFilters((f) => ({ ...f, dateFromBs: e.target.value }))}
            placeholder="YYYY-MM-DD"
            className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 font-mono focus:border-emerald-500 focus:outline-none shadow-xs"
          />
        </div>

        <div className="space-y-1">
          <label className="text-slate-600 font-semibold">To (BS)</label>
          <input
            type="text"
            value={filters.dateToBs}
            onChange={(e) => setFilters((f) => ({ ...f, dateToBs: e.target.value }))}
            placeholder="YYYY-MM-DD"
            className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 font-mono focus:border-emerald-500 focus:outline-none shadow-xs"
          />
        </div>

        <div className="lg:col-span-3 space-y-1">
          <label className="text-slate-600 font-semibold">Transaction Type</label>
          <select
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none shadow-xs"
          >
            {TXN_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-3 flex flex-wrap items-end gap-2">
          <button
            onClick={applyFilters}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer shadow-sm text-xs inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Load Statement
          </button>
          <button
            onClick={setFiscalYearRange}
            disabled={!activeFiscalYear}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition cursor-pointer shadow-xs text-xs border border-slate-200"
          >
            This Fiscal Year
          </button>
          <button
            onClick={resetFilters}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition cursor-pointer shadow-xs text-xs border border-slate-200"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Account List + Statement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Account List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 flex items-center justify-between">
            <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-600" />
              Member Accounts
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-semibold">
              {filteredAccounts.length} shown
            </span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[640px] divide-y divide-slate-100">
            {filteredAccounts.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500">No accounts match the current filters.</div>
            )}
            {filteredAccounts.map((a) => {
              const active = a.id === selectedAccountId;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAccountId(a.id)}
                  className={`w-full text-left px-3.5 py-3 transition cursor-pointer ${active ? 'bg-emerald-50/70 border-l-[3px] border-emerald-600' : 'border-l-[3px] border-transparent hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-sm text-emerald-700">{a.accountNo}</span>
                    <span className="text-[10px] font-semibold text-slate-500">{a.productName}</span>
                  </div>
                  <div className="text-xs text-slate-700 font-medium mt-0.5">{a.memberName}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-slate-400">{a.memberNo}</span>
                    <span className="font-mono font-bold text-xs text-slate-800">{formatNPR(a.balance)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Statement Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Account Summary */}
          {selectedAccount && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono font-bold text-lg text-emerald-700">{selectedAccount.accountNo}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-semibold">
                      {selectedAccount.status}
                    </span>
                    {source === 'local' ? (
                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-semibold">
                        Offline View (Local Ledger)
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                        Live Statement
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-slate-900">{selectedAccount.memberName}</div>
                  <div className="text-slate-500">
                    {selectedAccount.productName} | {selectedAccount.interestRate}% p.a. | Min Balance {formatNPR(selectedAccount.minBalance)} | Opened {selectedAccount.openedDateBS} BS
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Current Balance</div>
                  <div className="font-mono font-bold text-2xl text-emerald-700">{formatNPR(statement?.closingBalance ?? selectedAccount.balance)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Error / Empty */}
          {error && !loading && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-bold">No statement data</div>
                <div className="text-amber-700 mt-0.5">
                  {error} Post teller deposits / withdrawals or run the interest engine to populate the ledger, or adjust the date range.
                </div>
              </div>
            </div>
          )}

          {/* Statement Table */}
          {selectedAccount && (
            <div id="savings-statement-print" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    Ledger Statement
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Period: {appliedFilters.dateFromBs || 'Beginning'} to {appliedFilters.dateToBs || 'Present'} (BS)
                    {appliedFilters.type ? ` | Type: ${appliedFilters.type.replace('_', ' ')}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportExcel}
                    disabled={!statement || statement.transactions.length === 0}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-semibold rounded-lg transition cursor-pointer shadow-xs text-xs inline-flex items-center gap-1.5 border border-slate-200"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    Excel
                  </button>
                  <button
                    onClick={handleExportPdf}
                    disabled={!statement || statement.transactions.length === 0}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-semibold rounded-lg transition cursor-pointer shadow-xs text-xs inline-flex items-center gap-1.5 border border-slate-200"
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-500" />
                    PDF
                  </button>
                  <button
                    onClick={() => printDocumentById('savings-statement-print', `Account Statement - ${selectedAccount.accountNo}`)}
                    disabled={!statement || statement.transactions.length === 0}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-lg transition cursor-pointer shadow-sm text-xs inline-flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </button>
                </div>
              </div>

              {/* Summary Strip */}
              {statement && (
                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50/60">
                  <div className="p-3.5">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Opening Balance</div>
                    <div className="font-mono font-bold text-sm text-slate-800 mt-0.5">{formatNPR(statement.openingBalance)}</div>
                  </div>
                  <div className="p-3.5">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Deposits</div>
                    <div className="font-mono font-bold text-sm text-emerald-600 mt-0.5">{formatNPR(statement.totalDeposits)}</div>
                  </div>
                  <div className="p-3.5">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Withdrawals</div>
                    <div className="font-mono font-bold text-sm text-rose-600 mt-0.5">{formatNPR(statement.totalWithdrawals)}</div>
                  </div>
                  <div className="p-3.5">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Closing Balance</div>
                    <div className="font-mono font-bold text-sm text-emerald-700 mt-0.5">{formatNPR(statement.closingBalance)}</div>
                  </div>
                </div>
              )}

              {/* Transactions Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[10px] uppercase text-slate-500 border-b border-slate-200">
                      <th className="px-3.5 py-2.5 font-semibold">S.N.</th>
                      <th className="px-3.5 py-2.5 font-semibold">Date (BS)</th>
                      <th className="px-3.5 py-2.5 font-semibold">Date (AD)</th>
                      <th className="px-3.5 py-2.5 font-semibold">Voucher No</th>
                      <th className="px-3.5 py-2.5 font-semibold">Particulars</th>
                      <th className="px-3.5 py-2.5 font-semibold">Mode</th>
                      <th className="px-3.5 py-2.5 font-semibold text-right">Deposit</th>
                      <th className="px-3.5 py-2.5 font-semibold text-right">Withdrawal</th>
                      <th className="px-3.5 py-2.5 font-semibold text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {statement && statement.transactions.length > 0 ? (
                      statement.transactions.map((t, i) => (
                        <tr key={t.id} className="hover:bg-slate-50/70">
                          <td className="px-3.5 py-2.5 text-slate-400">{i + 1}</td>
                          <td className="px-3.5 py-2.5 font-mono font-semibold text-slate-700">{t.dateBS}</td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-500">{t.dateAD}</td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-600">{t.voucherNo}</td>
                          <td className="px-3.5 py-2.5 max-w-[220px]">
                            <div className="text-slate-700 truncate">{t.remarks || t.type}</div>
                            <div className="mt-0.5">{renderTypeBadge(t.type)}</div>
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-500">{t.paymentMode?.replace('_', ' ')}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-emerald-700 font-semibold">
                            {CREDIT_TYPES.includes(t.type) ? formatNPR(t.amount) : '-'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-rose-600 font-semibold">
                            {DEBIT_TYPES.includes(t.type) ? formatNPR(t.amount) : '-'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-800">{formatNPR(t.runningBalance)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center">
                          {loading ? (
                            <span className="inline-flex items-center gap-2 text-slate-500">
                              <Loader2 className="w-4 h-4 animate-spin" /> Loading statement...
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              No transactions in this period. Use the filter bar to change the date range.
                            </span>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer Totals */}
              {statement && statement.transactions.length > 0 && (
                <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-wrap items-center justify-end gap-6 text-xs">
                  <div className="text-slate-600">
                    Total Transactions: <span className="font-bold text-slate-900">{statement.transactions.length}</span>
                  </div>
                  <div className="text-slate-600">
                    Closing Balance: <span className="font-mono font-bold text-emerald-700">{formatNPR(statement.closingBalance)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {!selectedAccount && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center text-xs text-slate-500">
              Select an account from the list to view its statement.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
