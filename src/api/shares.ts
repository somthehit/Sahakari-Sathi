/**
 * Shares API client (शेयर व्यवस्थापन)
 * All calls are org-scoped server-side via the auth token.
 */
import { apiClient } from '../lib/apiClient';
import type {
  ShareHolding,
  ShareType,
  ShareTransaction,
  ShareCertificate,
  ShareIssuePayload,
  ShareTransferPayload,
  ShareTransfer,
  ShareTransferDetail,
  ShareTransferResult,
  ShareDashboardSummary,
} from '../types/coop';

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Guard against HTML error pages / non-JSON responses. */
function isJson(data: any): boolean {
  return data !== null && typeof data === 'object' && !Array.isArray(data);
}

// ============================================
// Dashboard Summary
// ============================================
export const fetchShareSummary = async (): Promise<ShareDashboardSummary | null> => {
  const response = await apiClient.get('/shares/summary');
  const data = response.data;
  if (!isJson(data)) return null;
  return {
    totalShareCapital: Number(data.totalShareCapital ?? 0),
    totalSharesCount: Number(data.totalSharesCount ?? 0),
    totalMembersWithShares: Number(data.totalMembersWithShares ?? 0),
    totalCertificatesIssued: Number(data.totalCertificatesIssued ?? 0),
    shareTypesCount: Number(data.shareTypesCount ?? 0),
    dividendRate: Number(data.dividendRate ?? 0),
    proposedDividend: Number(data.proposedDividend ?? 0),
  };
};

// ============================================
// Share Certificate real data (DB aggregation)
// ============================================
export interface ShareCertificateData {
  member: {
    id: string;
    memberNo: string;
    fullName: string;
    citizenshipNo: string;
    address: string;
    membershipDateBS: string;
  };
  certificate: {
    certificateNo: string;
    totalShares: number;
    faceValue: number;
    totalCapital: number;
    issuedDateBS: string;
    kittaStart: number;
    kittaEnd: number;
  };
}

/** Real member share data for the certificate preview — aggregated from the DB. */
export const fetchMemberShareCertificate = async (memberId: string, certificateId?: string): Promise<ShareCertificateData | null> => {
  const response = await apiClient.get(`/shares/certificate/${memberId}`, {
    params: certificateId ? { certificateId } : {},
  });
  const data = response.data;
  if (!isJson(data)) return null;
  return {
    member: {
      id: data.member?.id ?? memberId,
      memberNo: data.member?.memberNo ?? '',
      fullName: data.member?.fullName ?? '',
      citizenshipNo: data.member?.citizenshipNo ?? 'N/A',
      address: data.member?.address ?? '—',
      membershipDateBS: data.member?.membershipDateBS ?? '',
    },
    certificate: {
      certificateNo: data.certificate?.certificateNo ?? '',
      totalShares: Number(data.certificate?.totalShares ?? 0),
      faceValue: Number(data.certificate?.faceValue ?? 100),
      totalCapital: Number(data.certificate?.totalCapital ?? 0),
      issuedDateBS: data.certificate?.issuedDateBS ?? '',
      kittaStart: Number(data.certificate?.kittaStart ?? 1001),
      kittaEnd: Number(data.certificate?.kittaEnd ?? 1001),
    },
  };
};

