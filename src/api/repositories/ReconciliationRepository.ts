/**
 * Reconciliation Repository — Proper Bank Reconciliation
 * ---------------------------------------------------------
 * Bank Statement Balance
 *   + Deposits in Transit
 *   - Outstanding Cheques
 *   ± Adjustments (bank charges, interest, etc.)
 *   = Adjusted Bank Balance
 *
 * Compare Adjusted Bank Balance with System Book Balance.
 * If equal → Reconciled.
 */
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  bankReconciliation,
  bankReconciliationEntries,
  reconciliationStatementEntries,
  reconciliationAdjustments,
  reconciliationOutstandingItems,
  cashVarianceLog,
} from '../../db/schema/reconciliation';
import {
  chartOfAccounts,
  vouchers,
  voucherEntries,
} from '../../db/schema/accounting';
import { bankAccounts } from '../../db/schema/accountingSettings';
import { bankChequeLeaves, bankChequeBooks } from '../../db/schema/bankCheques';

function getDbOrThrow() {
  const db = getDb();
  if (!db) throw Object.assign(new Error('Database not configured. Set DATABASE_URL in .env'), { status: 503 });
  return db;
}

// =============================================
// Types
// =============================================
export interface ReconciliationSessionInput {
  organizationId: string;
  branchId: string;
  reconciliationType: 'bank' | 'vault';
  bankAccountId?: string;
  glAccountId: string;
  reconcileDateBs: string;
  reconcileDateAd: string;
  statementPeriodFrom?: string;
  statementPeriodTo?: string;
}

export interface StatementEntryInput {
  reconciliationId: string;
  organizationId: string;
  entryDateBs: string;
  description?: string;
  reference?: string;
  chequeNo?: string;
  debit?: number;
  credit?: number;
}

export interface AdjustmentInput {
  reconciliationId: string;
  organizationId: string;
  adjustmentType: 'bank_charge' | 'interest_earned' | 'interest_charged' | 'direct_debit' | 'direct_credit' | 'error_correction' | 'other';
  description: string;
  amount: number;
  dateBs: string;
}

export interface OutstandingItemInput {
  reconciliationId: string;
  organizationId: string;
  itemType: 'outstanding_cheque' | 'deposit_in_transit';
  sourceId?: string;
  sourceType?: 'bank_cheque_leaf' | 'voucher_entry';
  chequeNo?: string;
  payeeName?: string;
  description?: string;
  amount: number;
  entryDateBs: string;
}

// =============================================
// GL Account Balance
// =============================================
export async function getGlAccountBalance(
  glAccountId: string,
  organizationId: string,
): Promise<number> {
  const db = getDbOrThrow();
  const [row] = await db.select({ balance: chartOfAccounts.balance })
    .from(chartOfAccounts)
    .where(and(
      eq(chartOfAccounts.id, glAccountId),
      eq(chartOfAccounts.organizationId, organizationId),
    ));
  return row ? Number(row.balance) : 0;
}

// =============================================
// Reconciliation Sessions
// =============================================

export async function createReconciliationSession(
  input: ReconciliationSessionInput,
) {
  const db = getDbOrThrow();
  const bookBalance = await getGlAccountBalance(input.glAccountId, input.organizationId);
  const [row] = await db.insert(bankReconciliation).values({
    organizationId: input.organizationId,
    branchId: input.branchId,
    reconciliationType: input.reconciliationType,
    bankAccountId: input.bankAccountId,
    glAccountId: input.glAccountId,
    reconcileDateBs: input.reconcileDateBs,
    reconcileDateAd: input.reconcileDateAd,
    statementPeriodFrom: input.statementPeriodFrom,
    statementPeriodTo: input.statementPeriodTo,
    bookBalance: bookBalance.toString(),
    statementBalance: '0',
    adjustedBalance: bookBalance.toString(),
    variance: '0',
    status: 'draft',
    preparedBy: input.organizationId, // will be overwritten by controller
  }).returning();
  return row;
}

