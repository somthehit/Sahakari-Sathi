/**
 * Shared Zod schemas for the SETUPS → Share Settings domain.
 *
 * Single source of truth for request validation across:
 *   share-classes, share-schemes, dividend-rules, certificate-formats
 * plus the org default-share-scheme selector.
 *
 * Conventions (mirrors memberSetting.ts):
 *  - Every schema is a `z.object({ body: ... })` wrapper that plugs directly
 *    into `validateRequest`.
 *  - Tenant columns (organization_id, created_by, updated_by) are NEVER
 *    accepted on the wire — they are always derived server-side from the
 *    authenticated JWT.
 *  - `code` is normalized to UPPERCASE server-side; the DB unique index on
 *    (organization_id, code) therefore enforces case-insensitive uniqueness.
 *  - share-schemes is the canonical pricing config: it carries share_class_id,
 *    share_type_id, share_value_per_unit, min_open_units, max_units,
 *    is_transferable, dividend_rate and min_opening_amount.
 */
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export const SHARE_SETTING_ENTITY_TYPES = [
  'share-classes',
  'share-schemes',
  'dividend-rules',
  'certificate-formats',
] as const;

export type ShareSettingEntityType = (typeof SHARE_SETTING_ENTITY_TYPES)[number];

export const shareSettingBasePayload = z.object({
  code: z.string().min(1, 'Code is required').max(20, 'Code must be 20 characters or fewer'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  nameNepali: z.string().max(100).nullish(),
  description: z.string().max(500).nullish(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

/** Share Scheme pricing/config extras (canonical financial source). */
export const shareSchemeExtraPayload = z.object({
  shareClassId: z.string().uuid().nullish(),
  shareTypeId: z.string().uuid().nullish(),
  shareValuePerUnit: z.coerce.number().min(0).optional(),
  minOpenUnits: z.coerce.number().int().min(1).optional(),
  maxUnits: z.coerce.number().int().positive().nullish(),
  isTransferable: z.boolean().optional(),
  dividendRate: z.coerce.number().min(0).optional(),
  minOpeningAmount: z.coerce.number().min(0).optional(),
});

/** Dividend Rule extras. */
export const dividendRuleExtraPayload = z.object({
  taxWithholdingPercent: z.coerce.number().min(0).optional(),
  targetDividendPercent: z.coerce.number().min(0).optional(),
  bonusShareRatio: z.string().max(20).nullish(),
  dividendPolicy: z.string().max(2000).nullish(),
  // Per-fiscal-year config (config-only, no distribution engine yet).
  fiscalYear: z.string().max(20).nullish(),
  approvalStatus: z.enum(['draft', 'approved']).optional(),
  distributionMode: z.enum(['cash', 'bonus_share', 'member_choice']).optional(),
  minimumHoldingPeriodMonths: z.coerce.number().int().min(0).optional(),
});

/** Certificate Format extras. */
export const certificateFormatExtraPayload = z.object({
  certificatePrefix: z.string().max(10).nullish(),
  startingNumber: z.coerce.number().int().min(1).optional(),
  includeLogo: z.boolean().optional(),
  headerText: z.string().max(1000).nullish(),
  footerText: z.string().max(1000).nullish(),
  fields: z.array(z.string().max(50)).max(50).optional(),
  // Full visual design produced by the ShareCertificateDesigner (theme,
  // statements, signatories, draggable elements, …). Stored as JSON.
  configJson: z.unknown().nullish(),
});

/** Share Class functional parameters extras. */
export const shareClassExtraPayload = z.object({
  shareTypeId: z.string().nullish(),
  targetMemberTypeId: z.string().nullish(),
  parValue: z.coerce.number().positive('Par value must be greater than 0').optional().default(100),
  minKittaPerPurchase: z.coerce.number().int().positive('Must purchase at least 1 kitta').optional().default(10),
  maxKittaPerMember: z.coerce.number().int().positive().nullish(),
  glAccountId: z.string().uuid('Please select a valid GL Share Capital Account').nullish(),
  isDividendEligible: z.boolean().optional().default(true),
  maxDividendRatePct: z.coerce.number().min(0).max(100).nullish(),
});

/** Full payload schema for a given entity type. */
export function shareSettingPayloadFor(entityType: string) {
  if (entityType === 'share-classes') {
    return shareSettingBasePayload.extend(shareClassExtraPayload.shape).refine(data => {
      if (data.maxKittaPerMember && data.minKittaPerPurchase && data.maxKittaPerMember < data.minKittaPerPurchase) {
        return false;
      }
      return true;
    }, {
      message: "Maximum kitta limit cannot be less than minimum purchase kitta",
      path: ["maxKittaPerMember"]
    });
  }
  if (entityType === 'share-schemes') {
    return shareSettingBasePayload.extend(shareSchemeExtraPayload.shape);
  }
  if (entityType === 'dividend-rules') {
    return shareSettingBasePayload.extend(dividendRuleExtraPayload.shape);
  }
  if (entityType === 'certificate-formats') {
    return shareSettingBasePayload.extend(certificateFormatExtraPayload.shape);
  }
  return shareSettingBasePayload;
}

/** Full `{ body }` wrapper for a specific entity type. */
export function shareSettingSchemaFor(entityType: string) {
  return z.object({ body: shareSettingPayloadFor(entityType) });
}

/** Update (`PUT`) wrapper — inner fields partial so sparse bodies are accepted. */
export function shareSettingUpdateSchemaFor(entityType: string) {
  return z.object({ body: shareSettingPayloadFor(entityType).partial() });
}

/**
 * Org default share scheme selector:
 *   { defaultShareSchemeId: uuid | null }  — null clears the default.
 */
export const setDefaultShareSchemeSchema = z.object({
  body: z.object({
    defaultShareSchemeId: z.string().uuid().nullable().optional(),
  }),
});

/**
 * Org default share certificate format selector:
 *   { defaultCertificateFormatId: uuid | null }  — null clears the default.
 */
export const setDefaultCertificateFormatSchema = z.object({
  body: z.object({
    defaultCertificateFormatId: z.string().uuid().nullable().optional(),
  }),
});

/**
 * Singular Share Certificate Format save (embedded designer on the
 * SETUPS → Share Settings page). Body is the full CertificateConfig JSON
 * produced by ShareCertificateDesigner — any rich object is accepted.
 */
export const saveCertificateFormatSchema = z.object({
  body: z.record(z.string(), z.unknown()).refine(
    (v) => v && Object.keys(v).length > 0,
    { message: 'Certificate config must be a non-empty object' },
  ),
});

/**
 * Per-entity validation middleware (drop-in for `validateRequest`).
 * Reads `params.entityType` to pick the correct payload shape.
 */
export const validateShareSettingRequest = (schemaFor: (entityType: string) => z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schemaFor(String(req.params.entityType)).parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: any) {
      if (error && error.name === 'ZodError') {
        const zodError = error as z.ZodError<any>;
        return res.status(400).json({
          error: 'Validation Failed',
          details: (zodError.issues || []).map((err: any) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      return res.status(500).json({ error: 'Internal Server Error during validation' });
    }
  };
};
