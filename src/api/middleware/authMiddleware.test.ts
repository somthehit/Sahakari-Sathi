/**
 * authMiddleware role-derivation tests.
 *
 * `roles.name` is free-form tenant input (varchar(100), unique per org only), and
 * an org admin can create roles via POST /roles. toRoleCode() must therefore never
 * let a role name resolve to a privileged code, or an organization could mint a
 * platform super admin — which clears requireRole(['super_admin']) on every
 * /super-admin/* route (all organizations, platform users, audit logs).
 */
import { describe, it, expect } from 'vitest';
import { toRoleCode } from './authMiddleware';
import { requireRole } from './rbacMiddleware';

/** Runs the real guard and reports whether the request was allowed through. */
function passesGuard(roleName: string, allowedRoles: string[]): boolean {
  const req: any = { user: { role: toRoleCode(roleName) } };
  const res: any = { status: () => res, json: () => res };
  let allowed = false;
  requireRole(allowedRoles)(req, res, () => { allowed = true; });
  return allowed;
}

describe('toRoleCode (display name → canonical role code)', () => {
  it('maps the seeded default admin role name', () => {
    expect(toRoleCode('Organization Administrator')).toBe('org_admin');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(toRoleCode('  TELLER  ')).toBe('teller');
    expect(toRoleCode('Branch Manager')).toBe('manager');
  });

  it('passes unmapped custom role names through (they match no route guard)', () => {
    expect(toRoleCode('Recovery Officer')).toBe('recovery officer');
    expect(passesGuard('Recovery Officer', ['org_admin'])).toBe(false);
  });

  it('never resolves a tenant role name to the platform super_admin code', () => {
    for (const name of ['super_admin', 'Super_Admin', 'SUPER_ADMIN', '  super_admin  ']) {
      expect(toRoleCode(name)).not.toBe('super_admin');
    }
  });

  it('never resolves a tenant role name to the requireRole blanket override', () => {
    expect(toRoleCode('admin')).not.toBe('admin');
    expect(toRoleCode('ADMIN')).not.toBe('admin');
  });

  it('drops reserved names to least privilege rather than failing open', () => {
    expect(toRoleCode('super_admin')).toBe('viewer');
  });

  it('keeps "Super Admin" as an org-level display name', () => {
    // The spaced form is an intentional ROLE_CODE_MAP entry: an org-level role
    // label, not the platform identity.
    expect(toRoleCode('Super Admin')).toBe('org_admin');
  });
});

describe('privilege escalation via role naming', () => {
  it('does not let a role named super_admin reach /super-admin/* routes', () => {
    expect(passesGuard('super_admin', ['super_admin'])).toBe(false);
  });

  it('still admits a genuine platform super admin', () => {
    // verifyToken sets this code directly for rows in the super_admins table;
    // it is never derived from a roles.name.
    const req: any = { user: { role: 'super_admin' } };
    const res: any = { status: () => res, json: () => res };
    let allowed = false;
    requireRole(['super_admin'])(req, res, () => { allowed = true; });
    expect(allowed).toBe(true);
  });
});
