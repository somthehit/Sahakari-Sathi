import { apiClient } from '../lib/apiClient';
import type { Branch } from '../types/coop';

export type BranchInput = Omit<Branch, 'id'>;

// DB numeric columns come back as strings; normalize for the frontend types.
const toNum = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

const normalizeBranch = (row: any): Branch => ({
  ...row,
  vaultLimit: toNum(row?.vaultLimit),
  currentVaultCash: toNum(row?.currentVaultCash),
  latitude: row?.latitude === null || row?.latitude === undefined ? undefined : toNum(row.latitude),
  longitude: row?.longitude === null || row?.longitude === undefined ? undefined : toNum(row.longitude),
});

export const fetchBranches = async (): Promise<Branch[]> => {
  try {
    const { data } = await apiClient.get<Branch[]>('/branches');
    return Array.isArray(data) ? data.map(normalizeBranch) : [];
  } catch (error: any) {
    console.error('[fetchBranches] failed:', error?.response?.data || error?.message);
    return [];
  }
};

export const fetchBranch = async (id: string): Promise<Branch> => {
  const { data } = await apiClient.get<Branch>(`/branches/${id}`);
  return normalizeBranch(data);
};

export const createBranch = async (payload: BranchInput): Promise<Branch> => {
  const { data } = await apiClient.post<Branch>('/branches', payload);
  return normalizeBranch(data);
};

export const updateBranch = async (id: string, payload: Partial<BranchInput>): Promise<Branch> => {
  const { data } = await apiClient.put<Branch>(`/branches/${id}`, payload);
  return normalizeBranch(data);
};

/** Deactivate a branch (server blocks while it still has live dependents). */
export const deactivateBranch = async (id: string): Promise<Branch> => {
  const { data } = await apiClient.post<Branch>(`/branches/${id}/deactivate`);
  return normalizeBranch(data);
};
