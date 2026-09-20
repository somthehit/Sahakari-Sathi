import { Request, Response } from 'express';
import { MasterDataService } from '../services/MasterDataService';
import type { AuthRequest } from '../middleware/authMiddleware';
import { getBranchScope } from '../middleware/scope';

const masterDataService = new MasterDataService();

export class MasterDataController {
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(403).json({ error: 'No organization context available.' });
      }
      const scope = getBranchScope(req);
      const data = await masterDataService.getAll(organizationId, scope.isOrgAdmin ? undefined : scope.branchIds);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