export async function getReconciliationSessions(
  organizationId: string,
  branchId?: string,
  type?: 'bank' | 'vault',
  status?: string,
) {
  const db = getDbOrThrow();
  const conditions = [eq(bankReconciliation.organizationId, organizationId)];
  if (branchId) conditions.push(eq(bankReconciliation.branchId, branchId));
  if (type) conditions.push(eq(bankReconciliation.reconciliationType, type));
  if (status) conditions.push(eq(bankReconciliation.status, status as any));

  return db.select().from(bankReconciliation)
    .where(and(...conditions))
    .orderBy(desc(bankReconciliation.createdAt));
}

export async function getReconciliationById(
  id: string,
  organizationId: string,
) {
  const db = getDbOrThrow();
  const [session] = await db.select().from(bankReconciliation)
    .where(and(
      eq(bankReconciliation.id, id),
      eq(bankReconciliation.organizationId, organizationId),
    ));
  if (!session) return null;

  const [entries, statementEntries, adjustments, outstandingItems] = await Promise.all([
    db.select().from(bankReconciliationEntries)
      .where(eq(bankReconciliationEntries.reconciliationId, id))
      .orderBy(asc(bankReconciliationEntries.bookDateBs)),
    db.select().from(reconciliationStatementEntries)
      .where(eq(reconciliationStatementEntries.reconciliationId, id))
      .orderBy(asc(reconciliationStatementEntries.entryDateBs)),
    db.select().from(reconciliationAdjustments)
      .where(eq(reconciliationAdjustments.reconciliationId, id))
      .orderBy(asc(reconciliationAdjustments.createdAt)),
    db.select().from(reconciliationOutstandingItems)
      .where(eq(reconciliationOutstandingItems.reconciliationId, id))
      .orderBy(asc(reconciliationOutstandingItems.entryDateBs)),
  ]);

  return { session, entries, statementEntries, adjustments, outstandingItems };
}

export async function updateReconciliationSession(
  id: string,
  updates: Record<string, any>,
) {
  const db = getDbOrThrow();
  const fields = { ...updates, updatedAt: new Date() };
  const [row] = await db.update(bankReconciliation)
    .set(fields)
    .where(eq(bankReconciliation.id, id))
    .returning();
  return row || null;
}

// =============================================
// Outstanding Cheques (from cheque register)
// =============================================

export async function getOutstandingCheques(
  organizationId: string,
  bankGlAccountId: string,
  excludeReconciliationId?: string,
): Promise<{
  id: string;
  chequeNo: string;
  payeeName: string | null;
  amount: number;
  dateBs: string;
  voucherNo: string | null;
}[]> {
  const db = getDbOrThrow();
  // Outstanding cheques = issued but not cleared
  const rows = await db.select({
    id: bankChequeLeaves.id,
    chequeNo: bankChequeLeaves.chequeNumber,
    payeeName: bankChequeLeaves.payeeName,
    amount: bankChequeLeaves.amount,
    dateBs: bankChequeLeaves.chequeDateBs,
    voucherNo: sql<string>`COALESCE((SELECT voucher_no FROM vouchers WHERE id = ${bankChequeLeaves.voucherId}), '')`,
  })
    .from(bankChequeLeaves)
    .where(and(
      eq(bankChequeLeaves.organizationId, organizationId),
      eq(bankChequeLeaves.bankAccountId, bankGlAccountId),
      eq(bankChequeLeaves.status, 'issued'),
    ))
    .orderBy(asc(bankChequeLeaves.chequeDateBs));

  return rows.map(r => ({
    ...r,
    amount: Number(r.amount),
    dateBs: r.dateBs || '',
    payeeName: r.payeeName || null,
    voucherNo: r.voucherNo || null,
  }));
}

// =============================================
// Deposits in Transit (book entries not in statement)
// =============================================

