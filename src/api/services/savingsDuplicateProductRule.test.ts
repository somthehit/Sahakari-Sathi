/**
 * Business rule regression tests: "A member is allowed to have ONLY ONE active
 * account per Savings Product."
 *
 * Covers both account-opening services:
 *  - SavingsDepositService.openAccount  (teller flow — POST /savings/accounts/open)
 *  - SavingsService.openAccount         (admin + auto-provisioning flow)
 *
 * The rule must reject when an Active account already exists for the same
 * (member, product), while Dormant / Closed / Matured accounts never block
 * opening a fresh account.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeFakeDb } from '../test/fakeDb';
import { SavingsDepositService } from './SavingsDepositService';
import { SavingsService } from './SavingsService';
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

function activeAccountRow(accountNo: string, status: string) {
  return {
    id: `acc-${accountNo}`,
    organizationId: ORG,
    accountNo,
    memberId: MEMBER,
    memberName: 'Sita Sharma',
    memberNo: 'M-001',
    savingsProductId: PRODUCT,
    productType: 'regular',
    productName: 'Regular Savings',
    interestRate: '5.50',
    balance: '0',
    minBalance: '0.00',
    openedDateBs: '2083-01-01',
    branchId: BRANCH,
    status,
    openedVia: 'manual',
    lastTransactionDateBs: '2083-01-01',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  holder.db = makeFakeDb({ savingsProducts: [productRow], chartOfAccounts: [liabilityRow] });
  mocks.memberFindById.mockResolvedValue(member);
  mocks.postSavingsVoucher.mockResolvedValue({ voucher: { voucherNo: 'GLV-1001' } });
  mocks.resolveCashBankAccount.mockResolvedValue({
    id: 'gl-cash', code: 'CASH', name: 'Cash Account', type: 'asset', balance: '0', allowPosting: true,
  });
  mocks.writeAuditLog.mockResolvedValue(undefined);
  vi.spyOn(SavingsRepository.prototype, 'create')
    .mockImplementation(async (data: any) => {
      const row = { ...data, id: 'acc-new', createdAt: new Date(), updatedAt: new Date() };
      holder.db.state.savingsAccounts.push(row);
      return row;
    });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ONE active account per member per savings product', () => {
  it('SavingsDepositService.openAccount rejects when an Active account already exists', async () => {
    holder.db.state.savingsAccounts.push(activeAccountRow('SAV-D3C-0001', 'Active'));

    const service = new SavingsDepositService();
    const promise = service.openAccount(
      { memberId: MEMBER, schemeId: PRODUCT, openingDeposit: 100, depositSource: 'cash', bsDate: '2083-01-01' },
      ORG,
      BRANCH,
      { userId: 'u1', username: 'Teller', roleId: 'r1' } as any,
    );

    await expect(promise).rejects.toThrow(
      'Member already possesses an active account for this savings product.'
    );
    // No second account was created.
    expect(holder.db.state.savingsAccounts).toHaveLength(1);
  });

  it('SavingsDepositService.openAccount allows a fresh account once the prior one is Closed', async () => {
    holder.db.state.savingsAccounts.push(activeAccountRow('SAV-D3C-0001', 'Closed'));

    const service = new SavingsDepositService();
    const result = await service.openAccount(
      { memberId: MEMBER, schemeId: PRODUCT, openingDeposit: 100, depositSource: 'cash', bsDate: '2083-01-01' },
      ORG,
      BRANCH,
      { userId: 'u1', username: 'Teller', roleId: 'r1' } as any,
    );

    expect(result.accountNumber).toBeTruthy();
    expect(holder.db.state.savingsAccounts).toHaveLength(2);
  });

  it('SavingsService.openAccount rejects when an Active account already exists (admin/provisioning path)', async () => {
    holder.db.state.savingsAccounts.push(activeAccountRow('SAV-D3C-0001', 'Active'));

    const service = new SavingsService();
    const promise = service.openAccount(
      {
        organizationId: ORG,
        accountNo: '',
        memberId: MEMBER,
        memberName: member.fullName,
        memberNo: member.memberNo,
        savingsProductId: PRODUCT,
        productType: 'regular',
        productName: 'Regular Savings',
        interestRate: '5.50',
        minBalance: '0.00',
        openedDateBs: '2083-01-01',
        lastTransactionDateBs: '2083-01-01',
        branchId: BRANCH,
        openedVia: 'auto',
        status: 'Active',
      },
      ORG,
    );

    await expect(promise).rejects.toThrow(
      'Member already possesses an active account for this savings product.'
    );
    expect(holder.db.state.savingsAccounts).toHaveLength(1);
  });

  it('SavingsService.openAccount ignores Dormant/Closed accounts for the same product', async () => {
    holder.db.state.savingsAccounts.push(activeAccountRow('SAV-D3C-0001', 'Dormant'));

    const service = new SavingsService();
    const account = await service.openAccount(
      {
        organizationId: ORG,
        accountNo: '',
        memberId: MEMBER,
        memberName: member.fullName,
        memberNo: member.memberNo,
        savingsProductId: PRODUCT,
        productType: 'regular',
        productName: 'Regular Savings',
        interestRate: '5.50',
        minBalance: '0.00',
        openedDateBs: '2083-01-01',
        lastTransactionDateBs: '2083-01-01',
        branchId: BRANCH,
        openedVia: 'auto',
        status: 'Active',
      },
      ORG,
    );

    expect(account).toBeTruthy();
    expect(account.accountNo).toMatch(/^SAV-/);
    expect(holder.db.state.savingsAccounts).toHaveLength(2);
  });
});
