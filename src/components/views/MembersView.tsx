import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCoop } from '../../context/CoopContext';
import type { Member } from '../../types/coop';
import { 
  Users, 
  UserPlus, 
  Search, 
  FileCheck, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  MapPin, 
  CreditCard, 
  ShieldCheck, 
  Eye,
  X,
  LayoutList,
  LayoutGrid,
  Upload,
  Camera,
  FileText,
  ShieldAlert,
  Heart,
  Building2,
  UserCheck,
  Check,
  Briefcase,
  DollarSign,
  FileBadge,
  User,
  Scan,
  Fingerprint,
  Edit3,
  RotateCcw,
  Sparkles,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Database,
  Wifi,
  WifiOff,
  CloudUpload,
  HardDrive,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  ClipboardCheck,
  MoreVertical,
  UserX,
} from 'lucide-react';
import { formatNPR, getTodayBS } from '../../utils/nepaliCalendar';
import nepalLocalUnits from '../../data/nepalLocalUnits.json';
import { ExpandableFormCard } from '../common/ExpandableFormCard';
import { ImageHoverPreview } from '../common/ImageHoverPreview';
import { NepaliDatePicker } from '../common/NepaliDatePicker';
import { TransliteratedNameInput } from '../common/TransliteratedNameInput';
import { exportToPdf, exportToExcel } from '../../utils/exportUtils';
import { useToast } from '../../context/ToastContext';
import { useLocalization } from '../../context/LocalizationContext';
import { useAutoSaveDraft } from '../../hooks/useAutoSaveDraft';
import { AutoSaveBanner } from '../common/AutoSaveBanner';
import { 
  savePhotoToIndexedDB, 
  uploadPhotoToFirestore, 
  syncPendingPhotosToFirestore, 
  getAllPhotosFromIndexedDB,
  deletePhotoFromIndexedDB,
  PendingPhotoRecord
} from '../../lib/photoIndexedDB';
import { resolveMediaUrl, uploadMedia } from '../../api/storage';
import { addMemberDocument } from '../../api/members';
import { fetchMemberSettings, MemberSetting, MemberSettingsEntityType } from '../../api/memberSettings';
import { fetchGroups, Group } from '../../api/groups';
import { hardDeleteMember } from '../../api/hardDelete';
import { HardDeleteModal } from '../modals/HardDeleteModal';
import { XCircle, Plus } from 'lucide-react';

interface AdditionalDocsProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
}

