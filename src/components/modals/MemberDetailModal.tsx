import React, { useState, useRef, useEffect } from 'react';
import { useCoop } from '../../context/CoopContext';
import { useToast } from '../../context/ToastContext';
import { useAuthStore } from '../../stores/authStore';
import { 
  X, 
  Maximize2,
  Minimize2,
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Users, 
  Briefcase, 
  ShieldCheck, 
  FileText, 
  Fingerprint, 
  CheckCircle2, 
  AlertCircle,
  PiggyBank, 
  Landmark, 
  PieChart,
  FileCheck,
  Building2,
  Lock,
  Heart,
  Calendar,
  DollarSign,
  Award,
  BookOpen,
  Image as ImageIcon,
  Check,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Upload,
  ThumbsUp,
  ThumbsDown,
  Edit3,
  Save,
  XCircle,
  Share2,
  Clock,
  TrendingUp,
  Printer,
} from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { ImageHoverPreview } from '../common/ImageHoverPreview';
import { exportToPdf, exportToExcel, exportMemberProfilePdf } from '../../utils/exportUtils';
import { resolveMediaUrl, uploadMedia } from '../../api/storage';
import { fetchShareAccountDetail, type ShareAccountDetail } from '../../api/shares';
import { fetchMemberDocuments, addMemberDocument, deleteMemberDocument, type MemberDocument } from '../../api/members';
import type { MediaTargetType } from '../../types/coop';

interface MemberDetailModalProps {
  /** If true, the modal opens directly in edit mode */
  openInEditMode?: boolean;
}

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800";

const EditField: React.FC<{ label: string; value: any; onChange: (v: any) => void; type?: string; placeholder?: string }> = ({ label, value, onChange, type = 'text', placeholder }) => (
  <div className="flex flex-col gap-1">
    <label className="text-slate-500 text-[11px] font-semibold">{label}</label>
    <input type={type} value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} className={inputCls} />
  </div>
);

const EditSelect: React.FC<{ label: string; value: any; onChange: (v: any) => void; options: string[] }> = ({ label, value, onChange, options }) => (
  <div className="flex flex-col gap-1">
    <label className="text-slate-500 text-[11px] font-semibold">{label}</label>
    <select value={value ?? options[0]} onChange={e => onChange(e.target.value)} className={inputCls}>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  </div>
);

