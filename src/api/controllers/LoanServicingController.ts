/**
 * Loan Servicing Controller
 * ---------------------------------------------------------------------------
 * HTTP surface for the ledger-posting loan lifecycle: disbursement, GL-posted
 * repayment, arrears/penalty, reschedule, write-off, NPL classification and
 * the read screens that back them.
 *
 * Tenant context is derived exclusively through the scope middleware
 * (organizationId + branch scope) — never from the request body. The actor
 * recorded on vouchers and audit rows is taken from the authenticated session,
 * so the browser cannot claim to be someone else.
 */
import { Response } from 'express';
import { LoanServicingService } from '../services/LoanServicingService';
import { requireOrg, getBranchScope, getActorName, ScopeError } from '../middleware/scope';
import type { AuthRequest } from '../middleware/authMiddleware';
import { z } from 'zod';
import { getCurrentFiscalYearCode, getTodayBS } from '../../utils/nepaliCalendar';

const service = new LoanServicingService();

/** Branch ids this actor may operate within (undefined = whole org). */
const scopeOf = (req: AuthRequest): string[] | undefined => {
  const scope = getBranchScope(req);
  return scope.isOrgAdmin ? undefined : scope.branchIds;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The actor's user id for the `uuid` audit columns (waived_by, approved_by,
 * updated_by). Returns null unless it really is a uuid: the dev auth bypass
 * issues a placeholder id, and handing that to Postgres would abort the whole
 * transaction on a cast error rather than merely losing the attribution. The
 * human-readable actor still reaches the voucher via getActorName.
 */
const actorId = (req: AuthRequest): string | null => {
  const id = req.user?.userId;
  return id && UUID.test(id) ? id : null;
};

/** Maps a domain error to an HTTP status: scope → 403, "not found" → 404, else 400. */
const fail = (res: Response, error: any) => {
  console.error('[BankCheque]', error?.message, error?.code, error?.stack);
  if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
  const message: string = error?.message ?? 'Request failed.';
  if (/not found/i.test(message)) return res.status(404).json({ error: message });
  if (error?.code === '23505') return res.status(409).json({ error: message });
  if (error?.code === '23503') return res.status(400).json({ error: `Reference error: ${message}` });
  if (/relation .* does not exist/i.test(message)) return res.status(500).json({ error: 'Database table not found. Please apply the bank_cheque_books migration.', detail: message });
  return res.status(500).json({ error: message, code: error?.code });
};

export class LoanServicingController {
  // ---- DISBURSEMENT ----

  static async previewDisbursement(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.previewDisbursement(
        organizationId,
        req.params.id,
        req.query.dateBs as string | undefined,
        scopeOf(req),
      );
      res.json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }

  static async disburse(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.disburse(organizationId, req.body, getActorName(req), scopeOf(req));
      res.status(201).json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }

  // ---- REPAYMENT ----

  static async getDueBreakdown(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.getDueBreakdown(
        organizationId,
        req.params.id,
        req.query.asOfDateBs as string | undefined,
        scopeOf(req),
      );
      res.json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }

  static async recordRepayment(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.recordRepayment(organizationId, req.body, getActorName(req), scopeOf(req));
      res.status(201).json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }

  // ---- ARREARS ----

  static async accruePenalty(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.accruePenalty(organizationId, req.body, getActorName(req), scopeOf(req));
      res.status(201).json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }

  static async runArrearsBatch(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.runArrearsBatch(
        organizationId,
        req.body?.asOfDateBs,
        getActorName(req),
        scopeOf(req),
      );
      res.json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }

  static async classify(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.classify(
        organizationId,
        req.params.id,
        req.body?.asOfDateBs,
        scopeOf(req),
      );
      res.json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }

  static async runClassificationBatch(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.runClassificationBatch(organizationId, req.body?.asOfDateBs, scopeOf(req));
      res.json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }

  static async waivePenalty(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.waivePenalty(organizationId, req.body, actorId(req), scopeOf(req));
      res.json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }

  // ---- RESCHEDULE ----

  static async reschedule(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.reschedule(organizationId, req.body, actorId(req), scopeOf(req));
      res.status(201).json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }

  // ---- WRITE-OFF ----

  static async writeOff(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      // The voucher records the human actor; the audit row's approved_by is a
      // uuid foreign-key style column, so it takes the user id.
      const result = await service.writeOff(organizationId, req.body, getActorName(req), actorId(req), scopeOf(req));
      res.status(201).json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }

