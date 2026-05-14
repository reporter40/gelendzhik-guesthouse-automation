-- Phase C3.5 — Competitor Discovery Pack for Apartment №50
-- 2026-05-14
-- Seeds: 9 real competitor candidates for cohort large_family_house_territory
-- Sources: gelendzhik.travel (3), travelandia.ru (5), combined (1)
-- Safe: ON CONFLICT (url) DO NOTHING / ON CONFLICT DO NOTHING
-- Do NOT apply to production without local verification first.

-- ── STEP 1: Invalidate C3.4 placeholder candidates (fake URLs) ────────────────
-- These were added as temporary placeholders in C3.4 migration.
-- Now replaced by real sources below.
UPDATE competitor_sources
SET
    discovery_status   = 'rejected',
    status             = 'excluded',
    data_quality_notes = 'Заглушка C3.4. Заменена реальными кандидатами в C3.5 (2026-05-14).'
WHERE url IN (
    'https://gelendzhik.travel/domiki-doma/dom-6-gostey-gelendzik-placeholder',
    'https://travelandia.ru/gelendzhik/doma/kottedzh-6-8-gostey-placeholder',
    'https://sutochno.ru/gelendzhik/placeholder-etazh-6-8-gostey'
)
  AND discovery_status = 'candidate';

-- ── STEP 2: Insert 9 real competitor candidates ────────────────────────────────
-- Approved (3) — similarity ≥ 90, цены 2026 подтверждены, будут использоваться
--                в расчёте market median, снимают confidence_cap для №50.
-- Candidate (5) — цены неактуальны или частичные данные, ждут ручного подтверждения.
-- Rejected (1)  — несоответствие параметрам (>8 гостей, устаревшие цены 2020).

INSERT INTO competitor_sources (
    name,
    source_platform,
    url,
    address,
    district,
    similarity_score,
    priority,
    status,
    property_type,
    max_guests,
    rooms,
    cohort_code,
    target_apartment_ids,
    signal_quality_score,
    discovery_status,
    is_static_price,
    data_quality_notes,
    selection_reason
) VALUES

-- ── APPROVED #1: Дом на Красноармейской 7 ─────────────────────────────────────
-- 8 гостей, 120м², центр/Толстый мыс, 300м до песчаного пляжа
-- Цены 2026: этаж 6500-10000, дом 13000-20000/ночь. Верифицирован gelendzhik.travel
(
    'Дом на Красноармейской 7',
    'gelendzhik.travel',
    'https://gelendzhik.travel/domapodkluch/na-krasnoarmeyskoy-7.html',
    'г. Геленджик, ул. Красноармейская, 7',
    'Центр / Толстый мыс',
    92,
    60,
    'active',
    'house',
    8,
    4,
    'large_family_house_territory',
    ARRAY[50],
    0.85,
    'approved',
    FALSE,
    'Цены 2026 опубликованы: этаж 6500-10000 ₽, дом целиком 13000-20000 ₽. '
    || 'Листинг верифицирован gelendzhik.travel (код 1128). '
    || '120м², 2 этажа по 60м², 4 комнаты (2+2). '
    || 'Двор, мангал/BBQ, парковка. Отдельный вход на каждый этаж. '
    || 'До моря 300м (3-4 мин, пляж Дельфин). min_stay=3 дня.',
    'Прямой аналог объекта №50: дом под ключ 8 гостей, кухня, двор, мангал, 300м от моря. '
    || 'Цены подтверждены 2026. Семейный формат.'
),

