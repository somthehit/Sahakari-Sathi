import { apiClient } from '../lib/apiClient';
import type { Member } from '../types/coop';

export type MemberInput = Omit<Member, 'id' | 'memberNo' | 'totalSavingsBalance' | 'totalLoanBalance' | 'shareAmount' | 'totalShares'>;

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

/**
 * Sanitize a frontend Member payload for the DB-facing API contract:
 *  - annualIncome (numeric column): strip non-numeric text, keep a clean number.
 *  - dependentsCount / nomineeSharePct: coerce to clean numerics.
 *  - fingerprintData: has no members column; route to the biometrics template URL.
 */
const sanitizePayload = <T extends Record<string, any>>(payload: T): T => {
  const out: Record<string, any> = { ...payload };

  if (out.annualIncome !== undefined && out.annualIncome !== null && out.annualIncome !== '') {
    const n = parseFloat(String(out.annualIncome).replace(/[^\d.-]/g, ''));
    out.annualIncome = Number.isFinite(n) ? String(n) : undefined;
  }
  if (out.dependentsCount !== undefined && out.dependentsCount !== null && out.dependentsCount !== '') {
    const n = Number(out.dependentsCount);
    out.dependentsCount = Number.isFinite(n) ? Math.trunc(n) : undefined;
  }
  if (out.nomineeSharePct !== undefined && out.nomineeSharePct !== null && out.nomineeSharePct !== '') {
    const n = Number(out.nomineeSharePct);
    out.nomineeSharePct = Number.isFinite(n) ? String(n) : undefined;
  }
  if (out.fingerprintData) {
    out.fingerprintTemplateUrl = out.fingerprintData;
  }
  delete out.fingerprintData;

  return out as T;
};

export const normalizeMember = (m: any): Member => ({
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
  occupationId: m.occupationId ? str(m.occupationId) : undefined,
  educationLevelId: m.educationLevelId ? str(m.educationLevelId) : undefined,
  educationLevel: m.educationLevel ? str(m.educationLevel) : undefined,
  nomineeRelationId: m.nomineeRelationId ? str(m.nomineeRelationId) : undefined,
  nomineeTypeId: m.nomineeTypeId ? str(m.nomineeTypeId) : undefined,
  nomineeType: m.nomineeType ? str(m.nomineeType) : undefined,
  memberTypeMinShareUnits: m.memberTypeMinShareUnits !== null && m.memberTypeMinShareUnits !== undefined ? num(m.memberTypeMinShareUnits) : undefined,
  memberTypeEntranceFee: m.memberTypeEntranceFee !== null && m.memberTypeEntranceFee !== undefined ? num(m.memberTypeEntranceFee) : undefined,
  memberTypeShareValuePerUnit: m.memberTypeShareValuePerUnit !== null && m.memberTypeShareValuePerUnit !== undefined ? num(m.memberTypeShareValuePerUnit) : undefined,
  isGroupType: m.isGroupType === null || m.isGroupType === undefined ? undefined : bool(m.isGroupType),
  totalShares: int(m.totalShares),
  shareAmount: num(m.shareAmount),
  totalSavingsBalance: num(m.totalSavingsBalance),
  totalLoanBalance: num(m.totalLoanBalance),
  nomineeName: m.nomineeName ? str(m.nomineeName) : undefined,
  nomineeNameNepali: m.nomineeNameNepali ? str(m.nomineeNameNepali) : undefined,
  nomineeRelation: m.nomineeRelation ? str(m.nomineeRelation) : undefined,
  nomineePhone: m.nomineePhone ? str(m.nomineePhone) : undefined,
  nomineeCitizenshipNo: m.nomineeCitizenshipNo ? str(m.nomineeCitizenshipNo) : undefined,
  nomineeSharePct: m.nomineeSharePct !== null && m.nomineeSharePct !== undefined ? num(m.nomineeSharePct) : undefined,
  citizenshipIssueDistrict: m.citizenshipIssueDistrict ? str(m.citizenshipIssueDistrict) : undefined,
  citizenshipIssueDateBS: m.citizenshipIssueDateBs ? str(m.citizenshipIssueDateBs) : undefined,
  maritalStatus: m.maritalStatus ? (str(m.maritalStatus) as Member['maritalStatus']) : undefined,
  bloodGroup: m.bloodGroup ? str(m.bloodGroup) : undefined,
  isMinor: m.isMinor === null ? undefined : bool(m.isMinor),
  guardianName: m.guardianName ? str(m.guardianName) : undefined,
  guardianNameNepali: m.guardianNameNepali ? str(m.guardianNameNepali) : undefined,
  guardianRelation: m.guardianRelation ? str(m.guardianRelation) : undefined,
  guardianCitizenshipNo: m.guardianCitizenshipNo ? str(m.guardianCitizenshipNo) : undefined,
  guardianPhone: m.guardianPhone ? str(m.guardianPhone) : undefined,
  fatherName: m.fatherName ? str(m.fatherName) : undefined,
  fatherNameNepali: m.fatherNameNepali ? str(m.fatherNameNepali) : undefined,
  motherName: m.motherName ? str(m.motherName) : undefined,
  motherNameNepali: m.motherNameNepali ? str(m.motherNameNepali) : undefined,
  grandfatherName: m.grandfatherName ? str(m.grandfatherName) : undefined,
  grandfatherNameNepali: m.grandfatherNameNepali ? str(m.grandfatherNameNepali) : undefined,
  spouseName: m.spouseName ? str(m.spouseName) : undefined,
  spouseNameNepali: m.spouseNameNepali ? str(m.spouseNameNepali) : undefined,
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
  occupation: m.occupation ? str(m.occupation) : undefined,
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
});

export const createMember = async (payload: MemberInput): Promise<Member> => {
  const { data } = await apiClient.post<Member>('/members', sanitizePayload(payload));
  return normalizeMember(data);
};

export const updateMember = async (id: string, updates: Partial<MemberInput>): Promise<Member> => {
  const { data } = await apiClient.put<Member>(`/members/${id}`, sanitizePayload(updates));
  return normalizeMember(data);
};

export const fetchMembers = async (): Promise<Member[]> => {
  const { data } = await apiClient.get<{ data: any[]; total: number }>('/members');
  return (data?.data || []).map(normalizeMember);
};

export const deleteMember = async (id: string): Promise<void> => {
  await apiClient.delete(`/members/${id}`);
};

export interface MemberDocument {
  id: string;
  memberId: string;
  documentType: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
}

export const fetchMemberDocuments = async (memberId: string): Promise<MemberDocument[]> => {
  const { data } = await apiClient.get<MemberDocument[]>(`/members/${memberId}/documents`);
  return data || [];
};

export const addMemberDocument = async (memberId: string, doc: {
  documentType: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
}): Promise<MemberDocument> => {
  const { data } = await apiClient.post<MemberDocument>(`/members/${memberId}/documents`, doc);
  return data;
};

export const deleteMemberDocument = async (memberId: string, docId: string): Promise<void> => {
  await apiClient.delete(`/members/${memberId}/documents/${docId}`);
};
