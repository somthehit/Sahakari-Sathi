/**
 * Members Directory balance aggregation regression tests.
 *
 * The Members Directory (and master-data bootstrap) must surface LIVE account
 * balances, not the stale hardcoded member_financial_profiles columns. These
 * tests compile the member projection produced by MemberRepository and
 * MasterDataRepository and assert it:
 *   1. keeps the totalSavingsBalance / totalLoanBalance API contract, and
 *   2. computes them from Active savings_accounts.balance sums and Disbursed
 *      loan_accounts.outstanding_principal sums (org-scoped correlated subqueries).
 */
import { describe, it, expect, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { MemberRepository } from '../repositories/MemberRepository';
import { MasterDataRepository } from '../repositories/MasterDataRepository';

const holder = vi.hoisted(() => ({ db: null as any, captured: [] as any[] }));

vi.mock('../../db/client', () => ({
  getDb: () => holder.db,
  closeDb: () => {},
  checkDbHealth: () => false,
}));

const ORG_A = '11111111-1111-1111-1111-111111111111';

function captureDb() {
  holder.captured = [];
  const chain = {
    leftJoin: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    then: (res: (rows: any[]) => any) => Promise.resolve([]).then(res),
  };
  holder.db = {
    select: (sel?: any) => {
      if (sel && typeof sel === 'object') holder.captured.push(sel);
      return { from: () => chain };
    },
    transaction: (fn: any) => Promise.resolve(fn(holder.db)),
  };
}

function findMemberProjection(projections: any[]): any {
  const p = projections.find((x) => x && 'totalSavingsBalance' in x && 'totalLoanBalance' in x);
  expect(p, 'member projection with balance fields should be emitted').toBeDefined();
  return p;
}

const sqlOf = (expr: any) => new PgDialect().sqlToQuery(expr).sql;

describe('MemberRepository member projection', () => {
  it('aggregates Active savings balances and Disbursed loan principal instead of static columns', async () => {
    captureDb();
    await new MemberRepository().findAll({ organizationId: ORG_A });

    const projection = findMemberProjection(holder.captured);
    const savingsSql = sqlOf(projection.totalSavingsBalance);
    const loanSql = sqlOf(projection.totalLoanBalance);

    expect(savingsSql).toMatch(/SUM\("savings_accounts"\."balance"\)/);
    expect(savingsSql).toMatch(/"savings_accounts"\."member_id"\s*=\s*"members"\."id"/);
    expect(savingsSql).toMatch(/"savings_accounts"\."organization_id"\s*=\s*"members"\."organization_id"/);
    expect(savingsSql).toMatch(/"savings_accounts"\."status"\s*=\s*'Active'/);

    expect(loanSql).toMatch(/SUM\("loan_accounts"\."outstanding_principal"\)/);
    expect(loanSql).toMatch(/"loan_accounts"\."member_id"\s*=\s*"members"\."id"/);
    expect(loanSql).toMatch(/"loan_accounts"\."organization_id"\s*=\s*"members"\."organization_id"/);
    expect(loanSql).toMatch(/"loan_accounts"\."status"\s*=\s*'Disbursed'/);

    expect(loanSql).not.toMatch(/member_financial_profiles/);
    expect(savingsSql).not.toMatch(/member_financial_profiles/);
  });
});

describe('MasterDataRepository member projection', () => {
  it('aggregates live balances in the master-data bootstrap', async () => {
    captureDb();
    await new MasterDataRepository().getAll(ORG_A);

    const projection = findMemberProjection(holder.captured);
    const savingsSql = sqlOf(projection.totalSavingsBalance);
    const loanSql = sqlOf(projection.totalLoanBalance);

    expect(savingsSql).toMatch(/SUM\("savings_accounts"\."balance"\)/);
    expect(savingsSql).toMatch(/"savings_accounts"\."status"\s*=\s*'Active'/);
    expect(loanSql).toMatch(/SUM\("loan_accounts"\."outstanding_principal"\)/);
    expect(loanSql).toMatch(/"loan_accounts"\."status"\s*=\s*'Disbursed'/);
  });
});
