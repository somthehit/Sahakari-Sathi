-- Migration: Add CHECK constraints for business rules
-- Priority: MEDIUM - Enforces data integrity at DB level

-- 1. member_family - nomineeSharePct must be 0-100
ALTER TABLE "member_family"
ADD CONSTRAINT "member_family_nominee_share_pct_check"
CHECK ("nomineeSharePct" >= 0 AND "nomineeSharePct" <= 100);

-- 2. cheque_books - leafEnd >= leafStart
ALTER TABLE "cheque_books"
ADD CONSTRAINT "cheque_books_leaf_range_check"
CHECK ("leaf_end" >= "leaf_start");

-- 3. bank_cheque_books - leafEnd >= leafStart
ALTER TABLE "bank_cheque_books"
ADD CONSTRAINT "bank_cheque_books_leaf_range_check"
CHECK ("leaf_end" >= "leaf_start");

-- 4. collection_reconciliation - variance = collected - deposited
-- Note: This is a complex CHECK that references other columns
-- PostgreSQL supports this in CHECK constraints
ALTER TABLE "collection_reconciliation"
ADD CONSTRAINT "collection_reconciliation_variance_check"
CHECK ("variance" = "collected" - "deposited");

-- 5. collection_reconciliation_items - openingBalance + collected = deposited + variance + closingBalance
-- Note: This is a complex CHECK that references other columns
ALTER TABLE "collection_reconciliation_items"
ADD CONSTRAINT "collection_reconciliation_items_balance_check"
CHECK ("opening_balance" + "collected" = "deposited" + "variance" + "closing_balance");

-- 6. voucher_entries - debit and credit cannot both be non-zero
-- (A voucher entry should be either debit or credit, not both)
ALTER TABLE "voucher_entries"
ADD CONSTRAINT "voucher_entries_debit_credit_check"
CHECK (
  ("debit" IS NULL OR "debit" = 0) OR 
  ("credit" IS NULL OR "credit" = 0)
);

-- 7. vouchers - total_debit must equal total_credit
ALTER TABLE "vouchers"
ADD CONSTRAINT "vouchers_debit_credit_equal_check"
CHECK ("total_debit" = "total_credit");

-- 8. loan_schedules - interest_rate must be 0-100
ALTER TABLE "loan_schedules"
ADD CONSTRAINT "loan_schedules_interest_rate_check"
CHECK ("interest_rate" >= 0 AND "interest_rate" <= 100);

-- 9. loan_products - interest_rate must be 0-100
ALTER TABLE "loan_products"
ADD CONSTRAINT "loan_products_interest_rate_check"
CHECK ("interest_rate" >= 0 AND "interest_rate" <= 100);

-- 10. savings_products - interest_rate must be 0-100
ALTER TABLE "savings_products"
ADD CONSTRAINT "savings_products_interest_rate_check"
CHECK ("interest_rate" >= 0 AND "interest_rate" <= 100);

-- 11. dividends - dividend_rate must be 0-100
ALTER TABLE "dividends"
ADD CONSTRAINT "dividends_dividend_rate_check"
CHECK ("dividend_rate" >= 0 AND "dividend_rate" <= 100);

-- 12. agm_votes - vote_count must be >= 0
ALTER TABLE "agm_votes"
ADD CONSTRAINT "agm_votes_vote_count_check"
CHECK ("vote_count" >= 0);

-- 13. agm_polls - total_votes must be >= 0
ALTER TABLE "agm_polls"
ADD CONSTRAINT "agm_polls_total_votes_check"
CHECK ("total_votes" >= 0);

-- 14. agm_polls - votes_for + votes_against + abstentions = total_votes
ALTER TABLE "agm_polls"
ADD CONSTRAINT "agm_polls_vote_sum_check"
CHECK ("votes_for" + "votes_against" + "abstentions" = "total_votes");

