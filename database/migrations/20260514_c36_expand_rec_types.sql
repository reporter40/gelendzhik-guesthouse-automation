-- Migration C3.6: expand pricing_recommendations.recommendation_type constraint
-- to include new cohort-aware types introduced in workflow 12 (C3.4 refactoring).
-- Non-destructive: only adds new allowed values.
-- Existing records (raise_price, gap_special_price) are preserved as-is.

BEGIN;

ALTER TABLE pricing_recommendations
  DROP CONSTRAINT IF EXISTS pricing_recommendations_type_check;

ALTER TABLE pricing_recommendations
  ADD CONSTRAINT pricing_recommendations_type_check
  CHECK (recommendation_type = ANY (ARRAY[
    -- legacy types (created before C3.4)
    'gap_special_price',
    'raise_price',
    'lower_price',
    'hold_price',
    -- new cohort-aware types (introduced in workflow 12 C3.4 refactoring)
    'gap_fill_aggressive',
    'gap_fill_moderate',
    'gap_fill_soft',
    'discount_no_market'
  ]));

COMMIT;

-- Verify
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'pricing_recommendations'::regclass
  AND conname = 'pricing_recommendations_type_check';
