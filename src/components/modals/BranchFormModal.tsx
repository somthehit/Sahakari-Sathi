import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Save, Eye, Building2, MapPin, Phone, Mail, User, Clock, Wallet, Globe, Image as ImageIcon, StickyNote, CheckCircle2, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { useCoop } from '../../context/CoopContext';
import { fetchGeoTree, GeoProvince } from '../../api/geo';
import type { Branch } from '../../types/coop';

const inputCls = 'w-full bg-slate-50 border placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition rounded-xl px-3 py-2 text-xs text-slate-800';
const labelCls = 'block text-slate-700 text-[11px] font-semibold mb-1.5 tracking-wide uppercase';
const sectionCls = 'border border-slate-200 bg-slate-50/40 rounded-xl p-4 space-y-4';
const sectionHeadCls = 'flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider';

const BRANCH_TYPES = ['Branch', 'Sub-Branch', 'Collection Center', 'Extension Office', 'Head Office'];
const STATUSES = ['Active', 'Inactive', 'Closed', 'Suspended'];
const WORKING_DAYS_OPTIONS = ['Sunday - Friday', 'Monday - Saturday', 'Sunday - Thursday', 'Everyday', 'Custom'];

const toStr = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

function generateNextBranchCode(existingBranches: Branch[] = []): string {
  let maxNum = 0;
  for (const b of existingBranches) {
    const match = (b.code || '').match(/BR-?(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  return `BR-${String(maxNum + 1).padStart(3, '0')}`;
}

const Field = ({ label, children, required, hint, action }: { label: string; children: React.ReactNode; required?: boolean; hint?: string; action?: React.ReactNode }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label className={labelCls}>{label} {required && <span className="text-emerald-600">*</span>}</label>
      {action}
    </div>
    {children}
    {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
  </div>
);

export const BranchFormModal: React.FC = () => {
  const { branchFormOpen, branchFormMode, branchFormTarget, closeBranchForm, saveBranch, addNotification, branches } = useCoop();
  const isView = branchFormMode === 'view';
  const isEdit = branchFormMode === 'edit';

  const [form, setForm] = useState<Omit<Branch, 'id'>>({
    code: '', name: '', branchType: 'Branch', isHeadOffice: false,
    address: '', province: '', district: '', municipality: '', ward: '', tole: '',
    phone: '', email: '', managerName: '', openingDateBs: '',
    status: 'Active', latitude: undefined, longitude: undefined, googleMapLink: '',
    logoUrl: '', workingDays: 'Sunday - Friday', openingTime: '10:00', closingTime: '17:00',
    vaultLimit: 10000000, currentVaultCash: 0, remarks: '',
  });
  const [geoTree, setGeoTree] = useState<GeoProvince[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!branchFormOpen) return;
    const base: Branch | null = branchFormTarget;
    const initialCode = base?.code ? toStr(base.code) : generateNextBranchCode(branches);

    setForm({
      code: initialCode, name: toStr(base?.name), branchType: toStr(base?.branchType) || 'Branch',
      isHeadOffice: base?.isHeadOffice ?? false, address: toStr(base?.address),
      province: toStr(base?.province), district: toStr(base?.district), municipality: toStr(base?.municipality),
      ward: toStr(base?.ward), tole: toStr(base?.tole), phone: toStr(base?.phone), email: toStr(base?.email),
      managerName: toStr(base?.managerName), openingDateBs: toStr(base?.openingDateBs),
      status: toStr(base?.status) || 'Active', latitude: base?.latitude, longitude: base?.longitude,
      googleMapLink: toStr(base?.googleMapLink), logoUrl: toStr(base?.logoUrl),
      workingDays: toStr(base?.workingDays) || 'Sunday - Friday',
      openingTime: toStr(base?.openingTime) || '10:00', closingTime: toStr(base?.closingTime) || '17:00',
      vaultLimit: base?.vaultLimit ?? 10000000, currentVaultCash: base?.currentVaultCash ?? 0,
      remarks: toStr(base?.remarks),
    });
    setError(null);
    fetchGeoTree().then(setGeoTree).catch(() => setGeoTree([]));
  }, [branchFormOpen, branchFormTarget, branches]);

  const provinces = useMemo(() => geoTree, [geoTree]);
  const districts = useMemo(() => {
    const p = provinces.find(p => p.name === form.province);
    return p ? p.districts : [];
  }, [provinces, form.province]);
  const municipalities = useMemo(() => {
    const p = provinces.find(p => p.name === form.province);
    const d = p?.districts.find(d => d.name === form.district);
    return d ? d.municipalities : [];
  }, [provinces, form.province, form.district]);
  const wards = useMemo(() => {
    const p = provinces.find(p => p.name === form.province);
    const d = p?.districts.find(d => d.name === form.district);
    const m = d?.municipalities.find(m => m.name === form.municipality);
    return m ? m.wards : [];
  }, [provinces, form.province, form.district, form.municipality]);

  const set = (key: keyof Omit<Branch, 'id'>) => (value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleNameChange = (nameVal: string) => {
    setForm(prev => {
      const updated = { ...prev, name: nameVal };
      // Auto suggest code if still default format and not in edit mode
      if (!isEdit && !isView && (!prev.code || prev.code.startsWith('BR-'))) {
        // keep generated or append
      }
      return updated;
    });
  };

  const handleRegenerateCode = () => {
    set('code')(generateNextBranchCode(branches));
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Branch name is required.';
    if (!form.code.trim()) return 'Branch code is required.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email address.';
    if (form.phone && !/^[+0-9\s-]{7,20}$/.test(form.phone)) return 'Please enter a valid phone number.';
    return null;
  };

  const handleSubmit = async () => {
    if (isView) { closeBranchForm(); return; }
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: Omit<Branch, 'id'> = {
        ...form,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        vaultLimit: Number(form.vaultLimit) || 0,
        currentVaultCash: Number(form.currentVaultCash) || 0,
        latitude: form.latitude !== undefined && form.latitude !== null ? Number(form.latitude) : undefined,
        longitude: form.longitude !== undefined && form.longitude !== null ? Number(form.longitude) : undefined,
        email: form.email?.trim() ? form.email.trim() : undefined,
        phone: form.phone?.trim() || '',
        isHeadOffice: form.branchType === 'Head Office' || form.isHeadOffice,
      };
      const saved = await saveBranch(payload);
      closeBranchForm();
      addNotification('Branch Saved', isEdit ? `Branch "${saved.name}" updated successfully.` : `Branch "${saved.name}" created successfully.`, 'success');
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Could not save branch. Please try again.');
      addNotification('Branch Save Failed', e?.response?.data?.error || e?.message || 'Could not save branch.', 'alert');
    } finally {
      setSaving(false);
    }
  };

  if (!branchFormOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200" onClick={() => !saving && closeBranchForm()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                {isView ? 'View Branch' : isEdit ? 'Edit Branch' : 'Register New Branch'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {isView ? 'Branch details (read-only)' : isEdit ? `Editing ${branchFormTarget?.name || ''}` : 'Configure and register a new branch or service center'}
              </p>
            </div>
          </div>
          <button onClick={() => !saving && closeBranchForm()} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition cursor-pointer">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-xs">
          {error && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Identification */}
          <div className={sectionCls}>
            <div className={sectionHeadCls}><Building2 className="w-4 h-4 text-emerald-600" /> Branch Identification</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Branch Name" required>
                <input className={inputCls} value={form.name} onChange={e => handleNameChange(e.target.value)} disabled={isView} placeholder="e.g. Kathmandu Main Branch" />
              </Field>
              <Field
                label="Branch Code"
                required
                action={
                  !isView && (
                    <button
                      type="button"
                      onClick={handleRegenerateCode}
                      className="text-[10px] text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-0.5"
                      title="Auto-generate next sequential branch code"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-emerald-600" /> Auto
                    </button>
                  )
                }
              >
                <input className={`${inputCls} font-mono font-bold`} value={form.code} onChange={e => set('code')(e.target.value.toUpperCase())} disabled={isView} placeholder="e.g. BR-001" />
              </Field>
              <Field label="Branch Type">
                <select className={inputCls} value={form.branchType} onChange={e => set('branchType')(e.target.value)} disabled={isView}>
                  {BRANCH_TYPES.map(t => <option key={t} value={t} className="bg-white">{t}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="isHeadOffice" checked={form.isHeadOffice} onChange={e => set('isHeadOffice')(e.target.checked)} disabled={isView} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600" />
              <label htmlFor="isHeadOffice" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">Mark as Main / Central Head Office</label>
            </div>
          </div>

          {/* Address */}
          <div className={sectionCls}>
            <div className={sectionHeadCls}><MapPin className="w-4 h-4 text-emerald-600" /> Address & Location</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Field label="Full Street Address">
                  <input className={inputCls} value={form.address} onChange={e => set('address')(e.target.value)} disabled={isView} placeholder="e.g. Putalisadak Chowk, Kathmandu" />
                </Field>
              </div>
              <Field label="Province">
                <select className={inputCls} value={form.province} onChange={e => { set('province')(e.target.value); set('district')(''); set('municipality')(''); set('ward')(''); }} disabled={isView}>
                  <option value="">— Select Province —</option>
                  {provinces.map(p => <option key={p.name} value={p.name} className="bg-white">{p.name}</option>)}
                </select>
              </Field>
              <Field label="District">
                <select className={inputCls} value={form.district} onChange={e => { set('district')(e.target.value); set('municipality')(''); set('ward')(''); }} disabled={isView || !form.province}>
                  <option value="">— Select District —</option>
                  {districts.map(d => <option key={d.name} value={d.name} className="bg-white">{d.name}</option>)}
                </select>
              </Field>
              <Field label="Municipality / Rural Municipality">
                <select className={inputCls} value={form.municipality} onChange={e => { set('municipality')(e.target.value); set('ward')(''); }} disabled={isView || !form.district}>
                  <option value="">— Select Municipality —</option>
                  {municipalities.map(m => <option key={m.name} value={m.name} className="bg-white">{m.name}</option>)}
                </select>
              </Field>
              <Field label="Ward No.">
                <select className={inputCls} value={form.ward} onChange={e => set('ward')(e.target.value)} disabled={isView || !form.municipality}>
                  <option value="">— Select Ward —</option>
                  {wards.map(w => <option key={w} value={w} className="bg-white">Ward {w}</option>)}
                </select>
              </Field>
              <Field label="Tole / Settlement Area">
                <input className={inputCls} value={form.tole} onChange={e => set('tole')(e.target.value)} disabled={isView} placeholder="e.g. Putalisadak / Bagbazar" />
              </Field>
            </div>
          </div>

          {/* Contact & Management */}
          <div className={sectionCls}>
            <div className={sectionHeadCls}><Phone className="w-4 h-4 text-emerald-600" /> Contact & Branch In-Charge</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Contact Phone" hint="e.g. +977-1-5550123 / 9841234567">
                <input className={inputCls} value={form.phone} onChange={e => set('phone')(e.target.value)} disabled={isView} placeholder="e.g. +977-1-5550123" />
              </Field>
              <Field label="Official Email">
                <input className={inputCls} value={form.email} onChange={e => set('email')(e.target.value)} disabled={isView} placeholder="e.g. branch.ktm@sahakari.org.np" />
              </Field>
              <Field label="Branch Manager Name">
                <input className={inputCls} value={form.managerName} onChange={e => set('managerName')(e.target.value)} disabled={isView} placeholder="e.g. Rajesh Kumar Sharma" />
              </Field>
              <Field label="Establishment / Opening Date (BS)">
                <input className={inputCls} value={form.openingDateBs} onChange={e => set('openingDateBs')(e.target.value)} disabled={isView} placeholder="e.g. 2080-04-01" />
              </Field>
              <Field label="Operating Status">
                <select className={inputCls} value={form.status} onChange={e => set('status')(e.target.value)} disabled={isView}>
                  {STATUSES.map(s => <option key={s} value={s} className="bg-white">{s}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Working Hours & Operations */}
          <div className={sectionCls}>
            <div className={sectionHeadCls}><Clock className="w-4 h-4 text-emerald-600" /> Working Hours & Schedule</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Working Days">
                <select className={inputCls} value={form.workingDays} onChange={e => set('workingDays')(e.target.value)} disabled={isView}>
                  {WORKING_DAYS_OPTIONS.map(d => <option key={d} value={d} className="bg-white">{d}</option>)}
                </select>
              </Field>
              <Field label="Opening Time">
                <input type="time" className={inputCls} value={form.openingTime} onChange={e => set('openingTime')(e.target.value)} disabled={isView} />
              </Field>
              <Field label="Closing Time">
                <input type="time" className={inputCls} value={form.closingTime} onChange={e => set('closingTime')(e.target.value)} disabled={isView} />
              </Field>
            </div>
          </div>

          {/* Vault Limits */}
          <div className={sectionCls}>
            <div className={sectionHeadCls}><Wallet className="w-4 h-4 text-emerald-600" /> Vault & Cash Limit</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Vault Holding Limit (NPR)" hint="Maximum allowed vault holding">
                <input type="number" className={inputCls} value={form.vaultLimit} onChange={e => set('vaultLimit')(Number(e.target.value))} disabled={isView} placeholder="e.g. 10000000" />
              </Field>
              <Field label="Current Vault Cash (NPR)" hint="Opening cash in vault">
                <input type="number" className={inputCls} value={form.currentVaultCash} onChange={e => set('currentVaultCash')(Number(e.target.value))} disabled={isView} placeholder="e.g. 500000" />
              </Field>
            </div>
          </div>

          {/* Geo / Map */}
          <div className={sectionCls}>
            <div className={sectionHeadCls}><Globe className="w-4 h-4 text-emerald-600" /> Map Coordinates & Branding</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Latitude">
                <input className={inputCls} value={form.latitude ?? ''} onChange={e => set('latitude')(e.target.value === '' ? undefined : Number(e.target.value))} disabled={isView} placeholder="e.g. 27.7172" />
              </Field>
              <Field label="Longitude">
                <input className={inputCls} value={form.longitude ?? ''} onChange={e => set('longitude')(e.target.value === '' ? undefined : Number(e.target.value))} disabled={isView} placeholder="e.g. 85.3240" />
              </Field>
              <Field label="Google Maps Link">
                <input className={inputCls} value={form.googleMapLink} onChange={e => set('googleMapLink')(e.target.value)} disabled={isView} placeholder="https://maps.google.com/..." />
              </Field>
            </div>
          </div>

          {/* Remarks */}
          <div className={sectionCls}>
            <div className={sectionHeadCls}><StickyNote className="w-4 h-4 text-emerald-600" /> Internal Notes & Remarks</div>
            <Field label="Remarks">
              <textarea className={`${inputCls} resize-none`} rows={2} value={form.remarks} onChange={e => set('remarks')(e.target.value)} disabled={isView} placeholder="Optional operational notes about this branch location..." />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 shrink-0 bg-slate-50/60 rounded-b-2xl">
          <button onClick={closeBranchForm} disabled={saving} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition cursor-pointer disabled:opacity-50">
            {isView ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isView ? <Eye className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : isView ? 'OK' : isEdit ? 'Update Branch' : 'Create Branch'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BranchFormModal;
