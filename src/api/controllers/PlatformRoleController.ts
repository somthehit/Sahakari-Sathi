import { Response } from 'express';
import { PlatformRoleService, ApiError, type PlatformRoleActor } from '../services/PlatformRoleService';
import type { AuthRequest } from '../middleware/authMiddleware';

const platformRoleService = new PlatformRoleService();

function toActor(req: AuthRequest): PlatformRoleActor {
  return {
    userId: req.user?.authUserId ?? req.user?.userId,
    username: req.user?.username,
  };
}

function handleError(res: Response, error: any) {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  return res.status(500).json({ error: error.message || 'Internal server error' });
}

export class PlatformRoleController {
  static async listRoles(req: AuthRequest, res: Response) {
    try {
      const result = await platformRoleService.list(req.query as Record<string, any>);
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getRole(req: AuthRequest, res: Response) {
    try {
      const role = await platformRoleService.get(req.params.id);
      res.json(role);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async createRole(req: AuthRequest, res: Response) {
    try {
      const role = await platformRoleService.create(req.body, toActor(req));
      res.status(201).json(role);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async updateRole(req: AuthRequest, res: Response) {
    try {
      const role = await platformRoleService.update(req.params.id, req.body, toActor(req));
      res.json(role);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async deleteRole(req: AuthRequest, res: Response) {
    try {
      const result = await platformRoleService.remove(req.params.id, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getRolePermissions(req: AuthRequest, res: Response) {
    try {
      const perms = await platformRoleService.getPermissions(req.params.id);
      res.json(perms);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async putRolePermissions(req: AuthRequest, res: Response) {
    try {
      const perms = await platformRoleService.setPermissions(req.params.id, req.body.permissions ?? req.body, toActor(req));
      res.json(perms);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getRoleDataScope(req: AuthRequest, res: Response) {
    try {
      const scope = await platformRoleService.getDataScope(req.params.id);
      res.json(scope);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async putRoleDataScope(req: AuthRequest, res: Response) {
    try {
      const scope = await platformRoleService.setDataScope(req.params.id, req.body, toActor(req));
      res.json(scope);
    } catch (error: any) {
      handleError(res, error);
    }
  }
}
