import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard, FolderTree, Layers, FileSpreadsheet, Banknote, Landmark,
  Wallet, ReceiptText, PiggyBank, ShieldCheck, Plus, X, Edit3, Save, Trash2,
  Search, ChevronRight, ChevronDown, CheckCircle2, AlertTriangle, Lock, Building2,
  CalendarRange, StickyNote, UploadCloud, Wand2, Download, Link2, Sparkles,
  RefreshCw, Check, ArrowRight, Info, HelpCircle, Eye
} from 'lucide-react';
import { useCoop } from '../../context/CoopContext';
import {
  fetchAccountingSettings, createAccountingSetting, updateAccountingSetting, deleteAccountingSetting,
  fetchCoa, createAccount, updateAccount, deleteAccount,
  fetchAccountGroups, createAccountGroup, updateAccountGroup, deleteAccountGroup,
  fetchSystemMappings, saveSystemMappings,
  fetchAccountingHealth, transitionFinancialPeriod,
  seedDefaultCoa,
  normalizeSetting, ACCOUNTING_ENTITY_LABELS,
} from '../../api/accountingSettings';
import { BulkCoaModal } from '../modals/BulkCoaModal';
import { BankAccountDetailView } from '../views/BankAccountDetailView';
import type {
  AccountingSettingsEntityType, AccountingHealth, ChartAccount, AccountGroup,
  SystemMapping, FinancialPeriod, BankAccount,
} from '../../api/accountingSettings';
import { bsRangeBreaches, normalizeBsDate } from '../../api/utils/fiscalYearValidation';
import { SYSTEM_ACCOUNT_KEYS } from '../../api/schemas/accountingSetting';
import type { FiscalYear } from '../../types/coop';
import { formatNPR, getTodayBS } from '../../utils/nepaliCalendar';
import { DateConverter } from '../../utils/DateConverter';

interface Props {
  activeSubKey?: string;
}

const TITLES: Record<string, { title: string; subtitle: string; icon: React.ReactNode }> = {
  setup_accounting_dashboard: { title: 'Accounting Settings Overview', subtitle: 'Configuration health, posting status and system wiring at a glance.', icon: <LayoutDashboard className="w-5 h-5 text-emerald-600" /> },
  setup_coa: { title: 'Chart of Accounts & System Mappings', subtitle: 'Structured ledger classification tree & module posting accounts.', icon: <FolderTree className="w-5 h-5 text-emerald-600" /> },
  setup_account_groups: { title: 'Account Groups', subtitle: 'Top-level classification groups for the chart of accounts.', icon: <Layers className="w-5 h-5 text-emerald-600" /> },
  setup_voucher_types: { title: 'Voucher Types', subtitle: 'Receipt / Payment / Journal / Contra voucher classes and numbering.', icon: <ReceiptText className="w-5 h-5 text-emerald-600" /> },
  setup_cost_centers: { title: 'Cost Centers', subtitle: 'Department / project / branch cost allocation centers.', icon: <StickyNote className="w-5 h-5 text-emerald-600" /> },
  setup_journal_templates: { title: 'Journal Templates', subtitle: 'Reusable entry templates for recurring journal postings.', icon: <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> },
  setup_fin_periods: { title: 'Financial Periods', subtitle: 'Open / lock / close accounting periods. Posting is gated on an open period.', icon: <CalendarRange className="w-5 h-5 text-emerald-600" /> },
  setup_bank_list: { title: 'Bank List', subtitle: 'Commercial banks maintained for the organization.', icon: <Landmark className="w-5 h-5 text-emerald-600" /> },
  setup_bank_accounts: { title: 'Bank Accounts', subtitle: 'Branch bank accounts linked to GL accounts.', icon: <Banknote className="w-5 h-5 text-emerald-600" /> },
  setup_cash_counters: { title: 'Cash Counters', subtitle: 'Branch cash counters and their GL cash accounts.', icon: <Wallet className="w-5 h-5 text-emerald-600" /> },
  setup_payment_methods: { title: 'Payment Methods', subtitle: 'Cash / bank / cheque / digital payment method rules.', icon: <PiggyBank className="w-5 h-5 text-emerald-600" /> },
  setup_system_mappings: { title: 'System Account Mappings', subtitle: 'Wire module postings (share capital, cash, etc.) to chart accounts.', icon: <ShieldCheck className="w-5 h-5 text-emerald-600" /> },
};

const ENTITY_BY_KEY: Record<string, AccountingSettingsEntityType> = {
  setup_voucher_types: 'voucher-types',
  setup_cost_centers: 'cost-centers',
  setup_journal_templates: 'journal-templates',
  setup_fin_periods: 'financial-periods',
  setup_bank_list: 'banks',
  setup_bank_accounts: 'bank-accounts',
  setup_cash_counters: 'cash-counters',
  setup_payment_methods: 'payment-methods',
};

export const SYSTEM_MAPPING_META: Record<string, { label: string; description: string; category: string; recommendedType: string; defaultCodePattern?: string }> = {
  share_capital: {
    label: 'Share Capital Account',
    description: 'Member share equity account for share issuance, transfers, and buybacks.',
    category: 'Equity',
    recommendedType: 'Equity',
    defaultCodePattern: '30-01',
  },
  cash_bank: {
    label: 'Cash & Bank Clearing',
    description: 'Default settlement account for teller deposits, withdrawals, and cash transactions.',
    category: 'Asset',
    recommendedType: 'Asset',
    defaultCodePattern: '10-01',
  },
  member_savings: {
    label: 'Member Savings Deposits',
    description: 'Liability account representing total member savings and term deposits.',
    category: 'Liability',
    recommendedType: 'Liability',
    defaultCodePattern: '20-01',
  },
  loan_principal_receivable: {
    label: 'Loan Principal Receivable',
    description: 'Asset portfolio account tracking active loan disbursements and principal balances.',
    category: 'Asset',
    recommendedType: 'Asset',
    defaultCodePattern: '10-02',
  },
  loan_interest_income: {
    label: 'Loan Interest Income',
    description: 'Revenue account for interest accrued and collected from active loans.',
    category: 'Income',
    recommendedType: 'Income',
    defaultCodePattern: '40-01',
  },
  loan_penalty_income: {
    label: 'Loan Penalty / Fine Income',
    description: 'Income account for penalty charges collected on overdue loan installments.',
    category: 'Income',
    recommendedType: 'Income',
    defaultCodePattern: '40-02',
  },
  loan_processing_fee_income: {
    label: 'Loan Service & Processing Fee',
    description: 'Fee revenue from loan appraisal, processing, and documentation.',
    category: 'Income',
    recommendedType: 'Income',
    defaultCodePattern: '40-03',
  },
  savings_interest_expense: {
    label: 'Savings Interest Expense',
    description: 'Interest paid or provisioned on member deposit and savings schemes.',
    category: 'Expense',
    recommendedType: 'Expense',
    defaultCodePattern: '50-01',
  },
  dividend_payable: {
    label: 'Dividend Payable',
    description: 'Declared dividend liability to be distributed to shareholders.',
    category: 'Liability',
    recommendedType: 'Liability',
    defaultCodePattern: '20-02',
  },
  entrance_fee_income: {
    label: 'Entrance & Admission Fee',
    description: 'One-time admission and registration fees from new member enrollment.',
    category: 'Income',
    recommendedType: 'Income',
    defaultCodePattern: '40-04',
  },
  membership_fee_income: {
    label: 'Membership Fee Income',
    description: 'Annual or recurring cooperative member subscription fees.',
    category: 'Income',
    recommendedType: 'Income',
    defaultCodePattern: '40-05',
  },
  suspense: {
    label: 'Suspense & Unallocated Account',
    description: 'Holding account for unclassified deposits or reconciliation differences.',
    category: 'Liability',
    recommendedType: 'Liability',
    defaultCodePattern: '20-99',
  },
  retained_earnings: {
    label: 'Retained Earnings & Reserves',
    description: 'Accumulated statutory reserves and undivided cooperative surplus.',
    category: 'Equity',
    recommendedType: 'Equity',
    defaultCodePattern: '30-02',
  },
  profit_loss: {
    label: 'Current Year Profit & Loss',
    description: 'Year-to-date operating profit or surplus clearing account.',
    category: 'Equity',
    recommendedType: 'Equity',
    defaultCodePattern: '30-03',
  },
};

type FieldType = 'text' | 'number' | 'select' | 'checkbox' | 'textarea' | 'coa' | 'branch' | 'bank' | 'voucher-type' | 'cost-center' | 'fiscal-year';

interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  span2?: boolean;
  hint?: string;
  autoGenerated?: boolean;
}

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
const VOUCHER_CATEGORIES = ['Receipt', 'Payment', 'Journal', 'Contra'];
const NUMBERING_RULES = ['fiscal_year', 'sequential', 'monthly'];
const FREQUENCIES = ['manual', 'monthly', 'quarterly', 'annual'];
const BANK_ACCOUNT_TYPES = ['Current', 'Savings', 'Fixed', 'Other'];
const PAYMENT_METHOD_TYPES = ['Cash', 'Bank', 'Cheque', 'Digital', 'Card', 'Other'];
const PERIOD_STATUSES = ['draft', 'open', 'locked', 'closed'];

function safeBsToAd(bsDate: string): string {
  if (!bsDate) return '';
  const trimmed = bsDate.trim().replace(/\//g, '-');
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) return '';
  try {
    const res = DateConverter.bsToAd(trimmed);
    if (/^\d{4}-\d{2}-\d{2}$/.test(res)) return res;
  } catch {
    // Fallback
  }
  return '';
}

