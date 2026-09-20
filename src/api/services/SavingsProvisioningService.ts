/**
 * Savings Provisioning Service
 *
 * Auto-opens a member's savings account at registration time using the
 * organization's configured default savings product (organization_profiles.
 * default_saving_product_id). The Account Product is the canonical config
 * source: the opening deposit is derived from product.opening_deposit_required
 * + product.min_deposit.
 *
 * Rules (locked requirements):
 *  - Idempotent: one account per (org, member, product) — retries never create
 *    a duplicate account.
 *  - Failure NEVER rolls back or fails the member registration — it is recorded
 *    in savings_provisioning_queue (Pending/Success/Failed) for retry/alerting.
 *  - Reuses SavingsService.openAccount (the same underlying account-opening
 *    service as the manual New Savings Account flow) — no duplicated logic.
 *  - If the default product is missing/inactive, provisioning is skipped.
 */
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { savingsProducts, organizationProfiles, savingsAccounts, savingsTransactions, savingsProvisioningQueue } from '../../db/schema';
import { SavingsService } from './SavingsService';
import { SavingsRepository } from '../repositories/SavingsRepository';
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
  accountId?: string | null;
  voucherNo?: string | null;
  savingsProductId?: string | null;
  openingAmount?: number;
  error?: string | null;
}

/**
 * Pure helper: derive the opening deposit plan for a product.
 * Exposed for unit tests.
 */
export function computeOpeningAmount(product: {
  openingDepositRequired?: boolean;
  minDeposit?: number | string | null;
}): { openingAmount: number } {
  const required = product.openingDepositRequired !== false;
  const minDeposit = Number(product.minDeposit ?? 0);
  const openingAmount = required && minDeposit > 0 ? minDeposit : 0;
  return { openingAmount };
}

type QueueInput = {
  organizationId: string;
  member: ProvisionableMember;
  savingsProductId: string;
  status: 'Pending' | 'Success' | 'Failed';
  errorMessage?: string | null;
  openedAccountId?: string | null;
  openedVoucherNo?: string | null;
};

export class SavingsProvisioningService {
  private service: SavingsService;
  private repository: SavingsRepository;

  constructor() {
    this.service = new SavingsService();
    this.repository = new SavingsRepository();
  }

