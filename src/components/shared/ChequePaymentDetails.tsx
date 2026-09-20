import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, AlertTriangle } from 'lucide-react';
import { fetchBankChequeLeaves, type BankChequeLeaf } from '../../api/loanServicing';
import { fetchBankAccountDetail } from '../../api/accountingSettings';
import { getTodayBS, formatNPR, convertBSToAD } from '../../utils/nepaliCalendar';

export interface ChequePaymentData {
  chequeLeafId: string;
  chequeNumber: string;
  payeeName: string;
  chequeDateBs: string;
  chequeDateAd: string;
}

interface ChequePaymentDetailsProps {
  bankAccountId: string;
  amount: number;
  suggestedPayeeName?: string;
  onValidChange: (data: ChequePaymentData | null) => void;
}

/** Compare two BS date strings YYYY-MM-DD. Returns negative if a < b, 0 if equal, positive if a > b. */
function compareBsDates(a: string, b: string): number {
  return a.localeCompare(b);
}

export function ChequePaymentDetails({
  bankAccountId,
  amount,
  suggestedPayeeName,
  onValidChange,
}: ChequePaymentDetailsProps) {
  const [chequeLeafId, setChequeLeafId] = useState('');
  const [payeeName, setPayeeName] = useState(suggestedPayeeName ?? '');
  const [chequeDateBs, setChequeDateBs] = useState(getTodayBS());
  const [leaves, setLeaves] = useState<BankChequeLeaf[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leavesError, setLeavesError] = useState<string | null>(null);
  const [bankBalance, setBankBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Fetch available cheque leaves
  useEffect(() => {
    if (!bankAccountId) return;
    setLeavesLoading(true);
    setLeavesError(null);
    fetchBankChequeLeaves(bankAccountId)
      .then((data) => {
        setLeaves(data);
        if (data.length === 0) setLeavesError('No unused cheque leaves. Issue a cheque book first.');
      })
      .catch(() => setLeavesError('Failed to load cheque leaves.'))
      .finally(() => setLeavesLoading(false));
  }, [bankAccountId]);

  // Fetch bank balance
  useEffect(() => {
    if (!bankAccountId) return;
    setBalanceLoading(true);
    fetchBankAccountDetail(bankAccountId)
      .then((data) => setBankBalance(data.glBalance))
      .catch(() => setBankBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [bankAccountId]);

  // Sync suggestedPayeeName when it changes upstream
  useEffect(() => {
    if (suggestedPayeeName) setPayeeName(suggestedPayeeName);
  }, [suggestedPayeeName]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!chequeLeafId) e.push('Select a cheque leaf');
    if (!payeeName.trim()) e.push('Payee name is required');
    if (compareBsDates(chequeDateBs, getTodayBS()) > 0) e.push('Future dated cheques are not permitted');
    if (bankBalance !== null && amount > bankBalance) {
      e.push(`Insufficient balance. Available: ${formatNPR(bankBalance)}, Required: ${formatNPR(amount)}`);
    }
    return e;
  }, [chequeLeafId, payeeName, chequeDateBs, amount, bankBalance]);

  useEffect(() => {
    const selectedLeaf = leaves.find((l) => l.id === chequeLeafId);
    if (errors.length === 0 && selectedLeaf) {
      onValidChange({
        chequeLeafId,
        chequeNumber: selectedLeaf.chequeNumber,
        payeeName: payeeName.trim(),
        chequeDateBs,
        chequeDateAd: convertBSToAD(chequeDateBs),
      });
    } else {
      onValidChange(null);
    }
  }, [errors, chequeLeafId, payeeName, chequeDateBs, leaves]);

  return (
    <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
        <BookOpen className="w-4 h-4" /> Cheque Payment Details
      </div>

      {/* Cheque Leaf Selector */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          Registered Cheque <span className="text-red-500">*</span>
        </label>
        {leavesLoading ? (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Loading cheque leaves...
          </div>
        ) : leavesError ? (
          <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {leavesError}
          </div>
        ) : (
          <select
            value={chequeLeafId}
            onChange={(e) => setChequeLeafId(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-semibold focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
          >
            <option value="">-- Select cheque leaf --</option>
            {leaves.map((leaf) => (
              <option key={leaf.id} value={leaf.id}>
                {leaf.chequeNumber}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Payee Name */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          Payee Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={payeeName}
          onChange={(e) => setPayeeName(e.target.value)}
          className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-semibold focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
          placeholder="Enter payee name"
        />
      </div>

      {/* Cheque Date */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          Cheque Date (BS) <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={chequeDateBs}
          onChange={(e) => setChequeDateBs(e.target.value)}
          max={getTodayBS()}
          className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
        />
      </div>

      {/* Balance Hint */}
      {bankBalance !== null && (
        <div className={`text-xs font-semibold px-3 py-2 rounded-xl ${
          amount > bankBalance
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
        }`}>
          Available Balance: {formatNPR(bankBalance)}
          {amount > bankBalance && (
            <span className="ml-2 text-red-600">(Shortfall: {formatNPR(amount - bankBalance)})</span>
          )}
        </div>
      )}
      {balanceLoading && (
        <div className="text-[10px] text-slate-400">Loading balance...</div>
      )}

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700 space-y-0.5">
          {errors.map((err, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {err}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