-- 15. share_certificates - number_of_shares must be > 0
ALTER TABLE "share_certificates"
ADD CONSTRAINT "share_certificates_number_of_shares_check"
CHECK ("number_of_shares" > 0);

-- 16. share_transactions - shares_transferred must be > 0
ALTER TABLE "share_transactions"
ADD CONSTRAINT "share_transactions_shares_transferred_check"
CHECK ("shares_transferred" > 0);

-- 17. loan_collateral - estimated_value must be >= 0
ALTER TABLE "loan_collateral"
ADD CONSTRAINT "loan_collateral_estimated_value_check"
CHECK ("estimated_value" >= 0);

-- 18. loan_collateral - loan_to_value_ratio must be 0-100
ALTER TABLE "loan_collateral"
ADD CONSTRAINT "loan_collateral_ltv_ratio_check"
CHECK ("loan_to_value_ratio" >= 0 AND "loan_to_value_ratio" <= 100);

-- 19. loan_guarantors - guaranteed_amount must be > 0
ALTER TABLE "loan_guarantors"
ADD CONSTRAINT "loan_guarantors_guaranteed_amount_check"
CHECK ("guaranteed_amount" > 0);

-- 20. loans - loan_amount must be > 0
ALTER TABLE "loans"
ADD CONSTRAINT "loans_loan_amount_check"
CHECK ("loan_amount" > 0);

-- 21. loans - interest_rate must be 0-100
ALTER TABLE "loans"
ADD CONSTRAINT "loans_interest_rate_check"
CHECK ("interest_rate" >= 0 AND "interest_rate" <= 100);

-- 22. loan_repayments - amount must be > 0
ALTER TABLE "loan_repayments"
ADD CONSTRAINT "loan_repayments_amount_check"
CHECK ("amount" > 0);

-- 23. loan_disbursements - amount must be > 0
ALTER TABLE "loan_disbursements"
ADD CONSTRAINT "loan_disbursements_amount_check"
CHECK ("amount" > 0);

-- 24. savings_accounts - balance must be >= 0 (unless overdraft allowed)
-- Note: This is a soft constraint - actual validation should be in app logic
-- ALTER TABLE "savings_accounts"
-- ADD CONSTRAINT "savings_accounts_balance_check"
-- CHECK ("balance" >= 0);

-- 25. member_family - date_of_birth should be in the past
ALTER TABLE "member_family"
ADD CONSTRAINT "member_family_dob_check"
CHECK ("dateOfBirth" <= CURRENT_DATE);

-- 26. members - date_of_birth should be in the past
ALTER TABLE "members"
ADD CONSTRAINT "members_dob_check"
CHECK ("date_of_birth" <= CURRENT_DATE);

-- 27. members - membership_date should be in the past
ALTER TABLE "members"
ADD CONSTRAINT "members_membership_date_check"
CHECK ("membership_date" <= CURRENT_DATE);

-- 28. members - death_date should be in the past (if provided)
ALTER TABLE "members"
ADD CONSTRAINT "members_death_date_check"
CHECK ("death_date" IS NULL OR "death_date" <= CURRENT_DATE);

-- 29. agm_meetings - meeting_date should be in the past
ALTER TABLE "agm_meetings"
ADD CONSTRAINT "agm_meetings_date_check"
CHECK ("meeting_date" <= CURRENT_DATE);

-- 30. agm_notices - notice_date should be in the past
ALTER TABLE "agm_notices"
ADD CONSTRAINT "agm_notices_date_check"
CHECK ("notice_date" <= CURRENT_DATE);

-- 31. agm_notices - meeting_date should be in the future
ALTER TABLE "agm_notices"
ADD CONSTRAINT "agm_notices_meeting_date_check"
CHECK ("meeting_date" > CURRENT_DATE);

-- 32. board_meetings - meeting_date should be in the past
ALTER TABLE "board_meetings"
ADD CONSTRAINT "board_meetings_date_check"
CHECK ("meeting_date" <= CURRENT_DATE);

