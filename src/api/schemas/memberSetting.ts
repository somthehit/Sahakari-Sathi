/**
 * Shared Zod schemas for the SETUPS → Member Settings domain (Module 3).
 *
 * Single source of truth for request validation across the seven member
 * classification catalogs (member types, member categories, occupations,
 * education levels, nominee types, relationship types, member statuses).
 *
 * Conventions:
 *  - Every schema is a `z.object({ body: ... })` wrapper that plugs directly
 *    into `validateRequest`.
 *  - Tenant columns (organization_id, created_by, updated_by) are NEVER
 *    accepted on the wire — they are always derived server-side from the
 *    authenticated JWT.
 *  - `code` is normalized to UPPERCASE server-side; the DB unique index on
 *    (organization_id, code) therefore enforces case-insensitive uniqueness.
 *  - `member-types` carries three additional financial fields that the other
 *    six catalogs do not have.
 */
import { z } from 'zod';

export const MEMBER_SETTING_ENTITY_TYPES = [
  'member-types',
  'member-categories',
  'occupations',
  'education-levels',
  'nominee-types',
  'relationship-types',
  'member-statuses',
] as const;

export type MemberSettingEntityType = (typeof MEMBER_SETTING_ENTITY_TYPES)[number];

export const memberSettingBasePayload = z.object({
  code: z.string().min(1, 'Code is required').max(20, 'Code must be 20 characters or fewer'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  nameNepali: z.string().max(100).nullish(),
  description: z.string().max(500).nullish(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

/** Extra financial fields that only `member-types` accepts. */
export const memberTypeExtraPayload = z.object({
  minShareUnits: z.coerce.number().int().min(0).optional(),
  entranceFee: z.coerce.number().min(0).optional(),
  shareValuePerUnit: z.coerce.number().min(0).optional(),
  isGroupType: z.boolean().optional(),
});

/** Full payload schema for a given entity type (member-types adds the 3 extras). */
export function memberSettingPayloadFor(entityType: string) {
  if (entityType === 'member-types') {
    return memberSettingBasePayload.extend(memberTypeExtraPayload.shape);
  }
  return memberSettingBasePayload;
}

/**
 * Full `{ body }` wrapper for a specific entity type.
 */
export function memberSettingSchemaFor(entityType: string) {
  return z.object({ body: memberSettingPayloadFor(entityType) });
}

/**
 * Update (`PUT`) wrapper for a specific entity type — the INNER payload fields
 * are partial so a sparse update body (only changed fields) is accepted.
 */
export function memberSettingUpdateSchemaFor(entityType: string) {
  return z.object({ body: memberSettingPayloadFor(entityType).partial() });
}

/**
 * Per-entity validation middleware (drop-in for `validateRequest`).
 * Reads `params.entityType` to pick the correct payload shape so the extra
 * member-types fields are only accepted on that catalog.
 */
import type { Request, Response, NextFunction } from 'express';
export const validateMemberSettingRequest = (schemaFor: (entityType: string) => z.ZodSchema) => {
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
