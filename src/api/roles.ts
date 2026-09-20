import { apiClient } from '../lib/apiClient';
import type { PermissionGrant } from '../types/permissions';

export interface RoleRow {
  id: string;
  organizationId: string;
  code: string | null;
  name: string;
  nameNepali: string | null;
  description: string | null;
  permissions: string;
  isSystem: boolean;
  status: 'Active' | 'Inactive';
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string | null;
  usersCount: number;
}

export interface RolesQuery {
  search?: string;
  status?: string;
  system?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AssignedUser {
  id: string;
  username: string;
  email: string | null;
  status: string;
}

export interface RolePayload {
  code?: string;
  name: string;
  nameNepali?: string;
  description?: string;
  status?: 'Active' | 'Inactive';
  sortOrder?: number;
  permissions?: PermissionGrant[];
  permissionKeys?: string[];
  cloneFromId?: string;
}

export const fetchRoles = async (q: RolesQuery = {}): Promise<Paginated<RoleRow>> => {
  const { data } = await apiClient.get<Paginated<RoleRow>>('/roles', { params: q });
  return data;
};

export const fetchRole = async (id: string): Promise<RoleRow> => {
  const { data } = await apiClient.get<RoleRow>(`/roles/${id}`);
  return data;
};

export const fetchCloneSources = async (): Promise<RoleRow[]> => {
  const { data } = await apiClient.get<RoleRow[]>('/roles/clone-sources');
  return data;
};

export const createRole = async (payload: RolePayload): Promise<RoleRow> => {
  const { data } = await apiClient.post<RoleRow>('/roles', payload);
  return data;
};

export const updateRole = async (id: string, payload: RolePayload): Promise<RoleRow> => {
  const { data } = await apiClient.put<RoleRow>(`/roles/${id}`, payload);
  return data;
};

export const updateRoleStatus = async (id: string, status: 'Active' | 'Inactive'): Promise<RoleRow> => {
  const { data } = await apiClient.patch<RoleRow>(`/roles/${id}/status`, { status });
  return data;
};

export const deleteRole = async (id: string): Promise<{ success: boolean }> => {
  const { data } = await apiClient.delete<{ success: boolean }>(`/roles/${id}`);
  return data;
};

export const fetchRolePermissions = async (id: string): Promise<PermissionGrant[]> => {
  const { data } = await apiClient.get<PermissionGrant[]>(`/roles/${id}/permissions`);
  return data;
};

export const updateRolePermissions = async (id: string, permissions: PermissionGrant[]): Promise<PermissionGrant[]> => {
  const { data } = await apiClient.put<PermissionGrant[]>(`/roles/${id}/permissions`, { permissions });
  return data;
};

export const fetchRoleUsers = async (id: string): Promise<AssignedUser[]> => {
  const { data } = await apiClient.get<AssignedUser[]>(`/roles/${id}/users`);
  return data;
};

export type RoleDataScope = 'all' | 'branch' | 'self';

export interface RoleDataScopePayload {
  roleId: string;
  scope: RoleDataScope;
  actions: Record<string, boolean>;
}

export const fetchRoleDataScope = async (id: string): Promise<RoleDataScopePayload> => {
  const { data } = await apiClient.get<RoleDataScopePayload>(`/roles/${id}/data-scope`);
  return data;
};

export const updateRoleDataScope = async (id: string, scope: RoleDataScope, actions: Record<string, boolean>): Promise<RoleDataScopePayload> => {
  const { data } = await apiClient.put<RoleDataScopePayload>(`/roles/${id}/data-scope`, { scope, actions });
  return data;
};

export interface RoleApprovalLimit {
  id: string;
  moduleKey: string;
  min: string | null;
  max: string | null;
}

export interface RoleApprovalLimitInput {
  moduleKey: string;
  min?: number | null;
  max?: number | null;
}

export const fetchRoleApprovalLimits = async (id: string): Promise<RoleApprovalLimit[]> => {
  try {
    const { data } = await apiClient.get<RoleApprovalLimit[]>(`/roles/${id}/approval-limits`);
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error('[fetchRoleApprovalLimits] failed:', error?.response?.data || error?.message);
    return [];
  }
};

export const updateRoleApprovalLimits = async (id: string, limits: RoleApprovalLimitInput[]): Promise<RoleApprovalLimit[]> => {
  const { data } = await apiClient.put<RoleApprovalLimit[]>(`/roles/${id}/approval-limits`, limits);
  return data;
};
