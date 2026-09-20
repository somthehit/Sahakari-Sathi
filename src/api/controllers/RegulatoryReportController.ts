/**
 * RegulatoryReportController
 * Generates Department of Cooperatives (DoC) and IRD regulatory returns
 * from live organizational financial data.
 */
import { Request, Response } from 'express';
import { and, eq, sql, gte, lte } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { organizations, organizationProfiles } from '../../db/schema/auth';
import { orgUsers } from '../../db/schema/auth';
import { members } from '../../db/schema/members';
import { chartOfAccounts, vouchers, voucherEntries } from '../../db/schema/accounting';
import { savingsAccounts } from '../../db/schema/savings';
import { loanAccounts } from '../../db/schema/loans';
import { loanApplications } from '../../db/schema/loanApplications';
import { shareAccounts, shareTransactions } from '../../db/schema/shares';
import { fiscalYears } from '../../db/schema';

interface OrgUser {
  organizationId?: string;
  username?: string;
}

// ─── Helper: get active fiscal year range ──────────────────────────────
async function getActiveFiscalYear(db: any, organizationId: string) {
  const [fy] = await db.select().from(fiscalYears)
    .where(and(eq(fiscalYears.organizationId, organizationId), eq(fiscalYears.isCurrent, true)))
    .limit(1);
  return fy || null;
}

// ─── Helper: aggregate GL balances by type ─────────────────────────────
async function getGlBalancesByType(db: any, organizationId: string) {
  const rows = await db.select({
    type: chartOfAccounts.type,
    total: sql<string>`COALESCE(sum(${chartOfAccounts.balance}), 0)`,
  }).from(chartOfAccounts)
    .where(eq(chartOfAccounts.organizationId, organizationId))
    .groupBy(chartOfAccounts.type);
  const map: Record<string, number> = {};
  rows.forEach((r: any) => { map[r.type] = Number(r.total) || 0; });
  return map;
}

// ─── Helper: count members by status ───────────────────────────────────
async function getMemberStats(db: any, organizationId: string) {
  const rows = await db.select({
    status: members.status,
    count: sql<string>`count(*)`,
  }).from(members)
    .where(eq(members.organizationId, organizationId))
    .groupBy(members.status);
  const map: Record<string, number> = {};
  let total = 0;
  rows.forEach((r: any) => { map[r.status || 'active'] = Number(r.count); total += Number(r.count); });
  return { byStatus: map, total };
}

// ─── Helper: loan portfolio summary ────────────────────────────────────
async function getLoanPortfolio(db: any, organizationId: string) {
  const [agg] = await db.select({
    count: sql<string>`count(*)`,
    totalDisbursed: sql<string>`COALESCE(sum(${loanAccounts.disbursedAmount}), 0)`,
    outstandingPrincipal: sql<string>`COALESCE(sum(${loanAccounts.outstandingPrincipal}), 0)`,
    overdueAmount: sql<string>`COALESCE(sum(${loanAccounts.overdueAmount}), 0)`,
    provisionAmount: sql<string>`COALESCE(sum(${loanAccounts.provisionAmount}), 0)`,
  }).from(loanAccounts)
    .where(eq(loanAccounts.organizationId, organizationId));
  return {
    count: Number(agg?.count || 0),
    totalDisbursed: Number(agg?.totalDisbursed || 0),
    outstandingPrincipal: Number(agg?.outstandingPrincipal || 0),
    overdueAmount: Number(agg?.overdueAmount || 0),
    provisionAmount: Number(agg?.provisionAmount || 0),
  };
}

// ─── Helper: savings summary ───────────────────────────────────────────
async function getSavingsSummary(db: any, organizationId: string) {
  const [agg] = await db.select({
    count: sql<string>`count(*)`,
    totalBalance: sql<string>`COALESCE(sum(${savingsAccounts.balance}), 0)`,
  }).from(savingsAccounts)
    .where(eq(savingsAccounts.organizationId, organizationId));
  return {
    count: Number(agg?.count || 0),
    totalBalance: Number(agg?.totalBalance || 0),
  };
}

// ─── Helper: share summary ─────────────────────────────────────────────
async function getShareSummary(db: any, organizationId: string) {
  const [agg] = await db.select({
    count: sql<string>`count(*)`,
    totalAmount: sql<string>`COALESCE(sum(${shareAccounts.totalCapitalAmount}), 0)`,
  }).from(shareAccounts)
    .where(eq(shareAccounts.organizationId, organizationId));
  return {
    count: Number(agg?.count || 0),
    totalAmount: Number(agg?.totalAmount || 0),
  };
}

