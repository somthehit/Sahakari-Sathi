/**
 * Role Repository
 * Data access layer for the roles + role_permissions tables.
 * Every query is scoped by organization_id so one tenant can never read
 * another tenant's roles.
 */
import { and, asc, count, desc, eq, ilike, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { roles, orgUsers, rolePermissions, roleDataScopes, roleApprovalLimits, auditLogs } from '../../db/schema';

export interface RoleFilter {
  organizationId?: string;
  search?: string;
  status?: string;   // 'Active' | 'Inactive' | 'All'
  system?: string;   // 'System' | 'Custom' | 'All'
  sortBy?: string;   // 'name' | 'code' | 'users' | 'createdAt'
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PermissionRow {
  category: string;
  key: string;
  action: string;
  granted: boolean;
}

/** Subquery: number of org_users assigned to each role. */
const usersCountExpr = sql<number>`(SELECT COUNT(*)::int FROM org_users ou WHERE ou.role_id = roles.id)`;

const roleFlatSelect = {
  id: roles.id,
  organizationId: roles.organizationId,
  code: roles.code,
  name: roles.name,
  nameNepali: roles.nameNepali,
  description: roles.description,
  permissions: roles.permissions,
  isSystem: roles.isSystem,
  status: roles.status,
  sortOrder: roles.sortOrder,
  createdBy: roles.createdBy,
  updatedBy: roles.updatedBy,
  createdAt: roles.createdAt,
  updatedAt: roles.updatedAt,
  usersCount: usersCountExpr,
};

export class RoleRepository {
  private get db() {
    const db = getDb();
    if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
    return db;
  }

  async findAll(filter: RoleFilter = {}): Promise<PaginatedResult<Record<string, any>>> {
    const {
      organizationId, search, status, system,
      sortBy = 'name', sortDir = 'asc', page = 1, limit = 10,
    } = filter;

    const conditions: SQL[] = [isNull(roles.deletedAt)];
    if (organizationId) conditions.push(eq(roles.organizationId, organizationId));
    if (search) {
      const like = `%${search}%`;
      conditions.push(
        or(
          ilike(roles.code, like),
          ilike(roles.name, like),
          ilike(roles.nameNepali, like)
        )!
      );
    }
    if (status && status !== 'All') conditions.push(eq(roles.status, status as any));
    if (system && system !== 'All') conditions.push(eq(roles.isSystem, system === 'System'));

    const where = and(...conditions);

    const orderByExpr =
      sortBy === 'code' ? (sortDir === 'desc' ? desc(roles.code) : asc(roles.code))
      : sortBy === 'createdAt' ? (sortDir === 'desc' ? desc(roles.createdAt) : asc(roles.createdAt))
      : sortBy === 'users' ? (sortDir === 'desc' ? desc(usersCountExpr) : asc(usersCountExpr))
      : (sortDir === 'desc' ? desc(roles.name) : asc(roles.name));

    const [data, totalResult] = await Promise.all([
      this.db.select(roleFlatSelect)
        .from(roles)
        .where(where)
        .orderBy(orderByExpr)
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ count: count() }).from(roles).where(where),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, organizationId?: string) {
    const conditions: SQL[] = [eq(roles.id, id), isNull(roles.deletedAt)];
    if (organizationId) conditions.push(eq(roles.organizationId, organizationId));
    const results = await this.db.select(roleFlatSelect)
      .from(roles)
      .where(and(...conditions))
      .limit(1);
    return results[0] ?? null;
  }

  /** Find a role conflicting on code OR name within the org (excluding optional id). */
  async findConflict(organizationId: string, opts: { code?: string; name?: string; excludeId?: string }) {
    const conditions: SQL[] = [eq(roles.organizationId, organizationId), isNull(roles.deletedAt)];
    if (opts.excludeId) conditions.push(ne(roles.id, opts.excludeId));
    if (opts.code) conditions.push(eq(roles.code, opts.code));
    if (opts.name) conditions.push(eq(roles.name, opts.name));
    const results = await this.db.select({
      id: roles.id, code: roles.code, name: roles.name,
    }).from(roles).where(and(...conditions)).limit(1);
    return results[0] ?? null;
  }

  async create(data: Record<string, any>) {
    const results = await this.db.insert(roles).values(data as typeof roles.$inferInsert).returning();
    return results[0] ?? null;
  }

  /** Insert role + its permission rows in one transaction (used for create/clone). */
  async createWithPermissions(data: Record<string, any>, permissions: PermissionRow[]) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.insert(roles).values(data as typeof roles.$inferInsert).returning();
      if (permissions.length > 0) {
        await tx.insert(rolePermissions).values(
          permissions.map((p) => ({
            organizationId: data.organizationId,
            roleId: row.id,
            category: p.category,
            key: p.key,
            action: p.action,
            granted: p.granted,
            createdBy: data.createdBy,
          }))
        );
      }
      return row;
    });
  }

  async update(id: string, data: Record<string, any>) {
    const results = await this.db.update(roles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(roles.id, id))
      .returning();
    return results[0] ?? null;
  }

  async updateStatus(id: string, status: string, updatedBy?: string) {
    const results = await this.db.update(roles)
      .set({ status: status as any, updatedBy, updatedAt: new Date() })
      .where(eq(roles.id, id))
      .returning();
    return results[0] ?? null;
  }

  /** Soft delete: mark deletedAt + audit fields. */
  async softDelete(id: string, updatedBy?: string) {
    const results = await this.db.update(roles)
      .set({ deletedAt: new Date(), updatedBy, updatedAt: new Date() })
      .where(eq(roles.id, id))
      .returning();
    return results[0] ?? null;
  }

  async countUsers(roleId: string, organizationId: string): Promise<number> {
    const results = await this.db.select({ count: count() })
      .from(orgUsers)
      .where(and(eq(orgUsers.roleId, roleId), eq(orgUsers.organizationId, organizationId)));
    return Number(results[0]?.count ?? 0);
  }

  async getUsers(roleId: string, organizationId: string) {
    return this.db.select({
      id: orgUsers.id,
      username: orgUsers.username,
      email: orgUsers.email,
      status: orgUsers.status,
    })
      .from(orgUsers)
      .where(and(eq(orgUsers.roleId, roleId), eq(orgUsers.organizationId, organizationId)))
      .orderBy(asc(orgUsers.username));
  }

  async getPermissions(roleId: string, organizationId: string): Promise<PermissionRow[]> {
    const rows = await this.db.select({
      category: rolePermissions.category,
      key: rolePermissions.key,
      action: rolePermissions.action,
      granted: rolePermissions.granted,
    })
      .from(rolePermissions)
      .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.organizationId, organizationId)));
    return rows.map((r) => ({
      category: r.category,
      key: r.key,
      action: r.action,
      granted: r.granted,
    }));
  }

  /** Replace the full permission set for a role. */
  async setPermissions(roleId: string, organizationId: string, permissions: PermissionRow[], updatedBy?: string) {
    return this.db.transaction(async (tx) => {
      await tx.delete(rolePermissions)
        .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.organizationId, organizationId)));
      if (permissions.length > 0) {
        await tx.insert(rolePermissions).values(
          permissions.map((p) => ({
            organizationId,
            roleId,
            category: p.category,
            key: p.key,
            action: p.action,
            granted: p.granted,
            createdBy: updatedBy,
          }))
        );
      }
    });
  }

  /** Get the data-scope row for a role (or null if never configured). */
  async getDataScope(roleId: string, organizationId: string) {
    const results = await this.db.select({
      scope: roleDataScopes.scope,
      actions: roleDataScopes.actions,
      updatedAt: roleDataScopes.updatedAt,
    })
      .from(roleDataScopes)
      .where(and(eq(roleDataScopes.roleId, roleId), eq(roleDataScopes.organizationId, organizationId)))
      .limit(1);
    return results[0] ?? null;
  }

  /** Upsert the data-scope row for a role. */
  async setDataScope(roleId: string, organizationId: string, scope: string, actions: Record<string, boolean>, updatedBy?: string) {
    const existing = await this.getDataScope(roleId, organizationId);
    if (existing) {
      const [row] = await this.db.update(roleDataScopes)
        .set({ scope: scope as any, actions: actions as any, updatedBy, updatedAt: new Date() })
        .where(and(eq(roleDataScopes.roleId, roleId), eq(roleDataScopes.organizationId, organizationId)))
        .returning();
      return row ?? null;
    }
    const [row] = await this.db.insert(roleDataScopes)
      .values({
        organizationId,
        roleId,
        scope: scope as any,
        actions: actions as any,
        createdBy: updatedBy,
        updatedBy,
      })
      .returning();
    return row ?? null;
  }

  async writeAuditLog(data: {
    organizationId: string;
    timestampBs: string;
    timestampAd: string;
    userName: string;
    userRole: string;
    userId?: string;
    module: string;
    action: string;
    details: string;
    ipAddress: string;
    userAgent?: string;
  }) {
    const results = await this.db.insert(auditLogs).values(data).returning({ id: auditLogs.id });
    return results[0] ?? null;
  }

  /** Per-role approval limits (moduleKey → min/max), scoped to the org. */
  async getApprovalLimits(roleId: string, organizationId: string) {
    const rows = await this.db.select({
      id: roleApprovalLimits.id,
      moduleKey: roleApprovalLimits.moduleKey,
      min: roleApprovalLimits.minAmount,
      max: roleApprovalLimits.maxAmount,
    })
      .from(roleApprovalLimits)
      .where(and(eq(roleApprovalLimits.roleId, roleId), eq(roleApprovalLimits.organizationId, organizationId)))
      .orderBy(asc(roleApprovalLimits.moduleKey));
    return rows;
  }

  /** Replace the full approval-limit set for a role (delete + insert). */
  async putApprovalLimits(
    roleId: string,
    organizationId: string,
    rows: Array<{ moduleKey: string; min: number | null; max: number | null }>,
    updatedBy?: string,
  ) {
    return this.db.transaction(async (tx) => {
      await tx.delete(roleApprovalLimits)
        .where(and(eq(roleApprovalLimits.roleId, roleId), eq(roleApprovalLimits.organizationId, organizationId)));
      if (rows.length > 0) {
        await tx.insert(roleApprovalLimits).values(
          rows.map((r) => ({
            organizationId,
            roleId,
            moduleKey: r.moduleKey,
            minAmount: r.min === null ? null : String(r.min),
            maxAmount: r.max === null ? null : String(r.max),
          }))
        );
      }
    });
  }
}
