/**
 * Cheque Policy Engine (चेक नीति इन्जिन)
 *
 * Pure, database-free decision functions for the cheque subsystem. These
 * encode the rules that previously lived ONLY in the React issue-book modal as
 * hardcoded constants (`MIN_UTILIZATION = 80`, `COOLDOWN_DAYS = 30`) — meaning
 * the API accepted any issuance request the client chose to send. The rules now
 * live here, are driven by the organization's own `cheque_settings` row, and are
 * called from `ChequeSettingController` so the UI pre-flight and the server
 * guard evaluate identically.
 *
 * Everything in this file is a pure function of its inputs so it can be unit
 * tested without a DB and reused verbatim by the frontend if desired. The
 * controller is responsible for gathering the rows (account, member, books,
 * stop payments) and passing them in.
 */

const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Thrown when a cheque operation is rejected by policy (mapped to HTTP 400/403 by the caller). */
export class ChequeError extends Error {
  constructor(message: string, readonly reasons: string[] = []) {
    super(message);
    this.name = 'ChequeError';
  }
}

// ─────────────────────────────────────────────────────────────
// Issuance charge (flat / per-leaf / both) + tax
// ─────────────────────────────────────────────────────────────

export interface IssuanceChargeConfig {
  issuanceChargeType: 'flat' | 'per_leaf' | 'both';
  issuanceChargeAmount: number | string;
  issuanceChargePerLeafAmount: number | string;
  taxApplicable: boolean;
  taxRate: number | string;
}

export interface ChargeBreakdown {
  /** Charge before tax. */
  base: number;
  /** Tax added on top of the base (0 when taxApplicable is false). */
  tax: number;
  /** base + tax, rounded to 2 dp — the amount to bill / post to the GL. */
  total: number;
}

/**
 * Resolve the issuance charge for a book of `leafCount` leaves. Unlike the old
 * controller path this applies `taxApplicable`/`taxRate` — configured columns
 * that were previously ignored, so tax was silently never charged.
 */
export function computeIssuanceCharge(config: IssuanceChargeConfig, leafCount: number): ChargeBreakdown {
  const leaves = Math.max(0, Math.trunc(num(leafCount)));
  const flat = num(config.issuanceChargeAmount);
  const perLeaf = num(config.issuanceChargePerLeafAmount);

  let base = 0;
  if (config.issuanceChargeType === 'flat') base = flat;
  else if (config.issuanceChargeType === 'per_leaf') base = perLeaf * leaves;
  else if (config.issuanceChargeType === 'both') base = flat + perLeaf * leaves;

  base = round2(base);
  const rate = config.taxApplicable ? num(config.taxRate) : 0;
  const tax = round2(base * (rate / 100));
  return { base, tax, total: round2(base + tax) };
}

// ─────────────────────────────────────────────────────────────
// Issuance eligibility
// ─────────────────────────────────────────────────────────────

export interface IssuanceEligibilityPolicy {
  enableChequeFacility: boolean;
  eligibleAccountProductIds: string[];
  maxActiveBooksPerAccount: number;
  reissueAllowed: boolean;
  reissueAfterExhaustion: boolean;
  requireKycVerified: boolean;
  blockBlacklistedMembers: boolean;
  /** Minimum % of the latest book that must be used before a reissue (0 disables). */
  minUtilizationForReissue: number;
  /** Minimum days since the last issuance before another book is allowed (0 disables). */
  reissueCooldownDays: number;
  allowedBookSizes: number[];
  allowSupervisorOverride: boolean;
}

export interface EligibilityBookInput {
  id: string;
  status: string;          // active | exhausted | cancelled | lost | replaced
  leafCount: number;
  usedLeaves: number;      // leaves not in 'unused' status
  issuedDateBs: string;
}

export interface IssuanceEligibilityInput {
  policy: IssuanceEligibilityPolicy;
  account: { status: string; savingsProductId: string | null };
  member: { kycStatus: string; status: string };
  books: EligibilityBookInput[];
  requestedLeafCount: number | null;
  todayBs: string;
  /** Present + non-empty when a supervisor is overriding soft blocks. */
  overrideReason?: string | null;
  /** The overriding actor's role — override is only honoured for a supervisor. */
  overrideRole?: string | null;
}

