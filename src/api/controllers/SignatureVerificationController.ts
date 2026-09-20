/**
 * Signature Verification Controller
 *
 * Teller/authorizer endpoints for the withdrawal-security pipeline:
 *   - POST /signature/verify                live comparison vs specimen on file (logged)
 *   - GET  /savings/accounts/:id/specimens  active specimens + fallback signature
 *   - POST /savings/accounts/:id/specimens  capture a signatory specimen
 *   - GET  /savings/accounts/:id/signature-logs  immutable verification activity
 *   - POST /savings/accounts/:id/passbook-reconcile  passbook gate for passbook-mode
 *
 * Multi-tenancy: organizationId from the verified JWT; branch scoping via
 * getBranchScope; every comparison is persisted server-side.
 */
import { Response } from 'express';
import { z } from 'zod';
import { SignatureVerificationService } from '../services/SignatureVerificationService';
import { SettingsActor } from '../utils/audit';
import { requireOrg, getBranchScope, resolveBranchForCreate, ScopeError } from '../middleware/scope';
import type { AuthRequest } from '../middleware/authMiddleware';

const service = new SignatureVerificationService();

function reqActor(req: AuthRequest): SettingsActor {
  return {
    organizationId: req.user?.organizationId || '',
    userId: req.user?.userId,
    username: req.user?.username,
    role: req.user?.role,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

const isNotFound = (message: string) => message.includes('not found') || message.includes('does not exist');

export class SignatureVerificationController {
  /** Live signature comparison — returns match score, verdict band, and the persisted log id. */
  static async verifySignature(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const branchId = await resolveBranchForCreate(req, req.body.branchId);
      const result = await service.verifyAndLog(req.body, organizationId, branchId, reqActor(req));
      res.json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async listSpecimens(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const result = await service.listSpecimens(
        req.params.id,
        organizationId,
        scope.isOrgAdmin ? undefined : scope.branchIds,
      );
      res.json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async captureSpecimen(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const branchId = await resolveBranchForCreate(req, req.body.branchId);
      const result = await service.captureSpecimen(
        req.params.id,
        req.body,
        organizationId,
        branchId,
        reqActor(req),
      );
      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async listVerificationActivity(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const limit = parseInt(String(req.query.limit || '20'), 10);
      const result = await service.listVerificationActivity(
        req.params.id,
        organizationId,
        scope.isOrgAdmin ? undefined : scope.branchIds,
        Number.isFinite(limit) ? Math.min(100, Math.max(1, limit)) : 20,
      );
      res.json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  /** Passbook-mode gate — verifies serial + last-printed line against the system marker. */
  static async reconcilePassbook(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const result = await service.reconcilePassbook(
        req.params.id,
        organizationId,
        scope.isOrgAdmin ? undefined : scope.branchIds,
        req.body,
      );
      res.json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }
}

// =============================================================
// Validation schemas
// =============================================================

export const signatureVerifySchema = z.object({
  body: z.object({
    accountId: z.string().uuid(),
    memberId: z.string().uuid(),
    presentedImageUrl: z.string().min(1),
    specimenId: z.string().uuid().nullable().optional(),
    providerId: z.string().optional(),
    branchId: z.string().uuid().optional(),
  }),
});

export const captureSpecimenSchema = z.object({
  body: z.object({
    memberId: z.string().uuid(),
    imageUrl: z.string().min(1),
    signatoryName: z.string().optional(),
    signingRule: z.enum(['any', 'all', 'specific']).optional(),
    capturedVia: z.string().optional(),
    branchId: z.string().uuid().optional(),
  }),
});

export const passbookReconcileSchema = z.object({
  body: z.object({
    bookSerial: z.string().optional(),
    bookLastLine: z.coerce.number().int().nonnegative().optional(),
    lastPrintedLineFromBook: z.coerce.number().int().nonnegative().optional(),
  }),
});