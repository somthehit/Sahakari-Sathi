import { Request, Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { approvalRequests } from '../../db/schema';
import { buildAuditRow, writeAuditLog, SettingsActor } from '../utils/audit';
import { approvalDecisionSchema } from '../schemas/approvalSettings';

export { approvalDecisionSchema };

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

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const normalize = (row: typeof approvalRequests.$inferSelect) => ({
  id: row.id,
  organizationId: row.organizationId,
  requestType: row.requestType,
  referenceNo: row.referenceNo,
  requestedBy: row.requestedBy,
  requestedDateBs: row.requestedDateBs,
  amount: toNum(row.amount),
  description: row.description,
  branchId: row.branchId,
  status: row.status,
  approvedBy: row.approvedBy,
  remarks: row.remarks,
  processedAt: row.processedAt,
  createdAt: row.createdAt,
});

const VALID_STATUSES = ['Pending', 'Approved', 'Rejected'];

export class ApprovalRequestController {
  /** List the org's approval requests, optionally filtered by status. */
  static async getRequests(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const status = req.query.status as string | undefined;
      const rows = await db.select().from(approvalRequests)
        .where(
          status && VALID_STATUSES.includes(status)
            ? and(eq(approvalRequests.organizationId, organizationId), eq(approvalRequests.status as any, status))
            : eq(approvalRequests.organizationId, organizationId)
        )
        .orderBy(desc(approvalRequests.createdAt));

      res.json(rows.map(normalize));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** Record an approval/rejection decision for an org-scoped request. */
  static async decision(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const { status, remarks } = req.body;

      const [existing] = await db.select().from(approvalRequests)
        .where(and(eq(approvalRequests.id, req.params.id), eq(approvalRequests.organizationId, organizationId)))
        .limit(1);
      if (!existing) return res.status(404).json({ error: 'Approval request not found' });
      if (existing.status !== 'Pending') {
        return res.status(409).json({ error: 'Approval request already processed.' });
      }

      const [updated] = await db.update(approvalRequests)
        .set({
          status,
          approvedBy: req.user?.username || req.user?.userId || 'System',
          remarks: remarks ?? null,
          processedAt: new Date(),
        })
        .where(eq(approvalRequests.id, existing.id))
        .returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Workflow & Approvals',
        `${status} Approval Request`,
        `${status} ${updated.referenceNo} (${updated.requestType}, NPR ${toNum(updated.amount).toLocaleString()})${remarks ? ` — ${remarks}` : ''}`,
      ));

      res.json(normalize(updated));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
