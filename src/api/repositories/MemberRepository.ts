/**
 * Member Repository
 * Data access layer for members + segmented 1:1 child tables:
 *   members, memberKycProfiles, memberFinancialProfiles, memberFamily,
 *   memberPortalSettings, memberBiometrics, memberDocuments.
 * All reads return a flattened row so the API contract stays unchanged.
 */
import { eq, and, or, desc, asc, count, SQL, ilike, inArray, ne, sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  members, memberKycProfiles, memberFinancialProfiles, memberFamily,
  memberPortalSettings, memberBiometrics, memberDocuments, branches,
  memberTypes, memberCategories, occupations, educationLevels,
  nomineeTypes, relationshipTypes, groups,
  savingsAccounts, loanAccounts,
} from '../../db/schema';

export interface MemberFilter {
  organizationId?: string;
  search?: string;
  branchId?: string;
  /**
   * Branch ids the caller may operate within (strict branch scope).
   * `undefined` = org-level scope (org admins); `[]` = no branch access.
   */
  branchIds?: string[];
  kycStatus?: string;
  status?: string;
  membershipType?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Vertical split field groups. Wide member columns live on 1:1 child tables:
 *   KYC        -> identity docs, addresses, economic profile
 *   FINANCIAL  -> balances, accruals, collection mapping
 *   FAMILY     -> household & nominee structure
 *   PORTAL     -> portal / settlement integration
 *   BIOMETRIC  -> template URL references
 */
const KYC_FIELDS = [
  'citizenshipNo', 'citizenshipIssueDistrict', 'citizenshipIssueDateBs',
  'photoUrl', 'signatureUrl', 'citizenshipFrontUrl', 'citizenshipBackUrl',
  'address', 'district',
  'permProvince', 'permDistrict', 'permMunicipality', 'permWard', 'permTole',
  'tempProvince', 'tempDistrict', 'tempMunicipality', 'tempWard', 'tempTole',
  'occupationId', 'educationLevelId', 'employerName', 'annualIncome', 'sourceOfFunds', 'isPep', 'pepDetails', 'ethicsAccepted',
] as const;
const FINANCIAL_FIELDS = [
  'totalShares', 'shareAmount', 'totalSavingsBalance', 'totalLoanBalance',
  'fixedDepositBalance', 'recurringDepositBalance',
  'overdueAmount', 'interestReceivable', 'interestPayable', 'nplStatus',
  'collectionAgentId', 'preferredCollectionDay', 'collectionRoute',
] as const;
const FAMILY_FIELDS = [
  'familyId', 'isFamilyHead', 'maritalStatus', 'bloodGroup',
  'fatherName', 'fatherNameNepali', 'motherName', 'motherNameNepali',
  'grandfatherName', 'grandfatherNameNepali', 'spouseName', 'spouseNameNepali',
  'guardianName', 'guardianNameNepali', 'guardianRelation', 'guardianCitizenshipNo', 'guardianPhone', 'dependentsCount',
  'nomineeName', 'nomineeNameNepali', 'nomineeRelationId', 'nomineeTypeId', 'nomineePhone', 'nomineeCitizenshipNo', 'nomineeSharePct',
] as const;
const PORTAL_FIELDS = [
  'portalEnabled', 'emailVerified', 'mobileVerified', 'lastLogin',
  'bankName', 'bankAccount', 'walletIdEsewa', 'walletIdKhalti', 'walletIdFonepay',
] as const;
const BIOMETRIC_FIELDS = ['fingerprintTemplateUrl', 'faceTemplateUrl', 'irisTemplateUrl'] as const;

/** Map API-style camelCase keys (frontend Member shape) to the drizzle column names. */
const MEMBER_KEY_ALIASES: Record<string, string> = {
  dobBS: 'dobBs',
  dobAD: 'dobAd',
  membershipDateBS: 'membershipDateBs',
  citizenshipIssueDateBS: 'citizenshipIssueDateBs',
  isPEP: 'isPep',
};

function normalizeMemberPayload(data: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    out[MEMBER_KEY_ALIASES[k] ?? k] = v;
  }
  return out;
}

