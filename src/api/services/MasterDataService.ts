/**
 * Master Data Service
 * Maps raw DB rows (snake_case columns, numeric-as-string) to the camelCase
 * shapes the frontend CoopContext expects (see src/types/coop.ts).
 */
import { MasterDataRepository } from '../repositories/MasterDataRepository';
import type {
  Branch,
  FiscalYear,
  Member,
  SavingsAccount,
  LoanAccount,
  ChartOfAccount,
  Voucher,
  VoucherEntryItem,
  CollectionAgent,
  CollectionRoute,
  BudgetLine,
  FixedAsset,
  ApprovalRequest,
  AuditLog,
  CustomerTicket,
} from '../../types/coop';

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

const int = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : 0;
};

const bool = (v: unknown): boolean => v === true || v === 1 || v === 'true' || v === '1';

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

export class MasterDataService {
  private repository: MasterDataRepository;

  constructor() {
    this.repository = new MasterDataRepository();
  }

  async getAll(organizationId: string, branchIds?: string[]) {
    const raw = await this.repository.getAll(organizationId, branchIds);

    const entriesByVoucher = new Map<string, VoucherEntryItem[]>();
    for (const e of raw.voucherEntries) {
      const list = entriesByVoucher.get(str(e.voucherId)) ?? [];
      list.push({
        accountId: str(e.accountId),
        accountCode: str(e.accountCode),
        accountName: str(e.accountName),
        debit: num(e.debit),
        credit: num(e.credit),
        narration: e.narration ? str(e.narration) : undefined,
      });
      entriesByVoucher.set(str(e.voucherId), list);
    }

    // Collateral/guarantor info lives in child tables (loan_collaterals, guarantors);
    // flatten the first record per loan for the frontend LoanAccount shape.
    const collateralByLoanId = new Map<string, (typeof raw.loanCollaterals)[number]>();
    for (const c of raw.loanCollaterals) {
      const loanId = str(c.loanId);
      if (!collateralByLoanId.has(loanId)) collateralByLoanId.set(loanId, c);
    }
    const guarantorByLoanId = new Map<string, (typeof raw.guarantors)[number]>();
    for (const g of raw.guarantors) {
      const loanId = str(g.loanId);
      if (!guarantorByLoanId.has(loanId)) guarantorByLoanId.set(loanId, g);
    }

    return {
      branches: raw.branches.map<Branch>((b) => ({
        id: str(b.id),
        code: str(b.code),
        name: str(b.name),
        branchType: b.branchType ? str(b.branchType) : undefined,
        isHeadOffice: b.isHeadOffice ?? false,
        address: str(b.address),
        province: b.province ? str(b.province) : undefined,
        district: b.district ? str(b.district) : undefined,
        municipality: b.municipality ? str(b.municipality) : undefined,
        ward: b.ward ? str(b.ward) : undefined,
        tole: b.tole ? str(b.tole) : undefined,
        phone: str(b.phone),
        email: b.email ? str(b.email) : undefined,
        managerName: str(b.managerName),
        openingDateBs: b.openingDateBs ? str(b.openingDateBs) : undefined,
        status: b.status ? str(b.status) : undefined,
        latitude: b.latitude !== null && b.latitude !== undefined ? num(b.latitude) : undefined,
        longitude: b.longitude !== null && b.longitude !== undefined ? num(b.longitude) : undefined,
        googleMapLink: b.googleMapLink ? str(b.googleMapLink) : undefined,
        logoUrl: b.logoUrl ? str(b.logoUrl) : undefined,
        workingDays: b.workingDays ? str(b.workingDays) : undefined,
        openingTime: b.openingTime ? str(b.openingTime) : undefined,
        closingTime: b.closingTime ? str(b.closingTime) : undefined,
        vaultLimit: num(b.vaultLimit),
        currentVaultCash: num(b.currentVaultCash),
        remarks: b.remarks ? str(b.remarks) : undefined,
      })),
      fiscalYears: raw.fiscalYears.map<FiscalYear>((fy) => ({
        id: str(fy.id),
        code: str(fy.code),
        startDateBS: str(fy.startDateBs),
        endDateBS: str(fy.endDateBs),
        startDateAD: str(fy.startDateAd),
        endDateAD: str(fy.endDateAd),
        isCurrent: bool(fy.isCurrent),
        status: str(fy.status) as FiscalYear['status'],
      })),
      members: raw.members.map<Member>((m) => ({
        id: str(m.id),
        memberNo: str(m.memberNo),
        fullName: str(m.fullName),
        nameNepali: m.nameNepali ? str(m.nameNepali) : undefined,
        citizenshipNo: str(m.citizenshipNo),
        gender: str(m.gender) as Member['gender'],
        dobBS: str(m.dobBs),
        dobAD: m.dobAd ? str(m.dobAd) : undefined,
        phone: str(m.phone),
        secondaryPhone: m.secondaryPhone ? str(m.secondaryPhone) : undefined,
        email: m.email ? str(m.email) : undefined,
        address: str(m.address),
        district: str(m.district),
        branchId: str(m.branchId),
        photoUrl: m.photoUrl ? str(m.photoUrl) : undefined,
        signatureUrl: m.signatureUrl ? str(m.signatureUrl) : undefined,
        kycStatus: str(m.kycStatus) as Member['kycStatus'],
        membershipDateBS: str(m.membershipDateBs),
        memberTypeId: m.memberTypeId ? str(m.memberTypeId) : undefined,
        membershipType: str(m.membershipType) as Member['membershipType'],
        memberCategoryId: m.memberCategoryId ? str(m.memberCategoryId) : undefined,
        memberCategory: m.memberCategory ? str(m.memberCategory) : undefined,
        groupId: m.groupId ? str(m.groupId) : undefined,
        groupName: m.groupName ? str(m.groupName) : undefined,
        totalShares: int(m.totalShares),
        shareAmount: num(m.shareAmount),
        totalSavingsBalance: num(m.totalSavingsBalance),
        totalLoanBalance: num(m.totalLoanBalance),
        nomineeName: m.nomineeName ? str(m.nomineeName) : undefined,
        nomineeRelationId: m.nomineeRelationId ? str(m.nomineeRelationId) : undefined,
        nomineeRelation: m.nomineeRelation ? str(m.nomineeRelation) : undefined,
        nomineeTypeId: m.nomineeTypeId ? str(m.nomineeTypeId) : undefined,
        nomineeType: m.nomineeType ? str(m.nomineeType) : undefined,
        nomineePhone: m.nomineePhone ? str(m.nomineePhone) : undefined,
        nomineeCitizenshipNo: m.nomineeCitizenshipNo ? str(m.nomineeCitizenshipNo) : undefined,
        nomineeSharePct: m.nomineeSharePct !== null && m.nomineeSharePct !== undefined ? num(m.nomineeSharePct) : undefined,
        citizenshipIssueDistrict: m.citizenshipIssueDistrict ? str(m.citizenshipIssueDistrict) : undefined,
        citizenshipIssueDateBS: m.citizenshipIssueDateBs ? str(m.citizenshipIssueDateBs) : undefined,
        maritalStatus: m.maritalStatus ? (str(m.maritalStatus) as Member['maritalStatus']) : undefined,
        bloodGroup: m.bloodGroup ? str(m.bloodGroup) : undefined,
        isMinor: m.isMinor === null ? undefined : bool(m.isMinor),
        guardianName: m.guardianName ? str(m.guardianName) : undefined,
        guardianRelation: m.guardianRelation ? str(m.guardianRelation) : undefined,
        guardianCitizenshipNo: m.guardianCitizenshipNo ? str(m.guardianCitizenshipNo) : undefined,
        guardianPhone: m.guardianPhone ? str(m.guardianPhone) : undefined,
        fatherName: m.fatherName ? str(m.fatherName) : undefined,
        motherName: m.motherName ? str(m.motherName) : undefined,
        grandfatherName: m.grandfatherName ? str(m.grandfatherName) : undefined,
        spouseName: m.spouseName ? str(m.spouseName) : undefined,
        dependentsCount: m.dependentsCount !== null && m.dependentsCount !== undefined ? int(m.dependentsCount) : undefined,
        permProvince: m.permProvince ? str(m.permProvince) : undefined,
        permDistrict: m.permDistrict ? str(m.permDistrict) : undefined,
        permMunicipality: m.permMunicipality ? str(m.permMunicipality) : undefined,
        permWard: m.permWard ? str(m.permWard) : undefined,
        permTole: m.permTole ? str(m.permTole) : undefined,
        tempProvince: m.tempProvince ? str(m.tempProvince) : undefined,
        tempDistrict: m.tempDistrict ? str(m.tempDistrict) : undefined,
        tempMunicipality: m.tempMunicipality ? str(m.tempMunicipality) : undefined,
        tempWard: m.tempWard ? str(m.tempWard) : undefined,
        tempTole: m.tempTole ? str(m.tempTole) : undefined,
        occupationId: m.occupationId ? str(m.occupationId) : undefined,
        occupation: m.occupation ? str(m.occupation) : undefined,
        educationLevelId: m.educationLevelId ? str(m.educationLevelId) : undefined,
        educationLevel: m.educationLevel ? str(m.educationLevel) : undefined,
        employerName: m.employerName ? str(m.employerName) : undefined,
        annualIncome: m.annualIncome !== null && m.annualIncome !== undefined ? str(m.annualIncome) : undefined,
        sourceOfFunds: m.sourceOfFunds ? str(m.sourceOfFunds) : undefined,
        isPEP: m.isPep === null ? undefined : bool(m.isPep),
        pepDetails: m.pepDetails ? str(m.pepDetails) : undefined,
        ethicsAccepted: m.ethicsAccepted === null ? undefined : bool(m.ethicsAccepted),
        citizenshipFrontUrl: m.citizenshipFrontUrl ? str(m.citizenshipFrontUrl) : undefined,
        citizenshipBackUrl: m.citizenshipBackUrl ? str(m.citizenshipBackUrl) : undefined,
        fingerprintData: m.fingerprintData ? str(m.fingerprintData) : undefined,
        status: str(m.status) as Member['status'],
      })),
      savingsAccounts: raw.savingsAccounts.map<SavingsAccount>((a) => ({
        id: str(a.id),
        accountNo: str(a.accountNo),
        memberId: str(a.memberId),
        memberName: str(a.memberName),
        memberNo: str(a.memberNo),
        productType: str(a.productType) as SavingsAccount['productType'],
        productName: str(a.productName),
        interestRate: num(a.interestRate),
        balance: num(a.balance),
        minBalance: num(a.minBalance),
        openedDateBS: str(a.openedDateBs),
        maturityDateBS: a.maturityDateBs ? str(a.maturityDateBs) : undefined,
        monthlyInstallment: a.monthlyInstallment !== null && a.monthlyInstallment !== undefined ? num(a.monthlyInstallment) : undefined,
        branchId: str(a.branchId),
        collectionRouteId: a.collectionRouteId ? str(a.collectionRouteId) : undefined,
        status: str(a.status) as SavingsAccount['status'],
        lastTransactionDateBS: str(a.lastTransactionDateBs),
      })),
      loanAccounts: raw.loanAccounts.map<LoanAccount>((l) => {
        const collateral = collateralByLoanId.get(str(l.id));
        const guarantor = guarantorByLoanId.get(str(l.id));
        return {
          id: str(l.id),
          loanNo: str(l.loanNo),
          memberId: str(l.memberId),
          memberName: str(l.memberName),
          memberNo: str(l.memberNo),
          productType: str(l.productType) as LoanAccount['productType'],
          productName: str(l.productName),
          appliedAmount: num(l.appliedAmount),
          approvedAmount: num(l.approvedAmount),
          outstandingPrincipal: num(l.outstandingPrincipal),
          interestRate: num(l.interestRate),
          interestMethod: str(l.interestMethod) as LoanAccount['interestMethod'],
          tenureMonths: int(l.tenureMonths),
          monthlyEMI: num(l.monthlyEmi),
          disbursedDateBS: str(l.disbursedDateBs),
          maturityDateBS: str(l.maturityDateBs),
          collateralType: collateral ? str(collateral.collateralType) : '',
          collateralValuation: collateral ? num(collateral.valuation) : 0,
          guarantorMemberId: guarantor?.guarantorMemberId ? str(guarantor.guarantorMemberId) : undefined,
          guarantorName: guarantor ? str(guarantor.guarantorName) : undefined,
          branchId: str(l.branchId),
          status: str(l.status) as LoanAccount['status'],
          nplStatus: str(l.nplStatus) as LoanAccount['nplStatus'],
          daysOverdue: int(l.daysOverdue),
          overdueAmount: num(l.overdueAmount),
          provisionAmount: num(l.provisionAmount),
          lastRepaymentDateBS: l.lastRepaymentDateBs ? str(l.lastRepaymentDateBs) : undefined,
        };
      }),
      chartOfAccounts: raw.chartOfAccounts.map<ChartOfAccount>((c) => ({
        id: str(c.id),
        code: str(c.code),
        name: str(c.name),
        type: str(c.type) as ChartOfAccount['type'],
        parentCode: c.parentCode ? str(c.parentCode) : undefined,
        balance: num(c.balance),
        isSystemAccount: c.isSystemAccount === null ? undefined : bool(c.isSystemAccount),
      })),
      vouchers: raw.vouchers.map<Voucher>((v) => ({
        id: str(v.id),
        voucherNo: str(v.voucherNo),
        voucherType: str(v.voucherType) as Voucher['voucherType'],
        dateBS: str(v.dateBs),
        dateAD: str(v.dateAd),
        branchId: str(v.branchId),
        preparedBy: str(v.preparedBy),
        approvedBy: v.approvedBy ? str(v.approvedBy) : undefined,
        status: str(v.status) as Voucher['status'],
        totalAmount: num(v.totalAmount),
        narration: str(v.narration),
        entries: entriesByVoucher.get(str(v.id)) ?? [],
        moduleReference: v.moduleReference ? str(v.moduleReference) : undefined,
      })),
      collectionAgents: raw.collectionRoutes.reduce<CollectionAgent[]>((acc, r) => {
        if (acc.some((a) => a.id === str(r.agentId))) return acc;
        acc.push({
          id: str(r.agentId),
          agentCode: `AG-${r.code}`,
          name: str(r.agentName),
          phone: '',
          branchId: r.branchId ? str(r.branchId) : '',
          assignedRouteName: str(r.routeName),
          dailyTargetAmount: num(r.todayTargetAmount),
          status: 'Active',
        });
        return acc;
      }, []),
      collectionRoutes: raw.collectionRoutes.map<CollectionRoute>((r) => ({
        id: str(r.id),
        code: str(r.code),
        routeName: str(r.routeName),
        agentId: str(r.agentId),
        agentName: str(r.agentName),
        assignedMembersCount: int(r.assignedMembersCount),
        todayTargetAmount: num(r.todayTargetAmount),
        todayCollectedAmount: num(r.todayCollectedAmount),
        status: str(r.status) as CollectionRoute['status'],
      })),
      budgetLines: raw.budgetLines.map<BudgetLine>((b) => ({
        id: str(b.id),
        glAccountCode: str(b.glAccountCode),
        glAccountName: str(b.glAccountName),
        fiscalYear: str(b.fiscalYear),
        allocatedBudget: num(b.allocatedBudget),
        usedActual: num(b.usedActual),
        committed: num(b.committed),
        department: str(b.department),
      })),
      fixedAssets: raw.fixedAssets.map<FixedAsset>((f) => ({
        id: str(f.id),
        assetCode: str(f.assetCode),
        assetName: str(f.assetName),
        category: str(f.category) as FixedAsset['category'],
        purchaseDateBS: str(f.purchaseDateBs),
        originalCost: num(f.originalCost),
        depreciationMethod: str(f.depreciationMethod) as FixedAsset['depreciationMethod'],
        depreciationRatePercent: num(f.depreciationRatePercent),
        accumulatedDepreciation: num(f.accumulatedDepreciation),
        currentBookValue: num(f.currentBookValue),
        branchId: str(f.branchId),
        location: str(f.location),
        status: str(f.status) as FixedAsset['status'],
      })),
      approvalRequests: raw.approvalRequests.map<ApprovalRequest>((ar) => ({
        id: str(ar.id),
        requestType: str(ar.requestType) as ApprovalRequest['requestType'],
        referenceNo: str(ar.referenceNo),
        requestedBy: str(ar.requestedBy),
        requestedDateBS: str(ar.requestedDateBs),
        amount: num(ar.amount),
        description: str(ar.description),
        branchId: str(ar.branchId),
        status: str(ar.status) as ApprovalRequest['status'],
        approvedBy: ar.approvedBy ? str(ar.approvedBy) : undefined,
        remarks: ar.remarks ? str(ar.remarks) : undefined,
      })),
      auditLogs: raw.auditLogs.map<AuditLog>((al) => ({
        id: str(al.id),
        timestampBS: str(al.timestampBs),
        timestampAD: str(al.timestampAd),
        userName: str(al.userName),
        userRole: str(al.userRole),
        module: str(al.module),
        action: str(al.action),
        details: str(al.details),
        ipAddress: str(al.ipAddress),
      })),
      customerTickets: raw.customerTickets.map<CustomerTicket>((t) => ({
        id: str(t.id),
        ticketNo: str(t.ticketNo),
        memberId: str(t.memberId),
        memberName: str(t.memberName),
        category: str(t.category) as CustomerTicket['category'],
        subject: str(t.subject),
        description: str(t.description),
        assignedTo: str(t.assignedTo),
        priority: str(t.priority) as CustomerTicket['priority'],
        status: str(t.status) as CustomerTicket['status'],
        createdDateBS: str(t.createdDateBs),
      })),
    };
  }
}
