/**
 * Share Repository
 * Data access layer for share_types, share_holdings, share_transactions,
 * and share_certificates — all scoped to organization_id (multi-tenant).
 */
import { eq, and, or, asc, desc, count, SQL, ilike, sql, ne } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  shareTypes,
  shareHoldings,
  shareTransactions,
  shareCertificates,
  shareTransfers,
  shareAccounts,
  shareAccountNominees,
  organizationShareSettings,
  subsidiarySharesBook,
  vouchers,
  voucherEntries,
  chartOfAccounts,
  systemAccountMappings,
  members,
  memberTypes,
  memberKycProfiles,
  memberFinancialProfiles,
  fiscalYears,
} from '../../db/schema';
import type { Database } from '../../db/client';
import { getCurrentFiscalYearCode } from '../../utils/nepaliCalendar';
import {
  checkShareCeilings,
  computeKittaRange,
  nextStartKitta,
  ShareCeilingError,
} from '../services/shareCeilingEngine';

export interface ShareHoldingFilter {
  organizationId?: string;
  memberId?: string;
  shareTypeId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Flatten numeric columns to JS numbers so the API contract stays clean. */
function toNumber(v: unknown): number {
  return Number(v ?? 0) || 0;
}

export class ShareRepository {
  private get db() {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    return db;
  }

  // ============================================================
  // SHARE TYPES
  // ============================================================
  async listTypes(organizationId: string) {
    const rows = await this.db.select().from(shareTypes)
      .where(eq(shareTypes.organizationId, organizationId))
      .orderBy(desc(shareTypes.createdAt));
    return rows.map(r => ({ ...r, faceValue: toNumber(r.faceValue), dividendRate: toNumber(r.dividendRate) }));
  }

  async getTypeById(organizationId: string, id: string) {
    const [row] = await this.db.select().from(shareTypes)
      .where(and(eq(shareTypes.id, id), eq(shareTypes.organizationId, organizationId)))
      .limit(1);
    return row ? { ...row, faceValue: toNumber(row.faceValue), dividendRate: toNumber(row.dividendRate) } : null;
  }

  async findActiveTypeByCode(organizationId: string, code: string) {
    const [row] = await this.db.select().from(shareTypes)
      .where(and(
        eq(shareTypes.organizationId, organizationId),
        eq(shareTypes.code, code),
      ))
      .limit(1);
    return row ? { ...row, faceValue: toNumber(row.faceValue), dividendRate: toNumber(row.dividendRate) } : null;
  }

  /** maxAllowedKitta of every type in the org, optionally excluding one (for edit-mode pool checks). */
  async listTypeCeilings(organizationId: string, excludeId?: string | null): Promise<Array<number | null>> {
    const rows = await this.db.select({ ceiling: shareTypes.maxAllowedKitta })
      .from(shareTypes)
      .where(and(
        eq(shareTypes.organizationId, organizationId),
        excludeId ? ne(shareTypes.id, excludeId) : undefined,
      ));
    return rows.map((r) => r.ceiling);
  }

  async createType(data: typeof shareTypes.$inferInsert) {
    const [row] = await this.db.insert(shareTypes).values(data).returning();
    return row ? { ...row, faceValue: toNumber(row.faceValue), dividendRate: toNumber(row.dividendRate) } : null;
  }

  async updateType(organizationId: string, id: string, data: Partial<typeof shareTypes.$inferInsert>) {
    const [row] = await this.db.update(shareTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(shareTypes.id, id), eq(shareTypes.organizationId, organizationId)))
      .returning();
    return row ? { ...row, faceValue: toNumber(row.faceValue), dividendRate: toNumber(row.dividendRate) } : null;
  }

  async deleteType(organizationId: string, id: string): Promise<boolean> {
    const rows = await this.db.delete(shareTypes)
      .where(and(eq(shareTypes.id, id), eq(shareTypes.organizationId, organizationId)))
      .returning({ id: shareTypes.id });
    return rows.length > 0;
  }

