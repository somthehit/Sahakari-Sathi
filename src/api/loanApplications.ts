/**
 * Loan Application API — CRUD, document management, and submission validation.
 * Uses the Supabase DB schema from loanApplications.ts.
 */
import { supabase } from '../lib/supabaseClient';

// ───────────────────────── Types ─────────────────────────

export interface CollateralInput {
  collateralType: string;
  ownerName: string;
  ownershipDocNumber: string;
  province: string;
  district: string;
  municipality: string;
  wardNo: string;
  kittaNo: string;
  areaDetail: string;
  assessedValuation: number;
  valuationDoneBy: string;
  valuationDateBs: string;
  landOfficeName: string;
  boundaryEast: string;
  boundaryWest: string;
  boundaryNorth: string;
  boundarySouth: string;
  buildingDetail: string;
  insuranceRequired: boolean;
  insurancePolicyNo: string;
}

export interface GuarantorInput {
  guarantorMemberId?: string;
  fullName: string;
  relationshipToBorrower: string;
  citizenshipNo: string;
  address: string;
  monthlyIncome: number;
  incomeSource: string;
  signatureCollected: boolean;
}

export interface LoanApplicationInput {
  borrowerId: string;
  coBorrowerId?: string;
  loanProductId: string;
  requestedAmount: number;
  tenureMonths: number;
  purposeCategory: string;
  purposeDetail: string;
  repaymentFrequency: string;
  gracePeriodDays: number;
  collaterals: CollateralInput[];
  guarantors: GuarantorInput[];
  customGlMappings?: Record<string, string>;
}

