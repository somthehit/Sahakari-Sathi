/**
 * Accounting Repository
 * Data access layer for Chart of Accounts (COA) and double-entry voucher ledgers
 */
import { eq, and, or, desc, asc, count, SQL, ilike, sql, inArray } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  chartOfAccounts,
  vouchers,
  voucherEntries,
  financialPeriods,
  voucherTypes,
  voucherTypeCounters,
  systemAccountMappings,
  ledgers,
} from '../../db/schema';
import type { PaginatedResult } from './MemberRepository';
import { v4 as uuidv4 } from 'uuid';
import { computeRunningBalance, computeRunningBalancesForEntries, setRunningBalanceRaw, validateAccountBalances } from '../services/ledgerUtils';

export interface VoucherFilter {
  organizationId?: string;
  search?: string;
  branchId?: string;
  /** Strict branch scope: `undefined` = org level, `[]` = no branch access. */
  branchIds?: string[];
  voucherType?: string;
  status?: string;
  fiscalYearCode?: string;
  startDateBs?: string;
  endDateBs?: string;
  page?: number;
  limit?: number;
}

export class AccountingRepository {
  private get db() {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    return db;
  }

  // --- Chart of Accounts (COA) ---
  
  async getChartOfAccounts(organizationId: string) {
    if (!organizationId) throw new Error('Organization context is required.');
    // Usually COA is small enough to load into memory for tree rendering
    return this.db.select().from(chartOfAccounts)
      .where(eq(chartOfAccounts.organizationId, organizationId))
      .orderBy(asc(chartOfAccounts.code));
  }

