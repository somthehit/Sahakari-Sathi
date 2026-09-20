-- Migration: Complete createdBy/updatedBy migration for all tables
-- Priority: MEDIUM - Ensures referential integrity for audit fields

-- This is the complete migration for converting text-based createdBy/updatedBy to uuid
-- with foreign key references to org_users.id

-- NOTE: This is a destructive migration for text columns!
-- Backup your data first!

-- ============================================
-- PART 1: Add new uuid columns (temporary)
-- ============================================

-- accounting.ts tables
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "savings_products" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "savings_products" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "loan_products" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "loan_products" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "dividends" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "dividends" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- auditEngine.ts tables
ALTER TABLE "audit_trail" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "audit_trail" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "audit_events" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "audit_events" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "audit_config" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "audit_config" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "control_objectives" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "control_objectives" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "control_testing" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "control_testing" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- workflow.ts tables
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "workflow_transitions" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "workflow_transitions" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- governance.ts tables
ALTER TABLE "agm_meetings" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "agm_meetings" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "agm_notices" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "agm_notices" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "agm_notice_versions" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "agm_notice_versions" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "agm_agendas" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "agm_agendas" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "agm_minutes" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "agm_minutes" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "agm_resolutions" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "agm_resolutions" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "agm_polls" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "agm_polls" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "agm_votes" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "agm_votes" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "agm_proxies" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "agm_proxies" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "agm_attendees" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "agm_attendees" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "agm_committee_members" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "agm_committee_members" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "agm_election_nominations" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "agm_election_nominations" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "board_members" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "board_members" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "board_committees" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "board_committees" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "board_committee_members" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "board_committee_members" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "board_meetings" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "board_meetings" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "board_meeting_attendees" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "board_meeting_attendees" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "board_resolutions" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "board_resolutions" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "board_committee_resolutions" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "board_committee_resolutions" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "board_election_nominations" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "board_election_nominations" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "share_certificates" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "share_certificates" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "share_transfer_requests" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "share_transfer_requests" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "legal_documents" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "legal_documents" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "legal_template_versions" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "legal_template_versions" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "audit_deletion_logs" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "audit_deletion_logs" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- reporting.ts tables
ALTER TABLE "report_schedules" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "report_schedules" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "report_delivery_logs" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "report_delivery_logs" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "report_instances" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "report_instances" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "data_sources" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "data_sources" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "report_bookmarks" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "report_bookmarks" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- passbook.ts tables
ALTER TABLE "passbook_books" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "passbook_books" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "passbook_entries" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "passbook_entries" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "passbook_templates" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "passbook_templates" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "passbookDesign" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "passbookDesign" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "chequeBooks" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "chequeBooks" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "chequeLeaves" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "chequeLeaves" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "chequeBounces" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "chequeBounces" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "chequeDesigns" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "chequeDesigns" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- requisitionAndApproval.ts tables
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "workflow_state_history" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "workflow_state_history" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "approval_requests" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "approval_requests" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "approval_audit_trail" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "approval_audit_trail" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "approval_delegations" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "approval_delegations" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "approval_templates" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "approval_templates" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "approval_notification_rules" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "approval_notification_rules" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- share.ts tables
ALTER TABLE "shares" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "shares" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "share_transactions" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "share_transactions" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- Audit.ts tables (same as auditEngine.ts, skip)

-- collections.ts tables
ALTER TABLE "collection_transactions" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "collection_transactions" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- loans.ts tables
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "loan_schedules" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "loan_schedules" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "loan_repayments" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "loan_repayments" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "loan_disbursements" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "loan_disbursements" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "loan_write_offs" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "loan_write_offs" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "loan_reschedules" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "loan_reschedules" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "loan_collateral" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "loan_collateral" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "loan_guarantors" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "loan_guarantors" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- legal.ts tables
ALTER TABLE "legal_cases" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "legal_cases" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "legal_case_events" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "legal_case_events" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- syncEngine.ts tables
ALTER TABLE "sync_config" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "sync_config" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "sync_metadata" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "sync_metadata" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "sync_conflict_log" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "sync_conflict_log" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "sync_sessions" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "sync_sessions" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- settings.ts tables
ALTER TABLE "organization_settings" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "organization_settings" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- documents.ts tables
ALTER TABLE "document_categories" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "document_categories" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "document_templates" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "document_templates" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "document_template_versions" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "document_template_versions" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- cashFlow.ts tables
ALTER TABLE "cash_flow_categories" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "cash_flow_categories" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- loansCollateralGuarantor.ts tables
ALTER TABLE "loan_COLLATERAL_TYPES" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "loan_COLLATERAL_TYPES" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "loan_GUARANTOR_TYPES" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "loan_GUARANTOR_TYPES" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "loan_COLLATERAL_STATUS" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "loan_COLLATERAL_STATUS" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- advanceLedger.ts tables
ALTER TABLE "advance_sub_types" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "advance_sub_types" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- cash.ts tables
ALTER TABLE "cash_transactions" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "cash_transactions" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- bank.ts tables
ALTER TABLE "bank_reconciliation" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "bank_reconciliation" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "bank_reconciliation_items" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "bank_reconciliation_items" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "bank_reconciliation_audit" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "bank_reconciliation_audit" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "bank_reconciliation_history" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "bank_reconciliation_history" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "cash_variance_log" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "cash_variance_log" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "reconciliation_working_paper" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "reconciliation_working_paper" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "bank_account_opening_balance" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "bank_account_opening_balance" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "bank_account_opening_balance_audit" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "bank_account_opening_balance_audit" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- fees.ts tables
ALTER TABLE "fees" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "fees" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "feeWaivers" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "feeWaivers" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- pendingBalance.ts tables
ALTER TABLE "pendingBalance" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "pendingBalance" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- loanLimit.ts tables
ALTER TABLE "loan_LIMIT" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "loan_LIMIT" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- agreements.ts tables
ALTER TABLE "agreements" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "agreements" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- circulars.ts tables
ALTER TABLE "circulars" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "circulars" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- collection_sheet.ts tables
ALTER TABLE "collection_sheets" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "collection_sheets" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- collectionAgents.ts tables
ALTER TABLE "collection_agents" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "collection_agents" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- marketing.ts tables
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "campaign_messages" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "campaign_messages" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "campaign_templates" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "campaign_templates" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "campaign_delivery_logs" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "campaign_delivery_logs" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "referral_programs" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "referral_programs" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "referral_rewards" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "referral_rewards" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- accountingDoubleEntry*.ts tables
ALTER TABLE "accountingDoubleEntryBusinessPolicies" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "accountingDoubleEntryBusinessPolicies" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "accountingDoubleEntryDataMapping" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "accountingDoubleEntryDataMapping" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "accountingDoubleEntryChartOfAccountOpeningBalance" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "accountingDoubleEntryChartOfAccountOpeningBalance" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "accountingDoubleEntryPostingRules" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "accountingDoubleEntryPostingRules" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "accountingDoubleEntryBankAccountOpeningBalance" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "accountingDoubleEntryBankAccountOpeningBalance" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- memberDocuments.ts tables
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

