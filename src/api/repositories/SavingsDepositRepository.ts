/**
 * Savings Deposits Repository
 *
 * Data access for the teller-facing savings & deposits flow:
 *   - cheque leaf lookup/consumption (org-level cheque_leaves)
 *   - savings_cheque_deposits pending-clearance instrument register
 *   - savings_pending_withdrawals dual-approval queue
 *
 * All queries scoped to organization_id; optional strict branch scoping.
 */
import { eq, and, or, ilike, desc, asc, count, inArray, type SQL } from 'drizzle-orm';
import { getDb, type DbExecutor } from '../../db/client';
import {
  savingsAccounts,
  savingsTransactions,
  savingsChequeDeposits,
  savingsPendingWithdrawals,
  chequeLeaves,
  chequeBooks,
  chequeStopPayments,
  chequeSettings,
  members,
} from '../../db/schema';
import type { PaginatedResult } from './MemberRepository';
import { v4 as uuidv4 } from 'uuid';

export interface ChequeDepositFilter {
  organizationId?: string;
  branchIds?: string[];
  status?: string;
  accountId?: string;
  page?: number;
  limit?: number;
}

export interface PendingWithdrawalFilter {
  organizationId?: string;
  branchIds?: string[];
  status?: string;
  page?: number;
  limit?: number;
}

export class SavingsDepositRepository {
  private get db() {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    return db;
  }

  // ─────────────────────────────────────────────────────────────
  // Account lookup (teller fast-path)
  // ─────────────────────────────────────────────────────────────

  async findAccountByQuery(query: string, organizationId: string, branchIds?: string[]) {
    const conditions: SQL[] = [
      eq(savingsAccounts.organizationId, organizationId),
    ];
    if (branchIds !== undefined) conditions.push(inArray(savingsAccounts.branchId, branchIds));
    if (query) {
      conditions.push(or(
        ilike(savingsAccounts.accountNo, `%${query}%`),
        ilike(savingsAccounts.memberName, `%${query}%`),
        ilike(savingsAccounts.memberNo, `%${query}%`),
      )!);
    }
    const rows = await this.db.select({
      id: savingsAccounts.id,
      accountNo: savingsAccounts.accountNo,
      memberId: savingsAccounts.memberId,
      memberName: savingsAccounts.memberName,
      memberNo: savingsAccounts.memberNo,
      savingsProductId: savingsAccounts.savingsProductId,
      productName: savingsAccounts.productName,
      balance: savingsAccounts.balance,
      minBalance: savingsAccounts.minBalance,
      status: savingsAccounts.status,
      branchId: savingsAccounts.branchId,
      // Member snapshot used by cheque-book issuance eligibility checks.
      kycStatus: members.kycStatus,
      memberStatus: members.status,
    })
      .from(savingsAccounts)
      .leftJoin(members, eq(savingsAccounts.memberId, members.id))
      .where(and(...conditions))
      .orderBy(asc(savingsAccounts.accountNo))
      .limit(20);
    return rows;
  }

  // ─────────────────────────────────────────────────────────────
  // Cheque leaves (org-level operational warehouse)
  // ─────────────────────────────────────────────────────────────

  /** Look up a leaf by its formatted cheque number within the org. */
  async findChequeLeaf(chequeNumber: string, organizationId: string, client?: DbExecutor) {
    const db = client ?? this.db;
    const rows = await db.select()
      .from(chequeLeaves)
      .where(and(
        eq(chequeLeaves.organizationId, organizationId),
        eq(chequeLeaves.chequeNumber, chequeNumber)
      ))
      .limit(1);
    return rows[0] ?? null;
  }

