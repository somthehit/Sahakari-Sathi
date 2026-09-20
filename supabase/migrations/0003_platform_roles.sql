-- Platform Roles (super-admin level, no org)
-- Mirrors tenant roles/role_permissions/role_data_scopes so platform-wide
-- access control can be managed from the Roles & Access page.

CREATE TABLE IF NOT EXISTS platform_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(20),
  name varchar(100) NOT NULL,
  name_nepali varchar(100),
  description text,
  permissions text NOT NULL DEFAULT '[]',
  is_system boolean NOT NULL DEFAULT false,
  status varchar(20) NOT NULL DEFAULT 'Active',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_roles_code_uniq ON platform_roles (code);
CREATE UNIQUE INDEX IF NOT EXISTS platform_roles_name_uniq ON platform_roles (name);
CREATE INDEX IF NOT EXISTS platform_roles_status_idx ON platform_roles (status);

CREATE TABLE IF NOT EXISTS platform_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES platform_roles(id) ON DELETE CASCADE,
  category varchar(50) NOT NULL,
  key varchar(100) NOT NULL,
  action varchar(30) NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS plat_role_perm_role_key_action_uniq ON platform_role_permissions (role_id, key, action);
CREATE INDEX IF NOT EXISTS plat_role_perm_role_idx ON platform_role_permissions (role_id);

CREATE TABLE IF NOT EXISTS platform_role_data_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES platform_roles(id) ON DELETE CASCADE,
  scope varchar(20) NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'branch', 'self')),
  actions jsonb NOT NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS plat_role_data_scope_role_uniq ON platform_role_data_scopes (role_id);