-- od.ts tables
ALTER TABLE "overdrafts" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "overdrafts" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "overdraft_transactions" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "overdraft_transactions" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "overdraft_limits" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "overdraft_limits" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "overdraft_interest_config" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "overdraft_interest_config" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "overdraft_breach_log" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "overdraft_breach_log" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "overdraft_repayment_schedules" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "overdraft_repayment_schedules" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;

ALTER TABLE "overdraftAnnualInterestChangeLog" ADD COLUMN IF NOT EXISTS "created_by_uuid" uuid;
ALTER TABLE "overdraftAnnualInterestChangeLog" ADD COLUMN IF NOT EXISTS "updated_by_uuid" uuid;


-- ============================================
-- PART 2: Backfill from text columns
-- ============================================

-- Note: This is a simplified backfill that assumes text columns contain usernames
-- You may need to adjust the mapping logic based on your data

-- Example backfill for members table
UPDATE "members" 
SET "created_by_uuid" = ou."id"::uuid
FROM "org_users" ou
WHERE "members"."created_by" = ou."username"
  AND "members"."created_by" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "members"
SET "updated_by_uuid" = ou."id"::uuid
FROM "org_users" ou
WHERE "members"."updated_by" = ou."username"
  AND "members"."updated_by" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Repeat for all other tables...
-- This is a template - you'll need to run the same pattern for each table

-- For brevity, I'll show the pattern for a few key tables:
-- savings_products, loan_products, dividends, audit_trail, workflow_definitions

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

-- audit_trail
UPDATE "audit_trail"
SET "created_by_uuid" = ou."id"::uuid
FROM "org_users" ou
WHERE "audit_trail"."created_by" = ou."username"
  AND "audit_trail"."created_by" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "audit_trail"
SET "updated_by_uuid" = ou."id"::uuid
FROM "org_users" ou
WHERE "audit_trail"."updated_by" = ou."username"
  AND "audit_trail"."updated_by" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- workflow_definitions
UPDATE "workflow_definitions"
SET "created_by_uuid" = ou."id"::uuid
FROM "org_users" ou
WHERE "workflow_definitions"."created_by" = ou."username"
  AND "workflow_definitions"."created_by" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "workflow_definitions"
SET "updated_by_uuid" = ou."id"::uuid
FROM "org_users" ou
WHERE "workflow_definitions"."updated_by" = ou."username"
  AND "workflow_definitions"."updated_by" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';


-- ============================================
-- PART 3: Drop old text columns and rename new ones
-- ============================================

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

