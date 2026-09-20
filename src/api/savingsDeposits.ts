/**
 * Frontend API client for the Savings & Deposits teller module
 * (Tasks 1–6). All endpoints live under the `/api/v1` base (src/lib/apiClient).
 *
 *   Open account:
 *     GET  /savings/members/search?q=        → member search
 *     GET  /savings/members/:id/nominees     → member nominees
 *     GET  /savings/schemes?memberTypeId=    → available saving schemes
 *     POST /savings/accounts/open            → open savings account
 *
 *   Teller deposit / withdraw:
 *     GET  /savings/accounts/lookup?q=       → teller fast-path account lookup
 *     POST /savings/deposits                 → cash/bank/cheque deposit
 *     POST /savings/deposits/batch           → batch / field-collection deposit
 *     POST /savings/withdrawals              → withdrawal (may queue for approval)
 *     GET  /cheque/leaves/:no                → cheque leaf validation
 *
 *   Cheque clearance + approval queue:
 *     GET  /savings/cheque-deposits          → pending-clearance instruments
 *     POST /savings/cheque-deposits/:id/clear → credit balance + post GL
 *     POST /savings/cheque-deposits/:id/bounce
 *     GET  /savings/withdrawals/pending      → dual-approval queue
 *     POST /savings/withdrawals/:id/approve|reject
 *
 *   Ledger + passbook:
 *     GET  /savings/accounts/:id/ledger      → running-balance ledger
 *     GET  /savings/accounts/:id/passbook/summary
 *     GET  /savings/accounts/:id/unprinted-transactions
 *     POST /savings/accounts/:id/passbook/print → returns { pdfUrl, printed }
 *     GET  /savings/passbook/test-align      → calibration grid data URL
 */
import { apiClient } from '../lib/apiClient';
import { exportToExcel, exportToPdf } from '../utils/exportUtils';
import type { PassbookLayoutConfig, PassbookPagination } from '../utils/passbookLayout';

