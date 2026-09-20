import { describe, it, expect } from 'vitest';
import { DateConverter } from './DateConverter';

describe('DateConverter maxYearBS cap', () => {
  it('has maxYearBS defined as 2090', () => {
    expect(DateConverter.maxYearBS).toBe(2090);
  });

  it('returns empty string for year > 2090 in bsToAd', () => {
    expect(DateConverter.bsToAd('2091-01-01')).toBe('');
    expect(DateConverter.bsToAd(2095, 1, 1)).toBe('');
  });

  it('handles valid years <= 2090', () => {
    expect(DateConverter.getDaysInMonthBS(2083, 3)).toBeGreaterThanOrEqual(28);
    expect(DateConverter.bsToAd('2083-04-01')).not.toBe('');
  });
});
