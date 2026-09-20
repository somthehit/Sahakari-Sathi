/**
 * Passbook Printing & Booklet Schema
 * Scoped to organization_id and branch_id for multi-tenant isolation.
 *
 * Three concerns:
 *   • passbook_designs   — calibratable print layouts (mirrors cheque_designs).
 *   • passbook_books     — physical booklets issued to accounts + renewal chain.
 *   • passbook_print_log — one row per print run; the confirm-print step that
 *                          advances the account's continuation marker also writes
 *                          here, so a jammed print can be voided and re-run.
 *
 * Everything is measured in millimetres, not pixels, because the print path must
 * line up with the pre-ruled physical passbook page.
 */
import {
  pgTable, text, numeric, boolean, timestamp, integer, index, uuid, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { branches } from './branches';
import { savingsAccounts } from './savings';

// =============================================
// PASSBOOK PRINT LAYOUTS (calibration / design studio)
// =============================================
/**
 * A saved passbook print layout produced by the Passbook Design studio. Mirrors
 * `cheque_designs`: structured columns carry what the API reasons about (identity,
 * page size, active/default), while the full geometry — page dimensions, line
 * pitch, per-column mm coordinates, fonts — is persisted verbatim as `config_json`
 * (a serialized PassbookLayoutConfig).
 */
export const passbookDesigns = pgTable('passbook_designs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  code: text('code').notNull(),                       // stored UPPERCASE, unique per org
  name: text('name').notNull(),
  description: text('description'),
  // Which stationery this layout targets: a pre-ruled booklet, an A4 statement,
  // or an 80mm thermal roll. Drives the named @page used by printPassbook().
  mode: text('mode', { enum: ['booklet', 'a4', 'thermal'] }).notNull().default('booklet'),
  isActive: boolean('is_active').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  widthMm: numeric('width_mm', { precision: 6, scale: 2 }).notNull().default('105'),
  heightMm: numeric('height_mm', { precision: 6, scale: 2 }).notNull().default('165'),
  // Full PassbookLayoutConfig JSON produced by the Passbook Design studio.
  configJson: text('config_json'),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('passbook_designs_org_code_uniq').on(table.organizationId, table.code),
  index('passbook_designs_org_active_idx').on(table.organizationId, table.isActive),
]);

// =============================================
// PASSBOOK BOOKLETS (issuance / renewal)
// =============================================
/**
 * A physical passbook booklet issued to a savings account. A book fills up as
 * transactions are printed into it (`lines_used` toward `capacity`); when full or
 * lost it is replaced by a fresh book, forming a renewal chain via
 * `previous_book_id` / `replaced_by_book_id`. The account's live continuation
 * marker (last_printed_txn_id / last_printed_line) lives on `savings_accounts`;
 * this table records the booklets and their lifetime.
 *
 * The chain pointers are plain uuids (not self-FKs) to avoid a circular reference
 * and to survive a book being hard-deleted at either end of the chain.
 */
export const passbookBooks = pgTable('passbook_books', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').notNull().references(() => savingsAccounts.id, { onDelete: 'cascade' }),
  serial: text('serial').notNull(),                   // serial printed on the physical booklet
  status: text('status', {
    enum: ['active', 'full', 'replaced', 'lost', 'cancelled'],
  }).notNull().default('active'),
  linesPerPage: integer('lines_per_page').notNull().default(30),
  pageCount: integer('page_count').notNull().default(20),
  capacity: integer('capacity').notNull().default(600),   // total ruled lines = pages * linesPerPage
  linesUsed: integer('lines_used').notNull().default(0),  // running total printed into this book
  issuedDateBs: text('issued_date_bs'),
  issuedDateAd: text('issued_date_ad'),
  closedDateBs: text('closed_date_bs'),                   // when marked full/replaced/lost
  previousBookId: uuid('previous_book_id'),               // book this one renewed (chain back)
  replacedByBookId: uuid('replaced_by_book_id'),          // book that replaced this one (chain fwd)
  issuanceReason: text('issuance_reason', {
    enum: ['new', 'renewal', 'lost', 'damaged', 'full'],
  }).notNull().default('new'),
  issuedBy: uuid('issued_by'),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('passbook_books_org_serial_uniq').on(table.organizationId, table.serial),
  index('passbook_books_org_account_idx').on(table.organizationId, table.accountId),
  index('passbook_books_org_status_idx').on(table.organizationId, table.status),
]);

// =============================================
// PASSBOOK PRINT LOG (per-run audit + continuation safety)
// =============================================
/**
 * One row per print run. Written by the confirm-print step (never by mere PDF/
 * preview generation), together with advancing the account's continuation marker
 * — so an interrupted or jammed print advances nothing until the teller confirms
 * it landed. A bad run can be voided (status 'void') and re-printed.
 */
export const passbookPrintLog = pgTable('passbook_print_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').notNull().references(() => savingsAccounts.id, { onDelete: 'cascade' }),
  bookId: uuid('book_id').references(() => passbookBooks.id, { onDelete: 'set null' }),
  designId: uuid('design_id'),                            // layout used (nullable; plain uuid)
  mode: text('mode', { enum: ['booklet', 'a4', 'thermal'] }).notNull().default('booklet'),
  status: text('status', { enum: ['printed', 'void'] }).notNull().default('printed'),
  fromTxnId: uuid('from_txn_id'),                         // first transaction in the run
  toTxnId: uuid('to_txn_id'),                             // last transaction in the run
  txnCount: integer('txn_count').notNull().default(0),
  startLine: integer('start_line').notNull().default(0),  // page line the run began on
  endLine: integer('end_line').notNull().default(0),      // marker after the run (0..linesPerPage)
  linesPrinted: integer('lines_printed').notNull().default(0),
  pageCount: integer('page_count').notNull().default(0),
  fromDateBs: text('from_date_bs'),
  toDateBs: text('to_date_bs'),
  printedBy: uuid('printed_by'),
  printedByName: text('printed_by_name'),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('passbook_print_log_org_account_idx').on(table.organizationId, table.accountId, table.createdAt),
  index('passbook_print_log_org_book_idx').on(table.organizationId, table.bookId),
]);
