-- =============================================
-- Staff-first ERP login model
-- Staff/Employee is the master record. User accounts
-- (auth.users + org_users) are optional 0..1 per staff,
-- created ONLY when Enable ERP Login = Yes on the staff form.
-- =============================================

-- 1. Flag on employees: whether the staff record has (or may get) an ERP account.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS enable_erp_login boolean NOT NULL DEFAULT false;

-- 2. org_users: branch + data scope captured when a staff record is promoted to ERP.
ALTER TABLE org_users
  ADD COLUMN IF NOT EXISTS branch_id uuid,
  ADD COLUMN IF NOT EXISTS data_scope varchar(30) DEFAULT 'own',
  ADD COLUMN IF NOT EXISTS last_login_at timestamp,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamp;

-- 3. Backfill: any existing org_user linked to an employee already implies ERP login enabled.
UPDATE employees e
SET enable_erp_login = true
WHERE EXISTS (
  SELECT 1 FROM org_users u WHERE u.employee_id = e.id
);

-- 4. Index for the staff-list join (organization + branch + code).
CREATE INDEX IF NOT EXISTS employees_org_idx ON employees (organization_id);
CREATE INDEX IF NOT EXISTS employees_branch_idx ON employees (branch_id);
CREATE INDEX IF NOT EXISTS employees_code_idx ON employees (employee_code);
CREATE INDEX IF NOT EXISTS org_users_employee_idx ON org_users (employee_id);