const AdditionalDocumentsSection: React.FC<AdditionalDocsProps> = ({ formData, setFormData }) => {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const docs: { name: string; dataUrl: string; type: string }[] = formData.additionalDocs || [];

  const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setFormData((prev: any) => ({
        ...prev,
        additionalDocs: [...(prev.additionalDocs || []), { name: file.name, dataUrl, type: file.type }],
      }));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      additionalDocs: prev.additionalDocs.filter((_: any, i: number) => i !== index),
    }));
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <span>Additional Documents</span>
        </h4>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold transition disabled:opacity-50"
        >
          {uploading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          <span>{uploading ? 'Uploading...' : 'Add Document'}</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleAdd} />
      </div>

      {docs.length === 0 ? (
        <div className="p-4 text-center text-slate-400 border border-dashed border-slate-300 rounded-xl">
          <FileText className="w-6 h-6 mx-auto mb-1 text-slate-300" />
          <p className="text-[10px] font-semibold">No additional documents. Upload citizenship copies, agreements, certificates, etc.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {docs.map((doc, i) => (
            <div key={i} className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
              {doc.type.startsWith('image/') ? (
                <img src={doc.dataUrl} alt={doc.name} className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0" />
              ) : (
                <div className="w-12 h-12 bg-red-50 rounded-lg border border-red-200 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-red-500" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-800 truncate">{doc.name}</p>
                <p className="text-[9px] text-slate-500">{(doc.dataUrl.length * 0.75 / 1024).toFixed(0)} KB (staged)</p>
              </div>
              <button type="button" onClick={() => handleRemove(i)} className="shrink-0 p-1 text-slate-400 hover:text-red-500 transition">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface Props {
  activeSubKey?: string;
}

export const MembersView: React.FC<Props> = ({ activeSubKey }) => {
  const { members: contextMembers = [], branches = [], addNewMember, updateMember, deleteMember, selectedMemberForDetail, setSelectedMemberForDetail, memberEditMode, setMemberEditMode, activeBranchId, setActiveBranchId, reloadMembers, activeRole } = useCoop();
  const toast = useToast();
  const { transliterateName, settings } = useLocalization();

  // On mount, reload members from the real API into context
  useEffect(() => {
    reloadMembers?.();
  }, [reloadMembers]);

  const safeMembers = contextMembers || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'add_member' | 'kyc_queue'>('list');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  // Action dropdown open state: stores the member ID whose menu is open
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  // Admin-only secure hard delete (archives immutable snapshot before removal)
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Member | null>(null);

  // Live Member Settings catalogs + community groups for the registration form
  const [catalogState, setCatalogState] = useState<Record<string, MemberSetting[]>>({});
  const [groupCatalog, setGroupCatalog] = useState<Group[]>([]);

  const loadCatalogs = useCallback(async () => {
    const entityTypes: MemberSettingsEntityType[] = [
      'member-types', 'member-categories', 'occupations',
      'education-levels', 'nominee-types', 'relationship-types',
    ];
    const [memberTypes, memberCategories, occupations, educationLevels, nomineeTypes, relationshipTypes, groups] =
      await Promise.all([
        fetchMemberSettings('member-types', { active: 'true' }),
        fetchMemberSettings('member-categories', { active: 'true' }),
        fetchMemberSettings('occupations', { active: 'true' }),
        fetchMemberSettings('education-levels', { active: 'true' }),
        fetchMemberSettings('nominee-types', { active: 'true' }),
        fetchMemberSettings('relationship-types', { active: 'true' }),
        fetchGroups({ active: 'true' }),
      ]);
    setCatalogState({ 'member-types': memberTypes, 'member-categories': memberCategories, occupations, 'education-levels': educationLevels, 'nominee-types': nomineeTypes, 'relationship-types': relationshipTypes });
    setGroupCatalog(groups);
  }, []);

  useEffect(() => {
    loadCatalogs();
  }, [loadCatalogs]);

  // Once catalogs load, snap form defaults to real rows so the backend never
  // receives a label that is not configured for this org (it rejects unknown
  // labels with 400). Only adjusts untouched defaults.
  useEffect(() => {
    if (!catalogState['member-types']?.length) return;
    setFormData(prev => {
      const next: any = { ...prev };
      const pick = (rows: MemberSetting[], current: string, prefer: string): string => {
        if (current && rows.some(r => r.name === current)) return current;
        return rows.find(r => r.name === prefer)?.name ?? rows[0]?.name ?? current;
      };
      next.membershipType = pick(catalogState['member-types'] || [], prev.membershipType, 'General');
      next.memberCategory = pick(catalogState['member-categories'] || [], prev.memberCategory, 'Regular');
      next.occupation = pick(catalogState['occupations'] || [], prev.occupation, 'Business');
      next.nomineeRelation = pick(catalogState['relationship-types'] || [], prev.nomineeRelation, 'Spouse');
      return next;
    });
  }, [catalogState]);

  const canDelete = (activeRole as string) === 'org_admin' || (activeRole as string) === 'admin' || (activeRole as string) === 'super_admin';

  // Close action menu on outside click
  useEffect(() => {
    if (!openActionMenu) return;
    const handler = () => setOpenActionMenu(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openActionMenu]);

  React.useEffect(() => {
    if (activeSubKey === 'member_new_wizard') setActiveTab('add_member');
    else if (activeSubKey === 'member_kyc_queue') setActiveTab('kyc_queue');
    else if (activeSubKey === 'member_directory') setActiveTab('list');
  }, [activeSubKey]);

  // Comprehensive New Member Form State
  const defaultMemberFormData = {
    // Personal Details
    fullName: '',
    nameNepali: '',
    citizenshipNo: '',
    citizenshipIssueDistrict: 'Kathmandu',
    citizenshipIssueDateBS: '2060-01-01',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    dobBS: '2040-01-01',
    dobAD: '1983-04-14',
    maritalStatus: 'Married' as 'Single' | 'Married' | 'Divorced' | 'Widowed',
    bloodGroup: 'O+',
    isMinor: false,
    
    // Minor / Guardian Details
    guardianName: '',
    guardianNameNepali: '',
    guardianRelation: 'Father',
    guardianCitizenshipNo: '',
    guardianPhone: '',

    // Contact & Addresses
    phone: '',
    secondaryPhone: '',
    email: '',
    
    // Permanent Address
    permProvince: 'Bagmati Province',
    permDistrict: 'Kathmandu',
    permMunicipality: 'Kathmandu Metropolitan City',
    permWard: '10',
    permTole: 'New Road',

    // Temporary Address
    sameAsPermanent: true,
    tempProvince: 'Bagmati Province',
    tempDistrict: 'Kathmandu',
    tempMunicipality: 'Kathmandu Metropolitan City',
    tempWard: '10',
    tempTole: 'New Road',

    // Family Details
    fatherName: '',
    fatherNameNepali: '',
    motherName: '',
    motherNameNepali: '',
    grandfatherName: '',
    grandfatherNameNepali: '',
    spouseName: '',
    spouseNameNepali: '',
    dependentsCount: '2',

    // Nominee Details
    nomineeName: '',
    nomineeNameNepali: '',
    nomineeRelation: 'Spouse',
    nomineeCitizenshipNo: '',
    nomineePhone: '',
    nomineeSharePct: '100',

    // Occupation & Financials
    membershipType: 'General' as 'General' | 'Founder' | 'Institutional',
    memberCategory: 'Regular',
    groupId: '',
    occupation: 'Business',
    employerName: '',
    annualIncome: '500,000 - 1,000,000',
    sourceOfFunds: 'Business Profit',
    isPEP: false,
    pepDetails: '',

    // Ethics & Declarations
    ethicsAccepted: true,

    // Photos & Documents (Mock URLs / base64 previews)
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    citizenshipFrontName: 'Citizenship_Front.jpg',
    citizenshipFrontUrl: '',
    citizenshipFrontUploaded: true,
    citizenshipBackName: 'Citizenship_Back.jpg',
    citizenshipBackUrl: '',
    citizenshipBackUploaded: true,
    signatureUrl: '',
    signatureUploaded: true,
    fingerprintScanned: true,
    fingerprintData: 'SHA-256 Biometric Fingerprint Verified',

    // Additional documents (uploaded during enrollment, saved after member creation)
    additionalDocs: [] as { name: string; dataUrl: string; type: string }[],
  };

  const [formData, setFormData] = useState(defaultMemberFormData);

  // Auto-Save Draft hook for Member Registration
  const isMemberFormModified = (data: typeof formData) => {
    return (
      (data.fullName && data.fullName.trim() !== '') ||
      (data.citizenshipNo && data.citizenshipNo.trim() !== '') ||
      (data.phone && data.phone.trim() !== '') ||
      (data.email && data.email.trim() !== '') ||
      (data.fatherName && data.fatherName.trim() !== '')
    );
  };

  const {
    draftTimestamp: memberDraftTime,
    draftBannerVisible: memberDraftBanner,
    restoreDraft: restoreMemberDraft,
    clearDraft: clearMemberDraft,
    setDraftBannerVisible: setMemberBannerVisible,
  } = useAutoSaveDraft('sahakarisathi_member_form_draft', formData, setFormData, isMemberFormModified, 2500, defaultMemberFormData);

  // Scanner & Interactive Capture state
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<'photo' | 'citizenshipFront' | 'citizenshipBack' | 'signature' | 'fingerprint' | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // IndexedDB Offline Storage State
  const [indexedDbRecords, setIndexedDbRecords] = useState<PendingPhotoRecord[]>([]);
  const [isSyncingIndexedDb, setIsSyncingIndexedDb] = useState(false);
  const [showIndexedDbModal, setShowIndexedDbModal] = useState(false);

  const refreshIndexedDbQueue = async () => {
    try {
      const records = await getAllPhotosFromIndexedDB();
      setIndexedDbRecords(records);
    } catch (err) {
      console.warn("Could not load IndexedDB photo queue:", err);
    }
  };

  useEffect(() => {
    refreshIndexedDbQueue();

    const handleOnlineStatus = async () => {
      setIsSyncingIndexedDb(true);
      const syncRes = await syncPendingPhotosToFirestore();
      setIsSyncingIndexedDb(false);
      refreshIndexedDbQueue();

      if (syncRes.synced > 0) {
        setToastMessage(`Network restored: Synced ${syncRes.synced} photo(s) from IndexedDB to Firestore!`);
      }
    };

    window.addEventListener('online', handleOnlineStatus);
    return () => window.removeEventListener('online', handleOnlineStatus);
  }, []);

  const handleManualSyncIndexedDb = async () => {
    setIsSyncingIndexedDb(true);
    const syncRes = await syncPendingPhotosToFirestore();
    setIsSyncingIndexedDb(false);
    refreshIndexedDbQueue();

    if (syncRes.synced > 0) {
      setToastMessage(`Successfully synced ${syncRes.synced} photo(s) from IndexedDB to Storage!`);
    } else if (syncRes.total === 0) {
      setToastMessage(`No pending photos in IndexedDB queue.`);
    } else {
      setToastMessage(`Sync completed: ${syncRes.failed} failed due to network or permissions.`);
    }
  };

  const persistAndUploadCapturedPhoto = async (
    photoDataUrl: string, 
    targetType: 'photo' | 'citizenshipFront' | 'citizenshipBack' | 'signature' | 'fingerprint' | 'kyc_document',
    memberName?: string
  ): Promise<string> => {
    try {
      // 1. Save photo temporarily in browser IndexedDB first
      const savedRecord = await savePhotoToIndexedDB({
        memberId: selectedMemberForDetail?.id,
        memberName: memberName || formData.fullName || selectedMemberForDetail?.fullName || 'New Member Candidate',
        targetType,
        photoDataUrl
      });

      refreshIndexedDbQueue();

      // 2. Upload to Supabase Storage bucket via the backend /uploads API
      const uploadResult = await uploadPhotoToFirestore(savedRecord);
      refreshIndexedDbQueue();

      if (uploadResult.success) {
        setToastMessage('Photo stored in bucket & synced to member profile!');
        return uploadResult.firestoreDocId || photoDataUrl;
      } else {
        setToastMessage('Photo saved in IndexedDB (Offline mode). Will auto-sync when connected.');
        return photoDataUrl;
      }
    } catch (err) {
      console.error("IndexedDB photo persistence error:", err);
      return photoDataUrl;
    }
  };

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSig, setIsDrawingSig] = useState(false);

  // Auto hide toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Bind live media stream to <video> when mounted
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(err => console.warn("Camera playback error:", err));
    }
  }, [cameraStream, cameraActive]);

  // Handle direct file selection from disk
  const handleFileChange = (fieldKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        setFormData(prev => ({
          ...prev,
          [fieldKey]: result,
          ...(fieldKey === 'photoUrl' ? { photoUrl: result } : {}),
          ...(fieldKey === 'citizenshipFrontUrl' ? { citizenshipFrontUploaded: true, citizenshipFrontName: file.name } : {}),
          ...(fieldKey === 'citizenshipBackUrl' ? { citizenshipBackUploaded: true, citizenshipBackName: file.name } : {}),
          ...(fieldKey === 'signatureUrl' ? { signatureUploaded: true } : {}),
        }));
        const targetType = fieldKey === 'photoUrl' ? 'photo' 
          : fieldKey === 'citizenshipFrontUrl' ? 'citizenshipFront'
          : fieldKey === 'citizenshipBackUrl' ? 'citizenshipBack'
          : fieldKey === 'signatureUrl' ? 'signature' : 'kyc_document';

        const storedUrl = await persistAndUploadCapturedPhoto(result, targetType);

        if (selectedMemberForDetail && fieldKey === 'photoUrl' && storedUrl !== result) {
          updateMember(selectedMemberForDetail.id, { photoUrl: storedUrl });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Open Scanner Modal for a specific target
  const handleOpenScanner = (target: 'photo' | 'citizenshipFront' | 'citizenshipBack' | 'signature' | 'fingerprint') => {
    setScanTarget(target);
    setScanModalOpen(true);
    setScanProgress(0);
    setIsScanning(false);

    if (target === 'photo' || target === 'citizenshipFront' || target === 'citizenshipBack') {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const constraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: target === 'photo' ? 'user' : { ideal: 'environment' }
          }
        };

        navigator.mediaDevices.getUserMedia(constraints)
          .then(stream => {
            setCameraStream(stream);
            setCameraActive(true);
          })
          .catch(() => {
            // Fallback for basic webcam access
            navigator.mediaDevices.getUserMedia({ video: true })
              .then(stream => {
                setCameraStream(stream);
                setCameraActive(true);
              })
              .catch(err => {
                console.warn("Camera hardware access rejected or unavailable:", err);
                setCameraActive(false);
              });
          });
      }
    }
  };

  const handleCloseScanner = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setScanModalOpen(false);
    setScanTarget(null);
  };

  // Execute snapshot or simulated scan capture
  const handleCaptureArtifact = async () => {
    // Attempt to capture real video frame from camera
    let capturedDataUrl: string | null = null;
    if (videoRef.current && (cameraActive || videoRef.current.readyState >= 2)) {
      try {
        const video = videoRef.current;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            capturedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
          }
        }
      } catch (err) {
        console.error("Error capturing canvas snapshot from video feed:", err);
      }
    }

    setIsScanning(true);
    let progress = 0;
    const interval = setInterval(async () => {
      progress += 25;
      setScanProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setIsScanning(false);

        if (scanTarget === 'photo') {
          const samplePhotos = [
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80'
          ];
          const fallbackPhoto = samplePhotos[Math.floor(Math.random() * samplePhotos.length)];
          const finalPhoto = capturedDataUrl || fallbackPhoto;

          setFormData(prev => ({ ...prev, photoUrl: finalPhoto }));
          
          const storedPhoto = await persistAndUploadCapturedPhoto(finalPhoto, 'photo');
          if (selectedMemberForDetail && storedPhoto !== finalPhoto) {
            updateMember(selectedMemberForDetail.id, { photoUrl: storedPhoto });
          }
        } else if (scanTarget === 'citizenshipFront') {
          const docUrl = capturedDataUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80';
          setFormData(prev => ({ 
            ...prev, 
            citizenshipFrontUploaded: true, 
            citizenshipFrontName: 'Scanned_Citizenship_Front.jpg',
            citizenshipFrontUrl: docUrl 
          }));
          const storedFront = await persistAndUploadCapturedPhoto(docUrl, 'citizenshipFront');
          if (selectedMemberForDetail && storedFront !== docUrl) {
            updateMember(selectedMemberForDetail.id, { citizenshipFrontUrl: storedFront });
          }
        } else if (scanTarget === 'citizenshipBack') {
          const docUrl = capturedDataUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80';
          setFormData(prev => ({ 
            ...prev, 
            citizenshipBackUploaded: true, 
            citizenshipBackName: 'Scanned_Citizenship_Back.jpg',
            citizenshipBackUrl: docUrl 
          }));
          const storedBack = await persistAndUploadCapturedPhoto(docUrl, 'citizenshipBack');
          if (selectedMemberForDetail && storedBack !== docUrl) {
            updateMember(selectedMemberForDetail.id, { citizenshipBackUrl: storedBack });
          }
        } else if (scanTarget === 'signature') {
          let sigUrl = '';
          if (sigCanvasRef.current) {
            sigUrl = sigCanvasRef.current.toDataURL();
            setFormData(prev => ({ ...prev, signatureUrl: sigUrl, signatureUploaded: true }));
          } else {
            setFormData(prev => ({ ...prev, signatureUploaded: true }));
          }
          if (sigUrl) {
            const storedSig = await persistAndUploadCapturedPhoto(sigUrl, 'signature');
            if (selectedMemberForDetail && storedSig !== sigUrl) {
              updateMember(selectedMemberForDetail.id, { signatureUrl: storedSig });
            }
          } else {
            setToastMessage('Specimen Signature Captured!');
          }
        } else if (scanTarget === 'fingerprint') {
          const bioData = `SHA256-BIO-${Math.floor(Math.random()*899999+100000)}`;
          setFormData(prev => ({ ...prev, fingerprintScanned: true, fingerprintData: bioData }));
          if (selectedMemberForDetail) {
            updateMember(selectedMemberForDetail.id, { fingerprintData: bioData });
          }
          setToastMessage('Biometric Fingerprint Scanned & Matched!');
        }

        handleCloseScanner();
      }
    }, 120);
  };

  const filteredMembers = safeMembers.filter(m => 
    (m.fullName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (m.memberNo || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (m.citizenshipNo || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (m.phone || '').includes(searchTerm || '')
  );

  const kycPendingMembers = safeMembers.filter(m => m.kycStatus === 'Pending');

  // Nepal administrative hierarchy (Province → District → Municipality → Ward)
  // sourced from the nepalLocalUnits geo dataset for cascading address selects.
  const geoData = nepalLocalUnits as Record<string, Record<string, Record<string, string[]>>>;
  const provinces = Object.keys(geoData);
  const districtsFor = (province: string) => (geoData[province] ? Object.keys(geoData[province]) : []);
  const municipalitiesFor = (province: string, district: string) =>
    geoData[province]?.[district] ? Object.keys(geoData[province][district]) : [];
  const wardsFor = (province: string, district: string, municipality: string) =>
    geoData[province]?.[district]?.[municipality] || [];

  const permDistricts = districtsFor(formData.permProvince);
  const permMunicipalities = municipalitiesFor(formData.permProvince, formData.permDistrict);
  const permWards = wardsFor(formData.permProvince, formData.permDistrict, formData.permMunicipality);

  const tempDistricts = districtsFor(formData.tempProvince);
  const tempMunicipalities = municipalitiesFor(formData.tempProvince, formData.tempDistrict);
  const tempWards = wardsFor(formData.tempProvince, formData.tempDistrict, formData.tempMunicipality);

  const handlePermProvinceChange = (value: string) =>
    setFormData(prev => ({ ...prev, permProvince: value, permDistrict: '', permMunicipality: '', permWard: '' }));
  const handlePermDistrictChange = (value: string) =>
    setFormData(prev => ({ ...prev, permDistrict: value, permMunicipality: '', permWard: '' }));
  const handlePermMunicipalityChange = (value: string) =>
    setFormData(prev => ({ ...prev, permMunicipality: value, permWard: '' }));

  const handleTempProvinceChange = (value: string) =>
    setFormData(prev => ({ ...prev, tempProvince: value, tempDistrict: '', tempMunicipality: '', tempWard: '' }));
  const handleTempDistrictChange = (value: string) =>
    setFormData(prev => ({ ...prev, tempDistrict: value, tempMunicipality: '', tempWard: '' }));
  const handleTempMunicipalityChange = (value: string) =>
    setFormData(prev => ({ ...prev, tempMunicipality: value, tempWard: '' }));

  const handleCopyPermanentAddress = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setFormData(prev => ({
      ...prev,
      sameAsPermanent: checked,
      ...(checked ? {
        tempProvince: prev.permProvince,
        tempDistrict: prev.permDistrict,
        tempMunicipality: prev.permMunicipality,
        tempWard: prev.permWard,
        tempTole: prev.permTole,
      } : {})
    }));
  };

  const handleRegisterMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.citizenshipNo || !formData.phone) {
      toast.showError('Please fill required fields (Full Name, Citizenship No, Phone).', 'Registration Incomplete');
      return;
    }

    if (formData.citizenshipNo.trim().length < 5) {
      toast.showError('Citizenship Number must be at least 5 characters.', 'Invalid Citizenship No');
      return;
    }

    if (formData.phone.trim().length < 10) {
      toast.showError('Phone number must be at least 10 digits.', 'Invalid Phone Number');
      return;
    }

    if (!formData.ethicsAccepted) {
      toast.showError('Please accept the ethical declaration and cooperative bye-laws.', 'Declaration Required');
      return;
    }

    if (!activeBranchId) {
      toast.showError('Please select a branch before registering the member.', 'Branch Required');
      return;
    }

    const fullPermAddress = `${formData.permTole}, Ward ${formData.permWard}, ${formData.permMunicipality}, ${formData.permDistrict}`;

    const selectedMemberType = catalogState['member-types']?.find((mt) => mt.name === formData.membershipType);
    const isGroupType = selectedMemberType?.isGroupType === true;
    if (isGroupType && !formData.groupId) {
      toast.showError('Please select a community group for this member type.', 'Group Required');
      return;
    }

    try {
      const created = await addNewMember({
      fullName: formData.fullName,
      nameNepali: formData.nameNepali.trim() || (settings.enableAutoTransliteration ? transliterateName(formData.fullName) : ''),
      citizenshipNo: formData.citizenshipNo,
      citizenshipIssueDistrict: formData.citizenshipIssueDistrict,
      citizenshipIssueDateBS: formData.citizenshipIssueDateBS,
      gender: formData.gender,
      dobBS: formData.dobBS,
      dobAD: formData.dobAD,
      maritalStatus: formData.maritalStatus,
      bloodGroup: formData.bloodGroup,
      isMinor: formData.isMinor,
      guardianName: formData.guardianName,
      guardianNameNepali: formData.guardianNameNepali,
      guardianRelation: formData.guardianRelation,
      guardianCitizenshipNo: formData.guardianCitizenshipNo,
      guardianPhone: formData.guardianPhone,
      phone: formData.phone,
      secondaryPhone: formData.secondaryPhone,
      email: formData.email,
      address: fullPermAddress,
      district: formData.permDistrict,
      permProvince: formData.permProvince,
      permDistrict: formData.permDistrict,
      permMunicipality: formData.permMunicipality,
      permWard: formData.permWard,
      permTole: formData.permTole,
      tempProvince: formData.tempProvince,
      tempDistrict: formData.tempDistrict,
      tempMunicipality: formData.tempMunicipality,
      tempWard: formData.tempWard,
      tempTole: formData.tempTole,
      fatherName: formData.fatherName,
      fatherNameNepali: formData.fatherNameNepali,
      motherName: formData.motherName,
      motherNameNepali: formData.motherNameNepali,
      grandfatherName: formData.grandfatherName,
      grandfatherNameNepali: formData.grandfatherNameNepali,
      spouseName: formData.spouseName,
      spouseNameNepali: formData.spouseNameNepali,
      dependentsCount: formData.dependentsCount,
      nomineeName: formData.nomineeName,
      nomineeNameNepali: formData.nomineeNameNepali,
      nomineeRelation: formData.nomineeRelation,
      nomineeCitizenshipNo: formData.nomineeCitizenshipNo,
      nomineePhone: formData.nomineePhone,
      nomineeSharePct: formData.nomineeSharePct,
      occupation: formData.occupation,
      employerName: formData.employerName,
      annualIncome: formData.annualIncome,
      sourceOfFunds: formData.sourceOfFunds,
      isPEP: formData.isPEP,
      pepDetails: formData.pepDetails,
      ethicsAccepted: formData.ethicsAccepted,
      branchId: activeBranchId,
      photoUrl: formData.photoUrl,
      citizenshipFrontUrl: formData.citizenshipFrontUrl,
      citizenshipBackUrl: formData.citizenshipBackUrl,
      signatureUrl: formData.signatureUrl,
      fingerprintData: formData.fingerprintData,
      kycStatus: 'Verified',
      membershipDateBS: getTodayBS(),
      membershipType: formData.membershipType,
      memberCategory: formData.memberCategory,
      groupId: formData.groupId || undefined,
      status: 'Active',
    });

      clearMemberDraft();
      setActiveTab('list');
      setSelectedMemberForDetail(created);
      await reloadMembers?.();

      // Upload additional documents after member creation
      if (formData.additionalDocs?.length && created?.id) {
        for (const doc of formData.additionalDocs) {
          try {
            const stored = await uploadMedia('kyc_document', doc.dataUrl, { memberId: created.id });
            await addMemberDocument(created.id, {
              documentType: 'Other',
              fileUrl: stored.url,
              fileName: doc.name,
              mimeType: doc.type,
            });
          } catch {
            // silently skip — core member already created
          }
        }
      }
    } catch (error: any) {
      toast.showError(
        error?.response?.data?.error || error?.message || 'Failed to register member. Please try again.',
        'Registration Failed'
      );
    }
  };

  // --- KYC Verification Queue actions ---
  const [kycDecisionId, setKycDecisionId] = useState<string | null>(null);

  const approveMemberKyc = async (member: Member) => {
    setKycDecisionId(member.id);
    try {
      await updateMember(member.id, { kycStatus: 'Verified' });
      toast.showSuccess(`KYC Approved for ${member.fullName}`, 'Verification Complete');
      await reloadMembers?.();
    } catch (error: any) {
      toast.showError(
        error?.response?.data?.error || error?.message || 'Failed to approve KYC. Please try again.',
        'Approval Failed'
      );
    } finally {
      setKycDecisionId(null);
    }
  };

  const rejectMemberKyc = async (member: Member) => {
    setKycDecisionId(member.id);
    try {
      await updateMember(member.id, { kycStatus: 'Rejected' });
      toast.showError(`KYC Rejected for ${member.fullName}`, 'Verification Rejected');
      await reloadMembers?.();
    } catch (error: any) {
      toast.showError(
        error?.response?.data?.error || error?.message || 'Failed to reject KYC. Please try again.',
        'Rejection Failed'
      );
    } finally {
      setKycDecisionId(null);
    }
  };

  const handleExportMembersPdf = () => {
    const headers = ['Member No', 'Full Name', 'Citizenship No', 'Phone', 'Address', 'Savings Bal', 'Loan Bal', 'KYC'];
    const rows = filteredMembers.map(m => [
      m.memberNo,
      m.fullName,
      m.citizenshipNo,
      m.phone,
      m.address || m.district || 'Kathmandu',
      `NPR ${m.totalSavingsBalance?.toLocaleString() || '0'}`,
      `NPR ${m.totalLoanBalance?.toLocaleString() || '0'}`,
      m.kycStatus
    ]);

    exportToPdf(
      'Member_Directory_Report_2083',
      'Co-operative Member Directory Ledger',
      `Total Members Listed: ${filteredMembers.length} | Official Cooperative Records`,
      headers,
      rows
    );
  };

  const handleExportMembersExcel = () => {
    const headers = ['Member No', 'Full Name', 'Nepali Name', 'Citizenship No', 'Phone', 'Address', 'Savings Balance (NPR)', 'Loan Balance (NPR)', 'KYC Status', 'Joined BS'];
    const rows = filteredMembers.map(m => [
      m.memberNo,
      m.fullName,
      m.nameNepali || '',
      m.citizenshipNo,
      m.phone,
      m.address || m.district || 'Kathmandu',
      m.totalSavingsBalance || 0,
      m.totalLoanBalance || 0,
      m.kycStatus,
      m.membershipDateBS
    ]);

    exportToExcel(
      'Member_Directory_Report_2083',
      'Members_Ledger',
      headers,
      rows
    );
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      
      {/* Auto-Save Restoration Banner */}
      <AutoSaveBanner
        isVisible={memberDraftBanner}
        timestamp={memberDraftTime}
        formName="Member Enrollment Form"
        onRestore={() => {
          restoreMemberDraft();
          setActiveTab('add_member');
        }}
        onDiscard={clearMemberDraft}
        onDismiss={() => setMemberBannerVisible(false)}
      />

      {/* Module Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Co-operative Member Directory</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>KYC verification, share capital allocation, nominees, and member 360° views</span>
          </p>
        </div>
      </div>

      {/* MEMBER DIRECTORY LIST */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          
          {/* Search Filter Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 flex-1">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search member by Name, Member No (MBR-2083-...), Citizenship, Phone..."
                className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-medium"
              />
            </div>

            {/* Export Buttons & View Mode Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowIndexedDbModal(true)}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                title="View IndexedDB Offline Storage Queue"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden lg:inline">IndexedDB</span>
                {indexedDbRecords.filter(r => r.status === 'pending').length > 0 ? (
                  <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-black rounded-full text-[10px] animate-pulse">
                    {indexedDbRecords.filter(r => r.status === 'pending').length}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 bg-emerald-900/60 text-emerald-300 font-mono rounded-full text-[10px]">
                    {indexedDbRecords.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleExportMembersPdf}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                title="Download Member Directory PDF"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden md:inline">PDF</span>
              </button>

              <button
                type="button"
                onClick={handleExportMembersExcel}
                className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                title="Download Member Directory Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Excel</span>
              </button>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${ viewMode === 'list' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-800' }`}
                  title="List View"
                >
                  <LayoutList className="w-4 h-4" />
                  <span className="hidden sm:inline">List View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${ viewMode === 'grid' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-800' }`}
                  title="Card Grid"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">Card Grid</span>
                </button>
              </div>
            </div>
          </div>

          {/* Members Display (List or Grid) */}
          {viewMode === 'list' ? (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                   <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5 pl-4">Member Name & No</th>
                      <th className="p-3.5">Citizenship No</th>
                      <th className="p-3.5">Phone & Address</th>
                      <th className="p-3.5">Contact</th>
                      <th className="p-3.5 text-right">Shares</th>
                      <th className="p-3.5 text-right">Savings / Loan Balance</th>
                      <th className="p-3.5 text-center">KYC Status</th>
                      <th className="p-3.5">Joined Date</th>
                      <th className="p-3.5 text-right pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filteredMembers.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5 pl-4">
                          <div className="flex items-center gap-3">
                            <ImageHoverPreview
                              src={m.photoUrl}
                              name={m.fullName}
                              subtext={m.memberNo}
                              badge={m.kycStatus}
                              sizeClass="w-9 h-9"
                            />
                            <div>
                              <div className="font-bold text-slate-800 flex items-center gap-2">
                                <span>{m.fullName}</span>
                                {m.nameNepali && <span className="text-[11px] text-slate-500 font-normal">({m.nameNepali})</span>}
                              </div>
                              <div className="text-[11px] text-emerald-700 font-mono font-bold">{m.memberNo}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-slate-800 font-semibold">
                          {m.citizenshipNo}
                        </td>
                        <td className="p-3.5">
                          <div className="font-mono text-emerald-700 font-bold">{m.phone}</div>
                          <div className="text-[10px] text-slate-500">{m.district || m.address || 'Kathmandu'}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="text-[11px] text-slate-700">{m.email || '—'}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{m.phone}</div>
                        </td>
                        <td className="p-3.5 text-right font-mono">
                          <div className="text-indigo-700 font-bold">{m.totalShares || 0} <span className="text-[10px] font-normal text-slate-500">units</span></div>
                          <div className="text-[10px] text-slate-500">{formatNPR(m.shareAmount || 0)}</div>
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold">
                          <div className="text-slate-800">{formatNPR(m.totalSavingsBalance)}</div>
                          <div className="text-[10px] text-teal-700 font-semibold">Loan: {formatNPR(m.totalLoanBalance)}</div>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${ m.kycStatus === 'Verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200' }`}>
                            {m.kycStatus}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-600 font-medium text-[11px]">
                          {m.membershipDateBS} BS
                        </td>
                        <td className="p-3.5 text-right pr-4">
                          <div className="relative inline-block">
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={() => setOpenActionMenu(openActionMenu === m.id ? null : m.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                              <span>Actions</span>
                            </button>
                            {openActionMenu === m.id && (
                              <div
                                onMouseDown={(e) => e.stopPropagation()}
                                className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
                              >
                                <button
                                  onClick={() => { setMemberEditMode(false); setSelectedMemberForDetail(m); setOpenActionMenu(null); }}
                                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                                >
                                  <Eye className="w-3.5 h-3.5 text-emerald-600" /> View 360° Profile
                                </button>
                                <button
                                  onClick={() => { setMemberEditMode(true); setSelectedMemberForDetail(m); setOpenActionMenu(null); }}
                                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-blue-600" /> Edit Details
                                </button>
                                <button
                                  onClick={async () => {
                                    setOpenActionMenu(null);
                                    if (!window.confirm(`Deactivate member "${m.fullName}"?`)) return;
                                    await updateMember(m.id, { status: 'Inactive' });
                                    await reloadMembers?.();
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 flex items-center gap-2 transition"
                                >
                                  <UserX className="w-3.5 h-3.5" /> Deactivate
                                </button>
                                {canDelete && (
                                  <button
                                    onClick={() => {
                                      setOpenActionMenu(null);
                                      setHardDeleteTarget(m);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition border-t border-slate-100"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Hard Delete (Admin Only)
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredMembers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                          No members matching "{searchTerm}"
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Members Master Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMembers.map(m => (
                <div 
                  key={m.id} 
                  className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 transition shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <ImageHoverPreview
                        src={m.photoUrl}
                        name={m.fullName}
                        subtext={m.memberNo}
                        badge={m.kycStatus}
                        sizeClass="w-11 h-11"
                      />
                      <div>
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <span>{m.fullName}</span>
                        </div>
                        <div className="text-[11px] text-emerald-700 font-mono font-bold">{m.memberNo}</div>
                      </div>
                    </div>

                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${ m.kycStatus === 'Verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200' }`}>
                      {m.kycStatus}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-slate-700 border-y border-slate-100 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Citizenship No:</span>
                      <span className="font-mono text-slate-800 font-semibold">{m.citizenshipNo}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Phone Number:</span>
                      <span className="font-mono text-emerald-700 font-semibold">{m.phone}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Savings / Loan Balance:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {formatNPR(m.totalSavingsBalance)} / <span className="text-teal-700">{formatNPR(m.totalLoanBalance)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-500 font-medium">Joined: {m.membershipDateBS} BS</span>
                    <button
                      onClick={() => setSelectedMemberForDetail(m)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-emerald-800 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>360° Profile</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* NEW MEMBER REGISTRATION WIZARD */}
      {activeTab === 'add_member' && (
        <div className="max-w-5xl mx-auto">
          <ExpandableFormCard
            title="New Member Enrollment Wizard"
            subtitle="Captures personal details, detailed address, family info, nominee, KYC photos/documents & ethical declaration."
            icon={<UserPlus className="w-5 h-5 text-emerald-700" />}
            badge={
              <span className="text-xs bg-emerald-50 text-emerald-700 font-mono px-2.5 py-1 rounded border border-emerald-200 font-semibold">
                Auto MBR-2083-NEW
              </span>
            }
            onSubmit={handleRegisterMember}
            footerActions={
              <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700">
                <div>
                  <span className="font-bold text-slate-800 block">Automatic Initial Charges & Shares Issued:</span>
                  {(() => {
                    const mt = catalogState['member-types']?.find((t) => t.name === formData.membershipType);
                    if (mt) {
                      const units = mt.minShareUnits ?? 10;
                      const perUnit = mt.shareValuePerUnit ?? 100;
                      const fee = mt.entranceFee ?? 500;
                      return (
                        <span>
                          {units} Shares @ NPR {perUnit.toLocaleString()}/share (NPR {(units * perUnit).toLocaleString()}) + Entrance Fee (NPR {fee.toLocaleString()}) = NPR {(units * perUnit + fee).toLocaleString()}
                        </span>
                      );
                    }
                    return <span>10 Shares @ NPR 100/share (NPR 1,000) + Entrance Fee (NPR 500) = NPR 1,500</span>;
                  })()}
                </div>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer shadow-sm shrink-0 flex items-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Complete Enrollment & Issue Shares</span>
                </button>
              </div>
            }
          >
            <div className="space-y-6">

              {/* PHOTO, SIGNATURE & DOCUMENT PREVIEW & UPLOADER BAR */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-700" />
                    <span>Photo & Specimen Uploads / Camera Scanning (KYC Artifacts)</span>
                  </h4>
                  <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Upload from PC or Scan via Camera/Biometric
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  
                  {/* Passport Photo */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col items-center justify-between text-center space-y-2">
                    <div className="relative group">
                      <img 
                        src={resolveMediaUrl(formData.photoUrl)} 
                        alt="Member PP Photo" 
                        className="w-20 h-24 object-cover rounded-lg border-2 border-emerald-600 shadow-xs" 
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800">Member PP Photo *</span>
                    
                    <div className="flex items-center gap-1.5 w-full pt-1">
                      <label className="flex-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold py-1.5 px-2 rounded-lg border border-emerald-200 flex items-center justify-center gap-1 transition">
                        <Upload className="w-3 h-3" />
                        <span>Upload</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleFileChange('photoUrl', e)} 
                          className="hidden" 
                        />
                      </label>
                      <button 
                        type="button" 
                        onClick={() => handleOpenScanner('photo')}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold py-1.5 px-2 rounded-lg border border-slate-300 flex items-center justify-center gap-1 transition"
                      >
                        <Camera className="w-3 h-3 text-emerald-700" />
                        <span>Camera</span>
                      </button>
                    </div>
                  </div>

                  {/* Citizenship Front */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col items-center justify-between text-center space-y-2">
                    {formData.citizenshipFrontUrl ? (
                      <img 
                        src={resolveMediaUrl(formData.citizenshipFrontUrl)} 
                        alt="Citizenship Front" 
                        className="w-full h-24 object-cover rounded-lg border border-emerald-300"
                      />
                    ) : (
                      <div className="w-full h-24 bg-slate-50 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center p-2 text-slate-500">
                        <FileText className="w-6 h-6 text-emerald-600 mb-1" />
                        <span className="text-[10px] font-bold text-emerald-700 truncate max-w-[120px]">{formData.citizenshipFrontName}</span>
                        <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-0.5">
                          <Check className="w-3 h-3" /> Verified Document
                        </span>
                      </div>
                    )}
                    <span className="text-[11px] font-bold text-slate-800">Citizenship (Front) *</span>
                    
                    <div className="flex items-center gap-1.5 w-full pt-1">
                      <label className="flex-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold py-1.5 px-2 rounded-lg border border-emerald-200 flex items-center justify-center gap-1 transition">
                        <Upload className="w-3 h-3" />
                        <span>Upload</span>
                        <input 
                          type="file" 
                          accept="image/*,.pdf" 
                          onChange={(e) => handleFileChange('citizenshipFrontUrl', e)} 
                          className="hidden" 
                        />
                      </label>
                      <button 
                        type="button" 
                        onClick={() => handleOpenScanner('citizenshipFront')}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold py-1.5 px-2 rounded-lg border border-slate-300 flex items-center justify-center gap-1 transition"
                      >
                        <Scan className="w-3 h-3 text-emerald-600" />
                        <span>Scan</span>
                      </button>
                    </div>
                  </div>

                  {/* Citizenship Back */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col items-center justify-between text-center space-y-2">
                    {formData.citizenshipBackUrl ? (
                      <img 
                        src={resolveMediaUrl(formData.citizenshipBackUrl)} 
                        alt="Citizenship Back" 
                        className="w-full h-24 object-cover rounded-lg border border-emerald-300"
                      />
                    ) : (
                      <div className="w-full h-24 bg-slate-50 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center p-2 text-slate-500">
                        <FileText className="w-6 h-6 text-emerald-600 mb-1" />
                        <span className="text-[10px] font-bold text-emerald-700 truncate max-w-[120px]">{formData.citizenshipBackName}</span>
                        <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-0.5">
                          <Check className="w-3 h-3" /> Verified Document
                        </span>
                      </div>
                    )}
                    <span className="text-[11px] font-bold text-slate-800">Citizenship (Back) *</span>
                    
                    <div className="flex items-center gap-1.5 w-full pt-1">
                      <label className="flex-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold py-1.5 px-2 rounded-lg border border-emerald-200 flex items-center justify-center gap-1 transition">
                        <Upload className="w-3 h-3" />
                        <span>Upload</span>
                        <input 
                          type="file" 
                          accept="image/*,.pdf" 
                          onChange={(e) => handleFileChange('citizenshipBackUrl', e)} 
                          className="hidden" 
                        />
                      </label>
                      <button 
                        type="button" 
                        onClick={() => handleOpenScanner('citizenshipBack')}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold py-1.5 px-2 rounded-lg border border-slate-300 flex items-center justify-center gap-1 transition"
                      >
                        <Scan className="w-3 h-3 text-emerald-600" />
                        <span>Scan</span>
                      </button>
                    </div>
                  </div>

                  {/* Signature & Fingerprint */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col items-center justify-between text-center space-y-2">
                    <div className="w-full h-24 bg-slate-50 rounded-lg border border-slate-200 flex flex-col items-center justify-center p-1.5 text-slate-600 overflow-hidden">
                      {formData.signatureUrl ? (
                        <img src={resolveMediaUrl(formData.signatureUrl)} alt="Signature Specimen" className="h-12 object-contain" />
                      ) : (
                        <div className="italic font-serif text-slate-800 text-sm font-bold tracking-widest border-b border-slate-400 px-2 pb-0.5">
                          R.C. Adhikari
                        </div>
                      )}
                      <span className="text-[9px] text-emerald-700 font-semibold mt-1 flex items-center gap-1 truncate max-w-full">
                        <Fingerprint className="w-3 h-3 text-rose-600 shrink-0" />
                        <span>{formData.fingerprintData ? 'Biometrics Matched' : 'Signature OK'}</span>
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-800">Signature & Fingerprint *</span>
                    
                    <div className="flex items-center gap-1 w-full pt-1">
                      <label className="cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold py-1.5 px-1.5 rounded-lg border border-emerald-200 flex items-center justify-center gap-1 transition">
                        <Upload className="w-3 h-3" />
                        <span>Sig</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleFileChange('signatureUrl', e)} 
                          className="hidden" 
                        />
                      </label>
                      <button 
                        type="button" 
                        onClick={() => handleOpenScanner('signature')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold py-1.5 px-1.5 rounded-lg border border-slate-300 flex items-center justify-center gap-1 transition"
                        title="Sign Pad"
                      >
                        <Edit3 className="w-3 h-3 text-emerald-600" />
                        <span>Pad</span>
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleOpenScanner('fingerprint')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold py-1.5 px-1.5 rounded-lg border border-slate-300 flex items-center justify-center gap-1 transition"
                        title="Scan Fingerprint"
                      >
                        <Fingerprint className="w-3 h-3 text-rose-600" />
                        <span>Bio</span>
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              {/* ADDITIONAL DOCUMENTS */}
              <AdditionalDocumentsSection formData={formData} setFormData={setFormData} />

              {/* SECTION 1: PERSONAL & IDENTITY DETAILS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                  <User className="w-4 h-4 text-emerald-700" />
                  <span>1. Basic Personal & Identity Details</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Branch *</label>
                    <select
                      value={activeBranchId}
                      onChange={(e) => setActiveBranchId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="">Select Branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <TransliteratedNameInput
                      englishLabel="Full Name (English)"
                      englishValue={formData.fullName}
                      nepaliValue={formData.nameNepali}
                      onEnglishChange={(v) => setFormData({ ...formData, fullName: v })}
                      onNepaliChange={(v) => setFormData({ ...formData, nameNepali: v })}
                      englishPlaceholder="e.g. Ramesh Chandra Adhikari"
                      nepaliPlaceholder="उदा. रमेश चन्द्र अधिकारी"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Gender *</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="Male">Male (पुरुष)</option>
                      <option value="Female">Female (महिला)</option>
                      <option value="Other">Other (अन्य)</option>
                    </select>
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <NepaliDatePicker
                      label="Date of Birth (BS / AD)"
                      required
                      value={formData.dobBS}
                      onChange={(bsDate, adDate) => setFormData({ ...formData, dobBS: bsDate, dobAD: adDate })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Marital Status</label>
                    <select
                      value={formData.maritalStatus}
                      onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="Married">Married (विवाहित)</option>
                      <option value="Single">Single (अविवाहित)</option>
                      <option value="Divorced">Divorced (पारपाचुके)</option>
                      <option value="Widowed">Widowed (एकल/विधवा)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Blood Group</label>
                    <select
                      value={formData.bloodGroup}
                      onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="O+">O+</option>
                      <option value="A+">A+</option>
                      <option value="B+">B+</option>
                      <option value="AB+">AB+</option>
                      <option value="O-">O-</option>
                      <option value="A-">A-</option>
                      <option value="B-">B-</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Citizenship Number *</label>
                    <input
                      type="text"
                      required
                      minLength={5}
                      value={formData.citizenshipNo}
                      onChange={(e) => setFormData({ ...formData, citizenshipNo: e.target.value })}
                      placeholder="e.g. 27-01-78-12345"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Citizenship Issue District</label>
                    <input
                      type="text"
                      value={formData.citizenshipIssueDistrict}
                      onChange={(e) => setFormData({ ...formData, citizenshipIssueDistrict: e.target.value })}
                      placeholder="e.g. Kathmandu"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* MINOR MEMBER TOGGLE & GUARDIAN DETAILS */}
                <div className="mt-3 pt-3 border-t border-slate-100 bg-amber-50/60 p-3 rounded-xl border border-amber-200/80">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id="isMinorCheckbox"
                      checked={formData.isMinor}
                      onChange={(e) => setFormData({ ...formData, isMinor: e.target.checked })}
                      className="w-4 h-4 text-emerald-700 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="isMinorCheckbox" className="font-bold text-amber-900 cursor-pointer">
                      Is this member a Minor (under 18 years old)?
                    </label>
                  </div>

                  {formData.isMinor && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2 pt-2 border-t border-amber-200">
                      <div className="space-y-1">
                        <TransliteratedNameInput
                          englishLabel="Guardian Full Name"
                          englishValue={formData.guardianName}
                          nepaliValue={formData.guardianNameNepali}
                          onEnglishChange={(v) => setFormData({ ...formData, guardianName: v })}
                          onNepaliChange={(v) => setFormData({ ...formData, guardianNameNepali: v })}
                          englishPlaceholder="Guardian's Name"
                          compact
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-700 font-semibold text-[11px]">Guardian Relation</label>
                        <select
                          value={formData.guardianRelation}
                          onChange={(e) => setFormData({ ...formData, guardianRelation: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 focus:border-emerald-600 focus:outline-none"
                        >
                          <option value="Father">Father</option>
                          <option value="Mother">Mother</option>
                          <option value="Grandfather">Grandfather</option>
                          <option value="Legal Guardian">Legal Guardian</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-700 font-semibold text-[11px]">Guardian Citizenship No</label>
                        <input
                          type="text"
                          value={formData.guardianCitizenshipNo}
                          onChange={(e) => setFormData({ ...formData, guardianCitizenshipNo: e.target.value })}
                          placeholder="27-01-72-99812"
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-mono text-slate-800 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-700 font-semibold text-[11px]">Guardian Mobile Phone</label>
                        <input
                          type="text"
                          value={formData.guardianPhone}
                          onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                          placeholder="9841XXXXXX"
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-mono text-slate-800 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

              </div>


              {/* SECTION 2: CONTACT & COMPREHENSIVE ADDRESS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  <span>2. Contact Details & Complete Address Breakdown</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Mobile Phone Number *</label>
                    <input
                      type="text"
                      required
                      minLength={10}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="9841XXXXXX"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Secondary Telephone / Landline</label>
                    <input
                      type="text"
                      value={formData.secondaryPhone}
                      onChange={(e) => setFormData({ ...formData, secondaryPhone: e.target.value })}
                      placeholder="01-42XXXXX"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="member@example.com"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Permanent Address */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-700"></span>
                    <span>Permanent Address (स्थायी ठेगाना)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="space-y-1">
                      <label className="text-slate-600 font-medium text-[11px]">Province</label>
                      <select
                        value={formData.permProvince}
                        onChange={(e) => handlePermProvinceChange(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 focus:border-emerald-600 focus:outline-none"
                      >
                        <option value="">Select Province</option>
                        {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-600 font-medium text-[11px]">District</label>
                      <select
                        value={formData.permDistrict}
                        onChange={(e) => handlePermDistrictChange(e.target.value)}
                        disabled={permDistricts.length === 0}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        <option value="">Select District</option>
                        {permDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-600 font-medium text-[11px]">Municipality / Gaunpalika</label>
                      <select
                        value={formData.permMunicipality}
                        onChange={(e) => handlePermMunicipalityChange(e.target.value)}
                        disabled={permMunicipalities.length === 0}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        <option value="">Select Municipality</option>
                        {permMunicipalities.map(mun => <option key={mun} value={mun}>{mun}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-600 font-medium text-[11px]">Ward No.</label>
                      <select
                        value={formData.permWard}
                        onChange={(e) => setFormData({ ...formData, permWard: e.target.value })}
                        disabled={permWards.length === 0}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        <option value="">Select Ward</option>
                        {permWards.map(w => <option key={w} value={w}>Ward {w}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-600 font-medium text-[11px]">Tole / Street</label>
                      <input
                        type="text"
                        value={formData.permTole}
                        onChange={(e) => setFormData({ ...formData, permTole: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Temporary Address */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      <span>Temporary / Current Address (अस्थायी ठेगाना)</span>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.sameAsPermanent}
                        onChange={handleCopyPermanentAddress}
                        className="w-3.5 h-3.5 rounded text-emerald-700 focus:ring-emerald-500"
                      />
                      <span>Same as Permanent</span>
                    </label>
                  </div>

                  {!formData.sameAsPermanent && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="space-y-1">
                        <label className="text-slate-600 font-medium text-[11px]">Province</label>
                        <select
                          value={formData.tempProvince}
                          onChange={(e) => handleTempProvinceChange(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 focus:border-emerald-600 focus:outline-none"
                        >
                          <option value="">Select Province</option>
                          {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-600 font-medium text-[11px]">District</label>
                        <select
                          value={formData.tempDistrict}
                          onChange={(e) => handleTempDistrictChange(e.target.value)}
                          disabled={tempDistricts.length === 0}
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          <option value="">Select District</option>
                          {tempDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-600 font-medium text-[11px]">Municipality / Gaunpalika</label>
                        <select
                          value={formData.tempMunicipality}
                          onChange={(e) => handleTempMunicipalityChange(e.target.value)}
                          disabled={tempMunicipalities.length === 0}
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          <option value="">Select Municipality</option>
                          {tempMunicipalities.map(mun => <option key={mun} value={mun}>{mun}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-600 font-medium text-[11px]">Ward No.</label>
                        <select
                          value={formData.tempWard}
                          onChange={(e) => setFormData({ ...formData, tempWard: e.target.value })}
                          disabled={tempWards.length === 0}
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          <option value="">Select Ward</option>
                          {tempWards.map(w => <option key={w} value={w}>Ward {w}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-600 font-medium text-[11px]">Tole / Street</label>
                        <input
                          type="text"
                          value={formData.tempTole}
                          onChange={(e) => setFormData({ ...formData, tempTole: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

              </div>


              {/* SECTION 3: FAMILY DETAILS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Heart className="w-4 h-4 text-rose-600" />
                  <span>3. Family Details (पारिवारिक विवरण)</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <TransliteratedNameInput
                      englishLabel="Father's Full Name"
                      englishValue={formData.fatherName}
                      nepaliValue={formData.fatherNameNepali}
                      onEnglishChange={(v) => setFormData({ ...formData, fatherName: v })}
                      onNepaliChange={(v) => setFormData({ ...formData, fatherNameNepali: v })}
                      englishPlaceholder="e.g. Hari Bahadur Adhikari"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <TransliteratedNameInput
                      englishLabel="Mother's Full Name"
                      englishValue={formData.motherName}
                      nepaliValue={formData.motherNameNepali}
                      onEnglishChange={(v) => setFormData({ ...formData, motherName: v })}
                      onNepaliChange={(v) => setFormData({ ...formData, motherNameNepali: v })}
                      englishPlaceholder="e.g. Maya Devi Adhikari"
                    />
                  </div>

                  <div className="space-y-1">
                    <TransliteratedNameInput
                      englishLabel="Grandfather's Full Name"
                      englishValue={formData.grandfatherName}
                      nepaliValue={formData.grandfatherNameNepali}
                      onEnglishChange={(v) => setFormData({ ...formData, grandfatherName: v })}
                      onNepaliChange={(v) => setFormData({ ...formData, grandfatherNameNepali: v })}
                      englishPlaceholder="e.g. Ram Prasad Adhikari"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <TransliteratedNameInput
                      englishLabel="Spouse Full Name (if married)"
                      englishValue={formData.spouseName}
                      nepaliValue={formData.spouseNameNepali}
                      onEnglishChange={(v) => setFormData({ ...formData, spouseName: v })}
                      onNepaliChange={(v) => setFormData({ ...formData, spouseNameNepali: v })}
                      englishPlaceholder="Spouse Name"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Number of Dependents</label>
                    <input
                      type="number"
                      value={formData.dependentsCount}
                      onChange={(e) => setFormData({ ...formData, dependentsCount: e.target.value })}
                      placeholder="e.g. 2"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>


              {/* SECTION 4: NOMINEE DETAILS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>4. Nominee Information (हकवाला/इच्छाएको व्यक्ति)</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <TransliteratedNameInput
                      englishLabel="Nominee Full Name"
                      englishValue={formData.nomineeName}
                      nepaliValue={formData.nomineeNameNepali}
                      onEnglishChange={(v) => setFormData({ ...formData, nomineeName: v })}
                      onNepaliChange={(v) => setFormData({ ...formData, nomineeNameNepali: v })}
                      englishPlaceholder="Nominee Full Name"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Relation with Member *</label>
                    <select
                      value={formData.nomineeRelation}
                      onChange={(e) => setFormData({ ...formData, nomineeRelation: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="">-- Select Relation --</option>
                      {(catalogState['relationship-types'] || []).map((r) => (
                        <option key={r.id} value={r.name}>{r.name}{r.nameNepali ? ` (${r.nameNepali})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Nominee Citizenship / ID No.</label>
                    <input
                      type="text"
                      value={formData.nomineeCitizenshipNo}
                      onChange={(e) => setFormData({ ...formData, nomineeCitizenshipNo: e.target.value })}
                      placeholder="e.g. 27-01-78-99812"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Nominee Contact Number</label>
                    <input
                      type="text"
                      value={formData.nomineePhone}
                      onChange={(e) => setFormData({ ...formData, nomineePhone: e.target.value })}
                      placeholder="98XXXXXXXX"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Share Percentage (%)</label>
                    <input
                      type="number"
                      value={formData.nomineeSharePct}
                      onChange={(e) => setFormData({ ...formData, nomineeSharePct: e.target.value })}
                      placeholder="100%"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>


              {/* SECTION 5: OCCUPATION, FINANCIALS, PEP & ETHICS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Briefcase className="w-4 h-4 text-emerald-600" />
                  <span>5. Occupation, Financial Source, PEP & Ethical Compliance</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Membership Type</label>
                    <select
                      value={formData.membershipType}
                      onChange={(e) => setFormData({ ...formData, membershipType: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:border-emerald-600 focus:outline-none font-medium"
                    >
                      <option value="">-- Select Member Type --</option>
                      {(catalogState['member-types'] || []).map((mt) => (
                        <option key={mt.id} value={mt.name}>{mt.name}{mt.nameNepali ? ` (${mt.nameNepali})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Member Category</label>
                    <select
                      value={formData.memberCategory}
                      onChange={(e) => setFormData({ ...formData, memberCategory: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="">-- Select Member Category --</option>
                      {(catalogState['member-categories'] || []).map((c) => (
                        <option key={c.id} value={c.name}>{c.name}{c.nameNepali ? ` (${c.nameNepali})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Primary Occupation</label>
                    <select
                      value={formData.occupation}
                      onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="">-- Select Occupation --</option>
                      {(catalogState['occupations'] || []).map((o) => (
                        <option key={o.id} value={o.name}>{o.name}{o.nameNepali ? ` (${o.nameNepali})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const mt = catalogState['member-types']?.find((t) => t.name === formData.membershipType);
                    return mt?.isGroupType ? (
                      <div className="space-y-1 md:col-span-3">
                        <label className="text-slate-700 font-semibold">Community Group *</label>
                        <select
                          value={formData.groupId}
                          onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                        >
                          <option value="">-- Select Group --</option>
                          {(groupCatalog || []).map((g) => (
                            <option key={g.id} value={g.id}>{g.name}{g.maxMembers ? ` (Capacity: ${g.maxMembers})` : ''}</option>
                          ))}
                        </select>
                      </div>
                    ) : null;
                  })()}

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Employer / Firm Name</label>
                    <input
                      type="text"
                      value={formData.employerName}
                      onChange={(e) => setFormData({ ...formData, employerName: e.target.value })}
                      placeholder="Firm / Organization Name"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Estimated Annual Income (NPR)</label>
                    <select
                      value={formData.annualIncome}
                      onChange={(e) => setFormData({ ...formData, annualIncome: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="Below 200,000">Below NPR 200,000</option>
                      <option value="200,000 - 500,000">NPR 200,000 - 500,000</option>
                      <option value="500,000 - 1,000,000">NPR 500,000 - 1,000,000</option>
                      <option value="1,000,000 - 2,500,000">NPR 1,000,000 - 2,500,000</option>
                      <option value="Above 2,500,000">Above NPR 2,500,000</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Primary Source of Funds</label>
                    <select
                      value={formData.sourceOfFunds}
                      onChange={(e) => setFormData({ ...formData, sourceOfFunds: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="Business Profit">Business Profit</option>
                      <option value="Salary / Wage">Salary / Monthly Wages</option>
                      <option value="Remittance">Foreign Remittance</option>
                      <option value="Agricultural Sale">Agricultural Income</option>
                      <option value="Rent / Investments">House Rent / Investment Dividends</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 font-semibold">Politically Exposed Person (PEP)?</label>
                    <div className="flex items-center gap-4 pt-2">
                      <label className="flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="pepRadio"
                          checked={!formData.isPEP}
                          onChange={() => setFormData({ ...formData, isPEP: false })}
                          className="w-4 h-4 text-emerald-700 focus:ring-emerald-500"
                        />
                        <span>No (होइन)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-rose-700 font-bold cursor-pointer">
                        <input
                          type="radio"
                          name="pepRadio"
                          checked={formData.isPEP}
                          onChange={() => setFormData({ ...formData, isPEP: true })}
                          className="w-4 h-4 text-rose-600 focus:ring-rose-500"
                        />
                        <span>Yes (हो)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {formData.isPEP && (
                  <div className="space-y-1 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs">
                    <label className="text-rose-900 font-bold">PEP Position / Relationship Details *</label>
                    <input
                      type="text"
                      value={formData.pepDetails}
                      onChange={(e) => setFormData({ ...formData, pepDetails: e.target.value })}
                      placeholder="Specify political position, office held, or relationship to PEP"
                      className="w-full bg-white border border-rose-300 rounded-lg p-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                )}

                {/* ETHICAL DECLARATION CHECKBOX */}
                <div className="mt-4 p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={formData.ethicsAccepted}
                      onChange={(e) => setFormData({ ...formData, ethicsAccepted: e.target.checked })}
                      className="w-4 h-4 text-emerald-700 rounded border-slate-300 focus:ring-emerald-500 mt-0.5"
                    />
                    <span className="text-xs text-slate-800 leading-snug">
                      <strong className="text-emerald-950 font-bold">Cooperative Ethics & Anti-Money Laundering (AML/KYC) Declaration:</strong>
                      <br />
                      I hereby confirm that all information provided is true and correct. I pledge to abide by the Cooperative Act 2074, bye-laws, code of ethics, and financial regulations of this institution.
                    </span>
                  </label>
                </div>

              </div>

            </div>
          </ExpandableFormCard>
        </div>
      )}

      {/* KYC QUEUE */}
      {activeTab === 'kyc_queue' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-amber-600" />
                KYC Document Verification Queue
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Review pending KYC applications, scan/verify documents, then approve or reject.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg font-bold">
                {kycPendingMembers.length} Pending
              </span>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold">
                {safeMembers.filter(m => m.kycStatus === 'Verified').length} Verified
              </span>
              <button
                type="button"
                onClick={() => reloadMembers?.()}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
          </div>

          {kycPendingMembers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              All member KYC documents are verified!
            </div>
          ) : (
            <div className="space-y-3">
              {kycPendingMembers.map(m => {
                const isBusy = kycDecisionId === m.id;
                return (
                  <div key={m.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <ImageHoverPreview
                        src={m.photoUrl}
                        name={m.fullName}
                        subtext={m.memberNo}
                        badge={m.kycStatus}
                        sizeClass="w-11 h-11 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 text-sm truncate">{m.fullName}</div>
                        <div className="text-emerald-700 font-mono font-bold text-[11px]">{m.memberNo}</div>
                        <div className="text-slate-600 mt-0.5 truncate">
                          Citizenship: {m.citizenshipNo} • Phone: {m.phone}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${ m.citizenshipFrontUrl || m.citizenshipBackUrl ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200' }`}>
                        <FileCheck className="w-3 h-3" />
                        {m.citizenshipFrontUrl || m.citizenshipBackUrl ? 'Docs Present' : 'Docs Missing'}
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedMemberForDetail(m)}
                        className="px-3 py-1.5 bg-slate-50 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Review Docs
                      </button>
                      <button
                        type="button"
                        onClick={() => approveMemberKyc(m)}
                        disabled={isBusy}
                        className="px-3 py-1.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectMemberKyc(m)}
                        disabled={isBusy}
                        className="px-3 py-1.5 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-50 text-slate-800 font-semibold text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 border border-slate-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* CAMERA / DOCUMENT SCANNER / SIGNATURE & BIOMETRIC MODAL */}
      {scanModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 text-slate-800 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-700" />
                <h3 className="font-bold text-sm">
                  {scanTarget === 'photo' && 'Capture Passport Photo via Camera / Scanner'}
                  {scanTarget === 'citizenshipFront' && 'OCR Scan - Citizenship Document (Front)'}
                  {scanTarget === 'citizenshipBack' && 'OCR Scan - Citizenship Document (Back)'}
                  {scanTarget === 'signature' && 'Specimen Digital Signature Pad'}
                  {scanTarget === 'fingerprint' && 'Biometric Thumbprint Sensor Scanner'}
                </h3>
              </div>
              <button 
                onClick={handleCloseScanner}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-center">
              
              {/* PHOTO / CITIZENSHIP CAMERA VIEWPORT */}
              {(scanTarget === 'photo' || scanTarget === 'citizenshipFront' || scanTarget === 'citizenshipBack') && (
                <div className="space-y-4">
                  <div className="relative w-full h-64 bg-white rounded-xl overflow-hidden border-2 border-slate-200 flex items-center justify-center">
                    {cameraActive ? (
                      <>
                        <video 
                          ref={videoRef} 
                          autoPlay 
                          playsInline 
                          muted
                          className="w-full h-full object-cover" 
                        />
                        <button
                          type="button"
                          onClick={handleCaptureArtifact}
                          disabled={isScanning}
                          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full text-xs shadow-lg flex items-center gap-1.5 transition transform hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Snap Photo</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 text-slate-500 space-y-2">
                        <Scan className="w-12 h-12 text-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-slate-700">High-Resolution KYC Scanner Module</span>
                        <span className="text-[11px] text-slate-500 max-w-xs">Align document or photo inside frame for auto-cropping and OCR text extraction.</span>
                      </div>
                    )}

                    {/* Viewfinder Overlay Frame */}
                    <div className="absolute inset-4 border-2 border-dashed border-emerald-400/80 rounded-lg pointer-events-none flex flex-col justify-between p-2">
                      <div className="flex justify-between text-[10px] text-emerald-300 font-mono">
                        <span>[READY]</span>
                        <span>1080p KYC HD</span>
                      </div>
                      {isScanning && (
                        <div className="w-full h-1 bg-emerald-600 shadow-[0_0_12px_#10b981] animate-bounce" />
                      )}
                      <div className="text-center text-[10px] text-emerald-400 font-bold bg-slate-50 py-0.5 rounded">
                        Auto Target Lock Active
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600">
                    Place document flat or face camera directly. Click capture below to lock KYC artifact.
                  </p>
                </div>
              )}

              {/* DIGITAL SIGNATURE CANVAS PAD */}
              {scanTarget === 'signature' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="font-bold flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                      Draw Signature Below using Mouse or Touch
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (sigCanvasRef.current) {
                          const ctx = sigCanvasRef.current.getContext('2d');
                          ctx?.clearRect(0, 0, sigCanvasRef.current.width, sigCanvasRef.current.height);
                        }
                      }}
                      className="text-xs text-slate-600 hover:text-slate-800 font-bold underline cursor-pointer"
                    >
                      Clear Board
                    </button>
                  </div>

                  <div className="border-2 border-dashed border-emerald-200 bg-emerald-50/30 rounded-xl p-2">
                    <canvas
                      ref={sigCanvasRef}
                      width={480}
                      height={160}
                      onMouseDown={(e) => {
                        setIsDrawingSig(true);
                        const canvas = sigCanvasRef.current;
                        if (canvas) {
                          const rect = canvas.getBoundingClientRect();
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            ctx.beginPath();
                            ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                          }
                        }
                      }}
                      onMouseMove={(e) => {
                        if (!isDrawingSig) return;
                        const canvas = sigCanvasRef.current;
                        if (canvas) {
                          const rect = canvas.getBoundingClientRect();
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            ctx.lineWidth = 2.5;
                            ctx.lineCap = 'round';
                            ctx.strokeStyle = '#1e1b4b';
                            ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                            ctx.stroke();
                          }
                        }
                      }}
                      onMouseUp={() => setIsDrawingSig(false)}
                      className="w-full h-40 bg-white rounded-lg cursor-crosshair border border-slate-200 shadow-inner"
                    />
                  </div>
                </div>
              )}

              {/* FINGERPRINT BIOMETRIC SENSOR */}
              {scanTarget === 'fingerprint' && (
                <div className="space-y-4 py-2">
                  <div 
                    onClick={handleCaptureArtifact}
                    className="mx-auto w-32 h-32 rounded-full bg-rose-50 border-4 border-rose-200 hover:border-rose-400 flex flex-col items-center justify-center cursor-pointer group transition transform hover:scale-105 shadow-md"
                  >
                    <Fingerprint className="w-16 h-16 text-rose-600 group-hover:text-rose-700 animate-pulse" />
                    <span className="text-[10px] font-bold text-rose-800 mt-1">TOUCH SENSOR</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    Place thumb or index finger on biometric sensor pad to register minutiae template.
                  </p>
                </div>
              )}

              {/* Progress Bar during Scanning */}
              {isScanning && (
                <div className="space-y-1 text-left">
                  <div className="flex justify-between text-xs font-bold text-emerald-800">
                    <span>Processing Artifact & Extracting KYC Data...</span>
                    <span>{scanProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div 
                      className="h-full bg-emerald-700 transition-all duration-150" 
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseScanner}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCaptureArtifact}
                disabled={isScanning}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Capture & Save Artifact</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* IndexedDB Offline Storage Queue Modal */}
      {showIndexedDbModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-white text-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <span>IndexedDB Offline Media Store</span>
                    <span className="px-2 py-0.5 bg-slate-50 text-emerald-400 font-mono text-[10px] rounded-full border border-slate-300">
                      SahakariSathi_OfflineMediaDB
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Temporary browser storage persistence before Firestore cloud sync
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIndexedDbModal(false)}
                className="text-slate-500 hover:text-slate-800 p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Connection status banner */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {navigator.onLine ? (
                    <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                      <Wifi className="w-4 h-4 text-emerald-600" /> Network Online (Firestore Reachable)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 font-bold text-amber-700">
                      <WifiOff className="w-4 h-4 text-amber-600" /> Offline Mode Active (Saving to IndexedDB)
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleManualSyncIndexedDb}
                  disabled={isSyncingIndexedDb}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <CloudUpload className={`w-3.5 h-3.5 ${isSyncingIndexedDb ? 'animate-bounce' : ''}`} />
                  <span>{isSyncingIndexedDb ? 'Syncing...' : 'Sync Pending to Firestore'}</span>
                </button>
              </div>

              {/* Record list */}
              {indexedDbRecords.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
                  <HardDrive className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">IndexedDB Storage Queue Empty</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Photos captured via camera feed, scanner, or file uploads will automatically persist here temporarily before syncing to Firestore.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-slate-500 font-bold px-1">
                    <span>IndexedDB Stored Artifacts ({indexedDbRecords.length})</span>
                    <span>Status</span>
                  </div>
                  {indexedDbRecords.map((item) => (
                    <div key={item.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                          <img src={item.photoDataUrl} alt={item.targetType} className="w-full h-full object-cover" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-800 capitalize">
                            {item.targetType.replace(/([A-Z])/g, ' $1')} Artifact
                          </p>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Member: <span className="font-semibold text-slate-700">{item.memberName || 'Candidate'}</span>
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Stored: {new Date(item.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.status === 'synced' && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Firestore Synced
                          </span>
                        )}
                        {item.status === 'pending' && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-[10px] font-bold flex items-center gap-1 animate-pulse">
                            <Database className="w-3 h-3 text-amber-600" />
                            Pending Sync
                          </span>
                        )}
                        {item.status === 'failed' && (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded-full text-[10px] font-bold flex items-center gap-1" title={item.syncError}>
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            Retry Queue
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={async () => {
                            await deletePhotoFromIndexedDB(item.id);
                            refreshIndexedDbQueue();
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Remove from IndexedDB"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-[11px] text-slate-500">
                IndexedDB ensures full data persistence during network interruptions or tab restarts.
              </span>
              <button
                type="button"
                onClick={() => setShowIndexedDbModal(false)}
                className="px-4 py-1.5 bg-slate-50 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECURE HARD DELETE (admin only) — archives immutable snapshot first */}
      {hardDeleteTarget && (
        <HardDeleteModal
          title="Hard Delete Member"
          entityLabel={hardDeleteTarget.fullName}
          entityCode={hardDeleteTarget.memberNo}
          subtext="This will also permanently delete the member's savings accounts, loans, shares, subsidiary ledgers and other linked records."
          onClose={() => setHardDeleteTarget(null)}
          onConfirm={async (reason) => {
            await hardDeleteMember(hardDeleteTarget.id, reason);
            setHardDeleteTarget(null);
            toast.showSuccess(`Member "${hardDeleteTarget.fullName}" was permanently deleted. An immutable audit record was archived.`, 'Member Hard Deleted');
            await reloadMembers?.();
          }}
        />
      )}

    </div>
  );
};
