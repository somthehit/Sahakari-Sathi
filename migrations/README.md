# Schema Audit Fixes - Complete Migration Package

## Overview
This package addresses all critical schema inconsistencies found during the 40-file audit across 150+ tables.

## Migration Files

### CRITICAL Priority (Run First)

#### 1. `001_add_organization_id_to_missing_tables.sql`
**Purpose:** Fixes multi-tenancy for 7 tables missing `organizationId`

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
- Backfills from related tables
- Sets NOT NULL constraint
- Adds foreign key to `organizations(id)`
- Creates index for performance

**Risk:** Low

---

#### 2. `002_fix_audit_deletion_logs_fk.sql`
**Purpose:** Prevents destroying audit trail when deleting organization

**Problem:** `audit_deletion_logs` had `ON DELETE CASCADE` for `organizationId`

**Fix:** Changes to `ON DELETE RESTRICT`

**Risk:** Low

---

#### 3. `003_add_org_users_unique_constraint.sql`
**Purpose:** Enforces "unique per org" for `org_users` as documented

**What it does:**
1. Finds and reports duplicate `(org, username)` combinations
2. Removes duplicates (keeps most recent by id)
3. Adds unique constraint on `(organization_id, username)`
4. Adds unique constraint on `(organization_id, employee_id)` where not null

**Risk:** Medium - removes duplicate rows (backup recommended)

---

### HIGH Priority (Run After Critical)

#### 4. `004_add_updated_at_to_mutable_tables.sql`
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

**Risk:** Low

---

#### 5. `007_add_missing_unique_constraints.sql`
**Purpose:** Enforces business rules at DB level

**What it does:**
- Adds 41 unique constraints for:
  - Organization-scoped codes (products, templates, accounts, etc.)
  - Composite keys (org + employee, org + citizenship, etc.)
  - Business rules (cheque ranges, reconciliation periods, etc.)

**Risk:** Low

---

### MEDIUM Priority (Run After High)

#### 6. `008_add_check_constraints.sql`
**Purpose:** Enforces data integrity at DB level

**What it does:**
- Adds 100 CHECK constraints for:
  - Percentage ranges (0-100)
  - Amount validations (>= 0, > 0)
  - Date validations (past dates, future dates)
  - Logical constraints (debit = credit, amounts paid <= due)
  - Business rules (nominee shares 0-100, leaf ranges)

**Risk:** Low

---

#### 7. `006_standardize_enum_casing.sql`
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

**Risk:** Low

---

#### 8. `005_standardize_created_by_updated_by.sql` (PARTIAL)
**Purpose:** Converts text-based `createdBy`/`updatedBy` to uuid with FK

**Note:** This is a partial migration - see `009_complete_created_by_updated_by.sql` for complete version

---

#### 9. `009_complete_created_by_updated_by.sql`
**Purpose:** Complete createdBy/updatedBy migration for ALL tables

**What it does:**
1. Adds new uuid columns (`created_by_uuid`, `updated_by_uuid`)
2. Backfills from text columns via `org_users` mapping
3. Drops old text columns
4. Renames new columns to original names
5. Adds FK constraints

**Risk:** HIGH - destructive migration (drops columns)

**Prerequisite:** Backup data first!

---

## Execution Order

### Phase 1: Critical (Run Immediately)
```bash
# 1. Add organizationId to missing tables
psql -d your_database -f migrations/001_add_organization_id_to_missing_tables.sql

# 2. Fix audit_deletion_logs FK
psql -d your_database -f migrations/002_fix_audit_deletion_logs_fk.sql

# 3. Add org_users unique constraint
psql -d your_database -f migrations/003_add_org_users_unique_constraint.sql
```

### Phase 2: High Priority (Run After Phase 1)
```bash
# 4. Add updated_at to mutable tables
psql -d your_database -f migrations/004_add_updated_at_to_mutable_tables.sql

# 5. Add missing unique constraints
psql -d your_database -f migrations/007_add_missing_unique_constraints.sql
```

### Phase 3: Medium Priority (Run After Phase 2)
```bash
# 6. Add CHECK constraints
psql -d your_database -f migrations/008_add_check_constraints.sql

# 7. Standardize enum casing
psql -d your_database -f migrations/006_standardize_enum_casing.sql

# 8. Complete createdBy/updatedBy migration (DESTRUCTIVE - backup first!)
psql -d your_database -f migrations/009_complete_created_by_updated_by.sql
```

---

## Pre-Migration Checklist

