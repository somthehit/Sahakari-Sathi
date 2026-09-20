/**
 * HardDeleteService regression tests.
 *
 * Guards the secure hard-delete contract:
 *   1. An immutable archive row is written to audit_deletion_logs BEFORE any
 *      deletion, inside the same transaction (archive-then-delete ordering).
 *   2. The snapshot captures the entity + linked financial records.
 *   3. Linked financial children are hard-deleted before the parent row.
 *   4. Unknown entities are rejected WITHOUT writing an archive row.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeFakeDb } from '../test/fakeDb';
import { HardDeleteService } from './HardDeleteService';

const holder: { db: any } = { db: null };

const ORG = '11111111-1111-1111-1111-111111111111';
const MEMBER = '33333333-3333-3333-3333-333333333333';
const OTHER_MEMBER = '99999999-9999-9999-9999-999999999999';
const ACC = '44444444-4444-4444-4444-444444444444';
const ACC2 = '55555555-5555-5555-5555-555555555555';

const memberRow = {
  id: MEMBER,
  organizationId: ORG,
  memberNo: 'MBR-0001',
  fullName: 'Sita Sharma',
  status: 'Active',
};

const accountRow = (id: string, memberId: string, accountNo: string) => ({
  id,
  organizationId: ORG,
  memberId,
  accountNo,
  memberName: 'Sita Sharma',
  memberNo: 'MBR-0001',
  productType: 'regular',
  productName: 'Regular Savings',
  balance: '12500.00',
  status: 'Active',
});

const txnRow = (id: string, accountId: string, memberId: string) => ({
  id,
  organizationId: ORG,
  accountId,
  memberId,
  voucherNo: 'GLV-100',
  remarks: 'Deposit',
  credit: '1000.00',
  debit: '0.00',
});

const actor = { userId: 'user-1', username: 'admin', role: 'org_admin', ipAddress: '127.0.0.1' };

beforeEach(() => {
  holder.db = makeFakeDb({
    members: [
      memberRow,
      {
        id: OTHER_MEMBER,
        organizationId: ORG,
        memberNo: 'MBR-0002',
        fullName: 'Ram Thapa',
        status: 'Active',
      },
    ],
    savingsAccounts: [accountRow(ACC, MEMBER, 'SAV-001'), accountRow(ACC2, OTHER_MEMBER, 'SAV-002')],
    savingsTransactions: [txnRow('txn-1', ACC, MEMBER), txnRow('txn-2', ACC2, OTHER_MEMBER)],
    auditDeletionRows: [],
  });
});

describe('HardDeleteService — savings account', () => {
  it('archives an immutable snapshot BEFORE deleting the account + ledger', async () => {
    const service = new HardDeleteService(holder.db as any);
    const result = await service.hardDeleteSavingsAccount(ACC, ORG, actor, 'Duplicate account created in error');

    expect(result.auditLogId).toBeDefined();
    expect(result.entityType).toBe('SAVINGS_ACCOUNT');

    const logs = holder.db.state.auditDeletionRows;
    expect(logs).toHaveLength(1);
    expect(logs[0].entityType).toBe('SAVINGS_ACCOUNT');
    expect(logs[0].entityId).toBe(ACC);
    expect(logs[0].entityCode).toBe('SAV-001');
    expect(logs[0].deletedByUserName).toBe('admin');
    expect(logs[0].deletedByUserRole).toBe('org_admin');
    expect(logs[0].deletionReason).toBe('Duplicate account created in error');
    expect(logs[0].snapshotData.account.accountNo).toBe('SAV-001');
    expect(logs[0].snapshotData.transactions).toHaveLength(1);

    // Linked ledger deleted; the OTHER account is untouched (org/member scoping).
    expect(holder.db.state.savingsAccounts.some((a: any) => a.id === ACC)).toBe(false);
    expect(holder.db.state.savingsAccounts.some((a: any) => a.id === ACC2)).toBe(true);
    expect(holder.db.state.savingsTransactions.some((t: any) => t.id === 'txn-1')).toBe(false);
    expect(holder.db.state.savingsTransactions.some((t: any) => t.id === 'txn-2')).toBe(true);

    // Archive happens BEFORE the parent delete, in the same transaction.
    const ops = holder.db.state.ops;
    expect(ops[0]).toBe('insert:auditDeletionLogs');
    expect(ops.indexOf('insert:auditDeletionLogs')).toBeLessThan(ops.indexOf('delete:savingsAccounts'));
    expect(ops.indexOf('delete:savingsTransactions')).toBeLessThan(ops.indexOf('delete:savingsAccounts'));
  });

  it('rejects an unknown account without archiving anything', async () => {
    const service = new HardDeleteService(holder.db as any);
    await expect(
      service.hardDeleteSavingsAccount('00000000-0000-0000-0000-000000000000', ORG, actor, 'cleanup'),
    ).rejects.toThrow('Savings account not found');
    expect(holder.db.state.auditDeletionRows).toHaveLength(0);
    expect(holder.db.state.ops.filter((op: string) => op.startsWith('insert:'))).toHaveLength(0);
  });
});

describe('HardDeleteService — member', () => {
  it('archives a member snapshot BEFORE deleting the member + linked records', async () => {
    const service = new HardDeleteService(holder.db as any);
    const result = await service.hardDeleteMember(MEMBER, ORG, actor, 'Duplicate member created in error');

    expect(result.auditLogId).toBeDefined();
    expect(result.entityType).toBe('MEMBER');

    const logs = holder.db.state.auditDeletionRows;
    expect(logs).toHaveLength(1);
    expect(logs[0].entityType).toBe('MEMBER');
    expect(logs[0].entityId).toBe(MEMBER);
    expect(logs[0].entityCode).toBe('MBR-0001');
    expect(logs[0].snapshotData.member.fullName).toBe('Sita Sharma');
    expect(logs[0].snapshotData.savingsAccounts).toHaveLength(1);

    // Member + its savings accounts / transactions removed; other rows remain.
    expect(holder.db.state.members.some((m: any) => m.id === MEMBER)).toBe(false);
    expect(holder.db.state.members.some((m: any) => m.id === OTHER_MEMBER)).toBe(true);
    expect(holder.db.state.savingsAccounts.some((a: any) => a.memberId === MEMBER)).toBe(false);
    expect(holder.db.state.savingsAccounts.some((a: any) => a.memberId === OTHER_MEMBER)).toBe(true);
    expect(holder.db.state.savingsTransactions.some((t: any) => t.memberId === MEMBER)).toBe(false);
    expect(holder.db.state.savingsTransactions.some((t: any) => t.memberId === OTHER_MEMBER)).toBe(true);

    // Archive-then-delete ordering: audit insert, linked savings, then member.
    const ops = holder.db.state.ops;
    expect(ops[0]).toBe('insert:auditDeletionLogs');
    expect(ops.indexOf('insert:auditDeletionLogs')).toBeLessThan(ops.indexOf('delete:savingsAccounts'));
    expect(ops.indexOf('delete:savingsAccounts')).toBeLessThan(ops.indexOf('delete:members'));
  });

  it('rejects an unknown member without archiving anything', async () => {
    const service = new HardDeleteService(holder.db as any);
    await expect(
      service.hardDeleteMember('00000000-0000-0000-0000-000000000000', ORG, actor, 'cleanup'),
    ).rejects.toThrow('Member not found');
    expect(holder.db.state.auditDeletionRows).toHaveLength(0);
  });
});

describe('migration 0036 — immutable audit trail', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/0036_audit_deletion_logs.sql'),
    'utf8',
  );

  it('creates the audit_deletion_logs table with entity + actor + snapshot columns', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "public"."audit_deletion_logs"');
    expect(migration).toContain('"entity_type" text NOT NULL');
    expect(migration).toContain('"entity_id" uuid NOT NULL');
    expect(migration).toContain('"deletion_reason" text NOT NULL');
    expect(migration).toContain('"snapshot_data" jsonb NOT NULL');
    expect(migration).toContain('"deleted_by_user_name" text NOT NULL');
  });

  it('blocks UPDATE and DELETE at the database level', () => {
    expect(migration).toContain(
      'CREATE RULE "no_delete_audit_deletion_logs" AS ON DELETE TO "public"."audit_deletion_logs"',
    );
    expect(migration).toContain(
      'CREATE RULE "no_update_audit_deletion_logs" AS ON UPDATE TO "public"."audit_deletion_logs"',
    );
    const doInsteadCount = migration.match(/DO INSTEAD NOTHING/g) ?? [];
    expect(doInsteadCount.length).toBeGreaterThanOrEqual(2);
  });

  it('indexes entity lookups for audit review', () => {
    expect(migration).toContain('"audit_deletion_org_entity_idx"');
    expect(migration).toContain('"audit_deletion_org_date_idx"');
  });
});