  // ============================================================
  // SHARE HOLDINGS (joined with members for display)
  // ============================================================
  async listHoldings(filter: ShareHoldingFilter = {}): Promise<PaginatedResult<any>> {
    const {
      organizationId, memberId, shareTypeId, status, search,
      page = 1, limit = 100,
    } = filter;
    if (!organizationId) throw new Error('organizationId is required');

    const conditions: SQL[] = [eq(shareHoldings.organizationId, organizationId)];
    if (memberId) conditions.push(eq(shareHoldings.memberId, memberId));
    if (shareTypeId) conditions.push(eq(shareHoldings.shareTypeId, shareTypeId));
    if (status) conditions.push(eq(shareHoldings.status, status as any));
    if (search) {
      conditions.push(
        sql`(${shareHoldings.memberName} ILIKE ${`%${search}%`} OR ${shareHoldings.memberNo} ILIKE ${`%${search}%`})`
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, totalResult] = await Promise.all([
      this.db.select({
        id: shareHoldings.id,
        organizationId: shareHoldings.organizationId,
        shareTypeId: shareHoldings.shareTypeId,
        shareTypeName: shareTypes.name,
        memberId: shareHoldings.memberId,
        memberName: shareHoldings.memberName,
        memberNo: shareHoldings.memberNo,
        membershipType: memberTypes.name,
        numberOfShares: shareHoldings.numberOfShares,
        faceValuePerShare: shareHoldings.faceValuePerShare,
        totalValue: shareHoldings.totalValue,
        issuedDateBS: shareHoldings.issuedDateBs,
        status: shareHoldings.status,
        branchId: shareHoldings.branchId,
        createdAt: shareHoldings.createdAt,
      })
        .from(shareHoldings)
        .leftJoin(shareTypes, eq(shareTypes.id, shareHoldings.shareTypeId))
        .leftJoin(members, eq(members.id, shareHoldings.memberId))
        .leftJoin(memberTypes, eq(memberTypes.id, members.memberTypeId))
        .where(where)
        .orderBy(desc(shareHoldings.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ count: count() }).from(shareHoldings).where(where),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    return {
      data: data.map(r => ({
        ...r,
        faceValuePerShare: toNumber(r.faceValuePerShare),
        totalValue: toNumber(r.totalValue),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getHoldingById(organizationId: string, id: string) {
    const [row] = await this.db.select().from(shareHoldings)
      .where(and(eq(shareHoldings.id, id), eq(shareHoldings.organizationId, organizationId)))
      .limit(1);
    return row ? {
      ...row,
      faceValuePerShare: toNumber(row.faceValuePerShare),
      totalValue: toNumber(row.totalValue),
    } : null;
  }

  async findActiveHoldingForMember(organizationId: string, memberId: string, shareTypeId: string) {
    const [row] = await this.db.select().from(shareHoldings)
      .where(and(
        eq(shareHoldings.organizationId, organizationId),
        eq(shareHoldings.memberId, memberId),
        eq(shareHoldings.shareTypeId, shareTypeId),
        eq(shareHoldings.status, 'Active'),
      ))
      .limit(1);
    return row ? {
      ...row,
      faceValuePerShare: toNumber(row.faceValuePerShare),
      totalValue: toNumber(row.totalValue),
    } : null;
  }

  async updateHoldingShares(organizationId: string, id: string, numberOfShares: number) {
    const holding = await this.getHoldingById(organizationId, id);
    if (!holding) throw new Error('Share holding not found');
    const totalValue = numberOfShares * holding.faceValuePerShare;
    const [row] = await this.db.update(shareHoldings)
      .set({ numberOfShares, totalValue: String(totalValue), updatedAt: new Date() })
      .where(and(eq(shareHoldings.id, id), eq(shareHoldings.organizationId, organizationId)))
      .returning();
    return row ? { ...row, faceValuePerShare: toNumber(row.faceValuePerShare), totalValue: toNumber(row.totalValue) } : null;
  }

  async createHolding(data: typeof shareHoldings.$inferInsert) {
    const [row] = await this.db.insert(shareHoldings).values(data).returning();
    return row ? { ...row, faceValuePerShare: toNumber(row.faceValuePerShare), totalValue: toNumber(row.totalValue) } : null;
  }

  // ============================================================
  // SHARE TRANSACTIONS
  // ============================================================
  async listTransactions(organizationId: string, filter: { memberId?: string; holdingId?: string; limit?: number } = {}) {
    const conditions: SQL[] = [eq(shareTransactions.organizationId, organizationId)];
    if (filter.memberId) conditions.push(eq(shareTransactions.memberId, filter.memberId));
    if (filter.holdingId) conditions.push(eq(shareTransactions.holdingId, filter.holdingId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db.select({
      id: shareTransactions.id,
      organizationId: shareTransactions.organizationId,
      holdingId: shareTransactions.holdingId,
      memberId: shareTransactions.memberId,
      memberName: members.fullName,
      memberNo: members.memberNo,
      shareTypeId: shareTransactions.shareTypeId,
      shareTypeName: shareTypes.name,
      transactionType: shareTransactions.transactionType,
      numberOfShares: shareTransactions.numberOfShares,
      amountPerShare: shareTransactions.amountPerShare,
      totalAmount: shareTransactions.totalAmount,
      voucherNo: shareTransactions.voucherNo,
      dateBs: shareTransactions.dateBs,
      dateAd: shareTransactions.dateAd,
      remarks: shareTransactions.remarks,
      processedBy: shareTransactions.processedBy,
      branchId: shareTransactions.branchId,
      createdAt: shareTransactions.createdAt,
    })
      .from(shareTransactions)
      .leftJoin(members, eq(members.id, shareTransactions.memberId))
      .leftJoin(shareTypes, eq(shareTypes.id, shareTransactions.shareTypeId))
      .where(where)
      .orderBy(desc(shareTransactions.createdAt))
      .limit(filter.limit ?? 100);

    return rows.map(r => ({
      ...r,
      amountPerShare: toNumber(r.amountPerShare),
      totalAmount: toNumber(r.totalAmount),
    }));
  }

  async createTransaction(data: typeof shareTransactions.$inferInsert) {
    const [row] = await this.db.insert(shareTransactions).values(data).returning();
    return row ? {
      ...row,
      amountPerShare: toNumber(row.amountPerShare),
      totalAmount: toNumber(row.totalAmount),
    } : null;
  }

  // ============================================================
  // SHARE CERTIFICATES
  // ============================================================
  async listCertificates(organizationId: string, filter: { memberId?: string; limit?: number } = {}) {
    const conditions: SQL[] = [eq(shareCertificates.organizationId, organizationId)];
    if (filter.memberId) conditions.push(eq(shareCertificates.memberId, filter.memberId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db.select({
      id: shareCertificates.id,
      organizationId: shareCertificates.organizationId,
      certificateNo: shareCertificates.certificateNo,
      holdingId: shareCertificates.holdingId,
      memberId: shareCertificates.memberId,
      memberName: members.fullName,
      memberNo: members.memberNo,
      shareTypeId: shareCertificates.shareTypeId,
      shareTypeName: shareTypes.name,
      numberOfShares: shareCertificates.numberOfShares,
      issuedDateBS: shareCertificates.issuedDateBs,
      status: shareCertificates.status,
      cancelledAt: shareCertificates.cancelledAt,
      createdAt: shareCertificates.createdAt,
    })
      .from(shareCertificates)
      .leftJoin(members, eq(members.id, shareCertificates.memberId))
      .leftJoin(shareTypes, eq(shareTypes.id, shareCertificates.shareTypeId))
      .where(where)
      .orderBy(desc(shareCertificates.createdAt))
      .limit(filter.limit ?? 100);

    return rows.map(r => ({ ...r }));
  }

  /**
   * Real member share data for the share certificate: aggregates the member's
   * ACTIVE share holdings (total kitta + paid-up capital + face value) and, when
   * a specific certificate is previewed, derives the distinctive kitta serial
   * range from that certificate's issued shares. Serial base follows the app's
   * established convention of distinctive kitta starting at 1001.
   */
  async getMemberShareCertificateData(organizationId: string, memberId: string, certificateId?: string) {
    if (!organizationId) throw new Error('organizationId is required');
    if (!memberId) throw new Error('memberId is required');

    // 1. Member identity + KYC (citizenship / address live in member_kyc_profiles)
    const [memberRow] = await this.db.select({
      id: members.id,
      memberNo: members.memberNo,
      fullName: members.fullName,
      membershipDateBs: members.membershipDateBs,
      citizenshipNo: memberKycProfiles.citizenshipNo,
      address: memberKycProfiles.address,
    })
      .from(members)
      .leftJoin(memberKycProfiles, eq(memberKycProfiles.memberId, members.id))
      .where(and(eq(members.id, memberId), eq(members.organizationId, organizationId)))
      .limit(1);

    if (!memberRow) throw new Error('Member record not found.');

    // 2. Active holdings aggregate → real total kitta & paid-up capital
    const holdings = await this.db.select({
      numberOfShares: shareHoldings.numberOfShares,
      faceValuePerShare: shareHoldings.faceValuePerShare,
      totalValue: shareHoldings.totalValue,
    })
      .from(shareHoldings)
      .where(and(
        eq(shareHoldings.organizationId, organizationId),
        eq(shareHoldings.memberId, memberId),
        eq(shareHoldings.status, 'Active'),
      ))
      .orderBy(asc(shareHoldings.createdAt));

    const totalShares = holdings.reduce((s, h) => s + (h.numberOfShares || 0), 0);
    const totalCapital = holdings.reduce((s, h) => s + toNumber(h.totalValue), 0);
    const faceValue = holdings.length > 0 ? toNumber(holdings[0].faceValuePerShare) || 100 : 100;

    // 3. Certificate ledger — pick the target certificate (specific one, else the latest active)
    const certRows = await this.db.select({
      id: shareCertificates.id,
      certificateNo: shareCertificates.certificateNo,
      numberOfShares: shareCertificates.numberOfShares,
      issuedDateBs: shareCertificates.issuedDateBs,
      status: shareCertificates.status,
      createdAt: shareCertificates.createdAt,
    })
      .from(shareCertificates)
      .where(and(
        eq(shareCertificates.organizationId, organizationId),
        eq(shareCertificates.memberId, memberId),
      ))
      .orderBy(asc(shareCertificates.createdAt));

    const activeCerts = certRows.filter(c => c.status === 'Active');
    const targetCert = certificateId
      ? certRows.find(c => c.id === certificateId)
      : activeCerts[activeCerts.length - 1];

    const certificateNo = targetCert?.certificateNo ?? await this.getNextCertificateNo(organizationId);
    const issuedDateBs = targetCert?.issuedDateBs || memberRow.membershipDateBs;
    const certShares = targetCert?.numberOfShares ?? totalShares;

    // 4. Distinctive kitta range — cumulative serial scheme (base 1001):
    //    kittaStart = 1001 + (sum of shares on earlier certificates of this member)
    let priorShares = 0;
    if (targetCert) {
      for (const c of certRows) {
        if (c.id === targetCert.id) break;
        priorShares += c.numberOfShares || 0;
      }
    }
    const kittaStart = 1001 + priorShares;
    const kittaEnd = kittaStart + (certShares || totalShares) - 1;

    return {
      member: {
        id: memberRow.id,
        memberNo: memberRow.memberNo,
        fullName: memberRow.fullName,
        citizenshipNo: memberRow.citizenshipNo || 'N/A',
        address: memberRow.address || '—',
        membershipDateBS: memberRow.membershipDateBs,
      },
      certificate: {
        certificateNo,
        totalShares,
        faceValue,
        totalCapital,
        issuedDateBS: issuedDateBs,
        kittaStart,
        kittaEnd,
      },
    };
  }

  async getNextCertificateNo(organizationId: string): Promise<string> {
    const [row]: any = await this.db.execute(sql`
      SELECT count(*) AS c FROM share_certificates WHERE organization_id = ${organizationId}
    `);
    const count = Number(row?.c ?? 0);
    return `SC-${String(count + 1).padStart(5, '0')}`;
  }

  async createCertificate(data: typeof shareCertificates.$inferInsert) {
    const [row] = await this.db.insert(shareCertificates).values(data).returning();
    return row ?? null;
  }

  async getNextVoucherNo(organizationId: string): Promise<string> {
    const [row]: any = await this.db.execute(sql`
      SELECT count(*) AS c FROM share_transactions WHERE organization_id = ${organizationId}
    `);
    const count = Number(row?.c ?? 0);
    return `STX-${String(count + 1).padStart(5, '0')}`;
  }

  // ============================================================
  // SHARE TRANSFERS (registry — audit trail)
  // ============================================================
  async getNextTransferNo(organizationId: string): Promise<string> {
    const [row]: any = await this.db.execute(sql`
      SELECT count(*) AS c FROM share_transfers WHERE organization_id = ${organizationId}
    `);
    const count = Number(row?.c ?? 0);
    return `ST-${String(count + 1).padStart(5, '0')}`;
  }

  async getNextJournalVoucherNo(organizationId: string): Promise<string> {
    const [row]: any = await this.db.execute(sql`
      SELECT count(*) AS c FROM vouchers WHERE organization_id = ${organizationId}
    `);
    const count = Number(row?.c ?? 0);
    return `JV-${String(count + 1).padStart(5, '0')}`;
  }

  /** Find the org's current fiscal year (for voucher linkage). */
  async getCurrentFiscalYearId(organizationId: string, tx?: any): Promise<string | null> {
    const db = tx ?? this.db;
    const [row]: any = await db.execute(sql`
      SELECT id FROM fiscal_years
      WHERE organization_id = ${organizationId}
      ORDER BY is_current DESC, code DESC LIMIT 1
    `);
    return row?.id ?? null;
  }

  /**
   * Find or lazily create the Share Capital COA account (Equity).
   * Prefers the org's configured system-account mapping (share_capital), falling
   * back to the legacy name-based lookup, and records the mapping so the wiring
   * becomes authoritative on the next run.
   */
  async findOrCreateShareCapitalAccount(organizationId: string, branchId?: string | null, tx?: any) {
    const db = tx ?? this.db;

    // 1) Authoritative source: configured system account mapping.
    const mapped = await this.getMappedSystemAccount(organizationId, 'share_capital', tx);
    if (mapped) return mapped;

    // 2) Backward-compatible name lookup.
    const existing: any = await db.select().from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.organizationId, organizationId),
        eq(chartOfAccounts.type, 'Equity'),
        ilike(chartOfAccounts.name, '%Share Capital%'),
      ))
      .limit(1);
    if (existing && existing.length > 0) {
      await this.writeSystemMapping(organizationId, 'share_capital', existing[0].id, tx);
      return existing[0];
    }

    const created = await db.insert(chartOfAccounts).values({
      organizationId,
      code: '04-01',
      name: 'Share Capital',
      type: 'Equity',
      balance: '0',
      isSystemAccount: true,
      branchId: branchId ?? null,
      description: 'Auto-created for share transfer journaling',
      isActive: true,
    }).returning();
    await this.writeSystemMapping(organizationId, 'share_capital', created[0].id, tx);
    return created[0];
  }

  /** Find or lazily create a Cash/Bank COA account (Asset) for share proceeds. */
  async findOrCreateCashAccount(organizationId: string, branchId?: string | null, tx?: any) {
    const db = tx ?? this.db;

    // 1) Authoritative source: configured system account mapping.
    const mapped = await this.getMappedSystemAccount(organizationId, 'cash_bank', tx);
    if (mapped) return mapped;

    // 2) Prefer ledger-book compatible asset codes (04-8x cash / 04-9x bank)
    //    so the cash side renders on the Assets ledger sheet, which buckets
    //    asset accounts by code prefix (04-* / 100*).
    for (const code of ['04-80', '04-90']) {
      const byCode: any = await db.select().from(chartOfAccounts)
        .where(and(
          eq(chartOfAccounts.organizationId, organizationId),
          eq(chartOfAccounts.type, 'Asset'),
          eq(chartOfAccounts.code, code),
          eq(chartOfAccounts.isActive, true),
        ))
        .limit(1);
      if (byCode && byCode.length > 0) {
        await this.writeSystemMapping(organizationId, 'cash_bank', byCode[0].id, tx);
        return byCode[0];
      }
    }

    // 3) Any other Asset account under the ledger-book asset prefixes.
    const existing: any = await db.select().from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.organizationId, organizationId),
        eq(chartOfAccounts.type, 'Asset'),
        or(
          ilike(chartOfAccounts.code, '04-%'),
          ilike(chartOfAccounts.code, '100%'),
        ),
      ))
      .limit(1);
    if (existing && existing.length > 0) {
      await this.writeSystemMapping(organizationId, 'cash_bank', existing[0].id, tx);
      return existing[0];
    }

    // 4) Backward-compatible name lookup.
    const byName: any = await db.select().from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.organizationId, organizationId),
        eq(chartOfAccounts.type, 'Asset'),
        or(
          ilike(chartOfAccounts.name, '%Cash%'),
          ilike(chartOfAccounts.name, '%Bank%'),
          ilike(chartOfAccounts.name, '%बैंक%'),
        ),
      ))
      .limit(1);
    if (byName && byName.length > 0) {
      await this.writeSystemMapping(organizationId, 'cash_bank', byName[0].id, tx);
      return byName[0];
    }

    const created = await db.insert(chartOfAccounts).values({
      organizationId,
      code: '04-80',
      name: 'Cash',
      type: 'Asset',
      balance: '0',
      isSystemAccount: true,
      branchId: branchId ?? null,
      description: 'Auto-created for share issue/return journaling',
      isActive: true,
    }).returning();
    await this.writeSystemMapping(organizationId, 'cash_bank', created[0].id, tx);
    return created[0];
  }

  /** Resolve a mapped system account from system_account_mappings (no creation). */
  async getMappedSystemAccount(organizationId: string, key: string, tx?: any) {
    const db = tx ?? this.db;
    const rows: any = await db.select({
      id: chartOfAccounts.id,
      organizationId: chartOfAccounts.organizationId,
      code: chartOfAccounts.code,
      name: chartOfAccounts.name,
      nameNepali: chartOfAccounts.nameNepali,
      type: chartOfAccounts.type,
      parentCode: chartOfAccounts.parentCode,
      balance: chartOfAccounts.balance,
      normalBalance: chartOfAccounts.normalBalance,
      allowPosting: chartOfAccounts.allowPosting,
      isSystemAccount: chartOfAccounts.isSystemAccount,
      branchId: chartOfAccounts.branchId,
      isActive: chartOfAccounts.isActive,
    })
      .from(systemAccountMappings)
      .innerJoin(chartOfAccounts, eq(systemAccountMappings.accountId, chartOfAccounts.id))
      .where(and(
        eq(systemAccountMappings.organizationId, organizationId),
        eq(systemAccountMappings.mappingKey, key as any)
      ))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Record/refresh a system_account_mappings row (idempotent per org+key). */
  async writeSystemMapping(organizationId: string, key: string, accountId: string, tx?: any) {
    const db = tx ?? this.db;
    const existing: any = await db.select({ id: systemAccountMappings.id }).from(systemAccountMappings)
      .where(and(
        eq(systemAccountMappings.organizationId, organizationId),
        eq(systemAccountMappings.mappingKey, key as any)
      ))
      .limit(1);
    if (existing && existing.length > 0) return;
    await db.insert(systemAccountMappings).values({
      organizationId,
      mappingKey: key,
      accountId,
      description: `Auto-mapped ${key}`,
    }).onConflictDoNothing();
  }

  /** Resolve a branch id for voucher linkage, falling back to head office. */
  async resolveBranchId(organizationId: string, preferred?: string | null, tx?: any): Promise<string | null> {
    const db = tx ?? this.db;
    if (preferred) return preferred;
    const rows: any = await db.execute(sql`
      SELECT id FROM branches
      WHERE organization_id = ${organizationId} AND status = 'Active'
      ORDER BY is_head_office DESC, created_at ASC LIMIT 1
    `);
    return rows?.[0]?.id ?? null;
  }

  async getLastSubsidiaryBalance(organizationId: string, memberId: string, tx?: any): Promise<number> {
    const db = tx ?? this.db;
    const rows: any = await db.execute(sql`
      SELECT balance_amount FROM subsidiary_shares_book
      WHERE organization_id = ${organizationId} AND member_id = ${memberId}
      ORDER BY created_at DESC, id DESC LIMIT 1
    `);
    return Number(rows?.[0]?.balance_amount ?? 0);
  }

  // ============================================================
  // AUTO-PROVISIONED SHARE ACCOUNTS + KITTA NUMBERING
  // ============================================================
  /**
   * Fetch a member's master share account, or lazily create it (accountNo
   * `SHA-{memberNo}`). Idempotent across concurrent first-issues.
   */
  async findOrCreateShareAccount(organizationId: string, memberId: string, memberNo: string, tx?: any) {
    const db = tx ?? this.db;
    const accountNo = `SHA-${memberNo}`;
    const [created] = await db.insert(shareAccounts).values({
      organizationId,
      memberId,
      accountNo,
    }).onConflictDoNothing().returning();
    if (created) return { account: created, created: true };
    const rows: any = await db.select().from(shareAccounts)
      .where(and(
        eq(shareAccounts.organizationId, organizationId),
        eq(shareAccounts.memberId, memberId),
      ))
      .limit(1);
    return { account: rows[0], created: false };
  }

  /** A member's share account row, if one already exists (open-account guard). */
  async getShareAccountByMember(organizationId: string, memberId: string) {
    const rows: any = await this.db.select().from(shareAccounts)
      .where(and(
        eq(shareAccounts.organizationId, organizationId),
        eq(shareAccounts.memberId, memberId),
      ))
      .limit(1);
    return rows[0] ?? null;
  }

  // ============================================================
  // SHARE ACCOUNT NOMINEES (हकवाला)
  // ============================================================
  /**
   * Bulk-insert nominees inside the SAME transaction that creates/provisions
   * the share account, so the account + its nominee register commit atomically.
   */
  async insertShareAccountNominees(
    tx: any,
    organizationId: string,
    shareAccountId: string,
    nominees: Array<{
      fullName: string;
      relation: string;
      citizenshipNo?: string | null;
      contactNo?: string | null;
      photoUrl?: string | null;
      sharePercentage: number;
      isPrimary: boolean;
    }>,
  ) {
    if (!nominees?.length) return;
    await tx.insert(shareAccountNominees).values(
      nominees.map((n) => ({
        organizationId,
        shareAccountId,
        fullName: n.fullName,
        relation: n.relation,
        citizenshipNo: n.citizenshipNo ?? null,
        contactNo: n.contactNo ?? null,
        photoUrl: n.photoUrl ?? null,
        sharePercentage: String(n.sharePercentage),
        isPrimary: !!n.isPrimary,
      })),
    );
  }

  /** Nominee register for a member's share account (for review/print). */
  async listShareAccountNominees(organizationId: string, memberId: string) {
    const rows: any = await this.db.execute(sql`
      SELECT
        san.id, san.full_name, san.relation, san.citizenship_no, san.contact_no,
        san.photo_url, san.share_percentage, san.is_primary, san.created_at,
        sa.id AS share_account_id, sa.account_no
      FROM share_account_nominees san
      JOIN share_accounts sa ON sa.id = san.share_account_id
      WHERE san.organization_id = ${organizationId} AND sa.member_id = ${memberId}
      ORDER BY san.is_primary DESC, san.created_at ASC
    `);
    return rows.map((r: any) => ({
      id: r.id,
      shareAccountId: r.share_account_id,
      accountNo: r.account_no,
      fullName: r.full_name,
      relation: r.relation,
      citizenshipNo: r.citizenship_no ?? null,
      contactNo: r.contact_no ?? null,
      photoUrl: r.photo_url ?? null,
      sharePercentage: Number(r.share_percentage),
      isPrimary: !!r.is_primary,
      createdAt: r.created_at,
    }));
  }

  // ============================================================
  // ORG SHARE SETTINGS (authorized ceilings + running totals)
  // ============================================================
  /** Read the org's share settings, lazily creating the row if absent. */
  async getOrgShareSettings(organizationId: string) {
    const db = this.db;
    let rows: any = await db.execute(sql`
      SELECT
        id, organization_id, authorized_capital_ceiling, authorized_total_kitta,
        default_face_value, min_required_kitta, total_issued_kitta, total_issued_capital, updated_at
      FROM organization_share_settings
      WHERE organization_id = ${organizationId}
    `);
    if (!rows?.[0]) {
      await this.lockOrgShareSettings(organizationId);
      rows = await db.execute(sql`
        SELECT
          id, organization_id, authorized_capital_ceiling, authorized_total_kitta,
          default_face_value, min_required_kitta, total_issued_kitta, total_issued_capital, updated_at
        FROM organization_share_settings
        WHERE organization_id = ${organizationId}
      `);
    }
    const r = rows[0];
    return {
      id: r.id,
      organizationId: r.organization_id,
      authorizedCapitalCeiling: String(r.authorized_capital_ceiling),
      authorizedTotalKitta: Number(r.authorized_total_kitta),
      defaultFaceValue: String(r.default_face_value ?? '100.00'),
      minRequiredKitta: Number(r.min_required_kitta ?? 10),
      totalIssuedKitta: Number(r.total_issued_kitta ?? 0),
      totalIssuedCapital: String(r.total_issued_capital ?? '0.00'),
      updatedAt: r.updated_at,
    };
  }

  /** Update the org ceilings. Never allow lowering a ceiling below already-issued amounts. */
  async updateOrgShareSettings(
    organizationId: string,
    fields: {
      authorizedCapitalCeiling?: number | null;
      authorizedTotalKitta?: number | null;
      defaultFaceValue?: number | null;
      minRequiredKitta?: number | null;
    },
  ) {
    const db = this.db;
    const exists: any = await db.execute(sql`
      SELECT authorized_capital_ceiling, authorized_total_kitta, total_issued_kitta, total_issued_capital
      FROM organization_share_settings
      WHERE organization_id = ${organizationId}
    `);
    if (!exists?.[0]) await this.lockOrgShareSettings(organizationId);

    const issuedKitta = Number(exists?.[0]?.total_issued_kitta ?? 0);
    const issuedCapital = Number(exists?.[0]?.total_issued_capital ?? 0);

    if (fields.authorizedTotalKitta != null) {
      if (fields.authorizedTotalKitta < issuedKitta) {
        throw new ShareCeilingError(`Authorized total kitta cannot be below the ${issuedKitta} kitta already issued.`);
      }
    }
    if (fields.authorizedCapitalCeiling != null) {
      if (Number(fields.authorizedCapitalCeiling) < issuedCapital) {
        throw new ShareCeilingError(`Authorized capital ceiling cannot be below the NPR ${issuedCapital} already issued.`);
      }
    }

    const row = await db.update(organizationShareSettings)
      .set({
        authorizedCapitalCeiling: fields.authorizedCapitalCeiling != null ? String(fields.authorizedCapitalCeiling) : undefined,
        authorizedTotalKitta: fields.authorizedTotalKitta != null ? fields.authorizedTotalKitta : undefined,
        defaultFaceValue: fields.defaultFaceValue != null ? String(fields.defaultFaceValue) : undefined,
        minRequiredKitta: fields.minRequiredKitta != null ? fields.minRequiredKitta : undefined,
        updatedAt: new Date(),
      })
      .where(eq(organizationShareSettings.organizationId, organizationId))
      .returning();
    const r = row[0];
    return {
      id: r.id,
      organizationId: r.organizationId,
      authorizedCapitalCeiling: String(r.authorizedCapitalCeiling),
      authorizedTotalKitta: Number(r.authorizedTotalKitta),
      defaultFaceValue: String(r.defaultFaceValue ?? '100.00'),
      minRequiredKitta: Number(r.minRequiredKitta ?? 10),
      totalIssuedKitta: Number(r.totalIssuedKitta ?? 0),
      totalIssuedCapital: String(r.totalIssuedCapital ?? '0.00'),
      updatedAt: r.updatedAt,
    };
  }

  /**
   * Lock the org's organization_share_settings row (SELECT ... FOR UPDATE).
   * This is the FIRST lock in the fixed acquisition order
   * (org settings -> share_types -> share account) across every mutation path.
   * Lazily creates the row if missing, seeding ceilings from current issued totals.
   */
  async lockOrgShareSettings(organizationId: string, tx?: any) {
    const db = tx ?? this.db;
    const rows: any = await db.execute(sql`
      SELECT
        id, organization_id, authorized_capital_ceiling, authorized_total_kitta,
        default_face_value, min_required_kitta, total_issued_kitta, total_issued_capital
      FROM organization_share_settings
      WHERE organization_id = ${organizationId}
      FOR UPDATE
    `);
    if (rows?.[0]) return rows[0];

    const totals: any = await db.execute(sql`
      SELECT COALESCE(SUM(total_shares), 0) AS kitta,
             COALESCE(SUM(total_capital_amount), 0) AS capital
      FROM share_accounts WHERE organization_id = ${organizationId}
    `);
    const kitta = Number(totals?.[0]?.kitta ?? 0);
    const capital = String(totals?.[0]?.capital ?? '0');
    const created: any = await db.execute(sql`
      INSERT INTO organization_share_settings
        (organization_id, authorized_capital_ceiling, authorized_total_kitta,
         min_required_kitta, total_issued_kitta, total_issued_capital)
      VALUES (${organizationId}, ${capital}, ${kitta}, 10, ${kitta}, ${capital})
      ON CONFLICT (organization_id) DO NOTHING
      RETURNING
        id, organization_id, authorized_capital_ceiling, authorized_total_kitta,
        default_face_value, min_required_kitta, total_issued_kitta, total_issued_capital
    `);
    if (created?.[0]) return created[0];
    // Lost the race — the winner has committed; re-select to lock their row.
    const again: any = await db.execute(sql`
      SELECT
        id, organization_id, authorized_capital_ceiling, authorized_total_kitta,
        default_face_value, total_issued_kitta, total_issued_capital
      FROM organization_share_settings
      WHERE organization_id = ${organizationId}
      FOR UPDATE
    `);
    return again[0];
  }

  /**
   * Lock the share_types row (SELECT ... FOR UPDATE) — the SECOND lock in the
   * fixed acquisition order. Returns the kitta/ceiling view used by the engine.
   */
  async lockShareTypeForUpdate(organizationId: string, shareTypeId: string, tx?: any) {
    const db = tx ?? this.db;
    const rows: any = await db.execute(sql`
      SELECT
        id, name, face_value, status, kitta_prefix, kitta_start_base,
        current_kitta_pointer, max_allowed_kitta, auto_sequence
      FROM share_types
      WHERE id = ${shareTypeId} AND organization_id = ${organizationId}
      FOR UPDATE
    `);
    return rows?.[0] ?? null;
  }

  /**
   * Allocate a kitta range for an issue under the already-held share_types row
   * lock, advancing current_kitta_pointer under the same lock.
   *
   * - auto_sequence = true  : auto-allocate the next sequential range.
   * - auto_sequence = false : the operator's manual range is validated
   *   (length fits the quantity, no overlap with issued ranges for this class);
   *   the pointer advances ONLY when the manual range is contiguous with it.
   *
   * Returns null when the caller chooses not to record kitta (no range).
   */
  async applyKittaAllocation(
    organizationId: string,
    shareTypeId: string,
    quantity: number,
    typeRow: any,
    manualStartKitta: number | null,
    manualEndKitta: number | null,
    tx?: any,
  ): Promise<{ startKittaNo: number; endKittaNo: number } | null> {
    const db = tx ?? this.db;
    const auto = typeRow.auto_sequence !== false;

    if (auto) {
      const range = computeKittaRange(
        { kittaStartBase: typeRow.kitta_start_base, currentKittaPointer: Number(typeRow.current_kitta_pointer ?? 0) },
        quantity,
      );
      await db.execute(sql`
        UPDATE share_types
        SET current_kitta_pointer = ${range.end}, updated_at = now()
        WHERE id = ${shareTypeId} AND organization_id = ${organizationId}
      `);
      return { startKittaNo: range.start, endKittaNo: range.end };
    }

    // Manual entry path (legacy record migration).
    const start = manualStartKitta != null ? Number(manualStartKitta) : null;
    const end = manualEndKitta != null ? Number(manualEndKitta) : null;
    if (start == null || end == null || !Number.isInteger(start) || !Number.isInteger(end)) {
      throw new ShareCeilingError('A valid manual kitta range (start and end) is required for this share type.');
    }
    if (start > end) throw new ShareCeilingError('Manual kitta start cannot exceed end.');
    if (end - start + 1 !== quantity) {
      throw new ShareCeilingError(`Manual kitta range length (${end - start + 1}) must equal the kitta being issued (${quantity}).`);
    }
    const overlap: any = await db.execute(sql`
      SELECT 1
      FROM subsidiary_shares_book
      WHERE organization_id = ${organizationId}
        AND share_type_id = ${shareTypeId}
        AND start_kitta_no IS NOT NULL
        AND start_kitta_no <= ${end} AND end_kitta_no >= ${start}
      LIMIT 1
    `);
    if (overlap.length > 0) {
      throw new ShareCeilingError(`Manual kitta range ${start}-${end} overlaps an already-issued range for this share type.`);
    }
    // Only advance the pointer when the manual range continues the sequence;
    // otherwise leave it untouched so automatic allocation never collides.
    const contiguous = start === nextStartKitta({
      kittaStartBase: typeRow.kitta_start_base,
      currentKittaPointer: Number(typeRow.current_kitta_pointer ?? 0),
    });
    if (contiguous) {
      await db.execute(sql`
        UPDATE share_types
        SET current_kitta_pointer = ${end}, updated_at = now()
        WHERE id = ${shareTypeId} AND organization_id = ${organizationId}
      `);
    }
    return { startKittaNo: start, endKittaNo: end };
  }

  /** Update the org-wide running totals inside the caller's transaction. */
  async updateOrgShareSettingsTotals(
    organizationId: string,
    distribution: { kitta: number; capital: number },
    tx?: any,
  ) {
    const db = tx ?? this.db;
    await db.execute(sql`
      UPDATE organization_share_settings
      SET
        total_issued_kitta = GREATEST(0, total_issued_kitta + ${distribution.kitta}),
        total_issued_capital = GREATEST(0, total_issued_capital + ${distribution.capital}),
        updated_at = now()
      WHERE organization_id = ${organizationId}
    `);
  }

  /** Atomically adjust the master account totals (clamped at zero). */
  async updateShareAccountTotals(organizationId: string, memberId: string, sharesDelta: number, capitalDelta: number, tx?: any) {
    const db = tx ?? this.db;
    await db.execute(sql`
      UPDATE share_accounts
      SET total_shares = GREATEST(0, total_shares + ${sharesDelta}),
          total_capital_amount = GREATEST(0, total_capital_amount + ${capitalDelta})
      WHERE organization_id = ${organizationId} AND member_id = ${memberId}
    `);
  }

  /** Fetch a chart-of-accounts row scoped to the organization (no creation). */
  async getChartAccountById(organizationId: string, accountId: string, tx?: any) {
    const db = tx ?? this.db;
    const rows: any = await db.select().from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.id, accountId),
        eq(chartOfAccounts.organizationId, organizationId),
      ))
      .limit(1);
    return rows[0] ?? null;
  }

  // ============================================================
  // SHARE REGISTER (master accounts) + ACCOUNT HISTORY
  // ============================================================
  async listShareRegister(organizationId: string, filter: { search?: string; status?: string } = {}) {
    const { search, status } = filter;
    let where = sql`sa.organization_id = ${organizationId}`;
    if (search) {
      const q = `%${search}%`;
      where = sql`${where} AND (m.member_no ILIKE ${q} OR m.full_name ILIKE ${q})`;
    }
    if (status) {
      where = sql`${where} AND m.status = ${status}`;
    }
    const rows: any = await this.db.execute(sql`
      SELECT
        sa.id AS account_id,
        sa.account_no,
        sa.total_shares,
        sa.total_capital_amount,
        m.id AS member_id,
        m.member_no,
        m.full_name,
        mt.name AS membership_type,
        m.status AS member_status,
        COALESCE(MAX(st.dividend_rate), 0) AS dividend_rate,
        ROUND(sa.total_capital_amount::numeric * COALESCE(MAX(st.dividend_rate), 0) / 100, 2) AS estimated_dividend,
        sa.created_at AS account_created_at
      FROM share_accounts sa
      JOIN members m ON m.id = sa.member_id
      LEFT JOIN member_types mt ON mt.id = m.member_type_id
      LEFT JOIN share_holdings h ON h.member_id = sa.member_id
        AND h.organization_id = sa.organization_id AND h.status = 'Active'
      LEFT JOIN share_types st ON st.id = h.share_type_id
      WHERE ${where}
      GROUP BY sa.id, sa.account_no, sa.total_shares, sa.total_capital_amount,
               m.id, m.member_no, m.full_name, mt.name, m.status, sa.created_at
      ORDER BY m.member_no ASC
      LIMIT 500
    `);
    return rows.map((r: any) => ({
      accountId: r.account_id,
      accountNo: r.account_no,
      memberId: r.member_id,
      memberNo: r.member_no,
      memberName: r.full_name,
      membershipType: r.membership_type,
      totalShares: toNumber(r.total_shares),
      totalCapital: toNumber(r.total_capital_amount),
      dividendRate: toNumber(r.dividend_rate),
      estimatedDividend: toNumber(r.estimated_dividend),
      status: r.member_status,
      createdAt: r.account_created_at,
    }));
  }

  /**
   * Members eligible for their FIRST share account — Active members who do not
   * yet have a share_accounts row. Also returns the member_family nominee
   * default (हकवाला) so the open-account form can prefill a single 100% nominee.
   */
  async listUnprovisionedMembers(organizationId: string, search?: string) {
    let where = sql`m.organization_id = ${organizationId}
      AND m.status = 'Active'
      AND NOT EXISTS (
        SELECT 1 FROM share_accounts sa
        WHERE sa.organization_id = ${organizationId} AND sa.member_id = m.id
      )`;
    if (search) {
      const q = `%${search}%`;
      where = sql`${where} AND (m.member_no ILIKE ${q} OR m.full_name ILIKE ${q})`;
    }
    const rows: any = await this.db.execute(sql`
      SELECT
        m.id AS member_id,
        m.member_no,
        m.full_name,
        m.phone,
        m.branch_id,
        b.name AS branch_name,
        mt.name AS membership_type,
        m.created_at,
        mf.nominee_name,
        mf.nominee_relation_id,
        mf.nominee_type_id,
        rt.name AS nominee_relation,
        mf.nominee_phone,
        mf.nominee_citizenship_no,
        mf.nominee_share_pct
      FROM members m
      LEFT JOIN member_types mt ON mt.id = m.member_type_id
      LEFT JOIN branches b ON b.id = m.branch_id
      LEFT JOIN member_family mf ON mf.member_id = m.id
      LEFT JOIN relationship_types rt ON rt.id = mf.nominee_relation_id
      WHERE ${where}
      ORDER BY m.member_no ASC
      LIMIT 500
    `);
    return rows.map((r: any) => ({
      id: r.member_id,
      memberNo: r.member_no,
      fullName: r.full_name,
      phone: r.phone ?? null,
      branchId: r.branch_id ?? null,
      branchName: r.branch_name ?? null,
      membershipType: r.membership_type ?? null,
      createdAt: r.created_at,
      defaultNominee: {
        fullName: r.nominee_name ?? null,
        relationId: r.nominee_relation_id ?? null,
        relation: r.nominee_relation ?? null,
        phone: r.nominee_phone ?? null,
        citizenshipNo: r.nominee_citizenship_no ?? null,
        sharePct: r.nominee_share_pct != null ? Number(r.nominee_share_pct) : null,
      },
    }));
  }

  async getShareAccountDetail(organizationId: string, memberId: string) {
    const [account]: any = await this.db.execute(sql`
      SELECT
        sa.id, sa.account_no, sa.total_shares, sa.total_capital_amount, sa.created_at,
        m.member_no, m.full_name, mt.name AS membership_type,
        COALESCE(MAX(st.dividend_rate), 0) AS dividend_rate
      FROM share_accounts sa
      JOIN members m ON m.id = sa.member_id
      LEFT JOIN member_types mt ON mt.id = m.member_type_id
      LEFT JOIN share_holdings h ON h.member_id = sa.member_id
        AND h.organization_id = sa.organization_id AND h.status = 'Active'
      LEFT JOIN share_types st ON st.id = h.share_type_id
      WHERE sa.organization_id = ${organizationId} AND sa.member_id = ${memberId}
      GROUP BY sa.id, sa.account_no, sa.total_shares, sa.total_capital_amount,
               sa.created_at, m.member_no, m.full_name, mt.name
    `);
    if (!account) return null;
    const history: any = await this.db.execute(sql`
      SELECT
        s.id, s.voucher_no, s.transaction_date_bs, s.transaction_type, s.share_quantity,
        s.face_value, s.debit_amount, s.credit_amount, s.balance_amount,
        s.start_kitta_no, s.end_kitta_no, s.created_at,
        s.share_type_id, st.code AS share_type_code, st.name AS share_type_name, st.kitta_prefix
      FROM subsidiary_shares_book s
      LEFT JOIN share_types st ON st.id = s.share_type_id
      WHERE s.organization_id = ${organizationId} AND s.member_id = ${memberId}
      ORDER BY s.created_at ASC, s.id ASC
    `);

    const rows = history.map((h: any) => ({
      id: h.id,
      voucherNo: h.voucher_no,
      transactionDateBs: h.transaction_date_bs,
      transactionType: h.transaction_type,
      shareQuantity: toNumber(h.share_quantity),
      faceValue: toNumber(h.face_value),
      debitAmount: toNumber(h.debit_amount),
      creditAmount: toNumber(h.credit_amount),
      balanceAmount: toNumber(h.balance_amount),
      startKittaNo: h.start_kitta_no != null ? Number(h.start_kitta_no) : null,
      endKittaNo: h.end_kitta_no != null ? Number(h.end_kitta_no) : null,
      shareTypeId: h.share_type_id ?? null,
      shareTypeCode: h.share_type_code ?? null,
      shareTypeName: h.share_type_name ?? null,
      kittaPrefix: h.kitta_prefix ?? '',
    }));

    return {
      account: {
        id: account.id,
        accountNo: account.account_no,
        memberId,
        memberNo: account.member_no,
        memberName: account.full_name,
        membershipType: account.membership_type,
        totalShares: toNumber(account.total_shares),
        totalCapital: toNumber(account.total_capital_amount),
        dividendRate: toNumber(account.dividend_rate),
        createdAt: account.created_at,
      },
      history: rows,
      panels: {
        issuances: rows.filter((r) => r.shareQuantity > 0 && (r.transactionType === 'Purchase' || r.transactionType === 'Bonus')),
        returnsAndTransfers: rows.filter((r) => r.transactionType === 'Return' || r.transactionType === 'Transfer_In' || r.transactionType === 'Transfer_Out'),
        certificateRegister: this.buildCertificateRegister(rows),
      },
    };
  }

  /**
   * Certificate register — the contiguous kitta ranges still held by a member.
   *
   * Negative movements (Return / Transfer_Out) consume from the EARLIEST
   * unreturned issue block of the same share type (FIFO convention), then
   * adjacent remaining blocks are merged into contiguous ranges. Movements
   * whose share type could not be back-linked are bucketed under "Legacy".
   */
  private buildCertificateRegister(rows: any[]) {
    const receiptOrder = rows.some((r) => r.transactionType === 'Purchase' || r.transactionType === 'Bonus' || r.transactionType === 'Transfer_In');
    if (!receiptOrder) return [];

    const byType = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.shareTypeId ?? '__legacy__';
      if (!byType.has(key)) byType.set(key, []);
      byType.get(key)!.push(r);
    }

    const register: {
      shareTypeId: string | null;
      shareTypeCode: string | null;
      shareTypeName: string | null;
      kittaPrefix: string;
      startKittaNo: number | null;
      endKittaNo: number | null;
      quantity: number;
      formattedRange: string;
    }[] = [];

    for (const [, typeRows] of byType) {
      // Queue of still-held issue blocks (FIFO consumption order).
      const queue: {
        start: number | null;
        end: number | null;
        quantity: number;
        shareTypeId: string | null;
        shareTypeCode: string | null;
        shareTypeName: string | null;
        kittaPrefix: string;
      }[] = [];

      for (const r of typeRows) {
        if (r.shareQuantity > 0) {
          queue.push({
            start: r.startKittaNo,
            end: r.endKittaNo,
            quantity: r.shareQuantity,
            shareTypeId: r.shareTypeId,
            shareTypeCode: r.shareTypeCode,
            shareTypeName: r.shareTypeName,
            kittaPrefix: r.kittaPrefix ?? '',
          });
        } else {
          let need = -r.shareQuantity;
          while (need > 0 && queue.length > 0) {
            const head = queue[0];
            const take = Math.min(head.quantity, need);
            head.quantity -= take;
            need -= take;
            if (head.quantity <= 0) queue.shift();
          }
        }
      }

      // Merge adjacent/contiguous remaining blocks.
      for (let i = 0; i < queue.length; i++) {
        const block = queue[i];
        const hasRange = block.start != null && block.end != null;
        if (i > 0) {
          const prev = queue[i - 1];
          if (
            hasRange &&
            prev.start != null && prev.end != null &&
            prev.end + 1 === block.start &&
            block.shareTypeId === prev.shareTypeId
          ) {
            prev.end = block.end;
            prev.quantity += block.quantity;
            queue.splice(i, 1);
            i--;
            continue;
          }
        }
        register.push({
          shareTypeId: block.shareTypeId,
          shareTypeCode: block.shareTypeCode,
          shareTypeName: block.shareTypeName,
          kittaPrefix: block.kittaPrefix,
          startKittaNo: block.start,
          endKittaNo: block.end,
          quantity: block.quantity,
          formattedRange: hasRange
            ? (block.start === block.end ? `${block.kittaPrefix}${block.start}` : `${block.kittaPrefix}${block.start} – ${block.kittaPrefix}${block.end}`)
            : '—',
        });
      }
    }

    return register;
  }

