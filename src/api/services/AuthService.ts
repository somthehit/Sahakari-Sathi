/**
 * Auth Service
 * Enterprise IAM: Organization Code + Username + Password
 * Identity Provider: Supabase Auth
 * User Store: Supabase (PostgreSQL via Drizzle)
 */
import { eq } from 'drizzle-orm';
import { AuthRepository } from '../repositories/AuthRepository';
import { orgUsers, superAdmins } from '../../db/schema';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { supabaseClient } from '../../lib/supabaseServerClient';
import { getDb } from '../../db/client';
import { toRoleCode } from '../middleware/authMiddleware';
import { assertBranchInOrg } from '../middleware/scope';
import { sendWelcomeEmail } from '../../lib/emailService';
import { generatePassword } from '../../utils/generatePassword';
import { hashAnswer } from '../utils/secretHash';

/** A user must answer at least this many questions for recovery to be viable. */
export const MIN_SECURITY_ANSWERS = 2;

/**
 * Org password policy actually applied at password-change time.
 *
 * These are the fallbacks used when a tenant has never opened SETUPS → Admin →
 * Security. They match the rules that were previously hardcoded in
 * AuthController.changePassword, so behaviour is unchanged for orgs with no
 * configured policy.
 */
export const DEFAULT_PASSWORD_POLICY = {
  minPasswordLength: 8,
  requireSpecialChar: true,
  requireNumber: true,
  requireUppercase: true,
  requireLowercase: true,
  passwordExpiryDays: 90,
} as const;

export interface PasswordPolicy {
  minPasswordLength: number;
  requireSpecialChar: boolean;
  requireNumber: boolean;
  requireUppercase: boolean;
  requireLowercase: boolean;
  passwordExpiryDays: number;
}

export interface AuthUserProfile {
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  userId: string;
  username: string;
  role: string;
  fullName: string;
  requiresPasswordChange: boolean;
  isTemporaryPassword: boolean;
  emailVerified: boolean;
  securityScore: number;
  // First-time security setup flags
  passwordChanged: boolean;
  securitySetupCompleted: boolean;
  mobileVerified: boolean;
  mobileNumber: string | null;
  securityQuestionsCompleted: boolean;
  firstLoginCompleted: boolean;
  mustChangePassword: boolean;
  mustCompleteSecuritySetup: boolean;
  // Branch scope context
  branchId?: string;
  branchIds: string[];
  activeBranchId?: string;
  isOrgAdmin: boolean;
}

export interface LoginResult {
  /** Supabase Access Token */
  accessToken: string;
  /** Supabase Refresh Token */
  refreshToken: string;
  user: AuthUserProfile;
}

export class AuthService {
  private repo: AuthRepository;

  constructor() {
    this.repo = new AuthRepository();
  }

  /**
   * Enforce org membership for org-scoped user-management operations.
   * Super-admin / platform callers omit organizationId and act globally.
   */
  private async assertUserInOrg(userId: string, organizationId?: string): Promise<void> {
    if (!organizationId) return;
    const user = await this.repo.getOrgUserById(userId);
    if (!user) throw new Error('User not found.');
    if (user.organizationId !== organizationId) {
      throw new Error('User does not belong to this organization.');
    }
  }

  // ============================================
  // Generate synthetic email for Supabase Auth
  // User-facing login only uses OrgCode + Username
  // ============================================
  private syntheticEmail(username: string, orgCode: string): string {
    return `${username.toLowerCase()}@${orgCode.toLowerCase()}.sahakarisathi.internal`;
  }

  private syntheticSuperAdminEmail(username: string): string {
    return `${username.toLowerCase()}@system.sahakarisathi.internal`;
  }

