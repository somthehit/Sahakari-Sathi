import { apiClient } from '../lib/apiClient';
import type { ChequeDesignConfig } from '../components/cheque/ChequeLeafCanvas';

/** A saved cheque leaf design row as returned by the API. */
export interface ChequeDesignRecord {
  id: string;
  organizationId?: string;
  branchId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  widthMm: string | number;
  heightMm: string | number;
  /** Parsed visual layout (server returns `config`; `configJson` is the raw string). */
  config?: ChequeDesignConfig | null;
  configJson?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChequeDesignPayload {
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  widthMm: number;
  heightMm: number;
  configJson: ChequeDesignConfig;
  branchId?: string | null;
}

export const fetchChequeDesigns = async (includeInactive = false): Promise<ChequeDesignRecord[]> => {
  const { data } = await apiClient.get('/cheque-designs', {
    params: includeInactive ? { includeInactive: 'true' } : undefined,
  });
  return Array.isArray(data) ? data : [];
};

export const fetchChequeDesign = async (id: string): Promise<ChequeDesignRecord> => {
  const { data } = await apiClient.get(`/cheque-designs/${id}`);
  return data;
};

export const createChequeDesign = async (payload: ChequeDesignPayload): Promise<ChequeDesignRecord> => {
  const { data } = await apiClient.post('/cheque-designs', payload);
  return data;
};

export const updateChequeDesign = async (
  id: string,
  payload: Partial<ChequeDesignPayload>,
): Promise<ChequeDesignRecord> => {
  const { data } = await apiClient.put(`/cheque-designs/${id}`, payload);
  return data;
};

export const deleteChequeDesign = async (id: string): Promise<void> => {
  await apiClient.delete(`/cheque-designs/${id}`);
};
