/**
 * In-memory fake of the drizzle query builder used by Module 1 controller tests.
 *
 * It faithfully simulates what a real Postgres would do for the small set of
 * operations the settings controllers issue:
 *   - select().from(T).where(cond).orderBy(...).limit(n)   (awaitable)
 *   - insert(T).values(...).onConflictDoUpdate(...).returning()
 *   - update(T).set(...).where(cond).returning()
 *   - delete(T).where(cond)
 *
 * Where-clauses are compiled with the real `PgDialect` so `organization_id`
 * filters are *actually evaluated* against an in-memory rowset. That means a
 * controller that forgets to scope a query by `organization_id` will LEAK the
 * other tenant's rows in these tests — exactly like it would in production.
 *
 * Test-only helper. Never imported by application code.
 */
import { PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../../db/schema';

type AnyRow = Record<string, any>;

export interface FakeScenario {
  workingDays?: AnyRow[];
  fiscalYears?: AnyRow[];
  branches?: AnyRow[];
  exchangeRates?: AnyRow[];
  financialSettings?: AnyRow[];
  localization?: AnyRow[];
  approvalLevels?: AnyRow[];
  approvalMatrix?: AnyRow[];
  roleApprovalLimits?: AnyRow[];
  approvalRequests?: AnyRow[];
  roles?: AnyRow[];
  memberTypes?: AnyRow[];
  memberCategories?: AnyRow[];
  occupations?: AnyRow[];
  educationLevels?: AnyRow[];
  nomineeTypes?: AnyRow[];
  relationshipTypes?: AnyRow[];
  memberStatuses?: AnyRow[];
  groups?: AnyRow[];
  // SETUPS → Share Settings (Module: Share Settings)
  shareClasses?: AnyRow[];
  shareSchemes?: AnyRow[];
  dividendRules?: AnyRow[];
  shareCertificateFormats?: AnyRow[];
  shareProvisioningQueue?: AnyRow[];
  organizationProfiles?: AnyRow[];
  shareHoldings?: AnyRow[];
  shareTypes?: AnyRow[];
  // SETUPS → Savings A/C Settings (Module: Savings A/C Settings)
  savingsProducts?: AnyRow[];
  savingsInterestRates?: AnyRow[];
  savingsAccounts?: AnyRow[];
  savingsTransactions?: AnyRow[];
  savingsChequeBooks?: AnyRow[];
  savingsChequeLeaves?: AnyRow[];
  savingsProvisioningQueue?: AnyRow[];
  chartOfAccounts?: AnyRow[];
  /** When true, hasFinancialActivity() reports an existing transaction → base currency locked. */
  financialActivity?: boolean;
  /** Branch-dependent record counts returned for deactivateBranch's dependency check. */
  dependentCounts?: Record<string, number>;
  /** Rows appended to audit_logs by every settings write (for audit assertions). */
  auditRows?: AnyRow[];
  /** Rows appended to audit_deletion_logs by every hard delete (immutable trail). */
  auditDeletionRows?: AnyRow[];
  /**
   * Optional member rows. When provided, reads/deletes on `members` behave as a
   * real table instead of the dependentCounts proxy — used by hard-delete tests.
   */
  members?: AnyRow[];
}

export interface CompiledWhere {
  table: string;
  sql: string;
  params: any[];
}

export interface FakeDb {
  select: (sel?: any) => { from: (table: any) => SelectChain };
  insert: (table: any) => InsertChain;
  update: (table: any) => UpdateChain;
  delete: (table: any) => DeleteChain;
  /** Executes a transaction callback against the same in-memory state. */
  transaction: (fn: (tx: FakeDb) => any) => Promise<any>;
  /** Every where-clause the controllers executed, compiled to SQL + params. */
  recordedWheres: CompiledWhere[];
  /** Snapshot access to the mutable in-memory state for assertions. */
  state: ReturnType<typeof createState>;
}

const snakeToCamel = (s: string): string => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

function createState(scenario: FakeScenario) {
  // Clone every seeded row so a mutation applied through the fake (update /
  // insert path) never leaks back into the shared seed object (module-level
  // constants reused across tests).
  const clone = (rows?: AnyRow[]): AnyRow[] => (rows ?? []).map((r) => ({ ...r }));
  return {
    workingDays: clone(scenario.workingDays),
    fiscalYears: clone(scenario.fiscalYears),
    branches: clone(scenario.branches),
    exchangeRates: clone(scenario.exchangeRates),
    financialSettings: clone(scenario.financialSettings),
    localization: clone(scenario.localization),
    approvalLevels: clone(scenario.approvalLevels),
    approvalMatrix: clone(scenario.approvalMatrix),
    roleApprovalLimits: clone(scenario.roleApprovalLimits),
    approvalRequests: clone(scenario.approvalRequests),
    roles: clone(scenario.roles),
    memberTypes: clone(scenario.memberTypes),
    memberCategories: clone(scenario.memberCategories),
    occupations: clone(scenario.occupations),
    educationLevels: clone(scenario.educationLevels),
    nomineeTypes: clone(scenario.nomineeTypes),
    relationshipTypes: clone(scenario.relationshipTypes),
    memberStatuses: clone(scenario.memberStatuses),
    groups: clone(scenario.groups),
    shareClasses: clone(scenario.shareClasses),
    shareSchemes: clone(scenario.shareSchemes),
    dividendRules: clone(scenario.dividendRules),
    shareCertificateFormats: clone(scenario.shareCertificateFormats),
    shareProvisioningQueue: clone(scenario.shareProvisioningQueue),
    organizationProfiles: clone(scenario.organizationProfiles),
    shareHoldings: clone(scenario.shareHoldings),
    shareTypes: clone(scenario.shareTypes),
    savingsProducts: clone(scenario.savingsProducts),
    savingsInterestRates: clone(scenario.savingsInterestRates),
    savingsAccounts: clone(scenario.savingsAccounts),
    savingsTransactions: clone(scenario.savingsTransactions),
    savingsChequeBooks: clone(scenario.savingsChequeBooks),
    savingsChequeLeaves: clone(scenario.savingsChequeLeaves),
    savingsProvisioningQueue: clone(scenario.savingsProvisioningQueue),
    chartOfAccounts: clone(scenario.chartOfAccounts),
    financialActivity: scenario.financialActivity ?? false,
    dependentCounts: scenario.dependentCounts ?? {},
    auditRows: clone(scenario.auditRows),
    auditDeletionRows: clone(scenario.auditDeletionRows),
    members: scenario.members ? clone(scenario.members) : undefined,
    inserted: [] as AnyRow[],
    deletedCount: 0,
    /** Chronological write log (`insert:<key>` / `delete:<key>` / `update:<key>`) for ordering assertions. */
    ops: [] as string[],
  };
}

function compile(cond: any): { sql: string; params: any[] } {
  if (!cond) return { sql: '', params: [] };
  return new PgDialect().sqlToQuery(cond);
}

/** True when a select projection maps an alias to a real `count(...)` aggregate. */
function isCountProjection(sel: any): boolean {
  if (!sel || typeof sel !== 'object') return false;
  return Object.values(sel).some((c: any) => {
    if (!c || typeof c !== 'object') return false;
    if (typeof c.name === 'string') return false; // a column, not an aggregate
    try {
      return /^\s*count\s*\(/i.test(new PgDialect().sqlToQuery(c).sql);
    } catch {
      return false;
    }
  });
}

function parseConditions(sqlText: string, params: any[]): {
  eqMap: Record<string, any>;
  neMap: Record<string, any>;
  inMap: Record<string, any[]>;
  rangeMap: Record<string, { gte?: any; lte?: any }>;
} {
  const eqMap: Record<string, any> = {};
  const neMap: Record<string, any> = {};
  const inMap: Record<string, any[]> = {};
  const rangeMap: Record<string, { gte?: any; lte?: any }> = {};
  // Matches `"table"."column" = $n` / `"column" = $n` / `<> $n` from PgDialect output.
  const re = /"([a-z0-9_]+)"\."([a-z0-9_]+)"\s*(=|<>)\s*\$(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sqlText))) {
    const col = snakeToCamel(m[2]);
    const value = params[Number(m[4]) - 1];
    if (m[3] === '=') eqMap[col] = value;
    else neMap[col] = value;
  }
  // Matches `"table"."column" >= $n` / `<= $n` for drizzle `gte(...)` / `lte(...)`.
  const rangeRe = /"([a-z0-9_]+)"\."([a-z0-9_]+)"\s*(>=|<=)\s*\$(\d+)/g;
  while ((m = rangeRe.exec(sqlText))) {
    const col = snakeToCamel(m[2]);
    const value = params[Number(m[4]) - 1];
    const bounds = (rangeMap[col] = rangeMap[col] ?? {});
    if (m[3] === '>=') bounds.gte = value;
    else bounds.lte = value;
  }
  // Matches `"table"."column" in ($n, ...)` for drizzle `inArray(...)`.
  const inRe = /"([a-z0-9_]+)"\."([a-z0-9_]+)"\s+in\s+\(([^)]*)\)/g;
  while ((m = inRe.exec(sqlText))) {
    const col = snakeToCamel(m[2]);
    inMap[col] = [];
    for (const token of m[3].split(',')) {
      const idxMatch = /\$(\d+)/.exec(token.trim());
      if (idxMatch) inMap[col].push(params[Number(idxMatch[1]) - 1]);
    }
  }
  return { eqMap, neMap, inMap, rangeMap };
}

