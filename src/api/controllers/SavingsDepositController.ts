/**
 * Savings & Deposits Teller Controller
 *
 * Teller-facing operations on top of the savings domain:
 *   - account lookup / member search / nominees / schemes (Open Account page)
 *   - open savings account
 *   - teller deposit (cash / bank → immediate credit; cheque → pending clearance)
 *   - teller withdrawal (instrument validation + dual-approval queue)
 *   - cheque deposit clearing / bounce
 *   - account ledger + passbook printing
 *
 * Multi-tenancy: organizationId always comes from the verified JWT. Branch
 * scoping via getBranchScope / resolveBranchForCreate.
 */
import { Response } from 'express';
import { z } from 'zod';
import { SavingsDepositService } from '../services/SavingsDepositService';
import { SettingsActor } from '../utils/audit';
import {
  requireOrg,
  assertBranchInOrg,
  getBranchScope,
  resolveBranchForCreate,
  ScopeError,
} from '../middleware/scope';
import type { AuthRequest } from '../middleware/authMiddleware';

const service = new SavingsDepositService();

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

export class SavingsDepositController {
  // ─────────────────────────────────────────────
  // Lookups (Open Account / teller pages)
  // ─────────────────────────────────────────────

  static async lookupAccounts(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const accounts = await service.lookupAccounts(
        organizationId,
        (req.query.q as string) || '',
        scope.isOrgAdmin ? undefined : scope.branchIds,
      );
      res.json(accounts.map((a) => ({
        id: a.id,
        accountNumber: a.accountNo,
        memberId: a.memberId,
        memberName: a.memberName,
        memberNo: a.memberNo,
        productName: a.productName,
        balance: Number(a.balance),
        minBalance: Number(a.minBalance),
        status: (a.status || 'Active').toLowerCase(),
        kycStatus: a.kycStatus,
        memberStatus: a.memberStatus,
      })));
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async searchMembers(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const members = await service.searchMembers(
        organizationId,
        (req.query.q as string) || '',
        scope.isOrgAdmin ? undefined : scope.branchIds,
      );
      res.json(members);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async getMemberNominees(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const nominees = await service.getMemberNominees(req.params.id, organizationId);
      res.json(nominees);
    } catch (error: any) {
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async listSchemes(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const schemes = await service.listSchemes(
        organizationId,
        (req.query.memberTypeId as string) || undefined,
      );
      res.json(schemes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────
  // Task 1 — Open savings account
  // ─────────────────────────────────────────────

  static async openAccount(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const branchId = await resolveBranchForCreate(req, req.body.branchId);
      const account = await service.openAccount(req.body, organizationId, branchId, reqActor(req));
      res.status(201).json(account);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────
  // Account maintenance (Register → Edit / Manage Account)
  // ─────────────────────────────────────────────

  static async updateAccount(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const account = await service.updateAccount(
        req.params.id,
        organizationId,
        scope.isOrgAdmin ? undefined : scope.branchIds,
        req.body,
        reqActor(req),
      );
      res.json(account);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────
  // Task 2 — Teller deposit
  // ─────────────────────────────────────────────

  static async recordDeposit(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const branchId = await resolveBranchForCreate(req, req.body.branchId);
      const result = await service.recordDeposit(req.body, organizationId, branchId, reqActor(req));
      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async recordBatchDeposits(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const branchId = await resolveBranchForCreate(req, req.body.branchId);
      const result = await service.recordBatchDeposits(req.body.entries, organizationId, branchId, reqActor(req));
      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────
  // Task 3 — Teller withdrawal + approval queue
  // ─────────────────────────────────────────────

  static async recordWithdrawal(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const branchId = await resolveBranchForCreate(req, req.body.branchId);
      const result = await service.recordWithdrawal(req.body, organizationId, branchId, reqActor(req));
      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async listPendingWithdrawals(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const result = await service.listPendingWithdrawals(
        organizationId,
        scope.isOrgAdmin ? undefined : scope.branchIds,
        (req.query.status as string) || undefined,
      );
      res.json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async approveWithdrawal(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const branchId = await resolveBranchForCreate(req, req.body.branchId);
      const result = await service.approveWithdrawal(req.params.id, organizationId, branchId, reqActor(req));
      res.json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async rejectWithdrawal(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.rejectWithdrawal(req.params.id, organizationId, reqActor(req), req.body?.remarks);
      res.json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────
  // Cheque deposits (pending clearance)
  // ─────────────────────────────────────────────

  static async listChequeDeposits(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const result = await service.listChequeDeposits(
        organizationId,
        scope.isOrgAdmin ? undefined : scope.branchIds,
        (req.query.status as string) || undefined,
        (req.query.accountId as string) || undefined,
      );
      res.json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async clearChequeDeposit(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const branchId = await resolveBranchForCreate(req, req.body.branchId);
      const result = await service.clearChequeDeposit(req.params.id, organizationId, branchId, reqActor(req));
      res.json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async bounceChequeDeposit(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.bounceChequeDeposit(
        req.params.id,
        organizationId,
        reqActor(req),
        req.body?.reason,
      );
      res.json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Internal cheque transfer — a cheque drawn on ANOTHER member's savings
   * account (re-resolved server-side from the cheque leaf) settles instantly:
   * drawer debited, depositor credited, leaf → cleared, Journal voucher posted.
   */
  static async postChequeTransfer(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const branchId = await resolveBranchForCreate(req, req.body.branchId);
      const result = await service.postChequeTransfer(
        {
          depositAccountId: req.body.depositAccountId,
          chequeNumber: req.body.chequeNumber,
          amount: req.body.amount,
          bsDate: req.body.bsDate,
        },
        organizationId,
        branchId,
        reqActor(req),
      );
      res.json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  /** Validate a cheque leaf (used by the teller withdrawal form). */
  static async validateChequeLeaf(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.validateChequeLeaf(req.params.chequeNumber, organizationId);

      // Bank cheque fallback — already returns a compatible shape
      if ((result as any).isBankCheque) {
        const r = result as any;
        return res.json({
          chequeNumber: r.leaf.chequeNumber,
          leafNo: r.leaf.leafNo,
          status: r.leaf.status,
          bookNumber: r.book?.bookNumber ?? null,
          bookStatus: r.book?.status ?? null,
          accountId: r.leaf.accountId,
          valid: r.leaf.status === 'unused' && (r.book ? r.book.status === 'active' : true),
          chequeDateBs: r.leaf.chequeDateBs ?? null,
          dateValidity: null,
          duplicatePresentment: null,
          drawer: r.drawer,
          isBankCheque: true,
        });
      }

      const { leaf, book, drawer, dateValidity, duplicatePresentment } = result as any;
      res.json({
        chequeNumber: leaf.chequeNumber,
        leafNo: leaf.leafNo,
        status: leaf.status,
        bookNumber: book?.bookNumber ?? null,
        bookStatus: book?.status ?? null,
        accountId: leaf.accountId,
        valid: leaf.status === 'unused' && (book ? book.status === 'active' : true),
        // Withdrawal-security enrichment:
        chequeDateBs: leaf.chequeDateBs ?? null,
        dateValidity,
        duplicatePresentment: duplicatePresentment
          ? {
              dateBs: duplicatePresentment.dateBs,
              amount: Number(duplicatePresentment.amount),
              voucherNo: duplicatePresentment.voucherNo,
            }
          : null,
        drawer: drawer
          ? {
              accountId: drawer.id,
              accountNo: drawer.accountNo,
              memberId: drawer.memberId,
              memberName: drawer.memberName,
              balance: Number(drawer.balance),
              minBalance: Number(drawer.minBalance),
              status: (drawer.status || 'Active').toLowerCase(),
            }
          : null,
      });
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────
  // Task 4 — Account ledger
  // ─────────────────────────────────────────────

  static async getLedger(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const ledger = await service.getLedger(req.params.id, organizationId, scope.isOrgAdmin ? undefined : scope.branchIds, {
        from: (req.query.from as string) || undefined,
        to: (req.query.to as string) || undefined,
        txnType: (req.query.txnType as string) || undefined,
      });
      res.json(ledger);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────
  // Task 5 — Passbook printer
  // ─────────────────────────────────────────────

  static async getPassbookSummary(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const summary = await service.getPassbookSummary(req.params.id, organizationId, scope.isOrgAdmin ? undefined : scope.branchIds);
      res.json(summary);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async getUnprintedTransactions(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const lines = await service.getUnprintedTransactions(req.params.id, organizationId, scope.isOrgAdmin ? undefined : scope.branchIds, {
        from: (req.query.from as string) || undefined,
        to: (req.query.to as string) || undefined,
      });
      res.json(lines);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async printPassbook(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const result = await service.printPassbook(
        req.params.id,
        organizationId,
        scope.isOrgAdmin ? undefined : scope.branchIds,
        reqActor(req),
        { mode: req.body?.mode === 'custom' ? 'custom' : 'since_last', from: req.body?.from, to: req.body?.to },
      );
      res.json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (isNotFound(error.message)) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async testAlignment(req: AuthRequest, res: Response) {
    try {
      const pdfUrl = await service.testAlignmentPdf();
      res.json({ pdfUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async batchInterestPosting(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const result = await service.runBatchInterestPosting(
        organizationId,
        scope.isOrgAdmin ? undefined : scope.branchIds,
        reqActor(req),
        { period: req.body?.period || 'quarterly' },
      );
      res.json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }
}

// =============================================================
// Validation schemas (z.object({ body }) → validateRequest)
// =============================================================

const money = z.coerce.number().finite().nonnegative();

export const openAccountSchema = z.object({
  body: z.object({
    memberId: z.string().uuid(),
    schemeId: z.string().uuid(),
    branchId: z.string().uuid().optional(),
    openingDeposit: money.default(0),
    depositSource: z.enum(['cash', 'bank_transfer', 'internal_transfer']).optional(),
    nomineeId: z.string().uuid().nullable().optional(),
    isJoint: z.boolean().optional(),
    bsDate: z.string().optional(),
    // Signature specimen captured at account opening.
    specimenImageUrl: z.string().optional(),
    signatoryName: z.string().optional(),
    signingRule: z.enum(['any', 'all', 'specific']).optional(),
  }),
});

export const depositSchema = z.object({
  body: z.object({
    accountId: z.string().uuid(),
    amount: money,
    mode: z.enum(['cash', 'cheque', 'bank_transfer']),
    branchId: z.string().uuid().optional(),
    bsDate: z.string().optional(),
    cheque: z.object({
      number: z.string().min(1),
      bank: z.string().optional(),
      date: z.string().optional(),
    }).nullable().optional(),
    reference: z.string().optional(),
    remarks: z.string().optional(),
  }),
});

export const updateAccountSchema = z.object({
  body: z.object({
    status: z.enum(['Active', 'Dormant', 'Closed']).optional(),
    minBalance: money.optional(),
    interestRate: money.optional(),
  }),
});

export const chequeTransferSchema = z.object({
  body: z.object({
    depositAccountId: z.string().uuid(),
    chequeNumber: z.string().min(1),
    amount: money,
    branchId: z.string().uuid().optional(),
    bsDate: z.string().optional(),
  }),
});

export const batchDepositSchema = z.object({
  body: z.object({
    branchId: z.string().uuid().optional(),
    entries: z.array(z.object({
      accountId: z.string().uuid(),
      amount: money,
      mode: z.enum(['cash', 'cheque', 'bank_transfer']),
      bsDate: z.string().optional(),
      cheque: z.object({
        number: z.string().min(1),
        bank: z.string().optional(),
        date: z.string().optional(),
      }).nullable().optional(),
      reference: z.string().optional(),
      remarks: z.string().optional(),
    })).min(1),
  }),
});

export const withdrawalSchema = z.object({
  body: z.object({
    accountId: z.string().uuid(),
    amount: money,
    payoutMode: z.enum(['cash', 'cheque_issue', 'bank_transfer']),
    branchId: z.string().uuid().optional(),
    bsDate: z.string().optional(),
    instrument: z.object({
      type: z.enum(['cheque', 'slip', 'passbook']),
      chequeNumber: z.string().optional(),
      slipNumber: z.string().optional(),
      signatureVerified: z.boolean().optional(),
      passbookLastLine: z.string().optional(),
      verificationLogId: z.string().uuid().optional(),
      signatureOutcome: z.enum(['auto_approved', 'teller_override', 'supervisor_override']).optional(),
      overrideReason: z.string().optional(),
      passbookTampered: z.boolean().optional(),
      passbookReconciled: z.boolean().optional(),
    }).optional(),
  }),
});

export const withdrawalDecisionSchema = z.object({
  body: z.object({
    remarks: z.string().optional(),
  }),
});

export const printPassbookSchema = z.object({
  body: z.object({
    mode: z.enum(['since_last', 'custom']).default('since_last'),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});

export const bounceChequeDepositSchema = z.object({
  body: z.object({
    reason: z.string().optional(),
  }),
});

export const batchInterestPostingSchema = z.object({
  body: z.object({
    period: z.enum(['quarterly', 'monthly', 'annual']).optional().default('quarterly'),
  }),
});
