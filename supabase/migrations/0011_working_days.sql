-- Working days & hours setup (per-weekday, org-scoped)
CREATE TABLE IF NOT EXISTS "working_days" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "day_of_week" integer NOT NULL,
  "is_working_day" boolean DEFAULT true NOT NULL,
  "open_time" time,
  "close_time" time,
  "half_day" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "working_days_org_day_idx" ON "working_days" ("organization_id", "day_of_week");