-- 33. legal_case_events - event_date should be in the past
ALTER TABLE "legal_case_events"
ADD CONSTRAINT "legal_case_events_date_check"
CHECK ("event_date" <= CURRENT_DATE);

-- 34. workflow_transitions - transition_date should be in the past
ALTER TABLE "workflow_transitions"
ADD CONSTRAINT "workflow_transitions_date_check"
CHECK ("transition_date" <= CURRENT_DATE);

-- 35. approval_requests - request_date should be in the past
ALTER TABLE "approval_requests"
ADD CONSTRAINT "approval_requests_date_check"
CHECK ("request_date" <= CURRENT_DATE);

-- 36. approval_requests - response_date should be in the past (if provided)
ALTER TABLE "approval_requests"
ADD CONSTRAINT "approval_requests_response_date_check"
CHECK ("response_date" IS NULL OR "response_date" <= CURRENT_DATE);

-- 37. approval_requests - response_date should be after request_date
ALTER TABLE "approval_requests"
ADD CONSTRAINT "approval_requests_response_after_request_check"
CHECK ("response_date" IS NULL OR "response_date" >= "request_date");

-- 38. collection_transactions - transaction_date should be in the past
ALTER TABLE "collection_transactions"
ADD CONSTRAINT "collection_transactions_date_check"
CHECK ("transaction_date" <= CURRENT_DATE);

-- 39. bank_reconciliation - period_start should be before period_end
ALTER TABLE "bank_reconciliation"
ADD CONSTRAINT "bank_reconciliation_period_check"
CHECK ("period_start" < "period_end");

-- 40. bank_reconciliation - reconciliation_date should be in the past
ALTER TABLE "bank_reconciliation"
ADD CONSTRAINT "bank_reconciliation_date_check"
CHECK ("reconciliation_date" <= CURRENT_DATE);

-- 41. budget_lines - budget_amount must be >= 0
ALTER TABLE "budget_lines"
ADD CONSTRAINT "budget_lines_amount_check"
CHECK ("budget_amount" >= 0);

-- 42. budget_lines - utilized_amount must be >= 0
ALTER TABLE "budget_lines"
ADD CONSTRAINT "budget_lines_utilized_check"
CHECK ("utilized_amount" >= 0);

-- 43. budget_lines - utilized_amount should be <= budget_amount
ALTER TABLE "budget_lines"
ADD CONSTRAINT "budget_lines_utilized_lte_budget_check"
CHECK ("utilized_amount" <= "budget_amount");

-- 44. vouchers - transaction_date should be in the past
ALTER TABLE "vouchers"
ADD CONSTRAINT "vouchers_date_check"
CHECK ("transaction_date" <= CURRENT_DATE);

-- 45. vouchers - posting_date should be in the past
ALTER TABLE "vouchers"
ADD CONSTRAINT "vouchers_posting_date_check"
CHECK ("posting_date" <= CURRENT_DATE);

-- 46. cash_books - transaction_date should be in the past
ALTER TABLE "cash_books"
ADD CONSTRAINT "cash_books_date_check"
CHECK ("transaction_date" <= CURRENT_DATE);

-- 47. bank_books - transaction_date should be in the past
ALTER TABLE "bank_books"
ADD CONSTRAINT "bank_books_date_check"
CHECK ("transaction_date" <= CURRENT_DATE);

-- 48. journals - transaction_date should be in the past
ALTER TABLE "journals"
ADD CONSTRAINT "journals_date_check"
CHECK ("transaction_date" <= CURRENT_DATE);

-- 49. fixed_assets - purchase_date should be in the past
ALTER TABLE "fixed_assets"
ADD CONSTRAINT "fixed_assets_purchase_date_check"
CHECK ("purchase_date" <= CURRENT_DATE);

