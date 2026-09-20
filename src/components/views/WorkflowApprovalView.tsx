import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { fetchApprovalRequests, postApprovalDecision } from '../../api/approvals';
import { writeOffLoan } from '../../api/loanServicing';
import type { ApprovalRequestItem } from '../../api/approvals';

export const WorkflowApprovalView: React.FC = () => {
  const [requests, setRequests] = useState<ApprovalRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    const data = await fetchApprovalRequests();
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => { loadRequests(); }, []);

  const pendingRequests = requests.filter(a => a.status === 'Pending');

  const handleDecision = async (id: string, status: 'Approved' | 'Rejected', requestType?: string, description?: string) => {
    setProcessingId(id);
    try {
      // If approving a Loan_WriteOff, execute the write-off first
      if (status === 'Approved' && requestType === 'Loan_WriteOff' && description) {
        try {
          const writeOffData = JSON.parse(description);
          const writeOffResult = await writeOffLoan({
            loanId: writeOffData.loanId,
            dateBs: writeOffData.dateBs,
            principalAmount: writeOffData.principalAmount,
            interestAmount: writeOffData.interestAmount,
            reason: writeOffData.reason,
          });

          if (!writeOffResult.success) {
            alert(`Write-off failed: ${writeOffResult.error}`);
            setProcessingId(null);
            return;
          }
        } catch (parseError) {
          alert('Failed to parse write-off details.');
          setProcessingId(null);
          return;
        }
      }

      await postApprovalDecision(id, { status, remarks: status === 'Approved' ? 'Approved by manager' : 'Rejected by manager' });
      await loadRequests();
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Failed to process decision');
    } finally {
      setProcessingId(null);
    }
  };

  const getRequestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'Loan_Approval': 'Loan Approval',
      'Expense_Claim': 'Expense Claim',
      'Voucher_Post': 'Voucher Post',
      'Share_Transfer': 'Share Transfer',
      'Member_Exit': 'Member Exit',
      'Loan_WriteOff': 'Loan Write-Off',
    };
    return labels[type] || type;
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Manager Workflow Approvals Queue Inbox</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Multi-tier sign-off for high-value loans, expenses, and manual journal vouchers</span>
          </p>
        </div>
      </div>

      {/* Pending Items List */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-bold text-slate-900 text-base">Pending Sign-off Requests ({pendingRequests.length})</h2>

        {loading ? (
          <div className="py-12 text-center text-slate-500">
            <Clock className="w-6 h-6 text-slate-400 mx-auto mb-2 animate-spin" />
            Loading approval requests...
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            All workflow requests have been signed off!
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map(req => (
              <div key={req.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{req.referenceNo}</span>
                    <span className={`px-2 py-0.5 rounded font-mono font-semibold text-[10px] ${
                      req.requestType === 'Loan_WriteOff' 
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {getRequestTypeLabel(req.requestType)}
                    </span>
                  </div>
                  <div className="text-slate-600">
                    {req.requestType === 'Loan_WriteOff' && req.description ? (
                      <WriteOffDescription description={req.description} />
                    ) : (
                      req.description
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">Submitted by: <span className="text-slate-700 font-semibold">{req.requestedBy}</span> on {req.requestedDateBs} BS</div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-slate-500 block text-[10px]">Amount:</span>
                    <span className="font-mono font-bold text-emerald-800 text-sm">{formatNPR(req.amount)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDecision(req.id, 'Approved', req.requestType, req.description)}
                      disabled={processingId === req.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingId === req.id ? (
                        <Clock className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>Approve</span>
                    </button>

                    <button
                      onClick={() => handleDecision(req.id, 'Rejected')}
                      disabled={processingId === req.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

/** Renders a formatted description for Loan Write-Off requests. */
const WriteOffDescription: React.FC<{ description: string }> = ({ description }) => {
  try {
    const data = JSON.parse(description);
    return (
      <div className="space-y-1 text-[12px]">
        <div><span className="font-medium text-slate-700">Loan:</span> {data.loanNo}</div>
        <div><span className="font-medium text-slate-700">Member:</span> {data.memberName} ({data.memberNo})</div>
        <div><span className="font-medium text-slate-700">Principal:</span> <span className="text-rose-600 font-semibold">{formatNPR(data.principalAmount)}</span></div>
        {data.interestAmount > 0 && (
          <div><span className="font-medium text-slate-700">Interest:</span> <span className="text-rose-600 font-semibold">{formatNPR(data.interestAmount)}</span></div>
        )}
        <div><span className="font-medium text-slate-700">Reason:</span> {data.reason}</div>
      </div>
    );
  } catch {
    return <span>{description}</span>;
  }
};
