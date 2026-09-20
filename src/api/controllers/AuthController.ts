import { Request, Response } from 'express';
import { AuthService, MIN_SECURITY_ANSWERS, DEFAULT_PASSWORD_POLICY } from '../services/AuthService';
import { z } from 'zod';
import { updateOrgProfileSchema } from '../schemas/organizationSettings';
import { buildAuditRow, computeDiff, writeAuditLog, splitDiffIntoSnapshots } from '../utils/audit';
import { supabaseClient } from '../../lib/supabaseServerClient';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

const authService = new AuthService();

export class AuthController {

  // ============================================
  // POST /api/v1/auth/login
  // Returns: { accessToken, refreshToken, user }
  // ============================================
  static async login(req: Request, res: Response) {
    try {
      const { organizationCode, username, password } = req.body;
      const ipAddress = req.ip || req.socket?.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.login(organizationCode, username, password, ipAddress, userAgent);

      res.json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
        // First-time security flow flags
        passwordChanged: result.user.passwordChanged,
        securitySetupCompleted: result.user.securitySetupCompleted,
        mobileVerified: result.user.mobileVerified,
        securityQuestionsCompleted: result.user.securityQuestionsCompleted,
        mustChangePassword: result.user.mustChangePassword,
        mustCompleteSecuritySetup: result.user.mustCompleteSecuritySetup,
      });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  // ============================================
  // GET /api/v1/auth/me
  // ============================================
  static async me(req: any, res: Response) {
    res.json({ user: req.user });
  }