  /**
   * Atomically executes a unified share ISSUE or RETURN inside one DB transaction:
   * holding +/- , share_transactions, Journal voucher (Dr Cash / Cr Share Capital
   * for ISSUE; Dr Share Capital / Cr Cash for RETURN), subsidiary shares book row,
   * optional certificate (issue only), and member financial profile sync.
   */
  async executeIssueReturn(
    organizationId: string,
    payload: {
      transactionType: 'ISSUE' | 'RETURN';
      memberId: string;
      memberName: string;
      memberNo: string;
      memberBranchId: string | null;
      shareTypeId: string;
      shareTypeName: string;
      faceValue: number;
      shares: number;
      totalAmount: number;
      voucherNo: string;
      certificateNo: string | null;
      dateBs: string;
      dateAd: string;
      remarks: string | null;
      processedBy: string;
      branchId: string | null;
      /** Scheme that priced this transaction (auto-opening provenance). */
      schemeId?: string | null;
      /** 'auto' for member-registration auto-opening, 'manual' otherwise. */
      openedVia?: 'auto' | 'manual';
      /** Overrides the auto-generated GL voucher narration. */
      narration?: string | null;
      /** Chosen payment account (Dr on ISSUE / Cr on RETURN). Falls back to mapped cash/bank. */
      paymentAccountId?: string | null;
      /** Auto-provision the member's master share account on ISSUE (default true). */
      provisionShareAccount?: boolean;
      /** Manual kitta range (required when the share type has autoSequence=false). */
      manualStartKitta?: number | null;
      manualEndKitta?: number | null;
      /** Nominee register (हकवाला) written atomically with the ISSUE. */
      nominees?: Array<{
        fullName: string;
        relation: string;
        citizenshipNo?: string | null;
        contactNo?: string | null;
        photoUrl?: string | null;
        sharePercentage: number;
        isPrimary: boolean;
      }> | null;
    },
  ) {
    const db = this.db;
    return db.transaction(async (tx) => {
      const {
        transactionType, memberId, memberName, memberNo, memberBranchId,
        shareTypeId, shareTypeName, faceValue: clientFaceValue, shares, totalAmount: clientTotalAmount,
        voucherNo, certificateNo, dateBs, dateAd, remarks, processedBy, branchId,
        schemeId = null, openedVia = 'manual', narration = null,
        paymentAccountId = null, provisionShareAccount = true,
        manualStartKitta = null, manualEndKitta = null, nominees = null,
      } = payload;
      const isIssue = transactionType === 'ISSUE';

      let faceValue = Number(clientFaceValue);
      let totalAmount = Number(clientTotalAmount);

      // Resolve branch for GL voucher (NOT NULL constraint)
      const resolvedBranchId = await this.resolveBranchId(organizationId, branchId ?? memberBranchId, tx);

      // ---- Fixed lock order: organization_share_settings -> share_types ----
      // The org-wide running totals row is the single serialization point for
      // the org-level ceiling checks across the whole cooperative.
      const orgSettings = await this.lockOrgShareSettings(organizationId, tx);

      // ---- ISSUE: lock the share type SECOND and check ALL THREE ceilings
      //      against the locked rows before any write reaches the DB ----
      let typeKittaRow: any = null;
      if (isIssue) {
        typeKittaRow = await this.lockShareTypeForUpdate(organizationId, shareTypeId, tx);
        if (!typeKittaRow) throw new Error('Share type not found');
        if (typeKittaRow.status !== 'Active') throw new Error('Share type is not active');

        // NEVER trust client-sent face value or totals — recompute from the locked row.
        faceValue = Number(typeKittaRow.face_value);
        totalAmount = shares * faceValue;

        checkShareCeilings({
          shareType: {
            name: typeKittaRow.name,
            kittaStartBase: typeKittaRow.kitta_start_base,
            currentKittaPointer: Number(typeKittaRow.current_kitta_pointer ?? 0),
            maxAllowedKitta: typeKittaRow.max_allowed_kitta != null ? Number(typeKittaRow.max_allowed_kitta) : null,
            autoSequence: typeKittaRow.auto_sequence !== false,
          },
          orgSettings: {
            totalIssuedKitta: Number(orgSettings.total_issued_kitta ?? 0),
            authorizedTotalKitta: Number(orgSettings.authorized_total_kitta ?? 0),
            totalIssuedCapital: Number(orgSettings.total_issued_capital ?? 0),
            authorizedCapitalCeiling: Number(orgSettings.authorized_capital_ceiling ?? 0),
          },
          quantity: shares,
          totalAmount,
          manualEndKitta: typeKittaRow.auto_sequence === false ? manualEndKitta : null,
        });
      }

      // 1. Find active holding for this member + type
      const [holding] = await tx.select().from(shareHoldings)
        .where(and(
          eq(shareHoldings.organizationId, organizationId),
          eq(shareHoldings.memberId, memberId),
          eq(shareHoldings.shareTypeId, shareTypeId),
          eq(shareHoldings.status, 'Active'),
        ))
        .limit(1);

      let holdingId: string;

      if (isIssue) {
        // ---- ISSUE: create or increment holding ----
        if (holding) {
          const newTotal = holding.numberOfShares + shares;
          await tx.update(shareHoldings)
            .set({ numberOfShares: newTotal, totalValue: String(newTotal * faceValue), updatedAt: new Date() })
            .where(and(eq(shareHoldings.id, holding.id), eq(shareHoldings.organizationId, organizationId)));
          holdingId = holding.id;
        } else {
          const created = await tx.insert(shareHoldings).values({
            organizationId,
            shareTypeId,
            memberId,
            memberName,
            memberNo,
            numberOfShares: shares,
            faceValuePerShare: String(faceValue),
            totalValue: String(shares * faceValue),
            issuedDateBs: dateBs,
            status: 'Active',
            branchId: resolvedBranchId ?? null,
            shareSchemeId: schemeId,
            openedVia,
          }).returning();
          holdingId = created[0].id;
        }
      } else {
        // ---- RETURN: validate balance, then decrement or close ----
        if (!holding) throw new Error('Member has no active share holding of this type to return');
        const currentBalance = holding.numberOfShares;
        if (shares > currentBalance) {
          throw new Error(`Cannot return ${shares} shares — member's current balance is only ${currentBalance} shares`);
        }
        const remaining = currentBalance - shares;
        if (remaining === 0) {
          await tx.update(shareHoldings)
            .set({ status: 'Surrendered', numberOfShares: 0, totalValue: '0', updatedAt: new Date() })
            .where(and(eq(shareHoldings.id, holding.id), eq(shareHoldings.organizationId, organizationId)));
        } else {
          await tx.update(shareHoldings)
            .set({ numberOfShares: remaining, totalValue: String(remaining * faceValue), updatedAt: new Date() })
            .where(and(eq(shareHoldings.id, holding.id), eq(shareHoldings.organizationId, organizationId)));
        }
        holdingId = holding.id;
      }

      // 1b. Master share account + org-wide kitta range (issue only)
      let shareAccountId: string | null = null;
      let accountNo: string | null = null;
      let wasAutoProvisioned = false;
      let kittaStart: number | null = null;
      let kittaEnd: number | null = null;

      if (isIssue) {
        const { account, created } = await this.findOrCreateShareAccount(organizationId, memberId, memberNo, tx);
        shareAccountId = account?.id ?? null;
        accountNo = account?.accountNo ?? null;
        wasAutoProvisioned = provisionShareAccount && created;
        const manualStart = typeKittaRow.auto_sequence === false ? manualStartKitta : null;
        const manualEnd = typeKittaRow.auto_sequence === false ? manualEndKitta : null;
        const range = await this.applyKittaAllocation(
          organizationId, shareTypeId, shares, typeKittaRow, manualStart, manualEnd, tx,
        );
        kittaStart = range?.startKittaNo ?? null;
        kittaEnd = range?.endKittaNo ?? null;
        await this.updateShareAccountTotals(organizationId, memberId, shares, totalAmount, tx);
        // Nominee register commits in the same transaction as the account + issue.
        if (shareAccountId && nominees?.length) {
          await this.insertShareAccountNominees(tx, organizationId, shareAccountId, nominees);
        }
      } else {
        const { account } = await this.findOrCreateShareAccount(organizationId, memberId, memberNo, tx);
        shareAccountId = account?.id ?? null;
        accountNo = account?.accountNo ?? null;
        await this.updateShareAccountTotals(organizationId, memberId, -shares, -totalAmount, tx);
      }

      // 2. Share transactions row
      await tx.insert(shareTransactions).values({
        organizationId, holdingId, memberId, shareTypeId,
        transactionType: isIssue ? 'Issue' : 'Surrender',
        numberOfShares: shares, amountPerShare: String(faceValue), totalAmount: String(totalAmount),
        voucherNo, dateBs, dateAd,
        remarks: remarks ?? (isIssue ? null : `Share return by ${memberName}`),
        processedBy,
        branchId: resolvedBranchId ?? null,
        shareSchemeId: schemeId,
      });

      // 3. GL Journal voucher (Dr Cash / Cr Share Capital — issue; reverse for return)
      const shareCapitalAccount = await this.findOrCreateShareCapitalAccount(organizationId, resolvedBranchId, tx);
      const paymentAccount = paymentAccountId
        ? await this.getChartAccountById(organizationId, paymentAccountId, tx)
        : await this.findOrCreateCashAccount(organizationId, resolvedBranchId, tx);
      if (!paymentAccount) throw new Error('Payment account not found');
      const fiscalYearId = await this.getCurrentFiscalYearId(organizationId, tx);
      const voucher = await tx.insert(vouchers).values({
        organizationId,
        voucherNo,
        voucherType: 'Journal',
        dateBs,
        dateAd,
        branchId: resolvedBranchId!,
        fiscalYearId: fiscalYearId ?? null,
        fiscalYearCode: this.resolveFiscalYearCode(),
        preparedBy: processedBy,
        approvedBy: processedBy,
        status: 'Posted',
        totalAmount: String(totalAmount),
        narration: narration
          ?? (isIssue
            ? `Share issue ${voucherNo}: ${memberName} (${memberNo}) ${shares} × रु.${faceValue}`
            : `Share return ${voucherNo}: ${memberName} (${memberNo}) ${shares} × रु.${faceValue}`),
        moduleReference: openedVia === 'auto'
          ? `SHARE_AUTOOPEN:${voucherNo}`
          : `SHARE_${isIssue ? 'ISSUE' : 'RETURN'}:${voucherNo}`,
      }).returning();

      await tx.insert(voucherEntries).values(isIssue
        ? [
            {
              organizationId, voucherId: voucher[0].id, accountId: paymentAccount.id,
              accountCode: paymentAccount.code, accountName: paymentAccount.name,
              debit: String(totalAmount), credit: '0',
              narration: `Share issue proceeds — ${memberName} (${memberNo})`,
            },
            {
              organizationId, voucherId: voucher[0].id, accountId: shareCapitalAccount.id,
              accountCode: shareCapitalAccount.code, accountName: shareCapitalAccount.name,
              debit: '0', credit: String(totalAmount),
              narration: `Share capital issued — ${memberName} (${memberNo})`,
            },
          ]
        : [
            {
              organizationId, voucherId: voucher[0].id, accountId: shareCapitalAccount.id,
              accountCode: shareCapitalAccount.code, accountName: shareCapitalAccount.name,
              debit: String(totalAmount), credit: '0',
              narration: `Share capital returned — ${memberName} (${memberNo})`,
            },
            {
              organizationId, voucherId: voucher[0].id, accountId: paymentAccount.id,
              accountCode: paymentAccount.code, accountName: paymentAccount.name,
              debit: '0', credit: String(totalAmount),
              narration: `Share return refund — ${memberName} (${memberNo})`,
            },
          ]);

      // 4. Subsidiary shares book row
      const prevBalance = await this.getLastSubsidiaryBalance(organizationId, memberId, tx);
      const newBalance = isIssue ? prevBalance + totalAmount : Math.max(0, prevBalance - totalAmount);
      await tx.insert(subsidiarySharesBook).values({
        organizationId, memberId, voucherNo,
        transactionDateBs: dateBs,
        transactionType: isIssue ? 'Purchase' : 'Return',
        shareQuantity: isIssue ? shares : -shares,
        faceValue: String(faceValue),
        debitAmount: isIssue ? '0' : String(totalAmount),
        creditAmount: isIssue ? String(totalAmount) : '0',
        balanceAmount: String(newBalance),
        startKittaNo: kittaStart,
        endKittaNo: kittaEnd,
        shareTypeId,
        shareAccountId,
      });

      // 5. Certificate (issue only)
      let certificateNoOut: string | null = null;
      if (isIssue && certificateNo) {
        await tx.insert(shareCertificates).values({
          organizationId,
          certificateNo,
          holdingId,
          memberId,
          shareTypeId,
          numberOfShares: shares,
          issuedDateBs: dateBs,
          status: 'Active',
        });
        certificateNoOut = certificateNo;
      }

      // 6. Sync member financial profile
      await this.syncMemberFinancialTx(tx, organizationId, memberId);

      // 6b. Org-wide running totals (ISSUE +, RETURN -) — serialized by the
      // organization_share_settings row lock acquired at the top of this tx.
      await this.updateOrgShareSettingsTotals(
        organizationId,
        isIssue ? { kitta: shares, capital: totalAmount } : { kitta: -shares, capital: -totalAmount },
        tx,
      );

      return {
        holdingId,
        voucherId: voucher[0].id,
        voucherNo,
        certificateNo: certificateNoOut,
        totalAmount,
        shareAccountId,
        accountNo,
        wasAutoProvisioned,
        kittaStart,
        kittaEnd,
        currentBalanceAfter: isIssue ? (holding ? holding.numberOfShares + shares : shares) : (holding ? holding.numberOfShares - shares : 0),
      };
    });
  }

