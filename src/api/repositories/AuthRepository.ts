/**
 * Auth Repository
 * Multi-tenant login: Organization Code + Username
 * Identity: Supabase Authentication (no local password storage)
 */
import { eq, and, or, desc, count, max, isNotNull, isNull, asc } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  organizations, orgUsers, authAuditLogs, employees, roles, departments, designations, superAdmins,
  organizationProfiles, organizationSubscriptions, organizationLimits,
  members, savingsAccounts, loanAccounts,
  provinces, districts, municipalities, wards,
  emailQueue,
  securityQuestions, userSecurityAnswers, organizationSecuritySettings,
} from '../../db/schema';
import { branches } from '../../db/schema/branches';

/**
 * Coerce string-typed date/number fields sent from the super-admin UI
 * into the native types expected by the organizations table.
 * stripEmpty: create paths drop empty/null values; update paths set them to null.
 */
const ORG_DATE_FIELDS = ['registrationDate', 'subscriptionStart', 'subscriptionEnd', 'trialEnd'] as const;
const ORG_INT_FIELDS = ['aiCredit', 'storageLimitMb', 'storageUsedMb', 'maxMembers', 'maxUsers', 'maxBranches', 'wardNo'] as const;

/**
 * Vertical split field groups. Cold/wide columns live on 1:1 child tables:
 *   PROFILES -> legal + branding + localization
 *   SUBSCRIPTIONS -> licensing
 *   LIMITS -> feature flags & quota
 */
const PROFILE_FIELDS = ['pan', 'registrationNo', 'registrationDate', 'fiscalYear', 'logoUrl', 'faviconUrl', 'themeColor', 'timezone', 'locale', 'currencyCode', 'dateFormat', 'defaultShareSchemeId', 'defaultCertificateFormatId', 'defaultSavingProductId'] as const;
const SUBSCRIPTION_FIELDS = ['subscriptionPlan', 'subscriptionStatus', 'subscriptionStart', 'subscriptionEnd', 'trialEnd'] as const;
const LIMIT_FIELDS = ['isMultiBranch', 'aiEnabled', 'aiCredit', 'storageLimitMb', 'storageUsedMb', 'maxMembers', 'maxUsers', 'maxBranches'] as const;

/** Route a flat camelCase org payload to its owning table. */
function splitOrgPayload(data: Record<string, any>): {
  main: Record<string, any>;
  profile: Record<string, any>;
  subscription: Record<string, any>;
  limits: Record<string, any>;
} {
  const main: Record<string, any> = {};
  const profile: Record<string, any> = {};
  const subscription: Record<string, any> = {};
  const limits: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if ((PROFILE_FIELDS as readonly string[]).includes(k)) profile[k] = v;
    else if ((SUBSCRIPTION_FIELDS as readonly string[]).includes(k)) subscription[k] = v;
    else if ((LIMIT_FIELDS as readonly string[]).includes(k)) limits[k] = v;
    else main[k] = v;
  }
  return { main, profile, subscription, limits };
}

function sanitizeOrgPayload(data: Record<string, any>, stripEmpty: boolean): Record<string, any> {
  const out = { ...data };
  for (const f of ORG_DATE_FIELDS) {
    const v = out[f];
    if (v === undefined) continue;
    if (v === null || v === '') {
      if (stripEmpty) delete out[f];
      else out[f] = null;
      continue;
    }
    out[f] = new Date(v);
  }
  for (const f of ORG_INT_FIELDS) {
    const v = out[f];
    if (v === undefined) continue;
    if (v === null || v === '') {
      if (stripEmpty) delete out[f];
      else out[f] = null;
      continue;
    }
    const n = Number(v);
    if (!Number.isNaN(n)) out[f] = n;
  }
  return out;
}

export class AuthRepository {
  private get db() {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    return db;
  }

  // =============================================
  // ORGANIZATION LOOKUPS
  // =============================================
  async findOrganizationByCode(code: string) {
    const results = await this.db.select()
      .from(organizations)
      .where(and(
        eq(organizations.organizationCode, code.toUpperCase()),
        eq(organizations.status, 'Active')
      ))
      .limit(1);
    return results[0] ?? null;
  }

  async getOrganizationById(id: string) {
    const results = await this.db.select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return results[0] ?? null;
  }

