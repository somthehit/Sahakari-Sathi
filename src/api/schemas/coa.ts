/**
 * Chart of Accounts (COA) bulk import & standard seeding schemas.
 * Shared by COAController — validated through the global `validateRequest`
 * middleware (multi-tenant `organization_id` is always derived from the JWT,
 * never trusted from the wire).
 */
import { z } from 'zod';

export const COA_ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'] as const;
export const COA_BULK_LIMIT = 2000;

/** Single CSV/Excel row normalized for the backend (`parent_gl_code` nullable). */
export const coaBulkRecordSchema = z.object({
  glCode: z.string().min(1, 'GL code is required').max(20, 'GL code must be 20 characters or fewer'),
  accountName: z.string().min(1, 'Account name is required').max(100, 'Account name must be 100 characters or fewer'),
  accountType: z.enum(COA_ACCOUNT_TYPES).refine((v) => v, 'account_type must be one of Asset / Liability / Equity / Income / Expense'),
  parentGlCode: z.string().max(20).nullish(),
  isPostingAllowed: z.boolean().default(true),
  openingBalance: z.coerce.number().default(0),
  normalBalance: z.enum(['debit', 'credit']).optional(),
  isControlAccount: z.boolean().default(false),
});

/** `POST /coa/bulk-import` body. */
export const bulkImportRequest = z.object({
  body: z.object({
    records: z.array(coaBulkRecordSchema).max(COA_BULK_LIMIT, `At most ${COA_BULK_LIMIT} accounts per import`),
  }),
});

/** `POST /coa/seed-default` body (currently just an explicit opt-in flag). */
export const seedDefaultRequest = z.object({
  body: z.object({
    overlayExisting: z.boolean().optional(),
  }),
});

export type CoaBulkRecord = z.infer<typeof coaBulkRecordSchema>;