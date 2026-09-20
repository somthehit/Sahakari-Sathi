/**
 * Database Config Encryption
 * AES-256-GCM reversible encryption for database credentials at rest.
 * Uses a key from DB_CONFIG_ENCRYPTION_KEY env var (or derives from SUPABASE_SERVICE_ROLE_KEY).
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT = 'sahakari-sathi-db-cfg-v1';

function getEncryptionKey(): Buffer {
  const raw = process.env.DB_CONFIG_ENCRYPTION_KEY;
  if (raw) {
    // If hex string, decode; otherwise derive from passphrase
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    return scryptSync(raw, SALT, 32);
  }
  // Derive from Supabase service role key (available in all environments)
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-dev-key-do-not-use-in-prod';
  return scryptSync(fallback, SALT, 32);
}

export function encryptPassword(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptPassword(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted password format');
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = Buffer.from(parts[2], 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Build a postgres.js connection URL from individual config fields.
 */
export function buildConnectionUrl(config: {
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password: string;
  sslMode?: string;
}): string {
  const encodedUser = encodeURIComponent(config.username);
  const encodedPass = encodeURIComponent(config.password);
  let url = `postgresql://${encodedUser}:${encodedPass}@${config.host}:${config.port}/${config.databaseName}`;
  if (config.sslMode && config.sslMode !== 'disable') {
    url += `?sslmode=${config.sslMode}`;
  }
  return url;
}

/**
 * Parse a DATABASE_URL into individual fields.
 */
export function parseConnectionUrl(url: string): {
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password: string;
  sslMode: string;
} | null {
  try {
    const parsed = new URL(url);
    const sslMode = parsed.searchParams.get('sslmode') || 'require';
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432', 10),
      databaseName: parsed.pathname.replace(/^\//, ''),
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      sslMode,
    };
  } catch {
    return null;
  }
}
