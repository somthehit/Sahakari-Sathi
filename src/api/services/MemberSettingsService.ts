/**
 * MemberSettingsService
 * Generic service that handles CRUD and reordering for all 7 member-settings
 * entity types through a single parameterised implementation.
 *
 * Entity types: member-types | member-categories | occupations |
 *               education-levels | nominee-types | relationship-types | member-statuses
 */
import { eq, and, or, ilike, asc, inArray, sql, ne } from 'drizzle-orm';
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type EntityType =
  | 'member-types'
  | 'member-categories'
  | 'occupations'
  | 'education-levels'
  | 'nominee-types'
  | 'relationship-types'
  | 'member-statuses';

export const VALID_ENTITY_TYPES: EntityType[] = [
  'member-types',
  'member-categories',
  'occupations',
  'education-levels',
  'nominee-types',
  'relationship-types',
  'member-statuses',
];

export function isValidEntityType(v: string): v is EntityType {
  return VALID_ENTITY_TYPES.includes(v as EntityType);
}

export interface ListOptions {
  search?: string;
  page?: number;
  limit?: number;
  active?: boolean | string;
}

export interface ReorderItem {
  id: string;
  sortOrder: number;
}

// ---------------------------------------------------------------------------
// Table resolver
// ---------------------------------------------------------------------------
type AnyMemberSettingTable =
  | typeof memberTypes
  | typeof memberCategories
  | typeof occupations
  | typeof educationLevels
  | typeof nomineeTypes
  | typeof relationshipTypes
  | typeof memberStatuses;

function getTable(entityType: EntityType): AnyMemberSettingTable {
  switch (entityType) {
    case 'member-types':        return memberTypes;
    case 'member-categories':   return memberCategories;
    case 'occupations':          return occupations;
    case 'education-levels':    return educationLevels;
    case 'nominee-types':       return nomineeTypes;
    case 'relationship-types':  return relationshipTypes;
    case 'member-statuses':     return memberStatuses;
  }
}

function requireDb() {
  const db = getDb();
  if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
  return db;
}

