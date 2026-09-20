/**
 * Legal Document Repository
 * Data access layer for the Legal Document Generator Studio.
 * Handles template CRUD, version management, document generation, and audit trail.
 */
import { eq, and, asc, desc, sql, inArray } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  legalTemplateCategories,
  legalTemplates,
  legalTemplateVersions,
  legalTemplateClauses,
  legalDocuments,
  legalDocumentAudits,
  loanAccounts,
  members,
  memberKycProfiles,
  memberFamily,
  guarantors,
  loanCollaterals,
  loanProducts,
  organizations,
  orgUsers,
} from '../../db/schema';

export interface AuditEntry {
  organizationId: string;
  entityType: 'template' | 'version' | 'document' | 'clause';
  entityId: string;
  action: string;
  actorId?: string;
  actorName?: string;
  details?: Record<string, any>;
}

export class LegalDocumentRepository {
  // ── Categories ──────────────────────────────────────────────────────────
  static async listCategories(organizationId: string) {
    const db = getDb();
    return db
      .select()
      .from(legalTemplateCategories)
      .where(eq(legalTemplateCategories.organizationId, organizationId))
      .orderBy(asc(legalTemplateCategories.sortOrder));
  }

  static async createCategory(organizationId: string, data: { name: string; code: string; description?: string }) {
    const db = getDb();
    const [row] = await db
      .insert(legalTemplateCategories)
      .values({ organizationId, ...data })
      .returning();
    return row;
  }

  // ── Templates ───────────────────────────────────────────────────────────
  static async listTemplates(organizationId: string, categoryId?: string) {
    const db = getDb();
    const conditions = [eq(legalTemplates.organizationId, organizationId)];
    if (categoryId) conditions.push(eq(legalTemplates.categoryId, categoryId));
    const rows = await db
      .select({
        id: legalTemplates.id,
        name: legalTemplates.name,
        description: legalTemplates.description,
        status: legalTemplates.status,
        currentVersion: legalTemplates.currentVersion,
        activeVersionId: legalTemplates.activeVersionId,
        categoryId: legalTemplates.categoryId,
        categoryName: legalTemplateCategories.name,
        applicableRules: legalTemplates.applicableRules,
        fontStyle: legalTemplates.fontStyle,
        fontSize: legalTemplates.fontSize,
        pageLayout: legalTemplates.pageLayout,
        createdAt: legalTemplates.createdAt,
        updatedAt: legalTemplates.updatedAt,
      })
      .from(legalTemplates)
      .leftJoin(legalTemplateCategories, eq(legalTemplates.categoryId, legalTemplateCategories.id))
      .where(and(...conditions))
      .orderBy(desc(legalTemplates.updatedAt));
    return rows;
  }