  // =============================================
  // USER LOOKUPS (with full profile via JOINs)
  // =============================================
  async findUserByUsername(organizationId: string, username: string) {
    const results = await this.db.select({
      id: orgUsers.id,
      organizationId: orgUsers.organizationId,
      username: orgUsers.username,
      email: orgUsers.email,
      emailVerified: orgUsers.emailVerified,
      authUserId: orgUsers.authUserId,
      requiresPasswordChange: orgUsers.requiresPasswordChange,
      securityScore: orgUsers.securityScore,
      securitySetupCompleted: orgUsers.securitySetupCompleted,
      mobileVerified: orgUsers.mobileVerified,
      mobileNumber: orgUsers.mobileNumber,
      securityQuestionsCompleted: orgUsers.securityQuestionsCompleted,
      passwordChanged: orgUsers.passwordChanged,
      firstLoginCompleted: orgUsers.firstLoginCompleted,
      status: orgUsers.status,
      // Branch context
      branchId: orgUsers.branchId,
      activeBranchId: orgUsers.activeBranchId,
      // Employee
      fullName: employees.firstName,
      employeeCode: employees.employeeCode,
      isFinancialStaff: employees.isFinancialStaff,
      // Role
      roleName: roles.name,
      permissions: roles.permissions,
    })
      .from(orgUsers)
      .leftJoin(employees, eq(orgUsers.employeeId, employees.id))
      .leftJoin(roles, eq(orgUsers.roleId, roles.id))
      .where(and(
        eq(orgUsers.organizationId, organizationId),
        eq(orgUsers.username, username.toLowerCase())
      ))
      .limit(1);

    if (results.length === 0) return null;
    const u = results[0];
    return { ...u, fullName: u.fullName || u.username };
  }

  async findUserByAuthId(authUserId: string) {
    const results = await this.db.select({
      id: orgUsers.id,
      organizationId: orgUsers.organizationId,
      organizationCode: organizations.organizationCode,
      username: orgUsers.username,
      email: orgUsers.email,
      roleName: roles.name,
      status: orgUsers.status,
      branchId: orgUsers.branchId,
      activeBranchId: orgUsers.activeBranchId,
    })
      .from(orgUsers)
      .leftJoin(organizations, eq(orgUsers.organizationId, organizations.id))
      .leftJoin(roles, eq(orgUsers.roleId, roles.id))
      .where(eq(orgUsers.authUserId, authUserId))
      .limit(1);

    return results[0] || null;
  }

  /** All branch ids belonging to an organization (org_admin multi-branch scope). */
  async getOrgBranchIds(organizationId: string): Promise<string[]> {
    const rows = await this.db.select({ id: branches.id })
      .from(branches)
      .where(eq(branches.organizationId, organizationId));
    return rows.map((r) => r.id);
  }

  /** Persist the user's active branch context. */
  async setActiveBranchId(userId: string, activeBranchId: string | null) {
    return this.updateOrgUser(userId, { activeBranchId });
  }

  async getOrgUserById(userId: string) {
    const results = await this.db.select()
      .from(orgUsers)
      .where(eq(orgUsers.id, userId))
      .limit(1);
    return results[0] ?? null;
  }