function filterRows(
  rows: AnyRow[],
  eqMap: Record<string, any>,
  neMap: Record<string, any>,
  inMap: Record<string, any[]> = {},
  rangeMap: Record<string, { gte?: any; lte?: any }> = {}
): AnyRow[] {
  return rows.filter((r) => {
    for (const [col, val] of Object.entries(eqMap)) {
      if (String(r[col] ?? '') !== String(val)) return false;
    }
    for (const [col, val] of Object.entries(neMap)) {
      if (String(r[col] ?? '') === String(val)) return false;
    }
    for (const [col, vals] of Object.entries(inMap)) {
      if (!(vals as any[]).some((v) => String(r[col] ?? '') === String(v))) return false;
    }
    for (const [col, bounds] of Object.entries(rangeMap)) {
      const cell = String(r[col] ?? '');
      if (bounds.gte !== undefined && cell < String(bounds.gte)) return false;
      if (bounds.lte !== undefined && cell > String(bounds.lte)) return false;
    }
    return true;
  });
}

/**
 * Mirror the real DB's defaultRandom() for `id` columns: any inserted row
 * lacking an `id` (when the schema table declares one) gets generated so
 * `.returning({ id })` behaves like Postgres.
 */
function ensureId(row: AnyRow, table: any): AnyRow {
  if (row.id === undefined && 'id' in table) {
    return { ...row, id: `fake-${Math.random().toString(36).slice(2, 12)}` };
  }
  return row;
}

