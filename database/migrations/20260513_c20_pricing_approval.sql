-- Phase C2.0 — Pricing Approval + Audit Log
-- Migration: 20260513_c20_pricing_approval.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Audit log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pricing_action_audit_log (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id   uuid        NULL REFERENCES pricing_recommendations(id) ON DELETE SET NULL,
    action              text        NOT NULL,
    previous_status     text        NULL,
    new_status          text        NULL,
    apartment_id        text        NULL,
    date_from           date        NULL,
    date_to             date        NULL,
    old_price           numeric     NULL,
    new_price           numeric     NULL,
    reason              text        NULL,
    actor               text        NULL DEFAULT 'admin',
    source              text        NOT NULL DEFAULT 'admin_panel',
    metadata            jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_recommendation
    ON pricing_action_audit_log (recommendation_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action
    ON pricing_action_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
    ON pricing_action_audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_apt_dates
    ON pricing_action_audit_log (apartment_id, date_from, date_to);
