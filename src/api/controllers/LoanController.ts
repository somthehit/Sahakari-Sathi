import { Response } from 'express';
import { LoanService } from '../services/LoanService';
import { LoanEligibilityService } from '../services/LoanEligibilityService';
import { requireOrg, assertBranchInOrg, getBranchScope, resolveBranchForCreate, ScopeError } from '../middleware/scope';
import type { AuthRequest } from '../middleware/authMiddleware';
import { z } from 'zod';

const loanService = new LoanService();
const loanEligibilityService = new LoanEligibilityService();

export class LoanController {
  
  static async getLoans(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const { search, branchId, memberId, productType, status, page, limit } = req.query;
      if (branchId) await assertBranchInOrg(organizationId, branchId as string);

      const scope = getBranchScope(req);
      const result = await loanService.getLoans({
        organizationId,
        search: search as string,
        branchId: branchId as string,
        branchIds: scope.isOrgAdmin ? undefined : scope.branchIds,
        memberId: memberId as string,
        productType: productType as string,
        status: status as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      res.json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async getLoan(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const loan = await loanService.getLoanById(
        req.params.id,
        organizationId,
        scope.isOrgAdmin ? undefined : scope.branchIds
      );
      res.json(loan);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  static async applyForLoan(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      req.body.branchId = await resolveBranchForCreate(req, req.body.branchId);
      const loan = await loanService.applyForLoan(req.body, organizationId, {
        overrideReason: req.body.overrideReason,
        actorRole: req.user?.role,
        userId: req.user?.userId,
      });
      res.status(201).json(loan);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      const status = error.status === 422 ? 422 : 400;
      res.status(status).json({ error: error.message, code: error.code, reasons: error.reasons, checks: error.checks });
    }
  }

  /** Pre-flight eligibility check for the loan-origination wizard. */
  static async checkEligibility(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const decision = await loanEligibilityService.evaluate(
        organizationId,
        req.params.memberId,
        req.params.productId
      );
      res.json(decision);
    } catch (error: any) {
      if (error.message === 'Loan product not found.' || error.message === 'Member not found.') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  static async processRepayment(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const repayment = await loanService.processRepayment(
        req.body,
        organizationId,
        scope.isOrgAdmin ? undefined : scope.branchIds
      );
      res.status(201).json(repayment);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }
}

// Validation schemas
export const applyLoanSchema = z.object({
  body: z.object({
    memberId: z.string().uuid(),
    productType: z.enum(['general', 'business', 'agriculture', 'emergency', 'hire_purchase']),
    loanProductId: z.string().uuid().nullish(),
    appliedAmount: z.string().or(z.number()),
    tenureMonths: z.number().int().min(1).max(360).nullish(),
    branchId: z.string().uuid(),
    overrideReason: z.string().max(500).nullish(),
  })
});

export const checkEligibilitySchema = z.object({
  params: z.object({
    memberId: z.string().uuid(),
    productId: z.string().uuid(),
  }),
});

const nonNegativeAmount = z.union([
  z.number().min(0),
  z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: 'Must be a valid non-negative number',
  }),
]);

export const repayLoanSchema = z.object({
  body: z.object({
    loanId: z.string().uuid(),
    memberId: z.string().uuid(),
    receiptNo: z.string().min(1),
    principalPaid: nonNegativeAmount,
    interestPaid: nonNegativeAmount,
    penaltyPaid: nonNegativeAmount.optional().default('0'),
    paymentMode: z.enum(['Cash', 'Bank_Transfer']),
    dateBs: z.string(),
    dateAd: z.string(),
    collectedBy: z.string().min(1),
    branchId: z.string().uuid(),
    voucherNo: z.string().optional(),
  }),
});
