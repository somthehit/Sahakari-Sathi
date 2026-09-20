import React, { useState, useEffect } from 'react';
import { useCoop } from '../../context/CoopContext';
import { CurrencyConfig } from '../../types/coop';
import { 
  Building2, 
  GitBranch, 
  Calendar, 
  Clock, 
  Globe, 
  DollarSign, 
  Save, 
  Plus, 
  CheckCircle2, 
  PieChart, 
  Download, 
  Briefcase,
  Languages,
  Hash,
  ArrowLeftRight,
  Check,
  Type,
  Lock
} from 'lucide-react';
import { ExpandableFormCard } from '../common/ExpandableFormCard';
import { AdminSetupSearchFilterBar } from '../common/AdminSetupSearchFilterBar';
import { fetchFinancialSettings, syncLatestExchangeRate, updateFinancialSettings, fetchExchangeRates } from '../../api/exchangeRates';
import { fetchOrgProfile, updateOrgProfile } from '../../api/orgProfile';
import { uploadMedia, resolveMediaUrl } from '../../api/storage';
import { useToast } from '../../context/ToastContext';
import { useAuthStore } from '../../stores/authStore';
import {
  fetchLocalizationSettings,
  updateLocalizationSettings,
  type LocalizationSettings,
} from '../../api/localization';
import { formatLocalizedCurrency, DATE_FORMAT_PREVIEWS, groupDigits } from '../../utils/localization';
import { getTodayBS, getTodayADFormatted } from '../../utils/nepaliCalendar';
import { transliterateToNepali } from '../../utils/transliterate';
import { useLocalization } from '../../context/LocalizationContext';

interface Props {
  activeSubKey?: string;
}

