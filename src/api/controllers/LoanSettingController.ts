/**
 * Loan Setting Controller (SETUPS → Loan Settings — Module 6)
 *
 * Org-scoped CRUD for:
 *   loan-products, loan-categories, collateral-types
 * plus two singular org settings:
 *   guarantor-settings, emi-schedule-settings
 *
 * Multi-tenancy rule: organization_id is ALWAYS derived from the verified JWT
 * (req.user.organizationId), never from the request body. Cross-tenant reads
 * by id are rejected with 403/404. Every write emits an audit row.
 *
 * Loan Products are the canonical product config:
 *   - interest_rate is a "current" snapshot; every rate change also writes a
 *     closed+open pair into loan_product_interest_rates (time-series §5).
 *   - category_id links the product to the flat loan_categories catalog
 *     (replaces the legacy free-text product_type, retained for backward
 *     compatibility and defaulted to 'general').
 *   - eligibility links to Module 3 member_types / member_categories stored
 *     in the two join tables; empty eligibility = open to all.
 */
import { Request, Response } from 'express';
import { eq, and, ne, asc, count, isNull } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  loanProducts,
  loanCategories,
  loanCollateralTypes,
  guarantorSettings,
  guarantorTypes,
  loanProductGuarantorRules,
  emiScheduleSettings,
  loanProductInterestRates,
  loanProductEligibleMemberTypes,
  loanProductEligibleMemberCategories,
  loanAccounts,
  loanCollaterals,
  memberTypes,
  memberCategories,
  LOAN_INTEREST_METHODS,
} from '../../db/schema';
import { buildAuditRow, writeAuditLog, computeDiff, splitDiffIntoSnapshots, SettingsActor } from '../utils/audit';
import { DateConverter } from '../../utils/DateConverter';

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

const intOf = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const boolOf = (v: unknown): boolean => v === true;

const sortOrderOf = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

const isActiveOf = (v: unknown): boolean => v !== false;

interface EntityConfig {
  table: any;
  label: string;
  kind: 'category' | 'collateral' | 'product' | 'guarantor_type';
}

const REGISTRY: Record<string, EntityConfig> = {
  'loan-categories': { table: loanCategories, label: 'Loan Category', kind: 'category' },
  'collateral-types': { table: loanCollateralTypes, label: 'Collateral Type', kind: 'collateral' },
  'loan-products': { table: loanProducts, label: 'Loan Product', kind: 'product' },
  'guarantor-types': { table: guarantorTypes, label: 'Guarantor Type', kind: 'guarantor_type' },
};

const eventName = (kind: string, action: 'created' | 'updated' | 'deleted'): string => {
  if (kind === 'product') return `loan_product_${action}`;
  if (kind === 'collateral') return `loan_collateral_type_${action}`;
  if (kind === 'guarantor_type') return `loan_guarantor_type_${action}`;
  return `loan_category_${action}`;
};

