/**
 * Member Setting Controller (Module 3)
 *
 * Generic org-scoped CRUD for the seven member classification catalogs:
 * member types, member categories, occupations, education levels, nominee
 * types, relationship types, member statuses.
 *
 * Multi-tenancy rule: organization_id is ALWAYS derived from the verified JWT
 * (req.user.organizationId), never from the request body. Cross-tenant reads
 * by id are rejected with 403/404. Every write emits an audit row.
 *
 * `code` is normalized to UPPERCASE so the DB unique index
 * (organization_id, code) enforces case-insensitive uniqueness.
 */
import { Request, Response } from 'express';
import { eq, and, ne, or, ilike, asc, inArray, sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  memberTypes,
  memberCategories,
  occupations,
  educationLevels,
  nomineeTypes,
  relationshipTypes,
  memberStatuses,
  members,
  memberKycProfiles,
  memberFamily,
} from '../../db/schema';
import { buildAuditRow, writeAuditLog, computeDiff, splitDiffIntoSnapshots, SettingsActor } from '../utils/audit';

interface OrgUser {
  organizationId?: string;
  userId?: string;
  username?: string;
  role?: string;
}

function reqActor(req: Request & { user?: OrgUser }): SettingsActor {
  return {
    organizationId: req.user?.organizationId || '',
    userId: req.user?.userId,
    username: req.user?.username,
    role: req.user?.role,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

interface EntityConfig {
  table: any;
  /** Singular label used in audit details, e.g. "Member Type". */
  label: string;
  /** `member-types` carries the three financial extra fields. */
  hasExtras: boolean;
}

const REGISTRY: Record<string, EntityConfig> = {
  'member-types': { table: memberTypes, label: 'Member Type', hasExtras: true },
  'member-categories': { table: memberCategories, label: 'Member Category', hasExtras: false },
  'occupations': { table: occupations, label: 'Occupation', hasExtras: false },
  'education-levels': { table: educationLevels, label: 'Education Level', hasExtras: false },
  'nominee-types': { table: nomineeTypes, label: 'Nominee Type', hasExtras: false },
  'relationship-types': { table: relationshipTypes, label: 'Relationship Type', hasExtras: false },
  'member-statuses': { table: memberStatuses, label: 'Member Status', hasExtras: false },
};

function resolveEntity(entityType: string): EntityConfig | null {
  return REGISTRY[entityType] ?? null;
}

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const money = (v: unknown): string | null => {
  const n = toNum(v);
  return n === null ? null : String(n);
};

const sortOrderOf = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

const isActiveOf = (v: unknown): boolean => v !== false;

const normalize = (row: any, hasExtras: boolean) => ({
  id: row.id,
  organizationId: row.organizationId,
  code: row.code,
  name: row.name,
  nameNepali: row.nameNepali || null,
  description: row.description || null,
  isActive: !!row.isActive,
  sortOrder: row.sortOrder ?? 0,
  isSystem: !!row.isSystem,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  ...(hasExtras
    ? {
        minShareUnits: toNum(row.minShareUnits) ?? 0,
        entranceFee: toNum(row.entranceFee) ?? 0,
        shareValuePerUnit: toNum(row.shareValuePerUnit) ?? 0,
        isGroupType: !!row.isGroupType,
      }
    : {}),
});

const sortRows = (rows: any[], hasExtras: boolean) =>
  [...rows]
    .map((r) => normalize(r, hasExtras))
    .sort((a, b) => (a.sortOrder - b.sortOrder) || a.code.localeCompare(b.code));

// ---------------------------------------------------------------------------
// Usage count: number of member records currently referencing this entity.
// Matched by FK id (member_type_id / member_category_id / occupation_id /
// education_level_id / nominee_relation_id / nominee_type_id). member-statuses
// is not FK-linked (members.status is an independent workflow state) → 0.
// ---------------------------------------------------------------------------
async function getUsageCount(orgId: string, entityType: string, entityId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    if (entityType === 'member-types') {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(members)
        .where(and(eq(members.organizationId, orgId), eq(members.memberTypeId, entityId)));
      return row?.count ?? 0;
    }
    if (entityType === 'member-categories') {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(members)
        .where(and(eq(members.organizationId, orgId), eq(members.memberCategoryId, entityId)));
      return row?.count ?? 0;
    }
    if (entityType === 'occupations') {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(memberKycProfiles)
        .where(and(eq(memberKycProfiles.organizationId, orgId), eq(memberKycProfiles.occupationId, entityId)));
      return row?.count ?? 0;
    }
    if (entityType === 'education-levels') {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(memberKycProfiles)
        .where(and(eq(memberKycProfiles.organizationId, orgId), eq(memberKycProfiles.educationLevelId, entityId)));
      return row?.count ?? 0;
    }
    if (entityType === 'nominee-types') {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(memberFamily)
        .innerJoin(members, eq(memberFamily.memberId, members.id))
        .where(and(eq(members.organizationId, orgId), eq(memberFamily.nomineeTypeId, entityId)));
      return row?.count ?? 0;
    }
    if (entityType === 'relationship-types') {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(memberFamily)
        .innerJoin(members, eq(memberFamily.memberId, members.id))
        .where(and(eq(members.organizationId, orgId), eq(memberFamily.nomineeRelationId, entityId)));
      return row?.count ?? 0;
    }
  } catch {
    // Non-fatal: return 0 so list still renders
  }
  return 0;
}

/**
 * Case-insensitive duplicate check on code or name within the org.
 * `code` is already normalized UPPERCASE, so an exact eq match on code is a
 * case-insensitive uniqueness check (mirrors the (org, code) DB unique index).
 */
async function findDuplicate(entity: EntityConfig, organizationId: string, code: string, name: string, excludeId?: string) {
  const db = getDb();
  const scoped: any[] = [eq(entity.table.organizationId, organizationId)];
  if (excludeId) scoped.push(ne(entity.table.id, excludeId));

  const [dupCode] = await db.select({ id: entity.table.id }).from(entity.table)
    .where(and(...scoped, eq(entity.table.code, code)))
    .limit(1);
  if (dupCode) return dupCode;

  const [dupName] = await db.select({ id: entity.table.id }).from(entity.table)
    .where(and(...scoped, eq(entity.table.name, name)))
    .limit(1);
  return dupName ?? null;
}

export class MemberSettingController {
  static async getSettings(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const entity = resolveEntity(String(req.params.entityType));
      if (!entity) return res.status(400).json({ error: 'Unknown member settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const conditions: any[] = [eq(entity.table.organizationId, organizationId)];
      const search = String(req.query.search ?? '').trim();
      if (search) {
        conditions.push(or(ilike(entity.table.code, `%${search}%`), ilike(entity.table.name, `%${search}%`)));
      }
      const active = req.query.active as string | undefined;
      if (active === 'true' || active === 'false') {
        conditions.push(eq(entity.table.isActive, active === 'true'));
      }

      const rows = await db.select().from(entity.table).where(and(...conditions)).orderBy(asc(entity.table.sortOrder), asc(entity.table.name));
      const normalized = await Promise.all(
        rows.map(async (r) => ({
          ...normalize(r, entity.hasExtras),
          usageCount: await getUsageCount(organizationId, String(req.params.entityType), r.id),
        }))
      );
      res.json(normalized);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getSetting(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const entity = resolveEntity(String(req.params.entityType));
      if (!entity) return res.status(400).json({ error: 'Unknown member settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [row] = await db.select().from(entity.table)
        .where(and(eq(entity.table.id, req.params.id), eq(entity.table.organizationId, organizationId)))
        .limit(1);
      if (!row) return res.status(404).json({ error: `${entity.label} not found` });
      res.json({
        ...normalize(row, entity.hasExtras),
        usageCount: await getUsageCount(organizationId, String(req.params.entityType), row.id),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createSetting(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const entity = resolveEntity(String(req.params.entityType));
      if (!entity) return res.status(400).json({ error: 'Unknown member settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const code = String(body.code ?? '').trim().toUpperCase();
      const name = String(body.name ?? '').trim();
      if (!code || !name) return res.status(400).json({ error: 'Code and name are required.' });

      const dup = await findDuplicate(entity, organizationId, code, name);
      if (dup) {
        return res.status(409).json({ error: `${entity.label} with this code or name already exists.` });
      }

      const values: any = {
        organizationId,
        code,
        name,
        nameNepali: body.nameNepali ? String(body.nameNepali).trim() : null,
        description: body.description ? String(body.description).trim() : null,
        isActive: isActiveOf(body.isActive),
        sortOrder: sortOrderOf(body.sortOrder),
        createdBy: req.user?.userId ?? null,
      };
      if (entity.hasExtras) {
        values.minShareUnits = body.minShareUnits !== undefined ? Math.trunc(Number(body.minShareUnits) || 0) : 0;
        values.entranceFee = money(body.entranceFee ?? '0.00');
        values.shareValuePerUnit = money(body.shareValuePerUnit ?? '0.00');
        values.isGroupType = body.isGroupType === true;
      }

      const [row] = await db.insert(entity.table).values(values).returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Member Settings',
        `Create ${entity.label}`,
        `Created ${entity.label.toLowerCase()} "${row.name}" (${row.code})`,
      ));

      res.status(201).json(normalize(row, entity.hasExtras));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateSetting(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const entity = resolveEntity(String(req.params.entityType));
      if (!entity) return res.status(400).json({ error: 'Unknown member settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [existing] = await db.select().from(entity.table).where(eq(entity.table.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: `${entity.label} not found` });
      if (existing.organizationId !== organizationId) {
        return res.status(403).json({ error: `Not authorized to edit this ${entity.label.toLowerCase()}.` });
      }

      const code = body.code !== undefined ? String(body.code).trim().toUpperCase() : existing.code;
      const name = body.name !== undefined ? String(body.name).trim() : existing.name;
      const dup = await findDuplicate(entity, organizationId, code, name, existing.id);
      if (dup) {
        return res.status(409).json({ error: `${entity.label} with this code or name already exists.` });
      }

      // Snapshot BEFORE mutating so the audit diff is meaningful regardless of
      // whether the driver returns a fresh row or mutates in place.
      const before = normalize(existing, entity.hasExtras);

      const update: any = { updatedAt: new Date() };
      if (body.code !== undefined) update.code = code;
      if (body.name !== undefined) update.name = name;
      if (body.nameNepali !== undefined) update.nameNepali = body.nameNepali ? String(body.nameNepali).trim() : null;
      if (body.description !== undefined) update.description = body.description ? String(body.description).trim() : null;
      if (body.isActive !== undefined) update.isActive = body.isActive === true;
      if (body.sortOrder !== undefined) update.sortOrder = sortOrderOf(body.sortOrder);
      if (entity.hasExtras) {
        if (body.minShareUnits !== undefined) update.minShareUnits = Math.trunc(Number(body.minShareUnits) || 0);
        if (body.entranceFee !== undefined) update.entranceFee = money(body.entranceFee);
        if (body.shareValuePerUnit !== undefined) update.shareValuePerUnit = money(body.shareValuePerUnit);
        if (body.isGroupType !== undefined) update.isGroupType = body.isGroupType === true;
      }

      const [row] = await db.update(entity.table).set(update).where(eq(entity.table.id, existing.id)).returning();

      const diff = computeDiff(before, normalize(row, entity.hasExtras));
      const { oldValue, newValue } = splitDiffIntoSnapshots(diff);
      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Member Settings',
        `Update ${entity.label}`,
        `Updated ${entity.label.toLowerCase()} "${row.name}" (${row.code})`,
        { oldValue, newValue },
      ));

      res.json(normalize(row, entity.hasExtras));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteSetting(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const entity = resolveEntity(String(req.params.entityType));
      if (!entity) return res.status(400).json({ error: 'Unknown member settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [existing] = await db.select().from(entity.table).where(eq(entity.table.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: `${entity.label} not found` });
      if (existing.organizationId !== organizationId) {
        return res.status(403).json({ error: `Not authorized to delete this ${entity.label.toLowerCase()}.` });
      }
      if (existing.isSystem) {
        return res.status(400).json({ error: `System ${entity.label.toLowerCase()} records cannot be deleted.` });
      }

      await db.delete(entity.table).where(eq(entity.table.id, existing.id));

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Member Settings',
        `Delete ${entity.label}`,
        `Deleted ${entity.label.toLowerCase()} "${existing.name}" (${existing.code})`,
      ));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async reorderSettings(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const entity = resolveEntity(String(req.params.entityType));
      if (!entity) return res.status(400).json({ error: 'Unknown member settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const items: { id: string; sortOrder: number }[] = req.body?.items;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(422).json({ error: 'items array is required and must not be empty.' });
      }
      const ids = items.map((i) => i.id);
      if (new Set(ids).size !== ids.length) {
        return res.status(422).json({ error: 'Duplicate ids in reorder request.' });
      }

      // Verify all ids belong to this org
      const existing = await db
        .select({ id: entity.table.id })
        .from(entity.table)
        .where(and(eq(entity.table.organizationId, organizationId), inArray(entity.table.id, ids)));
      const foundIds = new Set(existing.map((r) => r.id));
      const unauthorized = ids.filter((id) => !foundIds.has(id));
      if (unauthorized.length > 0) {
        return res.status(403).json({ error: 'One or more records do not belong to this organization.' });
      }

      await db.transaction(async (tx) => {
        for (const item of items) {
          await tx
            .update(entity.table)
            .set({ sortOrder: item.sortOrder, updatedAt: new Date() } as any)
            .where(and(eq(entity.table.id, item.id), eq(entity.table.organizationId, organizationId)));
        }
      });

      res.json({ success: true, updated: items.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
