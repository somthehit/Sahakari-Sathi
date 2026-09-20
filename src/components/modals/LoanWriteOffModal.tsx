import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { LoanAccount } from '../../types/coop';
import { submitWriteOffRequest } from '../../api/loanServicing';
import { getTodayBS } from '../../utils/nepaliCalendar';

interface LoanWriteOffModalProps {
  open: boolean;
  loan: LoanAccount | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const LoanWriteOffModal: React.FC<LoanWriteOffModalProps> = ({
  open,
  loan,
  onClose,
  onSuccess,
}) => {
  const [principalAmount, setPrincipalAmount] = useState<string>('');
  const [interestAmount, setInterestAmount] = useState<string>('0');
  const [reason, setReason] = useState<string>('');
  const [dateBs, setDateBs] = useState<string>(getTodayBS());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && loan) {
      setPrincipalAmount(String(loan.outstandingPrincipal));
      setInterestAmount('0');
      setReason('');
      setDateBs(getTodayBS());
      setError(null);
    }
  }, [open, loan]);

  if (!open || !loan) return null;

  const outstanding = Number(loan.outstandingPrincipal) || 0;
  const principal = parseFloat(principalAmount) || 0;
  const interest = parseFloat(interestAmount) || 0;
  const totalWriteOff = principal + interest;

  const isValid =
    principal > 0 &&
    principal <= outstanding + 0.01 &&
    reason.trim().length >= 10 &&
    dateBs.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || loading) return;

    setLoading(true);
    setError(null);

    try {
      const result = await submitWriteOffRequest({
        loanId: loan.id,
        loanNo: loan.loanNo,
        memberName: loan.memberName,
        memberNo: loan.memberNo,
        outstandingPrincipal: outstanding,
        principalAmount: principal,
        interestAmount: interest,
        reason: reason.trim(),
        dateBs,
      });

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to submit write-off request.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9600] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[2px]"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Request Loan Write-Off</h3>
            <p className="mt-0.5 text-[12.5px] leading-snug text-slate-500">
              Submit for approval before the write-off is executed.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Loan Info */}
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <span className="text-slate-500">Loan No:</span>{' '}
              <span className="font-medium text-slate-800">{loan.loanNo}</span>
            </div>
            <div>
              <span className="text-slate-500">Member:</span>{' '}
              <span className="font-medium text-slate-800">
                {loan.memberName} ({loan.memberNo})
              </span>
            </div>
            <div>
              <span className="text-slate-500">Product:</span>{' '}
              <span className="font-medium text-slate-800">{loan.productName}</span>
            </div>
            <div>
              <span className="text-slate-500">Outstanding:</span>{' '}
              <span className="font-semibold text-rose-600">
                NPR {outstanding.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-[13px] text-rose-700">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-slate-600">
                Principal Amount (NPR) *
              </label>
              <input
                type="number"
                value={principalAmount}
                onChange={(e) => setPrincipalAmount(e.target.value)}
                max={outstanding}
                min="0"
                step="0.01"
                disabled={loading}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
              />
              {principal > outstanding && (
                <p className="mt-1 text-[11px] text-rose-600">
                  Cannot exceed outstanding balance
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-slate-600">
                Interest Amount (NPR)
              </label>
              <input
                type="number"
                value={interestAmount}
                onChange={(e) => setInterestAmount(e.target.value)}
                min="0"
                step="0.01"
                disabled={loading}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-slate-600">
              Write-Off Date (BS) *
            </label>
            <input
              type="text"
              value={dateBs}
              onChange={(e) => setDateBs(e.target.value)}
              placeholder="YYYY-MM-DD"
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-slate-600">
              Reason for Write-Off * <span className="text-slate-400">(min 10 characters)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Explain why this loan should be written off..."
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 resize-none"
            />
          </div>

          {/* Summary */}
          <div className="rounded-lg bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-[13px] text-amber-800">
              <AlertTriangle size={16} />
              <span className="font-medium">Total Write-Off:</span>
              <span className="font-semibold">
                NPR {totalWriteOff.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-amber-600">
              This request will be sent for manager approval before execution.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit for Approval'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
