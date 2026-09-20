/**
 * Accounting Setting Controller (SETUPS → Accounting Settings)
 *
 * Org-scoped CRUD for the accounting configuration catalogs:
 *   voucher-types, cost-centers, journal-templates, financial-periods,
 *   banks, bank-accounts, cash-counters, payment-methods
 * plus:
 *   - Chart of Accounts & Account Groups (hierarchy-safe CRUD)
 *   - Financial period status transitions (open/lock/close/reopen)
 *   - System Account Mappings (engine wiring for module postings)
 *   - Health check (real DB state, used by the settings dashboard)
 *
 * Multi-tenancy rule: organization_id is ALWAYS derived from the verified JWT
 * (req.user.organizationId), never from the request body. Cross-tenant reads
 * by id are rejected with 403/404. Every write emits an audit row.
 *
 * Deactivate-over-delete: catalogs whose rows are referenced by live financial
 * data are never hard-deleted — the client is told to deactivate instead.
 */
import { Request, Response } from 'express';
import { eq, and, ne, asc, count, or, ilike, gte, lte, lt, desc, sql, inArray } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  voucherTypes,
  voucherTypeCounters,
  costCenters,
  journalTemplates,
  journalTemplateEntries,
  financialPeriods,
  banks,
  bankAccounts,
  cashCounters,
  paymentMethods,
  systemAccountMappings,
  chartOfAccounts,
  accountGroups,
  vouchers,
  voucherEntries,
  fiscalYears,
  orgUsers,
} from '../../db/schema';
import { bankChequeBooks, bankChequeLeaves } from '../../db/schema/bankCheques';
import { buildAuditRow, writeAuditLog, computeDiff, splitDiffIntoSnapshots, SettingsActor } from '../utils/audit';
import { assertBranchInOrg, ScopeError } from '../middleware/scope';
import { findOverlappingFiscalYear, bsRangeBreaches } from '../utils/fiscalYearValidation';
import { SYSTEM_ACCOUNT_KEYS } from '../schemas/accountingSetting';
import { postSavingsVoucher, type GlPostInput } from '../services/SavingsGlService';
import { DateConverter } from '../../utils/DateConverter';
import { getCurrentFiscalYearCode } from '../../utils/nepaliCalendar';
import { v4 as uuidv4 } from 'uuid';
import { upsertLedgerEntry, computeRunningBalance, computeRunningBalancesForEntries, setRunningBalanceRaw } from '../services/ledgerUtils';

function round2(n: number): number { return Math.round(n * 100) / 100; }

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

interface EntityConfig {
  table: any;
  label: string;
  kind:
    | 'voucher_type' | 'cost_center' | 'journal_template' | 'financial_period'
    | 'bank' | 'bank_account' | 'cash_counter' | 'payment_method';
  /** Which base columns this table actually has (registry tables vary). */
  hasCode: boolean;
  hasNameNepali: boolean;
  hasDescription: boolean;
  hasSortOrder: boolean;
  hasIsActive: boolean;
  hasIsSystem: boolean;
}

const REGISTRY: Record<string, EntityConfig> = {
  'voucher-types': { table: voucherTypes, label: 'Voucher Type', kind: 'voucher_type', hasCode: true, hasNameNepali: true, hasDescription: true, hasSortOrder: true, hasIsActive: true, hasIsSystem: true },
  'cost-centers': { table: costCenters, label: 'Cost Center', kind: 'cost_center', hasCode: true, hasNameNepali: true, hasDescription: true, hasSortOrder: true, hasIsActive: true, hasIsSystem: true },
  'journal-templates': { table: journalTemplates, label: 'Journal Template', kind: 'journal_template', hasCode: true, hasNameNepali: true, hasDescription: true, hasSortOrder: true, hasIsActive: true, hasIsSystem: true },
  'financial-periods': { table: financialPeriods, label: 'Financial Period', kind: 'financial_period', hasCode: true, hasNameNepali: true, hasDescription: false, hasSortOrder: false, hasIsActive: false, hasIsSystem: false },
  'banks': { table: banks, label: 'Bank', kind: 'bank', hasCode: true, hasNameNepali: true, hasDescription: true, hasSortOrder: true, hasIsActive: true, hasIsSystem: true },
  'bank-accounts': { table: bankAccounts, label: 'Bank Account', kind: 'bank_account', hasCode: false, hasNameNepali: false, hasDescription: false, hasSortOrder: false, hasIsActive: true, hasIsSystem: true },
  'cash-counters': { table: cashCounters, label: 'Cash Counter', kind: 'cash_counter', hasCode: true, hasNameNepali: true, hasDescription: false, hasSortOrder: false, hasIsActive: true, hasIsSystem: true },
  'payment-methods': { table: paymentMethods, label: 'Payment Method', kind: 'payment_method', hasCode: true, hasNameNepali: true, hasDescription: true, hasSortOrder: true, hasIsActive: true, hasIsSystem: true },
};

function resolveEntity(entityType: string): EntityConfig | null {
  return REGISTRY[entityType] ?? null;
}

