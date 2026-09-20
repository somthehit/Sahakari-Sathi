-- Migration: Add notification settings tables
-- Priority: HIGH - Required for per-organization notification credentials

-- =============================================
-- ORGANIZATION NOTIFICATION SETTINGS
-- Per-org SMS/Email/WhatsApp credentials with platform fallback
-- =============================================
CREATE TABLE IF NOT EXISTS "org_notification_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  
  -- SMS Configuration
  "sms_provider" varchar(50),
  "sms_api_key" varchar(255),
  "sms_sender_id" varchar(50),
  "sms_enabled" boolean NOT NULL DEFAULT false,
  
  -- Email Configuration
  "smtp_host" varchar(255),
  "smtp_port" integer DEFAULT 587,
  "smtp_user" varchar(255),
  "smtp_pass" varchar(255),
  "smtp_from_name" varchar(100),
  "smtp_from_email" varchar(255),
  "smtp_secure" boolean NOT NULL DEFAULT true,
  "email_enabled" boolean NOT NULL DEFAULT false,
  
  -- WhatsApp Configuration
  "whatsapp_provider" varchar(50),
  "whatsapp_api_key" varchar(255),
  "whatsapp_api_secret" varchar(255),
  "whatsapp_phone_number_id" varchar(100),
  "whatsapp_business_account_id" varchar(100),
  "whatsapp_access_token" text,
  "whatsapp_enabled" boolean NOT NULL DEFAULT false,
  
  -- Fallback Configuration
  "use_platform_credentials" boolean NOT NULL DEFAULT true,
  
  -- Credit Balances
  "sms_credit_balance" integer DEFAULT 0,
  "sms_credit_updated_at" timestamp,
  "whatsapp_credit_balance" integer DEFAULT 0,
  "whatsapp_credit_updated_at" timestamp,
  
  -- Metadata
  "created_by" varchar(100),
  "updated_by" varchar(100),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Index for organization lookup
CREATE INDEX IF NOT EXISTS "org_notif_settings_org_idx" ON "org_notification_settings"("organization_id");

-- Unique constraint for organization
CREATE UNIQUE INDEX IF NOT EXISTS "org_notif_settings_org_unique" ON "org_notification_settings"("organization_id");


-- =============================================
-- REMINDER RULES
-- Automated reminder scheduling configuration
-- =============================================
CREATE TABLE IF NOT EXISTS "reminder_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  
  -- Rule Configuration
  "code" varchar(50) NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  
  -- Trigger Configuration
  "trigger_type" varchar(50) NOT NULL,
  "trigger_days" integer,
  "trigger_time" varchar(8),
  
  -- Event Type
  "event_type" varchar(50) NOT NULL,
  
  -- Channels
  "send_sms" boolean NOT NULL DEFAULT true,
  "send_email" boolean NOT NULL DEFAULT false,
  "send_whatsapp" boolean NOT NULL DEFAULT false,
  "send_in_app" boolean NOT NULL DEFAULT true,
  
  -- Template Reference
  "sms_template_code" varchar(50),
  "email_template_code" varchar(50),
  "whatsapp_template_code" varchar(50),
  
  -- Recipients
  "recipient_type" varchar(50) NOT NULL DEFAULT 'member',
  "custom_recipient_ids" text,
  
  -- Scheduling
  "is_active" boolean NOT NULL DEFAULT true,
  "last_run_at" timestamp,
  "next_run_at" timestamp,
  
  -- Metadata
  "created_by" varchar(100),
  "updated_by" varchar(100),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Indexes for reminder rules
CREATE INDEX IF NOT EXISTS "reminder_rules_org_idx" ON "reminder_rules"("organization_id");
CREATE INDEX IF NOT EXISTS "reminder_rules_active_idx" ON "reminder_rules"("is_active");
CREATE INDEX IF NOT EXISTS "reminder_rules_next_run_idx" ON "reminder_rules"("next_run_at");

-- Unique constraint for organization + code
CREATE UNIQUE INDEX IF NOT EXISTS "reminder_rules_org_code_unique" ON "reminder_rules"("organization_id", "code");


