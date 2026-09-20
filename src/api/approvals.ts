import { apiClient } from '../lib/apiClient';

export type ApprovalRequestType = 'Loan_Approval' | 'Expense_Claim' | 'Voucher_Post' | 'Share_Transfer' | 'Member_Exit' | 'Loan_WriteOff';

export interface ApprovalLevel {
  id: string;
  organizationId: string;
  levelNo: number;
  roleKey: string;
  roleLabel: string;
  minAmount: number;
  maxAmount: number | null;
  scope: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalMatrixRule {
  id: string;
  organizationId: string;
  requestType: ApprovalRequestType;
  thresholdMin: number;
  thresholdMax: number | null;
  signatory1Role: string;
  signatory2Role: string | null;
  smsNotify: boolean;
  active: boolean;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRequestItem {
  id: string;
  requestType: ApprovalRequestType;
  referenceNo: string;
  requestedBy: string;
  requestedDateBs: string;
  amount: number;
  description: string;
  branchId: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy: string | null;
  remarks: string | null;
  processedAt: string | null;
  createdAt: string;
}

// ── Approval Levels ────────────────────────────────────────────────────────────
export const fetchApprovalLevels = async (): Promise<ApprovalLevel[]> => {
  try {
    const { data } = await apiClient.get<ApprovalLevel[]>('/approvals/levels');
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error('[fetchApprovalLevels] failed:', error?.response?.data || error?.message);
    return [];
  }
};

export const createApprovalLevel = async (payload: Record<string, any>): Promise<ApprovalLevel> => {
  const { data } = await apiClient.post<ApprovalLevel>('/approvals/levels', payload);
  return data;
};

export const updateApprovalLevel = async (id: string, payload: Record<string, any>): Promise<ApprovalLevel> => {
  const { data } = await apiClient.put<ApprovalLevel>(`/approvals/levels/${id}`, payload);
  return data;
};

export const deleteApprovalLevel = async (id: string): Promise<void> => {
  await apiClient.delete(`/approvals/levels/${id}`);
};

// ── Approval Matrix ────────────────────────────────────────────────────────────
export const fetchApprovalMatrix = async (): Promise<ApprovalMatrixRule[]> => {
  try {
    const { data } = await apiClient.get<ApprovalMatrixRule[]>('/approvals/matrix');
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error('[fetchApprovalMatrix] failed:', error?.response?.data || error?.message);
    return [];
  }
};

export const createApprovalMatrixRule = async (payload: Record<string, any>): Promise<ApprovalMatrixRule> => {
  const { data } = await apiClient.post<ApprovalMatrixRule>('/approvals/matrix', payload);
  return data;
};

export const updateApprovalMatrixRule = async (id: string, payload: Record<string, any>): Promise<ApprovalMatrixRule> => {
  const { data } = await apiClient.put<ApprovalMatrixRule>(`/approvals/matrix/${id}`, payload);
  return data;
};

export const deleteApprovalMatrixRule = async (id: string): Promise<void> => {
  await apiClient.delete(`/approvals/matrix/${id}`);
};

// ── Approval Requests ─────────────────────────────────────────────────────────
export const fetchApprovalRequests = async (status?: string): Promise<ApprovalRequestItem[]> => {
  try {
    const { data } = await apiClient.get<ApprovalRequestItem[]>('/approvals', {
      params: status ? { status } : undefined,
    });
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error('[fetchApprovalRequests] failed:', error?.response?.data || error?.message);
    return [];
  }
};

export const postApprovalDecision = async (
  id: string,
  payload: { status: 'Approved' | 'Rejected'; remarks?: string },
): Promise<ApprovalRequestItem> => {
  const { data } = await apiClient.post<ApprovalRequestItem>(`/approvals/${id}/decision`, payload);
  return data;
};
