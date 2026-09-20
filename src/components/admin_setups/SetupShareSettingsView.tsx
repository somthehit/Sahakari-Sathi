/**
 * SetupShareSettingsView
 * API-driven CRUD for the SETUPS → Share Settings module:
 *   share-types           (existing /shares/types product catalog)
 *   share-classes         (class designation lookup)
 *   share-schemes         (CANONICAL pricing / opening config + default scheme)
 *   dividend-rules        (withholding / target dividend / bonus parameters)
 *   certificate-formats   (printable certificate template config)
 *
 * Follows the same standardized structure as SetupMemberSettingsView
 * (AdminSetupSearchFilterBar + table + MasterDataFormModal).
 * No mock data — every row comes from the API.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, AlertTriangle, Info, Layers, Coins, PiggyBank, FileText, BadgePercent, PenTool, Save,
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../../context/ToastContext';
import { AdminSetupSearchFilterBar } from '../common/AdminSetupSearchFilterBar';
import { MasterDataFormModal, type MasterDataFormConfigCtx } from './MasterDataFormModal';
import { CertificateDesignerModal } from '../modals/CertificateDesignerModal';
import { fetchShareTypes, createShareType, updateShareType, deleteShareType, fetchOrgShareSettings, updateOrgShareSettings, OrganizationShareSettings } from '../../api/shares';
import { computeMaxAllowedKitta } from '../../api/services/shareCeilingEngine';
import { fetchCoa } from '../../api/accountingSettings';
import { fetchMemberSettings } from '../../api/memberSettings';

export type ShareSettingsEntityType =
  | 'share-types'
  | 'share-classes'
  | 'share-schemes'
  | 'dividend-rules'
  | 'certificate-formats'
  | 'org-settings';

interface ShareRow {
  id: string;
  code: string;
  name: string;
  nameNepali?: string | null;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  isSystem: boolean;
  usageCount?: number;
  // share-classes
  shareType?: string;
  targetMemberType?: string;
  parValue?: number;
  minKittaPerPurchase?: number;
  maxKittaPerMember?: number | null;
  glAccountId?: string | null;
  isDividendEligible?: boolean;
  maxDividendRatePct?: number | null;
  // share-types
  faceValue?: number;
  minShares?: number;
  maxShares?: number | null;
  isTransferable?: boolean;
  isPledgeable?: boolean;
  dividendRate?: number;
  kittaPrefix?: string;
  kittaStartBase?: number | null;
  currentKittaPointer?: number;
  maxAllowedKitta?: number | null;
  autoSequence?: boolean;
  status?: string;
  // share-schemes
  shareClassId?: string | null;
  shareTypeId?: string | null;
  shareValuePerUnit?: number;
  minOpenUnits?: number;
  maxUnits?: number | null;
  minOpeningAmount?: number;
  // dividend-rules
  taxWithholdingPercent?: number;
  targetDividendPercent?: number;
  bonusShareRatio?: string;
  dividendPolicy?: string;
  fiscalYear?: string;
  approvalStatus?: string;
  distributionMode?: string;
  minimumHoldingPeriodMonths?: number;
  // certificate-formats
  certificatePrefix?: string;
  startingNumber?: number;
  includeLogo?: boolean;
  headerText?: string;
  footerText?: string;
  fields?: string[];
  configJson?: any;
}

interface FormState {
  code: string;
  name: string;
  nameNepali: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  faceValue: number;
  minShares: number;
  maxShares: string;
  isTransferable: boolean;
  isPledgeable: boolean;
  dividendRate: number;
  kittaPrefix: string;
  kittaStartBase: string;
  currentKittaPointer: string;
  maxAllowedKitta: string;
  autoSequence: boolean;
  status: string;
  shareClassId: string;
  shareTypeId: string;
  shareValuePerUnit: number;
  minOpenUnits: number;
  maxUnits: string;
  minOpeningAmount: number;
  taxWithholdingPercent: number;
  targetDividendPercent: number;
  bonusShareRatio: string;
  dividendPolicy: string;
  fiscalYear: string;
  approvalStatus: string;
  distributionMode: string;
  minimumHoldingPeriodMonths: number;
  certificatePrefix: string;
  startingNumber: number;
  includeLogo: boolean;
  headerText: string;
  footerText: string;
  fields: string;
  // share-classes
  shareType: string;
  targetMemberType: string;
  parValue: string;
  minKittaPerPurchase: string;
  maxKittaPerMember: string;
  glAccountId: string;
  isDividendEligible: boolean;
  maxDividendRatePct: string;
}

interface EntityMeta {
  label: string;
  labelPlural: string;
  description: string;
  icon: React.ReactNode;
  endpoint: string;
}

interface Props {
  entityType: ShareSettingsEntityType;
}

const ENTITY_META: Record<ShareSettingsEntityType, EntityMeta> = {
  'share-types': {
    label: 'Share Type',
    labelPlural: 'Share Types',
    description: 'Share products with face value, transferability and dividend rate.',
    icon: <Coins className="w-5 h-5 text-emerald-600" />,
    endpoint: '/shares/types',
  },
  'share-classes': {
    label: 'Share Class',
    labelPlural: 'Share Classes',
    description: 'Class designations (Class A/B/P …) assigned to share schemes.',
    icon: <Layers className="w-5 h-5 text-emerald-600" />,
    endpoint: '/share-settings/share-classes',
  },
  'share-schemes': {
    label: 'Share Scheme',
    labelPlural: 'Share Schemes',
    description: 'Canonical pricing & opening configuration for member share accounts.',
    icon: <PiggyBank className="w-5 h-5 text-emerald-600" />,
    endpoint: '/share-settings/share-schemes',
  },
  'dividend-rules': {
    label: 'Dividend Rule',
    labelPlural: 'Dividend Rules',
    description: 'Withholding tax, target dividend and bonus share parameters.',
    icon: <BadgePercent className="w-5 h-5 text-emerald-600" />,
    endpoint: '/share-settings/dividend-rules',
  },
  'certificate-formats': {
    label: 'Share Certificate Format',
    labelPlural: 'Share Certificate Formats',
    description: 'Printable share certificate template configuration.',
    icon: <FileText className="w-5 h-5 text-emerald-600" />,
    endpoint: '/share-settings/certificate-formats',
  },
  'org-settings': {
    label: 'Org Share Settings',
    labelPlural: 'Org Share Settings',
    description: 'Organization-wide authorized share capital, kitta ceilings and face value.',
    icon: <Coins className="w-5 h-5 text-emerald-600" />,
    endpoint: '/shares/settings',
  },
};

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  nameNepali: '',
  description: '',
  isActive: true,
  sortOrder: 0,
  faceValue: 100,
  minShares: 1,
  maxShares: '',
  isTransferable: true,
  isPledgeable: true,
  dividendRate: 0,
  kittaPrefix: '',
  kittaStartBase: '',
  currentKittaPointer: '0',
  maxAllowedKitta: '',
  autoSequence: true,
  status: 'Active',
  shareClassId: '',
  shareTypeId: '',
  shareValuePerUnit: 100,
  minOpenUnits: 10,
  maxUnits: '',
  minOpeningAmount: 0,
  taxWithholdingPercent: 5,
  targetDividendPercent: 12.5,
  bonusShareRatio: '1:10',
  dividendPolicy: '',
  fiscalYear: '',
  approvalStatus: 'draft',
  distributionMode: 'cash',
  minimumHoldingPeriodMonths: 0,
  certificatePrefix: 'SC-',
  startingNumber: 1,
  includeLogo: true,
  headerText: '',
  footerText: '',
  fields: 'Member Name, Member No, Share Type, Face Value, Number of Shares',
  // share-classes
  shareType: 'ORDINARY',
  targetMemberType: 'ALL',
  parValue: '',
  minKittaPerPurchase: '1',
  maxKittaPerMember: '',
  glAccountId: '',
  isDividendEligible: true,
  maxDividendRatePct: '',
};

export const SetupShareSettingsView: React.FC<Props> = ({ entityType }) => {
  // COA accounts for share-class GL picker
  const [coaAccounts, setCoaAccounts] = useState<{ id: string; code: string; name: string }[]>([]);
  // Dynamic share type + member type options for share-class form
  const [shareTypeOptions, setShareTypeOptions] = useState<{ id: string; code: string; name: string; nameNp?: string | null }[]>([]);
  const [memberTypeOptions, setMemberTypeOptions] = useState<{ id: string; code: string; name: string; nameNp?: string | null }[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);
  const toast = useToast();
  const meta = ENTITY_META[entityType];

  const [rows, setRows] = useState<ShareRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Scheme reference options (share-schemes form)
  const [classOptions, setClassOptions] = useState<{ id: string; code: string; name: string }[]>([]);
  const [typeOptions, setTypeOptions] = useState<{ id: string; code: string; name: string }[]>([]);

  // Default scheme selector (share-schemes page)
  const [defaultSchemeId, setDefaultSchemeId] = useState<string>('');
  const [defaultSchemeName, setDefaultSchemeName] = useState<string>('');
  const [settingDefault, setSettingDefault] = useState(false);

  // Default certificate format selector (certificate-formats page)
  const [defaultCertFormatId, setDefaultCertFormatId] = useState<string>('');
  const [defaultCertFormatName, setDefaultCertFormatName] = useState<string>('');
  const [settingDefaultCert, setSettingDefaultCert] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Certificate format designer (design the full visual config for a format)
  const [designTarget, setDesignTarget] = useState<ShareRow | null>(null);

  const isScheme = entityType === 'share-schemes';
  const isShareType = entityType === 'share-types';
  const isOrgSettings = entityType === 'org-settings';

  // Org Share Settings (authorized ceilings + running totals)
  const [orgSettings, setOrgSettings] = useState<OrganizationShareSettings | null>(null);
  const [orgSettingsForm, setOrgSettingsForm] = useState({ authorizedCapitalCeiling: '', authorizedTotalKitta: '', defaultFaceValue: '', minRequiredKitta: '' });
  const [orgSettingsSaving, setOrgSettingsSaving] = useState(false);
  const [orgSettingsLoading, setOrgSettingsLoading] = useState(false);

  // ── Dynamic kitta pool (share-types) ───────────────────────────────
  // Sum of maxAllowedKitta committed to the OTHER types vs the org's
  // authorizedTotalKitta. Drives live validation + the disabled Save button.
  const kittaPool = useMemo(() => {
    if (!isShareType || !orgSettings) return null;
    const others = rows
      .filter((r) => r.id !== editingId)
      .map((r) => (r.maxAllowedKitta != null ? Number(r.maxAllowedKitta) : null));
    const current = rows.find((r) => r.id === editingId)?.maxAllowedKitta ?? null;
    return computeMaxAllowedKitta({
      authorizedTotalKitta: Number(orgSettings.authorizedTotalKitta),
      otherTypeCeilings: others,
      currentCeiling: current,
    });
  }, [isShareType, orgSettings, rows, editingId]);

  const inputMaxAllowedKitta = Number(form.maxAllowedKitta) || 0;
  const kittaPoolExceeded = !!kittaPool && inputMaxAllowedKitta > 0 && inputMaxAllowedKitta > kittaPool.allowedMax;
  // Block saving when the allocation is exceeded, or when creating a new type
  // while the pool is fully consumed (no headroom at all).
  const submitBlocked = isShareType && (kittaPoolExceeded || (!!kittaPool && kittaPool.availablePoolForType === 0 && !editingId));

  const loadOrgSettings = useCallback(async () => {
    setOrgSettingsLoading(true);
    try {
      const s = await fetchOrgShareSettings();
      setOrgSettings(s);
      if (s) {
        setOrgSettingsForm({
          authorizedCapitalCeiling: s.authorizedCapitalCeiling,
          authorizedTotalKitta: String(s.authorizedTotalKitta),
          defaultFaceValue: s.defaultFaceValue,
          minRequiredKitta: String(s.minRequiredKitta ?? 10),
        });
      }
    } catch (err: any) {
      toast.showError(err.response?.data?.error ?? err.message, 'Failed to load org share settings');
    } finally {
      setOrgSettingsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isOrgSettings || isShareType) loadOrgSettings();
  }, [isOrgSettings, isShareType, loadOrgSettings]);

  const saveOrgSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const cap = Number(orgSettingsForm.authorizedCapitalCeiling);
    const kitta = Number(orgSettingsForm.authorizedTotalKitta);
    const face = Number(orgSettingsForm.defaultFaceValue);
    const minKitta = Number(orgSettingsForm.minRequiredKitta);
    if (!cap || cap <= 0) return toast.showError('Authorized capital ceiling must be a positive amount', 'Invalid value');
    if (!kitta || !Number.isInteger(kitta) || kitta <= 0) return toast.showError('Authorized total kitta must be a positive integer', 'Invalid value');
    if (!face || face <= 0) return toast.showError('Default face value must be a positive amount', 'Invalid value');
    if (!minKitta || !Number.isInteger(minKitta) || minKitta <= 0) return toast.showError('Minimum required kitta must be a positive integer', 'Invalid value');
    setOrgSettingsSaving(true);
    try {
      const updated = await updateOrgShareSettings({ authorizedCapitalCeiling: cap, authorizedTotalKitta: kitta, defaultFaceValue: face, minRequiredKitta: minKitta });
      setOrgSettings(updated);
      setOrgSettingsForm({
        authorizedCapitalCeiling: updated.authorizedCapitalCeiling,
        authorizedTotalKitta: String(updated.authorizedTotalKitta),
        defaultFaceValue: updated.defaultFaceValue,
        minRequiredKitta: String(updated.minRequiredKitta ?? 10),
      });
      toast.showSuccess('Organization share ceilings updated', 'Saved');
    } catch (err: any) {
      toast.showError(err.response?.data?.error ?? err.message, 'Failed to update');
    } finally {
      setOrgSettingsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Fetch list
  // ---------------------------------------------------------------------------
  const fetchRows = useCallback(async () => {
    if (isOrgSettings) {
      setRows([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      let data: any[] = [];
      if (isShareType) {
        data = await fetchShareTypes();
      } else {
        const params: Record<string, string> = {};
        if (searchTerm.trim()) params.search = searchTerm.trim();
        if (activeFilter !== 'all') params.active = activeFilter === 'active' ? 'true' : 'false';
        const res = await apiClient.get(meta.endpoint, { params });
        data = Array.isArray(res.data) ? res.data : [];
      }
      setRows(data);
      setTotal(data.length);
    } catch (err: any) {
      toast.showError(err.response?.data?.error ?? err.message, 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [entityType, meta.endpoint, isShareType, searchTerm, activeFilter, toast]);

  // COA accounts (Equity / Share Capital only) + share types + member types for share-class form
  useEffect(() => {
    if (entityType !== 'share-classes') return;
    let active = true;
    (async () => {
      setLoadingDropdowns(true);
      try {
        const [coa, shareTypes, memberTypes] = await Promise.all([
          fetchCoa(),
          fetchShareTypes(),
          fetchMemberSettings('member-types', { active: 'true' }),
        ]);
        if (!active) return;
        // Filter COA to Equity accounts only (code starts with '3' or type === 'Equity')
        const equityAccounts = (coa?.accounts ?? [])
          .filter((a: any) => a.isActive !== false && (a.code?.startsWith('3') || a.type === 'Equity'))
          .sort((a: any, b: any) => a.code.localeCompare(b.code))
          .map((a: any) => ({ id: a.id, code: a.code, name: a.name }));
        setCoaAccounts(equityAccounts);
        // Dynamic share types from API
        const activeShareTypes = (Array.isArray(shareTypes) ? shareTypes : [])
          .filter((t: any) => t.status === 'Active')
          .map((t: any) => ({ id: t.id, code: t.code, name: t.name, nameNp: t.nameNp ?? null }));
        setShareTypeOptions(activeShareTypes);
        // Dynamic member types from API
        const activeMemberTypes = (Array.isArray(memberTypes) ? memberTypes : [])
          .filter((m: any) => m.isActive !== false)
          .map((m: any) => ({ id: m.id, code: m.code, name: m.name, nameNp: m.nameNepali ?? null }));
        setMemberTypeOptions(activeMemberTypes);
      } catch {
        // Non-fatal — dropdowns just stay empty.
      } finally {
        setLoadingDropdowns(false);
      }
    })();
    return () => { active = false; };
  }, [entityType]);

  // Reference options + default scheme for the schemes page
  useEffect(() => {
    if (entityType !== 'share-schemes') return;
    let active = true;
    (async () => {
      try {
        const [classes, types, def] = await Promise.all([
          apiClient.get('/share-settings/share-classes'),
          fetchShareTypes(),
          apiClient.get('/shares/settings/default-scheme'),
        ]);
        if (!active) return;
        setClassOptions((classes.data ?? []).map((c: any) => ({ id: c.id, code: c.code, name: c.name })));
        setTypeOptions((Array.isArray(types) ? types : []).map((t: any) => ({ id: t.id, code: t.code, name: t.name })));
        const d = def.data?.defaultShareSchemeId ?? '';
        setDefaultSchemeId(d);
        setDefaultSchemeName(def.data?.scheme?.name ?? '');
      } catch {
        // Non-fatal for the reference dropdowns.
      }
    })();
    return () => { active = false; };
  }, [entityType]);

  useEffect(() => {
    setRows([]);
    setSearchTerm('');
    setActiveFilter('all');
  }, [entityType]);

  // Default certificate format for the certificate-formats page
  useEffect(() => {
    if (entityType !== 'certificate-formats') return;
    let active = true;
    (async () => {
      try {
        const def = await apiClient.get('/shares/settings/default-certificate-format');
        if (!active) return;
        setDefaultCertFormatId(def.data?.defaultCertificateFormatId ?? '');
        setDefaultCertFormatName(def.data?.format?.name ?? '');
      } catch {
        // Non-fatal: default selector stays empty.
      }
    })();
    return () => { active = false; };
  }, [entityType]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // ---------------------------------------------------------------------------
  // Open modal helpers
  // ---------------------------------------------------------------------------
  const rowToForm = (row: ShareRow): FormState => ({
    code: row.code ?? '',
    name: row.name ?? '',
    nameNepali: row.nameNepali ?? '',
    description: row.description ?? '',
    isActive: row.isActive !== false,
    sortOrder: row.sortOrder ?? 0,
    faceValue: row.faceValue ?? 100,
    minShares: row.minShares ?? 1,
    maxShares: row.maxShares != null ? String(row.maxShares) : '',
    isTransferable: row.isTransferable !== false,
    isPledgeable: row.isPledgeable !== false,
    dividendRate: row.dividendRate ?? 0,
    kittaPrefix: row.kittaPrefix ?? '',
    kittaStartBase: row.kittaStartBase != null ? String(row.kittaStartBase) : '',
    currentKittaPointer: row.currentKittaPointer != null ? String(row.currentKittaPointer) : '0',
    maxAllowedKitta: row.maxAllowedKitta != null ? String(row.maxAllowedKitta) : '',
    autoSequence: row.autoSequence !== false,
    status: row.status ?? 'Active',
    shareClassId: row.shareClassId ?? '',
    shareTypeId: row.shareTypeId ?? '',
    shareValuePerUnit: row.shareValuePerUnit ?? 100,
    minOpenUnits: row.minOpenUnits ?? 10,
    maxUnits: row.maxUnits != null ? String(row.maxUnits) : '',
    minOpeningAmount: row.minOpeningAmount ?? 0,
    taxWithholdingPercent: row.taxWithholdingPercent ?? 5,
    targetDividendPercent: row.targetDividendPercent ?? 12.5,
    bonusShareRatio: row.bonusShareRatio ?? '1:10',
    dividendPolicy: row.dividendPolicy ?? '',
    fiscalYear: row.fiscalYear ?? '',
    approvalStatus: row.approvalStatus ?? 'draft',
    distributionMode: row.distributionMode ?? 'cash',
    minimumHoldingPeriodMonths: row.minimumHoldingPeriodMonths ?? 0,
    certificatePrefix: row.certificatePrefix ?? 'SC-',
    startingNumber: row.startingNumber ?? 1,
    includeLogo: row.includeLogo !== false,
    headerText: row.headerText ?? '',
    footerText: row.footerText ?? '',
    fields: Array.isArray(row.fields) ? row.fields.join(', ') : '',
    // share-classes
    shareType: (row as any).shareType ?? 'ORDINARY',
    targetMemberType: (row as any).targetMemberType ?? 'ALL',
    parValue: (row as any).parValue != null ? String((row as any).parValue) : '',
    minKittaPerPurchase: (row as any).minKittaPerPurchase != null ? String((row as any).minKittaPerPurchase) : '1',
    maxKittaPerMember: (row as any).maxKittaPerMember != null ? String((row as any).maxKittaPerMember) : '',
    glAccountId: (row as any).glAccountId ?? '',
    isDividendEligible: (row as any).isDividendEligible !== false,
    maxDividendRatePct: (row as any).maxDividendRatePct != null ? String((row as any).maxDividendRatePct) : '',
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (row: ShareRow) => {
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

  const handleFieldChange = (field: keyof FormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
    }
  };

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.code.trim()) errors.code = 'Code is required';
    else if (form.code.trim().length > 20) errors.code = 'Code max 20 characters';
    if (!form.name.trim()) errors.name = 'Name is required';
    else if (form.name.trim().length > 100) errors.name = 'Name max 100 characters';
    if (isShareType) {
      if (form.faceValue <= 0) errors.faceValue = 'Face value must be > 0';
      if (form.minShares < 1) errors.minShares = 'Min shares must be ≥ 1';
      if (form.dividendRate < 0) errors.dividendRate = 'Dividend rate must be ≥ 0';
      if (Number(form.currentKittaPointer) < 0) errors.currentKittaPointer = 'Kitta pointer must be ≥ 0';
      if (form.kittaStartBase !== '' && Number(form.kittaStartBase) <= 0) errors.kittaStartBase = 'Kitta start base must be > 0';
      const maxAllowedKittaNum = form.maxAllowedKitta !== '' ? Number(form.maxAllowedKitta) : null;
      // Unlimited is no longer supported — an explicit numeric allocation is required.
      if (maxAllowedKittaNum == null || !Number.isInteger(maxAllowedKittaNum) || maxAllowedKittaNum <= 0) {
        errors.maxAllowedKitta = 'Max Allowed Kitta is required (unlimited not allowed) — enter a positive kitta allocation';
      } else if (kittaPool && maxAllowedKittaNum > kittaPool.allowedMax) {
        errors.maxAllowedKitta = `Exceeds available pool — only ${kittaPool.allowedMax.toLocaleString()} kitta remain for this type (${kittaPool.allocatedToOtherTypes.toLocaleString()} already allocated to other types of ${Number(orgSettings?.authorizedTotalKitta).toLocaleString()})`;
      }
      if (form.maxAllowedKitta !== '' && form.kittaStartBase !== '' && Number(form.maxAllowedKitta) < Number(form.kittaStartBase)) {
        errors.maxAllowedKitta = 'Max kitta cannot be below the start base';
      }
    }
    if (isScheme) {
      if (form.shareValuePerUnit < 0) errors.shareValuePerUnit = 'Share value must be ≥ 0';
      if (form.minOpenUnits < 1) errors.minOpenUnits = 'Min open units must be ≥ 1';
      if (form.maxUnits !== '' && Number(form.maxUnits) <= 0) errors.maxUnits = 'Max units must be positive';
      if (form.minOpeningAmount < 0) errors.minOpeningAmount = 'Minimum opening amount must be ≥ 0';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ---------------------------------------------------------------------------
  // Save (create or update)
  // ---------------------------------------------------------------------------
  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (isShareType) {
        const payload = {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          faceValue: Number(form.faceValue),
          minShares: Number(form.minShares),
          maxShares: form.maxShares !== '' ? Number(form.maxShares) : null,
          isTransferable: form.isTransferable,
          isPledgeable: form.isPledgeable,
          dividendRate: Number(form.dividendRate),
          kittaPrefix: form.kittaPrefix.trim() || '',
          kittaStartBase: form.kittaStartBase !== '' ? Number(form.kittaStartBase) : null,
          currentKittaPointer: Number(form.currentKittaPointer || 0),
          maxAllowedKitta: form.maxAllowedKitta !== '' ? Number(form.maxAllowedKitta) : null,
          autoSequence: form.autoSequence,
          status: (form.status || 'Active') as 'Active' | 'Inactive',
          description: form.description.trim() || null,
        };
        if (editingId) {
          await updateShareType(editingId, payload);
        } else {
          await createShareType(payload);
        }
      } else {
        const payload: Record<string, any> = {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          nameNepali: form.nameNepali.trim() || null,
          description: form.description.trim() || null,
          isActive: form.isActive,
          sortOrder: Number(form.sortOrder),
        };
        if (entityType === 'share-classes') {
          payload.shareTypeId = form.shareType || 'ORDINARY';
          payload.targetMemberTypeId = form.targetMemberType || 'ALL';
          payload.parValue = form.parValue !== '' ? Number(form.parValue) : null;
          payload.minKittaPerPurchase = form.minKittaPerPurchase !== '' ? Number(form.minKittaPerPurchase) : 1;
          payload.maxKittaPerMember = form.maxKittaPerMember !== '' ? Number(form.maxKittaPerMember) : null;
          payload.glAccountId = form.glAccountId || null;
          payload.isDividendEligible = form.isDividendEligible;
          payload.maxDividendRatePct = form.maxDividendRatePct !== '' ? Number(form.maxDividendRatePct) : null;
        } else if (isScheme) {
          payload.shareClassId = form.shareClassId || null;
          payload.shareTypeId = form.shareTypeId || null;
          payload.shareValuePerUnit = Number(form.shareValuePerUnit);
          payload.minOpenUnits = Number(form.minOpenUnits);
          payload.maxUnits = form.maxUnits !== '' ? Number(form.maxUnits) : null;
          payload.isTransferable = form.isTransferable;
          payload.dividendRate = Number(form.dividendRate);
          payload.minOpeningAmount = Number(form.minOpeningAmount);
        } else if (entityType === 'dividend-rules') {
          payload.taxWithholdingPercent = Number(form.taxWithholdingPercent);
          payload.targetDividendPercent = Number(form.targetDividendPercent);
          payload.bonusShareRatio = form.bonusShareRatio.trim() || '1:10';
          payload.dividendPolicy = form.dividendPolicy.trim() || null;
          payload.fiscalYear = form.fiscalYear.trim() || null;
          payload.approvalStatus = form.approvalStatus;
          payload.distributionMode = form.distributionMode;
          payload.minimumHoldingPeriodMonths = Number(form.minimumHoldingPeriodMonths);
        } else if (entityType === 'certificate-formats') {
          payload.certificatePrefix = form.certificatePrefix.trim() || 'SC-';
          payload.startingNumber = Number(form.startingNumber);
          payload.includeLogo = form.includeLogo;
          payload.headerText = form.headerText.trim() || null;
          payload.footerText = form.footerText.trim() || null;
          payload.fields = form.fields.split(',').map((f: string) => f.trim()).filter(Boolean);
        }

        if (editingId) {
          await apiClient.put(`${meta.endpoint}/${editingId}`, payload);
        } else {
          await apiClient.post(meta.endpoint, payload);
        }
      }

      toast.showSuccess(editingId ? `${meta.label} updated successfully.` : `${meta.label} created successfully.`);
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
  // Delete
  // ---------------------------------------------------------------------------
  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      if (isShareType) {
        await deleteShareType(id);
      } else {
        await apiClient.delete(`${meta.endpoint}/${id}`);
      }
      toast.showSuccess(`${meta.label} deleted.`);
      setDeletingId(null);
      fetchRows();
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Delete failed';
      toast.showError(msg);
    } finally {
      setDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Default scheme selector
  // ---------------------------------------------------------------------------
  const handleSetDefault = async () => {
    setSettingDefault(true);
    try {
      const res = await apiClient.put('/shares/settings/default-scheme', {
        defaultShareSchemeId: defaultSchemeId || null,
      });
      const name = res.data?.organization?.defaultShareSchemeId
        ? (classOptions.find((c) => c.id === res.data.organization.defaultShareSchemeId)?.name ?? '')
        : '';
      if (res.data?.organization?.defaultShareSchemeId) {
        const scheme = rows.find((r) => r.id === res.data.organization.defaultShareSchemeId);
        setDefaultSchemeName(scheme?.name ?? '');
      } else {
        setDefaultSchemeName('');
      }
      toast.showSuccess(defaultSchemeId ? 'Default share scheme set.' : 'Default share scheme cleared.');
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Failed to update default scheme';
      toast.showError(msg);
    } finally {
      setSettingDefault(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Default certificate format selector
  // ---------------------------------------------------------------------------
  const handleSetDefaultCertFormat = async () => {
    setSettingDefaultCert(true);
    try {
      const res = await apiClient.put('/shares/settings/default-certificate-format', {
        defaultCertificateFormatId: defaultCertFormatId || null,
      });
      const id = res.data?.defaultCertificateFormatId ?? res.data?.organization?.defaultCertificateFormatId ?? null;
      if (id) {
        const f = rows.find((r) => r.id === id);
        setDefaultCertFormatName(f?.name ?? '');
      } else {
        setDefaultCertFormatName('');
      }
      toast.showSuccess(defaultCertFormatId ? 'Default certificate format set.' : 'Default certificate format cleared.');
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Failed to update default certificate format';
      toast.showError(msg);
    } finally {
      setSettingDefaultCert(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Config section renderers
  // ---------------------------------------------------------------------------
  const fieldCls = 'w-full bg-slate-50 border placeholder-slate-400 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-none focus:border-emerald-500 transition';
  const errCls = (key: string) => (formErrors[key] ? 'border-rose-400' : 'border-slate-200 ');

  const num = (v: any) => Number(v) || 0;

  const renderSchemeConfig = (ctx: MasterDataFormConfigCtx) => {
    const calculated = num(ctx.values.minOpenUnits) * num(ctx.values.shareValuePerUnit);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Share Class</label>
            <select
              value={String(ctx.values.shareClassId ?? '')}
              onChange={(e) => ctx.onChange('shareClassId', e.target.value)}
              className={`${fieldCls} ${errCls('shareClassId')}`}
            >
              <option value="">— None —</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Linked Share Type</label>
            <select
              value={String(ctx.values.shareTypeId ?? '')}
              onChange={(e) => ctx.onChange('shareTypeId', e.target.value)}
              className={`${fieldCls} ${errCls('shareTypeId')}`}
            >
              <option value="">— None —</option>
              {typeOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
              ))}
            </select>
            {!ctx.values.shareTypeId && (
              <p className="text-amber-600 mt-1 text-[10px]">
                Required for auto-opening at member registration.
              </p>
            )}
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Share Value / Unit (NPR)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={String(ctx.values.shareValuePerUnit ?? 0)}
              onChange={(e) => ctx.onChange('shareValuePerUnit', e.target.value)}
              className={`${fieldCls} ${errCls('shareValuePerUnit')}`}
            />
            {ctx.errors.shareValuePerUnit && <p className="text-rose-500 mt-1">{ctx.errors.shareValuePerUnit}</p>}
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Min Open Units</label>
            <input
              type="number"
              min={1}
              step={1}
              value={String(ctx.values.minOpenUnits ?? 1)}
              onChange={(e) => ctx.onChange('minOpenUnits', e.target.value)}
              className={`${fieldCls} ${errCls('minOpenUnits')}`}
            />
            {ctx.errors.minOpenUnits && <p className="text-rose-500 mt-1">{ctx.errors.minOpenUnits}</p>}
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Max Units / Member</label>
            <input
              type="number"
              min={1}
              step={1}
              value={String(ctx.values.maxUnits ?? '')}
              onChange={(e) => ctx.onChange('maxUnits', e.target.value)}
              className={`${fieldCls} ${errCls('maxUnits')}`}
              placeholder="Unlimited"
            />
            {ctx.errors.maxUnits && <p className="text-rose-500 mt-1">{ctx.errors.maxUnits}</p>}
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Dividend Rate (%)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={String(ctx.values.dividendRate ?? 0)}
              onChange={(e) => ctx.onChange('dividendRate', e.target.value)}
              className={`${fieldCls} ${errCls('dividendRate')}`}
            />
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Min Opening Deposit (NPR)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={String(ctx.values.minOpeningAmount ?? 0)}
              onChange={(e) => ctx.onChange('minOpeningAmount', e.target.value)}
              className={`${fieldCls} ${errCls('minOpeningAmount')}`}
              placeholder="0 = computed from units × value"
            />
            {ctx.errors.minOpeningAmount && <p className="text-rose-500 mt-1">{ctx.errors.minOpeningAmount}</p>}
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => ctx.onChange('isTransferable', ctx.values.isTransferable !== true)}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${ctx.values.isTransferable !== false ? 'bg-emerald-500' : 'bg-slate-300 '}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${ ctx.values.isTransferable !== false ? 'translate-x-5' : 'translate-x-0' }`}
                />
              </div>
              <span className="font-semibold text-slate-700">Transferable</span>
            </label>
          </div>
        </div>

        {/* Calculated opening amount — informational, not enforced. */}
        <div className="rounded-xl bg-emerald-50 /10 border border-emerald-200 /30 px-3 py-2.5 flex items-center justify-between text-xs">
          <span className="text-slate-600 font-semibold">
            Calculated opening deposit ({num(ctx.values.minOpenUnits)} units × रु.{num(ctx.values.shareValuePerUnit)})
          </span>
          <span className="font-mono font-bold text-emerald-700">
            रु. {calculated.toLocaleString()}
          </span>
        </div>
      </div>
    );
  };

  const renderDividendConfig = (ctx: MasterDataFormConfigCtx) => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label className="block text-slate-600 font-semibold mb-1">Withholding Tax (%)</label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={String(ctx.values.taxWithholdingPercent ?? 0)}
          onChange={(e) => ctx.onChange('taxWithholdingPercent', e.target.value)}
          className={`${fieldCls} ${errCls('taxWithholdingPercent')}`}
        />
      </div>
      <div>
        <label className="block text-slate-600 font-semibold mb-1">Target Dividend (%)</label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={String(ctx.values.targetDividendPercent ?? 0)}
          onChange={(e) => ctx.onChange('targetDividendPercent', e.target.value)}
          className={`${fieldCls} ${errCls('targetDividendPercent')}`}
        />
      </div>
      <div>
        <label className="block text-slate-600 font-semibold mb-1">Bonus Share Ratio</label>
        <input
          type="text"
          value={String(ctx.values.bonusShareRatio ?? '1:10')}
          onChange={(e) => ctx.onChange('bonusShareRatio', e.target.value)}
          className={`${fieldCls} ${errCls('bonusShareRatio')}`}
        />
      </div>
      <div className="sm:col-span-3">
        <label className="block text-slate-600 font-semibold mb-1">Dividend Policy</label>
        <textarea
          rows={2}
          value={String(ctx.values.dividendPolicy ?? '')}
          onChange={(e) => ctx.onChange('dividendPolicy', e.target.value)}
          className={`${fieldCls} resize-none ${errCls('dividendPolicy')}`}
        />
      </div>
      <div className="sm:col-span-3">
        <label className="block text-slate-500 font-semibold text-xs mb-1 mt-1">
          Fiscal-Year Declaration (config-only — no distribution engine yet)
        </label>
      </div>
      <div>
        <label className="block text-slate-600 font-semibold mb-1">Fiscal Year</label>
        <input
          type="text"
          value={String(ctx.values.fiscalYear ?? '')}
          onChange={(e) => ctx.onChange('fiscalYear', e.target.value)}
          className={`${fieldCls} ${errCls('fiscalYear')}`}
          placeholder="e.g. 2083/84"
        />
      </div>
      <div>
        <label className="block text-slate-600 font-semibold mb-1">Approval Status</label>
        <select
          value={String(ctx.values.approvalStatus ?? 'draft')}
          onChange={(e) => ctx.onChange('approvalStatus', e.target.value)}
          className={`${fieldCls} ${errCls('approvalStatus')}`}
        >
          <option value="draft">Draft (not AGM-approved)</option>
          <option value="approved">Approved (AGM)</option>
        </select>
      </div>
      <div>
        <label className="block text-slate-600 font-semibold mb-1">Distribution Mode</label>
        <select
          value={String(ctx.values.distributionMode ?? 'cash')}
          onChange={(e) => ctx.onChange('distributionMode', e.target.value)}
          className={`${fieldCls} ${errCls('distributionMode')}`}
        >
          <option value="cash">Cash</option>
          <option value="bonus_share">Bonus Share</option>
          <option value="member_choice">Member Choice</option>
        </select>
      </div>
      <div>
        <label className="block text-slate-600 font-semibold mb-1">Min Holding Period (months)</label>
        <input
          type="number"
          min={0}
          step={1}
          value={String(ctx.values.minimumHoldingPeriodMonths ?? 0)}
          onChange={(e) => ctx.onChange('minimumHoldingPeriodMonths', e.target.value)}
          className={`${fieldCls} ${errCls('minimumHoldingPeriodMonths')}`}
          placeholder="0 = no requirement"
        />
      </div>
    </div>
  );

  const renderCertificateConfig = (ctx: MasterDataFormConfigCtx) => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-slate-600 font-semibold mb-1">Certificate Prefix</label>
          <input
            type="text"
            value={String(ctx.values.certificatePrefix ?? 'SC-')}
            onChange={(e) => ctx.onChange('certificatePrefix', e.target.value)}
            className={`${fieldCls} ${errCls('certificatePrefix')}`}
          />
        </div>
        <div>
          <label className="block text-slate-600 font-semibold mb-1">Starting Number</label>
          <input
            type="number"
            min={1}
            step={1}
            value={String(ctx.values.startingNumber ?? 1)}
            onChange={(e) => ctx.onChange('startingNumber', e.target.value)}
            className={`${fieldCls} ${errCls('startingNumber')}`}
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => ctx.onChange('includeLogo', ctx.values.includeLogo !== true)}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${ctx.values.includeLogo !== false ? 'bg-emerald-500' : 'bg-slate-300 '}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${ ctx.values.includeLogo !== false ? 'translate-x-5' : 'translate-x-0' }`}
              />
            </div>
            <span className="font-semibold text-slate-700">Include Org Logo</span>
          </label>
        </div>
      </div>
      <div>
        <label className="block text-slate-600 font-semibold mb-1">Header Text</label>
        <input
          type="text"
          value={String(ctx.values.headerText ?? '')}
          onChange={(e) => ctx.onChange('headerText', e.target.value)}
          className={`${fieldCls} ${errCls('headerText')}`}
        />
      </div>
      <div>
        <label className="block text-slate-600 font-semibold mb-1">Footer Text</label>
        <input
          type="text"
          value={String(ctx.values.footerText ?? '')}
          onChange={(e) => ctx.onChange('footerText', e.target.value)}
          className={`${fieldCls} ${errCls('footerText')}`}
        />
      </div>
      <div>
        <label className="block text-slate-600 font-semibold mb-1">Certificate Fields (comma-separated)</label>
        <input
          type="text"
          value={String(ctx.values.fields ?? '')}
          onChange={(e) => ctx.onChange('fields', e.target.value)}
          className={`${fieldCls} ${errCls('fields')}`}
        />
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Share Class config renderer
  // ---------------------------------------------------------------------------
  const renderClassConfig = (ctx: MasterDataFormConfigCtx) => (
    <div className="space-y-5">
      {/* Row 1: Share Type + Target Member Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-slate-600 font-semibold mb-1">
            Share Type <span className="text-rose-500">*</span>
          </label>
          <select
            value={String(ctx.values.shareType ?? 'ORDINARY')}
            onChange={(e) => ctx.onChange('shareType', e.target.value)}
            disabled={loadingDropdowns}
            className={`${fieldCls} ${errCls('shareType')}`}
          >
            <option value="">{loadingDropdowns ? 'Loading share types...' : '— Select Share Type —'}</option>
            {shareTypeOptions.map((t) => (
              <option key={t.id} value={t.code?.toUpperCase() ?? t.name?.toUpperCase()}>
                {t.name}{t.nameNp ? ` (${t.nameNp})` : ''} — {t.code}
              </option>
            ))}
          </select>
          {shareTypeOptions.length === 0 && !loadingDropdowns && (
            <p className="text-[10px] text-amber-600 mt-1">No active share types. Create one under Share Types first.</p>
          )}
        </div>
        <div>
          <label className="block text-slate-600 font-semibold mb-1">Target Member Type</label>
          <select
            value={String(ctx.values.targetMemberType ?? 'ALL')}
            onChange={(e) => ctx.onChange('targetMemberType', e.target.value)}
            disabled={loadingDropdowns}
            className={`${fieldCls} ${errCls('targetMemberType')}`}
          >
            <option value="ALL">{loadingDropdowns ? 'Loading member types...' : 'All Member Types (सबै प्रकारका सदस्य)'}</option>
            {memberTypeOptions.map((m) => (
              <option key={m.id} value={m.code?.toUpperCase() ?? m.name?.toUpperCase()}>
                {m.name}{m.nameNp ? ` (${m.nameNp})` : ''}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400 mt-1">Leave as "All Member Types" to allow any registered member.</p>
        </div>
      </div>

      {/* Row 2: Par Value + GL Account */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-slate-600 font-semibold mb-1">Par Value per Kitta (NPR)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder="Leave blank to inherit from Share Type"
            value={String(ctx.values.parValue ?? '')}
            onChange={(e) => ctx.onChange('parValue', e.target.value)}
            className={`${fieldCls} ${errCls('parValue')}`}
          />
          <p className="text-[10px] text-slate-400 mt-1">Overrides Share Type face value if set.</p>
        </div>
        <div>
          <label className="block text-slate-600 font-semibold mb-1">
            GL Account (Share Capital / Equity)
          </label>
          {loadingDropdowns ? (
            <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              Loading equity accounts...
            </div>
          ) : coaAccounts.length === 0 ? (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              No Equity (3000-series) accounts found — configure Chart of Accounts first.
            </div>
          ) : (
            <select
              value={String(ctx.values.glAccountId ?? '')}
              onChange={(e) => ctx.onChange('glAccountId', e.target.value)}
              className={`${fieldCls} ${errCls('glAccountId')}`}
            >
              <option value="">— Use System Default —</option>
              {coaAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Row 3: Min / Max Kitta per purchase / per member */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-3">
        <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">Kitta Limits (कित्ता सीमा)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Min Kitta per Purchase</label>
            <input
              type="number"
              min={1}
              step={1}
              placeholder="1"
              value={String(ctx.values.minKittaPerPurchase ?? 1)}
              onChange={(e) => ctx.onChange('minKittaPerPurchase', e.target.value)}
              className={`${fieldCls} ${errCls('minKittaPerPurchase')}`}
            />
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Max Kitta per Member</label>
            <input
              type="number"
              min={1}
              step={1}
              placeholder="Unlimited"
              value={String(ctx.values.maxKittaPerMember ?? '')}
              onChange={(e) => ctx.onChange('maxKittaPerMember', e.target.value)}
              className={`${fieldCls} ${errCls('maxKittaPerMember')}`}
            />
            <p className="text-[10px] text-slate-400 mt-1">Leave blank = no per-member cap.</p>
          </div>
        </div>
      </div>

      {/* Row 4: Dividend Eligibility */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-3">
        <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">Dividend Configuration</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-3 pt-1">
            <div
              onClick={() => ctx.onChange('isDividendEligible', ctx.values.isDividendEligible === false)}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                ctx.values.isDividendEligible !== false ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  ctx.values.isDividendEligible !== false ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
            <span className="font-semibold text-slate-700">Dividend Eligible</span>
          </div>
          {ctx.values.isDividendEligible !== false && (
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Max Dividend Rate (%)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                placeholder="e.g. 15 (cap for this class)"
                value={String(ctx.values.maxDividendRatePct ?? '')}
                onChange={(e) => ctx.onChange('maxDividendRatePct', e.target.value)}
                className={`${fieldCls} ${errCls('maxDividendRatePct')}`}
              />
              <p className="text-[10px] text-slate-400 mt-1">Leave blank = no cap beyond the org's declared rate.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderConfig = (ctx: MasterDataFormConfigCtx) => {
    if (entityType === 'share-classes') return renderClassConfig(ctx);
    if (isShareType) {
      return (
        <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Face Value (NPR)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={String(ctx.values.faceValue ?? 0)}
              onChange={(e) => ctx.onChange('faceValue', e.target.value)}
              className={`${fieldCls} ${errCls('faceValue')}`}
            />
            {ctx.errors.faceValue && <p className="text-rose-500 mt-1">{ctx.errors.faceValue}</p>}
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Min Shares</label>
            <input
              type="number"
              min={1}
              step={1}
              value={String(ctx.values.minShares ?? 1)}
              onChange={(e) => ctx.onChange('minShares', e.target.value)}
              className={`${fieldCls} ${errCls('minShares')}`}
            />
            {ctx.errors.minShares && <p className="text-rose-500 mt-1">{ctx.errors.minShares}</p>}
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Max Shares / Member</label>
            <input
              type="number"
              min={1}
              step={1}
              value={String(ctx.values.maxShares ?? '')}
              onChange={(e) => ctx.onChange('maxShares', e.target.value)}
              className={`${fieldCls} ${errCls('maxShares')}`}
              placeholder="Unlimited"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Dividend Rate (%)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={String(ctx.values.dividendRate ?? 0)}
              onChange={(e) => ctx.onChange('dividendRate', e.target.value)}
              className={`${fieldCls} ${errCls('dividendRate')}`}
            />
            {ctx.errors.dividendRate && <p className="text-rose-500 mt-1">{ctx.errors.dividendRate}</p>}
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Status</label>
            <select
              value={String(ctx.values.status ?? 'Active')}
              onChange={(e) => ctx.onChange('status', e.target.value)}
              className={`${fieldCls} ${errCls('status')}`}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => ctx.onChange('isTransferable', ctx.values.isTransferable !== true)}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${ctx.values.isTransferable !== false ? 'bg-emerald-500' : 'bg-slate-300 '}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${ ctx.values.isTransferable !== false ? 'translate-x-5' : 'translate-x-0' }`}
                />
              </div>
              <span className="font-semibold text-slate-700">Transferable</span>
            </label>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => ctx.onChange('isPledgeable', ctx.values.isPledgeable !== true)}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${ctx.values.isPledgeable !== false ? 'bg-emerald-500' : 'bg-slate-300 '}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${ ctx.values.isPledgeable !== false ? 'translate-x-5' : 'translate-x-0' }`}
                />
              </div>
              <span className="font-semibold text-slate-700">Pledgeable (share-backed loan collateral)</span>
            </label>
          </div>
        </div>

        {/* Kitta configuration — embedded per share class (स्वतः कित्ता जारी) */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-3">
          <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">Kitta Configuration (कित्ता सेटअप)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Kitta Prefix</label>
              <input
                type="text"
                maxLength={20}
                placeholder="e.g. RR-"
                value={String(ctx.values.kittaPrefix ?? '')}
                onChange={(e) => ctx.onChange('kittaPrefix', e.target.value)}
                className={`${fieldCls} ${errCls('kittaPrefix')}`}
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Kitta Start Base</label>
              <input
                type="number"
                min={1}
                step={1}
                placeholder="e.g. 500001"
                value={String(ctx.values.kittaStartBase ?? '')}
                onChange={(e) => ctx.onChange('kittaStartBase', e.target.value)}
                className={`${fieldCls} ${errCls('kittaStartBase')}`}
              />
              <p className="text-[11px] text-slate-500 mt-1">First kitta if it differs from pointer+1</p>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Last Issued Kitta (Pointer)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={String(ctx.values.currentKittaPointer ?? '0')}
                onChange={(e) => ctx.onChange('currentKittaPointer', e.target.value)}
                className={`${fieldCls} ${errCls('currentKittaPointer')}`}
              />
              <p className="text-[11px] text-slate-500 mt-1">System bumps this automatically on every issue</p>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Max Allowed Kitta (कित्ता सीमा)</label>
              <input
                type="number"
                min={1}
                step={1}
                placeholder="Required — no unlimited ceilings"
                value={String(ctx.values.maxAllowedKitta ?? '')}
                onChange={(e) => ctx.onChange('maxAllowedKitta', e.target.value)}
                className={`${fieldCls} ${errCls('maxAllowedKitta')} ${kittaPoolExceeded ? 'border-rose-500 bg-rose-50 ' : ''}`}
              />
              {ctx.errors.maxAllowedKitta && <p className="text-rose-500 mt-1">{ctx.errors.maxAllowedKitta}</p>}
              {!ctx.errors.maxAllowedKitta && inputMaxAllowedKitta > 0 && !kittaPoolExceeded && (
                <p className="text-[11px] text-emerald-700 font-mono mt-1">
                  = NPR {(inputMaxAllowedKitta * Number(ctx.values.faceValue || 100)).toLocaleString()} Capital Value
                </p>
              )}
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => ctx.onChange('autoSequence', ctx.values.autoSequence !== true)}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${ctx.values.autoSequence !== false ? 'bg-emerald-500' : 'bg-slate-300 '}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${ ctx.values.autoSequence !== false ? 'translate-x-5' : 'translate-x-0' }`}
                  />
                </div>
                <span className="font-semibold text-slate-700">Auto Sequence (next free kitta)</span>
              </label>
            </div>
          </div>

          {/* Dynamic allocation pool summary (real-time headroom vs other types) */}
          {kittaPool && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-center">
                <span className="text-[10px] font-semibold text-slate-500 block">Org Authorized Kitta</span>
                <strong className="text-[13px] text-slate-800 font-mono">{Number(orgSettings?.authorizedTotalKitta ?? 0).toLocaleString()}</strong>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-center">
                <span className="text-[10px] font-semibold text-slate-500 block">Allocated to Other Types</span>
                <strong className="text-[13px] text-slate-700 font-mono">{kittaPool.allocatedToOtherTypes.toLocaleString()}</strong>
              </div>
              <div className={`rounded-lg border p-2.5 text-center ${kittaPool.availablePoolForType === 0 ? 'bg-rose-50 border-rose-200 ' : 'bg-emerald-50 border-emerald-200 '}`}>
                <span className={`text-[10px] font-semibold block ${kittaPool.availablePoolForType === 0 ? 'text-rose-600 ' : 'text-emerald-700 '}`}>Available Headroom</span>
                <strong className={`text-[13px] font-mono ${kittaPool.availablePoolForType === 0 ? 'text-rose-700 ' : 'text-emerald-800 '}`}>{kittaPool.availablePoolForType.toLocaleString()}</strong>
              </div>
            </div>
          )}
          {kittaPool && kittaPool.isOverAllocated && (
            <p className="text-[11px] text-rose-600 font-medium mt-1">
              ⚠ Pool is already over-allocated by {(kittaPool.allocatedToOtherTypes - Number(orgSettings?.authorizedTotalKitta ?? 0)).toLocaleString()} kitta. New allocations are blocked; edits may keep existing ceilings but cannot increase them.
            </p>
          )}
        </div>
      </div>
      );
    }
    if (isScheme) return renderSchemeConfig(ctx);
    if (entityType === 'dividend-rules') return renderDividendConfig(ctx);
    if (entityType === 'certificate-formats') return renderCertificateConfig(ctx);
    return null;
  };

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------
  const renderHeaders = () => {
    if (isShareType) {
      return (
        <>
          <th className="p-3">Face Value</th>
          <th className="p-3">Min/Max</th>
          <th className="p-3">Transferable</th>
          <th className="p-3">Pledgeable</th>
          <th className="p-3">Dividend</th>
          <th className="p-3">Kitta (Auto)</th>
          <th className="p-3">Status</th>
        </>
      );
    }
    if (isScheme) {
      return (
        <>
          <th className="p-3">Value/Unit</th>
          <th className="p-3">Min Units</th>
          <th className="p-3">Opening Deposit</th>
          <th className="p-3">Status</th>
        </>
      );
    }
    if (entityType === 'dividend-rules') {
      return (
        <>
          <th className="p-3">Withholding</th>
          <th className="p-3">Target Div.</th>
          <th className="p-3">Bonus Ratio</th>
          <th className="p-3">Fiscal Yr</th>
          <th className="p-3">Approval</th>
          <th className="p-3">Status</th>
        </>
      );
    }
    if (entityType === 'certificate-formats') {
      return (
        <>
          <th className="p-3">Prefix</th>
          <th className="p-3">Start No.</th>
          <th className="p-3">Logo</th>
          <th className="p-3">Status</th>
        </>
      );
    }
    if (entityType === 'share-classes') {
      return (
        <>
          <th className="p-3">Share Type</th>
          <th className="p-3">Par Value</th>
          <th className="p-3">Min/Max Kitta</th>
          <th className="p-3">Dividend</th>
          <th className="p-3">Status</th>
        </>
      );
    }
    return <th className="p-3">Status</th>;
  };

  const renderCells = (row: ShareRow) => {
    if (isShareType) {
      return (
        <>
          <td className="p-3 font-mono text-emerald-700 font-semibold">रु. {num(row.faceValue).toLocaleString()}</td>
          <td className="p-3 font-mono text-slate-600">{row.minShares ?? 1}{row.maxShares != null ? ` – ${row.maxShares}` : '+'}</td>
          <td className="p-3">{row.isTransferable !== false ? 'Yes' : 'No'}</td>
          <td className="p-3">{row.isPledgeable !== false ? 'Yes' : 'No'}</td>
          <td className="p-3 font-mono text-slate-600">{num(row.dividendRate)}%</td>
          <td className="p-3 font-mono text-slate-700">
            {row.autoSequence === false ? (
              <span className="text-slate-400">Manual</span>
            ) : (
              <span>
                {row.kittaPrefix || ''}{num(row.currentKittaPointer)}
                {row.maxAllowedKitta != null && <span className="text-slate-400">/{num(row.maxAllowedKitta)}</span>}
              </span>
            )}
          </td>
          <td className="p-3">{statusPill(row.status === 'Active')}</td>
        </>
      );
    }
    if (isScheme) {
      return (
        <>
          <td className="p-3 font-mono text-emerald-700 font-semibold">रु. {num(row.shareValuePerUnit).toLocaleString()}</td>
          <td className="p-3 font-mono text-slate-600">{row.minOpenUnits ?? 1}</td>
          <td className="p-3 font-mono text-slate-600">रु. {num(row.minOpeningAmount ?? (row.minOpenUnits ?? 1) * (row.shareValuePerUnit ?? 0)).toLocaleString()}</td>
          <td className="p-3">{statusPill(row.isActive)}</td>
        </>
      );
    }
    if (entityType === 'dividend-rules') {
      return (
        <>
          <td className="p-3 font-mono text-slate-600">{num(row.taxWithholdingPercent)}%</td>
          <td className="p-3 font-mono text-emerald-700 font-semibold">{num(row.targetDividendPercent)}%</td>
          <td className="p-3 font-mono text-slate-600">{row.bonusShareRatio ?? '1:10'}</td>
          <td className="p-3 font-mono text-slate-600">{row.fiscalYear ?? '—'}</td>
          <td className="p-3">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ row.approvalStatus === 'approved' ? 'bg-emerald-100 /20 text-emerald-700 border-emerald-300 /30' : 'bg-amber-100 /20 text-amber-700 border-amber-300 /30' }`}>
              {row.approvalStatus === 'approved' ? 'Approved' : 'Draft'}
            </span>
          </td>
          <td className="p-3">{statusPill(row.isActive)}</td>
        </>
      );
    }
    if (entityType === 'certificate-formats') {
      return (
        <>
          <td className="p-3 font-mono text-slate-600">{row.certificatePrefix ?? 'SC-'}</td>
          <td className="p-3 font-mono text-slate-600">{row.startingNumber ?? 1}</td>
          <td className="p-3">{row.includeLogo !== false ? 'Yes' : 'No'}</td>
          <td className="p-3">{statusPill(row.isActive)}</td>
        </>
      );
    }
    if (entityType === 'share-classes') {
      return (
        <>
          <td className="p-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-violet-50 text-violet-700 border-violet-200 capitalize">
              {(row as any).shareType ?? 'ordinary'}
            </span>
          </td>
          <td className="p-3 font-mono text-slate-600">
            {(row as any).parValue != null ? `NPR ${Number((row as any).parValue).toLocaleString()}` : <span className="text-slate-400">Inherited</span>}
          </td>
          <td className="p-3 font-mono text-slate-600">
            {(row as any).minKittaPerPurchase ?? 1}
            {(row as any).maxKittaPerMember != null ? ` – ${(row as any).maxKittaPerMember}` : '+'}
          </td>
          <td className="p-3">
            {(row as any).isDividendEligible !== false ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {(row as any).maxDividendRatePct != null ? `≤ ${(row as any).maxDividendRatePct}%` : 'Eligible'}
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Not Eligible</span>
            )}
          </td>
          <td className="p-3">{statusPill(row.isActive)}</td>
        </>
      );
    }
    return <td className="p-3">{statusPill(row.isActive)}</td>;
  };

  const statusPill = (active: boolean) => (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ active ? 'bg-emerald-100 /20 text-emerald-700 border-emerald-300 /30' : 'bg-slate-100 text-slate-500 border-slate-300 ' }`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );

  const defaultPill = (row: ShareRow) => (
    <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 /20 text-emerald-700 border border-emerald-300 /30">
      DEFAULT
    </span>
  );

  return (
    <div className="space-y-4">
      {/* ==========================================================
          ORG SHARE SETTINGS — authorized ceilings + running totals
      ========================================================== */}
      {isOrgSettings && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">{meta.labelPlural}</h3>
              <p className="text-slate-500 text-xs mt-0.5">{meta.description}</p>
            </div>
          </div>

          {orgSettingsLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-500 bg-white border border-slate-200 rounded-2xl">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading organization share settings…
            </div>
          ) : !orgSettings ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500 bg-white border border-slate-200 rounded-2xl">
              <AlertTriangle className="w-8 h-8" />
              <p className="font-semibold">Organization share settings are not available.</p>
            </div>
          ) : (
            <form onSubmit={saveOrgSettings} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Ceiling inputs */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="text-xs text-slate-600 font-semibold">
                    Authorized ceilings — new issues are blocked once any ceiling is reached. Values cannot go below the kitta/capital already issued.
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Authorized Capital Ceiling (रु.)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={orgSettingsForm.authorizedCapitalCeiling}
                    onChange={(e) => setOrgSettingsForm((f) => ({ ...f, authorizedCapitalCeiling: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Authorized Total Kitta</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={orgSettingsForm.authorizedTotalKitta}
                    onChange={(e) => setOrgSettingsForm((f) => ({ ...f, authorizedTotalKitta: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Default Face Value (रु.)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={orgSettingsForm.defaultFaceValue}
                    onChange={(e) => setOrgSettingsForm((f) => ({ ...f, defaultFaceValue: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Min Kitta to Open Account</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={orgSettingsForm.minRequiredKitta}
                    onChange={(e) => setOrgSettingsForm((f) => ({ ...f, minRequiredKitta: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 font-semibold focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Minimum kitta a member must take when opening their first share account (हकवाला).</p>
                </div>
                <button
                  type="submit"
                  disabled={orgSettingsSaving}
                  className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
                >
                  {orgSettingsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Ceilings
                </button>
              </div>

              {/* Running totals (read-only snapshot) */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                    <span className="text-[10px] font-semibold text-emerald-700 block">Total Issued Kitta</span>
                    <div className="text-2xl font-black text-emerald-800 font-mono">{orgSettings.totalIssuedKitta.toLocaleString()}</div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                    <span className="text-[10px] font-semibold text-purple-700 block">Total Issued Capital</span>
                    <div className="text-2xl font-black text-purple-800 font-mono">रु. {Number(orgSettings.totalIssuedCapital).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-semibold text-slate-500 block mb-2">Ceiling headroom</span>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Kitta</span>
                        <span className="font-mono">{orgSettings.totalIssuedKitta.toLocaleString()} / {orgSettings.authorizedTotalKitta.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (orgSettings.totalIssuedKitta / Math.max(1, orgSettings.authorizedTotalKitta)) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Capital</span>
                        <span className="font-mono">रु. {Number(orgSettings.totalIssuedCapital).toLocaleString(undefined, { maximumFractionDigits: 2 })} / रु. {Number(orgSettings.authorizedCapitalCeiling).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 transition-all" style={{ width: `${Math.min(100, (Number(orgSettings.totalIssuedCapital) / Math.max(1, Number(orgSettings.authorizedCapitalCeiling))) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-3">
                    Per-class kitta pointers and per-type ceilings are managed under <span className="font-semibold">Share Types</span>. These totals are updated automatically with every issue or return.
                  </p>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {!isOrgSettings && (
        <>
      {/* Default scheme selector — only on the Share Schemes page */}
      {isScheme && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-slate-600 font-semibold">
                Default Share Scheme — used to auto-open a member's share account with the
                opening deposit at registration (Dr Cash/Bank, Cr Share Capital).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={defaultSchemeId}
                onChange={(e) => {
                  setDefaultSchemeId(e.target.value);
                  setDefaultSchemeName(rows.find((r) => r.id === e.target.value)?.name ?? '');
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
                {defaultSchemeName ? 'Update Default' : 'Set Default'}
              </button>
            </div>
          </div>
          {defaultSchemeName && (
            <p className="text-xs text-slate-500">
              Current default: <span className="font-bold text-emerald-700">{defaultSchemeName}</span>
            </p>
          )}
        </div>
      )}

      {/* Default certificate format selector — only on the Certificate Formats page */}
      {entityType === 'certificate-formats' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-violet-600 shrink-0" />
              <p className="text-xs text-slate-600 font-semibold">
                Default Share Certificate Format — the design the Share page renders when a member's
                certificate is printed from the Share Certificate modal.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={defaultCertFormatId}
                onChange={(e) => {
                  setDefaultCertFormatId(e.target.value);
                  setDefaultCertFormatName(rows.find((r) => r.id === e.target.value)?.name ?? '');
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-violet-500 cursor-pointer"
              >
                <option value="">— No default —</option>
                {rows.filter((r) => r.isActive).map((r) => (
                  <option key={r.id} value={r.id}>{r.code} — {r.name}</option>
                ))}
              </select>
              <button
                onClick={handleSetDefaultCertFormat}
                disabled={settingDefaultCert}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm"
              >
                {settingDefaultCert && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {defaultCertFormatName ? 'Update Default' : 'Set Default'}
              </button>
            </div>
          </div>
          {defaultCertFormatName && (
            <p className="text-xs text-slate-500">
              Current default: <span className="font-bold text-violet-700">{defaultCertFormatName}</span>
            </p>
          )}
        </div>
      )}

      {/* Search / filter bar */}
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
        quickStats={[
          { label: meta.labelPlural, value: total, color: 'text-emerald-700 ' },
        ]}
      />

      {/* Table header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">{meta.labelPlural}</h3>
          <p className="text-slate-500 text-xs mt-0.5">{meta.description}</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add {meta.label}
        </button>
      </div>

      {/* Data table */}
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
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Name</th>
                {renderHeaders()}
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 /50 transition">
                  <td className="p-3 font-mono text-emerald-600 font-bold">
                    {row.code}
                    {isScheme && defaultSchemeId === row.id && defaultPill(row)}
                    {entityType === 'certificate-formats' && defaultCertFormatId === row.id && defaultPill(row)}
                  </td>
                  <td className="p-3 font-semibold text-slate-800">
                    {row.name}
                    {row.isSystem && (
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                        SYSTEM
                      </span>
                    )}
                  </td>
                  {renderCells(row)}
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {entityType === 'certificate-formats' && (
                        <button
                          onClick={() => setDesignTarget(row)}
                          className="text-violet-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                          title="Open the certificate designer"
                        >
                          <PenTool className="w-3.5 h-3.5" /> Design
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(row)}
                        className="text-emerald-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit →
                      </button>
                      <button
                        onClick={() => setDeletingId(row.id)}
                        disabled={row.usageCount ? row.usageCount > 0 : row.isSystem}
                        title={row.usageCount ? `In use by ${row.usageCount} record(s)` : row.isSystem ? 'System record' : 'Delete'}
                        className={`flex items-center gap-1 font-bold transition ${ row.usageCount ? row.usageCount > 0 : row.isSystem ? 'text-slate-600 cursor-not-allowed' : 'text-rose-500 hover:text-rose-700 cursor-pointer' }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      </>
        )}

      {/* ── Create / Edit Modal ── */}
      <MasterDataFormModal
        open={modalOpen}
        mode={editingId ? 'edit' : 'create'}
        icon={meta.icon}
        title={editingId ? `Edit ${meta.label}` : `Add ${meta.label}`}
        description={meta.description}
        configSectionLabel={isScheme ? 'Pricing & Opening Configuration' : entityType === 'dividend-rules' ? 'Dividend Parameters' : entityType === 'certificate-formats' ? 'Certificate Template' : 'Share Parameters'}
        values={form as any}
        errors={formErrors}
        onChange={(field, value) => handleFieldChange(field as keyof FormState, value)}
        onSave={handleSave}
        onClose={closeModal}
        saving={saving}
        disableSave={submitBlocked && !saving}
        saveLabel={editingId ? 'Save Changes' : `Create ${meta.label}`}
        renderConfig={renderConfig}
      />

      {/* ── Delete Confirmation Modal ── */}
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
                  <p className="text-slate-500 text-xs mt-0.5">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                Are you sure you want to delete this {meta.label.toLowerCase()}?
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setDeletingId(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                disabled={deleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Certificate Designer Modal (certificate-formats only) ── */}
      {designTarget && (
        <CertificateDesignerModal
          formatId={designTarget.id}
          initialConfig={designTarget.configJson}
          onClose={() => setDesignTarget(null)}
          onSaved={(config) => {
            setRows((prev) =>
              prev.map((r) => (r.id === designTarget.id ? { ...r, configJson: config } : r))
            );
            setDesignTarget(null);
          }}
        />
      )}
    </div>
  );
};