export interface EligibilityResult {
  /** True when the book may be issued (no blocks, OR only soft blocks that a valid override cleared). */
  eligible: boolean;
  /** Blocks that can never be bypassed (facility off, ineligible product, closed account…). */
  hardBlocks: string[];
  /** Blocks a supervisor may override with a reason (dormant, KYC, utilisation, cooldown…). */
  softBlocks: string[];
  /** hardBlocks ∪ softBlocks — for display. */
  reasons: string[];
  /** True when softBlocks exist, there are no hardBlocks, and the org permits override. */
  overridable: boolean;
  /** True when a valid supervisor override was supplied and applied. */
  overrideApplied: boolean;
  /** Utilisation % of the latest book (null when the account has no prior book). */
  latestUtilization: number | null;
  /** Whole days since the most recent issuance (null when none). */
  daysSinceLastIssue: number | null;
}

const SUPERVISOR_ROLES = new Set(['org_admin', 'manager']);

/** Utilisation % of a book (used leaves ÷ total leaves). */
export function bookUtilization(book: { leafCount: number; usedLeaves: number }): number {
  const total = Math.max(0, num(book.leafCount));
  if (total === 0) return 0;
  return Math.round((Math.max(0, num(book.usedLeaves)) / total) * 100);
}

/**
 * Decide whether a cheque book may be issued to an account. Ordered so the
 * cheapest / most fundamental gates fail first. Returns a structured verdict;
 * the caller throws `ChequeError` (or applies the override) based on it.
 *
 * `daysBetween` is injected so this stays free of the BS-calendar dependency
 * and testable — the controller passes `daysBetweenBS` from financialEngine.
 */