const eventName = (kind: string, action: 'created' | 'updated' | 'deleted'): string => {
  return `accounting_${kind}_${action}`;
};

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------
function normalize(row: any, kind: string): any {
  const base: Record<string, any> = {
    id: row.id,
    organizationId: row.organizationId,
    isActive: row.isActive !== undefined ? !!row.isActive : true,
    isSystem: row.isSystem !== undefined ? !!row.isSystem : false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  if (row.code !== undefined) base.code = row.code;
  if (row.name !== undefined) base.name = row.name;
  if (row.nameNepali !== undefined) base.nameNepali = row.nameNepali || null;
  if (row.description !== undefined) base.description = row.description || null;
  if (row.sortOrder !== undefined) base.sortOrder = row.sortOrder ?? 0;

  switch (kind) {
    case 'voucher_type':
      base.category = row.category ?? 'Journal';
      base.prefix = row.prefix ?? 'JV';
      base.numberingRule = row.numberingRule ?? 'fiscal_year';
      base.padding = row.padding ?? 6;
      base.defaultDebitAccountId = row.defaultDebitAccountId ?? null;
      base.defaultCreditAccountId = row.defaultCreditAccountId ?? null;
      base.requiresApproval = !!row.requiresApproval;
      base.requiresNarration = row.requiresNarration !== false;
      base.requiresCostCenter = !!row.requiresCostCenter;
      base.requiresReference = !!row.requiresReference;
      base.isBranchScoped = !!row.isBranchScoped;
      base.allowBackdate = row.allowBackdate !== false;
      break;
    case 'cost_center':
      base.parentId = row.parentId ?? null;
      base.branchId = row.branchId ?? null;
      base.managerId = row.managerId ?? null;
      base.managerName = row.managerName || null;
      break;
    case 'journal_template':
      base.voucherTypeId = row.voucherTypeId ?? null;
      base.narrationTemplate = row.narrationTemplate || null;
      base.frequency = row.frequency ?? 'manual';
      base.branchId = row.branchId ?? null;
      break;
    case 'financial_period':
      base.fiscalYearId = row.fiscalYearId ?? null;
      base.fiscalYearCode = row.fiscalYearCode ?? '';
      base.startDateBs = row.startDateBs ?? '';
      base.endDateBs = row.endDateBs ?? '';
      base.startDateAd = row.startDateAd ?? '';
      base.endDateAd = row.endDateAd ?? '';
      base.status = row.status ?? 'draft';
      base.isCurrent = !!row.isCurrent;
      base.closedAt = row.closedAt ?? null;
      base.closedBy = row.closedBy || null;
      base.lockedAt = row.lockedAt ?? null;
      base.lockedBy = row.lockedBy || null;
      base.reason = row.reason || null;
      break;
    case 'bank':
      base.swiftCode = row.swiftCode || null;
      base.shortName = row.shortName || null;
      break;
    case 'bank_account':
      base.accountName = row.accountName ?? '';
      base.accountNumber = row.accountNumber ?? '';
      base.bankId = row.bankId ?? null;
      base.branchId = row.branchId ?? null;
      base.currency = row.currency ?? 'NPR';
      base.glAccountId = row.glAccountId ?? null;
      base.accountType = row.accountType ?? 'Current';
      base.openingBalance = toNum(row.openingBalance) ?? 0;
      base.openingDateBs = row.openingDateBs || null;
      base.isPrimary = !!row.isPrimary;
      base.reconciliationEnabled = !!row.reconciliationEnabled;
      base.lastReconciledDateBs = row.lastReconciledDateBs || null;
      break;
    case 'cash_counter':
      base.branchId = row.branchId ?? null;
      base.assignedUserId = row.assignedUserId ?? null;
      base.glCashAccountId = row.glCashAccountId ?? null;
      base.openingBalance = toNum(row.openingBalance) ?? 0;
      base.maxCashLimit = toNum(row.maxCashLimit) ?? null;
      break;
    case 'payment_method':
      base.type = row.type ?? 'Other';
      base.requiresReference = !!row.requiresReference;
      base.requiresBank = !!row.requiresBank;
      base.requiresChequeNumber = !!row.requiresChequeNumber;
      base.requiresTransactionId = !!row.requiresTransactionId;
      base.glAccountId = row.glAccountId ?? null;
      break;
  }
  return base;
}

// ---------------------------------------------------------------------------
// Value mapping (body → DB columns), per kind
// ---------------------------------------------------------------------------
function kindValues(kind: string, body: Record<string, any>): Record<string, any> {
  const values: Record<string, any> = {};
  switch (kind) {
    case 'voucher_type':
      if (body.category !== undefined) values.category = body.category;
      if (body.prefix !== undefined) values.prefix = String(body.prefix).trim().toUpperCase().slice(0, 8) || 'JV';
      if (body.numberingRule !== undefined) values.numberingRule = body.numberingRule;
      if (body.padding !== undefined) values.padding = Math.max(0, Math.min(10, intOf(body.padding, 6)));
      if (body.defaultDebitAccountId !== undefined) values.defaultDebitAccountId = body.defaultDebitAccountId || null;
      if (body.defaultCreditAccountId !== undefined) values.defaultCreditAccountId = body.defaultCreditAccountId || null;
      if (body.requiresApproval !== undefined) values.requiresApproval = body.requiresApproval === true;
      if (body.requiresNarration !== undefined) values.requiresNarration = body.requiresNarration === true;
      if (body.requiresCostCenter !== undefined) values.requiresCostCenter = body.requiresCostCenter === true;
      if (body.requiresReference !== undefined) values.requiresReference = body.requiresReference === true;
      if (body.isBranchScoped !== undefined) values.isBranchScoped = body.isBranchScoped === true;
      if (body.allowBackdate !== undefined) values.allowBackdate = body.allowBackdate === true;
      break;
    case 'cost_center':
      if (body.parentId !== undefined) values.parentId = body.parentId || null;
      if (body.branchId !== undefined) values.branchId = body.branchId || null;
      if (body.managerId !== undefined) values.managerId = body.managerId || null;
      if (body.managerName !== undefined) values.managerName = body.managerName ? String(body.managerName).trim() : null;
      break;
    case 'journal_template':
      if (body.voucherTypeId !== undefined) values.voucherTypeId = body.voucherTypeId || null;
      if (body.narrationTemplate !== undefined) values.narrationTemplate = body.narrationTemplate ? String(body.narrationTemplate).trim() : null;
      if (body.frequency !== undefined) values.frequency = body.frequency;
      if (body.branchId !== undefined) values.branchId = body.branchId || null;
      break;
    case 'financial_period':
      if (body.fiscalYearId !== undefined) values.fiscalYearId = body.fiscalYearId || null;
      if (body.fiscalYearCode !== undefined) values.fiscalYearCode = String(body.fiscalYearCode).trim().toUpperCase();
      if (body.startDateBs !== undefined) values.startDateBs = String(body.startDateBs).trim();
      if (body.endDateBs !== undefined) values.endDateBs = String(body.endDateBs).trim();
      if (body.startDateAd !== undefined) values.startDateAd = String(body.startDateAd).trim();
      if (body.endDateAd !== undefined) values.endDateAd = String(body.endDateAd).trim();
      if (body.status !== undefined) values.status = body.status;
      if (body.isCurrent !== undefined) values.isCurrent = body.isCurrent === true;
      if (body.reason !== undefined) values.reason = body.reason ? String(body.reason).trim() : null;
      break;
    case 'bank':
      if (body.swiftCode !== undefined) values.swiftCode = body.swiftCode ? String(body.swiftCode).trim().toUpperCase() : null;
      if (body.shortName !== undefined) values.shortName = body.shortName ? String(body.shortName).trim() : null;
      break;
    case 'bank_account':
      if (body.bankId !== undefined) values.bankId = body.bankId;
      if (body.accountName !== undefined) values.accountName = String(body.accountName).trim();
      if (body.accountNumber !== undefined) values.accountNumber = String(body.accountNumber).trim();
      if (body.branchId !== undefined) values.branchId = body.branchId || null;
      if (body.currency !== undefined) values.currency = String(body.currency).trim().toUpperCase().slice(0, 3) || 'NPR';
      if (body.glAccountId !== undefined) values.glAccountId = body.glAccountId || null;
      if (body.accountType !== undefined) values.accountType = body.accountType;
      if (body.openingBalance !== undefined) values.openingBalance = money(body.openingBalance) ?? '0';
      if (body.openingDateBs !== undefined) values.openingDateBs = body.openingDateBs || null;
      if (body.isPrimary !== undefined) values.isPrimary = body.isPrimary === true;
      if (body.reconciliationEnabled !== undefined) values.reconciliationEnabled = body.reconciliationEnabled === true;
      if (body.lastReconciledDateBs !== undefined) values.lastReconciledDateBs = body.lastReconciledDateBs || null;
      break;
    case 'cash_counter':
      if (body.branchId !== undefined) values.branchId = body.branchId;
      if (body.assignedUserId !== undefined) values.assignedUserId = body.assignedUserId || null;
      if (body.glCashAccountId !== undefined) values.glCashAccountId = body.glCashAccountId || null;
      if (body.openingBalance !== undefined) values.openingBalance = money(body.openingBalance) ?? '0';
      if (body.maxCashLimit !== undefined) values.maxCashLimit = body.maxCashLimit ? money(body.maxCashLimit) : null;
      break;
    case 'payment_method':
      if (body.type !== undefined) values.type = body.type;
      if (body.requiresReference !== undefined) values.requiresReference = body.requiresReference === true;
      if (body.requiresBank !== undefined) values.requiresBank = body.requiresBank === true;
      if (body.requiresChequeNumber !== undefined) values.requiresChequeNumber = body.requiresChequeNumber === true;
      if (body.requiresTransactionId !== undefined) values.requiresTransactionId = body.requiresTransactionId === true;
      if (body.glAccountId !== undefined) values.glAccountId = body.glAccountId || null;
      break;
  }
  return values;
}

function baseValues(entity: EntityConfig, body: Record<string, any>): Record<string, any> {
  const values: Record<string, any> = {};
  if (entity.hasCode && body.code !== undefined) values.code = String(body.code).trim().toUpperCase();
  if (entity.hasCode && body.name !== undefined) values.name = String(body.name).trim();
  if (entity.hasNameNepali && body.nameNepali !== undefined) values.nameNepali = body.nameNepali ? String(body.nameNepali).trim() : null;
  if (entity.hasDescription && body.description !== undefined) values.description = body.description ? String(body.description).trim() : null;
  if (entity.hasSortOrder && body.sortOrder !== undefined) values.sortOrder = sortOrderOf(body.sortOrder);
  if (entity.hasIsActive && body.isActive !== undefined) values.isActive = body.isActive === true;
  return values;
}

// ---------------------------------------------------------------------------
// Duplicate checks (per-kind uniqueness)
// ---------------------------------------------------------------------------
async function findDuplicate(entity: EntityConfig, organizationId: string, body: Record<string, any>, excludeId?: string) {
  const db = getDb();
  const scoped: any[] = [eq(entity.table.organizationId, organizationId)];
  if (excludeId) scoped.push(ne(entity.table.id, excludeId));

  if (entity.kind === 'bank_account') {
    const accountNumber = String(body.accountNumber ?? '').trim();
    if (!accountNumber) return null;
    const [dup] = await db.select({ id: entity.table.id }).from(entity.table)
      .where(and(...scoped, eq(entity.table.accountNumber, accountNumber)))
      .limit(1);
    return dup ?? null;
  }

  const code = String(body.code ?? '').trim().toUpperCase();
  if (!code) return null;
  const [dupCode] = await db.select({ id: entity.table.id }).from(entity.table)
    .where(and(...scoped, eq(entity.table.code, code)))
    .limit(1);
  if (dupCode) return dupCode;

  const name = String(body.name ?? '').trim();
  if (entity.hasCode && name) {
    const [dupName] = await db.select({ id: entity.table.id }).from(entity.table)
      .where(and(...scoped, eq(entity.table.name, name)))
      .limit(1);
    if (dupName) return dupName;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Reference validation helpers
// ---------------------------------------------------------------------------
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

/** Validate all refs carried by a body for a given kind (org-scoped). */
async function validateRefs(organizationId: string, kind: string, body: Record<string, any>) {
  switch (kind) {
    case 'voucher_type':
      await assertRefInOrg(organizationId, chartOfAccounts, body.defaultDebitAccountId, 'Default debit account does not belong to the current organization.');
      await assertRefInOrg(organizationId, chartOfAccounts, body.defaultCreditAccountId, 'Default credit account does not belong to the current organization.');
      break;
    case 'cost_center':
      await assertRefInOrg(organizationId, costCenters, body.parentId, 'Parent cost center does not belong to the current organization.');
      await assertBranchInOrg(organizationId, body.branchId);
      await assertRefInOrg(organizationId, orgUsers, body.managerId, 'Manager does not belong to the current organization.');
      break;
    case 'journal_template':
      await assertRefInOrg(organizationId, voucherTypes, body.voucherTypeId, 'Voucher type does not belong to the current organization.');
      await assertBranchInOrg(organizationId, body.branchId);
      for (const entry of body.entries ?? []) {
        await assertRefInOrg(organizationId, chartOfAccounts, entry.accountId, 'Template account does not belong to the current organization.');
        await assertRefInOrg(organizationId, costCenters, entry.costCenterId, 'Template cost center does not belong to the current organization.');
      }
      break;
    case 'financial_period':
      await assertRefInOrg(organizationId, fiscalYears, body.fiscalYearId, 'Fiscal year does not belong to the current organization.');
      break;
    case 'bank_account':
      await assertRefInOrg(organizationId, banks, body.bankId, 'Bank does not belong to the current organization.');
      await assertBranchInOrg(organizationId, body.branchId);
      await assertRefInOrg(organizationId, chartOfAccounts, body.glAccountId, 'GL account does not belong to the current organization.');
      break;
    case 'cash_counter':
      await assertBranchInOrg(organizationId, body.branchId);
      await assertRefInOrg(organizationId, orgUsers, body.assignedUserId, 'Assigned user does not belong to the current organization.');
      await assertRefInOrg(organizationId, chartOfAccounts, body.glCashAccountId, 'Cash GL account does not belong to the current organization.');
      break;
    case 'payment_method':
      await assertRefInOrg(organizationId, chartOfAccounts, body.glAccountId, 'GL account does not belong to the current organization.');
      break;
  }
}

// ---------------------------------------------------------------------------
// Usage counts (referenced-row safety for safe-delete)
// ---------------------------------------------------------------------------
async function getUsageCount(entity: EntityConfig, organizationId: string, entityId: string, row: any): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    switch (entity.kind) {
      case 'voucher_type': {
        const [tpls, counters] = await Promise.all([
          db.select({ id: journalTemplates.id }).from(journalTemplates)
            .where(and(eq(journalTemplates.organizationId, organizationId), eq(journalTemplates.voucherTypeId, entityId))),
          db.select({ id: voucherTypeCounters.id }).from(voucherTypeCounters)
            .where(and(eq(voucherTypeCounters.organizationId, organizationId), eq(voucherTypeCounters.voucherTypeId, entityId))),
        ]);
        return tpls.length + counters.length;
      }
      case 'cost_center': {
        const [children, entries] = await Promise.all([
          db.select({ id: costCenters.id }).from(costCenters)
            .where(and(eq(costCenters.organizationId, organizationId), eq(costCenters.parentId, entityId))),
          db.select({ id: journalTemplateEntries.id }).from(journalTemplateEntries)
            .where(and(eq(journalTemplateEntries.organizationId, organizationId), eq(journalTemplateEntries.costCenterId, entityId))),
        ]);
        return children.length + entries.length;
      }
      case 'financial_period': {
        const periodCode = row?.fiscalYearCode ?? row?.code ?? '';
        if (!periodCode) return 0;
        const [used] = await db.select({ c: count() }).from(vouchers)
          .where(and(eq(vouchers.organizationId, organizationId), eq(vouchers.fiscalYearCode, periodCode)));
        return Number(used?.c ?? 0);
      }
      case 'bank': {
        const accounts = await db.select({ id: bankAccounts.id }).from(bankAccounts)
          .where(and(eq(bankAccounts.organizationId, organizationId), eq(bankAccounts.bankId, entityId)));
        return accounts.length;
      }
      case 'bank_account':
        return 0;
      case 'cash_counter':
        return 0;
      case 'payment_method':
        return 0;
    }
  } catch {
    // Non-fatal: return 0 so list still renders.
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Journal template entries (transactional replace + balance validation)
// ---------------------------------------------------------------------------
async function validateTemplateEntries(organizationId: string, entries: any[]) {
  if (!entries || entries.length === 0) return;
  let dr = 0;
  let cr = 0;
  for (const e of entries) {
    const amount = Number(e.amount ?? 0);
    if (e.entryType === 'debit') dr += amount;
    else cr += amount;
  }
  const amountBased = entries.filter((e: any) => (e.amountType ?? 'amount') === 'amount');
  if (amountBased.length > 0 && Math.abs(dr - cr) > 0.01) {
    throw Object.assign(new Error('Journal template entries are unbalanced (debits must equal credits).'), { status: 400 });
  }
  await validateRefs(organizationId, 'journal_template', { entries });
}

function entryValues(organizationId: string, templateId: string, entry: any, index: number) {
  return {
    organizationId,
    templateId,
    accountId: entry.accountId,
    accountCode: String(entry.accountCode ?? '').trim(),
    accountName: String(entry.accountName ?? '').trim(),
    entryType: entry.entryType === 'credit' ? 'credit' : 'debit',
    amountType: entry.amountType === 'percent' ? 'percent' : 'amount',
    amount: money(entry.amount) ?? '0',
    costCenterId: entry.costCenterId || null,
    description: entry.description ? String(entry.description).trim() : null,
    sortOrder: entry.sortOrder !== undefined ? Math.trunc(Number(entry.sortOrder) || 0) : index,
  };
}

async function replaceTemplateEntries(organizationId: string, templateId: string, entries: any[]) {
  const db = getDb();
  await validateTemplateEntries(organizationId, entries);
  await db.transaction(async (tx) => {
    await tx.delete(journalTemplateEntries).where(eq(journalTemplateEntries.templateId, templateId));
    if (entries && entries.length > 0) {
      await tx.insert(journalTemplateEntries).values(entries.map((e, i) => entryValues(organizationId, templateId, e, i)) as any);
    }
  });
}

async function loadTemplateEntries(organizationId: string, templateId: string) {
  const db = getDb();
  const rows = await db.select().from(journalTemplateEntries)
    .where(and(eq(journalTemplateEntries.organizationId, organizationId), eq(journalTemplateEntries.templateId, templateId)))
    .orderBy(asc(journalTemplateEntries.sortOrder), asc(journalTemplateEntries.id));
  return rows.map((r: any) => ({
    id: r.id,
    accountId: r.accountId,
    accountCode: r.accountCode,
    accountName: r.accountName,
    entryType: r.entryType,
    amountType: r.amountType,
    amount: Number(r.amount ?? 0),
    costCenterId: r.costCenterId ?? null,
    description: r.description || null,
    sortOrder: r.sortOrder ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Financial period helpers
// ---------------------------------------------------------------------------
async function enforceSingleCurrent(organizationId: string, keepId: string, isCurrent: boolean) {
  if (!isCurrent) return;
  const db = getDb();
  await db.update(financialPeriods)
    .set({ isCurrent: false, updatedAt: new Date() })
    .where(and(eq(financialPeriods.organizationId, organizationId), ne(financialPeriods.id, keepId)));
}

async function assertNoRangeOverlap(organizationId: string, startDateBs: string, endDateBs: string, excludeId?: string) {
  const db = getDb();
  const existing = await db.select().from(financialPeriods)
    .where(eq(financialPeriods.organizationId, organizationId));
  const conflict = findOverlappingFiscalYear(
    existing.map((r: any) => ({ id: r.id, startDateBS: r.startDateBs, endDateBS: r.endDateBs })),
    { startDateBS: startDateBs, endDateBS: endDateBs },
    excludeId,
  );
  if (conflict) {
    throw Object.assign(new Error(`Financial period overlaps "${(conflict as any).code || (conflict as any).name || 'another period'}" (${(conflict as any).startDateBS} – ${(conflict as any).endDateBS}).`), { status: 400 });
  }
}

/**
 * Resolve the parent fiscal year for a financial period.
 *
 * Golden rule: a financial period is a CHILD of a fiscal year — it can never
 * exist on its own. The parent is resolved by `fiscalYearId` when supplied,
 * otherwise by `fiscalYearCode`, and the organization must have at least one
 * non-closed (active) fiscal year before any period may be created.
 *
 * @param requireActive true on create — blocks periods when no active fiscal
 *   year exists and rejects a closed parent. Updates only need the parent to
 *   still resolve, so historical periods stay editable.
 */
async function resolveParentFiscalYear(
  organizationId: string,
  body: Record<string, any>,
  existing?: { fiscalYearId?: string | null; fiscalYearCode?: string | null },
  requireActive = false,
) {
  const db = getDb();
  const rows = await db.select().from(fiscalYears)
    .where(eq(fiscalYears.organizationId, organizationId));

  if (rows.length === 0) {
    throw Object.assign(
      new Error('No fiscal year has been configured for this organization. Set up and activate a fiscal year before creating a financial period.'),
      { status: 400 },
    );
  }
  if (requireActive && !rows.some((r: any) => r.status !== 'closed')) {
    throw Object.assign(
      new Error('Every fiscal year is closed. Activate or create an open fiscal year before creating a financial period.'),
      { status: 400 },
    );
  }

  const wantedId = body.fiscalYearId ?? existing?.fiscalYearId ?? null;
  const wantedCode = String(body.fiscalYearCode ?? existing?.fiscalYearCode ?? '').trim().toUpperCase();

  const parent = (wantedId && rows.find((r: any) => String(r.id) === String(wantedId)))
    || (wantedCode && rows.find((r: any) => String(r.code).trim().toUpperCase() === wantedCode))
    || null;

  if (!parent) {
    throw Object.assign(
      new Error(`Fiscal year "${wantedCode || wantedId || '—'}" does not exist in this organization. A financial period must belong to an existing fiscal year.`),
      { status: 400 },
    );
  }
  if (requireActive && (parent as any).status === 'closed') {
    throw Object.assign(
      new Error(`Fiscal year "${(parent as any).code}" is closed. Financial periods can only be created inside an open fiscal year.`),
      { status: 400 },
    );
  }
  return parent as any;
}

/** A period's BS range must sit fully inside its parent fiscal year's range. */
function assertWithinFiscalYear(parent: any, startDateBs: string, endDateBs: string) {
  const breaches = bsRangeBreaches(
    { startDateBS: startDateBs, endDateBS: endDateBs },
    { startDateBS: parent.startDateBs, endDateBS: parent.endDateBs },
  );
  if (breaches.length === 0) return;
  const bound = `${parent.startDateBs} → ${parent.endDateBs}`;
  const detail = breaches.includes('start') && breaches.includes('end')
    ? `${startDateBs} → ${endDateBs} falls outside`
    : breaches.includes('start')
      ? `start date ${startDateBs} is before`
      : `end date ${endDateBs} is after`;
  throw Object.assign(
    new Error(`Financial period ${detail} fiscal year "${parent.code}" (${bound}). Keep the period inside its fiscal year.`),
    { status: 400 },
  );
}

// ===========================================================================
// Controller
// ===========================================================================
export class AccountingSettingController {

  // -------------------------------------------------------------------------
  // Registry CRUD
  // -------------------------------------------------------------------------
  static async getSettings(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const entity = resolveEntity(String(req.params.entityType));
      if (!entity) return res.status(400).json({ error: 'Unknown accounting settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const conditions: any[] = [eq(entity.table.organizationId, organizationId)];
      const search = String(req.query.search ?? '').trim();
      if (search && entity.hasCode) {
        conditions.push(orLike(entity, search));
      }
      const active = req.query.active as string | undefined;
      if (active === 'true' || active === 'false' && entity.hasIsActive) {
        conditions.push(eq(entity.table.isActive, active === 'true'));
      }

      const rows = await db.select().from(entity.table).where(and(...conditions))
        .orderBy(entity.hasSortOrder ? asc(entity.table.sortOrder) : asc(entity.table.createdAt));

      const normalized: any[] = [];
      for (const r of rows as any[]) {
        const item = { ...normalize(r, entity.kind), usageCount: await getUsageCount(entity, organizationId, r.id, r) };
        if (entity.kind === 'journal_template') {
          item.entries = await loadTemplateEntries(organizationId, r.id);
        }
        // For bank accounts, compute authoritative GL balance from voucher entries
        if (entity.kind === 'bank_account' && r.glAccountId) {
          const entries = await db.select({ debit: voucherEntries.debit, credit: voucherEntries.credit })
            .from(voucherEntries)
            .where(eq(voucherEntries.accountId, r.glAccountId));
          let glBalance = 0;
          for (const e of entries) {
            glBalance += Number(e.debit || 0) - Number(e.credit || 0);
          }
          item.glBalance = Math.round(glBalance * 100) / 100;
        }
        normalized.push(item);
      }
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
      if (!entity) return res.status(400).json({ error: 'Unknown accounting settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [row] = await db.select().from(entity.table)
        .where(and(eq(entity.table.id, req.params.id), eq(entity.table.organizationId, organizationId)))
        .limit(1);
      if (!row) return res.status(404).json({ error: `${entity.label} not found` });
      const item = { ...normalize(row, entity.kind), usageCount: await getUsageCount(entity, organizationId, row.id, row) };
      if (entity.kind === 'journal_template') {
        item.entries = await loadTemplateEntries(organizationId, row.id);
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** GET /accounting/settings/bank-accounts/:id/detail — full bank account detail with cheque books & leaves. */
  static async getBankAccountDetail(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'Bank account id is required.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      // Fetch bank account + bank + GL account
      const [bankAcc] = await db.select({
        id: bankAccounts.id,
        organizationId: bankAccounts.organizationId,
        bankId: bankAccounts.bankId,
        accountName: bankAccounts.accountName,
        accountNumber: bankAccounts.accountNumber,
        branchId: bankAccounts.branchId,
        currency: bankAccounts.currency,
        glAccountId: bankAccounts.glAccountId,
        accountType: bankAccounts.accountType,
        openingBalance: bankAccounts.openingBalance,
        openingDateBs: bankAccounts.openingDateBs,
        isPrimary: bankAccounts.isPrimary,
        reconciliationEnabled: bankAccounts.reconciliationEnabled,
        lastReconciledDateBs: bankAccounts.lastReconciledDateBs,
        isActive: bankAccounts.isActive,
        isSystem: bankAccounts.isSystem,
        createdAt: bankAccounts.createdAt,
        bankName: banks.name,
        bankCode: banks.code,
        glAccountName: chartOfAccounts.name,
        glAccountCode: chartOfAccounts.code,
      })
        .from(bankAccounts)
        .leftJoin(banks, eq(bankAccounts.bankId, banks.id))
        .leftJoin(chartOfAccounts, eq(bankAccounts.glAccountId, chartOfAccounts.id))
        .where(and(eq(bankAccounts.id, id), eq(bankAccounts.organizationId, organizationId)))
        .limit(1);

      if (!bankAcc) return res.status(404).json({ error: 'Bank account not found.' });

      // Fetch cheque books
      const books = await db.select({
        id: bankChequeBooks.id,
        bookNumber: bankChequeBooks.bookNumber,
        prefix: bankChequeBooks.prefix,
        leafStartNumber: bankChequeBooks.leafStartNumber,
        leafEndNumber: bankChequeBooks.leafEndNumber,
        leafCount: bankChequeBooks.leafCount,
        issuedDateBs: bankChequeBooks.issuedDateBs,
        status: bankChequeBooks.status,
        purpose: bankChequeBooks.purpose,
        leafNumbersJson: bankChequeBooks.leafNumbersJson,
        cancelReason: bankChequeBooks.cancelReason,
        createdAt: bankChequeBooks.createdAt,
      })
        .from(bankChequeBooks)
        .where(and(eq(bankChequeBooks.organizationId, organizationId), eq(bankChequeBooks.bankAccountId, bankAcc.glAccountId)))
        .orderBy(asc(bankChequeBooks.createdAt));

      // Fetch all leaves (with status counts)
      const leaves = await db.select({
        id: bankChequeLeaves.id,
        chequeNumber: bankChequeLeaves.chequeNumber,
        leafNo: bankChequeLeaves.leafNo,
        chequeBookId: bankChequeLeaves.chequeBookId,
        status: bankChequeLeaves.status,
        payeeName: bankChequeLeaves.payeeName,
        amount: bankChequeLeaves.amount,
        chequeDateBs: bankChequeLeaves.chequeDateBs,
        loanId: bankChequeLeaves.loanId,
        voucherId: bankChequeLeaves.voucherId,
        usedAt: bankChequeLeaves.usedAt,
        cancelReason: bankChequeLeaves.cancelReason,
        createdAt: bankChequeLeaves.createdAt,
      })
        .from(bankChequeLeaves)
        .where(and(eq(bankChequeLeaves.organizationId, organizationId), eq(bankChequeLeaves.bankAccountId, bankAcc.glAccountId)))
        .orderBy(asc(bankChequeLeaves.leafNo));

      // Compute GL balance from voucher entries
      let glBalance = 0;
      if (bankAcc.glAccountId) {
        const entries = await db.select({ debit: voucherEntries.debit, credit: voucherEntries.credit })
          .from(voucherEntries)
          .where(eq(voucherEntries.accountId, bankAcc.glAccountId));
        for (const e of entries) {
          glBalance += Number(e.debit || 0) - Number(e.credit || 0);
        }
      }

      // Leaf status counts
      const statusCounts = { unused: 0, issued: 0, cancelled: 0, cleared: 0 };
      for (const l of leaves) {
        if (l.status in statusCounts) statusCounts[l.status as keyof typeof statusCounts]++;
      }

      res.json({
        bankAccount: bankAcc,
        chequeBooks: books,
        chequeLeaves: leaves,
        glBalance,
        leafStatusCounts: statusCounts,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** GET /bank-accounts/:id/transactions — GL voucher entries for this bank account's GL ledger. */
  static async getBankTransactions(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'Bank account id is required.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      // Resolve the GL account for this bank account
      const [bankAcc] = await db.select({ glAccountId: bankAccounts.glAccountId })
        .from(bankAccounts)
        .where(and(eq(bankAccounts.id, id), eq(bankAccounts.organizationId, organizationId)))
        .limit(1);
      if (!bankAcc) return res.status(404).json({ error: 'Bank account not found.' });
      if (!bankAcc.glAccountId) return res.json({ transactions: [], glBalance: 0 });

      // Query params
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const chequeOnly = req.query.chequeOnly === 'true';

      // Fetch voucher entries joined with vouchers + optional cheque leaf
      const conditions = [
        eq(voucherEntries.organizationId, organizationId),
        eq(voucherEntries.accountId, bankAcc.glAccountId),
      ];

      // Calculate opening balance: sum of ALL entries before startDate (zero if no filter)
      let openingBalance = 0;
      if (startDate) {
        const allConditions = [
          eq(voucherEntries.organizationId, organizationId),
          eq(voucherEntries.accountId, bankAcc.glAccountId),
          lt(vouchers.dateBs, startDate),
        ];
        const [openingAgg] = await db.select({
          totalDebit: sql<number>`COALESCE(sum(${voucherEntries.debit}), 0)`,
          totalCredit: sql<number>`COALESCE(sum(${voucherEntries.credit}), 0)`,
        })
          .from(voucherEntries)
          .innerJoin(vouchers, eq(voucherEntries.voucherId, vouchers.id))
          .where(and(...allConditions));
        openingBalance = Number(openingAgg?.totalDebit || 0) - Number(openingAgg?.totalCredit || 0);
      }

      // Apply date filters for the displayed transactions
      if (startDate) conditions.push(gte(vouchers.dateBs, startDate));
      if (endDate) conditions.push(lte(vouchers.dateBs, endDate));

      const rows = await db.select({
        id: voucherEntries.id,
        voucherId: voucherEntries.voucherId,
        accountId: voucherEntries.accountId,
        debit: voucherEntries.debit,
        credit: voucherEntries.credit,
        narration: voucherEntries.narration,
        voucherNo: vouchers.voucherNo,
        voucherType: vouchers.voucherType,
        dateBs: vouchers.dateBs,
        dateAd: vouchers.dateAd,
        status: vouchers.status,
        chequeLeafId: bankChequeLeaves.id,
        chequeNumber: bankChequeLeaves.chequeNumber,
        chequeStatus: bankChequeLeaves.status,
        moduleReference: vouchers.moduleReference,
      })
        .from(voucherEntries)
        .innerJoin(vouchers, eq(voucherEntries.voucherId, vouchers.id))
        .leftJoin(bankChequeLeaves, eq(bankChequeLeaves.voucherId, vouchers.id))
        .where(and(...conditions))
        .orderBy(asc(vouchers.dateBs), asc(voucherEntries.id));

      // Compute running balance (bank statement style: oldest first)
      let running = openingBalance;
      const transactions = rows.map((r) => {
        running += Number(r.debit || 0) - Number(r.credit || 0);
        return {
          id: r.id,
          voucherId: r.voucherId,
          voucherNo: r.voucherNo,
          voucherType: r.voucherType,
          dateBs: r.dateBs,
          dateAd: r.dateAd,
          narration: r.narration,
          debit: Number(r.debit || 0),
          credit: Number(r.credit || 0),
          runningBalance: running,
          chequeNumber: r.chequeNumber ?? null,
          chequeStatus: r.chequeStatus ?? null,
          chequeLeafId: r.chequeLeafId ?? null,
          moduleReference: r.moduleReference ?? null,
        };
      });

      // Filter cheque-only if requested
      const filtered = chequeOnly ? transactions.filter((t) => t.chequeLeafId) : transactions;

      // Final GL balance (all entries, no date filter)
      const [finalAgg] = await db.select({
        totalDebit: sql<number>`COALESCE(sum(${voucherEntries.debit}), 0)`,
        totalCredit: sql<number>`COALESCE(sum(${voucherEntries.credit}), 0)`,
      })
        .from(voucherEntries)
        .where(and(eq(voucherEntries.organizationId, organizationId), eq(voucherEntries.accountId, bankAcc.glAccountId)));

      const glBalance = Number(finalAgg?.totalDebit || 0) - Number(finalAgg?.totalCredit || 0);

      res.json({ transactions: filtered, glBalance, openingBalance });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** GET /bank-accounts/balance-summaries — aggregated balance summaries for all bank accounts. */
  static async getBalanceSummaries(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      // Get all bank accounts with GL linked
      const accounts = await db.select({
        id: bankAccounts.id,
        accountName: bankAccounts.accountName,
        accountNumber: bankAccounts.accountNumber,
        glAccountId: bankAccounts.glAccountId,
        openingBalance: bankAccounts.openingBalance,
      })
        .from(bankAccounts)
        .where(and(eq(bankAccounts.organizationId, organizationId), eq(bankAccounts.isActive, true)));

      const glAccountIds = accounts.filter(a => a.glAccountId).map(a => a.glAccountId!);
      if (glAccountIds.length === 0) {
        return res.json([]);
      }

      // Aggregate debit/credit totals per GL account in one query
      const aggRows = await db.select({
        accountId: voucherEntries.accountId,
        totalDebit: sql<number>`COALESCE(sum(${voucherEntries.debit}), 0)`,
        totalCredit: sql<number>`COALESCE(sum(${voucherEntries.credit}), 0)`,
        txCount: sql<number>`COUNT(*)::int`,
      })
        .from(voucherEntries)
        .where(and(
          eq(voucherEntries.organizationId, organizationId),
          inArray(voucherEntries.accountId, glAccountIds),
        ))
        .groupBy(voucherEntries.accountId);

      const aggMap = new Map(aggRows.map(r => [r.accountId, r]));

      const summaries = accounts.map(a => {
        if (!a.glAccountId) {
          return {
            id: a.id,
            accountName: a.accountName,
            accountNumber: a.accountNumber,
            openingBalance: Number(a.openingBalance) || 0,
            totalDeposits: 0,
            totalWithdrawals: 0,
            currentBalance: Number(a.openingBalance) || 0,
            transactionCount: 0,
          };
        }
        const agg = aggMap.get(a.glAccountId);
        const totalDebit = Number(agg?.totalDebit || 0);
        const totalCredit = Number(agg?.totalCredit || 0);
        const opening = Number(a.openingBalance) || 0;
        // For bank GL (Asset): debit increases, credit decreases
        // totalDeposits = sum of debits, totalWithdrawals = sum of credits
        // currentBalance = opening + debits - credits
        return {
          id: a.id,
          accountName: a.accountName,
          accountNumber: a.accountNumber,
          openingBalance: opening,
          totalDeposits: totalDebit,
          totalWithdrawals: totalCredit,
          currentBalance: opening + totalDebit - totalCredit,
          transactionCount: agg?.txCount || 0,
        };
      });

      res.json(summaries);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createSetting(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const entity = resolveEntity(String(req.params.entityType));
      if (!entity) return res.status(400).json({ error: 'Unknown accounting settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      // Required identity fields per kind.
      if (entity.kind === 'bank_account') {
        if (!body.accountName || !body.accountNumber) return res.status(400).json({ error: 'Account name and number are required.' });
      } else if (entity.hasCode) {
        const code = String(body.code ?? '').trim().toUpperCase();
        const name = String(body.name ?? '').trim();
        if (!code || !name) return res.status(400).json({ error: 'Code and name are required.' });
      }

      const dup = await findDuplicate(entity, organizationId, body);
      if (dup) return res.status(409).json({ error: `A ${entity.label.toLowerCase()} with this identifier already exists.` });

      await validateRefs(organizationId, entity.kind, body);

      const values: Record<string, any> = {
        organizationId,
        ...baseValues(entity, body),
        ...kindValues(entity.kind, body),
        isSystem: false,
        createdBy: req.user?.userId ?? null,
      };

      let row: any;
      if (entity.kind === 'financial_period') {
        // Rule 1 — strict dependency: no active fiscal year ⇒ no financial period.
        const parentFy = await resolveParentFiscalYear(organizationId, body, undefined, true);
        values.fiscalYearId = parentFy.id;
        values.fiscalYearCode = parentFy.code;
        // Rule 2 — the period must live inside its parent fiscal year's bounds.
        assertWithinFiscalYear(parentFy, values.startDateBs, values.endDateBs);
        await assertNoRangeOverlap(organizationId, values.startDateBs, values.endDateBs);
        row = (await db.insert(financialPeriods).values(values as any).returning())[0];
        await enforceSingleCurrent(organizationId, row.id, !!values.isCurrent);
      } else {
        row = (await db.insert(entity.table).values(values).returning())[0];
      }

      let extra = { ...normalize(row, entity.kind), usageCount: 0 };
      if (entity.kind === 'journal_template') {
        await replaceTemplateEntries(organizationId, row.id, body.entries ?? []);
        extra.entries = await loadTemplateEntries(organizationId, row.id);
      }

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Accounting Settings',
        eventName(entity.kind, 'created'),
        `Created ${entity.label.toLowerCase()} "${extra.name ?? extra.code ?? extra.accountName ?? row.id}"`,
      ));

      res.status(201).json(extra);
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
      if (!entity) return res.status(400).json({ error: 'Unknown accounting settings entity type.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [existing] = await db.select().from(entity.table).where(eq(entity.table.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: `${entity.label} not found` });
      if (String(existing.organizationId) !== String(organizationId)) {
        return res.status(403).json({ error: `Not authorized to edit this ${entity.label.toLowerCase()}.` });
      }

      const dupBody: Record<string, any> = {
        ...body,
        code: body.code ?? existing.code,
        name: body.name ?? existing.name,
        accountName: body.accountName ?? existing.accountName,
        accountNumber: body.accountNumber ?? existing.accountNumber,
      };
      const dup = await findDuplicate(entity, organizationId, dupBody, existing.id);
      if (dup) return res.status(409).json({ error: `A ${entity.label.toLowerCase()} with this identifier already exists.` });

      await validateRefs(organizationId, entity.kind, body);

      if (entity.kind === 'cost_center' && body.parentId && String(body.parentId) === String(existing.id)) {
        return res.status(400).json({ error: 'A cost center cannot be its own parent.' });
      }

      const before = normalize(existing, entity.kind);

      const update: Record<string, any> = {
        ...baseValues(entity, body),
        ...kindValues(entity.kind, body),
        updatedBy: req.user?.userId ?? null,
        updatedAt: new Date(),
      };

      let row: any;
      if (entity.kind === 'financial_period') {
        const start = update.startDateBs ?? existing.startDateBs;
        const end = update.endDateBs ?? existing.endDateBs;
        const parentFy = await resolveParentFiscalYear(organizationId, body, existing as any);
        update.fiscalYearId = parentFy.id;
        update.fiscalYearCode = parentFy.code;
        assertWithinFiscalYear(parentFy, start, end);
        await assertNoRangeOverlap(organizationId, start, end, existing.id);
        row = (await db.update(financialPeriods).set(update).where(eq(financialPeriods.id, existing.id)).returning())[0];
        await enforceSingleCurrent(organizationId, row.id, row.isCurrent === true);
      } else {
        row = (await db.update(entity.table).set(update).where(eq(entity.table.id, existing.id)).returning())[0];
      }

      let extra = { ...normalize(row, entity.kind), usageCount: await getUsageCount(entity, organizationId, row.id, row) };
      if (entity.kind === 'journal_template') {
        await replaceTemplateEntries(organizationId, row.id, body.entries ?? []);
        extra.entries = await loadTemplateEntries(organizationId, row.id);
      }

      const diff = computeDiff(before, normalize(row, entity.kind));
      const { oldValue, newValue } = splitDiffIntoSnapshots(diff);
      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Accounting Settings',
        eventName(entity.kind, 'updated'),
        `Updated ${entity.label.toLowerCase()} "${extra.name ?? extra.code ?? extra.accountName ?? row.id}"`,
        { oldValue, newValue },
      ));

      res.json(extra);
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
      if (!entity) return res.status(400).json({ error: 'Unknown accounting settings entity type.' });

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

      const inUse = await getUsageCount(entity, organizationId, existing.id, existing);
      if (inUse > 0) {
        return res.status(400).json({ error: `This ${entity.label.toLowerCase()} cannot be deleted because it is in use. Deactivate it instead.` });
      }

      await db.delete(entity.table).where(eq(entity.table.id, existing.id));

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Accounting Settings',
        eventName(entity.kind, 'deleted'),
        `Deleted ${entity.label.toLowerCase()} "${existing.name ?? existing.code ?? existing.accountName ?? existing.id}"`,
      ));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // -------------------------------------------------------------------------
  // Chart of Accounts & Account Groups
  // -------------------------------------------------------------------------
  static async getAccounts(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const [accounts, groups] = await Promise.all([
        db.select().from(chartOfAccounts).where(eq(chartOfAccounts.organizationId, organizationId)).orderBy(asc(chartOfAccounts.code)),
        db.select().from(accountGroups).where(eq(accountGroups.organizationId, organizationId)).orderBy(asc(accountGroups.code)),
      ]);
      res.json({
        accounts: accounts.map((a: any) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          nameNepali: a.nameNepali || null,
          type: a.type,
          parentCode: a.parentCode || null,
          groupId: a.groupId || null,
          balance: Number(a.balance ?? 0),
          normalBalance: a.normalBalance ?? 'debit',
          allowPosting: a.allowPosting !== false,
          isSystemAccount: !!a.isSystemAccount,
          isControlAccount: !!a.isControlAccount,
          cashBankAccount: !!a.cashBankAccount,
          reconciliationRequired: !!a.reconciliationRequired,
          costCenterRequired: !!a.costCenterRequired,
          displayOrder: a.displayOrder ?? 0,
          branchId: a.branchId || null,
          description: a.description || null,
          isActive: a.isActive !== false,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        })),
        groups: groups.map((g: any) => ({
          id: g.id,
          code: g.code,
          name: g.name,
          type: g.type,
          parentId: g.parentId || null,
          isSystem: !!g.isSystem,
          createdAt: g.createdAt,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createAccount(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const code = String(body.code ?? '').trim().toUpperCase();
      const name = String(body.name ?? '').trim();
      if (!code || !name) return res.status(400).json({ error: 'Code and name are required.' });

      const [dup] = await db.select({ id: chartOfAccounts.id }).from(chartOfAccounts)
        .where(and(eq(chartOfAccounts.organizationId, organizationId), eq(chartOfAccounts.code, code)))
        .limit(1);
      if (dup) return res.status(409).json({ error: 'An account with this code already exists.' });

      if (body.parentCode) {
        await assertParentCode(organizationId, body.parentCode, code);
      }

      const [row] = await db.insert(chartOfAccounts).values({
        organizationId,
        code,
        name,
        nameNepali: body.nameNepali ? String(body.nameNepali).trim() : null,
        type: body.type,
        parentCode: body.parentCode ? String(body.parentCode).trim().toUpperCase() : null,
        normalBalance: body.normalBalance === 'credit' ? 'credit' : 'debit',
        allowPosting: body.allowPosting !== false,
        isControlAccount: body.isControlAccount === true,
        cashBankAccount: body.cashBankAccount === true,
        reconciliationRequired: body.reconciliationRequired === true,
        costCenterRequired: body.costCenterRequired === true,
        displayOrder: Math.trunc(Number(body.displayOrder) || 0),
        branchId: body.branchId || null,
        description: body.description ? String(body.description).trim() : null,
        isActive: body.isActive !== false,
        balance: '0',
      }).returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req), 'Accounting Settings', 'accounting_coa_created',
        `Created chart account "${name}" (${code})`,
      ));

      res.status(201).json(row);
    } catch (error: any) {
      const status = error?.status || 500;
      res.status(status).json({ error: error.message });
    }
  }

  static async updateAccount(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [existing] = await db.select().from(chartOfAccounts).where(eq(chartOfAccounts.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Account not found' });
      if (String(existing.organizationId) !== String(organizationId)) {
        return res.status(403).json({ error: 'Not authorized to edit this account.' });
      }

      if (body.code !== undefined && String(body.code).trim().toUpperCase() !== existing.code) {
        const [dup] = await db.select({ id: chartOfAccounts.id }).from(chartOfAccounts)
          .where(and(eq(chartOfAccounts.organizationId, organizationId), eq(chartOfAccounts.code, String(body.code).trim().toUpperCase()), ne(chartOfAccounts.id, existing.id)))
          .limit(1);
        if (dup) return res.status(409).json({ error: 'An account with this code already exists.' });
      }

      const newParent = body.parentCode !== undefined ? String(body.parentCode).trim().toUpperCase() : existing.parentCode;
      const newCode = body.code !== undefined ? String(body.code).trim().toUpperCase() : existing.code;
      if (newParent) {
        await assertParentCode(organizationId, newParent, newCode, existing.id);
      }

      const update: Record<string, any> = { updatedAt: new Date() };
      if (body.code !== undefined) update.code = newCode;
      if (body.name !== undefined) update.name = String(body.name).trim();
      if (body.nameNepali !== undefined) update.nameNepali = body.nameNepali ? String(body.nameNepali).trim() : null;
      if (body.type !== undefined) update.type = body.type;
      if (body.parentCode !== undefined) update.parentCode = newParent || null;
      if (body.normalBalance !== undefined) update.normalBalance = body.normalBalance === 'credit' ? 'credit' : 'debit';
      if (body.allowPosting !== undefined) update.allowPosting = body.allowPosting === true;
      if (body.isControlAccount !== undefined) update.isControlAccount = body.isControlAccount === true;
      if (body.cashBankAccount !== undefined) update.cashBankAccount = body.cashBankAccount === true;
      if (body.reconciliationRequired !== undefined) update.reconciliationRequired = body.reconciliationRequired === true;
      if (body.costCenterRequired !== undefined) update.costCenterRequired = body.costCenterRequired === true;
      if (body.displayOrder !== undefined) update.displayOrder = Math.trunc(Number(body.displayOrder) || 0);
      if (body.branchId !== undefined) update.branchId = body.branchId || null;
      if (body.description !== undefined) update.description = body.description ? String(body.description).trim() : null;
      if (body.isActive !== undefined) update.isActive = body.isActive === true;

      const [row] = await db.update(chartOfAccounts).set(update)
        .where(and(eq(chartOfAccounts.id, existing.id), eq(chartOfAccounts.organizationId, organizationId)))
        .returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req), 'Accounting Settings', 'accounting_coa_updated',
        `Updated chart account "${row.name}" (${row.code})`,
      ));

      res.json(row);
    } catch (error: any) {
      const status = error?.status || 500;
      res.status(status).json({ error: error.message });
    }
  }

  static async deleteAccount(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [existing] = await db.select().from(chartOfAccounts).where(eq(chartOfAccounts.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Account not found' });
      if (String(existing.organizationId) !== String(organizationId)) {
        return res.status(403).json({ error: 'Not authorized to delete this account.' });
      }
      if (existing.isSystemAccount) {
        return res.status(400).json({ error: 'System accounts cannot be deleted.' });
      }

      const [children] = await db.select({ id: chartOfAccounts.id }).from(chartOfAccounts)
        .where(and(eq(chartOfAccounts.organizationId, organizationId), eq(chartOfAccounts.parentCode, existing.code)))
        .limit(1);
      if (children) return res.status(400).json({ error: 'This account has child accounts. Reassign or remove them first.' });

      const [used] = await db.select({ id: voucherEntries.id }).from(voucherEntries)
        .where(and(eq(voucherEntries.organizationId, organizationId), eq(voucherEntries.accountId, existing.id)))
        .limit(1);
      if (used) return res.status(400).json({ error: 'This account is referenced by ledger entries and cannot be deleted. Deactivate it instead.' });

      const [refs] = await db.select({ id: systemAccountMappings.id }).from(systemAccountMappings)
        .where(and(eq(systemAccountMappings.organizationId, organizationId), eq(systemAccountMappings.accountId, existing.id)))
        .limit(1);
      if (refs) return res.status(400).json({ error: 'This account is wired as a system account. Re-map it before deleting.' });

      await db.delete(chartOfAccounts).where(eq(chartOfAccounts.id, existing.id));

      await writeAuditLog(buildAuditRow(
        reqActor(req), 'Accounting Settings', 'accounting_coa_deleted',
        `Deleted chart account "${existing.name}" (${existing.code})`,
      ));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getAccountGroups(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const rows = await db.select().from(accountGroups).where(eq(accountGroups.organizationId, organizationId)).orderBy(asc(accountGroups.code));
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createAccountGroup(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;
      const code = String(body.code ?? '').trim().toUpperCase();
      const name = String(body.name ?? '').trim();
      if (!code || !name) return res.status(400).json({ error: 'Code and name are required.' });

      const [dup] = await db.select({ id: accountGroups.id }).from(accountGroups)
        .where(and(eq(accountGroups.organizationId, organizationId), eq(accountGroups.code, code)))
        .limit(1);
      if (dup) return res.status(409).json({ error: 'An account group with this code already exists.' });

      if (body.parentId) {
        await assertRefInOrg(organizationId, accountGroups, body.parentId, 'Parent group does not belong to the current organization.');
      }

      const [row] = await db.insert(accountGroups).values({
        organizationId,
        code,
        name,
        type: body.type,
        parentId: body.parentId || null,
      }).returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req), 'Accounting Settings', 'accounting_account_group_created',
        `Created account group "${name}" (${code})`,
      ));

      res.status(201).json(row);
    } catch (error: any) {
      const status = error?.status || 500;
      res.status(status).json({ error: error.message });
    }
  }

  static async updateAccountGroup(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [existing] = await db.select().from(accountGroups).where(eq(accountGroups.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Account group not found' });
      if (String(existing.organizationId) !== String(organizationId)) {
        return res.status(403).json({ error: 'Not authorized to edit this group.' });
      }

      const update: Record<string, any> = {};
      if (body.code !== undefined) {
        const code = String(body.code).trim().toUpperCase();
        const [dup] = await db.select({ id: accountGroups.id }).from(accountGroups)
          .where(and(eq(accountGroups.organizationId, organizationId), eq(accountGroups.code, code), ne(accountGroups.id, existing.id)))
          .limit(1);
        if (dup) return res.status(409).json({ error: 'An account group with this code already exists.' });
        update.code = code;
      }
      if (body.name !== undefined) update.name = String(body.name).trim();
      if (body.type !== undefined) update.type = body.type;
      if (body.parentId !== undefined) {
        if (body.parentId && String(body.parentId) === String(existing.id)) {
          return res.status(400).json({ error: 'An account group cannot be its own parent.' });
        }
        await assertRefInOrg(organizationId, accountGroups, body.parentId || null, 'Parent group does not belong to the current organization.');
        update.parentId = body.parentId || null;
      }

      const [row] = await db.update(accountGroups).set(update)
        .where(and(eq(accountGroups.id, existing.id), eq(accountGroups.organizationId, organizationId)))
        .returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req), 'Accounting Settings', 'accounting_account_group_updated',
        `Updated account group "${row.name}" (${row.code})`,
      ));

      res.json(row);
    } catch (error: any) {
      const status = error?.status || 500;
      res.status(status).json({ error: error.message });
    }
  }

  static async deleteAccountGroup(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [existing] = await db.select().from(accountGroups).where(eq(accountGroups.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Account group not found' });
      if (String(existing.organizationId) !== String(organizationId)) {
        return res.status(403).json({ error: 'Not authorized to delete this group.' });
      }
      if (existing.isSystem) return res.status(400).json({ error: 'System account groups cannot be deleted.' });

      const [childGroups] = await db.select({ id: accountGroups.id }).from(accountGroups)
        .where(and(eq(accountGroups.organizationId, organizationId), eq(accountGroups.parentId, existing.id)))
        .limit(1);
      if (childGroups) return res.status(400).json({ error: 'This group has child groups. Reassign or remove them first.' });

      const [accounts] = await db.select({ id: chartOfAccounts.id }).from(chartOfAccounts)
        .where(and(eq(chartOfAccounts.organizationId, organizationId), eq(chartOfAccounts.groupId, existing.id)))
        .limit(1);
      if (accounts) return res.status(400).json({ error: 'This group contains accounts and cannot be deleted.' });

      await db.delete(accountGroups).where(eq(accountGroups.id, existing.id));

      await writeAuditLog(buildAuditRow(
        reqActor(req), 'Accounting Settings', 'accounting_account_group_deleted',
        `Deleted account group "${existing.name}" (${existing.code})`,
      ));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // -------------------------------------------------------------------------
  // Financial period status transitions
  // -------------------------------------------------------------------------
  static async transitionPeriod(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [existing] = await db.select().from(financialPeriods).where(eq(financialPeriods.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Financial period not found' });
      if (String(existing.organizationId) !== String(organizationId)) {
        return res.status(403).json({ error: 'Not authorized to change this period.' });
      }

      const target = body.status;
      const reason = body.reason ? String(body.reason).trim() : null;
      const allowed: Record<string, string[]> = {
        open: ['draft', 'locked'],
        locked: ['open'],
        closed: ['open', 'locked'],
        reopen: ['closed'],
      };
      const from = existing.status;
      if (!allowed[target]?.includes(from)) {
        return res.status(400).json({ error: `Cannot move a period from "${from}" to "${target}".` });
      }
      if ((target === 'closed' || target === 'locked') && !reason) {
        return res.status(400).json({ error: `A reason is required to ${target === 'closed' ? 'close' : 'lock'} a period.` });
      }

      const actorName = req.user?.username || req.user?.userId || 'unknown';
      const update: Record<string, any> = { status: target, updatedAt: new Date(), updatedBy: req.user?.userId ?? null };
      if (target === 'closed') {
        update.closedAt = new Date();
        update.closedBy = actorName;
        update.reason = reason;
      } else if (target === 'locked') {
        update.lockedAt = new Date();
        update.lockedBy = actorName;
        update.reason = reason;
      } else if (target === 'reopen') {
        update.closedAt = null;
        update.closedBy = null;
        update.lockedAt = null;
        update.lockedBy = null;
        update.reason = null;
      }

      const [row] = await db.update(financialPeriods).set(update)
        .where(and(eq(financialPeriods.id, existing.id), eq(financialPeriods.organizationId, organizationId)))
        .returning();

      if (target === 'open') {
        await db.update(financialPeriods)
          .set({ isCurrent: false, updatedAt: new Date() })
          .where(and(eq(financialPeriods.organizationId, organizationId), ne(financialPeriods.id, existing.id)));
        await db.update(financialPeriods)
          .set({ isCurrent: true, updatedAt: new Date() })
          .where(eq(financialPeriods.id, existing.id));
        row.isCurrent = true;
      }

      await writeAuditLog(buildAuditRow(
        reqActor(req), 'Accounting Settings', `accounting_financial_period_${target}`,
        `Financial period "${existing.name}" (${existing.code}) moved from ${from} to ${target}${reason ? ` — ${reason}` : ''}`,
      ));

      res.json({ ...normalize(row, 'financial_period') });
    } catch (error: any) {
      const status = error?.status || 500;
      res.status(status).json({ error: error.message });
    }
  }

  // -------------------------------------------------------------------------
  // System account mappings
  // -------------------------------------------------------------------------
  static async getSystemMappings(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const rows = await db.select({
        mappingKey: systemAccountMappings.mappingKey,
        accountId: systemAccountMappings.accountId,
        description: systemAccountMappings.description,
        accountCode: chartOfAccounts.code,
        accountName: chartOfAccounts.name,
      })
        .from(systemAccountMappings)
        .innerJoin(chartOfAccounts, eq(systemAccountMappings.accountId, chartOfAccounts.id))
        .where(eq(systemAccountMappings.organizationId, organizationId));

      const byKey: Record<string, any> = {};
      for (const r of rows as any[]) byKey[r.mappingKey] = r;

      const result = SYSTEM_ACCOUNT_KEYS.map((key) => {
        const mapped = byKey[key];
        return {
          mappingKey: key,
          mapped: !!mapped,
          accountId: mapped?.accountId ?? null,
          accountCode: mapped?.accountCode ?? null,
          accountName: mapped?.accountName ?? null,
          description: mapped?.description ?? null,
          isCustom: false,
        };
      });

      // Also include any custom keys in DB that aren't in the predefined list
      const predefinedSet = new Set(SYSTEM_ACCOUNT_KEYS);
      for (const r of rows as any[]) {
        if (!predefinedSet.has(r.mappingKey)) {
          result.push({
            mappingKey: r.mappingKey,
            mapped: true,
            accountId: r.accountId ?? null,
            accountCode: r.accountCode ?? null,
            accountName: r.accountName ?? null,
            description: r.description ?? null,
            isCustom: true,
          });
        }
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** Bulk replace the org's system account mappings (PUT). */
  static async upsertSystemMappings(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const items = req.body?.mappings;
      if (!Array.isArray(items)) return res.status(422).json({ error: 'mappings array is required.' });
      const seen = new Set<string>();
      for (const item of items) {
        if (!item.mappingKey || !item.mappingKey.trim()) {
          return res.status(400).json({ error: 'mappingKey is required.' });
        }
        if (!/^[a-z][a-z0-9_]{0,63}$/.test(item.mappingKey)) {
          return res.status(400).json({ error: `Invalid mapping key "${item.mappingKey}". Use lowercase letters, digits, and underscores only (max 64 chars).` });
        }
        if (seen.has(item.mappingKey)) return res.status(400).json({ error: `Duplicate mapping key "${item.mappingKey}".` });
        seen.add(item.mappingKey);
        if (!item.accountId) continue;
        await assertRefInOrg(organizationId, chartOfAccounts, item.accountId, 'Account does not belong to the current organization.');
      }

      await db.transaction(async (tx) => {
        await tx.delete(systemAccountMappings).where(eq(systemAccountMappings.organizationId, organizationId));
        const rows = items
          .filter((i: any) => i.accountId)
          .map((i: any) => ({
            organizationId,
            mappingKey: i.mappingKey,
            accountId: i.accountId,
            description: i.description ? String(i.description).trim() : null,
            updatedBy: req.user?.userId ?? null,
          }));
        if (rows.length > 0) await tx.insert(systemAccountMappings).values(rows);
      });

      await writeAuditLog(buildAuditRow(
        reqActor(req), 'Accounting Settings', 'accounting_system_mappings_updated',
        `Updated ${items.filter((i: any) => i.accountId).length} system account mapping(s)`,
      ));

      res.json({ success: true, mapped: items.filter((i: any) => i.accountId).length });
    } catch (error: any) {
      const status = error?.status || 500;
      res.status(status).json({ error: error.message });
    }
  }

  // -------------------------------------------------------------------------
  // Health check (dashboard)
  // -------------------------------------------------------------------------
  static async getHealth(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [coa, groups, vtypes, ccenters, templates, periods, banksR, accounts, counters, methods, mappings, openPeriods] = await Promise.all([
        db.select().from(chartOfAccounts).where(eq(chartOfAccounts.organizationId, organizationId)),
        db.select().from(accountGroups).where(eq(accountGroups.organizationId, organizationId)),
        db.select().from(voucherTypes).where(eq(voucherTypes.organizationId, organizationId)),
        db.select().from(costCenters).where(eq(costCenters.organizationId, organizationId)),
        db.select().from(journalTemplates).where(eq(journalTemplates.organizationId, organizationId)),
        db.select().from(financialPeriods).where(eq(financialPeriods.organizationId, organizationId)),
        db.select().from(banks).where(eq(banks.organizationId, organizationId)),
        db.select().from(bankAccounts).where(eq(bankAccounts.organizationId, organizationId)),
        db.select().from(cashCounters).where(eq(cashCounters.organizationId, organizationId)),
        db.select().from(paymentMethods).where(eq(paymentMethods.organizationId, organizationId)),
        db.select().from(systemAccountMappings).where(eq(systemAccountMappings.organizationId, organizationId)),
        db.select().from(financialPeriods).where(and(eq(financialPeriods.organizationId, organizationId), eq(financialPeriods.status, 'open'))),
      ]);

      const mappedKeys = new Set((mappings as any[]).map((m) => m.mappingKey));
      const unmapped = SYSTEM_ACCOUNT_KEYS.filter((k) => !mappedKeys.has(k));
      const currentPeriod = (periods as any[]).find((p) => p.isCurrent) ?? null;
      const postingEnabled = (coa as any[]).filter((a) => a.allowPosting !== false).length;

      const warnings: string[] = [];
      if ((periods as any[]).length === 0) warnings.push('No financial period configured yet.');
      else if (openPeriods.length === 0) warnings.push('No open financial period — voucher posting is blocked.');
      if (postingEnabled === 0) warnings.push('No chart accounts allow posting.');
      if ((vtypes as any[]).filter((v) => v.isActive).length === 0) warnings.push('No active voucher types.');

      res.json({
        organizationId,
        counts: {
          chartOfAccounts: coa.length,
          accountGroups: groups.length,
          voucherTypes: vtypes.length,
          costCenters: ccenters.length,
          journalTemplates: templates.length,
          financialPeriods: periods.length,
          banks: banksR.length,
          bankAccounts: accounts.length,
          cashCounters: counters.length,
          paymentMethods: methods.length,
          systemAccountMappings: mappings.length,
        },
        status: {
          currentPeriod: currentPeriod ? { id: currentPeriod.id, code: currentPeriod.code, status: currentPeriod.status } : null,
          openPeriods: openPeriods.length,
          postingEnabledAccounts: postingEnabled,
        },
        systemMappings: {
          mapped: mappings.length,
          total: mappings.length + unmapped.length,
          unmapped,
        },
        warnings,
        healthy: warnings.length === 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** POST /bank-accounts/:id/deposit — Record a deposit into a bank account. */
  static async createBankDeposit(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const username = req.user?.username || 'system';
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const { id: bankAccountId } = req.params;
      const { amount, sourceAccountId, sourceAccountCode, sourceAccountName, dateBs, narration, branchId, invoiceNumber } = req.body;

      if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Deposit amount must be positive.' });
      if (!sourceAccountId) return res.status(400).json({ error: 'Source GL account (sourceAccountId) is required.' });
      if (!dateBs) return res.status(400).json({ error: 'Date (BS) is required.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      // Resolve the bank account and its GL
      const [bankAcc] = await db.select()
        .from(bankAccounts)
        .where(and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.organizationId, organizationId)))
        .limit(1);
      if (!bankAcc) return res.status(404).json({ error: 'Bank account not found.' });
      if (!bankAcc.glAccountId) return res.status(400).json({ error: 'Bank account has no linked GL account.' });
      if (sourceAccountId === bankAcc.glAccountId) return res.status(400).json({ error: 'Source GL account cannot be the same as the bank GL account.' });

      // Verify the bank GL account exists and allows posting
      const [bankGl] = await db.select().from(chartOfAccounts)
        .where(and(eq(chartOfAccounts.id, bankAcc.glAccountId), eq(chartOfAccounts.organizationId, organizationId)))
        .limit(1);
      if (!bankGl) return res.status(400).json({ error: 'Bank GL account not found.' });
      if (bankGl.allowPosting === false) return res.status(400).json({ error: 'Bank GL account does not allow posting.' });

      // Verify the source GL account
      const [sourceGl] = await db.select().from(chartOfAccounts)
        .where(and(eq(chartOfAccounts.id, sourceAccountId), eq(chartOfAccounts.organizationId, organizationId)))
        .limit(1);
      if (!sourceGl) return res.status(400).json({ error: 'Source GL account not found.' });
      if (sourceGl.allowPosting === false) return res.status(400).json({ error: 'Source GL account does not allow posting.' });

      // Resolve branch: prefer body branchId, then bank account's branch, then fallback
      const resolvedBranchId = branchId || bankAcc.branchId || '';

      // Convert BS date to AD
      let dateAd = '';
      try { dateAd = DateConverter.bsToAd(dateBs); } catch { dateAd = dateBs; }

      const depositAmount = Number(amount);
      const narrationText = narration || `Deposit to ${bankAcc.accountName}`;

      // Post double-entry voucher via savings GL service (creates voucher + entries + updates COA balances)
      const glInput: GlPostInput = {
        organizationId,
        branchId: resolvedBranchId,
        dateBs,
        dateAd,
        voucherType: 'Receipt',
        narration: narrationText,
        preparedBy: username,
        moduleReference: invoiceNumber?.trim() || undefined,
        entries: [
          {
            accountId: bankAcc.glAccountId,
            accountCode: bankGl.code,
            accountName: bankGl.name,
            debit: depositAmount,
            credit: 0,
            narration: narrationText,
          },
          {
            accountId: sourceAccountId,
            accountCode: sourceGl.code,
            accountName: sourceGl.name,
            debit: 0,
            credit: depositAmount,
            narration: narrationText,
          },
        ],
      };

      const result = await postSavingsVoucher(glInput);

      res.status(201).json({
        success: true,
        voucher: result.voucher,
        entries: result.entries,
        totalDebit: result.totalDebit,
        totalCredit: result.totalCredit,
      });
    } catch (error: any) {
      console.error('AccountingSettingController.createBankDeposit:', error);
      res.status(500).json({ error: error.message || 'Failed to record deposit.' });
    }
  }

  /** POST /bank-accounts/void-voucher/:voucherId — Void a posted voucher and reverse its GL entries. */
  static async voidVoucher(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const username = req.user?.username || 'system';
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const { voucherId } = req.params;
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ error: 'Void reason is required.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected.');

      // Fetch the original voucher
      const [voucher] = await db.select().from(vouchers)
        .where(and(eq(vouchers.id, voucherId), eq(vouchers.organizationId, organizationId)))
        .limit(1);
      if (!voucher) return res.status(404).json({ error: 'Voucher not found.' });
      if (voucher.status === 'Voided') return res.status(400).json({ error: 'Voucher is already voided.' });

      // Fetch original entries
      const originalEntries = await db.select().from(voucherEntries)
        .where(eq(voucherEntries.voucherId, voucherId));

      // Create reversal entries (swap debit ↔ credit)
      const reversalEntries = originalEntries.map(e => ({
        id: uuidv4(),
        organizationId,
        voucherId: voucher.id,
        accountId: e.accountId,
        accountCode: e.accountCode,
        accountName: e.accountName,
        debit: String(e.credit || 0),
        credit: String(e.debit || 0),
        narration: `VOID: ${reason}`,
      }));

      // Post reversal voucher
      const reversalVoucherNo = `VCH-${Date.now().toString().slice(-8)}`;
      const [reversalVoucher] = await db.insert(vouchers).values({
        id: uuidv4(),
        organizationId,
        voucherNo: reversalVoucherNo,
        voucherType: voucher.voucherType,
        dateBs: voucher.dateBs,
        dateAd: voucher.dateAd,
        branchId: voucher.branchId,
        fiscalYearCode: voucher.fiscalYearCode,
        preparedBy: username,
        approvedBy: username,
        status: 'Posted',
        totalAmount: voucher.totalAmount,
        narration: `VOID of ${voucher.voucherNo}: ${reason}`,
        moduleReference: voucher.id,
      }).returning();

      await db.insert(voucherEntries).values(reversalEntries.map(e => ({ ...e, voucherId: reversalVoucher.id })));

      // Reverse COA balances for original entries
      for (const entry of originalEntries) {
        const [account] = await db.select().from(chartOfAccounts)
          .where(and(eq(chartOfAccounts.id, entry.accountId), eq(chartOfAccounts.organizationId, organizationId)))
          .limit(1);
        if (!account) continue;
        const current = Number(account.balance) || 0;
        const debit = Number(entry.debit) || 0;
        const credit = Number(entry.credit) || 0;
        const reversed = ['Asset', 'Expense'].includes(account.type)
          ? current - debit + credit
          : current - credit + debit;
        await db.update(chartOfAccounts)
          .set({ balance: String(round2(reversed)), updatedAt: new Date() })
          .where(and(eq(chartOfAccounts.id, account.id), eq(chartOfAccounts.organizationId, organizationId)));

        // Ledger upsert: reverse original (swap debit↔credit)
        await upsertLedgerEntry({
          tx: db,
          organizationId,
          accountId: account.id,
          fiscalYearCode: voucher.fiscalYearCode || getCurrentFiscalYearCode(),
          branchId: voucher.branchId,
          debit: Number(entry.credit) || 0,
          credit: Number(entry.debit) || 0,
        });
      }

      // Compute running balance on reversal entries (fail-safe)
      try {
        const reversalEntriesInserted = await db.select({ id: voucherEntries.id, accountId: voucherEntries.accountId, debit: voucherEntries.debit, credit: voucherEntries.credit })
          .from(voucherEntries)
          .where(eq(voucherEntries.voucherId, reversalVoucher.id));

        const reversalRunningBalances = await computeRunningBalancesForEntries({
          tx: db,
          organizationId,
          fiscalYearCode: voucher.fiscalYearCode || getCurrentFiscalYearCode(),
          entries: reversalEntriesInserted.map(e => ({ id: e.id, accountId: e.accountId, debit: Number(e.debit) || 0, credit: Number(e.credit) || 0 })),
        });
        for (const entry of reversalEntriesInserted) {
          const rb = reversalRunningBalances.get(entry.id);
          if (rb != null) {
            await setRunningBalanceRaw(db, entry.id, rb);
          }
        }
      } catch {
        // running_balance column may not exist yet — skip silently
      }

      // Mark original voucher as voided
      await db.update(vouchers)
        .set({ status: 'Voided', narration: `${voucher.narration || ''} [VOIDED: ${reason}]`, updatedAt: new Date() })
        .where(eq(vouchers.id, voucherId));

      res.json({
        success: true,
        reversalVoucherNo,
        reversalVoucherId: reversalVoucher.id,
        message: `Voucher ${voucher.voucherNo} voided. Reversal: ${reversalVoucherNo}`,
      });
    } catch (error: any) {
      console.error('AccountingSettingController.voidVoucher:', error);
      res.status(500).json({ error: error.message || 'Failed to void voucher.' });
    }
  }
}

// ---------------------------------------------------------------------------
// Parent-code validation (COA hierarchy): parent must exist, share the same
// type, and not form a cycle back to the account being edited.
// ---------------------------------------------------------------------------
async function assertParentCode(organizationId: string, parentCode: string, ownCode: string, excludeId?: string) {
  const db = getDb();
  const [parent] = await db.select().from(chartOfAccounts)
    .where(and(eq(chartOfAccounts.organizationId, organizationId), eq(chartOfAccounts.code, parentCode)))
    .limit(1);
  if (!parent) throw Object.assign(new Error('Parent account not found in this organization.'), { status: 400 });
  if (String(parentCode) === String(ownCode)) {
    throw Object.assign(new Error('An account cannot be its own parent.'), { status: 400 });
  }
  // Walk up the chain to detect cycles.
  let cursor = parent;
  const guard = 100;
  for (let i = 0; i < guard && cursor.parentCode; i++) {
    if (String(cursor.parentCode) === String(ownCode)) {
      throw Object.assign(new Error('Parent assignment would create a cycle in the chart of accounts.'), { status: 400 });
    }
    const [next] = await db.select().from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.organizationId, organizationId), eq(chartOfAccounts.code, cursor.parentCode)))
      .limit(1);
    if (!next) break;
    cursor = next;
  }
  if (excludeId && String(parent.id) === String(excludeId)) {
    throw Object.assign(new Error('An account cannot be its own parent.'), { status: 400 });
  }
}

function orLike(entity: EntityConfig, search: string) {
  const conds: any[] = [];
  if (entity.table.code) conds.push(ilike(entity.table.code, `%${search}%`));
  if (entity.table.name) conds.push(ilike(entity.table.name, `%${search}%`));
  return conds.length > 1 ? or(...conds) : conds[0];
}