-- 50. fixed_assets - depreciation_rate must be 0-100
ALTER TABLE "fixed_assets"
ADD CONSTRAINT "fixed_assets_depreciation_rate_check"
CHECK ("depreciation_rate" >= 0 AND "depreciation_rate" <= 100);

-- 51. fixed_assets - useful_life_years must be > 0
ALTER TABLE "fixed_assets"
ADD CONSTRAINT "fixed_assets_useful_life_check"
CHECK ("useful_life_years" > 0);

-- 52. fixed_assets - salvage_value must be >= 0
ALTER TABLE "fixed_assets"
ADD CONSTRAINT "fixed_assets_salvage_value_check"
CHECK ("salvage_value" >= 0);

-- 53. fixed_assets - current_value must be >= 0
ALTER TABLE "fixed_assets"
ADD CONSTRAINT "fixed_assets_current_value_check"
CHECK ("current_value" >= 0);

-- 54. legal_cases - case_date should be in the past
ALTER TABLE "legal_cases"
ADD CONSTRAINT "legal_cases_date_check"
CHECK ("case_date" <= CURRENT_DATE);

-- 55. legal_cases - resolution_date should be in the past (if provided)
ALTER TABLE "legal_cases"
ADD CONSTRAINT "legal_cases_resolution_date_check"
CHECK ("resolution_date" IS NULL OR "resolution_date" <= CURRENT_DATE);

-- 56. legal_cases - resolution_date should be after case_date
ALTER TABLE "legal_cases"
ADD CONSTRAINT "legal_cases_resolution_after_case_check"
CHECK ("resolution_date" IS NULL OR "resolution_date" >= "case_date");

-- 57. loan_repayment_schedules - due_date should be in the past
ALTER TABLE "loan_repayment_schedules"
ADD CONSTRAINT "loan_repayment_schedules_due_date_check"
CHECK ("due_date" <= CURRENT_DATE);

-- 58. loan_repayment_schedules - amount_due must be > 0
ALTER TABLE "loan_repayment_schedules"
ADD CONSTRAINT "loan_repayment_schedules_amount_check"
CHECK ("amount_due" > 0);

-- 59. loan_repayment_schedules - interest_rate must be 0-100
ALTER TABLE "loan_repayment_schedules"
ADD CONSTRAINT "loan_repayment_schedules_interest_rate_check"
CHECK ("interest_rate" >= 0 AND "interest_rate" <= 100);

-- 60. loan_repayment_schedules - principal_due must be >= 0
ALTER TABLE "loan_repayment_schedules"
ADD CONSTRAINT "loan_repayment_schedules_principal_due_check"
CHECK ("principal_due" >= 0);

-- 61. loan_repayment_schedules - interest_due must be >= 0
ALTER TABLE "loan_repayment_schedules"
ADD CONSTRAINT "loan_repayment_schedules_interest_due_check"
CHECK ("interest_due" >= 0);

-- 62. loan_repayment_schedules - penalty_due must be >= 0
ALTER TABLE "loan_repayment_schedules"
ADD CONSTRAINT "loan_repayment_schedules_penalty_due_check"
CHECK ("penalty_due" >= 0);

-- 63. loan_repayment_schedules - amount_paid must be >= 0
ALTER TABLE "loan_repayment_schedules"
ADD CONSTRAINT "loan_repayment_schedules_amount_paid_check"
CHECK ("amount_paid" >= 0);

-- 64. loan_repayment_schedules - amount_paid should be <= amount_due
ALTER TABLE "loan_repayment_schedules"
ADD CONSTRAINT "loan_repayment_schedules_paid_lte_due_check"
CHECK ("amount_paid" <= "amount_due");

-- 65. overdrafts - overdraft_limit must be > 0
ALTER TABLE "overdrafts"
ADD CONSTRAINT "overdrafts_limit_check"
CHECK ("overdraft_limit" > 0);

-- 66. overdrafts - utilized_amount must be >= 0
ALTER TABLE "overdrafts"
ADD CONSTRAINT "overdrafts_utilized_check"
CHECK ("utilized_amount" >= 0);

