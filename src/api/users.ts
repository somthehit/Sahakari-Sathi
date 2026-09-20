import { apiClient } from '../lib/apiClient';

export interface OrgUser {
  id: string;
  organizationId: string;
  employeeId: string | null;
  username: string;
  email: string | null;
  emailVerified: boolean;
  authUserId: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  fullName: string;
  employeeCode: string | null;
  gender: string | null;
  phone: string | null;
  photoUrl: string | null;
  roleId: string | null;
  role: string | null;
  department: string | null;
  designation: string | null;
  branchId: string | null;
  branchName: string | null;
  status: string;
  requiresPasswordChange: boolean;
  securityScore: number;
  securitySetupCompleted: boolean;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
}

export const fetchOrgUsers = async (): Promise<OrgUser[]> => {
  const { data } = await apiClient.get<OrgUser[]>('/org/users');
  return data;
};

export const updateOrgUser = async (id: string, payload: Record<string, unknown>): Promise<OrgUser> => {
  const { data } = await apiClient.put<OrgUser>(`/org/users/${id}`, payload);
  return data;
};

export const lockOrgUser = async (id: string) => {
  const { data } = await apiClient.post(`/org/users/${id}/lock`);
  return data;
};

export const unlockOrgUser = async (id: string) => {
  const { data } = await apiClient.post(`/org/users/${id}/unlock`);
  return data;
};

export const activateOrgUser = async (id: string) => {
  const { data } = await apiClient.post(`/org/users/${id}/activate`);
  return data;
};

export const deactivateOrgUser = async (id: string) => {
  const { data } = await apiClient.post(`/org/users/${id}/deactivate`);
  return data;
};

export const forcePasswordReset = async (id: string, temporaryPassword: string) => {
  const { data } = await apiClient.post(`/org/users/${id}/force-reset`, { temporaryPassword });
  return data;
};

export const resetUserPassword = async (id: string) => {
  const { data } = await apiClient.post(`/org/users/${id}/reset-password`);
  return data;
};

export const resendWelcomeEmail = async (id: string) => {
  const { data } = await apiClient.post(`/org/users/${id}/resend-welcome`);
  return data;
};

export const terminateUserSessions = async (id: string) => {
  const { data } = await apiClient.post(`/org/users/${id}/terminate-sessions`);
  return data;
};
