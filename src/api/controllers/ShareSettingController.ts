/**
 * Share Setting Controller (SETUPS → Share Settings)
 *
 * Org-scoped CRUD for:
 *   share-classes, share-schemes, dividend-rules, certificate-formats
 * plus the org default-share-scheme selector.
 *
 * Multi-tenancy rule: organization_id is ALWAYS derived from the verified JWT
 * (req.user.organizationId), never from the request body. Cross-tenant reads
 * by id are rejected with 403/404. Every write emits an audit row.
 *
 * `code` is normalized to UPPERCASE so the DB unique index
 * (organization_id, code) enforces case-insensitive uniqueness.
 *
 * Architectural decision: share_schemes is the canonical financial source for
 * share product/pricing/opening. Share Classes, Dividend Rules and Certificate
 * Formats are supporting catalogs.
 */
import { Request, Response } from 'express';
import { eq, and, ne, or, ilike, asc, inArray } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  shareClasses,
  shareSchemes,
  dividendRules,
  shareCertificateFormats,
  shareHoldings,
  shareTransactions,
  shareTypes,
  organizationProfiles,
  chartOfAccounts,
} from '../../db/schema';
import { buildAuditRow, writeAuditLog, computeDiff, splitDiffIntoSnapshots, SettingsActor } from '../utils/audit';
import { AuthService } from '../services/AuthService';

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

const money = (v: unknown): string | null => {
  const n = toNum(v);
  return n === null ? null : String(n);
};

const sortOrderOf = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

const isActiveOf = (v: unknown): boolean => v !== false;

interface EntityConfig {
  table: any;
  /** Singular label used in audit details, e.g. "Share Scheme". */
  label: string;
  kind: 'catalog' | 'scheme' | 'dividend' | 'certificate';
}

const REGISTRY: Record<string, EntityConfig> = {
  'share-classes': { table: shareClasses, label: 'Share Class', kind: 'catalog' },
  'share-schemes': { table: shareSchemes, label: 'Share Scheme', kind: 'scheme' },
  'dividend-rules': { table: dividendRules, label: 'Dividend Rule', kind: 'dividend' },
  'certificate-formats': { table: shareCertificateFormats, label: 'Share Certificate Format', kind: 'certificate' },
};

function resolveEntity(entityType: string): EntityConfig | null {
  return REGISTRY[entityType] ?? null;
}

const parseFields = (fieldsJson: string | null): string[] => {
  if (!fieldsJson) return [];
  try {
    const parsed = JSON.parse(fieldsJson);
    return Array.isArray(parsed) ? parsed.map((f: any) => String(f)) : [];
  } catch {
    return [];
  }
};

