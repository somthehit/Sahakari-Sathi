import { apiClient } from '../lib/apiClient';
import type { Designation } from '../types/coop';

export type DesignationInput = Omit<Designation, 'id'>;

const toNum = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};

const toStr = (v: unknown): string | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  return String(v);
};

const normalizeDesignation = (row: any): Designation => ({
  id: row?.id ?? '',
  departmentId: row?.departmentId ?? '',
  name: row?.name ?? '',
  code: toStr(row?.code),
  reportsToId: toStr(row?.reportsToId),
  jobGrade: toStr(row?.jobGrade),
  minSalary: toNum(row?.minSalary),
  maxSalary: toNum(row?.maxSalary),
  allowanceEligible: !!row?.allowanceEligible,
  approvalLimit: toNum(row?.approvalLimit),
  systemAccessRole: toStr(row?.systemAccessRole),
  pearlsRole: toStr(row?.pearlsRole),
  employmentType: toStr(row?.employmentType),
  description: toStr(row?.description),
  status: (row?.status === 'Inactive' ? 'Inactive' : 'Active'),
});

export const fetchDesignations = async (departmentId?: string): Promise<Designation[]> => {
  try {
    const url = departmentId ? `/departments/${departmentId}/designations` : '/designations';
    const { data } = await apiClient.get<Designation[]>(url);
    return Array.isArray(data) ? data.map(normalizeDesignation) : [];
  } catch (error: any) {
    console.error('[fetchDesignations] failed:', error?.response?.data || error?.message);
    return [];
  }
};

export const createDesignation = async (
  departmentId: string,
  payload: Omit<DesignationInput, 'departmentId'>
): Promise<Designation> => {
  const { data } = await apiClient.post<Designation>(`/departments/${departmentId}/designations`, payload);
  return normalizeDesignation(data);
};

export const updateDesignation = async (id: string, payload: Partial<DesignationInput>): Promise<Designation> => {
  const { data } = await apiClient.put<Designation>(`/designations/${id}`, payload);
  return normalizeDesignation(data);
};

export const deleteDesignation = async (id: string): Promise<void> => {
  await apiClient.delete(`/designations/${id}`);
};
