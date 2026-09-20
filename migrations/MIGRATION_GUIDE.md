# Schema Audit Fixes - Migration Guide

## Overview
This migration package addresses critical schema inconsistencies found during the 40-file audit.

## Migration Files

### 1. `001_add_organization_id_to_missing_tables.sql` (CRITICAL)
**Purpose:** Fixes multi-tenancy for 6 tables missing `organizationId`

**Tables affected:**
- `member_family`
- `member_portal_settings`
- `member_biometrics`
- `member_documents`
- `document_template_versions`
- `legal_template_versions`
- `designations`

**What it does:**
- Adds `organization_id` column
- Backfills from related tables (e.g., `members`, `document_templates`)
- Sets NOT NULL constraint
- Adds foreign key to `organizations(id)`
- Creates index for performance

**Risk:** Low - adds new columns, doesn't modify existing data structure

---

### 2. `002_fix_audit_deletion_logs_fk.sql` (CRITICAL)
**Purpose:** Prevents destroying audit trail when deleting organization

**Problem:** `audit_deletion_logs` had `ON DELETE CASCADE` for `organizationId`
- Deleting an org would destroy its hard-delete audit trail
- Violates compliance requirements

**Fix:** Changes to `ON DELETE RESTRICT`
- Blocks org deletion if audit logs exist
- Forces proper cleanup/archival before deletion

**Risk:** Low - only changes constraint behavior

---

### 3. `003_add_org_users_unique_constraint.sql` (HIGH)
**Purpose:** Enforces "unique per org" for `org_users` as documented

**Problem:** No DB constraint on `(organization_id, username)` despite documentation saying "Unique per org"

**What it does:**
1. Finds and reports duplicate `(org, username)` combinations
2. Removes duplicates (keeps most recent by id)
3. Adds unique constraint on `(organization_id, username)`
4. Adds unique constraint on `(organization_id, employee_id)` where not null

**Risk:** Medium - removes duplicate rows (backup recommended)

---

### 4. `004_add_updated_at_to_mutable_tables.sql` (HIGH)
**Purpose:** Enables proper change tracking for 50+ tables

**Tables affected (4 batches):**
- **Batch 1:** Accounting (12 tables)
- **Batch 2:** Governance (25 tables)
- **Batch 3:** Inventory (7 tables)
- **Batch 4:** Other (14 tables)

**What it does:**
- Adds `updated_at` timestamp column
- Backfills with `created_at` value for existing rows
- Sets nullable (allows null for insert-only tables)

**Risk:** Low - adds new nullable columns

---

### 5. `005_standardize_created_by_updated_by.sql` (MEDIUM)
**Purpose:** Converts text-based `createdBy`/`updatedBy` to uuid with FK

**Tables affected:**
- `members`, `savings_products`, `loan_products`, `dividends`
- Plus 60+ other tables (see comments for full list)

**What it does:**
1. Adds new uuid columns (`created_by_uuid`, `updated_by_uuid`)
2. Backfills from text columns via `org_users` mapping
3. Drops old text columns
4. Renames new columns to original names
5. Adds FK constraints

**Risk:** HIGH - destructive migration (drops columns)
**Prerequisite:** Backup data first!

---

### 6. `006_standardize_enum_casing.sql` (MEDIUM)
**Purpose:** Standardizes enum values to PascalCase

**Tables affected:**
- `bank_reconciliation` (status, reconciliation_type)
- `cash_variance_log` (variance_type)
- `bank_reconciliation_items` (outstanding_type, status)
- `fees` (fee_type, calculation_type, status)
- `feeWaivers` (status)
- `pendingBalance` (status)
- `loan_LIMIT` (status, priority)
- `agreements` (status, category)
- `circulars` (status)

**What it does:**
- Converts snake_case → PascalCase (e.g., `cash_short` → `CashShort`)
- Converts lowercase → PascalCase (e.g., `active` → `Active`)
- Converts `in_progress` → `InProgress`

**Risk:** Low - only updates existing values

---

## Execution Order

1. **Backup your database** (especially before migration 5)
2. Run migrations in order: 001 → 002 → 003 → 004 → 005 → 006
3. After migration 5, update Drizzle schema to use uuid type for `createdBy`/`updatedBy`
4. After migration 6, update Drizzle enum definitions to use PascalCase

## Post-Migration Tasks

### Update Drizzle Schema
After running migrations, update your schema files:

```typescript
// Example: members table
export const members = pgTable('members', {
  // ... other columns
  createdBy: uuid('created_by').references(() => orgUsers.id),
  updatedAt: timestamp('updated_at'),
  // ... rest of columns
});
```

### Update Application Code
- Ensure all enum comparisons use PascalCase
- Verify any code that parses `createdBy`/`updatedBy` handles uuid type

## Verification Queries

After running migrations, verify:

```sql
-- Check organization_id was added
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'member_family' AND column_name = 'organization_id';

-- Check unique constraint
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'org_users' AND constraint_type = 'UNIQUE';

-- Check updated_at columns
SELECT table_name FROM information_schema.columns 
WHERE column_name = 'updated_at' AND table_schema = 'public';

-- Check enum values
SELECT DISTINCT status FROM bank_reconciliation;
SELECT DISTINCT fee_type FROM fees;
```

## Rollback

If needed, rollback scripts can be generated from the forward migrations. Key rollback steps:
- Drop added columns
- Restore original constraint definitions
- Re-insert deleted duplicate rows (from backup)

## Notes

- All migrations are idempotent (safe to run multiple times)
- Uses `IF NOT EXISTS` where possible
- Backfills are designed to preserve existing data
- Some migrations are destructive (migration 5) - backup required