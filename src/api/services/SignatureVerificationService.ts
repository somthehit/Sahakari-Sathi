/**
 * Signature Verification Service
 *
 * Orchestrates the withdrawal-security pipeline:
 *   - specimen capture (Open Account / teller / admin)
 *   - live signature comparison (pluggable matcher) with full audit logging
 *   - disposition submission (auto-approved / teller override / supervisor
 *     override / rejected) recorded against the posted withdrawal
 *   - passbook reconciliation gate for passbook-mode withdrawals
 */
import { SignatureVerificationRepository } from '../repositories/SignatureVerificationRepository';
import { SavingsRepository } from '../repositories/SavingsRepository';
import { MemberRepository } from '../repositories/MemberRepository';
import { signatureMatchService, type MatchVerdict } from './signature/SignatureMatchService';
import { StorageService } from './StorageService';
import { buildAuditRow, writeAuditLog, SettingsActor } from '../utils/audit';
import { DateConverter } from '../../utils/nepaliCalendar';

export const SIGNATURE_VERDICTS: MatchVerdict[] = ['auto_approved', 'teller_review', 'blocked'];
export const SIGNATURE_OUTCOMES = ['auto_approved', 'teller_override', 'supervisor_override', 'rejected'] as const;
export type SignatureOutcome = (typeof SIGNATURE_OUTCOMES)[number];

export const HIGH_AUTOAPPROVE = 90;
export const LOW_OVERRIDE = 70;

export interface SignatureVerifyFlowInput {
  accountId: string;
  memberId: string;
  presentedImageUrl: string;
  specimenId?: string | null;
  providerId?: string;
}

export class SignatureVerificationService {
  private verificationRepository = new SignatureVerificationRepository();
  private memberRepository = new MemberRepository();
  private savingsRepository = new SavingsRepository();

  // ─────────────────────────────────────────────
  // Specimens
  // ─────────────────────────────────────────────

  /** Active specimens for an account, with the drawer/member fallback signature. */
  async listSpecimens(accountId: string, organizationId: string, branchIds?: string[]) {
    const account = await this.savingsRepository.findById(accountId, organizationId, branchIds);
    if (!account) throw new Error('Savings account not found.');

    const specimens = await this.verificationRepository.getActiveSpecimens(organizationId, accountId);
    let fallbackSignature: string | null = null;
    if (specimens.length === 0) {
      fallbackSignature = await this.verificationRepository.getMemberSignature(organizationId, account.memberId);
    }
    return {
      accountId,
      accountNo: account.accountNo,
      memberName: account.memberName,
      specimens: specimens.map((s) => ({
        id: s.id,
        memberId: s.memberId,
        signatoryName: s.signatoryName,
        imageUrl: s.imageUrl,
        signingRule: s.signingRule,
        capturedVia: s.capturedVia,
        capturedAt: s.capturedAt,
      })),
      fallbackSignature,
    };
  }

  /** Capture a specimen for a signatory of a savings account. */
  async captureSpecimen(
    accountId: string,
    input: {
      memberId: string;
      imageUrl: string;
      signatoryName?: string | null;
      signingRule?: 'any' | 'all' | 'specific';
      capturedVia?: string;
    },
    organizationId: string,
    branchId: string,
    actor: SettingsActor,
  ) {
    if (!input.memberId) throw new Error('Member is required.');
    if (!input.imageUrl) throw new Error('Signature image is required.');

    const account = await this.savingsRepository.findById(accountId, organizationId);
    if (!account) throw new Error('Savings account not found.');
    if (account.memberId !== input.memberId) {
      // Only the account holder may be the signatory.
      throw new Error('Specimen member does not match the account holder.');
    }

    const member = await this.memberRepository.findById(input.memberId, organizationId);
    if (!member) throw new Error('Member not found.');

    // Resolve imageUrl: data URLs are upload-stored to the member-documents
    // bucket; storage paths / http(s) values are stored as-is.
    let imageUrl = input.imageUrl;
    if (input.imageUrl.startsWith('data:')) {
      const storage = new StorageService();
      const uploaded = await storage.uploadMedia('signature', input.imageUrl, {
        organizationId,
        memberId: input.memberId,
      });
      imageUrl = uploaded.storagePath;
    }

    const specimen = await this.verificationRepository.createSpecimen({
      organizationId,
      branchId,
      memberId: input.memberId,
      accountId,
      signatoryName: input.signatoryName ?? member.fullName,
      imageUrl,
      signingRule: input.signingRule ?? 'any',
      capturedById: actor.userId ?? null,
      capturedVia: input.capturedVia ?? 'teller',
    });

    await writeAuditLog(buildAuditRow(
      actor, 'Savings & Deposits', 'Signature Specimen Captured',
      `Captured signature specimen for ${input.signatoryName || member.fullName} on savings account ${account.accountNo}`,
    ));

    return { id: specimen.id, accountId, memberId: input.memberId, signatoryName: specimen.signatoryName, imageUrl: specimen.imageUrl, signingRule: specimen.signingRule };
  }

