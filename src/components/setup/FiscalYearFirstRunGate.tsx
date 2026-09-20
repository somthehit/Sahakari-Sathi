import React from 'react';
import { useCoop } from '../../context/CoopContext';
import { AddFiscalYearModal } from '../modals/AddFiscalYearModal';
import { CalendarDays, Loader2, RefreshCw } from 'lucide-react';

/**
 * Blocks the entire application until at least one Fiscal Year exists.
 *
 * - loading: showing splash until the backend responds.
 * - error:   backend fetch failed → show retry (never the setup form).
 * - loaded with no fiscal years: forced initial Fiscal Year setup.
 * - loaded with fiscal years:    normal app.
 */
export const FiscalYearFirstRunGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { fiscalYears, fiscalYearsStatus, reloadFiscalYears, setIsFiscalYearModalOpen } = useCoop();

  if (fiscalYearsStatus === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <div className="text-sm font-semibold text-slate-500">Loading fiscal setup...</div>
      </div>
    );
  }

  if (fiscalYearsStatus === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <div className="mx-auto w-14 h-14 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center mb-4">
            <RefreshCw className="w-7 h-7 text-rose-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Couldn't Load Fiscal Setup</h1>
          <p className="text-sm text-slate-500 mt-2">
            The fiscal year registry could not be reached. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={reloadFiscalYears}
            className="mt-6 w-full py-2.5 bg-white hover:bg-white text-slate-800 font-bold text-sm rounded-xl transition cursor-pointer shadow-xs"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (fiscalYears.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <div className="mx-auto w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mb-4">
            <CalendarDays className="w-7 h-7 text-emerald-700" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Fiscal Year Setup Required</h1>
          <p className="text-sm text-slate-500 mt-2">
            No fiscal year has been configured for this organization yet. You must create the
            initial Fiscal Year before you can use Sahakari Sathi.
          </p>
          <button
            type="button"
            onClick={() => setIsFiscalYearModalOpen(true)}
            className="mt-6 w-full py-2.5 bg-white hover:bg-white text-slate-800 font-bold text-sm rounded-xl transition cursor-pointer shadow-xs"
          >
            Set Up Initial Fiscal Year
          </button>
        </div>
        <AddFiscalYearModal />
      </div>
    );
  }

  return <>{children}</>;
};
