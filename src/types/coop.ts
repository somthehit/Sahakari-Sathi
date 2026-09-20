export type UserRole = 
  | 'admin'
  | 'branch_manager'
  | 'teller'
  | 'loan_officer'
  | 'accountant'
  | 'collection_agent';

export interface Branch {
  id: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  managerName: string;
  vaultLimit: number;
  currentVaultCash: number;
  branchType?: string;
  isHeadOffice?: boolean;
  province?: string;
  district?: string;
  municipality?: string;
  ward?: string;
  tole?: string;
  email?: string;
  openingDateBs?: string;
  latitude?: number;
  longitude?: number;
  googleMapLink?: string;
  logoUrl?: string;
  workingDays?: string;
  openingTime?: string;
  closingTime?: string;
  remarks?: string;
  status?: string;
}

export interface FiscalYear {
  id: string;
  code: string; // e.g. "2083/84"
  startDateBS: string; // "2083-04-01"
  endDateBS: string;   // "2084-03-31"
  startDateAD: string; // "2026-07-17"
  endDateAD: string;   // "2027-07-16"
  isCurrent: boolean;
  status: 'active' | 'closed';
}

export type CurrencyCode = 'NPR' | 'USD';

export interface CurrencyConfig {
  baseCurrency: CurrencyCode;
  exchangeRate: number;       // NPR per 1 USD (used when baseCurrency is USD)
  forexMarkupPct: number;     // forex commission markup applied on exchange
  applyGST: boolean;          // whether GST is charged on the forex markup
  gstPct: number;             // GST percentage
  updatedAt?: string;
}

export interface TabItem {
  id: string;
  moduleKey: string;
  title: string;
  iconName: string;
  recordId?: string;
  isDirty?: boolean;
  data?: any;
}

export type MediaTargetType =
  | 'photo'
  | 'citizenshipFront'
  | 'citizenshipBack'
  | 'signature'
  | 'fingerprint'
  | 'kyc_document'
  | 'certificate'
  | 'invoice_bill'
  | 'payroll_document'
  | 'org_logo'
  | 'org_favicon'
  | 'deposit_voucher'
  | 'cheque_image'
  | 'agm_document'
  | 'user_avatar';

export interface Member {
  id: string;
  memberNo: string; // e.g. "MBR-2083-0101"
  fullName: string;
  nameNepali?: string;
  citizenshipNo: string;
  gender: 'Male' | 'Female' | 'Other';
  dobBS: string;
  phone: string;
  email?: string;
  address: string;
  district: string;
  branchId: string;
  photoUrl?: string;
  signatureUrl?: string;
  kycStatus: 'Verified' | 'Pending' | 'Rejected';
  membershipDateBS: string;
  // Classification catalogs (Member Settings / Module 3) — org-scoped FKs.
  // `membershipType` / `memberCategory` / `occupation` / `nomineeRelation`
  // resolve to the catalog NAMES for display; the *_Id siblings carry the FKs.
  membershipType: string;
  memberTypeId?: string;
  memberCategoryId?: string;
  groupId?: string;
  groupName?: string;
  occupationId?: string;
  educationLevelId?: string;
  educationLevel?: string;
  nomineeRelationId?: string;
  nomineeTypeId?: string;
  nomineeType?: string;
  memberTypeMinShareUnits?: number;
  memberTypeEntranceFee?: number;
  memberTypeShareValuePerUnit?: number;
  isGroupType?: boolean;
  totalShares: number;
  shareAmount: number;
  totalSavingsBalance: number;
  totalLoanBalance: number;
  nomineeName?: string;
  nomineeRelation?: string;
  nomineePhone?: string;
  status: 'Active' | 'Inactive' | 'Terminated';
  // Enterprise Multi-Tenant & Workflow Approval Fields
  organizationId?: string;
  searchName?: string;
  memberCategory?: string;
  memberTags?: string[];
  idType?: 'Citizenship' | 'National ID' | 'Passport';
  idNumber?: string;
  idIssuedDistrict?: string;
  idIssuedDateBS?: string;
  kycDocumentUrl?: string;
  submittedBy?: string;
  verifiedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedReason?: string;
  deletedAt?: string;
  deletedBy?: string;
  // Comprehensive Member Form & KYC Details
  citizenshipIssueDistrict?: string;
  citizenshipIssueDateBS?: string;
  dobAD?: string;
  maritalStatus?: 'Single' | 'Married' | 'Divorced' | 'Widowed';
  bloodGroup?: string;
  isMinor?: boolean;
  guardianName?: string;
  guardianNameNepali?: string;
  guardianRelation?: string;
  guardianCitizenshipNo?: string;
  guardianPhone?: string;
  secondaryPhone?: string;
  permProvince?: string;
  permDistrict?: string;
  permMunicipality?: string;
  permWard?: string;
  permTole?: string;
  tempProvince?: string;
  tempDistrict?: string;
  tempMunicipality?: string;
  tempWard?: string;
  tempTole?: string;
  fatherName?: string;
  fatherNameNepali?: string;
  motherName?: string;
  motherNameNepali?: string;
  grandfatherName?: string;
  grandfatherNameNepali?: string;
  spouseName?: string;
  spouseNameNepali?: string;
  dependentsCount?: string | number;
  nomineeCitizenshipNo?: string;
  nomineeNameNepali?: string;
  nomineeSharePct?: string | number;
  occupation?: string;
  employerName?: string;
  annualIncome?: string;
  sourceOfFunds?: string;
  isPEP?: boolean;
  pepDetails?: string;
  ethicsAccepted?: boolean;
  citizenshipFrontUrl?: string;
  citizenshipBackUrl?: string;
  fingerprintData?: string;
}

