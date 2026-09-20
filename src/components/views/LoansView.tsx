import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useCoop } from '../../context/CoopContext';
import { fetchAccountingSettings, type PaymentMethod as PaymentMethodConfig } from '../../api/accountingSettings';
import {
  Landmark, 
  CreditCard, 
  TrendingUp, 
  Shield, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Calculator, 
  FileCheck, 
  DollarSign,
  Calendar,
  FileSpreadsheet,
  Search,
  Filter,
  Layers,
  Percent,
  User,
  ArrowRight,
  Printer,
  FileText,
  Clock,
  Sparkles,
  X,
  Fingerprint,
  BadgeCheck,
  Banknote,
  Award,
  Settings2,
} from 'lucide-react';
import { formatNPR, getTodayBS } from '../../utils/nepaliCalendar';
import { calculateRealtimeEmiBreakdown } from '../../utils/financialEngine';
import { ExpandableFormCard } from '../common/ExpandableFormCard';
import { RepaymentVoucherModal } from '../modals/RepaymentVoucherModal';
import { DisbursementVoucherModal } from '../modals/DisbursementVoucherModal';
import { LoanWriteOffModal } from '../modals/LoanWriteOffModal';
import { fetchLoanSettings, checkLoanEligibility, applyForLoan } from '../../api/loanSettings';
import type { LoanProduct, LoanEligibilityResult } from '../../api/loanSettings';
import type { RepaymentResult } from '../../context/CoopContext';
import { useAuthStore } from '../../stores/authStore';
import { PaymentMethodSelector, type PaymentMethod } from '../shared/PaymentMethodSelector';
import type { ChequeSelectorData } from '../shared/ChequePaymentSelector';
import { 
  RepaymentPaymentDetails, 
  type CashDenominationState, 
  type ChequeClearanceState, 
  type SavingsAutoDebitState 
} from '../loans/RepaymentPaymentDetails';
import {
  CollateralSection,
  GuarantorSection,
  DocumentChecklist,
  RiskApprovalPanel,
  LegalDocumentPanel,
} from './loans/LoanWizardEnhanced';
import type { CollateralInput, GuarantorInput, ValidationResult } from '../../api/loanApplications';

interface Props {
  activeSubKey?: string;
}