function tableKey(table: any): string {
  if (table === schema.workingDays) return 'workingDays';
  if (table === schema.fiscalYears) return 'fiscalYears';
  if (table === schema.branches) return 'branches';
  if (table === schema.exchangeRates) return 'exchangeRates';
  if (table === schema.organizationFinancialSettings) return 'financialSettings';
  if (table === schema.organizationLocalizationSettings) return 'localization';
  if (table === schema.approvalLevels) return 'approvalLevels';
  if (table === schema.approvalMatrix) return 'approvalMatrix';
  if (table === schema.roleApprovalLimits) return 'roleApprovalLimits';
  if (table === schema.approvalRequests) return 'approvalRequests';
  if (table === schema.roles) return 'roles';
  if (table === schema.memberTypes) return 'memberTypes';
  if (table === schema.memberCategories) return 'memberCategories';
  if (table === schema.occupations) return 'occupations';
  if (table === schema.educationLevels) return 'educationLevels';
  if (table === schema.nomineeTypes) return 'nomineeTypes';
  if (table === schema.relationshipTypes) return 'relationshipTypes';
  if (table === schema.memberStatuses) return 'memberStatuses';
  if (table === schema.groups) return 'groups';
  if (table === schema.shareClasses) return 'shareClasses';
  if (table === schema.shareSchemes) return 'shareSchemes';
  if (table === schema.dividendRules) return 'dividendRules';
  if (table === schema.shareCertificateFormats) return 'shareCertificateFormats';
  if (table === schema.shareProvisioningQueue) return 'shareProvisioningQueue';
  if (table === schema.organizationProfiles) return 'organizationProfiles';
  if (table === schema.shareHoldings) return 'shareHoldings';
  if (table === schema.shareTypes) return 'shareTypes';
  if (table === schema.savingsProducts) return 'savingsProducts';
  if (table === schema.savingsInterestRates) return 'savingsInterestRates';
  if (table === schema.savingsChequeBooks) return 'savingsChequeBooks';
  if (table === schema.savingsChequeLeaves) return 'savingsChequeLeaves';
  if (table === schema.savingsProvisioningQueue) return 'savingsProvisioningQueue';
  if (table === schema.savingsTransactions) return 'savingsTransactions';
  if (table === schema.savingsAccounts) return 'savingsAccounts';
  if (table === schema.chartOfAccounts) return 'chartOfAccounts';
  if (table === schema.auditLogs) return 'auditLogs';
  if (table === schema.auditDeletionLogs) return 'auditDeletionLogs';
  if (
    table === schema.employees || table === schema.orgUsers || table === schema.members ||
    table === schema.memberKycProfiles || table === schema.memberFamily || table === schema.loanAccounts ||
    table === schema.vouchers
  ) return 'count';
  if (table && typeof table.getSQL === 'function') return 'sql';
  return 'other';
}

