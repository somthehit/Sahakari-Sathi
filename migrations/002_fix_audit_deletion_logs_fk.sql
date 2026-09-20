-- Migration: Fix audit_deletion_logs FK constraint
-- Priority: CRITICAL - Prevents destroying audit trail when deleting organization

-- Currently: audit_deletion_logs has ON DELETE CASCADE for organizationId
-- This means deleting an org destroys its hard-delete audit trail - terrible for compliance

-- Fix: Change to RESTRICT so org deletion is blocked if audit logs exist
-- This forces proper cleanup/archival before org deletion

-- First, drop the existing foreign key
ALTER TABLE "audit_deletion_logs"
DROP CONSTRAINT IF EXISTS "audit_deletion_logs_organization_id_organizations_id_fk";

-- Re-create with RESTRICT instead of CASCADE
ALTER TABLE "audit_deletion_logs"
ADD CONSTRAINT "audit_deletion_logs_organization_id_organizations_id_fk"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;

-- Note: If you need to delete an organization, you must first:
-- 1. Export/preserve audit logs for compliance
-- 2. Then delete the org (or use a special admin override with transaction)