import { Request, Response } from 'express';
import { eq, and, desc, sql, inArray, like, count, or } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  chequeSettings, chequeBooks, chequeLeaves, chequeStopPayments, chequeBounces,
  savingsAccounts, savingsProducts, members, branches, chartOfAccounts
} from '../../db/schema';
import {
  chequeSettingsSchema, issueChequeBookSchema, cancelChequeBookSchema,
  stopPaymentSchema, recordBounceSchema
} from '../schemas/chequeSetting';
import { buildAuditRow, writeAuditLog, SettingsActor } from '../utils/audit';
import { DateConverter } from '../../utils/DateConverter';
import { postSavingsVoucher, resolveCashBankAccount } from '../services/SavingsGlService';
import { daysBetweenBS } from '../../utils/financialEngine';
import {
  evaluateIssuanceEligibility, computeIssuanceCharge, evaluatePresentation,
  chequeNumberInRange, ChequeError,
  type IssuanceEligibilityPolicy,
} from '../services/ChequeService';

const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Resolve the cheque_settings row that governs an operation, preferring a
 * branch-scoped override over the organization default. The operational methods
 * previously read settings with `eq(organizationId)` alone, so a branch-scoped
 * row could be picked up arbitrarily for an org-wide action.
 */
async function resolveChequeConfig(tx: any, organizationId: string, branchId?: string | null) {
  if (branchId) {
    const [branchCfg] = await tx.select().from(chequeSettings)
      .where(and(
        eq(chequeSettings.organizationId, organizationId),
        eq(chequeSettings.scope, 'branch'),
        eq(chequeSettings.branchId, branchId),
      )).limit(1);
    if (branchCfg) return branchCfg;
  }
  const [orgCfg] = await tx.select().from(chequeSettings)
    .where(and(
      eq(chequeSettings.organizationId, organizationId),
      eq(chequeSettings.scope, 'organization'),
    )).limit(1);
  return orgCfg ?? null;
}

/** Shape a cheque_settings row into the eligibility policy the engine consumes. */
function toEligibilityPolicy(config: any): IssuanceEligibilityPolicy {
  return {
    enableChequeFacility: config?.enableChequeFacility ?? true,
    eligibleAccountProductIds: Array.isArray(config?.eligibleAccountProductIds) ? config.eligibleAccountProductIds : [],
    maxActiveBooksPerAccount: Number(config?.maxActiveBooksPerAccount ?? 1),
    reissueAllowed: config?.reissueAllowed ?? true,
    reissueAfterExhaustion: config?.reissueAfterExhaustion ?? true,
    requireKycVerified: config?.requireKycVerified ?? true,
    blockBlacklistedMembers: config?.blockBlacklistedMembers ?? true,
    minUtilizationForReissue: Number(config?.minUtilizationForReissue ?? 0),
    reissueCooldownDays: Number(config?.reissueCooldownDays ?? 0),
    allowedBookSizes: Array.isArray(config?.allowedBookSizes) ? config.allowedBookSizes : [],
    allowSupervisorOverride: config?.allowSupervisorOverride ?? true,
  };
}

/**
 * Post a cheque charge (issuance / stop-payment / bounce / replacement) as a
 * cash Receipt voucher: Dr Cash/Bank, Cr the configured fee-income account.
 * Returns the voucher, or null when the charge is zero, the fee account is
 * unmapped, or the actor is unattributed — in those cases the charge is still
 * recorded on the operational row but not posted, rather than blocking the
 * operation. Any tax collected is folded into the fee-account credit because no
 * tax-payable GL mapping exists in this system.
 */
async function postChequeChargeVoucher(tx: any, opts: {
  organizationId: string;
  branchId: string | null;
  feeAccountId: string | null | undefined;
  amount: number;
  narration: string;
  moduleReference: string;
  preparedBy?: string | null;
  dateBs: string;
  dateAd: string;
}) {
  const amount = round2(opts.amount);
  if (!(amount > 0) || !opts.feeAccountId || !opts.preparedBy) return null;

  const cashBank = await resolveCashBankAccount(opts.organizationId, tx);
  const [feeAccount] = await tx.select().from(chartOfAccounts)
    .where(and(
      eq(chartOfAccounts.id, opts.feeAccountId),
      eq(chartOfAccounts.organizationId, opts.organizationId),
    )).limit(1);
  if (!feeAccount) return null;

  const { voucher } = await postSavingsVoucher({
    organizationId: opts.organizationId,
    branchId: opts.branchId || '',
    dateBs: opts.dateBs,
    dateAd: opts.dateAd,
    voucherType: 'Receipt',
    narration: opts.narration,
    moduleReference: opts.moduleReference,
    preparedBy: opts.preparedBy,
    entries: [
      { accountId: cashBank.id!, accountCode: cashBank.code!, accountName: cashBank.name!, debit: amount, narration: opts.narration },
      { accountId: feeAccount.id, accountCode: feeAccount.code, accountName: feeAccount.name, credit: amount, narration: opts.narration },
    ],
  }, tx);
  return voucher;
}

/**
 * Flip every unused leaf in [start, end] to 'stopped'. The previous code only
 * ever touched the single leaf equal to `startChequeNumber`, so a stop-payment
 * *range* left the rest of the range payable. Uses the tested
 * `chequeNumberInRange` primitive; leaf counts per account are small.
 * Returns the number of leaves stopped.
 */