  private async upsertQueue(db: any, input: QueueInput) {
    const { organizationId, member, savingsProductId, status } = input;
    const [prior] = await db
      .select()
      .from(savingsProvisioningQueue)
      .where(and(
        eq(savingsProvisioningQueue.organizationId, organizationId),
        eq(savingsProvisioningQueue.memberId, member.id),
        eq(savingsProvisioningQueue.savingsProductId, savingsProductId),
      ))
      .limit(1);

    const attempts = (prior?.attempts ?? 0) + 1;
    const resolvedAt = status === 'Success' ? new Date() : null;

    await db.insert(savingsProvisioningQueue)
      .values({
        organizationId,
        memberId: member.id,
        memberNo: member.memberNo,
        savingsProductId,
        status,
        attempts,
        errorMessage: input.errorMessage ?? null,
        openedAccountId: input.openedAccountId ?? null,
        openedVoucherNo: input.openedVoucherNo ?? null,
        resolvedAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          savingsProvisioningQueue.organizationId,
          savingsProvisioningQueue.memberId,
          savingsProvisioningQueue.savingsProductId,
        ],
        set: {
          status,
          attempts,
          errorMessage: input.errorMessage ?? null,
          openedAccountId: input.openedAccountId ?? null,
          openedVoucherNo: input.openedVoucherNo ?? null,
          resolvedAt,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Provision a savings account for a newly registered member.
   * Never throws: every failure path is recorded in the queue instead.
   */
  async provisionForMember(organizationId: string, member: ProvisionableMember): Promise<ProvisionResult> {
    const db = getDb();
    if (!db) return { skipped: true, reason: 'no-db' };

    let productId: string | null = null;

    try {
      // 1. Org default product drives the auto-opening.
      const [profile] = await db
        .select({ defaultSavingProductId: organizationProfiles.defaultSavingProductId })
        .from(organizationProfiles)
        .where(eq(organizationProfiles.organizationId, organizationId))
        .limit(1);
      productId = profile?.defaultSavingProductId ?? null;
      if (!productId) return { skipped: true, reason: 'no-default-product' };

      // 2. Product must exist, belong to the org, and be active.
      const [product] = await db
        .select()
        .from(savingsProducts)
        .where(and(eq(savingsProducts.id, productId), eq(savingsProducts.organizationId, organizationId)))
        .limit(1);
      if (!product) {
        await this.upsertQueue(db, {
          organizationId, member, savingsProductId: productId,
          status: 'Failed', errorMessage: 'Savings Product not found.',
        });
        return { skipped: true, reason: 'product-not-found', savingsProductId: productId };
      }
      if (product.isActive === false) {
        await this.upsertQueue(db, {
          organizationId, member, savingsProductId: productId,
          status: 'Failed', errorMessage: 'Default Savings Product is inactive.',
        });
        return { skipped: true, reason: 'product-inactive', savingsProductId: productId };
      }

      // 3. Idempotency: an account already exists for (org, member, product).
      const [existingAccount] = await db
        .select({ id: savingsAccounts.id })
        .from(savingsAccounts)
        .where(and(
          eq(savingsAccounts.organizationId, organizationId),
          eq(savingsAccounts.memberId, member.id),
          eq(savingsAccounts.savingsProductId, productId),
        ))
        .limit(1);
      if (existingAccount) {
        await this.upsertQueue(db, {
          organizationId, member, savingsProductId: productId,
          status: 'Success', openedAccountId: existingAccount.id,
        });
        return {
          skipped: true, reason: 'already-opened',
          accountId: existingAccount.id, savingsProductId: productId,
        };
      }

      // 4. Idempotency: this (member, product) already provisioned successfully.
      const [prior] = await db
        .select()
        .from(savingsProvisioningQueue)
        .where(and(
          eq(savingsProvisioningQueue.organizationId, organizationId),
          eq(savingsProvisioningQueue.memberId, member.id),
          eq(savingsProvisioningQueue.savingsProductId, productId),
        ))
        .limit(1);
      if (prior && prior.status === 'Success') {
        return {
          skipped: true, reason: 'already-provisioned',
          accountId: prior.openedAccountId ?? null, voucherNo: prior.openedVoucherNo ?? null,
          savingsProductId: productId,
        };
      }

      // 5. Compute opening deposit from the canonical product config.
      const { openingAmount } = computeOpeningAmount(product);
      const todayBs = getTodayBS();
      const todayAd = getTodayADFormatted();

      // 5b. An opening account must belong to a branch (NOT NULL).
      if (!member.branchId) {
        await this.upsertQueue(db, {
          organizationId, member, savingsProductId: productId,
          status: 'Failed', errorMessage: 'No branch resolved for member.',
        });
        return { skipped: true, reason: 'no-branch', savingsProductId: productId };
      }

      // 6. Reuse the same account-opening service as the manual flow.
      const account = await this.service.openAccount({
        organizationId,
        accountNo: '',
        memberId: member.id,
        memberName: member.fullName,
        memberNo: member.memberNo,
        savingsProductId: product.id,
        productType: product.productType,
        productName: product.name,
        interestRate: product.interestRate,
        minBalance: product.minBalance,
        openedDateBs: todayBs,
        lastTransactionDateBs: todayBs,
        branchId: member.branchId ?? null,
        openedVia: 'auto',
        status: 'Active',
        monthlyInstallment: product.productType === 'recurring' ? product.minDeposit : null,
      }, organizationId);

      // 7. Post the opening deposit so the account does not start at zero.
      let voucherNo: string | null = null;
      if (openingAmount > 0) {
        voucherNo = `OPN-${Date.now().toString().slice(-6)}`;
        const [txn] = await db.insert(savingsTransactions).values({
          organizationId,
          accountId: account.id,
          accountNo: account.accountNo,
          memberId: member.id,
          memberName: member.fullName,
          type: 'Deposit',
          amount: String(openingAmount),
          balanceAfter: String(openingAmount),
          voucherNo,
          dateBs: todayBs,
          dateAd: todayAd,
          tellerName: 'System',
          remarks: 'Auto-opening deposit — Member Registration',
          paymentMode: 'Cash',
          branchId: member.branchId ?? null,
        }).returning();
        if (!txn) throw new Error('Failed to record opening deposit');
        await db.update(savingsAccounts)
          .set({ balance: String(openingAmount), updatedAt: new Date() })
          .where(eq(savingsAccounts.id, account.id));
      }

      await this.upsertQueue(db, {
        organizationId, member, savingsProductId: productId,
        status: 'Success', openedAccountId: account.id, openedVoucherNo: voucherNo,
      });

      return {
        opened: true,
        accountId: account.id,
        voucherNo,
        savingsProductId: productId,
        openingAmount,
      };
    } catch (error: any) {
      // Never propagate — member registration must not fail/roll back.
      await this.upsertQueue(db, {
        organizationId, member, savingsProductId: productId ?? '',
        status: 'Failed', errorMessage: error?.message ?? 'Unknown provisioning error',
      }).catch(() => {});
      return { skipped: true, reason: 'error', error: error?.message ?? 'Unknown provisioning error', savingsProductId: productId };
    }
  }
}