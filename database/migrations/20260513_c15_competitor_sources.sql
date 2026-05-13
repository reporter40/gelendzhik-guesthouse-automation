-- Phase C1.5 — Competitor Market Monitoring
-- 2026-05-13
-- Creates: competitor_sources, competitor_price_observations, competitor_monitoring_rules
-- Seeds:   3 active competitors + 1 excluded (from PDF report)
-- Safe:    idempotent (ON CONFLICT DO NOTHING / DO UPDATE)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── COMPETITOR SOURCES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitor_sources (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                     TEXT        NOT NULL,
    source_platform          TEXT        NOT NULL,
    url                      TEXT        NOT NULL UNIQUE,
    address                  TEXT        NULL,
    district                 TEXT        NULL,
    similarity_score         NUMERIC     NOT NULL DEFAULT 0,
    priority                 INTEGER     NOT NULL DEFAULT 100,
    status                   TEXT        NOT NULL DEFAULT 'active',
    property_type            TEXT        NULL,
    area_m2                  NUMERIC     NULL,
    max_guests               INTEGER     NULL,
    rooms                    INTEGER     NULL,
    distance_to_beach_m      INTEGER     NULL,
    distance_to_center_m     INTEGER     NULL,
    has_private_entrance     BOOLEAN     NULL,
    has_private_kitchen      BOOLEAN     NULL,
    has_balcony_or_terrace   BOOLEAN     NULL,
    amenities                JSONB       NOT NULL DEFAULT '{}'::JSONB,
    min_stay                 INTEGER     NULL,
    target_audience          TEXT        NULL,
    price_low                NUMERIC     NULL,
    price_high               NUMERIC     NULL,
    selection_reason         TEXT        NULL,
    exclusion_reason         TEXT        NULL,
    last_checked_at          TIMESTAMPTZ NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT cs_status_check    CHECK (status IN ('active', 'excluded', 'archived', 'pending')),
    CONSTRAINT cs_score_check     CHECK (similarity_score >= 0 AND similarity_score <= 100),
    CONSTRAINT cs_priority_check  CHECK (priority >= 1)
);

