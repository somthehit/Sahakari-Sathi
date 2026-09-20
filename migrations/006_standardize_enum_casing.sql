-- Migration: Standardize enum casing to PascalCase
-- Priority: MEDIUM - Consistency for enum values

-- The codebase has mixed casing:
-- - PascalCase: Active, Inactive, Loan_Approval, Deposits, etc. (majority)
-- - snake_case: cash_short, outstanding_cheque, open, etc.
-- - lowercase: draft, running, open, closed, etc.

-- Decision: Standardize to PascalCase (most common pattern)

-- 1. Reconciliation status (reconciliation.ts) - snake_case -> PascalCase
ALTER TABLE "bank_reconciliation" ALTER COLUMN "status" TYPE text;
UPDATE "bank_reconciliation" SET "status" = 'CashShort' WHERE "status" = 'cash_short';
UPDATE "bank_reconciliation" SET "status" = 'CashOver' WHERE "status" = 'cash_over';
UPDATE "bank_reconciliation" SET "status" = 'Matched' WHERE "status" = 'matched';
UPDATE "bank_reconciliation" SET "status" = 'InProgress' WHERE "status" = 'in_progress';
UPDATE "bank_reconciliation" SET "status" = 'Resolved' WHERE "status" = 'resolved';
UPDATE "bank_reconciliation" SET "status" = 'Reviewed' WHERE "status" = 'reviewed';
UPDATE "bank_reconciliation" SET "status" = 'AutoReconciled' WHERE "status" = 'auto_reconciled';
UPDATE "bank_reconciliation" SET "status" = 'ManuallyReconciled' WHERE "status" = 'manually_reconciled';

-- Bank reconciliation item status
UPDATE "bank_reconciliation_items" SET "status" = 'Unmatched' WHERE "status" = 'unmatched';
UPDATE "bank_reconciliation_items" SET "status" = 'AutoMatched' WHERE "status" = 'auto_matched';
UPDATE "bank_reconciliation_items" SET "status" = 'ManuallyMatched' WHERE "status" = 'manually_matched';

-- Reconciliation type
UPDATE "bank_reconciliation" SET "reconciliation_type" = 'BankReconciliation' WHERE "reconciliation_type" = 'bank_reconciliation';
UPDATE "bank_reconciliation" SET "reconciliation_type" = 'CashReconciliation' WHERE "reconciliation_type" = 'cash_reconciliation';
UPDATE "bank_reconciliation" SET "reconciliation_type" = 'InterOfficeTransfer' WHERE "reconciliation_type" = 'inter_office_transfer';

-- Variance type
UPDATE "cash_variance_log" SET "variance_type" = 'CashShort' WHERE "variance_type" = 'cash_short';
UPDATE "cash_variance_log" SET "variance_type" = 'CashOver' WHERE "variance_type" = 'cash_over';

-- Outstanding type
UPDATE "bank_reconciliation_items" SET "outstanding_type" = 'OutstandingCheque' WHERE "outstanding_type" = 'outstanding_cheque';
UPDATE "bank_reconciliation_items" SET "outstanding_type" = 'OutstandingDeposit' WHERE "outstanding_type" = 'outstanding_deposit';

-- 2. Reconciliation module (reconciliation.ts) - PascalCase (already correct)
-- collection_reconciliation, collection_reconciliation_items, collection_sessions

-- 3. Fees (fees.ts) - lowercase -> PascalCase
UPDATE "fees" SET "fee_type" = 'Flat' WHERE "fee_type" = 'flat';
UPDATE "fees" SET "fee_type" = 'Percentage' WHERE "fee_type" = 'percentage';
UPDATE "fees" SET "calculation_type" = 'Fixed' WHERE "calculation_type" = 'fixed';
UPDATE "fees" SET "calculation_type" = 'Formula' WHERE "calculation_type" = 'formula';
UPDATE "fees" SET "status" = 'Active' WHERE "status" = 'active';
UPDATE "fees" SET "status" = 'Inactive' WHERE "status" = 'inactive';

UPDATE "feeWaivers" SET "status" = 'Pending' WHERE "status" = 'pending';
UPDATE "feeWaivers" SET "status" = 'Approved' WHERE "status" = 'approved';
UPDATE "feeWaivers" SET "status" = 'Rejected' WHERE "status" = 'rejected';

