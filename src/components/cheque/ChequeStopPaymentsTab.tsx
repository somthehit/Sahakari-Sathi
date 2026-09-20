import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw, CheckCircle2, XCircle, Ban, Loader2,
} from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { useToast } from '../../context/ToastContext';
import { invalidateChequeRegister } from '../../lib/queryClient';
import {
  fetchStopPaymentsList, approveStopPaymentApi, rejectStopPaymentApi,
  StopPaymentRecord,
} from '../../api/chequeSettings';
import { ReasonPromptModal } from '../modals/ReasonPromptModal';

function statusPill(status: StopPaymentRecord['status']): string {
  switch (status) {
    case 'approved': return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'pending': return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'rejected': return 'bg-rose-50 text-rose-700 ring-rose-200';
    case 'cancelled':
    case 'expired': return 'bg-slate-100 text-slate-500 ring-slate-200';
    default: return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

export const ChequeStopPaymentsTab: React.FC = () => {
  const toast = useToast();
  const [rows, setRows] = useState<StopPaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<StopPaymentRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchStopPaymentsList());
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (rec: StopPaymentRecord) => {
    setBusyId(rec.id);
    try {
      await approveStopPaymentApi(rec.id);
      await invalidateChequeRegister();
      toast.showSuccess(`Stop payment ${rec.startChequeNumber}–${rec.endChequeNumber} approved.`);
      load();
    } catch (err: any) {
      toast.showError(err?.response?.data?.error || err?.message || 'Approval failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      await rejectStopPaymentApi(rejectTarget.id, reason || undefined);
      await invalidateChequeRegister();
      toast.showSuccess('Stop payment request rejected.');
      setRejectTarget(null);
      load();
    } catch (err: any) {
      toast.showError(err?.response?.data?.error || err?.message || 'Rejection failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
          <Ban size={16} className="text-amber-600" /> Stop payment instructions
        </h2>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] text-slate-500 transition hover:bg-slate-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-[11.5px] uppercase tracking-wide text-slate-400">
              <th className="px-5 py-2.5 font-medium">Account</th>
              <th className="px-5 py-2.5 font-medium">Member</th>
              <th className="px-5 py-2.5 font-medium">Range</th>
              <th className="px-5 py-2.5 font-medium">Reason</th>
              <th className="px-5 py-2.5 font-medium">Charge</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                <td className="px-5 py-3 font-mono text-slate-600">{r.accountNo}</td>
                <td className="px-5 py-3 text-slate-700">{r.memberName || '—'}</td>
                <td className="px-5 py-3 font-mono text-[12.5px] font-semibold text-emerald-700">{r.startChequeNumber}{r.endChequeNumber !== r.startChequeNumber ? `–${r.endChequeNumber}` : ''}</td>
                <td className="px-5 py-3 max-w-[240px] truncate text-slate-600" title={r.reason}>{r.reason || '—'}</td>
                <td className="px-5 py-3 font-mono text-slate-600">{formatNPR(Number(r.chargeAmount) || 0)}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${statusPill(r.status)}`}>{r.status}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  {r.status === 'pending' && (
                    <div className="inline-flex gap-1.5">
                      <button
                        onClick={() => handleApprove(r)}
                        disabled={busyId === r.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[12px] font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Approve
                      </button>
                      <button
                        onClick={() => setRejectTarget(r)}
                        disabled={busyId === r.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        <XCircle size={13} /> Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">No stop payment instructions on record.</td></tr>
            )}
          </tbody>
        </table>
        {loading && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>}
      </div>

      <ReasonPromptModal
        open={!!rejectTarget}
        title="Reject stop payment"
        description={rejectTarget ? `Cheque range ${rejectTarget.startChequeNumber}–${rejectTarget.endChequeNumber}` : undefined}
        label="Rejection reason"
        placeholder="e.g. Duplicate request — an active instruction already covers this range"
        required
        confirmLabel="Reject request"
        tone="danger"
        busy={!!busyId}
        onCancel={() => setRejectTarget(null)}
        onConfirm={handleReject}
      />
    </div>
  );
};
