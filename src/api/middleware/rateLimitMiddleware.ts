/**
 * Tiered API rate limiting.
 *
 * Primary layer is the Express app itself because this is a multi-tenant SaaS:
 * multiple cooperatives share one deployment, so a per-IP edge limiter cannot
 * stop one misbehaving tenant from degrading service for everyone else. These
 * limiters key on the authenticated session (organizationId + userId) where one
 * exists, and fall back to IP only for pre-login surfaces.
 *
 * Backend: Redis-backed counters when REDIS_URL is set (shared across instances,
 * survives restarts). Falls back to in-memory counters for local dev only — an
 * in-memory limiter resets on every deploy and does not work across multiple
 * instances, so production must set REDIS_URL.
 *
 * All 429 responses use the existing `{ error }` shape consumed by the frontend
 * (err.response?.data?.error), so no client special-casing is required.
 */
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { Redis } from 'ioredis';
import expressRateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';

const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    })
  : null;

if (redisClient) {
  redisClient.on('error', (err) => {
    console.error('[rate-limit] Redis client error:', err.message);
  });
} else if (process.env.NODE_ENV === 'production') {
  console.warn(
    '[rate-limit] REDIS_URL not set — using in-memory rate limits. ' +
      'Counters reset on every restart and do not work across multiple instances. Set REDIS_URL in production.'
  );
}

type Limiter = RateLimiterRedis | RateLimiterMemory;

function makeLimiter(opts: { points: number; duration: number; keyPrefix: string }): Limiter {
  return redisClient
    ? new RateLimiterRedis({ storeClient: redisClient, ...opts })
    : new RateLimiterMemory(opts);
}

/**
 * Binds a limiter to a per-request key. Fail-open on backend (Redis) errors so a
 * cache outage never blocks legitimate traffic; only genuine limit rejections
 * return 429. Rejections are logged because repeated 429s from the same tenant
 * or user is an early signal of a compromised session or a runaway frontend bug.
 */
function rateLimit(
  limiter: Limiter,
  keyFn: (req: Request) => string
): (req: Request, res: Response, next: NextFunction) => void {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    try {
      const result = await limiter.consume(key, 1);
      res.set('X-RateLimit-Remaining', String(result.remainingPoints));
      next();
    } catch (rejection: any) {
      // A rate-limit rejection is a RateLimiterRes carrying msBeforeNext; a
      // backend/connection failure is a plain Error — fail open in that case.
      if (!rejection || typeof rejection.msBeforeNext !== 'number') {
        console.error('[rate-limit] backend error, allowing request:', rejection?.message);
        return next();
      }
      const retryAfterSeconds = Math.ceil(rejection.msBeforeNext / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      const user = (req as AuthRequest).user;
      console.warn(
        `[rate-limit] 429 ${req.method} ${req.originalUrl} key=${key} ` +
          `org=${user?.organizationId || '-'} user=${user?.userId || '-'} ` +
          `retryAfter=${retryAfterSeconds}s requestId=${res.locals.requestId || '-'}`
      );
      return res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
    }
  };
}

// ── Tiers ────────────────────────────────────────────────────────────────────

// Auth brute-force: per IP + attempted username, 5 attempts / 15 min. Lockouts
// escalate: enough lockout events from one IP within a day triggers a longer
// (up to 24h) cooldown.
const authLimiter = makeLimiter({ points: 5, duration: 900, keyPrefix: 'rl:auth' });
const authIpEscalationLimiter = makeLimiter({ points: 5, duration: 86400, keyPrefix: 'rl:auth-ip' });

export const authRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  const key = `${req.ip ?? 'unknown'}:${String((req.body as any)?.username ?? (req.body as any)?.email ?? '')}`.toLowerCase();
  const ip = req.ip ?? 'unknown';
  try {
    const result = await authLimiter.consume(key, 1);
    res.set('X-RateLimit-Remaining', String(result.remainingPoints));
    return next();
  } catch (rejection: any) {
    if (!rejection || typeof rejection.msBeforeNext !== 'number') {
      console.error('[rate-limit] auth backend error, allowing request:', rejection?.message);
      return next();
    }
    let retryAfterSeconds = Math.ceil(rejection.msBeforeNext / 1000);
    try {
      await authIpEscalationLimiter.consume(ip, 1);
    } catch (escalation: any) {
      if (escalation && typeof escalation.msBeforeNext === 'number') {
        retryAfterSeconds = Math.max(retryAfterSeconds, Math.ceil(escalation.msBeforeNext / 1000));
      }
    }
    res.set('Retry-After', String(retryAfterSeconds));
    console.warn(
      `[rate-limit] 429 ${req.method} ${req.originalUrl} key=${key} ` +
        `retryAfter=${retryAfterSeconds}s requestId=${res.locals.requestId || '-'}`
    );
    return res.status(429).json({ error: 'Too many login attempts. Please wait before trying again.' });
  }
};

// Financial writes (deposits / withdrawals / cheque / shares): 30 requests / min
// per teller session. Keyed on organizationId + userId, never IP, so multiple
// tellers behind one branch egress IP are not throttled together.
const financialWriteLimiter = makeLimiter({ points: 30, duration: 60, keyPrefix: 'rl:fin' });

export const financialWriteRateLimit = rateLimit(financialWriteLimiter, (req: Request) => {
  const user = (req as AuthRequest).user;
  return `${user?.organizationId ?? req.ip ?? 'unknown'}:${user?.userId ?? ''}`;
});

// Signature verification: 20 / min per organization. This can hit a paid
// third-party matching service, so the limit is cost control, not just abuse.
const signatureLimiter = makeLimiter({ points: 20, duration: 60, keyPrefix: 'rl:sig' });

export const signatureRateLimit = rateLimit(signatureLimiter, (req: Request) => {
  const user = (req as AuthRequest).user;
  return user?.organizationId ?? req.ip ?? 'unknown';
});

// General authenticated API: 120 requests / min per tenant user. Mounted after
// verifyToken so the session is available; covers everything not already bound
// to a tighter tier above.
const generalLimiter = makeLimiter({ points: 120, duration: 60, keyPrefix: 'rl:api' });

export const generalApiRateLimit = rateLimit(generalLimiter, (req: Request) => {
  const user = (req as AuthRequest).user;
  return user ? `${user.organizationId}:${user.userId}` : req.ip ?? 'unknown';
});

// Public / unauthenticated surface: 20 / min per IP. Coarse, since there is no
// user identity yet to key on.
const publicLimiter = makeLimiter({ points: 20, duration: 60, keyPrefix: 'rl:pub' });

export const publicRateLimit = rateLimit(publicLimiter, (req: Request) => req.ip ?? 'unknown');

// Pre-existing guard for rare, destructive org-admin operations (member create,
// hard-deletes): 30 failed requests / hour per IP. Kept as an extra IP-keyed
// layer on top of the tenant-aware tiers above — different key and semantics, so
// it does not conflict with them. Only failed responses consume the bucket.
export const sensitiveRouteLimiter = expressRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // Limit each IP to 30 failed sensitive requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many sensitive operations requested, please try again after an hour.' },
});

// Applies a limiter only to mutating methods, so a prefix-level mount (e.g.
// router.use('/savings/withdrawals', postOnly(financialWriteRateLimit))) does
// not throttle the read endpoints that share the same path prefix.
export const postOnly =
  (limiter: (req: Request, res: Response, next: NextFunction) => void) =>
  (req: Request, res: Response, next: NextFunction) =>
    req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH'
      ? limiter(req, res, next)
      : next();