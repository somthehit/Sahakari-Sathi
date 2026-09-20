/**
 * Signature Verification Repository
 *
 * Data access for the withdrawal-security pipeline:
 *   - member_signature_specimens        — per-account signatory specimens
 *   - signature_verification_logs       — immutable audit trail per comparison
 *   - savings_withdrawal_instruments    — consumed-instrument register (slip/cheque
 *                                         single-use fingerprint, duplicate-presentment)
 *
 * All queries scoped to organization_id.
 */
import { eq, and, desc, type SQL } from 'drizzle-orm';
import { getDb, type DbExecutor } from '../../db/client';
import {
  memberSignatureSpecimens,
  signatureVerificationLogs,
  savingsWithdrawalInstruments,
  memberKycProfiles,
  savingsAccounts,
} from '../../db/schema';

export type WithdrawalInstrumentType = 'cheque' | 'slip' | 'passbook';

export class SignatureVerificationRepository {
  // ─────────────────────────────────────────────
  // Specimens
  // ─────────────────────────────────────────────

  async getActiveSpecimens(organizationId: string, accountId: string, client?: DbExecutor) {
    const db = client ?? getDb();
    if (!db) return [];
    return db.select().from(memberSignatureSpecimens)
      .where(and(
        eq(memberSignatureSpecimens.organizationId, organizationId),
        eq(memberSignatureSpecimens.accountId, accountId),
        eq(memberSignatureSpecimens.isActive, true),
      ))
      .orderBy(desc(memberSignatureSpecimens.capturedAt));
  }

  /** The member's on-file signature (KYC profile signature; legacy members first). */
  async getMemberSignature(organizationId: string, memberId: string, client?: DbExecutor) {
    const db = client ?? getDb();
    if (!db) return null;
    // The canonical member signature lives on member_kyc_profiles.signature_url.
    const [kyc] = await db.select({ signatureUrl: memberKycProfiles.signatureUrl })
      .from(memberKycProfiles)
      .where(and(
        eq(memberKycProfiles.memberId, memberId),
        eq(memberKycProfiles.organizationId, organizationId),
      ))
      .limit(1);
    return kyc?.signatureUrl ?? null;
  }

  async createSpecimen(row: {
    organizationId: string;
    branchId?: string | null;
    memberId: string;
    accountId: string;
    signatoryName?: string | null;
    imageUrl: string;
    signingRule?: string;
    capturedById?: string | null;
    capturedVia?: string;
  }, client?: DbExecutor) {
    const db = client ?? getDb();
    if (!db) throw new Error('Database not connected.');
    const [inserted] = await db.insert(memberSignatureSpecimens).values({
      organizationId: row.organizationId,
      branchId: row.branchId ?? null,
      memberId: row.memberId,
      accountId: row.accountId,
      signatoryName: row.signatoryName ?? null,
      imageUrl: row.imageUrl,
      signingRule: (row.signingRule ?? 'any') as 'any',
      capturedById: row.capturedById ?? null,
      capturedVia: (row.capturedVia ?? 'open_account') as 'open_account',
    }).returning();
    return inserted;
  }

  async deactivateSpecimen(organizationId: string, specimenId: string, client?: DbExecutor) {
    const db = client ?? getDb();
    if (!db) throw new Error('Database not connected.');
    const updated = await db.update(memberSignatureSpecimens)
      .set({ isActive: false })
      .where(and(
        eq(memberSignatureSpecimens.id, specimenId),
        eq(memberSignatureSpecimens.organizationId, organizationId),
      ))
      .returning();
    return updated[0] ?? null;
  }

  // ─────────────────────────────────────────────
  // Verification logs
  // ─────────────────────────────────────────────

