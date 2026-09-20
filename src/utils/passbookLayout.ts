/**
 * Passbook print geometry — the single source of truth for where every line and
 * column lands on the page, in millimetres, so that on-screen calibration, the
 * print engine, and the design studio all agree pixel-for-pixel (mm-for-mm).
 *
 * A passbook is a pre-ruled physical booklet. When the teller re-inserts it to
 * print new transactions, the printer must resume on the exact ruled line where
 * the previous print stopped. That resume position is `last_printed_line` on the
 * currently-open page; when it reaches `linesPerPage` the teller flips to a fresh
 * page and it resets to 0. This module owns the maths for that continuation, kept
 * free of React/DOM so it is directly unit-testable.
 */

export type PassbookColumnKey =
  | 'date'
  | 'particulars'
  | 'voucher'
  | 'withdrawal'
  | 'deposit'
  | 'balance'
  | 'teller';

export type PassbookTextAlign = 'left' | 'right' | 'center';

/** One printed column, positioned absolutely from the page's left edge (mm). */
export interface PassbookColumn {
  key: PassbookColumnKey;
  /** Header label used by the A4 statement and the studio preview. */
  label: string;
  /** Left edge of the column box, in mm from the physical page's left edge. */
  xMm: number;
  /** Column box width in mm. Text is clipped/aligned within this box. */
  widthMm: number;
  align: PassbookTextAlign;
  /** Optional per-column font-size override (pt). Falls back to layout fontSizePt. */
  fontSizePt?: number;
}

/**
 * A named, calibratable passbook layout. All measurements are millimetres so the
 * print output lines up with the pre-printed ruling of the physical booklet.
 */
export interface PassbookLayoutConfig {
  /** Physical printable page — for a booklet this is the single open panel. */
  pageWidthMm: number;
  pageHeightMm: number;
  /** Top of the first transaction line (below the booklet's pre-printed header). */
  marginTopMm: number;
  /** Global left inset applied to the page block (columns are absolute from 0). */
  marginLeftMm: number;
  /** Vertical pitch between successive transaction lines. */
  lineHeightMm: number;
  /** Printable transaction lines per physical page. */
  linesPerPage: number;
  /** Base print font size in points. */
  fontSizePt: number;
  columns: PassbookColumn[];
  /** Draw faint vertical/horizontal rules — off for pre-ruled booklets, on for A4. */
  showColumnRules: boolean;
  /** Render a column header band — off for booklets (pre-printed), on for A4. */
  showHeader: boolean;
  /** Which date to print in the date column. */
  dateFormat: 'bs' | 'ad' | 'both';
}

/** Hard geometry bounds — mirrors the cheque design's widthMm/heightMm guards. */
export const PASSBOOK_LAYOUT_BOUNDS = {
  pageWidthMm: { min: 40, max: 400 },
  pageHeightMm: { min: 40, max: 400 },
  marginTopMm: { min: 0, max: 200 },
  marginLeftMm: { min: 0, max: 100 },
  lineHeightMm: { min: 2, max: 40 },
  linesPerPage: { min: 1, max: 120 },
  fontSizePt: { min: 4, max: 24 },
} as const;

/**
 * Default booklet layout: a portrait A6-ish open panel with a 30-line grid,
 * matching the existing `savings_accounts.passbook_lines_per_page` default of 30.
 * Column rules and header are OFF — the physical booklet is already ruled and
 * titled; we only overprint the data.
 */
export const DEFAULT_PASSBOOK_LAYOUT: PassbookLayoutConfig = {
  pageWidthMm: 105,
  pageHeightMm: 165,
  marginTopMm: 30,
  marginLeftMm: 0,
  lineHeightMm: 4.5,
  linesPerPage: 30,
  fontSizePt: 7.5,
  showColumnRules: false,
  showHeader: false,
  dateFormat: 'bs',
  columns: [
    { key: 'date', label: 'मिति', xMm: 3, widthMm: 16, align: 'left' },
    { key: 'particulars', label: 'विवरण', xMm: 19, widthMm: 26, align: 'left' },
    { key: 'voucher', label: 'भौ. नं.', xMm: 45, widthMm: 11, align: 'left' },
    { key: 'withdrawal', label: 'भुक्तानी', xMm: 56, widthMm: 14, align: 'right' },
    { key: 'deposit', label: 'जम्मा', xMm: 70, widthMm: 14, align: 'right' },
    { key: 'balance', label: 'बाँकी', xMm: 84, widthMm: 18, align: 'right' },
  ],
};

