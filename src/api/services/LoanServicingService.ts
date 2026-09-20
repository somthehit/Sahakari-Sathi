/**
 * Loan Servicing Service
 * ---------------------------------------------------------------------------
 * Application layer over LoanServicingRepository. Its jobs are:
 *
 *  - Coerce the wire payload (numbers arriving as strings, optional fields)
 *    into the typed shape the repository expects.
 *  - Derive what the client should not be trusted to supply: the AD date is
 *    always computed from the BS date, never accepted from the browser, so the
 *    two can never disagree in the ledger.
 *  - Validate the things that need a policy read rather than a row lock, and
 *    run the portfolio-wide batches (arrears accrual, reclassification) that
 *    loop one locked loan at a time.
 *
 * Deliberately separate from LoanService: that class owns origination
 * (apply / approve / list) and a repayment path that predates general-ledger
 * posting. Nothing here modifies it.
 */
import {
  LoanServicingRepository,
  type DisburseInput,
  type RepaymentInput,
  type RescheduleInput,
  type WriteOffInput,
} from '../repositories/LoanServicingRepository';
import { loanProvisioningSettings } from '../../db/schema';
import { loanAccounts } from '../../db/schema/loans';
import { eq, and, inArray } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { convertBSToAD, getTodayBS, getCurrentFiscalYearCode } from '../../utils/nepaliCalendar';
import { upsertLedgerEntry } from './ledgerUtils';

/** Coerce a wire value (string | number | undefined) to a finite number. */
const num = (v: unknown, fallback = 0): number => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const int = (v: unknown, fallback = 0): number => Math.trunc(num(v, fallback));

/**
 * Fetch per-loan custom GL mappings from the most recent loan application
 * for the given loan's borrower + product. Returns undefined when no overrides
 * exist so the resolver falls back to org-level mappings.
 */
async function fetchCustomGlMappings(organizationId: string, loanId: string): Promise<Record<string, string> | undefined> {
  try {
    const db = getDb();
    if (!db) return undefined;
    const { loanApplications } = await import('../../db/schema/loanApplications');
    const { loanAccounts: la } = await import('../../db/schema/loans');
    // Find the loan application linked to this loan account
    const [loan] = await db.select({ borrowerId: la.memberId, loanProductId: la.loanProductId })
      .from(la)
      .where(and(eq(la.id, loanId), eq(la.organizationId, organizationId)))
      .limit(1);
    if (!loan) return undefined;
    const [app] = await db.select({ customGlMappings: loanApplications.customGlMappings })
      .from(loanApplications)
      .where(and(
        eq(loanApplications.borrowerId, loan.borrowerId),
        eq(loanApplications.loanProductId, loan.loanProductId),
      ))
      .limit(1);
    if (app?.customGlMappings && typeof app.customGlMappings === 'object' && Object.keys(app.customGlMappings).length > 0) {
      return app.customGlMappings as Record<string, string>;
    }
  } catch { /* custom mappings are optional */ }
  return undefined;
}

const BS_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalizes a BS date, defaulting to today. Rejects anything that is not a
 * BS `YYYY-MM-DD` string so a malformed date cannot reach a ledger row, where
 * it would silently land outside every reporting period.
 */
const requireBsDate = (value: unknown, field: string): string => {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : getTodayBS();
  if (!BS_DATE.test(raw)) {
    throw new Error(`${field} must be a Nepali (BS) date in YYYY-MM-DD form.`);
  }
  return raw;
};

/**
 * The AD date is always derived, never taken from the request. If the
 * converter cannot place the BS date (outside its supported range) we fail
 * rather than post a voucher with a wrong or blank AD date.
 */
const deriveAd = (dateBs: string): string => {
  const ad = convertBSToAD(dateBs);
  if (!ad || !BS_DATE.test(ad)) {
    throw new Error(`Could not convert the BS date ${dateBs} to an AD date.`);
  }
  return ad;
};

export interface BatchResult<T> {
  processed: number;
  succeeded: number;
  failed: number;
  results: T[];
  errors: Array<{ loanId: string; error: string }>;
}

export class LoanServicingService {
  private repository: LoanServicingRepository;

  constructor() {
    this.repository = new LoanServicingRepository();
  }

  // =========================================================================
  // DISBURSEMENT
  // =========================================================================

  async disburse(
    organizationId: string,
    payload: Record<string, unknown>,
    processedBy: string,
    branchIds?: string[],
  ) {
    if (!organizationId) throw new Error('Organization context is required.');
    const loanId = String(payload.loanId ?? '').trim();
    if (!loanId) throw new Error('Loan is required.');

    const dateBs = requireBsDate(payload.dateBs, 'Disbursement date');
    const input: DisburseInput = {
      loanId,
      dateBs,
      dateAd: deriveAd(dateBs),
      processedBy,
      disbursementMethod: (payload.disbursementMethod === 'Bank' ? 'Bank' : 'Cash') as 'Cash' | 'Bank',
      paymentAccountId: payload.paymentAccountId ? String(payload.paymentAccountId) : null,
      chequeLeafId: payload.chequeLeafId ? String(payload.chequeLeafId) : null,
      narration: payload.narration ? String(payload.narration) : null,
      deductProcessingFee: payload.deductProcessingFee !== false,
      remarks: payload.remarks ? String(payload.remarks) : null,
      disbursementPaymentMethod: payload.disbursementPaymentMethod
        ? String(payload.disbursementPaymentMethod) as 'CASH' | 'SAVINGS_TRANSFER' | 'CHEQUE'
        : null,
      disbursementReferenceId: payload.disbursementReferenceId
        ? String(payload.disbursementReferenceId)
        : null,
    };

    // Attach per-loan custom GL mappings if the loan application has them
    const customGlMappings = await fetchCustomGlMappings(organizationId, loanId);
    if (customGlMappings) input.customGlMappings = customGlMappings;

    return this.repository.disburse(organizationId, input, branchIds);
  }

  /**
   * Dry-run of the schedule a disbursement would produce, so the officer can
   * see the installment plan and total interest before committing. Reads only.
   */
  async previewDisbursement(
    organizationId: string,
    loanId: string,
    dateBs: string | undefined,
    branchIds?: string[],
  ) {
    if (!organizationId) throw new Error('Organization context is required.');
    return this.repository.previewSchedule(
      organizationId,
      loanId,
      requireBsDate(dateBs, 'Disbursement date'),
      branchIds,
    );
  }

  // =========================================================================
  // REPAYMENT
  // =========================================================================

  async recordRepayment(
    organizationId: string,
    payload: Record<string, unknown>,
    collectedBy: string,
    branchIds?: string[],
  ) {
    if (!organizationId) throw new Error('Organization context is required.');
    const loanId = String(payload.loanId ?? '').trim();
    if (!loanId) throw new Error('Loan is required.');

    const paymentMode = payload.paymentMode === 'Bank_Transfer' ? 'Bank_Transfer' : 'Cash';
    const dateBs = requireBsDate(payload.dateBs, 'Repayment date');

    const input: RepaymentInput = {
      loanId,
      principalPaid: num(payload.principalPaid),
      interestPaid: num(payload.interestPaid),
      penaltyPaid: num(payload.penaltyPaid),
      paymentMode,
      dateBs,
      dateAd: deriveAd(dateBs),
      collectedBy,
      receiptNo: payload.receiptNo ? String(payload.receiptNo).trim() : null,
      paymentAccountId: payload.paymentAccountId ? String(payload.paymentAccountId) : null,
      narration: payload.narration ? String(payload.narration) : null,
    };

    // Attach per-loan custom GL mappings if the loan application has them
    const customGlMappings = await fetchCustomGlMappings(organizationId, loanId);
    if (customGlMappings) input.customGlMappings = customGlMappings;

    return this.repository.recordRepayment(organizationId, input, branchIds);
  }

