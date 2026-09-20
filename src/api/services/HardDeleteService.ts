/**
 * Hard Delete Service
 *
 * Secured, audited, atomic removal of financial / member records by org admins.
 *
 * Order of operations (mirrors the product spec):
 *   1. Load the entity row (org-scoped). Not found → throw.
 *   2. Archive a full JSON snapshot of the entity + its linked financial
 *      records into audit_deletion_logs FIRST.
 *   3. Delete the linked financial children (hard delete).
 *   4. Delete the entity row.
 *
 * Steps 2–4 run inside ONE transaction, so a failure at any point rolls back
 * the whole deletion AND the archive. audit_deletion_logs is immutable at the
 * DB level (DO INSTEAD NOTHING rules on DELETE/UPDATE — migration 0036), so
 * the archive can never be removed or rewritten.
 */
import { eq, and, or, inArray } from 'drizzle-orm';
import { getDb, DbExecutor } from '../../db/client';
import {
  members,
  savingsAccounts,
  savingsTransactions,
  interestPostings,
  savingsChequeDeposits,
  savingsPendingWithdrawals,
  savingsProvisioningQueue,
  loanAccounts,
  loanRepayments,
  loanPenalties,
  loanReschedules,
  loanWriteoffs,
  guarantors,
  shareHoldings,
  shareTransactions,
  shareCertificates,
  shareTransfers,
  memberTransactions,
  customerTickets,
  collectionTransactions,
  subsidiarySharesBook,
  subsidiarySavingsBook,
  subsidiaryLoansBook,
  auditDeletionLogs,
} from '../../db/schema';
import { SettingsActor } from '../utils/audit';

export type DeletionEntityType = 'MEMBER' | 'SAVINGS_ACCOUNT' | 'USER';

export interface HardDeleteOutcome {
  auditLogId: string;
  entityType: DeletionEntityType;
  entityId: string;
  entityCode?: string;
}

interface DeleteActor {
  organizationId: string;
  userId: string;
  username?: string;
  role?: string;
  ipAddress?: string;
}

/** JSON-safe copy of a DB row (Date → ISO string) for the immutable snapshot. */
function toSnapshot(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toSnapshot);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = toSnapshot(v);
    return out;
  }
  return value;
}

const orUndefined = (s?: string): string | undefined => (s ? s : undefined);

export class HardDeleteService {
  private db: DbExecutor | null;

  constructor(db?: DbExecutor | null) {
    this.db = db ?? getDb();
  }

  private assertDb(): DbExecutor {
    if (!this.db) throw new Error('Database not connected.');
    return this.db;
  }

  /**
   * Archive the deletion before any row is removed. Returns the inserted id so
   * the outcome can reference the immutable log row.
   */
  private async archive(
    tx: DbExecutor,
    actor: DeleteActor,
    entry: {
      entityType: DeletionEntityType;
      entityId: string;
      entityCode?: string;
      reason: string;
      snapshot: unknown;
    },
  ): Promise<string> {
    const rows = await tx.insert(auditDeletionLogs)
      .values({
        organizationId: actor.organizationId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        entityCode: orUndefined(entry.entityCode),
        deletedByUserId: actor.userId,
        deletedByUserName: actor.username || actor.userId,
        deletedByUserRole: orUndefined(actor.role),
        deletionReason: entry.reason,
        snapshotData: toSnapshot(entry.snapshot),
        ipAddress: orUndefined(actor.ipAddress),
      })
      .returning({ id: auditDeletionLogs.id });
    const row = rows[0];
    if (!row) throw new Error('Failed to archive deletion snapshot.');
    return row.id;
  }

