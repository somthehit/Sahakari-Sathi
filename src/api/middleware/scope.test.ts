/**
 * Tenant-scope helper tests (Module 1).
 *
 * The "server is the source of truth for tenant scoping" rule lives in
 * src/api/middleware/scope.ts: organization_id/branch_id must come from the
 * verified JWT (req.user), never from client input. These tests pin that down
 * for the pure helpers and for assertBranchInOrg (which rejects a branch id
 * that does not belong to the caller's organization).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrgId, requireOrg, getActorName, getBranchScope, branchFilter, assertBranchInOrg, ScopeError } from './scope';
import { makeFakeDb } from '../test/fakeDb';

const holder = vi.hoisted(() => ({ db: null as any }));

vi.mock('../../db/client', () => ({
  getDb: () => holder.db,
  closeDb: () => {},
  checkDbHealth: () => false,
}));

const ORG_A = '11111111-1111-1111-1111-111111111111';
const ORG_B = '22222222-2222-2222-2222-222222222222';

function makeReq(user: any): any {
  return { user, headers: {}, ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } };
}

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

beforeEach(() => {
  holder.db = makeFakeDb();
});

describe('getOrgId', () => {
  it('derives the org id from the verified JWT', () => {
    expect(getOrgId(makeReq({ organizationId: ORG_A }))).toBe(ORG_A);
  });

  it('throws when there is no org context (e.g. super admin on an org route)', () => {
    expect(() => getOrgId(makeReq({ organizationId: '' }))).toThrow(ScopeError);
    expect(() => getOrgId(makeReq({}))).toThrow(ScopeError);
  });
});

describe('requireOrg', () => {
  it('returns the org id without touching the response when present', () => {
    const res = makeRes();
    expect(requireOrg(makeReq({ organizationId: ORG_A }), res)).toBe(ORG_A);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('answers 403 and returns null when org context is missing', () => {
    const res = makeRes();
    expect(requireOrg(makeReq({}), res)).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('getActorName', () => {
  it('prefers username, falls back to the user id', () => {
    expect(getActorName(makeReq({ username: 'ram', userId: 'u1' }))).toBe('ram');
    expect(getActorName(makeReq({ userId: 'u1' }))).toBe('u1');
    expect(getActorName(makeReq({}))).toBe('unknown');
  });
});

describe('getBranchScope / branchFilter', () => {
  it('gives org admins visibility across every branch', () => {
    const scope = getBranchScope(makeReq({ organizationId: ORG_A, role: 'org_admin', branchIds: ['b1', 'b2'] }));
    expect(scope.isOrgAdmin).toBe(true);
    expect(scope.organizationId).toBe(ORG_A);
    expect(branchFilter(makeReq({ organizationId: ORG_A, role: 'org_admin', branchIds: ['b1', 'b2'] }), 'col')).toBeUndefined();
  });

  it('scopes branch staff to their assigned branch list', () => {
    const scope = getBranchScope(makeReq({ organizationId: ORG_A, role: 'teller', branchId: 'b1', branchIds: ['b1'] }));
    expect(scope.isOrgAdmin).toBe(false);
    expect(scope.branchIds).toEqual(['b1']);
    const filter = branchFilter(makeReq({ organizationId: ORG_A, role: 'teller', branchId: 'b1', branchIds: ['b1'] }), 'col');
    expect(filter).toBeDefined();
  });
});

describe('assertBranchInOrg', () => {
  const BRANCH_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  it('accepts a branch that belongs to the caller’s organization', async () => {
    holder.db = makeFakeDb({ branches: [{ id: BRANCH_A, organizationId: ORG_A }] });
    await expect(assertBranchInOrg(ORG_A, BRANCH_A)).resolves.toBeUndefined();
  });

  it('rejects a branch that belongs to another organization', async () => {
    holder.db = makeFakeDb({ branches: [{ id: BRANCH_A, organizationId: ORG_B }] });
    await expect(assertBranchInOrg(ORG_A, BRANCH_A)).rejects.toThrow(ScopeError);
  });

  it('is a no-op when no branch id is supplied', async () => {
    await expect(assertBranchInOrg(ORG_A, undefined)).resolves.toBeUndefined();
    await expect(assertBranchInOrg(ORG_A, null)).resolves.toBeUndefined();
  });
});
