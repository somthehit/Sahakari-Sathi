/**
 * Database Settings — Schema
 * Dedicated table for production-scale database configuration.
 * Passwords are encrypted at rest; API never returns them to clients.
 */
import {
  pgTable, text, varchar, integer, boolean, timestamp, uuid, index,
} from 'drizzle-orm/pg-core';

export const databaseSettings = pgTable('database_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  environment: varchar('environment', { length: 20 }).default('production'),

  // Connection
  host: text('host').notNull(),
  port: integer('port').default(5432),
  databaseName: text('database_name').notNull(),
  username: text('username').notNull(),
  passwordEncrypted: text('password_encrypted').notNull(),
  sslMode: varchar('ssl_mode', { length: 20 }).default('require'),

  // Pooling
  minPoolSize: integer('min_pool_size').default(2),
  maxPoolSize: integer('max_pool_size').default(10),
  connectionTimeoutMs: integer('connection_timeout_ms').default(5000),
  idleTimeoutMs: integer('idle_timeout_ms').default(30000),
  statementTimeoutMs: integer('statement_timeout_ms').default(30000),

  // Read replica (optional)
  readReplicaEnabled: boolean('read_replica_enabled').default(false),
  readReplicaHost: text('read_replica_host'),
  readReplicaPort: integer('read_replica_port'),

  // Health / monitoring
  healthCheckIntervalSec: integer('health_check_interval_sec').default(30),
  slowQueryThresholdMs: integer('slow_query_threshold_ms').default(1000),

  // Audit
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('dbcfg_env_idx').on(table.environment),
]);
