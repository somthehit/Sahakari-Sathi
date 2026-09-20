import React from 'react';
import type { PassbookLayoutConfig, PassbookColumnKey } from '../../utils/passbookLayout';

/**
 * A single physical passbook page rendered at true millimetre scale. This is the
 * ONE renderer shared by the design-studio preview and the real print portal, so
 * what the teller calibrates on screen is exactly what the printer overprints
 * onto the pre-ruled booklet (or the A4 / thermal fallback). Positions are in mm;
 * on screen 1mm ≈ 3.78px, and the studio wraps this in a CSS transform to fit.
 *
 * Column X positions are absolute from the physical left edge (they already bake
 * in any left inset, matching the print engine which applies no transform). The
 * `.passbook-print-page` class is the hook `utils/printPassbook` targets.
 */

export interface PassbookRowData {
  date: string;
  particulars: string;
  voucher: string;
  withdrawal: string;
  deposit: string;
  balance: string;
  teller?: string;
}

/** A row already assigned to this page, with its resolved vertical position. */
export interface PassbookPositionedRowData {
  data: PassbookRowData;
  line: number;
  topMm: number;
}

export interface PassbookPageProps {
  layout: PassbookLayoutConfig;
  rows: PassbookPositionedRowData[];
  /** Optional statement chrome printed above the grid (A4 fallback). */
  titleLines?: string[];
  /** Calibration aids — never printed on a real run; studio-only overlays. */
  showBaselines?: boolean;
  showColumnGuides?: boolean;
  /** Draw a faint page border on screen (stripped for print by the print engine). */
  screenBorder?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const mm = (v: number) => `${v}mm`;
const pt = (v: number) => `${v}pt`;

function cellText(row: PassbookRowData, key: PassbookColumnKey): string {
  switch (key) {
    case 'date': return row.date;
    case 'particulars': return row.particulars;
    case 'voucher': return row.voucher;
    case 'withdrawal': return row.withdrawal;
    case 'deposit': return row.deposit;
    case 'balance': return row.balance;
    case 'teller': return row.teller ?? '';
    default: return '';
  }
}

export const PassbookPage: React.FC<PassbookPageProps> = ({
  layout, rows, titleLines, showBaselines, showColumnGuides, screenBorder, className, style,
}) => {
  const {
    pageWidthMm, pageHeightMm, marginTopMm, marginLeftMm, lineHeightMm,
    linesPerPage, fontSizePt, columns, showColumnRules, showHeader,
  } = layout;

  const rulesLeft = marginLeftMm;
  const rulesRight = pageWidthMm - marginLeftMm;
  const rulesWidth = Math.max(0, rulesRight - rulesLeft);
  const headerTopMm = Math.max(0, marginTopMm - lineHeightMm);

  return (
    <div
      className={`passbook-print-page${className ? ` ${className}` : ''}`}
      style={{
        position: 'relative',
        width: mm(pageWidthMm),
        height: mm(pageHeightMm),
        background: '#ffffff',
        overflow: 'hidden',
        boxSizing: 'border-box',
        color: '#0f172a',
        fontFamily: 'inherit',
        ...(screenBorder ? { border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.08)' } : {}),
        ...style,
      }}
    >
      {/* Statement chrome (A4 fallback) */}
      {titleLines && titleLines.length > 0 && (
        <div style={{ position: 'absolute', left: mm(rulesLeft), top: mm(6), width: mm(rulesWidth) }}>
          {titleLines.map((t, i) => (
            <div key={i} style={{ fontSize: pt(i === 0 ? fontSizePt + 3 : fontSizePt - 0.5), fontWeight: i === 0 ? 700 : 500, lineHeight: 1.35, textAlign: i === 0 ? 'center' : 'left', color: i === 0 ? '#0f172a' : '#475569' }}>
              {t}
            </div>
          ))}
        </div>
      )}

      {/* Column guides (calibration only) */}
      {showColumnGuides && columns.map((c) => (
        <div key={`guide-${c.key}`} style={{ position: 'absolute', left: mm(c.xMm), top: 0, width: '0', height: mm(pageHeightMm), borderLeft: '0.2mm dashed #34d399' }} />
      ))}

      {/* Per-line baselines (calibration only) */}
      {showBaselines && Array.from({ length: linesPerPage }).map((_, i) => (
        <React.Fragment key={`base-${i}`}>
          <div style={{ position: 'absolute', left: mm(rulesLeft), top: mm(marginTopMm + i * lineHeightMm), width: mm(rulesWidth), height: '0', borderTop: '0.2mm dashed #cbd5e1' }} />
          <div style={{ position: 'absolute', left: 0, top: mm(marginTopMm + i * lineHeightMm), width: mm(rulesLeft > 3 ? rulesLeft : 4), fontSize: pt(5), color: '#94a3b8', lineHeight: mm(lineHeightMm), textAlign: 'center' }}>
            {i + 1}
          </div>
        </React.Fragment>
      ))}

      {/* Printed column rules (real, for the A4 statement) */}
      {showColumnRules && (
        <>
          <div style={{ position: 'absolute', left: mm(rulesLeft), top: mm(marginTopMm), width: mm(rulesWidth), height: mm(linesPerPage * lineHeightMm), border: '0.25mm solid #94a3b8' }} />
          {columns.slice(1).map((c) => (
            <div key={`rule-${c.key}`} style={{ position: 'absolute', left: mm(c.xMm), top: mm(marginTopMm), width: '0', height: mm(linesPerPage * lineHeightMm), borderLeft: '0.2mm solid #cbd5e1' }} />
          ))}
        </>
      )}

      {/* Column header band */}
      {showHeader && (
        <>
          {columns.map((c) => (
            <div
              key={`hdr-${c.key}`}
              style={{
                position: 'absolute', left: mm(c.xMm), top: mm(headerTopMm), width: mm(c.widthMm),
                height: mm(lineHeightMm), lineHeight: mm(lineHeightMm), textAlign: c.align,
                fontSize: pt(Math.max(5, (c.fontSizePt ?? fontSizePt) - 0.5)), fontWeight: 700,
                color: '#334155', overflow: 'hidden', whiteSpace: 'nowrap',
              }}
            >
              {c.label}
            </div>
          ))}
          <div style={{ position: 'absolute', left: mm(rulesLeft), top: mm(marginTopMm), width: mm(rulesWidth), height: '0', borderTop: '0.3mm solid #64748b' }} />
        </>
      )}

      {/* Transaction rows */}
      {rows.map((r) => (
        <React.Fragment key={`row-${r.line}-${r.topMm}`}>
          {columns.map((c) => (
            <div
              key={`${r.line}-${c.key}`}
              style={{
                position: 'absolute', left: mm(c.xMm), top: mm(r.topMm), width: mm(c.widthMm),
                height: mm(lineHeightMm), lineHeight: mm(lineHeightMm), textAlign: c.align,
                fontSize: pt(c.fontSizePt ?? fontSizePt), overflow: 'hidden', whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}
              title={cellText(r.data, c.key)}
            >
              {cellText(r.data, c.key)}
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

/** Format a money amount for a passbook cell (blank for zero/empty). */
export function passbookMoney(value: number | null | undefined, { blankZero = false } = {}): string {
  const n = Number(value);
  if (!Number.isFinite(n) || (blankZero && n === 0)) return '';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Build a printable row from a ledger transaction, honoring the layout's date mode. */
export function toPassbookRow(
  txn: { bsDate?: string; dateAd?: string | null; voucherNo?: string; particulars?: string; debit?: number; credit?: number; balance?: number; tellerName?: string },
  dateFormat: PassbookLayoutConfig['dateFormat'],
): PassbookRowData {
  const bs = txn.bsDate ?? '';
  const ad = txn.dateAd ?? '';
  const date = dateFormat === 'ad' ? (ad || bs) : dateFormat === 'both' ? [bs, ad].filter(Boolean).join(' · ') : bs;
  return {
    date,
    particulars: txn.particulars ?? '',
    voucher: txn.voucherNo ?? '',
    withdrawal: passbookMoney(txn.debit, { blankZero: true }),
    deposit: passbookMoney(txn.credit, { blankZero: true }),
    balance: passbookMoney(txn.balance),
    teller: txn.tellerName ?? '',
  };
}
