import { apiClient } from '../lib/apiClient';
import type { Department } from '../types/coop';

export type DepartmentInput = Omit<Department, 'id' | 'createdAtBS'>;

const toNum = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

const normalizeDepartment = (row: any): Department => ({
  id: row?.id ?? '',
  code: row?.code ?? '',
  name: row?.name ?? '',
  headOfDepartment: row?.headOfDepartment ?? '',
  branchId: row?.branchId ?? '',
  staffCount: toNum(row?.staffCount),
  budgetAllocation: toNum(row?.budgetAllocation),
  usedBudget: toNum(row?.usedBudget),
  description: row?.description ?? '',
  costCenterCode: row?.costCenterCode ?? '',
  status: (row?.status === 'Inactive' ? 'Inactive' : 'Active'),
  createdAtBS: row?.createdAtBS ?? '',
});

export const fetchDepartments = async (): Promise<Department[]> => {
  try {
    const { data } = await apiClient.get<Department[]>('/departments');
    return Array.isArray(data) ? data.map(normalizeDepartment) : [];
  } catch (error: any) {
    console.error('[fetchDepartments] failed:', error?.response?.data || error?.message);
    return [];
  }
};

export const createDepartment = async (payload: DepartmentInput): Promise<Department> => {
  const { data } = await apiClient.post<Department>('/departments', payload);
  return normalizeDepartment(data);
};

export const updateDepartment = async (id: string, payload: Partial<DepartmentInput>): Promise<Department> => {
  const { data } = await apiClient.put<Department>(`/departments/${id}`, payload);
  return normalizeDepartment(data);
};

export const deleteDepartment = async (id: string): Promise<void> => {
  await apiClient.delete(`/departments/${id}`);
};
