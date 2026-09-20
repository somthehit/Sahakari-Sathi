import { apiClient } from '../lib/apiClient';

export interface ExchangeRateRow {
  id: string;
  organizationId: string;
  baseCurrency: string;
  targetCurrency: string;
  buyRate: string;
  sellRate: string;
  officialMiddleRate: string;
  effectiveDate: string;
  createdAt: string;
}

export interface FinancialSettings {
  organizationId: string;
  defaultCurrency: 'NPR' | 'USD';
  allowedCurrencies: string[];
  defaultForexMarkupPercent: string;
  isTaxEnabled: boolean;
  taxName: string;
  defaultTaxRatePercent: string;
  taxNumber: string | null;
  /** True once the org has financial transactions; base currency becomes immutable. */
  baseCurrencyLocked?: boolean;
}

export interface SyncLatestResult {
  rate: ExchangeRateRow;
  settings: FinancialSettings;
  source: string;
}

export const fetchExchangeRates = async (): Promise<ExchangeRateRow[]> => {
  const { data } = await apiClient.get<ExchangeRateRow[]>('/exchange-rates');
  return Array.isArray(data) ? data : [];
};

export const syncLatestExchangeRate = async (): Promise<SyncLatestResult> => {
  const { data } = await apiClient.post<SyncLatestResult>('/exchange-rates/sync');
  return data;
};

export const createExchangeRate = async (payload: Partial<ExchangeRateRow>): Promise<ExchangeRateRow> => {
  const { data } = await apiClient.post<ExchangeRateRow>('/exchange-rates', payload);
  return data;
};

export const fetchFinancialSettings = async (): Promise<FinancialSettings | null> => {
  try {
    const { data } = await apiClient.get<FinancialSettings>('/org/financial-settings');
    return data;
  } catch (error: any) {
    console.error('[fetchFinancialSettings] failed:', error?.response?.data || error?.message);
    return null;
  }
};

export const updateFinancialSettings = async (payload: Partial<FinancialSettings>): Promise<FinancialSettings> => {
  const { data } = await apiClient.put<FinancialSettings>('/org/financial-settings', payload);
  return data;
};
