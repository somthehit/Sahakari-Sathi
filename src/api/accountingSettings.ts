import { apiClient } from '../lib/apiClient';

export type AccountingSettingsEntityType =
  | 'voucher-types'
  | 'cost-centers'
  | 'journal-templates'
  | 'financial-periods'
  | 'banks'
  | 'bank-accounts'
  | 'cash-counters'
  | 'payment-methods';

export interface AccountingSettingBase {
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
  usageCount: number;
}

export interface VoucherType extends AccountingSettingBase {
  category: string;
  prefix: string;
  numberingRule: string;
  padding: number;
  defaultDebitAccountId: string | null;
  defaultCreditAccountId: string | null;
  requiresApproval: boolean;
  requiresNarration: boolean;
  requiresCostCenter: boolean;
  requiresReference: boolean;
  isBranchScoped: boolean;
  allowBackdate: boolean;
}

export interface CostCenter extends AccountingSettingBase {
  parentId: string | null;
  branchId: string | null;
  managerId: string | null;
  managerName: string | null;
}

export interface JournalTemplateEntry {
  id?: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  entryType: 'debit' | 'credit';
  amountType: 'amount' | 'percent';
  amount: number;
  costCenterId: string | null;
  description: string | null;
  sortOrder: number;
}

export interface JournalTemplate extends AccountingSettingBase {
  voucherTypeId: string | null;
  narrationTemplate: string | null;
  frequency: string;
  branchId: string | null;
  entries: JournalTemplateEntry[];
}

export interface FinancialPeriod extends AccountingSettingBase {
  fiscalYearId: string | null;
  fiscalYearCode: string;
  startDateBs: string;
  endDateBs: string;
  startDateAd: string;
  endDateAd: string;
  status: 'draft' | 'open' | 'locked' | 'closed';
  isCurrent: boolean;
  closedAt: string | null;
  closedBy: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  reason: string | null;
}

export interface Bank extends AccountingSettingBase {
  swiftCode: string | null;
  shortName: string | null;
}

