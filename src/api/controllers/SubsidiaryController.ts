import { Request, Response } from 'express';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  members,
  subsidiarySharesBook,
  subsidiarySavingsBook,
  subsidiaryLoansBook,
  shareAccounts,
  savingsAccounts,
  loanAccounts,
  interestPostings,
  emiSchedules,
} from '../../db/schema';

interface OrgUser {
  organizationId?: string;
  branchIds?: string[];
  isOrgAdmin?: boolean;
}

const num = (v: unknown): number => Number(v ?? 0) || 0;

const normalizeShare = (row: any) => ({
  id: row.id,
  memberId: row.memberId,
  memberNo: row.memberNo ?? undefined,
  memberName: row.memberName ?? undefined,
  voucherNo: row.voucherNo,
  transactionDateBs: row.transactionDateBs,
  transactionType: row.transactionType,
  shareQuantity: row.shareQuantity,
  faceValue: num(row.faceValue),
  debitAmount: num(row.debitAmount),
  creditAmount: num(row.creditAmount),
  balanceAmount: num(row.balanceAmount),
  createdAt: row.createdAt,
});

const normalizeSaving = (row: any) => ({
  id: row.id,
  memberId: row.memberId,
  memberNo: row.memberNo ?? undefined,
  memberName: row.memberName ?? undefined,
  accountNo: row.accountNo,
  accountType: row.accountType,
  voucherNo: row.voucherNo,
  transactionDateBs: row.transactionDateBs,
  debitAmount: num(row.debitAmount),
  creditAmount: num(row.creditAmount),
  balanceAmount: num(row.balanceAmount),
  createdAt: row.createdAt,
});

const normalizeLoan = (row: any) => ({
  id: row.id,
  memberId: row.memberId,
  memberNo: row.memberNo ?? undefined,
  memberName: row.memberName ?? undefined,
  loanAccountNo: row.loanAccountNo,
  voucherNo: row.voucherNo,
  transactionDateBs: row.transactionDateBs,
  principalDebit: num(row.principalDebit),
  principalCredit: num(row.principalCredit),
  interestCredit: num(row.interestCredit),
  penaltyCredit: num(row.penaltyCredit),
  remainingPrincipal: num(row.remainingPrincipal),
  createdAt: row.createdAt,
});

