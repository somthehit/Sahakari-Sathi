/**
 * Frontend API client for the Secure Hard Delete endpoints.
 *
 * Both endpoints are org_admin-only, rate-limited, and require
 * `{ reason, confirmation: 'DELETE' }`. The server archives an immutable
 * snapshot to audit_deletion_logs before permanently removing the records.
 */
import { apiClient } from '../lib/apiClient';

export interface HardDeleteResult {
  success: boolean;
  message: string;
  auditLogId: string;
}

export const hardDeleteMember = async (id: string, reason: string): Promise<HardDeleteResult> => {
  const { data } = await apiClient.post<HardDeleteResult>(`/members/${id}/hard-delete`, {
    reason,
    confirmation: 'DELETE',
  });
  return data;
};

export const hardDeleteSavingsAccount = async (id: string, reason: string): Promise<HardDeleteResult> => {
  const { data } = await apiClient.post<HardDeleteResult>(`/savings/accounts/${id}/hard-delete`, {
    reason,
    confirmation: 'DELETE',
  });
  return data;
};

/** One immutable audit_deletion_logs entry (never updatable / deletable). */
export interface DeletionLog {
  id: string;
  organizationId: string;
  entityType: 'MEMBER' | 'SAVINGS_ACCOUNT' | 'USER';
  entityId: string;
  entityCode?: string | null;
  deletedByUserId: string;
  deletedByUserName: string;
  deletedByUserRole?: string | null;
  deletionReason: string;
  /** Full JSON snapshot of the deleted entity + linked financial records. */
  snapshotData: Record<string, any>;
  ipAddress?: string | null;
  createdAt: string;
}

/** Fetch the org's immutable hard-delete audit trail (admin only). */
export const getDeletionLogs = async (): Promise<DeletionLog[]> => {
  const { data } = await apiClient.get<{ success: boolean; logs: DeletionLog[] }>('/audit/deletion-logs');
  return data.logs ?? [];
};
