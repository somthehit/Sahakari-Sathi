/**
 * Module Repository
 * Data access layer for the module management system (platform / super-admin).
 * Every modules.* query excludes soft-deleted rows.
 */
import {
  and, asc, count, desc, eq, ilike, inArray, isNull, or, sql,
} from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  modules, moduleCategories, moduleFeatures, moduleDependencies, moduleVersions,
  moduleSettings, modulePermissions, moduleLicenses, organizationModules,
  organizationModuleFeatures, organizationModuleSettings, organizationModulePermissions,
  moduleLicenseHistory, moduleMarketplace, moduleUsageLogs, moduleInstallationLogs,
  moduleAuditLogs, moduleTemplates, moduleTemplateItems, moduleNotifications,
  moduleHealthChecks, moduleRecommendations,
} from '../../db/schema';
import { organizations } from '../../db/schema/auth';

export interface ModuleListFilter {
  search?: string;
  categoryId?: string;
  category?: string;
  type?: string;
  status?: string;
  licenseType?: string;
  required?: string;
  hasUpdates?: string;
  enabledFor?: string;   // organization id — returns modules assigned to this org
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const moduleFlatSelect = {
  id: modules.id,
  code: modules.code,
  name: modules.name,
  nameNepali: modules.nameNepali,
  shortDescription: modules.shortDescription,
  longDescription: modules.longDescription,
  categoryId: modules.categoryId,
  type: modules.type,
  icon: modules.icon,
  color: modules.color,
  developer: modules.developer,
  website: modules.website,
  versionCurrent: modules.versionCurrent,
  versionLatest: modules.versionLatest,
  licenseType: modules.licenseType,
  status: modules.status,
  isRequired: modules.isRequired,
  isSystem: modules.isSystem,
  isHidden: modules.isHidden,
  autoUpdate: modules.autoUpdate,
  releaseChannel: modules.releaseChannel,
  lastReleasedAt: modules.lastReleasedAt,
  lastCheckedAt: modules.lastCheckedAt,
  rating: modules.rating,
  downloadCount: modules.downloadCount,
  installCount: modules.installCount,
  settingsSchema: modules.settingsSchema,
  screenshots: modules.screenshots,
  sortOrder: modules.sortOrder,
  createdBy: modules.createdBy,
  updatedBy: modules.updatedBy,
  createdAt: modules.createdAt,
  updatedAt: modules.updatedAt,
};

export class ModuleRepository {
  private get db() {
    const db = getDb();
    if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
    return db;
  }

  // ── Modules ────────────────────────────────────────────────────────────────
  async listModules(filter: ModuleListFilter): Promise<Paginated<Record<string, any>>> {
    const conditions: any[] = [isNull(modules.deletedAt), eq(modules.isHidden, false)];
    if (filter.search) {
      const like = `%${filter.search}%`;
      conditions.push(
        or(
          ilike(modules.name, like),
          ilike(modules.code, like),
          ilike(modules.shortDescription, like),
          ilike(modules.developer, like)
        )!
      );
    }
    if (filter.categoryId) conditions.push(eq(modules.categoryId, filter.categoryId));
    if (filter.type && filter.type !== 'All') conditions.push(eq(modules.type, filter.type as any));
    if (filter.status && filter.status !== 'All') conditions.push(eq(modules.status, filter.status as any));
    if (filter.licenseType && filter.licenseType !== 'All') conditions.push(eq(modules.licenseType, filter.licenseType as any));
    if (filter.required === 'true') conditions.push(eq(modules.isRequired, true));
    if (filter.required === 'false') conditions.push(eq(modules.isRequired, false));
    if (filter.hasUpdates === 'true') conditions.push(sql`${modules.versionLatest} <> ${modules.versionCurrent}`);

    const where = and(...conditions);

    const orderByExpr =
      filter.sortBy === 'name' || !filter.sortBy
        ? (filter.sortDir === 'desc' ? desc(modules.name) : asc(modules.name))
      : filter.sortBy === 'createdAt'
        ? (filter.sortDir === 'desc' ? desc(modules.createdAt) : asc(modules.createdAt))
      : filter.sortBy === 'installCount'
        ? (filter.sortDir === 'desc' ? desc(modules.installCount) : asc(modules.installCount))
      : (filter.sortDir === 'desc' ? desc(modules.sortOrder) : asc(modules.sortOrder));

    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, filter.limit ?? 24);

    const rows = await this.db.select(moduleFlatSelect)
      .from(modules)
      .where(where)
      .orderBy(orderByExpr)
      .limit(limit)
      .offset((page - 1) * limit);

    const [{ total }] = await this.db.select({ total: count() }).from(modules).where(where);

    const ids = rows.map((r) => r.id);
    const enriched = await this.enrichModules(rows, ids);

    return { data: enriched, total: Number(total), page, limit, totalPages: Math.ceil(Number(total) / limit) };
  }