export const SetupOrganizationView: React.FC<Props> = ({ activeSubKey = 'setup_coop_profile' }) => {
  const { 
    branches, 
    fiscalYears, 
    setIsFiscalYearModalOpen,
    reloadFiscalYears,
    openBranchForm,
    currencyConfig,
    updateCurrencyConfig,
    convertToNPR,
    addNotification
  } = useCoop();
  const toast = useToast();
  const { applySettings } = useLocalization();

  // RBAC: server routes gate writes by role (requireRole middleware); mirror the
  // same rules client-side so non-authorized staff see read-only forms instead of
  // silent 403s. org_admin can do everything; manager may manage branches/fiscal years.
  const authUser = useAuthStore((s) => s.user);
  const isAdmin = !!authUser?.isOrgAdmin || authUser?.role === 'org_admin';
  const canManageBranch = isAdmin || authUser?.role === 'manager';
  const canManageFiscalYear = isAdmin || authUser?.role === 'manager';

  const [subTab, setSubTab] = useState<string>(activeSubKey);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (activeSubKey) {
      setSubTab(activeSubKey);
    }
  }, [activeSubKey]);

  const [profile, setProfile] = useState({
    name: '',
    regNo: '',
    panNo: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    logoUrl: '',
    workingDateBS: getTodayBS(),
    workingDateAD: getTodayADFormatted(),
    currency: 'NPR (Rs.)',
    language: 'English / Bikram Sambat',
    timezone: 'Asia/Kathmandu (UTC+05:45)',
  });
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Load the persisted org profile (and working date) from the backend when the
  // profile tab opens. No hardcoded demo values — the DB is the source of truth.
  useEffect(() => {
    if (subTab !== 'setup_coop_profile' && subTab !== 'setup_working_date') return;
    let active = true;
    setIsLoadingProfile(true);
    (async () => {
      try {
        const res = await fetchOrgProfile();
        if (!active || !res?.organization) return;
        const org = res.organization;
        setProfile(prev => ({
          ...prev,
          name: org.organizationName || prev.name,
          regNo: org.registrationNo || '',
          panNo: org.pan || '',
          phone: org.phone || '',
          email: org.email || '',
          address: org.address || '',
          website: org.website || '',
          logoUrl: org.logoUrl || '',
          timezone: org.timezone || prev.timezone,
        }));
      } catch (e) {
        console.error('[SetupOrganizationView] failed to load org profile:', e);
      } finally {
        if (active) setIsLoadingProfile(false);
      }
    })();
    return () => { active = false; };
  }, [subTab]);

  const refreshOrgHeader = useAuthStore((s) => s.refreshOrganization);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const handleLogoUpload = async (file: File) => {
    setIsUploadingLogo(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read the selected image.'));
        reader.readAsDataURL(file);
      });
      const media = await uploadMedia('org_logo', dataUrl, { fileName: 'org-logo' });
      setProfile(prev => ({ ...prev, logoUrl: media.url }));
      toast.showSuccess('Organization logo uploaded. Click Save Profile to persist it.', 'Logo Uploaded');
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Logo upload failed.';
      toast.showError(message, 'Logo Upload Failed');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const org = await updateOrgProfile({
        organizationName: profile.name,
        registrationNo: profile.regNo,
        pan: profile.panNo,
        phone: profile.phone,
        email: profile.email,
        address: profile.address,
        website: profile.website,
        logoUrl: profile.logoUrl,
      });
      // Invalidate global org identity so the header name/logo refresh instantly.
      refreshOrgHeader({
        organizationName: org.organizationName,
        organizationCode: org.organizationCode,
        logoUrl: org.logoUrl,
      });
      addNotification('Organization Profile Saved', 'Cooperative organization profile and working date updated successfully.', 'success');
      toast.showSuccess('Organization profile updated successfully.', 'Profile Saved');
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Could not persist organization profile to the server.';
      addNotification('Profile Save Failed', message, 'alert');
      toast.showError(message, 'Profile Save Failed');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const [currencyForm, setCurrencyForm] = useState<CurrencyConfig>({
    baseCurrency: currencyConfig.baseCurrency,
    exchangeRate: currencyConfig.exchangeRate,
    forexMarkupPct: currencyConfig.forexMarkupPct,
    applyGST: currencyConfig.applyGST,
    gstPct: currencyConfig.gstPct
  });

  useEffect(() => {
    setCurrencyForm({
      baseCurrency: currencyConfig.baseCurrency,
      exchangeRate: currencyConfig.exchangeRate,
      forexMarkupPct: currencyConfig.forexMarkupPct,
      applyGST: currencyConfig.applyGST,
      gstPct: currencyConfig.gstPct
    });
  }, [currencyConfig]);

  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);
  const [lastFetchedRate, setLastFetchedRate] = useState<{ buy: number; sell: number; middle: number; date: string } | null>(null);
  const [baseCurrencyLocked, setBaseCurrencyLocked] = useState(false);
  const currencyUserInteracted = React.useRef(false);

  useEffect(() => {
    if (subTab !== 'setup_currency') return;
    (async () => {
      const settings = await fetchFinancialSettings();
      const rates = await fetchExchangeRates();
      let latestRate: { buy: number; sell: number; middle: number; date: string } | null = null;
      if (rates && rates.length > 0) {
        const latest = rates[0];
        latestRate = {
          buy: Number(latest.buyRate),
          sell: Number(latest.sellRate),
          middle: Number(latest.officialMiddleRate),
          date: latest.effectiveDate
        };
        setLastFetchedRate(latestRate);
      }
      if (settings) {
        setBaseCurrencyLocked(!!settings.baseCurrencyLocked);
        if (!currencyUserInteracted.current) {
          const isUsd = settings.defaultCurrency === 'USD';
          const storedMiddle = latestRate?.middle ?? 0;
          const mapped = {
            baseCurrency: isUsd ? 'USD' as const : 'NPR' as const,
            exchangeRate: isUsd ? (storedMiddle || currencyConfig.exchangeRate || 0) : 0,
            forexMarkupPct: Number(settings.defaultForexMarkupPercent ?? 0),
            applyGST: !!settings.isTaxEnabled,
            gstPct: Number(settings.defaultTaxRatePercent ?? 0)
          };
          setCurrencyForm(prev => ({ ...prev, ...mapped, exchangeRate: mapped.exchangeRate || prev.exchangeRate }));
          updateCurrencyConfig(mapped);
        }
      }
    })();
  }, [subTab]);

  const handleFetchLatestRate = async (targetBase?: 'NPR' | 'USD') => {
    const base = targetBase ?? currencyForm.baseCurrency;
    setIsFetchingRate(true);
    try {
      const res = await syncLatestExchangeRate();
      const middle = Number(res.rate.officialMiddleRate);
      setCurrencyForm(prev => ({ ...prev, baseCurrency: base, exchangeRate: middle }));
      setLastFetchedRate({
        buy: Number(res.rate.buyRate),
        sell: Number(res.rate.sellRate),
        middle,
        date: res.rate.effectiveDate
      });
      updateCurrencyConfig({
        baseCurrency: base,
        exchangeRate: middle,
        forexMarkupPct: Number(res.settings.defaultForexMarkupPercent ?? 0),
        applyGST: !!res.settings.isTaxEnabled,
        gstPct: Number(res.settings.defaultTaxRatePercent ?? 0)
      });
      addNotification(
        'Exchange Rate Updated',
        `Fetched today's official NRB rate: buy ${res.rate.buyRate} / sell ${res.rate.sellRate} / middle ${res.rate.officialMiddleRate} NPR per USD.`,
        'success'
      );
      toast.showSuccess(
        `NRB rate fetched: buy ${res.rate.buyRate} / sell ${res.rate.sellRate} / middle ${res.rate.officialMiddleRate} NPR per USD.`,
        'Exchange Rate Updated'
      );
    } catch (error: any) {
      addNotification('Rate Fetch Failed', error?.response?.data?.error || 'Could not reach Nepal Rastra Bank. Try again later.', 'alert');
      toast.showError(error?.response?.data?.error || 'Could not reach Nepal Rastra Bank. Try again later.', 'Rate Fetch Failed');
    } finally {
      setIsFetchingRate(false);
    }
  };

  const handleBaseCurrencySelect = (cc: 'NPR' | 'USD') => {
    if (baseCurrencyLocked) {
      toast.showError('Base currency is locked because the organization already has financial transactions recorded.', 'Currency Locked');
      return;
    }
    currencyUserInteracted.current = true;
    setCurrencyForm(prev => ({ ...prev, baseCurrency: cc }));
    if (cc === 'USD') {
      // Auto-fetch the official NRB rate the moment USD is selected for use.
      void handleFetchLatestRate('USD');
    }
  };

  const handleSaveCurrency = async () => {
    if (baseCurrencyLocked) {
      toast.showError('Base currency is locked. Other currency settings can still be edited.', 'Currency Locked');
      return;
    }
    setIsSavingCurrency(true);
    const cfg: CurrencyConfig = {
      baseCurrency: currencyForm.baseCurrency,
      exchangeRate: currencyForm.baseCurrency === 'USD' ? Math.max(0, Number(currencyForm.exchangeRate) || 0) : 0,
      forexMarkupPct: currencyForm.baseCurrency === 'USD' ? Math.max(0, Number(currencyForm.forexMarkupPct) || 0) : 0,
      applyGST: currencyForm.baseCurrency === 'USD' ? currencyForm.applyGST : false,
      gstPct: currencyForm.baseCurrency === 'USD' && currencyForm.applyGST ? Math.max(0, Number(currencyForm.gstPct) || 0) : 0
    };
    updateCurrencyConfig(cfg);
    try {
      await updateFinancialSettings({
        defaultCurrency: cfg.baseCurrency,
        allowedCurrencies: ['NPR', 'USD'],
        defaultForexMarkupPercent: String(cfg.forexMarkupPct),
        isTaxEnabled: cfg.applyGST,
        taxName: 'GST',
        defaultTaxRatePercent: String(cfg.gstPct)
      });
      addNotification(
        'Currency Settings Saved',
        `Base currency set to ${cfg.baseCurrency}${cfg.baseCurrency === 'USD' ? ` at ${cfg.exchangeRate} NPR/USD` : ''}. Amounts will be shown accordingly.`,
        'success'
      );
      toast.showSuccess(
        `Base currency set to ${cfg.baseCurrency}${cfg.baseCurrency === 'USD' ? ` at ${cfg.exchangeRate} NPR/USD` : ''}.`,
        'Currency Settings Saved'
      );
    } catch (error: any) {
      addNotification('Save Failed', error?.response?.data?.error || 'Could not persist currency settings to the server.', 'alert');
      toast.showError(error?.response?.data?.error || 'Could not persist currency settings to the server.', 'Save Failed');
    } finally {
      setIsSavingCurrency(false);
    }
  };

  // ─── Language & Localization state ────────────────────────────────────────
  const [locForm, setLocForm] = useState<LocalizationSettings>({
    organizationId: '',
    defaultLanguage: 'ne',
    supportedLanguages: ['ne', 'en'],
    primaryCalendarSystem: 'BS',
    dateDisplayFormat: 'YYYY-MM-DD',
    numberFormatStyle: 'IN',
    currencySymbol: 'रु.',
    currencySymbolPosition: 'prefix',
    enableAutoTransliteration: false,
  });
  const [isSavingLocalization, setIsSavingLocalization] = useState(false);
  const [isLoadingLocalization, setIsLoadingLocalization] = useState(false);
  const [translitDemoInput, setTranslitDemoInput] = useState('');

  useEffect(() => {
    if (subTab !== 'setup_language') return;
    let active = true;
    setIsLoadingLocalization(true);
    (async () => {
      const settings = await fetchLocalizationSettings();
      if (active && settings) {
        setLocForm(prev => ({ ...prev, ...settings }));
      }
      if (active) setIsLoadingLocalization(false);
    })();
    return () => { active = false; };
  }, [subTab]);

  const setLoc = <K extends keyof LocalizationSettings>(key: K, value: LocalizationSettings[K]) => {
    setLocForm(prev => ({ ...prev, [key]: value }));
  };

  /** Sample amounts used in the live number/currency preview. */
  const SAMPLE_AMOUNTS = [1000, 1234567, 50000000];

  const handleSaveLocalization = async () => {
    setIsSavingLocalization(true);
    const payload = {
      defaultLanguage: locForm.defaultLanguage,
      supportedLanguages: locForm.supportedLanguages,
      primaryCalendarSystem: locForm.primaryCalendarSystem,
      dateDisplayFormat: locForm.dateDisplayFormat,
      numberFormatStyle: locForm.numberFormatStyle,
      currencySymbol: locForm.currencySymbol.trim() || 'रु.',
      currencySymbolPosition: locForm.currencySymbolPosition,
      enableAutoTransliteration: locForm.enableAutoTransliteration,
    };
    try {
      await updateLocalizationSettings(payload);
      // Apply immediately so the whole UI (header/footer/menu/fonts) switches
      // without requiring a page reload.
      applySettings(payload);
      addNotification(
        'Localization Settings Saved',
        `Interface language ${locForm.defaultLanguage === 'ne' ? 'नेपाली' : 'English'} with ${locForm.primaryCalendarSystem === 'BS' ? 'Bikram Sambat' : 'Anno Domini'} calendar applied.`,
        'success'
      );
      toast.showSuccess(
        `Language & localization preferences saved successfully.`,
        'Localization Settings Saved'
      );
    } catch (error: any) {
      addNotification('Save Failed', error?.response?.data?.error || 'Could not persist localization settings to the server.', 'alert');
      toast.showError(error?.response?.data?.error || 'Could not persist localization settings to the server.', 'Save Failed');
    } finally {
      setIsSavingLocalization(false);
    }
  };

  // Filters
  const filteredBranches = branches.filter(b => 
    (b.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
    (b.code || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (b.managerName || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  const filteredFiscalYears = fiscalYears.filter(fy =>
    (fy.code || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (fy.startDateBS || '').includes(searchTerm || '') ||
    (fy.endDateBS || '').includes(searchTerm || '')
  );

  return (
    <div className="space-y-6">

      {/* Search Bar for Branches and Fiscal Years */}
      {(subTab === 'setup_branches' || subTab === 'setup_fiscal_years') && (
        <AdminSetupSearchFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={
            subTab === 'setup_branches' ? 'Search branch name, code, manager...' : 
            'Search fiscal year code or date...'
          }
          quickStats={[
            {
              label: subTab === 'setup_branches' ? 'Filtered Branches' : 'Filtered Fiscal Years',
              value: subTab === 'setup_branches' ? filteredBranches.length : filteredFiscalYears.length,
              color: 'text-emerald-400'
            }
          ]}
        />
      )}

      {/* COOP PROFILE */}
      {subTab === 'setup_coop_profile' && (
        <div className="max-w-2xl">
          <ExpandableFormCard
            title="Cooperative Legal Profile Setup"
            subtitle="Configure official institution metadata, registration numbers, and contact details"
            icon={<Building2 className="w-5 h-5 text-emerald-400" />}
            headerActions={
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={!isAdmin || isSavingProfile || isLoadingProfile}
                title={!isAdmin ? 'Only organization administrators can edit the profile.' : undefined}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg flex items-center gap-2 transition cursor-pointer shadow"
              >
                <Save className="w-4 h-4" /> {isSavingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {profile.logoUrl ? (
                    <img
                      src={resolveMediaUrl(profile.logoUrl)}
                      alt="Organization logo"
                      className="w-full h-full object-contain"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <Building2 className="w-7 h-7 text-slate-600" />
                  )}
                </div>
                <div>
                  <label className="block text-slate-600 text-[11px] font-bold mb-1">Organization Logo</label>
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition cursor-pointer">
                      {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploadingLogo}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleLogoUpload(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {profile.logoUrl && (
                      <button
                        type="button"
                        onClick={() => setProfile(prev => ({ ...prev, logoUrl: '' }))}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">PNG/JPG, square recommended. Saved with the profile.</p>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 text-xs font-bold mb-1">Cooperative Institution Full Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-bold mb-1">Cooperative Registration No.</label>
                <input
                  type="text"
                  value={profile.regNo}
                  onChange={(e) => setProfile(prev => ({ ...prev, regNo: e.target.value }))}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-bold mb-1">PAN / VAT Registration No.</label>
                <input
                  type="text"
                  value={profile.panNo}
                  onChange={(e) => setProfile(prev => ({ ...prev, panNo: e.target.value }))}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-bold mb-1">Official Telephone</label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-bold mb-1">Official Email</label>
                <input
                  type="text"
                  value={profile.email}
                  onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-600 text-xs mb-1">Registered Address</label>
                <input
                  type="text"
                  value={profile.address}
                  onChange={(e) => setProfile(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </ExpandableFormCard>
        </div>
      )}

      {/* BRANCHES SETUP */}
      {subTab === 'setup_branches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Branch Network Locations ({branches.length})</h3>
            <button
              onClick={() => openBranchForm('add')}
              disabled={!canManageBranch}
              title={!canManageBranch ? 'You do not have permission to add branches.' : undefined}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg flex items-center gap-2 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" /> Add New Branch
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredBranches.map((b) => (
              <div key={b.id} className="bg-white p-5 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-800 text-sm">{b.name}</span>
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                    Code: {b.code}
                  </span>
                </div>
                <div className="text-slate-500 text-xs">Manager: <span className="text-slate-800 font-semibold">{b.managerName}</span></div>
                <div className="text-slate-500 text-xs">Address: <span className="text-slate-700">{b.address}</span></div>
                <div className="text-emerald-800 font-mono font-bold text-xs">Vault Cash: NPR {b.currentVaultCash.toLocaleString()}</div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => openBranchForm('edit', b)}
                    disabled={!canManageBranch}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 border border-slate-200 font-bold text-[11px] rounded-lg transition cursor-pointer"
                  >
                    Edit
                  </button>
                  {b.status !== 'Inactive' && isAdmin && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const { deactivateBranch } = await import('../../api/branches');
                          await deactivateBranch(b.id);
                          addNotification('Branch Deactivated', `Branch "${b.name}" has been deactivated.`, 'success');
                        } catch (e: any) {
                          addNotification('Deactivate Failed', e?.response?.data?.error || 'Could not deactivate this branch.', 'alert');
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] rounded-lg transition cursor-pointer"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FISCAL YEARS SETUP */}
      {subTab === 'setup_fiscal_years' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Cooperative Fiscal Years Registry</h3>
              <p className="text-xs text-slate-500">Manage financial accounting periods and active working years</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFiscalYearModalOpen(true)}
              disabled={!canManageFiscalYear}
              title={!canManageFiscalYear ? 'You do not have permission to add fiscal years.' : undefined}
              className="px-4 py-2 bg-white hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 font-bold text-xs rounded-lg flex items-center gap-2 transition cursor-pointer shadow-2xs"
            >
              <Plus className="w-4 h-4" /> Add Fiscal Year
            </button>
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Fiscal Year Code</th>
                  <th className="p-3">Start Date (BS)</th>
                  <th className="p-3">End Date (BS)</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-mono">
                {filteredFiscalYears.map((fy) => (
                  <tr key={fy.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-emerald-800">{fy.code}</td>
                    <td className="p-3">{fy.startDateBS}</td>
                    <td className="p-3">{fy.endDateBS}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ fy.isCurrent ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600' }`}>
                        {fy.isCurrent ? 'Active Current FY' : 'Closed FY'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {!fy.isCurrent && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const { updateFiscalYear } = await import('../../api/fiscalYears');
                                await updateFiscalYear(fy.id, { isCurrent: true });
                                addNotification('Fiscal Year Activated', `Fiscal year ${fy.code} set as the current working fiscal year.`, 'success');
                                reloadFiscalYears();
                              } catch (e: any) {
                                addNotification('Set Active Failed', e?.response?.data?.error || 'Could not activate this fiscal year.', 'alert');
                              }
                            }}
                            disabled={!canManageFiscalYear}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed text-emerald-800 border border-emerald-200 font-bold text-[11px] rounded-lg transition cursor-pointer"
                          >
                            Set Active
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Delete fiscal year ${fy.code}? This cannot be undone.`)) return;
                              try {
                                const { deleteFiscalYear } = await import('../../api/fiscalYears');
                                await deleteFiscalYear(fy.id);
                                addNotification('Fiscal Year Deleted', `Fiscal year ${fy.code} removed from registry.`, 'warning');
                                reloadFiscalYears();
                              } catch (e: any) {
                                addNotification('Delete Failed', e?.response?.data?.error || 'Could not delete this fiscal year.', 'alert');
                              }
                            }}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] rounded-lg transition cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WORKING DATE SETUP */}
      {subTab === 'setup_working_date' && (
        <div className="max-w-xl">
          <ExpandableFormCard
            title="System Operating Working Date Control"
            subtitle="Set the official daily working date for cashier transaction posts and general ledger postings."
            icon={<Clock className="w-5 h-5 text-emerald-700" />}
          >
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-slate-600 text-xs mb-1">Current Working Date (Bikram Sambat BS)</label>
                <input
                  type="text"
                  value={profile.workingDateBS}
                  onChange={(e) => setProfile(prev => ({ ...prev, workingDateBS: e.target.value }))}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-emerald-800 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={!isAdmin}
                title={!isAdmin ? 'Only organization administrators can update the working date.' : undefined}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-xs"
              >
                Update Core Operating Date
              </button>
            </div>
          </ExpandableFormCard>
        </div>
      )}

      {/* CURRENCY SETUP */}
      {subTab === 'setup_currency' && (
        <div className="max-w-3xl space-y-4">
          <ExpandableFormCard
            title="Currency & Exchange Rate Setup"
            subtitle="Choose the cooperative's operating currency. NPR is the default; if USD is used, current exchange rate, forex markup, and GST are applied on conversion."
            icon={<DollarSign className="w-5 h-5 text-emerald-700" />}
            headerActions={
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleFetchLatestRate()}
                  disabled={isFetchingRate}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 border border-slate-200 font-bold text-xs rounded-lg flex items-center gap-2 transition cursor-pointer"
                  title="Fetch today's official USD/NPR rate from Nepal Rastra Bank"
                >
                  <Download className="w-4 h-4 text-emerald-700" />
                  {isFetchingRate ? 'Fetching...' : 'Fetch Latest Rate (NRB)'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveCurrency}
                  disabled={!isAdmin || isSavingCurrency || isFetchingRate}
                  title={!isAdmin ? 'Only organization administrators can edit currency settings.' : undefined}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg flex items-center gap-2 transition cursor-pointer shadow"
                >
                  <Save className="w-4 h-4" /> {isSavingCurrency ? 'Saving...' : 'Save Currency Settings'}
                </button>
              </div>
            }
          >
            <div className="space-y-5 pt-2">
              <div>
                <label className="block text-slate-600 text-xs font-bold mb-2">Base / Operating Currency</label>
                {baseCurrencyLocked && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      <span className="font-bold">Base currency is locked.</span> The organization already has financial
                      transactions recorded in {currencyForm.baseCurrency === 'USD' ? 'USD' : 'NPR'}, so the operating
                      currency can no longer be changed to protect the accounting trail.
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['NPR', 'USD'] as const).map((cc) => (
                    <button
                      key={cc}
                      type="button"
                      onClick={() => handleBaseCurrencySelect(cc)}
                      disabled={baseCurrencyLocked && currencyForm.baseCurrency !== cc}
                      title={baseCurrencyLocked ? 'Locked — base currency cannot be changed after transactions exist.' : undefined}
                      className={`text-left p-4 rounded-xl border-2 transition flex items-start gap-3 ${ currencyForm.baseCurrency === cc ? 'border-emerald-600 bg-emerald-50/60' : 'border-slate-200 bg-white hover:border-emerald-300' } ${baseCurrencyLocked && currencyForm.baseCurrency !== cc ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${ currencyForm.baseCurrency === cc ? 'border-emerald-600' : 'border-slate-300' }`}>
                        {currencyForm.baseCurrency === cc && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-800">
                          {cc === 'NPR' ? 'Nepalese Rupee (NPR)' : 'US Dollar (USD)'}
                          {cc === 'NPR' && <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[9px] font-mono">DEFAULT</span>}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {cc === 'NPR' ? 'No conversion required. All amounts are recorded in NPR.' : 'Amounts are recorded in USD and converted to NPR using the exchange rate below.'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {currencyForm.baseCurrency === 'USD' && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-600 text-xs font-bold mb-1">Current Exchange Rate (NPR per 1 USD)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={currencyForm.exchangeRate || ''}
                          onChange={(e) => { currencyUserInteracted.current = true; setCurrencyForm(prev => ({ ...prev, exchangeRate: Number(e.target.value) })); }}
                          placeholder="e.g. 133.50"
                          className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleFetchLatestRate('USD')}
                          disabled={isFetchingRate}
                          className="shrink-0 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5"
                          title="Auto-fetch today's official NRB rate"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {isFetchingRate ? '...' : 'Auto-fetch'}
                        </button>
                      </div>
                      {lastFetchedRate && (
                        <p className="text-[11px] text-slate-500 mt-1 font-mono">
                          NRB {lastFetchedRate.date}: buy {lastFetchedRate.buy.toFixed(2)} / sell {lastFetchedRate.sell.toFixed(2)} / middle{' '}
                          <span className="font-bold text-emerald-800">{lastFetchedRate.middle.toFixed(4)}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-600 text-xs font-bold mb-1">Forex Markup (%)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={currencyForm.forexMarkupPct || ''}
                        onChange={(e) => { currencyUserInteracted.current = true; setCurrencyForm(prev => ({ ...prev, forexMarkupPct: Number(e.target.value) })); }}
                        placeholder="e.g. 1.5"
                        className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currencyForm.applyGST}
                      onChange={(e) => { currencyUserInteracted.current = true; setCurrencyForm(prev => ({ ...prev, applyGST: e.target.checked })); }}
                      className="mt-0.5 w-4 h-4 accent-emerald-600 cursor-pointer"
                    />
                    <span className="text-xs text-slate-700">
                      <span className="font-bold">Apply GST on forex transaction</span>
                      <span className="block text-[11px] text-slate-500">Charges GST on the converted amount alongside the forex markup.</span>
                    </span>
                  </label>

                  {currencyForm.applyGST && (
                    <div className="sm:max-w-[260px]">
                      <label className="block text-slate-600 text-xs font-bold mb-1">GST Rate (%)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={currencyForm.gstPct || ''}
                        onChange={(e) => { currencyUserInteracted.current = true; setCurrencyForm(prev => ({ ...prev, gstPct: Number(e.target.value) })); }}
                        placeholder="e.g. 13"
                        className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-slate-100 pt-4">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Conversion Preview</div>
                  {currencyForm.baseCurrency === 'NPR' ? (
                    <p className="text-xs text-slate-600">
                      Operating in <span className="font-bold text-slate-800">NPR</span>. Amounts are displayed as-is, e.g. <span className="font-mono font-bold text-emerald-800">Rs. 1,000</span>.
                    </p>
                  ) : (
                    <div className="text-xs text-slate-600 space-y-1">
                      <p>
                        <span className="font-mono font-bold text-slate-800">$1,000 USD</span> converts to:
                      </p>
                      <p className="text-sm font-mono font-bold text-emerald-800">
                        {(() => {
                          const rate = Math.max(0, Number(currencyForm.exchangeRate) || 0);
                          const markup = Math.max(0, Number(currencyForm.forexMarkupPct) || 0);
                          const gst = currencyForm.applyGST ? Math.max(0, Number(currencyForm.gstPct) || 0) : 0;
                          let total = 1000 * rate;
                          total *= 1 + markup / 100;
                          if (currencyForm.applyGST) total *= 1 + gst / 100;
                          return `Rs. ${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        })()}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Base rate {currencyForm.exchangeRate || 0} {currencyForm.forexMarkupPct > 0 ? `+ ${currencyForm.forexMarkupPct}% markup` : ''}{currencyForm.applyGST ? ` + ${currencyForm.gstPct || 0}% GST` : ''} included.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ExpandableFormCard>
        </div>
      )}

      {/* LANGUAGE & LOCALIZATION SETUP */}
      {subTab === 'setup_language' && (
        <div className="max-w-4xl space-y-5">
          {/* ── 1. Language & Interface Configuration ─────────────────────── */}
          <ExpandableFormCard
            title="Language & Interface Configuration"
            subtitle="Choose the default interface language for all cooperative staff members."
            icon={<Languages className="w-5 h-5 text-emerald-700" />}
          >
            <div className="space-y-5 pt-2">
              <div>
                <label className="block text-slate-600 text-xs font-bold mb-2">Interface Language</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { code: 'ne', name: 'नेपाली', tagline: 'Nepali — रु. / विक्रम संवत', flag: '🇳🇵' },
                    { code: 'en', name: 'English', tagline: 'English — Rs. / AD (Gregorian)', flag: '🇬🇧' },
                  ] as const).map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setLoc('defaultLanguage', lang.code)}
                      className={`text-left p-4 rounded-xl border-2 transition cursor-pointer flex items-start gap-3 ${ locForm.defaultLanguage === lang.code ? 'border-emerald-600 bg-emerald-50/60' : 'border-slate-200 bg-white hover:border-emerald-300' }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${ locForm.defaultLanguage === lang.code ? 'border-emerald-600' : 'border-slate-300' }`}>
                        {locForm.defaultLanguage === lang.code && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-800">
                          {lang.flag} {lang.name}
                          {locForm.defaultLanguage === lang.code && (
                            <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[9px] font-mono">ACTIVE</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{lang.tagline}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={locForm.enableAutoTransliteration}
                  onChange={(e) => setLoc('enableAutoTransliteration', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-emerald-600 cursor-pointer"
                />
                <span className="text-xs text-slate-700">
                  <span className="font-bold">Enable Automatic Nepali Name Transliteration</span>
                  <span className="block text-[11px] text-slate-500">
                    Automatically convert English member names (e.g. "Ram Prasad Sharma") into Devanagari (राम प्रसाद शर्मा) when entering records.
                  </span>
                </span>
              </label>

              {/* Live transliteration demo */}
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="text-[11px] font-bold text-slate-600 mb-1.5">Transliteration Live Preview</div>
                <input
                  type="text"
                  value={translitDemoInput}
                  onChange={(e) => setTranslitDemoInput(e.target.value)}
                  placeholder="e.g. Ram Prasad Sharma"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition"
                />
                <div className="mt-1.5 text-sm font-bold text-emerald-800" dir="auto">
                  {translitDemoInput.trim() ? transliterateToNepali(translitDemoInput) : 'राम प्रसाद शर्मा'}
                </div>
              </div>
            </div>
          </ExpandableFormCard>

          {/* ── 2. Calendar & Date Formats ────────────────────────────────── */}
          <ExpandableFormCard
            title="Calendar & Date Formats"
            subtitle="Select the primary calendar and how dates appear across reports and ledgers."
            icon={<Calendar className="w-5 h-5 text-emerald-700" />}
          >
            <div className="space-y-5 pt-2">
              <div>
                <label className="block text-slate-600 text-xs font-bold mb-2">Primary Calendar</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { code: 'BS', name: 'Bikram Sambat (BS)', tagline: 'विक्रम संवत — official Nepali calendar', icon: '🪔' },
                    { code: 'AD', name: 'Anno Domini (AD)', tagline: 'इस्वी संवत — Gregorian calendar', icon: '🌍' },
                  ] as const).map((cal) => (
                    <button
                      key={cal.code}
                      type="button"
                      onClick={() => setLoc('primaryCalendarSystem', cal.code)}
                      className={`text-left p-4 rounded-xl border-2 transition cursor-pointer flex items-start gap-3 ${ locForm.primaryCalendarSystem === cal.code ? 'border-emerald-600 bg-emerald-50/60' : 'border-slate-200 bg-white hover:border-emerald-300' }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${ locForm.primaryCalendarSystem === cal.code ? 'border-emerald-600' : 'border-slate-300' }`}>
                        {locForm.primaryCalendarSystem === cal.code && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-800">{cal.icon} {cal.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{cal.tagline}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 text-xs font-bold mb-2">Date Display Format</label>
                <div className="flex items-center gap-2">
                  <select
                    value={locForm.dateDisplayFormat}
                    onChange={(e) => setLoc('dateDisplayFormat', e.target.value)}
                    className="w-full sm:max-w-[280px] bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {Object.keys(DATE_FORMAT_PREVIEWS).map(fmt => (
                      <option key={fmt} value={fmt}>{fmt}</option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {locForm.primaryCalendarSystem === 'BS'
                      ? DATE_FORMAT_PREVIEWS[locForm.dateDisplayFormat]?.bs
                      : DATE_FORMAT_PREVIEWS[locForm.dateDisplayFormat]?.ad}
                    {' '}{locForm.primaryCalendarSystem}
                  </span>
                </div>
              </div>
            </div>
          </ExpandableFormCard>

          {/* ── 3. Number & Currency Localization ─────────────────────────── */}
          <ExpandableFormCard
            title="Number & Currency Localization"
            subtitle="Control digit grouping style and the currency symbol used across the system."
            icon={<Hash className="w-5 h-5 text-emerald-700" />}
          >
            <div className="space-y-5 pt-2">
              <div>
                <label className="block text-slate-600 text-xs font-bold mb-2">Number Grouping Style</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { code: 'IN', name: 'Lakhs / Crores', tagline: 'e.g. 12,34,567.00', sample: groupDigits(1234567, 'IN') },
                    { code: 'US', name: 'Millions / Billions', tagline: 'e.g. 1,234,567.00', sample: groupDigits(1234567, 'US') },
                  ] as const).map((ns) => (
                    <button
                      key={ns.code}
                      type="button"
                      onClick={() => setLoc('numberFormatStyle', ns.code)}
                      className={`text-left p-4 rounded-xl border-2 transition cursor-pointer flex items-start gap-3 ${ locForm.numberFormatStyle === ns.code ? 'border-emerald-600 bg-emerald-50/60' : 'border-slate-200 bg-white hover:border-emerald-300' }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${ locForm.numberFormatStyle === ns.code ? 'border-emerald-600' : 'border-slate-300' }`}>
                        {locForm.numberFormatStyle === ns.code && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-800">{ns.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{ns.tagline}</div>
                      </div>
                      <span className={`ml-auto self-center font-mono text-xs px-2 py-1 rounded-lg border ${ locForm.numberFormatStyle === ns.code ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200' }`}>
                        {ns.sample}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 text-xs font-bold mb-2">Currency Symbol</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={locForm.currencySymbol}
                    onChange={(e) => setLoc('currencySymbol', e.target.value)}
                    placeholder="रु."
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 text-xs font-bold mb-2">Symbol Position</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { code: 'prefix', label: 'Prefix' },
                      { code: 'suffix', label: 'Suffix' },
                    ] as const).map((pos) => (
                      <button
                        key={pos.code}
                        type="button"
                        onClick={() => setLoc('currencySymbolPosition', pos.code)}
                        className={`px-3 py-2 rounded-lg border-2 text-xs font-bold transition cursor-pointer ${ locForm.currencySymbolPosition === pos.code ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300' }`}
                      >
                        {pos.code === 'prefix' ? 'रु. 1,000' : '1,000 रु.'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Live Formatting Preview</div>
                  <div className="space-y-1">
                    {SAMPLE_AMOUNTS.map((amt) => (
                      <div key={amt} className="flex items-center justify-between gap-3">
                        <span className="text-[11px] text-slate-500 font-mono">{amt.toLocaleString('en-US')}</span>
                        <span className="text-sm font-mono font-bold text-emerald-800">
                          {formatLocalizedCurrency(amt, locForm.currencySymbol.trim() || 'रु.', locForm.currencySymbolPosition, locForm.numberFormatStyle)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </ExpandableFormCard>

          {/* ── Save Actions ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-3 pt-1 pb-16">
            <button
              type="button"
              onClick={handleSaveLocalization}
              disabled={!isAdmin || isSavingLocalization || isLoadingLocalization}
              title={!isAdmin ? 'Only organization administrators can edit localization settings.' : undefined}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg flex items-center gap-2 transition cursor-pointer shadow"
            >
              <Save className="w-4 h-4" />
              {isSavingLocalization ? 'Saving...' : 'Save Localization Settings'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
