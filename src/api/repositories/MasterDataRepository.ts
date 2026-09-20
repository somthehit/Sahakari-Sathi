/**
 * Master Data Repository
 * Data access layer that loads all lookup/registry tables needed to bootstrap
 * the frontend application state (CoopContext) from the real database.
 */
import { asc, eq, and, inArray, sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  branches,
  fiscalYears,
  members,
  memberKycProfiles,
  memberFinancialProfiles,
  memberFamily,
  savingsAccounts,
  loanAccounts,
  loanCollaterals,
  guarantors,
  chartOfAccounts,
  vouchers,
  voucherEntries,
  collectionRoutes,
  budgetLines,
  fixedAssets,
  approvalRequests,
  auditLogs,
  customerTickets,
  memberTypes,
  memberCategories,
  occupations,
  educationLevels,
  relationshipTypes,
  nomineeTypes,
  groups,
} from '../../db/schema';

/**
 * Flattened member row: the vertical split moved KYC/financial/family columns
 * into 1:1 child tables, but consumers expect the original flat camelCase shape.
 */
const memberFlatSelect = {
  id: members.id,
  memberNo: members.memberNo,
  fullName: members.fullName,
  nameNepali: members.nameNepali,
  gender: members.gender,
  dobBs: members.dobBs,
  dobAd: members.dobAd,
  phone: members.phone,
  secondaryPhone: members.secondaryPhone,
  email: members.email,
  branchId: members.branchId,
  kycStatus: members.kycStatus,
  membershipDateBs: members.membershipDateBs,
  memberTypeId: members.memberTypeId,
  membershipType: memberTypes.name,
  memberCategoryId: members.memberCategoryId,
  memberCategory: memberCategories.name,
  groupId: members.groupId,
  groupName: groups.name,
  isMinor: members.isMinor,
  status: members.status,
  createdAt: members.createdAt,
  updatedAt: members.updatedAt,
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
  nomineeName: memberFamily.nomineeName,
  nomineeRelationId: memberFamily.nomineeRelationId,
  nomineeRelation: relationshipTypes.name,
  nomineeTypeId: memberFamily.nomineeTypeId,
  nomineeType: nomineeTypes.name,
  nomineePhone: memberFamily.nomineePhone,
  nomineeCitizenshipNo: memberFamily.nomineeCitizenshipNo,
  nomineeSharePct: memberFamily.nomineeSharePct,
  maritalStatus: memberFamily.maritalStatus,
  bloodGroup: memberFamily.bloodGroup,
  guardianName: memberFamily.guardianName,
  guardianRelation: memberFamily.guardianRelation,
  guardianCitizenshipNo: memberFamily.guardianCitizenshipNo,
  guardianPhone: memberFamily.guardianPhone,
  fatherName: memberFamily.fatherName,
  motherName: memberFamily.motherName,
  grandfatherName: memberFamily.grandfatherName,
  spouseName: memberFamily.spouseName,
  dependentsCount: memberFamily.dependentsCount,
};

export interface MasterDataRowSets {
  branches: typeof branches.$inferSelect[];
  fiscalYears: typeof fiscalYears.$inferSelect[];
  members: Record<string, any>[];
  savingsAccounts: typeof savingsAccounts.$inferSelect[];
  loanAccounts: typeof loanAccounts.$inferSelect[];
  loanCollaterals: typeof loanCollaterals.$inferSelect[];
  guarantors: typeof guarantors.$inferSelect[];
  chartOfAccounts: typeof chartOfAccounts.$inferSelect[];
  vouchers: typeof vouchers.$inferSelect[];
  voucherEntries: typeof voucherEntries.$inferSelect[];
  collectionRoutes: typeof collectionRoutes.$inferSelect[];
  budgetLines: typeof budgetLines.$inferSelect[];
  fixedAssets: typeof fixedAssets.$inferSelect[];
  approvalRequests: typeof approvalRequests.$inferSelect[];
  auditLogs: typeof auditLogs.$inferSelect[];
  customerTickets: typeof customerTickets.$inferSelect[];
}

export class MasterDataRepository {
  private get db() {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    return db;
  }