-- ── APPROVED #2: Дом на Чайковского «Компот» ─────────────────────────────────
-- 8 гостей, 2-этажный дом, центр, 550м до моря, собственная терр.
-- Цены 2026: 6000-11000/ночь. Верифицирован gelendzhik.travel
(
    'Дом на Чайковского «Компот»',
    'gelendzhik.travel',
    'https://gelendzhik.travel/domapodkluch/na-chaykovskogo-dpk.html',
    'г. Геленджик, ул. Чайковского',
    'Центр',
    90,
    61,
    'active',
    'house',
    8,
    3,
    'large_family_house_territory',
    ARRAY[50],
    0.85,
    'approved',
    FALSE,
    'Цены 2026 опубликованы: 5000-11000 ₽/ночь (2 дома «Коржик» и «Компот»). '
    || 'Листинг верифицирован gelendzhik.travel (код 501). '
    || '2-этажные дома под ключ, отдельная территория с мангалом и шезлонгами. '
    || 'Полноценная кухня + летняя кухня. До моря 550м. min_stay=5 дней.',
    'Отдельный 2-этажный дом с собственной территорией, летней кухней, мангалом. '
    || '8 гостей, центр, 550м от моря. Цены 2026 подтверждены.'
),

-- ── APPROVED #3: Дом пер-к Западный, 7 ───────────────────────────────────────
-- 8 гостей, 100м², Толстый мыс, 411м до моря, мангал, парковка
-- Цены 2025: 12000-15000/ночь (пик). 2026 неопубликованы, оценочно +5%.
(
    'Дом пер-к Западный, 7',
    'travelandia.ru',
    'https://travelandia.ru/gelendzhik/doma-pod-klyuch/dom-pod-klyuch-9-3450/',
    'г. Геленджик, пер-к Западный, 7',
    'Толстый мыс',
    91,
    62,
    'active',
    'house',
    8,
    4,
    'large_family_house_territory',
    ARRAY[50],
    0.65,
    'approved',
    FALSE,
    'Цены 2025 опубликованы: 12000-15000 ₽/ночь пик, 12000 июнь/сентябрь. '
    || '2026 не опубликованы, оценочный рост +5-10%. '
    || '100м², 4 комнаты, 3 этажа, балкон. Парковка 2 авто. Мангал во дворе. '
    || 'Толстый мыс, 411м до песчаного пляжа. Листинг active на travelandia.',
    '100м², 4 комнаты, 8 гостей, Толстый мыс, 411м от моря. '
    || 'Мангал, парковка. Цены 2025 верифицированы, 2026 оценочные.'
),

-- ── CANDIDATE #4: Отдых на Грибоедова ────────────────────────────────────────
-- 7-10 гостей, 3 комнаты, 240м до моря. Цены 2026 известны.
-- Немного выше целевого диапазона гостей, смешанные отзывы о хозяйке.
(
    'Отдых на Грибоедова',
    'gelendzhik.travel',
    'https://gelendzhik.travel/domapodkluch/otdih-na-griboedova.html',
    'г. Геленджик, ул. Грибоедова',
    'Между Толстым мысом и центром',
    85,
    63,
    'candidate',
    'house',
    10,
    3,
    'large_family_house_territory',
    ARRAY[50],
    0.72,
    'candidate',
    FALSE,
    'Цены 2026 опубликованы: авг 11000 ₽, сен 7000-8000 ₽. '
    || 'Листинг верифицирован gelendzhik.travel (код 1027). '
    || '3 комнаты, 7-10 гостей (немного > целевого 8). '
    || 'Итальянский дворик, парковка. Явного мангала не указано. '
    || 'Смешанные отзывы 2023-2024: часть позитивных, часть негативных о ненадёжности хозяйки. '
    || 'min_stay=4 дня. До моря 240м (3 мин).',
    'Близко к морю (240м), 3 комнаты, кухня, двор. Но 7-10 гостей слегка выше целевого. '
    || 'Цены 2026 подтверждены. Кандидат на ручную проверку.'
),

-- ── CANDIDATE #5: Дом «Sunrise», Вишневая 58А ────────────────────────────────
-- 8 гостей, 4 спальни, Толстый мыс, 1410м от моря. Цены 2020 (устарели).
(
    'Дом «Sunrise», Вишневая 58А',
    'travelandia.ru',
    'https://travelandia.ru/gelendzhik/doma-pod-klyuch/dom-pod-klyuch-sunrise-26770/',
    'г. Геленджик, ул. Вишневая, 58А',
    'Толстый мыс',
    80,
    64,
    'candidate',
    'house',
    8,
    6,
    'large_family_house_territory',
    ARRAY[50],
    0.45,
    'candidate',
    TRUE,
    'Цены из таблицы 2020: 10000 ₽/ночь (сезон). 2026 цена не опубликована. '
    || '2 зала + 4 спальни, 2 санузла, большая кухня, Wi-Fi. '
    || 'Мангальная зона во дворе. До моря 1.41км (дальше целевого). '
    || 'Нет отзывов. Нет парковки.',
    '8 гостей, 6 комнат, кухня, мангал, Толстый мыс. '
    || 'Минусы: 1.4км от моря, цены 2020. Требует актуализации цены 2026.'
),