/** Route a flat camelCase member payload to its owning table. */
function splitMemberPayload(data: Record<string, any>): {
  main: Record<string, any>;
  kyc: Record<string, any>;
  financial: Record<string, any>;
  family: Record<string, any>;
  portal: Record<string, any>;
  biometric: Record<string, any>;
} {
  const main: Record<string, any> = {};
  const kyc: Record<string, any> = {};
  const financial: Record<string, any> = {};
  const family: Record<string, any> = {};
  const portal: Record<string, any> = {};
  const biometric: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if ((KYC_FIELDS as readonly string[]).includes(k)) kyc[k] = v;
    else if ((FINANCIAL_FIELDS as readonly string[]).includes(k)) financial[k] = v;
    else if ((FAMILY_FIELDS as readonly string[]).includes(k)) family[k] = v;
    else if ((PORTAL_FIELDS as readonly string[]).includes(k)) portal[k] = v;
    else if ((BIOMETRIC_FIELDS as readonly string[]).includes(k)) biometric[k] = v;
    else main[k] = v;
  }
  return { main, kyc, financial, family, portal, biometric };
}

/** Shared flattened select across all member reads (children left-joined). */
const memberFlatSelect = {
  // members (slim identity ledger)
  id: members.id,
  organizationId: members.organizationId,
  branchId: members.branchId,
  memberNo: members.memberNo,
  fullName: members.fullName,
  searchName: members.searchName,
  nameNepali: members.nameNepali,
  gender: members.gender,
  dobBs: members.dobBs,
  dobAd: members.dobAd,
  phone: members.phone,
  secondaryPhone: members.secondaryPhone,
  email: members.email,
  membershipDateBs: members.membershipDateBs,
  memberTypeId: members.memberTypeId,
  membershipType: memberTypes.name,
  memberTypeMinShareUnits: memberTypes.minShareUnits,
  memberTypeEntranceFee: memberTypes.entranceFee,
  memberTypeShareValuePerUnit: memberTypes.shareValuePerUnit,
  isGroupType: memberTypes.isGroupType,
  memberCategoryId: members.memberCategoryId,
  memberCategory: memberCategories.name,
  groupId: members.groupId,
  groupName: groups.name,
  memberTags: members.memberTags,
  kycStatus: members.kycStatus,
  status: members.status,
  isMinor: members.isMinor,
  createdBy: members.createdBy,
  createdAt: members.createdAt,
  updatedBy: members.updatedBy,
  updatedAt: members.updatedAt,
  submittedBy: members.submittedBy,
  verifiedBy: members.verifiedBy,
  approvedBy: members.approvedBy,
  approvedAt: members.approvedAt,
  rejectedBy: members.rejectedBy,
  rejectedReason: members.rejectedReason,
  deletedAt: members.deletedAt,
  deletedBy: members.deletedBy,
  // KYC
  citizenshipNo: memberKycProfiles.citizenshipNo,
  citizenshipIssueDistrict: memberKycProfiles.citizenshipIssueDistrict,
  citizenshipIssueDateBs: memberKycProfiles.citizenshipIssueDateBs,
  photoUrl: memberKycProfiles.photoUrl,
  signatureUrl: memberKycProfiles.signatureUrl,
  citizenshipFrontUrl: memberKycProfiles.citizenshipFrontUrl,
  citizenshipBackUrl: memberKycProfiles.citizenshipBackUrl,
  address: memberKycProfiles.address,
  district: memberKycProfiles.district,
  permProvince: memberKycProfiles.permProvince,
  permDistrict: memberKycProfiles.permDistrict,
  permMunicipality: memberKycProfiles.permMunicipality,
  permWard: memberKycProfiles.permWard,
  permTole: memberKycProfiles.permTole,
  tempProvince: memberKycProfiles.tempProvince,
  tempDistrict: memberKycProfiles.tempDistrict,
  tempMunicipality: memberKycProfiles.tempMunicipality,
  tempWard: memberKycProfiles.tempWard,
  tempTole: memberKycProfiles.tempTole,
  occupationId: memberKycProfiles.occupationId,
  occupation: occupations.name,
  educationLevelId: memberKycProfiles.educationLevelId,
  educationLevel: educationLevels.name,
  employerName: memberKycProfiles.employerName,
  annualIncome: memberKycProfiles.annualIncome,
  sourceOfFunds: memberKycProfiles.sourceOfFunds,
  isPep: memberKycProfiles.isPep,
  pepDetails: memberKycProfiles.pepDetails,
  ethicsAccepted: memberKycProfiles.ethicsAccepted,
  // Financial
  totalShares: memberFinancialProfiles.totalShares,
  shareAmount: memberFinancialProfiles.shareAmount,
  // Live aggregation of Active account balances (never the stale static columns).
  totalSavingsBalance: sql<string>`COALESCE((
    SELECT SUM(${savingsAccounts.balance})
    FROM ${savingsAccounts}
    WHERE ${savingsAccounts.memberId} = ${members.id}
      AND ${savingsAccounts.organizationId} = ${members.organizationId}
      AND ${savingsAccounts.status} = 'Active'
  ), 0)`,
  totalLoanBalance: sql<string>`COALESCE((
    SELECT SUM(${loanAccounts.outstandingPrincipal})
    FROM ${loanAccounts}
    WHERE ${loanAccounts.memberId} = ${members.id}
      AND ${loanAccounts.organizationId} = ${members.organizationId}
      AND ${loanAccounts.status} = 'Disbursed'
  ), 0)`,
  fixedDepositBalance: memberFinancialProfiles.fixedDepositBalance,
  recurringDepositBalance: memberFinancialProfiles.recurringDepositBalance,
  overdueAmount: memberFinancialProfiles.overdueAmount,
  interestReceivable: memberFinancialProfiles.interestReceivable,
  interestPayable: memberFinancialProfiles.interestPayable,
  nplStatus: memberFinancialProfiles.nplStatus,
  collectionAgentId: memberFinancialProfiles.collectionAgentId,
  preferredCollectionDay: memberFinancialProfiles.preferredCollectionDay,
  collectionRoute: memberFinancialProfiles.collectionRoute,
  // Family
  familyId: memberFamily.familyId,
  isFamilyHead: memberFamily.isFamilyHead,
  maritalStatus: memberFamily.maritalStatus,
  bloodGroup: memberFamily.bloodGroup,
  fatherName: memberFamily.fatherName,
  fatherNameNepali: memberFamily.fatherNameNepali,
  motherName: memberFamily.motherName,
  motherNameNepali: memberFamily.motherNameNepali,
  grandfatherName: memberFamily.grandfatherName,
  grandfatherNameNepali: memberFamily.grandfatherNameNepali,
  spouseName: memberFamily.spouseName,
  spouseNameNepali: memberFamily.spouseNameNepali,
  guardianName: memberFamily.guardianName,
  guardianNameNepali: memberFamily.guardianNameNepali,
  guardianRelation: memberFamily.guardianRelation,
  guardianCitizenshipNo: memberFamily.guardianCitizenshipNo,
  guardianPhone: memberFamily.guardianPhone,
  dependentsCount: memberFamily.dependentsCount,
  nomineeName: memberFamily.nomineeName,
  nomineeNameNepali: memberFamily.nomineeNameNepali,
  nomineeRelationId: memberFamily.nomineeRelationId,
  nomineeRelation: relationshipTypes.name,
  nomineeTypeId: memberFamily.nomineeTypeId,
  nomineeType: nomineeTypes.name,
  nomineePhone: memberFamily.nomineePhone,
  nomineeCitizenshipNo: memberFamily.nomineeCitizenshipNo,
  nomineeSharePct: memberFamily.nomineeSharePct,
  // Portal
  portalEnabled: memberPortalSettings.portalEnabled,
  emailVerified: memberPortalSettings.emailVerified,
  mobileVerified: memberPortalSettings.mobileVerified,
  lastLogin: memberPortalSettings.lastLogin,
  bankName: memberPortalSettings.bankName,
  bankAccount: memberPortalSettings.bankAccount,
  walletIdEsewa: memberPortalSettings.walletIdEsewa,
  walletIdKhalti: memberPortalSettings.walletIdKhalti,
  walletIdFonepay: memberPortalSettings.walletIdFonepay,
  // Biometrics
  fingerprintTemplateUrl: memberBiometrics.fingerprintTemplateUrl,
  faceTemplateUrl: memberBiometrics.faceTemplateUrl,
  irisTemplateUrl: memberBiometrics.irisTemplateUrl,
};

