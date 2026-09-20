/**
 * Reconciliation API Client — Proper Bank Reconciliation
 */
import { apiClient } from '../lib/apiClient';

// =============================================
// Types
// =============================================
export interface ReconciliationSession {
  id: string;
  organizationId: string;
  branchId: string;
  reconciliationType: 'bank' | 'vault';
  bankAccountId: string | null;
  glAccountId: string;
  reconcileDateBs: string;
  reconcileDateAd: string;
  statementOpeningBalance: string;
  bookBalance: string;
  statementBalance: string;
  adjustedBalance: string;
  variance: string;
  outstandingChequesTotal: string;
  depositsInTransitTotal: string;
  adjustmentsTotal: string;
  statementPeriodFrom: string | null;
  statementPeriodTo: string | null;
  status: 'draft' | 'in_progress' | 'reconciled' | 'exception';
  preparedBy: string | null;
  approvedBy: string | null;
  reconciledBy: string | null;
  reconciledAt: string | null;
  reconciledDateBs: string | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StatementEntry {
  id: string;
  reconciliationId: string;
  entryDateBs: string;
  description: string | null;
  reference: string | null;
  chequeNo: string | null;
  debit: string;
  credit: string;
  matchStatus: 'matched' | 'partial' | 'unmatched';
  matchedReconEntryId: string | null;
  createdAt: string;
}

export interface ReconciliationEntry {
  id: string;
  reconciliationId: string;
  voucherId: string | null;
  voucherEntryId: string | null;
  bookDateBs: string;
  bookDescription: string | null;
  bookDebit: string;
  bookCredit: string;
  statementDateBs: string | null;
  statementDescription: string | null;
  statementDebit: string;
  statementCredit: string;
  matchStatus: 'matched' | 'partial' | 'unmatched' | 'exception';
  matchType: 'auto' | 'manual' | 'exception' | null;
  varianceAmount: string;
  createdAt: string;
}

export interface ReconciliationAdjustment {
  id: string;
  reconciliationId: string;
  adjustmentType: 'bank_charge' | 'interest_earned' | 'interest_charged' | 'direct_debit' | 'direct_credit' | 'error_correction' | 'other';
  description: string;
  amount: string;
  dateBs: string;
  voucherId: string | null;
  needsPosting: boolean | null;
  createdAt: string;
}

export interface OutstandingItem {
  id: string;
  reconciliationId: string;
  itemType: 'outstanding_cheque' | 'deposit_in_transit';
  sourceId: string | null;
  sourceType: string | null;
  chequeNo: string | null;
  payeeName: string | null;
  description: string | null;
  amount: string;
  entryDateBs: string;
  status: 'pending' | 'cleared' | 'voided';
  clearedDateBs: string | null;
  createdAt: string;
}

export interface BankAccountForRecon {
  id: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  glAccountId: string;
  glAccountCode: string;
  glAccountName: string;
  currentBalance: number;
  reconciliationEnabled: boolean;
  lastReconciledDateBs: string | null;
}

export interface BookEntry {
  voucherId: string;
  voucherEntryId: string;
  dateBs: string;
  description: string;
  debit: number;
  credit: number;
  voucherNo: string;
  voucherType: string;
  accountCode: string;
  accountName: string;
}

export interface OutstandingChequeFromRegister {
  id: string;
  chequeNo: string;
  payeeName: string | null;
  amount: number;
  dateBs: string;
  voucherNo: string | null;
}

export interface ReconciliationSummary {
  bookEntries: { matchStatus: string; count: number; totalDebit: string; totalCredit: string }[];
  statementEntries: { matchStatus: string; count: number }[];
  outstandingItems: { itemType: string; count: number; totalAmount: string }[];
  adjustments: { count: number; totalAmount: string };
}

// =============================================
// Sessions
// =============================================

export async function createReconciliationSession(data: {
  branchId: string;
  reconciliationType: 'bank' | 'vault';
  bankAccountId?: string;
  glAccountId: string;
  reconcileDateBs: string;
  reconcileDateAd: string;
  statementPeriodFrom?: string;
  statementPeriodTo?: string;
}): Promise<ReconciliationSession> {
  const { data: result } = await apiClient.post('/reconciliation/sessions', data);
  return result;
}

export async function fetchReconciliationSessions(filters?: {
  branchId?: string;
  type?: 'bank' | 'vault';
  status?: string;
}): Promise<ReconciliationSession[]> {
  const params = new URLSearchParams();
  if (filters?.branchId) params.set('branchId', filters.branchId);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  const { data } = await apiClient.get(`/reconciliation/sessions${qs ? `?${qs}` : ''}`);
  return data;
}

export async function fetchReconciliationById(id: string): Promise<{
  session: ReconciliationSession;
  entries: ReconciliationEntry[];
  statementEntries: StatementEntry[];
  adjustments: ReconciliationAdjustment[];
  outstandingItems: OutstandingItem[];
}> {
  const { data } = await apiClient.get(`/reconciliation/sessions/${id}`);
  return data;
}

export async function updateReconciliationSession(id: string, data: {
  statementBalance?: number;
  statementOpeningBalance?: number;
  status?: string;
  remarks?: string;
  statementPeriodFrom?: string;
  statementPeriodTo?: string;
}): Promise<ReconciliationSession> {
  const { data: result } = await apiClient.put(`/reconciliation/sessions/${id}`, data);
  return result;
}

// =============================================
// Outstanding Cheques
// =============================================

export async function fetchOutstandingCheques(glAccountId: string): Promise<OutstandingChequeFromRegister[]> {
  const { data } = await apiClient.get(`/reconciliation/outstanding-cheques?glAccountId=${glAccountId}`);
  return data;
}

export async function addOutstandingItems(sessionId: string, items: Array<{
  itemType: 'outstanding_cheque' | 'deposit_in_transit';
  sourceId?: string;
  sourceType?: string;
  chequeNo?: string;
  payeeName?: string;
  description?: string;
  amount: number;
  entryDateBs: string;
}>): Promise<OutstandingItem[]> {
  const { data } = await apiClient.post(`/reconciliation/sessions/${sessionId}/outstanding`, { items });
  return data;
}

export async function updateOutstandingItem(id: string, data: {
  status: 'pending' | 'cleared' | 'voided';
  clearedDateBs?: string;
}): Promise<OutstandingItem> {
  const { data: result } = await apiClient.patch(`/reconciliation/outstanding/${id}`, data);
  return result;
}

// =============================================
// Statement Entries
// =============================================

export async function addStatementEntries(sessionId: string, entries: Array<{
  entryDateBs: string;
  description?: string;
  reference?: string;
  chequeNo?: string;
  debit?: number;
  credit?: number;
}>): Promise<StatementEntry[]> {
  const { data } = await apiClient.post(`/reconciliation/sessions/${sessionId}/statement-entries`, { entries });
  return data;
}

// =============================================
// Adjustments
// =============================================

export async function addAdjustment(sessionId: string, data: {
  adjustmentType: string;
  description: string;
  amount: number;
  dateBs: string;
}): Promise<ReconciliationAdjustment> {
  const { data: result } = await apiClient.post(`/reconciliation/sessions/${sessionId}/adjustments`, data);
  return result;
}

export async function deleteAdjustment(id: string): Promise<void> {
  await apiClient.delete(`/reconciliation/adjustments/${id}`);
}

// =============================================
// Auto-Match & Summary
// =============================================

export async function autoMatchEntries(sessionId: string): Promise<{ matchCount: number; summary: ReconciliationSummary }> {
  const { data } = await apiClient.post(`/reconciliation/sessions/${sessionId}/auto-match`);
  return data;
}

export async function fetchReconciliationSummary(sessionId: string): Promise<ReconciliationSummary> {
  const { data } = await apiClient.get(`/reconciliation/sessions/${sessionId}/summary`);
  return data;
}

// =============================================
// Data Feeds
// =============================================

export async function fetchBankAccountsForRecon(): Promise<BankAccountForRecon[]> {
  const { data } = await apiClient.get('/reconciliation/bank-accounts');
  return data;
}

export async function fetchBookEntries(glAccountId: string, dateFrom?: string, dateTo?: string): Promise<BookEntry[]> {
  const params = new URLSearchParams({ glAccountId });
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  const { data } = await apiClient.get(`/reconciliation/book-entries?${params.toString()}`);
  return data;
}

export async function fetchDepositsInTransit(glAccountId: string, dateFrom?: string, dateTo?: string): Promise<BookEntry[]> {
  const params = new URLSearchParams({ glAccountId });
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  const { data } = await apiClient.get(`/reconciliation/deposits-in-transit?${params.toString()}`);
  return data;
}

// =============================================
// Finalize
// =============================================

export async function finalizeReconciliation(sessionId: string): Promise<{ success: boolean; session: ReconciliationSession }> {
  const { data } = await apiClient.post(`/reconciliation/sessions/${sessionId}/finalize`);
  return data;
}

// =============================================
// Variance Logs (for CashVarianceView)
// =============================================
export interface VarianceLog {
  id: string;
  organizationId: string;
  branchId: string;
  reconciliationId: string | null;
  varianceType: 'cash_short' | 'cash_over' | 'bank_difference' | 'unmatched_entry' | 'missing_entry';
  amount: string;
  description: string | null;
  glAccountId: string | null;
  status: 'open' | 'investigating' | 'resolved' | 'ignored';
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  reportedBy: string | null;
  createdAt: string;
}

export interface VarianceSummary {
  totalOpen: number;
  totalResolved: number;
  totalAmount: number;
  byType: Record<string, { count: number; amount: number }>;
}

export async function fetchVarianceLogs(filters?: {
  branchId?: string;
  status?: string;
  varianceType?: string;
}): Promise<VarianceLog[]> {
  const params = new URLSearchParams();
  if (filters?.branchId) params.set('branchId', filters.branchId);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.varianceType) params.set('varianceType', filters.varianceType);
  const qs = params.toString();
  const { data } = await apiClient.get(`/reconciliation/variance-logs${qs ? `?${qs}` : ''}`);
  return data;
}

export async function createVarianceLog(data: {
  branchId: string;
  varianceType: string;
  amount: number;
  description?: string;
  glAccountId?: string;
  reconciliationId?: string;
}): Promise<VarianceLog> {
  const { data: result } = await apiClient.post('/reconciliation/variance-logs', data);
  return result;
}

export async function resolveVarianceLog(id: string, resolutionNote: string, status?: string): Promise<VarianceLog> {
  const { data: result } = await apiClient.patch(`/reconciliation/variance-logs/${id}`, { resolutionNote, status });
  return result;
}

export async function fetchVarianceSummary(branchId?: string): Promise<VarianceSummary> {
  const params = branchId ? `?branchId=${branchId}` : '';
  const { data } = await apiClient.get(`/reconciliation/variance-summary${params}`);
  return data;
}
