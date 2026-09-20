/**
 * AI Schema
 * ai_conversations, ai_messages, ai_feedback, ai_usage_logs
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, integer, boolean, numeric, timestamp, uuid, index, jsonb,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { orgUsers } from './auth';

// =============================================
// AI CONVERSATIONS (session container)
// =============================================
export const aiConversations = pgTable('ai_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => orgUsers.id, { onDelete: 'set null' }),
  title: text('title'),                               // auto-generated from first message
  module: text('module'),                             // 'Loans', 'Savings', 'General', etc.
  status: text('status', { enum: ['Active', 'Archived', 'Deleted'] }).notNull().default('Active'),
  totalMessages: integer('total_messages').notNull().default(0),
  totalTokensUsed: integer('total_tokens_used').notNull().default(0),
  lastMessageAt: timestamp('last_message_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('ai_conv_org_user_idx').on(table.organizationId, table.userId),
  index('ai_conv_org_status_idx').on(table.organizationId, table.status),
  index('ai_conv_org_module_idx').on(table.organizationId, table.module),
]);

// =============================================
// AI MESSAGES
// =============================================
export const aiMessages = pgTable('ai_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').notNull().references(() => aiConversations.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  modelUsed: text('model_used'),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  totalTokens: integer('total_tokens'),
  latencyMs: integer('latency_ms'),
  metadata: jsonb('metadata'),                        // function calls, citations, etc.
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('ai_msg_org_conv_idx').on(table.organizationId, table.conversationId),
  index('ai_msg_org_created_idx').on(table.organizationId, table.createdAt),
]);

// =============================================
// AI FEEDBACK
// =============================================
export const aiFeedback = pgTable('ai_feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').notNull().references(() => aiMessages.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => orgUsers.id, { onDelete: 'set null' }),
  rating: integer('rating'),                          // 1-5
  thumbs: text('thumbs', { enum: ['up', 'down'] }),
  comment: text('comment'),
  category: text('category', {
    enum: ['Correct', 'Incorrect', 'Helpful', 'Unhelpful', 'Harmful', 'Other']
  }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('ai_fb_org_msg_idx').on(table.organizationId, table.messageId),
  index('ai_fb_org_created_idx').on(table.organizationId, table.createdAt),
]);

// =============================================
// AI USAGE LOGS (monthly credit tracking)
// =============================================
export const aiUsageLogs = pgTable('ai_usage_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => orgUsers.id, { onDelete: 'set null' }),
  conversationId: uuid('conversation_id').references(() => aiConversations.id),
  modelUsed: text('model_used').notNull(),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  estimatedCost: numeric('estimated_cost', { precision: 10, scale: 6 }).default('0'),
  periodBs: text('period_bs').notNull(),              // e.g. "2081-04" for monthly rollup
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('ai_usage_org_period_idx').on(table.organizationId, table.periodBs),
  index('ai_usage_org_user_idx').on(table.organizationId, table.userId),
  index('ai_usage_org_created_idx').on(table.organizationId, table.createdAt),
]);
