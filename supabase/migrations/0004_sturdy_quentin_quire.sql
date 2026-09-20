CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_nepali" varchar(100),
	"address" text,
	"chairperson_name" varchar(100),
	"chairperson_contact" varchar(50),
	"chairperson_address" text,
	"contact_person_name" varchar(100),
	"contact_person_phone" varchar(50),
	"meeting_day_of_month" integer,
	"meeting_time" varchar(20),
	"meeting_place" text,
	"max_members" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_kitta_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"last_kitta_no" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_share_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"authorized_capital_ceiling" numeric(14, 2) NOT NULL,
	"authorized_total_kitta" integer NOT NULL,
	"default_face_value" numeric(8, 2) DEFAULT '100.00',
	"min_required_kitta" integer DEFAULT 10 NOT NULL,
	"total_issued_kitta" integer DEFAULT 0 NOT NULL,
	"total_issued_capital" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_share_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "share_account_nominees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"share_account_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"relation" text NOT NULL,
	"citizenship_no" text,
	"contact_no" text,
	"photo_url" text,
	"share_percentage" numeric(5, 2) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"account_no" text NOT NULL,
	"total_shares" integer DEFAULT 0 NOT NULL,
	"total_capital_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dividend_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_nepali" varchar(100),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"tax_withholding_percent" numeric(6, 2) DEFAULT '5.00' NOT NULL,
	"target_dividend_percent" numeric(6, 2) DEFAULT '12.50' NOT NULL,
	"bonus_share_ratio" varchar(20) DEFAULT '1:10' NOT NULL,
	"dividend_policy" text,
	"fiscal_year" varchar(20),
	"approval_status" text DEFAULT 'draft' NOT NULL,
	"distribution_mode" text DEFAULT 'cash' NOT NULL,
	"minimum_holding_period_months" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_certificate_formats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"certificate_prefix" varchar(10) DEFAULT 'SC-' NOT NULL,
	"starting_number" integer DEFAULT 1 NOT NULL,
	"include_logo" boolean DEFAULT true NOT NULL,
	"header_text" text,
	"footer_text" text,
	"fields_json" text,
	"config_json" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_nepali" varchar(100),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"share_type" text DEFAULT 'ORDINARY' NOT NULL,
	"target_member_type" text DEFAULT 'INDIVIDUAL' NOT NULL,
	"par_value" numeric(12, 2) DEFAULT '100.00' NOT NULL,
	"min_kitta_per_purchase" integer DEFAULT 10 NOT NULL,
	"max_kitta_per_member" integer,
	"gl_account_id" uuid,
	"is_dividend_eligible" boolean DEFAULT true NOT NULL,
	"max_dividend_rate_pct" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE "share_provisioning_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"member_no" text NOT NULL,
	"share_scheme_id" uuid NOT NULL,
	"share_type_id" uuid,
	"status" text DEFAULT 'Pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"opened_holding_id" uuid,
	"opened_voucher_no" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "share_schemes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_nepali" varchar(100),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"share_class_id" uuid,
	"share_type_id" uuid,
	"share_value_per_unit" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"min_open_units" integer DEFAULT 1 NOT NULL,
	"max_units" integer,
	"is_transferable" boolean DEFAULT true NOT NULL,
	"dividend_rate" numeric(6, 4) DEFAULT '0.0000' NOT NULL,
	"min_opening_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_cheque_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"account_no" text NOT NULL,
	"book_no" text NOT NULL,
	"first_leaf_no" integer NOT NULL,
	"leaf_count" integer DEFAULT 25 NOT NULL,
	"issue_date_bs" text NOT NULL,
	"issue_date_ad" text NOT NULL,
	"issued_by_id" uuid,
	"status" text DEFAULT 'Issued' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_cheque_deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"account_no" text NOT NULL,
	"member_id" uuid NOT NULL,
	"member_name" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"cheque_number" text NOT NULL,
	"cheque_bank" text NOT NULL,
	"cheque_date_bs" text,
	"date_bs" text NOT NULL,
	"date_ad" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"voucher_no" text,
	"reference" text,
	"deposited_by_id" uuid,
	"deposited_by_name" text,
	"cleared_at" timestamp,
	"cleared_by_id" uuid,
	"cleared_by_name" text,
	"bounced_at" timestamp,
	"bounce_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_cheque_leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"leaf_no" integer NOT NULL,
	"status" text DEFAULT 'Available' NOT NULL,
	"used_by_txn_id" uuid,
	"stopped_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_interest_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"savings_product_id" uuid NOT NULL,
	"rate" numeric(6, 4) DEFAULT '0' NOT NULL,
	"effective_from_bs" text NOT NULL,
	"effective_to_bs" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_pending_withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"account_no" text NOT NULL,
	"member_id" uuid NOT NULL,
	"member_name" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"payout_mode" text DEFAULT 'Cash' NOT NULL,
	"instrument_type" text NOT NULL,
	"instrument_reference" text,
	"date_bs" text NOT NULL,
	"date_ad" text NOT NULL,
	"voucher_no" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"requested_by_id" uuid NOT NULL,
	"requested_by_name" text NOT NULL,
	"approved_by" text,
	"signature_log_id" uuid,
	"signature_outcome" text,
	"signature_override_reason" text,
	"remarks" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_provisioning_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"member_no" text NOT NULL,
	"savings_product_id" uuid NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"opened_account_id" uuid,
	"opened_voucher_no" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "emi_schedule_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"default_interest_method" text DEFAULT 'diminishing_emi' NOT NULL,
	"enabled_methods" jsonb DEFAULT '["flat","diminishing_emi","diminishing_principal","daily_reducing","bullet"]'::jsonb NOT NULL,
	"day_count_convention" text DEFAULT '365' NOT NULL,
	"installment_day_of_month" integer DEFAULT 1 NOT NULL,
	"rounding_mode" text DEFAULT 'round' NOT NULL,
	"shift_to_working_day" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guarantor_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"min_guarantors" integer DEFAULT 1 NOT NULL,
	"max_guarantors" integer,
	"required_coverage_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"allow_member_guarantors" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guarantor_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_nepali" varchar(100),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_nepali" varchar(100),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_collateral_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_nepali" varchar(100),
	"description" text,
	"valuation_required" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_product_eligible_member_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"loan_product_id" uuid NOT NULL,
	"member_category_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_product_eligible_member_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"loan_product_id" uuid NOT NULL,
	"member_type_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_product_guarantor_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"loan_product_id" uuid NOT NULL,
	"guarantor_type_id" uuid NOT NULL,
	"min_count" integer DEFAULT 1 NOT NULL,
	"max_count" integer,
	"coverage_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_product_interest_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"loan_product_id" uuid NOT NULL,
	"rate" numeric(6, 4) NOT NULL,
	"effective_from_bs" text NOT NULL,
	"effective_to_bs" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"account_name" varchar(100) NOT NULL,
	"account_number" varchar(50) NOT NULL,
	"branch_id" uuid,
	"currency" varchar(3) DEFAULT 'NPR' NOT NULL,
	"gl_account_id" uuid,
	"account_type" text DEFAULT 'Current' NOT NULL,
	"opening_balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"opening_date_bs" varchar(10),
	"is_primary" boolean DEFAULT false NOT NULL,
	"reconciliation_enabled" boolean DEFAULT false NOT NULL,
	"last_reconciled_date_bs" varchar(10),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_nepali" varchar(100),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"swift_code" varchar(20),
	"short_name" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "cash_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_nepali" varchar(100),
	"branch_id" uuid NOT NULL,
	"assigned_user_id" uuid,
	"gl_cash_account_id" uuid,
	"opening_balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"max_cash_limit" numeric(18, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_nepali" varchar(100),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"parent_id" uuid,
	"branch_id" uuid,
	"manager_id" uuid,
	"manager_name" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "financial_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_nepali" varchar(100),
	"fiscal_year_id" uuid,
	"fiscal_year_code" varchar(20) NOT NULL,
	"start_date_bs" varchar(10) NOT NULL,
	"end_date_bs" varchar(10) NOT NULL,
	"start_date_ad" varchar(10) NOT NULL,
	"end_date_ad" varchar(10) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp,
	"closed_by" varchar(100),
	"locked_at" timestamp,
	"locked_by" varchar(100),
	"reason" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_template_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"account_code" varchar(20) NOT NULL,
	"account_name" varchar(100) NOT NULL,
	"entry_type" text NOT NULL,
	"amount_type" text DEFAULT 'amount' NOT NULL,
	"amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"cost_center_id" uuid,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_nepali" varchar(100),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"voucher_type_id" uuid,
	"narration_template" text,
	"frequency" text DEFAULT 'manual' NOT NULL,
	"branch_id" uuid
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_nepali" varchar(100),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"type" text DEFAULT 'Other' NOT NULL,
	"requires_reference" boolean DEFAULT false NOT NULL,
	"requires_bank" boolean DEFAULT false NOT NULL,
	"requires_cheque_number" boolean DEFAULT false NOT NULL,
	"requires_transaction_id" boolean DEFAULT false NOT NULL,
	"gl_account_id" uuid
);
--> statement-breakpoint
CREATE TABLE "system_account_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"mapping_key" text NOT NULL,
	"account_id" uuid NOT NULL,
	"description" text,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voucher_type_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"voucher_type_id" uuid NOT NULL,
	"fiscal_year_code" varchar(20) NOT NULL,
	"next_seq" bigint DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voucher_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_nepali" varchar(100),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"category" text DEFAULT 'Journal' NOT NULL,
	"prefix" varchar(8) DEFAULT 'JV' NOT NULL,
	"numbering_rule" text DEFAULT 'fiscal_year' NOT NULL,
	"padding" integer DEFAULT 6 NOT NULL,
	"default_debit_account_id" uuid,
	"default_credit_account_id" uuid,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"requires_narration" boolean DEFAULT true NOT NULL,
	"requires_cost_center" boolean DEFAULT false NOT NULL,
	"requires_reference" boolean DEFAULT false NOT NULL,
	"is_branch_scoped" boolean DEFAULT false NOT NULL,
	"allow_backdate" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_deletion_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_code" text,
	"deleted_by_user_id" uuid NOT NULL,
	"deleted_by_user_name" text NOT NULL,
	"deleted_by_user_role" text,
	"deletion_reason" text NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cheque_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"account_id" uuid NOT NULL,
	"account_product_id" uuid,
	"book_number" text NOT NULL,
	"prefix" text,
	"leaf_start_number" integer NOT NULL,
	"leaf_end_number" integer NOT NULL,
	"leaf_count" integer DEFAULT 25 NOT NULL,
	"issued_date_bs" text NOT NULL,
	"issued_date_ad" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"issuance_charge" numeric(15, 2) DEFAULT '0' NOT NULL,
	"issued_by_id" uuid,
	"purpose" text,
	"delivery_method" text,
	"override_reason" text,
	"cancelled_by_id" uuid,
	"cancelled_at" timestamp,
	"cancel_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cheque_bounces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"account_id" uuid NOT NULL,
	"cheque_leaf_id" uuid,
	"cheque_number" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"bounce_reason" text NOT NULL,
	"bounce_charge" numeric(15, 2) DEFAULT '0' NOT NULL,
	"transaction_id" uuid,
	"reported_date" text NOT NULL,
	"reported_by_id" uuid NOT NULL,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cheque_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"width_mm" numeric(6, 2) DEFAULT '200' NOT NULL,
	"height_mm" numeric(6, 2) DEFAULT '92' NOT NULL,
	"config_json" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cheque_leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"cheque_book_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"cheque_number" text NOT NULL,
	"leaf_no" integer NOT NULL,
	"status" text DEFAULT 'unused' NOT NULL,
	"payee_name" text,
	"amount" numeric(15, 2),
	"cheque_date_bs" text,
	"cheque_date_ad" text,
	"presented_date" timestamp,
	"cleared_date" timestamp,
	"used_at" timestamp,
	"transaction_id" uuid,
	"bounce_date" timestamp,
	"bounce_reason" text,
	"stop_payment_date" timestamp,
	"stop_payment_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cheque_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"scope" text DEFAULT 'organization' NOT NULL,
	"enable_cheque_facility" boolean DEFAULT true NOT NULL,
	"eligible_account_product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_leaves_per_book" integer DEFAULT 25 NOT NULL,
	"allowed_book_sizes" jsonb DEFAULT '[10,20,25,50,100]'::jsonb NOT NULL,
	"max_active_books_per_account" integer DEFAULT 1 NOT NULL,
	"reissue_allowed" boolean DEFAULT true NOT NULL,
	"reissue_after_exhaustion" boolean DEFAULT true NOT NULL,
	"lost_book_replacement_allowed" boolean DEFAULT true NOT NULL,
	"cancelled_book_replacement_allowed" boolean DEFAULT true NOT NULL,
	"require_kyc_verified" boolean DEFAULT true NOT NULL,
	"block_blacklisted_members" boolean DEFAULT true NOT NULL,
	"min_utilization_for_reissue" integer DEFAULT 80 NOT NULL,
	"reissue_cooldown_days" integer DEFAULT 30 NOT NULL,
	"allow_supervisor_override" boolean DEFAULT true NOT NULL,
	"numbering_scope" text DEFAULT 'branch_wise' NOT NULL,
	"starting_cheque_number" integer DEFAULT 100001 NOT NULL,
	"cheque_prefix" text DEFAULT 'CHQ-' NOT NULL,
	"number_length" integer DEFAULT 6 NOT NULL,
	"allow_manual_number_assignment" boolean DEFAULT false NOT NULL,
	"prevent_duplicate_cheque_numbers" boolean DEFAULT true NOT NULL,
	"validity_period_days" integer DEFAULT 90 NOT NULL,
	"expired_cheque_behavior" text DEFAULT 'reject_presentation' NOT NULL,
	"stop_payment_enabled" boolean DEFAULT true NOT NULL,
	"allow_stop_payment_by" jsonb DEFAULT '["member","teller","branch_manager","admin"]'::jsonb NOT NULL,
	"stop_payment_charge" numeric(15, 2) DEFAULT '0' NOT NULL,
	"allow_stop_payment_on" jsonb DEFAULT '["single_cheque","cheque_range","entire_book"]'::jsonb NOT NULL,
	"stop_payment_require_approval" boolean DEFAULT true NOT NULL,
	"bounce_handling_enabled" boolean DEFAULT true NOT NULL,
	"bounce_charge" numeric(15, 2) DEFAULT '0' NOT NULL,
	"max_bounce_count" integer,
	"after_threshold_action" text DEFAULT 'flag_account' NOT NULL,
	"issuance_charge_type" text DEFAULT 'flat' NOT NULL,
	"issuance_charge_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"issuance_charge_per_leaf_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"lost_book_charge" numeric(15, 2) DEFAULT '0' NOT NULL,
	"replacement_book_charge" numeric(15, 2) DEFAULT '0' NOT NULL,
	"other_cheque_charges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tax_applicable" boolean DEFAULT false NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"gl_issuance_fee_account_id" uuid,
	"gl_stop_payment_fee_account_id" uuid,
	"gl_bounce_fee_account_id" uuid,
	"gl_replacement_fee_account_id" uuid,
	"gl_other_charges_fee_account_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cheque_stop_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"account_id" uuid NOT NULL,
	"cheque_book_id" uuid,
	"cheque_leaf_id" uuid,
	"start_cheque_number" text NOT NULL,
	"end_cheque_number" text NOT NULL,
	"reason" text NOT NULL,
	"charge_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by_id" uuid NOT NULL,
	"approved_by_id" uuid,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_signature_specimens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"member_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"signatory_name" text,
	"image_url" text NOT NULL,
	"signing_rule" varchar(20) DEFAULT 'any' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"captured_by_id" uuid,
	"captured_via" text DEFAULT 'open_account' NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_withdrawal_instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"account_id" uuid NOT NULL,
	"account_no" text NOT NULL,
	"member_id" uuid NOT NULL,
	"member_name" text NOT NULL,
	"type" text NOT NULL,
	"reference" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"date_bs" text NOT NULL,
	"voucher_no" text,
	"transaction_id" uuid,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_verification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"account_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"specimen_id" uuid,
	"presented_image_url" text NOT NULL,
	"specimen_image_url" text NOT NULL,
	"match_score" numeric(5, 2) NOT NULL,
	"machine_verdict" varchar(20) NOT NULL,
	"outcome" varchar(20),
	"reviewed_by_user_id" uuid,
	"override_reason" text,
	"withdrawal_id" uuid,
	"voucher_no" text,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "staff" CASCADE;--> statement-breakpoint
