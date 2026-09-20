import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { eq, and, desc, count, sql, ilike, ne } from 'drizzle-orm';
import { apiKeys } from '../../db/schema/platformControl';
import { getDb } from '../../db/client';

export class ApiKeyError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const KEY_PREFIX = 'sk_live_';
const SECRET_PREFIX = 'sk_secret_';
const KEY_HEX_BYTES = 16;
const SECRET_HEX_BYTES = 24;
const SALT_BYTES = 16;
const KEYLEN = 64;
const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const SCHEME = 'scrypt';

function generateKey(): string {
  return KEY_PREFIX + randomBytes(KEY_HEX_BYTES).toString('hex');
}

function generateSecret(): string {
  return SECRET_PREFIX + randomBytes(SECRET_HEX_BYTES).toString('hex');
}

function derive(secret: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, KEYLEN, { N, r, p, maxmem: 256 * N * r }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

async function hashValue(value: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const { N, r, p } = PARAMS;
  const digest = await derive(value, salt, N, r, p);
  return [SCHEME, N, r, p, salt.toString('hex'), digest.toString('hex')].join('$');
}

async function compareValue(plain: string, stored: string): Promise<boolean> {
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
    const actual = await derive(plain, salt, N, r, p);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function maskKey(fullKey: string): string {
  return fullKey.slice(0, 10) + '****' + fullKey.slice(-4);
}

function sanitizeRow(row: any) {
  const result = { ...row };
  delete result.keyHash;
  delete result.secretHash;
  return result;
}

export interface ListKeysOptions {
  status?: string;
  organizationId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateKeyData {
  name: string;
  scopes?: string[];
  rateLimit?: number;
  organizationId?: string;
  expiresAt?: string;
}

export interface CreateKeyResult {
  key: string;
  secret: string;
  keyPrefix: string;
  keyPreview: string;
  id: string;
  name: string;
  scopes: string[];
  rateLimit: number;
  organizationId: string | null;
  expiresAt: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
}

export interface KeyStats {
  totalKeys: number;
  activeKeys: number;
  revokedKeys: number;
  expiredKeys: number;
}

export class ApiKeyService {
  async listKeys(options: ListKeysOptions) {
    const db = getDb();
    if (!db) throw new ApiKeyError(500, 'Database not available');

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (options.status) {
      conditions.push(eq(apiKeys.status, options.status));
    }
    if (options.organizationId) {
      conditions.push(eq(apiKeys.organizationId, options.organizationId));
    }
    if (options.search) {
      conditions.push(ilike(apiKeys.name, `%${options.search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(apiKeys)
      .where(where) as any[];

    const rows = await db
      .select()
      .from(apiKeys)
      .where(where)
      .orderBy(desc(apiKeys.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows.map(sanitizeRow),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getKeyById(id: string) {
    const db = getDb();
    if (!db) throw new ApiKeyError(500, 'Database not available');

    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (!row) throw new ApiKeyError(404, 'API key not found');

    return sanitizeRow(row);
  }

  async createKey(data: CreateKeyData, createdBy: string): Promise<CreateKeyResult> {
    const db = getDb();
    if (!db) throw new ApiKeyError(500, 'Database not available');

    if (!data.name || !data.name.trim()) {
      throw new ApiKeyError(400, 'Key name is required');
    }

    const plainKey = generateKey();
    const plainSecret = generateSecret();
    const keyHash = await hashValue(plainKey);
    const secretHash = await hashValue(plainSecret);
    const keyPrefix = plainKey.slice(0, 10);
    const scopes = data.scopes || ['*'];

    const [inserted] = await db
      .insert(apiKeys)
      .values({
        name: data.name.trim(),
        keyPrefix,
        keyHash,
        secretHash,
        scopes,
        rateLimit: data.rateLimit ?? 1000,
        organizationId: data.organizationId || null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        status: 'Active',
        createdBy,
      })
      .returning();

    return {
      key: plainKey,
      secret: plainSecret,
      keyPrefix,
      keyPreview: maskKey(plainKey),
      id: inserted.id,
      name: inserted.name,
      scopes: inserted.scopes as string[],
      rateLimit: inserted.rateLimit,
      organizationId: inserted.organizationId,
      expiresAt: inserted.expiresAt?.toISOString() || null,
      status: inserted.status,
      createdBy: inserted.createdBy,
      createdAt: inserted.createdAt.toISOString(),
    };
  }

  async revokeKey(id: string, reason?: string) {
    const db = getDb();
    if (!db) throw new ApiKeyError(500, 'Database not available');

    const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (!existing) throw new ApiKeyError(404, 'API key not found');
    if (existing.status === 'Revoked') throw new ApiKeyError(400, 'API key is already revoked');

    const [updated] = await db
      .update(apiKeys)
      .set({
        status: 'Revoked',
        revokedAt: new Date(),
        revokedReason: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, id))
      .returning();

    return sanitizeRow(updated);
  }

  async deleteKey(id: string) {
    const db = getDb();
    if (!db) throw new ApiKeyError(500, 'Database not available');

    const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (!existing) throw new ApiKeyError(404, 'API key not found');

    await db.delete(apiKeys).where(eq(apiKeys.id, id));
    return { success: true, message: 'API key deleted' };
  }

  async validateKey(key: string) {
    const db = getDb();
    if (!db) throw new ApiKeyError(500, 'Database not available');

    const rows = await db.select().from(apiKeys);
    for (const row of rows) {
      const keyMatch = await compareValue(key, row.keyHash);
      if (keyMatch) {
        if (row.status !== 'Active') {
          throw new ApiKeyError(403, `API key is ${row.status.toLowerCase()}`);
        }
        if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
          await db
            .update(apiKeys)
            .set({ status: 'Expired', updatedAt: new Date() })
            .where(eq(apiKeys.id, row.id));
          throw new ApiKeyError(403, 'API key has expired');
        }
        await db
          .update(apiKeys)
          .set({ lastUsedAt: new Date(), updatedAt: new Date() })
          .where(eq(apiKeys.id, row.id));

        return {
          id: row.id,
          name: row.name,
          scopes: row.scopes,
          rateLimit: row.rateLimit,
          organizationId: row.organizationId,
        };
      }
    }

    throw new ApiKeyError(401, 'Invalid API key');
  }

  async rotateKey(id: string, rotatedBy: string) {
    const db = getDb();
    if (!db) throw new ApiKeyError(500, 'Database not available');

    const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (!existing) throw new ApiKeyError(404, 'API key not found');

    const newPlainKey = generateKey();
    const newPlainSecret = generateSecret();
    const newKeyHash = await hashValue(newPlainKey);
    const newSecretHash = await hashValue(newPlainSecret);
    const newKeyPrefix = newPlainKey.slice(0, 10);

    await db
      .update(apiKeys)
      .set({
        status: 'Revoked',
        revokedAt: new Date(),
        revokedReason: 'Rotated',
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, id));

    const [inserted] = await db
      .insert(apiKeys)
      .values({
        name: existing.name + ' (rotated)',
        keyPrefix: newKeyPrefix,
        keyHash: newKeyHash,
        secretHash: newSecretHash,
        scopes: existing.scopes as string[],
        rateLimit: existing.rateLimit,
        organizationId: existing.organizationId,
        expiresAt: existing.expiresAt,
        status: 'Active',
        createdBy: rotatedBy,
      })
      .returning();

    return {
      key: newPlainKey,
      secret: newPlainSecret,
      keyPrefix: newKeyPrefix,
      keyPreview: maskKey(newPlainKey),
      id: inserted.id,
      name: inserted.name,
      scopes: inserted.scopes as string[],
      rateLimit: inserted.rateLimit,
      organizationId: inserted.organizationId,
      expiresAt: inserted.expiresAt?.toISOString() || null,
      status: inserted.status,
      createdAt: inserted.createdAt.toISOString(),
      oldKeyId: id,
    };
  }

  async getKeyStats(): Promise<KeyStats> {
    const db = getDb();
    if (!db) throw new ApiKeyError(500, 'Database not available');

    const [totalRow] = await db.select({ total: count() }).from(apiKeys) as any[];
    const [activeRow] = await db
      .select({ total: count() })
      .from(apiKeys)
      .where(eq(apiKeys.status, 'Active')) as any[];
    const [revokedRow] = await db
      .select({ total: count() })
      .from(apiKeys)
      .where(eq(apiKeys.status, 'Revoked')) as any[];

    const now = new Date();
    const allKeys = await db
      .select({ status: apiKeys.status, expiresAt: apiKeys.expiresAt })
      .from(apiKeys) as any[];
    const expiredCount = allKeys.filter(
      (k: any) => k.status !== 'Revoked' && k.expiresAt && new Date(k.expiresAt) < now
    ).length;

    return {
      totalKeys: totalRow?.total ?? 0,
      activeKeys: activeRow?.total ?? 0,
      revokedKeys: revokedRow?.total ?? 0,
      expiredKeys: expiredCount,
    };
  }
}