export interface LoanApplicationRecord {
  id: string;
  borrowerId: string;
  borrowerName?: string;
  loanProductId: string;
  productName?: string;
  requestedAmount: number;
  approvedAmount: number | null;
  tenureMonths: number;
  purposeCategory: string | null;
  purposeDetail: string | null;
  repaymentFrequency: string | null;
  gracePeriodDays: number | null;
  cibCheckStatus: string | null;
  cibCheckedAt: string | null;
  ltvRatio: number | null;
  riskGrade: string | null;
  calculatedEmi: number | null;
  status: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  customGlMappings: Record<string, string> | null;
  remarks: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DocumentRecord {
  id: string;
  loanApplicationId: string;
  documentType: string;
  documentStage: string | null;
  fileUrl: string;
  uploadedAt: string | null;
  uploadedBy: string | null;
  verified: boolean | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  remarks: string | null;
}

// ───────────────────────── Required Document Checklist ─────────────────────────

export const REQUIRED_DOCUMENTS = [
  { type: 'kyc_photo', label: 'KYC / Citizenship Photo', category: 'identity' },
  { type: 'income_proof', label: 'Income Proof ( payslip / tax clearance )', category: 'income' },
  { type: 'collateral_ownership', label: 'Collateral Ownership Document', category: 'collateral' },
  { type: 'collateral_valuation', label: 'Collateral Valuation Report', category: 'collateral' },
  { type: 'salary_slip', label: 'Salary Slip ( last 3 months )', category: 'income' },
  { type: 'bank_statement', label: 'Bank Statement ( last 6 months )', category: 'income' },
  { type: 'guarantor_citizenship', label: 'Guarantor Citizenship', category: 'guarantor' },
  { type: 'guarantor_income', label: 'Guarantor Income Statement', category: 'guarantor' },
  { type: 'signature_specimen', label: 'Signature Specimen (Borrower & Guarantor)', category: 'identity' },
  { type: 'demand_draft', label: 'Loan Demand Draft (ऋण माग फारम)', category: 'legal' },
] as const;

export type DocumentType = (typeof REQUIRED_DOCUMENTS)[number]['type'];

// ───────────────────────── CRUD ─────────────────────────

export async function createLoanApplication(input: LoanApplicationInput): Promise<LoanApplicationRecord> {
  const { data: app, error: appErr } = await supabase
    .from('loan_applications')
    .insert({
      borrower_id: input.borrowerId,
      co_borrower_id: input.coBorrowerId || null,
      loan_product_id: input.loanProductId,
      requested_amount: input.requestedAmount,
      tenure_months: input.tenureMonths,
      purpose_category: input.purposeCategory,
      purpose_detail: input.purposeDetail,
      repayment_frequency: input.repaymentFrequency,
      grace_period_days: input.gracePeriodDays,
      custom_gl_mappings: input.customGlMappings || {},
      status: 'draft',
    })
    .select()
    .single();

  if (appErr) throw new Error(`Failed to create loan application: ${appErr.message}`);

  // Insert collaterals
  if (input.collaterals.length > 0) {
    const { error: cErr } = await supabase.from('loan_collaterals').insert(
      input.collaterals.map(c => ({
        loan_application_id: app.id,
        collateral_type: c.collateralType,
        owner_name: c.ownerName,
        ownership_doc_number: c.ownershipDocNumber,
        province: c.province,
        district: c.district,
        municipality: c.municipality,
        ward_no: c.wardNo,
        kitta_no: c.kittaNo,
        area_detail: c.areaDetail,
        assessed_valuation: c.assessedValuation,
        valuation_done_by: c.valuationDoneBy,
        valuation_date_bs: c.valuationDateBs,
        insurance_required: c.insuranceRequired,
        insurance_policy_no: c.insurancePolicyNo,
      }))
    );
    if (cErr) throw new Error(`Failed to save collaterals: ${cErr.message}`);
  }

  // Insert guarantors
  if (input.guarantors.length > 0) {
    const { error: gErr } = await supabase.from('loan_guarantors').insert(
      input.guarantors.map(g => ({
        loan_application_id: app.id,
        guarantor_member_id: g.guarantorMemberId || null,
        full_name: g.fullName,
        relationship_to_borrower: g.relationshipToBorrower,
        citizenship_no: g.citizenshipNo,
        address: g.address,
        monthly_income: g.monthlyIncome,
        income_source: g.incomeSource,
        signature_collected: g.signatureCollected,
      }))
    );
    if (gErr) throw new Error(`Failed to save guarantors: ${gErr.message}`);
  }

  return app as unknown as LoanApplicationRecord;
}

export async function getLoanApplications(orgId: string): Promise<LoanApplicationRecord[]> {
  const { data, error } = await supabase
    .from('loan_applications')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch loan applications: ${error.message}`);
  return (data || []) as unknown as LoanApplicationRecord[];
}

export async function updateLoanApplicationStatus(
  appId: string,
  status: string,
  remarks?: string
): Promise<void> {
  const update: Record<string, any> = { status, updated_at: new Date().toISOString() };
  if (remarks) update.remarks = remarks;
  if (status === 'approved') {
    update.approved_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('loan_applications')
    .update(update)
    .eq('id', appId);

  if (error) throw new Error(`Failed to update application: ${error.message}`);
}

// ───────────────────────── Documents ─────────────────────────

export async function uploadLoanDocument(
  loanApplicationId: string,
  documentType: string,
  fileUrl: string,
  uploadedBy: string
): Promise<DocumentRecord> {
  const { data, error } = await supabase
    .from('loan_documents')
    .insert({
      loan_application_id: loanApplicationId,
      document_type: documentType,
      file_url: fileUrl,
      uploaded_by: uploadedBy,
      document_stage: 'uploaded',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to upload document: ${error.message}`);
  return data as unknown as DocumentRecord;
}

export async function verifyLoanDocument(
  docId: string,
  verifiedBy: string,
  remarks: string,
  approved: boolean
): Promise<void> {
  const { error } = await supabase
    .from('loan_documents')
    .update({
      verified: approved,
      verified_by: verifiedBy,
      verified_at: new Date().toISOString(),
      document_stage: approved ? 'verified' : 'rejected',
      remarks,
    })
    .eq('id', docId);

  if (error) throw new Error(`Failed to verify document: ${error.message}`);
}