/** Flattened member row (all child tables left-joined). */
type FlatMemberRow = Record<string, any>;

function flatMemberBase(db: ReturnType<typeof getDb>) {
  return db.select(memberFlatSelect)
    .from(members)
    .leftJoin(memberKycProfiles, eq(memberKycProfiles.memberId, members.id))
    .leftJoin(memberFinancialProfiles, eq(memberFinancialProfiles.memberId, members.id))
    .leftJoin(memberFamily, eq(memberFamily.memberId, members.id))
    .leftJoin(memberPortalSettings, eq(memberPortalSettings.memberId, members.id))
    .leftJoin(memberBiometrics, eq(memberBiometrics.memberId, members.id))
    .leftJoin(memberTypes, eq(memberTypes.id, members.memberTypeId))
    .leftJoin(memberCategories, eq(memberCategories.id, members.memberCategoryId))
    .leftJoin(groups, eq(groups.id, members.groupId))
    .leftJoin(occupations, eq(occupations.id, memberKycProfiles.occupationId))
    .leftJoin(educationLevels, eq(educationLevels.id, memberKycProfiles.educationLevelId))
    .leftJoin(relationshipTypes, eq(relationshipTypes.id, memberFamily.nomineeRelationId))
    .leftJoin(nomineeTypes, eq(nomineeTypes.id, memberFamily.nomineeTypeId));
}

