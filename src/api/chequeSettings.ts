import { apiClient } from '../lib/apiClient';

export interface ChequeSettingsData {
  id?: string;
  organizationId?: string;
  branchId?: string | null;
  scope: 'organization' | 'branch';
  enableChequeFacility: boolean;
  eligibleAccountProductIds: string[];
  defaultLeavesPerBook: number;
  allowedBookSizes: number[];
  maxActiveBooksPerAccount: number;
  reissueAllowed: boolean;
  reissueAfterExhaustion: boolean;
  lostBookReplacementAllowed: boolean;
  cancelledBookReplacementAllowed: boolean;
  numberingScope: 'account_wise' | 'product_wise' | 'branch_wise' | 'org_wise';
  startingChequeNumber: number;
  chequePrefix: string;
  numberLength: number;
  allowManualNumberAssignment: boolean;
  preventDuplicateChequeNumbers: boolean;
  validityPeriodDays: number;
  expiredChequeBehavior: 'flag_only' | 'reject_presentation' | 'require_approval';
  stopPaymentEnabled: boolean;
  allowStopPaymentBy: string[];
  stopPaymentCharge: number;
  allowStopPaymentOn: string[];
  stopPaymentRequireApproval: boolean;
  bounceHandlingEnabled: boolean;
  bounceCharge: number;
  maxBounceCount?: number | null;
  afterThresholdAction: 'flag_account' | 'require_manager_review' | 'suspend_cheque_facility' | 'require_approval' | 'no_automatic_action';
  issuanceChargeType: 'flat' | 'per_leaf' | 'both';
  issuanceChargeAmount: number;
  issuanceChargePerLeafAmount: number;
  lostBookCharge: number;
  replacementBookCharge: number;
  otherChequeCharges: any[];
  taxApplicable: boolean;
  taxRate: number;
  glIssuanceFeeAccountId?: string | null;
  glStopPaymentFeeAccountId?: string | null;
  glBounceFeeAccountId?: string | null;
  glReplacementFeeAccountId?: string | null;
  glOtherChargesFeeAccountId?: string | null;
}

export interface EligibleProduct {
  id: string;
  code: string;
  name: string;
  productType: string;
  chequeEnabled: boolean;
  isActive: boolean;
}

export interface ChequeBookRecord {
  id: string;
  bookNumber: string;
  prefix?: string;
  leafStartNumber: number;
  leafEndNumber: number;
  leafCount: number;
  issuedDateBs: string;
  issuedDateAd: string;
  status: 'active' | 'exhausted' | 'cancelled' | 'lost' | 'replaced';
  issuanceCharge: string | number;
  cancelReason?: string;
  accountId: string;
  accountNo: string;
  memberName?: string;
  memberNo?: string;
  branchId?: string;
  branchName?: string;
}

export interface ChequeLeafRecord {
  id: string;
  chequeNumber: string;
  leafNo: number;
  status: 'unused' | 'issued' | 'presented' | 'used' | 'cleared' | 'bounced' | 'stopped' | 'cancelled';
  payeeName?: string;
  amount?: string | number;
  chequeDateBs?: string;
  stopPaymentReason?: string;
  bounceReason?: string;
  chequeBookId: string;
  bookNumber: string;
  accountId: string;
  accountNo: string;
  memberName?: string;
}

export interface StopPaymentRecord {
  id: string;
  startChequeNumber: string;
  endChequeNumber: string;
  reason: string;
  chargeAmount: string | number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  requestedAt: string;
  approvedAt?: string;
  rejectionReason?: string;
  accountId: string;
  accountNo: string;
  memberName?: string;
}

export interface BounceRecord {
  id: string;
  chequeNumber: string;
  amount: string | number;
  bounceReason: string;
  bounceCharge: string | number;
  reportedDate: string;
  createdAt: string;
  accountId: string;
  accountNo: string;
  memberName?: string;
}

export const fetchChequeSettings = async (branchId?: string): Promise<ChequeSettingsData> => {
  const params = branchId ? { branchId, scope: 'branch' } : { scope: 'organization' };
  const { data } = await apiClient.get('/cheque-settings', { params });
  return data;
};

export const saveChequeSettings = async (payload: Partial<ChequeSettingsData>): Promise<ChequeSettingsData> => {
  const { data } = await apiClient.put('/cheque-settings', payload);
  return data;
};

export const fetchEligibleProducts = async (): Promise<EligibleProduct[]> => {
  const { data } = await apiClient.get('/cheque-settings/products');
  return Array.isArray(data) ? data : [];
};

export const fetchChequeBooksList = async (params?: { accountId?: string; branchId?: string; status?: string; search?: string }): Promise<ChequeBookRecord[]> => {
  const { data } = await apiClient.get('/cheque-books', { params });
  return Array.isArray(data) ? data : [];
};

export const issueChequeBookApi = async (payload: { accountId: string; leafCount?: number }): Promise<any> => {
  const { data } = await apiClient.post('/cheque-books', payload);
  return data;
};

export const updateBookStatusApi = async (id: string, status: string, reason?: string): Promise<any> => {
  const { data } = await apiClient.put(`/cheque-books/${id}/status`, { status, reason });
  return data;
};

export const fetchChequeLeavesList = async (params?: { accountId?: string; bookId?: string; status?: string; search?: string }): Promise<ChequeLeafRecord[]> => {
  const { data } = await apiClient.get('/cheque-leaves', { params });
  return Array.isArray(data) ? data : [];
};

export interface ChequeLeafSearchResult {
  id: string;
  chequeNumber: string;
  leafNo: number;
  status: string;
  chequeBookId: string;
  accountId: string;
  bookNumber: string;
  accountNo: string;
  memberId: string | null;
  memberName: string | null;
  balance: string | number;
  minBalance: string | number | null;
  savingsProductId: string | null;
}

export const searchChequeLeafByNumber = async (chequeNumber: string): Promise<ChequeLeafSearchResult> => {
  const { data } = await apiClient.get('/cheque-leaves/search', { params: { number: chequeNumber } });
  return data;
};

export const fetchStopPaymentsList = async (): Promise<StopPaymentRecord[]> => {
  const { data } = await apiClient.get('/cheque-stop-payments');
  return Array.isArray(data) ? data : [];
};

export const createStopPaymentApi = async (payload: { accountId: string; startChequeNumber: string; endChequeNumber: string; reason: string; chargeAmount?: number }): Promise<any> => {
  const { data } = await apiClient.post('/cheque-stop-payments', payload);
  return data;
};

export const approveStopPaymentApi = async (id: string): Promise<any> => {
  const { data } = await apiClient.post(`/cheque-stop-payments/${id}/approve`);
  return data;
};

export const rejectStopPaymentApi = async (id: string, reason?: string): Promise<any> => {
  const { data } = await apiClient.post(`/cheque-stop-payments/${id}/reject`, { reason });
  return data;
};

export const fetchBounceRegister = async (): Promise<BounceRecord[]> => {
  const { data } = await apiClient.get('/cheque-bounces');
  return Array.isArray(data) ? data : [];
};

export const recordBounceApi = async (payload: { accountId: string; chequeNumber: string; amount: number; bounceReason: string; bounceCharge?: number }): Promise<any> => {
  const { data } = await apiClient.post('/cheque-bounces', payload);
  return data;
};
