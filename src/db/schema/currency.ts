/**
 * Currency & Forex Schema
 * Multi-currency ledger snapshot for audit-trail compliance.
 * All tables scoped to organization_id for multi-tenancy.
 */
import { pgTable, text, numeric, boolean, timestamp, uuid, index, uniqueIndex, date } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './auth';
import { members } from './members';

export const exchangeRates = pgTable('exchange_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  baseCurrency: text('base_currency').notNull().default('USD'),
  targetCurrency: text('target_currency').notNull().default('NPR'),
  buyRate: numeric('buy_rate', { precision: 12, scale: 4 }).notNull(),
  sellRate: numeric('sell_rate', { precision: 12, scale: 4 }).notNull(),
  officialMiddleRate: numeric('official_middle_rate', { precision: 12, scale: 4 }).notNull(),
  effectiveDate: date('effective_date', { mode: 'string' }).notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('exchange_rates_org_date_pair_uniq').on(
    table.organizationId, table.baseCurrency, table.targetCurrency, table.effectiveDate,
  ),
  index('idx_exchange_rates_lookup').on(
    table.organizationId, table.baseCurrency, table.targetCurrency, table.effectiveDate,
  ),
]);

export const organizationFinancialSettings = pgTable('organization_financial_settings', {
  organizationId: uuid('organization_id').primaryKey().references(() => organizations.id, { onDelete: 'cascade' }),
  defaultCurrency: text('default_currency').notNull().default('NPR'),
  allowedCurrencies: text('allowed_currencies').array().notNull().default(['NPR', 'USD']),
  defaultForexMarkupPercent: numeric('default_forex_markup_percent', { precision: 5, scale: 2 }).notNull().default('0.00'),
  isTaxEnabled: boolean('is_tax_enabled').notNull().default(false),
  taxName: text('tax_name').notNull().default('GST'),
  defaultTaxRatePercent: numeric('default_tax_rate_percent', { precision: 5, scale: 2 }).notNull().default('0.00'),
  taxNumber: text('tax_number'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const memberTransactions = pgTable('member_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  currency: text('currency').notNull().default('NPR'),
  originalAmount: numeric('original_amount', { precision: 15, scale: 2 }).notNull(),
  exchangeRate: numeric('exchange_rate', { precision: 12, scale: 4 }).notNull().default('1.0000'),
  forexMarkupPercent: numeric('forex_markup_percent', { precision: 5, scale: 2 }).notNull().default('0.00'),
  effectiveExchangeRate: numeric('effective_exchange_rate', { precision: 12, scale: 4 }).generatedAlwaysAs(
    sql`exchange_rate * (1 + (forex_markup_percent / 100))`,
  ),
  baseAmountNpr: numeric('base_amount_npr', { precision: 15, scale: 2 }).notNull(),
  taxPercent: numeric('tax_percent', { precision: 5, scale: 2 }).notNull().default('0.00'),
  taxAmountNpr: numeric('tax_amount_npr', { precision: 15, scale: 2 }).notNull().default('0.00'),
  totalAmountNpr: numeric('total_amount_npr', { precision: 15, scale: 2 }).notNull(),
  status: text('status').notNull().default('Completed'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_member_transactions_org_member_created').on(table.organizationId, table.memberId, table.createdAt),
]);