  /** Submit a write-off request for approval workflow. */
  static async requestWriteOff(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.requestWriteOff(organizationId, req.body, getActorName(req), actorId(req));
      res.status(201).json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }

  // ---- READS ----

  static async getSchedule(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const result = await service.getSchedule(
        organizationId,
        req.params.id,
        req.query.asOfDateBs as string | undefined,
        scopeOf(req),
      );
      res.json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }

  static async listPenalties(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      res.json(await service.listPenalties(organizationId, req.params.id, scopeOf(req)));
    } catch (error: any) {
      fail(res, error);
    }
  }

  static async listReschedules(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      res.json(await service.listReschedules(organizationId, req.params.id, scopeOf(req)));
    } catch (error: any) {
      fail(res, error);
    }
  }

  static async getRepayments(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      res.json(await service.getRepayments(organizationId, req.params.id, scopeOf(req)));
    } catch (error: any) {
      fail(res, error);
    }
  }

  static async getStatement(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      res.json(await service.getStatement(organizationId, req.params.id, scopeOf(req)));
    } catch (error: any) {
      fail(res, error);
    }
  }

  static async getPortfolioRisk(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      res.json(await service.getPortfolioRisk(organizationId, scopeOf(req)));
    } catch (error: any) {
      fail(res, error);
    }
  }

  // ---- PROVISIONING POLICY ----

  static async getProvisioningSettings(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      res.json(await service.getProvisioningSettings(organizationId));
    } catch (error: any) {
      fail(res, error);
    }
  }

  static async updateProvisioningSettings(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      res.json(await service.updateProvisioningSettings(organizationId, req.body, actorId(req)));
    } catch (error: any) {
      fail(res, error);
    }
  }

  // ---- ACTIVE LOAN PORTFOLIO (for amortization simulator) ----

  static async getActivePortfolio(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      res.json(await service.getActivePortfolio(organizationId));
    } catch (error: any) {
      fail(res, error);
    }
  }
}

// ---------------------------------------------------------------------------
// Validation schemas
// Each is wrapped as z.object({ body }) for validateRequest; the exported
// `...Payload` is the plain body schema the frontend uses for safeParse.
// Amounts arrive as either JSON numbers or numeric strings — nonNegativeAmount
// accepts both, mirroring LoanController.
// ---------------------------------------------------------------------------
const bsDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a BS date in YYYY-MM-DD form.');

const nonNegativeAmount = z.union([
  z.number().min(0),
  z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: 'Must be a valid non-negative number',
  }),
]);

export const disburseLoanPayload = z.object({
  loanId: z.string().uuid(),
  dateBs: bsDate.optional(),
  disbursementMethod: z.enum(['Cash', 'Bank']).default('Cash'),
  paymentAccountId: z.string().uuid().nullish(),
  chequeLeafId: z.string().uuid().nullish(),
  deductProcessingFee: z.boolean().optional(),
  narration: z.string().max(500).nullish(),
  remarks: z.string().max(500).nullish(),
  disbursementPaymentMethod: z.enum(['CASH', 'SAVINGS_TRANSFER', 'CHEQUE']).nullish(),
  disbursementReferenceId: z.string().max(200).nullish(),
});
export const disburseLoanSchema = z.object({ body: disburseLoanPayload });

export const servicingRepayPayload = z.object({
  loanId: z.string().uuid(),
  principalPaid: nonNegativeAmount.optional().default('0'),
  interestPaid: nonNegativeAmount.optional().default('0'),
  penaltyPaid: nonNegativeAmount.optional().default('0'),
  paymentMode: z.enum(['Cash', 'Bank_Transfer']).default('Cash'),
  dateBs: bsDate.optional(),
  receiptNo: z.string().max(60).nullish(),
  paymentAccountId: z.string().uuid().nullish(),
  narration: z.string().max(500).nullish(),
});
export const servicingRepaySchema = z.object({ body: servicingRepayPayload });

export const accruePenaltyPayload = z.object({
  loanId: z.string().uuid(),
  asOfDateBs: bsDate.optional(),
});
export const accruePenaltySchema = z.object({ body: accruePenaltyPayload });

export const arrearsBatchPayload = z.object({
  asOfDateBs: bsDate.optional(),
});
export const arrearsBatchSchema = z.object({ body: arrearsBatchPayload });