export class MemberRepository {
  private get db() {
    const db = getDb();
    if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
    return db;
  }

  async findAll(filter: MemberFilter = {}): Promise<PaginatedResult<FlatMemberRow>> {
    const {
      organizationId, search, branchId, branchIds, kycStatus, status, membershipType,
      page = 1, limit = 50,
      sortBy = 'memberNo', sortDir = 'asc'
    } = filter;

    const conditions: SQL[] = [];
    if (organizationId) conditions.push(eq(members.organizationId, organizationId));
    if (search) {
      conditions.push(
        or(
          ilike(members.searchName, `%${search.toLowerCase()}%`),
          ilike(members.memberNo, `%${search}%`),
          ilike(members.phone, `%${search}%`),
          ilike(memberKycProfiles.citizenshipNo, `%${search}%`)
        )!
      );
    }
    if (branchId) conditions.push(eq(members.branchId, branchId));
    if (branchIds !== undefined) conditions.push(inArray(members.branchId, branchIds));
    if (kycStatus) conditions.push(eq(members.kycStatus, kycStatus as any));
    if (status) conditions.push(eq(members.status, status as any));
    if (membershipType) conditions.push(ilike(memberTypes.name, membershipType));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const orderColumn = sortBy === 'fullName' ? members.fullName
      : sortBy === 'createdAt' ? members.createdAt
      : members.memberNo;
    const orderFn = sortDir === 'desc' ? desc(orderColumn) : asc(orderColumn);

    const [data, totalResult] = await Promise.all([
      flatMemberBase(this.db)
        .where(where)
        .orderBy(orderFn)
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ count: count() })
        .from(members)
        .leftJoin(memberKycProfiles, eq(memberKycProfiles.memberId, members.id))
        .leftJoin(memberTypes, eq(memberTypes.id, members.memberTypeId))
        .where(where)
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, organizationId?: string, branchIds?: string[]) {
    const conditions: SQL[] = [eq(members.id, id)];
    if (organizationId) conditions.push(eq(members.organizationId, organizationId));
    if (branchIds !== undefined) conditions.push(inArray(members.branchId, branchIds));
    const results = await flatMemberBase(this.db)
      .where(and(...conditions)).limit(1);
    return results[0] ?? null;
  }

  async findByMemberNo(memberNo: string, organizationId?: string, branchIds?: string[]) {
    const conditions: SQL[] = [eq(members.memberNo, memberNo)];
    if (organizationId) conditions.push(eq(members.organizationId, organizationId));
    if (branchIds !== undefined) conditions.push(inArray(members.branchId, branchIds));
    const results = await flatMemberBase(this.db)
      .where(and(...conditions)).limit(1);
    return results[0] ?? null;
  }

