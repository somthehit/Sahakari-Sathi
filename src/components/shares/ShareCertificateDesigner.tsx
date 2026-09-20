import React, { useState, useMemo } from 'react';
import {
  Printer,
  Palette,
  Sparkles,
  Search,
  Filter,
  SlidersHorizontal,
  Award,
  CheckSquare,
  Square,
  Layers,
  Eye,
  PlusCircle,
  RefreshCw,
  Building2,
  FileText,
  UserCheck,
  ShieldCheck,
  QrCode,
  Download,
  Share2,
  Image as ImageIcon,
  Upload,
  X,
  FileCheck,
  Save,
  Loader2,
} from 'lucide-react';
import { useCoop } from '../../context/CoopContext';
import { Member } from '../../types/coop';
import { 
  ShareCertificateCanvas, 
  CertificateConfig, 
  CertificateTheme, 
  DEFAULT_CERT_CONFIG 
} from './ShareCertificateCanvas';
import { TagInsertionSystem } from './TagInsertionSystem';
import { CertificateTemplateManager } from './CertificateTemplateManager';
import { SnapToGridControls } from './SnapToGridControls';
import { MemberPreviewCycler } from './MemberPreviewCycler';
import { formatNPR, getTodayBS } from '../../utils/nepaliCalendar';

interface ShareCertificateDesignerProps {
  onSelectMemberForModal?: (member: Member) => void;
  // Embedding + persistence (used by the Share Certificate Format setups page):
  // - initialConfig pre-loads a saved design (merged over DEFAULT_CERT_CONFIG).
  // - onSaveConfig receives the full designed config to persist to the API.
  // - saving disables the Save button while the API call is in flight.
  // - embedded hides the Register/Batch/Issue tabs (setups designer mode).
  initialConfig?: Partial<CertificateConfig>;
  onSaveConfig?: (config: CertificateConfig) => Promise<void> | void;
  saving?: boolean;
  embedded?: boolean;
}