  // ─────────────────────────────────────────────
  // Verification + logging
  // ─────────────────────────────────────────────

  /**
   * Run a live signature comparison and persist the full audit log.
   * Resolves the specimen image in priority order:
   *   1. the account's active specimens (the given specimenId or all specimens)
   *   2. the member's on-file signature (members / KYC)
   */
  async verifyAndLog(input: SignatureVerifyFlowInput, organizationId: string, branchId: string, actor: SettingsActor) {
    if (!input.accountId) throw new Error('Account is required.');
    if (!input.memberId) throw new Error('Member is required.');
    if (!input.presentedImageUrl) throw new Error('Presented signature image is required.');

    let specimens = await this.verificationRepository.getActiveSpecimens(organizationId, input.accountId);
    if (input.specimenId) {
      const selected = specimens.find((s) => s.id === input.specimenId);
      if (!selected) {
        const all = await this.verificationRepository.getActiveSpecimens(organizationId, input.accountId);
        const check = all.find((s) => s.id === input.specimenId);
        if (check) specimens = [check];
        else throw new Error('Specimen not found for this account.');
      } else {
        specimens = [selected];
      }
    }

    let specimenImageUrl: string | null = specimens[0]?.imageUrl ?? null;
    let specimenId: string | null = specimens[0]?.id ?? null;
    if (!specimenImageUrl) {
      specimenImageUrl = await this.verificationRepository.getMemberSignature(organizationId, input.memberId);
    }
    if (!specimenImageUrl) {
      throw new Error('No signature specimen on file for this account. Capture one at account opening or in the teller screen first.');
    }

    const match = await signatureMatchService.verify(
      {
        accountId: input.accountId,
        memberId: input.memberId,
        presentedImageUrl: input.presentedImageUrl,
        specimenImageUrl,
        specimenId,
        providerId: input.providerId,
      },
      organizationId,
    );

    const log = await this.verificationRepository.createVerificationLog({
      organizationId,
      branchId,
      accountId: input.accountId,
      memberId: input.memberId,
      specimenId,
      presentedImageUrl: input.presentedImageUrl,
      specimenImageUrl,
      matchScore: match.score,
      machineVerdict: match.verdict,
      createdById: actor.userId ?? null,
    });

    return {
      logId: log.id,
      score: log.matchScore,
      verdict: log.machineVerdict as MatchVerdict,
      providerId: match.providerId,
      provider: match.provider,
      notes: match.notes ?? null,
      lowConfidence: match.lowConfidence ?? false,
      specimenId: log.specimenId,
      specimenImageUrl: log.specimenImageUrl,
      presentedImageUrl: log.presentedImageUrl,
      // Bands: >= 90 auto-approved · 70–89 teller review · < 70 hard blocked.
      band: log.matchScore >= HIGH_AUTOAPPROVE ? 'auto_approved' : log.matchScore >= LOW_OVERRIDE ? 'teller_review' : 'blocked',
    };
  }

  /**
   * Client-side disposition for an override decision, validated server-side
   * against the recorded machine score. Returns the outcome to store.
   */
  validateDisposition(logId: string, organizationId: string, disposition: { outcome?: SignatureOutcome; overrideReason?: string }, role?: string) {
    // Checked by the caller (recordWithdrawal / controller) against a fetched
    // log row — this helper bounds the role-based supervisor band.
    const BANDS: Record<string, { min: number; outcome: SignatureOutcome; needsRole: boolean }> = {
      auto_approved: { min: HIGH_AUTOAPPROVE, outcome: 'auto_approved', needsRole: false },
      teller_review: { min: LOW_OVERRIDE, outcome: 'teller_override', needsRole: false },
      blocked: { min: 0, outcome: 'supervisor_override', needsRole: true },
    };
    const key = disposition.outcome === 'auto_approved' ? 'auto_approved' : disposition.outcome === 'supervisor_override' ? 'blocked' : 'teller_review';
    return { band: BANDS[key], logId, organizationId };
  }

  /** Apply the final disposition to a verification log once the withdrawal posts. */
  async applyOutcome(
    logId: string,
    organizationId: string,
    row: { withdrawalId: string; voucherNo: string; outcome: SignatureOutcome; overrideReason?: string | null; reviewedByUserId?: string | null },
  ) {
    return this.verificationRepository.finalizeVerificationLog(organizationId, logId, {
      withdrawalId: row.withdrawalId,
      voucherNo: row.voucherNo,
      outcome: row.outcome,
      overrideReason: row.overrideReason ?? null,
      reviewedByUserId: row.reviewedByUserId ?? null,
    });
  }

  // ─────────────────────────────────────────────
  // Passbook reconciliation gate
  // ─────────────────────────────────────────────

