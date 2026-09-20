import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  fetchLocalizationSettings,
  updateLocalizationSettings,
  DEFAULT_LOCALIZATION,
  type LocalizationSettings,
  type LocalizationSettingsPatch,
  type DefaultLanguage,
} from '../api/localization';
import { createTranslator, type LangCode } from '../i18n';
import { transliterateToNepali } from '../utils/transliterate';
import { groupDigits, formatLocalizedCurrency } from '../utils/localization';
import { getTodayBS, getTodayADFormatted } from '../utils/nepaliCalendar';

interface LocalizationContextValue {
  /** Raw settings persisted to the backend. */
  settings: LocalizationSettings;
  /** Active UI language. */
  lang: LangCode;
  /** True while the initial fetch from the server is in-flight. */
  isLoading: boolean;
  /** Translate an English key into the active language. */
  t: (key: string) => string;
  /** Set the UI language (persists via PATCH). */
  setLanguage: (lang: DefaultLanguage) => Promise<void>;
  /** Persist any subset of localization settings. */
  saveSettings: (patch: LocalizationSettingsPatch) => Promise<void>;
  /** Apply settings in-memory immediately (no server call) — used after the
   *  setup screen has already persisted, so the whole UI reacts without reload. */
  applySettings: (patch: LocalizationSettingsPatch) => void;
  /** Nepali name transliteration helper (no-op when disabled). */
  transliterateName: (englishName: string) => string;
  /** Group digits using the configured style (IN lakh/crore or US). */
  formatNumber: (value: number) => string;
  /** Format an amount with the configured symbol + position + grouping. */
  formatCurrency: (value: number) => string;
  /** Format a date string according to calendar system + display format. */
  formatDate: (value?: string | null) => string;
}

const LocalizationContext = createContext<LocalizationContextValue | undefined>(undefined);

const EMPTY_SETTINGS: LocalizationSettings = {
  organizationId: '',
  defaultLanguage: 'ne',
  supportedLanguages: ['ne', 'en'],
  primaryCalendarSystem: 'BS',
  dateDisplayFormat: 'YYYY-MM-DD',
  numberFormatStyle: 'IN',
  currencySymbol: 'रु.',
  currencySymbolPosition: 'prefix',
  enableAutoTransliteration: false,
};

/** Reorders a date string into a target display format. Supports YYYY/MM/DD tokens. */
function reformatDate(dateStr: string, format: string, lang: LangCode): string {
  if (!dateStr) return '';
  // Accept both YYYY-MM-DD and YYYY/MM/DD and MM/DD/YYYY-ish inputs.
  const parts = dateStr.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!parts) return dateStr;
  const [, y, m, d] = parts;
  const monNames = lang === 'ne'
    ? ['', 'बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज', 'कात्तिक', 'मंसिर', 'पुष', 'माघ', 'फागुन', 'चैत']
    : ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const mon = monNames[Number(m)] || m;

  const tokens: Record<string, string> = {
    YYYY: y,
    MM: m,
    DD: d,
    MMMM: mon,
  };
  return format
    .replace(/MMMM/g, tokens.MMMM)
    .replace(/YYYY/g, tokens.YYYY)
    .replace(/MM/g, tokens.MM)
    .replace(/DD/g, tokens.DD);
}

export const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<LocalizationSettings>(EMPTY_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings once on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const fetched = await fetchLocalizationSettings();
        if (active && fetched) {
          setSettings(prev => ({ ...DEFAULT_LOCALIZATION, ...prev, ...fetched }));
        } else if (active) {
          setSettings(prev => ({ ...DEFAULT_LOCALIZATION, ...prev }));
        }
      } catch {
        if (active) setSettings(prev => ({ ...DEFAULT_LOCALIZATION, ...prev }));
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const lang: LangCode = settings.defaultLanguage === 'en' ? 'en' : 'ne';

  const t = useCallback((key: string) => {
    const fn = createTranslator(lang);
    return fn(key);
  }, [lang]);

  const setLanguage = useCallback(async (lng: DefaultLanguage) => {
    setSettings(prev => ({ ...prev, defaultLanguage: lng }));
    try {
      await updateLocalizationSettings({ defaultLanguage: lng });
    } catch (e) {
      console.error('[LocalizationContext] setLanguage failed:', e);
    }
  }, []);

  const saveSettings = useCallback(async (patch: LocalizationSettingsPatch) => {
    setSettings(prev => ({ ...prev, ...patch }));
    try {
      await updateLocalizationSettings(patch);
    } catch (e) {
      console.error('[LocalizationContext] saveSettings failed:', e);
    }
  }, []);

  const applySettings = useCallback((patch: LocalizationSettingsPatch) => {
    setSettings(prev => ({ ...prev, ...patch }));
  }, []);

  const transliterateName = useCallback((englishName: string) => {
    if (!settings.enableAutoTransliteration) return englishName;
    return transliterateToNepali(englishName);
  }, [settings.enableAutoTransliteration]);

  const formatNumber = useCallback((value: number) => {
    return groupDigits(value, settings.numberFormatStyle);
  }, [settings.numberFormatStyle]);

  const formatCurrency = useCallback((value: number) => {
    return formatLocalizedCurrency(
      value,
      settings.currencySymbol,
      settings.currencySymbolPosition,
      settings.numberFormatStyle,
    );
  }, [settings.currencySymbol, settings.currencySymbolPosition, settings.numberFormatStyle]);

  const formatDate = useCallback((value?: string | null) => {
    if (!value) return '';
    const { primaryCalendarSystem, dateDisplayFormat } = settings;
    const source = primaryCalendarSystem === 'BS' ? getTodayBS() : getTodayADFormatted();
    // If caller supplies a value in the active calendar, reformat directly.
    if (value) {
      return reformatDate(value, dateDisplayFormat, lang);
    }
    return reformatDate(source, dateDisplayFormat, lang);
  }, [settings.primaryCalendarSystem, settings.dateDisplayFormat, lang]);

  const value = useMemo<LocalizationContextValue>(() => ({
    settings,
    lang,
    isLoading,
    t,
    setLanguage,
    saveSettings,
    applySettings,
    transliterateName,
    formatNumber,
    formatCurrency,
    formatDate,
  }), [settings, lang, isLoading, t, setLanguage, saveSettings, applySettings, transliterateName, formatNumber, formatCurrency, formatDate]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
};

export function useLocalization(): LocalizationContextValue {
  const ctx = useContext(LocalizationContext);
  if (!ctx) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return ctx;
}
