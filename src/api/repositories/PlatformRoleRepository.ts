/**
 * Platform Role Repository
 * Data access layer for the platform-level roles tables (no organization).
 * Every query excludes soft-deleted rows. Used only by super admins.
 */
import { and, asc, count, desc, eq, ilike, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { platformRoles, platformRolePermissions, platformRoleDataScopes } from '../../db/schema';

export interface PlatformRoleFilter {
  search?: string;
  status?: string;   // 'Active' | 'Inactive' | 'All'
  system?: string;   // 'System' | 'Custom' | 'All'
  sortBy?: string;   // 'name' | 'code' | 'createdAt'
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

const roleFlatSelect = {
  id: platformRoles.id,
  code: platformRoles.code,
  name: platformRoles.name,
  nameNepali: platformRoles.nameNepali,
  description: platformRoles.description,
  permissions: platformRoles.permissions,
  isSystem: platformRoles.isSystem,
  status: platformRoles.status,
  sortOrder: platformRoles.sortOrder,
  createdBy: platformRoles.createdBy,
  updatedBy: platformRoles.updatedBy,
  createdAt: platformRoles.createdAt,
  updatedAt: platformRoles.updatedAt,
};

export class PlatformRoleRepository {
  private get db() {
    const db = getDb();
    if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
    return db;
  }

  async findAll(filter: PlatformRoleFilter = {}): Promise<PaginatedResult<Record<string, any>>> {
    const {
      search, status, system,
      sortBy = 'name', sortDir = 'asc', page = 1, limit = 10,
    } = filter;

    const conditions: SQL[] = [isNull(platformRoles.deletedAt)];
    if (search) {
      const like = `%${search}%`;
      conditions.push(
        or(
          ilike(platformRoles.code, like),
          ilike(platformRoles.name, like),
          ilike(platformRoles.nameNepali, like)
        )!
      );
    }
    if (status && status !== 'All') conditions.push(eq(platformRoles.status, status as any));
    if (system && system !== 'All') conditions.push(eq(platformRoles.isSystem, system === 'System'));

    const where = and(...conditions);

    const orderByExpr =
      sortBy === 'code' ? (sortDir === 'desc' ? desc(platformRoles.code) : asc(platformRoles.code))
      : sortBy === 'createdAt' ? (sortDir === 'desc' ? desc(platformRoles.createdAt) : asc(platformRoles.createdAt))
      : (sortDir === 'desc' ? desc(platformRoles.name) : asc(platformRoles.name));

    const [data, totalResult] = await Promise.all([
      this.db.select(roleFlatSelect)
        .from(platformRoles)
        .where(where)
        .orderBy(orderByExpr)
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ count: count() }).from(platformRoles).where(where),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const results = await this.db.select(roleFlatSelect)
      .from(platformRoles)
      .where(and(eq(platformRoles.id, id), isNull(platformRoles.deletedAt)))
      .limit(1);
    return results[0] ?? null;
  }

  async findConflict(opts: { code?: string; name?: string; excludeId?: string }) {
    const conditions: SQL[] = [isNull(platformRoles.deletedAt)];
    if (opts.excludeId) conditions.push(ne(platformRoles.id, opts.excludeId));
    if (opts.code) conditions.push(eq(platformRoles.code, opts.code));
    if (opts.name) conditions.push(eq(platformRoles.name, opts.name));
    const results = await this.db.select({
      id: platformRoles.id, code: platformRoles.code, name: platformRoles.name,
    }).from(platformRoles).where(and(...conditions)).limit(1);
    return results[0] ?? null;
  }

  async create(data: Record<string, any>) {
    const results = await this.db.insert(platformRoles).values(data as typeof platformRoles.$inferInsert).returning();
    return results[0] ?? null;
  }

  async update(id: string, data: Record<string, any>) {
    const results = await this.db.update(platformRoles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(platformRoles.id, id))
      .returning();
    return results[0] ?? null;
  }

  async softDelete(id: string, updatedBy?: string) {
    const results = await this.db.update(platformRoles)
      .set({ deletedAt: new Date(), updatedBy, updatedAt: new Date() })
      .where(eq(platformRoles.id, id))
      .returning();
    return results[0] ?? null;
  }

  async getPermissions(roleId: string): Promise<PermissionRow[]> {
    const rows = await this.db.select({
      category: platformRolePermissions.category,
      key: platformRolePermissions.key,
      action: platformRolePermissions.action,
      granted: platformRolePermissions.granted,
    })
      .from(platformRolePermissions)
      .where(eq(platformRolePermissions.roleId, roleId));
    return rows.map((r) => ({
      category: r.category,
      key: r.key,
      action: r.action,
      granted: r.granted,
    }));
  }

  async setPermissions(roleId: string, permissions: PermissionRow[], updatedBy?: string) {
    return this.db.transaction(async (tx) => {
      await tx.delete(platformRolePermissions).where(eq(platformRolePermissions.roleId, roleId));
      if (permissions.length > 0) {
        await tx.insert(platformRolePermissions).values(
          permissions.map((p) => ({
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

  async getDataScope(roleId: string) {
    const results = await this.db.select({
      scope: platformRoleDataScopes.scope,
      actions: platformRoleDataScopes.actions,
      updatedAt: platformRoleDataScopes.updatedAt,
    })
      .from(platformRoleDataScopes)
      .where(eq(platformRoleDataScopes.roleId, roleId))
      .limit(1);
    return results[0] ?? null;
  }

  async setDataScope(roleId: string, scope: string, actions: Record<string, boolean>, updatedBy?: string) {
    const existing = await this.getDataScope(roleId);
    if (existing) {
      const [row] = await this.db.update(platformRoleDataScopes)
        .set({ scope: scope as any, actions: actions as any, updatedBy, updatedAt: new Date() })
        .where(eq(platformRoleDataScopes.roleId, roleId))
        .returning();
      return row ?? null;
    }
    const [row] = await this.db.insert(platformRoleDataScopes)
      .values({ roleId, scope: scope as any, actions: actions as any, createdBy: updatedBy, updatedBy })
      .returning();
    return row ?? null;
  }
}