  // ============================================
  // LOGIN: Organization Code + Username + Password
  // ============================================
  async login(
    organizationCode: string,
    username: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResult> {

    // 1. Find Organization
    const org = await this.repo.findOrganizationByCode(organizationCode);
    if (!org) {
      await this.repo.logAuthEvent({ organizationCode, username, event: 'FAILED_LOGIN', ipAddress, userAgent, success: false, reason: 'Organization not found or inactive' });
      throw new Error('Invalid organization code, username, or password.');
    }

    // 2. Find User within org
    const user = await this.repo.findUserByUsername(org.id, username);
    if (!user) {
      await this.repo.logAuthEvent({ organizationId: org.id, organizationCode, username, event: 'FAILED_LOGIN', ipAddress, userAgent, success: false, reason: 'User not found' });
      throw new Error('Invalid organization code, username, or password.');
    }

    // 3. Check account status
    if (user.status === 'Pending Activation') {
      throw new Error('Your account is pending activation. Contact your HR administrator.');
    }
    if (user.status === 'Suspended') {
      throw new Error('Your account has been suspended. Contact your administrator.');
    }
    if (user.status === 'Archived') {
      throw new Error('This account is no longer active.');
    }
    if (user.status === 'Locked') {
      throw new Error('Account locked due to multiple failed attempts. Contact your HR administrator to unlock.');
    }

    // 4. Verify password via Supabase Auth
    if (!user.authUserId) {
      throw new Error('Account configuration error. Contact your administrator.');
    }

    const syntheticEmail = this.syntheticEmail(username, organizationCode);
    let authRes = await supabaseClient.auth.signInWithPassword({
      email: syntheticEmail,
      password,
    });

    // Fallback to real email if synthetic email fails and user.email exists
    if ((authRes.error || !authRes.data.session) && user.email && user.email !== syntheticEmail) {
      const fallbackRes = await supabaseClient.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (!fallbackRes.error && fallbackRes.data.session) {
        authRes = fallbackRes;
      }
    }

    const { data, error } = authRes;

    if (error || !data.session) {
      // Increment local lock counter if wrong password
      if (error?.message?.toLowerCase().includes('invalid login credentials')) {
        await this.repo.logAuthEvent({ organizationId: org.id, userId: user.id, organizationCode, username, event: 'FAILED_LOGIN', ipAddress, userAgent, success: false, reason: `Invalid password: ${error.message}` });
      }
      throw new Error('Invalid organization code, username, or password.');
    }

    // 5. Log successful login
    await this.repo.logAuthEvent({
      organizationId: org.id,
      userId: user.id,
      organizationCode,
      username,
      event: 'LOGIN',
      ipAddress,
      userAgent,
      success: true,
    });

    // Log FIRST_LOGIN if this is a temporary password
    if (user.requiresPasswordChange) {
      await this.repo.logAuthEvent({
        organizationId: org.id,
        userId: user.id,
        organizationCode,
        username,
        event: 'FIRST_LOGIN',
        ipAddress,
        userAgent,
        success: true,
        reason: 'User logged in with temporary password — forced password change required',
      });
    }

    const requiresPasswordChange = user.requiresPasswordChange ?? true;
    const isTemporaryPassword = (user as any).isTemporaryPassword ?? requiresPasswordChange;
    const securitySetupCompleted = (user as any).securitySetupCompleted ?? false;
    const role = toRoleCode(user.roleName || 'viewer');
    const isOrgAdmin = role === 'org_admin';

    // Branch scope: org admins get every branch; branch staff only their own.
    let branchIds: string[] = [];
    if (isOrgAdmin) {
      branchIds = await this.repo.getOrgBranchIds(org.id);
    } else if (user.branchId) {
      branchIds = [user.branchId];
    }
    const activeBranchId = user.activeBranchId || user.branchId || branchIds[0];

    const profile: AuthUserProfile = {
      organizationId: org.id,
      organizationCode: org.organizationCode,
      organizationName: org.organizationName || org.organizationCode,
      userId: user.id,
      username: user.username,
      role,
      fullName: user.fullName || user.username,
      requiresPasswordChange,
      isTemporaryPassword,
      emailVerified: user.emailVerified ?? false,
      securityScore: user.securityScore ?? 0,
      passwordChanged: (user as any).passwordChanged ?? !requiresPasswordChange,
      securitySetupCompleted,
      mobileVerified: (user as any).mobileVerified ?? false,
      mobileNumber: (user as any).mobileNumber ?? null,
      securityQuestionsCompleted: (user as any).securityQuestionsCompleted ?? false,
      firstLoginCompleted: (user as any).firstLoginCompleted ?? false,
      mustChangePassword: requiresPasswordChange || isTemporaryPassword,
      mustCompleteSecuritySetup: !securitySetupCompleted,
      branchId: user.branchId ?? undefined,
      branchIds,
      activeBranchId,
      isOrgAdmin,
    };

    return { 
      accessToken: data.session.access_token, 
      refreshToken: data.session.refresh_token,
      user: profile 
    };
  }

  // ============================================
  // SUPER ADMIN LOGIN: Username + Password (no org)
  // ============================================
  async superAdminLogin(
    username: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<any> {
    // 1. Find Super Admin
    const superAdmin = await this.repo.findSuperAdminByUsername(username);
    if (!superAdmin) {
      await this.repo.logAuthEvent({ username, event: 'FAILED_LOGIN', ipAddress, userAgent, success: false, reason: 'Super Admin not found' });
      throw new Error('Invalid username or password.');
    }

    if (superAdmin.status !== 'Active') {
      throw new Error('Your account is not active. Contact system support.');
    }

    // 2. Authenticate using Supabase Auth
    const email = this.syntheticSuperAdminEmail(username);
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      if (error?.message?.toLowerCase().includes('invalid login credentials')) {
        await this.repo.logAuthEvent({ username, event: 'FAILED_LOGIN', ipAddress, userAgent, success: false, reason: 'Invalid password' });
      }
      throw new Error('Invalid username or password.');
    }

    // 3. Log success
    await this.repo.logAuthEvent({
      username,
      event: 'LOGIN',
      ipAddress,
      userAgent,
      success: true,
    });

    // Update last login timestamp
    try {
      const db = getDb();
      if (db) {
        await db.update(superAdmins)
          .set({ lastLogin: new Date(), updatedAt: new Date() })
          .where(eq(superAdmins.id, superAdmin.id));
      }
    } catch { /* non-blocking */ }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: superAdmin.id,
        username: superAdmin.username,
        email: superAdmin.email,
        fullName: superAdmin.fullName,
        role: 'super_admin',
        status: superAdmin.status,
      }
    };
  }

  // ============================================
  // HR FLOW: Create User Account
  // Supabase is the identity provider. No bcrypt.
  // ============================================
  async createOrgUser(data: Omit<typeof orgUsers.$inferInsert, 'authUserId' | 'status' | 'requiresPasswordChange' | 'isTemporaryPassword' | 'temporaryPassword' | 'passwordChanged'> & {
    temporaryPassword: string;
    employeeEmail: string;
  }) {
    const { temporaryPassword, employeeEmail, ...rest } = data;

    const org = await this.repo.getOrganizationById(rest.organizationId);
    if (!org) throw new Error('Organization not found.');

    // Never trust org-scoped FK references from the request body.
    if (rest.branchId) await assertBranchInOrg(rest.organizationId, rest.branchId);
    if (rest.roleId && !(await this.repo.isRoleInOrg(rest.roleId, rest.organizationId))) {
      throw new Error('Role does not belong to this organization.');
    }
    if (rest.employeeId && !(await this.repo.isEmployeeInOrg(rest.employeeId, rest.organizationId))) {
      throw new Error('Employee does not belong to this organization.');
    }

    const email = this.syntheticEmail(rest.username, org.organizationCode);

    // 1. Create user in Supabase Auth (Admin API)
    const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        username: rest.username,
      }
    });

    if (error) {
      if (error.message.includes('already been registered')) {
         throw new Error(`User already exists for this username.`);
      }
      throw new Error(`Supabase user creation failed: ${error.message}`);
    }

    if (!authData.user) {
      throw new Error(`Supabase user creation failed: No user returned`);
    }

    // 2. Store user in PostgreSQL with Supabase Auth UID
    const newUser = await this.repo.createOrgUser({
      ...rest,
      email: employeeEmail, // Employee's actual email for reset/verification
      authUserId: authData.user.id,
      requiresPasswordChange: true,
      isTemporaryPassword: true,
      temporaryPassword: true,
      status: 'Active', // Account is ACTIVE immediately as per policy
    });

    return newUser;
  }

  // ============================================
  // PASSWORD RESET: Send reset link via Supabase
  // ============================================
  async sendPasswordResetEmail(organizationCode: string, username: string): Promise<void> {
    const org = await this.repo.findOrganizationByCode(organizationCode);
    if (!org) throw new Error('Invalid organization code or username.');

    const user = await this.repo.findUserByUsername(org.id, username);
    if (!user) throw new Error('Invalid organization code or username.');

    const email = this.syntheticEmail(username, organizationCode);

    // Generate Supabase password reset link
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    });
    
    if (error) {
      console.error('[Auth] Failed to generate recovery link:', error);
      throw new Error('Failed to generate recovery link');
    }

    // TODO: Send `data.properties.action_link` to user's actual email (user.email) via Nodemailer or another service.
    console.log(`[Auth] Password reset link generated for ${username}. Send to: ${user.email}. Link: ${data.properties.action_link}`);
  }

  // ============================================
  // Admin: Unlock account, force password reset
  // ============================================
  async unlockUser(userId: string, organizationId?: string): Promise<void> {
    await this.assertUserInOrg(userId, organizationId);
    await this.repo.updateOrgUser(userId, { status: 'Active' });
  }

  async forcePasswordReset(userId: string, newTemporaryPassword: string, organizationId?: string): Promise<void> {
    await this.assertUserInOrg(userId, organizationId);
    const user = await this.repo.getOrgUserById(userId);
    if (!user?.authUserId) throw new Error('User or Auth UID not found.');

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.authUserId, { password: newTemporaryPassword });
    if (error) {
      throw new Error(`Failed to force password reset: ${error.message}`);
    }
    
    await this.repo.updateOrgUser(userId, {
      requiresPasswordChange: true,
      isTemporaryPassword: true,
      temporaryPassword: true,
      passwordChanged: false,
      passwordCreatedAt: new Date(),
      status: 'Active',
    });
  }

  // ============================================
  // Admin: Lock / Activate / Deactivate / Reset / Sessions
  // ============================================
  async lockUser(userId: string, organizationId?: string): Promise<void> {
    await this.assertUserInOrg(userId, organizationId);
    const user = await this.repo.getOrgUserById(userId);
    if (!user) throw new Error('User not found.');
    await this.repo.updateOrgUser(userId, { status: 'Locked' });
    if (user.authUserId) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(user.authUserId, { ban_duration: '8760h' });
      } catch { /* best-effort */ }
    }
  }

  async activateUser(userId: string, organizationId?: string): Promise<void> {
    await this.assertUserInOrg(userId, organizationId);
    const user = await this.repo.getOrgUserById(userId);
    if (!user) throw new Error('User not found.');
    await this.repo.updateOrgUser(userId, { status: 'Active' });
    if (user.authUserId) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(user.authUserId, { ban_duration: 'none' });
      } catch { /* best-effort */ }
    }
  }

  async deactivateUser(userId: string, organizationId?: string): Promise<void> {
    await this.assertUserInOrg(userId, organizationId);
    const user = await this.repo.getOrgUserById(userId);
    if (!user) throw new Error('User not found.');
    await this.repo.updateOrgUser(userId, { status: 'Suspended' });
    if (user.authUserId) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(user.authUserId, { ban_duration: '8760h' });
        await supabaseAdmin.auth.admin.signOut(user.authUserId, 'global');
      } catch { /* best-effort */ }
    }
  }

  /** Generate a fresh temp password, force a change on next login, email it. */
  async resetUserPassword(userId: string, organizationId?: string): Promise<{ temporaryPassword: string }> {
    await this.assertUserInOrg(userId, organizationId);
    const user = await this.repo.getOrgUserById(userId);
    if (!user) throw new Error('User not found.');
    const org = await this.repo.getOrganizationById(user.organizationId);
    if (!org) throw new Error('Organization not found.');

    const temporaryPassword = generatePassword();
    await this.forcePasswordReset(userId, temporaryPassword, organizationId);

    const recipient = user.email || (user.employeeId ? '' : '');
    this.sendWelcomeTo(org.organizationName, org.organizationCode, {
      username: user.username,
      temporaryPassword,
      email: recipient,
      fullName: user.username,
    });
    return { temporaryPassword };
  }

  async resendWelcomeEmail(userId: string, organizationId?: string): Promise<{ temporaryPassword: string }> {
    return this.resetUserPassword(userId, organizationId);
  }

  async terminateSessions(userId: string, organizationId?: string): Promise<void> {
    await this.assertUserInOrg(userId, organizationId);
    const user = await this.repo.getOrgUserById(userId);
    if (!user) throw new Error('User not found.');
    if (user.authUserId) {
      try {
        await supabaseAdmin.auth.admin.signOut(user.authUserId, 'global');
      } catch { /* best-effort */ }
    }
  }

  private sendWelcomeTo(organizationName: string, organizationCode: string, d: {
    username: string;
    temporaryPassword: string;
    email: string;
    fullName: string;
  }) {
    if (!d.email) {
      console.log('[Email] No recipient email for user; welcome email skipped:', d.username);
      return;
    }
    sendWelcomeEmail({
      organizationName,
      organizationCode,
      username: d.username,
      temporaryPassword: d.temporaryPassword,
      adminEmail: d.email,
      adminFullName: d.fullName,
    }).catch(() => { /* non-blocking */ });
  }

  /**
   * Called when a user successfully changes their temporary password on first login.
   * Marks isTemporaryPassword = false and logs the security event.
   *
   * GoTrue revokes the user's existing session whenever the password changes, so the
   * previously-issued access token becomes invalid immediately. To keep the user signed
   * in, this re-authenticates with the new password and returns a fresh session.
   */
  async completeFirstPasswordChange(
    userId: string,
    organizationId: string,
    organizationCode: string,
    username: string,
    newPassword: string,
    authUserId: string,
  ): Promise<LoginResult | null> {
    // 1. Update Supabase Auth password (skip in dev bypass mode)
    if (process.env.API_MODE !== 'false') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: newPassword });
      if (error) throw new Error(`Failed to update password: ${error.message}`);
    }

    // 2. Clear temporary password flags in DB, and stamp the expiry implied by
    //    the org's configured password policy (0 days = never expires).
    const policy = await this.getPasswordPolicy(organizationId);
    const expiresAt = policy.passwordExpiryDays > 0
      ? new Date(Date.now() + policy.passwordExpiryDays * 24 * 60 * 60 * 1000)
      : null;
    await this.repo.updateOrgUser(userId, {
      requiresPasswordChange: false,
      isTemporaryPassword: false,
      temporaryPassword: false,
      passwordChanged: true,
      passwordChangedAt: new Date(),
      passwordCreatedAt: new Date(),
      passwordExpiresAt: expiresAt,
      updatedAt: new Date(),
    });

    // 3. Audit log
    await this.repo.logAuthEvent({
      organizationId,
      userId,
      organizationCode,
      username,
      event: 'FORCED_PASSWORD_CHANGE_COMPLETED',
      success: true,
      reason: 'User completed mandatory first-login password change',
    });

    // 4. Re-authenticate with the new password to obtain a fresh session.
    //    (Skipped in dev bypass mode where no real Supabase session exists.)
    if (process.env.API_MODE === 'false') return null;
    return this.login(organizationCode, username, newPassword);
  }


  async getOrgUsers(organizationId: string) {
    return this.repo.getOrgUsers(organizationId);
  }

  // =============================================
  // SECURITY QUESTIONS
  // =============================================
  /** Catalogue offered by the Security Setup Wizard: global + org-specific. */
  async getSecurityQuestions(organizationId?: string) {
    return this.repo.getSecurityQuestions(organizationId);
  }

  // =============================================
  // ORGANIZATION SECURITY POLICY
  // =============================================
  /** The org's stored policy, or undefined when never configured. */
  async getSecuritySettings(organizationId: string) {
    return this.repo.getSecuritySettings(organizationId);
  }

  async updateSecuritySettings(
    organizationId: string,
    data: Record<string, any>,
    updatedBy?: string,
  ) {
    return this.repo.upsertSecuritySettings(organizationId, data, updatedBy);
  }

  /**
   * Resolve the password rules to apply for an org, falling back to
   * DEFAULT_PASSWORD_POLICY when no policy row exists.
   *
   * Never throws: a policy lookup failure must not be able to block a user
   * from changing their password, so it degrades to the defaults.
   */
  async getPasswordPolicy(organizationId?: string): Promise<PasswordPolicy> {
    if (!organizationId) return { ...DEFAULT_PASSWORD_POLICY };
    try {
      const row = await this.repo.getSecuritySettings(organizationId);
      if (!row) return { ...DEFAULT_PASSWORD_POLICY };
      return {
        minPasswordLength: row.minPasswordLength ?? DEFAULT_PASSWORD_POLICY.minPasswordLength,
        requireSpecialChar: row.requireSpecialChar ?? DEFAULT_PASSWORD_POLICY.requireSpecialChar,
        requireNumber: row.requireNumber ?? DEFAULT_PASSWORD_POLICY.requireNumber,
        requireUppercase: row.requireUppercase ?? DEFAULT_PASSWORD_POLICY.requireUppercase,
        requireLowercase: row.requireLowercase ?? DEFAULT_PASSWORD_POLICY.requireLowercase,
        passwordExpiryDays: row.passwordExpiryDays ?? DEFAULT_PASSWORD_POLICY.passwordExpiryDays,
      };
    } catch {
      return { ...DEFAULT_PASSWORD_POLICY };
    }
  }

  /**
   * Validate a candidate password against a policy.
   * Returns the list of violations; empty means the password is acceptable.
   */
  static validatePassword(password: string, policy: PasswordPolicy): string[] {
    const errors: string[] = [];
    if (password.length < policy.minPasswordLength) {
      errors.push(`Password must be at least ${policy.minPasswordLength} characters.`);
    }
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain an uppercase letter.');
    }
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain a lowercase letter.');
    }
    if (policy.requireNumber && !/[0-9]/.test(password)) {
      errors.push('Password must contain a number.');
    }
    if (policy.requireSpecialChar && !/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain a special character.');
    }
    return errors;
  }

  /**
   * Called when a user finishes the Security Setup Wizard
   * (mobile verification + security questions).
   * Persists completion so the wizard never appears again.
   *
   * Security answers are hashed with scrypt and written BEFORE the completion
   * flags are set, so a storage failure aborts the whole thing rather than
   * marking the questions step done with nothing behind it.
   */
  async completeSecuritySetup(
    userId: string,
    organizationId: string,
    organizationCode: string,
    username: string,
    mobileNumber?: string,
    securityAnswers?: { questionId: string; answer: string }[],
  ): Promise<{ user: AuthUserProfile }> {
    let questionsCompleted = false;

    if (securityAnswers && securityAnswers.length > 0) {
      const questionIds = securityAnswers.map(a => a.questionId);
      if (new Set(questionIds).size !== questionIds.length) {
        throw new Error('Each security question may only be answered once.');
      }
      const visible = await this.repo.areQuestionsVisibleToOrg(questionIds, organizationId);
      if (!visible) {
        throw new Error('One or more security questions are not available to this organization.');
      }

      const hashed = await Promise.all(
        securityAnswers.map(async a => ({
          questionId: a.questionId,
          encryptedAnswer: await hashAnswer(a.answer),
        })),
      );
      await this.repo.replaceUserSecurityAnswers(userId, hashed);
      questionsCompleted = (await this.repo.countUserSecurityAnswers(userId)) >= MIN_SECURITY_ANSWERS;
    }

    const updated = await this.repo.markSecuritySetupComplete(userId, mobileNumber, questionsCompleted);
    if (!updated) throw new Error('User not found.');

    await this.repo.logAuthEvent({
      organizationId,
      userId,
      organizationCode,
      username,
      event: 'SECURITY_SETUP_COMPLETED',
      success: true,
      reason: `User completed security setup wizard (mobile ${mobileNumber ? 'verified' : 'skipped'}, ${questionsCompleted ? `${securityAnswers?.length ?? 0} security answers stored` : 'no security answers stored'})`,
    });

    const isOrgAdmin = (updated as any).roleName === 'org_admin';
    let branchIds: string[] = [];
    if (isOrgAdmin) {
      branchIds = await this.repo.getOrgBranchIds(organizationId);
    } else if ((updated as any).branchId) {
      branchIds = [(updated as any).branchId];
    }
    const activeBranchId = (updated as any).activeBranchId || (updated as any).branchId || branchIds[0];
    const org = await this.repo.getOrganizationById(organizationId);

    return {
      user: {
        organizationId: updated.organizationId,
        organizationCode,
        organizationName: org?.organizationName || organizationCode,
        userId: updated.id,
        username: updated.username,
        role: 'viewer',
        fullName: updated.username,
        requiresPasswordChange: updated.requiresPasswordChange,
        isTemporaryPassword: updated.isTemporaryPassword,
        emailVerified: updated.emailVerified,
        securityScore: updated.securityScore ?? 0,
        passwordChanged: updated.passwordChanged,
        securitySetupCompleted: updated.securitySetupCompleted,
        mobileVerified: updated.mobileVerified,
        mobileNumber: updated.mobileNumber ?? null,
        securityQuestionsCompleted: updated.securityQuestionsCompleted,
        firstLoginCompleted: updated.firstLoginCompleted,
        mustChangePassword: false,
        mustCompleteSecuritySetup: false,
        branchId: (updated as any).branchId ?? undefined,
        branchIds,
        activeBranchId,
        isOrgAdmin,
      },
    };
  }

  async updateOrgUser(id: string, data: any, organizationId?: string) {
    await this.assertUserInOrg(id, organizationId);
    return this.repo.updateOrgUser(id, data);
  }

  async createOrganization(data: any) {
    return this.repo.createOrganization(data);
  }

  async generateNextRegNo(organizationType: string, bsYear: number): Promise<string> {
    return this.repo.generateNextRegNo(organizationType, bsYear);
  }

  async provisionOrganization(data: {
    organizationCode?: string;          // optional — auto-generated if omitted
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
    adminTemporaryPassword?: string;   // optional — auto-generated if omitted
  }) {
    // Auto-generate org code if not provided
    let code: string;
    if (data.organizationCode?.trim()) {
      code = data.organizationCode.toUpperCase();
    } else {
      const { resolveUniqueOrgCode } = await import('../../utils/generateOrgCode');
      code = await resolveUniqueOrgCode(
        data.shortName,
        data.organizationName,
        async (candidate) => {
          const existing = await this.repo.findOrganizationByCode(candidate);
          return existing !== null;
        },
      );
    }
    const username = data.adminUsername.toLowerCase().trim();

    // Validate username format before touching anything
    if (!/^[a-z][a-z0-9_.]{2,29}$/.test(username)) {
      throw new Error('Admin username must be 3-30 lowercase letters/numbers (starts with letter).');
    }

    // Auto-generate the one-time admin password if the caller didn't provide one
    const adminTemporaryPassword = data.adminTemporaryPassword?.trim() || generatePassword();
    if (adminTemporaryPassword.length < 8) {
      throw new Error('Admin temporary password must be at least 8 characters.');
    }

    // 1. Create Supabase Auth user FIRST (outside DB transaction — can't rollback Supabase)
    const syntheticEmail = `${username}@${code.toLowerCase()}.sahakarisathi.internal`;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password: adminTemporaryPassword,
      email_confirm: true,
      user_metadata: { username },
    });

    if (authError || !authData.user) {
      if (authError?.message.includes('already been registered')) {
        throw new Error(`Username "${username}" is already registered in this system.`);
      }
      throw new Error(`Auth user creation failed: ${authError?.message || 'Unknown error'}`);
    }

    const authUserId = authData.user.id;

    // 2. Run all DB work atomically — rollback on any failure
    try {
      const result = await this.repo.provisionOrganization({
        ...data,
        organizationCode: code,
        authUserId,
      });
      const provision = { ...result, temporaryPassword: adminTemporaryPassword };

      // 3. Send welcome email AFTER the DB transaction commits (non-blocking)
      // If email fails, queue it for retry — do NOT rollback the org creation
      setImmediate(async () => {
        const emailResult = await sendWelcomeEmail({
          organizationName: data.organizationName,
          organizationCode: code,
          username,
          temporaryPassword: adminTemporaryPassword,
          adminEmail: data.adminEmail,
          adminFullName: data.adminFullName,
        });

        if (emailResult.ok) {
          await this.repo.logAuthEvent({
            organizationId: provision.organization.id,
            userId: provision.adminUser.id,
            organizationCode: code,
            username,
            event: 'WELCOME_EMAIL_SENT',
            success: true,
            reason: `Welcome email sent to ${data.adminEmail}`,
          });
        } else {
          // Queue for retry — persist failure to audit log
          await this.repo.logAuthEvent({
            organizationId: provision.organization.id,
            userId: provision.adminUser.id,
            organizationCode: code,
            username,
            event: 'WELCOME_EMAIL_FAILED',
            success: false,
            reason: emailResult.error || 'SMTP delivery failed',
          });
          // Persist to email queue for retry
          await this.repo.queueEmail({
            organizationId: provision.organization.id,
            userId: provision.adminUser.id,
            toEmail: data.adminEmail,
            toName: data.adminFullName,
            subject: `Welcome to Sahakari Sathi — ${data.organizationName} Admin Credentials`,
            templateType: 'welcome',
            templateData: {
              organizationName: data.organizationName,
              organizationCode: code,
              username,
              temporaryPassword: adminTemporaryPassword,
              adminFullName: data.adminFullName,
            },
          });
        }
      });

      // Also log the temporary password generation
      await this.repo.logAuthEvent({
        organizationId: provision.organization.id,
        userId: provision.adminUser.id,
        organizationCode: code,
        username,
        event: 'TEMPORARY_PASSWORD_GENERATED',
        success: true,
        reason: 'Temporary password set during organization provisioning',
      });

      return provision;
    } catch (dbError) {
      // Compensate: delete the Supabase user so nothing is left half-created
      try {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      } catch (cleanupError) {
        console.error('[Provision] Failed to clean up Supabase user after DB rollback:', cleanupError);
      }
      throw dbError;
    }
  }

  async getAllOrganizations() {
    return this.repo.getAllOrganizations();
  }

  async getOrganizationDetail(id: string) {
    return this.repo.getOrganizationDetail(id);
  }

  async getNepalGeoData() {
    return this.repo.getNepalGeoData();
  }

  async getOrgAuditLogs(organizationId: string, limit = 50) {
    return this.repo.getOrgAuditLogs(organizationId, limit);
  }

  async getOrgRoles(organizationId: string) {
    return this.repo.getOrgRoles(organizationId);
  }

  async getOrgDepartmentsAndDesignations(organizationId: string) {
    return this.repo.getOrgDepartmentsAndDesignations(organizationId);
  }

  async getBranches(organizationId: string) {
    const { getDb } = await import('../../db/client');
    const { branches } = await import('../../db/schema/branches');
    const { asc } = await import('drizzle-orm');
    const { eq } = await import('drizzle-orm');
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    return db.select({ id: branches.id, code: branches.code, name: branches.name })
      .from(branches)
      .where(eq(branches.organizationId, organizationId))
      .orderBy(asc(branches.name));
  }

  // ============================================
  // BRANCH CONTEXT SWITCH (org admin only)
  // Password re-verified via Supabase Auth before the
  // active branch is persisted server-side.
  // ============================================
  async switchBranch(params: {
    userId: string;
    organizationId: string;
    organizationCode: string;
    username: string;
    authUserId?: string;
    branchId: string;
    password?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ activeBranchId: string; branchIds: string[] }> {
    const { userId, organizationId, organizationCode, username, branchId, password } = params;

    // 1. The target branch must belong to the caller's organization.
    await assertBranchInOrg(organizationId, branchId);

    // 2. Branch staff cannot switch — this endpoint is org-admin scope.
    const user = await this.repo.getOrgUserById(userId);
    if (!user) throw new Error('User not found.');
    if (user.organizationId !== organizationId) throw new Error('User does not belong to this organization.');

    // 3. Re-verify the caller's password (dev bypass skips Supabase).
    if (process.env.API_MODE !== 'false') {
      if (!password) throw new Error('Password confirmation is required.');
      const email = this.syntheticEmail(username, organizationCode);
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        await this.repo.logAuthEvent({
          organizationId,
          userId,
          organizationCode,
          username,
          event: 'FAILED_BRANCH_SWITCH',
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          success: false,
          reason: 'Incorrect password on branch switch attempt',
        });
        throw new Error('Invalid password.');
      }
    }

    // 4. Persist the new active branch.
    await this.repo.setActiveBranchId(userId, branchId);

    // 5. Audit trail.
    await this.repo.logAuthEvent({
      organizationId,
      userId,
      organizationCode,
      username,
      event: 'BRANCH_SWITCH',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: true,
      reason: `Active branch context switched to ${branchId}`,
    });

    const branchIds = await this.repo.getOrgBranchIds(organizationId);
    return { activeBranchId: branchId, branchIds };
  }

  async updateOrganizationStatus(id: string, status: 'Active' | 'Suspended' | 'Inactive') {
    return this.repo.updateOrganizationStatus(id, status);
  }

  async updateOrganization(id: string, data: any) {
    return this.repo.updateOrganization(id, data);
  }

  async getAllPlatformUsers() {
    return this.repo.getAllPlatformUsers();
  }

  async createSuperAdminUser(data: { username: string; password: string; fullName: string; email: string }) {
    // Note: password handling via Supabase Auth is a future integration.
    // For now we record the super admin record in our DB.
    // In production, you'd call supabaseAdmin.auth.admin.createUser(...) first.
    const existing = await this.repo.findSuperAdminByUsername(data.username);
    if (existing) throw new Error(`Username "${data.username}" is already taken.`);
    return this.repo.createSuperAdminUser({
      username: data.username,
      fullName: data.fullName || data.username,
      email: data.email,
    });
  }

  async updatePlatformUser(id: string, data: { fullName?: string; email?: string; status?: string }) {
    return this.repo.updateOrgUser(id, {
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.status !== undefined ? { status: data.status as any } : {}),
    });
  }

  async resetPlatformUserPassword(id: string, newPassword: string) {
    await this.forcePasswordReset(id, newPassword);
  }

  async getSuperAdmins() {
    return this.repo.getAllSuperAdmins();
  }

  async updateSuperAdminUser(id: string, data: { fullName?: string; email?: string; status?: string }) {
    return this.repo.updateSuperAdminRecord(id, data);
  }

  async getAuditLogs(limit = 200) {
    return this.repo.getAuditLogs(limit);
  }

  async getPlatformStats() {
    return this.repo.getPlatformStats();
  }
}
