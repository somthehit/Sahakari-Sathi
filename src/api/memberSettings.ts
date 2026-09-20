import { apiClient } from '../lib/apiClient';

export type MemberSettingsEntityType =
  | 'member-types'
  | 'member-categories'
  | 'occupations'
  | 'education-levels'
  | 'nominee-types'
  | 'relationship-types'
  | 'member-statuses';

export interface MemberSetting {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  nameNepali: string | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  minShareUnits?: number;
  entranceFee?: number;
  shareValuePerUnit?: number;
  isGroupType?: boolean;
}

const toNum = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : 0;
};

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

const normalizeSetting = (row: any): MemberSetting => ({
  id: str(row.id),
  organizationId: str(row.organizationId),
  code: str(row.code),
  name: str(row.name),
  nameNepali: row.nameNepali ? str(row.nameNepali) : null,
  description: row.description ? str(row.description) : null,
  isActive: row.isActive !== false,
  sortOrder: toInt(row.sortOrder),
  isSystem: row.isSystem === true,
  createdAt: str(row.createdAt),
  updatedAt: str(row.updatedAt),
  usageCount: toInt(row.usageCount),
  ...(row.minShareUnits !== undefined
    ? {
        minShareUnits: toInt(row.minShareUnits),
        entranceFee: toNum(row.entranceFee),
        shareValuePerUnit: toNum(row.shareValuePerUnit),
        isGroupType: row.isGroupType === true,
      }
    : {}),
});

/**
 * Fetch a member settings catalog for the active organization. Falls back to
 * an empty list on failure so registration forms render with their defaults.
 */
export const fetchMemberSettings = async (
  entityType: MemberSettingsEntityType,
  params: { search?: string; active?: string } = {},
): Promise<MemberSetting[]> => {
  try {
    const { data } = await apiClient.get<MemberSetting[]>(`/member-settings/${entityType}`, { params });
    return Array.isArray(data) ? data.map(normalizeSetting) : [];
  } catch (error: any) {
    console.error(`[fetchMemberSettings:${entityType}] failed:`, error?.response?.data || error?.message);
    return [];
  }
};
