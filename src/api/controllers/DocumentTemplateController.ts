/**
 * Document Template Design Studio — Controller
 * Express route handlers for template CRUD, versioning, and publishing.
 */
import { Request, Response } from 'express';
import { requireOrg, getActorName } from '../middleware/scope';
import { documentTemplateService } from '../services/DocumentTemplateService';

export class DocumentTemplateController {

  // ── GET /api/v1/document-templates?category=receipt ────────────────────
  static async list(req: Request, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const category = req.query.category as string | undefined;
      const templates = await documentTemplateService.listTemplates(orgId, category);
      res.json(templates);
    } catch (err: any) {
      console.error('[DocumentTemplateController.list]', err);
      res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/v1/document-templates/:id ─────────────────────────────────
  static async get(req: Request, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const template = await documentTemplateService.getTemplate(req.params.id, orgId);
      if (!template) return res.status(404).json({ error: 'Template not found.' });
      res.json(template);
    } catch (err: any) {
      res.status(500).json({ error: err.message, stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined });
    }
  }

  // ── POST /api/v1/document-templates ────────────────────────────────────
  static async create(req: Request, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const { category, subType, name, description, pageSize, orientation, layoutJson } = req.body;
      if (!category || !name) {
        return res.status(400).json({ error: 'category and name are required.' });
      }
      const template = await documentTemplateService.createTemplate(orgId, {
        category, subType, name, description, pageSize, orientation, layoutJson,
        createdBy: getActorName(req),
      });
      res.status(201).json(template);
    } catch (err: any) {
      console.error('[DocumentTemplateController.create]', err);
      res.status(500).json({ error: err.message, stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined });
    }
  }

  // ── PUT /api/v1/document-templates/:id ─────────────────────────────────
  static async update(req: Request, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const template = await documentTemplateService.updateTemplate(req.params.id, orgId, {
        ...req.body,
        updatedBy: getActorName(req),
      });
      if (!template) return res.status(404).json({ error: 'Template not found.' });
      res.json(template);
    } catch (err: any) {
      console.error('[DocumentTemplateController.update]', err);
      res.status(500).json({ error: err.message, stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined });
    }
  }

  // ── DELETE /api/v1/document-templates/:id ──────────────────────────────
  static async delete(req: Request, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      await documentTemplateService.deleteTemplate(req.params.id, orgId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  // ── POST /api/v1/document-templates/:id/publish ────────────────────────
  static async publish(req: Request, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const { changeNotes } = req.body;
      const result = await documentTemplateService.publishTemplate(
        req.params.id, orgId, getActorName(req), changeNotes,
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  // ── POST /api/v1/document-templates/:id/unpublish ──────────────────────
  static async unpublish(req: Request, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const template = await documentTemplateService.unpublishTemplate(req.params.id, orgId);
      if (!template) return res.status(404).json({ error: 'Template not found.' });
      res.json(template);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  // ── GET /api/v1/document-templates/:id/versions ────────────────────────
  static async listVersions(req: Request, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const versions = await documentTemplateService.listVersions(req.params.id, orgId);
      res.json(versions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/v1/document-templates/:id/restore/:versionId ─────────────
  static async restoreVersion(req: Request, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const result = await documentTemplateService.restoreVersion(
        req.params.id, req.params.versionId, orgId, getActorName(req),
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  // ── POST /api/v1/document-templates/:id/clone ──────────────────────────
  static async clone(req: Request, res: Response) {
    try {
      const orgId = requireOrg(req, res);
      if (!orgId) return;
      const { newName } = req.body;
      if (!newName) return res.status(400).json({ error: 'newName is required.' });
      const template = await documentTemplateService.cloneTemplate(
        req.params.id, orgId, newName, getActorName(req),
      );
      res.status(201).json(template);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
}
