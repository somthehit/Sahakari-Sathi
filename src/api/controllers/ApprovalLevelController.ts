import { Request, Response } from 'express';
import { eq, and, ne } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { approvalLevels } from '../../db/schema';
import { buildAuditRow, writeAuditLog, SettingsActor } from '../utils/audit';
import {
  createApprovalLevelSchema,
  updateApprovalLevelSchema,
} from '../schemas/approvalSettings';

export { createApprovalLevelSchema, updateApprovalLevelSchema };

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

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalize = (row: typeof approvalLevels.$inferSelect) => ({
  id: row.id,
  organizationId: row.organizationId,
  levelNo: row.levelNo,
  roleKey: row.roleKey,
  roleLabel: row.roleLabel,
  minAmount: toNum(row.minAmount) ?? 0,
  maxAmount: toNum(row.maxAmount),
  scope: row.scope || '',
  active: row.active,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const sortByLevel = (rows: ReturnType<typeof normalize>[]) => [...rows].sort((a, b) => a.levelNo - b.levelNo);

export class ApprovalLevelController {
  static async getLevels(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const rows = await db.select().from(approvalLevels)
        .where(eq(approvalLevels.organizationId, organizationId));
      res.json(sortByLevel(rows.map(normalize)));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getLevel(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const [row] = await db.select().from(approvalLevels)
        .where(and(eq(approvalLevels.id, req.params.id), eq(approvalLevels.organizationId, organizationId)))
        .limit(1);
      if (!row) return res.status(404).json({ error: 'Approval level not found' });
      res.json(normalize(row));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createLevel(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [existing] = await db.select({ id: approvalLevels.id })
        .from(approvalLevels)
        .where(and(
          eq(approvalLevels.organizationId, organizationId),
          eq(approvalLevels.levelNo, body.levelNo)
        ))
        .limit(1);
      if (existing) {
        return res.status(409).json({ error: `Approval level ${body.levelNo} already exists.` });
      }

      const [level] = await db.insert(approvalLevels).values({
        organizationId,
        levelNo: body.levelNo,
        roleKey: String(body.roleKey).trim(),
        roleLabel: String(body.roleLabel).trim(),
        minAmount: String(body.minAmount ?? 0),
        maxAmount: body.maxAmount !== null && body.maxAmount !== undefined ? String(body.maxAmount) : null,
        scope: String(body.scope ?? '').trim(),
        active: body.active !== false,
      }).returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Workflow & Approvals',
        'Create Approval Level',
        `Created approval level ${level.levelNo} (${level.roleLabel})`,
      ));

      res.status(201).json(normalize(level));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateLevel(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [existing] = await db.select().from(approvalLevels).where(eq(approvalLevels.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Approval level not found' });
      if (organizationId && existing.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Not authorized to edit this approval level.' });
      }

      if (body.levelNo !== undefined) {
        const [dup] = await db.select({ id: approvalLevels.id })
          .from(approvalLevels)
          .where(and(
            eq(approvalLevels.organizationId, existing.organizationId),
            eq(approvalLevels.levelNo, body.levelNo),
            ne(approvalLevels.id, existing.id),
          ))
          .limit(1);
        if (dup) {
          return res.status(409).json({ error: `Approval level ${body.levelNo} already exists.` });
        }
      }

      const update: Record<string, any> = { updatedAt: new Date() };
      if (body.levelNo !== undefined) update.levelNo = body.levelNo;
      if (body.roleKey !== undefined) update.roleKey = String(body.roleKey).trim();
      if (body.roleLabel !== undefined) update.roleLabel = String(body.roleLabel).trim();
      if (body.minAmount !== undefined) update.minAmount = String(body.minAmount);
      if (body.maxAmount !== undefined) update.maxAmount = body.maxAmount === null ? null : String(body.maxAmount);
      if (body.scope !== undefined) update.scope = String(body.scope).trim();
      if (body.active !== undefined) update.active = body.active === true;

      const [level] = await db.update(approvalLevels)
        .set(update)
        .where(eq(approvalLevels.id, req.params.id))
        .returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Workflow & Approvals',
        'Update Approval Level',
        `Updated approval level ${level.levelNo} (${level.roleLabel})`,
      ));

      res.json(normalize(level));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteLevel(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [existing] = await db.select().from(approvalLevels).where(eq(approvalLevels.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Approval level not found' });
      if (organizationId && existing.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Not authorized to delete this approval level.' });
      }

      await db.delete(approvalLevels).where(eq(approvalLevels.id, req.params.id));

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Workflow & Approvals',
        'Delete Approval Level',
        `Deleted approval level ${existing.levelNo} (${existing.roleLabel})`,
      ));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
