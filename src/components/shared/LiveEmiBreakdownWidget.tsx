import React, { useMemo, useState } from 'react';
import { Clock, TrendingDown, Wallet, ArrowRight, AlertTriangle } from 'lucide-react';
import { calculateRealtimeEmiBreakdown } from '../../utils/financialEngine';
import { formatNPR } from '../../utils/nepaliCalendar';

interface LiveEmiBreakdownWidgetProps {
  outstandingPrincipal: number;
  annualRatePct: number;
  lastPaymentDateBs: string;
  currentPaymentDateBs: string;
  paymentAmount: number;
  /** Original disbursed principal — for flat-rate calculation. */
  originalPrincipal?: number;
  /** Total tenure in months — for flat-rate calculation. */
  tenureMonths?: number;
  /** Loan interest method from the database (flat, declining, etc.) — used to seed the toggle. */
  interestMethod?: string;
  /** Callback when user changes the method toggle. */
  onMethodChange?: (method: 'diminishing_daily' | 'flat') => void;
}

const LiveEmiBreakdownWidget: React.FC<LiveEmiBreakdownWidgetProps> = ({
  outstandingPrincipal,
  annualRatePct,
  lastPaymentDateBs,
  currentPaymentDateBs,
  paymentAmount,
  originalPrincipal,
  tenureMonths,
  interestMethod,
  onMethodChange,
}) => {
  // Map loan interestMethod to realtime method
  const initialMethod = interestMethod === 'flat' ? 'flat' as const : 'diminishing_daily' as const;
  const [localMethod, setLocalMethod] = useState<'diminishing_daily' | 'flat'>(initialMethod);
  const activeMethod = onMethodChange ? initialMethod : localMethod;

  const handleMethodChange = (m: 'diminishing_daily' | 'flat') => {
    if (onMethodChange) onMethodChange(m);
    else setLocalMethod(m);
  };

  const breakdown = useMemo(
    () =>
      calculateRealtimeEmiBreakdown({
        outstandingPrincipal,
        annualRatePct,
        lastPaymentDateBs,
        currentPaymentDateBs,
        paymentAmount: Number(paymentAmount) || 0,
        method: activeMethod,
        originalPrincipal,
        tenureMonths,
      }),
    [outstandingPrincipal, annualRatePct, lastPaymentDateBs, currentPaymentDateBs, paymentAmount, activeMethod, originalPrincipal, tenureMonths],
  );

  if (!lastPaymentDateBs || !currentPaymentDateBs || outstandingPrincipal <= 0) return null;

  const interestPct = paymentAmount > 0 ? ((breakdown.accruedInterest / paymentAmount) * 100).toFixed(1) : '0';
  const principalPct = paymentAmount > 0 ? ((breakdown.principalPaid / paymentAmount) * 100).toFixed(1) : '0';

  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 my-3">
      {/* Header with Days Elapsed + Method Toggle */}
      <div className="flex justify-between items-center text-xs text-slate-600 border-b pb-2">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          Days Elapsed: <strong className="text-slate-900">{breakdown.daysElapsed} days</strong>
        </span>
        <select
          value={activeMethod}
          onChange={(e) => handleMethodChange(e.target.value as 'diminishing_daily' | 'flat')}
          className="text-[11px] font-semibold bg-white border border-slate-300 rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="diminishing_daily">Diminishing daily</option>
          <option value="flat">Flat</option>
        </select>
      </div>

      {/* Interest Accrual Detail */}
      <div className="space-y-1.5">
        <div className="text-xs font-bold text-slate-700">
          Interest accrual (day-by-day)
        </div>
        <table className="w-full text-xs">
          <tbody>
            <tr>
              <td className="py-1 text-slate-500">Outstanding principal</td>
              <td className="py-1 text-right font-mono font-semibold">{formatNPR(outstandingPrincipal)}</td>
            </tr>
            <tr>
              <td className="py-1 text-slate-500">Annual rate</td>
              <td className="py-1 text-right font-mono">{annualRatePct.toFixed(2)}%</td>
            </tr>
            <tr>
              <td className="py-1 text-slate-500">Daily rate ({annualRatePct}% ÷ 365)</td>
              <td className="py-1 text-right font-mono">{breakdown.dailyRatePct.toFixed(5)}%</td>
            </tr>
            <tr className="border-t border-slate-200">
              <td className="py-1.5 text-slate-500 font-medium">
                Interest due ({outstandingPrincipal.toLocaleString()} × {breakdown.dailyRatePct.toFixed(5)}% × {breakdown.daysElapsed}d)
              </td>
              <td className="py-1.5 text-right font-bold text-amber-700">{formatNPR(breakdown.accruedInterest)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Auto-split: Interest vs Principal */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded">
          <span className="block text-[10px] uppercase font-bold text-amber-800 mb-0.5">
            Interest Portion
          </span>
          <span className="text-sm font-extrabold text-amber-700 block">
            {formatNPR(breakdown.accruedInterest)}
          </span>
          <span className="text-[10px] text-amber-600">{interestPct}% of payment</span>
        </div>

        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded">
          <span className="block text-[10px] uppercase font-bold text-emerald-800 mb-0.5">
            Principal Portion
          </span>
          <span className="text-sm font-extrabold text-emerald-700 block">
            {formatNPR(breakdown.principalPaid)}
          </span>
          <span className="text-[10px] text-emerald-600">{principalPct}% of payment</span>
        </div>
      </div>

      {/* New Outstanding Balance */}
      <div className="flex justify-between items-center text-xs border-t border-slate-200 pt-2">
        <span className="text-slate-500 font-medium">New outstanding balance</span>
        <span className="font-mono font-bold text-slate-900">{formatNPR(breakdown.newOutstandingPrincipal)}</span>
      </div>

      {/* Excess warning */}
      {breakdown.excessToSavings > 0 && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded bg-violet-50 border border-violet-200 text-violet-800">
          <ArrowRight className="w-3.5 h-3.5 text-violet-500" />
          <span>
            Excess <strong>{formatNPR(breakdown.excessToSavings)}</strong> will be credited to savings account.
          </span>
        </div>
      )}

      {/* Interest shortfall warning */}
      {breakdown.interestShortfall > 0 && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded bg-rose-50 border border-rose-200 text-rose-800">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          <span>
            Payment doesn't cover accrued interest — <strong>{formatNPR(breakdown.interestShortfall)}</strong> interest remains unpaid. No principal reduction.
          </span>
        </div>
      )}
    </div>
  );
};

export default LiveEmiBreakdownWidget;
