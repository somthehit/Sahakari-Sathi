/**
 * Shared ledger helpers.
 * - upsertLedgerEntry: keeps the aggregated ledgers table in sync
 * - computeRunningBalance: returns per-entry running balance for voucher_entries
 * - computeRunningBalancesForEntries: batch-computes running balances for all
 *   entries of a voucher, correctly chaining entries that affect the same account.
 * - setRunningBalanceRaw: writes running_balance via raw SQL (column not in Drizzle schema)
 */
import { and, eq, desc, sql } from 'drizzle-orm';
import { ledgers, chartOfAccounts, voucherEntries } from '../../db/schema';
import type { DbExecutor } from '../../db/client';

function round4(n: number): number { return Math.round(n * 10000) / 10000; }

function isAssetExpense(type: string): boolean {
  return ['Asset', 'Expense'].includes(type);
}

/**
 * Compute running balance for a single entry given the previous balance.
 * Asset/Expense: prev + Dr - Cr
 * Liability/Equity/Income: prev + Cr - Dr
 */
function calcRunningBalance(
  prevBalance: number,
  debit: number,
  credit: number,
  normalDebit: boolean,
): number {
  return normalDebit
    ? round4(prevBalance + debit - credit)
    : round4(prevBalance + credit - debit);
}

/**
 * Look up the previous running balance for an account.
 * Priority: latest voucher_entries.running_balance → ledger.opening_balance → 0.
 */