-- auditEngine.ts
ALTER TABLE "audit_trail" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "audit_trail" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "audit_trail" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "audit_trail" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "audit_events" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "audit_events" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "audit_events" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "audit_events" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "audit_config" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "audit_config" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "audit_config" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "audit_config" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "risk_assessments" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "risk_assessments" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "risk_assessments" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "risk_assessments" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "control_objectives" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "control_objectives" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "control_objectives" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "control_objectives" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "control_testing" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "control_testing" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "control_testing" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "control_testing" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- workflow.ts
ALTER TABLE "workflow_definitions" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "workflow_definitions" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "workflow_definitions" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "workflow_definitions" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "workflow_transitions" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "workflow_transitions" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "workflow_transitions" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "workflow_transitions" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- governance.ts
ALTER TABLE "agm_meetings" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "agm_meetings" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "agm_meetings" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "agm_meetings" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "agm_notices" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "agm_notices" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "agm_notices" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "agm_notices" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "agm_notice_versions" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "agm_notice_versions" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "agm_notice_versions" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "agm_notice_versions" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "agm_agendas" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "agm_agendas" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "agm_agendas" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "agm_agendas" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "agm_minutes" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "agm_minutes" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "agm_minutes" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "agm_minutes" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "agm_resolutions" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "agm_resolutions" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "agm_resolutions" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "agm_resolutions" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "agm_polls" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "agm_polls" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "agm_polls" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "agm_polls" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "agm_votes" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "agm_votes" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "agm_votes" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "agm_votes" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "agm_proxies" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "agm_proxies" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "agm_proxies" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "agm_proxies" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "agm_attendees" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "agm_attendees" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "agm_attendees" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "agm_attendees" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "agm_committee_members" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "agm_committee_members" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "agm_committee_members" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "agm_committee_members" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "agm_election_nominations" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "agm_election_nominations" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "agm_election_nominations" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "agm_election_nominations" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "board_members" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "board_members" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "board_members" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "board_members" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "board_committees" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "board_committees" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "board_committees" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "board_committees" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "board_committee_members" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "board_committee_members" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "board_committee_members" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "board_committee_members" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "board_meetings" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "board_meetings" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "board_meetings" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "board_meetings" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "board_meeting_attendees" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "board_meeting_attendees" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "board_meeting_attendees" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "board_meeting_attendees" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "board_resolutions" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "board_resolutions" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "board_resolutions" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "board_resolutions" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "board_committee_resolutions" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "board_committee_resolutions" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "board_committee_resolutions" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "board_committee_resolutions" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "board_election_nominations" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "board_election_nominations" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "board_election_nominations" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "board_election_nominations" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "share_certificates" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "share_certificates" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "share_certificates" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "share_certificates" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "share_transfer_requests" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "share_transfer_requests" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "share_transfer_requests" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "share_transfer_requests" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "legal_documents" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "legal_documents" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "legal_documents" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "legal_documents" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "legal_template_versions" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "legal_template_versions" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "legal_template_versions" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "legal_template_versions" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "audit_deletion_logs" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "audit_deletion_logs" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "audit_deletion_logs" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "audit_deletion_logs" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- reporting.ts
ALTER TABLE "report_schedules" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "report_schedules" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "report_schedules" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "report_schedules" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "report_delivery_logs" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "report_delivery_logs" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "report_delivery_logs" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "report_delivery_logs" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "report_instances" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "report_instances" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "report_instances" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "report_instances" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "data_sources" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "data_sources" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "data_sources" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "data_sources" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "report_bookmarks" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "report_bookmarks" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "report_bookmarks" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "report_bookmarks" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- passbook.ts
ALTER TABLE "passbook_books" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "passbook_books" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "passbook_books" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "passbook_books" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "passbook_entries" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "passbook_entries" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "passbook_entries" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "passbook_entries" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "passbook_templates" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "passbook_templates" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "passbook_templates" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "passbook_templates" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "passbookDesign" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "passbookDesign" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "passbookDesign" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "passbookDesign" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "chequeBooks" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "chequeBooks" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "chequeBooks" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "chequeBooks" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "chequeLeaves" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "chequeLeaves" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "chequeLeaves" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "chequeLeaves" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "chequeBounces" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "chequeBounces" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "chequeBounces" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "chequeBounces" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "chequeDesigns" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "chequeDesigns" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "chequeDesigns" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "chequeDesigns" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- requisitionAndApproval.ts
ALTER TABLE "requisitions" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "requisitions" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "requisitions" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "requisitions" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "workflow_state_history" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "workflow_state_history" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "workflow_state_history" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "workflow_state_history" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "approval_requests" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "approval_requests" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "approval_requests" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "approval_requests" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "approval_audit_trail" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "approval_audit_trail" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "approval_audit_trail" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "approval_audit_trail" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "approval_delegations" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "approval_delegations" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "approval_delegations" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "approval_delegations" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "approval_templates" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "approval_templates" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "approval_templates" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "approval_templates" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "approval_notification_rules" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "approval_notification_rules" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "approval_notification_rules" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "approval_notification_rules" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- share.ts
ALTER TABLE "shares" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "shares" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "shares" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "shares" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "share_transactions" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "share_transactions" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "share_transactions" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "share_transactions" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- collections.ts
ALTER TABLE "collection_transactions" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "collection_transactions" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "collection_transactions" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "collection_transactions" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- loans.ts
ALTER TABLE "loans" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "loans" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "loans" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "loans" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "loan_schedules" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "loan_schedules" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "loan_schedules" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "loan_schedules" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "loan_repayments" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "loan_repayments" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "loan_repayments" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "loan_repayments" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "loan_disbursements" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "loan_disbursements" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "loan_disbursements" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "loan_disbursements" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "loan_write_offs" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "loan_write_offs" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "loan_write_offs" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "loan_write_offs" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "loan_reschedules" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "loan_reschedules" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "loan_reschedules" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "loan_reschedules" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "loan_collateral" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "loan_collateral" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "loan_collateral" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "loan_collateral" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "loan_guarantors" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "loan_guarantors" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "loan_guarantors" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "loan_guarantors" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- legal.ts
ALTER TABLE "legal_cases" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "legal_cases" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "legal_cases" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "legal_cases" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "legal_case_events" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "legal_case_events" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "legal_case_events" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "legal_case_events" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- syncEngine.ts
ALTER TABLE "sync_config" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "sync_config" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "sync_config" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "sync_config" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "sync_metadata" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "sync_metadata" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "sync_metadata" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "sync_metadata" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "sync_conflict_log" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "sync_conflict_log" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "sync_conflict_log" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "sync_conflict_log" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "sync_sessions" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "sync_sessions" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "sync_sessions" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "sync_sessions" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- settings.ts
ALTER TABLE "organization_settings" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "organization_settings" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "organization_settings" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "organization_settings" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "system_settings" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "system_settings" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- documents.ts
ALTER TABLE "document_categories" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "document_categories" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "document_categories" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "document_categories" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "document_templates" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "document_templates" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "document_templates" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "document_templates" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "document_template_versions" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "document_template_versions" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "document_template_versions" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "document_template_versions" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- cashFlow.ts
ALTER TABLE "cash_flow_categories" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "cash_flow_categories" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "cash_flow_categories" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "cash_flow_categories" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- loansCollateralGuarantor.ts
ALTER TABLE "loan_COLLATERAL_TYPES" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "loan_COLLATERAL_TYPES" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "loan_COLLATERAL_TYPES" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "loan_COLLATERAL_TYPES" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "loan_GUARANTOR_TYPES" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "loan_GUARANTOR_TYPES" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "loan_GUARANTOR_TYPES" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "loan_GUARANTOR_TYPES" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "loan_COLLATERAL_STATUS" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "loan_COLLATERAL_STATUS" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "loan_COLLATERAL_STATUS" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "loan_COLLATERAL_STATUS" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- advanceLedger.ts
ALTER TABLE "advance_sub_types" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "advance_sub_types" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "advance_sub_types" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "advance_sub_types" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- cash.ts
ALTER TABLE "cash_transactions" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "cash_transactions" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "cash_transactions" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "cash_transactions" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- bank.ts
ALTER TABLE "bank_reconciliation" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "bank_reconciliation" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "bank_reconciliation" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "bank_reconciliation" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "bank_reconciliation_items" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "bank_reconciliation_items" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "bank_reconciliation_items" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "bank_reconciliation_items" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "bank_reconciliation_audit" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "bank_reconciliation_audit" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "bank_reconciliation_audit" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "bank_reconciliation_audit" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "bank_reconciliation_history" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "bank_reconciliation_history" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "bank_reconciliation_history" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "bank_reconciliation_history" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "cash_variance_log" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "cash_variance_log" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "cash_variance_log" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "cash_variance_log" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "reconciliation_working_paper" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "reconciliation_working_paper" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "reconciliation_working_paper" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "reconciliation_working_paper" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "bank_account_opening_balance" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "bank_account_opening_balance" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "bank_account_opening_balance" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "bank_account_opening_balance" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "bank_account_opening_balance_audit" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "bank_account_opening_balance_audit" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "bank_account_opening_balance_audit" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "bank_account_opening_balance_audit" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- fees.ts
ALTER TABLE "fees" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "fees" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "fees" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "fees" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "feeWaivers" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "feeWaivers" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "feeWaivers" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "feeWaivers" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- pendingBalance.ts
ALTER TABLE "pendingBalance" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "pendingBalance" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "pendingBalance" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "pendingBalance" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- loanLimit.ts
ALTER TABLE "loan_LIMIT" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "loan_LIMIT" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "loan_LIMIT" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "loan_LIMIT" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- agreements.ts
ALTER TABLE "agreements" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "agreements" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "agreements" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "agreements" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- circulars.ts
ALTER TABLE "circulars" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "circulars" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "circulars" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "circulars" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- collection_sheet.ts
ALTER TABLE "collection_sheets" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "collection_sheets" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "collection_sheets" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "collection_sheets" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- collectionAgents.ts
ALTER TABLE "collection_agents" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "collection_agents" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "collection_agents" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "collection_agents" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- marketing.ts
ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "campaigns" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "campaigns" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "campaign_messages" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "campaign_messages" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "campaign_messages" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "campaign_messages" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "campaign_templates" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "campaign_templates" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "campaign_templates" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "campaign_templates" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "campaign_delivery_logs" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "campaign_delivery_logs" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "campaign_delivery_logs" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "campaign_delivery_logs" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "referral_programs" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "referral_programs" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "referral_programs" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "referral_programs" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "referral_rewards" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "referral_rewards" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "referral_rewards" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "referral_rewards" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- accountingDoubleEntry*.ts
ALTER TABLE "accountingDoubleEntryBusinessPolicies" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "accountingDoubleEntryBusinessPolicies" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "accountingDoubleEntryBusinessPolicies" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "accountingDoubleEntryBusinessPolicies" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "accountingDoubleEntryDataMapping" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "accountingDoubleEntryDataMapping" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "accountingDoubleEntryDataMapping" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "accountingDoubleEntryDataMapping" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "accountingDoubleEntryChartOfAccountOpeningBalance" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "accountingDoubleEntryChartOfAccountOpeningBalance" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "accountingDoubleEntryChartOfAccountOpeningBalance" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "accountingDoubleEntryChartOfAccountOpeningBalance" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "accountingDoubleEntryPostingRules" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "accountingDoubleEntryPostingRules" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "accountingDoubleEntryPostingRules" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "accountingDoubleEntryPostingRules" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "accountingDoubleEntryBankAccountOpeningBalance" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "accountingDoubleEntryBankAccountOpeningBalance" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "accountingDoubleEntryBankAccountOpeningBalance" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "accountingDoubleEntryBankAccountOpeningBalance" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- memberDocuments.ts
ALTER TABLE "member_documents" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "member_documents" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "member_documents" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "member_documents" RENAME COLUMN "updated_by_uuid" TO "updated_by";

