/**
 * Hard Delete Controller
 *
 * Admin-only, confirmation-gated endpoints that permanently remove a member or
 * a savings account while writing an immutable archive to audit_deletion_logs
 * (migration 0036). Routes are guarded by `requireRole(['org_admin'])` and the
 * request body must carry an explicit `confirmation: 'DELETE'` literal plus a
 * free-text reason — a mis-click can never hard-delete a financial record.
 */
import { Response } from 'express';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { HardDeleteService } from '../services/HardDeleteService';
import { requireOrg } from '../middleware/scope';
import { getDb } from '../../db/client';
import { auditDeletionLogs } from '../../db/schema';
import type { AuthRequest } from '../middleware/authMiddleware';

const service = new HardDeleteService();

function reqActor(req: AuthRequest) {
  return {
    userId: req.user?.userId || req.user?.authUserId || req.user?.uid || 'unknown',
    username: req.user?.username,
    role: req.user?.role,
    ipAddress: req.ip || req.socket?.remoteAddress,
  };
}

export const hardDeleteMemberSchema = z.object({
  body: z.object({
    reason: z.string().min(5, 'A deletion reason of at least 5 characters is required.'),
    confirmation: z.literal('DELETE'),
  }),
});

export const hardDeleteSavingsAccountSchema = z.object({
  body: z.object({
    reason: z.string().min(5, 'A deletion reason of at least 5 characters is required.'),
    confirmation: z.literal('DELETE'),
  }),
});

export class HardDeleteController {
  static async hardDeleteMember(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.hardDeleteMember(
        req.params.id,
        organizationId,
        reqActor(req),
        req.body.reason,
      );
      res.json({
        success: true,
        message: 'Member permanently deleted. An immutable audit record was archived.',
        auditLogId: result.auditLogId,
      });
    } catch (error: any) {
      if (error.message === 'Member not found') return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async hardDeleteSavingsAccount(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.hardDeleteSavingsAccount(
        req.params.id,
        organizationId,
        reqActor(req),
        req.body.reason,
      );
      res.json({
        success: true,
        message: 'Savings account permanently deleted. An immutable audit record was archived.',
        auditLogId: result.auditLogId,
      });
    } catch (error: any) {
      if (error.message === 'Savings account not found') return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Read-only listing of the org's immutable hard-delete audit trail
   * (admin only). Rows are append-only (DO INSTEAD NOTHING rules), newest
   * first. Includes the full JSON snapshot for forensic review.
   */
  static async listDeletionLogs(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const db = getDb();
      if (!db) return res.status(503).json({ error: 'Database not connected.' });
      const logs = await db
        .select()
        .from(auditDeletionLogs)
        .where(eq(auditDeletionLogs.organizationId, organizationId))
        .orderBy(desc(auditDeletionLogs.createdAt));
      res.json({ success: true, logs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