-- 67. overdrafts - utilized_amount should be <= overdraft_limit
ALTER TABLE "overdrafts"
ADD CONSTRAINT "overdrafts_utilized_lte_limit_check"
CHECK ("utilized_amount" <= "overdraft_limit");

-- 68. overdraft_interest_config - interest_rate must be 0-100
ALTER TABLE "overdraft_interest_config"
ADD CONSTRAINT "overdraft_interest_config_rate_check"
CHECK ("interest_rate" >= 0 AND "interest_rate" <= 100);

-- 69. overdraft_breach_log - breach_amount must be > 0
ALTER TABLE "overdraft_breach_log"
ADD CONSTRAINT "overdraft_breach_log_amount_check"
CHECK ("breach_amount" > 0);

-- 70. overdraft_repayment_schedules - repayment_amount must be > 0
ALTER TABLE "overdraft_repayment_schedules"
ADD CONSTRAINT "overdraft_repayment_schedules_amount_check"
CHECK ("repayment_amount" > 0);

-- 71. overdraft_repayment_schedules - amount_paid must be >= 0
ALTER TABLE "overdraft_repayment_schedules"
ADD CONSTRAINT "overdraft_repayment_schedules_paid_check"
CHECK ("amount_paid" >= 0);

-- 72. overdraft_repayment_schedules - amount_paid should be <= repayment_amount
ALTER TABLE "overdraft_repayment_schedules"
ADD CONSTRAINT "overdraft_repayment_schedules_paid_lte_amount_check"
CHECK ("amount_paid" <= "repayment_amount");

-- 73. bank_account_opening_balance - opening_balance must be >= 0
ALTER TABLE "bank_account_opening_balance"
ADD CONSTRAINT "bank_account_opening_balance_check"
CHECK ("opening_balance" >= 0);

-- 74. accounting_settings - interest_receivable_account_id should not equal interest_income_account_id
-- Note: This is a complex CHECK that references other columns
-- PostgreSQL supports this in CHECK constraints
ALTER TABLE "accounting_settings"
ADD CONSTRAINT "accounting_settings_different_accounts_check"
CHECK ("interest_receivable_account_id" != "interest_income_account_id");

-- 75. accounting_settings - loan_fine_account_id should not equal other accounts
ALTER TABLE "accounting_settings"
ADD CONSTRAINT "accounting_settings_different_fine_account_check"
CHECK ("loan_fine_account_id" != "interest_income_account_id");

-- 76. accounting_settings - loan_product_interest_income_account_id should not equal loan_product_principal_account_id
ALTER TABLE "accounting_settings"
ADD CONSTRAINT "accounting_settings_different_product_accounts_check"
CHECK ("loan_product_interest_income_account_id" != "loan_product_principal_account_id");

-- 77. cash_variance_log - collected_amount must be >= 0
ALTER TABLE "cash_variance_log"
ADD CONSTRAINT "cash_variance_log_collected_check"
CHECK ("collected_amount" >= 0);

-- 78. cash_variance_log - deposited_amount must be >= 0
ALTER TABLE "cash_variance_log"
ADD CONSTRAINT "cash_variance_log_deposited_check"
CHECK ("deposited_amount" >= 0);

-- 79. cash_variance_log - variance_amount must be >= 0
ALTER TABLE "cash_variance_log"
ADD CONSTRAINT "cash_variance_log_variance_check"
CHECK ("variance_amount" >= 0);

-- 80. cash_variance_log - total_amount must be >= 0
ALTER TABLE "cash_variance_log"
ADD CONSTRAINT "cash_variance_log_total_check"
CHECK ("total_amount" >= 0);

-- 81. cash_variance_log - 15pct_amount must be >= 0
ALTER TABLE "cash_variance_log"
ADD CONSTRAINT "cash_variance_log_15pct_check"
CHECK ("15pct_amount" >= 0);

