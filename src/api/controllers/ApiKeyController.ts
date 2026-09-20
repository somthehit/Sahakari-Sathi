import { Response } from 'express';
import { ApiKeyService, ApiKeyError } from '../services/ApiKeyService';
import type { AuthRequest } from '../middleware/authMiddleware';

const apiKeyService = new ApiKeyService();

function handleError(res: Response, error: any) {
  if (error instanceof ApiKeyError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  console.error('[ApiKeyController] FULL ERROR:', JSON.stringify({
    message: error?.message,
    code: error?.code,
    detail: error?.detail,
    hint: error?.hint,
    stack: error?.stack?.split('\n').slice(0, 8),
  }));
  return res.status(500).json({ error: error.message || 'Internal server error', detail: error?.detail, code: error?.code });
}

export class ApiKeyController {
  static async listKeys(req: AuthRequest, res: Response) {
    try {
      const result = await apiKeyService.listKeys({
        status: req.query.status as string | undefined,
        organizationId: req.query.organizationId as string | undefined,
        search: req.query.search as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async createKey(req: AuthRequest, res: Response) {
    try {
      const createdBy = req.user?.username || req.user?.userId || 'unknown';
      const result = await apiKeyService.createKey(
        {
          name: req.body.name,
          scopes: req.body.scopes,
          rateLimit: req.body.rateLimit,
          organizationId: req.body.organizationId,
          expiresAt: req.body.expiresAt,
        },
        createdBy
      );
      res.status(201).json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getKey(req: AuthRequest, res: Response) {
    try {
      const key = await apiKeyService.getKeyById(req.params.id);
      res.json(key);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async revokeKey(req: AuthRequest, res: Response) {
    try {
      const result = await apiKeyService.revokeKey(req.params.id, req.body.reason);
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async deleteKey(req: AuthRequest, res: Response) {
    try {
      const result = await apiKeyService.deleteKey(req.params.id);
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async rotateKey(req: AuthRequest, res: Response) {
    try {
      const rotatedBy = req.user?.username || req.user?.userId || 'unknown';
      const result = await apiKeyService.rotateKey(req.params.id, rotatedBy);
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getKeyStats(req: AuthRequest, res: Response) {
    try {
      const stats = await apiKeyService.getKeyStats();
      res.json(stats);
    } catch (error: any) {
      handleError(res, error);
    }
  }
}
