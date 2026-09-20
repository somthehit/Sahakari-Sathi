import type { ChequeDesignConfig } from '../components/cheque/ChequeLeafCanvas';

/**
 * Cheque leaf tag engine — mirrors certificateTagEngine but for cheque
 * stationery. A design stores {curly} tokens in each field template; at
 * render/print time we resolve them against a live (or sample) cheque context.
 */

export interface ChequeTag {
  tag: string;
  labelNp: string;
  labelEn: string;
  category: 'party' | 'amount' | 'meta' | 'bank';
  exampleValue: string;
  description: string;
}

export interface ChequeTagContext {
  config: ChequeDesignConfig;
  payeeName: string;
  amountFigures: number | string;
  dateBs: string;
  dateAd: string;
  accountNo: string;
  accountName: string;
  chequeNumber: string;
  micrCode?: string;
  branchName?: string;
}

export const AVAILABLE_CHEQUE_TAGS: ChequeTag[] = [
  // Party / payee
  {
    tag: '{payee_name}',
    labelNp: 'भुक्तानी पाउनेको नाम',
    labelEn: 'Payee Name',
    category: 'party',
    exampleValue: 'राम बहादुर श्रेष्ठ',
    description: 'Name of the person / party the cheque is payable to',
  },
  {
    tag: '{or_bearer}',
    labelNp: 'वा वाहक',
    labelEn: 'or Bearer',
    category: 'party',
    exampleValue: 'वा वाहकलाई / or Bearer',
    description: 'The "or Bearer" trailing text on the pay line',
  },
  {
    tag: '{account_name}',
    labelNp: 'खाताको नाम',
    labelEn: 'Account Name',
    category: 'party',
    exampleValue: 'सीता देवी',
    description: 'Registered name on the drawing savings account',
  },
  {
    tag: '{account_no}',
    labelNp: 'खाता नम्बर',
    labelEn: 'Account No.',
    category: 'party',
    exampleValue: '001-0100-0000123',
    description: 'Drawing account number',
  },

  // Amount
  {
    tag: '{amount_figures}',
    labelNp: 'रकम (अंकमा)',
    labelEn: 'Amount (Figures)',
    category: 'amount',
    exampleValue: '=५,०००.००=',
    description: 'Cheque amount in digits, comma-grouped',
  },
  {
    tag: '{amount_words}',
    labelNp: 'रकम (अक्षरमा)',
    labelEn: 'Amount (Words, English)',
    category: 'amount',
    exampleValue: 'Five Thousand Rupees Only',
    description: 'Cheque amount spelled out in English',
  },
  {
    tag: '{amount_words_np}',
    labelNp: 'रकम अक्षरमा (नेपाली)',
    labelEn: 'Amount (Words, Nepali)',
    category: 'amount',
    exampleValue: 'पाँच हजार रुपैयाँ मात्र',
    description: 'Cheque amount spelled out in Nepali',
  },

  // Meta
  {
    tag: '{cheque_number}',
    labelNp: 'चेक नम्बर',
    labelEn: 'Cheque No.',
    category: 'meta',
    exampleValue: 'CHQ-100234',
    description: 'The leaf cheque number',
  },
  {
    tag: '{date_bs}',
    labelNp: 'मिति (बि.सं.)',
    labelEn: 'Date (BS)',
    category: 'meta',
    exampleValue: '२०८३-०४-१५',
    description: 'Cheque date in Bikram Sambat',
  },
  {
    tag: '{date_ad}',
    labelNp: 'मिति (ई.सं.)',
    labelEn: 'Date (AD)',
    category: 'meta',
    exampleValue: '2026-07-31',
    description: 'Cheque date in the Gregorian calendar',
  },
  {
    tag: '{date_boxes}',
    labelNp: 'मिति (D D M M Y Y Y Y)',
    labelEn: 'Date (spaced boxes)',
    category: 'meta',
    exampleValue: '3 1 0 7 2 0 2 6',
    description: 'AD date spread into single-character boxes (DDMMYYYY)',
  },
  {
    tag: '{date_boxes_bs}',
    labelNp: 'मिति बाकसमा (YYYY MM DD)',
    labelEn: 'Date boxes (BS)',
    category: 'meta',
    exampleValue: '2 0 8 3 0 4 1 5',
    description: 'BS date spread into single-digit boxes (YYYYMMDD, Latin numerals)',
  },

  // Bank / institution
  {
    tag: '{bank_name_np}',
    labelNp: 'संस्थाको नाम (नेपाली)',
    labelEn: 'Institution Name (Nepali)',
    category: 'bank',
    exampleValue: 'साझा सहकारी संस्था लि.',
    description: 'Cooperative / institution name in Nepali',
  },
  {
    tag: '{bank_name_en}',
    labelNp: 'संस्थाको नाम (अंग्रेजी)',
    labelEn: 'Institution Name (English)',
    category: 'bank',
    exampleValue: 'Sajha Co-operative Ltd.',
    description: 'Cooperative / institution name in English',
  },
  {
    tag: '{branch_name}',
    labelNp: 'शाखा',
    labelEn: 'Branch',
    category: 'bank',
    exampleValue: 'कोटेश्वर शाखा',
    description: 'Issuing branch name',
  },
  {
    tag: '{micr_code}',
    labelNp: 'MICR कोड',
    labelEn: 'MICR Code',
    category: 'bank',
    exampleValue: '977001234',
    description: 'MICR / clearing code printed in the code line',
  },
];

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? ' ' + ONES[o] : '');
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(ONES[h] + ' Hundred');
  if (rest) parts.push(twoDigits(rest));
  return parts.join(' ');
}

