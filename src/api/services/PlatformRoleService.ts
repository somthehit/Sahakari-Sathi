/**
 * Platform Role Service
 * Business rules for platform-level (super-admin) roles.
 * Validations + permission/data-scope sanitization, mirroring the tenant
 * RoleService. Audit events are written to auth_audit_logs (event prefixed
 * PLATFORM_ROLE_*).
 */
import { PlatformRoleRepository, type PermissionRow } from '../repositories/PlatformRoleRepository';
import { PERMISSION_ACTIONS, PERMISSION_CATEGORIES } from '../../types/permissions';
import { getDb } from '../../db/client';
import { authAuditLogs } from '../../db/schema';

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface PlatformRoleActor {
  userId?: string;
  username?: string;
}

const DEFAULT_DATA_SCOPE_ACTIONS = {
  view: true,
  create: false,
  edit: false,
  delete: false,
  approve: false,
  export: false,
};

export class PlatformRoleService {
  private repo = new PlatformRoleRepository();

  async list(filter: Record<string, any>) {
    return this.repo.findAll({
      search: filter.search,
      status: filter.status,
      system: filter.system,
      sortBy: filter.sortBy,
      sortDir: filter.sortDir === 'desc' ? 'desc' : 'asc',
      page: filter.page ? Math.max(1, parseInt(filter.page, 10) || 1) : 1,
      limit: filter.limit ? Math.min(100, parseInt(filter.limit, 10) || 10) : 10,
    });
  }

  async get(id: string) {
    const role = await this.repo.findById(id);
    if (!role) throw new ApiError(404, 'Platform role not found');
    return role;
  }

  async create(data: Record<string, any>, actor: PlatformRoleActor) {
    const code = (data.code || '').toString().trim().toUpperCase();
    const name = (data.name || '').toString().trim();
    if (!code) throw new ApiError(400, 'Role code is required');
    if (!name) throw new ApiError(400, 'Role name is required');

    const conflict = await this.repo.findConflict({ code, name });
    if (conflict) {
      if (code && conflict.code === code) throw new ApiError(409, `Role code "${code}" already exists.`);
      throw new ApiError(409, `Role name "${name}" already exists.`);
    }

    const permissionRows = sanitizePermissionRows(data.permissions);

    const role = await this.repo.create({
      code,
      name,
      nameNepali: data.nameNepali ? (data.nameNepali as string).trim() : null,
      description: data.description ? (data.description as string).trim() : null,
      permissions: JSON.stringify(data.permissionKeys ?? []),
      isSystem: false,
      status: data.status === 'Inactive' ? 'Inactive' : 'Active',
      sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0,
      createdBy: actor.userId,
    });

    if (permissionRows.length > 0) {
      await this.repo.setPermissions(role.id, permissionRows, actor.userId);
    }

    await this.writeAudit(actor, 'PLATFORM_ROLE_CREATED', `Created platform role "${name}" (${code})`);
    return this.repo.findById(role.id);
  }

  async update(id: string, data: Record<string, any>, actor: PlatformRoleActor) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ApiError(404, 'Platform role not found');

    const name = data.name !== undefined ? (data.name || '').toString().trim() : existing.name;
    if (data.name !== undefined && !name) throw new ApiError(400, 'Role name is required');

    const conflict = data.name !== undefined ? await this.repo.findConflict({ name, excludeId: id }) : null;
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
      await this.repo.setPermissions(id, sanitizePermissionRows(data.permissions), actor.userId);
    }

    await this.writeAudit(actor, 'PLATFORM_ROLE_UPDATED', `Updated platform role "${existing.name}"`);
    return this.repo.findById(id);
  }

  async remove(id: string, actor: PlatformRoleActor) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ApiError(404, 'Platform role not found');
    if (existing.isSystem) throw new ApiError(400, 'System platform roles cannot be deleted.');
    await this.repo.softDelete(id, actor.userId);
    await this.writeAudit(actor, 'PLATFORM_ROLE_DELETED', `Deleted platform role "${existing.name}"`);
    return { success: true };
  }

  async getPermissions(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ApiError(404, 'Platform role not found');
    return this.repo.getPermissions(id);
  }

  async setPermissions(id: string, permissionRows: PermissionRow[], actor: PlatformRoleActor) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ApiError(404, 'Platform role not found');
    const clean = sanitizePermissionRows(permissionRows);
    await this.repo.setPermissions(id, clean, actor.userId);
    await this.writeAudit(actor, 'PLATFORM_ROLE_PERMISSIONS_UPDATED', `Updated permissions for platform role "${existing.name}"`);
    return this.repo.getPermissions(id);
  }

  async getDataScope(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ApiError(404, 'Platform role not found');
    const row = await this.repo.getDataScope(id);
    return {
      roleId: id,
      scope: row?.scope ?? 'all',
      actions: row?.actions ?? DEFAULT_DATA_SCOPE_ACTIONS,
    };
  }

  async setDataScope(id: string, data: Record<string, any>, actor: PlatformRoleActor) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ApiError(404, 'Platform role not found');

    const scope = (data.scope || 'all').toString().trim();
    if (!['all', 'branch', 'self'].includes(scope)) {
      throw new ApiError(400, 'Scope must be one of: all, branch, self.');
    }

    const actions = sanitizeDataScopeActions(data.actions);

    const row = await this.repo.setDataScope(id, scope, actions, actor.userId);
    await this.writeAudit(actor, 'PLATFORM_ROLE_DATA_SCOPE_UPDATED', `Updated data scope (${scope}) for platform role "${existing.name}"`);
    return {
      roleId: id,
      scope: row.scope,
      actions: row.actions,
    };
  }

  private async writeAudit(actor: PlatformRoleActor, event: string, reason: string) {
    const db = getDb();
    if (!db) return;
    try {
      await db.insert(authAuditLogs).values({
        userId: actor.userId,
        username: actor.username || 'super_admin',
        organizationCode: null,
        event,
        ipAddress: '',
        success: true,
        reason,
      });
    } catch (err) {
      console.error('Failed to write platform role audit log:', err);
    }
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