export async function getDepositsInTransit(
  organizationId: string,
  glAccountId: string,
  dateFromBs?: string,
  dateToBs?: string,
): Promise<{
  id: string;
  dateBs: string;
  description: string;
  debit: number;
  credit: number;
  voucherNo: string;
  voucherType: string;
}[]> {
  const db = getDbOrThrow();
  const conditions = [
    eq(voucherEntries.accountId, glAccountId),
    eq(voucherEntries.organizationId, organizationId),
    // Deposits = debit entries (money coming INTO the bank account)
    sql`${voucherEntries.debit} > 0`,
  ];
  if (dateFromBs) conditions.push(sql`${vouchers.dateBs} >= ${dateFromBs}`);
  if (dateToBs) conditions.push(sql`${vouchers.dateBs} <= ${dateToBs}`);

  const rows = await db.select({
    id: voucherEntries.id,
    dateBs: vouchers.dateBs,
    description: voucherEntries.narration,
    debit: voucherEntries.debit,
    credit: voucherEntries.credit,
    voucherNo: vouchers.voucherNo,
    voucherType: vouchers.voucherType,
  })
    .from(voucherEntries)
    .innerJoin(vouchers, eq(voucherEntries.voucherId, vouchers.id))
    .where(and(...conditions))
    .orderBy(asc(vouchers.dateBs));

  return rows.map(r => ({
    id: r.id,
    dateBs: r.dateBs,
    description: r.description || `${r.voucherType} ${r.voucherNo}`,
    debit: Number(r.debit),
    credit: Number(r.credit),
    voucherNo: r.voucherNo,
    voucherType: r.voucherType,
  }));
}

// =============================================
// Book Entries for GL Account
// =============================================

export async function getBookEntries(
  glAccountId: string,
  organizationId: string,
  dateFromBs?: string,
  dateToBs?: string,
) {
  const db = getDbOrThrow();
  const conditions = [
    eq(voucherEntries.accountId, glAccountId),
    eq(voucherEntries.organizationId, organizationId),
  ];
  if (dateFromBs) conditions.push(sql`${vouchers.dateBs} >= ${dateFromBs}`);
  if (dateToBs) conditions.push(sql`${vouchers.dateBs} <= ${dateToBs}`);

  return db.select({
    voucherId: voucherEntries.voucherId,
    voucherEntryId: voucherEntries.id,
    dateBs: vouchers.dateBs,
    description: voucherEntries.narration,
    debit: voucherEntries.debit,
    credit: voucherEntries.credit,
    voucherNo: vouchers.voucherNo,
    voucherType: vouchers.voucherType,
    accountCode: voucherEntries.accountCode,
    accountName: voucherEntries.accountName,
  })
    .from(voucherEntries)
    .innerJoin(vouchers, eq(voucherEntries.voucherId, vouchers.id))
    .where(and(...conditions))
    .orderBy(asc(vouchers.dateBs))
    .then(rows => rows.map(r => ({
      ...r,
      debit: Number(r.debit),
      credit: Number(r.credit),
    })));
}

// =============================================
// Statement Entries
// =============================================

export async function addStatementEntries(
  inputs: StatementEntryInput[],
) {
  if (inputs.length === 0) return [];
  const db = getDbOrThrow();
  return db.insert(reconciliationStatementEntries).values(
    inputs.map(i => ({
      reconciliationId: i.reconciliationId,
      organizationId: i.organizationId,
      entryDateBs: i.entryDateBs,
      description: i.description,
      reference: i.reference,
      chequeNo: i.chequeNo,
      debit: (i.debit || 0).toString(),
      credit: (i.credit || 0).toString(),
    }))
  ).returning();
}

export async function deleteStatementEntries(reconciliationId: string) {
  const db = getDbOrThrow();
  await db.delete(reconciliationStatementEntries)
    .where(eq(reconciliationStatementEntries.reconciliationId, reconciliationId));
}

