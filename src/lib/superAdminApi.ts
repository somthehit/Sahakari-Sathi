/**
 * Super Admin API Client
 * Base URL: /api/v1
 * 
 * Includes automatic token refresh: when a request fails with 401 and a
 * refresh_token is available, the client transparently refreshes the session
 * and retries the original request once.
 */

const API_BASE = '/api/v1';

type TokenGetter = () => string | null;
type TokenSetter = (accessToken: string, refreshToken: string) => void;

let _getToken: TokenGetter = () => null;
let _onRefresh: TokenSetter = () => {};
let _onLogout: () => void = () => {};

/**
 * Wire the API client to the Zustand store so it can read/write tokens
 * without creating a circular dependency.
 */
export function initSuperAdminApi(getToken: TokenGetter, onRefresh: TokenSetter, onLogout: () => void) {
  _getToken = getToken;
  _onRefresh = onRefresh;
  _onLogout = onLogout;
}

async function post(url: string, body: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) {
    const err: any = new Error(json.error || json.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}

async function get(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  if (!res.ok) {
    const err: any = new Error(json.error || json.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}

async function put(url: string, body: object, token: string) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const err: any = new Error(json.error || json.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}

async function del(url: string, token: string) {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) {
    const err: any = new Error(json.error || json.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}

/**
 * Attempt to refresh the Supabase session using the stored refresh_token.
 * Returns true if successful.
 */
async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = (useSuperAdminAuthStatic as any).getState?.()?.refreshToken
    || JSON.parse(localStorage.getItem('super-admin-auth') || '{}')?.state?.refreshToken;
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.accessToken && data.refreshToken) {
      _onRefresh(data.accessToken, data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Import the store directly to read refresh token without circular dep issues
import { useSuperAdminAuth as useSuperAdminAuthStatic } from '../stores/superAdminAuthStore';

/**
 * Wrapper that retries a 401 response once after attempting a token refresh.
 */
async function withAutoRefresh<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = _getToken();
  if (!token) throw new Error('Not authenticated');
  try {
    return await fn(token);
  } catch (err: any) {
    if (err?.status === 401) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        const newToken = _getToken();
        if (newToken) return await fn(newToken);
      }
      _onLogout();
    }
    throw err;
  }
}

export const superAdminApi = {
  login: (username: string, password: string) =>
    post(`${API_BASE}/auth/super-admin/login`, { username, password }),

  getOrganizations: (token: string, params?: { page?: number; limit?: number; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return get(`${API_BASE}/super-admin/organizations${qs ? '?' + qs : ''}`, token);
  },

  createOrganization: (token: string, data: object) =>
    post(`${API_BASE}/super-admin/organizations`, data, token),

  provisionOrganization: (token: string, data: object) =>
    post(`${API_BASE}/super-admin/organizations/provision`, data, token),

  getNextRegNo: (token: string, type: string, bsYear: number) =>
    get(`${API_BASE}/super-admin/organizations/next-reg-no?type=${encodeURIComponent(type)}&bsYear=${bsYear}`, token) as Promise<{ registrationNo: string }>,

  updateOrganizationStatus: (token: string, id: string, status: 'Active' | 'Suspended' | 'Inactive') =>
    put(`${API_BASE}/super-admin/organizations/${id}/status`, { status }, token),

  updateOrganization: (token: string, id: string, data: object) =>
    put(`${API_BASE}/super-admin/organizations/${id}`, data, token),

  getOrganizationDetail: (token: string, id: string) =>
    get(`${API_BASE}/super-admin/organizations/${id}`, token),

  getOrgAuditLogs: (token: string, id: string, limit = 50) =>
    get(`${API_BASE}/super-admin/organizations/${id}/audit-logs?limit=${limit}`, token),

  getOrgRoles: (token: string, orgId: string) =>
    get(`${API_BASE}/super-admin/organizations/${orgId}/roles`, token),

  getPlatformStats: (token: string) =>
    get(`${API_BASE}/super-admin/stats`, token),

  getPlatformUsers: (token: string) =>
    get(`${API_BASE}/super-admin/users`, token),

  createSuperAdmin: (token: string, data: { username: string; password: string; fullName: string; email: string }) =>
    post(`${API_BASE}/super-admin/users`, data, token),

  updatePlatformUser: (token: string, id: string, data: { fullName?: string; email?: string; status?: string }) =>
    put(`${API_BASE}/super-admin/users/${id}`, data, token),

  resetPlatformUserPassword: (token: string, id: string, newPassword: string) =>
    post(`${API_BASE}/super-admin/users/${id}/reset-password`, { newPassword }, token),

  updateSuperAdminUser: (token: string, id: string, data: { fullName?: string; email?: string; status?: string }) =>
    put(`${API_BASE}/super-admin/super-admins/${id}`, data, token),

  getSuperAdmins: (token: string) =>
    get(`${API_BASE}/super-admin/super-admins`, token),

  createPlatformUser: (token: string, data: {
    organizationId: string;
    username: string;
    temporaryPassword: string;
    employeeEmail: string;
    roleId?: string;
  }) =>
    post(`${API_BASE}/super-admin/platform-users`, data, token),

  getAuditLogs: (token: string, limit = 200) =>
    get(`${API_BASE}/super-admin/audit-logs?limit=${limit}`, token),

  // ==========================================
  // Platform Roles & Access
  // ==========================================
  getPlatformRoles: (token: string, params?: { page?: number; limit?: number; search?: string; status?: string; system?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.system) query.set('system', params.system);
    const qs = query.toString();
    return get(`${API_BASE}/super-admin/platform-roles${qs ? '?' + qs : ''}`, token);
  },

  getPlatformRole: (token: string, id: string) =>
    get(`${API_BASE}/super-admin/platform-roles/${id}`, token),

  createPlatformRole: (token: string, data: object) =>
    post(`${API_BASE}/super-admin/platform-roles`, data, token),

  updatePlatformRole: (token: string, id: string, data: object) =>
    put(`${API_BASE}/super-admin/platform-roles/${id}`, data, token),

  deletePlatformRole: (token: string, id: string) =>
    del(`${API_BASE}/super-admin/platform-roles/${id}`, token),

  getPlatformRolePermissions: (token: string, id: string) =>
    get(`${API_BASE}/super-admin/platform-roles/${id}/permissions`, token),

  updatePlatformRolePermissions: (token: string, id: string, permissions: object) =>
    put(`${API_BASE}/super-admin/platform-roles/${id}/permissions`, { permissions }, token),

  getPlatformRoleDataScope: (token: string, id: string) =>
    get(`${API_BASE}/super-admin/platform-roles/${id}/data-scope`, token),

  updatePlatformRoleDataScope: (token: string, id: string, data: object) =>
    put(`${API_BASE}/super-admin/platform-roles/${id}/data-scope`, data, token),

  // ==========================================
  // Enterprise Module Management
  // ==========================================
  getModules: (token: string, params?: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v !== undefined && v !== null && v !== '') query.set(k, String(v));
    }
    const qs = query.toString();
    return get(`${API_BASE}/modules${qs ? '?' + qs : ''}`, token);
  },

  getModuleStats: (token: string) =>
    get(`${API_BASE}/modules/stats`, token),

  getModuleCategories: (token: string) =>
    get(`${API_BASE}/modules/categories`, token),

  getModule: (token: string, id: string) =>
    get(`${API_BASE}/modules/${id}`, token),

  createModule: (token: string, data: object) =>
    post(`${API_BASE}/modules`, data, token),

  updateModule: (token: string, id: string, data: object) =>
    put(`${API_BASE}/modules/${id}`, data, token),

  deleteModule: (token: string, id: string) =>
    del(`${API_BASE}/modules/${id}`, token),

  // Module sub-resources
  listModuleFeatures: (token: string, id: string) =>
    get(`${API_BASE}/modules/${id}/features`, token),
  createModuleFeature: (token: string, id: string, data: object) =>
    post(`${API_BASE}/modules/${id}/features`, data, token),
  updateModuleFeature: (token: string, id: string, featureId: string, data: object) =>
    put(`${API_BASE}/modules/${id}/features/${featureId}`, data, token),
  deleteModuleFeature: (token: string, id: string, featureId: string) =>
    del(`${API_BASE}/modules/${id}/features/${featureId}`, token),

  listModuleDependencies: (token: string, id: string) =>
    get(`${API_BASE}/modules/${id}/dependencies`, token),
  addModuleDependency: (token: string, id: string, data: object) =>
    post(`${API_BASE}/modules/${id}/dependencies`, data, token),
  removeModuleDependency: (token: string, id: string, depId: string) =>
    del(`${API_BASE}/modules/${id}/dependencies/${depId}`, token),

  listModuleVersions: (token: string, id: string) =>
    get(`${API_BASE}/modules/${id}/versions`, token),
  createModuleVersion: (token: string, id: string, data: object) =>
    post(`${API_BASE}/modules/${id}/versions`, data, token),

  listModuleLicenses: (token: string, id: string) =>
    get(`${API_BASE}/modules/${id}/licenses`, token),
  createModuleLicense: (token: string, id: string, data: object) =>
    post(`${API_BASE}/modules/${id}/licenses`, data, token),
  updateModuleLicense: (token: string, id: string, licenseId: string, data: object) =>
    put(`${API_BASE}/modules/${id}/licenses/${licenseId}`, data, token),
  deleteModuleLicense: (token: string, id: string, licenseId: string) =>
    del(`${API_BASE}/modules/${id}/licenses/${licenseId}`, token),

  listModuleSettings: (token: string, id: string) =>
    get(`${API_BASE}/modules/${id}/settings`, token),
  upsertModuleSetting: (token: string, id: string, data: object) =>
    put(`${API_BASE}/modules/${id}/settings`, data, token),
  deleteModuleSetting: (token: string, id: string, settingId: string) =>
    del(`${API_BASE}/modules/${id}/settings/${settingId}`, token),

  listModulePermissions: (token: string, id: string) =>
    get(`${API_BASE}/modules/${id}/permissions`, token),
  upsertModulePermission: (token: string, id: string, data: object) =>
    put(`${API_BASE}/modules/${id}/permissions`, data, token),
  deleteModulePermission: (token: string, id: string, permId: string) =>
    del(`${API_BASE}/modules/${id}/permissions/${permId}`, token),

  listModuleAssignments: (token: string, id: string) =>
    get(`${API_BASE}/modules/${id}/assignments`, token),
  getModuleUsage: (token: string, id: string, days = 30) =>
    get(`${API_BASE}/modules/${id}/usage?days=${days}`, token),
  upsertModuleMarketplace: (token: string, id: string, data: object) =>
    put(`${API_BASE}/modules/${id}/marketplace`, data, token),

  // Assignments
  assignModules: (token: string, data: object) =>
    post(`${API_BASE}/modules/assign`, data, token),
  unassignModules: (token: string, data: object) =>
    post(`${API_BASE}/modules/unassign`, data, token),
  updateModuleAssignment: (token: string, assignmentId: string, data: object) =>
    put(`${API_BASE}/modules/assignments/${assignmentId}`, data, token),

  recordModuleUsage: (token: string, rows: Array<object>) =>
    post(`${API_BASE}/modules/usage`, { rows }, token),

  // Organization-scoped module operations
  listOrgModuleAssignments: (token: string, organizationId: string) =>
    get(`${API_BASE}/super-admin/orgs/${organizationId}/modules`, token),
  toggleOrgModule: (token: string, organizationId: string, moduleId: string, status: string) =>
    post(`${API_BASE}/super-admin/orgs/${organizationId}/modules/${moduleId}/toggle`, { status }, token),
  listOrgModuleFeatures: (token: string, organizationId: string, moduleId: string) =>
    get(`${API_BASE}/super-admin/orgs/${organizationId}/modules/${moduleId}/features`, token),
  setOrgModuleFeature: (token: string, organizationId: string, moduleId: string, featureId: string, enabled: boolean) =>
    put(`${API_BASE}/super-admin/orgs/${organizationId}/modules/${moduleId}/features`, { featureId, enabled }, token),
  listOrgModuleSettings: (token: string, organizationId: string, moduleId: string) =>
    get(`${API_BASE}/super-admin/orgs/${organizationId}/modules/${moduleId}/settings`, token),
  setOrgModuleSetting: (token: string, organizationId: string, moduleId: string, key: string, value: unknown) =>
    put(`${API_BASE}/super-admin/orgs/${organizationId}/modules/${moduleId}/settings`, { key, value }, token),
  listOrgModulePermissions: (token: string, organizationId: string, moduleId: string) =>
    get(`${API_BASE}/super-admin/orgs/${organizationId}/modules/${moduleId}/permissions`, token),
  setOrgModulePermission: (token: string, organizationId: string, moduleId: string, role: string, action: string, granted: boolean) =>
    put(`${API_BASE}/super-admin/orgs/${organizationId}/modules/${moduleId}/permissions`, { role, action, granted }, token),

  // Audit / notifications / installation logs
  getModuleAuditLogs: (token: string, params?: { moduleId?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.moduleId) query.set('moduleId', params.moduleId);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return get(`${API_BASE}/modules/audit-logs${qs ? '?' + qs : ''}`, token);
  },
  getModuleNotifications: (token: string, params?: { moduleId?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.moduleId) query.set('moduleId', params.moduleId);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return get(`${API_BASE}/modules/notifications${qs ? '?' + qs : ''}`, token);
  },
  getModuleInstallationLogs: (token: string, params?: { moduleId?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.moduleId) query.set('moduleId', params.moduleId);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return get(`${API_BASE}/modules/installation-logs${qs ? '?' + qs : ''}`, token);
  },

  // Templates
  getModuleTemplates: (token: string) =>
    get(`${API_BASE}/modules/templates`, token),
  createModuleTemplate: (token: string, data: object) =>
    post(`${API_BASE}/modules/templates`, data, token),
  deleteModuleTemplate: (token: string, templateId: string) =>
    del(`${API_BASE}/modules/templates/${templateId}`, token),

  // AI-style recommendations
  getModuleRecommendations: (token: string) =>
    get(`${API_BASE}/modules/recommendations`, token),
  generateModuleRecommendations: (token: string) =>
    post(`${API_BASE}/modules/recommendations/generate`, {}, token),
  updateModuleRecommendationStatus: (token: string, recommendationId: string, status: string) =>
    put(`${API_BASE}/modules/recommendations/${recommendationId}/status`, { status }, token),

  // Marketplace
  getMarketplace: (token: string, params?: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v !== undefined && v !== null && v !== '') query.set(k, String(v));
    }
    const qs = query.toString();
    return get(`${API_BASE}/marketplace${qs ? '?' + qs : ''}`, token);
  },
  marketplaceInstall: (token: string, data: object) =>
    post(`${API_BASE}/marketplace/install`, data, token),
  marketplaceUpdate: (token: string, data: object) =>
    post(`${API_BASE}/marketplace/update`, data, token),
  marketplaceRemove: (token: string, data: object) =>
    post(`${API_BASE}/marketplace/remove`, data, token),

  // ==========================================
  // API Keys Management
  // ==========================================
  getApiKeys: (token: string, params?: Record<string, string>) => {
    const query = new URLSearchParams(params);
    const qs = query.toString();
    return get(`${API_BASE}/super-admin/api-keys${qs ? '?' + qs : ''}`, token);
  },
  getApiKeyStats: (token: string) =>
    get(`${API_BASE}/super-admin/api-keys/stats`, token),
  createApiKey: (token: string, data: { name: string; scopes?: string[]; rateLimit?: number; organizationId?: string; expiresAt?: string }) =>
    post(`${API_BASE}/super-admin/api-keys`, data, token),
  revokeApiKey: (token: string, id: string, reason?: string) =>
    post(`${API_BASE}/super-admin/api-keys/${id}/revoke`, reason ? { reason } : {}, token),
  deleteApiKey: (token: string, id: string) =>
    del(`${API_BASE}/super-admin/api-keys/${id}`, token),
  rotateApiKey: (token: string, id: string) =>
    post(`${API_BASE}/super-admin/api-keys/${id}/rotate`, {}, token),

  // Organization lookup (for assignment dialogs)
  getModuleOrgList: (token: string, params?: { search?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return get(`${API_BASE}/super-admin/org-list${qs ? '?' + qs : ''}`, token);
  },

  // ==========================================
  // System Settings
  // ==========================================
  getSystemSettings: (token: string, category?: string) => {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    return withAutoRefresh(t => get(`${API_BASE}/super-admin/settings${qs}`, t));
  },
  getSettingsGrouped: (token: string) =>
    withAutoRefresh(t => get(`${API_BASE}/super-admin/settings/grouped`, t)),
  updateSystemSetting: (token: string, key: string, value: string) =>
    withAutoRefresh(t => put(`${API_BASE}/super-admin/settings/${encodeURIComponent(key)}`, { value }, t)),
  bulkUpdateSettings: (token: string, settings: Array<{ key: string; value: string }>) =>
    withAutoRefresh(t => put(`${API_BASE}/super-admin/settings/bulk`, { settings }, t)),
  resetSystemSettings: (token: string, category?: string) =>
    withAutoRefresh(t => post(`${API_BASE}/super-admin/settings/reset`, category ? { category } : {}, t)),

  // ==========================================
  // Database Administration
  // ==========================================
  getDbOverview: (token: string) =>
    get(`${API_BASE}/super-admin/database/overview`, token),

  getDbTables: (token: string) =>
    get(`${API_BASE}/super-admin/database/tables`, token),

  getDbIndexes: (token: string) =>
    get(`${API_BASE}/super-admin/database/indexes`, token),

  getDbQueries: (token: string) =>
    get(`${API_BASE}/super-admin/database/queries`, token),

  getDbVacuum: (token: string) =>
    get(`${API_BASE}/super-admin/database/vacuum`, token),

  runDbQuery: (token: string, query: string) =>
    post(`${API_BASE}/super-admin/database/query`, { query }, token),

  // ==========================================
  // Database Configuration (production settings)
  // ==========================================
  getDbConfig: (token: string) =>
    get(`${API_BASE}/super-admin/database-config`, token),

  updateDbConfig: (token: string, data: object) =>
    put(`${API_BASE}/super-admin/database-config`, data, token),

  testDbConnection: (token: string, data: object) =>
    post(`${API_BASE}/super-admin/database-config/test`, data, token),

  applyDbConfig: (token: string) =>
    post(`${API_BASE}/super-admin/database-config/apply`, {}, token),

  // ==========================================
  // Subscriptions Management
  // ==========================================
  getSubscriptionPlans: (token: string) =>
    get(`${API_BASE}/super-admin/subscriptions/plans`, token),

  createSubscriptionPlan: (token: string, data: object) =>
    post(`${API_BASE}/super-admin/subscriptions/plans`, data, token),

  updateSubscriptionPlan: (token: string, id: string, data: object) =>
    put(`${API_BASE}/super-admin/subscriptions/plans/${id}`, data, token),

  deleteSubscriptionPlan: (token: string, id: string) =>
    del(`${API_BASE}/super-admin/subscriptions/plans/${id}`, token),

  getOrgSubscriptions: (token: string, params?: { search?: string; planCode?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.planCode) query.set('planCode', params.planCode);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return get(`${API_BASE}/super-admin/subscriptions/orgs${qs ? '?' + qs : ''}`, token);
  },

  changeOrgPlan: (token: string, orgId: string, planCode: string) =>
    post(`${API_BASE}/super-admin/subscriptions/orgs/${orgId}/change-plan`, { planCode }, token),

  getSubscriptionStats: (token: string) =>
    get(`${API_BASE}/super-admin/subscriptions/stats`, token),

  getPlanUsage: (token: string) =>
    get(`${API_BASE}/super-admin/subscriptions/plan-usage`, token),
};
