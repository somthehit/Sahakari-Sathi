import { Request, Response } from 'express';
import { eq, and, ne } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { approvalMatrix } from '../../db/schema';
import { buildAuditRow, writeAuditLog, SettingsActor } from '../utils/audit';
import {
  createApprovalMatrixSchema,
  updateApprovalMatrixSchema,
} from '../schemas/approvalSettings';

export { createApprovalMatrixSchema, updateApprovalMatrixSchema };

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

const normalize = (row: typeof approvalMatrix.$inferSelect) => ({
  id: row.id,
  organizationId: row.organizationId,
  requestType: row.requestType,
  thresholdMin: toNum(row.thresholdMin) ?? 0,
  thresholdMax: toNum(row.thresholdMax),
  signatory1Role: row.signatory1Role,
  signatory2Role: row.signatory2Role,
  smsNotify: row.smsNotify,
  active: row.active,
  description: row.description || '',
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class ApprovalMatrixController {
  static async getMatrix(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const rows = await db.select().from(approvalMatrix)
        .where(eq(approvalMatrix.organizationId, organizationId));
      res.json(rows.map(normalize));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createRule(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [dup] = await db.select({ id: approvalMatrix.id })
        .from(approvalMatrix)
        .where(and(
          eq(approvalMatrix.organizationId, organizationId),
          eq(approvalMatrix.requestType, body.requestType),
          eq(approvalMatrix.thresholdMin, String(body.thresholdMin ?? 0)),
        ))
        .limit(1);
      if (dup) {
        return res.status(409).json({ error: `A ${body.requestType} rule with this threshold already exists.` });
      }

      const [rule] = await db.insert(approvalMatrix).values({
        organizationId,
        requestType: body.requestType,
        thresholdMin: String(body.thresholdMin ?? 0),
        thresholdMax: body.thresholdMax !== null && body.thresholdMax !== undefined ? String(body.thresholdMax) : null,
        signatory1Role: String(body.signatory1Role).trim(),
        signatory2Role: body.signatory2Role ? String(body.signatory2Role).trim() : null,
        smsNotify: body.smsNotify === true,
        active: body.active !== false,
        description: body.description ? String(body.description).trim() : null,
      }).returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Workflow & Approvals',
        'Create Approval Matrix Rule',
        `Created ${rule.requestType} matrix rule (≥ ${rule.thresholdMin}${rule.thresholdMax ? ` – ${rule.thresholdMax}` : '+'})`,
      ));

      res.status(201).json(normalize(rule));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateRule(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [existing] = await db.select().from(approvalMatrix).where(eq(approvalMatrix.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Approval matrix rule not found' });
      if (organizationId && existing.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Not authorized to edit this approval matrix rule.' });
      }

      const update: Record<string, any> = { updatedAt: new Date() };
      if (body.requestType !== undefined) update.requestType = body.requestType;
      if (body.thresholdMin !== undefined) update.thresholdMin = String(body.thresholdMin);
      if (body.thresholdMax !== undefined) update.thresholdMax = body.thresholdMax === null ? null : String(body.thresholdMax);
      if (body.signatory1Role !== undefined) update.signatory1Role = String(body.signatory1Role).trim();
      if (body.signatory2Role !== undefined) update.signatory2Role = body.signatory2Role ? String(body.signatory2Role).trim() : null;
      if (body.smsNotify !== undefined) update.smsNotify = body.smsNotify === true;
      if (body.active !== undefined) update.active = body.active === true;
      if (body.description !== undefined) update.description = body.description ? String(body.description).trim() : null;

      const [rule] = await db.update(approvalMatrix)
        .set(update)
        .where(eq(approvalMatrix.id, req.params.id))
        .returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Workflow & Approvals',
        'Update Approval Matrix Rule',
        `Updated ${rule.requestType} matrix rule (≥ ${rule.thresholdMin}${rule.thresholdMax ? ` – ${rule.thresholdMax}` : '+'})`,
      ));

      res.json(normalize(rule));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteRule(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [existing] = await db.select().from(approvalMatrix).where(eq(approvalMatrix.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Approval matrix rule not found' });
      if (organizationId && existing.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Not authorized to delete this approval matrix rule.' });
      }

      await db.delete(approvalMatrix).where(eq(approvalMatrix.id, req.params.id));

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Workflow & Approvals',
        'Delete Approval Matrix Rule',
        `Deleted ${existing.requestType} matrix rule (≥ ${existing.thresholdMin}${existing.thresholdMax ? ` – ${existing.thresholdMax}` : '+'})`,
      ));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