-- =============================================
-- NOTIFICATION CATEGORIES
-- Predefined categories for organizing templates
-- =============================================
CREATE TABLE IF NOT EXISTS "notification_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "code" varchar(50) NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Index for organization lookup
CREATE INDEX IF NOT EXISTS "notif_categories_org_idx" ON "notification_categories"("organization_id");


-- =============================================
-- ENHANCE NOTIFICATION TEMPLATES
-- Add new columns for full customization
-- =============================================

-- Add category column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_templates' AND column_name = 'category'
  ) THEN
    ALTER TABLE "notification_templates" ADD COLUMN "category" varchar(50);
  END IF;
END $$;

-- Add variables column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_templates' AND column_name = 'variables'
  ) THEN
    ALTER TABLE "notification_templates" ADD COLUMN "variables" jsonb;
  END IF;
END $$;

-- Add language column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_templates' AND column_name = 'language'
  ) THEN
    ALTER TABLE "notification_templates" ADD COLUMN "language" varchar(10) DEFAULT 'en';
  END IF;
END $$;

-- Add is_system column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_templates' AND column_name = 'is_system'
  ) THEN
    ALTER TABLE "notification_templates" ADD COLUMN "is_system" boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add usage_count column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_templates' AND column_name = 'usage_count'
  ) THEN
    ALTER TABLE "notification_templates" ADD COLUMN "usage_count" integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add last_used_at column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_templates' AND column_name = 'last_used_at'
  ) THEN
    ALTER TABLE "notification_templates" ADD COLUMN "last_used_at" timestamp;
  END IF;
END $$;

-- Add created_by column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_templates' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE "notification_templates" ADD COLUMN "created_by" varchar(100);
  END IF;
END $$;

-- Add updated_by column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_templates' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE "notification_templates" ADD COLUMN "updated_by" varchar(100);
  END IF;
END $$;

-- Add category index if not exists
CREATE INDEX IF NOT EXISTS "notif_tmpl_org_category_idx" ON "notification_templates"("organization_id", "category");


-- =============================================
-- SEED DEFAULT NOTIFICATION CATEGORIES
-- =============================================
INSERT INTO "notification_categories" ("organization_id", "code", "name", "description", "sort_order") 
SELECT 
  o.id,
  cat.code,
  cat.name,
  cat.description,
  cat.sort_order
FROM "organizations" o
CROSS JOIN (
  VALUES 
    ('transaction', 'Transaction Alerts', 'Deposit, withdrawal, and transfer alerts', 1),
    ('account', 'Account Notifications', 'Account opening, closing, and status updates', 2),
    ('loan', 'Loan Notifications', 'Loan approval, disbursement, and EMI reminders', 3),
    ('share', 'Share Notifications', 'Share issuance, transfer, and dividend alerts', 4),
    ('system', 'System Notifications', 'Platform updates and maintenance notices', 5),
    ('security', 'Security Alerts', 'Login alerts and security warnings', 6)
) AS cat(code, name, description, sort_order)
ON CONFLICT DO NOTHING;


-- =============================================
-- SEED DEFAULT NOTIFICATION TEMPLATES
-- =============================================
INSERT INTO "notification_templates" (
  "organization_id", "code", "channel", "category", "subject", "body_template", 
  "variables", "is_system", "is_active"
)
SELECT 
  o.id,
  tmpl.code,
  tmpl.channel,
  tmpl.category,
  tmpl.subject,
  tmpl.body_template,
  tmpl.variables::jsonb,
  true,
  true
