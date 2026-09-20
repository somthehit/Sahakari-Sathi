/**
 * Master Data Schema
 * Nepal Administrative Structure: provinces → districts → municipalities → wards
 * Referenced by organizations via uuid FKs instead of free-text varchar.
 */
import { pgTable, text, varchar, integer, uuid, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

// =============================================
// PROVINCES (7 official provinces of Nepal)
// =============================================
export const provinces = pgTable('provinces', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 2 }).notNull().unique(), // '1'..'7'
  name: varchar('name', { length: 50 }).notNull().unique(), // 'Koshi'
  nameNepali: varchar('name_nepali', { length: 50 }).notNull(), // 'कोशी'
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// =============================================
// DISTRICTS (77 official districts of Nepal)
// =============================================
export const districts = pgTable('districts', {
  id: uuid('id').primaryKey().defaultRandom(),
  provinceId: uuid('province_id').notNull().references(() => provinces.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 3 }).notNull().unique(), // '01'..'77'
  name: varchar('name', { length: 60 }).notNull().unique(), // 'Kathmandu'
  nameNepali: varchar('name_nepali', { length: 60 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  provinceIdx: index('districts_province_idx').on(table.provinceId),
}));

// =============================================
// MUNICIPALITIES (753 official local units)
// =============================================
export const municipalities = pgTable('municipalities', {
  id: uuid('id').primaryKey().defaultRandom(),
  districtId: uuid('district_id').notNull().references(() => districts.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 10 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  nameNepali: varchar('name_nepali', { length: 100 }).notNull(),
  type: varchar('type', { length: 30 }).notNull().default('Rural Municipality'), // Metropolitan, Sub-Metropolitan, Municipality, Rural Municipality
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  districtIdx: index('municipalities_district_idx').on(table.districtId),
}));

// =============================================
// WARDS (per municipality)
// =============================================
export const wards = pgTable('wards', {
  id: uuid('id').primaryKey().defaultRandom(),
  municipalityId: uuid('municipality_id').notNull().references(() => municipalities.id, { onDelete: 'cascade' }),
  wardNo: integer('ward_no').notNull(),
  name: varchar('name', { length: 100 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  municipalityIdx: index('wards_municipality_idx').on(table.municipalityId),
  wardUnique: uniqueIndex('wards_unique').on(table.municipalityId, table.wardNo),
}));