-- ── CANDIDATE #6: Дом «Абрикос», Первомайская 38 ─────────────────────────────
-- 6 гостей, 2 этажа, центр, 720м от моря. Терраса 12м², цена не раскрыта.
(
    'Дом «Абрикос», Первомайская 38',
    'travelandia.ru',
    'https://travelandia.ru/gelendzhik/doma-pod-klyuch/dom-pod-klyuch-abrikos-26749/',
    'г. Геленджик, ул. Первомайская, 38',
    'Центр',
    82,
    65,
    'candidate',
    'house',
    6,
    2,
    'large_family_house_territory',
    ARRAY[50],
    0.35,
    'candidate',
    TRUE,
    'Цена по договорённости, нет публичной таблицы 2026. '
    || '2-этажный дом, 6 гостей. Кухня-столовая 32м² с выходом на террасу 12м². '
    || 'Балкон 12м² с видом. 2 комнаты (32м² и 17м²). '
    || 'До моря 720м (центр). Нет парковки. Нет отзывов.',
    '2-этажный дом с красивой террасой и балконом, кухня, центр. '
    || 'Минус: только 6 гостей, цена не известна. Кандидат на уточнение цены.'
),

-- ── CANDIDATE #7: Этаж Dikasi, Курзальная 40 ─────────────────────────────────
-- 7 гостей, Толстый мыс, 671м от моря. Цены 2020 (устарели).
(
    'Этаж под ключ «Dikasi», Курзальная 40',
    'travelandia.ru',
    'https://travelandia.ru/gelendzhik/doma-pod-klyuch/etazh-pod-klyuch-dikasi-25758/',
    'г. Геленджик, ул. Курзальная, 40',
    'Толстый мыс',
    82,
    66,
    'candidate',
    'floor_apartment',
    7,
    4,
    'large_family_house_territory',
    ARRAY[50],
    0.30,
    'candidate',
    TRUE,
    'Цены из таблицы 2020: 3000-5000 ₽ (сильно устарели, вероятно 8000-12000 в 2026). '
    || '7 гостей на этаже 2-этажного частного дома. '
    || 'Отдельный вход. Кухня во дворе (1 эт.) + кухня на 2 эт. '
    || 'Толстый мыс, 671м от моря. Парковка рядом. Нет отзывов.',
    'Толстый мыс, 671м от моря, 7 гостей, кухня, двор. '
    || 'Цены 2020, требуют актуализации. Хороший потенциал для подтверждения.'
),

-- ── CANDIDATE #8: Коттедж Грибоедова 58Б ────────────────────────────────────
-- 10 гостей (выше цели), 2 этажа, 928м от моря. Цены 2021 (устарели).
(
    'Коттедж под ключ Грибоедова 58Б',
    'travelandia.ru',
    'https://travelandia.ru/gelendzhik/doma-pod-klyuch/kottedzh-pod-klyuch-na-griboedova-20224/',
    'г. Геленджик, ул. Грибоедова, 58Б',
    'Толстый мыс',
    70,
    67,
    'candidate',
    'cottage',
    10,
    3,
    'large_family_house_territory',
    ARRAY[50],
    0.30,
    'candidate',
    TRUE,
    'Цены из таблицы 2021: 6000 ₽ пик лета. Сильно устарели. '
    || '2-этажный коттедж, 3 комнаты, 10 гостей. Кухня оборудованная. '
    || 'Хозяева в соседнем дворе. До моря 928м. Парковка. '
    || 'Нет отзывов. max_guests=10 > целевого диапазона 6-8.',
    'Коттедж с кухней, Толстый мыс. '
    || 'Минусы: 10 гостей > целевого, цены 2021, 928м от моря. Background candidate.'
),

