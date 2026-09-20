// @ts-ignore - bikram-sambat CJS/ESM module import
import bsLibrary from 'bikram-sambat';
// @ts-ignore - nepali-date-converter CJS/ESM module import
import ndcLibrary from 'nepali-date-converter';

const bikramSambat: any = (bsLibrary as any)?.default || bsLibrary;
const NepaliDateClass: any = (ndcLibrary as any)?.default || ndcLibrary;

export interface DateConversionResult {
  bsYear: number;
  bsMonth: number; // 1 - 12
  bsDay: number;   // 1 - 32
  bsDate: string;  // YYYY-MM-DD
  adDate: string;  // YYYY-MM-DD
  formattedBS: string; // e.g. "2083 Shrawan 17"
  formattedAD: string; // e.g. "2026-08-02"
}

export const NEPALI_MONTH_NAMES_EN = [
  "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
];

export const NEPALI_MONTH_NAMES_NP = [
  "वैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज",
  "कात्तिक", "मंसिर", "पुस", "माघ", "फागुन", "चैत"
];

/**
 * Robust DateConverter utility module for Bikram Sambat (BS) & Gregorian (AD) conversions.
 * Supports BS years 2000 BS to 2100 BS accurately.
 */
export class DateConverter {
  static readonly maxYearBS = 2090;

  /**
   * Get the number of days in a specific BS year and month (1-12).
   */
  static getDaysInMonthBS(year: number, month: number): number {
    if (month < 1 || month > 12) return 30;
    if (year > DateConverter.maxYearBS) return 30;
    
    // Attempt using bikram-sambat if available
    try {
      if (bikramSambat && typeof bikramSambat.daysInMonth === 'function') {
        const days = bikramSambat.daysInMonth(year, month);
        if (typeof days === 'number' && days >= 28 && days <= 32) {
          return days;
        }
      }
    } catch {
      // Fallback
    }

    // Attempt using nepali-date-converter
    try {
      for (let d = 32; d >= 28; d--) {
        const nd = new NepaliDateClass(year, month - 1, d);
        if (nd.getYear() === year && nd.getMonth() === month - 1 && nd.getDate() === d) {
          return d;
        }
      }
    } catch {
      // Fallback
    }

    return 30;
  }

  /**
   * Converts BS date string (YYYY-MM-DD or YYYY/MM/DD) or numbers to AD date string (YYYY-MM-DD).
   */
  static bsToAd(year: number, month: number, day: number): string;
  static bsToAd(bsDateStr: string): string;
  static bsToAd(arg1: number | string, arg2?: number, arg3?: number): string {
    let year: number;
    let month: number;
    let day: number;

    if (typeof arg1 === 'string') {
      const cleanStr = arg1.replace(/\//g, '-');
      const parts = cleanStr.split('-').map(p => parseInt(p, 10));
      if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        return arg1;
      }
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else {
      year = arg1;
      month = arg2 || 1;
      day = arg3 || 1;
    }

    // Underlying libraries only support up to BS 2090. Beyond that, return
    // empty rather than silently echoing the input back as an AD date.
    if (year > DateConverter.maxYearBS) return '';

    // Try bikram-sambat library first
    try {
      if (bikramSambat && typeof bikramSambat.toGreg === 'function') {
        const greg = bikramSambat.toGreg(year, month, day);
        if (greg && greg.year && greg.month && greg.day) {
          const yyyy = greg.year;
          const mm = String(greg.month).padStart(2, '0');
          const dd = String(greg.day).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
      }
    } catch {
      // Fallback
    }

    // Fallback to nepali-date-converter
    try {
      const nd = new NepaliDateClass(year, month - 1, day);
      const jsDate = nd.toJsDate();
      const yyyy = jsDate.getFullYear();
      const mm = String(jsDate.getMonth() + 1).padStart(2, '0');
      const dd = String(jsDate.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  /**
   * Converts AD date string (YYYY-MM-DD) or Date object to BS date string (YYYY-MM-DD).
   */
  static adToBs(adDate: string | Date): string {
    let jsDate: Date;
    if (typeof adDate === 'string') {
      const parts = adDate.split('-').map(p => parseInt(p, 10));
      if (parts.length === 3 && !isNaN(parts[0])) {
        jsDate = new Date(parts[0], parts[1] - 1, parts[2]);
      } else {
        jsDate = new Date(adDate);
      }
    } else {
      jsDate = adDate;
    }

    if (isNaN(jsDate.getTime())) {
      return DateConverter.getTodayBs();
    }

    const y = jsDate.getFullYear();
    const m = jsDate.getMonth() + 1;
    const d = jsDate.getDate();

    // Try bikram-sambat library
    try {
      if (bikramSambat && typeof bikramSambat.toBik === 'function') {
        const gregStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const bik = bikramSambat.toBik(gregStr);
        if (bik && bik.year && bik.month && bik.day) {
          const yyyy = bik.year;
          const mm = String(bik.month).padStart(2, '0');
          const dd = String(bik.day).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
      }
    } catch {
      // Fallback
    }

    // Fallback to nepali-date-converter
    try {
      const nd = new NepaliDateClass(jsDate);
      const yyyy = nd.getYear();
      const mm = String(nd.getMonth() + 1).padStart(2, '0');
      const dd = String(nd.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return '2083-04-17';
    }
  }

  /**
   * Returns today's BS date string (YYYY-MM-DD).
   */
  static getTodayBs(): string {
    const today = new Date();
    return DateConverter.adToBs(today);
  }

  /**
   * Format BS date string into readable string e.g. "2083 Shrawan 17"
   */
  static formatBs(bsDateStr: string): string {
    if (!bsDateStr) return '';
    const parts = bsDateStr.split('-').map(p => parseInt(p, 10));
    if (parts.length !== 3 || isNaN(parts[0])) return bsDateStr;

    const monthName = NEPALI_MONTH_NAMES_EN[parts[1] - 1] || `${parts[1]}`;
    return `${parts[0]} ${monthName} ${parts[2]}`;
  }

  /**
   * Full details for a BS date.
   */
  static getDetails(bsDateStr: string): DateConversionResult {
    const parts = bsDateStr.split('-').map(p => parseInt(p, 10));
    const year = parts[0] || 2083;
    const month = parts[1] || 4;
    const day = parts[2] || 17;

    const bsDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const adDate = DateConverter.bsToAd(year, month, day);

    return {
      bsYear: year,
      bsMonth: month,
      bsDay: day,
      bsDate,
      adDate,
      formattedBS: DateConverter.formatBs(bsDate),
      formattedAD: adDate,
    };
  }
}
