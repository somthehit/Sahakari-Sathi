/**
 * One-way hashing for low-entropy user secrets (currently security-question
 * answers).
 *
 * Answers are only ever verified, never shown back to the user, so a one-way
 * KDF is the correct primitive — reversible encryption would give an attacker
 * with DB access the plaintext answers, which are commonly reused across
 * services.
 *
 * scrypt from node:crypto is used rather than bcrypt/argon2 so this adds no
 * dependency. Parameters are stored alongside the digest so cost can be raised
 * later without invalidating existing rows.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';

const SCHEME = 'scrypt';
const KEYLEN = 64;
const SALT_BYTES = 16;

/** Cost parameters for new hashes. N must be a power of two. */
const PARAMS = { N: 16384, r: 8, p: 1 } as const;

const derive = (secret: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    // maxmem must exceed 128 * N * r, otherwise scrypt throws.
    scrypt(secret, salt, KEYLEN, { N, r, p, maxmem: 256 * N * r }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });

/**
 * Case- and whitespace-insensitive normalisation so "  Kathmandu " verifies
 * against "kathmandu". Applied identically on hash and verify.
 */
export const normalizeAnswer = (answer: string): string =>
  answer.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

/** Hash a security answer. Returns `scrypt$N$r$p$saltHex$digestHex`. */
export async function hashAnswer(answer: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const { N, r, p } = PARAMS;
  const digest = await derive(normalizeAnswer(answer), salt, N, r, p);
  return [SCHEME, N, r, p, salt.toString('hex'), digest.toString('hex')].join('$');
}

/**
 * Verify a security answer against a stored digest. Returns false rather than
 * throwing on a malformed or unknown-scheme digest, so a corrupt row cannot
 * turn into a 500 on the recovery path.
 */
export async function verifyAnswer(answer: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== SCHEME) return false;

    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

    const salt = Buffer.from(parts[4], 'hex');
    const expected = Buffer.from(parts[5], 'hex');
    if (salt.length === 0 || expected.length === 0) return false;

    const actual = await derive(normalizeAnswer(answer), salt, N, r, p);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
