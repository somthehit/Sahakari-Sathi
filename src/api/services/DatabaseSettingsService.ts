/**
 * Database Settings Service
 * CRUD for the database_settings table with encrypted password handling.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { databaseSettings } from '../../db/schema/databaseSettings';
import { encryptPassword, decryptPassword } from '../utils/dbEncrypt';
import { poolManager } from '../../db/poolManager';
import type { DatabaseConnectionConfig } from '../../db/poolManager';

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function sanitizeForClient(row: any) {
  const { passwordEncrypted, ...safe } = row;
  return {
    ...safe,
    hasPassword: !!passwordEncrypted,
    passwordPreview: passwordEncrypted ? '••••••••' : '',
  };
}

export class DatabaseSettingsService {
  /**
   * Get current config (password masked, never returned to client).
   */
  async getConfig() {
    const db = getDb();
    if (!db) throw new ApiError(503, 'Database not connected');

    const rows = await db.select().from(databaseSettings).limit(1);
    if (rows.length === 0) {
      // Return defaults from env
      return this.getDefaultsFromEnv();
    }
    return sanitizeForClient(rows[0]);
  }

  /**
   * Update config. Password is encrypted before storage.
   * Only updates password if explicitly provided (non-empty string).
   */
  async updateConfig(data: Record<string, any>, updatedBy?: string) {
    const db = getDb();
    if (!db) throw new ApiError(503, 'Database not connected');

    const existing = await db.select().from(databaseSettings).limit(1);

    const fields: Record<string, any> = {};
    if (data.environment !== undefined) fields.environment = data.environment;
    if (data.host !== undefined) fields.host = data.host;
    if (data.port !== undefined) fields.port = parseInt(data.port, 10);
    if (data.databaseName !== undefined) fields.databaseName = data.databaseName;
    if (data.username !== undefined) fields.username = data.username;
    if (data.sslMode !== undefined) fields.sslMode = data.sslMode;
    if (data.minPoolSize !== undefined) fields.minPoolSize = parseInt(data.minPoolSize, 10);
    if (data.maxPoolSize !== undefined) fields.maxPoolSize = parseInt(data.maxPoolSize, 10);
    if (data.connectionTimeoutMs !== undefined) fields.connectionTimeoutMs = parseInt(data.connectionTimeoutMs, 10);
    if (data.idleTimeoutMs !== undefined) fields.idleTimeoutMs = parseInt(data.idleTimeoutMs, 10);
    if (data.statementTimeoutMs !== undefined) fields.statementTimeoutMs = parseInt(data.statementTimeoutMs, 10);
    if (data.readReplicaEnabled !== undefined) fields.readReplicaEnabled = !!data.readReplicaEnabled;
    if (data.readReplicaHost !== undefined) fields.readReplicaHost = data.readReplicaHost || null;
    if (data.readReplicaPort !== undefined) fields.readReplicaPort = data.readReplicaPort ? parseInt(data.readReplicaPort, 10) : null;
    if (data.healthCheckIntervalSec !== undefined) fields.healthCheckIntervalSec = parseInt(data.healthCheckIntervalSec, 10);
    if (data.slowQueryThresholdMs !== undefined) fields.slowQueryThresholdMs = parseInt(data.slowQueryThresholdMs, 10);

    // Password: only encrypt and store if explicitly provided
    if (data.password && typeof data.password === 'string' && data.password.trim()) {
      fields.passwordEncrypted = encryptPassword(data.password.trim());
    }

    fields.updatedAt = new Date();
    if (updatedBy) fields.updatedBy = updatedBy;

    if (existing.length === 0) {
      // Insert new config (require password on first save)
      if (!fields.passwordEncrypted) {
        throw new ApiError(400, 'Password is required when saving database configuration for the first time');
      }
      const [row] = await db.insert(databaseSettings).values(fields).returning();
      return sanitizeForClient(row);
    } else {
      const [row] = await db.update(databaseSettings)
        .set(fields)
        .where(eq(databaseSettings.id, existing[0].id))
        .returning();
      return sanitizeForClient(row);
    }
  }

  /**
   * Test a database connection with the given (or current) config.
   */
  async testConnection(overrideConfig?: Record<string, any>) {
    let config: any;

    if (overrideConfig && Object.keys(overrideConfig).length > 0) {
      config = overrideConfig;
    } else {
      const current = await this.getRawConfig();
      if (!current) throw new ApiError(404, 'No database configuration found. Save a configuration first.');
      config = current;
    }

    return poolManager.testConnection({
      host: config.host,
      port: parseInt(config.port, 10),
      databaseName: config.databaseName,
      username: config.username,
      password: config.password || (config.passwordEncrypted ? decryptPassword(config.passwordEncrypted) : ''),
      sslMode: config.sslMode || 'require',
      connectionTimeoutMs: parseInt(config.connectionTimeoutMs || 5000, 10),
    });
  }

  /**
   * Apply saved config to the live pool manager.
   */
  async applySavedConfig() {
    const raw = await this.getRawConfig();
    if (!raw) {
      console.log('[DBConfig] No saved config found, using .env defaults');
      return false;
    }

    const password = raw.passwordEncrypted ? decryptPassword(raw.passwordEncrypted) : '';
    const config: DatabaseConnectionConfig = {
      host: raw.host,
      port: raw.port || 5432,
      databaseName: raw.databaseName,
      username: raw.username,
      password,
      sslMode: raw.sslMode || 'require',
      minPoolSize: raw.minPoolSize || 2,
      maxPoolSize: raw.maxPoolSize || 10,
      connectionTimeoutMs: raw.connectionTimeoutMs || 5000,
      idleTimeoutMs: raw.idleTimeoutMs || 30000,
      statementTimeoutMs: raw.statementTimeoutMs || 30000,
      readReplicaEnabled: raw.readReplicaEnabled || false,
      readReplicaHost: raw.readReplicaHost,
      readReplicaPort: raw.readReplicaPort,
    };

    poolManager.reconfigure(config);
    console.log('[DBConfig] ✅ Applied saved database configuration');
    return true;
  }

  /**
   * Get raw config (with encrypted password) — internal use only.
   */
  private async getRawConfig() {
    const db = getDb();
    if (!db) return null;
    const rows = await db.select().from(databaseSettings).limit(1);
    return rows[0] || null;
  }

  /**
   * Derive defaults from .env when no config exists in DB.
   */
  private getDefaultsFromEnv() {
    const url = process.env.DATABASE_URL;
    if (!url) return { host: '', port: 5432, databaseName: '', username: '', hasPassword: false, passwordPreview: '', sslMode: 'require' };

    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port || '5432', 10),
        databaseName: parsed.pathname.replace(/^\//, ''),
        username: decodeURIComponent(parsed.username),
        hasPassword: !!parsed.password,
        passwordPreview: parsed.password ? '••••••••' : '',
        sslMode: parsed.searchParams.get('sslmode') || 'require',
        environment: 'production',
        minPoolSize: 2,
        maxPoolSize: 10,
        connectionTimeoutMs: 5000,
        idleTimeoutMs: 30000,
        statementTimeoutMs: 30000,
        readReplicaEnabled: false,
        healthCheckIntervalSec: 30,
        slowQueryThresholdMs: 1000,
      };
    } catch {
      return { host: '', port: 5432, databaseName: '', username: '', hasPassword: false, passwordPreview: '', sslMode: 'require' };
    }
  }
}
