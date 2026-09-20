/**
 * Legal Document Generator Studio — API Client
 */
import { apiClient } from '../lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────
export interface LegalTemplateCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  sortOrder?: number;
  isActive: boolean;
}

export interface LegalTemplate {
  id: string;
  name: string;
  description?: string;
  status: string;
  currentVersion: number;
  activeVersionId?: string;
  categoryId: string;
  categoryName?: string;
  applicableRules?: Record<string, any>;
  fontStyle?: string;
  fontSize?: number;
  pageLayout?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegalTemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  status: string;
  content: string;
  contentMd?: string;
  changeNotes?: string;
  isCurrent: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdBy?: string;
  createdAt: string;
}

export interface LegalTemplateClause {
  id: string;
  name: string;
  clauseType: string;
  category?: string;
  content: string;
  applicableRules?: Record<string, any>;
  sortOrder?: number;
  isActive: boolean;
}

export interface LegalDocument {
  id: string;
  documentNo: string;
  templateId: string;
  templateVersionId: string;
  loanId?: string;
  memberId?: string;
  generatedContent: string;
  inputVariables?: Record<string, any>;
  status: string;
  generatedBy?: string;
  printCount?: number;
  notes?: string;
  createdAt: string;
}

export interface LegalAuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  actorName?: string;
  details?: Record<string, any>;
  createdAt: string;
}

// ── API Calls ─────────────────────────────────────────────────────────────

// Categories
export const fetchLegalCategories = () =>
  apiClient.get<LegalTemplateCategory[]>('/legal-docs/categories').then(r => r.data);

export const createLegalCategory = (data: { name: string; code: string; description?: string }) =>
  apiClient.post<LegalTemplateCategory>('/legal-docs/categories', data).then(r => r.data);

// Templates
export const fetchLegalTemplates = (categoryId?: string) =>
  apiClient.get<LegalTemplate[]>('/legal-docs/templates', { params: { categoryId } }).then(r => r.data);

export const fetchLegalTemplate = (id: string) =>
  apiClient.get<{ legal_templates: LegalTemplate; legal_template_categories: LegalTemplateCategory }>(`/legal-docs/templates/${id}`).then(r => r.data);

export const createLegalTemplate = (data: {
  categoryId: string; name: string; description?: string; applicableRules?: any;
}) => apiClient.post<LegalTemplate>('/legal-docs/templates', data).then(r => r.data);

export const updateLegalTemplate = (id: string, data: Partial<LegalTemplate>) =>
  apiClient.put<LegalTemplate>(`/legal-docs/templates/${id}`, data).then(r => r.data);

// Versions
export const fetchLegalVersions = (templateId: string) =>
  apiClient.get<LegalTemplateVersion[]>(`/legal-docs/templates/${templateId}/versions`).then(r => r.data);

export const fetchLegalVersion = (id: string) =>
  apiClient.get<LegalTemplateVersion>(`/legal-docs/versions/${id}`).then(r => r.data);

export const createLegalVersion = (templateId: string, data: {
  content: string; contentMd?: string; changeNotes?: string;
}) => apiClient.post<LegalTemplateVersion>(`/legal-docs/templates/${templateId}/versions`, data).then(r => r.data);

export const updateLegalVersion = (id: string, data: Partial<LegalTemplateVersion>) =>
  apiClient.put<LegalTemplateVersion>(`/legal-docs/versions/${id}`, data).then(r => r.data);

export const approveLegalVersion = (id: string) =>
  apiClient.post<LegalTemplateVersion>(`/legal-docs/versions/${id}/approve`).then(r => r.data);

// Clauses
export const fetchLegalClauses = (category?: string) =>
  apiClient.get<LegalTemplateClause[]>('/legal-docs/clauses', { params: { category } }).then(r => r.data);

export const createLegalClause = (data: {
  name: string; clauseType: string; category?: string; content: string;
  applicableRules?: any; sortOrder?: number;
}) => apiClient.post<LegalTemplateClause>('/legal-docs/clauses', data).then(r => r.data);

// Documents
export const generateLegalDocument = (data: {
  templateId: string; loanId?: string; variables?: Record<string, any>;
}) => apiClient.post<LegalDocument>('/legal-docs/generate', data).then(r => r.data);

export const fetchLegalDocuments = (params?: { templateId?: string; loanId?: string; memberId?: string }) =>
  apiClient.get<LegalDocument[]>('/legal-docs/documents', { params }).then(r => r.data);

export const fetchLegalDocument = (id: string) =>
  apiClient.get<LegalDocument>(`/legal-docs/documents/${id}`).then(r => r.data);

export const markLegalDocumentPrinted = (id: string) =>
  apiClient.patch<LegalDocument>(`/legal-docs/documents/${id}/print`).then(r => r.data);

// Audit
export const fetchLegalAuditTrail = (entityType: string, entityId: string) =>
  apiClient.get<LegalAuditEntry[]>('/legal-docs/audit', { params: { entityType, entityId } }).then(r => r.data);