  // ============================================
  // POST /api/v1/auth/forgot-password
  // Body: { organizationCode, username }
  // ============================================
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { organizationCode, username } = req.body;
      await authService.sendPasswordResetEmail(organizationCode, username);
      res.json({ message: 'If an account was found, a password reset link has been sent.' });
    } catch (error: any) {
      // Always return 200 to prevent username enumeration
      res.json({ message: 'If an account was found, a password reset link has been sent.' });
    }
  }

  // ============================================
  // POST /api/v1/auth/logout (audit log hook)
  // ============================================
  static async logout(_req: any, res: Response) {
    res.json({ message: 'Logged out successfully' });
  }

  // ============================================
  // POST /api/v1/auth/super-admin/login
  // ============================================
  static async superAdminLogin(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      const ipAddress = req.ip || req.socket?.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await authService.superAdminLogin(username, password, ipAddress, userAgent);
      res.json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  // ============================================
  // POST /api/v1/auth/refresh-token
  // Refresh a Supabase session using refresh_token
  // ============================================
  static async refreshToken(req: Request, res: Response) {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) {
        return res.status(400).json({ error: 'refresh_token is required' });
      }
      const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token });
      if (error || !data.session) {
        return res.status(401).json({ error: 'Token refresh failed. Please log in again.' });
      }
      res.json({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      });
    } catch (error: any) {
      res.status(401).json({ error: 'Token refresh failed' });
    }
  }

  // ============================================
  // POST /api/v1/super-admin/organizations
  // ============================================
  // ============================================
  // POST /api/v1/super-admin/organizations/provision
  // ============================================
  static async provisionOrganization(req: Request, res: Response) {
    try {
      const {
        organizationCode, organizationName, adminFullName,
        adminUsername, adminEmail, adminTemporaryPassword,
      } = req.body;

      if (!organizationCode || !organizationName || !adminFullName || !adminUsername || !adminEmail) {
        return res.status(400).json({
          error: 'Required: organizationCode, organizationName, adminFullName, adminUsername, adminEmail',
        });
      }
      if (adminTemporaryPassword && adminTemporaryPassword.length < 8) {
        return res.status(400).json({ error: 'adminTemporaryPassword must be at least 8 characters.' });
      }

      const result = await authService.provisionOrganization(req.body);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async createOrganization(req: Request, res: Response) {
    try {
      const org = await authService.createOrganization(req.body);
      res.status(201).json(org);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ============================================
  // GET /api/v1/super-admin/organizations/next-reg-no?type=Cooperative&bsYear=2083
  // Returns: { registrationNo: "COP-2083-0001" }
  // ============================================
  static async getNextRegNo(req: Request, res: Response) {
    try {
      const { type = 'Cooperative', bsYear } = req.query as { type?: string; bsYear?: string };
      const year = parseInt(bsYear ?? '2083', 10);
      const regNo = await authService.generateNextRegNo(type, year);
      res.json({ registrationNo: regNo });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getOrganizations(_req: Request, res: Response) {
    try {
      const orgs = await authService.getAllOrganizations();
      res.json(orgs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateOrganizationStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!['Active', 'Suspended', 'Inactive'].includes(status)) {
        return res.status(400).json({ error: 'Status must be Active, Suspended, or Inactive.' });
      }
      const org = await authService.updateOrganizationStatus(id, status);
      if (!org) return res.status(404).json({ error: 'Organization not found.' });
      res.json(org);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getOrganizationDetail(req: Request, res: Response) {
    try {
      const org = await authService.getOrganizationDetail(req.params.id);
      if (!org) return res.status(404).json({ error: 'Organization not found.' });
      res.json(org);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateOrganization(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const allowed = [
        'organizationName', 'shortName', 'organizationType', 'slug',
        'province', 'district', 'municipality',
        'address',
        'phone', 'mobile', 'email', 'website',
        'pan', 'registrationNo', 'registrationDate',
        'logoUrl', 'faviconUrl', 'themeColor',
        'timezone', 'locale', 'currencyCode', 'dateFormat', 'fiscalYear',
        'subscriptionPlan', 'subscriptionStatus',
        'subscriptionStart', 'subscriptionEnd', 'trialEnd',
        'isVerified', 'isMultiBranch', 'aiEnabled', 'aiCredit',
        'storageLimitMb', 'storageUsedMb', 'maxMembers', 'maxUsers', 'maxBranches',
      ];
      const data: Record<string, any> = {};
      for (const k of allowed) {
        if (req.body?.[k] !== undefined) data[k] = req.body[k] === '' ? null : req.body[k];
      }
      if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No updatable fields provided.' });
      const org = await authService.updateOrganization(id, data);
      if (!org) return res.status(404).json({ error: 'Organization not found.' });
      res.json(org);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getOrgAuditLogs(req: Request, res: Response) {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const logs = await authService.getOrgAuditLogs(req.params.id, limit);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getOrgRoles(req: Request, res: Response) {
    try {
      const roles = await authService.getOrgRoles(req.params.id);
      res.json(roles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // GET /api/v1/org/reference — departments + designations + roles + branches
  // for the staff form / user management dropdowns
  // ============================================
  static async getOrgReference(req: any, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(400).json({ error: 'Organization context missing.' });
      const [orgRef, roles, branches] = await Promise.all([
        authService.getOrgDepartmentsAndDesignations(organizationId),
        authService.getOrgRoles(organizationId),
        authService.getBranches(organizationId),
      ]);
      res.json({
        departments: orgRef.departments,
        designations: orgRef.designations,
        roles,
        branches,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getPlatformUsers(_req: Request, res: Response) {
    try {
      const users = await authService.getAllPlatformUsers();
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // POST /api/v1/super-admin/users — create a new super admin account
  // ============================================
  static async createSuperAdminUser(req: Request, res: Response) {
    try {
      const { username, password, fullName, email } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'username and password are required.' });
      }
      const user = await authService.createSuperAdminUser({ username, password, fullName, email });
      res.status(201).json({ user });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async updatePlatformUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { fullName, email, status } = req.body;
      const user = await authService.updatePlatformUser(id, { fullName, email, status });
      if (!user) return res.status(404).json({ error: 'User not found.' });
      res.json({ user });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async resetPlatformUserPassword(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' });
      }
      await authService.resetPlatformUserPassword(id, newPassword);
      res.json({ message: 'Password reset successfully.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getSuperAdmins(_req: Request, res: Response) {
    try {
      const admins = await authService.getSuperAdmins();
      res.json(admins);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateSuperAdminUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { fullName, email, status } = req.body;
      const admin = await authService.updateSuperAdminUser(id, { fullName, email, status });
      if (!admin) return res.status(404).json({ error: 'Super admin not found.' });
      res.json({ admin });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ============================================
  // POST /api/v1/super-admin/platform-users — super admin creates user for any org
  // ============================================
  static async createPlatformUser(req: Request, res: Response) {
    try {
      const { organizationId, username, temporaryPassword, employeeEmail, roleId } = req.body;
      if (!organizationId || !username || !temporaryPassword || !employeeEmail) {
        return res.status(400).json({ error: 'organizationId, username, temporaryPassword, and employeeEmail are required.' });
      }
      const user = await authService.createOrgUser({
        organizationId,
        username,
        temporaryPassword,
        employeeEmail,
        email: employeeEmail,
        ...(roleId ? { roleId } : {}),
      });
      res.status(201).json({ user });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getAuditLogs(req: Request, res: Response) {
    try {
      const limit = Math.min(Number(req.query.limit) || 200, 1000);
      const logs = await authService.getAuditLogs(limit);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getPlatformStats(_req: Request, res: Response) {
    try {
      const stats = await authService.getPlatformStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // GET /api/v1/org/profile — current org + Nepal geo lists
  // ============================================
  static async getOrgProfile(req: any, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(400).json({ error: 'Organization context missing.' });

      const [organization, geo] = await Promise.all([
        authService.getOrganizationDetail(organizationId),
        authService.getNepalGeoData(),
      ]);
      if (!organization) return res.status(404).json({ error: 'Organization not found' });
      res.json({ organization, ...geo });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // PUT /api/v1/org/profile — update own org profile
  // ============================================
  static async updateOrgProfile(req: any, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(400).json({ error: 'Organization context missing.' });

      // Whitelist: tenants may NOT touch code/type/slug, subscription, limits, status, ownership, feature flags.
      const ALLOWED = [
        'organizationName', 'shortName',
        'province', 'district', 'municipality', 'address',
        'phone', 'mobile', 'email', 'website',
        'pan', 'registrationNo', 'registrationDate', 'fiscalYear',
        'logoUrl', 'faviconUrl', 'themeColor',
        'timezone', 'locale', 'currencyCode', 'dateFormat',
      ];
      const payload: Record<string, any> = {};
      for (const k of ALLOWED) {
        if (k in req.body) payload[k] = req.body[k];
      }
      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ error: 'No updatable fields provided.' });
      }

      // Snapshot the current profile so the audit log can capture the diff.
      const before = await authService.getOrganizationDetail(organizationId);

      const organization = await authService.updateOrganization(organizationId, payload);

      // Audit trail — org profile changes have accounting/compliance weight.
      const changed = computeDiff(
        before ? pickOrgAuditFields(before) : {},
        pickOrgAuditFields(organization),
      );
      if (Object.keys(changed).length > 0) {
        await writeAuditLog(buildAuditRow(
          {
            organizationId,
            userId: req.user?.userId,
            username: req.user?.username,
            role: req.user?.role,
            ipAddress: req.ip || req.socket?.remoteAddress,
            userAgent: req.headers['user-agent'],
          },
          'Organization Setup',
          'Update Org Profile',
          JSON.stringify(changed),
          splitDiffIntoSnapshots(changed),
        ));
      }

      res.json({ organization });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // POST /api/v1/org/users — HR creates user
  // ============================================
  static async createOrgUser(req: any, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(400).json({ error: 'Organization context missing.' });

      const user = await authService.createOrgUser({ ...req.body, organizationId });
      res.status(201).json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getOrgUsers(req: any, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(400).json({ error: 'Organization context missing.' });
      const users = await authService.getOrgUsers(organizationId);
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateOrgUser(req: any, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(400).json({ error: 'Organization context missing.' });
      const user = await authService.updateOrgUser(req.params.id, req.body, organizationId);
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ============================================
  // POST /api/v1/org/users/:id/unlock
  // POST /api/v1/org/users/:id/force-reset
  // ============================================
  static async unlockUser(req: any, res: Response) {
    try {
      await authService.unlockUser(req.params.id, req.user?.organizationId);
      res.json({ message: 'User account unlocked.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async forcePasswordReset(req: any, res: Response) {
    try {
      const { temporaryPassword } = req.body;
      if (!temporaryPassword) return res.status(400).json({ error: 'temporaryPassword is required.' });
      await authService.forcePasswordReset(req.params.id, temporaryPassword, req.user?.organizationId);
      res.json({ message: 'Temporary password set. User must change on next login.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ============================================
  // POST /api/v1/org/users/:id/lock
  // POST /api/v1/org/users/:id/activate
  // POST /api/v1/org/users/:id/deactivate
  // POST /api/v1/org/users/:id/reset-password
  // POST /api/v1/org/users/:id/resend-welcome
  // POST /api/v1/org/users/:id/terminate-sessions
  // ============================================
  static async lockUser(req: any, res: Response) {
    try {
      await authService.lockUser(req.params.id, req.user?.organizationId);
      res.json({ message: 'User account locked.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async activateUser(req: any, res: Response) {
    try {
      await authService.activateUser(req.params.id, req.user?.organizationId);
      res.json({ message: 'User account activated.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async deactivateUser(req: any, res: Response) {
    try {
      await authService.deactivateUser(req.params.id, req.user?.organizationId);
      res.json({ message: 'User account deactivated.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async resetUserPassword(req: any, res: Response) {
    try {
      const { temporaryPassword } = await authService.resetUserPassword(req.params.id, req.user?.organizationId);
      res.json({ message: 'Password reset and welcome email sent.', temporaryPassword });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async resendWelcome(req: any, res: Response) {
    try {
      const { temporaryPassword } = await authService.resendWelcomeEmail(req.params.id, req.user?.organizationId);
      res.json({ message: 'Welcome email resent.', temporaryPassword });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async terminateSessions(req: any, res: Response) {
    try {
      await authService.terminateSessions(req.params.id, req.user?.organizationId);
      res.json({ message: 'All active sessions terminated.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ============================================
  // POST /api/v1/auth/change-password
  // Called when user completes first-login forced password change
  // ============================================
  static async changePassword(req: any, res: Response) {
    try {
      const userId = req.user?.userId;
      const organizationId = req.user?.organizationId;
      const organizationCode = req.user?.organizationCode;
      const username = req.user?.username;
      const authUserId = req.user?.sub || req.user?.authUserId;

      if (!userId || !authUserId) {
        return res.status(401).json({ error: 'Not authenticated.' });
      }

      const { newPassword, confirmPassword } = req.body;
      if (!newPassword) return res.status(400).json({ error: 'newPassword is required.' });
      if (newPassword !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' });

      // Enforce the org's configured password policy (SETUPS → Admin →
      // Security), not a hardcoded rule set. Falls back to the previous
      // hardcoded defaults when a tenant has no policy row.
      const policy = await authService.getPasswordPolicy(organizationId);
      const violations = AuthService.validatePassword(newPassword, policy);
      if (violations.length > 0) {
        return res.status(400).json({ error: violations.join(' '), violations });
      }

      const result = await authService.completeFirstPasswordChange(
        userId, organizationId, organizationCode, username, newPassword, authUserId
      );
      // GoTrue revokes the previous session on password change, so re-issue a fresh
      // session here; the client swaps in the new token instead of getting logged out.
      if (result) {
        return res.json({
          message: 'Password changed successfully. You can now access the dashboard.',
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
        });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ============================================
  // GET /api/v1/auth/security-questions
  // Catalogue for the Security Setup Wizard: global questions plus any the
  // organization has added.
  // ============================================
  static async getSecurityQuestions(req: any, res: Response) {
    try {
      const questions = await authService.getSecurityQuestions(req.user?.organizationId);
      res.json({ questions, minAnswers: MIN_SECURITY_ANSWERS });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // POST /api/v1/auth/security-setup/complete
  // Called when user finishes the Security Setup Wizard
  // Body: { mobileNumber, answers: [{ questionId, answer }, …] }
  // ============================================
  static async completeSecuritySetup(req: any, res: Response) {
    try {
      const userId = req.user?.userId;
      const organizationId = req.user?.organizationId;
      const organizationCode = req.user?.organizationCode;
      const username = req.user?.username;

      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated.' });
      }

      const { mobileNumber, answers } = req.body ?? {};

      // Normalise and validate the answer set before anything is written, so a
      // bad payload can never mark the questions step complete.
      let securityAnswers: { questionId: string; answer: string }[] | undefined;
      if (answers !== undefined) {
        if (!Array.isArray(answers)) {
          return res.status(400).json({ error: 'answers must be an array of { questionId, answer }.' });
        }
        securityAnswers = answers.map((a: any) => ({
          questionId: String(a?.questionId ?? ''),
          answer: String(a?.answer ?? ''),
        }));
        if (securityAnswers.some(a => !a.questionId || a.answer.trim().length < 3)) {
          return res.status(400).json({ error: 'Every security answer requires a question and at least 3 characters.' });
        }
        if (securityAnswers.length < MIN_SECURITY_ANSWERS) {
          return res.status(400).json({ error: `At least ${MIN_SECURITY_ANSWERS} security questions must be answered.` });
        }
      }

      const result = await authService.completeSecuritySetup(
        userId, organizationId, organizationCode, username,
        typeof mobileNumber === 'string' && mobileNumber ? mobileNumber : undefined,
        securityAnswers,
      );
      res.json({
        success: true,
        securitySetupCompleted: true,
        securityQuestionsCompleted: result.user.securityQuestionsCompleted,
        user: result.user,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ============================================
  // GET /api/v1/auth/session-policy
  // The one slice of the security policy every authenticated user needs,
  // regardless of role: how long they may sit idle. The full policy endpoint
  // below is org_admin/manager only, but the idle timeout has to apply to
  // tellers too, so it is exposed separately and carries nothing sensitive.
  // ============================================
  static async getSessionPolicy(req: any, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      // Degrade to the default rather than erroring — a failed lookup here must
      // never be able to block someone from using the application.
      let sessionTimeoutMinutes = 15;
      if (organizationId) {
        const row = await authService.getSecuritySettings(organizationId);
        if (row && typeof row.sessionTimeoutMinutes === 'number') {
          sessionTimeoutMinutes = row.sessionTimeoutMinutes;
        }
      }
      res.json({ sessionTimeoutMinutes });
    } catch {
      res.json({ sessionTimeoutMinutes: 15 });
    }
  }

  // ============================================
  // GET /api/v1/org/security-settings
  // PUT /api/v1/org/security-settings
  // Org-wide security policy (SETUPS → Admin → Security).
  // ============================================
  static async getSecuritySettings(req: any, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(400).json({ error: 'Organization context missing.' });

      const row = await authService.getSecuritySettings(organizationId);
      // No row yet = never configured. Return the effective defaults rather than
      // 404 so the form has something coherent to render, and say which it is.
      res.json({
        settings: row ?? { organizationId, ...DEFAULT_PASSWORD_POLICY, sessionTimeoutMinutes: 15, enforce2fa: false, ipWhitelist: null, ipWhitelistEnabled: false },
        configured: !!row,
        /**
         * Which fields this server actually acts on. The UI reads this instead
         * of assuming, so a field can never silently look enforced when it
         * isn't. See migration 0045 for why 2FA and IP allow-listing are not.
         */
        enforcement: {
          passwordPolicy: true,
          passwordExpiry: true,
          sessionTimeout: true,
          enforce2fa: false,
          ipWhitelist: false,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateSecuritySettings(req: any, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(400).json({ error: 'Organization context missing.' });

      const before = await authService.getSecuritySettings(organizationId);

      const ALLOWED = [
        'minPasswordLength', 'requireSpecialChar', 'requireNumber',
        'requireUppercase', 'requireLowercase', 'passwordExpiryDays',
        'sessionTimeoutMinutes', 'enforce2fa', 'ipWhitelist', 'ipWhitelistEnabled',
      ];
      const payload: Record<string, any> = {};
      for (const k of ALLOWED) {
        if (k in req.body) payload[k] = req.body[k];
      }
      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ error: 'No updatable fields provided.' });
      }

      const settings = await authService.updateSecuritySettings(organizationId, payload, req.user?.userId);

      // Security-policy changes are audit-relevant on their own terms.
      const changed = computeDiff(before ?? {}, settings as Record<string, any>);
      delete changed.updatedAt;
      delete changed.updatedBy;
      if (Object.keys(changed).length > 0) {
        await writeAuditLog(buildAuditRow(
          {
            organizationId,
            userId: req.user?.userId,
            username: req.user?.username,
            role: req.user?.role,
            ipAddress: req.ip || req.socket?.remoteAddress,
            userAgent: req.headers['user-agent'],
          },
          'Security Setup',
          before ? 'Update Security Policy' : 'Create Security Policy',
          JSON.stringify(changed),
          splitDiffIntoSnapshots(changed),
        ));
      }

      res.json({ settings, configured: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // POST /api/v1/org/switch-branch (org admin only)
  // Body: { branchId, password }
  // Password re-verified via Supabase; active branch persisted server-side.
  // ============================================
  static async switchBranch(req: any, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.userId;
      const organizationCode = req.user?.organizationCode;
      const username = req.user?.username;
      const authUserId = req.user?.sub || req.user?.authUserId;

      if (!organizationId || !userId) {
        return res.status(401).json({ error: 'Not authenticated.' });
      }
      if (req.user?.role !== 'org_admin') {
        return res.status(403).json({ error: 'Only organization administrators can switch branches.' });
      }

      const { branchId, password } = req.body ?? {};
      if (!branchId) {
        return res.status(400).json({ error: 'branchId is required.' });
      }

      const ipAddress = req.ip || req.socket?.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.switchBranch({
        userId,
        organizationId,
        organizationCode,
        username,
        authUserId,
        branchId,
        password,
        ipAddress,
        userAgent,
      });
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

}

// ============================================
// Validation schemas (Zod)
// ============================================
/** Fields worth capturing in the audit diff for org-profile changes. */
const ORG_AUDIT_FIELDS = [
  'organizationName', 'shortName', 'address', 'phone', 'mobile', 'email',
  'website', 'pan', 'registrationNo', 'registrationDate', 'fiscalYear',
  'logoUrl', 'faviconUrl', 'themeColor', 'timezone', 'locale',
  'currencyCode', 'dateFormat', 'province', 'district', 'municipality', 'wardNo',
];

function pickOrgAuditFields(org: Record<string, any>): Record<string, any> {
  const picked: Record<string, any> = {};
  for (const key of ORG_AUDIT_FIELDS) {
    if (org?.[key] !== undefined) picked[key] = org[key];
  }
  return picked;
}

export { updateOrgProfileSchema };

export const loginSchema = z.object({
  body: z.object({
    organizationCode: z.string().min(1, 'Organization code is required').max(30),
    username: z.string().min(1, 'Username is required').max(100),
    password: z.string().min(1, 'Password is required'),
  })
});

export const superAdminLoginSchema = z.object({
  body: z.object({
    username: z.string().min(1, 'Username is required').max(100),
    password: z.string().min(1, 'Password is required'),
  })
});

export const createOrganizationSchema = z.object({
  body: z.object({
    organizationCode: z.string().regex(/^[A-Z]{4,12}$/, 'Must be 4-12 uppercase letters only'),
    organizationName: z.string().min(3),
    shortName: z.string().max(20).optional(),
    organizationType: z.string().max(50).optional(),
    slug: z.string().max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, or hyphens').optional(),
    province: z.string().optional(),
    district: z.string().optional(),
    municipality: z.string().optional(),
    provinceId: z.string().uuid().optional(),
    districtId: z.string().uuid().optional(),
    municipalityId: z.string().uuid().optional(),
    wardNo: z.number().int().min(1).max(99).optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    mobile: z.string().optional(),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
    pan: z.string().optional(),
    registrationNo: z.string().optional(),
    registrationDate: z.string().datetime().optional(),
    logoUrl: z.string().optional(),
    faviconUrl: z.string().optional(),
    themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color').optional(),
    timezone: z.string().max(100).optional(),
    locale: z.string().max(10).optional(),
    currencyCode: z.string().max(10).optional(),
    dateFormat: z.string().max(20).optional(),
    fiscalYear: z.string().max(20).optional(),
    subscriptionPlan: z.string().max(50).optional(),
    storageLimitMb: z.number().int().min(0).optional(),
    storageUsedMb: z.number().int().min(0).optional(),
    aiCredit: z.number().int().min(0).optional(),
    maxMembers: z.number().int().min(1).optional(),
    maxUsers: z.number().int().min(1).optional(),
    maxBranches: z.number().int().min(1).optional(),
    isMultiBranch: z.boolean().optional(),
    aiEnabled: z.boolean().optional(),
  })
});

// ============================================
// PUT /api/v1/user/profile — update own profile (name, avatar)
// ============================================
export const updateMyProfileSchema = z.object({
  fullName: z.string().min(1).max(150).optional(),
  avatarUrl: z.string().max(2000).optional(),
});

export class MyProfileController {
  static async updateMyProfile(req: any, res: Response) {
    try {
      const userId = req.user?.userId;
      const organizationId = req.user?.organizationId;
      if (!userId || !organizationId) {
        return res.status(400).json({ error: 'Authentication context missing.' });
      }

      const { fullName, avatarUrl } = req.body;
      const db = (await import('../../db/client')).getDb();
      if (!db) return res.status(500).json({ error: 'Database not connected.' });

      const { orgUsers, employees } = await import('../../db/schema/auth');
      const { eq, and } = await import('drizzle-orm');

      // Update avatar on org_users
      if (avatarUrl !== undefined) {
        await db.update(orgUsers)
          .set({ avatarUrl: avatarUrl || null, updatedAt: new Date() })
          .where(and(eq(orgUsers.id, userId), eq(orgUsers.organizationId, organizationId)));
      }

      // Update name on the linked employee record (first_name = fullName)
      if (fullName !== undefined) {
        const [row] = await db.select({ employeeId: orgUsers.employeeId })
          .from(orgUsers)
          .where(and(eq(orgUsers.id, userId), eq(orgUsers.organizationId, organizationId)))
          .limit(1);

        if (row?.employeeId) {
          await db.update(employees)
            .set({ firstName: fullName.trim(), updatedAt: new Date() })
            .where(eq(employees.id, row.employeeId));
        }
      }

      res.json({ success: true, fullName, avatarUrl });
    } catch (error: any) {
      console.error('MyProfileController.updateMyProfile:', error);
      res.status(500).json({ error: error.message || 'Failed to update profile.' });
    }
  }

  // ============================================
  // POST /api/v1/auth/verify-password
  // Simple password check for role switching.
  // Requires valid auth token (user is already logged in).
  // Body: { password }
  // Returns: { valid: true } or 401
  // ============================================
  static async verifyPassword(req: any, res: Response) {
    try {
      const organizationCode = req.user?.organizationCode;
      const username = req.user?.username;
      const { password } = req.body;

      if (!organizationCode || !username) {
        return res.status(401).json({ error: 'Not authenticated.' });
      }
      if (!password) {
        return res.status(400).json({ error: 'Password is required.' });
      }

      // Re-use the login flow to verify credentials (does not create a new session)
      const authUserId = req.user?.sub || req.user?.authUserId;
      if (!authUserId) {
        return res.status(401).json({ error: 'Not authenticated.' });
      }

      const syntheticEmail = `${username.replace(/@.*$/, '')}@${organizationCode}.auth.local`;
      const authRes = await supabaseClient.auth.signInWithPassword({
        email: syntheticEmail,
        password,
      });

      if (authRes.error || !authRes.data.session) {
        // Try real email fallback
        const user = await (authService as any).repo?.findUserByUsername?.(
          req.user?.organizationId, username
        );
        if (user?.email && user.email !== syntheticEmail) {
          const fallbackRes = await supabaseClient.auth.signInWithPassword({
            email: user.email,
            password,
          });
          if (fallbackRes.error || !fallbackRes.data.session) {
            return res.status(401).json({ error: 'Invalid password.' });
          }
        } else {
          return res.status(401).json({ error: 'Invalid password.' });
        }
      }

      res.json({ valid: true });
    } catch (error: any) {
      res.status(401).json({ error: 'Invalid password.' });
    }
  }
}
