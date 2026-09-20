/**
 * Share Controller
 * HTTP handlers for share types, holdings, transactions, certificates.
 * All routes are org-scoped via req.user.organizationId.
 */
import { Request, Response } from 'express';
import { ShareService } from '../services/ShareService';
import { ShareCeilingError } from '../services/shareCeilingEngine';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/authMiddleware';
import { shareTransactionRequestSchema } from '../../lib/validations/shareTransaction';

export { shareTransactionRequestSchema };

const shareService = new ShareService();

function getOrg(req: AuthRequest): string {
  const orgId = req.user?.organizationId;
  if (!orgId) throw new Error('Organization context is required');
  return orgId;
}

function getUser(req: AuthRequest): string {
  return req.user?.username || req.user?.userId || 'unknown';
}

export class ShareController {
  // ============================================================
  // Overview
  // ============================================================
  static async getSummary(req: AuthRequest, res: Response) {
    try {
      const summary = await shareService.getSummary(getOrg(req));
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================================
  // Share Types
  // ============================================================
  static async getTypes(req: AuthRequest, res: Response) {
    try {
      res.json(await shareService.getTypes(getOrg(req)));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getType(req: AuthRequest, res: Response) {
    try {
      res.json(await shareService.getTypeById(getOrg(req), req.params.id));
    } catch (error: any) {
      if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async createType(req: AuthRequest, res: Response) {
    try {
      const type = await shareService.createType(getOrg(req), req.body);
      res.status(201).json(type);
    } catch (error: any) {
      if (error instanceof ShareCeilingError) return res.status(422).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async updateType(req: AuthRequest, res: Response) {
    try {
      const type = await shareService.updateType(getOrg(req), req.params.id, req.body);
      if (!type) throw new Error('Share type not found');
      res.json(type);
    } catch (error: any) {
      if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
      if (error instanceof ShareCeilingError) return res.status(422).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async deleteType(req: AuthRequest, res: Response) {
    try {
      res.json(await shareService.deleteType(getOrg(req), req.params.id));
    } catch (error: any) {
      if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================================
  // Holdings (register)
  // ============================================================
  static async getHoldings(req: AuthRequest, res: Response) {
    try {
      const { search, status, shareTypeId, memberId, page, limit } = req.query;
      const result = await shareService.getHoldings(getOrg(req), {
        search: search as string,
        status: status as string,
        shareTypeId: shareTypeId as string,
        memberId: memberId as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================================
  // Transactions
  // ============================================================
  static async getTransactions(req: AuthRequest, res: Response) {
    try {
      const { memberId, holdingId, limit } = req.query;
      const transactions = await shareService.getTransactions(getOrg(req), {
        memberId: memberId as string,
        holdingId: holdingId as string,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================================
  // Certificates
  // ============================================================
  static async getCertificates(req: AuthRequest, res: Response) {
    try {
      const { memberId, limit } = req.query;
      const certificates = await shareService.getCertificates(getOrg(req), {
        memberId: memberId as string,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      res.json(certificates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Real member share certificate data — aggregates active holdings (total
   * kitta, paid-up capital, face value) and derives the distinctive kitta
   * range for a member (optionally for a specific certificate).
   * GET /api/v1/shares/certificate/:memberId?certificateId=...
   */
  static async getMemberShareCertificateData(req: AuthRequest, res: Response) {
    try {
      const { memberId } = req.params;
      const certificateId = req.query.certificateId as string | undefined;
      const data = await shareService.getMemberShareCertificateData(getOrg(req), memberId, certificateId);
      res.json(data);
    } catch (error: any) {
      if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================================
  // Transfer Registry (audit trail + printable documents)
  // ============================================================
  static async getTransfers(req: AuthRequest, res: Response) {
    try {
      const { limit } = req.query;
      const transfers = await shareService.getTransfers(getOrg(req), {
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      res.json(transfers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================================
  // Share Register (auto-provisioned master accounts)
  // ============================================================
  /** Searchable member share register with estimated dividend. GET /shares/register */
  static async getShareRegister(req: AuthRequest, res: Response) {
    try {
      const { search, status } = req.query;
      const register = await shareService.getShareRegister(getOrg(req), {
        search: search as string | undefined,
        status: status as string | undefined,
      });
      res.json(register);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** Master share account + kitta-range history for a member. GET /shares/accounts/:memberId */
  static async getShareAccount(req: AuthRequest, res: Response) {
    try {
      const detail = await shareService.getShareAccount(getOrg(req), req.params.memberId);
      res.json(detail);
    } catch (error: any) {
      if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /** Org-wide share ceilings + running totals. GET /shares/settings */
  static async getOrgShareSettings(req: AuthRequest, res: Response) {
    try {
      res.json(await shareService.getOrgShareSettings(getOrg(req)));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** Update org-wide ceilings. PUT /shares/settings */
  static async updateOrgShareSettings(req: AuthRequest, res: Response) {
    try {
      res.json(await shareService.updateOrgShareSettings(getOrg(req), req.body));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /** Active members who have not yet opened a share account. GET /shares/unprovisioned-members */
  static async getUnprovisionedMembers(req: AuthRequest, res: Response) {
    try {
      const { search } = req.query;
      res.json(await shareService.getUnprovisionedMembers(getOrg(req), search as string | undefined));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** Nominee register for a member's share account. GET /shares/accounts/:memberId/nominees */
  static async getShareAccountNominees(req: AuthRequest, res: Response) {
    try {
      res.json(await shareService.getShareAccountNominees(getOrg(req), req.params.memberId));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getTransfer(req: AuthRequest, res: Response) {
    try {
      const detail = await shareService.getTransferDetail(getOrg(req), req.params.id);
      res.json(detail);
    } catch (error: any) {
      if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================================
  // Mutations
  // ============================================================
  static async issueShares(req: AuthRequest, res: Response) {
    try {
      const result = await shareService.issueShares(getOrg(req), req.body, getUser(req));
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /** Open a member's FIRST share account with a nominee register. POST /shares/open-account */
  static async openShareAccount(req: AuthRequest, res: Response) {
    try {
      const result = await shareService.openShareAccount(getOrg(req), req.body, getUser(req));
      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof ShareCeilingError) return res.status(422).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async transferShares(req: AuthRequest, res: Response) {
    try {
      const result = await shareService.transferShares(getOrg(req), req.body, getUser(req));
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async surrenderShares(req: AuthRequest, res: Response) {
    try {
      const { holdingId } = req.params;
      const { numberOfShares, remarks } = req.body;
      const result = await shareService.surrenderShares(getOrg(req), holdingId, Number(numberOfShares), getUser(req), remarks);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ============================================================
  // Unified Issue / Return transaction
  // ============================================================
  static async processShareTransaction(req: AuthRequest, res: Response) {
    try {
      const result = await shareService.processShareTransaction(getOrg(req), req.body, getUser(req));
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

// ============================================================
// Validation schemas
// ============================================================
export const createShareTypeSchema = z.object({
  body: z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    faceValue: z.number().positive(),
    minShares: z.number().int().positive().optional(),
    maxShares: z.number().int().positive().optional().nullable(),
    isTransferable: z.boolean().optional(),
    isPledgeable: z.boolean().optional(),
    dividendRate: z.number().nonnegative().optional(),
    kittaPrefix: z.string().max(20).optional(),
    kittaStartBase: z.number().int().positive().optional().nullable(),
    currentKittaPointer: z.number().int().nonnegative().optional(),
    maxAllowedKitta: z.number().int().positive().optional().nullable(),
    autoSequence: z.boolean().optional(),
    status: z.enum(['Active', 'Inactive']).optional(),
    description: z.string().optional().nullable(),
  }),
});

export const issueSharesSchema = z.object({
  body: z.object({
    memberId: z.string().uuid(),
    shareTypeId: z.string().uuid(),
    numberOfShares: z.number().int().positive(),
    dateBs: z.string().optional(),
    dateAd: z.string().optional(),
    remarks: z.string().optional(),
    branchId: z.string().uuid().optional(),
    paymentAccountId: z.string().uuid().optional().nullable(),
    manualStartKitta: z.number().int().positive().optional().nullable(),
    manualEndKitta: z.number().int().positive().optional().nullable(),
  }),
});

export const transferSharesSchema = z.object({
  body: z.object({
    fromHoldingId: z.string().uuid(),
    toMemberId: z.string().uuid(),
    numberOfShares: z.number().int().positive(),
    dateBs: z.string().optional(),
    dateAd: z.string().optional(),
    remarks: z.string().optional(),
    branchId: z.string().uuid().optional(),
  }),
});

export const surrenderSharesSchema = z.object({
  body: z.object({
    numberOfShares: z.number().int().positive(),
    remarks: z.string().optional(),
  }),
});

const openShareAccountNomineeSchema = z.object({
  fullName: z.string().min(1, 'Nominee name is required'),
  relation: z.string().min(1, 'Nominee relation is required'),
  citizenshipNo: z.string().optional().nullable(),
  contactNo: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  sharePercentage: z.coerce.number().positive('Share percentage must be positive').max(100, 'Share percentage cannot exceed 100'),
  isPrimary: z.boolean().optional(),
});

export const openShareAccountSchema = z.object({
  body: z.object({
    memberId: z.string().uuid('Member is required'),
    shareTypeId: z.string().uuid('Share type is required'),
    numberOfShares: z.coerce.number().int('Initial kitta must be a whole number').positive('Initial kitta must be positive'),
    dateBs: z.string().optional(),
    dateAd: z.string().optional(),
    remarks: z.string().max(500, 'Remarks must be under 500 characters').optional().nullable(),
    branchId: z.string().uuid().optional().nullable(),
    paymentAccountId: z.string().uuid().optional().nullable(),
    manualStartKitta: z.coerce.number().int().positive().optional().nullable(),
    manualEndKitta: z.coerce.number().int().positive().optional().nullable(),
    minRequiredKitta: z.coerce.number().int().positive().optional().nullable(),
    nominees: z.array(openShareAccountNomineeSchema).min(1, 'At least one nominee (हकवाला) is required'),
  }).superRefine((data, ctx) => {
    const total = data.nominees.reduce((sum, n) => sum + Number(n.sharePercentage), 0);
    if (Math.abs(total - 100) > 0.01) {
      ctx.addIssue({
        code: 'custom',
        path: ['nominees'],
        message: `Nominee percentages must total exactly 100% — current total is ${total.toFixed(2)}%`,
      });
    }
    const primaryCount = data.nominees.filter((n) => n.isPrimary).length;
    if (primaryCount !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['nominees'],
        message: 'Exactly one nominee must be marked as the primary (पहिलो हकवाला)',
      });
    }
    const hasStart = data.manualStartKitta != null;
    const hasEnd = data.manualEndKitta != null;
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: 'custom',
        path: ['manualStartKitta'],
        message: 'Both the manual kitta start and end must be provided together.',
      });
    }
    if (hasStart && hasEnd && Number(data.manualStartKitta) > Number(data.manualEndKitta)) {
      ctx.addIssue({
        code: 'custom',
        path: ['manualStartKitta'],
        message: 'Manual kitta start cannot exceed end.',
      });
    }
  }),
});
