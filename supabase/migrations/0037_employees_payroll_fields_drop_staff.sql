-- Migration: 0037_employees_payroll_fields_drop_staff.sql
-- Migrates the legacy `staff` table payroll fields onto `employees` and drops
-- the duplicate `staff` table. All staff consumers now read from `employees`
-- (see StaffRepository/StaffService), so the legacy table is no longer needed.

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "basic_salary" numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "allowances" numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pf_contribution_percent" numeric(5, 2) NOT NULL DEFAULT 10;

-- Backfill existing employees from the legacy staff rows (matched by email).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff') THEN
    UPDATE "employees" AS e
    SET
      "basic_salary" = s.basic_salary,
      "allowances" = s.allowances,
      "pf_contribution_percent" = s.pf_contribution_percent
    FROM "staff" AS s
    WHERE s.email = e.email;
  END IF;
END
$$;

DROP TABLE IF EXISTS "staff";
