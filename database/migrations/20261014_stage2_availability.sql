-- Этап 2: своя синхронизация занятости вместо RealtyCalendar.
-- Заменяет неприменённый черновик 2026_09_12_unified_availability.sql (тот не применять).
--
-- Принципы:
--  * занятость хранится как DATE, отрезок [check_in, check_out): выезд и заезд в один день — не пересечение;
--  * снимок источника применяется целиком функцией avail_apply_snapshot(): upsert + удаление пропавших
--    БУДУЩИХ блоков (check_out > сегодня), с защитой от пустой/обрезанной выгрузки;
--  * выгрузка для площадок — avail_export_ics(): все источники, кроме самой площадки, VALUE=DATE,
--    UID <id>@<наш хост>, SUMMARY «Занято»; без верного токена — NULL (WF17 отдаёт 404);
--  * наши собственные события при импорте отбрасываются (по домену UID) — защита от петель.
-- Идемпотентна.

BEGIN;

CREATE TABLE IF NOT EXISTS avail_source (
  id              SERIAL PRIMARY KEY,
  platform        TEXT NOT NULL CHECK (platform IN ('avito','gcal','cian','sutochno','ostrovok','yandex','other')),
  apartment_id    VARCHAR(20) NOT NULL REFERENCES apartments(id),
  kind            TEXT NOT NULL CHECK (kind IN ('ical','avito_api')),
  ical_url        TEXT,
  avito_item_id   BIGINT,
  label           TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT false,
  stale_after     INTERVAL NOT NULL DEFAULT '4 hours',
  last_synced_at  TIMESTAMPTZ,
  last_status     TEXT,
  last_error      TEXT,
  last_count      INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, apartment_id, kind),
  CHECK ((kind = 'ical' AND ical_url IS NOT NULL) OR (kind = 'avito_api' AND avito_item_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS avail_block (
  id            BIGSERIAL PRIMARY KEY,
  source_id     INT NOT NULL REFERENCES avail_source(id) ON DELETE CASCADE,
  apartment_id  VARCHAR(20) NOT NULL REFERENCES apartments(id),
  platform      TEXT NOT NULL,
  external_uid  TEXT NOT NULL,
  check_in      DATE NOT NULL,
  check_out     DATE NOT NULL,
  summary       TEXT,
  raw           JSONB,
  first_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_uid),
  CHECK (check_out > check_in)
);
CREATE INDEX IF NOT EXISTS ix_avail_block_apt ON avail_block (apartment_id, check_in, check_out);

-- ссылка экспорта: своя пара «площадка — объект», случайный токен
CREATE TABLE IF NOT EXISTS avail_export (
  platform      TEXT NOT NULL,
  apartment_id  VARCHAR(20) NOT NULL REFERENCES apartments(id),
  token         TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (platform, apartment_id)
);

-- антиспам сторожа: не чаще раза в час на одну проблему
CREATE TABLE IF NOT EXISTS avail_alert (
  key           TEXT PRIMARY KEY,
  last_sent_at  TIMESTAMPTZ NOT NULL
);

-- состояние записи календаря Avito (идемпотентность по хэшу)
CREATE TABLE IF NOT EXISTS avito_push_state (
  avito_item_id   BIGINT PRIMARY KEY,
  apartment_id    VARCHAR(20) NOT NULL REFERENCES apartments(id),
  last_hash       TEXT,
  last_pushed_at  TIMESTAMPTZ,
  last_status     TEXT,
  last_error      TEXT
);

INSERT INTO system_vars (key, value, description) VALUES
  ('avail_own_uid_domain', 'avail.aquatoring', 'Домен UID наших событий в выгрузке iCal (петли отбрасываются по нему)'),
  ('avito_push_enabled',   'false',            'Писать занятость в календарь Avito (включать только после приёмки)'),
  ('avail_horizon_days',   '365',              'Горизонт выгрузки/записи занятости, дней'),
  ('avito_account_id',     '85983062',         'Аккаунт Avito (user_id) для API краткосрочной аренды')
ON CONFLICT (key) DO NOTHING;

-- Применить снимок источника.
-- p_events: [{"uid":..,"check_in":"YYYY-MM-DD","check_out":"YYYY-MM-DD","summary":..}, ...]
-- p_complete: загрузка успешна целиком (валидный VCALENDAR/JSON, все страницы). Иначе ничего не удаляем.
-- p_keep_past_checkin: для Avito API (не отдаёт брони с заездом в прошлом) — не удалять блоки с check_in < сегодня.
CREATE OR REPLACE FUNCTION avail_apply_snapshot(p_source_id INT, p_events JSONB, p_complete BOOLEAN,
                                                p_keep_past_checkin BOOLEAN DEFAULT false)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  src           avail_source%ROWTYPE;
  own_domain    TEXT := (SELECT value FROM system_vars WHERE key = 'avail_own_uid_domain');
  today         DATE := (now() AT TIME ZONE 'Europe/Moscow')::date;
  v_upserted    INT := 0;
  v_skipped_own INT := 0;
  v_invalid     INT := 0;
  v_future_before INT;
  v_future_after  INT;
  v_to_delete   INT := 0;
  v_deleted     INT := 0;
  v_status      TEXT;
  v_guard       TEXT := NULL;
BEGIN
  SELECT * INTO src FROM avail_source WHERE id = p_source_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'avail_source % not found', p_source_id; END IF;

  CREATE TEMP TABLE IF NOT EXISTS _snap (uid TEXT PRIMARY KEY, check_in DATE, check_out DATE, summary TEXT, raw JSONB) ON COMMIT DROP;
  TRUNCATE _snap;

  -- валидные события снимка, без наших собственных (петли)
  INSERT INTO _snap (uid, check_in, check_out, summary, raw)
  SELECT DISTINCT ON (e->>'uid') e->>'uid', (e->>'check_in')::date, (e->>'check_out')::date, e->>'summary', e
    FROM jsonb_array_elements(COALESCE(p_events, '[]'::jsonb)) e
   WHERE COALESCE(e->>'uid','') <> ''
     AND (e->>'check_in') ~ '^\d{4}-\d{2}-\d{2}$' AND (e->>'check_out') ~ '^\d{4}-\d{2}-\d{2}$'
     AND (e->>'check_out')::date > (e->>'check_in')::date
     AND (own_domain IS NULL OR position('@' || own_domain IN e->>'uid') = 0);

  SELECT count(*) FILTER (WHERE COALESCE(e->>'uid','') <> '' AND own_domain IS NOT NULL AND position('@' || own_domain IN e->>'uid') > 0)
    INTO v_skipped_own FROM jsonb_array_elements(COALESCE(p_events, '[]'::jsonb)) e;
  v_invalid := jsonb_array_length(COALESCE(p_events, '[]'::jsonb)) - (SELECT count(*) FROM _snap) - v_skipped_own;

  INSERT INTO avail_block (source_id, apartment_id, platform, external_uid, check_in, check_out, summary, raw)
  SELECT src.id, src.apartment_id, src.platform, s.uid, s.check_in, s.check_out, s.summary, s.raw FROM _snap s
  ON CONFLICT (source_id, external_uid) DO UPDATE
     SET check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out, summary = EXCLUDED.summary,
         raw = EXCLUDED.raw, last_seen = now();
  GET DIAGNOSTICS v_upserted = ROW_COUNT;

  IF p_complete THEN
    SELECT count(*) INTO v_future_before FROM avail_block
     WHERE source_id = src.id AND check_out > today;
    SELECT count(*) INTO v_future_after FROM _snap WHERE check_out > today;
    SELECT count(*) INTO v_to_delete FROM avail_block b
     WHERE b.source_id = src.id AND b.check_out > today
       AND NOT (p_keep_past_checkin AND b.check_in < today)
       AND NOT EXISTS (SELECT 1 FROM _snap s WHERE s.uid = b.external_uid);

    -- защита: источник внезапно опустел или потерял больше половины будущих событий
    IF v_to_delete > 0 AND (v_future_after = 0 OR v_to_delete * 2 > v_future_before) THEN
      v_guard := format('guard: было будущих %s, пропало бы %s — удаление пропущено', v_future_before, v_to_delete);
    ELSE
      DELETE FROM avail_block b
       WHERE b.source_id = src.id AND b.check_out > today
         AND NOT (p_keep_past_checkin AND b.check_in < today)
         AND NOT EXISTS (SELECT 1 FROM _snap s WHERE s.uid = b.external_uid);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
    END IF;
  END IF;

  v_status := CASE WHEN NOT p_complete THEN 'error' WHEN v_guard IS NOT NULL THEN 'guard' ELSE 'ok' END;
  UPDATE avail_source
     SET last_synced_at = CASE WHEN p_complete THEN now() ELSE last_synced_at END,
         last_status = v_status,
         last_error = CASE WHEN v_status = 'ok' THEN NULL ELSE COALESCE(v_guard, last_error) END,
         last_count = (SELECT count(*) FROM _snap)
   WHERE id = src.id;

  RETURN jsonb_build_object('source_id', src.id, 'platform', src.platform, 'apartment_id', src.apartment_id,
    'status', v_status, 'events', (SELECT count(*) FROM _snap), 'upserted', v_upserted, 'deleted', v_deleted,
    'skipped_own', v_skipped_own, 'invalid', v_invalid, 'guard', v_guard);
END $$;

-- Ошибка загрузки источника: ничего не удаляем, только статус.
CREATE OR REPLACE FUNCTION avail_mark_error(p_source_id INT, p_error TEXT) RETURNS VOID LANGUAGE sql AS $$
  UPDATE avail_source SET last_status = 'error', last_error = left(p_error, 500) WHERE id = p_source_id;
$$;

-- Занятость объекта из всех источников, кроме указанной площадки (NULL — все), на горизонт.
CREATE OR REPLACE FUNCTION avail_busy(p_apartment_id VARCHAR, p_exclude_platform TEXT DEFAULT NULL)
RETURNS TABLE (block_id BIGINT, platform TEXT, check_in DATE, check_out DATE) LANGUAGE sql STABLE AS $$
  SELECT b.id, b.platform, b.check_in, b.check_out
    FROM avail_block b JOIN avail_source s ON s.id = b.source_id AND s.enabled
   WHERE b.apartment_id = p_apartment_id
     AND (p_exclude_platform IS NULL OR b.platform <> p_exclude_platform)
     AND b.check_out > (now() AT TIME ZONE 'Europe/Moscow')::date
     AND b.check_in < (now() AT TIME ZONE 'Europe/Moscow')::date
                      + (SELECT value::int FROM system_vars WHERE key = 'avail_horizon_days')
   ORDER BY b.check_in;
$$;

-- iCal-выгрузка для площадки. NULL, если токен не подходит.
CREATE OR REPLACE FUNCTION avail_export_ics(p_platform TEXT, p_apartment_id VARCHAR, p_token TEXT)
RETURNS TEXT LANGUAGE plpgsql STABLE AS $$
DECLARE
  own_domain TEXT := (SELECT value FROM system_vars WHERE key = 'avail_own_uid_domain');
  body TEXT := '';
  r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM avail_export
                  WHERE platform = p_platform AND apartment_id = p_apartment_id AND token = p_token) THEN
    RETURN NULL;
  END IF;
  FOR r IN SELECT * FROM avail_busy(p_apartment_id, p_platform) LOOP
    body := body || E'BEGIN:VEVENT\r\n'
      || 'UID:' || r.block_id || '@' || own_domain || E'\r\n'
      || 'DTSTAMP:' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') || E'\r\n'
      || 'DTSTART;VALUE=DATE:' || to_char(r.check_in, 'YYYYMMDD') || E'\r\n'
      || 'DTEND;VALUE=DATE:' || to_char(r.check_out, 'YYYYMMDD') || E'\r\n'
      || E'SUMMARY:Занято\r\nTRANSP:OPAQUE\r\nEND:VEVENT\r\n';
  END LOOP;
  RETURN E'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//guesthouse//availability//RU\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n'
      || body || E'END:VCALENDAR\r\n';
