-- Migration: 20260510_create_message_templates
-- Creates message_templates table and seeds workflow 03 templates.
-- Idempotent: safe to re-run.
-- T1: table + seed only. Workflow 03 still uses hardcoded texts until T2.

-- ============================================================
-- 1. TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS message_templates (
  key        TEXT PRIMARY KEY,
  channel    TEXT NOT NULL,                      -- 'guest' | 'owner'
  lang       TEXT NOT NULL DEFAULT 'ru',
  body       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_active
  ON message_templates(active) WHERE active;

-- ============================================================
-- 2. TRIGGER: auto-update updated_at on UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION update_message_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_message_templates_updated_at ON message_templates;
CREATE TRIGGER trg_message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION update_message_templates_updated_at();

-- ============================================================
-- 3. SEED — 15 templates
-- Placeholders: {{guest_first_name}} {{apartment_id}} {{apartment_name}}
--               {{checkin_at}} {{checkout_at}} {{guest_name}}
--               {{guest_username}} {{source}} {{booking_id}}
--               {{homereserve_url}}
-- Convention:
--   {{guest_first_name}} renders to ', Иван' (with leading comma+space) or ''
--   {{apartment_name}}   renders to ' (Студия)' (with leading space+parens) or ''
-- ============================================================

-- -----------------------------------------------------------
-- GUEST CHANNEL (5)
-- -----------------------------------------------------------

INSERT INTO message_templates (key, channel, lang, body, active) VALUES
('guest_d_minus_1_checkin', 'guest', 'ru',
'Здравствуйте{{guest_first_name}}!
Завтра ваш заезд в Акваторинг.

Бронь:
объект №{{apartment_id}}{{apartment_name}}
даты: {{checkin_at}} → {{checkout_at}}

Заезд обычно с 14:00. Если время приезда меняется — напишите здесь, я передам владельцу.

Ссылка для просмотра объекта и деталей:
{{homereserve_url}}

До встречи!',
true)
ON CONFLICT (key) DO UPDATE SET
  channel    = EXCLUDED.channel,
  lang       = EXCLUDED.lang,
  body       = EXCLUDED.body,
  active     = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO message_templates (key, channel, lang, body, active) VALUES
('guest_d_0_morning_checkin', 'guest', 'ru',
'Доброе утро{{guest_first_name}}!
Сегодня ваш заезд в Акваторинг.

Бронь:
объект №{{apartment_id}}{{apartment_name}}
даты: {{checkin_at}} → {{checkout_at}}

Заезд обычно с 14:00.

Если время приезда меняется или нужен уточняющий вопрос по заселению — напишите здесь.

Ссылка для просмотра объекта:
{{homereserve_url}}

До встречи!',
true)
ON CONFLICT (key) DO UPDATE SET
  channel    = EXCLUDED.channel,
  lang       = EXCLUDED.lang,
  body       = EXCLUDED.body,
  active     = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO message_templates (key, channel, lang, body, active) VALUES
('guest_d_0_evening_checkin', 'guest', 'ru',
'Добрый вечер{{guest_first_name}}! Надеюсь, вы хорошо заселились.

Всё ли в порядке с номером?
Если что-то нужно — напишите здесь, я передам владельцу.

Желаем приятного отдыха в Акваторинге!',
true)
ON CONFLICT (key) DO UPDATE SET
  channel    = EXCLUDED.channel,
  lang       = EXCLUDED.lang,
  body       = EXCLUDED.body,
  active     = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO message_templates (key, channel, lang, body, active) VALUES
('guest_d_minus_1_checkout', 'guest', 'ru',
'Здравствуйте{{guest_first_name}}!
Напоминаю, что завтра день выезда из Акваторинга.

Бронь:
объект №{{apartment_id}}{{apartment_name}}
даты: {{checkin_at}} → {{checkout_at}}

Выезд обычно до 12:00.

Если нужен поздний выезд или есть вопрос по завершению проживания — напишите здесь, я передам владельцу.

Спасибо, что выбрали Акваторинг!',
true)
ON CONFLICT (key) DO UPDATE SET
  channel    = EXCLUDED.channel,
  lang       = EXCLUDED.lang,
  body       = EXCLUDED.body,
  active     = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO message_templates (key, channel, lang, body, active) VALUES
('guest_d_plus_1_review', 'guest', 'ru',
'Здравствуйте{{guest_first_name}}! Спасибо, что выбрали Акваторинг.

Надеемся, отдых прошёл хорошо.

Если всё понравилось, будем благодарны за короткий отзыв — это очень помогает нам развивать гостевой дом.

Если что-то было не так или остался вопрос — напишите здесь, я передам владельцу.

Будем рады видеть вас снова!',
true)
ON CONFLICT (key) DO UPDATE SET
  channel    = EXCLUDED.channel,
  lang       = EXCLUDED.lang,
  body       = EXCLUDED.body,
  active     = EXCLUDED.active,
  updated_at = NOW();

-- -----------------------------------------------------------
-- OWNER CHANNEL — Phase A reminders (5)
-- -----------------------------------------------------------

INSERT INTO message_templates (key, channel, lang, body, active) VALUES
('owner_d_minus_1_checkin', 'owner', 'ru',
'Завтра заезд: объект №{{apartment_id}}{{apartment_name}}. Даты: {{checkin_at}} → {{checkout_at}}. Источник: {{source}}. Гость: {{guest_name}}. Подготовить уборку, ключи, инструкции.',
true)
ON CONFLICT (key) DO UPDATE SET
  channel    = EXCLUDED.channel,
  lang       = EXCLUDED.lang,
  body       = EXCLUDED.body,
  active     = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO message_templates (key, channel, lang, body, active) VALUES
('owner_d_0_morning_checkin', 'owner', 'ru',
'Сегодня заезд: объект №{{apartment_id}}{{apartment_name}}. Гость: {{guest_name}}. Проверь готовность номера, ключи, связь с гостем и инструкцию по заселению.',
true)
ON CONFLICT (key) DO UPDATE SET
  channel    = EXCLUDED.channel,
  lang       = EXCLUDED.lang,
  body       = EXCLUDED.body,
  active     = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO message_templates (key, channel, lang, body, active) VALUES
('owner_d_0_evening_checkin', 'owner', 'ru',
'Сегодня было заселение: объект №{{apartment_id}}{{apartment_name}}. Гость: {{guest_name}}. Проверь, всё ли у гостей хорошо.',
true)
ON CONFLICT (key) DO UPDATE SET
  channel    = EXCLUDED.channel,
  lang       = EXCLUDED.lang,
  body       = EXCLUDED.body,
  active     = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO message_templates (key, channel, lang, body, active) VALUES
('owner_d_minus_1_checkout', 'owner', 'ru',
'Завтра выезд: объект №{{apartment_id}}{{apartment_name}} до 12:00. Гость: {{guest_name}}. Подготовить уборку и проверку номера.',
true)
ON CONFLICT (key) DO UPDATE SET
  channel    = EXCLUDED.channel,
  lang       = EXCLUDED.lang,
  body       = EXCLUDED.body,
  active     = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO message_templates (key, channel, lang, body, active) VALUES
('owner_d_plus_1_review', 'owner', 'ru',
'Вчера был выезд: объект №{{apartment_id}}{{apartment_name}}. Гость: {{guest_name}}. Если есть контакт гостя — попросить отзыв и закрыть бытовые вопросы.',
true)
ON CONFLICT (key) DO UPDATE SET
  channel    = EXCLUDED.channel,
  lang       = EXCLUDED.lang,
  body       = EXCLUDED.body,
  active     = EXCLUDED.active,
  updated_at = NOW();

-- -----------------------------------------------------------
-- OWNER CHANNEL — owner brief after guest send (5)
-- -----------------------------------------------------------

INSERT INTO message_templates (key, channel, lang, body, active) VALUES
('owner_brief_guest_d_minus_1_checkin_sent', 'owner', 'ru',
'Гостю отправлено D-1 сообщение по брони {{booking_id}}:
объект №{{apartment_id}}{{apartment_name}}
даты {{checkin_at}} → {{checkout_at}}
Telegram: {{guest_username}}
guest_chat_id: есть',
true)
ON CONFLICT (key) DO UPDATE SET
  channel    = EXCLUDED.channel,
  lang       = EXCLUDED.lang,
  body       = EXCLUDED.body,
  active     = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO message_templates (key, channel, lang, body, active) VALUES
('owner_brief_guest_d_0_morning_checkin_sent', 'owner', 'ru',
'Гостю отправлено сообщение в день заезда по брони {{booking_id}}:
объект №{{apartment_id}}{{apartment_name}}
даты {{checkin_at}} → {{checkout_at}}
Telegram: {{guest_username}}
guest_chat_id: есть',
true)
ON CONFLICT (key) DO UPDATE SET
  channel    = EXCLUDED.channel,
  lang       = EXCLUDED.lang,
  body       = EXCLUDED.body,
  active     = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO message_templates (key, channel, lang, body, active) VALUES
('owner_brief_guest_d_0_evening_checkin_sent', 'owner', 'ru',
'Гостю отправлен вечерний check-in по брони {{booking_id}}:
объект №{{apartment_id}}{{apartment_name}}
даты {{checkin_at}} → {{checkout_at}}
Telegram: {{guest_username}}
guest_chat_id: есть',
true)
ON CONFLICT (key) DO UPDATE SET
  channel    = EXCLUDED.channel,
  lang       = EXCLUDED.lang,
  body       = EXCLUDED.body,
  active     = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO message_templates (key, channel, lang, body, active) VALUES
('owner_brief_guest_d_minus_1_checkout_sent', 'owner', 'ru',
'Гостю отправлено напоминание о завтрашнем выезде по брони {{booking_id}}:
объект №{{apartment_id}}{{apartment_name}}
даты {{checkin_at}} → {{checkout_at}}
Telegram: {{guest_username}}
guest_chat_id: есть',
true)
ON CONFLICT (key) DO UPDATE SET
  channel    = EXCLUDED.channel,
  lang       = EXCLUDED.lang,
  body       = EXCLUDED.body,
  active     = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO message_templates (key, channel, lang, body, active) VALUES
('owner_brief_guest_d_plus_1_review_sent', 'owner', 'ru',
'Гостю отправлена просьба об отзыве по брони {{booking_id}}:
объект №{{apartment_id}}{{apartment_name}}
даты {{checkin_at}} → {{checkout_at}}
Telegram: {{guest_username}}
guest_chat_id: есть',
true)
ON CONFLICT (key) DO UPDATE SET
  channel    = EXCLUDED.channel,
  lang       = EXCLUDED.lang,
  body       = EXCLUDED.body,
  active     = EXCLUDED.active,
  updated_at = NOW();