  async create(data: Record<string, any>) {
    const { main, kyc, financial, family, portal, biometric } = splitMemberPayload(normalizeMemberPayload(data));
    if (!main.organizationId) throw new Error('organizationId is required');
    if (!main.searchName) throw new Error('searchName is required');

    return this.db.transaction(async (tx) => {
      const [member] = await tx.insert(members).values(main as typeof members.$inferInsert).returning();
      if (Object.keys(kyc).length > 0) {
        await tx.insert(memberKycProfiles).values({
          memberId: member.id,
          organizationId: main.organizationId,
          citizenshipNo: kyc.citizenshipNo,
          ...kyc,
        });
      }
      if (Object.keys(financial).length > 0) {
        await tx.insert(memberFinancialProfiles).values({ memberId: member.id, organizationId: main.organizationId, ...financial });
      }
      if (Object.keys(family).length > 0) {
        await tx.insert(memberFamily).values({ memberId: member.id, ...family });
      }
      if (Object.keys(portal).length > 0) {
        await tx.insert(memberPortalSettings).values({ memberId: member.id, ...portal });
      }
      if (Object.keys(biometric).length > 0) {
        await tx.insert(memberBiometrics).values({ memberId: member.id, ...biometric });
      }
      return member;
    }).then(async (member) => {
      // Read back AFTER commit so the response reflects the full merged shape.
      const merged = await this.findById(member.id, member.organizationId);
      return merged ?? member;
    });
  }

  async update(id: string, data: Record<string, any>, organizationId?: string) {
    const { main, kyc, financial, family, portal, biometric } = splitMemberPayload(normalizeMemberPayload(data));

    await this.db.transaction(async (tx) => {
      const [existing] = await tx.select({ organizationId: members.organizationId })
        .from(members).where(eq(members.id, id)).limit(1);
      if (!existing) throw new Error('Member not found');
      if (organizationId && existing.organizationId !== organizationId) {
        throw new Error('Member not found');
      }
      const organizationIdToUse = organizationId || existing.organizationId;

      if (Object.keys(main).length > 0) {
        await tx.update(members)
          .set({ ...main, updatedAt: new Date() })
          .where(eq(members.id, id));
      }
      if (Object.keys(kyc).length > 0) {
        const [existingKyc] = await tx.select({ citizenshipNo: memberKycProfiles.citizenshipNo })
          .from(memberKycProfiles).where(eq(memberKycProfiles.memberId, id)).limit(1);
        const citizenshipNo = kyc.citizenshipNo ?? existingKyc?.citizenshipNo;
        await tx.insert(memberKycProfiles)
          .values({ memberId: id, organizationId: organizationIdToUse, citizenshipNo, ...kyc })
          .onConflictDoUpdate({
            target: memberKycProfiles.memberId,
            set: { ...kyc, updatedAt: new Date() },
          });
      }
      if (Object.keys(financial).length > 0) {
        await tx.insert(memberFinancialProfiles)
          .values({ memberId: id, organizationId: organizationIdToUse, ...financial })
          .onConflictDoUpdate({
            target: memberFinancialProfiles.memberId,
            set: { ...financial, updatedAt: new Date() },
          });
      }
      if (Object.keys(family).length > 0) {
        await tx.insert(memberFamily)
          .values({ memberId: id, ...family })
          .onConflictDoUpdate({
            target: memberFamily.memberId,
            set: { ...family, updatedAt: new Date() },
          });
      }
      if (Object.keys(portal).length > 0) {
        await tx.insert(memberPortalSettings)
          .values({ memberId: id, ...portal })
          .onConflictDoUpdate({
            target: memberPortalSettings.memberId,
            set: { ...portal, updatedAt: new Date() },
          });
      }
      if (Object.keys(biometric).length > 0) {
        await tx.insert(memberBiometrics)
          .values({ memberId: id, ...biometric })
          .onConflictDoUpdate({
            target: memberBiometrics.memberId,
            set: { ...biometric, updatedAt: new Date() },
          });
      }
    });

    // Read back AFTER commit so the response reflects persisted values.
    const merged = await this.findById(id);
    if (!merged) throw new Error('Member not found.');
    return merged;
  }