// ─── Helper: TDS deductions (from voucher narrations/metadata) ─────────
async function getTdsDeductions(db: any, organizationId: string, startDate?: string, endDate?: string) {
  const conditions = [
    eq(voucherEntries.organizationId, organizationId),
    sql`lower(${voucherEntries.narration}) LIKE '%tds%'`,
  ];
  if (startDate) conditions.push(gte(vouchers.dateBs, startDate));
  if (endDate) conditions.push(lte(vouchers.dateBs, endDate));

  const rows = await db.select({
    voucherNo: vouchers.voucherNo,
    dateBs: vouchers.dateBs,
    narration: voucherEntries.narration,
    debit: voucherEntries.debit,
    credit: voucherEntries.credit,
  }).from(voucherEntries)
    .innerJoin(vouchers, eq(voucherEntries.voucherId, vouchers.id))
    .where(and(...conditions))
    .orderBy(vouchers.dateBs);

  return rows.map((r: any) => ({
    voucherNo: r.voucherNo,
    dateBs: r.dateBs,
    narration: r.narration,
    debit: Number(r.debit || 0),
    credit: Number(r.credit || 0),
  }));
}

// ══════════════════════════════════════════════════════════════════════
// CONTROLLER
// ══════════════════════════════════════════════════════════════════════
export class RegulatoryReportController {

