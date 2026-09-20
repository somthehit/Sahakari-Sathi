/**
 * Auth Middleware
 * Verifies Supabase JWT
 * Attaches decoded user payload to req.user for downstream route handlers.
 */
import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { AuthRepository } from '../repositories/AuthRepository';

export interface AuthenticatedUser {
  uid: string;
  authUserId: string;
  organizationId: string;
  organizationCode: string;
  userId: string;
  username?: string;
  role: string;
  /** The user's assigned branch (single-branch staff). Org admins may also have one set. */
  branchId?: string;
  /** Branch ids the user is permitted to operate within. Org admins get every branch in the org. */
  branchIds?: string[];
  /** Current branch context used as the default for branch-scoped operations. */
  activeBranchId?: string;
  /** True for organization administrators — they can see all branches of the org. */
  isOrgAdmin?: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

// Maps DB role display names (roles table) to the canonical role codes the
// route guards (requireRole) and the frontend expect. Keys are lowercased so
// lookup is case-insensitive, and includes the default role the system seeds
// when an organization is created ("Organization Administrator").
const ROLE_CODE_MAP: Record<string, string> = {
  'super admin': 'org_admin',
  'organization administrator': 'org_admin',
  'administrator': 'org_admin',
  'admin': 'org_admin',
  'branch manager': 'manager',
  'manager': 'manager',
  'teller': 'teller',
  'cashier': 'cashier',
  'loan officer': 'loan_officer',
  'accountant': 'accountant',
  'member service': 'member_service',
  'collection agent': 'collection_agent',
};

// Role codes that grant authority outside the caller's own organization, or that
// act as a blanket override inside requireRole(). A tenant-defined roles.name must
// never resolve to one of these: role names are free-form text an org admin picks,
// so the fall-through below would otherwise let an organization mint a platform
// super admin just by naming a custom role "super_admin". 'super_admin' is issued
// only by the platform super-admin branch of verifyToken.
const RESERVED_ROLE_CODES = new Set(['super_admin', 'admin']);

export function toRoleCode(roleName: string): string {
  const key = (roleName || '').trim().toLowerCase();
  const mapped = ROLE_CODE_MAP[key];
  if (mapped) return mapped;
  // Unmapped names pass through unchanged — they match no route guard, so they
  // fail closed. Reserved codes are the exception and drop to least privilege.
  return RESERVED_ROLE_CODES.has(key) ? 'viewer' : key;
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Development bypass when API_MODE=false
  if (process.env.API_MODE === 'false') {
    req.user = {
      uid: 'mock-supabase-uid',
      authUserId: '00000000-0000-0000-0000-000000000001',
      role: 'org_admin',
      organizationId: process.env.DEV_ORG_ID || 'mock-org-id',
      organizationCode: process.env.DEV_ORG_CODE || 'SOFTLAB',
      userId: process.env.DEV_USER_ID || 'mock-user-id',
      username: 'admin',
      branchIds: [],
      activeBranchId: process.env.DEV_BRANCH_ID || '',
      isOrgAdmin: true,
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    // Verify the JWT with Supabase Admin Auth
    const { data, error } = await supabaseAdmin.auth.getUser(idToken);
    
    if (error || !data.user) {
      throw new Error('Invalid token');
    }

    const authUid = data.user.id;
    
    // Look up the user in the database to get custom claims (org, role)
    const repo = new AuthRepository();
    // 1. Org user (multi-tenant portal)
    const dbUser = await repo.findUserByAuthId(authUid);
    if (dbUser) {
      const role = toRoleCode(dbUser.roleName || 'viewer');
      const isOrgAdmin = role === 'org_admin';
      let branchIds: string[] = [];
      let activeBranchId = dbUser.activeBranchId || dbUser.branchId || undefined;

      if (isOrgAdmin) {
        // Org admins may operate across every branch of the org.
        branchIds = await repo.getOrgBranchIds(dbUser.organizationId);
        if (!activeBranchId) activeBranchId = branchIds[0] || undefined;
      } else if (dbUser.branchId) {
        // Branch-scoped staff can only operate within their assigned branch.
        branchIds = [dbUser.branchId];
        activeBranchId = dbUser.branchId;
      }

      req.user = {
        uid: authUid,
        authUserId: authUid,
        organizationId: dbUser.organizationId,
        organizationCode: dbUser.organizationCode,
        userId: dbUser.id,
        username: dbUser.username,
        role,
        branchId: dbUser.branchId || undefined,
        branchIds,
        activeBranchId,
        isOrgAdmin,
      };
      return next();
    }

    // 2. Super Admin (platform-level, no org context)
    const superAdmin = await repo.findSuperAdminByAuthId(authUid);
    if (superAdmin) {
      req.user = {
        uid: authUid,
        authUserId: authUid,
        organizationId: '',
        organizationCode: '',
        userId: superAdmin.id,
        username: superAdmin.username,
        role: 'super_admin',
        branchIds: [],
        activeBranchId: undefined,
        isOrgAdmin: false,
      };
      return next();
    }

    return res.status(401).json({ error: 'Unauthorized: User record not found' });
  } catch (error: any) {
    if (error.message?.includes('expired')) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
