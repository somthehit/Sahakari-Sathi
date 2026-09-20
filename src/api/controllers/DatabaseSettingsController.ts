import { Response } from 'express';
import { DatabaseSettingsService } from '../services/DatabaseSettingsService';
import type { AuthRequest } from '../middleware/authMiddleware';

function handleError(res: Response, error: any) {
  console.error('[DatabaseSettingsController]', error?.message);
  return res.status(error?.statusCode ?? 500).json({ error: error.message || 'Internal server error' });
}

export class DatabaseSettingsController {
  static async getConfig(_req: AuthRequest, res: Response) {
    try {
      const svc = new DatabaseSettingsService();
      const config = await svc.getConfig();
      res.json(config);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async updateConfig(req: AuthRequest, res: Response) {
    try {
      const svc = new DatabaseSettingsService();
      const updatedBy = req.user?.userId || req.user?.username || 'unknown';
      const config = await svc.updateConfig(req.body, updatedBy);
      res.json({ success: true, config });
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async testConnection(req: AuthRequest, res: Response) {
    try {
      const svc = new DatabaseSettingsService();
      const result = await svc.testConnection(req.body);
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async applyConfig(_req: AuthRequest, res: Response) {
    try {
      const svc = new DatabaseSettingsService();
      const applied = await svc.applySavedConfig();
      res.json({ success: true, applied });
    } catch (error: any) {
      handleError(res, error);
    }
  }
}