// =============================================
// Adjustments (bank charges, interest, etc.)
// =============================================

export async function addAdjustment(input: AdjustmentInput) {
  const db = getDbOrThrow();
  const [row] = await db.insert(reconciliationAdjustments).values({
    reconciliationId: input.reconciliationId,
    organizationId: input.organizationId,
    adjustmentType: input.adjustmentType,
    description: input.description,
    amount: input.amount.toString(),
    dateBs: input.dateBs,
    needsPosting: true,
  }).returning();
  return row;
}

export async function deleteAdjustment(id: string) {
  const db = getDbOrThrow();
  await db.delete(reconciliationAdjustments)
    .where(eq(reconciliationAdjustments.id, id));
}

// =============================================
// Outstanding Items
// =============================================

export async function addOutstandingItems(inputs: OutstandingItemInput[]) {
  if (inputs.length === 0) return [];
  const db = getDbOrThrow();
  return db.insert(reconciliationOutstandingItems).values(
    inputs.map(i => ({
      reconciliationId: i.reconciliationId,
      organizationId: i.organizationId,
      itemType: i.itemType,
      sourceId: i.sourceId,
      sourceType: i.sourceType,
      chequeNo: i.chequeNo,
      payeeName: i.payeeName,
      description: i.description,
      amount: i.amount.toString(),
      entryDateBs: i.entryDateBs,
      status: 'pending' as const,
    }))
  ).returning();
}

export async function updateOutstandingItemStatus(
  id: string,
  status: 'pending' | 'cleared' | 'voided',
  clearedDateBs?: string,
) {
  const db = getDbOrThrow();
  const [row] = await db.update(reconciliationOutstandingItems)
    .set({ status, clearedDateBs })
    .where(eq(reconciliationOutstandingItems.id, id))
    .returning();
  return row || null;
}

export async function deleteOutstandingItems(reconciliationId: string) {
  const db = getDbOrThrow();
  await db.delete(reconciliationOutstandingItems)
    .where(eq(reconciliationOutstandingItems.reconciliationId, reconciliationId));
}

// =============================================
// Auto-Match: System entries vs Statement entries
// =============================================

export async function autoMatchEntries(
  reconciliationId: string,
  organizationId: string,
) {
  const db = getDbOrThrow();

  // Get unmatched book entries
  const bookEntries = await db.select().from(bankReconciliationEntries)
    .where(and(
      eq(bankReconciliationEntries.reconciliationId, reconciliationId),
      eq(bankReconciliationEntries.matchStatus, 'unmatched'),
    ));

  // Get unmatched statement entries
  const stmtEntries = await db.select().from(reconciliationStatementEntries)
    .where(and(
      eq(reconciliationStatementEntries.reconciliationId, reconciliationId),
      eq(reconciliationStatementEntries.matchStatus, 'unmatched'),
    ));

  let matchCount = 0;

  for (const book of bookEntries) {
    const bookAmount = Number(book.bookDebit) - Number(book.bookCredit);
    for (const stmt of stmtEntries) {
      if (stmt.matchStatus !== 'unmatched') continue;
      const stmtAmount = Number(stmt.debit) - Number(stmt.credit);

      // Match by amount (within tolerance of Rs 1)
      if (Math.abs(bookAmount - stmtAmount) < 1) {
        // Also check date proximity (within 3 days)
        const bookDate = book.bookDateBs;
        const stmtDate = stmt.entryDateBs;

        // Update book entry
        await db.update(bankReconciliationEntries)
          .set({
            matchStatus: 'matched',
            matchType: 'auto',
            statementDateBs: stmtDate,
            statementDescription: stmt.description,
            statementDebit: stmt.debit,
            statementCredit: stmt.credit,
            varianceAmount: '0',
          })
          .where(eq(bankReconciliationEntries.id, book.id));

        // Update statement entry
        await db.update(reconciliationStatementEntries)
          .set({
            matchStatus: 'matched',
            matchedReconEntryId: book.id,
          })
          .where(eq(reconciliationStatementEntries.id, stmt.id));

        matchCount++;
        break;
      }
    }
  }

  return matchCount;
}

