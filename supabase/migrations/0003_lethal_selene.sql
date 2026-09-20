CREATE TABLE "working_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"is_working_day" boolean DEFAULT true NOT NULL,
	"open_time" time,
	"close_time" time,
	"half_day" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"base_currency" text DEFAULT 'USD' NOT NULL,
	"target_currency" text DEFAULT 'NPR' NOT NULL,
	"buy_rate" numeric(12, 4) NOT NULL,
	"sell_rate" numeric(12, 4) NOT NULL,
	"official_middle_rate" numeric(12, 4) NOT NULL,
	"effective_date" date DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"currency" text DEFAULT 'NPR' NOT NULL,
	"original_amount" numeric(15, 2) NOT NULL,
	"exchange_rate" numeric(12, 4) DEFAULT '1.0000' NOT NULL,
	"forex_markup_percent" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"effective_exchange_rate" numeric(12, 4) GENERATED ALWAYS AS (exchange_rate * (1 + (forex_markup_percent / 100))) STORED,
	"base_amount_npr" numeric(15, 2) NOT NULL,
	"tax_percent" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"tax_amount_npr" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"total_amount_npr" numeric(15, 2) NOT NULL,
	"status" text DEFAULT 'Completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_financial_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"default_currency" text DEFAULT 'NPR' NOT NULL,
	"allowed_currencies" text[] DEFAULT '{"NPR","USD"}' NOT NULL,
	"default_forex_markup_percent" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"is_tax_enabled" boolean DEFAULT false NOT NULL,
	"tax_name" text DEFAULT 'GST' NOT NULL,
	"default_tax_rate_percent" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"tax_number" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_localization_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"default_language" text DEFAULT 'ne' NOT NULL,
	"supported_languages" text[] DEFAULT '{"ne","en"}' NOT NULL,
	"primary_calendar_system" text DEFAULT 'BS' NOT NULL,
	"date_display_format" text DEFAULT 'YYYY-MM-DD' NOT NULL,
	"number_format_style" text DEFAULT 'IN' NOT NULL,
	"currency_symbol" text DEFAULT 'रु.' NOT NULL,
	"currency_symbol_position" text DEFAULT 'prefix' NOT NULL,
	"enable_auto_transliteration" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education_levels" (
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
CREATE TABLE "member_categories" (
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
CREATE TABLE "member_statuses" (
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
CREATE TABLE "member_types" (
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
	"min_share_units" integer DEFAULT 0 NOT NULL,
	"entrance_fee" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"share_value_per_unit" numeric(12, 2) DEFAULT '0.00' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nominee_types" (
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
CREATE TABLE "occupations" (
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
CREATE TABLE "relationship_types" (
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
CREATE TABLE "share_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"transfer_no" text NOT NULL,
	"voucher_id" uuid,
	"voucher_no" text NOT NULL,
	"certificate_no" text,
	"from_holding_id" uuid NOT NULL,
	"from_member_id" uuid NOT NULL,
	"from_member_name" text NOT NULL,
	"from_member_no" text NOT NULL,
	"to_holding_id" uuid NOT NULL,
	"to_member_id" uuid NOT NULL,
	"to_member_name" text NOT NULL,
	"to_member_no" text NOT NULL,
	"share_type_id" uuid NOT NULL,
	"share_type_name" text NOT NULL,
	"face_value_per_share" numeric(10, 2) NOT NULL,
	"number_of_shares" integer NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"date_bs" text NOT NULL,
	"date_ad" text NOT NULL,
	"status" text DEFAULT 'Completed' NOT NULL,
	"remarks" text,
	"processed_by" text NOT NULL,
	"branch_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subsidiary_loans_book" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"loan_account_no" text NOT NULL,
	"voucher_no" text NOT NULL,
	"transaction_date_bs" text NOT NULL,
	"principal_debit" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"principal_credit" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"interest_credit" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"penalty_credit" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"remaining_principal" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subsidiary_savings_book" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"account_no" text NOT NULL,
	"account_type" text NOT NULL,
	"voucher_no" text NOT NULL,
	"transaction_date_bs" text NOT NULL,
	"debit_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"credit_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"balance_amount" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subsidiary_shares_book" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"voucher_no" text NOT NULL,
	"transaction_date_bs" text NOT NULL,
	"transaction_type" text NOT NULL,
	"share_quantity" integer NOT NULL,
	"face_value" numeric(15, 2) DEFAULT '100.00' NOT NULL,
	"debit_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"credit_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"balance_amount" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"level_no" integer NOT NULL,
	"role_key" text NOT NULL,
	"role_label" text NOT NULL,
	"min_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"max_amount" numeric(15, 2),
	"scope" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_matrix" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_type" text NOT NULL,
	"threshold_min" numeric(15, 2) DEFAULT '0' NOT NULL,
	"threshold_max" numeric(15, 2),
	"signatory1_role" text NOT NULL,
	"signatory2_role" text,
	"sms_notify" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_approval_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"module_key" text NOT NULL,
	"min_amount" numeric(15, 2),
	"max_amount" numeric(15, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_users" ADD COLUMN "active_branch_id" uuid;--> statement-breakpoint
ALTER TABLE "member_family" ADD COLUMN "father_name_nepali" text;--> statement-breakpoint
ALTER TABLE "member_family" ADD COLUMN "mother_name_nepali" text;--> statement-breakpoint
ALTER TABLE "member_family" ADD COLUMN "grandfather_name_nepali" text;--> statement-breakpoint
ALTER TABLE "member_family" ADD COLUMN "spouse_name_nepali" text;--> statement-breakpoint
ALTER TABLE "member_family" ADD COLUMN "guardian_name_nepali" text;--> statement-breakpoint
ALTER TABLE "member_family" ADD COLUMN "nominee_name_nepali" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "old_value" jsonb;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "new_value" jsonb;--> statement-breakpoint
ALTER TABLE "working_days" ADD CONSTRAINT "working_days_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_transactions" ADD CONSTRAINT "member_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_transactions" ADD CONSTRAINT "member_transactions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_financial_settings" ADD CONSTRAINT "organization_financial_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_localization_settings" ADD CONSTRAINT "organization_localization_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_levels" ADD CONSTRAINT "education_levels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_categories" ADD CONSTRAINT "member_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_statuses" ADD CONSTRAINT "member_statuses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_types" ADD CONSTRAINT "member_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nominee_types" ADD CONSTRAINT "nominee_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupations" ADD CONSTRAINT "occupations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_types" ADD CONSTRAINT "relationship_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_transfers" ADD CONSTRAINT "share_transfers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_transfers" ADD CONSTRAINT "share_transfers_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_transfers" ADD CONSTRAINT "share_transfers_from_holding_id_share_holdings_id_fk" FOREIGN KEY ("from_holding_id") REFERENCES "public"."share_holdings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_transfers" ADD CONSTRAINT "share_transfers_from_member_id_members_id_fk" FOREIGN KEY ("from_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_transfers" ADD CONSTRAINT "share_transfers_to_holding_id_share_holdings_id_fk" FOREIGN KEY ("to_holding_id") REFERENCES "public"."share_holdings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_transfers" ADD CONSTRAINT "share_transfers_to_member_id_members_id_fk" FOREIGN KEY ("to_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_transfers" ADD CONSTRAINT "share_transfers_share_type_id_share_types_id_fk" FOREIGN KEY ("share_type_id") REFERENCES "public"."share_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_transfers" ADD CONSTRAINT "share_transfers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsidiary_loans_book" ADD CONSTRAINT "subsidiary_loans_book_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsidiary_loans_book" ADD CONSTRAINT "subsidiary_loans_book_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsidiary_savings_book" ADD CONSTRAINT "subsidiary_savings_book_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsidiary_savings_book" ADD CONSTRAINT "subsidiary_savings_book_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsidiary_shares_book" ADD CONSTRAINT "subsidiary_shares_book_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsidiary_shares_book" ADD CONSTRAINT "subsidiary_shares_book_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_levels" ADD CONSTRAINT "approval_levels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_matrix" ADD CONSTRAINT "approval_matrix_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_approval_limits" ADD CONSTRAINT "role_approval_limits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_approval_limits" ADD CONSTRAINT "role_approval_limits_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "working_days_org_day_idx" ON "working_days" USING btree ("organization_id","day_of_week");--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rates_org_date_pair_uniq" ON "exchange_rates" USING btree ("organization_id","base_currency","target_currency","effective_date");--> statement-breakpoint
CREATE INDEX "idx_exchange_rates_lookup" ON "exchange_rates" USING btree ("organization_id","base_currency","target_currency","effective_date");--> statement-breakpoint
CREATE INDEX "idx_member_transactions_org_member_created" ON "member_transactions" USING btree ("organization_id","member_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "education_levels_org_code_uniq" ON "education_levels" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "education_levels_org_active_idx" ON "education_levels" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "member_categories_org_code_uniq" ON "member_categories" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "member_categories_org_active_idx" ON "member_categories" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "member_statuses_org_code_uniq" ON "member_statuses" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "member_statuses_org_active_idx" ON "member_statuses" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "member_types_org_code_uniq" ON "member_types" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "member_types_org_active_idx" ON "member_types" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "nominee_types_org_code_uniq" ON "nominee_types" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "nominee_types_org_active_idx" ON "nominee_types" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "occupations_org_code_uniq" ON "occupations" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "occupations_org_active_idx" ON "occupations" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "relationship_types_org_code_uniq" ON "relationship_types" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "relationship_types_org_active_idx" ON "relationship_types" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "share_transfer_org_no_uniq" ON "share_transfers" USING btree ("organization_id","transfer_no");--> statement-breakpoint
CREATE INDEX "share_transfer_org_date_idx" ON "share_transfers" USING btree ("organization_id","date_bs");--> statement-breakpoint
CREATE INDEX "share_transfer_org_from_idx" ON "share_transfers" USING btree ("organization_id","from_member_id");--> statement-breakpoint
CREATE INDEX "share_transfer_org_to_idx" ON "share_transfers" USING btree ("organization_id","to_member_id");--> statement-breakpoint
CREATE INDEX "subs_loan_org_member_idx" ON "subsidiary_loans_book" USING btree ("organization_id","member_id");--> statement-breakpoint
CREATE INDEX "subs_loan_member_acct_date_idx" ON "subsidiary_loans_book" USING btree ("member_id","loan_account_no","transaction_date_bs");--> statement-breakpoint
CREATE INDEX "subs_sav_org_member_idx" ON "subsidiary_savings_book" USING btree ("organization_id","member_id");--> statement-breakpoint
CREATE INDEX "subs_sav_member_acct_date_idx" ON "subsidiary_savings_book" USING btree ("member_id","account_no","transaction_date_bs");--> statement-breakpoint
CREATE INDEX "subs_shares_org_member_idx" ON "subsidiary_shares_book" USING btree ("organization_id","member_id");--> statement-breakpoint
CREATE INDEX "subs_shares_member_date_idx" ON "subsidiary_shares_book" USING btree ("member_id","transaction_date_bs");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_levels_org_no_uniq" ON "approval_levels" USING btree ("organization_id","level_no");--> statement-breakpoint
CREATE INDEX "approval_levels_org_idx" ON "approval_levels" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "approval_matrix_org_type_idx" ON "approval_matrix" USING btree ("organization_id","request_type");--> statement-breakpoint
CREATE UNIQUE INDEX "role_approval_limits_role_module_uniq" ON "role_approval_limits" USING btree ("role_id","module_key");--> statement-breakpoint
CREATE INDEX "role_approval_limits_org_idx" ON "role_approval_limits" USING btree ("organization_id");