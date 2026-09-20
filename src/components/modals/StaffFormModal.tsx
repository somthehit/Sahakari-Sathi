import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Save, User, Phone, FileBadge, Briefcase, ShieldCheck, Wallet, Copy, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, UploadCloud, Sparkles } from 'lucide-react';
import { useCoop } from '../../context/CoopContext';
import { fetchOrgReference, createStaff, updateStaff, RefDepartment, RefDesignation, RefRole, RefBranch, Staff, StaffPayload } from '../../api/staff';
import { DateConverter } from '../../utils/DateConverter';

const inputCls = 'w-full bg-slate-50 border placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition rounded-xl px-3 py-2 text-xs text-slate-800';
const labelCls = 'block text-slate-700 text-[11px] font-semibold mb-1.5 tracking-wide uppercase';

const CollapsibleSection = ({ title, icon: Icon, children, defaultOpen = true, extraClasses = '' }: { title: string, icon: any, children: React.ReactNode, defaultOpen?: boolean, extraClasses?: string }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={`border border-slate-200 bg-slate-50/40 rounded-xl ${extraClasses}`}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100/50 transition rounded-xl"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <Icon className="w-4 h-4 text-emerald-700" /> {title}
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
  );
};

const GENDERS = ['Male', 'Female', 'Other'];
const EMPLOYMENT_TYPES = ['Permanent', 'Contract', 'Probation', 'Trainee', 'Part-time', 'Intern', 'Daily Wage'];
const STAFF_STATUSES = ['Draft', 'Pending Approval', 'Active', 'On Leave', 'Suspended', 'Resigned', 'Retired', 'Terminated'];
const CATEGORIES = ['Financial Staff', 'Non Financial Staff'];
const DATA_SCOPES = [
  { value: 'own', label: 'Own Data Only' },
  { value: 'branch', label: 'Branch-wide' },
  { value: 'organization', label: 'Organization-wide' },
  { value: 'all', label: 'All Data' },
];

const toStr = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const toDateInput = (v: unknown): string => {
  if (!v) return '';
  const s = String(v);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
};