  async getAll(organizationId: string, branchIds?: string[]): Promise<MasterDataRowSets> {
    if (!organizationId) throw new Error('Organization context is required.');

    const scoped = (branchCol: any) =>
      branchIds !== undefined ? and(eq(branchCol.organizationId as any, organizationId), inArray(branchCol.branchId, branchIds)) : eq(branchCol.organizationId as any, organizationId);

    const safe = async (label: string, queryFn: () => Promise<any>): Promise<any[]> => {
      try {
        return await queryFn();
      } catch (err: any) {
        console.error(`[MasterData] Query "${label}" failed:`, err?.message || err);
        return [];
      }
    };

    const queries: [string, () => Promise<any[]>][] = [
      ['branches',       () => this.db.select().from(branches).where(branchIds !== undefined ? inArray(branches.id, branchIds) : eq(branches.organizationId, organizationId)).orderBy(asc(branches.code))],
      ['fiscalYears',    () => this.db.select().from(fiscalYears).where(eq(fiscalYears.organizationId, organizationId)).orderBy(asc(fiscalYears.code))],
      ['members',        () => this.db.select(memberFlatSelect)
        .from(members)
        .leftJoin(memberKycProfiles, eq(memberKycProfiles.memberId, members.id))
        .leftJoin(memberFinancialProfiles, eq(memberFinancialProfiles.memberId, members.id))
        .leftJoin(memberFamily, eq(memberFamily.memberId, members.id))
        .leftJoin(memberTypes, eq(memberTypes.id, members.memberTypeId))
        .leftJoin(memberCategories, eq(memberCategories.id, members.memberCategoryId))
        .leftJoin(groups, eq(groups.id, members.groupId))
        .leftJoin(occupations, eq(occupations.id, memberKycProfiles.occupationId))
        .leftJoin(educationLevels, eq(educationLevels.id, memberKycProfiles.educationLevelId))
        .leftJoin(relationshipTypes, eq(relationshipTypes.id, memberFamily.nomineeRelationId))
        .leftJoin(nomineeTypes, eq(nomineeTypes.id, memberFamily.nomineeTypeId))
        .where(scoped(members))
        .orderBy(asc(members.memberNo))],
      ['savingsAccounts', () => this.db.select().from(savingsAccounts).where(scoped(savingsAccounts)).orderBy(asc(savingsAccounts.accountNo))],
      ['loanAccounts',    () => this.db.select().from(loanAccounts).where(scoped(loanAccounts)).orderBy(asc(loanAccounts.loanNo))],
      ['loanCollaterals', () => this.db.select().from(loanCollaterals).where(eq(loanCollaterals.organizationId, organizationId)).orderBy(asc(loanCollaterals.createdAt))],
      ['guarantors',      () => this.db.select().from(guarantors).where(eq(guarantors.organizationId, organizationId)).orderBy(asc(guarantors.createdAt))],
      ['chartOfAccounts', () => this.db.select().from(chartOfAccounts).where(eq(chartOfAccounts.organizationId, organizationId)).orderBy(asc(chartOfAccounts.code))],
      ['vouchers',        () => this.db.select().from(vouchers).where(scoped(vouchers)).orderBy(asc(vouchers.voucherNo))],
      ['voucherEntries',  () => this.db.select().from(voucherEntries).where(eq(voucherEntries.organizationId, organizationId))],
      ['collectionRoutes',() => this.db.select().from(collectionRoutes).where(scoped(collectionRoutes)).orderBy(asc(collectionRoutes.code))],
      ['budgetLines',     () => this.db.select().from(budgetLines).where(eq(budgetLines.organizationId, organizationId))],
      ['fixedAssets',     () => this.db.select().from(fixedAssets).where(scoped(fixedAssets)).orderBy(asc(fixedAssets.assetCode))],
      ['approvalRequests',() => this.db.select().from(approvalRequests).where(scoped(approvalRequests))],
      ['auditLogs',       () => this.db.select().from(auditLogs).where(eq(auditLogs.organizationId, organizationId))],
      ['customerTickets', () => this.db.select().from(customerTickets).where(eq(customerTickets.organizationId, organizationId))],
    ];

    const results = await Promise.all(queries.map(([label, q]) => safe(label, q)));

    const [branchRows, fiscalYearRows, memberRows, savingsRows, loanRows, collateralRows, guarantorRows, coaRows, voucherRows, entryRows, routeRows, budgetRows, assetRows, approvalRows, auditRows, ticketRows] = results;

    return {
      branches: branchRows,
      fiscalYears: fiscalYearRows,
      members: memberRows,
      savingsAccounts: savingsRows,
      loanAccounts: loanRows,
      loanCollaterals: collateralRows,
      guarantors: guarantorRows,
      chartOfAccounts: coaRows,
      vouchers: voucherRows,
      voucherEntries: entryRows,
      collectionRoutes: routeRows,
      budgetLines: budgetRows,
      fixedAssets: assetRows,
      approvalRequests: approvalRows,
      auditLogs: auditRows,
      customerTickets: ticketRows,
    };
  }
}
