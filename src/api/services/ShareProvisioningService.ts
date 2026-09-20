/**
 * Share Provisioning Service
 *
 * Auto-opens a member's share account (holding) at registration time using the
 * organization's configured default share scheme (organization_profiles.
 * default_share_scheme_id). The scheme is the canonical pricing/opening source:
 *   shares  = scheme.min_open_units
 *   amount  = scheme.min_opening_amount (>0) or min_open_units × share_value_per_unit
 *
 * Rules (locked requirements):
 *  - Idempotent: one holding + one ledger entry per (org, member, scheme).
 *  - Failure NEVER rolls back or fails the member registration — it is recorded
 *    in share_provisioning_queue (Pending/Success/Failed) for retry/alerting.
 */
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { shareSchemes, organizationProfiles, shareHoldings, shareProvisioningQueue } from '../../db/schema';
import { ShareRepository } from '../repositories/ShareRepository';
import { getTodayBS, getTodayADFormatted } from '../../utils/nepaliCalendar';

export interface ProvisionableMember {
  id: string;
  memberNo: string;
  fullName: string;
  branchId?: string | null;
}

export interface ProvisionResult {
  opened?: boolean;
  skipped?: boolean;
  reason?: string;
  holdingId?: string | null;
  voucherNo?: string | null;
  shareSchemeId?: string | null;
  shareTypeId?: string | null;
  shares?: number;
  amount?: number;
  error?: string | null;
}

/**
 * Pure helper: derive the opening deposit plan for a scheme.
 * Exposed for unit tests.
 */
export function computeOpeningAmount(scheme: {
  minOpenUnits?: number | string | null;
  shareValuePerUnit?: number | string | null;
  minOpeningAmount?: number | string | null;
}): { shares: number; amount: number; computedAmount: number } {
  const shares = Math.max(1, Math.trunc(Number(scheme.minOpenUnits ?? 1) || 1));
  const computedAmount = shares * Number(scheme.shareValuePerUnit ?? 0);
  const minOpeningAmount = Number(scheme.minOpeningAmount ?? 0);
  const amount = minOpeningAmount > 0 ? minOpeningAmount : computedAmount;
  return { shares, amount, computedAmount };
}

type QueueInput = {
  organizationId: string;
  member: ProvisionableMember;
  shareSchemeId: string;
  shareTypeId: string | null;
  status: 'Pending' | 'Success' | 'Failed';
  errorMessage?: string | null;
  openedHoldingId?: string | null;
  openedVoucherNo?: string | null;
};

export class ShareProvisioningService {
  private repository: ShareRepository;

  constructor() {
    this.repository = new ShareRepository();
  }

