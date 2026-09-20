import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// Passbook print layouts (Passbook Design studio)
// ─────────────────────────────────────────────────────────────
// Mirrors chequeDesignSchema. Passbook stationery is measured in millimetres so
// the print path lines up with the pre-ruled physical booklet page.

export const passbookDesignSchema = z.object({
  code: z.string().min(1, 'Design code is required').max(40),
  name: z.string().min(1, 'Design name is required').max(120),
  description: z.string().max(500).nullable().optional(),
  mode: z.enum(['booklet', 'a4', 'thermal']).default('booklet'),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  widthMm: z.coerce.number().positive().max(500).default(105),
  heightMm: z.coerce.number().positive().max(400).default(165),
  // Full PassbookLayoutConfig produced by the studio — object or pre-serialized string.
  configJson: z.any().optional(),
  branchId: z.string().uuid().nullable().optional(),
});

export const passbookDesignUpdateSchema = passbookDesignSchema.partial();

// ─────────────────────────────────────────────────────────────
// Passbook booklet issuance / renewal
// ─────────────────────────────────────────────────────────────

export const issuePassbookBookSchema = z.object({
  serial: z.string().min(1, 'Passbook serial is required').max(60),
  pageCount: z.coerce.number().int().min(1).max(400).default(20),
  linesPerPage: z.coerce.number().int().min(1).max(120).default(30),
  issuedDateBs: z.string().max(20).optional(),
  issuedDateAd: z.string().max(20).optional(),
  reason: z.enum(['new', 'renewal', 'lost', 'damaged', 'full']).default('new'),
  remarks: z.string().max(500).optional(),
});

export const renewPassbookBookSchema = z.object({
  serial: z.string().min(1, 'New passbook serial is required').max(60),
  pageCount: z.coerce.number().int().min(1).max(400).optional(),
  linesPerPage: z.coerce.number().int().min(1).max(120).optional(),
  issuedDateBs: z.string().max(20).optional(),
  issuedDateAd: z.string().max(20).optional(),
  reason: z.enum(['renewal', 'lost', 'damaged', 'full']).default('renewal'),
  remarks: z.string().max(500).optional(),
});

// ─────────────────────────────────────────────────────────────
// Print flow — two-step: build payload (no side effects) then confirm.
// ─────────────────────────────────────────────────────────────

export const buildPrintPayloadSchema = z.object({
  mode: z.enum(['booklet', 'a4', 'thermal']).default('booklet'),
  designId: z.string().uuid().nullable().optional(),
  rangeMode: z.enum(['since_last', 'custom']).default('since_last'),
  fromDateBs: z.string().max(20).optional(),
  toDateBs: z.string().max(20).optional(),
});

/**
 * Confirm a print landed. The client sends back the exact run geometry it printed
 * (returned to it by build-payload) so the server advances the continuation marker
 * and writes the print-log atomically. txn ids are validated as uuids when present.
 */
export const confirmPrintSchema = z.object({
  mode: z.enum(['booklet', 'a4', 'thermal']).default('booklet'),
  designId: z.string().uuid().nullable().optional(),
  bookId: z.string().uuid().nullable().optional(),
  fromTxnId: z.string().uuid().nullable().optional(),
  toTxnId: z.string().uuid().nullable().optional(),
  txnCount: z.coerce.number().int().min(0).default(0),
  startLine: z.coerce.number().int().min(0).default(0),
  endLine: z.coerce.number().int().min(0).default(0),
  linesPrinted: z.coerce.number().int().min(0).default(0),
  pageCount: z.coerce.number().int().min(0).default(0),
  fromDateBs: z.string().max(20).nullable().optional(),
  toDateBs: z.string().max(20).nullable().optional(),
  // Only booklet prints advance the physical continuation marker; a4/thermal are
  // reprints of already-recorded history and must NOT move it. Defaulted server-side.
  advanceMarker: z.boolean().optional(),
});

export const voidPrintRunSchema = z.object({
  reason: z.string().max(500).optional(),
});