  async updateFinancialSummary(id: string, update: {
    totalSavingsBalance?: number;
    totalLoanBalance?: number;
    totalShares?: number;
    shareAmount?: number;
  }, organizationId?: string) {
    const conditions: SQL[] = [eq(members.id, id)];
    if (organizationId) conditions.push(eq(members.organizationId, organizationId));
    const [existing] = await this.db.select({ organizationId: members.organizationId })
      .from(members).where(and(...conditions)).limit(1);
    if (!existing) throw new Error('Member not found');

    const setData: Record<string, any> = { updatedAt: new Date() };
    if (update.totalSavingsBalance !== undefined) setData.totalSavingsBalance = String(update.totalSavingsBalance);
    if (update.totalLoanBalance !== undefined) setData.totalLoanBalance = String(update.totalLoanBalance);
    if (update.totalShares !== undefined) setData.totalShares = update.totalShares;
    if (update.shareAmount !== undefined) setData.shareAmount = String(update.shareAmount);

    const results = await this.db.insert(memberFinancialProfiles)
      .values({ memberId: id, organizationId: existing.organizationId, ...setData })
      .onConflictDoUpdate({
        target: memberFinancialProfiles.memberId,
        set: setData,
      })
      .returning();
    return results[0] ?? null;
  }

  async delete(id: string, organizationId?: string): Promise<boolean> {
    const conditions: SQL[] = [eq(members.id, id)];
    if (organizationId) conditions.push(eq(members.organizationId, organizationId));
    const results = await this.db.delete(members).where(and(...conditions)).returning({ id: members.id });
    return results.length > 0;
  }

  async getFirstBranchId(organizationId: string): Promise<string | null> {
    const results = await this.db.select({ id: branches.id })
      .from(branches)
      .where(eq(branches.organizationId, organizationId))
      .limit(1);
    return results[0]?.id ?? null;
  }

  async getNextMemberNo(branchCode: string, organizationId?: string): Promise<string> {
    const year = new Date().getFullYear() + 57; // Convert to BS year (approx)
    const base = this.db.select({ count: count() }).from(members);
    const results = organizationId
      ? await base.where(eq(members.organizationId, organizationId))
      : await base;
    const total = Number(results[0]?.count ?? 0);
    const seq = String(total + 1).padStart(4, '0');
    return `MBR-${year}-${seq}`;
  }

  // ============================================================
  // Catalog reference resolution (Member Settings / Module 3)
  // ============================================================

