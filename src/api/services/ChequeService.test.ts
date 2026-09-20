/**
 * Cheque policy-engine tests (चेक नीति इन्जिन).
 *
 * `ChequeService` is deliberately DB-free: every export is a pure function of
 * its inputs, with `daysBetween` injected so the BS-calendar dependency stays
 * out. That lets these run as plain unit tests with no fake DB or mocking.
 *
 * Covered:
 *   - computeIssuanceCharge     — flat / per-leaf / both + optional tax
 *   - bookUtilization           — used ÷ total, rounded %
 *   - evaluateIssuanceEligibility — the hard/soft block + supervisor-override matrix
 *   - chequeNumericValue / chequeNumberInRange — stop-payment range membership
 *   - evaluatePresentation      — status → book → stop-payment → expiry layering
 */
import { describe, it, expect } from 'vitest';
import {
  computeIssuanceCharge,
  bookUtilization,
  evaluateIssuanceEligibility,
  chequeNumericValue,
  chequeNumberInRange,
  evaluatePresentation,
} from './ChequeService';
import type {
  IssuanceChargeConfig,
  IssuanceEligibilityPolicy,
  IssuanceEligibilityInput,
  PresentationCheckInput,
} from './ChequeService';

// ─────────────────────────────────────────────────────────────
// computeIssuanceCharge
// ─────────────────────────────────────────────────────────────

function chargeConfig(over: Partial<IssuanceChargeConfig> = {}): IssuanceChargeConfig {
  return {
    issuanceChargeType: 'flat',
    issuanceChargeAmount: 100,
    issuanceChargePerLeafAmount: 5,
    taxApplicable: false,
    taxRate: 13,
    ...over,
  };
}

