/**
 * Database Schema Index
 * Central export for all Drizzle table definitions.
 *
 * Multi-tenancy rule: every tenant table carries
 *   organization_id NOT NULL → organizations(id)
 *
 * Global platform tables (NO organization_id):
 *   super_admins, provinces, districts, municipalities, wards
 */

// ── Core ─────────────────────────────────────────────────────────────────────
export * from './masterData';   // provinces, districts, municipalities, wards
export * from './auth';         // organizations, org_users, employees, roles, departments, designations …
export * from './branches';     // branches, fiscal_years

// ── Currency & Forex ─────────────────────────────────────────────────────────
export * from './currency';     // exchange_rates, organization_financial_settings, member_transactions

// ── Localization ─────────────────────────────────────────────────────────────
export * from './localization'; // organization_localization_settings

// ── Members ──────────────────────────────────────────────────────────────────
export * from './members';      // members, member_kyc_profiles, member_financial_profiles, member_family …

// ── Member Settings (Module 3) ───────────────────────────────────────────────
export * from './memberSettings'; // member_types, member_categories, occupations, education_levels,
                                   // nominee_types, relationship_types, member_statuses
export * from './groups';         // groups (operational community groups, NOT a lookup)

// ── HR ───────────────────────────────────────────────────────────────────────
export * from './hr';           // attendance, leave_requests, payroll, staff_documents

// ── Shares ───────────────────────────────────────────────────────────────────
export * from './shares';       // share_types, share_holdings, share_transactions, share_certificates

// ── Share Settings (SETUPS → Share Settings) ────────────────────────────────
export * from './shareSettings'; // share_classes, share_schemes, dividend_rules,
                                 // share_certificate_formats, share_provisioning_queue

// ── Savings ──────────────────────────────────────────────────────────────────
export * from './savings';      // savings_products, savings_accounts, savings_transactions, interest_postings

// ── Loans ────────────────────────────────────────────────────────────────────
export * from './loans';        // loan_products, loan_accounts, loan_collaterals, guarantors,
                                // emi_schedules, loan_repayments, loan_penalties,
                                // loan_reschedules, loan_writeoffs
export * from './loanApplications'; // loan_applications, loan_guarantors,
                                     // loan_documents, loan_document_templates

// ── Accounting ───────────────────────────────────────────────────────────────
export * from './accounting';   // account_groups, chart_of_accounts, vouchers, voucher_entries,
                                // journals, ledgers, trial_balances, balance_sheets,
                                // income_statements, cash_books, bank_books, budgets, budget_lines

// ── Accounting Settings ──────────────────────────────────────────────────────
export * from './accountingSettings'; // voucher_types, voucher_type_counters, cost_centers,
                                      // journal_templates, journal_template_entries,
                                      // financial_periods, banks, bank_accounts, cash_counters,
                                      // payment_methods, system_account_mappings

// ── Subsidiary Ledgers ───────────────────────────────────────────────────────
export * from './subsidiary';   // subsidiary_shares_book, subsidiary_savings_book,
                                // subsidiary_loans_book (member-wise sub-books linked to GL by voucher_no)

// ── Fixed Assets ─────────────────────────────────────────────────────────────
export * from './assets';       // asset_categories, fixed_assets, depreciation_entries,
                                // asset_transfers, maintenance_records

// ── Inventory ────────────────────────────────────────────────────────────────
export * from './inventory';    // warehouses, inventory_categories, inventory_products,
                                // inventory_stock, inventory_transactions,
                                // suppliers, purchase_orders, purchase_items, stock_adjustments

// ── Collection ───────────────────────────────────────────────────────────────
export * from './collection';   // collection_agents, collection_routes,
                                // collection_transactions, collection_reconciliation

// ── Workflow & Approvals ─────────────────────────────────────────────────────
export * from './workflow';     // approval_levels, approval_matrix, role_approval_limits

// ── Operations ───────────────────────────────────────────────────────────────
export * from './operations';   // approval_requests, audit_logs,
                                // customer_tickets, ai_chat_history

// ── Audit Deletion (immutable hard-delete trail) ─────────────────────────────
export * from './auditDeletion'; // audit_deletion_logs

// ── Notifications ────────────────────────────────────────────────────────────
export * from './notifications'; // notification_templates, notifications, email_logs, sms_logs