function countLabel(table: any): string {
  if (table === schema.employees) return 'employees';
  if (table === schema.orgUsers) return 'orgUsers';
  if (table === schema.members) return 'members';
  if (table === schema.memberKycProfiles) return 'kyc';
  if (table === schema.memberFamily) return 'family';
  if (table === schema.savingsAccounts) return 'savingsAccounts';
  if (table === schema.loanAccounts) return 'loanAccounts';
  if (table === schema.vouchers) return 'vouchers';
  return '';
}

/** Readable table name for the chronological write log (members → 'members', not 'count'). */
function writeKey(table: any): string {
  const key = tableKey(table);
  if (key !== 'count') return key;
  const label = countLabel(table);
  return label || key;
}

export class SelectChain {
  private whereCond: any = undefined;
  private limitN: number | null = null;

  constructor(
    private table: any,
    private sel: any,
    private state: ReturnType<typeof createState>,
    private recordedWheres: CompiledWhere[],
  ) {}

  where(c: any) {
    this.whereCond = c;
    return this;
  }
  orderBy() {
    return this;
  }
  innerJoin() {
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  for(_mode?: string) {
    return this;
  }
  then(res: (v: AnyRow[]) => any, rej: (e: any) => any) {
    let rows = this.resolve();
    if (this.limitN !== null) rows = rows.slice(0, this.limitN);
    return Promise.resolve(rows).then(res, rej);
  }
  private resolve(): AnyRow[] {
    const key = tableKey(this.table);
    const { sql, params } = compile(this.whereCond);
    this.recordedWheres.push({ table: key, sql, params });

    if (key === 'sql') return this.state.financialActivity ? [{ n: 1 }] : [];
    if (key === 'count' && this.state.members !== undefined && this.table === schema.members) {
      const { eqMap, neMap, inMap, rangeMap } = parseConditions(sql, params);
      const rows = filterRows(this.state.members, eqMap, neMap, inMap, rangeMap);
      if (isCountProjection(this.sel)) return [{ value: rows.length }];
      return this.project(rows);
    }
    if (key === 'count') {
      const label = countLabel(this.table);
      const value = this.state.dependentCounts[label] ?? 0;
      // Key the row by the selected alias so both `{ value }` (BranchController)
      // and `{ count }` (MemberSettingController / repositories) consumers work.
      if (this.sel && typeof this.sel === 'object') {
        const out: AnyRow = {};
        for (const alias of Object.keys(this.sel)) out[alias] = value;
        return [out];
      }
      return [{ value }];
    }
    if (key === 'other' || key === 'auditLogs' || key === 'auditDeletionLogs') return [];
    const { eqMap, neMap, inMap, rangeMap } = parseConditions(sql, params);
    const rows = filterRows(this.state[key], eqMap, neMap, inMap, rangeMap);
    if (isCountProjection(this.sel)) return [{ value: rows.length }];
    return this.project(rows);
  }
  /** Apply a `db.select({ alias: column })` projection (drizzle maps snake_case to camelCase). */
  private project(rows: AnyRow[]): AnyRow[] {
    if (!this.sel) return rows;
    return rows.map((r) => {
      const out: AnyRow = {};
      for (const [alias, col] of Object.entries(this.sel ?? {}) as Array<[string, any]>) {
        if (col && typeof col === 'object' && typeof col.name === 'string') {
          out[alias] = r[snakeToCamel(col.name)];
        } else {
          out[alias] = r[alias];
        }
      }
      return out;
    });
  }
}

export class InsertChain {
  private vals: any = undefined;

