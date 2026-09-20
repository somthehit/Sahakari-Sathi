/**
 * Localization formatting utilities (mirrors the DB `format_nepali_currency`
 * function so UI previews match server output).
 */

export type NumberFormatStyle = 'IN' | 'US';

/** Group digits using Nepali/Indian Lakh-Crore (12,34,567.89) or US (1,234,567.89). */
export function groupDigits(value: number, style: NumberFormatStyle = 'IN'): string {
  if (isNaN(value)) return '0.00';

  const abs = Math.abs(value);
  const intPart = Math.trunc(abs).toString();
  const decPart = (abs - Math.trunc(abs)).toFixed(2).slice(2);

  let grouped: string;
  if (style === 'US') {
    grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  } else {
    // Nepali/Indian: last 3 digits, then 2-digit groups
    if (intPart.length <= 3) {
      grouped = intPart;
    } else {
      const last3 = intPart.slice(-3);
      let rest = intPart.slice(0, -3);
      const groups: string[] = [];
      while (rest.length > 0) {
        groups.unshift(rest.slice(-2));
        rest = rest.slice(0, -2);
      }
      grouped = groups.concat([last3]).join(',');
    }
  }

  const sign = value < 0 ? '-' : '';
  return `${sign}${grouped}.${decPart}`;
}

/** Formats an amount with symbol prefix/suffix, e.g. "रु. 12,34,567.00" or "12,34,567.00 रु.". */
export function formatLocalizedCurrency(
  value: number,
  symbol: string = 'रु.',
  position: 'prefix' | 'suffix' = 'prefix',
  style: NumberFormatStyle = 'IN',
): string {
  const num = groupDigits(value, style);
  return position === 'prefix' ? `${symbol} ${num}` : `${num} ${symbol}`;
}

export const DATE_FORMAT_PREVIEWS: Record<string, { bs: string; ad: string }> = {
  'YYYY-MM-DD': { bs: '2083-04-10', ad: '2026-07-25' },
  'DD-MM-YYYY': { bs: '10-04-2083', ad: '25-07-2026' },
  'MM-DD-YYYY': { bs: '04-10-2083', ad: '07-25-2026' },
  'YYYY/MM/DD': { bs: '2083/04/10', ad: '2026/07/25' },
  'DD/MM/YYYY': { bs: '10/04/2083', ad: '25/07/2026' },
  'MM/DD/YYYY': { bs: '04/10/2083', ad: '07/25/2026' },
  'MMMM D, YYYY': { bs: 'Shrawan 10, 2083', ad: 'July 25, 2026' },
  'DD MMMM, YYYY': { bs: '10 Shrawan, 2083', ad: '25 July, 2026' },
};
