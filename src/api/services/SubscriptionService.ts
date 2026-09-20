/**
 * Subscription Service
 * Business rules for subscription plan management, organization subscriptions,
 * plan usage analytics, and billing metrics.
 */
import { getDb } from '../../db/client';
import { subscriptionPlans } from '../../db/schema/platformControl';
import { organizationSubscriptions, organizationLimits, organizations } from '../../db/schema/auth';
import { eq, asc, desc, sql, count, and, like, ilike } from 'drizzle-orm';

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class SubscriptionService {
  // ── Plans ────────────────────────────────────────────────────────────────
  async listPlans() {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not configured');
    return db
      .select()
      .from(subscriptionPlans)
      .orderBy(asc(subscriptionPlans.sortOrder), asc(subscriptionPlans.name));
  }

  async getPlan(id: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not configured');
    const rows = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async createPlan(data: Record<string, any>) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not configured');

    const code = (data.code || '').toString().trim();
    const name = (data.name || '').toString().trim();
    if (!code) throw new ApiError(400, 'Plan code is required');
    if (!name) throw new ApiError(400, 'Plan name is required');

    const existing = await db
      .select({ id: subscriptionPlans.id })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.code, code))
      .limit(1);
    if (existing.length > 0) throw new ApiError(409, `Plan code "${code}" already exists.`);

    const rows = await db
      .insert(subscriptionPlans)
      .values({
        code,
        name,
        description: data.description ?? null,
        priceMonthlyNpr: String(data.priceMonthlyNpr ?? '0'),
        priceYearlyNpr: String(data.priceYearlyNpr ?? '0'),
        maxMembers: Number(data.maxMembers ?? 1000),
        maxUsers: Number(data.maxUsers ?? 50),
        maxBranches: Number(data.maxBranches ?? 5),
        storageLimitMb: Number(data.storageLimitMb ?? 5120),
        aiEnabled: !!data.aiEnabled,
        aiCredits: Number(data.aiCredits ?? 0),
        features: data.features ?? null,
        isPublic: data.isPublic !== undefined ? !!data.isPublic : true,
        sortOrder: Number(data.sortOrder ?? 0),
        status: data.status || 'Active',
        createdBy: data.createdBy ?? null,
      })
      .returning();

    return rows[0];
  }

  async updatePlan(id: string, data: Record<string, any>) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not configured');

    const existing = await this.getPlan(id);
    if (!existing) throw new ApiError(404, 'Plan not found');

    if (data.code !== undefined) {
      const code = (data.code as string).trim();
      const conflict = await db
        .select({ id: subscriptionPlans.id })
        .from(subscriptionPlans)
        .where(and(eq(subscriptionPlans.code, code), sql`${subscriptionPlans.id} != ${id}`))
        .limit(1);
      if (conflict.length > 0) throw new ApiError(409, `Plan code "${code}" already exists.`);
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (data.code !== undefined) updates.code = (data.code as string).trim();
    if (data.name !== undefined) updates.name = (data.name as string).trim();
    if (data.description !== undefined) updates.description = data.description;
    if (data.priceMonthlyNpr !== undefined) updates.priceMonthlyNpr = String(data.priceMonthlyNpr);
    if (data.priceYearlyNpr !== undefined) updates.priceYearlyNpr = String(data.priceYearlyNpr);
    if (data.maxMembers !== undefined) updates.maxMembers = Number(data.maxMembers);
    if (data.maxUsers !== undefined) updates.maxUsers = Number(data.maxUsers);
    if (data.maxBranches !== undefined) updates.maxBranches = Number(data.maxBranches);
    if (data.storageLimitMb !== undefined) updates.storageLimitMb = Number(data.storageLimitMb);
    if (data.aiEnabled !== undefined) updates.aiEnabled = !!data.aiEnabled;
    if (data.aiCredits !== undefined) updates.aiCredits = Number(data.aiCredits);
    if (data.features !== undefined) updates.features = data.features;
    if (data.isPublic !== undefined) updates.isPublic = !!data.isPublic;
    if (data.sortOrder !== undefined) updates.sortOrder = Number(data.sortOrder);
    if (data.status !== undefined) updates.status = data.status;
    if (data.updatedBy !== undefined) updates.updatedBy = data.updatedBy;

    const rows = await db
      .update(subscriptionPlans)
      .set(updates)
      .where(eq(subscriptionPlans.id, id))
      .returning();

    return rows[0];
  }

  async deletePlan(id: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not configured');

    const existing = await this.getPlan(id);
    if (!existing) throw new ApiError(404, 'Plan not found');

    await db
      .update(subscriptionPlans)
      .set({ status: 'Archived', updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id));

    return { success: true };
  }

  // ── Organization Subscriptions ──────────────────────────────────────────
  async getOrgSubscriptions(filters?: { search?: string; planCode?: string; status?: string }) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not configured');

    const conditions: any[] = [sql`${organizations.deletedAt} IS NULL`];

    if (filters?.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        sql`(${organizations.organizationCode} ILIKE ${term} OR ${organizations.organizationName} ILIKE ${term})`
      );
    }
    if (filters?.planCode) {
      conditions.push(eq(organizationSubscriptions.subscriptionPlan, filters.planCode));
    }
    if (filters?.status) {
      conditions.push(eq(organizationSubscriptions.subscriptionStatus, filters.status as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: organizations.id,
        organizationCode: organizations.organizationCode,
        organizationName: organizations.organizationName,
        orgStatus: organizations.status,
        subscriptionPlan: organizationSubscriptions.subscriptionPlan,
        subscriptionStatus: organizationSubscriptions.subscriptionStatus,
        subscriptionStart: organizationSubscriptions.subscriptionStart,
        subscriptionEnd: organizationSubscriptions.subscriptionEnd,
        trialEnd: organizationSubscriptions.trialEnd,
        storageLimitMb: organizationLimits.storageLimitMb,
        storageUsedMb: organizationLimits.storageUsedMb,
        maxMembers: organizationLimits.maxMembers,
        maxUsers: organizationLimits.maxUsers,
        maxBranches: organizationLimits.maxBranches,
        aiEnabled: organizationLimits.aiEnabled,
        aiCredit: organizationLimits.aiCredit,
      })
      .from(organizations)
      .leftJoin(organizationSubscriptions, eq(organizations.id, organizationSubscriptions.organizationId))
      .leftJoin(organizationLimits, eq(organizations.id, organizationLimits.organizationId))
      .where(whereClause)
      .orderBy(asc(organizations.organizationCode));

    return rows;
  }

  async changeOrgPlan(organizationId: string, planCode: string) {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not configured');

    const orgRows = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    if (orgRows.length === 0) throw new ApiError(404, 'Organization not found');

    const planRows = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.code, planCode))
      .limit(1);
    if (planRows.length === 0) throw new ApiError(404, `Plan "${planCode}" not found`);
    const plan = planRows[0];

    const now = new Date();

    // Upsert subscription
    const existingSub = await db
      .select()
      .from(organizationSubscriptions)
      .where(eq(organizationSubscriptions.organizationId, organizationId))
      .limit(1);

    if (existingSub.length > 0) {
      await db
        .update(organizationSubscriptions)
        .set({
          subscriptionPlan: planCode,
          subscriptionStatus: 'Active',
          subscriptionStart: now,
          subscriptionEnd: null,
          trialEnd: null,
          updatedAt: now,
        })
        .where(eq(organizationSubscriptions.organizationId, organizationId));
    } else {
      await db.insert(organizationSubscriptions).values({
        organizationId,
        subscriptionPlan: planCode,
        subscriptionStatus: 'Active',
        subscriptionStart: now,
      });
    }

    // Upsert limits from plan
    const existingLimits = await db
      .select()
      .from(organizationLimits)
      .where(eq(organizationLimits.organizationId, organizationId))
      .limit(1);

    const limitValues = {
      maxMembers: plan.maxMembers,
      maxUsers: plan.maxUsers,
      maxBranches: plan.maxBranches,
      storageLimitMb: plan.storageLimitMb,
      aiEnabled: plan.aiEnabled,
      aiCredit: plan.aiCredits,
      isMultiBranch: plan.maxBranches > 1,
      updatedAt: now,
    };

    if (existingLimits.length > 0) {
      await db
        .update(organizationLimits)
        .set(limitValues)
        .where(eq(organizationLimits.organizationId, organizationId));
    } else {
      await db.insert(organizationLimits).values({
        organizationId,
        ...limitValues,
      });
    }

    return { success: true, planCode, planName: plan.name };
  }

  // ── Stats ──────────────────────────────────────────────────────────────
  async getSubscriptionStats() {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not configured');

    // Total orgs per plan
    const perPlan = await db
      .select({
        plan: organizationSubscriptions.subscriptionPlan,
        count: count(),
      })
      .from(organizationSubscriptions)
      .groupBy(organizationSubscriptions.subscriptionPlan);

    // Total orgs per status
    const perStatus = await db
      .select({
        status: organizationSubscriptions.subscriptionStatus,
        count: count(),
      })
      .from(organizationSubscriptions)
      .groupBy(organizationSubscriptions.subscriptionStatus);

    // MRR: sum monthly prices for active subscriptions
    const mrrResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${subscriptionPlans.priceMonthlyNpr} AS numeric)), 0)`,
      })
      .from(organizationSubscriptions)
      .innerJoin(subscriptionPlans, eq(organizationSubscriptions.subscriptionPlan, subscriptionPlans.code))
      .where(eq(organizationSubscriptions.subscriptionStatus, 'Active'));

    // Active trials
    const trialsResult = await db
      .select({ count: count() })
      .from(organizationSubscriptions)
      .where(eq(organizationSubscriptions.subscriptionStatus, 'Trial'));

    // Expiring soon (within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringResult = await db
      .select({ count: count() })
      .from(organizationSubscriptions)
      .where(
        and(
          sql`${organizationSubscriptions.subscriptionEnd} IS NOT NULL`,
          sql`${organizationSubscriptions.subscriptionEnd} <= ${thirtyDaysFromNow}`,
          sql`${organizationSubscriptions.subscriptionEnd} > ${new Date()}`,
          sql`${organizationSubscriptions.subscriptionStatus} IN ('Active', 'Past_Due')`
        )
      );

    // Total organizations
    const totalOrgs = await db
      .select({ count: count() })
      .from(organizations)
      .where(sql`${organizations.deletedAt} IS NULL`);

    return {
      perPlan,
      perStatus,
      mrr: Number(mrrResult[0]?.total ?? 0),
      activeTrials: trialsResult[0]?.count ?? 0,
      expiringSoon: expiringResult[0]?.count ?? 0,
      totalOrganizations: totalOrgs[0]?.count ?? 0,
    };
  }

  async getPlanUsage() {
    const db = getDb();
    if (!db) throw new ApiError(500, 'Database not configured');

    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.status, 'Active'))
      .orderBy(asc(subscriptionPlans.sortOrder));

    const usage = await db
      .select({
        planCode: organizationSubscriptions.subscriptionPlan,
        count: count(),
      })
      .from(organizationSubscriptions)
      .groupBy(organizationSubscriptions.subscriptionPlan);

    const usageMap = new Map(usage.map((u) => [u.planCode, u.count]));

    return plans.map((p) => ({
      planCode: p.code,
      planName: p.name,
      priceMonthlyNpr: p.priceMonthlyNpr,
      orgCount: usageMap.get(p.code) ?? 0,
    }));
  }
}
