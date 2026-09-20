import React, { useState } from 'react';
import { useCoop } from '../../context/CoopContext';
import { Vault, Landmark, CheckCircle2, AlertTriangle, Calculator } from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';

interface Props {
  activeSubKey?: string;
}

export const CashBankView: React.FC<Props> = ({ activeSubKey }) => {
  const { activeBranch } = useCoop();

  // Denomination counter state
  const [notes1000, setNotes1000] = useState<number>(1200);
  const [notes500, setNotes500] = useState<number>(1000);
  const [notes100, setNotes100] = useState<number>(1250);
  const [notes50, setNotes50] = useState<number>(300);
  const [notes20, setNotes20] = useState<number>(150);
  const [notes10, setNotes10] = useState<number>(100);
  const [notes5, setNotes5] = useState<number>(100);

  // Coins & Paisa state
  const [coins2, setCoins2] = useState<number>(100);
  const [coins1, setCoins1] = useState<number>(250);
  const [paisa50, setPaisa50] = useState<number>(80);
  const [paisa25, setPaisa25] = useState<number>(40);

  const notesSubTotal = 
    (notes1000 * 1000) + 
    (notes500 * 500) + 
    (notes100 * 100) + 
    (notes50 * 50) + 
    (notes20 * 20) + 
    (notes10 * 10) + 
    (notes5 * 5);

  const coinsPaisaSubTotal = 
    (coins2 * 2) + 
    (coins1 * 1) + 
    (paisa50 * 0.50) + 
    (paisa25 * 0.25);

  const denomTotal = notesSubTotal + coinsPaisaSubTotal;

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Branch Vault Cash & Bank Reconciliation</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Vault className="w-3.5 h-3.5 text-slate-500" />
            <span>Teller till balances, physical note denomination counter, and vault cash limits</span>
          </p>
        </div>
      </div>

      {/* Vault Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Branch Vault Cash-in-Hand</span>
            <div className="text-2xl font-black text-emerald-700 font-mono mt-1.5">{formatNPR(activeBranch?.currentVaultCash || 0)}</div>
          </div>
          <div className="text-xs text-slate-500 mt-3 font-medium flex items-center gap-1.5 pt-2 border-t border-slate-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>{activeBranch?.name || 'Head Office'}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Configured Vault Cash Limit</span>
            <div className="text-2xl font-black text-slate-900 font-mono mt-1.5">{formatNPR(activeBranch?.vaultLimit || 0)}</div>
          </div>
          <div className="text-xs text-emerald-700 mt-3 font-semibold flex items-center gap-1.5 pt-2 border-t border-slate-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Vault balance within safe threshold</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Commercial Bank Balance</span>
            <div className="text-2xl font-black text-teal-700 font-mono mt-1.5">रु. 1,25,00,000</div>
          </div>
          <div className="text-xs text-slate-500 mt-3 font-medium flex items-center gap-1.5 pt-2 border-t border-slate-100">
            <Landmark className="w-3.5 h-3.5 text-slate-500" />
            <span>Nepal Rastra Bank & Commercial Banks</span>
          </div>
        </div>
      </div>

      {/* Denomination Counter Calculator */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs max-w-3xl mx-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-700">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Daily Teller Note & Paisa Denomination Counter</h2>
              <p className="text-[11px] text-slate-500 font-normal">Physical cash verification for daily till reconciliation</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => {
              setNotes1000(0); setNotes500(0); setNotes100(0); setNotes50(0);
              setNotes20(0); setNotes10(0); setNotes5(0);
              setCoins2(0); setCoins1(0); setPaisa50(0); setPaisa25(0);
            }}
            className="text-[11px] text-slate-500 hover:text-rose-600 font-medium px-2 py-0.5 rounded-md border border-slate-200 hover:border-rose-200 transition-colors"
          >
            Clear All
          </button>
        </div>

        {/* BANKNOTES SECTION */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 uppercase tracking-wider px-1 pb-1 border-b border-slate-100">
            <span>Banknotes (कागजी नोटहरू)</span>
            <span className="text-emerald-700 font-mono font-bold">Subtotal: {formatNPR(notesSubTotal)}</span>
          </div>

          <div className="grid grid-cols-1 gap-1">
            <div className="flex items-center justify-between bg-slate-50/70 hover:bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60 transition-colors">
              <span className="font-bold text-emerald-800 w-32 text-xs">रु. 1,000 Notes</span>
              <input
                type="number"
                min="0"
                value={notes1000}
                onChange={(e) => setNotes1000(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-28 bg-white border border-slate-300 rounded p-1 text-center font-mono font-bold text-slate-900 text-xs shadow-2xs focus:border-emerald-600 focus:outline-none"
              />
              <span className="font-mono text-slate-900 text-xs font-bold w-32 text-right">रु. {(notes1000 * 1000).toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between bg-slate-50/70 hover:bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60 transition-colors">
              <span className="font-bold text-amber-800 w-32 text-xs">रु. 500 Notes</span>
              <input
                type="number"
                min="0"
                value={notes500}
                onChange={(e) => setNotes500(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-28 bg-white border border-slate-300 rounded p-1 text-center font-mono font-bold text-slate-900 text-xs shadow-2xs focus:border-emerald-600 focus:outline-none"
              />
              <span className="font-mono text-slate-900 text-xs font-bold w-32 text-right">रु. {(notes500 * 500).toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between bg-slate-50/70 hover:bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60 transition-colors">
              <span className="font-bold text-slate-800 w-32 text-xs">रु. 100 Notes</span>
              <input
                type="number"
                min="0"
                value={notes100}
                onChange={(e) => setNotes100(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-28 bg-white border border-slate-300 rounded p-1 text-center font-mono font-bold text-slate-900 text-xs shadow-2xs focus:border-emerald-600 focus:outline-none"
              />
              <span className="font-mono text-slate-900 text-xs font-bold w-32 text-right">रु. {(notes100 * 100).toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between bg-slate-50/70 hover:bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60 transition-colors">
              <span className="font-bold text-purple-800 w-32 text-xs">रु. 50 Notes</span>
              <input
                type="number"
                min="0"
                value={notes50}
                onChange={(e) => setNotes50(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-28 bg-white border border-slate-300 rounded p-1 text-center font-mono font-bold text-slate-900 text-xs shadow-2xs focus:border-emerald-600 focus:outline-none"
              />
              <span className="font-mono text-slate-900 text-xs font-bold w-32 text-right">रु. {(notes50 * 50).toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between bg-slate-50/70 hover:bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60 transition-colors">
              <span className="font-bold text-orange-800 w-32 text-xs">रु. 20 Notes</span>
              <input
                type="number"
                min="0"
                value={notes20}
                onChange={(e) => setNotes20(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-28 bg-white border border-slate-300 rounded p-1 text-center font-mono font-bold text-slate-900 text-xs shadow-2xs focus:border-emerald-600 focus:outline-none"
              />
              <span className="font-mono text-slate-900 text-xs font-bold w-32 text-right">रु. {(notes20 * 20).toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between bg-slate-50/70 hover:bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60 transition-colors">
              <span className="font-bold text-teal-800 w-32 text-xs">रु. 10 Notes</span>
              <input
                type="number"
                min="0"
                value={notes10}
                onChange={(e) => setNotes10(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-28 bg-white border border-slate-300 rounded p-1 text-center font-mono font-bold text-slate-900 text-xs shadow-2xs focus:border-emerald-600 focus:outline-none"
              />
              <span className="font-mono text-slate-900 text-xs font-bold w-32 text-right">रु. {(notes10 * 10).toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between bg-slate-50/70 hover:bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60 transition-colors">
              <span className="font-bold text-slate-800 w-32 text-xs">रु. 5 Notes</span>
              <input
                type="number"
                min="0"
                value={notes5}
                onChange={(e) => setNotes5(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-28 bg-white border border-slate-300 rounded p-1 text-center font-mono font-bold text-slate-900 text-xs shadow-2xs focus:border-emerald-600 focus:outline-none"
              />
              <span className="font-mono text-slate-900 text-xs font-bold w-32 text-right">रु. {(notes5 * 5).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* COINS & PAISA SECTION */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 uppercase tracking-wider px-1 pb-1 border-b border-slate-100">
            <span>Coins & Paisa (सिक्का तथा पैसा विवरण)</span>
            <span className="text-teal-700 font-mono font-bold">Subtotal: {formatNPR(coinsPaisaSubTotal)}</span>
          </div>

          <div className="grid grid-cols-1 gap-1">
            <div className="flex items-center justify-between bg-amber-50/30 hover:bg-amber-50/60 px-3 py-1.5 rounded-lg border border-amber-200/50 transition-colors">
              <span className="font-bold text-amber-900 w-32 text-xs">रु. 2 Coins</span>
              <input
                type="number"
                min="0"
                value={coins2}
                onChange={(e) => setCoins2(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-28 bg-white border border-amber-300 rounded p-1 text-center font-mono font-bold text-slate-900 text-xs shadow-2xs focus:border-amber-600 focus:outline-none"
              />
              <span className="font-mono text-slate-900 text-xs font-bold w-32 text-right">रु. {(coins2 * 2).toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between bg-amber-50/30 hover:bg-amber-50/60 px-3 py-1.5 rounded-lg border border-amber-200/50 transition-colors">
              <span className="font-bold text-amber-900 w-32 text-xs">Re. 1 Coin</span>
              <input
                type="number"
                min="0"
                value={coins1}
                onChange={(e) => setCoins1(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-28 bg-white border border-amber-300 rounded p-1 text-center font-mono font-bold text-slate-900 text-xs shadow-2xs focus:border-amber-600 focus:outline-none"
              />
              <span className="font-mono text-slate-900 text-xs font-bold w-32 text-right">रु. {(coins1 * 1).toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between bg-sky-50/30 hover:bg-sky-50/60 px-3 py-1 rounded-lg border border-sky-200/50 transition-colors">
              <div className="w-32">
                <span className="font-bold text-sky-900 text-xs block leading-tight">50 Paisa</span>
                <span className="text-[10px] text-sky-600 font-normal">Re. 0.50 Coin</span>
              </div>
              <input
                type="number"
                min="0"
                value={paisa50}
                onChange={(e) => setPaisa50(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-28 bg-white border border-sky-300 rounded p-1 text-center font-mono font-bold text-slate-900 text-xs shadow-2xs focus:border-sky-600 focus:outline-none"
              />
              <span className="font-mono text-slate-900 text-xs font-bold w-32 text-right">रु. {(paisa50 * 0.50).toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between bg-sky-50/30 hover:bg-sky-50/60 px-3 py-1 rounded-lg border border-sky-200/50 transition-colors">
              <div className="w-32">
                <span className="font-bold text-sky-900 text-xs block leading-tight">25 Paisa</span>
                <span className="text-[10px] text-sky-600 font-normal">Re. 0.25 Coin</span>
              </div>
              <input
                type="number"
                min="0"
                value={paisa25}
                onChange={(e) => setPaisa25(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-28 bg-white border border-sky-300 rounded-lg p-1 text-center font-mono font-bold text-slate-900 text-xs shadow-2xs focus:border-sky-600 focus:outline-none"
              />
              <span className="font-mono text-slate-900 text-xs font-bold w-32 text-right">रु. {(paisa25 * 0.25).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* TOTAL SUMMARY BOX */}
        <div className="p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-center justify-between text-slate-900 font-bold text-xs shadow-2xs">
          <div>
            <span className="text-emerald-900 font-bold block">Physical Till Grand Total:</span>
            <span className="text-[11px] text-emerald-700 font-normal">Notes ({formatNPR(notesSubTotal)}) + Coins/Paisa ({formatNPR(coinsPaisaSubTotal)})</span>
          </div>
          <span className="font-mono text-emerald-800 text-lg font-black">{formatNPR(denomTotal)}</span>
        </div>
      </div>

    </div>
  );
};