  /**
   * Prefills a collection: the principal / interest / penalty split the member
   * actually owes as at a date. The teller screen reads this rather than making
   * the operator apportion the payment by hand.
   */
  async getDueBreakdown(
    organizationId: string,
    loanId: string,
    asOfDateBs: string | undefined,
    branchIds?: string[],
  ) {
    if (!organizationId) throw new Error('Organization context is required.');
    return this.repository.getDueBreakdown(
      organizationId,
      loanId,
      requireBsDate(asOfDateBs, 'As-of date'),
      branchIds,
    );
  }

  // =========================================================================
  // ARREARS
  // =========================================================================

  async accruePenalty(
    organizationId: string,
    payload: Record<string, unknown>,
    processedBy: string,
    branchIds?: string[],
  ) {
    if (!organizationId) throw new Error('Organization context is required.');
    const loanId = String(payload.loanId ?? '').trim();
    if (!loanId) throw new Error('Loan is required.');
    return this.repository.accruePenalty(organizationId, {
      loanId,
      asOfDateBs: requireBsDate(payload.asOfDateBs, 'As-of date'),
      processedBy,
    }, branchIds);
  }

  /**
   * Portfolio-wide arrears run.
   *
   * Each loan is processed in its own transaction so one bad row cannot roll
   * back the whole batch, and the failures are reported instead of swallowed —
   * a run that silently skipped half the portfolio would be worse than one
   * that failed loudly. Loans are visited sequentially: they contend for the
   * same voucher counter and ledger accounts, so parallelism here would only
   * manufacture lock contention.
   */
  async runArrearsBatch(
    organizationId: string,
    asOfDateBsRaw: string | undefined,
    processedBy: string,
    branchIds?: string[],
  ): Promise<BatchResult<Awaited<ReturnType<LoanServicingRepository['accruePenalty']>>>> {
    if (!organizationId) throw new Error('Organization context is required.');
    const asOfDateBs = requireBsDate(asOfDateBsRaw, 'As-of date');
    const loanIds = await this.repository.listServiceableLoanIds(organizationId, branchIds);

    const results: any[] = [];
    const errors: Array<{ loanId: string; error: string }> = [];
    for (const loanId of loanIds) {
      try {
        results.push(await this.repository.accruePenalty(
          organizationId,
          { loanId, asOfDateBs, processedBy },
          branchIds,
        ));
      } catch (error: any) {
        errors.push({ loanId, error: error?.message ?? 'Arrears accrual failed.' });
      }
    }

    return {
      processed: loanIds.length,
      succeeded: results.length,
      failed: errors.length,
      results,
      errors,
    };
  }

  async classify(
    organizationId: string,
    loanId: string,
    asOfDateBs: string | undefined,
    branchIds?: string[],
  ) {
    if (!organizationId) throw new Error('Organization context is required.');
    return this.repository.classify(
      organizationId,
      loanId,
      requireBsDate(asOfDateBs, 'As-of date'),
      branchIds,
    );
  }

  /** Re-grades every serviceable loan without touching penalties. */
  async runClassificationBatch(
    organizationId: string,
    asOfDateBsRaw: string | undefined,
    branchIds?: string[],
  ): Promise<BatchResult<Awaited<ReturnType<LoanServicingRepository['classify']>>>> {
    if (!organizationId) throw new Error('Organization context is required.');
    const asOfDateBs = requireBsDate(asOfDateBsRaw, 'As-of date');
    const loanIds = await this.repository.listServiceableLoanIds(organizationId, branchIds);

    const results: any[] = [];
    const errors: Array<{ loanId: string; error: string }> = [];
    for (const loanId of loanIds) {
      try {
        results.push(await this.repository.classify(organizationId, loanId, asOfDateBs, branchIds));
      } catch (error: any) {
        errors.push({ loanId, error: error?.message ?? 'Classification failed.' });
      }
    }

    return {
      processed: loanIds.length,
      succeeded: results.length,
      failed: errors.length,
      results,
      errors,
    };
  }

  async waivePenalty(
    organizationId: string,
    payload: Record<string, unknown>,
    waivedBy: string | null,
    branchIds?: string[],
  ) {
    if (!organizationId) throw new Error('Organization context is required.');
    const penaltyId = String(payload.penaltyId ?? '').trim();
    if (!penaltyId) throw new Error('Penalty is required.');
    const reason = String(payload.reason ?? '').trim();
    if (reason.length < 5) {
      throw new Error('A written reason of at least 5 characters is required to waive a penalty.');
    }
    return this.repository.waivePenalty(organizationId, { penaltyId, reason, waivedBy }, branchIds);
  }

  // =========================================================================
  // RESCHEDULE
  // =========================================================================

  async reschedule(
    organizationId: string,
    payload: Record<string, unknown>,
    approvedBy: string | null,
    branchIds?: string[],
  ) {
    if (!organizationId) throw new Error('Organization context is required.');
    const loanId = String(payload.loanId ?? '').trim();
    if (!loanId) throw new Error('Loan is required.');
    const reason = String(payload.reason ?? '').trim();
    if (reason.length < 5) {
      throw new Error('A written reason of at least 5 characters is required to reschedule a loan.');
    }

    const input: RescheduleInput = {
      loanId,
      newTenureMonths: int(payload.newTenureMonths),
      newRatePct: num(payload.newRatePct),
      effectiveDateBs: requireBsDate(payload.effectiveDateBs, 'Effective date'),
      reason,
      approvedBy,
    };
    return this.repository.reschedule(organizationId, input, branchIds);
  }

  // =========================================================================
  // WRITE-OFF
  // =========================================================================

  async writeOff(
    organizationId: string,
    payload: Record<string, unknown>,
    processedBy: string,
    approvedBy: string | null,
    branchIds?: string[],
  ) {
    if (!organizationId) throw new Error('Organization context is required.');
    const loanId = String(payload.loanId ?? '').trim();
    if (!loanId) throw new Error('Loan is required.');
    const reason = String(payload.reason ?? '').trim();
    if (reason.length < 10) {
      throw new Error('A written reason of at least 10 characters is required to write off a loan.');
    }

    const dateBs = requireBsDate(payload.dateBs, 'Write-off date');
    const input: WriteOffInput = {
      loanId,
      dateBs,
      dateAd: deriveAd(dateBs),
      // Omitted means "the whole outstanding balance"; the repository decides.
      principalAmount: payload.principalAmount === undefined || payload.principalAmount === null || payload.principalAmount === ''
        ? null
        : num(payload.principalAmount),
      interestAmount: num(payload.interestAmount),
      reason,
      processedBy,
      approvedBy,
    };

    // Attach per-loan custom GL mappings if the loan application has them
    const customGlMappings = await fetchCustomGlMappings(organizationId, loanId);
    if (customGlMappings) input.customGlMappings = customGlMappings;

    return this.repository.writeOff(organizationId, input, branchIds);
  }

