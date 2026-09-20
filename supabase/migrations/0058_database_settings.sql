-- Migration 0058: Database Settings table
-- Production-scale database configuration with encrypted credentials

CREATE TABLE IF NOT EXISTS database_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  environment VARCHAR(20) DEFAULT 'production',
  host TEXT NOT NULL,
  port INTEGER DEFAULT 5432,
  database_name TEXT NOT NULL,
  username TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  ssl_mode VARCHAR(20) DEFAULT 'require',
  min_pool_size INTEGER DEFAULT 2,
  max_pool_size INTEGER DEFAULT 10,
  connection_timeout_ms INTEGER DEFAULT 5000,
  idle_timeout_ms INTEGER DEFAULT 30000,
  statement_timeout_ms INTEGER DEFAULT 30000,
  read_replica_enabled BOOLEAN DEFAULT FALSE,
  read_replica_host TEXT,
  read_replica_port INTEGER,
  health_check_interval_sec INTEGER DEFAULT 30,
  slow_query_threshold_ms INTEGER DEFAULT 1000,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dbcfg_env_idx ON database_settings(environment);