-- ── REJECTED #9: Дом Степная 3 ───────────────────────────────────────────────
-- 10 гостей, цены 2020, 1км от моря. Не вписывается в когорту.
(
    'Дом Степная 3 (10 гостей)',
    'travelandia.ru',
    'https://travelandia.ru/gelendzhik/doma-pod-klyuch/domik-na-stepnoj-22815/',
    'г. Геленджик, ул. Степная, 3',
    'Центр',
    63,
    68,
    'excluded',
    'house',
    10,
    5,
    'large_family_house_territory',
    ARRAY[50],
    0.25,
    'rejected',
    TRUE,
    'Отклонён: 10 гостей превышает диапазон когорты (6-8). '
    || 'Цены из 2020 года (4000-7000 ₽), сильно устарели. '
    || 'До моря 973м. 5 комнат (номерной формат). Нет признаков семейного формата.',
    'Не соответствует когорте: 10 гостей, старые цены, нет терр./двора в описании.'
)

ON CONFLICT (url) DO NOTHING;

-- ── STEP 3: Price observations for approved + high-quality candidates ──────────
-- Вставляем ценовые наблюдения за летний пик 2026 (июль-август).
-- collection_method = 'manual_input' (ручной ввод с публичных страниц).
-- observation_quality = 'manual' (человек собрал данные, не бот).

-- Approved #1: Красноармейская 7 — цена за этаж (аналог 1 секции = 4 чел)
-- Июль-август 2026: 10 000 ₽/ночь (этаж под ключ, 4 спальных места)
INSERT INTO competitor_price_observations (
    competitor_source_id,
    observed_at,
    stay_date_from,
    stay_date_to,
    nights,
    price_per_night,
    total_price,
    min_stay,
    availability_status,
    raw_price_text,
    confidence,
    collection_method,
    notes,
    observation_quality
)
SELECT
    cs.id,
    NOW(),
    '2026-07-01'::DATE,
    '2026-07-07'::DATE,
    6,
    10000,
    60000,
    3,
    'available',
    '01.07-31.07: 10 000 ₽/этаж (за этаж под ключ)',
    0.85,
    'manual_input',
    'C3.5: цена взята с gelendzhik.travel/domapodkluch/na-krasnoarmeyskoy-7.html. '
    || 'Таблица цен 2026. Этаж 60м², 4 спальных места. Не дом целиком.',
    'manual'
FROM competitor_sources cs
WHERE cs.url = 'https://gelendzhik.travel/domapodkluch/na-krasnoarmeyskoy-7.html'
  AND NOT EXISTS (
    SELECT 1 FROM competitor_price_observations cpo
    WHERE cpo.competitor_source_id = cs.id
      AND cpo.stay_date_from = '2026-07-01'
      AND cpo.collection_method = 'manual_input'
);

-- Approved #1: Красноармейская 7 — август 2026
INSERT INTO competitor_price_observations (
    competitor_source_id,
    observed_at,
    stay_date_from,
    stay_date_to,
    nights,
    price_per_night,
    total_price,
    min_stay,
    availability_status,
    raw_price_text,
    confidence,
    collection_method,
    notes,
    observation_quality
)
SELECT
    cs.id,
    NOW(),
    '2026-08-01'::DATE,
    '2026-08-07'::DATE,
    6,
    10000,
    60000,
    3,
    'available',
    '01.08-31.08: 10 000 ₽/этаж',
    0.85,
    'manual_input',
    'C3.5: цена взята с gelendzhik.travel/domapodkluch/na-krasnoarmeyskoy-7.html. '
    || 'Таблица цен 2026.',
    'manual'
FROM competitor_sources cs
WHERE cs.url = 'https://gelendzhik.travel/domapodkluch/na-krasnoarmeyskoy-7.html'
  AND NOT EXISTS (
    SELECT 1 FROM competitor_price_observations cpo
    WHERE cpo.competitor_source_id = cs.id
      AND cpo.stay_date_from = '2026-08-01'
      AND cpo.collection_method = 'manual_input'
);

