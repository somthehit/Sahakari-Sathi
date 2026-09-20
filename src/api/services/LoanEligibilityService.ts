/**
 * Loan Eligibility Service (Member Lifecycle — Stage 4)
 *
 * Evaluates a member against a loan product's eligibility criteria before an
 * application can be created. Criteria are stored per loan product on
 * loan_products:
 *   - minMembershipMonths      (BS-calendar tenure; 0 = not enforced)
 *   - minShareAmount           (member's share capital value; 0 = not enforced)
 *   - requireActiveSavings     (must hold ≥ 1 Active savings account)
 *   - minSavingsBalance        (sum of Active savings balances; 0 = not enforced)
 *   - requireVerifiedKyc       (member.kycStatus must be 'Verified')
 *   - allowEligibilityOverride (org_admin/manager may override with a reason)
 *
 * Every eligible member must additionally be in an 'Active' standing (not
 * Dormant/Blacklisted/Suspended/Closed).
 *
 * evaluate() never throws for an ineligible member — it returns the decision
 * with human-readable reasons so the UI can render an override path.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { loanProducts } from '../../db/schema';
import { members, memberFinancialProfiles, savingsAccounts, shareAccounts } from '../../db/schema';
import { DateConverter } from '../../utils/DateConverter';

export interface EligibilityCheck {
  key: string;
  label: string;
  ok: boolean;
  required: string;
  actual: string;
}

export interface LoanEligibilityDecision {
  eligible: boolean;
  /** Product allows the eligibility gate to be overridden by an approver. */
  allowOverride: boolean;
  /** Human-readable reasons for ineligibility (empty when eligible). */
  reasons: string[];
  /** Per-criteria breakdown for the UI. */
  checks: EligibilityCheck[];
}