async function applyStopPaymentRange(
  tx: any,
  organizationId: string,
  accountId: string,
  startChequeNumber: string,
  endChequeNumber: string,
  reason: string,
): Promise<number> {
  const leaves = await tx.select({
    id: chequeLeaves.id,
    chequeNumber: chequeLeaves.chequeNumber,
    status: chequeLeaves.status,
  }).from(chequeLeaves)
    .where(and(eq(chequeLeaves.organizationId, organizationId), eq(chequeLeaves.accountId, accountId)));

  const targetIds = leaves
    .filter((l: any) => l.status === 'unused' && chequeNumberInRange(l.chequeNumber, startChequeNumber, endChequeNumber))
    .map((l: any) => l.id);
  if (targetIds.length === 0) return 0;

  await tx.update(chequeLeaves)
    .set({ status: 'stopped', stopPaymentDate: new Date(), stopPaymentReason: reason, updatedAt: new Date() })
    .where(and(eq(chequeLeaves.organizationId, organizationId), inArray(chequeLeaves.id, targetIds)));
  return targetIds.length;
}

interface OrgUser {
  organizationId?: string;
  userId?: string;
  username?: string;
  role?: string;
  branchId?: string;
}

function reqActor(req: Request & { user?: OrgUser }): SettingsActor {
  return {
    organizationId: req.user?.organizationId || '',
    userId: req.user?.userId,
    username: req.user?.username,
    role: req.user?.role,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

export class ChequeSettingController {
  /**
   * GET /api/v1/cheque-settings
   * Fetch organization or branch cheque configuration.
   */
  static async getSettings(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const branchId = (req.query.branchId as string) || req.user?.branchId || null;
      const scope = (req.query.scope as string) || 'organization';

      const conditions: any[] = [
        eq(chequeSettings.organizationId, organizationId),
        eq(chequeSettings.scope, scope as any),
      ];
      if (scope === 'branch' && branchId) {
        conditions.push(eq(chequeSettings.branchId, branchId));
      }

      const [existing] = await db.select().from(chequeSettings)
        .where(and(...conditions))
        .limit(1);

      if (existing) {
        return res.json(existing);
      }

      // Default fallback settings object if not created yet
      const defaultConfig = {
        organizationId,
        branchId: scope === 'branch' ? branchId : null,
        scope,
        enableChequeFacility: true,
        eligibleAccountProductIds: [],
        defaultLeavesPerBook: 25,
        allowedBookSizes: [10, 20, 25, 50, 100],
        maxActiveBooksPerAccount: 1,
        reissueAllowed: true,
        reissueAfterExhaustion: true,
        lostBookReplacementAllowed: true,
        cancelledBookReplacementAllowed: true,
        requireKycVerified: true,
        blockBlacklistedMembers: true,
        minUtilizationForReissue: 80,
        reissueCooldownDays: 30,
        allowSupervisorOverride: true,
        numberingScope: 'branch_wise',
        startingChequeNumber: 100001,
        chequePrefix: 'CHQ-',
        numberLength: 6,
        allowManualNumberAssignment: false,
        preventDuplicateChequeNumbers: true,
        validityPeriodDays: 90,
        expiredChequeBehavior: 'reject_presentation',
        stopPaymentEnabled: true,
        allowStopPaymentBy: ['member', 'teller', 'branch_manager', 'admin'],
        stopPaymentCharge: '0.00',
        allowStopPaymentOn: ['single_cheque', 'cheque_range', 'entire_book'],
        stopPaymentRequireApproval: true,
        bounceHandlingEnabled: true,
        bounceCharge: '0.00',
        maxBounceCount: null,
        afterThresholdAction: 'flag_account',
        issuanceChargeType: 'flat',
        issuanceChargeAmount: '0.00',
        issuanceChargePerLeafAmount: '0.00',
        lostBookCharge: '0.00',
        replacementBookCharge: '0.00',
        otherChequeCharges: [],
        taxApplicable: false,
        taxRate: '0.00',
        glIssuanceFeeAccountId: null,
        glStopPaymentFeeAccountId: null,
        glBounceFeeAccountId: null,
        glReplacementFeeAccountId: null,
        glOtherChargesFeeAccountId: null,
      };

      res.json(defaultConfig);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/v1/cheque-settings
   * Save/Update organization or branch cheque configuration.
   */
  static async updateSettings(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const parseResult = chequeSettingsSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid cheque settings payload', details: parseResult.error.format() });
      }

      const val = parseResult.data;
      const scope = val.scope || 'organization';
      const branchId = val.branchId || (scope === 'branch' ? req.user?.branchId : null);

      const conditions: any[] = [
        eq(chequeSettings.organizationId, organizationId),
        eq(chequeSettings.scope, scope as any),
      ];
      if (scope === 'branch' && branchId) {
        conditions.push(eq(chequeSettings.branchId, branchId));
      }

      const [existing] = await db.select().from(chequeSettings).where(and(...conditions)).limit(1);

      const payload: any = {
        organizationId,
        branchId,
        scope,
        enableChequeFacility: val.enableChequeFacility,
        eligibleAccountProductIds: val.eligibleAccountProductIds,
        defaultLeavesPerBook: val.defaultLeavesPerBook,
        allowedBookSizes: val.allowedBookSizes,
        maxActiveBooksPerAccount: val.maxActiveBooksPerAccount,
        reissueAllowed: val.reissueAllowed,
        reissueAfterExhaustion: val.reissueAfterExhaustion,
        lostBookReplacementAllowed: val.lostBookReplacementAllowed,
        cancelledBookReplacementAllowed: val.cancelledBookReplacementAllowed,
        requireKycVerified: val.requireKycVerified,
        blockBlacklistedMembers: val.blockBlacklistedMembers,
        minUtilizationForReissue: val.minUtilizationForReissue,
        reissueCooldownDays: val.reissueCooldownDays,
        allowSupervisorOverride: val.allowSupervisorOverride,
        numberingScope: val.numberingScope,
        startingChequeNumber: val.startingChequeNumber,
        chequePrefix: val.chequePrefix,
        numberLength: val.numberLength,
        allowManualNumberAssignment: val.allowManualNumberAssignment,
        preventDuplicateChequeNumbers: val.preventDuplicateChequeNumbers,
        validityPeriodDays: val.validityPeriodDays,
        expiredChequeBehavior: val.expiredChequeBehavior,
        stopPaymentEnabled: val.stopPaymentEnabled,
        allowStopPaymentBy: val.allowStopPaymentBy,
        stopPaymentCharge: String(val.stopPaymentCharge),
        allowStopPaymentOn: val.allowStopPaymentOn,
        stopPaymentRequireApproval: val.stopPaymentRequireApproval,
        bounceHandlingEnabled: val.bounceHandlingEnabled,
        bounceCharge: String(val.bounceCharge),
        maxBounceCount: val.maxBounceCount || null,
        afterThresholdAction: val.afterThresholdAction,
        issuanceChargeType: val.issuanceChargeType,
        issuanceChargeAmount: String(val.issuanceChargeAmount),
        issuanceChargePerLeafAmount: String(val.issuanceChargePerLeafAmount),
        lostBookCharge: String(val.lostBookCharge),
        replacementBookCharge: String(val.replacementBookCharge),
        otherChequeCharges: val.otherChequeCharges,
        taxApplicable: val.taxApplicable,
        taxRate: String(val.taxRate),
        glIssuanceFeeAccountId: val.glIssuanceFeeAccountId || null,
        glStopPaymentFeeAccountId: val.glStopPaymentFeeAccountId || null,
        glBounceFeeAccountId: val.glBounceFeeAccountId || null,
        glReplacementFeeAccountId: val.glReplacementFeeAccountId || null,
        glOtherChargesFeeAccountId: val.glOtherChargesFeeAccountId || null,
        updatedAt: new Date(),
      };

      let resultRecord: any;
      if (existing) {
        [resultRecord] = await db.update(chequeSettings)
          .set(payload)
          .where(eq(chequeSettings.id, existing.id))
          .returning();
      } else {
        [resultRecord] = await db.insert(chequeSettings)
          .values({ ...payload, createdAt: new Date() })
          .returning();
      }

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Cheque Settings',
        existing ? 'Update Cheque Settings' : 'Configure Cheque Settings',
        `Cheque facility settings updated for scope ${scope}`,
        { oldValue: existing, newValue: resultRecord }
      ));

      res.json(resultRecord);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/cheque-settings/products
   * Load active Account Products available for Cheque Facility.
   */
  static async getEligibleProducts(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const products = await db.select({
        id: savingsProducts.id,
        code: savingsProducts.code,
        name: savingsProducts.name,
        productType: savingsProducts.productType,
        chequeEnabled: savingsProducts.chequeEnabled,
        isActive: savingsProducts.isActive,
      }).from(savingsProducts)
        .where(and(
          eq(savingsProducts.organizationId, organizationId),
          eq(savingsProducts.isActive, true)
        ))
        .orderBy(savingsProducts.name);

      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/cheque-books
   * Operational cheque book register list with search and filters.
   */
  static async getChequeBooks(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const accountId = req.query.accountId as string | undefined;
      const branchId = req.query.branchId as string | undefined;
      const status = req.query.status as string | undefined;
      const search = (req.query.search as string)?.trim();

      const conditions: any[] = [eq(chequeBooks.organizationId, organizationId)];

      if (accountId) conditions.push(eq(chequeBooks.accountId, accountId));
      if (branchId) conditions.push(eq(chequeBooks.branchId, branchId));
      if (status && status !== 'all') conditions.push(eq(chequeBooks.status, status as any));

      let query = db.select({
        id: chequeBooks.id,
        bookNumber: chequeBooks.bookNumber,
        prefix: chequeBooks.prefix,
        leafStartNumber: chequeBooks.leafStartNumber,
        leafEndNumber: chequeBooks.leafEndNumber,
        leafCount: chequeBooks.leafCount,
        issuedDateBs: chequeBooks.issuedDateBs,
        issuedDateAd: chequeBooks.issuedDateAd,
        status: chequeBooks.status,
        issuanceCharge: chequeBooks.issuanceCharge,
        cancelReason: chequeBooks.cancelReason,
        accountId: chequeBooks.accountId,
        accountNo: savingsAccounts.accountNo,
        memberId: savingsAccounts.memberId,
        memberName: members.fullName,
        memberNo: members.memberNo,
        branchId: chequeBooks.branchId,
        branchName: branches.name,
      })
      .from(chequeBooks)
      .innerJoin(savingsAccounts, eq(chequeBooks.accountId, savingsAccounts.id))
      .leftJoin(members, eq(savingsAccounts.memberId, members.id))
      .leftJoin(branches, eq(chequeBooks.branchId, branches.id))
      .where(and(...conditions))
      .orderBy(desc(chequeBooks.createdAt));

      const rows = await query;
      let filtered = rows;
      if (search) {
        const q = search.toLowerCase();
        filtered = rows.filter(r => 
          r.bookNumber?.toLowerCase().includes(q) ||
          r.accountNo?.toLowerCase().includes(q) ||
          r.memberName?.toLowerCase().includes(q) ||
          r.memberNo?.toLowerCase().includes(q)
        );
      }

      res.json(filtered);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/cheque-books
   * Concurrency-safe transactional cheque book issuance.
   */
  static async issueChequeBook(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const parseResult = issueChequeBookSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid cheque book request', details: parseResult.error.format() });
      }

      const { accountId, leafCount: requestedLeafCount, purpose, deliveryMethod, overrideReason } = parseResult.data;

      // Wrap allocation inside a DB Transaction with concurrency locking
      const result = await db.transaction(async (tx) => {
        // Concurrency Advisory Lock on Organization Cheque Allocation Namespace
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${organizationId} || '_cheque_alloc'))`);

        // Account must exist and belong to org (fetched first so its branch can
        // scope both the settings lookup and the numbering allocation).
        const [account] = await tx.select().from(savingsAccounts)
          .where(and(eq(savingsAccounts.id, accountId), eq(savingsAccounts.organizationId, organizationId)))
          .limit(1);
        if (!account) {
          throw new Error('Savings account not found.');
        }

        const branchId = account.branchId || req.user?.branchId || null;

        // Settings — branch override preferred over the org default.
        const config = await resolveChequeConfig(tx, organizationId, branchId);

        const defaultLeaves = config?.defaultLeavesPerBook || 25;
        const leafCount = requestedLeafCount || defaultLeaves;
        const prefix = config?.chequePrefix || 'CHQ-';
        const numLength = config?.numberLength || 6;
        const startNoConfig = config?.startingChequeNumber || 100001;
        const numberingScope = config?.numberingScope || 'branch_wise';

        // ── Server-side issuance eligibility (was client-only) ──────────────
        const [member] = await tx.select({ kycStatus: members.kycStatus, status: members.status })
          .from(members)
          .where(and(eq(members.id, account.memberId), eq(members.organizationId, organizationId)))
          .limit(1);

        const books = await tx.select({
          id: chequeBooks.id,
          status: chequeBooks.status,
          leafCount: chequeBooks.leafCount,
          issuedDateBs: chequeBooks.issuedDateBs,
        }).from(chequeBooks)
          .where(and(eq(chequeBooks.organizationId, organizationId), eq(chequeBooks.accountId, accountId)));

        // Used-leaf count per book (anything not 'unused') for utilisation.
        const usedRows = books.length
          ? await tx.select({ bookId: chequeLeaves.chequeBookId, used: count() })
              .from(chequeLeaves)
              .where(and(
                eq(chequeLeaves.organizationId, organizationId),
                eq(chequeLeaves.accountId, accountId),
                sql`${chequeLeaves.status} <> 'unused'`,
              ))
              .groupBy(chequeLeaves.chequeBookId)
          : [];
        const usedByBook = new Map<string, number>(usedRows.map((r) => [r.bookId, Number(r.used || 0)]));

        const eligibility = evaluateIssuanceEligibility({
          policy: toEligibilityPolicy(config),
          account: { status: account.status, savingsProductId: account.savingsProductId },
          member: { kycStatus: member?.kycStatus || 'Pending', status: member?.status || 'Active' },
          books: books.map((b) => ({
            id: b.id,
            status: b.status,
            leafCount: Number(b.leafCount || 0),
            usedLeaves: usedByBook.get(b.id) || 0,
            issuedDateBs: b.issuedDateBs,
          })),
          requestedLeafCount: requestedLeafCount ?? null,
          todayBs: DateConverter.getTodayBs(),
          overrideReason: overrideReason ?? null,
          overrideRole: req.user?.role ?? null,
        }, daysBetweenBS);

        if (!eligibility.eligible) {
          throw new ChequeError(
            eligibility.hardBlocks.length
              ? `Cheque book cannot be issued: ${eligibility.hardBlocks.join(' ')}`
              : `Issuance blocked (a supervisor override with a reason is required): ${eligibility.softBlocks.join(' ')}`,
            eligibility.reasons,
          );
        }

        // ── Numbering allocation, scoped per the org's numbering policy ─────
        const scopeCondition =
          numberingScope === 'account_wise' ? eq(chequeBooks.accountId, accountId)
          : numberingScope === 'product_wise' && account.savingsProductId ? eq(chequeBooks.accountProductId, account.savingsProductId)
          : numberingScope === 'branch_wise' && branchId ? eq(chequeBooks.branchId, branchId)
          : undefined; // org_wise (or missing scope key) → no extra filter
        const [lastAllocated] = await tx.select({ lastEnd: chequeBooks.leafEndNumber })
          .from(chequeBooks)
          .where(scopeCondition
            ? and(eq(chequeBooks.organizationId, organizationId), scopeCondition)
            : eq(chequeBooks.organizationId, organizationId))
          .orderBy(desc(chequeBooks.leafEndNumber))
          .limit(1);

        const leafStartNumber = lastAllocated ? (lastAllocated.lastEnd + 1) : startNoConfig;
        const leafEndNumber = leafStartNumber + leafCount - 1;

        // Book number from the highest existing numeric suffix (collision-free
        // even after a hard delete — the old count()+1 could reuse a number).
        const [seqRow]: any = await tx.execute(sql`
          SELECT COALESCE(MAX(NULLIF(regexp_replace(book_number, '[^0-9]', '', 'g'), '')::bigint), 0) AS maxseq
          FROM cheque_books WHERE organization_id = ${organizationId}
        `);
        const bookIdx = Number(seqRow?.maxseq ?? 0) + 1;
        const bookNumber = `CB-${String(bookIdx).padStart(5, '0')}`;

        const todayBs = DateConverter.getTodayBs();
        const todayAd = new Date().toISOString();

        // Issuance charge (flat / per-leaf / both) + tax — tax was never applied before.
        const charge = config
          ? computeIssuanceCharge(config, leafCount)
          : { base: 0, tax: 0, total: 0 };
        const chargeAmount = String(charge.total.toFixed(2));

        // Insert Cheque Book
        const [newBook] = await tx.insert(chequeBooks).values({
          organizationId,
          branchId,
          accountId: account.id,
          accountProductId: account.savingsProductId || null,

          bookNumber,
          prefix,
          leafStartNumber,
          leafEndNumber,
          leafCount,
          issuedDateBs: todayBs,
          issuedDateAd: todayAd,
          status: 'active',
          issuanceCharge: chargeAmount,
          issuedById: req.user?.userId || null,
          purpose: purpose || null,
          deliveryMethod: deliveryMethod || null,
          overrideReason: eligibility.overrideApplied ? (overrideReason || null) : null,
        }).returning();

        // Insert individual leaves. leafNo is the 1..n position within the book;
        // the absolute allocated number lives in chequeNumber.
        const leavesData = Array.from({ length: leafCount }, (_, i) => {
          const numSeq = leafStartNumber + i;
          const formattedChequeNo = `${prefix}${String(numSeq).padStart(numLength, '0')}`;
          return {
            organizationId,
            branchId,
            chequeBookId: newBook.id,
            accountId: account.id,
            chequeNumber: formattedChequeNo,
            leafNo: i + 1,
            status: 'unused' as const,
          };
        });

        await tx.insert(chequeLeaves).values(leavesData);

        // Post the issuance charge to the GL (skips cleanly when zero/unmapped).
        const voucher = await postChequeChargeVoucher(tx, {
          organizationId,
          branchId,
          feeAccountId: config?.glIssuanceFeeAccountId,
          amount: charge.total,
          narration: `Cheque book ${bookNumber} issuance charge — account ${account.accountNo}`,
          moduleReference: `cheque:issuance:${newBook.id}`,
          preparedBy: req.user?.userId,
          dateBs: todayBs,
          dateAd: todayAd.slice(0, 10),
        });

        return {
          newBook,
          totalLeaves: leavesData.length,
          charge,
          glPosted: !!voucher,
          overrideApplied: eligibility.overrideApplied,
        };
      });

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Cheque Operations',
        'Issue Cheque Book',
        `Issued cheque book ${result.newBook.bookNumber} (${result.totalLeaves} leaves) starting at ${result.newBook.leafStartNumber}`
        + (result.charge.total > 0 ? `; charge NPR ${result.charge.total.toFixed(2)}${result.glPosted ? ' (posted to GL)' : ' (GL not posted — fee account unmapped)'}` : '')
        + (result.overrideApplied ? '; SUPERVISOR OVERRIDE applied' : ''),
      ));

      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof ChequeError) {
        return res.status(400).json({ error: error.message, reasons: error.reasons });
      }
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * PUT /api/v1/cheque-books/:id/status
   * Cancel, Mark Lost, or Replace cheque book.
   */
  static async updateBookStatus(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const { id } = req.params;
      const { status, reason } = req.body;

      if (!['cancelled', 'lost', 'replaced', 'exhausted'].includes(status)) {
        return res.status(400).json({ error: 'Invalid cheque book status.' });
      }

      const [existing] = await db.select().from(chequeBooks)
        .where(and(eq(chequeBooks.id, id), eq(chequeBooks.organizationId, organizationId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: 'Cheque book not found.' });

      const config = await resolveChequeConfig(db, organizationId, existing.branchId);
      const todayBs = DateConverter.getTodayBs();

      // Lost / replaced books attract a charge (issued stationery must be
      // reprinted). 'cancelled'/'exhausted' are administrative and free.
      let chargeAmount = 0;
      if (status === 'lost') chargeAmount = Number(config?.lostBookCharge || 0);
      else if (status === 'replaced') chargeAmount = Number(config?.replacementBookCharge || 0);

      const result = await db.transaction(async (tx) => {
        await tx.update(chequeBooks)
          .set({
            status,
            cancelReason: reason || null,
            cancelledById: req.user?.userId || null,
            cancelledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(chequeBooks.id, existing.id));

        // Also update unused leaves to matching status if cancelled/lost
        if (['cancelled', 'lost'].includes(status)) {
          await tx.update(chequeLeaves)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(and(
              eq(chequeLeaves.chequeBookId, existing.id),
              eq(chequeLeaves.organizationId, organizationId),
              eq(chequeLeaves.status, 'unused')
            ));
        }

        // Post the lost/replacement charge to the GL (both map to the
        // replacement-fee income account — no separate lost-fee mapping exists).
        const voucher = await postChequeChargeVoucher(tx, {
          organizationId,
          branchId: existing.branchId,
          feeAccountId: config?.glReplacementFeeAccountId,
          amount: chargeAmount,
          narration: `Cheque book ${status} charge — ${existing.bookNumber}`,
          moduleReference: `cheque:book_${status}:${existing.id}`,
          preparedBy: req.user?.userId,
          dateBs: todayBs,
          dateAd: (DateConverter.bsToAd(todayBs) || new Date().toISOString()).slice(0, 10),
        });
        return { glPosted: !!voucher };
      });

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Cheque Operations',
        `Update Cheque Book Status (${status})`,
        `Cheque book ${existing.bookNumber} marked as ${status}. Reason: ${reason || 'N/A'}`
        + (chargeAmount > 0 ? `; charge NPR ${chargeAmount.toFixed(2)}${result.glPosted ? ' (posted to GL)' : ' (GL not posted — fee account unmapped)'}` : ''),
      ));

      res.json({ success: true, message: `Cheque book status updated to ${status}`, glPosted: result.glPosted });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/cheque-leaves
   * Fetch individual leaf register with filters.
   */
  static async getChequeLeaves(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const accountId = req.query.accountId as string | undefined;
      const bookId = req.query.bookId as string | undefined;
      const status = req.query.status as string | undefined;
      const search = (req.query.search as string)?.trim();

      const conditions: any[] = [eq(chequeLeaves.organizationId, organizationId)];
      if (accountId) conditions.push(eq(chequeLeaves.accountId, accountId));
      if (bookId) conditions.push(eq(chequeLeaves.chequeBookId, bookId));
      if (status && status !== 'all') conditions.push(eq(chequeLeaves.status, status as any));

      const rows = await db.select({
        id: chequeLeaves.id,
        chequeNumber: chequeLeaves.chequeNumber,
        leafNo: chequeLeaves.leafNo,
        status: chequeLeaves.status,
        payeeName: chequeLeaves.payeeName,
        amount: chequeLeaves.amount,
        chequeDateBs: chequeLeaves.chequeDateBs,
        stopPaymentReason: chequeLeaves.stopPaymentReason,
        bounceReason: chequeLeaves.bounceReason,
        chequeBookId: chequeLeaves.chequeBookId,
        bookNumber: chequeBooks.bookNumber,
        accountId: chequeLeaves.accountId,
        accountNo: savingsAccounts.accountNo,
        memberName: members.fullName,
      })
      .from(chequeLeaves)
      .innerJoin(chequeBooks, eq(chequeLeaves.chequeBookId, chequeBooks.id))
      .innerJoin(savingsAccounts, eq(chequeLeaves.accountId, savingsAccounts.id))
      .leftJoin(members, eq(savingsAccounts.memberId, members.id))
      .where(and(...conditions))
      .orderBy(desc(chequeLeaves.createdAt))
      .limit(200);

      let filtered = rows;
      if (search) {
        const q = search.toLowerCase();
        filtered = rows.filter(r => 
          r.chequeNumber?.toLowerCase().includes(q) ||
          r.bookNumber?.toLowerCase().includes(q) ||
          r.accountNo?.toLowerCase().includes(q) ||
          r.memberName?.toLowerCase().includes(q)
        );
      }

      res.json(filtered);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/cheque-leaves/search?number=XXX
   * Search for a specific cheque leaf by number across all accounts in the org.
   * Returns the leaf with full account + member context for auto-fill.
   */
  static async searchChequeLeaf(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const number = (req.query.number as string)?.trim();
      if (!number) return res.status(400).json({ error: 'Cheque number is required.' });

      const [leaf] = await db.select({
        id: chequeLeaves.id,
        chequeNumber: chequeLeaves.chequeNumber,
        leafNo: chequeLeaves.leafNo,
        status: chequeLeaves.status,
        chequeBookId: chequeLeaves.chequeBookId,
        accountId: chequeLeaves.accountId,
        bookNumber: chequeBooks.bookNumber,
        accountNo: savingsAccounts.accountNo,
        memberId: savingsAccounts.memberId,
        memberName: members.fullName,
        balance: savingsAccounts.balance,
        minBalance: savingsAccounts.minBalance,
        savingsProductId: savingsAccounts.savingsProductId,
      })
        .from(chequeLeaves)
        .innerJoin(chequeBooks, eq(chequeLeaves.chequeBookId, chequeBooks.id))
        .innerJoin(savingsAccounts, eq(chequeLeaves.accountId, savingsAccounts.id))
        .leftJoin(members, eq(savingsAccounts.memberId, members.id))
        .where(and(
          eq(chequeLeaves.organizationId, organizationId),
          eq(chequeLeaves.chequeNumber, number),
        ))
        .limit(1);

      if (!leaf) return res.status(404).json({ error: 'Cheque leaf not found.' });

      res.json(leaf);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/cheque-stop-payments
   * Submit a Stop Payment Request.
   */
  static async createStopPayment(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const parseResult = stopPaymentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid stop payment payload', details: parseResult.error.format() });
      }

      const { accountId, startChequeNumber, endChequeNumber, reason, chargeAmount } = parseResult.data;

      const branchId = req.user?.branchId || null;
      // Config governing this request — branch override preferred over org default.
      const config = await resolveChequeConfig(db, organizationId, branchId);

      if (config && config.stopPaymentEnabled === false) {
        return res.status(400).json({ error: 'Stop payment is disabled for this organization.' });
      }

      const requireApproval = config?.stopPaymentRequireApproval !== false;
      const initialStatus = requireApproval ? 'pending' : 'approved';
      const stopCharge = chargeAmount != null ? String(chargeAmount) : String(config?.stopPaymentCharge || '0.00');

      const stopRecord = await db.transaction(async (tx) => {
        const [record] = await tx.insert(chequeStopPayments).values({
          organizationId,
          branchId,
          accountId,
          startChequeNumber,
          endChequeNumber,
          reason,
          chargeAmount: stopCharge,
          status: initialStatus,
          requestedById: req.user?.userId || '00000000-0000-0000-0000-000000000000',
          approvedById: requireApproval ? null : req.user?.userId,
          approvedAt: requireApproval ? null : new Date(),
        }).returning();

        // Auto-approved (no approval workflow): stop the WHOLE range now and
        // post the stop-payment charge to the GL.
        if (!requireApproval) {
          const stoppedCount = await applyStopPaymentRange(tx, organizationId, accountId, startChequeNumber, endChequeNumber, reason);
          const todayBs = DateConverter.getTodayBs();
          const voucher = await postChequeChargeVoucher(tx, {
            organizationId,
            branchId,
            feeAccountId: config?.glStopPaymentFeeAccountId,
            amount: Number(stopCharge),
            narration: `Stop-payment charge — cheques ${startChequeNumber}–${endChequeNumber}`,
            moduleReference: `cheque:stop_payment:${record.id}`,
            preparedBy: req.user?.userId,
            dateBs: todayBs,
            dateAd: (DateConverter.bsToAd(todayBs) || new Date().toISOString()).slice(0, 10),
          });
          return { record, stoppedCount, glPosted: !!voucher };
        }
        return { record, stoppedCount: 0, glPosted: false };
      });

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Cheque Operations',
        'Create Stop Payment Request',
        `Stop payment requested for ${startChequeNumber} to ${endChequeNumber}. Status: ${initialStatus}`
        + (!requireApproval ? `; ${stopRecord.stoppedCount} leaf/leaves stopped${stopRecord.glPosted ? ', charge posted to GL' : ''}` : ''),
      ));

      res.status(201).json(stopRecord.record);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/cheque-stop-payments
   * List stop payment requests.
   */
  static async getStopPayments(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const rows = await db.select({
        id: chequeStopPayments.id,
        startChequeNumber: chequeStopPayments.startChequeNumber,
        endChequeNumber: chequeStopPayments.endChequeNumber,
        reason: chequeStopPayments.reason,
        chargeAmount: chequeStopPayments.chargeAmount,
        status: chequeStopPayments.status,
        requestedAt: chequeStopPayments.requestedAt,
        approvedAt: chequeStopPayments.approvedAt,
        rejectionReason: chequeStopPayments.rejectionReason,
        accountId: chequeStopPayments.accountId,
        accountNo: savingsAccounts.accountNo,
        memberName: members.fullName,
      })
      .from(chequeStopPayments)
      .innerJoin(savingsAccounts, eq(chequeStopPayments.accountId, savingsAccounts.id))
      .leftJoin(members, eq(savingsAccounts.memberId, members.id))
      .where(eq(chequeStopPayments.organizationId, organizationId))
      .orderBy(desc(chequeStopPayments.createdAt));

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/cheque-stop-payments/:id/approve
   * Approve a pending Stop Payment request.
   */
  static async approveStopPayment(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const { id } = req.params;
      const [existing] = await db.select().from(chequeStopPayments)
        .where(and(eq(chequeStopPayments.id, id), eq(chequeStopPayments.organizationId, organizationId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: 'Stop payment request not found.' });
      if (existing.status !== 'pending') return res.status(400).json({ error: `Cannot approve request in status ${existing.status}.` });

      const config = await resolveChequeConfig(db, organizationId, existing.branchId);

      const result = await db.transaction(async (tx) => {
        await tx.update(chequeStopPayments)
          .set({
            status: 'approved',
            approvedById: req.user?.userId || null,
            approvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(chequeStopPayments.id, existing.id));

        // Stop the ENTIRE requested range, not only the start leaf.
        const stoppedCount = await applyStopPaymentRange(
          tx, organizationId, existing.accountId,
          existing.startChequeNumber, existing.endChequeNumber, existing.reason,
        );

        // Post the stop-payment charge to the GL on approval (the charge is
        // realised when the order takes effect, not when it was merely requested).
        const todayBs = DateConverter.getTodayBs();
        const voucher = await postChequeChargeVoucher(tx, {
          organizationId,
          branchId: existing.branchId,
          feeAccountId: config?.glStopPaymentFeeAccountId,
          amount: Number(existing.chargeAmount || 0),
          narration: `Stop-payment charge — cheques ${existing.startChequeNumber}–${existing.endChequeNumber}`,
          moduleReference: `cheque:stop_payment:${existing.id}`,
          preparedBy: req.user?.userId,
          dateBs: todayBs,
          dateAd: (DateConverter.bsToAd(todayBs) || new Date().toISOString()).slice(0, 10),
        });
        return { stoppedCount, glPosted: !!voucher };
      });

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Cheque Operations',
        'Approve Stop Payment',
        `Approved stop payment for cheques ${existing.startChequeNumber}–${existing.endChequeNumber}`
        + `; ${result.stoppedCount} leaf/leaves stopped${result.glPosted ? ', charge posted to GL' : ''}`,
      ));

      res.json({ success: true, message: 'Stop payment request approved.', stoppedCount: result.stoppedCount, glPosted: result.glPosted });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/cheque-stop-payments/:id/reject
   * Reject a pending Stop Payment request.
   */
  static async rejectStopPayment(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const { id } = req.params;
      const { reason } = req.body;

      const [existing] = await db.select().from(chequeStopPayments)
        .where(and(eq(chequeStopPayments.id, id), eq(chequeStopPayments.organizationId, organizationId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: 'Stop payment request not found.' });

      await db.update(chequeStopPayments)
        .set({
          status: 'rejected',
          rejectedAt: new Date(),
          rejectionReason: reason || 'Rejected by authorized personnel',
          updatedAt: new Date(),
        })
        .where(eq(chequeStopPayments.id, existing.id));

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Cheque Operations',
        'Reject Stop Payment',
        `Rejected stop payment for cheque ${existing.startChequeNumber}`
      ));

      res.json({ success: true, message: 'Stop payment request rejected.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/cheque-bounces
   * Record a bounced cheque in the immutable dishonour register.
   */
  static async recordBounce(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const parseResult = recordBounceSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid bounce request payload', details: parseResult.error.format() });
      }

      const { accountId, chequeLeafId, chequeNumber, amount, bounceReason, bounceCharge: reqBounceCharge } = parseResult.data;

      const branchId = req.user?.branchId || null;
      const config = await resolveChequeConfig(db, organizationId, branchId);

      const chargeAmount = reqBounceCharge != null ? String(reqBounceCharge) : String(config?.bounceCharge || '0.00');
      const todayBs = DateConverter.getTodayBs();

      const result = await db.transaction(async (tx) => {
        // Insert immutable bounce record
        const [bounceRecord] = await tx.insert(chequeBounces).values({
          organizationId,
          branchId,
          accountId,
          chequeLeafId: chequeLeafId || null,
          chequeNumber,
          amount: String(amount),
          bounceReason,
          bounceCharge: chargeAmount,
          reportedDate: todayBs,
          reportedById: req.user?.userId || '00000000-0000-0000-0000-000000000000',
        }).returning();

        // Update leaf status to bounced if matching leaf exists
        await tx.update(chequeLeaves)
          .set({
            status: 'bounced',
            bounceDate: new Date(),
            bounceReason,
            updatedAt: new Date(),
          })
          .where(and(
            eq(chequeLeaves.organizationId, organizationId),
            eq(chequeLeaves.accountId, accountId),
            eq(chequeLeaves.chequeNumber, chequeNumber)
          ));

        // Post the dishonour charge to the GL (Dr Cash/Bank, Cr bounce-fee income).
        const voucher = await postChequeChargeVoucher(tx, {
          organizationId,
          branchId,
          feeAccountId: config?.glBounceFeeAccountId,
          amount: Number(chargeAmount),
          narration: `Cheque dishonour charge — ${chequeNumber}`,
          moduleReference: `cheque:bounce:${bounceRecord.id}`,
          preparedBy: req.user?.userId,
          dateBs: todayBs,
          dateAd: (DateConverter.bsToAd(todayBs) || new Date().toISOString()).slice(0, 10),
        });
        return { bounceRecord, glPosted: !!voucher };
      });

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Cheque Operations',
        'Record Bounced Cheque',
        `Bounced cheque ${chequeNumber} (NPR ${amount}) recorded. Reason: ${bounceReason}`
        + (Number(chargeAmount) > 0 ? `; charge NPR ${Number(chargeAmount).toFixed(2)}${result.glPosted ? ' (posted to GL)' : ' (GL not posted — fee account unmapped)'}` : ''),
      ));

      res.status(201).json(result.bounceRecord);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/cheque-bounces
   * Fetch dishonour / bounce register log.
   */
  static async getBounces(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const rows = await db.select({
        id: chequeBounces.id,
        chequeNumber: chequeBounces.chequeNumber,
        amount: chequeBounces.amount,
        bounceReason: chequeBounces.bounceReason,
        bounceCharge: chequeBounces.bounceCharge,
        reportedDate: chequeBounces.reportedDate,
        createdAt: chequeBounces.createdAt,
        accountId: chequeBounces.accountId,
        accountNo: savingsAccounts.accountNo,
        memberName: members.fullName,
      })
      .from(chequeBounces)
      .innerJoin(savingsAccounts, eq(chequeBounces.accountId, savingsAccounts.id))
      .leftJoin(members, eq(savingsAccounts.memberId, members.id))
      .where(eq(chequeBounces.organizationId, organizationId))
      .orderBy(desc(chequeBounces.createdAt));

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
