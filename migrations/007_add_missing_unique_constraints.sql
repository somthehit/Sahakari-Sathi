-- Migration: Add missing unique constraints
-- Priority: HIGH - Enforces business rules at DB level

-- 1. member_kyc_profiles - Unique (org, citizenship_no)
-- Prevents duplicate KYC records for same citizenship number in an org
ALTER TABLE "member_kyc_profiles"
ADD CONSTRAINT "member_kyc_org_citizenship_unique"
UNIQUE ("organization_id", "citizenship_number");

-- 2. report_templates - Unique (org, code)
-- Ensures template codes are unique per org
ALTER TABLE "report_templates"
ADD CONSTRAINT "report_templates_org_code_unique"
UNIQUE ("organization_id", "code");

-- 3. share_certificates - Unique (org, share_number)
-- Prevents duplicate share certificates
ALTER TABLE "share_certificates"
ADD CONSTRAINT "share_certificates_org_number_unique"
UNIQUE ("organization_id", "share_number");

-- 4. workflow_definitions - Unique (org, code)
-- Ensures workflow codes are unique per org
ALTER TABLE "workflow_definitions"
ADD CONSTRAINT "workflow_definitions_org_code_unique"
UNIQUE ("organization_id", "code");

-- 5. workflow_states - Unique (workflow_id, code)
-- Ensures state codes are unique per workflow
ALTER TABLE "workflow_states"
ADD CONSTRAINT "workflow_states_workflow_code_unique"
UNIQUE ("workflow_id", "code");

-- 6. workflow_transitions - Unique (workflow_id, from_state_id, to_state_id, event)
-- Prevents duplicate transitions
ALTER TABLE "workflow_transitions"
ADD CONSTRAINT "workflow_transitions_unique"
UNIQUE ("workflow_id", "from_state_id", "to_state_id", "event");

-- 7. approval_templates - Unique (org, code)
-- Ensures approval template codes are unique per org
ALTER TABLE "approval_templates"
ADD CONSTRAINT "approval_templates_org_code_unique"
UNIQUE ("organization_id", "code");

-- 8. bank_reconciliation - Unique (org, account_id, period_start, period_end)
-- Prevents duplicate reconciliation for same period
ALTER TABLE "bank_reconciliation"
ADD CONSTRAINT "bank_reconciliation_org_account_period_unique"
UNIQUE ("organization_id", "account_id", "period_start", "period_end");

-- 9. collection_reconciliation - Unique (org, collection_session_id, agent_id)
-- Prevents duplicate reconciliation per session per agent
ALTER TABLE "collection_reconciliation"
ADD CONSTRAINT "collection_reconciliation_org_session_agent_unique"
UNIQUE ("organization_id", "collection_session_id", "agent_id");

-- 10. collection_sessions - Unique (org, session_date, agent_id)
-- Prevents duplicate sessions for same agent on same date
ALTER TABLE "collection_sessions"
ADD CONSTRAINT "collection_sessions_org_date_agent_unique"
UNIQUE ("organization_id", "session_date", "agent_id");

-- 11. organizational_units - Unique (org, code)
-- Ensures unit codes are unique per org
ALTER TABLE "organizational_units"
ADD CONSTRAINT "organizational_units_org_code_unique"
UNIQUE ("organization_id", "code");

-- 12. inventory - Unique (org, code)
-- Ensures inventory codes are unique per org
ALTER TABLE "inventory"
ADD CONSTRAINT "inventory_org_code_unique"
UNIQUE ("organization_id", "code");

-- 13. warehouses - Unique (org, code)
-- Ensures warehouse codes are unique per org
ALTER TABLE "warehouses"
ADD CONSTRAINT "warehouses_org_code_unique"
UNIQUE ("organization_id", "code");

-- 14. fee_categories - Unique (org, code)
-- Ensures fee category codes are unique per org
ALTER TABLE "fee_categories"
ADD CONSTRAINT "fee_categories_org_code_unique"
UNIQUE ("organization_id", "code");

-- 15. fee_groups - Unique (org, code)
-- Ensures fee group codes are unique per org
ALTER TABLE "fee_groups"
ADD CONSTRAINT "fee_groups_org_code_unique"
UNIQUE ("organization_id", "code");

-- 16. chart_of_accounts - Unique (org, code)
-- Ensures account codes are unique per org
ALTER TABLE "chart_of_accounts"
ADD CONSTRAINT "chart_of_accounts_org_code_unique"
UNIQUE ("organization_id", "code");

-- 17. designations - Unique (org, code)
-- Ensures designation codes are unique per org
ALTER TABLE "designations"
ADD CONSTRAINT "designations_org_code_unique"
UNIQUE ("organization_id", "code");

-- 18. departments - Unique (org, code)
-- Ensures department codes are unique per org
ALTER TABLE "departments"
ADD CONSTRAINT "departments_org_code_unique"
UNIQUE ("organization_id", "code");

-- 19. organizational_unit_designations - Unique (unit_id, designation_id)
-- Prevents duplicate designation assignments to same unit
ALTER TABLE "organizational_unit_designations"
ADD CONSTRAINT "org_unit_designations_unique"
UNIQUE ("organizational_unit_id", "designation_id");

-- 20. document_templates - Unique (org, code)
-- Ensures document template codes are unique per org
ALTER TABLE "document_templates"
ADD CONSTRAINT "document_templates_org_code_unique"
UNIQUE ("organization_id", "code");

