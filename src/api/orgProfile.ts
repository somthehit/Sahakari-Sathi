import { apiClient } from '../lib/apiClient';

export interface OrgProfile {
  id: string;
  organizationCode: string;
  organizationName: string;
  shortName: string | null;
  organizationType: string;
  slug: string | null;
  provinceId: string | null;
  districtId: string | null;
  municipalityId: string | null;
  wardNo: number | null;
  address: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
  pan: string | null;
  registrationNo: string | null;
  registrationDate: string | null;
  fiscalYear: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  themeColor: string | null;
  timezone: string | null;
  locale: string | null;
  currencyCode: string | null;
  dateFormat: string | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  trialEnd: string | null;
  isMultiBranch: boolean;
  aiEnabled: boolean;
  aiCredit: number;
  storageLimitMb: number;
  storageUsedMb: number;
  maxMembers: number;
  maxUsers: number;
  maxBranches: number;
  createdAt: string;
}

export interface ProvinceNode {
  id: string;
  code: string;
  name: string;
}

export interface DistrictNode {
  id: string;
  provinceId: string;
  code: string;
  name: string;
}

export interface MunicipalityNode {
  id: string;
  districtId: string;
  name: string;
  type: string;
}

export interface WardNode {
  id: string;
  municipalityId: string;
  wardNo: number;
}

export interface OrgProfileResponse {
  organization: OrgProfile;
  provinces: ProvinceNode[];
  districts: DistrictNode[];
  municipalities: MunicipalityNode[];
  wards: WardNode[];
}

export async function fetchOrgProfile(): Promise<OrgProfileResponse> {
  const { data } = await apiClient.get<OrgProfileResponse>('/org/profile');
  return data;
}

export async function updateOrgProfile(payload: Record<string, any>): Promise<OrgProfile> {
  const { data } = await apiClient.put<{ organization: OrgProfile }>('/org/profile', payload);
  return data.organization;
}