export async function uploadSignedDocument(
  loanApplicationId: string,
  templateType: string,
  fileUrl: string,
  uploadedBy: string
): Promise<void> {
  const { error } = await supabase.from('loan_documents').insert({
    loan_application_id: loanApplicationId,
    document_type: templateType,
    file_url: fileUrl,
    uploaded_by: uploadedBy,
    document_stage: 'signed',
  });

  if (error) throw new Error(`Failed to upload signed document: ${error.message}`);
}

export async function getLoanDocuments(loanApplicationId: string): Promise<DocumentRecord[]> {
  const { data, error } = await supabase
    .from('loan_documents')
    .select('*')
    .eq('loan_application_id', loanApplicationId)
    .order('uploaded_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
  return (data || []) as unknown as DocumentRecord[];
}

export async function getCollaterals(loanApplicationId: string) {
  const { data, error } = await supabase
    .from('loan_collaterals')
    .select('*')
    .eq('loan_application_id', loanApplicationId);

  if (error) throw new Error(`Failed to fetch collaterals: ${error.message}`);
  return data || [];
}

export async function getGuarantors(loanApplicationId: string) {
  const { data, error } = await supabase
    .from('loan_guarantors')
    .select('*')
    .eq('loan_application_id', loanApplicationId);

  if (error) throw new Error(`Failed to fetch guarantors: ${error.message}`);
  return data || [];
}

// ───────────────────────── Submission Validation ─────────────────────────

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  docsUploaded: number;
  docsRequired: number;
  guarantorsCount: number;
  guarantorsMinimumMet: boolean;
  totalCollateralValue: number;
  ltvRatio: number;
  ltvAcceptable: boolean;
  cibPassed: boolean;
}

export async function validateSubmission(
  applicationId: string,
  requestedAmount: number
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check documents
  const docs = await getLoanDocuments(applicationId);
  const docsUploaded = docs.length;
  const docsRequired = REQUIRED_DOCUMENTS.length;
  if (docsUploaded < docsRequired) {
    errors.push(`Document checklist incomplete: ${docsUploaded}/${docsRequired} uploaded.`);
  }

  // 2. Check guarantors
  const guarantors = await getGuarantors(applicationId);
  const guarantorsCount = guarantors.length;
  const guarantorsMinimumMet = guarantorsCount >= 1;
  if (!guarantorsMinimumMet) {
    errors.push('At least one guarantor is required.');
  }

  // 3. Check collateral & LTV
  const collaterals = await getCollaterals(applicationId);
  const totalCollateralValue = collaterals.reduce(
    (sum: number, c: any) => sum + (parseFloat(c.assessed_valuation) || 0),
    0
  );
  const ltvRatio = totalCollateralValue > 0
    ? Math.round((requestedAmount / totalCollateralValue) * 100)
    : 0;
  const ltvAcceptable = ltvRatio <= 80;
  if (!ltvAcceptable) {
    errors.push(`LTV ratio ${ltvRatio}% exceeds maximum allowed (80%).`);
  }
  if (totalCollateralValue === 0) {
    warnings.push('No collateral valuation found. Application may be rejected.');
  }

  // 4. Check CIB status
  const { data: app } = await supabase
    .from('loan_applications')
    .select('cib_check_status')
    .eq('id', applicationId)
    .single();
  const cibPassed = (app as any)?.cib_check_status === 'passed';
  if (!cibPassed) {
    warnings.push('CIB check has not been passed yet. Submission may be rejected.');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    docsUploaded,
    docsRequired,
    guarantorsCount,
    guarantorsMinimumMet,
    totalCollateralValue,
    ltvRatio,
    ltvAcceptable,
    cibPassed,
  };
}