  /**
   * Submit a write-off request for approval workflow.
   * Creates an approval request instead of executing the write-off directly.
   */
  async requestWriteOff(
    organizationId: string,
    payload: Record<string, unknown>,
    requestedBy: string,
    requestedById: string | null,
  ) {
    if (!organizationId) throw new Error('Organization context is required.');
    const { getDb } = await import('../../db/client');
    const { approvalRequests } = await import('../../db/schema');
    const { getTodayBS } = await import('../../utils/nepaliCalendar');

    const loanId = String(payload.loanId ?? '').trim();
    if (!loanId) throw new Error('Loan is required.');
    const loanNo = String(payload.loanNo ?? '').trim();
    const memberName = String(payload.memberName ?? '').trim();
    const memberNo = String(payload.memberNo ?? '').trim();
    const outstandingPrincipal = Number(payload.outstandingPrincipal ?? 0);
    const principalAmount = payload.principalAmount != null ? Number(payload.principalAmount) : outstandingPrincipal;
    const interestAmount = Number(payload.interestAmount ?? 0);
    const reason = String(payload.reason ?? '').trim();
    if (reason.length < 10) {
      throw new Error('A written reason of at least 10 characters is required to write off a loan.');
    }
    const dateBs = String(payload.dateBs ?? getTodayBS());

    const db = getDb();
    if (!db) throw new Error('Database not connected.');

    const description = JSON.stringify({
      loanId,
      loanNo,
      memberName,
      memberNo,
      outstandingPrincipal,
      principalAmount,
      interestAmount,
      reason,
      dateBs,
    });

    const [request] = await db.insert(approvalRequests).values({
      organizationId,
      requestType: 'Loan_WriteOff',
      referenceNo: `WOF-${loanNo}`,
      requestedBy: requestedById || '00000000-0000-0000-0000-000000000000',
      requestedDateBs: dateBs,
      amount: String(principalAmount + interestAmount),
      description,
      branchId: '00000000-0000-0000-0000-000000000000',
      status: 'Pending',
    }).returning();

    return {
      success: true,
      requestNo: request.referenceNo,
      requestId: request.id,
      message: `Write-off request ${request.referenceNo} submitted for approval.`,
    };
  }

  // =========================================================================
  // READS
  // =========================================================================

  async getSchedule(
    organizationId: string,
    loanId: string,
    asOfDateBs: string | undefined,
    branchIds?: string[],
  ) {
    if (!organizationId) throw new Error('Organization context is required.');
    return this.repository.getSchedule(
      organizationId,
      loanId,
      requireBsDate(asOfDateBs, 'As-of date'),
      branchIds,
    );
  }

  async listPenalties(organizationId: string, loanId: string, branchIds?: string[]) {
    if (!organizationId) throw new Error('Organization context is required.');
    return this.repository.listPenalties(organizationId, loanId, branchIds);
  }

  async listReschedules(organizationId: string, loanId: string, branchIds?: string[]) {
    if (!organizationId) throw new Error('Organization context is required.');
    return this.repository.listReschedules(organizationId, loanId, branchIds);
  }

  async getRepayments(organizationId: string, loanId: string, branchIds?: string[]) {
    if (!organizationId) throw new Error('Organization context is required.');
    return this.repository.getRepayments(organizationId, loanId, branchIds);
  }

  async getStatement(organizationId: string, loanId: string, branchIds?: string[]) {
    if (!organizationId) throw new Error('Organization context is required.');
    return this.repository.getStatement(organizationId, loanId, branchIds);
  }

  async getPortfolioRisk(organizationId: string, branchIds?: string[]) {
    if (!organizationId) throw new Error('Organization context is required.');
    return this.repository.getPortfolioRisk(organizationId, branchIds);
  }

  // =========================================================================
  // PROVISIONING POLICY
  // =========================================================================

  async getProvisioningSettings(organizationId: string) {
    if (!organizationId) throw new Error('Organization context is required.');
    return this.repository.getProvisioningSettings(organizationId);
  }

  /**
   * Updates the classification policy.
   *
   * The bands must stay strictly increasing — a policy where Doubtful starts
   * before Substandard would classify loans into whichever band the engine
   * happened to test first, so it is rejected here rather than stored and
   * silently misapplied. Provision percentages are bounded to 0–100.
   */
  async updateProvisioningSettings(
    organizationId: string,
    payload: Record<string, unknown>,
    updatedBy: string | null,
  ) {
    if (!organizationId) throw new Error('Organization context is required.');
    const current = await this.repository.getProvisioningSettings(organizationId);

    const pick = (key: string, fallback: unknown) =>
      payload[key] === undefined || payload[key] === null || payload[key] === '' ? fallback : payload[key];

    const watchlistMinDays = int(pick('watchlistMinDays', current?.watchlistMinDays));
    const substandardMinDays = int(pick('substandardMinDays', current?.substandardMinDays));
    const doubtfulMinDays = int(pick('doubtfulMinDays', current?.doubtfulMinDays));
    const lossMinDays = int(pick('lossMinDays', current?.lossMinDays));
    const penaltyGraceDays = int(pick('penaltyGraceDays', current?.penaltyGraceDays));

    const bands: Array<[string, number]> = [
      ['Watchlist', watchlistMinDays],
      ['Substandard', substandardMinDays],
      ['Doubtful', doubtfulMinDays],
      ['Loss', lossMinDays],
    ];
    for (const [label, days] of bands) {
      if (days < 1) throw new Error(`${label} must begin at least 1 day overdue.`);
    }
    for (let i = 1; i < bands.length; i += 1) {
      if (bands[i][1] <= bands[i - 1][1]) {
        throw new Error(
          `${bands[i][0]} must begin later than ${bands[i - 1][0]} (${bands[i][1]} is not after ${bands[i - 1][1]} days).`,
        );
      }
    }
    if (penaltyGraceDays < 0) throw new Error('Penalty grace days cannot be negative.');

    const percent = (key: string, label: string): string => {
      const value = num(pick(key, current?.[key as keyof typeof current]));
      if (value < 0 || value > 100) {
        throw new Error(`${label} provision must be between 0 and 100 percent.`);
      }
      return String(value);
    };

    const patch: Partial<typeof loanProvisioningSettings.$inferInsert> = {
      watchlistMinDays,
      substandardMinDays,
      doubtfulMinDays,
      lossMinDays,
      penaltyGraceDays,
      passProvisionPercent: percent('passProvisionPercent', 'Pass'),
      watchlistProvisionPercent: percent('watchlistProvisionPercent', 'Watchlist'),
      substandardProvisionPercent: percent('substandardProvisionPercent', 'Substandard'),
      doubtfulProvisionPercent: percent('doubtfulProvisionPercent', 'Doubtful'),
      lossProvisionPercent: percent('lossProvisionPercent', 'Loss'),
      autoClassifyOnAccrual: payload.autoClassifyOnAccrual === undefined
        ? current?.autoClassifyOnAccrual !== false
        : payload.autoClassifyOnAccrual === true || payload.autoClassifyOnAccrual === 'true',
    };

    return this.repository.updateProvisioningSettings(organizationId, patch, updatedBy);
  }

