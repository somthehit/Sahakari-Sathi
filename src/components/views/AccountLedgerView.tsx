import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Loader2,
  FileSpreadsheet,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { ExpandableFormCard } from '../common/ExpandableFormCard';
import {
  lookupAccount,
  fetchLedger,
  exportLedger,
  LedgerResponse,
  AccountLookup,
} from '../../api/savingsDeposits';

const TXN_TYPES = ['all', 'deposit', 'withdrawal', 'interest', 'charge', 'transfer'] as const;

export const AccountLedgerView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<AccountLookup[]>([]);
  const [accountId, setAccountId] = useState('');
  const [accountLabel, setAccountLabel] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [txnType, setTxnType] = useState<typeof TXN_TYPES[number]>('all');
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function selectAccount(acc?: AccountLookup) {
    if (acc) {
      setAccountId(acc.id);
      setAccountLabel(`${acc.accountNumber} — ${acc.memberName}`);
      setMatches([]);
      setQuery('');
      loadLedger(acc.id);
      return;
    }
    if (!query.trim()) return;
    try {
      const rows = await lookupAccount(query);
      setMatches(rows);
      if (rows.length === 1) selectAccount(rows[0]);
    } catch {
      setMatches([]);
    }
  }

  async function loadLedger(id = accountId) {
    if (!id) return;
    setLoading(true);
    try {
      const result = await fetchLedger(id, { from: from || undefined, to: to || undefined, txnType: txnType === 'all' ? undefined : txnType });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const typeColor: Record<string, string> = {
    deposit: 'text-emerald-700', withdrawal: 'text-rose-600', interest: 'text-blue-600',
    charge: 'text-amber-700', transfer: 'text-slate-600',
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-1">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Savings Account Ledger</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            <span>Running-balance ledger with type/date filters and PDF/Excel export</span>
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-4">
        <ExpandableFormCard
          title="Account"
          subtitle="Search by account number or member name"
          icon={<BookOpen className="w-5 h-5 text-emerald-400" />}
        >
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-emerald-500 focus:outline-none shadow-xs"
                  placeholder="Search account number or member"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), selectAccount())}
                />
              </div>
              <button className="border border-slate-300 rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => selectAccount()}>Load</button>
            </div>
            {matches.length > 1 && (
              <ul className="bg-white border border-slate-200 rounded-lg max-h-48 overflow-auto shadow-sm">
                {matches.map(m => (
                  <li key={m.id} className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm flex justify-between" onClick={() => selectAccount(m)}>
                    <span>{m.memberName} — <span className="font-mono">#{m.accountNumber}</span></span>
                    <span className="text-slate-400 font-mono text-xs">{formatNPR(m.balance)}</span>
                  </li>
                ))}
              </ul>
            )}
            {accountId && <p className="text-xs text-emerald-700 font-semibold">{accountLabel}</p>}
          </div>
        </ExpandableFormCard>

        {accountId && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="block text-xs text-slate-500">From (BS)</label>
                <input className="border border-slate-300 rounded-lg px-2.5 py-2 text-sm" value={from} onChange={e => setFrom(e.target.value)} placeholder="2083/01/01" />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-500">To (BS)</label>
                <input className="border border-slate-300 rounded-lg px-2.5 py-2 text-sm" value={to} onChange={e => setTo(e.target.value)} placeholder="2083/04/28" />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-500">Type</label>
                <select className="border border-slate-300 rounded-lg px-2.5 py-2 text-sm" value={txnType} onChange={e => setTxnType(e.target.value as any)}>
                  {TXN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <button onClick={() => loadLedger()} className="border border-emerald-600 text-emerald-700 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-emerald-50 inline-flex items-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Apply filters
              </button>
              {data && (
                <div className="ml-auto flex gap-2">
                  <button onClick={() => exportLedger(data, 'excel')} className="inline-flex items-center gap-1.5 border border-slate-300 rounded-lg px-3 py-2 text-sm text-emerald-700 font-semibold hover:bg-slate-50">
                    <FileSpreadsheet className="w-4 h-4" /> Excel
                  </button>
                  <button onClick={() => exportLedger(data, 'pdf')} className="inline-flex items-center gap-1.5 border border-slate-300 rounded-lg px-3 py-2 text-sm text-emerald-700 font-semibold hover:bg-slate-50">
                    <FileText className="w-4 h-4" /> PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {data && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <div>
                <p className="font-bold text-slate-900">{data.memberName}</p>
                <p className="text-sm text-slate-500">Account <span className="font-mono">#{data.accountNumber}</span></p>
              </div>
              <div className="text-right text-sm space-y-0.5">
                <p className="text-slate-500">Opening balance: <span className="font-mono font-semibold text-slate-700">{formatNPR(data.openingBalance)}</span></p>
                <p className="font-bold">Closing balance: <span className="font-mono text-emerald-700">{formatNPR(data.closingBalance)}</span></p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2">Date</th><th>Voucher</th><th>Particulars</th><th>Type</th>
                    <th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map(e => (
                    <tr key={e.id} className="border-b border-slate-100">
                      <td className="py-2">{e.bsDate}</td>
                      <td className="font-mono">{e.voucherNo}</td>
                      <td>{e.particulars}</td>
                      <td className={typeColor[e.txnType]}>{e.txnType}</td>
                      <td className="text-right">{e.debit ? formatNPR(e.debit) : ''}</td>
                      <td className="text-right">{e.credit ? formatNPR(e.credit) : ''}</td>
                      <td className="text-right font-mono font-semibold">{formatNPR(e.balance)}</td>
                    </tr>
                  ))}
                  {data.entries.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-slate-400">No transactions in this range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};