  /** Resolve a catalog row by id (preferred), else by name/code, within the org. */
  private async resolveLookupId(
    table: any,
    orgId: string,
    idOrLabel?: string | null,
  ): Promise<string | null> {
    if (!idOrLabel) return null;
    const trimmed = String(idOrLabel).trim();
    if (!trimmed) return null;

    const conditions: SQL[] = [eq(table.organizationId, orgId)];
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRe.test(trimmed)) {
      conditions.push(eq(table.id, trimmed));
      const [byId] = await this.db.select({ id: table.id }).from(table)
        .where(and(...conditions))
        .limit(1);
      if (byId) return byId.id;
      conditions.pop();
    }
    conditions.push(
      or(
        eq(table.name, trimmed),
        ilike(table.name, trimmed),
        eq(table.code, trimmed.toUpperCase()),
        eq(table.code, trimmed.toUpperCase().replace(/\s+/g, '_')),
      ),
    );
    const [row] = await this.db.select({ id: table.id }).from(table)
      .where(and(...conditions))
      .limit(1);
    return row?.id ?? null;
  }

  private async resolveRequiredId(
    table: any,
    orgId: string,
    idOrLabel?: string | null,
    defaultLabel?: string,
  ): Promise<string> {
    const resolved = await this.resolveLookupId(table, orgId, idOrLabel);
    if (resolved) return resolved;
    if (idOrLabel && String(idOrLabel).trim()) {
      const error = new Error(`Invalid ${(table as any)?.name ?? 'catalog'} reference: "${idOrLabel}" is not configured for this organization.`);
      (error as any).status = 400;
      throw error;
    }
    const fallback = await this.resolveLookupId(table, orgId, defaultLabel);
    if (fallback) return fallback;
    // Final fallback: the org's first active row (stable order).
    const [first] = await this.db.select({ id: table.id }).from(table)
      .where(eq(table.organizationId, orgId))
      .orderBy(asc(table.sortOrder), asc(table.name))
      .limit(1);
    if (first) return first.id;
    throw new Error('No member classification configured for this organization.');
  }

  async resolveMemberTypeId(orgId: string, idOrLabel?: string | null): Promise<string> {
    return this.resolveRequiredId(memberTypes, orgId, idOrLabel, 'General');
  }

  async resolveMemberCategoryId(orgId: string, idOrLabel?: string | null): Promise<string> {
    return this.resolveRequiredId(memberCategories, orgId, idOrLabel, 'Regular');
  }

  async resolveOccupationId(orgId: string, idOrLabel?: string | null): Promise<string | null> {
    return this.resolveLookupId(occupations, orgId, idOrLabel);
  }

  async resolveEducationLevelId(orgId: string, idOrLabel?: string | null): Promise<string | null> {
    return this.resolveLookupId(educationLevels, orgId, idOrLabel);
  }

  async resolveNomineeRelationId(orgId: string, idOrLabel?: string | null): Promise<string | null> {
    return this.resolveLookupId(relationshipTypes, orgId, idOrLabel);
  }

  async resolveNomineeTypeId(orgId: string, idOrLabel?: string | null): Promise<string | null> {
    return this.resolveLookupId(nomineeTypes, orgId, idOrLabel);
  }

  /** Full member-type row (used to enforce the group-only invariant). */
  async findMemberTypeById(orgId: string, id: string) {
    const [row] = await this.db.select().from(memberTypes)
      .where(and(eq(memberTypes.id, id), eq(memberTypes.organizationId, orgId)))
      .limit(1);
    return row ?? null;
  }

  // ============================================================
  // Group assignment & capacity
  // ============================================================
  async getGroupById(orgId: string, groupId: string) {
    const [row] = await this.db.select().from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.organizationId, orgId)))
      .limit(1);
    return row ?? null;
  }

  async countGroupMembers(orgId: string, groupId: string, excludeMemberId?: string): Promise<number> {
    const conditions: SQL[] = [
      eq(members.organizationId, orgId),
      eq(members.groupId, groupId),
    ];
    if (excludeMemberId) conditions.push(ne(members.id, excludeMemberId));
    const [row] = await this.db.select({ count: count() })
      .from(members)
      .where(and(...conditions));
    return Number(row?.count ?? 0);
  }

  /** Throws when the group is full (max_members cap) or does not belong to the org. */
  async assertGroupCapacity(orgId: string, groupId: string, excludeMemberId?: string): Promise<void> {
    const group = await this.getGroupById(orgId, groupId);
    if (!group) {
      const error = new Error('Selected group not found in this organization.');
      (error as any).status = 400;
      throw error;
    }
    if (group.maxMembers != null) {
      const current = await this.countGroupMembers(orgId, groupId, excludeMemberId);
      if (current >= group.maxMembers) {
        const error = new Error(
          `Group "${group.name}" (${group.code}) is at full capacity: ${group.maxMembers} member${group.maxMembers !== 1 ? 's' : ''}.`,
        );
        (error as any).status = 409;
        throw error;
      }
    }
  }

  async addDocument(data: typeof memberDocuments.$inferInsert, organizationId?: string) {
    if (organizationId) {
      const member = await this.findById(data.memberId, organizationId);
      if (!member) throw new Error('Member not found');
    }
    const results = await this.db.insert(memberDocuments).values(data).returning();
    return results[0];
  }

  async getDocuments(memberId: string, organizationId?: string) {
    if (organizationId) {
      const member = await this.findById(memberId, organizationId);
      if (!member) throw new Error('Member not found');
    }
    return this.db.select().from(memberDocuments)
      .where(eq(memberDocuments.memberId, memberId))
      .orderBy(desc(memberDocuments.uploadedAt));
  }
}