const parseConfigJson = (json: string | null): Record<string, any> | null => {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const normalize = (row: any, kind: string) => {
  const base: Record<string, any> = {
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
  };
  if (kind === 'catalog') {
    base.shareType = row.shareType ?? 'ORDINARY';
    base.targetMemberType = row.targetMemberType ?? 'ALL';
    base.parValue = toNum(row.parValue) ?? 100;
    base.minKittaPerPurchase = toNum(row.minKittaPerPurchase) ?? 10;
    base.maxKittaPerMember = row.maxKittaPerMember != null ? (toNum(row.maxKittaPerMember) ?? null) : null;
    base.glAccountId = row.glAccountId ?? null;
    base.isDividendEligible = row.isDividendEligible !== false;
    base.maxDividendRatePct = row.maxDividendRatePct != null ? (toNum(row.maxDividendRatePct) ?? null) : null;
  }
  if (kind === 'scheme') {
    base.shareClassId = row.shareClassId ?? null;
    base.shareTypeId = row.shareTypeId ?? null;
    base.shareValuePerUnit = toNum(row.shareValuePerUnit) ?? 0;
    base.minOpenUnits = toNum(row.minOpenUnits) ?? 1;
    base.maxUnits = row.maxUnits != null ? (toNum(row.maxUnits) ?? null) : null;
    base.isTransferable = row.isTransferable !== false;
    base.dividendRate = toNum(row.dividendRate) ?? 0;
    base.minOpeningAmount = toNum(row.minOpeningAmount) ?? 0;
    base.minimumOpeningAmount = base.minOpeningAmount;
  }
  if (kind === 'dividend') {
    base.taxWithholdingPercent = toNum(row.taxWithholdingPercent) ?? 0;
    base.targetDividendPercent = toNum(row.targetDividendPercent) ?? 0;
    base.bonusShareRatio = row.bonusShareRatio ?? '1:10';
    base.dividendPolicy = row.dividendPolicy || null;
    base.fiscalYear = row.fiscalYear || null;
    base.approvalStatus = row.approvalStatus ?? 'draft';
    base.distributionMode = row.distributionMode ?? 'cash';
    base.minimumHoldingPeriodMonths = toNum(row.minimumHoldingPeriodMonths) ?? 0;
  }
  if (kind === 'certificate') {
    base.certificatePrefix = row.certificatePrefix ?? 'SC-';
    base.startingNumber = toNum(row.startingNumber) ?? 1;
    base.includeLogo = row.includeLogo !== false;
    base.headerText = row.headerText || null;
    base.footerText = row.footerText || null;
    base.fields = parseFields(row.fieldsJson);
    base.configJson = parseConfigJson(row.configJson);
  }
  return base;
};

const sortRows = (rows: any[], kind: string) =>
  [...rows]
    .map((r) => normalize(r, kind))
    .sort((a, b) => (a.sortOrder - b.sortOrder) || a.code.localeCompare(b.code));

// ---------------------------------------------------------------------------
// Usage counts (referenced-row safety for safe-delete)
// ---------------------------------------------------------------------------
async function getUsageCount(entity: EntityConfig, organizationId: string, entityId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    if (entity.kind === 'scheme') {
      // Holdings opened under this scheme.
      const rows = await db.select({ id: shareHoldings.id })
        .from(shareHoldings)
        .where(and(eq(shareHoldings.organizationId, organizationId), eq(shareHoldings.shareSchemeId, entityId)));
      return rows.length;
    }
    if (entity.kind === 'catalog') {
      // Schemes referencing this class.
      const rows = await db.select({ id: shareSchemes.id })
        .from(shareSchemes)
        .where(and(eq(shareSchemes.organizationId, organizationId), eq(shareSchemes.shareClassId, entityId)));
      return rows.length;
    }
  } catch {
    // Non-fatal: return 0 so list still renders.
  }
  return 0;
}

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

/** Resolve a cross-table FK reference within the same org. */
async function assertRefInOrg(organizationId: string, table: any, id: string | null | undefined, message: string) {
  if (!id) return;
  const db = getDb();
  const [row] = await db.select({ id: table.id, organizationId: table.organizationId }).from(table)
    .where(eq(table.id, id)).limit(1);
  if (!row) throw Object.assign(new Error(message), { status: 400 });
  if (String(row.organizationId) !== String(organizationId)) {
    throw Object.assign(new Error(message), { status: 403 });
  }
}

// ---------------------------------------------------------------------------
// Scheme extras → DB values
// ---------------------------------------------------------------------------
function classValues(body: Record<string, any>) {
  const values: Record<string, any> = {};
  // Accept shareTypeId / targetMemberTypeId (UUIDs from frontend)
  // and pass them through — the frontend sends the share type code
  // (e.g. "ORDINARY") as the select value, so we store that directly.
  if (body.shareTypeId !== undefined) {
    values.shareType = body.shareTypeId || 'ORDINARY';
  }
  if (body.targetMemberTypeId !== undefined) {
    values.targetMemberType = body.targetMemberTypeId || 'INDIVIDUAL';
  }
  if (body.parValue !== undefined) values.parValue = money(body.parValue ?? '100.00');
  if (body.minKittaPerPurchase !== undefined) values.minKittaPerPurchase = Math.max(1, Math.trunc(Number(body.minKittaPerPurchase) || 10));
  if (body.maxKittaPerMember !== undefined) values.maxKittaPerMember = body.maxKittaPerMember ? Math.max(1, Math.trunc(Number(body.maxKittaPerMember))) : null;
  if (body.glAccountId !== undefined) values.glAccountId = body.glAccountId || null;
  if (body.isDividendEligible !== undefined) values.isDividendEligible = body.isDividendEligible === true;
  if (body.maxDividendRatePct !== undefined) values.maxDividendRatePct = body.maxDividendRatePct != null && body.maxDividendRatePct !== '' ? money(body.maxDividendRatePct) : null;
  return values;
}

