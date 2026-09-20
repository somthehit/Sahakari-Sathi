import { apiClient } from '../lib/apiClient';

export type SavingsSettingsEntityType = 'savings-products';

export const SAVINGS_SETTING_ENTITY_TYPES: SavingsSettingsEntityType[] = ['savings-products'];

export const SAVING_PRODUCT_TYPE_LABELS: Record<string, string> = {
  regular: 'Regular Savings',
  recurring: 'Recurring Deposit',
  fixed: 'Fixed Deposit',
  daily_deposit: 'Daily Deposit',
};

export const SAVING_INTEREST_METHOD_LABELS: Record<string, string> = {
  min_monthly_balance: 'Minimum Monthly Balance',
  daily_product: 'Daily Product',
  quarterly_min_balance: 'Quarterly Minimum Balance',
  simple: 'Simple',
  compound: 'Compound',
};

export const SAVING_POSTING_FREQUENCY_LABELS: Record<string, string> = {
  Daily: 'Daily',
  Monthly: 'Monthly',
  Quarterly: 'Quarterly',
  Half_Yearly: 'Half Yearly',
  Annually: 'Annually',
};

export interface SavingsSettingBase {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  nameNepali: string | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavingProduct extends SavingsSettingBase {
  productType: string;
  productCategory: string | null;
  accountNoPrefix: string;
  interestRate: number;
  interestPostingFrequency: string;
  interestCalculationMethod: string;
  interestEffectiveDate: string | null;
  minBalance: number;
  minDeposit: number;
  maxDeposit: number | null;
  maxBalance: number | null;
  tenureMonths: number | null;
  penaltyRate: number;
  eligibleMemberTypeIds: string[];
  minAge: number | null;
  maxAge: number | null;
  requiresKycVerified: boolean;
  requiresNominee: boolean;
  requiresPhoto: boolean;
  requiresSignature: boolean;
  requiresDocuments: boolean;
  openingDepositRequired: boolean;
  depositModeCash: boolean;
  depositModeBank: boolean;
  depositModeTransfer: boolean;
  depositModeAgent: boolean;
  dailyDepositLimit: number | null;
  monthlyDepositLimit: number | null;
  backdateDepositAllowed: boolean;
  depositRequiresApproval: boolean;
  withdrawalModeCash: boolean;
  withdrawalModeTransfer: boolean;
  minWithdrawal: number | null;
  maxWithdrawal: number | null;
  dailyWithdrawalLimit: number | null;
  monthlyWithdrawalLimit: number | null;
  minimumBalanceAfterWithdrawal: number | null;
  withdrawalRequiresApproval: boolean;
  minBalanceGraceDays: number;
  minBalancePenaltyPercent: number;
  minBalancePenaltyAmount: number;
  minBalancePenaltyFrequency: string;
  minBalanceWaiverAllowed: boolean;
  inactiveAfterMonths: number;
  dormantAfterMonths: number;
  notifyBeforeDormancyDays: number;
  reactivationRequired: boolean;
  reactivationApprovalRequired: boolean;
  closureAllowed: boolean;
  minimumBalanceBeforeClosure: number;
  closureRequiresApproval: boolean;
  closureFee: number;
  openingFee: number;
  monthlyMaintenanceFee: number;
  withdrawalFee: number;
  chequeBookFee: number;
  chequeLeafFee: number;
  stopPaymentFee: number;
  chequeReturnFee: number;
  passbookFee: number;
  statementFee: number;
  chequeEnabled: boolean;
  chequeDefaultLeaves: number;
  chequeMaxBooks: number;
  glLiabilityAccountId: string | null;
  glInterestExpenseAccountId: string | null;
  glInterestPayableAccountId: string | null;
  glFeeIncomeAccountId: string | null;
  glPenaltyIncomeAccountId: string | null;
  glChequeIncomeAccountId: string | null;
  rateHistory: { id: string; rate: number; effectiveFromBs: string; effectiveToBs: string | null }[];
  usageCount: number;
}

export interface ChequeBook {
  id: string;
  organizationId: string;
  accountId: string;
  accountNo: string;
  bookNo: string;
  firstLeafNo: number;
  leafCount: number;
  issueDateBs: string;
  issueDateAd: string;
  issuedById: string | null;
  status: string;
  createdAt: string;
}

const toNum = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : 0;
};

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

const normalizeBase = (row: any): SavingsSettingBase => ({
  id: str(row.id),
  organizationId: str(row.organizationId),
  code: str(row.code),
  name: str(row.name),
  nameNepali: row.nameNepali ? str(row.nameNepali) : null,
  description: row.description ? str(row.description) : null,
  isActive: row.isActive !== false,
  sortOrder: toInt(row.sortOrder),
  isSystem: row.isSystem === true,
  createdAt: str(row.createdAt),
  updatedAt: str(row.updatedAt),
});