END $$;

-- Пересечения броней на один объект из разных источников.
-- Совпадение дат с бронью Avito на том же объекте — одна бронь (импорт той же брони), не пересечение.
CREATE OR REPLACE VIEW avail_conflicts AS
SELECT a.apartment_id, a.id AS block_a, a.platform AS platform_a, a.check_in AS in_a, a.check_out AS out_a,
       b.id AS block_b, b.platform AS platform_b, b.check_in AS in_b, b.check_out AS out_b
  FROM avail_block a
  JOIN avail_block b ON b.apartment_id = a.apartment_id AND b.id > a.id AND b.source_id <> a.source_id
  JOIN avail_source sa ON sa.id = a.source_id AND sa.enabled
  JOIN avail_source sb ON sb.id = b.source_id AND sb.enabled
 WHERE a.check_in < b.check_out AND b.check_in < a.check_out
   AND a.check_out > (now() AT TIME ZONE 'Europe/Moscow')::date
   AND NOT (a.check_in = b.check_in AND a.check_out = b.check_out AND 'avito' IN (a.platform, b.platform));

-- Источники, которые не обновлялись дольше порога (Avito/Google — 30 мин, iCal-площадки — 4 часа).
CREATE OR REPLACE VIEW avail_stale_sources AS
SELECT s.id, s.platform, s.apartment_id, s.kind, s.last_synced_at, s.last_status, s.last_error, s.stale_after
  FROM avail_source s
 WHERE s.enabled AND (s.last_synced_at IS NULL OR s.last_synced_at < now() - s.stale_after);

