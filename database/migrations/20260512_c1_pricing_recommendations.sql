-- Phase C1 — Revenue Recommendations
-- 2026-05-13
-- Creates: pricing_recommendations
-- Safe: no changes to existing tables

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── PRICING RECOMMENDATIONS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pricing_recommendations (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    apartment_id         VARCHAR(20) NOT NULL,
    date_from            DATE        NOT NULL,
    date_to              DATE        NOT NULL,
    nights               INTEGER     NOT NULL,
    current_price        NUMERIC     NULL,
    market_min           NUMERIC     NULL,
    market_median        NUMERIC     NULL,
    market_avg           NUMERIC     NULL,
    market_max           NUMERIC     NULL,
    recommended_price    NUMERIC     NOT NULL,
    recommendation_type  TEXT        NOT NULL,
    reason               TEXT        NOT NULL,
    confidence           NUMERIC     NULL,
    source               TEXT        NOT NULL DEFAULT 'c1_rules',
    status               TEXT        NOT NULL DEFAULT 'draft',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pricing_recommendations_nights_check   CHECK (nights >= 1),
    CONSTRAINT pricing_recommendations_dates_check    CHECK (date_to >= date_from),
    CONSTRAINT pricing_recommendations_price_check    CHECK (recommended_price > 0),
    CONSTRAINT pricing_recommendations_confidence_check CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    CONSTRAINT pricing_recommendations_status_check   CHECK (status IN ('draft', 'approved', 'applied', 'rejected')),
    CONSTRAINT pricing_recommendations_type_check     CHECK (recommendation_type IN ('gap_special_price', 'raise_price', 'lower_price', 'hold_price')),
    UNIQUE (apartment_id, date_from)
);

CREATE INDEX IF NOT EXISTS idx_pricing_recs_apt_dates
    ON pricing_recommendations (apartment_id, date_from, date_to);

CREATE INDEX IF NOT EXISTS idx_pricing_recs_status
    ON pricing_recommendations (status);

CREATE INDEX IF NOT EXISTS idx_pricing_recs_type
    ON pricing_recommendations (recommendation_type);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pricing_recs_updated_at ON pricing_recommendations;
CREATE TRIGGER trg_pricing_recs_updated_at
    BEFORE UPDATE ON pricing_recommendations
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ── System vars: C1 metadata ──────────────────────────────────────────────────
INSERT INTO system_vars (key, value, description)
VALUES ('c1_pricing_rules_version', '1', 'Pricing recommendations rules version (C1)')
ON CONFLICT (key) DO NOTHING;
