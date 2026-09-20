import React, { useState, useEffect, useCallback } from 'react';
import { useCoop } from '../../context/CoopContext';
import { useToast } from '../../context/ToastContext';
import { Layers, CheckCircle2, XCircle, Plus, Pencil, Trash2, Loader2, Check, X } from 'lucide-react';
import { AdminSetupSearchFilterBar } from '../common/AdminSetupSearchFilterBar';
import { ApprovalLevelForm } from './ApprovalLevelForm';
import { ApprovalMatrixForm } from './ApprovalMatrixForm';
import {
  fetchApprovalLevels,
  fetchApprovalMatrix,
  fetchApprovalRequests,
  deleteApprovalLevel,
  deleteApprovalMatrixRule,
  postApprovalDecision,
  type ApprovalLevel,
  type ApprovalMatrixRule,
  type ApprovalRequestItem,
} from '../../api/approvals';

interface Props {
  activeSubKey?: string;
}

const fmtNPR = (n: number | null): string =>
  n == null ? 'No limit' : `NPR ${n.toLocaleString()}`;

const fmtThreshold = (r: ApprovalMatrixRule): string =>
  `≥ ${r.thresholdMin.toLocaleString()}${r.thresholdMax == null ? '+' : ` – ${r.thresholdMax.toLocaleString()}`}`;