CREATE INDEX IF NOT EXISTS idx_cs_status_priority    ON competitor_sources (status, priority);
CREATE INDEX IF NOT EXISTS idx_cs_score              ON competitor_sources (similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_cs_platform           ON competitor_sources (source_platform);
CREATE INDEX IF NOT EXISTS idx_cs_district           ON competitor_sources (district);

-- ── COMPETITOR PRICE OBSERVATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitor_price_observations (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_source_id     UUID        NOT NULL REFERENCES competitor_sources(id) ON DELETE CASCADE,
    observed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stay_date_from           DATE        NOT NULL,
    stay_date_to             DATE        NOT NULL,
    nights                   INTEGER     NULL,
    price_per_night          NUMERIC     NULL,
    total_price              NUMERIC     NULL,
    min_stay                 INTEGER     NULL,
    availability_status      TEXT        NULL DEFAULT 'available',
    raw_price_text           TEXT        NULL,
    raw_availability_text    TEXT        NULL,
    confidence               NUMERIC     NULL,
    collection_method        TEXT        NOT NULL DEFAULT 'manual_seed',
    notes                    TEXT        NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT cpo_dates_check      CHECK (stay_date_to >= stay_date_from),
    CONSTRAINT cpo_price_check      CHECK (price_per_night IS NULL OR price_per_night > 0),
    CONSTRAINT cpo_confidence_check CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    CONSTRAINT cpo_method_check     CHECK (collection_method IN (
        'manual_seed', 'seed_from_pdf_report', 'safe_fetch',
        'manual_input', 'manual_review_required', 'import'))
);

CREATE INDEX IF NOT EXISTS idx_cpo_source_dates  ON competitor_price_observations (competitor_source_id, stay_date_from, stay_date_to);
CREATE INDEX IF NOT EXISTS idx_cpo_observed      ON competitor_price_observations (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpo_method        ON competitor_price_observations (collection_method);

-- ── COMPETITOR MONITORING RULES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitor_monitoring_rules (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name       TEXT        NOT NULL UNIQUE,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    source_platform TEXT        NULL,
    check_frequency TEXT        NOT NULL DEFAULT 'daily',
    allowed_method  TEXT        NOT NULL DEFAULT 'manual_or_safe_fetch',
    notes           TEXT        NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmr_active ON competitor_monitoring_rules (is_active);

-- ── updated_at triggers ────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_cs_updated_at ON competitor_sources;
CREATE TRIGGER trg_cs_updated_at
    BEFORE UPDATE ON competitor_sources
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ── SEED: Monitoring rules ────────────────────────────────────────────────────
INSERT INTO competitor_monitoring_rules (rule_name, is_active, source_platform, check_frequency, allowed_method, notes)
VALUES
    ('gelendzhik_travel_safe_fetch', false, 'gelendzhik.travel',
     'daily', 'safe_fetch',
     'HTTP GET без авторизации и капчи. Задержки между запросами 10–30 сек. Не ломаться при ошибках.'),
    ('travelandia_safe_fetch',       false, 'travelandia.ru',
     'daily', 'safe_fetch',
     'HTTP GET. Медленный полинг. Проверять robots.txt и ToS при каждом обновлении.'),
    ('avito_manual_review',          false, 'avito.ru',
     'weekly', 'manual_review_required',
     'Авито использует защиту от ботов и CAPTCHA. Только ручной ввод.'),
    ('booking_manual_review',        false, 'booking.com',
     'weekly', 'manual_review_required',
     'Строгие ToS Booking.com запрещают автоматический сбор данных. Только ручной ввод.')
ON CONFLICT (rule_name) DO NOTHING;

-- ── SEED: Competitor sources ──────────────────────────────────────────────────
-- 1. Курзальная 19 — similarity 95%
INSERT INTO competitor_sources (
    name, source_platform, url, address, district,
    similarity_score, priority, status, property_type,
    area_m2, max_guests, rooms,
    distance_to_beach_m, distance_to_center_m,
    has_private_entrance, has_private_kitchen, has_balcony_or_terrace,
    amenities, min_stay, target_audience,
    price_low, price_high, selection_reason
) VALUES (
    'Двухкомнатная квартира на Курзальной 19',
    'gelendzhik.travel',
    'https://gelendzhik.travel/kvartiri/kv-na-kurzalnoj-19.html',
    'ул. Курзальная, 19, Геленджик',
    'Толстый мыс',
    95, 1, 'active', 'apartment',
    NULL, 5, 2,
    500, 1100,
    true, true, true,
    '{"ac": true, "wifi": true, "tv": true, "shower": true, "linen": true}'::JSONB,
    3, 'family',
    6000, 7500,
    'Та же улица/район, 500 м до пляжа. 2 комнаты, 5 гостей, кухня, балкон, кондиционер, Wi-Fi, ТВ. Семейный отдых, min stay 3 дня. Цена 6000–7500 ₽/сут — зеркальный конкурент.'
) ON CONFLICT (url) DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    price_low        = EXCLUDED.price_low,
    price_high       = EXCLUDED.price_high,
    updated_at       = NOW();

-- 2. Октябрьская — similarity 93%
INSERT INTO competitor_sources (
    name, source_platform, url, address, district,
    similarity_score, priority, status, property_type,
    area_m2, max_guests, rooms,
    distance_to_beach_m, distance_to_center_m,
    has_private_entrance, has_private_kitchen, has_balcony_or_terrace,
    amenities, min_stay, target_audience,
    price_low, price_high, selection_reason
) VALUES (
    'Этаж под ключ на Октябрьской',
    'gelendzhik.travel',
    'https://gelendzhik.travel/vse-zhilyo/etazh/na-oktyabrskoy.html',
    'ул. Октябрьская, центр Геленджика',
    'Центр',
    93, 2, 'active', 'floor_apartment',
    50, 5, 2,
    300, 100,
    true, true, true,
    '{"ac": true, "wifi": true, "tv": true, "shower": true, "terrace": true, "linen": true}'::JSONB,
    5, 'family',
    5000, 6000,
    'Центр, 300 м до моря. Этаж под ключ, 2 спальни + гостиная, 50 м², 5 гостей. Кухня, сплит, ТВ, терраса. Тихий семейный отдых, min stay 5 дней.'
) ON CONFLICT (url) DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    price_low        = EXCLUDED.price_low,
    price_high       = EXCLUDED.price_high,
    updated_at       = NOW();

-- 3. Полевая 29 — similarity 85%
INSERT INTO competitor_sources (
    name, source_platform, url, address, district,
    similarity_score, priority, status, property_type,
    area_m2, max_guests, rooms,
    distance_to_beach_m, distance_to_center_m,
    has_private_entrance, has_private_kitchen, has_balcony_or_terrace,
    amenities, min_stay, target_audience,
    price_low, price_high, selection_reason
) VALUES (
    'Двухкомнатная квартира ул. Полевая 29',
    'travelandia.ru',
    'https://travelandia.ru/gelendzhik/kvartiry/dvuhkomnatnaya-kvartira-13-3353/',
    'ул. Полевая, 29, Геленджик',
    'Толстый мыс',
    85, 3, 'active', 'apartment',
    50, 6, 2,
    500, 1750,
    true, true, true,
    '{"ac": true, "wifi": true, "tv": true, "shower": true, "balcony": true, "washing_machine": true, "linen": true}'::JSONB,
    NULL, 'family',
    6000, 7000,
    'Толстый мыс, 500 м до моря. 50 м², до 6 гостей. Кухня, балкон, кондиционер, стиральная машина. Рядом магазины, рынок, остановка. Цена сегмента на 2026: ~6000 ₽/сут.'
) ON CONFLICT (url) DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    price_low        = EXCLUDED.price_low,
    price_high       = EXCLUDED.price_high,
    updated_at       = NOW();

-- 4. Полевая 53а — EXCLUDED
INSERT INTO competitor_sources (
    name, source_platform, url, address, district,
    similarity_score, priority, status, property_type,
    exclusion_reason
) VALUES (
    'Жильё на ул. Полевой 53а',
    'gelendzhik.travel',
    'https://gelendzhik.travel/chastniysector/polevaya-53a.html',
    'ул. Полевая, 53а, Геленджик',
    'Толстый мыс',
    35, 999, 'excluded', 'guesthouse_rooms',
    'Гостевой дом с комнатами на 2–3 человека. Общая кухня, площадь 10–20 м². Не соответствует критериям: нет автономной кухни, вместимость < 4 гостей.'
) ON CONFLICT (url) DO UPDATE SET
    status           = 'excluded',
    exclusion_reason = EXCLUDED.exclusion_reason,
    updated_at       = NOW();

-- ── SEED: Price observations from PDF report ──────────────────────────────────
-- Курзальная 19 — confidence 0.85
INSERT INTO competitor_price_observations (
    competitor_source_id, stay_date_from, stay_date_to, nights,
    price_per_night, collection_method, confidence, notes
)
SELECT cs.id, '2026-06-01', '2026-08-31', 91,
       6750, 'seed_from_pdf_report', 0.85,
       'Стартовая оценка из аналитического отчёта 2026-05-13. Диапазон PDF: 6000–7500 ₽/сут. Средняя точка: 6750. Требует регулярной проверки через gelendzhik.travel.'
FROM competitor_sources cs
WHERE cs.url = 'https://gelendzhik.travel/kvartiri/kv-na-kurzalnoj-19.html'
  AND NOT EXISTS (
    SELECT 1 FROM competitor_price_observations cpo
    WHERE cpo.competitor_source_id = cs.id
      AND cpo.collection_method = 'seed_from_pdf_report'
      AND cpo.stay_date_from = '2026-06-01'
);

-- Октябрьская — confidence 0.80
INSERT INTO competitor_price_observations (
    competitor_source_id, stay_date_from, stay_date_to, nights,
    price_per_night, collection_method, confidence, notes
)
SELECT cs.id, '2026-06-01', '2026-08-31', 91,
       5500, 'seed_from_pdf_report', 0.80,
       'Стартовая оценка из аналитического отчёта 2026-05-13. Диапазон PDF: 5000–6000 ₽/сут. Средняя точка: 5500. Требует регулярной проверки через gelendzhik.travel.'
FROM competitor_sources cs
WHERE cs.url = 'https://gelendzhik.travel/vse-zhilyo/etazh/na-oktyabrskoy.html'
  AND NOT EXISTS (
    SELECT 1 FROM competitor_price_observations cpo
    WHERE cpo.competitor_source_id = cs.id
      AND cpo.collection_method = 'seed_from_pdf_report'
      AND cpo.stay_date_from = '2026-06-01'
);

-- Полевая 29 — confidence 0.65
INSERT INTO competitor_price_observations (
    competitor_source_id, stay_date_from, stay_date_to, nights,
    price_per_night, collection_method, confidence, notes
)
SELECT cs.id, '2026-06-01', '2026-08-31', 91,
       6500, 'seed_from_pdf_report', 0.65,
       'Стартовая оценка из аналитического отчёта 2026-05-13. Цена 2020 была 2000–3500, но рынок 2026 по аналогичным объектам достигает ~6000–7000. Требует перепроверки через travelandia.ru.'
FROM competitor_sources cs
WHERE cs.url = 'https://travelandia.ru/gelendzhik/kvartiry/dvuhkomnatnaya-kvartira-13-3353/'
  AND NOT EXISTS (
    SELECT 1 FROM competitor_price_observations cpo
    WHERE cpo.competitor_source_id = cs.id
      AND cpo.collection_method = 'seed_from_pdf_report'
      AND cpo.stay_date_from = '2026-06-01'
);

-- ── Sync seed prices to competitor_prices (for C1 compatibility) ──────────────
-- Курзальная 19
INSERT INTO competitor_prices
    (source, title, url, location, max_guests, rooms, date_from, date_to,
     price_per_night, rating, reviews_count, notes)
SELECT 'gelendzhik.travel',
       'Двухкомнатная квартира на Курзальной 19',
       'https://gelendzhik.travel/kvartiri/kv-na-kurzalnoj-19.html',
       'ул. Курзальная, 19 — Толстый мыс, Геленджик',
       5, 2,
       '2026-06-01'::date, '2026-08-31'::date,
       6750, NULL, NULL,
       'seed_from_competitor_report — similarity 95%'
WHERE NOT EXISTS (
    SELECT 1 FROM competitor_prices
    WHERE url = 'https://gelendzhik.travel/kvartiri/kv-na-kurzalnoj-19.html'
);

-- Октябрьская
INSERT INTO competitor_prices
    (source, title, url, location, max_guests, rooms, date_from, date_to,
     price_per_night, rating, reviews_count, notes)
SELECT 'gelendzhik.travel',
       'Этаж под ключ на Октябрьской',
       'https://gelendzhik.travel/vse-zhilyo/etazh/na-oktyabrskoy.html',
       'ул. Октябрьская — центр Геленджика',
       5, 2,
       '2026-06-01'::date, '2026-08-31'::date,
       5500, NULL, NULL,
       'seed_from_competitor_report — similarity 93%'
WHERE NOT EXISTS (
    SELECT 1 FROM competitor_prices
    WHERE url = 'https://gelendzhik.travel/vse-zhilyo/etazh/na-oktyabrskoy.html'
);

-- Полевая 29
INSERT INTO competitor_prices
    (source, title, url, location, max_guests, rooms, date_from, date_to,
     price_per_night, rating, reviews_count, notes)
SELECT 'travelandia.ru',
       'Двухкомнатная квартира ул. Полевая 29',
       'https://travelandia.ru/gelendzhik/kvartiry/dvuhkomnatnaya-kvartira-13-3353/',
       'ул. Полевая, 29 — Толстый мыс, Геленджик',
       6, 2,
       '2026-06-01'::date, '2026-08-31'::date,
       6500, NULL, NULL,
       'seed_from_competitor_report — similarity 85%'
WHERE NOT EXISTS (
    SELECT 1 FROM competitor_prices
    WHERE url = 'https://travelandia.ru/gelendzhik/kvartiry/dvuhkomnatnaya-kvartira-13-3353/'
);

-- ── System vars: C1.5 metadata ────────────────────────────────────────────────
INSERT INTO system_vars (key, value, description)
VALUES
    ('c15_competitor_sources_version', '1', 'Competitor sources version (C1.5 seed from PDF 2026-05-13)'),
    ('c15_market_min_score_threshold', '80', 'Min similarity_score to include in market median calculation')
ON CONFLICT (key) DO NOTHING;
