-- Platform Control tables
-- Subscription plans, system settings, API keys, and platform announcements

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly_npr NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly_npr NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_members INTEGER NOT NULL DEFAULT 1000,
  max_users INTEGER NOT NULL DEFAULT 50,
  max_branches INTEGER NOT NULL DEFAULT 5,
  storage_limit_mb INTEGER NOT NULL DEFAULT 5120,
  ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ai_credits INTEGER NOT NULL DEFAULT 0,
  features JSONB,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS splans_code_idx ON subscription_plans(code);
CREATE INDEX IF NOT EXISTS splans_status_idx ON subscription_plans(status);
CREATE INDEX IF NOT EXISTS splans_sort_idx ON subscription_plans(sort_order);

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT,
  value_type VARCHAR(20) NOT NULL DEFAULT 'string',
  label VARCHAR(200),
  description TEXT,
  is_secret BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS syscfg_key_idx ON system_settings(key);
CREATE INDEX IF NOT EXISTS syscfg_cat_idx ON system_settings(category);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  key_prefix VARCHAR(10) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  secret_hash VARCHAR(255),
  scopes JSONB NOT NULL DEFAULT '["*"]',
  rate_limit INTEGER NOT NULL DEFAULT 1000,
  organization_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS apikey_prefix_idx ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS apikey_status_idx ON api_keys(status);
CREATE INDEX IF NOT EXISTS apikey_org_idx ON api_keys(organization_id);

CREATE TABLE IF NOT EXISTS platform_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'info',
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  target_audience VARCHAR(30) NOT NULL DEFAULT 'all',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pannc_active_idx ON platform_announcements(is_active);
CREATE INDEX IF NOT EXISTS pannc_type_idx ON platform_announcements(type);
CREATE INDEX IF NOT EXISTS pannc_priority_idx ON platform_announcements(priority);
CREATE INDEX IF NOT EXISTS pannc_audience_idx ON platform_announcements(target_audience);

-- Seed default subscription plans
INSERT INTO subscription_plans (code, name, description, price_monthly_npr, price_yearly_npr, max_members, max_users, max_branches, storage_limit_mb, ai_enabled, ai_credits, features, is_public, sort_order)
VALUES
  ('trial', 'Trial', 'Free trial plan to explore the platform', 0, 0, 100, 5, 1, 1024, false, 0, '["basic_savings","basic_loans","basic_shares","reports"]', true, 0),
  ('starter', 'Starter', 'For small cooperatives getting started', 5000, 50000, 1000, 20, 3, 2560, false, 0, '["savings","loans","shares","accounting","reports","members"]', true, 1),
  ('growth', 'Growth', 'For growing cooperatives with advanced needs', 15000, 150000, 5000, 50, 5, 5120, true, 100, '["savings","loans","shares","accounting","reports","members","hr","inventory","ai_assistant","advanced_reports"]', true, 2),
  ('enterprise', 'Enterprise', 'Full platform access for large cooperatives', 50000, 500000, 50000, 500, 50, 51200, true, 1000, '["savings","loans","shares","accounting","reports","members","hr","inventory","ai_assistant","advanced_reports","audit_engine","legal_templates","document_templates","passbooks","reconciliation","api_access"]', true, 3)
ON CONFLICT (code) DO NOTHING;

-- Seed default system settings
INSERT INTO system_settings (category, key, value, value_type, label, description, is_secret)
VALUES
  -- General
  ('general', 'platform_name', 'Sahakari Sathi', 'string', 'Platform Name', 'The display name of the platform', false),
  ('general', 'platform_version', '1.0.0', 'string', 'Platform Version', 'Current platform version', false),
  ('general', 'support_email', 'support@sahakarisathi.com', 'string', 'Support Email', 'Primary support contact', false),
  ('general', 'maintenance_mode', 'false', 'boolean', 'Maintenance Mode', 'Put the platform in maintenance mode', false),

  -- Database
  ('database', 'db_host', '', 'string', 'Database Host', 'PostgreSQL host', false),
  ('database', 'db_port', '5432', 'number', 'Database Port', 'PostgreSQL port', false),
  ('database', 'db_name', 'postgres', 'string', 'Database Name', 'PostgreSQL database name', false),
  ('database', 'db_pool_size', '10', 'number', 'Connection Pool Size', 'Max connections per process', false),

  -- Email
  ('email', 'smtp_host', '', 'string', 'SMTP Host', 'Outgoing mail server', false),
  ('email', 'smtp_port', '587', 'number', 'SMTP Port', 'SMTP port', false),
  ('email', 'smtp_user', '', 'string', 'SMTP Username', 'Mail server username', false),
  ('email', 'smtp_pass', '', 'password', 'SMTP Password', 'Mail server password', true),
  ('email', 'smtp_from_name', 'Sahakari Sathi', 'string', 'From Name', 'Default sender name', false),
  ('email', 'smtp_from_email', 'noreply@sahakarisathi.com', 'string', 'From Email', 'Default sender address', false),

  -- SMS
  ('sms', 'sms_provider', '', 'string', 'SMS Provider', 'SMS gateway provider', false),
  ('sms', 'sms_api_key', '', 'password', 'SMS API Key', 'Provider API key', true),
  ('sms', 'sms_sender_id', '', 'string', 'SMS Sender ID', 'Registered sender ID', false),

  -- Branding
  ('branding', 'primary_color', '#047857', 'string', 'Primary Color', 'Platform primary theme color', false),
  ('branding', 'logo_url', '', 'string', 'Logo URL', 'Platform logo URL', false),
  ('branding', 'favicon_url', '', 'string', 'Favicon URL', 'Browser tab icon', false),
  ('branding', 'footer_text', 'Powered by Sahakari Sathi', 'string', 'Footer Text', 'Default footer text', false),

  -- Security
  ('security', 'session_timeout_minutes', '480', 'number', 'Session Timeout', 'Minutes before session expires', false),
  ('security', 'max_login_attempts', '5', 'number', 'Max Login Attempts', 'Lock account after N failures', false),
  ('security', 'require_2fa', 'false', 'boolean', 'Require 2FA', 'Enforce two-factor auth', false),
  ('security', 'password_min_length', '8', 'number', 'Min Password Length', 'Minimum password characters', false)
ON CONFLICT (key) DO NOTHING;
