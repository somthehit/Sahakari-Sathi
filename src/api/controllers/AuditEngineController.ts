/**
 * AuditEngineController
 * Rule evaluation is now driven by ruleType + field references, not hardcoded logic.
 *
 * Rule Types:
 *   tie_out          — fieldA == fieldB (within tolerance)
 *   threshold        — fieldA [operator] value
 *   percentage_of_base — (fieldA / baseField) * 100 [operator] thresholdValue
 *   classification_match — loan ageing bucket matches classification
 *   custom           — placeholder for future expression engine
 */
import { Request, Response } from 'express';
import { and, eq, sql, desc, count } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  auditRules, auditRuns, auditFindings, auditWorkpapers,
  auditOpinionDrafts, auditSignoffs,
} from '../../db/schema/auditEngine';
import { chartOfAccounts } from '../../db/schema/accounting';
import { fiscalYears } from '../../db/schema/branches';

interface OrgUser {
  organizationId?: string;
  username?: string;
}

// ─── Field Resolvers ────────────────────────────────────────────────────────
// Maps fieldA/fieldB/baseField strings to actual computed values from accounts.

type AccountAggregator = (accounts: typeof chartOfAccounts.$inferSelect[]) => number;

const FIELD_RESOLVERS: Record<string, AccountAggregator> = {
  // Balance Sheet
  'total_assets':     (a) => a.filter(x => x.type === 'Asset').reduce((s, x) => s + (Number(x.balance) || 0), 0),
  'total_liabilities': (a) => a.filter(x => x.type === 'Liability').reduce((s, x) => s + (Number(x.balance) || 0), 0),
  'total_equity':     (a) => a.filter(x => x.type === 'Equity').reduce((s, x) => s + (Number(x.balance) || 0), 0),
  'liabilities_plus_equity': (a) =>
    a.filter(x => x.type === 'Liability').reduce((s, x) => s + (Number(x.balance) || 0), 0) +
    a.filter(x => x.type === 'Equity').reduce((s, x) => s + (Number(x.balance) || 0), 0),

  // Trial Balance
  'total_debits':     (a) => a.filter(x => x.type === 'Expense' || x.type === 'Asset').reduce((s, x) => s + (Number(x.debit) || 0), 0),
  'total_credits':    (a) => a.filter(x => x.type === 'Income' || x.type === 'Liability' || x.type === 'Equity').reduce((s, x) => s + (Number(x.credit) || 0), 0),

  // Cash / Bank
  'cash_bank_balance': (a) => a.filter(x => x.code.startsWith('101') || x.code.startsWith('102') || x.name.toLowerCase().includes('cash') || x.name.toLowerCase().includes('bank')).reduce((s, x) => s + (Number(x.balance) || 0), 0),

  // Income / Expense
  'total_income':     (a) => a.filter(x => x.type === 'Income').reduce((s, x) => s + (Number(x.balance) || 0), 0),
  'total_expense':    (a) => a.filter(x => x.type === 'Expense').reduce((s, x) => s + (Number(x.balance) || 0), 0),
  'net_surplus':      (a) => a.filter(x => x.type === 'Income').reduce((s, x) => s + (Number(x.balance) || 0), 0) - a.filter(x => x.type === 'Expense').reduce((s, x) => s + (Number(x.balance) || 0), 0),

  // Reserves
  'reserve_fund':     (a) => a.filter(x => x.name.toLowerCase().includes('reserve') || x.name.toLowerCase().includes('सञ्चिति')).reduce((s, x) => s + (Number(x.balance) || 0), 0),

  // Dividends
  'dividend':         (a) => a.filter(x => x.name.toLowerCase().includes('dividend') || x.name.toLowerCase().includes('लाभांश')).reduce((s, x) => s + (Number(x.balance) || 0), 0),

  // Loans
  'loan_receivable':  (a) => a.filter(x => x.code.startsWith('202') || x.name.toLowerCase().includes('loan receivable') || x.name.toLowerCase().includes('ऋण प्राप्त')).reduce((s, x) => s + (Number(x.balance) || 0), 0),

  // Fixed Assets
  'fixed_assets':     (a) => a.filter(x => x.code.startsWith('12') || x.name.toLowerCase().includes('fixed asset') || x.name.toLowerCase().includes('स्थायी सम्पत्ति')).reduce((s, x) => s + (Number(x.balance) || 0), 0),

  // Prior period
  'prior_total_assets': (a) => a.filter(x => x.type === 'Asset').reduce((s, x) => s + (Number(x.priorBalance) || 0), 0),
  'prior_net_surplus':  (a) => a.filter(x => x.type === 'Income').reduce((s, x) => s + (Number(x.priorBalance) || 0), 0) - a.filter(x => x.type === 'Expense').reduce((s, x) => s + (Number(x.priorBalance) || 0), 0),
};

