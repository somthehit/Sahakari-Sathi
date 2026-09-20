/**
 * Loan Servicing Repository
 * ---------------------------------------------------------------------------
 * The transactional, double-entry-posting half of the loan lifecycle. Where
 * LoanRepository covers origination reads/writes (apply, approve, list), this
 * repository owns every operation that must be atomic AND must reach the
 * general ledger:
 *
 *   disburse()        Approved -> Disbursed. Builds the installment schedule,
 *                    posts Dr loan receivable / Cr cash (less any processing
 *                    fee booked to income) and opens the member's sub-book.
 *   recordRepayment() Collects an installment: Dr cash / Cr receivable,
 *                     interest income and penalty income, settles penalties
 *                     and marks installments Paid.
 *   accruePenalty()   Records late-payment penalties on overdue installments
 *                     and refreshes arrears counters.
 *   waivePenalty()    Audited waiver of an unpaid penalty.
 *   reschedule()      Re-terms the loan and rebuilds the unpaid schedule.
 *   writeOff()        Dr loan-loss allowance / provision expense, Cr receivable.
 *   classify()        Re-grades npl_status + provision_amount from config.
 *
 * DESIGN RULES OBSERVED HERE
 * - Installment maths is NEVER re-implemented. Every schedule comes from
 *   `generateLoanSchedule` in utils/financialEngine, the single source of
 *   truth shared with the EMI Schedule Settings preview.
 * - No rate, band, threshold or account code is hardcoded as policy. Interest
 *   and penalty rates come from the loan/product rows, classification bands
 *   and provision percentages from `loan_provisioning_settings`, and every
 *   ledger account is resolved through `system_account_mappings`.
 * - Concurrency: each operation runs in one `db.transaction` and takes a
 *   `SELECT ... FOR UPDATE` lock on the loan row before reading balances, so
 *   two tellers cannot post against the same outstanding principal.
 * - Drizzle returns `numeric` columns as STRINGS. Everything is coerced with
 *   Number() before arithmetic and stringified on the way back in.
 */
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  loanAccounts,
  loanProducts,
  emiSchedules,
  loanRepayments,
  loanPenalties,
  loanReschedules,
  loanWriteoffs,
  loanProvisioningSettings,
  emiScheduleSettings,
  subsidiaryLoansBook,
  vouchers,
  voucherEntries,
  chartOfAccounts,
  systemAccountMappings,
} from '../../db/schema';
import { bankChequeLeaves } from '../../db/schema/bankCheques';
import { generateLoanSchedule, daysBetweenBS, type LoanInterestMethod } from '../../utils/financialEngine';
import { getCurrentFiscalYearCode } from '../../utils/nepaliCalendar';
import { upsertLedgerEntry, computeRunningBalancesForEntries, setRunningBalanceRaw, validateAccountBalances } from '../services/ledgerUtils';

/** Rounds to 2dp the same way the schedule generator does. */
const money = (v: number): number => Math.round(v * 100) / 100;

/** Coerces a Drizzle numeric (string) or any loose input to a finite number. */
const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Amounts below this are treated as fully settled (sub-paisa dust). */
const EPSILON = 0.005;

type Tx = any;

/** A ledger account as returned by the system-mapping resolver. */
interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

/** Fallback definition used to lazily provision a missing ledger account. */
interface AccountFallback {
  /** Preferred existing account codes, tried in order. */
  codes: string[];
  /** Code used when the account has to be created. */
  createCode: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
  normalBalance: 'debit' | 'credit';
}

/**
 * Ledger account defaults per system-mapping key.
 *
 * These are DISCOVERY hints, not policy: the mapping table always wins. The
 * codes below match the shipped chart-of-accounts template (coaSeedTemplate),
 * so a standard installation wires itself up on first posting instead of
 * failing, and the resolved choice is written back to system_account_mappings
 * so it becomes explicit and auditable from SETUPS -> Accounting.
 */
const ACCOUNT_FALLBACKS: Record<string, AccountFallback> = {
  loan_principal_receivable: {
    codes: ['04-110-001', '04-120'],
    createCode: '04-110-001',
    name: 'Loan Principal Receivable',
    type: 'Asset',
    normalBalance: 'debit',
  },
  cash_bank: {
    codes: ['04-80', '04-90'],
    createCode: '04-80',
    name: 'Cash',
    type: 'Asset',
    normalBalance: 'debit',
  },
  loan_interest_income: {
    codes: ['03-160-01-002'],
    createCode: '03-160-01-002',
    name: 'Interest From Loan',
    type: 'Income',
    normalBalance: 'credit',
  },
  loan_penalty_income: {
    codes: ['03-160-02-004'],
    createCode: '03-160-02-004',
    name: 'Late Fee Charge',
    type: 'Income',
    normalBalance: 'credit',
  },
  loan_processing_fee_income: {
    codes: ['03-160-02-003'],
    createCode: '03-160-02-003',
    name: 'Services Fee',
    type: 'Income',
    normalBalance: 'credit',
  },
  loan_loss_allowance: {
    codes: ['01-20-005'],
    createCode: '01-20-005',
    name: 'Loan Loss Reserve',
    type: 'Liability',
    normalBalance: 'credit',
  },
  loan_loss_provision_expense: {
    codes: ['02-150-002-003'],
    createCode: '02-160-001',
    name: 'Loan Loss Provision Expense',
    type: 'Expense',
    normalBalance: 'debit',
  },
};

export interface DisburseInput {
  loanId: string;
  dateBs: string;
  dateAd: string;
  processedBy: string;
  /** 'Cash' or 'Bank' disbursement method. */
  disbursementMethod?: 'Cash' | 'Bank';
  /** Explicit payment (credit) account; falls back to the mapped cash/bank. */
  paymentAccountId?: string | null;
  /** Bank cheque leaf ID for bank disbursements — validated and consumed atomically. */
  chequeLeafId?: string | null;
  /** Overrides the auto-generated voucher narration. */
  narration?: string | null;
  /** Deduct the product's processing fee from the cash paid out. Default true. */
  deductProcessingFee?: boolean;
  remarks?: string | null;
  /** Persisted payment channel: 'CASH' | 'SAVINGS_TRANSFER' | 'CHEQUE'. */
  disbursementPaymentMethod?: 'CASH' | 'SAVINGS_TRANSFER' | 'CHEQUE' | null;
  /** Reference ID for the payment (e.g. cheque number, savings txn ref). */
  disbursementReferenceId?: string | null;
  /** Per-loan GL overrides from the loan wizard (mappingKey → accountId). */
  customGlMappings?: Record<string, string>;
}

export interface RepaymentInput {
  loanId: string;
  principalPaid: number;
  interestPaid: number;
  penaltyPaid: number;
  paymentMode: 'Cash' | 'Bank_Transfer';
  dateBs: string;
  dateAd: string;
  collectedBy: string;
  receiptNo?: string | null;
  paymentAccountId?: string | null;
  narration?: string | null;
  /** Per-loan GL overrides from the loan wizard (mappingKey → accountId). */
  customGlMappings?: Record<string, string>;
}

export interface PenaltyAccrualInput {
  loanId: string;
  /** Reference date arrears are measured to (BS). */
  asOfDateBs: string;
  processedBy: string;
}

export interface RescheduleInput {
  loanId: string;
  newTenureMonths: number;
  newRatePct: number;
  effectiveDateBs: string;
  reason: string;
  approvedBy?: string | null;
}

export interface WriteOffInput {
  loanId: string;
  dateBs: string;
  dateAd: string;
  /** Principal to write off; defaults to the whole outstanding balance. */
  principalAmount?: number | null;
  interestAmount?: number;
  reason: string;
  processedBy: string;
  approvedBy?: string | null;
  /** Per-loan GL overrides from the loan wizard (mappingKey → accountId). */
  customGlMappings?: Record<string, string>;
}

export class LoanServicingRepository {
  private get db() {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    return db;
  }

  // =========================================================================
  // LEDGER PLUMBING
  // Mirrors the resolution strategy proven in ShareRepository: the configured
  // system-account mapping is authoritative, with code/name discovery and
  // lazy creation as a fallback that then records itself as the mapping.
  // =========================================================================

