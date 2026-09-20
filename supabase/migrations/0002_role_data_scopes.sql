-- Role Data Scope
-- One row per role controlling record-level access.
-- scope:  'all'    - every record across branches/users
--         'branch' - only the user's assigned branch
--         'self'   - only records the user created
-- actions: JSON object of generic capability toggles (view/create/edit/
--          delete/approve/export) applied within the scope.

CREATE TABLE IF NOT EXISTS role_data_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  scope varchar(20) NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'branch', 'self')),
  actions jsonb NOT NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS role_data_scope_role_uniq ON role_data_scopes (role_id);
CREATE INDEX IF NOT EXISTS role_data_scope_org_idx ON role_data_scopes (organization_id);
