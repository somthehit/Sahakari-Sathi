import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, Save, CheckCircle2, Hash } from 'lucide-react';
import { Member } from '../../../types/coop';
import { useCoop } from '../../../context/CoopContext';
import { useLocalization } from '../../../context/LocalizationContext';
import { useToast } from '../../../context/ToastContext';
import { TransliteratedNameInput } from '../../common/TransliteratedNameInput';
import { fetchMemberSettings, MemberSetting, MemberSettingsEntityType } from '../../../api/memberSettings';
import { fetchGroups, Group } from '../../../api/groups';

interface MemberKYCFormProps {
  onAddMember: (memberData: Omit<Member, 'id' | 'memberNo' | 'totalSavingsBalance' | 'totalLoanBalance' | 'shareAmount' | 'totalShares'>) => Promise<Member>;
  onSuccess: () => void;
}

const KYC_STATUSES = ['Not_Started', 'Pending', 'Under_Review', 'Verified', 'Expired', 'Rejected', 'Resubmission_Required'];
const MEMBER_STATUSES = ['Draft', 'Pending_KYC', 'Pending_Approval', 'Active', 'Dormant', 'Blacklisted', 'Suspended', 'Closed', 'Deceased', 'Transferred', 'Merged', 'Inactive', 'Terminated'];

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white";
const labelCls = "block font-semibold text-slate-700 mb-1";