  /**
   * Atomically executes a share transfer inside a single DB transaction:
   * holdings +/- , share_transactions (In/Out), share_transfers registry,
   * Journal voucher (Dr from-member / Cr to-member on Share Capital),
   * subsidiary shares book rows for both members, certificate for target,
   * and member financial profile sync.
   */
  async executeTransfer(
    organizationId: string,
    payload: {
      fromHoldingId: string;
      fromMemberId: string;
      fromMemberName: string;
      fromMemberNo: string;
      toMemberId: string;
      toMemberName: string;
      toMemberNo: string;
      toMemberBranchId: string | null;
      shareTypeId: string;
      shareTypeName: string;
      faceValue: number;
      shares: number;
      totalAmount: number;
      transferNo: string;
      voucherNo: string;
      certificateNo: string;
      dateBs: string;
      dateAd: string;
      remarks: string | null;
      processedBy: string;
      branchId: string | null;
      sourceHoldingBranchId: string | null;
      closeSource: boolean;
      sourceRemaining: number;
      targetExistingHoldingId: string | null;
      targetNewShares: number;
    },
  ) {
    const db = this.db;
    return db.transaction(async (tx) => {
      const {
        fromHoldingId, fromMemberId, fromMemberName, fromMemberNo,
        toMemberId, toMemberName, toMemberNo, toMemberBranchId,
        shareTypeId, shareTypeName, faceValue, shares, totalAmount,
        transferNo, voucherNo, certificateNo, dateBs, dateAd,
        remarks, processedBy, branchId, sourceHoldingBranchId,
        closeSource, sourceRemaining, targetExistingHoldingId, targetNewShares,
      } = payload;

      // Fixed lock order: organization_share_settings -> share_types (same as
      // the issue path). A transfer leaves the org-wide totals unchanged, but
      // acquiring the same locks in the same order prevents deadlock with
      // concurrent issuances.
      await this.lockOrgShareSettings(organizationId, tx);
      const typeKittaRow = await this.lockShareTypeForUpdate(organizationId, shareTypeId, tx);
      if (!typeKittaRow) throw new Error('Share type not found');

      // 1. Source holding: reduce or close
      if (closeSource) {
        await tx.update(shareHoldings)
          .set({ status: 'Transferred', numberOfShares: 0, totalValue: '0', updatedAt: new Date() })
          .where(and(eq(shareHoldings.id, fromHoldingId), eq(shareHoldings.organizationId, organizationId)));
      } else {
        await tx.update(shareHoldings)
          .set({ numberOfShares: sourceRemaining, totalValue: String(sourceRemaining * faceValue), updatedAt: new Date() })
          .where(and(eq(shareHoldings.id, fromHoldingId), eq(shareHoldings.organizationId, organizationId)));
      }

      // 2. Target holding: increment or create
      let toHoldingId: string;
      if (targetExistingHoldingId) {
        toHoldingId = targetExistingHoldingId;
        await tx.update(shareHoldings)
          .set({ numberOfShares: targetNewShares, totalValue: String(targetNewShares * faceValue), updatedAt: new Date() })
          .where(and(eq(shareHoldings.id, toHoldingId), eq(shareHoldings.organizationId, organizationId)));
      } else {
        const created = await tx.insert(shareHoldings).values({
          organizationId,
          shareTypeId,
          memberId: toMemberId,
          memberName: toMemberName,
          memberNo: toMemberNo,
          numberOfShares: shares,
          faceValuePerShare: String(faceValue),
          totalValue: String(shares * faceValue),
          issuedDateBs: dateBs,
          status: 'Active',
          branchId: branchId ?? toMemberBranchId ?? null,
        }).returning();
        toHoldingId = created[0].id;
      }

      // 3. Master share accounts (register stays consistent with holdings)
      const fromAccount = await this.findOrCreateShareAccount(organizationId, fromMemberId, fromMemberNo, tx);
      await this.updateShareAccountTotals(organizationId, fromMemberId, -shares, -totalAmount, tx);
      const toAccount = await this.findOrCreateShareAccount(organizationId, toMemberId, toMemberNo, tx);
      await this.updateShareAccountTotals(organizationId, toMemberId, shares, totalAmount, tx);

      // 4. Share transactions (Transfer_Out / Transfer_In)
      await tx.insert(shareTransactions).values({
        organizationId, holdingId: fromHoldingId, memberId: fromMemberId,
        shareTypeId, transactionType: 'Transfer_Out', numberOfShares: shares,
        amountPerShare: String(faceValue), totalAmount: String(totalAmount),
        voucherNo, dateBs, dateAd,
        remarks: remarks ?? `Transferred to ${toMemberName}`,
        processedBy, branchId: branchId ?? sourceHoldingBranchId ?? null,
      });
      await tx.insert(shareTransactions).values({
        organizationId, holdingId: toHoldingId, memberId: toMemberId,
        shareTypeId, transactionType: 'Transfer_In', numberOfShares: shares,
        amountPerShare: String(faceValue), totalAmount: String(totalAmount),
        voucherNo, dateBs, dateAd,
        remarks: remarks ?? `Transferred from ${fromMemberName}`,
        processedBy, branchId: branchId ?? toMemberBranchId ?? null,
      });

      // 4. Journal voucher (Dr Share Capital — from member / Cr — to member)
      const shareCapitalAccount = await this.findOrCreateShareCapitalAccount(organizationId, branchId, tx);
      const fiscalYearId = await this.getCurrentFiscalYearId(organizationId, tx);
      const voucher = await tx.insert(vouchers).values({
        organizationId,
        voucherNo,
        voucherType: 'Journal',
        dateBs,
        dateAd,
        branchId: branchId ?? sourceHoldingBranchId ?? toMemberBranchId ?? null,
        fiscalYearId: fiscalYearId ?? null,
        fiscalYearCode: this.resolveFiscalYearCode(),
        preparedBy: processedBy,
        approvedBy: processedBy,
        status: 'Posted',
        totalAmount: String(totalAmount),
        narration: `Share transfer ${transferNo}: ${fromMemberName} → ${toMemberName} (${shares} shares × रु.${faceValue})`,
        moduleReference: `SHARE_TRANSFER:${transferNo}`,
      }).returning();

      await tx.insert(voucherEntries).values([
        {
          organizationId,
          voucherId: voucher[0].id,
          accountId: shareCapitalAccount.id,
          accountCode: shareCapitalAccount.code,
          accountName: shareCapitalAccount.name,
          debit: String(totalAmount),
          credit: '0',
          narration: `Share Capital transfer out — ${fromMemberName} (${fromMemberNo})`,
        },
        {
          organizationId,
          voucherId: voucher[0].id,
          accountId: shareCapitalAccount.id,
          accountCode: shareCapitalAccount.code,
          accountName: shareCapitalAccount.name,
          debit: '0',
          credit: String(totalAmount),
          narration: `Share Capital transfer in — ${toMemberName} (${toMemberNo})`,
        },
      ]);

      // 5. Registry row
      const registry = await tx.insert(shareTransfers).values({
        organizationId,
        transferNo,
        voucherId: voucher[0].id,
        voucherNo,
        certificateNo,
        fromHoldingId,
        fromMemberId,
        fromMemberName,
        fromMemberNo,
        toHoldingId,
        toMemberId,
        toMemberName,
        toMemberNo,
        shareTypeId,
        shareTypeName,
        faceValuePerShare: String(faceValue),
        numberOfShares: shares,
        totalAmount: String(totalAmount),
        dateBs,
        dateAd,
        status: 'Completed',
        remarks: remarks ?? null,
        processedBy,
        branchId: branchId ?? sourceHoldingBranchId ?? toMemberBranchId ?? null,
      }).returning();

      // 6. Subsidiary shares book rows (both members)
      const fromBalance = await this.getLastSubsidiaryBalance(organizationId, fromMemberId, tx);
      const toBalance = await this.getLastSubsidiaryBalance(organizationId, toMemberId, tx);
      await tx.insert(subsidiarySharesBook).values([
        {
          organizationId, memberId: fromMemberId, voucherNo,
          transactionDateBs: dateBs, transactionType: 'Transfer_Out',
          shareQuantity: -shares, faceValue: String(faceValue),
          debitAmount: String(totalAmount), creditAmount: '0',
          balanceAmount: String(Math.max(0, fromBalance - totalAmount)),
          shareTypeId,
          shareAccountId: fromAccount?.account?.id ?? null,
        },
        {
          organizationId, memberId: toMemberId, voucherNo,
          transactionDateBs: dateBs, transactionType: 'Transfer_In',
          shareQuantity: shares, faceValue: String(faceValue),
          debitAmount: '0', creditAmount: String(totalAmount),
          balanceAmount: String(toBalance + totalAmount),
          shareTypeId,
          shareAccountId: toAccount?.account?.id ?? null,
        },
      ]);

      // 7. Certificate for target
      await tx.insert(shareCertificates).values({
        organizationId,
        certificateNo,
        holdingId: toHoldingId,
        memberId: toMemberId,
        shareTypeId,
        numberOfShares: shares,
        issuedDateBs: dateBs,
        status: 'Active',
      });

      // 8. Sync member financial profiles
      await this.syncMemberFinancialTx(tx, organizationId, fromMemberId);
      await this.syncMemberFinancialTx(tx, organizationId, toMemberId);

      return {
        transferId: registry[0].id,
        transferNo,
        voucherId: voucher[0].id,
        voucherNo,
        toHoldingId,
        certificateNo,
      };
    });
  }