export type SavingsProductType = 'regular' | 'recurring' | 'fixed' | 'daily_deposit';

export interface SavingsAccount {
  id: string;
  accountNo: string; // e.g. "SAV-101-0042"
  memberId: string;
  memberName: string;
  memberNo: string;
  savingsProductId?: string;
  productType: SavingsProductType;
  productName: string;
  interestRate: number; // percentage p.a.
  balance: number;
  minBalance: number;
  openedDateBS: string;
  maturityDateBS?: string; // For FD/RD
  monthlyInstallment?: number; // For RD
  branchId: string;
  collectionRouteId?: string; // For daily deposit
  status: 'Active' | 'Dormant' | 'Closed';
  lastTransactionDateBS: string;
}

export interface SavingsTransaction {
  id: string;
  accountId: string;
  accountNo: string;
  memberId: string;
  memberName: string;
  type: 'Deposit' | 'Withdrawal' | 'Interest_Posting' | 'Transfer_In' | 'Transfer_Out';
  amount: number;
  balanceAfter: number;
  voucherNo: string;
  dateBS: string;
  dateAD: string;
  tellerName: string;
  remarks: string;
  paymentMode: 'Cash' | 'Bank_Transfer' | 'Internal_Transfer' | 'Collection_Agent';
  branchId: string;
}

export type LoanProductType = 'general' | 'business' | 'agriculture' | 'emergency' | 'hire_purchase';
export type NplCategory = 'Pass' | 'Watchlist' | 'Substandard' | 'Doubtful' | 'Loss';

export interface LoanAccount {
  id: string;
  loanNo: string; // e.g. "LN-201-0089"
  memberId: string;
  memberName: string;
  memberNo: string;
  productType: LoanProductType;
  productName: string;
  appliedAmount: number;
  approvedAmount: number;
  outstandingPrincipal: number;
  interestRate: number; // % p.a.
  interestMethod: 'declining' | 'flat';
  tenureMonths: number;
  monthlyEMI: number;
  disbursedDateBS: string;
  maturityDateBS: string;
  collateralType: string;
  collateralValuation: number;
  guarantorMemberId?: string;
  guarantorName?: string;
  branchId: string;
  status: 'Applied' | 'Appraised' | 'Approved' | 'Disbursed' | 'Closed' | 'Written_Off';
  nplStatus: NplCategory;
  daysOverdue: number;
  overdueAmount: number;
  provisionAmount: number;
  insurancePolicyNo?: string;
  insuranceAmount?: number;
  lastRepaymentDateBS?: string;
}

export interface EmiScheduleItem {
  installmentNo: number;
  dueDateBS: string;
  principal: number;
  interest: number;
  totalEmi: number;
  balancePrincipal: number;
  status: 'Paid' | 'Due' | 'Overdue';
  paidDateBS?: string;
}

