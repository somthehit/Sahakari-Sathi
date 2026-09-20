import React, { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { createApprovalLevel, updateApprovalLevel, type ApprovalLevel } from '../../api/approvals';

interface Props {
  initial?: ApprovalLevel | null;
  onClose: () => void;
  onSaved: (level: ApprovalLevel) => void;
  onError?: (message: string) => void;
}

export const ApprovalLevelForm: React.FC<Props> = ({ initial, onClose, onSaved, onError }) => {
  const [levelNo, setLevelNo] = useState(initial?.levelNo ?? 1);
  const [roleKey, setRoleKey] = useState(initial?.roleKey ?? '');
  const [roleLabel, setRoleLabel] = useState(initial?.roleLabel ?? '');
  const [minAmount, setMinAmount] = useState(initial ? String(initial.minAmount ?? 0) : '0');
  const [maxAmount, setMaxAmount] = useState(initial ? (initial.maxAmount == null ? '' : String(initial.maxAmount)) : '');
  const [scope, setScope] = useState(initial?.scope ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!roleKey.trim() || !roleLabel.trim()) {
      onError?.('Role key and role label are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        levelNo,
        roleKey: roleKey.trim(),
        roleLabel: roleLabel.trim(),
        minAmount: Number(minAmount) || 0,
        maxAmount: maxAmount === '' ? null : Number(maxAmount),
        scope: scope.trim(),
        active,
      };
      const saved = initial
        ? await updateApprovalLevel(initial.id, payload)
        : await createApprovalLevel(payload);
      onSaved(saved);
    } catch (error: any) {
      onError?.(error?.response?.data?.error || error?.message || 'Could not save approval level.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">
            {initial ? `Edit Approval Level ${initial.levelNo}` : 'Add Approval Level'}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Level Number</label>
              <input
                type="number"
                min={1}
                value={levelNo}
                onChange={(e) => setLevelNo(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Role Key</label>
              <input
                value={roleKey}
                onChange={(e) => setRoleKey(e.target.value)}
                placeholder="branch_manager"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Role Label</label>
            <input
              value={roleLabel}
              onChange={(e) => setRoleLabel(e.target.value)}
              placeholder="Branch Manager"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Min Amount (NPR)</label>
              <input
                type="number"
                min={0}
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Max Amount (NPR)</label>
              <input
                type="number"
                min={0}
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="No limit"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Scope / Description</label>
            <input
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Branch Disbursal & Expenses"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={() => setActive(!active)}
            className={`flex items-center gap-2 ${active ? 'text-emerald-700' : 'text-slate-500'}`}
          >
            <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${active ? 'bg-emerald-600' : 'bg-slate-300'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </span>
            <span className="text-xs font-bold">{active ? 'Active' : 'Inactive'}</span>
          </button>
        </div>

        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Level'}
          </button>
        </div>
      </div>
    </div>
  );
};
