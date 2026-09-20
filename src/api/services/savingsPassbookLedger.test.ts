/**
 * Passbook ledger contract regression tests.
 *
 * The Passbook Printing Console renders REAL account ledger rows instead of
 * mock data. These tests lock the `SavingsDepositService.getLedger` /
 * `getUnprintedTransactions` shape the modal depends on:
 *   bsDate, dateAd, voucherNo, particulars, debit, credit, running balance,
 *   and tellerName — computed chronologically from savings_transactions.
 */
import { describe, it, expect, vi } from 'vitest';
import { makeFakeDb } from '../test/fakeDb';
import { SavingsDepositService } from './SavingsDepositService';

const holder = vi.hoisted(() => ({ db: null as any }));

vi.mock('../../db/client', () => ({
  getDb: () => holder.db,
  closeDb: () => {},
  checkDbHealth: () => false,
}));

const ORG = '11111111-1111-1111-1111-111111111111';
const BRANCH = '22222222-2222-2222-2222-222222222222';
const ACCOUNT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MEMBER = '33333333-3333-3333-3333-333333333333';

const accountRow = {
  id: ACCOUNT,
  organizationId: ORG,
  branchId: BRANCH,
  accountNo: 'SAV-D3C-0001',
  memberId: MEMBER,
  memberName: 'Madhavi Dahit',
  memberNo: 'MBR-2083-0006',
  balance: '200.00',
  minBalance: '0.00',
  status: 'Active',
  openedDateBs: '2083-04-29',
  lastTransactionDateBs: '2083-04-30',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function txnRow(overrides: Record<string, any> = {}): any {
  return {
    id: `txn-${Math.random().toString(36).slice(2, 10)}`,
    organizationId: ORG,
    accountId: ACCOUNT,
    accountNo: 'SAV-D3C-0001',
    memberId: MEMBER,
    memberName: 'Madhavi Dahit',
    type: 'Deposit',
    amount: '100.00',
    balanceAfter: '100.00',
    voucherNo: 'VCH-73085181',
    dateBs: '2083-04-29',
    dateAd: '2026-08-14',
    tellerName: 'Teller',
    remarks: 'Opening deposit',
    paymentMode: 'Cash',
    branchId: BRANCH,
    createdAt: new Date('2026-08-14T00:00:00Z'),
    ...overrides,
  };
}

describe('SavingsDepositService.getLedger (passbook data contract)', () => {
  it('maps real transaction rows to passbook lines with teller + AD date', async () => {
    holder.db = makeFakeDb({
      savingsAccounts: [accountRow],
      savingsTransactions: [
        txnRow(),
        txnRow({
          amount: '100.00',
          balanceAfter: '200.00',
          voucherNo: 'VCH-73085182',
          dateBs: '2083-04-30',
          dateAd: '2026-08-15',
          tellerName: 'Pooja',
          remarks: 'Second Deposit',
        }),
      ],
    });

    const service = new SavingsDepositService();
    const ledger = await service.getLedger(ACCOUNT, ORG, undefined, {});

    expect(ledger.accountNumber).toBe('SAV-D3C-0001');
    expect(ledger.memberName).toBe('Madhavi Dahit');
    expect(ledger.openingBalance).toBe(0);
    expect(ledger.closingBalance).toBe(200);
    expect(ledger.entries).toHaveLength(2);

    expect(ledger.entries[0]).toMatchObject({
      bsDate: '2083-04-29',
      dateAd: '2026-08-14',
      voucherNo: 'VCH-73085181',
      particulars: 'Opening deposit',
      debit: 0,
      credit: 100,
      balance: 100,
      tellerName: 'Teller',
    });
    expect(ledger.entries[1]).toMatchObject({
      bsDate: '2083-04-30',
      dateAd: '2026-08-15',
      voucherNo: 'VCH-73085182',
      particulars: 'Second Deposit',
      debit: 0,
      credit: 100,
      balance: 200,
      tellerName: 'Pooja',
    });
  });

  it('produces a running balance sequence matching the account closing balance', async () => {
    holder.db = makeFakeDb({
      savingsAccounts: [{ ...accountRow, balance: '150.00' }],
      savingsTransactions: [
        txnRow({ amount: '100.00', balanceAfter: '100.00', voucherNo: 'VCH-73085181', dateBs: '2083-04-29', dateAd: '2026-08-14', tellerName: 'Teller', remarks: 'Opening deposit' }),
        txnRow({ type: 'Withdrawal', amount: '50.00', balanceAfter: '50.00', voucherNo: 'VCH-73085190', dateBs: '2083-05-01', dateAd: '2026-08-16', tellerName: 'Pooja', remarks: 'By Cash Withdrawal' }),
        txnRow({ amount: '100.00', balanceAfter: '150.00', voucherNo: 'VCH-73085191', dateBs: '2083-05-05', dateAd: '2026-08-20', tellerName: 'Admin', remarks: 'By Cash Deposit' }),
      ],
    });

    const service = new SavingsDepositService();
    const ledger = await service.getLedger(ACCOUNT, ORG, undefined, {});

    expect(ledger.openingBalance).toBe(0);
    expect(ledger.entries.map((e) => e.balance)).toEqual([100, 50, 150]);
    expect(ledger.entries.map((e) => e.tellerName)).toEqual(['Teller', 'Pooja', 'Admin']);
    expect(ledger.entries[ledger.entries.length - 1].balance).toBe(ledger.closingBalance);
  });
});
