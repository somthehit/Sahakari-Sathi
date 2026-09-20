/**
 * Audit Deletion Schema
 * audit_deletion_logs — the immutable, append-only trail for HARD deletes.
 *
 * Unlike audit_logs (settings diffs), every HARD delete of a financial or
 * member record MUST leave a recoverable snapshot of the deleted entity plus
 * the admin identity, reason, and IP. The row is written BEFORE the actual
 * deletes inside the same transaction, so the archive always exists.
 *
 * Immutability is enforced at the DB level (not just in app code): the
 * migration adds `DO INSTEAD NOTHING` RULES for DELETE and UPDATE, so once a
 * row is inserted it can never be altered or removed.
 */
import { pgTable, text, uuid, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { organizations } from './auth';

export const auditDeletionLogs = pgTable('audit_deletion_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  entityType: text('entity_type', {
    enum: ['MEMBER', 'SAVINGS_ACCOUNT', 'USER'],
  }).notNull(),
  entityId: uuid('entity_id').notNull(),
  entityCode: text('entity_code'),
  deletedByUserId: uuid('deleted_by_user_id').notNull(),
  deletedByUserName: text('deleted_by_user_name').notNull(),
  deletedByUserRole: text('deleted_by_user_role'),
  deletionReason: text('deletion_reason').notNull(),
  /** Full JSON snapshot of the deleted entity + linked financial records. */
  snapshotData: jsonb('snapshot_data').notNull(),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('audit_deletion_org_entity_idx').on(table.organizationId, table.entityType, table.entityId),
  index('audit_deletion_org_date_idx').on(table.organizationId, table.createdAt),
]);
