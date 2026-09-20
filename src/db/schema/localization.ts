/**
 * Organization Localization Schema
 * Language, calendar/date formats, number grouping and currency display.
 * Scoped to organization_id (multi-tenant) — one row per organization.
 */
import { pgTable, text, timestamp, uuid, boolean } from 'drizzle-orm/pg-core';
import { organizations } from './auth';

export const organizationLocalizationSettings = pgTable('organization_localization_settings', {
  organizationId: uuid('organization_id').primaryKey().references(() => organizations.id, { onDelete: 'cascade' }),
  defaultLanguage: text('default_language').notNull().default('ne'),
  supportedLanguages: text('supported_languages').array().notNull().default(['ne', 'en']),
  primaryCalendarSystem: text('primary_calendar_system').notNull().default('BS'),
  dateDisplayFormat: text('date_display_format').notNull().default('YYYY-MM-DD'),
  numberFormatStyle: text('number_format_style').notNull().default('IN'),
  currencySymbol: text('currency_symbol').notNull().default('रु.'),
  currencySymbolPosition: text('currency_symbol_position').notNull().default('prefix'),
  enableAutoTransliteration: boolean('enable_auto_transliteration').notNull().default(false),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