// ── Reports ──────────────────────────────────────────────────────────────────
export * from './reports';      // report_templates, report_exports

// ── Documents ────────────────────────────────────────────────────────────────
export * from './documents';    // documents, attachments, file_metadata

// ── Legal Document Generator Studio ─────────────────────────────────────────
export * from './legalDocuments'; // legal_template_categories, legal_templates,
                                  // legal_template_versions, legal_template_clauses,
                                  // legal_documents, legal_document_audits

// ── Document Template Design Studio ────────────────────────────────────────
export * from './documentTemplates'; // document_templates, document_template_versions

// ── Dashboard ────────────────────────────────────────────────────────────────
export * from './dashboard';    // dashboard_widgets, dashboard_preferences

// ── AI ───────────────────────────────────────────────────────────────────────
export * from './ai';           // ai_conversations, ai_messages, ai_feedback, ai_usage_logs

// ── Module Management (platform / super-admin level) ─────────────────────────
export * from './modules';      // module_categories, modules, module_features, module_dependencies,
                                // module_versions, module_settings, module_permissions, module_licenses,
                                // organization_modules, organization_module_features,
                                // organization_module_settings, organization_module_permissions,
                                // module_license_history, module_marketplace, module_usage_logs,
                                // module_installation_logs, module_audit_logs, module_templates,
                                // module_template_items, module_notifications, module_health_checks,
                                // module_recommendations

// ── Cheque Management ────────────────────────────────────────────────────────
export * from './cheque';       // cheque_settings, cheque_books, cheque_leaves, cheque_stop_payments, cheque_bounces
export * from './bankCheques';  // bank_cheque_books, bank_cheque_leaves (cooperative's own bank cheques)

// ── Reconciliation ──────────────────────────────────────────────────────────
export * from './reconciliation'; // bank_reconciliation, bank_reconciliation_entries, cash_variance_log

// ── Passbook Printing & Booklets ─────────────────────────────────────────────
export * from './passbook';     // passbook_designs, passbook_books, passbook_print_log

// ── Signature Verification (withdrawal security) ─────────────────────────────
export * from './signatureVerification'; // member_signature_specimens,
                                         // signature_verification_logs,
                                         // savings_withdrawal_instruments

// ── Governance (AGM Meetings, Attendance, Resolutions, News) ────────────────
export * from './governance';  // agm_meetings, agm_attendees, agm_resolutions, agm_news

// ── Audit Engine (Rules, Runs, Findings, Workpapers, Opinions, Signoffs) ────
export * from './auditEngine'; // audit_rules, audit_runs, audit_findings,
                               // audit_workpapers, audit_opinion_drafts, audit_signoffs

// ── Platform Control (Super Admin) ──────────────────────────────────────
export * from './platformControl'; // subscription_plans, system_settings, api_keys, platform_announcements

// ── Database Settings (production-scale DB config) ──────────────────────
export * from './databaseSettings'; // database_settings


/**
 * Relation summary (organization_id on every tenant table):
 *
 * organizations (1) ──► branches, fiscal_years, members, savings_accounts,
 *                        loan_accounts, chart_of_accounts, vouchers, share_types,
 *                        share_holdings, collection_routes, collection_agents,
 *                        fixed_assets, inventory_products, employees, org_users,
 *                        audit_logs, notifications, ai_conversations … (all tenant tables)
 *
 * branches        (1) ──► members (N)
 * members         (1) ──► savings_accounts, loan_accounts, share_holdings (N)
 * savings_accounts(1) ──► savings_transactions, interest_postings (N)
 * loan_accounts   (1) ──► emi_schedules, loan_repayments, loan_collaterals,
 *                          guarantors, loan_penalties, loan_reschedules, loan_writeoffs (N)
 * vouchers        (1) ──► voucher_entries, journals (N)
 * collection_routes(1)──► collection_transactions (N)
 * collection_agents(1)──► collection_routes (N)
 * inventory_products(1)──► inventory_stock, inventory_transactions (N)
 * purchase_orders (1) ──► purchase_items (N)
 * fixed_assets    (1) ──► depreciation_entries, asset_transfers, maintenance_records (N)
 * employees       (1) ──► attendance, leave_requests, payroll, staff_documents (N)
 * ai_conversations(1) ──► ai_messages, ai_feedback (N)
 * documents       (1) ──► attachments (N)
 */