function resolveEntity(entityType: string): EntityConfig | null {
  return REGISTRY[entityType] ?? null;
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
// Usage counts (referenced-row safety for safe-delete)
// ---------------------------------------------------------------------------
async function getUsageCount(entity: EntityConfig, organizationId: string, entityId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    if (entity.kind === 'product') {
      const rows = await db.select({ id: loanAccounts.id })
        .from(loanAccounts)
        .where(and(eq(loanAccounts.organizationId, organizationId), eq(loanAccounts.loanProductId, entityId)));
      return rows.length;
    }
    if (entity.kind === 'category') {
      const rows = await db.select({ id: loanProducts.id })
        .from(loanProducts)
        .where(and(eq(loanProducts.organizationId, organizationId), eq(loanProducts.categoryId, entityId)));
      return rows.length;
    }
    if (entity.kind === 'collateral') {
      const rows = await db.select({ id: loanCollaterals.id })
        .from(loanCollaterals)
        .where(and(eq(loanCollaterals.organizationId, organizationId), eq(loanCollaterals.collateralTypeId, entityId)));
      return rows.length;
    }
    if (entity.kind === 'guarantor_type') {
      const rows = await db.select({ id: loanProductGuarantorRules.id })
        .from(loanProductGuarantorRules)
        .where(and(eq(loanProductGuarantorRules.organizationId, organizationId), eq(loanProductGuarantorRules.guarantorTypeId, entityId)));
      return rows.length;
    }
  } catch {
    // Non-fatal: return 0 so list still renders.
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Product extras (categories, eligibility, rate history, usage)
// ---------------------------------------------------------------------------
interface ProductExtras {
  categories: Map<string, { code: string; name: string }>;
  typesByProduct: Map<string, string[]>;
  catsByProduct: Map<string, string[]>;
  ratesByProduct: Map<string, any[]>;
  usageByProduct: Map<string, number>;
  rulesByProduct: Map<string, any[]>;
}

async function loadProductExtras(organizationId: string): Promise<ProductExtras> {
  const db = getDb();
  if (!db) return { categories: new Map(), typesByProduct: new Map(), catsByProduct: new Map(), ratesByProduct: new Map(), usageByProduct: new Map(), rulesByProduct: new Map() };

  const [categories, eligTypes, eligCats, rates, usage, rules] = await Promise.all([
    db.select({ id: loanCategories.id, code: loanCategories.code, name: loanCategories.name })
      .from(loanCategories)
      .where(eq(loanCategories.organizationId, organizationId)),
    db.select({ loanProductId: loanProductEligibleMemberTypes.loanProductId, memberTypeId: loanProductEligibleMemberTypes.memberTypeId })
      .from(loanProductEligibleMemberTypes)
      .where(eq(loanProductEligibleMemberTypes.organizationId, organizationId)),
    db.select({ loanProductId: loanProductEligibleMemberCategories.loanProductId, memberCategoryId: loanProductEligibleMemberCategories.memberCategoryId })
      .from(loanProductEligibleMemberCategories)
      .where(eq(loanProductEligibleMemberCategories.organizationId, organizationId)),
    db.select().from(loanProductInterestRates)
      .where(eq(loanProductInterestRates.organizationId, organizationId))
      .orderBy(asc(loanProductInterestRates.effectiveFromBs)),
    db.select({ loanProductId: loanAccounts.loanProductId, c: count() })
      .from(loanAccounts)
      .where(eq(loanAccounts.organizationId, organizationId))
      .groupBy(loanAccounts.loanProductId),
    db.select({
      loanProductId: loanProductGuarantorRules.loanProductId,
      guarantorTypeId: loanProductGuarantorRules.guarantorTypeId,
      code: guarantorTypes.code,
      name: guarantorTypes.name,
      minCount: loanProductGuarantorRules.minCount,
      maxCount: loanProductGuarantorRules.maxCount,
      coveragePercent: loanProductGuarantorRules.coveragePercent,
    })
      .from(loanProductGuarantorRules)
      .innerJoin(guarantorTypes, eq(loanProductGuarantorRules.guarantorTypeId, guarantorTypes.id))
      .where(eq(loanProductGuarantorRules.organizationId, organizationId)),
  ]);

  const categoriesMap = new Map<string, { code: string; name: string }>();
  for (const c of categories) categoriesMap.set(c.id, { code: c.code, name: c.name });

  const typesByProduct = new Map<string, string[]>();
  for (const r of eligTypes) {
    const arr = typesByProduct.get(r.loanProductId) ?? [];
    arr.push(r.memberTypeId);
    typesByProduct.set(r.loanProductId, arr);
  }

  const catsByProduct = new Map<string, string[]>();
  for (const r of eligCats) {
    const arr = catsByProduct.get(r.loanProductId) ?? [];
    arr.push(r.memberCategoryId);
    catsByProduct.set(r.loanProductId, arr);
  }

  const ratesByProduct = new Map<string, any[]>();
  for (const r of rates) {
    const arr = ratesByProduct.get(r.loanProductId) ?? [];
    arr.push({
      id: r.id,
      rate: toNum(r.rate) ?? 0,
      effectiveFromBs: r.effectiveFromBs,
      effectiveToBs: r.effectiveToBs ?? null,
    });
    ratesByProduct.set(r.loanProductId, arr);
  }

  const usageByProduct = new Map<string, number>();
  for (const r of usage) usageByProduct.set(r.loanProductId, Number(r.c));

  const rulesByProduct = new Map<string, any[]>();
  for (const r of rules) {
    const arr = rulesByProduct.get(r.loanProductId) ?? [];
    arr.push({
      guarantorTypeId: r.guarantorTypeId,
      code: r.code,
      name: r.name,
      minCount: intOf(r.minCount, 1),
      maxCount: r.maxCount === null ? null : intOf(r.maxCount),
      coveragePercent: toNum(r.coveragePercent) ?? 0,
    });
    rulesByProduct.set(r.loanProductId, arr);
  }

  return { categories: categoriesMap, typesByProduct, catsByProduct, ratesByProduct, usageByProduct, rulesByProduct };
}

function normalize(row: any, kind: string, extras?: ProductExtras): Record<string, any> {
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
  if (kind === 'collateral') {
    base.valuationRequired = row.valuationRequired !== false;
  }
  if (kind === 'product') {
    const category = row.categoryId && extras?.categories.get(row.categoryId);
    base.productType = row.productType ?? 'general';
    base.categoryId = row.categoryId ?? null;
    base.categoryCode = category?.code ?? null;
    base.categoryName = category?.name ?? null;
    base.interestRate = toNum(row.interestRate) ?? 0;
    base.interestMethod = row.interestMethod ?? 'diminishing_emi';
    base.minAmount = toNum(row.minAmount) ?? 0;
    base.maxAmount = toNum(row.maxAmount) ?? 0;
    base.minTenureMonths = intOf(row.minTenureMonths, 1);
    base.maxTenureMonths = intOf(row.maxTenureMonths, 1);
    base.penaltyRate = toNum(row.penaltyRate) ?? 0;
    base.processingFeePercent = toNum(row.processingFeePercent) ?? 0;
    base.minMembershipMonths = intOf(row.minMembershipMonths, 0);
    base.minShareAmount = toNum(row.minShareAmount) ?? 0;
    base.requireActiveSavings = boolOf(row.requireActiveSavings);
    base.minSavingsBalance = toNum(row.minSavingsBalance) ?? 0;
    base.requireVerifiedKyc = row.requireVerifiedKyc === undefined ? true : boolOf(row.requireVerifiedKyc);
    base.allowEligibilityOverride = row.allowEligibilityOverride === true;
    base.eligibleMemberTypeIds = extras?.typesByProduct.get(row.id) ?? [];
    base.eligibleMemberCategoryIds = extras?.catsByProduct.get(row.id) ?? [];
    base.rateHistory = extras?.ratesByProduct.get(row.id) ?? [];
    base.guarantorRules = extras?.rulesByProduct.get(row.id) ?? [];
    base.usageCount = extras?.usageByProduct.get(row.id) ?? 0;
  }
  return base;
}

const sortRows = (rows: any[], kind: string, extras?: ProductExtras) =>
  [...rows]
    .map((r) => normalize(r, kind, extras))
    .sort((a, b) => (a.sortOrder - b.sortOrder) || a.code.localeCompare(b.code));

// ---------------------------------------------------------------------------
// Product value mappers
// ---------------------------------------------------------------------------
function productValues(body: Record<string, any>) {
  const values: Record<string, any> = {};
  if (body.categoryId !== undefined) values.categoryId = body.categoryId || null;
  if (body.interestRate !== undefined) values.interestRate = money(body.interestRate);
  if (body.interestMethod !== undefined) {
    values.interestMethod = LOAN_INTEREST_METHODS.includes(body.interestMethod) ? body.interestMethod : 'diminishing_emi';
  }
  if (body.minAmount !== undefined) values.minAmount = money(body.minAmount);
  if (body.maxAmount !== undefined) values.maxAmount = money(body.maxAmount);
  if (body.minTenureMonths !== undefined) values.minTenureMonths = intOf(body.minTenureMonths, 1);
  if (body.maxTenureMonths !== undefined) values.maxTenureMonths = intOf(body.maxTenureMonths, 1);
  if (body.penaltyRate !== undefined) values.penaltyRate = money(body.penaltyRate);
  if (body.processingFeePercent !== undefined) values.processingFeePercent = money(body.processingFeePercent);
  if (body.minMembershipMonths !== undefined) values.minMembershipMonths = intOf(body.minMembershipMonths, 0);
  if (body.minShareAmount !== undefined) values.minShareAmount = money(body.minShareAmount) ?? '0';
  if (body.requireActiveSavings !== undefined) values.requireActiveSavings = boolOf(body.requireActiveSavings);
  if (body.minSavingsBalance !== undefined) values.minSavingsBalance = money(body.minSavingsBalance) ?? '0';
  if (body.requireVerifiedKyc !== undefined) values.requireVerifiedKyc = boolOf(body.requireVerifiedKyc);
  if (body.allowEligibilityOverride !== undefined) values.allowEligibilityOverride = boolOf(body.allowEligibilityOverride);
  return values;
}

// ---------------------------------------------------------------------------
// Eligibility persistence
// ---------------------------------------------------------------------------
async function replaceEligibility(organizationId: string, productId: string, body: Record<string, any>) {
  const db = getDb();
  if (!db) return;

  if (body.eligibleMemberTypeIds !== undefined) {
    const ids = Array.isArray(body.eligibleMemberTypeIds) ? [...new Set(body.eligibleMemberTypeIds)] : [];
    for (const id of ids) await assertRefInOrg(organizationId, memberTypes, id, 'Member type does not belong to the current organization.');
    await db.delete(loanProductEligibleMemberTypes)
      .where(and(eq(loanProductEligibleMemberTypes.organizationId, organizationId), eq(loanProductEligibleMemberTypes.loanProductId, productId)));
    if (ids.length > 0) {
      await db.insert(loanProductEligibleMemberTypes).values(
        ids.map((memberTypeId) => ({ organizationId, loanProductId: productId, memberTypeId }))
      );
    }
  }

  if (body.eligibleMemberCategoryIds !== undefined) {
    const ids = Array.isArray(body.eligibleMemberCategoryIds) ? [...new Set(body.eligibleMemberCategoryIds)] : [];
    for (const id of ids) await assertRefInOrg(organizationId, memberCategories, id, 'Member category does not belong to the current organization.');
    await db.delete(loanProductEligibleMemberCategories)
      .where(and(eq(loanProductEligibleMemberCategories.organizationId, organizationId), eq(loanProductEligibleMemberCategories.loanProductId, productId)));
    if (ids.length > 0) {
      await db.insert(loanProductEligibleMemberCategories).values(
        ids.map((memberCategoryId) => ({ organizationId, loanProductId: productId, memberCategoryId }))
      );
    }
  }
}

/** Persists the per-product guarantor rules (allowed types + per-type min/max/coverage). */
async function replaceGuarantorRules(organizationId: string, productId: string, body: Record<string, any>) {
  const db = getDb();
  if (!db) return;
  if (body.guarantorRules === undefined) return;

  const rules = Array.isArray(body.guarantorRules) ? body.guarantorRules : [];
  const unique = new Map<string, any>();
  for (const r of rules) {
    const typeId = r?.guarantorTypeId;
    if (!typeId) continue;
    await assertRefInOrg(organizationId, guarantorTypes, typeId, 'Guarantor type does not belong to the current organization.');
    unique.set(typeId, r);
  }

  await db.delete(loanProductGuarantorRules)
    .where(and(eq(loanProductGuarantorRules.organizationId, organizationId), eq(loanProductGuarantorRules.loanProductId, productId)));

  if (unique.size > 0) {
    const values = [...unique.values()].map((r) => ({
      organizationId,
      loanProductId: productId,
      guarantorTypeId: r.guarantorTypeId,
      minCount: intOf(r.minCount, 1),
      maxCount: r.maxCount === null || r.maxCount === undefined || r.maxCount === '' ? null : intOf(r.maxCount),
      coveragePercent: String(r.coveragePercent ?? 0),
    }));
    await db.insert(loanProductGuarantorRules).values(values);
  }
}

/** Records the time-series rate history row when a product is created/rate-updated. */async function recordRate(organizationId: string, productId: string, rate: number, userId: string | undefined) {
  const db = getDb();
  if (!db) return;
  const today = DateConverter.getTodayBs();
  // Close any open row.
  await db.update(loanProductInterestRates)
    .set({ effectiveToBs: today })
    .where(and(
      eq(loanProductInterestRates.organizationId, organizationId),
      eq(loanProductInterestRates.loanProductId, productId),
      isNull(loanProductInterestRates.effectiveToBs),
    ));
  // Open a new row.
  await db.insert(loanProductInterestRates).values({
    organizationId,
    loanProductId: productId,
    rate: String(rate),
    effectiveFromBs: today,
    createdBy: userId ?? null,
  });
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------
export const LoanSettingController = {
  async getSettings(req: Request, res: Response) {
    const actor = reqActor(req);
    const entity = resolveEntity(req.params.entityType);
    if (!entity) return res.status(404).json({ error: 'Unknown entity type.' });
    const db = getDb();
    if (!db) return res.status(500).json({ error: 'Database unavailable.' });
    try {
      const rows = await db.select().from(entity.table).where(eq(entity.table.organizationId, actor.organizationId));
      if (entity.kind === 'product') {
        const extras = await loadProductExtras(actor.organizationId);
        return res.json(sortRows(rows, entity.kind, extras));
      }
      return res.json(sortRows(rows, entity.kind));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  async getSetting(req: Request, res: Response) {
    const actor = reqActor(req);
    const entity = resolveEntity(req.params.entityType);
    if (!entity) return res.status(404).json({ error: 'Unknown entity type.' });
    const db = getDb();
    if (!db) return res.status(500).json({ error: 'Database unavailable.' });
    try {
      const [row] = await db.select().from(entity.table)
        .where(and(eq(entity.table.id, req.params.id), eq(entity.table.organizationId, actor.organizationId)))
        .limit(1);
      if (!row) return res.status(404).json({ error: `${entity.label} not found.` });
      if (entity.kind === 'product') {
        const extras = await loadProductExtras(actor.organizationId);
        return res.json(normalize(row, entity.kind, extras));
      }
      return res.json(normalize(row, entity.kind));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  async createSetting(req: Request, res: Response) {
    const actor = reqActor(req);
    const entity = resolveEntity(req.params.entityType);
    if (!entity) return res.status(404).json({ error: 'Unknown entity type.' });
    const db = getDb();
    if (!db) return res.status(500).json({ error: 'Database unavailable.' });
    const body = req.body || {};
    try {
      if (await findDuplicate(entity, actor.organizationId, body.code, body.name)) {
        return res.status(409).json({ error: `${entity.label} with this code or name already exists.` });
      }

      if (entity.kind === 'product' && body.categoryId) {
        await assertRefInOrg(actor.organizationId, loanCategories, body.categoryId, 'Loan category does not belong to the current organization.');
      }

      const baseValues: Record<string, any> = {
        organizationId: actor.organizationId,
        code: body.code,
        name: body.name,
        nameNepali: body.nameNepali ?? null,
        description: body.description ?? null,
        isActive: isActiveOf(body.isActive),
        sortOrder: sortOrderOf(body.sortOrder),
        isSystem: false,
        createdBy: actor.userId ?? null,
        updatedBy: actor.userId ?? null,
      };

      let values = baseValues;
      if (entity.kind === 'collateral') {
        values = { ...baseValues, valuationRequired: body.valuationRequired !== false };
      }
      if (entity.kind === 'product') {
        values = { ...baseValues, ...productValues(body) };
      }

      const [inserted] = await db.insert(entity.table).values(values).returning();

      if (entity.kind === 'product') {
        await replaceEligibility(actor.organizationId, inserted.id, body);
        await replaceGuarantorRules(actor.organizationId, inserted.id, body);
        const rate = toNum(body.interestRate);
        if (rate !== null) await recordRate(actor.organizationId, inserted.id, rate, actor.userId);
      }

      await writeAuditLog(buildAuditRow(actor, 'Loan Settings', eventName(entity.kind, 'created'), `${entity.label} created`, { newValue: normalize(inserted, entity.kind) }));

      return res.status(201).json(normalize(inserted, entity.kind));
    } catch (err: any) {
      if (err.status === 400 || err.status === 403) return res.status(err.status).json({ error: err.message });
      return res.status(500).json({ error: err.message });
    }
  },

  async updateSetting(req: Request, res: Response) {
    const actor = reqActor(req);
    const entity = resolveEntity(req.params.entityType);
    if (!entity) return res.status(404).json({ error: 'Unknown entity type.' });
    const db = getDb();
    if (!db) return res.status(500).json({ error: 'Database unavailable.' });
    const body = req.body || {};
    try {
      const [existing] = await db.select().from(entity.table)
        .where(and(eq(entity.table.id, req.params.id), eq(entity.table.organizationId, actor.organizationId)))
        .limit(1);
      if (!existing) return res.status(404).json({ error: `${entity.label} not found.` });
      if (existing.isSystem && body.isActive === false) {
        return res.status(400).json({ error: `System ${entity.label.toLowerCase()} cannot be deactivated.` });
      }

      if (await findDuplicate(entity, actor.organizationId, body.code ?? existing.code, body.name ?? existing.name, existing.id)) {
        return res.status(409).json({ error: `${entity.label} with this code or name already exists.` });
      }

      const baseValues: Record<string, any> = {
        code: body.code ?? existing.code,
        name: body.name ?? existing.name,
        nameNepali: body.nameNepali !== undefined ? body.nameNepali : existing.nameNepali,
        description: body.description !== undefined ? body.description : existing.description,
        isActive: body.isActive !== undefined ? isActiveOf(body.isActive) : existing.isActive,
        sortOrder: body.sortOrder !== undefined ? sortOrderOf(body.sortOrder) : existing.sortOrder,
        updatedBy: actor.userId ?? null,
      };

      let values = baseValues;
      if (entity.kind === 'collateral') {
        values = { ...baseValues, valuationRequired: body.valuationRequired !== undefined ? body.valuationRequired !== false : existing.valuationRequired !== false };
      }
      if (entity.kind === 'product') {
        values = { ...baseValues, ...productValues(body) };
      }

      if (entity.kind === 'product' && body.categoryId) {
        await assertRefInOrg(actor.organizationId, loanCategories, body.categoryId, 'Loan category does not belong to the current organization.');
      }

      const [updated] = await db.update(entity.table).set(values).where(eq(entity.table.id, existing.id)).returning();

      if (entity.kind === 'product') {
        await replaceEligibility(actor.organizationId, updated.id, body);
        await replaceGuarantorRules(actor.organizationId, updated.id, body);
        if (body.interestRate !== undefined && Number(body.interestRate) !== toNum(existing.interestRate)) {
          const rate = toNum(body.interestRate);
          if (rate !== null) await recordRate(actor.organizationId, updated.id, rate, actor.userId);
        }
      }

      const before = normalize(existing, entity.kind);
      const after = normalize(updated, entity.kind);
      const diff = computeDiff(before, after);
      const { oldValue, newValue } = splitDiffIntoSnapshots(diff);
      await writeAuditLog(buildAuditRow(actor, 'Loan Settings', eventName(entity.kind, 'updated'), `${entity.label} updated`, { oldValue, newValue }));

      return res.json(after);
    } catch (err: any) {
      if (err.status === 400 || err.status === 403) return res.status(err.status).json({ error: err.message });
      return res.status(500).json({ error: err.message });
    }
  },

  async deleteSetting(req: Request, res: Response) {
    const actor = reqActor(req);
    const entity = resolveEntity(req.params.entityType);
    if (!entity) return res.status(404).json({ error: 'Unknown entity type.' });
    const db = getDb();
    if (!db) return res.status(500).json({ error: 'Database unavailable.' });
    try {
      const [existing] = await db.select().from(entity.table)
        .where(and(eq(entity.table.id, req.params.id), eq(entity.table.organizationId, actor.organizationId)))
        .limit(1);
      if (!existing) return res.status(404).json({ error: `${entity.label} not found.` });
      if (existing.isSystem) return res.status(400).json({ error: `System ${entity.label.toLowerCase()} cannot be deleted.` });

      const usage = await getUsageCount(entity, actor.organizationId, existing.id);
      if (usage > 0) {
        return res.status(400).json({ error: `${entity.label} is in use by ${usage} record(s) and cannot be deleted. Set it inactive instead.` });
      }

      await db.delete(entity.table).where(eq(entity.table.id, existing.id));

      await writeAuditLog(buildAuditRow(actor, 'Loan Settings', eventName(entity.kind, 'deleted'), `${entity.label} deleted`, { oldValue: normalize(existing, entity.kind) }));

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // ---- Singular settings --------------------------------------------------

  async getGuarantorSettings(req: Request, res: Response) {
    const actor = reqActor(req);
    const db = getDb();
    if (!db) return res.status(500).json({ error: 'Database unavailable.' });
    try {
      let [row] = await db.select().from(guarantorSettings).where(eq(guarantorSettings.organizationId, actor.organizationId)).limit(1);
      if (!row) {
        const [created] = await db.insert(guarantorSettings).values({
          organizationId: actor.organizationId,
          minGuarantors: 1,
          maxGuarantors: 2,
          requiredCoveragePercent: '100',
          updatedBy: actor.userId ?? null,
        }).returning();
        row = created;
      }
      return res.json(row);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  async updateGuarantorSettings(req: Request, res: Response) {
    const actor = reqActor(req);
    const db = getDb();
    if (!db) return res.status(500).json({ error: 'Database unavailable.' });
    const body = req.body || {};
    try {
      let [existing] = await db.select().from(guarantorSettings).where(eq(guarantorSettings.organizationId, actor.organizationId)).limit(1);
      if (!existing) {
        const [created] = await db.insert(guarantorSettings).values({
          organizationId: actor.organizationId,
          minGuarantors: 1,
          maxGuarantors: 2,
          requiredCoveragePercent: '100',
          updatedBy: actor.userId ?? null,
        }).returning();
        existing = created;
      }
      const values: Record<string, any> = {
        minGuarantors: body.minGuarantors !== undefined ? intOf(body.minGuarantors, 1) : existing.minGuarantors,
        maxGuarantors: body.maxGuarantors !== undefined ? intOf(body.maxGuarantors, 2) : existing.maxGuarantors,
        requiredCoveragePercent: body.requiredCoveragePercent !== undefined ? Number(body.requiredCoveragePercent) : existing.requiredCoveragePercent,
        updatedBy: actor.userId ?? null,
      };
      if (values.maxGuarantors < values.minGuarantors) {
        return res.status(400).json({ error: 'maxGuarantors cannot be less than minGuarantors.' });
      }
      if (values.requiredCoveragePercent < 0 || values.requiredCoveragePercent > 100) {
        return res.status(400).json({ error: 'requiredCoveragePercent must be between 0 and 100.' });
      }
      const [updated] = await db.update(guarantorSettings).set(values).where(eq(guarantorSettings.organizationId, actor.organizationId)).returning();
      await writeAuditLog(buildAuditRow(actor, 'Loan Settings', 'guarantor_settings_updated', 'Guarantor settings updated', { oldValue: existing as any, newValue: updated as any }));
      return res.json(updated);
    } catch (err: any) {
      if (err.status === 400 || err.status === 403) return res.status(err.status).json({ error: err.message });
      return res.status(500).json({ error: err.message });
    }
  },

  async getEmiScheduleSettings(req: Request, res: Response) {
    const actor = reqActor(req);
    const db = getDb();
    if (!db) return res.status(500).json({ error: 'Database unavailable.' });
    try {
      let [row] = await db.select().from(emiScheduleSettings).where(eq(emiScheduleSettings.organizationId, actor.organizationId)).limit(1);
      if (!row) {
        const [created] = await db.insert(emiScheduleSettings).values({
          organizationId: actor.organizationId,
          defaultInterestMethod: 'diminishing_emi',
          enabledMethods: ['flat', 'diminishing_emi', 'diminishing_principal', 'daily_reducing', 'bullet'],
          dayCountConvention: '365',
          installmentDayOfMonth: 1,
          roundingMode: 'round',
          shiftToWorkingDay: true,
          updatedBy: actor.userId ?? null,
        }).returning();
        row = created;
      }
      return res.json(row);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  async updateEmiScheduleSettings(req: Request, res: Response) {
    const actor = reqActor(req);
    const db = getDb();
    if (!db) return res.status(500).json({ error: 'Database unavailable.' });
    const body = req.body || {};
    try {
      let [existing] = await db.select().from(emiScheduleSettings).where(eq(emiScheduleSettings.organizationId, actor.organizationId)).limit(1);
      if (!existing) {
        const [created] = await db.insert(emiScheduleSettings).values({
          organizationId: actor.organizationId,
          defaultInterestMethod: 'diminishing_emi',
          enabledMethods: ['flat', 'diminishing_emi', 'diminishing_principal', 'daily_reducing', 'bullet'],
          dayCountConvention: '365',
          installmentDayOfMonth: 1,
          roundingMode: 'round',
          shiftToWorkingDay: true,
          updatedBy: actor.userId ?? null,
        }).returning();
        existing = created;
      }
      const values: Record<string, any> = {
        defaultInterestMethod: body.defaultInterestMethod !== undefined && LOAN_INTEREST_METHODS.includes(body.defaultInterestMethod)
          ? body.defaultInterestMethod
          : existing.defaultInterestMethod,
        enabledMethods: Array.isArray(body.enabledMethods)
          ? (body.enabledMethods as string[]).filter((m) => (LOAN_INTEREST_METHODS as readonly string[]).includes(m))
          : existing.enabledMethods,
        dayCountConvention: body.dayCountConvention !== undefined ? (body.dayCountConvention === '360' ? '360' : '365') : existing.dayCountConvention,
        installmentDayOfMonth: body.installmentDayOfMonth !== undefined ? intOf(body.installmentDayOfMonth, 1) : existing.installmentDayOfMonth,
        roundingMode: body.roundingMode !== undefined ? (body.roundingMode === 'floor' || body.roundingMode === 'ceil' ? body.roundingMode : 'round') : existing.roundingMode,
        shiftToWorkingDay: body.shiftToWorkingDay !== undefined ? !!body.shiftToWorkingDay : existing.shiftToWorkingDay,
        updatedBy: actor.userId ?? null,
      };
      if (values.installmentDayOfMonth < 1 || values.installmentDayOfMonth > 31) {
        return res.status(400).json({ error: 'installmentDayOfMonth must be between 1 and 31.' });
      }
      const [updated] = await db.update(emiScheduleSettings).set(values).where(eq(emiScheduleSettings.organizationId, actor.organizationId)).returning();
      await writeAuditLog(buildAuditRow(actor, 'Loan Settings', 'emi_schedule_settings_updated', 'EMI schedule settings updated', { oldValue: existing as any, newValue: updated as any }));
      return res.json(updated);
    } catch (err: any) {
      if (err.status === 400 || err.status === 403) return res.status(err.status).json({ error: err.message });
      return res.status(500).json({ error: err.message });
    }
  },
};
