import React, { useState } from 'react';
import { useCoop } from '../../context/CoopContext';
import type { FiscalYear } from '../../types/coop';
import { convertBSToAD, getDaysInBSMonth } from '../../utils/nepaliCalendar';
import { Calendar, X, Plus, Check, AlertCircle } from 'lucide-react';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const bsToAD = (bsDate: string): string => {
  const trimmed = (bsDate || '').trim();
  if (!DATE_RE.test(trimmed)) return '';
  const ad = convertBSToAD(trimmed);
  return DATE_RE.test(ad) ? ad : '';
};

const nextFiscalYear = (lastFY?: FiscalYear): { code: string; startDateBS: string; endDateBS: string } | null => {
  if (!lastFY) return null;
  const parts = lastFY.code.split('/');
  if (parts.length !== 2) return null;
  const startY = parseInt(parts[0], 10);
  const endY = parseInt(parts[1], 10);
  if (isNaN(startY) || isNaN(endY)) return null;
  const nextStartY = startY + 1;
  const nextEndY = (endY + 1) % 100;
  return {
    code: `${nextStartY}/${String(nextEndY).padStart(2, '0')}`,
    startDateBS: `${nextStartY}-04-01`,
    endDateBS: `${nextStartY + 1}-03-${String(getDaysInBSMonth(nextStartY + 1, 3)).padStart(2, '0')}`,
  };
};

const nextFiscalYearCode = (lastFY?: FiscalYear): string | null => nextFiscalYear(lastFY)?.code ?? null;
const nextFiscalYearStartBS = (lastFY?: FiscalYear): string | null => nextFiscalYear(lastFY)?.startDateBS ?? null;
const nextFiscalYearEndBS = (lastFY?: FiscalYear): string | null => nextFiscalYear(lastFY)?.endDateBS ?? null;

export const AddFiscalYearModal: React.FC = () => {
  const { isFiscalYearModalOpen, setIsFiscalYearModalOpen, addFiscalYear, fiscalYears } = useCoop();

  const lastFY = fiscalYears[fiscalYears.length - 1];
  const initialStartBS = () => nextFiscalYearStartBS(lastFY) ?? '2084-04-01';
  const initialEndBS = () => nextFiscalYearEndBS(lastFY) ?? `2085-03-${String(getDaysInBSMonth(2085, 3)).padStart(2, '0')}`;
  const [code, setCode] = useState(() => nextFiscalYearCode(lastFY) ?? '2084/85');
  const [startDateBS, setStartDateBS] = useState(initialStartBS);
  const [endDateBS, setEndDateBS] = useState(initialEndBS);
  const [startDateAD, setStartDateAD] = useState(() => bsToAD(initialStartBS()));
  const [endDateAD, setEndDateAD] = useState(() => bsToAD(initialEndBS()));
  const [isCurrent, setIsCurrent] = useState(true);
  const [status, setStatus] = useState<'active' | 'closed'>('active');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleStartDateBSChange = (value: string) => {
    setStartDateBS(value);
    const ad = bsToAD(value);
    if (ad) setStartDateAD(ad);
  };

  const handleEndDateBSChange = (value: string) => {
    setEndDateBS(value);
    const ad = bsToAD(value);
    if (ad) setEndDateAD(ad);
  };

  if (!isFiscalYearModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please provide a Fiscal Year code (e.g. 2084/85)');
      return;
    }

    const existing = fiscalYears.find(f => f.code.toLowerCase() === code.trim().toLowerCase());
    if (existing) {
      setError(`Fiscal Year "${code}" already exists in the system.`);
      return;
    }

    setIsSaving(true);
    try {
      const created = await addFiscalYear({
        code: code.trim(),
        startDateBS: startDateBS.trim(),
        endDateBS: endDateBS.trim(),
        startDateAD: startDateAD.trim(),
        endDateAD: endDateAD.trim(),
        isCurrent,
        status
      });

      if (created) {
        setError('');
        setIsFiscalYearModalOpen(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save fiscal year. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickNextYearAutoFill = () => {
    const next = nextFiscalYear(lastFY);
    if (next) {
      setCode(next.code);
      setStartDateBS(next.startDateBS);
      setEndDateBS(next.endDateBS);
      const startAD = bsToAD(next.startDateBS);
      const endAD = bsToAD(next.endDateBS);
      if (startAD) setStartDateAD(startAD);
      if (endAD) setEndDateAD(endAD);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 bg-white text-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Calendar className="w-5 h-5 text-slate-800" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight text-slate-800">Add New Fiscal Year</h3>
              <p className="text-xs text-emerald-100">Configure financial period dates (BS & AD)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsFiscalYearModalOpen(false)}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-800/80 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Auto-fill button */}
          <div className="flex justify-between items-center bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <div>
              <div className="text-xs font-bold text-emerald-900">Auto-Calculate Next Period</div>
              <div className="text-[11px] text-emerald-700">Pre-fill dates based on latest existing Fiscal Year</div>
            </div>
            <button
              type="button"
              onClick={handleQuickNextYearAutoFill}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Auto-Fill Next</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Fiscal Year Code */}
            <div className="sm:col-span-2">
              <label className="block text-slate-700 text-xs font-bold mb-1">
                Fiscal Year Code (e.g. 2084/85) <span className="text-emerald-600">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="2084/85"
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Start Date BS */}
            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1">
                Start Date (BS) <span className="text-emerald-600">*</span>
              </label>
              <input
                type="text"
                required
                value={startDateBS}
                onChange={(e) => handleStartDateBSChange(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* End Date BS */}
            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1">
                End Date (BS) <span className="text-emerald-600">*</span>
              </label>
              <input
                type="text"
                required
                value={endDateBS}
                onChange={(e) => handleEndDateBSChange(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Start Date AD */}
            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1">
                Start Date (AD)
              </label>
              <input
                type="text"
                value={startDateAD}
                onChange={(e) => setStartDateAD(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* End Date AD */}
            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1">
                End Date (AD)
              </label>
              <input
                type="text"
                value={endDateAD}
                onChange={(e) => setEndDateAD(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1">
                Fiscal Year Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'closed')}
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500"
              >
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Is Current Checkbox */}
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isCurrent}
                  onChange={(e) => setIsCurrent(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">Set as Active Current FY</span>
              </label>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFiscalYearModalOpen(false)}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-white hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed text-slate-800 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Fiscal Year'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