export function evaluateIssuanceEligibility(
  input: IssuanceEligibilityInput,
  daysBetween: (fromBs: string, toBs: string) => number,
): EligibilityResult {
  const { policy, account, member, books } = input;
  const hardBlocks: string[] = [];
  const softBlocks: string[] = [];

  // 1. Facility master switch.
  if (!policy.enableChequeFacility) {
    hardBlocks.push('Cheque facility is disabled for this organization.');
  }

  // 2. Product eligibility (empty allow-list = every product is eligible).
  if (policy.eligibleAccountProductIds.length > 0) {
    if (!account.savingsProductId || !policy.eligibleAccountProductIds.includes(account.savingsProductId)) {
      hardBlocks.push('This savings product is not eligible for a cheque facility.');
    }
  }

  // 3. Account status. Closed / Matured is a hard stop; Dormant is overridable.
  const acctStatus = (account.status || '').toLowerCase();
  if (acctStatus === 'closed' || acctStatus === 'matured') {
    hardBlocks.push(`Account is ${account.status} — cheque books cannot be issued.`);
  } else if (acctStatus !== 'active') {
    softBlocks.push(`Account is ${account.status || 'inactive'}, not Active.`);
  }

  // 4. Member standing.
  if (policy.blockBlacklistedMembers && (member.status || '').toLowerCase() === 'blacklisted') {
    hardBlocks.push('Member is blacklisted — cheque issuance is blocked.');
  }
  if (policy.requireKycVerified && (member.kycStatus || '').toLowerCase() !== 'verified') {
    softBlocks.push(`Member KYC is ${member.kycStatus || 'incomplete'} — must be Verified.`);
  }

  // 5. Active-book / reissue gates.
  const activeBooks = books.filter((b) => (b.status || '').toLowerCase() === 'active');
  const maxActive = Math.max(1, num(policy.maxActiveBooksPerAccount) || 1);
  const hasIssuedBefore = books.length > 0;

  if (activeBooks.length >= maxActive) {
    if (!policy.reissueAllowed) {
      hardBlocks.push(`Reissue is disabled and the account already holds ${activeBooks.length} active book(s).`);
    } else {
      softBlocks.push(`Account already holds ${activeBooks.length} active book(s); the limit is ${maxActive}.`);
    }
  }

  // Reissue after exhaustion: latest book exhausted + no active book + flag off → hard stop.
  const latestBook = [...books].sort((a, b) => (b.issuedDateBs || '').localeCompare(a.issuedDateBs || ''))[0] || null;
  if (
    activeBooks.length === 0 &&
    latestBook &&
    (latestBook.status || '').toLowerCase() === 'exhausted' &&
    !policy.reissueAfterExhaustion
  ) {
    hardBlocks.push('Reissue after exhaustion is disabled for this organization.');
  }

  // 6. Utilisation + cooldown — only meaningful on a reissue (a prior book exists).
  let latestUtilization: number | null = null;
  let daysSinceLastIssue: number | null = null;
  if (hasIssuedBefore && latestBook) {
    latestUtilization = bookUtilization(latestBook);
    if (policy.minUtilizationForReissue > 0 && latestUtilization < policy.minUtilizationForReissue) {
      softBlocks.push(
        `Latest book is only ${latestUtilization}% used — a minimum of ${policy.minUtilizationForReissue}% is required before reissue.`,
      );
    }
    if (policy.reissueCooldownDays > 0 && latestBook.issuedDateBs) {
      const gap = daysBetween(latestBook.issuedDateBs, input.todayBs);
      daysSinceLastIssue = gap;
      if (gap >= 0 && gap < policy.reissueCooldownDays) {
        softBlocks.push(
          `Only ${gap} day(s) since the last issuance — a ${policy.reissueCooldownDays}-day cooling period applies.`,
        );
      }
    }
  }

  // 7. Requested leaf count must be an allowed book size (when the org constrains sizes).
  if (input.requestedLeafCount != null && policy.allowedBookSizes.length > 0) {
    if (!policy.allowedBookSizes.includes(input.requestedLeafCount)) {
      hardBlocks.push(
        `${input.requestedLeafCount} leaves is not an allowed book size (${policy.allowedBookSizes.join(', ')}).`,
      );
    }
  }

  // Override resolution.
  const overrideProvided = !!(input.overrideReason && input.overrideReason.trim().length > 4);
  const overrideRoleOk = !input.overrideRole || SUPERVISOR_ROLES.has(input.overrideRole);
  const overridable = hardBlocks.length === 0 && softBlocks.length > 0 && policy.allowSupervisorOverride;
  const overrideApplied = overridable && overrideProvided && overrideRoleOk;

  const eligible = hardBlocks.length === 0 && (softBlocks.length === 0 || overrideApplied);

  return {
    eligible,
    hardBlocks,
    softBlocks,
    reasons: [...hardBlocks, ...softBlocks],
    overridable,
    overrideApplied,
    latestUtilization,
    daysSinceLastIssue,
  };
}

// ─────────────────────────────────────────────────────────────
// Cheque-number range membership (stop payments)
// ─────────────────────────────────────────────────────────────

