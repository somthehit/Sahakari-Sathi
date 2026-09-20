import { Response } from 'express';
import { AccountingService } from '../services/AccountingService';
import { requireOrg, assertBranchInOrg, getBranchScope, resolveBranchForCreate, getActorName, ScopeError } from '../middleware/scope';
import type { AuthRequest } from '../middleware/authMiddleware';
import { z } from 'zod';

const accountingService = new AccountingService();

export class AccountingController {
  
  static async getChartOfAccounts(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const coa = await accountingService.getChartOfAccounts(organizationId);
      res.json(coa);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getVouchers(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const { search, branchId, voucherType, status, fiscalYearCode, startDateBs, endDateBs, page, limit } = req.query;
      if (branchId) await assertBranchInOrg(organizationId, branchId as string);

      const scope = getBranchScope(req);
      const result = await accountingService.getVouchers({
        organizationId,
        search: search as string,
        branchId: branchId as string,
        branchIds: scope.isOrgAdmin ? undefined : scope.branchIds,
        voucherType: voucherType as string,
        status: status as string,
        fiscalYearCode: fiscalYearCode as string,
        startDateBs: startDateBs as string,
        endDateBs: endDateBs as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      res.json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async createVoucher(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const { voucher, entries } = req.body;
      voucher.branchId = await resolveBranchForCreate(req, voucher?.branchId);
      const created = await accountingService.createVoucher(voucher, entries, organizationId);
      res.status(201).json(created);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async postVoucher(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const approvedBy = getActorName(req);
      const scope = getBranchScope(req);
      const posted = await accountingService.postVoucher(
        req.params.id,
        organizationId,
        approvedBy,
        scope.isOrgAdmin ? undefined : scope.branchIds
      );
      res.json(posted);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async backfillLedgers(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await accountingService.backfillLedgers(organizationId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getLedgers(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const { fiscalYearCode, branchId } = req.query;
      const data = await accountingService.getLedgerData(
        organizationId,
        fiscalYearCode as string,
        branchId as string
      );
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
