import { Response } from 'express';
import { SubscriptionService, ApiError } from '../services/SubscriptionService';
import type { AuthRequest } from '../middleware/authMiddleware';

const subscriptionService = new SubscriptionService();

function handleError(res: Response, error: any) {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  console.error('[SubscriptionController] ERROR:', JSON.stringify({
    message: error?.message,
    code: error?.code,
    detail: error?.detail,
    hint: error?.hint,
    stack: error?.stack?.split('\n').slice(0, 8),
  }));
  return res.status(500).json({ error: error.message || 'Internal server error', detail: error?.detail, code: error?.code });
}

export class SubscriptionController {
  // ── Plans ──────────────────────────────────────────────────────────────
  static async listPlans(_req: AuthRequest, res: Response) {
    try {
      const plans = await subscriptionService.listPlans();
      res.json(plans);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getPlan(req: AuthRequest, res: Response) {
    try {
      const plan = await subscriptionService.getPlan(req.params.id);
      if (!plan) return res.status(404).json({ error: 'Plan not found' });
      res.json(plan);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async createPlan(req: AuthRequest, res: Response) {
    try {
      const plan = await subscriptionService.createPlan({
        ...req.body,
        createdBy: req.user?.authUserId ?? req.user?.userId,
      });
      res.status(201).json(plan);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async updatePlan(req: AuthRequest, res: Response) {
    try {
      const plan = await subscriptionService.updatePlan(req.params.id, {
        ...req.body,
        updatedBy: req.user?.authUserId ?? req.user?.userId,
      });
      res.json(plan);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async deletePlan(req: AuthRequest, res: Response) {
    try {
      const result = await subscriptionService.deletePlan(req.params.id);
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Organization Subscriptions ─────────────────────────────────────────
  static async getOrgSubscriptions(req: AuthRequest, res: Response) {
    try {
      const result = await subscriptionService.getOrgSubscriptions({
        search: req.query.search as string | undefined,
        planCode: req.query.planCode as string | undefined,
        status: req.query.status as string | undefined,
      });
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async changeOrgPlan(req: AuthRequest, res: Response) {
    try {
      const { planCode } = req.body;
      if (!planCode) return res.status(400).json({ error: 'planCode is required' });
      const result = await subscriptionService.changeOrgPlan(req.params.orgId, planCode);
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────
  static async getSubscriptionStats(_req: AuthRequest, res: Response) {
    try {
      const stats = await subscriptionService.getSubscriptionStats();
      res.json(stats);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getPlanUsage(_req: AuthRequest, res: Response) {
    try {
      const usage = await subscriptionService.getPlanUsage();
      res.json(usage);
    } catch (error: any) {
      handleError(res, error);
    }
  }
}