  constructor(
    private table: any,
    private state: ReturnType<typeof createState>,
  ) {}

  values(v: any) {
    this.vals = v;
    return this;
  }
  onConflictDoUpdate() {
    return this;
  }
  returning() {
    return Promise.resolve(this.apply());
  }
  then(res: (v: any) => any, rej: (e: any) => any) {
    this.apply();
    return Promise.resolve({ rowCount: 1 }).then(res, rej);
  }
  private apply(): AnyRow[] {
    const key = tableKey(this.table);
    const rows = (Array.isArray(this.vals) ? this.vals : [this.vals]).map((r) => ensureId(r, this.table));
    this.state.ops.push(`insert:${writeKey(this.table)}`);
    if (key === 'auditLogs') {
      this.state.auditRows.push(...rows.map((r) => ({ ...r })));
      return rows;
    }
    if (key === 'auditDeletionLogs') {
      this.state.auditDeletionRows.push(...rows.map((r) => ({ ...r })));
      return rows;
    }
    if (key === 'count' || key === 'other' || key === 'sql') return rows;
    this.state[key].push(...rows.map((r) => ({ ...r })));
    this.state.inserted.push(...rows.map((r) => ({ ...r })));
    return rows;
  }
}

export class UpdateChain {
  private setVals: any = undefined;
  private whereCond: any = undefined;

  constructor(
    private table: any,
    private state: ReturnType<typeof createState>,
    private recordedWheres: CompiledWhere[],
  ) {}