export interface ShareHolding {
  id: string;
  organizationId?: string;
  shareTypeId: string;
  shareTypeName?: string;
  memberId: string;
  memberName: string;
  memberNo: string;
  membershipType?: string;
  numberOfShares: number;
  faceValuePerShare: number; // e.g. 100 NPR
  totalValue: number;
  issuedDateBS: string;
  status: 'Active' | 'Transferred' | 'Surrendered';
  branchId?: string;
  createdAt?: string;
}

export interface ShareType {
  id: string;
  organizationId?: string;
  code: string;
  name: string;
  faceValue: number;
  minShares: number;
  maxShares?: number | null;
  isTransferable: boolean;
  dividendRate: number;
  // Distinctive kitta (कित्ता) config — per share class.
  kittaPrefix?: string;
  kittaStartBase?: number | null;
  currentKittaPointer?: number;
  maxAllowedKitta?: number | null;
  autoSequence?: boolean;
  status: 'Active' | 'Inactive';
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type ShareTransactionType = 'Issue' | 'Transfer_In' | 'Transfer_Out' | 'Surrender' | 'Dividend';

export interface ShareTransaction {
  id: string;
  organizationId?: string;
  holdingId: string;
  memberId: string;
  memberName?: string;
  memberNo?: string;
  shareTypeId: string;
  shareTypeName?: string;
  transactionType: ShareTransactionType;
  numberOfShares: number;
  amountPerShare: number;
  totalAmount: number;
  voucherNo?: string | null;
  dateBs: string;
  dateAd: string;
  remarks?: string | null;
  processedBy: string;
  branchId?: string | null;
  createdAt?: string;
}

export interface ShareCertificate {
  id: string;
  organizationId?: string;
  certificateNo: string;
  holdingId: string;
  memberId: string;
  memberName?: string;
  memberNo?: string;
  shareTypeId: string;
  shareTypeName?: string;
  numberOfShares: number;
  issuedDateBS: string;
  status: 'Active' | 'Cancelled' | 'Replaced';
  cancelledAt?: string | null;
  createdAt?: string;
}

export interface ShareIssuePayload {
  memberId: string;
  shareTypeId: string;
  numberOfShares: number;
  dateBs?: string;
  dateAd?: string;
  remarks?: string;
  branchId?: string;
  paymentAccountId?: string;
  /** Manual kitta range — used (and required) when the share type has autoSequence=false. */
  manualStartKitta?: number | null;
  manualEndKitta?: number | null;
}

export interface ShareTransferPayload {
  fromHoldingId: string;
  toMemberId: string;
  numberOfShares: number;
  dateBs?: string;
  dateAd?: string;
  remarks?: string;
  branchId?: string;
}

export interface OrganizationHeader {
  organizationName?: string;
  shortName?: string | null;
  organizationType?: string | null;
  province?: string | null;
  district?: string | null;
  municipality?: string | null;
  wardNo?: number | null;
  address?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  govtRegNo?: string | null;
  registrationNo?: string | null;
  registrationDate?: string | null;
  logoUrl?: string | null;
  pan?: string | null;
}

export interface ShareTransfer {
  id: string;
  organizationId?: string;
  transferNo: string;
  voucherId?: string | null;
  voucherNo: string;
  certificateNo?: string | null;
  fromHoldingId: string;
  fromMemberId: string;
  fromMemberName: string;
  fromMemberNo: string;
  toHoldingId: string;
  toMemberId: string;
  toMemberName: string;
  toMemberNo: string;
  shareTypeId: string;
  shareTypeName: string;
  faceValuePerShare: number;
  numberOfShares: number;
  totalAmount: number;
  dateBs: string;
  dateAd: string;
  status: 'Completed' | 'Cancelled';
  remarks?: string | null;
  processedBy: string;
  branchId?: string | null;
  createdAt?: string;
}

export interface ShareTransferResult extends ShareTransfer {
  transferId: string;
  certificateNo: string;
  organization?: OrganizationHeader;
}

export interface ShareTransferDetail extends ShareTransfer {
  certificateNo?: string | null;
  entries: {
    accountId: string;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    narration?: string | null;
  }[];
  organization?: OrganizationHeader;
}

export interface ShareDashboardSummary {
  totalShareCapital: number;
  totalSharesCount: number;
  totalMembersWithShares: number;
  totalCertificatesIssued: number;
  shareTypesCount: number;
  dividendRate: number;
  proposedDividend: number;
}

export interface ChartOfAccount {
  id?: string;
  Code?: string;
  Name?: string;
  Type?: string;
  Description?: string;
  Balance?: number;
  ParentCode?: string;
  Status?: string;
  code: string; // e.g. "01-10", "04-80"
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense' | 'ASSETS' | 'ASSET' | 'LIABILITIES' | 'LIABILITY' | 'EXPENSES' | 'EXPENSE' | 'INCOME' | string;
  parentCode?: string;
  balance: number;
  isSystemAccount?: boolean;
  isActive?: boolean;
  cashBankAccount?: boolean;
}

export interface VoucherEntryItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  narration?: string;
}

