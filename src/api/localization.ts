import { apiClient } from '../lib/apiClient';

export type DefaultLanguage = 'ne' | 'en';
export type CalendarSystem = 'BS' | 'AD';
export type NumberFormatStyle = 'IN' | 'US';
export type CurrencySymbolPosition = 'prefix' | 'suffix';

export interface LocalizationSettings {
  organizationId: string;
  defaultLanguage: DefaultLanguage;
  supportedLanguages: DefaultLanguage[];
  primaryCalendarSystem: CalendarSystem;
  dateDisplayFormat: string;
  numberFormatStyle: NumberFormatStyle;
  currencySymbol: string;
  currencySymbolPosition: CurrencySymbolPosition;
  enableAutoTransliteration: boolean;
}

export type LocalizationSettingsPatch = Partial<Omit<LocalizationSettings, 'organizationId'>>;

export const DEFAULT_LOCALIZATION: Omit<LocalizationSettings, 'organizationId'> = {
  defaultLanguage: 'ne',
  supportedLanguages: ['ne', 'en'],
  primaryCalendarSystem: 'BS',
  dateDisplayFormat: 'YYYY-MM-DD',
  numberFormatStyle: 'IN',
  currencySymbol: 'रु.',
  currencySymbolPosition: 'prefix',
  enableAutoTransliteration: false,
};

export const fetchLocalizationSettings = async (): Promise<LocalizationSettings | null> => {
  try {
    const { data } = await apiClient.get<LocalizationSettings>('/org/localization-settings');
    return data;
  } catch (error: any) {
    console.error('[fetchLocalizationSettings] failed:', error?.response?.data || error?.message);
    return null;
  }
};

export const updateLocalizationSettings = async (payload: LocalizationSettingsPatch): Promise<LocalizationSettings> => {
  const { data } = await apiClient.patch<LocalizationSettings>('/org/localization-settings', payload);
  return data;
};