  private resolveFiscalYearCode(): string {
    return getCurrentFiscalYearCode();
  }

  private async syncMemberFinancialTx(tx: any, organizationId: string, memberId: string) {
    const rows: any = await tx.select().from(shareHoldings)
      .where(and(eq(shareHoldings.organizationId, organizationId), eq(shareHoldings.memberId, memberId), eq(shareHoldings.status, 'Active')));
    const totalShares = rows.reduce((s: number, h: any) => s + Number(h.numberOfShares || 0), 0);
    const totalValue = rows.reduce((s: number, h: any) => s + Number(h.totalValue || 0), 0);
    await tx.insert(memberFinancialProfiles)
      .values({ memberId, organizationId, totalShares, shareAmount: String(totalValue) })
      .onConflictDoUpdate({
        target: memberFinancialProfiles.memberId,
        set: { totalShares, shareAmount: String(totalValue), updatedAt: new Date() },
      });
  }

  async listShareTransfers(organizationId: string, filter: { limit?: number } = {}) {
    const rows = await this.db.select()
      .from(shareTransfers)
      .where(eq(shareTransfers.organizationId, organizationId))
      .orderBy(desc(shareTransfers.createdAt))
      .limit(filter.limit ?? 100);
    return rows.map(r => ({
      ...r,
      faceValuePerShare: toNumber(r.faceValuePerShare),
      totalAmount: toNumber(r.totalAmount),
    }));
  }

