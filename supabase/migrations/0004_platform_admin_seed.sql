-- Seed default "Platform Administrator" system role with full access.
-- Super admins already bypass platform-role enforcement (requireRole(['super_admin']));
-- this row makes the Roles & Access page populated and reflects their capabilities.

INSERT INTO platform_roles (code, name, name_nepali, description, permissions, is_system, status, sort_order)
SELECT 'PLT_ADMIN',
       'Platform Administrator',
       'प्लेटफर्म प्रशासक',
       'Full access to every platform module and action',
       '["dashboard","members","savings","loans","accounting","shares","inventory","hr","reports","admin","settings","audit"]',
       true,
       'Active',
       1
WHERE NOT EXISTS (SELECT 1 FROM platform_roles WHERE name = 'Platform Administrator' AND deleted_at IS NULL);

INSERT INTO platform_role_permissions (role_id, category, key, action, granted)
SELECT r.id, c.category, c.key, a.action, true
FROM platform_roles r
CROSS JOIN (VALUES
  ('dashboard', 'Dashboard'),
  ('members', 'Members'),
  ('savings', 'Savings'),
  ('loans', 'Loans'),
  ('accounting', 'Accounting'),
  ('shares', 'Shares'),
  ('inventory', 'Inventory'),
  ('hr', 'HR'),
  ('reports', 'Reports'),
  ('admin', 'Admin'),
  ('settings', 'Settings'),
  ('audit', 'Audit')
) AS c(key, category)
CROSS JOIN (VALUES
  ('view'), ('create'), ('edit'), ('delete'), ('approve'), ('export'), ('print'), ('assign')
) AS a(action)
WHERE r.code = 'PLT_ADMIN' AND r.deleted_at IS NULL
ON CONFLICT (role_id, key, action) DO NOTHING;

INSERT INTO platform_role_data_scopes (role_id, scope, actions)
SELECT id, 'all', '{"view":true,"create":true,"edit":true,"delete":true,"approve":true,"export":true}'
FROM platform_roles
WHERE code = 'PLT_ADMIN' AND deleted_at IS NULL
ON CONFLICT (role_id) DO NOTHING;