FROM "organizations" o
CROSS JOIN (
  VALUES 
    ('DEPOSIT_ALERT', 'SMS', 'transaction', NULL, 
     'Dear {MEMBER_NAME}, NPR {AMOUNT} deposited into account {ACCOUNT_NO}. Balance: NPR {BALANCE}. - SAHAKARI SATHI',
     '["MEMBER_NAME", "AMOUNT", "ACCOUNT_NO", "BALANCE"]'),
    ('WITHDRAWAL_ALERT', 'SMS', 'transaction', NULL, 
     'Dear {MEMBER_NAME}, NPR {AMOUNT} withdrawn from account {ACCOUNT_NO}. Balance: NPR {BALANCE}. - SAHAKARI SATHI',
     '["MEMBER_NAME", "AMOUNT", "ACCOUNT_NO", "BALANCE"]'),
    ('EMI_REMINDER', 'SMS', 'loan', NULL, 
     'Dear {MEMBER_NAME}, loan EMI of NPR {EMI_AMOUNT} is due on {DUE_DATE}. Please deposit in time to avoid penalty.',
     '["MEMBER_NAME", "EMI_AMOUNT", "DUE_DATE"]'),
    ('OTP_VERIFICATION', 'SMS', 'security', NULL, 
     'Your Sahakari Sathi security OTP for {PURPOSE} is {OTP_CODE}. Valid for 5 minutes. Do not share this code.',
     '["PURPOSE", "OTP_CODE"]'),
    ('LOAN_APPROVED', 'Email', 'loan', 'Loan Approved - {LOAN_ACCOUNT_NO}', 
     'Dear {MEMBER_NAME}, your loan application for NPR {LOAN_AMOUNT} has been approved. Loan Account: {LOAN_ACCOUNT_NO}',
     '["MEMBER_NAME", "LOAN_AMOUNT", "LOAN_ACCOUNT_NO"]'),
    ('SHARE_ISSUED', 'Email', 'share', 'Share Certificate Issued', 
     'Dear {MEMBER_NAME}, {NUMBER_OF_SHARES} shares have been issued to you. Certificate No: {CERTIFICATE_NO}',
     '["MEMBER_NAME", "NUMBER_OF_SHARES", "CERTIFICATE_NO"]'),
    ('DEPOSIT_ALERT_WHATSAPP', 'WhatsApp', 'transaction', NULL, 
     'Dear {MEMBER_NAME}, NPR {AMOUNT} deposited into account {ACCOUNT_NO}. Balance: NPR {BALANCE}. - SAHAKARI SATHI',
     '["MEMBER_NAME", "AMOUNT", "ACCOUNT_NO", "BALANCE"]'),
    ('WITHDRAWAL_ALERT_WHATSAPP', 'WhatsApp', 'transaction', NULL, 
     'Dear {MEMBER_NAME}, NPR {AMOUNT} withdrawn from account {ACCOUNT_NO}. Balance: NPR {BALANCE}. - SAHAKARI SATHI',
     '["MEMBER_NAME", "AMOUNT", "ACCOUNT_NO", "BALANCE"]'),
    ('EMI_REMINDER_WHATSAPP', 'WhatsApp', 'loan', NULL, 
     'Dear {MEMBER_NAME}, loan EMI of NPR {EMI_AMOUNT} is due on {DUE_DATE}. Please deposit in time to avoid penalty.',
     '["MEMBER_NAME", "EMI_AMOUNT", "DUE_DATE"]')
) AS tmpl(code, channel, category, subject, body_template, variables)
ON CONFLICT DO NOTHING;


-- =============================================
-- WHATSAPP LOGS TABLE
-- Track WhatsApp message delivery
-- =============================================
CREATE TABLE IF NOT EXISTS "whatsapp_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "template_code" varchar(50),
  "to_phone" varchar(50) NOT NULL,
  "body" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'Pending',
  "provider" varchar(50),
  "provider_message_id" varchar(255),
  "attempt_count" integer NOT NULL DEFAULT 0,
  "sent_at" timestamp,
  "delivered_at" timestamp,
  "read_at" timestamp,
  "error_message" text,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Indexes for WhatsApp logs
CREATE INDEX IF NOT EXISTS "whatsapp_logs_org_idx" ON "whatsapp_logs"("organization_id");
CREATE INDEX IF NOT EXISTS "whatsapp_logs_status_idx" ON "whatsapp_logs"("status");
CREATE INDEX IF NOT EXISTS "whatsapp_logs_created_at_idx" ON "whatsapp_logs"("created_at");