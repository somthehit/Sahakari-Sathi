import React, { useCallback, useMemo, useState } from 'react';
import { ArrowRightLeft, AlertCircle, Loader2, CheckCircle2, UserRound, Hash, Landmark } from 'lucide-react';
import { transferShares, type ShareMemberOption } from '../../api/shares';
import type { ShareHolding, ShareTransferResult } from '../../types/coop';
import { formatNPR } from '../../utils/nepaliCalendar';
import { ShareTransactionFormContainer } from './ShareTransactionFormContainer';

interface Props {
  holdings: ShareHolding[];
  members: ShareMemberOption[];
  headerActions?: React.ReactNode;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  onSubmitted?: () => void;
  onTransferred?: (result: ShareTransferResult) => void;
}

const EMPTY: { fromHoldingId: string; toMemberId: string; numberOfShares: string; remarks: string } = {
  fromHoldingId: '',
  toMemberId: '',
  numberOfShares: '1',
  remarks: '',
};

/** Transfer shares between members — kept as a separate form beside the Issue/Return form. */
export const ShareTransferForm: React.FC<Props> = ({ holdings, members, headerActions, onSuccess, onError, onSubmitted, onTransferred }) => {
  const activeHoldings = useMemo(() => holdings.filter(h => h.status === 'Active'), [holdings]);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedHolding = useMemo(
    () => activeHoldings.find(h => h.id === form.fromHoldingId) ?? null,
    [activeHoldings, form.fromHoldingId],
  );
  const parsedShares = useMemo(() => {
    const n = Number(form.numberOfShares);
    return Number.isFinite(n) ? n : 0;
  }, [form.numberOfShares]);
  const faceValue = selectedHolding?.faceValuePerShare ?? 0;
  const totalAmount = parsedShares * faceValue;
  const exceedsBalance = selectedHolding ? parsedShares > selectedHolding.numberOfShares : false;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    const issues: Record<string, string> = {};
    if (!form.fromHoldingId) issues.fromHoldingId = 'Select the source holding';
    if (!form.toMemberId) issues.toMemberId = 'Select the receiving member';
    if (!Number.isInteger(parsedShares) || parsedShares <= 0) issues.numberOfShares = 'Number of shares must be a whole number greater than zero';
    if (selectedHolding && parsedShares > selectedHolding.numberOfShares) {
      issues.numberOfShares = `Cannot transfer more than ${selectedHolding.numberOfShares} shares`;
    }
    if (selectedHolding && form.toMemberId === selectedHolding.memberId) {
      issues.toMemberId = 'Receiver cannot be the same as the current holder';
    }
    if (Object.keys(issues).length > 0) {
      setFieldErrors(issues);
      return;
    }

    setSubmitting(true);
    try {
      const result = await transferShares({
        fromHoldingId: form.fromHoldingId,
        toMemberId: form.toMemberId,
        numberOfShares: parsedShares,
        remarks: form.remarks.trim() || undefined,
      });
      onSuccess?.(`Transferred ${result.numberOfShares} shares — Voucher ${result.voucherNo}`);
      onTransferred?.(result);
      setForm(EMPTY);
      onSubmitted?.();
    } catch (err: any) {
      const message = err?.response?.data?.error ?? err?.message ?? 'Transfer failed';
      setSubmitError(message);
      onError?.(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ShareTransactionFormContainer
      title="Transfer Shares (हस्तान्तरण)"
      subtitle="Transfer share ownership from one member to another"
      icon={<ArrowRightLeft className="w-5 h-5" />}
      badge={(
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
          Between Members
        </span>
      )}
      headerActions={headerActions}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* From holding */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">From Holding</label>
          <div className="relative">
            <Landmark className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <select
              value={form.fromHoldingId}
              onChange={e => setField('fromHoldingId', e.target.value)}
              className={`w-full pl-8 pr-3 py-2 border rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/40 ${ fieldErrors.fromHoldingId ? 'border-red-400 ' : 'border-slate-200 ' }`}
            >
              <option value="">Select source holding...</option>
              {activeHoldings.map(h => (
                <option key={h.id} value={h.id}>{h.memberName} — {h.numberOfShares} shares ({h.shareTypeName})</option>
              ))}
            </select>
          </div>
          {fieldErrors.fromHoldingId && (
            <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {fieldErrors.fromHoldingId}
            </p>
          )}
          {selectedHolding && (
            <p className="mt-1.5 text-[11px] text-emerald-700 flex items-center gap-1.5 font-medium">
              <Landmark className="w-3 h-3" />
              Source balance: <span className="font-bold font-mono">{selectedHolding.numberOfShares} shares</span> · रु.{selectedHolding.faceValuePerShare}/share
            </p>
          )}
        </div>

        {/* To member */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">To Member</label>
          <div className="relative">
            <UserRound className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <select
              value={form.toMemberId}
              onChange={e => setField('toMemberId', e.target.value)}
              className={`w-full pl-8 pr-3 py-2 border rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/40 ${ fieldErrors.toMemberId ? 'border-red-400 ' : 'border-slate-200 ' }`}
            >
              <option value="">Select receiving member...</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.fullName} ({m.memberNo})</option>
              ))}
            </select>
          </div>
          {fieldErrors.toMemberId && (
            <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {fieldErrors.toMemberId}
            </p>
          )}
        </div>

        {/* Number of shares */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Number of Shares</label>
          <div className="relative">
            <Hash className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={form.numberOfShares}
              onChange={e => setField('numberOfShares', e.target.value)}
              className={`w-full pl-8 pr-3 py-2 border rounded-lg bg-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600/40 ${ fieldErrors.numberOfShares || exceedsBalance ? 'border-red-400 ' : 'border-slate-200 ' }`}
            />
          </div>
          {fieldErrors.numberOfShares && (
            <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {fieldErrors.numberOfShares}
            </p>
          )}
        </div>

        {/* Recap */}
        {selectedHolding && parsedShares > 0 && (
          <div className="px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {parsedShares} × रु.{faceValue}
            </span>
            <span className="text-xs font-bold font-mono text-emerald-700">{formatNPR(totalAmount)}</span>
          </div>
        )}

        {/* Remarks */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Remarks (optional)</label>
          <input
            value={form.remarks}
            onChange={e => setField('remarks', e.target.value)}
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
            disabled={submitting || exceedsBalance}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer inline-flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Transferring...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> Execute Transfer
              </>
            )}
          </button>
        </div>
      </form>
    </ShareTransactionFormContainer>
  );
};