  private async upsertQueue(db: any, input: QueueInput) {
    const { organizationId, member, shareSchemeId, shareTypeId, status } = input;
    const [prior] = await db
      .select()
      .from(shareProvisioningQueue)
      .where(and(
        eq(shareProvisioningQueue.organizationId, organizationId),
        eq(shareProvisioningQueue.memberId, member.id),
        eq(shareProvisioningQueue.shareSchemeId, shareSchemeId),
      ))
      .limit(1);

    const attempts = (prior?.attempts ?? 0) + 1;
    const resolvedAt = status === 'Success' ? new Date() : null;

    await db.insert(shareProvisioningQueue)
      .values({
        organizationId,
        memberId: member.id,
        memberNo: member.memberNo,
        shareSchemeId,
        shareTypeId: shareTypeId ?? null,
        status,
        attempts,
        errorMessage: input.errorMessage ?? null,
        openedHoldingId: input.openedHoldingId ?? null,
        openedVoucherNo: input.openedVoucherNo ?? null,
        resolvedAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          shareProvisioningQueue.organizationId,
          shareProvisioningQueue.memberId,
          shareProvisioningQueue.shareSchemeId,
        ],
        set: {
          status,
          attempts,
          errorMessage: input.errorMessage ?? null,
          openedHoldingId: input.openedHoldingId ?? null,
          openedVoucherNo: input.openedVoucherNo ?? null,
          resolvedAt,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Provision a share account for a newly registered member.
   * Never throws: every failure path is recorded in the queue instead.
   */
  async provisionForMember(organizationId: string, member: ProvisionableMember): Promise<ProvisionResult> {
    const db = getDb();
    if (!db) return { skipped: true, reason: 'no-db' };

    let schemeId: string | null = null;
    let shareTypeId: string | null = null;

    try {
      // 1. Org default scheme drives the auto-opening.
      const [profile] = await db
        .select({ defaultShareSchemeId: organizationProfiles.defaultShareSchemeId })
        .from(organizationProfiles)
        .where(eq(organizationProfiles.organizationId, organizationId))
        .limit(1);
      schemeId = profile?.defaultShareSchemeId ?? null;
      if (!schemeId) return { skipped: true, reason: 'no-default-scheme' };

      // 2. Scheme must exist, belong to the org, and be active.
      const [scheme] = await db
        .select()
        .from(shareSchemes)
        .where(and(eq(shareSchemes.id, schemeId), eq(shareSchemes.organizationId, organizationId)))
        .limit(1);
      if (!scheme) {
        await this.upsertQueue(db, {
          organizationId, member, shareSchemeId: schemeId, shareTypeId: null,
          status: 'Failed', errorMessage: 'Share Scheme not found.',
        });
        return { skipped: true, reason: 'scheme-not-found', shareSchemeId: schemeId };
      }
      shareTypeId = scheme.shareTypeId ?? null;
      if (scheme.isActive === false) {
        await this.upsertQueue(db, {
          organizationId, member, shareSchemeId: schemeId, shareTypeId,
          status: 'Failed', errorMessage: 'Selected Share Scheme is inactive.',
        });
        return { skipped: true, reason: 'scheme-inactive', shareSchemeId: schemeId, shareTypeId };
      }
      if (!scheme.shareTypeId) {
        await this.upsertQueue(db, {
          organizationId, member, shareSchemeId: schemeId, shareTypeId: null,
          status: 'Failed', errorMessage: 'Share Scheme has no linked share type.',
        });
        return { skipped: true, reason: 'scheme-no-share-type', shareSchemeId: schemeId };
      }

      // 3. Idempotency: an active holding already opened for (org, member, type).
      const existingHolding = await this.repository.findActiveHoldingForMember(organizationId, member.id, scheme.shareTypeId);
      if (existingHolding) {
        await this.upsertQueue(db, {
          organizationId, member, shareSchemeId: schemeId, shareTypeId: scheme.shareTypeId,
          status: 'Success', openedHoldingId: existingHolding.id,
        });
        return {
          skipped: true, reason: 'already-opened',
          holdingId: existingHolding.id, shareSchemeId: schemeId, shareTypeId: scheme.shareTypeId,
        };
      }

      // 4. Idempotency: this (member, scheme) already provisioned successfully.
      const [prior] = await db
        .select()
        .from(shareProvisioningQueue)
        .where(and(
          eq(shareProvisioningQueue.organizationId, organizationId),
          eq(shareProvisioningQueue.memberId, member.id),
          eq(shareProvisioningQueue.shareSchemeId, schemeId),
        ))
        .limit(1);
      if (prior && prior.status === 'Success') {
        return {
          skipped: true, reason: 'already-provisioned',
          holdingId: prior.openedHoldingId ?? null, voucherNo: prior.openedVoucherNo ?? null,
          shareSchemeId: schemeId, shareTypeId: scheme.shareTypeId,
        };
      }

      // 5. Compute opening deposit from the canonical scheme config.
      const { shares, amount } = computeOpeningAmount(scheme);
      const faceValue = Number(scheme.shareValuePerUnit ?? 0);
      const dateBs = getTodayBS();
      const dateAd = getTodayADFormatted();
      const voucherNo = await this.repository.getNextJournalVoucherNo(organizationId);
      const certificateNo = await this.repository.getNextCertificateNo(organizationId);

      // 6. Existing double-entry posting (Dr Cash/Bank, Cr Share Capital) with
      //    the required auto-opening narration + scheme provenance.
      const result = await this.repository.executeIssueReturn(organizationId, {
        transactionType: 'ISSUE',
        memberId: member.id,
        memberName: member.fullName,
        memberNo: member.memberNo,
        memberBranchId: member.branchId ?? null,
        shareTypeId: scheme.shareTypeId,
        shareTypeName: scheme.name,
        faceValue,
        shares,
        totalAmount: amount,
        voucherNo,
        certificateNo,
        dateBs,
        dateAd,
        remarks: 'Auto-opening deposit — Member Registration',
        processedBy: 'system',
        branchId: member.branchId ?? null,
        schemeId,
        openedVia: 'auto',
        narration: 'Auto-opening deposit — Member Registration',
      });

      await this.upsertQueue(db, {
        organizationId, member, shareSchemeId: schemeId, shareTypeId: scheme.shareTypeId,
        status: 'Success', openedHoldingId: result.holdingId, openedVoucherNo: result.voucherNo,
      });

      return {
        opened: true,
        holdingId: result.holdingId,
        voucherNo: result.voucherNo,
        shareSchemeId: schemeId,
        shareTypeId: scheme.shareTypeId,
        shares,
        amount,
      };
    } catch (error: any) {
      // Never propagate — member registration must not fail/roll back.
      await this.upsertQueue(db, {
        organizationId, member, shareSchemeId: schemeId ?? '', shareTypeId,
        status: 'Failed', errorMessage: error?.message ?? 'Unknown provisioning error',
      }).catch(() => {});
      return { skipped: true, reason: 'error', error: error?.message ?? 'Unknown provisioning error', shareSchemeId: schemeId };
    }
  }
}
