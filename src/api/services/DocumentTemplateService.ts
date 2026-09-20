/**
 * Document Template Design Studio — Service
 * CRUD, versioning, and publishing for visual document templates.
 */
import { eq, and, desc, asc } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { documentTemplates, documentTemplateVersions } from '../../db/schema/documentTemplates';
import type { TemplateLayout } from '../../utils/templateTokens';

export class DocumentTemplateService {
  private get db() {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    return db;
  }

  // ── List ───────────────────────────────────────────────────────────────
  async listTemplates(organizationId: string, category?: string) {
    const conditions = [eq(documentTemplates.organizationId, organizationId)];
    if (category) conditions.push(eq(documentTemplates.category, category));
    return this.db.select().from(documentTemplates)
      .where(and(...conditions))
      .orderBy(asc(documentTemplates.category), asc(documentTemplates.name));
  }

  // ── Get One ────────────────────────────────────────────────────────────
  async getTemplate(id: string, organizationId: string) {
    const [template] = await this.db.select().from(documentTemplates)
      .where(and(eq(documentTemplates.id, id), eq(documentTemplates.organizationId, organizationId)))
      .limit(1);
    return template ?? null;
  }

  // ── Create ─────────────────────────────────────────────────────────────
  async createTemplate(organizationId: string, data: {
    category: string;
    subType?: string;
    name: string;
    description?: string;
    pageSize?: string;
    orientation?: string;
    layoutJson?: TemplateLayout;
    createdBy?: string;
  }) {
    const layout: TemplateLayout = data.layoutJson ?? { pageSize: { width: 210, height: 297 }, elements: [] };
    const [created] = await this.db.insert(documentTemplates).values({
      organizationId,
      category: data.category,
      subType: data.subType ?? null,
      name: data.name,
      description: data.description ?? null,
      pageSize: data.pageSize ?? 'A4',
      orientation: data.orientation ?? 'portrait',
      layoutJson: layout,
      status: 'draft',
      version: 1,
      createdBy: data.createdBy ?? null,
    }).returning();
    return created;
  }

  // ── Update (autosave draft) ────────────────────────────────────────────
  async updateTemplate(id: string, organizationId: string, data: {
    name?: string;
    description?: string;
    pageSize?: string;
    pageWidth?: number | null;
    pageHeight?: number | null;
    orientation?: string;
    margins?: any;
    layoutJson?: TemplateLayout;
    subType?: string;
    updatedBy?: string;
  }) {
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.pageSize !== undefined) updates.pageSize = data.pageSize;
    if (data.pageWidth !== undefined) updates.pageWidth = data.pageWidth;
    if (data.pageHeight !== undefined) updates.pageHeight = data.pageHeight;
    if (data.orientation !== undefined) updates.orientation = data.orientation;
    if (data.margins !== undefined) updates.margins = data.margins;
    if (data.layoutJson !== undefined) updates.layoutJson = data.layoutJson;
    if (data.subType !== undefined) updates.subType = data.subType;
    if (data.updatedBy) updates.updatedBy = data.updatedBy;

    const [updated] = await this.db.update(documentTemplates)
      .set(updates)
      .where(and(eq(documentTemplates.id, id), eq(documentTemplates.organizationId, organizationId)))
      .returning();
    return updated ?? null;
  }

  // ── Publish ────────────────────────────────────────────────────────────
  async publishTemplate(id: string, organizationId: string, publishedBy: string, changeNotes?: string) {
    const template = await this.getTemplate(id, organizationId);
    if (!template) throw new Error('Template not found.');
    if (template.status === 'published') throw new Error('Template is already published.');

    const newVersion = (template.version ?? 0) + 1;

    const [versionRecord] = await this.db.insert(documentTemplateVersions).values({
      templateId: id,
      version: newVersion,
      layoutJson: template.layoutJson,
      changeNotes: changeNotes ?? null,
      publishedBy,
    }).returning();

    const [updated] = await this.db.update(documentTemplates)
      .set({
        status: 'published',
        version: newVersion,
        activeVersionId: versionRecord.id,
        updatedAt: new Date(),
        updatedBy: publishedBy,
      })
      .where(eq(documentTemplates.id, id))
      .returning();

    return { template: updated, version: versionRecord };
  }

  // ── Unpublish (revert to draft) ────────────────────────────────────────
  async unpublishTemplate(id: string, organizationId: string) {
    const [updated] = await this.db.update(documentTemplates)
      .set({ status: 'draft', updatedAt: new Date() })
      .where(and(eq(documentTemplates.id, id), eq(documentTemplates.organizationId, organizationId)))
      .returning();
    return updated ?? null;
  }

  // ── Version History ────────────────────────────────────────────────────
  async listVersions(templateId: string, organizationId: string) {
    // Verify template belongs to org
    const template = await this.getTemplate(templateId, organizationId);
    if (!template) throw new Error('Template not found.');

    return this.db.select().from(documentTemplateVersions)
      .where(eq(documentTemplateVersions.templateId, templateId))
      .orderBy(desc(documentTemplateVersions.version));
  }

  // ── Restore Version ────────────────────────────────────────────────────
  async restoreVersion(templateId: string, versionId: string, organizationId: string, restoredBy: string) {
    const template = await this.getTemplate(templateId, organizationId);
    if (!template) throw new Error('Template not found.');

    const [version] = await this.db.select().from(documentTemplateVersions)
      .where(and(
        eq(documentTemplateVersions.id, versionId),
        eq(documentTemplateVersions.templateId, templateId),
      ))
      .limit(1);
    if (!version) throw new Error('Version not found.');

    // Update template with restored layout, bump version
    const newVersion = (template.version ?? 0) + 1;
    const [versionRecord] = await this.db.insert(documentTemplateVersions).values({
      templateId,
      version: newVersion,
      layoutJson: version.layoutJson,
      changeNotes: `Restored from version ${version.version}`,
      publishedBy: restoredBy,
    }).returning();

    const [updated] = await this.db.update(documentTemplates)
      .set({
        layoutJson: version.layoutJson,
        version: newVersion,
        activeVersionId: versionRecord.id,
        updatedAt: new Date(),
        updatedBy: restoredBy,
      })
      .where(eq(documentTemplates.id, templateId))
      .returning();

    return { template: updated, version: versionRecord };
  }

  // ── Clone ──────────────────────────────────────────────────────────────
  async cloneTemplate(id: string, organizationId: string, newName: string, createdBy?: string) {
    const source = await this.getTemplate(id, organizationId);
    if (!source) throw new Error('Template not found.');

    return this.createTemplate(organizationId, {
      category: source.category,
      subType: source.subType ?? undefined,
      name: newName,
      description: source.description ?? undefined,
      pageSize: source.pageSize ?? 'A4',
      orientation: source.orientation ?? 'portrait',
      layoutJson: source.layoutJson as TemplateLayout,
      createdBy,
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────
  async deleteTemplate(id: string, organizationId: string) {
    const template = await this.getTemplate(id, organizationId);
    if (!template) throw new Error('Template not found.');
    if (template.isSystem) throw new Error('System templates cannot be deleted.');

    await this.db.delete(documentTemplates)
      .where(and(eq(documentTemplates.id, id), eq(documentTemplates.organizationId, organizationId)));
    return true;
  }
}

export const documentTemplateService = new DocumentTemplateService();