export const MemberKYCForm: React.FC<MemberKYCFormProps> = ({ onAddMember, onSuccess }) => {
  const { branches = [] } = useCoop();
  const { t, transliterateName, settings } = useLocalization();
  const toast = useToast();
  const defaultBranchId = branches[0]?.id || '';

  const [formData, setFormData] = useState({
    fullName: '',
    nameNepali: '',
    memberNo: '',
    citizenshipNo: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    dobBS: '2040-01-01',
    dobAD: '',
    phone: '',
    secondaryPhone: '',
    email: '',
    address: 'Kathmandu, Bagmati Province',
    district: 'Kathmandu',
    branchId: defaultBranchId,
    membershipType: 'General' as Member['membershipType'],
    memberCategory: 'Regular' as Member['memberCategory'],
    groupId: '',
    kycStatus: 'Pending' as Member['kycStatus'],
    status: 'Active' as Member['status'],
    membershipDateBS: '2083-04-15',
    isMinor: false,
    memberTags: '',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  });

  const [submitted, setSubmitted] = useState(false);

  const [catalogState, setCatalogState] = useState<Record<string, MemberSetting[]>>({});
  const [groupCatalog, setGroupCatalog] = useState<Group[]>([]);

  const loadCatalogs = useCallback(async () => {
    const entityTypes: MemberSettingsEntityType[] = ['member-types', 'member-categories'];
    const [memberTypes, memberCategories, groups] = await Promise.all([
      fetchMemberSettings('member-types', { active: 'true' }),
      fetchMemberSettings('member-categories', { active: 'true' }),
      fetchGroups({ active: 'true' }),
    ]);
    setCatalogState({ 'member-types': memberTypes, 'member-categories': memberCategories });
    setGroupCatalog(groups);
  }, []);

  useEffect(() => {
    loadCatalogs();
  }, [loadCatalogs]);

  // Snap untouched defaults to the live catalog so the backend never receives
  // a label that is not configured for this org (rejects unknown with 400).
  useEffect(() => {
    if (!catalogState['member-types']?.length) return;
    setFormData(prev => {
      const pick = (rows: MemberSetting[], current: string, prefer: string): string => {
        if (current && rows.some(r => r.name === current)) return current;
        return rows.find(r => r.name === prefer)?.name ?? rows[0]?.name ?? current;
      };
      return {
        ...prev,
        membershipType: pick(catalogState['member-types'] || [], prev.membershipType, 'General'),
        memberCategory: pick(catalogState['member-categories'] || [], prev.memberCategory, 'Regular'),
      };
    });
  }, [catalogState]);

  const selectedMemberType = catalogState['member-types']?.find((mt) => mt.name === formData.membershipType);
  const isGroupType = selectedMemberType?.isGroupType === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.citizenshipNo || !formData.phone) {
      toast.showError(t('Please fill required fields (Full Name, Citizenship No, Phone).'), t('Registration Incomplete'));
      return;
    }

    if (formData.citizenshipNo.trim().length < 5) {
      toast.showError(t('Citizenship Number must be at least 5 characters.'), t('Invalid Citizenship No'));
      return;
    }

    if (formData.phone.trim().length < 10) {
      toast.showError(t('Phone number must be at least 10 digits.'), t('Invalid Phone Number'));
      return;
    }

    if (isGroupType && !formData.groupId) {
      toast.showError(t('Please select a community group for this member type.'), t('Group Required'));
      return;
    }

    // Auto-transliterate the Nepali name when the org has enabled it and the
    // user hasn't typed a Nepali name manually.
    const nameNepali = formData.nameNepali.trim()
      ? formData.nameNepali.trim()
      : (settings.enableAutoTransliteration ? transliterateName(formData.fullName) : '');

    const { memberNo, memberTags, ...rest } = formData;
    try {
      await onAddMember({
        ...rest,
        nameNepali,
        ...(memberNo.trim() ? { memberNo: memberNo.trim() } : {}),
        ...(memberTags.trim() ? { memberTags: memberTags.split(',').map((t) => t.trim()).filter(Boolean) } : {}),
        ...(formData.groupId ? { groupId: formData.groupId } : {}),
      });
    } catch (error: any) {
      toast.showError(error?.response?.data?.error || t('Failed to register member. Please try again.'), t('Registration Failed'));
      return;
    }
    toast.showSuccess(t('Member registered successfully! Redirecting to directory...'), t('Member Saved'));
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onSuccess();
    }, 1200);
  };

  const set = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value as (typeof formData)[K] }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-4xl mx-auto">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200 mb-6">
        <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-lg">
          <UserPlus className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 text-base">{t('New Member Registration & KYC Wizard')}</h3>
          <p className="text-xs text-slate-500">{t('Register new SACCOS member and initiate regulatory KYC verification')}</p>
        </div>
      </div>

      {submitted && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          {t('Member registered successfully! Redirecting to directory...')}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <TransliteratedNameInput
              englishLabel={t('Full Name (English)')}
              englishValue={formData.fullName}
              nepaliValue={formData.nameNepali}
              onEnglishChange={(v) => set('fullName', v)}
              onNepaliChange={(v) => set('nameNepali', v)}
              englishPlaceholder={t('e.g. Ramesh Kumar Shrestha')}
              nepaliPlaceholder={t('e.g. रमेश कुमार श्रेष्ठ')}
              required
            />
          </div>

          <div>
            <label className={labelCls}>{t('Member No.')}</label>
            <div className="relative">
              <Hash className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={formData.memberNo}
                onChange={(e) => set('memberNo', e.target.value)}
                className={`${inputCls} pl-9`}
                placeholder="Auto-generated if left blank"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>{t('Citizenship No. *')}</label>
            <input
              type="text"
              required
              minLength={5}
              value={formData.citizenshipNo}
              onChange={(e) => set('citizenshipNo', e.target.value)}
              className={inputCls}
              placeholder="e.g. 27-01-78-04192"
            />
          </div>

          <div>
            <label className={labelCls}>{t('Mobile Phone *')}</label>
            <input
              type="text"
              required
              minLength={10}
              value={formData.phone}
              onChange={(e) => set('phone', e.target.value)}
              className={inputCls}
              placeholder="e.g. 9851023456"
            />
          </div>

          <div>
            <label className={labelCls}>{t('Secondary Phone')}</label>
            <input
              type="text"
              value={formData.secondaryPhone}
              onChange={(e) => set('secondaryPhone', e.target.value)}
              className={inputCls}
              placeholder="e.g. 9841023456"
            />
          </div>

          <div>
            <label className={labelCls}>{t('Email')}</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => set('email', e.target.value)}
              className={inputCls}
              placeholder="e.g. ramesh@example.com"
            />
          </div>

          <div>
            <label className={labelCls}>{t('Gender')}</label>
            <select
              value={formData.gender}
              onChange={(e) => set('gender', e.target.value as any)}
              className={inputCls}
            >
              <option value="Male">{t('Male')}</option>
              <option value="Female">{t('Female')}</option>
              <option value="Other">{t('Other')}</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>{t('Date of Birth (B.S.)')}</label>
            <input
              type="text"
              value={formData.dobBS}
              onChange={(e) => set('dobBS', e.target.value)}
              className={inputCls}
              placeholder="e.g. 2040-01-01"
            />
          </div>

          <div>
            <label className={labelCls}>{t('Date of Birth (A.D.)')}</label>
            <input
              type="date"
              value={formData.dobAD}
              onChange={(e) => set('dobAD', e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>{t('Branch')}</label>
            <select
              value={formData.branchId}
              onChange={(e) => set('branchId', e.target.value)}
              className={inputCls}
            >
              {branches.length === 0 && <option value="">{t('Select branch')}</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>{t('District / Address')}</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => set('address', e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>{t('Membership Date (B.S.)')}</label>
            <input
              type="text"
              value={formData.membershipDateBS}
              onChange={(e) => set('membershipDateBS', e.target.value)}
              className={inputCls}
              placeholder="e.g. 2083-04-15"
            />
          </div>

          <div>
            <label className={labelCls}>{t('Membership Type')}</label>
            <select
              value={formData.membershipType}
              onChange={(e) => set('membershipType', e.target.value as any)}
              className={inputCls}
            >
              <option value="">{t('-- Select Member Type --')}</option>
              {(catalogState['member-types'] || []).map((mt) => (
                <option key={mt.id} value={mt.name}>{mt.name}{mt.nameNepali ? ` (${mt.nameNepali})` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>{t('Member Category')}</label>
            <select
              value={formData.memberCategory}
              onChange={(e) => set('memberCategory', e.target.value as any)}
              className={inputCls}
            >
              <option value="">{t('-- Select Member Category --')}</option>
              {(catalogState['member-categories'] || []).map((c) => (
                <option key={c.id} value={c.name}>{c.name}{c.nameNepali ? ` (${c.nameNepali})` : ''}</option>
              ))}
            </select>
          </div>

          {isGroupType && (
            <div>
              <label className={labelCls}>{t('Community Group *')}</label>
              <select
                value={formData.groupId}
                onChange={(e) => set('groupId', e.target.value)}
                className={inputCls}
              >
                <option value="">{t('-- Select Group --')}</option>
                {(groupCatalog || []).map((g) => (
                  <option key={g.id} value={g.id}>{g.name}{g.maxMembers ? ` (Capacity: ${g.maxMembers})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>{t('KYC Status')}</label>
            <select
              value={formData.kycStatus}
              onChange={(e) => set('kycStatus', e.target.value as any)}
              className={inputCls}
            >
              {KYC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>{t('Status')}</label>
            <select
              value={formData.status}
              onChange={(e) => set('status', e.target.value as any)}
              className={inputCls}
            >
              {MEMBER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>{t('Member Tags (comma separated)')}</label>
            <input
              type="text"
              value={formData.memberTags}
              onChange={(e) => set('memberTags', e.target.value)}
              className={inputCls}
              placeholder={t('e.g. VIP, BoardMember')}
            />
          </div>

          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="isMinor"
              checked={formData.isMinor}
              onChange={(e) => set('isMinor', e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
            <label htmlFor="isMinor" className="font-semibold text-slate-700">{t('Minor Member (requires guardian)')}</label>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Save className="w-4 h-4" /> {t('Save & Create Member Record')}
          </button>
        </div>
      </form>
    </div>
  );
};
