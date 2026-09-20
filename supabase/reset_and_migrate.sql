-- ============================================================
-- FULL RESET SCRIPT
-- Run this in Supabase Dashboard → SQL Editor
-- Then run: npm run db:migrate
-- ============================================================

-- Step 1: Drop all tables in public schema (tenant + global)
DROP TABLE IF EXISTS
  ai_usage_logs, ai_feedback, ai_messages, ai_conversations,
  dashboard_preferences, dashboard_widgets,
  file_metadata, attachments, documents,
  report_exports, report_templates,
  sms_logs, email_logs, notifications, notification_templates,
  activity_logs, customer_tickets, audit_logs, approval_requests,
  collection_reconciliation, collection_transactions, collection_routes, collection_agents,
  stock_adjustments, purchase_items, purchase_orders, suppliers,
  inventory_stock, inventory_transactions, inventory_products, inventory_categories, warehouses,
  maintenance_records, asset_transfers, depreciation_entries, fixed_assets, asset_categories,
  balance_sheets, income_statements, trial_balances, ledgers, journals,
  bank_books, cash_books, budget_lines, budgets,
  voucher_entries, vouchers, chart_of_accounts, account_groups,
  loan_writeoffs, loan_reschedules, loan_penalties, loan_repayments,
  emi_schedules, guarantors, loan_collaterals, loan_accounts, loan_products,
  interest_postings, savings_transactions, savings_accounts, savings_products,
  share_certificates, share_transactions, share_holdings, share_types,
  staff_documents, payroll, leave_requests, attendance,
  member_biometrics, member_documents, member_portal_settings,
  member_family, member_financial_profiles, member_kyc_profiles, members,
  fiscal_years, branches,
  user_security_answers, security_questions, org_users, employees,
  designations, departments, roles, email_queue,
  organization_limits, organization_profiles, organization_subscriptions,
  organizations, super_admins, auth_audit_logs,
  wards, municipalities, districts, provinces
CASCADE;

-- Step 2: Drop enums
DROP TYPE IF EXISTS
  email_queue_status, employee_status, org_status,
  subscription_status, user_status
CASCADE;

-- Step 3: Clear drizzle migration tracking so it re-applies from scratch
DELETE FROM drizzle.__drizzle_migrations;

-- ============================================================
-- After running this, go back to terminal and run:
--   npm run db:migrate
-- ============================================================
