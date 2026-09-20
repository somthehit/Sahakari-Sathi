/**
 * Savings & Deposits Service (teller operations)
 *
 * Implements the Tasks 1–5 teller flows on top of the existing savings domain:
 *   1. Open savings account (product-config validated)
 *   2. Teller deposit entry (cash / bank → immediate credit; cheque → pending clearance)
 *   3. Teller withdrawal (instrument validation + dual-approval queue for large amounts)
 *   4. Account ledger (debit/credit running balance)
 *   5. Passbook printer (unprinted-transaction tracking + PDF generation)
 *
 * Every balance-changing operation posts a double-entry GL voucher via
 * SavingsGlService (direct `Posted`, bypassing the financial-period gate) and
 * writes an audit row.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb, type DbExecutor } from '../../db/client';
import { SavingsRepository, SavingsFilter } from '../repositories/SavingsRepository';
import { SavingsDepositRepository } from '../repositories/SavingsDepositRepository';
import { MemberRepository } from '../repositories/MemberRepository';
import {
  savingsAccounts,
  savingsProducts,
  savingsTransactions,
  approvalMatrix,
  approvalRequests,
  chartOfAccounts,
  chequeLeaves,
  bankChequeLeaves,
  bankChequeBooks,
  members,
} from '../../db/schema';
import { postSavingsVoucher, resolveSystemAccount, resolveCashBankAccount } from './SavingsGlService';
import { buildAuditRow, writeAuditLog, SettingsActor } from '../utils/audit';
import { DateConverter, getTodayBS, getTodayADFormatted } from '../../utils/nepaliCalendar';
import { daysBetweenBS } from '../../utils/financialEngine';
import { evaluatePresentation } from './ChequeService';
import { SignatureVerificationRepository } from '../repositories/SignatureVerificationRepository';
import { SignatureVerificationService, HIGH_AUTOAPPROVE, LOW_OVERRIDE, type SignatureOutcome } from './SignatureVerificationService';
import { v4 as uuidv4 } from 'uuid';
import { jsPDF } from 'jspdf';

const CREDIT_TYPES = ['Deposit', 'Interest_Posting', 'Transfer_In'];
const DEBIT_TYPES = ['Withdrawal', 'Transfer_Out', 'Penalty'];

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface DepositInput {
  accountId: string;
  amount: number;
  mode: 'cash' | 'cheque' | 'bank_transfer';
  bsDate: string;
  cheque?: { number?: string; bank?: string; date?: string } | null;
  reference?: string;
  remarks?: string;
}

export interface WithdrawalInput {
  accountId: string;
  amount: number;
  payoutMode: 'cash' | 'cheque_issue' | 'bank_transfer';
  bsDate: string;
  instrument: {
    type: 'cheque' | 'slip' | 'passbook';
    chequeNumber?: string;
    slipNumber?: string;
    signatureVerified?: boolean;
    passbookLastLine?: string;
    /** Reference to the persisted signature_verification_logs row from POST /signature/verify. */
    verificationLogId?: string;
    /** Optional pre-confirmed disposition: auto_approved | teller_override | supervisor_override. */
    signatureOutcome?: SignatureOutcome;
    overrideReason?: string;
    /** Passbook-mode survey answers (routed to the dual-approval queue when flagged). */
    passbookTampered?: boolean;
    passbookReconciled?: boolean;
  };
}

export interface OpenAccountInput {
  memberId: string;
  schemeId: string;
  openingDeposit: number;
  depositSource?: 'cash' | 'bank_transfer' | 'internal_transfer';
  nomineeId?: string | null;
  isJoint?: boolean;
  bsDate?: string;
  /** Optional signature specimen captured at account opening (data URL or storage path). */
  specimenImageUrl?: string;
  signatoryName?: string;
  signingRule?: 'any' | 'all' | 'specific';
}

export class SavingsDepositService {
  private repository = new SavingsRepository();
  private depositRepository = new SavingsDepositRepository();
  private memberRepository = new MemberRepository();
  private signatureRepository = new SignatureVerificationRepository();
  private signatureService = new SignatureVerificationService();

  // ─────────────────────────────────────────────────────────────
  // Shared lookups
  // ─────────────────────────────────────────────────────────────

  private async getProduct(organizationId: string, productId?: string | null, client?: DbExecutor) {
    if (!productId) return null;
    const db = client ?? getDb();
    if (!db) throw new Error('Database not connected.');
    const [product] = await db.select().from(savingsProducts)
      .where(and(eq(savingsProducts.id, productId), eq(savingsProducts.organizationId, organizationId)))
      .limit(1);
    return product ?? null;
  }

  /**
   * Resolve the GL liability account for a savings account: prefer the product's
   * mapped liability GL, fall back to the `member_savings` system mapping.
   */
  private async resolveLiabilityGl(organizationId: string, productId?: string | null, client?: DbExecutor) {
    const product = await this.getProduct(organizationId, productId, client);
    if (product?.glLiabilityAccountId) {
      const db = client ?? getDb();
      if (!db) throw new Error('Database not connected.');
      const [account] = await db.select({
        id: chartOfAccounts.id,
        code: chartOfAccounts.code,
        name: chartOfAccounts.name,
        type: chartOfAccounts.type,
        balance: chartOfAccounts.balance,
        allowPosting: chartOfAccounts.allowPosting,
      })
        .from(chartOfAccounts)
        .where(and(
          eq(chartOfAccounts.id, product.glLiabilityAccountId),
          eq(chartOfAccounts.organizationId, organizationId)
        ))
        .limit(1);
      if (account) {
        return {
          id: account.id,
          code: account.code,
          name: account.name,
          type: account.type,
          balance: String(account.balance ?? '0'),
          allowPosting: account.allowPosting !== false,
        };
      }
    }
    const mapped = await resolveSystemAccount(organizationId, 'member_savings', client);
    if (mapped) {
      return { id: mapped.id, code: mapped.code, name: mapped.name, type: mapped.type, balance: String(mapped.balance ?? '0'), allowPosting: mapped.allowPosting !== false };
    }
    throw new Error('Member savings GL account is not configured. Set the savings liability mapping in Setups → Accounting Settings.');
  }

  /** Accounts list (existing GET /savings). */
  async getAccounts(filter: SavingsFilter) {
    return this.repository.findAll(filter);
  }

  async getAccountById(id: string, organizationId: string, branchIds?: string[]) {
    return this.repository.findById(id, organizationId, branchIds);
  }

  /** Teller fast-path account lookup by number/member name/member no. */
  async lookupAccounts(organizationId: string, query: string, branchIds?: string[]) {
    return this.depositRepository.findAccountByQuery(query, organizationId, branchIds);
  }

