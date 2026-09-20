/**
 * Dynamic Pool Manager
 * Hot-swaps database pools without restarting the application.
 * Routes read queries to replica when enabled.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema';

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password: string;
  sslMode: string;
  minPoolSize: number;
  maxPoolSize: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  statementTimeoutMs: number;
  readReplicaEnabled: boolean;
  readReplicaHost?: string | null;
  readReplicaPort?: number | null;
}

export interface TestResult {
  success: boolean;
  latencyMs?: number;
  serverVersion?: string;
  databaseName?: string;
  error?: string;
}

function buildUrl(c: { host: string; port: number; databaseName: string; username: string; password: string; sslMode: string }): string {
  const u = encodeURIComponent(c.username);
  const p = encodeURIComponent(c.password);
  let url = `postgresql://${u}:${p}@${c.host}:${c.port}/${c.databaseName}`;
  if (c.sslMode && c.sslMode !== 'disable') url += `?sslmode=${c.sslMode}`;
  return url;
}

function sslConfig(sslMode: string): false | { rejectUnauthorized: boolean } {
  if (sslMode === 'disable') return false;
  if (sslMode === 'verify-full') return { rejectUnauthorized: true };
  if (sslMode === 'verify-ca') return { rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}

function createPool(c: DatabaseConnectionConfig, override?: Partial<DatabaseConnectionConfig>) {
  const cfg = { ...c, ...override };
  return postgres(buildUrl(cfg), {
    max: cfg.maxPoolSize,
    idle_timeout: Math.floor(cfg.idleTimeoutMs / 1000),
    connect_timeout: Math.floor(cfg.connectionTimeoutMs / 1000),
    ssl: sslConfig(cfg.sslMode),
    prepare: false, // Required for PgBouncer / Supabase transaction pooler
  });
}

class DynamicPoolManager {
  private _sql: ReturnType<typeof postgres> | null = null;
  private _db: PostgresJsDatabase<typeof schema> | null = null;
  private _directSql: ReturnType<typeof postgres> | null = null;
  private _config: DatabaseConnectionConfig | null = null;
  private _replicaSql: ReturnType<typeof postgres> | null = null;

  get sql() { return this._sql; }
  get db(): PostgresJsDatabase<typeof schema> | null { return this._db; }
  get directSql() { return this._directSql; }
  get config() { return this._config; }
  get hasReplica() { return this._replicaSql !== null; }

  /**
   * Initialize the pool from a config. Called once at startup.
   */
  initialize(config: DatabaseConnectionConfig) {
    this._config = config;
    this._sql = createPool(config);
    this._db = drizzle(this._sql, { schema, logger: process.env.NODE_ENV === 'development' });
    console.log(`[PoolManager] ✅ Primary pool created (${config.host}:${config.port}/${config.databaseName}, max=${config.maxPoolSize})`);

    if (config.readReplicaEnabled && config.readReplicaHost && config.readReplicaPort) {
      this._replicaSql = createPool(config, {
        host: config.readReplicaHost,
        port: config.readReplicaPort,
      });
      console.log(`[PoolManager] ✅ Read replica pool created (${config.readReplicaHost}:${config.readReplicaPort})`);
    }
  }

  /**
   * Hot-swap: create new pool with new config, drain old one after grace period.
   */
  async reconfigure(newConfig: DatabaseConnectionConfig) {
    const oldSql = this._sql;
    const oldReplica = this._replicaSql;

    this._config = newConfig;
    this._sql = createPool(newConfig);
    this._db = drizzle(this._sql, { schema, logger: process.env.NODE_ENV === 'development' });

    // Replica
    if (this._replicaSql) this._replicaSql = null;
    if (newConfig.readReplicaEnabled && newConfig.readReplicaHost && newConfig.readReplicaPort) {
      this._replicaSql = createPool(newConfig, {
        host: newConfig.readReplicaHost,
        port: newConfig.readReplicaPort,
      });
      console.log(`[PoolManager] 🔄 Read replica pool reconfigured (${newConfig.readReplicaHost}:${newConfig.readReplicaPort})`);
    }

    console.log(`[PoolManager] 🔄 Primary pool reconfigured (${newConfig.host}:${newConfig.port}, max=${newConfig.maxPoolSize})`);

    // Graceful drain after 10 seconds
    setTimeout(async () => {
      try { await oldSql?.end(); } catch { /* ignore */ }
      try { await oldReplica?.end(); } catch { /* ignore */ }
      console.log('[PoolManager] Old pool drained');
    }, 10_000);
  }

  /**
   * Get the appropriate pool for read or write operations.
   */
  getSql(mode: 'read' | 'write' = 'write') {
    if (mode === 'read' && this._replicaSql) return this._replicaSql;
    return this._sql;
  }

  /**
   * Get a direct connection (bypasses PgBouncer) for system catalog queries.
   * Falls back to primary pool if DATABASE_DIRECT_URL DNS doesn't resolve.
   */
  getDirectSql() {
    if (this._directSql) return this._directSql;
    const directUrl = process.env.DATABASE_DIRECT_URL;
    if (!directUrl) return this._sql;
    try {
      this._directSql = postgres(directUrl, {
        max: 3,
        idle_timeout: 30,
        connect_timeout: 10,
        ssl: directUrl.includes('supabase.co') ? { rejectUnauthorized: false } : false,
      });
      return this._directSql;
    } catch {
      console.warn('[PoolManager] Failed to create direct connection, falling back to primary pool');
      return this._sql;
    }
  }

  /**
   * Test a database connection with a temporary pool.
   */
  async testConnection(config: {
    host: string;
    port: number;
    databaseName: string;
    username: string;
    password: string;
    sslMode: string;
    connectionTimeoutMs: number;
  }): Promise<TestResult> {
    const startTime = Date.now();
    let testPool: ReturnType<typeof postgres> | null = null;
    try {
      testPool = postgres(buildUrl(config), {
        max: 1,
        idle_timeout: 5,
        connect_timeout: Math.floor(config.connectionTimeoutMs / 1000),
        ssl: sslConfig(config.sslMode),
      });

      const result = await testPool.unsafe('SELECT version(), current_database()');
      const row = Array.isArray(result) ? result[0] : result;
      await testPool.end();

      return {
        success: true,
        latencyMs: Date.now() - startTime,
        serverVersion: (row as any)?.version || 'unknown',
        databaseName: (row as any)?.current_database || 'unknown',
      };
    } catch (err: any) {
      if (testPool) { try { await testPool.end(); } catch { /* ignore */ } }
      // Sanitize error — never leak credentials or connection strings
      const msg = err?.message || 'Connection failed';
      const sanitized = msg
        .replace(/password[^@]*/gi, 'password=***')
        .replace(/postgresql:\/\/[^\s]*/gi, '***')
        .substring(0, 200);
      return { success: false, error: sanitized };
    }
  }

  /**
   * Close all pools (for graceful shutdown).
   */
  async close() {
    try { await this._sql?.end(); } catch { /* ignore */ }
    try { await this._replicaSql?.end(); } catch { /* ignore */ }
    try { await this._directSql?.end(); } catch { /* ignore */ }
    this._sql = null;
    this._db = null;
    this._replicaSql = null;
    this._directSql = null;
    console.log('[PoolManager] All pools closed');
  }
}

// Singleton
export const poolManager = new DynamicPoolManager();
