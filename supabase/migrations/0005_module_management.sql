-- ============================================================================
-- Module Management System (platform / super-admin level)
-- Enterprise module catalog, feature flags, licensing, org assignments,
-- marketplace, usage analytics, audit, templates, notifications, health.
-- ============================================================================

CREATE TYPE module_type AS ENUM ('Core','Optional','Premium','Enterprise','Marketplace','Partner','Custom','Experimental','Beta','Deprecated','Hidden');
CREATE TYPE module_status AS ENUM ('Draft','Active','Inactive','Beta','Deprecated');
CREATE TYPE module_license_type AS ENUM ('Free','Trial','Monthly','Quarterly','Yearly','Lifetime','Enterprise','Custom');
CREATE TYPE org_module_status AS ENUM ('Enabled','Disabled','Trial','Pending','Expired');
CREATE TYPE module_version_channel AS ENUM ('Stable','Beta','LTS');
CREATE TYPE module_health_status AS ENUM ('Healthy','Degraded','Down','Unknown');
CREATE TYPE module_audit_action AS ENUM ('CREATE','UPDATE','DELETE','ENABLE','DISABLE','ASSIGN','UNASSIGN','INSTALL','UNINSTALL','UPGRADE','ROLLBACK','LICENSE_CHANGE','FEATURE_TOGGLE','SETTINGS_CHANGE','PERMISSION_CHANGE','IMPORT','EXPORT');

-- ── Categories ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  icon varchar(50) DEFAULT 'Package',
  color varchar(20) DEFAULT '#059669',
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS module_categories_active_idx ON module_categories (is_active, sort_order);

-- ── Modules ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  name_nepali varchar(150),
  short_description text,
  long_description text,
  category_id uuid REFERENCES module_categories(id) ON DELETE SET NULL,
  type module_type NOT NULL DEFAULT 'Optional',
  icon varchar(50) DEFAULT 'Package',
  color varchar(20) DEFAULT '#059669',
  developer varchar(100) DEFAULT 'Sahakari Sathi',
  website varchar(200),
  version_current varchar(20) DEFAULT '1.0.0',
  version_latest varchar(20) DEFAULT '1.0.0',
  license_type module_license_type NOT NULL DEFAULT 'Free',
  status module_status NOT NULL DEFAULT 'Active',
  is_required boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  auto_update boolean NOT NULL DEFAULT false,
  release_channel module_version_channel NOT NULL DEFAULT 'Stable',
  last_released_at timestamp,
  last_checked_at timestamp,
  rating numeric(3,2) DEFAULT '0',
  download_count integer NOT NULL DEFAULT 0,
  install_count integer NOT NULL DEFAULT 0,
  settings_schema jsonb,
  screenshots jsonb,
  metadata jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS modules_name_uniq ON modules (name);
CREATE INDEX IF NOT EXISTS modules_category_idx ON modules (category_id);
CREATE INDEX IF NOT EXISTS modules_type_status_idx ON modules (type, status);
CREATE INDEX IF NOT EXISTS modules_required_idx ON modules (is_required);

-- ── Features (feature flags) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  code varchar(80) NOT NULL,
  name varchar(120) NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  is_required boolean NOT NULL DEFAULT false,
  settings_schema jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS module_features_module_code_uniq ON module_features (module_id, code);
CREATE INDEX IF NOT EXISTS module_features_module_idx ON module_features (module_id);

-- ── Dependencies ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  depends_on_module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  min_version varchar(20),
  is_required boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS module_dependencies_pair_uniq ON module_dependencies (module_id, depends_on_module_id);
CREATE INDEX IF NOT EXISTS module_dependencies_module_idx ON module_dependencies (module_id);
CREATE INDEX IF NOT EXISTS module_dependencies_dep_idx ON module_dependencies (depends_on_module_id);

-- ── Versions ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  version varchar(20) NOT NULL,
  channel module_version_channel NOT NULL DEFAULT 'Stable',
  release_date timestamp,
  release_notes text,
  is_current boolean NOT NULL DEFAULT false,
  is_latest boolean NOT NULL DEFAULT false,
  min_app_version varchar(20),
  compatibility jsonb,
  checksum varchar(128),
  size_bytes bigint NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS module_versions_module_version_uniq ON module_versions (module_id, version);
CREATE INDEX IF NOT EXISTS module_versions_module_idx ON module_versions (module_id);

-- ── Settings definitions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  key varchar(80) NOT NULL,
  label varchar(120) NOT NULL,
  type varchar(20) NOT NULL DEFAULT 'text',
  group_name varchar(80) NOT NULL DEFAULT 'General',
  default_value jsonb,
  options jsonb,
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS module_settings_module_key_uniq ON module_settings (module_id, key);
CREATE INDEX IF NOT EXISTS module_settings_module_idx ON module_settings (module_id);

-- ── Permission actions catalog ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  action varchar(30) NOT NULL,
  label varchar(60) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS module_permissions_module_action_uniq ON module_permissions (module_id, action);
CREATE INDEX IF NOT EXISTS module_permissions_module_idx ON module_permissions (module_id);

-- ── License plans per module ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  code varchar(50) NOT NULL,
  name varchar(100) NOT NULL,
  type module_license_type NOT NULL,
  price numeric(14,2) DEFAULT '0',
  currency varchar(3) DEFAULT 'NPR',
  billing_period varchar(20),
  features jsonb,
  max_users integer,
  max_branches integer,
  trial_days integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS module_licenses_module_code_uniq ON module_licenses (module_id, code);
CREATE INDEX IF NOT EXISTS module_licenses_module_idx ON module_licenses (module_id);