/**
 * Default A4 statement layout — the "printout" fallback the teller can pick per
 * print. Full ruled table with header on ordinary A4 (210 × 297 mm), 15 mm
 * margins → 180 mm usable width, generous line pitch, teller column included.
 */
export const DEFAULT_A4_STATEMENT_LAYOUT: PassbookLayoutConfig = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginTopMm: 52,
  marginLeftMm: 15,
  lineHeightMm: 7,
  linesPerPage: 30,
  fontSizePt: 9,
  showColumnRules: true,
  showHeader: true,
  dateFormat: 'both',
  columns: [
    { key: 'date', label: 'Date (BS)', xMm: 15, widthMm: 26, align: 'left' },
    { key: 'particulars', label: 'Particulars', xMm: 41, widthMm: 55, align: 'left' },
    { key: 'voucher', label: 'Voucher', xMm: 96, widthMm: 22, align: 'left' },
    { key: 'withdrawal', label: 'Withdrawal', xMm: 118, widthMm: 26, align: 'right' },
    { key: 'deposit', label: 'Deposit', xMm: 144, widthMm: 26, align: 'right' },
    { key: 'balance', label: 'Balance', xMm: 170, widthMm: 25, align: 'right' },
  ],
};

/** Clamp a number into [min, max]; returns fallback when not finite. */
function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Defensively coerce an untrusted layout (e.g. parsed from a saved design's
 * configJson) into a valid PassbookLayoutConfig, clamping every dimension and
 * dropping malformed columns. Never throws — always returns a printable layout.
 */
export function sanitizeLayout(
  raw: Partial<PassbookLayoutConfig> | null | undefined,
  base: PassbookLayoutConfig = DEFAULT_PASSBOOK_LAYOUT,
): PassbookLayoutConfig {
  const src = raw && typeof raw === 'object' ? raw : {};
  const B = PASSBOOK_LAYOUT_BOUNDS;
  const pageWidthMm = clampNum(src.pageWidthMm, B.pageWidthMm.min, B.pageWidthMm.max, base.pageWidthMm);

  const columnsSrc = Array.isArray(src.columns) ? src.columns : base.columns;
  const columns: PassbookColumn[] = columnsSrc
    .filter((c): c is PassbookColumn => !!c && typeof c === 'object' && typeof (c as any).key === 'string')
    .map((c) => ({
      key: c.key,
      label: typeof c.label === 'string' ? c.label : String(c.key),
      xMm: clampNum(c.xMm, 0, pageWidthMm, 0),
      widthMm: clampNum(c.widthMm, 1, pageWidthMm, 10),
      align: c.align === 'right' || c.align === 'center' ? c.align : 'left',
      ...(Number.isFinite(c.fontSizePt as number)
        ? { fontSizePt: clampNum(c.fontSizePt, B.fontSizePt.min, B.fontSizePt.max, base.fontSizePt) }
        : {}),
    }));

  return {
    pageWidthMm,
    pageHeightMm: clampNum(src.pageHeightMm, B.pageHeightMm.min, B.pageHeightMm.max, base.pageHeightMm),
    marginTopMm: clampNum(src.marginTopMm, B.marginTopMm.min, B.marginTopMm.max, base.marginTopMm),
    marginLeftMm: clampNum(src.marginLeftMm, B.marginLeftMm.min, B.marginLeftMm.max, base.marginLeftMm),
    lineHeightMm: clampNum(src.lineHeightMm, B.lineHeightMm.min, B.lineHeightMm.max, base.lineHeightMm),
    linesPerPage: Math.round(clampNum(src.linesPerPage, B.linesPerPage.min, B.linesPerPage.max, base.linesPerPage)),
    fontSizePt: clampNum(src.fontSizePt, B.fontSizePt.min, B.fontSizePt.max, base.fontSizePt),
    columns: columns.length ? columns : base.columns,
    showColumnRules: typeof src.showColumnRules === 'boolean' ? src.showColumnRules : base.showColumnRules,
    showHeader: typeof src.showHeader === 'boolean' ? src.showHeader : base.showHeader,
    dateFormat: src.dateFormat === 'ad' || src.dateFormat === 'both' ? src.dateFormat : (src.dateFormat === 'bs' ? 'bs' : base.dateFormat),
  };
}

