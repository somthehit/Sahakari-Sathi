import { describe, it, expect } from 'vitest';
import {
  ShareCeilingError,
  checkShareCeilings,
  computeKittaRange,
  nextStartKitta,
  computeMaxAllowedKitta,
  ShareTypeCeilingView,
  OrgShareCeilingView,
} from './shareCeilingEngine';

const type = (over: Partial<ShareTypeCeilingView> = {}): ShareTypeCeilingView => ({
  name: 'Ordinary Shares',
  kittaStartBase: null,
  currentKittaPointer: 0,
  maxAllowedKitta: 1000,
  autoSequence: true,
  ...over,
});

const org = (over: Partial<OrgShareCeilingView> = {}): OrgShareCeilingView => ({
  totalIssuedKitta: 0,
  authorizedTotalKitta: 10000,
  totalIssuedCapital: 0,
  authorizedCapitalCeiling: 1000000,
  ...over,
});

describe('nextStartKitta / computeKittaRange', () => {
  it('starts at pointer + 1 from a zero base', () => {
    expect(nextStartKitta({ kittaStartBase: null, currentKittaPointer: 0 })).toBe(1);
    expect(computeKittaRange(type({ currentKittaPointer: 209 }), 10)).toEqual({ start: 210, end: 219 });
  });

  it('jumps to kitta_start_base when the pointer has not reached it', () => {
    const t = type({ kittaStartBase: 500001, currentKittaPointer: 0 });
    expect(computeKittaRange(t, 3)).toEqual({ start: 500001, end: 500003 });
  });

  it('continues from the pointer once it passes the base', () => {
    const t = type({ kittaStartBase: 500001, currentKittaPointer: 500010 });
    expect(computeKittaRange(t, 4)).toEqual({ start: 500011, end: 500014 });
  });
});

describe('checkShareCeilings — share-type ceiling', () => {
  it('allows issuance inside the type ceiling', () => {
    expect(() =>
      checkShareCeilings({ shareType: type({ currentKittaPointer: 900 }), orgSettings: org(), quantity: 50, totalAmount: 5000 })
    ).not.toThrow();
  });

  it('rejects when the kitta range crosses the type ceiling with a remaining count', () => {
    try {
      checkShareCeilings({ shareType: type({ currentKittaPointer: 970 }), orgSettings: org(), quantity: 50, totalAmount: 5000 });
      expect.unreachable();
    } catch (e: any) {
      expect(e).toBeInstanceOf(ShareCeilingError);
      expect(e.message).toContain('Ordinary Shares can issue at most 30 more kitta (ceiling: 1000)');
    }
  });

  it('respects the manual entry end when autoSequence is off', () => {
    try {
      checkShareCeilings({
        shareType: type({ currentKittaPointer: 0, maxAllowedKitta: 900 }),
        orgSettings: org(),
        quantity: 10,
        totalAmount: 1000,
        manualEndKitta: 950,
      });
      expect.unreachable();
    } catch (e: any) {
      expect(e).toBeInstanceOf(ShareCeilingError);
    }
  });
});

describe('checkShareCeilings — org kitta ceiling', () => {
  it('rejects when the org kitta total would breach authorizedTotalKitta', () => {
    try {
      checkShareCeilings({
        shareType: type(),
        orgSettings: org({ totalIssuedKitta: 9900, authorizedTotalKitta: 10000 }),
        quantity: 200,
        totalAmount: 20000,
      });
      expect.unreachable();
    } catch (e: any) {
      expect(e).toBeInstanceOf(ShareCeilingError);
      expect(e.message).toContain('Remaining: 100 of 10000');
    }
  });
});

describe('checkShareCeilings — org capital ceiling', () => {
  it('rejects when the capital total would breach authorizedCapitalCeiling', () => {
    try {
      checkShareCeilings({
        shareType: type(),
        orgSettings: org({ totalIssuedCapital: 990000, authorizedCapitalCeiling: 1000000 }),
        quantity: 1,
        totalAmount: 20000,
      });
      expect.unreachable();
    } catch (e: any) {
      expect(e).toBeInstanceOf(ShareCeilingError);
      expect(e.message).toContain('Authorized capital ceiling reached');
      expect(e.message).toContain('NPR 10,000');
    }
  });

  it('short-circuits at the org kitta ceiling before the capital check (cheap first)', () => {
    try {
      checkShareCeilings({
        shareType: type(),
        orgSettings: org({ totalIssuedKitta: 9990, totalIssuedCapital: 0, authorizedTotalKitta: 10000 }),
        quantity: 20,
        totalAmount: 100,
      });
      expect.unreachable();
    } catch (e: any) {
      expect(e).toBeInstanceOf(ShareCeilingError);
      expect(e.message).toContain('Organization-wide kitta ceiling reached');
    }
  });
});

// ================================================================
// computeMaxAllowedKitta — dynamic per-type allocation vs org pool
// ================================================================
describe('computeMaxAllowedKitta — dynamic per-type allocation', () => {
  it('computes the available pool as authorized minus the sum of OTHER types', () => {
    // Org: 100,000 authorized. Other types hold 2,000 + 50,000 + 50,000 = 102,000.
    const r = computeMaxAllowedKitta({
      authorizedTotalKitta: 100000,
      otherTypeCeilings: [2000, 50000, 50000],
      currentCeiling: null,
    });
    expect(r.allocatedToOtherTypes).toBe(102000);
    expect(r.availablePoolForType).toBe(0);
    expect(r.allowedMax).toBe(0);
    expect(r.isOverAllocated).toBe(true);
  });

  it('leaves exact headroom when others sum to less than the authorized pool', () => {
    const r = computeMaxAllowedKitta({
      authorizedTotalKitta: 100000,
      otherTypeCeilings: [2000, 50000],
      currentCeiling: null,
    });
    expect(r.allocatedToOtherTypes).toBe(52000);
    expect(r.availablePoolForType).toBe(48000);
    expect(r.allowedMax).toBe(48000);
    expect(r.isOverAllocated).toBe(false);
  });

  it('lets an edit KEEP its existing ceiling even when the pool is currently over-allocated', () => {
    // Editing RRS (50000) while others allocate 2000 + 50000 = 52000.
    const r = computeMaxAllowedKitta({
      authorizedTotalKitta: 100000,
      otherTypeCeilings: [2000, 50000],
      currentCeiling: 50000,
    });
    expect(r.availablePoolForType).toBe(48000);
    expect(r.allowedMax).toBe(50000); // keep current, but no increases
  });

  it('does not allow a legacy unlimited sibling (null ceiling) to grant free headroom', () => {
    const r = computeMaxAllowedKitta({
      authorizedTotalKitta: 100000,
      otherTypeCeilings: [50000, null],
      currentCeiling: null,
    });
    expect(r.allocatedToOtherTypes).toBe(100000);
    expect(r.availablePoolForType).toBe(0);
    expect(r.allowedMax).toBe(0);
  });

  it('allows a brand-new first type to take the whole authorized pool', () => {
    const r = computeMaxAllowedKitta({
      authorizedTotalKitta: 100000,
      otherTypeCeilings: [],
      currentCeiling: null,
    });
    expect(r.allocatedToOtherTypes).toBe(0);
    expect(r.availablePoolForType).toBe(100000);
    expect(r.allowedMax).toBe(100000);
  });
});