ALTER TABLE "loan_products" ALTER COLUMN "product_type" SET DEFAULT 'general';--> statement-breakpoint
ALTER TABLE "loan_products" ALTER COLUMN "interest_method" SET DEFAULT 'diminishing_emi';--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "basic_salary" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "allowances" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "pf_contribution_percent" numeric(5, 2) DEFAULT '10' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_profiles" ADD COLUMN "default_share_scheme_id" uuid;--> statement-breakpoint
ALTER TABLE "organization_profiles" ADD COLUMN "default_certificate_format_id" uuid;--> statement-breakpoint
ALTER TABLE "organization_profiles" ADD COLUMN "default_saving_product_id" uuid;--> statement-breakpoint
ALTER TABLE "member_family" ADD COLUMN "nominee_relation_id" uuid;--> statement-breakpoint
ALTER TABLE "member_family" ADD COLUMN "nominee_type_id" uuid;--> statement-breakpoint
ALTER TABLE "member_kyc_profiles" ADD COLUMN "occupation_id" uuid;--> statement-breakpoint
ALTER TABLE "member_kyc_profiles" ADD COLUMN "education_level_id" uuid;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "member_type_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "member_category_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "member_types" ADD COLUMN "is_group_type" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "share_holdings" ADD COLUMN "share_scheme_id" uuid;--> statement-breakpoint
ALTER TABLE "share_holdings" ADD COLUMN "opened_via" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "share_transactions" ADD COLUMN "share_scheme_id" uuid;--> statement-breakpoint
ALTER TABLE "share_types" ADD COLUMN "is_pledgeable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "share_types" ADD COLUMN "kitta_prefix" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "share_types" ADD COLUMN "kitta_start_base" integer;--> statement-breakpoint
ALTER TABLE "share_types" ADD COLUMN "current_kitta_pointer" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "share_types" ADD COLUMN "max_allowed_kitta" integer;--> statement-breakpoint
ALTER TABLE "share_types" ADD COLUMN "auto_sequence" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_accounts" ADD COLUMN "opened_via" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_accounts" ADD COLUMN "passbook_serial" text;--> statement-breakpoint
ALTER TABLE "savings_accounts" ADD COLUMN "passbook_lines_per_page" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_accounts" ADD COLUMN "last_printed_txn_id" uuid;--> statement-breakpoint
ALTER TABLE "savings_accounts" ADD COLUMN "last_printed_line" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_accounts" ADD COLUMN "last_printed_date_bs" text;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "name_nepali" varchar(100);--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "product_category" text;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "interest_calculation_method" text DEFAULT 'min_monthly_balance' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "interest_effective_date" text;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "max_balance" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "eligible_member_type_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "min_age" integer;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "max_age" integer;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "requires_kyc_verified" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "requires_nominee" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "requires_photo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "requires_signature" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "requires_documents" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "opening_deposit_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "account_no_prefix" varchar(10) DEFAULT 'SAV' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "deposit_mode_cash" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "deposit_mode_bank" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "deposit_mode_transfer" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "deposit_mode_agent" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "daily_deposit_limit" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "monthly_deposit_limit" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "backdate_deposit_allowed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "deposit_requires_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "withdrawal_mode_cash" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "withdrawal_mode_transfer" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "min_withdrawal" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "max_withdrawal" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "daily_withdrawal_limit" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "monthly_withdrawal_limit" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "minimum_balance_after_withdrawal" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "withdrawal_requires_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "min_balance_grace_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "min_balance_penalty_percent" numeric(6, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "min_balance_penalty_amount" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "min_balance_penalty_frequency" text DEFAULT 'Monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "min_balance_waiver_allowed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "inactive_after_months" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "dormant_after_months" integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "notify_before_dormancy_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "reactivation_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "reactivation_approval_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "closure_allowed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "minimum_balance_before_closure" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "closure_requires_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "closure_fee" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "opening_fee" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "monthly_maintenance_fee" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "withdrawal_fee" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "cheque_book_fee" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "cheque_leaf_fee" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "stop_payment_fee" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "cheque_return_fee" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "passbook_fee" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "statement_fee" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "cheque_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "cheque_default_leaves" integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "cheque_max_books" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "cheque_validity_days" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "gl_liability_account_id" uuid;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "gl_interest_expense_account_id" uuid;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "gl_interest_payable_account_id" uuid;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "gl_fee_income_account_id" uuid;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "gl_penalty_income_account_id" uuid;--> statement-breakpoint
ALTER TABLE "savings_products" ADD COLUMN "gl_cheque_income_account_id" uuid;--> statement-breakpoint
ALTER TABLE "loan_accounts" ADD COLUMN "eligibility_status" text;--> statement-breakpoint
ALTER TABLE "loan_accounts" ADD COLUMN "eligibility_reasons" jsonb;--> statement-breakpoint
ALTER TABLE "loan_accounts" ADD COLUMN "eligibility_override_reason" text;--> statement-breakpoint
ALTER TABLE "loan_collaterals" ADD COLUMN "collateral_type_id" uuid;--> statement-breakpoint
ALTER TABLE "loan_products" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "loan_products" ADD COLUMN "min_membership_months" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "loan_products" ADD COLUMN "min_share_amount" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "loan_products" ADD COLUMN "require_active_savings" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "loan_products" ADD COLUMN "min_savings_balance" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "loan_products" ADD COLUMN "require_verified_kyc" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "loan_products" ADD COLUMN "allow_eligibility_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "loan_products" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "loan_products" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD COLUMN "name_nepali" text;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD COLUMN "normal_balance" text DEFAULT 'debit' NOT NULL;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD COLUMN "allow_posting" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD COLUMN "is_control_account" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD COLUMN "cash_bank_account" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD COLUMN "reconciliation_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD COLUMN "cost_center_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD COLUMN "display_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subsidiary_shares_book" ADD COLUMN "start_kitta_no" integer;--> statement-breakpoint
ALTER TABLE "subsidiary_shares_book" ADD COLUMN "end_kitta_no" integer;--> statement-breakpoint
ALTER TABLE "subsidiary_shares_book" ADD COLUMN "share_type_id" uuid;--> statement-breakpoint
ALTER TABLE "subsidiary_shares_book" ADD COLUMN "share_account_id" uuid;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_kitta_counters" ADD CONSTRAINT "organization_kitta_counters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_share_settings" ADD CONSTRAINT "organization_share_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_account_nominees" ADD CONSTRAINT "share_account_nominees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_account_nominees" ADD CONSTRAINT "share_account_nominees_share_account_id_share_accounts_id_fk" FOREIGN KEY ("share_account_id") REFERENCES "public"."share_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_accounts" ADD CONSTRAINT "share_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_accounts" ADD CONSTRAINT "share_accounts_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dividend_rules" ADD CONSTRAINT "dividend_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_certificate_formats" ADD CONSTRAINT "share_certificate_formats_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_classes" ADD CONSTRAINT "share_classes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_classes" ADD CONSTRAINT "share_classes_gl_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_provisioning_queue" ADD CONSTRAINT "share_provisioning_queue_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_schemes" ADD CONSTRAINT "share_schemes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_schemes" ADD CONSTRAINT "share_schemes_share_class_id_share_classes_id_fk" FOREIGN KEY ("share_class_id") REFERENCES "public"."share_classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_schemes" ADD CONSTRAINT "share_schemes_share_type_id_share_types_id_fk" FOREIGN KEY ("share_type_id") REFERENCES "public"."share_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_cheque_books" ADD CONSTRAINT "savings_cheque_books_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_cheque_books" ADD CONSTRAINT "savings_cheque_books_account_id_savings_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_cheque_deposits" ADD CONSTRAINT "savings_cheque_deposits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_cheque_deposits" ADD CONSTRAINT "savings_cheque_deposits_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_cheque_deposits" ADD CONSTRAINT "savings_cheque_deposits_account_id_savings_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_cheque_deposits" ADD CONSTRAINT "savings_cheque_deposits_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_cheque_leaves" ADD CONSTRAINT "savings_cheque_leaves_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_cheque_leaves" ADD CONSTRAINT "savings_cheque_leaves_book_id_savings_cheque_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."savings_cheque_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_interest_rates" ADD CONSTRAINT "savings_interest_rates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_interest_rates" ADD CONSTRAINT "savings_interest_rates_savings_product_id_savings_products_id_fk" FOREIGN KEY ("savings_product_id") REFERENCES "public"."savings_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_pending_withdrawals" ADD CONSTRAINT "savings_pending_withdrawals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_pending_withdrawals" ADD CONSTRAINT "savings_pending_withdrawals_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_pending_withdrawals" ADD CONSTRAINT "savings_pending_withdrawals_account_id_savings_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_pending_withdrawals" ADD CONSTRAINT "savings_pending_withdrawals_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_provisioning_queue" ADD CONSTRAINT "savings_provisioning_queue_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emi_schedule_settings" ADD CONSTRAINT "emi_schedule_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantor_settings" ADD CONSTRAINT "guarantor_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantor_types" ADD CONSTRAINT "guarantor_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_categories" ADD CONSTRAINT "loan_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_collateral_types" ADD CONSTRAINT "loan_collateral_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_product_eligible_member_categories" ADD CONSTRAINT "loan_product_eligible_member_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_product_eligible_member_categories" ADD CONSTRAINT "loan_product_eligible_member_categories_loan_product_id_loan_products_id_fk" FOREIGN KEY ("loan_product_id") REFERENCES "public"."loan_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_product_eligible_member_categories" ADD CONSTRAINT "loan_product_eligible_member_categories_member_category_id_member_categories_id_fk" FOREIGN KEY ("member_category_id") REFERENCES "public"."member_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_product_eligible_member_types" ADD CONSTRAINT "loan_product_eligible_member_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_product_eligible_member_types" ADD CONSTRAINT "loan_product_eligible_member_types_loan_product_id_loan_products_id_fk" FOREIGN KEY ("loan_product_id") REFERENCES "public"."loan_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_product_eligible_member_types" ADD CONSTRAINT "loan_product_eligible_member_types_member_type_id_member_types_id_fk" FOREIGN KEY ("member_type_id") REFERENCES "public"."member_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_product_guarantor_rules" ADD CONSTRAINT "loan_product_guarantor_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_product_guarantor_rules" ADD CONSTRAINT "loan_product_guarantor_rules_loan_product_id_loan_products_id_fk" FOREIGN KEY ("loan_product_id") REFERENCES "public"."loan_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_product_guarantor_rules" ADD CONSTRAINT "loan_product_guarantor_rules_guarantor_type_id_guarantor_types_id_fk" FOREIGN KEY ("guarantor_type_id") REFERENCES "public"."guarantor_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_product_interest_rates" ADD CONSTRAINT "loan_product_interest_rates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_product_interest_rates" ADD CONSTRAINT "loan_product_interest_rates_loan_product_id_loan_products_id_fk" FOREIGN KEY ("loan_product_id") REFERENCES "public"."loan_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_gl_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banks" ADD CONSTRAINT "banks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_counters" ADD CONSTRAINT "cash_counters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_counters" ADD CONSTRAINT "cash_counters_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_counters" ADD CONSTRAINT "cash_counters_gl_cash_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("gl_cash_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_template_entries" ADD CONSTRAINT "journal_template_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_template_entries" ADD CONSTRAINT "journal_template_entries_template_id_journal_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."journal_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_template_entries" ADD CONSTRAINT "journal_template_entries_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_template_entries" ADD CONSTRAINT "journal_template_entries_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_templates" ADD CONSTRAINT "journal_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_templates" ADD CONSTRAINT "journal_templates_voucher_type_id_voucher_types_id_fk" FOREIGN KEY ("voucher_type_id") REFERENCES "public"."voucher_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_templates" ADD CONSTRAINT "journal_templates_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_gl_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_account_mappings" ADD CONSTRAINT "system_account_mappings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_account_mappings" ADD CONSTRAINT "system_account_mappings_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_type_counters" ADD CONSTRAINT "voucher_type_counters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_type_counters" ADD CONSTRAINT "voucher_type_counters_voucher_type_id_voucher_types_id_fk" FOREIGN KEY ("voucher_type_id") REFERENCES "public"."voucher_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_types" ADD CONSTRAINT "voucher_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_types" ADD CONSTRAINT "voucher_types_default_debit_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_debit_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_types" ADD CONSTRAINT "voucher_types_default_credit_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_credit_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_deletion_logs" ADD CONSTRAINT "audit_deletion_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_books" ADD CONSTRAINT "cheque_books_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_books" ADD CONSTRAINT "cheque_books_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_books" ADD CONSTRAINT "cheque_books_account_id_savings_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_books" ADD CONSTRAINT "cheque_books_account_product_id_savings_products_id_fk" FOREIGN KEY ("account_product_id") REFERENCES "public"."savings_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_bounces" ADD CONSTRAINT "cheque_bounces_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_bounces" ADD CONSTRAINT "cheque_bounces_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_bounces" ADD CONSTRAINT "cheque_bounces_account_id_savings_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_bounces" ADD CONSTRAINT "cheque_bounces_cheque_leaf_id_cheque_leaves_id_fk" FOREIGN KEY ("cheque_leaf_id") REFERENCES "public"."cheque_leaves"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_designs" ADD CONSTRAINT "cheque_designs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_designs" ADD CONSTRAINT "cheque_designs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_leaves" ADD CONSTRAINT "cheque_leaves_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_leaves" ADD CONSTRAINT "cheque_leaves_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_leaves" ADD CONSTRAINT "cheque_leaves_cheque_book_id_cheque_books_id_fk" FOREIGN KEY ("cheque_book_id") REFERENCES "public"."cheque_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_leaves" ADD CONSTRAINT "cheque_leaves_account_id_savings_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_settings" ADD CONSTRAINT "cheque_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_settings" ADD CONSTRAINT "cheque_settings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_settings" ADD CONSTRAINT "cheque_settings_gl_issuance_fee_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("gl_issuance_fee_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_settings" ADD CONSTRAINT "cheque_settings_gl_stop_payment_fee_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("gl_stop_payment_fee_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_settings" ADD CONSTRAINT "cheque_settings_gl_bounce_fee_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("gl_bounce_fee_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_settings" ADD CONSTRAINT "cheque_settings_gl_replacement_fee_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("gl_replacement_fee_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_settings" ADD CONSTRAINT "cheque_settings_gl_other_charges_fee_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("gl_other_charges_fee_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_stop_payments" ADD CONSTRAINT "cheque_stop_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_stop_payments" ADD CONSTRAINT "cheque_stop_payments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_stop_payments" ADD CONSTRAINT "cheque_stop_payments_account_id_savings_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_stop_payments" ADD CONSTRAINT "cheque_stop_payments_cheque_book_id_cheque_books_id_fk" FOREIGN KEY ("cheque_book_id") REFERENCES "public"."cheque_books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_stop_payments" ADD CONSTRAINT "cheque_stop_payments_cheque_leaf_id_cheque_leaves_id_fk" FOREIGN KEY ("cheque_leaf_id") REFERENCES "public"."cheque_leaves"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_signature_specimens" ADD CONSTRAINT "member_signature_specimens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_signature_specimens" ADD CONSTRAINT "member_signature_specimens_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_signature_specimens" ADD CONSTRAINT "member_signature_specimens_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_signature_specimens" ADD CONSTRAINT "member_signature_specimens_account_id_savings_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_withdrawal_instruments" ADD CONSTRAINT "savings_withdrawal_instruments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_withdrawal_instruments" ADD CONSTRAINT "savings_withdrawal_instruments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_withdrawal_instruments" ADD CONSTRAINT "savings_withdrawal_instruments_account_id_savings_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_withdrawal_instruments" ADD CONSTRAINT "savings_withdrawal_instruments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_withdrawal_instruments" ADD CONSTRAINT "savings_withdrawal_instruments_transaction_id_savings_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."savings_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_verification_logs" ADD CONSTRAINT "signature_verification_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_verification_logs" ADD CONSTRAINT "signature_verification_logs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_verification_logs" ADD CONSTRAINT "signature_verification_logs_account_id_savings_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_verification_logs" ADD CONSTRAINT "signature_verification_logs_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_verification_logs" ADD CONSTRAINT "signature_verification_logs_specimen_id_member_signature_specimens_id_fk" FOREIGN KEY ("specimen_id") REFERENCES "public"."member_signature_specimens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_verification_logs" ADD CONSTRAINT "signature_verification_logs_withdrawal_id_savings_transactions_id_fk" FOREIGN KEY ("withdrawal_id") REFERENCES "public"."savings_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "groups_org_code_uniq" ON "groups" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "groups_org_active_idx" ON "groups" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "org_kitta_counter_org_uniq" ON "organization_kitta_counters" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_share_settings_org_idx" ON "organization_share_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "san_org_account_idx" ON "share_account_nominees" USING btree ("organization_id","share_account_id");--> statement-breakpoint
CREATE INDEX "san_org_primary_idx" ON "share_account_nominees" USING btree ("organization_id","is_primary");--> statement-breakpoint
CREATE UNIQUE INDEX "share_account_org_member_uniq" ON "share_accounts" USING btree ("organization_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "share_account_org_no_uniq" ON "share_accounts" USING btree ("organization_id","account_no");--> statement-breakpoint
CREATE INDEX "share_account_org_status_idx" ON "share_accounts" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "dividend_rules_org_code_uniq" ON "dividend_rules" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "dividend_rules_org_active_idx" ON "dividend_rules" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "share_certificate_formats_org_code_uniq" ON "share_certificate_formats" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "share_certificate_formats_org_active_idx" ON "share_certificate_formats" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "share_classes_org_code_uniq" ON "share_classes" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "share_classes_org_active_idx" ON "share_classes" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "share_provisioning_queue_org_member_scheme_uniq" ON "share_provisioning_queue" USING btree ("organization_id","member_id","share_scheme_id");--> statement-breakpoint
CREATE INDEX "share_provisioning_queue_org_status_idx" ON "share_provisioning_queue" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "share_schemes_org_code_uniq" ON "share_schemes" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "share_schemes_org_active_idx" ON "share_schemes" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "share_schemes_org_class_idx" ON "share_schemes" USING btree ("organization_id","share_class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "savings_cheque_books_org_book_no_uniq" ON "savings_cheque_books" USING btree ("organization_id","book_no");--> statement-breakpoint
CREATE INDEX "savings_cheque_books_org_account_idx" ON "savings_cheque_books" USING btree ("organization_id","account_id");--> statement-breakpoint
CREATE INDEX "savings_cheque_dep_org_status_idx" ON "savings_cheque_deposits" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "savings_cheque_dep_org_account_idx" ON "savings_cheque_deposits" USING btree ("organization_id","account_id");--> statement-breakpoint
CREATE INDEX "savings_cheque_dep_org_number_idx" ON "savings_cheque_deposits" USING btree ("organization_id","cheque_number");--> statement-breakpoint
CREATE UNIQUE INDEX "savings_cheque_leaves_org_book_leaf_uniq" ON "savings_cheque_leaves" USING btree ("organization_id","book_id","leaf_no");--> statement-breakpoint
CREATE INDEX "savings_cheque_leaves_org_book_idx" ON "savings_cheque_leaves" USING btree ("organization_id","book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "savings_interest_rates_org_prod_from_uniq" ON "savings_interest_rates" USING btree ("organization_id","savings_product_id","effective_from_bs");--> statement-breakpoint
CREATE INDEX "savings_interest_rates_org_prod_idx" ON "savings_interest_rates" USING btree ("organization_id","savings_product_id");--> statement-breakpoint
CREATE INDEX "savings_pend_wd_org_status_idx" ON "savings_pending_withdrawals" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "savings_pend_wd_org_account_idx" ON "savings_pending_withdrawals" USING btree ("organization_id","account_id");--> statement-breakpoint
CREATE INDEX "savings_pend_wd_org_member_idx" ON "savings_pending_withdrawals" USING btree ("organization_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "savings_provisioning_queue_org_member_product_uniq" ON "savings_provisioning_queue" USING btree ("organization_id","member_id","savings_product_id");--> statement-breakpoint
CREATE INDEX "savings_provisioning_queue_org_status_idx" ON "savings_provisioning_queue" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "emi_schedule_settings_org_uniq" ON "emi_schedule_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guarantor_settings_org_uniq" ON "guarantor_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guarantor_types_org_code_uniq" ON "guarantor_types" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "guarantor_types_org_active_idx" ON "guarantor_types" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "loan_categories_org_code_uniq" ON "loan_categories" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "loan_categories_org_active_idx" ON "loan_categories" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "loan_collateral_types_org_code_uniq" ON "loan_collateral_types" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "loan_collateral_types_org_active_idx" ON "loan_collateral_types" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "loan_prod_elig_cat_uniq" ON "loan_product_eligible_member_categories" USING btree ("organization_id","loan_product_id","member_category_id");--> statement-breakpoint
CREATE INDEX "loan_prod_elig_cat_org_idx" ON "loan_product_eligible_member_categories" USING btree ("organization_id","loan_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loan_prod_elig_type_uniq" ON "loan_product_eligible_member_types" USING btree ("organization_id","loan_product_id","member_type_id");--> statement-breakpoint
CREATE INDEX "loan_prod_elig_type_org_idx" ON "loan_product_eligible_member_types" USING btree ("organization_id","loan_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loan_prod_guarantor_rule_uniq" ON "loan_product_guarantor_rules" USING btree ("organization_id","loan_product_id","guarantor_type_id");--> statement-breakpoint
CREATE INDEX "loan_prod_guarantor_rule_org_idx" ON "loan_product_guarantor_rules" USING btree ("organization_id","loan_product_id");--> statement-breakpoint
CREATE INDEX "loan_prod_rate_org_product_idx" ON "loan_product_interest_rates" USING btree ("organization_id","loan_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_org_no_uniq" ON "bank_accounts" USING btree ("organization_id","account_number");--> statement-breakpoint
CREATE INDEX "bank_accounts_org_bank_idx" ON "bank_accounts" USING btree ("organization_id","bank_id");--> statement-breakpoint
CREATE INDEX "bank_accounts_org_branch_idx" ON "bank_accounts" USING btree ("organization_id","branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "banks_org_code_uniq" ON "banks" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "banks_org_active_idx" ON "banks" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_counters_org_branch_code_uniq" ON "cash_counters" USING btree ("organization_id","branch_id","code");--> statement-breakpoint
CREATE INDEX "cash_counters_org_branch_idx" ON "cash_counters" USING btree ("organization_id","branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cost_centers_org_code_uniq" ON "cost_centers" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "cost_centers_org_branch_idx" ON "cost_centers" USING btree ("organization_id","branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_periods_org_code_uniq" ON "financial_periods" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "financial_periods_org_fy_idx" ON "financial_periods" USING btree ("organization_id","fiscal_year_id");--> statement-breakpoint
CREATE INDEX "financial_periods_org_status_idx" ON "financial_periods" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "jt_entry_org_template_idx" ON "journal_template_entries" USING btree ("organization_id","template_id");--> statement-breakpoint
CREATE INDEX "jt_entry_org_account_idx" ON "journal_template_entries" USING btree ("organization_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_templates_org_code_uniq" ON "journal_templates" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "journal_templates_org_branch_idx" ON "journal_templates" USING btree ("organization_id","branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_org_code_uniq" ON "payment_methods" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "payment_methods_org_type_idx" ON "payment_methods" USING btree ("organization_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "sys_map_org_key_uniq" ON "system_account_mappings" USING btree ("organization_id","mapping_key");--> statement-breakpoint
CREATE INDEX "sys_map_org_account_idx" ON "system_account_mappings" USING btree ("organization_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "voucher_type_counter_uniq" ON "voucher_type_counters" USING btree ("organization_id","voucher_type_id","fiscal_year_code");--> statement-breakpoint
CREATE UNIQUE INDEX "voucher_types_org_code_uniq" ON "voucher_types" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "voucher_types_org_cat_idx" ON "voucher_types" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "audit_deletion_org_entity_idx" ON "audit_deletion_logs" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_deletion_org_date_idx" ON "audit_deletion_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cheque_books_org_book_number_uniq" ON "cheque_books" USING btree ("organization_id","book_number");--> statement-breakpoint
CREATE INDEX "cheque_books_org_account_idx" ON "cheque_books" USING btree ("organization_id","account_id");--> statement-breakpoint
CREATE INDEX "cheque_books_org_branch_idx" ON "cheque_books" USING btree ("organization_id","branch_id");--> statement-breakpoint
CREATE INDEX "cheque_bounces_org_account_idx" ON "cheque_bounces" USING btree ("organization_id","account_id");--> statement-breakpoint
CREATE INDEX "cheque_bounces_org_cheque_idx" ON "cheque_bounces" USING btree ("organization_id","cheque_number");--> statement-breakpoint
CREATE UNIQUE INDEX "cheque_designs_org_code_uniq" ON "cheque_designs" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "cheque_designs_org_active_idx" ON "cheque_designs" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "cheque_leaves_org_number_uniq" ON "cheque_leaves" USING btree ("organization_id","cheque_number");--> statement-breakpoint
CREATE INDEX "cheque_leaves_org_book_idx" ON "cheque_leaves" USING btree ("organization_id","cheque_book_id");--> statement-breakpoint
CREATE INDEX "cheque_leaves_org_account_idx" ON "cheque_leaves" USING btree ("organization_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cheque_settings_org_branch_scope_uniq" ON "cheque_settings" USING btree ("organization_id","branch_id","scope");--> statement-breakpoint
CREATE INDEX "cheque_settings_org_idx" ON "cheque_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cheque_stop_payments_org_account_idx" ON "cheque_stop_payments" USING btree ("organization_id","account_id");--> statement-breakpoint
CREATE INDEX "cheque_stop_payments_org_status_idx" ON "cheque_stop_payments" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "mss_org_member_idx" ON "member_signature_specimens" USING btree ("organization_id","member_id");--> statement-breakpoint
CREATE INDEX "mss_org_account_idx" ON "member_signature_specimens" USING btree ("organization_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "swi_org_type_reference_uniq" ON "savings_withdrawal_instruments" USING btree ("organization_id","type","reference");--> statement-breakpoint
CREATE INDEX "swi_org_account_idx" ON "savings_withdrawal_instruments" USING btree ("organization_id","account_id");--> statement-breakpoint
CREATE INDEX "swi_org_type_date_idx" ON "savings_withdrawal_instruments" USING btree ("organization_id","type","date_bs");--> statement-breakpoint
CREATE INDEX "svl_org_account_idx" ON "signature_verification_logs" USING btree ("organization_id","account_id");--> statement-breakpoint
CREATE INDEX "svl_org_member_idx" ON "signature_verification_logs" USING btree ("organization_id","member_id");--> statement-breakpoint
CREATE INDEX "svl_org_withdrawal_idx" ON "signature_verification_logs" USING btree ("organization_id","withdrawal_id");--> statement-breakpoint
CREATE INDEX "svl_org_created_idx" ON "signature_verification_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
ALTER TABLE "member_family" ADD CONSTRAINT "member_family_nominee_relation_id_relationship_types_id_fk" FOREIGN KEY ("nominee_relation_id") REFERENCES "public"."relationship_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_family" ADD CONSTRAINT "member_family_nominee_type_id_nominee_types_id_fk" FOREIGN KEY ("nominee_type_id") REFERENCES "public"."nominee_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_kyc_profiles" ADD CONSTRAINT "member_kyc_profiles_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_kyc_profiles" ADD CONSTRAINT "member_kyc_profiles_education_level_id_education_levels_id_fk" FOREIGN KEY ("education_level_id") REFERENCES "public"."education_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_member_type_id_member_types_id_fk" FOREIGN KEY ("member_type_id") REFERENCES "public"."member_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_member_category_id_member_categories_id_fk" FOREIGN KEY ("member_category_id") REFERENCES "public"."member_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_collaterals" ADD CONSTRAINT "loan_collaterals_collateral_type_id_loan_collateral_types_id_fk" FOREIGN KEY ("collateral_type_id") REFERENCES "public"."loan_collateral_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_products" ADD CONSTRAINT "loan_products_category_id_loan_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."loan_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsidiary_shares_book" ADD CONSTRAINT "subsidiary_shares_book_share_type_id_share_types_id_fk" FOREIGN KEY ("share_type_id") REFERENCES "public"."share_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsidiary_shares_book" ADD CONSTRAINT "subsidiary_shares_book_share_account_id_share_accounts_id_fk" FOREIGN KEY ("share_account_id") REFERENCES "public"."share_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_family_nominee_relation_idx" ON "member_family" USING btree ("nominee_relation_id");--> statement-breakpoint
CREATE INDEX "member_family_nominee_type_idx" ON "member_family" USING btree ("nominee_type_id");--> statement-breakpoint
CREATE INDEX "member_kyc_occupation_idx" ON "member_kyc_profiles" USING btree ("occupation_id");--> statement-breakpoint
CREATE INDEX "member_kyc_education_idx" ON "member_kyc_profiles" USING btree ("education_level_id");--> statement-breakpoint
CREATE INDEX "members_member_type_idx" ON "members" USING btree ("member_type_id");--> statement-breakpoint
CREATE INDEX "members_member_category_idx" ON "members" USING btree ("member_category_id");--> statement-breakpoint
CREATE INDEX "members_group_idx" ON "members" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_active_member_savings_product" ON "savings_accounts" USING btree ("organization_id","member_id","savings_product_id") WHERE "savings_accounts"."status" = 'Active';--> statement-breakpoint
CREATE INDEX "savings_prod_org_active_idx" ON "savings_products" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "savings_prod_org_category_idx" ON "savings_products" USING btree ("organization_id","product_category");--> statement-breakpoint
CREATE INDEX "loan_prod_org_category_idx" ON "loan_products" USING btree ("organization_id","category_id");--> statement-breakpoint
CREATE INDEX "subs_shares_org_type_idx" ON "subsidiary_shares_book" USING btree ("organization_id","share_type_id");--> statement-breakpoint
ALTER TABLE "member_family" DROP COLUMN "nominee_relation";--> statement-breakpoint
ALTER TABLE "member_kyc_profiles" DROP COLUMN "occupation";--> statement-breakpoint
ALTER TABLE "members" DROP COLUMN "membership_type";--> statement-breakpoint
ALTER TABLE "members" DROP COLUMN "member_category";