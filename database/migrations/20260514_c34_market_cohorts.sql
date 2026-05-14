-- Phase C3.4 — Market Cohorts & Competitor Data Expansion
-- 2026-05-14
-- Creates: competitor_cohorts
-- Extends: competitor_sources, competitor_price_observations
-- Seeds:   3 cohorts, assigns existing competitors, adds discovery candidates
-- Safe:    idempotent (IF NOT EXISTS / ON CONFLICT / DO NOTHING)

-- ── COMPETITOR COHORTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitor_cohorts (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code                    TEXT        NOT NULL UNIQUE,
    name                    TEXT        NOT NULL,
    description             TEXT        NULL,
    target_apartment_ids    INTEGER[]   NOT NULL DEFAULT '{}',
    min_guests              INTEGER     NULL,
    max_guests              INTEGER     NULL,
    min_area_m2             NUMERIC     NULL,
    max_area_m2             NUMERIC     NULL,
    property_types          TEXT[]      NOT NULL DEFAULT '{}',
    required_features       JSONB       NOT NULL DEFAULT '{}'::JSONB,
    preferred_features      JSONB       NOT NULL DEFAULT '{}'::JSONB,
    price_min               NUMERIC     NULL,
    price_max               NUMERIC     NULL,
    is_active               BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cohorts_active ON competitor_cohorts (is_active);
CREATE INDEX IF NOT EXISTS idx_cohorts_code   ON competitor_cohorts (code);

-- ── EXTEND competitor_sources ─────────────────────────────────────────────────
ALTER TABLE competitor_sources
    ADD COLUMN IF NOT EXISTS cohort_code               TEXT        NULL,
    ADD COLUMN IF NOT EXISTS target_apartment_ids      INTEGER[]   NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS signal_quality_score      NUMERIC     NOT NULL DEFAULT 0.5,
    ADD COLUMN IF NOT EXISTS price_update_frequency    TEXT        NULL,
    ADD COLUMN IF NOT EXISTS last_price_changed_at     TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS last_price_change_amount  NUMERIC     NULL,
    ADD COLUMN IF NOT EXISTS is_static_price           BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS data_quality_notes        TEXT        NULL,
    ADD COLUMN IF NOT EXISTS discovery_status          TEXT        NOT NULL DEFAULT 'seeded';

-- FK from competitor_sources to competitor_cohorts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'cs_cohort_code_fk'
    ) THEN
        ALTER TABLE competitor_sources
            ADD CONSTRAINT cs_cohort_code_fk
            FOREIGN KEY (cohort_code) REFERENCES competitor_cohorts(code)
            ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END$$;

-- Extend status constraint to allow 'approved' and 'candidate' (for discovery candidates)
ALTER TABLE competitor_sources DROP CONSTRAINT IF EXISTS cs_status_check;
ALTER TABLE competitor_sources ADD CONSTRAINT cs_status_check
    CHECK (status IN ('active', 'excluded', 'archived', 'pending', 'approved', 'candidate'));

-- discovery_status constraint
ALTER TABLE competitor_sources DROP CONSTRAINT IF EXISTS cs_discovery_status_check;
ALTER TABLE competitor_sources ADD CONSTRAINT cs_discovery_status_check
    CHECK (discovery_status IN ('seeded', 'candidate', 'approved', 'rejected', 'needs_review', 'excluded'));

