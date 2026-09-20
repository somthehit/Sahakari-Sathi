import { Response } from 'express';
import { RoleService, ApiError, type RoleActor } from '../services/RoleService';
import type { AuthRequest } from '../middleware/authMiddleware';

const roleService = new RoleService();

function toActor(req: AuthRequest): RoleActor {
  return {
    organizationId: req.user?.organizationId ?? '',
    userId: req.user?.authUserId ?? req.user?.userId,
    username: req.user?.username,
    role: req.user?.role,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || '',
    userAgent: req.headers['user-agent'],
  };
}

function handleError(res: Response, error: any) {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  return res.status(500).json({ error: error.message || 'Internal server error' });
}

export class RoleController {
  static async getRoles(req: AuthRequest, res: Response) {
    try {
      const result = await roleService.list(req.query as Record<string, any>, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getRole(req: AuthRequest, res: Response) {
    try {
      const role = await roleService.get(req.params.id, toActor(req));
      res.json(role);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async createRole(req: AuthRequest, res: Response) {
    try {
      const role = await roleService.create(req.body, toActor(req));
      res.status(201).json(role);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async updateRole(req: AuthRequest, res: Response) {
    try {
      const role = await roleService.update(req.params.id, req.body, toActor(req));
      res.json(role);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async updateRoleStatus(req: AuthRequest, res: Response) {
    try {
      const role = await roleService.updateStatus(req.params.id, req.body.status, toActor(req));
      res.json(role);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async deleteRole(req: AuthRequest, res: Response) {
    try {
      const result = await roleService.remove(req.params.id, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getRolePermissions(req: AuthRequest, res: Response) {
    try {
      const perms = await roleService.getPermissions(req.params.id, toActor(req));
      res.json(perms);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async putRolePermissions(req: AuthRequest, res: Response) {
    try {
      const perms = await roleService.setPermissions(req.params.id, req.body.permissions ?? req.body, toActor(req));
      res.json(perms);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getRoleUsers(req: AuthRequest, res: Response) {
    try {
      const users = await roleService.getUsers(req.params.id, toActor(req));
      res.json(users);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getRoleDataScope(req: AuthRequest, res: Response) {
    try {
      const scope = await roleService.getDataScope(req.params.id, toActor(req));
      res.json(scope);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async putRoleDataScope(req: AuthRequest, res: Response) {
    try {
      const scope = await roleService.setDataScope(req.params.id, req.body, toActor(req));
      res.json(scope);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getCloneSources(req: AuthRequest, res: Response) {
    try {
      const roles = await roleService.getCloneSources(toActor(req));
      res.json(roles);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getRoleApprovalLimits(req: AuthRequest, res: Response) {
    try {
      const limits = await roleService.getApprovalLimits(req.params.id, toActor(req));
      res.json(limits);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async putRoleApprovalLimits(req: AuthRequest, res: Response) {
    try {
      const limits = await roleService.putApprovalLimits(req.params.id, req.body, toActor(req));
      res.json(limits);
    } catch (error: any) {
      handleError(res, error);
    }
  }
}