// ============================================
// Share Types
// ============================================
export const fetchShareTypes = async (): Promise<ShareType[]> => {
  const response = await apiClient.get('/shares/types');
  const data = response.data;
  if (!Array.isArray(data)) return [];
  return data.map((t: any) => ({
    id: t.id,
    organizationId: t.organizationId,
    code: t.code,
    name: t.name,
    faceValue: Number(t.faceValue ?? 0),
    minShares: Number(t.minShares ?? 1),
    maxShares: t.maxShares != null ? Number(t.maxShares) : null,
    isTransferable: !!t.isTransferable,
    dividendRate: Number(t.dividendRate ?? 0),
    kittaPrefix: t.kittaPrefix ?? '',
    kittaStartBase: t.kittaStartBase != null ? Number(t.kittaStartBase) : null,
    currentKittaPointer: Number(t.currentKittaPointer ?? 0),
    maxAllowedKitta: t.maxAllowedKitta != null ? Number(t.maxAllowedKitta) : null,
    autoSequence: t.autoSequence !== false,
    status: t.status,
    description: t.description,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));
};

export const createShareType = async (payload: Partial<ShareType>): Promise<ShareType> => {
  const { data } = await apiClient.post<ShareType>('/shares/types', payload);
  return data;
};

export const updateShareType = async (id: string, payload: Partial<ShareType>): Promise<ShareType> => {
  const { data } = await apiClient.put<ShareType>(`/shares/types/${id}`, payload);
  return data;
};

export const deleteShareType = async (id: string): Promise<{ success: boolean }> => {
  const { data } = await apiClient.delete(`/shares/types/${id}`);
  return data;
};

// ============================================
// Holdings (shareholding register)
// ============================================
export const fetchShareHoldings = async (params: {
  search?: string;
  status?: string;
  shareTypeId?: string;
  memberId?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<ShareHolding>> => {
  const response = await apiClient.get('/shares/holdings', { params });
  const data = response.data;
  if (!isJson(data)) return { data: [], total: 0, page: 1, limit: 100, totalPages: 0 };
  return {
    data: (data.data ?? []).map((h: any) => ({
      id: h.id,
      organizationId: h.organizationId,
      shareTypeId: h.shareTypeId,
      shareTypeName: h.shareTypeName,
      memberId: h.memberId,
      memberName: h.memberName,
      memberNo: h.memberNo,
      membershipType: h.membershipType,
      numberOfShares: Number(h.numberOfShares ?? 0),
      faceValuePerShare: Number(h.faceValuePerShare ?? 0),
      totalValue: Number(h.totalValue ?? 0),
      issuedDateBS: h.issuedDateBS,
      status: h.status,
      branchId: h.branchId,
      createdAt: h.createdAt,
    })),
    total: Number(data.total ?? 0),
    page: Number(data.page ?? 1),
    limit: Number(data.limit ?? 100),
    totalPages: Number(data.totalPages ?? 0),
  };
};

// ============================================
// Transactions
// ============================================
export const fetchShareTransactions = async (params: {
  memberId?: string;
  holdingId?: string;
  limit?: number;
} = {}): Promise<ShareTransaction[]> => {
  const response = await apiClient.get('/shares/transactions', { params });
  const data = response.data;
  if (!Array.isArray(data)) return [];
  return data.map((t: any) => ({
    id: t.id,
    organizationId: t.organizationId,
    holdingId: t.holdingId,
    memberId: t.memberId,
    memberName: t.memberName,
    memberNo: t.memberNo,
    shareTypeId: t.shareTypeId,
    shareTypeName: t.shareTypeName,
    transactionType: t.transactionType,
    numberOfShares: Number(t.numberOfShares ?? 0),
    amountPerShare: Number(t.amountPerShare ?? 0),
    totalAmount: Number(t.totalAmount ?? 0),
    voucherNo: t.voucherNo,
    dateBs: t.dateBs,
    dateAd: t.dateAd,
    remarks: t.remarks,
    processedBy: t.processedBy,
    branchId: t.branchId,
    createdAt: t.createdAt,
  }));
};

// ============================================
// Certificates
// ============================================
export const fetchShareCertificates = async (params: {
  memberId?: string;
  limit?: number;
} = {}): Promise<ShareCertificate[]> => {
  const response = await apiClient.get('/shares/certificates', { params });
  const data = response.data;
  if (!Array.isArray(data)) return [];
  return data.map((c: any) => ({
    id: c.id,
    organizationId: c.organizationId,
    certificateNo: c.certificateNo,
    holdingId: c.holdingId,
    memberId: c.memberId,
    memberName: c.memberName,
    memberNo: c.memberNo,
    shareTypeId: c.shareTypeId,
    shareTypeName: c.shareTypeName,
    numberOfShares: Number(c.numberOfShares ?? 0),
    issuedDateBS: c.issuedDateBS,
    status: c.status,
    cancelledAt: c.cancelledAt,
    createdAt: c.createdAt,
  }));
};

// ============================================
// Transfer Registry (audit trail + printable docs)
// ============================================
const mapTransfer = (t: any): ShareTransfer => ({
  id: t.id,
  organizationId: t.organizationId,
  transferNo: t.transferNo,
  voucherId: t.voucherId,
  voucherNo: t.voucherNo,
  certificateNo: t.certificateNo,
  fromHoldingId: t.fromHoldingId,
  fromMemberId: t.fromMemberId,
  fromMemberName: t.fromMemberName,
  fromMemberNo: t.fromMemberNo,
  toHoldingId: t.toHoldingId,
  toMemberId: t.toMemberId,
  toMemberName: t.toMemberName,
  toMemberNo: t.toMemberNo,
  shareTypeId: t.shareTypeId,
  shareTypeName: t.shareTypeName,
  faceValuePerShare: Number(t.faceValuePerShare ?? 0),
  numberOfShares: Number(t.numberOfShares ?? 0),
  totalAmount: Number(t.totalAmount ?? 0),
  dateBs: t.dateBs,
  dateAd: t.dateAd,
  status: t.status,
  remarks: t.remarks,
  processedBy: t.processedBy,
  branchId: t.branchId,
  createdAt: t.createdAt,
});

export const fetchShareTransfers = async (params: {
  limit?: number;
} = {}): Promise<ShareTransfer[]> => {
  const response = await apiClient.get('/shares/transfers', { params });
  const data = response.data;
  if (!Array.isArray(data)) return [];
  return data.map(mapTransfer);
};

export const fetchShareTransferDetail = async (id: string): Promise<ShareTransferDetail | null> => {
  const response = await apiClient.get(`/shares/transfers/${id}`);
  const data = response.data;
  if (!isJson(data)) return null;
  return {
    ...mapTransfer(data),
    entries: (data.entries ?? []).map((e: any) => ({
      accountId: e.accountId,
      accountCode: e.accountCode,
      accountName: e.accountName,
      debit: Number(e.debit ?? 0),
      credit: Number(e.credit ?? 0),
      narration: e.narration,
    })),
    organization: data.organization,
  };
};

// ============================================
// Members (for issue/transfer dropdowns — real DB members)
// ============================================
export interface ShareMemberOption {
  id: string;
  memberNo: string;
  fullName: string;
  membershipType: string;
  status: string;
  totalShares: number;
  shareAmount: number;
}

export const fetchShareMembers = async (search?: string): Promise<ShareMemberOption[]> => {
  const response = await apiClient.get('/members', {
    params: { search, status: 'Active', limit: 500 },
  });
  const data = response.data;
  if (!isJson(data)) return [];
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map((m: any) => ({
    id: m.id,
    memberNo: m.memberNo,
    fullName: m.fullName,
    membershipType: m.membershipType,
    status: m.status,
    totalShares: Number(m.totalShares ?? 0),
    shareAmount: Number(m.shareAmount ?? 0),
  }));
};

// ============================================
// Share Register (auto-provisioned master accounts)
// ============================================
export interface ShareRegisterRow {
  accountId: string;
  accountNo: string;
  memberId: string;
  memberNo: string;
  memberName: string;
  membershipType: string;
  totalShares: number;
  totalCapital: number;
  dividendRate: number;
  estimatedDividend: number;
  status: string;
  createdAt: string;
}

export const fetchShareRegister = async (params: {
  search?: string;
  status?: string;
} = {}): Promise<ShareRegisterRow[]> => {
  const response = await apiClient.get('/shares/register', { params });
  const data = response.data;
  if (!Array.isArray(data)) return [];
  return data.map((r: any) => ({
    accountId: r.accountId,
    accountNo: r.accountNo,
    memberId: r.memberId,
    memberNo: r.memberNo,
    memberName: r.memberName,
    membershipType: r.membershipType,
    totalShares: Number(r.totalShares ?? 0),
    totalCapital: Number(r.totalCapital ?? 0),
    dividendRate: Number(r.dividendRate ?? 0),
    estimatedDividend: Number(r.estimatedDividend ?? 0),
    status: r.status,
    createdAt: r.createdAt,
  }));
};

// ============================================
// Share Account (master account + kitta-range history)
// ============================================
export interface ShareAccountHistoryRow {
  id: string;
  voucherNo: string;
  transactionDateBs: string;
  transactionType: string;
  shareQuantity: number;
  faceValue: number;
  debitAmount: number;
  creditAmount: number;
  balanceAmount: number;
  startKittaNo: number | null;
  endKittaNo: number | null;
  shareTypeId: string | null;
  shareTypeCode: string | null;
  shareTypeName: string | null;
  kittaPrefix: string;
  createdAt: string;
}

export interface ShareCertificateRegisterEntry {
  shareTypeId: string | null;
  shareTypeCode: string | null;
  shareTypeName: string | null;
  kittaPrefix: string;
  startKittaNo: number | null;
  endKittaNo: number | null;
  quantity: number;
  formattedRange: string;
}

export interface ShareAccountPanels {
  issuances: ShareAccountHistoryRow[];
  returnsAndTransfers: ShareAccountHistoryRow[];
  certificateRegister: ShareCertificateRegisterEntry[];
}

export interface ShareAccountDetail {
  account: {
    id: string;
    accountNo: string;
    memberId: string;
    memberNo: string;
    memberName: string;
    membershipType: string;
    totalShares: number;
    totalCapital: number;
    dividendRate: number;
    createdAt: string;
  };
  history: ShareAccountHistoryRow[];
  panels: ShareAccountPanels;
}

const mapHistoryRow = (h: any): ShareAccountHistoryRow => ({
  id: h.id,
  voucherNo: h.voucherNo,
  transactionDateBs: h.transactionDateBs,
  transactionType: h.transactionType,
  shareQuantity: Number(h.shareQuantity ?? 0),
  faceValue: Number(h.faceValue ?? 0),
  debitAmount: Number(h.debitAmount ?? 0),
  creditAmount: Number(h.creditAmount ?? 0),
  balanceAmount: Number(h.balanceAmount ?? 0),
  startKittaNo: h.startKittaNo != null ? Number(h.startKittaNo) : null,
  endKittaNo: h.endKittaNo != null ? Number(h.endKittaNo) : null,
  shareTypeId: h.shareTypeId ?? null,
  shareTypeCode: h.shareTypeCode ?? null,
  shareTypeName: h.shareTypeName ?? null,
  kittaPrefix: h.kittaPrefix ?? '',
  createdAt: h.createdAt,
});

export const fetchShareAccountDetail = async (memberId: string): Promise<ShareAccountDetail | null> => {
  const response = await apiClient.get(`/shares/accounts/${memberId}`);
  const data = response.data;
  if (!isJson(data)) return null;
  return {
    account: {
      id: data.account?.id,
      accountNo: data.account?.accountNo,
      memberId: data.account?.memberId ?? memberId,
      memberNo: data.account?.memberNo,
      memberName: data.account?.memberName,
      membershipType: data.account?.membershipType,
      totalShares: Number(data.account?.totalShares ?? 0),
      totalCapital: Number(data.account?.totalCapital ?? 0),
      dividendRate: Number(data.account?.dividendRate ?? 0),
      createdAt: data.account?.createdAt,
    },
    history: Array.isArray(data.history) ? data.history.map(mapHistoryRow) : [],
    panels: {
      issuances: Array.isArray(data.panels?.issuances) ? data.panels.issuances.map(mapHistoryRow) : [],
      returnsAndTransfers: Array.isArray(data.panels?.returnsAndTransfers)
        ? data.panels.returnsAndTransfers.map(mapHistoryRow)
        : [],
      certificateRegister: Array.isArray(data.panels?.certificateRegister)
        ? data.panels.certificateRegister.map((e: any) => ({
            shareTypeId: e.shareTypeId ?? null,
            shareTypeCode: e.shareTypeCode ?? null,
            shareTypeName: e.shareTypeName ?? null,
            kittaPrefix: e.kittaPrefix ?? '',
            startKittaNo: e.startKittaNo != null ? Number(e.startKittaNo) : null,
            endKittaNo: e.endKittaNo != null ? Number(e.endKittaNo) : null,
            quantity: Number(e.quantity ?? 0),
            formattedRange: e.formattedRange ?? '—',
          }))
        : [],
    },
  };
};

// ============================================
// Org Share Settings (authorized ceilings + running totals)
// ============================================
export interface OrganizationShareSettings {
  id: string;
  organizationId: string;
  authorizedCapitalCeiling: string;
  authorizedTotalKitta: number;
  defaultFaceValue: string;
  minRequiredKitta: number;
  totalIssuedKitta: number;
  totalIssuedCapital: string;
  updatedAt: string;
}

export const fetchOrgShareSettings = async (): Promise<OrganizationShareSettings | null> => {
  const response = await apiClient.get('/shares/settings');
  const data = response.data;
  if (!isJson(data)) return null;
  return {
    id: data.id,
    organizationId: data.organizationId,
    authorizedCapitalCeiling: String(data.authorizedCapitalCeiling ?? '0'),
    authorizedTotalKitta: Number(data.authorizedTotalKitta ?? 0),
    defaultFaceValue: String(data.defaultFaceValue ?? '100.00'),
    minRequiredKitta: Number(data.minRequiredKitta ?? 10),
    totalIssuedKitta: Number(data.totalIssuedKitta ?? 0),
    totalIssuedCapital: String(data.totalIssuedCapital ?? '0.00'),
    updatedAt: data.updatedAt,
  };
};

export const updateOrgShareSettings = async (payload: {
  authorizedCapitalCeiling?: number;
  authorizedTotalKitta?: number;
  defaultFaceValue?: number;
  minRequiredKitta?: number;
}): Promise<OrganizationShareSettings> => {
  const { data } = await apiClient.put<OrganizationShareSettings>('/shares/settings', payload);
  return {
    id: data.id,
    organizationId: data.organizationId,
    authorizedCapitalCeiling: String(data.authorizedCapitalCeiling ?? '0'),
    authorizedTotalKitta: Number(data.authorizedTotalKitta ?? 0),
    defaultFaceValue: String(data.defaultFaceValue ?? '100.00'),
    minRequiredKitta: Number(data.minRequiredKitta ?? 10),
    totalIssuedKitta: Number(data.totalIssuedKitta ?? 0),
    totalIssuedCapital: String(data.totalIssuedCapital ?? '0.00'),
    updatedAt: data.updatedAt,
  };
};

// ============================================
// Mutations
// ============================================
export interface IssueSharesResult {
  holdingId: string;
  memberId: string;
  memberName: string;
  shareType: string;
  numberOfShares: number;
  totalAmount: number;
  voucherNo: string;
  certificateNo: string;
  accountNo?: string;
  wasAutoProvisioned?: boolean;
}

export const issueShares = async (payload: ShareIssuePayload): Promise<IssueSharesResult> => {
  const { data } = await apiClient.post<IssueSharesResult>('/shares/issue', payload);
  return data;
};

export const transferShares = async (payload: ShareTransferPayload): Promise<ShareTransferResult> => {
  const { data } = await apiClient.post('/shares/transfer', payload);
  return {
    ...mapTransfer(data),
    transferId: data.transferId,
    certificateNo: data.certificateNo,
    organization: data.organization,
  };
};

export const surrenderShares = async (holdingId: string, numberOfShares: number, remarks?: string): Promise<any> => {
  const { data } = await apiClient.post(`/shares/holdings/${holdingId}/surrender`, { numberOfShares, remarks });
  return data;
};

// ============================================
// Unified Issue / Return transaction
// ============================================
export type ShareTransactionTypeOption = 'ISSUE' | 'RETURN';

export interface ShareTransactionPayload {
  transactionType: ShareTransactionTypeOption;
  memberId: string;
  shareTypeId: string;
  numberOfShares: number;
  remarks?: string;
  branchId?: string;
  /** Payment/refund COA account chosen by the operator (Dr on ISSUE, Cr on RETURN). */
  paymentAccountId?: string;
  /** Manual kitta range — used (and required) when the share type has autoSequence=false. */
  manualStartKitta?: number | null;
  manualEndKitta?: number | null;
}

export interface ShareTransactionResult {
  holdingId: string;
  voucherId?: string;
  memberId: string;
  memberNo?: string;
  memberName: string;
  shareTypeId?: string;
  shareType: string;
  faceValuePerShare?: number;
  transactionType: ShareTransactionTypeOption;
  numberOfShares: number;
  totalAmount: number;
  voucherNo: string;
  certificateNo?: string | null;
  currentBalance?: number;
  dateBs?: string;
  dateAd?: string;
  accountNo?: string | null;
  wasAutoProvisioned?: boolean;
  kittaStart?: number | null;
  kittaEnd?: number | null;
  entries?: {
    accountId?: string;
    accountCode?: string;
    accountName: string;
    debit: number;
    credit: number;
    narration?: string | null;
  }[];
  organization?: import('../types/coop').OrganizationHeader;
}

export const processShareTransaction = async (payload: ShareTransactionPayload): Promise<ShareTransactionResult> => {
  const { data } = await apiClient.post<ShareTransactionResult>('/shares/transaction', payload);
  return data;
};

/** Current active share balance for a member (optionally per share class), fetched from DB. */
export const fetchMemberShareBalance = async (memberId: string, shareTypeId?: string): Promise<number> => {
  const response = await apiClient.get('/shares/holdings', {
    params: { memberId, shareTypeId, status: 'Active', limit: 100 },
  });
  const data = response.data;
  if (!isJson(data)) return 0;
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.reduce((sum, h: any) => sum + Number(h.numberOfShares ?? 0), 0);
};

// ============================================
// Open Share Account (हकवाला) — first issue + nominee register
// ============================================
export interface UnprovisionedMember {
  id: string;
  memberNo: string;
  fullName: string;
  phone: string | null;
  branchId: string | null;
  branchName: string | null;
  membershipType: string | null;
  createdAt: string;
  defaultNominee: {
    fullName: string | null;
    relationId: string | null;
    relation: string | null;
    phone: string | null;
    citizenshipNo: string | null;
    sharePct: number | null;
  };
}

/** Active members who have not yet opened a share account. */
export const fetchUnprovisionedMembers = async (search?: string): Promise<UnprovisionedMember[]> => {
  const response = await apiClient.get('/shares/unprovisioned-members', {
    params: search ? { search } : {},
  });
  const data = response.data;
  if (!Array.isArray(data)) return [];
  return data.map((m: any) => ({
    id: m.id,
    memberNo: m.memberNo,
    fullName: m.fullName,
    phone: m.phone ?? null,
    branchId: m.branchId ?? null,
    branchName: m.branchName ?? null,
    membershipType: m.membershipType ?? null,
    createdAt: m.createdAt,
    defaultNominee: {
      fullName: m.defaultNominee?.fullName ?? null,
      relationId: m.defaultNominee?.relationId ?? null,
      relation: m.defaultNominee?.relation ?? null,
      phone: m.defaultNominee?.phone ?? null,
      citizenshipNo: m.defaultNominee?.citizenshipNo ?? null,
      sharePct: m.defaultNominee?.sharePct != null ? Number(m.defaultNominee.sharePct) : null,
    },
  }));
};

export interface ShareNomineeRow {
  id: string;
  shareAccountId: string;
  accountNo: string;
  fullName: string;
  relation: string;
  citizenshipNo: string | null;
  contactNo: string | null;
  photoUrl: string | null;
  sharePercentage: number;
  isPrimary: boolean;
  createdAt: string;
}

/** Nominee register for a member's share account. */
export const fetchShareAccountNominees = async (memberId: string): Promise<ShareNomineeRow[]> => {
  const response = await apiClient.get(`/shares/accounts/${memberId}/nominees`);
  const data = response.data;
  if (!Array.isArray(data)) return [];
  return data.map((n: any) => ({
    id: n.id,
    shareAccountId: n.shareAccountId,
    accountNo: n.accountNo,
    fullName: n.fullName,
    relation: n.relation,
    citizenshipNo: n.citizenshipNo ?? null,
    contactNo: n.contactNo ?? null,
    photoUrl: n.photoUrl ?? null,
    sharePercentage: Number(n.sharePercentage ?? 0),
    isPrimary: !!n.isPrimary,
    createdAt: n.createdAt,
  }));
};

export interface ShareNomineeInput {
  fullName: string;
  relation: string;
  citizenshipNo?: string | null;
  contactNo?: string | null;
  photoUrl?: string | null;
  sharePercentage: number;
  isPrimary: boolean;
}

export interface OpenShareAccountPayload {
  memberId: string;
  shareTypeId: string;
  numberOfShares: number;
  remarks?: string;
  branchId?: string;
  /** Payment COA account chosen by the operator (Dr side). Defaults to mapped cash/bank. */
  paymentAccountId?: string;
  manualStartKitta?: number | null;
  manualEndKitta?: number | null;
  minRequiredKitta?: number | null;
  nominees: ShareNomineeInput[];
}

/** Open a member's FIRST share account with a nominee register. */
export const openShareAccount = async (payload: OpenShareAccountPayload): Promise<ShareTransactionResult> => {
  const { data } = await apiClient.post<ShareTransactionResult>('/shares/open-account', payload);
  return data;
};
