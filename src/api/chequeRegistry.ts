import { apiClient } from '../lib/apiClient';

/**
 * Read-side cheque API for the consolidated workspace: the unified leaf-level
 * register, organization dashboard statistics, and per-account cheque history.
 * Response shapes mirror ChequeRegistryController verbatim.
 */

export type ChequeLeafStatus =
  | 'unused' | 'issued' | 'presented' | 'used'
  | 'cleared' | 'bounced' | 'stopped' | 'cancelled';

/** One row of the unified leaf-level register. */
export interface ChequeRegisterRow {
  id: string;
  chequeNumber: string;
  leafNo: number;
  status: ChequeLeafStatus;
  payeeName?: string | null;
  amount?: string | number | null;
  chequeDateBs?: string | null;
  stopPaymentReason?: string | null;
  bounceReason?: string | null;
  chequeBookId: string;
  bookNumber: string;
  bookStatus: string;
  issuedDateBs: string;
  accountId: string;
  accountNo: string;
  memberId?: string | null;
  memberName?: string | null;
  memberNo?: string | null;
  branchId?: string | null;
  branchName?: string | null;
}

export interface ChequeRegisterResponse {
  rows: ChequeRegisterRow[];
  total: number;
  page: number;
  limit: number;
}

export interface ChequeRegisterParams {
  accountId?: string;
  bookId?: string;
  branchId?: string;
  status?: string;
  search?: string;
  fromBs?: string;
  toBs?: string;
  page?: number;
  limit?: number;
}

export const fetchChequeRegister = async (params: ChequeRegisterParams = {}): Promise<ChequeRegisterResponse> => {
  const { data } = await apiClient.get('/cheque-register', { params });
  return {
    rows: Array.isArray(data?.rows) ? data.rows : [],
    total: Number(data?.total) || 0,
    page: Number(data?.page) || 1,
    limit: Number(data?.limit) || 50,
  };
};

/** Organization-wide dashboard counters. */
export interface ChequeStats {
  books: { total: number; byStatus: Record<string, number>; active: number };
  leaves: { total: number; byStatus: Record<string, number> };
  stopPayments: { total: number; byStatus: Record<string, number>; pending: number };
  bounces: { total: number; amount: number; charges: number };
  charges: { issuanceTotal: number };
}

export const fetchChequeStats = async (): Promise<ChequeStats> => {
  const { data } = await apiClient.get('/cheque-stats');
  return data;
};

/** Per-account cheque history bundle. */
export interface ChequeAccountHistory {
  account: {
    id: string;
    accountNo: string;
    status: string;
    memberId?: string | null;
    memberName?: string | null;
    memberNo?: string | null;
    branchId?: string | null;
    branchName?: string | null;
  };
  books: any[];
  leaves: {
    id: string;
    chequeNumber: string;
    leafNo: number;
    status: ChequeLeafStatus;
    payeeName?: string | null;
    amount?: string | number | null;
    chequeDateBs?: string | null;
    chequeBookId: string;
    bookNumber: string;
  }[];
  stopPayments: any[];
  bounces: any[];
  summary: {
    totalBooks: number;
    activeBooks: number;
    totalLeaves: number;
    leafByStatus: Record<string, number>;
    pendingStopPayments: number;
    approvedStopPayments: number;
    totalBounces: number;
  };
}

export const fetchChequeAccountHistory = async (accountId: string): Promise<ChequeAccountHistory> => {
  const { data } = await apiClient.get(`/cheque-accounts/${accountId}/history`);
  return data;
};
