import React, { useCallback, useMemo, useState } from 'react';
import { Calculator, CheckCircle2, AlertTriangle, Wand2, RotateCcw } from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';

interface Props {
  expectedAmount: number;
  mode?: 'received' | 'paid';
  onChange?: (total: number) => void;
}

type Counts = Record<string, number>;

const DENOMS: { key: string; label: string; value: number; kind: 'note' | 'coin' }[] = [
  { key: 'n1000', label: 'रु. 1,000', value: 1000, kind: 'note' },
  { key: 'n500', label: 'रु. 500', value: 500, kind: 'note' },
  { key: 'n100', label: 'रु. 100', value: 100, kind: 'note' },
  { key: 'n50', label: 'रु. 50', value: 50, kind: 'note' },
  { key: 'n20', label: 'रु. 20', value: 20, kind: 'note' },
  { key: 'n10', label: 'रु. 10', value: 10, kind: 'note' },
  { key: 'n5', label: 'रु. 5', value: 5, kind: 'note' },
  { key: 'c2', label: 'रु. 2', value: 2, kind: 'coin' },
  { key: 'c1', label: 'Re. 1', value: 1, kind: 'coin' },
  { key: 'p50', label: '50 Paisa', value: 0.5, kind: 'coin' },
  { key: 'p25', label: '25 Paisa', value: 0.25, kind: 'coin' },
];

const emptyCounts = (): Counts => Object.fromEntries(DENOMS.map(d => [d.key, 0]));

/**
 * Cash Denomination counter for a single receipt/payment.
 * Live counts × face value; validates the running total against the expected
 * amount (e.g. share issue proceeds). Use with teller transactions.
 */
export const CashDenominationWidget: React.FC<Props> = ({ expectedAmount, mode = 'received', onChange }) => {
  const [counts, setCounts] = useState<Counts>(emptyCounts);

  const total = useMemo(
    () => DENOMS.reduce((sum, d) => sum + (counts[d.key] ?? 0) * d.value, 0),
    [counts],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { onChange?.(total); }, [total]);

  const diff = Math.round((total - expectedAmount) * 100) / 100;
  const matches = Math.abs(diff) < 0.005;
  const isPositive = diff > 0;

  const setCount = useCallback((key: string, raw: string) => {
    const n = Math.max(0, Math.floor(Number(raw) || 0));
    setCounts(prev => ({ ...prev, [key]: n }));
  }, []);

  const autoFill = useCallback(() => {
    let remaining = expectedAmount;
    const next: Counts = emptyCounts();
    for (const d of DENOMS) {
      if (remaining >= d.value - 1e-9) {
        const qty = Math.floor(remaining / d.value);
        next[d.key] = qty;
        remaining = Math.round((remaining - qty * d.value) * 100) / 100;
      }
    }
    setCounts(next);
  }, [expectedAmount]);

  const clear = useCallback(() => setCounts(emptyCounts()), []);

  const noteRows = DENOMS.filter(d => d.kind === 'note');
  const coinRows = DENOMS.filter(d => d.kind === 'coin');

  const Row: React.FC<{ d: (typeof DENOMS)[number]; color: string }> = ({ d, color }) => (
    <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg border transition-colors ${color}`}>
      <span className="font-bold text-slate-800 w-28 text-xs">{d.label}</span>
      <input
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={counts[d.key] ?? 0}
        onChange={e => setCount(d.key, e.target.value)}
        className="w-24 bg-white border border-slate-300 rounded p-1 text-center font-mono font-bold text-slate-900 text-xs shadow-2xs focus:border-emerald-600 focus:outline-none"
      />
      <span className="font-mono text-slate-900 text-xs font-bold w-28 text-right">रु. {formatNPR((counts[d.key] ?? 0) * d.value)}</span>
    </div>
  );

  return (
    <div className="border border-slate-200 rounded-xl bg-slate-50/60 /40 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          <Calculator className="w-3.5 h-3.5 text-emerald-600" />
          Cash Denomination {mode === 'paid' ? '(जम्मा भुक्तानी)' : '(जम्मा प्राप्त)'}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={autoFill}
            className="text-[10px] text-emerald-700 hover:text-emerald-800 font-semibold px-2 py-0.5 rounded-md border border-emerald-200 hover:border-emerald-400 transition-colors inline-flex items-center gap-1"
          >
            <Wand2 className="w-3 h-3" /> Auto
          </button>
          <button
            type="button"
            onClick={clear}
            className="text-[10px] text-slate-500 hover:text-rose-600 font-semibold px-2 py-0.5 rounded-md border border-slate-200 hover:border-rose-300 transition-colors inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Clear
          </button>
        </div>
      </div>

      {/* Banknotes */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 pb-1 border-b border-slate-200">
          <span>Banknotes (कागजी नोटहरू)</span>
        </div>
        <div className="space-y-1">
          {noteRows.map(d => (
            <Row key={d.key} d={d} color="bg-slate-50/70 border-slate-200/60" />
          ))}
        </div>
      </div>

      {/* Coins & Paisa */}
      <div className="space-y-1 pt-1 border-t border-slate-200">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 pb-1 border-b border-slate-200">
          <span>Coins & Paisa (सिक्का तथा पैसा विवरण)</span>
        </div>
        <div className="space-y-1">
          {coinRows.map(d => (
            <Row key={d.key} d={d} color="bg-amber-50/40 border-amber-200/50" />
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="pt-2 border-t border-slate-200 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Denomination Total</span>
          <span className="font-mono font-bold text-slate-900">{formatNPR(total)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">{mode === 'paid' ? 'Amount to Pay' : 'Amount Expected'}</span>
          <span className="font-mono font-bold text-slate-700">{formatNPR(expectedAmount)}</span>
        </div>
        <div className={`flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5 ${matches ? 'bg-emerald-50 text-emerald-700 /30 ' : isPositive ? 'bg-amber-50 text-amber-700 /30 ' : 'bg-red-50 text-red-700 /30 '}`}>
          <span className="font-semibold inline-flex items-center gap-1.5">
            {matches ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {matches ? 'Amount Matched' : isPositive ? 'Over by' : 'Short by'}
          </span>
          <span className="font-mono font-bold">{matches ? '—' : formatNPR(Math.abs(diff))}</span>
        </div>
      </div>
    </div>
  );
};