const normalizeProduct = (row: any): SavingProduct => ({
  ...normalizeBase(row),
  productType: str(row.productType) || 'regular',
  productCategory: row.productCategory ? str(row.productCategory) : null,
  accountNoPrefix: str(row.accountNoPrefix) || 'SAV',
  interestRate: toNum(row.interestRate),
  interestPostingFrequency: str(row.interestPostingFrequency) || 'Monthly',
  interestCalculationMethod: str(row.interestCalculationMethod) || 'min_monthly_balance',
  interestEffectiveDate: row.interestEffectiveDate ? str(row.interestEffectiveDate) : null,
  minBalance: toNum(row.minBalance),
  minDeposit: toNum(row.minDeposit),
  maxDeposit: numOrNull(row.maxDeposit),
  maxBalance: numOrNull(row.maxBalance),
  tenureMonths: row.tenureMonths != null ? toInt(row.tenureMonths) : null,
  penaltyRate: toNum(row.penaltyRate),
  eligibleMemberTypeIds: Array.isArray(row.eligibleMemberTypeIds) ? row.eligibleMemberTypeIds : [],
  minAge: row.minAge != null ? toInt(row.minAge) : null,
  maxAge: row.maxAge != null ? toInt(row.maxAge) : null,
  requiresKycVerified: row.requiresKycVerified !== false,
  requiresNominee: row.requiresNominee !== false,
  requiresPhoto: row.requiresPhoto !== false,
  requiresSignature: row.requiresSignature !== false,
  requiresDocuments: row.requiresDocuments !== false,
  openingDepositRequired: row.openingDepositRequired !== false,
  depositModeCash: row.depositModeCash !== false,
  depositModeBank: row.depositModeBank !== false,
  depositModeTransfer: row.depositModeTransfer !== false,
  depositModeAgent: row.depositModeAgent !== false,
  dailyDepositLimit: numOrNull(row.dailyDepositLimit),
  monthlyDepositLimit: numOrNull(row.monthlyDepositLimit),
  backdateDepositAllowed: row.backdateDepositAllowed === true,
  depositRequiresApproval: row.depositRequiresApproval === true,
  withdrawalModeCash: row.withdrawalModeCash !== false,
  withdrawalModeTransfer: row.withdrawalModeTransfer !== false,
  minWithdrawal: numOrNull(row.minWithdrawal),
  maxWithdrawal: numOrNull(row.maxWithdrawal),
  dailyWithdrawalLimit: numOrNull(row.dailyWithdrawalLimit),
  monthlyWithdrawalLimit: numOrNull(row.monthlyWithdrawalLimit),
  minimumBalanceAfterWithdrawal: numOrNull(row.minimumBalanceAfterWithdrawal),
  withdrawalRequiresApproval: row.withdrawalRequiresApproval === true,
  minBalanceGraceDays: row.minBalanceGraceDays != null ? toInt(row.minBalanceGraceDays) : 0,
  minBalancePenaltyPercent: toNum(row.minBalancePenaltyPercent),
  minBalancePenaltyAmount: toNum(row.minBalancePenaltyAmount),
  minBalancePenaltyFrequency: str(row.minBalancePenaltyFrequency) || 'Monthly',
  minBalanceWaiverAllowed: row.minBalanceWaiverAllowed === true,
  inactiveAfterMonths: row.inactiveAfterMonths != null ? toInt(row.inactiveAfterMonths) : 3,
  dormantAfterMonths: row.dormantAfterMonths != null ? toInt(row.dormantAfterMonths) : 6,
  notifyBeforeDormancyDays: row.notifyBeforeDormancyDays != null ? toInt(row.notifyBeforeDormancyDays) : 30,
  reactivationRequired: row.reactivationRequired !== false,
  reactivationApprovalRequired: row.reactivationApprovalRequired === true,
  closureAllowed: row.closureAllowed !== false,
  minimumBalanceBeforeClosure: toNum(row.minimumBalanceBeforeClosure),
  closureRequiresApproval: row.closureRequiresApproval === true,
  closureFee: toNum(row.closureFee),
  openingFee: toNum(row.openingFee),
  monthlyMaintenanceFee: toNum(row.monthlyMaintenanceFee),
  withdrawalFee: toNum(row.withdrawalFee),
  chequeBookFee: toNum(row.chequeBookFee),
  chequeLeafFee: toNum(row.chequeLeafFee),
  stopPaymentFee: toNum(row.stopPaymentFee),
  chequeReturnFee: toNum(row.chequeReturnFee),
  passbookFee: toNum(row.passbookFee),
  statementFee: toNum(row.statementFee),
  chequeEnabled: row.chequeEnabled === true,
  chequeDefaultLeaves: row.chequeDefaultLeaves != null ? toInt(row.chequeDefaultLeaves) : 25,
  chequeMaxBooks: row.chequeMaxBooks != null ? toInt(row.chequeMaxBooks) : 1,
  glLiabilityAccountId: row.glLiabilityAccountId ? str(row.glLiabilityAccountId) : null,
  glInterestExpenseAccountId: row.glInterestExpenseAccountId ? str(row.glInterestExpenseAccountId) : null,
  glInterestPayableAccountId: row.glInterestPayableAccountId ? str(row.glInterestPayableAccountId) : null,
  glFeeIncomeAccountId: row.glFeeIncomeAccountId ? str(row.glFeeIncomeAccountId) : null,
  glPenaltyIncomeAccountId: row.glPenaltyIncomeAccountId ? str(row.glPenaltyIncomeAccountId) : null,
  glChequeIncomeAccountId: row.glChequeIncomeAccountId ? str(row.glChequeIncomeAccountId) : null,
  rateHistory: Array.isArray(row.rateHistory)
    ? row.rateHistory.map((r: any) => ({
        id: str(r.id),
        rate: toNum(r.rate),
        effectiveFromBs: str(r.effectiveFromBs),
        effectiveToBs: r.effectiveToBs ? str(r.effectiveToBs) : null,
      }))
    : [],
  usageCount: toInt(row.usageCount),
});

