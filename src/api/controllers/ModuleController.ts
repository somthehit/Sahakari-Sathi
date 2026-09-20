import { Response } from 'express';
import { ModuleService, ApiError, type ModuleActor } from '../services/ModuleService';
import type { AuthRequest } from '../middleware/authMiddleware';

const moduleService = new ModuleService();

function toActor(req: AuthRequest): ModuleActor {
  return {
    userId: req.user?.authUserId ?? req.user?.userId,
    username: req.user?.username,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') ?? null,
  };
}

function handleError(res: Response, error: any) {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  console.error('[ModuleController] FULL ERROR:', JSON.stringify({
    message: error?.message,
    code: error?.code,
    detail: error?.detail,
    hint: error?.hint,
    stack: error?.stack?.split('\n').slice(0, 8),
  }));
  return res.status(500).json({ error: error.message || 'Internal server error', detail: error?.detail, code: error?.code });
}

export class ModuleController {
  // ── Modules ────────────────────────────────────────────────────────────────
  static async listModules(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.list(req.query as Record<string, any>);
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getModule(req: AuthRequest, res: Response) {
    try {
      const module = await moduleService.get(req.params.id);
      res.json(module);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async createModule(req: AuthRequest, res: Response) {
    try {
      const module = await moduleService.create(req.body, toActor(req));
      res.status(201).json(module);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async updateModule(req: AuthRequest, res: Response) {
    try {
      const module = await moduleService.update(req.params.id, req.body, toActor(req));
      res.json(module);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async deleteModule(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.remove(req.params.id, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await moduleService.getStats();
      res.json(stats);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  static async listCategories(req: AuthRequest, res: Response) {
    try {
      const categories = await moduleService.listCategories();
      res.json(categories);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Features ───────────────────────────────────────────────────────────────
  static async listFeatures(req: AuthRequest, res: Response) {
    try {
      const features = await moduleService.listFeatures(req.params.id);
      res.json(features);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async createFeature(req: AuthRequest, res: Response) {
    try {
      const feature = await moduleService.createFeature(req.params.id, req.body, toActor(req));
      res.status(201).json(feature);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async updateFeature(req: AuthRequest, res: Response) {
    try {
      const feature = await moduleService.updateFeature(req.params.id, req.params.featureId, req.body, toActor(req));
      res.json(feature);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async deleteFeature(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.deleteFeature(req.params.id, req.params.featureId, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Dependencies ───────────────────────────────────────────────────────────
  static async listDependencies(req: AuthRequest, res: Response) {
    try {
      const dependencies = await moduleService.listDependencies(req.params.id);
      res.json(dependencies);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async addDependency(req: AuthRequest, res: Response) {
    try {
      const dep = await moduleService.addDependency(req.params.id, req.body, toActor(req));
      res.status(201).json(dep);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async removeDependency(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.removeDependency(req.params.id, req.params.depId, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Versions ───────────────────────────────────────────────────────────────
  static async listVersions(req: AuthRequest, res: Response) {
    try {
      const versions = await moduleService.listVersions(req.params.id);
      res.json(versions);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async createVersion(req: AuthRequest, res: Response) {
    try {
      const version = await moduleService.createVersion(req.params.id, req.body, toActor(req));
      res.status(201).json(version);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Licenses ───────────────────────────────────────────────────────────────
  static async listLicenses(req: AuthRequest, res: Response) {
    try {
      const licenses = await moduleService.listLicenses(req.params.id);
      res.json(licenses);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async createLicense(req: AuthRequest, res: Response) {
    try {
      const license = await moduleService.createLicense(req.params.id, req.body, toActor(req));
      res.status(201).json(license);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async updateLicense(req: AuthRequest, res: Response) {
    try {
      const license = await moduleService.updateLicense(req.params.id, req.params.licenseId, req.body, toActor(req));
      res.json(license);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async deleteLicense(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.deleteLicense(req.params.id, req.params.licenseId, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Settings definitions ───────────────────────────────────────────────────
  static async listSettings(req: AuthRequest, res: Response) {
    try {
      const settings = await moduleService.listSettings(req.params.id);
      res.json(settings);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async upsertSetting(req: AuthRequest, res: Response) {
    try {
      const setting = await moduleService.upsertSetting(req.params.id, req.body, toActor(req));
      res.json(setting);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async deleteSetting(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.deleteSetting(req.params.id, req.params.settingId, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Permission catalog ─────────────────────────────────────────────────────
  static async listPermissions(req: AuthRequest, res: Response) {
    try {
      const permissions = await moduleService.listPermissions(req.params.id);
      res.json(permissions);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async upsertPermission(req: AuthRequest, res: Response) {
    try {
      const permission = await moduleService.upsertPermission(req.params.id, req.body, toActor(req));
      res.json(permission);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async deletePermission(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.deletePermission(req.params.id, req.params.permId, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Assignments ────────────────────────────────────────────────────────────
  static async listModuleAssignments(req: AuthRequest, res: Response) {
    try {
      const assignments = await moduleService.listAssignmentsForModule(req.params.id);
      res.json(assignments);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async listOrgAssignments(req: AuthRequest, res: Response) {
    try {
      const assignments = await moduleService.listAssignmentsForOrg(req.params.organizationId);
      res.json(assignments);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async assignModules(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.assign(req.body, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async unassignModules(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.unassign(req.body, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async updateAssignment(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.updateAssignment(req.params.assignmentId, req.body, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async toggleOrgModule(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.toggleOrgModule(req.params.organizationId, req.params.moduleId, req.body.status, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Org-level overrides ────────────────────────────────────────────────────
  static async listOrgFeatures(req: AuthRequest, res: Response) {
    try {
      const features = await moduleService.listOrgFeatures(req.params.organizationId, req.params.moduleId);
      res.json(features);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async setOrgFeature(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.setOrgFeature(req.params.organizationId, req.params.moduleId, req.body.featureId, req.body.enabled, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async listOrgSettings(req: AuthRequest, res: Response) {
    try {
      const settings = await moduleService.listOrgSettings(req.params.organizationId, req.params.moduleId);
      res.json(settings);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async setOrgSetting(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.setOrgSetting(req.params.organizationId, req.params.moduleId, req.body.key, req.body.value, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async listOrgPermissions(req: AuthRequest, res: Response) {
    try {
      const permissions = await moduleService.listOrgPermissions(req.params.organizationId, req.params.moduleId);
      res.json(permissions);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async setOrgPermission(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.setOrgPermission(req.params.organizationId, req.params.moduleId, req.body.role, req.body.action, req.body.granted, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Usage analytics ────────────────────────────────────────────────────────
  static async getUsage(req: AuthRequest, res: Response) {
    try {
      const usage = await moduleService.getUsage(req.params.id, Number(req.query.days) || 30);
      res.json(usage);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async recordUsage(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.recordUsage(req.body.rows ?? req.body);
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Audit ──────────────────────────────────────────────────────────────────
  static async listAuditLogs(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.listAuditLogs({
        moduleId: req.query.moduleId as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        offset: req.query.offset ? Number(req.query.offset) : 0,
      });
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Notifications ──────────────────────────────────────────────────────────
  static async listNotifications(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.listNotifications({
        moduleId: req.query.moduleId as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : 30,
      });
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Templates ──────────────────────────────────────────────────────────────
  static async listTemplates(req: AuthRequest, res: Response) {
    try {
      const templates = await moduleService.listTemplates();
      res.json(templates);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async createTemplate(req: AuthRequest, res: Response) {
    try {
      const template = await moduleService.createTemplate(req.body);
      res.status(201).json(template);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async deleteTemplate(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.deleteTemplate(req.params.templateId);
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Recommendations ────────────────────────────────────────────────────────
  static async listRecommendations(req: AuthRequest, res: Response) {
    try {
      const recommendations = await moduleService.listRecommendations();
      res.json(recommendations);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async generateRecommendations(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.generateRecommendations(toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async updateRecommendationStatus(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.updateRecommendationStatus(req.params.recommendationId, req.body.status, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Marketplace ────────────────────────────────────────────────────────────
  static async getMarketplace(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.getMarketplace(req.query as Record<string, any>);
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async upsertMarketplace(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.upsertMarketplace(req.params.id, req.body, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async marketplaceInstall(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.marketplaceInstall(req.body, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async marketplaceUpdate(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.marketplaceUpdate(req.body, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  static async marketplaceRemove(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.marketplaceRemove(req.body, toActor(req));
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Installation logs ──────────────────────────────────────────────────────
  static async listInstallationLogs(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.listInstallationLogs(
        req.query.moduleId as string | undefined,
        Number(req.query.limit) || 30
      );
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }

  // ── Organizations (for assignment dialogs) ─────────────────────────────────
  static async listOrganizations(req: AuthRequest, res: Response) {
    try {
      const result = await moduleService.listOrganizations(req.query as Record<string, any>);
      res.json(result);
    } catch (error: any) {
      handleError(res, error);
    }
  }
}
