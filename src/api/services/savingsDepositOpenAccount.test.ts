/**
 * SavingsDepositService.openAccount regression tests (Module 4 / Savings Ledger).
 *
 * Guards against the opening-deposit double-count bug: the account was created
 * with `balance = openingDeposit` AND an opening-deposit voucher was posted, so
 * the ledger closing balance doubled (100 + 100 = 200). The account must now
 * open at zero and the single "Opening deposit" voucher must be the sole driver
 * of the balance (0 → 100).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeFakeDb } from '../test/fakeDb';
import { SavingsDepositService } from './SavingsDepositService';
import { SavingsRepository } from '../repositories/SavingsRepository';

const mocks = vi.hoisted(() => ({
  memberFindById: vi.fn(),
  postSavingsVoucher: vi.fn(),
  resolveCashBankAccount: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock('../../db/client', () => ({
  getDb: () => holder.db,
  closeDb: () => {},
  checkDbHealth: () => false,
}));

vi.mock('./SavingsGlService', () => ({
  postSavingsVoucher: mocks.postSavingsVoucher,
  resolveSystemAccount: vi.fn().mockResolvedValue(null),
  resolveCashBankAccount: mocks.resolveCashBankAccount,
}));

vi.mock('../utils/audit', () => ({
  buildAuditRow: vi.fn(() => ({})),
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock('../repositories/MemberRepository', () => ({
  MemberRepository: class {
    findById = mocks.memberFindById;
  },
}));

const holder = vi.hoisted(() => ({ db: null as any }));

const ORG = '11111111-1111-1111-1111-111111111111';
const BRANCH = '22222222-2222-2222-2222-222222222222';
const MEMBER = '33333333-3333-3333-3333-333333333333';
const PRODUCT = '44444444-4444-4444-4444-444444444444';
const GL_LIABILITY = '55555555-5555-5555-5555-555555555555';

const productRow = {
  id: PRODUCT,
  organizationId: ORG,
  name: 'Regular Savings',
  productType: 'regular',
  isActive: true,
  openingDepositRequired: true,
  minDeposit: '100.00',
  minBalance: '0.00',
  interestRate: '5.50',
  requiresKycVerified: false,
  requiresNominee: false,
  glLiabilityAccountId: GL_LIABILITY,
  accountNoPrefix: 'SAV',
  chequeEnabled: false,
  sortOrder: 1,
};

const liabilityRow = {
  id: GL_LIABILITY,
  organizationId: ORG,
  code: '205001',
  name: 'Member Savings',
  type: 'liability',
  balance: '0',
  allowPosting: true,
};

const member = {
  id: MEMBER,
  fullName: 'Sita Sharma',
  memberNo: 'M-001',
  kycStatus: 'Verified',
  nomineeName: null,
};

let createSpy: any;

beforeEach(() => {
  holder.db = makeFakeDb({
    savingsProducts: [productRow],
    chartOfAccounts: [liabilityRow],
  });
  mocks.memberFindById.mockResolvedValue(member);
  mocks.postSavingsVoucher.mockResolvedValue({ voucher: { voucherNo: 'GLV-1001' } });
  mocks.resolveCashBankAccount.mockResolvedValue({
    id: 'gl-cash', code: 'CASH', name: 'Cash Account', type: 'asset', balance: '0', allowPosting: true,
  });
  mocks.writeAuditLog.mockResolvedValue(undefined);
  createSpy = vi.spyOn(SavingsRepository.prototype, 'create')
    .mockImplementation(async (data: any) => {
      const row = { ...data, id: 'acc-1', createdAt: new Date(), updatedAt: new Date() };
      holder.db.state.savingsAccounts.push(row);
      return row;
    });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SavingsDepositService.openAccount (opening deposit)', () => {
  it('opens at zero and lets the opening deposit drive the balance 0 → 100', async () => {
    const service = new SavingsDepositService();
    const result = await service.openAccount(
      { memberId: MEMBER, schemeId: PRODUCT, openingDeposit: 100, depositSource: 'cash', bsDate: '2083-01-01' },
      ORG,
      BRANCH,
      { userId: 'u1', username: 'Teller', roleId: 'r1' } as any
    );

    expect(result.openingDeposit).toBe(100);

    // 1. The account is created at zero — the opening deposit must be the sole driver.
    expect(createSpy.mock.calls[0][0].balance).toBe('0');

    // 2. One deposit voucher drives the balance from 0 to 100 (never 200).
    const [account] = holder.db.state.savingsAccounts;
    expect(account.balance).toBe('100');

    const txns = holder.db.state.savingsTransactions;
    expect(txns).toHaveLength(1);
    expect(txns[0].type).toBe('Deposit');
    expect(txns[0].amount).toBe('100');
    expect(txns[0].balanceAfter).toBe('100');

    // 3. The ledger statement reconciles: opening 0, closing 100.
    const ledger = await service.getLedger(result.accountId, ORG, undefined, {});
    expect(ledger.openingBalance).toBe(0);
    expect(ledger.closingBalance).toBe(100);
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0].credit).toBe(100);
    expect(ledger.entries[0].balance).toBe(100);
  });

  it('opens at zero when no opening deposit is taken', async () => {
    holder.db = makeFakeDb({
      savingsProducts: [{ ...productRow, openingDepositRequired: false }],
      chartOfAccounts: [liabilityRow],
    });
    const service = new SavingsDepositService();
    const result = await service.openAccount(
      { memberId: MEMBER, schemeId: PRODUCT, openingDeposit: 0, depositSource: 'cash', bsDate: '2083-01-01' },
      ORG,
      BRANCH,
      { userId: 'u1', username: 'Teller', roleId: 'r1' } as any
    );

    expect(result.openingDeposit).toBe(0);
    expect(createSpy.mock.calls[0][0].balance).toBe('0');

    const [account] = holder.db.state.savingsAccounts;
    expect(account.balance).toBe('0');
    expect(holder.db.state.savingsTransactions).toHaveLength(0);

    const ledger = await service.getLedger(result.accountId, ORG, undefined, {});
    expect(ledger.openingBalance).toBe(0);
    expect(ledger.closingBalance).toBe(0);
    expect(ledger.entries).toHaveLength(0);
  });
});
