/**
 * Role Service
 * Business rules + audit logging for role management.
 * Every read/write is scoped to the caller's organization_id.
 */
import { RoleRepository, type PermissionRow } from '../repositories/RoleRepository';
import { PERMISSION_ACTIONS, PERMISSION_CATEGORIES } from '../../types/permissions';
import { getTodayBSFormatted } from '../../utils/nepaliCalendar';

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface RoleActor {
  organizationId: string;
  userId?: string;
  username?: string;
  role?: string;
  ipAddress?: string;
  userAgent?: string;
}

const ROLE_ACTION_LABEL: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
};

export class RoleService {
  private repo = new RoleRepository();

  async list(filter: Record<string, any>, actor: RoleActor) {
    return this.repo.findAll({
      organizationId: actor.organizationId,
      search: filter.search,
      status: filter.status,
      system: filter.system,
      sortBy: filter.sortBy,
      sortDir: filter.sortDir === 'desc' ? 'desc' : 'asc',
      page: filter.page ? Math.max(1, parseInt(filter.page, 10) || 1) : 1,
      limit: filter.limit ? Math.min(100, parseInt(filter.limit, 10) || 10) : 10,
    });
  }

  async get(id: string, actor: RoleActor) {
    const role = await this.repo.findById(id, actor.organizationId);
    if (!role) throw new ApiError(404, 'Role not found');
    return role;
  }

  async create(data: Record<string, any>, actor: RoleActor) {
    const code = (data.code || '').toString().trim().toUpperCase();
    const name = (data.name || '').toString().trim();
    if (!code) throw new ApiError(400, 'Role code is required');
    if (!name) throw new ApiError(400, 'Role name is required');

    const conflict = await this.repo.findConflict(actor.organizationId, { code, name });
    if (conflict) {
      if (code && conflict.code === code) throw new ApiError(409, `Role code "${code}" already exists.`);
      throw new ApiError(409, `Role name "${name}" already exists.`);
    }

    // Clone: copy the source role's granular grants.
    let permissionRows: PermissionRow[] = [];
    if (data.cloneFromId) {
      const source = await this.repo.findById(data.cloneFromId, actor.organizationId);
      if (source) {
        permissionRows = await this.repo.getPermissions(source.id, actor.organizationId);
      }
    } else {
      permissionRows = sanitizePermissionRows(data.permissions);
    }

    const role = await this.repo.createWithPermissions({
      organizationId: actor.organizationId,
      code,
      name,
      nameNepali: data.nameNepali ? (data.nameNepali as string).trim() : null,
      description: data.description ? (data.description as string).trim() : null,
      permissions: JSON.stringify(data.permissionKeys ?? []),
      isSystem: false,
      status: data.status === 'Inactive' ? 'Inactive' : 'Active',
      sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0,
      createdBy: actor.userId,
    }, permissionRows);

    await this.writeAudit(actor, 'CREATE', `Created role "${name}" (${code})`);
    return this.repo.findById(role.id, actor.organizationId);
  }

  async update(id: string, data: Record<string, any>, actor: RoleActor) {
    const existing = await this.repo.findById(id, actor.organizationId);
    if (!existing) throw new ApiError(404, 'Role not found');

    const name = (data.name || '').toString().trim();
    if (!name) throw new ApiError(400, 'Role name is required');

    const conflict = await this.repo.findConflict(actor.organizationId, { name, excludeId: id });
    if (conflict) throw new ApiError(409, `Role name "${name}" already exists.`);

    await this.repo.update(id, {
      name,
      nameNepali: data.nameNepali !== undefined ? (data.nameNepali as string).trim() : existing.nameNepali,
      description: data.description !== undefined ? (data.description as string).trim() : existing.description,
      status: data.status === 'Inactive' ? 'Inactive' : existing.status,
      sortOrder: data.sortOrder !== undefined && Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : existing.sortOrder,
      updatedBy: actor.userId,
    });

    if (Array.isArray(data.permissions)) {
      await this.repo.setPermissions(id, actor.organizationId, sanitizePermissionRows(data.permissions), actor.userId);
    }

    await this.writeAudit(actor, 'UPDATE', `Updated role "${existing.name}"`);
    return this.repo.findById(id, actor.organizationId);
  }

  async updateStatus(id: string, status: string, actor: RoleActor) {
    const existing = await this.repo.findById(id, actor.organizationId);
    if (!existing) throw new ApiError(404, 'Role not found');
    const next = status === 'Inactive' ? 'Inactive' : 'Active';
    await this.repo.updateStatus(id, next, actor.userId);
    await this.writeAudit(actor, 'UPDATE', `Set role "${existing.name}" to ${next}`);
    return this.repo.findById(id, actor.organizationId);
  }

  async remove(id: string, actor: RoleActor) {
    const existing = await this.repo.findById(id, actor.organizationId);
    if (!existing) throw new ApiError(404, 'Role not found');
    if (existing.isSystem) throw new ApiError(400, 'System roles cannot be deleted.');
    const users = await this.repo.countUsers(id, actor.organizationId);
    if (users > 0) {
      throw new ApiError(
        409,
        `This role is assigned to ${users} user${users === 1 ? '' : 's'}. Please reassign users before deleting.`
      );
    }
    await this.repo.softDelete(id, actor.userId);
    await this.writeAudit(actor, 'DELETE', `Deleted role "${existing.name}"${existing.code ? ` (${existing.code})` : ''}`);
    return { success: true };
  }

  async getPermissions(id: string, actor: RoleActor) {
    const existing = await this.repo.findById(id, actor.organizationId);
    if (!existing) throw new ApiError(404, 'Role not found');
    return this.repo.getPermissions(id, actor.organizationId);
  }

