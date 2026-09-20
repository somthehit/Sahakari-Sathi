/**
 * Savings Repository
 * Data access layer for savings accounts and transactions
 */
import { eq, like, and, or, desc, asc, count, gte, lte, SQL, ilike, inArray } from 'drizzle-orm';
import { getDb, type DbExecutor } from '../../db/client';
import { savingsAccounts, savingsTransactions } from '../../db/schema';
import type { PaginatedResult } from './MemberRepository';
import { v4 as uuidv4 } from 'uuid';

export interface SavingsFilter {
  organizationId?: string;
  search?: string;
  branchId?: string;
  /** Strict branch scope: `undefined` = org level, `[]` = no branch access. */
  branchIds?: string[];
  memberId?: string;
  productType?: string;
  status?: string;
  page?: number;
  limit?: number;
}

/** Optional filters for a savings statement ledger query. */
export interface TransactionFilter {
  dateFromBs?: string;
  dateToBs?: string;
  type?: string;
  limit?: number;
}

export class SavingsRepository {
  private get db() {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    return db;
  }

  async findAll(filter: SavingsFilter = {}): Promise<PaginatedResult<typeof savingsAccounts.$inferSelect>> {
    const {
      organizationId, search, branchId, branchIds, memberId, productType, status,
      page = 1, limit = 50
    } = filter;

    const conditions: SQL[] = [];
    if (organizationId) conditions.push(eq(savingsAccounts.organizationId, organizationId));
    if (search) {
      conditions.push(
        or(
          ilike(savingsAccounts.memberName, `%${search}%`),
          ilike(savingsAccounts.accountNo, `%${search}%`),
          ilike(savingsAccounts.memberNo, `%${search}%`)
        )!
      );
    }
    if (branchId) conditions.push(eq(savingsAccounts.branchId, branchId));
    if (branchIds !== undefined) conditions.push(inArray(savingsAccounts.branchId, branchIds));
    if (memberId) conditions.push(eq(savingsAccounts.memberId, memberId));
    if (productType) conditions.push(eq(savingsAccounts.productType, productType as any));
    if (status) conditions.push(eq(savingsAccounts.status, status as any));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, totalResult] = await Promise.all([
      this.db.select().from(savingsAccounts)
        .where(where)
        .orderBy(desc(savingsAccounts.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ count: count() }).from(savingsAccounts).where(where)
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, organizationId?: string, branchIds?: string[], client?: DbExecutor) {
    const db = client ?? this.db;
    const results = await db.select().from(savingsAccounts)
      .where(and(
        eq(savingsAccounts.id, id),
        ...(organizationId ? [eq(savingsAccounts.organizationId, organizationId)] : []),
        ...(branchIds !== undefined ? [inArray(savingsAccounts.branchId, branchIds)] : [])
      ))
      .limit(1);
    return results[0] ?? null;
  }

  async findByAccountNo(accountNo: string, organizationId?: string, branchIds?: string[]) {
    const results = await this.db.select().from(savingsAccounts)
      .where(and(
        eq(savingsAccounts.accountNo, accountNo),
        ...(organizationId ? [eq(savingsAccounts.organizationId, organizationId)] : []),
        ...(branchIds !== undefined ? [inArray(savingsAccounts.branchId, branchIds)] : [])
      ))
      .limit(1);
    return results[0] ?? null;
  }

  /**
   * Business rule: a member may hold only ONE ACTIVE account per savings product.
   * Returns the existing Active account for (org, member, product) or null.
   * Dormant / Closed / Matured accounts are deliberately ignored so they never
   * block opening a fresh account for the same product.
   */
  async findActiveByMemberAndProduct(organizationId: string, memberId: string, savingsProductId: string | null, client?: DbExecutor) {
    if (!savingsProductId) return null;
    const db = client ?? this.db;
    const results = await db.select().from(savingsAccounts)
      .where(and(
        eq(savingsAccounts.organizationId, organizationId),
        eq(savingsAccounts.memberId, memberId),
        eq(savingsAccounts.savingsProductId, savingsProductId),
        eq(savingsAccounts.status, 'Active' as const)
      ))
      .limit(1);
    return results[0] ?? null;
  }

  async create(data: typeof savingsAccounts.$inferInsert) {
    if (!data.organizationId) throw new Error('organizationId is required');
    const results = await this.db.insert(savingsAccounts).values(data).returning();
    return results[0];
  }

  async update(id: string, data: Partial<typeof savingsAccounts.$inferInsert>, organizationId?: string) {
    const conditions: SQL[] = [eq(savingsAccounts.id, id)];
    if (organizationId) conditions.push(eq(savingsAccounts.organizationId, organizationId));
    const results = await this.db.update(savingsAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    return results[0] ?? null;
  }

  async processTransaction(txnData: typeof savingsTransactions.$inferInsert, organizationId?: string, branchIds?: string[], client?: DbExecutor) {
    // When a client (transaction) is supplied the caller owns the transaction
    // so the insert + balance update join it atomically; otherwise a fresh
    // transaction is opened here.
    if (client) {
      return this.processTransactionWithin(client, txnData, organizationId, branchIds);
    }
    return await this.db.transaction(async (tx) =>
      this.processTransactionWithin(tx, txnData, organizationId, branchIds)
    );
  }

  private async processTransactionWithin(tx: DbExecutor, txnData: typeof savingsTransactions.$inferInsert, organizationId?: string, branchIds?: string[]) {
      // 1. Lock the savings account (SELECT ... FOR UPDATE) before reading balance to prevent race condition overdraws
      const account = await tx.select().from(savingsAccounts)
        .where(and(
          eq(savingsAccounts.id, txnData.accountId),
          ...(organizationId ? [eq(savingsAccounts.organizationId, organizationId)] : []),
          ...(branchIds !== undefined ? [inArray(savingsAccounts.branchId, branchIds)] : [])
        ))
        .for('update')
        .limit(1).then(r => r[0]);
      if (!account) throw new Error('Account not found');

      const currentBalance = parseFloat(account.balance);
      const amount = parseFloat(txnData.amount);
      let newBalance = currentBalance;

      if (['Deposit', 'Interest_Posting', 'Transfer_In'].includes(txnData.type)) {
        newBalance += amount;
      } else if (['Withdrawal', 'Transfer_Out', 'Penalty'].includes(txnData.type)) {
        if (currentBalance < amount) throw new Error('Insufficient balance');
        newBalance -= amount;
      } else {
        throw new Error(`Unhandled transaction type: ${txnData.type}`);
      }

      // 2. Insert transaction
      const txnResult = await tx.insert(savingsTransactions).values(txnData).returning();
      const transaction = txnResult[0];

      if (!transaction) throw new Error('Failed to record transaction');

      // 3. Update account balance
      await tx.update(savingsAccounts)
        .set({ 
          balance: String(newBalance),
          lastTransactionDateBs: transaction.dateBs,
          updatedAt: new Date()
        })
        .where(and(
          eq(savingsAccounts.id, account.id),
          ...(organizationId ? [eq(savingsAccounts.organizationId, organizationId)] : [])
        ));

      return transaction;
  }

  async getTransactions(accountId: string, organizationId?: string, branchIds?: string[], filter: TransactionFilter = {}) {
    const conditions: SQL[] = [
      eq(savingsTransactions.accountId, accountId),
      ...(organizationId ? [eq(savingsTransactions.organizationId, organizationId)] : []),
      ...(branchIds !== undefined ? [inArray(savingsTransactions.branchId, branchIds)] : [])
    ];
    if (filter.dateFromBs) conditions.push(gte(savingsTransactions.dateBs, filter.dateFromBs));
    if (filter.dateToBs) conditions.push(lte(savingsTransactions.dateBs, filter.dateToBs));
    if (filter.type) conditions.push(eq(savingsTransactions.type, filter.type as any));

    return this.db.select().from(savingsTransactions)
      .where(and(...conditions))
      .orderBy(asc(savingsTransactions.dateBs), asc(savingsTransactions.dateAd), asc(savingsTransactions.createdAt))
      .limit(filter.limit ?? 2000);
  }
}
