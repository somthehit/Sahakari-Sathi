import { apiClient } from '../lib/apiClient';
import type {
  SubsidiaryBooksPayload,
  SubsidiaryShare,
  SubsidiarySaving,
  SubsidiaryLoan,
  SubsidiaryShareAccount,
  SubsidiarySavingAccount,
  SubsidiaryLoanAccount,
  MemberFinancialSummary,
} from '../types/coop';

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

const normalizeShare = (row: any): SubsidiaryShare => ({
  id: row?.id ?? '',
  memberId: row?.memberId ?? '',
  memberNo: row?.memberNo ?? undefined,
  memberName: row?.memberName ?? undefined,
  voucherNo: row?.voucherNo ?? '',
  transactionDateBs: row?.transactionDateBs ?? '',
  transactionType: row?.transactionType ?? 'Purchase',
  shareQuantity: num(row?.shareQuantity),
  faceValue: num(row?.faceValue),
  debitAmount: num(row?.debitAmount),
  creditAmount: num(row?.creditAmount),
  balanceAmount: num(row?.balanceAmount),
  createdAt: row?.createdAt ?? undefined,
});

const normalizeSaving = (row: any): SubsidiarySaving => ({
  id: row?.id ?? '',
  memberId: row?.memberId ?? '',
  memberNo: row?.memberNo ?? undefined,
  memberName: row?.memberName ?? undefined,
  accountNo: row?.accountNo ?? '',
  accountType: row?.accountType ?? 'Mandatory',
  voucherNo: row?.voucherNo ?? '',
  transactionDateBs: row?.transactionDateBs ?? '',
  debitAmount: num(row?.debitAmount),
  creditAmount: num(row?.creditAmount),
  balanceAmount: num(row?.balanceAmount),
  createdAt: row?.createdAt ?? undefined,
});

const normalizeLoan = (row: any): SubsidiaryLoan => ({
  id: row?.id ?? '',
  memberId: row?.memberId ?? '',
  memberNo: row?.memberNo ?? undefined,
  memberName: row?.memberName ?? undefined,
  loanAccountNo: row?.loanAccountNo ?? '',
  voucherNo: row?.voucherNo ?? '',
  transactionDateBs: row?.transactionDateBs ?? '',
  principalDebit: num(row?.principalDebit),
  principalCredit: num(row?.principalCredit),
  interestCredit: num(row?.interestCredit),
  penaltyCredit: num(row?.penaltyCredit),
  remainingPrincipal: num(row?.remainingPrincipal),
  createdAt: row?.createdAt ?? undefined,
});

const normalizeSummary = (row: any): MemberFinancialSummary => ({
  memberId: row?.memberId ?? '',
  memberNo: row?.memberNo ?? '',
  fullName: row?.fullName ?? '',
  phone: row?.phone ?? undefined,
  totalShareBalance: num(row?.totalShareBalance),
  totalSavingsBalance: num(row?.totalSavingsBalance),
  totalOutstandingLoan: num(row?.totalOutstandingLoan),
});

const normalizeShareAccount = (row: any): SubsidiaryShareAccount => ({
  memberId: row?.memberId ?? '',
  memberNo: row?.memberNo ?? '',
  memberName: row?.memberName ?? '',
  accountNo: row?.accountNo ?? '',
  totalShares: num(row?.totalShares),
  totalValue: num(row?.totalValue),
  status: row?.status ?? 'Inactive',
});

const normalizeSavingAccount = (row: any): SubsidiarySavingAccount => ({
  memberId: row?.memberId ?? '',
  memberNo: row?.memberNo ?? '',
  memberName: row?.memberName ?? '',
  accountNo: row?.accountNo ?? '',
  accountType: row?.accountType ?? 'regular',
  productName: row?.productName ?? '',
  balance: num(row?.balance),
  interestEarned: num(row?.interestEarned),
  status: row?.status ?? 'Active',
});

const normalizeLoanAccount = (row: any): SubsidiaryLoanAccount => ({
  memberId: row?.memberId ?? '',
  memberNo: row?.memberNo ?? '',
  memberName: row?.memberName ?? '',
  loanAccountNo: row?.loanAccountNo ?? '',
  productName: row?.productName ?? '',
  principalOutstanding: num(row?.principalOutstanding),
  interestDue: num(row?.interestDue),
  maturityDateBs: row?.maturityDateBs ?? undefined,
  status: row?.status ?? 'Active',
});

/** Fetch all three subsidiary books + the member financial summary in one call. */
export const fetchSubsidiaryBooks = async (): Promise<SubsidiaryBooksPayload> => {
  try {
    const { data } = await apiClient.get<SubsidiaryBooksPayload>('/subsidiary/books');
    return {
      shares: Array.isArray(data?.shares) ? data.shares.map(normalizeShare) : [],
      savings: Array.isArray(data?.savings) ? data.savings.map(normalizeSaving) : [],
      loans: Array.isArray(data?.loans) ? data.loans.map(normalizeLoan) : [],
      summary: Array.isArray(data?.summary) ? data.summary.map(normalizeSummary) : [],
      shareAccounts: Array.isArray(data?.shareAccounts) ? data.shareAccounts.map(normalizeShareAccount) : [],
      savingsAccounts: Array.isArray(data?.savingsAccounts) ? data.savingsAccounts.map(normalizeSavingAccount) : [],
      loanAccounts: Array.isArray(data?.loanAccounts) ? data.loanAccounts.map(normalizeLoanAccount) : [],
    };
  } catch (error: any) {
    console.error('[fetchSubsidiaryBooks] failed:', error?.response?.data || error?.message);
    return { shares: [], savings: [], loans: [], summary: [], shareAccounts: [], savingsAccounts: [], loanAccounts: [] };
  }
};