/** One transaction row placed onto a physical page at a resolved position. */
export interface PositionedRow {
  /** Index into the caller's transaction array. */
  rowIndex: number;
  /** 0-based physical page within this print run (page the teller has open = 0). */
  page: number;
  /** 0-based ruled line on that page. */
  line: number;
  /** Top offset of the line within the page, in mm. */
  topMm: number;
}

export interface PassbookPagination {
  rows: PositionedRow[];
  /** Number of physical pages this run spans (0 when there is nothing to print). */
  pageCount: number;
  /**
   * Line marker to persist as `last_printed_line`: the count of lines used on the
   * final touched page (0..linesPerPage). Equal to linesPerPage means that page
   * filled exactly and the next run should begin on a fresh page.
   */
  finalLine: number;
  /** Total ruled lines consumed by this run (== rows.length); feeds book usage. */
  linesConsumed: number;
}

/**
 * Lay `rowCount` transactions onto passbook pages starting from `startLine` on
 * the currently-open page. Pure and side-effect free.
 *
 * `startLine` is normalised modulo `linesPerPage`, so a "page full" marker
 * (startLine === linesPerPage) correctly rolls onto a fresh page at line 0 — the
 * teller having physically flipped the booklet.
 */
export function paginatePassbook(
  rowCount: number,
  opts: { startLine: number; linesPerPage: number; marginTopMm: number; lineHeightMm: number },
): PassbookPagination {
  const linesPerPage = Math.max(1, Math.floor(opts.linesPerPage));
  const marginTopMm = Number.isFinite(opts.marginTopMm) ? opts.marginTopMm : 0;
  const lineHeightMm = Number.isFinite(opts.lineHeightMm) && opts.lineHeightMm > 0 ? opts.lineHeightMm : 1;
  const count = Math.max(0, Math.floor(rowCount));

  const start = Math.max(0, Math.floor(Number.isFinite(opts.startLine) ? opts.startLine : 0));
  let line = start % linesPerPage; // normalise a full-page marker back to a fresh page
  let page = 0;

  const rows: PositionedRow[] = [];
  for (let i = 0; i < count; i++) {
    if (line >= linesPerPage) {
      line = 0;
      page += 1;
    }
    rows.push({ rowIndex: i, page, line, topMm: marginTopMm + line * lineHeightMm });
    line += 1;
  }

  return {
    rows,
    pageCount: count === 0 ? 0 : page + 1,
    finalLine: count === 0 ? line : line, // line is the post-increment cursor (0..linesPerPage)
    linesConsumed: count,
  };
}

/** Group positioned rows by their physical page, preserving order. */
export function groupRowsByPage(rows: PositionedRow[]): PositionedRow[][] {
  const pages: PositionedRow[][] = [];
  for (const r of rows) {
    (pages[r.page] ??= []).push(r);
  }
  // Fill any gaps (shouldn't occur) with empty arrays to keep indices aligned.
  for (let i = 0; i < pages.length; i++) pages[i] ??= [];
  return pages;
}

/**
 * How many lines remain in the whole book before it is full, given the book's
 * total capacity and lines already used. Never negative.
 */
export function linesRemainingInBook(capacity: number, linesUsed: number): number {
  return Math.max(0, Math.floor(capacity) - Math.floor(linesUsed));
}

/** True when a print of `incoming` lines would meet/exceed the book capacity. */
export function willFillBook(capacity: number, linesUsed: number, incoming: number): boolean {
  return Math.floor(linesUsed) + Math.max(0, Math.floor(incoming)) >= Math.floor(capacity);
}
