/**
 * Savings Setting Controller (SETUPS → Savings A/C Settings)
 *
 * Org-scoped CRUD for Account Products (savings-products) — the canonical
 * savings product config — plus cheque-book issuance and the org default
 * savings product selector (drives auto-opening at member registration).
 *
 * Multi-tenancy rule: organization_id is ALWAYS derived from the verified JWT
 * (req.user.organizationId), never from the request body. Cross-tenant reads
 * by id are rejected with 403/404. Every write emits an audit row.
 *
 * `code` is normalized to UPPERCASE so the DB unique index
 * (organization_id, code) enforces case-insensitive uniqueness.
 *
 * savings_products is the single canonical financial source for savings
 * product config. The authoritative rate history lives in
 * savings_interest_rates and is maintained automatically whenever interestRate
 * changes (closed+open pairs, mirrors loan_product_interest_rates).
 */
import { Request, Response } from 'express';
import { eq, and, ne, or, ilike, asc, desc, isNull, inArray, count } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  savingsProducts,
  savingsInterestRates,
  savingsAccounts,
  savingsChequeBooks,
  savingsChequeLeaves,
  organizationProfiles,
  chartOfAccounts,
  memberTypes,
} from '../../db/schema';
import { buildAuditRow, writeAuditLog, computeDiff, splitDiffIntoSnapshots, SettingsActor } from '../utils/audit';
import { AuthService } from '../services/AuthService';
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

const sortOrderOf = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

const isActiveOf = (v: unknown): boolean => v !== false;

const boolOf = (v: any, fallback = true): boolean => (v === undefined ? fallback : v === true);

interface EntityConfig {
  table: any;
  /** Singular label used in audit details, e.g. "Savings Product". */
  label: string;
  kind: 'product';
}

