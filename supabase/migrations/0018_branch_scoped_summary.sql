-- Expose members.branch_id on view_member_financial_summary so branch-scoped
-- reads can filter the subsidiary summary by the caller's branch scope.
CREATE OR REPLACE VIEW public.view_member_financial_summary AS
SELECT
    m.id AS member_id,
    m.organization_id,
    m.branch_id,
    m.member_no,
    m.full_name,
    m.phone,

    -- कुल सेयर मौज्दात (Total Share Balance)
    COALESCE((
        SELECT sb.balance_amount
        FROM public.subsidiary_shares_book sb
        WHERE sb.member_id = m.id
        ORDER BY sb.transaction_date_bs DESC, sb.created_at DESC LIMIT 1
    ), 0.00) AS total_share_balance,

    -- कुल बचत मौज्दात (Total Savings across all accounts)
    COALESCE((
        SELECT SUM(latest_sav.balance) FROM (
            SELECT DISTINCT ON (account_no) balance_amount AS balance
            FROM public.subsidiary_savings_book
            WHERE member_id = m.id
            ORDER BY account_no, transaction_date_bs DESC, created_at DESC
        ) latest_sav
    ), 0.00) AS total_savings_balance,

    -- कुल बाँकी ऋण (Total Outstanding Loan Principal)
    COALESCE((
        SELECT SUM(latest_loan.remaining) FROM (
            SELECT DISTINCT ON (loan_account_no) remaining_principal AS remaining
            FROM public.subsidiary_loans_book
            WHERE member_id = m.id
            ORDER BY loan_account_no, transaction_date_bs DESC, created_at DESC
        ) latest_loan
    ), 0.00) AS total_outstanding_loan

FROM public.members m
WHERE m.deleted_at IS NULL;
