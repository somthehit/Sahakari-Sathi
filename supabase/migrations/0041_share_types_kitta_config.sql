-- 0041: Per-share-type Kitta (कित्ता) configuration
-- ---------------------------------------------------------------------
-- Embeds the distinctive kitta-sequence configuration INSIDE share_types
-- (the "embedded approach") so an operator never mixes ranges up between
-- share classes:
--
--   kitta_prefix           display prefix, e.g. 'RR-'  (default '')
--   kitta_start_base       optional first kitta for this class, e.g. 500001
--   current_kitta_pointer  last kitta allocated for this class (0 = none yet)
--   max_allowed_kitta      approved kitta ceiling (audit standard), nullable
--   auto_sequence          auto-allocate the next free kitta on ISSUE
--
-- The pointer is bumped inside the issue DB transaction under a row lock
-- (SELECT ... FOR UPDATE) so two simultaneous issuers never receive
-- duplicate kitta numbers.
-- ---------------------------------------------------------------------

ALTER TABLE share_types
  ADD COLUMN IF NOT EXISTS kitta_prefix text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS kitta_start_base integer,
  ADD COLUMN IF NOT EXISTS current_kitta_pointer integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_allowed_kitta integer,
  ADD COLUMN IF NOT EXISTS auto_sequence boolean NOT NULL DEFAULT true;

-- Backfill the per-class pointer from the org-wide counter so fresh issues
-- continue above every kitta already handed out (legacy convention: the org
-- pointer is 1000 + total shares). Admins can then tune each class.
UPDATE share_types st
SET current_kitta_pointer = okc.last_kitta_no
FROM organization_kitta_counters okc
WHERE okc.organization_id = st.organization_id
  AND st.current_kitta_pointer = 0;