  // ---- ACTIVE LOAN PORTFOLIO (for amortization simulator) ----

  async getActivePortfolio(organizationId: string) {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');

    const rows = await db.select({
      id: loanAccounts.id,
      loanNo: loanAccounts.loanNo,
      memberName: loanAccounts.memberName,
      memberNo: loanAccounts.memberNo,
      productName: loanAccounts.productName,
      approvedAmount: loanAccounts.approvedAmount,
      outstandingPrincipal: loanAccounts.outstandingPrincipal,
      interestRate: loanAccounts.interestRate,
      interestMethod: loanAccounts.interestMethod,
      tenureMonths: loanAccounts.tenureMonths,
      monthlyEmi: loanAccounts.monthlyEmi,
      disbursedDateBs: loanAccounts.disbursedDateBs,
      maturityDateBs: loanAccounts.maturityDateBs,
      status: loanAccounts.status,
      daysOverdue: loanAccounts.daysOverdue,
    })
      .from(loanAccounts)
      .where(and(
        eq(loanAccounts.organizationId, organizationId),
        inArray(loanAccounts.status, ['Applied', 'Appraised', 'Approved', 'Disbursed']),
      ))
      .orderBy(loanAccounts.loanNo);

    return rows;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bank Cheque Voucher Posting
// ─────────────────────────────────────────────────────────────────────────────

export interface BankChequeVoucherInput {
  organizationId: string;
  bankAccountId: string;   // GL account id (bank_cheque_leaves.bankAccountId = chartOfAccounts.id)
  chequeLeafId: string;
  payeeName: string;
  amount: number;
  voucherDateBS: string;
  voucherDateAD: string;
  particulars: string;
  debitLedgerId: string;   // Expense or Party Ledger GL account id
}

/**
 * Process a bank cheque voucher with strict validation.
 * Creates a Payment voucher, marks cheque leaf as issued, and updates GL balances.
 */
export async function processBankChequeVoucher(params: BankChequeVoucherInput) {
  const { getDb } = await import('../../db/client');
  const db = getDb();
  if (!db) throw new Error('Database not connected.');

  // Lazy imports to avoid circular deps at module level
  const { bankChequeLeaves } = await import('../../db/schema/bankCheques');
  const { chartOfAccounts } = await import('../../db/schema/accounting');
  const { vouchers, voucherEntries } = await import('../../db/schema/accounting');
  const { eq, and } = await import('drizzle-orm');
  const { v4: uuidv4 } = await import('uuid');
  const { getCurrentFiscalYearCode } = await import('../../utils/nepaliCalendar');

  return db.transaction(async (tx) => {
    // ── CHECK 1: Future Date ──
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const voucherDate = new Date(params.voucherDateAD);
    if (voucherDate > today) {
      throw new Error('Future dated cheques are not permitted for real-time voucher posting.');
    }

    // ── CHECK 2: Payee Name ──
    if (!params.payeeName || params.payeeName.trim().length === 0) {
      throw new Error('Payee Name is required for cheque transactions.');
    }

    // ── CHECK 3: Cheque Leaf Existence & Status ──
    const [cheque] = await tx.select().from(bankChequeLeaves)
      .where(and(
        eq(bankChequeLeaves.id, params.chequeLeafId),
        eq(bankChequeLeaves.bankAccountId, params.bankAccountId),
      ))
      .limit(1);

    if (!cheque) {
      throw new Error('Invalid Cheque Number for the selected bank account.');
    }
    if (cheque.status !== 'unused') {
      throw new Error(`Cheque #${cheque.chequeNumber} has already been ${cheque.status}.`);
    }

    // ── CHECK 4: Sufficient Bank Balance ──
    const [bankGlAccount] = await tx.select().from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.id, params.bankAccountId),
        eq(chartOfAccounts.organizationId, params.organizationId),
      ))
      .limit(1);

    if (!bankGlAccount) {
      throw new Error('Bank GL account not found.');
    }

    const currentBalance = Number(bankGlAccount.balance) || 0;
    if (currentBalance < params.amount) {
      throw new Error(
        `Insufficient balance in Bank Account. Available: NPR ${currentBalance.toLocaleString()}, Required: NPR ${params.amount.toLocaleString()}.`,
      );
    }

    // ── CHECK 5: Debit ledger must exist and allow posting ──
    const [debitAccount] = await tx.select().from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.id, params.debitLedgerId),
        eq(chartOfAccounts.organizationId, params.organizationId),
      ))
      .limit(1);

    if (!debitAccount) {
      throw new Error('Debit ledger account not found.');
    }
    if (debitAccount.allowPosting === false) {
      throw new Error(`Account "${debitAccount.code} - ${debitAccount.name}" does not allow posting.`);
    }

    // ── ATOMIC: Create Voucher + Mark Cheque + Update Balances ──

    // Resolve branchId from bank account
    const { bankAccounts } = await import('../../db/schema/accountingSettings');
    const [bankAccRow] = await tx.select({ branchId: bankAccounts.branchId })
      .from(bankAccounts)
      .where(eq(bankAccounts.glAccountId, params.bankAccountId))
      .limit(1);
    if (!bankAccRow?.branchId) {
      throw new Error('Bank account is not linked to a branch. Cannot create voucher without a branch.');
    }

    // 1. Create Payment Voucher
    const voucherNo = `BPV-${Date.now().toString().slice(-8)}`;
    const [voucher] = await tx.insert(vouchers).values({
      id: uuidv4(),
      organizationId: params.organizationId,
      voucherNo,
      voucherType: 'Payment',
      dateBs: params.voucherDateBS,
      dateAd: params.voucherDateAD,
      branchId: bankAccRow.branchId,
      fiscalYearCode: getCurrentFiscalYearCode(),
      preparedBy: params.payeeName,
      approvedBy: params.payeeName,
      status: 'Posted',
      totalAmount: String(params.amount),
      narration: params.particulars,
      moduleReference: `CHEQUE-${cheque.chequeNumber}`,
    }).returning();

    // 2. Insert Double-Entry: Dr Expense/Party, Cr Bank
    const entries = [
      {
        id: uuidv4(),
        organizationId: params.organizationId,
        voucherId: voucher.id,
        accountId: params.debitLedgerId,
        accountCode: debitAccount.code,
        accountName: debitAccount.name,
        debit: String(params.amount),
        credit: '0',
        narration: params.particulars,
      },
      {
        id: uuidv4(),
        organizationId: params.organizationId,
        voucherId: voucher.id,
        accountId: params.bankAccountId,
        accountCode: bankGlAccount.code,
        accountName: bankGlAccount.name,
        debit: '0',
        credit: String(params.amount),
        narration: params.particulars,
      },
    ];
    await tx.insert(voucherEntries).values(entries);

    // 3. Mark Cheque Leaf as Issued
    await tx.update(bankChequeLeaves)
      .set({
        status: 'issued',
        payeeName: params.payeeName,
        amount: String(params.amount),
        chequeDateBs: params.voucherDateBS,
        chequeDateAd: params.voucherDateAD,
        voucherId: voucher.id,
        usedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bankChequeLeaves.id, params.chequeLeafId));

    // 4. Update GL Balances
    const round2 = (n: number) => Math.round(n * 100) / 100;

    // Debit ledger: Asset/Expense → +debit; Liability/Equity/Income → -debit (handled by credit=0)
    const debitCurrent = Number(debitAccount.balance) || 0;
    const debitNew = ['Asset', 'Expense'].includes(debitAccount.type)
      ? round2(debitCurrent + params.amount)
      : round2(debitCurrent - params.amount);
    await tx.update(chartOfAccounts)
      .set({ balance: String(debitNew), updatedAt: new Date() })
      .where(eq(chartOfAccounts.id, params.debitLedgerId));

    // Bank GL: always Asset → -credit reduces balance
    const bankNew = round2(currentBalance - params.amount);
    await tx.update(chartOfAccounts)
      .set({ balance: String(bankNew), updatedAt: new Date() })
      .where(eq(chartOfAccounts.id, params.bankAccountId));

    await upsertLedgerEntry({ tx, organizationId: params.organizationId, accountId: params.debitLedgerId, fiscalYearCode: getCurrentFiscalYearCode(), branchId: params.branchId, debit: params.amount, credit: 0 });
    await upsertLedgerEntry({ tx, organizationId: params.organizationId, accountId: params.bankAccountId, fiscalYearCode: getCurrentFiscalYearCode(), branchId: params.branchId, debit: 0, credit: params.amount });

    return {
      success: true,
      voucherId: voucher.id,
      voucherNo: voucher.voucherNo,
      chequeNumber: cheque.chequeNumber,
      amount: params.amount,
      payeeName: params.payeeName,
      newBankBalance: bankNew,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Savings Withdrawal via Bank Cheque
// Cooperative pays out from its bank account using a bank cheque
// ─────────────────────────────────────────────────────────────
export interface SavingsChequeWithdrawalInput {
  organizationId: string;
  savingsAccountId: string;
  amount: number;
  bankAccountId: string;      // chart_ofAccounts.id (GL bank account)
  chequeLeafId: string;
  payeeName: string;
  dateBs: string;
  dateAd: string;
  particulars: string;
}

export interface SavingsChequeWithdrawalResult {
  success: boolean;
  voucherNo: string;
  savingsTxnId: string;
  chequeNumber: string;
  amount: number;
  newSavingsBalance: number;
  newBankBalance: number;
}

export async function processSavingsWithdrawalByCheque(params: SavingsChequeWithdrawalInput): Promise<SavingsChequeWithdrawalResult> {
  const { getDb } = await import('../../db/client');
  const db = getDb();
  if (!db) throw new Error('Database not connected.');

  const { bankChequeLeaves } = await import('../../db/schema/bankCheques');
  const { chartOfAccounts, vouchers, voucherEntries } = await import('../../db/schema/accounting');
  const { savingsAccounts, savingsTransactions, savingsProducts } = await import('../../db/schema/savings');
  const { bankAccounts } = await import('../../db/schema/accountingSettings');
  const { systemAccountMappings } = await import('../../db/schema/accountingSettings');
  const { eq, and } = await import('drizzle-orm');
  const { v4: uuidv4 } = await import('uuid');
  const { getCurrentFiscalYearCode } = await import('../../utils/nepaliCalendar');

  return db.transaction(async (tx) => {
    // ── CHECK 1: Future Date ──
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const voucherDate = new Date(params.dateAd);
    if (voucherDate > today) {
      throw new Error('Future dated cheques are not permitted for real-time voucher posting.');
    }

    // ── CHECK 2: Payee Name ──
    if (!params.payeeName || params.payeeName.trim().length === 0) {
      throw new Error('Payee Name is required for cheque transactions.');
    }

    // ── CHECK 3: Savings Account Existence & Status ──
    const [savingsAccount] = await tx.select().from(savingsAccounts)
      .where(and(
        eq(savingsAccounts.id, params.savingsAccountId),
        eq(savingsAccounts.organizationId, params.organizationId),
      ))
      .limit(1);

    if (!savingsAccount) {
      throw new Error('Savings account not found.');
    }
    if (savingsAccount.status !== 'Active') {
      throw new Error(`Savings account is ${savingsAccount.status}. Withdrawals are blocked.`);
    }

    // ── CHECK 4: Sufficient Savings Balance ──
    const savingsBalance = Number(savingsAccount.balance) || 0;
    const minBalance = Number(savingsAccount.minBalance) || 0;
    const availableSavings = Math.round((savingsBalance - minBalance) * 100) / 100;
    if (params.amount > availableSavings) {
      throw new Error(
        `Insufficient savings balance. Available: NPR ${availableSavings.toLocaleString()} (after minimum balance NPR ${minBalance.toLocaleString()}).`,
      );
    }

    // ── CHECK 5: Cheque Leaf Existence & Status ──
    const [cheque] = await tx.select().from(bankChequeLeaves)
      .where(and(
        eq(bankChequeLeaves.id, params.chequeLeafId),
        eq(bankChequeLeaves.bankAccountId, params.bankAccountId),
      ))
      .limit(1);

    if (!cheque) {
      throw new Error('Invalid Cheque Number for the selected bank account.');
    }
    if (cheque.status !== 'unused') {
      throw new Error(`Cheque #${cheque.chequeNumber} has already been ${cheque.status}.`);
    }

    // ── CHECK 6: Bank GL Account Existence & Balance ──
    const [bankGlAccount] = await tx.select().from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.id, params.bankAccountId),
        eq(chartOfAccounts.organizationId, params.organizationId),
      ))
      .limit(1);

    if (!bankGlAccount) {
      throw new Error('Bank GL account not found.');
    }

    const currentBankBalance = Number(bankGlAccount.balance) || 0;
    if (currentBankBalance < params.amount) {
      throw new Error(
        `Insufficient balance in Bank Account. Available: NPR ${currentBankBalance.toLocaleString()}, Required: NPR ${params.amount.toLocaleString()}.`,
      );
    }

    // ── CHECK 7: Debit Ledger (Savings Liability GL) ──
    // Resolve from savings product's glLiabilityAccountId, or fall back to
    // the system-level 'member_savings' mapping.
    let liabilityGl: { id: string; code: string; name: string; type: string; balance: string } | null = null;
    if (savingsAccount.savingsProductId) {
      const [product] = await tx.select().from(savingsProducts)
        .where(and(
          eq(savingsProducts.id, savingsAccount.savingsProductId),
          eq(savingsProducts.organizationId, params.organizationId),
        ))
        .limit(1);
      if (product?.glLiabilityAccountId) {
        const [glAcct] = await tx.select().from(chartOfAccounts)
          .where(and(
            eq(chartOfAccounts.id, product.glLiabilityAccountId),
            eq(chartOfAccounts.organizationId, params.organizationId),
          ))
          .limit(1);
        if (glAcct) {
          liabilityGl = { id: glAcct.id, code: glAcct.code, name: glAcct.name, type: glAcct.type, balance: String(glAcct.balance ?? '0') };
        }
      }
    }
    if (!liabilityGl) {
      const [mapped] = await tx.select({
        id: chartOfAccounts.id, code: chartOfAccounts.code, name: chartOfAccounts.name,
        type: chartOfAccounts.type, balance: chartOfAccounts.balance,
      })
        .from(systemAccountMappings)
        .innerJoin(chartOfAccounts, eq(systemAccountMappings.accountId, chartOfAccounts.id))
        .where(and(
          eq(systemAccountMappings.organizationId, params.organizationId),
          eq(systemAccountMappings.mappingKey, 'member_savings' as any),
        ))
        .limit(1);
      if (mapped) {
        liabilityGl = { id: mapped.id, code: mapped.code, name: mapped.name, type: mapped.type, balance: String(mapped.balance ?? '0') };
      }
    }
    if (!liabilityGl) {
      throw new Error('Member savings GL account is not configured. Set the savings liability mapping in Setups → Accounting Settings.');
    }

    // ── Resolve branchId from bank_accounts ──
    const [bankAccRow] = await tx.select({ branchId: bankAccounts.branchId })
      .from(bankAccounts)
      .where(eq(bankAccounts.glAccountId, params.bankAccountId))
      .limit(1);
    if (!bankAccRow?.branchId) {
      throw new Error('Bank account is not linked to a branch. Cannot create voucher without a branch.');
    }
    const branchId = bankAccRow.branchId;

    // ── ATOMIC: All mutations in one transaction ──

    // 1. Create Payment Voucher (Dr Savings Liability, Cr Bank GL)
    const voucherNo = `BPV-${Date.now().toString().slice(-8)}`;
    const [voucher] = await tx.insert(vouchers).values({
      id: uuidv4(),
      organizationId: params.organizationId,
      voucherNo,
      voucherType: 'Payment',
      dateBs: params.dateBs,
      dateAd: params.dateAd,
      branchId,
      fiscalYearCode: getCurrentFiscalYearCode(),
      preparedBy: params.payeeName,
      approvedBy: params.payeeName,
      status: 'Posted',
      totalAmount: String(params.amount),
      narration: params.particulars,
      moduleReference: `CHEQUE-${cheque.chequeNumber}`,
    }).returning();

    // 2. Insert Double-Entry Voucher Lines
    const entries = [
      {
        id: uuidv4(),
        organizationId: params.organizationId,
        voucherId: voucher.id,
        accountId: liabilityGl.id,
        accountCode: liabilityGl.code,
        accountName: liabilityGl.name,
        debit: String(params.amount),
        credit: '0',
        narration: params.particulars,
      },
      {
        id: uuidv4(),
        organizationId: params.organizationId,
        voucherId: voucher.id,
        accountId: bankGlAccount.id,
        accountCode: bankGlAccount.code,
        accountName: bankGlAccount.name,
        debit: '0',
        credit: String(params.amount),
        narration: params.particulars,
      },
    ];
    await tx.insert(voucherEntries).values(entries);

    // 3. Update GL Balances
    const round2 = (n: number) => Math.round(n * 100) / 100;

    // Liability (Dr reduces balance): +credit -debit
    const liabilityCurrent = Number(liabilityGl.balance) || 0;
    const liabilityNew = ['Asset', 'Expense'].includes(liabilityGl.type)
      ? round2(liabilityCurrent + params.amount)
      : round2(liabilityCurrent - params.amount);
    await tx.update(chartOfAccounts)
      .set({ balance: String(liabilityNew), updatedAt: new Date() })
      .where(eq(chartOfAccounts.id, liabilityGl.id));

    // Bank GL (Cr reduces balance): Asset → current - amount
    const bankNew = round2(currentBankBalance - params.amount);
    await tx.update(chartOfAccounts)
      .set({ balance: String(bankNew), updatedAt: new Date() })
      .where(eq(chartOfAccounts.id, params.bankAccountId));

    await upsertLedgerEntry({ tx, organizationId: params.organizationId, accountId: liabilityGl.id, fiscalYearCode: getCurrentFiscalYearCode(), branchId: params.branchId, debit: params.amount, credit: 0 });
    await upsertLedgerEntry({ tx, organizationId: params.organizationId, accountId: params.bankAccountId, fiscalYearCode: getCurrentFiscalYearCode(), branchId: params.branchId, debit: 0, credit: params.amount });

    // 4. Mark Cheque Leaf as Issued
    await tx.update(bankChequeLeaves)
      .set({
        status: 'issued',
        payeeName: params.payeeName,
        amount: String(params.amount),
        chequeDateBs: params.dateBs,
        chequeDateAd: params.dateAd,
        voucherId: voucher.id,
        usedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bankChequeLeaves.id, params.chequeLeafId));

    // 5. Create Savings Transaction
    const voucherNoSavings = `STX-${Date.now().toString().slice(-8)}`;
    const newSavingsBalance = round2(savingsBalance - params.amount);
    const [savingsTxn] = await tx.insert(savingsTransactions).values({
      id: uuidv4(),
      organizationId: params.organizationId,
      accountId: savingsAccount.id,
      accountNo: savingsAccount.accountNo,
      memberId: savingsAccount.memberId,
      memberName: savingsAccount.memberName,
      type: 'Withdrawal',
      amount: String(params.amount),
      balanceAfter: String(newSavingsBalance),
      voucherNo: voucherNoSavings,
      dateBs: params.dateBs,
      dateAd: params.dateAd,
      tellerName: params.payeeName,
      remarks: params.particulars,
      paymentMode: 'Bank_Transfer',
      branchId,
    }).returning();

    // 6. Update Savings Account Balance
    await tx.update(savingsAccounts)
      .set({
        balance: String(newSavingsBalance),
        lastTransactionDateBs: params.dateBs,
        updatedAt: new Date(),
      })
      .where(eq(savingsAccounts.id, savingsAccount.id));

    return {
      success: true,
      voucherNo: voucher.voucherNo,
      savingsTxnId: savingsTxn.id,
      chequeNumber: cheque.chequeNumber,
      amount: params.amount,
      newSavingsBalance,
      newBankBalance: bankNew,
    };
  });
}

