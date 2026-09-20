/**
 * Module 3 (Share Settings) — tenant-scoping, RBAC-boundary, audit,
 * safe-delete, default-scheme and auto-provisioning tests.
 *
 * Exercises ShareSettingController (share-classes, share-schemes,
 * dividend-rules, certificate-formats + default-scheme) against the fake
 * in-memory DB, plus ShareProvisioningService (member-registration
 * auto-opening) with a mocked ShareRepository.
 *
 * Proves:
 *  1. organization_id always comes from the verified JWT, never the body.
 *  2. Every read/write is scoped by organization_id (cross-tenant rows leak
 *     into the fake if not → assertions below fail).
 *  3. Cross-tenant reads/writes by id are rejected with 403/404.
 *  4. Code is normalized to UPPERCASE → case-insensitive uniqueness.
 *  5. System records cannot be deleted; in-use schemes/classes are safe-deleted.
 *  6. Scheme is the canonical config (class/type refs must belong to the org).
 *  7. Default-scheme set validates existence/org/active and audits.
 *  8. Auto-provisioning is idempotent and NEVER fails member registration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeDb, type FakeScenario } from '../test/fakeDb';
import { ShareSettingController } from './ShareSettingController';
import {
  ShareProvisioningService,
  computeOpeningAmount,
} from '../services/ShareProvisioningService';

const holder = vi.hoisted(() => ({ db: null as any }));

vi.mock('../../db/client', () => ({
  getDb: () => holder.db,
  closeDb: () => {},
  checkDbHealth: () => false,
}));

const authMock = vi.hoisted(() => ({ updateOrganization: vi.fn() }));
vi.mock('../services/AuthService', () => ({
  AuthService: class {
    updateOrganization = authMock.updateOrganization;
  },
}));

const repoMock = vi.hoisted(() => ({
  findActiveHoldingForMember: vi.fn(),
  getNextJournalVoucherNo: vi.fn(),
  getNextCertificateNo: vi.fn(),
  executeIssueReturn: vi.fn(),
}));
vi.mock('../repositories/ShareRepository', () => ({
  ShareRepository: class {
    findActiveHoldingForMember = repoMock.findActiveHoldingForMember;
    getNextJournalVoucherNo = repoMock.getNextJournalVoucherNo;
    getNextCertificateNo = repoMock.getNextCertificateNo;
    executeIssueReturn = repoMock.executeIssueReturn;
  },
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

const baseClass = {
  id: 'c1', organizationId: ORG_A, code: 'CLS-A', name: 'Class A', nameNepali: null,
  description: null, isActive: true, sortOrder: 0, isSystem: false,
  createdBy: null, updatedBy: null, createdAt: new Date(), updatedAt: new Date(),
};

const baseType = { id: 'st1', organizationId: ORG_A, code: 'ORD', name: 'Ordinary Share' };

const baseScheme = {
  id: 's1', organizationId: ORG_A, code: 'SCHEME-A', name: 'Scheme A', nameNepali: null,
  description: null, isActive: true, sortOrder: 0, isSystem: false,
  shareClassId: 'c1', shareTypeId: 'st1', shareValuePerUnit: '100.00', minOpenUnits: 10,
  maxUnits: null, isTransferable: true, dividendRate: '0.0000', minOpeningAmount: '0.00',
  createdBy: null, updatedBy: null, createdAt: new Date(), updatedAt: new Date(),
};

const baseProfile = { organizationId: ORG_A, defaultShareSchemeId: 's1' };

const provisionMember = { id: 'm-1', memberNo: 'MBR-0001', fullName: 'Rita Sharma', branchId: null };

function seededScenario(overrides: FakeScenario = {}): FakeScenario {
  return {
    shareClasses: [baseClass],
    shareSchemes: [baseScheme],
    shareTypes: [baseType],
    organizationProfiles: [baseProfile],
    ...overrides,
  };
}

beforeEach(() => {
  holder.db = makeFakeDb();
  authMock.updateOrganization.mockReset();
  authMock.updateOrganization.mockImplementation(async (id: string, data: any) => ({ id, ...data }));
  repoMock.findActiveHoldingForMember.mockReset();
  repoMock.getNextJournalVoucherNo.mockReset();
  repoMock.getNextCertificateNo.mockReset();
  repoMock.executeIssueReturn.mockReset();
  repoMock.findActiveHoldingForMember.mockResolvedValue(null);
  repoMock.getNextJournalVoucherNo.mockResolvedValue('JV-1001');
  repoMock.getNextCertificateNo.mockResolvedValue('SC-0001');
  repoMock.executeIssueReturn.mockResolvedValue({ holdingId: 'h-1', voucherNo: 'JV-1001' });
});

// ===========================================================================
// List / read scoping
// ===========================================================================
describe('ShareSettingController list & read scoping', () => {
  it('lists only the JWT org’s share classes, scoped by organization_id', async () => {
    holder.db = makeFakeDb({
      shareClasses: [
        baseClass,
        { ...baseClass, id: 'c2', code: 'CLS-B', name: 'Class B' },
        { ...baseClass, id: 'c-hack', organizationId: ORG_B, code: 'XXX', name: 'Hacker' },
      ],
    });
    const res = makeRes();
    await ShareSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'share-classes' } }), res);

    const rows = res.json.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows.every((r: any) => r.organizationId === ORG_A)).toBe(true);
    const wheres = whereQueries(holder.db, 'shareClasses');
    expect(wheres.some((w) => w.sql.includes('organization_id') && w.params.includes(ORG_A))).toBe(true);
  });

  it('normalizes scheme numeric fields to numbers in the response', async () => {
    holder.db = makeFakeDb(seededScenario());
    const res = makeRes();
    await ShareSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'share-schemes' } }), res);
    const row = res.json.mock.calls[0][0][0];
    expect(row.shareValuePerUnit).toBe(100);
    expect(row.minOpenUnits).toBe(10);
    expect(row.minOpeningAmount).toBe(0);
  });

  it('applies a ?search filter on the org-scoped query', async () => {
    holder.db = makeFakeDb(seededScenario());
    const res = makeRes();
    await ShareSettingController.getSettings(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-classes' }, query: { search: 'Class' } }),
      res,
    );
    const wheres = whereQueries(holder.db, 'shareClasses');
    expect(wheres.some((w) => w.params.some((p) => String(p).includes('Class')))).toBe(true);
  });

  it('rejects an unknown entity type with 400', async () => {
    const res = makeRes();
    await ShareSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'share-types' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 for another org’s share class by id (no leak)', async () => {
    holder.db = makeFakeDb({ shareClasses: [{ ...baseClass, id: 'c-hack', organizationId: ORG_B }] });
    const res = makeRes();
    await ShareSettingController.getSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-classes', id: 'c-hack' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns an own-org share class by id', async () => {
    holder.db = makeFakeDb(seededScenario());
    const res = makeRes();
    await ShareSettingController.getSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-classes', id: 'c1' } }),
      res,
    );
    expect(res.json.mock.calls[0][0].name).toBe('Class A');
  });
});

// ===========================================================================
// Create
// ===========================================================================
describe('ShareSettingController create', () => {
  it('stamps the JWT org on create, ignoring a smuggled organizationId, and audits', async () => {
    holder.db = makeFakeDb({ shareClasses: [] });
    const res = makeRes();
    await ShareSettingController.createSetting(
      makeReq(adminUser(ORG_A), {
        params: { entityType: 'share-classes' },
        body: { code: 'CLS-C', name: 'Class C', organizationId: ORG_B },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = holder.db.state.shareClasses[0];
    expect(created.organizationId).toBe(ORG_A);
    expect(created.code).toBe('CLS-C');
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Create Share Class' && a.organizationId === ORG_A)).toBe(true);
  });

  it('normalizes code to UPPERCASE for case-insensitive uniqueness', async () => {
    holder.db = makeFakeDb({ shareClasses: [] });
    const res = makeRes();
    await ShareSettingController.createSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-classes' }, body: { code: 'cls-d', name: 'Class D' } }),
      res,
    );
    expect(holder.db.state.shareClasses[0].code).toBe('CLS-D');
  });

  it('rejects a duplicate code within the org (409)', async () => {
    holder.db = makeFakeDb({ shareClasses: [baseClass] });
    const res = makeRes();
    await ShareSettingController.createSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-classes' }, body: { code: 'cls-a', name: 'Class A' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(holder.db.state.shareClasses).toHaveLength(1);
  });

  it('rejects a duplicate name with a different code (409)', async () => {
    holder.db = makeFakeDb({ shareClasses: [baseClass] });
    const res = makeRes();
    await ShareSettingController.createSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-classes' }, body: { code: 'CLS-X', name: 'Class A' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('allows the same code in a different org (no cross-org uniqueness)', async () => {
    holder.db = makeFakeDb({ shareClasses: [baseClass] });
    const res = makeRes();
    await ShareSettingController.createSetting(
      makeReq(adminUser(ORG_B), { params: { entityType: 'share-classes' }, body: { code: 'CLS-A', name: 'Class A' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('creates a scheme with canonical pricing config and org-scoped class/type refs', async () => {
    holder.db = makeFakeDb(seededScenario({ shareSchemes: [] }));
    const res = makeRes();
    await ShareSettingController.createSetting(
      makeReq(adminUser(ORG_A), {
        params: { entityType: 'share-schemes' },
        body: {
          code: 'SCHEME-B', name: 'Scheme B', shareClassId: 'c1', shareTypeId: 'st1',
          shareValuePerUnit: 250, minOpenUnits: 5, maxUnits: 100, isTransferable: true,
          dividendRate: 8, minOpeningAmount: 2000,
        },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = holder.db.state.shareSchemes[0];
    expect(created.shareClassId).toBe('c1');
    expect(created.shareTypeId).toBe('st1');
    expect(created.shareValuePerUnit).toBe('250');
    expect(created.minOpenUnits).toBe(5);
    expect(created.maxUnits).toBe(100);
    expect(created.minOpeningAmount).toBe('2000');
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Create Share Scheme')).toBe(true);
  });

  it('rejects a scheme whose share class belongs to another org (403)', async () => {
    holder.db = makeFakeDb(seededScenario({
      shareClasses: [{ ...baseClass, id: 'c-x', organizationId: ORG_B, code: 'CLS-X', name: 'Class X' }],
      shareSchemes: [],
    }));
    const res = makeRes();
    await ShareSettingController.createSetting(
      makeReq(adminUser(ORG_A), {
        params: { entityType: 'share-schemes' },
        body: { code: 'SCHEME-B', name: 'Scheme B', shareClassId: 'c-x', shareTypeId: 'st1' },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(holder.db.state.shareSchemes).toHaveLength(0);
  });

  it('rejects a scheme whose linked share type does not exist (400)', async () => {
    holder.db = makeFakeDb(seededScenario({ shareSchemes: [] }));
    const res = makeRes();
    await ShareSettingController.createSetting(
      makeReq(adminUser(ORG_A), {
        params: { entityType: 'share-schemes' },
        body: { code: 'SCHEME-B', name: 'Scheme B', shareTypeId: 'st-missing' },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates a dividend rule and persists numeric params as strings', async () => {
    holder.db = makeFakeDb({ dividendRules: [] });
    const res = makeRes();
    await ShareSettingController.createSetting(
      makeReq(adminUser(ORG_A), {
        params: { entityType: 'dividend-rules' },
        body: { code: 'DIV-1', name: 'Standard Dividend', taxWithholdingPercent: 5, targetDividendPercent: 12.5, bonusShareRatio: '1:10' },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = holder.db.state.dividendRules[0];
    expect(created.taxWithholdingPercent).toBe('5');
    expect(created.targetDividendPercent).toBe('12.5');
  });

  it('creates a certificate format serializing fields to fieldsJson', async () => {
    holder.db = makeFakeDb({ shareCertificateFormats: [] });
    const res = makeRes();
    await ShareSettingController.createSetting(
      makeReq(adminUser(ORG_A), {
        params: { entityType: 'certificate-formats' },
        body: { code: 'CERT-A', name: 'Standard Certificate', certificatePrefix: 'SC-', startingNumber: 1, includeLogo: true, fields: ['Member Name', 'Member No'] },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = holder.db.state.shareCertificateFormats[0];
    expect(created.fieldsJson).toBe('["Member Name","Member No"]');
    expect(created.certificatePrefix).toBe('SC-');
    const resp = res.json.mock.calls[0][0];
    expect(resp.fields).toEqual(['Member Name', 'Member No']);
  });
});

// ===========================================================================
// Update
// ===========================================================================
describe('ShareSettingController update', () => {
  it('rejects editing another org’s share class with 403 (no mutation)', async () => {
    holder.db = makeFakeDb({ shareClasses: [{ ...baseClass, id: 'c-hack', organizationId: ORG_B }] });
    const res = makeRes();
    await ShareSettingController.updateSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-classes', id: 'c-hack' }, body: { name: 'Hacked' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(holder.db.state.shareClasses[0].name).toBe('Class A');
  });

  it('updates an own-org scheme, persists the change and audits with a diff', async () => {
    holder.db = makeFakeDb(seededScenario());
    const res = makeRes();
    await ShareSettingController.updateSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-schemes', id: 's1' }, body: { minOpenUnits: 20 } }),
      res,
    );
    expect(holder.db.state.shareSchemes[0].minOpenUnits).toBe(20);
    const audit = holder.db.state.auditRows.find((a: any) => a.action === 'Update Share Scheme' && a.organizationId === ORG_A);
    expect(audit).toBeTruthy();
    expect(audit.oldValue.minOpenUnits).toBe(10);
    expect(audit.newValue.minOpenUnits).toBe(20);
  });

  it('rejects updating into a duplicate code (409)', async () => {
    holder.db = makeFakeDb(seededScenario({ shareClasses: [baseClass, { ...baseClass, id: 'c2', code: 'CLS-B', name: 'Class B' }] }));
    const res = makeRes();
    await ShareSettingController.updateSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-classes', id: 'c1' }, body: { code: 'CLS-B' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(holder.db.state.shareClasses.find((r: any) => r.id === 'c1').code).toBe('CLS-A');
  });

  it('returns 404 for a missing own-org record', async () => {
    holder.db = makeFakeDb({ shareClasses: [] });
    const res = makeRes();
    await ShareSettingController.updateSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-classes', id: 'nope' }, body: { name: 'X' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ===========================================================================
// Delete
// ===========================================================================
describe('ShareSettingController delete', () => {
  it('rejects deleting another org’s dividend rule and leaves the row intact', async () => {
    holder.db = makeFakeDb({ dividendRules: [{ id: 'd1', organizationId: ORG_B, code: 'DIV', name: 'Rule', isSystem: false }] });
    const res = makeRes();
    await ShareSettingController.deleteSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'dividend-rules', id: 'd1' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(holder.db.state.dividendRules).toHaveLength(1);
  });

  it('deletes an own-org certificate format and writes an audit row', async () => {
    holder.db = makeFakeDb({ shareCertificateFormats: [{ id: 'cf1', organizationId: ORG_A, code: 'CERT', name: 'Cert', isSystem: false }] });
    const res = makeRes();
    await ShareSettingController.deleteSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'certificate-formats', id: 'cf1' } }),
      res,
    );
    expect(holder.db.state.shareCertificateFormats).toHaveLength(0);
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Delete Share Certificate Format' && a.organizationId === ORG_A)).toBe(true);
  });

  it('blocks deleting a system share class (400) and leaves it intact', async () => {
    holder.db = makeFakeDb({ shareClasses: [{ ...baseClass, id: 'c-sys', isSystem: true }] });
    const res = makeRes();
    await ShareSettingController.deleteSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-classes', id: 'c-sys' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(holder.db.state.shareClasses).toHaveLength(1);
    expect(holder.db.state.auditRows.length).toBe(0);
  });

  it('blocks deleting a share scheme already in use by holdings (400)', async () => {
    holder.db = makeFakeDb(seededScenario({
      shareHoldings: [{ id: 'h1', organizationId: ORG_A, shareSchemeId: 's1', memberId: 'm1', status: 'Active' }],
    }));
    const res = makeRes();
    await ShareSettingController.deleteSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-schemes', id: 's1' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(holder.db.state.shareSchemes).toHaveLength(1);
  });

  it('blocks deleting the org’s default share scheme (400)', async () => {
    holder.db = makeFakeDb(seededScenario({
      organizationProfiles: [{ organizationId: ORG_A, defaultShareSchemeId: 's1' }],
    }));
    const res = makeRes();
    await ShareSettingController.deleteSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-schemes', id: 's1' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(holder.db.state.shareSchemes).toHaveLength(1);
  });

  it('blocks deleting a share class referenced by a scheme (400)', async () => {
    holder.db = makeFakeDb(seededScenario({ shareClasses: [baseClass, { ...baseClass, id: 'c2', code: 'CLS-B', name: 'Class B' }] }));
    const res = makeRes();
    await ShareSettingController.deleteSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-classes', id: 'c1' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(holder.db.state.shareClasses).toHaveLength(2);
  });

  it('deletes an unused own-org share class (200) and audits', async () => {
    holder.db = makeFakeDb(seededScenario({ shareClasses: [baseClass, { ...baseClass, id: 'c2', code: 'CLS-B', name: 'Class B' }], shareSchemes: [] }));
    const res = makeRes();
    await ShareSettingController.deleteSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-classes', id: 'c2' } }),
      res,
    );
    expect(res.json.mock.calls[0][0].success).toBe(true);
    expect(holder.db.state.shareClasses).toHaveLength(1);
  });
});

// ===========================================================================
// Usage counts
// ===========================================================================
describe('ShareSettingController usage counts', () => {
  it('reports scheme usage from share holdings', async () => {
    holder.db = makeFakeDb(seededScenario({
      shareHoldings: [
        { id: 'h1', organizationId: ORG_A, shareSchemeId: 's1', status: 'Active' },
        { id: 'h2', organizationId: ORG_A, shareSchemeId: 's1', status: 'Active' },
        { id: 'h3', organizationId: ORG_A, shareSchemeId: 's2', status: 'Active' },
      ],
    }));
    const res = makeRes();
    await ShareSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'share-schemes' } }), res);
    expect(res.json.mock.calls[0][0][0].usageCount).toBe(2);
  });

  it('reports class usage from share schemes', async () => {
    holder.db = makeFakeDb(seededScenario({
      shareSchemes: [baseScheme, { ...baseScheme, id: 's2', code: 'SCHEME-B', name: 'Scheme B', shareClassId: 'c1' }],
    }));
    const res = makeRes();
    await ShareSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'share-classes' } }), res);
    expect(res.json.mock.calls[0][0][0].usageCount).toBe(2);
  });

  it('returns 0 usage when nothing references the record', async () => {
    holder.db = makeFakeDb(seededScenario({ shareHoldings: [], shareSchemes: [baseScheme] }));
    const res = makeRes();
    await ShareSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'share-schemes' } }), res);
    expect(res.json.mock.calls[0][0][0].usageCount).toBe(0);
  });
});

// ===========================================================================
// Org default share scheme
// ===========================================================================
describe('ShareSettingController default share scheme', () => {
  it('returns the org’s configured default scheme', async () => {
    holder.db = makeFakeDb(seededScenario({ organizationProfiles: [{ organizationId: ORG_A, defaultShareSchemeId: 's1' }] }));
    const res = makeRes();
    await ShareSettingController.getDefaultScheme(makeReq(adminUser(ORG_A)), res);
    const body = res.json.mock.calls[0][0];
    expect(body.defaultShareSchemeId).toBe('s1');
    expect(body.scheme.name).toBe('Scheme A');
  });

  it('returns null default when the profile has none', async () => {
    holder.db = makeFakeDb(seededScenario({ organizationProfiles: [{ organizationId: ORG_A, defaultShareSchemeId: null }] }));
    const res = makeRes();
    await ShareSettingController.getDefaultScheme(makeReq(adminUser(ORG_A)), res);
    expect(res.json.mock.calls[0][0]).toEqual({ defaultShareSchemeId: null, scheme: null });
  });

  it('rejects setting a default scheme from another org (403)', async () => {
    holder.db = makeFakeDb(seededScenario({ shareSchemes: [{ ...baseScheme, id: 's-x', organizationId: ORG_B }] }));
    const res = makeRes();
    await ShareSettingController.setDefaultScheme(
      makeReq(adminUser(ORG_A), { body: { defaultShareSchemeId: 's-x' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(authMock.updateOrganization).not.toHaveBeenCalled();
  });

  it('rejects setting a missing scheme (404)', async () => {
    holder.db = makeFakeDb(seededScenario({ shareSchemes: [] }));
    const res = makeRes();
    await ShareSettingController.setDefaultScheme(
      makeReq(adminUser(ORG_A), { body: { defaultShareSchemeId: 's-missing' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects setting an inactive scheme (400)', async () => {
    holder.db = makeFakeDb(seededScenario({ shareSchemes: [{ ...baseScheme, isActive: false }] }));
    const res = makeRes();
    await ShareSettingController.setDefaultScheme(
      makeReq(adminUser(ORG_A), { body: { defaultShareSchemeId: 's1' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(authMock.updateOrganization).not.toHaveBeenCalled();
  });

  it('sets an active org scheme as default, persists and audits', async () => {
    holder.db = makeFakeDb(seededScenario());
    const res = makeRes();
    await ShareSettingController.setDefaultScheme(
      makeReq(adminUser(ORG_A), { body: { defaultShareSchemeId: 's1' } }),
      res,
    );
    expect(res.json.mock.calls[0][0].defaultShareSchemeId).toBe('s1');
    expect(authMock.updateOrganization).toHaveBeenCalledWith(ORG_A, { defaultShareSchemeId: 's1' });
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Set Default Share Scheme' && a.organizationId === ORG_A)).toBe(true);
  });

  it('clears the default with null', async () => {
    holder.db = makeFakeDb(seededScenario());
    const res = makeRes();
    await ShareSettingController.setDefaultScheme(
      makeReq(adminUser(ORG_A), { body: { defaultShareSchemeId: null } }),
      res,
    );
    expect(res.json.mock.calls[0][0].defaultShareSchemeId).toBeNull();
    expect(authMock.updateOrganization).toHaveBeenCalledWith(ORG_A, { defaultShareSchemeId: null });
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Clear Default Share Scheme')).toBe(true);
  });
});

// ===========================================================================
// Reorder
// ===========================================================================
describe('ShareSettingController reorder', () => {
  it('rejects a reorder that references another org’s record (403)', async () => {
    holder.db = makeFakeDb({ shareClasses: [baseClass] });
    const res = makeRes();
    await ShareSettingController.reorderSettings(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-classes' }, body: { items: [{ id: 'c-foreign', sortOrder: 1 }] } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('applies an org-scoped reorder', async () => {
    holder.db = makeFakeDb({ shareClasses: [baseClass] });
    const res = makeRes();
    await ShareSettingController.reorderSettings(
      makeReq(adminUser(ORG_A), { params: { entityType: 'share-classes' }, body: { items: [{ id: 'c1', sortOrder: 9 }] } }),
      res,
    );
    expect(res.json.mock.calls[0][0].success).toBe(true);
    expect(holder.db.state.shareClasses[0].sortOrder).toBe(9);
  });

  it('rejects a reorder with duplicate ids (422)', async () => {
    holder.db = makeFakeDb({ shareClasses: [baseClass] });
    const res = makeRes();
    await ShareSettingController.reorderSettings(
      makeReq(adminUser(ORG_A), {
        params: { entityType: 'share-classes' },
        body: { items: [{ id: 'c1', sortOrder: 1 }, { id: 'c1', sortOrder: 2 }] },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(422);
  });
});

// ===========================================================================
// Pure opening-amount computation
// ===========================================================================
describe('computeOpeningAmount', () => {
  it('uses minOpenUnits × shareValuePerUnit when minOpeningAmount is 0', () => {
    expect(computeOpeningAmount({ minOpenUnits: 10, shareValuePerUnit: 100, minOpeningAmount: 0 }))
      .toEqual({ shares: 10, amount: 1000, computedAmount: 1000 });
  });

  it('prefers a configured minOpeningAmount over the computed value', () => {
    expect(computeOpeningAmount({ minOpenUnits: 10, shareValuePerUnit: 100, minOpeningAmount: 2500 }))
      .toEqual({ shares: 10, amount: 2500, computedAmount: 1000 });
  });

  it('clamps shares to a minimum of 1', () => {
    expect(computeOpeningAmount({ minOpenUnits: 0, shareValuePerUnit: 100 }))
      .toEqual({ shares: 1, amount: 100, computedAmount: 100 });
  });

  it('handles numeric-string inputs', () => {
    expect(computeOpeningAmount({ minOpenUnits: '20', shareValuePerUnit: '50', minOpeningAmount: '0' }))
      .toEqual({ shares: 20, amount: 1000, computedAmount: 1000 });
  });

  it('yields zero for a zero-value scheme', () => {
    expect(computeOpeningAmount({ minOpenUnits: 10, shareValuePerUnit: 0 }))
      .toEqual({ shares: 10, amount: 0, computedAmount: 0 });
  });
});

// ===========================================================================
// Auto-provisioning service
// ===========================================================================
describe('ShareProvisioningService', () => {
  const service = () => new ShareProvisioningService();

  it('skips gracefully when the DB is unavailable', async () => {
    holder.db = null;
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result).toEqual({ skipped: true, reason: 'no-db' });
  });

  it('skips when the org has no default share scheme', async () => {
    holder.db = makeFakeDb(seededScenario({ organizationProfiles: [{ organizationId: ORG_A, defaultShareSchemeId: null }] }));
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('no-default-scheme');
    expect(holder.db.state.shareProvisioningQueue).toHaveLength(0);
  });

  it('records a Failed queue row when the default scheme is missing', async () => {
    holder.db = makeFakeDb(seededScenario({
      organizationProfiles: [{ organizationId: ORG_A, defaultShareSchemeId: 's-missing' }],
    }));
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('scheme-not-found');
    const queued = holder.db.state.shareProvisioningQueue[0];
    expect(queued.status).toBe('Failed');
    expect(queued.errorMessage).toBe('Share Scheme not found.');
  });

  it('records a Failed queue row when the scheme is inactive', async () => {
    holder.db = makeFakeDb(seededScenario({ shareSchemes: [{ ...baseScheme, isActive: false }] }));
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.reason).toBe('scheme-inactive');
    expect(holder.db.state.shareProvisioningQueue[0].status).toBe('Failed');
  });

  it('records a Failed queue row when the scheme has no linked share type', async () => {
    holder.db = makeFakeDb(seededScenario({ shareSchemes: [{ ...baseScheme, shareTypeId: null }] }));
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.reason).toBe('scheme-no-share-type');
    expect(holder.db.state.shareProvisioningQueue[0].status).toBe('Failed');
  });

  it('skips idempotently when the member already has an active holding', async () => {
    holder.db = makeFakeDb(seededScenario());
    repoMock.findActiveHoldingForMember.mockResolvedValue({ id: 'h-1' });
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('already-opened');
    expect(repoMock.executeIssueReturn).not.toHaveBeenCalled();
    expect(holder.db.state.shareProvisioningQueue[0].status).toBe('Success');
  });

  it('skips idempotently when (member, scheme) already provisioned successfully', async () => {
    holder.db = makeFakeDb(seededScenario({
      shareProvisioningQueue: [{
        id: 'q1', organizationId: ORG_A, memberId: 'm-1', memberNo: 'MBR-0001',
        shareSchemeId: 's1', shareTypeId: 'st1', status: 'Success', attempts: 1,
        openedHoldingId: 'h-1', openedVoucherNo: 'JV-1', errorMessage: null,
      }],
    }));
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('already-provisioned');
    expect(repoMock.executeIssueReturn).not.toHaveBeenCalled();
  });

  it('opens a holding with the scheme-derived deposit and posts the GL entry', async () => {
    holder.db = makeFakeDb(seededScenario());
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.opened).toBe(true);
    expect(result.shares).toBe(10);
    expect(result.amount).toBe(1000);
    expect(repoMock.executeIssueReturn).toHaveBeenCalledTimes(1);
    const payload = repoMock.executeIssueReturn.mock.calls[0][1];
    expect(payload.schemeId).toBe('s1');
    expect(payload.openedVia).toBe('auto');
    expect(payload.narration).toBe('Auto-opening deposit — Member Registration');
    expect(payload.totalAmount).toBe(1000);
    expect(payload.shareTypeId).toBe('st1');
    const queued = holder.db.state.shareProvisioningQueue[0];
    expect(queued.status).toBe('Success');
    expect(queued.openedHoldingId).toBe('h-1');
    expect(queued.openedVoucherNo).toBe('JV-1001');
  });

  it('respects a configured min opening amount over units × value', async () => {
    holder.db = makeFakeDb(seededScenario({ shareSchemes: [{ ...baseScheme, minOpeningAmount: '2500.00' }] }));
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.amount).toBe(2500);
  });

  it('records a Failed queue row and never throws when posting fails', async () => {
    holder.db = makeFakeDb(seededScenario());
    repoMock.executeIssueReturn.mockRejectedValue(new Error('boom'));
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('error');
    expect(result.error).toBe('boom');
    const queued = holder.db.state.shareProvisioningQueue[0];
    expect(queued.status).toBe('Failed');
    expect(queued.errorMessage).toBe('boom');
  });
});
