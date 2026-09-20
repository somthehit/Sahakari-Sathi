/**
 * Passbook print-geometry tests.
 *
 * Covers the pure, DOM-free maths that guarantee on-screen calibration, the print
 * engine, and the design studio all agree mm-for-mm:
 *   - `paginatePassbook`      — continuation across ruled lines/pages, full-page
 *                               marker rollover, exact-fill marker, topMm geometry
 *   - `groupRowsByPage`       — grouping positioned rows by physical page
 *   - `sanitizeLayout`        — clamping untrusted geometry, dropping bad columns
 *   - `linesRemainingInBook`  — book capacity remaining (never negative)
 *   - `willFillBook`          — whether a run meets/exceeds book capacity
 *
 * These run without a DOM or DB — the module is a pure function of its inputs.
 */
import { describe, it, expect } from 'vitest';
import {
  paginatePassbook,
  groupRowsByPage,
  sanitizeLayout,
  linesRemainingInBook,
  willFillBook,
  DEFAULT_PASSBOOK_LAYOUT,
  DEFAULT_A4_STATEMENT_LAYOUT,
  PASSBOOK_LAYOUT_BOUNDS,
} from './passbookLayout';

const GRID = { linesPerPage: 30, marginTopMm: 30, lineHeightMm: 4.5 };

describe('paginatePassbook', () => {
  it('returns nothing to print for an empty run', () => {
    const p = paginatePassbook(0, { startLine: 5, ...GRID });
    expect(p.rows).toHaveLength(0);
    expect(p.pageCount).toBe(0);
    expect(p.linesConsumed).toBe(0);
  });

  it('lays consecutive rows on one page from the start line', () => {
    const p = paginatePassbook(3, { startLine: 0, ...GRID });
    expect(p.pageCount).toBe(1);
    expect(p.rows.map((r) => r.line)).toEqual([0, 1, 2]);
    expect(p.rows.every((r) => r.page === 0)).toBe(true);
    expect(p.finalLine).toBe(3);
    expect(p.linesConsumed).toBe(3);
  });

  it('resumes mid-page and rolls onto a fresh page when the page fills', () => {
    // Open page has 28 lines used; 5 new rows must spill onto a second page.
    const p = paginatePassbook(5, { startLine: 28, ...GRID });
    expect(p.pageCount).toBe(2);
    // lines 28,29 on page 0 then 0,1,2 on page 1
    expect(p.rows[0]).toEqual({ rowIndex: 0, page: 0, line: 28, topMm: 30 + 28 * 4.5 });
    expect(p.rows[1].line).toBe(29);
    expect(p.rows[2]).toEqual({ rowIndex: 2, page: 1, line: 0, topMm: 30 });
    expect(p.finalLine).toBe(3); // 3 lines used on the final (second) page
  });

  it('normalises a full-page marker (startLine === linesPerPage) back to a fresh page', () => {
    const p = paginatePassbook(2, { startLine: 30, ...GRID });
    expect(p.rows[0].line).toBe(0);
    expect(p.rows[0].page).toBe(0);
    expect(p.pageCount).toBe(1);
    expect(p.finalLine).toBe(2);
  });

  it('marks an exact page fill with finalLine === linesPerPage', () => {
    const p = paginatePassbook(30, { startLine: 0, ...GRID });
    expect(p.pageCount).toBe(1);
    expect(p.finalLine).toBe(30); // page filled exactly; next run starts fresh
    expect(p.rows[29].line).toBe(29);
  });

  it('computes vertical position from margin + line pitch', () => {
    const p = paginatePassbook(3, { startLine: 0, marginTopMm: 30, lineHeightMm: 4.5, linesPerPage: 30 });
    expect(p.rows[2].topMm).toBeCloseTo(39, 6); // 30 + 2 * 4.5
  });

  it('guards against a degenerate zero line height', () => {
    const p = paginatePassbook(2, { startLine: 0, linesPerPage: 30, marginTopMm: 10, lineHeightMm: 0 });
    // lineHeight coerced to 1mm; positions stay finite and monotonic
    expect(p.rows[0].topMm).toBe(10);
    expect(p.rows[1].topMm).toBe(11);
  });
});

describe('groupRowsByPage', () => {
  it('splits positioned rows into per-page buckets in order', () => {
    const p = paginatePassbook(5, { startLine: 28, ...GRID });
    const pages = groupRowsByPage(p.rows);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(2);
    expect(pages[1]).toHaveLength(3);
    expect(pages[1][0].rowIndex).toBe(2);
  });

  it('returns an empty array for no rows', () => {
    expect(groupRowsByPage([])).toHaveLength(0);
  });
});

