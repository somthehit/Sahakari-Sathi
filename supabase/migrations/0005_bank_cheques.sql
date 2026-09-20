CREATE TABLE "organization_security_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"min_password_length" integer DEFAULT 8 NOT NULL,
	"require_special_char" boolean DEFAULT true NOT NULL,
	"require_number" boolean DEFAULT true NOT NULL,
	"require_uppercase" boolean DEFAULT true NOT NULL,
	"require_lowercase" boolean DEFAULT true NOT NULL,
	"password_expiry_days" integer DEFAULT 90 NOT NULL,
	"session_timeout_minutes" integer DEFAULT 15 NOT NULL,
	"enforce_2fa" boolean DEFAULT false NOT NULL,
	"ip_whitelist" text,
	"ip_whitelist_enabled" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_security_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "loan_provisioning_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"watchlist_min_days" integer DEFAULT 31 NOT NULL,
	"substandard_min_days" integer DEFAULT 91 NOT NULL,
	"doubtful_min_days" integer DEFAULT 181 NOT NULL,
	"loss_min_days" integer DEFAULT 366 NOT NULL,
	"pass_provision_percent" numeric(6, 3) DEFAULT '1' NOT NULL,
	"watchlist_provision_percent" numeric(6, 3) DEFAULT '5' NOT NULL,
	"substandard_provision_percent" numeric(6, 3) DEFAULT '25' NOT NULL,
	"doubtful_provision_percent" numeric(6, 3) DEFAULT '50' NOT NULL,
	"loss_provision_percent" numeric(6, 3) DEFAULT '100' NOT NULL,
	"penalty_grace_days" integer DEFAULT 0 NOT NULL,
	"auto_classify_on_accrual" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_cheque_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"bank_account_id" uuid NOT NULL,
	"book_number" text NOT NULL,
	"prefix" text,
	"leaf_start_number" integer NOT NULL,
	"leaf_end_number" integer NOT NULL,
	"leaf_count" integer DEFAULT 25 NOT NULL,
	"issued_date_bs" text NOT NULL,
	"issued_date_ad" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"issued_by_id" uuid,
	"purpose" text,
	"cancel_reason" text,
	"cancelled_by_id" uuid,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_cheque_leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cheque_book_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"cheque_number" text NOT NULL,
	"leaf_no" integer NOT NULL,
	"status" text DEFAULT 'unused' NOT NULL,
	"payee_name" text,
	"amount" numeric(15, 2),
	"cheque_date_bs" text,
	"cheque_date_ad" text,
	"loan_id" uuid,
	"voucher_id" uuid,
	"used_at" timestamp,
	"cancel_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passbook_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"account_id" uuid NOT NULL,
	"serial" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"lines_per_page" integer DEFAULT 30 NOT NULL,
	"page_count" integer DEFAULT 20 NOT NULL,
	"capacity" integer DEFAULT 600 NOT NULL,
	"lines_used" integer DEFAULT 0 NOT NULL,
	"issued_date_bs" text,
	"issued_date_ad" text,
	"closed_date_bs" text,
	"previous_book_id" uuid,
	"replaced_by_book_id" uuid,
	"issuance_reason" text DEFAULT 'new' NOT NULL,
	"issued_by" uuid,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passbook_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"mode" text DEFAULT 'booklet' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"width_mm" numeric(6, 2) DEFAULT '105' NOT NULL,
	"height_mm" numeric(6, 2) DEFAULT '165' NOT NULL,
	"config_json" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passbook_print_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"account_id" uuid NOT NULL,
	"book_id" uuid,
	"design_id" uuid,
	"mode" text DEFAULT 'booklet' NOT NULL,
	"status" text DEFAULT 'printed' NOT NULL,
	"from_txn_id" uuid,
	"to_txn_id" uuid,
	"txn_count" integer DEFAULT 0 NOT NULL,
	"start_line" integer DEFAULT 0 NOT NULL,
	"end_line" integer DEFAULT 0 NOT NULL,
	"lines_printed" integer DEFAULT 0 NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"from_date_bs" text,
	"to_date_bs" text,
	"printed_by" uuid,
	"printed_by_name" text,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_province_id_provinces_id_fk";
