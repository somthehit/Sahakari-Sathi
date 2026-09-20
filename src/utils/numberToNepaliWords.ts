/**
 * Nepali Number-to-Words Converter
 * Converts numeric amounts to Nepali (Devanagari) words for legal documents.
 * Supports up to करोड (10,000,000) range.
 *
 * Examples:
 *   300000 → "तीन लाख रुपैयाँ मात्र"
 *   1500.50 → "एक हजार पाँच सय पचास रुपैयाँ पचास पैसा मात्र"
 */

const ONES: string[] = [
  '', 'एक', 'दुई', 'तीन', 'चार', 'पाँच', 'छ', 'सात', 'आठ', 'नौ',
];
const TENS: string[] = [
  '', '', 'बीस', 'तीस', 'चालीस', 'पचास', 'साठ', 'सत्तरी', 'अस्सी', 'नब्बे',
];
const TEENS: string[] = [
  'दस', 'ग्यारह', 'बारह', 'तेह्र', 'चौध', 'पन्ध्र', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस',
];

function twoDigit(n: number): string {
  if (n === 0) return '';
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? ' ' + ONES[o] : '');
}

function threeDigit(n: number): string {
  if (n === 0) return '';
  if (n < 100) return twoDigit(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  return ONES[h] + ' सय' + (r ? ' ' + twoDigit(r) : '');
}

export function numberToNepaliWords(amount: number): string {
  if (amount === 0) return 'शून्य रुपैयाँ मात्र';

  const negative = amount < 0;
  amount = Math.abs(amount);

  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  let words = '';

  if (integerPart >= 10000000) {
    const karod = Math.floor(integerPart / 10000000);
    words += threeDigit(karod) + ' करोड';
  }
  if (integerPart >= 100000) {
    const lakh = Math.floor((integerPart % 10000000) / 100000);
    if (lakh > 0) words += (words ? ' ' : '') + twoDigit(lakh) + ' लाख';
  }
  if (integerPart >= 1000) {
    const hajar = Math.floor((integerPart % 100000) / 1000);
    if (hajar > 0) words += (words ? ' ' : '') + twoDigit(hajar) + ' हजार';
  }
  if (integerPart >= 100) {
    const say = Math.floor((integerPart % 1000) / 100);
    if (say > 0) words += (words ? ' ' : '') + ONES[say] + ' सय';
  }
  const lastTwo = integerPart % 100;
  if (lastTwo > 0) {
    words += (words ? ' ' : '') + twoDigit(lastTwo);
  }

  words += ' रुपैयाँ';

  if (decimalPart > 0) {
    words += ' ' + twoDigit(decimalPart) + ' पैसा';
  }

  words += ' मात्र';

  return (negative ? 'ऋणात्मक ' : '') + words;
}