export const fetchSavingsSettings = async (entityType: SavingsSettingsEntityType): Promise<any[]> => {
  try {
    const { data } = await apiClient.get(`/savings-settings/${entityType}`);
    const rows = Array.isArray(data) ? data : [];
    if (entityType === 'savings-products') return rows.map(normalizeProduct);
    return rows.map((row: any) => ({ ...normalizeBase(row), usageCount: toInt(row.usageCount) }));
  } catch (error: any) {
    console.error(`[fetchSavingsSettings:${entityType}] failed:`, error?.response?.data || error?.message);
    return [];
  }
};

export const fetchSavingsSettingById = async (entityType: SavingsSettingsEntityType, id: string): Promise<any | null> => {
  try {
    const { data } = await apiClient.get(`/savings-settings/${entityType}/${id}`);
    if (entityType === 'savings-products') return normalizeProduct(data);
    return data;
  } catch (error: any) {
    console.error(`[fetchSavingsSettingById:${entityType}] failed:`, error?.response?.data || error?.message);
    return null;
  }
};

export const createSavingsSetting = async (entityType: SavingsSettingsEntityType, payload: Record<string, any>): Promise<any> => {
  const { data } = await apiClient.post(`/savings-settings/${entityType}`, payload);
  return data;
};

export const updateSavingsSetting = async (entityType: SavingsSettingsEntityType, id: string, payload: Record<string, any>): Promise<any> => {
  const { data } = await apiClient.put(`/savings-settings/${entityType}/${id}`, payload);
  return data;
};

export const deleteSavingsSetting = async (entityType: SavingsSettingsEntityType, id: string): Promise<any> => {
  const { data } = await apiClient.delete(`/savings-settings/${entityType}/${id}`);
  return data;
};

export const reorderSavingsSettings = async (entityType: SavingsSettingsEntityType, orderedIds: string[]): Promise<any> => {
  const { data } = await apiClient.patch(`/savings-settings/${entityType}/reorder`, { orderedIds });
  return data;
};

export const fetchDefaultSavingsProduct = async (): Promise<{ defaultSavingProductId: string | null; product: SavingProduct | null }> => {
  try {
    const { data } = await apiClient.get('/savings/settings/default-product');
    return {
      defaultSavingProductId: data?.defaultSavingProductId ? str(data.defaultSavingProductId) : null,
      product: data?.product ? normalizeProduct(data.product) : null,
    };
  } catch (error: any) {
    console.error('[fetchDefaultSavingsProduct] failed:', error?.response?.data || error?.message);
    return { defaultSavingProductId: null, product: null };
  }
};

export const setDefaultSavingsProduct = async (defaultSavingProductId: string | null): Promise<any> => {
  const { data } = await apiClient.put('/savings/settings/default-product', { defaultSavingProductId });
  return data;
};

export const fetchChequeBooks = async (accountId?: string): Promise<ChequeBook[]> => {
  try {
    const params = accountId ? { accountId } : {};
    const { data } = await apiClient.get('/savings-settings/cheque-books', { params });
    return (Array.isArray(data) ? data : []).map((row: any) => ({
      id: str(row.id),
      organizationId: str(row.organizationId),
      accountId: str(row.accountId),
      accountNo: str(row.accountNo),
      bookNo: str(row.bookNo),
      firstLeafNo: toInt(row.firstLeafNo),
      leafCount: toInt(row.leafCount),
      issueDateBs: str(row.issueDateBs),
      issueDateAd: str(row.issueDateAd),
      issuedById: row.issuedById ? str(row.issuedById) : null,
      status: str(row.status) || 'Issued',
      createdAt: str(row.createdAt),
    }));
  } catch (error: any) {
    console.error('[fetchChequeBooks] failed:', error?.response?.data || error?.message);
    return [];
  }
};

export const issueChequeBook = async (accountId: string, leafCount?: number): Promise<any> => {
  const { data } = await apiClient.post('/savings-settings/cheque-books', { accountId, leafCount });
  return data;
};

export const cancelChequeBook = async (id: string): Promise<any> => {
  const { data } = await apiClient.post(`/savings-settings/cheque-books/${id}/cancel`);
  return data;
};