import React, { useState } from 'react';
import { useCoop } from '../../context/CoopContext';
import { Calculator, Receipt, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';

export const BudgetExpenseView: React.FC = () => {
  const { budgetLines, postExpenseClaim } = useCoop();

  const [claimTitle, setClaimTitle] = useState('');
  const [claimCategory, setClaimCategory] = useState('Office Stationery & Printing');
  const [claimAmount, setClaimAmount] = useState('12500');
  const [claimDesc, setClaimDesc] = useState('Thermal paper rolls and toner cartridges');

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(claimAmount);
    if (isNaN(amt) || amt <= 0) return;

    postExpenseClaim(claimTitle || 'Staff Expense Claim', claimCategory, amt, claimDesc);
    setClaimTitle('');
    setClaimAmount('');
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Annual Budgeting & Staff Expense Claims</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Calculator className="w-3.5 h-3.5 text-slate-500" />
            <span>Departmental budget variance analysis and expense claim approval workflows</span>
          </p>
        </div>
      </div>

      {/* Budget Variance Cards */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-bold text-slate-900 text-base">FY 2083/84 Annual Budget vs Actual Variance</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {budgetLines.map(b => {
            const pct = Math.min(100, Math.round((b.usedActual / b.allocatedBudget) * 100));

            return (
              <div key={b.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-emerald-700 font-bold">{b.glAccountCode}</span>
                    <h3 className="font-bold text-slate-900 text-sm">{b.glAccountName}</h3>
                  </div>
                  <span className="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded text-slate-700 font-medium">{b.department}</span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Used: {formatNPR(b.usedActual)}</span>
                    <span>Budget: {formatNPR(b.allocatedBudget)}</span>
                  </div>

                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-rose-500' : 'bg-emerald-600'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="text-right font-bold text-emerald-800">{pct}% Utilized</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expense Claim Form */}
      <form onSubmit={handleExpenseSubmit} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 max-w-2xl mx-auto">
        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <Receipt className="w-5 h-5 text-indigo-600" />
          <span>Submit Staff Operational Expense Claim</span>
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-slate-700 font-semibold block mb-1">Expense Title *</label>
            <input
              type="text"
              required
              value={claimTitle}
              onChange={(e) => setClaimTitle(e.target.value)}
              placeholder="e.g. Branch Stationery Purchase"
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded p-2 text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-700 font-semibold block mb-1">Category</label>
              <select
                value={claimCategory}
                onChange={(e) => setClaimCategory(e.target.value)}
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded p-2 text-slate-900"
              >
                <option value="Office Stationery & Printing">Office Stationery & Printing</option>
                <option value="Utilities & Electricity">Utilities & Electricity</option>
                <option value="Travel & Field Allowance">Travel & Field Allowance</option>
              </select>
            </div>

            <div>
              <label className="text-slate-700 font-semibold block mb-1">Claim Amount (NPR) *</label>
              <input
                type="number"
                required
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded p-2 text-slate-900 font-mono font-bold"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-slate-800 font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add & Submit Expense Claim to Approval Queue</span>
          </button>
        </div>
      </form>

    </div>
  );
};
