/**
 * Governance schema — AGM meetings, attendance, resolutions, news, and team members.
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, varchar, integer, boolean, timestamp, uuid, date, jsonb, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { members } from './members';

// =============================================
// AGM / BOARD MEETINGS
// =============================================
export const agmMeetings = pgTable('agm_meetings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  titleNepali: varchar('title_nepali', { length: 200 }),
  type: text('type', {
    enum: ['AGM', 'EGM', 'Board', 'Committee', 'Special'],
  }).notNull().default('AGM'),
  meetingDateBs: varchar('meeting_date_bs', { length: 20 }).notNull(),
  meetingDateAd: date('meeting_date_ad'),
  startTime: varchar('start_time', { length: 10 }),
  endTime: varchar('end_time', { length: 10 }),
  venue: varchar('venue', { length: 200 }),
  venueNepali: varchar('venue_nepali', { length: 200 }),
  description: text('description'),
  // Agenda items stored as JSONB array: [{ order, title, titleNepali, description, type }]
  agenda: jsonb('agenda').default([]),
  status: text('status', {
    enum: ['Scheduled', 'In_Progress', 'Completed', 'Cancelled', 'Postponed'],
  }).notNull().default('Scheduled'),
  // Quorum
  quorumRequired: integer('quorum_required').default(0),
  quorumPercentage: integer('quorum_percentage').default(50),
  // Outcomes
  resolutionsCount: integer('resolutions_count').default(0),
  minutesSummary: text('minutes_summary'),
  // Meta
  calledBy: text('called_by'),
  chairedBy: text('chaired_by'),
  secretaryName: text('secretary_name'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('agm_meetings_org_idx').on(table.organizationId),
  index('agm_meetings_org_type_idx').on(table.organizationId, table.type),
  index('agm_meetings_org_status_idx').on(table.organizationId, table.status),
  index('agm_meetings_org_date_idx').on(table.organizationId, table.meetingDateBs),
]);

// =============================================
// AGM ATTENDEES (per meeting)
// =============================================
export const agmAttendees = pgTable('agm_attendees', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  meetingId: uuid('meeting_id').notNull().references(() => agmMeetings.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').references(() => members.id, { onDelete: 'set null' }),
  memberNo: varchar('member_no', { length: 50 }),
  memberName: varchar('member_name', { length: 150 }),
  // Attendance
  attended: boolean('attended').default(false),
  proxyGiven: boolean('proxy_given').default(false),
  proxyTo: varchar('proxy_to', { length: 150 }),
  // For non-member attendees (guests, observers)
  isGuest: boolean('is_guest').default(false),
  guestName: varchar('guest_name', { length: 150 }),
  guestRole: varchar('guest_role', { length: 100 }),
  // Signature
  signatureReceived: boolean('signature_received').default(false),
  remarks: text('remarks'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('agm_attendees_meeting_idx').on(table.meetingId),
  index('agm_attendees_org_meeting_idx').on(table.organizationId, table.meetingId),
  index('agm_attendees_member_idx').on(table.memberId),
]);

// =============================================
// AGM RESOLUTIONS (per meeting)
// =============================================
export const agmResolutions = pgTable('agm_resolutions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  meetingId: uuid('meeting_id').notNull().references(() => agmMeetings.id, { onDelete: 'cascade' }),
  resolutionNo: integer('resolution_no').notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  titleNepali: varchar('title_nepali', { length: 300 }),
  description: text('description'),
  proposedBy: varchar('proposed_by', { length: 150 }),
  secondedBy: varchar('seconded_by', { length: 150 }),
  status: text('status', {
    enum: ['Proposed', 'Approved', 'Rejected', 'Deferred', 'Withdrawn'],
  }).notNull().default('Proposed'),
  votesFor: integer('votes_for').default(0),
  votesAgainst: integer('votes_against').default(0),
  abstained: integer('abstained').default(0),
  decision: text('decision'),
  assignedTo: varchar('assigned_to', { length: 150 }),
  dueDateBs: varchar('due_date_bs', { length: 20 }),
  completedAt: timestamp('completed_at'),
  attachments: jsonb('attachments').$type<{ name: string; url: string; size?: number; type?: string }[]>().default([]),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('agm_resolutions_meeting_idx').on(table.meetingId),
  index('agm_resolutions_org_meeting_idx').on(table.organizationId, table.meetingId),
]);

// =============================================
// AGM NEWS / UPDATES
// =============================================
export const agmNews = pgTable('agm_news', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 300 }).notNull(),
  titleNepali: varchar('title_nepali', { length: 300 }),
  content: text('content'),
  contentNepali: text('content_nepali'),
  category: text('category', {
    enum: ['Notice', 'Circular', 'Announcement', 'Resolution', 'Minutes', 'Report', 'General'],
  }).notNull().default('Announcement'),
  priority: text('priority', {
    enum: ['Low', 'Medium', 'High', 'Urgent'],
  }).notNull().default('Medium'),
  publishDateBs: varchar('publish_date_bs', { length: 20 }),
  expiryDateBs: varchar('expiry_date_bs', { length: 20 }),
  isPublished: boolean('is_published').default(false),
  attachments: jsonb('attachments').$type<{ name: string; url: string; size?: number }[]>().default([]),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('agm_news_org_idx').on(table.organizationId),
  index('agm_news_org_category_idx').on(table.organizationId, table.category),
  index('agm_news_org_published_idx').on(table.organizationId, table.isPublished),
]);

// =============================================
// AGM TEAM MEMBERS (Board, Finance, Law, Loan committees, etc.)
// =============================================
export const agmTeamMembers = pgTable('agm_team_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  meetingId: uuid('meeting_id').references(() => agmMeetings.id, { onDelete: 'set null' }),
  employeeId: uuid('employee_id'),
  name: varchar('name', { length: 150 }).notNull(),
  nameNepali: varchar('name_nepali', { length: 150 }),
  role: varchar('role', { length: 100 }).notNull(),
  category: text('category', {
    enum: ['Board', 'Finance', 'Law', 'Loan', 'Audit', 'Supervision', 'Technical', 'Management', 'Other'],
  }).notNull().default('Board'),
  designation: varchar('designation', { length: 100 }),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 150 }),
  address: text('address'),
  photoUrl: text('photo_url'),
  documents: jsonb('documents').$type<{ name: string; url: string; size?: number; type?: string }[]>().default([]),
  orderIndex: integer('order_index').default(0),
  status: text('status', {
    enum: ['Active', 'Inactive', 'Resigned', 'Removed'],
  }).notNull().default('Active'),
  joinedDateBs: varchar('joined_date_bs', { length: 20 }),
  tenureEndBs: varchar('tenure_end_bs', { length: 20 }),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('agm_team_members_org_idx').on(table.organizationId),
  index('agm_team_members_meeting_idx').on(table.meetingId),
  index('agm_team_members_org_category_idx').on(table.organizationId, table.category),
]);
