import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2, Plus, Search, Filter, MoreHorizontal, Pause, Play, Trash2,
  Eye, CheckCircle2, AlertCircle, Clock, X, Users, MapPin,
  Calendar, ShieldAlert, RefreshCw, Download, Mail,
  FileText, BadgeCheck, Activity, XCircle, ShieldCheck, ArrowUpDown,
  Maximize2, Minimize2, Pencil, Save, Loader2, EyeOff, Copy, Wand2
} from 'lucide-react';
import { useCoop } from '../../../context/CoopContext';
import { useSuperAdminAuth } from '../../../stores/superAdminAuthStore';
import { generateOrgCodeCandidate } from '../../../utils/generateOrgCode';
import { generatePassword } from '../../../utils/generatePassword';
import { getProvinces, getDistricts, getMunicipalities } from '../../../utils/nepalGeoData';
import { superAdminApi } from '../../../lib/superAdminApi';
import { fetchGeoTree, type GeoProvince } from '../../../api/geo';
import { ImagePicker } from '../../common/ImagePicker';

interface Org {
  id: string;
  organizationCode: string;
  organizationName: string;
  shortName: string | null;
  organizationType?: string | null;
  slug?: string | null;
  isVerified?: boolean;
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  status: 'Active' | 'Suspended' | 'Inactive';
  province: string | null;
  district: string | null;
  phone: string | null;
  email: string | null;
  pan: string | null;
  users: number;
  employees: number;
  lastLoginAt: string | null;
  createdAt: string;
}

interface OrgDetail extends Org {
  municipality: string | null;
  provinceId?: string | null;
  districtId?: string | null;
  municipalityId?: string | null;
  wardNo?: number | null;
  govtRegNo?: string | null;
  address: string | null;
  mobile?: string | null;
  website?: string | null;
  registrationNo: string | null;
  registrationDate?: string | null;
  fiscalYear: string | null;
  themeColor: string | null;
  timezone?: string | null;
  locale?: string | null;
  currencyCode?: string | null;
  dateFormat?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  subscriptionStart?: string | null;
  subscriptionEnd?: string | null;
  trialEnd?: string | null;
  isMultiBranch?: boolean;
  aiEnabled?: boolean;
  aiCredit?: number;
  storageLimitMb?: number;
  storageUsedMb?: number;
  maxMembers?: number;
  maxUsers?: number;
  maxBranches?: number;
  updatedAt: string;
  stats: {
    users: number;
    activeUsers: number;
    employees: number;
    auditEvents: number;
    failedLogins: number;
    lastLoginAt: string | null;
  };
}

interface OrgAuditLog {
  id: string;
  username: string | null;
  event: string;
  ipAddress: string | null;
  success: boolean;
  reason: string | null;
  createdAt: string;
}

interface PlatformUser {
  id: string;
  username: string;
  email: string | null;
  fullName: string | null;
  role: string | null;
  department: string | null;
  status: string;
  lastLogin: string | null;
  orgId: string;
}

const statusColors: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-800',
  Suspended: 'bg-amber-100 text-amber-800',
  Inactive: 'bg-slate-100 text-slate-600',
};

const statusDot: Record<string, string> = {
  Active: 'bg-emerald-500',
  Suspended: 'bg-amber-500',
  Inactive: 'bg-slate-400',
};

type SortKey = 'organizationName' | 'organizationCode' | 'users' | 'createdAt' | 'status';