export function toNumber(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

// ─────────────────────────────────────────────────────────────
// Open account
// ─────────────────────────────────────────────────────────────

export interface MemberSearchResult {
  id: string;
  memberCode: string;
  name: string;
  phone: string;
  kycStatus: string;
  memberTypeId: string;
}

export interface SavingScheme {
  id: string;
  code: string;
  name: string;
  productType: string;
  minOpeningDeposit: number;
  minBalance: number;
  interestRate: number;
  interestPostingFrequency: string;
  accountNoPrefix: string;
  openingDepositRequired: boolean;
  chequeEnabled: boolean;
}

export interface Nominee {
  id: string;
  name: string;
  relationship: string;
}

export interface AccountLookup {
  id: string;
  accountNumber: string;
  memberId?: string;
  memberName: string;
  memberNo?: string;
  productName?: string;
  balance: number;
  minBalance: number;
  status: 'active' | 'frozen' | 'closed' | string;
  /** Member-level KYC snapshot (Verified/Pending/Expired/…) for eligibility checks. */
  kycStatus?: string;
  /** Member lifecycle status (e.g. Blacklisted) for eligibility checks. */
  memberStatus?: string;
}

export async function searchMembers(q: string): Promise<MemberSearchResult[]> {
  const { data } = await apiClient.get('/savings/members/search', { params: { q } });
  return data ?? [];
}

export async function getMemberNominees(memberId: string): Promise<Nominee[]> {
  const { data } = await apiClient.get(`/savings/members/${memberId}/nominees`);
  return data ?? [];
}

export async function getSavingSchemes(memberTypeId?: string): Promise<SavingScheme[]> {
  const { data } = await apiClient.get('/savings/schemes', { params: { memberTypeId } });
  return data ?? [];
}

export interface OpenAccountPayload {
  memberId: string;
  schemeId: string;
  openingDeposit: number;
  depositSource?: 'cash' | 'bank_transfer' | 'internal_transfer';
  nomineeId?: string | null;
  isJoint?: boolean;
  bsDate?: string;
  /** Signature specimen captured at account opening (uploaded storage path). */
  specimenImageUrl?: string;
  signatoryName?: string;
  signingRule?: 'any' | 'all' | 'specific';
}

export async function openAccount(payload: OpenAccountPayload) {
  const { data } = await apiClient.post('/savings/accounts/open', payload);
  return data as { accountNumber: string; accountId: string; openingDeposit: number };
}

export interface UpdateAccountPayload {
  status?: 'Active' | 'Dormant' | 'Closed';
  minBalance?: number;
  interestRate?: number;
}

/** Account Register → Edit / Manage Account. */
export async function updateSavingsAccount(accountId: string, payload: UpdateAccountPayload) {
  const { data } = await apiClient.put(`/savings/accounts/${accountId}`, payload);
  return data;
}

// ─────────────────────────────────────────────────────────────
// Teller account lookup
// ─────────────────────────────────────────────────────────────

export async function lookupAccount(q: string): Promise<AccountLookup[]> {
  const { data } = await apiClient.get('/savings/accounts/lookup', { params: { q } });
  return (data ?? []).map((row: any) => ({
    id: row.id,
    accountNumber: row.accountNumber,
    memberId: row.memberId,
    memberName: row.memberName,
    memberNo: row.memberNo,
    productName: row.productName,
    balance: toNumber(row.balance),
    minBalance: toNumber(row.minBalance),
    status: row.status ?? 'active',
    kycStatus: row.kycStatus,
    memberStatus: row.memberStatus,
  }));
}

// ─────────────────────────────────────────────────────────────
// Teller deposit
// ─────────────────────────────────────────────────────────────

export type DepositMode = 'cash' | 'cheque' | 'bank_transfer';

export interface DepositPayload {
  accountId: string;
  amount: number;
  mode: DepositMode;
  bsDate?: string;
  cheque?: { number: string; bank?: string; date?: string } | null;
  reference?: string;
  remarks?: string;
}

export async function postDeposit(payload: DepositPayload) {
  const { data } = await apiClient.post('/savings/deposits', payload);
  return data as { id: string; accountNo: string; voucherNo: string; newBalance: number; pendingClearing?: boolean };
}

export async function postBatchDeposits(entries: DepositPayload[]) {
  const { data } = await apiClient.post('/savings/deposits/batch', { entries });
  return data as { posted: number; results: any[] };
}

// ─────────────────────────────────────────────────────────────
// Teller withdrawal
// ─────────────────────────────────────────────────────────────

export type WithdrawalInstrument = 'cheque' | 'slip' | 'passbook';
export type PayoutMode = 'cash' | 'cheque_issue' | 'bank_transfer';

export interface WithdrawalPayload {
  accountId: string;
  amount: number;
  payoutMode: PayoutMode;
  bsDate?: string;
  instrument: {
    type: WithdrawalInstrument;
    chequeNumber?: string;
    slipNumber?: string;
    signatureVerified?: boolean;
    passbookLastLine?: string;
    /** Reference to the persisted signature_verification_logs row from POST /signature/verify. */
    verificationLogId?: string;
    /** Disposition decided at the teller: auto_approved | teller_override | supervisor_override. */
    signatureOutcome?: 'auto_approved' | 'teller_override' | 'supervisor_override';
    overrideReason?: string;
    /** Passbook-mode survey answers — tamper flags route the payout to the approval queue. */
    passbookTampered?: boolean;
    passbookReconciled?: boolean;
  };
}

export async function postWithdrawal(payload: WithdrawalPayload) {
  const { data } = await apiClient.post('/savings/withdrawals', payload);
  return data as { id: string; accountNo: string; voucherNo: string; newBalance: number; needsApproval: boolean; signatureOutcome?: string | null; signatureScore?: number | null };
}

// ─────────────────────────────────────────────────────────────
// Savings Withdrawal via Bank Cheque
// ─────────────────────────────────────────────────────────────
export interface SavingsChequeWithdrawalPayload {
  savingsAccountId: string;
  amount: number;
  bankAccountId: string;      // chart_ofAccounts.id
  chequeLeafId: string;
  payeeName: string;
  voucherDateBS: string;
  voucherDateAD: string;
  particulars: string;
}

export async function postSavingsChequeWithdrawal(payload: SavingsChequeWithdrawalPayload) {
  const { data } = await apiClient.post('/bank-cheques/savings-withdrawal', payload);
  return data as {
    success: boolean;
    voucherNo: string;
    savingsTxnId: string;
    chequeNumber: string;
    amount: number;
    newSavingsBalance: number;
    newBankBalance: number;
  };
}

export interface ChequeLeafStatus {
  chequeNumber: string;
  leafNo: number;
  status: string;
  bookNumber: string | null;
  bookStatus: string | null;
  accountId: string;
  valid: boolean;
  /** Withdrawal-security enrichment. */
  chequeDateBs?: string | null;
  dateValidity?: { ok: boolean; status: string; message?: string } | null;
  duplicatePresentment?: { dateBs: string; amount: number; voucherNo: string | null } | null;
  drawer?: {
    accountId: string;
    accountNo: string;
    memberId: string;
    memberName: string;
    balance: number;
    minBalance: number;
    status: string;
  } | null;
  /** True when the leaf belongs to the cooperative's bank cheque system. */
  isBankCheque?: boolean;
}

export async function validateChequeLeaf(chequeNumber: string): Promise<ChequeLeafStatus> {
  const { data } = await apiClient.get(`/cheque/leaves/${encodeURIComponent(chequeNumber)}`);
  return {
    ...data,
    drawer: data.drawer ? { ...data.drawer, balance: toNumber(data.drawer.balance), minBalance: toNumber(data.drawer.minBalance) } : null,
    duplicatePresentment: data.duplicatePresentment ? { ...data.duplicatePresentment, amount: toNumber(data.duplicatePresentment.amount) } : null,
  };
}

// ─────────────────────────────────────────────────────────────
// Cheque clearance + pending withdrawal queue
// ─────────────────────────────────────────────────────────────

export interface ChequeDeposit {
  id: string;
  accountId: string;
  accountNo: string;
  memberName: string;
  amount: number;
  chequeNumber: string;
  chequeBank: string;
  dateBs: string;
  status: 'Pending' | 'Cleared' | 'Bounced';
  voucherNo?: string;
}

export interface PendingWithdrawal {
  id: string;
  accountId: string;
  accountNo: string;
  memberName: string;
  amount: number;
  payoutMode: string;
  instrumentType: string;
  dateBs: string;
  voucherNo: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export async function listChequeDeposits(params: { status?: string; accountId?: string } = {}) {
  const { data } = await apiClient.get('/savings/cheque-deposits', { params });
  return {
    data: (data?.data ?? []).map((r: any) => ({ ...r, amount: toNumber(r.amount) })),
    total: data?.total ?? 0,
  };
}

export async function clearChequeDeposit(id: string) {
  const { data } = await apiClient.post(`/savings/cheque-deposits/${id}/clear`);
  return data;
}

export async function bounceChequeDeposit(id: string, reason?: string) {
  const { data } = await apiClient.post(`/savings/cheque-deposits/${id}/bounce`, { reason });
  return data;
}

export interface ChequeTransferResult {
  voucherNo: string;
  chequeNumber: string;
  depositAccountId: string;
  depositAccountNo: string;
  depositAccountNewBalance: number;
  drawerAccountId: string;
  drawerAccountNo: string;
  drawerAccountNewBalance: number;
  drawerMemberName: string;
}

/** Internal cheque transfer — a cheque drawn on another member's savings account settles instantly. */
export async function postChequeTransfer(input: {
  depositAccountId: string;
  chequeNumber: string;
  amount: number;
  branchId?: string;
  bsDate?: string;
}): Promise<ChequeTransferResult> {
  const { data } = await apiClient.post('/savings/cheque-transfers', input);
  return { ...data, depositAccountNewBalance: toNumber(data.depositAccountNewBalance), drawerAccountNewBalance: toNumber(data.drawerAccountNewBalance) };
}

export async function listPendingWithdrawals(status?: string) {
  const { data } = await apiClient.get('/savings/withdrawals/pending', { params: { status } });
  return {
    data: (data?.data ?? []).map((r: any) => ({ ...r, amount: toNumber(r.amount) })),
    total: data?.total ?? 0,
  };
}

export async function approveWithdrawal(id: string) {
  const { data } = await apiClient.post(`/savings/withdrawals/${id}/approve`);
  return data;
}

export async function rejectWithdrawal(id: string, remarks?: string) {
  const { data } = await apiClient.post(`/savings/withdrawals/${id}/reject`, { remarks });
  return data;
}

// ─────────────────────────────────────────────────────────────
// Ledger + passbook
// ─────────────────────────────────────────────────────────────

export interface LedgerEntry {
  id: string;
  bsDate: string;
  dateAd?: string | null;
  voucherNo: string;
  particulars: string;
  txnType: 'deposit' | 'withdrawal' | 'interest' | 'charge' | 'transfer';
  debit: number;
  credit: number;
  balance: number;
  tellerName?: string;
}

export interface LedgerResponse {
  accountId: string;
  accountNumber: string;
  memberName: string;
  openingBalance: number;
  closingBalance: number;
  entries: LedgerEntry[];
}

export async function fetchLedger(accountId: string, params: { from?: string; to?: string; txnType?: string } = {}) {
  const { data } = await apiClient.get(`/savings/accounts/${accountId}/ledger`, { params });
  return {
    ...data,
    openingBalance: toNumber(data.openingBalance),
    closingBalance: toNumber(data.closingBalance),
    entries: (data.entries ?? []).map((e: any) => ({
      ...e,
      debit: toNumber(e.debit),
      credit: toNumber(e.credit),
      balance: toNumber(e.balance),
    })),
  } as LedgerResponse;
}

export interface PassbookSummary {
  id: string;
  accountNumber: string;
  memberName: string;
  lastPrintedTxnId: string | null;
  lastPrintedLine: number;
  linesPerPage: number;
  passbookSerial: string;
}

export async function getPassbookSummary(accountId: string): Promise<PassbookSummary> {
  const { data } = await apiClient.get(`/savings/accounts/${accountId}/passbook/summary`);
  return data;
}

export async function getUnprintedTransactions(accountId: string, params: { from?: string; to?: string } = {}) {
  const { data } = await apiClient.get(`/savings/accounts/${accountId}/unprinted-transactions`, { params });
  return (data ?? []).map((e: any) => ({
    ...e,
    debit: toNumber(e.debit),
    credit: toNumber(e.credit),
    balance: toNumber(e.balance),
  }));
}

export async function printPassbook(accountId: string, opts: { mode: 'since_last' | 'custom'; from?: string; to?: string }) {
  const { data } = await apiClient.post(`/savings/accounts/${accountId}/passbook/print`, opts);
  return data as { pdfUrl: string; printed: number; newLine: number };
}

export async function testPassbookAlignment() {
  const { data } = await apiClient.get('/savings/passbook/test-align');
  return data as { pdfUrl: string };
}

/**
 * Client-side ledger export (Excel / PDF) using the shared exportUtils helpers.
 */
export function exportLedger(data: LedgerResponse, format: 'pdf' | 'excel') {
  const headers = ['Date (BS)', 'Voucher No', 'Particulars', 'Type', 'Debit', 'Credit', 'Balance'];
  const rows = data.entries.map((e) => [
    e.bsDate, e.voucherNo, e.particulars, e.txnType,
    e.debit || '', e.credit || '', e.balance,
  ]);
  const filenameBase = `ledger-${data.accountNumber}-${new Date().toISOString().slice(0, 10)}`;
  if (format === 'excel') {
    exportToExcel(filenameBase, 'Account Ledger', headers, rows);
  } else {
    exportToPdf(filenameBase, `${data.accountNumber} — Account Ledger`, `Member: ${data.memberName} | Opening: ${data.openingBalance} | Closing: ${data.closingBalance}`, headers, rows);
  }
}

// ─────────────────────────────────────────────────────────────
// Cheque book management (Task 6)
// ─────────────────────────────────────────────────────────────

export interface ChequeBook {
  id: string;
  bookNumber: string;
  prefix?: string;
  accountId?: string;
  accountNo?: string;
  memberId?: string;
  memberName?: string;
  memberNo?: string;
  leafStartNumber: number;
  leafEndNumber: number;
  leafCount: number;
  issuedDateBs: string;
  issuedDateAd?: string;
  status: string;
  issuanceCharge?: string | number | null;
}

export interface ChequeLeaf {
  id: string;
  chequeNumber: string;
  leafNo: number;
  status: string;
  payeeName?: string;
  amount?: number | null;
  chequeDateBs?: string;
  chequeBookId?: string;
  bookNumber?: string;
  accountNo?: string;
  memberName?: string;
  stopPaymentReason?: string | null;
  bounceReason?: string | null;
}

export async function listChequeBooks(params: { accountId?: string; status?: string; search?: string } = {}) {
  const { data } = await apiClient.get('/cheque-books', { params });
  const rows = Array.isArray(data) ? data : data?.data ?? [];
  return {
    data: rows.map((r: any) => ({ ...r, leafCount: toNumber(r.leafCount), issuanceCharge: r.issuanceCharge })),
    total: rows.length,
  };
}

export async function listChequeLeaves(params: { bookId?: string; accountId?: string; status?: string } = {}) {
  const { data } = await apiClient.get('/cheque-leaves', { params });
  const rows = Array.isArray(data) ? data : data?.data ?? [];
  return rows.map((r: any) => ({ ...r, amount: r.amount ?? null }));
}

export async function issueChequeBook(payload: {
  accountId: string;
  leafCount?: number;
  purpose?: string;
  deliveryMethod?: 'branch' | 'courier';
  overrideReason?: string;
  notes?: string;
}) {
  const { data } = await apiClient.post('/cheque-books', payload);
  return data;
}

// ─────────────────────────────────────────────────────────────
// Signature verification pipeline (withdrawal security)
// ─────────────────────────────────────────────────────────────

export type SignatureVerdict = 'auto_approved' | 'teller_review' | 'blocked';
export type SignatureBand = 'auto_approved' | 'teller_review' | 'blocked';
export type SignatureOutcome = 'auto_approved' | 'teller_override' | 'supervisor_override' | 'rejected';

export interface SignatureSpecimen {
  id: string;
  memberId: string;
  signatoryName: string | null;
  imageUrl: string;
  signingRule: 'any' | 'all' | 'specific' | string;
  capturedVia?: string | null;
  capturedAt?: string;
}

export interface SignatureSpecimensResponse {
  accountId: string;
  accountNo?: string;
  memberName?: string;
  specimens: SignatureSpecimen[];
  /** The member's on-file signature used when no specimen row exists yet. */
  fallbackSignature: string | null;
}

export interface SignatureVerifyResult {
  logId: string;
  score: number;
  verdict: SignatureVerdict;
  band: SignatureBand;
  providerId: string;
  provider: string;
  notes: string | null;
  lowConfidence: boolean;
  specimenId: string | null;
  specimenImageUrl: string;
  presentedImageUrl: string;
}

export interface SignatureVerificationLog {
  id: string;
  accountId: string;
  memberId: string;
  specimenId: string | null;
  presentedImageUrl: string;
  specimenImageUrl: string;
  matchScore: number;
  machineVerdict: SignatureVerdict;
  outcome: SignatureOutcome | null;
  withdrawalId: string | null;
  voucherNo: string | null;
  createdAt: string;
}

/** Live comparison of the presented signature vs the specimen on file (server-side, logged). */
export async function verifySignature(input: {
  accountId: string;
  memberId: string;
  presentedImageUrl: string;
  specimenId?: string | null;
  providerId?: string;
}): Promise<SignatureVerifyResult> {
  const { data } = await apiClient.post('/signature/verify', input);
  return { ...data, score: toNumber(data.score) };
}

export async function listSignatureSpecimens(accountId: string): Promise<SignatureSpecimensResponse> {
  const { data } = await apiClient.get(`/savings/accounts/${accountId}/specimens`);
  return data;
}

export async function captureSignatureSpecimen(accountId: string, payload: {
  memberId: string;
  imageUrl: string;
  signatoryName?: string;
  signingRule?: 'any' | 'all' | 'specific';
}) {
  const { data } = await apiClient.post(`/savings/accounts/${accountId}/specimens`, payload);
  return data as { id: string; accountId: string; memberId: string; signatoryName: string | null; imageUrl: string; signingRule: string };
}

export async function listSignatureVerificationLogs(accountId: string, limit = 20): Promise<SignatureVerificationLog[]> {
  const { data } = await apiClient.get(`/savings/accounts/${accountId}/signature-logs`, { params: { limit } });
  return (data ?? []).map((l: any) => ({ ...l, matchScore: toNumber(l.matchScore) }));
}

export interface PassbookReconcileInput {
  bookSerial?: string;
  bookLastLine?: number;
  lastPrintedLineFromBook?: number;
}

export interface PassbookReconcileResult {
  ok: boolean;
  mismatch: boolean;
  systemLastLine: number;
  bookLastLine: number;
  serialMismatch: boolean;
  aheadOfSystem: boolean;
  passbookSerial: string;
  needsSupervisorReview: boolean;
  message: string;
}

/** Passbook gate — verifies the physical book against the system's print marker. */
export async function reconcilePassbook(accountId: string, input: PassbookReconcileInput): Promise<PassbookReconcileResult> {
  const { data } = await apiClient.post(`/savings/accounts/${accountId}/passbook-reconcile`, input);
  return { ...data, systemLastLine: toNumber(data.systemLastLine), bookLastLine: toNumber(data.bookLastLine) };
}

// ─────────────────────────────────────────────────────────────
// Passbook subsystem — physical booklets, two-step print, records
// ─────────────────────────────────────────────────────────────
// The two-step print flow is the core safety fix over the legacy
// `printPassbook` PDF endpoint: `buildPassbookPrintPayload` has NO side effects
// (it just computes geometry + rows), the client renders + prints via
// utils/printPassbook, then `confirmPassbookPrint` atomically advances the
// continuation marker and writes the print-log. A jammed print loses nothing.

export type PassbookPrintMode = 'booklet' | 'a4' | 'thermal';
export type PassbookBookStatus = 'active' | 'full' | 'replaced' | 'lost' | 'cancelled';
export type PassbookIssuanceReason = 'new' | 'renewal' | 'lost' | 'damaged' | 'full';

/** A physical passbook booklet issued against an account. */
export interface PassbookBook {
  id: string;
  organizationId?: string;
  branchId?: string | null;
  accountId: string;
  serial: string;
  status: PassbookBookStatus;
  linesPerPage: number;
  pageCount: number;
  capacity: number;
  linesUsed: number;
  issuedDateBs?: string | null;
  issuedDateAd?: string | null;
  closedDateBs?: string | null;
  previousBookId?: string | null;
  replacedByBookId?: string | null;
  issuanceReason: PassbookIssuanceReason;
  issuedBy?: string | null;
  remarks?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** A recorded print run (one row per confirmed print). */
export interface PassbookPrintLogEntry {
  id: string;
  organizationId?: string;
  branchId?: string | null;
  accountId: string;
  bookId?: string | null;
  designId?: string | null;
  mode: PassbookPrintMode;
  status: 'printed' | 'void';
  fromTxnId?: string | null;
  toTxnId?: string | null;
  txnCount: number;
  startLine: number;
  endLine: number;
  linesPrinted: number;
  pageCount: number;
  fromDateBs?: string | null;
  toDateBs?: string | null;
  printedBy?: string | null;
  printedByName?: string | null;
  remarks?: string | null;
  createdAt?: string;
}

/** Book snapshot returned inside a print payload (capacity + fill projection). */
export interface PassbookPrintBookInfo {
  id: string;
  serial: string;
  status: PassbookBookStatus;
  capacity: number;
  linesUsed: number;
  remaining: number | null;
  willFill: boolean;
  linesPerPage: number;
  pageCount: number;
}

/**
 * The exact geometry the client echoes back verbatim on confirm. Only booklet
 * prints carry `advanceMarker: true`; A4 / thermal are reprints of recorded
 * history and must not move the continuation marker.
 */
export interface PassbookConfirmInput {
  mode: PassbookPrintMode;
  designId: string | null;
  bookId: string | null;
  fromTxnId: string | null;
  toTxnId: string | null;
  txnCount: number;
  startLine: number;
  endLine: number;
  linesPrinted: number;
  pageCount: number;
  fromDateBs: string | null;
  toDateBs: string | null;
  advanceMarker: boolean;
  remarks?: string | null;
}

/** Everything the print engine needs, computed with no side effects. */
export interface PassbookPrintPayload {
  account: PassbookSummary;
  mode: PassbookPrintMode;
  layout: PassbookLayoutConfig;
  designId: string | null;
  transactions: LedgerEntry[];
  pagination: PassbookPagination;
  startLine: number;
  book: PassbookPrintBookInfo | null;
  confirm: PassbookConfirmInput;
}

function coerceTxns(rows: any[]): LedgerEntry[] {
  return (rows ?? []).map((e: any) => ({
    ...e,
    debit: toNumber(e.debit),
    credit: toNumber(e.credit),
    balance: toNumber(e.balance),
  }));
}

/** Step 1 — build the print payload (no marker movement, no log). */
export async function buildPassbookPrintPayload(
  accountId: string,
  opts: { mode: PassbookPrintMode; designId?: string | null; rangeMode?: 'since_last' | 'custom'; fromDateBs?: string; toDateBs?: string },
): Promise<PassbookPrintPayload> {
  const { data } = await apiClient.post(`/savings/accounts/${accountId}/passbook/build`, {
    mode: opts.mode,
    designId: opts.designId ?? null,
    rangeMode: opts.rangeMode ?? 'since_last',
    fromDateBs: opts.fromDateBs,
    toDateBs: opts.toDateBs,
  });
  return { ...data, transactions: coerceTxns(data.transactions) } as PassbookPrintPayload;
}

/** Step 2 — confirm the print landed; advances the marker + writes the log. */
export async function confirmPassbookPrint(
  accountId: string,
  confirm: PassbookConfirmInput,
): Promise<{ log: PassbookPrintLogEntry; account: PassbookSummary }> {
  const { data } = await apiClient.post(`/savings/accounts/${accountId}/passbook/confirm`, confirm);
  return data;
}

export async function listPassbookBooks(accountId: string): Promise<PassbookBook[]> {
  const { data } = await apiClient.get(`/savings/accounts/${accountId}/passbook/books`);
  return (Array.isArray(data) ? data : []).map((b: any) => ({
    ...b,
    linesPerPage: toNumber(b.linesPerPage),
    pageCount: toNumber(b.pageCount),
    capacity: toNumber(b.capacity),
    linesUsed: toNumber(b.linesUsed),
  }));
}

export async function issuePassbookBook(
  accountId: string,
  payload: { serial: string; pageCount?: number; linesPerPage?: number; issuedDateBs?: string; issuedDateAd?: string; reason?: PassbookIssuanceReason; remarks?: string },
): Promise<PassbookBook> {
  const { data } = await apiClient.post(`/savings/accounts/${accountId}/passbook/books`, payload);
  return data;
}

export async function renewPassbookBook(
  accountId: string,
  payload: { serial: string; pageCount?: number; linesPerPage?: number; issuedDateBs?: string; issuedDateAd?: string; reason?: 'renewal' | 'lost' | 'damaged' | 'full'; remarks?: string },
): Promise<PassbookBook> {
  const { data } = await apiClient.post(`/savings/accounts/${accountId}/passbook/books/renew`, payload);
  return data;
}

export async function listPassbookPrintLog(accountId: string): Promise<PassbookPrintLogEntry[]> {
  const { data } = await apiClient.get(`/savings/accounts/${accountId}/passbook/print-log`);
  return (Array.isArray(data) ? data : []).map((r: any) => ({
    ...r,
    txnCount: toNumber(r.txnCount),
    startLine: toNumber(r.startLine),
    endLine: toNumber(r.endLine),
    linesPrinted: toNumber(r.linesPrinted),
    pageCount: toNumber(r.pageCount),
  }));
}

export async function voidPassbookPrintRun(logId: string, reason?: string): Promise<{ success: boolean; account: PassbookSummary }> {
  const { data } = await apiClient.post(`/savings/passbook/print-log/${logId}/void`, { reason });
  return data;
}
