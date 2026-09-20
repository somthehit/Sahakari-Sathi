-- Migration: Standardize createdBy/updatedBy to uuid with FK
-- Priority: MEDIUM - Ensures referential integrity for audit fields

-- This migration converts text-based createdBy/updatedBy to uuid type
-- and adds foreign key references to org_users.id

-- WARNING: This is a destructive migration for text columns!
-- Backup your data first.

-- Step 1: Add new uuid columns (temporary)
-- accounting.ts tables
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "savings_products" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "savings_products" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "loan_products" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "loan_products" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "dividends" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "dividends" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- Step 2: Backfill from text columns (if they contain UUIDs)
-- Note: If text columns contain usernames, you'll need a mapping table

-- For members.createdBy (text -> uuid)
UPDATE "members" 
SET "created_by_uuid" = ou."id"::uuid
FROM "org_users" ou
WHERE "members"."created_by" = ou."username"
  AND "members"."created_by" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- For members.updatedBy
UPDATE "members"
SET "updated_by_uuid" = ou."id"::uuid
FROM "org_users" ou
WHERE "members"."updated_by" = ou."username"
  AND "members"."updated_by" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Repeat for other tables...
-- savings_products
UPDATE "savings_products"
SET "created_by_uuid" = ou."id"::uuid
FROM "org_users" ou
WHERE "savings_products"."created_by" = ou."username"
  AND "savings_products"."created_by" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "savings_products"
SET "updated_by_uuid" = ou."id"::uuid
FROM "org_users" ou
WHERE "savings_products"."updated_by" = ou."username"
  AND "savings_products"."updated_by" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- loan_products
UPDATE "loan_products"
SET "created_by_uuid" = ou."id"::uuid
FROM "org_users" ou
WHERE "loan_products"."created_by" = ou."username"
  AND "loan_products"."created_by" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "loan_products"
SET "updated_by_uuid" = ou."id"::uuid
FROM "org_users" ou
WHERE "loan_products"."updated_by" = ou."username"
  AND "loan_products"."updated_by" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- dividends
UPDATE "dividends"
SET "created_by_uuid" = ou."id"::uuid
FROM "org_users" ou
WHERE "dividends"."created_by" = ou."username"
  AND "dividends"."created_by" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "dividends"
SET "updated_by_uuid" = ou."id"::uuid
FROM "org_users" ou
WHERE "dividends"."updated_by" = ou."username"
  AND "dividends"."updated_by" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Step 3: Drop old text columns and rename new ones
-- NOTE: Run this only after confirming backfill is complete

-- accounting.ts
ALTER TABLE "members" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "members" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "members" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "members" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "savings_products" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "savings_products" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "savings_products" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "savings_products" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "loan_products" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "loan_products" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "loan_products" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "loan_products" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "dividends" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "dividends" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "dividends" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "dividends" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- Step 4: Add FK constraints
ALTER TABLE "members"
ADD CONSTRAINT "members_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "members"
ADD CONSTRAINT "members_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "savings_products"
ADD CONSTRAINT "savings_products_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "savings_products"
ADD CONSTRAINT "savings_products_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_products"
ADD CONSTRAINT "loan_products_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_products"
ADD CONSTRAINT "loan_products_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "dividends"
ADD CONSTRAINT "dividends_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "dividends"
ADD CONSTRAINT "dividends_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- Note: Repeat this pattern for all other tables with text-based createdBy/updatedBy
-- Tables to migrate:
-- - auditEngine.ts: audit_trail, audit_events, audit_config, risk_assessments, control_objectives, control_testing
-- - workflow.ts: workflow_definitions, workflow_transitions
-- - governance.ts: agm_meetings, agm_notices, agm_notice_versions, agm_agendas, agm_minutes, agm_resolutions, agm_polls, agm_votes, agm_proxies, agm_attendees, agm_committee_members, agm_election_nominations, board_members, board_committees, board_committee_members, board_meetings, board_meeting_attendees, board_resolutions, board_committee_resolutions, board_election_nominations, share_certificates, share_transfer_requests
-- - reporting.ts: report_schedules, report_delivery_logs, report_instances, data_sources, report_bookmarks
-- - passbook.ts: passbook_books, passbook_entries, passbook_templates, passbookDesign, chequeBooks, chequeLeaves, chequeBounces, chequeDesigns
-- - requisitionAndApproval.ts: requisitions, workflow_state_history, approval_requests, approval_audit_trail, approval_delegations, approval_templates, approval_notification_rules
-- - share.ts: shares, share_transactions
-- - Audit.ts: audit_trail, audit_events, audit_config, risk_assessments, control_objectives, control_testing
-- - collections.ts: collection_transactions
-- - loans.ts: loans, loan_schedules, loan_repayments, loan_disbursements, loan_write_offs, loan_reschedules, loan_collateral, loan_guarantors
-- - legal.ts: legal_cases, legal_case_events, legal_documents, legal_template_versions
-- - syncEngine.ts: sync_config, sync_metadata, sync_conflict_log, sync_sessions
-- - settings.ts: organization_settings, system_settings
-- - documents.ts: document_categories, document_templates, document_template_versions
-- - cashFlow.ts: cash_flow_categories
-- - loansCollateralGuarantor.ts: loan_COLLATERAL_TYPES, loan_GUARANTOR_TYPES, loan_COLLATERAL_STATUS
-- - advanceLedger.ts: advance_sub_types
-- - cash.ts: cash_transactions
-- - bank.ts: bank_reconciliation, bank_reconciliation_items, bank_reconciliation_audit, bank_reconciliation_history, cash_variance_log, reconciliation_working_paper, bank_account_opening_balance, bank_account_opening_balance_audit
-- - fees.ts: fees, feeWaivers
-- - pendingBalance.ts: pendingBalance
-- - loanLimit.ts: loan_LIMIT
-- - agreements.ts: agreements
-- - circulars.ts: circulars
-- - collection_sheet.ts: collection_sheets
-- - collectionAgents.ts: collection_agents
-- - marketing.ts: campaigns, campaign_messages, campaign_templates, campaign_delivery_logs, referral_programs, referral_rewards
-- - accountingDoubleEntry*.ts: accountingDoubleEntryBusinessPolicies, accountingDoubleEntryDataMapping, accountingDoubleEntryChartOfAccountOpeningBalance, accountingDoubleEntryPostingRules, accountingDoubleEntryBankAccountOpeningBalance
-- - memberDocuments.ts: member_documents
-- - od.ts: overdrafts, overdraft_transactions, overdraft_limits, overdraft_interest_config, overdraft_breach_log, overdraft_repayment_schedules, overdraftAnnualInterestChangeLog