export const classifyPayload = z.object({
  asOfDateBs: bsDate.optional(),
});
export const classifySchema = z.object({ body: classifyPayload });

export const waivePenaltyPayload = z.object({
  penaltyId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});
export const waivePenaltySchema = z.object({ body: waivePenaltyPayload });

export const rescheduleLoanPayload = z.object({
  loanId: z.string().uuid(),
  newTenureMonths: z.number().int().positive().or(
    z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) > 0, 'Tenure must be a positive whole number.'),
  ),
  newRatePct: nonNegativeAmount,
  effectiveDateBs: bsDate.optional(),
  reason: z.string().min(5).max(500),
});
export const rescheduleLoanSchema = z.object({ body: rescheduleLoanPayload });

export const writeOffLoanPayload = z.object({
  loanId: z.string().uuid(),
  dateBs: bsDate.optional(),
  principalAmount: nonNegativeAmount.nullish(),
  interestAmount: nonNegativeAmount.optional().default('0'),
  reason: z.string().min(10).max(500),
});
export const writeOffLoanSchema = z.object({ body: writeOffLoanPayload });

const percent = z.union([
  z.number().min(0).max(100),
  z.string().refine((v) => !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100, 'Must be between 0 and 100.'),
]);
const positiveDays = z.union([
  z.number().int().positive(),
  z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) > 0, 'Must be a positive whole number of days.'),
]);

export const provisioningSettingsPayload = z.object({
  watchlistMinDays: positiveDays.optional(),
  substandardMinDays: positiveDays.optional(),
  doubtfulMinDays: positiveDays.optional(),
  lossMinDays: positiveDays.optional(),
  penaltyGraceDays: z.union([
    z.number().int().min(0),
    z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0, 'Must be zero or more days.'),
  ]).optional(),
  passProvisionPercent: percent.optional(),
  watchlistProvisionPercent: percent.optional(),
  substandardProvisionPercent: percent.optional(),
  doubtfulProvisionPercent: percent.optional(),
  lossProvisionPercent: percent.optional(),
  autoClassifyOnAccrual: z.boolean().optional(),
});
export const provisioningSettingsSchema = z.object({ body: provisioningSettingsPayload });

// ---- BANK CHEQUE LEAVES ----
import { bankChequeBooks, bankChequeLeaves } from '../../db/schema/bankCheques';
import { chartOfAccounts } from '../../db/schema/accounting';
import { bankAccounts } from '../../db/schema/accountingSettings';
import { eq, and, count as drizzleCount, asc, inArray, sql } from 'drizzle-orm';
import { getDb } from '../../db/client';

