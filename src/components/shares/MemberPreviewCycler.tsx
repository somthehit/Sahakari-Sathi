import React, { useState, useMemo } from 'react';
import { 
  Users, 
  ChevronLeft, 
  ChevronRight, 
  Shuffle, 
  Eye, 
  Tag, 
  Building2, 
  Award, 
  User, 
  CheckCircle2, 
  HelpCircle,
  Sparkles,
  ArrowRight,
  BadgeCheck,
  Search,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { Member } from '../../types/coop';
import { CertificateConfig } from './ShareCertificateCanvas';
import { resolveCertificateTags, AVAILABLE_CERTIFICATE_TAGS } from '../../utils/certificateTagEngine';

interface MemberPreviewCyclerProps {
  members: Member[];
  selectedMemberId: string;
  onSelectMember: (member: Member) => void;
  certConfig: CertificateConfig;
  className?: string;
}

export const MemberPreviewCycler: React.FC<MemberPreviewCyclerProps> = ({
  members,
  selectedMemberId,
  onSelectMember,
  certConfig,
  className = '',
}) => {
  const [showTagInspector, setShowTagInspector] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('all');

  // Use real members from the store only; no mock fallback samples.
  const allPreviewMembers = useMemo(() => {
    return members || [];
  }, [members]);

  // Filter members by selected type
  const filteredPreviewList = useMemo(() => {
    if (filterType === 'all') return allPreviewMembers;
    return allPreviewMembers.filter(m => m.membershipType === filterType);
  }, [allPreviewMembers, filterType]);

  // Active member object
  const activeMemberIndex = useMemo(() => {
    const idx = filteredPreviewList.findIndex(m => m.id === selectedMemberId);
    return idx >= 0 ? idx : 0;
  }, [filteredPreviewList, selectedMemberId]);

  const activeMember = filteredPreviewList[activeMemberIndex] || filteredPreviewList[0] || null;

  // Handlers for cycling
  const handlePrevMember = () => {
    const newIdx = (activeMemberIndex - 1 + filteredPreviewList.length) % filteredPreviewList.length;
    const target = filteredPreviewList[newIdx];
    if (target) onSelectMember(target);
  };

  const handleNextMember = () => {
    const newIdx = (activeMemberIndex + 1) % filteredPreviewList.length;
    const target = filteredPreviewList[newIdx];
    if (target) onSelectMember(target);
  };

  const handleRandomMember = () => {
    if (filteredPreviewList.length <= 1) return;
    let randIdx = Math.floor(Math.random() * filteredPreviewList.length);
    if (randIdx === activeMemberIndex) {
      randIdx = (randIdx + 1) % filteredPreviewList.length;
    }
    const target = filteredPreviewList[randIdx];
    if (target) onSelectMember(target);
  };

  // Resolved Tag Context mapping for inspector
  const tagContext = useMemo(() => {
    const totalShares = activeMember?.totalShares || 50;
    const faceValue = certConfig.faceValuePerShare || 100;
    const totalAmount = activeMember?.shareAmount || totalShares * faceValue;
    const kittaPrefix = certConfig.kittaPrefix || '1001';
    const kittaStart = parseInt(kittaPrefix) || 1001;
    const kittaEnd = kittaStart + totalShares - 1;

    return {
      member_name: activeMember?.fullName || 'N/A',
      member_name_np: activeMember?.nameNepali || activeMember?.fullName || 'N/A',
      member_no: activeMember?.memberNo || 'N/A',
      citizenship_no: activeMember?.citizenshipNo || 'N/A',
      address: activeMember?.address || 'N/A',
      district: activeMember?.district || 'N/A',
      phone: activeMember?.phone || 'N/A',
      gender: activeMember?.gender || 'N/A',
      share_count: totalShares.toLocaleString('ne-NP'),
      share_count_en: totalShares.toString(),
      total_amount: `रु. ${totalAmount.toLocaleString('ne-NP')}`,
      total_amount_words: `अक्षरेपी रु. ${totalAmount.toLocaleString('ne-NP')} मात्र`,
      kitta_range: `${kittaStart} देखि ${kittaEnd} सम्म`,
      issued_date_bs: activeMember?.membershipDateBS || '2083-04-15',
      membership_type: activeMember?.membershipType || 'General',
      coop_name_np: certConfig.coopNameNp || 'सहकारी संस्था लिमिटेड',
      coop_name_en: certConfig.coopNameEn || 'Cooperative Society Ltd.',
    };
  }, [activeMember, certConfig]);

  return (
    <div className={`bg-white border border-slate-200 rounded-2xl shadow-xs p-3.5 space-y-3 ${className}`}>
      
      {/* Top Controls Bar: Cycling & Member Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 /80 p-2.5 rounded-xl border border-slate-200/80">
        
        {/* Left: Active Member Badges & Dropdown */}
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="p-1.5 bg-amber-500 text-slate-950 rounded-lg shadow-2xs shrink-0">
            <Users className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-xs truncate">
                {activeMember?.nameNepali || activeMember?.fullName}
              </span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${ activeMember?.membershipType === 'Founder' ? 'bg-amber-100 text-amber-900 /60 ' : activeMember?.membershipType === 'Institutional' ? 'bg-blue-100 text-blue-900 /60 ' : 'bg-emerald-100 text-emerald-900 /60 ' }`}>
                {activeMember?.membershipType}
              </span>
            </div>

            <div className="text-[10px] text-slate-500 flex items-center gap-2 pt-0.5 truncate">
              <span>ID: <strong className="text-slate-700 font-mono">{activeMember?.memberNo}</strong></span>
              <span>•</span>
              <span>Shares: <strong className="text-amber-700 font-bold">{activeMember?.totalShares} ({activeMember?.shareAmount?.toLocaleString()} NPR)</strong></span>
            </div>
          </div>
        </div>

        {/* Right: Cycler Navigation Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          
          {/* Member Dropdown Selector */}
          <select
            value={activeMember?.id}
            onChange={(e) => {
              const selected = allPreviewMembers.find(m => m.id === e.target.value);
              if (selected) onSelectMember(selected);
            }}
            className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 max-w-[160px] truncate"
          >
            {filteredPreviewList.map(m => (
              <option key={m.id} value={m.id}>
                {m.fullName} ({m.totalShares} sh)
              </option>
            ))}
          </select>

          {/* Prev Button */}
          <button
            type="button"
            onClick={handlePrevMember}
            title="Previous Member"
            className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Counter Badge */}
          <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-2 py-1 rounded-xl border border-slate-200">
            {activeMemberIndex + 1}/{filteredPreviewList.length}
          </span>

          {/* Next Button */}
          <button
            type="button"
            onClick={handleNextMember}
            title="Next Member"
            className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Shuffle / Random Button */}
          <button
            type="button"
            onClick={handleRandomMember}
            title="Random Member"
            className="p-1.5 bg-amber-50 /60 border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-xl transition cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
          </button>

        </div>

      </div>

      {/* Quick Edge-Case Profiles Ribbon */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[10px]">
        <span className="text-slate-500 font-bold shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" /> Test Scenarios:
        </span>

        {allPreviewMembers.slice(0, 5).map(m => {
          const isSelected = m.id === activeMember?.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectMember(m)}
              className={`px-2 py-0.5 rounded-lg font-medium transition shrink-0 flex items-center gap-1 border cursor-pointer ${ isSelected ? 'bg-amber-600 text-white border-amber-700 shadow-2xs font-bold' : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-amber-400' }`}
            >
              {m.membershipType === 'Institutional' ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
              <span>{m.fullName.split(' ')[0]} ({m.totalShares} sh)</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setShowTagInspector(!showTagInspector)}
          className="ml-auto px-2 py-0.5 bg-slate-200 text-slate-700 hover:text-amber-600 rounded-lg font-bold flex items-center gap-1 shrink-0 transition"
        >
          <Tag className="w-3 h-3 text-amber-600" />
          <span>{showTagInspector ? 'Hide Tags' : 'Inspect Tags'}</span>
        </button>
      </div>

      {/* Resolved Tag Values Inspector Drawer */}
      {showTagInspector && (
        <div className="bg-slate-50 /60 p-3 rounded-xl border border-slate-200/80 /80 text-xs space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
              <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Live Dynamic Tag Substitution Values ({activeMember?.fullName})</span>
            </span>
            <span className="text-[10px] text-slate-500">
              Values automatically injected into certificate templates
            </span>
          </div>

          {/* Grid of Key-Value Tags */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
            <div className="bg-white p-1.5 rounded-lg border border-slate-200">
              <span className="text-amber-800 font-mono font-bold block">{`{member_name}`}</span>
              <span className="text-slate-800 font-semibold truncate block">{tagContext.member_name_np}</span>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-slate-200">
              <span className="text-amber-800 font-mono font-bold block">{`{member_no}`}</span>
              <span className="text-slate-800 font-semibold truncate block">{tagContext.member_no}</span>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-slate-200">
              <span className="text-amber-800 font-mono font-bold block">{`{share_count}`}</span>
              <span className="text-slate-800 font-semibold truncate block">{tagContext.share_count} कित्ता</span>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-slate-200">
              <span className="text-amber-800 font-mono font-bold block">{`{total_amount}`}</span>
              <span className="text-slate-800 font-semibold truncate block">{tagContext.total_amount}</span>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-slate-200">
              <span className="text-amber-800 font-mono font-bold block">{`{kitta_range}`}</span>
              <span className="text-slate-800 font-semibold truncate block">{tagContext.kitta_range}</span>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-slate-200">
              <span className="text-amber-800 font-mono font-bold block">{`{father_name}`}</span>
              <span className="text-slate-800 font-semibold truncate block">{activeMember?.fatherName || '---'}</span>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-slate-200">
              <span className="text-amber-800 font-mono font-bold block">{`{grandfather_name}`}</span>
              <span className="text-slate-800 font-semibold truncate block">{activeMember?.grandfatherName || '---'}</span>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-slate-200">
              <span className="text-amber-800 font-mono font-bold block">{`{nominee_name}`}</span>
              <span className="text-slate-800 font-semibold truncate block">{activeMember?.nomineeName || '---'}</span>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-slate-200">
              <span className="text-amber-800 font-mono font-bold block">{`{citizenship_no}`}</span>
              <span className="text-slate-800 font-semibold truncate block">{tagContext.citizenship_no}</span>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-slate-200">
              <span className="text-amber-800 font-mono font-bold block">{`{address}`}</span>
              <span className="text-slate-800 font-semibold truncate block">{tagContext.address}</span>
            </div>

            <div className="bg-white p-1.5 rounded-lg border border-slate-200">
              <span className="text-amber-800 font-mono font-bold block">{`{issued_date_bs}`}</span>
              <span className="text-slate-800 font-semibold truncate block">{tagContext.issued_date_bs}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
