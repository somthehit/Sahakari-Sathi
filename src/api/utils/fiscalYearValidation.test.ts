import { describe, it, expect } from 'vitest';
import {
  isValidBsRange,
  bsRangesOverlap,
  findOverlappingFiscalYear,
} from './fiscalYearValidation';

describe('Fiscal Year BS Range Validation', () => {
  it('accepts a valid non-empty BS date range', () => {
    expect(isValidBsRange({ startDateBS: '2081-04-01', endDateBS: '2082-03-31' })).toBe(true);
  });

  it('accepts un-padded dates by zero-padding them', () => {
    expect(isValidBsRange({ startDateBS: '2081-4-1', endDateBS: '2082-3-31' })).toBe(true);
  });

  it('rejects missing or malformed dates', () => {
    expect(isValidBsRange({ startDateBS: '2081-04-01', endDateBS: '' })).toBe(false);
    expect(isValidBsRange({})).toBe(false);
    expect(isValidBsRange({ startDateBS: '2081/04/01', endDateBS: '2082-03-31' })).toBe(false);
  });

  it('fails closed (returns true for overlap) on malformed date strings', () => {
    expect(bsRangesOverlap(
      { startDateBS: 'invalid-date', endDateBS: '2082-03-31' },
      { startDateBS: '2081-04-01', endDateBS: '2082-03-31' },
    )).toBe(true);
  });

  it('rejects an inverted range (end before start)', () => {
    expect(isValidBsRange({ startDateBS: '2082-03-31', endDateBS: '2081-04-01' })).toBe(false);
  });

  it('detects exact, partial, and touching overlaps', () => {
    // exact same range
    expect(bsRangesOverlap(
      { startDateBS: '2081-04-01', endDateBS: '2082-03-31' },
      { startDateBS: '2081-04-01', endDateBS: '2082-03-31' },
    )).toBe(true);
    // partial overlap
    expect(bsRangesOverlap(
      { startDateBS: '2081-04-01', endDateBS: '2082-03-31' },
      { startDateBS: '2082-01-01', endDateBS: '2082-12-31' },
    )).toBe(true);
    // nesting
    expect(bsRangesOverlap(
      { startDateBS: '2081-04-01', endDateBS: '2083-03-31' },
      { startDateBS: '2082-01-01', endDateBS: '2082-12-31' },
    )).toBe(true);
    // adjacent but not overlapping (start == other's end is NOT overlapping)
    expect(bsRangesOverlap(
      { startDateBS: '2081-04-01', endDateBS: '2082-03-31' },
      { startDateBS: '2082-03-31', endDateBS: '2083-03-30' },
    )).toBe(true); // 2082-03-31 shared boundary counts as overlap
  });

  it('returns false for clearly disjoint ranges', () => {
    expect(bsRangesOverlap(
      { startDateBS: '2081-04-01', endDateBS: '2082-03-31' },
      { startDateBS: '2082-04-01', endDateBS: '2083-03-31' },
    )).toBe(false);
  });

  it('findOverlappingFiscalYear finds the conflicting row', () => {
    const existing = [
      { id: 'a', code: 'FY-2080', startDateBS: '2080-04-01', endDateBS: '2081-03-31' },
      { id: 'b', code: 'FY-2081', startDateBS: '2081-04-01', endDateBS: '2082-03-31' },
    ];
    const clash = findOverlappingFiscalYear(existing, {
      startDateBS: '2082-01-01', endDateBS: '2082-12-31',
    });
    expect(clash?.code).toBe('FY-2081');
  });

  it('ignores the row being updated when checking overlap', () => {
    const existing = [
      { id: 'b', code: 'FY-2081', startDateBS: '2081-04-01', endDateBS: '2082-03-31' },
    ];
    // Editing FY-2081 to extend into a new range should not conflict with itself.
    const clash = findOverlappingFiscalYear(existing, {
      startDateBS: '2081-04-01', endDateBS: '2082-06-30',
    }, 'b');
    expect(clash).toBeNull();
  });

  it('returns null when no existing range conflicts', () => {
    const existing = [
      { id: 'b', code: 'FY-2081', startDateBS: '2081-04-01', endDateBS: '2082-03-31' },
    ];
    const clash = findOverlappingFiscalYear(existing, {
      startDateBS: '2082-04-01', endDateBS: '2083-03-31',
    });
    expect(clash).toBeNull();
  });
});