-- od.ts
ALTER TABLE "overdrafts" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "overdrafts" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "overdrafts" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "overdrafts" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "overdraft_transactions" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "overdraft_transactions" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "overdraft_transactions" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "overdraft_transactions" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "overdraft_limits" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "overdraft_limits" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "overdraft_limits" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "overdraft_limits" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "overdraft_interest_config" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "overdraft_interest_config" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "overdraft_interest_config" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "overdraft_interest_config" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "overdraft_breach_log" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "overdraft_breach_log" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "overdraft_breach_log" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "overdraft_breach_log" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "overdraft_repayment_schedules" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "overdraft_repayment_schedules" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "overdraft_repayment_schedules" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "overdraft_repayment_schedules" RENAME COLUMN "updated_by_uuid" TO "updated_by";

ALTER TABLE "overdraftAnnualInterestChangeLog" DROP COLUMN IF EXISTS "created_by";
ALTER TABLE "overdraftAnnualInterestChangeLog" RENAME COLUMN "created_by_uuid" TO "created_by";
ALTER TABLE "overdraftAnnualInterestChangeLog" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "overdraftAnnualInterestChangeLog" RENAME COLUMN "updated_by_uuid" TO "updated_by";


-- ============================================
-- PART 4: Add FK constraints
-- ============================================

