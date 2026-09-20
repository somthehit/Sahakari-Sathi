-- =============================================================
-- 0022: Groups (operational community groups — Member Settings)
-- Standalone org-scoped resource: savings-and-credit groups (समूह)
-- that members may later be assigned to when Member Type = "Group".
-- Recurring monthly meeting schedule + capacity cap (max_members).
-- =============================================================

CREATE TABLE IF NOT EXISTS "groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
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
CREATE UNIQUE INDEX IF NOT EXISTS "groups_org_code_uniq" ON "groups" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "groups_org_active_idx" ON "groups" ("organization_id", "is_active");
