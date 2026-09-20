/**
 * Savings Account Statement tests (Module 4 / Savings & Deposits).
 *
 * Covers the Account Statements feature end-to-end at the service layer:
 *   1. `computeSavingsStatement` ledger math — opening/closing balance, running
 *      balance, deposit/withdrawal totals (including interest postings).
 *   2. Repository date-range + type filtering against the fake in-memory DB.
 *   3. Service scoping — a branch-scoped user cannot read another branch's
 *      account, and the statement respects org + branch filters.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeDb } from '../test/fakeDb';
import { SavingsRepository } from '../repositories/SavingsRepository';
import { SavingsService, computeSavingsStatement } from './SavingsService';
import type { SavingsStatementResult } from './SavingsService';

const holder = vi.hoisted(() => ({ db: null as any }));

vi.mock('../../db/client', () => ({
  getDb: () => holder.db,
  closeDb: () => {},
  checkDbHealth: () => false,
}));

const ORG_A = '11111111-1111-1111-1111-111111111111';
const ORG_B = '22222222-2222-2222-2222-222222222222';
const ACCOUNT = 'aaaa0000-0000-0000-0000-000000000001';
const ACCOUNT_OTHER_BRANCH = 'aaaa0000-0000-0000-0000-000000000002';
const MEMBER = 'bbbb0000-0000-0000-0000-000000000001';
const BRANCH_1 = 'cccc0000-0000-0000-0000-000000000001';
const BRANCH_2 = 'cccc0000-0000-0000-0000-000000000002';

function accountRow(overrides: Record<string, any> = {}) {
  return {
    id: ACCOUNT,
    organizationId: ORG_A,
    accountNo: 'SAV-101-0001',
    memberId: MEMBER,
    memberName: 'Sita Sharma',
    memberNo: 'M-001',
    savingsProductId: null,
    productType: 'regular',
    productName: 'Regular Savings',
    interestRate: '5.5000',
    balance: '15000.00',
    minBalance: '500.00',
    openedDateBs: '2081-01-01',
    maturityDateBs: null,
    monthlyInstallment: null,
    branchId: BRANCH_1,
    collectionRouteId: null,
    status: 'Active',
    openedVia: 'manual',
    lastTransactionDateBs: '2083-04-15',
    createdAt: new Date('2024-05-01T00:00:00Z'),
    updatedAt: new Date('2026-08-14T00:00:00Z'),
    ...overrides,
  };
}

function txnRow(overrides: Record<string, any> = {}): any {
  return {
    id: `txn-${Math.random().toString(36).slice(2, 10)}`,
    organizationId: ORG_A,
    accountId: ACCOUNT,
    accountNo: 'SAV-101-0001',
    memberId: MEMBER,
    memberName: 'Sita Sharma',
    type: 'Deposit',
    amount: '1000.00',
    balanceAfter: '16000.00',
    voucherNo: 'VCH-2083-1001',
    dateBs: '2083-04-01',
    dateAd: '2026-07-17',
    tellerName: 'Teller',
    remarks: 'By Cash Deposit',
    paymentMode: 'Cash',
    branchId: BRANCH_1,
    createdAt: new Date('2026-07-17T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  holder.db = makeFakeDb();
});

describe('computeSavingsStatement (ledger math)', () => {
  it('computes opening/closing, running balance and totals', () => {
    const account = { balance: '15000.00' };
    const txns = [
      txnRow({ type: 'Withdrawal', amount: '2000.00', balanceAfter: '13000.00', dateBs: '2083-04-02' }),
      txnRow({ type: 'Deposit', amount: '5000.00', balanceAfter: '18000.00', dateBs: '2083-04-10' }),
      txnRow({ type: 'Interest_Posting', amount: '250.00', balanceAfter: '18250.00', dateBs: '2083-06-30' }),
    ];

    const result = computeSavingsStatement(account, txns);

    // closing (current) = 15000, net = +5000 -2000 +250 → opening = 15000 - 3250 = 11750
    expect(result.openingBalance).toBe(11750);
    expect(result.totalDeposits).toBe(5250); // 5000 + 250 interest credit
    expect(result.totalWithdrawals).toBe(2000);
    expect(result.closingBalance).toBe(15000);
    expect(result.transactions.map((t) => t.runningBalance)).toEqual([9750, 14750, 15000]);
  });

  it('computes running balances from allTransactions even when displayTransactions is filtered by type', () => {
    const account = { balance: '15000.00' };
    const t1 = txnRow({ id: 't1', type: 'Withdrawal', amount: '2000.00', dateBs: '2083-04-02' });
    const t2 = txnRow({ id: 't2', type: 'Deposit', amount: '5000.00', dateBs: '2083-04-10' });
    const t3 = txnRow({ id: 't3', type: 'Interest_Posting', amount: '250.00', dateBs: '2083-06-30' });
    const allTransactions = [t1, t2, t3];
    const displayTransactions = [t2]; // Filtered to deposits only

    const result = computeSavingsStatement(account, allTransactions, displayTransactions);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].id).toBe('t2');
    expect(result.transactions[0].runningBalance).toBe(14750); // 11750 - 2000 + 5000
  });

  it('is stable for an empty ledger', () => {
    const result = computeSavingsStatement({ balance: '0' }, []);
    expect(result).toEqual({
      transactions: [],
      openingBalance: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      closingBalance: 0,
    });
  });
});

describe('SavingsRepository.getTransactions (filtering)', () => {
  it('filters by date range and transaction type', async () => {
    holder.db = makeFakeDb({
      savingsTransactions: [
        txnRow({ type: 'Deposit', amount: '1000.00', dateBs: '2083-01-05', createdAt: new Date('2026-04-05T00:00:00Z') }),
        txnRow({ type: 'Withdrawal', amount: '500.00', dateBs: '2083-02-10', createdAt: new Date('2026-05-10T00:00:00Z') }),
        txnRow({ type: 'Deposit', amount: '2000.00', dateBs: '2083-03-15', createdAt: new Date('2026-06-15T00:00:00Z') }),
        txnRow({ type: 'Interest_Posting', amount: '120.00', dateBs: '2083-04-01', createdAt: new Date('2026-07-01T00:00:00Z') }),
      ],
    });

    const repo = new SavingsRepository();
    const result = await repo.getTransactions(ACCOUNT, ORG_A, undefined, {
      dateFromBs: '2083-02-01',
      dateToBs: '2083-03-31',
      type: 'Deposit',
    });

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe('2000.00');
  });

  it('honours strict branch scope', async () => {
    holder.db = makeFakeDb({
      savingsTransactions: [
        txnRow({ branchId: BRANCH_1, dateBs: '2083-01-05' }),
        txnRow({ branchId: BRANCH_2, dateBs: '2083-01-06' }),
      ],
    });

    const repo = new SavingsRepository();
    const result = await repo.getTransactions(ACCOUNT, ORG_A, [BRANCH_1]);

    expect(result).toHaveLength(1);
    expect(result[0].branchId).toBe(BRANCH_1);
  });
});

describe('SavingsService.getAccountStatement', () => {
  it('returns account + computed statement for an org-scoped account', async () => {
    holder.db = makeFakeDb({
      savingsAccounts: [accountRow()],
      savingsTransactions: [
        txnRow({ type: 'Deposit', amount: '5000.00', dateBs: '2083-02-10' }),
        txnRow({ type: 'Withdrawal', amount: '2000.00', dateBs: '2083-03-01' }),
      ],
    });

    const service = new SavingsService();
    const statement: SavingsStatementResult = await service.getAccountStatement(ACCOUNT, ORG_A);

    expect(statement.account.id).toBe(ACCOUNT);
    expect(statement.transactions).toHaveLength(2);
    expect(statement.closingBalance).toBe(15000);
    expect(statement.openingBalance).toBe(12000); // 15000 - 5000 + 2000
    expect(statement.totalDeposits).toBe(5000);
    expect(statement.totalWithdrawals).toBe(2000);
  });

  it('rejects an account from another branch for a branch-scoped user', async () => {
    holder.db = makeFakeDb({
      savingsAccounts: [accountRow(), accountRow({ id: ACCOUNT_OTHER_BRANCH, accountNo: 'SAV-101-0002', branchId: BRANCH_2 })],
    });

    const service = new SavingsService();
    await expect(service.getAccountStatement(ACCOUNT_OTHER_BRANCH, ORG_A, [BRANCH_1]))
      .rejects.toThrow('Savings account not found');
  });

  it('does not leak cross-org accounts', async () => {
    holder.db = makeFakeDb({
      savingsAccounts: [accountRow({ organizationId: ORG_B, id: ACCOUNT_OTHER_BRANCH })],
    });

    const service = new SavingsService();
    await expect(service.getAccountStatement(ACCOUNT_OTHER_BRANCH, ORG_A))
      .rejects.toThrow('Savings account not found');
  });
});