  /** Attach category name, feature count, dependency count, org usage counts, health. */
  private async enrichModules(rows: any[], ids: string[]): Promise<any[]> {
    if (rows.length === 0) return [];
    const db = this.db;

    const [cats, featCounts, depCounts, orgCounts, health] = await Promise.all([
      db.select({ id: moduleCategories.id, name: moduleCategories.name, code: moduleCategories.code, color: moduleCategories.color, icon: moduleCategories.icon })
        .from(moduleCategories),
      db.select({ moduleId: moduleFeatures.moduleId, n: count() }).from(moduleFeatures)
        .where(inArray(moduleFeatures.moduleId, ids)).groupBy(moduleFeatures.moduleId),
      db.select({ moduleId: moduleDependencies.moduleId, n: count() }).from(moduleDependencies)
        .where(inArray(moduleDependencies.moduleId, ids)).groupBy(moduleDependencies.moduleId),
      db.select({ moduleId: organizationModules.moduleId, n: count() }).from(organizationModules)
        .where(inArray(organizationModules.moduleId, ids)).groupBy(organizationModules.moduleId),
      db.select({
        moduleId: moduleHealthChecks.moduleId,
        status: moduleHealthChecks.status,
        responseMs: moduleHealthChecks.responseMs,
        uptime: moduleHealthChecks.uptime,
      }).from(moduleHealthChecks)
        .where(inArray(moduleHealthChecks.moduleId, ids))
        .orderBy(desc(moduleHealthChecks.checkedAt)),
    ]);

    const catMap = new Map(cats.map((c) => [c.id, c]));
    const featMap = new Map(featCounts.map((r) => [r.moduleId, Number(r.n)]));
    const depMap = new Map(depCounts.map((r) => [r.moduleId, Number(r.n)]));
    const orgMap = new Map(orgCounts.map((r) => [r.moduleId, Number(r.n)]));
    const healthMap = new Map<string, { status: string; responseMs: number | null; uptime: string | null }>();
    for (const h of health) if (!healthMap.has(h.moduleId)) healthMap.set(h.moduleId, h);

    return rows.map((r) => {
      const cat = r.categoryId ? catMap.get(r.categoryId) : null;
      return {
        ...r,
        category: cat ? { id: cat.id, name: cat.name, code: cat.code, color: cat.color, icon: cat.icon } : null,
        featureCount: featMap.get(r.id) ?? 0,
        dependencyCount: depMap.get(r.id) ?? 0,
        organizationCount: orgMap.get(r.id) ?? 0,
        health: healthMap.get(r.id) ?? { status: 'Unknown', responseMs: null, uptime: null },
        needsUpdate: r.versionLatest !== r.versionCurrent,
      };
    });
  }

  async getModuleDetail(id: string): Promise<Record<string, any> | null> {
    const db = this.db;
    const [row] = await db.select(moduleFlatSelect).from(modules)
      .where(and(eq(modules.id, id), isNull(modules.deletedAt))).limit(1);
    if (!row) return null;

    const [enriched] = await this.enrichModules([row], [id]);
    const detail = enriched ?? row;

    const [cat, features, deps, versions, settings, permissions, licenses, marketplace, health, usageAgg] = await Promise.all([
      row.categoryId
        ? db.select({ id: moduleCategories.id, code: moduleCategories.code, name: moduleCategories.name, icon: moduleCategories.icon, color: moduleCategories.color, description: moduleCategories.description })
          .from(moduleCategories).where(eq(moduleCategories.id, row.categoryId)).limit(1)
        : Promise.resolve([]),
      db.select().from(moduleFeatures).where(eq(moduleFeatures.moduleId, id)).orderBy(moduleFeatures.sortOrder),
      db.select({
        id: moduleDependencies.id,
        moduleId: moduleDependencies.moduleId,
        dependsOnModuleId: moduleDependencies.dependsOnModuleId,
        minVersion: moduleDependencies.minVersion,
        isRequired: moduleDependencies.isRequired,
        note: moduleDependencies.note,
        depCode: modules.code,
        depName: modules.name,
        depIcon: modules.icon,
        depStatus: modules.status,
      }).from(moduleDependencies)
        .innerJoin(modules, eq(moduleDependencies.dependsOnModuleId, modules.id))
        .where(eq(moduleDependencies.moduleId, id)),
      db.select().from(moduleVersions).where(eq(moduleVersions.moduleId, id)).orderBy(desc(moduleVersions.releaseDate)),
      db.select().from(moduleSettings).where(eq(moduleSettings.moduleId, id)).orderBy(moduleSettings.sortOrder),
      db.select().from(modulePermissions).where(eq(modulePermissions.moduleId, id)).orderBy(modulePermissions.sortOrder),
      db.select().from(moduleLicenses).where(eq(moduleLicenses.moduleId, id)).orderBy(moduleLicenses.sortOrder),
      db.select().from(moduleMarketplace).where(eq(moduleMarketplace.moduleId, id)).limit(1),
      db.select({ status: moduleHealthChecks.status, responseMs: moduleHealthChecks.responseMs, uptime: moduleHealthChecks.uptime, checkedAt: moduleHealthChecks.checkedAt })
        .from(moduleHealthChecks).where(eq(moduleHealthChecks.moduleId, id))
        .orderBy(desc(moduleHealthChecks.checkedAt)).limit(5),
      db.select({
        dau: sql<number>`coalesce(sum(${moduleUsageLogs.dau}),0)`,
        mau: sql<number>`coalesce(sum(${moduleUsageLogs.mau}),0)`,
        transactions: sql<number>`coalesce(sum(${moduleUsageLogs.transactions}),0)`,
        apiCalls: sql<number>`coalesce(sum(${moduleUsageLogs.apiCalls}),0)`,
        storageBytes: sql<number>`coalesce(sum(${moduleUsageLogs.storageBytes}),0)`,
        avgResponseMs: sql<number>`coalesce(round(avg(${moduleUsageLogs.avgResponseMs})),0)`,
      }).from(moduleUsageLogs).where(eq(moduleUsageLogs.moduleId, id)),
    ]);

    return {
      ...detail,
      category: cat[0] ?? detail.category ?? null,
      features: features ?? [],
      dependencies: deps ?? [],
      versions: versions ?? [],
      settings: settings ?? [],
      permissions: permissions ?? [],
      licenses: licenses ?? [],
      marketplace: marketplace[0] ?? null,
      healthHistory: health ?? [],
      usage: usageAgg[0] ?? { dau: 0, mau: 0, transactions: 0, apiCalls: 0, storageBytes: 0, avgResponseMs: 0 },
    };
  }