interface CreateOrgForm {
  code: string;
  name: string;
  shortName: string;
  organizationType: string;
  slug: string;
  district: string;
  province: string;
  municipality: string;
  wardNo: string;
  address: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  pan: string;
  registrationNo: string;
  govtRegNo: string;
  registrationDate: string;
  subscriptionPlan: string;
  logoUrl: string;
  faviconUrl: string;
  themeColor: string;
  timezone: string;
  locale: string;
  currencyCode: string;
  dateFormat: string;
  storageLimitMb: string;
  storageUsedMb: string;
  aiCredit: string;
  maxMembers: string;
  maxUsers: string;
  maxBranches: string;
  isMultiBranch: boolean;
  aiEnabled: boolean;
  contactName: string;
  contactEmail: string;
}
const EMPTY_FORM: CreateOrgForm = {
  code: '', name: '', shortName: '', organizationType: 'Cooperative', slug: '', district: '', province: '', municipality: '',
  wardNo: '', address: '', phone: '', mobile: '', email: '', website: '', pan: '', registrationNo: '', govtRegNo: '',
  registrationDate: '', subscriptionPlan: 'Trial',
  logoUrl: '', faviconUrl: '',
  themeColor: '#10b981', timezone: 'Asia/Kathmandu', locale: 'ne', currencyCode: 'NPR', dateFormat: 'BS',
  storageLimitMb: '5120', storageUsedMb: '0', aiCredit: '0',
  maxMembers: '', maxUsers: '', maxBranches: '',
  isMultiBranch: false, aiEnabled: false,
  contactName: '', contactEmail: '',
};

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const fmtDateTime = (d?: string | null) => d ? new Date(d).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const OrganizationsView: React.FC = () => {
  const { addNotification } = useCoop();
  const { accessToken } = useSuperAdminAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('organizationName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'users' | 'audit'>('overview');
  const [orgAudit, setOrgAudit] = useState<OrgAuditLog[]>([]);
  const [detailUsers, setDetailUsers] = useState<PlatformUser[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [form, setForm] = useState<CreateOrgForm>(EMPTY_FORM);
  const [editOrg, setEditOrg] = useState<OrgDetail | null>(null);
  const [editForm, setEditForm] = useState<CreateOrgForm>(EMPTY_FORM);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState<Org | null>(null);

  // ── Provision Wizard state ────────────────────────────────────────
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardError, setWizardError] = useState('');
  const [wizardProvisioning, setWizardProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<any>(null);
  const [showProvisionPw, setShowProvisionPw] = useState(false);
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [geoTree, setGeoTree] = useState<GeoProvince[]>([]);
  const [geoLoading, setGeoLoading] = useState(true);
  const [wizardForm, setWizardForm] = useState({
    // Step 1 — Org
    code: '', name: '', shortName: '', organizationType: 'Cooperative',
    province: '', district: '', municipality: '', wardNo: '', address: '',
    phone: '', mobile: '', email: '', website: '', pan: '', registrationNo: '', govtRegNo: '',
    // Step 2 — Subscription
    subscriptionPlan: 'Trial', maxMembers: '1000', maxUsers: '50',
    maxBranches: '5', isMultiBranch: false, aiEnabled: false,
    // Step 3 — Branch
    branchName: '', branchAddress: '', branchPhone: '',
    // Step 4 — Admin
    adminFullName: '', adminUsername: '', adminEmail: '',
    adminPhone: '', adminTemporaryPassword: '', confirmPassword: '',
  });

  const openWizard = () => {
    setWizardStep(1);
    setWizardError('');
    setWizardProvisioning(false);
    setProvisionResult(null);
    setShowProvisionPw(false);
    setCodeManuallyEdited(false);
    setWizardForm({
      code: '', name: '', shortName: '', organizationType: 'Cooperative',
      province: '', district: '', municipality: '', wardNo: '', address: '',
      phone: '', mobile: '', email: '', website: '', pan: '', registrationNo: '', govtRegNo: '',
      subscriptionPlan: 'Trial', maxMembers: '1000', maxUsers: '50',
      maxBranches: '5', isMultiBranch: false, aiEnabled: false,
      branchName: '', branchAddress: '', branchPhone: '',
      adminFullName: '', adminUsername: '', adminEmail: '',
      adminPhone: '', adminTemporaryPassword: '', confirmPassword: '',
    });
    setShowCreate(true);
  };

  const wf = (key: string, value: any) => setWizardForm(p => ({ ...p, [key]: value }));

  // Load the Nepal administrative hierarchy once for the provision wizard
  useEffect(() => {
    let cancelled = false;
    setGeoLoading(true);
    fetchGeoTree(accessToken || undefined)
      .then((tree) => { if (!cancelled) setGeoTree(tree); })
      .catch(() => { /* fall back to manual text entry */ })
      .finally(() => { if (!cancelled) setGeoLoading(false); });
    return () => { cancelled = true; };
  }, [accessToken]);

  // Cascading geo options derived from the loaded tree
  const geoProvinces = useMemo(() => geoTree.map(p => p.name), [geoTree]);
  const selectedProvince = useMemo(
    () => geoTree.find(p => p.name === wizardForm.province),
    [geoTree, wizardForm.province]
  );
  const geoDistricts = useMemo(
    () => selectedProvince?.districts.map(d => d.name) ?? [],
    [selectedProvince]
  );
  const selectedDistrict = useMemo(
    () => selectedProvince?.districts.find(d => d.name === wizardForm.district),
    [selectedProvince, wizardForm.district]
  );
  const geoMunicipalities = useMemo(
    () => selectedDistrict?.municipalities.map(m => m.name) ?? [],
    [selectedDistrict]
  );

  const handleProvinceChange = (province: string) => {
    wf('province', province);
    wf('district', '');
    wf('municipality', '');
  };
  const handleDistrictChange = (district: string) => {
    wf('district', district);
    wf('municipality', '');
  };

  // Auto-generate org code from name/shortName unless user has manually edited it
  const handleNameChange = (value: string) => {
    wf('name', value);
    if (!codeManuallyEdited) {
      const generated = generateOrgCodeCandidate(wizardForm.shortName, value);
      wf('code', generated);
    }
  };

  const handleShortNameChange = (value: string) => {
    wf('shortName', value);
    if (!codeManuallyEdited) {
      const generated = generateOrgCodeCandidate(value, wizardForm.name);
      wf('code', generated);
    }
  };

  const handleCodeChange = (value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    wf('code', upper);
    setCodeManuallyEdited(upper.length > 0);
  };

  const regenerateCode = () => {
    const generated = generateOrgCodeCandidate(wizardForm.shortName, wizardForm.name);
    wf('code', generated);
    setCodeManuallyEdited(false);
  };

  // Auto-fetch registration number from server when org type changes
  const BS_YEAR = 2083; // current BS year — update via getTodayBS() when calendar util is dynamic
  useEffect(() => {
    if (!showCreate || wizardStep !== 1) return;
    let cancelled = false;
    superAdminApi.getNextRegNo(accessToken!, wizardForm.organizationType, BS_YEAR)
      .then((res: any) => {
        if (!cancelled) wf('registrationNo', res?.registrationNo ?? '');
      })
      .catch(() => {/* non-blocking — user can type manually */});
    return () => { cancelled = true; };
  }, [wizardForm.organizationType, showCreate]);

  const validateWizardStep = (): string => {
    if (wizardStep === 1) {
      if (!wizardForm.code.trim()) return 'Organization Code is required.';
      if (!/^[A-Z0-9]{4,12}$/.test(wizardForm.code.toUpperCase())) return 'Organization Code must be 4-12 uppercase letters/numbers.';
      if (!wizardForm.name.trim()) return 'Organization Name is required.';
      if (!wizardForm.province.trim()) return 'Province is required.';
      if (!wizardForm.district.trim()) return 'District is required.';
      if (!wizardForm.municipality.trim()) return 'Municipality is required.';
      if (!wizardForm.email.trim() || !/\S+@\S+\.\S+/.test(wizardForm.email)) return 'A valid organization email is required.';
      if (!wizardForm.pan.trim()) return 'PAN / VAT No. is required.';
      if (!wizardForm.govtRegNo.trim()) return 'Government Registration No. is required.';
    }
    if (wizardStep === 2) {
      if (!wizardForm.subscriptionPlan) return 'Subscription Plan is required.';
    }
    if (wizardStep === 3) {
      if (!wizardForm.branchName.trim()) return 'Branch name is required.';
    }
    if (wizardStep === 4) {
      if (!wizardForm.adminFullName.trim()) return 'Admin full name is required.';
      if (!wizardForm.adminUsername.trim()) return 'Admin username is required.';
      if (!/^[a-z][a-z0-9_.]{2,29}$/.test(wizardForm.adminUsername)) return 'Username: 3-30 chars, start with letter, lowercase only.';
      if (!wizardForm.adminEmail.trim() || !/\S+@\S+\.\S+/.test(wizardForm.adminEmail)) return 'A valid admin email is required.';
      if (!wizardForm.adminTemporaryPassword || wizardForm.adminTemporaryPassword.length < 8) return 'One-time password must be at least 8 characters.';
    }
    return '';
  };

  const nextStep = () => {
    // Auto-fill branch fields from org when advancing to step 3
    if (wizardStep === 2) {
      setWizardForm(p => ({
        ...p,
        branchName: p.branchName || `${p.name} - Head Office`,
        branchAddress: p.branchAddress || p.address,
        branchPhone: p.branchPhone || p.phone,
      }));
    }
    // Auto-suggest username from full name when advancing to step 4
    if (wizardStep === 3) {
      const generated = generatePassword(14);
      setWizardForm(p => ({
        ...p,
        adminUsername: p.adminUsername || p.adminFullName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '').slice(0, 20),
        // Auto-generate the one-time admin password
        adminTemporaryPassword: p.adminTemporaryPassword || generated,
        confirmPassword: p.confirmPassword || p.adminTemporaryPassword || generated,
      }));
    }
    const err = validateWizardStep();
    if (err) { setWizardError(err); return; }
    setWizardError('');
    setWizardStep(s => s + 1);
  };

  const prevStep = () => { setWizardError(''); setWizardStep(s => s - 1); };

  const regenerateTempPassword = () => {
    const generated = generatePassword(14);
    wf('adminTemporaryPassword', generated);
    wf('confirmPassword', generated);
  };

  const copyTempPassword = async () => {
    if (!wizardForm.adminTemporaryPassword) return;
    try {
      await navigator.clipboard.writeText(wizardForm.adminTemporaryPassword);
    } catch { /* clipboard unavailable */ }
  };

  const handleProvision = async () => {
    const err = validateWizardStep();
    if (err) { setWizardError(err); return; }
    setWizardError('');
    setWizardProvisioning(true);
    try {
      const result = await superAdminApi.provisionOrganization(accessToken!, {
        organizationCode: wizardForm.code.toUpperCase(),
        organizationName: wizardForm.name,
        shortName: wizardForm.shortName || undefined,
        organizationType: wizardForm.organizationType || undefined,
        province: wizardForm.province || undefined,
        district: wizardForm.district || undefined,
        municipality: wizardForm.municipality || undefined,
        wardNo: wizardForm.wardNo ? Number(wizardForm.wardNo) : undefined,
        address: wizardForm.address || undefined,
        phone: wizardForm.phone || undefined,
        mobile: wizardForm.mobile || undefined,
        email: wizardForm.email || undefined,
        website: wizardForm.website || undefined,
        pan: wizardForm.pan || undefined,
        registrationNo: wizardForm.registrationNo || undefined,
        govtRegNo: wizardForm.govtRegNo || undefined,
        subscriptionPlan: wizardForm.subscriptionPlan,
        maxMembers: wizardForm.maxMembers ? Number(wizardForm.maxMembers) : undefined,
        maxUsers: wizardForm.maxUsers ? Number(wizardForm.maxUsers) : undefined,
        maxBranches: wizardForm.maxBranches ? Number(wizardForm.maxBranches) : undefined,
        isMultiBranch: wizardForm.isMultiBranch,
        aiEnabled: wizardForm.aiEnabled,
        branchName: wizardForm.branchName,
        branchAddress: wizardForm.branchAddress || undefined,
        branchPhone: wizardForm.branchPhone || undefined,
        adminFullName: wizardForm.adminFullName,
        adminUsername: wizardForm.adminUsername,
        adminEmail: wizardForm.adminEmail,
        adminPhone: wizardForm.adminPhone || undefined,
        adminTemporaryPassword: wizardForm.adminTemporaryPassword,
      });
      setProvisionResult(result);
      setWizardStep(6);
      await loadOrgs();
    } catch (err: any) {
      setWizardError(err.message || 'Provisioning failed. Please try again.');
    } finally {
      setWizardProvisioning(false);
    }
  };

  const copyCredentials = () => {
    if (!provisionResult) return;
    const text = [
      `Organization Code: ${provisionResult.organization?.organizationCode}`,
      `Organization Name:  ${provisionResult.organization?.organizationName}`,
      `Branch:             ${provisionResult.branch?.name} (${provisionResult.branch?.code})`,
      `Admin Username:     ${provisionResult.adminUser?.username}`,
      `Temporary Password: ${provisionResult.temporaryPassword}`,
      `Subscription Plan:  ${wizardForm.subscriptionPlan}`,
      `Login:              Use Organization Code + Username + Password`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() =>
      addNotification('Credentials Copied', 'Login credentials copied to clipboard.', 'success')
    );
  };
  // ─────────────────────────────────────────────────────────────────

  // Close drawer on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetail(null);
        setFullscreen(false);
        setEditOrg(null);
        setActiveMenu(null);
        setConfirmSuspend(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const loadOrgs = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await superAdminApi.getOrganizations(accessToken);
      setOrgs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load organizations.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = orgs
    .filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!search) return true;
      const t = search.toLowerCase();
      return o.organizationCode.toLowerCase().includes(t)
        || o.organizationName.toLowerCase().includes(t)
        || (o.district || '').toLowerCase().includes(t)
        || (o.province || '').toLowerCase().includes(t)
        || (o.email || '').toLowerCase().includes(t);
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'users') cmp = a.users - b.users;
      else if (sortKey === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const kpis = {
    total: orgs.length,
    active: orgs.filter(o => o.status === 'Active').length,
    suspended: orgs.filter(o => o.status === 'Suspended').length,
    users: orgs.reduce((s, o) => s + (o.users || 0), 0),
  };

  const openDetail = async (org: Org) => {
    if (!accessToken) return;
    setDetailTab('overview');
    setDetailLoading(true);
    setDetail({ ...org, municipality: null, wardNo: null, address: null, mobile: null, website: null, registrationNo: null, registrationDate: null, fiscalYear: null, themeColor: null, subscriptionStart: null, subscriptionEnd: null, trialEnd: null, isMultiBranch: false, aiEnabled: false, aiCredit: 0, storageLimitMb: 0, storageUsedMb: 0, maxMembers: 0, maxUsers: 0, maxBranches: 0, updatedAt: org.createdAt, stats: { users: org.users, activeUsers: 0, employees: org.employees, auditEvents: 0, failedLogins: 0, lastLoginAt: org.lastLoginAt } });
    try {
      const d = await superAdminApi.getOrganizationDetail(accessToken, org.id);
      setDetail(d);
      const [audit, users] = await Promise.all([
        superAdminApi.getOrgAuditLogs(accessToken, org.id, 50),
        superAdminApi.getPlatformUsers(accessToken),
      ]);
      setOrgAudit(Array.isArray(audit) ? audit : []);
      setDetailUsers(Array.isArray(users) ? users.filter((u: PlatformUser) => u.orgId === org.id) : []);
    } catch (err: any) {
      addNotification('Load Failed', err.message || 'Could not load organization details.', 'alert');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.name || !accessToken) return;
    setSaving(true);
    try {
      await superAdminApi.createOrganization(accessToken, {
        organizationCode: form.code.toUpperCase(),
        organizationName: form.name,
        shortName: form.shortName || undefined,
        organizationType: form.organizationType || undefined,
        slug: form.slug || undefined,
        province: form.province || undefined,
        district: form.district || undefined,
        municipality: form.municipality || undefined,
        wardNo: form.wardNo ? Number(form.wardNo) : undefined,
        address: form.address || undefined,
        phone: form.phone || undefined,
        mobile: form.mobile || undefined,
        email: form.email || undefined,
        website: form.website || undefined,
        pan: form.pan || undefined,
        registrationNo: form.registrationNo || undefined,
        registrationDate: form.registrationDate ? new Date(form.registrationDate).toISOString() : undefined,
        subscriptionPlan: form.subscriptionPlan || undefined,
        logoUrl: form.logoUrl || undefined,
        faviconUrl: form.faviconUrl || undefined,
        themeColor: form.themeColor || undefined,
        timezone: form.timezone || undefined,
        locale: form.locale || undefined,
        currencyCode: form.currencyCode || undefined,
        dateFormat: form.dateFormat || undefined,
        storageLimitMb: form.storageLimitMb ? Number(form.storageLimitMb) : undefined,
        storageUsedMb: form.storageUsedMb ? Number(form.storageUsedMb) : undefined,
        aiCredit: form.aiCredit !== '' ? Number(form.aiCredit) : undefined,
        maxMembers: form.maxMembers ? Number(form.maxMembers) : undefined,
        maxUsers: form.maxUsers ? Number(form.maxUsers) : undefined,
        maxBranches: form.maxBranches ? Number(form.maxBranches) : undefined,
        isMultiBranch: form.isMultiBranch,
        aiEnabled: form.aiEnabled,
      });
      addNotification('Organization Created', `${form.name} (${form.code.toUpperCase()}) has been created.`, 'success');
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await loadOrgs();
    } catch (err: any) {
      addNotification('Create Failed', err.message || 'Could not create organization.', 'alert');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (org: Org) => {
    if (!accessToken) return;
    const ns = org.status === 'Active' ? 'Suspended' : 'Active';
    try {
      await superAdminApi.updateOrganizationStatus(accessToken, org.id, ns);
      setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, status: ns } : o));
      if (detail?.id === org.id) setDetail(prev => prev ? { ...prev, status: ns } : prev);
      addNotification('Status Updated', `${org.organizationName} is now ${ns}.`, ns === 'Active' ? 'success' : 'warning');
    } catch (err: any) {
      addNotification('Status Update Failed', err.message || 'Could not update status.', 'alert');
    }
    setActiveMenu(null);
    setConfirmSuspend(null);
  };

  const openEdit = (org: OrgDetail | Org) => {
    setEditForm({
      code: org.organizationCode,
      name: org.organizationName,
      shortName: org.shortName || '',
      organizationType: org.organizationType || '',
      slug: org.slug || '',
      district: org.district || '',
      province: org.province || '',
      municipality: (org as OrgDetail).municipality || '',
      wardNo: (org as OrgDetail).wardNo ? String((org as OrgDetail).wardNo) : '',
      address: (org as OrgDetail).address || '',
      phone: org.phone || '',
      mobile: (org as OrgDetail).mobile || '',
      email: org.email || '',
      website: (org as OrgDetail).website || '',
      pan: org.pan || '',
      registrationNo: (org as OrgDetail).registrationNo || '',
      govtRegNo: (org as OrgDetail).govtRegNo || '',
      registrationDate: (org as OrgDetail).registrationDate ? (org as OrgDetail).registrationDate!.slice(0, 10) : '',
      subscriptionPlan: org.subscriptionPlan || 'Trial',
      logoUrl: (org as OrgDetail).logoUrl || '',
      faviconUrl: (org as OrgDetail).faviconUrl || '',
      themeColor: (org as OrgDetail).themeColor || '#10b981',
      timezone: (org as OrgDetail).timezone || 'Asia/Kathmandu',
      locale: (org as OrgDetail).locale || 'ne',
      currencyCode: (org as OrgDetail).currencyCode || 'NPR',
      dateFormat: (org as OrgDetail).dateFormat || 'BS',
      storageLimitMb: (org as OrgDetail).storageLimitMb ? String((org as OrgDetail).storageLimitMb) : '',
      storageUsedMb: (org as OrgDetail).storageUsedMb ? String((org as OrgDetail).storageUsedMb) : '',
      aiCredit: (org as OrgDetail).aiCredit !== undefined && (org as OrgDetail).aiCredit !== null ? String((org as OrgDetail).aiCredit) : '',
      maxMembers: (org as OrgDetail).maxMembers ? String((org as OrgDetail).maxMembers) : '',
      maxUsers: (org as OrgDetail).maxUsers ? String((org as OrgDetail).maxUsers) : '',
      maxBranches: (org as OrgDetail).maxBranches ? String((org as OrgDetail).maxBranches) : '',
      isMultiBranch: !!(org as OrgDetail).isMultiBranch,
      aiEnabled: !!(org as OrgDetail).aiEnabled,
      contactName: '',
      contactEmail: '',
    });
    setEditOrg(org as OrgDetail);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrg || !accessToken) return;
    setSaving(true);
    try {
      await superAdminApi.updateOrganization(accessToken, editOrg.id, {
        organizationName: editForm.name,
        shortName: editForm.shortName || undefined,
        organizationType: editForm.organizationType || undefined,
        slug: editForm.slug || undefined,
        province: editForm.province || undefined,
        district: editForm.district || undefined,
        municipality: editForm.municipality || undefined,
        wardNo: editForm.wardNo ? Number(editForm.wardNo) : undefined,
        address: editForm.address || undefined,
        phone: editForm.phone || undefined,
        mobile: editForm.mobile || undefined,
        email: editForm.email || undefined,
        website: editForm.website || undefined,
        pan: editForm.pan || undefined,
        govtRegNo: editForm.govtRegNo || undefined,
        registrationNo: editForm.registrationNo || undefined,
        registrationDate: editForm.registrationDate ? new Date(editForm.registrationDate).toISOString() : undefined,
        subscriptionPlan: editForm.subscriptionPlan || undefined,
        logoUrl: editForm.logoUrl || undefined,
        faviconUrl: editForm.faviconUrl || undefined,
        themeColor: editForm.themeColor || undefined,
        timezone: editForm.timezone || undefined,
        locale: editForm.locale || undefined,
        currencyCode: editForm.currencyCode || undefined,
        dateFormat: editForm.dateFormat || undefined,
        storageLimitMb: editForm.storageLimitMb ? Number(editForm.storageLimitMb) : undefined,
        storageUsedMb: editForm.storageUsedMb ? Number(editForm.storageUsedMb) : undefined,
        aiCredit: editForm.aiCredit !== '' ? Number(editForm.aiCredit) : undefined,
        maxMembers: editForm.maxMembers ? Number(editForm.maxMembers) : undefined,
        maxUsers: editForm.maxUsers ? Number(editForm.maxUsers) : undefined,
        maxBranches: editForm.maxBranches ? Number(editForm.maxBranches) : undefined,
        isMultiBranch: editForm.isMultiBranch,
        aiEnabled: editForm.aiEnabled,
      });
      addNotification('Organization Updated', `${editForm.name} was updated successfully.`, 'success');
      setEditOrg(null);
      await Promise.all([loadOrgs(), openDetail({ ...editOrg, ...editForm, organizationCode: editOrg.organizationCode })]);
    } catch (err: any) {
      addNotification('Update Failed', err.message || 'Could not update organization.', 'alert');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = [['Code', 'Name', 'Status', 'District', 'Province', 'Users', 'Employees', 'Last Login', 'Created']];
    filtered.forEach(o => rows.push([o.organizationCode, o.organizationName, o.status, o.district || '', o.province || '', String(o.users), String(o.employees), o.lastLoginAt || '', o.createdAt]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'organizations.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortableTh = ({ label, k }: { label: string; k?: SortKey }) => (
    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">
      {k ? (
        <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-emerald-700 transition cursor-pointer">
          {label} <ArrowUpDown className={`w-3 h-3 ${sortKey === k ? 'text-emerald-600' : 'text-slate-600'}`} />
        </button>
      ) : label}
    </th>
  );

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Organizations', value: kpis.total, icon: Building2, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
          { label: 'Active', value: kpis.active, icon: BadgeCheck, color: 'text-green-600 bg-green-50 border-green-100' },
          { label: 'Suspended', value: kpis.suspended, icon: XCircle, color: 'text-amber-600 bg-amber-50 border-amber-100' },
          { label: 'Total Users', value: kpis.users, icon: Users, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${k.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-900 leading-none">{k.value}</div>
                <div className="text-[11px] text-slate-500 mt-1 font-medium">{k.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-emerald-700" />
              <span>Organizations</span>
              <span className="text-xs font-normal bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">{filtered.length}/{orgs.length}</span>
            </h1>
            <p className="text-slate-500 text-xs mt-1">Manage all registered cooperatives, users, and access controls.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer">
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={loadOrgs} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={openWizard}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs">
              <Plus className="w-4 h-4" /> New Organization
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
            <input type="text" placeholder="Search by name, code, district, province, or email..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-600 transition" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-transparent text-slate-700 font-medium outline-none cursor-pointer">
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <SortableTh label="Organization" k="organizationName" />
                <SortableTh label="Code" k="organizationCode" />
                <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">Type</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">Location</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">Users</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">Staff</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">Last Login</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">Subscription</th>
                <SortableTh label="Status" k="status" />
                <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(org => (
                <tr key={org.id} className="hover:bg-slate-50/60 transition group cursor-pointer" onClick={() => openDetail(org)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-slate-800 font-extrabold text-xs shrink-0`}
                        style={{ backgroundColor: org.status === 'Active' ? '#047857' : '#94a3b8' }}>
                        {org.organizationName.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 max-w-[220px] truncate">{org.organizationName}</div>
                        <div className="text-slate-500 text-[11px] flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {fmtDate(org.createdAt)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">{org.organizationCode}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold">
                      {org.organizationType || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-500" /> {org.district || '—'}</div>
                    <div className="text-slate-500 text-[11px] pl-4">{org.province || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 bg-slate-100 rounded-lg px-2 py-1">
                      <Users className="w-3.5 h-3.5 text-indigo-600" /> {org.users}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{org.employees}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDateTime(org.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${org.subscriptionStatus === 'Active' ? 'bg-emerald-500' : org.subscriptionStatus === 'Trial' ? 'bg-sky-500' : 'bg-slate-400'}`} />
                      <span className="text-slate-700 font-bold whitespace-nowrap">{org.subscriptionPlan || '—'}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${statusDot[org.status]}`} />
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${statusColors[org.status]}`}>{org.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openDetail(org)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-emerald-700 transition cursor-pointer" title="View">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <div className="relative">
                        <button onClick={() => setActiveMenu(activeMenu === org.id ? null : org.id)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition cursor-pointer">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                        {activeMenu === org.id && (
                          <div className="absolute right-0 z-20 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg text-xs overflow-hidden">
                            <button onClick={() => { openDetail(org); setActiveMenu(null); }} className="flex items-center gap-2.5 w-full px-4 py-2.5 hover:bg-slate-50 text-slate-700 cursor-pointer">
                              <Eye className="w-3.5 h-3.5" /> View Details
                            </button>
                            <button onClick={() => { setActiveMenu(null); openEdit(org); }} className="flex items-center gap-2.5 w-full px-4 py-2.5 hover:bg-slate-50 text-emerald-700 cursor-pointer">
                              <Pencil className="w-3.5 h-3.5" /> Edit Organization
                            </button>
                            <button onClick={() => { setConfirmSuspend(org); setActiveMenu(null); }} className="flex items-center gap-2.5 w-full px-4 py-2.5 hover:bg-slate-50 text-amber-600 cursor-pointer">
                              {org.status === 'Active'
                                ? <><Pause className="w-3.5 h-3.5" /> Suspend Organization</>
                                : <><Play className="w-3.5 h-3.5" /> Activate Organization</>}
                            </button>
                            <hr className="border-slate-100 my-1" />
                            <button onClick={() => { addNotification('Delete Unavailable', 'Organization deletion is not enabled on this plan.', 'warning'); setActiveMenu(null); }}
                              className="flex items-center gap-2.5 w-full px-4 py-2.5 hover:bg-red-50 text-red-600 cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" /> Delete Organization
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} className="text-center py-12 text-slate-500">No organizations found.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={10} className="text-center py-12 text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-2" /> Loading organizations...
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Provision Wizard Modal ── */}
      {showCreate && (() => {
        const iCls = 'w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700 transition';
        const lCls = 'text-xs font-bold text-slate-700 block mb-1';
        const STEPS = ['Organization','Subscription','Branch','Administrator','Review'];
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-2"><Building2 className="w-5 h-5 text-emerald-700" /><span className="font-extrabold text-slate-900 text-sm">New Organization</span><span className="text-xs text-slate-500">— Step {Math.min(wizardStep,5)} of 5</span></div>
                {wizardStep < 6 && <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button>}
              </div>
              {wizardStep < 6 && (
                <div className="px-6 py-3 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-1">
                    {STEPS.map((s, i) => {
                      const n = i+1; const done = wizardStep>n; const active = wizardStep===n;
                      return (<React.Fragment key={s}><div className="flex items-center gap-1.5 shrink-0"><div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${done?'bg-emerald-600 text-white':active?'bg-emerald-700 text-white':'border-2 border-slate-300 text-slate-500'}`}>{done?<CheckCircle2 className="w-3.5 h-3.5"/>:n}</div><span className={`text-[10px] font-semibold hidden sm:inline ${active?'text-emerald-700':done?'text-emerald-600':'text-slate-500'}`}>{s}</span></div>{i<4&&<div className={`flex-1 h-0.5 mx-1 rounded ${wizardStep>n?'bg-emerald-500':'bg-slate-200'}`}/>}</React.Fragment>);
                    })}
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {wizardError && <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl px-4 py-2.5"><AlertCircle className="w-3.5 h-3.5 shrink-0"/>{wizardError}</div>}

                {/* Step 1 */}
                {wizardStep===1&&<div className="space-y-4"><p className="text-xs text-slate-500">Enter the cooperative's legal identity and contact details.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lCls}>Code <span className="text-emerald-600">*</span></label>
                      <div className="relative">
                        <input
                          value={wizardForm.code}
                          onChange={e => handleCodeChange(e.target.value)}
                          maxLength={12}
                          placeholder="Auto-generated"
                          className={`${iCls} font-mono pr-8`}
                          autoFocus
                        />
                        <button type="button" onClick={regenerateCode} title="Re-generate from name" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-500 transition-colors">
                          <Wand2 className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                      <p className="text-[10px] mt-1">
                        {codeManuallyEdited
                          ? <span className="text-amber-600">Manually set · click wand to regenerate</span>
                          : <span className="text-slate-500">Auto-generated from name · edit to override</span>
                        }
                      </p>
                    </div>
                    <div>
                      <label className={lCls}>Short Name</label>
                      <input value={wizardForm.shortName} onChange={e => handleShortNameChange(e.target.value)} maxLength={20} placeholder="e.g. Pragati" className={iCls}/>
                      <p className="text-[10px] text-slate-500 mt-1">Used for code generation if provided</p>
                    </div>
                  </div>
                  <div><label className={lCls}>Full Name <span className="text-emerald-600">*</span></label><input value={wizardForm.name} onChange={e => handleNameChange(e.target.value)} placeholder="Pragati Savings & Credit Cooperative Ltd." className={iCls}/></div>
                  <div className="grid grid-cols-2 gap-3"><div><label className={lCls}>Type</label><select value={wizardForm.organizationType} onChange={e=>wf('organizationType',e.target.value)} className={`${iCls} bg-white`}>{['Cooperative','SACCOS','School','College','NGO','Hospital','Business','Other'].map(t=><option key={t}>{t}</option>)}</select></div><div><label className={lCls}>Registration No.</label><input value={wizardForm.registrationNo} onChange={e=>wf('registrationNo',e.target.value)} placeholder="Auto-generated" className={`${iCls} font-mono`}/><p className="text-[10px] text-slate-500 mt-1">Format: TYPE-YEAR-SEQ · edit to override</p></div></div>
                  <div><label className={lCls}>Govt. Registration No. <span className="text-emerald-600">*</span></label><input value={wizardForm.govtRegNo} onChange={e=>wf('govtRegNo',e.target.value)} placeholder="e.g. 547/2080 — Department of Cooperatives" className={`${iCls} font-mono`}/><p className="text-[10px] text-slate-500 mt-1">Issued by Department of Cooperatives / Registrar's Office</p></div>
                  <div className="grid grid-cols-3 gap-3"><div><label className={lCls}>Province <span className="text-emerald-600">*</span></label>{geoLoading?<input value={wizardForm.province} onChange={e=>wf('province',e.target.value)} placeholder="Loading…" className={iCls}/>:<select value={wizardForm.province} onChange={e=>handleProvinceChange(e.target.value)} className={`${iCls} bg-white`}><option value="">Select Province</option>{geoProvinces.map(p=><option key={p} value={p}>{p}</option>)}</select>}</div><div><label className={lCls}>District <span className="text-emerald-600">*</span></label>{!geoLoading&&geoProvinces.length>0?<select value={wizardForm.district} onChange={e=>handleDistrictChange(e.target.value)} className={`${iCls} bg-white`}><option value="">Select District</option>{geoDistricts.map(d=><option key={d} value={d}>{d}</option>)}</select>:<input value={wizardForm.district} onChange={e=>wf('district',e.target.value)} placeholder="Kathmandu" className={iCls}/>}</div><div><label className={lCls}>Municipality <span className="text-emerald-600">*</span></label>{!geoLoading&&geoProvinces.length>0?<select value={wizardForm.municipality} onChange={e=>wf('municipality',e.target.value)} className={`${iCls} bg-white`}><option value="">Select Municipality</option>{geoMunicipalities.map(m=><option key={m} value={m}>{m}</option>)}</select>:<input value={wizardForm.municipality} onChange={e=>wf('municipality',e.target.value)} placeholder="KMC" className={iCls}/>}</div></div>
                  <div className="grid grid-cols-3 gap-3"><div><label className={lCls}>Address</label><input value={wizardForm.address} onChange={e=>wf('address',e.target.value)} placeholder="Street, City" className={iCls}/></div><div><label className={lCls}>Ward No.</label><input type="number" min={1} value={wizardForm.wardNo} onChange={e=>wf('wardNo',e.target.value)} placeholder="e.g. 5" className={iCls}/></div><div><label className={lCls}>Phone</label><input value={wizardForm.phone} onChange={e=>wf('phone',e.target.value)} placeholder="+977-1-4000000" className={iCls}/></div></div>
                  <div className="grid grid-cols-3 gap-3"><div><label className={lCls}>Mobile</label><input value={wizardForm.mobile} onChange={e=>wf('mobile',e.target.value)} placeholder="+977-98XXXXXXXX" className={iCls}/></div><div><label className={lCls}>Email <span className="text-emerald-600">*</span></label><input type="email" value={wizardForm.email} onChange={e=>wf('email',e.target.value)} placeholder="info@coop.org.np" className={iCls}/></div><div><label className={lCls}>Website</label><input value={wizardForm.website} onChange={e=>wf('website',e.target.value)} placeholder="www.coop.org.np" className={iCls}/></div></div>
                  <div className="grid grid-cols-2 gap-3"><div><label className={lCls}>PAN / VAT No. <span className="text-emerald-600">*</span></label><input value={wizardForm.pan} onChange={e=>wf('pan',e.target.value)} placeholder="302910293" className={`${iCls} font-mono`}/></div></div>
                </div>}

                {/* Step 2 */}
                {wizardStep===2&&<div className="space-y-4"><p className="text-xs text-slate-500">Configure the subscription plan and feature limits.</p>
                  <div className="grid grid-cols-2 gap-3">{[{plan:'Trial',desc:'30-day free trial',c:'border-sky-300 bg-sky-50 text-sky-700'},{plan:'Starter',desc:'Up to 500 members',c:'border-emerald-300 bg-emerald-50 text-emerald-700'},{plan:'Growth',desc:'Up to 5,000 members',c:'border-violet-300 bg-violet-50 text-violet-700'},{plan:'Enterprise',desc:'Unlimited',c:'border-amber-300 bg-amber-50 text-amber-700'}].map(p=><button key={p.plan} type="button" onClick={()=>wf('subscriptionPlan',p.plan)} className={`p-3 rounded-xl border-2 text-left cursor-pointer transition ${wizardForm.subscriptionPlan===p.plan?p.c:'border-slate-200 text-slate-700 hover:border-slate-300'}`}><div className="font-bold text-xs">{p.plan}</div><div className="text-[10px] opacity-70 mt-0.5">{p.desc}</div></button>)}</div>
                  <div className="grid grid-cols-3 gap-3"><div><label className={lCls}>Max Members</label><input type="number" min={1} value={wizardForm.maxMembers} onChange={e=>wf('maxMembers',e.target.value)} className={iCls}/></div><div><label className={lCls}>Max Users</label><input type="number" min={1} value={wizardForm.maxUsers} onChange={e=>wf('maxUsers',e.target.value)} className={iCls}/></div><div><label className={lCls}>Max Branches</label><input type="number" min={1} value={wizardForm.maxBranches} onChange={e=>wf('maxBranches',e.target.value)} className={iCls}/></div></div>
                  <div className="flex gap-6"><label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer"><input type="checkbox" checked={wizardForm.isMultiBranch} onChange={e=>wf('isMultiBranch',e.target.checked)} className="w-4 h-4 accent-emerald-700"/> Multi-Branch</label><label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer"><input type="checkbox" checked={wizardForm.aiEnabled} onChange={e=>wf('aiEnabled',e.target.checked)} className="w-4 h-4 accent-emerald-700"/> AI Assistant</label></div>
                </div>}

                {/* Step 3 */}
                {wizardStep===3&&<div className="space-y-4">
                  <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"/><p className="text-xs text-emerald-800">A <strong>Head Office branch</strong> will be created and linked to the admin account.</p></div>
                  <div><label className={lCls}>Branch Name <span className="text-emerald-600">*</span></label><input value={wizardForm.branchName} onChange={e=>wf('branchName',e.target.value)} placeholder={`${wizardForm.name||'Organization'} - Head Office`} className={iCls} autoFocus/></div>
                  <div><label className={lCls}>Branch Address</label><input value={wizardForm.branchAddress} onChange={e=>wf('branchAddress',e.target.value)} placeholder={wizardForm.address||'Main Office Address'} className={iCls}/></div>
                  <div><label className={lCls}>Branch Phone</label><input value={wizardForm.branchPhone} onChange={e=>wf('branchPhone',e.target.value)} placeholder={wizardForm.phone||'+977-...'} className={iCls}/></div>
                </div>}

                {/* Step 4 */}
                {wizardStep===4&&<div className="space-y-4">
                  <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-3"><ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5"/><p className="text-xs text-indigo-800">This account gets <strong>Organization Administrator</strong> role with full permissions. Login: <strong>Code + Username + Password</strong>.</p></div>
                  <div className="grid grid-cols-2 gap-3"><div><label className={lCls}>Full Name <span className="text-emerald-600">*</span></label><input value={wizardForm.adminFullName} onChange={e=>{wf('adminFullName',e.target.value);if(!wizardForm.adminUsername)wf('adminUsername',e.target.value.toLowerCase().replace(/\s+/g,'.').replace(/[^a-z0-9.]/g,'').slice(0,20));}} placeholder="Rajesh Kumar Sharma" className={iCls} autoFocus/></div><div><label className={lCls}>Username <span className="text-emerald-600">*</span></label><input value={wizardForm.adminUsername} onChange={e=>wf('adminUsername',e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g,''))} placeholder="rajesh.sharma" className={`${iCls} font-mono`}/><p className="text-[10px] text-slate-500 mt-1">Login: <span className="font-mono font-bold">{wizardForm.code||'CODE'}</span> + <span className="font-mono font-bold">{wizardForm.adminUsername||'username'}</span></p></div></div>
                  <div className="grid grid-cols-2 gap-3"><div><label className={lCls}>Email <span className="text-emerald-600">*</span></label><input type="email" value={wizardForm.adminEmail} onChange={e=>wf('adminEmail',e.target.value)} placeholder="admin@cooperative.com" className={iCls}/><p className="text-[10px] text-slate-500 mt-1">For password recovery only.</p></div><div><label className={lCls}>Phone</label><input value={wizardForm.adminPhone} onChange={e=>wf('adminPhone',e.target.value)} placeholder="+977-98XXXXXXXX" className={iCls}/></div></div>
                  <div><label className={lCls}>One-Time Password <span className="text-emerald-600">*</span></label><div className="flex gap-2"><div className="relative flex-1"><input type={showProvisionPw?'text':'password'} value={wizardForm.adminTemporaryPassword} readOnly className={`${iCls} pr-9 bg-slate-50 font-mono`}/><button type="button" onClick={()=>setShowProvisionPw(p=>!p)} className="absolute right-2.5 top-2 text-slate-500 cursor-pointer">{showProvisionPw?<EyeOff className="w-3.5 h-3.5"/>:<Eye className="w-3.5 h-3.5"/>}</button></div><button type="button" onClick={copyTempPassword} title="Copy password" className="px-3 rounded-xl border border-slate-300 text-slate-500 hover:text-emerald-700 hover:border-emerald-700 transition cursor-pointer"><Copy className="w-3.5 h-3.5"/></button><button type="button" onClick={regenerateTempPassword} title="Generate new password" className="px-3 rounded-xl border border-slate-300 text-slate-500 hover:text-emerald-700 hover:border-emerald-700 transition cursor-pointer"><RefreshCw className="w-3.5 h-3.5"/></button></div><p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-amber-500"/>Auto-generated one-time password — emailed to <strong>{wizardForm.adminEmail||'the admin'}</strong>. It must be changed on first login.</p></div>
                </div>}

                {/* Step 5 — Review */}
                {wizardStep===5&&<div className="space-y-4"><p className="text-xs text-slate-500">Review before creating. Organization code cannot be changed later.</p>
                  {[{title:'Organization',icon:Building2,rows:[['Code',wizardForm.code,true],['Name',wizardForm.name],['Type',wizardForm.organizationType],['District',wizardForm.district],['Phone',wizardForm.phone],['Email',wizardForm.email],['PAN',wizardForm.pan]]},{title:'Subscription',icon:BadgeCheck,rows:[['Plan',wizardForm.subscriptionPlan],['Max Members',wizardForm.maxMembers],['Max Users',wizardForm.maxUsers],['Multi-Branch',wizardForm.isMultiBranch?'Yes':'No']]},{title:'Head Office Branch',icon:MapPin,rows:[['Name',wizardForm.branchName],['Code',`${wizardForm.code}-HO`,true],['Address',wizardForm.branchAddress]]},{title:'Administrator',icon:ShieldAlert,rows:[['Full Name',wizardForm.adminFullName],['Username',wizardForm.adminUsername,true],['Email',wizardForm.adminEmail],['Role','Organization Administrator']]}].map(sec=>{const Icon=sec.icon;return(<div key={sec.title} className="border border-slate-200 rounded-xl overflow-hidden"><div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100"><Icon className="w-3.5 h-3.5 text-emerald-700"/><span className="text-xs font-bold text-slate-700">{sec.title}</span></div><div className="divide-y divide-slate-100">{sec.rows.filter(r=>r[1]).map(([l,v,m])=><div key={l as string} className="flex items-center justify-between px-4 py-2"><span className="text-[11px] text-slate-500">{l}</span><span className={`text-xs font-semibold ${m?'font-mono text-emerald-700':'text-slate-800'}`}>{v}</span></div>)}</div></div>);})}
                </div>}

                {/* Step 6 — Success */}
                {wizardStep===6&&provisionResult&&<div className="space-y-4">
                  <div className="text-center py-3"><div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3"><CheckCircle2 className="w-7 h-7 text-emerald-600"/></div><h3 className="text-base font-extrabold text-slate-900">Organization Created!</h3><p className="text-xs text-slate-500 mt-1">Share the credentials below with the administrator.</p></div>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden"><div className="px-5 py-3 bg-emerald-700 text-white"><p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">Login Credentials</p></div>
                  <div className="divide-y divide-slate-200">{[['Organization Code',provisionResult.organization?.organizationCode,true],['Organization Name',provisionResult.organization?.organizationName],['Branch',`${provisionResult.branch?.name} (${provisionResult.branch?.code})`],['Admin Username',provisionResult.adminUser?.username,true],['Subscription',wizardForm.subscriptionPlan]].map(([l,v,m])=><div key={l as string} className="flex items-center justify-between px-5 py-2.5"><span className="text-[11px] text-slate-500">{l}</span><span className={`text-xs font-bold ${m?'font-mono text-emerald-700':'text-slate-800'}`}>{v}</span></div>)}
                  <div className="flex items-center justify-between px-5 py-2.5"><span className="text-[11px] text-slate-500">Temporary Password</span><div className="flex items-center gap-2"><span className="text-xs font-bold font-mono text-emerald-700">{showProvisionPw?provisionResult.temporaryPassword:'●'.repeat((provisionResult.temporaryPassword||'').length)}</span><button type="button" onClick={()=>setShowProvisionPw(p=>!p)} className="text-slate-500">{showProvisionPw?<EyeOff className="w-3.5 h-3.5"/>:<Eye className="w-3.5 h-3.5"/>}</button></div></div></div></div>
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>Admin must change this password on first login.</div>
                </div>}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-200 shrink-0 flex items-center justify-between">
                <div>{wizardStep>1&&wizardStep<6&&<button type="button" onClick={prevStep} className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer">← Back</button>}</div>
                <div className="flex items-center gap-2">
                  {wizardStep===6?(<><button type="button" onClick={copyCredentials} className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-2 cursor-pointer"><Copy className="w-3.5 h-3.5"/>Copy</button><button type="button" onClick={()=>setShowCreate(false)} className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer shadow-xs">Finish</button></>)
                  :wizardStep===5?(<button type="button" onClick={handleProvision} disabled={wizardProvisioning} className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50">{wizardProvisioning?<><Loader2 className="w-3.5 h-3.5 animate-spin"/>Creating…</>:<><Building2 className="w-3.5 h-3.5"/>Create Organization</>}</button>)
                  :(<button type="button" onClick={nextStep} className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer shadow-xs">Next →</button>)}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Modal */}
      {editOrg && (
        <div className="fixed inset-0 z-[55] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-emerald-700" /> Edit Organization
                <span className="text-xs font-normal bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-mono">{editOrg.organizationCode}</span>
              </h2>
              <button onClick={() => setEditOrg(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleEdit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Organization Name *</label>
                  <input required value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} placeholder="Full legal name"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-600" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Short Name</label>
                  <input value={editForm.shortName} onChange={e => setEditForm(p => ({ ...p, shortName: e.target.value }))} maxLength={20} placeholder="Pragati"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Organization Type</label>
                  <select value={editForm.organizationType} onChange={e => setEditForm(p => ({ ...p, organizationType: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700 bg-white">
                    <option value="Cooperative">Cooperative</option>
                    <option value="SACCOS">SACCOS</option>
                    <option value="School">School</option>
                    <option value="College">College</option>
                    <option value="NGO">NGO</option>
                    <option value="Hospital">Hospital</option>
                    <option value="Business">Business</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Slug</label>
                  <input value={editForm.slug} onChange={e => setEditForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') }))} placeholder="pragati-coop"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700 font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">District</label>
                  <input value={editForm.district} onChange={e => setEditForm(p => ({ ...p, district: e.target.value }))} placeholder="Kathmandu"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Province</label>
                  <input value={editForm.province} onChange={e => setEditForm(p => ({ ...p, province: e.target.value }))} placeholder="Bagmati"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Municipality</label>
                  <input value={editForm.municipality} onChange={e => setEditForm(p => ({ ...p, municipality: e.target.value }))} placeholder="Kathmandu Metropolitan"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Registration No.</label>
                  <input value={editForm.registrationNo} onChange={e => setEditForm(p => ({ ...p, registrationNo: e.target.value }))} placeholder="COP-2083-0001"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Registered Address</label>
                <input value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} placeholder="Street, ward, city"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Ward No.</label>
                  <input type="number" min={1} max={99} value={editForm.wardNo} onChange={e => setEditForm(p => ({ ...p, wardNo: e.target.value }))} placeholder="e.g. 3"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Subscription Plan</label>
                  <select value={editForm.subscriptionPlan} onChange={e => setEditForm(p => ({ ...p, subscriptionPlan: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700 bg-white">
                    <option value="Trial">Trial</option>
                    <option value="Starter">Starter</option>
                    <option value="Growth">Growth</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Phone</label>
                  <input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} placeholder="+977-1-4000000"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Email</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} placeholder="info@coop.org.np"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">PAN / VAT No.</label>
                  <input value={editForm.pan} onChange={e => setEditForm(p => ({ ...p, pan: e.target.value }))} placeholder="302910293"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700 font-mono" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Govt. Reg. No.</label>
                  <input value={editForm.govtRegNo} onChange={e => setEditForm(p => ({ ...p, govtRegNo: e.target.value }))} placeholder="e.g. 547/2080"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700 font-mono" />
                </div>
                <div className="flex items-end">
                  <div className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-500">
                    Code <span className="font-mono font-bold text-emerald-700">{editOrg.organizationCode}</span> is immutable
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Max Members</label>
                  <input type="number" min={1} value={editForm.maxMembers} onChange={e => setEditForm(p => ({ ...p, maxMembers: e.target.value }))} placeholder="1000"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Max Users</label>
                  <input type="number" min={1} value={editForm.maxUsers} onChange={e => setEditForm(p => ({ ...p, maxUsers: e.target.value }))} placeholder="50"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Max Branches</label>
                  <input type="number" min={1} value={editForm.maxBranches} onChange={e => setEditForm(p => ({ ...p, maxBranches: e.target.value }))} placeholder="5"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={editForm.isMultiBranch} onChange={e => setEditForm(p => ({ ...p, isMultiBranch: e.target.checked }))}
                    className="w-4 h-4 accent-emerald-700" />
                  Multi-Branch
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={editForm.aiEnabled} onChange={e => setEditForm(p => ({ ...p, aiEnabled: e.target.checked }))}
                    className="w-4 h-4 accent-emerald-700" />
                  AI Assistant Enabled
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <ImagePicker label="Organization Logo" value={editForm.logoUrl} onChange={(v) => setEditForm(p => ({ ...p, logoUrl: v }))} maxDimension={512} />
                </div>
                <div>
                  <ImagePicker label="Favicon (Small Icon)" value={editForm.faviconUrl} onChange={(v) => setEditForm(p => ({ ...p, faviconUrl: v }))} maxDimension={128} />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Theme Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(editForm.themeColor) ? editForm.themeColor : '#10b981'} onChange={e => setEditForm(p => ({ ...p, themeColor: e.target.value }))}
                      className="w-10 h-9 border border-slate-300 rounded-xl cursor-pointer bg-white" />
                    <input value={editForm.themeColor} maxLength={7} onChange={e => setEditForm(p => ({ ...p, themeColor: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-700" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Timezone</label>
                  <select value={editForm.timezone} onChange={e => setEditForm(p => ({ ...p, timezone: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700 bg-white">
                    <option value="Asia/Kathmandu">Asia/Kathmandu</option>
                    <option value="Asia/Kolkata">Asia/Kolkata</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Locale</label>
                  <select value={editForm.locale} onChange={e => setEditForm(p => ({ ...p, locale: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700 bg-white">
                    <option value="ne">Nepali (नेपाली)</option>
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Currency Code</label>
                  <select value={editForm.currencyCode} onChange={e => setEditForm(p => ({ ...p, currencyCode: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700 bg-white">
                    <option value="NPR">NPR</option>
                    <option value="USD">USD</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Date Format</label>
                  <select value={editForm.dateFormat} onChange={e => setEditForm(p => ({ ...p, dateFormat: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700 bg-white">
                    <option value="BS">Bikram Sambat (BS)</option>
                    <option value="AD">Gregorian (AD)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Storage Limit (MB)</label>
                  <input type="number" min={0} value={editForm.storageLimitMb} onChange={e => setEditForm(p => ({ ...p, storageLimitMb: e.target.value }))} placeholder="5120"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Storage Used (MB)</label>
                  <input type="number" min={0} value={editForm.storageUsedMb} onChange={e => setEditForm(p => ({ ...p, storageUsedMb: e.target.value }))} placeholder="0"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">AI Credits</label>
                  <input type="number" min={0} value={editForm.aiCredit} onChange={e => setEditForm(p => ({ ...p, aiCredit: e.target.value }))} placeholder="0"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-700" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditOrg(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Suspend / Activate */}
      {confirmSuspend && (
        <div className="fixed inset-0 z-[60] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${confirmSuspend.status === 'Active' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {confirmSuspend.status === 'Active' ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  {confirmSuspend.status === 'Active' ? 'Suspend Organization?' : 'Activate Organization?'}
                </h3>
                <p className="text-xs text-slate-500">{confirmSuspend.organizationName} ({confirmSuspend.organizationCode})</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
              {confirmSuspend.status === 'Active'
                ? 'Suspending disables logins and system access for all users of this organization. Data is preserved and can be restored at any time.'
                : 'Activating restores full system access and logins for all users of this organization.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmSuspend(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
              <button onClick={() => toggleStatus(confirmSuspend)}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition cursor-pointer shadow-xs ${confirmSuspend.status === 'Active' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-700 hover:bg-emerald-800'}`}>
                {confirmSuspend.status === 'Active' ? 'Confirm Suspend' : 'Confirm Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex justify-end">
          <div className={`${fullscreen ? 'w-full' : 'w-full max-w-3xl'} bg-white shadow-2xl h-full flex flex-col animate-slide-in`}>
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-start justify-between">
              <div className="flex items-center gap-4">
                {detail.logoUrl && (detail.logoUrl.startsWith('data:') || detail.logoUrl.startsWith('http')) ? (
                  <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center bg-slate-100 border border-slate-200">
                    <img src={detail.logoUrl} alt="logo" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-slate-800 font-extrabold text-lg"
                    style={{ backgroundColor: detail.status === 'Active' ? '#047857' : '#94a3b8' }}>
                    {detail.organizationName.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-extrabold text-slate-900">{detail.organizationName}</h2>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${statusColors[detail.status]}`}>{detail.status}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">{detail.organizationCode}</span>
                    {detail.registrationNo && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {detail.registrationNo}</span>}
                    {detail.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {detail.email}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => openEdit(detail)} title="Edit Organization"
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-emerald-700 transition cursor-pointer">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setFullscreen(f => !f)} title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-emerald-700 transition cursor-pointer">
                  {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button onClick={() => { setDetail(null); setFullscreen(false); }} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-5 pt-3 border-b border-slate-200">
              {[
                { id: 'overview' as const, label: 'Overview', icon: Activity },
                { id: 'users' as const, label: `Users (${detailUsers.length})`, icon: Users },
                { id: 'audit' as const, label: `Audit (${orgAudit.length})`, icon: ShieldAlert },
              ].map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => setDetailTab(t.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition cursor-pointer ${detailTab === t.id ? 'bg-emerald-50 text-emerald-700 border border-b-0 border-emerald-200' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'}`}>
                    <Icon className="w-4 h-4" /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {detailLoading && (
                <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-600 mr-2" /> Loading...
                </div>
              )}

              {!detailLoading && detailTab === 'overview' && (
                <div className="space-y-5">
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Total Users', value: detail.stats.users, icon: Users, color: 'text-indigo-600' },
                      { label: 'Active Users', value: detail.stats.activeUsers, icon: BadgeCheck, color: 'text-emerald-600' },
                      { label: 'Employees', value: detail.stats.employees, icon: Building2, color: 'text-blue-600' },
                      { label: 'Audit Events', value: detail.stats.auditEvents, icon: ShieldAlert, color: 'text-amber-600' },
                      { label: 'Failed Logins', value: detail.stats.failedLogins, icon: ShieldCheck, color: 'text-rose-600' },
                      { label: 'Last Login', value: fmtDateTime(detail.stats.lastLoginAt), icon: Clock, color: 'text-slate-600', small: true },
                    ].map(s => {
                      const Icon = s.icon;
                      return (
                        <div key={s.label} className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-slate-500">{s.label}</span>
                            <Icon className={`w-4 h-4 ${s.color}`} />
                          </div>
                          <div className={`mt-1.5 ${s.small ? 'text-xs font-bold text-slate-700' : 'text-2xl font-extrabold text-slate-900'}`}>{s.value}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Profile grid */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                    <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2"><Building2 className="w-4 h-4 text-emerald-700" /> Organization Profile</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[
                        { label: 'Organization Name', value: detail.organizationName },
                        { label: 'Organization Code', value: detail.organizationCode, mono: true },
                        { label: 'Short Name', value: detail.shortName || '—' },
                        { label: 'Organization Type', value: detail.organizationType || '—' },
                        { label: 'Slug', value: detail.slug || '—', mono: true },
                        { label: 'Registration No.', value: detail.registrationNo || '—' },
                        { label: 'PAN / VAT', value: detail.pan || '—' },
                        { label: 'Govt. Reg. No.', value: detail.govtRegNo || '—' },
                        { label: 'Registration Date', value: detail.registrationDate ? fmtDate(detail.registrationDate) : '—' },
                        { label: 'Fiscal Year', value: detail.fiscalYear || '—' },
                        { label: 'Province', value: detail.province || '—' },
                        { label: 'District', value: detail.district || '—' },
                        { label: 'Municipality', value: detail.municipality || '—' },
                        { label: 'Ward No.', value: detail.wardNo ? String(detail.wardNo) : '—' },
                        { label: 'Address', value: detail.address || '—' },
                        { label: 'Phone', value: detail.phone || '—' },
                        { label: 'Mobile', value: detail.mobile || '—' },
                        { label: 'Email', value: detail.email || '—' },
                        { label: 'Website', value: detail.website || '—' },
                        { label: 'Subscription Plan', value: detail.subscriptionPlan || '—' },
                        { label: 'Subscription Status', value: detail.subscriptionStatus || '—' },
                        { label: 'Subscription Start', value: detail.subscriptionStart ? fmtDate(detail.subscriptionStart) : '—' },
                        { label: 'Subscription End', value: detail.subscriptionEnd ? fmtDate(detail.subscriptionEnd) : '—' },
                        { label: 'Trial Ends', value: detail.trialEnd ? fmtDate(detail.trialEnd) : '—' },
                        { label: 'Max Members', value: detail.maxMembers ? String(detail.maxMembers) : '—' },
                        { label: 'Max Users', value: detail.maxUsers ? String(detail.maxUsers) : '—' },
                        { label: 'Max Branches', value: detail.maxBranches ? String(detail.maxBranches) : '—' },
                        { label: 'Multi-Branch', value: detail.isMultiBranch ? 'Yes' : 'No' },
                        { label: 'AI Assistant', value: detail.aiEnabled ? 'Enabled' : 'Disabled' },
                        { label: 'Created', value: fmtDateTime(detail.createdAt) },
                        { label: 'Last Updated', value: fmtDateTime(detail.updatedAt) },
                      ].map(f => (
                        <div key={f.label} className="bg-white rounded-xl p-3 border border-slate-200">
                          <div className="text-[11px] text-slate-500 font-medium">{f.label}</div>
                          <div className={`text-xs font-bold text-slate-800 mt-0.5 break-words ${f.mono ? 'font-mono text-emerald-700' : ''}`}>{f.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setDetailTab('users')} className="px-4 py-2 text-xs font-bold text-slate-800 bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer shadow-xs flex items-center gap-2">
                      <Users className="w-4 h-4" /> View Users
                    </button>
                    <button onClick={() => setDetailTab('audit')} className="px-4 py-2 text-xs font-bold text-slate-800 bg-slate-700 hover:bg-slate-50 rounded-xl transition cursor-pointer shadow-xs flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4" /> View Audit Trail
                    </button>
                    <button onClick={() => { setConfirmSuspend({ id: detail.id, organizationCode: detail.organizationCode, organizationName: detail.organizationName, shortName: detail.shortName, status: detail.status, province: detail.province, district: detail.district, phone: detail.phone, email: detail.email, pan: detail.pan, users: detail.stats.users, employees: detail.stats.employees, lastLoginAt: detail.stats.lastLoginAt, createdAt: detail.createdAt }); }}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer shadow-xs flex items-center gap-2 ${detail.status === 'Active' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-700 hover:bg-emerald-800 text-white'}`}>
                      {detail.status === 'Active' ? <><Pause className="w-4 h-4" /> Suspend</> : <><Play className="w-4 h-4" /> Activate</>}
                    </button>
                  </div>
                </div>
              )}

              {!detailLoading && detailTab === 'users' && (
                <div className="space-y-3">
                  {detailUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                      <Users className="w-10 h-10 text-slate-600 mb-3" />
                      <p className="text-sm font-bold text-slate-600">No users in this organization</p>
                      <p className="text-xs mt-1">User accounts created for {detail.organizationName} will appear here.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            {['User', 'Username', 'Role', 'Department', 'Status', 'Last Login'].map(h => (
                              <th key={h} className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detailUsers.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50/60 transition">
                              <td className="px-4 py-3 font-semibold text-slate-800">{u.fullName || '—'}</td>
                              <td className="px-4 py-3 font-mono text-emerald-700 font-bold">{u.username}</td>
                              <td className="px-4 py-3 text-slate-600">{u.role || '—'}</td>
                              <td className="px-4 py-3 text-slate-600">{u.department || '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${u.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{u.status}</span>
                              </td>
                              <td className="px-4 py-3 text-slate-500">{fmtDateTime(u.lastLogin)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {!detailLoading && detailTab === 'audit' && (
                <div className="space-y-3">
                  {orgAudit.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                      <ShieldAlert className="w-10 h-10 text-slate-600 mb-3" />
                      <p className="text-sm font-bold text-slate-600">No audit events recorded</p>
                      <p className="text-xs mt-1">Authentication and security events for this organization will appear here.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            {['Event', 'User', 'Status', 'IP Address', 'Reason', 'Time'].map(h => (
                              <th key={h} className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {orgAudit.map(l => (
                            <tr key={l.id} className="hover:bg-slate-50/60 transition">
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1.5 font-bold px-2 py-0.5 rounded-full text-[11px] ${l.success ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>
                                  {l.success ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} {l.event}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-700 font-bold">{l.username || 'system'}</td>
                              <td className="px-4 py-3">{l.success ? 'Success' : 'Failed'}</td>
                              <td className="px-4 py-3 font-mono text-slate-500">{l.ipAddress || '—'}</td>
                              <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{l.reason || '—'}</td>
                              <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
