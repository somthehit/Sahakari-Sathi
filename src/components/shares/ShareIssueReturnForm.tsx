import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Undo2, UserRound, Coins, AlertCircle, Loader2, CheckCircle2, Hash,
} from 'lucide-react';
import { processShareTransaction, fetchMemberShareBalance, type ShareMemberOption, type ShareTransactionResult, type ShareTransactionTypeOption } from '../../api/shares';
import type { ShareType } from '../../types/coop';
import { shareTransactionSchema, type ShareTransactionInput } from '../../lib/validations/shareTransaction';
import { formatNPR } from '../../utils/nepaliCalendar';
import { CashDenominationWidget } from './CashDenominationWidget';
import { ShareTransactionFormContainer } from './ShareTransactionFormContainer';

interface Props {
  members: ShareMemberOption[];
  shareTypes: ShareType[];
  lockedType?: ShareTransactionTypeOption;
  headerActions?: React.ReactNode;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  onSubmitted?: () => void;
  onCompleted?: (result: ShareTransactionResult) => void;
}

const EMPTY: { memberId: string; shareTypeId: string; numberOfShares: string; manualStartKitta: string; manualEndKitta: string; remarks: string } = {
  memberId: '',
  shareTypeId: '',
  numberOfShares: '1',
  manualStartKitta: '',
  manualEndKitta: '',
  remarks: '',
};

/**
 * Unified "Issue / Return Shares" form.
 * - ISSUE  -> emerald theme, "Issue New Shares"
 * - RETURN -> emerald theme, "Return Shares", live current-balance helper + ceiling validation
 * Validation is powered by the shared shareTransactionSchema (frontend refinement only;
 * the backend re-checks the authoritative balance inside the DB transaction).
 */
