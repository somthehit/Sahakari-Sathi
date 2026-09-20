import { AccountingRepository, VoucherFilter } from '../repositories/AccountingRepository';
import { chartOfAccounts, vouchers, voucherEntries } from '../../db/schema';
import { v4 as uuidv4 } from 'uuid';

export class AccountingService {
  private repository: AccountingRepository;

  constructor() {
    this.repository = new AccountingRepository();
  }

  // --- Chart of Accounts ---
  async getChartOfAccounts(organizationId: string) {
    return this.repository.getChartOfAccounts(organizationId);
  }

  async getAccountByCode(code: string, organizationId: string) {
    return this.repository.getAccountByCode(code, organizationId);
  }

  async createAccount(data: typeof chartOfAccounts.$inferInsert) {
    return this.repository.createAccount(data);
  }

  // --- Vouchers ---
  async getVouchers(filter: VoucherFilter) {
    if (!filter.organizationId) throw new Error('Organization context is required.');
    return this.repository.findVouchers(filter);
  }

  async getVoucherDetails(id: string, organizationId: string, branchIds?: string[]) {
    const details = await this.repository.getVoucherDetails(id, organizationId, branchIds);
    if (!details) throw new Error('Voucher not found');
    return details;
  }

  async createVoucher(
    voucherData: typeof vouchers.$inferInsert, 
    entriesData: Omit<typeof voucherEntries.$inferInsert, 'voucherId'>[],
    organizationId: string
  ) {
    // Generate voucher number from the org's voucher-type counter if not provided.
    if (!voucherData.voucherNo) {
      voucherData.voucherNo = await this.repository.nextVoucherNo(
        organizationId,
        voucherData.voucherType as string,
        voucherData.fiscalYearCode ?? '',
      );
    }
    return this.repository.createVoucher(voucherData, entriesData, organizationId);
  }

  async postVoucher(id: string, organizationId: string, approvedBy: string, branchIds?: string[]) {
    return this.repository.postVoucher(id, organizationId, approvedBy, branchIds);
  }

  async backfillLedgers(organizationId: string) {
    return this.repository.backfillLedgers(organizationId);
  }

  async getLedgerData(organizationId: string, fiscalYearCode?: string, branchId?: string) {
    return this.repository.getLedgerData(organizationId, fiscalYearCode, branchId);
  }
}