  /** The cheque book a leaf belongs to (for the issued-account validation). */
  async findChequeBook(bookId: string, organizationId: string) {
    const rows = await this.db.select()
      .from(chequeBooks)
      .where(and(eq(chequeBooks.id, bookId), eq(chequeBooks.organizationId, organizationId)))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Approved stop-payment orders on an account. Consulted at presentation time
   * so that a range approved *after* a leaf was created still blocks it, even
   * if the leaf row was not individually flipped to 'stopped'.
   */
  async findApprovedStopPayments(organizationId: string, accountId: string, client?: DbExecutor) {
    const db = client ?? this.db;
    return db.select({
      startChequeNumber: chequeStopPayments.startChequeNumber,
      endChequeNumber: chequeStopPayments.endChequeNumber,
      status: chequeStopPayments.status,
    })
      .from(chequeStopPayments)
      .where(and(
        eq(chequeStopPayments.organizationId, organizationId),
        eq(chequeStopPayments.accountId, accountId),
        eq(chequeStopPayments.status, 'approved'),
      ));
  }

  /**
   * Cheque settings governing presentation (validity window + expiry behaviour),
   * preferring a branch-scoped row over the organization default.
   */
  async findChequeConfig(organizationId: string, branchId?: string | null, client?: DbExecutor) {
    const db = client ?? this.db;
    if (branchId) {
      const [branchCfg] = await db.select().from(chequeSettings)
        .where(and(
          eq(chequeSettings.organizationId, organizationId),
          eq(chequeSettings.scope, 'branch'),
          eq(chequeSettings.branchId, branchId),
        )).limit(1);
      if (branchCfg) return branchCfg;
    }
    const [orgCfg] = await db.select().from(chequeSettings)
      .where(and(
        eq(chequeSettings.organizationId, organizationId),
        eq(chequeSettings.scope, 'organization'),
      )).limit(1);
    return orgCfg ?? null;
  }

  /** Mark a cheque leaf as presented (validates it is still unused). */
  async consumeChequeLeaf(leafId: string, organizationId: string, txnId?: string, client?: DbExecutor) {
    const db = client ?? this.db;
    const [leaf] = await db.update(chequeLeaves)
      .set({
        status: 'presented',
        presentedDate: new Date(),
        ...(txnId ? { transactionId: txnId } : {}),
      } as any)
      .where(and(
        eq(chequeLeaves.id, leafId),
        eq(chequeLeaves.organizationId, organizationId),
        inArray(chequeLeaves.status, ['unused'])
      ))
      .returning();
    return leaf ?? null;
  }

  /**
   * Finalize a leaf as used after its payment/withdrawal has been posted.
   * Runs inside the same transaction as the money movement so the flip is
   * atomic with it. Accepts a leaf that is still `unused` or `presented` —
   * a `used`/`stopped`/`cancelled` leaf never matches, so it cannot be
   * re-finalized (double-spend guard).
   */
  async markChequeLeafUsed(leafId: string, organizationId: string, transactionId: string, client?: DbExecutor) {
    const db = client ?? this.db;
    const [leaf] = await db.update(chequeLeaves)
      .set({
        status: 'used',
        usedAt: new Date(),
        transactionId,
      } as any)
      .where(and(
        eq(chequeLeaves.id, leafId),
        eq(chequeLeaves.organizationId, organizationId),
        inArray(chequeLeaves.status, ['unused', 'presented'])
      ))
      .returning();
    return leaf ?? null;
  }

  /** Release a reserved leaf back to unused (e.g. a rejected withdrawal). */
  async releaseChequeLeaf(leafId: string, organizationId: string, client?: DbExecutor) {
    const db = client ?? this.db;
    const [leaf] = await db.update(chequeLeaves)
      .set({
        status: 'unused',
        presentedDate: null,
        transactionId: null,
      } as any)
      .where(and(
        eq(chequeLeaves.id, leafId),
        eq(chequeLeaves.organizationId, organizationId),
        inArray(chequeLeaves.status, ['presented'])
      ))
      .returning();
    return leaf ?? null;
  }

  // ─────────────────────────────────────────────────────────────
  // Savings cheque deposits (pending clearance)
  // ─────────────────────────────────────────────────────────────

  async createChequeDeposit(data: typeof savingsChequeDeposits.$inferInsert) {
    if (!data.organizationId) throw new Error('organizationId is required');
    const rows = await this.db.insert(savingsChequeDeposits).values({ ...data, id: uuidv4() }).returning();
    return rows[0];
  }

  async listChequeDeposits(filter: ChequeDepositFilter = {}): Promise<PaginatedResult<typeof savingsChequeDeposits.$inferSelect>> {
    const { organizationId, branchIds, status, accountId, page = 1, limit = 50 } = filter;
    const conditions: SQL[] = [];
    if (organizationId) conditions.push(eq(savingsChequeDeposits.organizationId, organizationId));
    if (branchIds !== undefined) conditions.push(inArray(savingsChequeDeposits.branchId, branchIds));
    if (status) conditions.push(eq(savingsChequeDeposits.status, status as any));
    if (accountId) conditions.push(eq(savingsChequeDeposits.accountId, accountId));
    const where = conditions.length ? and(...conditions) : undefined;

    const [data, totalResult] = await Promise.all([
      this.db.select().from(savingsChequeDeposits)
        .where(where)
        .orderBy(desc(savingsChequeDeposits.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ count: count() }).from(savingsChequeDeposits).where(where),
    ]);
    return { data, total: Number(totalResult[0]?.count ?? 0), page, limit, totalPages: Math.ceil(Number(totalResult[0]?.count ?? 0) / limit) };
  }

  async findChequeDeposit(id: string, organizationId: string, branchIds?: string[], client?: DbExecutor) {
    const db = client ?? this.db;
    const rows = await db.select().from(savingsChequeDeposits)
      .where(and(
        eq(savingsChequeDeposits.id, id),
        eq(savingsChequeDeposits.organizationId, organizationId),
        ...(branchIds !== undefined ? [inArray(savingsChequeDeposits.branchId, branchIds)] : [])
      ))
      .limit(1);
    return rows[0] ?? null;
  }

  async updateChequeDeposit(id: string, data: Partial<typeof savingsChequeDeposits.$inferInsert>, organizationId: string, client?: DbExecutor) {
    const db = client ?? this.db;
    const rows = await db.update(savingsChequeDeposits)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(savingsChequeDeposits.id, id), eq(savingsChequeDeposits.organizationId, organizationId)))
      .returning();
    return rows[0] ?? null;
  }

  // ─────────────────────────────────────────────────────────────
  // Pending withdrawals (dual approval)
  // ─────────────────────────────────────────────────────────────

  async createPendingWithdrawal(data: typeof savingsPendingWithdrawals.$inferInsert) {
    if (!data.organizationId) throw new Error('organizationId is required');
    const rows = await this.db.insert(savingsPendingWithdrawals).values({ ...data, id: uuidv4() }).returning();
    return rows[0];
  }

  async listPendingWithdrawals(filter: PendingWithdrawalFilter = {}): Promise<PaginatedResult<typeof savingsPendingWithdrawals.$inferSelect>> {
    const { organizationId, branchIds, status, page = 1, limit = 50 } = filter;
    const conditions: SQL[] = [];
    if (organizationId) conditions.push(eq(savingsPendingWithdrawals.organizationId, organizationId));
    if (branchIds !== undefined) conditions.push(inArray(savingsPendingWithdrawals.branchId, branchIds));
    if (status) conditions.push(eq(savingsPendingWithdrawals.status, status as any));
    const where = conditions.length ? and(...conditions) : undefined;

    const [data, totalResult] = await Promise.all([
      this.db.select().from(savingsPendingWithdrawals)
        .where(where)
        .orderBy(desc(savingsPendingWithdrawals.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ count: count() }).from(savingsPendingWithdrawals).where(where),
    ]);
    return { data, total: Number(totalResult[0]?.count ?? 0), page, limit, totalPages: Math.ceil(Number(totalResult[0]?.count ?? 0) / limit) };
  }

  async findPendingWithdrawal(id: string, organizationId: string, branchIds?: string[], client?: DbExecutor) {
    const db = client ?? this.db;
    const rows = await db.select().from(savingsPendingWithdrawals)
      .where(and(
        eq(savingsPendingWithdrawals.id, id),
        eq(savingsPendingWithdrawals.organizationId, organizationId),
        ...(branchIds !== undefined ? [inArray(savingsPendingWithdrawals.branchId, branchIds)] : [])
      ))
      .limit(1);
    return rows[0] ?? null;
  }

  async updatePendingWithdrawal(id: string, data: Partial<typeof savingsPendingWithdrawals.$inferInsert>, organizationId: string, client?: DbExecutor) {
    const db = client ?? this.db;
    const rows = await db.update(savingsPendingWithdrawals)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(savingsPendingWithdrawals.id, id), eq(savingsPendingWithdrawals.organizationId, organizationId)))
      .returning();
    return rows[0] ?? null;
  }

  // ─────────────────────────────────────────────────────────────
  // Ledger (account + transactions)
  // ─────────────────────────────────────────────────────────────

  async getLedgerTransactions(accountId: string, organizationId: string, branchIds?: string[]) {
    const conditions: SQL[] = [
      eq(savingsTransactions.accountId, accountId),
      eq(savingsTransactions.organizationId, organizationId),
      ...(branchIds !== undefined ? [inArray(savingsTransactions.branchId, branchIds)] : []),
    ];
    return this.db.select().from(savingsTransactions)
      .where(and(...conditions))
      .orderBy(asc(savingsTransactions.dateBs), asc(savingsTransactions.createdAt));
  }
}
