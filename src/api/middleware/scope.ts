/**
 * Tenant Scope Helpers
 * Centralizes how a request's tenant context is derived from the verified JWT
 * (req.user) and how branch references coming from the request body/query/params
 * are validated against the caller's organization.
 *
 * Controllers MUST derive organizationId/branchId through these helpers instead
 * of trusting values sent by the client. Super admins carry an empty
 * organizationId and are not permitted on org-scoped tenant endpoints.
 */
import { and, eq, inArray, type SQL } from 'drizzle-orm';
import type { Response } from 'express';
import { getDb } from '../../db/client';
import { branches } from '../../db/schema';
import type { AuthRequest } from './authMiddleware';

export class ScopeError extends Error {}

/** Derive the caller's organizationId from the verified JWT. Throws if absent. */
export function getOrgId(req: AuthRequest): string {
  const orgId = req.user?.organizationId;
  if (!orgId) throw new ScopeError('No organization context available.');
  return orgId;
}

/** Express-safe variant: respond 403 and return null when org context is missing. */
export function requireOrg(req: AuthRequest, res: Response): string | null {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(403).json({ error: 'No organization context available.' });
    return null;
  }
  return orgId;
}

/** Actor name for audit/mutation fields; falls back to the user id. */
export function getActorName(req: AuthRequest): string {
  return req.user?.username || req.user?.userId || 'unknown';
}

/** Branch access context derived from the verified server-side user (never client input). */
export interface BranchScope {
  organizationId: string;
  /** The user's assigned branch (single-branch staff). */
  branchId?: string;
  /** Branch ids the user is allowed to operate within. */
  branchIds: string[];
  /** Current branch context (posting default). */
  activeBranchId?: string;
  /** Org admins see all branches of the org; others are strictly branch-scoped. */
  isOrgAdmin: boolean;
}

/** Derive branch scope from the authenticated user. Throws if org context is absent. */
export function getBranchScope(req: AuthRequest): BranchScope {
  const organizationId = getOrgId(req);
  return {
    organizationId,
    branchId: req.user?.branchId,
    branchIds: req.user?.branchIds ?? [],
    activeBranchId: req.user?.activeBranchId,
    isOrgAdmin: req.user?.role === 'org_admin',
  };
}

/**
 * Where-condition for branch-scoped reads.
 * Org admins pass `undefined` (see every branch). Branch users get an
 * `IN (branchIds)` clause — an empty set yields no rows, so an unassigned
 * staff member leaks nothing.
 */
export function branchFilter(req: AuthRequest, column: SQL | any): SQL | undefined {
  const scope = getBranchScope(req);
  if (scope.isOrgAdmin) return undefined;
  return inArray(column, scope.branchIds);
}

/**
 * Resolve the branch to stamp on a branch-scoped create.
 * Branch staff are FORCED onto their assigned branch (client value ignored).
 * Org admins may pass an explicit branch within the org, defaulting to the
 * active branch context. Super admins must not hit org endpoints.
 */
export async function resolveBranchForCreate(
  req: AuthRequest,
  clientBranchId?: string | null
): Promise<string> {
  const scope = getBranchScope(req);
  if (!scope.isOrgAdmin) {
    if (!scope.branchId) throw new ScopeError('No branch assigned to this user.');
    return scope.branchId;
  }
  const target = clientBranchId || scope.activeBranchId;
  if (!target) throw new ScopeError('No active branch context available.');
  await assertBranchInOrg(scope.organizationId, target);
  return target;
}

/**
 * Assert that a branchId (from body/query/params) belongs to the caller's
 * organization. Pass undefined/null to skip (org-scoped fallbacks apply).
 */
export async function assertBranchInOrg(
  organizationId: string,
  branchId?: string | null
): Promise<void> {
  if (!branchId) return;
  const db = getDb();
  if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.organizationId, organizationId)))
    .limit(1);
  if (!branch) throw new ScopeError('Branch does not belong to this organization.');
}