  async createVerificationLog(row: {
    organizationId: string;
    branchId?: string | null;
    accountId: string;
    memberId: string;
    specimenId?: string | null;
    presentedImageUrl: string;
    specimenImageUrl: string;
    matchScore: number;
    machineVerdict: string;
    createdById?: string | null;
  }, client?: DbExecutor) {
    const db = client ?? getDb();
    if (!db) throw new Error('Database not connected.');
    const [inserted] = await db.insert(signatureVerificationLogs).values({
      organizationId: row.organizationId,
      branchId: row.branchId ?? null,
      accountId: row.accountId,
      memberId: row.memberId,
      specimenId: row.specimenId ?? null,
      presentedImageUrl: row.presentedImageUrl,
      specimenImageUrl: row.specimenImageUrl,
      matchScore: String(row.matchScore),
      machineVerdict: row.machineVerdict,
      createdById: row.createdById ?? null,
    }).returning();
    return {
      id: inserted.id,
      organizationId: inserted.organizationId,
      branchId: inserted.branchId,
      accountId: inserted.accountId,
      memberId: inserted.memberId,
      specimenId: inserted.specimenId,
      presentedImageUrl: inserted.presentedImageUrl,
      specimenImageUrl: inserted.specimenImageUrl,
      matchScore: Number(inserted.matchScore),
      machineVerdict: inserted.machineVerdict,
      createdAt: inserted.createdAt,
    };
  }

  async getVerificationLog(organizationId: string, logId: string, client?: DbExecutor) {
    const db = client ?? getDb();
    if (!db) return null;
    const [log] = await db.select().from(signatureVerificationLogs)
      .where(and(
        eq(signatureVerificationLogs.id, logId),
        eq(signatureVerificationLogs.organizationId, organizationId),
      ))
      .limit(1);
    if (!log) return null;
    return {
      id: log.id,
      organizationId: log.organizationId,
      branchId: log.branchId,
      accountId: log.accountId,
      memberId: log.memberId,
      specimenId: log.specimenId,
      presentedImageUrl: log.presentedImageUrl,
      specimenImageUrl: log.specimenImageUrl,
      matchScore: Number(log.matchScore),
      machineVerdict: log.machineVerdict,
      outcome: log.outcome,
      withdrawalId: log.withdrawalId,
      voucherNo: log.voucherNo,
      createdAt: log.createdAt,
    };
  }

  /** Link a verification log to the posted withdrawal (atomic with the payment). */
  async finalizeVerificationLog(
    organizationId: string,
    logId: string,
    row: { withdrawalId?: string | null; voucherNo: string; outcome: string; reviewedByUserId?: string | null; overrideReason?: string | null },
    client?: DbExecutor,
  ) {
    const db = client ?? getDb();
    if (!db) throw new Error('Database not connected.');
    const updated = await db.update(signatureVerificationLogs)
      .set({
        withdrawalId: row.withdrawalId,
        voucherNo: row.voucherNo,
        outcome: row.outcome,
        reviewedByUserId: row.reviewedByUserId ?? null,
        overrideReason: row.overrideReason ?? null,
      })
      .where(and(
        eq(signatureVerificationLogs.id, logId),
        eq(signatureVerificationLogs.organizationId, organizationId),
      ))
      .returning({ id: signatureVerificationLogs.id, outcome: signatureVerificationLogs.outcome });
    return updated[0] ?? null;
  }

  /** Recent verification activity for an account. */
  async listVerificationLogs(organizationId: string, accountId: string, limit = 20, client?: DbExecutor) {
    const db = client ?? getDb();
    if (!db) return [];
    return db.select().from(signatureVerificationLogs)
      .where(and(
        eq(signatureVerificationLogs.organizationId, organizationId),
        eq(signatureVerificationLogs.accountId, accountId),
      ))
      .orderBy(desc(signatureVerificationLogs.createdAt))
      .limit(limit);
  }

  // ─────────────────────────────────────────────
  // Withdrawal instruments (consumed register)
  // ─────────────────────────────────────────────

  /** Prior presentment of the same reference (type+reference) across the org. */
  async findPresentedInstrument(organizationId: string, type: WithdrawalInstrumentType, reference: string, client?: DbExecutor) {
    const db = client ?? getDb();
    if (!db) return null;
    const rows = await db.select().from(savingsWithdrawalInstruments)
      .where(and(
        eq(savingsWithdrawalInstruments.organizationId, organizationId),
        eq(savingsWithdrawalInstruments.type, type),
        eq(savingsWithdrawalInstruments.reference, reference),
      ))
      .limit(1);
    return rows[0] ?? null;
  }