export const ShareCertificateDesigner: React.FC<ShareCertificateDesignerProps> = ({
  onSelectMemberForModal,
  initialConfig,
  onSaveConfig,
  saving = false,
  embedded = false,
}) => {
  const { members = [] } = useCoop();
  const safeMembers = members || [];

  // Active Tab Mode — embedded (setups designer) is locked to the designer tab.
  const [activeTab, setActiveTab] = useState<'register' | 'designer' | 'batch' | 'issue'>('designer');

  // Selected Member for Live Preview
  const [selectedMemberId, setSelectedMemberId] = useState<string>(safeMembers[0]?.id || '');
  // Helper to handle image file upload as Data URL for logo / signatures
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldKey: 'companyLogoUrl' | 'signature1Url' | 'signature2Url' | 'signature3Url'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        setCertConfig(prev => ({
          ...prev,
          [fieldKey]: result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const selectedMember = useMemo(() => {
    return safeMembers.find(m => m.id === selectedMemberId) || safeMembers[0];
  }, [safeMembers, selectedMemberId]);

  // Certificate Configuration State — seeded from the saved design if provided.
  const [certConfig, setCertConfig] = useState<CertificateConfig>(() => ({
    ...DEFAULT_CERT_CONFIG,
    ...(initialConfig || {}),
  }));

  // Apply a newly-provided design (e.g. opening a different certificate format)
  // without clobbering in-progress edits. Stable references only.
  const lastInitRef = React.useRef(initialConfig);
  React.useEffect(() => {
    if (initialConfig && initialConfig !== lastInitRef.current) {
      lastInitRef.current = initialConfig;
      setCertConfig({ ...DEFAULT_CERT_CONFIG, ...initialConfig });
    }
  }, [initialConfig]);

  // Search & Filter state for Register
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [membershipTypeFilter, setMembershipTypeFilter] = useState<string>('all');

  // Batch Printing Selection
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // New Certificate Issuance State
  const [issueForm, setIssueForm] = useState({
    memberId: safeMembers[0]?.id || '',
    numberOfShares: 50,
    faceValue: 100,
    kittaStartNo: 1051,
    certificateNoPrefix: 'SC-2083-',
    issuedDateBS: getTodayBS(),
    paymentVoucherNo: 'JV-2083-0189',
    remarks: 'Approved by AGM resolution #4',
  });

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return safeMembers.filter(m => {
      const matchesSearch = 
        m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.memberNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.citizenshipNo && m.citizenshipNo.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = membershipTypeFilter === 'all' || m.membershipType === membershipTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [safeMembers, searchTerm, membershipTypeFilter]);

  // Toggle selection for batch printing
  const toggleSelectMember = (id: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    if (selectedMemberIds.length === filteredMembers.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(filteredMembers.map(m => m.id));
    }
  };

  // Execute Native Print
  const handleTriggerPrint = () => {
    window.print();
  };

  // Issue New Certificate Handler
  const handleIssueCertificate = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMember = safeMembers.find(m => m.id === issueForm.memberId);
    if (!targetMember) {
      alert('Please select a valid member.');
      return;
    }

    // Note: Actual share issuance is handled by the Shares > Issue tab via the real API.
    // This component is for certificate design and preview only.
    alert(`Certificate preview ready for ${targetMember.fullName}. To issue shares, go to Shares > Issue tab.`);
    
    // Switch preview to issued member
    setSelectedMemberId(targetMember.id);
    setActiveTab('designer');
  };

  return (
    <div className="space-y-5 text-slate-800">
      
      {/* Module Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('designer')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${ activeTab === 'designer' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900' }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Studio & Customizer</span>
          </button>

          {!embedded && (
            <button
              onClick={() => setActiveTab('register')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${ activeTab === 'register' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900' }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Shareholders Register</span>
            </button>
          )}

          {!embedded && (
            <button
              onClick={() => setActiveTab('batch')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${ activeTab === 'batch' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900' }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Batch Printing Queue ({selectedMemberIds.length})</span>
            </button>
          )}

          {!embedded && (
            <button
              onClick={() => setActiveTab('issue')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${ activeTab === 'issue' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900' }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Issue New Certificate</span>
            </button>
          )}
        </div>

        {/* Global Print Action Button */}
        <div className="flex items-center gap-2">
          {onSaveConfig && (
            <button
              type="button"
              onClick={() => onSaveConfig(certConfig)}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Saving Design…' : 'Save Design'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleTriggerPrint}
            className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-slate-800 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print Current Certificate</span>
          </button>
        </div>

      </div>

      {/* TAB 1: DESIGNER & CUSTOMIZER STUDIO */}
      {activeTab === 'designer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Controls Customizer Panel */}
          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5 text-xs max-h-[85vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-600" />
                <h2 className="font-bold text-slate-900 text-sm">Certificate Format & Style Settings</h2>
              </div>
              <button
                type="button"
                onClick={() => setCertConfig(DEFAULT_CERT_CONFIG)}
                className="text-[11px] text-amber-700 hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Reset Defaults
              </button>
            </div>

            {/* Member Selector for Preview */}
            <div className="space-y-1.5 p-3 bg-amber-50/60 /20 border border-amber-200 /40 rounded-xl">
              <label className="font-bold text-amber-900 flex items-center justify-between">
                <span>Previewing Member Share Certificate:</span>
                <span className="text-[10px] font-mono text-amber-700">ID: {selectedMember?.memberNo}</span>
              </label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full bg-white border border-amber-300 rounded-lg p-2 font-semibold text-slate-900 focus:outline-none focus:border-amber-500"
              >
                {safeMembers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.memberNo}) - {m.totalShares} Shares ({formatNPR(m.shareAmount)})
                  </option>
                ))}
              </select>
            </div>

            {/* Template Manager */}
            <CertificateTemplateManager
              currentConfig={certConfig}
              onApplyConfig={setCertConfig}
            />

            {/* Theme Selector */}
            <div className="space-y-2">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-purple-600" />
                <span>Certificate Aesthetic Theme:</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'royal_gold', label: 'Royal Gold & Filigree', color: 'bg-amber-500' },
                  { id: 'emerald_heritage', label: 'Emerald Heritage', color: 'bg-emerald-600' },
                  { id: 'crimson_prestige', label: 'Crimson Prestige', color: 'bg-rose-600' },
                  { id: 'executive_navy', label: 'Executive Navy', color: 'bg-slate-50' },
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCertConfig(prev => ({ ...prev, theme: t.id as CertificateTheme }))}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${ certConfig.theme === t.id ? 'border-amber-600 bg-amber-50/70 /40 font-bold text-amber-950 shadow-2xs' : 'border-slate-200 hover:bg-slate-50 text-slate-700 ' }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${t.color} shrink-0`}></span>
                    <span className="text-[11px] leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Tag Insertion System */}
            <TagInsertionSystem
              certConfig={certConfig}
              onChangeConfig={setCertConfig}
              selectedMember={selectedMember}
            />

            {/* Snap-to-Grid & Interactive Alignment Engine Controls */}
            <SnapToGridControls
              certConfig={certConfig}
              onChangeConfig={setCertConfig}
            />

            {/* Cooperative Header Details */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Institution Information:</span>
              </label>

              <div className="space-y-2">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold">Cooperative Name (Nepali)</span>
                  <input
                    type="text"
                    value={certConfig.coopNameNp}
                    onChange={(e) => setCertConfig(prev => ({ ...prev, coopNameNp: e.target.value }))}
                    className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium"
                  />
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-semibold">Cooperative Name (English)</span>
                  <input
                    type="text"
                    value={certConfig.coopNameEn}
                    onChange={(e) => setCertConfig(prev => ({ ...prev, coopNameEn: e.target.value }))}
                    className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold">Regd No</span>
                    <input
                      type="text"
                      value={certConfig.regdNo}
                      onChange={(e) => setCertConfig(prev => ({ ...prev, regdNo: e.target.value }))}
                      className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold">Face Value per Share</span>
                    <input
                      type="number"
                      value={certConfig.faceValuePerShare}
                      onChange={(e) => setCertConfig(prev => ({ ...prev, faceValuePerShare: Number(e.target.value) }))}
                      className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Company Logo & Branding Area Toggle & Upload */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                  <span>Company Logo / Crest:</span>
                </label>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500">Show Logo</span>
                  <input
                    type="checkbox"
                    checked={certConfig.showCompanyLogo !== false}
                    onChange={(e) => setCertConfig(prev => ({ ...prev, showCompanyLogo: e.target.checked }))}
                    className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              {certConfig.showCompanyLogo !== false && (
                <div className="p-3 bg-amber-50/50 /80 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-600">
                      Cooperative Official Logo Image:
                    </span>
                    {certConfig.companyLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setCertConfig(prev => ({ ...prev, companyLogoUrl: '' }))}
                        className="text-[10px] text-rose-500 hover:underline flex items-center gap-0.5"
                      >
                        <X className="w-3 h-3" /> Remove Logo
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {certConfig.companyLogoUrl ? (
                      <div className="w-12 h-12 rounded-lg border border-amber-300 bg-white p-1 flex items-center justify-center shrink-0">
                        <img src={certConfig.companyLogoUrl} alt="Logo preview" className="w-10 h-10 object-contain" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg border-2 border-dashed border-amber-300 bg-white flex items-center justify-center shrink-0 text-amber-600">
                        <ImageIcon className="w-6 h-6 opacity-60" />
                      </div>
                    )}

                    <div className="flex-1 space-y-1">
                      <label className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition inline-flex items-center gap-1 cursor-pointer">
                        <Upload className="w-3 h-3" />
                        <span>Upload Logo PNG/JPG</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, 'companyLogoUrl')}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[9px] text-slate-500">
                        Supports transparent PNG, JPG or WebP (max 2MB)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Signatory Authorities & Signature Images */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Authorized Signatures:</span>
                </label>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500">Show Section</span>
                  <input
                    type="checkbox"
                    checked={certConfig.showAuthorizedSignatures !== false}
                    onChange={(e) => setCertConfig(prev => ({ ...prev, showAuthorizedSignatures: e.target.checked }))}
                    className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              {certConfig.showAuthorizedSignatures !== false && (
                <div className="space-y-2.5">
                  {/* Signatory Names Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold">Chairman Name</span>
                      <input
                        type="text"
                        value={certConfig.signatory1.name}
                        onChange={(e) => setCertConfig(prev => ({ ...prev, signatory1: { ...prev.signatory1, name: e.target.value } }))}
                        className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold">Manager Name</span>
                      <input
                        type="text"
                        value={certConfig.signatory2.name}
                        onChange={(e) => setCertConfig(prev => ({ ...prev, signatory2: { ...prev.signatory2, name: e.target.value } }))}
                        className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium"
                      />
                    </div>
                  </div>

                  {/* Signature Image Uploads Accordion / Box */}
                  <div className="p-3 bg-emerald-50/50 /80 border border-emerald-200 rounded-xl space-y-2">
                    <span className="text-[10px] font-bold text-emerald-900 block">
                      Digital Signature Images Upload:
                    </span>

                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      {/* Chairman Signature Upload */}
                      <div className="space-y-1 bg-white p-2 rounded-lg border border-slate-200 text-center">
                        <span className="font-semibold text-slate-700 block truncate">Chairman</span>
                        {certConfig.signature1Url ? (
                          <div className="relative group">
                            <img src={certConfig.signature1Url} alt="Chairman Sign" className="h-8 max-w-full object-contain mx-auto" />
                            <button
                              type="button"
                              onClick={() => setCertConfig(prev => ({ ...prev, signature1Url: '' }))}
                              className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5 shadow-xs"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="px-1.5 py-1 bg-slate-100 hover:bg-emerald-100 text-slate-700 rounded font-semibold cursor-pointer block border border-dashed border-slate-300">
                            + Upload
                            <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'signature1Url')} className="hidden" />
                          </label>
                        )}
                      </div>

                      {/* Manager Signature Upload */}
                      <div className="space-y-1 bg-white p-2 rounded-lg border border-slate-200 text-center">
                        <span className="font-semibold text-slate-700 block truncate">Manager</span>
                        {certConfig.signature2Url ? (
                          <div className="relative group">
                            <img src={certConfig.signature2Url} alt="Manager Sign" className="h-8 max-w-full object-contain mx-auto" />
                            <button
                              type="button"
                              onClick={() => setCertConfig(prev => ({ ...prev, signature2Url: '' }))}
                              className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5 shadow-xs"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="px-1.5 py-1 bg-slate-100 hover:bg-emerald-100 text-slate-700 rounded font-semibold cursor-pointer block border border-dashed border-slate-300">
                            + Upload
                            <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'signature2Url')} className="hidden" />
                          </label>
                        )}
                      </div>

                      {/* Treasurer Signature Upload */}
                      <div className="space-y-1 bg-white p-2 rounded-lg border border-slate-200 text-center">
                        <span className="font-semibold text-slate-700 block truncate">Treasurer</span>
                        {certConfig.signature3Url ? (
                          <div className="relative group">
                            <img src={certConfig.signature3Url} alt="Treasurer Sign" className="h-8 max-w-full object-contain mx-auto" />
                            <button
                              type="button"
                              onClick={() => setCertConfig(prev => ({ ...prev, signature3Url: '' }))}
                              className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5 shadow-xs"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="px-1.5 py-1 bg-slate-100 hover:bg-emerald-100 text-slate-700 rounded font-semibold cursor-pointer block border border-dashed border-slate-300">
                            + Upload
                            <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'signature3Url')} className="hidden" />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Security Toggles */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Security & Verification Features:</span>
              </label>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                <span className="font-medium text-slate-700">QR Code Verification Stamp</span>
                <input
                  type="checkbox"
                  checked={certConfig.showQrCode}
                  onChange={(e) => setCertConfig(prev => ({ ...prev, showQrCode: e.target.checked }))}
                  className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                <span className="font-medium text-slate-700">Hologram Secure Seal Badge</span>
                <input
                  type="checkbox"
                  checked={certConfig.showHologram}
                  onChange={(e) => setCertConfig(prev => ({ ...prev, showHologram: e.target.checked }))}
                  className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                />
              </div>
            </div>

          </div>

          {/* Live High-Res Canvas Preview */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between bg-slate-100 px-4 py-2.5 rounded-2xl border border-slate-200">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-amber-600" />
                <span>Live High-Fidelity Canvas Rendering</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                A4 Landscape Print Format
              </span>
            </div>

            {/* Dynamic Member Preview Switcher & Tag Inspection Panel */}
            <MemberPreviewCycler
              members={safeMembers}
              selectedMemberId={selectedMemberId}
              onSelectMember={(mbr) => setSelectedMemberId(mbr.id)}
              certConfig={certConfig}
            />

            {selectedMember ? (
              <ShareCertificateCanvas 
                member={selectedMember} 
                config={certConfig} 
                onUpdateConfig={setCertConfig}
              />
            ) : (
              <div className="p-12 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-2xl">
                No member selected for certificate preview.
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: SHAREHOLDERS REGISTER */}
      {activeTab === 'register' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
          
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search member name, ID, or citizenship..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={membershipTypeFilter}
                onChange={(e) => setMembershipTypeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
              >
                <option value="all">All Membership Types</option>
                <option value="General">General</option>
                <option value="Founder">Founder</option>
                <option value="Institutional">Institutional</option>
              </select>

              <button
                type="button"
                onClick={selectAllFiltered}
                className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-900 font-bold rounded-xl hover:bg-amber-100 transition cursor-pointer shrink-0"
              >
                {selectedMemberIds.length === filteredMembers.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

          </div>

          {/* Members Certificate Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                <tr>
                  <th className="p-3 w-10 text-center">Select</th>
                  <th className="p-3">Member ID & Name</th>
                  <th className="p-3">Citizenship & Address</th>
                  <th className="p-3 text-right">No. of Shares</th>
                  <th className="p-3 text-right">Total Value (रु.)</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredMembers.map(m => {
                  const isSelected = selectedMemberIds.includes(m.id);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 /50">
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectMember(m.id)}
                          className="text-amber-600 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{m.fullName}</div>
                        <div className="text-[10px] text-amber-700 font-mono font-medium">{m.memberNo}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-700">{m.address || 'Koteshwor'}</div>
                        <div className="text-[10px] text-slate-500">Cit: {m.citizenshipNo}</div>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-purple-700">
                        {m.totalShares} Shares
                      </td>
                      <td className="p-3 text-right font-mono font-black text-emerald-600">
                        {formatNPR(m.shareAmount)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => {
                              setSelectedMemberId(m.id);
                              setActiveTab('designer');
                            }}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-xs transition cursor-pointer font-medium flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> Preview
                          </button>

                          {onSelectMemberForModal && (
                            <button 
                              type="button"
                              onClick={() => onSelectMemberForModal(m)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-lg text-xs transition cursor-pointer font-medium flex items-center gap-1"
                            >
                              <Printer className="w-3 h-3" /> Modal Print
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* TAB 3: BATCH PRINTING QUEUE */}
      {activeTab === 'batch' && (
        <div className="space-y-4">
          <div className="bg-amber-50 /30 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950">
            <div>
              <h3 className="font-bold text-sm">Batch Certificate Print Queue</h3>
              <p className="text-xs text-amber-800 mt-0.5">
                {selectedMemberIds.length} share certificates queued for sequential printing.
              </p>
            </div>

            <button
              type="button"
              onClick={handleTriggerPrint}
              disabled={selectedMemberIds.length === 0}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Print All Queued ({selectedMemberIds.length})</span>
            </button>
          </div>

          {selectedMemberIds.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
              No members selected for batch printing. Go to the Shareholders Register tab to select members.
            </div>
          ) : (
            <div className="space-y-8">
              {selectedMemberIds.map(id => {
                const member = safeMembers.find(m => m.id === id);
                if (!member) return null;
                return (
                  <div key={id} className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-900 text-xs">
                        Member: {member.fullName} ({member.memberNo})
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSelectMember(id)}
                        className="text-rose-500 hover:underline text-[11px] font-medium"
                      >
                        Remove from Queue
                      </button>
                    </div>

                    <ShareCertificateCanvas member={member} config={certConfig} compact />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ISSUE NEW CERTIFICATE */}
      {activeTab === 'issue' && (
        <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 text-xs">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              <span>Issue New Share Certificate & Kitta Allocation</span>
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Record new share capital purchases, assign distinctive serial numbers (Kitta Range), and issue official certificates.
            </p>
          </div>

          <form onSubmit={handleIssueCertificate} className="space-y-4">
            
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Select Member *</label>
              <select
                value={issueForm.memberId}
                onChange={(e) => setIssueForm(prev => ({ ...prev, memberId: e.target.value }))}
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 font-semibold text-slate-900 focus:outline-none focus:border-amber-500"
              >
                {safeMembers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.memberNo}) - Current: {m.totalShares} Shares
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">No. of Shares to Issue *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={issueForm.numberOfShares}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, numberOfShares: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Face Value per Share (रु.)</label>
                <input
                  type="number"
                  readOnly
                  value={issueForm.faceValue}
                  className="w-full bg-slate-100 /60 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Distinctive Kitta Start No.</label>
                <input
                  type="number"
                  required
                  value={issueForm.kittaStartNo}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, kittaStartNo: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 font-mono font-bold text-purple-700"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Calculated Kitta End No.</label>
                <input
                  type="text"
                  readOnly
                  value={issueForm.kittaStartNo + issueForm.numberOfShares - 1}
                  className="w-full bg-slate-100 /60 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Certificate Prefix</label>
                <input
                  type="text"
                  value={issueForm.certificateNoPrefix}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, certificateNoPrefix: e.target.value }))}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Issuance Date (BS)</label>
                <input
                  type="text"
                  value={issueForm.issuedDateBS}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, issuedDateBS: e.target.value }))}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Payment Voucher Reference</label>
              <input
                type="text"
                value={issueForm.paymentVoucherNo}
                onChange={(e) => setIssueForm(prev => ({ ...prev, paymentVoucherNo: e.target.value }))}
                placeholder="e.g. CR-2083-0045"
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 font-mono"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                <Award className="w-4 h-4" />
                <span>Confirm & Issue Share Certificate</span>
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
};
