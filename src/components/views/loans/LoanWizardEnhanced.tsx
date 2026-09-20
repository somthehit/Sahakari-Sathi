/**
 * Enhanced Loan Wizard Sections — Collateral, Guarantors, Documents, Risk & Approval.
 * Renders as sub-panels inside the Credit Appraisal wizard (LoansView).
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, Plus, Trash2, FileText, CheckCircle2, Clock, AlertTriangle,
  Upload, Eye, Lock, ChevronDown, ChevronUp, Building2, User,
  MapPin, Scale, Banknote, FileCheck, ClipboardList, Award,
  Landmark, Printer, Settings2,
} from 'lucide-react';
import {
  REQUIRED_DOCUMENTS,
  uploadLoanDocument,
  getLoanDocuments,
  getCollaterals,
  getGuarantors,
  validateSubmission,
  type CollateralInput,
  type GuarantorInput,
  type DocumentRecord,
  type ValidationResult,
} from '../../../api/loanApplications';
import {
  generateLegalDocument,
  LEGAL_DOCUMENT_LABELS,
  type LegalDocumentType,
  type DocumentGeneratorInput,
} from '../../../services/loanDocumentGenerator';
import { fetchLoanSettings, type CollateralType } from '../../../api/loanSettings';
import { formatNPR, getTodayBS } from '../../../utils/nepaliCalendar';
import { useAuthStore } from '../../../stores/authStore';
import { SYSTEM_MAPPING_META } from '../../admin_setups/SetupAccountingSettingsView';

// ───────────────────────── Sub-Types ─────────────────────────

interface CollateralSectionProps {
  loanApplicationId: string | null;
  requestedAmount: number;
  onCollateralsChange?: (collaterals: CollateralInput[]) => void;
}

interface GuarantorSectionProps {
  loanApplicationId: string | null;
  guarantors: GuarantorInput[];
  onGuarantorsChange: (guarantors: GuarantorInput[]) => void;
  members?: { id: string; fullName: string; memberNo: string }[];
}

interface DocumentChecklistProps {
  loanApplicationId: string | null;
  onDocumentCountChange?: (count: number) => void;
}

interface RiskApprovalProps {
  loanApplicationId: string | null;
  requestedAmount: number;
  collateralValue: number;
  interestRate: number;
  tenureMonths: number;
  calculatedEmi: number;
  onValidationChange?: (result: ValidationResult) => void;
}

interface LegalDocumentGuarantor {
  fullName: string;
  address?: string;
  citizenshipNo?: string;
  relationship?: string;
}

interface LegalDocumentProps {
  loanApplicationId: string | null;
  borrowerName: string;
  borrowerAddress: string;
  borrowerCitizenshipNo: string;
  borrowerMemberNo: string;
  fatherOrHusbandName: string;
  borrowerAge: number | string;
  borrowerTole: string;
  borrowerWardNo: string;
  borrowerMunicipality: string;
  borrowerDistrict: string;
  guarantorName: string;
  guarantorAddress: string;
  guarantor1Citizenship: string;
  guarantor1Relationship: string;
  guarantor2Name: string;
  guarantor2Citizenship: string;
  guarantor2Relationship: string;
  guarantors?: LegalDocumentGuarantor[];
  requestedAmount: number;
  interestRate: number;
  loanProductName: string;
  purposeDetail: string;
  repaymentFrequency: string;
  emiAmount: number;
  collateralDescription: string;
  collateralValuation: number;
  collateralKittaNo: string;
  collateralAreaDetail: string;
  collateralBuildingDetail: string;
  collateralLandOfficeName: string;
  collateralBoundaryEast: string;
  collateralBoundaryWest: string;
  collateralBoundaryNorth: string;
  collateralBoundarySouth: string;
  collateralDistrict: string;
  collateralMunicipality: string;
  collateralWardNo: string;
  collateralTole: string;
  valuerName: string;
  valuationDateBs: string;
  cooperativeName: string;
  registrationNo: string;
  province: string;
  district: string;
  municipality: string;
  wardNo: string;
  branchName: string;
  branchAddress: string;
  place: string;
  witness1Name: string;
  witness2Name: string;
  scribeStaffName: string;
  scribeDesignation: string;
  onSignedUpload?: (docType: string, fileUrl: string) => void;
}

// ═══════════════════════════════════════════════════════════════
// 1. COLLATERAL SECTION
// ═══════════════════════════════════════════════════════════════

const COLLATERAL_FIELD_MAP: Record<string, { label: string; fields: string[] }> = {
  AGRI_LAND:     { label: 'Agricultural Land', fields: ['province', 'district', 'municipality', 'wardNo', 'kittaNo', 'areaDetail', 'landOfficeName', 'boundary', 'buildingDetail', 'irrigationSource', 'cropType'] },
  RESI_LAND:     { label: 'Residential Land', fields: ['province', 'district', 'municipality', 'wardNo', 'kittaNo', 'areaDetail', 'landOfficeName', 'boundary', 'buildingDetail'] },
  COM_LAND:      { label: 'Commercial Land', fields: ['province', 'district', 'municipality', 'wardNo', 'kittaNo', 'areaDetail', 'landOfficeName', 'boundary', 'buildingDetail'] },
  BUILDING:      { label: 'Building / Structure', fields: ['province', 'district', 'municipality', 'wardNo', 'kittaNo', 'areaDetail', 'landOfficeName', 'boundary', 'buildingDetail', 'numFloors', 'builtUpArea'] },
  PUBLIC_BLDG:   { label: 'Public / Institutional Building', fields: ['province', 'district', 'municipality', 'wardNo', 'kittaNo', 'areaDetail', 'buildingDetail'] },
  JEWELLERY:     { label: 'Jewellery / Gold', fields: ['weightGrams', 'purityKarat', 'jewelerName', 'jewelryDescription'] },
  MOTOR_VEHICLE: { label: 'Motor Vehicle', fields: ['engineNo', 'chassisNo', 'registrationNo', 'vehicleMake', 'vehicleModel', 'yearOfManufacture', 'insuranceRequired', 'insurancePolicyNo'] },
  FD:            { label: 'Fixed Deposit', fields: ['fdBankName', 'fdAccountNo', 'fdAmount', 'fdMaturityDateBs', 'fdCertificateNo'] },
  GOVT_SEC:      { label: 'Government Securities', fields: ['securityType', 'securityIssuer', 'securityNo', 'securityFaceValue', 'securityMaturityDate'] },
  BANK_SEC:      { label: 'Bank Securities', fields: ['bankName', 'securityType', 'securityNo', 'securityFaceValue', 'maturityDate'] },
  SHARE_CERT:    { label: 'Share Certificate', fields: ['shareCertNo', 'sharesQuantity', 'shareCooperativeName'] },
  MACHINERY:     { label: 'Machinery / Equipment', fields: ['machineMake', 'machineModel', 'machineSerialNo', 'yearOfManufacture', 'currentLocation'] },
  LIFE_INS:      { label: 'Life Insurance Policy', fields: ['insuranceCompany', 'policyNo', 'sumAssured', 'surrenderValue', 'maturityDate'] },
  DEPOSITORY:    { label: 'Depository / SOSHE', fields: ['depositoryType', 'depositoryNo', 'depositoryAmount', 'depositoryDate'] },
  CASH_COLL:     { label: 'Cash Collateral', fields: ['cashBankName', 'cashAccountNo', 'cashAmount'] },
  OTHER:         { label: 'Other', fields: ['otherDescription'] },
};

const getCollateralDisplayType = (code: string): string => {
  if (['AGRI_LAND', 'RESI_LAND', 'COM_LAND'].includes(code)) return 'Land & Building';
  if (['BUILDING', 'PUBLIC_BLDG'].includes(code)) return 'Land & Building';
  if (code === 'MOTOR_VEHICLE') return 'Vehicle';
  if (code === 'JEWELLERY') return 'Gold / Jewelry';
  if (code === 'FD') return 'Fixed Deposit';
  if (code === 'SHARE_CERT') return 'Share Certificate';
  if (code === 'MACHINERY') return 'Machinery';
  return 'Other';
};

const getEmptyCollateral = (code?: string): CollateralInput => ({
  collateralType: code || 'OTHER',
  ownerName: '',
  ownershipDocNumber: '',
  province: '',
  district: '',
  municipality: '',
  wardNo: '',
  kittaNo: '',
  areaDetail: '',
  assessedValuation: 0,
  valuationDoneBy: '',
  valuationDateBs: getTodayBS(),
  landOfficeName: '',
  boundaryEast: '',
  boundaryWest: '',
  boundaryNorth: '',
  boundarySouth: '',
  buildingDetail: '',
  insuranceRequired: false,
  insurancePolicyNo: '',
});

export const CollateralSection: React.FC<CollateralSectionProps> = ({
  loanApplicationId,
  requestedAmount,
  onCollateralsChange,
}) => {
  const [collateralTypes, setCollateralTypes] = useState<CollateralType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [collaterals, setCollaterals] = useState<CollateralInput[]>([getEmptyCollateral()]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const types = await fetchLoanSettings('collateral-types');
        if (mounted) setCollateralTypes(types.filter((t: any) => t.isActive));
      } catch {
        // fallback to empty — user can still type
      } finally {
        if (mounted) setLoadingTypes(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const totalValue = collaterals.reduce((sum, c) => sum + (c.assessedValuation || 0), 0);
  const ltvRatio = totalValue > 0 ? Math.round((requestedAmount / totalValue) * 100) : 0;

  const addCollateral = () => {
    const defaultCode = collateralTypes.length > 0 ? collateralTypes[0].code : 'OTHER';
    setCollaterals(prev => [...prev, getEmptyCollateral(defaultCode)]);
  };

  const removeCollateral = (idx: number) => {
    const next = collaterals.filter((_, i) => i !== idx);
    setCollaterals(next);
    onCollateralsChange?.(next);
  };

  const updateCollateral = (idx: number, field: keyof CollateralInput, value: any) => {
    const next = collaterals.map((c, i) => (i === idx ? { ...c, [field]: value } : c));
    setCollaterals(next);
    onCollateralsChange?.(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-amber-600" />
          <span>Collateral & Security ({collaterals.length})</span>
        </h4>
        <button
          type="button"
          onClick={addCollateral}
          className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add Collateral
        </button>
      </div>

      {collaterals.map((c, idx) => (
        <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Collateral #{idx + 1}</span>
            {collaterals.length > 1 && (
              <button
                type="button"
                onClick={() => removeCollateral(idx)}
                className="text-rose-500 hover:text-rose-700 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Row 1: Asset Type, Owner, Doc No. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold text-[10px]">Asset Type *</label>
              <select
                value={c.collateralType}
                onChange={e => updateCollateral(idx, 'collateralType', e.target.value)}
                disabled={loadingTypes}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none"
              >
                {loadingTypes ? (
                  <option>Loading...</option>
                ) : collateralTypes.length > 0 ? (
                  collateralTypes.map(ct => (
                    <option key={ct.id} value={ct.code}>{ct.name}{ct.nameNepali ? ` (${ct.nameNepali})` : ''}</option>
                  ))
                ) : (
                  <>
                    <option value="OTHER">Other</option>
                  </>
                )}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold text-[10px]">Owner Name *</label>
              <input
                value={c.ownerName}
                onChange={e => updateCollateral(idx, 'ownerName', e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none"
                placeholder="Property owner name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold text-[10px]">Ownership Doc No.</label>
              <input
                value={c.ownershipDocNumber}
                onChange={e => updateCollateral(idx, 'ownershipDocNumber', e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* ═══════════ TYPE-SPECIFIC FIELDS ═══════════ */}

          {/* ── Land & Building (legacy + DB codes) ── */}
          {(c.collateralType === 'Land & Building' || ['AGRI_LAND', 'RESI_LAND', 'COM_LAND', 'BUILDING', 'PUBLIC_BLDG'].includes(c.collateralType)) && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Province</label>
                  <input value={c.province} onChange={e => updateCollateral(idx, 'province', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">District</label>
                  <input value={c.district} onChange={e => updateCollateral(idx, 'district', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Municipality</label>
                  <input value={c.municipality} onChange={e => updateCollateral(idx, 'municipality', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Kitta No.</label>
                  <input value={c.kittaNo} onChange={e => updateCollateral(idx, 'kittaNo', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Area Detail</label>
                  <input value={c.areaDetail} onChange={e => updateCollateral(idx, 'areaDetail', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. 12 aana" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Land Office Name</label>
                  <input value={c.landOfficeName} onChange={e => updateCollateral(idx, 'landOfficeName', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. Land Revenue Office, Kathmandu" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Building Detail</label>
                  <input value={c.buildingDetail} onChange={e => updateCollateral(idx, 'buildingDetail', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. 2-storey brick house" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="space-y-1"><label className="text-slate-600 font-semibold text-[10px]">पूर्व (East)</label><input value={c.boundaryEast} onChange={e => updateCollateral(idx, 'boundaryEast', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-slate-600 font-semibold text-[10px]">पश्चिम (West)</label><input value={c.boundaryWest} onChange={e => updateCollateral(idx, 'boundaryWest', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-slate-600 font-semibold text-[10px]">उत्तर (North)</label><input value={c.boundaryNorth} onChange={e => updateCollateral(idx, 'boundaryNorth', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-slate-600 font-semibold text-[10px]">दक्षिण (South)</label><input value={c.boundarySouth} onChange={e => updateCollateral(idx, 'boundarySouth', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" /></div>
              </div>
            </>
          )}

          {/* ── Vehicle (legacy + DB code) ── */}
          {(c.collateralType === 'Vehicle' || c.collateralType === 'MOTOR_VEHICLE') && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Engine No.</label>
                  <input value={(c as any).engineNo || ''} onChange={e => updateCollateral(idx, 'engineNo' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Chassis No.</label>
                  <input value={(c as any).chassisNo || ''} onChange={e => updateCollateral(idx, 'chassisNo' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Registration No.</label>
                  <input value={(c as any).registrationNo || ''} onChange={e => updateCollateral(idx, 'registrationNo' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. Ba 1 Cha 1234" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Make / Brand</label>
                  <input value={(c as any).vehicleMake || ''} onChange={e => updateCollateral(idx, 'vehicleMake' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. Toyota" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Model</label>
                  <input value={(c as any).vehicleModel || ''} onChange={e => updateCollateral(idx, 'vehicleModel' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. Corolla" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Year of Manufacture</label>
                  <input value={(c as any).yearOfManufacture || ''} onChange={e => updateCollateral(idx, 'yearOfManufacture' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. 2020" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="flex items-center gap-2 text-slate-600 font-semibold text-[10px]">
                  <input type="checkbox" checked={(c as any).insuranceRequired || false} onChange={e => updateCollateral(idx, 'insuranceRequired' as any, e.target.checked)} className="accent-emerald-600" />
                  Insurance Required
                </label>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Insurance Policy No.</label>
                  <input value={c.insurancePolicyNo} onChange={e => updateCollateral(idx, 'insurancePolicyNo', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
              </div>
            </>
          )}

          {/* ── Gold / Jewelry (legacy + DB code) ── */}
          {(c.collateralType === 'Gold / Jewelry' || c.collateralType === 'JEWELLERY') && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Weight (grams) *</label>
                  <input type="number" min="0" step="1" value={(c as any).weightGrams || ''} onChange={e => updateCollateral(idx, 'weightGrams' as any, Number(e.target.value))} className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Purity (Karat)</label>
                  <select value={(c as any).purityKarat || '24'} onChange={e => updateCollateral(idx, 'purityKarat' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none">
                    <option value="24">24 Karat (99.9%)</option>
                    <option value="22">22 Karat (91.6%)</option>
                    <option value="18">18 Karat (75.0%)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Jeweler Name</label>
                  <input value={(c as any).jewelerName || ''} onChange={e => updateCollateral(idx, 'jewelerName' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. Touban Jewellers" />
                </div>
              </div>
              <div className="space-y-1 text-xs">
                <label className="text-slate-600 font-semibold text-[10px]">Description</label>
                <input value={(c as any).jewelryDescription || ''} onChange={e => updateCollateral(idx, 'jewelryDescription' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. 2 tola gold necklace, 1 tola gold ring" />
              </div>
            </>
          )}

          {/* ── Fixed Deposit (legacy + DB code) ── */}
          {(c.collateralType === 'Fixed Deposit' || c.collateralType === 'FD') && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Bank Name *</label>
                  <input value={(c as any).fdBankName || ''} onChange={e => updateCollateral(idx, 'fdBankName' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. Nabil Bank" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">FD Account No.</label>
                  <input value={(c as any).fdAccountNo || ''} onChange={e => updateCollateral(idx, 'fdAccountNo' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">FD Amount (NPR) *</label>
                  <input type="number" min="0" step="1000" value={(c as any).fdAmount || ''} onChange={e => updateCollateral(idx, 'fdAmount' as any, Number(e.target.value))} className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold focus:border-emerald-600 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Maturity Date (BS)</label>
                  <input value={(c as any).fdMaturityDateBs || ''} onChange={e => updateCollateral(idx, 'fdMaturityDateBs' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="YYYY-MM-DD" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">FD Certificate No.</label>
                  <input value={(c as any).fdCertificateNo || ''} onChange={e => updateCollateral(idx, 'fdCertificateNo' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
              </div>
            </>
          )}

          {/* ── Share Certificate (legacy + DB code) ── */}
          {(c.collateralType === 'Share Certificate' || c.collateralType === 'SHARE_CERT') && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Certificate No.</label>
                  <input value={(c as any).shareCertNo || ''} onChange={e => updateCollateral(idx, 'shareCertNo' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">No. of Shares</label>
                  <input type="number" min="1" value={(c as any).sharesQuantity || ''} onChange={e => updateCollateral(idx, 'sharesQuantity' as any, Number(e.target.value))} className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Cooperative / Org Name</label>
                  <input value={(c as any).shareCooperativeName || ''} onChange={e => updateCollateral(idx, 'shareCooperativeName' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
              </div>
            </>
          )}

          {/* ── Machinery (legacy + DB code) ── */}
          {(c.collateralType === 'Machinery' || c.collateralType === 'MACHINERY') && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Make / Brand</label>
                  <input value={(c as any).machineMake || ''} onChange={e => updateCollateral(idx, 'machineMake' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. Caterpillar" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Model</label>
                  <input value={(c as any).machineModel || ''} onChange={e => updateCollateral(idx, 'machineModel' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Serial No.</label>
                  <input value={(c as any).machineSerialNo || ''} onChange={e => updateCollateral(idx, 'machineSerialNo' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Year of Manufacture</label>
                  <input value={(c as any).yearOfManufacture || ''} onChange={e => updateCollateral(idx, 'yearOfManufacture' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Current Location</label>
                  <input value={(c as any).currentLocation || ''} onChange={e => updateCollateral(idx, 'currentLocation' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. Factory premises, Lalitpur" />
                </div>
              </div>
            </>
          )}

          {/* ── Other (legacy + DB code) ── */}
          {(c.collateralType === 'Other' || c.collateralType === 'OTHER') && (
            <div className="space-y-1 text-xs">
              <label className="text-slate-600 font-semibold text-[10px]">Description *</label>
              <input value={(c as any).otherDescription || ''} onChange={e => updateCollateral(idx, 'otherDescription' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="Describe the collateral asset" />
            </div>
          )}

          {/* ── Government Securities ── */}
          {c.collateralType === 'GOVT_SEC' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Security Type *</label>
                  <select value={(c as any).securityType || ''} onChange={e => updateCollateral(idx, 'securityType' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none">
                    <option value="">Select type</option>
                    <option value="govt_bond">Government Bond</option>
                    <option value="treasury_bill">Treasury Bill</option>
                    <option value="nss_cert">NSS Certificate</option>
                    <option value="deben">Debenture</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Issuer / Authority</label>
                  <input value={(c as any).securityIssuer || ''} onChange={e => updateCollateral(idx, 'securityIssuer' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. Nepal Rastra Bank" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Security No.</label>
                  <input value={(c as any).securityNo || ''} onChange={e => updateCollateral(idx, 'securityNo' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Face Value (NPR) *</label>
                  <input type="number" min="0" step="1000" value={(c as any).securityFaceValue || ''} onChange={e => updateCollateral(idx, 'securityFaceValue' as any, Number(e.target.value))} className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Maturity Date (BS)</label>
                  <input value={(c as any).securityMaturityDate || ''} onChange={e => updateCollateral(idx, 'securityMaturityDate' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="YYYY-MM-DD" />
                </div>
              </div>
            </>
          )}

          {/* ── Bank Securities ── */}
          {c.collateralType === 'BANK_SEC' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Bank Name *</label>
                  <input value={(c as any).bankName || ''} onChange={e => updateCollateral(idx, 'bankName' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. Nabil Bank" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Security Type *</label>
                  <select value={(c as any).securityType || ''} onChange={e => updateCollateral(idx, 'securityType' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none">
                    <option value="">Select type</option>
                    <option value="bank_guarantee">Bank Guarantee</option>
                    <option value="bank_bond">Bank Bond</option>
                    <option value="liquidity_instrument">Liquidity Instrument</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Security No.</label>
                  <input value={(c as any).securityNo || ''} onChange={e => updateCollateral(idx, 'securityNo' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Face Value (NPR) *</label>
                  <input type="number" min="0" step="1000" value={(c as any).securityFaceValue || ''} onChange={e => updateCollateral(idx, 'securityFaceValue' as any, Number(e.target.value))} className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Maturity Date (BS)</label>
                  <input value={(c as any).maturityDate || ''} onChange={e => updateCollateral(idx, 'maturityDate' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="YYYY-MM-DD" />
                </div>
              </div>
            </>
          )}

          {/* ── Life Insurance Policy ── */}
          {c.collateralType === 'LIFE_INS' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Insurance Company *</label>
                  <input value={(c as any).insuranceCompany || ''} onChange={e => updateCollateral(idx, 'insuranceCompany' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. Nepal Life Insurance" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Policy No. *</label>
                  <input value={(c as any).policyNo || ''} onChange={e => updateCollateral(idx, 'policyNo' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Sum Assured (NPR)</label>
                  <input type="number" min="0" step="1000" value={(c as any).sumAssured || ''} onChange={e => updateCollateral(idx, 'sumAssured' as any, Number(e.target.value))} className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono focus:border-emerald-600 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Surrender Value (NPR) *</label>
                  <input type="number" min="0" step="1000" value={(c as any).surrenderValue || ''} onChange={e => updateCollateral(idx, 'surrenderValue' as any, Number(e.target.value))} className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Maturity Date (BS)</label>
                  <input value={(c as any).maturityDate || ''} onChange={e => updateCollateral(idx, 'maturityDate' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="YYYY-MM-DD" />
                </div>
              </div>
            </>
          )}

          {/* ── Depository / SOSHE ── */}
          {c.collateralType === 'DEPOSITORY' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Depository Type *</label>
                  <select value={(c as any).depositoryType || ''} onChange={e => updateCollateral(idx, 'depositoryType' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none">
                    <option value="">Select type</option>
                    <option value="depository_receipt">Depository Receipt</option>
                    <option value="social_security">Social Security Instrument</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Depository No.</label>
                  <input value={(c as any).depositoryNo || ''} onChange={e => updateCollateral(idx, 'depositoryNo' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 font-semibold text-[10px]">Amount (NPR) *</label>
                  <input type="number" min="0" step="1000" value={(c as any).depositoryAmount || ''} onChange={e => updateCollateral(idx, 'depositoryAmount' as any, Number(e.target.value))} className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold focus:border-emerald-600 focus:outline-none" />
                </div>
              </div>
              <div className="space-y-1 text-xs">
                <label className="text-slate-600 font-semibold text-[10px]">Date (BS)</label>
                <input value={(c as any).depositoryDate || ''} onChange={e => updateCollateral(idx, 'depositoryDate' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="YYYY-MM-DD" />
              </div>
            </>
          )}

          {/* ── Cash Collateral ── */}
          {c.collateralType === 'CASH_COLL' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-600 font-semibold text-[10px]">Bank Name *</label>
                <input value={(c as any).cashBankName || ''} onChange={e => updateCollateral(idx, 'cashBankName' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. Nabil Bank" />
              </div>
              <div className="space-y-1">
                <label className="text-slate-600 font-semibold text-[10px]">Account No.</label>
                <input value={(c as any).cashAccountNo || ''} onChange={e => updateCollateral(idx, 'cashAccountNo' as any, e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-slate-600 font-semibold text-[10px]">Pledged Amount (NPR) *</label>
                <input type="number" min="0" step="1000" value={(c as any).cashAmount || ''} onChange={e => updateCollateral(idx, 'cashAmount' as any, Number(e.target.value))} className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold focus:border-emerald-600 focus:outline-none" />
              </div>
            </div>
          )}

          {/* ═══════════ COMMON: Valuation ═══════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs border-t border-slate-100 pt-3">
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold text-[10px]">Assessed Valuation (NPR) *</label>
              <input type="number" min="0" step="10000" value={c.assessedValuation || ''} onChange={e => updateCollateral(idx, 'assessedValuation', Number(e.target.value))} className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold focus:border-emerald-600 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold text-[10px]">Valuation Done By</label>
              <input value={c.valuationDoneBy} onChange={e => updateCollateral(idx, 'valuationDoneBy', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="e.g. Govt. Valuer" />
            </div>
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold text-[10px]">Valuation Date (BS)</label>
              <input value={c.valuationDateBs} onChange={e => updateCollateral(idx, 'valuationDateBs', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none" placeholder="YYYY-MM-DD" />
            </div>
          </div>
        </div>
      ))}

      {/* LTV Summary */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-4 text-xs">
        <div>
          <span className="text-slate-500">Total Collateral Value:</span>{' '}
          <span className="font-mono font-bold text-slate-900">{formatNPR(totalValue)}</span>
        </div>
        <div>
          <span className="text-slate-500">LTV Ratio:</span>{' '}
          <span className={`font-mono font-bold ${ltvRatio <= 60 ? 'text-emerald-700' : ltvRatio <= 80 ? 'text-amber-700' : 'text-rose-700'}`}>
            {ltvRatio}%
          </span>
        </div>
        {ltvRatio > 80 && (
          <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> LTV exceeds 80% limit
          </span>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 2. GUARANTOR SECTION
// ═══════════════════════════════════════════════════════════════

export const GuarantorSection: React.FC<GuarantorSectionProps> = ({
  loanApplicationId,
  guarantors,
  onGuarantorsChange,
  members = [],
}) => {
  const addGuarantor = () => {
    onGuarantorsChange([
      ...guarantors,
      {
        fullName: '',
        relationshipToBorrower: '',
        citizenshipNo: '',
        address: '',
        monthlyIncome: 0,
        incomeSource: '',
        signatureCollected: false,
      },
    ]);
  };

  const removeGuarantor = (idx: number) => {
    onGuarantorsChange(guarantors.filter((_, i) => i !== idx));
  };

  const updateGuarantor = (idx: number, field: keyof GuarantorInput, value: any) => {
    onGuarantorsChange(guarantors.map((g, i) => (i === idx ? { ...g, [field]: value } : g)));
  };

  const selectFromMembers = (idx: number, memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      updateGuarantor(idx, 'guarantorMemberId', memberId);
      updateGuarantor(idx, 'fullName', member.fullName);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <User className="w-4 h-4 text-indigo-600" />
          <span>Guarantors ({guarantors.length})</span>
          {guarantors.length === 0 && (
            <span className="text-[10px] text-rose-600 font-medium ml-2">* At least 1 required</span>
          )}
        </h4>
        <button
          type="button"
          onClick={addGuarantor}
          className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add Guarantor
        </button>
      </div>

      {guarantors.map((g, idx) => (
        <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Guarantor #{idx + 1}</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[10px] text-slate-600">
                <input
                  type="checkbox"
                  checked={g.signatureCollected}
                  onChange={e => updateGuarantor(idx, 'signatureCollected', e.target.checked)}
                  className="accent-emerald-600"
                />
                Signature collected
              </label>
              {guarantors.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeGuarantor(idx)}
                  className="text-rose-500 hover:text-rose-700 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {members.length > 0 && (
              <div className="space-y-1">
                <label className="text-slate-600 font-semibold text-[10px]">Select from Members</label>
                <select
                  value={g.guarantorMemberId || ''}
                  onChange={e => selectFromMembers(idx, e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none"
                >
                  <option value="">— Type manually or select —</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.fullName} ({m.memberNo})</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold text-[10px]">Full Name *</label>
              <input
                value={g.fullName}
                onChange={e => updateGuarantor(idx, 'fullName', e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold text-[10px]">Relationship</label>
              <input
                value={g.relationshipToBorrower}
                onChange={e => updateGuarantor(idx, 'relationshipToBorrower', e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none"
                placeholder="e.g. Father, Brother, Friend"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold text-[10px]">Citizenship No.</label>
              <input
                value={g.citizenshipNo}
                onChange={e => updateGuarantor(idx, 'citizenshipNo', e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold text-[10px]">Monthly Income (NPR)</label>
              <input
                type="number"
                min="0"
                value={g.monthlyIncome || ''}
                onChange={e => updateGuarantor(idx, 'monthlyIncome', Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold text-[10px]">Income Source</label>
              <input
                value={g.incomeSource}
                onChange={e => updateGuarantor(idx, 'incomeSource', e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none"
                placeholder="e.g. Agriculture, Business"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-slate-600 font-semibold text-[10px]">Address</label>
              <input
                value={g.address}
                onChange={e => updateGuarantor(idx, 'address', e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 3. DOCUMENT UPLOAD CHECKLIST
// ═══════════════════════════════════════════════════════════════

interface UploadedFileEntry {
  file: File;
  previewUrl: string;
  uploadedAt: string;
}

export const DocumentChecklist: React.FC<DocumentChecklistProps> = ({
  loanApplicationId,
  onDocumentCountChange,
}) => {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [localUploads, setLocalUploads] = useState<Record<string, UploadedFileEntry>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchDocs = useCallback(async () => {
    if (!loanApplicationId) return;
    setLoading(true);
    try {
      const records = await getLoanDocuments(loanApplicationId);
      setDocs(records);
      onDocumentCountChange?.(records.length);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [loanApplicationId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const uploadedTypes = new Set(docs.map(d => d.documentType));
  const totalCount = new Set([...uploadedTypes, ...Object.keys(localUploads)]).size;

  useEffect(() => {
    onDocumentCountChange?.(totalCount);
  }, [totalCount]);

  const handleFileSelect = async (docType: string, file: File) => {
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be under 10MB.');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only JPG, PNG, WebP, and PDF files are accepted.');
      return;
    }

    setUploading(prev => ({ ...prev, [docType]: true }));

    // Read file for local preview
    const reader = new FileReader();
    reader.onload = () => {
      setLocalUploads(prev => ({
        ...prev,
        [docType]: {
          file,
          previewUrl: reader.result as string,
          uploadedAt: new Date().toLocaleString(),
        },
      }));
      setUploading(prev => ({ ...prev, [docType]: false }));
    };
    reader.readAsDataURL(file);

    // If we have a loanApplicationId, upload to server immediately
    if (loanApplicationId) {
      try {
        const { supabase } = await import('../../../lib/supabaseClient');
        const filePath = `loan-docs/${loanApplicationId}/${docType}_${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
          await uploadLoanDocument(loanApplicationId, docType, urlData.publicUrl, 'current-user');
          // Refresh docs list
          fetchDocs();
        }
      } catch (err) {
        console.error('Upload failed, saved locally only:', err);
      }
    }
  };

  const handleRemoveLocal = (docType: string) => {
    setLocalUploads(prev => {
      const next = { ...prev };
      delete next[docType];
      return next;
    });
    // Reset the file input
    if (fileInputRefs.current[docType]) {
      fileInputRefs.current[docType]!.value = '';
    }
  };

  const triggerFileInput = (docType: string) => {
    fileInputRefs.current[docType]?.click();
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
        <ClipboardList className="w-4 h-4 text-sky-600" />
        <span>Document Checklist ({totalCount}/{REQUIRED_DOCUMENTS.length})</span>
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {REQUIRED_DOCUMENTS.map(doc => {
          const serverUploaded = uploadedTypes.has(doc.type);
          const localEntry = localUploads[doc.type];
          const isUploading = uploading[doc.type];
          const isComplete = serverUploaded || !!localEntry;

          return (
            <div
              key={doc.type}
              className={`relative p-3 rounded-lg border text-xs transition-all ${
                isComplete
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-sky-300'
              }`}
            >
              {/* Hidden file input */}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                className="hidden"
                ref={el => { fileInputRefs.current[doc.type] = el; }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(doc.type, file);
                  e.target.value = '';
                }}
              />

              <div className="flex items-start gap-2.5">
                {/* Status icon / thumbnail */}
                {isComplete && localEntry?.previewUrl?.startsWith('data:image') ? (
                  <img
                    src={localEntry.previewUrl}
                    alt={doc.label}
                    className="w-10 h-10 rounded-md object-cover border border-emerald-300 shrink-0"
                  />
                ) : isComplete ? (
                  <div className="w-10 h-10 rounded-md bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-emerald-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-md bg-slate-100 border border-slate-300 flex items-center justify-center shrink-0">
                    <Upload className="w-4 h-4 text-slate-400" />
                  </div>
                )}

                {/* Label + metadata */}
                <div className="flex-1 min-w-0">
                  <span className="font-semibold block truncate">{doc.label}</span>
                  <span className="text-[9px] text-slate-400 uppercase">{doc.category}</span>
                  {localEntry && (
                    <span className="text-[9px] text-emerald-600 block mt-0.5 truncate">
                      {localEntry.file.name} ({(localEntry.file.size / 1024).toFixed(0)} KB)
                    </span>
                  )}
                  {serverUploaded && (
                    <span className="text-[9px] text-emerald-600 block mt-0.5">Verified on server</span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {isComplete ? (
                    <>
                      <button
                        type="button"
                        onClick={() => triggerFileInput(doc.type)}
                        className="p-1.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-700 cursor-pointer transition"
                        title="Replace file"
                      >
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                      {!serverUploaded && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLocal(doc.type)}
                          className="p-1.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer transition"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => triggerFileInput(doc.type)}
                      disabled={isUploading}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 text-white text-[10px] font-bold cursor-pointer transition flex items-center gap-1"
                    >
                      {isUploading ? (
                        <Clock className="w-3 h-3 animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3" />
                      )}
                      {isUploading ? 'Uploading...' : 'Upload'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalCount < REQUIRED_DOCUMENTS.length && (
        <p className="text-[10px] text-amber-600 font-medium">
          {REQUIRED_DOCUMENTS.length - totalCount} document(s) still missing. Upload them before submission.
        </p>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 4. RISK & APPROVAL PANEL
// ═══════════════════════════════════════════════════════════════

export const RiskApprovalPanel: React.FC<RiskApprovalProps> = ({
  loanApplicationId,
  requestedAmount,
  collateralValue,
  interestRate,
  tenureMonths,
  calculatedEmi,
  onValidationChange,
}) => {
  const [cibStatus, setCibStatus] = useState<string>('not_started');
  const [cibLoading, setCibLoading] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  const ltvRatio = collateralValue > 0 ? Math.round((requestedAmount / collateralValue) * 100) : 0;
  const riskGrade = ltvRatio <= 60 ? 'A' : ltvRatio <= 75 ? 'B' : ltvRatio <= 90 ? 'C' : 'D';
  const riskColor = ltvRatio <= 60 ? 'emerald' : ltvRatio <= 75 ? 'amber' : 'rose';

  const handleCibCheck = async () => {
    if (!loanApplicationId) return;
    setCibLoading(true);
    // Simulate CIB check — in production, call external API
    await new Promise(r => setTimeout(r, 2000));
    setCibStatus('passed');
    setCibLoading(false);
  };

  const handleValidate = async () => {
    if (!loanApplicationId) return;
    setValidating(true);
    try {
      const result = await validateSubmission(loanApplicationId, requestedAmount);
      setValidation(result);
      onValidationChange?.(result);
    } catch (err) {
      console.error('Validation failed:', err);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
        <Shield className="w-4 h-4 text-rose-600" />
        <span>Risk Assessment & Approval Gate</span>
      </h4>

      {/* CIB Check */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-700">CIB (Credit Information Bureau) Check</p>
            <p className="text-[10px] text-slate-500">Required before submission</p>
          </div>
          <button
            type="button"
            onClick={handleCibCheck}
            disabled={cibLoading || cibStatus === 'passed'}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
              cibStatus === 'passed'
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                : 'bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 text-white'
            }`}
          >
            {cibLoading ? 'Checking...' : cibStatus === 'passed' ? '✓ Passed' : 'Run CIB Check'}
          </button>
        </div>
      </div>

      {/* Risk Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <span className="text-slate-500 block text-[10px]">LTV Ratio</span>
          <span className={`font-mono font-bold text-lg text-${riskColor}-700`}>{ltvRatio}%</span>
          <span className="text-[10px] text-slate-400 block">Max 80%</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <span className="text-slate-500 block text-[10px]">Risk Grade</span>
          <span className={`font-bold text-lg text-${riskColor}-700`}>Grade {riskGrade}</span>
          <span className="text-[10px] text-slate-400 block">{riskGrade === 'A' ? 'Low Risk' : riskGrade === 'B' ? 'Medium' : 'High Risk'}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <span className="text-slate-500 block text-[10px]">Monthly EMI</span>
          <span className="font-mono font-bold text-emerald-700 text-sm">{formatNPR(calculatedEmi)}</span>
          <span className="text-[10px] text-slate-400 block">{tenureMonths} months</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <span className="text-slate-500 block text-[10px]">Annual Rate</span>
          <span className="font-mono font-bold text-slate-700 text-sm">{interestRate}%</span>
          <span className="text-[10px] text-slate-400 block">per annum</span>
        </div>
      </div>

      {/* Validation Button & Result */}
      <button
        type="button"
        onClick={handleValidate}
        disabled={validating || !loanApplicationId}
        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold cursor-pointer transition"
      >
        {validating ? 'Validating...' : 'Run Submission Validation'}
      </button>

      {validation && (
        <div className={`border rounded-xl p-4 space-y-2 text-xs ${
          validation.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
        }`}>
          <p className="font-bold text-slate-800">
            {validation.ok ? '✓ Ready to Submit' : '✗ Blocking Issues Found'}
          </p>
          {validation.errors.map((err, i) => (
            <p key={i} className="text-rose-700 flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {err}
            </p>
          ))}
          {validation.warnings.map((w, i) => (
            <p key={i} className="text-amber-700 flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {w}
            </p>
          ))}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-200 text-[10px]">
            <div>Documents: <strong>{validation.docsUploaded}/{validation.docsRequired}</strong></div>
            <div>Guarantors: <strong>{validation.guarantorsCount} (min 1)</strong></div>
            <div>LTV: <strong className={validation.ltvAcceptable ? 'text-emerald-700' : 'text-rose-700'}>{validation.ltvRatio}%</strong></div>
            <div>CIB: <strong className={validation.cibPassed ? 'text-emerald-700' : 'text-amber-700'}>{validation.cibPassed ? 'Passed' : 'Pending'}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 5. LEGAL DOCUMENT GENERATION
// ═══════════════════════════════════════════════════════════════

export const LegalDocumentPanel: React.FC<LegalDocumentProps> = ({
  loanApplicationId,
  borrowerName,
  borrowerAddress,
  borrowerCitizenshipNo,
  borrowerMemberNo,
  fatherOrHusbandName,
  borrowerAge,
  borrowerTole,
  borrowerWardNo,
  borrowerMunicipality,
  borrowerDistrict,
  guarantorName,
  guarantorAddress,
  guarantor1Citizenship,
  guarantor1Relationship,
  guarantor2Name,
  guarantor2Citizenship,
  guarantor2Relationship,
  guarantors = [],
  requestedAmount,
  interestRate,
  loanProductName,
  purposeDetail,
  repaymentFrequency,
  emiAmount,
  collateralDescription,
  collateralValuation,
  collateralKittaNo,
  collateralAreaDetail,
  collateralBuildingDetail,
  collateralLandOfficeName,
  collateralBoundaryEast,
  collateralBoundaryWest,
  collateralBoundaryNorth,
  collateralBoundarySouth,
  collateralDistrict,
  collateralMunicipality,
  collateralWardNo,
  collateralTole,
  valuerName,
  valuationDateBs,
  cooperativeName,
  registrationNo,
  province,
  district,
  municipality,
  wardNo,
  branchName,
  branchAddress,
  place,
  witness1Name,
  witness2Name,
  scribeStaffName,
  scribeDesignation,
  onSignedUpload,
}) => {
  const [generating, setGenerating] = useState<LegalDocumentType | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ type: LegalDocumentType; html: string } | null>(null);
  const [signedUploaded, setSignedUploaded] = useState<Set<string>>(new Set());

  const docInput: DocumentGeneratorInput = {
    borrowerName,
    borrowerAddress,
    borrowerCitizenshipNo,
    borrowerMemberNo,
    fatherOrHusbandName,
    borrowerAge,
    borrowerTole,
    borrowerWardNo,
    borrowerMunicipality,
    borrowerDistrict,
    guarantorName,
    guarantorAddress,
    guarantor1Citizenship,
    guarantor1Relationship,
    guarantor2Name,
    guarantor2Citizenship,
    guarantor2Relationship,
    guarantors: guarantors.map(g => ({
      fullName: g.fullName,
      address: g.address || '',
      citizenshipNo: g.citizenshipNo || '',
      relationship: g.relationship || '',
    })),
    requestedAmount,
    tenureMonths: 24,
    interestRate,
    loanProductName,
    purposeDetail,
    repaymentFrequency,
    emiAmount,
    collateralDescription,
    collateralValuation,
    collateralKittaNo,
    collateralAreaDetail,
    collateralBuildingDetail,
    collateralLandOfficeName,
    collateralBoundaryEast,
    collateralBoundaryWest,
    collateralBoundaryNorth,
    collateralBoundarySouth,
    collateralDistrict,
    collateralMunicipality,
    collateralWardNo,
    collateralTole,
    valuerName,
    valuationDateBs,
    cooperativeName,
    registrationNo,
    province,
    district,
    municipality,
    wardNo,
    branchName,
    branchAddress,
    applicationId: loanApplicationId || '',
    place,
    witness1Name,
    witness2Name,
    scribeStaffName,
    scribeDesignation,
    dayOfWeek: '',
  };

  const handleGenerate = (type: LegalDocumentType) => {
    setGenerating(type);
    const html = generateLegalDocument(type, docInput);
    setPreviewDoc({ type, html });
    setGenerating(null);
  };

  const handlePrint = () => {
    if (!previewDoc) return;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(previewDoc.html);
      w.document.close();
      w.print();
    }
  };

  const handleMarkSigned = (type: LegalDocumentType) => {
    setSignedUploaded(prev => new Set(prev).add(type));
    onSignedUpload?.(type, `signed_${type}_${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
        <FileText className="w-4 h-4 text-violet-600" />
        <span>Legal Document Generation</span>
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(['demand', 'agreement', 'tamsuk'] as LegalDocumentType[]).map(type => {
          const label = LEGAL_DOCUMENT_LABELS[type];
          const isSigned = signedUploaded.has(type);
          return (
            <div key={type} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-slate-700">{label.nepali}</p>
              <p className="text-[10px] text-slate-500">{label.english}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleGenerate(type)}
                  disabled={generating === type}
                  className="flex-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer transition flex items-center justify-center gap-1"
                >
                  {generating === type ? 'Generating...' : 'Generate'}
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkSigned(type)}
                  disabled={!isSigned && !previewDoc?.html}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition flex items-center gap-1 ${
                    isSigned
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      : 'bg-violet-600 hover:bg-violet-700 text-white'
                  }`}
                >
                  {isSigned ? '✓ Signed' : 'Mark Signed'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview */}
      {previewDoc && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-100 px-3 py-2 flex items-center justify-between border-b border-slate-200">
            <span className="text-[10px] font-bold text-slate-600">
              Preview: {LEGAL_DOCUMENT_LABELS[previewDoc.type].nepali}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-1"
              >
                <Printer className="w-3 h-3" /> Print
              </button>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-2 py-1 text-[10px] text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
          <div className="bg-white p-4 max-h-96 overflow-y-auto">
            <div dangerouslySetInnerHTML={{ __html: previewDoc.html }} />
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 6. CUSTOM SYSTEM ACCOUNT MAPPINGS
// ═══════════════════════════════════════════════════════════════

const LOAN_RELEVANT_MAPPINGS = [
  'loan_principal_receivable',
  'loan_interest_income',
  'loan_penalty_income',
  'loan_processing_fee_income',
] as const;

interface CustomSystemMappingsSectionProps {
  customMappings: Record<string, string>;
  onMappingsChange: (mappings: Record<string, string>) => void;
  chartOfAccounts: { id: string; code: string; name: string; type: string }[];
}

export const CustomSystemMappingsSection: React.FC<CustomSystemMappingsSectionProps> = ({
  customMappings,
  onMappingsChange,
  chartOfAccounts,
}) => {
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);

  const accountOptions = chartOfAccounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }));

  const setMapping = useCallback((key: string, accountId: string) => {
    onMappingsChange({ ...customMappings, [key]: accountId });
  }, [customMappings, onMappingsChange]);

  const removeMapping = useCallback((key: string) => {
    const next = { ...customMappings };
    delete next[key];
    onMappingsChange(next);
  }, [customMappings, onMappingsChange]);

  const handleAddCustom = () => {
    if (!newKey.trim()) return;
    const key = newKey.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    onMappingsChange({ ...customMappings, [key]: '' });
    setNewKey('');
    setNewDesc('');
    setAddModalOpen(false);
  };

  const mappedCount = Object.values(customMappings).filter(Boolean).length;
  const totalRelevant = LOAN_RELEVANT_MAPPINGS.length;
  const customCount = Object.keys(customMappings).filter(k => !LOAN_RELEVANT_MAPPINGS.includes(k as any)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Settings2 className="w-4 h-4 text-indigo-600" />
          <span>Custom System Account Mappings</span>
        </h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold rounded-lg flex items-center gap-1 transition cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Add Custom
          </button>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
            mappedCount >= totalRelevant
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {mappedCount}/{totalRelevant} mapped
          </span>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        Override default GL accounts for this loan application. These mappings take precedence over system defaults during disbursement and repayment posting.
      </p>

      <div className="space-y-2">
        {LOAN_RELEVANT_MAPPINGS.map(key => {
          const meta = SYSTEM_MAPPING_META[key];
          const currentAccountId = customMappings[key] || '';
          const isMapped = !!currentAccountId;
          return (
            <div key={key} className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${
              isMapped ? 'bg-emerald-50/30 border-emerald-200' : 'bg-white border-slate-200'
            }`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-indigo-600">{key}</span>
                  {meta && <span className="text-[10px] font-semibold text-slate-600">{meta.label}</span>}
                </div>
                {meta && <p className="text-[9px] text-slate-400 mt-0.5">{meta.description}</p>}
              </div>
              <select
                value={currentAccountId}
                onChange={(e) => setMapping(key, e.target.value)}
                className="w-[220px] bg-white border border-slate-200 rounded-lg p-1.5 text-[10px] text-slate-700 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">— Use system default —</option>
                {accountOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {isMapped && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">Override</span>
              )}
            </div>
          );
        })}

        {customCount > 0 && (
          <>
            <div className="border-t border-slate-200 my-2" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Custom Mappings</p>
            {Object.keys(customMappings)
              .filter(k => !LOAN_RELEVANT_MAPPINGS.includes(k as any))
              .map(key => {
                const meta = SYSTEM_MAPPING_META[key];
                const currentAccountId = customMappings[key] || '';
                return (
                  <div key={key} className="flex items-center gap-3 p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-indigo-600">{key}</span>
                        {meta && <span className="text-[10px] font-semibold text-slate-600">{meta.label}</span>}
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 font-bold">Custom</span>
                      </div>
                      {meta && <p className="text-[9px] text-slate-400 mt-0.5">{meta.description}</p>}
                    </div>
                    <select
                      value={currentAccountId}
                      onChange={(e) => setMapping(key, e.target.value)}
                      className="w-[220px] bg-white border border-slate-200 rounded-lg p-1.5 text-[10px] text-slate-700 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">— Select account —</option>
                      {accountOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeMapping(key)}
                      className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-500 hover:text-rose-700 transition cursor-pointer"
                      title="Remove custom mapping"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
          </>
        )}
      </div>

      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 text-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Add Custom Mapping</h3>
              </div>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-700 font-bold">Mapping Key * <span className="font-normal text-slate-500">(lowercase, underscores only)</span></label>
                <input
                  value={newKey}
                  onChange={e => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. recurring_deposit_income"
                  maxLength={64}
                />
                {newKey && <span className="text-[10px] text-slate-400 font-mono">Preview: {newKey || '—'}</span>}
              </div>
              <div className="space-y-1">
                <label className="text-slate-700 font-bold">Description</label>
                <input
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                  placeholder="Brief purpose of this mapping"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button onClick={() => setAddModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer">Cancel</button>
              <button onClick={handleAddCustom} disabled={!newKey.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md">Add Mapping</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
