/**
 * System API — the small amount of real runtime information the server exposes.
 *
 * `GET /api/health` (see server.ts) is the only operational endpoint that
 * exists; it sits outside the `/api/v1` router and needs no token. Server CPU,
 * memory and connection-pool figures are NOT exposed anywhere, so the admin
 * monitoring screen must not claim to show them.
 */

/** `/api/health` is a sibling of the versioned API, not a member of it. */
const HEALTH_URL = `${String((import.meta as any).env?.VITE_API_URL || '/api/v1').replace(/\/v1\/?$/, '')}/health`;

export interface ApiHealth {
  reachable: boolean;
  /** Round-trip time of the health request in milliseconds. */
  latencyMs: number;
  /** The server's own clock, useful for spotting a drifted host. */
  serverTime: string | null;
  error: string | null;
}

export const checkApiHealth = async (): Promise<ApiHealth> => {
  const startedAt = performance.now();
  try {
    const res = await fetch(HEALTH_URL, { headers: { Accept: 'application/json' } });
    const latencyMs = Math.round(performance.now() - startedAt);
    if (!res.ok) {
      return { reachable: false, latencyMs, serverTime: null, error: `HTTP ${res.status}` };
    }
    const body = await res.json();
    return {
      reachable: body?.status === 'ok',
      latencyMs,
      serverTime: typeof body?.timestamp === 'string' ? body.timestamp : null,
      error: body?.status === 'ok' ? null : 'Server reported a non-ok status.',
    };
  } catch (error: any) {
    return {
      reachable: false,
      latencyMs: Math.round(performance.now() - startedAt),
      serverTime: null,
      error: error?.message || 'Could not reach the API.',
    };
  }
};
