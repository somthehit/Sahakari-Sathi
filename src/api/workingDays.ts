import { apiClient } from '../lib/apiClient';
import type { WorkingDay } from '../types/coop';

const normalize = (row: any): WorkingDay => ({
  dayOfWeek: Number(row?.dayOfWeek ?? 0),
  isWorkingDay: !!row?.isWorkingDay,
  openTime: row?.openTime ? String(row.openTime).slice(0, 5) : null,
  closeTime: row?.closeTime ? String(row.closeTime).slice(0, 5) : null,
  halfDay: !!row?.halfDay,
});

const sortByDay = (rows: WorkingDay[]): WorkingDay[] => [...rows].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

export const fetchWorkingDays = async (): Promise<WorkingDay[]> => {
  try {
    const { data } = await apiClient.get<WorkingDay[]>('/working-days');
    return Array.isArray(data) ? sortByDay(data.map(normalize)) : [];
  } catch (error: any) {
    console.error('[fetchWorkingDays] failed:', error?.response?.data || error?.message);
    return [];
  }
};

export const saveWorkingDays = async (days: WorkingDay[]): Promise<WorkingDay[]> => {
  const { data } = await apiClient.put<WorkingDay[]>('/working-days', {
    days: days.map(d => ({
      dayOfWeek: d.dayOfWeek,
      isWorkingDay: d.isWorkingDay,
      openTime: d.openTime ?? '',
      closeTime: d.closeTime ?? '',
      halfDay: d.halfDay,
    })),
  });
  return Array.isArray(data) ? sortByDay(data.map(normalize)) : [];
};
