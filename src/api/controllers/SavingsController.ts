import { Response } from 'express';
import { SavingsService } from '../services/SavingsService';
import { requireOrg, assertBranchInOrg, getBranchScope, resolveBranchForCreate, ScopeError } from '../middleware/scope';
import type { AuthRequest } from '../middleware/authMiddleware';
import { z } from 'zod';

const savingsService = new SavingsService();

export class SavingsController {
  
  static async getAccounts(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const { search, branchId, memberId, productType, status, page, limit } = req.query;
      if (branchId) await assertBranchInOrg(organizationId, branchId as string);

      const scope = getBranchScope(req);
      const result = await savingsService.getAccounts({
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

  static async getAccount(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const account = await savingsService.getAccountById(
        req.params.id,
        organizationId,
        scope.isOrgAdmin ? undefined : scope.branchIds
      );
      res.json(account);
    } catch (error: any) {
      if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async openAccount(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      req.body.branchId = await resolveBranchForCreate(req, req.body.branchId);
      const account = await savingsService.openAccount(req.body, organizationId);
      res.status(201).json(account);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async processTransaction(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      req.body.branchId = await resolveBranchForCreate(req, req.body.branchId);
      const transaction = await savingsService.processTransaction(
        req.body,
        organizationId,
        scope.isOrgAdmin ? undefined : scope.branchIds
      );
      res.status(201).json(transaction);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async getTransactions(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const transactions = await savingsService.getAccountTransactions(
        req.params.id,
        organizationId,
        scope.isOrgAdmin ? undefined : scope.branchIds
      );
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getStatement(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const { dateFromBs, dateToBs, type } = req.query;
      const statement = await savingsService.getAccountStatement(
        req.params.id,
        organizationId,
        scope.isOrgAdmin ? undefined : scope.branchIds,
        {
          dateFromBs: (dateFromBs as string) || undefined,
          dateToBs: (dateToBs as string) || undefined,
          type: (type as string) || undefined,
        }
      );
      res.json(statement);
    } catch (error: any) {
      if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
}

// Validation schemas
export const openAccountSchema = z.object({
  body: z.object({
    memberId: z.string().uuid(),
    productType: z.enum(['regular', 'recurring', 'fixed', 'daily_deposit']),
    branchId: z.string().uuid(),
  })
});

export const transactionSchema = z.object({
  body: z.object({
    accountId: z.string().uuid(),
    memberId: z.string().uuid(),
    type: z.enum(['Deposit', 'Withdrawal', 'Interest_Posting', 'Transfer_In', 'Transfer_Out']),
    amount: z.string().or(z.number()),
    voucherNo: z.string(),
    dateBs: z.string(),
    dateAd: z.string(),
    tellerName: z.string(),
    paymentMode: z.enum(['Cash', 'Bank_Transfer', 'Internal_Transfer', 'Collection_Agent']),
    branchId: z.string().uuid(),
  })
});
