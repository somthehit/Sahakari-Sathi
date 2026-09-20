import React, { useState, useEffect, useMemo } from 'react';
import { Landmark, CreditCard, Banknote, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { getTodayBS, formatNPR } from '../../utils/nepaliCalendar';
import InternalChequeSelector, { type InternalChequeData } from '../shared/InternalChequeSelector';

export type RepaymentPaymentMode = 'CASH' | 'CHEQUE' | 'SAVINGS_AUTO_DEBIT';

export interface CashDenominationState {
  1000: number;
  500: number;
  100: number;
  50: number;
  20: number;
  10: number;
  5: number;
  2: number;
  1: number;
  [key: string]: number;
}

export type ChequeClearanceState = InternalChequeData;

export interface SavingsAutoDebitState {
  sourceSavingsAccountId: string;
  selectedAccount?: any;
  availableBalance: number;
}

export interface RepaymentPaymentDetailsProps {
  paymentMode: RepaymentPaymentMode;
  selectedMemberId?: string;
  selectedMemberName?: string;
  totalAmountRequired: number;
  /** The cooperative's bank account GL id to draw the cheque from. */
  bankAccountId?: string;
  // Available savings accounts to select from
  memberSavingsAccounts?: Array<{
    id: string;
    accountNo: string;
    memberId: string;
    memberName?: string;
    productName?: string;
    balance: number;
    minBalance?: number;
    status?: string;
  }>;
  // State change callbacks
  onCashChange?: (data: { denominations: CashDenominationState; totalCashCounted: number; returnChange: number; isValid: boolean }) => void;
  onChequeChange?: (data: { chequeDetails: ChequeClearanceState; isValid: boolean; error?: string }) => void;
  onSavingsAutoDebitChange?: (data: { autoDebitDetails: SavingsAutoDebitState; isValid: boolean; error?: string }) => void;
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export const DENOMINATION_NOTES: Array<keyof CashDenominationState> = [1000, 500, 100, 50, 20, 10, 5, 2, 1];

export const RepaymentPaymentDetails: React.FC<RepaymentPaymentDetailsProps> = ({
  paymentMode,
  selectedMemberId,
  selectedMemberName = '',
  totalAmountRequired = 0,
  bankAccountId = '',
  memberSavingsAccounts = [],
  onCashChange,
  onChequeChange,
  onSavingsAutoDebitChange,
  onValidationChange,
}) => {
  // Normalize payment mode
  const normalizedMode = useMemo<'CASH' | 'CHEQUE' | 'SAVINGS_AUTO_DEBIT'>(() => {
    if (paymentMode === 'CASH' || (paymentMode as string) === 'Cash') return 'CASH';
    if (paymentMode === 'CHEQUE' || (paymentMode as string) === 'Bank Transfer') return 'CHEQUE';
    return 'SAVINGS_AUTO_DEBIT';
  }, [paymentMode]);

  // -----------------------------------------------------------
  // 1. CASH DENOMINATIONS STATE
  // -----------------------------------------------------------
  const [denominations, setDenominations] = useState<CashDenominationState>({
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0,
  });

  const totalCashCounted = useMemo(() => {
    return Object.entries(denominations).reduce(
      (sum, [note, count]) => sum + Number(note) * (Number(count) || 0),
      0
    );
  }, [denominations]);

  const returnChange = totalCashCounted - totalAmountRequired;

  const handleDenominationChange = (note: keyof CashDenominationState, value: string) => {
    const parsed = Math.max(0, parseInt(value, 10) || 0);
    setDenominations((prev) => ({
      ...prev,
      [note]: parsed,
    }));
  };

  const handleAutoFillExactCash = () => {
    let remaining = Math.max(0, Math.round(totalAmountRequired));
    const newNotes: CashDenominationState = {
      1000: 0, 500: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0
    };
    for (const noteKey of DENOMINATION_NOTES) {
      const note = Number(noteKey);
      if (remaining >= note) {
        const count = Math.floor(remaining / note);
        newNotes[noteKey] = count;
        remaining = remaining % note;
      }
    }
    setDenominations(newNotes);
  };

  const handleResetCash = () => {
    setDenominations({
      1000: 0, 500: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0
    });
  };

  useEffect(() => {
    if (normalizedMode === 'CASH') {
      const isShort = totalCashCounted > 0 && returnChange < 0;
      const isValid = !isShort;
      const errorMsg = isShort ? `Cash received is short by रु ${Math.abs(returnChange).toLocaleString()}` : undefined;
      onCashChange?.({
        denominations,
        totalCashCounted,
        returnChange,
        isValid,
      });
      onValidationChange?.(isValid, errorMsg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedMode, denominations, totalCashCounted, returnChange]);

  // -----------------------------------------------------------
  // 2. CO-OPERATIVE CHEQUE — delegated to shared InternalChequeSelector
  // -----------------------------------------------------------
  const [chequeData, setChequeData] = useState<ChequeClearanceState | null>(null);

  // Compute mixed-mode validity: cheque valid AND cash covers shortfall
  const mixedChequeValidity = useMemo(() => {
    if (!chequeData) return { isValid: false, error: 'Please select a co-operative cheque leaf and fill payee details.' };
    const shortfall = chequeData.shortfall || 0;
    if (shortfall <= 0) return { isValid: true, error: undefined };
    const cashCoversShortfall = totalCashCounted >= shortfall;
    if (cashCoversShortfall) return { isValid: true, error: undefined };
    return {
      isValid: false,
      error: `Cheque covers रु ${(chequeData.chequeAmount || 0).toLocaleString()}. Enter रु ${(shortfall - totalCashCounted).toLocaleString()} more in cash denominations.`,
    };
  }, [chequeData, totalCashCounted]);

  const handleChequeValidChange = (data: ChequeClearanceState | null) => {
    setChequeData(data);
    // Don't call parent callbacks here — let the mixedChequeValidity useMemo + effect below handle it
  };

  // Notify parent when cheque validity changes (stable — only fires when mixedChequeValidity changes)
  useEffect(() => {
    onChequeChange?.({
      chequeDetails: chequeData as ChequeClearanceState,
      isValid: mixedChequeValidity.isValid,
      error: mixedChequeValidity.error,
    });
    onValidationChange?.(mixedChequeValidity.isValid, mixedChequeValidity.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixedChequeValidity.isValid, mixedChequeValidity.error]);

  // -----------------------------------------------------------
  // 3. SAVINGS AUTO-DEBIT STATE
  // -----------------------------------------------------------
  // Filter active savings accounts for the borrower
  const eligibleSavingsAccounts = useMemo(() => {
    const list = memberSavingsAccounts || [];
    const filtered = list.filter((a) => {
      const matchesMember = !selectedMemberId || a.memberId === selectedMemberId;
      const isActive = !a.status || a.status === 'Active';
      return matchesMember && isActive;
    });

    if (filtered.length > 0) return filtered;

    // Fallback sample accounts if none found in mock/store for borrower
    return [
      {
        id: 'sav_01',
        accountNo: 'SA-10291',
        memberId: selectedMemberId || 'mem_1',
        memberName: selectedMemberName || 'Borrower Member',
        productName: 'Normal Savings',
        balance: 45000,
        minBalance: 1000,
        status: 'Active',
      },
      {
        id: 'sav_02',
        accountNo: 'SA-88301',
        memberId: selectedMemberId || 'mem_1',
        memberName: selectedMemberName || 'Borrower Member',
        productName: 'Optional Savings',
        balance: 8200,
        minBalance: 500,
        status: 'Active',
      },
    ];
  }, [memberSavingsAccounts, selectedMemberId, selectedMemberName]);

  const [selectedSavingsId, setSelectedSavingsId] = useState<string>(
    eligibleSavingsAccounts[0]?.id || ''
  );

  useEffect(() => {
    if (eligibleSavingsAccounts.length > 0 && !eligibleSavingsAccounts.some((a) => a.id === selectedSavingsId)) {
      setSelectedSavingsId(eligibleSavingsAccounts[0].id);
    }
  }, [eligibleSavingsAccounts, selectedSavingsId]);

  const activeSavingsAccount = eligibleSavingsAccounts.find((a) => a.id === selectedSavingsId) || eligibleSavingsAccounts[0];
  const availableBalance = activeSavingsAccount
    ? Math.max(0, activeSavingsAccount.balance - (activeSavingsAccount.minBalance || 0))
    : 0;
  const isSufficientBalance = availableBalance >= totalAmountRequired;

  useEffect(() => {
    if (normalizedMode === 'SAVINGS_AUTO_DEBIT') {
      const isValid = Boolean(activeSavingsAccount && isSufficientBalance);
      const errorMsg = !activeSavingsAccount
        ? 'No active savings account selected for auto-debit.'
        : !isSufficientBalance
        ? 'Insufficient Savings Balance to Auto-Debit EMI'
        : undefined;

      onSavingsAutoDebitChange?.({
        autoDebitDetails: {
          sourceSavingsAccountId: activeSavingsAccount?.id || '',
          selectedAccount: activeSavingsAccount,
          availableBalance,
        },
        isValid,
        error: errorMsg,
      });
      onValidationChange?.(isValid, errorMsg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedMode, activeSavingsAccount, isSufficientBalance, availableBalance, totalAmountRequired]);

  return (
    <div className="mt-4 p-4 border border-slate-200 rounded-xl bg-slate-50/70 space-y-4 shadow-2xs">
      {/* ======================================================= */}
      {/* OPTION 1: CASH AT COUNTER (DENOMINATION COUNTER)        */}
      {/* ======================================================= */}
      {normalizedMode === 'CASH' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-emerald-600" />
              <span>Cash Denomination Breakdown</span>
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAutoFillExactCash}
                className="text-[11px] px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded-md transition cursor-pointer flex items-center gap-1"
                title="Auto-fill notes matching required EMI"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Exact Match</span>
              </button>
              <button
                type="button"
                onClick={handleResetCash}
                className="text-[11px] px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-md transition cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 text-xs">
            {DENOMINATION_NOTES.map((note) => {
              const count = denominations[note];
              const subtotal = Number(note) * (count || 0);
              return (
                <div
                  key={note}
                  className={`flex flex-col p-2 rounded-lg border transition ${
                    count > 0 ? 'bg-emerald-50/60 border-emerald-300' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-extrabold text-slate-700 text-xs">
                      रु {note}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      = रु {subtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 text-xs">×</span>
                    <input
                      type="number"
                      min="0"
                      value={denominations[note] === 0 ? '' : denominations[note]}
                      onChange={(e) => handleDenominationChange(note, e.target.value)}
                      className="w-full text-right py-1 px-2 border border-slate-300 rounded-md font-mono text-xs font-bold text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cash Calculation Summary Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="text-slate-700">Total Cash Received:</span>
              <strong className="font-mono text-emerald-800 text-sm">
                रु {totalCashCounted.toLocaleString()}
              </strong>
              {totalAmountRequired > 0 && (
                <span className="text-[11px] text-slate-500">
                  (Required: रु {totalAmountRequired.toLocaleString()})
                </span>
              )}
            </div>

            <div className="font-semibold text-xs">
              {returnChange < 0 ? (
                <span className="text-red-600 font-bold bg-red-100/70 border border-red-200 px-2.5 py-1 rounded-md flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                  Short by: रु {Math.abs(returnChange).toLocaleString()}
                </span>
              ) : returnChange > 0 ? (
                <span className="text-emerald-800 font-bold bg-emerald-100/80 border border-emerald-300 px-2.5 py-1 rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  Return Change: रु {returnChange.toLocaleString()}
                </span>
              ) : (
                <span className="text-emerald-700 font-bold bg-emerald-100/50 border border-emerald-200 px-2.5 py-1 rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Exact Cash Received
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* OPTION 2: INTERNAL CO-OPERATIVE CHEQUE                  */}
      {/* ======================================================= */}
      {normalizedMode === 'CHEQUE' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-emerald-600" />
              <span>Internal Co-operative Cheque Transfer</span>
            </h4>
            <span className="text-[11px] text-slate-500 font-medium">Member savings cheque → Loan EMI</span>
          </div>

          <InternalChequeSelector
            borrowerMemberId={selectedMemberId}
            borrowerMemberName={selectedMemberName}
            amount={totalAmountRequired}
            onValidChange={handleChequeValidChange}
          />

          {/* Cash Shortfall Section — only when cheque covers part of the amount */}
          {chequeData && chequeData.shortfall > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-amber-600" />
                  <span>Cash Shortfall Cover</span>
                </h5>
                <span className="text-[11px] text-amber-700 font-semibold">
                  Short by: रु {chequeData.shortfall.toLocaleString()}
                </span>
              </div>
              <p className="text-[10px] text-amber-700">
                Cheque covers रु {chequeData.chequeAmount.toLocaleString()}. Enter cash denominations below to cover the remaining रु {chequeData.shortfall.toLocaleString()}.
              </p>

              {/* Cash denominations for shortfall */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
                {DENOMINATION_NOTES.map((note) => {
                  const count = denominations[note];
                  const subtotal = Number(note) * (count || 0);
                  return (
                    <div
                      key={note}
                      className={`flex flex-col p-2 rounded-lg border transition ${
                        count > 0 ? 'bg-amber-50/60 border-amber-300' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-extrabold text-slate-700 text-xs">
                          रु {note}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          = रु {subtotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-xs">×</span>
                        <input
                          type="number"
                          min="0"
                          value={denominations[note] === 0 ? '' : denominations[note]}
                          onChange={(e) => handleDenominationChange(note, e.target.value)}
                          className="w-full text-right py-1 px-2 border border-slate-300 rounded-md font-mono text-xs font-bold text-slate-900 focus:border-amber-600 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cash summary */}
              <div className="flex justify-between items-center p-2 bg-amber-100/60 rounded border border-amber-200 text-xs">
                <span className="text-amber-800 font-medium">Cash Entered: <strong>रु {totalCashCounted.toLocaleString()}</strong></span>
                {totalCashCounted >= chequeData.shortfall ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Shortfall covered
                  </span>
                ) : totalCashCounted > 0 ? (
                  <span className="text-red-600 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Still short: रु {(chequeData.shortfall - totalCashCounted).toLocaleString()}
                  </span>
                ) : (
                  <span className="text-amber-600 font-medium">Enter cash denominations</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================= */}
      {/* OPTION 3: SAVINGS ACCOUNT AUTO-DEBIT                    */}
      {/* ======================================================= */}
      {normalizedMode === 'SAVINGS_AUTO_DEBIT' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Member Savings Account Auto-Debit Selection</span>
            </h4>
            <span className="text-[11px] text-slate-500 font-medium">Direct balance transfer</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Select Savings Account */}
            <div className="space-y-1">
              <label className="block text-slate-700 font-bold text-xs">
                Select Debit Savings Account <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSavingsId}
                onChange={(e) => setSelectedSavingsId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold text-xs shadow-2xs focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              >
                {eligibleSavingsAccounts.length === 0 && (
                  <option value="">-- No Active Savings Accounts Found --</option>
                )}
                {eligibleSavingsAccounts.map((a) => {
                  const avail = Math.max(0, a.balance - (a.minBalance || 0));
                  return (
                    <option key={a.id} value={a.id}>
                      {a.accountNo} ({a.productName || 'Savings'} - Avail: NPR {avail.toLocaleString()})
                    </option>
                  );
                })}
              </select>
              <span className="text-[10px] text-slate-500 block">
                Showing active savings accounts for borrower ({selectedMemberName || 'Borrower'})
              </span>
            </div>

            {/* Balance & Sufficiency Guard Display Card */}
            <div
              className={`p-3 rounded-xl border flex flex-col justify-center gap-1 ${
                isSufficientBalance
                  ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                  : 'bg-rose-50 border-rose-300 text-rose-950'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Selected Account Balance:</span>
                <strong className="font-mono text-slate-900">
                  {formatNPR(activeSavingsAccount?.balance || 0)}
                </strong>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Available for Debit:</span>
                <strong className="font-mono text-blue-900 font-extrabold">
                  {formatNPR(availableBalance)}
                </strong>
              </div>

              <div className="pt-1.5 border-t border-slate-200/60 mt-0.5 text-xs font-semibold">
                {isSufficientBalance ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ✓ Sufficient balance for EMI ({formatNPR(totalAmountRequired)})
                  </span>
                ) : (
                  <span className="text-rose-700 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    ✗ Insufficient Savings Balance to Auto-Debit EMI
                    <span className="text-[11px] font-normal text-rose-600 block">
                      (Short by {formatNPR(totalAmountRequired - availableBalance)})
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