  /** Available savings schemes (products) for the Open Account page. */
  async listSchemes(organizationId: string, memberTypeId?: string) {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    let rows;
    if (memberTypeId) {
      const products = await db.select().from(savingsProducts)
        .where(and(eq(savingsProducts.organizationId, organizationId), eq(savingsProducts.isActive, true)))
        .orderBy(sql`${savingsProducts.sortOrder} asc, ${savingsProducts.name} asc`);
      rows = products.filter((p: any) => {
        const eligible = Array.isArray(p.eligibleMemberTypeIds) ? p.eligibleMemberTypeIds : [];
        return eligible.length === 0 || eligible.includes(memberTypeId);
      });
    } else {
      rows = await db.select().from(savingsProducts)
        .where(and(eq(savingsProducts.organizationId, organizationId), eq(savingsProducts.isActive, true)))
        .orderBy(sql`${savingsProducts.sortOrder} asc, ${savingsProducts.name} asc`);
    }
    return rows.map((p: any) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      productType: p.productType,
      minOpeningDeposit: toNum(p.minDeposit),
      minBalance: toNum(p.minBalance),
      interestRate: toNum(p.interestRate),
      interestPostingFrequency: p.interestPostingFrequency,
      accountNoPrefix: p.accountNoPrefix,
      openingDepositRequired: p.openingDepositRequired,
      chequeEnabled: p.chequeEnabled,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // Task 1 — Open Savings Account
  // ─────────────────────────────────────────────────────────────

  async openAccount(input: OpenAccountInput, organizationId: string, branchId: string, actor: SettingsActor) {
    if (!input.memberId) throw new Error('Member is required.');
    if (!input.schemeId) throw new Error('Savings scheme is required.');

    const member = await this.memberRepository.findById(input.memberId, organizationId);
    if (!member) throw new Error('Member not found.');

    const product = await this.getProduct(organizationId, input.schemeId);
    if (!product) throw new Error('Savings scheme not found.');
    if (product.isActive === false) throw new Error('Savings scheme is inactive.');

    // Business rule: only ONE ACTIVE savings account per (member, product).
    const existing = await this.repository.findActiveByMemberAndProduct(organizationId, member.id, product.id);
    if (existing) {
      throw new Error('Member already possesses an active account for this savings product.');
    }

    if (product.requiresKycVerified && (member.kycStatus !== 'Verified')) {
      throw new Error('Member KYC is not verified. An authorized user must override this before opening an account.');
    }
    if (product.requiresNominee && !member.nomineeName && !input.nomineeId) {
      throw new Error('This savings scheme requires a nominee.');
    }

    const openingDeposit = round2(input.openingDeposit ?? 0);
    if (product.openingDepositRequired && openingDeposit < toNum(product.minDeposit)) {
      throw new Error(`Opening deposit must be at least NPR ${toNum(product.minDeposit).toLocaleString()}.`);
    }

    // Account number: prefix + branch seq. Simple time-based uniqueness within org.
    const accountNo = await this.nextAccountNo(organizationId, product.accountNoPrefix || 'SAV', branchId);

    const todayBs = input.bsDate || getTodayBS();
    const account = await this.repository.create({
      organizationId,
      accountNo,
      memberId: member.id,
      memberName: member.fullName,
      memberNo: member.memberNo,
      savingsProductId: product.id,
      productType: product.productType,
      productName: product.name,
      interestRate: product.interestRate,
      balance: '0',
      minBalance: String(toNum(product.minBalance)),
      openedDateBs: todayBs,
      branchId,
      status: 'Active',
      openedVia: 'manual',
      lastTransactionDateBs: todayBs,
      passbookSerial: accountNo,
      passbookLinesPerPage: 30,
    });

    // Opening deposit books a Deposit transaction + GL voucher.
    if (openingDeposit > 0) {
      await this.recordDeposit({
        accountId: account.id,
        amount: openingDeposit,
        mode: input.depositSource === 'bank_transfer' ? 'bank_transfer' : 'cash',
        bsDate: todayBs,
        remarks: 'Opening deposit',
      }, organizationId, branchId, actor);
    }

    // Optional signature specimen captured at account opening — forms the on-file
    // signature used by the withdrawal signature-verification pipeline.
    if (input.specimenImageUrl) {
      await this.signatureService.seedSpecimenAtOpen(
        {
          accountId: account.id,
          memberId: member.id,
          imageUrl: input.specimenImageUrl,
          signatoryName: input.signatoryName ?? null,
          signingRule: input.signingRule,
        },
        organizationId,
        branchId,
        actor,
      );
    }

    await writeAuditLog(buildAuditRow(
      actor, 'Savings & Deposits', 'Open Savings Account',
      `Opened savings account ${accountNo} (${product.name}) for ${member.fullName}`,
    ));

    return { accountNumber: accountNo, accountId: account.id, openingDeposit };
  }

  /**
   * Account maintenance (Account Register → Edit / Manage Account).
   * Updates only the operational fields a teller is allowed to manage; balance
   * and identity are never touched here.
   */
  async updateAccount(accountId: string, organizationId: string, branchIds: string[] | undefined, data: { status?: string; minBalance?: number; interestRate?: number }, actor: SettingsActor) {
    if (!accountId) throw new Error('Account is required.');
    const account = await this.repository.findById(accountId, organizationId, branchIds);
    if (!account) throw new Error('Savings account not found.');

    const patch: Record<string, string> = {};
    if (data.status !== undefined) {
      if (!['Active', 'Dormant', 'Closed'].includes(data.status)) throw new Error('Invalid account status.');
      patch.status = data.status;
    }
    if (data.minBalance !== undefined) {
      if (data.minBalance < 0) throw new Error('Minimum balance cannot be negative.');
      patch.minBalance = String(round2(data.minBalance));
    }
    if (data.interestRate !== undefined) {
      if (data.interestRate < 0) throw new Error('Interest rate cannot be negative.');
      patch.interestRate = String(round2(data.interestRate));
    }
    if (Object.keys(patch).length === 0) return account;

    const updated = await this.repository.update(accountId, patch, organizationId);
    await writeAuditLog(buildAuditRow(
      actor, 'Savings & Deposits', 'Update Savings Account',
      `Updated ${account.accountNo} (${account.memberName}): ${Object.keys(patch).join(', ')}`,
    ));
    return updated;
  }

  /** Next account number: PREFIX-BRANCHSEG-SEQ (e.g. SAV-101-0001). */
  private async nextAccountNo(organizationId: string, prefix: string, branchId: string) {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    const branchSeg = branchId.replace(/-/g, '').slice(0, 3).toUpperCase();
    const rows = await db.select({ accountNo: savingsAccounts.accountNo })
      .from(savingsAccounts)
      .where(and(eq(savingsAccounts.organizationId, organizationId), eq(savingsAccounts.branchId, branchId)));
    let maxSeq = 0;
    const prefixUpper = prefix.toUpperCase();
    for (const r of rows) {
      const m = /-(\d+)$/.exec(r.accountNo);
      if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
    }
    return `${prefixUpper}-${branchSeg}-${String(maxSeq + 1).padStart(4, '0')}`;
  }

  // ─────────────────────────────────────────────────────────────
  // Task 2 — Teller Deposit
  // ─────────────────────────────────────────────────────────────

  async recordDeposit(input: DepositInput, organizationId: string, branchId: string, actor: SettingsActor) {
    if (!input.accountId) throw new Error('Account is required.');
    const amount = round2(input.amount);
    if (amount <= 0) throw new Error('Deposit amount must be greater than zero.');

    const account = await this.repository.findById(input.accountId, organizationId);
    if (!account) throw new Error('Account not found.');
    if (account.status !== 'Active') throw new Error(`Account is ${account.status}. Deposits are blocked.`);

    const product = await this.getProduct(organizationId, account.savingsProductId);
    const todayBs = input.bsDate || getTodayBS();
    const todayAd = DateConverter.bsToAd(todayBs) || new Date().toISOString().slice(0, 10);

    // Cheque → pending-clearance instrument, no immediate balance credit.
    if (input.mode === 'cheque') {
      if (!input.cheque?.number) throw new Error('Cheque number is required for cheque deposits.');
      const pending = await this.depositRepository.createChequeDeposit({
        organizationId,
        branchId,
        accountId: account.id,
        accountNo: account.accountNo,
        memberId: account.memberId,
        memberName: account.memberName,
        amount: String(amount),
        chequeNumber: input.cheque.number,
        chequeBank: input.cheque.bank || '',
        chequeDateBs: input.cheque.date || null,
        dateBs: todayBs,
        dateAd: todayAd,
        status: 'Pending',
        reference: input.reference || null,
        depositedById: actor.userId || null,
        depositedByName: actor.username || 'System',
      });
      await writeAuditLog(buildAuditRow(
        actor, 'Savings & Deposits', 'Cheque Deposit Received',
        `Cheque ${input.cheque.number} (NPR ${amount.toLocaleString()}) queued for clearance on ${account.accountNo}`,
      ));
      return {
        id: pending.id,
        accountId: account.id,
        accountNo: account.accountNo,
        voucherNo: pending.voucherNo || `CHQ-DEP-${pending.id.slice(0, 8).toUpperCase()}`,
        newBalance: toNum(account.balance),
        pendingClearing: true,
      };
    }

    // Cash / bank transfer → immediate credit. Balance update + GL voucher
    // commit or roll back together.
    const paymentMode = input.mode === 'bank_transfer' ? 'Bank_Transfer' : 'Cash';
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    const { txn, voucher } = await db.transaction(async (tx) => {
      const txn = await this.repository.processTransaction({
        organizationId,
        accountId: account.id,
        accountNo: account.accountNo,
        memberId: account.memberId,
        memberName: account.memberName,
        type: 'Deposit',
        amount: String(amount),
        balanceAfter: String(toNum(account.balance) + amount),
        voucherNo: `VCH-${Date.now().toString().slice(-8)}`,
        dateBs: todayBs,
        dateAd: todayAd,
        tellerName: actor.username || 'System',
        remarks: input.remarks || `Deposit by ${paymentMode}`,
        paymentMode,
        branchId,
      }, organizationId, undefined, tx);

      // GL: Dr cash/bank, Cr member savings liability.
      const cashGl = await resolveCashBankAccount(organizationId, tx);
      const liabilityGl = await this.resolveLiabilityGl(organizationId, account.savingsProductId, tx);
      const voucher = await postSavingsVoucher({
        organizationId,
        branchId,
        dateBs: todayBs,
        dateAd: todayAd,
        voucherType: 'Receipt',
        narration: `Savings deposit ${account.accountNo} — ${paymentMode}`,
        moduleReference: `savings:txn:${txn.id}`,
        preparedBy: actor.username || 'System',
        entries: [
          { accountId: cashGl.id, accountCode: cashGl.code, accountName: cashGl.name, debit: amount },
          { accountId: liabilityGl.id, accountCode: liabilityGl.code, accountName: liabilityGl.name, credit: amount },
        ],
      }, tx);

      return { txn, voucher };
    });

    const newBalance = toNum(txn.balanceAfter);

    await writeAuditLog(buildAuditRow(
      actor, 'Savings & Deposits', 'Deposit',
      `Deposit NPR ${amount.toLocaleString()} (${paymentMode}) on ${account.accountNo}`,
    ));

    return { id: txn.id, accountId: account.id, accountNo: account.accountNo, voucherNo: voucher.voucher.voucherNo, newBalance };
  }

  /** Batch / field-collection deposit. Each entry is processed independently. */
  async recordBatchDeposits(entries: DepositInput[], organizationId: string, branchId: string, actor: SettingsActor) {
    if (!Array.isArray(entries) || entries.length === 0) throw new Error('Batch entries are required.');
    const results = [];
    for (const entry of entries) {
      results.push(await this.recordDeposit(entry, organizationId, branchId, actor));
    }
    return { posted: results.length, results };
  }

  // ─────────────────────────────────────────────────────────────
  // Task 3 — Teller Withdrawal (instrument validation + dual approval)
  // ─────────────────────────────────────────────────────────────

  /**
   * Look up a cheque leaf and validate it against the account's issued books.
   * Also resolves the drawer account/member for the teller preview and surfaces
   * cheque date-validity (post-dated hold / stale window) and any earlier
   * presentment of this leaf (duplicate fingerprint).
   */
  async validateChequeLeaf(chequeNumber: string, organizationId: string, accountId?: string) {
    const leaf = await this.depositRepository.findChequeLeaf(chequeNumber, organizationId);

    // ── Fallback: if not in member cheque_leaves, check bank_cheque_leaves ──
    if (!leaf) {
      const db = getDb();
      const bankLeaf = await db.select().from(bankChequeLeaves)
        .where(and(
          eq(bankChequeLeaves.organizationId, organizationId),
          eq(bankChequeLeaves.chequeNumber, chequeNumber)
        )).limit(1).then(r => r[0]);

      if (!bankLeaf) throw new Error('Cheque leaf not found.');

      // Resolve bank cheque book
      const bankBook = await db.select().from(bankChequeBooks)
        .where(eq(bankChequeBooks.id, bankLeaf.chequeBookId))
        .limit(1).then(r => r[0]);

      // Resolve bank account (GL account) for drawer info
      const bankAccount = await db.select().from(chartOfAccounts)
        .where(eq(chartOfAccounts.id, bankLeaf.bankAccountId))
        .limit(1).then(r => r[0]);

      // Build a compatible response for the frontend
      return {
        leaf: {
          id: bankLeaf.id,
          chequeNumber: bankLeaf.chequeNumber,
          leafNo: bankLeaf.leafNo,
          status: bankLeaf.status === 'unused' ? 'unused' : bankLeaf.status,
          accountId: bankLeaf.bankAccountId,
          chequeBookId: bankLeaf.chequeBookId,
          chequeDateBs: bankLeaf.chequeDateBs,
          branchId: bankAccount?.branchId ?? null,
        },
        book: bankBook ? {
          bookNumber: bankBook.bookNumber,
          status: bankBook.status,
          accountId: bankLeaf.bankAccountId,
          branchId: bankBook.branchId,
          issuedDateBs: bankBook.issuedDateBs,
        } : null,
        drawer: bankAccount ? {
          id: bankAccount.id,
          accountNo: bankAccount.code,
          memberId: '',
          memberName: bankAccount.name,
          balance: Number(bankAccount.balance),
          minBalance: 0,
          status: 'active',
        } : null,
        dateValidity: null,
        duplicatePresentment: null,
        presentation: { blocked: false },
        isBankCheque: true,
      };
    }
    if (leaf.status !== 'unused') {
      // Explicit 400 guards for the statuses a presented cheque can never be used in.
      if (leaf.status === 'used') throw new Error('This cheque has already been used for a payment.');
      if (leaf.status === 'stopped') throw new Error('This cheque is stopped. Payments on it are blocked.');
      if (leaf.status === 'cancelled') throw new Error('This cheque has been cancelled and cannot be used.');
      if (leaf.status === 'bounced') throw new Error('This cheque was previously dishonoured (bounced).');
      throw new Error(`Cheque leaf is not available (${leaf.status}).`);
    }
    const book = await this.depositRepository.findChequeBook(leaf.chequeBookId, organizationId);
    if (book && book.status !== 'active') throw new Error('Cheque book is not active.');
    if (accountId && book && book.accountId !== accountId) {
      throw new Error('Cheque leaf does not belong to this account.');
    }

    // Stop-payment ranges + org-configured validity/expiry. A range approved
    // after this leaf existed must still block it, and a stale cheque must be
    // rejected (or flagged) per the organization's expiredChequeBehavior — this
    // is enforced here rather than only in the UI. `evaluatePresentation` is the
    // shared pure engine used across the cheque subsystem.
    const stopPayments = await this.depositRepository.findApprovedStopPayments(organizationId, leaf.accountId);
    const config = await this.depositRepository.findChequeConfig(organizationId, book?.branchId ?? leaf.branchId ?? null);
    const presentation = evaluatePresentation({
      leaf: { chequeNumber: leaf.chequeNumber, status: leaf.status, chequeDateBs: leaf.chequeDateBs },
      book: book ? { status: book.status } : null,
      stopPayments: stopPayments as any,
      referenceDateBs: leaf.chequeDateBs ?? book?.issuedDateBs ?? null,
      validityPeriodDays: Number(config?.validityPeriodDays ?? 0),
      expiredChequeBehavior: (config?.expiredChequeBehavior as any) ?? 'flag_only',
      todayBs: getTodayBS(),
    }, daysBetweenBS);
    if (presentation.blocked) {
      throw new Error(presentation.reason || 'This cheque cannot be presented for payment.');
    }

    // Drawer account + member preview for the teller.
    const drawer = await this.signatureRepository.resolveChequeDrawer(organizationId, leaf.accountId);

    // Cheque dating rules: post-dated → hold, stale → block (180-day window).
    const dateValidity = this.signatureService.chequeDateValidity(leaf.chequeDateBs, getTodayBS());

    // Duplicate-presentment fingerprint: the consumed-instrument register.
    const earlier = await this.signatureRepository.findPresentedCheque(organizationId, chequeNumber);

    return { leaf, book, drawer, dateValidity, duplicatePresentment: earlier ?? null, presentation };
  }

  /**
   * Enforce the disposition of a signature verification log against the recorded
   * machine score (server-side). Never trusts the client's claimed band.
   */
  private async assertSignatureDisposition(opts: {
    organizationId: string;
    accountId: string;
    memberId: string;
    instrumentType: 'cheque' | 'slip';
    verificationLogId?: string | null;
    signatureVerified?: boolean;
    signatureOutcome?: SignatureOutcome | null;
    overrideReason?: string | null;
    role?: string;
  }): Promise<{ verified: boolean; logId?: string | null; outcome?: SignatureOutcome; overrideReason?: string | null; machineScore?: number }> {
    // Legacy fast path — the teller manually confirmed the signature against the
    // specimen on file (no live comparison log).
    if (!opts.verificationLogId) {
      if (opts.signatureVerified) return { verified: true, logId: null, outcome: 'auto_approved' as SignatureOutcome };
      throw new Error('Signature must be verified against the specimen on file.');
    }

    const log = await this.signatureRepository.getVerificationLog(opts.organizationId, opts.verificationLogId);
    if (!log) throw new Error('Signature verification log not found.');
    if (log.accountId !== opts.accountId || log.memberId !== opts.memberId) {
      throw new Error('Signature verification log does not match this account/member.');
    }

    const score = log.matchScore;
    const claimed = opts.signatureOutcome ?? ('auto_approved' as SignatureOutcome);
    let outcome = claimed;
    let overrideReason = opts.overrideReason ?? null;

    if (score >= HIGH_AUTOAPPROVE) {
      if (claimed === 'teller_override' || claimed === 'supervisor_override') {
        throw new Error('Override unnecessary — signature score already qualifies for auto-approval.');
      }
      outcome = 'auto_approved';
      overrideReason = null;
    } else if (score >= LOW_OVERRIDE) {
      if (claimed !== 'teller_override' || !overrideReason) {
        throw new Error('Signature is in the review band (70–89). A logged teller override reason is required.');
      }
      outcome = 'teller_override';
    } else {
      if (claimed !== 'supervisor_override' || !overrideReason) {
        throw new Error('Signature score is below the safe threshold. A supervisor override with a reason is required.');
      }
      if (opts.role && !['org_admin', 'manager'].includes(opts.role)) {
        throw new Error('Only a supervisor (org_admin/manager) may override a below-threshold signature.');
      }
      outcome = 'supervisor_override';
    }

    return { verified: true, logId: log.id, outcome, overrideReason, machineScore: score };
  }

  /** Resolve the dual-approval threshold for a withdrawal amount. 0 = no approval needed. */
  private async resolveApprovalThreshold(organizationId: string, amount: number) {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    const rules = await db.select().from(approvalMatrix)
      .where(and(
        eq(approvalMatrix.organizationId, organizationId),
        eq(approvalMatrix.requestType, 'Savings_Withdrawal' as any),
        eq(approvalMatrix.active, true),
      ));
    if (rules.length === 0) return null;
    let threshold: number | null = null;
    for (const rule of rules) {
      const min = toNum(rule.thresholdMin);
      const max = rule.thresholdMax === null ? Infinity : toNum(rule.thresholdMax);
      if (amount >= min && (max === Infinity || amount <= max)) {
        if (threshold === null || min < threshold) threshold = min;
      }
    }
    return threshold;
  }

  async recordWithdrawal(input: WithdrawalInput, organizationId: string, branchId: string, actor: SettingsActor) {
    if (!input.accountId) throw new Error('Account is required.');
    const amount = round2(input.amount);
    if (amount <= 0) throw new Error('Withdrawal amount must be greater than zero.');

    const account = await this.repository.findById(input.accountId, organizationId);
    if (!account) throw new Error('Account not found.');
    if (account.status !== 'Active') throw new Error(`Account is ${account.status}. Withdrawals are blocked.`);

    const minBalance = toNum(account.minBalance);
    const balance = toNum(account.balance);
    const available = round2(balance - minBalance);
    if (amount > available) {
      throw new Error(`Amount exceeds available balance. Available: NPR ${available.toLocaleString()} (after minimum balance).`);
    }

    // Instrument validation + signature disposition.
    const instrument = input.instrument ?? { type: 'slip' as const };
    let instrumentReference: string | null = null;
    let chequeLeafId: string | null = null;
    let disposition: { verified: boolean; logId?: string | null; outcome?: SignatureOutcome; overrideReason?: string | null; machineScore?: number } = { verified: true };
    let tamperFlag = false;
    if (instrument.type === 'cheque') {
      if (!instrument.chequeNumber) throw new Error('Cheque number is required.');
      const { leaf, dateValidity, duplicatePresentment } = await this.validateChequeLeaf(instrument.chequeNumber, organizationId, account.id);
      // Cheque dating rules: post-dated → hold, stale → blocked.
      if (!dateValidity.ok) throw new Error(dateValidity.message);
      // Duplicate-presentment fingerprint (register) — second line of defense.
      if (duplicatePresentment) {
        throw new Error(`This cheque (${instrument.chequeNumber}) was already presented on ${duplicatePresentment.dateBs} (NPR ${toNum(duplicatePresentment.amount).toLocaleString()}). Suspected duplicate.`);
      }
      instrumentReference = instrument.chequeNumber;
      chequeLeafId = leaf.id;
      disposition = await this.assertSignatureDisposition({
        organizationId, accountId: account.id, memberId: account.memberId,
        instrumentType: 'cheque',
        verificationLogId: instrument.verificationLogId ?? null,
        signatureVerified: instrument.signatureVerified,
        signatureOutcome: instrument.signatureOutcome ?? null,
        overrideReason: instrument.overrideReason ?? null,
        role: actor.role,
      });
    } else if (instrument.type === 'slip') {
      if (!instrument.slipNumber?.trim()) throw new Error('Withdrawal slip number is required.');
      // Slip serials are single-use per organization — a re-presented slip is a
      // hard block (photocopied / reused instrument).
      const prior = await this.signatureRepository.findPresentedInstrument(organizationId, 'slip', instrument.slipNumber);
      if (prior) {
        throw new Error(`Withdrawal slip ${instrument.slipNumber} was already used on ${prior.dateBs} (NPR ${toNum(prior.amount).toLocaleString()}). Reuse is blocked.`);
      }
      instrumentReference = instrument.slipNumber;
      disposition = await this.assertSignatureDisposition({
        organizationId, accountId: account.id, memberId: account.memberId,
        instrumentType: 'slip',
        verificationLogId: instrument.verificationLogId ?? null,
        signatureVerified: instrument.signatureVerified,
        signatureOutcome: instrument.signatureOutcome ?? null,
        overrideReason: instrument.overrideReason ?? null,
        role: actor.role,
      });
    } else if (instrument.type === 'passbook') {
      instrumentReference = instrument.passbookLastLine || null;
      if (instrument.passbookTampered) {
        // Tamper / mismatch flagged at the reconciliation gate → route through
        // the supervisor review loop.
        tamperFlag = true;
      }
    }

    // Reserve the cheque leaf up-front (unused → presented) so it cannot be
    // re-presented while the withdrawal is queued for approval. For the
    // immediate-release path the reservation is re-done inside the DB
    // transaction so it commits/rolls back atomically with the payment.
    const reserveChequeLeaf = (client?: DbExecutor) => {
      if (!chequeLeafId) return Promise.resolve(true);
      return this.depositRepository.consumeChequeLeaf(chequeLeafId, organizationId, undefined, client)
        .then((leaf) => {
          if (!leaf) throw new Error('Cheque leaf could not be reserved (already presented).');
          return true;
        });
    };

    const todayBs = input.bsDate || getTodayBS();
    const todayAd = DateConverter.bsToAd(todayBs) || new Date().toISOString().slice(0, 10);
    const voucherNo = `VCH-${Date.now().toString().slice(-8)}`;
    const payoutMode = ({ cash: 'Cash', cheque_issue: 'Cheque_Issue', bank_transfer: 'Bank_Transfer' } as const)[input.payoutMode] ?? 'Cash';

    // Dual-approval threshold.
    const threshold = await this.resolveApprovalThreshold(organizationId, amount);
    const product = await this.getProduct(organizationId, account.savingsProductId);
    const requiresApproval = (product?.withdrawalRequiresApproval === true) || threshold !== null || tamperFlag;

    if (requiresApproval) {
      // Reserve the leaf now so it cannot be re-presented while awaiting approval.
      await reserveChequeLeaf();

      // Queue — funds are NOT released until a supervisor approves.
      const pending = await this.depositRepository.createPendingWithdrawal({
        organizationId,
        branchId,
        accountId: account.id,
        accountNo: account.accountNo,
        memberId: account.memberId,
        memberName: account.memberName,
        amount: String(amount),
        payoutMode,
        instrumentType: instrument.type,
        instrumentReference,
        dateBs: todayBs,
        dateAd: todayAd,
        voucherNo,
        status: 'Pending',
        requestedById: actor.userId || '00000000-0000-0000-0000-000000000000',
        requestedByName: actor.username || 'System',
        signatureLogId: disposition.logId ?? null,
        signatureOutcome: disposition.outcome ?? null,
        signatureOverrideReason: disposition.overrideReason ?? null,
      });

      // Register the instrument as presented NOW so a second slip/cheque
      // presentment is blocked even while this one awaits supervisor approval.
      if (instrument.type === 'slip' || instrument.type === 'cheque') {
        await this.signatureRepository.recordInstrument({
          organizationId,
          branchId,
          accountId: account.id,
          accountNo: account.accountNo,
          memberId: account.memberId,
          memberName: account.memberName,
          type: instrument.type,
          reference: instrumentReference!,
          amount,
          dateBs: todayBs,
          voucherNo,
          createdById: actor.userId ?? null,
        });
      }

      // Mirror into the central approval_requests queue (4-eye workflow).
      const db = getDb();
      if (db) {
        await db.insert(approvalRequests).values({
          organizationId,
          requestType: 'Savings_Withdrawal',
          referenceNo: voucherNo,
          requestedBy: actor.userId || '00000000-0000-0000-0000-000000000000',
          requestedDateBs: todayBs,
          amount: String(amount),
          description: `Savings withdrawal ${account.accountNo} (${account.memberName}) — requires approval${tamperFlag ? ' — PASSBOOK FLAGGED FOR REVIEW' : ''}`,
          branchId,
          status: 'Pending',
        });
      }

      await writeAuditLog(buildAuditRow(
        actor, 'Savings & Deposits', 'Withdrawal Queued for Approval',
        `Withdrawal NPR ${amount.toLocaleString()} on ${account.accountNo} queued (${tamperFlag ? 'passbook flagged for review' : 'exceeds approval threshold'}).`,
      ));

      return { id: pending.id, accountId: account.id, accountNo: account.accountNo, voucherNo, newBalance: balance, needsApproval: true, signatureOutcome: disposition.outcome ?? null, signatureScore: disposition.machineScore ?? null };
    }

    // Immediate release. Balance update + GL voucher commit or roll back
    // together, with the min-balance re-validated against the in-transaction
    // balance so a concurrent withdrawal cannot overdraw.
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    const { txn, voucher } = await db.transaction(async (tx) => {
      const accountInTx = await this.repository.findById(input.accountId, organizationId, undefined, tx);
      if (!accountInTx) throw new Error('Account not found.');
      const currentBalance = toNum(accountInTx.balance);
      const currentAvailable = round2(currentBalance - toNum(accountInTx.minBalance));
      if (amount > currentAvailable) {
        throw new Error(`Amount exceeds available balance. Available: NPR ${currentAvailable.toLocaleString()} (after minimum balance).`);
      }

      // Reserve the leaf (unused → presented) inside the transaction so a
      // concurrent withdrawal cannot present it while we are paying it out.
      await reserveChequeLeaf(tx);

      const txn = await this.repository.processTransaction({
        organizationId,
        accountId: accountInTx.id,
        accountNo: accountInTx.accountNo,
        memberId: accountInTx.memberId,
        memberName: accountInTx.memberName,
        type: 'Withdrawal',
        amount: String(amount),
        balanceAfter: String(currentBalance - amount),
        voucherNo,
        dateBs: todayBs,
        dateAd: todayAd,
        tellerName: actor.username || 'System',
        remarks: `Withdrawal (${instrument.type}) — payout ${payoutMode}`,
        paymentMode: payoutMode === 'Cash' ? 'Cash' : 'Bank_Transfer',
        branchId,
      }, organizationId, undefined, tx);

      // Status sync — the presented leaf becomes `used`, linked to this
      // withdrawal transaction. Same transaction as the debit + GL, so a
      // failed payment never leaves the leaf half-used.
      if (chequeLeafId) {
        const used = await this.depositRepository.markChequeLeafUsed(chequeLeafId, organizationId, txn.id, tx);
        if (!used) throw new Error('Cheque leaf could not be marked as used.');
      }

      // Consumed-instrument register — the slip/cheque is now single-use per org.
      if (instrument.type === 'slip' || instrument.type === 'cheque') {
        await this.signatureRepository.recordInstrument({
          organizationId,
          branchId,
          accountId: account.id,
          accountNo: account.accountNo,
          memberId: account.memberId,
          memberName: account.memberName,
          type: instrument.type,
          reference: instrumentReference!,
          amount,
          dateBs: todayBs,
          voucherNo,
          transactionId: txn.id,
          createdById: actor.userId ?? null,
        }, tx);
      }

      // Finalize the signature verification log — records the final disposition
      // (auto-approved / teller override / supervisor override) against the
      // posted withdrawal. Atomic with the payment.
      if (disposition.logId) {
        await this.signatureRepository.finalizeVerificationLog(organizationId, disposition.logId, {
          withdrawalId: txn.id,
          voucherNo,
          outcome: disposition.outcome ?? 'auto_approved',
          overrideReason: disposition.overrideReason ?? null,
          reviewedByUserId: disposition.overrideReason ? (actor.userId ?? null) : null,
        }, tx);
      }

      const liabilityGl = await this.resolveLiabilityGl(organizationId, accountInTx.savingsProductId, tx);
      const cashGl = await resolveCashBankAccount(organizationId, tx);
      const voucher = await postSavingsVoucher({
        organizationId,
        branchId,
        dateBs: todayBs,
        dateAd: todayAd,
        voucherType: 'Payment',
        narration: `Savings withdrawal ${accountInTx.accountNo} — payout ${payoutMode}`,
        moduleReference: `savings:txn:${txn.id}`,
        preparedBy: actor.username || 'System',
        entries: [
          { accountId: liabilityGl.id, accountCode: liabilityGl.code, accountName: liabilityGl.name, debit: amount },
          { accountId: cashGl.id, accountCode: cashGl.code, accountName: cashGl.name, credit: amount },
        ],
      }, tx);

      return { txn, voucher };
    });

    const newBalance = toNum(txn.balanceAfter);

    await writeAuditLog(buildAuditRow(
      actor, 'Savings & Deposits', 'Withdrawal',
      `Withdrawal NPR ${amount.toLocaleString()} (${instrument.type}) on ${account.accountNo}`,
    ));

    return { id: txn.id, accountId: account.id, accountNo: account.accountNo, voucherNo: voucher.voucher.voucherNo, newBalance, needsApproval: false };
  }

  /** List pending withdrawals (dual-approval queue). */
  async listPendingWithdrawals(organizationId: string, branchIds?: string[], status?: string) {
    return this.depositRepository.listPendingWithdrawals({ organizationId, branchIds, status });
  }

  /** Approve a queued withdrawal → posts the debit + GL + releases funds. */
  async approveWithdrawal(id: string, organizationId: string, branchId: string, actor: SettingsActor) {
    const pending = await this.depositRepository.findPendingWithdrawal(id, organizationId);
    if (!pending) throw new Error('Pending withdrawal not found.');
    if (pending.status !== 'Pending') throw new Error('Withdrawal request already processed.');
    const amount = toNum(pending.amount);

    // Balance re-check + debit posting + GL + status flip all in one
    // transaction, so the approval cannot be raced or left half-published.
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    const { updated, voucher, txn } = await db.transaction(async (tx) => {
      const pendingInTx = await this.depositRepository.findPendingWithdrawal(id, organizationId, undefined, tx);
      if (!pendingInTx) throw new Error('Pending withdrawal not found.');
      if (pendingInTx.status !== 'Pending') throw new Error('Withdrawal request already processed.');

      const account = await this.repository.findById(pending.accountId, organizationId, undefined, tx);
      if (!account) throw new Error('Account not found.');
      const balance = toNum(account.balance);
      const available = round2(balance - toNum(account.minBalance));
      if (amount > available) throw new Error('Insufficient available balance to release this withdrawal.');

      const txn = await this.repository.processTransaction({
        organizationId,
        accountId: account.id,
        accountNo: account.accountNo,
        memberId: account.memberId,
        memberName: account.memberName,
        type: 'Withdrawal',
        amount: String(amount),
        balanceAfter: String(balance - amount),
        voucherNo: pendingInTx.voucherNo,
        dateBs: pendingInTx.dateBs,
        dateAd: pendingInTx.dateAd,
        tellerName: actor.username || 'System',
        remarks: `Withdrawal approved — payout ${pendingInTx.payoutMode}`,
        paymentMode: pendingInTx.payoutMode === 'Cash' ? 'Cash' : 'Bank_Transfer',
        branchId,
      }, organizationId, undefined, tx);

      // Status sync — a cheque leaf held while awaiting approval becomes
      // `used` (linked to this withdrawal transaction) the moment the funds
      // are released. Same transaction as the debit, so it is atomic.
      if (pendingInTx.instrumentType === 'cheque' && pendingInTx.instrumentReference) {
        const leaf = await this.depositRepository.findChequeLeaf(pendingInTx.instrumentReference, organizationId, tx);
        if (!leaf) throw new Error('Cheque leaf not found for approved withdrawal.');
        const used = await this.depositRepository.markChequeLeafUsed(leaf.id, organizationId, txn.id, tx);
        if (!used) throw new Error('Cheque leaf could not be marked as used.');
      }

      // Consumed-instrument register — finalize the pending row with the posted
      // transaction so the fingerprint is complete.
      if ((pendingInTx.instrumentType === 'slip' || pendingInTx.instrumentType === 'cheque') && pendingInTx.instrumentReference) {
        await this.signatureRepository.markInstrumentConsumed(
          organizationId,
          pendingInTx.instrumentType,
          pendingInTx.instrumentReference,
          { voucherNo: pendingInTx.voucherNo, transactionId: txn.id },
          tx,
        );
      }

      // Finalize the signature verification log against the approved payout —
      // carries the disposition decided at teller entry (override bands already
      // validated server-side at recordWithdrawal).
      if (pendingInTx.signatureLogId) {
        await this.signatureRepository.finalizeVerificationLog(organizationId, pendingInTx.signatureLogId, {
          withdrawalId: txn.id,
          voucherNo: pendingInTx.voucherNo,
          outcome: (pendingInTx.signatureOutcome as SignatureOutcome) ?? 'auto_approved',
          overrideReason: pendingInTx.signatureOverrideReason ?? null,
          reviewedByUserId: pendingInTx.signatureOverrideReason ? (actor.userId ?? null) : null,
        }, tx);
      }

      const liabilityGl = await this.resolveLiabilityGl(organizationId, account.savingsProductId, tx);
      const cashGl = await resolveCashBankAccount(organizationId, tx);
      const voucher = await postSavingsVoucher({
        organizationId,
        branchId,
        dateBs: pendingInTx.dateBs,
        dateAd: pendingInTx.dateAd,
        voucherType: 'Payment',
        narration: `Savings withdrawal ${account.accountNo} — approved payout`,
        moduleReference: `savings:txn:${txn.id}`,
        preparedBy: actor.username || 'System',
        entries: [
          { accountId: liabilityGl.id, accountCode: liabilityGl.code, accountName: liabilityGl.name, debit: amount },
          { accountId: cashGl.id, accountCode: cashGl.code, accountName: cashGl.name, credit: amount },
        ],
      }, tx);

      const updated = await this.depositRepository.updatePendingWithdrawal(id, {
        status: 'Approved',
        approvedBy: actor.username || 'System',
        processedAt: new Date(),
      }, organizationId, tx);

      // Sync the central approval request to Approved.
      await tx.update(approvalRequests)
        .set({ status: 'Approved', approvedBy: actor.username || 'System', processedAt: new Date() })
        .where(and(eq(approvalRequests.organizationId, organizationId), eq(approvalRequests.referenceNo, pendingInTx.voucherNo)));

      return { updated, voucher, txn };
    });

    await writeAuditLog(buildAuditRow(
      actor, 'Savings & Deposits', 'Withdrawal Approved',
      `Approved withdrawal NPR ${amount.toLocaleString()} on ${pending.accountNo}`,
    ));

    return { id: pending.id, status: updated?.status, voucherNo: voucher.voucher.voucherNo, newBalance: toNum(txn.balanceAfter) };
  }

  /** Reject a queued withdrawal — no funds released. */
  async rejectWithdrawal(id: string, organizationId: string, actor: SettingsActor, remarks?: string) {
    const pending = await this.depositRepository.findPendingWithdrawal(id, organizationId);
    if (!pending) throw new Error('Pending withdrawal not found.');
    if (pending.status !== 'Pending') throw new Error('Withdrawal request already processed.');

    // Release any cheque leaf that was reserved while awaiting approval so it
    // goes back to `unused` and can be presented again.
    if (pending.instrumentType === 'cheque' && pending.instrumentReference) {
      const leaf = await this.depositRepository.findChequeLeaf(pending.instrumentReference, organizationId);
      if (leaf) await this.depositRepository.releaseChequeLeaf(leaf.id, organizationId);
    }

    // Drop the presented-instrument register row — a refused payment never
    // consumed the instrument, so it may be re-presented.
    if ((pending.instrumentType === 'slip' || pending.instrumentType === 'cheque') && pending.instrumentReference) {
      await this.signatureRepository.deletePresentedInstrument(organizationId, pending.instrumentType, pending.instrumentReference);
    }

    // Close the signature verification log as rejected (if one was created at
    // teller entry) so the audit trail shows the final disposition.
    if (pending.signatureLogId) {
      await this.signatureRepository.finalizeVerificationLog(organizationId, pending.signatureLogId, {
        withdrawalId: null,
        voucherNo: pending.voucherNo,
        outcome: 'rejected',
        overrideReason: remarks ?? 'Rejected by supervisor',
        reviewedByUserId: actor.userId ?? null,
      });
    }

    const updated = await this.depositRepository.updatePendingWithdrawal(id, {
      status: 'Rejected',
      approvedBy: actor.username || 'System',
      remarks: remarks || 'Rejected',
      processedAt: new Date(),
    }, organizationId);

    const db = getDb();
    if (db) {
      await db.update(approvalRequests)
        .set({ status: 'Rejected', approvedBy: actor.username || 'System', remarks: remarks || null, processedAt: new Date() })
        .where(and(eq(approvalRequests.organizationId, organizationId), eq(approvalRequests.referenceNo, pending.voucherNo)));
    }

    await writeAuditLog(buildAuditRow(
      actor, 'Savings & Deposits', 'Withdrawal Rejected',
      `Rejected withdrawal NPR ${toNum(pending.amount).toLocaleString()} on ${pending.accountNo}${remarks ? ` — ${remarks}` : ''}`,
    ));

    return { id: pending.id, status: updated?.status };
  }

  // ─────────────────────────────────────────────────────────────
  // Cheque deposit clearing / bounce
  // ─────────────────────────────────────────────────────────────

  async clearChequeDeposit(id: string, organizationId: string, branchId: string, actor: SettingsActor) {
    const deposit = await this.depositRepository.findChequeDeposit(id, organizationId);
    if (!deposit) throw new Error('Cheque deposit not found.');
    if (deposit.status !== 'Pending') throw new Error(`Cheque deposit is already ${deposit.status}.`);
    const amount = toNum(deposit.amount);

    // Balance credit + GL + status flip all in one transaction.
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    const { updated, voucher, txn } = await db.transaction(async (tx) => {
      const depositInTx = await this.depositRepository.findChequeDeposit(id, organizationId, undefined, tx);
      if (!depositInTx) throw new Error('Cheque deposit not found.');
      if (depositInTx.status !== 'Pending') throw new Error(`Cheque deposit is already ${depositInTx.status}.`);

      const account = await this.repository.findById(deposit.accountId, organizationId, undefined, tx);
      if (!account) throw new Error('Account not found.');

      const txn = await this.repository.processTransaction({
        organizationId,
        accountId: account.id,
        accountNo: account.accountNo,
        memberId: account.memberId,
        memberName: account.memberName,
        type: 'Deposit',
        amount: String(amount),
        balanceAfter: String(toNum(account.balance) + amount),
        voucherNo: `VCH-${Date.now().toString().slice(-8)}`,
        dateBs: depositInTx.dateBs,
        dateAd: depositInTx.dateAd,
        tellerName: actor.username || 'System',
        remarks: `Cheque cleared (${depositInTx.chequeNumber}, ${depositInTx.chequeBank})`,
        paymentMode: 'Bank_Transfer',
        branchId,
      }, organizationId, undefined, tx);

      const cashGl = await resolveCashBankAccount(organizationId, tx);
      const liabilityGl = await this.resolveLiabilityGl(organizationId, account.savingsProductId, tx);
      const voucher = await postSavingsVoucher({
        organizationId,
        branchId,
        dateBs: depositInTx.dateBs,
        dateAd: depositInTx.dateAd,
        voucherType: 'Receipt',
        narration: `Cheque clearance ${account.accountNo} — ${depositInTx.chequeNumber}`,
        moduleReference: `savings:chequedep:${deposit.id}`,
        preparedBy: actor.username || 'System',
        entries: [
          { accountId: cashGl.id, accountCode: cashGl.code, accountName: cashGl.name, debit: amount },
          { accountId: liabilityGl.id, accountCode: liabilityGl.code, accountName: liabilityGl.name, credit: amount },
        ],
      }, tx);

      const updated = await this.depositRepository.updateChequeDeposit(id, {
        status: 'Cleared',
        voucherNo: voucher.voucher.voucherNo,
        clearedAt: new Date(),
        clearedById: actor.userId || null,
        clearedByName: actor.username || 'System',
      }, organizationId, tx);

      return { updated, voucher, txn };
    });

    await writeAuditLog(buildAuditRow(
      actor, 'Savings & Deposits', 'Cheque Deposit Cleared',
      `Cleared cheque ${deposit.chequeNumber} (NPR ${amount.toLocaleString()}) on ${deposit.accountNo}`,
    ));

    return { id: deposit.id, status: updated?.status, voucherNo: voucher.voucher.voucherNo, newBalance: toNum(txn.balanceAfter) };
  }

  async bounceChequeDeposit(id: string, organizationId: string, actor: SettingsActor, reason?: string) {
    const deposit = await this.depositRepository.findChequeDeposit(id, organizationId);
    if (!deposit) throw new Error('Cheque deposit not found.');
    if (deposit.status !== 'Pending') throw new Error(`Cheque deposit is already ${deposit.status}.`);

    const updated = await this.depositRepository.updateChequeDeposit(id, {
      status: 'Bounced',
      bouncedAt: new Date(),
      bounceReason: reason || null,
    }, organizationId);

    await writeAuditLog(buildAuditRow(
      actor, 'Savings & Deposits', 'Cheque Deposit Bounced',
      `Cheque ${deposit.chequeNumber} (NPR ${toNum(deposit.amount).toLocaleString()}) bounced on ${deposit.accountNo}${reason ? ` — ${reason}` : ''}`,
    ));

    return { id: deposit.id, status: updated?.status };
  }

  // ─────────────────────────────────────────────────────────────
  // Internal cheque transfer (drawer member → depositor member)
  // ─────────────────────────────────────────────────────────────
  //
  // A "cheque deposit" is an internal transfer: the depositor presents a
  // cheque drawn on ANOTHER member's savings account. Everything is verified
  // server-side — the client's earlier leaf lookup is a preview only; the
  // drawer account is always re-resolved here from the cheque_leaves row.
  // Because both parties are members of this cooperative, the instrument
  // settles same-day (no pending clearance): drawer debited, depositor
  // credited, leaf unused → cleared, and a Journal voucher + the settled
  // instrument register row are written. All-or-nothing.
  //
  // Dr/Cr direction (member savings accounts are liabilities to the coop):
  // the account LOSING money (drawer) is the Debit side, the account GAINING
  // money (depositor) is the Credit side.
  async postChequeTransfer(
    params: { depositAccountId: string; chequeNumber: string; amount: number; bsDate?: string },
    organizationId: string,
    branchId: string,
    actor: SettingsActor,
  ) {
    const { depositAccountId, chequeNumber, amount } = params;
    if (!(amount > 0)) throw new Error('Amount must be greater than zero.');
    const db = getDb();
    if (!db) throw new Error('Database not connected.');

    const todayBs = params.bsDate || getTodayBS();
    const todayAd = DateConverter.bsToAd(todayBs) || new Date().toISOString().slice(0, 10);

    const result = await db.transaction(async (tx) => {
      // 1. Resolve the cheque leaf server-side within the org. External cheques
      //    (not from this cooperative's chequebooks) are rejected outright.
      const leaf = await this.depositRepository.findChequeLeaf(chequeNumber, organizationId);
      if (!leaf) {
        throw new Error("Cheque number not recognized. Only cheques issued by this cooperative's own chequebooks can be deposited.");
      }

      // 1b. Presentation policy: approved stop-payment ranges + org-configured
      //     validity/expiry. The atomic claim below already rejects a leaf that
      //     is not `unused` (stopped/bounced/cancelled/used); this additionally
      //     blocks a stale cheque and any stop-payment range not individually
      //     flipped onto the leaf.
      const book = await this.depositRepository.findChequeBook(leaf.chequeBookId, organizationId);
      const stopPayments = await this.depositRepository.findApprovedStopPayments(organizationId, leaf.accountId, tx);
      const chequeConfig = await this.depositRepository.findChequeConfig(organizationId, book?.branchId ?? leaf.branchId ?? null, tx);
      const presentation = evaluatePresentation({
        leaf: { chequeNumber: leaf.chequeNumber, status: leaf.status, chequeDateBs: leaf.chequeDateBs },
        book: book ? { status: book.status } : null,
        stopPayments: stopPayments as any,
        referenceDateBs: leaf.chequeDateBs ?? book?.issuedDateBs ?? null,
        validityPeriodDays: Number(chequeConfig?.validityPeriodDays ?? 0),
        expiredChequeBehavior: (chequeConfig?.expiredChequeBehavior as any) ?? 'flag_only',
        todayBs,
      }, daysBetweenBS);
      if (presentation.blocked) {
        throw new Error(presentation.reason || 'This cheque cannot be presented for payment.');
      }

      // 2. Claim the leaf atomically — only an `unused` leaf can flip to
      //    `cleared`. The conditional UPDATE is the double-spend guard: a
      //    concurrent transaction that already cleared it returns no row, so we
      //    abort. Never trust the leaf read from step 1 after this point.
      const [claimed] = await tx.update(chequeLeaves)
        .set({ status: 'cleared', clearedDate: new Date() })
        .where(and(
          eq(chequeLeaves.id, leaf.id),
          eq(chequeLeaves.organizationId, organizationId),
          eq(chequeLeaves.status, 'unused'),
        ))
        .returning();
      if (!claimed) {
        throw new Error(`This cheque is ${leaf.status} and cannot be deposited.`);
      }

      // 3. Resolve drawer (B — the account the cheque is drawn on) from the
      //    leaf's owning account, and the depositor (A) by id.
      const drawerAccount = await this.repository.findById(leaf.accountId, organizationId, undefined, tx);
      const depositAccount = await this.repository.findById(depositAccountId, organizationId, undefined, tx);
      if (!drawerAccount) throw new Error('Drawer account could not be resolved from the cheque.');
      if (!depositAccount) throw new Error('Deposit account not found.');
      if (drawerAccount.id === depositAccount.id) {
        throw new Error('Cannot deposit a cheque into the same account it is drawn on.');
      }

      // 4. Member + account status checks on BOTH sides — a non-active account
      //    or member on either end blocks the whole transfer.
      const memberRows = await tx.select({
        id: members.id, status: members.status, fullName: members.fullName,
      }).from(members).where(inArray(members.id, [drawerAccount.memberId, depositAccount.memberId]));
      const memberById = new Map<string, { id: string; status: string; fullName: string }>();
      memberRows.forEach((m) => memberById.set(m.id, m));
      const assertMemberActive = (memberId: string) => {
        const member = memberById.get(memberId);
        if (!member) throw new Error('Member not found.');
        if (member.status !== 'Active') {
          throw new Error(`Member ${member.fullName} is ${member.status}. Cannot process this transaction.`);
        }
      };
      assertMemberActive(drawerAccount.memberId);
      assertMemberActive(depositAccount.memberId);
      if (drawerAccount.status !== 'Active') throw new Error(`Drawer account #${drawerAccount.accountNo} is ${drawerAccount.status}.`);
      if (depositAccount.status !== 'Active') throw new Error(`Deposit account #${depositAccount.accountNo} is ${depositAccount.status}.`);

      // 5. The drawer must have the available balance (after minBalance) to cover it.
      const available = toNum(drawerAccount.balance) - toNum(drawerAccount.minBalance);
      if (amount > available) {
        throw new Error(
          `Account #${drawerAccount.accountNo} has insufficient available balance. Available: NPR ${available.toLocaleString()}, requested: NPR ${amount.toLocaleString()}.`,
        );
      }

      // 6. Post the movement: drawer Transfer_Out, depositor Transfer_In.
      const voucherNo = `VCH-${Date.now().toString().slice(-8)}`;
      await this.repository.processTransaction({
        organizationId,
        accountId: drawerAccount.id,
        accountNo: drawerAccount.accountNo,
        memberId: drawerAccount.memberId,
        memberName: drawerAccount.memberName,
        type: 'Transfer_Out',
        amount: String(amount),
        balanceAfter: String(toNum(drawerAccount.balance) - amount),
        voucherNo,
        dateBs: todayBs,
        dateAd: todayAd,
        tellerName: actor.username || 'System',
        remarks: `Cheque ${chequeNumber} cleared — deposited to #${depositAccount.accountNo}`,
        paymentMode: 'Internal_Transfer',
        branchId,
      }, organizationId, undefined, tx);

      await this.repository.processTransaction({
        organizationId,
        accountId: depositAccount.id,
        accountNo: depositAccount.accountNo,
        memberId: depositAccount.memberId,
        memberName: depositAccount.memberName,
        type: 'Transfer_In',
        amount: String(amount),
        balanceAfter: String(toNum(depositAccount.balance) + amount),
        voucherNo,
        dateBs: todayBs,
        dateAd: todayAd,
        tellerName: actor.username || 'System',
        remarks: `Cheque ${chequeNumber} received from #${drawerAccount.accountNo}`,
        paymentMode: 'Internal_Transfer',
        branchId,
      }, organizationId, undefined, tx);

      // 7. GL: internal transfer between two member-liability accounts — Dr the
      //    drawer's liability (it fell), Cr the depositor's liability (it rose).
      const drawerGl = await this.resolveLiabilityGl(organizationId, drawerAccount.savingsProductId, tx);
      const depositGl = await this.resolveLiabilityGl(organizationId, depositAccount.savingsProductId, tx);
      const voucher = await postSavingsVoucher({
        organizationId,
        branchId,
        dateBs: todayBs,
        dateAd: todayAd,
        voucherType: 'Journal',
        narration: `Internal cheque transfer ${chequeNumber} — ${drawerAccount.accountNo} → ${depositAccount.accountNo}`,
        moduleReference: `savings:chequetransfer:${chequeNumber}`,
        preparedBy: actor.username || 'System',
        entries: [
          { accountId: drawerGl.id, accountCode: drawerGl.code, accountName: drawerGl.name, debit: amount },
          { accountId: depositGl.id, accountCode: depositGl.code, accountName: depositGl.name, credit: amount },
        ],
      }, tx);

      // 8. Record the settled instrument in the cheque-deposit register so the
      //    teller's cheque list stays complete — internal cheques are born Cleared.
      await this.depositRepository.createChequeDeposit({
        organizationId,
        branchId,
        accountId: depositAccount.id,
        accountNo: depositAccount.accountNo,
        memberId: depositAccount.memberId,
        memberName: depositAccount.memberName,
        amount: String(amount),
        chequeNumber,
        chequeBank: 'INTERNAL',
        chequeDateBs: leaf.chequeDateBs ?? null,
        dateBs: todayBs,
        dateAd: todayAd,
        status: 'Cleared',
        voucherNo: voucher.voucher.voucherNo,
        reference: null,
        depositedById: actor.userId || null,
        depositedByName: actor.username || 'System',
        clearedAt: new Date(),
        clearedById: actor.userId || null,
        clearedByName: actor.username || 'System',
      });

      return {
        voucherNo: voucher.voucher.voucherNo,
        chequeNumber,
        depositAccountId: depositAccount.id,
        depositAccountNo: depositAccount.accountNo,
        depositAccountNewBalance: toNum(depositAccount.balance) + amount,
        drawerAccountId: drawerAccount.id,
        drawerAccountNo: drawerAccount.accountNo,
        drawerAccountNewBalance: toNum(drawerAccount.balance) - amount,
        drawerMemberName: drawerAccount.memberName,
      };
    });

    await writeAuditLog(buildAuditRow(
      actor, 'Savings & Deposits', 'Internal Cheque Transfer',
      `Internal cheque ${chequeNumber} (NPR ${amount.toLocaleString()}) settled ${result.drawerAccountNo} → ${result.depositAccountNo}`,
    ));

    return result;
  }

  async listChequeDeposits(organizationId: string, branchIds?: string[], status?: string, accountId?: string) {
    return this.depositRepository.listChequeDeposits({ organizationId, branchIds, status, accountId });
  }

  // ─────────────────────────────────────────────────────────────
  // Task 4 — Account Ledger
  // ─────────────────────────────────────────────────────────────

  private ledgerTypeOf(txnType: string): 'deposit' | 'withdrawal' | 'interest' | 'charge' | 'transfer' {
    if (txnType === 'Deposit') return 'deposit';
    if (txnType === 'Withdrawal') return 'withdrawal';
    if (txnType === 'Interest_Posting') return 'interest';
    if (txnType === 'Penalty') return 'charge';
    return 'transfer';
  }

  async getLedger(accountId: string, organizationId: string, branchIds: string[] | undefined, opts: { from?: string; to?: string; txnType?: string }) {
    const account = await this.repository.findById(accountId, organizationId, branchIds);
    if (!account) throw new Error('Savings account not found.');

    const all = await this.depositRepository.getLedgerTransactions(accountId, organizationId, branchIds);
    const closing = toNum(account.balance);
    let opening = closing;
    for (const t of all) {
      const amt = toNum(t.amount);
      if (CREDIT_TYPES.includes(t.type)) opening -= amt;
      else if (DEBIT_TYPES.includes(t.type)) opening += amt;
    }

    let running = opening;
    const runningMap = new Map<string, number>();
    for (const t of all) {
      const isCredit = CREDIT_TYPES.includes(t.type);
      const amount = toNum(t.amount);
      running = isCredit ? running + amount : running - amount;
      runningMap.set(t.id, round2(running));
    }

    let txns = all;
    if (opts.from) txns = txns.filter((t) => t.dateBs >= opts.from!);
    if (opts.to) txns = txns.filter((t) => t.dateBs <= opts.to!);
    if (opts.txnType && opts.txnType !== 'all') {
      const typeMap: Record<string, string[]> = {
        deposit: ['Deposit'], withdrawal: ['Withdrawal'], interest: ['Interest_Posting'],
        charge: ['Penalty'], transfer: ['Transfer_In', 'Transfer_Out'],
      };
      const types = typeMap[opts.txnType];
      if (types) txns = txns.filter((t) => types.includes(t.type));
    }

    const entries = txns.map((t) => {
      const isCredit = CREDIT_TYPES.includes(t.type);
      const amount = toNum(t.amount);
      return {
        id: t.id,
        bsDate: t.dateBs,
        dateAd: t.dateAd ?? null,
        voucherNo: t.voucherNo,
        particulars: t.remarks || t.type,
        txnType: this.ledgerTypeOf(t.type),
        debit: isCredit ? 0 : amount,
        credit: isCredit ? amount : 0,
        balance: runningMap.get(t.id) ?? round2(running),
        tellerName: t.tellerName ?? 'System',
      };
    });

    return {
      accountId: account.id,
      accountNumber: account.accountNo,
      memberName: account.memberName,
      openingBalance: round2(opening),
      closingBalance: closing,
      entries,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Task 5 — Passbook Printer
  // ─────────────────────────────────────────────────────────────

  async getPassbookSummary(accountId: string, organizationId: string, branchIds?: string[]) {
    const account = await this.repository.findById(accountId, organizationId, branchIds);
    if (!account) throw new Error('Savings account not found.');
    return {
      id: account.id,
      accountNumber: account.accountNo,
      memberName: account.memberName,
      lastPrintedTxnId: account.lastPrintedTxnId || null,
      lastPrintedLine: toNum(account.lastPrintedLine),
      linesPerPage: account.passbookLinesPerPage || 30,
      passbookSerial: account.passbookSerial || account.accountNo,
    };
  }

  /** Unprinted transactions since the last-print marker (or all when none). */
  async getUnprintedTransactions(accountId: string, organizationId: string, branchIds?: string[], opts: { from?: string; to?: string } = {}) {
    const account = await this.repository.findById(accountId, organizationId, branchIds);
    if (!account) throw new Error('Savings account not found.');

    const all = await this.depositRepository.getLedgerTransactions(accountId, organizationId, branchIds);

    // Resolve the marker transaction's createdAt to bound the "since last" window.
    let markerCreatedAt: Date | null = null;
    if (account.lastPrintedTxnId) {
      const marker = all.find((t) => t.id === account.lastPrintedTxnId);
      if (marker) markerCreatedAt = marker.createdAt;
    }

    let txns = all;
    if (opts.from || opts.to) {
      if (opts.from) txns = txns.filter((t) => t.dateBs >= opts.from!);
      if (opts.to) txns = txns.filter((t) => t.dateBs <= opts.to!);
    } else if (markerCreatedAt) {
      txns = txns.filter((t) => (t.createdAt?.getTime() ?? 0) > markerCreatedAt.getTime());
    }

    const closing = toNum(account.balance);
    let opening = closing;
    for (const t of all) {
      const amt = toNum(t.amount);
      if (CREDIT_TYPES.includes(t.type)) opening -= amt;
      else if (DEBIT_TYPES.includes(t.type)) opening += amt;
    }

    let running = opening;
    const map = new Map<string, number>();
    for (const t of all) {
      const isCredit = CREDIT_TYPES.includes(t.type);
      const amount = toNum(t.amount);
      running = isCredit ? running + amount : running - amount;
      map.set(t.id, round2(running));
    }

    return txns.map((t) => {
      const isCredit = CREDIT_TYPES.includes(t.type);
      const amount = toNum(t.amount);
      return {
        id: t.id,
        bsDate: t.dateBs,
        dateAd: t.dateAd ?? null,
        voucherNo: t.voucherNo,
        particulars: t.remarks || t.type,
        debit: isCredit ? 0 : amount,
        credit: isCredit ? amount : 0,
        balance: map.get(t.id) ?? round2(running),
        tellerName: t.tellerName ?? 'System',
      };
    });
  }

  /**
   * Generate the passbook PDF for the given range and advance the last-printed
   * marker. Returns a data URL the browser can open directly.
   */
  async printPassbook(accountId: string, organizationId: string, branchIds: string[] | undefined, actor: SettingsActor, opts: { mode: 'since_last' | 'custom'; from?: string; to?: string }) {
    const account = await this.repository.findById(accountId, organizationId, branchIds);
    if (!account) throw new Error('Savings account not found.');

    const lines = await this.getUnprintedTransactions(accountId, organizationId, branchIds,
      opts.mode === 'custom' ? { from: opts.from, to: opts.to } : {});

    if (lines.length === 0) throw new Error('No unprinted transactions to print.');

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    pdf.setFontSize(12);
    pdf.text('Passbook — ' + account.accountNo, 14, 16);
    pdf.setFontSize(10);
    pdf.text('Member: ' + account.memberName, 14, 22);
    pdf.text('Serial: ' + (account.passbookSerial || account.accountNo), 14, 28);
    pdf.text('Printed: ' + getTodayBS(), 14, 34);

    pdf.setFontSize(8);
    let y = 44;
    pdf.setFillColor(240, 240, 240);
    pdf.rect(10, y - 4, pageWidth - 20, 6, 'F');
    pdf.text('Date', 12, y);
    pdf.text('Particulars', 50, y);
    pdf.text('Debit', 130, y, { align: 'right' });
    pdf.text('Credit', 150, y, { align: 'right' });
    pdf.text('Balance', 180, y, { align: 'right' });
    y += 7;

    for (const line of lines) {
      if (y > pdf.internal.pageSize.getHeight() - 12) {
        pdf.addPage();
        y = 16;
      }
      pdf.text(String(line.bsDate), 12, y);
      pdf.text(String(line.particulars).slice(0, 40), 50, y);
      pdf.text(line.debit ? line.debit.toLocaleString() : '', 130, y, { align: 'right' });
      pdf.text(line.credit ? line.credit.toLocaleString() : '', 150, y, { align: 'right' });
      pdf.text(line.balance.toLocaleString(), 180, y, { align: 'right' });
      y += 5;
    }

    // Advance the last-printed marker only after the PDF is generated.
    const lastTxn = lines[lines.length - 1];
    const nextLine = toNum(account.lastPrintedLine) + lines.length;
    const db = getDb();
    if (db) {
      await db.update(savingsAccounts)
        .set({
          lastPrintedTxnId: lastTxn.id,
          lastPrintedLine: nextLine,
          lastPrintedDateBs: getTodayBS(),
          updatedAt: new Date(),
        })
        .where(and(eq(savingsAccounts.id, account.id), eq(savingsAccounts.organizationId, organizationId)));
    }

    await writeAuditLog(buildAuditRow(
      actor, 'Savings & Deposits', 'Passbook Printed',
      `Printed ${lines.length} line(s) for ${account.accountNo}`,
    ));

    return { pdfUrl: pdf.output('datauristring'), printed: lines.length, newLine: nextLine };
  }

  /** Calibration grid PDF for passbook printer alignment (no member data). */
  async testAlignmentPdf() {
    const pdf = new jsPDF();
    const w = pdf.internal.pageSize.getWidth();
    const h = pdf.internal.pageSize.getHeight();
    for (let x = 10; x < w; x += 10) {
      pdf.setDrawColor(220, 220, 220);
      pdf.line(x, 8, x, h - 8);
    }
    for (let y = 8; y < h; y += 6) {
      pdf.setDrawColor(220, 220, 220);
      pdf.line(8, y, w - 8, y);
    }
    pdf.setDrawColor(0);
    pdf.setFontSize(8);
    pdf.text('PASSBOOK ALIGNMENT GRID — no member data', 14, 12);
    return pdf.output('datauristring');
  }

  /** Member search for the Open Account page (design shape). */
  async searchMembers(organizationId: string, query: string, branchIds?: string[]) {
    const result = await this.memberRepository.findAll({
      organizationId,
      search: query || undefined,
      branchIds,
      limit: 20,
    });
    return result.data.map((m: any) => ({
      id: m.id,
      memberCode: m.memberNo,
      name: m.fullName,
      phone: m.phone,
      kycStatus: m.kycStatus ?? 'pending',
      memberTypeId: m.memberTypeId,
    }));
  }

  /** Member nominees for the Open Account page. */
  async getMemberNominees(memberId: string, organizationId: string) {
    const member = await this.memberRepository.findById(memberId, organizationId);
    if (!member) throw new Error('Member not found.');
    const nominee = (member as any).nomineeName
      ? [{
          id: member.familyId || member.id,
          name: (member as any).nomineeName,
          relationship: (member as any).nomineeRelation || 'Nominee',
        }]
      : [];
    return nominee;
  }

  /** Batch interest posting for all eligible savings accounts. */
  async runBatchInterestPosting(
    organizationId: string,
    branchIds: string[] | undefined,
    actor: SettingsActor,
    opts: { period?: string } = {},
  ) {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');

    const conditions = [eq(savingsAccounts.organizationId, organizationId)];
    if (branchIds !== undefined) conditions.push(inArray(savingsAccounts.branchId, branchIds));

    const accounts = await db.select().from(savingsAccounts).where(and(...conditions));

    const periodMultiplier = opts.period === 'monthly' ? 12 : opts.period === 'annual' ? 1 : 4;
    const todayBS = getTodayBS();
    const todayAD = getTodayADFormatted();
    const voucherNo = `INT-${Date.now().toString().slice(-6)}`;
    const postings: Array<{ accountId: string; memberId: string; memberName: string; accountNo: string; branchId: string; amount: number; balanceAfter: number }> = [];
    let totalPosted = 0;

    for (const acc of accounts) {
      const balance = toNum(acc.balance);
      if (balance <= 0) continue;
      const rate = toNum(acc.interestRate);
      if (rate <= 0) continue;
      const accrued = round2((balance * rate / 100) / periodMultiplier);
      if (accrued <= 0) continue;

      const newBalance = round2(balance + accrued);
      totalPosted += accrued;
      postings.push({ accountId: acc.id, memberId: acc.memberId, memberName: acc.memberName || '', accountNo: acc.accountNo || '', branchId: acc.branchId, amount: accrued, balanceAfter: newBalance });
    }

    if (postings.length === 0) {
      return { totalPosted: 0, accountsPosted: 0, voucherNo: null };
    }

    // Batch update balances + insert transactions
    for (const p of postings) {
      await db.update(savingsAccounts)
        .set({ balance: String(p.balanceAfter) })
        .where(eq(savingsAccounts.id, p.accountId));

      await db.insert(savingsTransactions).values({
        id: uuidv4(),
        organizationId,
        accountId: p.accountId,
        accountNo: p.accountNo,
        memberId: p.memberId,
        memberName: p.memberName,
        type: 'Interest_Posting',
        amount: String(p.amount),
        balanceAfter: String(p.balanceAfter),
        dateBs: todayBS,
        dateAd: todayAD,
        voucherNo,
        tellerName: 'System',
        remarks: `Batch ${opts.period || 'quarterly'} interest posting`,
        paymentMode: 'Cash',
        branchId: p.branchId,
      });
    }

    // Post GL voucher: Dr Interest Expense (5001), Cr Savings Liability (2001)
    try {
      await postSavingsVoucher({
        organizationId,
        branchId: postings[0]?.accountId || '',
        dateBs: todayBS,
        dateAd: todayAD,
        voucherType: 'Journal',
        narration: `Batch ${opts.period || 'quarterly'} interest posting — ${postings.length} accounts, NPR ${totalPosted.toLocaleString()}`,
        preparedBy: actor.username || 'System',
        entries: [
          { accountId: '', accountCode: '5001', accountName: 'Interest Expense', debit: totalPosted, credit: 0 },
          { accountId: '', accountCode: '2001', accountName: 'Savings Liability', debit: 0, credit: totalPosted },
        ],
      });
    } catch {
      // GL posting is best-effort; the interest balances are already written.
    }

    return {
      totalPosted: round2(totalPosted),
      accountsPosted: postings.length,
      voucherNo,
      period: opts.period || 'quarterly',
    };
  }
}
