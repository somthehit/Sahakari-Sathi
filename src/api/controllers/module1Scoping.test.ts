/**
 * Module 1 (Organization Settings) — tenant-scoping tests.
 *
 * Every Module 1 controller is exercised with a fake in-memory DB that
 * faithfully evaluates the compiled `organization_id`/`id` where-clauses the
 * controllers actually send (see ../test/fakeDb.ts). These tests prove:
 *  1. organization_id always comes from the verified JWT (req.user), never the body.
 *  2. Every read query carries an organization_id filter (cross-tenant rows leak
 *     into the fake if it doesn't → the assertions below would fail).
 *  3. Cross-tenant reads/writes by id are rejected with 403/404, never silently
 *     applied.
 *  4. Settings writes emit an audit row scoped to the acting organization.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeDb, type FakeScenario } from '../test/fakeDb';
import { WorkingDayController } from './WorkingDayController';
import { FiscalYearController } from './FiscalYearController';
import { BranchController } from './BranchController';
import { LocalizationController } from './LocalizationController';
import { ExchangeRateController } from './ExchangeRateController';
import { AuthController } from './AuthController';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const holder = vi.hoisted(() => ({ db: null as any }));

vi.mock('../../db/client', () => ({
  getDb: () => holder.db,
  closeDb: () => {},
  checkDbHealth: () => false,
}));

const authMocks = vi.hoisted(() => ({
  getOrganizationDetail: vi.fn(),
  updateOrganization: vi.fn(),
  getNepalGeoData: vi.fn(),
}));

vi.mock('../services/AuthService', () => ({
  AuthService: class {
    getOrganizationDetail = authMocks.getOrganizationDetail;
    updateOrganization = authMocks.updateOrganization;
    getNepalGeoData = authMocks.getNepalGeoData;
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

const DEFAULT_DAY = (org: string, dayOfWeek: number) => ({
  organizationId: org,
  dayOfWeek,
  isWorkingDay: dayOfWeek !== 6,
  openTime: dayOfWeek === 6 ? null : '10:00',
  closeTime: dayOfWeek === 6 ? null : '17:00',
  halfDay: false,
});

const DAYS = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d }));

function whereQueries(fake: ReturnType<typeof makeFakeDb>, table: string) {
  return fake.recordedWheres.filter((w) => w.table === table);
}

beforeEach(() => {
  holder.db = makeFakeDb();
  authMocks.getOrganizationDetail.mockReset();
  authMocks.updateOrganization.mockReset();
  authMocks.getNepalGeoData.mockReset();
});

// ===========================================================================
// WorkingDayController
// ===========================================================================
describe('WorkingDayController tenant scoping', () => {
  it('derives the org from the JWT and returns only that org’s rows', async () => {
    holder.db = makeFakeDb({
      workingDays: [DEFAULT_DAY(ORG_A, 0), DEFAULT_DAY(ORG_A, 1), DEFAULT_DAY(ORG_B, 0)],
    });
    const res = makeRes();
    await WorkingDayController.getWorkingDays(makeReq(adminUser(ORG_A)), res);

    const rows = res.json.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows.every((r: any) => r.dayOfWeek !== undefined)).toBe(true);

    const wheres = whereQueries(holder.db, 'workingDays');
    expect(wheres.length).toBeGreaterThan(0);
    // The compiled where must reference organization_id and the JWT org value.
    expect(wheres[0].sql).toContain('organization_id');
    expect(wheres[0].params).toContain(ORG_A);
    expect(wheres[0].params).not.toContain(ORG_B);
  });

  it('seeds default 7-day schedule on first access, scoped to the JWT org', async () => {
    holder.db = makeFakeDb({ workingDays: [] });
    const res = makeRes();
    await WorkingDayController.getWorkingDays(makeReq(adminUser(ORG_A)), res);

    const rows = res.json.mock.calls[0][0];
    expect(rows).toHaveLength(7);
    expect(holder.db.state.workingDays).toHaveLength(7);
    expect(holder.db.state.workingDays.every((r: any) => r.organizationId === ORG_A)).toBe(true);
  });

  it('ignores a tenant column smuggled in the body and uses the JWT org', async () => {
    holder.db = makeFakeDb({ workingDays: [] });
    const res = makeRes();
    const req = makeReq(adminUser(ORG_A), {
      body: { organizationId: ORG_B, days: DAYS.map((d) => ({ ...d, isWorkingDay: true, openTime: '10:00', closeTime: '17:00', halfDay: false })) },
    });
    await WorkingDayController.updateWorkingDays(req, res);

    expect(holder.db.state.workingDays.every((r: any) => r.organizationId === ORG_A)).toBe(true);
    expect(holder.db.state.workingDays.some((r: any) => r.organizationId === ORG_B)).toBe(false);
    // Audit trail is written for the acting org.
    const audit = holder.db.state.auditRows.find((a: any) => a.action === 'Update Working Days');
    expect(audit).toBeTruthy();
    expect(audit.organizationId).toBe(ORG_A);
    expect(audit.userName).toBe('admin');
  });
});

// ===========================================================================
// FiscalYearController
// ===========================================================================
describe('FiscalYearController tenant scoping', () => {
  const fyA = { id: 'fy-a', organizationId: ORG_A, code: 'FY-2081', startDateBs: '2081-04-01', endDateBs: '2082-03-31', startDateAd: '', endDateAd: '', isCurrent: false, status: 'active' as const };
  const fyB = { id: 'fy-b', organizationId: ORG_B, code: 'FY-2082', startDateBs: '2082-04-01', endDateBs: '2083-03-31', startDateAd: '', endDateAd: '', isCurrent: false, status: 'active' as const };

  it('lists only the JWT org’s fiscal years', async () => {
    holder.db = makeFakeDb({ fiscalYears: [fyA, fyB, { ...fyA, id: 'fy-a2', code: 'FY-2080' }] });
    const res = makeRes();
    await FiscalYearController.getFiscalYears(makeReq(adminUser(ORG_A)), res);

    const rows = res.json.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows.every((r: any) => r.organizationId === ORG_A)).toBe(true);
    const wheres = whereQueries(holder.db, 'fiscalYears');
    expect(wheres.some((w) => w.sql.includes('organization_id') && w.params.includes(ORG_A))).toBe(true);
  });

  it('returns 404 for another org’s fiscal year by id (no leak)', async () => {
    holder.db = makeFakeDb({ fiscalYears: [fyB] });
    const res = makeRes();
    await FiscalYearController.getFiscalYear(makeReq(adminUser(ORG_A), { params: { id: 'fy-b' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].error).toBe('Fiscal year not found');
  });

  it('returns the fiscal year when it belongs to the caller’s org', async () => {
    holder.db = makeFakeDb({ fiscalYears: [fyA] });
    const res = makeRes();
    await FiscalYearController.getFiscalYear(makeReq(adminUser(ORG_A), { params: { id: 'fy-a' } }), res);
    expect(res.status).not.toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].id).toBe('fy-a');
  });

  it('rejects an update to another org’s fiscal year with 403', async () => {
    holder.db = makeFakeDb({ fiscalYears: [fyB] });
    const res = makeRes();
    await FiscalYearController.updateFiscalYear(
      makeReq(adminUser(ORG_A), { params: { id: 'fy-b' }, body: { code: 'HACKED' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].error).toContain('Not authorized');
  });

  it('rejects a delete of another org’s fiscal year with 403', async () => {
    holder.db = makeFakeDb({ fiscalYears: [fyB] });
    const res = makeRes();
    await FiscalYearController.deleteFiscalYear(makeReq(adminUser(ORG_A), { params: { id: 'fy-b' } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('stamps the JWT org on create, ignoring a smuggled organizationId', async () => {
    holder.db = makeFakeDb({ fiscalYears: [] });
    const res = makeRes();
    await FiscalYearController.createFiscalYear(
      makeReq(adminUser(ORG_A), {
        body: { code: 'FY-2083', startDateBS: '2083-04-01', endDateBS: '2084-03-31', isCurrent: true, organizationId: ORG_B },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = holder.db.state.fiscalYears.find((fy: any) => fy.code === 'FY-2083');
    expect(created).toBeTruthy();
    expect(created.organizationId).toBe(ORG_A);
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Create Fiscal Year' && a.organizationId === ORG_A)).toBe(true);
  });

  it('keeps only one active fiscal year: creating an active one deactivates the prior active row', async () => {
    holder.db = makeFakeDb({ fiscalYears: [{ ...fyA, isCurrent: true }] });
    const res = makeRes();
    await FiscalYearController.createFiscalYear(
      makeReq(adminUser(ORG_A), {
        body: { code: 'FY-2083', startDateBS: '2083-04-01', endDateBS: '2084-03-31', isCurrent: true },
      }),
      res,
    );
    const old = holder.db.state.fiscalYears.find((fy: any) => fy.id === 'fy-a');
    const created = holder.db.state.fiscalYears.find((fy: any) => fy.code === 'FY-2083');
    expect(old.isCurrent).toBe(false);
    expect(created.isCurrent).toBe(true);
  });

  it('rejects an overlapping fiscal year range (server-side data integrity)', async () => {
    holder.db = makeFakeDb({ fiscalYears: [fyA] });
    const res = makeRes();
    // Overlaps fy-a (2081-04-01 → 2082-03-31).
    await FiscalYearController.createFiscalYear(
      makeReq(adminUser(ORG_A), {
        body: { code: 'FY-2082', startDateBS: '2082-01-01', endDateBS: '2082-03-31' },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toContain('must not overlap');
  });
});

// ===========================================================================
// BranchController
// ===========================================================================
describe('BranchController tenant scoping', () => {
  const brA = { id: 'br-a', organizationId: ORG_A, code: 'HO', name: 'Head Office', isHeadOffice: true, status: 'Active', managerName: 'M', address: 'A', phone: '', currentVaultCash: '0', vaultLimit: '0' };
  const brB = { id: 'br-b', organizationId: ORG_B, code: 'KT', name: 'Kathmandu', isHeadOffice: false, status: 'Active', managerName: 'M', address: 'A', phone: '', currentVaultCash: '0', vaultLimit: '0' };

  it('lists only the JWT org’s branches', async () => {
    holder.db = makeFakeDb({ branches: [brA, brB] });
    const res = makeRes();
    await BranchController.getBranches(makeReq(adminUser(ORG_A)), res);
    const rows = res.json.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('br-a');
    expect(whereQueries(holder.db, 'branches').some((w) => w.sql.includes('organization_id') && w.params.includes(ORG_A))).toBe(true);
  });

  it('returns 404 for another org’s branch by id (no leak)', async () => {
    holder.db = makeFakeDb({ branches: [brB] });
    const res = makeRes();
    await BranchController.getBranch(makeReq(adminUser(ORG_A), { params: { id: 'br-b' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects editing another org’s branch with 403', async () => {
    holder.db = makeFakeDb({ branches: [brB] });
    const res = makeRes();
    await BranchController.updateBranch(makeReq(adminUser(ORG_A), { params: { id: 'br-b' }, body: { name: 'Hacked' } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('stamps the JWT org on create, ignoring a smuggled organizationId', async () => {
    holder.db = makeFakeDb({ branches: [] });
    const res = makeRes();
    await BranchController.createBranch(
      makeReq(adminUser(ORG_A), { body: { name: 'Pokhara', code: 'PKR', address: 'Lake Side', organizationId: ORG_B } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = holder.db.state.branches[0];
    expect(created.organizationId).toBe(ORG_A);
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Create Branch' && a.organizationId === ORG_A)).toBe(true);
  });

  it('blocks deactivating a branch that still has dependent staff', async () => {
    holder.db = makeFakeDb({ branches: [{ ...brA, isHeadOffice: false, id: 'br-x' }], dependentCounts: { employees: 2 } });
    const res = makeRes();
    await BranchController.deactivateBranch(makeReq(adminUser(ORG_A), { params: { id: 'br-x' } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toContain('2 staff members');
    // Branch was NOT deactivated.
    expect(holder.db.state.branches[0].status).toBe('Active');
  });

  it('blocks deactivating the head office branch', async () => {
    holder.db = makeFakeDb({ branches: [brA] });
    const res = makeRes();
    await BranchController.deactivateBranch(makeReq(adminUser(ORG_A), { params: { id: 'br-a' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('deactivates a branch with no dependents and writes an audit row', async () => {
    holder.db = makeFakeDb({ branches: [{ ...brA, isHeadOffice: false }] });
    const res = makeRes();
    await BranchController.deactivateBranch(makeReq(adminUser(ORG_A), { params: { id: 'br-a' } }), res);
    expect(holder.db.state.branches[0].status).toBe('Inactive');
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Deactivate Branch' && a.organizationId === ORG_A)).toBe(true);
  });
});

// ===========================================================================
// LocalizationController
// ===========================================================================
describe('LocalizationController tenant scoping', () => {
  const locA = { organizationId: ORG_A, defaultLanguage: 'ne' as const, supportedLanguages: ['ne', 'en'], primaryCalendarSystem: 'BS' as const, dateDisplayFormat: 'YYYY-MM-DD', numberFormatStyle: 'IN' as const, currencySymbol: 'रु.', currencySymbolPosition: 'prefix' as const, enableAutoTransliteration: false };
  const locB = { ...locA, organizationId: ORG_B };

  it('returns only the JWT org’s localization settings (or scoped defaults)', async () => {
    holder.db = makeFakeDb({ localization: [locA, locB] });
    const res = makeRes();
    await LocalizationController.getSettings(makeReq(adminUser(ORG_A)), res);
    expect(res.json.mock.calls[0][0].organizationId).toBe(ORG_A);
  });

  it('returns scoped defaults when the org has not saved any yet', async () => {
    holder.db = makeFakeDb({ localization: [] });
    const res = makeRes();
    await LocalizationController.getSettings(makeReq(adminUser(ORG_A)), res);
    expect(res.json.mock.calls[0][0].organizationId).toBe(ORG_A);
    expect(res.json.mock.calls[0][0].primaryCalendarSystem).toBe('BS');
  });

  it('stamps the JWT org on save, ignoring a smuggled organizationId', async () => {
    holder.db = makeFakeDb({ localization: [] });
    const res = makeRes();
    await LocalizationController.updateSettings(
      makeReq(adminUser(ORG_A), { body: { defaultLanguage: 'en', organizationId: ORG_B } }),
      res,
    );
    expect(res.json.mock.calls[0][0].organizationId).toBe(ORG_A);
    expect(holder.db.state.localization[0].organizationId).toBe(ORG_A);
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Update Localization Settings' && a.organizationId === ORG_A)).toBe(true);
  });
});

// ===========================================================================
// ExchangeRateController (currency & forex)
// ===========================================================================
describe('ExchangeRateController tenant scoping', () => {
  const rateA = { id: 'r1', organizationId: ORG_A, baseCurrency: 'USD', targetCurrency: 'NPR', buyRate: '130', sellRate: '132', officialMiddleRate: '131', effectiveDate: '2026-01-01', createdAt: '' };
  const rateB = { ...rateA, id: 'r2', organizationId: ORG_B };

  it('lists only the JWT org’s exchange-rate history', async () => {
    holder.db = makeFakeDb({ exchangeRates: [rateA, rateB] });
    const res = makeRes();
    await ExchangeRateController.getRates(makeReq(adminUser(ORG_A)), res);
    const rows = res.json.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('r1');
  });

  it('reports base-currency lock once the org has financial activity', async () => {
    holder.db = makeFakeDb({
      financialSettings: [{ organizationId: ORG_A, defaultCurrency: 'NPR', allowedCurrencies: ['NPR', 'USD'], defaultForexMarkupPercent: '0', isTaxEnabled: false, taxName: 'GST', defaultTaxRatePercent: '0', taxNumber: null }],
      financialActivity: true,
    });
    const res = makeRes();
    await ExchangeRateController.getFinancialSettings(makeReq(adminUser(ORG_A)), res);
    expect(res.json.mock.calls[0][0].baseCurrencyLocked).toBe(true);
    expect(res.json.mock.calls[0][0].defaultCurrency).toBe('NPR');
  });

  it('rejects a base-currency change when locked (accounting trail protection)', async () => {
    holder.db = makeFakeDb({
      financialSettings: [{ organizationId: ORG_A, defaultCurrency: 'NPR', allowedCurrencies: ['NPR', 'USD'], defaultForexMarkupPercent: '0', isTaxEnabled: false, taxName: 'GST', defaultTaxRatePercent: '0', taxNumber: null }],
      financialActivity: true,
    });
    const res = makeRes();
    await ExchangeRateController.updateFinancialSettings(makeReq(adminUser(ORG_A), { body: { defaultCurrency: 'USD' } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toContain('Base currency cannot be changed');
    expect(holder.db.state.financialSettings[0].defaultCurrency).toBe('NPR');
  });

  it('allows a base-currency change before any financial activity', async () => {
    holder.db = makeFakeDb({ financialActivity: false });
    const res = makeRes();
    await ExchangeRateController.updateFinancialSettings(makeReq(adminUser(ORG_A), { body: { defaultCurrency: 'USD' } }), res);
    expect(holder.db.state.financialSettings[0].defaultCurrency).toBe('USD');
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Update Financial Settings' && a.organizationId === ORG_A)).toBe(true);
  });
});

// ===========================================================================
// AuthController (org profile)
// ===========================================================================
describe('AuthController org profile tenant scoping', () => {
  it('loads the profile for the JWT org, not any client-supplied id', async () => {
    authMocks.getOrganizationDetail.mockResolvedValue({ id: ORG_A, organizationName: 'Sunaulo Bihani', pan: '123' });
    authMocks.getNepalGeoData.mockResolvedValue({ provinces: [] });
    const res = makeRes();
    await AuthController.getOrgProfile(makeReq(adminUser(ORG_A)), res);
    expect(authMocks.getOrganizationDetail).toHaveBeenCalledWith(ORG_A);
    expect(res.json.mock.calls[0][0].organization.organizationName).toBe('Sunaulo Bihani');
  });

  it('strips tenant-protected fields and always updates the JWT org', async () => {
    const before = { id: ORG_A, organizationName: 'Old Name', pan: '123', phone: '111', status: 'Active', subscriptionPlan: 'Basic' };
    authMocks.getOrganizationDetail.mockResolvedValueOnce(before);
    authMocks.updateOrganization.mockImplementation(async (_id: string, data: any) => ({ ...before, ...data }));

    const res = makeRes();
    await AuthController.updateOrgProfile(
      makeReq(adminUser(ORG_A), {
        body: {
          organizationName: 'New Name',
          pan: '123',
          // Attempted tenant escalations — must be ignored.
          organizationId: ORG_B,
          status: 'Suspended',
          subscriptionPlan: 'Enterprise',
          organizationCode: 'EVIL',
          slug: 'evil',
        },
      }),
      res,
    );

    expect(authMocks.updateOrganization).toHaveBeenCalledTimes(1);
    const [orgId, payload] = authMocks.updateOrganization.mock.calls[0];
    expect(orgId).toBe(ORG_A);
    expect(payload.organizationName).toBe('New Name');
    expect(payload.organizationId).toBeUndefined();
    expect(payload.status).toBeUndefined();
    expect(payload.subscriptionPlan).toBeUndefined();
    expect(payload.organizationCode).toBeUndefined();

    // Field-level diff is written to the audit log for the acting org.
    const audit = holder.db.state.auditRows.find((a: any) => a.action === 'Update Org Profile');
    expect(audit).toBeTruthy();
    expect(audit.organizationId).toBe(ORG_A);
    expect(audit.details).toContain('organizationName');
    expect(audit.details).toContain('New Name');
    expect(holder.db.state.auditRows.some((a: any) => a.organizationId === ORG_B)).toBe(false);
  });

  it('does not write an audit row when nothing changed', async () => {
    const same = { id: ORG_A, organizationName: 'Same', pan: '123', phone: '111', status: 'Active', subscriptionPlan: 'Basic' };
    authMocks.getOrganizationDetail.mockResolvedValueOnce(same);
    authMocks.updateOrganization.mockImplementation(async (_id: string, data: any) => ({ ...same, ...data }));

    const res = makeRes();
    await AuthController.updateOrgProfile(makeReq(adminUser(ORG_A), { body: { organizationName: 'Same', pan: '123' } }), res);
    expect(holder.db.state.auditRows.filter((a: any) => a.action === 'Update Org Profile')).toHaveLength(0);
  });
});