export interface Voucher {
  id: string;
  voucherNo: string; // e.g. "VCH-2083-0451"
  voucherType: 'Journal' | 'Payment' | 'Receipt' | 'Contra';
  dateBS: string;
  dateAD: string;
  branchId: string;
  preparedBy: string;
  approvedBy?: string;
  status: 'Draft' | 'Posted' | 'Cancelled';
  totalAmount: number;
  narration: string;
  entries: VoucherEntryItem[];
  moduleReference?: string; // e.g. "Deposit SAV-101-0042"
}

export interface CollectionAgent {
  id: string;
  agentCode: string;
  name: string;
  phone: string;
  branchId: string;
  assignedRouteName: string;
  dailyTargetAmount: number;
  status: 'Active' | 'On Leave';
}

export interface CollectionRoute {
  id: string;
  code: string;
  routeName: string;
  agentId: string;
  agentName: string;
  assignedMembersCount: number;
  todayTargetAmount: number;
  todayCollectedAmount: number;
  status: 'Pending' | 'In_Progress' | 'Reconciled';
}

export interface FieldCollectionEntry {
  id: string;
  routeId: string;
  agentId: string;
  agentName: string;
  memberId: string;
  memberName: string;
  accountNo: string;
  accountType: 'Savings' | 'Loan_EMI';
  collectedAmount: number;
  collectionTimeBS: string;
  receiptNo: string;
  reconciledWithVault: boolean;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  headOfDepartment: string;
  branchId: string;
  staffCount: number;
  budgetAllocation: number;
  usedBudget: number;
  description: string;
  costCenterCode: string;
  status: 'Active' | 'Inactive';
  createdAtBS: string;
}

export interface Designation {
  id: string;
  departmentId: string;
  name: string;
  code?: string;
  reportsToId?: string;
  jobGrade?: string;
  minSalary?: number;
  maxSalary?: number;
  allowanceEligible?: boolean;
  approvalLimit?: number;
  systemAccessRole?: string;
  pearlsRole?: string;
  employmentType?: string;
  description?: string;
  status: 'Active' | 'Inactive';
}

export interface WorkingDay {
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  isWorkingDay: boolean;
  openTime: string | null;
  closeTime: string | null;
  halfDay: boolean;
}

export interface BudgetLine {
  id: string;
  glAccountCode: string;
  glAccountName: string;
  fiscalYear: string;
  allocatedBudget: number;
  usedActual: number;
  committed: number;
  department: string;
}

export interface FixedAsset {
  id: string;
  assetCode: string;
  assetName: string;
  category: 'Furniture' | 'Vehicles' | 'IT_Hardware' | 'Building' | 'Office_Equipment';
  purchaseDateBS: string;
  originalCost: number;
  depreciationMethod: 'Straight_Line' | 'WDV';
  depreciationRatePercent: number;
  accumulatedDepreciation: number;
  currentBookValue: number;
  branchId: string;
  location: string;
  status: 'Active' | 'Disposed' | 'Written_Off';
}

export interface PayrollRun {
  id: string;
  monthBS: string; // e.g. "Shrawan 2083"
  staffCount: number;
  totalGrossSalary: number;
  totalPfDeduction: number;
  totalTaxDeduction: number;
  totalNetSalary: number;
  processedDateBS: string;
  processedBy: string;
  status: 'Draft' | 'Approved' | 'Disbursed';
}

