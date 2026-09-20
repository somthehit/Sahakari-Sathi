import axios, { AxiosAdapter, InternalAxiosRequestConfig, AxiosPromise } from 'axios';
import { useAuthStore } from '../stores/authStore';

// Get base URL from env if available, otherwise assume same-origin (Vite proxy)
const baseURL = (import.meta as any).env?.VITE_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Authorization header is managed globally in App.tsx via apiClient.defaults.headers.common

// Request interceptor: attach the persisted JWT before every call so requests
// made during the initial mount (before App's header-injection effect runs)
// still authenticate. Explicit per-request headers are preserved (e.g. calls
// that pass their own token).
apiClient.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Global error handling + bounded 429 retry.
// A temporarily exhausted rate-limit bucket (dev reloads behind one IP) can
// self-recover: GET requests that hit 429 are retried once with backoff.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config;
    const status = error?.response?.status;
    const isGet = (config?.method || 'get').toUpperCase() === 'GET';
    if (config && isGet && status === 429 && !(config as any)._retried) {
      (config as any)._retried = true;
      const delay = 1500 + Math.floor(Math.random() * 500);
      await new Promise((res) => setTimeout(res, delay));
      return apiClient.request(config);
    }

    // 401: expired or invalid session. Clear local auth state — the App
    // renders the login screen automatically when isAuthenticated flips false.
    // Auth endpoints are excluded: a wrong password legitimately returns 401
    // and must NOT wipe an otherwise valid session.
    // /auth/me is also excluded: App.tsx handles it with retry logic to absorb
    // transient Supabase Gateway blips (cold-start, brief signing-key rotation).
    if (config && status === 401) {
      const url = config.url || '';
      const isAuthAttempt =
        url.includes('/auth/login') ||
        url.includes('/auth/forgot-password') ||
        url.includes('/auth/emis/login') ||
        url.includes('/auth/me');
      const store = useAuthStore.getState();
      if (!isAuthAttempt && store.token && !(config as any)._handled401) {
        (config as any)._handled401 = true;
        store.clearSession();
      }
    }

    return Promise.reject(error);
  }
);

// --- In-flight GET deduplication ---
// React StrictMode (dev) and Vite HMR remount bootstrap effects repeatedly, so
// the same GET endpoints fire in parallel many times per load. Collapsing
// concurrent identical GETs into a single network request prevents duplicate
// traffic and rate-limit exhaustion (HTTP 429) on the backend.
const defaultAdapter = axios.getAdapter(axios.defaults.adapter);
const inFlight = new Map<string, AxiosPromise>();

const dedupeKey = (config: InternalAxiosRequestConfig): string => {
  const method = (config.method || 'get').toUpperCase();
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${method} ${config.url} ${params}`;
};

const dedupAdapter: AxiosAdapter = (config) => {
  if ((config.method || 'get').toUpperCase() !== 'GET') {
    return defaultAdapter(config);
  }
  const key = dedupeKey(config);
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = defaultAdapter(config);
  inFlight.set(key, request);
  const cleanup = () => {
    if (inFlight.get(key) === request) inFlight.delete(key);
  };
  request.then(cleanup, cleanup);
  return request;
};

apiClient.defaults.adapter = dedupAdapter;
