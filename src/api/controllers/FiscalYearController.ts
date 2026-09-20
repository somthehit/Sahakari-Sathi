import { Request, Response } from 'express';
import { eq, and, ne } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { fiscalYears } from '../../db/schema';
import { findOverlappingFiscalYear, isValidBsRange } from '../utils/fiscalYearValidation';
import { buildAuditRow, writeAuditLog, SettingsActor } from '../utils/audit';
import {
  createFiscalYearSchema,
  updateFiscalYearSchema,
} from '../schemas/organizationSettings';

interface OrgUser {
  organizationId?: string;
  userId?: string;
  username?: string;
  role?: string;
}

/** Build the actor context from an authenticated request for audit trails. */
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

export class FiscalYearController {
  static async getFiscalYears(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const rows = await db.select().from(fiscalYears)
        .where(eq(fiscalYears.organizationId, organizationId))
        .orderBy(fiscalYears.code);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getFiscalYear(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const [row] = await db.select().from(fiscalYears)
        .where(and(eq(fiscalYears.id, req.params.id), eq(fiscalYears.organizationId, organizationId)))
        .limit(1);
      if (!row) return res.status(404).json({ error: 'Fiscal year not found' });
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createFiscalYear(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [existing] = await db.select({ id: fiscalYears.id })
        .from(fiscalYears)
        .where(and(
          eq(fiscalYears.organizationId, organizationId),
          eq(fiscalYears.code, String(body.code).trim())
        ))
        .limit(1);
      if (existing) {
        return res.status(409).json({ error: 'Fiscal year with this code already exists.' });
      }

      // Data-integrity rule (server-side): BS date ranges must not overlap.
      if (!isValidBsRange({ startDateBS: body.startDateBS, endDateBS: body.endDateBS })) {
        return res.status(400).json({ error: 'Invalid BS date range. Provide valid YYYY-MM-DD start and end dates.' });
      }
      const allYears = await db.select({
        id: fiscalYears.id,
        code: fiscalYears.code,
        startDateBS: fiscalYears.startDateBs,
        endDateBS: fiscalYears.endDateBs,
      }).from(fiscalYears).where(eq(fiscalYears.organizationId, organizationId));
      const clash = findOverlappingFiscalYear(allYears, {
        startDateBS: String(body.startDateBS).trim(),
        endDateBS: String(body.endDateBS).trim(),
      });
      if (clash) {
        return res.status(409).json({
          error: `Fiscal year "${clash.code}" already covers ${clash.startDateBS} to ${clash.endDateBS}. Date ranges must not overlap.`,
        });
      }

      const isCurrent = body.isCurrent === true || body.status === 'active';

      if (isCurrent) {
        await db.update(fiscalYears)
          .set({ isCurrent: false })
          .where(eq(fiscalYears.organizationId, organizationId));
      }

      const [fiscalYear] = await db.insert(fiscalYears).values({
        organizationId,
        code: String(body.code).trim(),
        startDateBs: String(body.startDateBS ?? '').trim(),
        endDateBs: String(body.endDateBS ?? '').trim(),
        startDateAd: String(body.startDateAD ?? '').trim(),
        endDateAd: String(body.endDateAD ?? '').trim(),
        isCurrent,
        status: body.status === 'closed' ? 'closed' : 'active',
      }).returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Organization Setup',
        'Create Fiscal Year',
        `Created fiscal year ${fiscalYear.code} (${fiscalYear.startDateBs} → ${fiscalYear.endDateBs})${isCurrent ? ' [active]' : ''}`,
      ));

      res.status(201).json(fiscalYear);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateFiscalYear(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [existing] = await db.select().from(fiscalYears).where(eq(fiscalYears.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Fiscal year not found' });
      if (organizationId && existing.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Not authorized to edit this fiscal year.' });
      }

      if (body.code) {
        const [dup] = await db.select({ id: fiscalYears.id })
          .from(fiscalYears)
          .where(and(
            eq(fiscalYears.organizationId, existing.organizationId),
            eq(fiscalYears.code, String(body.code).trim()),
            ne(fiscalYears.id, existing.id),
          ))
          .limit(1);
        if (dup) {
          return res.status(409).json({ error: 'Fiscal year with this code already exists.' });
        }
      }

      const isCurrent = body.isCurrent !== undefined
        ? body.isCurrent === true
        : existing.isCurrent;

      // Data-integrity rule: the resulting BS range must not overlap any other year.
      const nextStartBS = body.startDateBS !== undefined ? String(body.startDateBS).trim() : existing.startDateBs;
      const nextEndBS = body.endDateBS !== undefined ? String(body.endDateBS).trim() : existing.endDateBs;
      if (!isValidBsRange({ startDateBS: nextStartBS, endDateBS: nextEndBS })) {
        return res.status(400).json({ error: 'Invalid BS date range. Provide valid YYYY-MM-DD start and end dates.' });
      }
      const allYears = await db.select({
        id: fiscalYears.id,
        code: fiscalYears.code,
        startDateBS: fiscalYears.startDateBs,
        endDateBS: fiscalYears.endDateBs,
      }).from(fiscalYears).where(eq(fiscalYears.organizationId, existing.organizationId));
      const clash = findOverlappingFiscalYear(
        allYears,
        { startDateBS: nextStartBS, endDateBS: nextEndBS },
        existing.id,
      );
      if (clash) {
        return res.status(409).json({
          error: `Fiscal year "${clash.code}" already covers ${clash.startDateBS} to ${clash.endDateBS}. Date ranges must not overlap.`,
        });
      }

      if (isCurrent) {
        await db.update(fiscalYears)
          .set({ isCurrent: false })
          .where(and(
            eq(fiscalYears.organizationId, existing.organizationId),
            ne(fiscalYears.id, existing.id),
          ));
      }

      const update: Record<string, any> = {};
      if (body.code !== undefined) update.code = String(body.code).trim();
      if (body.startDateBS !== undefined) update.startDateBs = String(body.startDateBS).trim();
      if (body.endDateBS !== undefined) update.endDateBs = String(body.endDateBS).trim();
      if (body.startDateAD !== undefined) update.startDateAd = String(body.startDateAD).trim();
      if (body.endDateAD !== undefined) update.endDateAd = String(body.endDateAD).trim();
      if (body.isCurrent !== undefined) update.isCurrent = body.isCurrent === true;
      if (body.status !== undefined) update.status = body.status === 'closed' ? 'closed' : 'active';

      const [fiscalYear] = await db.update(fiscalYears)
        .set(update)
        .where(eq(fiscalYears.id, req.params.id))
        .returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Organization Setup',
        'Update Fiscal Year',
        `Updated fiscal year ${fiscalYear.code} (${fiscalYear.startDateBs} → ${fiscalYear.endDateBs})${isCurrent ? ' [active]' : ''}`,
      ));

      res.json(fiscalYear);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteFiscalYear(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [existing] = await db.select().from(fiscalYears).where(eq(fiscalYears.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Fiscal year not found' });
      if (organizationId && existing.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Not authorized to delete this fiscal year.' });
      }

      await db.delete(fiscalYears).where(eq(fiscalYears.id, req.params.id));

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Organization Setup',
        'Delete Fiscal Year',
        `Deleted fiscal year ${existing.code} (${existing.startDateBs} → ${existing.endDateBs})`,
      ));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
