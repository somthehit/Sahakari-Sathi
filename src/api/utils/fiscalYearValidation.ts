/**
 * Fiscal-year validation helpers (Module 1: Organization Settings).
 *
 * Data-integrity rules enforced server-side (not just in the UI):
 *  1. Only one fiscal year may be `isCurrent` (active) at a time.
 *  2. New fiscal-year BS date ranges must not overlap existing ones.
 *  3. A financial period's BS range must sit fully inside its parent fiscal year.
 *
 * BS dates are stored as ISO-like "YYYY-MM-DD" strings, which compare
 * lexicographically as chronological order, so a plain string comparison is
 * correct for range-overlap math.
 */

export interface FiscalYearRange {
  code?: string;
  startDateBS?: string;
  endDateBS?: string;
}

/** Zero-pad a BS date string so lexicographic comparison is correct. */
export function normalizeBsDate(d: string): string {
  if (!d) return '';
  const re = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  const m = d.match(re);
  if (!m) return d;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

/** True when `a` is a valid parseable BS date range (start <= end). */
export function isValidBsRange(range: { startDateBS?: string; endDateBS?: string }): boolean {
  const start = range.startDateBS;
  const end = range.endDateBS;
  if (!start || !end) return false;
  const normStart = normalizeBsDate(start);
  const normEnd = normalizeBsDate(end);
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(normStart) || !re.test(normEnd)) return false;
  return normStart <= normEnd;
}

/** True when rangeA [aStart, aEnd] overlaps rangeB [bStart, bEnd]. */
export function bsRangesOverlap(a: FiscalYearRange, b: FiscalYearRange): boolean {
  if (!isValidBsRange(a) || !isValidBsRange(b)) return true; // fail closed: unparseable → assume overlap
  const aStart = normalizeBsDate(a.startDateBS!);
  const aEnd = normalizeBsDate(a.endDateBS!);
  const bStart = normalizeBsDate(b.startDateBS!);
  const bEnd = normalizeBsDate(b.endDateBS!);
  // Standard interval overlap: startA <= endB AND startB <= endA.
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Return the first existing fiscal year whose BS range overlaps the candidate
 * range, or null when no conflict exists.
 */
export function findOverlappingFiscalYear(
  existing: FiscalYearRange[],
  candidate: FiscalYearRange,
  ignoreId?: string,
): FiscalYearRange | null {
  for (const row of existing) {
    if (ignoreId && (row as any).id === ignoreId) continue;
    if (bsRangesOverlap(row, candidate)) return row;
  }
  return null;
}

/**
 * True when `child` sits fully inside `parent` (inclusive on both bounds).
 *
 * This is the Financial Period ⊂ Fiscal Year containment rule: a period is a
 * child entry of a fiscal year and may never reach outside its parent bounds.
 * Fails closed (returns false) on unparseable ranges.
 */
export function isBsRangeWithin(child: FiscalYearRange, parent: FiscalYearRange): boolean {
  if (!isValidBsRange(child) || !isValidBsRange(parent)) return false;
  const childStart = normalizeBsDate(child.startDateBS!);
  const childEnd = normalizeBsDate(child.endDateBS!);
  const parentStart = normalizeBsDate(parent.startDateBS!);
  const parentEnd = normalizeBsDate(parent.endDateBS!);
  return childStart >= parentStart && childEnd <= parentEnd;
}

/** Which bound(s) of `child` breach `parent`. Empty array ⇒ fully contained. */
export function bsRangeBreaches(
  child: FiscalYearRange,
  parent: FiscalYearRange,
): ('start' | 'end')[] {
  if (!isValidBsRange(child) || !isValidBsRange(parent)) return ['start', 'end'];
  const breaches: ('start' | 'end')[] = [];
  if (normalizeBsDate(child.startDateBS!) < normalizeBsDate(parent.startDateBS!)) breaches.push('start');
  if (normalizeBsDate(child.endDateBS!) > normalizeBsDate(parent.endDateBS!)) breaches.push('end');
  return breaches;
}