export class BankChequeController {
  /** GET /bank-cheques/leaves?bankAccountId=... — all cheque leaves for a bank GL account. */
  static async getAvailableLeaves(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const bankAccountId = req.query.bankAccountId as string | undefined;
      if (!bankAccountId) return res.status(400).json({ error: 'bankAccountId is required.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const rows = await db.select({
        id: bankChequeLeaves.id,
        chequeNumber: bankChequeLeaves.chequeNumber,
        leafNo: bankChequeLeaves.leafNo,
        chequeBookId: bankChequeLeaves.chequeBookId,
        bankAccountId: bankChequeLeaves.bankAccountId,
        status: bankChequeLeaves.status,
        payeeName: bankChequeLeaves.payeeName,
        amount: bankChequeLeaves.amount,
        chequeDateBs: bankChequeLeaves.chequeDateBs,
        loanId: bankChequeLeaves.loanId,
        voucherId: bankChequeLeaves.voucherId,
        usedAt: bankChequeLeaves.usedAt,
        clearedAt: bankChequeLeaves.clearedAt,
        bookNumber: bankChequeBooks.bookNumber,
        prefix: bankChequeBooks.prefix,
      })
        .from(bankChequeLeaves)
        .innerJoin(bankChequeBooks, eq(bankChequeLeaves.chequeBookId, bankChequeBooks.id))
        .where(and(
          eq(bankChequeLeaves.organizationId, organizationId),
          eq(bankChequeLeaves.bankAccountId, bankAccountId),
        ))
        .orderBy(asc(bankChequeBooks.leafStartNumber), asc(bankChequeLeaves.leafNo));

      res.json(rows);
    } catch (error: any) {
      fail(res, error);
    }
  }

  /** GET /bank-cheques/books?bankAccountId=... — cheque books for a bank account. */
  static async getBooks(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const bankAccountId = req.query.bankAccountId as string | undefined;
      if (!bankAccountId) return res.status(400).json({ error: 'bankAccountId is required.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const conditions: any[] = [
        eq(bankChequeBooks.organizationId, organizationId),
        eq(bankChequeBooks.bankAccountId, bankAccountId),
        eq(bankChequeBooks.status, 'active'),
      ];

      const rows = await db.select({
        id: bankChequeBooks.id,
        bookNumber: bankChequeBooks.bookNumber,
        prefix: bankChequeBooks.prefix,
        leafStartNumber: bankChequeBooks.leafStartNumber,
        leafEndNumber: bankChequeBooks.leafEndNumber,
        leafCount: bankChequeBooks.leafCount,
        issuedDateBs: bankChequeBooks.issuedDateBs,
        status: bankChequeBooks.status,
      })
        .from(bankChequeBooks)
        .where(and(...conditions));

      res.json(rows);
    } catch (error: any) {
      fail(res, error);
    }
  }

  /** POST /bank-cheques/issue — issue a new cheque book for a cooperative bank account.
   *  Accepts either `mode: 'range'` (startingLeafNo + totalLeaves) or `mode: 'individual'` (leafNumbers[]). */
  static async issueBook(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;

      const { bankAccountId, mode, startingLeafNo, totalLeaves, leafNumbers, issuedDateBs, issuedDateAd, purpose } = req.body;
      if (!bankAccountId || !issuedDateBs || !issuedDateAd) {
        return res.status(400).json({ error: 'bankAccountId, issuedDateBs, issuedDateAd are required.' });
      }

      // Normalize both modes into a flat, sorted leaf number list
      let leafList: number[];
      let isIndividualMode = false;

      if (mode === 'individual') {
        if (!Array.isArray(leafNumbers) || leafNumbers.length === 0) {
          return res.status(400).json({ error: 'leafNumbers array is required for individual mode.' });
        }
        if (leafNumbers.length > 500) {
          return res.status(400).json({ error: 'Maximum 500 leaves per book.' });
        }
        leafList = [...new Set(leafNumbers.map(Number))].filter((n) => !isNaN(n) && n >= 1).sort((a, b) => a - b);
        if (leafList.length === 0) {
          return res.status(400).json({ error: 'No valid leaf numbers provided.' });
        }
        isIndividualMode = true;
      } else {
        // Default: range mode
        const startLeaf = Number(startingLeafNo);
        const leafCount = Number(totalLeaves);
        if (isNaN(startLeaf) || startLeaf < 1) {
          return res.status(400).json({ error: 'startingLeafNo must be a positive integer.' });
        }
        if (isNaN(leafCount) || leafCount < 1 || leafCount > 500) {
          return res.status(400).json({ error: 'totalLeaves must be between 1 and 500.' });
        }
        leafList = Array.from({ length: leafCount }, (_, i) => startLeaf + i);
      }

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      // Verify bank account exists in COA
      const [bankAccount] = await db.select().from(chartOfAccounts)
        .where(and(eq(chartOfAccounts.id, bankAccountId), eq(chartOfAccounts.organizationId, organizationId)))
        .limit(1);
      if (!bankAccount) return res.status(404).json({ error: 'Bank GL account not found. Make sure this bank account has a GL account linked in Accounting Settings → Bank Accounts.' });

      const fiscalYearBs = getCurrentFiscalYearCode();

      const result = await db.transaction(async (tx) => {
        // 1. Overlap check — use IN() for both modes (handles gaps in individual mode)
        const overlap = await tx.select({ leafNo: bankChequeLeaves.leafNo, chequeNumber: bankChequeLeaves.chequeNumber })
          .from(bankChequeLeaves)
          .where(and(
            eq(bankChequeLeaves.bankAccountId, bankAccountId),
            inArray(bankChequeLeaves.leafNo, leafList),
          ));
        if (overlap.length > 0) {
          const dupes = overlap.map((r) => r.leafNo).join(', ');
          throw new Error(`Leaf number(s) already exist: ${dupes}`);
        }

        // 2. Compute book sequence for this bank account
        const [bookCountRow] = await tx.select({ count: sql<number>`COUNT(*)::int` })
          .from(bankChequeBooks)
          .where(eq(bankChequeBooks.bankAccountId, bankAccountId));
        const bookSequence = (bookCountRow?.count ?? 0) + 1;

        // Look up branch from bank account
        const [bankAccRow] = await tx.select({ branchId: bankAccounts.branchId })
          .from(bankAccounts)
          .where(eq(bankAccounts.glAccountId, bankAccountId))
          .limit(1);

        // 3. Insert parent chequebook record
        const bookNumber = `BK-${String(bookSequence).padStart(3, '0')}`;
        const [book] = await tx.insert(bankChequeBooks).values({
          organizationId,
          branchId: bankAccRow?.branchId ?? null,
          bankAccountId,
          bookNumber,
          prefix: null,
          leafStartNumber: leafList[0],
          leafEndNumber: leafList[leafList.length - 1],
          leafCount: leafList.length,
          issuedDateBs,
          issuedDateAd,
          issuedById: null,
          purpose: purpose || null,
          leafNumbersJson: isIndividualMode ? JSON.stringify(leafList) : null,
        }).returning();

        // 4. Auto-generate leaves: {paddedLeafNo}-{fiscalYearBs}-{bookSequence}
        const seqPad = String(bookSequence).padStart(3, '0');
        const leaves = leafList.map((leafNo) => ({
          organizationId,
          chequeBookId: book.id,
          bankAccountId,
          chequeNumber: `${String(leafNo).padStart(6, '0')}-${fiscalYearBs}-${seqPad}`,
          leafNo,
          status: 'unused' as const,
        }));
        await tx.insert(bankChequeLeaves).values(leaves);

        return {
          book,
          leafCount: leaves.length,
          chequeRange: leaves.length <= 10
            ? leaves.map((l) => l.chequeNumber).join(', ')
            : `${leaves[0].chequeNumber} – ${leaves[leaves.length - 1].chequeNumber}`,
          mode: isIndividualMode ? 'individual' : 'range',
        };
      });

      res.status(201).json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }

  /** POST /bank-cheques/void — void/cancel an unused cheque leaf with mandatory reason. */
  static async voidLeaf(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;

      const { leafId, reason } = req.body;
      if (!leafId || !reason?.trim()) {
        return res.status(400).json({ error: 'leafId and reason are required.' });
      }

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const [leaf] = await db.select().from(bankChequeLeaves)
        .where(and(eq(bankChequeLeaves.id, leafId), eq(bankChequeLeaves.organizationId, organizationId)))
        .limit(1);
      if (!leaf) return res.status(404).json({ error: 'Cheque leaf not found.' });
      if (leaf.status !== 'unused') {
        return res.status(400).json({ error: `Cannot void a cheque with status "${leaf.status}". Only AVAILABLE cheques can be voided.` });
      }

      await db.update(bankChequeLeaves)
        .set({
          status: 'cancelled',
          cancelReason: reason.trim(),
          updatedAt: new Date(),
        })
        .where(eq(bankChequeLeaves.id, leafId));

      res.json({ success: true, message: `Cheque ${leaf.chequeNumber} has been voided.` });
    } catch (error: any) {
      fail(res, error);
    }
  }

  /** PATCH /bank-cheques/:leafId/clear — mark an issued cheque leaf as cleared. */
  static async clearLeaf(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;

      const { leafId } = req.params;
      if (!leafId) return res.status(400).json({ error: 'leafId is required.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const [leaf] = await db.select().from(bankChequeLeaves)
        .where(and(eq(bankChequeLeaves.id, leafId), eq(bankChequeLeaves.organizationId, organizationId)))
        .limit(1);
      if (!leaf) return res.status(404).json({ error: 'Cheque leaf not found.' });
      if (leaf.status !== 'issued') {
        return res.status(400).json({ error: `Cannot clear a cheque with status "${leaf.status}". Only ISSUED cheques can be cleared.` });
      }

      await db.update(bankChequeLeaves)
        .set({ status: 'cleared', clearedAt: new Date(), updatedAt: new Date() })
        .where(eq(bankChequeLeaves.id, leafId));

      res.json({ success: true, message: `Cheque ${leaf.chequeNumber} marked as cleared.` });
    } catch (error: any) {
      fail(res, error);
    }
  }

  /** PATCH /bank-cheques/:leafId/bounce — mark an issued cheque leaf as bounced/cancelled with reason. */
  static async bounceLeaf(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;

      const { leafId } = req.params;
      const { reason } = req.body;
      if (!leafId) return res.status(400).json({ error: 'leafId is required.' });
      if (!reason?.trim()) return res.status(400).json({ error: 'Reason is required to bounce a cheque.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      const [leaf] = await db.select().from(bankChequeLeaves)
        .where(and(eq(bankChequeLeaves.id, leafId), eq(bankChequeLeaves.organizationId, organizationId)))
        .limit(1);
      if (!leaf) return res.status(404).json({ error: 'Cheque leaf not found.' });
      if (leaf.status !== 'issued') {
        return res.status(400).json({ error: `Cannot bounce a cheque with status "${leaf.status}". Only ISSUED cheques can be bounced.` });
      }

      await db.update(bankChequeLeaves)
        .set({ status: 'cancelled', cancelReason: `Bounced: ${reason.trim()}`, updatedAt: new Date() })
        .where(eq(bankChequeLeaves.id, leafId));

      res.json({ success: true, message: `Cheque ${leaf.chequeNumber} marked as bounced.` });
    } catch (error: any) {
      fail(res, error);
    }
  }

  /** POST /bank-cheques/voucher — post a bank cheque payment voucher with strict validation. */
  static async postVoucher(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;

      const {
        bankAccountId,
        chequeLeafId,
        payeeName,
        amount,
        voucherDateBS,
        voucherDateAD,
        particulars,
        debitLedgerId,
      } = req.body;

      // Basic required field check
      if (!bankAccountId || !chequeLeafId || !payeeName || !amount || !voucherDateBS || !voucherDateAD || !particulars || !debitLedgerId) {
        return res.status(400).json({
          error: 'bankAccountId, chequeLeafId, payeeName, amount, voucherDateBS, voucherDateAD, particulars, debitLedgerId are all required.',
        });
      }

      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number.' });
      }

      const { processBankChequeVoucher } = await import('../services/LoanServicingService');
      const result = await processBankChequeVoucher({
        organizationId,
        bankAccountId,
        chequeLeafId,
        payeeName: payeeName.trim(),
        amount: numAmount,
        voucherDateBS,
        voucherDateAD,
        particulars: particulars.trim(),
        debitLedgerId,
      });

      res.status(201).json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }

  static async postSavingsWithdrawalByCheque(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;

      const {
        savingsAccountId,
        amount,
        bankAccountId,
        chequeLeafId,
        payeeName,
        voucherDateBS,
        voucherDateAD,
        particulars,
      } = req.body;

      if (!savingsAccountId || !amount || !bankAccountId || !chequeLeafId || !payeeName || !voucherDateBS || !voucherDateAD || !particulars) {
        return res.status(400).json({
          error: 'savingsAccountId, amount, bankAccountId, chequeLeafId, payeeName, voucherDateBS, voucherDateAD, particulars are all required.',
        });
      }

      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number.' });
      }

      const { processSavingsWithdrawalByCheque } = await import('../services/LoanServicingService');
      const result = await processSavingsWithdrawalByCheque({
        organizationId,
        savingsAccountId,
        amount: numAmount,
        bankAccountId,
        chequeLeafId,
        payeeName: payeeName.trim(),
        dateBs: voucherDateBS,
        dateAd: voucherDateAD,
        particulars: particulars.trim(),
      });

      res.status(201).json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }

  /** POST /bank-cheques/mark-issued — mark a cheque leaf as issued (no voucher, just status change). */
  static async markLeafIssued(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;

      const { leafId, payeeName, amount, chequeDateBs, chequeDateAd, bankAccountId } = req.body;
      if (!leafId || !payeeName) {
        return res.status(400).json({ error: 'leafId and payeeName are required.' });
      }

      const db = getDb();
      if (!db) return res.status(500).json({ error: 'Database not connected.' });

      const { bankChequeLeaves, bankChequeBooks } = await import('../../db/schema/bankCheques');
      const { eq, and } = await import('drizzle-orm');

      const [leaf] = await db.select().from(bankChequeLeaves)
        .where(and(eq(bankChequeLeaves.id, leafId), eq(bankChequeLeaves.organizationId, organizationId)))
        .limit(1);
      if (!leaf) return res.status(404).json({ error: 'Cheque leaf not found.' });
      if (leaf.status !== 'unused') {
        return res.status(400).json({ error: `Cheque #${leaf.chequeNumber} has already been ${leaf.status}.` });
      }

      // Validate that the cheque belongs to the specified bank account
      if (bankAccountId) {
        const [book] = await db.select({ bankAccountId: bankChequeBooks.bankAccountId })
          .from(bankChequeBooks)
          .where(eq(bankChequeBooks.id, leaf.chequeBookId))
          .limit(1);
        if (!book || book.bankAccountId !== bankAccountId) {
          return res.status(400).json({ error: `Cheque #${leaf.chequeNumber} does not belong to the selected bank account. Cross-bank cheque usage is not allowed.` });
        }
      }

      await db.update(bankChequeLeaves)
        .set({
          status: 'issued',
          payeeName: payeeName.trim(),
          amount: amount ? String(amount) : null,
          chequeDateBs: chequeDateBs || null,
          chequeDateAd: chequeDateAd || null,
          usedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bankChequeLeaves.id, leafId));

      res.json({ success: true, chequeNumber: leaf.chequeNumber, message: `Cheque ${leaf.chequeNumber} marked as issued.` });
    } catch (error: any) {
      fail(res, error);
    }
  }

  // ── Internal Cheque Repayment (Third-Party / Self) ──
  static async postInternalChequeRepayment(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      const { processInternalChequeRepayment } = await import('../services/LoanServicingService');
      const { borrowerLoanId, payerSavingsAccountId, payerMemberId, chequeLeafId, chequeNumber, payeeName, chequeDateBs, chequeDateAd, principalPaid, interestPaid, penaltyPaid, isThirdParty } = req.body;

      if (!borrowerLoanId) return res.status(400).json({ error: 'borrowerLoanId is required.' });
      if (!payerSavingsAccountId) return res.status(400).json({ error: 'payerSavingsAccountId is required.' });
      if (!chequeLeafId) return res.status(400).json({ error: 'chequeLeafId is required.' });
      if (!payeeName?.trim()) return res.status(400).json({ error: 'payeeName is required.' });
      if (!chequeDateBs?.trim()) return res.status(400).json({ error: 'chequeDateBs is required.' });

      const totalPaid = Number(principalPaid || 0) + Number(interestPaid || 0) + Number(penaltyPaid || 0);
      if (totalPaid <= 0) return res.status(400).json({ error: 'Total repayment amount must be greater than zero.' });

      // Fetch custom GL mappings from the loan application (if any)
      let customGlMappings: Record<string, string> | undefined;
      try {
        const { getDb } = await import('../../db/client');
        const db = getDb();
        if (db) {
          const { loanAccounts } = await import('../../db/schema/loans');
          const { loanApplications } = await import('../../db/schema/loanApplications');
          const { eq: eq2, and: and2 } = await import('drizzle-orm');
          // Find the loan application linked to this loan account (via borrower + product)
          const [loan] = await db.select({ borrowerId: loanAccounts.memberId, loanProductId: loanAccounts.loanProductId })
            .from(loanAccounts)
            .where(and2(eq2(loanAccounts.id, borrowerLoanId), eq2(loanAccounts.organizationId, organizationId)))
            .limit(1);
          if (loan) {
            const [app] = await db.select({ customGlMappings: loanApplications.customGlMappings })
              .from(loanApplications)
              .where(and2(
                eq2(loanApplications.borrowerId, loan.borrowerId),
                eq2(loanApplications.loanProductId, loan.loanProductId),
              ))
              .limit(1);
            if (app?.customGlMappings && typeof app.customGlMappings === 'object' && Object.keys(app.customGlMappings).length > 0) {
              customGlMappings = app.customGlMappings as Record<string, string>;
            }
          }
        }
      } catch { /* custom mappings are optional */ }

      const result = await processInternalChequeRepayment({
        organizationId,
        borrowerLoanId,
        payerSavingsAccountId,
        payerMemberId: payerMemberId || '',
        chequeLeafId,
        chequeNumber: chequeNumber || '',
        payeeName: payeeName.trim(),
        chequeDateBs: chequeDateBs.trim(),
        chequeDateAd: chequeDateAd || '',
        principalPaid: Number(principalPaid || 0),
        interestPaid: Number(interestPaid || 0),
        penaltyPaid: Number(penaltyPaid || 0),
        isThirdParty: Boolean(isThirdParty),
        customGlMappings,
      });

      res.json(result);
    } catch (error: any) {
      fail(res, error);
    }
  }
}