export class LoanEligibilityService {
  /**
   * Number of full BS months between `membershipDateBs` (YYYY-MM-DD) and today.
   * Handles year/month rollover; a partial final month counts as a full month
   * once the day-of-month has been reached.
   */
  private bsMonthsBetween(membershipDateBs: string): number {
    const parts = (membershipDateBs || '').split('-').map((p) => parseInt(p, 10));
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1])) return 0;

    const today = DateConverter.getTodayBs().split('-').map((p) => parseInt(p, 10));
    const [mYear, mMonth, mDay] = parts;
    const [tYear, tMonth, tDay] = today;

    let months = (tYear - mYear) * 12 + (tMonth - mMonth);
    if (tDay < mDay) months -= 1;
    return Math.max(0, months);
  }

  async evaluate(organizationId: string, memberId: string, loanProductId: string): Promise<LoanEligibilityDecision> {
    const db = getDb();
    if (!db) throw new Error('Database connection unavailable.');
    if (!organizationId || !memberId || !loanProductId) {
      throw new Error('Organization, member and loan product are required.');
    }

    const [product] = await db.select().from(loanProducts)
      .where(eq(loanProducts.id, loanProductId))
      .limit(1);
    if (!product || String(product.organizationId) !== String(organizationId)) {
      throw new Error('Loan product not found.');
    }

    const [member] = await db.select().from(members)
      .where(eq(members.id, memberId))
      .limit(1);
    if (!member || String(member.organizationId) !== String(organizationId)) {
      throw new Error('Member not found.');
    }

    const [share] = await db.select().from(shareAccounts)
      .where(eq(shareAccounts.memberId, memberId))
      .limit(1);
    const shareCapital = share ? parseFloat(share.totalCapitalAmount) || 0 : 0;
    const shareCount = share ? share.totalShares || 0 : 0;

    const activeAccounts = await db.select().from(savingsAccounts)
      .where(eq(savingsAccounts.memberId, memberId))
      .then((rows) => rows.filter((r) => r.status === 'Active'));
    const activeSavingsCount = activeAccounts.length;
    const savingsBalance = activeAccounts.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);

    const [finProfile] = await db.select().from(memberFinancialProfiles)
      .where(eq(memberFinancialProfiles.memberId, memberId))
      .limit(1);
    const overdue = finProfile ? parseFloat(finProfile.overdueAmount) || 0 : 0;

    const { minMembershipMonths, minShareAmount, requireActiveSavings, minSavingsBalance, requireVerifiedKyc, allowEligibilityOverride } = product;
    const minShare = parseFloat(String(minShareAmount)) || 0;
    const minSavings = parseFloat(String(minSavingsBalance)) || 0;

    const checks: EligibilityCheck[] = [];

    const standingOk = member.status === 'Active';
    checks.push({
      key: 'member_standing',
      label: 'Member standing',
      ok: standingOk,
      required: 'Status must be Active',
      actual: String(member.status),
    });

    const membershipOk = !minMembershipMonths || this.bsMonthsBetween(member.membershipDateBs) >= minMembershipMonths;
    checks.push({
      key: 'membership_duration',
      label: 'Membership duration',
      ok: membershipOk,
      required: `≥ ${minMembershipMonths} month(s)`,
      actual: `${this.bsMonthsBetween(member.membershipDateBs)} month(s) since ${member.membershipDateBs}`,
    });

    const sharesOk = !minShare || shareCapital >= minShare;
    checks.push({
      key: 'share_balance',
      label: 'Share balance',
      ok: sharesOk,
      required: `≥ ${minShare} in share capital`,
      actual: `${shareCount} share(s) / ${shareCapital} in capital`,
    });

    const savingsOk = !requireActiveSavings || (activeSavingsCount > 0 && savingsBalance >= minSavings);
    checks.push({
      key: 'active_savings',
      label: 'Active savings',
      ok: savingsOk,
      required: requireActiveSavings
        ? (minSavings > 0 ? `≥ 1 active account with balance ≥ ${minSavings}` : '≥ 1 active account')
        : 'Not required',
      actual: `${activeSavingsCount} active account(s) / ${savingsBalance} balance`,
    });

    const kycOk = !requireVerifiedKyc || member.kycStatus === 'Verified';
    checks.push({
      key: 'kyc_status',
      label: 'KYC verification',
      ok: kycOk,
      required: requireVerifiedKyc ? 'KYC must be Verified' : 'Not required',
      actual: String(member.kycStatus),
    });

    const cleanStandingOk = overdue <= 0;
    checks.push({
      key: 'overdue_status',
      label: 'No overdue balances',
      ok: cleanStandingOk,
      required: 'No overdue balances',
      actual: overdue > 0 ? `Rs ${overdue} overdue` : 'No overdue balances',
    });

    const reasons: string[] = [];
    for (const check of checks) {
      if (!check.ok) reasons.push(`${check.label}: ${check.actual}. Required: ${check.required}.`);
    }

    return {
      eligible: reasons.length === 0,
      allowOverride: allowEligibilityOverride === true,
      reasons,
      checks,
    };
  }

  /**
   * Runs the gate when an application is being created. Returns the decision
   * plus the label ('Eligible' | 'Overridden') and final reasons to snapshot
   * onto the loan account. When the gate fails but an override is requested,
   * permitted AND the actor holds an approver role, the application proceeds
   * flagged as 'Overridden'.
   */
  async applyGate(organizationId: string, memberId: string, loanProductId: string, opts?: { overrideReason?: string; actorRole?: string }): Promise<{
    status: 'Eligible' | 'Overridden';
    reasons: string[];
    overrideReason?: string;
  }> {
    const decision = await this.evaluate(organizationId, memberId, loanProductId);
    if (decision.eligible) {
      return { status: 'Eligible', reasons: [] };
    }

    const reason = (opts?.overrideReason || '').trim();
    const role = (opts?.actorRole || '').toLowerCase();
    const isApprover = role === 'org_admin' || role === 'manager';
    const validOverride = decision.allowOverride && isApprover && reason.length > 4;
    if (!validOverride) {
      if (reason.length > 0 && !decision.allowOverride) {
        throw Object.assign(new Error('This loan product does not allow eligibility overrides.'), {
          status: 422,
          code: 'LOAN_ELIGIBILITY_FAILED',
          checks: decision.checks,
          reasons: decision.reasons,
        });
      }
      if (reason.length > 0 && !isApprover) {
        throw Object.assign(new Error('Only org admins & managers may override the eligibility gate.'), {
          status: 403,
          code: 'LOAN_ELIGIBILITY_FORBIDDEN',
          checks: decision.checks,
          reasons: decision.reasons,
        });
      }
      throw Object.assign(new Error(decision.reasons.join(' ')), {
        status: 422,
        code: 'LOAN_ELIGIBILITY_FAILED',
        checks: decision.checks,
        reasons: decision.reasons,
      });
    }
    return { status: 'Overridden', reasons: decision.reasons, overrideReason: reason };
  }
}