// =========================================================================
// INTERNAL CHEQUE REPAYMENT (Third-Party / Self)
// =========================================================================
export interface InternalChequeRepaymentInput {
  organizationId: string;
  borrowerLoanId: string;
  payerSavingsAccountId: string;
  payerMemberId: string;
  chequeLeafId: string;
  chequeNumber: string;
  payeeName: string;
  chequeDateBs: string;
  chequeDateAd: string;
  principalPaid: number;
  interestPaid: number;
  penaltyPaid: number;
  isThirdParty: boolean;
  /** Per-loan GL overrides from the loan wizard (mappingKey → accountId). */
  customGlMappings?: Record<string, string>;
}

export interface InternalChequeRepaymentResult {
  success: boolean;
  voucherNo: string;
  repaymentId: string;
  chequeNumber: string;
  payerNewSavingsBalance: number;
  message: string;
  glEntries?: Array<{
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    narration: string;
  }>;
}

export async function processInternalChequeRepayment(params: InternalChequeRepaymentInput): Promise<InternalChequeRepaymentResult> {
  const { getDb } = await import('../../db/client');
  const db = getDb();
  if (!db) throw new Error('Database not connected.');

  const { chequeLeaves } = await import('../../db/schema/cheque');
  const { loanAccounts } = await import('../../db/schema/loans');
  const { savingsAccounts, savingsTransactions, savingsProducts } = await import('../../db/schema/savings');
  const { chartOfAccounts } = await import('../../db/schema/accounting');
  const { systemAccountMappings } = await import('../../db/schema/accountingSettings');
  const { eq, and } = await import('drizzle-orm');
  const { v4: uuidv4 } = await import('uuid');

  return db.transaction(async (tx) => {
    // ── CHECK 1: Loan existence & status ──
    const [loan] = await tx.select().from(loanAccounts)
      .where(and(
        eq(loanAccounts.id, params.borrowerLoanId),
        eq(loanAccounts.organizationId, params.organizationId),
      ))
      .limit(1);
    if (!loan) throw new Error('Loan account not found.');
    if (loan.status !== 'Disbursed') {
      throw new Error(`Loan is '${loan.status}'. Only disbursed loans accept repayments.`);
    }

    // ── CHECK 2: Savings account existence & status ──
    const [payerSavings] = await tx.select().from(savingsAccounts)
      .where(and(
        eq(savingsAccounts.id, params.payerSavingsAccountId),
        eq(savingsAccounts.organizationId, params.organizationId),
      ))
      .limit(1);
    if (!payerSavings) throw new Error('Payer savings account not found.');
    if (payerSavings.status !== 'Active') {
      throw new Error(`Payer savings account is '${payerSavings.status}'. Cannot process.`);
    }

    // ── CHECK 3: Sufficient savings balance ──
    const totalPaid = params.principalPaid + params.interestPaid + params.penaltyPaid;
    if (totalPaid <= 0) throw new Error('Repayment amount must be greater than zero.');
    const savingsBalance = Number(payerSavings.balance) || 0;
    const minBalance = Number(payerSavings.minBalance) || 0;
    const available = Math.round((savingsBalance - minBalance) * 100) / 100;
    if (totalPaid > available) {
      throw new Error(
        `Payer has insufficient savings balance. Available: NPR ${available.toLocaleString()} (min balance NPR ${minBalance.toLocaleString()}).`,
      );
    }

    // ── CHECK 4: Principal doesn't exceed outstanding ──
    const outstanding = Number(loan.outstandingPrincipal) || 0;
    if (params.principalPaid > outstanding + 0.01) {
      throw new Error(
        `Principal paid (NPR ${params.principalPaid.toLocaleString()}) exceeds outstanding (NPR ${outstanding.toLocaleString()}).`,
      );
    }

    // ── CHECK 5: Cheque leaf exists and is unused ──
    const [cheque] = await tx.select().from(chequeLeaves)
      .where(and(
        eq(chequeLeaves.id, params.chequeLeafId),
        eq(chequeLeaves.accountId, params.payerSavingsAccountId),
      ))
      .limit(1);
    if (!cheque) throw new Error('Invalid cheque leaf for the selected savings account.');
    if (cheque.status !== 'unused') {
      throw new Error(`Cheque #${cheque.chequeNumber} has already been ${cheque.status}.`);
    }

    // ── CHECK 6: Savings GL (Liability) exists ──
    let savingsGl: { id: string; code: string; name: string; type: string; balance: string } | null = null;
    if (payerSavings.savingsProductId) {
      const [product] = await tx.select().from(savingsProducts)
        .where(and(
          eq(savingsProducts.id, payerSavings.savingsProductId),
          eq(savingsProducts.organizationId, params.organizationId),
        ))
        .limit(1);
      if (product?.glLiabilityAccountId) {
        const [glAcct] = await tx.select().from(chartOfAccounts)
          .where(and(
            eq(chartOfAccounts.id, product.glLiabilityAccountId),
            eq(chartOfAccounts.organizationId, params.organizationId),
          ))
          .limit(1);
        if (glAcct) savingsGl = { id: glAcct.id, code: glAcct.code, name: glAcct.name, type: glAcct.type, balance: String(glAcct.balance ?? '0') };
      }
    }
    if (!savingsGl) {
      const [mapped] = await tx.select({
        id: chartOfAccounts.id, code: chartOfAccounts.code, name: chartOfAccounts.name,
        type: chartOfAccounts.type, balance: chartOfAccounts.balance,
      })
        .from(systemAccountMappings)
        .innerJoin(chartOfAccounts, eq(systemAccountMappings.accountId, chartOfAccounts.id))
        .where(and(
          eq(systemAccountMappings.organizationId, params.organizationId),
          eq(systemAccountMappings.mappingKey, 'member_savings' as any),
        ))
        .limit(1);
      if (mapped) savingsGl = { id: mapped.id, code: mapped.code, name: mapped.name, type: mapped.type, balance: String(mapped.balance ?? '0') };
    }
    if (!savingsGl) {
      throw new Error('Savings liability GL account is not configured. Set the savings liability mapping in Accounting Settings.');
    }

    // ── Resolve branchId from payer savings account ──
    const branchId = payerSavings.branchId || loan.branchId;
    if (!branchId) throw new Error('Cannot determine branch for this transaction.');

    // ── ATOMIC: All mutations in one transaction ──

    // 1. Post GL Voucher: Dr Savings Liability, Cr Loan Receivable
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const { getCurrentFiscalYearCode } = await import('../../utils/nepaliCalendar');
    const { vouchers, voucherEntries } = await import('../../db/schema/accounting');

    const who = params.isThirdParty
      ? `Third-party: ${(payerSavings as any).memberName || payerSavings.memberId} paying ${(loan as any).memberName || loan.memberId}`
      : `Self-payment: ${(loan as any).memberName || loan.memberId}`;

    const narration = `Internal cheque repayment — ${params.chequeNumber} — ${who}`;

    const voucherNo = `ICR-${Date.now().toString().slice(-8)}`;
    const [voucher] = await tx.insert(vouchers).values({
      id: uuidv4(),
      organizationId: params.organizationId,
      voucherNo,
      voucherType: 'Journal',
      dateBs: params.chequeDateBs,
      dateAd: params.chequeDateAd,
      branchId,
      fiscalYearCode: getCurrentFiscalYearCode(),
      preparedBy: params.payeeName,
      status: 'Posted',
      totalAmount: String(totalPaid),
      narration,
      moduleReference: `INTERNAL_CHEQUE-${params.chequeNumber}`,
    }).returning();

    // Double-entry: Dr Savings Liability, Cr Loan Receivable / Interest Income / Penalty Income
    // Resolve GL accounts via customMappings → systemAccountMappings (same resolution order as LoanServicingRepository)
    const resolveSystemGl = async (mappingKey: string): Promise<{ id: string; code: string; name: string } | null> => {
      // 1. Per-loan override from custom_gl_mappings
      const overrideAccountId = params.customGlMappings?.[mappingKey];
      if (overrideAccountId) {
        const [override] = await tx.select({
          id: chartOfAccounts.id, code: chartOfAccounts.code, name: chartOfAccounts.name,
        })
          .from(chartOfAccounts)
          .where(and(
            eq(chartOfAccounts.id, overrideAccountId),
            eq(chartOfAccounts.organizationId, params.organizationId),
          ))
          .limit(1);
        if (override) return override;
        throw new Error(
          `Custom GL mapping '${mappingKey}' points to account ${overrideAccountId} which does not exist or belongs to another organization.`,
        );
      }
      // 2. Org-level saved mapping
      const [row] = await tx.select({
        id: chartOfAccounts.id, code: chartOfAccounts.code, name: chartOfAccounts.name,
      })
        .from(systemAccountMappings)
        .innerJoin(chartOfAccounts, eq(systemAccountMappings.accountId, chartOfAccounts.id))
        .where(and(
          eq(systemAccountMappings.organizationId, params.organizationId),
          eq(systemAccountMappings.mappingKey, mappingKey as any),
        ))
        .limit(1);
      return row || null;
    };

    const principalGl = await resolveSystemGl('loan_principal_receivable');
    const interestGl = await resolveSystemGl('loan_interest_income');
    const penaltyGl = await resolveSystemGl('loan_penalty_income');

    if (!principalGl) throw new Error('Loan principal receivable GL is not configured. Set the mapping in Accounting Settings.');
    if (params.interestPaid > 0 && !interestGl) throw new Error('Loan interest income GL is not configured.');
    if (params.penaltyPaid > 0 && !penaltyGl) throw new Error('Loan penalty income GL is not configured.');

    const entries = [
      // Dr Savings Liability
      {
        id: uuidv4(),
        organizationId: params.organizationId,
        voucherId: voucher.id,
        accountId: savingsGl.id,
        accountCode: savingsGl.code,
        accountName: savingsGl.name,
        debit: String(totalPaid),
        credit: '0',
        narration,
      },
      // Cr Loan Principal Receivable
      ...(params.principalPaid > 0 ? [{
        id: uuidv4(),
        organizationId: params.organizationId,
        voucherId: voucher.id,
        accountId: principalGl.id,
        accountCode: principalGl.code,
        accountName: principalGl.name,
        debit: '0',
        credit: String(params.principalPaid),
        narration,
      }] : []),
      // Cr Loan Interest Income
      ...(params.interestPaid > 0 && interestGl ? [{
        id: uuidv4(),
        organizationId: params.organizationId,
        voucherId: voucher.id,
        accountId: interestGl.id,
        accountCode: interestGl.code,
        accountName: interestGl.name,
        debit: '0',
        credit: String(params.interestPaid),
        narration,
      }] : []),
      // Cr Loan Penalty Income
      ...(params.penaltyPaid > 0 && penaltyGl ? [{
        id: uuidv4(),
        organizationId: params.organizationId,
        voucherId: voucher.id,
        accountId: penaltyGl.id,
        accountCode: penaltyGl.code,
        accountName: penaltyGl.name,
        debit: '0',
        credit: String(params.penaltyPaid),
        narration,
      }] : []),
    ];

    await tx.insert(voucherEntries).values(entries);

    // 2. Update GL Balances for ALL affected accounts
    // Helper: update a single COA account balance
    const updateGlBalance = async (accountId: string, debit: number, credit: number) => {
      const [acct] = await tx.select().from(chartOfAccounts)
        .where(eq(chartOfAccounts.id, accountId))
        .limit(1);
      if (!acct) return;
      const current = Number(acct.balance) || 0;
      const isDebitNormal = ['Asset', 'Expense'].includes(acct.type);
      const newBal = isDebitNormal ? current + debit - credit : current + credit - debit;
      await tx.update(chartOfAccounts)
        .set({ balance: String(round2(newBal)), updatedAt: new Date() })
        .where(eq(chartOfAccounts.id, accountId));
      if (debit > 0 || credit > 0) {
        await upsertLedgerEntry({ tx, organizationId: params.organizationId, accountId, fiscalYearCode: getCurrentFiscalYearCode(), branchId: params.branchId, debit, credit });
      }
    };

    // Dr Savings Liability (liability: credit increases, debit decreases)
    await updateGlBalance(savingsGl.id, totalPaid, 0);
    // Cr Loan Principal Receivable (asset: debit increases, credit decreases)
    if (params.principalPaid > 0) await updateGlBalance(principalGl.id, 0, params.principalPaid);
    // Cr Loan Interest Income (income: credit increases, debit decreases)
    if (params.interestPaid > 0 && interestGl) await updateGlBalance(interestGl.id, 0, params.interestPaid);
    // Cr Loan Penalty Income (income: credit increases, debit decreases)
    if (params.penaltyPaid > 0 && penaltyGl) await updateGlBalance(penaltyGl.id, 0, params.penaltyPaid);

    // 3. Update loan outstanding + lastRepaymentDateBs
    const newOutstanding = round2(Math.max(outstanding - params.principalPaid, 0));
    const willClose = newOutstanding <= 0.01;
    await tx.update(loanAccounts)
      .set({
        outstandingPrincipal: String(newOutstanding),
        lastRepaymentDateBs: params.chequeDateBs,
        status: willClose ? 'Closed' : loan.status,
        updatedAt: new Date(),
      })
      .where(eq(loanAccounts.id, loan.id));

    // 4. Deduct payer savings balance
    const newSavingsBalance = round2(savingsBalance - totalPaid);
    await tx.update(savingsAccounts)
      .set({
        balance: String(newSavingsBalance),
        lastTransactionDateBs: params.chequeDateBs,
        updatedAt: new Date(),
      })
      .where(eq(savingsAccounts.id, payerSavings.id));

    // 5. Create savings transaction record
    const savingsTxnNo = `ICR-SAV-${Date.now().toString().slice(-8)}`;
    await tx.insert(savingsTransactions).values({
      id: uuidv4(),
      organizationId: params.organizationId,
      accountId: payerSavings.id,
      accountNo: payerSavings.accountNo,
      memberId: payerSavings.memberId,
      memberName: payerSavings.memberName,
      type: 'Withdrawal',
      amount: String(totalPaid),
      balanceAfter: String(newSavingsBalance),
      voucherNo: savingsTxnNo,
      dateBs: params.chequeDateBs,
      dateAd: params.chequeDateAd,
      tellerName: params.payeeName,
      remarks: `Internal cheque repayment for loan ${(loan as any).loanNo || loan.id}`,
      paymentMode: 'Internal_Transfer',
      branchId,
    }).returning();

    // 6. Mark member cheque leaf as issued
    await tx.update(chequeLeaves)
      .set({
        status: 'issued',
        payeeName: params.payeeName,
        amount: String(totalPaid),
        chequeDateBs: params.chequeDateBs,
        chequeDateAd: params.chequeDateAd,
        usedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(chequeLeaves.id, params.chequeLeafId));

    return {
      success: true,
      voucherNo: voucher.voucherNo,
      repaymentId: savingsTxnNo,
      chequeNumber: params.chequeNumber,
      payerNewSavingsBalance: newSavingsBalance,
      message: willClose
        ? `Loan closed. Payer savings deducted NPR ${totalPaid.toLocaleString()}.`
        : `Repayment posted. Outstanding principal: NPR ${newOutstanding.toLocaleString()}. Payer savings deducted NPR ${totalPaid.toLocaleString()}.`,
      glEntries: entries.map((e) => ({
        accountCode: e.accountCode,
        accountName: e.accountName,
        debit: Number(e.debit) || 0,
        credit: Number(e.credit) || 0,
        narration: e.narration,
      })),
    };
  });
}