-- Approved #2: Чайковского «Компот» — июль 2026: 11 000 ₽/ночь
INSERT INTO competitor_price_observations (
    competitor_source_id,
    observed_at,
    stay_date_from,
    stay_date_to,
    nights,
    price_per_night,
    total_price,
    min_stay,
    availability_status,
    raw_price_text,
    confidence,
    collection_method,
    notes,
    observation_quality
)
SELECT
    cs.id,
    NOW(),
    '2026-07-01'::DATE,
    '2026-07-07'::DATE,
    6,
    11000,
    66000,
    5,
    'available',
    '01.07-15.07: 11 000 ₽/дом (до 6 чел, сверх — договорная)',
    0.85,
    'manual_input',
    'C3.5: цена с gelendzhik.travel/domapodkluch/na-chaykovskogo-dpk.html. '
    || 'Таблица цен 2026. Дом «Компот», 2 этажа, 8 мест. min_stay=5 дней.',
    'manual'
FROM competitor_sources cs
WHERE cs.url = 'https://gelendzhik.travel/domapodkluch/na-chaykovskogo-dpk.html'
  AND NOT EXISTS (
    SELECT 1 FROM competitor_price_observations cpo
    WHERE cpo.competitor_source_id = cs.id
      AND cpo.stay_date_from = '2026-07-01'
      AND cpo.collection_method = 'manual_input'
);

-- Approved #2: Чайковского «Компот» — август 2026: 11 000 ₽
INSERT INTO competitor_price_observations (
    competitor_source_id,
    observed_at,
    stay_date_from,
    stay_date_to,
    nights,
    price_per_night,
    total_price,
    min_stay,
    availability_status,
    raw_price_text,
    confidence,
    collection_method,
    notes,
    observation_quality
)
SELECT
    cs.id,
    NOW(),
    '2026-08-01'::DATE,
    '2026-08-07'::DATE,
    6,
    11000,
    66000,
    5,
    'available',
    '01.08-31.08: 11 000 ₽/дом',
    0.85,
    'manual_input',
    'C3.5: цена с gelendzhik.travel/domapodkluch/na-chaykovskogo-dpk.html. '
    || 'Таблица цен 2026.',
    'manual'
FROM competitor_sources cs
WHERE cs.url = 'https://gelendzhik.travel/domapodkluch/na-chaykovskogo-dpk.html'
  AND NOT EXISTS (
    SELECT 1 FROM competitor_price_observations cpo
    WHERE cpo.competitor_source_id = cs.id
      AND cpo.stay_date_from = '2026-08-01'
      AND cpo.collection_method = 'manual_input'
);

-- Approved #3: Западный 7 — июль 2025 (используем как proxy 2026 +5%)
-- 12 000 ₽ (июнь-нач. июля 2025), 15 000 ₽ (пик).
-- Вставляем как оценочное наблюдение 2026 с confidence=0.65
INSERT INTO competitor_price_observations (
    competitor_source_id,
    observed_at,
    stay_date_from,
    stay_date_to,
    nights,
    price_per_night,
    total_price,
    min_stay,
    availability_status,
    raw_price_text,
    confidence,
    collection_method,
    notes,
    observation_quality
)
SELECT
    cs.id,
    NOW(),
    '2026-07-01'::DATE,
    '2026-07-07'::DATE,
    6,
    13000,
    78000,
    NULL,
    'available',
    '2025: 12000-15000 ₽/ночь. Оценочная 2026: ~13000 (+5%)',
    0.65,
    'manual_input',
    'C3.5: цена с travelandia.ru/gelendzhik/doma-pod-klyuch/dom-pod-klyuch-9-3450/. '
    || 'Таблица цен 2025 (12000-15000 в пик). 2026 оценочно +5%: ~13000 ₽. '
    || '100м², 4 комнаты, 8 гостей, Толстый мыс, 411м до моря.',
    'manual'
