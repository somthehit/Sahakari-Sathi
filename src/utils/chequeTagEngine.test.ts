/**
 * Cheque leaf tag-engine tests.
 *
 * Covers the pure, render-time helpers that turn a saved design's {curly}
 * tokens into printed cheque text:
 *   - `numberToEnglishWords`  — lakh/crore amount-in-words (Rupees … Paisa Only)
 *   - `formatChequeFigures`   — comma-grouped figures with 2 decimals
 *   - `resolveChequeTags`     — token substitution (also exercises the private
 *                               `dateToBoxes` and Nepali-words helpers via tags)
 *
 * These run without a DOM or DB — the engine is a pure function of its inputs.
 */
import { describe, it, expect } from 'vitest';
import {
  numberToEnglishWords,
  formatChequeFigures,
  resolveChequeTags,
} from './chequeTagEngine';
import type { ChequeTagContext } from './chequeTagEngine';
import type { ChequeDesignConfig } from '../components/cheque/ChequeLeafCanvas';

/** A cheque context stub — only the fields the resolver reads are populated. */
function makeCtx(over: Partial<ChequeTagContext> = {}): ChequeTagContext {
  return {
    config: {
      bankNameNp: 'साझा सहकारी संस्था लि.',
      bankNameEn: 'Sajha Co-operative Ltd.',
      branchName: 'Koteshwor',
      micrCode: '977001234',
    } as unknown as ChequeDesignConfig,
    payeeName: 'Ram Bahadur Shrestha',
    amountFigures: 5000,
    dateBs: '२०८३-०४-१५',
    dateAd: '2026-07-31',
    accountNo: '001-0100-0000123',
    accountName: 'Sita Devi',
    chequeNumber: 'CHQ-100234',
    ...over,
  };
}

describe('numberToEnglishWords', () => {
  it('spells a whole thousand', () => {
    expect(numberToEnglishWords(5000)).toBe('Rupees Five Thousand Only');
  });

  it('renders zero explicitly', () => {
    expect(numberToEnglishWords(0)).toBe('Rupees Zero Only');
  });

  it('includes paisa when there is a fractional part', () => {
    expect(numberToEnglishWords(125.5)).toBe(
      'Rupees One Hundred Twenty Five and Fifty Paisa Only',
    );
  });

  it('uses lakh grouping (South-Asian), not million', () => {
    expect(numberToEnglishWords(1500000)).toBe('Rupees Fifteen Lakh Only');
  });

  it('uses crore grouping for eight-figure amounts', () => {
    expect(numberToEnglishWords(20000000)).toBe('Rupees Two Crore Only');
  });

  it('accepts a numeric string', () => {
    expect(numberToEnglishWords('5000')).toBe('Rupees Five Thousand Only');
  });

  it('falls back to zero for non-numeric input', () => {
    expect(numberToEnglishWords('abc')).toBe('Rupees Zero Only');
  });
});

describe('formatChequeFigures', () => {
  it('adds two decimal places to a whole number', () => {
    expect(formatChequeFigures(5000)).toBe('5,000.00');
  });

  it('keeps exactly two decimals for a fractional amount', () => {
    expect(formatChequeFigures(12.5)).toBe('12.50');
  });

  it('formats zero', () => {
    expect(formatChequeFigures(0)).toBe('0.00');
  });

  it('returns 0.00 for non-numeric input', () => {
    expect(formatChequeFigures('abc')).toBe('0.00');
  });

  it('groups large amounts and preserves the numeric value', () => {
    const out = formatChequeFigures(150000);
    // Grouping style depends on the runtime locale data; assert the value is
    // intact with 2 decimals and that grouping separators were inserted.
    expect(out.replace(/,/g, '')).toBe('150000.00');
    expect(out).toContain(',');
  });
});

describe('resolveChequeTags', () => {
  it('resolves a single party tag', () => {
    expect(resolveChequeTags('{payee_name}', makeCtx())).toBe('Ram Bahadur Shrestha');
  });

  it('wraps figures in protective equals signs', () => {
    expect(resolveChequeTags('{amount_figures}', makeCtx())).toBe('=5,000.00=');
  });

  it('resolves the English amount-in-words tag', () => {
    expect(resolveChequeTags('{amount_words}', makeCtx())).toBe('Rupees Five Thousand Only');
  });

  it('spreads the AD date into DDMMYYYY boxes', () => {
    expect(resolveChequeTags('{date_boxes}', makeCtx())).toBe('3 1 0 7 2 0 2 6');
  });

  it('pulls institution fields from the design config', () => {
    expect(resolveChequeTags('{bank_name_en}', makeCtx())).toBe('Sajha Co-operative Ltd.');
  });

  it('falls back to the config branch when the context omits one', () => {
    expect(resolveChequeTags('{branch_name}', makeCtx())).toBe('Koteshwor');
  });

  it('prefers an explicit context branch over the config', () => {
    expect(resolveChequeTags('{branch_name}', makeCtx({ branchName: 'Baneshwor' }))).toBe('Baneshwor');
  });

  it('resolves multiple distinct tags in one template', () => {
    expect(resolveChequeTags('Pay {payee_name} — {cheque_number}', makeCtx())).toBe(
      'Pay Ram Bahadur Shrestha — CHQ-100234',
    );
  });

  it('replaces every occurrence of a repeated tag', () => {
    expect(resolveChequeTags('{cheque_number} / {cheque_number}', makeCtx())).toBe(
      'CHQ-100234 / CHQ-100234',
    );
  });

  it('does not confuse {amount_words} with {amount_words_np}', () => {
    // The Nepali variant must survive when only the English tag is present.
    expect(resolveChequeTags('{amount_words_np}', makeCtx())).not.toBe('Rupees Five Thousand Only');
  });

  it('substitutes an em dash for an empty payee', () => {
    expect(resolveChequeTags('{payee_name}', makeCtx({ payeeName: '' }))).toBe('—');
  });

  it('returns an empty string for an empty template', () => {
    expect(resolveChequeTags('', makeCtx())).toBe('');
  });
});