export interface BankAccount {
  id: string;
  organizationId: string;
  bankId: string;
  accountName: string;
  accountNumber: string;
  branchId: string | null;
  currency: string;
  glAccountId: string | null;
  accountType: string;
  openingBalance: number;
  openingDateBs: string | null;
  isPrimary: boolean;
  reconciliationEnabled: boolean;
  lastReconciledDateBs: string | null;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export interface CashCounter extends AccountingSettingBase {
  branchId: string;
  assignedUserId: string | null;
  glCashAccountId: string | null;
  openingBalance: number;
  maxCashLimit: number | null;
}

export interface PaymentMethod extends AccountingSettingBase {
  type: string;
  requiresReference: boolean;
  requiresBank: boolean;
  requiresChequeNumber: boolean;
  requiresTransactionId: boolean;
  glAccountId: string | null;
}

export interface ChartAccount {
  id: string;
  code: string;
  name: string;
  nameNepali: string | null;
  type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
  parentCode: string | null;
  groupId: string | null;
  balance: number;
  normalBalance: 'debit' | 'credit';
  allowPosting: boolean;
  isSystemAccount: boolean;
  isControlAccount: boolean;
  cashBankAccount: boolean;
  reconciliationRequired: boolean;
  costCenterRequired: boolean;
  displayOrder: number;
  branchId: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountGroup {
  id: string;
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
  parentId: string | null;
  isSystem: boolean;
  createdAt: string;
}

export interface CoaData {
  accounts: ChartAccount[];
  groups: AccountGroup[];
}

export interface SystemMapping {
  mappingKey: string;
  mapped: boolean;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  description: string | null;
  isCustom?: boolean;
}

export interface AccountingHealth {
  counts: {
    chartOfAccounts: number;
    accountGroups: number;
    voucherTypes: number;
    costCenters: number;
    journalTemplates: number;
    financialPeriods: number;
    banks: number;
    bankAccounts: number;
    cashCounters: number;
    paymentMethods: number;
    systemAccountMappings: number;
  };
  status: {
    currentPeriod: { id: string; code: string; status: string } | null;
    openPeriods: number;
    postingEnabledAccounts: number;
  };
  systemMappings: { mapped: number; total: number; unmapped: string[] };
  warnings: string[];
  healthy: boolean;
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

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

const nullish = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v));

const normalizeBase = (row: any): AccountingSettingBase => ({
  id: str(row.id),
  organizationId: str(row.organizationId),
  code: str(row.code),
  name: str(row.name),
  nameNepali: nullish(row.nameNepali),
  description: nullish(row.description),
  isActive: row.isActive !== false,
  sortOrder: toInt(row.sortOrder),
  isSystem: row.isSystem === true,
  createdAt: str(row.createdAt),
  updatedAt: str(row.updatedAt),
  usageCount: toInt(row.usageCount),
});

export function normalizeSetting(row: any, entityType: AccountingSettingsEntityType): any {
  const base = { ...normalizeBase(row) };
  switch (entityType) {
    case 'voucher-types':
      return {
        ...base,
        category: str(row.category) || 'Journal',
        prefix: str(row.prefix) || 'JV',
        numberingRule: str(row.numberingRule) || 'fiscal_year',
        padding: toInt(row.padding),
        defaultDebitAccountId: nullish(row.defaultDebitAccountId),
        defaultCreditAccountId: nullish(row.defaultCreditAccountId),
        requiresApproval: row.requiresApproval === true,
        requiresNarration: row.requiresNarration !== false,
        requiresCostCenter: row.requiresCostCenter === true,
        requiresReference: row.requiresReference === true,
        isBranchScoped: row.isBranchScoped === true,
        allowBackdate: row.allowBackdate !== false,
      };
    case 'cost-centers':
      return {
        ...base,
        parentId: nullish(row.parentId),
        branchId: nullish(row.branchId),
        managerId: nullish(row.managerId),
        managerName: nullish(row.managerName),
      };
    case 'journal-templates':
      return {
        ...base,
        voucherTypeId: nullish(row.voucherTypeId),
        narrationTemplate: nullish(row.narrationTemplate),
        frequency: str(row.frequency) || 'manual',
        branchId: nullish(row.branchId),
        entries: Array.isArray(row.entries)
          ? row.entries.map((e: any) => ({
              id: str(e.id),
              accountId: str(e.accountId),
              accountCode: str(e.accountCode),
              accountName: str(e.accountName),
              entryType: e.entryType === 'credit' ? 'credit' : 'debit',
              amountType: e.amountType === 'percent' ? 'percent' : 'amount',
              amount: toNum(e.amount),
              costCenterId: nullish(e.costCenterId),
              description: nullish(e.description),
              sortOrder: toInt(e.sortOrder),
            }))
          : [],
      };
    case 'financial-periods':
      return {
        ...base,
        fiscalYearId: nullish(row.fiscalYearId),
        fiscalYearCode: str(row.fiscalYearCode),
        startDateBs: str(row.startDateBs),
        endDateBs: str(row.endDateBs),
        startDateAd: str(row.startDateAd),
        endDateAd: str(row.endDateAd),
        status: row.status || 'draft',
        isCurrent: row.isCurrent === true,
        closedAt: nullish(row.closedAt),
        closedBy: nullish(row.closedBy),
        lockedAt: nullish(row.lockedAt),
        lockedBy: nullish(row.lockedBy),
        reason: nullish(row.reason),
      };
    case 'banks':
      return {
        ...base,
        swiftCode: nullish(row.swiftCode),
        shortName: nullish(row.shortName),
      };
    case 'bank-accounts':
      return {
        id: str(row.id),
        organizationId: str(row.organizationId),
        bankId: str(row.bankId),
        accountName: str(row.accountName),
        accountNumber: str(row.accountNumber),
        branchId: nullish(row.branchId),
        currency: str(row.currency) || 'NPR',
        glAccountId: nullish(row.glAccountId),
        glBalance: Number(row.glBalance) || 0,
        accountType: str(row.accountType) || 'Current',
        openingBalance: toNum(row.openingBalance),
        openingDateBs: nullish(row.openingDateBs),
        isPrimary: row.isPrimary === true,
        reconciliationEnabled: row.reconciliationEnabled === true,
        lastReconciledDateBs: nullish(row.lastReconciledDateBs),
        isActive: row.isActive !== false,
        isSystem: row.isSystem === true,
        createdAt: str(row.createdAt),
        updatedAt: str(row.updatedAt),
        usageCount: toInt(row.usageCount),
      };
    case 'cash-counters':
      return {
        ...base,
        branchId: str(row.branchId),
        assignedUserId: nullish(row.assignedUserId),
        glCashAccountId: nullish(row.glCashAccountId),
        openingBalance: toNum(row.openingBalance),
        maxCashLimit: row.maxCashLimit !== null && row.maxCashLimit !== undefined ? toNum(row.maxCashLimit) : null,
      };
    case 'payment-methods':
      return {
        ...base,
        type: str(row.type) || 'Other',
        requiresReference: row.requiresReference === true,
        requiresBank: row.requiresBank === true,
        requiresChequeNumber: row.requiresChequeNumber === true,
        requiresTransactionId: row.requiresTransactionId === true,
        glAccountId: nullish(row.glAccountId),
      };
  }
  return base;
}

export const fetchAccountingSettings = async (entityType: AccountingSettingsEntityType): Promise<any[]> => {
  try {
    const { data } = await apiClient.get(`/accounting/settings/${entityType}`);
    const rows = Array.isArray(data) ? data : [];
    return rows.map((row: any) => normalizeSetting(row, entityType));
  } catch (error: any) {
    console.error(`[fetchAccountingSettings:${entityType}] failed:`, error?.response?.data || error?.message);
    return [];
  }
};

export const createAccountingSetting = async (entityType: AccountingSettingsEntityType, body: Record<string, any>): Promise<any> => {
  const { data } = await apiClient.post(`/accounting/settings/${entityType}`, body);
  return data;
};

export const updateAccountingSetting = async (entityType: AccountingSettingsEntityType, id: string, body: Record<string, any>): Promise<any> => {
  const { data } = await apiClient.put(`/accounting/settings/${entityType}/${id}`, body);
  return data;
};

export const deleteAccountingSetting = async (entityType: AccountingSettingsEntityType, id: string): Promise<void> => {
  await apiClient.delete(`/accounting/settings/${entityType}/${id}`);
};

export const fetchCoa = async (): Promise<CoaData> => {
  try {
    const { data } = await apiClient.get('/accounting/settings/coa');
    return {
      accounts: Array.isArray(data?.accounts) ? data.accounts : [],
      groups: Array.isArray(data?.groups) ? data.groups : [],
    };
  } catch (error: any) {
    console.error('[fetchCoa] failed:', error?.response?.data || error?.message);
    return { accounts: [], groups: [] };
  }
};

export const createAccount = async (body: Record<string, any>): Promise<any> => {
  const { data } = await apiClient.post('/accounting/settings/coa/accounts', body);
  return data;
};

export const updateAccount = async (id: string, body: Record<string, any>): Promise<any> => {
  const { data } = await apiClient.put(`/accounting/settings/coa/accounts/${id}`, body);
  return data;
};

export const deleteAccount = async (id: string): Promise<void> => {
  await apiClient.delete(`/accounting/settings/coa/accounts/${id}`);
};

export const fetchAccountGroups = async (): Promise<AccountGroup[]> => {
  try {
    const { data } = await apiClient.get('/accounting/settings/coa/groups');
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error('[fetchAccountGroups] failed:', error?.response?.data || error?.message);
    return [];
  }
};

export const createAccountGroup = async (body: Record<string, any>): Promise<any> => {
  const { data } = await apiClient.post('/accounting/settings/coa/groups', body);
  return data;
};

export const updateAccountGroup = async (id: string, body: Record<string, any>): Promise<any> => {
  const { data } = await apiClient.put(`/accounting/settings/coa/groups/${id}`, body);
  return data;
};

export const deleteAccountGroup = async (id: string): Promise<void> => {
  await apiClient.delete(`/accounting/settings/coa/groups/${id}`);
};

export const fetchSystemMappings = async (): Promise<SystemMapping[]> => {
  try {
    const { data } = await apiClient.get('/accounting/settings/system-mappings');
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error('[fetchSystemMappings] failed:', error?.response?.data || error?.message);
    return [];
  }
};

export const saveSystemMappings = async (mappings: { mappingKey: string; accountId: string | null; description?: string | null }[]): Promise<void> => {
  await apiClient.put('/accounting/settings/system-mappings', { mappings });
};

export const fetchAccountingHealth = async (): Promise<AccountingHealth | null> => {
  try {
    const { data } = await apiClient.get('/accounting/settings/health');
    return data;
  } catch (error: any) {
    console.error('[fetchAccountingHealth] failed:', error?.response?.data || error?.message);
    return null;
  }
};

export const transitionFinancialPeriod = async (id: string, status: string, reason?: string): Promise<any> => {
  const { data } = await apiClient.post(`/accounting/settings/financial-periods/${id}/status`, { status, reason });
  return data;
};

// ---------------------------------------------------------------------------
// Bulk COA import & standard template seeding
// ---------------------------------------------------------------------------
export type CoaAccountType = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';

export interface CoaBulkRow {
  glCode: string;
  accountName: string;
  accountType: CoaAccountType;
  parentGlCode?: string | null;
  isPostingAllowed?: boolean;
  openingBalance?: number;
  normalBalance?: 'debit' | 'credit';
  isControlAccount?: boolean;
}

export interface CoaImportResult {
  success: boolean;
  importedCount: number;
  updatedCount?: number;
  skippedCount?: number;
  seededCount?: number;
  failedCount: number;
  errors?: string[];
  message: string;
}

export const bulkImportCoa = async (records: CoaBulkRow[]): Promise<CoaImportResult> => {
  const { data } = await apiClient.post('/accounting/settings/coa/bulk-import', { records });
  return data;
};

export const seedDefaultCoa = async (overlayExisting = false): Promise<CoaImportResult> => {
  const { data } = await apiClient.post('/accounting/settings/coa/seed-default', { overlayExisting });
  return data;
};

export const ACCOUNTING_ENTITY_LABELS: Record<string, string> = {
  'voucher-types': 'Voucher Type',
  'cost-centers': 'Cost Center',
  'journal-templates': 'Journal Template',
  'financial-periods': 'Financial Period',
  banks: 'Bank',
  'bank-accounts': 'Bank Account',
  'cash-counters': 'Cash Counter',
  'payment-methods': 'Payment Method',
};

// ─── Bank Account Detail ──────────────────────────────────────────────────────

export interface BankAccountDetailLeaf {
  id: string;
  chequeNumber: string;
  leafNo: number;
  chequeBookId: string;
  status: 'unused' | 'issued' | 'cancelled' | 'cleared';
  payeeName: string | null;
  amount: string | null;
  chequeDateBs: string | null;
  loanId: string | null;
  voucherId: string | null;
  usedAt: string | null;
  clearedAt: string | null;
  cancelReason: string | null;
  createdAt: string;
}

export interface BankAccountDetailBook {
  id: string;
  bookNumber: string;
  prefix: string | null;
  leafStartNumber: number;
  leafEndNumber: number;
  leafCount: number;
  issuedDateBs: string;
  status: string;
  purpose: string | null;
  leafNumbersJson: string | null;
  cancelReason: string | null;
  createdAt: string;
}

export interface BankAccountDetail {
  bankAccount: BankAccount & {
    bankName: string | null;
    bankCode: string | null;
    glAccountName: string | null;
    glAccountCode: string | null;
  };
  chequeBooks: BankAccountDetailBook[];
  chequeLeaves: BankAccountDetailLeaf[];
  glBalance: number;
  leafStatusCounts: { unused: number; issued: number; cancelled: number; cleared: number };
}

export interface BankTransaction {
  id: string;
  voucherId: string;
  voucherNo: string;
  voucherType: string;
  dateBs: string;
  dateAd: string;
  narration: string;
  debit: number;
  credit: number;
  runningBalance: number;
  chequeNumber: string | null;
  chequeStatus: string | null;
  chequeLeafId: string | null;
  moduleReference: string | null;
}

export const fetchBankAccountDetail = async (id: string): Promise<BankAccountDetail> => {
  const { data } = await apiClient.get(`/accounting/settings/bank-accounts/${id}/detail`);
  return data;
};

export interface BankBalanceSummary {
  id: string;
  accountName: string;
  accountNumber: string;
  openingBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  currentBalance: number;
  transactionCount: number;
}

export const fetchBankBalanceSummaries = async (): Promise<BankBalanceSummary[]> => {
  const { data } = await apiClient.get('/accounting/settings/bank-accounts/balance-summaries');
  return data;
};

export const fetchBankTransactions = async (
  bankAccountId: string,
  opts?: { startDate?: string; endDate?: string; chequeOnly?: boolean },
): Promise<{ transactions: BankTransaction[]; glBalance: number; openingBalance: number }> => {
  const params: Record<string, string> = {};
  if (opts?.startDate) params.startDate = opts.startDate;
  if (opts?.endDate) params.endDate = opts.endDate;
  if (opts?.chequeOnly) params.chequeOnly = 'true';
  const { data } = await apiClient.get(`/accounting/settings/bank-accounts/${bankAccountId}/transactions`, { params });
  return data;
};

export const clearBankChequeLeaf = async (leafId: string): Promise<{ success: boolean; message: string }> => {
  const { data } = await apiClient.patch(`/bank-cheques/${leafId}/clear`);
  return data;
};

export const bounceBankChequeLeaf = async (leafId: string, reason: string): Promise<{ success: boolean; message: string }> => {
  const { data } = await apiClient.patch(`/bank-cheques/${leafId}/bounce`, { reason });
  return data;
};

export interface BankDepositResult {
  success: boolean;
  voucher: any;
  entries: any[];
  totalDebit: number;
  totalCredit: number;
}

export const createBankDeposit = async (
  bankAccountId: string,
  data: {
    amount: number;
    sourceAccountId: string;
    dateBs: string;
    narration?: string;
    branchId?: string;
    invoiceNumber?: string;
  },
): Promise<BankDepositResult> => {
  const { data: result } = await apiClient.post(`/accounting/settings/bank-accounts/${bankAccountId}/deposit`, data);
  return result;
};

export const voidVoucher = async (
  voucherId: string,
  reason: string,
): Promise<{ success: boolean; reversalVoucherNo: string; message: string }> => {
  const { data } = await apiClient.post(`/accounting/settings/bank-accounts/void-voucher/${voucherId}`, { reason });
  return data;
};
