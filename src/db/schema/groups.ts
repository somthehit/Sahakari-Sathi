/**
 * Groups Schema
 * A real operational entity (NOT a code/name lookup): community/savings-and-credit
 * groups (समूह) that members may be assigned to when their Member Type = "Group".
 *
 * Multi-tenancy: org-scoped via organization_id (derived from JWT at runtime).
 * `code` is stored UPPERCASE (normalized server-side) with a
 * UNIQUE(organization_id, code) index, matching the other Member Settings catalogs.
 *
 * Meeting schedule is a RECURRING monthly schedule: meeting_day_of_month (1–31)
 * + meeting_time + meeting_place. `max_members` is a capacity cap (NULL = no cap).
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';

export const groups = pgTable('groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 20 }).notNull(), // stored UPPERCASE
  name: varchar('name', { length: 100 }).notNull(),
  nameNepali: varchar('name_nepali', { length: 100 }),
  address: text('address'),
  chairpersonName: varchar('chairperson_name', { length: 100 }),
  chairpersonContact: varchar('chairperson_contact', { length: 50 }),
  chairpersonAddress: text('chairperson_address'),
  contactPersonName: varchar('contact_person_name', { length: 100 }),
  contactPersonPhone: varchar('contact_person_phone', { length: 50 }),
  meetingDayOfMonth: integer('meeting_day_of_month'), // 1–31, recurring monthly schedule
  meetingTime: varchar('meeting_time', { length: 20 }), // e.g. "3:00 PM"
  meetingPlace: text('meeting_place'),
  maxMembers: integer('max_members'), // NULL = no cap
  isActive: boolean('is_active').notNull().default(true),
  isSystem: boolean('is_system').notNull().default(false),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('groups_org_code_uniq').on(table.organizationId, table.code),
  index('groups_org_active_idx').on(table.organizationId, table.isActive),
]);