- [ ] Backup database
- [ ] Review migration files
- [ ] Test in development environment
- [ ] Verify no duplicate data issues
- [ ] Plan rollback strategy

---

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
- Verify any code that parses `createdBy`/`updated_by` handles uuid type
- Update any queries that reference dropped columns

---

## Verification Queries

After running migrations, verify:

```sql
-- Check organization_id was added
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'member_family' AND column_name = 'organization_id';

-- Check unique constraints
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'org_users' AND constraint_type = 'UNIQUE';

-- Check updated_at columns
SELECT table_name FROM information_schema.columns 
WHERE column_name = 'updated_at' AND table_schema = 'public';

-- Check CHECK constraints
SELECT conname, contype FROM pg_constraint 
WHERE contype = 'c' AND conrelid = (
  SELECT oid FROM pg_class WHERE relname = 'member_family'
);

-- Check enum values
SELECT DISTINCT status FROM bank_reconciliation;
SELECT DISTINCT fee_type FROM fees;

-- Check createdBy/updatedBy type
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'members' AND column_name IN ('created_by', 'updated_by');
```

---

## Rollback Strategy

### Phase 1 Rollback
```sql
-- Remove organization_id columns
ALTER TABLE "member_family" DROP COLUMN IF EXISTS "organization_id";
ALTER TABLE "member_portal_settings" DROP COLUMN IF EXISTS "organization_id";
ALTER TABLE "member_biometrics" DROP COLUMN IF EXISTS "organization_id";
ALTER TABLE "member_documents" DROP COLUMN IF EXISTS "organization_id";
ALTER TABLE "document_template_versions" DROP COLUMN IF EXISTS "organization_id";
ALTER TABLE "legal_template_versions" DROP COLUMN IF EXISTS "organization_id";
ALTER TABLE "designations" DROP COLUMN IF EXISTS "organization_id";

-- Revert audit_deletion_logs FK
ALTER TABLE "audit_deletion_logs" DROP CONSTRAINT IF EXISTS "audit_deletion_logs_organization_id_organizations_id_fk";
ALTER TABLE "audit_deletion_logs" ADD CONSTRAINT "audit_deletion_logs_organization_id_organizations_id_fk"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

-- Remove unique constraints
ALTER TABLE "org_users" DROP CONSTRAINT IF EXISTS "org_users_organization_username_unique";
ALTER TABLE "org_users" DROP CONSTRAINT IF EXISTS "org_users_organization_employee_unique";
```

### Phase 2 Rollback
```sql
-- Remove updated_at columns
ALTER TABLE "account_groups" DROP COLUMN IF EXISTS "updated_at";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "updated_at";
-- ... (repeat for all tables)

-- Remove unique constraints
ALTER TABLE "member_kyc_profiles" DROP CONSTRAINT IF EXISTS "member_kyc_org_citizenship_unique";
ALTER TABLE "report_templates" DROP CONSTRAINT IF EXISTS "report_templates_org_code_unique";
-- ... (repeat for all constraints)
```

### Phase 3 Rollback
```sql
-- Remove CHECK constraints
ALTER TABLE "member_family" DROP CONSTRAINT IF EXISTS "member_family_nominee_share_pct_check";
ALTER TABLE "cheque_books" DROP CONSTRAINT IF EXISTS "cheque_books_leaf_range_check";
-- ... (repeat for all constraints)

-- Revert enum changes
UPDATE "bank_reconciliation" SET "status" = 'cash_short' WHERE "status" = 'CashShort';
UPDATE "bank_reconciliation" SET "status" = 'cash_over' WHERE "status" = 'CashOver';
-- ... (repeat for all enum values)

-- Restore createdBy/updatedBy columns (from backup)
-- This requires restoring from backup as columns are dropped
```

---

## Notes

- All migrations are idempotent (safe to run multiple times)
- Uses `IF NOT EXISTS` where possible
- Backfills are designed to preserve existing data
- Migration 9 is destructive - backup required
- Test in development environment first

## Files Created

```
migrations/
├── MIGRATION_GUIDE.md (this file)
├── 001_add_organization_id_to_missing_tables.sql
├── 002_fix_audit_deletion_logs_fk.sql
├── 003_add_org_users_unique_constraint.sql
├── 004_add_updated_at_to_mutable_tables.sql
├── 005_standardize_created_by_updated_by.sql (partial)
├── 006_standardize_enum_casing.sql
├── 007_add_missing_unique_constraints.sql
├── 008_add_check_constraints.sql
└── 009_complete_created_by_updated_by.sql
```