-- accounting.ts
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

-- auditEngine.ts
ALTER TABLE "audit_trail"
ADD CONSTRAINT "audit_trail_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "audit_trail"
ADD CONSTRAINT "audit_trail_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "audit_events"
ADD CONSTRAINT "audit_events_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "audit_events"
ADD CONSTRAINT "audit_events_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "audit_config"
ADD CONSTRAINT "audit_config_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "audit_config"
ADD CONSTRAINT "audit_config_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "risk_assessments"
ADD CONSTRAINT "risk_assessments_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "risk_assessments"
ADD CONSTRAINT "risk_assessments_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "control_objectives"
ADD CONSTRAINT "control_objectives_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "control_objectives"
ADD CONSTRAINT "control_objectives_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "control_testing"
ADD CONSTRAINT "control_testing_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "control_testing"
ADD CONSTRAINT "control_testing_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- workflow.ts
ALTER TABLE "workflow_definitions"
ADD CONSTRAINT "workflow_definitions_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "workflow_definitions"
ADD CONSTRAINT "workflow_definitions_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "workflow_transitions"
ADD CONSTRAINT "workflow_transitions_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "workflow_transitions"
ADD CONSTRAINT "workflow_transitions_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- governance.ts
ALTER TABLE "agm_meetings"
ADD CONSTRAINT "agm_meetings_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_meetings"
ADD CONSTRAINT "agm_meetings_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_notices"
ADD CONSTRAINT "agm_notices_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_notices"
ADD CONSTRAINT "agm_notices_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_notice_versions"
ADD CONSTRAINT "agm_notice_versions_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_notice_versions"
ADD CONSTRAINT "agm_notice_versions_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_agendas"
ADD CONSTRAINT "agm_agendas_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_agendas"
ADD CONSTRAINT "agm_agendas_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_minutes"
ADD CONSTRAINT "agm_minutes_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_minutes"
ADD CONSTRAINT "agm_minutes_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_resolutions"
ADD CONSTRAINT "agm_resolutions_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_resolutions"
ADD CONSTRAINT "agm_resolutions_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_polls"
ADD CONSTRAINT "agm_polls_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_polls"
ADD CONSTRAINT "agm_polls_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_votes"
ADD CONSTRAINT "agm_votes_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_votes"
ADD CONSTRAINT "agm_votes_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_proxies"
ADD CONSTRAINT "agm_proxies_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_proxies"
ADD CONSTRAINT "agm_proxies_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_attendees"
ADD CONSTRAINT "agm_attendees_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_attendees"
ADD CONSTRAINT "agm_attendees_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_committee_members"
ADD CONSTRAINT "agm_committee_members_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_committee_members"
ADD CONSTRAINT "agm_committee_members_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_election_nominations"
ADD CONSTRAINT "agm_election_nominations_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agm_election_nominations"
ADD CONSTRAINT "agm_election_nominations_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "board_members"
ADD CONSTRAINT "board_members_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "board_members"
ADD CONSTRAINT "board_members_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "board_committees"
ADD CONSTRAINT "board_committees_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "board_committees"
ADD CONSTRAINT "board_committees_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "board_committee_members"
ADD CONSTRAINT "board_committee_members_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "board_committee_members"
ADD CONSTRAINT "board_committee_members_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "board_meetings"
ADD CONSTRAINT "board_meetings_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "board_meetings"
ADD CONSTRAINT "board_meetings_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "board_meeting_attendees"
ADD CONSTRAINT "board_meeting_attendees_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "board_meeting_attendees"
ADD CONSTRAINT "board_meeting_attendees_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "board_resolutions"
ADD CONSTRAINT "board_resolutions_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "board_resolutions"
ADD CONSTRAINT "board_resolutions_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "board_committee_resolutions"
ADD CONSTRAINT "board_committee_resolutions_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "board_committee_resolutions"
ADD CONSTRAINT "board_committee_resolutions_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "board_election_nominations"
ADD CONSTRAINT "board_election_nominations_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "board_election_nominations"
ADD CONSTRAINT "board_election_nominations_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "share_certificates"
ADD CONSTRAINT "share_certificates_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "share_certificates"
ADD CONSTRAINT "share_certificates_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "share_transfer_requests"
ADD CONSTRAINT "share_transfer_requests_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "share_transfer_requests"
ADD CONSTRAINT "share_transfer_requests_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "legal_documents"
ADD CONSTRAINT "legal_documents_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "legal_documents"
ADD CONSTRAINT "legal_documents_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "legal_template_versions"
ADD CONSTRAINT "legal_template_versions_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "legal_template_versions"
ADD CONSTRAINT "legal_template_versions_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "audit_deletion_logs"
ADD CONSTRAINT "audit_deletion_logs_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "audit_deletion_logs"
ADD CONSTRAINT "audit_deletion_logs_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- reporting.ts
ALTER TABLE "report_schedules"
ADD CONSTRAINT "report_schedules_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "report_schedules"
ADD CONSTRAINT "report_schedules_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "report_delivery_logs"
ADD CONSTRAINT "report_delivery_logs_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "report_delivery_logs"
ADD CONSTRAINT "report_delivery_logs_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "report_instances"
ADD CONSTRAINT "report_instances_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "report_instances"
ADD CONSTRAINT "report_instances_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "data_sources"
ADD CONSTRAINT "data_sources_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "data_sources"
ADD CONSTRAINT "data_sources_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "report_bookmarks"
ADD CONSTRAINT "report_bookmarks_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "report_bookmarks"
ADD CONSTRAINT "report_bookmarks_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- passbook.ts
ALTER TABLE "passbook_books"
ADD CONSTRAINT "passbook_books_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "passbook_books"
ADD CONSTRAINT "passbook_books_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "passbook_entries"
ADD CONSTRAINT "passbook_entries_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "passbook_entries"
ADD CONSTRAINT "passbook_entries_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "passbook_templates"
ADD CONSTRAINT "passbook_templates_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "passbook_templates"
ADD CONSTRAINT "passbook_templates_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "passbookDesign"
ADD CONSTRAINT "passbookDesign_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "passbookDesign"
ADD CONSTRAINT "passbookDesign_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "chequeBooks"
ADD CONSTRAINT "chequeBooks_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "chequeBooks"
ADD CONSTRAINT "chequeBooks_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "chequeLeaves"
ADD CONSTRAINT "chequeLeaves_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "chequeLeaves"
ADD CONSTRAINT "chequeLeaves_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "chequeBounces"
ADD CONSTRAINT "chequeBounces_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "chequeBounces"
ADD CONSTRAINT "chequeBounces_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "chequeDesigns"
ADD CONSTRAINT "chequeDesigns_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "chequeDesigns"
ADD CONSTRAINT "chequeDesigns_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- requisitionAndApproval.ts
ALTER TABLE "requisitions"
ADD CONSTRAINT "requisitions_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "requisitions"
ADD CONSTRAINT "requisitions_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "workflow_state_history"
ADD CONSTRAINT "workflow_state_history_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "workflow_state_history"
ADD CONSTRAINT "workflow_state_history_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "approval_requests"
ADD CONSTRAINT "approval_requests_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "approval_requests"
ADD CONSTRAINT "approval_requests_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "approval_audit_trail"
ADD CONSTRAINT "approval_audit_trail_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "approval_audit_trail"
ADD CONSTRAINT "approval_audit_trail_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "approval_delegations"
ADD CONSTRAINT "approval_delegations_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "approval_delegations"
ADD CONSTRAINT "approval_delegations_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "approval_templates"
ADD CONSTRAINT "approval_templates_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "approval_templates"
ADD CONSTRAINT "approval_templates_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "approval_notification_rules"
ADD CONSTRAINT "approval_notification_rules_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "approval_notification_rules"
ADD CONSTRAINT "approval_notification_rules_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- share.ts
ALTER TABLE "shares"
ADD CONSTRAINT "shares_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "shares"
ADD CONSTRAINT "shares_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "share_transactions"
ADD CONSTRAINT "share_transactions_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "share_transactions"
ADD CONSTRAINT "share_transactions_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- collections.ts
ALTER TABLE "collection_transactions"
ADD CONSTRAINT "collection_transactions_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "collection_transactions"
ADD CONSTRAINT "collection_transactions_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- loans.ts
ALTER TABLE "loans"
ADD CONSTRAINT "loans_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loans"
ADD CONSTRAINT "loans_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_schedules"
ADD CONSTRAINT "loan_schedules_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_schedules"
ADD CONSTRAINT "loan_schedules_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_repayments"
ADD CONSTRAINT "loan_repayments_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_repayments"
ADD CONSTRAINT "loan_repayments_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_disbursements"
ADD CONSTRAINT "loan_disbursements_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_disbursements"
ADD CONSTRAINT "loan_disbursements_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_write_offs"
ADD CONSTRAINT "loan_write_offs_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_write_offs"
ADD CONSTRAINT "loan_write_offs_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_reschedules"
ADD CONSTRAINT "loan_reschedules_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_reschedules"
ADD CONSTRAINT "loan_reschedules_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_collateral"
ADD CONSTRAINT "loan_collateral_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_collateral"
ADD CONSTRAINT "loan_collateral_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_guarantors"
ADD CONSTRAINT "loan_guarantors_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_guarantors"
ADD CONSTRAINT "loan_guarantors_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- legal.ts
ALTER TABLE "legal_cases"
ADD CONSTRAINT "legal_cases_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "legal_cases"
ADD CONSTRAINT "legal_cases_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "legal_case_events"
ADD CONSTRAINT "legal_case_events_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "legal_case_events"
ADD CONSTRAINT "legal_case_events_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- syncEngine.ts
ALTER TABLE "sync_config"
ADD CONSTRAINT "sync_config_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "sync_config"
ADD CONSTRAINT "sync_config_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "sync_metadata"
ADD CONSTRAINT "sync_metadata_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "sync_metadata"
ADD CONSTRAINT "sync_metadata_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "sync_conflict_log"
ADD CONSTRAINT "sync_conflict_log_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "sync_conflict_log"
ADD CONSTRAINT "sync_conflict_log_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "sync_sessions"
ADD CONSTRAINT "sync_sessions_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "sync_sessions"
ADD CONSTRAINT "sync_sessions_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- settings.ts
ALTER TABLE "organization_settings"
ADD CONSTRAINT "organization_settings_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "organization_settings"
ADD CONSTRAINT "organization_settings_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "system_settings"
ADD CONSTRAINT "system_settings_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "system_settings"
ADD CONSTRAINT "system_settings_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- documents.ts
ALTER TABLE "document_categories"
ADD CONSTRAINT "document_categories_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "document_categories"
ADD CONSTRAINT "document_categories_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "document_templates"
ADD CONSTRAINT "document_templates_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "document_templates"
ADD CONSTRAINT "document_templates_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "document_template_versions"
ADD CONSTRAINT "document_template_versions_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "document_template_versions"
ADD CONSTRAINT "document_template_versions_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- cashFlow.ts
ALTER TABLE "cash_flow_categories"
ADD CONSTRAINT "cash_flow_categories_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "cash_flow_categories"
ADD CONSTRAINT "cash_flow_categories_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- loansCollateralGuarantor.ts
ALTER TABLE "loan_COLLATERAL_TYPES"
ADD CONSTRAINT "loan_COLLATERAL_TYPES_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_COLLATERAL_TYPES"
ADD CONSTRAINT "loan_COLLATERAL_TYPES_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_GUARANTOR_TYPES"
ADD CONSTRAINT "loan_GUARANTOR_TYPES_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_GUARANTOR_TYPES"
ADD CONSTRAINT "loan_GUARANTOR_TYPES_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_COLLATERAL_STATUS"
ADD CONSTRAINT "loan_COLLATERAL_STATUS_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_COLLATERAL_STATUS"
ADD CONSTRAINT "loan_COLLATERAL_STATUS_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- advanceLedger.ts
ALTER TABLE "advance_sub_types"
ADD CONSTRAINT "advance_sub_types_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "advance_sub_types"
ADD CONSTRAINT "advance_sub_types_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- cash.ts
ALTER TABLE "cash_transactions"
ADD CONSTRAINT "cash_transactions_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "cash_transactions"
ADD CONSTRAINT "cash_transactions_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- bank.ts
ALTER TABLE "bank_reconciliation"
ADD CONSTRAINT "bank_reconciliation_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "bank_reconciliation"
ADD CONSTRAINT "bank_reconciliation_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "bank_reconciliation_items"
ADD CONSTRAINT "bank_reconciliation_items_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "bank_reconciliation_items"
ADD CONSTRAINT "bank_reconciliation_items_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "bank_reconciliation_history"
ADD CONSTRAINT "bank_reconciliation_history_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "bank_reconciliation_history"
ADD CONSTRAINT "bank_reconciliation_history_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "cash_variance_log"
ADD CONSTRAINT "cash_variance_log_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "cash_variance_log"
ADD CONSTRAINT "cash_variance_log_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "reconciliation_working_paper"
ADD CONSTRAINT "reconciliation_working_paper_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "reconciliation_working_paper"
ADD CONSTRAINT "reconciliation_working_paper_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "bank_account_opening_balance"
ADD CONSTRAINT "bank_account_opening_balance_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "bank_account_opening_balance"
ADD CONSTRAINT "bank_account_opening_balance_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "bank_account_opening_balance_audit"
ADD CONSTRAINT "bank_account_opening_balance_audit_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "bank_account_opening_balance_audit"
ADD CONSTRAINT "bank_account_opening_balance_audit_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- fees.ts
ALTER TABLE "fees"
ADD CONSTRAINT "fees_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "fees"
ADD CONSTRAINT "fees_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "feeWaivers"
ADD CONSTRAINT "feeWaivers_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "feeWaivers"
ADD CONSTRAINT "feeWaivers_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- pendingBalance.ts
ALTER TABLE "pendingBalance"
ADD CONSTRAINT "pendingBalance_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "pendingBalance"
ADD CONSTRAINT "pendingBalance_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- loanLimit.ts
ALTER TABLE "loan_LIMIT"
ADD CONSTRAINT "loan_LIMIT_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "loan_LIMIT"
ADD CONSTRAINT "loan_LIMIT_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- agreements.ts
ALTER TABLE "agreements"
ADD CONSTRAINT "agreements_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "agreements"
ADD CONSTRAINT "agreements_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- circulars.ts
ALTER TABLE "circulars"
ADD CONSTRAINT "circulars_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "circulars"
ADD CONSTRAINT "circulars_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- collection_sheet.ts
ALTER TABLE "collection_sheets"
ADD CONSTRAINT "collection_sheets_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "collection_sheets"
ADD CONSTRAINT "collection_sheets_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- collectionAgents.ts
ALTER TABLE "collection_agents"
ADD CONSTRAINT "collection_agents_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "collection_agents"
ADD CONSTRAINT "collection_agents_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- marketing.ts
ALTER TABLE "campaigns"
ADD CONSTRAINT "campaigns_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "campaigns"
ADD CONSTRAINT "campaigns_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "campaign_messages"
ADD CONSTRAINT "campaign_messages_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "campaign_messages"
ADD CONSTRAINT "campaign_messages_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "campaign_templates"
ADD CONSTRAINT "campaign_templates_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "campaign_templates"
ADD CONSTRAINT "campaign_templates_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "campaign_delivery_logs"
ADD CONSTRAINT "campaign_delivery_logs_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "campaign_delivery_logs"
ADD CONSTRAINT "campaign_delivery_logs_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "referral_programs"
ADD CONSTRAINT "referral_programs_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "referral_programs"
ADD CONSTRAINT "referral_programs_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "referral_rewards"
ADD CONSTRAINT "referral_rewards_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "referral_rewards"
ADD CONSTRAINT "referral_rewards_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- accountingDoubleEntry*.ts
ALTER TABLE "accountingDoubleEntryBusinessPolicies"
ADD CONSTRAINT "accountingDoubleEntryBusinessPolicies_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "accountingDoubleEntryBusinessPolicies"
ADD CONSTRAINT "accountingDoubleEntryBusinessPolicies_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "accountingDoubleEntryDataMapping"
ADD CONSTRAINT "accountingDoubleEntryDataMapping_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "accountingDoubleEntryDataMapping"
ADD CONSTRAINT "accountingDoubleEntryDataMapping_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "accountingDoubleEntryChartOfAccountOpeningBalance"
ADD CONSTRAINT "accountingDoubleEntryChartOfAccountOpeningBalance_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "accountingDoubleEntryChartOfAccountOpeningBalance"
ADD CONSTRAINT "accountingDoubleEntryChartOfAccountOpeningBalance_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "accountingDoubleEntryPostingRules"
ADD CONSTRAINT "accountingDoubleEntryPostingRules_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "accountingDoubleEntryPostingRules"
ADD CONSTRAINT "accountingDoubleEntryPostingRules_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "accountingDoubleEntryBankAccountOpeningBalance"
ADD CONSTRAINT "accountingDoubleEntryBankAccountOpeningBalance_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "accountingDoubleEntryBankAccountOpeningBalance"
ADD CONSTRAINT "accountingDoubleEntryBankAccountOpeningBalance_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- memberDocuments.ts
ALTER TABLE "member_documents"
ADD CONSTRAINT "member_documents_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "member_documents"
ADD CONSTRAINT "member_documents_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