-- signal_quality constraint
ALTER TABLE competitor_sources DROP CONSTRAINT IF EXISTS cs_signal_quality_check;
ALTER TABLE competitor_sources ADD CONSTRAINT cs_signal_quality_check
    CHECK (signal_quality_score >= 0 AND signal_quality_score <= 1);

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_cs_cohort_code        ON competitor_sources (cohort_code);
CREATE INDEX IF NOT EXISTS idx_cs_discovery_status   ON competitor_sources (discovery_status);
CREATE INDEX IF NOT EXISTS idx_cs_signal_quality     ON competitor_sources (signal_quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_cs_apt_ids            ON competitor_sources USING GIN (target_apartment_ids);

-- ── EXTEND competitor_price_observations ─────────────────────────────────────
ALTER TABLE competitor_price_observations
    ADD COLUMN IF NOT EXISTS previous_price_per_night  NUMERIC     NULL,
    ADD COLUMN IF NOT EXISTS price_changed             BOOLEAN     NULL,
    ADD COLUMN IF NOT EXISTS price_change_amount       NUMERIC     NULL,
    ADD COLUMN IF NOT EXISTS price_change_percent      NUMERIC     NULL,
    ADD COLUMN IF NOT EXISTS observation_quality       TEXT        NOT NULL DEFAULT 'manual';

-- observation_quality constraint
ALTER TABLE competitor_price_observations DROP CONSTRAINT IF EXISTS cpo_obs_quality_check;
ALTER TABLE competitor_price_observations ADD CONSTRAINT cpo_obs_quality_check
    CHECK (observation_quality IN ('manual', 'seed', 'safe_fetch', 'imported', 'estimated'));

CREATE INDEX IF NOT EXISTS idx_cpo_price_changed ON competitor_price_observations (price_changed);
CREATE INDEX IF NOT EXISTS idx_cpo_obs_quality   ON competitor_price_observations (observation_quality);

-- ── SEED: Competitor Cohorts ─────────────────────────────────────────────────
INSERT INTO competitor_cohorts (
    code, name, description,
    target_apartment_ids, min_guests, max_guests,
    min_area_m2, max_area_m2, property_types,
    required_features, preferred_features,
    price_min, price_max, is_active
) VALUES (
    'standard_family_2room',
    'Семейные 2-комнатные объекты 4–5 гостей',
    'Квартиры, этажи, домики на 4–5 гостей. Основной конкурентный кластер для объектов №40, 41, 42.',
    ARRAY[40, 41, 42], 4, 5,
    30, 55,
    ARRAY['квартира', 'этаж под ключ', 'домик', 'апартаменты'],
    '{}'::JSONB,
    '{"ac": true, "wifi": true, "kitchen": true}'::JSONB,
    5000, 7500,
    TRUE
), (
    'large_family_house_territory',
    'Крупные семейные объекты 6–8 гостей с территорией',
    'Дома, коттеджи, этажи для семей 6–8 человек с двором или террасой. Целевой кластер для объекта №50.',
    ARRAY[50], 6, 8,
    50, 85,
    ARRAY['дом', 'этаж под ключ', 'апартаменты', 'коттедж', 'таунхаус'],
    '{}'::JSONB,
    '{"yard": true, "terrace": true, "separate_entrance": true, "kitchen": true}'::JSONB,
    6500, 11000,
    TRUE
), (
    'gelendzhik_background_market',
    'Фоновый рынок Геленджика',
    'Широкий рыночный фон для всех объектов. Использовать только как слабый сигнал при недостатке целевых данных.',
    ARRAY[40, 41, 42, 50], NULL, NULL,
    NULL, NULL,
    ARRAY[]::TEXT[],
    '{}'::JSONB,
    '{}'::JSONB,
    NULL, NULL,
    TRUE
)
ON CONFLICT (code) DO UPDATE SET
    name                  = EXCLUDED.name,
    description           = EXCLUDED.description,
    target_apartment_ids  = EXCLUDED.target_apartment_ids,
    min_guests            = EXCLUDED.min_guests,
    max_guests            = EXCLUDED.max_guests,
    min_area_m2           = EXCLUDED.min_area_m2,
    max_area_m2           = EXCLUDED.max_area_m2,
    property_types        = EXCLUDED.property_types,
    preferred_features    = EXCLUDED.preferred_features,
    price_min             = EXCLUDED.price_min,
    price_max             = EXCLUDED.price_max,
    updated_at            = NOW();

-- ── Assign existing competitors to cohort standard_family_2room ───────────────
UPDATE competitor_sources
SET
    cohort_code            = 'standard_family_2room',
    target_apartment_ids   = ARRAY[40, 41, 42],
    signal_quality_score   = 0.65,
    is_static_price        = TRUE,
    price_update_frequency = 'seasonal',
    discovery_status       = 'seeded',
    data_quality_notes     = 'Данные из PDF-отчёта 2026-05-13. Живое обновление цен не подтверждено. is_static_price=true до первого safe_fetch.'
WHERE url IN (
    'https://gelendzhik.travel/kvartiri/kv-na-kurzalnoj-19.html',
    'https://gelendzhik.travel/vse-zhilyo/etazh/na-oktyabrskoy.html',
    'https://travelandia.ru/gelendzhik/kvartiry/dvuhkomnatnaya-kvartira-13-3353/'
);

-- Полевая 53а — excluded, background market cohort
UPDATE competitor_sources
SET
    cohort_code          = 'gelendzhik_background_market',
    target_apartment_ids = ARRAY[40, 41, 42, 50],
    signal_quality_score = 0.1,
    discovery_status     = 'excluded',
    data_quality_notes   = 'Исключён: комнаты без кухни, вместимость < 4 гостей. Не релевантен ни одному кластеру.'
WHERE url = 'https://gelendzhik.travel/chastniysector/polevaya-53a.html';

-- ── Update existing observations: mark as seed quality ───────────────────────
UPDATE competitor_price_observations
SET observation_quality = 'seed'
WHERE collection_method IN ('seed_from_pdf_report', 'manual_seed')
  AND observation_quality = 'manual';

-- ── SEED: Discovery candidates for №50 cluster ───────────────────────────────
-- These are placeholder candidates requiring manual verification before use.
-- discovery_status='candidate' means: not yet verified, not yet used in recommendations.

INSERT INTO competitor_sources (
    name, source_platform, url, address, district,
    similarity_score, priority, status,
    property_type, max_guests, rooms,
    cohort_code, target_apartment_ids,
    signal_quality_score, discovery_status, is_static_price,
    data_quality_notes, selection_reason
) VALUES (
    '[КАНДИДАТ] Дом с двором 6–8 гостей gelendzhik.travel',
    'gelendzhik.travel',
    'https://gelendzhik.travel/domiki-doma/dom-6-gostey-gelendzik-placeholder',
    'Геленджик, р-н Толстый мыс / центр',
    'Толстый мыс',
    0, 50, 'candidate',
    'house', 8, 3,
    'large_family_house_territory', ARRAY[50],
    0.0, 'candidate', TRUE,
    'Заглушка-кандидат. URL нужно заменить реальным. Требует ручной проверки перед использованием.',
    'Нужен дом 6–8 гостей с двором. Похожий ценовой сегмент 7000–10000 ₽/ночь.'
),
(
    '[КАНДИДАТ] Коттедж с территорией travelandia.ru',
    'travelandia.ru',
    'https://travelandia.ru/gelendzhik/doma/kottedzh-6-8-gostey-placeholder',
    'Геленджик',
    'Центр',
    0, 51, 'candidate',
    'cottage', 8, 3,
    'large_family_house_territory', ARRAY[50],
    0.0, 'candidate', TRUE,
    'Заглушка-кандидат. Требует ручного поиска реального объявления на travelandia.ru.',
    'Нужен коттедж 6–8 гостей с зоной отдыха. Аналогичный ценовой сегмент.'
),
(
    '[КАНДИДАТ] Этаж под ключ 6–8 гостей sutochno.ru',
    'sutochno.ru',
    'https://sutochno.ru/gelendzhik/placeholder-etazh-6-8-gostey',
    'Геленджик',
    NULL,
    0, 52, 'candidate',
    'floor_apartment', 8, 3,
    'large_family_house_territory', ARRAY[50],
    0.0, 'candidate', TRUE,
    'Заглушка-кандидат. sutochno.ru — ручной мониторинг, bot protection. Добавить реальный URL вручную.',
    'Нужен этаж под ключ 6–8 гостей с кухней и возможно двором.'
)
ON CONFLICT (url) DO NOTHING;

-- ── System vars: C3.4 metadata ────────────────────────────────────────────────
INSERT INTO system_vars (key, value, description)
VALUES
    ('c34_market_cohorts_version', '1',
     'Market cohorts version (C3.4, 2026-05-14)'),
    ('c34_large_family_min_sources', '3',
     'Min active sources required for large_family_house_territory before confidence_cap applies'),
    ('c34_static_price_weight_penalty', '0.5',
     'Weight multiplier for is_static_price=true sources'),
    ('c34_background_market_weight', '0.3',
     'Weight for gelendzhik_background_market cohort signals')
ON CONFLICT (key) DO NOTHING;
