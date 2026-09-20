/**
 * Module Service
 * Business rules for the enterprise module management system (platform /
 * super-admin). Covers catalog CRUD, the dependency engine, organization
 * assignment/licensing, feature flags, usage analytics, marketplace,
 * templates, notifications and AI-style recommendations.
 *
 * Every mutation writes a module_audit_logs row. Dependency rules:
 *  - A module whose dependents rely on it (required) cannot be disabled/deleted.
 *  - Enabling/assigning a module auto-includes its required dependencies.
 *  - Unassigning a module that other enabled org-modules depend on is blocked.
 */
import { ModuleRepository } from '../repositories/ModuleRepository';
import { getDb } from '../../db/client';

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface ModuleActor {
  userId?: string;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditInput {
  organizationId?: string | null;
  moduleId?: string | null;
  featureId?: string | null;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
}

const MODULE_TYPES = ['Core', 'Optional', 'Premium', 'Enterprise', 'Marketplace', 'Partner', 'Custom', 'Experimental', 'Beta', 'Deprecated', 'Hidden'];
const MODULE_STATUSES = ['Draft', 'Active', 'Inactive', 'Beta', 'Deprecated'];
const LICENSE_TYPES = ['Free', 'Trial', 'Monthly', 'Quarterly', 'Yearly', 'Lifetime', 'Enterprise', 'Custom'];
const ORG_MODULE_STATUSES = ['Enabled', 'Disabled', 'Trial', 'Pending', 'Expired'];
const VERSION_CHANNELS = ['Stable', 'Beta', 'LTS'];

export class ModuleService {
  private repo = new ModuleRepository();

  // ── Catalog ────────────────────────────────────────────────────────────────
  async list(filter: Record<string, any>) {
    return this.repo.listModules({
      search: filter.search,
      categoryId: filter.categoryId,
      category: filter.category,
      type: filter.type,
      status: filter.status,
      licenseType: filter.licenseType,
      required: filter.required,
      hasUpdates: filter.hasUpdates,
      sortBy: filter.sortBy,
      sortDir: filter.sortDir === 'desc' ? 'desc' : 'asc',
      page: filter.page ? Math.max(1, parseInt(filter.page, 10) || 1) : 1,
      limit: filter.limit ? Math.min(100, parseInt(filter.limit, 10) || 24) : 24,
    });
  }

  async get(id: string) {
    const module = await this.repo.getModuleDetail(id);
    if (!module) throw new ApiError(404, 'Module not found');
    return module;
  }

  async getStats() {
    return this.repo.getStats();
  }

  async create(data: Record<string, any>, actor: ModuleActor) {
    const code = (data.code || '').toString().trim();
    const name = (data.name || '').toString().trim();
    if (!code) throw new ApiError(400, 'Module code is required');
    if (!name) throw new ApiError(400, 'Module name is required');

    const conflict = await this.repo.findModuleByCode(code);
    if (conflict) throw new ApiError(409, `Module code "${code}" already exists.`);

    if (data.type && !MODULE_TYPES.includes(data.type)) throw new ApiError(400, `Invalid module type "${data.type}".`);
    if (data.status && !MODULE_STATUSES.includes(data.status)) throw new ApiError(400, `Invalid module status "${data.status}".`);
    if (data.licenseType && !LICENSE_TYPES.includes(data.licenseType)) throw new ApiError(400, `Invalid license type "${data.licenseType}".`);
    if (data.releaseChannel && !VERSION_CHANNELS.includes(data.releaseChannel)) throw new ApiError(400, `Invalid release channel "${data.releaseChannel}".`);

    const module = await this.repo.createModule({
      code,
      name,
      nameNepali: data.nameNepali ? (data.nameNepali as string).trim() : null,
      shortDescription: data.shortDescription || null,
      longDescription: data.longDescription || null,
      categoryId: data.categoryId || null,
      type: data.type || 'Optional',
      icon: data.icon || 'Package',
      color: data.color || '#059669',
      developer: data.developer || 'Sahakari Sathi',
      website: data.website || null,
      versionCurrent: data.versionCurrent || '1.0.0',
      versionLatest: data.versionLatest || data.versionCurrent || '1.0.0',
      licenseType: data.licenseType || 'Free',
      status: data.status || 'Active',
      isRequired: !!data.isRequired,
      isSystem: !!data.isSystem,
      isHidden: !!data.isHidden,
      autoUpdate: !!data.autoUpdate,
      releaseChannel: data.releaseChannel || 'Stable',
      settingsSchema: data.settingsSchema ?? null,
      screenshots: data.screenshots ?? null,
      metadata: data.metadata ?? null,
      sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0,
      createdBy: actor.userId,
    });

    if (data.features && Array.isArray(data.features) && data.features.length > 0) {
      await this.repo.batchCreateFeatures(data.features.map((f: any, i: number) => ({
        moduleId: module.id,
        code: (f.code || '').toString().trim(),
        name: (f.name || '').toString().trim(),
        description: f.description ?? null,
        isActive: f.isActive ?? true,
        isRequired: f.isRequired ?? false,
        sortOrder: Number.isFinite(Number(f.sortOrder)) ? Number(f.sortOrder) : i,
      })));
    }

    await this.audit({ moduleId: module.id, action: 'CREATE', newValue: { code, name }, actor });
    return this.repo.getModuleDetail(module.id);
  }

  async update(id: string, data: Record<string, any>, actor: ModuleActor) {
    const existing = await this.repo.getModuleDetail(id);
    if (!existing) throw new ApiError(404, 'Module not found');

    const name = data.name !== undefined ? (data.name as string).toString().trim() : existing.name;
    if (!name) throw new ApiError(400, 'Module name is required');
    if (name !== existing.name) {
      const conflict = await this.repo.findModuleByName(name, id);
      if (conflict) throw new ApiError(409, `Module name "${name}" already exists.`);
    }
    if (data.type && !MODULE_TYPES.includes(data.type)) throw new ApiError(400, `Invalid module type "${data.type}".`);
    if (data.status && !MODULE_STATUSES.includes(data.status)) throw new ApiError(400, `Invalid module status "${data.status}".`);
    if (data.licenseType && !LICENSE_TYPES.includes(data.licenseType)) throw new ApiError(400, `Invalid license type "${data.licenseType}".`);
    if (data.releaseChannel && !VERSION_CHANNELS.includes(data.releaseChannel)) throw new ApiError(400, `Invalid release channel "${data.releaseChannel}".`);

    // Dependency guard: cannot set a module with dependents to Inactive/Deprecated.
    if (data.status === 'Inactive' || data.status === 'Deprecated') {
      await this.assertNoDependents(id, existing.name);
    }

    const updated = await this.repo.updateModule(id, {
      ...(data.name !== undefined ? { name } : {}),
      nameNepali: data.nameNepali !== undefined ? (data.nameNepali as string).trim() : existing.nameNepali,
      shortDescription: data.shortDescription !== undefined ? data.shortDescription : existing.shortDescription,
      longDescription: data.longDescription !== undefined ? data.longDescription : existing.longDescription,
      categoryId: data.categoryId !== undefined ? (data.categoryId || null) : existing.categoryId,
      type: data.type !== undefined ? data.type : existing.type,
      icon: data.icon !== undefined ? data.icon : existing.icon,
      color: data.color !== undefined ? data.color : existing.color,
      developer: data.developer !== undefined ? data.developer : existing.developer,
      website: data.website !== undefined ? data.website : existing.website,
      licenseType: data.licenseType !== undefined ? data.licenseType : existing.licenseType,
      status: data.status !== undefined ? data.status : existing.status,
      isRequired: data.isRequired !== undefined ? !!data.isRequired : existing.isRequired,
      autoUpdate: data.autoUpdate !== undefined ? !!data.autoUpdate : existing.autoUpdate,
      releaseChannel: data.releaseChannel !== undefined ? data.releaseChannel : existing.releaseChannel,
      settingsSchema: data.settingsSchema !== undefined ? data.settingsSchema : existing.settingsSchema,
      screenshots: data.screenshots !== undefined ? data.screenshots : existing.screenshots,
      metadata: data.metadata !== undefined ? data.metadata : existing.metadata,
      sortOrder: data.sortOrder !== undefined && Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : existing.sortOrder,
      updatedBy: actor.userId,
    });

    await this.audit({ moduleId: id, action: 'UPDATE', oldValue: { name: existing.name }, newValue: { name, status: data.status ?? existing.status }, actor });
    return this.repo.getModuleDetail(id) ?? updated;
  }

  async remove(id: string, actor: ModuleActor) {
    const existing = await this.repo.getModuleDetail(id);
    if (!existing) throw new ApiError(404, 'Module not found');
    if (existing.isSystem) throw new ApiError(400, 'System modules cannot be deleted.');
    if (existing.organizationCount > 0) {
      throw new ApiError(409, `Module is assigned to ${existing.organizationCount} organization(s). Unassign it first.`);
    }
    await this.assertNoDependents(id, existing.name);
    await this.repo.softDeleteModule(id, actor.userId);
    await this.audit({ moduleId: id, action: 'DELETE', oldValue: { name: existing.name }, actor });
    return { success: true };
  }

  /** Dependency engine guard: blocks disabling/deleting a module that active modules depend on. */
  private async assertNoDependents(moduleId: string, moduleName: string) {
    const dependents = await this.repo.listDependents(moduleId);
    const blocking = dependents.filter((d: any) => d.isRequired && d.depStatus !== 'Inactive' && d.depStatus !== 'Deprecated');
    if (blocking.length > 0) {
      throw new ApiError(
        409,
        `Module "${moduleName}" is a required dependency of: ${blocking.map((d: any) => d.depName).join(', ')}. Remove those dependencies first.`
      );
    }
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  async listCategories() {
    return this.repo.listCategories();
  }

  // ── Features ───────────────────────────────────────────────────────────────
  async listFeatures(moduleId: string) {
    await this.assertModule(moduleId);
    return this.repo.listFeatures(moduleId);
  }

  async createFeature(moduleId: string, data: Record<string, any>, actor: ModuleActor) {
    await this.assertModule(moduleId);
    const code = (data.code || '').toString().trim();
    const name = (data.name || '').toString().trim();
    if (!code) throw new ApiError(400, 'Feature code is required');
    if (!name) throw new ApiError(400, 'Feature name is required');
    if (await this.repo.findFeatureByCode(moduleId, code)) {
      throw new ApiError(409, `Feature code "${code}" already exists for this module.`);
    }
    const feature = await this.repo.createFeature({
      moduleId, code, name,
      description: data.description ?? null,
      isActive: data.isActive ?? true,
      isRequired: data.isRequired ?? false,
      settingsSchema: data.settingsSchema ?? null,
      sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0,
    });
    await this.audit({ moduleId, featureId: feature.id, action: 'FEATURE_TOGGLE', newValue: { code, name, isActive: true }, actor });
    return feature;
  }

  async updateFeature(moduleId: string, id: string, data: Record<string, any>, actor: ModuleActor) {
    await this.assertModule(moduleId);
    const existing = await this.repo.listFeatures(moduleId);
    const current = existing.find((f: any) => f.id === id);
    if (!current) throw new ApiError(404, 'Feature not found');
    const updated = await this.repo.updateFeature(id, {
      name: data.name !== undefined ? (data.name as string).toString().trim() : current.name,
      description: data.description !== undefined ? data.description : current.description,
      isActive: data.isActive !== undefined ? !!data.isActive : current.isActive,
      isRequired: data.isRequired !== undefined ? !!data.isRequired : current.isRequired,
      settingsSchema: data.settingsSchema !== undefined ? data.settingsSchema : current.settingsSchema,
      sortOrder: data.sortOrder !== undefined && Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : current.sortOrder,
    });
    await this.audit({ moduleId, featureId: id, action: 'FEATURE_TOGGLE', oldValue: { isActive: current.isActive }, newValue: { isActive: updated.isActive }, actor });
    return updated;
  }

  async deleteFeature(moduleId: string, id: string, actor: ModuleActor) {
    await this.assertModule(moduleId);
    const existing = await this.repo.listFeatures(moduleId);
    const current = existing.find((f: any) => f.id === id);
    if (!current) throw new ApiError(404, 'Feature not found');
    await this.repo.deleteFeature(id);
    await this.audit({ moduleId, featureId: id, action: 'FEATURE_TOGGLE', oldValue: { code: current.code, isActive: current.isActive }, newValue: { isActive: false }, actor });
    return { success: true };
  }

  // ── Dependencies ───────────────────────────────────────────────────────────
  async listDependencies(moduleId: string) {
    await this.assertModule(moduleId);
    return this.repo.listDependencies(moduleId);
  }

  async addDependency(moduleId: string, data: Record<string, any>, actor: ModuleActor) {
    await this.assertModule(moduleId);
    const dependsOnModuleId = (data.dependsOnModuleId || '').toString().trim();
    if (!dependsOnModuleId) throw new ApiError(400, 'dependsOnModuleId is required');
    if (dependsOnModuleId === moduleId) throw new ApiError(400, 'A module cannot depend on itself.');
    const dep = await this.repo.getModuleDetail(dependsOnModuleId);
    if (!dep) throw new ApiError(404, 'Dependency module not found');

    const created = await this.repo.addDependency({
      moduleId,
      dependsOnModuleId,
      minVersion: data.minVersion ?? null,
      isRequired: data.isRequired ?? true,
      note: data.note ?? null,
    });
    if (!created) throw new ApiError(409, 'This dependency already exists.');
    await this.audit({ moduleId, action: 'UPDATE', oldValue: null, newValue: { dependsOn: dep.code }, actor });
    return created;
  }

  async removeDependency(moduleId: string, id: string, actor: ModuleActor) {
    await this.assertModule(moduleId);
    await this.repo.deleteDependency(id);
    await this.audit({ moduleId, action: 'UPDATE', oldValue: { dependencyId: id }, newValue: null, actor });
    return { success: true };
  }

  // ── Versions ───────────────────────────────────────────────────────────────
  async listVersions(moduleId: string) {
    await this.assertModule(moduleId);
    return this.repo.listVersions(moduleId);
  }

  async createVersion(moduleId: string, data: Record<string, any>, actor: ModuleActor) {
    const existing = await this.assertModule(moduleId);
    const version = (data.version || '').toString().trim();
    if (!version) throw new ApiError(400, 'Version is required');
    if (await this.repo.findVersion(moduleId, version)) {
      throw new ApiError(409, `Version "${version}" already exists for this module.`);
    }
    const channel = data.channel && VERSION_CHANNELS.includes(data.channel) ? data.channel : 'Stable';
    const created = await this.repo.createVersion({
      moduleId,
      version,
      channel,
      releaseDate: data.releaseDate ? new Date(data.releaseDate) : new Date(),
      releaseNotes: data.releaseNotes ?? null,
      isCurrent: !!data.isCurrent,
      isLatest: data.isLatest ?? true,
      minAppVersion: data.minAppVersion ?? null,
      compatibility: data.compatibility ?? null,
      checksum: data.checksum ?? null,
      sizeBytes: Number.isFinite(Number(data.sizeBytes)) ? Number(data.sizeBytes) : 0,
      createdBy: actor.userId,
    });

    // Promote to current/latest on the module header if requested.
    const updates: Record<string, any> = {};
    if (created.isLatest) updates.versionLatest = version;
    if (created.isCurrent) updates.versionCurrent = version;
    if (Object.keys(updates).length > 0) {
      await this.repo.updateModule(moduleId, { ...updates, lastReleasedAt: new Date(), updatedBy: actor.userId });
    }
    await this.audit({ moduleId, action: 'UPGRADE', oldValue: { version: existing.versionCurrent }, newValue: { version }, actor });
    return created;
  }

  // ── Licenses ───────────────────────────────────────────────────────────────
  async listLicenses(moduleId: string) {
    await this.assertModule(moduleId);
    return this.repo.listLicenses(moduleId);
  }

  async createLicense(moduleId: string, data: Record<string, any>, actor: ModuleActor) {
    await this.assertModule(moduleId);
    const code = (data.code || '').toString().trim();
    const name = (data.name || '').toString().trim();
    if (!code) throw new ApiError(400, 'License code is required');
    if (!name) throw new ApiError(400, 'License name is required');
    if (!LICENSE_TYPES.includes(data.type)) throw new ApiError(400, `Invalid license type "${data.type}".`);
    const license = await this.repo.createLicense({
      moduleId, code, name, type: data.type,
      price: data.price ?? '0',
      currency: data.currency || 'NPR',
      billingPeriod: data.billingPeriod ?? null,
      features: data.features ?? null,
      maxUsers: data.maxUsers ?? null,
      maxBranches: data.maxBranches ?? null,
      trialDays: data.trialDays ?? 0,
      sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0,
      isActive: data.isActive ?? true,
    });
    await this.audit({ moduleId, action: 'LICENSE_CHANGE', newValue: { code, name, type: data.type }, actor });
    return license;
  }

  async updateLicense(moduleId: string, id: string, data: Record<string, any>, actor: ModuleActor) {
    await this.assertModule(moduleId);
    if (data.type && !LICENSE_TYPES.includes(data.type)) throw new ApiError(400, `Invalid license type "${data.type}".`);
    const updated = await this.repo.updateLicense(id, {
      ...data,
      price: data.price !== undefined ? data.price : undefined,
    });
    if (!updated) throw new ApiError(404, 'License not found');
    await this.audit({ moduleId, action: 'LICENSE_CHANGE', newValue: data, actor });
    return updated;
  }

  async deleteLicense(moduleId: string, id: string, actor: ModuleActor) {
    await this.assertModule(moduleId);
    await this.repo.deleteLicense(id);
    await this.audit({ moduleId, action: 'LICENSE_CHANGE', oldValue: { licenseId: id }, newValue: null, actor });
    return { success: true };
  }

  // ── Settings definitions ───────────────────────────────────────────────────
  async listSettings(moduleId: string) {
    await this.assertModule(moduleId);
    return this.repo.listSettings(moduleId);
  }

  async upsertSetting(moduleId: string, data: Record<string, any>, actor: ModuleActor) {
    await this.assertModule(moduleId);
    const key = (data.key || '').toString().trim();
    const label = (data.label || '').toString().trim();
    if (!key) throw new ApiError(400, 'Setting key is required');
    if (!label) throw new ApiError(400, 'Setting label is required');
    const setting = await this.repo.upsertSetting({
      moduleId, key, label,
      type: data.type || 'text',
      groupName: data.groupName || 'General',
      defaultValue: data.defaultValue ?? null,
      options: data.options ?? null,
      isRequired: data.isRequired ?? false,
      sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0,
    });
    await this.audit({ moduleId, action: 'SETTINGS_CHANGE', newValue: { key, label }, actor });
    return setting;
  }

  async deleteSetting(moduleId: string, id: string, actor: ModuleActor) {
    await this.assertModule(moduleId);
    await this.repo.deleteSetting(id);
    await this.audit({ moduleId, action: 'SETTINGS_CHANGE', oldValue: { settingId: id }, newValue: null, actor });
    return { success: true };
  }

  // ── Permission catalog ─────────────────────────────────────────────────────
  async listPermissions(moduleId: string) {
    await this.assertModule(moduleId);
    return this.repo.listPermissions(moduleId);
  }

  async upsertPermission(moduleId: string, data: Record<string, any>, actor: ModuleActor) {
    await this.assertModule(moduleId);
    const action = (data.action || '').toString().trim();
    const label = (data.label || '').toString().trim();
    if (!action) throw new ApiError(400, 'Permission action is required');
    if (!label) throw new ApiError(400, 'Permission label is required');
    const perm = await this.repo.upsertPermission({
      moduleId, action, label,
      sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0,
    });
    await this.audit({ moduleId, action: 'PERMISSION_CHANGE', newValue: { action, label }, actor });
    return perm;
  }

  async deletePermission(moduleId: string, id: string, actor: ModuleActor) {
    await this.assertModule(moduleId);
    await this.repo.deletePermission(id);
    await this.audit({ moduleId, action: 'PERMISSION_CHANGE', oldValue: { permissionId: id }, newValue: null, actor });
    return { success: true };
  }

  // ── Assignments ────────────────────────────────────────────────────────────
  async listAssignmentsForModule(moduleId: string) {
    await this.assertModule(moduleId);
    return this.repo.listAssignmentsForModule(moduleId);
  }

  async listAssignmentsForOrg(organizationId: string) {
    return this.repo.listAssignmentsForOrg(organizationId);
  }

  async assign(data: Record<string, any>, actor: ModuleActor) {
    const organizationIds = Array.isArray(data.organizationIds) ? data.organizationIds : [];
    const requestedModuleIds = Array.isArray(data.moduleIds) ? data.moduleIds : [];
    if (organizationIds.length === 0) throw new ApiError(400, 'At least one organization is required.');
    if (requestedModuleIds.length === 0) throw new ApiError(400, 'At least one module is required.');

    const { moduleIds, moduleCodes } = await this.expandWithDependencies(requestedModuleIds);

    const result = await this.repo.assignModules({
      organizationIds,
      moduleIds,
      status: data.status && ORG_MODULE_STATUSES.includes(data.status) ? data.status : 'Enabled',
      licenseId: data.licenseId ?? null,
      isTrial: !!data.isTrial,
      activationDate: data.activationDate ? new Date(data.activationDate) : null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      autoRenew: !!data.autoRenew,
      notes: data.notes ?? null,
      createdBy: actor.userId,
    });

    for (const orgId of organizationIds) {
      for (const modId of moduleIds) {
        await this.repo.createInstallationLog({
          organizationId: orgId, moduleId: modId,
          action: 'install', status: 'Completed', createdBy: actor.userId,
        });
        await this.notify(orgId, modId, 'installed', 'Module installed', 'The module has been installed for this organization.');
      }
    }

    // Increment install counts on first assignment (upsert makes re-assign idempotent).
    for (const modId of moduleIds) {
      const module = await this.repo.getModuleDetail(modId);
      if (module) await this.repo.updateModule(modId, { installCount: (module.installCount ?? 0) + 1, updatedBy: actor.userId });
    }

    for (const orgId of organizationIds) {
      await this.audit({ organizationId: orgId, moduleId: moduleIds[0], action: 'ASSIGN', newValue: { moduleIds, moduleCodes }, actor });
    }

    return { success: true, count: result.count, expandedModules: moduleCodes };
  }

  async unassign(data: Record<string, any>, actor: ModuleActor) {
    const organizationIds = Array.isArray(data.organizationIds) ? data.organizationIds : [];
    const moduleIds = Array.isArray(data.moduleIds) ? data.moduleIds : [];
    if (organizationIds.length === 0) throw new ApiError(400, 'At least one organization is required.');
    if (moduleIds.length === 0) throw new ApiError(400, 'At least one module is required.');

    // Dependency engine: block unassigning a module that other enabled org-modules require.
    for (const orgId of organizationIds) {
      for (const modId of moduleIds) {
        await this.assertOrgModuleRemovable(orgId, modId);
      }
    }

    const result = await this.repo.unassignModules(organizationIds, moduleIds);

    for (const orgId of organizationIds) {
      for (const modId of moduleIds) {
        await this.repo.createInstallationLog({
          organizationId: orgId, moduleId: modId,
          action: 'uninstall', status: 'Completed', createdBy: actor.userId,
        });
        await this.audit({ organizationId: orgId, moduleId: modId, action: 'UNASSIGN', oldValue: { moduleId: modId }, actor });
      }
    }

    return { success: true, count: result.count };
  }

  async updateAssignment(id: string, data: Record<string, any>, actor: ModuleActor) {
    if (data.status && !ORG_MODULE_STATUSES.includes(data.status)) throw new ApiError(400, `Invalid status "${data.status}".`);
    const updated = await this.repo.updateAssignment(id, {
      ...data,
      status: data.status,
      licenseId: data.licenseId ?? null,
      isTrial: data.isTrial !== undefined ? !!data.isTrial : undefined,
      activationDate: data.activationDate ? new Date(data.activationDate) : undefined,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      autoRenew: data.autoRenew !== undefined ? !!data.autoRenew : undefined,
      notes: data.notes,
      updatedBy: actor.userId,
    });
    if (!updated) throw new ApiError(404, 'Module assignment not found');
    await this.audit({ organizationId: updated.organizationId, moduleId: updated.moduleId, action: 'UPDATE', newValue: data, actor });
    return updated;
  }

  /** Enable/disable an org module, enforcing the dependency engine. */
  async toggleOrgModule(organizationId: string, moduleId: string, status: string, actor: ModuleActor) {
    if (!ORG_MODULE_STATUSES.includes(status)) throw new ApiError(400, `Invalid status "${status}".`);
    const module = await this.assertModule(moduleId);

    if (status === 'Enabled' || status === 'Trial') {
      await this.assertOrgDependenciesSatisfied(organizationId, moduleId, module.name);
    } else {
      await this.assertOrgModuleRemovable(organizationId, moduleId, module.name);
    }

    const updated = await this.repo.toggleOrgModule(organizationId, moduleId, status, actor.userId);
    await this.audit({
      organizationId, moduleId,
      action: status === 'Enabled' ? 'ENABLE' : 'DISABLE',
      newValue: { status, moduleName: module.name },
      actor,
    });
    await this.repo.createInstallationLog({
      organizationId, moduleId,
      action: status === 'Enabled' ? 'enable' : 'disable',
      status: 'Completed', createdBy: actor.userId,
    });
    return updated;
  }

  /** Expand requested module ids to include required dependency modules. */
  private async expandWithDependencies(moduleIds: string[]): Promise<{ moduleIds: string[]; moduleCodes: string[] }> {
    const set = new Set<string>(moduleIds);
    const codes = new Set<string>();
    let frontier = [...moduleIds];
    let iterations = 0;
    while (frontier.length > 0 && iterations < 20) {
      iterations += 1;
      const next: string[] = [];
      for (const modId of frontier) {
        const deps = await this.repo.listDependencies(modId);
        for (const d of deps) {
          if (d.isRequired && !set.has(d.dependsOnModuleId)) {
            set.add(d.dependsOnModuleId);
            next.push(d.dependsOnModuleId);
          }
          if (d.isRequired) codes.add(d.depCode);
        }
      }
      frontier = next;
    }
    for (const modId of set) {
      const module = await this.repo.getModuleDetail(modId);
      if (module) codes.add(module.code);
    }
    return { moduleIds: [...set], moduleCodes: [...codes] };
  }

  /** Blocks unassigning/disableing an org module that enabled org modules depend on. */
  private async assertOrgModuleRemovable(organizationId: string, moduleId: string, moduleName?: string) {
    const assignments = await this.repo.listAssignmentsForOrg(organizationId);
    const enabled = assignments.filter((a: any) => a.status === 'Enabled' && a.moduleId !== moduleId);
    const enabledIds = enabled.map((a: any) => a.moduleId);
    if (enabledIds.length === 0) return;

    const dependents: string[] = [];
    for (const a of enabled) {
      const deps = await this.repo.listDependencies(a.moduleId);
      const blocking = deps.find((d: any) => d.dependsOnModuleId === moduleId && d.isRequired);
      if (blocking) dependents.push(a.moduleName);
    }
    if (dependents.length > 0) {
      const name = moduleName ?? (await this.repo.getModuleDetail(moduleId))?.name ?? 'Module';
      throw new ApiError(
        409,
        `"${name}" is a required dependency of: ${dependents.join(', ')}. Disable or unassign those modules first.`
      );
    }
  }

  /** Blocks enabling an org module whose required dependencies are not enabled for the org. */
  private async assertOrgDependenciesSatisfied(organizationId: string, moduleId: string, moduleName: string) {
    const deps = await this.repo.listDependencies(moduleId);
    const required = deps.filter((d: any) => d.isRequired);
    if (required.length === 0) return;

    const assignments = await this.repo.listAssignmentsForOrg(organizationId);
    const enabledIds = new Set(
      assignments.filter((a: any) => a.status === 'Enabled' || a.status === 'Trial').map((a: any) => a.moduleId)
    );
    const missing = required.filter((d: any) => !enabledIds.has(d.dependsOnModuleId));
    if (missing.length > 0) {
      throw new ApiError(
        409,
        `"${moduleName}" requires ${missing.map((d: any) => d.depName).join(', ')} to be enabled for this organization first.`
      );
    }
  }

  // ── Org-level overrides ─────────────────────────────────────────────────────
  async listOrgFeatures(organizationId: string, moduleId: string) {
    await this.assertModule(moduleId);
    return this.repo.listOrgFeatures(organizationId, moduleId);
  }

  async setOrgFeature(organizationId: string, moduleId: string, featureId: string, enabled: boolean, actor: ModuleActor) {
    await this.assertModule(moduleId);
    const updated = await this.repo.setOrgFeature(organizationId, moduleId, featureId, !!enabled, actor.userId);
    await this.audit({ organizationId, moduleId, featureId, action: 'FEATURE_TOGGLE', newValue: { featureId, enabled: !!enabled }, actor });
    return updated;
  }

  async listOrgSettings(organizationId: string, moduleId: string) {
    await this.assertModule(moduleId);
    return this.repo.listOrgSettings(organizationId, moduleId);
  }

  async setOrgSetting(organizationId: string, moduleId: string, key: string, value: any, actor: ModuleActor) {
    await this.assertModule(moduleId);
    const updated = await this.repo.setOrgSetting(organizationId, moduleId, key, value, actor.userId);
    await this.audit({ organizationId, moduleId, action: 'SETTINGS_CHANGE', newValue: { key, value }, actor });
    return updated;
  }

  async listOrgPermissions(organizationId: string, moduleId: string) {
    await this.assertModule(moduleId);
    return this.repo.listOrgPermissions(organizationId, moduleId);
  }

  async setOrgPermission(organizationId: string, moduleId: string, role: string, action: string, granted: boolean, actor: ModuleActor) {
    await this.assertModule(moduleId);
    const updated = await this.repo.setOrgPermission(organizationId, moduleId, role, action, !!granted, actor.userId);
    await this.audit({ organizationId, moduleId, action: 'PERMISSION_CHANGE', newValue: { role, action, granted: !!granted }, actor });
    return updated;
  }

  // ── Usage analytics ────────────────────────────────────────────────────────
  async getUsage(moduleId: string, days = 30) {
    await this.assertModule(moduleId);
    const timeSeries = await this.repo.usageTimeSeries(moduleId, Math.min(365, Math.max(7, Number(days) || 30)));
    const topOrganizations = await this.repo.topOrganizations(moduleId, 10);
    const detail = await this.repo.getModuleDetail(moduleId);
    return {
      moduleId,
      days: Math.min(365, Math.max(7, Number(days) || 30)),
      totals: detail?.usage ?? { dau: 0, mau: 0, transactions: 0, apiCalls: 0, storageBytes: 0, avgResponseMs: 0 },
      timeSeries,
      topOrganizations,
    };
  }

  async recordUsage(rows: Array<Record<string, any>>) {
    if (!Array.isArray(rows) || rows.length === 0) return { success: true, count: 0 };
    const cleaned = rows.map((r) => ({
      organizationId: r.organizationId,
      moduleId: r.moduleId,
      date: r.date ? new Date(r.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      dau: Number(r.dau ?? 0),
      mau: Number(r.mau ?? 0),
      transactions: Number(r.transactions ?? 0),
      apiCalls: Number(r.apiCalls ?? 0),
      storageBytes: Number(r.storageBytes ?? 0),
      avgResponseMs: Number(r.avgResponseMs ?? 0),
    }));
    await this.repo.recordUsage(cleaned);
    return { success: true, count: cleaned.length };
  }

  // ── Audit ──────────────────────────────────────────────────────────────────
  async listAuditLogs(filter: { moduleId?: string; limit?: number; offset?: number } = {}) {
    return this.repo.listAuditLogs(filter);
  }

  // ── Notifications ──────────────────────────────────────────────────────────
  async listNotifications(filter: { moduleId?: string; limit?: number } = {}) {
    return this.repo.listNotifications(filter);
  }

  private async notify(organizationId: string, moduleId: string, type: string, title: string, body?: string) {
    try {
      await this.repo.createNotification({ organizationId, moduleId, type, title, body: body ?? null });
    } catch (err) {
      console.error('Failed to write module notification:', err);
    }
  }

  // ── Templates ──────────────────────────────────────────────────────────────
  async listTemplates() {
    return this.repo.listTemplates();
  }

  async createTemplate(data: Record<string, any>) {
    const code = (data.code || '').toString().trim();
    const name = (data.name || '').toString().trim();
    if (!code) throw new ApiError(400, 'Template code is required');
    if (!name) throw new ApiError(400, 'Template name is required');
    const items = Array.isArray(data.items) ? data.items : [];
    const tpl = await this.repo.createTemplate({
      code, name,
      description: data.description ?? null,
      category: data.category ?? null,
      icon: data.icon ?? 'Layers',
    }, items.map((it: any) => ({
      moduleId: it.moduleId,
      licenseId: it.licenseId ?? null,
      config: it.config ?? null,
    })));
    return tpl;
  }

  async deleteTemplate(id: string) {
    await this.repo.deleteTemplate(id);
    return { success: true };
  }

  // ── AI-style recommendations ───────────────────────────────────────────────
  async listRecommendations() {
    return this.repo.listRecommendations();
  }

  async generateRecommendations(actor: ModuleActor) {
    const orgs = await this.repo.listOrganizations({ limit: 100 });
    const catalog = await this.repo.listModules({ limit: 100, status: 'Active' });
    const catByCode = new Map(catalog.data.map((m: any) => [m.code, m]));
    const existing = await this.repo.listRecommendations();
    const rows: Array<Record<string, any>> = [];

    for (const org of orgs.data) {
      const assignments = await this.repo.listAssignmentsForOrg(org.id);
      const enabledCodes = new Set(
        assignments.filter((a: any) => a.status === 'Enabled' || a.status === 'Trial').map((a: any) => a.moduleCode)
      );
      const enabledIds = new Set(
        assignments.filter((a: any) => a.status === 'Enabled' || a.status === 'Trial').map((a: any) => a.moduleId)
      );

      const candidates: Array<{ code: string; reason: string; priority: number; score: number }> = [];

      if (enabledCodes.has('members') && enabledCodes.has('savings') && enabledCodes.has('loans') && !enabledCodes.has('accounting')) {
        candidates.push({ code: 'accounting', reason: 'Uses Members, Savings and Loans — Accounting closes the financial reporting loop.', priority: 90, score: 0.96 });
      }
      if ((enabledCodes.has('savings') || enabledCodes.has('loans')) && !enabledCodes.has('sms')) {
        candidates.push({ code: 'sms', reason: 'Transaction volumes justify SMS notifications for member alerts.', priority: 70, score: 0.88 });
      }
      if (enabledCodes.has('members') && enabledCodes.has('loans') && !enabledCodes.has('hr')) {
        candidates.push({ code: 'hr', reason: 'Growing staff base — manage employees alongside loan operations.', priority: 55, score: 0.78 });
      }
      if (enabledCodes.has('accounting') && !enabledCodes.has('inventory')) {
        candidates.push({ code: 'inventory', reason: 'Accounting in use — track fixed assets and inventory.', priority: 50, score: 0.72 });
      }

      for (const c of candidates) {
        const target = catByCode.get(c.code);
        if (!target) continue;
        if (enabledIds.has(target.id)) continue;
        const dup = existing.find((r: any) => r.organizationId === org.id && r.moduleId === target.id && r.status === 'Suggested');
        if (dup) continue;
        rows.push({
          organizationId: org.id,
          moduleId: target.id,
          reason: c.reason,
          priority: c.priority,
          score: String(c.score),
          status: 'Suggested',
        });
      }
    }

    await this.repo.createRecommendations(rows);
    await this.audit({ moduleId: null, organizationId: null, action: 'CREATE', newValue: { generated: rows.length }, actor });
    return { generated: rows.length };
  }

  async updateRecommendationStatus(id: string, status: string, actor: ModuleActor) {
    if (!['Suggested', 'Accepted', 'Dismissed'].includes(status)) throw new ApiError(400, `Invalid recommendation status "${status}".`);
    const updated = await this.repo.updateRecommendationStatus(id, status);
    if (!updated) throw new ApiError(404, 'Recommendation not found');
    await this.audit({ moduleId: updated.moduleId, organizationId: updated.organizationId, action: 'UPDATE', newValue: { status }, actor });
    return updated;
  }

  // ── Marketplace ────────────────────────────────────────────────────────────
  async getMarketplace(filter: Record<string, any>) {
    const list = await this.repo.listModules({
      search: filter.search,
      type: filter.type,
      categoryId: filter.categoryId,
      status: filter.status,
      sortBy: filter.sortBy || 'installCount',
      sortDir: 'desc',
      page: filter.page ? Math.max(1, parseInt(filter.page, 10) || 1) : 1,
      limit: filter.limit ? Math.min(100, parseInt(filter.limit, 10) || 24) : 24,
    });
    const entries = await Promise.all(list.data.map(async (m: any) => {
      const mp = await this.repo.getModuleDetail(m.id);
      return { ...m, marketplace: mp?.marketplace ?? null };
    }));
    return { data: entries, total: list.total, page: list.page, limit: list.limit, totalPages: list.totalPages };
  }

  async upsertMarketplace(moduleId: string, data: Record<string, any>, actor: ModuleActor) {
    await this.assertModule(moduleId);
    const entry = await this.repo.upsertMarketplace({
      moduleId,
      status: data.status || 'Draft',
      price: data.price ?? '0',
      pricing: data.pricing ?? null,
      screenshots: data.screenshots ?? null,
      docsUrl: data.docsUrl ?? null,
      rating: data.rating ?? '0',
      reviewCount: data.reviewCount ?? 0,
      reviews: data.reviews ?? null,
      developerProfile: data.developerProfile ?? null,
      compatibility: data.compatibility ?? null,
      featured: !!data.featured,
      publishedAt: data.status === 'Published' || data.status === 'Featured' ? new Date() : null,
    });
    await this.audit({ moduleId, action: 'UPDATE', newValue: { marketplace: data.status }, actor });
    return entry;
  }

  /** Marketplace install = assign a module to an organization. */
  async marketplaceInstall(data: Record<string, any>, actor: ModuleActor) {
    return this.assign({ organizationIds: [data.organizationId], moduleIds: [data.moduleId], ...data }, actor);
  }

  /** Marketplace update = upgrade the org to the module's latest version. */
  async marketplaceUpdate(data: Record<string, any>, actor: ModuleActor) {
    const { organizationId, moduleId } = data;
    if (!organizationId || !moduleId) throw new ApiError(400, 'organizationId and moduleId are required.');
    const module = await this.assertModule(moduleId);
    const assignments = await this.repo.listAssignmentsForOrg(organizationId);
    const current = assignments.find((a: any) => a.moduleId === moduleId);
    if (!current) throw new ApiError(404, 'Module is not installed for this organization.');

    const updated = await this.repo.updateAssignment(current.id, {
      versionInstalled: module.versionLatest,
      status: current.status,
      updatedBy: actor.userId,
    });
    await this.repo.createInstallationLog({
      organizationId, moduleId,
      action: 'update', version: module.versionLatest,
      status: 'Completed', createdBy: actor.userId,
    });
    await this.audit({
      organizationId, moduleId, action: 'UPGRADE',
      oldValue: { versionInstalled: current.versionInstalled },
      newValue: { versionInstalled: module.versionLatest },
      actor,
    });
    await this.notify(organizationId, moduleId, 'updated', 'Module updated', `${module.name} updated to v${module.versionLatest}.`);
    return updated;
  }

  /** Marketplace remove = uninstall from the org. */
  async marketplaceRemove(data: Record<string, any>, actor: ModuleActor) {
    const { organizationId, moduleId } = data;
    if (!organizationId || !moduleId) throw new ApiError(400, 'organizationId and moduleId are required.');
    await this.assertModule(moduleId);
    await this.assertOrgModuleRemovable(organizationId, moduleId);
    const result = await this.repo.unassignModules([organizationId], [moduleId]);
    await this.repo.createInstallationLog({
      organizationId, moduleId,
      action: 'uninstall', status: 'Completed', createdBy: actor.userId,
    });
    await this.audit({ organizationId, moduleId, action: 'UNINSTALL', oldValue: { moduleId }, actor });
    return { success: true, count: result.count };
  }

  // ── Installation logs ──────────────────────────────────────────────────────
  async listInstallationLogs(moduleId?: string, limit = 30) {
    return this.repo.listInstallationLogs(moduleId, Math.min(200, Number(limit) || 30));
  }

  // ── Organizations (for assignment dialogs) ─────────────────────────────────
  async listOrganizations(filter: Record<string, any>) {
    return this.repo.listOrganizations({
      search: filter.search,
      page: filter.page ? Math.max(1, parseInt(filter.page, 10) || 1) : 1,
      limit: filter.limit ? Math.min(100, parseInt(filter.limit, 10) || 20) : 20,
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private async assertModule(moduleId: string) {
    const module = await this.repo.getModuleDetail(moduleId);
    if (!module) throw new ApiError(404, 'Module not found');
    return module;
  }

  private async audit(input: AuditInput & { actor?: ModuleActor }) {
    const db = getDb();
    if (!db) return;
    try {
      await this.repo.writeAudit({
        organizationId: input.organizationId ?? null,
        moduleId: input.moduleId ?? null,
        featureId: input.featureId ?? null,
        action: input.action,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
        ipAddress: input.actor?.ipAddress ?? '',
        userAgent: input.actor?.userAgent ?? null,
        createdBy: input.actor?.userId,
      });
    } catch (err) {
      console.error('Failed to write module audit log:', err);
    }
  }
}
