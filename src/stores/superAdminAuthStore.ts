/**
 * Super Admin Auth Store — Zustand
 * Completely isolated from tenant auth. Never share token with tenant portal.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SuperAdminUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
}

interface SuperAdminAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: SuperAdminUser | null;
  isAuthenticated: boolean;
  login: (accessToken: string, refreshToken: string, user: SuperAdminUser) => void;
  refreshAccessToken: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useSuperAdminAuth = create<SuperAdminAuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      login: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user, isAuthenticated: true }),

      refreshAccessToken: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

      logout: () => {
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
        localStorage.removeItem('super-admin-auth');
        window.location.href = '/super-admin/login';
      },
    }),
    {
      name: 'super-admin-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

/**
 * Checks whether a stored Supabase access token is already expired by
 * decoding its JWT payload. Malformed/undecodable tokens count as expired.
 */
export function isSuperAdminTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

/**
 * Returns seconds until the token expires, or 0 if already expired.
 */
export function superAdminTokenTTL(token: string | null): number {
  if (!token) return 0;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    if (typeof payload.exp !== 'number') return 0;
    return Math.max(0, Math.floor(payload.exp * 1000 - Date.now()) / 1000);
  } catch {
    return 0;
  }
}
