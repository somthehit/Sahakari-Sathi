import { apiClient } from '../lib/apiClient';
import type { PassbookLayoutConfig } from '../utils/passbookLayout';

export type PassbookDesignMode = 'booklet' | 'a4' | 'thermal';

/** A saved passbook print layout row as returned by the API. */
export interface PassbookDesignRecord {
  id: string;
  organizationId?: string;
  branchId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  mode: PassbookDesignMode;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  widthMm: string | number;
  heightMm: string | number;
  /** Parsed layout geometry (server returns `config`; `configJson` is the raw string). */
  config?: PassbookLayoutConfig | null;
  configJson?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PassbookDesignPayload {
  code: string;
  name: string;
  description?: string | null;
  mode?: PassbookDesignMode;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  widthMm: number;
  heightMm: number;
  configJson: PassbookLayoutConfig;
  branchId?: string | null;
}

export const fetchPassbookDesigns = async (includeInactive = false): Promise<PassbookDesignRecord[]> => {
  const { data } = await apiClient.get('/passbook-designs', {
    params: includeInactive ? { includeInactive: 'true' } : undefined,
  });
  return Array.isArray(data) ? data : [];
};

export const fetchPassbookDesign = async (id: string): Promise<PassbookDesignRecord> => {
  const { data } = await apiClient.get(`/passbook-designs/${id}`);
  return data;
};

export const createPassbookDesign = async (payload: PassbookDesignPayload): Promise<PassbookDesignRecord> => {
  const { data } = await apiClient.post('/passbook-designs', payload);
  return data;
};

export const updatePassbookDesign = async (
  id: string,
  payload: Partial<PassbookDesignPayload>,
): Promise<PassbookDesignRecord> => {
  const { data } = await apiClient.put(`/passbook-designs/${id}`, payload);
  return data;
};

export const deletePassbookDesign = async (id: string): Promise<void> => {
  await apiClient.delete(`/passbook-designs/${id}`);
};
