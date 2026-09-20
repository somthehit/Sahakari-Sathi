/**
 * Security API — the Security Setup Wizard catalogue and the org-wide
 * security policy edited on SETUPS → Admin → Security.
 *
 * Note on enforcement: the server reports which policy fields it actually acts
 * on via the `enforcement` map. The UI must render that map rather than
 * assuming every field is live — 2FA and IP allow-listing are stored intent
 * only (no OTP channel exists, and req.ip is the proxy address unless
 * TRUST_PROXY is set). See migration 0045.
 */
import { apiClient } from '../lib/apiClient';

export interface SecurityQuestion {
  id: string;
  questionText: string;
  organizationId: string | null;
}

export interface SecuritySettings {
  minPasswordLength: number;
  requireSpecialChar: boolean;
  requireNumber: boolean;
  requireUppercase: boolean;
  requireLowercase: boolean;
  passwordExpiryDays: number;
  sessionTimeoutMinutes: number;
  enforce2fa: boolean;
  ipWhitelist: string | null;
  ipWhitelistEnabled: boolean;
}

/** Which policy fields the server actually enforces at runtime. */
export interface SecurityEnforcement {
  passwordPolicy: boolean;
  passwordExpiry: boolean;
  sessionTimeout: boolean;
  enforce2fa: boolean;
  ipWhitelist: boolean;
}

export interface SecuritySettingsResponse {
  settings: SecuritySettings;
  /** False when the org has never saved a policy (values shown are defaults). */
  configured: boolean;
  enforcement: SecurityEnforcement;
}

export const SECURITY_SETTINGS_DEFAULTS: SecuritySettings = {
  minPasswordLength: 8,
  requireSpecialChar: true,
  requireNumber: true,
  requireUppercase: true,
  requireLowercase: true,
  passwordExpiryDays: 90,
  sessionTimeoutMinutes: 15,
  enforce2fa: false,
  ipWhitelist: null,
  ipWhitelistEnabled: false,
};

const normalizeSettings = (row: any): SecuritySettings => ({
  minPasswordLength: Number(row?.minPasswordLength ?? SECURITY_SETTINGS_DEFAULTS.minPasswordLength),
  requireSpecialChar: !!(row?.requireSpecialChar ?? SECURITY_SETTINGS_DEFAULTS.requireSpecialChar),
  requireNumber: !!(row?.requireNumber ?? SECURITY_SETTINGS_DEFAULTS.requireNumber),
  requireUppercase: !!(row?.requireUppercase ?? SECURITY_SETTINGS_DEFAULTS.requireUppercase),
  requireLowercase: !!(row?.requireLowercase ?? SECURITY_SETTINGS_DEFAULTS.requireLowercase),
  passwordExpiryDays: Number(row?.passwordExpiryDays ?? SECURITY_SETTINGS_DEFAULTS.passwordExpiryDays),
  sessionTimeoutMinutes: Number(row?.sessionTimeoutMinutes ?? SECURITY_SETTINGS_DEFAULTS.sessionTimeoutMinutes),
  enforce2fa: !!(row?.enforce2fa ?? SECURITY_SETTINGS_DEFAULTS.enforce2fa),
  ipWhitelist: row?.ipWhitelist ?? null,
  ipWhitelistEnabled: !!(row?.ipWhitelistEnabled ?? SECURITY_SETTINGS_DEFAULTS.ipWhitelistEnabled),
});

/** Security questions offered by the wizard (global catalogue + org additions). */
export const fetchSecurityQuestions = async (): Promise<{ questions: SecurityQuestion[]; minAnswers: number }> => {
  const { data } = await apiClient.get('/auth/security-questions');
  return {
    questions: Array.isArray(data?.questions)
      ? data.questions.map((q: any) => ({
          id: String(q.id),
          questionText: String(q.questionText ?? ''),
          organizationId: q.organizationId ?? null,
        }))
      : [],
    minAnswers: Number(data?.minAnswers ?? 2),
  };
};

/**
 * Complete the one-time security wizard. Answers are hashed server-side; the
 * plaintext never leaves this request.
 */
export const completeSecuritySetup = async (payload: {
  mobileNumber?: string;
  answers?: { questionId: string; answer: string }[];
}): Promise<{ securityQuestionsCompleted: boolean; user?: any }> => {
  const { data } = await apiClient.post('/auth/security-setup/complete', payload);
  return {
    securityQuestionsCompleted: !!data?.securityQuestionsCompleted,
    user: data?.user,
  };
};

/**
 * The idle timeout for the signed-in user's organization. Available to every
 * authenticated role, unlike the full policy below which is admin/manager only.
 * Falls back to the default on any failure — an unreachable policy must never
 * strand the user, and must never silently mean "no timeout".
 */
export const fetchSessionPolicy = async (): Promise<{ sessionTimeoutMinutes: number }> => {
  try {
    const { data } = await apiClient.get('/auth/session-policy');
    const raw = Number(data?.sessionTimeoutMinutes);
    return {
      sessionTimeoutMinutes: Number.isFinite(raw) && raw >= 0
        ? raw
        : SECURITY_SETTINGS_DEFAULTS.sessionTimeoutMinutes,
    };
  } catch {
    return { sessionTimeoutMinutes: SECURITY_SETTINGS_DEFAULTS.sessionTimeoutMinutes };
  }
};

export const fetchSecuritySettings = async (): Promise<SecuritySettingsResponse> => {
  const { data } = await apiClient.get('/org/security-settings');
  return {
    settings: normalizeSettings(data?.settings),
    configured: !!data?.configured,
    enforcement: {
      passwordPolicy: !!data?.enforcement?.passwordPolicy,
      passwordExpiry: !!data?.enforcement?.passwordExpiry,
      sessionTimeout: !!data?.enforcement?.sessionTimeout,
      enforce2fa: !!data?.enforcement?.enforce2fa,
      ipWhitelist: !!data?.enforcement?.ipWhitelist,
    },
  };
};

export const updateSecuritySettings = async (
  payload: Partial<SecuritySettings>,
): Promise<SecuritySettings> => {
  const { data } = await apiClient.put('/org/security-settings', payload);
  return normalizeSettings(data?.settings);
};

// ============================================
// User Profile API
// ============================================
export const updateMyProfile = async (payload: { fullName?: string; avatarUrl?: string }) => {
  const { data } = await apiClient.put('/user/profile', payload);
  return data;
};