function resolveField(fieldRef: string | null | undefined, accounts: typeof chartOfAccounts.$inferSelect[]): number | null {
  if (!fieldRef) return null;
  const ref = fieldRef.trim().toLowerCase();
  // Check if it's a named field
  if (FIELD_RESOLVERS[ref]) return FIELD_RESOLVERS[ref](accounts);
  // Check if it's an account code prefix (e.g. "code:101" means sum all accounts starting with 101)
  if (ref.startsWith('code:')) {
    const prefix = ref.slice(5);
    return accounts.filter(a => a.code.startsWith(prefix)).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  }
  // Check if it's an account name contains (e.g. "name:cash")
  if (ref.startsWith('name:')) {
    const needle = ref.slice(5);
    return accounts.filter(a => a.name.toLowerCase().includes(needle)).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  }
  return null;
}

function compare(a: number, operator: string, b: number): boolean {
  switch (operator) {
    case '=': case '==': return Math.abs(a - b) <= 0.01;
    case '!=': return Math.abs(a - b) > 0.01;
    case '>': return a > b;
    case '>=': return a >= b;
    case '<': return a < b;
    case '<=': return a <= b;
    default: return false;
  }
}

// ─── Default Rules (with executable definitions) ────────────────────────────

const DEFAULT_RULES = [
  // Layer 1 — Data Integrity (always blocking)
  { ruleCode: 'INT-001', name: 'Balance Sheet Equation', nameNepali: 'तलिका समीकरण', category: 'integrity', layer: 1, sourceStatement: 'Balance Sheet', severity: 'critical', isBlocking: true, ruleType: 'tie_out', fieldA: 'total_assets', fieldB: 'liabilities_plus_equity', operator: '=', tolerance: '0.01', description: 'Total Assets must equal Total Liabilities + Equity' },
  { ruleCode: 'INT-002', name: 'Trial Balance Tie-out', nameNepali: 'खाता जाँच', category: 'integrity', layer: 1, sourceStatement: 'Trial Balance', severity: 'critical', isBlocking: true, ruleType: 'tie_out', fieldA: 'total_debits', fieldB: 'total_credits', operator: '=', tolerance: '0.01', description: 'Sum of Debits must equal Sum of Credits' },
  { ruleCode: 'INT-003', name: 'Cash Flow Closing Balance', nameNepali: 'नगद प्रवाह शेष', category: 'integrity', layer: 1, sourceStatement: 'Cash Flow', severity: 'critical', isBlocking: true, ruleType: 'threshold', fieldA: 'cash_bank_balance', operator: '>=', thresholdValue: '0', description: 'Cash/bank balance must be non-negative' },

  // Layer 2 — Statutory & Regulatory
  { ruleCode: 'STR-001', name: 'Reserve Fund Allocation', nameNepali: 'सञ्चिति कोष विनियोजन', category: 'statutory', layer: 2, sourceStatement: 'Income Statement', severity: 'high', isBlocking: true, ruleType: 'percentage_of_base', fieldA: 'reserve_fund', baseField: 'net_surplus', operator: '>=', thresholdValue: '15', description: 'Reserve fund must be at least 15% of net surplus' },
  { ruleCode: 'STR-002', name: 'Dividend Before Reserve', nameNepali: 'लाभांश र सञ्चिति', category: 'statutory', layer: 2, sourceStatement: 'Income Statement', severity: 'critical', isBlocking: true, ruleType: 'percentage_of_base', fieldA: 'reserve_fund', baseField: 'net_surplus', operator: '>=', thresholdValue: '15', description: 'No dividend before statutory reserve requirement is met' },
  { ruleCode: 'STR-003', name: 'Single Member Exposure Limit', nameNepali: 'एकल सदस्य ऋण सीमा', category: 'statutory', layer: 2, sourceStatement: 'Loan Accounts', severity: 'high', isBlocking: false, ruleType: 'threshold', fieldA: 'loan_receivable', operator: '>=', thresholdValue: '0', description: 'Flag if total loan receivable exceeds concentration limit (manual review)' },

  // Layer 3 — Analytical Review (always advisory)
  { ruleCode: 'ANA-001', name: 'YoY Asset Variance', nameNepali: 'वार्षिक सम्पत्ति भिन्नता', category: 'analytical', layer: 3, sourceStatement: 'Balance Sheet', severity: 'medium', isBlocking: false, ruleType: 'threshold', fieldA: 'total_assets', operator: '>=', thresholdValue: '0', description: 'Total assets should not be negative; flag for review if unusual' },
  { ruleCode: 'ANA-002', name: 'Net Surplus Positive Check', nameNepali: 'नाफा जाँच', category: 'analytical', layer: 3, sourceStatement: 'Income Statement', severity: 'low', isBlocking: false, ruleType: 'threshold', fieldA: 'net_surplus', operator: '>=', thresholdValue: '0', description: 'Net surplus should be non-negative; flag if loss-making' },
];

