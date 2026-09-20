/**
 * MemberSettingsController
 * Single controller handling all 7 member-settings entity types.
 * Entity type is taken from req.params.entityType and validated before dispatch.
 */
import { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/authMiddleware';
import { requireOrg } from '../middleware/scope';
import {
  MemberSettingsService,
  isValidEntityType,
  VALID_ENTITY_TYPES,
} from '../services/MemberSettingsService';

const service = new MemberSettingsService();

// ---------------------------------------------------------------------------
// Shared Zod schemas
// ---------------------------------------------------------------------------

const baseCreateSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  nameNepali: z.string().max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const memberTypeExtendedSchema = baseCreateSchema.extend({
  minShareUnits: z.number().int().min(0).optional(),
  entranceFee: z.union([z.number().min(0), z.string()]).optional(),
  shareValuePerUnit: z.union([z.number().min(0), z.string()]).optional(),
});

const reorderSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0),
  })).min(1),
});

// ---------------------------------------------------------------------------
// Helper: get entity type or send 400
// ---------------------------------------------------------------------------
function resolveEntityType(req: AuthRequest, res: Response): string | null {
  const { entityType } = req.params;
  if (!entityType || !isValidEntityType(entityType)) {
    res.status(400).json({
      error: `Invalid entity type '${entityType}'. Valid values: ${VALID_ENTITY_TYPES.join(', ')}`,
    });
    return null;
  }
  return entityType;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------
export class MemberSettingsController {

  static async list(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;

      const entityType = resolveEntityType(req, res);
      if (!entityType) return;

      const { search, page, limit, active } = req.query;

      const result = await service.list(organizationId, entityType as any, {
        search: search as string | undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? Math.min(parseInt(limit as string, 10), 200) : 50,
        active: active as string | undefined,
      });

      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  static async getOne(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;

      const entityType = resolveEntityType(req, res);
      if (!entityType) return;

      const row = await service.getOne(organizationId, entityType as any, req.params.id);
      if (!row) return res.status(404).json({ error: 'Record not found.' });
      res.json(row);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;

      const entityType = resolveEntityType(req, res);
      if (!entityType) return;

      // Validate input
      const schema = entityType === 'member-types' ? memberTypeExtendedSchema : baseCreateSchema;
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({
          error: 'Validation failed',
          fields: parsed.error.flatten().fieldErrors,
        });
      }

      const row = await service.create(
        organizationId,
        entityType as any,
        parsed.data,
        req.user?.userId
      );

      res.status(201).json(row);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;

      const entityType = resolveEntityType(req, res);
      if (!entityType) return;

      // Validate input (partial update)
      const schema = entityType === 'member-types'
        ? memberTypeExtendedSchema.partial()
        : baseCreateSchema.partial();
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({
          error: 'Validation failed',
          fields: parsed.error.flatten().fieldErrors,
        });
      }

      const row = await service.update(
        organizationId,
        entityType as any,
        req.params.id,
        parsed.data,
        req.user?.userId
      );

      res.json(row);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  static async remove(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;

      const entityType = resolveEntityType(req, res);
      if (!entityType) return;

      const result = await service.delete(organizationId, entityType as any, req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  static async reorder(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;

      const entityType = resolveEntityType(req, res);
      if (!entityType) return;

      const parsed = reorderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({
          error: 'Validation failed',
          fields: parsed.error.flatten().fieldErrors,
        });
      }

      const result = await service.reorder(organizationId, entityType as any, parsed.data.items);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
}