  set(v: any) {
    this.setVals = v;
    return this;
  }
  where(c: any) {
    this.whereCond = c;
    return this;
  }
  returning() {
    return Promise.resolve(this.apply());
  }
  then(res: (v: any) => any, rej: (e: any) => any) {
    this.apply();
    return Promise.resolve({ rowCount: 1 }).then(res, rej);
  }
  private apply(): AnyRow[] {
    const key = tableKey(this.table);
    const { sql, params } = compile(this.whereCond);
    this.recordedWheres.push({ table: key, sql, params });
    if (key === 'other' || key === 'auditLogs' || key === 'auditDeletionLogs' || key === 'count' || key === 'sql') return [];
    const { eqMap, neMap, inMap, rangeMap } = parseConditions(sql, params);
    const matched = filterRows(this.state[key], eqMap, neMap, inMap, rangeMap);
    // Produce NEW row objects instead of mutating in place so earlier read
    // snapshots (`existing`) keep pre-update values, like a real DB.
    const updated: AnyRow[] = [];
    this.state[key] = this.state[key].map((r: AnyRow) => {
      if (matched.includes(r)) {
        const nr = { ...r, ...(this.setVals ?? {}) };
        updated.push(nr);
        return nr;
      }
      return r;
    });
    return updated;
  }
}

export class DeleteChain {
  constructor(
    private table: any,
    private state: ReturnType<typeof createState>,
    private recordedWheres: CompiledWhere[],
  ) {}
  where(c: any) {
    const { sql, params } = compile(c);
    this.recordedWheres.push({ table: tableKey(this.table), sql, params });
    const key = tableKey(this.table);
    this.state.ops.push(`delete:${writeKey(this.table)}`);
    // State-backed member rows (hard-delete tests). tableKey(members) is
    // 'count' so this is handled before the generic state-backed branch.
    if (this.state.members !== undefined && this.table === schema.members) {
      const { eqMap, neMap, inMap, rangeMap } = parseConditions(sql, params);
      const before = this.state.members.length;
      this.state.members = this.state.members.filter((r: AnyRow) => {
        for (const [col, val] of Object.entries(eqMap)) {
          if (String(r[col] ?? '') !== String(val)) return true;
        }
        for (const [col, val] of Object.entries(neMap)) {
          if (String(r[col] ?? '') === String(val)) return true;
        }
        for (const [col, bounds] of Object.entries(rangeMap)) {
          const cell = String(r[col] ?? '');
          if (bounds.gte !== undefined && cell < String(bounds.gte)) return true;
          if (bounds.lte !== undefined && cell > String(bounds.lte)) return true;
        }
        return false;
      });
      this.state.deletedCount = (this.state.deletedCount ?? 0) + (before - this.state.members.length);
      return this;
    }
    if (key !== 'other' && key !== 'auditLogs' && key !== 'auditDeletionLogs' && key !== 'count' && key !== 'sql') {
      const { eqMap, neMap, inMap, rangeMap } = parseConditions(sql, params);
      const before = this.state[key].length;
      this.state[key] = this.state[key].filter((r: AnyRow) => {
        for (const [col, val] of Object.entries(eqMap)) {
          if (String(r[col] ?? '') !== String(val)) return true;
        }
        for (const [col, val] of Object.entries(neMap)) {
          if (String(r[col] ?? '') === String(val)) return true;
        }
        for (const [col, bounds] of Object.entries(rangeMap)) {
          const cell = String(r[col] ?? '');
          if (bounds.gte !== undefined && cell < String(bounds.gte)) return true;
          if (bounds.lte !== undefined && cell > String(bounds.lte)) return true;
        }
        return false;
      });
      this.state.deletedCount = (this.state.deletedCount ?? 0) + (before - this.state[key].length);
    }
    return this;
  }
  then(res: (v: any) => any, rej: (e: any) => any) {
    return Promise.resolve({ rowCount: 0 }).then(res, rej);
  }
}

export function makeFakeDb(scenario: FakeScenario = {}): FakeDb {
  const state = createState(scenario);
  const recordedWheres: CompiledWhere[] = [];
  const db: FakeDb = {
    select: (sel?: any) => ({ from: (table: any) => new SelectChain(table, sel, state, recordedWheres) }),
    insert: (table: any) => new InsertChain(table, state),
    update: (table: any) => new UpdateChain(table, state, recordedWheres),
    delete: (table: any) => new DeleteChain(table, state, recordedWheres),
    transaction: (fn: (tx: FakeDb) => any) => Promise.resolve(fn(db)),
    recordedWheres,
    state,
  };
  return db;
}
