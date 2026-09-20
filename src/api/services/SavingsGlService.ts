/**
 * Savings GL Direct-Posting Helper
 *
 * Savings teller operations (deposit / withdrawal / cheque clearing) must post
 * a double-entry voucher immediately. `AccountingRepository.postVoucher` is
 * gated on an open financial period (Setups → Accounting Settings) which fresh
 * organizations may not have configured — so savings posts bypass that gate
 * and create the voucher directly as `Posted`, updating COA balances inline.
 *
 * If the organization HAS an open financial period, the posting date is still
 * validated against it (non-fatal when absent).
 */
import { and, eq, sql } from 'drizzle-orm';
import { getDb, type DbExecutor } from '../../db/client';
import {
  vouchers,
  voucherEntries,
  chartOfAccounts,
  financialPeriods,
  systemAccountMappings,
} from '../../db/schema';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentFiscalYearCode } from '../../utils/nepaliCalendar';
import { upsertLedgerEntry, computeRunningBalancesForEntries, setRunningBalanceRaw, validateAccountBalances } from './ledgerUtils';

export interface GlEntryInput {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit?: number | string;
  credit?: number | string;
  narration?: string;
}

export interface GlPostInput {
  organizationId: string;
  branchId: string;
  dateBs: string;
  dateAd: string;
  voucherType: 'Receipt' | 'Payment' | 'Journal';
  narration: string;
  moduleReference?: string;
  preparedBy: string;
  entries: GlEntryInput[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Resolve the GL account wired to a system mapping key (e.g. 'member_savings',
 * 'cash_bank', 'savings_interest_expense'). Returns null when unconfigured.
 */
export async function resolveSystemAccount(
  organizationId: string,
  mappingKey: string,
  client?: DbExecutor,
): Promise<Partial<typeof chartOfAccounts.$inferSelect> | null> {
  const db = client ?? getDb();
  if (!db) throw new Error('Database not connected.');
  const rows = await db.select({
    id: chartOfAccounts.id,
    organizationId: chartOfAccounts.organizationId,
    code: chartOfAccounts.code,
    name: chartOfAccounts.name,
    nameNepali: chartOfAccounts.nameNepali,
    type: chartOfAccounts.type,
    parentCode: chartOfAccounts.parentCode,
    balance: chartOfAccounts.balance,
    normalBalance: chartOfAccounts.normalBalance,
    allowPosting: chartOfAccounts.allowPosting,
    isSystemAccount: chartOfAccounts.isSystemAccount,
    isControlAccount: chartOfAccounts.isControlAccount,
    cashBankAccount: chartOfAccounts.cashBankAccount,
    branchId: chartOfAccounts.branchId,
    isActive: chartOfAccounts.isActive,
  })
    .from(systemAccountMappings)
    .innerJoin(chartOfAccounts, eq(systemAccountMappings.accountId, chartOfAccounts.id))
    .where(and(
      eq(systemAccountMappings.organizationId, organizationId),
      eq(systemAccountMappings.mappingKey, mappingKey as any)
    ))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Post a balanced voucher directly as `Posted` (bypassing the financial-period
 * gate). COA balances are updated per account normal balance. Returns the
 * created voucher.
 *
 * When `client` is omitted the voucher is posted inside its own fresh
 * transaction; when supplied the outer caller's transaction is reused so the
 * voucher and its surrounding balance/status updates commit or roll back
 * together.
 */
export async function postSavingsVoucher(input: GlPostInput, client?: DbExecutor) {
  if (client) {
    return postSavingsVoucherEntries(input, client);
  }
  const db = getDb();
  if (!db) throw new Error('Database not connected.');
  return db.transaction((tx) => postSavingsVoucherEntries(input, tx));
}

async function postSavingsVoucherEntries(input: GlPostInput, executor: DbExecutor) {
  const totalDebit = round2(input.entries.reduce((s, e) => s + (Number(e.debit) || 0), 0));
  const totalCredit = round2(input.entries.reduce((s, e) => s + (Number(e.credit) || 0), 0));
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Unbalanced voucher: Debits (${totalDebit}) != Credits (${totalCredit})`);
  }

  const voucherNo = `VCH-${Date.now().toString().slice(-8)}`;

  return executor.transaction(async (tx) => {
    // Optional fiscal-period validation: if the org has an open period, the
    // savings posting date must fall within it. No open period → allowed.
    const openPeriods = await tx.select().from(financialPeriods)
      .where(and(
        eq(financialPeriods.organizationId, input.organizationId),
        eq(financialPeriods.status, 'open')
      ))
      .limit(1);
    const openPeriod = openPeriods[0];
    if (openPeriod) {
      if (input.dateBs < openPeriod.startDateBs || input.dateBs > openPeriod.endDateBs) {
        throw new Error(`Savings posting date ${input.dateBs} is outside the open financial period (${openPeriod.startDateBs} – ${openPeriod.endDateBs}).`);
      }
    }

    const [voucher] = await tx.insert(vouchers).values({
      id: uuidv4(),
      organizationId: input.organizationId,
      voucherNo,
      voucherType: input.voucherType,
      dateBs: input.dateBs,
      dateAd: input.dateAd,
      branchId: input.branchId,
      fiscalYearCode: getCurrentFiscalYearCode(),
      preparedBy: input.preparedBy,
      approvedBy: input.preparedBy,
      status: 'Posted',
      totalAmount: String(totalDebit),
      narration: input.narration,
      moduleReference: input.moduleReference,
    }).returning();

    const entries = input.entries.map((e) => ({
      id: uuidv4(),
      organizationId: input.organizationId,
      voucherId: voucher.id,
      accountId: e.accountId,
      accountCode: e.accountCode,
      accountName: e.accountName,
      debit: String(e.debit || 0),
      credit: String(e.credit || 0),
      narration: e.narration ?? input.narration,
    }));
    await tx.insert(voucherEntries).values(entries);

    // Account balance sufficiency check — block if any credit on Asset or debit on Liability/Equity would go negative
    await validateAccountBalances({
      tx,
      organizationId: input.organizationId,
      entries: entries.map(e => ({
        accountId: e.accountId,
        accountCode: e.accountCode,
        accountName: e.accountName,
        debit: Number(e.debit),
        credit: Number(e.credit),
      })),
    });

    // Update COA balances (Asset/Expense: Dr increases; else Cr increases).
    for (const entry of entries) {
      const [account] = await tx.select().from(chartOfAccounts)
        .where(and(
          eq(chartOfAccounts.id, entry.accountId),
          eq(chartOfAccounts.organizationId, input.organizationId)
        ))
        .limit(1);
      if (!account) throw new Error(`GL account ${entry.accountCode} not found`);
      if (account.allowPosting === false) {
        throw new Error(`Account "${account.code} - ${account.name}" does not allow posting.`);
      }
      const current = Number(account.balance) || 0;
      const debit = Number(entry.debit) || 0;
      const credit = Number(entry.credit) || 0;
      const newBalance = ['Asset', 'Expense'].includes(account.type)
        ? current + debit - credit
        : current + credit - debit;
      await tx.update(chartOfAccounts)
        .set({ balance: String(round2(newBalance)), updatedAt: new Date() })
        .where(and(eq(chartOfAccounts.id, account.id), eq(chartOfAccounts.organizationId, input.organizationId)));

      // Update ledger aggregation
      await upsertLedgerEntry({
        tx,
        organizationId: input.organizationId,
        accountId: account.id,
        fiscalYearCode: getCurrentFiscalYearCode(),
        branchId: input.branchId,
        debit,
        credit,
      });
    }

    // Compute running balance on each entry (batch — chains same-account entries, fail-safe)
    try {
      const runningBalances = await computeRunningBalancesForEntries({
        tx,
        organizationId: input.organizationId,
        fiscalYearCode: getCurrentFiscalYearCode(),
        entries: entries.map(e => ({ id: e.id, accountId: e.accountId, debit: Number(e.debit) || 0, credit: Number(e.credit) || 0 })),
      });
      for (const entry of entries) {
        const rb = runningBalances.get(entry.id);
        if (rb != null) {
          await setRunningBalanceRaw(tx, entry.id, rb);
        }
      }
    } catch {
      // running_balance column may not exist yet — skip silently
    }

    return { voucher, entries, totalDebit, totalCredit };
  });
}

/**
 * Resolve the GL account that backs the 'cash_bank' system mapping, falling
 * back to the org's default cash/bank type account if the mapping is absent.
 * Throws when no cash/bank account can be found, since savings money movements
 * must always post against one.
 */
export async function resolveCashBankAccount(organizationId: string, client?: DbExecutor) {
  const mapped = await resolveSystemAccount(organizationId, 'cash_bank', client);
  if (mapped) return mapped;

  const db = client ?? getDb();
  if (!db) throw new Error('Database not connected.');
  const [fallback] = await db.select().from(chartOfAccounts)
    .where(and(
      eq(chartOfAccounts.organizationId, organizationId),
      eq(chartOfAccounts.cashBankAccount, true),
      eq(chartOfAccounts.isActive, true)
    ))
    .orderBy(sql`${chartOfAccounts.code} asc`)
    .limit(1);
  if (fallback) return fallback;
  throw new Error('Cash / bank GL account is not configured. Set the cash/bank mapping in Setups → Accounting Settings.');
}