  /** True when the role row exists inside the given organization. */
  async isRoleInOrg(roleId: string, organizationId: string): Promise<boolean> {
    const [row] = await this.db.select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.id, roleId), eq(roles.organizationId, organizationId)))
      .limit(1);
    return !!row;
  }

  /** True when the employee row exists inside the given organization. */
  async isEmployeeInOrg(employeeId: string, organizationId: string): Promise<boolean> {
    const [row] = await this.db.select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.organizationId, organizationId)))
      .limit(1);
    return !!row;
  }

  // =============================================
  // USER MANAGEMENT (HR / Admin)
  // =============================================
  async createOrgUser(data: typeof orgUsers.$inferInsert) {
    if (!/^[a-z][a-z0-9_.]{2,29}$/.test(data.username)) {
      throw new Error('Username must be 3-30 lowercase alphanumeric characters (letters, numbers, underscores, dots).');
    }

    const existing = await this.findUserByUsername(data.organizationId, data.username);
    if (existing) {
      throw new Error(`Username '${data.username}' is already taken in this organization.`);
    }

    const results = await this.db.insert(orgUsers).values(data).returning();
    return results[0];
  }

  async getOrgUsers(organizationId: string) {
    const rows = await this.db.select({
      id: orgUsers.id,
      organizationId: orgUsers.organizationId,
      employeeId: orgUsers.employeeId,
      username: orgUsers.username,
      email: orgUsers.email,
      emailVerified: orgUsers.emailVerified,
      authUserId: orgUsers.authUserId,
      firstName: employees.firstName,
      middleName: employees.middleName,
      lastName: employees.lastName,
      employeeCode: employees.employeeCode,
      gender: employees.gender,
      phone: employees.phone,
      photoUrl: employees.photoUrl,
      roleId: orgUsers.roleId,
      role: roles.name,
      department: departments.name,
      designation: designations.name,
      branchId: orgUsers.branchId,
      branchName: branches.name,
      status: orgUsers.status,
      requiresPasswordChange: orgUsers.requiresPasswordChange,
      securityScore: orgUsers.securityScore,
      securitySetupCompleted: orgUsers.securitySetupCompleted,
      lastLoginAt: orgUsers.lastLoginAt,
      lastActivityAt: orgUsers.lastActivityAt,
      createdAt: orgUsers.createdAt,
    })
      .from(orgUsers)
      .leftJoin(employees, eq(orgUsers.employeeId, employees.id))
      .leftJoin(roles, eq(orgUsers.roleId, roles.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(designations, eq(employees.designationId, designations.id))
      .leftJoin(branches, eq(orgUsers.branchId, branches.id))
      .where(eq(orgUsers.organizationId, organizationId));

    return rows.map((r) => ({
      ...r,
      fullName: [r.firstName, r.middleName, r.lastName].filter(Boolean).join(' ') || r.username,
    }));
  }

  async updateOrgUser(id: string, data: Partial<typeof orgUsers.$inferInsert>) {
    const results = await this.db.update(orgUsers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(orgUsers.id, id))
      .returning();
    return results[0];
  }

  // =============================================
  // SECURITY SETUP COMPLETION
  // =============================================
  /**
   * Mark the one-time security wizard complete.
   *
   * `questionsCompleted` reflects whether answer rows were actually written.
   * It is a parameter rather than a hardcoded `true` because this used to
   * claim the questions step was done while the answers were being discarded,
   * which made account recovery silently impossible.
   */
  async markSecuritySetupComplete(id: string, mobileNumber?: string, questionsCompleted = false) {
    const results = await this.db.update(orgUsers)
      .set({
        securitySetupCompleted: true,
        securitySetupCompletedAt: new Date(),
        mobileVerified: !!mobileNumber,
        mobileNumber: mobileNumber ?? null,
        securityQuestionsCompleted: questionsCompleted,
        firstLoginCompleted: true,
        // 50 base + 25 mobile + 25 questions — earned, not assumed.
        securityScore: 50 + (mobileNumber ? 25 : 0) + (questionsCompleted ? 25 : 0),
        updatedAt: new Date(),
      })
      .where(eq(orgUsers.id, id))
      .returning();
    return results[0];
  }

  // =============================================
  // SECURITY QUESTIONS & ANSWERS
  // =============================================
  /** Global catalogue (organization_id IS NULL) plus this org's own additions. */
  async getSecurityQuestions(organizationId?: string) {
    const rows = await this.db.select({
      id: securityQuestions.id,
      questionText: securityQuestions.questionText,
      organizationId: securityQuestions.organizationId,
    })
      .from(securityQuestions)
      .where(
        and(
          eq(securityQuestions.isActive, true),
          organizationId
            ? or(isNull(securityQuestions.organizationId), eq(securityQuestions.organizationId, organizationId))
            : isNull(securityQuestions.organizationId),
        ),
      )
      .orderBy(asc(securityQuestions.questionText));
    return rows;
  }

  /** Guard against a caller passing a question id belonging to another tenant. */
  async areQuestionsVisibleToOrg(questionIds: string[], organizationId?: string): Promise<boolean> {
    if (questionIds.length === 0) return false;
    const visible = await this.getSecurityQuestions(organizationId);
    const allowed = new Set(visible.map(q => q.id));
    return questionIds.every(id => allowed.has(id));
  }

  /**
   * Replace a user's stored answers with the supplied set, in one transaction
   * so a failure part-way cannot leave a user with half their answers.
   */
  async replaceUserSecurityAnswers(userId: string, answers: { questionId: string; encryptedAnswer: string }[]) {
    await this.db.transaction(async (tx) => {
      await tx.delete(userSecurityAnswers).where(eq(userSecurityAnswers.userId, userId));
      if (answers.length > 0) {
        await tx.insert(userSecurityAnswers).values(
          answers.map(a => ({
            userId,
            questionId: a.questionId,
            encryptedAnswer: a.encryptedAnswer,
          })),
        );
      }
    });
  }

  async countUserSecurityAnswers(userId: string): Promise<number> {
    const rows = await this.db.select({ c: count() })
      .from(userSecurityAnswers)
      .where(eq(userSecurityAnswers.userId, userId));
    return Number(rows[0]?.c ?? 0);
  }

  // =============================================
  // ORGANIZATION SECURITY POLICY
  // =============================================
  /** Returns the org's policy row, or undefined when never configured. */
  async getSecuritySettings(organizationId: string) {
    const rows = await this.db.select()
      .from(organizationSecuritySettings)
      .where(eq(organizationSecuritySettings.organizationId, organizationId))
      .limit(1);
    return rows[0];
  }

  /** Insert-or-update the single policy row for an org. */
  async upsertSecuritySettings(
    organizationId: string,
    data: Partial<typeof organizationSecuritySettings.$inferInsert>,
    updatedBy?: string,
  ) {
    const results = await this.db.insert(organizationSecuritySettings)
      .values({ ...data, organizationId, updatedBy: updatedBy ?? null })
      .onConflictDoUpdate({
        target: organizationSecuritySettings.organizationId,
        set: { ...data, updatedBy: updatedBy ?? null, updatedAt: new Date() },
      })
      .returning();
    return results[0];
  }

  // =============================================
  // AUDIT LOGGING
  // =============================================
  async logAuthEvent(data: {
    organizationId?: string;
    userId?: string;
    username?: string;
    organizationCode?: string;
    event: string;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    reason?: string;
  }) {
    try {
      await this.db.insert(authAuditLogs).values({
        ...data,
        createdAt: new Date(),
      });
    } catch (err) {
      // Non-blocking — audit failures should not break the auth flow
      console.error('[AuthAudit] Failed to log auth event:', err);
    }
  }

  async queueEmail(data: {
    organizationId?: string;
    userId?: string;
    toEmail: string;
    toName?: string;
    subject: string;
    templateType: string;
    templateData?: Record<string, any>;
  }) {
    try {
      await this.db.insert(emailQueue).values({
        organizationId: data.organizationId ?? null,
        userId: data.userId ?? null,
        toEmail: data.toEmail,
        toName: data.toName ?? null,
        subject: data.subject,
        templateType: data.templateType,
        templateData: data.templateData ?? {},
        status: 'Pending',
        attemptCount: 0,
      });
    } catch (err) {
      console.error('[EmailQueue] Failed to queue email:', err);
    }
  }


  // =============================================
  // ORGANIZATION MANAGEMENT (Super Admin)
  // =============================================
  async provisionOrganization(data: {
    organizationCode: string;
    organizationName: string;
    shortName?: string;
    organizationType?: string;
    slug?: string;
    province?: string;
    district?: string;
    municipality?: string;
    wardNo?: number;
    address?: string;
    phone?: string;
    mobile?: string;
    email?: string;
    website?: string;
    pan?: string;
    registrationNo?: string;
    govtRegNo?: string;
    registrationDate?: string;
    fiscalYear?: string;
    subscriptionPlan: string;
    maxMembers?: number;
    maxUsers?: number;
    maxBranches?: number;
    isMultiBranch?: boolean;
    aiEnabled?: boolean;
    branchName?: string;
    branchAddress?: string;
    branchPhone?: string;
    adminFullName: string;
    adminUsername: string;
    adminEmail: string;
    adminPhone?: string;
    authUserId: string; // Supabase UID — created BEFORE calling this
  }) {
    return this.db.transaction(async (tx) => {
      const code = data.organizationCode.toUpperCase();

      // 1. Check duplicate org code
      const existing = await tx.select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.organizationCode, code))
        .limit(1);
      if (existing.length > 0) throw new Error(`Organization code "${code}" is already taken.`);

      // 2. Create organization
      const [org] = await tx.insert(organizations).values({
        organizationCode: code,
        organizationName: data.organizationName,
        shortName: data.shortName || null,
        organizationType: data.organizationType || 'Cooperative',
        slug: data.slug || code.toLowerCase(),
        province: data.province || null,
        district: data.district || null,
        municipality: data.municipality || null,
        wardNo: data.wardNo ?? null,
        address: data.address || null,
        phone: data.phone || null,
        mobile: data.mobile || null,
        email: data.email || null,
        website: data.website || null,
        govtRegNo: data.govtRegNo || null,
        status: 'Active',
        isVerified: false,
      }).returning();

      // 3. Create org profile
      await tx.insert(organizationProfiles).values({
        organizationId: org.id,
        pan: data.pan || null,
        registrationNo: data.registrationNo || null,
        registrationDate: data.registrationDate ? new Date(data.registrationDate) : null,
        fiscalYear: data.fiscalYear || null,
        timezone: 'Asia/Kathmandu',
        locale: 'ne',
        currencyCode: 'NPR',
        dateFormat: 'BS',
        themeColor: '#10b981',
      });

      // 4. Create subscription
      const now = new Date();
      await tx.insert(organizationSubscriptions).values({
        organizationId: org.id,
        subscriptionPlan: data.subscriptionPlan || 'Trial',
        subscriptionStatus: 'Trial',
        subscriptionStart: now,
        trialEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      // 5. Create limits
      await tx.insert(organizationLimits).values({
        organizationId: org.id,
        maxMembers: data.maxMembers ?? 1000,
        maxUsers: data.maxUsers ?? 50,
        maxBranches: data.maxBranches ?? 5,
        isMultiBranch: data.isMultiBranch ?? false,
        aiEnabled: data.aiEnabled ?? false,
        aiCredit: 0,
        storageLimitMb: 5120,
        storageUsedMb: 0,
      });

      // 6. Create default "Organization Administrator" role
      const fullPermissions = JSON.stringify(['*']);
      const [adminRole] = await tx.insert(roles).values({
        organizationId: org.id,
        code: 'ADMIN',
        name: 'Organization Administrator',
        nameNepali: 'संगठन प्रशासक',
        description: 'Full system administration for this organization',
        permissions: fullPermissions,
        isSystem: true,
        status: 'Active',
        sortOrder: 0,
      }).returning();

      // 7. Create Head Office branch
      const branchCode = `${code}-HO`;
      const [branch] = await tx.insert(branches).values({
        organizationId: org.id,
        code: branchCode,
        name: data.branchName || `${data.organizationName} - Head Office`,
        address: data.branchAddress || data.address || 'Head Office',
        phone: data.branchPhone || data.phone || '',
        managerName: data.adminFullName,
        vaultLimit: '10000000',
        currentVaultCash: '0',
      }).returning();

      // 8. Create admin employee record
      const nameParts = data.adminFullName.trim().split(/\s+/);
      const firstName = nameParts.slice(0, -1).join(' ') || nameParts[0] || data.adminFullName;
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      const [employee] = await tx.insert(employees).values({
        organizationId: org.id,
        employeeCode: 'ADM-001',
        firstName,
        lastName,
        email: data.adminEmail,
        phone: data.adminPhone || '',
        category: 'Financial Staff',
        isFinancialStaff: true,
        branchId: branch.id,
        status: 'Active',
      }).returning();

      // 9. Create org user
      const username = data.adminUsername.toLowerCase().trim();
      const [adminUser] = await tx.insert(orgUsers).values({
        organizationId: org.id,
        employeeId: employee.id,
        username,
        email: data.adminEmail,
        emailVerified: false,
        authUserId: data.authUserId,
        roleId: adminRole.id,
        requiresPasswordChange: true,
        isTemporaryPassword: true,
        temporaryPassword: true,
        passwordCreatedAt: now,
        securityScore: 0,
        status: 'Active',
      }).returning();

      // 10. Update org ownerUserId
      await tx.update(organizations)
        .set({ ownerUserId: adminUser.id, updatedAt: new Date() })
        .where(eq(organizations.id, org.id));

      // 11. Audit log
      await tx.insert(authAuditLogs).values({
        organizationId: org.id,
        userId: adminUser.id,
        organizationCode: code,
        username,
        event: 'ORG_PROVISIONED',
        success: true,
        reason: 'Organization provisioned by super admin — all defaults created atomically',
      });

      return { organization: org, branch, employee, adminUser, role: adminRole };
    });
  }

  async createOrganization(data: typeof organizations.$inferInsert) {
    // Allow empty organizationCode — auto-generate from shortName/organizationName
    if (!data.organizationCode?.trim()) {
      const { resolveUniqueOrgCode } = await import('../../utils/generateOrgCode');
      data.organizationCode = await resolveUniqueOrgCode(
        data.shortName,
        data.organizationName,
        async (candidate) => {
          const existing = await this.findOrganizationByCode(candidate);
          return existing !== null;
        },
      );
    }

    data.organizationCode = data.organizationCode.toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(data.organizationCode)) {
      throw new Error('Organization Code must be 4-12 uppercase letters/numbers only.');
    }
    const clean = sanitizeOrgPayload(data as Record<string, any>, true);
    const { main, profile, subscription, limits } = splitOrgPayload(clean);

    return this.db.transaction(async (tx) => {
      const [org] = await tx.insert(organizations).values(main as typeof organizations.$inferInsert).returning();
      // onConflictDoNothing protects against duplicate child rows if called twice on same org
      await tx.insert(organizationProfiles).values({ organizationId: org.id, ...profile })
        .onConflictDoNothing();
      await tx.insert(organizationSubscriptions).values({ organizationId: org.id, ...subscription })
        .onConflictDoNothing();
      await tx.insert(organizationLimits).values({ organizationId: org.id, ...limits })
        .onConflictDoNothing();
      return org;
    });
  }

  /**
   * Count organizations of a given type whose registration_no starts with
   * the pattern "{prefix}-{bsYear}-" — used for sequential reg number generation.
   * Note: registrationNo lives on organizationProfiles (vertical split), not organizations.
   */
  async countOrganizationsByTypeAndYear(organizationType: string, bsYear: number): Promise<number> {
    const { getRegNoPrefix } = await import('../../utils/generateOrgCode');
    const prefix = getRegNoPrefix(organizationType);
    const pattern = `${prefix}-${bsYear}-%`;
    const { like } = await import('drizzle-orm');
    const result = await this.db
      .select({ cnt: count() })
      .from(organizationProfiles)
      .where(like(organizationProfiles.registrationNo, pattern));
    return result[0]?.cnt ?? 0;
  }

  /**
   * Generate the next registration number for an org type in the given BS year.
   * Format: COP-2083-0001
   */
  async generateNextRegNo(organizationType: string, bsYear: number): Promise<string> {
    const { buildRegNo } = await import('../../utils/generateOrgCode');
    const existingCount = await this.countOrganizationsByTypeAndYear(organizationType, bsYear);
    return buildRegNo(organizationType, bsYear, existingCount + 1);
  }

  async getAllOrganizations() {
    // ── Primary query: organizations table ONLY ───────────────────────────
    // Never join organization_profiles here — that table is a 1:1 child and
    // may have orphan / duplicate rows that would multiply the result set.
    const orgs = await this.db.select({
      id: organizations.id,
      organizationCode: organizations.organizationCode,
      organizationName: organizations.organizationName,
      shortName: organizations.shortName,
      organizationType: organizations.organizationType,
      slug: organizations.slug,
      status: organizations.status,
      isVerified: organizations.isVerified,
      province: organizations.province,
      district: organizations.district,
      municipality: organizations.municipality,
      phone: organizations.phone,
      email: organizations.email,
      createdAt: organizations.createdAt,
    }).from(organizations)
      .orderBy(desc(organizations.createdAt));

    if (orgs.length === 0) return [];

    // ── Separate lightweight queries for aggregates ───────────────────────
    const orgIds = orgs.map(o => o.id);

    // Subscription plan/status — fetched separately, never joined to the list
    const subs = await this.db.select({
      organizationId: organizationSubscriptions.organizationId,
      subscriptionPlan: organizationSubscriptions.subscriptionPlan,
      subscriptionStatus: organizationSubscriptions.subscriptionStatus,
    }).from(organizationSubscriptions)
      .where(
        // Only fetch subs for orgs we have — avoids orphan rows polluting the set
        orgIds.length === 1
          ? eq(organizationSubscriptions.organizationId, orgIds[0])
          : undefined
      );

    // For multiple orgs use a broader fetch then filter in memory (Drizzle
    // doesn't have inArray on all versions; this is always correct)
    const subsAll = orgIds.length === 1
      ? subs
      : await this.db.select({
          organizationId: organizationSubscriptions.organizationId,
          subscriptionPlan: organizationSubscriptions.subscriptionPlan,
          subscriptionStatus: organizationSubscriptions.subscriptionStatus,
        }).from(organizationSubscriptions);

    const subMap = new Map(subsAll.map(s => [s.organizationId, s]));

    const userCounts = await this.db.select({
      organizationId: orgUsers.organizationId,
      n: count(),
    }).from(orgUsers).groupBy(orgUsers.organizationId);

    const employeeCounts = await this.db.select({
      organizationId: employees.organizationId,
      n: count(),
    }).from(employees).groupBy(employees.organizationId);

    const lastLogins = await this.db.select({
      organizationId: authAuditLogs.organizationId,
      last: max(authAuditLogs.createdAt),
    }).from(authAuditLogs)
      .where(isNotNull(authAuditLogs.organizationId))
      .groupBy(authAuditLogs.organizationId);

    const userMap = new Map(userCounts.map(r => [r.organizationId, Number(r.n ?? 0)]));
    const empMap = new Map(employeeCounts.map(r => [r.organizationId, Number(r.n ?? 0)]));
    const loginMap = new Map(lastLogins.map(r => [r.organizationId, r.last]));

    // ── Map: one output row per organizations row ─────────────────────────
    return orgs.map(o => {
      const sub = subMap.get(o.id);
      return {
        ...o,
        pan: null,              // Not loaded in list view — use detail endpoint
        subscriptionPlan: sub?.subscriptionPlan ?? null,
        subscriptionStatus: sub?.subscriptionStatus ?? null,
        users: userMap.get(o.id) ?? 0,
        employees: empMap.get(o.id) ?? 0,
        lastLoginAt: loginMap.get(o.id) ?? null,
      };
    });
  }

  async getOrganizationDetail(id: string) {
    const [org] = await this.db.select({
      id: organizations.id,
      organizationCode: organizations.organizationCode,
      organizationName: organizations.organizationName,
      shortName: organizations.shortName,
      organizationType: organizations.organizationType,
      slug: organizations.slug,
      status: organizations.status,
      isVerified: organizations.isVerified,
      province: organizations.province,
      district: organizations.district,
      municipality: organizations.municipality,
      wardNo: organizations.wardNo,
      address: organizations.address,
      phone: organizations.phone,
      mobile: organizations.mobile,
      email: organizations.email,
      website: organizations.website,
      pan: organizationProfiles.pan,
      govtRegNo: organizations.govtRegNo,
      registrationNo: organizationProfiles.registrationNo,
      registrationDate: organizationProfiles.registrationDate,
      fiscalYear: organizationProfiles.fiscalYear,
      logoUrl: organizationProfiles.logoUrl,
      faviconUrl: organizationProfiles.faviconUrl,
      themeColor: organizationProfiles.themeColor,
      timezone: organizationProfiles.timezone,
      locale: organizationProfiles.locale,
      currencyCode: organizationProfiles.currencyCode,
      dateFormat: organizationProfiles.dateFormat,
      defaultShareSchemeId: organizationProfiles.defaultShareSchemeId,
      subscriptionPlan: organizationSubscriptions.subscriptionPlan,
      subscriptionStatus: organizationSubscriptions.subscriptionStatus,
      subscriptionStart: organizationSubscriptions.subscriptionStart,
      subscriptionEnd: organizationSubscriptions.subscriptionEnd,
      trialEnd: organizationSubscriptions.trialEnd,
      ownerUserId: organizations.ownerUserId,
      isMultiBranch: organizationLimits.isMultiBranch,
      aiEnabled: organizationLimits.aiEnabled,
      aiCredit: organizationLimits.aiCredit,
      storageLimitMb: organizationLimits.storageLimitMb,
      storageUsedMb: organizationLimits.storageUsedMb,
      maxMembers: organizationLimits.maxMembers,
      maxUsers: organizationLimits.maxUsers,
      maxBranches: organizationLimits.maxBranches,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
    }).from(organizations)
      .leftJoin(organizationProfiles, eq(organizationProfiles.organizationId, organizations.id))
      .leftJoin(organizationSubscriptions, eq(organizationSubscriptions.organizationId, organizations.id))
      .leftJoin(organizationLimits, eq(organizationLimits.organizationId, organizations.id))
      .where(eq(organizations.id, id)).limit(1);

    if (!org) return null;

    const [userCount] = await this.db.select({ n: count() }).from(orgUsers).where(eq(orgUsers.organizationId, id));
    const [activeUsers] = await this.db.select({ n: count() })
      .from(orgUsers).where(and(eq(orgUsers.organizationId, id), eq(orgUsers.status, 'Active')));
    const [employeeCount] = await this.db.select({ n: count() }).from(employees).where(eq(employees.organizationId, id));
    const [auditCount] = await this.db.select({ n: count() }).from(authAuditLogs).where(eq(authAuditLogs.organizationId, id));

    const lastLogins = await this.db.select({ last: max(authAuditLogs.createdAt) })
      .from(authAuditLogs)
      .where(and(
        eq(authAuditLogs.organizationId, id),
        eq(authAuditLogs.event, 'LOGIN'),
        eq(authAuditLogs.success, true)
      )).limit(1);

    const [failedCount] = await this.db.select({ n: count() })
      .from(authAuditLogs)
      .where(and(
        eq(authAuditLogs.organizationId, id),
        eq(authAuditLogs.success, false)
      ));

    return {
      ...org,
      stats: {
        users: Number(userCount?.n ?? 0),
        activeUsers: Number(activeUsers?.n ?? 0),
        employees: Number(employeeCount?.n ?? 0),
        auditEvents: Number(auditCount?.n ?? 0),
        failedLogins: Number(failedCount?.n ?? 0),
        lastLoginAt: lastLogins?.[0]?.last ?? null,
      },
    };
  }

  async getNepalGeoData() {
    const [provinceList, districtList, municipalityList, wardList] = await Promise.all([
      this.db.select().from(provinces).orderBy(asc(provinces.code)),
      this.db.select().from(districts).orderBy(asc(districts.code)),
      this.db.select().from(municipalities).orderBy(asc(municipalities.name)),
      this.db.select().from(wards).orderBy(asc(wards.wardNo)),
    ]);
    return { provinces: provinceList, districts: districtList, municipalities: municipalityList, wards: wardList };
  }

  async getOrgAuditLogs(organizationId: string, limit = 50) {
    return this.db.select({
      id: authAuditLogs.id,
      username: authAuditLogs.username,
      event: authAuditLogs.event,
      ipAddress: authAuditLogs.ipAddress,
      success: authAuditLogs.success,
      reason: authAuditLogs.reason,
      createdAt: authAuditLogs.createdAt,
    })
      .from(authAuditLogs)
      .where(eq(authAuditLogs.organizationId, organizationId))
      .orderBy(desc(authAuditLogs.createdAt))
      .limit(limit);
  }

  async getOrgRoles(organizationId: string) {
    return this.db.select({
      id: roles.id,
      name: roles.name,
      isSystem: roles.isSystem,
      status: roles.status,
    })
      .from(roles)
      .where(and(eq(roles.organizationId, organizationId), eq(roles.status, 'Active')))
      .orderBy(asc(roles.name));
  }

  /** Departments (with their designations) for the staff form dropdowns. */
  async getOrgDepartmentsAndDesignations(organizationId: string) {
    const depts = await this.db.select({
      id: departments.id,
      name: departments.name,
      status: departments.status,
    })
      .from(departments)
      .where(and(eq(departments.organizationId, organizationId), eq(departments.status, 'Active')))
      .orderBy(asc(departments.name));

    if (depts.length === 0) return { departments: [], designations: [] };

    const deptIds = depts.map((d) => d.id);
    const desigs = deptIds.length === 1
      ? await this.db.select({
          id: designations.id,
          departmentId: designations.departmentId,
          name: designations.name,
          status: designations.status,
        }).from(designations)
          .where(eq(designations.departmentId, deptIds[0]))
      : await this.db.select({
          id: designations.id,
          departmentId: designations.departmentId,
          name: designations.name,
          status: designations.status,
        }).from(designations);

    const active = desigs.filter((d) => d.status === 'Active' || !d.status);
    return {
      departments: depts,
      designations: active.map((d) => ({
        id: d.id,
        departmentId: d.departmentId,
        name: d.name,
      })),
    };
  }

  async updateOrganizationStatus(id: string, status: 'Active' | 'Suspended' | 'Inactive') {
    const results = await this.db.update(organizations)
      .set({ status, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return results[0] ?? null;
  }

  async updateOrganization(id: string, data: Partial<typeof organizations.$inferInsert>) {
    const clean = sanitizeOrgPayload(data as Record<string, any>, false);
    const { main, profile, subscription, limits } = splitOrgPayload(clean);

    await this.db.transaction(async (tx) => {
      if (Object.keys(main).length > 0) {
        await tx.update(organizations)
          .set({ ...main, updatedAt: new Date() })
          .where(eq(organizations.id, id));
      }
      if (Object.keys(profile).length > 0) {
        await tx.insert(organizationProfiles)
          .values({ organizationId: id, ...profile })
          .onConflictDoUpdate({
            target: organizationProfiles.organizationId,
            set: { ...profile, updatedAt: new Date() },
          });
      }
      if (Object.keys(subscription).length > 0) {
        await tx.insert(organizationSubscriptions)
          .values({ organizationId: id, ...subscription })
          .onConflictDoUpdate({
            target: organizationSubscriptions.organizationId,
            set: { ...subscription, updatedAt: new Date() },
          });
      }
      if (Object.keys(limits).length > 0) {
        await tx.insert(organizationLimits)
          .values({ organizationId: id, ...limits })
          .onConflictDoUpdate({
            target: organizationLimits.organizationId,
            set: { ...limits, updatedAt: new Date() },
          });
      }
    });

    // Read back AFTER commit so the response reflects the persisted values.
    const merged = await this.getOrganizationDetail(id);
    if (!merged) throw new Error('Organization not found.');
    return merged;
  }

  // =============================================
  // SUPER ADMIN PLATFORM QUERIES
  // =============================================

  async createSuperAdminUser(data: { username: string; fullName: string; email: string }) {
    const [created] = await this.db.insert(superAdmins).values({
      username: data.username.toLowerCase().trim(),
      fullName: data.fullName.trim(),
      email: data.email.toLowerCase().trim(),
      status: 'Active',
    }).returning();
    return created;
  }

  async getAllSuperAdmins() {
    return this.db.select({
      id: superAdmins.id,
      username: superAdmins.username,
      email: superAdmins.email,
      fullName: superAdmins.fullName,
      status: superAdmins.status,
      lastLogin: superAdmins.lastLogin,
      createdAt: superAdmins.createdAt,
    }).from(superAdmins).orderBy(asc(superAdmins.username));
  }

  async updateSuperAdminRecord(id: string, data: { fullName?: string; email?: string; status?: string }) {
    const update: Record<string, any> = { updatedAt: new Date() };
    if (data.fullName !== undefined) update.fullName = data.fullName.trim();
    if (data.email !== undefined) update.email = data.email.toLowerCase().trim();
    if (data.status !== undefined) update.status = data.status;
    const [updated] = await this.db.update(superAdmins)
      .set(update)
      .where(eq(superAdmins.id, id))
      .returning();
    return updated ?? null;
  }

  async getAllPlatformUsers() {
    return this.db.select({
      id: orgUsers.id,
      username: orgUsers.username,
      email: orgUsers.email,
      emailVerified: orgUsers.emailVerified,
      authUserId: orgUsers.authUserId,
      fullName: employees.firstName,
      employeeCode: employees.employeeCode,
      role: roles.name,
      department: departments.name,
      designation: designations.name,
      status: orgUsers.status,
      requiresPasswordChange: orgUsers.requiresPasswordChange,
      twoFactor: orgUsers.securityScore,
      lastLogin: orgUsers.updatedAt,
      orgId: organizations.id,
      orgCode: organizations.organizationCode,
      orgName: organizations.organizationName,
    })
      .from(orgUsers)
      .leftJoin(organizations, eq(orgUsers.organizationId, organizations.id))
      .leftJoin(employees, eq(orgUsers.employeeId, employees.id))
      .leftJoin(roles, eq(orgUsers.roleId, roles.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(designations, eq(employees.designationId, designations.id));
  }

  async getAuditLogs(limit = 200) {
    return this.db.select({
      id: authAuditLogs.id,
      organizationId: authAuditLogs.organizationId,
      userId: authAuditLogs.userId,
      username: authAuditLogs.username,
      organizationCode: authAuditLogs.organizationCode,
      event: authAuditLogs.event,
      ipAddress: authAuditLogs.ipAddress,
      userAgent: authAuditLogs.userAgent,
      success: authAuditLogs.success,
      reason: authAuditLogs.reason,
      createdAt: authAuditLogs.createdAt,
    })
      .from(authAuditLogs)
      .orderBy(desc(authAuditLogs.createdAt))
      .limit(limit);
  }

  async getPlatformStats() {
    const [orgCount] = await this.db.select({ n: count() }).from(organizations);
    const [userCount] = await this.db.select({ n: count() }).from(orgUsers);
    const [memberCount] = await this.db.select({ n: count() }).from(members);
    const [savingsCount] = await this.db.select({ n: count() }).from(savingsAccounts);
    const [loanCount] = await this.db.select({ n: count() }).from(loanAccounts);
    const [auditCount] = await this.db.select({ n: count() }).from(authAuditLogs);
    const [superAdminCount] = await this.db.select({ n: count() }).from(superAdmins);
    const [activeOrgs] = await this.db.select({ n: count() })
      .from(organizations)
      .where(eq(organizations.status, 'Active'));

    return {
      organizations: Number(orgCount?.n ?? 0),
      activeOrganizations: Number(activeOrgs?.n ?? 0),
      users: Number(userCount?.n ?? 0),
      members: Number(memberCount?.n ?? 0),
      savingsAccounts: Number(savingsCount?.n ?? 0),
      loanAccounts: Number(loanCount?.n ?? 0),
      auditLogs: Number(auditCount?.n ?? 0),
      superAdmins: Number(superAdminCount?.n ?? 0),
    };
  }

  // =============================================
  // SUPER ADMIN QUERIES
  // =============================================
  async findSuperAdminByUsername(username: string) {
    const results = await this.db.select()
      .from(superAdmins)
      .where(eq(superAdmins.username, username.toLowerCase()))
      .limit(1);
    return results[0] ?? null;
  }

  async findSuperAdminByAuthId(authUserId: string) {
    const results = await this.db.select()
      .from(superAdmins)
      .where(eq(superAdmins.authUserId, authUserId))
      .limit(1);
    return results[0] ?? null;
  }
}
