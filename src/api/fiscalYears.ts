import { apiClient } from '../lib/apiClient';
import type { FiscalYear } from '../types/coop';

export type FiscalYearInput = Omit<FiscalYear, 'id'>;

export const normalizeFiscalYear = (row: any): FiscalYear => ({
  id: row?.id ?? '',
  code: row?.code ?? '',
  startDateBS: row?.startDateBs ?? row?.startDateBS ?? '',
  endDateBS: row?.endDateBs ?? row?.endDateBS ?? '',
  startDateAD: row?.startDateAd ?? row?.startDateAD ?? '',
  endDateAD: row?.endDateAd ?? row?.endDateAD ?? '',
  isCurrent: !!row?.isCurrent,
  status: (row?.status === 'closed' ? 'closed' : 'active'),
});

export const fetchFiscalYears = async (): Promise<FiscalYear[] | null> => {
  try {
    const { data } = await apiClient.get<FiscalYear[]>('/fiscal-years');
    return Array.isArray(data) ? data.map(normalizeFiscalYear) : [];
  } catch (error: any) {
    console.error('[fetchFiscalYears] failed:', error?.response?.data || error?.message);
    return null;
  }
};

export const createFiscalYear = async (payload: FiscalYearInput): Promise<FiscalYear> => {
  const { data } = await apiClient.post<FiscalYear>('/fiscal-years', payload);
  return normalizeFiscalYear(data);
};

export const updateFiscalYear = async (id: string, payload: Partial<FiscalYearInput>): Promise<FiscalYear> => {
  const { data } = await apiClient.put<FiscalYear>(`/fiscal-years/${id}`, payload);
  return normalizeFiscalYear(data);
};

export const deleteFiscalYear = async (id: string): Promise<void> => {
  await apiClient.delete(`/fiscal-years/${id}`);
};