export const ShareIssueReturnForm: React.FC<Props> = ({ members, shareTypes, lockedType, headerActions, onSuccess, onError, onSubmitted, onCompleted }) => {
  const [transactionType, setTransactionType] = useState<ShareTransactionTypeOption>(lockedType ?? 'ISSUE');
  const [form, setForm] = useState(EMPTY);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [denomOpen, setDenomOpen] = useState(false);

  const isReturn = (lockedType ?? transactionType) === 'RETURN';
  const isLocked = Boolean(lockedType);
  const selectedMember = useMemo(() => members.find(m => m.id === form.memberId) ?? null, [members, form.memberId]);
  const selectedType = useMemo(() => shareTypes.find(t => t.id === form.shareTypeId) ?? null, [shareTypes, form.shareTypeId]);
  const parsedShares = useMemo(() => {
    const n = Number(form.numberOfShares);
    return Number.isFinite(n) ? n : 0;
  }, [form.numberOfShares]);

  const faceValue = selectedType?.faceValue ?? 0;
  const totalAmount = parsedShares * faceValue;

  // Distinctive kitta range preview — start = next free kitta for the class
  // (respecting kittaStartBase), end = start + shares − 1. Backend re-allocates
  // under a row lock, so this is a read-only forecast shown to the operator.
  const kittaRange = useMemo(() => {
    if (!selectedType || selectedType.autoSequence === false) return null;
    const base = selectedType.kittaStartBase ?? 0;
    const pointer = selectedType.currentKittaPointer ?? 0;
    const start = Math.max(pointer + 1, base);
    const qty = Math.max(Math.floor(parsedShares), 0);
    return { startKitta: start, endKitta: start + qty - 1, prefix: selectedType.kittaPrefix ?? '' };
  }, [selectedType, parsedShares]);
  const showKittaPreview = !isReturn && kittaRange !== null && parsedShares > 0;

  // Reactively fetch the member's current share balance from the DB for RETURN mode.
  useEffect(() => {
    let cancelled = false;
    if (!isReturn || !form.memberId || !form.shareTypeId) {
      setCurrentBalance(null);
      return;
    }
    setBalanceLoading(true);
    fetchMemberShareBalance(form.memberId, form.shareTypeId)
      .then(balance => { if (!cancelled) setCurrentBalance(balance); })
      .catch(() => { if (!cancelled) setCurrentBalance(null); })
      .finally(() => { if (!cancelled) setBalanceLoading(false); });
    return () => { cancelled = true; };
  }, [isReturn, form.memberId, form.shareTypeId]);

  const setField = useCallback(<K extends keyof typeof EMPTY>(key: K, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setFieldErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSubmitError(null);
  }, []);

  const switchType = (next: ShareTransactionTypeOption) => {
    if (isLocked) return;
    setTransactionType(next);
    setFieldErrors({});
    setSubmitError(null);
  };

  const effectiveType = lockedType ?? transactionType;

  const validate = useCallback((): ShareTransactionInput | null => {
    const isManual = selectedType?.autoSequence === false && effectiveType === 'ISSUE';
    const raw = {
      transactionType: effectiveType,
      memberId: form.memberId,
      shareTypeId: form.shareTypeId,
      numberOfShares: form.numberOfShares,
      memberCurrentBalance: isReturn ? (currentBalance ?? 0) : undefined,
      manualStartKitta: isManual && form.manualStartKitta ? Number(form.manualStartKitta) : undefined,
      manualEndKitta: isManual && form.manualEndKitta ? Number(form.manualEndKitta) : undefined,
      remarks: form.remarks.trim() || undefined,
    };
    const parsed = shareTransactionSchema.safeParse(raw);
    if (!parsed.success) {
      const issues: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? 'form';
        if (!issues[key]) issues[key] = issue.message;
      }
      setFieldErrors(issues);
      if (!issues.memberId && !issues.shareTypeId && !issues.numberOfShares) {
        setSubmitError(issues.form ?? 'Please fix the highlighted fields');
      }
      return null;
    }
    setFieldErrors({});
    return parsed.data;
  }, [effectiveType, form, isReturn, currentBalance, selectedType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const data = validate();
    if (!data) return;

    const isManual = selectedType?.autoSequence === false && effectiveType === 'ISSUE';
    setSubmitting(true);
    try {
      const result = await processShareTransaction({
        transactionType: data.transactionType,
        memberId: data.memberId,
        shareTypeId: data.shareTypeId,
        numberOfShares: data.numberOfShares,
        remarks: data.remarks,
        manualStartKitta: isManual ? data.manualStartKitta ?? null : null,
        manualEndKitta: isManual ? data.manualEndKitta ?? null : null,
      });
      const verb = data.transactionType === 'RETURN' ? 'Returned' : 'Issued';
      onSuccess?.(`${verb} ${result.numberOfShares} shares to ${result.memberName} — Voucher ${result.voucherNo}${result.certificateNo ? `, Certificate ${result.certificateNo}` : ''}`);
      setForm(EMPTY);
      setCurrentBalance(null);
      onSubmitted?.();
      onCompleted?.(result);
    } catch (err: any) {
      const message = err?.response?.data?.error ?? err?.message ?? 'Transaction failed';
      setSubmitError(message);
      onError?.(message);
    } finally {
      setSubmitting(false);
    }
  };

  const accentBg = 'bg-emerald-700 hover:bg-emerald-800';
  const accentRing = 'focus:ring-emerald-600/40';
  const accentSoft = 'text-emerald-700';
  const balanceExceeded = isReturn && currentBalance !== null && parsedShares > currentBalance;

  return (
    <ShareTransactionFormContainer
      title={isReturn ? 'Return / Surrender Shares (फिर्ता)' : 'Issue New Shares (प्राप्ति)'}
      subtitle={
        isReturn
          ? 'Process share surrender or buyback for existing shareholders'
          : 'Select member and share class to issue new share certificates'
      }
      icon={isReturn ? <Undo2 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      badge={(
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isReturn ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {isReturn ? 'Refund' : 'Issue'}
        </span>
      )}
      headerActions={headerActions}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Transaction type — hidden when the parent dropdown controls it */}
        {!isLocked && (
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Transaction Type</label>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100">
              <button
                type="button"
                onClick={() => switchType('ISSUE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center justify-center gap-1.5 ${ !isReturn ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200 ' }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Issue
              </button>
              <button
                type="button"
                onClick={() => switchType('RETURN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center justify-center gap-1.5 ${ isReturn ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200 ' }`}
              >
                <Undo2 className="w-3.5 h-3.5" /> Return
              </button>
            </div>
          </div>
        )}

        {/* Member */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Member</label>
          <div className="relative">
            <UserRound className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <select
              value={form.memberId}
              onChange={e => setField('memberId', e.target.value)}
              className={`w-full pl-8 pr-3 py-2 border rounded-lg bg-white text-xs focus:outline-none focus:ring-2 ${accentRing} ${ fieldErrors.memberId ? 'border-red-400 ' : 'border-slate-200 ' }`}
            >
              <option value="">Select member...</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.fullName} ({m.memberNo})</option>
              ))}
            </select>
          </div>
          {fieldErrors.memberId && (
            <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {fieldErrors.memberId}
            </p>
          )}

          {/* Current balance helper — only in RETURN mode */}
          {isReturn && selectedMember && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-between">
              <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5" />
                Current Share Balance
              </span>
              {balanceLoading ? (
                <span className="text-[11px] text-emerald-400 animate-pulse">Loading…</span>
              ) : (
                <span className="text-xs font-bold text-emerald-800 font-mono">
                  {currentBalance ?? 0} <span className="font-normal text-emerald-500">shares</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Share class */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Share Class</label>
          <div className="relative">
            <Coins className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <select
              value={form.shareTypeId}
              onChange={e => setField('shareTypeId', e.target.value)}
              className={`w-full pl-8 pr-3 py-2 border rounded-lg bg-white text-xs focus:outline-none focus:ring-2 ${accentRing} ${ fieldErrors.shareTypeId ? 'border-red-400 ' : 'border-slate-200 ' }`}
            >
              <option value="">Select share class...</option>
              {shareTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name} — रु.{t.faceValue}/share</option>
              ))}
            </select>
          </div>
          {fieldErrors.shareTypeId && (
            <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {fieldErrors.shareTypeId}
            </p>
          )}
        </div>

        {/* Number of shares + auto-allocated Kitta range forecast */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">
              {isReturn ? 'Number of Shares to Return' : 'Number of Shares'}
            </label>
            <div className="relative">
              <Hash className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={form.numberOfShares}
                onChange={e => setField('numberOfShares', e.target.value)}
                className={`w-full pl-8 pr-3 py-2 border rounded-lg bg-white text-xs font-mono focus:outline-none focus:ring-2 ${accentRing} ${ fieldErrors.numberOfShares || balanceExceeded ? 'border-red-400 ' : 'border-slate-200 ' }`}
              />
            </div>
            {fieldErrors.numberOfShares && (
              <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {fieldErrors.numberOfShares}
              </p>
            )}
            {balanceExceeded && currentBalance !== null && (
              <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3" />
                Exceeds the member's balance of {currentBalance} shares.
              </p>
            )}
          </div>

          {showKittaPreview && kittaRange && (
            <div>
              <label className="text-[11px] font-semibold text-emerald-800 block mb-1">
                Kitta Range (स्वतः कायम कित्ता)
              </label>
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg px-3 py-2 text-xs font-mono font-bold flex justify-between items-center gap-2 min-h-[38px]">
                <span>{kittaRange.prefix}{kittaRange.startKitta} देखि {kittaRange.prefix}{kittaRange.endKitta} सम्म</span>
                <span className="text-[9px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-sans whitespace-nowrap">Auto Allocated</span>
              </div>
            </div>
          )}

          {/* Manual kitta range — required when the share class uses manual kitta numbering */}
          {!isReturn && selectedType?.autoSequence === false && (
            <div>
              <label className="text-[11px] font-semibold text-emerald-800 block mb-1">
                Kitta Range (म्यानुअल — सुरु/अन्त्य)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Hash className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    placeholder="सुरु (start)"
                    value={form.manualStartKitta}
                    onChange={e => setField('manualStartKitta', e.target.value)}
                    className={`w-full pl-8 pr-3 py-2 border rounded-lg bg-white text-xs font-mono focus:outline-none focus:ring-2 ${accentRing} ${ fieldErrors.manualStartKitta ? 'border-red-400 ' : 'border-slate-200 ' }`}
                  />
                </div>
                <div className="relative">
                  <Hash className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    placeholder="अन्त्य (end)"
                    value={form.manualEndKitta}
                    onChange={e => setField('manualEndKitta', e.target.value)}
                    className={`w-full pl-8 pr-3 py-2 border rounded-lg bg-white text-xs font-mono focus:outline-none focus:ring-2 ${accentRing} ${ fieldErrors.manualEndKitta || fieldErrors.manualStartKitta ? 'border-red-400 ' : 'border-slate-200 ' }`}
                  />
                </div>
              </div>
              {(fieldErrors.manualStartKitta || fieldErrors.manualEndKitta) && (
                <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.manualStartKitta || fieldErrors.manualEndKitta}
                </p>
              )}
              {form.manualStartKitta && form.manualEndKitta && (
                <p className="mt-1.5 text-[11px] font-mono text-slate-500">
                  कित्ता संख्या = {Number(form.manualEndKitta) - Number(form.manualStartKitta) + 1} <span className="text-slate-400">(must equal shares)</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Recap */}
        {selectedType && parsedShares > 0 && (
          <div className="px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {parsedShares} × रु.{faceValue}
            </span>
            <span className={`text-xs font-bold font-mono ${accentSoft}`}>{formatNPR(totalAmount)}</span>
          </div>
        )}

        {/* Cash Denomination (Issue = cash received, Return = cash paid out) */}
        {selectedType && parsedShares > 0 && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setDenomOpen(o => !o)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${denomOpen ? 'border-emerald-300 bg-emerald-50/60 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5" />
                {isReturn ? 'Cash Denomination (Payout)' : 'Cash Denomination (Received)'}
              </span>
              <span className="font-mono">{denomOpen ? '▴ Hide' : '▾ Show'}</span>
            </button>
            {denomOpen && (
              <CashDenominationWidget
                expectedAmount={totalAmount}
                mode={isReturn ? 'paid' : 'received'}
              />
            )}
          </div>
        )}

        {/* Remarks */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Remarks (optional)</label>
          <input
            value={form.remarks}
            onChange={e => setField('remarks', e.target.value)}
            maxLength={500}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-slate-400/40"
          />
        </div>

        {submitError && (
          <div className="bg-red-50 /40 border border-red-200 text-red-700 text-[11px] rounded-xl px-3 py-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {submitError}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={submitting || balanceExceeded}
            className={`w-full sm:w-auto px-6 py-2.5 ${accentBg} disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer inline-flex items-center justify-center gap-2`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {isReturn ? 'Returning...' : 'Issuing...'}
              </>
            ) : (
              <>
                {isReturn ? <Undo2 className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {isReturn ? 'Process Return' : 'Issue Shares'}
              </>
            )}
          </button>
        </div>
      </form>
    </ShareTransactionFormContainer>
  );
};