  async getAccountByCode(code: string, organizationId: string) {
    const results = await this.db.select().from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.code, code), eq(chartOfAccounts.organizationId, organizationId)))
      .limit(1);
    return results[0] ?? null;
  }

  async createAccount(data: typeof chartOfAccounts.$inferInsert) {
    if (!data.organizationId) throw new Error('organizationId is required');
    const results = await this.db.insert(chartOfAccounts).values(data).returning();
    return results[0];
  }

  async updateAccount(id: string, data: Partial<typeof chartOfAccounts.$inferInsert>, organizationId: string) {
    const results = await this.db.update(chartOfAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(chartOfAccounts.id, id), eq(chartOfAccounts.organizationId, organizationId)))
      .returning();
    return results[0] ?? null;
  }

  // --- System account mappings (engine wiring) ---

  /**
   * Resolve the chart account wired to a system mapping key (e.g. 'share_capital').
   * Returns null when the org has not configured the mapping yet. Does NOT create.
   */
  async getSystemAccount(organizationId: string, mappingKey: string) {
    const rows = await this.db.select({
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

  /** Resolve the org's active voucher type for a given category (Receipt/Payment/Journal/Contra). */
  async getVoucherTypeByCategory(organizationId: string, category: string) {
    const rows = await this.db.select().from(voucherTypes)
      .where(and(
        eq(voucherTypes.organizationId, organizationId),
        eq(voucherTypes.category, category as any),
        eq(voucherTypes.isActive, true)
      ))
      .orderBy(asc(voucherTypes.sortOrder), asc(voucherTypes.code))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Generate the next voucher number for an org/voucher-type/fiscal-year using an
   * atomic per-type counter (voucher_type_counters). Falls back to the legacy
   * timestamp-based number when no voucher type is configured.
   */
  async nextVoucherNo(organizationId: string, voucherType: string, fiscalYearCode: string): Promise<string> {
    const vtype = await this.getVoucherTypeByCategory(organizationId, voucherType);
    const fy = fiscalYearCode || 'DEFAULT';

    if (vtype) {
      const [row]: any = await this.db.execute(sql`
        INSERT INTO voucher_type_counters (organization_id, voucher_type_id, fiscal_year_code, next_seq)
        VALUES (${organizationId}, ${vtype.id}, ${fy}, 1)
        ON CONFLICT (organization_id, voucher_type_id, fiscal_year_code)
        DO UPDATE SET next_seq = voucher_type_counters.next_seq + 1, updated_at = now()
        RETURNING next_seq
      `);
      const seq = Number(row?.next_seq ?? 1);
      const padding = Number(vtype.padding ?? 6);
      return `${vtype.prefix}-${String(seq).padStart(padding, '0')}`;
    }

    const prefix = ({ Journal: 'JV', Payment: 'PV', Receipt: 'RC', Contra: 'CV' } as Record<string, string>)[voucherType] ?? 'JV';
    return `${prefix}-${Date.now().toString().slice(-6)}`;
  }

  /**
   * The org's currently open financial period (or null). Voucher posting is
   * gated on this — no open period means the ledger is frozen.
   */
  async getOpenFinancialPeriod(organizationId: string, tx?: any) {
    const db = tx ?? this.db;
    const rows = await db.select().from(financialPeriods)
      .where(and(
        eq(financialPeriods.organizationId, organizationId),
        eq(financialPeriods.status, 'open')
      ))
      .orderBy(desc(financialPeriods.endDateBs))
      .limit(1);
    return rows[0] ?? null;
  }

  // --- Vouchers (Double-Entry Ledger) ---

  async findVouchers(filter: VoucherFilter = {}): Promise<PaginatedResult<typeof vouchers.$inferSelect>> {
    const {
      organizationId, search, branchId, branchIds, voucherType, status, fiscalYearCode,
      startDateBs, endDateBs,
      page = 1, limit = 50
    } = filter;

    const conditions: SQL[] = [];
    if (organizationId) conditions.push(eq(vouchers.organizationId, organizationId));
    if (search) {
      conditions.push(
        or(
          ilike(vouchers.voucherNo, `%${search}%`),
          ilike(vouchers.narration, `%${search}%`)
        )!
      );
    }
    if (branchId) conditions.push(eq(vouchers.branchId, branchId));
    if (branchIds !== undefined) conditions.push(inArray(vouchers.branchId, branchIds));
    if (voucherType) conditions.push(eq(vouchers.voucherType, voucherType as any));
    if (status) conditions.push(eq(vouchers.status, status as any));
    if (fiscalYearCode) conditions.push(eq(vouchers.fiscalYearCode, fiscalYearCode));

    // Date range filtering is complex with string formats like 'YYYY/MM/DD', 
    // but alphabetical comparison works for BS dates formatted correctly.
    if (startDateBs && endDateBs) {
      conditions.push(and(
        sql`${vouchers.dateBs} >= ${startDateBs}`,
        sql`${vouchers.dateBs} <= ${endDateBs}`
      )!);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, totalResult] = await Promise.all([
      this.db.select().from(vouchers)
        .where(where)
        .orderBy(desc(vouchers.dateBs), desc(vouchers.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ count: count() }).from(vouchers).where(where)
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getVoucherDetails(voucherId: string, organizationId: string, branchIds?: string[]) {
    const [voucherResults, entries] = await Promise.all([
      this.db.select().from(vouchers)
        .where(and(
          eq(vouchers.id, voucherId),
          eq(vouchers.organizationId, organizationId),
          ...(branchIds !== undefined ? [inArray(vouchers.branchId, branchIds)] : [])
        ))
        .limit(1),
      this.db.select().from(voucherEntries)
        .where(and(
          eq(voucherEntries.voucherId, voucherId),
          eq(voucherEntries.organizationId, organizationId)
        ))
    ]);

    const voucher = voucherResults[0];
    if (!voucher) return null;

    return { ...voucher, entries };
  }

  /**
   * Creates a draft voucher with entries. 
   * Ensures debits = credits before saving.
   */
  async createVoucher(
    voucherData: typeof vouchers.$inferInsert, 
    entriesData: Omit<typeof voucherEntries.$inferInsert, 'voucherId'>[],
    organizationId: string
  ) {
    if (!organizationId) throw new Error('Organization context is required.');
    // 1. Validation: Dr = Cr
    const totalDebit = entriesData.reduce((sum, e) => sum + parseFloat(String(e.debit) || '0'), 0);
    const totalCredit = entriesData.reduce((sum, e) => sum + parseFloat(String(e.credit) || '0'), 0);
    
    // Allow minor floating point diffs if any, but exact math is better
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Unbalanced voucher: Debits (${totalDebit}) != Credits (${totalCredit})`);
    }

    return await this.db.transaction(async (tx) => {
      // Create voucher header — force the caller's org and always start as draft
      const vResult = await tx.insert(vouchers).values({
        ...voucherData,
        organizationId,
        totalAmount: String(totalDebit),
        status: 'Draft'
      }).returning();
      const voucher = vResult[0];

      // Prepare entries — stamp org + voucherId
      const entries = entriesData.map(e => ({
        ...e,
        id: uuidv4(),
        organizationId,
        voucherId: voucher.id
      }));

      // Create entries
      await tx.insert(voucherEntries).values(entries);

      return voucher;
    });
  }

  /**
   * Posts a draft voucher. This affects the actual account balances in COA.
   */
  async postVoucher(voucherId: string, organizationId: string, approvedBy: string, branchIds?: string[]) {
    return await this.db.transaction(async (tx) => {
      // 1. Fetch voucher and entries
      const voucher = await tx.select().from(vouchers)
        .where(and(
          eq(vouchers.id, voucherId),
          eq(vouchers.organizationId, organizationId),
          ...(branchIds !== undefined ? [inArray(vouchers.branchId, branchIds)] : [])
        ))
        .limit(1).then(r => r[0]);
      if (!voucher) throw new Error('Voucher not found');
      if (voucher.status === 'Posted') throw new Error('Voucher is already posted');
      if (voucher.status === 'Cancelled') throw new Error('Voucher is cancelled');

      // 1b. Financial-period gating: posting requires an open period containing
      // the voucher date (Setups → Accounting Settings → Financial Periods).
      const openPeriod = await this.getOpenFinancialPeriod(organizationId, tx);
      if (!openPeriod) {
        throw new Error('Voucher posting is blocked: no open financial period. Open a period in Setups → Accounting Settings.');
      }
      if (voucher.dateBs < openPeriod.startDateBs || voucher.dateBs > openPeriod.endDateBs) {
        throw new Error(`Voucher date ${voucher.dateBs} is outside the open financial period ${openPeriod.code} (${openPeriod.startDateBs} – ${openPeriod.endDateBs}).`);
      }

      const entries = await tx.select().from(voucherEntries)
        .where(and(
          eq(voucherEntries.voucherId, voucherId),
          eq(voucherEntries.organizationId, organizationId)
        ));

      // 1c. Account balance sufficiency check — block if any credit on Asset or debit on Liability/Equity would go negative
      await validateAccountBalances({
        tx,
        organizationId,
        entries: entries.map(e => ({
          accountId: e.accountId,
          accountCode: e.accountCode,
          accountName: e.accountName,
          debit: parseFloat(e.debit),
          credit: parseFloat(e.credit),
        })),
      });

      // 2. Update COA Balances + Ledger aggregation
      const ledgerFiscalYearCode = voucher.fiscalYearCode;
      for (const entry of entries) {
        const account = await tx.select().from(chartOfAccounts)
          .where(and(
            eq(chartOfAccounts.id, entry.accountId),
            eq(chartOfAccounts.organizationId, organizationId)
          ))
          .limit(1).then(r => r[0]);
        if (!account) throw new Error(`Account ${entry.accountCode} not found`);
        if (account.allowPosting === false) {
          throw new Error(`Account "${account.code} - ${account.name}" does not allow posting. Change it in Setups → Accounting Settings → Chart of Accounts.`);
        }

        const currentBalance = parseFloat(account.balance);
        const debit = parseFloat(entry.debit);
        const credit = parseFloat(entry.credit);
        let newBalance = currentBalance;

        // Balance adjustment logic based on account type (Normal Balances)
        // Asset/Expense: Dr increases (+), Cr decreases (-)
        // Liability/Equity/Income: Cr increases (+), Dr decreases (-)
        if (['Asset', 'Expense'].includes(account.type)) {
          newBalance = currentBalance + debit - credit;
        } else {
          newBalance = currentBalance + credit - debit;
        }

        await tx.update(chartOfAccounts)
          .set({ 
            balance: String(newBalance),
            updatedAt: new Date()
          })
          .where(and(
            eq(chartOfAccounts.id, account.id),
            eq(chartOfAccounts.organizationId, organizationId)
          ));

        // 2b. Update ledger aggregation for this account + fiscal year
        const existingLedger = await tx.select().from(ledgers)
          .where(and(
            eq(ledgers.organizationId, organizationId),
            eq(ledgers.accountId, entry.accountId),
            eq(ledgers.fiscalYearCode, ledgerFiscalYearCode)
          ))
          .limit(1).then(r => r[0]);

        if (existingLedger) {
          const prevDebit = parseFloat(existingLedger.totalDebit);
          const prevCredit = parseFloat(existingLedger.totalCredit);
          const openingBal = parseFloat(existingLedger.openingBalance);
          const updatedDebit = prevDebit + debit;
          const updatedCredit = prevCredit + credit;
          let closingBal: number;
          if (['Asset', 'Expense'].includes(account.type)) {
            closingBal = openingBal + updatedDebit - updatedCredit;
          } else {
            closingBal = openingBal + updatedCredit - updatedDebit;
          }
          await tx.update(ledgers)
            .set({
              totalDebit: String(updatedDebit),
              totalCredit: String(updatedCredit),
              closingBalance: String(closingBal),
              lastUpdatedAt: new Date(),
            })
            .where(and(
              eq(ledgers.id, existingLedger.id),
              eq(ledgers.organizationId, organizationId)
            ));
        } else {
          // First entry for this account + FY — set opening = 0, closing from this entry
          let closingBal: number;
          if (['Asset', 'Expense'].includes(account.type)) {
            closingBal = debit - credit;
          } else {
            closingBal = credit - debit;
          }
          await tx.insert(ledgers).values({
            organizationId,
            accountId: entry.accountId,
            fiscalYearCode: ledgerFiscalYearCode,
            openingBalance: '0',
            totalDebit: String(debit),
            totalCredit: String(credit),
            closingBalance: String(closingBal),
            branchId: voucher.branchId,
          });
        }
      }

      // 2c. Compute and store running balance on each entry (fail-safe)
      try {
        const runningBalances = await computeRunningBalancesForEntries({
          tx,
          organizationId,
          fiscalYearCode: ledgerFiscalYearCode,
          entries: entries.map(e => ({ id: e.id, accountId: e.accountId, debit: parseFloat(e.debit), credit: parseFloat(e.credit) })),
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

      // 3. Mark Voucher as Posted
      const updatedVoucher = await tx.update(vouchers)
        .set({ 
          status: 'Posted',
          approvedBy,
          updatedAt: new Date() 
        })
        .where(and(
          eq(vouchers.id, voucherId),
          eq(vouchers.organizationId, organizationId)
        ))
        .returning();

      return updatedVoucher[0];
    });
  }

  /**
   * Backfill ledgers table from all existing posted vouchers.
   * Deletes all existing ledger rows for the org, then rebuilds from voucher entries.
   */
  async backfillLedgers(organizationId: string) {
    if (!organizationId) throw new Error('Organization context is required.');
    return await this.db.transaction(async (tx) => {
      // 1. Delete existing ledger rows for this org
      await tx.delete(ledgers).where(eq(ledgers.organizationId, organizationId));

      // 2. Fetch all posted vouchers with entries
      const postedVouchers = await tx.select().from(vouchers)
        .where(and(
          eq(vouchers.organizationId, organizationId),
          eq(vouchers.status, 'Posted')
        ));

      if (postedVouchers.length === 0) return { rebuilt: 0 };

      const allEntries = await tx.select().from(voucherEntries)
        .where(eq(voucherEntries.organizationId, organizationId));

      // 3. Build a map: accountId+fiscalYearCode -> { totalDebit, totalCredit }
      const ledgerMap = new Map<string, {
        accountId: string;
        fiscalYearCode: string;
        branchId: string;
        totalDebit: number;
        totalCredit: number;
      }>();

      for (const entry of allEntries) {
        const vch = postedVouchers.find(v => v.id === entry.voucherId);
        if (!vch) continue;
        const key = `${entry.accountId}|${vch.fiscalYearCode}`;
        const existing = ledgerMap.get(key);
        const debit = parseFloat(String(entry.debit) || '0');
        const credit = parseFloat(String(entry.credit) || '0');
        if (existing) {
          existing.totalDebit += debit;
          existing.totalCredit += credit;
        } else {
          ledgerMap.set(key, {
            accountId: entry.accountId,
            fiscalYearCode: vch.fiscalYearCode,
            branchId: vch.branchId,
            totalDebit: debit,
            totalCredit: credit,
          });
        }
      }

      // 4. Fetch all accounts to determine types for closing balance calculation
      const accounts = await tx.select().from(chartOfAccounts)
        .where(eq(chartOfAccounts.organizationId, organizationId));
      const accountTypeMap = new Map<string, string>();
      for (const acc of accounts) {
        accountTypeMap.set(acc.id, acc.type);
      }

      // 5. Insert rebuilt ledger rows
      let rebuilt = 0;
      for (const [, data] of ledgerMap) {
        const accountType = accountTypeMap.get(data.accountId) || 'Asset';
        let closingBal: number;
        if (['Asset', 'Expense'].includes(accountType)) {
          closingBal = data.totalDebit - data.totalCredit;
        } else {
          closingBal = data.totalCredit - data.totalDebit;
        }
        await tx.insert(ledgers).values({
          organizationId,
          accountId: data.accountId,
          fiscalYearCode: data.fiscalYearCode,
          openingBalance: '0',
          totalDebit: String(data.totalDebit),
          totalCredit: String(data.totalCredit),
          closingBalance: String(closingBal),
          branchId: data.branchId,
        });
        rebuilt++;
      }

      // 6. Rebuild running_balance on every voucher entry (chronological per account)
      // Wrapped in try/catch — column may not exist until migration 0054 is run.
      try {
        type EntryWithMeta = (typeof allEntries)[number] & { _fiscalYearCode: string; _dateBs: string };
        const accountEntries = new Map<string, EntryWithMeta[]>();
        for (const entry of allEntries) {
          const vch = postedVouchers.find(v => v.id === entry.voucherId);
          if (!vch) continue;
          const list = accountEntries.get(entry.accountId) || [];
          list.push({ ...entry, _fiscalYearCode: vch.fiscalYearCode, _dateBs: vch.dateBs });
          accountEntries.set(entry.accountId, list);
        }

        for (const [accountId, acctEntries] of accountEntries) {
          acctEntries.sort((a, b) => {
            const dateCmp = a._dateBs.localeCompare(b._dateBs);
            if (dateCmp !== 0) return dateCmp;
            return a.createdAt.getTime() - b.createdAt.getTime();
          });
          const accountType = accountTypeMap.get(accountId) || 'Asset';
          const normalDebit = ['Asset', 'Expense'].includes(accountType);
          let running = 0;
          for (const entry of acctEntries) {
            const debit = parseFloat(String(entry.debit) || '0');
            const credit = parseFloat(String(entry.credit) || '0');
            running = normalDebit ? running + debit - credit : running + credit - debit;
            await setRunningBalanceRaw(tx, entry.id, Math.round(running * 100) / 100);
          }
        }
      } catch {
        // running_balance column may not exist yet — skip silently
      }

      return { rebuilt };
    });
  }

  /**
   * Get ledger data (aggregated per account per FY)
   */
  async getLedgerData(organizationId: string, fiscalYearCode?: string, branchId?: string) {
    const conditions = [eq(ledgers.organizationId, organizationId)];
    if (fiscalYearCode) conditions.push(eq(ledgers.fiscalYearCode, fiscalYearCode));
    if (branchId) conditions.push(eq(ledgers.branchId, branchId));
    return this.db.select().from(ledgers)
      .where(and(...conditions))
      .orderBy(asc(ledgers.accountId));
  }
}