// ---------------------------------------------------------------------------
// Usage count helper
// Returns how many member records reference this lookup entity, matched by the
// FK id (member_type_id / member_category_id / occupation_id / education_level_id
// / nominee_relation_id / nominee_type_id). member-statuses is not FK-linked
// (members.status is an independent workflow state) → 0.
// ---------------------------------------------------------------------------
async function getUsageCount(orgId: string, entityType: EntityType, entityId: string): Promise<number> {
  const db = requireDb();

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

  return 0;
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

export class MemberSettingsService {

  async list(orgId: string, entityType: EntityType, opts: ListOptions) {
    const db = requireDb();
    const table = getTable(entityType);
    const { search, page = 1, limit = 50 } = opts;
    const offset = (page - 1) * limit;

    // Build WHERE
    const conditions: any[] = [eq(table.organizationId, orgId)];

    // active filter
    if (opts.active !== undefined && opts.active !== '' && opts.active !== 'all') {
      const activeVal = opts.active === true || opts.active === 'true';
      conditions.push(eq(table.isActive, activeVal));
    }

    // search filter
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(table.name, term),
          ilike(table.code, term),
          // nameNepali may be null; ilike handles null gracefully (returns false)
          ilike(table.nameNepali, term),
        )
      );
    }

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    const rows = await db
      .select()
      .from(table)
      .where(where)
      .orderBy(asc(table.sortOrder), asc(table.name))
      .limit(limit)
      .offset(offset);

    // Attach usageCount to each row
    const rowsWithUsage = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        usageCount: await getUsageCount(orgId, entityType, row.id),
      }))
    );

    // Total count
    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(table)
      .where(where);

    return {
      data: rowsWithUsage,
      total: countRow?.total ?? 0,
      page,
      limit,
    };
  }

  async getOne(orgId: string, entityType: EntityType, id: string) {
    const db = requireDb();
    const table = getTable(entityType);

    const [row] = await db
      .select()
      .from(table)
      .where(and(eq(table.id, id), eq(table.organizationId, orgId)))
      .limit(1);

    if (!row) return null;

    return {
      ...row,
      usageCount: await getUsageCount(orgId, entityType, id),
    };
  }

  async create(orgId: string, entityType: EntityType, data: Record<string, any>, userId?: string) {
    const db = requireDb();
    const table = getTable(entityType);

    // Normalize code to UPPERCASE
    const code = String(data.code || '').trim().toUpperCase();

    // Check unique (orgId, code) constraint
    const [existing] = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.organizationId, orgId), eq(table.code, code)))
      .limit(1);

    if (existing) {
      const err = new Error(`A ${entityType} with code '${code}' already exists in this organization.`);
      (err as any).status = 409;
      throw err;
    }

    const insertData: Record<string, any> = {
      organizationId: orgId,
      code,
      name: String(data.name || '').trim(),
      nameNepali: data.nameNepali || null,
      description: data.description || null,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      sortOrder: data.sortOrder !== undefined ? Number(data.sortOrder) : 0,
      isSystem: false,
      createdBy: userId || null,
      updatedBy: userId || null,
    };

    // Extended fields for member-types
    if (entityType === 'member-types') {
      insertData.minShareUnits = data.minShareUnits !== undefined ? Number(data.minShareUnits) : 0;
      insertData.entranceFee = data.entranceFee !== undefined ? String(data.entranceFee) : '0.00';
      insertData.shareValuePerUnit = data.shareValuePerUnit !== undefined ? String(data.shareValuePerUnit) : '0.00';
      insertData.isGroupType = data.isGroupType === true;
    }

    const [row] = await db.insert(table).values(insertData as any).returning();
    return { ...row, usageCount: 0 };
  }

  async update(orgId: string, entityType: EntityType, id: string, data: Record<string, any>, userId?: string) {
    const db = requireDb();
    const table = getTable(entityType);

    // Verify ownership
    const [existing] = await db
      .select()
      .from(table)
      .where(and(eq(table.id, id), eq(table.organizationId, orgId)))
      .limit(1);

    if (!existing) {
      const err = new Error('Record not found.');
      (err as any).status = 404;
      throw err;
    }

    const updateData: Record<string, any> = { updatedBy: userId || null, updatedAt: new Date() };

    if (data.code !== undefined) {
      const code = String(data.code).trim().toUpperCase();
      // Check for code conflicts (another record with same code)
      const [dup] = await db
        .select({ id: table.id })
        .from(table)
        .where(
          and(
            eq(table.organizationId, orgId),
            eq(table.code, code),
            ne(table.id, id)
          )
        )
        .limit(1);
      if (dup) {
        const err = new Error(`A ${entityType} with code '${code}' already exists in this organization.`);
        (err as any).status = 409;
        throw err;
      }
      updateData.code = code;
    }

    if (data.name !== undefined) updateData.name = String(data.name).trim();
    if (data.nameNepali !== undefined) updateData.nameNepali = data.nameNepali || null;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);
    if (data.sortOrder !== undefined) updateData.sortOrder = Number(data.sortOrder);

    // Extended fields for member-types
    if (entityType === 'member-types') {
      if (data.minShareUnits !== undefined) updateData.minShareUnits = Number(data.minShareUnits);
      if (data.entranceFee !== undefined) updateData.entranceFee = String(data.entranceFee);
      if (data.shareValuePerUnit !== undefined) updateData.shareValuePerUnit = String(data.shareValuePerUnit);
      if (data.isGroupType !== undefined) updateData.isGroupType = data.isGroupType === true;
    }

    const [row] = await db
      .update(table)
      .set(updateData as any)
      .where(eq(table.id, id))
      .returning();

    return {
      ...row,
      usageCount: await getUsageCount(orgId, entityType, id),
    };
  }

  async delete(orgId: string, entityType: EntityType, id: string) {
    const db = requireDb();
    const table = getTable(entityType);

    const [existing] = await db
      .select()
      .from(table)
      .where(and(eq(table.id, id), eq(table.organizationId, orgId)))
      .limit(1);

    if (!existing) {
      const err = new Error('Record not found.');
      (err as any).status = 404;
      throw err;
    }

    // System records cannot be deleted
    if ((existing as any).isSystem) {
      const err = new Error('System records cannot be deleted.');
      (err as any).status = 409;
      throw err;
    }

    // Usage count guard
    const usageCount = await getUsageCount(orgId, entityType, id);
    if (usageCount > 0) {
      const err = new Error(
        `Cannot delete: ${usageCount} member record${usageCount !== 1 ? 's' : ''} currently reference this ${entityType} entry.`
      );
      (err as any).status = 409;
      throw err;
    }

    await db.delete(table).where(eq(table.id, id));
    return { success: true };
  }

  async reorder(orgId: string, entityType: EntityType, items: ReorderItem[]) {
    const db = requireDb();
    const table = getTable(entityType);

    // Check for duplicate ids
    const ids = items.map((i) => i.id);
    if (new Set(ids).size !== ids.length) {
      const err = new Error('Duplicate ids in reorder request.');
      (err as any).status = 422;
      throw err;
    }

    // Verify all ids belong to this org
    const existingRows = await db
      .select({ id: table.id, organizationId: table.organizationId })
      .from(table)
      .where(and(eq(table.organizationId, orgId), inArray(table.id, ids)));

    const foundIds = new Set(existingRows.map((r) => r.id));
    const unauthorized = ids.filter((id) => !foundIds.has(id));
    if (unauthorized.length > 0) {
      const err = new Error('One or more records do not belong to this organization.');
      (err as any).status = 403;
      throw err;
    }

    // Execute all sort order updates in a transaction
    await db.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .update(table)
          .set({ sortOrder: item.sortOrder, updatedAt: new Date() } as any)
          .where(and(eq(table.id, item.id), eq(table.organizationId, orgId)));
      }
    });

    return { success: true, updated: items.length };
  }
}
