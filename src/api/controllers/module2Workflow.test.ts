/**
 * Module 2 (Workflow & Approvals) — tenant-scoping, RBAC-boundary and audit tests.
 *
 * Exercises the approval-level / approval-matrix / approval-request controllers
 * and the role approval-limits service with the fake in-memory DB (see
 * ../test/fakeDb.ts). Proves:
 *  1. organization_id always comes from the verified JWT, never the body.
 *  2. Every read/write is scoped by organization_id (cross-tenant rows leak
 *     into the fake if not → assertions below fail).
 *  3. Cross-tenant reads/writes by id are rejected with 403/404, never applied.
 *  4. Config writes and approval decisions emit an audit row for the acting org.
 *  5. Role approval limits are scoped to (role, organization) and audited.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeDb, type FakeScenario } from '../test/fakeDb';
import { ApprovalLevelController } from './ApprovalLevelController';
import { ApprovalMatrixController } from './ApprovalMatrixController';
import { ApprovalRequestController } from './ApprovalRequestController';
import { RoleService } from '../services/RoleService';

const holder = vi.hoisted(() => ({ db: null as any }));

vi.mock('../../db/client', () => ({
  getDb: () => holder.db,
  closeDb: () => {},
  checkDbHealth: () => false,
}));

const ORG_A = '11111111-1111-1111-1111-111111111111';
const ORG_B = '22222222-2222-2222-2222-222222222222';

function makeReq(user: any, overrides: any = {}) {
  return {
    user,
    params: {},
    body: {},
    query: {},
    headers: {},
    ip: '203.0.113.7',
    socket: { remoteAddress: '203.0.113.7' },
    ...overrides,
  };
}

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

function adminUser(org: string, role = 'org_admin') {
  return { organizationId: org, userId: 'u-1', username: 'admin', role, branchIds: [], activeBranchId: '' };
}

function whereQueries(fake: ReturnType<typeof makeFakeDb>, table: string) {
  return fake.recordedWheres.filter((w) => w.table === table);
}

beforeEach(() => {
  holder.db = makeFakeDb();
});

// ===========================================================================
// ApprovalLevelController
// ===========================================================================
describe('ApprovalLevelController tenant scoping', () => {
  const lvlA = { id: 'lvl-a', organizationId: ORG_A, levelNo: 1, roleKey: 'loan_officer', roleLabel: 'Loan Officer / Accountant', minAmount: '0', maxAmount: '100000', scope: 'Branch Operations', active: true, createdAt: new Date(), updatedAt: new Date() };
  const lvlA2 = { ...lvlA, id: 'lvl-a2', levelNo: 2, roleKey: 'branch_manager', roleLabel: 'Branch Manager', minAmount: '100001', maxAmount: '500000' };
  const lvlB = { ...lvlA, id: 'lvl-b', organizationId: ORG_B, roleLabel: 'Hacker' };

  it('lists only the JWT org’s levels, ordered by level number', async () => {
    holder.db = makeFakeDb({ approvalLevels: [lvlA, lvlA2, lvlB] });
    const res = makeRes();
    await ApprovalLevelController.getLevels(makeReq(adminUser(ORG_A)), res);

    const rows = res.json.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows.every((r: any) => r.organizationId === ORG_A)).toBe(true);
    const wheres = whereQueries(holder.db, 'approvalLevels');
    expect(wheres.some((w) => w.sql.includes('organization_id') && w.params.includes(ORG_A))).toBe(true);
  });

  it('returns 404 for another org’s level by id (no leak)', async () => {
    holder.db = makeFakeDb({ approvalLevels: [lvlB] });
    const res = makeRes();
    await ApprovalLevelController.getLevel(makeReq(adminUser(ORG_A), { params: { id: 'lvl-b' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].error).toBe('Approval level not found');
  });

  it('rejects editing another org’s level with 403', async () => {
    holder.db = makeFakeDb({ approvalLevels: [lvlB] });
    const res = makeRes();
    await ApprovalLevelController.updateLevel(
      makeReq(adminUser(ORG_A), { params: { id: 'lvl-b' }, body: { roleLabel: 'Hacked' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects deleting another org’s level and leaves the row intact', async () => {
    holder.db = makeFakeDb({ approvalLevels: [lvlB] });
    const res = makeRes();
    await ApprovalLevelController.deleteLevel(makeReq(adminUser(ORG_A), { params: { id: 'lvl-b' } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(holder.db.state.approvalLevels).toHaveLength(1);
  });

  it('stamps the JWT org on create, ignoring a smuggled organizationId, and audits', async () => {
    holder.db = makeFakeDb({ approvalLevels: [] });
    const res = makeRes();
    await ApprovalLevelController.createLevel(
      makeReq(adminUser(ORG_A), {
        body: { levelNo: 1, roleKey: 'branch_manager', roleLabel: 'Branch Manager', minAmount: 0, maxAmount: 500000, scope: 'Branch', organizationId: ORG_B },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = holder.db.state.approvalLevels[0];
    expect(created.organizationId).toBe(ORG_A);
    expect(holder.db.state.approvalLevels.some((r: any) => r.organizationId === ORG_B)).toBe(false);
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Create Approval Level' && a.organizationId === ORG_A)).toBe(true);
  });

  it('rejects a duplicate level number within the org (409)', async () => {
    holder.db = makeFakeDb({ approvalLevels: [lvlA] });
    const res = makeRes();
    await ApprovalLevelController.createLevel(
      makeReq(adminUser(ORG_A), { body: { levelNo: 1, roleKey: 'x', roleLabel: 'X', minAmount: 0 } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(holder.db.state.approvalLevels).toHaveLength(1);
  });

  it('updates an own-org level and writes an audit row', async () => {
    holder.db = makeFakeDb({ approvalLevels: [lvlA] });
    const res = makeRes();
    await ApprovalLevelController.updateLevel(
      makeReq(adminUser(ORG_A), { params: { id: 'lvl-a' }, body: { roleLabel: 'Senior Loan Officer', minAmount: 1000 } }),
      res,
    );
    expect(res.status).not.toHaveBeenCalledWith(404);
    expect(holder.db.state.approvalLevels[0].roleLabel).toBe('Senior Loan Officer');
    expect(holder.db.state.approvalLevels[0].minAmount).toBe('1000');
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Update Approval Level' && a.organizationId === ORG_A)).toBe(true);
  });

  it('deletes an own-org level and writes an audit row', async () => {
    holder.db = makeFakeDb({ approvalLevels: [lvlA] });
    const res = makeRes();
    await ApprovalLevelController.deleteLevel(makeReq(adminUser(ORG_A), { params: { id: 'lvl-a' } }), res);
    expect(holder.db.state.approvalLevels).toHaveLength(0);
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Delete Approval Level' && a.organizationId === ORG_A)).toBe(true);
  });
});

// ===========================================================================
// ApprovalMatrixController
// ===========================================================================
describe('ApprovalMatrixController tenant scoping', () => {
  const ruleA = { id: 'rule-a', organizationId: ORG_A, requestType: 'Loan_Approval' as const, thresholdMin: '100001', thresholdMax: '500000', signatory1Role: 'Loan Officer', signatory2Role: 'Branch Manager', smsNotify: true, active: true, description: '', createdAt: new Date(), updatedAt: new Date() };
  const ruleB = { ...ruleA, id: 'rule-b', organizationId: ORG_B };

  it('lists only the JWT org’s matrix rules', async () => {
    holder.db = makeFakeDb({ approvalMatrix: [ruleA, ruleB] });
    const res = makeRes();
    await ApprovalMatrixController.getMatrix(makeReq(adminUser(ORG_A)), res);
    const rows = res.json.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('rule-a');
    expect(whereQueries(holder.db, 'approvalMatrix').some((w) => w.sql.includes('organization_id') && w.params.includes(ORG_A))).toBe(true);
  });

  it('stamps the JWT org on create, ignoring a smuggled organizationId, and audits', async () => {
    holder.db = makeFakeDb({ approvalMatrix: [] });
    const res = makeRes();
    await ApprovalMatrixController.createRule(
      makeReq(adminUser(ORG_A), {
        body: { requestType: 'Expense_Claim', thresholdMin: 25000, signatory1Role: 'Accountant', signatory2Role: 'Branch Manager', organizationId: ORG_B },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = holder.db.state.approvalMatrix[0];
    expect(created.organizationId).toBe(ORG_A);
    expect(holder.db.state.approvalMatrix.some((r: any) => r.organizationId === ORG_B)).toBe(false);
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Create Approval Matrix Rule' && a.organizationId === ORG_A)).toBe(true);
  });

  it('rejects a duplicate (requestType, thresholdMin) rule within the org (409)', async () => {
    holder.db = makeFakeDb({ approvalMatrix: [ruleA] });
    const res = makeRes();
    await ApprovalMatrixController.createRule(
      makeReq(adminUser(ORG_A), { body: { requestType: 'Loan_Approval', thresholdMin: 100001, signatory1Role: 'X' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(holder.db.state.approvalMatrix).toHaveLength(1);
  });

  it('rejects updating another org’s rule with 403', async () => {
    holder.db = makeFakeDb({ approvalMatrix: [ruleB] });
    const res = makeRes();
    await ApprovalMatrixController.updateRule(
      makeReq(adminUser(ORG_A), { params: { id: 'rule-b' }, body: { signatory1Role: 'Hacked' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects deleting another org’s rule and leaves the row intact', async () => {
    holder.db = makeFakeDb({ approvalMatrix: [ruleB] });
    const res = makeRes();
    await ApprovalMatrixController.deleteRule(makeReq(adminUser(ORG_A), { params: { id: 'rule-b' } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(holder.db.state.approvalMatrix).toHaveLength(1);
  });

  it('updates an own-org rule and writes an audit row', async () => {
    holder.db = makeFakeDb({ approvalMatrix: [ruleA] });
    const res = makeRes();
    await ApprovalMatrixController.updateRule(
      makeReq(adminUser(ORG_A), { params: { id: 'rule-a' }, body: { smsNotify: false } }),
      res,
    );
    expect(holder.db.state.approvalMatrix[0].smsNotify).toBe(false);
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Update Approval Matrix Rule' && a.organizationId === ORG_A)).toBe(true);
  });

  it('deletes an own-org rule and writes an audit row', async () => {
    holder.db = makeFakeDb({ approvalMatrix: [ruleA] });
    const res = makeRes();
    await ApprovalMatrixController.deleteRule(makeReq(adminUser(ORG_A), { params: { id: 'rule-a' } }), res);
    expect(holder.db.state.approvalMatrix).toHaveLength(0);
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Delete Approval Matrix Rule' && a.organizationId === ORG_A)).toBe(true);
  });
});

// ===========================================================================
// ApprovalRequestController
// ===========================================================================
describe('ApprovalRequestController tenant scoping', () => {
  const makeReqA = () => ({ id: 'ap-a', organizationId: ORG_A, requestType: 'Loan_Approval' as const, referenceNo: 'AP-0001', requestedBy: 'u-1', requestedDateBs: '2082-01-15', amount: '250000', description: 'Loan for house repair', branchId: 'br-a', status: 'Pending' as const, approvedBy: null, remarks: null, processedAt: null, createdAt: new Date() });
  const makeReqB = () => ({ ...makeReqA(), id: 'ap-b', organizationId: ORG_B, referenceNo: 'AP-0002' });

  it('lists only the JWT org’s approval requests, scoped by organization_id', async () => {
    holder.db = makeFakeDb({ approvalRequests: [makeReqA(), makeReqB()] });
    const res = makeRes();
    await ApprovalRequestController.getRequests(makeReq(adminUser(ORG_A)), res);
    const rows = res.json.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('ap-a');
    const wheres = whereQueries(holder.db, 'approvalRequests');
    expect(wheres.some((w) => w.sql.includes('organization_id') && w.params.includes(ORG_A))).toBe(true);
  });

  it('filters by status when ?status=Pending is passed', async () => {
    holder.db = makeFakeDb({ approvalRequests: [makeReqA(), { ...makeReqA(), id: 'ap-a2', status: 'Approved' }] });
    const res = makeRes();
    await ApprovalRequestController.getRequests(makeReq(adminUser(ORG_A), { query: { status: 'Pending' } }), res);
    const rows = res.json.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('Pending');
  });

  it('approves a pending own-org request, records sign-off and writes an audit row', async () => {
    holder.db = makeFakeDb({ approvalRequests: [makeReqA()] });
    const res = makeRes();
    await ApprovalRequestController.decision(
      makeReq(adminUser(ORG_A), { params: { id: 'ap-a' }, body: { status: 'Approved', remarks: 'OK' } }),
      res,
    );
    expect(res.status).not.toHaveBeenCalledWith(404);
    const row = holder.db.state.approvalRequests[0];
    expect(row.status).toBe('Approved');
    expect(row.approvedBy).toBe('admin');
    expect(row.remarks).toBe('OK');
    expect(row.processedAt).toBeTruthy();
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Approved Approval Request' && a.organizationId === ORG_A && a.details.includes('AP-0001'))).toBe(true);
  });

  it('rejects a decision on another org’s request with 404 (no leak)', async () => {
    holder.db = makeFakeDb({ approvalRequests: [makeReqB()] });
    const res = makeRes();
    await ApprovalRequestController.decision(
      makeReq(adminUser(ORG_A), { params: { id: 'ap-b' }, body: { status: 'Approved' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(holder.db.state.approvalRequests[0].status).toBe('Pending');
  });

  it('returns 409 when the request was already processed', async () => {
    holder.db = makeFakeDb({ approvalRequests: [{ ...makeReqA(), status: 'Approved', approvedBy: 'someone' }] });
    const res = makeRes();
    await ApprovalRequestController.decision(
      makeReq(adminUser(ORG_A), { params: { id: 'ap-a' }, body: { status: 'Rejected' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toContain('already processed');
    expect(holder.db.state.approvalRequests[0].status).toBe('Approved');
  });

  it('rejects a pending own-org request and writes an audit row', async () => {
    holder.db = makeFakeDb({ approvalRequests: [makeReqA()] });
    const res = makeRes();
    await ApprovalRequestController.decision(
      makeReq(adminUser(ORG_A), { params: { id: 'ap-a' }, body: { status: 'Rejected', remarks: 'Docs incomplete' } }),
      res,
    );
    const row = holder.db.state.approvalRequests[0];
    expect(row.status).toBe('Rejected');
    expect(row.remarks).toBe('Docs incomplete');
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Rejected Approval Request' && a.organizationId === ORG_A)).toBe(true);
  });
});

// ===========================================================================
// Role approval limits (RoleService)
// ===========================================================================
describe('Role approval limits scoping & audit', () => {
  const roleA = { id: 'role-a', organizationId: ORG_A, code: 'MAN', name: 'Manager', permissions: '[]', isSystem: false, status: 'Active', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
  const roleB = { ...roleA, id: 'role-b', organizationId: ORG_B };

  const actor = (org: string) => ({ organizationId: org, userId: 'u-1', username: 'admin', role: 'org_admin', ipAddress: '203.0.113.7', userAgent: '' });

  it('replaces limits for an own-org role, scoped to that org, and audits', async () => {
    holder.db = makeFakeDb({ roles: [roleA] });
    const service = new RoleService();
    const result = await service.putApprovalLimits('role-a', [
      { moduleKey: 'loan_writeoff', min: 1000, max: 500000 },
      { moduleKey: 'voucher_posting', min: null, max: 25000 },
    ], actor(ORG_A));

    expect(holder.db.state.roleApprovalLimits).toHaveLength(2);
    expect(holder.db.state.roleApprovalLimits.every((r: any) => r.organizationId === ORG_A && r.roleId === 'role-a')).toBe(true);
    expect(holder.db.state.roleApprovalLimits.find((r: any) => r.moduleKey === 'loan_writeoff')?.minAmount).toBe('1000');
    expect(result).toHaveLength(2);
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Updated' && a.details.includes('approval limits') && a.organizationId === ORG_A)).toBe(true);
  });

  it('replaces the full set (stale rows are removed, not appended)', async () => {
    holder.db = makeFakeDb({
      roles: [roleA],
      roleApprovalLimits: [{ id: 'l1', organizationId: ORG_A, roleId: 'role-a', moduleKey: 'expense_claim', minAmount: '5', maxAmount: '10' }],
    });
    const service = new RoleService();
    await service.putApprovalLimits('role-a', [{ moduleKey: 'voucher_posting', min: 100, max: 200 }], actor(ORG_A));
    const remaining = holder.db.state.roleApprovalLimits;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].moduleKey).toBe('voucher_posting');
  });

  it('blocks cross-org access to another org’s role limits (404)', async () => {
    holder.db = makeFakeDb({ roles: [roleB], roleApprovalLimits: [{ id: 'l1', organizationId: ORG_B, roleId: 'role-b', moduleKey: 'loan_writeoff', minAmount: '1', maxAmount: '2' }] });
    const service = new RoleService();
    await expect(service.getApprovalLimits('role-b', actor(ORG_A))).rejects.toThrow(/Role not found/);
    await expect(
      service.putApprovalLimits('role-b', [{ moduleKey: 'loan_writeoff', min: 999, max: 999 }], actor(ORG_A)),
    ).rejects.toThrow(/Role not found/);
    // No cross-org row was created or modified.
    expect(holder.db.state.roleApprovalLimits[0].organizationId).toBe(ORG_B);
    expect(holder.db.state.roleApprovalLimits[0].minAmount).toBe('1');
  });

  it('returns only the requested role’s limits (other roles untouched)', async () => {
    holder.db = makeFakeDb({
      roles: [roleA, { ...roleA, id: 'role-other' }],
      roleApprovalLimits: [
        { id: 'l1', organizationId: ORG_A, roleId: 'role-a', moduleKey: 'loan_writeoff', minAmount: '1', maxAmount: '2' },
        { id: 'l2', organizationId: ORG_A, roleId: 'role-other', moduleKey: 'expense_claim', minAmount: '9', maxAmount: '9' },
      ],
    });
    const service = new RoleService();
    const result = await service.getApprovalLimits('role-a', actor(ORG_A));
    expect(result).toHaveLength(1);
    expect(result[0].moduleKey).toBe('loan_writeoff');
  });
});