  /** Resolve a mapped system account (no creation). */
  private async getMappedAccount(organizationId: string, key: string, tx: Tx): Promise<LedgerAccount | null> {
    const rows: any = await tx.select({
      id: chartOfAccounts.id,
      code: chartOfAccounts.code,
      name: chartOfAccounts.name,
      type: chartOfAccounts.type,
    })
      .from(systemAccountMappings)
      .innerJoin(chartOfAccounts, eq(systemAccountMappings.accountId, chartOfAccounts.id))
      .where(and(
        eq(systemAccountMappings.organizationId, organizationId),
        eq(systemAccountMappings.mappingKey, key as any),
      ))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Record a system_account_mappings row if the key is not already mapped. */
  private async writeMapping(organizationId: string, key: string, accountId: string, tx: Tx): Promise<void> {
    const existing: any = await tx.select({ id: systemAccountMappings.id })
      .from(systemAccountMappings)
      .where(and(
        eq(systemAccountMappings.organizationId, organizationId),
        eq(systemAccountMappings.mappingKey, key as any),
      ))
      .limit(1);
    if (existing?.length) return;
    await tx.insert(systemAccountMappings).values({
      organizationId,
      mappingKey: key as any,
      accountId,
      description: `Auto-mapped ${key} by loan servicing`,
    }).onConflictDoNothing();
  }

  /**
   * Resolve the ledger account for a system key, provisioning it if the
   * installation has never posted against it. Always records the resolution
   * back to system_account_mappings so the wiring becomes explicit.
   *
   * Resolution order:
   *  1. customMappings[key] — per-loan or per-product override from the wizard
   *  2. system_account_mappings — org-level saved mapping
   *  3. ACCOUNT_FALLBACKS[key] — auto-discover by COA code / auto-create
   *  4. Error — no mapping and no fallback
   */
  private async resolveAccount(
    organizationId: string,
    key: string,
    branchId: string | null,
    tx: Tx,
    customMappings?: Record<string, string>,
  ): Promise<LedgerAccount> {
    // 1. Per-loan override (from loan wizard custom_gl_mappings)
    const overrideAccountId = customMappings?.[key];
    if (overrideAccountId) {
      const override = await this.getAccountById(organizationId, overrideAccountId, tx);
      if (!override) {
        throw new Error(
          `Custom GL mapping '${key}' points to account ${overrideAccountId} which does not exist or belongs to another organization.`,
        );
      }
      return override;
    }

    // 2. Org-level saved mapping
    const mapped = await this.getMappedAccount(organizationId, key, tx);
    if (mapped) return mapped;

    // 3. Fallback: auto-discover by COA code or auto-create
    const fallback = ACCOUNT_FALLBACKS[key];
    if (!fallback) {
      throw new Error(
        `No ledger account configured for '${key}'. Set it in Setup → Accounting → System Account Mappings.`,
      );
    }

    for (const code of fallback.codes) {
      const found: any = await tx.select({
        id: chartOfAccounts.id,
        code: chartOfAccounts.code,
        name: chartOfAccounts.name,
        type: chartOfAccounts.type,
      })
        .from(chartOfAccounts)
        .where(and(
          eq(chartOfAccounts.organizationId, organizationId),
          eq(chartOfAccounts.code, code),
          eq(chartOfAccounts.allowPosting, true),
        ))
        .limit(1);
      if (found?.length) {
        await this.writeMapping(organizationId, key, found[0].id, tx);
        return found[0];
      }
    }

    const created: any = await tx.insert(chartOfAccounts).values({
      organizationId,
      code: fallback.createCode,
      name: fallback.name,
      type: fallback.type,
      normalBalance: fallback.normalBalance,
      balance: '0',
      allowPosting: true,
      isSystemAccount: true,
      branchId: branchId ?? null,
      description: `Auto-created for loan servicing (${key})`,
      isActive: true,
    }).returning({
      id: chartOfAccounts.id,
      code: chartOfAccounts.code,
      name: chartOfAccounts.name,
      type: chartOfAccounts.type,
    });
    await this.writeMapping(organizationId, key, created[0].id, tx);
    return created[0];
  }

  /** Explicitly chosen posting account (e.g. the teller's till or a bank). */
  private async getAccountById(organizationId: string, accountId: string, tx: Tx): Promise<LedgerAccount | null> {
    const rows: any = await tx.select({
      id: chartOfAccounts.id,
      code: chartOfAccounts.code,
      name: chartOfAccounts.name,
      type: chartOfAccounts.type,
    })
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.id, accountId), eq(chartOfAccounts.organizationId, organizationId)))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Next journal voucher number for the org (JV-00001 style, as per shares). */
  private async nextJournalVoucherNo(organizationId: string, tx: Tx): Promise<string> {
    const rows: any = await tx.execute(sql`
      SELECT count(*) AS c FROM vouchers WHERE organization_id = ${organizationId}
    `);
    return `JV-${String(Number(rows?.[0]?.c ?? 0) + 1).padStart(5, '0')}`;
  }

  /** Next loan receipt number for the org (LRP-00001). */
  private async nextReceiptNo(organizationId: string, tx: Tx): Promise<string> {
    const rows: any = await tx.execute(sql`
      SELECT count(*) AS c FROM loan_repayments WHERE organization_id = ${organizationId}
    `);
    return `LRP-${String(Number(rows?.[0]?.c ?? 0) + 1).padStart(5, '0')}`;
  }

  private async currentFiscalYearId(organizationId: string, tx: Tx): Promise<string | null> {
    const rows: any = await tx.execute(sql`
      SELECT id FROM fiscal_years
      WHERE organization_id = ${organizationId}
      ORDER BY is_current DESC, code DESC LIMIT 1
    `);
    return rows?.[0]?.id ?? null;
  }

  /**
   * Post a balanced journal voucher. Refuses to write an unbalanced set of
   * entries — a corrupt voucher is far worse than a failed operation.
   */
  private async postVoucher(
    tx: Tx,
    organizationId: string,
    header: {
      voucherNo: string;
      dateBs: string;
      dateAd: string;
      branchId: string;
      preparedBy: string;
      narration: string;
      moduleReference: string;
    },
    legs: Array<{ account: LedgerAccount; debit?: number; credit?: number; narration: string }>,
  ): Promise<{ id: string; voucherNo: string; totalAmount: number }> {
    const totalDebit = money(legs.reduce((s, l) => s + num(l.debit), 0));
    const totalCredit = money(legs.reduce((s, l) => s + num(l.credit), 0));
    if (Math.abs(totalDebit - totalCredit) > EPSILON) {
      throw new Error(
        `Refusing to post an unbalanced voucher: debit ${totalDebit} vs credit ${totalCredit}.`,
      );
    }
    if (totalDebit <= 0) throw new Error('Refusing to post a zero-value voucher.');

    const fiscalYearId = await this.currentFiscalYearId(organizationId, tx);
    const created: any = await tx.insert(vouchers).values({
      organizationId,
      voucherNo: header.voucherNo,
      voucherType: 'Journal',
      dateBs: header.dateBs,
      dateAd: header.dateAd,
      branchId: header.branchId,
      fiscalYearId: fiscalYearId ?? null,
      fiscalYearCode: getCurrentFiscalYearCode(),
      preparedBy: header.preparedBy,
      approvedBy: header.preparedBy,
      status: 'Posted',
      totalAmount: String(totalDebit),
      narration: header.narration,
      moduleReference: header.moduleReference,
    }).returning();

    await tx.insert(voucherEntries).values(
      legs
        .filter((l) => num(l.debit) > 0 || num(l.credit) > 0)
        .map((l) => ({
          organizationId,
          voucherId: created[0].id,
          accountId: l.account.id,
          accountCode: l.account.code,
          accountName: l.account.name,
          debit: String(money(num(l.debit))),
          credit: String(money(num(l.credit))),
          narration: l.narration,
        })),
    );

    // Account balance sufficiency check — block if any credit on Asset or debit on Liability/Equity would go negative
    await validateAccountBalances({
      tx,
      organizationId,
      entries: legs
        .filter((l) => num(l.debit) > 0 || num(l.credit) > 0)
        .map((l) => ({
          accountId: l.account.id,
          accountCode: l.account.code,
          accountName: l.account.name,
          debit: money(num(l.debit)),
          credit: money(num(l.credit)),
        })),
    });

    // Update COA running balances (Asset/Expense: Dr increases; Liability/Equity/Income: Cr increases)
    for (const leg of legs) {
      const debit = money(num(leg.debit));
      const credit = money(num(leg.credit));
      if (debit <= 0 && credit <= 0) continue;

      const [acct] = await tx.select().from(chartOfAccounts)
        .where(and(eq(chartOfAccounts.id, leg.account.id), eq(chartOfAccounts.organizationId, organizationId)))
        .limit(1);
      if (!acct) continue;

      const current = Number(acct.balance) || 0;
      const isDebitNormal = ['Asset', 'Expense'].includes(acct.type);
      const newBalance = isDebitNormal ? current + debit - credit : current + credit - debit;
      await tx.update(chartOfAccounts)
        .set({ balance: String(money(newBalance)), updatedAt: new Date() })
        .where(and(eq(chartOfAccounts.id, acct.id), eq(chartOfAccounts.organizationId, organizationId)));

      await upsertLedgerEntry({ tx, organizationId, accountId: acct.id, fiscalYearCode: getCurrentFiscalYearCode(), branchId: header.branchId, debit, credit });
    }

    // Compute running balance on each entry (batch — chains same-account entries, fail-safe)
    try {
      const insertedEntries = await tx.select({ id: voucherEntries.id, accountId: voucherEntries.accountId, debit: voucherEntries.debit, credit: voucherEntries.credit })
        .from(voucherEntries)
        .where(eq(voucherEntries.voucherId, created[0].id));

      const runningBalances = await computeRunningBalancesForEntries({
        tx,
        organizationId,
        fiscalYearCode: getCurrentFiscalYearCode(),
        entries: insertedEntries.map(e => ({ id: e.id, accountId: e.accountId, debit: money(num(e.debit)), credit: money(num(e.credit)) })),
      });
      for (const entry of insertedEntries) {
        const rb = runningBalances.get(entry.id);
        if (rb != null) {
          await setRunningBalanceRaw(tx, entry.id, rb);
        }
      }
    } catch {
      // running_balance column may not exist yet — skip silently
    }

    return { id: created[0].id, voucherNo: header.voucherNo, totalAmount: totalDebit };
  }

  /** Latest remaining principal recorded in the member's loan sub-book. */
  private async lastSubBookBalance(
    organizationId: string,
    memberId: string,
    loanNo: string,
    tx: Tx,
  ): Promise<number> {
    const rows: any = await tx.execute(sql`
      SELECT remaining_principal FROM subsidiary_loans_book
      WHERE organization_id = ${organizationId}
        AND member_id = ${memberId}
        AND loan_account_no = ${loanNo}
      ORDER BY created_at DESC, id DESC LIMIT 1
    `);
    return num(rows?.[0]?.remaining_principal);
  }

  // =========================================================================
  // SETTINGS
  // =========================================================================

  /**
   * Org EMI schedule settings, or the schema defaults when the org has not
   * visited SETUPS -> Loan Settings yet. Read-only: this never creates a row,
   * so an untouched installation is not silently "configured".
   */
  private async getScheduleSettings(organizationId: string, tx: Tx) {
    const rows: any = await tx.select().from(emiScheduleSettings)
      .where(eq(emiScheduleSettings.organizationId, organizationId))
      .limit(1);
    const row = rows?.[0];
    return {
      installmentDayOfMonth: row ? Number(row.installmentDayOfMonth) || 1 : 1,
      dayCount: (row?.dayCountConvention === '360' ? '360' : '365') as '365' | '360',
      rounding: (row?.roundingMode ?? 'round') as 'round' | 'floor' | 'ceil',
      shiftToWorkingDay: row ? row.shiftToWorkingDay !== false : true,
    };
  }

  /**
   * Org provisioning policy, lazily seeded from the schema defaults on first
   * use so classification always has an explicit, editable row behind it.
   */
  async getProvisioningSettings(organizationId: string, tx?: Tx) {
    const db = tx ?? this.db;
    const rows: any = await db.select().from(loanProvisioningSettings)
      .where(eq(loanProvisioningSettings.organizationId, organizationId))
      .limit(1);
    if (rows?.length) return rows[0];
    const created: any = await db.insert(loanProvisioningSettings)
      .values({ organizationId })
      .onConflictDoNothing()
      .returning();
    if (created?.length) return created[0];
    const again: any = await db.select().from(loanProvisioningSettings)
      .where(eq(loanProvisioningSettings.organizationId, organizationId))
      .limit(1);
    return again[0];
  }

  async updateProvisioningSettings(
    organizationId: string,
    patch: Partial<typeof loanProvisioningSettings.$inferInsert>,
    updatedBy?: string | null,
  ) {
    await this.getProvisioningSettings(organizationId);
    const rows = await this.db.update(loanProvisioningSettings)
      .set({ ...patch, updatedBy: updatedBy ?? null, updatedAt: new Date() })
      .where(eq(loanProvisioningSettings.organizationId, organizationId))
      .returning();
    return rows[0] ?? null;
  }

  // =========================================================================
  // LOCKING
  // =========================================================================

  /**
   * Take the loan row's write lock. Every balance-changing operation starts
   * here, so concurrent postings against one loan serialize instead of both
   * reading the same stale outstanding principal.
   */
  private async lockLoan(tx: Tx, loanId: string, organizationId: string, branchIds?: string[]) {
    const rows = await tx.select().from(loanAccounts)
      .where(and(
        eq(loanAccounts.id, loanId),
        eq(loanAccounts.organizationId, organizationId),
        ...(branchIds !== undefined ? [inArray(loanAccounts.branchId, branchIds)] : []),
      ))
      .for('update')
      .limit(1);
    const loan = rows[0];
    if (!loan) throw new Error('Loan not found.');
    return loan;
  }

  // =========================================================================
  // 1. DISBURSEMENT
  // =========================================================================

  /**
   * Disburses an approved loan.
   *
   * This is where a loan first becomes a real asset: the installment schedule
   * is generated (previously never happened — approved loans carried no
   * schedule at all), the receivable is recognised in the ledger, and the
   * member's loan sub-book is opened.
   *
   * Any processing fee configured on the loan product is booked to fee income
   * and netted off the cash paid out, keeping the voucher balanced at the full
   * principal.
   */
  async disburse(organizationId: string, input: DisburseInput, branchIds?: string[]) {
    return this.db.transaction(async (tx) => {
      const loan = await this.lockLoan(tx, input.loanId, organizationId, branchIds);

      if (loan.status !== 'Approved') {
        throw new Error(
          `Only an approved loan can be disbursed — this loan is '${loan.status}'.`,
        );
      }

      const principal = num(loan.approvedAmount);
      if (principal <= 0) throw new Error('Approved amount must be greater than zero to disburse.');

      const tenureMonths = Number(loan.tenureMonths) || 0;
      if (tenureMonths <= 0) throw new Error('Loan tenure must be greater than zero to disburse.');

      // ---- Installment schedule (delegated to the shared engine) ----
      const settings = await this.getScheduleSettings(organizationId, tx);
      const schedule = generateLoanSchedule({
        principal,
        annualRatePct: num(loan.interestRate),
        tenureMonths,
        method: loan.interestMethod as LoanInterestMethod,
        startDateBs: input.dateBs,
        installmentDayOfMonth: settings.installmentDayOfMonth,
        dayCount: settings.dayCount,
        rounding: settings.rounding,
        shiftToWorkingDay: settings.shiftToWorkingDay,
      });
      if (!schedule.installments.length) {
        throw new Error('Could not build an installment schedule for this loan.');
      }

      // A re-disbursement cannot happen (status gate above), but clear any
      // stale preview rows so the schedule is exactly what we just generated.
      await tx.delete(emiSchedules).where(and(
        eq(emiSchedules.organizationId, organizationId),
        eq(emiSchedules.loanId, loan.id),
      ));

      await tx.insert(emiSchedules).values(schedule.installments.map((i) => ({
        organizationId,
        loanId: loan.id,
        installmentNo: i.installmentNo,
        dueDateBs: i.dueDateBs,
        principal: String(i.principal),
        interest: String(i.interest),
        totalEmi: String(i.totalEmi),
        balancePrincipal: String(i.balancePrincipal),
        status: 'Due' as const,
      })));

      const maturityDateBs = schedule.installments[schedule.installments.length - 1].dueDateBs;

      // ---- Processing fee (product config, never a hardcoded rate) ----
      let processingFee = 0;
      if (input.deductProcessingFee !== false && loan.loanProductId) {
        const productRows: any = await tx.select({ pct: loanProducts.processingFeePercent })
          .from(loanProducts)
          .where(and(
            eq(loanProducts.id, loan.loanProductId),
            eq(loanProducts.organizationId, organizationId),
          ))
          .limit(1);
        const pct = num(productRows?.[0]?.pct);
        if (pct > 0) processingFee = money((principal * pct) / 100);
      }
      if (processingFee >= principal) {
        throw new Error('Processing fee cannot equal or exceed the loan principal.');
      }
      const netDisbursed = money(principal - processingFee);

      // ---- Ledger posting ----
      const customMappings = input.customGlMappings;
      const receivable = await this.resolveAccount(organizationId, 'loan_principal_receivable', loan.branchId, tx, customMappings);
      const paymentAccount = input.paymentAccountId
        ? await this.getAccountById(organizationId, input.paymentAccountId, tx)
        : await this.resolveAccount(organizationId, 'cash_bank', loan.branchId, tx, customMappings);
      if (!paymentAccount) throw new Error('Payment account not found in this organization.');

      const who = `${loan.memberName} (${loan.memberNo})`;
      const legs: Array<{ account: LedgerAccount; debit?: number; credit?: number; narration: string }> = [
        { account: receivable, debit: principal, narration: `Loan ${loan.loanNo} disbursed — ${who}` },
        { account: paymentAccount, credit: netDisbursed, narration: `Loan ${loan.loanNo} paid out — ${who}` },
      ];
      if (processingFee > 0) {
        const feeIncome = await this.resolveAccount(organizationId, 'loan_processing_fee_income', loan.branchId, tx, customMappings);
        legs.push({
          account: feeIncome,
          credit: processingFee,
          narration: `Processing fee on loan ${loan.loanNo} — ${who}`,
        });
      }

      const voucherNo = await this.nextJournalVoucherNo(organizationId, tx);
      const voucher = await this.postVoucher(tx, organizationId, {
        voucherNo,
        dateBs: input.dateBs,
        dateAd: input.dateAd,
        branchId: loan.branchId,
        preparedBy: input.processedBy,
        narration: input.narration
          ?? `Loan disbursement ${loan.loanNo}: ${who} रु.${principal}`,
        moduleReference: `LOAN_DISBURSE:${voucherNo}`,
      }, legs);

      // ---- Member sub-book ----
      await tx.insert(subsidiaryLoansBook).values({
        organizationId,
        memberId: loan.memberId,
        loanAccountNo: loan.loanNo,
        voucherNo,
        transactionDateBs: input.dateBs,
        principalDebit: String(principal),
        principalCredit: '0',
        interestCredit: '0',
        penaltyCredit: '0',
        remainingPrincipal: String(principal),
      });

      // ---- Bank cheque leaf validation + consumption (bank disbursements only) ----
      let chequeLeafInfo: { chequeNumber: string; chequeLeafId: string } | null = null;
      if (input.chequeLeafId) {
        const [leaf] = await tx.update(bankChequeLeaves)
          .set({
            status: 'issued',
            payeeName: who,
            amount: String(netDisbursed),
            chequeDateBs: input.dateBs,
            chequeDateAd: input.dateAd,
            loanId: loan.id,
            voucherId: voucher.id,
            usedAt: new Date(),
          } as any)
          .where(and(
            eq(bankChequeLeaves.id, input.chequeLeafId),
            eq(bankChequeLeaves.organizationId, organizationId),
            eq(bankChequeLeaves.status, 'unused'),
          ))
          .returning();

        if (!leaf) {
          throw new Error(
            'Selected cheque leaf is not available (already used, cancelled, or does not belong to this bank account).',
          );
        }
        chequeLeafInfo = { chequeNumber: leaf.chequeNumber, chequeLeafId: leaf.id };
      }

      // ---- Loan account state ----
      const updated = await tx.update(loanAccounts)
        .set({
          status: 'Disbursed',
          outstandingPrincipal: String(principal),
          disbursedAmount: String(principal),
          monthlyEmi: String(schedule.monthlyPayment),
          disbursedDateBs: input.dateBs,
          maturityDateBs,
          disbursementPaymentMethod: input.disbursementPaymentMethod ?? null,
          disbursementReferenceId: input.disbursementReferenceId ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(loanAccounts.id, loan.id), eq(loanAccounts.organizationId, organizationId)))
        .returning();

      return {
        loan: updated[0],
        voucherId: voucher.id,
        voucherNo,
        principal,
        processingFee,
        netDisbursed,
        maturityDateBs,
        monthlyEmi: schedule.monthlyPayment,
        totalInterest: schedule.totalInterest,
        totalPayment: schedule.totalPayment,
        installmentCount: schedule.installments.length,
        chequeLeaf: chequeLeafInfo,
        loanNo: loan.loanNo,
        memberName: loan.memberName,
        memberNo: loan.memberNo,
        dateBs: input.dateBs,
        dateAd: input.dateAd,
        disbursedBy: input.processedBy,
        glEntries: legs
          .filter((l) => num(l.debit) > 0 || num(l.credit) > 0)
          .map((l) => ({
            accountCode: l.account.code,
            accountName: l.account.name,
            debit: money(num(l.debit)),
            credit: money(num(l.credit)),
            narration: l.narration,
          })),
      };
    });
  }

  // =========================================================================
  // 2. REPAYMENT (ledger-posted)
  // =========================================================================

  /**
   * Collects a repayment and posts it to the ledger.
   *
   * Deliberately a separate path from the older LoanRepository.processRepayment,
   * which updates the loan balance but writes nothing to the general ledger.
   * This one is the full treatment: row lock, over-payment guard, penalty
   * settlement, installment closure, double-entry voucher and sub-book row.
   *
   * The split between principal / interest / penalty is supplied by the caller
   * (the teller screen prefills it from getDueBreakdown) — this method verifies
   * the split is affordable rather than inventing an allocation policy.
   */
  async recordRepayment(organizationId: string, input: RepaymentInput, branchIds?: string[]) {
    return this.db.transaction(async (tx) => {
      const loan = await this.lockLoan(tx, input.loanId, organizationId, branchIds);

      if (loan.status !== 'Disbursed') {
        throw new Error(
          `Only a disbursed loan can accept repayments — this loan is '${loan.status}'.`,
        );
      }

      const principalPaid = money(num(input.principalPaid));
      const interestPaid = money(num(input.interestPaid));
      const penaltyPaid = money(num(input.penaltyPaid));
      if (principalPaid < 0 || interestPaid < 0 || penaltyPaid < 0) {
        throw new Error('Repayment components cannot be negative.');
      }
      const totalPaid = money(principalPaid + interestPaid + penaltyPaid);
      if (totalPaid <= 0) throw new Error('Repayment amount must be greater than zero.');

      const outstanding = num(loan.outstandingPrincipal);
      if (principalPaid > outstanding + EPSILON) {
        throw new Error(
          `Principal paid (${principalPaid}) exceeds the outstanding balance (${outstanding}).`,
        );
      }

      // Penalty may only be collected against penalties actually outstanding.
      const dueRows: any = await tx.select().from(loanPenalties)
        .where(and(
          eq(loanPenalties.organizationId, organizationId),
          eq(loanPenalties.loanId, loan.id),
          eq(loanPenalties.isPaid, false),
          eq(loanPenalties.waived, false),
        ))
        .orderBy(asc(loanPenalties.penaltyDateBs));
      const penaltyOutstanding = money(dueRows.reduce((s: number, p: any) => s + num(p.penaltyAmount), 0));
      if (penaltyPaid > penaltyOutstanding + EPSILON) {
        throw new Error(
          `Penalty paid (${penaltyPaid}) exceeds the penalty outstanding (${penaltyOutstanding}).`,
        );
      }

      const newOutstanding = money(Math.max(outstanding - principalPaid, 0));
      const willClose = newOutstanding <= EPSILON;
      const receiptNo = input.receiptNo?.trim() || await this.nextReceiptNo(organizationId, tx);

      // ---- Ledger posting ----
      const customMappings = input.customGlMappings;
      const paymentAccount = input.paymentAccountId
        ? await this.getAccountById(organizationId, input.paymentAccountId, tx)
        : await this.resolveAccount(organizationId, 'cash_bank', loan.branchId, tx, customMappings);
      if (!paymentAccount) throw new Error('Payment account not found in this organization.');

      const who = `${loan.memberName} (${loan.memberNo})`;
      const legs: Array<{ account: LedgerAccount; debit?: number; credit?: number; narration: string }> = [
        { account: paymentAccount, debit: totalPaid, narration: `Loan repayment ${receiptNo} — ${who}` },
      ];
      if (principalPaid > 0) {
        const receivable = await this.resolveAccount(organizationId, 'loan_principal_receivable', loan.branchId, tx, customMappings);
        legs.push({
          account: receivable,
          credit: principalPaid,
          narration: `Principal recovered on loan ${loan.loanNo} — ${who}`,
        });
      }
      if (interestPaid > 0) {
        const interestIncome = await this.resolveAccount(organizationId, 'loan_interest_income', loan.branchId, tx, customMappings);
        legs.push({
          account: interestIncome,
          credit: interestPaid,
          narration: `Interest earned on loan ${loan.loanNo} — ${who}`,
        });
      }
      if (penaltyPaid > 0) {
        const penaltyIncome = await this.resolveAccount(organizationId, 'loan_penalty_income', loan.branchId, tx, customMappings);
        legs.push({
          account: penaltyIncome,
          credit: penaltyPaid,
          narration: `Penalty recovered on loan ${loan.loanNo} — ${who}`,
        });
      }

      const voucherNo = await this.nextJournalVoucherNo(organizationId, tx);
      const voucher = await this.postVoucher(tx, organizationId, {
        voucherNo,
        dateBs: input.dateBs,
        dateAd: input.dateAd,
        branchId: loan.branchId,
        preparedBy: input.collectedBy,
        narration: input.narration
          ?? `Loan repayment ${receiptNo} on ${loan.loanNo}: ${who} रु.${totalPaid}`,
        moduleReference: `LOAN_REPAY:${voucherNo}`,
      }, legs);

      // ---- Repayment record ----
      const repaymentRows = await tx.insert(loanRepayments).values({
        organizationId,
        loanId: loan.id,
        memberId: loan.memberId,
        receiptNo,
        principalPaid: String(principalPaid),
        interestPaid: String(interestPaid),
        penaltyPaid: String(penaltyPaid),
        totalPaid: String(totalPaid),
        outstandingAfter: String(newOutstanding),
        paymentMode: input.paymentMode,
        dateBs: input.dateBs,
        dateAd: input.dateAd,
        collectedBy: input.collectedBy,
        branchId: loan.branchId,
        voucherNo,
      }).returning();

      // ---- Settle penalties oldest-first with whatever penalty cash arrived ----
      let penaltyRemaining = penaltyPaid;
      const penaltiesSettled: string[] = [];
      for (const penalty of dueRows) {
        if (penaltyRemaining <= EPSILON) break;
        const amount = num(penalty.penaltyAmount);
        if (amount - penaltyRemaining > EPSILON) break; // partial — leave open
        await tx.update(loanPenalties)
          .set({ isPaid: true, paidDateBs: input.dateBs })
          .where(and(
            eq(loanPenalties.id, penalty.id),
            eq(loanPenalties.organizationId, organizationId),
          ));
        penaltyRemaining = money(penaltyRemaining - amount);
        penaltiesSettled.push(penalty.id);
      }

      // ---- Close installments the payment fully covers, oldest-first ----
      const openInstallments: any = await tx.select().from(emiSchedules)
        .where(and(
          eq(emiSchedules.organizationId, organizationId),
          eq(emiSchedules.loanId, loan.id),
          inArray(emiSchedules.status, ['Due', 'Overdue']),
        ))
        .orderBy(asc(emiSchedules.installmentNo));

      let emiCredit = money(principalPaid + interestPaid);
      const installmentsClosed: number[] = [];
      for (const inst of openInstallments) {
        const due = num(inst.totalEmi);
        if (due - emiCredit > EPSILON) break; // cannot fully clear this one
        await tx.update(emiSchedules)
          .set({ status: 'Paid', paidDateBs: input.dateBs, paidAmount: String(due) })
          .where(and(eq(emiSchedules.id, inst.id), eq(emiSchedules.organizationId, organizationId)));
        emiCredit = money(emiCredit - due);
        installmentsClosed.push(Number(inst.installmentNo));
      }

      // A loan cleared in full has no remaining arrears by definition.
      if (willClose) {
        await tx.update(emiSchedules)
          .set({ status: 'Paid', paidDateBs: input.dateBs })
          .where(and(
            eq(emiSchedules.organizationId, organizationId),
            eq(emiSchedules.loanId, loan.id),
            inArray(emiSchedules.status, ['Due', 'Overdue']),
          ));
      }

      // ---- Member sub-book ----
      const prevBalance = await this.lastSubBookBalance(organizationId, loan.memberId, loan.loanNo, tx);
      const remaining = prevBalance > 0 ? money(Math.max(prevBalance - principalPaid, 0)) : newOutstanding;
      await tx.insert(subsidiaryLoansBook).values({
        organizationId,
        memberId: loan.memberId,
        loanAccountNo: loan.loanNo,
        voucherNo,
        transactionDateBs: input.dateBs,
        principalDebit: '0',
        principalCredit: String(principalPaid),
        interestCredit: String(interestPaid),
        penaltyCredit: String(penaltyPaid),
        remainingPrincipal: String(remaining),
      });

      // ---- Loan account state ----
      const updated = await tx.update(loanAccounts)
        .set({
          outstandingPrincipal: String(newOutstanding),
          lastRepaymentDateBs: input.dateBs,
          status: willClose ? 'Closed' : loan.status,
          ...(willClose ? { daysOverdue: 0, overdueAmount: '0', nplStatus: 'Pass' as const } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(loanAccounts.id, loan.id), eq(loanAccounts.organizationId, organizationId)))
        .returning();

      return {
        repayment: repaymentRows[0],
        loan: updated[0],
        voucherId: voucher.id,
        voucherNo,
        receiptNo,
        totalPaid,
        outstandingAfter: newOutstanding,
        closed: willClose,
        installmentsClosed,
        penaltiesSettled: penaltiesSettled.length,
        glEntries: legs
          .filter((l) => num(l.debit) > 0 || num(l.credit) > 0)
          .map((l) => ({
            accountCode: l.account.code,
            accountName: l.account.name,
            debit: money(num(l.debit)),
            credit: money(num(l.credit)),
            narration: l.narration,
          })),
      };
    });
  }

  // =========================================================================
  // 3. ARREARS: PENALTY ACCRUAL + CLASSIFICATION
  // =========================================================================

  /**
   * Measures arrears on a loan as at a date and records any late-payment
   * penalty that has accrued since the last run.
   *
   * The penalty rate is the loan product's `penalty_rate` (per annum) applied
   * to the overdue instalment amount over the days it has been late, after the
   * org's configured grace period. Nothing here is hardcoded: a product with a
   * zero penalty rate accrues nothing, and a zero grace period is honoured.
   *
   * Penalty income is recognised in the ledger when it is COLLECTED (see
   * recordRepayment), not when it accrues — accruing unpaid penalty straight
   * to income would inflate reported earnings with money that may never
   * arrive. The accrual is therefore a memorandum record on loan_penalties
   * plus the arrears counters on the loan.
   */
  async accruePenalty(organizationId: string, input: PenaltyAccrualInput, branchIds?: string[]) {
    return this.db.transaction(async (tx) => {
      const loan = await this.lockLoan(tx, input.loanId, organizationId, branchIds);
      if (loan.status !== 'Disbursed') {
        return {
          loanId: loan.id,
          loanNo: loan.loanNo,
          skipped: true,
          reason: `Loan is '${loan.status}' — arrears are only tracked on disbursed loans.`,
          daysOverdue: 0,
          overdueAmount: 0,
          penaltyAccrued: 0,
        };
      }

      const policy = await this.getProvisioningSettings(organizationId, tx);
      const graceDays = Number(policy?.penaltyGraceDays ?? 0) || 0;

      let penaltyRatePct = 0;
      if (loan.loanProductId) {
        const productRows: any = await tx.select({ rate: loanProducts.penaltyRate })
          .from(loanProducts)
          .where(and(
            eq(loanProducts.id, loan.loanProductId),
            eq(loanProducts.organizationId, organizationId),
          ))
          .limit(1);
        penaltyRatePct = num(productRows?.[0]?.rate);
      }

      // Unpaid installments already past their due date.
      const openInstallments: any = await tx.select().from(emiSchedules)
        .where(and(
          eq(emiSchedules.organizationId, organizationId),
          eq(emiSchedules.loanId, loan.id),
          inArray(emiSchedules.status, ['Due', 'Overdue']),
        ))
        .orderBy(asc(emiSchedules.installmentNo));

      let overdueAmount = 0;
      let maxDaysOverdue = 0;
      let penaltyAccrued = 0;
      const overdueIds: string[] = [];

      for (const inst of openInstallments) {
        const daysLate = daysBetweenBS(String(inst.dueDateBs), input.asOfDateBs);
        if (daysLate <= graceDays) continue;
        const chargeableDays = daysLate - graceDays;
        const amount = num(inst.totalEmi);
        overdueAmount = money(overdueAmount + amount);
        if (daysLate > maxDaysOverdue) maxDaysOverdue = daysLate;
        overdueIds.push(inst.id);
        if (penaltyRatePct > 0) {
          // Simple daily accrual on the overdue instalment.
          penaltyAccrued = money(penaltyAccrued + (amount * (penaltyRatePct / 100) * chargeableDays) / 365);
        }
      }

      if (overdueIds.length) {
        await tx.update(emiSchedules)
          .set({ status: 'Overdue' })
          .where(and(
            eq(emiSchedules.organizationId, organizationId),
            inArray(emiSchedules.id, overdueIds),
          ));
      }

      // Idempotent per (loan, date): re-running the same accrual date replaces
      // that day's unpaid, unwaived accrual instead of stacking duplicates.
      let penaltyId: string | null = null;
      if (penaltyAccrued > EPSILON) {
        await tx.delete(loanPenalties).where(and(
          eq(loanPenalties.organizationId, organizationId),
          eq(loanPenalties.loanId, loan.id),
          eq(loanPenalties.penaltyDateBs, input.asOfDateBs),
          eq(loanPenalties.isPaid, false),
          eq(loanPenalties.waived, false),
        ));
        const inserted = await tx.insert(loanPenalties).values({
          organizationId,
          loanId: loan.id,
          memberId: loan.memberId,
          penaltyDateBs: input.asOfDateBs,
          daysOverdue: maxDaysOverdue,
          penaltyRate: String(penaltyRatePct),
          penaltyAmount: String(penaltyAccrued),
          isPaid: false,
          waived: false,
        }).returning();
        penaltyId = inserted[0]?.id ?? null;
      }

      // Re-grade the loan from the freshly measured arrears.
      const grade = this.gradeArrears(policy, maxDaysOverdue, num(loan.outstandingPrincipal));

      const updated = await tx.update(loanAccounts)
        .set({
          daysOverdue: maxDaysOverdue,
          overdueAmount: String(overdueAmount),
          ...(policy?.autoClassifyOnAccrual !== false
            ? { nplStatus: grade.nplStatus, provisionAmount: String(grade.provisionAmount) }
            : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(loanAccounts.id, loan.id), eq(loanAccounts.organizationId, organizationId)))
        .returning();

      return {
        loanId: loan.id,
        loanNo: loan.loanNo,
        memberName: loan.memberName,
        skipped: false,
        daysOverdue: maxDaysOverdue,
        overdueAmount,
        penaltyAccrued,
        penaltyId,
        penaltyRatePct,
        graceDays,
        nplStatus: updated[0]?.nplStatus ?? grade.nplStatus,
        provisionAmount: num(updated[0]?.provisionAmount),
        overdueInstallments: overdueIds.length,
      };
    });
  }

  /**
   * Maps days-overdue to a classification band and provision amount using the
   * org's configured policy. Bands and percentages come entirely from
   * loan_provisioning_settings — the regulator's thresholds change, so they
   * must never be compiled in.
   */
  private gradeArrears(
    policy: any,
    daysOverdue: number,
    outstandingPrincipal: number,
  ): { nplStatus: 'Pass' | 'Watchlist' | 'Substandard' | 'Doubtful' | 'Loss'; provisionAmount: number; provisionPercent: number } {
    const bands: Array<{
      status: 'Loss' | 'Doubtful' | 'Substandard' | 'Watchlist';
      minDays: number;
      pct: number;
    }> = [
      { status: 'Loss', minDays: Number(policy?.lossMinDays ?? 366), pct: num(policy?.lossProvisionPercent) },
      { status: 'Doubtful', minDays: Number(policy?.doubtfulMinDays ?? 181), pct: num(policy?.doubtfulProvisionPercent) },
      { status: 'Substandard', minDays: Number(policy?.substandardMinDays ?? 91), pct: num(policy?.substandardProvisionPercent) },
      { status: 'Watchlist', minDays: Number(policy?.watchlistMinDays ?? 31), pct: num(policy?.watchlistProvisionPercent) },
    ];

    for (const band of bands) {
      if (daysOverdue >= band.minDays) {
        return {
          nplStatus: band.status,
          provisionPercent: band.pct,
          provisionAmount: money((outstandingPrincipal * band.pct) / 100),
        };
      }
    }
    const passPct = num(policy?.passProvisionPercent);
    return {
      nplStatus: 'Pass',
      provisionPercent: passPct,
      provisionAmount: money((outstandingPrincipal * passPct) / 100),
    };
  }

  /**
   * Re-grades a loan's NPL status and provision without touching penalties.
   * Used by the portfolio classification run.
   */
  async classify(organizationId: string, loanId: string, asOfDateBs: string, branchIds?: string[]) {
    return this.db.transaction(async (tx) => {
      const loan = await this.lockLoan(tx, loanId, organizationId, branchIds);
      const policy = await this.getProvisioningSettings(organizationId, tx);
      const graceDays = Number(policy?.penaltyGraceDays ?? 0) || 0;

      let daysOverdue = 0;
      let overdueAmount = 0;
      if (loan.status === 'Disbursed') {
        const openInstallments: any = await tx.select().from(emiSchedules)
          .where(and(
            eq(emiSchedules.organizationId, organizationId),
            eq(emiSchedules.loanId, loan.id),
            inArray(emiSchedules.status, ['Due', 'Overdue']),
          ));
        for (const inst of openInstallments) {
          const daysLate = daysBetweenBS(String(inst.dueDateBs), asOfDateBs);
          if (daysLate <= graceDays) continue;
          overdueAmount = money(overdueAmount + num(inst.totalEmi));
          if (daysLate > daysOverdue) daysOverdue = daysLate;
        }
      }

      const grade = this.gradeArrears(policy, daysOverdue, num(loan.outstandingPrincipal));
      const updated = await tx.update(loanAccounts)
        .set({
          daysOverdue,
          overdueAmount: String(overdueAmount),
          nplStatus: grade.nplStatus,
          provisionAmount: String(grade.provisionAmount),
          updatedAt: new Date(),
        })
        .where(and(eq(loanAccounts.id, loan.id), eq(loanAccounts.organizationId, organizationId)))
        .returning();

      return {
        loanId: loan.id,
        loanNo: loan.loanNo,
        memberName: loan.memberName,
        daysOverdue,
        overdueAmount,
        nplStatus: grade.nplStatus,
        provisionPercent: grade.provisionPercent,
        provisionAmount: grade.provisionAmount,
        outstandingPrincipal: num(updated[0]?.outstandingPrincipal),
      };
    });
  }

  /** Ids of the loans a portfolio-wide arrears/classification run should visit. */
  async listServiceableLoanIds(organizationId: string, branchIds?: string[]): Promise<string[]> {
    const rows = await this.db.select({ id: loanAccounts.id })
      .from(loanAccounts)
      .where(and(
        eq(loanAccounts.organizationId, organizationId),
        eq(loanAccounts.status, 'Disbursed'),
        ...(branchIds !== undefined ? [inArray(loanAccounts.branchId, branchIds)] : []),
      ))
      .orderBy(asc(loanAccounts.loanNo));
    return rows.map((r) => r.id);
  }

  // =========================================================================
  // 4. PENALTY WAIVER
  // =========================================================================

  /** Audited waiver of an unpaid penalty. Waived penalties never reach income. */
  async waivePenalty(
    organizationId: string,
    input: { penaltyId: string; reason: string; waivedBy?: string | null },
    branchIds?: string[],
  ) {
    return this.db.transaction(async (tx) => {
      const rows: any = await tx.select().from(loanPenalties)
        .where(and(
          eq(loanPenalties.id, input.penaltyId),
          eq(loanPenalties.organizationId, organizationId),
        ))
        .limit(1);
      const penalty = rows[0];
      if (!penalty) throw new Error('Penalty not found.');
      if (penalty.waived) throw new Error('This penalty has already been waived.');
      if (penalty.isPaid) throw new Error('A penalty that has already been paid cannot be waived.');

      // Confirms the caller may act on this loan's branch.
      await this.lockLoan(tx, penalty.loanId, organizationId, branchIds);

      const updated = await tx.update(loanPenalties)
        .set({
          waived: true,
          waivedReason: input.reason,
          waivedBy: input.waivedBy ?? null,
        })
        .where(and(
          eq(loanPenalties.id, penalty.id),
          eq(loanPenalties.organizationId, organizationId),
        ))
        .returning();
      return updated[0];
    });
  }

  // =========================================================================
  // 5. RESCHEDULE
  // =========================================================================

  /**
   * Re-terms a disbursed loan: the remaining principal is re-amortised over a
   * new tenure at a new rate, and the unpaid part of the schedule is replaced.
   *
   * Paid installments are left exactly as they were — restating settled history
   * would break the ledger's agreement with the sub-book. The principal balance
   * is unchanged, so there is no journal entry to post.
   */
  async reschedule(organizationId: string, input: RescheduleInput, branchIds?: string[]) {
    return this.db.transaction(async (tx) => {
      const loan = await this.lockLoan(tx, input.loanId, organizationId, branchIds);
      if (loan.status !== 'Disbursed') {
        throw new Error(`Only a disbursed loan can be rescheduled — this loan is '${loan.status}'.`);
      }
      if (input.newTenureMonths <= 0) throw new Error('New tenure must be at least one month.');
      if (input.newRatePct < 0) throw new Error('New interest rate cannot be negative.');

      const remainingPrincipal = num(loan.outstandingPrincipal);
      if (remainingPrincipal <= 0) {
        throw new Error('This loan has no outstanding principal left to reschedule.');
      }

      // Product bounds still apply to the new term.
      if (loan.loanProductId) {
        const productRows: any = await tx.select({
          minTenure: loanProducts.minTenureMonths,
          maxTenure: loanProducts.maxTenureMonths,
        })
          .from(loanProducts)
          .where(and(
            eq(loanProducts.id, loan.loanProductId),
            eq(loanProducts.organizationId, organizationId),
          ))
          .limit(1);
        const product = productRows?.[0];
        if (product) {
          const min = Number(product.minTenure) || 0;
          const max = Number(product.maxTenure) || 0;
          if (min > 0 && input.newTenureMonths < min) {
            throw new Error(`New tenure is below the product minimum of ${min} months.`);
          }
          if (max > 0 && input.newTenureMonths > max) {
            throw new Error(`New tenure exceeds the product maximum of ${max} months.`);
          }
        }
      }

      const paidRows: any = await tx.select({ installmentNo: emiSchedules.installmentNo })
        .from(emiSchedules)
        .where(and(
          eq(emiSchedules.organizationId, organizationId),
          eq(emiSchedules.loanId, loan.id),
          eq(emiSchedules.status, 'Paid'),
        ))
        .orderBy(desc(emiSchedules.installmentNo))
        .limit(1);
      const lastPaidNo = Number(paidRows?.[0]?.installmentNo ?? 0);

      const settings = await this.getScheduleSettings(organizationId, tx);
      const schedule = generateLoanSchedule({
        principal: remainingPrincipal,
        annualRatePct: input.newRatePct,
        tenureMonths: input.newTenureMonths,
        method: loan.interestMethod as LoanInterestMethod,
        startDateBs: input.effectiveDateBs,
        installmentDayOfMonth: settings.installmentDayOfMonth,
        dayCount: settings.dayCount,
        rounding: settings.rounding,
        shiftToWorkingDay: settings.shiftToWorkingDay,
      });
      if (!schedule.installments.length) {
        throw new Error('Could not build a rescheduled installment plan.');
      }

      // Replace only the unpaid tail of the schedule.
      await tx.delete(emiSchedules).where(and(
        eq(emiSchedules.organizationId, organizationId),
        eq(emiSchedules.loanId, loan.id),
        inArray(emiSchedules.status, ['Due', 'Overdue']),
      ));

      await tx.insert(emiSchedules).values(schedule.installments.map((i) => ({
        organizationId,
        loanId: loan.id,
        installmentNo: lastPaidNo + i.installmentNo,
        dueDateBs: i.dueDateBs,
        principal: String(i.principal),
        interest: String(i.interest),
        totalEmi: String(i.totalEmi),
        balancePrincipal: String(i.balancePrincipal),
        status: 'Due' as const,
      })));

      const maturityDateBs = schedule.installments[schedule.installments.length - 1].dueDateBs;

      const auditRows = await tx.insert(loanReschedules).values({
        organizationId,
        loanId: loan.id,
        rescheduledDateBs: input.effectiveDateBs,
        previousTenure: Number(loan.tenureMonths) || 0,
        newTenure: input.newTenureMonths,
        previousRate: String(num(loan.interestRate)),
        newRate: String(input.newRatePct),
        previousEmi: String(num(loan.monthlyEmi)),
        newEmi: String(schedule.monthlyPayment),
        reason: input.reason,
        approvedBy: input.approvedBy ?? null,
      }).returning();

      // Arrears are re-measured against the new due dates on the next run.
      const updated = await tx.update(loanAccounts)
        .set({
          tenureMonths: input.newTenureMonths,
          interestRate: String(input.newRatePct),
          monthlyEmi: String(schedule.monthlyPayment),
          maturityDateBs,
          daysOverdue: 0,
          overdueAmount: '0',
          updatedAt: new Date(),
        })
        .where(and(eq(loanAccounts.id, loan.id), eq(loanAccounts.organizationId, organizationId)))
        .returning();

      return {
        loan: updated[0],
        reschedule: auditRows[0],
        maturityDateBs,
        newEmi: schedule.monthlyPayment,
        totalInterest: schedule.totalInterest,
        installmentCount: schedule.installments.length,
        firstInstallmentNo: lastPaidNo + 1,
      };
    });
  }

  // =========================================================================
  // 6. WRITE-OFF
  // =========================================================================

  /**
   * Writes off an irrecoverable loan and removes the receivable from the books.
   *
   * The charge is absorbed by the loan-loss allowance up to the provision
   * already carried on the loan, and only the uncovered excess hits provision
   * expense. That is what the allowance is for: if the co-operative has been
   * provisioning as loans deteriorated, the write-off should not land as a
   * fresh shock to the current period's surplus.
   */
  async writeOff(organizationId: string, input: WriteOffInput, branchIds?: string[]) {
    return this.db.transaction(async (tx) => {
      const loan = await this.lockLoan(tx, input.loanId, organizationId, branchIds);
      if (loan.status !== 'Disbursed') {
        throw new Error(`Only a disbursed loan can be written off — this loan is '${loan.status}'.`);
      }

      const outstanding = num(loan.outstandingPrincipal);
      if (outstanding <= 0) throw new Error('This loan has no outstanding principal to write off.');

      const principalAmount = input.principalAmount != null
        ? money(num(input.principalAmount))
        : outstanding;
      if (principalAmount <= 0) throw new Error('Write-off amount must be greater than zero.');
      if (principalAmount > outstanding + EPSILON) {
        throw new Error(
          `Write-off amount (${principalAmount}) exceeds the outstanding balance (${outstanding}).`,
        );
      }
      const interestAmount = money(num(input.interestAmount));
      const totalWrittenOff = money(principalAmount + interestAmount);

      // Allowance absorbs up to the provision already carried; the rest is expensed.
      const carriedProvision = money(num(loan.provisionAmount));
      const fromAllowance = money(Math.min(carriedProvision, principalAmount));
      const fromExpense = money(principalAmount - fromAllowance);

      const customMappings = input.customGlMappings;
      const receivable = await this.resolveAccount(organizationId, 'loan_principal_receivable', loan.branchId, tx, customMappings);
      const who = `${loan.memberName} (${loan.memberNo})`;
      const legs: Array<{ account: LedgerAccount; debit?: number; credit?: number; narration: string }> = [];

      if (fromAllowance > 0) {
        const allowance = await this.resolveAccount(organizationId, 'loan_loss_allowance', loan.branchId, tx, customMappings);
        legs.push({
          account: allowance,
          debit: fromAllowance,
          narration: `Loan-loss allowance applied to ${loan.loanNo} — ${who}`,
        });
      }
      if (fromExpense > 0) {
        const expense = await this.resolveAccount(organizationId, 'loan_loss_provision_expense', loan.branchId, tx, customMappings);
        legs.push({
          account: expense,
          debit: fromExpense,
          narration: `Loan loss on write-off of ${loan.loanNo} — ${who}`,
        });
      }
      legs.push({
        account: receivable,
        credit: principalAmount,
        narration: `Principal written off on ${loan.loanNo} — ${who}`,
      });

      // Uncollected accrued interest written off alongside the principal is a
      // reversal of income that was never received, so it is expensed too.
      if (interestAmount > 0) {
        const expense = await this.resolveAccount(organizationId, 'loan_loss_provision_expense', loan.branchId, tx, customMappings);
        const interestIncome = await this.resolveAccount(organizationId, 'loan_interest_income', loan.branchId, tx, customMappings);
        legs.push({
          account: expense,
          debit: interestAmount,
          narration: `Interest written off on ${loan.loanNo} — ${who}`,
        });
        legs.push({
          account: interestIncome,
          credit: interestAmount,
          narration: `Interest reversed on write-off of ${loan.loanNo} — ${who}`,
        });
      }

      const voucherNo = await this.nextJournalVoucherNo(organizationId, tx);
      const voucher = await this.postVoucher(tx, organizationId, {
        voucherNo,
        dateBs: input.dateBs,
        dateAd: input.dateAd,
        branchId: loan.branchId,
        preparedBy: input.processedBy,
        narration: `Loan write-off ${loan.loanNo}: ${who} रु.${totalWrittenOff} — ${input.reason}`,
        moduleReference: `LOAN_WRITEOFF:${voucherNo}`,
      }, legs);

      const auditRows = await tx.insert(loanWriteoffs).values({
        organizationId,
        loanId: loan.id,
        memberId: loan.memberId,
        writeoffDateBs: input.dateBs,
        principalWrittenOff: String(principalAmount),
        interestWrittenOff: String(interestAmount),
        totalWrittenOff: String(totalWrittenOff),
        reason: input.reason,
        approvedBy: input.approvedBy ?? null,
        voucherNo,
      }).returning();

      const newOutstanding = money(Math.max(outstanding - principalAmount, 0));
      const fullyWrittenOff = newOutstanding <= EPSILON;

      const prevBalance = await this.lastSubBookBalance(organizationId, loan.memberId, loan.loanNo, tx);
      await tx.insert(subsidiaryLoansBook).values({
        organizationId,
        memberId: loan.memberId,
        loanAccountNo: loan.loanNo,
        voucherNo,
        transactionDateBs: input.dateBs,
        principalDebit: '0',
        principalCredit: String(principalAmount),
        interestCredit: '0',
        penaltyCredit: '0',
        remainingPrincipal: String(prevBalance > 0 ? money(Math.max(prevBalance - principalAmount, 0)) : newOutstanding),
      });

      if (fullyWrittenOff) {
        await tx.update(emiSchedules)
          .set({ status: 'Paid', paidDateBs: input.dateBs })
          .where(and(
            eq(emiSchedules.organizationId, organizationId),
            eq(emiSchedules.loanId, loan.id),
            inArray(emiSchedules.status, ['Due', 'Overdue']),
          ));
      }

      const updated = await tx.update(loanAccounts)
        .set({
          outstandingPrincipal: String(newOutstanding),
          status: fullyWrittenOff ? 'Written_Off' : loan.status,
          nplStatus: 'Loss',
          provisionAmount: fullyWrittenOff ? '0' : String(money(Math.max(carriedProvision - fromAllowance, 0))),
          updatedAt: new Date(),
        })
        .where(and(eq(loanAccounts.id, loan.id), eq(loanAccounts.organizationId, organizationId)))
        .returning();

      return {
        loan: updated[0],
        writeoff: auditRows[0],
        voucherId: voucher.id,
        voucherNo,
        principalWrittenOff: principalAmount,
        interestWrittenOff: interestAmount,
        totalWrittenOff,
        fromAllowance,
        fromExpense,
        fullyWrittenOff,
      };
    });
  }

  // =========================================================================
  // READS
  // =========================================================================

  /**
   * Dry-run of the schedule a disbursement on `startDateBs` would produce.
   *
   * Reads only — nothing is written and no lock is taken — so the loan officer
   * can see the installment plan, total interest and maturity date before
   * committing. Uses the identical engine call as disburse(), so the preview
   * cannot drift from what actually gets booked.
   */
  async previewSchedule(organizationId: string, loanId: string, startDateBs: string, branchIds?: string[]) {
    const loan = await this.requireLoan(organizationId, loanId, branchIds);

    const principal = num(loan.approvedAmount);
    const tenureMonths = Number(loan.tenureMonths) || 0;
    if (principal <= 0 || tenureMonths <= 0) {
      throw new Error('This loan needs an approved amount and a tenure before a schedule can be previewed.');
    }

    const settings = await this.getScheduleSettings(organizationId, this.db);
    const schedule = generateLoanSchedule({
      principal,
      annualRatePct: num(loan.interestRate),
      tenureMonths,
      method: loan.interestMethod as LoanInterestMethod,
      startDateBs,
      installmentDayOfMonth: settings.installmentDayOfMonth,
      dayCount: settings.dayCount,
      rounding: settings.rounding,
      shiftToWorkingDay: settings.shiftToWorkingDay,
    });

    let processingFeePercent = 0;
    if (loan.loanProductId) {
      const productRows = await this.db.select({ pct: loanProducts.processingFeePercent })
        .from(loanProducts)
        .where(and(
          eq(loanProducts.id, loan.loanProductId),
          eq(loanProducts.organizationId, organizationId),
        ))
        .limit(1);
      processingFeePercent = num(productRows?.[0]?.pct);
    }
    const processingFee = money((principal * processingFeePercent) / 100);

    return {
      loanId,
      loanNo: loan.loanNo,
      memberName: loan.memberName,
      memberNo: loan.memberNo,
      status: loan.status,
      canDisburse: loan.status === 'Approved',
      principal,
      annualRatePct: num(loan.interestRate),
      interestMethod: loan.interestMethod,
      tenureMonths,
      startDateBs,
      maturityDateBs: schedule.installments[schedule.installments.length - 1]?.dueDateBs ?? null,
      monthlyEmi: schedule.monthlyPayment,
      totalInterest: schedule.totalInterest,
      totalPayment: schedule.totalPayment,
      processingFeePercent,
      processingFee,
      netDisbursable: money(principal - processingFee),
      installments: schedule.installments,
      settings,
    };
  }

  /** Installment schedule with live arrears flags for the loan detail screen. */
  async getSchedule(organizationId: string, loanId: string, asOfDateBs: string, branchIds?: string[]) {
    const loan = await this.requireLoan(organizationId, loanId, branchIds);
    const rows = await this.db.select().from(emiSchedules)
      .where(and(
        eq(emiSchedules.organizationId, organizationId),
        eq(emiSchedules.loanId, loanId),
      ))
      .orderBy(asc(emiSchedules.installmentNo));

    return rows.map((r) => {
      const daysLate = r.status === 'Paid' ? 0 : Math.max(daysBetweenBS(String(r.dueDateBs), asOfDateBs), 0);
      return {
        id: r.id,
        installmentNo: r.installmentNo,
        dueDateBs: r.dueDateBs,
        principal: num(r.principal),
        interest: num(r.interest),
        totalEmi: num(r.totalEmi),
        balancePrincipal: num(r.balancePrincipal),
        status: r.status,
        paidDateBs: r.paidDateBs,
        paidAmount: r.paidAmount == null ? null : num(r.paidAmount),
        daysLate,
        loanNo: loan.loanNo,
      };
    });
  }

  /**
   * What the member owes right now: the unpaid installments that have fallen
   * due, split into principal / interest, plus outstanding penalties. The
   * teller screen prefills the collection form from this instead of the
   * operator guessing the split.
   */
  async getDueBreakdown(organizationId: string, loanId: string, asOfDateBs: string, branchIds?: string[]) {
    const loan = await this.requireLoan(organizationId, loanId, branchIds);

    const open = await this.db.select().from(emiSchedules)
      .where(and(
        eq(emiSchedules.organizationId, organizationId),
        eq(emiSchedules.loanId, loanId),
        inArray(emiSchedules.status, ['Due', 'Overdue']),
      ))
      .orderBy(asc(emiSchedules.installmentNo));

    let principalDue = 0;
    let interestDue = 0;
    let installmentsDue = 0;
    let nextDueDateBs: string | null = null;
    for (const inst of open) {
      if (!nextDueDateBs) nextDueDateBs = String(inst.dueDateBs);
      if (daysBetweenBS(String(inst.dueDateBs), asOfDateBs) < 0) continue; // not yet due
      principalDue = money(principalDue + num(inst.principal));
      interestDue = money(interestDue + num(inst.interest));
      installmentsDue += 1;
    }

    const penalties = await this.db.select().from(loanPenalties)
      .where(and(
        eq(loanPenalties.organizationId, organizationId),
        eq(loanPenalties.loanId, loanId),
        eq(loanPenalties.isPaid, false),
        eq(loanPenalties.waived, false),
      ));
    const penaltyDue = money(penalties.reduce((s, p) => s + num(p.penaltyAmount), 0));

    const outstandingPrincipal = num(loan.outstandingPrincipal);
    return {
      loanId,
      loanNo: loan.loanNo,
      memberName: loan.memberName,
      memberNo: loan.memberNo,
      status: loan.status,
      outstandingPrincipal,
      installmentsDue,
      principalDue: money(Math.min(principalDue, outstandingPrincipal)),
      interestDue,
      penaltyDue,
      totalDue: money(Math.min(principalDue, outstandingPrincipal) + interestDue + penaltyDue),
      nextDueDateBs,
      daysOverdue: Number(loan.daysOverdue) || 0,
      nplStatus: loan.nplStatus,
      asOfDateBs,
    };
  }

  async listPenalties(organizationId: string, loanId: string, branchIds?: string[]) {
    await this.requireLoan(organizationId, loanId, branchIds);
    const rows = await this.db.select().from(loanPenalties)
      .where(and(
        eq(loanPenalties.organizationId, organizationId),
        eq(loanPenalties.loanId, loanId),
      ))
      .orderBy(desc(loanPenalties.penaltyDateBs));
    return rows.map((r) => ({
      id: r.id,
      penaltyDateBs: r.penaltyDateBs,
      daysOverdue: r.daysOverdue,
      penaltyRate: num(r.penaltyRate),
      penaltyAmount: num(r.penaltyAmount),
      isPaid: r.isPaid,
      paidDateBs: r.paidDateBs,
      waived: r.waived,
      waivedReason: r.waivedReason,
    }));
  }

  async listReschedules(organizationId: string, loanId: string, branchIds?: string[]) {
    await this.requireLoan(organizationId, loanId, branchIds);
    const rows = await this.db.select().from(loanReschedules)
      .where(and(
        eq(loanReschedules.organizationId, organizationId),
        eq(loanReschedules.loanId, loanId),
      ))
      .orderBy(desc(loanReschedules.rescheduledDateBs));
    return rows.map((r) => ({
      id: r.id,
      rescheduledDateBs: r.rescheduledDateBs,
      previousTenure: r.previousTenure,
      newTenure: r.newTenure,
      previousRate: num(r.previousRate),
      newRate: num(r.newRate),
      previousEmi: num(r.previousEmi),
      newEmi: num(r.newEmi),
      reason: r.reason,
    }));
  }

  /** EMI repayment receipts for a specific loan. */
  async getRepayments(organizationId: string, loanId: string, branchIds?: string[]) {
    await this.requireLoan(organizationId, loanId, branchIds);
    const rows = await this.db.select().from(loanRepayments)
      .where(and(
        eq(loanRepayments.organizationId, organizationId),
        eq(loanRepayments.loanId, loanId),
      ))
      .orderBy(desc(loanRepayments.dateBs), desc(loanRepayments.createdAt));

    return rows.map((r) => ({
      id: r.id,
      receiptNo: r.receiptNo,
      principalPaid: num(r.principalPaid),
      interestPaid: num(r.interestPaid),
      penaltyPaid: num(r.penaltyPaid),
      totalPaid: num(r.totalPaid),
      outstandingAfter: num(r.outstandingAfter),
      paymentMode: r.paymentMode,
      dateBs: r.dateBs,
      dateAd: r.dateAd,
      collectedBy: r.collectedBy,
      voucherNo: r.voucherNo,
      createdAt: r.createdAt,
    }));
  }

  /** Member-wise loan sub-book: the audit trail tying the loan to the GL. */
  async getStatement(organizationId: string, loanId: string, branchIds?: string[]) {
    const loan = await this.requireLoan(organizationId, loanId, branchIds);
    const rows = await this.db.select().from(subsidiaryLoansBook)
      .where(and(
        eq(subsidiaryLoansBook.organizationId, organizationId),
        eq(subsidiaryLoansBook.memberId, loan.memberId),
        eq(subsidiaryLoansBook.loanAccountNo, loan.loanNo),
      ))
      .orderBy(asc(subsidiaryLoansBook.transactionDateBs), asc(subsidiaryLoansBook.createdAt));

    return {
      loanId,
      loanNo: loan.loanNo,
      memberName: loan.memberName,
      memberNo: loan.memberNo,
      outstandingPrincipal: num(loan.outstandingPrincipal),
      entries: rows.map((r) => ({
        id: r.id,
        voucherNo: r.voucherNo,
        transactionDateBs: r.transactionDateBs,
        principalDebit: num(r.principalDebit),
        principalCredit: num(r.principalCredit),
        interestCredit: num(r.interestCredit),
        penaltyCredit: num(r.penaltyCredit),
        remainingPrincipal: num(r.remainingPrincipal),
      })),
    };
  }

  /**
   * Portfolio-at-risk summary grouped by classification band, for the NPL &
   * provisioning screen. Percentages come from the org's policy row.
   */
  async getPortfolioRisk(organizationId: string, branchIds?: string[]) {
    const policy = await this.getProvisioningSettings(organizationId);
    const rows = await this.db.select({
      nplStatus: loanAccounts.nplStatus,
      outstandingPrincipal: loanAccounts.outstandingPrincipal,
      overdueAmount: loanAccounts.overdueAmount,
      provisionAmount: loanAccounts.provisionAmount,
      daysOverdue: loanAccounts.daysOverdue,
    })
      .from(loanAccounts)
      .where(and(
        eq(loanAccounts.organizationId, organizationId),
        inArray(loanAccounts.status, ['Disbursed', 'Written_Off']),
        ...(branchIds !== undefined ? [inArray(loanAccounts.branchId, branchIds)] : []),
      ));

    const bandOrder = ['Pass', 'Watchlist', 'Substandard', 'Doubtful', 'Loss'] as const;
    const percentByBand: Record<string, number> = {
      Pass: num(policy?.passProvisionPercent),
      Watchlist: num(policy?.watchlistProvisionPercent),
      Substandard: num(policy?.substandardProvisionPercent),
      Doubtful: num(policy?.doubtfulProvisionPercent),
      Loss: num(policy?.lossProvisionPercent),
    };

    const bands = bandOrder.map((band) => {
      const inBand = rows.filter((r) => r.nplStatus === band);
      return {
        nplStatus: band,
        loanCount: inBand.length,
        outstandingPrincipal: money(inBand.reduce((s, r) => s + num(r.outstandingPrincipal), 0)),
        overdueAmount: money(inBand.reduce((s, r) => s + num(r.overdueAmount), 0)),
        provisionAmount: money(inBand.reduce((s, r) => s + num(r.provisionAmount), 0)),
        provisionPercent: percentByBand[band] ?? 0,
      };
    });

    const totalOutstanding = money(rows.reduce((s, r) => s + num(r.outstandingPrincipal), 0));
    const nonPerforming = money(
      rows
        .filter((r) => r.nplStatus === 'Substandard' || r.nplStatus === 'Doubtful' || r.nplStatus === 'Loss')
        .reduce((s, r) => s + num(r.outstandingPrincipal), 0),
    );

    return {
      bands,
      loanCount: rows.length,
      totalOutstanding,
      totalOverdue: money(rows.reduce((s, r) => s + num(r.overdueAmount), 0)),
      totalProvision: money(rows.reduce((s, r) => s + num(r.provisionAmount), 0)),
      nonPerformingAmount: nonPerforming,
      nplRatioPercent: totalOutstanding > 0 ? money((nonPerforming / totalOutstanding) * 100) : 0,
      policy: {
        watchlistMinDays: Number(policy?.watchlistMinDays ?? 0),
        substandardMinDays: Number(policy?.substandardMinDays ?? 0),
        doubtfulMinDays: Number(policy?.doubtfulMinDays ?? 0),
        lossMinDays: Number(policy?.lossMinDays ?? 0),
        penaltyGraceDays: Number(policy?.penaltyGraceDays ?? 0),
        autoClassifyOnAccrual: policy?.autoClassifyOnAccrual !== false,
      },
    };
  }

  /** Branch-scoped loan fetch used by the read paths. */
  private async requireLoan(organizationId: string, loanId: string, branchIds?: string[]) {
    const rows = await this.db.select().from(loanAccounts)
      .where(and(
        eq(loanAccounts.id, loanId),
        eq(loanAccounts.organizationId, organizationId),
        ...(branchIds !== undefined ? [inArray(loanAccounts.branchId, branchIds)] : []),
      ))
      .limit(1);
    if (!rows[0]) throw new Error('Loan not found.');
    return rows[0];
  }
}
