/**
 * Share Service
 * Business logic for share types, holdings, transactions, and certificates.
 */
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { shareHoldings } from '../../db/schema';
import { ShareRepository, ShareHoldingFilter } from '../repositories/ShareRepository';
import { MemberRepository } from '../repositories/MemberRepository';
import { getTodayBS, getTodayADFormatted } from '../../utils/nepaliCalendar';
import { computeMaxAllowedKitta, ShareCeilingError } from './shareCeilingEngine';

export interface IssueSharesInput {
  memberId: string;
  shareTypeId: string;
  numberOfShares: number;
  dateBs?: string;
  dateAd?: string;
  remarks?: string;
  branchId?: string;
}

export interface TransferSharesInput {
  fromHoldingId: string;
  toMemberId: string;
  numberOfShares: number;
  dateBs?: string;
  dateAd?: string;
  remarks?: string;
  branchId?: string;
}

export interface ShareTransactionInput {
  transactionType: 'ISSUE' | 'RETURN';
  memberId: string;
  shareTypeId: string;
  numberOfShares: number;
  dateBs?: string;
  dateAd?: string;
  remarks?: string;
  branchId?: string;
  /** Payment/refund COA account chosen by the operator (Dr on ISSUE, Cr on RETURN). */
  paymentAccountId?: string;
  memberCurrentBalance?: number;
  /** Manual kitta range — used (and required) only when the share type has autoSequence=false. */
  manualStartKitta?: number | null;
  manualEndKitta?: number | null;
}

/** Auto-provisioned share issuance — the single core path for EVERY issue. */
export interface IssueMemberSharesInput {
  memberId: string;
  shareTypeId: string;
  numberOfShares: number;
  dateBs?: string;
  dateAd?: string;
  remarks?: string;
  branchId?: string;
  /** Payment COA account chosen by the operator (Dr side). Defaults to mapped cash/bank. */
  paymentAccountId?: string;
  /** Manual kitta range — used (and required) only when the share type has autoSequence=false. */
  manualStartKitta?: number | null;
  manualEndKitta?: number | null;
  /** Nominee register (हकवाला) written atomically with the issue. */
  nominees?: ShareNomineeInput[] | null;
}

/** A nominee (हकवाला) on a share account. Percentages must total exactly 100%. */
export interface ShareNomineeInput {
  fullName: string;
  relation: string;
  citizenshipNo?: string | null;
  contactNo?: string | null;
  photoUrl?: string | null;
  sharePercentage: number;
  isPrimary: boolean;
}

/** Input for POST /shares/open-account — first issue + nominee register. */
export interface OpenShareAccountInput {
  memberId: string;
  shareTypeId: string;
  numberOfShares: number;
  dateBs?: string;
  dateAd?: string;
  remarks?: string;
  branchId?: string;
  /** Payment COA account chosen by the operator (Dr side). Defaults to mapped cash/bank. */
  paymentAccountId?: string;
  /** Manual kitta range — used (and required) only when the share type has autoSequence=false. */
  manualStartKitta?: number | null;
  manualEndKitta?: number | null;
  /** Client-supplied org minimum — never trusted; server re-reads the setting. */
  minRequiredKitta?: number | null;
  nominees: ShareNomineeInput[];
}

export class ShareService {
  private repository: ShareRepository;
  private memberRepository: MemberRepository;

  constructor() {
    this.repository = new ShareRepository();
    this.memberRepository = new MemberRepository();
  }

  // ============================================================
  // QUERIES
  // ============================================================
  async getSummary(organizationId: string) {
    const types = await this.repository.listTypes(organizationId);
    const activeTypes = types.filter(t => t.status === 'Active');
    const dividendRate = activeTypes.reduce((max, t) => Math.max(max, Number(t.dividendRate) || 0), 0);
    return this.repository.getSummary(organizationId, dividendRate);
  }

  async getTypes(organizationId: string) {
    return this.repository.listTypes(organizationId);
  }

  async getTypeById(organizationId: string, id: string) {
    const type = await this.repository.getTypeById(organizationId, id);
    if (!type) throw new Error('Share type not found');
    return type;
  }

  async getHoldings(organizationId: string, filter: ShareHoldingFilter = {}) {
    return this.repository.listHoldings({ ...filter, organizationId });
  }

