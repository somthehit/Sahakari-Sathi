import { apiClient } from '../lib/apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuditRule {
  id: string; organizationId: string; ruleCode: string;
  name: string; nameNepali: string; description: string;
  category: 'integrity' | 'statutory' | 'analytical';
  layer: number;
  ruleType: 'tie_out' | 'threshold' | 'percentage_of_base' | 'classification_match' | 'custom';
  fieldA: string; fieldB: string; operator: string;
  tolerance: string; baseField: string;
  thresholdValue: string | null; thresholdOperator: string;
  sourceStatement: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'advisory';
  parameters: Record<string, any>; isBlocking: boolean;
  active: boolean; effectiveFrom: string; effectiveTo: string;
  createdBy: string; createdAt: string; updatedAt: string;
}

export interface AuditRun {
  id: string; organizationId: string; fiscalYearId: string | null;
  fiscalYearLabel: string; ruleSetVersion: number; triggeredBy: string;
  status: 'running' | 'completed' | 'failed';
  totalRules: number; rulesPassed: number; rulesFailed: number; rulesSkipped: number;
  startedAt: string; completedAt: string | null; errorMessage: string | null;
  createdBy: string; createdAt: string;
}

export interface AuditFinding {
  id: string; organizationId: string; runId: string; ruleId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'advisory';
  title: string; description: string;
  category: 'integrity' | 'statutory' | 'analytical';
  sourceStatement: string;
  evidenceRef: {
    statement?: string; accountCode?: string; accountName?: string;
    amount?: number; expectedAmount?: number; variance?: number; details?: string;
  };
  status: 'open' | 'in_review' | 'resolved' | 'waived';
  resolutionNote: string; waivedJustification: string;
  ownerUserId: string; ownerName: string;
  createdAt: string; resolvedAt: string | null;
}

export interface AuditWorkpaper {
  id: string; organizationId: string; findingId: string;
  type: 'attachment' | 'system_ref' | 'note';
  reference: string; fileName: string; fileUrl: string; fileSize: number;
  uploadedBy: string; uploadedAt: string;
}

export interface AuditOpinionDraft {
  id: string; organizationId: string; runId: string;
  suggestedClassification: 'unqualified' | 'qualified' | 'adverse' | 'disclaimer';
  finalClassification: 'unqualified' | 'qualified' | 'adverse' | 'disclaimer' | null;
  basisSummary: string; overrideReason: string;
  setByUserId: string; setByUserName: string; setAt: string | null;
  createdAt: string;
}

export interface AuditSignoff {
  id: string; organizationId: string; runId: string;
  stage: 'preparer' | 'internal_auditor' | 'external_auditor' | 'board' | 'doc_submission';
  userId: string; userName: string;
  decision: 'approved' | 'rejected' | 'needs_revision';
  comments: string; signedDocumentRef: string; timestamp: string;
  // Stage-specific fields
  externalAuditorName: string; externalAuditorFirm: string;
  opinionPdfUrl: string; opinionPdfName: string;
  resolutionNumber: string; resolutionDate: string; resolutionTitle: string;
  docSubmissionDate: string; docReferenceNumber: string; docPortalUrl: string;
}

export interface AuditDashboardStats {
  latestRun: AuditRun | null;
  findingsBySeverity: Record<string, number>;
  findingsByStatus: Record<string, number>;
  totalRuns: number;
  activeRules: number;
}

// ─── API Functions ──────────────────────────────────────────────────────────

// Dashboard
export const fetchAuditDashboard = async (): Promise<AuditDashboardStats> => (await apiClient.get('/audit/dashboard')).data;

// Rules
export const fetchAuditRules = async (category?: string, active?: string): Promise<AuditRule[]> => {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (active !== undefined) params.set('active', active);
  const qs = params.toString();
  return (await apiClient.get(`/audit/rules${qs ? `?${qs}` : ''}`)).data;
};
export const createAuditRule = async (data: Partial<AuditRule>): Promise<AuditRule> => (await apiClient.post('/audit/rules', data)).data;
export const updateAuditRule = async (id: string, data: Partial<AuditRule>): Promise<AuditRule> => (await apiClient.put(`/audit/rules/${id}`, data)).data;
export const deleteAuditRule = async (id: string): Promise<{ id: string }> => (await apiClient.delete(`/audit/rules/${id}`)).data;
export const seedAuditRules = async (): Promise<{ seeded: number; total: number }> => (await apiClient.post('/audit/rules/seed')).data;

// Runs
export const fetchAuditRuns = async (): Promise<AuditRun[]> => (await apiClient.get('/audit/runs')).data;
export const fetchAuditRun = async (id: string): Promise<AuditRun> => (await apiClient.get(`/audit/runs/${id}`)).data;
export const triggerAuditRun = async (fiscalYearId?: string): Promise<AuditRun & { findingsCount: number }> => (await apiClient.post('/audit/runs', { fiscalYearId })).data;

// Findings
export const fetchAuditFindings = async (params?: { runId?: string; status?: string; severity?: string; category?: string }): Promise<AuditFinding[]> => {
  const qs = new URLSearchParams();
  if (params?.runId) qs.set('runId', params.runId);
  if (params?.status) qs.set('status', params.status);
  if (params?.severity) qs.set('severity', params.severity);
  if (params?.category) qs.set('category', params.category);
  const query = qs.toString();
  return (await apiClient.get(`/audit/findings${query ? `?${query}` : ''}`)).data;
};
export const resolveAuditFinding = async (id: string, data: { status: string; resolutionNote?: string; waivedJustification?: string }): Promise<AuditFinding> => (await apiClient.put(`/audit/findings/${id}/resolve`, data)).data;

// Workpapers
export const fetchAuditWorkpapers = async (findingId: string): Promise<AuditWorkpaper[]> => (await apiClient.get(`/audit/workpapers/${findingId}`)).data;
export const addAuditWorkpaper = async (data: Partial<AuditWorkpaper>): Promise<AuditWorkpaper> => (await apiClient.post('/audit/workpapers', data)).data;

// Opinion
export const fetchAuditOpinion = async (runId: string): Promise<AuditOpinionDraft> => (await apiClient.get(`/audit/opinion/${runId}`)).data;
export const updateAuditOpinion = async (runId: string, data: { finalClassification: string; overrideReason?: string }): Promise<AuditOpinionDraft> => (await apiClient.put(`/audit/opinion/${runId}`, data)).data;

// Signoffs
export const fetchAuditSignoffs = async (runId: string): Promise<AuditSignoff[]> => (await apiClient.get(`/audit/signoffs/${runId}`)).data;
export const addAuditSignoff = async (data: { runId: string; stage: string; decision: string; comments?: string; signedDocumentRef?: string }): Promise<AuditSignoff> => (await apiClient.post('/audit/signoffs', data)).data;
