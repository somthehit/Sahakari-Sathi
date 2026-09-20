import React from 'react';
import { X, BookOpen } from 'lucide-react';
import { useCoop } from '../../context/CoopContext';
import { PassbookWorkspace } from '../passbook/PassbookWorkspace';

/**
 * Quick-action passbook modal. Triggered from Savings / Loans / member views via
 * `selectedAccountForPassbook`, it now hosts the same consolidated PassbookWorkspace
 * as the full-page view (Print tab focused on the chosen account) — replacing the
 * old `window.print()` mock with the real build → print → confirm continuation flow.
 */
export const PassbookPrintModal: React.FC = () => {
  const { selectedAccountForPassbook, setSelectedAccountForPassbook } = useCoop();

  if (!selectedAccountForPassbook) return null;
  const a = selectedAccountForPassbook;
  const close = () => setSelectedAccountForPassbook(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-3 backdrop-blur-sm sm:p-4"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl ring-1 ring-black/5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">Passbook</h2>
              <p className="text-[12px] text-slate-500">{a.memberName} · <span className="font-mono">#{a.accountNo}</span></p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg bg-slate-100 p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Consolidated workspace, focused on the chosen account. */}
        <div className="flex-1 overflow-auto px-5 py-5">
          <PassbookWorkspace initialAccountId={a.id} defaultTab="print" embedded />
        </div>
      </div>
    </div>
  );
};
