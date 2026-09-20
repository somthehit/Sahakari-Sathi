-- =========================================================================
-- Currency & Forex Infrastructure
-- Multi-currency ledger snapshot for audit-trail compliance
--   exchange_rates                  -> daily USD/NPR buy-sell-middle rates
--   organization_financial_settings -> default currency, forex markup, tax
--   member_transactions             -> transaction ledger with snapshots
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- विनिमय दर (Exchange Rates) तालिका सिर्जना
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    base_currency text NOT NULL DEFAULT 'USD',
    target_currency text NOT NULL DEFAULT 'NPR',
    buy_rate numeric(12, 4) NOT NULL,
    sell_rate numeric(12, 4) NOT NULL,
    official_middle_rate numeric(12, 4) NOT NULL,
    effective_date date NOT NULL DEFAULT CURRENT_DATE,
    created_at timestamp without time zone NOT NULL DEFAULT now(),

    CONSTRAINT exchange_rates_pkey PRIMARY KEY (id),
    CONSTRAINT exchange_rates_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT exchange_rates_org_date_pair_uniq UNIQUE (organization_id, base_currency, target_currency, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup ON public.exchange_rates (organization_id, base_currency, target_currency, effective_date DESC);

-- वित्तीय सेटिङ (Financial Settings) तालिका सिर्जना
CREATE TABLE IF NOT EXISTS public.organization_financial_settings (
    organization_id uuid NOT NULL,
    default_currency text NOT NULL DEFAULT 'NPR',
    allowed_currencies text[] NOT NULL DEFAULT ARRAY['NPR', 'USD'],
    default_forex_markup_percent numeric(5, 2) NOT NULL DEFAULT 0.00,
    is_tax_enabled boolean NOT NULL DEFAULT false,
    tax_name text NOT NULL DEFAULT 'GST',
    default_tax_rate_percent numeric(5, 2) NOT NULL DEFAULT 0.00,
    tax_number text NULL,
    updated_at timestamp without time zone NOT NULL DEFAULT now(),

    CONSTRAINT org_financial_settings_pkey PRIMARY KEY (organization_id),
    CONSTRAINT org_fin_settings_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

-- =========================================================================
-- TRANSACTION LEDGER & FOREX CALCULATION FUNCTION
-- =========================================================================

-- मल्टि-करन्सी र ट्याक्स सपोर्ट गर्ने ट्रान्ज्याक्सन तालिका सिर्जना
CREATE TABLE IF NOT EXISTS public.member_transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    member_id uuid NOT NULL,
    currency text NOT NULL DEFAULT 'NPR',
    original_amount numeric(15, 2) NOT NULL,
    exchange_rate numeric(12, 4) NOT NULL DEFAULT 1.0000,
    forex_markup_percent numeric(5, 2) NOT NULL DEFAULT 0.00,
    effective_exchange_rate numeric(12, 4) GENERATED ALWAYS AS (
        exchange_rate * (1 + (forex_markup_percent / 100))
    ) STORED,
    base_amount_npr numeric(15, 2) NOT NULL,
    tax_percent numeric(5, 2) NOT NULL DEFAULT 0.00,
    tax_amount_npr numeric(15, 2) NOT NULL DEFAULT 0.00,
    total_amount_npr numeric(15, 2) NOT NULL,
    status text NOT NULL DEFAULT 'Completed',
    created_at timestamp without time zone NOT NULL DEFAULT now(),

    CONSTRAINT transactions_pkey PRIMARY KEY (id),
    CONSTRAINT transactions_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id),
    CONSTRAINT transactions_member_fk FOREIGN KEY (member_id) REFERENCES members (id)
);

CREATE INDEX IF NOT EXISTS idx_member_transactions_org_member_created ON public.member_transactions (organization_id, member_id, created_at DESC);

-- स्वचालित हिसाब गर्ने Stored Function
CREATE OR REPLACE FUNCTION public.calculate_transaction_amounts(
    p_org_id uuid,
    p_currency text,
    p_amount numeric,
    p_apply_tax boolean DEFAULT false
)
RETURNS TABLE (
    input_currency text,
    original_amount numeric,
    applied_exchange_rate numeric,
    forex_markup_percent numeric,
    effective_rate numeric,
    base_amount_npr numeric,
    tax_percent numeric,
    tax_amount_npr numeric,
    total_amount_npr numeric
)
LANGUAGE plpgsql AS $$
DECLARE
    v_base_rate numeric(12,4) := 1.0000;
    v_markup numeric(5,2) := 0.00;
    v_eff_rate numeric(12,4) := 1.0000;
    v_tax_rate numeric(5,2) := 0.00;
    v_base_npr numeric(15,2);
    v_tax_npr numeric(15,2) := 0.00;
    v_total_npr numeric(15,2);
BEGIN
    SELECT default_forex_markup_percent, default_tax_rate_percent
    INTO v_markup, v_tax_rate
    FROM public.organization_financial_settings
    WHERE organization_id = p_org_id;

    IF v_markup IS NULL THEN v_markup := 0.00; END IF;
    IF v_tax_rate IS NULL THEN v_tax_rate := 0.00; END IF;

    IF p_currency = 'USD' THEN
        SELECT official_middle_rate INTO v_base_rate
        FROM public.exchange_rates
        WHERE organization_id = p_org_id
          AND base_currency = 'USD'
          AND target_currency = 'NPR'
        ORDER BY effective_date DESC LIMIT 1;

        IF v_base_rate IS NULL THEN
            RAISE EXCEPTION 'USD विनिमय दर फेला परेन। कृपया पहिले विनियम दर प्रविष्ट गर्नुहोस्।';
        END IF;

        v_eff_rate := v_base_rate * (1 + (v_markup / 100));
    ELSE
        v_base_rate := 1.0000;
        v_markup := 0.00;
        v_eff_rate := 1.0000;
    END IF;

    v_base_npr := ROUND((p_amount * v_eff_rate), 2);

    IF p_apply_tax AND v_tax_rate > 0 THEN
        v_tax_npr := ROUND((v_base_npr * (v_tax_rate / 100)), 2);
    ELSE
        v_tax_rate := 0.00;
    END IF;

    v_total_npr := v_base_npr + v_tax_npr;

    RETURN QUERY SELECT
        p_currency, p_amount, v_base_rate, v_markup, v_eff_rate, v_base_npr, v_tax_rate, v_tax_npr, v_total_npr;
END;
$$;
