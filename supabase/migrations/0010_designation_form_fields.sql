-- Designation form fields: grade & compensation, financial/system rights, hierarchy
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "code" varchar(50);
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "reports_to_id" uuid;
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "job_grade" varchar(50);
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "min_salary" numeric(15, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "max_salary" numeric(15, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "allowance_eligible" boolean DEFAULT false NOT NULL;
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "approval_limit" numeric(15, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "system_access_role" varchar(50);
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "pearls_role" varchar(100);
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "employment_type" varchar(50);
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "description" text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'designations_reports_to_id_designations_id_fk') THEN
    ALTER TABLE "designations" ADD CONSTRAINT "designations_reports_to_id_designations_id_fk" FOREIGN KEY ("reports_to_id") REFERENCES "public"."designations"("id") ON DELETE SET NULL ON UPDATE no action;
  END IF;
END $$;
