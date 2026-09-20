-- Migration: Add unique constraint to org_users (organizationId, username)
-- Priority: HIGH - Enforces "unique per org" as documented

-- Currently: org_users table has no unique constraint on (organization_id, username)
-- The comment says "Unique per org" but DB doesn't enforce it

-- First, check for and remove any duplicate (org, username) combinations
-- This is a destructive operation - backup first!

-- Find duplicates
WITH duplicates AS (
  SELECT 
    "organization_id",
    "username",
    COUNT(*) as cnt
  FROM "org_users"
  GROUP BY "organization_id", "username"
  HAVING COUNT(*) > 1
)
SELECT * FROM duplicates;

-- If duplicates exist, decide which to keep (most recent? by id?)
-- Example: keep the most recent one
DELETE FROM "org_users" ou1
USING "org_users" ou2
WHERE ou1."organization_id" = ou2."organization_id"
  AND ou1."username" = ou2."username"
  AND ou1."id" < ou2."id";  -- Keep the newer one (assuming id increases)

-- Now add the unique constraint
ALTER TABLE "org_users"
ADD CONSTRAINT "org_users_organization_username_unique"
UNIQUE ("organization_id", "username");

-- Also add unique constraint for (org, employee_id) where employee_id is not null
-- This prevents duplicate employee assignments per org
ALTER TABLE "org_users"
ADD CONSTRAINT "org_users_organization_employee_unique"
UNIQUE ("organization_id", "employee_id")
WHERE "employee_id" IS NOT NULL;