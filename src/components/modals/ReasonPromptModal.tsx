import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

interface ReasonPromptModalProps {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  /** Require a non-empty reason before confirm is enabled. */
  required?: boolean;
  confirmLabel?: string;
  /** Tone of the confirm button — 'danger' for bounce/reject, 'primary' otherwise. */
  tone?: 'primary' | 'danger';
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * Small controlled modal for capturing a free-text reason/remark. Replaces the
 * blocking window.prompt() calls used for cheque bounce reasons, withdrawal
 * rejection remarks, and stop-payment rejections — same emerald/slate language
 * as the rest of the cheque workspace.
 */
export const ReasonPromptModal: React.FC<ReasonPromptModalProps> = ({
  open,
  title,
  description,
  label,
  placeholder,
  required = false,
  confirmLabel = 'Confirm',
  tone = 'primary',
  busy = false,
  onCancel,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      // Focus after the modal paints.
      const t = window.setTimeout(() => areaRef.current?.focus(), 40);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const disabled = busy || (required && reason.trim().length === 0);
  const confirmCls = tone === 'danger'
    ? 'bg-rose-600 enabled:hover:bg-rose-700 shadow-rose-600/20'
    : 'bg-emerald-600 enabled:hover:bg-emerald-700 shadow-emerald-600/20';

  return (
    <div
      className="fixed inset-0 z-[9600] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[2px]"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
            {description && <p className="mt-0.5 text-[12.5px] leading-snug text-slate-500">{description}</p>}
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          <label className="mb-1.5 block text-[12px] font-medium text-slate-600">
            {label}{required && <span className="text-rose-500"> *</span>}
          </label>
          <textarea
            ref={areaRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={placeholder}
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={disabled}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none ${confirmCls}`}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