--> statement-breakpoint
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_district_id_districts_id_fk";
--> statement-breakpoint
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_municipality_id_municipalities_id_fk";
--> statement-breakpoint
DROP INDEX "organizations_province_idx";--> statement-breakpoint
DROP INDEX "organizations_district_idx";--> statement-breakpoint
DROP INDEX "organizations_municipality_idx";--> statement-breakpoint
ALTER TABLE "share_classes" ALTER COLUMN "target_member_type" SET DEFAULT 'ALL';--> statement-breakpoint
ALTER TABLE "organization_security_settings" ADD CONSTRAINT "organization_security_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_provisioning_settings" ADD CONSTRAINT "loan_provisioning_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_cheque_books" ADD CONSTRAINT "bank_cheque_books_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_cheque_books" ADD CONSTRAINT "bank_cheque_books_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_cheque_books" ADD CONSTRAINT "bank_cheque_books_bank_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_cheque_leaves" ADD CONSTRAINT "bank_cheque_leaves_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_cheque_leaves" ADD CONSTRAINT "bank_cheque_leaves_cheque_book_id_bank_cheque_books_id_fk" FOREIGN KEY ("cheque_book_id") REFERENCES "public"."bank_cheque_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_cheque_leaves" ADD CONSTRAINT "bank_cheque_leaves_bank_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passbook_books" ADD CONSTRAINT "passbook_books_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passbook_books" ADD CONSTRAINT "passbook_books_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passbook_books" ADD CONSTRAINT "passbook_books_account_id_savings_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passbook_designs" ADD CONSTRAINT "passbook_designs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passbook_designs" ADD CONSTRAINT "passbook_designs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passbook_print_log" ADD CONSTRAINT "passbook_print_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passbook_print_log" ADD CONSTRAINT "passbook_print_log_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passbook_print_log" ADD CONSTRAINT "passbook_print_log_account_id_savings_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passbook_print_log" ADD CONSTRAINT "passbook_print_log_book_id_passbook_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."passbook_books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "loan_provisioning_settings_org_uniq" ON "loan_provisioning_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_cheque_books_org_book_number_uniq" ON "bank_cheque_books" USING btree ("organization_id","book_number");--> statement-breakpoint
CREATE INDEX "bank_cheque_books_org_bank_account_idx" ON "bank_cheque_books" USING btree ("organization_id","bank_account_id");--> statement-breakpoint
CREATE INDEX "bank_cheque_books_org_branch_idx" ON "bank_cheque_books" USING btree ("organization_id","branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_cheque_leaves_org_number_uniq" ON "bank_cheque_leaves" USING btree ("organization_id","cheque_number");--> statement-breakpoint
CREATE INDEX "bank_cheque_leaves_org_book_idx" ON "bank_cheque_leaves" USING btree ("organization_id","cheque_book_id");--> statement-breakpoint
CREATE INDEX "bank_cheque_leaves_org_bank_account_idx" ON "bank_cheque_leaves" USING btree ("organization_id","bank_account_id");--> statement-breakpoint
CREATE INDEX "bank_cheque_leaves_org_status_idx" ON "bank_cheque_leaves" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "passbook_books_org_serial_uniq" ON "passbook_books" USING btree ("organization_id","serial");--> statement-breakpoint
CREATE INDEX "passbook_books_org_account_idx" ON "passbook_books" USING btree ("organization_id","account_id");--> statement-breakpoint
CREATE INDEX "passbook_books_org_status_idx" ON "passbook_books" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "passbook_designs_org_code_uniq" ON "passbook_designs" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "passbook_designs_org_active_idx" ON "passbook_designs" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "passbook_print_log_org_account_idx" ON "passbook_print_log" USING btree ("organization_id","account_id","created_at");--> statement-breakpoint
CREATE INDEX "passbook_print_log_org_book_idx" ON "passbook_print_log" USING btree ("organization_id","book_id");--> statement-breakpoint
ALTER TABLE "share_provisioning_queue" ADD CONSTRAINT "share_provisioning_queue_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_provisioning_queue" ADD CONSTRAINT "share_provisioning_queue_share_scheme_id_share_schemes_id_fk" FOREIGN KEY ("share_scheme_id") REFERENCES "public"."share_schemes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_provisioning_queue" ADD CONSTRAINT "savings_provisioning_queue_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_provisioning_queue" ADD CONSTRAINT "savings_provisioning_queue_savings_product_id_savings_products_id_fk" FOREIGN KEY ("savings_product_id") REFERENCES "public"."savings_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "province_id";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "district_id";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "municipality_id";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "ward_no";