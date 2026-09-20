/**
 * Groups API client (Member Settings — operational community groups).
 * Mirrors the CRUD + normalization pattern of the other settings clients.
 * `maxMembers`/`meetingDayOfMonth` are numbers; empty string means "unset".
 */
import { apiClient } from '../lib/apiClient';

export interface Group {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  nameNepali: string | null;
  address: string | null;
  chairpersonName: string | null;
  chairpersonContact: string | null;
  chairpersonAddress: string | null;
  contactPersonName: string | null;
  contactPersonPhone: string | null;
  meetingDayOfMonth: number | null;
  meetingTime: string | null;
  meetingPlace: string | null;
  maxMembers: number | null;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export type GroupInput = Omit<
  Group,
  'id' | 'organizationId' | 'isSystem' | 'createdAt' | 'updatedAt'
>;

const toNumOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const strOrNull = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
};

const normalizeGroup = (row: any): Group => ({
  id: row?.id ?? '',
  organizationId: row?.organizationId ?? '',
  code: row?.code ?? '',
  name: row?.name ?? '',
  nameNepali: strOrNull(row?.nameNepali),
  address: strOrNull(row?.address),
  chairpersonName: strOrNull(row?.chairpersonName),
  chairpersonContact: strOrNull(row?.chairpersonContact),
  chairpersonAddress: strOrNull(row?.chairpersonAddress),
  contactPersonName: strOrNull(row?.contactPersonName),
  contactPersonPhone: strOrNull(row?.contactPersonPhone),
  meetingDayOfMonth: toNumOrNull(row?.meetingDayOfMonth),
  meetingTime: strOrNull(row?.meetingTime),
  meetingPlace: strOrNull(row?.meetingPlace),
  maxMembers: toNumOrNull(row?.maxMembers),
  isActive: row?.isActive !== false,
  isSystem: row?.isSystem === true,
  createdAt: row?.createdAt ?? '',
  updatedAt: row?.updatedAt ?? '',
});

export const fetchGroups = async (params: { search?: string; active?: string } = {}): Promise<Group[]> => {
  try {
    const { data } = await apiClient.get<Group[]>('/groups', { params });
    return Array.isArray(data) ? data.map(normalizeGroup) : [];
  } catch (error: any) {
    console.error('[fetchGroups] failed:', error?.response?.data || error?.message);
    return [];
  }
};

export const createGroup = async (payload: GroupInput): Promise<Group> => {
  const { data } = await apiClient.post<Group>('/groups', payload);
  return normalizeGroup(data);
};

export const updateGroup = async (id: string, payload: Partial<GroupInput>): Promise<Group> => {
  const { data } = await apiClient.put<Group>(`/groups/${id}`, payload);
  return normalizeGroup(data);
};

export const deleteGroup = async (id: string): Promise<void> => {
  await apiClient.delete(`/groups/${id}`);
};