const Field = ({ label, children, required, hint, span, action }: { label: string; children: React.ReactNode; required?: boolean; hint?: string; span?: boolean; action?: React.ReactNode }) => (
  <div className={span ? 'md:col-span-2' : ''}>
    <div className="flex items-center justify-between mb-1.5">
      <label className={labelCls}>{label} {required && <span className="text-emerald-600">*</span>}</label>
      {action}
    </div>
    {children}
    {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
  </div>
);

const FileInput = ({ label, hint, accept, fileName, onChange }: { label: string; hint?: string; accept?: string; fileName?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
  <div>
    <label className={labelCls}>{label}</label>
    <div className="relative border-2 border-dashed border-slate-200 rounded-xl px-4 py-3 bg-slate-50/50 hover:bg-slate-50 hover:border-emerald-400 transition cursor-pointer flex flex-col items-center justify-center gap-1 group">
      <UploadCloud className="w-4 h-4 text-slate-500 group-hover:text-emerald-500 transition" />
      <span className="text-xs text-slate-500 font-medium group-hover:text-slate-700 transition truncate w-full text-center">
        {fileName || 'Click to upload'}
      </span>
      <input type="file" accept={accept} onChange={onChange} className="absolute inset-0 opacity-0 cursor-pointer" />
    </div>
    {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
  </div>
);

interface FormState {
  firstName: string;
  middleName: string;
  lastName: string;
  salutation: string;
  gender: string;
  dob: string;
  dobBs: string;
  employeeCode: string;
  photoUrl: string;
  email: string;
  phone: string;
  citizenshipNumber: string;
  passportNumber: string;
  panNumber: string;
  category: string;
  isFinancialStaff: boolean;
  departmentId: string;
  designationId: string;
  branchId: string;
  employmentType: string;
  joiningDate: string;
  status: string;
  experience: string;
  basicSalary: string;
  allowances: string;
  pfContributionPercent: string;
  // System Access card
  enableErpLogin: boolean;
  username: string;
  systemEmail: string;
  roleId: string;
  dataScope: string;
  // File uploads (UI state)
  photoFileName: string;
  citizenshipFileName: string;
  passportFileName: string;
  panFileName: string;
  experienceFileName: string;
}

const emptyForm: FormState = {
  firstName: '', middleName: '', lastName: '', salutation: 'Mr.', gender: '', dob: '', dobBs: '', employeeCode: '', photoUrl: '',
  email: '', phone: '', citizenshipNumber: '', passportNumber: '', panNumber: '',
  category: 'Non Financial Staff', isFinancialStaff: false,
  departmentId: '', designationId: '', branchId: '', employmentType: 'Permanent', joiningDate: '',
  status: 'Active', experience: '',
  basicSalary: '', allowances: '', pfContributionPercent: '10',
  enableErpLogin: false, username: '', systemEmail: '', roleId: '', dataScope: 'own',
  photoFileName: '', citizenshipFileName: '', passportFileName: '', panFileName: '', experienceFileName: '',
};

export const StaffFormModal: React.FC = () => {
  const { staffFormOpen, staffFormMode, staffFormTarget, closeStaffForm, addNotification, bumpStaffRefresh } = useCoop();
  const isEdit = staffFormMode === 'edit';

  const [form, setForm] = useState<FormState>(emptyForm);
  const [ref, setRef] = useState<{ departments: RefDepartment[]; designations: RefDesignation[]; roles: RefRole[]; branches: RefBranch[] }>({ departments: [], designations: [], roles: [], branches: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!staffFormOpen) return;
    const s = staffFormTarget;
    setError(null);
    const initialCode = toStr(s?.employeeCode) || (isEdit ? '' : `STF-${Math.floor(100 + Math.random() * 900)}`);
    setForm({
      firstName: toStr(s?.firstName), middleName: toStr(s?.middleName), lastName: toStr(s?.lastName),
      salutation: 'Mr.', gender: toStr(s?.gender), dob: toDateInput(s?.dob), dobBs: '', employeeCode: initialCode, photoUrl: toStr(s?.photoUrl),
      email: toStr(s?.email), phone: toStr(s?.phone),
      citizenshipNumber: toStr(s?.citizenshipNumber), passportNumber: toStr(s?.passportNumber), panNumber: toStr(s?.panNumber),
      category: toStr(s?.category) || 'Non Financial Staff', isFinancialStaff: s?.isFinancialStaff ?? false,
      departmentId: toStr(s?.departmentId), designationId: toStr(s?.designationId), branchId: toStr(s?.branchId),
      employmentType: toStr(s?.employmentType) || 'Permanent', joiningDate: toDateInput(s?.joiningDate),
      status: toStr(s?.status) || 'Active', experience: toStr(s?.experience),
      basicSalary: toStr(s?.basicSalary), allowances: toStr(s?.allowances), pfContributionPercent: toStr(s?.pfContributionPercent) || '10',
      enableErpLogin: s?.enableErpLogin ?? false,
      username: toStr(s?.erp?.username), systemEmail: toStr(s?.erp?.email) || toStr(s?.email),
      roleId: toStr(s?.erp?.roleId), dataScope: toStr(s?.erp?.dataScope) || 'own',
      photoFileName: '', citizenshipFileName: '', passportFileName: '', panFileName: '', experienceFileName: '',
    });
    fetchOrgReference().then(setRef).catch(() => setRef({ departments: [], designations: [], roles: [], branches: [] }));
  }, [staffFormOpen, staffFormTarget, isEdit]);

  const set = (key: keyof FormState) => (value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const handleFileChange = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setForm(prev => ({ ...prev, [key]: e.target.files![0].name }));
    }
  };

  const handleNameChange = (first: string, last: string) => {
    setForm(prev => {
      const f = first !== undefined ? first : prev.firstName;
      const l = last !== undefined ? last : prev.lastName;
      const updated = { ...prev, firstName: f, lastName: l };
      if (!isEdit && (!prev.username || prev.username === `${prev.firstName.toLowerCase()}.${prev.lastName.toLowerCase()}`)) {
        const u = `${f.trim().toLowerCase()}.${l.trim().toLowerCase()}`.replace(/[^a-z0-9_.]/g, '');
        updated.username = u;
      }
      return updated;
    });
  };

  const handleRegenerateStaffCode = () => {
    set('employeeCode')(`STF-${Math.floor(100 + Math.random() * 900)}`);
  };

  const handleDobBsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const bsVal = e.target.value;
    setForm(prev => {
      let adVal = prev.dob;
      if (bsVal && bsVal.length >= 10) {
        try { adVal = DateConverter.bsToAd(bsVal); } catch {}
      }
      return { ...prev, dobBs: bsVal, dob: adVal };
    });
  };

  const handleDobAdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const adVal = e.target.value;
    setForm(prev => {
      let bsVal = prev.dobBs;
      if (adVal && adVal.length >= 10) {
        try { bsVal = DateConverter.adToBs(adVal); } catch {}
      }
      return { ...prev, dob: adVal, dobBs: bsVal };
    });
  };

  const designations = useMemo(() => (ref.designations ?? []).filter(d => d.departmentId === form.departmentId), [ref.designations, form.departmentId]);

  const validate = (): string | null => {
    if (!form.firstName.trim() || !form.lastName.trim()) return 'First name and last name are required.';
    if (!form.email.trim()) return 'Email is required.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email address.';
    if (form.enableErpLogin) {
      if (!form.username.trim()) return 'Enable ERP Login requires a username.';
      if (!/^[a-z][a-z0-9_.]{2,29}$/.test(form.username.trim())) return 'Username must be 3-30 lowercase alphanumeric characters (letters, numbers, underscores, dots).';
      if (!form.systemEmail.trim()) return 'Enable ERP Login requires an email address for login notifications.';
      if (!form.roleId) return 'Enable ERP Login requires an assigned role.';
    }
    return null;
  };

  const buildPayload = (): StaffPayload => {
    const staff: Partial<Staff> = {
      firstName: form.firstName.trim(), middleName: form.middleName.trim() || null, lastName: form.lastName.trim(),
      gender: form.gender || null, dob: form.dob || null, employeeCode: form.employeeCode.trim() || null,
      photoUrl: form.photoUrl.trim() || null, email: form.email.trim(), phone: form.phone.trim() || null,
      citizenshipNumber: form.citizenshipNumber.trim() || null, passportNumber: form.passportNumber.trim() || null,
      panNumber: form.panNumber.trim() || null, category: form.category, isFinancialStaff: form.isFinancialStaff,
      departmentId: form.departmentId || null, designationId: form.designationId || null, branchId: form.branchId || null,
      employmentType: form.employmentType || null, joiningDate: form.joiningDate || null,
      status: form.status, experience: form.experience.trim() || null,
      basicSalary: form.basicSalary.trim() || null, allowances: form.allowances.trim() || null, pfContributionPercent: form.pfContributionPercent.trim() || null,
    };
    const enableErpLogin = form.enableErpLogin;
    const systemAccess = enableErpLogin
      ? {
          username: form.username.trim(),
          email: form.systemEmail.trim(),
          roleId: form.roleId,
          branchId: form.branchId || null,
          dataScope: form.dataScope || 'own',
        }
      : null;
    return { staff, enableErpLogin, systemAccess };
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (isEdit && staffFormTarget) {
        const result = await updateStaff(staffFormTarget.id, payload);
        const pwdText = result.temporaryPassword ? ` Temp Password: ${result.temporaryPassword}` : '';
        addNotification('Staff Saved', `Staff member "${result.staff.fullName}" updated.${pwdText}`, 'success');
        bumpStaffRefresh();
        closeStaffForm();
      } else {
        const result = await createStaff(payload);
        const pwdText = result.temporaryPassword ? ` Temp Password: ${result.temporaryPassword}` : '';
        addNotification('Staff Created', `Staff member "${result.staff.fullName}" created.${pwdText}`, 'success');
        bumpStaffRefresh();
        closeStaffForm();
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Could not save staff record. Please try again.');
      addNotification('Staff Save Failed', e?.response?.data?.error || e?.message || 'Could not save staff.', 'alert');
    } finally {
      setSaving(false);
    }
  };

  if (!staffFormOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <User className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900 text-base">
                {isEdit ? `Edit Staff: ${staffFormTarget?.fullName || ''}` : 'Add New Staff Member'}
              </h2>
              <p className="text-xs text-slate-500">
                Staff master employee record &amp; optional ERP access credentials.
              </p>
            </div>
          </div>
          <button onClick={closeStaffForm} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs">
          {error && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* 1. Personal Information */}
          <CollapsibleSection title="Personal Information" icon={User} defaultOpen={true}>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-2">
              <div className="lg:col-span-1">
                <FileInput label="Staff Photo" accept="image/*" hint="JPG, PNG • Upload profile photo" fileName={form.photoFileName} onChange={handleFileChange('photoFileName')} />
              </div>
              <div className="lg:col-span-3 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Field label="Salutation">
                    <select className={inputCls} value={form.salutation} onChange={e => set('salutation')(e.target.value)}>
                      <option value="Mr.">Mr.</option>
                      <option value="Mrs.">Mrs.</option>
                      <option value="Ms.">Ms.</option>
                      <option value="Dr.">Dr.</option>
                    </select>
                  </Field>
                  <Field label="First Name" required>
                    <input className={inputCls} value={form.firstName} onChange={e => handleNameChange(e.target.value, form.lastName)} placeholder="e.g. Sita" />
                  </Field>
                  <Field label="Middle Name">
                    <input className={inputCls} value={form.middleName} onChange={e => set('middleName')(e.target.value)} placeholder="e.g. Maya" />
                  </Field>
                  <Field label="Last Name" required>
                    <input className={inputCls} value={form.lastName} onChange={e => handleNameChange(form.firstName, e.target.value)} placeholder="e.g. Sharma" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Date of Birth (BS)">
                    <input type="text" className={inputCls} value={form.dobBs} onChange={handleDobBsChange} placeholder="e.g. 2055-04-12" />
                  </Field>
                  <Field label="Date of Birth (AD)">
                    <input type="date" className={inputCls} value={form.dob} onChange={handleDobAdChange} />
                  </Field>
                  <Field label="Gender" required>
                    <select className={inputCls} value={form.gender} onChange={e => set('gender')(e.target.value)}>
                      <option value="">-- Select --</option>
                      {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </Field>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* 2. Contact Information */}
          <CollapsibleSection title="Contact Information" icon={Phone} defaultOpen={false}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <Field label="Official / Personal Email" required>
                <input type="email" className={inputCls} value={form.email} onChange={e => set('email')(e.target.value)} placeholder="e.g. sita.sharma@sahakari.org.np" />
              </Field>
              <Field label="Mobile Phone Number">
                <input className={inputCls} value={form.phone} onChange={e => set('phone')(e.target.value)} placeholder="e.g. 9841234567" />
              </Field>
            </div>
          </CollapsibleSection>

          {/* 3. Identity & Documents */}
          <CollapsibleSection title="Identity & Official Documents" icon={FileBadge} defaultOpen={false}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
              <div className="space-y-3">
                <Field label="Citizenship Number">
                  <input className={inputCls} value={form.citizenshipNumber} onChange={e => set('citizenshipNumber')(e.target.value)} placeholder="e.g. 27-01-76-12345" />
                </Field>
                <FileInput label="Citizenship Document" accept=".pdf,image/*" fileName={form.citizenshipFileName} onChange={handleFileChange('citizenshipFileName')} />
              </div>
              <div className="space-y-3">
                <Field label="Passport Number">
                  <input className={inputCls} value={form.passportNumber} onChange={e => set('passportNumber')(e.target.value)} placeholder="e.g. PA1234567" />
                </Field>
                <FileInput label="Passport Document" accept=".pdf,image/*" fileName={form.passportFileName} onChange={handleFileChange('passportFileName')} />
              </div>
              <div className="space-y-3">
                <Field label="PAN Number">
                  <input className={inputCls} value={form.panNumber} onChange={e => set('panNumber')(e.target.value)} placeholder="e.g. 102938475" />
                </Field>
                <FileInput label="PAN Document" accept=".pdf,image/*" fileName={form.panFileName} onChange={handleFileChange('panFileName')} />
              </div>
            </div>
          </CollapsibleSection>

          {/* 4. Employment Details */}
          <CollapsibleSection title="Employment & Organization Designation" icon={Briefcase} defaultOpen={true}>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field
                  label="Staff Employee Code"
                  hint="Unique code (e.g. STF-001)"
                  action={
                    <button
                      type="button"
                      onClick={handleRegenerateStaffCode}
                      className="text-[10px] text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-0.5"
                      title="Auto-generate new employee code"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-emerald-600" /> Auto
                    </button>
                  }
                >
                  <input className={`${inputCls} font-mono font-bold`} value={form.employeeCode} onChange={e => set('employeeCode')(e.target.value.toUpperCase())} placeholder="e.g. STF-001" />
                </Field>
                <Field label="Post / Designation">
                  <select className={inputCls} value={form.designationId} onChange={e => set('designationId')(e.target.value)} disabled={!form.departmentId}>
                    <option value="">-- Select Designation --</option>
                    {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
                <Field label="Staff Category">
                  <select className={inputCls} value={form.category} onChange={e => set('category')(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Department">
                  <select className={inputCls} value={form.departmentId} onChange={e => { set('departmentId')(e.target.value); set('designationId')(''); }}>
                    <option value="">-- Select Department --</option>
                    {(ref.departments ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
                <Field label="Employment Contract Type">
                  <select className={inputCls} value={form.employmentType} onChange={e => set('employmentType')(e.target.value)}>
                    {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Joining Date (AD)">
                  <input type="date" className={inputCls} value={form.joiningDate} onChange={e => set('joiningDate')(e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Operating Status *" required>
                  <select className={inputCls} value={form.status} onChange={e => set('status')(e.target.value)}>
                    {STAFF_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Primary Assigned Branch">
                  <select className={inputCls} value={form.branchId} onChange={e => set('branchId')(e.target.value)}>
                    <option value="">-- Select Branch --</option>
                    {(ref.branches ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </Field>
                <Field label="Financial Staff Authority">
                  <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <input type="checkbox" checked={form.isFinancialStaff} onChange={e => set('isFinancialStaff')(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-700 accent-emerald-600" />
                    <span className="text-slate-700 font-medium">Yes, financial / teller staff</span>
                  </label>
                </Field>
              </div>
              <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <Field label="Past Experience & Working Profile">
                  <textarea className={`${inputCls} resize-none h-24`} value={form.experience} onChange={e => set('experience')(e.target.value)} placeholder="e.g. 5 years as Senior Accountant at Cooperative. Handled ledger, auditing, and member reconciliations." />
                </Field>
                <div>
                  <FileInput label="Working Certificates & Documents" accept=".pdf,.doc,.docx,image/*" hint="Upload experience letter or CV" fileName={form.experienceFileName} onChange={handleFileChange('experienceFileName')} />
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* 5. Salary & Payroll */}
          <CollapsibleSection title="Salary & Payroll (Monthly)" icon={Wallet} defaultOpen={false}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <Field label="Basic Salary (NPR)" hint="Monthly base pay">
                <input type="number" min="0" step="0.01" className={inputCls} value={form.basicSalary} onChange={e => set('basicSalary')(e.target.value)} placeholder="e.g. 50000" />
              </Field>
              <Field label="Allowances (NPR)" hint="Monthly fixed allowances">
                <input type="number" min="0" step="0.01" className={inputCls} value={form.allowances} onChange={e => set('allowances')(e.target.value)} placeholder="e.g. 10000" />
              </Field>
              <Field label="PF Contribution (%)" hint="Provident Fund deduction percent">
                <input type="number" min="0" max="100" step="0.01" className={inputCls} value={form.pfContributionPercent} onChange={e => set('pfContributionPercent')(e.target.value)} placeholder="e.g. 10" />
              </Field>
            </div>
          </CollapsibleSection>

          {/* 6. User Account */}
          <CollapsibleSection title="ERP User Account & Security" icon={ShieldCheck} defaultOpen={form.enableErpLogin} extraClasses={form.enableErpLogin ? 'border-emerald-300 bg-emerald-50/40' : ''}>
            <div className="pt-2">
              <p className="text-[11px] text-slate-500 mb-3 -mt-2">
                Enable login access for this staff member to use Sahakari Sathi ERP.
              </p>
              <div className="flex items-center gap-6 mb-4">
                {['No', 'Yes'].map(opt => {
                  const val = opt === 'Yes';
                  return (
                    <label key={opt} className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition ${form.enableErpLogin === val ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300 bg-white hover:border-slate-400'}`}>
                      <input type="radio" checked={form.enableErpLogin === val} onChange={() => set('enableErpLogin')(val)} className="accent-emerald-700" />
                      <span className={`font-bold text-xs ${form.enableErpLogin === val ? 'text-emerald-800' : 'text-slate-700'}`}>Enable ERP Login: {opt}</span>
                    </label>
                  );
                })}
              </div>

              {form.enableErpLogin && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Field label="Username *" required hint="Lowercase letters, numbers, dot, underscore">
                      <input className={`${inputCls} font-mono font-bold`} value={form.username} onChange={e => set('username')(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} placeholder="e.g. sita.sharma" />
                    </Field>
                    <Field label="Login Notification Email" required hint="Welcome email with credentials is sent here">
                      <input type="email" className={inputCls} value={form.systemEmail} onChange={e => set('systemEmail')(e.target.value)} placeholder="e.g. sita.sharma@sahakari.org.np" />
                    </Field>
                    <Field label="Assigned Role" required>
                      <select className={inputCls} value={form.roleId} onChange={e => set('roleId')(e.target.value)}>
                        <option value="">-- Select Role --</option>
                        {(ref.roles ?? []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Data Visibility Scope">
                      <select className={inputCls} value={form.dataScope} onChange={e => set('dataScope')(e.target.value)}>
                        {DATA_SCOPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3">
                    <KeyNote />
                    <span className="text-[11px]">
                      A temporary password is auto-generated on save. The staff user will be prompted to change it upon first login.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 shrink-0">
          <button onClick={closeStaffForm} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Save Changes' : 'Create Staff'}
          </button>
        </div>
      </div>
    </div>
  );
};

const KeyNote: React.FC = () => (
  <span className="w-4 h-4 shrink-0 inline-flex items-center justify-center rounded-full bg-amber-200 text-amber-900 text-[10px] font-black">!</span>
);

export default StaffFormModal;
