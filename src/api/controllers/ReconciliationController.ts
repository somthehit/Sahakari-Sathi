/**
 * Reconciliation Controller — Proper Bank Reconciliation
 *
 * Formula:
 *   Bank Statement Balance
 *     + Deposits in Transit
 *     - Outstanding Cheques
 *     ± Adjustments (bank charges, interest, etc.)
 *     = Adjusted Bank Balance
 *
 *   Adjusted Bank Balance == System Book Balance → Reconciled
 */
import { Request, Response } from 'express';
import * as Repo from '../repositories/ReconciliationRepository';

interface OrgUser {
  organizationId?: string;
  userId?: string;
  username?: string;
}

function getOrgId(req: Request): string {
  const user = (req as any).user as OrgUser | undefined;
  if (!user?.organizationId) throw Object.assign(new Error('Organization not found'), { status: 401 });
  return user.organizationId;
}

function getUsername(req: Request): string {
  return (req as any).user?.username || 'system';
}

export const ReconciliationController = {
  // ── Sessions ──────────────────────────────────────────────

  async createSession(req: Request, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const { branchId, reconciliationType, bankAccountId, glAccountId, reconcileDateBs, reconcileDateAd, statementPeriodFrom, statementPeriodTo } = req.body;
      if (!branchId || !reconciliationType || !glAccountId || !reconcileDateBs || !reconcileDateAd) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const session = await Repo.createReconciliationSession({
        organizationId, branchId, reconciliationType, bankAccountId,
        glAccountId, reconcileDateBs, reconcileDateAd,
        statementPeriodFrom, statementPeriodTo,
      });
      // Set preparedBy
      await Repo.updateReconciliationSession(session.id, { preparedBy: getUsername(req) });
      res.status(201).json({ ...session, preparedBy: getUsername(req) });
    } catch (err: any) {
      console.error('ReconciliationController.createSession:', err);
      res.status(err.status || 500).json({ error: err.message || 'Internal error' });
    }
  },

  async getSessions(req: Request, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const { branchId, type, status } = req.query;
      const sessions = await Repo.getReconciliationSessions(
        organizationId, branchId as string | undefined,
        type as 'bank' | 'vault' | undefined, status as string | undefined,
      );
      res.json(sessions);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  async getSessionById(req: Request, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const result = await Repo.getReconciliationById(req.params.id, organizationId);
      if (!result) return res.status(404).json({ error: 'Session not found' });
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  async updateSession(req: Request, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const existing = await Repo.getReconciliationById(req.params.id, organizationId);
      if (!existing) return res.status(404).json({ error: 'Session not found' });

      const { statementBalance, statementOpeningBalance, status, remarks, statementPeriodFrom, statementPeriodTo } = req.body;

      // Recalculate adjusted balance
      const session = existing.session;
      const stmtBal = statementBalance !== undefined ? Number(statementBalance) : Number(session.statementBalance);
      const bookBal = Number(session.bookBalance);
      const outstanding = Number(session.outstandingChequesTotal);
      const deposits = Number(session.depositsInTransitTotal);
      const adjTotal = Number(session.adjustmentsTotal);

      // Adjusted = Statement + Deposits in Transit - Outstanding Cheques ± Adjustments
      const adjustedBal = stmtBal + deposits - outstanding + adjTotal;
      const variance = adjustedBal - bookBal;

      const newStatus = status || (Math.abs(variance) < 1 ? 'reconciled' : variance === 0 && stmtBal > 0 ? 'reconciled' : session.status);

      const updated = await Repo.updateReconciliationSession(req.params.id, {
        statementBalance: stmtBal.toString(),
        statementOpeningBalance: statementOpeningBalance !== undefined ? statementOpeningBalance.toString() : session.statementOpeningBalance,
        adjustedBalance: adjustedBal.toString(),
        variance: variance.toString(),
        status: newStatus === 'reconciled' && Math.abs(variance) < 1 ? 'reconciled' : newStatus,
        remarks,
        statementPeriodFrom: statementPeriodFrom || session.statementPeriodFrom,
        statementPeriodTo: statementPeriodTo || session.statementPeriodTo,
        reconciledBy: newStatus === 'reconciled' ? getUsername(req) : session.reconciledBy,
        reconciledAt: newStatus === 'reconciled' ? new Date() : session.reconciledAt,
        reconciledDateBs: newStatus === 'reconciled' ? session.reconcileDateBs : session.reconciledDateBs,
      });

      res.json(updated);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  // ── Outstanding Cheques ──────────────────────────────────

  async getOutstandingCheques(req: Request, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const { glAccountId } = req.query;
      if (!glAccountId) return res.status(400).json({ error: 'glAccountId required' });
      const cheques = await Repo.getOutstandingCheques(organizationId, glAccountId as string);
      res.json(cheques);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  async addOutstandingItems(req: Request, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const { id } = req.params;
      const { items } = req.body;
      if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'items array required' });

      const enriched = items.map((i: any) => ({ ...i, reconciliationId: id, organizationId }));
      const result = await Repo.addOutstandingItems(enriched);

      // Recalculate totals
      await recalcSessionTotals(id, organizationId);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  async updateOutstandingItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, clearedDateBs } = req.body;
      const item = await Repo.updateOutstandingItemStatus(id, status, clearedDateBs);
      if (!item) return res.status(404).json({ error: 'Item not found' });
      // Recalc session totals
      await recalcSessionTotals(item.reconciliationId, item.organizationId);
      res.json(item);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  // ── Statement Entries ────────────────────────────────────

  async addStatementEntries(req: Request, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const { id } = req.params;
      const { entries } = req.body;
      if (!entries || !Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' });

      const enriched = entries.map((e: any) => ({ ...e, reconciliationId: id, organizationId }));
      const result = await Repo.addStatementEntries(enriched);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  // ── Adjustments ──────────────────────────────────────────

  async addAdjustment(req: Request, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const { id } = req.params;
      const { adjustmentType, description, amount, dateBs } = req.body;
      if (!adjustmentType || !description || amount === undefined || !dateBs) {
        return res.status(400).json({ error: 'adjustmentType, description, amount, dateBs required' });
      }

      const adj = await Repo.addAdjustment({
        reconciliationId: id, organizationId,
        adjustmentType, description, amount: Number(amount), dateBs,
      });

      // Recalc totals
      await recalcSessionTotals(id, organizationId);
      res.status(201).json(adj);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  async deleteAdjustment(req: Request, res: Response) {
    try {
      await Repo.deleteAdjustment(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  // ── Auto-Match ───────────────────────────────────────────

  async autoMatch(req: Request, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const { id } = req.params;
      const matchCount = await Repo.autoMatchEntries(id, organizationId);
      const summary = await Repo.getReconciliationSummary(id);
      res.json({ matchCount, summary });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  // ── Summary ──────────────────────────────────────────────

  async getSummary(req: Request, res: Response) {
    try {
      const summary = await Repo.getReconciliationSummary(req.params.id);
      res.json(summary);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  // ── Bank Accounts ────────────────────────────────────────

  async getBankAccounts(req: Request, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const accounts = await Repo.getBankAccountsForReconciliation(organizationId);
      res.json(accounts);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  // ── Book Entries ─────────────────────────────────────────

  async getBookEntries(req: Request, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const { glAccountId, dateFrom, dateTo } = req.query;
      if (!glAccountId) return res.status(400).json({ error: 'glAccountId required' });
      const entries = await Repo.getBookEntries(
        glAccountId as string, organizationId,
        dateFrom as string | undefined, dateTo as string | undefined,
      );
      res.json(entries);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  async getDepositsInTransit(req: Request, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const { glAccountId, dateFrom, dateTo } = req.query;
      if (!glAccountId) return res.status(400).json({ error: 'glAccountId required' });
      const entries = await Repo.getDepositsInTransit(
        organizationId, glAccountId as string,
        dateFrom as string | undefined, dateTo as string | undefined,
      );
      res.json(entries);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  // ── Reconcile (final) ────────────────────────────────────

  async finalizeReconciliation(req: Request, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const existing = await Repo.getReconciliationById(req.params.id, organizationId);
      if (!existing) return res.status(404).json({ error: 'Session not found' });

      const session = existing.session;
      const variance = Number(session.variance);

      if (Math.abs(variance) >= 1) {
        return res.status(400).json({
          error: `Cannot reconcile: difference of ${variance}. Outstanding items or adjustments may be missing.`,
          variance,
        });
      }

      const updated = await Repo.updateReconciliationSession(req.params.id, {
        status: 'reconciled',
        reconciledBy: getUsername(req),
        reconciledAt: new Date(),
        reconciledDateBs: session.reconcileDateBs,
        approvedBy: getUsername(req),
      });

      res.json({ success: true, session: updated });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  // ── Variance Logs ────────────────────────────────────────

  async getVarianceLogs(req: Request, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const { branchId, status, varianceType } = req.query;
      const { getDb } = require('../db/client');
      const { cashVarianceLog } = require('../../db/schema/reconciliation');
      const { eq, and } = require('drizzle-orm');
      const db = getDb();
      if (!db) return res.json([]);
      const conditions = [eq(cashVarianceLog.organizationId, organizationId)];
      if (branchId) conditions.push(eq(cashVarianceLog.branchId, branchId));
      if (status) conditions.push(eq(cashVarianceLog.status, status));
      if (varianceType) conditions.push(eq(cashVarianceLog.varianceType, varianceType));
      const rows = await db.select().from(cashVarianceLog).where(and(...conditions)).orderBy(require('drizzle-orm').desc(cashVarianceLog.createdAt));
      res.json(rows);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  async createVarianceLog(req: Request, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const { branchId, varianceType, amount, description, glAccountId, reconciliationId } = req.body;
      if (!branchId || !varianceType || amount === undefined) {
        return res.status(400).json({ error: 'branchId, varianceType, amount required' });
      }
      const { getDb } = require('../db/client');
      const { cashVarianceLog } = require('../../db/schema/reconciliation');
      const db = getDb();
      const [row] = await db.insert(cashVarianceLog).values({
        organizationId, branchId, reconciliationId, varianceType,
        amount: amount.toString(), description, glAccountId,
        reportedBy: getUsername(req),
      }).returning();
      res.status(201).json(row);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  async resolveVarianceLog(req: Request, res: Response) {
    try {
      const { resolutionNote, status } = req.body;
      if (!resolutionNote) return res.status(400).json({ error: 'resolutionNote required' });
      const { getDb } = require('../db/client');
      const { cashVarianceLog } = require('../../db/schema/reconciliation');
      const { eq } = require('drizzle-orm');
      const db = getDb();
      const [row] = await db.update(cashVarianceLog)
        .set({ status: status || 'resolved', resolutionNote, resolvedBy: getUsername(req), resolvedAt: new Date() })
        .where(eq(cashVarianceLog.id, req.params.id))
        .returning();
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  async getVarianceSummary(req: Request, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const { branchId } = req.query;
      const { getDb } = require('../db/client');
      const { cashVarianceLog } = require('../../db/schema/reconciliation');
      const { eq, and, sql } = require('drizzle-orm');
      const db = getDb();
      if (!db) return res.json({ totalOpen: 0, totalResolved: 0, totalAmount: 0, byType: {} });
      const conditions = [eq(cashVarianceLog.organizationId, organizationId)];
      if (branchId) conditions.push(eq(cashVarianceLog.branchId, branchId));
      const rows = await db.select({
        varianceType: cashVarianceLog.varianceType,
        status: cashVarianceLog.status,
        amount: sql`COALESCE(SUM(${cashVarianceLog.amount}), 0)`,
        count: sql`COUNT(*)::int`,
      }).from(cashVarianceLog).where(and(...conditions)).groupBy(cashVarianceLog.varianceType, cashVarianceLog.status);
      const summary = { totalOpen: 0, totalResolved: 0, totalAmount: 0, byType: {} as Record<string, { count: number; amount: number }> };
      for (const row of rows) {
        const amt = Number(row.amount);
        if (row.status === 'open' || row.status === 'investigating') { summary.totalOpen += row.count; summary.totalAmount += amt; }
        else if (row.status === 'resolved') { summary.totalResolved += row.count; }
        if (!summary.byType[row.varianceType]) summary.byType[row.varianceType] = { count: 0, amount: 0 };
        summary.byType[row.varianceType].count += row.count;
        summary.byType[row.varianceType].amount += amt;
      }
      res.json(summary);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },
};

// ── Helper: Recalculate session totals ────────────────────
async function recalcSessionTotals(reconciliationId: string, organizationId: string) {
  const existing = await Repo.getReconciliationById(reconciliationId, organizationId);
  if (!existing) return;

  const { session, outstandingItems, adjustments } = existing;

  const outstandingCheques = outstandingItems
    .filter(i => i.itemType === 'outstanding_cheque' && i.status === 'pending')
    .reduce((s, i) => s + Number(i.amount), 0);

  const depositsInTransit = outstandingItems
    .filter(i => i.itemType === 'deposit_in_transit' && i.status === 'pending')
    .reduce((s, i) => s + Number(i.amount), 0);

  const adjustmentsTotal = adjustments.reduce((s, a) => {
    const amt = Number(a.amount);
    // Bank charges and direct debits reduce the balance
    if (['bank_charge', 'interest_charged', 'direct_debit', 'error_correction'].includes(a.adjustmentType)) {
      return s - amt;
    }
    // Interest earned and direct credits increase the balance
    return s + amt;
  }, 0);

  const stmtBal = Number(session.statementBalance);
  const bookBal = Number(session.bookBalance);
  const adjustedBal = stmtBal + depositsInTransit - outstandingCheques + adjustmentsTotal;
  const variance = adjustedBal - bookBal;

  await Repo.updateReconciliationSession(reconciliationId, {
    outstandingChequesTotal: outstandingCheques.toString(),
    depositsInTransitTotal: depositsInTransit.toString(),
    adjustmentsTotal: adjustmentsTotal.toString(),
    adjustedBalance: adjustedBal.toString(),
    variance: variance.toString(),
    status: Math.abs(variance) < 1 && stmtBal > 0 ? 'reconciled' : session.status,
  });
}