-- 82. cash_variance_log - 85pct_amount must be >= 0
ALTER TABLE "cash_variance_log"
ADD CONSTRAINT "cash_variance_log_85pct_check"
CHECK ("85pct_amount" >= 0);

-- 83. bank_reconciliation_audit - opening_balance must be >= 0
ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_opening_check"
CHECK ("opening_balance" >= 0);

-- 84. bank_reconciliation_audit - closing_balance must be >= 0
ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_closing_check"
CHECK ("closing_balance" >= 0);

-- 85. bank_reconciliation_audit - total_debits must be >= 0
ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_debits_check"
CHECK ("total_debits" >= 0);

-- 86. bank_reconciliation_audit - total_credits must be >= 0
ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_credits_check"
CHECK ("total_credits" >= 0);

-- 87. bank_reconciliation_audit - uncleared_checks must be >= 0
ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_uncleared_checks_check"
CHECK ("uncleared_checks" >= 0);

-- 88. bank_reconciliation_audit - uncleared_deposits must be >= 0
ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_uncleared_deposits_check"
CHECK ("uncleared_deposits" >= 0);

-- 89. bank_reconciliation_audit - book_adjustments must be >= 0
ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_book_adjustments_check"
CHECK ("book_adjustments" >= 0);

-- 90. bank_reconciliation_audit - bank_adjustments must be >= 0
ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_bank_adjustments_check"
CHECK ("bank_adjustments" >= 0);

-- 91. bank_reconciliation_audit - computed_balance must be >= 0
ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_computed_check"
CHECK ("computed_balance" >= 0);

-- 92. bank_reconciliation_audit - balance_difference must be >= 0
ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_difference_check"
CHECK ("balance_difference" >= 0);

-- 93. bank_reconciliation_audit - adjustment_count must be >= 0
ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_adjustment_count_check"
CHECK ("adjustment_count" >= 0);

-- 94. bank_reconciliation_audit - risk_score must be 0-100
ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_risk_score_check"
CHECK ("risk_score" >= 0 AND "risk_score" <= 100);

-- 95. bank_reconciliation_audit - confidence_score must be 0-100
ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_confidence_score_check"
CHECK ("confidence_score" >= 0 AND "confidence_score" <= 100);

-- 96. bank_reconciliation_audit - recommendation_confidence must be 0-100
ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_recommendation_confidence_check"
CHECK ("recommendation_confidence" >= 0 AND "recommendation_confidence" <= 100);

-- 97. bank_reconciliation_audit - processing_time_ms must be >= 0
ALTER TABLE "bank_reconciliation_audit"
ADD CONSTRAINT "bank_reconciliation_audit_processing_time_check"
CHECK ("processing_time_ms" >= 0);

-- 98. bank_reconciliation_audit - book_balance_must_match_bank
-- This is a complex CHECK that ensures book balance matches bank balance
-- Note: This is a business rule that may need to be enforced at app level
-- ALTER TABLE "bank_reconciliation_audit"
-- ADD CONSTRAINT "bank_reconciliation_audit_balance_match_check"
-- CHECK ("book_balance" = "bank_balance");

-- 99. bank_reconciliation_audit - bank_balance_must_match_statement
-- This is a complex CHECK that ensures bank balance matches statement
-- Note: This is a business rule that may need to be enforced at app level
-- ALTER TABLE "bank_reconciliation_audit"
-- ADD CONSTRAINT "bank_reconciliation_audit_statement_match_check"
-- CHECK ("bank_balance" = "statement_balance");

-- 100. bank_reconciliation_audit - actual_balance_must_match_book
-- This is a complex CHECK that ensures actual balance matches book
-- Note: This is a business rule that may need to be enforced at app level
-- ALTER TABLE "bank_reconciliation_audit"
-- ADD CONSTRAINT "bank_reconciliation_audit_actual_match_book_check"
-- CHECK ("actual_balance" = "book_balance");