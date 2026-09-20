/**
 * i18n entry: exposes the active language's translate function.
 * Currently only English (fallback to literal key) and Nepali are supported.
 */
import { translateNe, type LangCode } from './ne';

export type { LangCode };

export function createTranslator(lang: LangCode) {
  if (lang === 'ne') return translateNe;
  return (key: string): string => key;
}

export const t = createTranslator('en');
