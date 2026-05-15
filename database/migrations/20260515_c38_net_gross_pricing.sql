-- Phase C3.8 — Net / gross pricing + direct booking economics
-- Safe: ADD COLUMN + backfill + system_vars seed (ON CONFLICT DO NOTHING)
-- Date: 2026-05-15

BEGIN;

-- ── pricing_recommendations: channel economics ─────────────────────────────
ALTER TABLE pricing_recommendations
  ADD COLUMN IF NOT EXISTS recommended_guest_price NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS rc_net_price NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS aggregator_markup_percent NUMERIC NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS expected_aggregator_guest_price NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS direct_price NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS direct_savings_for_guest NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS direct_owner_gain NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS pricing_channel TEXT NOT NULL DEFAULT 'aggregator_adjusted';

-- Guest-facing alias for existing rows
UPDATE pricing_recommendations
SET
  recommended_guest_price = COALESCE(recommended_guest_price, recommended_price),
  aggregator_markup_percent = COALESCE(aggregator_markup_percent, 18)
WHERE recommended_guest_price IS NULL
   OR aggregator_markup_percent IS NULL;

-- Economics backfill (direct_discount uses 5% default if system_vars not yet applied in same txn)
UPDATE pricing_recommendations pr
SET
  rc_net_price = ROUND(pr.recommended_guest_price / (1 + pr.aggregator_markup_percent / 100))::numeric,
  expected_aggregator_guest_price = ROUND(
    ROUND(pr.recommended_guest_price / (1 + pr.aggregator_markup_percent / 100))
    * (1 + pr.aggregator_markup_percent / 100)
  )::numeric,
  direct_price = ROUND(
    pr.recommended_guest_price
    * (1 - COALESCE(
        (SELECT NULLIF(btrim(value), '')::numeric FROM system_vars WHERE key = 'direct_discount_percent' LIMIT 1),
        5
      ) / 100)
  )::numeric
WHERE pr.rc_net_price IS NULL
   OR pr.expected_aggregator_guest_price IS NULL
   OR pr.direct_price IS NULL;

UPDATE pricing_recommendations pr
SET
  direct_savings_for_guest = (pr.expected_aggregator_guest_price - pr.direct_price)::numeric,
  direct_owner_gain = (pr.direct_price - pr.rc_net_price)::numeric
WHERE pr.direct_savings_for_guest IS NULL
   OR pr.direct_owner_gain IS NULL;

-- ── system_vars (idempotent) ─────────────────────────────────────────────────
INSERT INTO system_vars (key, value, description)
VALUES
  ('aggregator_markup_percent', '18',
   'C3.8: approximate OTA markup on top of RealtyCalendar net (guest-facing ≈ net × (1 + pct/100))'),
  ('direct_discount_percent', '5',
   'C3.8: discount vs guest target for direct booking offer (3–5 typical)'),
  ('direct_booking_enabled', 'true',
   'C3.8: feature flag for direct-booking UX (no messaging automation in this phase)')
ON CONFLICT (key) DO NOTHING;

COMMIT;
