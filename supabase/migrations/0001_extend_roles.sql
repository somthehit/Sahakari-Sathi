ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS code varchar(20),
  ADD COLUMN IF NOT EXISTS name_nepali varchar(100),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp,
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;

ALTER TABLE roles ALTER COLUMN name TYPE varchar(100);

CREATE UNIQUE INDEX IF NOT EXISTS roles_org_code_uniq ON roles (organization_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS roles_org_name_uniq ON roles (organization_id, name);
CREATE INDEX IF NOT EXISTS roles_org_status_idx ON roles (organization_id, status);

CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  category varchar(50) NOT NULL,
  key varchar(100) NOT NULL,
  action varchar(30) NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS role_perm_role_key_action_uniq ON role_permissions (role_id, key, action);
CREATE INDEX IF NOT EXISTS role_perm_org_idx ON role_permissions (organization_id);
CREATE INDEX IF NOT EXISTS role_perm_role_idx ON role_permissions (role_id);
