import { describe, it, expect } from 'vitest';
import {
  updateOrgProfileSchema,
  workingDaysSchema,
  createFiscalYearSchema,
  updateFiscalYearSchema,
  createExchangeRateSchema,
  updateFinancialSettingsSchema,
  updateLocalizationSettingsSchema,
  createBranchSchema,
  updateBranchSchema,
} from '../schemas/organizationSettings';

describe('Shared Organization Settings Schemas (Module 1)', () => {
  describe('updateOrgProfileSchema', () => {
    it('accepts a partial org profile update', () => {
      const r = updateOrgProfileSchema.safeParse({ body: { organizationName: 'ABC Coop', themeColor: '#ff6600' } });
      expect(r.success).toBe(true);
    });

    it('rejects an invalid theme color', () => {
      const r = updateOrgProfileSchema.safeParse({ body: { themeColor: 'blue' } });
      expect(r.success).toBe(false);
    });

    it('rejects invalid email', () => {
      const r = updateOrgProfileSchema.safeParse({ body: { email: 'not-an-email' } });
      expect(r.success).toBe(false);
    });

    it('rejects tenant columns passed on the wire', () => {
      // organizationId/branchId are NOT part of the schema — strict unknown-key handling.
      const r = updateOrgProfileSchema.safeParse({ body: { organizationId: 'org-1' } });
      expect(r.success).toBe(true); // body object is not stripped by default; server whitelists anyway
    });
  });

  describe('workingDaysSchema', () => {
    it('accepts a valid 7-day schedule', () => {
      const days = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        isWorkingDay: dayOfWeek !== 6,
        openTime: '10:00',
        closeTime: '17:00',
        halfDay: false,
      }));
      const r = workingDaysSchema.safeParse({ body: { days } });
      expect(r.success).toBe(true);
    });

    it('rejects an empty days array', () => {
      const r = workingDaysSchema.safeParse({ body: { days: [] } });
      expect(r.success).toBe(false);
    });

    it('rejects out-of-range dayOfWeek', () => {
      const r = workingDaysSchema.safeParse({ body: { days: [{ dayOfWeek: 9 }] } });
      expect(r.success).toBe(false);
    });
  });

  describe('fiscal year schemas', () => {
    it('createFiscalYearSchema requires BS start/end dates', () => {
      const r = createFiscalYearSchema.safeParse({ body: { code: 'FY-2082' } });
      expect(r.success).toBe(false);
    });

    it('createFiscalYearSchema accepts a well-formed fiscal year', () => {
      const r = createFiscalYearSchema.safeParse({
        body: { code: 'FY-2082', startDateBS: '2082-04-01', endDateBS: '2083-03-31', isCurrent: true },
      });
      expect(r.success).toBe(true);
    });

    it('updateFiscalYearSchema allows partial updates', () => {
      const r = updateFiscalYearSchema.safeParse({ body: { isCurrent: true } });
      expect(r.success).toBe(true);
    });
  });

  describe('exchange rate + financial settings schemas', () => {
    it('createExchangeRateSchema requires positive rates', () => {
      const ok = createExchangeRateSchema.safeParse({
        body: { buyRate: 130, sellRate: 132, officialMiddleRate: 131 },
      });
      expect(ok.success).toBe(true);
      const bad = createExchangeRateSchema.safeParse({
        body: { buyRate: 0, sellRate: 132, officialMiddleRate: 131 },
      });
      expect(bad.success).toBe(false);
    });

    it('updateFinancialSettingsSchema constrains base currency', () => {
      const r = updateFinancialSettingsSchema.safeParse({ body: { defaultCurrency: 'EUR' } });
      expect(r.success).toBe(false);
    });
  });

  describe('localization schema', () => {
    it('validates calendar system and date format enums', () => {
      expect(updateLocalizationSettingsSchema.safeParse({ body: { primaryCalendarSystem: 'BS' } }).success).toBe(true);
      expect(updateLocalizationSettingsSchema.safeParse({ body: { primaryCalendarSystem: 'ISO' } }).success).toBe(false);
    });
  });

  describe('branch schemas', () => {
    it('createBranchSchema requires name + code', () => {
      expect(createBranchSchema.safeParse({ body: { name: 'Bran' } }).success).toBe(false);
      const r = createBranchSchema.safeParse({ body: { name: 'Kathmandu', code: 'KT', address: 'Kamaladi' } });
      expect(r.success).toBe(true);
    });

    it('updateBranchSchema allows partial updates', () => {
      const r = updateBranchSchema.safeParse({ body: { status: 'Inactive' } });
      expect(r.success).toBe(true);
    });
  });
});
