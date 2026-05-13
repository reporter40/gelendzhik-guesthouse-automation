-- Phase C0 — Revenue Intelligence (read-only)
-- 2026-05-12
-- Creates: gap_windows, competitor_prices
-- Safe: no changes to existing tables

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── GAP WINDOWS ──────────────────────────────────────────────────────────────
-- Small gaps between confirmed bookings (1–3 nights) detected by workflow 11

CREATE TABLE IF NOT EXISTS gap_windows (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    apartment_id        VARCHAR(20) NOT NULL,
    gap_start           DATE        NOT NULL,
    gap_end             DATE        NOT NULL,
    nights              INTEGER     NOT NULL,
    previous_booking_id TEXT        NULL,
    next_booking_id     TEXT        NULL,
    estimated_loss      NUMERIC     NULL,
    recommendation      TEXT        NULL,
    status              TEXT        NOT NULL DEFAULT 'open',
    detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT gap_windows_nights_check CHECK (nights >= 1),
    CONSTRAINT gap_windows_dates_check  CHECK (gap_end > gap_start),
    CONSTRAINT gap_windows_status_check CHECK (status IN ('open', 'noted', 'ignored')),
    UNIQUE (apartment_id, gap_start)
);

CREATE INDEX IF NOT EXISTS idx_gap_windows_apt_dates
    ON gap_windows (apartment_id, gap_start, gap_end);

CREATE INDEX IF NOT EXISTS idx_gap_windows_status
    ON gap_windows (status);

CREATE INDEX IF NOT EXISTS idx_gap_windows_nights
    ON gap_windows (nights);

-- Auto-update updated_at on change
CREATE OR REPLACE FUNCTION update_gap_windows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gap_windows_updated_at ON gap_windows;
CREATE TRIGGER trg_gap_windows_updated_at
    BEFORE UPDATE ON gap_windows
    FOR EACH ROW EXECUTE FUNCTION update_gap_windows_updated_at();

-- ── COMPETITOR PRICES ─────────────────────────────────────────────────────────
-- Manual input of competitor property pricing data

CREATE TABLE IF NOT EXISTS competitor_prices (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source          TEXT        NOT NULL,
    title           TEXT        NOT NULL,
    url             TEXT        NULL,
    location        TEXT        NULL,
    max_guests      INTEGER     NULL,
    rooms           INTEGER     NULL,
    date_from       DATE        NOT NULL,
    date_to         DATE        NOT NULL,
    price_per_night NUMERIC     NOT NULL,
    rating          NUMERIC     NULL,
    reviews_count   INTEGER     NULL,
    notes           TEXT        NULL,
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT competitor_prices_dates_check  CHECK (date_to >= date_from),
    CONSTRAINT competitor_prices_price_check  CHECK (price_per_night > 0)
);

CREATE INDEX IF NOT EXISTS idx_competitor_prices_dates
    ON competitor_prices (date_from, date_to);

CREATE INDEX IF NOT EXISTS idx_competitor_prices_source
    ON competitor_prices (source);

-- ── SYSTEM VARS: gap threshold ───────────────────────────────────────────────
INSERT INTO system_vars (key, value, description)
VALUES ('gap_window_threshold_nights', '3', 'Max nights to classify as a small gap window (C0)')
ON CONFLICT (key) DO NOTHING;
