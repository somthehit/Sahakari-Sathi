/**
 * Chart of Accounts (COA) Bulk Import & Standard Seeding Controller
 * -----------------------------------------------------------------
 * Endpoints (registered under the accounting settings block):
 *   POST /accounting/settings/coa/bulk-import  — client-validated CSV/Excel rows
 *   POST /accounting/settings/coa/seed-default  — one-click "standard cooperative COA"
 *
 * Multi-tenancy: `organization_id` is always read from the verified JWT
 * (`req.user.organizationId`), never from the request body. Cross-org codes are
 * rejected by the unique (organization_id, code) index.
 *
 * Atomicity: the whole batch runs inside a single Drizzle `db.transaction`.
 * Rows are inserted in hierarchy-depth order (parents before children) while a
 * GL-code → account-id map backfills, so deeply nested charts resolve without
 * recursive CTEs. A database-level error (constraint violation, locked parent…)
 * rolls the entire batch back — partial success is never persisted.
 */
import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getDb, Database } from '../../db/client';
import { chartOfAccounts } from '../../db/schema';
import { DEFAULT_COA_TEMPLATE, CoaTemplateAccount } from '../../db/coaSeedTemplate';
import { COA_ACCOUNT_TYPES, COA_BULK_LIMIT, CoaBulkRecord } from '../schemas/coa';
import { buildAuditRow, writeAuditLog, SettingsActor } from '../utils/audit';

interface OrgUser {
  organizationId?: string;
  userId?: string;
  username?: string;
  role?: string;
}

function reqActor(req: Request & { user?: OrgUser }): SettingsActor {
  return {
    organizationId: req.user?.organizationId || '',
    userId: req.user?.userId,
    username: req.user?.username,
    role: req.user?.role,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

const defaultNormalBalance = (type: CoaBulkRecord['accountType']): 'debit' | 'credit' => {
  return type === 'Income' || type === 'Liability' || type === 'Equity' ? 'credit' : 'debit';
};

/** Number of GL-code segments — drives topo-sort so parents insert first. */
const depth = (code: string): number => code.split('-').length;

export interface CoaImportResult {
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  failed: string[];
}

interface NormalizedRow {
  code: string;
  name: string;
  type: CoaBulkRecord['accountType'];
  parentCode: string | null;
  allowPosting: boolean;
  isControlAccount: boolean;
  normalBalance: 'debit' | 'credit';
  balance: string;
}

function normalizeRows(records: CoaBulkRecord[]): NormalizedRow[] {
  return records
    .map((r) => ({
      code: r.glCode.trim().toUpperCase(),
      name: r.accountName.trim(),
      type: r.accountType,
      parentCode: r.parentGlCode ? r.parentGlCode.trim().toUpperCase() : null,
      allowPosting: r.isPostingAllowed,
      isControlAccount: r.isControlAccount,
      normalBalance: r.normalBalance ?? defaultNormalBalance(r.accountType),
      balance: String(Math.abs(Number(r.openingBalance) || 0)),
    }))
    .sort((a, b) => depth(a.code) - depth(b.code) || a.code.localeCompare(b.code));
}

/**
 * Run a validated batch through an atomic transaction. Existing codes are
 * skipped by default; with `overlayExisting` they are refreshed in place
 * (non-system accounts only). Each account's own validation errors are
 * collected and returned WITHOUT aborting the transaction.
 */
export const processBulkCoaImport = async (
  db: Database,
  records: CoaBulkRecord[],
  organizationId: string,
  overlayExisting = false,
): Promise<CoaImportResult> => {
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: chartOfAccounts.id, code: chartOfAccounts.code, isSystemAccount: chartOfAccounts.isSystemAccount })
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.organizationId, organizationId));

    const codeToId = new Map<string, string>();
    const isSystem = new Set<string>();
    existing.forEach((row) => {
      codeToId.set(row.code, row.id);
      if (row.isSystemAccount) isSystem.add(row.code);
    });

    const rows = normalizeRows(records);
    const seen = new Set<string>();
    const failed: string[] = [];
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      if (seen.has(row.code)) {
        failed.push(`Duplicate GL code "${row.code}" within the file`);
        continue;
      }
      seen.add(row.code);

      const parentId = row.parentCode ? codeToId.get(row.parentCode) : null;
      if (row.parentCode && !parentId) {
        failed.push(`Parent GL code "${row.parentCode}" not found for "${row.name}" (${row.code})`);
        continue;
      }

      if (codeToId.has(row.code)) {
        if (overlayExisting && !isSystem.has(row.code)) {
          await tx.update(chartOfAccounts).set({
            name: row.name,
            type: row.type,
            parentCode: row.parentCode,
            allowPosting: row.allowPosting,
            isControlAccount: row.isControlAccount,
            normalBalance: row.normalBalance,
            updatedAt: new Date(),
          }).where(eq(chartOfAccounts.id, codeToId.get(row.code)!));
          updated += 1;
        } else {
          skipped += 1;
        }
        continue;
      }

      const [inserted] = await tx.insert(chartOfAccounts).values({
        organizationId,
        code: row.code,
        name: row.name,
        nameNepali: null,
        type: row.type,
        parentCode: row.parentCode,
        groupId: null,
        balance: row.balance,
        normalBalance: row.normalBalance,
        allowPosting: row.allowPosting,
        isSystemAccount: false,
        isControlAccount: row.isControlAccount,
        cashBankAccount: false,
        reconciliationRequired: false,
        costCenterRequired: false,
        displayOrder: 0,
        branchId: null,
        description: null,
        isActive: true,
      }).returning({ id: chartOfAccounts.id });

      codeToId.set(row.code, inserted.id);
      imported += 1;
    }

    return { importedCount: imported, updatedCount: updated, skippedCount: skipped, failedCount: failed.length, failed };
  });
};

