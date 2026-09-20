/**
 * SetupSavingsSettingsView
 * API-driven CRUD for the SETUPS → Savings A/C Settings module.
 *
 * The Savings A/C Settings MegaMenu has 8 child pages (Account Products,
 * Saving Schemes, Interest & Rate Rules, Charges & Fees, Account Rules,
 * Cheque Settings, Cheque Book Settings, Account Product Defaults). Each is a
 * distinct virtual tab with its own moduleKey that routes here with
 * `activeSubKey` = the moduleKey. The active page is derived purely from that
 * moduleKey (this app's route) — there is no internal section switcher, so only
 * the selected page mounts, fetches and renders, matching every other SETUPS
 * view (e.g. SetupShareSettingsView).
 *
 * All 8 pages operate on the canonical savings_products config, plus the org
 * Default Savings Product selector and the issued cheque-book panel. Only the
 * data the active page needs is fetched — no cross-page over-fetching.
 *
 * Follows the same standardized structure as SetupShareSettingsView
 * (AdminSetupSearchFilterBar + table + MasterDataFormModal). No mock data.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, AlertTriangle, Info, PiggyBank, BookOpen, Ban, Save,
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../../context/ToastContext';
import { AdminSetupSearchFilterBar } from '../common/AdminSetupSearchFilterBar';
import { MasterDataFormModal, type MasterDataFormConfigCtx } from './MasterDataFormModal';
import { ChequeSettingsView } from './ChequeSettingsView';
import {
  SavingsSettingsEntityType,

  SAVING_PRODUCT_TYPE_LABELS,
  SAVING_INTEREST_METHOD_LABELS,
  SAVING_POSTING_FREQUENCY_LABELS,
} from '../../api/savingsSettings';

interface SavingProductRow {
  id: string;
  code: string;
  name: string;
  nameNepali?: string | null;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  isSystem: boolean;
  usageCount?: number;
  productType?: string;
  productCategory?: string | null;
  accountNoPrefix?: string;
  interestRate?: number;
  interestPostingFrequency?: string;
  interestCalculationMethod?: string;
  minBalance?: number;
  minDeposit?: number;
  maxDeposit?: number | null;
  tenureMonths?: number | null;
  penaltyRate?: number;
  eligibleMemberTypeIds?: string[];
  minAge?: number | null;
  maxAge?: number | null;
  requiresKycVerified?: boolean;
  requiresNominee?: boolean;
  requiresPhoto?: boolean;
  requiresSignature?: boolean;
  requiresDocuments?: boolean;
  openingDepositRequired?: boolean;
  backdateDepositAllowed?: boolean;
  depositRequiresApproval?: boolean;
  withdrawalRequiresApproval?: boolean;
  minBalanceGraceDays?: number;
  minBalancePenaltyPercent?: number;
  minBalancePenaltyAmount?: number;
  closureAllowed?: boolean;
  inactiveAfterMonths?: number;
  dormantAfterMonths?: number;
  closureFee?: number;
  openingFee?: number;
  monthlyMaintenanceFee?: number;
  chequeEnabled?: boolean;
  chequeDefaultLeaves?: number;
  chequeMaxBooks?: number;
  chequeValidityDays?: number;
  withdrawalFee?: number;
  chequeBookFee?: number;
  chequeLeafFee?: number;
  stopPaymentFee?: number;
  chequeReturnFee?: number;
  minWithdrawal?: number | null;
  maxWithdrawal?: number | null;
  dailyDepositLimit?: number | null;
  monthlyDepositLimit?: number | null;
  maxBalance?: number | null;
  rateHistory?: { id: string; rate: number; effectiveFromBs: string; effectiveToBs: string | null }[];
  glLiabilityAccountId?: string | null;
  glInterestExpenseAccountId?: string | null;
  glInterestPayableAccountId?: string | null;
  glFeeIncomeAccountId?: string | null;
  glPenaltyIncomeAccountId?: string | null;
  glChequeIncomeAccountId?: string | null;
}

interface ChequeBookRow {
  id: string;
  bookNo: string;
  accountNo: string;
  leafCount: number;
  issueDateBs: string;
  status: string;
}

interface FormState {
  code: string;
  name: string;
  nameNepali: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  productType: string;
  productCategory: string;
  accountNoPrefix: string;
  interestRate: number;
  interestPostingFrequency: string;
  interestCalculationMethod: string;
  minBalance: number;
  minDeposit: number;
  maxDeposit: string;
  tenureMonths: string;
  penaltyRate: number;
  minAge: string;
  maxAge: string;
  requiresKycVerified: boolean;
  requiresNominee: boolean;
  requiresPhoto: boolean;
  requiresSignature: boolean;
  requiresDocuments: boolean;
  openingDepositRequired: boolean;
  eligibleMemberTypeIds: string[];
  backdateDepositAllowed: boolean;
  depositRequiresApproval: boolean;
  withdrawalRequiresApproval: boolean;
  minBalanceGraceDays: number;
  minBalancePenaltyPercent: number;
  minBalancePenaltyAmount: number;
  inactiveAfterMonths: number;
  dormantAfterMonths: number;
  closureAllowed: boolean;
  closureFee: number;
  openingFee: number;
  monthlyMaintenanceFee: number;
  chequeEnabled: boolean;
  chequeDefaultLeaves: number;
  chequeMaxBooks: number;
  chequeValidityDays: number;
  glLiabilityAccountId: string;
  glInterestExpenseAccountId: string;
  glInterestPayableAccountId: string;
  glFeeIncomeAccountId: string;
  glPenaltyIncomeAccountId: string;
  glChequeIncomeAccountId: string;
}

interface Props {
  entityType: SavingsSettingsEntityType;
  activeSubKey?: string;
}

const META = {
  label: 'Account Product',
  labelPlural: 'Account Products',
  description: 'Canonical savings product config — interest, opening, deposit, withdrawal, charges and GL mapping.',
};

type SectionKey =
  | 'setup_savings_products'
  | 'setup_savings_schemes'
  | 'setup_savings_interest'
  | 'setup_savings_charges'
  | 'setup_savings_rules'
  | 'setup_savings_cheque'
  | 'setup_savings_cheque_books'
  | 'setup_savings_defaults';

const SECTION_IDS: SectionKey[] = [
  'setup_savings_products',
  'setup_savings_schemes',
  'setup_savings_interest',
  'setup_savings_charges',
  'setup_savings_rules',
  'setup_savings_cheque',
  'setup_savings_cheque_books',
  'setup_savings_defaults',
];

// The active page is derived from the tab's moduleKey (the "route" in this
// app's virtual-tab navigation). There is deliberately no internal section
// state or in-page tab switcher: switching setup pages goes through the
// MegaMenu / tab bar, matching every other SETUPS view in the app.
const toSection = (key?: string): SectionKey =>
  (SECTION_IDS as readonly string[]).includes(key ?? '') ? (key as SectionKey) : 'setup_savings_products';

const SECTION_META: Record<SectionKey, { title: string; description: string }> = {
  setup_savings_products: {
    title: 'Saving Account Products',
    description: 'Canonical savings product config — interest, opening, deposit, withdrawal, charges and GL mapping.',
  },
  setup_savings_schemes: {
    title: 'Saving Schemes',
    description: 'Saving schemes are configured as Account Products (legacy alias). Manage product rules, interest and charges here.',
  },
  setup_savings_interest: {
    title: 'Interest & Rate Rules',
    description: 'Per-product interest rate, posting frequency, calculation method and rate history.',
  },
  setup_savings_charges: {
    title: 'Charges & Fees',
    description: 'Per-product fees — opening, maintenance, withdrawal, closure and cheque-related charges.',
  },
  setup_savings_rules: {
    title: 'Account Rules',
    description: 'Per-product opening, deposit, withdrawal, minimum balance, dormancy and closure rules.',
  },
  setup_savings_cheque: {
    title: 'Cheque Settings',
    description: 'Per-product cheque facility, default leaves, maximum books and cheque charges.',
  },
  setup_savings_cheque_books: {
    title: 'Cheque Book Settings',
    description: 'Issued cheque books for savings accounts — review status and cancel unused books.',
  },
  setup_savings_defaults: {
    title: 'Account Product Defaults',
    description: 'Select the default savings product used to auto-open a member’s savings account at registration.',
  },
};

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  nameNepali: '',
  description: '',
  isActive: true,
  sortOrder: 0,
  productType: 'regular',
  productCategory: '',
  accountNoPrefix: 'SAV',
  interestRate: 0,
  interestPostingFrequency: 'Monthly',
  interestCalculationMethod: 'min_monthly_balance',
  minBalance: 0,
  minDeposit: 0,
  maxDeposit: '',
  tenureMonths: '',
  penaltyRate: 0,
  minAge: '',
  maxAge: '',
  requiresKycVerified: true,
  requiresNominee: true,
  requiresPhoto: true,
  requiresSignature: true,
  requiresDocuments: true,
  openingDepositRequired: true,
  eligibleMemberTypeIds: [],
  backdateDepositAllowed: false,
  depositRequiresApproval: false,
  withdrawalRequiresApproval: false,
  minBalanceGraceDays: 0,
  minBalancePenaltyPercent: 0,
  minBalancePenaltyAmount: 0,
  inactiveAfterMonths: 3,
  dormantAfterMonths: 6,
  closureAllowed: true,
  closureFee: 0,
  openingFee: 0,
  monthlyMaintenanceFee: 0,
  chequeEnabled: false,
  chequeDefaultLeaves: 25,
  chequeMaxBooks: 1,
  chequeValidityDays: 90,
  glLiabilityAccountId: '',
  glInterestExpenseAccountId: '',
  glInterestPayableAccountId: '',
  glFeeIncomeAccountId: '',
  glPenaltyIncomeAccountId: '',
  glChequeIncomeAccountId: '',
};

const num = (v: any, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export const SetupSavingsSettingsView: React.FC<Props> = ({ entityType, activeSubKey }) => {
  const toast = useToast();

  // Active page is derived from the tab's moduleKey (the route). No internal
  // navigation state — only the selected page mounts, fetches and renders.
  const section = toSection(activeSubKey);

  const [rows, setRows] = useState<SavingProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Org default product selector
  const [defaultProductId, setDefaultProductId] = useState<string>('');
  const [defaultProductName, setDefaultProductName] = useState<string>('');
  const [settingDefault, setSettingDefault] = useState(false);

  // Reference options
  const [memberTypeOptions, setMemberTypeOptions] = useState<{ id: string; code: string; name: string }[]>([]);
  const [coaOptions, setCoaOptions] = useState<{ id: string; code: string; name: string }[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Cheque books
  const [chequeBooks, setChequeBooks] = useState<ChequeBookRow[]>([]);
  const [chequeLoading, setChequeLoading] = useState(false);
  const [cancellingBookId, setCancellingBookId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (activeFilter !== 'all') params.active = activeFilter === 'active' ? 'true' : 'false';
      const res = await apiClient.get(`/savings-settings/${entityType}`, { params });
      const data = Array.isArray(res.data) ? res.data : [];
      setRows(data);
      setTotal(data.length);
    } catch (err: any) {
      toast.showError(err.response?.data?.error ?? err.message, 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [entityType, searchTerm, activeFilter, toast]);

  // Only the active page fetches: the product list (and org default product)
  // is only needed on pages that display products; cheque books are fetched
  // only on the Cheque Book Settings page; reference dropdowns (member types,
  // COA) are loaded lazily when the product modal is opened.
  const needsProducts = section !== 'setup_savings_cheque_books';

  useEffect(() => {
    if (!needsProducts) return;
    fetchRows();
  }, [fetchRows, needsProducts]);

  useEffect(() => {
    setRows([]);
    setSearchTerm('');
    setActiveFilter('all');
  }, [section]);

  // Org default savings product (DEFAULT badge + Account Product Defaults page)
  useEffect(() => {
    if (!needsProducts) return;
    let active = true;
    apiClient
      .get('/savings/settings/default-product')
      .then((res) => {
        if (!active) return;
        setDefaultProductId(res.data?.defaultSavingProductId ?? '');
        setDefaultProductName(res.data?.product?.name ?? '');
      })
      .catch(() => {
        // Non-fatal: DEFAULT badges simply don't appear.
      });
    return () => { active = false; };
  }, [needsProducts]);

  // Reference options (member types + COA) are only consumed by the product
  // modal, so they are loaded on demand the first time the modal is opened.
  const ensureRefs = useCallback(async () => {
    if (memberTypeOptions.length > 0 && coaOptions.length > 0) return;
    try {
      const [memberTypes, coa] = await Promise.all([
        apiClient.get('/member-settings/member-types'),
        apiClient.get('/accounting/coa'),
      ]);
      setMemberTypeOptions((Array.isArray(memberTypes.data) ? memberTypes.data : []).map((m: any) => ({ id: m.id, code: m.code, name: m.name })));
      setCoaOptions((Array.isArray(coa.data) ? coa.data : []).map((c: any) => ({ id: c.id, code: c.code, name: c.name })));
    } catch {
      // Non-fatal for reference dropdowns.
    }
  }, [memberTypeOptions.length, coaOptions.length]);

  // Cheque books panel
  const fetchChequeBooks = useCallback(async () => {
    setChequeLoading(true);
    try {
      const res = await apiClient.get('/savings-settings/cheque-books');
      setChequeBooks((Array.isArray(res.data) ? res.data : []).map((b: any) => ({
        id: b.id,
        bookNo: b.bookNo,
        accountNo: b.accountNo,
        leafCount: num(b.leafCount),
        issueDateBs: b.issueDateBs,
        status: b.status ?? 'Issued',
      })));
    } catch {
      setChequeBooks([]);
    } finally {
      setChequeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section !== 'setup_savings_cheque_books') return;
    fetchChequeBooks();
  }, [section, fetchChequeBooks]);

  // ---------------------------------------------------------------------------
  const rowToForm = (row: SavingProductRow): FormState => ({
    ...EMPTY_FORM,
    code: row.code ?? '',
    name: row.name ?? '',
    nameNepali: row.nameNepali ?? '',
    description: row.description ?? '',
    isActive: row.isActive !== false,
    sortOrder: num(row.sortOrder),
    productType: row.productType ?? 'regular',
    productCategory: row.productCategory ?? '',
    accountNoPrefix: row.accountNoPrefix ?? 'SAV',
    interestRate: num(row.interestRate),
    interestPostingFrequency: row.interestPostingFrequency ?? 'Monthly',
    interestCalculationMethod: row.interestCalculationMethod ?? 'min_monthly_balance',
    minBalance: num(row.minBalance),
    minDeposit: num(row.minDeposit),
    maxDeposit: row.maxDeposit != null ? String(row.maxDeposit) : '',
    tenureMonths: row.tenureMonths != null ? String(row.tenureMonths) : '',
    penaltyRate: num(row.penaltyRate),
    minAge: row.minAge != null ? String(row.minAge) : '',
    maxAge: row.maxAge != null ? String(row.maxAge) : '',
    requiresKycVerified: row.requiresKycVerified !== false,
    requiresNominee: row.requiresNominee !== false,
    requiresPhoto: row.requiresPhoto !== false,
    requiresSignature: row.requiresSignature !== false,
    requiresDocuments: row.requiresDocuments !== false,
    openingDepositRequired: row.openingDepositRequired !== false,
    eligibleMemberTypeIds: Array.isArray(row.eligibleMemberTypeIds) ? row.eligibleMemberTypeIds : [],
    backdateDepositAllowed: row.backdateDepositAllowed === true,
    depositRequiresApproval: row.depositRequiresApproval === true,
    withdrawalRequiresApproval: row.withdrawalRequiresApproval === true,
    minBalanceGraceDays: num(row.minBalanceGraceDays),
    minBalancePenaltyPercent: num(row.minBalancePenaltyPercent),
    minBalancePenaltyAmount: num(row.minBalancePenaltyAmount),
    inactiveAfterMonths: num(row.inactiveAfterMonths, 3),
    dormantAfterMonths: num(row.dormantAfterMonths, 6),
    closureAllowed: row.closureAllowed !== false,
    closureFee: num(row.closureFee),
    openingFee: num(row.openingFee),
    monthlyMaintenanceFee: num(row.monthlyMaintenanceFee),
    chequeEnabled: row.chequeEnabled === true,
    chequeDefaultLeaves: num(row.chequeDefaultLeaves, 25),
    chequeMaxBooks: num(row.chequeMaxBooks, 1),
    chequeValidityDays: num(row.chequeValidityDays, 90),
    glLiabilityAccountId: row.glLiabilityAccountId ?? '',
    glInterestExpenseAccountId: row.glInterestExpenseAccountId ?? '',
    glInterestPayableAccountId: row.glInterestPayableAccountId ?? '',
    glFeeIncomeAccountId: row.glFeeIncomeAccountId ?? '',
    glPenaltyIncomeAccountId: row.glPenaltyIncomeAccountId ?? '',
    glChequeIncomeAccountId: row.glChequeIncomeAccountId ?? '',
  });

  const openCreate = () => {
    ensureRefs();
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (row: SavingProductRow) => {
    ensureRefs();
    setEditingId(row.id);
    setForm(rowToForm(row));
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
  };

  const handleFieldChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
    }
  };

  const toggle = (field: keyof FormState) => () => handleFieldChange(field, form[field] !== true);

  // ---------------------------------------------------------------------------
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.code.trim()) errors.code = 'Code is required';
    else if (form.code.trim().length > 20) errors.code = 'Code max 20 characters';
    if (!form.name.trim()) errors.name = 'Name is required';
    else if (form.name.trim().length > 100) errors.name = 'Name max 100 characters';
    if (form.interestRate < 0) errors.interestRate = 'Interest rate must be ≥ 0';
    if (form.minDeposit < 0) errors.minDeposit = 'Min deposit must be ≥ 0';
    if (form.minBalance < 0) errors.minBalance = 'Min balance must be ≥ 0';
    if (form.maxDeposit !== '' && num(form.maxDeposit) <= 0) errors.maxDeposit = 'Max deposit must be positive';
    if (['fixed', 'recurring'].includes(form.productType) && (form.tenureMonths === '' || num(form.tenureMonths) <= 0)) {
      errors.tenureMonths = 'Tenure months is required for fixed/recurring products';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        nameNepali: form.nameNepali.trim() || null,
        description: form.description.trim() || null,
        isActive: form.isActive,
        sortOrder: num(form.sortOrder),
        productType: form.productType,
        productCategory: form.productCategory.trim().toUpperCase() || null,
        accountNoPrefix: form.accountNoPrefix.trim().toUpperCase().slice(0, 10) || 'SAV',
        interestRate: num(form.interestRate),
        interestPostingFrequency: form.interestPostingFrequency,
        interestCalculationMethod: form.interestCalculationMethod,
        minBalance: num(form.minBalance),
        minDeposit: num(form.minDeposit),
        maxDeposit: form.maxDeposit !== '' ? num(form.maxDeposit) : null,
        tenureMonths: form.tenureMonths !== '' ? num(form.tenureMonths) : null,
        penaltyRate: num(form.penaltyRate),
        minAge: form.minAge !== '' ? num(form.minAge) : null,
        maxAge: form.maxAge !== '' ? num(form.maxAge) : null,
        requiresKycVerified: form.requiresKycVerified,
        requiresNominee: form.requiresNominee,
        requiresPhoto: form.requiresPhoto,
        requiresSignature: form.requiresSignature,
        requiresDocuments: form.requiresDocuments,
        openingDepositRequired: form.openingDepositRequired,
        eligibleMemberTypeIds: form.eligibleMemberTypeIds,
        backdateDepositAllowed: form.backdateDepositAllowed,
        depositRequiresApproval: form.depositRequiresApproval,
        withdrawalRequiresApproval: form.withdrawalRequiresApproval,
        minBalanceGraceDays: num(form.minBalanceGraceDays),
        minBalancePenaltyPercent: num(form.minBalancePenaltyPercent),
        minBalancePenaltyAmount: num(form.minBalancePenaltyAmount),
        inactiveAfterMonths: num(form.inactiveAfterMonths, 3),
        dormantAfterMonths: num(form.dormantAfterMonths, 6),
        closureAllowed: form.closureAllowed,
        closureFee: num(form.closureFee),
        openingFee: num(form.openingFee),
        monthlyMaintenanceFee: num(form.monthlyMaintenanceFee),
        chequeEnabled: form.chequeEnabled,
        chequeDefaultLeaves: num(form.chequeDefaultLeaves, 25),
        chequeMaxBooks: num(form.chequeMaxBooks, 1),
        chequeValidityDays: num(form.chequeValidityDays, 90),
        glLiabilityAccountId: form.glLiabilityAccountId || null,
        glInterestExpenseAccountId: form.glInterestExpenseAccountId || null,
        glInterestPayableAccountId: form.glInterestPayableAccountId || null,
        glFeeIncomeAccountId: form.glFeeIncomeAccountId || null,
        glPenaltyIncomeAccountId: form.glPenaltyIncomeAccountId || null,
        glChequeIncomeAccountId: form.glChequeIncomeAccountId || null,
      };

      if (editingId) {
        await apiClient.put(`/savings-settings/${entityType}/${editingId}`, payload);
      } else {
        await apiClient.post(`/savings-settings/${entityType}`, payload);
      }
      toast.showSuccess(editingId ? `${META.label} updated successfully.` : `${META.label} created successfully.`);
      closeModal();
      fetchRows();
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Save failed';
      toast.showError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await apiClient.delete(`/savings-settings/${entityType}/${id}`);
      toast.showSuccess(`${META.label} deleted.`);
      setDeletingId(null);
      fetchRows();
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Delete failed';
      toast.showError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleSetDefault = async () => {
    setSettingDefault(true);
    try {
      await apiClient.put('/savings/settings/default-product', {
        defaultSavingProductId: defaultProductId || null,
      });
      setDefaultProductName(rows.find((r) => r.id === defaultProductId)?.name ?? '');
      toast.showSuccess(defaultProductId ? 'Default savings product set.' : 'Default savings product cleared.');
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Failed to update default savings product';
      toast.showError(msg);
    } finally {
      setSettingDefault(false);
    }
  };

  const handleCancelChequeBook = async (id: string) => {
    setCancellingBookId(id);
    try {
      await apiClient.post(`/savings-settings/cheque-books/${id}/cancel`);
      toast.showSuccess('Cheque book cancelled.');
      fetchChequeBooks();
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Cancel failed';
      toast.showError(msg);
    } finally {
      setCancellingBookId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Renderers
  // ---------------------------------------------------------------------------
  const fieldCls = 'w-full bg-slate-50 border placeholder-slate-400 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-none focus:border-emerald-500 transition';
  const errCls = (key: string) => (formErrors[key] ? 'border-rose-400' : 'border-slate-200 ');
  const fieldBlock = (label: string, key: string, children: React.ReactNode, hint?: string) => (
    <div>
      <label className="block text-slate-600 font-semibold mb-1">{label}</label>
      {children}
      {formErrors[key] && <p className="text-rose-500 mt-1">{formErrors[key]}</p>}
      {hint && !formErrors[key] && <p className="text-slate-500 mt-1 text-[10px]">{hint}</p>}
    </div>
  );
  const toggleField = (ctx: MasterDataFormConfigCtx, field: string, label: string) => (
    <div className="flex items-end">
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => ctx.onChange(field, ctx.values[field] !== true)}
          className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${ctx.values[field] !== false ? 'bg-emerald-500' : 'bg-slate-300 '}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${ ctx.values[field] !== false ? 'translate-x-5' : 'translate-x-0' }`}
          />
        </div>
        <span className="font-semibold text-slate-700">{label}</span>
      </label>
    </div>
  );

  const groupTitle = (t: string) => (
    <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wide mt-1">{t}</p>
  );

  const renderConfig = (ctx: MasterDataFormConfigCtx) => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fieldBlock('Product Type', 'productType', (
          <select value={String(ctx.values.productType)} onChange={(e) => ctx.onChange('productType', e.target.value)} className={`${fieldCls} ${errCls('productType')}`}>
            {Object.entries(SAVING_PRODUCT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        ))}
        {fieldBlock('Category', 'productCategory', (
          <input type="text" value={String(ctx.values.productCategory ?? '')} onChange={(e) => ctx.onChange('productCategory', e.target.value)} className={`${fieldCls} ${errCls('productCategory')}`} placeholder="e.g. GENERAL" />
        ))}
        {fieldBlock('Account No Prefix', 'accountNoPrefix', (
          <input type="text" value={String(ctx.values.accountNoPrefix ?? 'SAV')} onChange={(e) => ctx.onChange('accountNoPrefix', e.target.value)} maxLength={10} className={`${fieldCls} ${errCls('accountNoPrefix')}`} />
        ))}
        {fieldBlock('Interest Rate (%)', 'interestRate', (
          <input type="number" min={0} step={0.01} value={String(ctx.values.interestRate ?? 0)} onChange={(e) => ctx.onChange('interestRate', e.target.value)} className={`${fieldCls} ${errCls('interestRate')}`} />
        ), 'Changing the rate records a new closed+open pair in the rate history.')}
        {fieldBlock('Posting Frequency', 'interestPostingFrequency', (
          <select value={String(ctx.values.interestPostingFrequency ?? 'Monthly')} onChange={(e) => ctx.onChange('interestPostingFrequency', e.target.value)} className={`${fieldCls} ${errCls('interestPostingFrequency')}`}>
            {Object.entries(SAVING_POSTING_FREQUENCY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        ))}
        {fieldBlock('Interest Calculation', 'interestCalculationMethod', (
          <select value={String(ctx.values.interestCalculationMethod ?? 'min_monthly_balance')} onChange={(e) => ctx.onChange('interestCalculationMethod', e.target.value)} className={`${fieldCls} ${errCls('interestCalculationMethod')}`}>
            {Object.entries(SAVING_INTEREST_METHOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        ))}
      </div>

      <div className="border-t border-slate-100 pt-3 space-y-3">
        {groupTitle('Amount Bounds')}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fieldBlock('Min Balance (NPR)', 'minBalance', (
            <input type="number" min={0} step={0.01} value={String(ctx.values.minBalance ?? 0)} onChange={(e) => ctx.onChange('minBalance', e.target.value)} className={`${fieldCls} ${errCls('minBalance')}`} />
          ))}
          {fieldBlock('Min Deposit (NPR)', 'minDeposit', (
            <input type="number" min={0} step={0.01} value={String(ctx.values.minDeposit ?? 0)} onChange={(e) => ctx.onChange('minDeposit', e.target.value)} className={`${fieldCls} ${errCls('minDeposit')}`} />
          ), 'Used as the auto-opening deposit when "Opening deposit required" is on.')}
          {fieldBlock('Max Deposit (NPR)', 'maxDeposit', (
            <input type="number" min={0} step={0.01} value={String(ctx.values.maxDeposit ?? '')} onChange={(e) => ctx.onChange('maxDeposit', e.target.value)} className={`${fieldCls} ${errCls('maxDeposit')}`} placeholder="Unlimited" />
          ))}
          {fieldBlock('Tenure (Months)', 'tenureMonths', (
            <input type="number" min={1} step={1} value={String(ctx.values.tenureMonths ?? '')} onChange={(e) => ctx.onChange('tenureMonths', e.target.value)} className={`${fieldCls} ${errCls('tenureMonths')}`} placeholder="Required for fixed/recurring" />
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3 space-y-3">
        {groupTitle('Opening')}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {toggleField(ctx, 'openingDepositRequired', 'Opening deposit required')}
          {toggleField(ctx, 'backdateDepositAllowed', 'Backdate deposits allowed')}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3 space-y-3">
        {groupTitle('Eligibility & KYC')}
        {fieldBlock('Eligible Member Types', 'eligibleMemberTypeIds', (
          <select multiple value={ctx.values.eligibleMemberTypeIds ?? []} onChange={(e) => ctx.onChange('eligibleMemberTypeIds', Array.from(e.target.selectedOptions).map((o) => o.value))} className={`${fieldCls} h-24 ${errCls('eligibleMemberTypeIds')}`}>
            {memberTypeOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
            ))}
          </select>
        ), 'Empty = open to all member types.')}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {toggleField(ctx, 'requiresKycVerified', 'KYC verified')}
          {toggleField(ctx, 'requiresNominee', 'Nominee required')}
          {toggleField(ctx, 'requiresPhoto', 'Photo required')}
          {toggleField(ctx, 'requiresSignature', 'Signature required')}
          {toggleField(ctx, 'requiresDocuments', 'Documents required')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fieldBlock('Min Age', 'minAge', (
            <input type="number" min={0} step={1} value={String(ctx.values.minAge ?? '')} onChange={(e) => ctx.onChange('minAge', e.target.value)} className={`${fieldCls} ${errCls('minAge')}`} placeholder="Any" />
          ))}
          {fieldBlock('Max Age', 'maxAge', (
            <input type="number" min={0} step={1} value={String(ctx.values.maxAge ?? '')} onChange={(e) => ctx.onChange('maxAge', e.target.value)} className={`${fieldCls} ${errCls('maxAge')}`} placeholder="Any" />
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3 space-y-3">
        {groupTitle('Withdrawals & Penalty')}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {toggleField(ctx, 'withdrawalRequiresApproval', 'Withdrawal requires approval')}
          {toggleField(ctx, 'depositRequiresApproval', 'Deposit requires approval')}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fieldBlock('Min Balance Grace Days', 'minBalanceGraceDays', (
            <input type="number" min={0} step={1} value={String(ctx.values.minBalanceGraceDays ?? 0)} onChange={(e) => ctx.onChange('minBalanceGraceDays', e.target.value)} className={`${fieldCls} ${errCls('minBalanceGraceDays')}`} />
          ))}
          {fieldBlock('Min Balance Penalty (%)', 'minBalancePenaltyPercent', (
            <input type="number" min={0} step={0.01} value={String(ctx.values.minBalancePenaltyPercent ?? 0)} onChange={(e) => ctx.onChange('minBalancePenaltyPercent', e.target.value)} className={`${fieldCls} ${errCls('minBalancePenaltyPercent')}`} />
          ))}
          {fieldBlock('Min Balance Penalty Amount (NPR)', 'minBalancePenaltyAmount', (
            <input type="number" min={0} step={0.01} value={String(ctx.values.minBalancePenaltyAmount ?? 0)} onChange={(e) => ctx.onChange('minBalancePenaltyAmount', e.target.value)} className={`${fieldCls} ${errCls('minBalancePenaltyAmount')}`} />
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3 space-y-3">
        {groupTitle('Dormancy & Closure')}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {fieldBlock('Inactive After (Months)', 'inactiveAfterMonths', (
            <input type="number" min={0} step={1} value={String(ctx.values.inactiveAfterMonths ?? 3)} onChange={(e) => ctx.onChange('inactiveAfterMonths', e.target.value)} className={`${fieldCls} ${errCls('inactiveAfterMonths')}`} />
          ))}
          {fieldBlock('Dormant After (Months)', 'dormantAfterMonths', (
            <input type="number" min={0} step={1} value={String(ctx.values.dormantAfterMonths ?? 6)} onChange={(e) => ctx.onChange('dormantAfterMonths', e.target.value)} className={`${fieldCls} ${errCls('dormantAfterMonths')}`} />
          ))}
          {fieldBlock('Closure Fee (NPR)', 'closureFee', (
            <input type="number" min={0} step={0.01} value={String(ctx.values.closureFee ?? 0)} onChange={(e) => ctx.onChange('closureFee', e.target.value)} className={`${fieldCls} ${errCls('closureFee')}`} />
          ))}
        </div>
        {toggleField(ctx, 'closureAllowed', 'Closure allowed')}
      </div>

      <div className="border-t border-slate-100 pt-3 space-y-3">
        {groupTitle('Charges & Fees (NPR)')}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {fieldBlock('Opening Fee', 'openingFee', (
            <input type="number" min={0} step={0.01} value={String(ctx.values.openingFee ?? 0)} onChange={(e) => ctx.onChange('openingFee', e.target.value)} className={`${fieldCls} ${errCls('openingFee')}`} />
          ))}
          {fieldBlock('Monthly Maintenance Fee', 'monthlyMaintenanceFee', (
            <input type="number" min={0} step={0.01} value={String(ctx.values.monthlyMaintenanceFee ?? 0)} onChange={(e) => ctx.onChange('monthlyMaintenanceFee', e.target.value)} className={`${fieldCls} ${errCls('monthlyMaintenanceFee')}`} />
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3 space-y-3">
        {groupTitle('Cheque Facility')}
        {toggleField(ctx, 'chequeEnabled', 'Enable cheques')}
      {ctx.values.chequeEnabled === true && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {fieldBlock('Default Leaves / Book', 'chequeDefaultLeaves', (
              <input type="number" min={1} step={1} value={String(ctx.values.chequeDefaultLeaves ?? 25)} onChange={(e) => ctx.onChange('chequeDefaultLeaves', e.target.value)} className={`${fieldCls} ${errCls('chequeDefaultLeaves')}`} />
            ))}
            {fieldBlock('Max Books / Account', 'chequeMaxBooks', (
              <input type="number" min={1} step={1} value={String(ctx.values.chequeMaxBooks ?? 1)} onChange={(e) => ctx.onChange('chequeMaxBooks', e.target.value)} className={`${fieldCls} ${errCls('chequeMaxBooks')}`} />
            ))}
            {fieldBlock('Validity (Days)', 'chequeValidityDays', (
              <input type="number" min={1} max={730} step={1} value={String(ctx.values.chequeValidityDays ?? 90)} onChange={(e) => ctx.onChange('chequeValidityDays', e.target.value)} className={`${fieldCls} ${errCls('chequeValidityDays')}`} />
            ), 'How many days a cheque is valid from its date. Confirm the regulatory figure with Som before changing from the default (90).') }
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-3 space-y-3">
        {groupTitle('Accounting (GL) Mapping')}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fieldBlock('Savings Liability Account', 'glLiabilityAccountId', (
            <select value={String(ctx.values.glLiabilityAccountId ?? '')} onChange={(e) => ctx.onChange('glLiabilityAccountId', e.target.value)} className={`${fieldCls} ${errCls('glLiabilityAccountId')}`}>
              <option value="">— None —</option>
              {coaOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          ))}
          {fieldBlock('Interest Expense Account', 'glInterestExpenseAccountId', (
            <select value={String(ctx.values.glInterestExpenseAccountId ?? '')} onChange={(e) => ctx.onChange('glInterestExpenseAccountId', e.target.value)} className={`${fieldCls} ${errCls('glInterestExpenseAccountId')}`}>
              <option value="">— None —</option>
              {coaOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          ))}
          {fieldBlock('Interest Payable Account', 'glInterestPayableAccountId', (
            <select value={String(ctx.values.glInterestPayableAccountId ?? '')} onChange={(e) => ctx.onChange('glInterestPayableAccountId', e.target.value)} className={`${fieldCls} ${errCls('glInterestPayableAccountId')}`}>
              <option value="">— None —</option>
              {coaOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          ))}
          {fieldBlock('Fee Income Account', 'glFeeIncomeAccountId', (
            <select value={String(ctx.values.glFeeIncomeAccountId ?? '')} onChange={(e) => ctx.onChange('glFeeIncomeAccountId', e.target.value)} className={`${fieldCls} ${errCls('glFeeIncomeAccountId')}`}>
              <option value="">— None —</option>
              {coaOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          ))}
          {fieldBlock('Penalty Income Account', 'glPenaltyIncomeAccountId', (
            <select value={String(ctx.values.glPenaltyIncomeAccountId ?? '')} onChange={(e) => ctx.onChange('glPenaltyIncomeAccountId', e.target.value)} className={`${fieldCls} ${errCls('glPenaltyIncomeAccountId')}`}>
              <option value="">— None —</option>
              {coaOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          ))}
          {fieldBlock('Cheque Income Account', 'glChequeIncomeAccountId', (
            <select value={String(ctx.values.glChequeIncomeAccountId ?? '')} onChange={(e) => ctx.onChange('glChequeIncomeAccountId', e.target.value)} className={`${fieldCls} ${errCls('glChequeIncomeAccountId')}`}>
              <option value="">— None —</option>
              {coaOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          ))}
        </div>
      </div>
    </div>
  );

  const statusPill = (active: boolean) => (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ active ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300' }`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );

  const money = (n: number | null | undefined): string =>
    n == null ? '—' : `रु. ${num(n).toLocaleString()}`;

  const moneyMaybe = (n: number | null | undefined): string =>
    n == null || n === 0 ? '—' : `रु. ${num(n).toLocaleString()}`;

  const productCell = (row: SavingProductRow) => (
    <div>
      <span className="font-mono text-emerald-600 font-bold">{row.code}</span>
      {defaultProductId === row.id && (
        <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-300">
          DEFAULT
        </span>
      )}
      <div className="font-semibold text-slate-800">{row.name}</div>
      <div className="text-slate-400 text-[10px]">{SAVING_PRODUCT_TYPE_LABELS[row.productType ?? 'regular'] ?? row.productType}</div>
    </div>
  );

  type AspectColumn = { header: string; align?: 'right'; cell: (row: SavingProductRow) => React.ReactNode };

  const renderAspectTable = (columns: AspectColumn[], emptyMsg: string) => (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm text-xs">
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
          <AlertTriangle className="w-8 h-8" />
          <p className="font-semibold">{emptyMsg}</p>
          <p className="text-xs">Click "+ Add {META.label}" to create one.</p>
        </div>
      ) : (
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase">
            <tr>
              {columns.map((c) => (
                <th key={c.header} className={`p-3 ${c.align === 'right' ? 'text-right' : ''}`}>{c.header}</th>
              ))}
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 transition">
                {columns.map((c) => (
                  <td key={c.header} className={`p-3 ${c.align === 'right' ? 'text-right' : ''}`}>{c.cell(row)}</td>
                ))}
                <td className="p-3 text-right">
                  <button
                    onClick={() => openEdit(row)}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-emerald-700 transition cursor-pointer"
                    title={`Edit ${META.label}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const AspectSection = ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
          <p className="text-slate-500 text-xs mt-0.5">{description}</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add {META.label}
        </button>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Saving Account Products / Saving Schemes — product CRUD */}
      {(section === 'setup_savings_products' || section === 'setup_savings_schemes') && (
        <AspectSection title={SECTION_META[section].title} description={SECTION_META[section].description}>
          <AdminSetupSearchFilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder={`Search ${META.labelPlural.toLowerCase()} by code or name…`}
            filterGroups={[
              {
                id: 'active',
                label: 'Status',
                value: activeFilter,
                options: [
                  { label: 'All', value: 'all' },
                  { label: 'Active', value: 'active' },
                  { label: 'Inactive', value: 'inactive' },
                ],
                onChange: (v) => setActiveFilter(v as any),
              },
            ]}
            quickStats={[
              { label: META.labelPlural, value: total, color: 'text-emerald-700' },
            ]}
          />

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm text-xs">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading {META.labelPlural.toLowerCase()}…
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
                <AlertTriangle className="w-8 h-8" />
                <p className="font-semibold">No {META.labelPlural.toLowerCase()} found.</p>
                <p className="text-xs">Click "+ Add {META.label}" to create one.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase">
                  <tr>
                    <th className="p-3">Code</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Rate</th>
                    <th className="p-3">Min Deposit</th>
                    <th className="p-3">Cheque</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono text-emerald-600 font-bold">
                        {row.code}
                        {defaultProductId === row.id && (
                          <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-300">
                            DEFAULT
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-slate-800">
                        {row.name}
                        {row.isSystem && (
                          <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                            SYSTEM
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">{SAVING_PRODUCT_TYPE_LABELS[row.productType ?? 'regular'] ?? row.productType}</td>
                      <td className="p-3 font-mono text-emerald-700 font-semibold">{num(row.interestRate)}%</td>
                      <td className="p-3 font-mono text-slate-600">रु. {num(row.minDeposit).toLocaleString()}</td>
                      <td className="p-3">{row.chequeEnabled === true ? 'Yes' : 'No'}</td>
                      <td className="p-3">{statusPill(row.isActive)}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(row)}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-emerald-700 transition cursor-pointer"
                            title={`Edit ${META.label}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {!row.isSystem && (
                            <button
                              onClick={() => setDeletingId(row.id)}
                              className="p-1.5 rounded-lg text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                              title={`Delete ${META.label}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </AspectSection>
      )}

      {/* Interest & Rate Rules */}
      {section === 'setup_savings_interest' && (
        <AspectSection title={SECTION_META.setup_savings_interest.title} description={SECTION_META.setup_savings_interest.description}>
          {renderAspectTable([
            { header: 'Product', cell: productCell },
            { header: 'Rate', cell: (r) => <span className="font-mono text-emerald-700 font-semibold">{num(r.interestRate)}%</span> },
            { header: 'Posting Frequency', cell: (r) => SAVING_POSTING_FREQUENCY_LABELS[r.interestPostingFrequency ?? 'Monthly'] ?? r.interestPostingFrequency },
            { header: 'Calculation Method', cell: (r) => SAVING_INTEREST_METHOD_LABELS[r.interestCalculationMethod ?? 'min_monthly_balance'] ?? r.interestCalculationMethod },
            { header: 'Rate History', cell: (r) => (Array.isArray(r.rateHistory) && r.rateHistory.length ? `${r.rateHistory.length} record${r.rateHistory.length > 1 ? 's' : ''}` : '—') },
          ], 'No savings products found.')}
        </AspectSection>
      )}

      {/* Charges & Fees */}
      {section === 'setup_savings_charges' && (
        <AspectSection title={SECTION_META.setup_savings_charges.title} description={SECTION_META.setup_savings_charges.description}>
          {renderAspectTable([
            { header: 'Product', cell: productCell },
            { header: 'Opening Fee', align: 'right', cell: (r) => moneyMaybe(r.openingFee) },
            { header: 'Maintenance / Mo', align: 'right', cell: (r) => moneyMaybe(r.monthlyMaintenanceFee) },
            { header: 'Withdrawal Fee', align: 'right', cell: (r) => moneyMaybe(r.withdrawalFee) },
            { header: 'Closure Fee', align: 'right', cell: (r) => moneyMaybe(r.closureFee) },
          ], 'No savings products found.')}
        </AspectSection>
      )}

      {/* Account Rules */}
      {section === 'setup_savings_rules' && (
        <AspectSection title={SECTION_META.setup_savings_rules.title} description={SECTION_META.setup_savings_rules.description}>
          {renderAspectTable([
            { header: 'Product', cell: productCell },
            { header: 'Min Balance', align: 'right', cell: (r) => money(r.minBalance) },
            { header: 'Min / Max Deposit', align: 'right', cell: (r) => `${money(r.minDeposit)} / ${r.maxDeposit != null ? money(r.maxDeposit) : '∞'}` },
            { header: 'Deposit Limit (Day / Mo)', align: 'right', cell: (r) => `${moneyMaybe(r.dailyDepositLimit)} / ${moneyMaybe(r.monthlyDepositLimit)}` },
            { header: 'Min / Max Withdrawal', align: 'right', cell: (r) => `${moneyMaybe(r.minWithdrawal)} / ${moneyMaybe(r.maxWithdrawal)}` },
            { header: 'Inactive → Dormant', cell: (r) => `${num(r.inactiveAfterMonths, 3)}m → ${num(r.dormantAfterMonths, 6)}m` },
            { header: 'Approvals', cell: (r) => [r.depositRequiresApproval ? 'Deposit' : null, r.withdrawalRequiresApproval ? 'Withdrawal' : null].filter(Boolean).join(', ') || '—' },
          ], 'No savings products found.')}
        </AspectSection>
      )}

      {/* Cheque Settings */}
      {section === 'setup_savings_cheque' && (
        <ChequeSettingsView onNavigateToProducts={() => {
          // Virtual tab navigation to setup_savings_products if available
        }} />
      )}


      {/* Cheque Book Settings */}
      {section === 'setup_savings_cheque_books' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">{SECTION_META.setup_savings_cheque_books.title}</h3>
              <p className="text-slate-500 text-xs mt-0.5">{SECTION_META.setup_savings_cheque_books.description}</p>
            </div>
            <button
              onClick={fetchChequeBooks}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer border border-slate-200"
            >
              {chequeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Refresh
            </button>
          </div>
          <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
            {chequeBooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-500">
                <BookOpen className="w-7 h-7" />
                <p className="font-semibold text-xs">No cheque books issued yet.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase">
                  <tr>
                    <th className="p-3">Book No</th>
                    <th className="p-3">Account</th>
                    <th className="p-3">Leaves</th>
                    <th className="p-3">Issue Date (BS)</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {chequeBooks.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono text-emerald-600 font-bold">{b.bookNo}</td>
                      <td className="p-3 font-mono text-slate-600">{b.accountNo}</td>
                      <td className="p-3 font-mono text-slate-600">{b.leafCount}</td>
                      <td className="p-3 font-mono text-slate-600">{b.issueDateBs}</td>
                      <td className="p-3">{statusPill(b.status !== 'Cancelled')}</td>
                      <td className="p-3 text-right">
                        {b.status !== 'Cancelled' && (
                          <button
                            onClick={() => handleCancelChequeBook(b.id)}
                            disabled={cancellingBookId === b.id}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer disabled:opacity-50"
                            title="Cancel cheque book"
                          >
                            {cancellingBookId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                          </button>
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

      {/* Account Product Defaults */}
      {section === 'setup_savings_defaults' && (
        <div className="space-y-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">{SECTION_META.setup_savings_defaults.title}</h3>
            <p className="text-slate-500 text-xs mt-0.5">{SECTION_META.setup_savings_defaults.description}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                <p className="text-xs text-slate-600 font-semibold">
                  Default Savings Product — used to auto-open a member's savings account with the
                  opening deposit (from <span className="font-mono">min_deposit</span>) at registration.
                  Only active products of this organization can be selected.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={defaultProductId}
                  onChange={(e) => {
                    setDefaultProductId(e.target.value);
                    setDefaultProductName(rows.find((r) => r.id === e.target.value)?.name ?? '');
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">— No default —</option>
                  {rows.filter((r) => r.isActive).map((r) => (
                    <option key={r.id} value={r.id}>{r.code} — {r.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleSetDefault}
                  disabled={settingDefault}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm"
                >
                  {settingDefault && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {defaultProductName ? 'Update Default' : 'Set Default'}
                </button>
              </div>
            </div>
            {defaultProductName && (
              <p className="text-xs text-slate-500">
                Current default: <span className="font-bold text-emerald-700">{defaultProductName}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* MasterDataFormModal for product config */}
      <MasterDataFormModal
        open={modalOpen}
        mode={editingId ? 'edit' : 'create'}
        icon={<PiggyBank className="w-5 h-5 text-emerald-600" />}
        title={editingId ? `Edit ${META.label}` : `Add ${META.label}`}
        description={META.description}
        configSectionLabel="Product Configuration"
        values={form as any}
        errors={formErrors}
        onChange={handleFieldChange}
        onSave={handleSave}
        onClose={closeModal}
        saving={saving}
        renderConfig={renderConfig}
      />

      {/* Delete confirmation overlay */}
      {deletingId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Delete {META.label}?</h3>
                <p className="text-slate-500 mt-1">
                  This will permanently remove this product configuration. Products already used by
                  savings accounts cannot be deleted.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={() => setDeletingId(null)} disabled={deleting} className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};