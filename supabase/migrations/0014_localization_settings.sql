-- =========================================================================
-- Organization-Level Localization Settings (संस्थागत लोकलाइजेसन सेटिङ)
--   Language, Calendar/Date formats, Number grouping & Currency display
--   Scoped to organization_id (multi-tenant). One row per organization.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.organization_localization_settings (
    organization_id uuid NOT NULL,
    default_language text NOT NULL DEFAULT 'ne', -- 'ne' (नेपाली) वा 'en' (अङ्ग्रेजी)
    supported_languages text[] NOT NULL DEFAULT ARRAY['ne', 'en'],

    -- मिति र क्यालेन्डर ढाँचा
    primary_calendar_system text NOT NULL DEFAULT 'BS', -- 'BS' (विक्रम संवत) वा 'AD' (इस्वी संवत)
    date_display_format text NOT NULL DEFAULT 'YYYY-MM-DD',

    -- संख्या र मुद्रा ढाँचा (Number formatting style)
    number_format_style text NOT NULL DEFAULT 'IN', -- 'IN' (Lakh/Crore: १२,३४,५६७.००) वा 'US' (Million/Billion: १,२३४,५६७.००)
    currency_symbol text NOT NULL DEFAULT 'रु.',
    currency_symbol_position text NOT NULL DEFAULT 'prefix', -- 'prefix' (रु. १,०००) वा 'suffix' (१,००० रु.)
    enable_auto_transliteration boolean NOT NULL DEFAULT false, -- Automatic Nepali name transliteration

    updated_at timestamp without time zone NOT NULL DEFAULT now(),

    CONSTRAINT org_loc_settings_pkey PRIMARY KEY (organization_id),
    CONSTRAINT org_loc_settings_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT org_loc_settings_language_chk CHECK (default_language IN ('ne', 'en')),
    CONSTRAINT org_loc_settings_calendar_chk CHECK (primary_calendar_system IN ('BS', 'AD')),
    CONSTRAINT org_loc_settings_number_style_chk CHECK (number_format_style IN ('IN', 'US')),
    CONSTRAINT org_loc_settings_symbol_pos_chk CHECK (currency_symbol_position IN ('prefix', 'suffix'))
);

-- =========================================================================
-- संख्या ढाँचा (Number formatting) function
-- Formats a numeric amount using Nepali/Indian (Lakh/Crore) or US (Million)
-- grouping, mirroring the same logic used on the frontend for live previews.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.format_nepali_currency(amount numeric, format_style text DEFAULT 'IN')
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
    rounded numeric;
    int_part text;
    dec_part text;
    result text := '';
    len integer;
    sign_prefix text := '';
BEGIN
    -- दुई दशमलव स्थानमा राउन्ड गर्ने (Round to 2 decimals first)
    rounded := ROUND(amount, 2);
    IF rounded < 0 THEN
        sign_prefix := '-';
        rounded := -rounded;
    END IF;

    -- संख्यालाई दुई भागमा छुट्ट्याउने (Integer and Decimal)
    int_part := TRUNC(rounded)::bigint::text;
    dec_part := LPAD(ROUND((rounded - TRUNC(rounded)) * 100)::bigint::text, 2, '0');

    IF format_style = 'US' THEN
        -- Standard Million/Billion system (1,234,567.89)
        RETURN sign_prefix || TO_CHAR(rounded, 'FM999,999,999,990.00');
    ELSE
        -- Indian/Nepali Lakh/Crore system (12,34,567.89)
        len := LENGTH(int_part);
        IF len <= 3 THEN
            result := int_part;
        ELSE
            -- अन्तिम ३ अंक लिने
            result := SUBSTRING(int_part, len - 2, 3);
            int_part := SUBSTRING(int_part, 1, len - 3);
            -- बाँकी रहेका अंकहरूलाई २-२ को समूहमा कमा थप्ने
            WHILE LENGTH(int_part) > 0 LOOP
                len := LENGTH(int_part);
                IF len > 2 THEN
                    result := SUBSTRING(int_part, len - 1, 2) || ',' || result;
                    int_part := SUBSTRING(int_part, 1, len - 2);
                ELSE
                    result := int_part || ',' || result;
                    int_part := '';
                END IF;
            END LOOP;
        END IF;
        RETURN sign_prefix || result || '.' || dec_part;
    END IF;
END;
$$;
