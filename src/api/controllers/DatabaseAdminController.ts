import { Response } from 'express';
import { DatabaseAdminService } from '../services/DatabaseAdminService';
import type { AuthRequest } from '../middleware/authMiddleware';

function handleError(res: Response, error: any) {
  console.error('[DatabaseAdminController]', error?.message);
  return res.status(error?.statusCode ?? 500).json({ error: error.message || 'Internal server error' });
}

export class DatabaseAdminController {
  static async getTableStats(_req: AuthRequest, res: Response) {
    try {
      const rows = await DatabaseAdminService.getTableStats();
      res.json(rows);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getDatabaseOverview(_req: AuthRequest, res: Response) {
    try {
      const overview = await DatabaseAdminService.getDatabaseOverview();
      res.json(overview);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getIndexStats(_req: AuthRequest, res: Response) {
    try {
      const rows = await DatabaseAdminService.getIndexStats();
      res.json(rows);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getRecentQueries(_req: AuthRequest, res: Response) {
    try {
      const result = await DatabaseAdminService.getRecentQueries();
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getVacuumStatus(_req: AuthRequest, res: Response) {
    try {
      const rows = await DatabaseAdminService.getVacuumStatus();
      res.json(rows);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async runQuery(req: AuthRequest, res: Response) {
    try {
      const { query } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'A SQL query string is required in the request body.' });
      }
      const result = await DatabaseAdminService.runReadOnlyQuery(query);
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }
}