-- 21. legal_templates - Unique (org, code)
-- Ensures legal template codes are unique per org
ALTER TABLE "legal_templates"
ADD CONSTRAINT "legal_templates_org_code_unique"
UNIQUE ("organization_id", "code");

-- 22. sub_types - Unique (org, code)
-- Ensures sub-type codes are unique per org
ALTER TABLE "sub_types"
ADD CONSTRAINT "sub_types_org_code_unique"
UNIQUE ("organization_id", "code");

-- 23. advance_sub_types - Unique (org, code)
-- Ensures advance sub-type codes are unique per org
ALTER TABLE "advance_sub_types"
ADD CONSTRAINT "advance_sub_types_org_code_unique"
UNIQUE ("organization_id", "code");

-- 24. advance_types - Unique (org, code)
-- Ensures advance type codes are unique per org
ALTER TABLE "advance_types"
ADD CONSTRAINT "advance_types_org_code_unique"
UNIQUE ("organization_id", "code");

-- 25. interest_templates - Unique (org, code)
-- Ensures interest template codes are unique per org
ALTER TABLE "interest_templates"
ADD CONSTRAINT "interest_templates_org_code_unique"
UNIQUE ("organization_id", "code");

-- 26. interest_rules - Unique (org, code)
-- Ensures interest rule codes are unique per org
ALTER TABLE "interest_rules"
ADD CONSTRAINT "interest_rules_org_code_unique"
UNIQUE ("organization_id", "code");

-- 27. loan_products - Unique (org, code)
-- Ensures loan product codes are unique per org
ALTER TABLE "loan_products"
ADD CONSTRAINT "loan_products_org_code_unique"
UNIQUE ("organization_id", "code");

-- 28. savings_products - Unique (org, code)
-- Ensures savings product codes are unique per org
ALTER TABLE "savings_products"
ADD CONSTRAINT "savings_products_org_code_unique"
UNIQUE ("organization_id", "code");

-- 29. fine_rates - Unique (org, code)
-- Ensures fine rate codes are unique per org
ALTER TABLE "fine_rates"
ADD CONSTRAINT "fine_rates_org_code_unique"
UNIQUE ("organization_id", "code");

-- 30. campaigns - Unique (org, code)
-- Ensures campaign codes are unique per org
ALTER TABLE "campaigns"
ADD CONSTRAINT "campaigns_org_code_unique"
UNIQUE ("organization_id", "code");

-- 31. bank_accounts - Unique (org, code)
-- Ensures bank account codes are unique per org
ALTER TABLE "bank_accounts"
ADD CONSTRAINT "bank_accounts_org_code_unique"
UNIQUE ("organization_id", "code");

-- 32. cheque_books - Unique (org, cheque_number_start, cheque_number_end)
-- Prevents overlapping cheque book ranges
ALTER TABLE "cheque_books"
ADD CONSTRAINT "cheque_books_org_range_unique"
UNIQUE ("organization_id", "cheque_number_start", "cheque_number_end");

-- 33. bank_cheque_books - Unique (org, cheque_number_start, cheque_number_end)
-- Prevents overlapping cheque book ranges
ALTER TABLE "bank_cheque_books"
ADD CONSTRAINT "bank_cheque_books_org_range_unique"
UNIQUE ("organization_id", "cheque_number_start", "cheque_number_end");

-- 34. cash_flow_sub_categories - Unique (org, code)
-- Ensures sub-category codes are unique per org
ALTER TABLE "cash_flow_sub_categories"
ADD CONSTRAINT "cash_flow_sub_categories_org_code_unique"
UNIQUE ("organization_id", "code");

-- 35. office_locations - Unique (org, code)
-- Ensures office location codes are unique per org
ALTER TABLE "office_locations"
ADD CONSTRAINT "office_locations_org_code_unique"
UNIQUE ("organization_id", "code");

-- 36. circulars - Unique (org, number)
-- Ensures circular numbers are unique per org
ALTER TABLE "circulars"
ADD CONSTRAINT "circulars_org_number_unique"
UNIQUE ("organization_id", "number");

-- 37. agreements - Unique (org, number)
-- Ensures agreement numbers are unique per org
ALTER TABLE "agreements"
ADD CONSTRAINT "agreements_org_number_unique"
UNIQUE ("organization_id", "number");

-- 38. loan_limit - Unique (org, member_id)
-- Ensures one limit per member per org
ALTER TABLE "loan_LIMIT"
ADD CONSTRAINT "loan_limit_org_member_unique"
UNIQUE ("organization_id", "member_id");

-- 39. member_portal_settings - Unique (org, member_id)
-- Ensures one portal settings record per member per org
ALTER TABLE "member_portal_settings"
ADD CONSTRAINT "member_portal_settings_org_member_unique"
UNIQUE ("organization_id", "member_id");

-- 40. member_biometrics - Unique (org, member_id)
-- Ensures one biometrics record per member per org
ALTER TABLE "member_biometrics"
ADD CONSTRAINT "member_biometrics_org_member_unique"
UNIQUE ("organization_id", "member_id");

-- 41. replenishment_limit_setting - Unique (org, designation_id, replenishment_type)
-- Ensures one limit per designation per type per org
ALTER TABLE "replenishment_limit_setting"
ADD CONSTRAINT "replenishment_limit_org_designation_type_unique"
UNIQUE ("organization_id", "designation_id", "replenishment_type");