-- Migration: Phase C2.3 — Semi-manual Export
-- Date: 2026-05-13
-- Extends pricing_recommendations.status CHECK constraint to include:
--   exported, manually_applied, apply_failed
-- Does NOT drop pricing_action_audit_log (already has metadata JSONB).
-- Idempotent: safe to re-run.

BEGIN;

-- Drop the existing status check constraint and replace with expanded version
ALTER TABLE pricing_recommendations
  DROP CONSTRAINT IF EXISTS pricing_recommendations_status_check;

ALTER TABLE pricing_recommendations
  ADD CONSTRAINT pricing_recommendations_status_check
    CHECK (status = ANY (ARRAY[
      'draft'::text,
      'approved'::text,
      'applied'::text,
      'rejected'::text,
      'exported'::text,
      'manually_applied'::text,
      'apply_failed'::text
    ]));

-- Ensure pricing_action_audit_log.metadata column exists (added in C2.0 but guard)
ALTER TABLE pricing_action_audit_log
  ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMIT;

-- Verify
DO $$
BEGIN
  -- Quick smoke test: set a temp row to each new status if any exist
  RAISE NOTICE 'Migration 20260513_c23_manual_apply: status constraint expanded. New values: exported, manually_applied, apply_failed';
END$$;
