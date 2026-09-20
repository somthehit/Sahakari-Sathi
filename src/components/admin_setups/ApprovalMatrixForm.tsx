import React, { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import {
  createApprovalMatrixRule,
  updateApprovalMatrixRule,
  type ApprovalMatrixRule,
  type ApprovalRequestType,
} from '../../api/approvals';

interface Props {
  initial?: ApprovalMatrixRule | null;
  onClose: () => void;
  onSaved: (rule: ApprovalMatrixRule) => void;
  onError?: (message: string) => void;
}

const REQUEST_TYPES: ApprovalRequestType[] = ['Loan_Approval', 'Expense_Claim', 'Voucher_Post', 'Share_Transfer', 'Member_Exit'];

export const ApprovalMatrixForm: React.FC<Props> = ({ initial, onClose, onSaved, onError }) => {
  const [requestType, setRequestType] = useState<ApprovalRequestType>(initial?.requestType ?? 'Loan_Approval');
  const [thresholdMin, setThresholdMin] = useState(initial ? String(initial.thresholdMin ?? 0) : '0');
  const [thresholdMax, setThresholdMax] = useState(initial ? (initial.thresholdMax == null ? '' : String(initial.thresholdMax)) : '');
  const [signatory1Role, setSignatory1Role] = useState(initial?.signatory1Role ?? '');
  const [signatory2Role, setSignatory2Role] = useState(initial?.signatory2Role ?? '');
  const [smsNotify, setSmsNotify] = useState(initial?.smsNotify ?? false);
  const [active, setActive] = useState(initial?.active ?? true);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!signatory1Role.trim()) {
      onError?.('First signatory role is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        requestType,
        thresholdMin: Number(thresholdMin) || 0,
        thresholdMax: thresholdMax === '' ? null : Number(thresholdMax),
        signatory1Role: signatory1Role.trim(),
        signatory2Role: signatory2Role.trim() === '' ? null : signatory2Role.trim(),
        smsNotify,
        active,
        description: description.trim() === '' ? undefined : description.trim(),
      };
      const saved = initial
        ? await updateApprovalMatrixRule(initial.id, payload)
        : await createApprovalMatrixRule(payload);
      onSaved(saved);
    } catch (error: any) {
      onError?.(error?.response?.data?.error || error?.message || 'Could not save matrix rule.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500';
  const labelCls = 'block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5';

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">
            {initial ? `Edit ${initial.requestType} Rule` : 'Add Approval Matrix Rule'}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Request Type</label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as ApprovalRequestType)}
                className={`${inputCls} cursor-pointer`}
              >
                {REQUEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>First Signatory Role</label>
              <input
                value={signatory1Role}
                onChange={(e) => setSignatory1Role(e.target.value)}
                placeholder="Branch Manager"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Threshold Min (NPR)</label>
              <input
                type="number"
                min={0}
                value={thresholdMin}
                onChange={(e) => setThresholdMin(e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls}>Threshold Max (NPR)</label>
              <input
                type="number"
                min={0}
                value={thresholdMax}
                onChange={(e) => setThresholdMax(e.target.value)}
                placeholder="No cap"
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Second Signatory Role</label>
              <input
                value={signatory2Role}
                onChange={(e) => setSignatory2Role(e.target.value)}
                placeholder="Credit Committee Chairperson"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="High-value loans"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button
              type="button"
              role="switch"
              aria-checked={smsNotify}
              onClick={() => setSmsNotify(!smsNotify)}
              className={`flex items-center gap-2 ${smsNotify ? 'text-emerald-700' : 'text-slate-500'}`}
            >
              <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${smsNotify ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${smsNotify ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </span>
              <span className="text-xs font-bold">SMS Notification</span>
            </button>
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
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
};
