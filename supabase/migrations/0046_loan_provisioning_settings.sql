-- 0046: Loan provisioning policy (NPL classification bands + provision rates)
-- ---------------------------------------------------------------------
-- The loan schema already carried loan_accounts.npl_status and
-- loan_accounts.provision_amount, but nothing in the codebase ever set them:
-- there was no arrears engine, and no table defining WHEN a loan becomes
-- Watchlist / Substandard / Doubtful / Loss, or what percentage of the
-- outstanding principal must be provisioned in each band. Both columns
-- therefore sat at their defaults ('Pass', 0) for every loan in the portfolio,
-- so the NPL ratio and provisioning figures a co-operative reports were
-- structurally unable to be anything but zero.
--
-- This table supplies that missing policy, one row per organization.
--
-- WHY THIS IS CONFIGURATION AND NOT CODE
-- The regulator's classification thresholds change, and a co-operative may
-- hold itself to stricter internal policy than the statutory minimum. Baking
-- "91 days = Substandard" or "50% provision" into the servicing engine would
-- mean a rule change needs a code deploy, and would leave two installations
-- unable to follow different policies. Every band and percentage is read from
-- this row at classification time; nothing in the engine hardcodes one.
--
-- The DEFAULTS below (31 / 91 / 181 / 366 days and 1 / 5 / 25 / 50 / 100 %)
-- reflect the commonly applied Nepali SACCOS classification pattern and exist
-- so a fresh organization classifies sensibly before anyone visits the setup
-- screen. They are a starting point for the operator to confirm against their
-- own regulator's current directive -- not an assertion of what the law
-- requires today.
--
-- Bands are inclusive lower bounds on days overdue and are validated
-- server-side to be strictly increasing, because a policy where Doubtful began
-- before Substandard would classify loans into whichever band the engine
-- happened to test first.
--
-- Additive and idempotent: safe to re-run.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS loan_provisioning_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Days-overdue lower bound at which a loan enters each band.
  watchlist_min_days integer NOT NULL DEFAULT 31,
  substandard_min_days integer NOT NULL DEFAULT 91,
  doubtful_min_days integer NOT NULL DEFAULT 181,
  loss_min_days integer NOT NULL DEFAULT 366,

  -- Provision rate applied to the outstanding principal, per band (percent).
  pass_provision_percent numeric(6, 3) NOT NULL DEFAULT '1',
  watchlist_provision_percent numeric(6, 3) NOT NULL DEFAULT '5',
  substandard_provision_percent numeric(6, 3) NOT NULL DEFAULT '25',
  doubtful_provision_percent numeric(6, 3) NOT NULL DEFAULT '50',
  loss_provision_percent numeric(6, 3) NOT NULL DEFAULT '100',

  -- Days after an installment's due date before penalty begins to accrue.
  -- 0 means penalty accrues from the first day late.
  penalty_grace_days integer NOT NULL DEFAULT 0,

  -- When true, an arrears accrual run also rewrites npl_status and
  -- provision_amount. When false, classification only happens on an explicit
  -- classification run, so an operator can accrue penalties without
  -- re-grading the portfolio mid-period.
  auto_classify_on_accrual boolean NOT NULL DEFAULT true,

  updated_by uuid,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- The servicing layer upserts this row lazily on first use and relies on the
-- one-row-per-org guarantee to do so without racing itself. The UNIQUE on
-- organization_id above already provides the index; this named index matches
-- the Drizzle schema declaration so drizzle-kit does not see a drift.
CREATE UNIQUE INDEX IF NOT EXISTS loan_provisioning_settings_org_uniq
  ON loan_provisioning_settings (organization_id);

COMMENT ON TABLE loan_provisioning_settings IS
  'Per-organization NPL classification bands and provision percentages. Read by the loan servicing engine at classification time; never hardcoded in application code.';