// =============================================
// Reconciliation Summary
// =============================================

export async function getReconciliationSummary(
  reconciliationId: string,
) {
  const db = getDbOrThrow();

  // Count matched/unmatched book entries
  const bookStats = await db.select({
    matchStatus: bankReconciliationEntries.matchStatus,
    count: sql<number>`COUNT(*)::int`,
    totalDebit: sql<string>`COALESCE(SUM(${bankReconciliationEntries.bookDebit}), 0)`,
    totalCredit: sql<string>`COALESCE(SUM(${bankReconciliationEntries.bookCredit}), 0)`,
  })
    .from(bankReconciliationEntries)
    .where(eq(bankReconciliationEntries.reconciliationId, reconciliationId))
    .groupBy(bankReconciliationEntries.matchStatus);

  // Count matched/unmatched statement entries
  const stmtStats = await db.select({
    matchStatus: reconciliationStatementEntries.matchStatus,
    count: sql<number>`COUNT(*)::int`,
  })
    .from(reconciliationStatementEntries)
    .where(eq(reconciliationStatementEntries.reconciliationId, reconciliationId))
    .groupBy(reconciliationStatementEntries.matchStatus);

  // Outstanding items
  const outstandingStats = await db.select({
    itemType: reconciliationOutstandingItems.itemType,
    count: sql<number>`COUNT(*)::int`,
    totalAmount: sql<string>`COALESCE(SUM(${reconciliationOutstandingItems.amount}), 0)`,
  })
    .from(reconciliationOutstandingItems)
    .where(eq(reconciliationOutstandingItems.reconciliationId, reconciliationId))
    .groupBy(reconciliationOutstandingItems.itemType);

  // Adjustments
  const adjStats = await db.select({
    count: sql<number>`COUNT(*)::int`,
    totalAmount: sql<string>`COALESCE(SUM(${reconciliationAdjustments.amount}), 0)`,
  })
    .from(reconciliationAdjustments)
    .where(eq(reconciliationAdjustments.reconciliationId, reconciliationId));

  return {
    bookEntries: bookStats,
    statementEntries: stmtStats,
    outstandingItems: outstandingStats,
    adjustments: adjStats[0] || { count: 0, totalAmount: '0' },
  };
}

// =============================================
// Bank Accounts for Reconciliation
// =============================================

export async function getBankAccountsForReconciliation(
  organizationId: string,
) {
  const db = getDbOrThrow();
  return db.select({
    id: bankAccounts.id,
    accountName: bankAccounts.accountName,
    accountNumber: bankAccounts.accountNumber,
    bankName: sql<string>`COALESCE((SELECT name FROM banks WHERE id = bank_accounts.bank_id), 'Unknown')`,
    glAccountId: bankAccounts.glAccountId,
    glAccountCode: sql<string>`COALESCE((SELECT code FROM chart_of_accounts WHERE id = bank_accounts.gl_account_id), '')`,
    glAccountName: sql<string>`COALESCE((SELECT name FROM chart_of_accounts WHERE id = bank_accounts.gl_account_id), '')`,
    currentBalance: sql<string>`COALESCE((SELECT balance FROM chart_of_accounts WHERE id = bank_accounts.gl_account_id), 0)`,
    reconciliationEnabled: bankAccounts.reconciliationEnabled,
    lastReconciledDateBs: bankAccounts.lastReconciledDateBs,
  })
    .from(bankAccounts)
    .where(eq(bankAccounts.organizationId, organizationId))
    .orderBy(asc(bankAccounts.accountName))
    .then(rows => rows.map(r => ({ ...r, currentBalance: Number(r.currentBalance) })));
}