-- Тело для Avito POST /core/v1/accounts/{uid}/items/{item}/bookings: занятые периоды объекта
-- из всех источников, КРОМЕ самого Avito, слитые в непересекающиеся отрезки [date_start, date_end)
-- (конец открытый — как у Avito), только будущее, на горизонт. hash — для идемпотентности.
CREATE OR REPLACE FUNCTION avito_push_payload(p_avito_item_id BIGINT)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH apt AS (
    SELECT apartment_id FROM avail_source WHERE kind = 'avito_api' AND avito_item_id = p_avito_item_id LIMIT 1
  ), busy AS (
    SELECT greatest(b.check_in, (now() AT TIME ZONE 'Europe/Moscow')::date) AS s, b.check_out AS e
      FROM apt, avail_busy(apt.apartment_id, 'avito') b
  ), ordered AS (
    SELECT s, e, max(e) OVER (ORDER BY s, e ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_max_e FROM busy
  ), grp AS (
    SELECT s, e, sum(CASE WHEN prev_max_e IS NULL OR s > prev_max_e THEN 1 ELSE 0 END) OVER (ORDER BY s, e) AS g FROM ordered
  ), merged AS (
    SELECT min(s) AS s, max(e) AS e FROM grp GROUP BY g
  ), body AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('date_start', to_char(s,'YYYY-MM-DD'), 'date_end', to_char(e,'YYYY-MM-DD'),
                                                 'type', 'booking', 'comment', 'занято на другой площадке') ORDER BY s), '[]'::jsonb) AS bookings
      FROM merged
  )
  SELECT jsonb_build_object('apartment_id', (SELECT apartment_id FROM apt),
                            'body', jsonb_build_object('source', 'pms', 'bookings', body.bookings),
                            'hash', md5(body.bookings::text))
    FROM body;