  /**
   * GET /api/v1/reports/doc-annual-return
   * DoC Annual Return — full financial snapshot for the cooperative.
   */
  static async getDocAnnualReturn(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const [org] = await db.select().from(organizations)
        .where(eq(organizations.id, organizationId)).limit(1);
      const [profile] = await db.select().from(organizationProfiles)
        .where(eq(organizationProfiles.organizationId, organizationId)).limit(1);
      const fy = await getActiveFiscalYear(db, organizationId);
      const glBalances = await getGlBalancesByType(db, organizationId);
      const memberStats = await getMemberStats(db, organizationId);
      const loanPortfolio = await getLoanPortfolio(db, organizationId);
      const savings = await getSavingsSummary(db, organizationId);
      const shares = await getShareSummary(db, organizationId);

      const totalIncome = glBalances['Income'] || 0;
      const totalExpense = glBalances['Expense'] || 0;
      const netSurplus = totalIncome - totalExpense;

      res.json({
        organization: {
          name: org?.organizationName || 'N/A',
          registrationNo: profile?.registrationNo || org?.govtRegNo || org?.organizationCode || 'N/A',
          address: org?.address || 'N/A',
          phone: org?.phone || 'N/A',
        },
        fiscalYear: fy ? { code: fy.code, startDate: fy.startDateBs, endDate: fy.endDateBs } : null,
        summary: {
          totalMembers: memberStats.total,
        activeMembers: memberStats.byStatus['Active'] || 0,
        totalShareCapital: shares.totalAmount,
          totalSavings: savings.totalBalance,
          totalLoanOutstanding: loanPortfolio.outstandingPrincipal + loanPortfolio.overdueAmount,
          totalLoanDisbursed: loanPortfolio.totalDisbursed,
          activeLoans: loanPortfolio.count,
        },
        financialPosition: {
          totalAssets: glBalances['Asset'] || 0,
          totalLiabilities: glBalances['Liability'] || 0,
          totalEquity: glBalances['Equity'] || 0,
          totalIncome,
          totalExpense,
          netSurplus,
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('RegulatoryReportController.getDocAnnualReturn:', error);
      res.status(500).json({ error: error.message || 'Failed to generate DoC Annual Return.' });
    }
  }

  /**
   * GET /api/v1/reports/doc-statistical-return
   * DoC Statistical Return — member/transaction/volume statistics.
   */
  static async getDocStatisticalReturn(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const [org] = await db.select().from(organizations)
        .where(eq(organizations.id, organizationId)).limit(1);
      const [profile] = await db.select().from(organizationProfiles)
        .where(eq(organizationProfiles.organizationId, organizationId)).limit(1);
      const fy = await getActiveFiscalYear(db, organizationId);
      const memberStats = await getMemberStats(db, organizationId);
      const loanPortfolio = await getLoanPortfolio(db, organizationId);
      const savings = await getSavingsSummary(db, organizationId);
      const shares = await getShareSummary(db, organizationId);
      const glBalances = await getGlBalancesByType(db, organizationId);

      // Count loan applications this FY (table may not exist yet)
      let loanAppCount = 0;
      try {
        const [appCount] = await db.select({
          count: sql<string>`count(*)`,
        }).from(loanApplications)
        .where(eq(loanApplications.organizationId, organizationId));
        loanAppCount = Number(appCount?.count || 0);
      } catch (_) { /* loan_applications table not migrated yet */ }

      // Count branches
      let branchCountNum = 0;
      try {
        const { branches } = await import('../../db/schema/branches');
        const [branchCount] = await db.select({
          count: sql<string>`count(*)`,
        }).from(branches)
        .where(eq(branches.organizationId, organizationId));
        branchCountNum = Number(branchCount?.count || 0);
      } catch (_) { /* branches query failed */ }

      res.json({
        organization: {
          name: org?.organizationName || 'N/A',
          registrationNo: profile?.registrationNo || org?.govtRegNo || org?.organizationCode || 'N/A',
        },
        fiscalYear: fy ? { code: fy.code, startDate: fy.startDateBs, endDate: fy.endDateBs } : null,
        memberStatistics: {
          totalMembers: memberStats.total,
          activeMembers: memberStats.byStatus['Active'] || 0,
          inactiveMembers: (memberStats.byStatus['Inactive'] || 0) + (memberStats.byStatus['Dormant'] || 0),
          pendingMembers: (memberStats.byStatus['Pending_KYC'] || 0) + (memberStats.byStatus['Pending_Approval'] || 0),
        },
        financialVolume: {
          totalShareCapital: shares.totalAmount,
          shareAccountCount: shares.count,
          totalSavings: savings.totalBalance,
          savingsAccountCount: savings.count,
          totalLoanDisbursed: loanPortfolio.totalDisbursed,
          activeLoans: loanPortfolio.count,
          outstandingLoanBalance: loanPortfolio.outstandingPrincipal + loanPortfolio.overdueAmount,
        },
        operational: {
          totalBranches: branchCountNum,
          loanApplicationsReceived: loanAppCount,
          totalAssets: glBalances['Asset'] || 0,
          totalLiabilities: glBalances['Liability'] || 0,
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('RegulatoryReportController.getDocStatisticalReturn:', error);
      res.status(500).json({ error: error.message || 'Failed to generate DoC Statistical Return.' });
    }
  }

  /**
   * GET /api/v1/reports/ird-tax-return
   * IRD Tax Return Summary — income/expense/tax overview.
   */
  static async getIrdTaxReturnSummary(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const [org] = await db.select().from(organizations)
        .where(eq(organizations.id, organizationId)).limit(1);
      const [profile] = await db.select().from(organizationProfiles)
        .where(eq(organizationProfiles.organizationId, organizationId)).limit(1);
      const fy = await getActiveFiscalYear(db, organizationId);
      const glBalances = await getGlBalancesByType(db, organizationId);

      // Get income breakdown by account
      const incomeAccounts = await db.select({
        code: chartOfAccounts.code,
        name: chartOfAccounts.name,
        balance: chartOfAccounts.balance,
      }).from(chartOfAccounts)
        .where(and(
          eq(chartOfAccounts.organizationId, organizationId),
          eq(chartOfAccounts.type, 'Income'),
        ));

      const expenseAccounts = await db.select({
        code: chartOfAccounts.code,
        name: chartOfAccounts.name,
        balance: chartOfAccounts.balance,
      }).from(chartOfAccounts)
        .where(and(
          eq(chartOfAccounts.organizationId, organizationId),
          eq(chartOfAccounts.type, 'Expense'),
        ));

      const totalIncome = glBalances['Income'] || 0;
      const totalExpense = glBalances['Expense'] || 0;
      const netProfit = totalIncome - totalExpense;

      // Simplified tax calculation (25% corporate rate for cooperatives in Nepal)
      const taxRate = 0.25;
      const taxableIncome = Math.max(0, netProfit);
      const estimatedTax = taxableIncome * taxRate;

      res.json({
        organization: {
          name: org?.organizationName || 'N/A',
          registrationNo: profile?.registrationNo || org?.govtRegNo || org?.organizationCode || 'N/A',
          panNumber: profile?.pan || 'N/A',
        },
        fiscalYear: fy ? { code: fy.code, startDate: fy.startDateBs, endDate: fy.endDateBs } : null,
        incomeBreakdown: incomeAccounts.map((a: any) => ({
          code: a.code, name: a.name, amount: Number(a.balance || 0),
        })),
        expenseBreakdown: expenseAccounts.map((a: any) => ({
          code: a.code, name: a.name, amount: Number(a.balance || 0),
        })),
        summary: {
          totalIncome,
          totalExpense,
          netProfit,
          taxableIncome,
          taxRate,
          estimatedTax,
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('RegulatoryReportController.getIrdTaxReturnSummary:', error);
      res.status(500).json({ error: error.message || 'Failed to generate IRD Tax Return Summary.' });
    }
  }

  /**
   * GET /api/v1/reports/tds-deduction
   * TDS Deduction Report — interest/dividend/salary TDS.
   */
  static async getTdsDeductionReport(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const [org] = await db.select().from(organizations)
        .where(eq(organizations.id, organizationId)).limit(1);
      const [profile] = await db.select().from(organizationProfiles)
        .where(eq(organizationProfiles.organizationId, organizationId)).limit(1);
      const fy = await getActiveFiscalYear(db, organizationId);
      const tdsEntries = await getTdsDeductions(db, organizationId, startDate, endDate);

      const totalTdsDebit = tdsEntries.reduce((s, e) => s + e.debit, 0);
      const totalTdsCredit = tdsEntries.reduce((s, e) => s + e.credit, 0);

      res.json({
        organization: {
          name: org?.organizationName || 'N/A',
          registrationNo: profile?.registrationNo || org?.govtRegNo || org?.organizationCode || 'N/A',
        },
        fiscalYear: fy ? { code: fy.code, startDate: fy.startDateBs, endDate: fy.endDateBs } : null,
        dateRange: { startDate: startDate || fy?.startDateBs || '', endDate: endDate || fy?.endDateBs || '' },
        entries: tdsEntries,
        summary: {
          totalEntries: tdsEntries.length,
          totalTdsDebit,
          totalTdsCredit,
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('RegulatoryReportController.getTdsDeductionReport:', error);
      res.status(500).json({ error: error.message || 'Failed to generate TDS Deduction Report.' });
    }
  }
}