function schemeValues(body: Record<string, any>, existing: any = {}) {
  const values: Record<string, any> = {};
  if (body.shareClassId !== undefined) values.shareClassId = body.shareClassId || null;
  if (body.shareTypeId !== undefined) values.shareTypeId = body.shareTypeId || null;
  if (body.shareValuePerUnit !== undefined) values.shareValuePerUnit = money(body.shareValuePerUnit);
  if (body.minOpenUnits !== undefined) values.minOpenUnits = Math.trunc(Number(body.minOpenUnits) || 1);
  if (body.maxUnits !== undefined) values.maxUnits = body.maxUnits ? Math.trunc(Number(body.maxUnits)) : null;
  if (body.isTransferable !== undefined) values.isTransferable = body.isTransferable === true;
  if (body.dividendRate !== undefined) values.dividendRate = money(body.dividendRate);
  if (body.minOpeningAmount !== undefined || body.minimumOpeningAmount !== undefined) {
    values.minOpeningAmount = money(body.minOpeningAmount ?? body.minimumOpeningAmount ?? '0.00');
  }
  return values;
}

function dividendValues(body: Record<string, any>) {
  const values: Record<string, any> = {};
  if (body.taxWithholdingPercent !== undefined) values.taxWithholdingPercent = money(body.taxWithholdingPercent);
  if (body.targetDividendPercent !== undefined) values.targetDividendPercent = money(body.targetDividendPercent);
  if (body.bonusShareRatio !== undefined) values.bonusShareRatio = String(body.bonusShareRatio).trim() || '1:10';
  if (body.dividendPolicy !== undefined) values.dividendPolicy = body.dividendPolicy ? String(body.dividendPolicy).trim() : null;
  if (body.fiscalYear !== undefined) values.fiscalYear = body.fiscalYear ? String(body.fiscalYear).trim() : null;
  if (body.approvalStatus !== undefined) values.approvalStatus = body.approvalStatus === 'approved' ? 'approved' : 'draft';
  if (body.distributionMode !== undefined) {
    values.distributionMode = ['cash', 'bonus_share', 'member_choice'].includes(body.distributionMode) ? body.distributionMode : 'cash';
  }
  if (body.minimumHoldingPeriodMonths !== undefined) {
    values.minimumHoldingPeriodMonths = Math.max(0, Math.trunc(Number(body.minimumHoldingPeriodMonths) || 0));
  }
  return values;
}

function certificateValues(body: Record<string, any>, existing: any = {}) {
  const values: Record<string, any> = {};
  if (body.certificatePrefix !== undefined) values.certificatePrefix = String(body.certificatePrefix).trim() || 'SC-';
  if (body.startingNumber !== undefined) values.startingNumber = Math.trunc(Number(body.startingNumber) || 1);
  if (body.includeLogo !== undefined) values.includeLogo = body.includeLogo === true;
  if (body.headerText !== undefined) values.headerText = body.headerText ? String(body.headerText).trim() : null;
  if (body.footerText !== undefined) values.footerText = body.footerText ? String(body.footerText).trim() : null;
  if (body.fields !== undefined) {
    values.fieldsJson = Array.isArray(body.fields) ? JSON.stringify(body.fields.map((f: any) => String(f))) : null;
  }
  if (body.configJson !== undefined) {
    values.configJson = body.configJson == null ? null : JSON.stringify(body.configJson);
  }
  return values;
}

