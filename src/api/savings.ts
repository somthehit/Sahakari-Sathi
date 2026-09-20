/**
 * Frontend API client for the Savings & Deposits module.
 *
 * Talks to the Express/Drizzle endpoints exposed by `src/api/routes`:
 *   GET  /savings/:id/statement   → ledger statement (opening/closing, running balance)
 *   GET  /savings/:id             → single account
 *   GET  /savings                 → paginated account list
 *   POST /savings/transaction     → record a teller deposit/withdrawal/interest entry
 */
import { apiClient } from '../lib/apiClient';
import type { SavingsAccount, SavingsTransaction } from '../types/coop';

export interface SavingsStatementTxn extends Omit<SavingsTransaction, 'amount' | 'balanceAfter'> {
  amount: number;
  balanceAfter: number;
  runningBalance: number;
}

export interface SavingsStatement {
  account: SavingsAccount;
  transactions: SavingsStatementTxn[];
  openingBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  closingBalance: number;
}

export interface SavingsStatementParams {
  dateFromBs?: string;
  dateToBs?: string;
  type?: string;
}

export interface SavingsAccountFilter {
  search?: string;
  branchId?: string;
  memberId?: string;
  productType?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface RecordTransactionPayload {
  accountId: string;
  memberId: string;
  type: 'Deposit' | 'Withdrawal' | 'Interest_Posting' | 'Transfer_In' | 'Transfer_Out';
  amount: number;
  voucherNo: string;
  dateBs: string;
  dateAd: string;
  tellerName: string;
  paymentMode: 'Cash' | 'Bank_Transfer' | 'Internal_Transfer' | 'Collection_Agent';
  branchId: string;
  remarks?: string;
}

/** Raw account/transaction rows returned by the DB use numeric strings for money. */
function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeAccount(row: any): SavingsAccount {
  return {
    id: row.id,
    accountNo: row.accountNo,
    memberId: row.memberId,
    memberName: row.memberName,
    memberNo: row.memberNo,
    savingsProductId: row.savingsProductId ?? undefined,
    productType: row.productType ?? 'regular',
    productName: row.productName,
    interestRate: toNumber(row.interestRate),
    balance: toNumber(row.balance),
    minBalance: toNumber(row.minBalance),
    openedDateBS: row.openedDateBs,
    maturityDateBS: row.maturityDateBs ?? undefined,
    monthlyInstallment: row.monthlyInstallment != null ? toNumber(row.monthlyInstallment) : undefined,
    branchId: row.branchId,
    collectionRouteId: row.collectionRouteId ?? undefined,
    status: row.status ?? 'Active',
    lastTransactionDateBS: row.lastTransactionDateBs,
  };
}

export function normalizeTransaction(row: any): SavingsTransaction {
  return {
    id: row.id,
    accountId: row.accountId,
    accountNo: row.accountNo,
    memberId: row.memberId,
    memberName: row.memberName,
    type: row.type,
    amount: toNumber(row.amount),
    balanceAfter: toNumber(row.balanceAfter),
    voucherNo: row.voucherNo,
    dateBS: row.dateBs,
    dateAD: row.dateAd,
    tellerName: row.tellerName,
    remarks: row.remarks ?? '',
    paymentMode: row.paymentMode,
    branchId: row.branchId,
  };
}

export async function getSavingsAccounts(filter: SavingsAccountFilter = {}) {
  const { data } = await apiClient.get('/savings', { params: filter });
  return {
    ...data,
    data: (data.data ?? []).map(normalizeAccount),
  };
}

export async function getSavingsAccount(id: string): Promise<SavingsAccount> {
  const { data } = await apiClient.get(`/savings/${id}`);
  return normalizeAccount(data);
}

export async function getAccountStatement(
  accountId: string,
  params: SavingsStatementParams = {}
): Promise<SavingsStatement> {
  const { data } = await apiClient.get(`/savings/${accountId}/statement`, { params });
  return {
    account: normalizeAccount(data.account),
    transactions: (data.transactions ?? []).map((t: any) => ({
      ...normalizeTransaction(t),
      runningBalance: toNumber(t.runningBalance),
    })),
    openingBalance: toNumber(data.openingBalance),
    totalDeposits: toNumber(data.totalDeposits),
    totalWithdrawals: toNumber(data.totalWithdrawals),
    closingBalance: toNumber(data.closingBalance),
  };
}

export async function recordSavingsTransaction(payload: RecordTransactionPayload) {
  const { data } = await apiClient.post('/savings/transaction', payload);
  return data;
}
