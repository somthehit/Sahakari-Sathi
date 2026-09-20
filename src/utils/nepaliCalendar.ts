import { DateConverter, NEPALI_MONTH_NAMES_EN, NEPALI_MONTH_NAMES_NP } from './DateConverter';

export { DateConverter };

export function getTodayBS(): string {
  return DateConverter.getTodayBs();
}

export function getTodayBSFormatted(): string {
  const bsDate = getTodayBS();
  return `${DateConverter.formatBs(bsDate)} BS`;
}

export function getTodayADFormatted(): string {
  const today = new Date();
  const year = today.getFullYear();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const month = monthNames[today.getMonth()];
  const day = today.getDate();
  return `${year} ${month} ${day} AD`;
}

/**
 * Returns the current fiscal year code (e.g. "2086/87") based on today's
 * BS date. The Nepali fiscal year runs from BS 04-01 of a year to BS 03-31
 * of the following year, so dates from 04-01 → 12-31 belong to year Y and
 * dates from 01-01 → 03-31 belong to the previous year Y-1.
 */
export function getCurrentFiscalYearCode(): string {
  const todayBS = getTodayBS(); // "YYYY-MM-DD" in BS
  const year = parseInt(todayBS.slice(0, 4), 10);
  const month = parseInt(todayBS.slice(5, 7), 10);
  if (isNaN(year) || isNaN(month)) return "2083/84";
  const fyStart = month >= 4 ? year : year - 1;
  return `${fyStart}/${String((fyStart + 1) % 100).padStart(2, '0')}`;
}

export const NEPALI_MONTHS = NEPALI_MONTH_NAMES_EN;
export const NEPALI_MONTHS_NP = NEPALI_MONTH_NAMES_NP;

export function getDaysInBSMonth(year: number, month: number): number {
  return DateConverter.getDaysInMonthBS(year, month);
}

/**
 * Converts YYYY-MM-DD BS string to YYYY-MM-DD AD string
 */
export function convertBSToAD(bsDateStr: string): string {
  return DateConverter.bsToAd(bsDateStr);
}

/**
 * Converts YYYY-MM-DD AD string to YYYY-MM-DD BS string
 */
export function convertADToBS(adDateStr: string): string {
  return DateConverter.adToBs(adDateStr);
}

export function formatBSDate(bsDateStr: string): string {
  return DateConverter.formatBs(bsDateStr);
}

export function addDaysBS(bsDateStr: string, days: number): string {
  const parts = bsDateStr.split("-").map(p => parseInt(p, 10));
  if (parts.length !== 3 || isNaN(parts[0])) return bsDateStr;
  
  const adStr = convertBSToAD(bsDateStr);
  const adParts = adStr.split("-").map(p => parseInt(p, 10));
  if (adParts.length === 3 && !isNaN(adParts[0])) {
    const d = new Date(adParts[0], adParts[1] - 1, adParts[2]);
    d.setDate(d.getDate() + days);
    return convertADToBS(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return bsDateStr;
}

export function formatNPR(amount: number): string {
  if (isNaN(amount)) return "रु. 0.00";
  return new Intl.NumberFormat("ne-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 2,
  }).format(amount).replace("NPR", "रु.");
}

export function formatNumber(amount: number): string {
  if (isNaN(amount)) return "0";
  return new Intl.NumberFormat("ne-NP", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(amount);
}

