/**
 * SetupLoanSettingsView — SETUPS → Loan Settings (Module 6)
 *
 * Five sub-pages driven by `activeSubKey`:
 *   setup_loan_products    → Loan Products catalog (rate, method, category,
 *                            tenure/amount bounds, eligibility, rate history,
 *                            per-product guarantor rules)
 *   setup_loan_categories  → Loan Categories catalog (flat FK catalog)
 *   setup_repay_freq       → EMI Schedule Settings (singular org setting +
 *                            live schedule preview via the 5-method engine)
 *   setup_security_types   → Collateral / Security Types catalog
 *   setup_guarantor_types  → Guarantor Type Management (configurable catalog
 *                            seeded from the DB, NOT hardcoded) plus the
 *                            org-wide guarantor defaults as a fallback
 *
 * All catalogs use the shared MasterDataFormModal so every list shares the
 * standardized form layout; loan-products adds a type-specific CONFIGURATION
 * section (interest, tenure, eligibility, guarantor rules). Organization id
 * is derived server-side from the JWT — never sent from the client.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, AlertTriangle, Info, CalendarClock,
  UserRound, Users, ShieldCheck, Handshake, TrendingUp, Landmark,
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../../context/ToastContext';
import { AdminSetupSearchFilterBar } from '../common/AdminSetupSearchFilterBar';
import { MasterDataFormModal, type MasterDataFormConfigCtx } from './MasterDataFormModal';
import {
  fetchLoanSettings,
  fetchGuarantorSettings,
  fetchEmiScheduleSettings,
  LOAN_INTEREST_METHOD_LABELS,
  type LoanSettingsEntityType,
  type LoanProduct,
  type GuarantorSettings,
  type EmiScheduleSettings,
} from '../../api/loanSettings';
import { generateLoanSchedule, type LoanScheduleResult } from '../../utils/financialEngine';
import { getTodayBS } from '../../utils/nepaliCalendar';

interface Props {
  activeSubKey?: string;
}

const INTEREST_METHODS = ['flat', 'diminishing_emi', 'diminishing_principal', 'daily_reducing', 'bullet'];

const fmtNpr = (v: number): string =>
  'रु. ' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const fmtPct = (v: number): string => `${Number(v || 0).toFixed(2)}%`;

// ---------------------------------------------------------------------------
// Catalog list page (loan-products / loan-categories / collateral-types)
// ---------------------------------------------------------------------------
interface CatalogRow {
  id: string;
  code: string;
  name: string;
  nameNepali?: string | null;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  isSystem: boolean;
  usageCount: number;
  interestRate?: number;
  interestMethod?: string;
  categoryName?: string | null;
  minAmount?: number;
  maxAmount?: number;
  minTenureMonths?: number;
  maxTenureMonths?: number;
  penaltyRate?: number;
  processingFeePercent?: number;
  minMembershipMonths?: number;
  minShareAmount?: number;
  requireActiveSavings?: boolean;
  minSavingsBalance?: number;
  requireVerifiedKyc?: boolean;
  allowEligibilityOverride?: boolean;
  eligibleMemberTypeIds?: string[];
  eligibleMemberCategoryIds?: string[];
  rateHistory?: { id: string; rate: number; effectiveFromBs: string; effectiveToBs: string | null }[];
  guarantorRules?: { guarantorTypeId: string; code: string; name: string; minCount: number; maxCount: number | null; coveragePercent: number }[];
  valuationRequired?: boolean;
}

const CATALOG_META: Record<LoanSettingsEntityType, { label: string; labelPlural: string; description: string; icon: React.ReactNode }> = {
  'loan-products': {
    label: 'Loan Product',
    labelPlural: 'Loan Products',
    description: 'Define loan products with interest rate, method, tenure bounds and eligibility.',
    icon: <TrendingUp className="w-5 h-5 text-emerald-600" />,
  },
  'loan-categories': {
    label: 'Loan Category',
    labelPlural: 'Loan Categories',
    description: 'Group loan products into categories used for product classification and reporting.',
    icon: <Landmark className="w-5 h-5 text-emerald-600" />,
  },
  'collateral-types': {
    label: 'Collateral Type',
    labelPlural: 'Collateral / Security Types',
    description: 'Security types accepted against loans (land, building, gold, shares, FD, etc.).',
    icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
  },
  'guarantor-types': {
    label: 'Guarantor Type',
    labelPlural: 'Guarantor Types',
    description: 'Configurable guarantor categories (member, staff, institution, etc.) permitted on loans. Seeded from the database, fully editable.',
    icon: <Handshake className="w-5 h-5 text-emerald-600" />,
  },
};

interface CatalogProps {
  entityType: LoanSettingsEntityType;
}

export const LoanCatalogPage: React.FC<CatalogProps> = ({ entityType }) => {
  const toast = useToast();
  const meta = CATALOG_META[entityType];

  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Lookups for product form
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [memberTypes, setMemberTypes] = useState<{ id: string; name: string }[]>([]);
  const [memberCategories, setMemberCategories] = useState<{ id: string; name: string }[]>([]);
  const [guarantorTypes, setGuarantorTypes] = useState<{ id: string; name: string }[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const emptyForm = (): Record<string, any> =>
    entityType === 'loan-products'
      ? {
          code: '', name: '', nameNepali: '', description: '',
          isActive: true, sortOrder: 0,
          categoryId: '', interestRate: '12', interestMethod: 'diminishing_emi',
          minAmount: '0', maxAmount: '0', minTenureMonths: 1, maxTenureMonths: 12,
          penaltyRate: '0', processingFeePercent: '0',
          minMembershipMonths: 0, minShareAmount: '0',
          requireActiveSavings: false, minSavingsBalance: '0',
          requireVerifiedKyc: true, allowEligibilityOverride: false,
          eligibleMemberTypeIds: [] as string[], eligibleMemberCategoryIds: [] as string[],
          guarantorRules: [] as any[],
        }
      : {
          code: '', name: '', nameNepali: '', description: '',
          isActive: true, sortOrder: 0,
          valuationRequired: true,
        };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchLoanSettings(entityType);
      let filtered = rows;
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        filtered = rows.filter(
          (r: any) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
        );
      }
      if (activeFilter !== 'all') {
        filtered = filtered.filter((r: any) => (activeFilter === 'active' ? r.isActive : !r.isActive));
      }
      setRows(filtered);
    } catch (err: any) {
      toast.showError(err?.response?.data?.error ?? err.message, 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [entityType, searchTerm, activeFilter, toast]);

  useEffect(() => {
    setRows([]);
    setSearchTerm('');
    setActiveFilter('all');
  }, [entityType]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // Load product lookups once
  useEffect(() => {
    if (entityType !== 'loan-products') return;
    apiClient.get('/loan-settings/loan-categories').then((res) => {
      setCategories(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
    apiClient.get('/member-settings/member-types').then((res) => {
      setMemberTypes(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
    apiClient.get('/member-settings/member-categories').then((res) => {
      setMemberCategories(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
    apiClient.get('/loan-settings/guarantor-types').then((res) => {
      setGuarantorTypes(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
  }, [entityType]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (row: CatalogRow) => {
    setEditingId(row.id);
    setForm({
      code: row.code, name: row.name, nameNepali: row.nameNepali ?? '', description: row.description ?? '',
      isActive: row.isActive, sortOrder: row.sortOrder,
      ...(entityType === 'loan-products'
        ? {
            categoryId: row.categoryName ? (categories.find((c) => c.name === row.categoryName)?.id ?? '') : '',
            interestRate: String(row.interestRate ?? ''),
            interestMethod: row.interestMethod ?? 'diminishing_emi',
            minAmount: String(row.minAmount ?? ''),
            maxAmount: String(row.maxAmount ?? ''),
            minTenureMonths: row.minTenureMonths ?? 1,
            maxTenureMonths: row.maxTenureMonths ?? 12,
            penaltyRate: String(row.penaltyRate ?? ''),
            processingFeePercent: String(row.processingFeePercent ?? ''),
            minMembershipMonths: row.minMembershipMonths ?? 0,
            minShareAmount: String(row.minShareAmount ?? ''),
            requireActiveSavings: !!row.requireActiveSavings,
            minSavingsBalance: String(row.minSavingsBalance ?? ''),
            requireVerifiedKyc: row.requireVerifiedKyc !== false,
            allowEligibilityOverride: !!row.allowEligibilityOverride,
            eligibleMemberTypeIds: row.eligibleMemberTypeIds ?? [],
            eligibleMemberCategoryIds: row.eligibleMemberCategoryIds ?? [],
            guarantorRules: (row as any).guarantorRules ?? [],
          }
        : { valuationRequired: row.valuationRequired !== false }),
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    setFormErrors({});
  };

  const handleFieldChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!String(form.code ?? '').trim()) errors.code = 'Code is required';
    if (!String(form.name ?? '').trim()) errors.name = 'Name is required';
    if (entityType === 'loan-products') {
      if (Number(form.maxAmount) > 0 && Number(form.minAmount) > Number(form.maxAmount)) {
        errors.minAmount = 'Min amount cannot exceed max amount';
      }
      if (Number(form.maxTenureMonths) > 0 && Number(form.minTenureMonths) > Number(form.maxTenureMonths)) {
        errors.minTenureMonths = 'Min tenure cannot exceed max tenure';
      }
      if (Number(form.interestRate) < 0) errors.interestRate = 'Rate must be ≥ 0';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        code: String(form.code ?? '').trim(),
        name: String(form.name ?? '').trim(),
        nameNepali: String(form.nameNepali ?? '').trim() || null,
        description: String(form.description ?? '').trim() || null,
        isActive: form.isActive !== false,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (entityType === 'collateral-types') {
        payload.valuationRequired = form.valuationRequired !== false;
      }
      if (entityType === 'loan-products') {
        payload.categoryId = form.categoryId || null;
        payload.interestRate = Number(form.interestRate) || 0;
        payload.interestMethod = form.interestMethod;
        payload.minAmount = Number(form.minAmount) || 0;
        payload.maxAmount = Number(form.maxAmount) || 0;
        payload.minTenureMonths = Number(form.minTenureMonths) || 1;
        payload.maxTenureMonths = Number(form.maxTenureMonths) || 1;
        payload.penaltyRate = Number(form.penaltyRate) || 0;
        payload.processingFeePercent = Number(form.processingFeePercent) || 0;
        payload.minMembershipMonths = Number(form.minMembershipMonths) || 0;
        payload.minShareAmount = Number(form.minShareAmount) || 0;
        payload.requireActiveSavings = form.requireActiveSavings === true;
        payload.minSavingsBalance = Number(form.minSavingsBalance) || 0;
        payload.requireVerifiedKyc = form.requireVerifiedKyc !== false;
        payload.allowEligibilityOverride = form.allowEligibilityOverride === true;
        payload.eligibleMemberTypeIds = Array.isArray(form.eligibleMemberTypeIds) ? form.eligibleMemberTypeIds : [];
        payload.eligibleMemberCategoryIds = Array.isArray(form.eligibleMemberCategoryIds) ? form.eligibleMemberCategoryIds : [];
        payload.guarantorRules = Array.isArray(form.guarantorRules)
          ? (form.guarantorRules as any[]).map((r) => ({
              guarantorTypeId: r.guarantorTypeId,
              minCount: Number(r.minCount) || 1,
              maxCount: r.maxCount === null || r.maxCount === '' || r.maxCount === undefined ? null : Number(r.maxCount) || 0,
              coveragePercent: Number(r.coveragePercent) || 0,
            }))
          : [];
      }

      if (editingId) {
        await apiClient.put(`/loan-settings/${entityType}/${editingId}`, payload);
        toast.showSuccess(`${meta.label} updated successfully.`);
      } else {
        await apiClient.post(`/loan-settings/${entityType}`, payload);
        toast.showSuccess(`${meta.label} created successfully.`);
      }
      closeModal();
      fetchRows();
    } catch (err: any) {
      toast.showError(err?.response?.data?.error ?? err.message, 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await apiClient.delete(`/loan-settings/${entityType}/${id}`);
      toast.showSuccess(`${meta.label} deleted.`);
      setDeletingId(null);
      fetchRows();
    } catch (err: any) {
      toast.showError(err?.response?.data?.error ?? err.message, 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const fieldCls = 'w-full bg-slate-50 border placeholder-slate-400 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-none focus:border-emerald-500 transition';
  const errCls = (key: string) => (formErrors[key] ? 'border-rose-400' : 'border-slate-200 ');

  const renderProductConfig = (ctx: MasterDataFormConfigCtx) => {
    const toggleElig = (key: string, id: string) => {
      const arr = Array.isArray(ctx.values[key]) ? ctx.values[key] : [];
      ctx.onChange(key, arr.includes(id) ? arr.filter((x: string) => x !== id) : [...arr, id]);
    };
    const toggleGuarantorType = (c: MasterDataFormConfigCtx, typeId: string) => {
      const rules = Array.isArray(c.values.guarantorRules) ? c.values.guarantorRules : [];
      const next = rules.some((r: any) => r.guarantorTypeId === typeId)
        ? rules.filter((r: any) => r.guarantorTypeId !== typeId)
        : [...rules, { guarantorTypeId: typeId, minCount: 1, maxCount: null, coveragePercent: 100 }];
      c.onChange('guarantorRules', next);
    };
    const patchGuarantorRule = (c: MasterDataFormConfigCtx, typeId: string, patch: Record<string, any>) => {
      const rules = Array.isArray(c.values.guarantorRules) ? c.values.guarantorRules : [];
      c.onChange('guarantorRules', rules.map((r: any) => (r.guarantorTypeId === typeId ? { ...r, ...patch } : r)));
    };
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Category</label>
            <select
              value={String(ctx.values.categoryId ?? '')}
              onChange={(e) => ctx.onChange('categoryId', e.target.value)}
              className={`${fieldCls} ${errCls('categoryId')}`}
            >
              <option value="">— General / None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Interest Method</label>
            <select
              value={String(ctx.values.interestMethod ?? 'diminishing_emi')}
              onChange={(e) => ctx.onChange('interestMethod', e.target.value)}
              className={`${fieldCls} ${errCls('interestMethod')}`}
            >
              {INTEREST_METHODS.map((m) => (
                <option key={m} value={m}>{LOAN_INTEREST_METHOD_LABELS[m]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Interest Rate (%)</label>
            <input type="number" min={0} step={0.01}
              value={String(ctx.values.interestRate ?? '')}
              onChange={(e) => ctx.onChange('interestRate', e.target.value)}
              className={`${fieldCls} ${errCls('interestRate')}`} />
            {formErrors.interestRate && <p className="text-rose-500 mt-1">{formErrors.interestRate}</p>}
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Penalty Rate (%)</label>
            <input type="number" min={0} step={0.01}
              value={String(ctx.values.penaltyRate ?? '')}
              onChange={(e) => ctx.onChange('penaltyRate', e.target.value)}
              className={`${fieldCls} ${errCls('penaltyRate')}`} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Min Amount (NPR)</label>
            <input type="number" min={0} step={100}
              value={String(ctx.values.minAmount ?? '')}
              onChange={(e) => ctx.onChange('minAmount', e.target.value)}
              className={`${fieldCls} ${errCls('minAmount')}`} />
            {formErrors.minAmount && <p className="text-rose-500 mt-1">{formErrors.minAmount}</p>}
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Max Amount (NPR)</label>
            <input type="number" min={0} step={100}
              value={String(ctx.values.maxAmount ?? '')}
              onChange={(e) => ctx.onChange('maxAmount', e.target.value)}
              className={`${fieldCls} ${errCls('maxAmount')}`} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Min Tenure (months)</label>
            <input type="number" min={1}
              value={String(ctx.values.minTenureMonths ?? 1)}
              onChange={(e) => ctx.onChange('minTenureMonths', parseInt(e.target.value, 10) || 1)}
              className={`${fieldCls} ${errCls('minTenureMonths')}`} />
            {formErrors.minTenureMonths && <p className="text-rose-500 mt-1">{formErrors.minTenureMonths}</p>}
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Max Tenure (months)</label>
            <input type="number" min={1}
              value={String(ctx.values.maxTenureMonths ?? 1)}
              onChange={(e) => ctx.onChange('maxTenureMonths', parseInt(e.target.value, 10) || 1)}
              className={`${fieldCls} ${errCls('maxTenureMonths')}`} />
          </div>
        </div>

        <div>
          <label className="block text-slate-600 font-semibold mb-1">Processing Fee (%)</label>
          <input type="number" min={0} step={0.01}
            value={String(ctx.values.processingFeePercent ?? '')}
            onChange={(e) => ctx.onChange('processingFeePercent', e.target.value)}
            className={`${fieldCls} ${errCls('processingFeePercent')}`} />
        </div>

        <div className="border-t border-slate-200 pt-3">
          <label className="block text-slate-700 font-bold text-sm mb-1">Eligibility Gate (Member Lifecycle)</label>
          <p className="text-[10px] text-slate-500 mb-2">
            Criteria enforced at loan origination. A value of 0 or unchecked disables the rule.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Min Membership Duration (months)</label>
              <input type="number" min={0}
                value={String(ctx.values.minMembershipMonths ?? 0)}
                onChange={(e) => ctx.onChange('minMembershipMonths', parseInt(e.target.value, 10) || 0)}
                className={`${fieldCls} ${errCls('minMembershipMonths')}`} />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Min Share Capital (NPR)</label>
              <input type="number" min={0} step={100}
                value={String(ctx.values.minShareAmount ?? '')}
                onChange={(e) => ctx.onChange('minShareAmount', e.target.value)}
                className={`${fieldCls} ${errCls('minShareAmount')}`} />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Min Savings Balance (NPR) — active accounts</label>
              <input type="number" min={0} step={100}
                value={String(ctx.values.minSavingsBalance ?? '')}
                onChange={(e) => ctx.onChange('minSavingsBalance', e.target.value)}
                className={`${fieldCls} ${errCls('minSavingsBalance')}`} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
              <input type="checkbox"
                checked={ctx.values.requireActiveSavings === true}
                onChange={(e) => ctx.onChange('requireActiveSavings', e.target.checked)}
                className="accent-emerald-600" />
              Require Active Savings Account
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
              <input type="checkbox"
                checked={ctx.values.requireVerifiedKyc !== false}
                onChange={(e) => ctx.onChange('requireVerifiedKyc', e.target.checked)}
                className="accent-emerald-600" />
              Require Verified KYC
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
              <input type="checkbox"
                checked={ctx.values.allowEligibilityOverride === true}
                onChange={(e) => ctx.onChange('allowEligibilityOverride', e.target.checked)}
                className="accent-emerald-600" />
              Allow Credit-Committee Override
            </label>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            When override is allowed, org admins &amp; managers may approve an ineligible member with a written reason.
          </p>
        </div>

        <div>
          <label className="block text-slate-600 font-semibold mb-1">Eligible Member Types</label>
          <div className="flex flex-wrap gap-2">
            {memberTypes.map((t) => {
              const on = (ctx.values.eligibleMemberTypeIds ?? []).includes(t.id);
              return (
                <button type="button" key={t.id} onClick={() => toggleElig('eligibleMemberTypeIds', t.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${ on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-600 ' }`}>
                  {t.name}
                </button>
              );
            })}
            {memberTypes.length === 0 && <span className="text-xs text-slate-500">No member types defined.</span>}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Leave empty to allow all member types.</p>
        </div>

        <div>
          <label className="block text-slate-600 font-semibold mb-1">Eligible Member Categories</label>
          <div className="flex flex-wrap gap-2">
            {memberCategories.map((c) => {
              const on = (ctx.values.eligibleMemberCategoryIds ?? []).includes(c.id);
              return (
                <button type="button" key={c.id} onClick={() => toggleElig('eligibleMemberCategoryIds', c.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${ on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-600 ' }`}>
                  {c.name}
                </button>
              );
            })}
            {memberCategories.length === 0 && <span className="text-xs text-slate-500">No member categories defined.</span>}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Leave empty to allow all member categories.</p>
        </div>

        <div className="border-t border-slate-200 pt-3">
          <label className="block text-slate-600 font-semibold mb-1">Permitted Guarantor Types</label>
          <div className="flex flex-wrap gap-2">
            {guarantorTypes.map((t) => {
              const on = (ctx.values.guarantorRules ?? []).some((r: any) => r.guarantorTypeId === t.id);
              return (
                <button type="button" key={t.id} onClick={() => toggleGuarantorType(ctx, t.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${ on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-600 ' }`}>
                  {t.name}
                </button>
              );
            })}
            {guarantorTypes.length === 0 && <span className="text-xs text-slate-500">No guarantor types defined. Add them in Guarantor Types first.</span>}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Only permitted types may act as guarantors for this product. Leave empty to fall back to the org-wide guarantor defaults.
          </p>
        </div>

        {(ctx.values.guarantorRules ?? []).length > 0 && (
          <div className="space-y-2">
            <label className="block text-slate-600 font-semibold">Guarantor Type Rules</label>
            {(ctx.values.guarantorRules ?? []).map((r: any) => {
              const t = guarantorTypes.find((g) => g.id === r.guarantorTypeId);
              return (
                <div key={r.guarantorTypeId} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/50 /40">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">{t?.name ?? r.guarantorTypeId}</span>
                    <button type="button" onClick={() => toggleGuarantorType(ctx, r.guarantorTypeId)}
                      className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer transition">Remove</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-slate-500 font-semibold mb-1 text-[10px]">Min Count</label>
                      <input type="number" min={0}
                        value={String(r.minCount ?? 1)}
                        onChange={(e) => patchGuarantorRule(ctx, r.guarantorTypeId, { minCount: parseInt(e.target.value, 10) || 0 })}
                        className={fieldCls} />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-semibold mb-1 text-[10px]">Max Count</label>
                      <input type="number" min={0} placeholder="Unlimited"
                        value={r.maxCount === null || r.maxCount === undefined ? '' : String(r.maxCount)}
                        onChange={(e) => patchGuarantorRule(ctx, r.guarantorTypeId, { maxCount: e.target.value === '' ? null : parseInt(e.target.value, 10) || 0 })}
                        className={fieldCls} />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-semibold mb-1 text-[10px]">Coverage (%)</label>
                      <input type="number" min={0} max={100} step={1}
                        value={String(r.coveragePercent ?? 0)}
                        onChange={(e) => patchGuarantorRule(ctx, r.guarantorTypeId, { coveragePercent: Number(e.target.value) || 0 })}
                        className={fieldCls} />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500">Collective coverage of this type against the loan amount. 100 = fully covered by this type.</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderRateHistory = (row: CatalogRow) => {
    if (entityType !== 'loan-products') return null;
    const history = row.rateHistory ?? [];
    return (
      <td className="p-3">
        {history.length === 0 ? (
          <span className="text-slate-500">—</span>
        ) : (
          <span className="text-[10px] font-mono text-slate-500">
            {history.map((h) => `${h.rate}% (${h.effectiveFromBs}${h.effectiveToBs ? '→' + h.effectiveToBs : '→now'})`).join(' · ')}
          </span>
        )}
      </td>
    );
  };

  return (
    <div className="space-y-4">
      <AdminSetupSearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={`Search ${meta.labelPlural.toLowerCase()} by code or name…`}
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
        quickStats={[{ label: meta.labelPlural, value: rows.length, color: 'text-emerald-700 ' }]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">{meta.labelPlural}</h3>
          <p className="text-slate-500 text-xs mt-0.5">{meta.description}</p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm">
          <Plus className="w-4 h-4" /> Add {meta.label}
        </button>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm text-xs">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading {meta.labelPlural.toLowerCase()}…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
            <AlertTriangle className="w-8 h-8" />
            <p className="font-semibold">No {meta.labelPlural.toLowerCase()} found.</p>
            <p className="text-xs">Click "+ Add {meta.label}" to create one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3">Name</th>
                  {entityType === 'loan-products' && <th className="p-3">Category</th>}
                  {entityType === 'loan-products' && <th className="p-3">Rate</th>}
                  {entityType === 'loan-products' && <th className="p-3">Method</th>}
                  {entityType === 'loan-products' && <th className="p-3">Amount Range</th>}
                  {entityType === 'loan-products' && <th className="p-3">Tenure</th>}
                  {entityType === 'collateral-types' && <th className="p-3">Valuation</th>}
                  <th className="p-3">Status</th>
                  <th className="p-3">Usage</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 /50 transition">
                    <td className="p-3 font-mono text-emerald-600 font-bold">{row.code}</td>
                    <td className="p-3 font-semibold text-slate-800">
                      {row.name}
                      {row.isSystem && (
                        <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">SYSTEM</span>
                      )}
                    </td>
                    {entityType === 'loan-products' && (
                      <>
                        <td className="p-3">{row.categoryName || '—'}</td>
                        <td className="p-3 font-mono text-emerald-700 font-semibold">{fmtPct(row.interestRate ?? 0)}</td>
                        <td className="p-3 text-slate-500">{LOAN_INTEREST_METHOD_LABELS[row.interestMethod ?? 'diminishing_emi']}</td>
                        <td className="p-3 font-mono text-slate-600">
                          {fmtNpr(row.minAmount ?? 0)} – {fmtNpr(row.maxAmount ?? 0)}
                        </td>
                        <td className="p-3 font-mono text-slate-600">
                          {(row.minTenureMonths ?? 0) === (row.maxTenureMonths ?? 0) ? `${row.minTenureMonths} mo` : `${row.minTenureMonths}–${row.maxTenureMonths} mo`}
                        </td>
                      </>
                    )}
                    {entityType === 'collateral-types' && (
                      <td className="p-3">
                        {row.valuationRequired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 /20 text-sky-700 border border-sky-200 /30">Required</span>
                        ) : (
                          <span className="text-slate-500">Not required</span>
                        )}
                      </td>
                    )}
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ row.isActive ? 'bg-emerald-100 /20 text-emerald-700 border-emerald-300 /30' : 'bg-slate-100 text-slate-500 border-slate-300 ' }`}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3">
                      {row.usageCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 /20 text-sky-700 border border-sky-200 /30">
                          {row.usageCount}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(row)}
                          className="text-emerald-600 hover:underline font-bold flex items-center gap-1 cursor-pointer" title="Edit">
                          <Pencil className="w-3.5 h-3.5" /> Edit →
                        </button>
                        <button onClick={() => setDeletingId(row.id)}
                          disabled={row.usageCount > 0 || row.isSystem}
                          title={row.usageCount > 0 ? `In use by ${row.usageCount} record(s)` : row.isSystem ? 'System record' : 'Delete'}
                          className={`flex items-center gap-1 font-bold transition ${ row.usageCount > 0 || row.isSystem ? 'text-slate-600 cursor-not-allowed' : 'text-rose-500 hover:text-rose-700 cursor-pointer' }`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MasterDataFormModal
        open={modalOpen}
        mode={editingId ? 'edit' : 'create'}
        icon={meta.icon}
        title={editingId ? `Edit ${meta.label}` : `Add ${meta.label}`}
        description={meta.description}
        configSectionLabel={entityType === 'loan-products' ? 'Interest, Amount & Eligibility' : 'Configuration'}
        values={form}
        errors={formErrors}
        onChange={handleFieldChange}
        onSave={handleSave}
        onClose={closeModal}
        saving={saving}
        saveLabel={editingId ? 'Save Changes' : `Create ${meta.label}`}
        renderConfig={entityType === 'loan-products' ? renderProductConfig : undefined}
      />

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm">
            <div className="px-6 py-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 /20 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Confirm Delete</h3>
                  <p className="text-slate-500 text-xs mt-0.5">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                Are you sure you want to delete this {meta.label.toLowerCase()}?
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setDeletingId(null)} disabled={deleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
              <button onClick={() => handleDelete(deletingId)} disabled={deleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer">
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// EMI Schedule Settings (singular org setting + live preview)
// ---------------------------------------------------------------------------
interface WorkingDayRow { dayOfWeek: number; isWorkingDay: boolean; }

export const EmiScheduleSettingsPanel: React.FC = () => {
  const toast = useToast();
  const [settings, setSettings] = useState<EmiScheduleSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingDays, setWorkingDays] = useState<WorkingDayRow[]>([]);

  // Live preview inputs
  const [previewAmount, setPreviewAmount] = useState('500000');
  const [previewTenure, setPreviewTenure] = useState('12');
  const [previewRate, setPreviewRate] = useState('12');
  const [previewMethod, setPreviewMethod] = useState('diminishing_emi');
  const [schedule, setSchedule] = useState<LoanScheduleResult | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [s, wd] = await Promise.all([
      fetchEmiScheduleSettings(),
      apiClient.get('/working-days').then((r) => (Array.isArray(r.data) ? r.data : [])).catch(() => []),
    ]);
    setSettings(s);
    setWorkingDays(wd as WorkingDayRow[]);
    if (s) setPreviewMethod(s.defaultInterestMethod);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Recompute the live schedule whenever inputs change.
  useEffect(() => {
    if (!settings) return;
    const principal = Number(previewAmount);
    const tenure = Number(previewTenure);
    const rate = Number(previewRate);
    if (!principal || !tenure || rate < 0) {
      setSchedule(null);
      return;
    }
    const wdIndices = workingDays.filter((d) => d.isWorkingDay).map((d) => d.dayOfWeek);
    try {
      const result = generateLoanSchedule({
        principal,
        annualRatePct: rate,
        tenureMonths: tenure,
        method: previewMethod as any,
        startDateBs: getTodayBS(),
        installmentDayOfMonth: settings.installmentDayOfMonth,
        dayCount: settings.dayCountConvention,
        rounding: settings.roundingMode,
        workingDayIndices: wdIndices.length > 0 ? wdIndices : undefined,
        shiftToWorkingDay: settings.shiftToWorkingDay,
      });
      setSchedule(result);
    } catch {
      setSchedule(null);
    }
  }, [settings, previewAmount, previewTenure, previewRate, previewMethod, workingDays]);

  const update = (patch: Partial<EmiScheduleSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...patch });
  };

  const toggleMethod = (method: string) => {
    if (!settings) return;
    const enabled = settings.enabledMethods.includes(method);
    const next = enabled
      ? settings.enabledMethods.filter((m) => m !== method)
      : [...settings.enabledMethods, method];
    update({ enabledMethods: next });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await apiClient.put('/loan-settings/emi-schedule-settings', settings);
      toast.showSuccess('EMI schedule settings saved.');
      fetchAll();
    } catch (err: any) {
      toast.showError(err?.response?.data?.error ?? err.message, 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = 'w-full bg-slate-50 border placeholder-slate-400 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-none focus:border-emerald-500 transition';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading EMI schedule settings…
      </div>
    );
  }
  if (!settings) {
    return <p className="text-slate-500 text-xs">Unable to load EMI schedule settings.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-sky-50 /20 border border-sky-200 /40 rounded-xl p-4 text-xs text-sky-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          <strong>EMI Schedule Settings</strong> control how the loan engine builds repayment schedules.
          The five interest methods are computed by the built-in engine; due dates shift forward to the
          next working day from Module 1 (Working Days) when enabled.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Settings form */}
        <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-5 space-y-4 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-2">Enabled Interest Methods</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {INTEREST_METHODS.map((m) => {
                const on = settings.enabledMethods.includes(m);
                return (
                  <button key={m} type="button" onClick={() => toggleMethod(m)}
                    className={`px-3 py-2 rounded-xl text-left border transition cursor-pointer ${ on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-600 ' }`}>
                    <span className="font-bold">{LOAN_INTEREST_METHOD_LABELS[m]}</span>
                  </button>
                );
              })}
            </div>
            {settings.enabledMethods.length === 0 && (
              <p className="text-rose-500 mt-1">At least one method must be enabled.</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Default Interest Method</label>
              <select
                value={settings.defaultInterestMethod}
                onChange={(e) => update({ defaultInterestMethod: e.target.value })}
                className={fieldCls}
              >
                {INTEREST_METHODS.map((m) => (
                  <option key={m} value={m}>{LOAN_INTEREST_METHOD_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Day Count Convention</label>
              <select
                value={settings.dayCountConvention}
                onChange={(e) => update({ dayCountConvention: e.target.value === '360' ? '360' : '365' })}
                className={fieldCls}
              >
                <option value="365">365 days</option>
                <option value="360">360 days (banking)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Installment Day of Month</label>
              <input
                type="number" min={1} max={31}
                value={settings.installmentDayOfMonth}
                onChange={(e) => update({ installmentDayOfMonth: parseInt(e.target.value, 10) || 1 })}
                className={fieldCls}
              />
              <p className="text-[10px] text-slate-500 mt-1">Clamped to the BS month length.</p>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Rounding Mode</label>
              <select
                value={settings.roundingMode}
                onChange={(e) => update({ roundingMode: e.target.value as any })}
                className={fieldCls}
              >
                <option value="round">Round (nearest paisa)</option>
                <option value="floor">Floor</option>
                <option value="ceil">Ceil</option>
              </select>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.shiftToWorkingDay}
              onChange={(e) => update({ shiftToWorkingDay: e.target.checked })}
              className="mt-0.5 w-4 h-4 accent-emerald-600"
            />
            <span>
              <span className="font-bold text-slate-700">Shift due date to next working day</span>
              <span className="block text-[10px] text-slate-500 mt-0.5">
                Working days are configured in Module 1 (SETUPS → Working Days).
                {workingDays.filter((d) => d.isWorkingDay).length > 0 && (
                  <> Currently {workingDays.filter((d) => d.isWorkingDay).length} working day(s) per week.</>
                )}
              </span>
            </span>
          </label>

          <div className="pt-2 flex justify-end">
            <button onClick={handleSave} disabled={saving || settings.enabledMethods.length === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? 'Saving…' : 'Save EMI Schedule Settings'}
            </button>
          </div>
        </div>

        {/* Live preview */}
        <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-5 space-y-3 text-xs">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-emerald-600" />
            <h4 className="font-bold text-slate-800">Live Schedule Preview</h4>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-500 font-semibold mb-1 text-[10px]">Principal (NPR)</label>
              <input type="number" min={0} value={previewAmount} onChange={(e) => setPreviewAmount(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1 text-[10px]">Tenure (months)</label>
              <input type="number" min={1} value={previewTenure} onChange={(e) => setPreviewTenure(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1 text-[10px]">Rate (% p.a.)</label>
              <input type="number" min={0} step={0.01} value={previewRate} onChange={(e) => setPreviewRate(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1 text-[10px]">Method</label>
              <select value={previewMethod} onChange={(e) => setPreviewMethod(e.target.value)} className={fieldCls}>
                {INTEREST_METHODS.map((m) => (
                  <option key={m} value={m}>{LOAN_INTEREST_METHOD_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>

          {schedule ? (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50 /10 rounded-xl p-2 text-center">
                  <p className="text-[10px] text-slate-500">Monthly / 1st EMI</p>
                  <p className="font-bold text-emerald-700">{fmtNpr(schedule.monthlyPayment)}</p>
                </div>
                <div className="bg-sky-50 /10 rounded-xl p-2 text-center">
                  <p className="text-[10px] text-slate-500">Total Interest</p>
                  <p className="font-bold text-sky-700">{fmtNpr(schedule.totalInterest)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-2 text-center">
                  <p className="text-[10px] text-slate-500">Total Payment</p>
                  <p className="font-bold text-slate-700">{fmtNpr(schedule.totalPayment)}</p>
                </div>
              </div>
              <div className="border border-slate-100 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Due (BS)</th>
                      <th className="p-2 text-right">Principal</th>
                      <th className="p-2 text-right">Interest</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schedule.installments.slice(0, 24).map((i) => (
                      <tr key={i.installmentNo}>
                        <td className="p-2 font-mono">{i.installmentNo}</td>
                        <td className="p-2 font-mono">{i.dueDateBs}</td>
                        <td className="p-2 font-mono text-right">{i.principal.toLocaleString('en-IN')}</td>
                        <td className="p-2 font-mono text-right">{i.interest.toLocaleString('en-IN')}</td>
                        <td className="p-2 font-mono text-right font-bold">{i.totalEmi.toLocaleString('en-IN')}</td>
                        <td className="p-2 font-mono text-right">{i.balancePrincipal.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {schedule.installments.length > 24 && (
                <p className="text-[10px] text-slate-500">Showing first 24 of {schedule.installments.length} installments.</p>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-xs py-6 text-center">Enter a valid principal, tenure and rate to preview.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Guarantor Settings (singular org setting — used as the org-wide default
// fallback for Loan Products that do not define per-type guarantor rules)
// ---------------------------------------------------------------------------
export const GuarantorSettingsPanel: React.FC = () => {
  const toast = useToast();
  const [settings, setSettings] = useState<GuarantorSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchGuarantorSettings().then((s) => { setSettings(s); setLoading(false); });
  }, []);

  const update = (patch: Partial<GuarantorSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...patch });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await apiClient.put('/loan-settings/guarantor-settings', settings);
      toast.showSuccess('Guarantor settings saved.');
    } catch (err: any) {
      toast.showError(err?.response?.data?.error ?? err.message, 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = 'w-full bg-slate-50 border placeholder-slate-400 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-none focus:border-emerald-500 transition';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading guarantor settings…
      </div>
    );
  }
  if (!settings) {
    return <p className="text-slate-500 text-xs">Unable to load guarantor settings.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-amber-50 /20 border border-amber-200 /40 rounded-xl p-4 text-xs text-amber-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          <strong>Org-wide Guarantor Defaults</strong> define the minimum/maximum number of guarantors and
          the loan coverage percent they must collectively guarantee. These act as the <em>fallback</em> —
          a Loan Product that permits specific guarantor types (above) applies its per-type rules instead.
        </p>
      </div>

      <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-5 space-y-4 text-xs max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Min Guarantors</label>
            <input
              type="number" min={0}
              value={settings.minGuarantors}
              onChange={(e) => update({ minGuarantors: parseInt(e.target.value, 10) || 0 })}
              className={fieldCls}
            />
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Max Guarantors</label>
            <input
              type="number" min={0}
              value={settings.maxGuarantors ?? 0}
              onChange={(e) => update({ maxGuarantors: parseInt(e.target.value, 10) || 0 })}
              className={fieldCls}
            />
            {settings.maxGuarantors !== null && settings.maxGuarantors < settings.minGuarantors && (
              <p className="text-rose-500 mt-1">Max cannot be less than min.</p>
            )}
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Required Coverage (%)</label>
            <input
              type="number" min={0} max={100} step={1}
              value={settings.requiredCoveragePercent}
              onChange={(e) => update({ requiredCoveragePercent: Number(e.target.value) || 0 })}
              className={fieldCls}
            />
            {settings.requiredCoveragePercent < 0 || settings.requiredCoveragePercent > 100 ? (
              <p className="text-rose-500 mt-1">Coverage must be between 0 and 100.</p>
            ) : null}
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.allowMemberGuarantors}
            onChange={(e) => update({ allowMemberGuarantors: e.target.checked })}
            className="mt-0.5 w-4 h-4 accent-emerald-600"
          />
          <span>
            <span className="font-bold text-slate-700">Allow members of this cooperative as guarantors</span>
            <span className="block text-[10px] text-slate-500 mt-0.5">
              If enabled, existing members may guarantee loans for other members.
            </span>
          </span>
        </label>

        <div className="pt-2 flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Saving…' : 'Save Guarantor Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main dispatcher — 5 sub-pages
// ---------------------------------------------------------------------------
export const SetupLoanSettingsView: React.FC<Props> = ({ activeSubKey = 'setup_loan_products' }) => {
  switch (activeSubKey) {
    case 'setup_loan_categories':
      return <LoanCatalogPage entityType="loan-categories" />;
    case 'setup_security_types':
      return <LoanCatalogPage entityType="collateral-types" />;
    case 'setup_repay_freq':
      return <EmiScheduleSettingsPanel />;
    case 'setup_guarantor_types':
      return (
        <div className="space-y-8">
          <LoanCatalogPage entityType="guarantor-types" />
          <div className="border-t border-slate-200 pt-6">
            <GuarantorSettingsPanel />
          </div>
        </div>
      );
    case 'setup_loan_products':
    default:
      return <LoanCatalogPage entityType="loan-products" />;
  }
};

