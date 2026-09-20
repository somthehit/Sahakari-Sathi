import React, { useState } from 'react';
import { AlertTriangle, Loader2, ShieldAlert, X } from 'lucide-react';

/**
 * Hard Delete confirmation modal (admin-only destructive action).
 *
 * Requires the admin to type the literal `DELETE` AND provide a reason — the
 * server independently enforces `confirmation: 'DELETE'` + min reason length.
 * On confirm, the parent performs the actual hard delete (which archives an
 * immutable snapshot server-side before removing the rows).
 */
export function HardDeleteModal({
  title,
  entityLabel,
  entityCode,
  subtext,
  onConfirm,
  onClose,
}: {
  title: string;
  entityLabel: string;
  entityCode?: string;
  subtext?: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [typedDelete, setTypedDelete] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reasonValid = reason.trim().length >= 5;
  const confirmed = typedDelete === 'DELETE';
  const canSubmit = reasonValid && confirmed && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Hard delete failed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-rose-700 text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> {title}
            </h3>
            <p className="text-[11px] text-slate-500">
              {entityCode ? `${entityLabel} · ${entityCode}` : entityLabel}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="text-xs text-rose-800 space-y-1">
              <p className="font-bold">This action permanently deletes the record and ALL linked financial data.</p>
              <p className="text-rose-700">
                It cannot be undone. An immutable audit record (with a full snapshot, admin identity, reason and IP) is
                written to the database before deletion — but the record itself will be gone forever.
              </p>
              {subtext && <p className="text-rose-600">{subtext}</p>}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Reason for deletion <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Duplicate member record created by mistake (ref #…)"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-rose-400 focus:outline-none shadow-xs"
            />
            <div className="text-[10px] text-slate-400 mt-1">Minimum 5 characters.</div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Type <span className="font-mono text-rose-600 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={typedDelete}
              onChange={(e) => setTypedDelete(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:border-rose-400 focus:outline-none shadow-xs"
            />
          </div>

          {error && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Permanently Delete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