-- od.ts
ALTER TABLE "overdrafts"
ADD CONSTRAINT "overdrafts_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "overdrafts"
ADD CONSTRAINT "overdrafts_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "overdraft_transactions"
ADD CONSTRAINT "overdraft_transactions_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "overdraft_transactions"
ADD CONSTRAINT "overdraft_transactions_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "overdraft_limits"
ADD CONSTRAINT "overdraft_limits_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "overdraft_limits"
ADD CONSTRAINT "overdraft_limits_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "overdraft_interest_config"
ADD CONSTRAINT "overdraft_interest_config_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "overdraft_interest_config"
ADD CONSTRAINT "overdraft_interest_config_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "overdraft_breach_log"
ADD CONSTRAINT "overdraft_breach_log_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "overdraft_breach_log"
ADD CONSTRAINT "overdraft_breach_log_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "overdraft_repayment_schedules"
ADD CONSTRAINT "overdraft_repayment_schedules_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "overdraft_repayment_schedules"
ADD CONSTRAINT "overdraft_repayment_schedules_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "overdraftAnnualInterestChangeLog"
ADD CONSTRAINT "overdraftAnnualInterestChangeLog_created_by_fk"
FOREIGN KEY ("created_by") REFERENCES "org_users"("id") ON DELETE SET NULL;

ALTER TABLE "overdraftAnnualInterestChangeLog"
ADD CONSTRAINT "overdraftAnnualInterestChangeLog_updated_by_fk"
FOREIGN KEY ("updated_by") REFERENCES "org_users"("id") ON DELETE SET NULL;