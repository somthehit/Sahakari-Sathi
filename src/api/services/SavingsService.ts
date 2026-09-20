import { SavingsRepository, SavingsFilter, TransactionFilter } from '../repositories/SavingsRepository';
import { savingsAccounts, savingsTransactions } from '../../db/schema';
import { v4 as uuidv4 } from 'uuid';

/** Transaction types that increase the savings balance. */
const CREDIT_TYPES = ['Deposit', 'Interest_Posting', 'Transfer_In'];
/** Transaction types that decrease the savings balance. */
const DEBIT_TYPES = ['Withdrawal', 'Transfer_Out', 'Penalty'];

export interface SavingsStatementResult {
  account: typeof savingsAccounts.$inferSelect;
  transactions: (typeof savingsTransactions.$inferSelect & { runningBalance: number })[];
  openingBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  closingBalance: number;
}

/**
 * Reconstructs a ledger statement from an account's current balance and its
 * chronological transactions. The closing balance is authoritative (the
 * account row), and the opening balance is derived from the full transaction
 * history (allTransactions). The running balance is computed only over
 * displayTransactions (which may be a type-filtered subset).
 */
export function computeSavingsStatement(
  account: Pick<typeof savingsAccounts.$inferSelect, 'balance'>,
  allTransactions: typeof savingsTransactions.$inferSelect[],
  displayTransactions?: typeof savingsTransactions.$inferSelect[]
): Omit<SavingsStatementResult, 'account'> {
  const closingBalance = round2(Number(account.balance) || 0);

  let totalDeposits = 0;
  let totalWithdrawals = 0;
  for (const txn of allTransactions) {
    const amount = Number(txn.amount) || 0;
    if (CREDIT_TYPES.includes(txn.type)) totalDeposits += amount;
    else if (DEBIT_TYPES.includes(txn.type)) totalWithdrawals += amount;
  }

  const openingBalance = round2(closingBalance - totalDeposits + totalWithdrawals);

  // Compute running balance map over complete transaction history
  let running = openingBalance;
  const runningMap = new Map<string, number>();
  for (const t of allTransactions) {
    const amt = Number(t.amount) || 0;
    if (CREDIT_TYPES.includes(t.type)) running += amt;
    else if (DEBIT_TYPES.includes(t.type)) running -= amt;
    runningMap.set(t.id, round2(running));
  }

  const rows = (displayTransactions ?? allTransactions).map((txn) => {
    return { ...txn, runningBalance: runningMap.get(txn.id) ?? round2(running) };
  });

  return {
    transactions: rows,
    openingBalance,
    totalDeposits: round2(totalDeposits),
    totalWithdrawals: round2(totalWithdrawals),
    closingBalance,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export class SavingsService {
  private repository: SavingsRepository;

  constructor() {
    this.repository = new SavingsRepository();
  }

  async getAccounts(filter: SavingsFilter) {
    if (!filter.organizationId) throw new Error('Organization context is required.');
    return this.repository.findAll(filter);
  }

  async getAccountById(id: string, organizationId: string, branchIds?: string[]) {
    const account = await this.repository.findById(id, organizationId, branchIds);
    if (!account) throw new Error('Savings account not found');
    return account;
  }

  async openAccount(data: typeof savingsAccounts.$inferInsert, organizationId: string) {
    if (!organizationId) throw new Error('Organization context is required.');
    // Basic validation
    if (!data.memberId || !data.branchId) {
      throw new Error('Member ID and Branch ID are required');
    }

    // Business rule: only ONE ACTIVE savings account per (member, product).
    const existing = await this.repository.findActiveByMemberAndProduct(
      organizationId,
      data.memberId,
      data.savingsProductId ?? null,
    );
    if (existing) {
      throw new Error('Member already possesses an active account for this savings product.');
    }
    
    data.organizationId = organizationId;
    // Auto-generate account number if not provided
    if (!data.accountNo) {
      data.accountNo = `SAV-${Date.now().toString().slice(-6)}`;
    }

    return this.repository.create(data);
  }

  async processTransaction(data: Omit<typeof savingsTransactions.$inferInsert, 'id' | 'balanceAfter'>, organizationId: string, branchIds?: string[]) {
    if (!organizationId) throw new Error('Organization context is required.');
    const account = await this.repository.findById(data.accountId, organizationId, branchIds);
    if (!account) throw new Error('Account not found');

    // Prepare transaction payload
    const transactionData: typeof savingsTransactions.$inferInsert = {
      ...data,
      id: uuidv4(),
      organizationId,
      balanceAfter: '0' // Temporary, repository handles the actual math
    };

    return this.repository.processTransaction(transactionData, organizationId, branchIds);
  }

  async getAccountTransactions(accountId: string, organizationId: string, branchIds?: string[]) {
    return this.repository.getTransactions(accountId, organizationId, branchIds);
  }

  async getAccountStatement(
    accountId: string,
    organizationId: string,
    branchIds?: string[],
    filter: TransactionFilter = {}
  ): Promise<SavingsStatementResult> {
    if (!organizationId) throw new Error('Organization context is required.');
    const account = await this.repository.findById(accountId, organizationId, branchIds);
    if (!account) throw new Error('Savings account not found');

    // Fetch ALL transactions (no type filter) so the opening balance is derived
    // from the full history, not the filtered subset.
    const allTransactions = await this.repository.getTransactions(accountId, organizationId, branchIds, {
      dateFromBs: filter.dateFromBs,
      dateToBs: filter.dateToBs,
    });

    // Filter by type for display only (running balance computation).
    const displayTransactions = filter.type
      ? allTransactions.filter((t) => t.type === filter.type)
      : allTransactions;

    return { account, ...computeSavingsStatement(account, allTransactions, displayTransactions) };
  }
}