export const MemberDetailModal: React.FC<MemberDetailModalProps> = ({ openInEditMode = false }) => {
  const { selectedMemberForDetail, setSelectedMemberForDetail, memberEditMode, setMemberEditMode, savingsAccounts = [], loanAccounts = [], openTab, setSelectedAccountForPassbook, updateMember } = useCoop();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'personal' | 'address' | 'family' | 'financial' | 'kyc_artifacts' | 'shares' | 'savings' | 'loans'>('overview');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [kycApproving, setKycApproving] = useState(false);
  const [kycRejecting, setKycRejecting] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<'citizenship_front' | 'citizenship_back' | 'passport' | 'license' | 'signature'>('citizenship_front');

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(openInEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});

  // Initialize edit data when member changes or edit mode opens
  useEffect(() => {
    if (selectedMemberForDetail) {
      setEditData({ ...selectedMemberForDetail });
    }
  }, [selectedMemberForDetail]);

  useEffect(() => {
    if (openInEditMode) setIsEditing(true);
  }, [openInEditMode]);

  // Share data
  const [shareDetail, setShareDetail] = useState<ShareAccountDetail | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => {
    if (selectedMemberForDetail && activeTab === 'shares') {
      setShareLoading(true);
      fetchShareAccountDetail(selectedMemberForDetail.id)
        .then(setShareDetail)
        .catch(() => setShareDetail(null))
        .finally(() => setShareLoading(false));
    }
  }, [selectedMemberForDetail, activeTab]);

  // Member Documents (additional uploads beyond core KYC fields)
  const [memberDocs, setMemberDocs] = useState<MemberDocument[]>([]);
  const [memberDocsLoading, setMemberDocsLoading] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const memberDocsFileRef = useRef<HTMLInputElement | null>(null);

  const loadMemberDocs = async () => {
    if (!selectedMemberForDetail) return;
    setMemberDocsLoading(true);
    try {
      const docs = await fetchMemberDocuments(selectedMemberForDetail.id);
      setMemberDocs(docs);
    } catch {
      setMemberDocs([]);
    } finally {
      setMemberDocsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMemberForDetail && activeTab === 'kyc_artifacts') {
      loadMemberDocs();
    }
  }, [selectedMemberForDetail, activeTab]);

  const handleUploadAdditionalDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedMemberForDetail) return;
    setDocUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const stored = await uploadMedia('kyc_document', dataUrl, { memberId: selectedMemberForDetail.id });
      await addMemberDocument(selectedMemberForDetail.id, {
        documentType: 'Other',
        fileUrl: stored.url,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      toast.showSuccess('Document uploaded', file.name);
      await loadMemberDocs();
    } catch (err: any) {
      toast.showError('Upload failed', err?.message || 'Could not upload document');
    } finally {
      setDocUploading(false);
      if (memberDocsFileRef.current) memberDocsFileRef.current.value = '';
    }
  };

  const handleDeleteMemberDoc = async (docId: string) => {
    if (!selectedMemberForDetail) return;
    try {
      await deleteMemberDocument(selectedMemberForDetail.id, docId);
      toast.showSuccess('Document deleted', '');
      await loadMemberDocs();
    } catch (err: any) {
      toast.showError('Delete failed', err?.message || 'Could not delete document');
    }
  };

  useEffect(() => {
    if (selectedMemberForDetail && memberEditMode) {
      setEditData({ ...selectedMemberForDetail });
      setIsEditing(true);
      setActiveTab('personal');
    }
  }, [selectedMemberForDetail, memberEditMode]);

  const handleStartEdit = () => {
    if (selectedMemberForDetail) {
      setEditData({ ...selectedMemberForDetail });
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setMemberEditMode(false);
    if (selectedMemberForDetail) setEditData({ ...selectedMemberForDetail });
  };

  const handleSaveEdit = async () => {
    if (!selectedMemberForDetail) return;
    setIsSaving(true);
    try {
      await updateMember(selectedMemberForDetail.id, editData);
      toast.showSuccess(`Member profile updated for ${selectedMemberForDetail.fullName}`, 'Changes Saved');
      setIsEditing(false);
      setMemberEditMode(false);
    } catch (error: any) {
      toast.showError(
        error?.response?.data?.error || error?.message || 'Failed to save changes. Please try again.',
        'Save Failed'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const setField = (key: string, value: any) => {
    setEditData(prev => ({ ...prev, [key]: value }));
  };

  // Document Lightbox
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);

  // Document upload ref
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);

  if (!selectedMemberForDetail) return null;

  const m = selectedMemberForDetail;

  const memberSavings = (savingsAccounts || []).filter(s => s && s.memberId === m.id);
  const memberLoans = (loanAccounts || []).filter(l => l && l.memberId === m.id);

  // KYC verification decision (approve / reject) after document review
  const handleApproveKyc = async () => {
    setKycApproving(true);
    try {
      await updateMember(m.id, { kycStatus: 'Verified' });
      toast.showSuccess(`KYC Approved for ${m.fullName}`, 'Verification Complete');
    } catch (error: any) {
      toast.showError(
        error?.response?.data?.error || error?.message || 'Failed to approve KYC. Please try again.',
        'Approval Failed'
      );
    } finally {
      setKycApproving(false);
    }
  };

  const handleRejectKyc = async () => {
    setKycRejecting(true);
    try {
      await updateMember(m.id, { kycStatus: 'Rejected' });
      toast.showError(`KYC Rejected for ${m.fullName}`, 'Verification Rejected');
    } catch (error: any) {
      toast.showError(
        error?.response?.data?.error || error?.message || 'Failed to reject KYC. Please try again.',
        'Rejection Failed'
      );
    } finally {
      setKycRejecting(false);
    }
  };

  const triggerFileUpload = (docType: 'citizenship_front' | 'citizenship_back' | 'passport' | 'license' | 'signature') => {
    setSelectedDocType(docType);
    setTimeout(() => uploadFileInputRef.current?.click(), 0);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      let mediaTargetType: MediaTargetType | null = null;
      const updates: Partial<typeof m> = {};

      if (selectedDocType === 'citizenship_front') {
        mediaTargetType = 'citizenshipFront';
      } else if (selectedDocType === 'citizenship_back') {
        mediaTargetType = 'citizenshipBack';
      } else if (selectedDocType === 'passport') {
        mediaTargetType = 'photo';
      } else if (selectedDocType === 'license') {
        mediaTargetType = 'citizenshipFront';
      } else if (selectedDocType === 'signature') {
        mediaTargetType = 'signature';
      }

      let storedUrl = dataUrl;
      if (mediaTargetType) {
        try {
          const stored = await uploadMedia(mediaTargetType, dataUrl, { memberId: m.id });
          storedUrl = stored.url;
        } catch (err: any) {
          toast.showError('Upload Failed', err?.response?.data?.error || err?.message || 'Could not store document.');
          return;
        }
      }

      if (selectedDocType === 'citizenship_front' || selectedDocType === 'license') {
        updates.citizenshipFrontUrl = storedUrl;
      } else if (selectedDocType === 'citizenship_back') {
        updates.citizenshipBackUrl = storedUrl;
      } else if (selectedDocType === 'passport') {
        updates.photoUrl = storedUrl;
      } else if (selectedDocType === 'signature') {
        updates.signatureUrl = storedUrl;
      }

      updateMember(m.id, updates);
      toast.showSuccess('Member KYC Updated', `Saved document for ${m.fullName}.`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleExportMemberPdf = async () => {
    const accounts = [
      ...memberSavings.map(s => ({ type: 'Savings', accountNo: s.accountNo, productName: s.productName, balance: s.balance, status: s.status })),
      ...memberLoans.map(l => ({ type: 'Loan', accountNo: l.loanNo, productName: l.productName, balance: l.outstandingPrincipal, status: l.status })),
    ];

    const authUser = useAuthStore.getState().user;

    let additionalDocs: { fileName: string; fileUrl: string; documentType: string; mimeType?: string; uploadedAt?: string }[] = [];
    try {
      const docs = await fetchMemberDocuments(m.id);
      additionalDocs = docs.map(d => ({
        fileName: d.fileName,
        fileUrl: resolveMediaUrl(d.fileUrl) || d.fileUrl,
        documentType: d.documentType,
        mimeType: d.mimeType || undefined,
        uploadedAt: d.uploadedAt,
      }));
    } catch {}

    exportMemberProfilePdf({
      memberNo: m.memberNo,
      fullName: m.fullName,
      nameNepali: m.nameNepali,
      citizenshipNo: m.citizenshipNo,
      phone: m.phone,
      email: m.email,
      joinedDate: m.membershipDateBS,
      kycStatus: m.kycStatus,
      membershipType: m.membershipType,
      gender: m.gender,
      dobBS: m.dobBS,
      dobAD: m.dobAD,
      bloodGroup: m.bloodGroup,
      maritalStatus: m.maritalStatus,
      photoUrl: m.photoUrl,
      address: m.address,
      district: m.district,
      permProvince: m.permProvince,
      permDistrict: m.permDistrict,
      permMunicipality: m.permMunicipality,
      permWard: m.permWard,
      permTole: m.permTole,
      tempProvince: m.tempProvince,
      tempDistrict: m.tempDistrict,
      tempMunicipality: m.tempMunicipality,
      tempWard: m.tempWard,
      tempTole: m.tempTole,
      secondaryPhone: m.secondaryPhone,
      fatherName: m.fatherName,
      motherName: m.motherName,
      grandfatherName: m.grandfatherName,
      spouseName: m.spouseName,
      nomineeName: m.nomineeName,
      nomineeRelation: m.nomineeRelation,
      nomineePhone: m.nomineePhone,
      nomineeCitizenshipNo: m.nomineeCitizenshipNo,
      occupation: m.occupation,
      employerName: m.employerName,
      annualIncome: m.annualIncome,
      sourceOfFunds: m.sourceOfFunds,
      isPEP: m.isPEP,
      pepDetails: m.pepDetails,
      groupName: m.groupName,
      memberCategory: m.memberCategory,
      totalShares: m.totalShares,
      shareAmount: m.shareAmount,
      totalSavingsBalance: m.totalSavingsBalance,
      totalLoanBalance: m.totalLoanBalance,
      educationLevel: m.educationLevel,
      dependentsCount: m.dependentsCount,
      guardianName: m.guardianName,
      guardianRelation: m.guardianRelation,
      accounts,
      orgName: authUser?.organizationName || '',
      citizenshipFrontUrl: resolveMediaUrl(m.citizenshipFrontUrl) || m.citizenshipFrontUrl,
      citizenshipBackUrl: resolveMediaUrl(m.citizenshipBackUrl) || m.citizenshipBackUrl,
      signatureUrl: resolveMediaUrl(m.signatureUrl) || m.signatureUrl,
      additionalDocs,
    });
  };

  const handleExportMemberExcel = () => {
    const headers = ['Account Type', 'Account Number', 'Product Name', 'Balance (NPR)', 'Status'];
    const rows: (string | number)[][] = [
      ...memberSavings.map(s => ['Savings', s.accountNo, s.productName, s.balance, s.status]),
      ...memberLoans.map(l => ['Loan', l.loanNo, l.productName, l.outstandingPrincipal, l.status]),
    ];

    exportToExcel(
      `Member_Ledger_${m.memberNo}`,
      'Member_Statement',
      headers,
      rows
    );
  };

  return (
    <div className={`fixed inset-0 z-50 bg-slate-50 backdrop-blur-xs flex items-center justify-center animate-in fade-in duration-200 ${isFullScreen ? 'p-0' : 'p-2 sm:p-4'}`}>
      {/* Hidden file input for document uploads */}
      <input
        type="file"
        ref={uploadFileInputRef}
        onChange={handleFileUpload}
        accept="image/*,.pdf"
        className="hidden"
      />
      <div className={`bg-white border border-slate-200 w-full text-slate-800 flex flex-col transition-all duration-200 overflow-hidden ${ isFullScreen ? 'h-screen w-screen rounded-none shadow-none max-w-none max-h-none' : 'max-w-6xl rounded-2xl shadow-2xl max-h-[92vh] animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-200 ease-out' }`}>
        
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <ImageHoverPreview
              src={resolveMediaUrl(m.photoUrl) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
              name={m.fullName}
              subtext={m.memberNo}
              badge={`KYC ${m.kycStatus}`}
              sizeClass="w-11 h-11 sm:w-12 sm:h-12 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate">{m.fullName}</h2>
                {m.nameNepali && <span className="text-xs text-slate-500 font-normal">({m.nameNepali})</span>}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${ m.kycStatus === 'Verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200' }`}>
                  KYC {m.kycStatus}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                  {m.membershipType} Member
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 sm:gap-3 mt-0.5 flex-wrap">
                <span className="font-mono text-emerald-700 font-semibold">{m.memberNo}</span>
                <span>•</span>
                <span>Citizenship: <span className="font-mono font-medium text-slate-700">{m.citizenshipNo}</span></span>
                <span>•</span>
                <span>Joined: {m.membershipDateBS} BS</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 pl-2">
            {m.kycStatus !== 'Verified' && (
              <>
                <button
                  type="button"
                  onClick={handleApproveKyc}
                  disabled={kycApproving || kycRejecting}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Approve this member's KYC verification"
                >
                  {kycApproving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Approve KYC</span>
                </button>
                <button
                  type="button"
                  onClick={handleRejectKyc}
                  disabled={kycApproving || kycRejecting}
                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Reject this member's KYC verification"
                >
                  {kycRejecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Reject</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleStartEdit}
              className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Edit Member Profile"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </button>

            <button
              type="button"
              onClick={() => triggerFileUpload('citizenship_front')}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Upload Member Document"
            >
              <Upload className="w-3.5 h-3.5 text-slate-800" />
              <span className="hidden sm:inline">Upload</span>
            </button>

            <button
              type="button"
              onClick={handleExportMemberPdf}
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              title="Download Statement PDF"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportMemberExcel}
              className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Download Ledger Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-200/70 hover:bg-slate-300/70 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title={isFullScreen ? "Exit Fullscreen" : "Expand Fullscreen"}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="w-4 h-4 text-slate-700" />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-slate-700" />
                  <span className="hidden sm:inline">Fullscreen</span>
                </>
              )}
            </button>
            <button 
              onClick={() => { setMemberEditMode(false); setSelectedMemberForDetail(null); }}
              className="p-1.5 text-slate-500 hover:text-slate-700 bg-slate-200/60 hover:bg-slate-300/60 rounded-lg transition cursor-pointer"
              title="Close Profile"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-Nav Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 bg-slate-50 border-b border-slate-200 text-xs font-medium overflow-x-auto shrink-0 scrollbar-none pt-1.5">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2 px-2.5 sm:px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${ activeTab === 'overview' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-600 hover:text-slate-800' }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>360° Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('personal')}
            className={`pb-2 px-2.5 sm:px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${ activeTab === 'personal' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-600 hover:text-slate-800' }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Personal & Identity</span>
          </button>
          <button
            onClick={() => setActiveTab('address')}
            className={`pb-2 px-2.5 sm:px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${ activeTab === 'address' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-600 hover:text-slate-800' }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Address & Contact</span>
          </button>
          <button
            onClick={() => setActiveTab('family')}
            className={`pb-2 px-2.5 sm:px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${ activeTab === 'family' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-600 hover:text-slate-800' }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Family & Nominee</span>
          </button>
          <button
            onClick={() => setActiveTab('financial')}
            className={`pb-2 px-2.5 sm:px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${ activeTab === 'financial' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-600 hover:text-slate-800' }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Financials & PEP</span>
          </button>
          <button
            onClick={() => setActiveTab('kyc_artifacts')}
            className={`pb-2 px-2.5 sm:px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${ activeTab === 'kyc_artifacts' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-600 hover:text-slate-800' }`}
          >
            <Fingerprint className="w-3.5 h-3.5 text-rose-600" />
            <span>KYC Documents</span>
          </button>
          <button
            onClick={() => setActiveTab('shares')}
            className={`pb-2 px-2.5 sm:px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${ activeTab === 'shares' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-600 hover:text-slate-800' }`}
          >
            <Share2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Shares {shareDetail ? `(${shareDetail.account.totalShares})` : ''}</span>
          </button>
          <button
            onClick={() => setActiveTab('savings')}
            className={`pb-2 px-2.5 sm:px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${ activeTab === 'savings' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-600 hover:text-slate-800' }`}
          >
            <PiggyBank className="w-3.5 h-3.5 text-emerald-600" />
            <span>Savings ({memberSavings.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('loans')}
            className={`pb-2 px-2.5 sm:px-3 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${ activeTab === 'loans' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-600 hover:text-slate-800' }`}
          >
            <Landmark className="w-3.5 h-3.5 text-emerald-600" />
            <span>Loans ({memberLoans.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-xs flex-1 bg-white">
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              
              {/* Top Financial Position Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-purple-50/60 p-3.5 rounded-xl border border-purple-200">
                  <div className="text-slate-600 text-[11px] font-medium flex items-center justify-between">
                    <span>Total Share Capital</span>
                    <PieChart className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-lg font-bold text-purple-800 mt-1">{m.totalShares || 100} Shares</div>
                  <div className="text-[10px] text-purple-700 mt-0.5">Valuation: {formatNPR(m.shareAmount || (m.totalShares || 100) * 100)}</div>
                </div>

                <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
                  <div className="text-slate-600 text-[11px] font-medium flex items-center justify-between">
                    <span>Total Savings Balance</span>
                    <PiggyBank className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-lg font-bold text-emerald-800 mt-1">{formatNPR(m.totalSavingsBalance)}</div>
                  <div className="text-[10px] text-emerald-700 mt-0.5">{memberSavings.length} active account(s)</div>
                </div>

                <div className="bg-teal-50/60 p-3.5 rounded-xl border border-teal-200">
                  <div className="text-slate-600 text-[11px] font-medium flex items-center justify-between">
                    <span>Outstanding Loans</span>
                    <Landmark className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="text-lg font-bold text-teal-800 mt-1">{formatNPR(m.totalLoanBalance)}</div>
                  <div className="text-[10px] text-teal-700 mt-0.5">{memberLoans.length} active loan(s)</div>
                </div>
              </div>

              {/* 360 Full Overview Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* 1. Basic Personal & Identity Details */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                      <User className="w-4 h-4 text-emerald-700" />
                      <span>1. Personal & Identity Details</span>
                    </h3>
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Form Section 1
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-700">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Full Name (English):</span>
                      <span className="font-bold text-slate-800">{m.fullName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Full Name (Nepali):</span>
                      <span className="font-medium text-slate-800">{m.nameNepali || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Gender & Blood Group:</span>
                      <span className="font-semibold text-slate-800">{m.gender || 'Male'} • <span className="text-rose-600 font-bold">{m.bloodGroup || 'O+'}</span></span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Date of Birth (BS):</span>
                      <span className="font-mono text-slate-800">{m.dobBS} BS</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Date of Birth (AD):</span>
                      <span className="font-mono text-slate-800">{m.dobAD || '1985-05-15'} AD</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Marital Status:</span>
                      <span>{m.maritalStatus || 'Married'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Citizenship No:</span>
                      <span className="font-mono font-bold text-slate-800">{m.citizenshipNo}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Issue District:</span>
                      <span>{m.citizenshipIssueDistrict || m.district || 'Kathmandu'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Issue Date (BS):</span>
                      <span className="font-mono">{m.citizenshipIssueDateBS || '2058-04-12'}</span>
                    </div>
                  </div>

                  {m.isMinor && (
                    <div className="mt-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200 space-y-1">
                      <div className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Minor Member Guardian Details:</span>
                      </div>
                      <div className="grid grid-cols-2 text-[11px]">
                        <span>Guardian Name: <b>{m.guardianName || 'N/A'}</b> ({m.guardianRelation || 'Father'})</span>
                        <span>Guardian Phone: <b className="font-mono">{m.guardianPhone || 'N/A'}</b></span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Contact & Address Details */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span>2. Contact & Addresses</span>
                    </h3>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Form Section 2
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Primary Phone:</span>
                      <span className="text-emerald-700 font-mono font-bold">{m.phone}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Secondary / Landline:</span>
                      <span className="font-mono text-slate-700">{m.secondaryPhone || 'N/A'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block text-[10px]">Email Address:</span>
                      <span className="text-emerald-800 font-medium">{m.email || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Permanent Address:</span>
                      <div className="text-xs text-slate-800 font-medium bg-white p-2 rounded-lg border border-slate-200 mt-0.5">
                        {m.permTole || 'Tole'}, Ward {m.permWard || '10'}, {m.permMunicipality || 'Municipality'}, {m.permDistrict || m.district}, {m.permProvince || 'Bagmati Province'}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Temporary / Current Address:</span>
                      <div className="text-xs text-slate-800 font-medium bg-white p-2 rounded-lg border border-slate-200 mt-0.5">
                        {m.tempTole || m.permTole || 'Tole'}, Ward {m.tempWard || m.permWard || '10'}, {m.tempMunicipality || m.permMunicipality || 'Municipality'}, {m.tempDistrict || m.district}, {m.tempProvince || 'Bagmati Province'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Family & Nominee Details */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-600" />
                      <span>3. Family & Registered Nominee</span>
                    </h3>
                    <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      Form Sections 3 & 4
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Father's Name:</span>
                      <span className="font-semibold text-slate-800">{m.fatherName || 'Ganga Ram Shrestha'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Mother's Name:</span>
                      <span className="font-semibold text-slate-800">{m.motherName || 'Laxmi Maya Shrestha'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Grandfather's Name:</span>
                      <span className="font-semibold text-slate-800">{m.grandfatherName || 'Bhakta Bahadur Shrestha'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Spouse Name:</span>
                      <span>{m.spouseName || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Nominee Highlight Box */}
                  <div className="bg-purple-50/80 p-3 rounded-xl border border-purple-200 space-y-1.5 mt-2">
                    <div className="text-[11px] font-bold text-purple-900 flex items-center justify-between">
                      <span>Registered Nominee (100% Share Holder):</span>
                      <span className="text-[10px] bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded font-bold">
                        {m.nomineeSharePct || '100'}% Benefit Share
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-purple-700 block text-[10px]">Nominee Name:</span>
                        <span className="font-bold text-slate-800">{m.nomineeName || 'N/A'}</span> ({m.nomineeRelation || 'Spouse'})
                      </div>
                      <div>
                        <span className="text-purple-700 block text-[10px]">Nominee Phone:</span>
                        <span className="font-mono text-emerald-700 font-bold">{m.nomineePhone || 'N/A'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-purple-700 block text-[10px]">Nominee Citizenship No:</span>
                        <span className="font-mono text-slate-800">{m.nomineeCitizenshipNo || '27-01-80-08912'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Financial, PEP & Compliance Details */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-emerald-600" />
                      <span>4. Occupation, Financials & Compliance</span>
                    </h3>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Form Section 5
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-slate-700">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Primary Occupation:</span>
                      <span className="font-bold text-slate-800">{m.occupation || 'Business'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Employer / Firm:</span>
                      <span>{m.employerName || 'Shrestha Enterprises'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Estimated Annual Income:</span>
                      <span className="font-semibold text-emerald-700">{m.annualIncome || '500,000 - 1,000,000'} NPR</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Source of Funds:</span>
                      <span>{m.sourceOfFunds || 'Business Profit / Salary'}</span>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800">Politically Exposed Person (PEP):</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ m.isPEP ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200' }`}>
                        {m.isPEP ? 'YES (High Risk)' : 'NO (Clear)'}
                      </span>
                    </div>
                    {m.isPEP && <p className="text-[11px] text-rose-700 font-medium">PEP Details: {m.pepDetails || 'Government official relative'}</p>}
                    
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                      <span className="text-slate-600">AML/Co-op Ethics Declaration:</span>
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Accepted & Signed
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* 5. Biometric & KYC Document Artifacts Banner */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-rose-600" />
                    <span>5. Verified Biometric & KYC Document Specimens</span>
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> All Documents Verified
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Photo */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center space-y-1.5 flex flex-col items-center">
                    <img 
                      src={resolveMediaUrl(m.photoUrl) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'} 
                      alt="Member Photo" 
                      className="w-20 h-24 object-cover rounded-lg border border-slate-300 shadow-xs"
                    />
                    <span className="text-[11px] font-bold text-slate-800">Passport Photo</span>
                  </div>

                  {/* Citizenship Front */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center space-y-1.5 flex flex-col items-center justify-between">
                    <div className="w-full h-24 bg-slate-50 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center p-2 text-slate-600 overflow-hidden relative group">
                      {m.citizenshipFrontUrl ? (
                        <img src={resolveMediaUrl(m.citizenshipFrontUrl)} alt="Citizenship Front" className="w-full h-full object-cover rounded" />
                      ) : (
                        <>
                          <FileText className="w-6 h-6 text-emerald-600 mb-1" />
                          <span className="text-[10px] font-bold text-emerald-700 truncate max-w-full">Citizenship_Front.jpg</span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => triggerFileUpload('citizenship_front')}
                        className="absolute inset-0 bg-white text-slate-800 font-bold text-[10px] opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1 backdrop-blur-xs"
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-600" /> Upload
                      </button>
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] font-bold text-slate-800">Citizenship (Front)</span>
                      <button 
                        type="button" 
                        onClick={() => triggerFileUpload('citizenship_front')}
                        className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-0.5"
                      >
                        <Upload className="w-3 h-3" /> Upload
                      </button>
                    </div>
                  </div>

                  {/* Citizenship Back */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center space-y-1.5 flex flex-col items-center justify-between">
                    <div className="w-full h-24 bg-slate-50 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center p-2 text-slate-600 overflow-hidden relative group">
                      {m.citizenshipBackUrl ? (
                        <img src={resolveMediaUrl(m.citizenshipBackUrl)} alt="Citizenship Back" className="w-full h-full object-cover rounded" />
                      ) : (
                        <>
                          <FileText className="w-6 h-6 text-emerald-600 mb-1" />
                          <span className="text-[10px] font-bold text-emerald-700 truncate max-w-full">Citizenship_Back.jpg</span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => triggerFileUpload('citizenship_back')}
                        className="absolute inset-0 bg-white text-slate-800 font-bold text-[10px] opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1 backdrop-blur-xs"
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-600" /> Upload
                      </button>
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] font-bold text-slate-800">Citizenship (Back)</span>
                      <button 
                        type="button" 
                        onClick={() => triggerFileUpload('citizenship_back')}
                        className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-0.5"
                      >
                        <Upload className="w-3 h-3" /> Upload
                      </button>
                    </div>
                  </div>

                  {/* Signature & Biometrics */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center space-y-1.5 flex flex-col items-center justify-between">
                    <div className="w-full h-24 bg-slate-50 rounded-lg border border-slate-200 flex flex-col items-center justify-center p-1 text-slate-700 overflow-hidden">
                      {m.signatureUrl ? (
                        <img src={resolveMediaUrl(m.signatureUrl)} alt="Signature Specimen" className="h-10 object-contain" />
                      ) : (
                        <div className="italic font-serif text-slate-800 text-sm font-bold tracking-widest border-b border-slate-400 px-2 pb-0.5">
                          {m.fullName.split(' ')[0]} {m.fullName.split(' ')[1]?.[0]}.
                        </div>
                      )}
                      <span className="text-[9px] text-emerald-700 font-semibold mt-1 flex items-center gap-1 truncate max-w-full">
                        <Fingerprint className="w-3 h-3 text-rose-600 shrink-0" />
                        <span>Biometrics Matched</span>
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-800">Signature & Biometrics</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* PERSONAL & IDENTITY TAB */}
          {activeTab === 'personal' && (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-700" />
                <span>Basic Personal & Identity Information</span>
                {isEditing && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-bold">Editing</span>}
              </h3>
              
              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-800">
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 text-[11px] font-semibold">Full Name (English)</label>
                    <input type="text" value={editData.fullName || ''} onChange={e => setField('fullName', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 text-[11px] font-semibold">Full Name (Nepali)</label>
                    <input type="text" value={editData.nameNepali || ''} onChange={e => setField('nameNepali', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 text-[11px] font-semibold">Gender</label>
                    <select value={editData.gender || 'Male'} onChange={e => setField('gender', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 text-[11px] font-semibold">Date of Birth (BS)</label>
                    <input type="text" placeholder="YYYY-MM-DD" value={editData.dobBS || ''} onChange={e => setField('dobBS', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 text-[11px] font-semibold">Marital Status</label>
                    <select value={editData.maritalStatus || 'Married'} onChange={e => setField('maritalStatus', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 text-[11px] font-semibold">Blood Group</label>
                    <select value={editData.bloodGroup || 'O+'} onChange={e => setField('bloodGroup', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 text-[11px] font-semibold">Citizenship No</label>
                    <input type="text" value={editData.citizenshipNo || ''} onChange={e => setField('citizenshipNo', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 text-[11px] font-semibold">Citizenship Issue District</label>
                    <input type="text" value={editData.citizenshipIssueDistrict || ''} onChange={e => setField('citizenshipIssueDistrict', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 text-[11px] font-semibold">Citizenship Issue Date (BS)</label>
                    <input type="text" placeholder="YYYY-MM-DD" value={editData.citizenshipIssueDateBS || ''} onChange={e => setField('citizenshipIssueDateBS', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-800">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Full Name (English)</span>
                  <span className="font-bold text-slate-800 text-sm">{m.fullName}</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Full Name (Nepali)</span>
                  <span className="font-semibold text-slate-800 text-sm">{m.nameNepali || 'N/A'}</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Gender</span>
                  <span className="font-bold text-slate-800">{m.gender || 'Male'}</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Date of Birth (Bikram Sambat)</span>
                  <span className="font-mono font-bold text-slate-800">{m.dobBS} BS</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Date of Birth (AD)</span>
                  <span className="font-mono font-bold text-slate-800">{m.dobAD || '1985-05-15'} AD</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Marital Status</span>
                  <span className="font-semibold text-slate-800">{m.maritalStatus || 'Married'}</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Blood Group</span>
                  <span className="font-bold text-rose-600 text-sm">{m.bloodGroup || 'O+'}</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Citizenship Card Number</span>
                  <span className="font-mono font-bold text-slate-800">{m.citizenshipNo}</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Citizenship Issue District</span>
                  <span className="font-semibold text-slate-800">{m.citizenshipIssueDistrict || m.district || 'Kathmandu'}</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Citizenship Issue Date (BS)</span>
                  <span className="font-mono font-bold text-slate-800">{m.citizenshipIssueDateBS || '2058-04-12'} BS</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Is Minor Account?</span>
                  <span className={`font-bold ${m.isMinor ? 'text-amber-700' : 'text-slate-800'}`}>{m.isMinor ? 'YES (Minor)' : 'NO (Adult)'}</span>
                </div>
              </div>
              )}

              {m.isMinor && (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-2">
                  <h4 className="font-bold text-amber-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Guardian / Custodian Details</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-amber-700 block text-[10px]">Guardian Name</span>
                      <span className="font-bold text-slate-800">{m.guardianName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-amber-700 block text-[10px]">Relationship</span>
                      <span className="font-semibold text-slate-800">{m.guardianRelation || 'Father'}</span>
                    </div>
                    <div>
                      <span className="text-amber-700 block text-[10px]">Guardian Citizenship</span>
                      <span className="font-mono font-bold text-slate-800">{m.guardianCitizenshipNo || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-amber-700 block text-[10px]">Guardian Contact Phone</span>
                      <span className="font-mono font-bold text-emerald-700">{m.guardianPhone || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ADDRESS & CONTACT TAB */}
          {activeTab === 'address' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  <span>Contact Phone & Email Channels</span>
                  {isEditing && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-bold">Editing</span>}
                </h3>
                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <EditField label="Primary Mobile Phone" value={editData.phone} onChange={v => setField('phone', v)} placeholder="98XXXXXXXX" />
                    <EditField label="Secondary / Landline Phone" value={editData.secondaryPhone} onChange={v => setField('secondaryPhone', v)} placeholder="01-XXXXXXX" />
                    <EditField label="Email Address" value={editData.email} onChange={v => setField('email', v)} type="email" placeholder="member@example.com" />
                  </div>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Primary Mobile Phone</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">{m.phone}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Secondary / Landline Phone</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">{m.secondaryPhone || 'N/A'}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Email Address</span>
                    <span className="font-medium text-emerald-800 text-sm">{m.email || 'N/A'}</span>
                  </div>
                </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Permanent */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>Permanent Address Breakdown</span>
                  </h4>
                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-800">
                      <EditField label="Province" value={editData.permProvince} onChange={v => setField('permProvince', v)} />
                      <EditField label="District" value={editData.permDistrict} onChange={v => setField('permDistrict', v)} />
                      <EditField label="Municipality / VDC" value={editData.permMunicipality} onChange={v => setField('permMunicipality', v)} />
                      <EditField label="Ward Number" value={editData.permWard} onChange={v => setField('permWard', v)} />
                      <div className="col-span-2">
                        <EditField label="Tole / Village Street" value={editData.permTole} onChange={v => setField('permTole', v)} />
                      </div>
                    </div>
                  ) : (
                  <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-800">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Province</span>
                      <span className="font-bold">{m.permProvince || 'Bagmati Province'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">District</span>
                      <span className="font-bold">{m.permDistrict || m.district}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Municipality / VDC</span>
                      <span className="font-bold">{m.permMunicipality || 'Kathmandu Metropolitan City'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Ward Number</span>
                      <span className="font-bold text-emerald-700">Ward {m.permWard || '10'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block text-[10px]">Tole / Village Street</span>
                      <span className="font-bold text-slate-800">{m.permTole || 'New Road'}</span>
                    </div>
                  </div>
                  )}
                </div>

                {/* Temporary */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
                    <Building2 className="w-4 h-4 text-emerald-700" />
                    <span>Temporary / Current Residence Address</span>
                  </h4>
                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-800">
                      <EditField label="Province" value={editData.tempProvince} onChange={v => setField('tempProvince', v)} />
                      <EditField label="District" value={editData.tempDistrict} onChange={v => setField('tempDistrict', v)} />
                      <EditField label="Municipality / VDC" value={editData.tempMunicipality} onChange={v => setField('tempMunicipality', v)} />
                      <EditField label="Ward Number" value={editData.tempWard} onChange={v => setField('tempWard', v)} />
                      <div className="col-span-2">
                        <EditField label="Tole / Village Street" value={editData.tempTole} onChange={v => setField('tempTole', v)} />
                      </div>
                    </div>
                  ) : (
                  <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-800">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Province</span>
                      <span className="font-bold">{m.tempProvince || m.permProvince || 'Bagmati Province'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">District</span>
                      <span className="font-bold">{m.tempDistrict || m.permDistrict || m.district}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Municipality / VDC</span>
                      <span className="font-bold">{m.tempMunicipality || m.permMunicipality || 'Kathmandu Metropolitan City'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Ward Number</span>
                      <span className="font-bold text-emerald-800">Ward {m.tempWard || m.permWard || '10'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block text-[10px]">Tole / Village Street</span>
                      <span className="font-bold text-slate-800">{m.tempTole || m.permTole || 'New Road'}</span>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* FAMILY & NOMINEE TAB */}
          {activeTab === 'family' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>3-Generation Family Tree Information</span>
                  {isEditing && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-bold">Editing</span>}
                </h3>

                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <EditField label="Father's Full Name" value={editData.fatherName} onChange={v => setField('fatherName', v)} />
                    <EditField label="Mother's Full Name" value={editData.motherName} onChange={v => setField('motherName', v)} />
                    <EditField label="Grandfather's Full Name" value={editData.grandfatherName} onChange={v => setField('grandfatherName', v)} />
                    <EditField label="Spouse Full Name" value={editData.spouseName} onChange={v => setField('spouseName', v)} />
                    <EditField label="Number of Financial Dependents" value={editData.dependentsCount} onChange={v => setField('dependentsCount', v)} type="number" />
                  </div>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Father's Full Name</span>
                    <span className="font-bold text-slate-800 text-sm">{m.fatherName || 'Ganga Ram Shrestha'}</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Mother's Full Name</span>
                    <span className="font-bold text-slate-800 text-sm">{m.motherName || 'Laxmi Maya Shrestha'}</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Grandfather's Full Name</span>
                    <span className="font-bold text-slate-800 text-sm">{m.grandfatherName || 'Bhakta Bahadur Shrestha'}</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Spouse Full Name</span>
                    <span className="font-bold text-slate-800 text-sm">{m.spouseName || 'N/A'}</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Number of Financial Dependents</span>
                    <span className="font-bold text-purple-700 text-sm">{m.dependentsCount || 2} Persons</span>
                  </div>
                </div>
                )}
              </div>

              {/* Nominee Detailed Card */}
              <div className="bg-purple-50/70 p-5 rounded-2xl border border-purple-200 space-y-4">
                <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                  <h3 className="font-bold text-purple-900 text-sm flex items-center gap-2">
                    <Heart className="w-4 h-4 text-purple-600" />
                    <span>Registered Legal Nominee (Cooperative Beneficiary)</span>
                  </h3>
                  {isEditing ? (
                    <span className="bg-amber-200 text-amber-900 text-xs px-2.5 py-0.5 rounded-full font-bold">Editing</span>
                  ) : (
                  <span className="bg-purple-200 text-purple-900 text-xs px-2.5 py-0.5 rounded-full font-bold">
                    {m.nomineeSharePct || '100'}% Benefit Allocation
                  </span>
                  )}
                </div>

                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                    <EditField label="Nominee Full Name" value={editData.nomineeName} onChange={v => setField('nomineeName', v)} />
                    <EditField label="Relationship with Member" value={editData.nomineeRelation} onChange={v => setField('nomineeRelation', v)} />
                    <EditField label="Nominee Citizenship No" value={editData.nomineeCitizenshipNo} onChange={v => setField('nomineeCitizenshipNo', v)} />
                    <EditField label="Nominee Contact Phone" value={editData.nomineePhone} onChange={v => setField('nomineePhone', v)} />
                    <div className="sm:col-span-1">
                      <EditField label="Benefit Allocation (%)" value={editData.nomineeSharePct} onChange={v => setField('nomineeSharePct', v)} type="number" />
                    </div>
                  </div>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-purple-200">
                    <span className="text-purple-700 block text-[10px]">Nominee Full Name</span>
                    <span className="font-bold text-slate-800 text-sm">{m.nomineeName || 'N/A'}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-purple-200">
                    <span className="text-purple-700 block text-[10px]">Relationship with Member</span>
                    <span className="font-bold text-slate-800 text-sm">{m.nomineeRelation || 'Spouse'}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-purple-200">
                    <span className="text-purple-700 block text-[10px]">Nominee Citizenship No</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">{m.nomineeCitizenshipNo || '27-01-80-08912'}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-purple-200">
                    <span className="text-purple-700 block text-[10px]">Nominee Contact Phone</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">{m.nomineePhone || 'N/A'}</span>
                  </div>
                </div>
                )}
              </div>
            </div>
          )}

          {/* FINANCIALS & PEP TAB */}
          {activeTab === 'financial' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-600" />
                  <span>Occupation, Employment & Financial Profile</span>
                  {isEditing && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-bold">Editing</span>}
                </h3>

                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <EditField label="Primary Occupation" value={editData.occupation} onChange={v => setField('occupation', v)} />
                    <EditField label="Employer Name / Enterprise" value={editData.employerName} onChange={v => setField('employerName', v)} />
                    <EditField label="Estimated Annual Income Range" value={editData.annualIncome} onChange={v => setField('annualIncome', v)} placeholder="500,000 - 1,000,000 NPR" />
                    <EditField label="Primary Source of Funds" value={editData.sourceOfFunds} onChange={v => setField('sourceOfFunds', v)} />
                    <EditField label="Cooperative Membership Category" value={editData.membershipType} onChange={v => setField('membershipType', v)} />
                  </div>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Primary Occupation</span>
                    <span className="font-bold text-slate-800 text-sm">{m.occupation || 'Business'}</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Employer Name / Enterprise</span>
                    <span className="font-bold text-slate-800 text-sm">{m.employerName || 'Shrestha Enterprises'}</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Estimated Annual Income Range</span>
                    <span className="font-bold text-emerald-700 text-sm">{m.annualIncome || '500,000 - 1,000,000'} NPR</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Primary Source of Funds</span>
                    <span className="font-bold text-slate-800 text-sm">{m.sourceOfFunds || 'Business Profit / Wages'}</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Cooperative Membership Category</span>
                    <span className="font-bold text-emerald-800 text-sm">{m.membershipType} Member</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Registered Branch</span>
                    <span className="font-bold text-slate-800 text-sm">Head Office Branch</span>
                  </div>
                </div>
                )}
              </div>

              {/* Compliance & Anti-Money Laundering (AML) */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>AML / PEP Screening & Cooperative Ethical Declaration</span>
                  {isEditing && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-bold">Editing</span>}
                </h3>

                {isEditing ? (
                  <div className="space-y-4 text-xs">
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white">
                      <span className="font-bold text-slate-800">Politically Exposed Person (PEP) Status:</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" checked={!!editData.isPEP} onChange={() => setField('isPEP', true)} className="accent-emerald-600" /> PEP
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" checked={!editData.isPEP} onChange={() => setField('isPEP', false)} className="accent-emerald-600" /> Non-PEP
                      </label>
                    </div>
                    {editData.isPEP && (
                      <div className="col-span-1">
                        <EditField label="PEP Details" value={editData.pepDetails} onChange={v => setField('pepDetails', v)} placeholder="Describe PEP relationship / risk detail" />
                      </div>
                    )}
                  </div>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className={`p-4 rounded-xl border ${m.isPEP ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'} space-y-2`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Politically Exposed Person (PEP) Status:</span>
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${m.isPEP ? 'bg-rose-200 text-rose-900' : 'bg-emerald-200 text-emerald-900'}`}>
                        {m.isPEP ? 'PEP DETECTED' : 'CLEAR (Non-PEP)'}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      {m.isPEP 
                        ? `Member is flagged under PEP scrutiny. Details: ${m.pepDetails || 'High official relation.'}`
                        : 'Member is verified to have no politically exposed background or high-risk PEP ties.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border bg-emerald-50 border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900">Co-operative Ethical Declaration:</span>
                      <span className="bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-full font-bold text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Verified
                      </span>
                    </div>
                    <p className="text-slate-700">
                      Member has formally agreed to co-op bye-laws, financial ethics, and self-declaration of fund legitimacy.
                    </p>
                  </div>
                </div>
                )}
              </div>
            </div>
          )}

          {/* KYC ARTIFACTS TAB */}
          {activeTab === 'kyc_artifacts' && (
            <div className="space-y-4">
              <input
                type="file"
                ref={uploadFileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-rose-600" />
                    <span>Scanned Identity Documents & Digital Biometrics</span>
                  </h3>
                  <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-300">
                    KYC {m.kycStatus}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Passport Photo */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col items-center justify-between text-center space-y-2">
                    <img 
                      src={resolveMediaUrl(m.photoUrl) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'} 
                      alt="Passport Photo" 
                      className="w-28 h-32 object-cover rounded-lg border border-slate-300 shadow-sm"
                    />
                    <div className="w-full space-y-1">
                      <span className="text-xs font-bold text-slate-800 block">Passport Size Photo</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => triggerFileUpload('passport')}
                          className="flex-1 py-1 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[11px] font-bold transition flex items-center justify-center gap-1"
                        >
                          <Upload className="w-3 h-3 text-emerald-600" />
                          <span>Upload</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Citizenship Front */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col items-center justify-between text-center space-y-2">
                    {m.citizenshipFrontUrl ? (
                      <button
                        type="button"
                        onClick={() => setLightbox({ url: resolveMediaUrl(m.citizenshipFrontUrl) || m.citizenshipFrontUrl!, title: 'Citizenship Card (Front)' })}
                        className="w-full group relative cursor-zoom-in"
                        title="Click to view full size"
                      >
                        <img src={resolveMediaUrl(m.citizenshipFrontUrl)} alt="Citizenship Front" className="w-full h-32 object-cover rounded-lg border border-slate-300 group-hover:brightness-90 transition" />
                        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <span className="bg-white text-slate-800 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                            <Maximize2 className="w-3 h-3" /> View
                          </span>
                        </span>
                      </button>
                    ) : (
                      <div className="w-full h-32 bg-slate-50 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center p-2 text-slate-600">
                        <FileText className="w-8 h-8 text-emerald-600 mb-1" />
                        <span className="text-xs font-bold text-slate-800">Citizenship_Front.jpg</span>
                      </div>
                    )}
                    <div className="w-full space-y-1">
                      <span className="text-xs font-bold text-slate-800 block">Citizenship Card (Front)</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => triggerFileUpload('citizenship_front')}
                          className="flex-1 py-1 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[11px] font-bold transition flex items-center justify-center gap-1"
                        >
                          <Upload className="w-3 h-3 text-emerald-600" />
                          <span>Upload</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Citizenship Back */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col items-center justify-between text-center space-y-2">
                    {m.citizenshipBackUrl ? (
                      <button
                        type="button"
                        onClick={() => setLightbox({ url: resolveMediaUrl(m.citizenshipBackUrl) || m.citizenshipBackUrl!, title: 'Citizenship Card (Back)' })}
                        className="w-full group relative cursor-zoom-in"
                        title="Click to view full size"
                      >
                        <img src={resolveMediaUrl(m.citizenshipBackUrl)} alt="Citizenship Back" className="w-full h-32 object-cover rounded-lg border border-slate-300 group-hover:brightness-90 transition" />
                        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <span className="bg-white text-slate-800 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                            <Maximize2 className="w-3 h-3" /> View
                          </span>
                        </span>
                      </button>
                    ) : (
                      <div className="w-full h-32 bg-slate-50 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center p-2 text-slate-600">
                        <FileText className="w-8 h-8 text-emerald-600 mb-1" />
                        <span className="text-xs font-bold text-slate-800">Citizenship_Back.jpg</span>
                      </div>
                    )}
                    <div className="w-full space-y-1">
                      <span className="text-xs font-bold text-slate-800 block">Citizenship Card (Back)</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => triggerFileUpload('citizenship_back')}
                          className="flex-1 py-1 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[11px] font-bold transition flex items-center justify-center gap-1"
                        >
                          <Upload className="w-3 h-3 text-emerald-600" />
                          <span>Upload</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Signature & Fingerprint */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col items-center justify-between text-center space-y-2">
                    <div className="w-full h-32 bg-slate-50 rounded-lg border border-slate-200 flex flex-col items-center justify-center p-2 text-slate-700">
                      {m.signatureUrl ? (
                        <img src={resolveMediaUrl(m.signatureUrl)} alt="Signature Specimen" className="h-14 object-contain" />
                      ) : (
                        <div className="italic font-serif text-slate-800 text-base font-bold tracking-widest border-b border-slate-400 px-3 pb-1">
                          {m.fullName.split(' ')[0]} {m.fullName.split(' ')[1]?.[0]}.
                        </div>
                      )}
                      <span className="text-[10px] text-emerald-700 font-bold mt-2 flex items-center gap-1">
                        <Fingerprint className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>SHA-256 Fingerprint Matched</span>
                      </span>
                    </div>
                    <div className="w-full space-y-1">
                      <span className="text-xs font-bold text-slate-800 block">Digital Signature & Thumbprint</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => triggerFileUpload('signature')}
                          className="flex-1 py-1 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-bold transition flex items-center justify-center gap-1"
                        >
                          <Upload className="w-3 h-3 text-slate-600" />
                          <span>Upload</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Documents Section */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Additional Documents</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => memberDocsFileRef.current?.click()}
                    disabled={docUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                  >
                    {docUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>{docUploading ? 'Uploading...' : 'Upload Document'}</span>
                  </button>
                  <input
                    ref={memberDocsFileRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleUploadAdditionalDoc}
                  />
                </div>

                {memberDocsLoading ? (
                  <div className="p-6 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-1" />
                    <p className="text-xs">Loading documents...</p>
                  </div>
                ) : memberDocs.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 border border-dashed border-slate-300 rounded-xl">
                    <FileText className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                    <p className="text-xs font-semibold">No additional documents uploaded yet.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Upload supporting documents like citizenship copies, agreements, or certificates.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {memberDocs.map((doc) => (
                      <div key={doc.id} className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {doc.mimeType?.startsWith('image/') ? (
                              <button
                                type="button"
                                onClick={() => setLightbox({ url: resolveMediaUrl(doc.fileUrl) || doc.fileUrl, title: doc.fileName })}
                                className="shrink-0 group relative cursor-zoom-in"
                              >
                                <img src={resolveMediaUrl(doc.fileUrl)} alt={doc.fileName} className="w-14 h-14 object-cover rounded-lg border border-slate-200 group-hover:brightness-90 transition" />
                              </button>
                            ) : (
                              <div className="w-14 h-14 bg-red-50 rounded-lg border border-red-200 flex items-center justify-center shrink-0">
                                <FileText className="w-6 h-6 text-red-500" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate" title={doc.fileName}>{doc.fileName}</p>
                              <p className="text-[10px] text-slate-500">{doc.documentType} {doc.fileSize ? `• ${(doc.fileSize / 1024).toFixed(0)} KB` : ''}</p>
                              <p className="text-[10px] text-slate-400">{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ''}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteMemberDoc(doc.id)}
                            className="shrink-0 p-1 text-slate-400 hover:text-red-500 transition"
                            title="Delete document"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SHARES TAB */}
          {activeTab === 'shares' && (
            <div className="space-y-4">
              {shareLoading ? (
                <div className="p-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                  <RefreshCw className="w-8 h-8 mx-auto text-slate-400 animate-spin mb-2" />
                  <p className="font-semibold text-slate-600">Loading share details...</p>
                </div>
              ) : !shareDetail ? (
                <div className="p-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                  <Share2 className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                  <p className="font-semibold text-slate-700">No share account found for this member.</p>
                </div>
              ) : (
                <>
                  {/* Share Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Share2 className="w-4 h-4 text-blue-600" />
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Total Kitta</span>
                      </div>
                      <p className="text-2xl font-black text-blue-800 font-mono">{shareDetail.account.totalShares}</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Total Capital</span>
                      </div>
                      <p className="text-lg font-black text-emerald-800 font-mono">{formatNPR(shareDetail.account.totalCapital)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-amber-600" />
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Dividend Rate</span>
                      </div>
                      <p className="text-2xl font-black text-amber-800 font-mono">{shareDetail.account.dividendRate}%</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-purple-600" />
                        <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Member Since</span>
                      </div>
                      <p className="text-sm font-bold text-purple-800">{shareDetail.account.createdAt?.split('T')[0] || '—'}</p>
                    </div>
                  </div>

                  {/* Certificate Register */}
                  {shareDetail.panels.certificateRegister.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                          <Award className="w-4 h-4 text-blue-600" />
                          Certificate Register
                        </h4>
                        <button
                          onClick={() => {
                            const rows = shareDetail.panels.certificateRegister.map(c => [
                              c.shareTypeName || '—', c.kittaPrefix, c.formattedRange, c.quantity
                            ]);
                            exportToExcel(
                              `Share_Certificates_${m.memberNo}`,
                              'Share_Certificates',
                              ['Share Type', 'Kitta Prefix', 'Kitta Range', 'Quantity'],
                              rows,
                            );
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                        >
                          <FileSpreadsheet className="w-3 h-3" /> Export
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-2 text-left font-bold text-slate-600">Share Type</th>
                              <th className="px-4 py-2 text-left font-bold text-slate-600">Kitta Prefix</th>
                              <th className="px-4 py-2 text-left font-bold text-slate-600">Kitta Range</th>
                              <th className="px-4 py-2 text-right font-bold text-slate-600">Quantity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shareDetail.panels.certificateRegister.map((c, idx) => (
                              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                                <td className="px-4 py-2 font-semibold text-slate-800">{c.shareTypeName || '—'}</td>
                                <td className="px-4 py-2 font-mono text-slate-600">{c.kittaPrefix || '—'}</td>
                                <td className="px-4 py-2 font-mono font-bold text-blue-700">{c.formattedRange}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-slate-900">{c.quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Share Issuance History */}
                  {shareDetail.panels.issuances.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                          Issuance History
                        </h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-2 text-left font-bold text-slate-600">Voucher</th>
                              <th className="px-4 py-2 text-left font-bold text-slate-600">Date (BS)</th>
                              <th className="px-4 py-2 text-left font-bold text-slate-600">Type</th>
                              <th className="px-4 py-2 text-right font-bold text-slate-600">Kitta</th>
                              <th className="px-4 py-2 text-right font-bold text-slate-600">Amount</th>
                              <th className="px-4 py-2 text-right font-bold text-slate-600">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shareDetail.panels.issuances.slice(0, 10).map((h) => (
                              <tr key={h.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                <td className="px-4 py-2 font-mono text-blue-700">{h.voucherNo}</td>
                                <td className="px-4 py-2 text-slate-600">{h.transactionDateBs}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${h.transactionType === 'Issued' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                    {h.transactionType}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-slate-900">{h.shareQuantity}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-emerald-700">{formatNPR(h.debitAmount || h.creditAmount)}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-slate-900">{formatNPR(h.balanceAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* SAVINGS TAB */}
          {activeTab === 'savings' && (
            <div className="space-y-3">
              {memberSavings.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                  <PiggyBank className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                  <p className="font-semibold text-slate-700">No active savings accounts found for this member.</p>
                </div>
              ) : (
                <>
                  {/* Summary Bar */}
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase">Accounts</span>
                        <p className="text-lg font-black text-emerald-800 font-mono">{memberSavings.length}</p>
                      </div>
                      <div className="w-px h-8 bg-emerald-200" />
                      <div>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase">Total Balance</span>
                        <p className="text-lg font-black text-emerald-800 font-mono">{formatNPR(memberSavings.reduce((sum, s) => sum + s.balance, 0))}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const rows = memberSavings.map(s => [
                          s.accountNo, s.productName, s.interestRate, s.balance, s.minBalance, s.openedDateBS, s.status, s.lastTransactionDateBS
                        ]);
                        exportToExcel(
                          `Savings_Summary_${m.memberNo}`,
                          'Savings_Summary',
                          ['Account No', 'Product', 'Interest Rate %', 'Balance', 'Min Balance', 'Opened Date (BS)', 'Status', 'Last Transaction'],
                          rows,
                        );
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
                    </button>
                  </div>

                  {memberSavings.map(s => (
                    <div key={s.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 transition">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-sm">{s.accountNo}</span>
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">{s.productName}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${s.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>{s.status}</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <span className="text-slate-400 text-[10px]">Balance</span>
                              <p className="font-mono font-bold text-emerald-700 text-sm">{formatNPR(s.balance)}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px]">Interest Rate</span>
                              <p className="font-bold text-amber-700">{s.interestRate}% p.a.</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px]">Min Balance</span>
                              <p className="font-mono font-bold text-slate-700">{formatNPR(s.minBalance)}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px]">Last Transaction</span>
                              <p className="font-bold text-slate-700">{s.lastTransactionDateBS || '—'}</p>
                            </div>
                          </div>
                          {s.maturityDateBS && (
                            <div className="text-[10px] text-slate-500">Maturity: {s.maturityDateBS} BS{s.monthlyInstallment ? ` • Monthly: ${formatNPR(s.monthlyInstallment)}` : ''}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => {
                              setSelectedAccountForPassbook(s);
                              setMemberEditMode(false);
                              setSelectedMemberForDetail(null);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition cursor-pointer text-xs shadow-xs flex items-center gap-1.5"
                          >
                            <Printer className="w-3.5 h-3.5" /> Passbook
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* LOANS TAB */}
          {activeTab === 'loans' && (
            <div className="space-y-3">
              {memberLoans.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                  <Landmark className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                  <p className="font-semibold text-slate-700">No active loan accounts for this member.</p>
                </div>
              ) : (
                <>
                  {/* Summary Bar */}
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-[10px] font-bold text-blue-600 uppercase">Loans</span>
                        <p className="text-lg font-black text-blue-800 font-mono">{memberLoans.length}</p>
                      </div>
                      <div className="w-px h-8 bg-blue-200" />
                      <div>
                        <span className="text-[10px] font-bold text-blue-600 uppercase">Total Outstanding</span>
                        <p className="text-lg font-black text-blue-800 font-mono">{formatNPR(memberLoans.reduce((sum, l) => sum + l.outstandingPrincipal, 0))}</p>
                      </div>
                      <div className="w-px h-8 bg-blue-200" />
                      <div>
                        <span className="text-[10px] font-bold text-blue-600 uppercase">Total EMI</span>
                        <p className="text-lg font-black text-blue-800 font-mono">{formatNPR(memberLoans.reduce((sum, l) => sum + l.monthlyEMI, 0))}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const rows = memberLoans.map(l => [
                          l.loanNo, l.productName, l.approvedAmount, l.outstandingPrincipal, l.interestRate, l.interestMethod, l.monthlyEMI, l.tenureMonths, l.disbursedDateBS, l.nplStatus, l.status
                        ]);
                        exportToExcel(
                          `Loan_Portfolio_${m.memberNo}`,
                          'Loan_Portfolio',
                          ['Loan No', 'Product', 'Approved Amount', 'Outstanding', 'Rate %', 'Method', 'EMI', 'Tenure (Months)', 'Disbursed (BS)', 'NPL Status', 'Status'],
                          rows,
                        );
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
                    </button>
                  </div>

                  {memberLoans.map(l => (
                    <div key={l.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-sm">{l.loanNo}</span>
                            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">{l.productName}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${l.nplStatus === 'Pass' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>{l.nplStatus}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${l.status === 'Disbursed' ? 'bg-amber-50 text-amber-700 border border-amber-200' : l.status === 'Closed' ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>{l.status}</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <span className="text-slate-400 text-[10px]">Approved Amount</span>
                              <p className="font-mono font-bold text-slate-900">{formatNPR(l.approvedAmount)}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px]">Outstanding</span>
                              <p className="font-mono font-bold text-blue-700">{formatNPR(l.outstandingPrincipal)}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px]">Interest Rate</span>
                              <p className="font-bold text-amber-700">{l.interestRate}% ({l.interestMethod})</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px]">Monthly EMI</span>
                              <p className="font-mono font-bold text-slate-900">{formatNPR(l.monthlyEMI)}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <span className="text-slate-400 text-[10px]">Disbursed Date</span>
                              <p className="font-bold text-slate-700">{l.disbursedDateBS} BS</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px]">Tenure</span>
                              <p className="font-bold text-slate-700">{l.tenureMonths} months</p>
                            </div>
                            {l.collateralType && (
                              <div>
                                <span className="text-slate-400 text-[10px]">Collateral</span>
                                <p className="font-bold text-slate-700">{l.collateralType} ({formatNPR(l.collateralValuation)})</p>
                              </div>
                            )}
                            {l.guarantorName && (
                              <div>
                                <span className="text-slate-400 text-[10px]">Guarantor</span>
                                <p className="font-bold text-slate-700">{l.guarantorName}</p>
                              </div>
                            )}
                          </div>
                          {l.daysOverdue > 0 && (
                            <div className="flex items-center gap-2 text-[10px]">
                              <AlertCircle className="w-3 h-3 text-rose-500" />
                              <span className="text-rose-600 font-bold">{l.daysOverdue} days overdue</span>
                              <span className="text-slate-400">•</span>
                              <span className="text-rose-600">Overdue: {formatNPR(l.overdueAmount)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => {
                              openTab('loan_detail', `Loan - ${l.loanNo}`, 'Landmark', l.id);
                              setMemberEditMode(false);
                              setSelectedMemberForDetail(null);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition cursor-pointer text-xs shadow-xs flex items-center gap-1.5"
                          >
                            <Landmark className="w-3.5 h-3.5" /> Repay EMI
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

        </div>

        {/* Edit Mode Footer */}
        {isEditing && (
          <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5 text-amber-600" />
              <span>Editing member profile — changes are applied when you click <b>Update Member</b>.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Saving...' : 'Update Member'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Document Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-white rounded-t-xl">
              <span className="text-slate-800 font-bold text-sm">{lightbox.title}</span>
              <div className="flex items-center gap-2">
                <a
                  href={lightbox.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition"
                  onClick={e => e.stopPropagation()}
                >
                  Download
                </a>
                <button
                  onClick={() => setLightbox(null)}
                  className="p-1.5 text-slate-600 hover:text-slate-800 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Image */}
            <div className="bg-slate-50 rounded-b-xl overflow-auto flex items-center justify-center" style={{ maxHeight: 'calc(90vh - 52px)' }}>
              <img
                src={lightbox.url}
                alt={lightbox.title}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
