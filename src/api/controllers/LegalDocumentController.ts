/**
 * Legal Document Controller
 * HTTP layer for the Legal Document Generator Studio.
 */
import { Response } from 'express';
import { requireOrg, ScopeError } from '../middleware/scope';
import type { AuthRequest } from '../middleware/authMiddleware';
import { LegalDocumentRepository, type AuditEntry } from '../repositories/LegalDocumentRepository';

const fail = (res: Response, error: any) => {
  console.error('[LegalDoc]', error?.message, error?.code);
  if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
  const msg: string = error?.message ?? 'Request failed.';
  if (/not found/i.test(msg)) return res.status(404).json({ error: msg });
  if (error?.code === '23505') return res.status(409).json({ error: msg });
  return res.status(500).json({ error: msg });
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const actorId = (req: AuthRequest): string | null => {
  const id = req.user?.userId;
  return id && UUID.test(id) ? id : null;
};
const actorName = (req: AuthRequest): string =>
  req.user?.username || 'System';

const ok = (res: Response, data: any) => res.json(data);

export class LegalDocumentController {
  // ── Categories ──────────────────────────────────────────────────────────
  static async listCategories(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const rows = await LegalDocumentRepository.listCategories(orgId);
      ok(res, rows);
    } catch (e: any) { fail(res, e); }
  }

  static async createCategory(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const { name, code, description } = req.body;
      if (!name || !code) return res.status(400).json({ error: 'name and code are required' });
      const row = await LegalDocumentRepository.createCategory(orgId, { name, code: code.toUpperCase(), description });
      ok(res, row);
    } catch (e: any) { fail(res, e); }
  }

  // ── Templates ───────────────────────────────────────────────────────────
  static async listTemplates(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const { categoryId } = req.query as { categoryId?: string };
      const rows = await LegalDocumentRepository.listTemplates(orgId, categoryId);
      ok(res, rows);
    } catch (e: any) { fail(res, e); }
  }

  static async getTemplate(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const row = await LegalDocumentRepository.getTemplate(req.params.id);
      if (!row || row.legal_templates?.organizationId !== orgId) {
        return res.status(404).json({ error: 'Template not found' });
      }
      ok(res, row);
    } catch (e: any) { fail(res, e); }
  }

  static async createTemplate(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const { categoryId, name, description, applicableRules } = req.body;
      if (!categoryId || !name) return res.status(400).json({ error: 'categoryId and name are required' });
      const row = await LegalDocumentRepository.createTemplate(orgId, {
        categoryId, name, description, applicableRules,
        createdBy: actorId(req),
      });
      await LegalDocumentRepository.writeAudit({
        organizationId: orgId, entityType: 'template', entityId: row.id,
        action: 'created', actorId: actorId(req), actorName: actorName(req),
        details: { name },
      });
      ok(res, row);
    } catch (e: any) { fail(res, e); }
  }

  static async updateTemplate(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const existing = await LegalDocumentRepository.getTemplate(req.params.id);
      if (!existing || existing.legal_templates?.organizationId !== orgId) {
        return res.status(404).json({ error: 'Template not found' });
      }
      const row = await LegalDocumentRepository.updateTemplate(req.params.id, req.body);
      await LegalDocumentRepository.writeAudit({
        organizationId: orgId, entityType: 'template', entityId: req.params.id,
        action: 'updated', actorId: actorId(req), actorName: actorName(req),
        details: { changed: Object.keys(req.body) },
      });
      ok(res, row);
    } catch (e: any) { fail(res, e); }
  }

  // ── Versions ────────────────────────────────────────────────────────────
  static async listVersions(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const rows = await LegalDocumentRepository.listVersions(req.params.templateId);
      ok(res, rows);
    } catch (e: any) { fail(res, e); }
  }

  static async getVersion(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const row = await LegalDocumentRepository.getVersion(req.params.id);
      if (!row) return res.status(404).json({ error: 'Version not found' });
      ok(res, row);
    } catch (e: any) { fail(res, e); }
  }

  static async createVersion(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const { templateId } = req.params;
      const template = await LegalDocumentRepository.getTemplate(templateId);
      if (!template || template.legal_templates?.organizationId !== orgId) {
        return res.status(404).json({ error: 'Template not found' });
      }
      const { content, contentMd, changeNotes } = req.body;
      if (!content) return res.status(400).json({ error: 'content is required' });
      const nextVersion = (template.legal_templates?.currentVersion || 0) + 1;
      const row = await LegalDocumentRepository.createVersion(templateId, {
        versionNumber: nextVersion,
        content, contentMd, changeNotes,
        createdBy: actorId(req),
      });
      await LegalDocumentRepository.writeAudit({
        organizationId: orgId, entityType: 'version', entityId: row.id,
        action: 'version_created', actorId: actorId(req), actorName: actorName(req),
        details: { templateId, versionNumber: nextVersion },
      });
      ok(res, row);
    } catch (e: any) { fail(res, e); }
  }

  static async updateVersion(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const existing = await LegalDocumentRepository.getVersion(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Version not found' });
      if (existing.status === 'approved') return res.status(400).json({ error: 'Cannot edit approved version' });
      const row = await LegalDocumentRepository.updateVersion(req.params.id, req.body);
      ok(res, row);
    } catch (e: any) { fail(res, e); }
  }

  static async approveVersion(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const version = await LegalDocumentRepository.getVersion(req.params.id);
      if (!version) return res.status(404).json({ error: 'Version not found' });
      if (version.status === 'approved') return res.status(400).json({ error: 'Already approved' });
      const row = await LegalDocumentRepository.approveVersion(req.params.id, actorId(req) || '');
      await LegalDocumentRepository.writeAudit({
        organizationId: orgId, entityType: 'version', entityId: req.params.id,
        action: 'approved', actorId: actorId(req), actorName: actorName(req),
        details: { versionNumber: version.versionNumber },
      });
      ok(res, row);
    } catch (e: any) { fail(res, e); }
  }

  // ── Clauses ─────────────────────────────────────────────────────────────
  static async listClauses(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const { category } = req.query as { category?: string };
      const rows = await LegalDocumentRepository.listClauses(orgId, category);
      ok(res, rows);
    } catch (e: any) { fail(res, e); }
  }

  static async createClause(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const { name, clauseType, category, content, applicableRules, sortOrder } = req.body;
      if (!name || !content) return res.status(400).json({ error: 'name and content are required' });
      const row = await LegalDocumentRepository.createClause(orgId, {
        name, clauseType: clauseType || 'required', category, content, applicableRules, sortOrder,
        createdBy: actorId(req),
      });
      ok(res, row);
    } catch (e: any) { fail(res, e); }
  }

  // ── Document Generation ─────────────────────────────────────────────────
  static async generateDocument(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const { templateId, loanId, variables: overrideVars } = req.body;
      if (!templateId) return res.status(400).json({ error: 'templateId is required' });

      // 1. Get template + active version
      const template = await LegalDocumentRepository.getTemplate(templateId);
      if (!template || template.legal_templates?.organizationId !== orgId) {
        return res.status(404).json({ error: 'Template not found' });
      }
      const version = await LegalDocumentRepository.getActiveVersion(templateId);
      if (!version) return res.status(400).json({ error: 'No approved version. Please approve a template version first.' });

      // 2. Fetch loan data if loanId provided
      let loanData: any = null;
      if (loanId) {
        loanData = await LegalDocumentRepository.getLoanDataForGeneration(loanId, orgId);
        if (!loanData) return res.status(404).json({ error: 'Loan not found' });
      }

      // 3. Merge variables: loan data + manual overrides
      const variables = {
        ...(loanData || {}),
        ...(overrideVars || {}),
      };

      // 4. Resolve template content
      let content = version.content;
      // Replace {{variable}} placeholders
      content = content.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match: string, key: string) => {
        const keys = key.split('.');
        let val: any = variables;
        for (const k of keys) {
          val = val?.[k];
        }
        return val !== undefined && val !== null ? String(val) : match;
      });

      // 5. Generate document number
      const prefix = template.legal_templates?.name?.includes('Tamsuk') ? 'TMS' :
                     template.legal_templates?.name?.includes('Agreement') ? 'AGR' : 'DOC';
      const docNo = await LegalDocumentRepository.generateDocumentNo(orgId, prefix);

      // 6. Save document
      const doc = await LegalDocumentRepository.createDocument({
        organizationId: orgId,
        documentNo: docNo,
        templateId,
        templateVersionId: version.id,
        loanId: loanId || undefined,
        memberId: loanData?.memberId || undefined,
        generatedContent: content,
        inputVariables: variables,
        generatedBy: actorId(req),
      });

      // 7. Audit
      await LegalDocumentRepository.writeAudit({
        organizationId: orgId, entityType: 'document', entityId: doc.id,
        action: 'generated', actorId: actorId(req), actorName: actorName(req),
        details: { templateId, versionNumber: version.versionNumber, loanId: loanId || null, docNo },
      });

      ok(res, doc);
    } catch (e: any) { fail(res, e); }
  }

  static async listDocuments(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const { templateId, loanId, memberId } = req.query as Record<string, string | undefined>;
      const rows = await LegalDocumentRepository.listDocuments(orgId, { templateId, loanId, memberId });
      ok(res, rows);
    } catch (e: any) { fail(res, e); }
  }

  static async getDocument(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const row = await LegalDocumentRepository.getDocument(req.params.id);
      if (!row || row.organizationId !== orgId) {
        return res.status(404).json({ error: 'Document not found' });
      }
      ok(res, row);
    } catch (e: any) { fail(res, e); }
  }

  static async markPrinted(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const existing = await LegalDocumentRepository.getDocument(req.params.id);
      if (!existing || existing.organizationId !== orgId) {
        return res.status(404).json({ error: 'Document not found' });
      }
      const row = await LegalDocumentRepository.updateDocument(req.params.id, {
        status: 'printed',
        printedAt: new Date(),
        printCount: (existing.printCount || 0) + 1,
      });
      await LegalDocumentRepository.writeAudit({
        organizationId: orgId, entityType: 'document', entityId: req.params.id,
        action: 'printed', actorId: actorId(req), actorName: actorName(req),
      });
      ok(res, row);
    } catch (e: any) { fail(res, e); }
  }

  // ── Audit Trail ─────────────────────────────────────────────────────────
  static async getAuditTrail(req: AuthRequest, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const { entityType, entityId } = req.query as { entityType?: string; entityId?: string };
      if (!entityType || !entityId) return res.status(400).json({ error: 'entityType and entityId are required' });
      const rows = await LegalDocumentRepository.getAuditTrail(entityType, entityId);
      ok(res, rows);
    } catch (e: any) { fail(res, e); }
  }
}