function getNextFinancialPeriodCode(existingPeriods: FinancialPeriod[]): string {
  if (!existingPeriods || existingPeriods.length === 0) return 'FP001';
  let maxNum = 0;
  for (const p of existingPeriods) {
    const match = (p.code || '').match(/FP-?(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  return `FP${String(maxNum + 1).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Financial Period ⇄ Fiscal Year dependency (Golden Rules)
//   Rule 1 — a Financial Period is a CHILD ENTRY of a Fiscal Year. It can never
//            be created while the organization has no open/active fiscal year.
//   Rule 2 — the period's BS range is auto-fetched from, and clamped to, the
//            selected fiscal year's boundary.
// ---------------------------------------------------------------------------

/** Fiscal years a new period may be attached to (closed years are excluded). */
function openFiscalYearsOf(rows: FiscalYear[]): FiscalYear[] {
  return rows.filter((fy) => fy.status !== 'closed');
}

/** The fiscal year the modal auto-fetches: flagged current → today's → latest. */
function pickCurrentFiscalYear(rows: FiscalYear[]): FiscalYear | null {
  if (rows.length === 0) return null;
  const flagged = rows.find((fy) => fy.isCurrent);
  if (flagged) return flagged;
  const todayBS = getTodayBS();
  const byRange = rows.find((fy) => todayBS >= fy.startDateBS && todayBS <= fy.endDateBS);
  if (byRange) return byRange;
  return rows[rows.length - 1];
}

/** Period form values derived from a parent fiscal year (boundary defaults). */
function fiscalYearFormDefaults(fy: FiscalYear): Record<string, any> {
  return {
    fiscalYearId: fy.id,
    fiscalYearCode: fy.code,
    startDateBs: fy.startDateBS,
    endDateBs: fy.endDateBS,
    startDateAd: fy.startDateAD || safeBsToAd(fy.startDateBS),
    endDateAd: fy.endDateAD || safeBsToAd(fy.endDateBS),
  };
}

function getNextEntityCode(entity: AccountingSettingsEntityType | null, existingRows: any[] = []): string {
  if (!entity) return '';
  if (entity === 'financial-periods') return getNextFinancialPeriodCode(existingRows as FinancialPeriod[]);
  const prefixMap: Record<string, string> = {
    'voucher-types': 'VT',
    'cost-centers': 'CC',
    'banks': 'BNK',
    'cash-counters': 'CTR',
    'payment-methods': 'PM',
    'journal-templates': 'JT',
  };
  const prefix = prefixMap[entity] || 'COD';
  let maxNum = 0;
  for (const r of existingRows) {
    const match = (r.code || '').match(new RegExp(`${prefix}-?(\\d+)`, 'i'));
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
}

function getNextCoaCode(parentCode: string, existingAccounts: ChartAccount[]): string {
  if (!parentCode) {
    let maxMajor = 0;
    for (const a of existingAccounts) {
      if (!a.parentCode) {
        const m = (a.code || '').match(/^(\d+)/);
        if (m) {
          const num = parseInt(m[1], 10);
          if (!isNaN(num) && num > maxMajor) maxMajor = num;
        }
      }
    }
    const nextMajor = maxMajor ? maxMajor + 10 : 10;
    return `${nextMajor}-00-000`;
  }
  const siblings = existingAccounts.filter((a) => a.parentCode === parentCode || (a.code || '').startsWith(`${parentCode}-`));
  let maxSub = 0;
  for (const s of siblings) {
    const parts = (s.code || '').split('-');
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart, 10);
    if (!isNaN(num) && num > maxSub) maxSub = num;
  }
  return `${parentCode}-${String(maxSub + 1).padStart(3, '0')}`;
}

function getNextGroupCode(existingGroups: AccountGroup[]): string {
  let maxNum = 0;
  for (const g of existingGroups) {
    const match = (g.code || '').match(/GRP-?(\d+)/i) || (g.code || '').match(/G-?(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  return `GRP-${String(maxNum + 101).padStart(3, '0')}`;
}

export const SetupAccountingSettingsView: React.FC<Props> = ({ activeSubKey = 'setup_accounting_dashboard' }) => {
  const { branches, addNotification, fiscalYears } = useCoop();
  const [subTab, setSubTab] = useState<string>(activeSubKey);

  // In COA view, allow switching between Tree and Mappings tab
  const [coaViewMode, setCoaViewMode] = useState<'tree' | 'mappings'>('tree');

  const [health, setHealth] = useState<AccountingHealth | null>(null);
  const [coa, setCoa] = useState<{ accounts: ChartAccount[]; groups: AccountGroup[] }>({ accounts: [], groups: [] });
  const [settings, setSettings] = useState<Record<string, any[]>>({});
  const [systemMappings, setSystemMappings] = useState<SystemMapping[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [entries, setEntries] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Quick Map Modal for individual accounts
  const [quickMapModalOpen, setQuickMapModalOpen] = useState(false);
  const [quickMapTargetAccount, setQuickMapTargetAccount] = useState<ChartAccount | null>(null);
  const [quickMapSelectedKey, setQuickMapSelectedKey] = useState<string>('');

  // Custom mapping modal
  const [addMappingModalOpen, setAddMappingModalOpen] = useState(false);
  const [newMappingKey, setNewMappingKey] = useState('');
  const [newMappingDesc, setNewMappingDesc] = useState('');
  const [newMappingAccount, setNewMappingAccount] = useState('');

  // Bank account detail view
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setHealth(await fetchAccountingHealth());
  }, []);

  const loadCoa = useCallback(async () => {
    const data = await fetchCoa();
    setCoa(data);
    const groups = await fetchAccountGroups().catch(() => []);
    setCoa((prev) => ({ ...prev, groups }));
  }, []);

  const loadEntity = useCallback(async (key: string) => {
    const entity = ENTITY_BY_KEY[key];
    if (!entity) return;
    const rows = await fetchAccountingSettings(entity);
    setSettings((prev) => ({ ...prev, [entity]: rows }));
  }, []);

  const loadMappings = useCallback(async () => {
    const maps = await fetchSystemMappings();
    setSystemMappings(maps);
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    if (subTab !== activeSubKey) setSubTab(activeSubKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubKey]);

  useEffect(() => {
    setLoading(true);
    if (subTab === 'setup_coa' || subTab === 'setup_account_groups' || subTab === 'setup_system_mappings') {
      Promise.all([loadCoa(), loadMappings()]).then(() => {
        setLoading(false);
      }).catch(() => setLoading(false));
      return;
    }
    if (subTab === 'setup_accounting_dashboard') {
      Promise.all([loadHealth(), loadCoa(), loadMappings()]).then(() => setLoading(false)).catch(() => setLoading(false));
      return;
    }
    // Bank Accounts modal needs both the bank master list and the COA for its
    // "Bank" and "GL Account" dropdowns — fetch all three dependencies in parallel.
    if (subTab === 'setup_bank_accounts') {
      Promise.all([
        loadEntity('setup_bank_accounts'),
        loadEntity('setup_bank_list'),
        loadCoa(),
      ]).then(() => setLoading(false)).catch(() => setLoading(false));
      return;
    }
    const entity = ENTITY_BY_KEY[subTab];
    if (!entity) { setLoading(false); return; }
    loadEntity(subTab).then(() => setLoading(false)).catch(() => setLoading(false));
  }, [subTab, loadCoa, loadHealth, loadMappings, loadEntity]);

  const currentEntity = ENTITY_BY_KEY[subTab] ?? null;
  const rows = currentEntity ? (settings[currentEntity] ?? []) : [];
  const entityLabel = currentEntity ? (ACCOUNTING_ENTITY_LABELS[currentEntity] ?? currentEntity) : '';

  const notify = (title: string, msg: string, type: 'info' | 'success' | 'warning' | 'alert' = 'info') => addNotification(title, msg, type);

  const accountOptions = useMemo(() => coa.accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })), [coa.accounts]);
  const branchOptions = useMemo(() => branches.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` })), [branches]);
  const bankOptions = useMemo(() => (settings['banks'] ?? []).map((b: any) => ({ value: b.id, label: `${b.code} — ${b.name}` })), [settings]);
  const voucherTypeOptions = useMemo(() => (settings['voucher-types'] ?? []).map((v: any) => ({ value: v.id, label: `${v.code} — ${v.name}` })), [settings]);
  const costCenterOptions = useMemo(() => (settings['cost-centers'] ?? []).map((c: any) => ({ value: c.id, label: `${c.code} — ${c.name}` })), [settings]);

  // ------------------------------------------------------------------
  // Financial Period ⇄ Fiscal Year guards (see Golden Rules above)
  // ------------------------------------------------------------------
  const openFiscalYears = useMemo(() => openFiscalYearsOf(fiscalYears), [fiscalYears]);
  const activeFiscalYear = useMemo(() => pickCurrentFiscalYear(openFiscalYears), [openFiscalYears]);
  const hasOpenFiscalYear = openFiscalYears.length > 0;

  /** Fiscal years offered in the modal. Editing may reference a closed year. */
  const fiscalYearOptions = useMemo(() => {
    const pool = editing ? fiscalYears : openFiscalYears;
    return pool.map((fy) => ({
      value: fy.code,
      label: `${fy.code}${fy.isCurrent ? ' (Current Active FY)' : ''}${fy.status === 'closed' ? ' — closed' : ''} · ${fy.startDateBS} → ${fy.endDateBS}`,
    }));
  }, [editing, fiscalYears, openFiscalYears]);

  /** The parent fiscal year the open period form is currently bound to. */
  const selectedFiscalYear = useMemo<FiscalYear | null>(() => {
    if (currentEntity !== 'financial-periods') return null;
    const byId = form.fiscalYearId ? fiscalYears.find((fy) => fy.id === form.fiscalYearId) : undefined;
    if (byId) return byId;
    const code = String(form.fiscalYearCode ?? '').trim().toUpperCase();
    if (!code) return null;
    return fiscalYears.find((fy) => fy.code.trim().toUpperCase() === code) ?? null;
  }, [currentEntity, form.fiscalYearId, form.fiscalYearCode, fiscalYears]);

  /** Rule 1: block the create form entirely when no fiscal year is open. */
  const periodGuardActive = currentEntity === 'financial-periods' && !editing && !hasOpenFiscalYear;

  /** Rule 2: per-field boundary violations against the parent fiscal year. */
  const periodFieldErrors = useMemo<Record<string, string>>(() => {
    if (currentEntity !== 'financial-periods' || periodGuardActive) return {};
    const errors: Record<string, string> = {};
    const fy = selectedFiscalYear;
    if (!fy) {
      errors.fiscalYearCode = 'Select the parent fiscal year this period belongs to.';
      return errors;
    }
    const startBs = normalizeBsDate(String(form.startDateBs ?? '').trim());
    const endBs = normalizeBsDate(String(form.endDateBs ?? '').trim());
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (!iso.test(startBs)) errors.startDateBs = 'Enter the BS start date as YYYY-MM-DD.';
    if (!iso.test(endBs)) errors.endDateBs = 'Enter the BS end date as YYYY-MM-DD.';
    if (errors.startDateBs || errors.endDateBs) return errors;
    if (startBs > endBs) errors.endDateBs = 'End date must fall on or after the start date.';
    const breaches = bsRangeBreaches(
      { startDateBS: startBs, endDateBS: endBs },
      { startDateBS: fy.startDateBS, endDateBS: fy.endDateBS },
    );
    if (breaches.includes('start')) errors.startDateBs = `Outside FY ${fy.code}: cannot start before ${fy.startDateBS}.`;
    if (breaches.includes('end')) errors.endDateBs = `Outside FY ${fy.code}: cannot end after ${fy.endDateBS}.`;
    return errors;
  }, [currentEntity, periodGuardActive, selectedFiscalYear, form.startDateBs, form.endDateBs]);

  const periodErrorList = useMemo(() => Object.values(periodFieldErrors), [periodFieldErrors]);

  // Account -> mapping keys lookup for COA view badge display
  const accountToMappingMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const m of systemMappings) {
      if (m.accountId) {
        if (!map[m.accountId]) map[m.accountId] = [];
        map[m.accountId].push(m.mappingKey);
      }
    }
    return map;
  }, [systemMappings]);

  const refetchAllForEntity = useCallback(async (entity: AccountingSettingsEntityType) => {
    const rows2 = await fetchAccountingSettings(entity);
    setSettings((prev) => ({ ...prev, [entity]: rows2 }));
  }, []);

  // ------------------------------------------------------------------
  // CRUD handlers
  // ------------------------------------------------------------------
  const openCreate = () => {
    setEditing(null);
    const def = defaultForm(currentEntity, coa);
    const existingRows = settings[currentEntity ?? ''] ?? [];

    // Auto-generate code for all entities that have a code field
    if (currentEntity === 'financial-periods') {
      const existingPeriods = existingRows as FinancialPeriod[];
      def.code = getNextFinancialPeriodCode(existingPeriods);

      // Rule 2 — auto-fetch the active fiscal year and snap the period to its
      // boundary. When no fiscal year is open the modal renders the Rule 1
      // guard instead of the form, so the stale defaults are never submitted.
      if (activeFiscalYear) {
        Object.assign(def, fiscalYearFormDefaults(activeFiscalYear));
        def.name = `FP ${activeFiscalYear.code}`;
      } else {
        def.fiscalYearId = null;
        def.fiscalYearCode = '';
        def.name = '';
        def.startDateBs = '';
        def.endDateBs = '';
        def.startDateAd = '';
        def.endDateAd = '';
      }
    } else if (currentEntity && ['voucher-types','cost-centers','banks','cash-counters','payment-methods','journal-templates'].includes(currentEntity)) {
      def.code = getNextEntityCode(currentEntity, existingRows);
    }

    setForm(def);
    setEntries([]);
    setModalOpen(true);
  };

  const openEdit = (row: any) => {
    setEditing(row);
    const f: Record<string, any> = {};
    for (const field of fieldsFor(currentEntity)) {
      f[field.name] = row[field.name] ?? (field.type === 'checkbox' ? false : '');
    }
    if (currentEntity === 'financial-periods') {
      // Keep the parent link explicit even though it is not a rendered field.
      f.fiscalYearId = row.fiscalYearId
        ?? fiscalYears.find((fy) => fy.code.trim().toUpperCase() === String(row.fiscalYearCode ?? '').trim().toUpperCase())?.id
        ?? null;
    }
    setForm(f);
    setEntries(Array.isArray(row.entries) ? row.entries.map((e: any) => ({ ...e })) : []);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEntity) return;
    const payload: Record<string, any> = { ...form };

    // Financial periods are child entries of a fiscal year — enforce both
    // golden rules before the request leaves the browser.
    if (currentEntity === 'financial-periods') {
      if (!selectedFiscalYear) {
        notify('Fiscal Year Required', 'A financial period must belong to an existing fiscal year. Set up and activate a fiscal year first.', 'warning');
        return;
      }
      if (periodErrorList.length > 0) {
        notify('Outside Fiscal Year Boundary', periodErrorList[0], 'warning');
        return;
      }
      payload.fiscalYearId = selectedFiscalYear.id;
      payload.fiscalYearCode = selectedFiscalYear.code;
    }

    setSaving(true);
    try {
      if (currentEntity === 'journal-templates') payload.entries = entries;
      if (editing) {
        await updateAccountingSetting(currentEntity, editing.id, payload);
        notify('Updated', `${entityLabel} updated successfully.`, 'success');
      } else {
        await createAccountingSetting(currentEntity, payload);
        notify('Created', `${entityLabel} created successfully.`, 'success');
      }
      await refetchAllForEntity(currentEntity);
      setModalOpen(false);
    } catch (error: any) {
      notify('Save Failed', error?.response?.data?.error || error?.message || 'Unable to save.', 'alert');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: any) => {
    if (!currentEntity || !row.id) return;
    if (!window.confirm(`Delete ${entityLabel.toLowerCase()} "${row.name || row.code || row.accountName}"?`)) return;
    try {
      await deleteAccountingSetting(currentEntity, row.id);
      notify('Deleted', `${entityLabel} deleted.`, 'warning');
      await refetchAllForEntity(currentEntity);
    } catch (error: any) {
      notify('Delete Failed', error?.response?.data?.error || error?.message || 'Unable to delete.', 'alert');
    }
  };

  // Field change handler with auto-conversion and auto-fill
  const setField = (name: string, value: any) => {
    setForm((prev) => {
      const updated = { ...prev, [name]: value };

      // Auto-conversion for financial periods
      if (currentEntity === 'financial-periods') {
        if (name === 'startDateBs') {
          const ad = safeBsToAd(value);
          if (ad) updated.startDateAd = ad;
        } else if (name === 'endDateBs') {
          const ad = safeBsToAd(value);
          if (ad) updated.endDateAd = ad;
        } else if (name === 'fiscalYearCode') {
          // Switching the parent fiscal year re-snaps the period to its
          // boundary so the dates can never belong to a different year.
          const code = String(value || '').trim().toUpperCase();
          const fy = fiscalYears.find((f) => f.code.trim().toUpperCase() === code);
          if (fy) {
            Object.assign(updated, fiscalYearFormDefaults(fy));
            if (!prev.name || /^FP\s/i.test(String(prev.name))) updated.name = `FP ${fy.code}`;
          } else {
            updated.fiscalYearId = null;
          }
        }
      }

      return updated;
    });
  };

  // ------------------------------------------------------------------
  // COA handlers
  // ------------------------------------------------------------------
  const handleCoaSave = async (payload: Record<string, any>, mappingKeyToSet?: string | null) => {
    try {
      let savedAccountId = payload.id;
      if (payload.id) {
        await updateAccount(payload.id, payload);
      } else {
        const created = await createAccount(payload);
        savedAccountId = created?.id;
      }

      // If user selected a system mapping for this account in the modal
      if (mappingKeyToSet && savedAccountId) {
        const updated = systemMappings.map((m) =>
          m.mappingKey === mappingKeyToSet ? { ...m, accountId: savedAccountId } : m
        );
        await saveSystemMappings(updated.map((m) => ({ mappingKey: m.mappingKey, accountId: m.accountId })));
      } else if (mappingKeyToSet === '' && savedAccountId) {
        // Unmap if explicitly cleared
        const updated = systemMappings.map((m) =>
          m.accountId === savedAccountId ? { ...m, accountId: null } : m
        );
        await saveSystemMappings(updated.map((m) => ({ mappingKey: m.mappingKey, accountId: m.accountId })));
      }

      await loadCoa();
      await loadMappings();
      await loadHealth();
      return true;
    } catch (error: any) {
      notify('Account Save Failed', error?.response?.data?.error || error?.message || 'Unable to save account.', 'alert');
      return false;
    }
  };

  const handleCoaDelete = async (account: ChartAccount) => {
    if (!window.confirm(`Delete account "${account.code} — ${account.name}"?`)) return;
    try {
      await deleteAccount(account.id);
      notify('Account Deleted', `${account.code} deleted.`, 'warning');
      await loadCoa();
      await loadMappings();
    } catch (error: any) {
      notify('Delete Failed', error?.response?.data?.error || error?.message || 'Unable to delete.', 'alert');
    }
  };

  // Quick Map Modal Action
  const openQuickMap = (account: ChartAccount) => {
    setQuickMapTargetAccount(account);
    const existingKey = Object.keys(SYSTEM_MAPPING_META).find((k) =>
      systemMappings.some((m) => m.mappingKey === k && m.accountId === account.id)
    ) || '';
    setQuickMapSelectedKey(existingKey);
    setQuickMapModalOpen(true);
  };

  const handleApplyQuickMap = async () => {
    if (!quickMapTargetAccount) return;
    try {
      const targetId = quickMapTargetAccount.id;
      const updated = systemMappings.map((m) => {
        if (m.mappingKey === quickMapSelectedKey) {
          return { ...m, accountId: targetId };
        }
        // If it was mapped to this account and unselected, unmap it
        if (m.accountId === targetId && m.mappingKey !== quickMapSelectedKey) {
          return { ...m, accountId: null };
        }
        return m;
      });

      await saveSystemMappings(updated.map((m) => ({ mappingKey: m.mappingKey, accountId: m.accountId })));
      notify('Mapping Updated', `Account "${quickMapTargetAccount.name}" mapped successfully.`, 'success');
      await loadMappings();
      await loadHealth();
      setQuickMapModalOpen(false);
    } catch (err: any) {
      notify('Mapping Failed', err?.message || 'Failed to update mapping', 'alert');
    }
  };

  // ------------------------------------------------------------------
  // Account group handlers
  // ------------------------------------------------------------------
  const [groupModal, setGroupModal] = useState(false);
  const [groupForm, setGroupForm] = useState<Record<string, any>>({});
  const [groupEditing, setGroupEditing] = useState<AccountGroup | null>(null);

  const openGroupCreate = () => { setGroupEditing(null); setGroupForm({ code: getNextGroupCode(coa.groups), type: 'Asset' }); setGroupModal(true); };
  const openGroupEdit = (g: AccountGroup) => { setGroupEditing(g); setGroupForm({ ...g }); setGroupModal(true); };

  const saveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (groupEditing) await updateAccountGroup(groupEditing.id, groupForm);
      else await createAccountGroup(groupForm);
      notify('Account Group Saved', 'Account group saved successfully.', 'success');
      await loadCoa();
      setGroupModal(false);
    } catch (error: any) {
      notify('Save Failed', error?.response?.data?.error || error?.message || 'Unable to save group.', 'alert');
    }
  };

  const deleteGroup = async (g: AccountGroup) => {
    if (!window.confirm(`Delete account group "${g.code} — ${g.name}"?`)) return;
    try {
      await deleteAccountGroup(g.id);
      notify('Group Deleted', `${g.code} deleted.`, 'warning');
      await loadCoa();
    } catch (error: any) {
      notify('Delete Failed', error?.response?.data?.error || error?.message || 'Unable to delete.', 'alert');
    }
  };

  // ------------------------------------------------------------------
  // Financial period transitions
  // ------------------------------------------------------------------
  const doTransition = async (period: FinancialPeriod, status: string) => {
    const reason = status === 'closed' || status === 'locked'
      ? window.prompt(`Reason for ${status}ing the period "${period.name}" (${period.code}):`) || ''
      : undefined;
    if (status === 'closed' || status === 'locked') {
      if (!reason || !reason.trim()) { notify('Reason Required', 'A reason is required to close or lock a period.', 'warning'); return; }
    }
    try {
      await transitionFinancialPeriod(period.id, status, reason);
      notify('Period Updated', `Period moved to "${status}".`, 'success');
      await loadEntity('setup_fin_periods');
      await loadHealth();
    } catch (error: any) {
      notify('Transition Failed', error?.response?.data?.error || error?.message || 'Unable to change period status.', 'alert');
    }
  };

  // ------------------------------------------------------------------
  // System mappings saving
  // ------------------------------------------------------------------
  const saveMappings = async () => {
    try {
      const mapped = systemMappings.filter((m) => m.accountId);
      await saveSystemMappings(mapped.map((m) => ({ mappingKey: m.mappingKey, accountId: m.accountId, description: m.description })));
      notify('Mappings Saved', `${mapped.length} system account mapping(s) saved.`, 'success');
      await loadMappings();
      await loadHealth();
    } catch (error: any) {
      notify('Save Failed', error?.response?.data?.error || error?.message || 'Unable to save mappings.', 'alert');
    }
  };

  const setMappingAccount = (key: string, accountId: string) => {
    setSystemMappings((prev) => prev.map((m) => (m.mappingKey === key ? { ...m, accountId: accountId || null } : m)));
  };

  // ── Auto-Suggest Mappings ──
  const [autoSuggestModalOpen, setAutoSuggestModalOpen] = useState(false);
  const [autoSuggestions, setAutoSuggestions] = useState<Array<{
    mappingKey: string;
    label: string;
    accountId: string | null;
    accountCode: string;
    accountName: string;
    confidence: number;
    reason: string;
  }>>([]);

  const computeAutoSuggestions = useCallback(() => {
    const suggestions: typeof autoSuggestions = [];
    const unmappedKeys = systemMappings.filter(m => !m.accountId).map(m => m.mappingKey);
    const allKeys = [...new Set([...SYSTEM_ACCOUNT_KEYS as readonly string[], ...unmappedKeys])];

    for (const key of allKeys) {
      const meta = SYSTEM_MAPPING_META[key];
      if (!meta) continue;
      const existing = systemMappings.find(m => m.mappingKey === key);
      if (existing?.accountId) continue; // already mapped

      let bestMatch: { id: string; code: string; name: string; score: number; reason: string } | null = null;

      for (const acct of coa.accounts) {
        if (!acct.isActive) continue;
        let score = 0;
        const reasons: string[] = [];

        // 1. Code pattern match (strongest signal)
        if (meta.defaultCodePattern) {
          if (acct.code === meta.defaultCodePattern) { score += 50; reasons.push(`exact code ${meta.defaultCodePattern}`); }
          else if (acct.code.startsWith(meta.defaultCodePattern)) { score += 35; reasons.push(`code prefix ${meta.defaultCodePattern}`); }
          else if (meta.defaultCodePattern.startsWith(acct.code)) { score += 15; reasons.push(`partial code match`); }
        }

        // 2. Type match
        if (acct.type === meta.recommendedType) { score += 10; reasons.push(`type=${acct.type}`); }

        // 3. Name keyword matching (per key)
        const nameLower = acct.name.toLowerCase();
        const nepaliLower = (acct as any).nameNepali?.toLowerCase() || '';
        const keyWords: Record<string, string[]> = {
          share_capital: ['share', 'equity', 'शेयर'],
          cash_bank: ['cash', 'bank', 'vault', 'till', 'नगद', 'बैंक', 'कोष'],
          member_savings: ['saving', 'deposit', 'member', 'बचत', 'जम्मा'],
          loan_principal_receivable: ['loan', 'receivable', 'principal', 'ऋण', 'प्राप्य'],
          loan_interest_income: ['interest', 'income', 'ब्याज', 'आय'],
          loan_penalty_income: ['penalty', 'fine', 'late', 'जरिवाना'],
          loan_processing_fee_income: ['processing', 'service', 'fee', 'शुल्क', 'सेवा'],
          savings_interest_expense: ['interest', 'expense', 'savings', 'ब्याज', 'खर्च'],
          dividend_payable: ['dividend', 'payable', 'लाभांश'],
          entrance_fee_income: ['entrance', 'admission', 'प्रवेश'],
          membership_fee_income: ['membership', 'subscription', 'सदस्यता'],
          suspense: ['suspense', 'unallocated', 'अनिर्धारित'],
          retained_earnings: ['retained', 'reserve', 'surplus', 'सञ्चित'],
          profit_loss: ['profit', 'loss', 'p&l', 'नाफा', 'नोक्सान'],
          loan_loss_allowance: ['allowance', 'reserve', 'loan loss', 'प्रावधान'],
          loan_loss_provision_expense: ['provision', 'expense', 'loan loss', 'प्रावधान खर्च'],
        };
        const keywords = keyWords[key] || [];
        for (const kw of keywords) {
          if (nameLower.includes(kw) || nepaliLower.includes(kw)) {
            score += 20;
            reasons.push(`name contains "${kw}"`);
            break;
          }
        }

        // 4. Parent code hint (child accounts inherit parent context)
        if (acct.parentCode) {
          if (meta.defaultCodePattern && acct.parentCode === meta.defaultCodePattern) {
            score += 10;
            reasons.push(`parent=${acct.parentCode}`);
          }
        }

        // 5. System account flag bonus
        if ((acct as any).isSystemAccount) { score += 5; reasons.push('system account'); }

        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { id: acct.id, code: acct.code, name: acct.name, score, reason: reasons.join(', ') };
        }
      }

      if (bestMatch && bestMatch.score >= 20) {
        const confidence = Math.min(100, Math.round((bestMatch.score / 80) * 100));
        suggestions.push({
          mappingKey: key,
          label: meta.label,
          accountId: bestMatch.id,
          accountCode: bestMatch.code,
          accountName: bestMatch.name,
          confidence,
          reason: bestMatch.reason,
        });
      }
    }

    suggestions.sort((a, b) => b.confidence - a.confidence);
    setAutoSuggestions(suggestions);
    setAutoSuggestModalOpen(true);
  }, [systemMappings, coa.accounts]);

  const applyAutoSuggestions = useCallback(() => {
    let count = 0;
    const updated = systemMappings.map(m => {
      const suggestion = autoSuggestions.find(s => s.mappingKey === m.mappingKey);
      if (suggestion && suggestion.accountId) {
        count++;
        return { ...m, accountId: suggestion.accountId };
      }
      return m;
    });
    // Add any new keys that were suggested but not in systemMappings yet
    for (const s of autoSuggestions) {
      if (!s.accountId) continue;
      if (!updated.some(m => m.mappingKey === s.mappingKey)) {
        const meta = SYSTEM_MAPPING_META[s.mappingKey];
        updated.push({
          mappingKey: s.mappingKey,
          mapped: true,
          accountId: s.accountId,
          accountCode: s.accountCode,
          accountName: s.accountName,
          description: meta?.description || null,
          isCustom: !SYSTEM_ACCOUNT_KEYS.includes(s.mappingKey as any),
        });
        count++;
      }
    }
    setSystemMappings(updated);
    setAutoSuggestModalOpen(false);
    setAutoSuggestions([]);
    notify('Auto-Suggested', `Applied ${count} mapping(s). Click "Save Mappings" to persist.`, 'success');
  }, [systemMappings, autoSuggestions, notify]);

  const handleAddCustomMapping = () => {
    const key = newMappingKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!key) { notify('Validation', 'Mapping key is required.', 'alert'); return; }
    if (key.length > 64) { notify('Validation', 'Mapping key must be 64 characters or fewer.', 'alert'); return; }
    if (systemMappings.some(m => m.mappingKey === key)) {
      notify('Duplicate', `Mapping key "${key}" already exists.`, 'alert');
      return;
    }
    const newMapping: SystemMapping = {
      mappingKey: key,
      mapped: !!newMappingAccount,
      accountId: newMappingAccount || null,
      accountCode: null,
      accountName: null,
      description: newMappingDesc.trim() || null,
      isCustom: true,
    };
    setSystemMappings(prev => [...prev, newMapping]);
    setNewMappingKey('');
    setNewMappingDesc('');
    setNewMappingAccount('');
    setAddMappingModalOpen(false);
    notify('Added', `Custom mapping "${key}" added. Click "Save Mappings" to persist.`, 'success');
  };

  // ------------------------------------------------------------------
  // COA tree
  // ------------------------------------------------------------------
  const coaTree = useMemo(() => {
    const map: Record<string, any> = {};
    coa.accounts.forEach((a) => { map[a.code] = { ...a, children: [] as any[], level: 0 }; });
    const roots: any[] = [];
    coa.accounts.forEach((a) => {
      const node = map[a.code];
      if (a.parentCode && map[a.parentCode]) { node.level = map[a.parentCode].level + 1; map[a.parentCode].children.push(node); }
      else { node.level = 1; roots.push(node); }
    });
    const sort = (nodes: any[]) => { nodes.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' })); nodes.forEach((n) => sort(n.children)); };
    sort(roots);
    return roots;
  }, [coa.accounts]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filteredTree = useMemo(() => {
    const term = (search || '').toLowerCase().trim();
    const out: any[] = [];
    const matches = (n: any) => !term || n.code.toLowerCase().includes(term) || n.name.toLowerCase().includes(term) || (n.parentCode || '').toLowerCase().includes(term);
    const traverse = (nodes: any[]) => nodes.forEach((n) => {
      const hasMatch = matches(n) || n.children.some((c: any) => matches(c));
      if (term) {
        if (hasMatch) out.push(n);
        if (hasMatch && (matches(n) || expanded[n.code])) traverse(n.children);
      } else {
        out.push(n);
        if (expanded[n.code]) traverse(n.children);
      }
    });
    traverse(coaTree);
    return out;
  }, [coaTree, search, expanded]);

  // COA add/edit modal state
  const [coaModal, setCoaModal] = useState(false);
  const [coaForm, setCoaForm] = useState<Record<string, any>>({});
  const [coaEditing, setCoaEditing] = useState<ChartAccount | null>(null);
  const [selectedMappingKeyForAccount, setSelectedMappingKeyForAccount] = useState<string>('');

  const openCoaCreate = (parentCode?: string) => {
    setCoaEditing(null);
    const parent = coa.accounts.find((a) => a.code === parentCode);
    setCoaForm({
      code: getNextCoaCode(parentCode || '', coa.accounts),
      name: '',
      nameNepali: '',
      type: parent ? parent.type : 'Asset',
      parentCode: parentCode || '',
      normalBalance: 'debit',
      allowPosting: true,
      isControlAccount: false,
      cashBankAccount: false,
      reconciliationRequired: false,
      costCenterRequired: false,
      displayOrder: 0,
      description: ''
    });
    setSelectedMappingKeyForAccount('');
    setCoaModal(true);
  };

  const openCoaEdit = (a: ChartAccount) => {
    setCoaEditing(a);
    setCoaForm({ ...a });
    const existingKey = Object.keys(SYSTEM_MAPPING_META).find((k) =>
      systemMappings.some((m) => m.mappingKey === k && m.accountId === a.id)
    ) || '';
    setSelectedMappingKeyForAccount(existingKey);
    setCoaModal(true);
  };

  const saveCoa = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await handleCoaSave(coaForm, selectedMappingKeyForAccount);
    if (ok) setCoaModal(false);
  };

  // Bulk COA import + standard seeding
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const refreshCoa = useCallback(async () => {
    await loadCoa();
    await loadMappings();
    await loadHealth();
  }, [loadCoa, loadMappings, loadHealth]);

  const handleSeedStandard = async () => {
    if (seeding) return;
    if (!window.confirm('Load the standard cooperative Chart of Accounts template? Existing accounts with matching GL codes will be preserved.')) return;
    setSeeding(true);
    try {
      const res = await seedDefaultCoa();
      notify('Standard COA Seeded', res.message, 'success');
      await refreshCoa();
    } catch (error: any) {
      notify('Seed Failed', error?.response?.data?.error || error?.message || 'Unable to seed the standard COA.', 'alert');
    } finally {
      setSeeding(false);
    }
  };

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------
  const renderField = (field: FieldDef) => {
    const value = form[field.name] ?? (field.type === 'checkbox' ? false : '');
    const baseCls = 'w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-slate-800 text-xs focus:border-emerald-500 focus:outline-none';

    switch (field.type) {
      case 'select':
        return (
          <select className={baseCls} value={value} onChange={(e) => setField(field.name, e.target.value)}>
            <option value="">-- Select --</option>
            {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case 'coa':
        return (
          <select className={baseCls} value={value} onChange={(e) => setField(field.name, e.target.value || null)}>
            <option value="">-- None --</option>
            {accountOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case 'branch':
        return (
          <select className={baseCls} value={value} onChange={(e) => setField(field.name, e.target.value || null)}>
            <option value="">-- None --</option>
            {branchOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case 'bank':
        return (
          <select className={baseCls} value={value} onChange={(e) => setField(field.name, e.target.value || null)}>
            <option value="">-- Select bank --</option>
            {bankOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case 'voucher-type':
        return (
          <select className={baseCls} value={value} onChange={(e) => setField(field.name, e.target.value || null)}>
            <option value="">-- None --</option>
            {voucherTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case 'cost-center':
        return (
          <select className={baseCls} value={value} onChange={(e) => setField(field.name, e.target.value || null)}>
            <option value="">-- None --</option>
            {costCenterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case 'fiscal-year':
        return (
          <div className="space-y-1.5">
            <select
              className={`${baseCls} bg-emerald-50/60 border-emerald-200 text-emerald-900 font-bold font-mono`}
              value={value}
              onChange={(e) => setField(field.name, e.target.value)}
              required={field.required}
              disabled={fiscalYearOptions.length === 0}
            >
              {fiscalYearOptions.length === 0 && <option value="">-- No open fiscal year --</option>}
              {fiscalYearOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {selectedFiscalYear && (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-semibold">
                <Lock className="w-2.5 h-2.5" />
                <span>Allowed window:</span>
                <span className="font-mono font-bold">{selectedFiscalYear.startDateBS} → {selectedFiscalYear.endDateBS}</span>
              </div>
            )}
          </div>
        );
      case 'checkbox':
        return (
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={!!value} onChange={(e) => setField(field.name, e.target.checked)} className="w-4 h-4 accent-emerald-500 rounded" />
            <span className="font-medium text-slate-700">{field.label}</span>
          </label>
        );
      case 'textarea':
        return <textarea className={`${baseCls} min-h-[72px]`} value={value} placeholder={field.placeholder} onChange={(e) => setField(field.name, e.target.value)} />;
      case 'number':
        return <input type="number" step="any" className={baseCls} value={value ?? ''} placeholder={field.placeholder} onChange={(e) => setField(field.name, e.target.value === '' ? '' : Number(e.target.value))} />;
      default:
        return (
          <div className="relative">
            <input
              type="text"
              className={`${baseCls} ${field.name === 'code' ? 'font-mono font-bold pr-16' : ''}`}
              value={value}
              placeholder={field.placeholder}
              onChange={(e) => setField(field.name, e.target.value)}
              required={field.required}
            />
            {field.name === 'code' && currentEntity && (
              <button
                type="button"
                onClick={() => {
                  const existingRows = settings[currentEntity ?? ''] ?? [];
                  setField('code', getNextEntityCode(currentEntity, existingRows));
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-700 font-bold bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
                title="Auto-generate next code"
              >
                <Sparkles className="w-2.5 h-2.5" /> Auto
              </button>
            )}
          </div>
        );
    }
  };

  const renderTable = (columns: { key: string; label: string; render?: (row: any) => React.ReactNode }[]) => (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm text-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[820px]">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
            <tr>{columns.map((c) => <th key={c.key} className="p-3.5">{c.label}</th>)}<th className="p-3.5 text-center w-28">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="p-8 text-center text-slate-500">No records yet. Click “Add New” to create one.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-100/40 transition">
                  {columns.map((c) => <td key={c.key} className="p-3">{c.render ? c.render(row) : String(row[c.key] ?? '')}</td>)}
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => openEdit(row)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition cursor-pointer" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(row)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const tableShell = (columns: { key: string; label: string; render?: (row: any) => React.ReactNode }[]) => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          {TITLES[subTab]?.icon}
          <div>
            <h3 className="font-bold text-slate-900 text-sm">{TITLES[subTab]?.title}</h3>
            <p className="text-[11px] text-slate-500">{TITLES[subTab]?.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none" />
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md">
            <Plus className="w-4 h-4" /> Add New
          </button>
        </div>
      </div>
      {renderTable(columns)}
    </div>
  );

  // ------------------------------------------------------------------
  // Modal Fields
  // ------------------------------------------------------------------
  const modalFields = fieldsFor(currentEntity);
  const isJournal = currentEntity === 'journal-templates';

  return (
    <div className="space-y-6">
      {/* Bank account detail view — override main content when active */}
      {bankAccountId && (
        <BankAccountDetailView bankAccountId={bankAccountId} onBack={() => setBankAccountId(null)} />
      )}

      {!bankAccountId && (
      <>
      {/* Health warning strip */}
      {health && !health.healthy && (
        <div className="flex items-start gap-3 bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 text-amber-800 text-xs shadow-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            {health.warnings.map((w, i) => <div key={i}>{w}</div>)}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-500 text-xs py-16">Loading accounting configuration…</div>
      ) : (
        <>
          {subTab === 'setup_accounting_dashboard' && <DashboardTab health={health} coa={coa} />}

          {/* Combined COA & Mapping View */}
          {subTab === 'setup_coa' && (
            <div className="space-y-4">
              {/* Header with View Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                    <FolderTree className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Chart of Accounts & System Mappings</h3>
                    <p className="text-[11px] text-slate-500">
                      Manage ledger tree classifications and configure module postings (Share, Savings, Loans, Cash/Bank).
                    </p>
                  </div>
                </div>

                {/* Sub-tab view toggle (Hierarchy Tree vs System Mappings) */}
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCoaViewMode('tree')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      coaViewMode === 'tree'
                        ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FolderTree className="w-3.5 h-3.5" />
                    <span>Hierarchy Tree</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoaViewMode('mappings')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      coaViewMode === 'mappings'
                        ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>System Mappings</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                      {systemMappings.filter(m => m.accountId).length}/{systemMappings.length}
                    </span>
                  </button>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {coaViewMode === 'tree' ? (
                    <>
                      <button onClick={() => setExpanded({})} className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition cursor-pointer">Collapse</button>
                      <button onClick={() => { const all: Record<string, boolean> = {}; coa.accounts.forEach((a) => { all[a.code] = true; }); setExpanded(all); }} className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition cursor-pointer">Expand</button>
                      <button onClick={() => setBulkModalOpen(true)} className="px-3 py-2 bg-white hover:bg-slate-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm"><UploadCloud className="w-4 h-4" /> Import CSV</button>
                      <button onClick={handleSeedStandard} disabled={seeding} className="px-3 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-60"><Wand2 className="w-4 h-4" /> {seeding ? 'Seeding…' : 'Seed Template'}</button>
                      <button onClick={() => openCoaCreate()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md"><Plus className="w-4 h-4" /> Add Root Account</button>
                    </>
                  ) : (
                    <>
                      <button onClick={computeAutoSuggestions} className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm">
                        <Sparkles className="w-4 h-4" /> Auto-Suggest Mappings
                      </button>
                      <button onClick={saveMappings} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md">
                        <Save className="w-4 h-4" /> Save Mappings
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* View 1: Tree View */}
              {coaViewMode === 'tree' && (
                <>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by GL code or account name…" className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none shadow-sm" />
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm text-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[960px]">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                          <tr>
                            <th className="p-3.5 w-[340px]">GL Code & Hierarchy</th>
                            <th className="p-3.5">Name</th>
                            <th className="p-3.5">Type</th>
                            <th className="p-3.5">System Wiring</th>
                            <th className="p-3.5">Posting</th>
                            <th className="p-3.5 text-right">Balance</th>
                            <th className="p-3.5 text-center w-36">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-700 font-mono">
                          {coa.accounts.length === 0 ? (
                            <tr>
                              <td colSpan={7}>
                                <div className="p-8">
                                  <div className="max-w-2xl mx-auto text-center bg-gradient-to-br from-emerald-50 via-white to-indigo-50 border border-emerald-100 rounded-2xl p-8">
                                    <div className="w-12 h-12 mx-auto mb-3 bg-emerald-600/10 rounded-2xl flex items-center justify-center"><FolderTree className="w-6 h-6 text-emerald-600" /></div>
                                    <h3 className="font-bold text-slate-900 text-sm">No chart of accounts yet.</h3>
                                    <p className="text-[11px] text-slate-500 mt-1">Load the standard cooperative COA template with pre-wired system mappings or upload your CSV.</p>
                                    <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                                      <button onClick={handleSeedStandard} disabled={seeding} className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md transition cursor-pointer"><Wand2 className="w-4 h-4" /> {seeding ? 'Seeding…' : 'Seed Standard Cooperative Template'}</button>
                                      <button onClick={() => setBulkModalOpen(true)} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md transition cursor-pointer"><UploadCloud className="w-4 h-4" /> Upload Excel/CSV Template</button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : filteredTree.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-500 font-sans">No accounts match your current filter criteria.</td></tr>
                          ) : filteredTree.map((node) => {
                            const hasChildren = node.children.length > 0;
                            const isExpanded = !!expanded[node.code];
                            const isMajor = !node.parentCode || node.code.split('-').length === 1;
                            const mappedKeys = accountToMappingMap[node.id] || [];

                            return (
                              <tr key={node.code} className={`transition ${isMajor ? 'bg-slate-50 font-bold border-t border-slate-200 text-slate-900' : 'hover:bg-slate-100 text-slate-600'}`}>
                                <td className="p-3 font-sans">
                                  <div className="flex items-center gap-1.5" style={{ paddingLeft: `${(node.level - 1) * 20}px` }}>
                                    {hasChildren ? (
                                      <button onClick={() => setExpanded((p) => ({ ...p, [node.code]: !p[node.code] }))} className="p-1 hover:bg-slate-100 rounded transition cursor-pointer">
                                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-emerald-600" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                                      </button>
                                    ) : <span className="w-5 text-slate-600 text-center">└</span>}
                                    <span className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded border ${isMajor ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : node.children.length ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-slate-100 text-teal-700 border-slate-300'}`}>{node.code}</span>
                                    {node.isSystemAccount && <Lock className="w-3 h-3 text-slate-500" />}
                                    {node.isActive === false && <span className="text-[9px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">inactive</span>}
                                  </div>
                                </td>
                                <td className="p-3 font-sans font-semibold"><span className={isMajor ? 'text-emerald-700' : 'text-slate-700'}>{node.name}</span></td>
                                <td className="p-3 font-sans"><TypeBadge type={node.type} /></td>
                                <td className="p-3 font-sans">
                                  {mappedKeys.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {mappedKeys.map((mk) => (
                                        <span key={mk} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200" title={SYSTEM_MAPPING_META[mk]?.description || mk}>
                                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                          {SYSTEM_MAPPING_META[mk]?.label?.split(' ')[0] || mk}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="p-3 font-sans">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${node.allowPosting !== false ? 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-600 border-rose-500/30 bg-rose-500/10'}`}>{node.allowPosting !== false ? 'Posting' : 'Non-posting'}</span>
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-slate-800">{formatNPR(node.balance)}</td>
                                <td className="p-3 text-center font-sans">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => openQuickMap(node)} className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition cursor-pointer" title="Wire / Map this Account to System Feature"><Link2 className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => openCoaCreate(node.code)} className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-lg transition cursor-pointer" title={`Add sub-account under ${node.code}`}><Plus className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => openCoaEdit(node)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition cursor-pointer" title="Edit Account"><Edit3 className="w-3.5 h-3.5" /></button>
                                    {!node.isSystemAccount && <button onClick={() => handleCoaDelete(node)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* View 2: System Account Mappings Table (Inside COA View) */}
              {coaViewMode === 'mappings' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-xl text-xs text-emerald-900 flex items-start gap-3">
                    <Info className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Automated Posting Wiring for Sahakari Modules</p>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        These chart accounts receive automatic debit/credit entries whenever teller transactions, loan disbursements, repayments, share purchases, or interest runs take place.
                      </p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm text-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[840px]">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                          <tr>
                            <th className="p-3.5 w-64">System Mapping Purpose</th>
                            <th className="p-3.5 w-24">Type</th>
                            <th className="p-3.5">Functional Role & Description</th>
                            <th className="p-3.5 w-24 text-center">Status</th>
                            <th className="p-3.5 w-[380px]">Assigned GL Account</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-700">
                          {systemMappings.map((m) => {
                            const meta = SYSTEM_MAPPING_META[m.mappingKey] || {
                              label: m.mappingKey,
                              description: 'Module posting wiring',
                              category: 'Account',
                              recommendedType: 'Asset'
                            };

                            return (
                              <tr key={m.mappingKey} className="hover:bg-slate-50 transition">
                                <td className="p-3.5">
                                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{meta.label}</span>
                                  </div>
                                  <div className="font-mono text-[10px] text-slate-400 mt-0.5">{m.mappingKey}</div>
                                </td>
                                <td className="p-3.5">
                                  <TypeBadge type={meta.recommendedType} />
                                </td>
                                <td className="p-3.5 text-slate-500 text-[11px] leading-relaxed">
                                  {meta.description}
                                </td>
                                <td className="p-3.5 text-center">
                                  {m.accountId ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold inline-flex items-center gap-1">
                                      <Check className="w-2.5 h-2.5" /> Mapped
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 font-bold">
                                      Unmapped
                                    </span>
                                  )}
                                </td>
                                <td className="p-3.5">
                                  <select
                                    value={m.accountId ?? ''}
                                    onChange={(e) => setMappingAccount(m.mappingKey, e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 font-mono text-xs focus:border-emerald-500 focus:bg-white focus:outline-none transition shadow-sm"
                                  >
                                    <option value="">-- Unassigned (Not Mapped) --</option>
                                    {accountOptions.map((o) => (
                                      <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {subTab === 'setup_account_groups' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2"><Layers className="w-5 h-5 text-emerald-600" /><div><h3 className="font-bold text-slate-900 text-sm">Account Groups</h3><p className="text-[11px] text-slate-500">Top-level classification groups used by the chart of accounts.</p></div></div>
                <button onClick={openGroupCreate} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md"><Plus className="w-4 h-4" /> Add Group</button>
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                      <tr><th className="p-3.5">Code</th><th className="p-3.5">Name</th><th className="p-3.5">Type</th><th className="p-3.5">Parent</th><th className="p-3.5 text-center w-28">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {coa.groups.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">No account groups yet.</td></tr> : coa.groups.map((g) => (
                        <tr key={g.id} className="hover:bg-slate-100/40 transition">
                          <td className="p-3 font-mono font-bold text-emerald-600">{g.code}</td>
                          <td className="p-3 font-semibold">{g.name}</td>
                          <td className="p-3"><TypeBadge type={g.type} /></td>
                          <td className="p-3 text-slate-500">{g.parentId ? coa.groups.find((p) => p.id === g.parentId)?.name || '—' : '—'}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => openGroupEdit(g)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition cursor-pointer"><Edit3 className="w-3.5 h-3.5" /></button>
                              {!g.isSystem && <button onClick={() => deleteGroup(g)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {subTab === 'setup_voucher_types' && tableShell([
            { key: 'code', label: 'Code', render: (r) => <span className="font-mono font-bold text-emerald-600">{r.code}</span> },
            { key: 'name', label: 'Name' },
            { key: 'category', label: 'Category', render: (r) => <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-200/30 bg-emerald-50/10 text-emerald-600 font-bold">{r.category}</span> },
            { key: 'prefix', label: 'Prefix', render: (r) => <span className="font-mono font-bold">{r.prefix}</span> },
            { key: 'numberingRule', label: 'Numbering', render: (r) => <span className="text-[10px] text-slate-500">{r.numberingRule}</span> },
            { key: 'isSystem', label: 'System', render: (r) => r.isSystem ? <Lock className="w-3 h-3 text-slate-500" /> : <span className="text-slate-600">—</span> },
          ])}

          {subTab === 'setup_cost_centers' && tableShell([
            { key: 'code', label: 'Code', render: (r) => <span className="font-mono font-bold text-emerald-600">{r.code}</span> },
            { key: 'name', label: 'Name' },
            { key: 'branchId', label: 'Branch', render: (r) => branchOptions.find((b) => b.value === r.branchId)?.label?.split(' — ')[1] ?? '—' },
            { key: 'parentId', label: 'Parent', render: (r) => costCenterOptions.find((c) => c.value === r.parentId)?.label?.split(' — ')[1] ?? '—' },
            { key: 'managerName', label: 'Manager', render: (r) => r.managerName || '—' },
          ])}

          {subTab === 'setup_journal_templates' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-emerald-600" /><div><h3 className="font-bold text-slate-900 text-sm">Journal Templates</h3><p className="text-[11px] text-slate-500">Reusable entry templates. Debits must balance credits.</p></div></div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none" />
                  </div>
                  <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md"><Plus className="w-4 h-4" /> Add Template</button>
                </div>
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[820px]">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                      <tr><th className="p-3.5">Code</th><th className="p-3.5">Name</th><th className="p-3.5">Voucher Type</th><th className="p-3.5">Frequency</th><th className="p-3.5">Entries</th><th className="p-3.5 text-center w-28">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {rows.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">No journal templates yet.</td></tr> : rows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-100/40 transition">
                          <td className="p-3 font-mono font-bold text-emerald-600">{row.code}</td>
                          <td className="p-3 font-semibold">{row.name}</td>
                          <td className="p-3">{voucherTypeOptions.find((v) => v.value === row.voucherTypeId)?.label?.split(' — ')[1] ?? '—'}</td>
                          <td className="p-3"><span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">{row.frequency}</span></td>
                          <td className="p-3 text-slate-500">{Array.isArray(row.entries) ? row.entries.length : 0} line(s)</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => openEdit(row)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition cursor-pointer"><Edit3 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDelete(row)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {subTab === 'setup_fin_periods' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2"><CalendarRange className="w-5 h-5 text-emerald-600" /><div><h3 className="font-bold text-slate-900 text-sm">Financial Periods</h3><p className="text-[11px] text-slate-500">Voucher posting requires an open period. Lock/close protects the ledger.</p></div></div>
                <div className="flex items-center gap-3">
                  {!hasOpenFiscalYear && (
                    <span className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      No open fiscal year. Create one first.
                    </span>
                  )}
                  <button
                    onClick={openCreate}
                    disabled={!hasOpenFiscalYear}
                    title={!hasOpenFiscalYear ? 'No open fiscal year available. Create an active fiscal year first.' : 'Add a new financial period'}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md"
                  >
                    <Plus className="w-4 h-4" /> Add Period
                  </button>
                </div>
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                      <tr><th className="p-3.5">Code</th><th className="p-3.5">Name</th><th className="p-3.5">FY</th><th className="p-3.5">BS Range</th><th className="p-3.5">AD Range</th><th className="p-3.5">Status</th><th className="p-3.5 text-center">Current</th><th className="p-3.5 text-center w-56">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {rows.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-slate-500">No financial periods yet. Create one and open it to enable posting.</td></tr> : rows.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-100/40 transition">
                          <td className="p-3 font-mono font-bold text-emerald-600">{p.code}</td>
                          <td className="p-3 font-semibold">{p.name}</td>
                          <td className="p-3 text-slate-500 font-mono">{p.fiscalYearCode}</td>
                          <td className="p-3 font-mono text-slate-700 font-medium">{p.startDateBs} → {p.endDateBs}</td>
                          <td className="p-3 font-mono text-slate-500 text-[11px]">{p.startDateAd} → {p.endDateAd}</td>
                          <td className="p-3"><StatusBadge status={p.status} /></td>
                          <td className="p-3 text-center">{p.isCurrent ? <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" /> : <span className="text-slate-400">—</span>}</td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <button onClick={() => openEdit(p)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition cursor-pointer" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                              {p.status === 'draft' && <button onClick={() => doTransition(p, 'open')} className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold transition cursor-pointer">Open</button>}
                              {p.status === 'open' && <button onClick={() => doTransition(p, 'locked')} className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 rounded-lg text-[10px] font-bold transition cursor-pointer">Lock</button>}
                              {(p.status === 'open' || p.status === 'locked') && <button onClick={() => doTransition(p, 'closed')} className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-[10px] font-bold transition cursor-pointer">Close</button>}
                              {p.status === 'closed' && <button onClick={() => doTransition(p, 'reopen')} className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-600 border border-teal-200 rounded-lg text-[10px] font-bold transition cursor-pointer">Reopen</button>}
                              {p.status === 'locked' && <button onClick={() => doTransition(p, 'open')} className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold transition cursor-pointer">Open</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {subTab === 'setup_bank_list' && tableShell([
            { key: 'code', label: 'Code', render: (r) => <span className="font-mono font-bold text-emerald-600">{r.code}</span> },
            { key: 'name', label: 'Name' },
            { key: 'shortName', label: 'Short Name', render: (r) => r.shortName || '—' },
            { key: 'swiftCode', label: 'SWIFT', render: (r) => <span className="font-mono">{r.swiftCode || '—'}</span> },
            { key: 'isSystem', label: 'System', render: (r) => r.isSystem ? <Lock className="w-3 h-3 text-slate-500" /> : <span className="text-slate-600">—</span> },
          ])}

          {subTab === 'setup_bank_accounts' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2"><Banknote className="w-5 h-5 text-emerald-600" /><div><h3 className="font-bold text-slate-900 text-sm">Bank Accounts</h3><p className="text-[11px] text-slate-500">Branch bank accounts linked to GL accounts.</p></div></div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none" />
                  </div>
                  <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md"><Plus className="w-4 h-4" /> Add Bank Account</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {rows.length === 0 ? <div className="col-span-full text-center text-slate-500 text-xs py-12">No bank accounts yet.</div> : rows.map((b: BankAccount) => (
                  <div key={b.id} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3.5 shadow-sm hover:border-emerald-200 transition">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-emerald-600" /><span className="font-bold text-slate-900 text-sm">{b.accountName}</span></div>
                      <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold">{b.accountType}</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex justify-between"><span className="text-slate-500">Account No:</span><span className="font-mono text-emerald-700 font-bold">{b.accountNumber}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Bank:</span><span className="text-slate-700">{bankOptions.find((o) => o.value === b.bankId)?.label?.split(' — ')[1] ?? '—'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Branch:</span><span className="text-slate-700">{branchOptions.find((o) => o.value === b.branchId)?.label?.split(' — ')[1] ?? '—'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Currency:</span><span className="text-slate-700">{b.currency}</span></div>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-slate-500 text-xs">Opening Balance:</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">{formatNPR(b.openingBalance)}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setBankAccountId(b.id)} className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition cursor-pointer" title="View Details"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => openEdit(b)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition cursor-pointer" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                      {!b.isSystem && <button onClick={() => handleDelete(b)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subTab === 'setup_cash_counters' && tableShell([
            { key: 'code', label: 'Code', render: (r) => <span className="font-mono font-bold text-emerald-600">{r.code}</span> },
            { key: 'name', label: 'Name' },
            { key: 'branchId', label: 'Branch', render: (r) => branchOptions.find((b) => b.value === r.branchId)?.label?.split(' — ')[1] ?? '—' },
            { key: 'openingBalance', label: 'Opening', render: (r) => <span className="font-mono">{formatNPR(r.openingBalance)}</span> },
            { key: 'maxCashLimit', label: 'Max Limit', render: (r) => r.maxCashLimit != null ? <span className="font-mono">{formatNPR(r.maxCashLimit)}</span> : '—' },
          ])}

          {subTab === 'setup_payment_methods' && tableShell([
            { key: 'code', label: 'Code', render: (r) => <span className="font-mono font-bold text-emerald-600">{r.code}</span> },
            { key: 'name', label: 'Name' },
            { key: 'type', label: 'Type', render: (r) => <span className="text-[10px] px-2 py-0.5 rounded-full border border-teal-200/30 bg-teal-50/10 text-teal-600 font-bold">{r.type}</span> },
            { key: 'requirements', label: 'Requirements', render: (r) => <span className="text-slate-500">{[r.requiresReference && 'Ref', r.requiresBank && 'Bank', r.requiresChequeNumber && 'Cheque', r.requiresTransactionId && 'TxnID'].filter(Boolean).join(', ') || '—'}</span> },
          ])}

          {subTab === 'setup_system_mappings' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /><div><h3 className="font-bold text-slate-900 text-sm">System Account Mappings</h3><p className="text-[11px] text-slate-500">Module postings (share capital, cash/bank, loan interest…) route through these accounts.</p></div></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAddMappingModalOpen(true)} className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm"><Plus className="w-4 h-4" /> Add Mapping</button>
                      <button onClick={computeAutoSuggestions} className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm"><Sparkles className="w-4 h-4" /> Auto-Suggest</button>
                  <button onClick={saveMappings} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md"><Save className="w-4 h-4" /> Save Mappings</button>
                </div>
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[820px]">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                      <tr><th className="p-3.5">Mapping Key</th><th className="p-3.5">Purpose & Description</th><th className="p-3.5">Status</th><th className="p-3.5 w-[380px]">Linked Chart Account</th><th className="p-3.5 w-[50px]"></th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {systemMappings.map((m) => {
                        const meta = SYSTEM_MAPPING_META[m.mappingKey];
                        return (
                          <tr key={m.mappingKey} className={`hover:bg-slate-100/40 transition ${m.isCustom ? 'bg-indigo-50/30' : ''}`}>
                            <td className="p-3 font-mono font-bold text-emerald-600">
                              <div>{m.mappingKey}{m.isCustom && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 font-bold align-middle">Custom</span>}</div>
                              {meta && <div className="font-sans font-semibold text-slate-700 text-xs">{meta.label}</div>}
                            </td>
                            <td className="p-3 text-slate-500 text-[11px] max-w-xs">{meta?.description || m.description || '—'}</td>
                            <td className="p-3">{m.accountId ? <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-200/30 bg-emerald-50/10 text-emerald-600 font-bold">Mapped</span> : <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-200/30 bg-amber-50/10 text-amber-600 font-bold">Unmapped</span>}</td>
                            <td className="p-3">
                              <select value={m.accountId ?? ''} onChange={(e) => setMappingAccount(m.mappingKey, e.target.value)} className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2 text-slate-800 text-xs focus:border-emerald-500 focus:outline-none">
                                <option value="">-- Not mapped --</option>
                                {accountOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </td>
                            <td className="p-3 text-center">
                              {m.isCustom && (
                                <button onClick={() => setSystemMappings(prev => prev.filter(x => x.mappingKey !== m.mappingKey))} className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-500 hover:text-rose-700 transition cursor-pointer" title="Remove custom mapping">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Custom mapping modal */}
          {addMappingModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 text-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-lg font-bold text-slate-900">Add Custom Mapping</h3>
                  </div>
                  <button onClick={() => setAddMappingModalOpen(false)} className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-slate-700 font-bold">Mapping Key * <span className="font-normal text-slate-500">(lowercase, underscores only)</span></label>
                    <input
                      value={newMappingKey}
                      onChange={e => setNewMappingKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:border-emerald-500 focus:outline-none"
                      placeholder="e.g. recurring_deposit_income"
                      maxLength={64}
                    />
                    {newMappingKey && (
                      <span className="text-[10px] text-slate-400 font-mono">Preview: {newMappingKey || '—'}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-700 font-bold">Description</label>
                    <input
                      value={newMappingDesc}
                      onChange={e => setNewMappingDesc(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:border-emerald-500 focus:outline-none"
                      placeholder="Brief purpose of this mapping"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-700 font-bold">Linked Chart Account</label>
                    <select
                      value={newMappingAccount}
                      onChange={e => setNewMappingAccount(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">-- Not mapped --</option>
                      {accountOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button onClick={() => setAddMappingModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer">Cancel</button>
                  <button onClick={handleAddCustomMapping} disabled={!newMappingKey.trim()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md">Add Mapping</button>
                </div>
              </div>
            </div>
          )}

          {/* Auto-Suggest Preview Modal */}
          {autoSuggestModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl p-6 text-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-bold text-slate-900">Auto-Suggest Mappings</h3>
                  </div>
                  <button onClick={() => { setAutoSuggestModalOpen(false); setAutoSuggestions([]); }} className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"><X className="w-5 h-5" /></button>
                </div>

                {autoSuggestions.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-700">All system accounts are already mapped.</p>
                    <p className="text-xs text-slate-500 mt-1">No unmapped keys found to suggest.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-slate-500">
                      Found <strong>{autoSuggestions.length}</strong> unmapped system key(s). Review the suggestions below, then click Apply.
                    </p>
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10px] uppercase tracking-wider sticky top-0">
                          <tr>
                            <th className="p-3">System Key</th>
                            <th className="p-3">Suggested Account</th>
                            <th className="p-3 w-[80px]">Confidence</th>
                            <th className="p-3 w-[40px]">
                              <input
                                type="checkbox"
                                checked={autoSuggestions.every(s => s.accountId)}
                                onChange={(e) => {
                                  if (e.target.checked) return; // all already selected
                                  setAutoSuggestions(prev => prev.map(s => ({ ...s, accountId: null })));
                                }}
                                className="rounded border-slate-300"
                              />
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {autoSuggestions.map(s => (
                            <tr key={s.mappingKey} className={`transition ${s.accountId ? 'bg-white' : 'bg-slate-50/50'}`}>
                              <td className="p-3">
                                <div className="font-mono font-bold text-indigo-600">{s.mappingKey}</div>
                                <div className="text-[10px] text-slate-500">{s.label}</div>
                              </td>
                              <td className="p-3">
                                {s.accountId ? (
                                  <div>
                                    <span className="font-mono text-emerald-600 font-bold">{s.accountCode}</span>
                                    <span className="text-slate-600 ml-1.5">{s.accountName}</span>
                                    <div className="text-[9px] text-slate-400 mt-0.5">{s.reason}</div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">No match found</span>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition ${
                                        s.confidence >= 70 ? 'bg-emerald-500' : s.confidence >= 40 ? 'bg-amber-500' : 'bg-slate-400'
                                      }`}
                                      style={{ width: `${s.confidence}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-600">{s.confidence}%</span>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={!!s.accountId}
                                  onChange={(e) => {
                                    setAutoSuggestions(prev => prev.map(x =>
                                      x.mappingKey === s.mappingKey ? { ...x, accountId: e.target.checked ? x.accountId : null } : x
                                    ));
                                  }}
                                  className="rounded border-slate-300"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button onClick={() => { setAutoSuggestModalOpen(false); setAutoSuggestions([]); }} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer">Cancel</button>
                  {autoSuggestions.length > 0 && (
                    <button
                      onClick={applyAutoSuggestions}
                      disabled={autoSuggestions.filter(s => s.accountId).length === 0}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Apply {autoSuggestions.filter(s => s.accountId).length} Mapping(s)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Generic catalog modal (Financial Periods, Voucher Types, etc.) */}
          {modalOpen && currentEntity && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
              <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl p-6 text-slate-800 space-y-5 animate-in fade-in duration-200 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    {TITLES[subTab]?.icon}
                    <h3 className="text-lg font-bold text-slate-900">{editing ? `Edit ${entityLabel}` : `Add ${entityLabel}`}</h3>
                  </div>
                  <button onClick={() => setModalOpen(false)} className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSave} className="space-y-4 text-xs">
                  {/* Rule 1 — no-open-FY guard (create only) */}
                  {periodGuardActive && (
                    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-[11px] font-semibold">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-amber-900">No open fiscal year available</p>
                        <p className="mt-1 text-amber-700">A financial period is a child entry of a fiscal year — it cannot exist on its own. Go to <strong>Setup &rarr; Fiscal Years</strong>, create or reactivate a fiscal year, then try again.</p>
                      </div>
                    </div>
                  )}

                  {/* Rule 2 — boundary violation alert */}
                  {!periodGuardActive && currentEntity === 'financial-periods' && periodErrorList.length > 0 && (
                    <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-[11px] font-semibold">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-rose-900">Dates outside fiscal year boundary</p>
                        {periodErrorList.map((msg, i) => <p key={i} className="mt-1 text-rose-700">{msg}</p>)}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {modalFields.map((f) => (
                      <div key={f.name} className={f.span2 ? 'sm:col-span-2' : ''}>
                        {f.type !== 'checkbox' && (
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-slate-700 font-bold">
                              {f.label}{f.required && <span className="text-emerald-600">*</span>}
                            </label>
                            {/* Visual hint for auto-converted dates */}
                            {(f.name === 'startDateAd' || f.name === 'endDateAd') && currentEntity === 'financial-periods' && (
                              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                                <Sparkles className="w-2.5 h-2.5" /> Auto-converted from BS
                              </span>
                            )}
                            {/* Fiscal year lock hint for start/end date fields */}
                            {(f.name === 'startDateBs' || f.name === 'endDateBs') && selectedFiscalYear && (
                              <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" /> Clamped to FY {selectedFiscalYear.code}
                              </span>
                            )}
                          </div>
                        )}
                        {renderField(f)}
                        {f.hint && <p className="text-[10px] text-slate-500 mt-1">{f.hint}</p>}
                        {/* Inline boundary error for individual fields */}
                        {periodFieldErrors[f.name] && (
                          <p className="text-[10px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> {periodFieldErrors[f.name]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {isJournal && (
                    <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/50">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Template Entries</span>
                        <button type="button" onClick={() => setEntries((prev) => [...prev, { accountId: '', accountCode: '', accountName: '', entryType: 'debit', amountType: 'amount', amount: 0, costCenterId: null, description: null, sortOrder: prev.length }])} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg transition cursor-pointer"><Plus className="w-3 h-3 inline" /> Line</button>
                      </div>
                      {entries.length === 0 && <div className="text-slate-500 text-[11px]">No entry lines yet. Add at least one debit and one credit (amount-based) to keep the template balanced.</div>}
                      {entries.map((entry, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-6">
                            <select value={entry.accountId} onChange={(e) => {
                              const acc = coa.accounts.find((a) => a.id === e.target.value);
                              setEntries((prev) => prev.map((en, i) => i === idx ? { ...en, accountId: e.target.value, accountCode: acc?.code ?? '', accountName: acc?.name ?? '' } : en));
                            }} className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-1.5 text-slate-800 text-[11px] focus:border-emerald-500 focus:outline-none">
                              <option value="">-- Account --</option>
                              {accountOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          <div className="col-span-2">
                            <select value={entry.entryType} onChange={(e) => setEntries((prev) => prev.map((en, i) => i === idx ? { ...en, entryType: e.target.value } : en))} className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-1.5 text-slate-800 text-[11px] focus:border-emerald-500 focus:outline-none">
                              <option value="debit">Dr</option>
                              <option value="credit">Cr</option>
                            </select>
                          </div>
                          <div className="col-span-3">
                            <input type="number" step="any" min="0" value={entry.amount ?? ''} onChange={(e) => setEntries((prev) => prev.map((en, i) => i === idx ? { ...en, amount: Number(e.target.value) || 0 } : en))} placeholder="Amount" className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-1.5 text-slate-800 font-mono text-[11px] focus:border-emerald-500 focus:outline-none" />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button type="button" onClick={() => setEntries((prev) => prev.filter((_, i) => i !== idx))} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                        <span>Debit: <span className="font-mono text-emerald-600">{formatNPR(entries.filter((e) => e.entryType === 'debit').reduce((s, e) => s + (Number(e.amount) || 0), 0))}</span></span>
                        <span>Credit: <span className="font-mono text-rose-600">{formatNPR(entries.filter((e) => e.entryType === 'credit').reduce((s, e) => s + (Number(e.amount) || 0), 0))}</span></span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 mt-2">
                    <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
                    <button type="submit" disabled={saving} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"><Save className="w-4 h-4" /> {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Quick Mapping Modal for single COA account */}
          {quickMapModalOpen && quickMapTargetAccount && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 text-slate-800 space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <Link2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Map System Account</h3>
                      <p className="text-[11px] text-slate-500">Wire this GL account to automatic system postings</p>
                    </div>
                  </div>
                  <button onClick={() => setQuickMapModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Selected Ledger Account</div>
                  <div className="font-mono font-bold text-emerald-700 text-xs">{quickMapTargetAccount.code}</div>
                  <div className="font-semibold text-slate-900 text-sm">{quickMapTargetAccount.name}</div>
                  <div className="pt-1"><TypeBadge type={quickMapTargetAccount.type} /></div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Select System Posting Function</label>
                  <select
                    value={quickMapSelectedKey}
                    onChange={(e) => setQuickMapSelectedKey(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-semibold focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- None (Do Not Map) --</option>
                    {Object.entries(SYSTEM_MAPPING_META).map(([key, meta]) => (
                      <option key={key} value={key}>
                        {meta.label} ({meta.category})
                      </option>
                    ))}
                  </select>
                  {quickMapSelectedKey && SYSTEM_MAPPING_META[quickMapSelectedKey] && (
                    <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                      💡 {SYSTEM_MAPPING_META[quickMapSelectedKey].description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setQuickMapModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyQuickMap}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" /> Apply Mapping
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Chart of Account Add / Edit Modal */}
          {coaModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
              <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl p-6 text-slate-800 space-y-5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2"><FolderTree className="w-5 h-5 text-emerald-600" /><h3 className="text-lg font-bold text-slate-900">{coaEditing ? 'Edit Chart Account' : 'Add Chart Account'}</h3></div>
                  <button onClick={() => setCoaModal(false)} className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={saveCoa} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Parent Account Code</label>
                      <select value={coaForm.parentCode ?? ''} onChange={(e) => {
                        const parent = coa.accounts.find((a) => a.code === e.target.value);
                        setCoaForm((p) => ({ ...p, parentCode: e.target.value, type: parent ? parent.type : p.type }));
                      }} className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-mono focus:border-emerald-500 focus:outline-none">
                        <option value="">-- None (Root) --</option>
                        {coa.accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Classification Type</label>
                      <select value={coaForm.type} onChange={(e) => setCoaForm((p) => ({ ...p, type: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-semibold focus:border-emerald-500 focus:outline-none">
                        {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">GL Code <span className="text-emerald-600">*</span></label>
                      <div className="relative">
                        <input
                          value={coaForm.code ?? ''}
                          onChange={(e) => setCoaForm((p) => ({ ...p, code: e.target.value }))}
                          placeholder={coaForm.parentCode ? `e.g. ${coaForm.parentCode}-001` : 'e.g. 10-00-000'}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2.5 pr-16 text-emerald-700 font-mono font-bold focus:border-emerald-500 focus:outline-none"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setCoaForm((p) => ({ ...p, code: getNextCoaCode(p.parentCode ?? '', coa.accounts) }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-700 font-bold bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
                          title="Auto-generate next GL code"
                        >
                          <Sparkles className="w-2.5 h-2.5" /> Auto
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Account Name <span className="text-emerald-600">*</span></label>
                      <input value={coaForm.name ?? ''} onChange={(e) => setCoaForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Cash in Hand" className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none" required />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-600 font-bold mb-1">Nepali Name</label>
                      <input value={coaForm.nameNepali ?? ''} onChange={(e) => setCoaForm((p) => ({ ...p, nameNepali: e.target.value }))} placeholder="उदा: नगद मौजदात" className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none" />
                    </div>

                    {/* Integrated System Mapping Dropdown in Account Edit */}
                    <div className="sm:col-span-2 bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
                      <label className="block text-emerald-900 font-bold mb-1 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        System Account Mapping Wiring (Optional)
                      </label>
                      <select
                        value={selectedMappingKeyForAccount}
                        onChange={(e) => setSelectedMappingKeyForAccount(e.target.value)}
                        className="w-full bg-white border border-emerald-300 rounded-lg p-2 text-slate-800 text-xs focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="">-- Do Not Wire to System Function --</option>
                        {Object.entries(SYSTEM_MAPPING_META).map(([key, meta]) => (
                          <option key={key} value={key}>
                            {meta.label} ({meta.category}) — {meta.description}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-emerald-700 mt-1">
                        Automatically links this account to auto-posting modules (Teller deposits, loan repayments, share issues, etc.).
                      </p>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Normal Balance</label>
                      <select value={coaForm.normalBalance ?? 'debit'} onChange={(e) => setCoaForm((p) => ({ ...p, normalBalance: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none">
                        <option value="debit">Debit</option>
                        <option value="credit">Credit</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Display Order</label>
                      <input type="number" value={coaForm.displayOrder ?? 0} onChange={(e) => setCoaForm((p) => ({ ...p, displayOrder: Number(e.target.value) || 0 }))} className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 text-slate-600 cursor-pointer"><input type="checkbox" checked={coaForm.allowPosting !== false} onChange={(e) => setCoaForm((p) => ({ ...p, allowPosting: e.target.checked }))} className="w-4 h-4 accent-emerald-500" /> Allow Posting</label>
                    <label className="flex items-center gap-2 text-slate-600 cursor-pointer"><input type="checkbox" checked={coaForm.isControlAccount === true} onChange={(e) => setCoaForm((p) => ({ ...p, isControlAccount: e.target.checked }))} className="w-4 h-4 accent-emerald-500" /> Control Account</label>
                    <label className="flex items-center gap-2 text-slate-600 cursor-pointer"><input type="checkbox" checked={coaForm.cashBankAccount === true} onChange={(e) => setCoaForm((p) => ({ ...p, cashBankAccount: e.target.checked }))} className="w-4 h-4 accent-emerald-500" /> Cash / Bank</label>
                    <label className="flex items-center gap-2 text-slate-600 cursor-pointer"><input type="checkbox" checked={coaForm.reconciliationRequired === true} onChange={(e) => setCoaForm((p) => ({ ...p, reconciliationRequired: e.target.checked }))} className="w-4 h-4 accent-emerald-500" /> Reconcile</label>
                    <label className="flex items-center gap-2 text-slate-600 cursor-pointer"><input type="checkbox" checked={coaForm.costCenterRequired === true} onChange={(e) => setCoaForm((p) => ({ ...p, costCenterRequired: e.target.checked }))} className="w-4 h-4 accent-emerald-500" /> Cost Center Required</label>
                    <label className="flex items-center gap-2 text-slate-600 cursor-pointer"><input type="checkbox" checked={coaForm.isActive !== false} onChange={(e) => setCoaForm((p) => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 accent-emerald-500" /> Active</label>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Description</label>
                    <textarea value={coaForm.description ?? ''} onChange={(e) => setCoaForm((p) => ({ ...p, description: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none min-h-[64px]" />
                  </div>
                  <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                    <button type="button" onClick={() => setCoaModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
                    <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"><Save className="w-4 h-4" /> Save Account</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Bulk COA import modal */}
          <BulkCoaModal
            open={bulkModalOpen}
            onClose={() => setBulkModalOpen(false)}
            onImported={refreshCoa}
            existingCodes={coa.accounts.map((a) => a.code)}
          />

          {/* Account group modal */}
          {groupModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
              <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 text-slate-800 space-y-5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2"><Layers className="w-5 h-5 text-emerald-600" /><h3 className="text-lg font-bold text-slate-900">{groupEditing ? 'Edit Account Group' : 'Add Account Group'}</h3></div>
                  <button onClick={() => setGroupModal(false)} className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={saveGroup} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Code <span className="text-emerald-600">*</span></label>
                    <div className="relative">
                      <input
                        value={groupForm.code ?? ''}
                        onChange={(e) => setGroupForm((p) => ({ ...p, code: e.target.value }))}
                        placeholder="e.g. GRP-101"
                        className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 pr-16 text-emerald-700 font-mono font-bold focus:border-emerald-500 focus:outline-none"
                        required
                      />
                      {!groupEditing && (
                        <button
                          type="button"
                          onClick={() => setGroupForm((p) => ({ ...p, code: getNextGroupCode(coa.groups) }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-700 font-bold bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
                          title="Auto-generate group code"
                        >
                          <Sparkles className="w-2.5 h-2.5" /> Auto
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Name <span className="text-emerald-600">*</span></label>
                    <input value={groupForm.name ?? ''} onChange={(e) => setGroupForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Current Assets" className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none" required />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Type</label>
                    <select value={groupForm.type} onChange={(e) => setGroupForm((p) => ({ ...p, type: e.target.value }))} className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none">
                      {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Parent Group</label>
                    <select value={groupForm.parentId ?? ''} onChange={(e) => setGroupForm((p) => ({ ...p, parentId: e.target.value || null }))} className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none">
                      <option value="">-- None (Root) --</option>
                      {coa.groups.filter((g) => g.id !== groupEditing?.id).map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                    <button type="button" onClick={() => setGroupModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
                    <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"><Save className="w-4 h-4" /> Save Group</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
      </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
const TypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const styles: Record<string, string> = {
    Asset: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Liability: 'bg-teal-500/10 text-teal-600 border-teal-500/30',
    Equity: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    Income: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    Expense: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block border ${styles[type] || styles.Expense}`}>{type}</span>;
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600 border-slate-200',
    open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    locked: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    closed: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${styles[status] || styles.draft}`}>{status}</span>;
};

const DashboardTab: React.FC<{ health: AccountingHealth | null; coa: { accounts: ChartAccount[]; groups: AccountGroup[] } }> = ({ health, coa }) => {
  const stats = [
    { label: 'Chart Accounts', value: coa.accounts.length, color: 'text-emerald-600' },
    { label: 'Account Groups', value: coa.groups.length, color: 'text-purple-600' },
    { label: 'Voucher Types', value: health?.counts.voucherTypes ?? 0, color: 'text-teal-600' },
    { label: 'Cost Centers', value: health?.counts.costCenters ?? 0, color: 'text-amber-600' },
    { label: 'Journal Templates', value: health?.counts.journalTemplates ?? 0, color: 'text-rose-600' },
    { label: 'Financial Periods', value: health?.counts.financialPeriods ?? 0, color: 'text-indigo-600' },
    { label: 'Banks', value: health?.counts.banks ?? 0, color: 'text-sky-600' },
    { label: 'Bank Accounts', value: health?.counts.bankAccounts ?? 0, color: 'text-cyan-600' },
    { label: 'Cash Counters', value: health?.counts.cashCounters ?? 0, color: 'text-lime-600' },
    { label: 'Payment Methods', value: health?.counts.paymentMethods ?? 0, color: 'text-orange-600' },
    { label: 'System Mappings', value: `${health?.systemMappings.mapped ?? 0}/${health?.systemMappings.total ?? 0}`, color: 'text-fuchsia-600' },
  ];
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-emerald-50 rounded-xl"><CheckCircle2 className="w-6 h-6 text-emerald-600" /></div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Accounting Posting Status</h3>
            <p className="text-xs text-slate-500">Voucher posting is gated on an open financial period and on account posting flags.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Current Period</div>
            <div className="font-bold text-slate-900 text-sm">{health?.status.currentPeriod ? `${health.status.currentPeriod.code} (${health.status.currentPeriod.status})` : 'Not set'}</div>
            <div className="text-[11px] text-slate-500">{health?.status.openPeriods ?? 0} open period(s)</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Posting Accounts</div>
            <div className="font-bold text-slate-900 text-sm">{health?.status.postingEnabledAccounts ?? 0}</div>
            <div className="text-[11px] text-slate-500">accounts allow posting</div>
          </div>
          <div className={`bg-slate-50 border rounded-xl p-4 ${health?.healthy ? 'border-emerald-200' : 'border-amber-200'}`}>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Configuration Health</div>
            <div className={`font-bold text-sm ${health?.healthy ? 'text-emerald-600' : 'text-amber-600'}`}>{health?.healthy ? 'Ready' : `${health?.warnings.length ?? 0} warning(s)`}</div>
            {!health?.healthy && <div className="text-[11px] text-amber-700/80">{health?.warnings.join(' ')}</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-emerald-200 transition">
            <div className={`font-mono font-bold text-2xl ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-slate-500 mt-1 font-semibold">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Field configs per entity
// ---------------------------------------------------------------------------
function fieldsFor(entity: AccountingSettingsEntityType | null): FieldDef[] {
  switch (entity) {
    case 'voucher-types':
      return [
        { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. VT-001' },
        { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Journal Voucher' },
        { name: 'nameNepali', label: 'Nepali Name', type: 'text', placeholder: 'उदा: जर्नल भाउचर' },
        { name: 'category', label: 'Category', type: 'select', options: VOUCHER_CATEGORIES.map((c) => ({ value: c, label: c })) },
        { name: 'prefix', label: 'Number Prefix', type: 'text', placeholder: 'e.g. JV or RCP or PMT' },
        { name: 'numberingRule', label: 'Numbering Rule', type: 'select', options: NUMBERING_RULES.map((c) => ({ value: c, label: c })) },
        { name: 'padding', label: 'Number Padding', type: 'number', placeholder: 'e.g. 6' },
        { name: 'defaultDebitAccountId', label: 'Default Debit Account', type: 'coa' },
        { name: 'defaultCreditAccountId', label: 'Default Credit Account', type: 'coa' },
        { name: 'requiresApproval', label: 'Requires approval before posting', type: 'checkbox' },
        { name: 'requiresNarration', label: 'Narration required', type: 'checkbox' },
        { name: 'requiresCostCenter', label: 'Cost center required', type: 'checkbox' },
        { name: 'requiresReference', label: 'Reference required', type: 'checkbox' },
        { name: 'isBranchScoped', label: 'Branch scoped numbering', type: 'checkbox' },
        { name: 'allowBackdate', label: 'Allow backdated entries', type: 'checkbox' },
        { name: 'description', label: 'Description', type: 'textarea', span2: true, placeholder: 'Enter purpose and usage details for this voucher type…' },
        { name: 'sortOrder', label: 'Sort Order', type: 'number', placeholder: 'e.g. 1' },
      ];
    case 'cost-centers':
      return [
        { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. CC-001' },
        { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Kathmandu Main Office' },
        { name: 'nameNepali', label: 'Nepali Name', type: 'text', placeholder: 'उदा: काठमाडौँ मुख्य कार्यालय' },
        { name: 'parentId', label: 'Parent Cost Center', type: 'cost-center' },
        { name: 'branchId', label: 'Branch', type: 'branch' },
        { name: 'managerName', label: 'Manager Name', type: 'text', placeholder: 'e.g. Rajesh Kumar Sharma' },
        { name: 'description', label: 'Description', type: 'textarea', span2: true, placeholder: 'Enter cost center scope, purpose, or notes…' },
        { name: 'sortOrder', label: 'Sort Order', type: 'number', placeholder: 'e.g. 1' },
      ];
    case 'banks':
      return [
        { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. BNK-001 or NABIL' },
        { name: 'name', label: 'Bank Name', type: 'text', required: true, placeholder: 'e.g. Nabil Bank Limited' },
        { name: 'nameNepali', label: 'Nepali Name', type: 'text', placeholder: 'उदा: नबिल बैंक लिमिटेड' },
        { name: 'shortName', label: 'Short Name', type: 'text', placeholder: 'e.g. NABIL' },
        { name: 'swiftCode', label: 'SWIFT Code', type: 'text', placeholder: 'e.g. NARBNPKA' },
        { name: 'description', label: 'Description', type: 'textarea', span2: true, placeholder: 'Enter banking relationship notes, contact details…' },
        { name: 'sortOrder', label: 'Sort Order', type: 'number', placeholder: 'e.g. 1' },
      ];
    case 'bank-accounts':
      return [
        { name: 'accountName', label: 'Account Name', type: 'text', required: true, placeholder: 'e.g. Nabil Operating Account' },
        { name: 'accountNumber', label: 'Account Number', type: 'text', required: true, placeholder: 'e.g. 0560018099' },
        { name: 'bankId', label: 'Bank', type: 'bank', required: true },
        { name: 'accountType', label: 'Account Type', type: 'select', options: BANK_ACCOUNT_TYPES.map((c) => ({ value: c, label: c })) },
        { name: 'currency', label: 'Currency', type: 'text', placeholder: 'e.g. NPR' },
        { name: 'branchId', label: 'Branch', type: 'branch' },
        { name: 'glAccountId', label: 'GL Account', type: 'coa' },
        { name: 'openingBalance', label: 'Opening Balance (Rs.)', type: 'number', placeholder: 'e.g. 50000' },
        { name: 'openingDateBs', label: 'Opening Date (BS)', type: 'text', placeholder: 'e.g. 2081-04-01' },
        { name: 'isPrimary', label: 'Primary account', type: 'checkbox' },
        { name: 'reconciliationEnabled', label: 'Reconciliation enabled', type: 'checkbox' },
      ];
    case 'cash-counters':
      return [
        { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. CTR-001' },
        { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Main Teller Counter' },
        { name: 'nameNepali', label: 'Nepali Name', type: 'text', placeholder: 'उदा: मुख्य टेलर काउन्टर' },
        { name: 'branchId', label: 'Branch', type: 'branch', required: true },
        { name: 'glCashAccountId', label: 'Cash GL Account', type: 'coa' },
        { name: 'openingBalance', label: 'Opening Balance (Rs.)', type: 'number', placeholder: 'e.g. 100000' },
        { name: 'maxCashLimit', label: 'Max Cash Limit (Rs.)', type: 'number', placeholder: 'e.g. 500000' },
      ];
    case 'payment-methods':
      return [
        { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. PM-001 or PM-FONEPAY' },
        { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. FonePay QR' },
        { name: 'nameNepali', label: 'Nepali Name', type: 'text', placeholder: 'उदा: फोनपे क्यूआर' },
        { name: 'type', label: 'Type', type: 'select', options: PAYMENT_METHOD_TYPES.map((c) => ({ value: c, label: c })) },
        { name: 'glAccountId', label: 'GL Account', type: 'coa' },
        { name: 'requiresReference', label: 'Requires reference', type: 'checkbox' },
        { name: 'requiresBank', label: 'Requires bank', type: 'checkbox' },
        { name: 'requiresChequeNumber', label: 'Requires cheque number', type: 'checkbox' },
        { name: 'requiresTransactionId', label: 'Requires transaction ID', type: 'checkbox' },
        { name: 'description', label: 'Description', type: 'textarea', span2: true, placeholder: 'Enter payment method notes, gateway info, or instructions…' },
        { name: 'sortOrder', label: 'Sort Order', type: 'number', placeholder: 'e.g. 1' },
      ];
    case 'journal-templates':
      return [
        { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. JT-001' },
        { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Monthly Rent Expense' },
        { name: 'nameNepali', label: 'Nepali Name', type: 'text', placeholder: 'उदा: मासिक भाडा खर्च' },
        { name: 'voucherTypeId', label: 'Voucher Type', type: 'voucher-type' },
        { name: 'frequency', label: 'Frequency', type: 'select', options: FREQUENCIES.map((c) => ({ value: c, label: c })) },
        { name: 'branchId', label: 'Branch', type: 'branch' },
        { name: 'narrationTemplate', label: 'Narration Template', type: 'textarea', span2: true, placeholder: 'e.g. Monthly rent for {month} — {branch}' },
        { name: 'description', label: 'Description', type: 'textarea', span2: true, placeholder: 'Describe when and how this journal template should be applied…' },
      ];
    case 'financial-periods':
      return [
        { name: 'code', label: 'Code', type: 'text', required: true, autoGenerated: true, placeholder: 'e.g. FP001' },
        { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. FP 2083/84' },
        { name: 'nameNepali', label: 'Nepali Name', type: 'text', placeholder: 'उदा: आर्थिक अवधि २०८३/८४' },
        { name: 'fiscalYearCode', label: 'Parent Fiscal Year', type: 'fiscal-year', required: true },
        { name: 'startDateBs', label: 'Start Date (BS)', type: 'text', required: true, placeholder: 'e.g. 2083-04-01' },
        { name: 'endDateBs', label: 'End Date (BS)', type: 'text', required: true, placeholder: 'e.g. 2084-03-31' },
        { name: 'startDateAd', label: 'Start Date (AD)', type: 'text', required: true, placeholder: 'e.g. 2026-07-16' },
        { name: 'endDateAd', label: 'End Date (AD)', type: 'text', required: true, placeholder: 'e.g. 2027-07-15' },
        { name: 'status', label: 'Status', type: 'select', options: PERIOD_STATUSES.map((c) => ({ value: c, label: c })) },
        { name: 'isCurrent', label: 'Mark as current period', type: 'checkbox' },
        { name: 'reason', label: 'Reason / Notes', type: 'textarea', span2: true, placeholder: 'e.g. Opening period for FY 2083/84' },
      ];
    default:
      return [
        { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. COD-001' },
        { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter name…' },
        { name: 'nameNepali', label: 'Nepali Name', type: 'text', placeholder: 'नाम नेपालीमा…' },
        { name: 'description', label: 'Description', type: 'textarea', span2: true, placeholder: 'Enter description or notes…' },
        { name: 'sortOrder', label: 'Sort Order', type: 'number', placeholder: 'e.g. 1' },
      ];
  }
}

function defaultForm(entity: AccountingSettingsEntityType | null, coaData: { accounts: ChartAccount[]; groups: AccountGroup[] }): Record<string, any> {
  switch (entity) {
    case 'voucher-types':
      return { code: '', name: '', nameNepali: '', category: 'Journal', prefix: 'JV', numberingRule: 'fiscal_year', padding: 6, defaultDebitAccountId: null, defaultCreditAccountId: null, requiresApproval: false, requiresNarration: true, requiresCostCenter: false, requiresReference: false, isBranchScoped: false, allowBackdate: true, description: '', sortOrder: 0 };
    case 'cost-centers':
      return { code: '', name: '', nameNepali: '', parentId: null, branchId: null, managerId: null, managerName: '', description: '', sortOrder: 0 };
    case 'banks':
      return { code: '', name: '', nameNepali: '', shortName: '', swiftCode: '', description: '', sortOrder: 0 };
    case 'bank-accounts':
      return { accountName: '', accountNumber: '', bankId: '', accountType: 'Current', currency: 'NPR', branchId: null, glAccountId: null, openingBalance: 0, openingDateBs: '', isPrimary: false, reconciliationEnabled: false };
    case 'cash-counters':
      return { code: '', name: '', nameNepali: '', branchId: '', glCashAccountId: null, openingBalance: 0, maxCashLimit: null };
    case 'payment-methods':
      return { code: '', name: '', nameNepali: '', type: 'Cash', glAccountId: null, requiresReference: false, requiresBank: false, requiresChequeNumber: false, requiresTransactionId: false, description: '', sortOrder: 0 };
    case 'journal-templates':
      return { code: '', name: '', nameNepali: '', voucherTypeId: null, narrationTemplate: '', frequency: 'manual', branchId: null, description: '' };
    case 'financial-periods':
      return { code: 'FP001', name: 'FP 2083/84', nameNepali: '', fiscalYearCode: '2083/84', startDateBs: '2083-04-01', endDateBs: '2084-03-31', startDateAd: '2026-07-16', endDateAd: '2027-07-15', status: 'draft', isCurrent: false, reason: '' };
    default:
      return { code: '', name: '', nameNepali: '', description: '', sortOrder: 0 };
  }
}

export default SetupAccountingSettingsView;