/**
 * Convert a number to English words using the South-Asian lakh/crore grouping
 * (as used on Nepali cheques). Renders "Rupees … [and … Paisa] Only".
 */
export function numberToEnglishWords(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num == null || isNaN(num)) return 'Rupees Zero Only';

  const rounded = Math.round(Math.abs(num) * 100) / 100;
  const rupees = Math.floor(rounded);
  const paisa = Math.round((rounded - rupees) * 100);

  const spellInteger = (n: number): string => {
    if (n === 0) return 'Zero';
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const belowThousand = n % 1000;
    const out: string[] = [];
    if (crore) out.push(spellInteger(crore) + ' Crore');
    if (lakh) out.push(twoDigits(lakh) + ' Lakh');
    if (thousand) out.push(twoDigits(thousand) + ' Thousand');
    if (belowThousand) out.push(threeDigits(belowThousand));
    return out.join(' ').trim();
  };

  let words = `Rupees ${spellInteger(rupees)}`;
  if (paisa > 0) words += ` and ${twoDigits(paisa)} Paisa`;
  words += ' Only';
  return words.replace(/\s+/g, ' ').trim();
}

/** Format an amount in figures with lakh/crore comma grouping and 2 decimals. */
export function formatChequeFigures(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num == null || isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Very light Nepali amount-in-words (round-number lookup, else localized digits). */
function numberToNepaliWords(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!num || isNaN(num)) return 'शून्य रुपैयाँ मात्र';
  const exact: Record<number, string> = {
    100: 'एक सय', 500: 'पाँच सय', 1000: 'एक हजार', 5000: 'पाँच हजार',
    10000: 'दश हजार', 50000: 'पचास हजार', 100000: 'एक लाख',
  };
  if (exact[num]) return `${exact[num]} रुपैयाँ मात्र`;
  return `${num.toLocaleString('ne-NP')} रुपैयाँ मात्र`;
}

/** Spread an AD date (YYYY-MM-DD) into spaced DDMMYYYY characters for date boxes. */
function dateToBoxes(dateAd: string): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(dateAd || '');
  if (!m) return '';
  const [, y, mo, d] = m;
  const digits = `${d.padStart(2, '0')}${mo.padStart(2, '0')}${y}`;
  return digits.split('').join(' ');
}

/** Devanagari digit → Latin digit (०..९ → 0..9). */
const NP_DIGIT_TO_LATIN: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

/** Normalise any Devanagari digits in a string to Latin (0-9). */
function toLatinDigits(input: string): string {
  return (input || '').replace(/[०-९]/g, (d) => NP_DIGIT_TO_LATIN[d] ?? d);
}

/**
 * Spread a BS date (YYYY-MM-DD, in Devanagari or Latin digits) into spaced
 * YYYYMMDD characters using Latin numerals — the source for the date-box comb.
 */
function bsDateToBoxes(dateBs: string): string {
  const latin = toLatinDigits(dateBs || '');
  const m = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(latin);
  if (!m) {
    const only = latin.replace(/\D/g, '');
    return only ? only.split('').join(' ') : '';
  }
  const [, y, mo, d] = m;
  const digits = `${y}${mo.padStart(2, '0')}${d.padStart(2, '0')}`;
  return digits.split('').join(' ');
}

/** Resolve every {tag} in a template string against the cheque context. */
export function resolveChequeTags(template: string, ctx: ChequeTagContext): string {
  if (!template) return '';

  const replacements: Record<string, string> = {
    '{payee_name}': ctx.payeeName || '—',
    '{or_bearer}': 'वा वाहकलाई / or Bearer',
    '{account_name}': ctx.accountName || '—',
    '{account_no}': ctx.accountNo || '—',

    '{amount_figures}': `=${formatChequeFigures(ctx.amountFigures)}=`,
    '{amount_words}': numberToEnglishWords(ctx.amountFigures),
    '{amount_words_np}': numberToNepaliWords(ctx.amountFigures),

    '{cheque_number}': ctx.chequeNumber || '—',
    '{date_bs}': ctx.dateBs || '—',
    '{date_ad}': ctx.dateAd || '—',
    '{date_boxes}': dateToBoxes(ctx.dateAd),
    '{date_boxes_bs}': bsDateToBoxes(ctx.dateBs),

    '{bank_name_np}': ctx.config?.bankNameNp || '',
    '{bank_name_en}': ctx.config?.bankNameEn || '',
    '{branch_name}': ctx.branchName || ctx.config?.branchName || '',
    '{micr_code}': ctx.micrCode || ctx.config?.micrCode || '',
  };

  let result = template;
  Object.entries(replacements).forEach(([key, val]) => {
    const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
    result = result.replace(regex, val);
  });
  return result;
}