export class SubsidiaryController {
  /** All three subsidiary books + the member financial summary view for the org. */
  static async getBooks(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const branchIds = req.user?.isOrgAdmin ? undefined : req.user?.branchIds;
      const memberBranchFilter = branchIds !== undefined ? inArray(members.branchId, branchIds) : undefined;

      const shareRows = await db
        .select({
          id: subsidiarySharesBook.id,
          memberId: subsidiarySharesBook.memberId,
          memberNo: members.memberNo,
          memberName: members.fullName,
          voucherNo: subsidiarySharesBook.voucherNo,
          transactionDateBs: subsidiarySharesBook.transactionDateBs,
          transactionType: subsidiarySharesBook.transactionType,
          shareQuantity: subsidiarySharesBook.shareQuantity,
          faceValue: subsidiarySharesBook.faceValue,
          debitAmount: subsidiarySharesBook.debitAmount,
          creditAmount: subsidiarySharesBook.creditAmount,
          balanceAmount: subsidiarySharesBook.balanceAmount,
          createdAt: subsidiarySharesBook.createdAt,
        })
        .from(subsidiarySharesBook)
        .innerJoin(
          members,
          and(
            eq(members.id, subsidiarySharesBook.memberId),
            eq(members.organizationId, organizationId),
            ...(memberBranchFilter ? [memberBranchFilter] : [])
          )
        )
        .where(eq(subsidiarySharesBook.organizationId, organizationId))
        .orderBy(desc(subsidiarySharesBook.transactionDateBs), desc(subsidiarySharesBook.createdAt));

      const savingRows = await db
        .select({
          id: subsidiarySavingsBook.id,
          memberId: subsidiarySavingsBook.memberId,
          memberNo: members.memberNo,
          memberName: members.fullName,
          accountNo: subsidiarySavingsBook.accountNo,
          accountType: subsidiarySavingsBook.accountType,
          voucherNo: subsidiarySavingsBook.voucherNo,
          transactionDateBs: subsidiarySavingsBook.transactionDateBs,
          debitAmount: subsidiarySavingsBook.debitAmount,
          creditAmount: subsidiarySavingsBook.creditAmount,
          balanceAmount: subsidiarySavingsBook.balanceAmount,
          createdAt: subsidiarySavingsBook.createdAt,
        })
        .from(subsidiarySavingsBook)
        .innerJoin(
          members,
          and(
            eq(members.id, subsidiarySavingsBook.memberId),
            eq(members.organizationId, organizationId),
            ...(memberBranchFilter ? [memberBranchFilter] : [])
          )
        )
        .where(eq(subsidiarySavingsBook.organizationId, organizationId))
        .orderBy(desc(subsidiarySavingsBook.transactionDateBs), desc(subsidiarySavingsBook.createdAt));

      const loanRows = await db
        .select({
          id: subsidiaryLoansBook.id,
          memberId: subsidiaryLoansBook.memberId,
          memberNo: members.memberNo,
          memberName: members.fullName,
          loanAccountNo: subsidiaryLoansBook.loanAccountNo,
          voucherNo: subsidiaryLoansBook.voucherNo,
          transactionDateBs: subsidiaryLoansBook.transactionDateBs,
          principalDebit: subsidiaryLoansBook.principalDebit,
          principalCredit: subsidiaryLoansBook.principalCredit,
          interestCredit: subsidiaryLoansBook.interestCredit,
          penaltyCredit: subsidiaryLoansBook.penaltyCredit,
          remainingPrincipal: subsidiaryLoansBook.remainingPrincipal,
          createdAt: subsidiaryLoansBook.createdAt,
        })
        .from(subsidiaryLoansBook)
        .innerJoin(
          members,
          and(
            eq(members.id, subsidiaryLoansBook.memberId),
            eq(members.organizationId, organizationId),
            ...(memberBranchFilter ? [memberBranchFilter] : [])
          )
        )
        .where(eq(subsidiaryLoansBook.organizationId, organizationId))
        .orderBy(desc(subsidiaryLoansBook.transactionDateBs), desc(subsidiaryLoansBook.createdAt));

      const summaryRows = await db.execute(
        sql`
          SELECT member_id, member_no, full_name, phone,
                 total_share_balance, total_savings_balance, total_outstanding_loan
          FROM view_member_financial_summary
          WHERE organization_id = ${organizationId}
          ${branchIds !== undefined ? sql`AND branch_id IN (${sql.join(branchIds.map((b) => sql`${b}`), sql`, `)})` : sql``}
          ORDER BY full_name ASC
        `
      );

      // ── Account-level aggregated summaries (one row per account) ──────────
      // Share accounts: authoritative master row per member (share_accounts).
      const shareAccountRows = await db
        .select({
          memberId: members.id,
          memberNo: members.memberNo,
          memberName: members.fullName,
          accountNo: shareAccounts.accountNo,
          totalShares: shareAccounts.totalShares,
          totalValue: shareAccounts.totalCapitalAmount,
        })
        .from(shareAccounts)
        .innerJoin(
          members,
          and(
            eq(members.id, shareAccounts.memberId),
            eq(members.organizationId, organizationId),
            ...(memberBranchFilter ? [memberBranchFilter] : [])
          )
        )
        .where(eq(shareAccounts.organizationId, organizationId))
        .orderBy(members.fullName);

      // Savings accounts: master row per savings account + cumulative interest posted.
      const savingAccountRows = await db
        .select({
          id: savingsAccounts.id,
          memberId: savingsAccounts.memberId,
          memberNo: savingsAccounts.memberNo,
          memberName: savingsAccounts.memberName,
          accountNo: savingsAccounts.accountNo,
          accountType: savingsAccounts.productType,
          productName: savingsAccounts.productName,
          balance: savingsAccounts.balance,
          status: savingsAccounts.status,
        })
        .from(savingsAccounts)
        .where(
          and(
            eq(savingsAccounts.organizationId, organizationId),
            ...(branchIds !== undefined ? [inArray(savingsAccounts.branchId, branchIds)] : [])
          )
        )
        .orderBy(savingsAccounts.accountNo);

      const interestByAccount = await db
        .select({
          accountId: interestPostings.accountId,
          totalInterest: sql<string>`COALESCE(SUM(${interestPostings.netInterest}), 0)`,
        })
        .from(interestPostings)
        .where(eq(interestPostings.organizationId, organizationId))
        .groupBy(interestPostings.accountId);
      const interestMap = new Map(interestByAccount.map((r) => [r.accountId, num(r.totalInterest)]));

      // Loan accounts: master row per loan + outstanding interest from unpaid EMIs.
      const loanAccountRows = await db
        .select({
          id: loanAccounts.id,
          memberId: loanAccounts.memberId,
          memberNo: loanAccounts.memberNo,
          memberName: loanAccounts.memberName,
          loanAccountNo: loanAccounts.loanNo,
          productName: loanAccounts.productName,
          principalOutstanding: loanAccounts.outstandingPrincipal,
          maturityDateBs: loanAccounts.maturityDateBs,
          status: loanAccounts.status,
        })
        .from(loanAccounts)
        .where(
          and(
            eq(loanAccounts.organizationId, organizationId),
            ...(branchIds !== undefined ? [inArray(loanAccounts.branchId, branchIds)] : [])
          )
        )
        .orderBy(loanAccounts.loanNo);

      const interestDueByLoan = await db
        .select({
          loanId: emiSchedules.loanId,
          totalDue: sql<string>`COALESCE(SUM(${emiSchedules.interest}), 0)`,
        })
        .from(emiSchedules)
        .where(
          and(
            eq(emiSchedules.organizationId, organizationId),
            inArray(emiSchedules.status, ['Due', 'Overdue'])
          )
        )
        .groupBy(emiSchedules.loanId);
      const interestDueMap = new Map(interestDueByLoan.map((r) => [r.loanId, num(r.totalDue)]));

      res.json({
        shares: shareRows.map(normalizeShare),
        savings: savingRows.map(normalizeSaving),
        loans: loanRows.map(normalizeLoan),
        summary: (summaryRows as any[]).map((r: any) => ({
          memberId: r.member_id,
          memberNo: r.member_no,
          fullName: r.full_name,
          phone: r.phone,
          totalShareBalance: num(r.total_share_balance),
          totalSavingsBalance: num(r.total_savings_balance),
          totalOutstandingLoan: num(r.total_outstanding_loan),
        })),
        shareAccounts: shareAccountRows.map((r) => ({
          memberId: r.memberId,
          memberNo: r.memberNo,
          memberName: r.memberName,
          accountNo: r.accountNo,
          totalShares: num(r.totalShares),
          totalValue: num(r.totalValue),
          status: num(r.totalShares) > 0 ? 'Active' : 'Inactive',
        })),
        savingsAccounts: savingAccountRows.map((r) => ({
          memberId: r.memberId,
          memberNo: r.memberNo,
          memberName: r.memberName,
          accountNo: r.accountNo,
          accountType: r.accountType,
          productName: r.productName,
          balance: num(r.balance),
          interestEarned: interestMap.get(r.id) ?? 0,
          status: r.status,
        })),
        loanAccounts: loanAccountRows.map((r) => ({
          memberId: r.memberId,
          memberNo: r.memberNo,
          memberName: r.memberName,
          loanAccountNo: r.loanAccountNo,
          productName: r.productName,
          principalOutstanding: num(r.principalOutstanding),
          interestDue: interestDueMap.get(r.id) ?? 0,
          maturityDateBs: r.maturityDateBs,
          status: r.status,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
