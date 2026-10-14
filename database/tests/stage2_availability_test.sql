-- Тесты логики этапа 2. Запуск на тестовой базе: psql -v ON_ERROR_STOP=1 -f ...
-- Всё в транзакции с ROLLBACK — данные не остаются. Любой провал = RAISE EXCEPTION.
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.ok(cond BOOLEAN, name TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: %', name; END IF; RAISE NOTICE 'PASS: %', name; END $$;

DO $$
DECLARE
  t DATE := (now() AT TIME ZONE 'Europe/Moscow')::date;
  s_g INT; s_a INT; s_c INT; r JSONB; ics TEXT; tok TEXT;
  ev JSONB;
BEGIN
  INSERT INTO avail_source(platform, apartment_id, kind, ical_url, enabled, stale_after) VALUES ('gcal','40','ical','https://x/g.ics',true,'30 min') RETURNING id INTO s_g;
  INSERT INTO avail_source(platform, apartment_id, kind, avito_item_id, enabled, stale_after) VALUES ('avito','40','avito_api',111,true,'30 min') RETURNING id INTO s_a;
  INSERT INTO avail_source(platform, apartment_id, kind, ical_url, enabled) VALUES ('cian','40','ical','https://x/c.ics',true) RETURNING id INTO s_c;

  -- 1. первичная загрузка: прошлое + 3 будущих события
  ev := jsonb_build_array(
    jsonb_build_object('uid','past','check_in',t-10,'check_out',t-7),
    jsonb_build_object('uid','f1','check_in',t+5,'check_out',t+8),
    jsonb_build_object('uid','f2','check_in',t+8,'check_out',t+10),
    jsonb_build_object('uid','f3','check_in',t+20,'check_out',t+22),
    jsonb_build_object('uid','loop1@avail.aquatoring','check_in',t+30,'check_out',t+31),
    jsonb_build_object('uid','bad','check_in',t+40,'check_out',t+40));
  r := avail_apply_snapshot(s_g, ev, true);
  PERFORM pg_temp.ok(r->>'status'='ok' AND (r->>'events')::int=4, 'загрузка: 4 события, статус ok');
  PERFORM pg_temp.ok((r->>'skipped_own')::int=1, 'петля: наш UID отброшен');
  PERFORM pg_temp.ok((r->>'invalid')::int=1, 'невалидное событие (выезд=заезд) отброшено');
  PERFORM pg_temp.ok((SELECT last_status FROM avail_source WHERE id=s_g)='ok' AND (SELECT last_synced_at FROM avail_source WHERE id=s_g) IS NOT NULL, 'источник: ok и last_synced_at');

  -- 2. стык выезд/заезд в один день — не пересечение (f1 out=t+8, f2 in=t+8)
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM avail_conflicts WHERE block_a IN (SELECT id FROM avail_block WHERE source_id=s_g) AND block_b IN (SELECT id FROM avail_block WHERE source_id=s_g)), 'выезд=заезд в один день: не пересечение');

  -- 3. отмена f3 (пропала из выгрузки) → удалена; прошлое не трогаем
  ev := jsonb_build_array(
    jsonb_build_object('uid','f1','check_in',t+5,'check_out',t+8),
    jsonb_build_object('uid','f2','check_in',t+8,'check_out',t+10));
  r := avail_apply_snapshot(s_g, ev, true);
  PERFORM pg_temp.ok((r->>'deleted')::int=1 AND NOT EXISTS (SELECT 1 FROM avail_block WHERE source_id=s_g AND external_uid='f3'), 'отмена: пропавшая будущая бронь удалена');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM avail_block WHERE source_id=s_g AND external_uid='past'), 'прошлое не удаляется');

  -- 4. пустая выгрузка → ничего не удаляем, статус guard
  r := avail_apply_snapshot(s_g, '[]'::jsonb, true);
  PERFORM pg_temp.ok(r->>'status'='guard' AND (r->>'deleted')::int=0 AND (SELECT count(*) FROM avail_block WHERE source_id=s_g AND check_out>t)=2, 'пустая выгрузка: ничего не удалено, guard');

  -- 5. потеря больше половины будущих → guard
  PERFORM avail_apply_snapshot(s_g, jsonb_build_array(
    jsonb_build_object('uid','f1','check_in',t+5,'check_out',t+8), jsonb_build_object('uid','f2','check_in',t+8,'check_out',t+10),
    jsonb_build_object('uid','f4','check_in',t+50,'check_out',t+52), jsonb_build_object('uid','f5','check_in',t+60,'check_out',t+62)), true);
  r := avail_apply_snapshot(s_g, jsonb_build_array(jsonb_build_object('uid','f1','check_in',t+5,'check_out',t+8)), true);
  PERFORM pg_temp.ok(r->>'status'='guard' AND (SELECT count(*) FROM avail_block WHERE source_id=s_g AND check_out>t)=4, 'потеря >50%: ничего не удалено, guard');
  -- ровно половина — удаляем (не больше половины)
  r := avail_apply_snapshot(s_g, jsonb_build_array(jsonb_build_object('uid','f1','check_in',t+5,'check_out',t+8), jsonb_build_object('uid','f2','check_in',t+8,'check_out',t+10)), true);
  PERFORM pg_temp.ok(r->>'status'='ok' AND (r->>'deleted')::int=2, 'потеря ровно 50%: удаление выполнено');

  -- 6. неуспешная загрузка → ничего не удаляем, статус error, last_synced_at не сдвигается
  r := avail_apply_snapshot(s_g, '[]'::jsonb, false);
  PERFORM pg_temp.ok(r->>'status'='error' AND (SELECT count(*) FROM avail_block WHERE source_id=s_g AND check_out>t)=2, 'неуспешная загрузка: ничего не удалено');

  -- 7. Avito: брони с заездом в прошлом и невыехавшие не удаляются, даже если API их не вернул
  PERFORM avail_apply_snapshot(s_a, jsonb_build_array(jsonb_build_object('uid','av_now','check_in',t-2,'check_out',t+2),
                                                    jsonb_build_object('uid','av1','check_in',t+5,'check_out',t+8)), true, true);
  r := avail_apply_snapshot(s_a, jsonb_build_array(jsonb_build_object('uid','av1','check_in',t+5,'check_out',t+8)), true, true);
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM avail_block WHERE source_id=s_a AND external_uid='av_now'), 'Avito: текущая бронь с заездом в прошлом сохранена');

  -- 8. совпадение дат с бронью Avito — одна бронь, не пересечение; другое пересечение — ловится
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM avail_conflicts c WHERE (c.platform_a,c.platform_b) IN (('gcal','avito'),('avito','gcal')) AND c.in_a=t+5 AND c.out_a=t+8), 'те же даты, что у Avito: не пересечение');
  PERFORM avail_apply_snapshot(s_c, jsonb_build_array(jsonb_build_object('uid','c1','check_in',t+9,'check_out',t+12)), true);
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM avail_conflicts WHERE 'cian' IN (platform_a, platform_b) AND 'gcal' IN (platform_a, platform_b)), 'пересечение gcal(t+8..t+10) и cian(t+9..t+12) найдено');

  -- 9. выгрузка: без токена NULL; с токеном — без своей площадки, VALUE=DATE, «Занято», наш UID
  INSERT INTO avail_export(platform, apartment_id) VALUES ('cian','40') RETURNING token INTO tok;
  PERFORM pg_temp.ok(avail_export_ics('cian','40','wrong') IS NULL, 'выгрузка: неверный токен → NULL (404)');
  ics := avail_export_ics('cian','40',tok);
  PERFORM pg_temp.ok(ics LIKE 'BEGIN:VCALENDAR%' AND ics LIKE '%END:VCALENDAR%', 'выгрузка: валидный VCALENDAR');
  PERFORM pg_temp.ok(ics LIKE '%DTSTART;VALUE=DATE:' || to_char(t+5,'YYYYMMDD') || '%' AND ics LIKE '%DTEND;VALUE=DATE:' || to_char(t+8,'YYYYMMDD') || '%', 'выгрузка: VALUE=DATE, DTEND = день выезда');
  PERFORM pg_temp.ok(ics NOT LIKE '%' || to_char(t+9,'YYYYMMDD') || '%', 'выгрузка: события самой площадки (cian) не отдаются');
  PERFORM pg_temp.ok(ics LIKE '%SUMMARY:Занято%' AND ics LIKE '%@avail.aquatoring%' AND ics NOT LIKE '%gcal%' AND ics NOT LIKE '%avito%', 'выгрузка: «Занято», наш UID, источник не раскрыт');
  PERFORM pg_temp.ok(ics NOT LIKE '%' || to_char(t-10,'YYYYMMDD') || '%', 'выгрузка: прошлое не отдаётся');
  -- импорт собственной выгрузки обратно не создаёт блоков (петля)
  r := avail_apply_snapshot(s_c, jsonb_build_array(jsonb_build_object('uid','c1','check_in',t+9,'check_out',t+12),
         jsonb_build_object('uid', (SELECT id FROM avail_block WHERE source_id=s_g AND external_uid='f1')::text || '@avail.aquatoring','check_in',t+5,'check_out',t+8)), true);
  PERFORM pg_temp.ok((r->>'skipped_own')::int=1 AND (SELECT count(*) FROM avail_block WHERE source_id=s_c)=1, 'петля: наша выгрузка, вернувшаяся с площадки, отброшена');

  -- 10. выключенный источник не участвует ни в выгрузке, ни в пересечениях
  UPDATE avail_source SET enabled=false WHERE id=s_c;
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM avail_conflicts WHERE 'cian' IN (platform_a,platform_b)), 'выключенный источник: нет в пересечениях');

  -- 11. устаревание: источник с last_synced_at старше порога
  UPDATE avail_source SET last_synced_at = now() - interval '31 min' WHERE id=s_a;
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM avail_stale_sources WHERE id=s_a) AND NOT EXISTS (SELECT 1 FROM avail_stale_sources WHERE id=s_g), 'устаревание: Avito >30 мин найден, свежий gcal — нет');
  -- 12. Avito: тело записи — без броней самого Avito, пересекающиеся периоды слиты, стык не сливается
  UPDATE avail_source SET enabled=true WHERE id=s_c;
  r := avito_push_payload(111);
  PERFORM pg_temp.ok(r->>'apartment_id'='40', 'avito payload: объект по item_id');
  PERFORM pg_temp.ok(NOT (r->'body'->'bookings')::text LIKE '%' || to_char(t+2,'YYYY-MM-DD') || '%', 'avito payload: бронь самого Avito (av_now до t+2) не отправляется');
  -- gcal f1 [t+5,t+8), f2 [t+8,t+10), cian c1 [t+9,t+12) → [t+5,t+12) одним отрезком (стык + пересечение)
  PERFORM pg_temp.ok(jsonb_array_length(r->'body'->'bookings')=1
     AND r->'body'->'bookings'->0->>'date_start'=to_char(t+5,'YYYY-MM-DD') AND r->'body'->'bookings'->0->>'date_end'=to_char(t+12,'YYYY-MM-DD'),
     'avito payload: перекрывающиеся периоды слиты в [t+5,t+12)');
  PERFORM pg_temp.ok(r->>'hash' = (avito_push_payload(111))->>'hash', 'avito payload: хэш стабилен');
  PERFORM avail_apply_snapshot(s_g, jsonb_build_array(jsonb_build_object('uid','f1','check_in',t+5,'check_out',t+8),
     jsonb_build_object('uid','f2','check_in',t+8,'check_out',t+10), jsonb_build_object('uid','f9','check_in',t+40,'check_out',t+41)), true);
  PERFORM pg_temp.ok(r->>'hash' <> (avito_push_payload(111))->>'hash' AND jsonb_array_length(avito_push_payload(111)->'body'->'bookings')=2, 'avito payload: новая бронь меняет хэш, отрезков 2');
  -- 13. сторож: пересечение и устаревший источник → сообщения; повтор в течение часа — молчит
  DELETE FROM avail_alert;
  PERFORM pg_temp.ok((SELECT count(*) FROM avail_alerts_due() WHERE alert_key LIKE 'conflict:%') >= 1, 'сторож: пересечение → сообщение');
  PERFORM pg_temp.ok((SELECT count(*) FROM avail_alerts_due() WHERE alert_key LIKE 'stale:' || s_a) = 0, 'сторож: повтор той же проблемы в течение часа — молчит');
  UPDATE avail_alert SET last_sent_at = now() - interval '61 min';
  PERFORM pg_temp.ok((SELECT count(*) FROM avail_alerts_due() WHERE alert_key = 'stale:' || s_a) = 1, 'сторож: через час — снова сообщает');
  PERFORM pg_temp.ok((SELECT message FROM avail_alerts_due('0 sec') WHERE alert_key LIKE 'conflict:%' LIMIT 1) LIKE '%Двойная бронь: номер 40%', 'сторож: текст пересечения понятный');
  -- guard
  PERFORM avail_apply_snapshot(s_g, '[]'::jsonb, true);
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM avail_alerts_due('0 sec') WHERE alert_key = 'guard:' || s_g), 'сторож: сработавшая защита → сообщение');
  -- 14. брони Avito → bookings: статусы, контакты, journey_sent не затирается, отмена помечается
  PERFORM avito_upsert_bookings('40', jsonb_build_array(
    jsonb_build_object('avito_booking_id', 900001, 'status','active','check_in',t+5,'check_out',t+8,'guest_count',2,'base_price',14700,
                       'contact', jsonb_build_object('name','Иван','phone','9997770000','email','i@example.test')),
    jsonb_build_object('avito_booking_id', 900002, 'status','pending','check_in',t+20,'check_out',t+22,'contact', jsonb_build_object('name','Пётр','email','p@example.test'))));
  PERFORM pg_temp.ok((SELECT status FROM bookings WHERE id='avito-900001')='confirmed' AND (SELECT guest_phone FROM bookings WHERE id='avito-900001')='+79997770000'
                     AND (SELECT nights FROM bookings WHERE id='avito-900001')=3 AND (SELECT source FROM bookings WHERE id='avito-900001')='avito', 'avito→bookings: подтверждённая бронь, телефон +7, ночей 3');
  PERFORM pg_temp.ok((SELECT status FROM bookings WHERE id='avito-900002')='pending', 'avito→bookings: неоплаченная = pending (03 её не трогает)');
  UPDATE bookings SET journey_sent = '{"d1":"x"}', guest_chat_id = 42 WHERE id='avito-900001';
  PERFORM avito_upsert_bookings('40', jsonb_build_array(jsonb_build_object('avito_booking_id', 900001, 'status','canceled','check_in',t+5,'check_out',t+8,'contact', jsonb_build_object('name','Иван','email','i@example.test'))));
  PERFORM pg_temp.ok((SELECT status FROM bookings WHERE id='avito-900001')='cancelled' AND (SELECT guest_chat_id FROM bookings WHERE id='avito-900001')=42
                     AND (SELECT journey_sent->>'d1' FROM bookings WHERE id='avito-900001')='x' AND (SELECT guest_phone FROM bookings WHERE id='avito-900001')='+79997770000',
                     'avito→bookings: отмена помечена, journey_sent/чат/телефон сохранены');
END $$;
ROLLBACK;
