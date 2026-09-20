/**
 * Database Client Singleton
 * Drizzle ORM with postgres driver — connects to Supabase PostgreSQL
 * Falls back gracefully when DATABASE_URL is not configured (dev/prototype mode)
 *
 * After initial boot, the pool manager can hot-swap connections based on
 * admin-configured database_settings.
 */
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';
import { poolManager } from './poolManager';
import type { DatabaseConnectionConfig } from './poolManager';

let _initialized = false;

function initFromEnv() {
  if (_initialized) return;
  _initialized = true;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn(
      '[DB] DATABASE_URL not set. Running in prototype/mock mode — data will NOT persist.\n' +
      '[DB] Add DATABASE_URL to your .env file to enable persistent storage.'
    );
    return;
  }

  // Parse the DATABASE_URL to extract config fields
  try {
    const parsed = new URL(databaseUrl);
    const sslMode = parsed.searchParams.get('sslmode') ||
      (databaseUrl.includes('supabase.co') ? 'require' : 'disable');

    const config: DatabaseConnectionConfig = {
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432', 10),
      databaseName: parsed.pathname.replace(/^\//, ''),
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      sslMode,
      minPoolSize: 2,
      maxPoolSize: 10,
      connectionTimeoutMs: 30000,
      idleTimeoutMs: 30000,
      statementTimeoutMs: 30000,
      readReplicaEnabled: false,
    };

    poolManager.initialize(config);
  } catch (err: any) {
    console.error('[DB] Failed to parse DATABASE_URL:', err.message);
  }
}

export function getDb() {
  initFromEnv();
  return poolManager.db;
}

export async function closeDb() {
  await poolManager.close();
}

/**
 * Health check — verifies DB connectivity
 */
export async function checkDbHealth(): Promise<boolean> {
  const sql = getRawSql();
  if (!sql) return false;
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Raw SQL client (postgres.js) — use for catalog/system queries
 * that don't map to Drizzle schema tables.
 */
export function getRawSql() {
  initFromEnv();
  return poolManager.sql;
}

/**
 * Direct SQL client — bypasses PgBouncer for system catalog queries
 * (pg_stat_*, pg_settings, etc.) that require a dedicated connection.
 */
export function getDirectSql() {
  initFromEnv();
  return poolManager.getDirectSql();
}

/**
 * Read-optimized SQL client — routes to replica when available.
 */
export function getReadSql() {
  initFromEnv();
  return poolManager.getSql('read');
}

/**
 * Re-initialize the pool manager with a new config (hot-swap).
 */
export async function reconfigurePool(newConfig: DatabaseConnectionConfig) {
  await poolManager.reconfigure(newConfig);
}

/**
 * Initialize pool manager from saved database_settings (called at startup).
 */
export function initializePoolFromConfig(config: DatabaseConnectionConfig) {
  poolManager.initialize(config);
  _initialized = true;
}

export type Database = NonNullable<ReturnType<typeof getDb>>;

export type DbExecutor = PgDatabase<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
