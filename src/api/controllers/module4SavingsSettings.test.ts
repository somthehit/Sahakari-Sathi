/**
 * Module 4 (Savings A/C Settings) — tenant-scoping, RBAC-boundary, audit,
 * safe-delete, default-product, cheque-book and auto-provisioning tests.
 *
 * Exercises SavingsSettingController (savings-products + default-product +
 * cheque books) against the fake in-memory DB, plus
 * SavingsProvisioningService (member-registration auto-opening) with a
 * mocked SavingsService.openAccount.
 *
 * Proves:
 *  1. organization_id always comes from the verified JWT, never the body.
 *  2. Every read/write is scoped by organization_id.
 *  3. Cross-tenant reads/writes by id are rejected with 403/404.
 *  4. Code is normalized to UPPERCASE → case-insensitive uniqueness.
 *  5. System records cannot be deleted; in-use/default products are safe-deleted.
 *  6. GL + member-type refs must belong to the org (403/400).
 *  7. Default-product set validates existence/org/active and audits.
 *  8. Cheque-book issuance is org-scoped and cancels unused leaves.
 *  9. Auto-provisioning is idempotent, non-fatal and reuses SavingsService.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeDb, type FakeScenario } from '../test/fakeDb';
import { SavingsSettingController } from './SavingsSettingController';
import {
  SavingsProvisioningService,
  computeOpeningAmount,
} from '../services/SavingsProvisioningService';

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

const savingsServiceMock = vi.hoisted(() => ({ openAccount: vi.fn() }));
vi.mock('../services/SavingsService', () => ({
  SavingsService: class {
    openAccount = savingsServiceMock.openAccount;
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

const baseProduct: Record<string, any> = {
  id: 'p1', organizationId: ORG_A, code: 'REG-1001', name: 'General Savings', nameNepali: null,
  description: null, isActive: true, sortOrder: 0, isSystem: false,
  productType: 'regular', productCategory: null, accountNoPrefix: 'SAV',
  interestRate: '5.5000', interestPostingFrequency: 'Monthly',
  interestCalculationMethod: 'min_monthly_balance', interestEffectiveDate: null,
  minBalance: '0.00', minDeposit: '0.00', maxDeposit: null, maxBalance: null,
  tenureMonths: null, penaltyRate: '0.0000', eligibleMemberTypeIds: [],
  minAge: null, maxAge: null,
  requiresKycVerified: true, requiresNominee: true, requiresPhoto: true,
  requiresSignature: true, requiresDocuments: true,
  openingDepositRequired: true, depositModeCash: true, depositModeBank: true,
  depositModeTransfer: true, depositModeAgent: true,
  dailyDepositLimit: null, monthlyDepositLimit: null, backdateDepositAllowed: false,
  depositRequiresApproval: false, withdrawalModeCash: true, withdrawalModeTransfer: true,
  minWithdrawal: null, maxWithdrawal: null, dailyWithdrawalLimit: null,
  monthlyWithdrawalLimit: null, minimumBalanceAfterWithdrawal: null,
  withdrawalRequiresApproval: false, minBalanceGraceDays: 0,
  minBalancePenaltyPercent: '0.0000', minBalancePenaltyAmount: '0.00',
  minBalancePenaltyFrequency: 'Monthly', minBalanceWaiverAllowed: false,
  inactiveAfterMonths: 3, dormantAfterMonths: 6, notifyBeforeDormancyDays: 30,
  reactivationRequired: true, reactivationApprovalRequired: false,
  closureAllowed: true, minimumBalanceBeforeClosure: '0.00',
  closureRequiresApproval: false, closureFee: '0.00', openingFee: '0.00',
  monthlyMaintenanceFee: '0.00', withdrawalFee: '0.00', chequeBookFee: '0.00',
  chequeLeafFee: '0.00', stopPaymentFee: '0.00', chequeReturnFee: '0.00',
  passbookFee: '0.00', statementFee: '0.00', chequeEnabled: false,
  chequeDefaultLeaves: 25, chequeMaxBooks: 1,
  glLiabilityAccountId: null, glInterestExpenseAccountId: null,
  glInterestPayableAccountId: null, glFeeIncomeAccountId: null,
  glPenaltyIncomeAccountId: null, glChequeIncomeAccountId: null,
  createdBy: null, updatedBy: null, createdAt: new Date(), updatedAt: new Date(),
};

const baseProfile = { organizationId: ORG_A, defaultSavingProductId: 'p1' };

const glA = { id: 'gl-a', organizationId: ORG_A, code: '2010', name: 'Savings Liabilities', accountType: 'Liabilities' };
const memberTypeA = { id: 'mt-a', organizationId: ORG_A, code: 'REG', name: 'Regular Member' };

const provisionMember = { id: 'm-1', memberNo: 'MBR-0001', fullName: 'Rita Sharma', branchId: 'br-1' };

function seededScenario(overrides: FakeScenario = {}): FakeScenario {
  return {
    savingsProducts: [baseProduct],
    organizationProfiles: [baseProfile],
    chartOfAccounts: [glA],
    memberTypes: [memberTypeA],
    ...overrides,
  };
}

beforeEach(() => {
  holder.db = makeFakeDb();
  authMock.updateOrganization.mockReset();
  authMock.updateOrganization.mockImplementation(async (id: string, data: any) => ({ id, ...data }));
  savingsServiceMock.openAccount.mockReset();
  savingsServiceMock.openAccount.mockResolvedValue({ id: 'acc-1', accountNo: 'SAV-000001' });
});

// ===========================================================================
// List / read scoping
// ===========================================================================
describe('SavingsSettingController list & read scoping', () => {
  it('lists only the JWT org’s account products, scoped by organization_id', async () => {
    holder.db = makeFakeDb({
      savingsProducts: [
        baseProduct,
        { ...baseProduct, id: 'p2', code: 'FIX-2000', name: 'Fixed Deposit' },
        { ...baseProduct, id: 'p-hack', organizationId: ORG_B, code: 'XXX', name: 'Hacker Product' },
      ],
    });
    const res = makeRes();
    await SavingsSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products' } }), res);

    const rows = res.json.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows.every((r: any) => r.organizationId === ORG_A)).toBe(true);
    const wheres = whereQueries(holder.db, 'savingsProducts');
    expect(wheres.some((w) => w.sql.includes('organization_id') && w.params.includes(ORG_A))).toBe(true);
  });

  it('normalizes numeric product fields to numbers in the response', async () => {
    holder.db = makeFakeDb(seededScenario());
    const res = makeRes();
    await SavingsSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products' } }), res);
    const row = res.json.mock.calls[0][0][0];
    expect(row.interestRate).toBe(5.5);
    expect(row.minDeposit).toBe(0);
    expect(row.chequeDefaultLeaves).toBe(25);
  });

  it('applies a ?search filter on the org-scoped query', async () => {
    holder.db = makeFakeDb(seededScenario());
    const res = makeRes();
    await SavingsSettingController.getSettings(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products' }, query: { search: 'General' } }),
      res,
    );
    const wheres = whereQueries(holder.db, 'savingsProducts');
    expect(wheres.some((w) => w.params.some((p) => String(p).includes('General')))).toBe(true);
  });

  it('rejects an unknown entity type with 400', async () => {
    const res = makeRes();
    await SavingsSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'savings-deposits' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 for another org’s account product by id (no leak)', async () => {
    holder.db = makeFakeDb({ savingsProducts: [{ ...baseProduct, id: 'p-hack', organizationId: ORG_B }] });
    const res = makeRes();
    await SavingsSettingController.getSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products', id: 'p-hack' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns an own-org account product by id', async () => {
    holder.db = makeFakeDb(seededScenario());
    const res = makeRes();
    await SavingsSettingController.getSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products', id: 'p1' } }),
      res,
    );
    expect(res.json.mock.calls[0][0].name).toBe('General Savings');
  });
});

// ===========================================================================
// Create
// ===========================================================================
describe('SavingsSettingController create', () => {
  it('stamps the JWT org on create, ignoring a smuggled organizationId, and audits', async () => {
    holder.db = makeFakeDb({ savingsProducts: [] });
    const res = makeRes();
    await SavingsSettingController.createSetting(
      makeReq(adminUser(ORG_A), {
        params: { entityType: 'savings-products' },
        body: { code: 'REG-2000', name: 'Staff Savings', organizationId: ORG_B },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = holder.db.state.savingsProducts[0];
    expect(created.organizationId).toBe(ORG_A);
    expect(created.code).toBe('REG-2000');
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Create Savings Product' && a.organizationId === ORG_A)).toBe(true);
  });

  it('normalizes code to UPPERCASE for case-insensitive uniqueness', async () => {
    holder.db = makeFakeDb({ savingsProducts: [] });
    const res = makeRes();
    await SavingsSettingController.createSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products' }, body: { code: 'rec-3000', name: 'Recurring Savings' } }),
      res,
    );
    expect(holder.db.state.savingsProducts[0].code).toBe('REC-3000');
  });

  it('rejects a duplicate code within the org (409)', async () => {
    holder.db = makeFakeDb({ savingsProducts: [baseProduct] });
    const res = makeRes();
    await SavingsSettingController.createSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products' }, body: { code: 'reg-1001', name: 'General Savings' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(holder.db.state.savingsProducts).toHaveLength(1);
  });

  it('rejects a duplicate name with a different code (409)', async () => {
    holder.db = makeFakeDb({ savingsProducts: [baseProduct] });
    const res = makeRes();
    await SavingsSettingController.createSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products' }, body: { code: 'REG-9999', name: 'General Savings' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('allows the same code in a different org (no cross-org uniqueness)', async () => {
    holder.db = makeFakeDb({ savingsProducts: [baseProduct] });
    const res = makeRes();
    await SavingsSettingController.createSetting(
      makeReq(adminUser(ORG_B), { params: { entityType: 'savings-products' }, body: { code: 'REG-1001', name: 'General Savings' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('creates a full product with config and records the opening rate', async () => {
    holder.db = makeFakeDb(seededScenario({ savingsProducts: [] }));
    const res = makeRes();
    await SavingsSettingController.createSetting(
      makeReq(adminUser(ORG_A), {
        params: { entityType: 'savings-products' },
        body: {
          code: 'FIX-5000', name: 'Fixed Deposit 1Yr', productType: 'fixed',
          accountNoPrefix: 'FD', interestRate: 8.25, minBalance: 5000, minDeposit: 10000,
          openingDepositRequired: true, chequeEnabled: true, chequeDefaultLeaves: 50,
        },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = holder.db.state.savingsProducts[0];
    expect(created.productType).toBe('fixed');
    expect(created.accountNoPrefix).toBe('FD');
    expect(created.interestRate).toBe('8.25');
    expect(created.minDeposit).toBe('10000');
    expect(created.chequeEnabled).toBe(true);
    const rate = holder.db.state.savingsInterestRates[0];
    expect(rate.rate).toBe('8.25');
    expect(rate.savingsProductId).toBe(created.id);
  });

  it('accepts GL mapping references that belong to the org', async () => {
    holder.db = makeFakeDb(seededScenario({ savingsProducts: [] }));
    const res = makeRes();
    await SavingsSettingController.createSetting(
      makeReq(adminUser(ORG_A), {
        params: { entityType: 'savings-products' },
        body: { code: 'REG-7000', name: 'GL Mapped Savings', glLiabilityAccountId: 'gl-a', glInterestExpenseAccountId: 'gl-a' },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(holder.db.state.savingsProducts[0].glLiabilityAccountId).toBe('gl-a');
  });

  it('rejects a GL account that belongs to another org (403)', async () => {
    holder.db = makeFakeDb(seededScenario({
      savingsProducts: [],
      chartOfAccounts: [glA, { id: 'gl-x', organizationId: ORG_B, code: '2999', name: 'Foreign', accountType: 'Liabilities' }],
    }));
    const res = makeRes();
    await SavingsSettingController.createSetting(
      makeReq(adminUser(ORG_A), {
        params: { entityType: 'savings-products' },
        body: { code: 'REG-7000', name: 'GL Mapped Savings', glLiabilityAccountId: 'gl-x' },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(holder.db.state.savingsProducts).toHaveLength(0);
  });

  it('rejects a missing GL account (400)', async () => {
    holder.db = makeFakeDb(seededScenario({ savingsProducts: [], chartOfAccounts: [] }));
    const res = makeRes();
    await SavingsSettingController.createSetting(
      makeReq(adminUser(ORG_A), {
        params: { entityType: 'savings-products' },
        body: { code: 'REG-7000', name: 'GL Mapped Savings', glLiabilityAccountId: 'gl-missing' },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects an eligible member type that belongs to another org (403)', async () => {
    holder.db = makeFakeDb(seededScenario({
      savingsProducts: [],
      memberTypes: [memberTypeA, { id: 'mt-x', organizationId: ORG_B, code: 'VIP', name: 'VIP' }],
    }));
    const res = makeRes();
    await SavingsSettingController.createSetting(
      makeReq(adminUser(ORG_A), {
        params: { entityType: 'savings-products' },
        body: { code: 'REG-7000', name: 'Eligible Savings', eligibleMemberTypeIds: ['mt-x'] },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(holder.db.state.savingsProducts).toHaveLength(0);
  });
});

// ===========================================================================
// Update
// ===========================================================================
describe('SavingsSettingController update', () => {
  it('rejects editing another org’s product with 403 (no mutation)', async () => {
    holder.db = makeFakeDb({ savingsProducts: [{ ...baseProduct, id: 'p-hack', organizationId: ORG_B }] });
    const res = makeRes();
    await SavingsSettingController.updateSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products', id: 'p-hack' }, body: { name: 'Hacked' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(holder.db.state.savingsProducts[0].name).toBe('General Savings');
  });

  it('updates an own-org product, persists the change and audits with a diff', async () => {
    holder.db = makeFakeDb(seededScenario());
    const res = makeRes();
    await SavingsSettingController.updateSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products', id: 'p1' }, body: { minDeposit: 2500 } }),
      res,
    );
    expect(holder.db.state.savingsProducts[0].minDeposit).toBe('2500');
    const audit = holder.db.state.auditRows.find((a: any) => a.action === 'Update Savings Product' && a.organizationId === ORG_A);
    expect(audit).toBeTruthy();
    expect(audit.oldValue.minDeposit).toBe(0);
    expect(audit.newValue.minDeposit).toBe(2500);
  });

  it('closes and reopens rate history when the rate changes', async () => {
    holder.db = makeFakeDb(seededScenario());
    const res = makeRes();
    await SavingsSettingController.updateSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products', id: 'p1' }, body: { interestRate: 6.75 } }),
      res,
    );
    const rates = holder.db.state.savingsInterestRates;
    expect(holder.db.state.savingsProducts[0].interestRate).toBe('6.75');
    expect(rates.some((r: any) => r.rate === '6.75' && r.effectiveToBs == null)).toBe(true);
  });

  it('rejects updating into a duplicate code (409)', async () => {
    holder.db = makeFakeDb(seededScenario({
      savingsProducts: [baseProduct, { ...baseProduct, id: 'p2', code: 'FIX-2000', name: 'Fixed Deposit' }],
    }));
    const res = makeRes();
    await SavingsSettingController.updateSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products', id: 'p1' }, body: { code: 'FIX-2000' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(holder.db.state.savingsProducts.find((r: any) => r.id === 'p1').code).toBe('REG-1001');
  });

  it('blocks deactivating a system product (400)', async () => {
    holder.db = makeFakeDb(seededScenario({ savingsProducts: [{ ...baseProduct, isSystem: true }] }));
    const res = makeRes();
    await SavingsSettingController.updateSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products', id: 'p1' }, body: { isActive: false } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(holder.db.state.savingsProducts[0].isActive).toBe(true);
  });

  it('returns 404 for a missing own-org record', async () => {
    holder.db = makeFakeDb({ savingsProducts: [] });
    const res = makeRes();
    await SavingsSettingController.updateSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products', id: 'nope' }, body: { name: 'X' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ===========================================================================
// Delete
// ===========================================================================
describe('SavingsSettingController delete', () => {
  it('rejects deleting another org’s product and leaves the row intact', async () => {
    holder.db = makeFakeDb({ savingsProducts: [{ ...baseProduct, id: 'p-hack', organizationId: ORG_B }] });
    const res = makeRes();
    await SavingsSettingController.deleteSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products', id: 'p-hack' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(holder.db.state.savingsProducts).toHaveLength(1);
  });

  it('deletes an own-org product and writes an audit row', async () => {
    holder.db = makeFakeDb({ savingsProducts: [baseProduct] });
    const res = makeRes();
    await SavingsSettingController.deleteSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products', id: 'p1' } }),
      res,
    );
    expect(holder.db.state.savingsProducts).toHaveLength(0);
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Delete Savings Product' && a.organizationId === ORG_A)).toBe(true);
  });

  it('blocks deleting a system product (400) and leaves it intact', async () => {
    holder.db = makeFakeDb({ savingsProducts: [{ ...baseProduct, isSystem: true }] });
    const res = makeRes();
    await SavingsSettingController.deleteSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products', id: 'p1' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(holder.db.state.savingsProducts).toHaveLength(1);
    expect(holder.db.state.auditRows.length).toBe(0);
  });

  it('blocks deleting a product already in use by savings accounts (400)', async () => {
    holder.db = makeFakeDb(seededScenario({
      savingsAccounts: [{ id: 'acc-1', organizationId: ORG_A, memberId: 'm-1', savingsProductId: 'p1' }],
    }));
    const res = makeRes();
    await SavingsSettingController.deleteSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products', id: 'p1' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(holder.db.state.savingsProducts).toHaveLength(1);
  });

  it('blocks deleting the org’s default product (400)', async () => {
    holder.db = makeFakeDb(seededScenario());
    const res = makeRes();
    await SavingsSettingController.deleteSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products', id: 'p1' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(holder.db.state.savingsProducts).toHaveLength(1);
  });

  it('deletes an unused, non-default own-org product (200)', async () => {
    holder.db = makeFakeDb(seededScenario({
      savingsProducts: [baseProduct, { ...baseProduct, id: 'p2', code: 'FIX-2000', name: 'Fixed Deposit' }],
    }));
    const res = makeRes();
    await SavingsSettingController.deleteSetting(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products', id: 'p2' } }),
      res,
    );
    expect(res.json.mock.calls[0][0].success).toBe(true);
    expect(holder.db.state.savingsProducts).toHaveLength(1);
  });
});

// ===========================================================================
// Usage counts
// ===========================================================================
describe('SavingsSettingController usage counts', () => {
  it('reports product usage from savings accounts, org-scoped', async () => {
    holder.db = makeFakeDb(seededScenario({
      savingsAccounts: [
        { id: 'a1', organizationId: ORG_A, memberId: 'm-1', savingsProductId: 'p1' },
        { id: 'a2', organizationId: ORG_A, memberId: 'm-2', savingsProductId: 'p1' },
        { id: 'a3', organizationId: ORG_B, memberId: 'm-3', savingsProductId: 'p1' },
      ],
    }));
    const res = makeRes();
    await SavingsSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products' } }), res);
    expect(res.json.mock.calls[0][0][0].usageCount).toBe(2);
  });

  it('returns 0 usage when nothing references the product', async () => {
    holder.db = makeFakeDb(seededScenario({ savingsAccounts: [] }));
    const res = makeRes();
    await SavingsSettingController.getSettings(makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products' } }), res);
    expect(res.json.mock.calls[0][0][0].usageCount).toBe(0);
  });
});

// ===========================================================================
// Org default savings product
// ===========================================================================
describe('SavingsSettingController default savings product', () => {
  it('returns the org’s configured default product', async () => {
    holder.db = makeFakeDb(seededScenario());
    const res = makeRes();
    await SavingsSettingController.getDefaultProduct(makeReq(adminUser(ORG_A)), res);
    const body = res.json.mock.calls[0][0];
    expect(body.defaultSavingProductId).toBe('p1');
    expect(body.product.name).toBe('General Savings');
  });

  it('returns null default when the profile has none', async () => {
    holder.db = makeFakeDb(seededScenario({ organizationProfiles: [{ organizationId: ORG_A, defaultSavingProductId: null }] }));
    const res = makeRes();
    await SavingsSettingController.getDefaultProduct(makeReq(adminUser(ORG_A)), res);
    expect(res.json.mock.calls[0][0]).toEqual({ defaultSavingProductId: null, product: null });
  });

  it('rejects setting a default product from another org (403)', async () => {
    holder.db = makeFakeDb(seededScenario({ savingsProducts: [{ ...baseProduct, id: 'p-x', organizationId: ORG_B }] }));
    const res = makeRes();
    await SavingsSettingController.setDefaultProduct(
      makeReq(adminUser(ORG_A), { body: { defaultSavingProductId: 'p-x' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(authMock.updateOrganization).not.toHaveBeenCalled();
  });

  it('rejects setting a missing product (404)', async () => {
    holder.db = makeFakeDb(seededScenario({ savingsProducts: [] }));
    const res = makeRes();
    await SavingsSettingController.setDefaultProduct(
      makeReq(adminUser(ORG_A), { body: { defaultSavingProductId: 'p-missing' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects setting an inactive product (400)', async () => {
    holder.db = makeFakeDb(seededScenario({ savingsProducts: [{ ...baseProduct, isActive: false }] }));
    const res = makeRes();
    await SavingsSettingController.setDefaultProduct(
      makeReq(adminUser(ORG_A), { body: { defaultSavingProductId: 'p1' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(authMock.updateOrganization).not.toHaveBeenCalled();
  });

  it('sets an active org product as default, persists and audits', async () => {
    holder.db = makeFakeDb(seededScenario());
    const res = makeRes();
    await SavingsSettingController.setDefaultProduct(
      makeReq(adminUser(ORG_A), { body: { defaultSavingProductId: 'p1' } }),
      res,
    );
    expect(res.json.mock.calls[0][0].defaultSavingProductId).toBe('p1');
    expect(authMock.updateOrganization).toHaveBeenCalledWith(ORG_A, { defaultSavingProductId: 'p1' });
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Set Default Savings Product' && a.organizationId === ORG_A)).toBe(true);
  });

  it('clears the default with null', async () => {
    holder.db = makeFakeDb(seededScenario());
    const res = makeRes();
    await SavingsSettingController.setDefaultProduct(
      makeReq(adminUser(ORG_A), { body: { defaultSavingProductId: null } }),
      res,
    );
    expect(res.json.mock.calls[0][0].defaultSavingProductId).toBeNull();
    expect(authMock.updateOrganization).toHaveBeenCalledWith(ORG_A, { defaultSavingProductId: null });
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Clear Default Savings Product')).toBe(true);
  });
});

// ===========================================================================
// Reorder
// ===========================================================================
describe('SavingsSettingController reorder', () => {
  it('rejects a reorder that references another org’s record (403)', async () => {
    holder.db = makeFakeDb({ savingsProducts: [baseProduct] });
    const res = makeRes();
    await SavingsSettingController.reorderSettings(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products' }, body: { items: [{ id: 'p-foreign', sortOrder: 1 }] } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('applies an org-scoped reorder', async () => {
    holder.db = makeFakeDb({ savingsProducts: [baseProduct] });
    const res = makeRes();
    await SavingsSettingController.reorderSettings(
      makeReq(adminUser(ORG_A), { params: { entityType: 'savings-products' }, body: { items: [{ id: 'p1', sortOrder: 9 }] } }),
      res,
    );
    expect(res.json.mock.calls[0][0].success).toBe(true);
    expect(holder.db.state.savingsProducts[0].sortOrder).toBe(9);
  });

  it('rejects a reorder with duplicate ids (422)', async () => {
    holder.db = makeFakeDb({ savingsProducts: [baseProduct] });
    const res = makeRes();
    await SavingsSettingController.reorderSettings(
      makeReq(adminUser(ORG_A), {
        params: { entityType: 'savings-products' },
        body: { items: [{ id: 'p1', sortOrder: 1 }, { id: 'p1', sortOrder: 2 }] },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(422);
  });
});

// ===========================================================================
// Cheque books
// ===========================================================================
describe('SavingsSettingController cheque books', () => {
  const acc = { id: 'acc-1', organizationId: ORG_A, memberId: 'm-1', savingsProductId: 'p1', accountNo: 'SAV000001', branchId: 'br-1' };

  it('rejects issuing a book for another org’s account (404)', async () => {
    holder.db = makeFakeDb({ savingsAccounts: [{ ...acc, id: 'acc-x', organizationId: ORG_B }] });
    const res = makeRes();
    await SavingsSettingController.issueChequeBook(
      makeReq(adminUser(ORG_A), { body: { accountId: 'acc-x', leafCount: 25 } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(holder.db.state.savingsChequeBooks).toHaveLength(0);
  });

  it('issues a book for an own-org account and auto-creates the leaves', async () => {
    holder.db = makeFakeDb({ savingsAccounts: [acc] });
    const res = makeRes();
    await SavingsSettingController.issueChequeBook(
      makeReq(adminUser(ORG_A), { body: { accountId: 'acc-1', leafCount: 25 } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const book = holder.db.state.savingsChequeBooks[0];
    expect(book.bookNo).toMatch(/^CHQ-1-/);
    expect(book.firstLeafNo).toBe(1);
    expect(book.leafCount).toBe(25);
    expect(book.status).toBe('Issued');
    expect(holder.db.state.savingsChequeLeaves).toHaveLength(25);
    expect(holder.db.state.savingsChequeLeaves.every((l: any) => l.status === 'Available')).toBe(true);
    expect(holder.db.state.auditRows.some((a: any) => a.action === 'Issue Cheque Book')).toBe(true);
  });

  it('numbers the next book contiguously after leaves of the last book', async () => {
    holder.db = makeFakeDb({
      savingsAccounts: [acc],
      savingsChequeBooks: [{ id: 'cb1', organizationId: ORG_A, accountId: 'acc-1', accountNo: 'SAV000001', bookNo: 'CHQ-1-SAV', firstLeafNo: 1, leafCount: 25, issueDateBs: '2081-01-01', issueDateAd: new Date().toISOString(), issuedById: null, status: 'Issued', createdAt: new Date() }],
    });
    const res = makeRes();
    await SavingsSettingController.issueChequeBook(
      makeReq(adminUser(ORG_A), { body: { accountId: 'acc-1', leafCount: 25 } }),
      res,
    );
    const book = holder.db.state.savingsChequeBooks[1];
    expect(book.firstLeafNo).toBe(26);
    expect(book.bookNo).toMatch(/^CHQ-2-/);
  });

  it('cancels an own-org book and its unused leaves', async () => {
    holder.db = makeFakeDb({
      savingsChequeBooks: [{ id: 'cb1', organizationId: ORG_A, accountId: 'acc-1', accountNo: 'SAV000001', bookNo: 'CHQ-1', firstLeafNo: 1, leafCount: 25, issueDateBs: '2081-01-01', issueDateAd: new Date().toISOString(), issuedById: null, status: 'Issued', createdAt: new Date() }],
      savingsChequeLeaves: [
        { id: 'l1', organizationId: ORG_A, bookId: 'cb1', leafNo: 1, status: 'Available' },
        { id: 'l2', organizationId: ORG_A, bookId: 'cb1', leafNo: 2, status: 'Issued' },
        { id: 'l3', organizationId: ORG_A, bookId: 'cb1', leafNo: 3, status: 'Used' },
      ],
    });
    const res = makeRes();
    await SavingsSettingController.cancelChequeBook(
      makeReq(adminUser(ORG_A), { params: { id: 'cb1' } }),
      res,
    );
    expect(res.json.mock.calls[0][0].success).toBe(true);
    expect(holder.db.state.savingsChequeBooks[0].status).toBe('Cancelled');
    expect(holder.db.state.savingsChequeLeaves.find((l: any) => l.leafNo === 1).status).toBe('Cancelled');
    expect(holder.db.state.savingsChequeLeaves.find((l: any) => l.leafNo === 2).status).toBe('Cancelled');
    expect(holder.db.state.savingsChequeLeaves.find((l: any) => l.leafNo === 3).status).toBe('Used');
  });

  it('rejects cancelling another org’s book (403)', async () => {
    holder.db = makeFakeDb({
      savingsChequeBooks: [{ id: 'cb-x', organizationId: ORG_B, accountId: 'acc-9', accountNo: 'SAV0999', bookNo: 'CHQ-1', firstLeafNo: 1, leafCount: 25, issueDateBs: '2081-01-01', issueDateAd: new Date().toISOString(), issuedById: null, status: 'Issued', createdAt: new Date() }],
    });
    const res = makeRes();
    await SavingsSettingController.cancelChequeBook(
      makeReq(adminUser(ORG_A), { params: { id: 'cb-x' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(holder.db.state.savingsChequeBooks[0].status).toBe('Issued');
  });

  it('rejects cancelling an already-cancelled book (400)', async () => {
    holder.db = makeFakeDb({
      savingsChequeBooks: [{ id: 'cb1', organizationId: ORG_A, accountId: 'acc-1', accountNo: 'SAV000001', bookNo: 'CHQ-1', firstLeafNo: 1, leafCount: 25, issueDateBs: '2081-01-01', issueDateAd: new Date().toISOString(), issuedById: null, status: 'Cancelled', createdAt: new Date() }],
    });
    const res = makeRes();
    await SavingsSettingController.cancelChequeBook(
      makeReq(adminUser(ORG_A), { params: { id: 'cb1' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('lists cheque books scoped by org (and account filter)', async () => {
    holder.db = makeFakeDb({
      savingsChequeBooks: [
        { id: 'cb1', organizationId: ORG_A, accountId: 'acc-1', accountNo: 'SAV000001', bookNo: 'CHQ-1', firstLeafNo: 1, leafCount: 25, issueDateBs: '2081-01-01', issueDateAd: new Date().toISOString(), issuedById: null, status: 'Issued', createdAt: new Date() },
        { id: 'cb2', organizationId: ORG_A, accountId: 'acc-2', accountNo: 'SAV000002', bookNo: 'CHQ-1', firstLeafNo: 1, leafCount: 25, issueDateBs: '2081-01-01', issueDateAd: new Date().toISOString(), issuedById: null, status: 'Cancelled', createdAt: new Date('2026-01-02') },
        { id: 'cb-hack', organizationId: ORG_B, accountId: 'acc-9', accountNo: 'SAV0999', bookNo: 'HACK', firstLeafNo: 1, leafCount: 25, issueDateBs: '2081-01-01', issueDateAd: new Date().toISOString(), issuedById: null, status: 'Issued', createdAt: new Date() },
      ],
    });
    const res = makeRes();
    await SavingsSettingController.getChequeBooks(makeReq(adminUser(ORG_A)), res);
    const rows = res.json.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows.every((r: any) => r.organizationId === ORG_A)).toBe(true);
  });
});

// ===========================================================================
// Pure opening-amount computation
// ===========================================================================
describe('computeOpeningAmount', () => {
  it('uses minDeposit when an opening deposit is required', () => {
    expect(computeOpeningAmount({ openingDepositRequired: true, minDeposit: 1000 }))
      .toEqual({ openingAmount: 1000 });
  });

  it('yields zero when no opening deposit is required even with a minDeposit', () => {
    expect(computeOpeningAmount({ openingDepositRequired: false, minDeposit: 5000 }))
      .toEqual({ openingAmount: 0 });
  });

  it('yields zero when minDeposit is zero or absent', () => {
    expect(computeOpeningAmount({ openingDepositRequired: true, minDeposit: 0 }))
      .toEqual({ openingAmount: 0 });
    expect(computeOpeningAmount({}))
      .toEqual({ openingAmount: 0 });
  });

  it('handles numeric-string minDeposit inputs', () => {
    expect(computeOpeningAmount({ openingDepositRequired: true, minDeposit: '250.75' }))
      .toEqual({ openingAmount: 250.75 });
  });
});

// ===========================================================================
// Auto-provisioning service
// ===========================================================================
describe('SavingsProvisioningService', () => {
  const service = () => new SavingsProvisioningService();

  it('skips gracefully when the DB is unavailable', async () => {
    holder.db = null;
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result).toEqual({ skipped: true, reason: 'no-db' });
  });

  it('skips when the org has no default savings product', async () => {
    holder.db = makeFakeDb(seededScenario({ organizationProfiles: [{ organizationId: ORG_A, defaultSavingProductId: null }] }));
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('no-default-product');
    expect(holder.db.state.savingsProvisioningQueue).toHaveLength(0);
  });

  it('records a Failed queue row when the default product is missing', async () => {
    holder.db = makeFakeDb(seededScenario({ savingsProducts: [] }));
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('product-not-found');
    const queued = holder.db.state.savingsProvisioningQueue[0];
    expect(queued.status).toBe('Failed');
    expect(queued.errorMessage).toBe('Savings Product not found.');
  });

  it('records a Failed queue row when the default product is inactive', async () => {
    holder.db = makeFakeDb(seededScenario({ savingsProducts: [{ ...baseProduct, isActive: false }] }));
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.reason).toBe('product-inactive');
    expect(holder.db.state.savingsProvisioningQueue[0].status).toBe('Failed');
    expect(holder.db.state.savingsProvisioningQueue[0].errorMessage).toBe('Default Savings Product is inactive.');
  });

  it('records a Failed queue row when the member has no branch', async () => {
    holder.db = makeFakeDb(seededScenario());
    const result = await service().provisionForMember(ORG_A, { ...provisionMember, branchId: null });
    expect(result.reason).toBe('no-branch');
    expect(holder.db.state.savingsProvisioningQueue[0].status).toBe('Failed');
    expect(savingsServiceMock.openAccount).not.toHaveBeenCalled();
  });

  it('skips idempotently when the member already has an account for the product', async () => {
    holder.db = makeFakeDb(seededScenario({
      savingsAccounts: [{ id: 'acc-existing', organizationId: ORG_A, memberId: 'm-1', savingsProductId: 'p1', branchId: 'br-1' }],
    }));
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('already-opened');
    expect(savingsServiceMock.openAccount).not.toHaveBeenCalled();
    const queued = holder.db.state.savingsProvisioningQueue[0];
    expect(queued.status).toBe('Success');
    expect(queued.openedAccountId).toBe('acc-existing');
  });

  it('skips idempotently when (member, product) already provisioned successfully', async () => {
    holder.db = makeFakeDb(seededScenario({
      savingsProvisioningQueue: [{
        id: 'q1', organizationId: ORG_A, memberId: 'm-1', memberNo: 'MBR-0001',
        savingsProductId: 'p1', status: 'Success', attempts: 1,
        openedAccountId: 'acc-1', openedVoucherNo: 'OPN-123', errorMessage: null, resolvedAt: new Date(),
      }],
    }));
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('already-provisioned');
    expect(result.accountId).toBe('acc-1');
    expect(savingsServiceMock.openAccount).not.toHaveBeenCalled();
  });

  it('opens an account via SavingsService and posts the opening deposit', async () => {
    holder.db = makeFakeDb(seededScenario({ savingsProducts: [{ ...baseProduct, minDeposit: '1000.00' }] }));
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.opened).toBe(true);
    expect(result.openingAmount).toBe(1000);
    expect(result.accountId).toBe('acc-1');
    expect(savingsServiceMock.openAccount).toHaveBeenCalledTimes(1);
    const data = savingsServiceMock.openAccount.mock.calls[0][0];
    expect(data.memberId).toBe('m-1');
    expect(data.savingsProductId).toBe('p1');
    expect(data.openedVia).toBe('auto');

    const txn = holder.db.state.savingsTransactions[0];
    expect(txn.type).toBe('Deposit');
    expect(txn.amount).toBe('1000');
    expect(txn.remarks).toBe('Auto-opening deposit — Member Registration');
    expect(txn.accountId).toBe('acc-1');

    const queued = holder.db.state.savingsProvisioningQueue[0];
    expect(queued.status).toBe('Success');
    expect(queued.openedAccountId).toBe('acc-1');
    expect(queued.openedVoucherNo).toBe(result.voucherNo);
    expect(queued.openedVoucherNo).toMatch(/^OPN-/);
  });

  it('skips the opening deposit when the product does not require one', async () => {
    holder.db = makeFakeDb(seededScenario({
      savingsProducts: [{ ...baseProduct, openingDepositRequired: false, minDeposit: '5000.00' }],
    }));
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.opened).toBe(true);
    expect(result.openingAmount).toBe(0);
    expect(result.voucherNo).toBeNull();
    expect(holder.db.state.savingsTransactions).toHaveLength(0);
    expect(holder.db.state.savingsProvisioningQueue[0].status).toBe('Success');
  });

  it('records a Failed queue row and never throws when account opening fails', async () => {
    holder.db = makeFakeDb(seededScenario());
    savingsServiceMock.openAccount.mockRejectedValue(new Error('boom'));
    const result = await service().provisionForMember(ORG_A, provisionMember);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('error');
    expect(result.error).toBe('boom');
    const queued = holder.db.state.savingsProvisioningQueue[0];
    expect(queued.status).toBe('Failed');
    expect(queued.errorMessage).toBe('boom');
  });
});