  async createModule(data: Record<string, any>) {
    const rows = await this.db.insert(modules).values(data as typeof modules.$inferInsert).returning();
    return rows[0] ?? null;
  }

  async updateModule(id: string, data: Record<string, any>) {
    const rows = await this.db.update(modules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(modules.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async softDeleteModule(id: string, updatedBy?: string) {
    const rows = await this.db.update(modules)
      .set({ deletedAt: new Date(), updatedBy, updatedAt: new Date() })
      .where(eq(modules.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async findModuleByCode(code: string, excludeId?: string) {
    const rows = await this.db.select({ id: modules.id, code: modules.code, name: modules.name })
      .from(modules)
      .where(and(eq(modules.code, code), isNull(modules.deletedAt), excludeId ? eq(modules.id, excludeId) : undefined))
      .limit(1);
    return rows[0] ?? null;
  }

  async findModuleByName(name: string, excludeId?: string) {
    const rows = await this.db.select({ id: modules.id, name: modules.name })
      .from(modules)
      .where(and(eq(modules.name, name), isNull(modules.deletedAt), excludeId ? eq(modules.id, excludeId) : undefined))
      .limit(1);
    return rows[0] ?? null;
  }

  // ── Dashboard stats ────────────────────────────────────────────────────────
  async getStats() {
    const db = this.db;
    const [moduleCount, coreCount, optionalCount, premiumCount, enabledCount, disabledCount,
      orgModuleCount, orgCount, mostUsed, latestReleased, licenseSum] = await Promise.all([
      db.select({ n: count() }).from(modules).where(isNull(modules.deletedAt)),
      db.select({ n: count() }).from(modules).where(and(isNull(modules.deletedAt), eq(modules.type, 'Core'))),
      db.select({ n: count() }).from(modules).where(and(isNull(modules.deletedAt), eq(modules.type, 'Optional'))),
      db.select({ n: count() }).from(modules).where(and(isNull(modules.deletedAt), inArray(modules.type, ['Premium', 'Enterprise']))),
      db.select({ n: count() }).from(modules).where(and(isNull(modules.deletedAt), eq(modules.status, 'Active'))),
      db.select({ n: count() }).from(modules).where(and(isNull(modules.deletedAt), eq(modules.status, 'Inactive'))),
      db.select({ n: count() }).from(organizationModules),
      db.select({ n: count() }).from(organizations).where(eq(organizations.status, 'Active')),
      db.select({ id: organizationModules.moduleId, n: count() }).from(organizationModules)
        .groupBy(organizationModules.moduleId).orderBy(desc(sql`count(*)`)).limit(1),
      db.select({ id: modules.id, name: modules.name, code: modules.code, versionCurrent: modules.versionCurrent })
        .from(modules).where(isNull(modules.deletedAt))
        .orderBy(desc(modules.lastReleasedAt)).limit(1),
      db.select({ total: sql<string>`coalesce(sum(${moduleLicenses.price}),0)` }).from(moduleLicenses),
    ]);

    return {
      totalModules: Number(moduleCount[0]?.n ?? 0),
      coreModules: Number(coreCount[0]?.n ?? 0),
      optionalModules: Number(optionalCount[0]?.n ?? 0),
      premiumModules: Number(premiumCount[0]?.n ?? 0),
      enabledModules: Number(enabledCount[0]?.n ?? 0),
      disabledModules: Number(disabledCount[0]?.n ?? 0),
      organizationsUsingModules: Number(orgModuleCount[0]?.n ?? 0),
      activeOrganizations: Number(orgCount[0]?.n ?? 0),
      mostUsedModule: mostUsed[0] ? { moduleId: mostUsed[0].id, count: Number(mostUsed[0].n) } : null,
      latestReleasedModule: latestReleased[0] ?? null,
      catalogValue: Number(licenseSum[0]?.total ?? 0),
    };
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  async listCategories(): Promise<any[]> {
    const db = this.db;
    const rows = await db.select({
      id: moduleCategories.id,
      code: moduleCategories.code,
      name: moduleCategories.name,
      icon: moduleCategories.icon,
      color: moduleCategories.color,
      description: moduleCategories.description,
      sortOrder: moduleCategories.sortOrder,
      isActive: moduleCategories.isActive,
    }).from(moduleCategories).where(eq(moduleCategories.isActive, true))
      .orderBy(moduleCategories.sortOrder);

    const counts = await db.select({ categoryId: modules.categoryId, n: count() })
      .from(modules)
      .where(and(isNull(modules.deletedAt), eq(modules.isHidden, false)))
      .groupBy(modules.categoryId);

    const countMap = new Map(counts.map((r) => [r.categoryId, Number(r.n)]));
    return rows.map((r) => ({ ...r, moduleCount: r.id ? (countMap.get(r.id) ?? 0) : 0 }));
  }

  // ── Features ───────────────────────────────────────────────────────────────
  async listFeatures(moduleId: string) {
    return this.db.select().from(moduleFeatures)
      .where(eq(moduleFeatures.moduleId, moduleId))
      .orderBy(moduleFeatures.sortOrder);
  }

  async createFeature(data: Record<string, any>) {
    const rows = await this.db.insert(moduleFeatures).values(data as typeof moduleFeatures.$inferInsert).returning();
    return rows[0] ?? null;
  }

  async batchCreateFeatures(rows: Record<string, any>[]) {
    if (rows.length === 0) return [];
    const inserted = await this.db.insert(moduleFeatures).values(rows as any[]).onConflictDoNothing().returning();
    return inserted;
  }

  async updateFeature(id: string, data: Record<string, any>) {
    const rows = await this.db.update(moduleFeatures)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(moduleFeatures.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async deleteFeature(id: string) {
    await this.db.delete(moduleFeatures).where(eq(moduleFeatures.id, id));
    return { success: true };
  }

  async findFeatureByCode(moduleId: string, code: string) {
    const rows = await this.db.select({ id: moduleFeatures.id }).from(moduleFeatures)
      .where(and(eq(moduleFeatures.moduleId, moduleId), eq(moduleFeatures.code, code))).limit(1);
    return rows[0] ?? null;
  }

  // ── Dependencies ───────────────────────────────────────────────────────────
  async listDependencies(moduleId: string) {
    const db = this.db;
    const rows = await db.select({
      id: moduleDependencies.id,
      moduleId: moduleDependencies.moduleId,
      dependsOnModuleId: moduleDependencies.dependsOnModuleId,
      minVersion: moduleDependencies.minVersion,
      isRequired: moduleDependencies.isRequired,
      note: moduleDependencies.note,
      depCode: modules.code,
      depName: modules.name,
      depIcon: modules.icon,
      depStatus: modules.status,
      depType: modules.type,
    }).from(moduleDependencies)
      .innerJoin(modules, eq(moduleDependencies.dependsOnModuleId, modules.id))
      .where(eq(moduleDependencies.moduleId, moduleId));
    return rows;
  }

  async listDependents(moduleId: string) {
    const db = this.db;
    const rows = await db.select({
      id: moduleDependencies.id,
      moduleId: moduleDependencies.moduleId,
      dependsOnModuleId: moduleDependencies.dependsOnModuleId,
      isRequired: moduleDependencies.isRequired,
      depCode: modules.code,
      depName: modules.name,
    }).from(moduleDependencies)
      .innerJoin(modules, eq(moduleDependencies.moduleId, modules.id))
      .where(eq(moduleDependencies.dependsOnModuleId, moduleId));
    return rows;
  }

  async addDependency(data: Record<string, any>) {
    const rows = await this.db.insert(moduleDependencies)
      .values(data as typeof moduleDependencies.$inferInsert)
      .onConflictDoNothing()
      .returning();
    return rows[0] ?? null;
  }

  async deleteDependency(id: string) {
    await this.db.delete(moduleDependencies).where(eq(moduleDependencies.id, id));
    return { success: true };
  }

  // ── Versions ───────────────────────────────────────────────────────────────
  async listVersions(moduleId: string) {
    return this.db.select().from(moduleVersions)
      .where(eq(moduleVersions.moduleId, moduleId))
      .orderBy(desc(moduleVersions.releaseDate));
  }

  async createVersion(data: Record<string, any>) {
    const rows = await this.db.insert(moduleVersions).values(data as typeof moduleVersions.$inferInsert).returning();
    return rows[0] ?? null;
  }

  async updateVersion(id: string, data: Record<string, any>) {
    const rows = await this.db.update(moduleVersions).set(data).where(eq(moduleVersions.id, id)).returning();
    return rows[0] ?? null;
  }

  async findVersion(moduleId: string, version: string) {
    const rows = await this.db.select({ id: moduleVersions.id }).from(moduleVersions)
      .where(and(eq(moduleVersions.moduleId, moduleId), eq(moduleVersions.version, version))).limit(1);
    return rows[0] ?? null;
  }

  // ── Licenses ───────────────────────────────────────────────────────────────
  async listLicenses(moduleId: string) {
    return this.db.select().from(moduleLicenses)
      .where(eq(moduleLicenses.moduleId, moduleId))
      .orderBy(moduleLicenses.sortOrder);
  }

  async createLicense(data: Record<string, any>) {
    const rows = await this.db.insert(moduleLicenses).values(data as typeof moduleLicenses.$inferInsert).returning();
    return rows[0] ?? null;
  }

  async updateLicense(id: string, data: Record<string, any>) {
    const rows = await this.db.update(moduleLicenses)
      .set({ ...data, updatedAt: new Date() }).where(eq(moduleLicenses.id, id)).returning();
    return rows[0] ?? null;
  }

  async deleteLicense(id: string) {
    await this.db.delete(moduleLicenses).where(eq(moduleLicenses.id, id));
    return { success: true };
  }

  // ── Settings definitions ───────────────────────────────────────────────────
  async listSettings(moduleId: string) {
    return this.db.select().from(moduleSettings)
      .where(eq(moduleSettings.moduleId, moduleId))
      .orderBy(moduleSettings.sortOrder);
  }

  async upsertSetting(data: Record<string, any>) {
    const rows = await this.db.insert(moduleSettings)
      .values(data as typeof moduleSettings.$inferInsert)
      .onConflictDoUpdate({ target: [moduleSettings.moduleId, moduleSettings.key], set: {
        label: sql.raw(`excluded.label`) as any,
        type: sql.raw(`excluded.type`) as any,
        groupName: sql.raw(`excluded.group_name`) as any,
        defaultValue: sql.raw(`excluded.default_value`) as any,
        options: sql.raw(`excluded.options`) as any,
        isRequired: sql.raw(`excluded.is_required`) as any,
        sortOrder: sql.raw(`excluded.sort_order`) as any,
        updatedAt: new Date(),
      }})
      .returning();
    return rows[0] ?? null;
  }

  async deleteSetting(id: string) {
    await this.db.delete(moduleSettings).where(eq(moduleSettings.id, id));
    return { success: true };
  }

  // ── Permission catalog ─────────────────────────────────────────────────────
  async listPermissions(moduleId: string) {
    return this.db.select().from(modulePermissions)
      .where(eq(modulePermissions.moduleId, moduleId))
      .orderBy(modulePermissions.sortOrder);
  }

  async upsertPermission(data: Record<string, any>) {
    const rows = await this.db.insert(modulePermissions)
      .values(data as typeof modulePermissions.$inferInsert)
      .onConflictDoUpdate({ target: [modulePermissions.moduleId, modulePermissions.action], set: {
        label: sql.raw(`excluded.label`) as any,
        sortOrder: sql.raw(`excluded.sort_order`) as any,
      }})
      .returning();
    return rows[0] ?? null;
  }

  async deletePermission(id: string) {
    await this.db.delete(modulePermissions).where(eq(modulePermissions.id, id));
    return { success: true };
  }

  // ── Assignments ────────────────────────────────────────────────────────────
  async listAssignmentsForModule(moduleId: string) {
    const db = this.db;
    const rows = await db.select({
      id: organizationModules.id,
      organizationId: organizationModules.organizationId,
      moduleId: organizationModules.moduleId,
      status: organizationModules.status,
      licenseId: organizationModules.licenseId,
      isTrial: organizationModules.isTrial,
      activationDate: organizationModules.activationDate,
      expiryDate: organizationModules.expiryDate,
      autoRenew: organizationModules.autoRenew,
      graceDays: organizationModules.graceDays,
      notes: organizationModules.notes,
      versionInstalled: organizationModules.versionInstalled,
      createdAt: organizationModules.createdAt,
      updatedAt: organizationModules.updatedAt,
      orgName: organizations.organizationName,
      orgCode: organizations.organizationCode,
      orgStatus: organizations.status,
      licenseName: moduleLicenses.name,
      licenseType: moduleLicenses.type,
    }).from(organizationModules)
      .innerJoin(organizations, eq(organizationModules.organizationId, organizations.id))
      .leftJoin(moduleLicenses, eq(organizationModules.licenseId, moduleLicenses.id))
      .where(eq(organizationModules.moduleId, moduleId))
      .orderBy(organizations.organizationName);
    return rows;
  }

  async listAssignmentsForOrg(organizationId: string) {
    const db = this.db;
    const rows = await db.select({
      id: organizationModules.id,
      organizationId: organizationModules.organizationId,
      moduleId: organizationModules.moduleId,
      status: organizationModules.status,
      licenseId: organizationModules.licenseId,
      isTrial: organizationModules.isTrial,
      activationDate: organizationModules.activationDate,
      expiryDate: organizationModules.expiryDate,
      autoRenew: organizationModules.autoRenew,
      notes: organizationModules.notes,
      versionInstalled: organizationModules.versionInstalled,
      moduleCode: modules.code,
      moduleName: modules.name,
      moduleIcon: modules.icon,
      moduleType: modules.type,
      licenseName: moduleLicenses.name,
      licenseType: moduleLicenses.type,
    }).from(organizationModules)
      .innerJoin(modules, eq(organizationModules.moduleId, modules.id))
      .leftJoin(moduleLicenses, eq(organizationModules.licenseId, moduleLicenses.id))
      .where(and(eq(organizationModules.organizationId, organizationId), isNull(modules.deletedAt)));
    return rows;
  }

  async assignModules(payload: {
    organizationIds: string[];
    moduleIds: string[];
    status?: string;
    licenseId?: string | null;
    isTrial?: boolean;
    activationDate?: Date | null;
    expiryDate?: Date | null;
    autoRenew?: boolean;
    notes?: string;
    createdBy?: string;
  }) {
    const db = this.db;
    const { organizationIds, moduleIds, createdBy, ...rest } = payload;
    let count = 0;
    await db.transaction(async (tx) => {
      for (const orgId of organizationIds) {
        for (const modId of moduleIds) {
          const values: any = { organizationId: orgId, moduleId: modId, createdBy, ...rest };
          const inserted = await tx.insert(organizationModules)
            .values(values)
            .onConflictDoUpdate({
              target: [organizationModules.organizationId, organizationModules.moduleId],
              set: {
                status: sql.raw(`excluded.status`) as any,
                licenseId: sql.raw(`excluded.license_id`) as any,
                isTrial: sql.raw(`excluded.is_trial`) as any,
                activationDate: sql.raw(`excluded.activation_date`) as any,
                expiryDate: sql.raw(`excluded.expiry_date`) as any,
                autoRenew: sql.raw(`excluded.auto_renew`) as any,
                notes: sql.raw(`excluded.notes`) as any,
                updatedBy: createdBy,
                updatedAt: new Date(),
              },
            })
            .returning();
          if (inserted.length > 0) count += 1;
        }
      }
    });
    return { count };
  }

  async unassignModules(organizationIds: string[], moduleIds: string[]) {
    const db = this.db;
    const deleted = await db.delete(organizationModules)
      .where(
        and(
          inArray(organizationModules.organizationId, organizationIds),
          inArray(organizationModules.moduleId, moduleIds)
        )
      )
      .returning();
    return { count: deleted.length };
  }

  async updateAssignment(id: string, data: Record<string, any>) {
    const rows = await this.db.update(organizationModules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizationModules.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async toggleOrgModule(organizationId: string, moduleId: string, status: string, updatedBy?: string) {
    const rows = await this.db.insert(organizationModules)
      .values({ organizationId, moduleId, status: status as any, updatedBy })
      .onConflictDoUpdate({
        target: [organizationModules.organizationId, organizationModules.moduleId],
        set: { status: status as any, updatedBy, updatedAt: new Date() },
      })
      .returning();
    return rows[0] ?? null;
  }

  // ── Org-level features / settings / permissions ────────────────────────────
  async listOrgFeatures(organizationId: string, moduleId: string) {
    return this.db.select().from(organizationModuleFeatures)
      .where(and(
        eq(organizationModuleFeatures.organizationId, organizationId),
        eq(organizationModuleFeatures.moduleId, moduleId)
      ));
  }

  async setOrgFeature(organizationId: string, moduleId: string, featureId: string, enabled: boolean, updatedBy?: string) {
    const rows = await this.db.insert(organizationModuleFeatures)
      .values({ organizationId, moduleId, featureId, enabled, updatedBy })
      .onConflictDoUpdate({
        target: [organizationModuleFeatures.organizationId, organizationModuleFeatures.moduleId, organizationModuleFeatures.featureId],
        set: { enabled, updatedBy, updatedAt: new Date() },
      })
      .returning();
    return rows[0] ?? null;
  }

  async listOrgSettings(organizationId: string, moduleId: string) {
    return this.db.select().from(organizationModuleSettings)
      .where(and(
        eq(organizationModuleSettings.organizationId, organizationId),
        eq(organizationModuleSettings.moduleId, moduleId)
      ));
  }

  async setOrgSetting(organizationId: string, moduleId: string, key: string, value: any, updatedBy?: string) {
    const rows = await this.db.insert(organizationModuleSettings)
      .values({ organizationId, moduleId, key, value, updatedBy })
      .onConflictDoUpdate({
        target: [organizationModuleSettings.organizationId, organizationModuleSettings.moduleId, organizationModuleSettings.key],
        set: { value, updatedBy, updatedAt: new Date() },
      })
      .returning();
    return rows[0] ?? null;
  }

  async listOrgPermissions(organizationId: string, moduleId: string) {
    return this.db.select().from(organizationModulePermissions)
      .where(and(
        eq(organizationModulePermissions.organizationId, organizationId),
        eq(organizationModulePermissions.moduleId, moduleId)
      ));
  }

  async setOrgPermission(organizationId: string, moduleId: string, role: string, action: string, granted: boolean, updatedBy?: string) {
    const rows = await this.db.insert(organizationModulePermissions)
      .values({ organizationId, moduleId, role, action, granted, updatedBy })
      .onConflictDoUpdate({
        target: [organizationModulePermissions.organizationId, organizationModulePermissions.moduleId, organizationModulePermissions.role, organizationModulePermissions.action],
        set: { granted, updatedBy, updatedAt: new Date() },
      })
      .returning();
    return rows[0] ?? null;
  }

  // ── Usage / analytics ──────────────────────────────────────────────────────
  async usageTimeSeries(moduleId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const rows = await this.db.select({
      date: moduleUsageLogs.date,
      dau: sql<number>`coalesce(sum(${moduleUsageLogs.dau}),0)`,
      mau: sql<number>`coalesce(sum(${moduleUsageLogs.mau}),0)`,
      transactions: sql<number>`coalesce(sum(${moduleUsageLogs.transactions}),0)`,
      apiCalls: sql<number>`coalesce(sum(${moduleUsageLogs.apiCalls}),0)`,
      storageBytes: sql<number>`coalesce(sum(${moduleUsageLogs.storageBytes}),0)`,
      avgResponseMs: sql<number>`coalesce(round(avg(${moduleUsageLogs.avgResponseMs})),0)`,
      orgCount: sql<number>`count(distinct ${moduleUsageLogs.organizationId})`,
    }).from(moduleUsageLogs)
      .where(and(eq(moduleUsageLogs.moduleId, moduleId), gteDate(moduleUsageLogs.date, since)))
      .groupBy(moduleUsageLogs.date)
      .orderBy(asc(moduleUsageLogs.date));
    return rows;
  }

  async topOrganizations(moduleId: string, limit = 10) {
    const db = this.db;
    const rows = await db.select({
      organizationId: moduleUsageLogs.organizationId,
      orgName: organizations.organizationName,
      orgCode: organizations.organizationCode,
      transactions: sql<number>`coalesce(sum(${moduleUsageLogs.transactions}),0)`,
      apiCalls: sql<number>`coalesce(sum(${moduleUsageLogs.apiCalls}),0)`,
      dau: sql<number>`coalesce(sum(${moduleUsageLogs.dau}),0)`,
    }).from(moduleUsageLogs)
      .innerJoin(organizations, eq(moduleUsageLogs.organizationId, organizations.id))
      .where(eq(moduleUsageLogs.moduleId, moduleId))
      .groupBy(moduleUsageLogs.organizationId, organizations.organizationName, organizations.organizationCode)
      .orderBy(desc(sql`coalesce(sum(${moduleUsageLogs.transactions}),0)`))
      .limit(limit);
    return rows;
  }

  async recordUsage(rows: Array<Record<string, any>>) {
    if (rows.length === 0) return;
    await this.db.insert(moduleUsageLogs).values(rows as any[]).onConflictDoNothing();
  }

  // ── Audit ──────────────────────────────────────────────────────────────────
  async writeAudit(data: Record<string, any>) {
    try {
      await this.db.insert(moduleAuditLogs).values(data as any);
    } catch (err) {
      console.error('Failed to write module audit log:', err);
    }
  }

  async listAuditLogs(filter: { moduleId?: string; limit?: number; offset?: number } = {}) {
    const conditions: any[] = [];
    if (filter.moduleId) conditions.push(eq(moduleAuditLogs.moduleId, filter.moduleId));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, [{ total }]] = await Promise.all([
      this.db.select({
        id: moduleAuditLogs.id,
        organizationId: moduleAuditLogs.organizationId,
        moduleId: moduleAuditLogs.moduleId,
        action: moduleAuditLogs.action,
        oldValue: moduleAuditLogs.oldValue,
        newValue: moduleAuditLogs.newValue,
        ipAddress: moduleAuditLogs.ipAddress,
        userAgent: moduleAuditLogs.userAgent,
        createdBy: moduleAuditLogs.createdBy,
        createdAt: moduleAuditLogs.createdAt,
        moduleName: modules.name,
        moduleCode: modules.code,
        orgName: organizations.organizationName,
      }).from(moduleAuditLogs)
        .leftJoin(modules, eq(moduleAuditLogs.moduleId, modules.id))
        .leftJoin(organizations, eq(moduleAuditLogs.organizationId, organizations.id))
        .where(where)
        .orderBy(desc(moduleAuditLogs.createdAt))
        .limit(Math.min(200, filter.limit ?? 50))
        .offset(filter.offset ?? 0),
      this.db.select({ total: count() }).from(moduleAuditLogs).where(where),
    ]);
    return { data: rows, total: Number(total) };
  }

  // ── Notifications ──────────────────────────────────────────────────────────
  async createNotification(data: Record<string, any>) {
    await this.db.insert(moduleNotifications).values(data as any);
    return { success: true };
  }

  async listNotifications(filter: { moduleId?: string; limit?: number } = {}) {
    const conditions: any[] = [];
    if (filter.moduleId) conditions.push(eq(moduleNotifications.moduleId, filter.moduleId));
    const where = conditions.length ? and(...conditions) : undefined;
    return this.db.select().from(moduleNotifications)
      .where(where)
      .orderBy(desc(moduleNotifications.createdAt))
      .limit(Math.min(100, filter.limit ?? 30));
  }

  // ── Templates ──────────────────────────────────────────────────────────────
  async listTemplates() {
    const db = this.db;
    const rows = await db.select().from(moduleTemplates)
      .where(eq(moduleTemplates.isActive, true))
      .orderBy(moduleTemplates.createdAt);
    const items = await db.select({
      id: moduleTemplateItems.id,
      templateId: moduleTemplateItems.templateId,
      moduleId: moduleTemplateItems.moduleId,
      licenseId: moduleTemplateItems.licenseId,
      config: moduleTemplateItems.config,
      sortOrder: moduleTemplateItems.sortOrder,
      moduleCode: modules.code,
      moduleName: modules.name,
      moduleIcon: modules.icon,
      moduleType: modules.type,
    }).from(moduleTemplateItems)
      .innerJoin(modules, eq(moduleTemplateItems.moduleId, modules.id));
    const map = new Map<string, any[]>();
    for (const it of items) {
      const arr = map.get(it.templateId) ?? [];
      arr.push(it);
      map.set(it.templateId, arr);
    }
    return rows.map((r) => ({ ...r, items: map.get(r.id) ?? [] }));
  }

  async createTemplate(data: Record<string, any>, items: Array<Record<string, any>>) {
    const db = this.db;
    return db.transaction(async (tx) => {
      const [tpl] = await tx.insert(moduleTemplates)
        .values({ code: data.code, name: data.name, description: data.description, category: data.category, icon: data.icon })
        .returning();
      if (items.length > 0) {
        await tx.insert(moduleTemplateItems).values(items.map((it, i) => ({ ...it, templateId: tpl.id, sortOrder: i })) as any[]);
      }
      return tpl;
    });
  }

  async deleteTemplate(id: string) {
    await this.db.delete(moduleTemplates).where(eq(moduleTemplates.id, id));
    return { success: true };
  }

  // ── Recommendations ────────────────────────────────────────────────────────
  async listRecommendations() {
    const db = this.db;
    return db.select({
      id: moduleRecommendations.id,
      organizationId: moduleRecommendations.organizationId,
      moduleId: moduleRecommendations.moduleId,
      reason: moduleRecommendations.reason,
      priority: moduleRecommendations.priority,
      score: moduleRecommendations.score,
      status: moduleRecommendations.status,
      createdAt: moduleRecommendations.createdAt,
      orgName: organizations.organizationName,
      orgCode: organizations.organizationCode,
      moduleCode: modules.code,
      moduleName: modules.name,
      moduleIcon: modules.icon,
    }).from(moduleRecommendations)
      .innerJoin(organizations, eq(moduleRecommendations.organizationId, organizations.id))
      .innerJoin(modules, eq(moduleRecommendations.moduleId, modules.id))
      .orderBy(desc(moduleRecommendations.priority), desc(moduleRecommendations.createdAt))
      .limit(50);
  }

  async createRecommendations(rows: Array<Record<string, any>>) {
    if (rows.length === 0) return;
    await this.db.insert(moduleRecommendations).values(rows as any[]).onConflictDoNothing();
  }

  async updateRecommendationStatus(id: string, status: string) {
    const rows = await this.db.update(moduleRecommendations)
      .set({ status }).where(eq(moduleRecommendations.id, id)).returning();
    return rows[0] ?? null;
  }

  // ── Marketplace ────────────────────────────────────────────────────────────
  async upsertMarketplace(data: Record<string, any>) {
    const rows = await this.db.insert(moduleMarketplace)
      .values(data as typeof moduleMarketplace.$inferInsert)
      .onConflictDoUpdate({ target: [moduleMarketplace.moduleId], set: {
        status: sql.raw(`excluded.status`) as any,
        price: sql.raw(`excluded.price`) as any,
        pricing: sql.raw(`excluded.pricing`) as any,
        screenshots: sql.raw(`excluded.screenshots`) as any,
        docsUrl: sql.raw(`excluded.docs_url`) as any,
        rating: sql.raw(`excluded.rating`) as any,
        compatibility: sql.raw(`excluded.compatibility`) as any,
        featured: sql.raw(`excluded.featured`) as any,
        publishedAt: sql.raw(`excluded.published_at`) as any,
        updatedAt: new Date(),
      }})
      .returning();
    return rows[0] ?? null;
  }

  // ── Installation log ───────────────────────────────────────────────────────
  async createInstallationLog(data: Record<string, any>) {
    await this.db.insert(moduleInstallationLogs).values(data as any);
    return { success: true };
  }

  async listInstallationLogs(moduleId?: string, limit = 30) {
    const where = moduleId ? eq(moduleInstallationLogs.moduleId, moduleId) : undefined;
    const db = this.db;
    return db.select({
      id: moduleInstallationLogs.id,
      organizationId: moduleInstallationLogs.organizationId,
      moduleId: moduleInstallationLogs.moduleId,
      action: moduleInstallationLogs.action,
      version: moduleInstallationLogs.version,
      status: moduleInstallationLogs.status,
      details: moduleInstallationLogs.details,
      createdBy: moduleInstallationLogs.createdBy,
      createdAt: moduleInstallationLogs.createdAt,
      moduleName: modules.name,
      orgName: organizations.organizationName,
    }).from(moduleInstallationLogs)
      .leftJoin(modules, eq(moduleInstallationLogs.moduleId, modules.id))
      .leftJoin(organizations, eq(moduleInstallationLogs.organizationId, organizations.id))
      .where(where)
      .orderBy(desc(moduleInstallationLogs.createdAt))
      .limit(limit);
  }

  // ── Organizations list (for assignment dialogs) ────────────────────────────
  async listOrganizations(filter: { search?: string; page?: number; limit?: number } = {}) {
    const conditions: any[] = [eq(organizations.status, 'Active')];
    if (filter.search) conditions.push(ilike(organizations.organizationName, `%${filter.search}%`));
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, filter.limit ?? 20);
    const [rows, [{ total }]] = await Promise.all([
      this.db.select({ id: organizations.id, organizationCode: organizations.organizationCode, organizationName: organizations.organizationName, organizationType: organizations.organizationType, status: organizations.status })
        .from(organizations).where(and(...conditions))
        .orderBy(organizations.organizationName)
        .limit(limit).offset((page - 1) * limit),
      this.db.select({ total: count() }).from(organizations).where(and(...conditions)),
    ]);
    return { data: rows, total: Number(total), page, limit };
  }
}

/** SQL helper for "date >= date" (moduleUsageLogs.date is a date column). */
function gteDate(col: any, date: Date) {
  return sql`${col} >= ${date.toISOString().slice(0, 10)}::date`;
}
