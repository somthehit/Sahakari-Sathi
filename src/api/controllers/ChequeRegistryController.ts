/**
 * Cheque Registry & Design Controller
 *
 * Read-side + design-template endpoints for the consolidated cheque workspace:
 *   - unified cheque register (leaf-level, filtered + paginated)
 *   - per-account cheque history (books, leaves, stop payments, bounces)
 *   - dashboard statistics (counters by status, charges, dishonours)
 *   - cheque leaf design templates CRUD (studio persistence)
 *
 * All queries are scoped to organization_id for multi-tenant isolation. The
 * design endpoints mirror the share-certificate-format persistence pattern:
 * structured columns for what the API reasons about (identity/size/active/
 * default) plus the full visual layout persisted verbatim as `config_json`.
 */
import { Request, Response } from 'express';
import { eq, and, or, desc, asc, sql, count, gte, lte, ilike, ne } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  chequeBooks, chequeLeaves, chequeStopPayments, chequeBounces, chequeDesigns,
  savingsAccounts, members, branches,
} from '../../db/schema';
import { chequeDesignSchema, chequeDesignUpdateSchema } from '../schemas/chequeSetting';
import { buildAuditRow, writeAuditLog, SettingsActor } from '../utils/audit';

interface OrgUser {
  organizationId?: string;
  userId?: string;
  username?: string;
  role?: string;
  branchId?: string;
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

const MAX_CONFIG_BYTES = 4 * 1024 * 1024; // 4 MB, matching the certificate-format cap.

/** Normalize a design's incoming configJson (object → string) with a size guard. */
function serializeConfig(configJson: unknown): string | null {
  if (configJson == null) return null;
  const asString = typeof configJson === 'string' ? configJson : JSON.stringify(configJson);
  if (Buffer.byteLength(asString, 'utf8') > MAX_CONFIG_BYTES) {
    throw new Error('Design configuration is too large (4 MB limit).');
  }
  return asString;
}

/** Parse a stored configJson string back to an object for the client. */
function parseConfig(configJson: string | null): any {
  if (!configJson) return null;
  try { return JSON.parse(configJson); } catch { return null; }
}

export class ChequeRegistryController {
  /**
   * GET /api/v1/cheque-register
   * Unified, filtered, paginated leaf-level register across the organization.
   * Filters: accountId, bookId, branchId, status, search (cheque no / account /
   * member), fromBs / toBs (issued-date window on the owning book).
   */
  static async getRegister(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const accountId = req.query.accountId as string | undefined;
      const bookId = req.query.bookId as string | undefined;
      const branchId = req.query.branchId as string | undefined;
      const status = req.query.status as string | undefined;
      const search = (req.query.search as string)?.trim();
      const fromBs = (req.query.fromBs as string)?.trim();
      const toBs = (req.query.toBs as string)?.trim();
      const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || '50', 10) || 50));
      const offset = (page - 1) * limit;

      const conditions: any[] = [eq(chequeLeaves.organizationId, organizationId)];
      if (accountId) conditions.push(eq(chequeLeaves.accountId, accountId));
      if (bookId) conditions.push(eq(chequeLeaves.chequeBookId, bookId));
      if (branchId) conditions.push(eq(chequeLeaves.branchId, branchId));
      if (status && status !== 'all') conditions.push(eq(chequeLeaves.status, status as any));
      if (fromBs) conditions.push(gte(chequeBooks.issuedDateBs, fromBs));
      if (toBs) conditions.push(lte(chequeBooks.issuedDateBs, toBs));
      if (search) {
        const term = `%${search}%`;
        conditions.push(or(
          ilike(chequeLeaves.chequeNumber, term),
          ilike(savingsAccounts.accountNo, term),
          ilike(members.fullName, term),
          ilike(chequeBooks.bookNumber, term),
        ));
      }

      const whereClause = and(...conditions);

      const [{ total }] = await db.select({ total: count() })
        .from(chequeLeaves)
        .innerJoin(chequeBooks, eq(chequeLeaves.chequeBookId, chequeBooks.id))
        .innerJoin(savingsAccounts, eq(chequeLeaves.accountId, savingsAccounts.id))
        .leftJoin(members, eq(savingsAccounts.memberId, members.id))
        .where(whereClause);

      const rows = await db.select({
        id: chequeLeaves.id,
        chequeNumber: chequeLeaves.chequeNumber,
        leafNo: chequeLeaves.leafNo,
        status: chequeLeaves.status,
        payeeName: chequeLeaves.payeeName,
        amount: chequeLeaves.amount,
        chequeDateBs: chequeLeaves.chequeDateBs,
        stopPaymentReason: chequeLeaves.stopPaymentReason,
        bounceReason: chequeLeaves.bounceReason,
        chequeBookId: chequeLeaves.chequeBookId,
        bookNumber: chequeBooks.bookNumber,
        bookStatus: chequeBooks.status,
        issuedDateBs: chequeBooks.issuedDateBs,
        accountId: chequeLeaves.accountId,
        accountNo: savingsAccounts.accountNo,
        memberId: savingsAccounts.memberId,
        memberName: members.fullName,
        memberNo: members.memberNo,
        branchId: chequeLeaves.branchId,
        branchName: branches.name,
      })
        .from(chequeLeaves)
        .innerJoin(chequeBooks, eq(chequeLeaves.chequeBookId, chequeBooks.id))
        .innerJoin(savingsAccounts, eq(chequeLeaves.accountId, savingsAccounts.id))
        .leftJoin(members, eq(savingsAccounts.memberId, members.id))
        .leftJoin(branches, eq(chequeLeaves.branchId, branches.id))
        .where(whereClause)
        .orderBy(desc(chequeBooks.issuedDateBs), asc(chequeLeaves.leafNo))
        .limit(limit)
        .offset(offset);

      res.json({ rows, total: Number(total) || 0, page, limit });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/cheque-accounts/:accountId/history
   * Full cheque history for a single account: books, leaves, stop payments,
   * bounces, and a rolled-up summary.
   */
  static async getAccountHistory(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const { accountId } = req.params;

      const [account] = await db.select({
        id: savingsAccounts.id,
        accountNo: savingsAccounts.accountNo,
        status: savingsAccounts.status,
        memberId: savingsAccounts.memberId,
        memberName: members.fullName,
        memberNo: members.memberNo,
        branchId: savingsAccounts.branchId,
        branchName: branches.name,
      })
        .from(savingsAccounts)
        .leftJoin(members, eq(savingsAccounts.memberId, members.id))
        .leftJoin(branches, eq(savingsAccounts.branchId, branches.id))
        .where(and(eq(savingsAccounts.id, accountId), eq(savingsAccounts.organizationId, organizationId)))
        .limit(1);

      if (!account) return res.status(404).json({ error: 'Account not found.' });

      const books = await db.select()
        .from(chequeBooks)
        .where(and(eq(chequeBooks.organizationId, organizationId), eq(chequeBooks.accountId, accountId)))
        .orderBy(desc(chequeBooks.issuedDateBs));

      const leaves = await db.select({
        id: chequeLeaves.id,
        chequeNumber: chequeLeaves.chequeNumber,
        leafNo: chequeLeaves.leafNo,
        status: chequeLeaves.status,
        payeeName: chequeLeaves.payeeName,
        amount: chequeLeaves.amount,
        chequeDateBs: chequeLeaves.chequeDateBs,
        chequeBookId: chequeLeaves.chequeBookId,
        bookNumber: chequeBooks.bookNumber,
      })
        .from(chequeLeaves)
        .innerJoin(chequeBooks, eq(chequeLeaves.chequeBookId, chequeBooks.id))
        .where(and(eq(chequeLeaves.organizationId, organizationId), eq(chequeLeaves.accountId, accountId)))
        .orderBy(asc(chequeLeaves.chequeNumber));

      const stopPayments = await db.select()
        .from(chequeStopPayments)
        .where(and(eq(chequeStopPayments.organizationId, organizationId), eq(chequeStopPayments.accountId, accountId)))
        .orderBy(desc(chequeStopPayments.createdAt));

      const bounces = await db.select()
        .from(chequeBounces)
        .where(and(eq(chequeBounces.organizationId, organizationId), eq(chequeBounces.accountId, accountId)))
        .orderBy(desc(chequeBounces.createdAt));

      const leafByStatus: Record<string, number> = {};
      for (const l of leaves) leafByStatus[l.status] = (leafByStatus[l.status] || 0) + 1;

      const summary = {
        totalBooks: books.length,
        activeBooks: books.filter((b) => b.status === 'active').length,
        totalLeaves: leaves.length,
        leafByStatus,
        pendingStopPayments: stopPayments.filter((s) => s.status === 'pending').length,
        approvedStopPayments: stopPayments.filter((s) => s.status === 'approved').length,
        totalBounces: bounces.length,
      };

      res.json({ account, books, leaves, stopPayments, bounces, summary });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/cheque-stats
   * Organization-wide cheque dashboard counters.
   */
  static async getStats(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const booksByStatusRows = await db.select({ status: chequeBooks.status, c: count() })
        .from(chequeBooks)
        .where(eq(chequeBooks.organizationId, organizationId))
        .groupBy(chequeBooks.status);

      const leavesByStatusRows = await db.select({ status: chequeLeaves.status, c: count() })
        .from(chequeLeaves)
        .where(eq(chequeLeaves.organizationId, organizationId))
        .groupBy(chequeLeaves.status);

      const stopByStatusRows = await db.select({ status: chequeStopPayments.status, c: count() })
        .from(chequeStopPayments)
        .where(eq(chequeStopPayments.organizationId, organizationId))
        .groupBy(chequeStopPayments.status);

      const [{ totalBounces, bounceAmount, bounceCharges }] = await db.select({
        totalBounces: count(),
        bounceAmount: sql<string>`COALESCE(SUM(${chequeBounces.amount}), 0)`,
        bounceCharges: sql<string>`COALESCE(SUM(${chequeBounces.bounceCharge}), 0)`,
      })
        .from(chequeBounces)
        .where(eq(chequeBounces.organizationId, organizationId));

      const [{ issuanceCharges }] = await db.select({
        issuanceCharges: sql<string>`COALESCE(SUM(${chequeBooks.issuanceCharge}), 0)`,
      })
        .from(chequeBooks)
        .where(eq(chequeBooks.organizationId, organizationId));

      const toMap = (rows: { status: string; c: number }[]) => {
        const m: Record<string, number> = {};
        for (const r of rows) m[r.status] = Number(r.c) || 0;
        return m;
      };

      const booksByStatus = toMap(booksByStatusRows);
      const leavesByStatus = toMap(leavesByStatusRows);
      const stopByStatus = toMap(stopByStatusRows);

      const sumMap = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

      res.json({
        books: { total: sumMap(booksByStatus), byStatus: booksByStatus, active: booksByStatus['active'] || 0 },
        leaves: { total: sumMap(leavesByStatus), byStatus: leavesByStatus },
        stopPayments: { total: sumMap(stopByStatus), byStatus: stopByStatus, pending: stopByStatus['pending'] || 0 },
        bounces: {
          total: Number(totalBounces) || 0,
          amount: Number(bounceAmount) || 0,
          charges: Number(bounceCharges) || 0,
        },
        charges: { issuanceTotal: Number(issuanceCharges) || 0 },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Cheque leaf design templates
  // ─────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/cheque-designs
   * List the organization's saved cheque leaf designs.
   */
  static async listDesigns(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const includeInactive = req.query.includeInactive === 'true';
      const conditions: any[] = [eq(chequeDesigns.organizationId, organizationId)];
      if (!includeInactive) conditions.push(eq(chequeDesigns.isActive, true));

      const rows = await db.select()
        .from(chequeDesigns)
        .where(and(...conditions))
        .orderBy(desc(chequeDesigns.isDefault), asc(chequeDesigns.sortOrder), asc(chequeDesigns.name));

      res.json(rows.map((r) => ({ ...r, config: parseConfig(r.configJson) })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/cheque-designs/:id
   * Fetch a single design with its parsed config.
   */
  static async getDesign(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const { id } = req.params;
      const [row] = await db.select()
        .from(chequeDesigns)
        .where(and(eq(chequeDesigns.id, id), eq(chequeDesigns.organizationId, organizationId)))
        .limit(1);

      if (!row) return res.status(404).json({ error: 'Cheque design not found.' });
      res.json({ ...row, config: parseConfig(row.configJson) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/cheque-designs
   * Create a new cheque leaf design. Codes are stored UPPERCASE and are unique
   * per organization; setting isDefault clears the flag on the others.
   */
  static async createDesign(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const parsed = chequeDesignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid cheque design payload', details: parsed.error.format() });
      }
      const val = parsed.data;
      const code = val.code.trim().toUpperCase();

      const [dupe] = await db.select({ id: chequeDesigns.id })
        .from(chequeDesigns)
        .where(and(eq(chequeDesigns.organizationId, organizationId), eq(chequeDesigns.code, code)))
        .limit(1);
      if (dupe) return res.status(409).json({ error: `A design with code "${code}" already exists.` });

      const created = await db.transaction(async (tx) => {
        if (val.isDefault) {
          await tx.update(chequeDesigns)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(and(eq(chequeDesigns.organizationId, organizationId), eq(chequeDesigns.isDefault, true)));
        }
        const [row] = await tx.insert(chequeDesigns).values({
          organizationId,
          branchId: val.branchId ?? req.user?.branchId ?? null,
          code,
          name: val.name,
          description: val.description ?? null,
          isActive: val.isActive,
          isDefault: val.isDefault,
          sortOrder: val.sortOrder,
          widthMm: String(val.widthMm),
          heightMm: String(val.heightMm),
          configJson: serializeConfig(val.configJson),
          createdBy: req.user?.userId ?? null,
          updatedBy: req.user?.userId ?? null,
        }).returning();
        return row;
      });

      await writeAuditLog(buildAuditRow(
        reqActor(req), 'Cheque Design', 'Create Cheque Design',
        `Created cheque design ${code} — ${val.name}`,
      ));

      res.status(201).json({ ...created, config: parseConfig(created.configJson) });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * PUT /api/v1/cheque-designs/:id
   * Update a design. Only supplied fields change; isDefault:true clears others.
   */
  static async updateDesign(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const { id } = req.params;
      const parsed = chequeDesignUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid cheque design payload', details: parsed.error.format() });
      }
      const val = parsed.data;

      const [existing] = await db.select()
        .from(chequeDesigns)
        .where(and(eq(chequeDesigns.id, id), eq(chequeDesigns.organizationId, organizationId)))
        .limit(1);
      if (!existing) return res.status(404).json({ error: 'Cheque design not found.' });

      let code = existing.code;
      if (val.code != null) {
        code = val.code.trim().toUpperCase();
        if (code !== existing.code) {
          const [dupe] = await db.select({ id: chequeDesigns.id })
            .from(chequeDesigns)
            .where(and(
              eq(chequeDesigns.organizationId, organizationId),
              eq(chequeDesigns.code, code),
              ne(chequeDesigns.id, id),
            ))
            .limit(1);
          if (dupe) return res.status(409).json({ error: `A design with code "${code}" already exists.` });
        }
      }

      const patch: any = { updatedAt: new Date(), updatedBy: req.user?.userId ?? null, code };
      if (val.name != null) patch.name = val.name;
      if (val.description !== undefined) patch.description = val.description ?? null;
      if (val.isActive != null) patch.isActive = val.isActive;
      if (val.sortOrder != null) patch.sortOrder = val.sortOrder;
      if (val.widthMm != null) patch.widthMm = String(val.widthMm);
      if (val.heightMm != null) patch.heightMm = String(val.heightMm);
      if (val.branchId !== undefined) patch.branchId = val.branchId ?? null;
      if (val.configJson !== undefined) patch.configJson = serializeConfig(val.configJson);
      if (val.isDefault != null) patch.isDefault = val.isDefault;

      const updated = await db.transaction(async (tx) => {
        if (val.isDefault === true) {
          await tx.update(chequeDesigns)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(and(
              eq(chequeDesigns.organizationId, organizationId),
              eq(chequeDesigns.isDefault, true),
              ne(chequeDesigns.id, id),
            ));
        }
        const [row] = await tx.update(chequeDesigns)
          .set(patch)
          .where(and(eq(chequeDesigns.id, id), eq(chequeDesigns.organizationId, organizationId)))
          .returning();
        return row;
      });

      await writeAuditLog(buildAuditRow(
        reqActor(req), 'Cheque Design', 'Update Cheque Design',
        `Updated cheque design ${updated.code} — ${updated.name}`,
      ));

      res.json({ ...updated, config: parseConfig(updated.configJson) });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/v1/cheque-designs/:id
   * Remove a design template.
   */
  static async deleteDesign(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const { id } = req.params;
      const [existing] = await db.select({ id: chequeDesigns.id, code: chequeDesigns.code })
        .from(chequeDesigns)
        .where(and(eq(chequeDesigns.id, id), eq(chequeDesigns.organizationId, organizationId)))
        .limit(1);
      if (!existing) return res.status(404).json({ error: 'Cheque design not found.' });

      await db.delete(chequeDesigns)
        .where(and(eq(chequeDesigns.id, id), eq(chequeDesigns.organizationId, organizationId)));

      await writeAuditLog(buildAuditRow(
        reqActor(req), 'Cheque Design', 'Delete Cheque Design',
        `Deleted cheque design ${existing.code}`,
      ));

      res.json({ success: true, message: 'Cheque design deleted.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