export class ShareSettingController {
  static async getSettings(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const entity = resolveEntity(String(req.params.entityType));
      if (!entity) return res.status(400).json({ error: 'Unknown share settings entity type.' });

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
        rows.map(async (r: any) => ({
          ...normalize(r, entity.kind),
          usageCount: await getUsageCount(entity, organizationId, r.id),
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
      if (!entity) return res.status(400).json({ error: 'Unknown share settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [row] = await db.select().from(entity.table)
        .where(and(eq(entity.table.id, req.params.id), eq(entity.table.organizationId, organizationId)))
        .limit(1);
      if (!row) return res.status(404).json({ error: `${entity.label} not found` });
      res.json({
        ...normalize(row, entity.kind),
        usageCount: await getUsageCount(entity, organizationId, row.id),
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
      if (!entity) return res.status(400).json({ error: 'Unknown share settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const code = String(body.code ?? '').trim().toUpperCase();
      const name = String(body.name ?? '').trim();
      if (!code || !name) return res.status(400).json({ error: 'Code and name are required.' });

      const dup = await findDuplicate(entity, organizationId, code, name);
      if (dup) {
        return res.status(409).json({ error: `A ${entity.label} with this code already exists.` });
      }

      const values: Record<string, any> = {
        organizationId,
        code,
        name,
        nameNepali: body.nameNepali ? String(body.nameNepali).trim() : null,
        description: body.description ? String(body.description).trim() : null,
        isActive: isActiveOf(body.isActive),
        sortOrder: sortOrderOf(body.sortOrder),
        createdBy: req.user?.userId ?? null,
      };
      if (entity.kind === 'catalog') {
        if (body.glAccountId) {
          await assertRefInOrg(organizationId, chartOfAccounts, body.glAccountId, 'GL Account does not belong to the current organization.');
        }
        Object.assign(values, classValues(body));
      } else if (entity.kind === 'scheme') {
        await assertRefInOrg(organizationId, shareClasses, body.shareClassId, 'Share class does not belong to the current organization.');
        await assertRefInOrg(organizationId, shareTypes, body.shareTypeId, 'Share type does not belong to the current organization.');
        Object.assign(values, schemeValues(body));
      } else if (entity.kind === 'dividend') {
        Object.assign(values, dividendValues(body));
      } else if (entity.kind === 'certificate') {
        delete values.nameNepali;
        Object.assign(values, certificateValues(body));
      }

      const [row] = await db.insert(entity.table).values(values).returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Share Settings',
        `Create ${entity.label}`,
        `Created ${entity.label.toLowerCase()} "${row.name}" (${row.code})`,
      ));

      res.status(201).json({ ...normalize(row, entity.kind), usageCount: 0 });
    } catch (error: any) {
      const status = error?.status || 500;
      res.status(status).json({ error: error.message });
    }
  }

  static async updateSetting(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const entity = resolveEntity(String(req.params.entityType));
      if (!entity) return res.status(400).json({ error: 'Unknown share settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [existing] = await db.select().from(entity.table).where(eq(entity.table.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: `${entity.label} not found` });
      if (String(existing.organizationId) !== String(organizationId)) {
        return res.status(403).json({ error: `Not authorized to edit this ${entity.label.toLowerCase()}.` });
      }

      const code = body.code !== undefined ? String(body.code).trim().toUpperCase() : existing.code;
      const name = body.name !== undefined ? String(body.name).trim() : existing.name;
      const dup = await findDuplicate(entity, organizationId, code, name, existing.id);
      if (dup) {
        return res.status(409).json({ error: `A ${entity.label} with this code already exists.` });
      }

      // Snapshot BEFORE mutating so the audit diff is meaningful.
      const before = normalize(existing, entity.kind);

      const update: Record<string, any> = { updatedAt: new Date() };
      if (body.code !== undefined) update.code = code;
      if (body.name !== undefined) update.name = name;
      if (entity.kind !== 'certificate' && body.nameNepali !== undefined) update.nameNepali = body.nameNepali ? String(body.nameNepali).trim() : null;
      if (body.description !== undefined) update.description = body.description ? String(body.description).trim() : null;
      if (body.isActive !== undefined) update.isActive = body.isActive === true;
      if (body.sortOrder !== undefined) update.sortOrder = sortOrderOf(body.sortOrder);
      if (entity.kind === 'catalog') {
        if (body.glAccountId !== undefined) {
          await assertRefInOrg(organizationId, chartOfAccounts, body.glAccountId || null, 'GL Account does not belong to the current organization.');
        }
        Object.assign(update, classValues(body));
      } else if (entity.kind === 'scheme') {
        if (body.shareClassId !== undefined) {
          await assertRefInOrg(organizationId, shareClasses, body.shareClassId || null, 'Share class does not belong to the current organization.');
        }
        if (body.shareTypeId !== undefined) {
          await assertRefInOrg(organizationId, shareTypes, body.shareTypeId || null, 'Share type does not belong to the current organization.');
        }
        Object.assign(update, schemeValues(body));
      } else if (entity.kind === 'dividend') {
        Object.assign(update, dividendValues(body));
      } else if (entity.kind === 'certificate') {
        Object.assign(update, certificateValues(body));
      }

      const [row] = await db.update(entity.table).set(update).where(eq(entity.table.id, existing.id)).returning();

      const diff = computeDiff(before, normalize(row, entity.kind));
      const { oldValue, newValue } = splitDiffIntoSnapshots(diff);
      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Share Settings',
        `Update ${entity.label}`,
        `Updated ${entity.label.toLowerCase()} "${row.name}" (${row.code})`,
        { oldValue, newValue },
      ));

      res.json({
        ...normalize(row, entity.kind),
        usageCount: await getUsageCount(entity, organizationId, row.id),
      });
    } catch (error: any) {
      const status = error?.status || 500;
      res.status(status).json({ error: error.message });
    }
  }

  static async deleteSetting(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const entity = resolveEntity(String(req.params.entityType));
      if (!entity) return res.status(400).json({ error: 'Unknown share settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [existing] = await db.select().from(entity.table).where(eq(entity.table.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: `${entity.label} not found` });
      if (String(existing.organizationId) !== String(organizationId)) {
        return res.status(403).json({ error: `Not authorized to delete this ${entity.label.toLowerCase()}.` });
      }
      if (existing.isSystem) {
        return res.status(400).json({ error: `System ${entity.label.toLowerCase()} records cannot be deleted.` });
      }

      if (entity.kind === 'scheme') {
        const inUse = await getUsageCount(entity, organizationId, existing.id);
        if (inUse > 0) {
          return res.status(400).json({ error: 'This Share Scheme cannot be deleted because it is already in use.' });
        }
        // Also block if it is the org's configured default scheme.
        const [profile] = await db.select({ defaultShareSchemeId: organizationProfiles.defaultShareSchemeId })
          .from(organizationProfiles)
          .where(eq(organizationProfiles.organizationId, organizationId)).limit(1);
        if (profile?.defaultShareSchemeId && String(profile.defaultShareSchemeId) === String(existing.id)) {
          return res.status(400).json({ error: 'This Share Scheme cannot be deleted because it is already in use.' });
        }
      } else if (entity.kind === 'catalog') {
        const inUse = await getUsageCount(entity, organizationId, existing.id);
        if (inUse > 0) {
          return res.status(400).json({ error: 'This Share Class cannot be deleted because it is already in use.' });
        }
      } else if (entity.kind === 'certificate') {
        // Also block if it is the org's configured default certificate format.
        const [profile] = await db.select({ defaultCertificateFormatId: organizationProfiles.defaultCertificateFormatId })
          .from(organizationProfiles)
          .where(eq(organizationProfiles.organizationId, organizationId)).limit(1);
        if (profile?.defaultCertificateFormatId && String(profile.defaultCertificateFormatId) === String(existing.id)) {
          return res.status(400).json({ error: 'This Share Certificate Format cannot be deleted because it is the organization default.' });
        }
      }

      await db.delete(entity.table).where(eq(entity.table.id, existing.id));

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Share Settings',
        `Delete ${entity.label}`,
        `Deleted ${entity.label.toLowerCase()} "${existing.name}" (${existing.code})`,
      ));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================================
  // Org default share scheme
  // ============================================================

  /** GET /shares/settings/default-scheme */
  static async getDefaultScheme(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [profile] = await db.select({ defaultShareSchemeId: organizationProfiles.defaultShareSchemeId })
        .from(organizationProfiles)
        .where(eq(organizationProfiles.organizationId, organizationId)).limit(1);

      const defaultShareSchemeId = profile?.defaultShareSchemeId ?? null;
      let scheme = null;
      if (defaultShareSchemeId) {
        const [row] = await db.select().from(shareSchemes)
          .where(and(eq(shareSchemes.id, defaultShareSchemeId), eq(shareSchemes.organizationId, organizationId)))
          .limit(1);
        scheme = row ? normalize(row, 'scheme') : null;
      }
      res.json({ defaultShareSchemeId, scheme });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** PUT /shares/settings/default-scheme */
  static async setDefaultScheme(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const next = req.body?.defaultShareSchemeId ?? null;

      if (next) {
        const [scheme] = await db.select().from(shareSchemes).where(eq(shareSchemes.id, next)).limit(1);
        if (!scheme) return res.status(404).json({ error: 'Share Scheme not found.' });
        if (String(scheme.organizationId) !== String(organizationId)) {
          return res.status(403).json({ error: 'Share Scheme does not belong to the current organization.' });
        }
        if (scheme.isActive === false) {
          return res.status(400).json({ error: 'Selected Share Scheme is inactive.' });
        }
      }

      // Persist on the org profile (routed to organization_profiles).
      const authService = new AuthService();
      const organization = await authService.updateOrganization(organizationId, { defaultShareSchemeId: next });

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Share Settings',
        next ? 'Set Default Share Scheme' : 'Clear Default Share Scheme',
        next ? `Default share scheme set to ${next}` : 'Default share scheme cleared',
      ));

      res.json({ defaultShareSchemeId: next, organization });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================================
  // Org default share certificate format
  // ============================================================

  /** GET /shares/settings/default-certificate-format */
  static async getDefaultCertificateFormat(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [profile] = await db.select({ defaultCertificateFormatId: organizationProfiles.defaultCertificateFormatId })
        .from(organizationProfiles)
        .where(eq(organizationProfiles.organizationId, organizationId)).limit(1);

      const defaultCertificateFormatId = profile?.defaultCertificateFormatId ?? null;
      let format = null;
      if (defaultCertificateFormatId) {
        const [row] = await db.select().from(shareCertificateFormats)
          .where(and(eq(shareCertificateFormats.id, defaultCertificateFormatId), eq(shareCertificateFormats.organizationId, organizationId)))
          .limit(1);
        format = row ? normalize(row, 'certificate') : null;
      }
      res.json({ defaultCertificateFormatId, format });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** PUT /shares/settings/default-certificate-format */
  static async setDefaultCertificateFormat(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const next = req.body?.defaultCertificateFormatId ?? null;

      if (next) {
        const [format] = await db.select().from(shareCertificateFormats).where(eq(shareCertificateFormats.id, next)).limit(1);
        if (!format) return res.status(404).json({ error: 'Share Certificate Format not found.' });
        if (String(format.organizationId) !== String(organizationId)) {
          return res.status(403).json({ error: 'Share Certificate Format does not belong to the current organization.' });
        }
        if (format.isActive === false) {
          return res.status(400).json({ error: 'Selected Share Certificate Format is inactive.' });
        }
      }

      // Persist on the org profile (routed to organization_profiles).
      const authService = new AuthService();
      const organization = await authService.updateOrganization(organizationId, { defaultCertificateFormatId: next });

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Share Settings',
        next ? 'Set Default Share Certificate Format' : 'Clear Default Share Certificate Format',
        next ? `Default share certificate format set to ${next}` : 'Default share certificate format cleared',
      ));

      res.json({ defaultCertificateFormatId: next, organization });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================================
  // Singular Share Certificate Format (embedded designer save/load)
  //   The SETUPS → Share Settings → Share Certificate Format page is a
  //   singular setup (one saved design per organization), wired to the
  //   ShareCertificateDesigner in embedded mode. The org's default
  //   certificate format row is the single saved design — reusing the
  //   default_certificate_format_id pointer means the Share page prints
  //   exactly what the admin designed here.
  // ============================================================

  /** GET /share-settings/certificate-format — org's saved design (or null). */
  static async getCertificateFormat(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [profile] = await db.select({ defaultCertificateFormatId: organizationProfiles.defaultCertificateFormatId })
        .from(organizationProfiles)
        .where(eq(organizationProfiles.organizationId, organizationId)).limit(1);

      let config: Record<string, any> | null = null;
      if (profile?.defaultCertificateFormatId) {
        const [row] = await db.select().from(shareCertificateFormats)
          .where(and(eq(shareCertificateFormats.id, profile.defaultCertificateFormatId), eq(shareCertificateFormats.organizationId, organizationId)))
          .limit(1);
        if (row) config = parseConfigJson(row.configJson);
      }
      res.json({ config });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** PUT /share-settings/certificate-format — upsert the org's single design. */
  static async saveCertificateFormat(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const config = req.body;
      if (!config || typeof config !== 'object' || Array.isArray(config) || Object.keys(config).length === 0) {
        return res.status(400).json({ error: 'Certificate config must be a non-empty object.' });
      }
      const json = JSON.stringify(config);
      if (json.length > 4_000_000) {
        return res.status(413).json({ error: 'Certificate design is too large.' });
      }

      // Resolve the org's default format row (the single saved design). If the
      // pointer is stale, fall through and reuse/recreate the DEFAULT row.
      const [profile] = await db.select({ defaultCertificateFormatId: organizationProfiles.defaultCertificateFormatId })
        .from(organizationProfiles)
        .where(eq(organizationProfiles.organizationId, organizationId)).limit(1);

      let formatId = profile?.defaultCertificateFormatId ?? null;
      if (formatId) {
        const [row] = await db.select({ id: shareCertificateFormats.id }).from(shareCertificateFormats)
          .where(and(eq(shareCertificateFormats.id, formatId), eq(shareCertificateFormats.organizationId, organizationId)))
          .limit(1);
        if (!row) formatId = null;
      }

      if (formatId) {
        await db.update(shareCertificateFormats)
          .set({ configJson: json, updatedAt: new Date(), updatedBy: req.user?.userId ?? null })
          .where(and(eq(shareCertificateFormats.id, formatId), eq(shareCertificateFormats.organizationId, organizationId)));
      } else {
        const [existingDefault] = await db.select({ id: shareCertificateFormats.id }).from(shareCertificateFormats)
          .where(and(eq(shareCertificateFormats.organizationId, organizationId), eq(shareCertificateFormats.code, 'DEFAULT')))
          .limit(1);
        if (existingDefault) {
          formatId = existingDefault.id;
          await db.update(shareCertificateFormats)
            .set({ configJson: json, isActive: true, updatedAt: new Date(), updatedBy: req.user?.userId ?? null })
            .where(and(eq(shareCertificateFormats.id, formatId), eq(shareCertificateFormats.organizationId, organizationId)));
        } else {
          const [created] = await db.insert(shareCertificateFormats).values({
            organizationId,
            code: 'DEFAULT',
            name: 'Default Share Certificate',
            isActive: true,
            configJson: json,
            createdBy: req.user?.userId ?? null,
          }).returning();
          formatId = created.id;
        }
        const authService = new AuthService();
        await authService.updateOrganization(organizationId, { defaultCertificateFormatId: formatId });
      }

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Share Settings',
        'Save Share Certificate Format',
        'Share certificate design saved',
      ));

      res.json({ success: true, defaultCertificateFormatId: formatId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** Reorder helper (used by the frontend drag-sort like member-settings). */
  static async reorderSettings(req: Request & { user?: OrgUser }, res: Response) {    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const entity = resolveEntity(String(req.params.entityType));
      if (!entity) return res.status(400).json({ error: 'Unknown share settings entity type.' });

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

      const existing = await db
        .select({ id: entity.table.id })
        .from(entity.table)
        .where(and(eq(entity.table.organizationId, organizationId), inArray(entity.table.id, ids)));
      const foundIds = new Set(existing.map((r: any) => r.id));
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