  static async getTemplate(id: string) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(legalTemplates)
      .leftJoin(legalTemplateCategories, eq(legalTemplates.categoryId, legalTemplateCategories.id))
      .where(eq(legalTemplates.id, id))
      .limit(1);
    return row || null;
  }

  static async createTemplate(organizationId: string, data: {
    categoryId: string;
    name: string;
    description?: string;
    applicableRules?: any;
    createdBy?: string;
  }) {
    const db = getDb();
    const [row] = await db
      .insert(legalTemplates)
      .values({ organizationId, ...data, status: 'draft', currentVersion: 0 })
      .returning();
    return row;
  }

  static async updateTemplate(id: string, data: Record<string, any>) {
    const db = getDb();
    const [row] = await db
      .update(legalTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(legalTemplates.id, id))
      .returning();
    return row;
  }

  // ── Versions ────────────────────────────────────────────────────────────
  static async listVersions(templateId: string) {
    const db = getDb();
    return db
      .select({
        id: legalTemplateVersions.id,
        versionNumber: legalTemplateVersions.versionNumber,
        status: legalTemplateVersions.status,
        changeNotes: legalTemplateVersions.changeNotes,
        isCurrent: legalTemplateVersions.isCurrent,
        approvedBy: legalTemplateVersions.approvedBy,
        approvedAt: legalTemplateVersions.approvedAt,
        rejectionReason: legalTemplateVersions.rejectionReason,
        createdBy: legalTemplateVersions.createdBy,
        createdAt: legalTemplateVersions.createdAt,
      })
      .from(legalTemplateVersions)
      .where(eq(legalTemplateVersions.templateId, templateId))
      .orderBy(desc(legalTemplateVersions.versionNumber));
  }

  static async getVersion(id: string) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(legalTemplateVersions)
      .where(eq(legalTemplateVersions.id, id))
      .limit(1);
    return row || null;
  }

  static async getActiveVersion(templateId: string) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(legalTemplateVersions)
      .where(and(
        eq(legalTemplateVersions.templateId, templateId),
        eq(legalTemplateVersions.isCurrent, true),
      ))
      .limit(1);
    return row || null;
  }

  static async createVersion(templateId: string, data: {
    versionNumber: number;
    content: string;
    contentMd?: string;
    changeNotes?: string;
    createdBy?: string;
  }) {
    const db = getDb();
    const [row] = await db
      .insert(legalTemplateVersions)
      .values({ templateId, ...data, status: 'draft', isCurrent: false })
      .returning();
    return row;
  }

  static async updateVersion(id: string, data: Record<string, any>) {
    const db = getDb();
    const [row] = await db
      .update(legalTemplateVersions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(legalTemplateVersions.id, id))
      .returning();
    return row;
  }

  static async approveVersion(id: string, approvedBy: string) {
    const db = getDb();
    const version = await this.getVersion(id);
    if (!version) throw new Error('Version not found');

    // Mark this version as current, unset previous current
    await db
      .update(legalTemplateVersions)
      .set({ isCurrent: false })
      .where(and(
        eq(legalTemplateVersions.templateId, version.templateId),
        eq(legalTemplateVersions.isCurrent, true),
      ));

    const [row] = await db
      .update(legalTemplateVersions)
      .set({
        status: 'approved',
        isCurrent: true,
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(legalTemplateVersions.id, id))
      .returning();

    // Update template to point to this version
    await db
      .update(legalTemplates)
      .set({
        activeVersionId: id,
        currentVersion: version.versionNumber,
        status: 'approved',
        updatedAt: new Date(),
      })
      .where(eq(legalTemplates.id, version.templateId));

    return row;
  }

  // ── Clauses ─────────────────────────────────────────────────────────────
  static async listClauses(organizationId: string, category?: string) {
    const db = getDb();
    const conditions = [eq(legalTemplateClauses.organizationId, organizationId)];
    if (category) conditions.push(eq(legalTemplateClauses.category, category));
    return db
      .select()
      .from(legalTemplateClauses)
      .where(and(...conditions))
      .orderBy(asc(legalTemplateClauses.sortOrder));
  }

  static async createClause(organizationId: string, data: {
    name: string;
    clauseType: string;
    category?: string;
    content: string;
    applicableRules?: any;
    sortOrder?: number;
    createdBy?: string;
  }) {
    const db = getDb();
    const [row] = await (db as any)
      .insert(legalTemplateClauses)
      .values({
        organizationId,
        name: data.name,
        clauseType: data.clauseType,
        category: data.category,
        content: data.content,
        applicableRules: data.applicableRules,
        sortOrder: data.sortOrder,
        createdBy: data.createdBy,
      })
      .returning();
    return row;
  }

  // ── Generated Documents ─────────────────────────────────────────────────
  static async listDocuments(organizationId: string, opts?: { templateId?: string; loanId?: string; memberId?: string }) {
    const db = getDb();
    const conditions = [eq(legalDocuments.organizationId, organizationId)];
    if (opts?.templateId) conditions.push(eq(legalDocuments.templateId, opts.templateId));
    if (opts?.loanId) conditions.push(eq(legalDocuments.loanId, opts.loanId));
    if (opts?.memberId) conditions.push(eq(legalDocuments.memberId, opts.memberId));
    return db
      .select({
        id: legalDocuments.id,
        documentNo: legalDocuments.documentNo,
        templateId: legalDocuments.templateId,
        loanId: legalDocuments.loanId,
        memberId: legalDocuments.memberId,
        status: legalDocuments.status,
        generatedBy: legalDocuments.generatedBy,
        generatedAt: legalDocuments.createdAt,
        printCount: legalDocuments.printCount,
      })
      .from(legalDocuments)
      .where(and(...conditions))
      .orderBy(desc(legalDocuments.createdAt));
  }

  static async getDocument(id: string) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.id, id))
      .limit(1);
    return row || null;
  }

  static async createDocument(data: {
    organizationId: string;
    documentNo: string;
    templateId: string;
    templateVersionId: string;
    loanId?: string;
    memberId?: string;
    generatedContent: string;
    inputVariables?: any;
    generatedBy?: string;
  }) {
    const db = getDb();
    const [row] = await db
      .insert(legalDocuments)
      .values(data)
      .returning();
    return row;
  }

  static async updateDocument(id: string, data: { status?: string; printedAt?: Date; printCount?: number; notes?: string }) {
    const db = getDb();
    const [row] = await (db as any)
      .update(legalDocuments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(legalDocuments.id, id))
      .returning();
    return row;
  }

  // ── Audit ───────────────────────────────────────────────────────────────
  static async writeAudit(entry: AuditEntry) {
    const db = getDb();
    await (db as any).insert(legalDocumentAudits).values({
      organizationId: entry.organizationId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      actorId: entry.actorId,
      actorName: entry.actorName,
      details: entry.details,
    });
  }

  static async getAuditTrail(entityType: string, entityId: string) {
    const db = getDb();
    return (db as any)
      .select()
      .from(legalDocumentAudits)
      .where(and(
        eq(legalDocumentAudits.entityType, entityType as any),
        eq(legalDocumentAudits.entityId, entityId),
      ))
      .orderBy(desc(legalDocumentAudits.createdAt));
  }

  // ── Document Number Generator ───────────────────────────────────────────
  static async generateDocumentNo(organizationId: string, prefix: string): Promise<string> {
    const db = getDb();
    const year = new Date().getFullYear();
    const pattern = `${prefix}-${year}-%`;

    const result = await db.execute(
      sql`SELECT COUNT(*)::int as cnt FROM legal_documents WHERE organization_id = ${organizationId} AND document_no LIKE ${pattern}`
    );
    const rows = result as any[];
    const count = rows?.[0]?.cnt ?? 0;
    return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  // ── Data Fetching for Document Generation ───────────────────────────────
  static async getLoanDataForGeneration(loanId: string, organizationId: string) {
    const db = getDb();

    // Fetch loan + member base data
    const [directLoan] = await db
      .select({
        id: loanAccounts.id,
        loanNo: loanAccounts.loanNo,
        approvedAmount: loanAccounts.approvedAmount,
        interestRate: loanAccounts.interestRate,
        tenureMonths: loanAccounts.tenureMonths,
        monthlyEmi: loanAccounts.monthlyEmi,
        productName: loanAccounts.productName,
        status: loanAccounts.status,
        memberId: loanAccounts.memberId,
        memberName: loanAccounts.memberName,
        memberNo: loanAccounts.memberNo,
        dobBs: members.dobBs,
        dobAd: members.dobAd,
        phone: members.phone,
      })
      .from(loanAccounts)
      .innerJoin(members, eq(loanAccounts.memberId, members.id))
      .where(and(
        eq(loanAccounts.id, loanId),
        eq(loanAccounts.organizationId, organizationId),
      ))
      .limit(1);

    if (!directLoan) return null;

    // Fetch KYC profile for citizenship + address
    const [kyc] = await db
      .select()
      .from(memberKycProfiles)
      .where(eq(memberKycProfiles.memberId, directLoan.memberId))
      .limit(1);

    // Fetch family for father name
    const [family] = await db
      .select()
      .from(memberFamily)
      .where(eq(memberFamily.memberId, directLoan.memberId))
      .limit(1);

    // Calculate age from dobAd or dobBs
    let age: number | null = null;
    if (directLoan.dobAd) {
      const birth = new Date(directLoan.dobAd);
      const today = new Date();
      age = today.getFullYear() - birth.getFullYear();
      if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) {
        age--;
      }
    }

    const loan = {
      ...directLoan,
      fatherName: family?.fatherName || '',
      citizenshipNo: kyc?.citizenshipNo || '',
      address: kyc?.address || '',
      district: kyc?.district || '',
      age,
    };

    return this._enrichLoanData(loan, organizationId);
  }

  private static async _enrichLoanData(loan: any, organizationId: string) {
    const db = getDb();

    // Fetch guarantors
    const loanGuarantors = await db
      .select()
      .from(guarantors)
      .where(eq(guarantors.loanId, loan.id));

    // Fetch collaterals
    const loanCollateralData = await db
      .select()
      .from(loanCollaterals)
      .where(eq(loanCollaterals.loanId, loan.id));

    // Fetch organization
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    return {
      ...loan,
      // Flatten for template variable access
      borrowerName: loan.memberName,
      borrowerFatherName: loan.fatherName,
      borrowerAddress: loan.address,
      borrowerCitizenshipNo: loan.citizenshipNo,
      borrowerPhone: loan.phone,
      borrowerMemberNo: loan.memberNo,
      borrowerAge: loan.age,
      // Loan fields
      loanNo: loan.loanNo,
      loanAmount: loan.approvedAmount,
      emiAmount: loan.monthlyEmi,
      loanProductName: loan.productName,
      // Guarantor fields (first guarantor)
      guarantorName: loanGuarantors[0]?.guarantorName || '',
      guarantorCitizenship: loanGuarantors[0]?.citizenshipNo || '',
      guarantorAddress: '',
      guarantorRelationship: loanGuarantors[0]?.relationship || '',
      // Collateral fields (first collateral)
      collateralType: loanCollateralData[0]?.collateralType || '',
      collateralDescription: loanCollateralData[0]?.description || '',
      collateralValuation: loanCollateralData[0]?.valuation || '0',
      // Organization
      organization: org,
      // Flags
      hasGuarantor: loanGuarantors.length > 0,
      hasCollateral: loanCollateralData.length > 0,
      guarantors: loanGuarantors,
      collaterals: loanCollateralData,
    };
  }
}