export const AdminWorkflowView: React.FC<Props> = ({ activeSubKey = 'admin_approval_matrix' }) => {
  const { addNotification } = useCoop();
  const toast = useToast();

  const [subTab, setSubTab] = useState<string>(activeSubKey);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [levels, setLevels] = useState<ApprovalLevel[]>([]);
  const [rules, setRules] = useState<ApprovalMatrixRule[]>([]);
  const [requests, setRequests] = useState<ApprovalRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const [levelForm, setLevelForm] = useState<{ open: boolean; initial: ApprovalLevel | null }>({ open: false, initial: null });
  const [matrixForm, setMatrixForm] = useState<{ open: boolean; initial: ApprovalMatrixRule | null }>({ open: false, initial: null });

  useEffect(() => {
    if (activeSubKey) setSubTab(activeSubKey);
  }, [activeSubKey]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [l, m, r] = await Promise.all([
        fetchApprovalLevels(),
        fetchApprovalMatrix(),
        fetchApprovalRequests(),
      ]);
      setLevels(l);
      setRules(m);
      setRequests(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, subTab]);

  const notifyError = (message: string) => {
    addNotification('Action Failed', message, 'alert');
    toast.showError(message, 'Action Failed');
  };

  const handleLevelSaved = (level: ApprovalLevel) => {
    setLevelForm({ open: false, initial: null });
    void reload();
    addNotification('Approval Level Saved', `Approval level ${level.levelNo} (${level.roleLabel}) saved.`, 'success');
    toast.showSuccess('Approval level saved.', 'Approval Level Saved');
  };

  const handleLevelDelete = async (level: ApprovalLevel) => {
    try {
      await deleteApprovalLevel(level.id);
      void reload();
      addNotification('Approval Level Deleted', `Deleted approval level ${level.levelNo} (${level.roleLabel}).`, 'success');
      toast.showSuccess('Approval level deleted.', 'Approval Level Deleted');
    } catch (error: any) {
      notifyError(error?.response?.data?.error || error?.message || 'Could not delete approval level.');
    }
  };

  const handleRuleSaved = (rule: ApprovalMatrixRule) => {
    setMatrixForm({ open: false, initial: null });
    void reload();
    addNotification('Matrix Rule Saved', `${rule.requestType} rule saved.`, 'success');
    toast.showSuccess('Approval matrix rule saved.', 'Matrix Rule Saved');
  };

  const handleRuleDelete = async (rule: ApprovalMatrixRule) => {
    try {
      await deleteApprovalMatrixRule(rule.id);
      void reload();
      addNotification('Matrix Rule Deleted', `Deleted ${rule.requestType} rule.`, 'success');
      toast.showSuccess('Approval matrix rule deleted.', 'Matrix Rule Deleted');
    } catch (error: any) {
      notifyError(error?.response?.data?.error || error?.message || 'Could not delete matrix rule.');
    }
  };

  const handleDecision = async (req: ApprovalRequestItem, status: 'Approved' | 'Rejected') => {
    setDecidingId(req.id);
    try {
      await postApprovalDecision(req.id, { status, remarks: `Decision by administrator: ${status}` });
      void reload();
      addNotification('Decision Recorded', `${req.referenceNo} was ${status.toLowerCase()}.`, status === 'Approved' ? 'success' : 'alert');
      toast.showSuccess(`${req.referenceNo} ${status.toLowerCase()}.`, 'Decision Recorded');
    } catch (error: any) {
      notifyError(error?.response?.data?.error || error?.message || 'Could not record decision.');
    } finally {
      setDecidingId(null);
    }
  };

  const pendingRequests = requests.filter(r => {
    const isPending = r.status === 'Pending';
    const q = (searchTerm || '').toLowerCase();
    const matchesSearch = !q
      || (r.description || '').toLowerCase().includes(q)
      || (r.referenceNo || '').toLowerCase().includes(q)
      || (r.requestType || '').toLowerCase().includes(q);
    return isPending && matchesSearch;
  });

  const pastRequests = requests.filter(r => {
    const isPast = r.status !== 'Pending';
    const q = (searchTerm || '').toLowerCase();
    const matchesSearch = !q
      || (r.description || '').toLowerCase().includes(q)
      || (r.referenceNo || '').toLowerCase().includes(q)
      || (r.requestType || '').toLowerCase().includes(q);
    return isPast && matchesSearch;
  });

  const activeLevels = levels.filter(l => l.active);

  return (
    <div className="space-y-6">
      <AdminSetupSearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search approval requests, requester, or action title..."
        quickStats={[
          {
            label: subTab === 'admin_pending_approvals' ? 'Pending Queue' : 'Filtered Items',
            value: subTab === 'admin_pending_approvals' ? pendingRequests.length : pastRequests.length,
            color: 'text-amber-400',
          },
          {
            label: 'Active Levels',
            value: activeLevels.length,
            color: 'text-emerald-600',
          },
        ]}
      />

      {subTab === 'admin_approval_levels' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Hierarchy of Approval Levels</h3>
            <button
              type="button"
              onClick={() => setLevelForm({ open: true, initial: null })}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add Level
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-semibold">Loading approval levels…</span>
            </div>
          ) : levels.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 space-y-2 shadow-xs">
              <Layers className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs">No approval levels configured yet. Add the first level to define the sign-off hierarchy.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {levels.map((al) => (
                <div key={al.id} className={`bg-white p-5 rounded-xl border space-y-3 shadow-xs relative overflow-hidden ${al.active ? 'border-slate-200' : 'border-rose-200 bg-rose-50/40'}`}>
                  <div className="absolute top-0 right-0 bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-emerald-200">
                    Level {al.levelNo}
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{al.roleLabel}</h4>
                  <div className="text-emerald-700 font-mono font-bold text-xs">
                    {fmtNPR(al.minAmount)} – {fmtNPR(al.maxAmount)}
                  </div>
                  <p className="text-slate-500 text-xs">{al.scope || '—'}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${al.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                      {al.active ? 'Active' : 'Inactive'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setLevelForm({ open: true, initial: al })}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleLevelDelete(al)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. APPROVAL MATRIX */}
      {subTab === 'admin_approval_matrix' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Dual-Control Workflow Approval Matrix</h3>
            <button
              type="button"
              onClick={() => setMatrixForm({ open: true, initial: null })}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add Rule
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Module Action</th>
                  <th className="p-3">Threshold Amount</th>
                  <th className="p-3">Required Signatory 1</th>
                  <th className="p-3">Required Signatory 2</th>
                  <th className="p-3">SMS Notification</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin inline-block mr-2 align-middle" />
                      <span className="align-middle">Loading matrix…</span>
                    </td>
                  </tr>
                ) : rules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No matrix rules configured yet.
                    </td>
                  </tr>
                ) : rules.map((r) => (
                  <tr key={r.id} className={`hover:bg-slate-50 ${r.active ? '' : 'opacity-50'}`}>
                    <td className="p-3 font-bold text-slate-900">{r.requestType}</td>
                    <td className="p-3 font-mono text-emerald-700">{fmtThreshold(r)}</td>
                    <td className="p-3">{r.signatory1Role}</td>
                    <td className="p-3 text-emerald-700 font-bold">{r.signatory2Role || '—'}</td>
                    <td className="p-3">{r.smsNotify ? <span className="text-emerald-700 font-bold">✓</span> : <span className="text-slate-600">✗</span>}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setMatrixForm({ open: true, initial: r })}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRuleDelete(r)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. PENDING QUEUE */}
      {subTab === 'admin_pending_approvals' && (
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Pending Approval Queue ({pendingRequests.length})</h3>
          {pendingRequests.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 space-y-2 shadow-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="text-xs">No pending approval requests in queue. All workflows up-to-date!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <div key={req.id} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">
                        {req.requestType}
                      </span>
                      <span className="font-bold text-slate-900 text-xs">{req.referenceNo}</span>
                      <span className="text-slate-500 text-[11px] font-mono">Date: {req.requestedDateBs}</span>
                    </div>
                    <p className="text-slate-600 text-xs">{req.description}</p>
                    <div className="text-emerald-700 font-mono font-bold text-sm">Amount: NPR {req.amount.toLocaleString()}</div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => void handleDecision(req, 'Rejected')}
                      disabled={decidingId === req.id}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {decidingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDecision(req, 'Approved')}
                      disabled={decidingId === req.id}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {decidingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve Request
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. APPROVAL HISTORY */}
      {subTab === 'admin_approval_history' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
          <h3 className="font-bold text-slate-900 text-sm">Completed Approval Decision Logs</h3>
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px] uppercase">
                <tr>
                  <th className="p-3">Ref No & Type</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Requested By</th>
                  <th className="p-3">Decision Sign-off</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {pastRequests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">
                      <div>{r.referenceNo}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{r.requestType}</div>
                    </td>
                    <td className="p-3 font-mono text-emerald-700 font-bold">NPR {r.amount.toLocaleString()}</td>
                    <td className="p-3 text-slate-600">{r.requestedBy}</td>
                    <td className="p-3 text-slate-500">{r.approvedBy || 'System'}</td>
                    <td className="p-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ r.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-700 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-600 border border-rose-500/30' }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {levelForm.open && (
        <ApprovalLevelForm
          initial={levelForm.initial}
          onClose={() => setLevelForm({ open: false, initial: null })}
          onSaved={handleLevelSaved}
          onError={notifyError}
        />
      )}
      {matrixForm.open && (
        <ApprovalMatrixForm
          initial={matrixForm.initial}
          onClose={() => setMatrixForm({ open: false, initial: null })}
          onSaved={handleRuleSaved}
          onError={notifyError}
        />
      )}
    </div>
  );
};
