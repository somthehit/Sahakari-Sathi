import { Response } from 'express';
import { SystemSettingsService, ApiError } from '../services/SystemSettingsService';
import type { AuthRequest } from '../middleware/authMiddleware';

const settingsService = new SystemSettingsService();

function handleError(res: Response, error: any) {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  console.error('[SystemSettingsController] Error:', error);
  return res.status(500).json({ error: error.message || 'Internal server error' });
}

export class SystemSettingsController {
  static async getSettings(req: AuthRequest, res: Response) {
    try {
      const category = req.query.category as string | undefined;
      const settings = await settingsService.listSettings(category);
      res.json(settings);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getSettingsGrouped(req: AuthRequest, res: Response) {
    try {
      const grouped = await settingsService.getSettingsGrouped();
      res.json(grouped);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getSettingByKey(req: AuthRequest, res: Response) {
    try {
      const setting = await settingsService.getSetting(req.params.key);
      res.json(setting);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async updateSetting(req: AuthRequest, res: Response) {
    try {
      const { value } = req.body;
      if (value === undefined || value === null) {
        return res.status(400).json({ error: 'Value is required' });
      }
      const updated = await settingsService.updateSetting(req.params.key, String(value), req.user?.userId);
      res.json(updated);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async updateBulk(req: AuthRequest, res: Response) {
    try {
      const { settings } = req.body;
      if (!Array.isArray(settings)) {
        return res.status(400).json({ error: 'Settings array is required' });
      }
      const results = await settingsService.updateSettings(settings, req.user?.userId);
      res.json({ results });
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async resetSettings(req: AuthRequest, res: Response) {
    try {
      const { category } = req.body || {};
      const result = await settingsService.resetSettings(category);
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }
}