-- ── Organization assignments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  status org_module_status NOT NULL DEFAULT 'Enabled',
  license_id uuid REFERENCES module_licenses(id) ON DELETE SET NULL,
  is_trial boolean NOT NULL DEFAULT false,
  activation_date timestamp,
  expiry_date timestamp,
  auto_renew boolean NOT NULL DEFAULT false,
  grace_days integer NOT NULL DEFAULT 0,
  notes text,
  version_installed varchar(20),
  created_by uuid,
  updated_by uuid,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS organization_modules_org_module_uniq ON organization_modules (organization_id, module_id);
CREATE INDEX IF NOT EXISTS organization_modules_org_idx ON organization_modules (organization_id);
CREATE INDEX IF NOT EXISTS organization_modules_module_idx ON organization_modules (module_id);
CREATE INDEX IF NOT EXISTS organization_modules_status_idx ON organization_modules (status);

-- ── Organization feature toggles ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_module_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES module_features(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  value jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS org_mod_features_org_module_feat_uniq ON organization_module_features (organization_id, module_id, feature_id);
CREATE INDEX IF NOT EXISTS org_mod_features_module_idx ON organization_module_features (module_id);

-- ── Organization settings overrides ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_module_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  key varchar(80) NOT NULL,
  value jsonb NOT NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS org_mod_settings_org_module_key_uniq ON organization_module_settings (organization_id, module_id, key);
CREATE INDEX IF NOT EXISTS org_mod_settings_module_idx ON organization_module_settings (module_id);

-- ── Organization permission grants ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  role varchar(40) NOT NULL,
  action varchar(30) NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS org_mod_perms_org_module_role_act_uniq ON organization_module_permissions (organization_id, module_id, role, action);
CREATE INDEX IF NOT EXISTS org_mod_perms_module_idx ON organization_module_permissions (module_id);

-- ── License history ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_license_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  license_id uuid REFERENCES module_licenses(id) ON DELETE SET NULL,
  plan varchar(60),
  action varchar(30) NOT NULL,
  start_date timestamp,
  expiry_date timestamp,
  amount numeric(14,2),
  details text,
  created_by uuid,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mod_license_history_org_idx ON module_license_history (organization_id);
CREATE INDEX IF NOT EXISTS mod_license_history_module_idx ON module_license_history (module_id);

-- ── Marketplace ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_marketplace (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL UNIQUE REFERENCES modules(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'Draft',
  price numeric(14,2) DEFAULT '0',
  pricing jsonb,
  screenshots jsonb,
  docs_url varchar(300),
  rating numeric(3,2) DEFAULT '0',
  review_count integer NOT NULL DEFAULT 0,
  reviews jsonb,
  developer_profile jsonb,
  compatibility jsonb,
  featured boolean NOT NULL DEFAULT false,
  published_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS module_marketplace_status_idx ON module_marketplace (status);

-- ── Usage analytics ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  date date NOT NULL,
  dau integer NOT NULL DEFAULT 0,
  mau integer NOT NULL DEFAULT 0,
  transactions integer NOT NULL DEFAULT 0,
  api_calls integer NOT NULL DEFAULT 0,
  storage_bytes bigint NOT NULL DEFAULT 0,
  avg_response_ms integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS module_usage_org_module_date_uniq ON module_usage_logs (organization_id, module_id, date);
CREATE INDEX IF NOT EXISTS module_usage_module_date_idx ON module_usage_logs (module_id, date);
CREATE INDEX IF NOT EXISTS module_usage_org_idx ON module_usage_logs (organization_id);

-- ── Installation logs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_installation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  action varchar(30) NOT NULL,
  version varchar(20),
  status varchar(20) NOT NULL DEFAULT 'Completed',
  details text,
  created_by uuid,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mod_install_logs_module_idx ON module_installation_logs (module_id);
CREATE INDEX IF NOT EXISTS mod_install_logs_org_idx ON module_installation_logs (organization_id);

-- ── Audit logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid REFERENCES modules(id) ON DELETE CASCADE,
  feature_id uuid REFERENCES module_features(id) ON DELETE SET NULL,
  action module_audit_action NOT NULL,
  old_value jsonb,
  new_value jsonb,
  ip_address varchar(45),
  user_agent text,
  created_by uuid,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS module_audit_module_idx ON module_audit_logs (module_id);
CREATE INDEX IF NOT EXISTS module_audit_org_idx ON module_audit_logs (organization_id);
CREATE INDEX IF NOT EXISTS module_audit_created_idx ON module_audit_logs (created_at);

-- ── Templates (bundles) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  description text,
  category varchar(50),
  icon varchar(50) DEFAULT 'Layers',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS module_templates_active_idx ON module_templates (is_active);

CREATE TABLE IF NOT EXISTS module_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES module_templates(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  license_id uuid REFERENCES module_licenses(id) ON DELETE SET NULL,
  config jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS module_template_items_tpl_module_uniq ON module_template_items (template_id, module_id);
CREATE INDEX IF NOT EXISTS module_template_items_template_idx ON module_template_items (template_id);

-- ── Notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  type varchar(30) NOT NULL,
  title varchar(150) NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS module_notifications_module_idx ON module_notifications (module_id);
CREATE INDEX IF NOT EXISTS module_notifications_read_idx ON module_notifications (read);

-- ── Health checks ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  status module_health_status NOT NULL DEFAULT 'Unknown',
  response_ms integer,
  uptime numeric(5,2) DEFAULT '100',
  details jsonb,
  checked_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS module_health_module_idx ON module_health_checks (module_id);

-- ── AI recommendations ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  reason text NOT NULL,
  priority integer DEFAULT 50,
  score numeric(4,2),
  status varchar(20) NOT NULL DEFAULT 'Suggested',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS module_recommendations_org_idx ON module_recommendations (organization_id);
CREATE INDEX IF NOT EXISTS module_recommendations_module_idx ON module_recommendations (module_id);