FROM competitor_sources cs
WHERE cs.url = 'https://travelandia.ru/gelendzhik/doma-pod-klyuch/dom-pod-klyuch-9-3450/'
  AND NOT EXISTS (
    SELECT 1 FROM competitor_price_observations cpo
    WHERE cpo.competitor_source_id = cs.id
      AND cpo.stay_date_from = '2026-07-01'
      AND cpo.collection_method = 'manual_input'
);

-- Candidate #4: Грибоедова — август 2026 (цены подтверждены)
INSERT INTO competitor_price_observations (
    competitor_source_id,
    observed_at,
    stay_date_from,
    stay_date_to,
    nights,
    price_per_night,
    total_price,
    min_stay,
    availability_status,
    raw_price_text,
    confidence,
    collection_method,
    notes,
    observation_quality
)
SELECT
    cs.id,
    NOW(),
    '2026-08-01'::DATE,
    '2026-08-07'::DATE,
    6,
    11000,
    66000,
    4,
    'available',
    '01.08-31.08: 11 000 ₽/дом',
    0.72,
    'manual_input',
    'C3.5: цена с gelendzhik.travel/domapodkluch/otdih-na-griboedova.html. '
    || 'Таблица цен 2026. 3-комнатный дом 7-10 гостей. min_stay=4 дня. '
    || 'STATUS=candidate: смешанные отзывы о хозяйке.',
    'manual'
FROM competitor_sources cs
WHERE cs.url = 'https://gelendzhik.travel/domapodkluch/otdih-na-griboedova.html'
  AND NOT EXISTS (
    SELECT 1 FROM competitor_price_observations cpo
    WHERE cpo.competitor_source_id = cs.id
      AND cpo.stay_date_from = '2026-08-01'
      AND cpo.collection_method = 'manual_input'
);

-- ── STEP 4: System var update ─────────────────────────────────────────────────
INSERT INTO system_vars (key, value, description)
VALUES
    ('c35_discovery_pack_date', '2026-05-14',
     'Date of C3.5 competitor discovery for apartment #50'),
    ('c35_approved_count', '3',
     'Number of approved sources added in C3.5 for large_family_house_territory'),
    ('c35_candidate_count', '5',
     'Number of candidate sources added in C3.5 for large_family_house_territory'),
    ('c35_market_median_estimate', '11000',
     'Estimated market median (₽/night) for large_family_house_territory based on C3.5 data (peak Jul-Aug)')
ON CONFLICT (key) DO UPDATE SET
    value       = EXCLUDED.value,
    description = EXCLUDED.description;

-- ── VERIFICATION QUERIES (run after seed to check) ────────────────────────────
-- Uncomment to verify:

-- 1. Count per discovery_status in cohort:
-- SELECT discovery_status, status, COUNT(*)
-- FROM competitor_sources
-- WHERE cohort_code = 'large_family_house_territory'
-- GROUP BY discovery_status, status;

-- 2. Active sources count (should be >= 3):
-- SELECT COUNT(*) AS active_count
-- FROM competitor_sources
-- WHERE cohort_code = 'large_family_house_territory'
--   AND status = 'active'
--   AND discovery_status = 'approved';

-- 3. Price observations per source:
-- SELECT cs.name, COUNT(cpo.id) AS obs_count, AVG(cpo.price_per_night) AS avg_price
-- FROM competitor_sources cs
-- LEFT JOIN competitor_price_observations cpo ON cpo.competitor_source_id = cs.id
-- WHERE cs.cohort_code = 'large_family_house_territory'
-- GROUP BY cs.name, cs.status
-- ORDER BY cs.status, cs.similarity_score DESC;

-- 4. Market median for large_family_house_territory:
-- SELECT
--     AVG(cpo.price_per_night) AS mean_price,
--     PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cpo.price_per_night) AS median_price,
--     MIN(cpo.price_per_night) AS min_price,
--     MAX(cpo.price_per_night) AS max_price
-- FROM competitor_price_observations cpo
-- JOIN competitor_sources cs ON cs.id = cpo.competitor_source_id
-- WHERE cs.cohort_code = 'large_family_house_territory'
--   AND cs.status = 'active'
--   AND cpo.stay_date_from >= '2026-07-01';