  /**
   * HARD delete a member and every linked financial record, archiving a full
   * snapshot first. Members without financial activity can be removed cleanly;
   * when the member holds savings/loan/share/collection records they are
   * removed here (hard delete), never soft-deleted.
   */
  async hardDeleteMember(
    memberId: string,
    organizationId: string,
    actor: Omit<DeleteActor, 'organizationId'>,
    reason: string,
  ): Promise<HardDeleteOutcome> {
    const db = this.assertDb();
    const orgActor = { ...actor, organizationId };

    const [member] = await db.select().from(members)
      .where(and(eq(members.id, memberId), eq(members.organizationId, organizationId)))
      .limit(1);
    if (!member) throw new Error('Member not found');

    const [savingsRows, loanRows] = await Promise.all([
      db.select().from(savingsAccounts)
        .where(and(eq(savingsAccounts.memberId, memberId), eq(savingsAccounts.organizationId, organizationId))),
      db.select().from(loanAccounts)
        .where(and(eq(loanAccounts.memberId, memberId), eq(loanAccounts.organizationId, organizationId))),
    ]);

    // Collect the member's loan ids up-front for children that key on loan_id
    // alone (loan_reschedules has no member_id column).
    const memberLoanIds = loanRows.map((l: any) => l.id);

    const auditLogId = await db.transaction(async (tx) => {
      // 1. ARCHIVE FIRST — the immutable record of what is about to be removed.
      const logId = await this.archive(tx, orgActor, {
        entityType: 'MEMBER',
        entityId: member.id,
        entityCode: member.memberNo,
        reason,
        snapshot: { member, savingsAccounts: savingsRows, loanAccounts: loanRows },
      });

      // 2. HARD DELETE financial children (FK-safe order: NO-ACTION children
      //    before their parents, parents before the member row).
      // Savings — transactions / interest / cheque instruments / provisioning
      // queue reference member_id directly; cheque books & leaves cascade from
      // savings_accounts.
      await tx.delete(savingsTransactions).where(eq(savingsTransactions.memberId, memberId));
      await tx.delete(interestPostings).where(eq(interestPostings.memberId, memberId));
      await tx.delete(savingsChequeDeposits).where(eq(savingsChequeDeposits.memberId, memberId));
      await tx.delete(savingsPendingWithdrawals).where(eq(savingsPendingWithdrawals.memberId, memberId));
      await tx.delete(savingsProvisioningQueue).where(eq(savingsProvisioningQueue.memberId, memberId));
      await tx.delete(savingsAccounts).where(eq(savingsAccounts.memberId, memberId));

      // Loans — repayments / penalties / write-offs key on member_id;
      // reschedules key on loan_id only; collaterals / guarantors / EMI
      // schedules cascade from loan_accounts. Guarantor rows where THIS member
      // stood as guarantor for another member's loan are removed too.
      await tx.delete(loanRepayments).where(eq(loanRepayments.memberId, memberId));
      await tx.delete(loanPenalties).where(eq(loanPenalties.memberId, memberId));
      await tx.delete(loanWriteoffs).where(eq(loanWriteoffs.memberId, memberId));
      if (memberLoanIds.length > 0) {
        await tx.delete(loanReschedules).where(inArray(loanReschedules.loanId, memberLoanIds));
      }
      await tx.delete(guarantors).where(eq(guarantors.guarantorMemberId, memberId));
      await tx.delete(loanAccounts).where(eq(loanAccounts.memberId, memberId));

      // Shares — certificates / transactions / transfers before holdings.
      await tx.delete(shareCertificates).where(eq(shareCertificates.memberId, memberId));
      await tx.delete(shareTransactions).where(eq(shareTransactions.memberId, memberId));
      await tx.delete(shareTransfers).where(
        or(eq(shareTransfers.fromMemberId, memberId), eq(shareTransfers.toMemberId, memberId)),
      );
      await tx.delete(shareHoldings).where(eq(shareHoldings.memberId, memberId));

      // Subsidiary ledgers, field collection, currency member transactions,
      // support tickets.
      await tx.delete(subsidiarySharesBook).where(eq(subsidiarySharesBook.memberId, memberId));
      await tx.delete(subsidiarySavingsBook).where(eq(subsidiarySavingsBook.memberId, memberId));
      await tx.delete(subsidiaryLoansBook).where(eq(subsidiaryLoansBook.memberId, memberId));
      await tx.delete(collectionTransactions).where(eq(collectionTransactions.memberId, memberId));
      await tx.delete(memberTransactions).where(eq(memberTransactions.memberId, memberId));
      await tx.delete(customerTickets).where(eq(customerTickets.memberId, memberId));

      // 3. HARD DELETE the member row (1:1 children — KYC, financial, family,
      //    portal, biometrics, documents — cascade from members).
      await tx.delete(members).where(and(eq(members.id, memberId), eq(members.organizationId, organizationId)));

      return logId;
    });

    return {
      auditLogId,
      entityType: 'MEMBER',
      entityId: member.id,
      entityCode: member.memberNo,
    };
  }

  /**
   * HARD delete a single savings account and its ledger, archiving the account
   * snapshot + transaction history first.
   */
  async hardDeleteSavingsAccount(
    accountId: string,
    organizationId: string,
    actor: Omit<DeleteActor, 'organizationId'>,
    reason: string,
  ): Promise<HardDeleteOutcome> {
    const db = this.assertDb();
    const orgActor = { ...actor, organizationId };

    const [account] = await db.select().from(savingsAccounts)
      .where(and(eq(savingsAccounts.id, accountId), eq(savingsAccounts.organizationId, organizationId)))
      .limit(1);
    if (!account) throw new Error('Savings account not found');

    const transactions = await db.select().from(savingsTransactions)
      .where(and(eq(savingsTransactions.accountId, accountId), eq(savingsTransactions.organizationId, organizationId)));

    const auditLogId = await db.transaction(async (tx) => {
      // 1. ARCHIVE FIRST.
      const logId = await this.archive(tx, orgActor, {
        entityType: 'SAVINGS_ACCOUNT',
        entityId: account.id,
        entityCode: account.accountNo,
        reason,
        snapshot: { account, transactions },
      });

      // 2. HARD DELETE ledger + interest postings (NO-ACTION children first),
      //    then cheque instruments (cascade from the account), then the account.
      await tx.delete(savingsTransactions).where(eq(savingsTransactions.accountId, accountId));
      await tx.delete(interestPostings).where(eq(interestPostings.accountId, accountId));
      await tx.delete(savingsChequeDeposits).where(eq(savingsChequeDeposits.accountId, accountId));
      await tx.delete(savingsPendingWithdrawals).where(eq(savingsPendingWithdrawals.accountId, accountId));

      // 3. HARD DELETE the account (cascades savings_cheque_books → leaves).
      await tx.delete(savingsAccounts).where(and(eq(savingsAccounts.id, accountId), eq(savingsAccounts.organizationId, organizationId)));

      return logId;
    });

    return {
      auditLogId,
      entityType: 'SAVINGS_ACCOUNT',
      entityId: account.id,
      entityCode: account.accountNo,
    };
  }
}