export const LoansView: React.FC<Props> = ({ activeSubKey }) => {
  const { 
    loanAccounts = [], 
    savingsAccounts = [],
    members = [], 
    chartOfAccounts = [],
    processLoanRepayment, 
    disburseLoan, 
    activeBranchId,
    branches = [],
    openTab,
    setSelectedAccountForPassbook,
    reloadMasterData
  } = useCoop();
  const authUser = useAuthStore((s) => s.user);
  const canOverride = !!authUser && (authUser.isOrgAdmin || authUser.role === 'manager');

  const safeLoanAccounts = loanAccounts || [];
  const safeMembers = members || [];
  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0];

  const [activeSubTab, setActiveSubTab] = useState<'repayment' | 'appraisal' | 'portfolio' | 'npl_provisioning' | 'amortization'>('repayment');

  React.useEffect(() => {
    if (activeSubKey === 'loan_appraisal') setActiveSubTab('appraisal');
    else if (activeSubKey === 'loan_repayment') setActiveSubTab('repayment');
    else if (activeSubKey === 'loan_portfolio') setActiveSubTab('portfolio');
    else if (activeSubKey === 'loan_npl') setActiveSubTab('npl_provisioning');
    else if (activeSubKey === 'loan_amortization') setActiveSubTab('amortization');
  }, [activeSubKey]);

  // Fetch payment methods from database
  React.useEffect(() => {
    const loadPaymentMethods = async () => {
      setPaymentMethodsLoading(true);
      try {
        const methods = await fetchAccountingSettings('payment-methods');
        setPaymentMethods(methods.filter((m: PaymentMethodConfig) => m.isActive !== false));
      } catch (e) {
        console.error('Failed to load payment methods:', e);
      } finally {
        setPaymentMethodsLoading(false);
      }
    };
    loadPaymentMethods();
  }, []);
  
  // Repayment form state
  const [selectedLoanId, setSelectedLoanId] = useState<string>(safeLoanAccounts[0]?.id || '');
  const [repayAmount, setRepayAmount] = useState<string>('');
  const [repayDateBs, setRepayDateBs] = useState<string>(getTodayBS());
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'CHEQUE' | 'SAVINGS_AUTO_DEBIT'>('CASH');
  const [remarks, setRemarks] = useState<string>('Standard EMI Installment Repayment');
  const [cashState, setCashState] = useState<{ denominations: CashDenominationState; totalCashCounted: number; returnChange: number; isValid: boolean } | null>(null);
  const [cashDenomState, setCashDenomState] = useState<Record<number, number>>({ 1000: 0, 500: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
  const [chequeState, setChequeState] = useState<{ chequeDetails: ChequeClearanceState; isValid: boolean; error?: string } | null>(null);
  const [savingsDebitState, setSavingsDebitState] = useState<{ autoDebitDetails: SavingsAutoDebitState; isValid: boolean; error?: string } | null>(null);
  const [paymentSectionValid, setPaymentSectionValid] = useState<boolean>(true);
  const [paymentSectionError, setPaymentSectionError] = useState<string>('');

  // Loan Application form state
  const [memberId, setMemberId] = useState<string>(safeMembers[0]?.id || '');
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
  const [loanProductId, setLoanProductId] = useState<string>('');
  const [productType, setProductType] = useState<'business' | 'general' | 'agriculture' | 'emergency'>('business');
  const [loanAmount, setLoanAmount] = useState<string>('300000');
  const [tenureMonths, setTenureMonths] = useState<number>(24);
  const [collateralType, setCollateralType] = useState<string>('Land & Building Security');
  const [collateralValuation, setCollateralValuation] = useState<string>('800000');
  const [interestMethod, setInterestMethod] = useState<'declining' | 'flat'>('declining');
  const [guarantorName, setGuarantorName] = useState<string>('Hari Prasad Sharma');

  // Enhanced wizard state — collaterals & guarantors
  const [enhancedCollaterals, setEnhancedCollaterals] = useState<CollateralInput[]>([]);
  const [enhancedGuarantors, setEnhancedGuarantors] = useState<GuarantorInput[]>([]);
  const [enhancedDocCount, setEnhancedDocCount] = useState(0);
  const [enhancedValidation, setEnhancedValidation] = useState<ValidationResult | null>(null);
  const [enhancedCollateralValue, setEnhancedCollateralValue] = useState(0);
  const [eligibility, setEligibility] = useState<LoanEligibilityResult | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityError, setEligibilityError] = useState('');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [gateReasons, setGateReasons] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
  const [repaymentResult, setRepaymentResult] = useState<RepaymentResult | null>(null);
  const [disbursementResult, setDisbursementResult] = useState<import('../../api/loanServicing').DisbursementResult | null>(null);

  // Payment methods from database
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);

  // Write-off modal state
  const [writeOffModalOpen, setWriteOffModalOpen] = useState(false);
  const [writeOffLoan, setWriteOffLoan] = useState<any>(null);

  const [disburseModalLoan, setDisburseModalLoan] = useState<any>(null);
  const [disburseBankAccountId, setDisburseBankAccountId] = useState<string>('');
  const [disburseSavingsAccountId, setDisburseSavingsAccountId] = useState<string>('');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
  const [disbursePaymentMethod, setDisbursePaymentMethod] = useState<PaymentMethod>('cash');
  const [disburseChequeData, setDisburseChequeData] = useState<ChequeSelectorData | null>(null);
  const [disbursePaymentValid, setDisbursePaymentValid] = useState(true);

  // Map DB payment method type to internal payment mode
  const mapPaymentTypeToMode = (type: string): 'CASH' | 'CHEQUE' | 'SAVINGS_AUTO_DEBIT' => {
    const t = type?.toLowerCase() || '';
    if (t === 'cash' || t === 'नगद') return 'CASH';
    if (t === 'cheque' || t === 'check' || t === 'चेक') return 'CHEQUE';
    if (t === 'savings' || t === 'savings_auto_debit' || t === 'बचत') return 'SAVINGS_AUTO_DEBIT';
    // Default fallback based on name
    return 'CASH';
  };

  // Portfolio filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Amortization calculator interactive state
  const [calcAmount, setCalcAmount] = useState<number>(500000);
  const [calcRate, setCalcRate] = useState<number>(13.5);
  const [calcTenure, setCalcTenure] = useState<number>(36);

  // Active loan portfolio for amortization simulator
  const [activeLoanOptions, setActiveLoanOptions] = useState<any[]>([]);
  const [activeLoanLoading, setActiveLoanLoading] = useState(false);
  const [selectedSimLoanId, setSelectedSimLoanId] = useState<string>('');
  const [loanSearchQuery, setLoanSearchQuery] = useState('');
  const [loanSearchOpen, setLoanSearchOpen] = useState(false);

  // Loan search for EMI repayment selector
  const [repayLoanSearchQuery, setRepayLoanSearchQuery] = useState('');
  const [repayLoanSearchOpen, setRepayLoanSearchOpen] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  const selectedLoan = safeLoanAccounts.find(l => l.id === selectedLoanId) || safeLoanAccounts[0];

  const selectedProduct = loanProducts.find(p => p.id === loanProductId);

  // Calculated EMI for appraisal simulation (uses the selected product's rate)
  const numAmt = parseFloat(loanAmount) || 0;
  const productRate = selectedProduct?.interestRate || 13.5;
  const monthlyRate = (productRate / 100) / 12;
  const calculatedEmi = numAmt > 0 && tenureMonths > 0
    ? Math.round((numAmt * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1))
    : 0;

  // Loan-to-value ratio for appraisal
  const colVal = parseFloat(collateralValuation) || 1;
  const ltvRatio = Math.round((numAmt / colVal) * 100);

  // Fetch bank accounts when disbursement modal opens
  useEffect(() => {
    if (disburseModalLoan) {
      setBankAccountsLoading(true);
      Promise.all([
        fetchAccountingSettings('bank-accounts'),
        fetchAccountingSettings('banks'),
      ])
        .then(([accounts, banks]) => {
          const activeAccounts = accounts.filter((a: any) => a.isActive !== false);
          const bankMap = new Map(banks.map((b: any) => [b.id, b]));
          const enriched = activeAccounts.map((a: any) => ({
            ...a,
            bankName: bankMap.get(a.bankId)?.name || 'Unknown Bank',
          }));
          setBankAccounts(enriched);
        })
        .catch(() => setBankAccounts([]))
        .finally(() => setBankAccountsLoading(false));
    }
  }, [disburseModalLoan]);

  // Amortization schedule generator
  const generateAmortization = () => {
    const r = (calcRate / 100) / 12;
    const emi = Math.round((calcAmount * r * Math.pow(1 + r, calcTenure)) / (Math.pow(1 + r, calcTenure) - 1));
    let balance = calcAmount;
    const schedule = [];

    for (let i = 1; i <= calcTenure; i++) {
      const interest = Math.round(balance * r);
      const principal = emi - interest;
      balance = Math.max(0, balance - principal);
      schedule.push({
        month: i,
        emi,
        principal,
        interest,
        remaining: balance
      });
    }
    return { emi, schedule };
  };

  const calcResult = generateAmortization();

  // Load the org's loan products for the appraisal wizard.
  useEffect(() => {
    let active = true;
    fetchLoanSettings('loan-products').then((rows) => {
      if (!active) return;
      const products = rows as LoanProduct[];
      setLoanProducts(products);
      if (products.length > 0 && !loanProductId) {
        setLoanProductId(products[0].id);
        setProductType((products[0].productType as any) || 'general');
      }
    }).catch(() => {});
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run the eligibility gate whenever the borrower or product changes.
  useEffect(() => {
    if (!memberId || !loanProductId) return;
    let active = true;
    setEligibilityLoading(true);
    setEligibilityError('');
    checkLoanEligibility(memberId, loanProductId).then((result) => {
      if (!active) return;
      setEligibility(result);
      setEligibilityLoading(false);
      if (!result) setEligibilityError('Eligibility check unavailable. Application may be rejected by the backend gate.');
    }).catch(() => {
      if (!active) return;
      setEligibilityLoading(false);
      setEligibilityError('Eligibility check failed.');
    });
    return () => { active = false; };
  }, [memberId, loanProductId]);

  // Fetch active loan portfolio when amortization tab is active
  const activeLoanFetchDone = React.useRef(false);
  useEffect(() => {
    if (activeSubTab !== 'amortization' || activeLoanFetchDone.current) return;
    activeLoanFetchDone.current = true;
    setActiveLoanLoading(true);
    import('../../api/loanServicing').then(({ fetchActiveLoanPortfolio }) =>
      fetchActiveLoanPortfolio()
        .then((loans) => {
          console.log('[Amortization] Active loans loaded:', loans.length, loans);
          setActiveLoanOptions(loans);
        })
        .catch((err) => {
          console.error('[Amortization] Failed to load active loans:', err);
          setActiveLoanOptions([]);
        })
        .finally(() => setActiveLoanLoading(false))
    );
  }, [activeSubTab]);

  const handleSimLoanSelect = (loanId: string) => {
    setSelectedSimLoanId(loanId);
    setLoanSearchOpen(false);
    if (!loanId) return;
    const loan = activeLoanOptions.find((l: any) => l.id === loanId);
    if (loan) {
      setLoanSearchQuery(`${loan.loanNo} — ${loan.memberName}`);
      setCalcAmount(Number(loan.outstandingPrincipal) || Number(loan.approvedAmount));
      setCalcRate(Number(loan.interestRate));
      setCalcTenure(loan.tenureMonths);
    }
  };

  // Filter loans by search query (name, loan no, member no)
  const filteredLoanResults = useMemo(() => {
    if (!loanSearchQuery.trim() || selectedSimLoanId) return [];
    const q = loanSearchQuery.toLowerCase();
    return activeLoanOptions.filter((l: any) =>
      l.loanNo.toLowerCase().includes(q) ||
      l.memberName.toLowerCase().includes(q) ||
      l.memberNo.toLowerCase().includes(q)
    );
  }, [loanSearchQuery, activeLoanOptions, selectedSimLoanId]);

  // Click-outside to close autocomplete
  const loanSearchRef = useRef<HTMLDivElement>(null);
  const repaySearchRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (loanSearchRef.current && !loanSearchRef.current.contains(e.target as Node)) {
        setLoanSearchOpen(false);
      }
      if (repaySearchRef.current && !repaySearchRef.current.contains(e.target as Node)) {
        setRepayLoanSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Filtered loan results for repayment search
  const repayFilteredLoans = useMemo(() => {
    if (!repayLoanSearchQuery.trim() || selectedLoanId) return [];
    const q = repayLoanSearchQuery.toLowerCase();
    return safeLoanAccounts.filter(l =>
      (l.loanNo || '').toLowerCase().includes(q) ||
      (l.memberName || '').toLowerCase().includes(q) ||
      (l.memberNo || '').toLowerCase().includes(q)
    );
  }, [repayLoanSearchQuery, safeLoanAccounts, selectedLoanId]);

  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(repayAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid repayment amount.');
      return;
    }

    // Validation Guard by selected Payment Mode
    if (paymentMode === 'SAVINGS_AUTO_DEBIT') {
      if (!savingsDebitState?.isValid) {
        alert(savingsDebitState?.error || 'Insufficient Savings Balance to Auto-Debit EMI');
        return;
      }
    } else if (paymentMode === 'CHEQUE') {
      if (!chequeState?.isValid) {
        alert(chequeState?.error || 'Please fill all required cheque details.');
        return;
      }
    } else if (paymentMode === 'CASH') {
      // For CASH mode, validate using inline cashDenomState
      const totalCash = Object.entries(cashDenomState).reduce((sum, [note, count]) => sum + Number(note) * (Number(count) || 0), 0);
      if (totalCash > 0 && totalCash < amt) {
        alert(`Cash received is short by NPR ${(amt - totalCash).toLocaleString()}. Please collect full cash or update denominations.`);
        return;
      }
    }

    const paymentDetails = {
      sourceSavingsAccountId: paymentMode === 'SAVINGS_AUTO_DEBIT' ? savingsDebitState?.autoDebitDetails.sourceSavingsAccountId : undefined,
      chequeLeafId: paymentMode === 'CHEQUE' ? chequeState?.chequeDetails.chequeLeafId : undefined,
      chequeNumber: paymentMode === 'CHEQUE' ? chequeState?.chequeDetails.chequeNumber : undefined,
      payeeName: paymentMode === 'CHEQUE' ? chequeState?.chequeDetails.payeeName : undefined,
      chequeDateBs: paymentMode === 'CHEQUE' ? chequeState?.chequeDetails.chequeDateBs : undefined,
      chequeDateAd: paymentMode === 'CHEQUE' ? chequeState?.chequeDetails.chequeDateAd : undefined,
      chequeImageFile: paymentMode === 'CHEQUE' ? chequeState?.chequeDetails.chequeImageFile : undefined,
      chequeAmount: paymentMode === 'CHEQUE' ? chequeState?.chequeDetails.chequeAmount : undefined,
      denominations: paymentMode === 'CASH' ? cashDenomState : (paymentMode === 'CHEQUE' && chequeState?.chequeDetails.shortfall) ? cashState?.denominations : undefined,
      remarks,
      // Internal cheque repayment fields
      payerSavingsAccountId: paymentMode === 'CHEQUE' ? chequeState?.chequeDetails.payerSavingsAccountId : undefined,
      payerMemberId: paymentMode === 'CHEQUE' ? chequeState?.chequeDetails.payerMemberId : undefined,
      isThirdParty: paymentMode === 'CHEQUE' ? chequeState?.chequeDetails.isThirdParty : undefined,
    };

    const result = await processLoanRepayment(selectedLoanId, amt, paymentMode, paymentDetails);
    setRepayAmount('');
    if (result) {
      setRepaymentResult(result);
    } else {
      alert(`EMI Repayment of ${formatNPR(amt)} successfully posted!`);
    }
  };

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId || numAmt <= 0) {
      alert('Please fill required loan application details.');
      return;
    }
    if (!loanProductId) {
      alert('Please select a loan product.');
      return;
    }
    if (!activeBranchId) {
      alert('No branch is active for this application.');
      return;
    }

    if (eligibility && !eligibility.eligible && !(eligibility.allowOverride && overrideReason.trim().length > 4 && canOverride)) {
      const message = eligibility.reasons.length > 0
        ? `Member does not meet the eligibility criteria:\n\n${eligibility.reasons.map((r) => `• ${r}`).join('\n')}`
        : 'Member does not meet the eligibility criteria for this loan product.';
      alert(message);
      return;
    }

    setApplying(true);
    try {
      const result = await applyForLoan({
        memberId,
        productType,
        loanProductId,
        appliedAmount: numAmt,
        tenureMonths,
        branchId: activeBranchId,
        overrideReason: eligibility && !eligibility.eligible ? overrideReason : undefined,
      });

      if (result.success) {
        // If enhanced wizard data exists, create the full loan application record
        if (enhancedCollaterals.length > 0 || enhancedGuarantors.length > 0) {
          try {
            const { createLoanApplication } = await import('../../api/loanApplications');
            await createLoanApplication({
              borrowerId: memberId,
              loanProductId,
              requestedAmount: numAmt,
              tenureMonths,
              purposeCategory: productType,
              purposeDetail: 'सामान्य ऋण',
              repaymentFrequency: 'monthly',
              gracePeriodDays: 0,
              collaterals: enhancedCollaterals,
              guarantors: enhancedGuarantors,
            });
          } catch (e) {
            console.warn('Failed to save enhanced application data:', e);
          }
        }
        await reloadMasterData();
        alert('Loan Application submitted to Credit Appraisal Queue successfully!');
        setActiveSubTab('portfolio');
      } else if (result.code === 'LOAN_ELIGIBILITY_FAILED' && result.reasons && result.reasons.length > 0) {
        setGateReasons(result.reasons);
        setOverrideModalOpen(true);
      } else {
        alert(result.error || 'Loan application failed.');
      }
    } finally {
      setApplying(false);
    }
  };

  // Portfolio filtering
  const filteredLoans = safeLoanAccounts.filter(l => {
    const matchesSearch = (l.loanNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (l.memberName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter || l.nplStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Disburse modal: member savings accounts for savings_transfer method
  const memberSavingsForDisburse = disburseModalLoan
    ? (savingsAccounts || []).filter(
        (s: any) => s.memberId === disburseModalLoan.memberId && (s.status === 'Active' || s.status === 'active')
      )
    : [];

  // Calculate high-level loan metrics
  const totalDisbursed = safeLoanAccounts.reduce((acc, l) => acc + ((l as any).disbursedAmount || (l as any).amount || l.approvedAmount || 0), 0);
  const totalOutstanding = safeLoanAccounts.reduce((acc, l) => acc + (l.outstandingPrincipal || 0), 0);
  const totalProvisionRequired = safeLoanAccounts.reduce((acc, l) => acc + (l.provisionAmount || 0), 0);
  const nplLoansCount = safeLoanAccounts.filter(l => l.nplStatus !== 'Pass').length;

  // Breakdown of repayment interest vs principal preview — uses day-wise engine
  const enteredRepayNum = parseFloat(repayAmount) || (selectedLoan?.monthlyEMI || 0);
  const lastPayDate = selectedLoan?.lastRepaymentDateBS || selectedLoan?.disbursedDateBS || '';
  const currentPayDate = repayDateBs || getTodayBS();
  const liveBreakdown = selectedLoan && lastPayDate
    ? calculateRealtimeEmiBreakdown({
        outstandingPrincipal: selectedLoan.outstandingPrincipal,
        annualRatePct: selectedLoan.interestRate,
        lastPaymentDateBs: lastPayDate,
        currentPaymentDateBs: currentPayDate,
        paymentAmount: enteredRepayNum,
      })
    : null;
  const estInterestPortion = liveBreakdown?.accruedInterest ?? 0;
  const estPrincipalPortion = liveBreakdown?.principalPaid ?? 0;

  return (
    <>
    <div className="p-2 sm:p-4 space-y-5 max-w-[1800px] mx-auto text-slate-800">
      
      {/* Module Header & KPI Dashboard — only show on the consolidated view */}
      {!activeSubKey && (
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Loans & Credit Risk Operations</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Department of Cooperatives compliant credit desk, automated EMI scheduling, LTV appraisal & NPL provisioning
              </p>
            </div>
          </div>
        </div>

        {/* Executive KPI Summary Widgets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 min-w-[130px]">
            <span className="text-[10px] text-slate-500 font-semibold block uppercase">Total Portfolio</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{formatNPR(totalOutstanding)}</span>
            <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">Active Principal</span>
          </div>

          <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200 min-w-[130px]">
            <span className="text-[10px] text-emerald-700 font-semibold block uppercase">Disbursed Capital</span>
            <span className="font-mono font-bold text-emerald-900 text-sm">{formatNPR(totalDisbursed)}</span>
            <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">{safeLoanAccounts.length} Active Loans</span>
          </div>

          <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200 min-w-[130px]">
            <span className="text-[10px] text-emerald-800 font-semibold block uppercase">Portfolio Health</span>
            <span className="font-bold text-emerald-950 text-sm flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-600" /> Healthy
            </span>
            <span className="text-[10px] text-emerald-800 font-medium block mt-0.5">NPL Ratio: {safeLoanAccounts.length ? ((nplLoansCount / safeLoanAccounts.length) * 100).toFixed(1) : '0.0'}%</span>
          </div>

          <div className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-200 min-w-[130px]">
            <span className="text-[10px] text-rose-700 font-semibold block uppercase">Required Provision</span>
            <span className="font-mono font-bold text-rose-900 text-sm">{formatNPR(totalProvisionRequired)}</span>
            <span className="text-[10px] text-rose-700 font-medium block mt-0.5">{nplLoansCount} Non-Performing</span>
          </div>
        </div>
      </div>
      )}

      {/* Sub-Tab Navigation Bar — only show when not a standalone page */}
      {!activeSubKey && (
      <div className="flex items-center gap-1.5 p-1.5 bg-white border border-slate-200 rounded-xl overflow-x-auto text-xs font-semibold shadow-2xs scrollbar-none">
        <button
          onClick={() => setActiveSubTab('repayment')}
          className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${ activeSubTab === 'repayment' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>1. EMI Repayment Desk</span>
        </button>

        <button
          onClick={() => setActiveSubTab('appraisal')}
          className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${ activeSubTab === 'appraisal' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' }`}
        >
          <Plus className="w-4 h-4" />
          <span>2. Credit Appraisal Wizard</span>
        </button>

        <button
          onClick={() => setActiveSubTab('portfolio')}
          className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${ activeSubTab === 'portfolio' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' }`}
        >
          <Landmark className="w-4 h-4" />
          <span>3. Active Loan Portfolio ({loanAccounts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('npl_provisioning')}
          className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${ activeSubTab === 'npl_provisioning' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>4. NPL & Provisioning Matrix</span>
        </button>

        <button
          onClick={() => setActiveSubTab('amortization')}
          className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${ activeSubTab === 'amortization' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' }`}
        >
          <Calculator className="w-4 h-4" />
          <span>5. EMI Amortization Simulator</span>
        </button>
      </div>
      )}

      {/* ----------------- TAB 1: EMI REPAYMENT DESK ----------------- */}
      {activeSubTab === 'repayment' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Main Repayment Form (Clean White Container) */}
          <div className="lg:col-span-7 space-y-5">
            <ExpandableFormCard
              title="Loan installment EMI repayment"
              subtitle="Calculates interest vs principal split and updates general ledger accounts automatically"
              icon={<CreditCard className="w-5 h-5 text-emerald-600" />}
              badge={
                <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Credit Counter
                </span>
              }
              onSubmit={handleRepaySubmit}
              footerActions={
                <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="text-slate-600 font-medium">
                    Auto GL Entry:{' '}
                    <span className="font-mono text-emerald-700 font-bold">
                      {paymentMode === 'CASH'
                        ? 'Cr Cash / Dr Loan Principal & Interest'
                        : paymentMode === 'CHEQUE'
                        ? 'Cr Bank / Dr Loan Principal & Interest'
                        : 'Dr Member Savings / Cr Loan Principal & Interest'}
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer shadow-md text-xs flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Post EMI Repayment</span>
                  </button>
                </div>
              }
            >
              <div className="space-y-4">
                
                {/* Loan Account Selector */}
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-bold text-xs">Select Loan Account *</label>
                  <div className="relative" ref={repaySearchRef}>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      {selectedLoan ? (
                        <div className="w-full bg-white border border-emerald-300 rounded-xl p-3 text-xs flex items-center gap-2 shadow-2xs">
                          <div className="flex-1 min-w-0">
                            <span className="font-mono font-bold text-emerald-700">{selectedLoan.loanNo}</span>
                            <span className="text-slate-900 font-semibold ml-2">{selectedLoan.memberName}</span>
                            <span className="text-slate-500 ml-2">
                              (Outstanding: <span className="font-mono font-bold text-slate-700">{formatNPR(selectedLoan.outstandingPrincipal)}</span>
                              {' '}&bull; EMI: <span className="font-mono font-bold text-emerald-700">{formatNPR(selectedLoan.monthlyEMI)}</span>)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLoanId('');
                              setRepayLoanSearchQuery('');
                              setRepayLoanSearchOpen(false);
                            }}
                            className="p-1 hover:bg-slate-100 rounded-full cursor-pointer shrink-0"
                            title="Clear selection"
                          >
                            <X className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={repayLoanSearchQuery}
                          onChange={(e) => {
                            setRepayLoanSearchQuery(e.target.value);
                            setSelectedLoanId('');
                            setRepayLoanSearchOpen(true);
                          }}
                          onFocus={() => { if (repayLoanSearchQuery) setRepayLoanSearchOpen(true); }}
                          placeholder="Type loan no, member name, or member no..."
                          className="w-full pl-9 pr-3 py-3 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 shadow-2xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                        />
                      )}
                    </div>

                    {/* Autocomplete Dropdown */}
                    {repayLoanSearchOpen && repayFilteredLoans.length > 0 && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-[280px] overflow-y-auto">
                        {repayFilteredLoans.map((loan: any) => (
                          <button
                            key={loan.id}
                            type="button"
                            onClick={() => {
                              setSelectedLoanId(loan.id);
                              setRepayLoanSearchQuery('');
                              setRepayLoanSearchOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition border-b border-slate-100 last:border-0 cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-xs font-mono font-bold text-emerald-700">{loan.loanNo}</span>
                                <span className="text-xs text-slate-900 font-semibold ml-2">{loan.memberName}</span>
                              </div>
                              <span className="text-[10px] text-slate-500">{loan.memberNo}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                              <span>{loan.productName}</span>
                              <span className="font-mono font-bold text-slate-700">
                                {formatNPR(loan.outstandingPrincipal)}
                              </span>
                              <span>EMI: {formatNPR(loan.monthlyEMI)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {repayLoanSearchOpen && repayLoanSearchQuery.trim() && !selectedLoanId && repayFilteredLoans.length === 0 && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-center text-xs text-slate-500">
                        No active loans found matching "{repayLoanSearchQuery}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Dates Side-by-Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-bold text-xs">Loan disbursement date (BS)</label>
                    <input
                      type="text"
                      value={lastPayDate || 'No prior repayment'}
                      readOnly
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl p-3 text-slate-500 text-xs font-mono cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-bold text-xs">Payment date (BS) *</label>
                    <input
                      type="text"
                      value={repayDateBs}
                      onChange={(e) => setRepayDateBs(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 text-xs font-mono shadow-2xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Interest Accrual Panel */}
                {selectedLoan && lastPayDate && liveBreakdown && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-blue-800">Interest accrual since last repayment</span>
                      <span className="text-blue-600 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {liveBreakdown.daysElapsed} days {lastPayDate === selectedLoan.disbursedDateBS ? '(from disbursement, no prior repayment)' : '(since last repayment)'}
                      </span>
                    </div>
                    <div className="bg-blue-100/50 rounded-lg p-3 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-700">Outstanding principal</span>
                        <span className="font-mono font-semibold text-blue-900">{formatNPR(selectedLoan.outstandingPrincipal)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-700">Annual rate</span>
                        <span className="font-mono text-blue-900">{selectedLoan.interestRate.toFixed(2)}%</span>
                      </div>
                      <div className="border-t border-blue-300/50 pt-1.5 flex justify-between text-xs font-semibold">
                        <span className="text-blue-800">
                          Interest due ({selectedLoan.outstandingPrincipal.toLocaleString()} × {selectedLoan.interestRate}% ÷ 365 × {liveBreakdown.daysElapsed}d)
                        </span>
                        <span className="font-mono text-blue-900">{formatNPR(liveBreakdown.accruedInterest)}</span>
                      </div>
                    </div>
                    {/* Days since last repayment badge */}
                    <div className="flex items-center gap-1.5 text-[11px] text-blue-600">
                      <Clock className="w-3 h-3" />
                      Days since last repayment: <span className="font-bold">{liveBreakdown.daysElapsed} days</span>
                    </div>
                  </div>
                )}

                {/* Amount & Mode */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-bold text-xs">Repayment Amount (NPR) *</label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min="100"
                        value={repayAmount}
                        onChange={(e) => setRepayAmount(e.target.value)}
                        placeholder={`Standard EMI: NPR ${selectedLoan?.monthlyEMI.toLocaleString() || '15,000'}`}
                        className="w-full bg-white border border-slate-300 rounded-xl p-3 pr-20 text-slate-900 font-mono text-sm font-bold shadow-2xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setRepayAmount(selectedLoan?.monthlyEMI.toString() || '')}
                        className="absolute right-2 top-2 bottom-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-300 transition cursor-pointer"
                      >
                        Set due
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-bold text-xs">Payment Channel / Mode *</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 text-xs font-semibold shadow-2xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    >
                      {paymentMethods.length > 0 ? (
                        paymentMethods.map((pm) => (
                          <option key={pm.id} value={mapPaymentTypeToMode(pm.type)}>
                            {pm.name || pm.code}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="CASH">Cash at Counter</option>
                          <option value="CHEQUE">Co-operative Cheque</option>
                          <option value="SAVINGS_AUTO_DEBIT">Savings Account Auto-Debit</option>
                        </>
                      )}
                    </select>
                    {paymentMethodsLoading && (
                      <p className="text-[10px] text-slate-400">Loading payment methods...</p>
                    )}
                  </div>
                </div>

                {/* 3-Card Interest/Principal/New Outstanding Split */}
                {selectedLoan && liveBreakdown && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Interest portion</span>
                      <span className="font-mono font-bold text-rose-700 text-sm">{formatNPR(estInterestPortion)}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Principal portion</span>
                      <span className="font-mono font-bold text-emerald-700 text-sm">{formatNPR(estPrincipalPortion)}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">New outstanding</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">{formatNPR(liveBreakdown?.newOutstandingPrincipal ?? Math.max(0, selectedLoan.outstandingPrincipal - estPrincipalPortion))}</span>
                    </div>
                  </div>
                )}

                {/* Cash Denomination Breakdown (collapsible) */}
                {paymentMode === 'CASH' && (
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Banknote className="w-4 h-4 text-slate-600" />
                        Cash Denomination Breakdown
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const denom = { 1000: 0, 500: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 };
                            const amt = parseFloat(repayAmount) || 0;
                            let remaining = amt;
                            for (const note of [1000, 500, 100, 50, 20, 10, 5, 2, 1]) {
                              denom[note] = Math.floor(remaining / note);
                              remaining %= note;
                            }
                            setCashDenomState(denom);
                          }}
                          className="text-[11px] px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg font-semibold transition cursor-pointer"
                        >
                          Exact Match
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashDenomState({ 1000: 0, 500: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 })}
                          className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg font-semibold transition cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2.5">
                      {[1000, 500, 100, 50, 20].map(note => (
                        <div key={note} className="space-y-1">
                          <div className="text-[11px] text-slate-500 flex justify-between">
                            <span>₹ {note}</span>
                            <span className="font-mono">= ₹{((cashDenomState?.[note] || 0) * note).toLocaleString()}</span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={cashDenomState?.[note] || 0}
                            onChange={(e) => setCashDenomState(prev => ({ ...prev, [note]: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-900 focus:border-emerald-600 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 gap-2.5">
                      {[10, 5, 2, 1].map(note => (
                        <div key={note} className="space-y-1">
                          <div className="text-[11px] text-slate-500 flex justify-between">
                            <span>₹ {note}</span>
                            <span className="font-mono">= ₹{((cashDenomState?.[note] || 0) * note).toLocaleString()}</span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={cashDenomState?.[note] || 0}
                            onChange={(e) => setCashDenomState(prev => ({ ...prev, [note]: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-900 focus:border-emerald-600 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                    {cashDenomState && Object.values(cashDenomState).some(v => v > 0) && (
                      <div className="flex justify-between text-xs pt-2 border-t border-slate-200">
                        <span className="text-slate-500">Total cash counted</span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatNPR(Object.entries(cashDenomState).reduce((sum, [note, count]) => sum + Number(note) * (Number(count) || 0), 0))}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Non-CASH: show RepaymentPaymentDetails for cheque/savings */}
                {paymentMode !== 'CASH' && (
                  <RepaymentPaymentDetails
                    paymentMode={paymentMode}
                    selectedMemberId={selectedLoan?.memberId}
                    selectedMemberName={selectedLoan?.memberName}
                    totalAmountRequired={parseFloat(repayAmount) || selectedLoan?.monthlyEMI || 0}
                    memberSavingsAccounts={savingsAccounts}
                    onCashChange={setCashState}
                    onChequeChange={setChequeState}
                    onSavingsAutoDebitChange={setSavingsDebitState}
                    onValidationChange={(valid, err) => {
                      setPaymentSectionValid(valid);
                      setPaymentSectionError(err || '');
                    }}
                  />
                )}

                {/* Remarks */}
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-bold text-xs">Transaction Remarks / Voucher Note</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Monthly installment for Ashadh 2083"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 text-xs shadow-2xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>

              </div>
            </ExpandableFormCard>
          </div>

          {/* Active Loan Summary Card (Clean White Styling) */}
          <div className="lg:col-span-5 space-y-4">
            {selectedLoan ? (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
                
                {/* Header Info */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Active Loan Account Card</span>
                    <h3 className="font-mono font-extrabold text-emerald-700 text-base">{selectedLoan.loanNo}</h3>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${ selectedLoan.nplStatus === 'Pass' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200' }`}>
                    {selectedLoan.nplStatus} • {selectedLoan.daysOverdue} days overdue
                  </span>
                </div>

                {/* Borrower Info & Progress */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Borrower Member:</span>
                      <span className="font-bold text-slate-900 text-sm">{selectedLoan.memberName}</span>
                    </div>
                    <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-slate-200 font-semibold text-slate-700">
                      {selectedLoan.memberNo}
                    </span>
                  </div>

                  {/* Principal Repayment Progress Bar */}
                  {(() => {
                    const orig = selectedLoan.approvedAmount || (selectedLoan.outstandingPrincipal * 1.25);
                    const paid = Math.max(0, orig - selectedLoan.outstandingPrincipal);
                    const pct = Math.min(100, Math.round((paid / orig) * 100));
                    return (
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[11px] font-medium text-slate-600">
                          <span>Principal Repayment Progress</span>
                          <span className="font-bold text-emerald-700">{pct}% Repaid</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-600 rounded-full transition-all duration-300" 
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Outstanding Principal:</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">{formatNPR(selectedLoan.outstandingPrincipal)}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Monthly EMI Amount:</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">{formatNPR(selectedLoan.monthlyEMI)}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Interest Rate & Type:</span>
                    <span className="font-bold text-slate-800">{selectedLoan.interestRate}% ({selectedLoan.interestMethod})</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Loan Product Type:</span>
                    <span className="font-semibold text-slate-800 capitalize">{selectedLoan.productType} Loan</span>
                  </div>
                </div>

                {/* Pledged Collateral Info Card */}
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-[11px] space-y-1">
                  <div className="flex items-center justify-between font-bold text-emerald-950">
                    <span className="flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-emerald-700" />
                      Pledged Collateral Asset:
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-mono">
                      LTV: {Math.round((selectedLoan.outstandingPrincipal / selectedLoan.collateralValuation) * 100)}%
                    </span>
                  </div>
                  <div className="font-semibold text-slate-800">{selectedLoan.collateralType}</div>
                  <div className="text-slate-600">Assessed Market Valuation: <span className="font-bold text-emerald-700">{formatNPR(selectedLoan.collateralValuation)}</span></div>
                </div>

                {/* Quick Actions */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      const mSavings = (savingsAccounts || []).find(s => s && s.memberId === selectedLoan.memberId);
                      if (mSavings) {
                        setSelectedAccountForPassbook(mSavings);
                        openTab('passbook', 'Loan Passbook Ledger', 'FileText');
                      } else {
                        alert(`No active savings account linked for member ${selectedLoan.memberName}`);
                      }
                    }}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg transition cursor-pointer border border-slate-300 text-[11px] flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-600" />
                    <span>View Passbook</span>
                  </button>

                  <button
                    onClick={() => alert(`Printing Loan Statement for ${selectedLoan.loanNo}`)}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg transition cursor-pointer border border-slate-300 text-[11px] flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>Print Statement</span>
                  </button>
                </div>

              </div>
            ) : (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
                No active loan account selected.
              </div>
            )}
          </div>

        </div>
      )}

      {/* ----------------- TAB 2: CREDIT APPRAISAL WIZARD ----------------- */}
      {activeSubTab === 'appraisal' && (
        <div className="max-w-4xl mx-auto space-y-5">
          <ExpandableFormCard
            title="Credit Appraisal & Loan Application Wizard"
            subtitle="Evaluates borrower repayment capacity, LTV collateral ratio, and routes to Manager approval queue"
            icon={<Landmark className="w-5 h-5 text-emerald-600" />}
            badge={
              <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md font-bold">
                Standard Rate: {productRate}% p.a.
              </span>
            }
            onSubmit={handleCreateApplication}
            footerActions={
              <div className="w-full flex items-center justify-between gap-4 text-xs">
                <div className="text-slate-600">
                  Calculated Monthly EMI: <span className="text-emerald-700 font-mono font-bold text-sm">{formatNPR(calculatedEmi)}</span> for <span className="font-bold text-slate-900">{tenureMonths} months</span>
                </div>
              </div>
            }
          >
            <div className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Borrower Selector */}
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-bold text-xs">Borrower Member *</label>
                  <select
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 text-xs font-semibold shadow-2xs focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">— Select a member —</option>
                    {safeMembers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.memberNo}) — {m.district}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Loan Product */}
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-bold text-xs">Loan Product *</label>
                  <select
                    value={loanProductId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setLoanProductId(id);
                      const product = loanProducts.find((p) => p.id === id);
                      if (product) setProductType((product.productType as any) || 'general');
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 text-xs font-semibold shadow-2xs focus:border-emerald-600 focus:outline-none"
                  >
                    {loanProducts.length === 0 && <option value="">No loan products configured — add them in Settings</option>}
                    {loanProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.interestRate}%)
                      </option>
                    ))}
                  </select>
                  {loanProducts.length === 0 && (
                    <p className="text-[10px] text-amber-600 font-medium">Loan products must be configured under Settings &gt; Loan Settings before applying.</p>
                  )}
                </div>

                {/* Requested Amount */}
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-bold text-xs">Requested Loan Amount (NPR) *</label>
                  <input
                    type="number"
                    required
                    min="10000"
                    step="5000"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono font-bold text-sm shadow-2xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {/* Tenure */}
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-bold text-xs">Loan Tenure (Months) *</label>
                  <input
                    type="number"
                    required
                    min="3"
                    max="120"
                    value={tenureMonths}
                    onChange={(e) => setTenureMonths(parseInt(e.target.value, 10) || 12)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono text-xs font-semibold shadow-2xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {/* Collateral Type */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-slate-700 font-bold text-xs">Pledged Collateral Description & Asset Type *</label>
                  <input
                    type="text"
                    required
                    value={collateralType}
                    onChange={(e) => setCollateralType(e.target.value)}
                    placeholder="e.g. Land Kitta No. 402, Kathmandu Ward 27 / Commercial Goods Stock"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 text-xs shadow-2xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {/* Valuation & Guarantor */}
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-bold text-xs">Assessed Collateral Market Valuation (NPR) *</label>
                  <input
                    type="number"
                    required
                    min="10000"
                    value={collateralValuation}
                    onChange={(e) => setCollateralValuation(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono font-bold text-xs shadow-2xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-bold text-xs">Guarantor Member Name *</label>
                  <input
                    type="text"
                    required
                    value={guarantorName}
                    onChange={(e) => setGuarantorName(e.target.value)}
                    placeholder="Member Name who signs as guarantor"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 text-xs shadow-2xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>

              </div>

              {/* Realtime Appraisal Metrics Panel */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Real-time Risk Appraisal & Loan-to-Value (LTV) Ratio</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">LTV Collateral Coverage:</span>
                    <span className={`font-mono font-bold text-sm ${ltvRatio <= 60 ? 'text-emerald-700' : ltvRatio <= 80 ? 'text-amber-700' : 'text-rose-700'}`}>
                      {ltvRatio}% LTV Ratio
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Max allowed limit: 80%</span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Monthly EMI Repayment:</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">{formatNPR(calculatedEmi)}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">For {tenureMonths} consecutive months</span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Appraisal Risk Grade:</span>
                    <span className={`font-bold text-sm ${ltvRatio <= 60 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {ltvRatio <= 60 ? 'LOW RISK (Grade A)' : 'MEDIUM RISK (Grade B)'}
                    </span>
                    <span className="text-[10px] text-emerald-700 block mt-0.5">Eligible for instant approval</span>
                  </div>
                </div>
              </div>

              {/* Eligibility Gate Panel */}
              <div className={`p-4 rounded-xl border space-y-3 ${eligibility && !eligibility.eligible ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <BadgeCheck className={`w-4 h-4 ${eligibility && !eligibility.eligible ? 'text-rose-600' : 'text-emerald-600'}`} />
                  <span>Eligibility Gate</span>
                </h4>

                {eligibilityLoading && (
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    Checking member eligibility against this product...
                  </p>
                )}

                {eligibilityError && !eligibility && (
                  <p className="text-xs text-rose-600 font-medium">{eligibilityError}</p>
                )}

                {eligibility && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {eligibility.checks.map((c) => (
                        <div key={c.key} className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                          {c.ok
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            : <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                          <div>
                            <span className="font-bold text-slate-800 block">{c.label}</span>
                            <span className="text-[10px] text-slate-500 block">{c.ok ? c.actual : `${c.required} (Current: ${c.actual})`}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className={`font-bold ${eligibility.eligible ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {eligibility.eligible
                          ? '✓ Member meets all eligibility criteria.'
                          : `${eligibility.reasons.length} requirement(s) not met.`}
                      </span>
                      {!eligibility.eligible && eligibility.allowOverride && (
                        <span className="text-[10px] text-amber-700 font-semibold">
                          Override available for org admins & managers
                        </span>
                      )}
                    </div>

                    {!eligibility.eligible && eligibility.allowOverride && canOverride && (
                      <div className="space-y-1.5">
                        <label className="text-slate-700 font-bold text-xs">Override Reason (required, min 5 characters) *</label>
                        <textarea
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          rows={2}
                          placeholder="e.g. Long-standing member with 6 years of loan discipline; temporary KYC expiry under re-verification."
                          className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 text-xs shadow-2xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>
          </ExpandableFormCard>

          {/* ═══════════ SECTION ②: COLLATERAL & GUARANTOR ═══════════ */}
          <ExpandableFormCard
            title="Collateral & Guarantor Details"
            subtitle="Property security and guarantor information for the loan application"
            icon={<Shield className="w-5 h-5 text-amber-600" />}
            badge={
              enhancedCollaterals.length > 0
                ? <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-md font-bold">{enhancedCollaterals.length} asset(s)</span>
                : undefined
            }
          >
            <CollateralSection
              loanApplicationId={null}
              requestedAmount={numAmt}
              onCollateralsChange={(c) => {
                setEnhancedCollaterals(c);
                setEnhancedCollateralValue(c.reduce((sum, item) => sum + (item.assessedValuation || 0), 0));
              }}
            />
            <div className="border-t border-slate-200 my-4" />
            <GuarantorSection
              loanApplicationId={null}
              guarantors={enhancedGuarantors}
              onGuarantorsChange={setEnhancedGuarantors}
              members={safeMembers}
            />
          </ExpandableFormCard>

          {/* ═══════════ SECTION ③: DOCUMENT UPLOAD CHECKLIST ═══════════ */}
          <ExpandableFormCard
            title="Document Upload & Verification"
            subtitle="Required documents checklist — upload all before submission"
            icon={<FileCheck className="w-5 h-5 text-sky-600" />}
            badge={
              <span className={`text-xs border px-2.5 py-1 rounded-md font-bold ${
                enhancedDocCount >= 10
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {enhancedDocCount}/10 uploaded
              </span>
            }
          >
            <DocumentChecklist
              loanApplicationId={null}
              onDocumentCountChange={setEnhancedDocCount}
            />
          </ExpandableFormCard>

          {/* ═══════════ SECTION ④: RISK & APPROVAL GATE ═══════════ */}
          <ExpandableFormCard
            title="Risk Assessment & Approval Gate"
            subtitle="CIB check, exposure analysis, and submission validation"
            icon={<Award className="w-5 h-5 text-rose-600" />}
          >
            <RiskApprovalPanel
              loanApplicationId={null}
              requestedAmount={numAmt}
              collateralValue={enhancedCollateralValue || colVal}
              interestRate={productRate}
              tenureMonths={tenureMonths}
              calculatedEmi={calculatedEmi}
              onValidationChange={setEnhancedValidation}
            />
          </ExpandableFormCard>

          {/* ═══════════ SECTION ⑤: LEGAL DOCUMENTS ═══════════ */}
          <ExpandableFormCard
            title="Legal Document Generation"
            subtitle="Auto-generate ऋण माग फारम, सम्झौता फारम, and तमसुक फारम"
            icon={<Landmark className="w-5 h-5 text-violet-600" />}
          >
            <LegalDocumentPanel
              loanApplicationId={null}
              borrowerName={safeMembers.find(m => m.id === memberId)?.fullName || ''}
              borrowerAddress={safeMembers.find(m => m.id === memberId)?.district || ''}
              borrowerCitizenshipNo={(safeMembers.find(m => m.id === memberId) as any)?.citizenshipNo || ''}
              borrowerMemberNo={(safeMembers.find(m => m.id === memberId) as any)?.memberNo || ''}
              fatherOrHusbandName={(safeMembers.find(m => m.id === memberId) as any)?.fatherName || ''}
              borrowerAge={(safeMembers.find(m => m.id === memberId) as any)?.age || ''}
              borrowerTole={(safeMembers.find(m => m.id === memberId) as any)?.tole || ''}
              borrowerWardNo={(safeMembers.find(m => m.id === memberId) as any)?.wardNo || ''}
              borrowerMunicipality={(safeMembers.find(m => m.id === memberId) as any)?.municipality || ''}
              borrowerDistrict={(safeMembers.find(m => m.id === memberId) as any)?.district || ''}
              guarantorName={enhancedGuarantors[0]?.fullName || guarantorName}
              guarantorAddress={enhancedGuarantors[0]?.address || ''}
              guarantor1Citizenship={enhancedGuarantors[0]?.citizenshipNo || ''}
              guarantor1Relationship={enhancedGuarantors[0]?.relationshipToBorrower || ''}
              guarantor2Name={enhancedGuarantors[1]?.fullName || ''}
              guarantor2Citizenship={enhancedGuarantors[1]?.citizenshipNo || ''}
              guarantor2Relationship={enhancedGuarantors[1]?.relationshipToBorrower || ''}
              guarantors={enhancedGuarantors.map(g => ({
                fullName: g.fullName,
                address: g.address,
                citizenshipNo: g.citizenshipNo,
                relationship: g.relationshipToBorrower,
              }))}
              requestedAmount={numAmt}
              interestRate={productRate}
              loanProductName={selectedProduct?.name || ''}
              purposeDetail="सामान्य ऋण"
              repaymentFrequency="मासिक"
              emiAmount={calculatedEmi}
              collateralDescription={enhancedCollaterals[0]?.collateralType || collateralType}
              collateralValuation={enhancedCollateralValue || parseFloat(collateralValuation) || 0}
              collateralKittaNo={enhancedCollaterals[0]?.kittaNo || ''}
              collateralAreaDetail={enhancedCollaterals[0]?.areaDetail || ''}
              collateralBuildingDetail={enhancedCollaterals[0]?.buildingDetail || ''}
              collateralLandOfficeName={enhancedCollaterals[0]?.landOfficeName || ''}
              collateralBoundaryEast={enhancedCollaterals[0]?.boundaryEast || ''}
              collateralBoundaryWest={enhancedCollaterals[0]?.boundaryWest || ''}
              collateralBoundaryNorth={enhancedCollaterals[0]?.boundaryNorth || ''}
              collateralBoundarySouth={enhancedCollaterals[0]?.boundarySouth || ''}
              collateralDistrict={enhancedCollaterals[0]?.district || ''}
              collateralMunicipality={enhancedCollaterals[0]?.municipality || ''}
              collateralWardNo={enhancedCollaterals[0]?.wardNo || ''}
              collateralTole=""
              valuerName={enhancedCollaterals[0]?.valuationDoneBy || ''}
              valuationDateBs={enhancedCollaterals[0]?.valuationDateBs || getTodayBS()}
              cooperativeName={authUser?.organizationName || 'सहकारी संस्था'}
              registrationNo="000000"
              province={activeBranch?.province || 'बागमती'}
              district={activeBranch?.district || 'काठमाडौं'}
              municipality={activeBranch?.municipality || 'काठमाडौं महानगरपालिका'}
              wardNo={activeBranch?.ward || '01'}
              branchName={activeBranch?.name || 'मुख्य शाखा'}
              branchAddress={activeBranch?.address || 'काठमाडौं, नेपाल'}
              place={activeBranch?.district || 'काठमाडौं'}
              witness1Name=""
              witness2Name=""
              scribeStaffName=""
              scribeDesignation=""
            />
          </ExpandableFormCard>

          {/* ═══════════ SUBMIT BUTTON (LAST POSITION) ═══════════ */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-600">
                <span className="font-semibold">Ready to submit?</span> Ensure all required fields are filled and documents uploaded.
              </div>
              <button
                type="button"
                disabled={
                  applying ||
                  !memberId ||
                  !loanProductId ||
                  numAmt <= 0 ||
                  tenureMonths < 3 ||
                  !collateralType ||
                  parseFloat(collateralValuation) < 10000 ||
                  !guarantorName ||
                  (eligibility !== null && !eligibility.eligible && !(eligibility.allowOverride && overrideReason.trim().length > 4 && canOverride))
                }
                onClick={handleCreateApplication}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition cursor-pointer shadow-md text-sm flex items-center justify-center gap-2"
              >
                {applying ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{applying ? 'Submitting...' : 'Submit to Manager Approval Queue'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB 3: ACTIVE LOANS PORTFOLIO ----------------- */}
      {activeSubTab === 'portfolio' && (
        <div className="space-y-4">
          
          {/* Controls & Search Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search borrower or loan no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <span className="text-slate-500 font-semibold shrink-0">Filter Status:</span>
              {['ALL', 'Approved', 'Disbursed', 'Pass', 'Watchlist', 'Substandard', 'Loss'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg border transition font-bold shrink-0 ${ statusFilter === st ? 'bg-white text-slate-800 border-slate-200' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100' }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLoans.map(l => (
              <div key={l.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition space-y-3 text-xs">
                
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="font-mono font-bold text-emerald-700 text-sm">{l.loanNo}</span>
                    <span className="text-[10px] text-slate-500 block font-semibold capitalize">{l.productType} Loan</span>
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${ l.nplStatus === 'Pass' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200' }`}>
                    {l.nplStatus}
                  </span>
                </div>

                <div className="space-y-2 text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Borrower Name:</span>
                    <span className="font-bold text-slate-900">{l.memberName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Member No:</span>
                    <span className="font-mono text-slate-800">{l.memberNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Interest Rate:</span>
                    <span className="font-semibold text-slate-800">{l.interestRate}% ({l.interestMethod})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Monthly EMI:</span>
                    <span className="font-mono font-bold text-emerald-700">{formatNPR(l.monthlyEMI)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-2">
                    <span className="text-slate-600 font-semibold">Outstanding Principal:</span>
                    <span className="font-mono font-extrabold text-slate-900 text-sm">{formatNPR(l.outstandingPrincipal)}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Disbursed: {l.disbursedDateBS} BS</span>
                  
                  {l.status === 'Approved' ? (
                    <button
                      onClick={() => {
                        setDisburseModalLoan(l);
                        setDisbursePaymentMethod('cash');
                        setDisburseBankAccountId('');
                        setDisburseSavingsAccountId('');
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs transition cursor-pointer font-bold shadow-2xs flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Disburse</span>
                    </button>
                  ) : l.status === 'Disbursed' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          openTab('loan_detail', `Loan - ${l.loanNo}`, 'Landmark', l.id);
                        }}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => {
                          setSelectedLoanId(l.id);
                          setActiveSubTab('repayment');
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-emerald-700 border border-emerald-300 rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        Pay EMI
                      </button>
                      <button
                        onClick={() => {
                          setWriteOffLoan(l);
                          setWriteOffModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        Request Write-Off
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          openTab('loan_detail', `Loan - ${l.loanNo}`, 'Landmark', l.id);
                        }}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => {
                          setSelectedLoanId(l.id);
                          setActiveSubTab('repayment');
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-emerald-700 border border-emerald-300 rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        Pay EMI
                      </button>
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {/* ----------------- TAB 4: NPL & PROVISIONING MATRIX ----------------- */}
      {activeSubTab === 'npl_provisioning' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Department of Cooperatives Regulatory NPL & Loss Provisioning Matrix</h2>
              <p className="text-slate-500">Enforces statutory risk classification based on overdue days and mandatory reserve allocations</p>
            </div>
            <span className="bg-slate-100 text-slate-800 text-xs px-3 py-1 rounded-lg border border-slate-300 font-bold self-start sm:self-auto">
              Directive No. 2079 Compliant
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold text-[11px] uppercase">
                <tr>
                  <th className="p-3">Loan Account No</th>
                  <th className="p-3">Borrower Name</th>
                  <th className="p-3">Overdue Days</th>
                  <th className="p-3">NPL Category</th>
                  <th className="p-3 text-right">Outstanding Principal</th>
                  <th className="p-3 text-right">Mandatory Provision %</th>
                  <th className="p-3 text-right">Provision Amount (NPR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                {safeLoanAccounts.map(l => {
                  let rateStr = '1%';
                  if (l.nplStatus === 'Watchlist') rateStr = '5%';
                  if (l.nplStatus === 'Substandard') rateStr = '25%';
                  if (l.nplStatus === 'Doubtful') rateStr = '50%';
                  if (l.nplStatus === 'Loss') rateStr = '100%';

                  return (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono font-bold text-emerald-700">{l.loanNo}</td>
                      <td className="p-3 font-bold text-slate-900">{l.memberName}</td>
                      <td className="p-3 font-mono text-slate-700">{l.daysOverdue} days</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${ l.nplStatus === 'Pass' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200' }`}>
                          {l.nplStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-900 font-bold">{formatNPR(l.outstandingPrincipal)}</td>
                      <td className="p-3 text-right font-bold text-amber-700">{rateStr}</td>
                      <td className="p-3 text-right font-mono font-bold text-rose-700">{formatNPR(l.provisionAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------- TAB 5: EMI AMORTIZATION SIMULATOR ----------------- */}
      {activeSubTab === 'amortization' && (
        <div className="space-y-4">
          {/* Loan Account Selector + Print Button */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-end gap-4 print-hide">
            <div className="flex-1 min-w-[280px] relative" ref={loanSearchRef}>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Search Active Loan Account
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={loanSearchQuery}
                  onChange={(e) => {
                    setLoanSearchQuery(e.target.value);
                    setSelectedSimLoanId('');
                    setLoanSearchOpen(true);
                  }}
                  onFocus={() => { if (loanSearchQuery && !selectedSimLoanId) setLoanSearchOpen(true); }}
                  placeholder={activeLoanLoading ? 'Loading active loans...' : 'Type loan no, member name, or member no...'}
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                />
                {selectedSimLoanId && (
                  <button
                    onClick={() => {
                      setSelectedSimLoanId('');
                      setLoanSearchQuery('');
                      setLoanSearchOpen(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full cursor-pointer"
                    title="Clear selection"
                  >
                    <X className="w-3 h-3 text-slate-500" />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {loanSearchOpen && filteredLoanResults.length > 0 && (
                <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-[250px] overflow-y-auto">
                  {filteredLoanResults.map((loan: any) => (
                    <button
                      key={loan.id}
                      onClick={() => handleSimLoanSelect(loan.id)}
                      className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-mono font-bold text-emerald-700">{loan.loanNo}</span>
                          <span className="text-xs text-slate-900 font-semibold ml-2">{loan.memberName}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{loan.memberNo}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                        <span>{loan.productName}</span>
                        <span className="font-mono font-bold text-slate-700">{formatNPR(Number(loan.outstandingPrincipal) || Number(loan.approvedAmount))}</span>
                        <span>{loan.tenureMonths}mo @ {Number(loan.interestRate)}%</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {loanSearchOpen && loanSearchQuery.trim() && !selectedSimLoanId && filteredLoanResults.length === 0 && (
                <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-center text-xs text-slate-500">
                  No active loans found matching "{loanSearchQuery}"
                </div>
              )}
            </div>
            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm flex items-center gap-2 print-hide"
            >
              <Printer className="w-4 h-4" />
              Print Schedule for Member
            </button>
          </div>

          {/* Print Wrapper */}
          <div id="printable-amortization-schedule">
            {/* Print Header (hidden on screen, visible in print) */}
            <div className="print-header hidden">
              <h2 className="text-xl font-bold text-emerald-900">Co-operative Loan Amortization Schedule</h2>
              <p className="text-xs text-slate-500">Generated on: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              {selectedSimLoanId && (() => {
                const loan = activeLoanOptions.find((l: any) => l.id === selectedSimLoanId);
                return loan ? (
                  <div className="mt-1 text-[11px] text-slate-600">
                    <span className="font-bold">Loan: {loan.loanNo}</span> | Member: {loan.memberName} ({loan.memberNo}) | Product: {loan.productName}
                  </div>
                ) : null;
              })()}
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Controls Panel */}
            <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs print-hide">
              <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-600" />
                <span>EMI Loan Amortization Simulator</span>
              </h3>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>Loan Amount (NPR):</span>
                    <span className="font-mono text-emerald-700">{formatNPR(calcAmount)}</span>
                  </div>
                  <input
                    type="range"
                    min="50000"
                    max="5000000"
                    step="25000"
                    value={calcAmount}
                    onChange={(e) => setCalcAmount(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>Annual Interest Rate (% p.a.):</span>
                    <span className="font-mono text-amber-700">{calcRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="24"
                    step="0.5"
                    value={calcRate}
                    onChange={(e) => setCalcRate(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>Loan Tenure (Months):</span>
                    <span className="font-mono text-slate-900">{calcTenure} Months</span>
                  </div>
                  <input
                    type="range"
                    min="6"
                    max="120"
                    step="6"
                    value={calcTenure}
                    onChange={(e) => setCalcTenure(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center space-y-1">
                <span className="text-[10px] text-emerald-800 font-semibold uppercase block">Monthly EMI Installment</span>
                <div className="text-2xl font-mono font-extrabold text-emerald-700">{formatNPR(calcResult.emi)}</div>
                <span className="text-[10px] text-slate-500 block">Total Interest over tenure: {formatNPR((calcResult.emi * calcTenure) - calcAmount)}</span>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                  <span className="text-[9px] text-slate-500 uppercase font-bold block">Total Payment</span>
                  <span className="text-xs font-mono font-bold text-slate-900">{formatNPR(calcResult.emi * calcTenure)}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                  <span className="text-[9px] text-slate-500 uppercase font-bold block">Interest / Principal</span>
                  <span className="text-xs font-mono font-bold text-amber-700">
                    {calcAmount > 0 ? ((calcResult.emi * calcTenure - calcAmount) / calcAmount * 100).toFixed(1) : '0'}%
                  </span>
                </div>
              </div>
            </div>

            {/* Table Preview Panel */}
            <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
              <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2 print-hide">
                Monthly Amortization Payment Schedule
                {selectedSimLoanId && (
                  <span className="ml-2 text-[10px] font-normal text-emerald-600">(Full Tenure: {calcTenure} Months)</span>
                )}
              </h3>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-[480px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold text-[11px] uppercase sticky top-0">
                    <tr>
                      <th className="p-2.5">Month</th>
                      <th className="p-2.5 text-right">EMI Payable</th>
                      <th className="p-2.5 text-right">Principal Paid</th>
                      <th className="p-2.5 text-right">Interest Paid</th>
                      <th className="p-2.5 text-right">Remaining Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800 font-mono">
                    {calcResult.schedule.map(row => (
                      <tr key={row.month} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">Month #{row.month}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-700">{formatNPR(row.emi)}</td>
                        <td className="p-2.5 text-right text-slate-800">{formatNPR(row.principal)}</td>
                        <td className="p-2.5 text-right text-amber-700">{formatNPR(row.interest)}</td>
                        <td className="p-2.5 text-right text-slate-900 font-semibold">{formatNPR(row.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Print Summary (hidden on screen, visible in print) */}
              <div className="hidden" style={{ display: 'none' }}>
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t-2 border-slate-200">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                    <span className="text-[9px] text-emerald-700 uppercase font-bold block">Principal Amount</span>
                    <span className="text-sm font-mono font-extrabold text-emerald-800">{formatNPR(calcAmount)}</span>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                    <span className="text-[9px] text-amber-700 uppercase font-bold block">Total Interest</span>
                    <span className="text-sm font-mono font-extrabold text-amber-800">{formatNPR((calcResult.emi * calcTenure) - calcAmount)}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <span className="text-[9px] text-slate-500 uppercase font-bold block">Total Payable</span>
                    <span className="text-sm font-mono font-extrabold text-slate-800">{formatNPR(calcResult.emi * calcTenure)}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 text-center text-[9px] text-slate-400">
                  This schedule is generated by the Co-operative Management System for informational purposes. Actual amounts may vary.
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Eligibility Override Modal */}
      {overrideModalOpen && eligibility && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">Credit-Committee Eligibility Override</h3>
              </div>
              <button type="button" onClick={() => setOverrideModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 space-y-1">
                <span className="font-bold block">The backend rejected this application:</span>
                {(gateReasons.length > 0 ? gateReasons : eligibility.reasons).map((r, i) => (
                  <span key={i} className="block">• {r}</span>
                ))}
              </div>

              {!canOverride ? (
                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  Only org admins & managers may override the eligibility gate. Contact a credit-committee member to approve this exception.
                </p>
              ) : !eligibility.allowOverride ? (
                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  This loan product does not allow eligibility overrides. The application cannot be submitted for this member.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-bold text-xs">Override Reason (required) *</label>
                    <textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      rows={3}
                      placeholder="Document the exception — e.g. longstanding member, documented repayment track record, compensating collateral."
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 text-xs shadow-2xs focus:border-amber-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500">This reason is stored on the loan account and appears in the audit trail.</p>
                  </div>

                  <button
                    type="button"
                    disabled={applying || !memberId || !loanProductId || numAmt <= 0 || overrideReason.trim().length <= 4}
                    onClick={async () => {
                      setApplying(true);
                      try {
                        const result = await applyForLoan({
                          memberId,
                          productType,
                          loanProductId,
                          appliedAmount: numAmt,
                          tenureMonths,
                          branchId: activeBranchId,
                          overrideReason: overrideReason.trim(),
                        });
                        if (result.success) {
                          await reloadMasterData();
                          setOverrideModalOpen(false);
                          alert('Loan Application submitted with Credit-Committee override!');
                          setActiveSubTab('portfolio');
                        } else {
                          alert(result.error || 'Loan application failed.');
                        }
                      } finally {
                        setApplying(false);
                      }
                    }}
                    className="w-full px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition cursor-pointer shadow-md text-xs flex items-center justify-center gap-2"
                  >
                    {applying ? <Clock className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    <span>{applying ? 'Submitting...' : 'Submit Application with Override'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>

    {repaymentResult && (
      <RepaymentVoucherModal
        result={repaymentResult}
        onClose={() => setRepaymentResult(null)}
      />
    )}

    {disbursementResult && (
      <DisbursementVoucherModal
        result={disbursementResult}
        onClose={() => setDisbursementResult(null)}
      />
    )}

    <LoanWriteOffModal
      open={writeOffModalOpen}
      loan={writeOffLoan}
      onClose={() => {
        setWriteOffModalOpen(false);
        setWriteOffLoan(null);
      }}
      onSuccess={() => {
        reloadMasterData?.();
      }}
    />

    {disburseModalLoan && (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDisburseModalLoan(null)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">Disburse Loan</h3>
            <button onClick={() => setDisburseModalLoan(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 mb-4">
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <div className="font-bold text-slate-900">{disburseModalLoan.loanNo}</div>
              <div className="text-slate-600">{disburseModalLoan.memberName} ({disburseModalLoan.memberNo})</div>
              <div className="font-mono font-bold text-emerald-700 mt-1">{formatNPR(disburseModalLoan.approvedAmount)}</div>
            </div>

            <PaymentMethodSelector
              bankAccountId={disburseBankAccountId}
              amount={disburseModalLoan.approvedAmount}
              suggestedPayeeName={disburseModalLoan.memberName}
              allowedMethods={['cash', 'savings_transfer', 'cheque_bank']}
              onChange={({ method, chequeData, isValid }) => {
                setDisbursePaymentMethod(method);
                setDisburseChequeData(chequeData);
                setDisbursePaymentValid(isValid);
              }}
            />

            {disbursePaymentMethod === 'cheque_bank' && (
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1 block">Bank Account *</label>
                {bankAccountsLoading ? (
                  <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    Loading bank accounts...
                  </div>
                ) : bankAccounts.length === 0 ? (
                  <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    No bank accounts found. Please add a bank account under Setup → Accounting Settings → Bank Accounts first.
                  </div>
                ) : (
                  <select
                    value={disburseBankAccountId}
                    onChange={(e) => setDisburseBankAccountId(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-semibold focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  >
                    <option value="">-- Select bank account --</option>
                    {bankAccounts.map((a: any) => (
                      <option key={a.id} value={a.glAccountId || a.id}>
                        {a.bankName} — {a.accountName} ({a.accountNumber})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {disbursePaymentMethod === 'savings_transfer' && (
              <div>
                <label className="text-sm font-bold text-slate-700 mb-1 block">Member Savings Account *</label>
                {memberSavingsForDisburse.length === 0 ? (
                  <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    No active savings account found for {disburseModalLoan.memberName}. Open a savings account first.
                  </div>
                ) : (
                  <select
                    value={disburseSavingsAccountId}
                    onChange={(e) => setDisburseSavingsAccountId(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-semibold focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  >
                    <option value="">-- Select savings account --</option>
                    {memberSavingsForDisburse.map((s: any) => (
                      <option key={s.id || s.accountId} value={s.accountId || s.id}>
                        {s.accountNo || s.accountNumber || s.accountId} — Balance: {formatNPR(s.balance || 0)}
                      </option>
                    ))}
                  </select>
                )}
                {disburseSavingsAccountId && (() => {
                  const sel = memberSavingsForDisburse.find((s: any) => (s.accountId || s.id) === disburseSavingsAccountId);
                  return sel ? (
                    <div className="mt-1.5 text-[10px] text-slate-500">
                      Available balance: <strong className="text-emerald-700">{formatNPR(sel.balance || 0)}</strong>
                      {(sel.balance || 0) < disburseModalLoan.approvedAmount && (
                        <span className="text-red-600 ml-2">Insufficient balance for this disbursement</span>
                      )}
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setDisburseModalLoan(null)}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition cursor-pointer border border-slate-300"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (disbursePaymentMethod === 'cheque_bank' && !disburseBankAccountId) {
                  alert('Please select a bank account.');
                  return;
                }
                if (disbursePaymentMethod === 'cheque_bank' && !disbursePaymentValid) {
                  alert('Please complete all cheque payment details.');
                  return;
                }
                if (disbursePaymentMethod === 'savings_transfer' && !disburseSavingsAccountId) {
                  alert('Please select a savings account.');
                  return;
                }
                if (disbursePaymentMethod === 'savings_transfer') {
                  const savAcc = memberSavingsForDisburse.find((s: any) => (s.accountId || s.id) === disburseSavingsAccountId);
                  if (savAcc && (savAcc.balance || 0) < disburseModalLoan.approvedAmount) {
                    alert('Insufficient savings balance for this disbursement.');
                    return;
                  }
                }

                const isCheque = disbursePaymentMethod === 'cheque_bank';
                const isSavings = disbursePaymentMethod === 'savings_transfer';

                const result = await disburseLoan(
                  disburseModalLoan.id,
                  `${isSavings ? 'Savings Transfer' : isCheque ? 'Bank' : 'Cash'} disbursement`,
                  isCheque ? disburseBankAccountId : isSavings ? disburseSavingsAccountId : undefined,
                  isCheque || isSavings ? 'Bank' : 'Cash',
                  isCheque && disburseChequeData ? disburseChequeData.chequeLeafId : undefined,
                  isSavings ? 'SAVINGS_TRANSFER' : isCheque && disburseChequeData ? 'CHEQUE' : 'CASH',
                  isCheque && disburseChequeData ? disburseChequeData.chequeNumber : isSavings ? `SAVINGS:${disburseSavingsAccountId}` : undefined,
                );
                setDisburseModalLoan(null);
                if (result) setDisbursementResult(result);
              }}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition cursor-pointer shadow-sm"
            >
              Confirm Disbursement
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
