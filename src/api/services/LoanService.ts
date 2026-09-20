import { LoanRepository, LoanFilter } from '../repositories/LoanRepository';
import { loanAccounts, emiSchedules, loanRepayments, members, loanProducts, approvalRequests } from '../../db/schema';
import { LoanEligibilityService } from './LoanEligibilityService';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../db/client';
import { eq, and } from 'drizzle-orm';
import { getTodayBSFormatted } from '../../utils/nepaliCalendar';

export class LoanService {
  private repository: LoanRepository;
  private eligibilityService: LoanEligibilityService;

  constructor() {
    this.repository = new LoanRepository();
    this.eligibilityService = new LoanEligibilityService();
  }

  async getLoans(filter: LoanFilter) {
    if (!filter.organizationId) throw new Error('Organization context is required.');
    return this.repository.findAll(filter);
  }

  async getLoanById(id: string, organizationId: string, branchIds?: string[]) {
    const loan = await this.repository.findById(id, organizationId, branchIds);
    if (!loan) throw new Error('Loan account not found');
    return loan;
  }

  async applyForLoan(data: typeof loanAccounts.$inferInsert, organizationId: string, opts?: { overrideReason?: string; actorRole?: string; userId?: string }) {
    if (!organizationId) throw new Error('Organization context is required.');
    if (!data.memberId || !data.branchId) {
      throw new Error('Member ID and Branch ID are required');
    }

    data.organizationId = organizationId;
    if (!data.loanNo) {
      data.loanNo = `LN-${Date.now().toString().slice(-6)}`;
    }

    const db = getDb();
    if (!db) throw new Error('Database not connected.');

    const [member] = await db.select().from(members)
      .where(and(eq(members.id, data.memberId), eq(members.organizationId, organizationId)))
      .limit(1);
    if (!member) throw new Error('Member not found');

    data.memberName = member.fullName;
    data.memberNo = member.memberNo;

    if (data.loanProductId) {
      const [product] = await db.select().from(loanProducts)
        .where(eq(loanProducts.id, data.loanProductId))
        .limit(1);
      if (product) {
        data.productName = product.name;
        data.interestRate = product.interestRate;
        data.interestMethod = product.interestMethod;
      }

      const gate = await this.eligibilityService.applyGate(
        organizationId,
        data.memberId,
        data.loanProductId,
        { overrideReason: opts?.overrideReason, actorRole: opts?.actorRole }
      );
      data.eligibilityStatus = gate.status;
      data.eligibilityReasons = gate.status === 'Overridden' ? gate.reasons : [];
      data.eligibilityOverrideReason = gate.overrideReason ?? null;
    }

    const appliedAmount = Number(data.appliedAmount) || 0;
    data.approvedAmount = String(appliedAmount);
    data.outstandingPrincipal = String(appliedAmount);
    data.tenureMonths = data.tenureMonths || 24;

    const rate = Number(data.interestRate) || 13.5;
    const monthlyRate = (rate / 100) / 12;
    const n = data.tenureMonths;
    if (monthlyRate > 0 && n > 0) {
      data.monthlyEmi = String(Math.round(
        (appliedAmount * monthlyRate * Math.pow(1 + monthlyRate, n)) /
        (Math.pow(1 + monthlyRate, n) - 1)
      ));
    } else {
      data.monthlyEmi = String(Math.round(appliedAmount / n));
    }

    data.disbursedDateBs = data.disbursedDateBs || '';
    data.maturityDateBs = data.maturityDateBs || '';
    data.status = 'Applied';
    data.createdBy = opts?.actorRole || null;

    const loan = await this.repository.create(data);

    // Create approval request so it appears in the Workflow Approval queue
    await db.insert(approvalRequests).values({
      organizationId,
      requestType: 'Loan_Approval',
      referenceNo: loan.loanNo,
      requestedBy: opts?.userId || data.memberId,
      requestedDateBs: getTodayBSFormatted(),
      amount: String(appliedAmount),
      description: JSON.stringify({
        loanId: loan.id,
        loanNo: loan.loanNo,
        memberId: data.memberId,
        memberName: data.memberName,
        memberNo: data.memberNo,
        productName: data.productName,
        appliedAmount,
        tenureMonths: data.tenureMonths,
        interestRate: data.interestRate,
      }),
      branchId: data.branchId,
      status: 'Pending',
    });

    return loan;
  }

  async approveLoan(id: string, organizationId: string, approvedAmount: string) {
    return this.repository.update(id, { 
      status: 'Approved',
      approvedAmount,
      outstandingPrincipal: approvedAmount // typically set upon disbursement, but doing it here for simplicity
    }, organizationId);
  }

  async processRepayment(data: Omit<typeof loanRepayments.$inferInsert, 'id' | 'totalPaid' | 'outstandingAfter'>, organizationId: string, branchIds?: string[]) {
    if (!organizationId) throw new Error('Organization context is required.');
    const loan = await this.repository.findById(data.loanId, organizationId, branchIds);
    if (!loan) throw new Error('Loan not found');

    const principalPaid = Number(data.principalPaid ?? 0) || 0;
    const interestPaid = Number(data.interestPaid ?? 0) || 0;
    const penaltyPaid = Number(data.penaltyPaid ?? 0) || 0;
    const totalPaid = principalPaid + interestPaid + penaltyPaid;

    if (!Number.isFinite(totalPaid) || totalPaid <= 0) {
      throw new Error('Invalid payment amount');
    }

    const repaymentData: typeof loanRepayments.$inferInsert = {
      ...data,
      id: uuidv4(),
      organizationId,
      principalPaid: String(principalPaid),
      interestPaid: String(interestPaid),
      penaltyPaid: String(penaltyPaid),
      totalPaid: String(totalPaid),
      outstandingAfter: '0' // Repository computes and writes the real value
    };

    return this.repository.processRepayment(repaymentData, organizationId, branchIds);
  }
}
