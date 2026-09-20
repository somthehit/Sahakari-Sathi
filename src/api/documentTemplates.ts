/**
 * Document Template Design Studio — Client API
 * Axios-based API calls for template CRUD, versioning, and publishing.
 */
import { apiClient } from '../lib/apiClient';
import type { TemplateLayout } from '../utils/templateTokens';

export interface DocumentTemplate {
  id: string;
  organizationId: string;
  category: string;
  subType: string | null;
  name: string;
  description: string | null;
  pageSize: string | null;
  pageWidth: number | null;
  pageHeight: number | null;
  orientation: string | null;
  margins: any;
  layoutJson: TemplateLayout;
  status: string | null;
  version: number | null;
  activeVersionId: string | null;
  isStarterTemplate: boolean | null;
  isSystem: boolean | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTemplateVersion {
  id: string;
  templateId: string;
  version: number;
  layoutJson: TemplateLayout;
  changeNotes: string | null;
  publishedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export const documentTemplateApi = {
  // ── List ───────────────────────────────────────────────────────────────
  async list(category?: string): Promise<DocumentTemplate[]> {
    const params = category ? { category } : {};
    const { data } = await apiClient.get('/document-templates', { params });
    return data;
  },

  // ── Get One ────────────────────────────────────────────────────────────
  async get(id: string): Promise<DocumentTemplate> {
    const { data } = await apiClient.get(`/document-templates/${id}`);
    return data;
  },

  // ── Create ─────────────────────────────────────────────────────────────
  async create(payload: {
    category: string;
    subType?: string;
    name: string;
    description?: string;
    pageSize?: string;
    orientation?: string;
    layoutJson?: TemplateLayout;
  }): Promise<DocumentTemplate> {
    const { data } = await apiClient.post('/document-templates', payload);
    return data;
  },

  // ── Update (autosave) ──────────────────────────────────────────────────
  async update(id: string, payload: Partial<{
    name: string;
    description: string;
    pageSize: string;
    pageWidth: number | null;
    pageHeight: number | null;
    orientation: string;
    margins: any;
    layoutJson: TemplateLayout;
    subType: string;
  }>): Promise<DocumentTemplate> {
    const { data } = await apiClient.put(`/document-templates/${id}`, payload);
    return data;
  },

  // ── Delete ─────────────────────────────────────────────────────────────
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/document-templates/${id}`);
  },

  // ── Publish ────────────────────────────────────────────────────────────
  async publish(id: string, changeNotes?: string): Promise<{ template: DocumentTemplate; version: DocumentTemplateVersion }> {
    const { data } = await apiClient.post(`/document-templates/${id}/publish`, { changeNotes });
    return data;
  },

  // ── Unpublish ──────────────────────────────────────────────────────────
  async unpublish(id: string): Promise<DocumentTemplate> {
    const { data } = await apiClient.post(`/document-templates/${id}/unpublish`);
    return data;
  },

  // ── Version History ────────────────────────────────────────────────────
  async listVersions(id: string): Promise<DocumentTemplateVersion[]> {
    const { data } = await apiClient.get(`/document-templates/${id}/versions`);
    return data;
  },

  // ── Restore Version ────────────────────────────────────────────────────
  async restoreVersion(id: string, versionId: string): Promise<{ template: DocumentTemplate; version: DocumentTemplateVersion }> {
    const { data } = await apiClient.post(`/document-templates/${id}/restore/${versionId}`);
    return data;
  },

  // ── Clone ──────────────────────────────────────────────────────────────
  async clone(id: string, newName: string): Promise<DocumentTemplate> {
    const { data } = await apiClient.post(`/document-templates/${id}/clone`, { newName });
    return data;
  },
};