const REGISTRY: Record<string, EntityConfig> = {
  'savings-products': { table: savingsProducts, label: 'Savings Product', kind: 'product' },
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
async function getProductUsageCount(entity: EntityConfig, organizationId: string, entityId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const rows = await db.select({ id: savingsAccounts.id })
      .from(savingsAccounts)
      .where(and(eq(savingsAccounts.organizationId, organizationId), eq(savingsAccounts.savingsProductId, entityId)));
    return rows.length;
  } catch {
    // Non-fatal: return 0 so list still renders.
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Rate history (time-series, mirrors loan_product_interest_rates)
// ---------------------------------------------------------------------------
async function loadRateHistory(organizationId: string): Promise<Map<string, any[]>> {
  const db = getDb();
  const map = new Map<string, any[]>();
  if (!db) return map;
  try {
    const rates = await db.select().from(savingsInterestRates)
      .where(eq(savingsInterestRates.organizationId, organizationId))
      .orderBy(asc(savingsInterestRates.effectiveFromBs));
    for (const r of rates) {
      const arr = map.get(r.savingsProductId) ?? [];
      arr.push({
        id: r.id,
        rate: toNum(r.rate) ?? 0,
        effectiveFromBs: r.effectiveFromBs,
        effectiveToBs: r.effectiveToBs ?? null,
      });
      map.set(r.savingsProductId, arr);
    }
  } catch {
    // Non-fatal.
  }
  return map;
}

async function recordRate(organizationId: string, productId: string, rate: number, userId: string | undefined) {
  const db = getDb();
  if (!db) return;
  const today = DateConverter.getTodayBs();
  // Close any open row.
  await db.update(savingsInterestRates)
    .set({ effectiveToBs: today })
    .where(and(
      eq(savingsInterestRates.organizationId, organizationId),
      eq(savingsInterestRates.savingsProductId, productId),
      isNull(savingsInterestRates.effectiveToBs),
    ));
  // Open a new row.
  await db.insert(savingsInterestRates).values({
    organizationId,
    savingsProductId: productId,
    rate: String(rate),
    effectiveFromBs: today,
    createdBy: userId ?? null,
  });
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------
function normalizeProduct(row: any, rates?: Map<string, any[]>) {
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
    productType: row.productType ?? 'regular',
    productCategory: row.productCategory || null,
    accountNoPrefix: row.accountNoPrefix ?? 'SAV',
    interestRate: toNum(row.interestRate) ?? 0,
    interestPostingFrequency: row.interestPostingFrequency ?? 'Monthly',
    interestCalculationMethod: row.interestCalculationMethod ?? 'min_monthly_balance',
    interestEffectiveDate: row.interestEffectiveDate || null,
    minBalance: toNum(row.minBalance) ?? 0,
    minDeposit: toNum(row.minDeposit) ?? 0,
    maxDeposit: row.maxDeposit != null ? (toNum(row.maxDeposit) ?? null) : null,
    maxBalance: row.maxBalance != null ? (toNum(row.maxBalance) ?? null) : null,
    tenureMonths: row.tenureMonths != null ? intOf(row.tenureMonths) : null,
    penaltyRate: toNum(row.penaltyRate) ?? 0,
    eligibleMemberTypeIds: Array.isArray(row.eligibleMemberTypeIds) ? row.eligibleMemberTypeIds : [],
    minAge: row.minAge != null ? intOf(row.minAge) : null,
    maxAge: row.maxAge != null ? intOf(row.maxAge) : null,
    requiresKycVerified: row.requiresKycVerified !== false,
    requiresNominee: row.requiresNominee !== false,
    requiresPhoto: row.requiresPhoto !== false,
    requiresSignature: row.requiresSignature !== false,
    requiresDocuments: row.requiresDocuments !== false,
    openingDepositRequired: row.openingDepositRequired !== false,
    depositModeCash: row.depositModeCash !== false,
    depositModeBank: row.depositModeBank !== false,
    depositModeTransfer: row.depositModeTransfer !== false,
    depositModeAgent: row.depositModeAgent !== false,
    dailyDepositLimit: row.dailyDepositLimit != null ? (toNum(row.dailyDepositLimit) ?? null) : null,
    monthlyDepositLimit: row.monthlyDepositLimit != null ? (toNum(row.monthlyDepositLimit) ?? null) : null,
    backdateDepositAllowed: row.backdateDepositAllowed === true,
    depositRequiresApproval: row.depositRequiresApproval === true,
    withdrawalModeCash: row.withdrawalModeCash !== false,
    withdrawalModeTransfer: row.withdrawalModeTransfer !== false,
    minWithdrawal: row.minWithdrawal != null ? (toNum(row.minWithdrawal) ?? null) : null,
    maxWithdrawal: row.maxWithdrawal != null ? (toNum(row.maxWithdrawal) ?? null) : null,
    dailyWithdrawalLimit: row.dailyWithdrawalLimit != null ? (toNum(row.dailyWithdrawalLimit) ?? null) : null,
    monthlyWithdrawalLimit: row.monthlyWithdrawalLimit != null ? (toNum(row.monthlyWithdrawalLimit) ?? null) : null,
    minimumBalanceAfterWithdrawal: row.minimumBalanceAfterWithdrawal != null ? (toNum(row.minimumBalanceAfterWithdrawal) ?? null) : null,
    withdrawalRequiresApproval: row.withdrawalRequiresApproval === true,
    minBalanceGraceDays: row.minBalanceGraceDays != null ? intOf(row.minBalanceGraceDays) : 0,
    minBalancePenaltyPercent: toNum(row.minBalancePenaltyPercent) ?? 0,
    minBalancePenaltyAmount: toNum(row.minBalancePenaltyAmount) ?? 0,
    minBalancePenaltyFrequency: row.minBalancePenaltyFrequency ?? 'Monthly',
    minBalanceWaiverAllowed: row.minBalanceWaiverAllowed === true,
    inactiveAfterMonths: row.inactiveAfterMonths != null ? intOf(row.inactiveAfterMonths) : 3,
    dormantAfterMonths: row.dormantAfterMonths != null ? intOf(row.dormantAfterMonths) : 6,
    notifyBeforeDormancyDays: row.notifyBeforeDormancyDays != null ? intOf(row.notifyBeforeDormancyDays) : 30,
    reactivationRequired: row.reactivationRequired !== false,
    reactivationApprovalRequired: row.reactivationApprovalRequired === true,
    closureAllowed: row.closureAllowed !== false,
    minimumBalanceBeforeClosure: toNum(row.minimumBalanceBeforeClosure) ?? 0,
    closureRequiresApproval: row.closureRequiresApproval === true,
    closureFee: toNum(row.closureFee) ?? 0,
    openingFee: toNum(row.openingFee) ?? 0,
    monthlyMaintenanceFee: toNum(row.monthlyMaintenanceFee) ?? 0,
    withdrawalFee: toNum(row.withdrawalFee) ?? 0,
    chequeBookFee: toNum(row.chequeBookFee) ?? 0,
    chequeLeafFee: toNum(row.chequeLeafFee) ?? 0,
    stopPaymentFee: toNum(row.stopPaymentFee) ?? 0,
    chequeReturnFee: toNum(row.chequeReturnFee) ?? 0,
    passbookFee: toNum(row.passbookFee) ?? 0,
    statementFee: toNum(row.statementFee) ?? 0,
    chequeEnabled: row.chequeEnabled === true,
    chequeDefaultLeaves: row.chequeDefaultLeaves != null ? intOf(row.chequeDefaultLeaves, 25) : 25,
    chequeMaxBooks: row.chequeMaxBooks != null ? intOf(row.chequeMaxBooks, 1) : 1,
    chequeValidityDays: row.chequeValidityDays != null ? intOf(row.chequeValidityDays, 90) : 90,
    glLiabilityAccountId: row.glLiabilityAccountId || null,
    glInterestExpenseAccountId: row.glInterestExpenseAccountId || null,
    glInterestPayableAccountId: row.glInterestPayableAccountId || null,
    glFeeIncomeAccountId: row.glFeeIncomeAccountId || null,
    glPenaltyIncomeAccountId: row.glPenaltyIncomeAccountId || null,
    glChequeIncomeAccountId: row.glChequeIncomeAccountId || null,
  };
  if (rates) {
    base.rateHistory = rates.get(row.id) ?? [];
  }
  return base;
}

/** Persist every editable product-config field from the (validated) body. */
function productValues(body: Record<string, any>) {
  const values: Record<string, any> = {};
  if (body.productType !== undefined) {
    const t = ['regular', 'recurring', 'fixed', 'daily_deposit'].includes(body.productType) ? body.productType : 'regular';
    values.productType = t;
  }
  if (body.productCategory !== undefined) values.productCategory = body.productCategory ? String(body.productCategory).trim().toUpperCase() : null;
  if (body.accountNoPrefix !== undefined) values.accountNoPrefix = String(body.accountNoPrefix).trim().toUpperCase().slice(0, 10) || 'SAV';
  // Interest / rate
  if (body.interestRate !== undefined) values.interestRate = money(body.interestRate);
  if (body.interestPostingFrequency !== undefined) {
    const f = ['Daily', 'Monthly', 'Quarterly', 'Half_Yearly', 'Annually'].includes(body.interestPostingFrequency) ? body.interestPostingFrequency : 'Monthly';
    values.interestPostingFrequency = f;
  }
  if (body.interestCalculationMethod !== undefined) {
    const m = ['min_monthly_balance', 'daily_product', 'quarterly_min_balance', 'simple', 'compound'].includes(body.interestCalculationMethod)
      ? body.interestCalculationMethod : 'min_monthly_balance';
    values.interestCalculationMethod = m;
  }
  if (body.interestEffectiveDate !== undefined) values.interestEffectiveDate = body.interestEffectiveDate ? String(body.interestEffectiveDate).trim() : null;
  // Amount bounds
  if (body.minBalance !== undefined) values.minBalance = money(body.minBalance);
  if (body.minDeposit !== undefined) values.minDeposit = money(body.minDeposit);
  if (body.maxDeposit !== undefined) values.maxDeposit = money(body.maxDeposit);
  if (body.maxBalance !== undefined) values.maxBalance = money(body.maxBalance);
  if (body.tenureMonths !== undefined) values.tenureMonths = body.tenureMonths ? intOf(body.tenureMonths) : null;
  if (body.penaltyRate !== undefined) values.penaltyRate = money(body.penaltyRate);
  // Eligibility
  if (body.eligibleMemberTypeIds !== undefined) values.eligibleMemberTypeIds = Array.isArray(body.eligibleMemberTypeIds) ? body.eligibleMemberTypeIds : [];
  if (body.minAge !== undefined) values.minAge = body.minAge === null || body.minAge === '' ? null : intOf(body.minAge);
  if (body.maxAge !== undefined) values.maxAge = body.maxAge === null || body.maxAge === '' ? null : intOf(body.maxAge);
  // KYC
  if (body.requiresKycVerified !== undefined) values.requiresKycVerified = body.requiresKycVerified === true;
  if (body.requiresNominee !== undefined) values.requiresNominee = body.requiresNominee === true;
  if (body.requiresPhoto !== undefined) values.requiresPhoto = body.requiresPhoto === true;
  if (body.requiresSignature !== undefined) values.requiresSignature = body.requiresSignature === true;
  if (body.requiresDocuments !== undefined) values.requiresDocuments = body.requiresDocuments === true;
  // Opening
  if (body.openingDepositRequired !== undefined) values.openingDepositRequired = body.openingDepositRequired === true;
  // Deposit rules
  for (const k of ['depositModeCash', 'depositModeBank', 'depositModeTransfer', 'depositModeAgent']) {
    if (body[k] !== undefined) values[k] = body[k] === true;
  }
  if (body.dailyDepositLimit !== undefined) values.dailyDepositLimit = money(body.dailyDepositLimit);
  if (body.monthlyDepositLimit !== undefined) values.monthlyDepositLimit = money(body.monthlyDepositLimit);
  if (body.backdateDepositAllowed !== undefined) values.backdateDepositAllowed = body.backdateDepositAllowed === true;
  if (body.depositRequiresApproval !== undefined) values.depositRequiresApproval = body.depositRequiresApproval === true;
  // Withdrawal rules
  for (const k of ['withdrawalModeCash', 'withdrawalModeTransfer']) {
    if (body[k] !== undefined) values[k] = body[k] === true;
  }
  if (body.minWithdrawal !== undefined) values.minWithdrawal = money(body.minWithdrawal);
  if (body.maxWithdrawal !== undefined) values.maxWithdrawal = money(body.maxWithdrawal);
  if (body.dailyWithdrawalLimit !== undefined) values.dailyWithdrawalLimit = money(body.dailyWithdrawalLimit);
  if (body.monthlyWithdrawalLimit !== undefined) values.monthlyWithdrawalLimit = money(body.monthlyWithdrawalLimit);
  if (body.minimumBalanceAfterWithdrawal !== undefined) values.minimumBalanceAfterWithdrawal = money(body.minimumBalanceAfterWithdrawal);
  if (body.withdrawalRequiresApproval !== undefined) values.withdrawalRequiresApproval = body.withdrawalRequiresApproval === true;
  // Minimum balance penalty
  if (body.minBalanceGraceDays !== undefined) values.minBalanceGraceDays = intOf(body.minBalanceGraceDays);
  if (body.minBalancePenaltyPercent !== undefined) values.minBalancePenaltyPercent = money(body.minBalancePenaltyPercent);
  if (body.minBalancePenaltyAmount !== undefined) values.minBalancePenaltyAmount = money(body.minBalancePenaltyAmount);
  if (body.minBalancePenaltyFrequency !== undefined) {
    values.minBalancePenaltyFrequency = ['Daily', 'Monthly', 'Quarterly', 'Half_Yearly', 'Annually'].includes(body.minBalancePenaltyFrequency)
      ? body.minBalancePenaltyFrequency : 'Monthly';
  }
  if (body.minBalanceWaiverAllowed !== undefined) values.minBalanceWaiverAllowed = body.minBalanceWaiverAllowed === true;
  // Dormancy
  if (body.inactiveAfterMonths !== undefined) values.inactiveAfterMonths = intOf(body.inactiveAfterMonths, 3);
  if (body.dormantAfterMonths !== undefined) values.dormantAfterMonths = intOf(body.dormantAfterMonths, 6);
  if (body.notifyBeforeDormancyDays !== undefined) values.notifyBeforeDormancyDays = intOf(body.notifyBeforeDormancyDays, 30);
  if (body.reactivationRequired !== undefined) values.reactivationRequired = body.reactivationRequired === true;
  if (body.reactivationApprovalRequired !== undefined) values.reactivationApprovalRequired = body.reactivationApprovalRequired === true;
  // Closure
  if (body.closureAllowed !== undefined) values.closureAllowed = body.closureAllowed === true;
  if (body.minimumBalanceBeforeClosure !== undefined) values.minimumBalanceBeforeClosure = money(body.minimumBalanceBeforeClosure);
  if (body.closureRequiresApproval !== undefined) values.closureRequiresApproval = body.closureRequiresApproval === true;
  if (body.closureFee !== undefined) values.closureFee = money(body.closureFee);
  // Charges & fees
  for (const k of ['openingFee', 'monthlyMaintenanceFee', 'withdrawalFee', 'chequeBookFee', 'chequeLeafFee', 'stopPaymentFee', 'chequeReturnFee', 'passbookFee', 'statementFee']) {
    if (body[k] !== undefined) values[k] = money(body[k]);
  }
  // Cheque facility
  if (body.chequeEnabled !== undefined) values.chequeEnabled = body.chequeEnabled === true;
  if (body.chequeDefaultLeaves !== undefined) values.chequeDefaultLeaves = intOf(body.chequeDefaultLeaves, 25);
  if (body.chequeMaxBooks !== undefined) values.chequeMaxBooks = intOf(body.chequeMaxBooks, 1);
  if (body.chequeValidityDays !== undefined) values.chequeValidityDays = intOf(body.chequeValidityDays, 90);
  // Accounting (GL) mapping
  for (const k of ['glLiabilityAccountId', 'glInterestExpenseAccountId', 'glInterestPayableAccountId', 'glFeeIncomeAccountId', 'glPenaltyIncomeAccountId', 'glChequeIncomeAccountId']) {
    if (body[k] !== undefined) values[k] = body[k] || null;
  }
  return values;
}

/** Validate every GL account FK is within the org. */
async function assertGlRefsInOrg(organizationId: string, body: Record<string, any>) {
  for (const k of ['glLiabilityAccountId', 'glInterestExpenseAccountId', 'glInterestPayableAccountId', 'glFeeIncomeAccountId', 'glPenaltyIncomeAccountId', 'glChequeIncomeAccountId']) {
    const id = body[k];
    if (id) await assertRefInOrg(organizationId, chartOfAccounts, id, `${k} GL account does not belong to the current organization.`);
  }
}

/** Validate every eligible member-type FK is within the org. */
async function assertEligibilityInOrg(organizationId: string, ids: unknown) {
  if (!Array.isArray(ids)) return;
  for (const id of ids) {
    await assertRefInOrg(organizationId, memberTypes, id, 'Member type does not belong to the current organization.');
  }
}

export class SavingsSettingController {
  static async getSettings(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const entity = resolveEntity(String(req.params.entityType));
      if (!entity) return res.status(400).json({ error: 'Unknown savings settings entity type.' });

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
      const type = req.query.type as string | undefined;
      if (type) {
        conditions.push(eq(entity.table.productType, type));
      }

      const rows = await db.select().from(entity.table).where(and(...conditions)).orderBy(asc(entity.table.sortOrder), asc(entity.table.name));
      const rates = await loadRateHistory(organizationId);
      const normalized = await Promise.all(
        rows.map(async (r: any) => ({
          ...normalizeProduct(r, rates),
          usageCount: await getProductUsageCount(entity, organizationId, r.id),
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
      if (!entity) return res.status(400).json({ error: 'Unknown savings settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [row] = await db.select().from(entity.table)
        .where(and(eq(entity.table.id, req.params.id), eq(entity.table.organizationId, organizationId)))
        .limit(1);
      if (!row) return res.status(404).json({ error: `${entity.label} not found` });

      const rates = await loadRateHistory(organizationId);
      res.json({
        ...normalizeProduct(row, rates),
        usageCount: await getProductUsageCount(entity, organizationId, row.id),
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
      if (!entity) return res.status(400).json({ error: 'Unknown savings settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const code = String(body.code ?? '').trim().toUpperCase();
      const name = String(body.name ?? '').trim();
      if (!code || !name) return res.status(400).json({ error: 'Code and name are required.' });

      const dup = await findDuplicate(entity, organizationId, code, name);
      if (dup) {
        return res.status(409).json({ error: `A ${entity.label} with this code or name already exists.` });
      }

      await assertEligibilityInOrg(organizationId, body.eligibleMemberTypeIds);
      await assertGlRefsInOrg(organizationId, body);

      const values: Record<string, any> = {
        organizationId,
        code,
        name,
        nameNepali: body.nameNepali ? String(body.nameNepali).trim() : null,
        description: body.description ? String(body.description).trim() : null,
        isActive: isActiveOf(body.isActive),
        sortOrder: sortOrderOf(body.sortOrder),
        productType: body.productType ?? 'regular',
        createdBy: req.user?.userId ?? null,
        updatedBy: req.user?.userId ?? null,
        ...productValues(body),
      };

      const [row] = await db.insert(entity.table).values(values).returning();

      const rate = toNum(body.interestRate);
      if (rate !== null) await recordRate(organizationId, row.id, rate, req.user?.userId);

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Savings Settings',
        `Create ${entity.label}`,
        `Created ${entity.label.toLowerCase()} "${row.name}" (${row.code})`,
      ));

      res.status(201).json({ ...normalizeProduct(row), usageCount: 0 });
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
      if (!entity) return res.status(400).json({ error: 'Unknown savings settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [existing] = await db.select().from(entity.table).where(eq(entity.table.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: `${entity.label} not found` });
      if (String(existing.organizationId) !== String(organizationId)) {
        return res.status(403).json({ error: `Not authorized to edit this ${entity.label.toLowerCase()}.` });
      }
      if (existing.isSystem && body.isActive === false) {
        return res.status(400).json({ error: `System ${entity.label.toLowerCase()} records cannot be deactivated.` });
      }

      const code = body.code !== undefined ? String(body.code).trim().toUpperCase() : existing.code;
      const name = body.name !== undefined ? String(body.name).trim() : existing.name;
      const dup = await findDuplicate(entity, organizationId, code, name, existing.id);
      if (dup) {
        return res.status(409).json({ error: `A ${entity.label} with this code or name already exists.` });
      }

      await assertEligibilityInOrg(organizationId, body.eligibleMemberTypeIds);
      await assertGlRefsInOrg(organizationId, body);

      // Snapshot BEFORE mutating so the audit diff is meaningful.
      const before = normalizeProduct(existing);

      const update: Record<string, any> = { updatedAt: new Date(), updatedBy: req.user?.userId ?? null };
      if (body.code !== undefined) update.code = code;
      if (body.name !== undefined) update.name = name;
      if (body.nameNepali !== undefined) update.nameNepali = body.nameNepali ? String(body.nameNepali).trim() : null;
      if (body.description !== undefined) update.description = body.description ? String(body.description).trim() : null;
      if (body.isActive !== undefined) update.isActive = isActiveOf(body.isActive);
      if (body.sortOrder !== undefined) update.sortOrder = sortOrderOf(body.sortOrder);
      Object.assign(update, productValues(body));

      const [row] = await db.update(entity.table).set(update).where(eq(entity.table.id, existing.id)).returning();

      if (body.interestRate !== undefined && Number(body.interestRate) !== toNum(existing.interestRate)) {
        const rate = toNum(body.interestRate);
        if (rate !== null) await recordRate(organizationId, row.id, rate, req.user?.userId);
      }

      const rates = await loadRateHistory(organizationId);
      const diff = computeDiff(before, normalizeProduct(row, rates));
      const { oldValue, newValue } = splitDiffIntoSnapshots(diff);
      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Savings Settings',
        `Update ${entity.label}`,
        `Updated ${entity.label.toLowerCase()} "${row.name}" (${row.code})`,
        { oldValue, newValue },
      ));

      res.json({
        ...normalizeProduct(row, rates),
        usageCount: await getProductUsageCount(entity, organizationId, row.id),
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
      if (!entity) return res.status(400).json({ error: 'Unknown savings settings entity type.' });

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

      const inUse = await getProductUsageCount(entity, organizationId, existing.id);
      if (inUse > 0) {
        return res.status(400).json({ error: `This ${entity.label.toLowerCase()} cannot be deleted because it is already in use.` });
      }
      // Also block if it is the org's configured default product.
      const [profile] = await db.select({ defaultSavingProductId: organizationProfiles.defaultSavingProductId })
        .from(organizationProfiles)
        .where(eq(organizationProfiles.organizationId, organizationId)).limit(1);
      if (profile?.defaultSavingProductId && String(profile.defaultSavingProductId) === String(existing.id)) {
        return res.status(400).json({ error: `This ${entity.label.toLowerCase()} cannot be deleted because it is the organization default.` });
      }

      await db.delete(entity.table).where(eq(entity.table.id, existing.id));

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Savings Settings',
        `Delete ${entity.label}`,
        `Deleted ${entity.label.toLowerCase()} "${existing.name}" (${existing.code})`,
      ));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================================
  // Org default savings product
  // ============================================================

  /** GET /savings/settings/default-product */
  static async getDefaultProduct(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [profile] = await db.select({ defaultSavingProductId: organizationProfiles.defaultSavingProductId })
        .from(organizationProfiles)
        .where(eq(organizationProfiles.organizationId, organizationId)).limit(1);

      const defaultSavingProductId = profile?.defaultSavingProductId ?? null;
      let product = null;
      if (defaultSavingProductId) {
        const [row] = await db.select().from(savingsProducts)
          .where(and(eq(savingsProducts.id, defaultSavingProductId), eq(savingsProducts.organizationId, organizationId)))
          .limit(1);
        product = row ? normalizeProduct(row) : null;
      }
      res.json({ defaultSavingProductId, product });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** PUT /savings/settings/default-product */
  static async setDefaultProduct(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const next = req.body?.defaultSavingProductId ?? null;

      if (next) {
        const [product] = await db.select().from(savingsProducts).where(eq(savingsProducts.id, next)).limit(1);
        if (!product) return res.status(404).json({ error: 'Savings Product not found.' });
        if (String(product.organizationId) !== String(organizationId)) {
          return res.status(403).json({ error: 'Savings Product does not belong to the current organization.' });
        }
        if (product.isActive === false) {
          return res.status(400).json({ error: 'Selected Savings Product is inactive.' });
        }
      }

      // Persist on the org profile (routed to organization_profiles).
      const authService = new AuthService();
      const organization = await authService.updateOrganization(organizationId, { defaultSavingProductId: next });

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Savings Settings',
        next ? 'Set Default Savings Product' : 'Clear Default Savings Product',
        next ? `Default savings product set to ${next}` : 'Default savings product cleared',
      ));

      res.json({ defaultSavingProductId: next, organization });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================================
  // Cheque Books
  // ============================================================

  /** GET /savings-settings/cheque-books?accountId=… — org-scoped list. */
  static async getChequeBooks(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const conditions: any[] = [eq(savingsChequeBooks.organizationId, organizationId)];
      const accountId = req.query.accountId as string | undefined;
      if (accountId) conditions.push(eq(savingsChequeBooks.accountId, accountId));

      const rows = await db.select().from(savingsChequeBooks).where(and(...conditions)).orderBy(desc(savingsChequeBooks.createdAt));
      res.json(rows.map((r: any) => ({
        id: r.id,
        organizationId,
        accountId: r.accountId,
        accountNo: r.accountNo,
        bookNo: r.bookNo,
        firstLeafNo: r.firstLeafNo,
        leafCount: r.leafCount,
        issueDateBs: r.issueDateBs,
        issueDateAd: r.issueDateAd,
        issuedById: r.issuedById || null,
        status: r.status ?? 'Issued',
        createdAt: r.createdAt,
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** POST /savings-settings/cheque-books — issue a new book for an account. */
  static async issueChequeBook(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const accountId = String(req.body?.accountId ?? '');
      const leafCount = intOf(req.body?.leafCount, 25);

      // Account must exist and belong to the org.
      const [account] = await db.select().from(savingsAccounts)
        .where(and(eq(savingsAccounts.id, accountId), eq(savingsAccounts.organizationId, organizationId)))
        .limit(1);
      if (!account) return res.status(404).json({ error: 'Savings account not found.' });

      // Resolve the next book number + starting leaf for this account.
      const [last] = await db.select().from(savingsChequeBooks)
        .where(and(eq(savingsChequeBooks.organizationId, organizationId), eq(savingsChequeBooks.accountId, accountId)))
        .orderBy(desc(savingsChequeBooks.firstLeafNo))
        .limit(1);
      const firstLeafNo = last ? (intOf(last.firstLeafNo) + intOf(last.leafCount, 25)) : 1;

      const [countRow] = await db.select({ value: count() }).from(savingsChequeBooks)
        .where(and(eq(savingsChequeBooks.organizationId, organizationId), eq(savingsChequeBooks.accountId, accountId)));
      const bookIndex = intOf(countRow?.value ?? 0, 0) + 1;
      const bookNo = `CHQ-${bookIndex}-${String(account.accountNo ?? '').slice(-6)}`;
      const todayBs = DateConverter.getTodayBs();
      const todayAd = new Date().toISOString();

      const [book] = await db.insert(savingsChequeBooks).values({
        organizationId,
        accountId: account.id,
        accountNo: account.accountNo,
        bookNo,
        firstLeafNo,
        leafCount,
        issueDateBs: todayBs,
        issueDateAd: todayAd,
        issuedById: req.user?.userId ?? null,
        status: 'Issued',
      }).returning();

      // Auto-create the leaves.
      const leaves = Array.from({ length: leafCount }, (_, i) => ({
        organizationId,
        bookId: book.id,
        leafNo: firstLeafNo + i,
        status: 'Available' as const,
      }));
      await db.insert(savingsChequeLeaves).values(leaves);

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Savings Settings',
        'Issue Cheque Book',
        `Issued cheque book ${bookNo} (${leafCount} leaves) for account ${account.accountNo}`,
      ));

      res.status(201).json({ book, leaves: leaves.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** POST /savings-settings/cheque-books/:id/cancel */
  static async cancelChequeBook(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [existing] = await db.select().from(savingsChequeBooks).where(eq(savingsChequeBooks.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Cheque book not found.' });
      if (String(existing.organizationId) !== String(organizationId)) {
        return res.status(403).json({ error: 'Not authorized to cancel this cheque book.' });
      }
      if (existing.status === 'Cancelled') return res.status(400).json({ error: 'Cheque book is already cancelled.' });

      await db.update(savingsChequeBooks)
        .set({ status: 'Cancelled', updatedAt: new Date() })
        .where(and(eq(savingsChequeBooks.id, existing.id), eq(savingsChequeBooks.organizationId, organizationId)));
      // Cancel all unused leaves in the book.
      await db.update(savingsChequeLeaves)
        .set({ status: 'Cancelled' })
        .where(and(
          eq(savingsChequeLeaves.organizationId, organizationId),
          eq(savingsChequeLeaves.bookId, existing.id),
          inArray(savingsChequeLeaves.status, ['Available', 'Issued']),
        ));

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Savings Settings',
        'Cancel Cheque Book',
        `Cancelled cheque book ${existing.bookNo}`,
      ));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static reorderSettings = async (req: Request & { user?: OrgUser }, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const entity = resolveEntity(String(req.params.entityType));
      if (!entity) return res.status(400).json({ error: 'Unknown savings settings entity type.' });

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
  };
}