  async findPresentedCheque(organizationId: string, reference: string, client?: DbExecutor) {
    const db = client ?? getDb();
    if (!db) return null;
    const rows = await db.select().from(savingsWithdrawalInstruments)
      .where(and(
        eq(savingsWithdrawalInstruments.organizationId, organizationId),
        eq(savingsWithdrawalInstruments.type, 'cheque'),
        eq(savingsWithdrawalInstruments.reference, reference),
      ))
      .orderBy(desc(savingsWithdrawalInstruments.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async recordInstrument(row: {
    organizationId: string;
    branchId?: string | null;
    accountId: string;
    accountNo: string;
    memberId: string;
    memberName: string;
    type: WithdrawalInstrumentType;
    reference: string;
    amount: number;
    dateBs: string;
    voucherNo?: string | null;
    transactionId?: string | null;
    createdById?: string | null;
  }, client?: DbExecutor) {
    const db = client ?? getDb();
    if (!db) throw new Error('Database not connected.');
    const [inserted] = await db.insert(savingsWithdrawalInstruments).values({
      organizationId: row.organizationId,
      branchId: row.branchId ?? null,
      accountId: row.accountId,
      accountNo: row.accountNo,
      memberId: row.memberId,
      memberName: row.memberName,
      type: row.type,
      reference: row.reference,
      amount: String(row.amount),
      dateBs: row.dateBs,
      voucherNo: row.voucherNo ?? null,
      transactionId: row.transactionId ?? null,
      createdById: row.createdById ?? null,
    }).returning().catch((err) => {
      // The unique index on (org, type, reference) is the duplicate-presentment
      // guard — translate into a clean business error.
      if (/duplicate key|unique.+constraint|23505/i.test(String(err?.message ?? err))) {
        throw new Error(`Instrument "${row.reference}" has already been presented for this organization.`);
      }
      throw err;
    });
    return inserted;
  }

  async markInstrumentConsumed(
    organizationId: string,
    type: WithdrawalInstrumentType,
    reference: string,
    row: { voucherNo?: string | null; transactionId: string },
    client?: DbExecutor,
  ) {
    const db = client ?? getDb();
    if (!db) throw new Error('Database not connected.');
    const updated = await db.update(savingsWithdrawalInstruments)
      .set({ voucherNo: row.voucherNo ?? null, transactionId: row.transactionId })
      .where(and(
        eq(savingsWithdrawalInstruments.organizationId, organizationId),
        eq(savingsWithdrawalInstruments.type, type),
        eq(savingsWithdrawalInstruments.reference, reference),
      ))
      .returning();
    return updated[0] ?? null;
  }

  /** Remove a presented-instrument row (used when a queued withdrawal is rejected). */
  async deletePresentedInstrument(organizationId: string, type: WithdrawalInstrumentType, reference: string, client?: DbExecutor) {
    const db = client ?? getDb();
    if (!db) throw new Error('Database not connected.');
    await db.delete(savingsWithdrawalInstruments)
      .where(and(
        eq(savingsWithdrawalInstruments.organizationId, organizationId),
        eq(savingsWithdrawalInstruments.type, type),
        eq(savingsWithdrawalInstruments.reference, reference),
      ));
  }

  /** Drawer account resolution for a cheque leaf (account + member summary). */
  async resolveChequeDrawer(organizationId: string, accountId: string, client?: DbExecutor) {
    const db = client ?? getDb();
    if (!db) return null;
    const [row] = await db.select({
      id: savingsAccounts.id,
      accountNo: savingsAccounts.accountNo,
      memberId: savingsAccounts.memberId,
      memberName: savingsAccounts.memberName,
      balance: savingsAccounts.balance,
      minBalance: savingsAccounts.minBalance,
      status: savingsAccounts.status,
    }).from(savingsAccounts)
      .where(and(eq(savingsAccounts.id, accountId), eq(savingsAccounts.organizationId, organizationId)))
      .limit(1);
    return row ?? null;
  }
}