  /** Real member share data for the share certificate preview (total kitta, paid-up capital, kitta range). */
  async getMemberShareCertificateData(organizationId: string, memberId: string, certificateId?: string) {
    return this.repository.getMemberShareCertificateData(organizationId, memberId, certificateId);
  }

  async getTransactions(organizationId: string, filter: { memberId?: string; holdingId?: string; limit?: number } = {}) {
    return this.repository.listTransactions(organizationId, filter);
  }

  async getCertificates(organizationId: string, filter: { memberId?: string; limit?: number } = {}) {
    return this.repository.listCertificates(organizationId, filter);
  }

  async getTransfers(organizationId: string, filter: { limit?: number } = {}) {
    return this.repository.listShareTransfers(organizationId, filter);
  }

  /** Share register from the auto-provisioned master accounts (+ estimated dividend). */
  async getShareRegister(organizationId: string, filter: { search?: string; status?: string } = {}) {
    return this.repository.listShareRegister(organizationId, filter);
  }

  /** Master share account + kitta-range history for a member. */
  async getShareAccount(organizationId: string, memberId: string) {
    const detail = await this.repository.getShareAccountDetail(organizationId, memberId);
    if (!detail) throw new Error('Share account not found');
    return detail;
  }

  async getOrgShareSettings(organizationId: string) {
    return this.repository.getOrgShareSettings(organizationId);
  }

  async updateOrgShareSettings(organizationId: string, data: Record<string, any>) {
    if (data.authorizedCapitalCeiling != null) {
      const v = Number(data.authorizedCapitalCeiling);
      if (!v || v <= 0) throw new Error('Authorized capital ceiling must be a positive amount');
    }
    if (data.authorizedTotalKitta != null) {
      const v = Number(data.authorizedTotalKitta);
      if (!v || !Number.isInteger(v) || v <= 0) throw new Error('Authorized total kitta must be a positive integer');
    }
    if (data.defaultFaceValue != null) {
      const v = Number(data.defaultFaceValue);
      if (!v || v <= 0) throw new Error('Default face value must be a positive amount');
    }
    if (data.minRequiredKitta != null) {
      const v = Number(data.minRequiredKitta);
      if (!Number.isInteger(v) || v <= 0) throw new Error('Minimum required kitta must be a positive integer');
    }
    return this.repository.updateOrgShareSettings(organizationId, {
      authorizedCapitalCeiling: data.authorizedCapitalCeiling != null ? Number(data.authorizedCapitalCeiling) : null,
      authorizedTotalKitta: data.authorizedTotalKitta != null ? Number(data.authorizedTotalKitta) : null,
      defaultFaceValue: data.defaultFaceValue != null ? Number(data.defaultFaceValue) : null,
      minRequiredKitta: data.minRequiredKitta != null ? Number(data.minRequiredKitta) : null,
    });
  }

  /** Active members who have not yet opened a share account (हकवाला prefill included). */
  async getUnprovisionedMembers(organizationId: string, search?: string) {
    return this.repository.listUnprovisionedMembers(organizationId, search);
  }

  /** Nominee register for a member's share account. */
  async getShareAccountNominees(organizationId: string, memberId: string) {
    return this.repository.listShareAccountNominees(organizationId, memberId);
  }

  async getTransferDetail(organizationId: string, id: string) {
    const detail = await this.repository.getShareTransferDetail(organizationId, id);
    if (!detail) throw new Error('Share transfer not found');
    return detail;
  }

