import { apiClient } from '../lib/apiClient';

export interface VoucherEntryPayload {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  narration?: string;
}

export interface CreateVoucherPayload {
  voucher: {
    voucherType: string;
    dateBs: string;
    dateAd: string;
    branchId: string;
    fiscalYearCode?: string;
    preparedBy: string;
    totalAmount: number;
    narration: string;
    status?: string;
  };
  entries: VoucherEntryPayload[];
}

export interface VoucherResponse {
  id: string;
  voucherNo: string;
  voucherType: string;
  dateBs: string;
  dateAd: string;
  status: string;
  totalAmount: number;
  narration: string;
  entries: Array<{
    id: string;
    accountId: string;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
  }>;
}

export interface LedgerRow {
  id: string;
  organizationId: string;
  accountId: string;
  fiscalYearCode: string;
  openingBalance: string;
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  branchId: string;
  lastUpdatedAt: string;
}

export const createVoucher = async (payload: CreateVoucherPayload): Promise<VoucherResponse> => {
  const { data } = await apiClient.post('/accounting/vouchers', payload);
  return data;
};

export const postVoucher = async (voucherId: string): Promise<VoucherResponse> => {
  const { data } = await apiClient.post(`/accounting/vouchers/${voucherId}/post`);
  return data;
};

export const fetchVouchers = async (params?: {
  search?: string;
  branchId?: string;
  voucherType?: string;
  status?: string;
  fiscalYearCode?: string;
  startDateBs?: string;
  endDateBs?: string;
  page?: number;
  limit?: number;
}) => {
  const { data } = await apiClient.get('/accounting/vouchers', { params });
  return data;
};

export const fetchLedgers = async (params?: {
  fiscalYearCode?: string;
  branchId?: string;
}): Promise<LedgerRow[]> => {
  const { data } = await apiClient.get('/accounting/ledgers', { params });
  return data;
};

export const backfillLedgers = async (): Promise<{ rebuilt: number }> => {
  const { data } = await apiClient.post('/accounting/ledgers/backfill');
  return data;
};