export class COAController {
  /**
   * POST /accounting/settings/coa/bulk-import
   * Body: { records: CoaBulkRecord[] }
   * Returns per-batch counts; the transaction is all-or-nothing on DB errors.
   */
  static async bulkImport(req: Request & { user?: OrgUser }, res: Response) {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database is not connected. Configure DATABASE_URL.' });

    const records: CoaBulkRecord[] = Array.isArray(req.body?.records) ? req.body.records : [];
    if (records.length === 0) return res.status(400).json({ error: 'No records to import.' });
    if (records.length > COA_BULK_LIMIT) return res.status(400).json({ error: `At most ${COA_BULK_LIMIT} accounts per import.` });

    try {
      const result = await processBulkCoaImport(db, records, organizationId, false);

      await writeAuditLog(buildAuditRow(
        reqActor(req), 'Accounting Settings', 'accounting_coa_bulk_import',
        `Bulk COA import: ${result.importedCount} imported, ${result.skippedCount} skipped, ${result.failedCount} failed`,
      ));

      res.json({
        success: result.failedCount === 0,
        importedCount: result.importedCount,
        skippedCount: result.skippedCount,
        failedCount: result.failedCount,
        errors: result.failed,
        message: result.failedCount
          ? `Imported ${result.importedCount}, skipped ${result.skippedCount}, ${result.failedCount} row(s) failed validation.`
          : `Imported ${result.importedCount} account(s)${result.skippedCount ? `, skipped ${result.skippedCount} existing code(s).` : '.'}`,
      });
    } catch (error: any) {
      res.status(error?.status || 400).json({ error: error.message || 'Bulk import failed; no changes were saved.' });
    }
  }

  /**
   * POST /accounting/settings/coa/seed-default
   * One-click loader for the standard cooperative COA template
   * (`DEFAULT_COA_TEMPLATE`). Idempotent — existing codes are skipped (or, when
   * `overlayExisting` is true, refreshed in place).
   */
  static async seedDefault(req: Request & { user?: OrgUser }, res: Response) {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database is not connected. Configure DATABASE_URL.' });

    const overlayExisting = req.body?.overlayExisting === true;
    const records: CoaBulkRecord[] = DEFAULT_COA_TEMPLATE.map((a: CoaTemplateAccount) => ({
      glCode: a.code,
      accountName: a.name,
      accountType: a.type,
      parentGlCode: a.parentCode,
      isPostingAllowed: a.allowPosting,
      openingBalance: a.balance,
      normalBalance: a.normalBalance,
      isControlAccount: a.isControlAccount,
    }));

    try {
      const result = await processBulkCoaImport(db, records, organizationId, overlayExisting);

      await writeAuditLog(buildAuditRow(
        reqActor(req), 'Accounting Settings', 'accounting_coa_seeded',
        `Standard COA seeded: ${result.importedCount} imported, ${result.updatedCount} updated, ${result.skippedCount} skipped`,
      ));

      res.json({
        success: true,
        seededCount: result.importedCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
        total: DEFAULT_COA_TEMPLATE.length,
        message: result.importedCount === 0
          ? `All ${result.skippedCount} standard accounts already exist — nothing new to add.`
          : `Seeded ${result.importedCount} standard account(s)${result.skippedCount ? `, skipped ${result.skippedCount} existing` : ''}.`,
      });
    } catch (error: any) {
      res.status(error?.status || 400).json({ error: error.message || 'Standard COA seeding failed; no changes were saved.' });
    }
  }
}