  // ============================================================
  // SHARE TYPES
  // ============================================================
  /** Shared guard: pool math must fit ORG ceiling minus the OTHER types.'
   * maxAllowedKitta must be a positive number; unlimited (null) is disabled. */
  private async assertTypePool(organizationId: string, maxAllowedKitta: number | null, excludeId?: string | null, currentCeiling?: number | null): Promise<number> {
    if (maxAllowedKitta == null) {
      throw new Error('Max Allowed Kitta is required — unlimited ceilings are not supported. Enter a positive kitta allocation within the authorized pool.');
    }
    const value = Number(maxAllowedKitta);
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
      throw new Error('Max Allowed Kitta must be a positive integer.');
    }
    const org = await this.repository.getOrgShareSettings(organizationId);
    const others = await this.repository.listTypeCeilings(organizationId, excludeId ?? null);
    const { availablePoolForType, allowedMax, allocatedToOtherTypes } = computeMaxAllowedKitta({
      authorizedTotalKitta: org.authorizedTotalKitta,
      otherTypeCeilings: others,
      currentCeiling: currentCeiling ?? null,
    });
    if (value > allowedMax) {
      throw new ShareCeilingError(
        `Cannot assign ${value} kitta ceiling. Only ${allowedMax} kitta remain for this type ` +
        `(authorized pool: ${org.authorizedTotalKitta}; ${allocatedToOtherTypes} already allocated to other types).`
      );
    }
    return value;
  }

  async createType(organizationId: string, data: Record<string, any>) {
    if (!data.code || !data.name) throw new Error('Share type code and name are required');
    const faceValue = Number(data.faceValue);
    if (!faceValue || faceValue <= 0) throw new Error('Face value must be a positive number');

    const existing = await this.repository.findActiveTypeByCode(organizationId, data.code);
    if (existing) throw new Error(`Share type with code "${data.code}" already exists`);

    const maxAllowedKitta = await this.assertTypePool(
      organizationId,
      data.maxAllowedKitta != null ? Number(data.maxAllowedKitta) : null,
      null,
      null,
    );

    return this.repository.createType({
      organizationId,
      code: data.code,
      name: data.name,
      faceValue: String(faceValue),
      minShares: Number(data.minShares ?? 1),
      maxShares: data.maxShares ? Number(data.maxShares) : null,
      isTransferable: data.isTransferable !== false,
      isPledgeable: data.isPledgeable !== false,
      dividendRate: String(Number(data.dividendRate ?? 0)),
      kittaPrefix: data.kittaPrefix ?? '',
      kittaStartBase: data.kittaStartBase ? Number(data.kittaStartBase) : null,
      currentKittaPointer: Number(data.currentKittaPointer ?? 0),
      maxAllowedKitta,
      autoSequence: data.autoSequence !== false,
      status: data.status ?? 'Active',
      description: data.description ?? null,
    });
  }

  async updateType(organizationId: string, id: string, data: Record<string, any>) {
    const existing = await this.repository.getTypeById(organizationId, id);
    if (!existing) throw new Error('Share type not found');
    // Never allow maxAllowedKitta to drop below the kitta already issued —
    // otherwise the type ceiling becomes permanently unsatisfiable.
    let maxAllowedKitta: number | undefined;
    if (data.maxAllowedKitta !== undefined) {
      maxAllowedKitta = await this.assertTypePool(
        organizationId,
        data.maxAllowedKitta != null ? Number(data.maxAllowedKitta) : null,
        id,
        existing.maxAllowedKitta,
      );
      const issued = Number(existing.currentKittaPointer ?? 0);
      if (maxAllowedKitta < issued) {
        throw new Error(`Max kitta (${maxAllowedKitta}) cannot be below the ${issued} kitta already issued for this share type.`);
      }
    }
    return this.repository.updateType(organizationId, id, {
      ...data,
      faceValue: data.faceValue !== undefined ? String(Number(data.faceValue)) : undefined,
      dividendRate: data.dividendRate !== undefined ? String(Number(data.dividendRate)) : undefined,
      maxAllowedKitta,
    });
  }

  async deleteType(organizationId: string, id: string) {
    const deleted = await this.repository.deleteType(organizationId, id);
    if (!deleted) throw new Error('Share type not found');
    return { success: true };
  }

  // ============================================================
  // OPEN SHARE ACCOUNT (हकवाला) — first-issue + nominee register
  // Single ACID path: validate member eligibility + nominee 100% rule +
  // org min kitta + ceilings, then funnel through issueMemberShares so the
  // account, nominees, kitta range, JV and certificate commit atomically.
  // ============================================================
  async openShareAccount(organizationId: string, input: OpenShareAccountInput, processedBy: string) {
    if (!input.memberId || !input.shareTypeId) throw new Error('Member ID and Share Type are required');
    const kitta = Number(input.numberOfShares);
    if (!Number.isInteger(kitta) || kitta <= 0) {
      throw new Error('Initial kitta must be a positive integer');
    }

    const member = await this.memberRepository.findById(input.memberId);
    if (!member) throw new Error('Member not found');
    if (member.status !== 'Active') throw new Error('Share account can only be opened for an active member');

    // Members may hold exactly one share account — reject anyone already provisioned.
    const existing = await this.repository.getShareAccountByMember(organizationId, input.memberId);
    if (existing) {
      throw new Error(`Member ${member.memberNo} already has a share account (${existing.accountNo}). Use the Share Issue flow for further purchases.`);
    }

    // Nominee rule: at least one nominee, every percentage in (0, 100],
    // exactly one primary, and the total MUST equal 100%.
    const nominees = (input.nominees ?? []).map((n) => ({
      fullName: (n.fullName ?? '').trim(),
      relation: (n.relation ?? '').trim(),
      citizenshipNo: n.citizenshipNo?.trim() || null,
      contactNo: n.contactNo?.trim() || null,
      photoUrl: n.photoUrl?.trim() || null,
      sharePercentage: Number(n.sharePercentage),
      isPrimary: !!n.isPrimary,
    }));
    if (nominees.length === 0) throw new Error('At least one nominee (हकवाला) is required to open a share account');
    for (const n of nominees) {
      if (!n.fullName) throw new Error('Every nominee must have a full name');
      if (!n.relation) throw new Error(`Nominee "${n.fullName}" is missing the relation (e.g. Spouse, Son)`);
      if (!Number.isFinite(n.sharePercentage) || n.sharePercentage <= 0 || n.sharePercentage > 100) {
        throw new Error(`Nominee "${n.fullName}" share percentage must be greater than 0 and at most 100`);
      }
    }
    const totalPct = nominees.reduce((sum, n) => sum + n.sharePercentage, 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      throw new Error(`Nominee percentages must total exactly 100% — current total is ${totalPct.toFixed(2)}%`);
    }
    const primaryCount = nominees.filter((n) => n.isPrimary).length;
    if (primaryCount !== 1) {
      throw new Error('Exactly one nominee must be marked as the primary (पहिलो हकवाला)');
    }

    // Org min kitta (minimum first holding) + share type bounds.
    const orgSettings = await this.repository.getOrgShareSettings(organizationId);
    const minKitta = Math.max(orgSettings.minRequiredKitta ?? 10, Number(input.minRequiredKitta ?? 0));
    if (kitta < minKitta) {
      throw new Error(`Initial kitta must be at least ${minKitta} (organization minimum)`);
    }

    const type = await this.repository.getTypeById(organizationId, input.shareTypeId);
    if (!type) throw new Error('Share type not found');
    if (type.status !== 'Active') throw new Error('Share type is not active');
    if (type.minShares && kitta < type.minShares) {
      throw new Error(`Minimum ${type.minShares} shares required for this share type`);
    }
    if (type.maxShares && kitta > type.maxShares) {
      throw new Error(`Maximum ${type.maxShares} shares allowed for this share type`);
    }

    // The core issue path re-checks ALL ceilings inside its transaction (with
    // row locks) and auto-provisions the master share account + nominees.
    return this.issueMemberShares(organizationId, {
      memberId: member.id,
      shareTypeId: type.id,
      numberOfShares: kitta,
      remarks: input.remarks?.trim() || null,
      branchId: input.branchId ?? null,
      paymentAccountId: input.paymentAccountId ?? null,
      manualStartKitta: input.manualStartKitta != null ? Number(input.manualStartKitta) : null,
      manualEndKitta: input.manualEndKitta != null ? Number(input.manualEndKitta) : null,
      nominees,
    }, processedBy);
  }

  // ============================================================
  // ISSUE SHARES (auto-provisioned share account + GL posting)
  // Single core path — POST /shares/issue and the ISSUE branch of
  // POST /shares/transaction both funnel through issueMemberShares.
  // ============================================================
  async issueMemberShares(organizationId: string, input: IssueMemberSharesInput, processedBy: string) {
    if (!input.memberId || !input.shareTypeId) throw new Error('Member ID and Share Type are required');
    const shares = Number(input.numberOfShares);
    if (!Number.isInteger(shares) || shares <= 0) throw new Error('Number of shares must be a positive integer');

    const type = await this.repository.getTypeById(organizationId, input.shareTypeId);
    if (!type) throw new Error('Share type not found');
    if (type.status !== 'Active') throw new Error('Share type is not active');

    const member = await this.memberRepository.findById(input.memberId);
    if (!member) throw new Error('Member not found');

    if (type.maxShares && shares > type.maxShares) {
      throw new Error(`Maximum ${type.maxShares} shares allowed for this share type`);
    }
    const holding = await this.repository.findActiveHoldingForMember(organizationId, input.memberId, input.shareTypeId);
    if (type.maxShares && holding && holding.numberOfShares + shares > type.maxShares) {
      throw new Error(`Member would exceed maximum ${type.maxShares} shares for this share type`);
    }

    // NEVER trust client totals — amount is derived server-side from face value.
    const dateBs = input.dateBs || getTodayBS();
    const dateAd = input.dateAd || getTodayADFormatted();
    const faceValue = Number(type.faceValue);
    const totalAmount = shares * faceValue;

    const voucherNo = await this.repository.getNextJournalVoucherNo(organizationId);
    const certificateNo = await this.repository.getNextCertificateNo(organizationId);

    const result = await this.repository.executeIssueReturn(organizationId, {
      transactionType: 'ISSUE',
      memberId: member.id,
      memberName: member.fullName,
      memberNo: member.memberNo,
      memberBranchId: member.branchId ?? null,
      shareTypeId: type.id,
      shareTypeName: type.name,
      faceValue,
      shares,
      totalAmount,
      voucherNo,
      certificateNo,
      dateBs,
      dateAd,
      remarks: input.remarks ?? null,
      processedBy,
      branchId: input.branchId ?? null,
      paymentAccountId: input.paymentAccountId ?? null,
      provisionShareAccount: true,
      manualStartKitta: input.manualStartKitta != null ? Number(input.manualStartKitta) : null,
      manualEndKitta: input.manualEndKitta != null ? Number(input.manualEndKitta) : null,
      nominees: input.nominees ?? null,
    });

    const [organization, entries] = await Promise.all([
      this.repository.getOrganizationHeader(organizationId),
      result.voucherId ? this.repository.getVoucherEntries(organizationId, result.voucherId) : Promise.resolve([]),
    ]);

    return {
      holdingId: result.holdingId,
      voucherId: result.voucherId,
      memberId: member.id,
      memberNo: member.memberNo,
      memberName: member.fullName,
      shareTypeId: type.id,
      shareType: type.name,
      faceValuePerShare: faceValue,
      transactionType: 'ISSUE',
      numberOfShares: shares,
      totalAmount,
      voucherNo,
      certificateNo: result.certificateNo,
      currentBalance: result.currentBalanceAfter,
      dateBs,
      dateAd,
      entries: entries.map(e => ({
        accountId: e.accountId,
        accountCode: e.accountCode,
        accountName: e.accountName,
        debit: Number(e.debit || 0),
        credit: Number(e.credit || 0),
        narration: e.narration,
      })),
      organization,
      accountNo: result.accountNo,
      wasAutoProvisioned: result.wasAutoProvisioned,
      kittaStart: result.kittaStart,
      kittaEnd: result.kittaEnd,
    };
  }

  /** Legacy /shares/issue handler — now the full auto-provisioned GL path. */
  async issueShares(organizationId: string, input: IssueSharesInput, processedBy: string) {
    const result = await this.issueMemberShares(organizationId, input, processedBy);
    return result;
  }

  /** Mark a holding as fully closed out (Transferred/Surrendered). */
  private async closeHolding(organizationId: string, holdingId: string, status: 'Transferred' | 'Surrendered') {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    await db.update(shareHoldings)
      .set({ status, numberOfShares: 0, totalValue: '0', updatedAt: new Date() })
      .where(and(
        eq(shareHoldings.id, holdingId),
        eq(shareHoldings.organizationId, organizationId),
      ));
  }

  // ============================================================
  // TRANSFER SHARES (atomic: holdings + JV + registry + sub-book)
  // ============================================================
  async transferShares(organizationId: string, input: TransferSharesInput, processedBy: string) {
    if (!input.fromHoldingId || !input.toMemberId) throw new Error('Source holding and target member are required');
    const shares = Number(input.numberOfShares);
    if (!shares || shares <= 0) throw new Error('Number of shares must be a positive integer');

    const sourceHolding = await this.repository.getHoldingById(organizationId, input.fromHoldingId);
    if (!sourceHolding) throw new Error('Source share holding not found');
    if (sourceHolding.status !== 'Active') throw new Error('Source holding is not active');
    if (shares > sourceHolding.numberOfShares) {
      throw new Error(`Cannot transfer more than ${sourceHolding.numberOfShares} shares`);
    }

    const toMember = await this.memberRepository.findById(input.toMemberId);
    if (!toMember) throw new Error('Target member not found');

    const type = await this.repository.getTypeById(organizationId, sourceHolding.shareTypeId);
    if (!type) throw new Error('Share type not found');
    if (type.isTransferable === false) throw new Error('This share type is not transferable');

    const dateBs = input.dateBs || getTodayBS();
    const dateAd = input.dateAd || getTodayADFormatted();
    const faceValue = Number(sourceHolding.faceValuePerShare);
    const totalAmount = shares * faceValue;

    // Target member: find/create holding
    const targetHolding = await this.repository.findActiveHoldingForMember(organizationId, input.toMemberId, type.id);

    const remaining = sourceHolding.numberOfShares - shares;

    const transferNo = await this.repository.getNextTransferNo(organizationId);
    const voucherNo = await this.repository.getNextJournalVoucherNo(organizationId);
    const certificateNo = await this.repository.getNextCertificateNo(organizationId);

    const result = await this.repository.executeTransfer(organizationId, {
      fromHoldingId: sourceHolding.id,
      fromMemberId: sourceHolding.memberId,
      fromMemberName: sourceHolding.memberName,
      fromMemberNo: sourceHolding.memberNo,
      toMemberId: toMember.id,
      toMemberName: toMember.fullName,
      toMemberNo: toMember.memberNo,
      toMemberBranchId: toMember.branchId ?? null,
      shareTypeId: type.id,
      shareTypeName: type.name,
      faceValue,
      shares,
      totalAmount,
      transferNo,
      voucherNo,
      certificateNo,
      dateBs,
      dateAd,
      remarks: input.remarks ?? null,
      processedBy,
      branchId: input.branchId ?? null,
      sourceHoldingBranchId: sourceHolding.branchId ?? null,
      closeSource: remaining === 0,
      sourceRemaining: remaining,
      targetExistingHoldingId: targetHolding?.id ?? null,
      targetNewShares: targetHolding ? targetHolding.numberOfShares + shares : shares,
    });

    const organization = await this.repository.getOrganizationHeader(organizationId);

    return {
      ...result,
      id: result.transferId,
      fromHoldingId: sourceHolding.id,
      toHoldingId: result.toHoldingId,
      fromMemberId: sourceHolding.memberId,
      toMemberId: toMember.id,
      fromMemberName: sourceHolding.memberName,
      fromMemberNo: sourceHolding.memberNo,
      toMemberName: toMember.fullName,
      toMemberNo: toMember.memberNo,
      shareTypeId: type.id,
      numberOfShares: shares,
      faceValuePerShare: faceValue,
      totalAmount,
      shareTypeName: type.name,
      dateBs,
      dateAd,
      remarks: input.remarks ?? null,
      processedBy,
      branchId: input.branchId ?? null,
      createdAt: new Date().toISOString(),
      status: 'Completed',
      organization,
    };
  }

  // ============================================================
  // Surrender shares (decrease holding)
  // ============================================================
  async surrenderShares(organizationId: string, holdingId: string, numberOfShares: number, processedBy: string, remarks?: string) {
    const holding = await this.repository.getHoldingById(organizationId, holdingId);
    if (!holding) throw new Error('Share holding not found');
    if (holding.status !== 'Active') throw new Error('Holding is not active');
    const shares = Number(numberOfShares);
    if (!shares || shares <= 0) throw new Error('Number of shares must be a positive integer');
    if (shares > holding.numberOfShares) throw new Error('Cannot surrender more shares than held');

    const type = await this.repository.getTypeById(organizationId, holding.shareTypeId);
    const faceValue = Number(holding.faceValuePerShare);
    const dateBs = getTodayBS();
    const dateAd = getTodayADFormatted();

    const remaining = holding.numberOfShares - shares;
    if (remaining === 0) {
      await this.closeHolding(organizationId, holding.id, 'Surrendered');
    } else {
      await this.repository.updateHoldingShares(organizationId, holding.id, remaining);
    }

    const voucherNo = await this.repository.getNextVoucherNo(organizationId);
    await this.repository.createTransaction({
      organizationId,
      holdingId: holding.id,
      memberId: holding.memberId,
      shareTypeId: type!.id,
      transactionType: 'Surrender',
      numberOfShares: shares,
      amountPerShare: String(faceValue),
      totalAmount: String(shares * faceValue),
      voucherNo,
      dateBs,
      dateAd,
      remarks: remarks ?? null,
      processedBy,
      branchId: holding.branchId ?? null,
    });

    await this.syncMemberFinancial(organizationId, holding.memberId);

    return { holdingId: holding.id, numberOfShares: shares, voucherNo };
  }

  // ============================================================
  // UNIFIED SHARE TRANSACTION (Issue | Return)
  // Checks transactionType and executes an atomic DB transaction
  // updating BOTH the Main General Ledger (Journal voucher) AND the
  // Member Subsidiary Shares Book simultaneously.
  // ============================================================
  async processShareTransaction(organizationId: string, input: ShareTransactionInput, processedBy: string) {
    // ISSUE funnels through the single auto-provisioned core path.
    if (input.transactionType === 'ISSUE') {
      return this.issueMemberShares(organizationId, input, processedBy);
    }

    if (!input.memberId || !input.shareTypeId) throw new Error('Member ID and Share Type are required');

    const shares = Number(input.numberOfShares);
    if (!Number.isInteger(shares) || shares <= 0) {
      throw new Error('Number of shares must be a positive integer');
    }

    const type = await this.repository.getTypeById(organizationId, input.shareTypeId);
    if (!type) throw new Error('Share type not found');
    if (type.status !== 'Active') throw new Error('Share type is not active');

    const member = await this.memberRepository.findById(input.memberId);
    if (!member) throw new Error('Member not found');

    const dateBs = input.dateBs || getTodayBS();
    const dateAd = input.dateAd || getTodayADFormatted();
    const faceValue = Number(type.faceValue);
    const totalAmount = shares * faceValue;

    // ---- RETURN: enforce numberOfShares <= member's current balance ----
    const holding = await this.repository.findActiveHoldingForMember(organizationId, input.memberId, input.shareTypeId);
    const currentBalance = holding?.numberOfShares ?? 0;
    if (shares > currentBalance) {
      throw new Error(`Cannot return ${shares} shares — member's current balance is only ${currentBalance} shares`);
    }

    const voucherNo = await this.repository.getNextJournalVoucherNo(organizationId);

    const result = await this.repository.executeIssueReturn(organizationId, {
      transactionType: 'RETURN',
      memberId: member.id,
      memberName: member.fullName,
      memberNo: member.memberNo,
      memberBranchId: member.branchId ?? null,
      shareTypeId: type.id,
      shareTypeName: type.name,
      faceValue,
      shares,
      totalAmount,
      voucherNo,
      certificateNo: null,
      dateBs,
      dateAd,
      remarks: input.remarks ?? null,
      processedBy,
      branchId: input.branchId ?? null,
      paymentAccountId: input.paymentAccountId ?? null,
    });

    const [organization, entries] = await Promise.all([
      this.repository.getOrganizationHeader(organizationId),
      result.voucherId ? this.repository.getVoucherEntries(organizationId, result.voucherId) : Promise.resolve([]),
    ]);

    return {
      holdingId: result.holdingId,
      voucherId: result.voucherId,
      memberId: member.id,
      memberNo: member.memberNo,
      memberName: member.fullName,
      shareTypeId: type.id,
      shareType: type.name,
      faceValuePerShare: faceValue,
      transactionType: input.transactionType,
      numberOfShares: shares,
      totalAmount,
      voucherNo,
      certificateNo: result.certificateNo,
      currentBalance: result.currentBalanceAfter,
      dateBs,
      dateAd,
      entries: entries.map(e => ({
        accountId: e.accountId,
        accountCode: e.accountCode,
        accountName: e.accountName,
        debit: Number(e.debit || 0),
        credit: Number(e.credit || 0),
        narration: e.narration,
      })),
      organization,
    };
  }

  // ============================================================
  // Internal helpers
  // ============================================================
  private async syncMemberFinancial(organizationId: string, memberId: string) {
    const holdings = await this.repository.listHoldings({ organizationId, memberId, limit: 1000 });
    const active = holdings.data.filter(h => h.status === 'Active');
    const totalShares = active.reduce((sum, h) => sum + Number(h.numberOfShares || 0), 0);
    const totalValue = active.reduce((sum, h) => sum + Number(h.totalValue || 0), 0);
    await this.repository.upsertMemberFinancial(memberId, organizationId, totalShares, totalValue);
  }
}