describe('computeIssuanceCharge', () => {
  it('charges a flat fee regardless of leaf count', () => {
    expect(computeIssuanceCharge(chargeConfig({ issuanceChargeType: 'flat' }), 25)).toEqual({
      base: 100,
      tax: 0,
      total: 100,
    });
  });

  it('charges per leaf', () => {
    const r = computeIssuanceCharge(chargeConfig({ issuanceChargeType: 'per_leaf' }), 25);
    expect(r.base).toBe(125); // 5 × 25
    expect(r.total).toBe(125);
  });

  it('charges flat + per leaf for the "both" type', () => {
    const r = computeIssuanceCharge(chargeConfig({ issuanceChargeType: 'both' }), 10);
    expect(r.base).toBe(150); // 100 + 5 × 10
  });

  it('adds tax on top of the base when taxApplicable', () => {
    const r = computeIssuanceCharge(
      chargeConfig({ issuanceChargeType: 'flat', issuanceChargeAmount: 200, taxApplicable: true, taxRate: 13 }),
      25,
    );
    expect(r.base).toBe(200);
    expect(r.tax).toBe(26); // 13% of 200
    expect(r.total).toBe(226);
  });

  it('ignores the tax rate when tax is not applicable', () => {
    const r = computeIssuanceCharge(
      chargeConfig({ issuanceChargeType: 'flat', issuanceChargeAmount: 200, taxApplicable: false, taxRate: 13 }),
      25,
    );
    expect(r.tax).toBe(0);
    expect(r.total).toBe(200);
  });

  it('coerces string amounts', () => {
    const r = computeIssuanceCharge(
      chargeConfig({ issuanceChargeType: 'per_leaf', issuanceChargePerLeafAmount: '5' as unknown as number }),
      10,
    );
    expect(r.base).toBe(50);
  });

  it('treats a negative leaf count as zero leaves', () => {
    const r = computeIssuanceCharge(chargeConfig({ issuanceChargeType: 'per_leaf' }), -5);
    expect(r.base).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// bookUtilization
// ─────────────────────────────────────────────────────────────

describe('bookUtilization', () => {
  it('computes used ÷ total as a rounded percentage', () => {
    expect(bookUtilization({ leafCount: 25, usedLeaves: 20 })).toBe(80);
  });

  it('rounds to the nearest whole percent', () => {
    expect(bookUtilization({ leafCount: 3, usedLeaves: 1 })).toBe(33);
    expect(bookUtilization({ leafCount: 3, usedLeaves: 2 })).toBe(67);
  });

  it('returns 0 for an empty book (no divide-by-zero)', () => {
    expect(bookUtilization({ leafCount: 0, usedLeaves: 0 })).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// evaluateIssuanceEligibility
// ─────────────────────────────────────────────────────────────

function policy(over: Partial<IssuanceEligibilityPolicy> = {}): IssuanceEligibilityPolicy {
  return {
    enableChequeFacility: true,
    eligibleAccountProductIds: [],
    maxActiveBooksPerAccount: 1,
    reissueAllowed: true,
    reissueAfterExhaustion: true,
    requireKycVerified: true,
    blockBlacklistedMembers: true,
    minUtilizationForReissue: 80,
    reissueCooldownDays: 30,
    allowedBookSizes: [10, 25, 50, 100],
    allowSupervisorOverride: true,
    ...over,
  };
}

function eligibilityInput(over: Partial<IssuanceEligibilityInput> = {}): IssuanceEligibilityInput {
  return {
    policy: policy(),
    account: { status: 'active', savingsProductId: 'prod-1' },
    member: { kycStatus: 'verified', status: 'active' },
    books: [],
    requestedLeafCount: 25,
    todayBs: '2083-05-01',
    ...over,
  };
}

/** Deterministic stub; each test that cares about cooldown passes its own gap. */
const daysBetweenStub = (gap: number) => () => gap;

describe('evaluateIssuanceEligibility', () => {
  it('approves a clean first-time issuance', () => {
    const r = evaluateIssuanceEligibility(eligibilityInput(), daysBetweenStub(9999));
    expect(r.eligible).toBe(true);
    expect(r.hardBlocks).toHaveLength(0);
    expect(r.softBlocks).toHaveLength(0);
    expect(r.latestUtilization).toBeNull();
    expect(r.daysSinceLastIssue).toBeNull();
  });

  it('hard-blocks when the cheque facility is disabled', () => {
    const r = evaluateIssuanceEligibility(
      eligibilityInput({ policy: policy({ enableChequeFacility: false }) }),
      daysBetweenStub(9999),
    );
    expect(r.eligible).toBe(false);
    expect(r.hardBlocks[0]).toMatch(/disabled/i);
    expect(r.overridable).toBe(false);
  });

  it('hard-blocks a product outside the eligible allow-list', () => {
    const r = evaluateIssuanceEligibility(
      eligibilityInput({ policy: policy({ eligibleAccountProductIds: ['other-prod'] }) }),
      daysBetweenStub(9999),
    );
    expect(r.eligible).toBe(false);
    expect(r.hardBlocks.some((h) => /not eligible/i.test(h))).toBe(true);
  });

  it('allows a product that is on the eligible allow-list', () => {
    const r = evaluateIssuanceEligibility(
      eligibilityInput({ policy: policy({ eligibleAccountProductIds: ['prod-1'] }) }),
      daysBetweenStub(9999),
    );
    expect(r.eligible).toBe(true);
  });

  it('hard-blocks a closed account', () => {
    const r = evaluateIssuanceEligibility(
      eligibilityInput({ account: { status: 'closed', savingsProductId: 'prod-1' } }),
      daysBetweenStub(9999),
    );
    expect(r.eligible).toBe(false);
    expect(r.hardBlocks.some((h) => /closed/i.test(h))).toBe(true);
  });

  it('soft-blocks a dormant account and marks it overridable', () => {
    const r = evaluateIssuanceEligibility(
      eligibilityInput({ account: { status: 'dormant', savingsProductId: 'prod-1' } }),
      daysBetweenStub(9999),
    );
    expect(r.eligible).toBe(false);
    expect(r.softBlocks.length).toBeGreaterThan(0);
    expect(r.overridable).toBe(true);
    expect(r.overrideApplied).toBe(false);
  });

  it('clears a soft block with a valid supervisor override', () => {
    const r = evaluateIssuanceEligibility(
      eligibilityInput({
        account: { status: 'dormant', savingsProductId: 'prod-1' },
        overrideReason: 'Manager approved reactivation for this member',
        overrideRole: 'manager',
      }),
      daysBetweenStub(9999),
    );
    expect(r.overrideApplied).toBe(true);
    expect(r.eligible).toBe(true);
  });

  it('does not honour an override from a non-supervisor role', () => {
    const r = evaluateIssuanceEligibility(
      eligibilityInput({
        account: { status: 'dormant', savingsProductId: 'prod-1' },
        overrideReason: 'Please just let this through',
        overrideRole: 'teller',
      }),
      daysBetweenStub(9999),
    );
    expect(r.overrideApplied).toBe(false);
    expect(r.eligible).toBe(false);
  });

  it('hard-blocks a blacklisted member', () => {
    const r = evaluateIssuanceEligibility(
      eligibilityInput({ member: { kycStatus: 'verified', status: 'blacklisted' } }),
      daysBetweenStub(9999),
    );
    expect(r.eligible).toBe(false);
    expect(r.hardBlocks.some((h) => /blacklisted/i.test(h))).toBe(true);
  });

  it('soft-blocks an unverified KYC member', () => {
    const r = evaluateIssuanceEligibility(
      eligibilityInput({ member: { kycStatus: 'pending', status: 'active' } }),
      daysBetweenStub(9999),
    );
    expect(r.softBlocks.some((s) => /kyc/i.test(s))).toBe(true);
    expect(r.overridable).toBe(true);
  });

  it('hard-blocks a reissue when reissue is disabled and a book is already active', () => {
    const r = evaluateIssuanceEligibility(
      eligibilityInput({
        policy: policy({ reissueAllowed: false, maxActiveBooksPerAccount: 1 }),
        books: [{ id: 'b1', status: 'active', leafCount: 25, usedLeaves: 25, issuedDateBs: '2083-01-01' }],
      }),
      daysBetweenStub(9999),
    );
    expect(r.eligible).toBe(false);
    expect(r.hardBlocks.some((h) => /reissue is disabled/i.test(h))).toBe(true);
  });

  it('soft-blocks exceeding the active-book limit when reissue is allowed, and reports utilisation', () => {
    const r = evaluateIssuanceEligibility(
      eligibilityInput({
        policy: policy({ reissueAllowed: true, maxActiveBooksPerAccount: 1 }),
        books: [{ id: 'b1', status: 'active', leafCount: 25, usedLeaves: 25, issuedDateBs: '2083-04-20' }],
      }),
      daysBetweenStub(100), // past the cooldown, so only the active-limit soft block fires
    );
    expect(r.softBlocks.some((s) => /active book/i.test(s))).toBe(true);
    expect(r.latestUtilization).toBe(100);
    expect(r.overridable).toBe(true);
  });

  it('soft-blocks a reissue below the minimum utilisation', () => {
    const r = evaluateIssuanceEligibility(
      eligibilityInput({
        policy: policy({ maxActiveBooksPerAccount: 2, minUtilizationForReissue: 80 }),
        books: [{ id: 'b1', status: 'active', leafCount: 100, usedLeaves: 50, issuedDateBs: '2083-04-01' }],
      }),
      daysBetweenStub(100),
    );
    expect(r.latestUtilization).toBe(50);
    expect(r.softBlocks.some((s) => /used/i.test(s))).toBe(true);
  });

  it('soft-blocks within the reissue cooldown window and reports the gap', () => {
    const r = evaluateIssuanceEligibility(
      eligibilityInput({
        policy: policy({ reissueAfterExhaustion: true, reissueCooldownDays: 30 }),
        books: [{ id: 'b1', status: 'exhausted', leafCount: 25, usedLeaves: 25, issuedDateBs: '2083-04-20' }],
      }),
      daysBetweenStub(10),
    );
    expect(r.daysSinceLastIssue).toBe(10);
    expect(r.softBlocks.some((s) => /cooling|day/i.test(s))).toBe(true);
  });

  it('hard-blocks reissue after exhaustion when the org forbids it', () => {
    const r = evaluateIssuanceEligibility(
      eligibilityInput({
        policy: policy({ reissueAfterExhaustion: false }),
        books: [{ id: 'b1', status: 'exhausted', leafCount: 25, usedLeaves: 25, issuedDateBs: '2083-04-20' }],
      }),
      daysBetweenStub(9999),
    );
    expect(r.eligible).toBe(false);
    expect(r.hardBlocks.some((h) => /exhaustion/i.test(h))).toBe(true);
  });

  it('hard-blocks a requested leaf count outside the allowed sizes', () => {
    const r = evaluateIssuanceEligibility(
      eligibilityInput({ requestedLeafCount: 7 }),
      daysBetweenStub(9999),
    );
    expect(r.eligible).toBe(false);
    expect(r.hardBlocks.some((h) => /allowed book size/i.test(h))).toBe(true);
  });

  it('is never overridable while any hard block stands', () => {
    const r = evaluateIssuanceEligibility(
      eligibilityInput({
        policy: policy({ enableChequeFacility: false }),
        account: { status: 'dormant', savingsProductId: 'prod-1' }, // also a soft block
      }),
      daysBetweenStub(9999),
    );
    expect(r.hardBlocks.length).toBeGreaterThan(0);
    expect(r.softBlocks.length).toBeGreaterThan(0);
    expect(r.overridable).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// chequeNumericValue + chequeNumberInRange
// ─────────────────────────────────────────────────────────────

describe('chequeNumericValue', () => {
  it('extracts the trailing numeric portion', () => {
    expect(chequeNumericValue('CHQ-000123')).toBe(123);
    expect(chequeNumericValue('CHQ-100234')).toBe(100234);
  });

  it('parses a bare numeric string', () => {
    expect(chequeNumericValue('000500')).toBe(500);
  });

  it('returns null when there is no trailing number', () => {
    expect(chequeNumericValue('ABC')).toBeNull();
    expect(chequeNumericValue('')).toBeNull();
  });
});

describe('chequeNumberInRange', () => {
  it('includes a number inside a numeric range', () => {
    expect(chequeNumberInRange('CHQ-000150', 'CHQ-000100', 'CHQ-000200')).toBe(true);
  });

  it('is inclusive at both boundaries', () => {
    expect(chequeNumberInRange('CHQ-000100', 'CHQ-000100', 'CHQ-000200')).toBe(true);
    expect(chequeNumberInRange('CHQ-000200', 'CHQ-000100', 'CHQ-000200')).toBe(true);
  });

  it('excludes a number outside the range', () => {
    expect(chequeNumberInRange('CHQ-000250', 'CHQ-000100', 'CHQ-000200')).toBe(false);
  });

  it('is order-independent when the range is reversed', () => {
    expect(chequeNumberInRange('CHQ-000150', 'CHQ-000200', 'CHQ-000100')).toBe(true);
  });

  it('falls back to lexicographic comparison without numeric tails', () => {
    expect(chequeNumberInRange('CHQ-B', 'CHQ-A', 'CHQ-C')).toBe(true);
    expect(chequeNumberInRange('CHQ-Z', 'CHQ-A', 'CHQ-C')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// evaluatePresentation
// ─────────────────────────────────────────────────────────────

function presentationInput(over: Partial<PresentationCheckInput> = {}): PresentationCheckInput {
  return {
    leaf: { chequeNumber: 'CHQ-000100', status: 'unused', chequeDateBs: '2083-04-01' },
    book: { status: 'active' },
    stopPayments: [],
    referenceDateBs: '2083-04-01',
    validityPeriodDays: 180,
    expiredChequeBehavior: 'flag_only',
    todayBs: '2083-04-10',
    ...over,
  };
}

describe('evaluatePresentation', () => {
  it('allows a fresh, unused cheque on an active book', () => {
    const r = evaluatePresentation(presentationInput(), daysBetweenStub(9));
    expect(r.blocked).toBe(false);
    expect(r.expired).toBe(false);
    expect(r.requiresApproval).toBe(false);
  });

  it('blocks a stopped leaf', () => {
    const r = evaluatePresentation(
      presentationInput({ leaf: { chequeNumber: 'CHQ-000100', status: 'stopped' } }),
      daysBetweenStub(9),
    );
    expect(r.blocked).toBe(true);
    expect(r.code).toBe('stopped');
  });

  it('blocks an already-used leaf', () => {
    const r = evaluatePresentation(
      presentationInput({ leaf: { chequeNumber: 'CHQ-000100', status: 'used' } }),
      daysBetweenStub(9),
    );
    expect(r.blocked).toBe(true);
    expect(r.code).toBe('status');
  });

  it('blocks a cancelled leaf', () => {
    const r = evaluatePresentation(
      presentationInput({ leaf: { chequeNumber: 'CHQ-000100', status: 'cancelled' } }),
      daysBetweenStub(9),
    );
    expect(r.blocked).toBe(true);
    expect(r.code).toBe('status');
  });

  it('blocks when the book is not active', () => {
    const r = evaluatePresentation(
      presentationInput({ book: { status: 'cancelled' } }),
      daysBetweenStub(9),
    );
    expect(r.blocked).toBe(true);
    expect(r.code).toBe('book_inactive');
  });

  it('blocks a leaf covered by an approved stop-payment range', () => {
    const r = evaluatePresentation(
      presentationInput({
        leaf: { chequeNumber: 'CHQ-000150', status: 'unused' },
        stopPayments: [{ startChequeNumber: 'CHQ-000100', endChequeNumber: 'CHQ-000200', status: 'approved' }],
      }),
      daysBetweenStub(9),
    );
    expect(r.blocked).toBe(true);
    expect(r.code).toBe('stopped');
  });

  it('ignores a stop-payment range that is only pending', () => {
    const r = evaluatePresentation(
      presentationInput({
        leaf: { chequeNumber: 'CHQ-000150', status: 'unused' },
        stopPayments: [{ startChequeNumber: 'CHQ-000100', endChequeNumber: 'CHQ-000200', status: 'pending' }],
      }),
      daysBetweenStub(9),
    );
    expect(r.blocked).toBe(false);
  });

  it('rejects a stale cheque when the behaviour is reject_presentation', () => {
    const r = evaluatePresentation(
      presentationInput({ expiredChequeBehavior: 'reject_presentation' }),
      daysBetweenStub(200), // 200 > 180-day validity
    );
    expect(r.blocked).toBe(true);
    expect(r.code).toBe('expired');
    expect(r.expired).toBe(true);
    expect(r.requiresApproval).toBe(false);
  });

  it('routes a stale cheque to approval when the behaviour is require_approval', () => {
    const r = evaluatePresentation(
      presentationInput({ expiredChequeBehavior: 'require_approval' }),
      daysBetweenStub(200),
    );
    expect(r.blocked).toBe(true);
    expect(r.code).toBe('expired');
    expect(r.requiresApproval).toBe(true);
  });

  it('flags but does not block a stale cheque when the behaviour is flag_only', () => {
    const r = evaluatePresentation(
      presentationInput({ expiredChequeBehavior: 'flag_only' }),
      daysBetweenStub(200),
    );
    expect(r.blocked).toBe(false);
    expect(r.expired).toBe(true);
  });
});
