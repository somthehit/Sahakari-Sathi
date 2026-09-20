/**
 * Loan Repository
 * Data access layer for loan accounts, EMI schedules, and repayments
 */
import { eq, like, and, or, desc, asc, count, SQL, ilike, inArray } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { loanAccounts, emiSchedules, loanRepayments } from '../../db/schema';
import type { PaginatedResult } from './MemberRepository';

export interface LoanFilter {
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

export class LoanRepository {
  private get db() {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    return db;
  }

  async findAll(filter: LoanFilter = {}): Promise<PaginatedResult<typeof loanAccounts.$inferSelect>> {
    const {
      organizationId, search, branchId, branchIds, memberId, productType, status,
      page = 1, limit = 50
    } = filter;

    const conditions: SQL[] = [];
    if (organizationId) conditions.push(eq(loanAccounts.organizationId, organizationId));
    if (search) {
      conditions.push(
        or(
          ilike(loanAccounts.memberName, `%${search}%`),
          ilike(loanAccounts.loanNo, `%${search}%`),
          ilike(loanAccounts.memberNo, `%${search}%`)
        )!
      );
    }
    if (branchId) conditions.push(eq(loanAccounts.branchId, branchId));
    if (branchIds !== undefined) conditions.push(inArray(loanAccounts.branchId, branchIds));
    if (memberId) conditions.push(eq(loanAccounts.memberId, memberId));
    if (productType) conditions.push(eq(loanAccounts.productType, productType as any));
    if (status) conditions.push(eq(loanAccounts.status, status as any));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, totalResult] = await Promise.all([
      this.db.select().from(loanAccounts)
        .where(where)
        .orderBy(desc(loanAccounts.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ count: count() }).from(loanAccounts).where(where)
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, organizationId?: string, branchIds?: string[]) {
    const results = await this.db.select().from(loanAccounts)
      .where(and(
        eq(loanAccounts.id, id),
        ...(organizationId ? [eq(loanAccounts.organizationId, organizationId)] : []),
        ...(branchIds !== undefined ? [inArray(loanAccounts.branchId, branchIds)] : [])
      ))
      .limit(1);
    return results[0] ?? null;
  }

  async findByLoanNo(loanNo: string, organizationId?: string, branchIds?: string[]) {
    const results = await this.db.select().from(loanAccounts)
      .where(and(
        eq(loanAccounts.loanNo, loanNo),
        ...(organizationId ? [eq(loanAccounts.organizationId, organizationId)] : []),
        ...(branchIds !== undefined ? [inArray(loanAccounts.branchId, branchIds)] : [])
      ))
      .limit(1);
    return results[0] ?? null;
  }

  async create(data: typeof loanAccounts.$inferInsert) {
    if (!data.organizationId) throw new Error('organizationId is required');
    const results = await this.db.insert(loanAccounts).values(data).returning();
    return results[0];
  }

  async update(id: string, data: Partial<typeof loanAccounts.$inferInsert>, organizationId?: string) {
    const conditions: SQL[] = [eq(loanAccounts.id, id)];
    if (organizationId) conditions.push(eq(loanAccounts.organizationId, organizationId));
    const results = await this.db.update(loanAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    return results[0] ?? null;
  }

  // EMI Schedule Management
  async generateEmiSchedule(schedules: typeof emiSchedules.$inferInsert[]) {
    return this.db.insert(emiSchedules).values(schedules).returning();
  }

  async getEmiSchedule(loanId: string, organizationId?: string, branchIds?: string[]) {
    if (branchIds !== undefined) {
      const loan = await this.findById(loanId, organizationId, branchIds);
      if (!loan) throw new Error('Loan not found');
    }
    return this.db.select().from(emiSchedules)
      .where(and(
        eq(emiSchedules.loanId, loanId),
        ...(organizationId ? [eq(emiSchedules.organizationId, organizationId)] : [])
      ))
      .orderBy(asc(emiSchedules.installmentNo));
  }

  // Repayment Processing
  async processRepayment(repaymentData: typeof loanRepayments.$inferInsert, organizationId?: string, branchIds?: string[]) {
    return await this.db.transaction(async (tx) => {
      // 1. Insert repayment
      const repaymentResult = await tx.insert(loanRepayments).values(repaymentData).returning();
      const repayment = repaymentResult[0];

      if (!repayment) throw new Error('Failed to record repayment');

      // 2. Update loan outstanding principal
      const loan = await tx.select().from(loanAccounts)
        .where(and(
          eq(loanAccounts.id, repayment.loanId),
          ...(organizationId ? [eq(loanAccounts.organizationId, organizationId)] : []),
          ...(branchIds !== undefined ? [inArray(loanAccounts.branchId, branchIds)] : [])
        ))
        .limit(1).then(r => r[0]);
      if (!loan) throw new Error('Loan not found');

      const currentPrincipal = parseFloat(loan.outstandingPrincipal);
      const principalPaid = parseFloat(repayment.principalPaid);
      const newPrincipal = Math.max(currentPrincipal - principalPaid, 0);

      // Write the actual outstanding after payment back to the repayment row
      await tx.update(loanRepayments)
        .set({ outstandingAfter: String(newPrincipal) })
        .where(eq(loanRepayments.id, repayment.id));

      await tx.update(loanAccounts)
        .set({ 
          outstandingPrincipal: String(newPrincipal),
          lastRepaymentDateBs: repayment.dateBs,
          updatedAt: new Date(),
          status: newPrincipal <= 0.005 ? 'Closed' : loan.status
        })
        .where(and(
          eq(loanAccounts.id, loan.id),
          ...(organizationId ? [eq(loanAccounts.organizationId, organizationId)] : [])
        ));

      return {
        ...repayment,
        outstandingAfter: String(newPrincipal),
      };
    });
  }

  async getRepayments(loanId: string, organizationId?: string, branchIds?: string[], limit = 50) {
    return this.db.select().from(loanRepayments)
      .where(and(
        eq(loanRepayments.loanId, loanId),
        ...(organizationId ? [eq(loanRepayments.organizationId, organizationId)] : []),
        ...(branchIds !== undefined ? [inArray(loanRepayments.branchId, branchIds)] : [])
      ))
      .orderBy(desc(loanRepayments.createdAt))
      .limit(limit);
  }
}