describe('sanitizeLayout', () => {
  it('returns the booklet default for null input', () => {
    const l = sanitizeLayout(null);
    expect(l.pageWidthMm).toBe(DEFAULT_PASSBOOK_LAYOUT.pageWidthMm);
    expect(l.linesPerPage).toBe(DEFAULT_PASSBOOK_LAYOUT.linesPerPage);
    expect(l.showHeader).toBe(false);
    expect(l.columns.length).toBe(DEFAULT_PASSBOOK_LAYOUT.columns.length);
  });

  it('honours an explicit base (A4 statement) when input is null', () => {
    const l = sanitizeLayout(null, DEFAULT_A4_STATEMENT_LAYOUT);
    expect(l.pageWidthMm).toBe(210);
    expect(l.showHeader).toBe(true);
    expect(l.showColumnRules).toBe(true);
    expect(l.dateFormat).toBe('both');
  });

  it('clamps out-of-range geometry into bounds', () => {
    const l = sanitizeLayout({ pageWidthMm: 9999, lineHeightMm: 0.1, linesPerPage: 500, fontSizePt: 99 });
    expect(l.pageWidthMm).toBe(PASSBOOK_LAYOUT_BOUNDS.pageWidthMm.max);
    expect(l.lineHeightMm).toBe(PASSBOOK_LAYOUT_BOUNDS.lineHeightMm.min);
    expect(l.linesPerPage).toBe(PASSBOOK_LAYOUT_BOUNDS.linesPerPage.max);
    expect(l.fontSizePt).toBe(PASSBOOK_LAYOUT_BOUNDS.fontSizePt.max);
  });

  it('rounds a fractional lines-per-page to a whole number', () => {
    const l = sanitizeLayout({ linesPerPage: 24.7 });
    expect(l.linesPerPage).toBe(25);
  });

  it('drops malformed columns and clamps xMm within the page width', () => {
    const l = sanitizeLayout({
      pageWidthMm: 100,
      columns: [
        { key: 'date', label: 'D', xMm: -5, widthMm: 20, align: 'left' },
        { key: 'balance', label: 'B', xMm: 250, widthMm: 30, align: 'right' },
        { label: 'no key', xMm: 10, widthMm: 10, align: 'left' } as any,
      ],
    });
    expect(l.columns).toHaveLength(2); // the key-less column is dropped
    expect(l.columns[0].xMm).toBe(0); // -5 clamped up to 0
    expect(l.columns[1].xMm).toBe(100); // 250 clamped down to pageWidth
  });

  it('falls back to base columns when all provided columns are invalid', () => {
    const l = sanitizeLayout({ columns: [{ label: 'x' } as any] });
    expect(l.columns.length).toBe(DEFAULT_PASSBOOK_LAYOUT.columns.length);
  });

  it('uses base values for non-boolean flags and bad date formats', () => {
    const l = sanitizeLayout({ showHeader: 'yes' as any, dateFormat: 'martian' as any }, DEFAULT_A4_STATEMENT_LAYOUT);
    expect(l.showHeader).toBe(true); // base (A4) value retained
    expect(l.dateFormat).toBe('both');
  });

  it('keeps a valid per-column font override but drops a non-finite one', () => {
    const l = sanitizeLayout({
      pageWidthMm: 120,
      columns: [
        { key: 'date', label: 'D', xMm: 2, widthMm: 16, align: 'left', fontSizePt: 6 },
        { key: 'balance', label: 'B', xMm: 40, widthMm: 20, align: 'right', fontSizePt: NaN as any },
      ],
    });
    expect(l.columns[0].fontSizePt).toBe(6);
    expect('fontSizePt' in l.columns[1]).toBe(false);
  });
});

describe('linesRemainingInBook', () => {
  it('returns the plain difference when capacity is not yet reached', () => {
    expect(linesRemainingInBook(100, 30)).toBe(70);
  });

  it('never goes negative once a book is over capacity', () => {
    expect(linesRemainingInBook(30, 40)).toBe(0);
  });

  it('floors fractional inputs', () => {
    expect(linesRemainingInBook(100.9, 30.4)).toBe(70);
  });
});

describe('willFillBook', () => {
  it('is true when the incoming run meets capacity exactly', () => {
    expect(willFillBook(100, 90, 10)).toBe(true);
  });

  it('is true when the incoming run exceeds capacity', () => {
    expect(willFillBook(100, 95, 8)).toBe(true);
  });

  it('is false when the run leaves room', () => {
    expect(willFillBook(100, 89, 10)).toBe(false);
  });

  it('treats a negative incoming count as zero', () => {
    expect(willFillBook(100, 50, -5)).toBe(false);
  });
});