  /**
   * Passbook-mode gate: the teller enters the passbook's printed last line and
   * serial; the system verifies the book isn't ahead of the account's last-print
   * marker and that the serial matches. A mismatch flags the passbook for the
   * supervisor review (tamper check) without blocking the payout outright.
   */
  async reconcilePassbook(
    accountId: string,
    organizationId: string,
    branchIds: string[] | undefined,
    input: { bookSerial?: string; bookLastLine?: number; lastPrintedLineFromBook?: number },
  ) {
    const account = await this.savingsRepository.findById(accountId, organizationId, branchIds);
    if (!account) throw new Error('Savings account not found.');

    const systemSerial = account.passbookSerial ?? account.accountNo;
    const systemLastLine = Number(account.lastPrintedLine) || 0;
    const bookSerial = input.bookSerial ?? systemSerial;
    const bookLastLine = Number(input.bookLastLine ?? input.lastPrintedLineFromBook ?? 0);

    const serialMismatch = bookSerial?.trim() && bookSerial.trim().toUpperCase() !== String(systemSerial).toUpperCase();
    // The physical passbook must never be ahead of the system's printed marker.
    const aheadOfSystem = bookLastLine > systemLastLine;
    const ok = !serialMismatch && !aheadOfSystem;

    return {
      ok,
      mismatch: !ok,
      systemLastLine,
      bookLastLine,
      serialMismatch: Boolean(serialMismatch),
      aheadOfSystem,
      passbookSerial: String(systemSerial),
      // A tamper path routes the withdrawal into the dual-approval queue.
      needsSupervisorReview: !ok,
      message: !ok
        ? serialMismatch
          ? `Passbook serial mismatch: book shows ${bookSerial}, system has ${systemSerial}.`
          : `Passbook line ${bookLastLine} is ahead of the system's last printed line ${systemLastLine}.`
        : 'Passbook reconciled.',
    };
  }

  /** Recent verification log activity for an account. */
  async listVerificationActivity(accountId: string, organizationId: string, branchIds?: string[], limit = 20) {
    const account = await this.savingsRepository.findById(accountId, organizationId, branchIds);
    if (!account) throw new Error('Savings account not found.');
    const logs = await this.verificationRepository.listVerificationLogs(organizationId, accountId, limit);
    return logs.map((l) => ({
      id: l.id,
      accountId: l.accountId,
      memberId: l.memberId,
      specimenId: l.specimenId,
      presentedImageUrl: l.presentedImageUrl,
      specimenImageUrl: l.specimenImageUrl,
      matchScore: Number(l.matchScore),
      machineVerdict: l.machineVerdict,
      outcome: l.outcome,
      withdrawalId: l.withdrawalId,
      voucherNo: l.voucherNo,
      createdAt: l.createdAt,
    }));
  }

  /** BS date ordering helper for cheque date-validity checks. */
  compareBsDates(a: string, b: string): number {
    const toAd = (s: string): string | null => DateConverter.bsToAd(s);
    const adA = toAd(a);
    const adB = toAd(b);
    if (adA && adB) return adA < adB ? -1 : adA > adB ? 1 : 0;
    return a < b ? -1 : a > b ? 1 : 0;
  }

  /** Cheque instrument date-validity: post-dated → hold; stale → block. */
  chequeDateValidity(chequeDateBs: string | null | undefined, todayBs: string) {
    if (!chequeDateBs) return { ok: true, status: 'no_date' as const };
    const cmp = this.compareBsDates(chequeDateBs, todayBs);
    if (cmp > 0) {
      return { ok: false, status: 'post_dated' as const, message: `Post-dated cheque: dated ${chequeDateBs}, cannot be presented until then.` };
    }
    const todayAd = DateConverter.bsToAd(todayBs);
    const dateAd = DateConverter.bsToAd(chequeDateBs);
    const STALE_WINDOW_DAYS = 180;
    if (todayAd && dateAd) {
      const gap = (new Date(todayAd).getTime() - new Date(dateAd).getTime()) / 86400000;
      if (gap > STALE_WINDOW_DAYS) {
        return { ok: false, status: 'stale' as const, message: `Stale cheque: dated ${chequeDateBs} (older than ${STALE_WINDOW_DAYS} days). Request teller override or refuse payment.` };
      }
    }
    return { ok: true, status: 'valid' as const };
  }

  /** Seed a signature specimen at account opening (openAccount integration). */
  async seedSpecimenAtOpen(input: { accountId: string; memberId: string; imageUrl: string; signatoryName?: string | null; signingRule?: string; }, organizationId: string, branchId: string, actor: SettingsActor) {
    if (!input.imageUrl) return { id: null, skipped: true };
    const specimen = await this.verificationRepository.createSpecimen({
      organizationId,
      branchId,
      memberId: input.memberId,
      accountId: input.accountId,
      signatoryName: input.signatoryName ?? null,
      imageUrl: input.imageUrl,
      signingRule: (input.signingRule ?? 'any') as 'any',
      capturedById: actor.userId ?? null,
      capturedVia: 'open_account',
    });
    return { id: specimen.id, skipped: false };
  }
}