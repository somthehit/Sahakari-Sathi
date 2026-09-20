/**
 * Module 3 (Member Settings) — tenant-scoping, RBAC-boundary and audit tests.
 *
 * Exercises the generic MemberSettingController against the fake in-memory DB
 * (../test/fakeDb.ts) for the seven classification catalogs. Proves:
 *  1. organization_id always comes from the verified JWT, never the body.
 *  2. Every read/write is scoped by organization_id (cross-tenant rows leak
 *     into the fake if not → assertions below fail).
 *  3. Cross-tenant reads/writes by id are rejected with 403/404, never applied.
 *  4. Code is normalized to UPPERCASE → case-insensitive uniqueness.
 *  5. System records cannot be deleted.
 *  6. Config writes emit an audit row for the acting org.
 *  7. member-types accepts (and persists) the three financial extra fields.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeDb, type FakeScenario } from '../test/fakeDb';
import { MemberSettingController } from './MemberSettingController';

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

const baseType = {
  id: 't-ind', organizationId: ORG_A, code: 'IND', name: 'Individual Member', nameNepali: null,
  description: null, isActive: true, sortOrder: 0, isSystem: false,
  minShareUnits: 10, entranceFee: '500.00', shareValuePerUnit: '100.00',
  createdBy: null, updatedBy: null, createdAt: new Date(), updatedAt: new Date(),
};

beforeEach(() => {
  holder.db = makeFakeDb();
});

// ===========================================================================
// List / read scoping
// ===========================================================================
describe('MemberSettingController list & read scoping', () => {
  it('lists only the JWT org’s member types, scoped by organization_id', async () => {
    holder.db = makeFakeDb({
      memberTypes: [
        baseType,
        { ...baseType, id: 't-ins', code: 'INS', name: 'Institutional Member' },
        { ...baseType, id: 't-hack', organizationId: ORG_B, code: 'XXX', name: 'Hacker' },
      ],
    });
    const res = makeRes();
    await MemberSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'member-types' } }), res);

    const rows = res.json.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows.every((r: any) => r.organizationId === ORG_A)).toBe(true);
    expect(rows.every((r: any) => r.id !== 't-hack')).toBe(true);
    const wheres = whereQueries(holder.db, 'memberTypes');
    expect(wheres.some((w) => w.sql.includes('organization_id') && w.params.includes(ORG_A))).toBe(true);
  });

  it('normalizes member-types numeric fields to numbers in the response', async () => {
    holder.db = makeFakeDb({ memberTypes: [baseType] });
    const res = makeRes();
    await MemberSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'member-types' } }), res);
    const row = res.json.mock.calls[0][0][0];
    expect(row.minShareUnits).toBe(10);
    expect(row.entranceFee).toBe(500);
    expect(row.shareValuePerUnit).toBe(100);
  });

  it('applies a ?search filter on the org-scoped query', async () => {
    holder.db = makeFakeDb({ memberTypes: [baseType] });
    const res = makeRes();
    await MemberSettingController.getSettings(
      makeReq(adminUser(ORG_A), { params: { entityType: 'member-types' }, query: { search: 'Individual' } }),
      res,
    );
    const wheres = whereQueries(holder.db, 'memberTypes');
    expect(wheres.some((w) => w.params.some((p) => String(p).includes('Individual')))).toBe(true);
  });

  it('rejects an unknown entity type with 400', async () => {
    const res = makeRes();
    await MemberSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'share-types' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 for another org’s member type by id (no leak)', async () => {
    holder.db = makeFakeDb({ memberTypes: [{ ...baseType, id: 't-hack', organizationId: ORG_B }] });
    const res = makeRes();
    await MemberSettingController.getSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'member-types', id: 't-hack' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns an own-org member type by id', async () => {
    holder.db = makeFakeDb({ memberTypes: [baseType] });
    const res = makeRes();
    await MemberSettingController.getSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'member-types', id: 't-ind' } }),
      res,
    );
    expect(res.json.mock.calls[0][0].name).toBe('Individual Member');
  });
});

// ===========================================================================
// Create
// ===========================================================================
describe('MemberSettingController create', () => {
  it('stamps the JWT org on create, ignoring a smuggled organizationId, and audits', async () => {
    holder.db = makeFakeDb({ memberTypes: [] });
    const res = makeRes();
    await MemberSettingController.createSetting(
      makeReq(adminUser(ORG_A), {
        params: { entityType: 'member-types' },
        body: { code: 'SNR', name: 'Senior Citizen Member', organizationId: ORG_B },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = holder.db.state.memberTypes[0];
    expect(created.organizationId).toBe(ORG_A);
    expect(holder.db.state.memberTypes.some((r: any) => r.organizationId === ORG_B)).toBe(false);
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Create Member Type' && a.organizationId === ORG_A)).toBe(true);
  });

  it('normalizes code to UPPERCASE for case-insensitive uniqueness', async () => {
    holder.db = makeFakeDb({ memberTypes: [] });
    const res = makeRes();
    await MemberSettingController.createSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'member-types' }, body: { code: 'ind', name: 'Individual Member' } }),
      res,
    );
    expect(holder.db.state.memberTypes[0].code).toBe('IND');
  });

  it('rejects a duplicate code within the org (409) regardless of case', async () => {
    holder.db = makeFakeDb({ memberTypes: [baseType] });
    const res = makeRes();
    // Same name + same normalized code → duplicate.
    await MemberSettingController.createSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'member-types' }, body: { code: 'ind', name: 'Individual Member' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(holder.db.state.memberTypes).toHaveLength(1);
  });

  it('rejects a duplicate name with a different code (409)', async () => {
    holder.db = makeFakeDb({ memberTypes: [baseType] });
    const res = makeRes();
    await MemberSettingController.createSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'member-types' }, body: { code: 'NEW', name: 'Individual Member' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('allows the same code in a different org (no cross-org uniqueness)', async () => {
    holder.db = makeFakeDb({ memberTypes: [baseType] });
    const res = makeRes();
    await MemberSettingController.createSetting(
      makeReq(adminUser(ORG_B), { params: { entityType: 'member-types' }, body: { code: 'IND', name: 'Individual Member' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('persists the financial extra fields for member-types', async () => {
    holder.db = makeFakeDb({ memberTypes: [] });
    const res = makeRes();
    await MemberSettingController.createSetting(
      makeReq(adminUser(ORG_A), {
        params: { entityType: 'member-types' },
        body: { code: 'INS', name: 'Institutional Member', minShareUnits: 100, entranceFee: 2500, shareValuePerUnit: 100 },
      }),
      res,
    );
    const created = holder.db.state.memberTypes[0];
    expect(created.minShareUnits).toBe(100);
    expect(created.entranceFee).toBe('2500');
    expect(created.shareValuePerUnit).toBe('100');
  });

  it('rejects an unknown entity type with 400', async () => {
    const res = makeRes();
    await MemberSettingController.createSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'bogus' }, body: { code: 'X', name: 'X' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ===========================================================================
// Update
// ===========================================================================
describe('MemberSettingController update', () => {
  it('rejects editing another org’s member type with 403 (no mutation)', async () => {
    holder.db = makeFakeDb({ memberTypes: [{ ...baseType, id: 't-hack', organizationId: ORG_B }] });
    const res = makeRes();
    await MemberSettingController.updateSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'member-types', id: 't-hack' }, body: { name: 'Hacked' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(holder.db.state.memberTypes[0].name).toBe('Individual Member');
  });

  it('updates an own-org member type, persists the change and audits with a diff', async () => {
    holder.db = makeFakeDb({ memberTypes: [baseType] });
    const res = makeRes();
    await MemberSettingController.updateSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'member-types', id: 't-ind' }, body: { name: 'Individual Member (Retired)', minShareUnits: 5 } }),
      res,
    );
    expect(res.status).not.toHaveBeenCalledWith(404);
    expect(holder.db.state.memberTypes[0].name).toBe('Individual Member (Retired)');
    expect(holder.db.state.memberTypes[0].minShareUnits).toBe(5);
    const audit = holder.db.state.auditRows.find((a: any) => a.action === 'Update Member Type' && a.organizationId === ORG_A);
    expect(audit).toBeTruthy();
    expect(audit.oldValue.name).toBe('Individual Member');
    expect(audit.newValue.name).toBe('Individual Member (Retired)');
  });

  it('rejects updating into a duplicate code (409)', async () => {
    holder.db = makeFakeDb({
      memberTypes: [baseType, { ...baseType, id: 't-ins', code: 'INS', name: 'Institutional Member' }],
    });
    const res = makeRes();
    await MemberSettingController.updateSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'member-types', id: 't-ind' }, body: { code: 'INS' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(holder.db.state.memberTypes.find((r: any) => r.id === 't-ind').code).toBe('IND');
  });

  it('returns 404 for a missing own-org record', async () => {
    holder.db = makeFakeDb({ memberTypes: [] });
    const res = makeRes();
    await MemberSettingController.updateSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'member-types', id: 'nope' }, body: { name: 'X' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ===========================================================================
// Delete
// ===========================================================================
describe('MemberSettingController delete', () => {
  it('rejects deleting another org’s member category and leaves the row intact', async () => {
    holder.db = makeFakeDb({ memberCategories: [{ id: 'c1', organizationId: ORG_B, code: 'GEN', name: 'General', isSystem: false }] });
    const res = makeRes();
    await MemberSettingController.deleteSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'member-categories', id: 'c1' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(holder.db.state.memberCategories).toHaveLength(1);
  });

  it('deletes an own-org record and writes an audit row', async () => {
    holder.db = makeFakeDb({ occupations: [{ id: 'o1', organizationId: ORG_A, code: 'OCC-01', name: 'Farming', isSystem: false }] });
    const res = makeRes();
    await MemberSettingController.deleteSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'occupations', id: 'o1' } }),
      res,
    );
    expect(holder.db.state.occupations).toHaveLength(0);
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Delete Occupation' && a.organizationId === ORG_A)).toBe(true);
  });

  it('blocks deleting a system record (400) and leaves it intact', async () => {
    holder.db = makeFakeDb({ relationshipTypes: [{ id: 'r1', organizationId: ORG_A, code: 'FTH', name: 'Father', isSystem: true }] });
    const res = makeRes();
    await MemberSettingController.deleteSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'relationship-types', id: 'r1' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(holder.db.state.relationshipTypes).toHaveLength(1);
    expect(holder.db.state.auditRows.length).toBe(0);
  });
});

// ===========================================================================
// Cross-entity coverage (the generic engine must handle all seven)
// ===========================================================================
describe('MemberSettingController entity coverage', () => {
  it.each([
    ['member-categories', 'Member Category'],
    ['occupations', 'Occupation'],
    ['education-levels', 'Education Level'],
    ['nominee-types', 'Nominee Type'],
    ['relationship-types', 'Relationship Type'],
    ['member-statuses', 'Member Status'],
  ])('creates + audits a %s record', async (entityType, label) => {
    holder.db = makeFakeDb({});
    const res = makeRes();
    await MemberSettingController.createSetting(
      makeReq(adminUser(ORG_A), { params: { entityType }, body: { code: `C-${entityType.slice(0, 4).toUpperCase()}`, name: 'Sample' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const audit = holder.db.state.auditRows.find((a: any) => a.action === `Create ${label}` && a.organizationId === ORG_A);
    expect(audit).toBeTruthy();
  });
});

// ===========================================================================
// Usage counts — masters must be "connected to the actual system"
// ===========================================================================
describe('MemberSettingController usage counts', () => {
  it('reports usage for occupations from member KYC profiles', async () => {
    holder.db = makeFakeDb({
      occupations: [{ id: 'o1', organizationId: ORG_A, code: 'FARM', name: 'Agriculture', isActive: true, sortOrder: 0 }],
      dependentCounts: { kyc: 2 },
    });
    const res = makeRes();
    await MemberSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'occupations' } }), res);
    expect(res.json.mock.calls[0][0][0].usageCount).toBe(2);
  });

  it('reports usage for relationship-types from member family nominee relations', async () => {
    holder.db = makeFakeDb({
      relationshipTypes: [{ id: 'r1', organizationId: ORG_A, code: 'FTH', name: 'Father', isActive: true, sortOrder: 0 }],
      dependentCounts: { family: 3 },
    });
    const res = makeRes();
    await MemberSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'relationship-types' } }), res);
    expect(res.json.mock.calls[0][0][0].usageCount).toBe(3);
  });

  it('returns 0 usage when the dependency table is empty', async () => {
    holder.db = makeFakeDb({
      occupations: [{ id: 'o1', organizationId: ORG_A, code: 'FARM', name: 'Agriculture', isActive: true, sortOrder: 0 }],
    });
    const res = makeRes();
    await MemberSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'occupations' } }), res);
    expect(res.json.mock.calls[0][0][0].usageCount).toBe(0);
  });
});

// ===========================================================================
// FK-id usage counting — usage must be computed from the NEW FK columns, not
// the legacy text columns (they are dropped in migration 0024). Assert the
// compiled WHERE clause references the FK column for every linked entity.
// ===========================================================================
describe('MemberSettingController FK usage-count scoping', () => {
  it.each([
    ['member-types', 'member_type_id', 'memberTypes', { id: 't1', organizationId: ORG_A, code: 'GEN', name: 'General', isActive: true, sortOrder: 0 }, { members: 4 }],
    ['member-categories', 'member_category_id', 'memberCategories', { id: 'c1', organizationId: ORG_A, code: 'REG', name: 'Regular', isActive: true, sortOrder: 0 }, { members: 2 }],
    ['occupations', 'occupation_id', 'occupations', { id: 'o1', organizationId: ORG_A, code: 'FARM', name: 'Farming', isActive: true, sortOrder: 0 }, { kyc: 3 }],
    ['education-levels', 'education_level_id', 'educationLevels', { id: 'e1', organizationId: ORG_A, code: 'BACH', name: 'Bachelor', isActive: true, sortOrder: 0 }, { kyc: 1 }],
    ['nominee-types', 'nominee_type_id', 'nomineeTypes', { id: 'n1', organizationId: ORG_A, code: 'PRI', name: 'Primary', isActive: true, sortOrder: 0 }, { family: 5 }],
    ['relationship-types', 'nominee_relation_id', 'relationshipTypes', { id: 'r1', organizationId: ORG_A, code: 'SPO', name: 'Spouse', isActive: true, sortOrder: 0 }, { family: 6 }],
  ])('counts %s usage via the %s FK column', async (entityType, fkColumn, stateKey, catalogRow, dependentCounts) => {
    holder.db = makeFakeDb({ [stateKey]: [catalogRow], dependentCounts });
    const res = makeRes();
    await MemberSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType } }), res);
    expect(res.json.mock.calls[0][0]).toHaveLength(1); // one catalog row seeded
    const countWheres = whereQueries(holder.db, 'count');
    expect(countWheres.some((w) => w.sql.includes(fkColumn))).toBe(true);
  });

  it('does not reference the legacy text columns in usage queries', async () => {
    holder.db = makeFakeDb({
      occupations: [{ id: 'o1', organizationId: ORG_A, code: 'FARM', name: 'Farming', isActive: true, sortOrder: 0 }],
      dependentCounts: { kyc: 1 },
    });
    const res = makeRes();
    await MemberSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'occupations' } }), res);
    const countWheres = whereQueries(holder.db, 'count');
    expect(countWheres.some((w) => w.sql.includes('ilike') && w.sql.includes('occupation'))).toBe(false);
  });

  it('always scopes the usage query by organization_id', async () => {
    holder.db = makeFakeDb({
      memberTypes: [{ id: 't1', organizationId: ORG_A, code: 'GEN', name: 'General', isActive: true, sortOrder: 0 }],
      dependentCounts: { members: 1 },
    });
    const res = makeRes();
    await MemberSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'member-types' } }), res);
    const countWheres = whereQueries(holder.db, 'count');
    expect(countWheres.some((w) => w.sql.includes('organization_id') && w.params.includes(ORG_A))).toBe(true);
  });
});
