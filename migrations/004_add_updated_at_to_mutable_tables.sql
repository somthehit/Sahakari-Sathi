-- Migration: Add updatedAt to mutable tables
-- Priority: HIGH - Enables proper change tracking

-- Batch 1: Accounting tables
ALTER TABLE "account_groups" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "voucher_entries" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "cash_books" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "bank_books" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "subsidiary_debit_book" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "subsidiary_credit_book" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "budgets" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "budget_lines" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "cash_flow_categories" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "bank_reconciliation" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;

-- Backfill: set updated_at = created_at for existing rows
UPDATE "account_groups" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "accounts" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "voucher_entries" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "cash_books" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "bank_books" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "subsidiary_debit_book" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "subsidiary_credit_book" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "fixed_assets" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "budgets" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "budget_lines" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "cash_flow_categories" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "bank_reconciliation" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;

-- Batch 2: Governance tables
ALTER TABLE "agm_meetings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "agm_notices" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "agm_notice_versions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "agm_agendas" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "agm_minutes" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "agm_resolutions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "agm_polls" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "agm_votes" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "agm_proxies" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "agm_attendees" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "agm_committee_members" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "agm_election_nominations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "board_members" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "board_committees" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "board_committee_members" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "board_meetings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "board_meeting_attendees" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "board_resolutions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "board_committee_resolutions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "board_election_nominations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "share_certificates" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "share_transfer_requests" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "legal_documents" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "legal_template_versions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "audit_deletion_logs" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;

-- Backfill governance tables
UPDATE "agm_meetings" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "agm_notices" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "agm_notice_versions" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "agm_agendas" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "agm_minutes" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "agm_resolutions" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "agm_polls" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "agm_votes" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "agm_proxies" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "agm_attendees" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "agm_committee_members" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "agm_election_nominations" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "board_members" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "board_committees" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "board_committee_members" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "board_meetings" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "board_meeting_attendees" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "board_resolutions" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "board_committee_resolutions" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "board_election_nominations" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "share_certificates" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "share_transfer_requests" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "legal_documents" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "legal_template_versions" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "audit_deletion_logs" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;

-- Batch 3: Inventory tables
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "inventory_stock" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "stock_adjustments" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "stock_adjustment_items" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "goods_receive_notes" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "goods_receive_note_items" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;

-- Backfill inventory tables
UPDATE "inventory" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "inventory_stock" SET "updated_at" = COALESCE("created_at", NOW()) WHERE "updated_at" IS NULL;
UPDATE "inventory_transactions" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "stock_adjustments" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "stock_adjustment_items" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "goods_receive_notes" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "goods_receive_note_items" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;

-- Batch 4: Other tables
ALTER TABLE "loan_collateral" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "loan_guarantors" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "legal_cases" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "legal_case_events" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "workflow_transitions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "approval_requests" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "approval_audit_trail" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "file_metadata" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "member_signature_specimens" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "loan_LIMIT" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "agreements" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
ALTER TABLE "circulars" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;

-- Backfill other tables
UPDATE "loan_collateral" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "loan_guarantors" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "legal_cases" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "legal_case_events" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "workflow_transitions" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "approval_requests" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "approval_audit_trail" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "file_metadata" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "attachments" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "designations" SET "updated_at" = COALESCE("created_at", NOW()) WHERE "updated_at" IS NULL;
UPDATE "member_signature_specimens" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "loan_LIMIT" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "agreements" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "circulars" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;