  async getShareTransferById(organizationId: string, id: string) {
    const [row] = await this.db.select().from(shareTransfers)
      .where(and(eq(shareTransfers.id, id), eq(shareTransfers.organizationId, organizationId)))
      .limit(1);
    if (!row) return null;
    return {
      ...row,
      faceValuePerShare: toNumber(row.faceValuePerShare),
      totalAmount: toNumber(row.totalAmount),
    };
  }

  /** Org header info used on printed voucher/certificate. */
  async getOrganizationHeader(organizationId: string) {
    const rows: any = await this.db.execute(sql`
      SELECT
        o.organization_name AS "organizationName",
        o.short_name AS "shortName",
        o.organization_type AS "organizationType",
        o.province AS "province",
        o.district AS "district",
        o.municipality AS "municipality",
        o.ward_no AS "wardNo",
        o.address AS "address",
        o.phone AS "phone",
        o.mobile AS "mobile",
        o.email AS "email",
        o.govt_reg_no AS "govtRegNo",
        p.registration_no AS "registrationNo",
        p.registration_date AS "registrationDate",
        p.logo_url AS "logoUrl",
        p.pan AS "pan"
      FROM organizations o
      LEFT JOIN organization_profiles p ON p.organization_id = o.id
      WHERE o.id = ${organizationId}
      LIMIT 1
    `);
    return rows?.[0] ?? null;
  }