$$;

-- Что сообщить владельцу сейчас: пересечения, устаревшие источники, сработавшая защита/ошибка загрузки.
-- Не чаще раза в час на одну проблему: функция сама отмечает отправленное в avail_alert.
CREATE OR REPLACE FUNCTION avail_alerts_due(p_min_interval INTERVAL DEFAULT '1 hour')
RETURNS TABLE (alert_key TEXT, message TEXT) LANGUAGE plpgsql AS $$
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _alerts (alert_key TEXT PRIMARY KEY, message TEXT) ON COMMIT DROP;
  TRUNCATE _alerts;

  INSERT INTO _alerts
  SELECT 'conflict:' || least(c.block_a, c.block_b) || ':' || greatest(c.block_a, c.block_b),
         format('🔴 Двойная бронь: номер %s — %s (%s–%s) и %s (%s–%s)', c.apartment_id,
                c.platform_a, to_char(c.in_a,'DD.MM'), to_char(c.out_a,'DD.MM'),
                c.platform_b, to_char(c.in_b,'DD.MM'), to_char(c.out_b,'DD.MM'))
    FROM avail_conflicts c
  ON CONFLICT DO NOTHING;

  INSERT INTO _alerts
  SELECT 'stale:' || s.id,
         format('🟡 Календарь не обновлялся: %s, номер %s — последний успех %s. Занятость с этой площадки может быть неактуальной.',
                s.platform, s.apartment_id,
                COALESCE(to_char(s.last_synced_at AT TIME ZONE 'Europe/Moscow', 'DD.MM HH24:MI'), 'никогда'))
              || COALESCE(' Ошибка: ' || left(s.last_error, 150), '')
    FROM avail_stale_sources s
  ON CONFLICT DO NOTHING;

  INSERT INTO _alerts
  SELECT 'guard:' || s.id,
         format('🟡 Площадка %s, номер %s: выгрузка внезапно опустела или потеряла много броней — ничего не удалил, проверьте. %s',
                s.platform, s.apartment_id, COALESCE(s.last_error, ''))
    FROM avail_source s WHERE s.enabled AND s.last_status = 'guard'
  ON CONFLICT DO NOTHING;

  -- антиспам
  DELETE FROM _alerts a USING avail_alert h
   WHERE h.key = a.alert_key AND h.last_sent_at > now() - p_min_interval;
  INSERT INTO avail_alert (key, last_sent_at) SELECT a.alert_key, now() FROM _alerts a
  ON CONFLICT (key) DO UPDATE SET last_sent_at = EXCLUDED.last_sent_at;

  RETURN QUERY SELECT a.alert_key, a.message FROM _alerts a ORDER BY a.alert_key;
