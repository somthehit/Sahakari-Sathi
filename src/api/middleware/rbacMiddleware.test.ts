/**
 * RBAC middleware tests for Module 1.
 *
 * The routes that write settings are gated server-side, e.g.:
 *   PUT  /org/profile             → requireRole(['org_admin'])
 *   PUT  /working-days            → requireRole(['org_admin', 'manager'])
 *   POST /fiscal-years            → requireRole(['org_admin', 'manager'])
 *   POST /branches                → requireRole(['org_admin', 'manager'])
 *   POST /branches/:id/deactivate → requireRole(['org_admin'])
 *   PUT  /org/financial-settings  → requireRole(['org_admin'])
 *   PATCH /org/localization-settings → requireRole(['org_admin'])
 *
 * Frontend-only guarding is NOT acceptable — these tests prove a crafted
 * request from a non-privileged role is rejected by the middleware, even
 * though the browser UI hides the controls.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { requireRole } from './rbacMiddleware';

function makeReq(role?: string): any {
  return { user: role ? { role } : undefined };
}

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

afterEach(() => {
  delete process.env.API_MODE;
});

describe('requireRole (server-side settings RBAC)', () => {
  it('allows org_admin to write org settings (PUT /org/profile)', () => {
    const req = makeReq('org_admin');
    const res = makeRes();
    const next = vi.fn();
    requireRole(['org_admin'])(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows manager to write manager-level settings (working days / fiscal years / branches)', () => {
    const req = makeReq('manager');
    const res = makeRes();
    const next = vi.fn();
    requireRole(['org_admin', 'manager'])(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects a non-admin role crafting an updateOrgProfile request directly', () => {
    const req = makeReq('teller');
    const res = makeRes();
    const next = vi.fn();
    requireRole(['org_admin'])(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].error).toContain('Forbidden');
  });

  it('rejects manager from deactivating branches (org_admin only)', () => {
    const req = makeReq('manager');
    const res = makeRes();
    const next = vi.fn();
    requireRole(['org_admin'])(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects a request with no authenticated user', () => {
    const req = makeReq(undefined);
    const res = makeRes();
    const next = vi.fn();
    requireRole(['org_admin'])(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('honours the super-admin override', () => {
    const req = makeReq('admin');
    const res = makeRes();
    const next = vi.fn();
    requireRole(['org_admin'])(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('bypasses role checks in mock/prototype mode (API_MODE=false)', () => {
    process.env.API_MODE = 'false';
    const req = makeReq('teller');
    const res = makeRes();
    const next = vi.fn();
    requireRole(['org_admin'])(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