/** Trailing numeric portion of a cheque number ("CHQ-000123" → 123), or null. */
export function chequeNumericValue(chequeNumber: string): number | null {
  const m = String(chequeNumber ?? '').match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Whether `chequeNumber` falls within [start, end] inclusive. Compares the
 * numeric tail when all three parse (order-independent), else falls back to a
 * lexicographic range. This is the shared primitive that makes stop-payment
 * *ranges* actually cover every leaf — previously only the exact start leaf was
 * ever flagged.
 */
export function chequeNumberInRange(chequeNumber: string, start: string, end: string): boolean {
  const n = chequeNumericValue(chequeNumber);
  const s = chequeNumericValue(start);
  const e = chequeNumericValue(end);
  if (n !== null && s !== null && e !== null) {
    return n >= Math.min(s, e) && n <= Math.max(s, e);
  }
  const lo = start <= end ? start : end;
  const hi = start <= end ? end : start;
  return chequeNumber >= lo && chequeNumber <= hi;
}

// ─────────────────────────────────────────────────────────────
// Presentation block (stop payment + validity/expiry)
// ─────────────────────────────────────────────────────────────

export interface StopPaymentRange {
  startChequeNumber: string;
  endChequeNumber: string;
  status: string;   // only 'approved' blocks
}

export interface PresentationCheckInput {
  leaf: { chequeNumber: string; status: string; chequeDateBs?: string | null };
  book: { status: string } | null;
  stopPayments: StopPaymentRange[];
  /** Date the validity window is measured from — the cheque's own date, else the book issue date. */
  referenceDateBs: string | null;
  validityPeriodDays: number;
  expiredChequeBehavior: 'flag_only' | 'reject_presentation' | 'require_approval';
  todayBs: string;
}

export interface PresentationCheck {
  blocked: boolean;
  reason?: string;
  code?: 'status' | 'book_inactive' | 'stopped' | 'expired';
  /** True when the cheque is past its validity window (regardless of whether that blocks). */
  expired: boolean;
  /** True when expiry needs manager approval rather than an outright block. */
  requiresApproval: boolean;
}

/**
 * Decide whether a cheque leaf may be presented / paid. Layers, in order:
 * leaf status → book status → approved stop-payment ranges → validity expiry.
 * Kept pure; `daysBetween` is injected as in evaluateIssuanceEligibility.
 */
export function evaluatePresentation(
  input: PresentationCheckInput,
  daysBetween: (fromBs: string, toBs: string) => number,
): PresentationCheck {
  const status = (input.leaf.status || '').toLowerCase();

  // 1. Leaf status.
  if (status === 'stopped') {
    return { blocked: true, reason: 'This cheque is stopped. Payments on it are blocked.', code: 'stopped', expired: false, requiresApproval: false };
  }
  if (status === 'cancelled') {
    return { blocked: true, reason: 'This cheque has been cancelled and cannot be used.', code: 'status', expired: false, requiresApproval: false };
  }
  if (status === 'used') {
    return { blocked: true, reason: 'This cheque has already been used for a payment.', code: 'status', expired: false, requiresApproval: false };
  }
  if (status === 'bounced') {
    return { blocked: true, reason: 'This cheque was previously dishonoured (bounced).', code: 'status', expired: false, requiresApproval: false };
  }
  if (status !== 'unused') {
    return { blocked: true, reason: `Cheque leaf is not available (${input.leaf.status}).`, code: 'status', expired: false, requiresApproval: false };
  }

  // 2. Book status.
  if (input.book && (input.book.status || '').toLowerCase() !== 'active') {
    return { blocked: true, reason: 'Cheque book is not active.', code: 'book_inactive', expired: false, requiresApproval: false };
  }

  // 3. Approved stop-payment ranges (defense in depth — leaves are also flipped
  //    to 'stopped' on approval, but a range approved after this leaf existed
  //    must still catch it).
  const stopped = input.stopPayments.some(
    (sp) => (sp.status || '').toLowerCase() === 'approved' &&
      chequeNumberInRange(input.leaf.chequeNumber, sp.startChequeNumber, sp.endChequeNumber),
  );
  if (stopped) {
    return { blocked: true, reason: 'A stop-payment order covers this cheque. Payment is blocked.', code: 'stopped', expired: false, requiresApproval: false };
  }

  // 4. Validity / expiry.
  let expired = false;
  if (input.validityPeriodDays > 0 && input.referenceDateBs) {
    const age = daysBetween(input.referenceDateBs, input.todayBs);
    if (age > input.validityPeriodDays) expired = true;
  }
  if (expired) {
    if (input.expiredChequeBehavior === 'reject_presentation') {
      return { blocked: true, reason: `Cheque is stale — older than the ${input.validityPeriodDays}-day validity window.`, code: 'expired', expired: true, requiresApproval: false };
    }
    if (input.expiredChequeBehavior === 'require_approval') {
      return { blocked: true, reason: `Cheque is past its ${input.validityPeriodDays}-day validity window and needs manager approval.`, code: 'expired', expired: true, requiresApproval: true };
    }
    // flag_only → allowed, but surfaced as expired.
    return { blocked: false, expired: true, requiresApproval: false };
  }

  return { blocked: false, expired: false, requiresApproval: false };
}