-- 4. Pending Balance (pendingBalance.ts) - lowercase -> PascalCase
UPDATE "pendingBalance" SET "status" = 'Pending' WHERE "status" = 'pending';
UPDATE "pendingBalance" SET "status" = 'Approved' WHERE "status" = 'approved';
UPDATE "pendingBalance" SET "status" = 'Rejected' WHERE "status" = 'rejected';

-- 5. Loan Limit (loanLimit.ts) - snake_case -> PascalCase
UPDATE "loan_LIMIT" SET "status" = 'Pending' WHERE "status" = 'pending';
UPDATE "loan_LIMIT" SET "status" = 'Approved' WHERE "status" = 'approved';
UPDATE "loan_LIMIT" SET "status" = 'Rejected' WHERE "status" = 'rejected';
UPDATE "loan_LIMIT" SET "status" = 'Expired' WHERE "status" = 'expired';
UPDATE "loan_LIMIT" SET "priority" = 'Low' WHERE "priority" = 'low';
UPDATE "loan_LIMIT" SET "priority" = 'Medium' WHERE "priority" = 'medium';
UPDATE "loan_LIMIT" SET "priority" = 'High' WHERE "priority" = 'high';

-- 6. Agreements (agreements.ts) - lowercase -> PascalCase
UPDATE "agreements" SET "status" = 'Pending' WHERE "status" = 'pending';
UPDATE "agreements" SET "status" = 'Active' WHERE "status" = 'active';
UPDATE "agreements" SET "status" = 'Expired' WHERE "status" = 'expired';
UPDATE "agreements" SET "status" = 'Terminated' WHERE "status" = 'terminated';
UPDATE "agreements" SET "status" = 'Amended' WHERE "status" = 'amended';
UPDATE "agreements" SET "status" = 'Archived' WHERE "status" = 'archived';
UPDATE "agreements" SET "category" = 'LoanAgreement' WHERE "category" = 'loan_agreement';
UPDATE "agreements" SET "category" = 'GuaranteeAgreement' WHERE "category" = 'guarantee_agreement';
UPDATE "agreements" SET "category" = 'SecurityAgreement' WHERE "category" = 'security_agreement';
UPDATE "agreements" SET "category" = 'MembershipAgreement' WHERE "category" = 'membership_agreement';
UPDATE "agreements" SET "category" = 'ServiceAgreement' WHERE "category" = 'service_agreement';
UPDATE "agreements" SET "category" = 'PartnershipAgreement' WHERE "category" = 'partnership_agreement';
UPDATE "agreements" SET "category" = 'Other' WHERE "category" = 'other';

-- 7. Circulars (circulars.ts) - lowercase -> PascalCase
UPDATE "circulars" SET "status" = 'Draft' WHERE "status" = 'draft';
UPDATE "circulars" SET "status" = 'Published' WHERE "status" = 'published';
UPDATE "circulars" SET "status" = 'Archived' WHERE "status" = 'archived';

-- 8. Collection Agent (collectionAgents.ts) - PascalCase (already correct)

-- 9. Marketing (marketing.ts) - PascalCase (already correct)

-- 10. System settings (settings.ts) - text columns, no enum to change

-- 11. Bank cheque leaves (cheque.ts) - PascalCase (already correct)

-- 12. Designations (designations.ts) - PascalCase (already correct)

-- 13. Advance Ledger (advanceLedger.ts) - text columns, no enum to change

-- 14. Cash (cash.ts) - text columns, no enum to change

-- 15. Requisition (requisitionAndApproval.ts) - PascalCase (already correct)

-- 16. Loans (loans.ts) - PascalCase (already correct)

-- 17. Shares (share.ts) - PascalCase (already correct)

-- 18. Collection sheets (collection_sheet.ts) - PascalCase (already correct)

-- 19. Collections (collections.ts) - PascalCase (already correct)

-- 20. Audit (Audit.ts) - PascalCase (already correct)

-- Note: After running this migration, update your Drizzle schema enums to use PascalCase consistently
-- Example: export const reconciliationStatusEnum = pgEnum('reconciliation_status', ['CashShort', 'CashOver', ...]);