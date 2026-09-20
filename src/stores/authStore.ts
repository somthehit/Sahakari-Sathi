/**
 * Auth Store (Zustand)
 * Manages Supabase JWT session state, user profile, and security flags.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  organizationId: string;
  organizationCode: string;
  organizationName?: string;
  organizationLogoUrl?: string;
  userId: string;
  username: string;
  role: string;
  fullName: string;
  avatarUrl?: string;
  branchId?: string;
  branchIds: string[];
  activeBranchId?: string;
  isOrgAdmin: boolean;
  requiresPasswordChange: boolean;
  isTemporaryPassword: boolean;
  emailVerified: boolean;
  securityScore: number;
  passwordChanged: boolean;
  securitySetupCompleted: boolean;
  mobileVerified: boolean;
  mobileNumber: string | null;
  securityQuestionsCompleted: boolean;
  firstLoginCompleted: boolean;
  mustChangePassword: boolean;
  mustCompleteSecuritySetup: boolean;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  expiresAt: Date | null;
  isAuthenticated: boolean;

  setSession: (token: string, user: AuthUser, expiresAt: Date) => void;
  clearSession: () => void;
  isSessionExpired: () => boolean;
  updateUserFlags: (flags: Partial<Pick<AuthUser, 'requiresPasswordChange' | 'isTemporaryPassword' | 'emailVerified' | 'securityScore' | 'passwordChanged' | 'securitySetupCompleted' | 'mobileVerified' | 'mobileNumber' | 'securityQuestionsCompleted' | 'firstLoginCompleted' | 'mustChangePassword' | 'mustCompleteSecuritySetup'>>) => void;
  updateProfile: (updates: Partial<Pick<AuthUser, 'fullName' | 'avatarUrl'>>) => void;
  setActiveBranch: (activeBranchId: string) => void;
  refreshOrganization: (org: Partial<Pick<AuthUser, 'organizationName' | 'organizationCode'>> & { logoUrl?: string | null }) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      expiresAt: null,
      isAuthenticated: false,

      setSession: (token, user, expiresAt) => {
        set({ token, user, expiresAt, isAuthenticated: true });
      },

      clearSession: () => {
        set({ token: null, user: null, expiresAt: null, isAuthenticated: false });
        // Optional: Call Supabase auth.signOut() if needed, but clearing local state is sufficient for this architecture
      },

      isSessionExpired: () => {
        const { expiresAt } = get();
        if (!expiresAt) return true;
        return new Date(expiresAt) < new Date();
      },

      // Update flags like emailVerified or requiresPasswordChange without full re-login
      updateUserFlags: (flags) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...flags } });
        }
      },

      // Update profile fields (name, avatar) — persisted to localStorage
      updateProfile: (updates) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...updates } });
        }
      },

      setActiveBranch: (activeBranchId) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, activeBranchId } });
        }
      },

      // Refresh the org identity shown in the global header (name/logo) after
      // the organization profile is updated — no full session reload needed.
      refreshOrganization: (org) => {
        const { user } = get();
        if (!user) return;
        const next: AuthUser = { ...user };
        if (org.organizationName !== undefined) next.organizationName = org.organizationName;
        if (org.organizationCode !== undefined) next.organizationCode = org.organizationCode;
        if (org.logoUrl !== undefined) next.organizationLogoUrl = org.logoUrl || undefined;
        set({ user: next });
      },
    }),
    {
      name: 'sahakari-auth-session',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
