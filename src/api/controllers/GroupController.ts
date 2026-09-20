/**
 * Group Controller (Member Settings)
 *
 * Org-scoped CRUD for operational community groups (समूह). Unlike the seven
 * lookup catalogs, Groups carries a real entity shape: address, chairperson +
 * contact person, a recurring monthly meeting schedule, and a capacity cap.
 *
 * Multi-tenancy rule: organization_id is ALWAYS derived from the verified JWT
 * (req.user.organizationId), never from the request body. Cross-tenant reads
 * by id are rejected with 404/403. Every write emits an audit row.
 *
 * `code` is normalized to UPPERCASE so the DB unique index
 * (organization_id, code) enforces case-insensitive uniqueness.
 */
import { Request, Response } from 'express';
import { eq, and, ne, or, ilike, asc } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { groups } from '../../db/schema';
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

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Normalize a raw row to the wire shape; text columns null when empty. */
const normalize = (row: any) => ({
  id: row.id,
  organizationId: row.organizationId,
  code: row.code,
  name: row.name,
  nameNepali: row.nameNepali || null,
  address: row.address || null,
  chairpersonName: row.chairpersonName || null,
  chairpersonContact: row.chairpersonContact || null,
  chairpersonAddress: row.chairpersonAddress || null,
  contactPersonName: row.contactPersonName || null,
  contactPersonPhone: row.contactPersonPhone || null,
  meetingDayOfMonth: toNum(row.meetingDayOfMonth),
  meetingTime: row.meetingTime || null,
  meetingPlace: row.meetingPlace || null,
  maxMembers: toNum(row.maxMembers),
  isActive: !!row.isActive,
  isSystem: !!row.isSystem,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * Case-insensitive duplicate check on code or name within the org.
 * `code` is already normalized UPPERCASE, so an exact eq match on code is a
 * case-insensitive uniqueness check (mirrors the (org, code) DB unique index).
 */
async function findDuplicate(organizationId: string, code: string, name: string, excludeId?: string) {
  const db = getDb();
  if (!db) return null;
  const scoped: any[] = [eq(groups.organizationId, organizationId)];
  if (excludeId) scoped.push(ne(groups.id, excludeId));

  const [dupCode] = await db.select({ id: groups.id }).from(groups)
    .where(and(...scoped, eq(groups.code, code)))
    .limit(1);
  if (dupCode) return dupCode;

  const [dupName] = await db.select({ id: groups.id }).from(groups)
    .where(and(...scoped, eq(groups.name, name)))
    .limit(1);
  return dupName ?? null;
}

const boolOf = (v: unknown): boolean => v === true;

const intOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export class GroupController {
  static async listGroups(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const conditions: any[] = [eq(groups.organizationId, organizationId)];
      const search = String(req.query.search ?? '').trim();
      if (search) {
        conditions.push(or(ilike(groups.code, `%${search}%`), ilike(groups.name, `%${search}%`)));
      }
      const active = req.query.active as string | undefined;
      if (active === 'true' || active === 'false') {
        conditions.push(eq(groups.isActive, active === 'true'));
      }

      const rows = await db.select().from(groups).where(and(...conditions)).orderBy(asc(groups.name));
      res.json(rows.map(normalize));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getGroup(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [row] = await db.select().from(groups)
        .where(and(eq(groups.id, req.params.id), eq(groups.organizationId, organizationId)))
        .limit(1);
      if (!row) return res.status(404).json({ error: 'Group not found' });
      res.json(normalize(row));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createGroup(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const body = req.body;
      const code = String(body.code ?? '').trim().toUpperCase();
      const name = String(body.name ?? '').trim();
      if (!code || !name) return res.status(400).json({ error: 'Code and name are required.' });

      const dup = await findDuplicate(organizationId, code, name);
      if (dup) return res.status(409).json({ error: 'A group with this code or name already exists.' });

      const values: any = {
        organizationId,
        code,
        name,
        nameNepali: body.nameNepali ? String(body.nameNepali).trim() : null,
        address: body.address ? String(body.address).trim() : null,
        chairpersonName: body.chairpersonName ? String(body.chairpersonName).trim() : null,
        chairpersonContact: body.chairpersonContact ? String(body.chairpersonContact).trim() : null,
        chairpersonAddress: body.chairpersonAddress ? String(body.chairpersonAddress).trim() : null,
        contactPersonName: body.contactPersonName ? String(body.contactPersonName).trim() : null,
        contactPersonPhone: body.contactPersonPhone ? String(body.contactPersonPhone).trim() : null,
        meetingDayOfMonth: intOrNull(body.meetingDayOfMonth),
        meetingTime: body.meetingTime ? String(body.meetingTime).trim() : null,
        meetingPlace: body.meetingPlace ? String(body.meetingPlace).trim() : null,
        maxMembers: intOrNull(body.maxMembers),
        isActive: boolOf(body.isActive),
        createdBy: req.user?.userId ?? null,
      };

      const [row] = await db.insert(groups).values(values).returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Member Settings',
        'Create Group',
        `Created group "${row.name}" (${row.code})`,
      ));

      res.status(201).json(normalize(row));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateGroup(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const body = req.body;
      const [existing] = await db.select().from(groups).where(eq(groups.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Group not found' });
      if (existing.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Not authorized to edit this group.' });
      }

      const code = body.code !== undefined ? String(body.code).trim().toUpperCase() : existing.code;
      const name = body.name !== undefined ? String(body.name).trim() : existing.name;
      const dup = await findDuplicate(organizationId, code, name, existing.id);
      if (dup) return res.status(409).json({ error: 'A group with this code or name already exists.' });

      // Snapshot BEFORE mutating so the audit diff is meaningful regardless of
      // whether the driver returns a fresh row or mutates in place.
      const before = normalize(existing);

      const update: any = { updatedAt: new Date(), updatedBy: req.user?.userId ?? null };
      if (body.code !== undefined) update.code = code;
      if (body.name !== undefined) update.name = name;
      if (body.nameNepali !== undefined) update.nameNepali = body.nameNepali ? String(body.nameNepali).trim() : null;
      if (body.address !== undefined) update.address = body.address ? String(body.address).trim() : null;
      if (body.chairpersonName !== undefined) update.chairpersonName = body.chairpersonName ? String(body.chairpersonName).trim() : null;
      if (body.chairpersonContact !== undefined) update.chairpersonContact = body.chairpersonContact ? String(body.chairpersonContact).trim() : null;
      if (body.chairpersonAddress !== undefined) update.chairpersonAddress = body.chairpersonAddress ? String(body.chairpersonAddress).trim() : null;
      if (body.contactPersonName !== undefined) update.contactPersonName = body.contactPersonName ? String(body.contactPersonName).trim() : null;
      if (body.contactPersonPhone !== undefined) update.contactPersonPhone = body.contactPersonPhone ? String(body.contactPersonPhone).trim() : null;
      if (body.meetingDayOfMonth !== undefined) update.meetingDayOfMonth = intOrNull(body.meetingDayOfMonth);
      if (body.meetingTime !== undefined) update.meetingTime = body.meetingTime ? String(body.meetingTime).trim() : null;
      if (body.meetingPlace !== undefined) update.meetingPlace = body.meetingPlace ? String(body.meetingPlace).trim() : null;
      if (body.maxMembers !== undefined) update.maxMembers = intOrNull(body.maxMembers);
      if (body.isActive !== undefined) update.isActive = body.isActive === true;

      const [row] = await db.update(groups).set(update).where(eq(groups.id, existing.id)).returning();

      const diff = computeDiff(before, normalize(row));
      const { oldValue, newValue } = splitDiffIntoSnapshots(diff);
      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Member Settings',
        'Update Group',
        `Updated group "${row.name}" (${row.code})`,
        { oldValue, newValue },
      ));

      res.json(normalize(row));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteGroup(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [existing] = await db.select().from(groups).where(eq(groups.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Group not found' });
      if (existing.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Not authorized to delete this group.' });
      }
      if (existing.isSystem) {
        return res.status(400).json({ error: 'System groups cannot be deleted.' });
      }

      await db.delete(groups).where(eq(groups.id, existing.id));

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Member Settings',
        'Delete Group',
        `Deleted group "${existing.name}" (${existing.code})`,
      ));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