  /** Voucher entries for a voucher (used to build printable vouchers). */
  async getVoucherEntries(organizationId: string, voucherId: string) {
    return this.db.select()
      .from(voucherEntries)
      .where(and(eq(voucherEntries.organizationId, organizationId), eq(voucherEntries.voucherId, voucherId)));
  }

  /** Full transfer detail with voucher entries for the print view. */
  async getShareTransferDetail(organizationId: string, id: string) {
    const transfer = await this.getShareTransferById(organizationId, id);
    if (!transfer) return null;

    const [entries, org] = await Promise.all([
      transfer.voucherId
        ? this.db.select().from(voucherEntries)
            .where(and(eq(voucherEntries.organizationId, organizationId), eq(voucherEntries.voucherId, transfer.voucherId)))
        : Promise.resolve([] as any[]),
      this.getOrganizationHeader(organizationId),
    ]);

    return { ...transfer, entries, organization: org };
  }

  // ============================================================
  // DASHBOARD SUMMARY
  // ============================================================
  async getSummary(organizationId: string, dividendRate: number): Promise<any> {
    const holdingsAgg: any = await this.db.execute(sql`
      SELECT
        count(*) AS holdings,
        count(DISTINCT member_id) AS members_with_shares,
        COALESCE(SUM(number_of_shares), 0) AS total_shares,
        COALESCE(SUM(total_value), 0) AS total_capital
      FROM share_holdings
      WHERE organization_id = ${organizationId} AND status = 'Active'
    `);
    const certAgg: any = await this.db.execute(sql`
      SELECT count(*) AS c FROM share_certificates WHERE organization_id = ${organizationId} AND status = 'Active'
    `);
    const typeAgg: any = await this.db.execute(sql`
      SELECT count(*) AS c FROM share_types WHERE organization_id = ${organizationId} AND status = 'Active'
    `);

    const totalShares = Number((holdingsAgg?.[0] as any)?.total_shares ?? 0);
    const totalCapital = Number((holdingsAgg?.[0] as any)?.total_capital ?? 0);

    return {
      totalShareCapital: totalCapital,
      totalSharesCount: totalShares,
      totalMembersWithShares: Number((holdingsAgg?.[0] as any)?.members_with_shares ?? 0),
      totalHoldings: Number((holdingsAgg?.[0] as any)?.holdings ?? 0),
      totalCertificatesIssued: Number((certAgg?.[0] as any)?.c ?? 0),
      shareTypesCount: Number((typeAgg?.[0] as any)?.c ?? 0),
      dividendRate,
      proposedDividend: Math.round((totalCapital * dividendRate) / 100),
    };
  }

  // ============================================================
  // MEMBER FINANCIAL PROFILE sync (keeps members.totalShares in sync)
  // ============================================================
  async getMemberFinancial(memberId: string) {
    const [row] = await this.db.select().from(memberFinancialProfiles)
      .where(eq(memberFinancialProfiles.memberId, memberId))
      .limit(1);
    return row ?? null;
  }

  async upsertMemberFinancial(memberId: string, organizationId: string, totalShares: number, shareAmount: number) {
    await this.db.insert(memberFinancialProfiles)
      .values({
        memberId,
        organizationId,
        totalShares,
        shareAmount: String(shareAmount),
      })
      .onConflictDoUpdate({
        target: memberFinancialProfiles.memberId,
        set: {
          totalShares,
          shareAmount: String(shareAmount),
          updatedAt: new Date(),
        },
      });
  }
}