END $$;

-- Брони Avito → bookings (их читают 03 Guest Journey, бот владельца, отчёты; фильтра по source там нет).
-- active → confirmed, pending (не оплачена) → pending, canceled → cancelled.
-- journey_sent и привязка гостя к Telegram (guest_*) не затираются.
CREATE OR REPLACE FUNCTION avito_upsert_bookings(p_apartment_id VARCHAR, p_list JSONB)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
  INSERT INTO bookings (id, apartment_id, apartment_name, guest_name, guest_phone, guest_email,
                        checkin_at, checkout_at, total_amount, source, status, notes, updated_at)
  SELECT 'avito-' || (b->>'avito_booking_id'), p_apartment_id, a.name,
         NULLIF(b->'contact'->>'name', ''),
         CASE WHEN (b->'contact'->>'phone') ~ '^\d{10}$' THEN '+7' || (b->'contact'->>'phone') ELSE NULLIF(b->'contact'->>'phone','') END,
         NULLIF(b->'contact'->>'email', ''),
         (b->>'check_in')::date, (b->>'check_out')::date,
         NULLIF(b->>'base_price','')::int, 'avito',
         CASE b->>'status' WHEN 'active' THEN 'confirmed' WHEN 'pending' THEN 'pending' WHEN 'canceled' THEN 'cancelled' ELSE b->>'status' END,
         'Avito: гостей ' || COALESCE(b->>'guest_count','?'), now()
    FROM jsonb_array_elements(COALESCE(p_list,'[]'::jsonb)) b
    JOIN apartments a ON a.id = p_apartment_id
   WHERE COALESCE(b->>'avito_booking_id','') <> '' AND (b->>'check_out')::date > (b->>'check_in')::date
  ON CONFLICT (id) DO UPDATE SET
     checkin_at = EXCLUDED.checkin_at, checkout_at = EXCLUDED.checkout_at, status = EXCLUDED.status,
     guest_name = COALESCE(EXCLUDED.guest_name, bookings.guest_name),
     guest_phone = COALESCE(EXCLUDED.guest_phone, bookings.guest_phone),
     guest_email = COALESCE(EXCLUDED.guest_email, bookings.guest_email),
     total_amount = COALESCE(EXCLUDED.total_amount, bookings.total_amount),
     notes = EXCLUDED.notes, updated_at = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

COMMIT;
