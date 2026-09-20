-- =========================================================================
-- 0013: Subsidiary Ledgers (सहायक खाताहरू)
-- Member-wise sub-books that link to the General Ledger via voucher_no.
-- Strict multi-tenant isolation via organization_id (FK cascade).
--
--   subsidiary_shares_book   -> Share movements (Purchase / Return / Bonus)
--   subsidiary_savings_book  -> Savings transactions per account (SAV-xxx-xxxx)
--   subsidiary_loans_book    -> Loan principal / interest / penalty movements
--
-- Plus the single-view requirement:
--   view_member_financial_summary -> total share balance, total savings across
--                                    accounts, total outstanding loan principal
-- =========================================================================

-- १. सेयर सहायक खाता (Shares Subsidiary Book)
CREATE TABLE IF NOT EXISTS public.subsidiary_shares_book (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    member_id uuid NOT NULL,
    voucher_no text NOT NULL,                     -- General Ledger सँग लिंक
    transaction_date_bs text NOT NULL,
    transaction_type text NOT NULL,               -- 'Purchase', 'Return', 'Bonus'
    share_quantity integer NOT NULL,
    face_value numeric(15, 2) NOT NULL DEFAULT 100.00,
    debit_amount numeric(15, 2) NOT NULL DEFAULT 0.00,   -- सेयर फिर्ता गर्दा
    credit_amount numeric(15, 2) NOT NULL DEFAULT 0.00,  -- सेयर खरिद गर्दा
    balance_amount numeric(15, 2) NOT NULL,              -- रनिङ ब्यालेन्स
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT shares_book_pkey PRIMARY KEY (id),
    CONSTRAINT shares_book_org_fk FOREIGN KEY (organization_id)
        REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT shares_book_member_fk FOREIGN KEY (member_id)
        REFERENCES members (id)
);

CREATE INDEX IF NOT EXISTS subs_shares_org_member_idx
    ON public.subsidiary_shares_book (organization_id, member_id);
CREATE INDEX IF NOT EXISTS subs_shares_member_date_idx
    ON public.subsidiary_shares_book (member_id, transaction_date_bs DESC, created_at DESC);

-- २. बचत सहायक खाता (Savings Subsidiary Book)
CREATE TABLE IF NOT EXISTS public.subsidiary_savings_book (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    member_id uuid NOT NULL,
    account_no text NOT NULL,                     -- e.g. SAV-101-0042
    account_type text NOT NULL,                   -- 'Mandatory', 'Optional', 'Fixed'
    voucher_no text NOT NULL,                     -- General Ledger सँग लिंक
    transaction_date_bs text NOT NULL,
    debit_amount numeric(15, 2) NOT NULL DEFAULT 0.00,   -- रकम झिक्दा (Withdrawal)
    credit_amount numeric(15, 2) NOT NULL DEFAULT 0.00,  -- रकम जम्मा गर्दा (Deposit)
    balance_amount numeric(15, 2) NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT savings_book_pkey PRIMARY KEY (id),
    CONSTRAINT savings_book_org_fk FOREIGN KEY (organization_id)
        REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT savings_book_member_fk FOREIGN KEY (member_id)
        REFERENCES members (id)
);

CREATE INDEX IF NOT EXISTS subs_sav_org_member_idx
    ON public.subsidiary_savings_book (organization_id, member_id);
CREATE INDEX IF NOT EXISTS subs_sav_member_acct_date_idx
    ON public.subsidiary_savings_book (member_id, account_no, transaction_date_bs DESC, created_at DESC);

-- ३. ऋण सहायक खाता (Loans Subsidiary Book)
CREATE TABLE IF NOT EXISTS public.subsidiary_loans_book (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    member_id uuid NOT NULL,
    loan_account_no text NOT NULL,
    voucher_no text NOT NULL,                     -- General Ledger सँग लिंक
    transaction_date_bs text NOT NULL,
    -- वित्तीय वर्गीकरण
    principal_debit numeric(15, 2) NOT NULL DEFAULT 0.00,   -- ऋण प्रवाह गर्दा
    principal_credit numeric(15, 2) NOT NULL DEFAULT 0.00,  -- साँवा फिर्ता आउँदा
    interest_credit numeric(15, 2) NOT NULL DEFAULT 0.00,   -- ब्याज असुली
    penalty_credit numeric(15, 2) NOT NULL DEFAULT 0.00,    -- हर्जाना असुली
    remaining_principal numeric(15, 2) NOT NULL,            -- बाँकी साँवा
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT loans_book_pkey PRIMARY KEY (id),
    CONSTRAINT loans_book_org_fk FOREIGN KEY (organization_id)
        REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT loans_book_member_fk FOREIGN KEY (member_id)
        REFERENCES members (id)
);

CREATE INDEX IF NOT EXISTS subs_loan_org_member_idx
    ON public.subsidiary_loans_book (organization_id, member_id);
CREATE INDEX IF NOT EXISTS subs_loan_member_acct_date_idx
    ON public.subsidiary_loans_book (member_id, loan_account_no, transaction_date_bs DESC, created_at DESC);

-- =========================================================================
-- एकल दृश्य (Single View): सदस्य वित्तीय सारांश
-- Queries total shares, total savings (across all accounts), and total
-- outstanding loan principal in one statement. Consumers must filter by
-- organization_id for tenant isolation.
-- =========================================================================
CREATE OR REPLACE VIEW public.view_member_financial_summary AS
SELECT
    m.id AS member_id,
    m.organization_id,
    m.member_no,
    m.full_name,
    m.phone,

    -- १. कुल सेयर मौज्दात (Total Share Balance)
    COALESCE((
        SELECT sb.balance_amount
        FROM public.subsidiary_shares_book sb
        WHERE sb.member_id = m.id
        ORDER BY sb.transaction_date_bs DESC, sb.created_at DESC LIMIT 1
    ), 0.00) AS total_share_balance,

    -- २. कुल बचत मौज्दात (Total Savings across all accounts)
    COALESCE((
        SELECT SUM(latest_sav.balance) FROM (
            SELECT DISTINCT ON (account_no) balance_amount AS balance
            FROM public.subsidiary_savings_book
            WHERE member_id = m.id
            ORDER BY account_no, transaction_date_bs DESC, created_at DESC
        ) latest_sav
    ), 0.00) AS total_savings_balance,

    -- ३. कुल बाँकी ऋण (Total Outstanding Loan Principal)
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