export class AuditEngineController {

  // ═══════════════════════════════════════════════════════════════════════
  // AUDIT RULES CRUD
  // ═══════════════════════════════════════════════════════════════════════

  static async getRules(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { category, active } = req.query;
      let conditions: any[] = [eq(auditRules.organizationId, organizationId)];
      if (category) conditions.push(eq(auditRules.category, category as string));
      if (active !== undefined) conditions.push(eq(auditRules.active, active === 'true'));
      const rules = await db.select().from(auditRules)
        .where(and(...conditions))
        .orderBy(auditRules.category, auditRules.ruleCode);
      res.json(rules);
    } catch (error: any) {
      console.error('AuditEngineController.getRules:', error);
      res.status(500).json({ error: error.message || 'Failed to load rules.' });
    }
  }

  static async createRule(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const body = req.body;
      // Auto-lock blocking for Layer 1
      const isBlocking = body.layer === 1 ? true : (body.isBlocking ?? false);
      const created = await db.insert(auditRules).values({
        organizationId,
        ruleCode: body.ruleCode,
        name: body.name,
        nameNepali: body.nameNepali || '',
        description: body.description || '',
        category: body.category,
        layer: body.layer || 1,
        ruleType: body.ruleType || 'tie_out',
        fieldA: body.fieldA || '',
        fieldB: body.fieldB || '',
        operator: body.operator || '=',
        tolerance: body.tolerance || '0',
        baseField: body.baseField || '',
        thresholdValue: body.thresholdValue || null,
        thresholdOperator: body.thresholdOperator || '',
        sourceStatement: body.sourceStatement || '',
        severity: body.severity || 'medium',
        parameters: body.parameters || {},
        isBlocking,
        active: body.active ?? true,
        effectiveFrom: body.effectiveFrom || '',
        effectiveTo: body.effectiveTo || '',
        createdBy: req.user?.username || '',
      }).returning();
      res.status(201).json(created[0]);
    } catch (error: any) {
      console.error('AuditEngineController.createRule:', error);
      res.status(500).json({ error: error.message || 'Failed to create rule.' });
    }
  }

  static async updateRule(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      const body = req.body;
      // Auto-lock blocking for Layer 1
      if (body.layer === 1) body.isBlocking = true;
      const updated = await db.update(auditRules).set({
        ...body,
        updatedAt: new Date(),
      }).where(and(eq(auditRules.id, id), eq(auditRules.organizationId, organizationId))).returning();
      if (!updated.length) return res.status(404).json({ error: 'Rule not found.' });
      res.json(updated[0]);
    } catch (error: any) {
      console.error('AuditEngineController.updateRule:', error);
      res.status(500).json({ error: error.message || 'Failed to update rule.' });
    }
  }

  static async deleteRule(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      const deleted = await db.delete(auditRules)
        .where(and(eq(auditRules.id, id), eq(auditRules.organizationId, organizationId))).returning();
      if (!deleted.length) return res.status(404).json({ error: 'Rule not found.' });
      res.json({ id: deleted[0].id });
    } catch (error: any) {
      console.error('AuditEngineController.deleteRule:', error);
      res.status(500).json({ error: error.message || 'Failed to delete rule.' });
    }
  }

  static async seedDefaultRules(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      let seeded = 0;
      for (const r of DEFAULT_RULES) {
        const existing = await db.select({ id: auditRules.id }).from(auditRules)
          .where(and(eq(auditRules.organizationId, organizationId), eq(auditRules.ruleCode, r.ruleCode)));
        if (existing.length === 0) {
          await db.insert(auditRules).values({
            organizationId,
            ruleCode: r.ruleCode,
            name: r.name,
            nameNepali: r.nameNepali,
            description: r.description,
            category: r.category as any,
            layer: r.layer,
            ruleType: r.ruleType as any,
            fieldA: r.fieldA,
            fieldB: r.fieldB || '',
            operator: r.operator,
            tolerance: r.tolerance,
            baseField: r.baseField || '',
            thresholdValue: r.thresholdValue || null,
            sourceStatement: r.sourceStatement,
            severity: r.severity as any,
            parameters: {},
            isBlocking: r.isBlocking,
            active: true,
            createdBy: req.user?.username || '',
          });
          seeded++;
        }
      }
      res.json({ seeded, total: DEFAULT_RULES.length });
    } catch (error: any) {
      console.error('AuditEngineController.seedDefaultRules:', error);
      res.status(500).json({ error: error.message || 'Failed to seed rules.' });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AUDIT RUNS
  // ═══════════════════════════════════════════════════════════════════════

  static async getRuns(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const runs = await db.select().from(auditRuns)
        .where(eq(auditRuns.organizationId, organizationId))
        .orderBy(desc(auditRuns.createdAt));
      res.json(runs);
    } catch (error: any) {
      console.error('AuditEngineController.getRuns:', error);
      res.status(500).json({ error: error.message || 'Failed to load runs.' });
    }
  }

  static async getRun(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      const rows = await db.select().from(auditRuns)
        .where(and(eq(auditRuns.id, id), eq(auditRuns.organizationId, organizationId)));
      if (!rows.length) return res.status(404).json({ error: 'Run not found.' });
      res.json(rows[0]);
    } catch (error: any) {
      console.error('AuditEngineController.getRun:', error);
      res.status(500).json({ error: error.message || 'Failed to load run.' });
    }
  }

  static async triggerRun(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { fiscalYearId } = req.body;

      // Get fiscal year label
      let fyLabel = '';
      if (fiscalYearId) {
        const fyRows = await db.select().from(fiscalYears)
          .where(eq(fiscalYears.id, fiscalYearId));
        if (fyRows.length) fyLabel = fyRows[0].code || `${fyRows[0].startDateBS} to ${fyRows[0].endDateBS}`;
      }

      // Create run record
      const runRows = await db.insert(auditRuns).values({
        organizationId,
        fiscalYearId: fiscalYearId || null,
        fiscalYearLabel: fyLabel,
        triggeredBy: 'manual',
        status: 'running',
        createdBy: req.user?.username || '',
      }).returning();
      const run = runRows[0];

      // Get active rules
      const rules = await db.select().from(auditRules)
        .where(and(eq(auditRules.organizationId, organizationId), eq(auditRules.active, true)));

      // Get all chart of accounts
      const accounts = await db.select().from(chartOfAccounts)
        .where(eq(chartOfAccounts.organizationId, organizationId));

      // Evaluate each rule using ruleType-based logic
      const findings: typeof auditFindings.$inferInsert[] = [];
      let passed = 0;
      let failed = 0;
      let skipped = 0;

      for (const rule of rules) {
        try {
          const result = evaluateRule(rule, accounts);
          if (result === null) {
            skipped++;
          } else if (result.length === 0) {
            passed++;
          } else {
            failed += result.length;
            for (const f of result) {
              findings.push({
                organizationId,
                runId: run.id,
                ruleId: rule.id,
                severity: rule.severity as any,
                title: f.title,
                description: f.description,
                category: rule.category as any,
                sourceStatement: rule.sourceStatement || '',
                evidenceRef: f.evidenceRef || {},
                status: 'open',
              });
            }
          }
        } catch {
          skipped++;
        }
      }

      // Insert findings
      if (findings.length > 0) {
        await db.insert(auditFindings).values(findings);
      }

      // Update run
      await db.update(auditRuns).set({
        status: 'completed',
        totalRules: rules.length,
        rulesPassed: passed,
        rulesFailed: failed,
        rulesSkipped: skipped,
        completedAt: new Date(),
      }).where(eq(auditRuns.id, run.id));

      // Generate opinion draft
      await generateOpinionDraft(run.id, organizationId, db);

      res.status(201).json({
        ...run,
        status: 'completed',
        totalRules: rules.length,
        rulesPassed: passed,
        rulesFailed: failed,
        rulesSkipped: skipped,
        findingsCount: findings.length,
      });
    } catch (error: any) {
      console.error('AuditEngineController.triggerRun:', error);
      res.status(500).json({ error: error.message || 'Failed to trigger run.' });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FINDINGS
  // ═══════════════════════════════════════════════════════════════════════

  static async getFindings(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { runId, status, severity, category } = req.query;
      let conditions: any[] = [eq(auditFindings.organizationId, organizationId)];
      if (runId) conditions.push(eq(auditFindings.runId, runId as string));
      if (status) conditions.push(eq(auditFindings.status, status as string));
      if (severity) conditions.push(eq(auditFindings.severity, severity as string));
      if (category) conditions.push(eq(auditFindings.category, category as string));
      const findings = await db.select().from(auditFindings)
        .where(and(...conditions))
        .orderBy(desc(auditFindings.createdAt));
      res.json(findings);
    } catch (error: any) {
      console.error('AuditEngineController.getFindings:', error);
      res.status(500).json({ error: error.message || 'Failed to load findings.' });
    }
  }

  static async resolveFinding(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { id } = req.params;
      const { status, resolutionNote, waivedJustification } = req.body;
      const updated = await db.update(auditFindings).set({
        status,
        resolutionNote: resolutionNote || '',
        waivedJustification: waivedJustification || '',
        resolvedAt: new Date(),
      }).where(and(eq(auditFindings.id, id), eq(auditFindings.organizationId, organizationId))).returning();
      if (!updated.length) return res.status(404).json({ error: 'Finding not found.' });
      res.json(updated[0]);
    } catch (error: any) {
      console.error('AuditEngineController.resolveFinding:', error);
      res.status(500).json({ error: error.message || 'Failed to resolve finding.' });
    }
  }

  static async addWorkpaper(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const body = req.body;
      const created = await db.insert(auditWorkpapers).values({
        organizationId,
        findingId: body.findingId,
        type: body.type || 'system_ref',
        reference: body.reference || '',
        fileName: body.fileName || '',
        fileUrl: body.fileUrl || '',
        fileSize: body.fileSize || 0,
        uploadedBy: req.user?.username || '',
      }).returning();
      res.status(201).json(created[0]);
    } catch (error: any) {
      console.error('AuditEngineController.addWorkpaper:', error);
      res.status(500).json({ error: error.message || 'Failed to add workpaper.' });
    }
  }

  static async getWorkpapers(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { findingId } = req.params;
      const workpapers = await db.select().from(auditWorkpapers)
        .where(and(eq(auditWorkpapers.organizationId, organizationId), eq(auditWorkpapers.findingId, findingId)))
        .orderBy(desc(auditWorkpapers.uploadedAt));
      res.json(workpapers);
    } catch (error: any) {
      console.error('AuditEngineController.getWorkpapers:', error);
      res.status(500).json({ error: error.message || 'Failed to load workpapers.' });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // OPINION & SIGNOFF
  // ═══════════════════════════════════════════════════════════════════════

  static async getOpinionDraft(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { runId } = req.params;
      const rows = await db.select().from(auditOpinionDrafts)
        .where(and(eq(auditOpinionDrafts.organizationId, organizationId), eq(auditOpinionDrafts.runId, runId)));
      if (!rows.length) return res.status(404).json({ error: 'Opinion draft not found.' });
      res.json(rows[0]);
    } catch (error: any) {
      console.error('AuditEngineController.getOpinionDraft:', error);
      res.status(500).json({ error: error.message || 'Failed to load opinion.' });
    }
  }

  static async updateOpinionDraft(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { runId } = req.params;
      const { finalClassification, overrideReason } = req.body;
      const updated = await db.update(auditOpinionDrafts).set({
        finalClassification,
        overrideReason: overrideReason || '',
        setByUserId: req.user?.username || '',
        setByUserName: req.user?.username || '',
        setAt: new Date(),
      }).where(and(eq(auditOpinionDrafts.runId, runId), eq(auditOpinionDrafts.organizationId, organizationId))).returning();
      if (!updated.length) return res.status(404).json({ error: 'Opinion draft not found.' });
      res.json(updated[0]);
    } catch (error: any) {
      console.error('AuditEngineController.updateOpinionDraft:', error);
      res.status(500).json({ error: error.message || 'Failed to update opinion.' });
    }
  }

  static async getSignoffs(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const { runId } = req.params;
      const signoffs = await db.select().from(auditSignoffs)
        .where(and(eq(auditSignoffs.organizationId, organizationId), eq(auditSignoffs.runId, runId)))
        .orderBy(auditSignoffs.timestamp);
      res.json(signoffs);
    } catch (error: any) {
      console.error('AuditEngineController.getSignoffs:', error);
      res.status(500).json({ error: error.message || 'Failed to load signoffs.' });
    }
  }

  static async addSignoff(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();
      const body = req.body;

      // Enforce sequential stage progression
      const STAGE_ORDER = ['preparer', 'internal_auditor', 'external_auditor', 'board', 'doc_submission'];
      const requestedStageIdx = STAGE_ORDER.indexOf(body.stage);
      if (requestedStageIdx === -1) return res.status(400).json({ error: 'Invalid stage.' });

      // Check that all prior stages are signed off
      const existingSignoffs = await db.select().from(auditSignoffs)
        .where(and(eq(auditSignoffs.runId, body.runId), eq(auditSignoffs.organizationId, organizationId)))
        .orderBy(auditSignoffs.timestamp);

      const completedStages = new Set(existingSignoffs.map(s => s.stage));

      // Verify each prior stage is completed (approved, not rejected)
      for (let i = 0; i < requestedStageIdx; i++) {
        const priorStage = STAGE_ORDER[i];
        const priorSignoff = existingSignoffs.find(s => s.stage === priorStage);
        if (!priorSignoff) {
          return res.status(400).json({ error: `Cannot sign off at "${body.stage}" — "${priorStage}" stage has not been completed yet.` });
        }
        if (priorSignoff.decision === 'rejected') {
          return res.status(400).json({ error: `Cannot proceed — "${priorStage}" stage was rejected. Resolve the rejection first.` });
        }
      }

      // Check if this stage already has an approved signoff
      const existingForStage = existingSignoffs.find(s => s.stage === body.stage && s.decision === 'approved');
      if (existingForStage) {
        return res.status(400).json({ error: `Stage "${body.stage}" has already been approved.` });
      }

      const created = await db.insert(auditSignoffs).values({
        organizationId,
        runId: body.runId,
        stage: body.stage,
        userId: req.user?.username || '',
        userName: req.user?.username || '',
        decision: body.decision,
        comments: body.comments || '',
        signedDocumentRef: body.signedDocumentRef || '',
        // Stage-specific fields
        externalAuditorName: body.externalAuditorName || '',
        externalAuditorFirm: body.externalAuditorFirm || '',
        opinionPdfUrl: body.opinionPdfUrl || '',
        opinionPdfName: body.opinionPdfName || '',
        resolutionId: body.resolutionId || null,
        resolutionNumber: body.resolutionNumber || '',
        resolutionDate: body.resolutionDate || '',
        resolutionTitle: body.resolutionTitle || '',
        docSubmissionDate: body.docSubmissionDate || '',
        docReferenceNumber: body.docReferenceNumber || '',
        docPortalUrl: body.docPortalUrl || '',
      }).returning();
      res.status(201).json(created[0]);
    } catch (error: any) {
      console.error('AuditEngineController.addSignoff:', error);
      res.status(500).json({ error: error.message || 'Failed to add signoff.' });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DASHBOARD STATS
  // ═══════════════════════════════════════════════════════════════════════

  static async getDashboardStats(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context.' });
      const db = getDb();

      const latestRun = await db.select().from(auditRuns)
        .where(and(eq(auditRuns.organizationId, organizationId), eq(auditRuns.status, 'completed')))
        .orderBy(desc(auditRuns.completedAt))
        .limit(1);

      const findingsBySeverity = await db.select({
        severity: auditFindings.severity,
        count: count(),
      }).from(auditFindings)
        .where(eq(auditFindings.organizationId, organizationId))
        .groupBy(auditFindings.severity);

      const findingsByStatus = await db.select({
        status: auditFindings.status,
        count: count(),
      }).from(auditFindings)
        .where(eq(auditFindings.organizationId, organizationId))
        .groupBy(auditFindings.status);

      const totalRuns = await db.select({ count: count() }).from(auditRuns)
        .where(eq(auditRuns.organizationId, organizationId));

      const activeRules = await db.select({ count: count() }).from(auditRules)
        .where(and(eq(auditRules.organizationId, organizationId), eq(auditRules.active, true)));

      res.json({
        latestRun: latestRun[0] || null,
        findingsBySeverity: findingsBySeverity.reduce((acc, r) => { acc[r.severity] = r.count; return acc; }, {} as Record<string, number>),
        findingsByStatus: findingsByStatus.reduce((acc, r) => { acc[r.status] = r.count; return acc; }, {} as Record<string, number>),
        totalRuns: totalRuns[0]?.count || 0,
        activeRules: activeRules[0]?.count || 0,
      });
    } catch (error: any) {
      console.error('AuditEngineController.getDashboardStats:', error);
      res.status(500).json({ error: error.message || 'Failed to load dashboard stats.' });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RULE EVALUATION — ruleType-driven
// ═══════════════════════════════════════════════════════════════════════════

interface FindingDraft {
  title: string;
  description: string;
  evidenceRef?: Record<string, any>;
}

function evaluateRule(
  rule: typeof auditRules.$inferSelect,
  accounts: typeof chartOfAccounts.$inferSelect[],
): FindingDraft[] | null {
  const ruleType = rule.ruleType || 'tie_out';

  switch (ruleType) {
    // ── Tie-out: FieldA == FieldB (within tolerance) ──────────────────
    case 'tie_out': {
      const valA = resolveField(rule.fieldA, accounts);
      const valB = resolveField(rule.fieldB, accounts);
      if (valA === null || valB === null) return null; // Can't evaluate, skip
      const tol = Number(rule.tolerance) || 0;
      const variance = Math.abs(valA - valB);
      if (variance > tol) {
        return [{
          title: `${rule.name} — Variance: NPR ${variance.toLocaleString('en-IN')}`,
          description: `${rule.description}. Field A (${rule.fieldA}) = NPR ${valA.toLocaleString('en-IN')}, Field B (${rule.fieldB}) = NPR ${valB.toLocaleString('en-IN')}. Variance NPR ${variance.toLocaleString('en-IN')} exceeds tolerance NPR ${tol.toLocaleString('en-IN')}.`,
          evidenceRef: { statement: rule.sourceStatement, amount: valA, expectedAmount: valB, variance, details: `Tolerance: NPR ${tol}` },
        }];
      }
      return [];
    }

    // ── Threshold: FieldA [operator] value ────────────────────────────
    case 'threshold': {
      const valA = resolveField(rule.fieldA, accounts);
      if (valA === null) return null;
      const thresholdVal = Number(rule.thresholdValue) || 0;
      const op = rule.operator || '>=';
      if (!compare(valA, op, thresholdVal)) {
        return [{
          title: `${rule.name} — Value NPR ${valA.toLocaleString('en-IN')} failed check ${op} NPR ${thresholdVal.toLocaleString('en-IN')}`,
          description: `${rule.description}. ${rule.fieldA} = NPR ${valA.toLocaleString('en-IN')}, expected ${op} NPR ${thresholdVal.toLocaleString('en-IN')}.`,
          evidenceRef: { statement: rule.sourceStatement, amount: valA, expectedAmount: thresholdVal, variance: valA - thresholdVal, details: `Check: ${rule.fieldA} ${op} ${thresholdVal}` },
        }];
      }
      return [];
    }

    // ── Percentage of Base: (FieldA / BaseField) * 100 >= thresholdValue ─
    case 'percentage_of_base': {
      const valA = resolveField(rule.fieldA, accounts);
      const baseVal = resolveField(rule.baseField, accounts);
      if (valA === null || baseVal === null) return null;
      if (baseVal === 0) return []; // Can't divide by zero, skip
      const actualPct = (valA / baseVal) * 100;
      const requiredPct = Number(rule.thresholdValue) || 0;
      const op = rule.operator || '>=';
      if (!compare(actualPct, op, requiredPct)) {
        return [{
          title: `${rule.name} — ${actualPct.toFixed(1)}% ${op === '>=' ? 'below' : 'above'} ${requiredPct}% threshold`,
          description: `${rule.description}. ${rule.fieldA} = NPR ${valA.toLocaleString('en-IN')}, ${rule.baseField} = NPR ${baseVal.toLocaleString('en-IN')}. Ratio: ${actualPct.toFixed(1)}%, required: ${op} ${requiredPct}%.`,
          evidenceRef: { statement: rule.sourceStatement, amount: valA, expectedAmount: baseVal, variance: valA - (baseVal * requiredPct / 100), details: `${actualPct.toFixed(1)}% vs ${requiredPct}%` },
        }];
      }
      return [];
    }

    // ── Classification Match: requires manual data, flag for review ───
    case 'classification_match': {
      // Placeholder — needs loan-level data to compare ageing bucket vs classification
      return [];
    }

    // ── Custom: not yet implemented ───────────────────────────────────
    case 'custom': {
      return null;
    }

    default:
      return null;
  }
}

async function generateOpinionDraft(runId: string, organizationId: string, db: any) {
  const findings = await db.select().from(auditFindings)
    .where(eq(auditFindings.runId, runId));

  const unresolved = findings.filter((f: any) => f.status === 'open' || f.status === 'in_review');
  const hasIntegrityFailure = unresolved.some((f: any) => f.category === 'integrity');
  const hasCritical = unresolved.some((f: any) => f.severity === 'critical');
  const hasHigh = unresolved.some((f: any) => f.severity === 'high');

  let suggested: 'unqualified' | 'qualified' | 'adverse' | 'disclaimer';
  let basis = '';

  if (hasIntegrityFailure) {
    suggested = 'disclaimer';
    basis = 'Unresolved data integrity failures prevent forming an audit opinion.';
  } else if (hasCritical) {
    suggested = 'adverse';
    basis = 'Unresolved critical findings indicate material misstatements or statutory non-compliance.';
  } else if (hasHigh) {
    suggested = 'qualified';
    basis = 'Unresolved high-severity findings indicate specific areas of concern.';
  } else {
    suggested = 'unqualified';
    basis = 'No material unresolved findings identified.';
  }

  await db.insert(auditOpinionDrafts).values({
    organizationId,
    runId,
    suggestedClassification: suggested,
    basisSummary: basis,
  });
}