async function getPreviousBalance(
  tx: DbExecutor,
  organizationId: string,
  accountId: string,
  fiscalYearCode: string,
): Promise<number> {
  // Try latest entry with a running_balance (use raw SQL — column may not exist in Drizzle schema yet)
  try {
    const rows = await tx.execute(sql`
      SELECT running_balance AS "runningBalance"
      FROM voucher_entries
      WHERE organization_id = ${organizationId}
        AND account_id = ${accountId}
        AND running_balance IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const lastEntry = (rows as any[])[0];
    if (lastEntry?.runningBalance != null) {
      return Number(lastEntry.runningBalance) || 0;
    }
  } catch {
    // running_balance column may not exist yet — fall through to ledger
  }

  // Fallback to ledger opening balance
  const [ledgerRow] = await tx.select({ openingBalance: ledgers.openingBalance })
    .from(ledgers)
    .where(and(
      eq(ledgers.organizationId, organizationId),
      eq(ledgers.accountId, accountId),
      eq(ledgers.fiscalYearCode, fiscalYearCode),
    )).limit(1);

  return Number(ledgerRow?.openingBalance) || 0;
}

/**
 * Compute running balance for a single entry.
 * NOTE: For batch posting (multiple entries per voucher), prefer
 * `computeRunningBalancesForEntries` which chains entries correctly.
 */
export async function computeRunningBalance(opts: {
  tx: DbExecutor;
  organizationId: string;
  accountId: string;
  fiscalYearCode: string;
  debit: number;
  credit: number;
}): Promise<number | null> {
  try {
    const { tx, organizationId, accountId, fiscalYearCode, debit, credit } = opts;

    const [account] = await tx.select({ type: chartOfAccounts.type })
      .from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.id, accountId),
        eq(chartOfAccounts.organizationId, organizationId),
      )).limit(1);

    const prev = await getPreviousBalance(tx, organizationId, accountId, fiscalYearCode);
    return calcRunningBalance(prev, debit, credit, isAssetExpense(account?.type || 'Asset'));
  } catch {
    return null;
  }
}

/**
 * Batch-compute running balances for all entries of a voucher.
 * Correctly chains entries that affect the same account within the same voucher.
 * Returns a Map<entryId, runningBalance>. Returns empty map on error.
 */
export async function computeRunningBalancesForEntries(opts: {
  tx: DbExecutor;
  organizationId: string;
  fiscalYearCode: string;
  entries: Array<{ id: string; accountId: string; debit: number; credit: number }>;
}): Promise<Map<string, number>> {
  try {
    const { tx, organizationId, fiscalYearCode, entries } = opts;
    const result = new Map<string, number>();

    // Track per-account running balance within this voucher
    const accountBalances = new Map<string, number>();

    // Sort entries by account so same-account entries are consecutive
    const sorted = [...entries].sort((a, b) => a.accountId.localeCompare(b.accountId));

    for (const entry of sorted) {
      if (entry.debit <= 0 && entry.credit <= 0) continue;

      const [account] = await tx.select({ type: chartOfAccounts.type })
        .from(chartOfAccounts)
        .where(and(
          eq(chartOfAccounts.id, entry.accountId),
          eq(chartOfAccounts.organizationId, organizationId),
        )).limit(1);

      const normalDebit = isAssetExpense(account?.type || 'Asset');

      // Use per-account tracker if available, otherwise look up DB
      let prev: number;
      if (accountBalances.has(entry.accountId)) {
        prev = accountBalances.get(entry.accountId)!;
      } else {
        prev = await getPreviousBalance(tx, organizationId, entry.accountId, fiscalYearCode);
      }

      const rb = calcRunningBalance(prev, entry.debit, entry.credit, normalDebit);
      result.set(entry.id, rb);
      accountBalances.set(entry.accountId, rb);
    }

    return result;
  } catch {
    // running_balance column may not exist yet — return empty
    return new Map();
  }
}

export async function upsertLedgerEntry(opts: {
  tx: DbExecutor;
  organizationId: string;
  accountId: string;
  fiscalYearCode: string;
  branchId: string;
  debit: number;
  credit: number;
}) {
  const { tx, organizationId, accountId, fiscalYearCode, branchId, debit, credit } = opts;

  const [account] = await tx.select({ type: chartOfAccounts.type })
    .from(chartOfAccounts)
    .where(and(
      eq(chartOfAccounts.id, accountId),
      eq(chartOfAccounts.organizationId, organizationId)
    )).limit(1);

  const accountType = account?.type || 'Asset';
  const isNormalDebit = ['Asset', 'Expense'].includes(accountType);

  const [existing] = await tx.select().from(ledgers)
    .where(and(
      eq(ledgers.organizationId, organizationId),
      eq(ledgers.accountId, accountId),
      eq(ledgers.fiscalYearCode, fiscalYearCode)
    )).limit(1);

  if (existing) {
    const prevDebit = Number(existing.totalDebit) || 0;
    const prevCredit = Number(existing.totalCredit) || 0;
    const openingBal = Number(existing.openingBalance) || 0;
    const updatedDebit = prevDebit + debit;
    const updatedCredit = prevCredit + credit;
    const closingBal = isNormalDebit
      ? openingBal + updatedDebit - updatedCredit
      : openingBal + updatedCredit - updatedDebit;

    await tx.update(ledgers).set({
      totalDebit: String(updatedDebit),
      totalCredit: String(updatedCredit),
      closingBalance: String(closingBal),
      lastUpdatedAt: new Date(),
    }).where(and(
      eq(ledgers.id, existing.id),
      eq(ledgers.organizationId, organizationId)
    ));
  } else {
    const closingBal = isNormalDebit ? debit - credit : credit - debit;
    await tx.insert(ledgers).values({
      organizationId,
      accountId,
      fiscalYearCode,
      openingBalance: '0',
      totalDebit: String(debit),
      totalCredit: String(credit),
      closingBalance: String(closingBal),
      branchId,
    });
  }
}

/**
 * Write running_balance to a voucher entry via raw SQL.
 * The column exists in the DB but is NOT in the Drizzle schema (to avoid
 * breaking SELECT * on existing tables before the migration is run).
 * Silently no-ops if the column doesn't exist yet.
 */
export async function setRunningBalanceRaw(
  tx: DbExecutor,
  entryId: string,
  balance: number,
): Promise<void> {
  try {
    await tx.execute(sql`
      UPDATE voucher_entries
      SET running_balance = ${String(balance)}
      WHERE id = ${entryId}
    `);
  } catch {
    // Column doesn't exist yet — skip silently
  }
}

/**
 * Validate account balances before posting.
 *
 * Rules:
 *  - Asset accounts: block credit (Cr) if resulting balance would go negative.
 *  - Liability / Equity accounts: block debit (Dr) if resulting balance would go negative.
 *  - Cash/bank accounts are covered by the Asset rule.
 *
 * This is a POST-ONLY gate: void reversals are exempt (the original
 * posting should have been validated, not the correction).
 */
export async function validateAccountBalances(opts: {
  tx: DbExecutor;
  organizationId: string;
  entries: Array<{ accountId: string; accountCode?: string; accountName?: string; debit?: number | string; credit?: number | string }>;
}): Promise<void> {
  const { tx, organizationId, entries } = opts;

  // Collect unique account IDs to minimize queries
  const accountIds = [...new Set(entries.map(e => e.accountId))];
  if (accountIds.length === 0) return;

  // Fetch all relevant accounts in one query
  const accounts = await tx.select({
    id: chartOfAccounts.id,
    code: chartOfAccounts.code,
    name: chartOfAccounts.name,
    type: chartOfAccounts.type,
    balance: chartOfAccounts.balance,
  })
    .from(chartOfAccounts)
    .where(and(
      eq(chartOfAccounts.organizationId, organizationId),
      sql`${chartOfAccounts.id} IN ${accountIds}`
    ));

  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const errors: string[] = [];

  for (const entry of entries) {
    const debit = Number(entry.debit) || 0;
    const credit = Number(entry.credit) || 0;
    if (debit <= 0 && credit <= 0) continue;

    const account = accountMap.get(entry.accountId);
    if (!account) continue; // Will fail on a later FK/posting check

    const currentBalance = Number(account.balance) || 0;
    const label = entry.accountName || entry.accountCode || account.code || account.name;

    // Asset / Expense: Dr increases, Cr decreases
    if (['Asset', 'Expense'].includes(account.type)) {
      if (credit > 0) {
        const newBalance = currentBalance + debit - credit;
        if (newBalance < -0.01) {
          errors.push(
            `Insufficient balance in "${label}" (Asset): available Rs. ${currentBalance.toFixed(2)}, trying to credit Rs. ${credit.toFixed(2)} (would go to Rs. ${newBalance.toFixed(2)}).`
          );
        }
      }
    }
    // Liability / Equity / Income: Cr increases, Dr decreases
    else {
      if (debit > 0) {
        const newBalance = currentBalance + credit - debit;
        if (newBalance < -0.01) {
          errors.push(
            `Insufficient balance in "${label}" (${account.type}): available Rs. ${currentBalance.toFixed(2)}, trying to debit Rs. ${debit.toFixed(2)} (would go to Rs. ${newBalance.toFixed(2)}).`
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Balance validation failed:\n${errors.join('\n')}`);
  }
}
