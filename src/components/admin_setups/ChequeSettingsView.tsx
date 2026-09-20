import React, { useState, useEffect, useCallback } from 'react';
import {
  Save, RotateCcw, CheckCircle2, AlertTriangle, ShieldCheck, BookOpen,
  Sliders, FileText, ShieldAlert, Ban, Plus, Search, Filter, Loader2,
  ChevronDown, ChevronUp, Check, ArrowRight, RefreshCw, X, AlertCircle, Info
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../../context/ToastContext';
import { useAuthStore } from '../../stores/authStore';
import { invalidateChequeRegister } from '../../lib/queryClient';
import {
  fetchChequeSettings, saveChequeSettings, fetchEligibleProducts,
  fetchChequeBooksList, issueChequeBookApi, updateBookStatusApi,
  fetchChequeLeavesList, fetchStopPaymentsList, createStopPaymentApi,
  approveStopPaymentApi, rejectStopPaymentApi, fetchBounceRegister, recordBounceApi,
  ChequeSettingsData, EligibleProduct, ChequeBookRecord, ChequeLeafRecord,
  StopPaymentRecord, BounceRecord
} from '../../api/chequeSettings';

interface Props {
  onNavigateToProducts?: () => void;
}

export const ChequeSettingsView: React.FC<Props> = ({ onNavigateToProducts }) => {
  const toast = useToast();

  // Active Sub-Tab
  const [activeTab, setActiveTab] = useState<'config' | 'books' | 'leaves' | 'stop_payments' | 'bounces'>('config');

  // Loading & Saving state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reference options
  const [eligibleProducts, setEligibleProducts] = useState<EligibleProduct[]>([]);
  const [coaOptions, setCoaOptions] = useState<{ id: string; code: string; name: string }[]>([]);

  // Configuration Form State
  const [form, setForm] = useState<ChequeSettingsData>({
    scope: 'organization',
    enableChequeFacility: true,
    eligibleAccountProductIds: [],
    defaultLeavesPerBook: 25,
    allowedBookSizes: [10, 20, 25, 50, 100],
    maxActiveBooksPerAccount: 1,
    reissueAllowed: true,
    reissueAfterExhaustion: true,
    lostBookReplacementAllowed: true,
    cancelledBookReplacementAllowed: true,
    numberingScope: 'branch_wise',
    startingChequeNumber: 100001,
    chequePrefix: 'CHQ-',
    numberLength: 6,
    allowManualNumberAssignment: false,
    preventDuplicateChequeNumbers: true,
    validityPeriodDays: 90,
    expiredChequeBehavior: 'reject_presentation',
    stopPaymentEnabled: true,
    allowStopPaymentBy: ['member', 'teller', 'branch_manager', 'admin'],
    stopPaymentCharge: 0,
    allowStopPaymentOn: ['single_cheque', 'cheque_range', 'entire_book'],
    stopPaymentRequireApproval: true,
    bounceHandlingEnabled: true,
    bounceCharge: 0,
    maxBounceCount: null,
    afterThresholdAction: 'flag_account',
    issuanceChargeType: 'flat',
    issuanceChargeAmount: 0,
    issuanceChargePerLeafAmount: 0,
    lostBookCharge: 0,
    replacementBookCharge: 0,
    otherChequeCharges: [],
    taxApplicable: false,
    taxRate: 0,
    glIssuanceFeeAccountId: '',
    glStopPaymentFeeAccountId: '',
    glBounceFeeAccountId: '',
    glReplacementFeeAccountId: '',
    glOtherChargesFeeAccountId: '',
  });

  const [initialForm, setInitialForm] = useState<ChequeSettingsData | null>(null);

  // Operational Data State
  const [chequeBooks, setChequeBooks] = useState<ChequeBookRecord[]>([]);
  const [chequeLeaves, setChequeLeaves] = useState<ChequeLeafRecord[]>([]);
  const [stopPayments, setStopPayments] = useState<StopPaymentRecord[]>([]);
  const [bounces, setBounces] = useState<BounceRecord[]>([]);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals State
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueAccountId, setIssueAccountId] = useState('');
  const [issueLeafCount, setIssueLeafCount] = useState<number>(25);
  const [issuing, setIssuing] = useState(false);
  const [accountsList, setAccountsList] = useState<{ id: string; accountNo: string; memberName: string }[]>([]);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<ChequeBookRecord | null>(null);
  const [targetStatus, setTargetStatus] = useState<'cancelled' | 'lost' | 'replaced'>('cancelled');
  const [statusReason, setStatusReason] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [stopAccountId, setStopAccountId] = useState('');
  const [stopStartNo, setStopStartNo] = useState('');
  const [stopEndNo, setStopEndNo] = useState('');
  const [stopReason, setStopReason] = useState('');
  const [submittingStop, setSubmittingStop] = useState(false);

  const [bounceModalOpen, setBounceModalOpen] = useState(false);
  const [bounceAccountId, setBounceAccountId] = useState('');
  const [bounceChequeNo, setBounceChequeNo] = useState('');
  const [bounceAmount, setBounceAmount] = useState('');
  const [bounceReasonText, setBounceReasonText] = useState('');
  const [submittingBounce, setSubmittingBounce] = useState(false);

  // Load COA and Eligible Products
  const token = useAuthStore((s) => s.token);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsData, productsData, coaRes, accountsRes] = await Promise.allSettled([
        fetchChequeSettings(),
        fetchEligibleProducts(),
        apiClient.get('/accounting/coa'),
        // Correct route: /savings (not /savings/accounts)
        apiClient.get('/savings', { params: { limit: 200 } }),
      ]);

      if (productsData.status === 'fulfilled') {
        setEligibleProducts(productsData.value);
      }

      if (coaRes.status === 'fulfilled' && Array.isArray(coaRes.value.data)) {
        setCoaOptions(coaRes.value.data.map((c: any) => ({ id: c.id, code: c.code, name: c.name })));
      }

      if (accountsRes.status === 'fulfilled') {
        // /savings returns a PaginatedResult: { data: Account[], total, page, ... }
        const rows = accountsRes.value.data?.data ?? accountsRes.value.data;
        if (Array.isArray(rows)) {
          setAccountsList(rows.map((a: any) => ({
            id: a.id,
            accountNo: a.accountNo,
            memberName: a.member?.fullName || a.memberName || 'Member'
          })));
        }
      }


      if (settingsData.status === 'fulfilled' && settingsData.value) {
        const s = settingsData.value;
        const normalized: ChequeSettingsData = {
          scope: s.scope || 'organization',
          enableChequeFacility: s.enableChequeFacility !== false,
          eligibleAccountProductIds: Array.isArray(s.eligibleAccountProductIds) ? s.eligibleAccountProductIds : [],
          defaultLeavesPerBook: Number(s.defaultLeavesPerBook) || 25,
          allowedBookSizes: Array.isArray(s.allowedBookSizes) ? s.allowedBookSizes : [10, 20, 25, 50, 100],
          maxActiveBooksPerAccount: Number(s.maxActiveBooksPerAccount) || 1,
          reissueAllowed: s.reissueAllowed !== false,
          reissueAfterExhaustion: s.reissueAfterExhaustion !== false,
          lostBookReplacementAllowed: s.lostBookReplacementAllowed !== false,
          cancelledBookReplacementAllowed: s.cancelledBookReplacementAllowed !== false,
          numberingScope: s.numberingScope || 'branch_wise',
          startingChequeNumber: Number(s.startingChequeNumber) || 100001,
          chequePrefix: s.chequePrefix || 'CHQ-',
          numberLength: Number(s.numberLength) || 6,
          allowManualNumberAssignment: s.allowManualNumberAssignment === true,
          preventDuplicateChequeNumbers: s.preventDuplicateChequeNumbers !== false,
          validityPeriodDays: Number(s.validityPeriodDays) || 90,
          expiredChequeBehavior: s.expiredChequeBehavior || 'reject_presentation',
          stopPaymentEnabled: s.stopPaymentEnabled !== false,
          allowStopPaymentBy: Array.isArray(s.allowStopPaymentBy) ? s.allowStopPaymentBy : ['member', 'teller', 'branch_manager', 'admin'],
          stopPaymentCharge: Number(s.stopPaymentCharge) || 0,
          allowStopPaymentOn: Array.isArray(s.allowStopPaymentOn) ? s.allowStopPaymentOn : ['single_cheque', 'cheque_range', 'entire_book'],
          stopPaymentRequireApproval: s.stopPaymentRequireApproval !== false,
          bounceHandlingEnabled: s.bounceHandlingEnabled !== false,
          bounceCharge: Number(s.bounceCharge) || 0,
          maxBounceCount: s.maxBounceCount ? Number(s.maxBounceCount) : null,
          afterThresholdAction: s.afterThresholdAction || 'flag_account',
          issuanceChargeType: s.issuanceChargeType || 'flat',
          issuanceChargeAmount: Number(s.issuanceChargeAmount) || 0,
          issuanceChargePerLeafAmount: Number(s.issuanceChargePerLeafAmount) || 0,
          lostBookCharge: Number(s.lostBookCharge) || 0,
          replacementBookCharge: Number(s.replacementBookCharge) || 0,
          otherChequeCharges: Array.isArray(s.otherChequeCharges) ? s.otherChequeCharges : [],
          taxApplicable: s.taxApplicable === true,
          taxRate: Number(s.taxRate) || 0,
          glIssuanceFeeAccountId: s.glIssuanceFeeAccountId || '',
          glStopPaymentFeeAccountId: s.glStopPaymentFeeAccountId || '',
          glBounceFeeAccountId: s.glBounceFeeAccountId || '',
          glReplacementFeeAccountId: s.glReplacementFeeAccountId || '',
          glOtherChargesFeeAccountId: s.glOtherChargesFeeAccountId || '',
        };
        setForm(normalized);
        setInitialForm(normalized);
      }
    } catch (err: any) {
      toast.showError(err.message || 'Failed to load cheque configuration.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // Wait for Zustand auth store to rehydrate before firing authenticated requests
    if (token) loadInitialData();
  }, [loadInitialData, token]);

  // Load Operational Lists on tab switch
  const loadTabContent = useCallback(async () => {
    if (activeTab === 'books') {
      const data = await fetchChequeBooksList({ search: searchTerm, status: statusFilter });
      setChequeBooks(data);
    } else if (activeTab === 'leaves') {
      const data = await fetchChequeLeavesList({ search: searchTerm, status: statusFilter });
      setChequeLeaves(data);
    } else if (activeTab === 'stop_payments') {
      const data = await fetchStopPaymentsList();
      setStopPayments(data);
    } else if (activeTab === 'bounces') {
      const data = await fetchBounceRegister();
      setBounces(data);
    }
  }, [activeTab, searchTerm, statusFilter]);

  useEffect(() => {
    if (token && activeTab !== 'config') {
      loadTabContent();
    }
  }, [activeTab, loadTabContent, token]);


  // Save Settings handler
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const saved = await saveChequeSettings(form);
      setInitialForm(form);
      toast.showSuccess('Cheque Settings updated successfully.');
    } catch (err: any) {
      toast.showError(err.response?.data?.error || err.message || 'Failed to save cheque settings');
    } finally {
      setSaving(false);
    }
  };

  // Reset form handler
  const handleResetSettings = () => {
    if (initialForm) {
      setForm(initialForm);
      toast.showInfo('Cheque Settings reset to last saved state.');
    }
  };

  // Toggle eligible product checkbox
  const toggleEligibleProduct = (productId: string) => {
    setForm(prev => {
      const exists = prev.eligibleAccountProductIds.includes(productId);
      const updated = exists
        ? prev.eligibleAccountProductIds.filter(id => id !== productId)
        : [...prev.eligibleAccountProductIds, productId];
      return { ...prev, eligibleAccountProductIds: updated };
    });
  };

  // Toggle book size checkbox
  const toggleBookSize = (size: number) => {
    setForm(prev => {
      const exists = prev.allowedBookSizes.includes(size);
      const updated = exists
        ? prev.allowedBookSizes.filter(s => s !== size)
        : [...prev.allowedBookSizes, size].sort((a, b) => a - b);
      return { ...prev, allowedBookSizes: updated };
    });
  };

  // Issue cheque book submission
  const handleIssueBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueAccountId) {
      toast.showError('Select a savings account.');
      return;
    }
    setIssuing(true);
    try {
      await issueChequeBookApi({ accountId: issueAccountId, leafCount: issueLeafCount });
      toast.showSuccess('Cheque book issued successfully.');
      setIssueModalOpen(false);
      setIssueAccountId('');
      await invalidateChequeRegister();
      loadTabContent();
    } catch (err: any) {
      toast.showError(err.response?.data?.error || err.message || 'Failed to issue cheque book');
    } finally {
      setIssuing(false);
    }
  };

  // Update book status submission
  const handleUpdateStatusSubmit = async () => {
    if (!selectedBook) return;
    setUpdatingStatus(true);
    try {
      await updateBookStatusApi(selectedBook.id, targetStatus, statusReason);
      toast.showSuccess(`Cheque book status updated to ${targetStatus}.`);
      setStatusModalOpen(false);
      setSelectedBook(null);
      setStatusReason('');
      await invalidateChequeRegister();
      loadTabContent();
    } catch (err: any) {
      toast.showError(err.response?.data?.error || err.message || 'Failed to update book status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Stop payment request submission
  const handleStopPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stopAccountId || !stopStartNo || !stopEndNo || !stopReason) {
      toast.showError('Fill in all required stop payment fields.');
      return;
    }
    setSubmittingStop(true);
    try {
      await createStopPaymentApi({
        accountId: stopAccountId,
        startChequeNumber: stopStartNo.trim(),
        endChequeNumber: stopEndNo.trim(),
        reason: stopReason.trim(),
      });
      toast.showSuccess('Stop payment request submitted.');
      setStopModalOpen(false);
      setStopAccountId('');
      setStopStartNo('');
      setStopEndNo('');
      setStopReason('');
      await invalidateChequeRegister();
      loadTabContent();
    } catch (err: any) {
      toast.showError(err.response?.data?.error || err.message || 'Failed to submit stop payment');
    } finally {
      setSubmittingStop(false);
    }
  };

  // Approve stop payment
  const handleApproveStop = async (id: string) => {
    try {
      await approveStopPaymentApi(id);
      toast.showSuccess('Stop payment approved.');
      await invalidateChequeRegister();
      loadTabContent();
    } catch (err: any) {
      toast.showError(err.response?.data?.error || err.message || 'Approval failed');
    }
  };

  // Reject stop payment
  const handleRejectStop = async (id: string) => {
    try {
      await rejectStopPaymentApi(id, 'Rejected by admin');
      toast.showSuccess('Stop payment rejected.');
      await invalidateChequeRegister();
      loadTabContent();
    } catch (err: any) {
      toast.showError(err.response?.data?.error || err.message || 'Rejection failed');
    }
  };

  // Record bounce submission
  const handleRecordBounceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bounceAccountId || !bounceChequeNo || !bounceAmount || !bounceReasonText) {
      toast.showError('Fill in all required bounce details.');
      return;
    }
    setSubmittingBounce(true);
    try {
      await recordBounceApi({
        accountId: bounceAccountId,
        chequeNumber: bounceChequeNo.trim(),
        amount: Number(bounceAmount),
        bounceReason: bounceReasonText.trim(),
      });
      toast.showSuccess('Bounced cheque recorded in register.');
      setBounceModalOpen(false);
      setBounceAccountId('');
      setBounceChequeNo('');
      setBounceAmount('');
      setBounceReasonText('');
      await invalidateChequeRegister();
      loadTabContent();
    } catch (err: any) {
      toast.showError(err.response?.data?.error || err.message || 'Failed to record bounce');
    } finally {
      setSubmittingBounce(false);
    }
  };

  // Standard input class
  const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition";
  const selectCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition cursor-pointer";

  // Loading indicator
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="font-semibold text-xs">Loading Cheque Facility Configuration…</p>
      </div>
    );
  }

  // EMPTY STATE: No Account Products Available
  if (eligibleProducts.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-2xl mx-auto shadow-sm my-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 text-base">No Account Products Available</h3>
          <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
            Cheque facilities can only be configured for existing Savings or Current Account Products. Create an Account Product first from Account Products Settings.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={() => {
              if (onNavigateToProducts) {
                onNavigateToProducts();
              } else {
                toast.showInfo('Navigate to SETUPS → Account Products from the menu.');
              }
            }}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 transition cursor-pointer shadow-sm"
          >
            Go to Account Products <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-800 text-base">Cheque Settings</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
              ACTIVE
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Configure cheque facility, cheque books, numbering, charges, stop payment and dishonour rules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleResetSettings}
            disabled={saving}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      </div>

      {/* SUB-NAV TABS — operational views (books, leaves, stop payments, bounces)
          now live in the consolidated Cheque Management workspace. Setups keeps
          configuration only. */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'config'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Sliders className="w-4 h-4" /> Configuration
        </button>
      </div>

      {/* Pointer to the consolidated operational workspace */}
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
        <p className="leading-relaxed">
          This page now holds <span className="font-bold">cheque configuration</span> only. Issuing books, the cheque register,
          clearance, stop payments, bounces, approvals, and leaf design have moved to the dedicated
          <span className="font-bold"> Cheque Management</span> workspace.
        </p>
      </div>

      {/* CONFIGURATION SECTIONS */}
      {activeTab === 'config' && (
        <div className="space-y-5">
          {/* A. GENERAL CHEQUE FACILITY */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 font-mono text-xs flex items-center justify-center font-bold border border-emerald-200">A</span>
                  General Cheque Facility
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">Enable cheque services and select eligible member account products.</p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <span className="text-xs font-semibold text-slate-700">Cheque Facility:</span>
                <div
                  onClick={() => setForm(p => ({ ...p, enableChequeFacility: !p.enableChequeFacility }))}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${form.enableChequeFacility ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.enableChequeFacility ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="text-xs font-bold text-emerald-700">{form.enableChequeFacility ? 'ON' : 'OFF'}</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Eligible Account Products</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {eligibleProducts.map(prod => {
                  const checked = form.eligibleAccountProductIds.includes(prod.id);
                  return (
                    <div
                      key={prod.id}
                      onClick={() => toggleEligibleProduct(prod.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        checked ? 'bg-emerald-50/50 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <span className="font-mono text-[10px] font-bold text-emerald-600">{prod.code}</span>
                        <div className="font-bold text-xs">{prod.name}</div>
                      </div>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'}`}>
                        {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* B. CHEQUE BOOK SETTINGS */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 font-mono text-xs flex items-center justify-center font-bold border border-emerald-200">B</span>
                Cheque Book Settings
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">Configure default leaves, allowed book sizes, active limits and replacement rules.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Leaves Per Book</label>
                <select
                  value={form.defaultLeavesPerBook}
                  onChange={(e) => setForm(p => ({ ...p, defaultLeavesPerBook: Number(e.target.value) }))}
                  className={selectCls}
                >
                  <option value={10}>10 Leaves</option>
                  <option value={20}>20 Leaves</option>
                  <option value={25}>25 Leaves</option>
                  <option value={50}>50 Leaves</option>
                  <option value={100}>100 Leaves</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Max Active Cheque Books Per Account</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.maxActiveBooksPerAccount}
                  onChange={(e) => setForm(p => ({ ...p, maxActiveBooksPerAccount: Math.max(1, Number(e.target.value)) }))}
                  className={inputCls}
                />
                <p className="text-[10px] text-slate-400 mt-1">Maximum concurrently active cheque books allowed.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Allowed Book Sizes</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {[10, 20, 25, 50, 100].map(size => {
                    const checked = form.allowedBookSizes.includes(size);
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleBookSize(size)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                          checked ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-100 pt-3">
              {[
                { label: 'Reissue Allowed', key: 'reissueAllowed' },
                { label: 'Reissue After Exhaustion', key: 'reissueAfterExhaustion' },
                { label: 'Lost Replacement Allowed', key: 'lostBookReplacementAllowed' },
                { label: 'Cancelled Replacement Allowed', key: 'cancelledBookReplacementAllowed' },
              ].map(({ label, key }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(form as any)[key] === true}
                    onChange={(e) => setForm(p => ({ ...p, [key]: e.target.checked }))}
                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* C. CHEQUE NUMBERING */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 font-mono text-xs flex items-center justify-center font-bold border border-emerald-200">C</span>
                Cheque Numbering
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">Configure scope, starting sequence, prefix, length, and concurrency enforcement.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Numbering Scope</label>
                <select
                  value={form.numberingScope}
                  onChange={(e) => setForm(p => ({ ...p, numberingScope: e.target.value as any }))}
                  className={selectCls}
                >
                  <option value="account_wise">Account-wise</option>
                  <option value="product_wise">Product-wise</option>
                  <option value="branch_wise">Branch-wise</option>
                  <option value="org_wise">Organization-wide</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Starting Number</label>
                <input
                  type="number"
                  value={form.startingChequeNumber}
                  onChange={(e) => setForm(p => ({ ...p, startingChequeNumber: Number(e.target.value) }))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prefix</label>
                <input
                  type="text"
                  value={form.chequePrefix}
                  onChange={(e) => setForm(p => ({ ...p, chequePrefix: e.target.value }))}
                  className={inputCls}
                  placeholder="CHQ-"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Number Length</label>
                <input
                  type="number"
                  min={4}
                  max={12}
                  value={form.numberLength}
                  onChange={(e) => setForm(p => ({ ...p, numberLength: Number(e.target.value) }))}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.allowManualNumberAssignment}
                  onChange={(e) => setForm(p => ({ ...p, allowManualNumberAssignment: e.target.checked }))}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
                <span className="font-semibold text-slate-700">Allow Manual Number Assignment (Elevated Permission)</span>
              </label>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                🔒 DB Unique Constraint Enforced
              </span>
            </div>
          </div>

          {/* D. CHEQUE VALIDITY & STOP PAYMENT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* D. CHEQUE VALIDITY */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 font-mono text-xs flex items-center justify-center font-bold border border-emerald-200">D</span>
                  Cheque Validity
                </h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Validity Period (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={730}
                    value={form.validityPeriodDays}
                    onChange={(e) => setForm(p => ({ ...p, validityPeriodDays: Number(e.target.value) }))}
                    className={inputCls}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Configured regulatory/cooperative policy validity days.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expired Cheque Behavior</label>
                  <select
                    value={form.expiredChequeBehavior}
                    onChange={(e) => setForm(p => ({ ...p, expiredChequeBehavior: e.target.value as any }))}
                    className={selectCls}
                  >
                    <option value="flag_only">Flag only</option>
                    <option value="reject_presentation">Reject presentation</option>
                    <option value="require_approval">Require manager approval</option>
                  </select>
                </div>
              </div>
            </div>

            {/* E. STOP PAYMENT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 font-mono text-xs flex items-center justify-center font-bold border border-emerald-200">E</span>
                  Stop Payment
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.stopPaymentEnabled}
                    onChange={(e) => setForm(p => ({ ...p, stopPaymentEnabled: e.target.checked }))}
                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">Enabled</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Stop Payment Fee (NPR)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.stopPaymentCharge}
                    onChange={(e) => setForm(p => ({ ...p, stopPaymentCharge: Number(e.target.value) }))}
                    className={inputCls}
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.stopPaymentRequireApproval}
                      onChange={(e) => setForm(p => ({ ...p, stopPaymentRequireApproval: e.target.checked }))}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-700">Require Approval Workflow</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* F. BOUNCE / DISHONOUR & G. CHARGES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* F. BOUNCE / DISHONOUR */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 font-mono text-xs flex items-center justify-center font-bold border border-emerald-200">F</span>
                  Bounce / Dishonour
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.bounceHandlingEnabled}
                    onChange={(e) => setForm(p => ({ ...p, bounceHandlingEnabled: e.target.checked }))}
                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">Enabled</span>
                </label>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Bounce Fee (NPR)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.bounceCharge}
                      onChange={(e) => setForm(p => ({ ...p, bounceCharge: Number(e.target.value) }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Threshold Action</label>
                    <select
                      value={form.afterThresholdAction}
                      onChange={(e) => setForm(p => ({ ...p, afterThresholdAction: e.target.value as any }))}
                      className={selectCls}
                    >
                      <option value="flag_account">Flag Account / Review</option>
                      <option value="require_manager_review">Require Manager Review</option>
                      <option value="suspend_cheque_facility">Suspend Cheque Facility</option>
                      <option value="require_approval">Require Approval</option>
                      <option value="no_automatic_action">No Automatic Action</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* G. CHARGES & FEES */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 font-mono text-xs flex items-center justify-center font-bold border border-emerald-200">G</span>
                  Issuance & Replacement Charges
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Issuance Charge Type</label>
                  <select
                    value={form.issuanceChargeType}
                    onChange={(e) => setForm(p => ({ ...p, issuanceChargeType: e.target.value as any }))}
                    className={selectCls}
                  >
                    <option value="flat">Flat amount</option>
                    <option value="per_leaf">Per leaf</option>
                    <option value="both">Both (Flat + Per Leaf)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Issuance Amount (NPR)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.issuanceChargeAmount}
                    onChange={(e) => setForm(p => ({ ...p, issuanceChargeAmount: Number(e.target.value) }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lost Book Charge (NPR)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.lostBookCharge}
                    onChange={(e) => setForm(p => ({ ...p, lostBookCharge: Number(e.target.value) }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Replacement Fee (NPR)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.replacementBookCharge}
                    onChange={(e) => setForm(p => ({ ...p, replacementBookCharge: Number(e.target.value) }))}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* H. ACCOUNTING / GL MAPPING */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 font-mono text-xs flex items-center justify-center font-bold border border-emerald-200">H</span>
                Accounting / GL Mapping
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">Map cheque fees to posting-enabled accounts in Chart of Accounts.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cheque Issuance Fee GL</label>
                <select
                  value={form.glIssuanceFeeAccountId || ''}
                  onChange={(e) => setForm(p => ({ ...p, glIssuanceFeeAccountId: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">— Select COA Account —</option>
                  {coaOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Stop Payment Fee GL</label>
                <select
                  value={form.glStopPaymentFeeAccountId || ''}
                  onChange={(e) => setForm(p => ({ ...p, glStopPaymentFeeAccountId: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">— Select COA Account —</option>
                  {coaOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bounce Fee GL</label>
                <select
                  value={form.glBounceFeeAccountId || ''}
                  onChange={(e) => setForm(p => ({ ...p, glBounceFeeAccountId: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">— Select COA Account —</option>
                  {coaOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Replacement Fee GL</label>
                <select
                  value={form.glReplacementFeeAccountId || ''}
                  onChange={(e) => setForm(p => ({ ...p, glReplacementFeeAccountId: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">— Select COA Account —</option>
                  {coaOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OPERATIONAL SUB-TAB 1: CHEQUE BOOKS */}
      {activeTab === 'books' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search book no, member, account..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="exhausted">Exhausted</option>
                <option value="cancelled">Cancelled</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <button
              onClick={() => setIssueModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" /> Issue Cheque Book
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm text-xs">
            {chequeBooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
                <BookOpen className="w-8 h-8 text-slate-400" />
                <p className="font-semibold text-xs">No cheque books found.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase">
                  <tr>
                    <th className="p-3">Book No</th>
                    <th className="p-3">Account / Member</th>
                    <th className="p-3">Leaves Range</th>
                    <th className="p-3">Issued Date (BS)</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {chequeBooks.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono font-bold text-emerald-600">{b.bookNumber}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{b.memberName || 'Member'}</div>
                        <div className="font-mono text-[10px] text-slate-500">{b.accountNo}</div>
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {b.leafStartNumber} - {b.leafEndNumber} ({b.leafCount})
                      </td>
                      <td className="p-3 font-mono text-slate-600">{b.issuedDateBs}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          b.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                          b.status === 'cancelled' ? 'bg-rose-100 text-rose-700 border-rose-300' :
                          b.status === 'lost' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                          'bg-slate-100 text-slate-600 border-slate-300'
                        }`}>
                          {b.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {b.status === 'active' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedBook(b);
                                setTargetStatus('cancelled');
                                setStatusModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                setSelectedBook(b);
                                setTargetStatus('lost');
                                setStatusModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                            >
                              Mark Lost
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* OPERATIONAL SUB-TAB 2: CHEQUE LEAVES */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search cheque number, book no, account..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="unused">Unused</option>
              <option value="issued">Issued</option>
              <option value="presented">Presented</option>
              <option value="used">Used</option>
              <option value="cleared">Cleared</option>
              <option value="stopped">Stopped</option>
              <option value="bounced">Bounced</option>
            </select>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm text-xs">
            {chequeLeaves.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
                <FileText className="w-8 h-8 text-slate-400" />
                <p className="font-semibold text-xs">No cheque leaves found.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase">
                  <tr>
                    <th className="p-3">Cheque No</th>
                    <th className="p-3">Book No</th>
                    <th className="p-3">Account / Member</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Payee / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {chequeLeaves.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono font-bold text-emerald-600">{l.chequeNumber}</td>
                      <td className="p-3 font-mono text-slate-600">{l.bookNumber}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{l.memberName || 'Member'}</div>
                        <div className="font-mono text-[10px] text-slate-500">{l.accountNo}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          l.status === 'unused' ? 'bg-slate-100 text-slate-700 border-slate-300' :
                          l.status === 'used' ? 'bg-violet-100 text-violet-700 border-violet-300' :
                          l.status === 'cleared' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                          l.status === 'stopped' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                          l.status === 'bounced' ? 'bg-rose-100 text-rose-700 border-rose-300' :
                          'bg-slate-100 text-slate-600 border-slate-300'
                        }`}>
                          {l.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">
                        {l.stopPaymentReason ? `Stopped: ${l.stopPaymentReason}` :
                         l.bounceReason ? `Bounced: ${l.bounceReason}` :
                         l.payeeName ? `Payee: ${l.payeeName}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* OPERATIONAL SUB-TAB 3: STOP PAYMENTS */}
      {activeTab === 'stop_payments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Stop Payment Queue</h3>
            <button
              onClick={() => setStopModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" /> Request Stop Payment
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm text-xs">
            {stopPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
                <ShieldAlert className="w-8 h-8 text-slate-400" />
                <p className="font-semibold text-xs">No stop payment requests found.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase">
                  <tr>
                    <th className="p-3">Cheque Range</th>
                    <th className="p-3">Account / Member</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3">Charge</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {stopPayments.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono font-bold text-emerald-600">
                        {s.startChequeNumber} {s.startChequeNumber !== s.endChequeNumber ? `- ${s.endChequeNumber}` : ''}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{s.memberName || 'Member'}</div>
                        <div className="font-mono text-[10px] text-slate-500">{s.accountNo}</div>
                      </td>
                      <td className="p-3 text-slate-600">{s.reason}</td>
                      <td className="p-3 font-mono font-semibold">रु. {Number(s.chargeAmount || 0).toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                          s.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                          'bg-rose-100 text-rose-700 border-rose-300'
                        }`}>
                          {s.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {s.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApproveStop(s.id)}
                              className="px-2.5 py-1 bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg text-[10px] font-bold transition cursor-pointer shadow-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectStop(s.id)}
                              className="px-2.5 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* OPERATIONAL SUB-TAB 4: BOUNCE REGISTER */}
      {activeTab === 'bounces' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Dishonour / Bounce Register</h3>
            <button
              onClick={() => setBounceModalOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm"
            >
              <Ban className="w-4 h-4" /> Record Bounced Cheque
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm text-xs">
            {bounces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
                <Ban className="w-8 h-8 text-slate-400" />
                <p className="font-semibold text-xs">No dishonoured cheques recorded.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase">
                  <tr>
                    <th className="p-3">Cheque No</th>
                    <th className="p-3">Account / Member</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Bounce Reason</th>
                    <th className="p-3">Bounce Charge</th>
                    <th className="p-3">Reported Date (BS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {bounces.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono font-bold text-rose-600">{b.chequeNumber}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{b.memberName || 'Member'}</div>
                        <div className="font-mono text-[10px] text-slate-500">{b.accountNo}</div>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800">रु. {Number(b.amount).toLocaleString()}</td>
                      <td className="p-3 text-slate-600">{b.bounceReason}</td>
                      <td className="p-3 font-mono font-semibold">रु. {Number(b.bounceCharge).toLocaleString()}</td>
                      <td className="p-3 font-mono text-slate-600">{b.reportedDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ISSUE CHEQUE BOOK */}
      {issueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" /> Issue Cheque Book
              </h3>
              <button onClick={() => setIssueModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleIssueBookSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Savings Account</label>
                <select
                  value={issueAccountId}
                  onChange={(e) => setIssueAccountId(e.target.value)}
                  className={selectCls}
                  required
                >
                  <option value="">— Select Account —</option>
                  {accountsList.map(a => (
                    <option key={a.id} value={a.id}>{a.accountNo} — {a.memberName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Number of Leaves</label>
                <select
                  value={issueLeafCount}
                  onChange={(e) => setIssueLeafCount(Number(e.target.value))}
                  className={selectCls}
                >
                  {form.allowedBookSizes.map(sz => (
                    <option key={sz} value={sz}>{sz} Leaves</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIssueModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={issuing}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {issuing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Issue Book
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPDATE BOOK STATUS */}
      {statusModalOpen && selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm">
                Update Book Status — {selectedBook.bookNumber}
              </h3>
              <button onClick={() => setStatusModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Status</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as any)}
                  className={selectCls}
                >
                  <option value="cancelled">Cancelled</option>
                  <option value="lost">Lost</option>
                  <option value="replaced">Replaced</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Notes</label>
                <textarea
                  rows={3}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className={inputCls}
                  placeholder="Provide reason for status change..."
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateStatusSubmit}
                  disabled={updatingStatus}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {updatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REQUEST STOP PAYMENT */}
      {stopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-emerald-600" /> Request Stop Payment
              </h3>
              <button onClick={() => setStopModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleStopPaymentSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Savings Account</label>
                <select
                  value={stopAccountId}
                  onChange={(e) => setStopAccountId(e.target.value)}
                  className={selectCls}
                  required
                >
                  <option value="">— Select Account —</option>
                  {accountsList.map(a => (
                    <option key={a.id} value={a.id}>{a.accountNo} — {a.memberName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Cheque No</label>
                  <input
                    type="text"
                    value={stopStartNo}
                    onChange={(e) => setStopStartNo(e.target.value)}
                    className={inputCls}
                    placeholder="CHQ-000101"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Cheque No</label>
                  <input
                    type="text"
                    value={stopEndNo}
                    onChange={(e) => setStopEndNo(e.target.value)}
                    className={inputCls}
                    placeholder="CHQ-000101"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Stop Payment</label>
                <textarea
                  rows={2}
                  value={stopReason}
                  onChange={(e) => setStopReason(e.target.value)}
                  className={inputCls}
                  placeholder="Lost cheque leaf, misplaced, etc..."
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStopModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStop}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {submittingStop && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD BOUNCED CHEQUE */}
      {bounceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-600" /> Record Bounced Cheque
              </h3>
              <button onClick={() => setBounceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecordBounceSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Savings Account</label>
                <select
                  value={bounceAccountId}
                  onChange={(e) => setBounceAccountId(e.target.value)}
                  className={selectCls}
                  required
                >
                  <option value="">— Select Account —</option>
                  {accountsList.map(a => (
                    <option key={a.id} value={a.id}>{a.accountNo} — {a.memberName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cheque Number</label>
                  <input
                    type="text"
                    value={bounceChequeNo}
                    onChange={(e) => setBounceChequeNo(e.target.value)}
                    className={inputCls}
                    placeholder="CHQ-000105"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cheque Amount (NPR)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={bounceAmount}
                    onChange={(e) => setBounceAmount(e.target.value)}
                    className={inputCls}
                    placeholder="25000"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bounce Reason</label>
                <textarea
                  rows={2}
                  value={bounceReasonText}
                  onChange={(e) => setBounceReasonText(e.target.value)}
                  className={inputCls}
                  placeholder="Insufficient funds, signature mismatch, etc..."
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBounceModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBounce}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {submittingBounce && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Record Dishonour
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