export interface InventoryItem {
  id: string;
  itemCode: string;
  itemName: string;
  category: 'Fertilizer' | 'Seeds' | 'Consumer Goods' | 'Dairy Tools';
  unit: 'Kg' | 'Bag' | 'Litre' | 'Pcs';
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  reorderLevel: number;
}

export interface ApprovalRequest {
  id: string;
  requestType: 'Loan_Approval' | 'Expense_Claim' | 'Voucher_Post' | 'Share_Transfer' | 'Member_Exit';
  referenceNo: string; // e.g. "LN-201-0089"
  requestedBy: string;
  requestedDateBS: string;
  amount: number;
  description: string;
  branchId: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  remarks?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert' | 'error';
  timestampBS: string;
  isRead: boolean;
  linkModule?: string;
}

export interface AuditLog {
  id: string;
  timestampBS: string;
  timestampAD: string;
  userName: string;
  userRole: string;
  module: string;
  action: string;
  details: string;
  ipAddress: string;
}

export interface CustomerTicket {
  id: string;
  ticketNo: string;
  memberId: string;
  memberName: string;
  category: 'Passbook Error' | 'ATM/Card' | 'Loan Query' | 'Interest Dispute' | 'General';
  subject: string;
  description: string;
  assignedTo: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'In Progress' | 'Resolved';
  createdDateBS: string;
}

// ── Subsidiary Ledgers (सहायक खाताहरू) ──────────────────────────────────────
export interface SubsidiaryShare {
  id: string;
  memberId: string;
  memberNo?: string;
  memberName?: string;
  voucherNo: string;
  transactionDateBs: string;
  transactionType: 'Purchase' | 'Return' | 'Bonus' | string;
  shareQuantity: number;
  faceValue: number;
  debitAmount: number;
  creditAmount: number;
  balanceAmount: number;
  createdAt?: string;
}

export interface SubsidiarySaving {
  id: string;
  memberId: string;
  memberNo?: string;
  memberName?: string;
  accountNo: string;
  accountType: 'Mandatory' | 'Optional' | 'Fixed' | string;
  voucherNo: string;
  transactionDateBs: string;
  debitAmount: number;
  creditAmount: number;
  balanceAmount: number;
  createdAt?: string;
}

export interface SubsidiaryLoan {
  id: string;
  memberId: string;
  memberNo?: string;
  memberName?: string;
  loanAccountNo: string;
  voucherNo: string;
  transactionDateBs: string;
  principalDebit: number;
  principalCredit: number;
  interestCredit: number;
  penaltyCredit: number;
  remainingPrincipal: number;
  createdAt?: string;
}

export interface MemberFinancialSummary {
  memberId: string;
  memberNo: string;
  fullName: string;
  phone?: string;
  totalShareBalance: number;
  totalSavingsBalance: number;
  totalOutstandingLoan: number;
}

// ── Account-level summaries (aggregated view of each subsidiary book) ─────────
export interface SubsidiaryShareAccount {
  memberId: string;
  memberNo: string;
  memberName: string;
  accountNo: string;     // e.g. SHA-MBR-2083-0001
  totalShares: number;   // net total quantity of shares owned
  totalValue: number;    // total value of active share capital (NPR)
  status: 'Active' | 'Inactive' | string;
}

export interface SubsidiarySavingAccount {
  memberId: string;
  memberNo: string;
  memberName: string;
  accountNo: string;
  accountType: string;   // product_type: regular | recurring | fixed | daily_deposit
  productName: string;
  balance: number;                       // current balance
  interestEarned: number;                // cumulative net interest posted to date
  status: string;
}

export interface SubsidiaryLoanAccount {
  memberId: string;
  memberNo: string;
  memberName: string;
  loanAccountNo: string;
  productName: string;
  principalOutstanding: number;
  interestDue: number;    // outstanding interest on EMIs not yet paid
  maturityDateBs: string;
  status: string;
}

export interface SubsidiaryBooksPayload {
  shares: SubsidiaryShare[];
  savings: SubsidiarySaving[];
  loans: SubsidiaryLoan[];
  summary: MemberFinancialSummary[];
  shareAccounts: SubsidiaryShareAccount[];
  savingsAccounts: SubsidiarySavingAccount[];
  loanAccounts: SubsidiaryLoanAccount[];
}
