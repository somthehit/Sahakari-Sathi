/**
 * Passbook Controller
 *
 * HTTP surface for the passbook subsystem: print-layout designs, physical
 * booklet issuance/renewal, the two-step print flow (build payload → confirm),
 * and the print-log records. Multi-tenancy: organizationId always from the JWT;
 * branch scoping via getBranchScope. Write-role enforcement is applied at the
 * route layer (mirrors cheque-designs).
 */
import { Response } from 'express';
import { PassbookService } from '../services/PassbookService';
import { SettingsActor } from '../utils/audit';
import { requireOrg, getBranchScope, ScopeError } from '../middleware/scope';
import type { AuthRequest } from '../middleware/authMiddleware';
import {
  passbookDesignSchema,
  passbookDesignUpdateSchema,
  issuePassbookBookSchema,
  renewPassbookBookSchema,
  buildPrintPayloadSchema,
  confirmPrintSchema,
  voidPrintRunSchema,
} from '../schemas/passbookSetting';

const service = new PassbookService();

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

/** Map a thrown error to a status code, honoring an explicit err.status. */
function fail(res: Response, error: any, fallback = 500) {
  if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
  if (typeof error?.status === 'number') return res.status(error.status).json({ error: error.message });
  if (isNotFound(error?.message || '')) return res.status(404).json({ error: error.message });
  return res.status(fallback).json({ error: error?.message || 'Request failed' });
}

const branchIdsFor = (req: AuthRequest) => {
  const scope = getBranchScope(req);
  return scope.isOrgAdmin ? undefined : scope.branchIds;
};

export class PassbookController {
  // ── Print layouts (design studio) ──────────────────────────────

  static async listDesigns(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const rows = await service.listDesigns(organizationId, req.query.includeInactive === 'true');
      res.json(rows);
    } catch (error: any) { fail(res, error); }
  }

  static async getDesign(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const row = await service.getDesign(req.params.id, organizationId);
      res.json(row);
    } catch (error: any) { fail(res, error); }
  }

  static async createDesign(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const parsed = passbookDesignSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid passbook design payload', details: parsed.error.format() });
      // Designs are org-level templates; branch is optional (defaults to the creator's branch).
      const defaultBranch = (req.user as any)?.branchId ?? null;
      const created = await service.createDesign(organizationId, parsed.data.branchId ?? defaultBranch, req.user?.userId ?? null, parsed.data);
      res.status(201).json(created);
    } catch (error: any) { fail(res, error, 400); }
  }

  static async updateDesign(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const parsed = passbookDesignUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid passbook design payload', details: parsed.error.format() });
      const updated = await service.updateDesign(req.params.id, organizationId, req.user?.userId ?? null, parsed.data);
      res.json(updated);
    } catch (error: any) { fail(res, error, 400); }
  }

  static async deleteDesign(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.deleteDesign(req.params.id, organizationId);
      res.json({ ...result, message: 'Passbook design deleted.' });
    } catch (error: any) { fail(res, error); }
  }

  // ── Booklets ────────────────────────────────────────────────────

  static async listBooks(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const rows = await service.listBooks(req.params.id, organizationId, branchIdsFor(req));
      res.json(rows);
    } catch (error: any) { fail(res, error); }
  }

  static async issueBook(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const parsed = issuePassbookBookSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid passbook issuance payload', details: parsed.error.format() });
      const book = await service.issueBook(req.params.id, organizationId, branchIdsFor(req), reqActor(req), parsed.data);
      res.status(201).json(book);
    } catch (error: any) { fail(res, error, 400); }
  }

  static async renewBook(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const parsed = renewPassbookBookSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid passbook renewal payload', details: parsed.error.format() });
      const book = await service.renewBook(req.params.id, organizationId, branchIdsFor(req), reqActor(req), parsed.data);
      res.status(201).json(book);
    } catch (error: any) { fail(res, error, 400); }
  }

  // ── Print flow ──────────────────────────────────────────────────

  static async buildPrintPayload(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const parsed = buildPrintPayloadSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid print request', details: parsed.error.format() });
      const payload = await service.buildPrintPayload(req.params.id, organizationId, branchIdsFor(req), {
        mode: parsed.data.mode,
        designId: parsed.data.designId ?? null,
        rangeMode: parsed.data.rangeMode,
        fromDateBs: parsed.data.fromDateBs,
        toDateBs: parsed.data.toDateBs,
      });
      res.json(payload);
    } catch (error: any) { fail(res, error, 400); }
  }

  static async confirmPrint(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const parsed = confirmPrintSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid confirm-print payload', details: parsed.error.format() });
      const result = await service.confirmPrint(req.params.id, organizationId, branchIdsFor(req), reqActor(req), parsed.data);
      res.json(result);
    } catch (error: any) { fail(res, error, 400); }
  }

  static async listPrintLog(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const rows = await service.listPrintLog(req.params.id, organizationId, branchIdsFor(req));
      res.json(rows);
    } catch (error: any) { fail(res, error); }
  }

  static async voidPrintRun(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const parsed = voidPrintRunSchema.safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ error: 'Invalid void payload', details: parsed.error.format() });
      const result = await service.voidPrintRun(req.params.logId, organizationId, branchIdsFor(req), reqActor(req), parsed.data.reason);
      res.json(result);
    } catch (error: any) { fail(res, error, 400); }
  }
}