  async setPermissions(id: string, permissionRows: PermissionRow[], actor: RoleActor) {
    const existing = await this.repo.findById(id, actor.organizationId);
    if (!existing) throw new ApiError(404, 'Role not found');
    const clean = sanitizePermissionRows(permissionRows);
    await this.repo.setPermissions(id, actor.organizationId, clean, actor.userId);
    await this.writeAudit(actor, 'UPDATE', `Updated permissions for role "${existing.name}"`);
    return this.repo.getPermissions(id, actor.organizationId);
  }

  async getUsers(id: string, actor: RoleActor) {
    const existing = await this.repo.findById(id, actor.organizationId);
    if (!existing) throw new ApiError(404, 'Role not found');
    return this.repo.getUsers(id, actor.organizationId);
  }

  async getDataScope(id: string, actor: RoleActor) {
    const existing = await this.repo.findById(id, actor.organizationId);
    if (!existing) throw new ApiError(404, 'Role not found');
    const row = await this.repo.getDataScope(id, actor.organizationId);
    return {
      roleId: id,
      scope: row?.scope ?? 'all',
      actions: row?.actions ?? DEFAULT_DATA_SCOPE_ACTIONS,
    };
  }

  async setDataScope(id: string, data: Record<string, any>, actor: RoleActor) {
    const existing = await this.repo.findById(id, actor.organizationId);
    if (!existing) throw new ApiError(404, 'Role not found');

    const scope = (data.scope || 'all').toString().trim();
    if (!['all', 'branch', 'self'].includes(scope)) {
      throw new ApiError(400, 'Scope must be one of: all, branch, self.');
    }

    const actions = sanitizeDataScopeActions(data.actions);

    const row = await this.repo.setDataScope(id, actor.organizationId, scope, actions, actor.userId);
    await this.writeAudit(actor, 'UPDATE', `Updated data scope (${scope}) for role "${existing.name}"`);
    return {
      roleId: id,
      scope: row.scope,
      actions: row.actions,
    };
  }

  async getCloneSources(actor: RoleActor) {
    const res = await this.repo.findAll({ organizationId: actor.organizationId, limit: 500 });
    return res.data;
  }

  /** Read the per-module approval limits for a role (org-scoped). */
  async getApprovalLimits(id: string, actor: RoleActor) {
    const existing = await this.repo.findById(id, actor.organizationId);
    if (!existing) throw new ApiError(404, 'Role not found');
    return this.repo.getApprovalLimits(id, actor.organizationId);
  }

  /** Replace the per-module approval limits for a role (org-scoped). */
  async putApprovalLimits(id: string, rows: Array<{ moduleKey?: string; min?: number | null; max?: number | null }>, actor: RoleActor) {
    const existing = await this.repo.findById(id, actor.organizationId);
    if (!existing) throw new ApiError(404, 'Role not found');

    const clean = Array.isArray(rows)
      ? rows
          .map((r) => ({
            moduleKey: String(r.moduleKey || '').trim(),
            min: toNullableNum(r.min),
            max: toNullableNum(r.max),
          }))
          .filter((r) => r.moduleKey)
      : [];

    await this.repo.putApprovalLimits(id, actor.organizationId, clean, actor.userId);
    await this.writeAudit(actor, 'UPDATE', `Updated approval limits for role "${existing.name}"`);
    return this.repo.getApprovalLimits(id, actor.organizationId);
  }

  private async writeAudit(actor: RoleActor, action: string, details: string) {
    await this.repo.writeAuditLog({
      organizationId: actor.organizationId,
      timestampBs: getTodayBSFormatted(),
      timestampAd: new Date().toISOString(),
      userName: actor.username || 'System',
      userRole: actor.role || 'org_user',
      userId: actor.userId,
      module: 'Roles',
      action: ROLE_ACTION_LABEL[action] ?? action,
      details,
      ipAddress: actor.ipAddress || '',
      userAgent: actor.userAgent,
    });
  }
}

/** Keep only known categories/actions and coerce granted to boolean. */
function sanitizePermissionRows(rows: PermissionRow[]): PermissionRow[] {
  if (!Array.isArray(rows)) return [];
  const actionKeys = new Set<string>(PERMISSION_ACTIONS.map((a) => a.key));
  const catByKey = new Map<string, string>(PERMISSION_CATEGORIES.map((c) => [c.key, c.label]));
  const clean: PermissionRow[] = [];
  for (const r of rows) {
    if (!r || !catByKey.has(r.key) || !actionKeys.has(r.action)) continue;
    clean.push({
      category: catByKey.get(r.key)!,
      key: r.key,
      action: r.action,
      granted: !!r.granted,
    });
  }
  return clean;
}

/** Default generic data-scope action toggles (view enabled, rest off). */
const DEFAULT_DATA_SCOPE_ACTIONS = {
  view: true,
  create: false,
  edit: false,
  delete: false,
  approve: false,
  export: false,
};

/** Keep only known generic actions and coerce values to boolean. */
function sanitizeDataScopeActions(actions: any): Record<string, boolean> {
  const known = ['view', 'create', 'edit', 'delete', 'approve', 'export'];
  const clean: Record<string, boolean> = { ...DEFAULT_DATA_SCOPE_ACTIONS };
  if (actions && typeof actions === 'object') {
    for (const key of known) {
      if (typeof actions[key] === 'boolean') clean[key] = actions[key];
    }
  }
  return clean;
}

/** Coerce an optional numeric limit; empty/blank/invalid becomes null (no limit). */
function toNullableNum(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
