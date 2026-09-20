import { getRawSql } from '../../db/client';

const READONLY_PATTERN = /^\s*(SELECT|WITH|EXPLAIN|SHOW|TABLE|DESCRIBE)\b/i;
const FORBIDDEN_PATTERN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|GRANT|REVOKE|EXECUTE|CALL)\b/i;

export class DatabaseAdminService {
  static async getTableStats() {
    const sql = getRawSql();
    if (!sql) throw new Error('Database not connected');
    try {
      const rows = await sql`
        SELECT 
          schemaname,
          relname as table_name,
          n_live_tup as row_count,
          pg_size_pretty(pg_total_relation_size(relid)) as total_size,
          pg_size_pretty(pg_indexes_size(relid)) as index_size,
          seq_scan,
          idx_scan,
          n_tup_ins,
          n_tup_upd,
          n_tup_del,
          last_vacuum,
          last_autovacuum,
          last_analyze
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(relid) DESC
      `;
      return rows;
    } catch {
      const rows = await sql`
        SELECT
          schemaname,
          tablename as table_name,
          pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as total_size,
          pg_size_pretty(pg_indexes_size(schemaname || '.' || tablename)) as index_size
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
      `;
      return rows;
    }
  }

  static async getDatabaseOverview() {
    const sql = getRawSql();
    if (!sql) throw new Error('Database not connected');

    const safeQuery = async (query: Promise<any>, fallback: any) => {
      try { return await query; } catch { return [fallback]; }
    };

    const [sizeRow, connRow, maxConnRow, sharedRow, workMemRow, tableCount, totalRows] = await Promise.all([
      safeQuery(sql`SELECT pg_size_pretty(pg_database_size(current_database())) as total_size`, { total_size: '0 bytes' }),
      safeQuery(sql`SELECT count(*)::int as active_connections FROM pg_stat_activity WHERE datname = current_database()`, { active_connections: 0 }),
      safeQuery(sql`SELECT setting FROM pg_settings WHERE name = 'max_connections'`, { setting: '0' }),
      safeQuery(sql`SELECT setting FROM pg_settings WHERE name = 'shared_buffers'`, { setting: '0' }),
      safeQuery(sql`SELECT setting FROM pg_settings WHERE name = 'work_mem'`, { setting: '0' }),
      safeQuery(sql`SELECT count(*)::int as total_tables FROM pg_tables WHERE schemaname = 'public'`, { total_tables: 0 }),
      safeQuery(sql`SELECT COALESCE(SUM(n_live_tup), 0)::bigint as total_rows FROM pg_stat_user_tables WHERE schemaname = 'public'`, { total_rows: 0 }),
    ]);

    return {
      total_size: (sizeRow as any)[0]?.total_size ?? '0 bytes',
      active_connections: (connRow as any)[0]?.active_connections ?? 0,
      max_connections: (maxConnRow as any)[0]?.setting ?? '0',
      shared_buffers: (sharedRow as any)[0]?.setting ?? '0',
      work_mem: (workMemRow as any)[0]?.setting ?? '0',
      total_tables: (tableCount as any)[0]?.total_tables ?? 0,
      total_rows: Number((totalRows as any)[0]?.total_rows ?? 0),
    };
  }

  static async getIndexStats() {
    const sql = getRawSql();
    if (!sql) throw new Error('Database not connected');
    try {
      const rows = await sql`
        SELECT 
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
          idx_scan as scans
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 30
      `;
      return rows;
    } catch {
      const rows = await sql`
        SELECT
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY pg_relation_size(indexname::regclass) DESC
        LIMIT 30
      `;
      return rows;
    }
  }

  static async getRecentQueries() {
    const sql = getRawSql();
    if (!sql) throw new Error('Database not connected');
    try {
      const rows = await sql`
        SELECT query, calls, mean_exec_time, total_exec_time
        FROM pg_stat_statements
        ORDER BY total_exec_time DESC
        LIMIT 20
      `;
      return { available: true, queries: rows };
    } catch {
      return {
        available: false,
        queries: [],
        note: 'pg_stat_statements extension is not available. Enable it with: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;',
      };
    }
  }

  static async getVacuumStatus() {
    const sql = getRawSql();
    if (!sql) throw new Error('Database not connected');
    try {
      const rows = await sql`
        SELECT 
          relname,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze,
          n_dead_tup,
          n_live_tup
        FROM pg_stat_user_tables
        WHERE schemaname = 'public' AND n_dead_tup > 0
        ORDER BY n_dead_tup DESC
      `;
      return rows;
    } catch {
      return [];
    }
  }

  static async runReadOnlyQuery(query: string) {
    const sql = getRawSql();
    if (!sql) {
      const e: any = new Error('Database not connected');
      e.statusCode = 503;
      throw e;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      const e: any = new Error('Query cannot be empty');
      e.statusCode = 400;
      throw e;
    }
    if (trimmed.length > 5000) {
      const e: any = new Error('Query exceeds 5000 character limit');
      e.statusCode = 400;
      throw e;
    }

    if (FORBIDDEN_PATTERN.test(trimmed)) {
      const e: any = new Error('Only SELECT, WITH, EXPLAIN, SHOW, TABLE, and DESCRIBE queries are allowed. Write operations are prohibited.');
      e.statusCode = 403;
      throw e;
    }

    if (!READONLY_PATTERN.test(trimmed)) {
      const e: any = new Error('Query must start with SELECT, WITH, EXPLAIN, SHOW, TABLE, or DESCRIBE.');
      e.statusCode = 400;
      throw e;
    }

    try {
      const start = Date.now();
      const rows = await sql.unsafe(trimmed);
      const elapsed = Date.now() - start;
      return {
        rows: Array.isArray(rows) ? rows : [],
        rowCount: Array.isArray(rows) ? rows.length : 0,
        executionTimeMs: elapsed,
      };
    } catch (err: any) {
      const e: any = new Error(`Query execution failed: ${err.message}`);
      e.statusCode = 400;
      throw e;
    }
  }
}
