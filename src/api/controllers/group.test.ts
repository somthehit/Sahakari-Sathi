/**
 * Module 3 Addendum 2 — Groups (operational community groups)
 *
 * Exercises GroupController against the fake in-memory DB (../test/fakeDb.ts).
 * Proves the same guarantees as the seven lookup catalogs PLUS the group-specific
 * shape: recurring monthly meeting schedule (meeting_day_of_month/time/place),
 * chairperson + contact person details, and a capacity cap (max_members).
 *
 *  1. organization_id always comes from the verified JWT, never the body.
 *  2. Every read/write is scoped by organization_id (cross-tenant rows leak
 *     into the fake if not → assertions below fail).
 *  3. Cross-tenant reads/writes by id are rejected with 403/404, never applied.
 *  4. Code is normalized to UPPERCASE → case-insensitive uniqueness.
 *  5. System groups cannot be deleted.
 *  6. Config writes emit an audit row for the acting org (with old→new diff).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeDb } from '../test/fakeDb';
import { GroupController } from './GroupController';

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

function adminUser(org: string) {
  return { organizationId: org, userId: 'u-1', username: 'admin', role: 'org_admin', branchIds: [], activeBranchId: '' };
}

function whereQueries(fake: ReturnType<typeof makeFakeDb>, table: string) {
  return fake.recordedWheres.filter((w) => w.table === table);
}

const baseGroup = {
  id: 'g-1', organizationId: ORG_A, code: 'G001', name: 'Shreemaya Saving Group',
  nameNepali: null, address: null, chairpersonName: null, chairpersonContact: null,
  chairpersonAddress: null, contactPersonName: null, contactPersonPhone: null,
  meetingDayOfMonth: null, meetingTime: null, meetingPlace: null, maxMembers: null,
  isActive: true, isSystem: false, createdBy: null, updatedBy: null,
  createdAt: new Date(), updatedAt: new Date(),
};

beforeEach(() => {
  holder.db = makeFakeDb();
});

// ===========================================================================
// List / read scoping
// ===========================================================================
describe('GroupController list & read scoping', () => {
  it('lists only the JWT org’s groups, scoped by organization_id', async () => {
    holder.db = makeFakeDb({
      groups: [
        baseGroup,
        { ...baseGroup, id: 'g-2', code: 'G002', name: 'Laxmi Saving Group' },
        { ...baseGroup, id: 'g-hack', organizationId: ORG_B, code: 'XXX', name: 'Hacker Group' },
      ],
    });
    const res = makeRes();
    await GroupController.listGroups(makeReq(adminUser(ORG_A)), res);

    const rows = res.json.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows.every((r: any) => r.organizationId === ORG_A)).toBe(true);
    expect(rows.every((r: any) => r.id !== 'g-hack')).toBe(true);
    const wheres = whereQueries(holder.db, 'groups');
    expect(wheres.some((w) => w.sql.includes('organization_id') && w.params.includes(ORG_A))).toBe(true);
  });

  it('applies a ?search filter on the org-scoped query', async () => {
    holder.db = makeFakeDb({ groups: [baseGroup] });
    const res = makeRes();
    await GroupController.listGroups(makeReq(adminUser(ORG_A), { query: { search: 'Shreemaya' } }), res);
    const wheres = whereQueries(holder.db, 'groups');
    expect(wheres.some((w) => w.params.some((p) => String(p).includes('Shreemaya')))).toBe(true);
  });

  it('applies the ?active filter on the org-scoped query', async () => {
    holder.db = makeFakeDb({ groups: [baseGroup] });
    const res = makeRes();
    await GroupController.listGroups(makeReq(adminUser(ORG_A), { query: { active: 'false' } }), res);
    const wheres = whereQueries(holder.db, 'groups');
    expect(wheres.some((w) => w.sql.includes('is_active') && w.params.includes(false))).toBe(true);
  });

  it('returns 404 for another org’s group by id (no leak)', async () => {
    holder.db = makeFakeDb({ groups: [{ ...baseGroup, id: 'g-hack', organizationId: ORG_B }] });
    const res = makeRes();
    await GroupController.getGroup(makeReq(adminUser(ORG_A), { params: { id: 'g-hack' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns an own-org group by id', async () => {
    holder.db = makeFakeDb({ groups: [baseGroup] });
    const res = makeRes();
    await GroupController.getGroup(makeReq(adminUser(ORG_A), { params: { id: 'g-1' } }), res);
    expect(res.json.mock.calls[0][0].name).toBe('Shreemaya Saving Group');
  });
});

// ===========================================================================
// Create
// ===========================================================================
describe('GroupController create', () => {
  it('stamps the JWT org on create, ignoring a smuggled organizationId, and audits', async () => {
    holder.db = makeFakeDb({ groups: [] });
    const res = makeRes();
    await GroupController.createGroup(
      makeReq(adminUser(ORG_A), { body: { code: 'G001', name: 'Shreemaya Saving Group', organizationId: ORG_B } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = holder.db.state.groups[0];
    expect(created.organizationId).toBe(ORG_A);
    expect(holder.db.state.groups.some((r: any) => r.organizationId === ORG_B)).toBe(false);
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Create Group' && a.organizationId === ORG_A)).toBe(true);
  });

  it('normalizes code to UPPERCASE for case-insensitive uniqueness', async () => {
    holder.db = makeFakeDb({ groups: [] });
    const res = makeRes();
    await GroupController.createGroup(
      makeReq(adminUser(ORG_A), { body: { code: 'g001', name: 'Shreemaya Saving Group' } }),
      res,
    );
    expect(holder.db.state.groups[0].code).toBe('G001');
  });

  it('persists the meeting schedule, chairperson and capacity fields', async () => {
    holder.db = makeFakeDb({ groups: [] });
    const res = makeRes();
    await GroupController.createGroup(
      makeReq(adminUser(ORG_A), {
        body: {
          code: 'G007',
          name: 'Jagriti Mahila Bikas Samuha',
          nameNepali: 'जागृति महिला बिकास समूह',
          address: 'Kirtipur, Kathmandu',
          chairpersonName: 'Sita Devi Sharma',
          chairpersonContact: '9841000001',
          chairpersonAddress: 'Kirtipur',
          contactPersonName: 'Rita Sharma',
          contactPersonPhone: '9841000002',
          meetingDayOfMonth: 5,
          meetingTime: '3:00 PM',
          meetingPlace: 'Community Hall, Ward 4',
          maxMembers: 30,
        },
      }),
      res,
    );
    const created = holder.db.state.groups[0];
    expect(created.meetingDayOfMonth).toBe(5);
    expect(created.meetingTime).toBe('3:00 PM');
    expect(created.meetingPlace).toBe('Community Hall, Ward 4');
    expect(created.maxMembers).toBe(30);
    expect(created.chairpersonName).toBe('Sita Devi Sharma');
  });

  it('treats empty maxMembers as no cap (null)', async () => {
    holder.db = makeFakeDb({ groups: [] });
    const res = makeRes();
    await GroupController.createGroup(
      makeReq(adminUser(ORG_A), { body: { code: 'G009', name: 'Open Group', maxMembers: '' } }),
      res,
    );
    expect(holder.db.state.groups[0].maxMembers).toBe(null);
  });

  it('rejects a duplicate code within the org (409) regardless of case', async () => {
    holder.db = makeFakeDb({ groups: [baseGroup] });
    const res = makeRes();
    await GroupController.createGroup(
      makeReq(adminUser(ORG_A), { body: { code: 'g001', name: 'Shreemaya Saving Group' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(holder.db.state.groups).toHaveLength(1);
  });

  it('rejects a duplicate name with a different code (409)', async () => {
    holder.db = makeFakeDb({ groups: [baseGroup] });
    const res = makeRes();
    await GroupController.createGroup(
      makeReq(adminUser(ORG_A), { body: { code: 'G999', name: 'Shreemaya Saving Group' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('allows the same code in a different org (no cross-org uniqueness)', async () => {
    holder.db = makeFakeDb({ groups: [baseGroup] });
    const res = makeRes();
    await GroupController.createGroup(
      makeReq(adminUser(ORG_B), { body: { code: 'G001', name: 'Shreemaya Saving Group' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects create without code or name (400)', async () => {
    holder.db = makeFakeDb({ groups: [] });
    const res = makeRes();
    await GroupController.createGroup(makeReq(adminUser(ORG_A), { body: { name: 'No Code Group' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ===========================================================================
// Update
// ===========================================================================
describe('GroupController update', () => {
  it('rejects editing another org’s group with 403 (no mutation)', async () => {
    holder.db = makeFakeDb({ groups: [{ ...baseGroup, id: 'g-hack', organizationId: ORG_B }] });
    const res = makeRes();
    await GroupController.updateGroup(
      makeReq(adminUser(ORG_A), { params: { id: 'g-hack' }, body: { name: 'Hacked' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(holder.db.state.groups[0].name).toBe('Shreemaya Saving Group');
  });

  it('updates an own-org group, persists the change and audits with a diff', async () => {
    holder.db = makeFakeDb({ groups: [baseGroup] });
    const res = makeRes();
    await GroupController.updateGroup(
      makeReq(adminUser(ORG_A), { params: { id: 'g-1' }, body: { name: 'Shreemaya Mahila Saving Group', meetingDayOfMonth: 15 } }),
      res,
    );
    expect(res.status).not.toHaveBeenCalledWith(404);
    const updated = holder.db.state.groups[0];
    expect(updated.name).toBe('Shreemaya Mahila Saving Group');
    expect(updated.meetingDayOfMonth).toBe(15);
    const audit = holder.db.state.auditRows.find((a: any) => a.action === 'Update Group' && a.organizationId === ORG_A);
    expect(audit).toBeTruthy();
    expect(audit.oldValue.name).toBe('Shreemaya Saving Group');
    expect(audit.newValue.name).toBe('Shreemaya Mahila Saving Group');
    expect(audit.oldValue.meetingDayOfMonth).toBe(null);
    expect(audit.newValue.meetingDayOfMonth).toBe(15);
  });

  it('rejects updating into a duplicate code (409)', async () => {
    holder.db = makeFakeDb({
      groups: [baseGroup, { ...baseGroup, id: 'g-2', code: 'G002', name: 'Laxmi Saving Group' }],
    });
    const res = makeRes();
    await GroupController.updateGroup(
      makeReq(adminUser(ORG_A), { params: { id: 'g-1' }, body: { code: 'g002' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(holder.db.state.groups.find((r: any) => r.id === 'g-1').code).toBe('G001');
  });

  it('returns 404 for a missing group', async () => {
    holder.db = makeFakeDb({ groups: [] });
    const res = makeRes();
    await GroupController.updateGroup(
      makeReq(adminUser(ORG_A), { params: { id: 'nope' }, body: { name: 'X' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ===========================================================================
// Delete
// ===========================================================================
describe('GroupController delete', () => {
  it('rejects deleting another org’s group and leaves the row intact', async () => {
    holder.db = makeFakeDb({ groups: [{ ...baseGroup, id: 'g-hack', organizationId: ORG_B, isSystem: false }] });
    const res = makeRes();
    await GroupController.deleteGroup(makeReq(adminUser(ORG_A), { params: { id: 'g-hack' } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(holder.db.state.groups).toHaveLength(1);
  });

  it('blocks deleting a system group (400) and leaves it intact', async () => {
    holder.db = makeFakeDb({ groups: [{ ...baseGroup, isSystem: true }] });
    const res = makeRes();
    await GroupController.deleteGroup(makeReq(adminUser(ORG_A), { params: { id: 'g-1' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(holder.db.state.groups).toHaveLength(1);
    expect(holder.db.state.auditRows.length).toBe(0);
  });

  it('deletes an own-org group and writes an audit row', async () => {
    holder.db = makeFakeDb({ groups: [baseGroup] });
    const res = makeRes();
    await GroupController.deleteGroup(makeReq(adminUser(ORG_A), { params: { id: 'g-1' } }), res);
    expect(holder.db.state.groups).toHaveLength(0);
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Delete Group' && a.organizationId === ORG_A)).toBe(true);
  });
});
