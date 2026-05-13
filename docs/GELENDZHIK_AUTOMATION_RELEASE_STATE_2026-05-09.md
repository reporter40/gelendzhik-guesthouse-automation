# Gelendzhik Guesthouse Automation — Release State 2026-05-09

> Снимок боевого состояния проекта на 2026-05-09 (UTC).
> Документ фиксирует, что работает, какие данные реальные, какие сервисы активны и что нельзя трогать без backup.
>
> **Update 2026-05-09 11:35 UTC**: production переехал с Cloudflare quick-tunnel на named tunnel `gelendzhik-owner-n8n`. Стабильный публичный URL — `https://owner.aquatoring.ru`. Подробности в разделе **8. Инфраструктура** ниже.
>
> **Update 2026-05-09 16:15 UTC**: Owner Bot availability overlap fix — расчёт пересечения дат вынесен из Polza в Code-ноду `Build Context`. Polza теперь не пересчитывает даты, а пользуется готовым блоком `РАСЧЁТ ДОСТУПНОСТИ`. Подробности в разделе **4.1**.
>
> **Update 2026-05-09 17:05 UTC**: Phase B0 — добавлен Guest Onboarding Bot (`workflow 09`, `@GuestGelen_bot`). Гость через deep-link `https://t.me/GuestGelen_bot?start=<booking_id>` привязывается к брони, в `bookings` записываются `guest_chat_id` / `guest_telegram_id` / `guest_username` / `guest_first_name` / `guest_last_name` / `guest_joined_at` / `guest_opt_in_at`. Подробности в новом разделе **5.1 Guest Onboarding Bot (workflow 09)**.
>
> **Update 2026-05-09 20:20 UTC**: Phase B1 — workflow 03 стал гибридным. Если у брони есть `guest_chat_id`, за день до заезда сообщение идёт **гостю напрямую** через `@GuestGelen_bot`, плюс владельцу в supergroup короткий brief. Если `guest_chat_id` нет — остаётся прежний Phase A owner reminder. Остальные touchpoints (D-0, выезд, отзыв) пока owner-only. Подробности в новом разделе **5.2**.
>
> **Update 2026-05-09 20:38 UTC**: Phase B2 — добавлен guest-touchpoint `guest_d_0_morning_checkin` (утром в день заезда). Тот же гибридный паттерн: guest first, иначе owner. Подробности в **5.3**.
>
> **Update 2026-05-09 20:46 UTC**: Phase B3 — добавлен guest-touchpoint `guest_d_0_evening_checkin` (вечером в день заезда, короткое «всё ли в порядке?», без Homereserve link). При наличии `guest_chat_id` заменяет старый `owner_d_0_evening_checkin` сообщением гостю + short brief владельцу. Подробности в **5.4**.
>
> **Update 2026-05-09 21:10 UTC**: Phase B4 — добавлен guest-touchpoint `guest_d_minus_1_checkout` (за день до выезда, без Homereserve link, без продажи). При наличии `guest_chat_id` заменяет `owner_d_minus_1_checkout` сообщением гостю + short brief владельцу. Подробности в **5.5**.
>
> **Update 2026-05-09 21:34 UTC**: Phase B5 — добавлен guest-touchpoint `guest_d_plus_1_review` (на следующий день после выезда, мягкая просьба об отзыве, без Homereserve link, без давления). При наличии `guest_chat_id` заменяет `owner_d_plus_1_review` сообщением гостю + short brief владельцу. Подробности в **5.6**.
>
> **Update 2026-05-10 06:51 UTC**: Owner Bot — расширен парсер дат и ужесточён safety guard. Теперь распознаются форматы `Заезд: D MONTH YYYY / Выезд: D MONTH YYYY`, `DD.MM.YYYY`, en/em-dash, markdown-bold. Если даты не распознаны — Polza обязана задать уточняющий вопрос и не имеет права называть номера. Подробности в **4.2**.
>
> **Update 2026-05-10 23:34 UTC**: Admin Panel A1 — создан workflow `10 — Admin API` (webhook, read-only). Endpoint: `https://owner.aquatoring.ru/webhook/adminapi1234/admin`. Токен в `system_vars.admin_api_token`. Actions: `health`, `bookings`, `templates`. Все smoke-тесты прошли. Подробности в разделе **9**.

---

## 1. Краткое резюме

**Проект умеет**:
- Каждые 30 минут забирает занятость из RealtyCalendar (iCal-фиды) и пишет реальные брони в локальный Postgres.
- Отвечает владельцу в Telegram-боте `@ownergelen_bot` по фактам из БД (объекты, занятость, шаблоны ответов гостям) через Polza.ai (модель `anthropic/claude-haiku-4.5`).
- Раз в час проверяет, есть ли в ближайшие сутки заезды/выезды, и шлёт владельцу персональные напоминания в supergroup «Дмитрий & OWNER». Не пишет гостям напрямую.
- Все ответы на сложные вопросы про номера и даты включают одну ссылку для просмотра/бронирования: `https://homereserve.ru/m66FXMW0XO/list-preview`.

**Активные workflows** (`workflow_entity.active = true`):
- `01 — RC iCal Sync` (`4a846531ec22acc6`)
- `02 — Owner Bot (Voice + Ollama)` (`c9a5874f34e45e4d`)
- `03 — Guest Journey (Automated Touchpoints)` (`af40ef5656b78bc0`)

**Реальные данные**:
- 4 объекта в `apartments` (40, 41, 42, 50) с актуальными iCal-URL.
- 18 строк `bookings.source = 'realtycalendar-ical'` — настоящие подтверждённые брони из RC, обновляются каждые 30 минут.

**Удалено**:
- `manual-test-40-2026-05-15`, `manual-test-50-2026-05-20` — тестовые брони из Phase 0 (Owner Bot).
- `manual-journey-test-tomorrow` — тестовая бронь из Phase A workflow 03.
- Запросы вида `SELECT * FROM bookings WHERE id LIKE 'manual-%'` сейчас возвращают 0 строк.

---

## 2. Активные workflows

| ID | Name | Active | Trigger | Назначение |
|---|---|---|---|---|
| `4a846531ec22acc6` | 01 — RC iCal Sync | ✅ | scheduleTrigger, every 30 min | синхронизация занятости из RC в Postgres |
| `c9a5874f34e45e4d` | 02 — Owner Bot (Voice + Ollama) | ✅ | telegramTrigger (webhook) | AI-ответы владельцу по фактам из БД |
| `af40ef5656b78bc0` | 03 — Guest Journey (Automated Touchpoints) | ✅ | scheduleTrigger, hourly | напоминания владельцу о заездах/выездах |

Inactive (импортированы, но не включены): `04 — Daily Pricing`, `05 — Weekly Report`, `06 — Watchdog`, `07 — Global Error Handler`, `08 — RC Webhooks Handler`, `99 — Owner Bot Smoke Test`.

---

## 3. Workflow 01 — RC iCal Sync

- **Источник данных**: RealtyCalendar iCal export (авторизованные ссылки `https://realtycalendar.ru/apartments/export.ics?q=...`).
- **Объектов в синхронизации**: 4 (40, 41, 42, 50). URL'ы хранятся в `apartments.ical_url`.
- **Текущий объём**: `bookings WHERE source='realtycalendar-ical' AND status='confirmed'` = **18 строк** (40=4, 41=6, 42=4, 50=4).
- **Расписание**: scheduleTrigger, `hoursInterval: 0.5` (каждые 30 минут), календарно выровнен на :00 и :30.
- **Pipeline**:
  `Every 30 Minutes → Load Apartments For Sync → Fetch iCal → Parse → Expand Events → Upsert Booking`
- **Ключевые свойства**:
  - `Load Apartments For Sync`: Postgres `executeQuery`, `executeOnce: true`, читает только `active=TRUE AND ical_url IS NOT NULL`.
  - `Fetch iCal`: HTTP, URL `={{ $json.ical_url }}`, `responseFormat: text`, `onError: continueRegularOutput` — один битый фид не валит остальные.
  - `Parse`: Code, `runOnceForAllItems`, явный zip apartments × fetched, нормализация дат `YYYYMMDD → YYYY-MM-DD`.
  - `Expand Events`: Code, `runOnceForAllItems`, дедупликация по ключу `apartment_id + '-' + start` (Map, последний выигрывает).
  - `Upsert Booking`: Postgres `executeQuery` с raw SQL `INSERT ... ON CONFLICT (id) DO UPDATE SET ..., updated_at = NOW()`. Без UI-маппинга, без зависимости от `conflictTarget` в UI.
- **`updated_at` подтверждение жизни**: после каждого scheduled run все 18 строк получают свежий `NOW()`. Последний контрольный замер: `MAX(updated_at) ≈ 2026-05-08 22:30:54+00` (scheduled run #77). Дальше эта метка переписывается каждые 30 минут.
- **Последние успешные executions** (на момент снимка):
  - manual: #68 (initial), #69 (per-item fix), #70 (updated_at proposal), #71 (raw-SQL upsert, 18 rows just_updated)
  - trigger: #72 (22:00 UTC), #77 (22:30 UTC)

---

## 4. Workflow 02 — Owner Bot (Voice + Ollama)

- **Канал**: Telegram, бот `@ownergelen_bot` (id 8666395350).
- **AI**: `https://polza.ai/api/v1/chat/completions`, модель `anthropic/claude-haiku-4.5`, `temperature: 0.3`, `max_tokens: 350`, `stream: false`. Авторизация через credential `polza_header_auth` (httpHeaderAuth, `Authorization: Bearer ...`, ключ зашифрован в БД n8n).
- **Контекст из Postgres**:
  - `Load Apartments` — справочник `apartments` (4 объекта).
  - `Load Bookings Window` — окно `bookings` 90 дней вперёд: `WHERE checkout_at >= CURRENT_DATE AND checkin_at <= CURRENT_DATE + INTERVAL '90 days' AND status IN ('confirmed','booking')`. Даты возвращаются `to_char(... ,'YYYY-MM-DD')` чтобы избежать TZ-сдвига. Postgres-нода `executeOnce: true`.
  - `Build Context` — Code-нода, склеивает `СЕГОДНЯ`, `ОБЪЕКТЫ ДОМА`, `ЗАНЯТОСТЬ`, плюс блок `ССЫЛКА ДЛЯ ПРОСМОТРА И БРОНИРОВАНИЯ`. Пробрасывает `input_text`, `chat_id`, `is_voice`.
- **System prompt Polza** (краткие тезисы): отвечать строго по-русски, использовать только факты из CONTEXT, не выдумывать брони и свободные даты, при пересечении — не обещать номер, если пересечений нет — формулировка «по данным БД препятствий не видно, финальное подтверждение за владельцем», при предложении альтернатив — добавлять ссылку Homereserve один раз.
- **Homereserve link**: `https://homereserve.ru/m66FXMW0XO/list-preview` присутствует одновременно в `context_text` (как блок данных) и в правиле system prompt. На live-test #79 ссылка попала в текст ответа ровно один раз.
- **Fallback**: нода `Ollama AI` (исторически name'd) переименована в Polza, `onError: continueRegularOutput`. Дальше Code-нода `Compose Reply` берёт `choices[0].message.content` из OpenAI-shape (legacy `message.content` как backup), если ничего нет — отправляет fallback-текст «Бот получил сообщение, но AI-модуль временно не подключен.».
- **n8n attribution disabled**: в `Send Reply.parameters.additionalFields = { appendAttribution: false }`. Подпись `This message was sent automatically with n8n` в Telegram-сообщения не приклеивается.
- **Voice/Whisper-ветка**: сохранена в графе (`Is Voice? → Whisper STT → Normalize Input`), но контейнер `gelendzhik-whisper` сейчас остановлен. Для голосовых сообщений ветка упадёт; текстовая работает независимо.

### 4.1 Owner Bot availability overlap fix (2026-05-09)

1. **Backup**: `workflows/backups/02_owner_bot_before_availability_overlap_fix_20260509_1907.json`.
2. **Причина фикса**: Polza некорректно считала пересечения дат и могла назвать занятый номер свободным. На live-test #94 модель сказала «номера 40 и 42 свободны на 6–13 июля», хотя в `bookings` оба этих номера заняты на этот интервал.
3. **Новая логика**:
   - **даты парсятся в `Build Context`** (Code-нода) — собственный регулярный парсер русских форматов: `"с D по D MONTH"`, `"D-D MONTH"`, `"с D MONTH по D MONTH"`, `"DD.MM-DD.MM"`, `"завтра"`, `"сегодня"`. Год по умолчанию выбирается через `chooseYear()`: для будущего месяца берётся текущий год, иначе следующий.
   - **пересечения считаются той же Code-нодой**, без участия LLM. Используется **half-open interval**: `booking.checkin_at < requested_end AND booking.checkout_at > requested_start`. Это корректно трактует выезд как «не занимает» дату выезда.
   - в `context_text` появляется детерминированный блок:
     ```
     ЗАПРОШЕННЫЙ ПЕРИОД:
     <start> → <end>

     РАСЧЁТ ДОСТУПНОСТИ ПО БД (выполнен системой, не пересчитывать):
     - Номер N: ЗАНЯТ. Пересечение: ...   |   СВОБОДЕН ПО ДАННЫМ БД, финальное подтверждение за владельцем.

     СВОБОДНЫЕ ПО ДАННЫМ БД: <list | "нет">
     ```
   - **Polza получает готовый availability_summary и не пересчитывает даты.** В system prompt добавлено жёсткое правило: *«Не выполняй собственный расчёт пересечения дат. Используй только блок РАСЧЁТ ДОСТУПНОСТИ ПО БД. Если система указала, что номер ЗАНЯТ — нельзя называть его свободным. Если СВОБОДНЫЕ ПО ДАННЫМ БД: нет — честно скажи, что свободных вариантов нет, и предложи Homereserve.»*
4. **Проверочный кейс**:
   - **Запрос пользователя**: «Есть свободный номер 41 с 6 по 13 июля?»
   - **Результат расчёта в Build Context**: все 4 номера (40 / 41 / 42 / 50) — `ЗАНЯТ` с конкретными перекрывающими бронями; `СВОБОДНЫЕ ПО ДАННЫМ БД: нет`.
   - **Ответ Polza** (доставлен в Telegram): «К сожалению, нет. Номер 41 занят с 6 по 13 июля 2026 года. На этот период все номера дома заняты. Предлагаю посмотреть другие даты в календаре: https://homereserve.ru/m66FXMW0XO/list-preview». Ссылка ровно 1 раз, никаких ложных «40/42 свободны».
5. **Live execution**: **#110**, `status=success`, **5 секунд** (≈ −58 % к старому `#94: 12 с`), `mode=webhook`, через `owner.aquatoring.ru`. Polza usage: 1696 tokens, 0.185 ₽.
6. **Active workflows**: 01 / 02 / 03 — все три `active=true`. Workflows 01 и 03 не тронуты.

### 4.2 Owner Bot check-in / check-out parser fix (2026-05-10 06:51 UTC)

1. **Ошибка**:
   - exec **#143** (2026-05-09 21:27 UTC). Пользователь написал:
     ```
     Уточню даты:
     - Заезд: 12 июля 2026
     - Выезд: 26 июля 2026 (2 недели)
     3 гостя
     ```
   - Парсер дат в Build Context **не понял** формат `Заезд: D MONTH YYYY / Выезд: D MONTH YYYY` с markdown-bold. В CONTEXT попало «РАСЧЁТ ДОСТУПНОСТИ ПО БД: даты не распознаны».
   - **Polza проигнорировала правило** «если даты не распознаны — попроси уточнить» и **выдумала**, что номера 40 и 50 свободны на 12–26 июля. По факту все 4 номера на этот период заняты (40: 12-18, 41: 6-13 + 13-24 + 25-30, 42: 4-19 + 18-25, 50: 6-15 + 17-27).
2. **Backup**: `workflows/backups/02_owner_bot_before_checkin_checkout_parser_fix_20260510_0039.json`.
3. **Что исправлено в parser** (Build Context):
   - Поддержка структурированного формата `Заезд: <дата> / Выезд: <дата>` (и синонимов: `заселение/приезд/from/arrival` и `выселение/отъезд/until/to/departure/checkout`).
   - Поддержка `DD.MM.YYYY` / `DD.MM` (точка или слэш-разделитель, год опционален).
   - Поддержка диапазонов `с D MONTH YYYY по D MONTH YYYY`, `D MONTH — D MONTH (YYYY)`, `с D по D MONTH (YYYY)`.
   - Поддержка тире/en-dash/em-dash (`-`, `–`, `—`).
   - Очистка markdown `**bold**`, `_italic_`, `` `code` `` — `normText()` стрипает их перед регулярками.
   - Шорткаты `сегодня` / `завтра` сохранены.
4. **Safety guard в system prompt Polza**:
   - Если `availability_summary` есть в CONTEXT — Polza обязана использовать только этот блок: запрещено называть свободным номер, помеченный ЗАНЯТ; если СВОБОДНЫЕ: нет — прямо сказать «свободных нет», предложить другие даты с одной ссылкой.
   - Если в CONTEXT написано «даты не распознаны системой» — **Polza не имеет права** объявлять номера свободными или занятыми. Единственный допустимый ответ — короткий уточняющий вопрос про дату заезда, дату выезда и количество гостей.
   - Build Context дополнительно вписывает в CONTEXT слово «ЗАПРЕЩЕНО» когда даты не распознаны — это поднимает приоритет правила.
5. **Тесты**:
   - Synthetic **#147** (`Заезд: 12 июля 2026 / Выезд: 26 июля 2026`): `dates_parsed=True`, requested `2026-07-12 → 2026-07-26`, все 4 номера ЗАНЯТЫ, СВОБОДНЫЕ: нет. Polza ответила «На период 12–26 июля 2026 для 3 гостей свободных номеров нет. Все номера заняты на эти даты». ✅
   - Synthetic **#148** (regression `Есть свободный номер 41 с 6 по 13 июля?`): корректный расчёт по старому пути не сломан. ✅
   - Synthetic **#149** (`Нужен номер на 3 гостей`, без дат): `dates_parsed=False`, Polza спросила «Дата заезда / Дата выезда / Количество гостей», ничего не предложила. ✅
   - Live **#156**, success, 6.16 секунд, через `owner.aquatoring.ru`. Реальный текст в Telegram: «На период **12–26 июля 2026** для 3 гостей свободных номеров нет. Все номера заняты на эти даты. Предлагаю посмотреть другие даты на календаре: https://homereserve.ru/m66FXMW0XO/list-preview». Ссылка ровно 1 раз, hallucination-проверка `(номер|№)\s*\d+[^.]*?своб` дала **False**.
6. **Active workflows**: 01 ✅ / 02 ✅ / 03 ✅ / 09 ✅. Workflows 01, 03, 09 не правились в этом этапе (updatedAt не сдвигался).

---

## 5. Workflow 03 — Guest Journey (Phase A owner reminders only)

- **Phase A**: бот **не пишет гостям напрямую**. Все напоминания идут владельцу. Цель — закрыть базовый чек-лист «заезд/выезд/уборка/отзыв» без зависимости от наличия `guest_telegram_id`.
- **Receiver**: supergroup «Дмитрий & OWNER» (id `-1003895019614`, после migrate из старого group `-5269741256`). Отправка через credential `telegram_owner_bot`. `additionalFields.appendAttribution = false`.
- **Pipeline**:
  `Hourly Check → Load Owner Chat → Get Bookings → Calculate Touchpoints → Select Message → Send Owner → Mark Sent`
- **Touchpoints** (5 событий):
  - `owner_d_minus_1_checkin` — за день до заезда: «Завтра заезд: объект №X. Даты: ... Источник: ... Гость: ... Подготовить уборку, ключи, инструкции.»
  - `owner_d_0_morning_checkin` — в день заезда: «Сегодня заезд: ... Проверь готовность номера.»
  - `owner_d_0_evening_checkin` — в день заезда вечером: «Сегодня было заселение: ... Проверь, всё ли у гостей хорошо.»
  - `owner_d_minus_1_checkout` — за день до выезда: «Завтра выезд до 12:00: ... Подготовить уборку и проверку номера.»
  - `owner_d_plus_1_review` — через день после выезда: «Вчера был выезд: ... Если есть контакт гостя — попросить отзыв и закрыть бытовые вопросы.»
- **Anti-duplicate через `bookings.journey_sent`**:
  - В `Calculate Touchpoints` каждый кандидат проверяется: `if (sent[event_key]) continue`.
  - После успешной отправки `Mark Sent` пишет `journey_sent = COALESCE(journey_sent, '{}'::jsonb) || jsonb_build_object('<event_key>', NOW()::text)`.
  - Идемпотентность доказана manual-тестами #74→#75 (отправка + journey_sent set) → #76 (re-run, Send Owner и Mark Sent **не запускались**).
- **owner_chat_id хранится в Postgres**, не в env n8n-контейнера. Таблица `system_vars`, ключ `owner_chat_id`. Workflow читает значение через ноду `Load Owner Chat` (`SELECT value FROM system_vars WHERE key='owner_chat_id'`). Это позволило не трогать `docker-compose.yml` и не recreate'ить контейнер.
- **Первый auto-run** (`mode=trigger`) **состоялся**: execution #80 в 23:00 UTC (через 32 минуты после активации, т.к. n8n выравнивает hourly trigger по календарным минутам :00). Status: success, duration <1 сек. `Hourly Check → Load Owner Chat → Get Bookings (0 items) → конец`. Дальше цепочка пуста, потому что в окне `[CURRENT_DATE-2; CURRENT_DATE+14]` нет реальных RC-броней (ближайшая `40-2026-07-04` через ~2 месяца). Это ожидаемое «тихое» поведение Phase A.

### 5.1 Guest Onboarding Bot (workflow 09) — Phase B0 (2026-05-09)

- **Цель**: дать гостю добровольно привязаться к своей брони через Telegram deep-link, без участия Polza/AI и без массовой рассылки.
- **Бот**: `@GuestGelen_bot` (id `8097437918`, credential `telegram_guest_bot` создан в момент B0; токен из `.env: TELEGRAM_GUEST_BOT_TOKEN`).
- **Webhook**: `https://owner.aquatoring.ru/webhook/guestonboard1234/guesttelegramtrigger/webhook`. Поднимается через тот же named tunnel, что и Owner Bot.
- **Schema migration**: в `bookings` добавлены 7 колонок `guest_chat_id BIGINT, guest_telegram_id BIGINT, guest_username TEXT, guest_first_name TEXT, guest_last_name TEXT, guest_joined_at TIMESTAMPTZ, guest_opt_in_at TIMESTAMPTZ`. Старые `guest_name/phone/email` сохранены. Backup до миграции — `infrastructure/backups/bookings_before_guest_onboarding_20260509_1928.sql` (pg_dump bookings, schema + 18 INSERT'ов).
- **Workflow id**: `guestonboard1234`, файл `workflows/09_guest_onboarding.json`. Backup `workflows/backups/09_guest_onboarding_initial_20260509_1957.json`.
- **Pipeline**:
  `GuestTelegramTrigger → Normalize Start → If Valid Start → Validate Booking → Merge Start+Booking → If Booking Exists → (true) Update Booking Guest → Send Guest Welcome` + параллельно `Load Owner Chat → Send Owner Notify`. Ветка `(false) → Send Guest Not Found`.
- **Гарантии**:
  - Booking_id строго валидируется регулярным выражением `^[A-Za-z0-9_-]{1,80}$`.
  - При `/start` без параметра гость получает «Не нашёл бронь по этой ссылке. Пожалуйста, свяжитесь с владельцем» (нода `If Valid Start`, добавлена после первой live-итерации).
  - Polza в этом workflow **не используется**.
  - `conversation_log` в B0 не пишется (отложено на следующие фазы).
  - `appendAttribution: false` во всех Telegram-нодах.
- **Подтверждение**: live exec #116, success, 3.28 сек. После `/start 42-2026-07-04` гость (`smartmartin`, id 281361614) получил welcome, в supergroup `Дмитрий & OWNER` пришло уведомление о привязке, в `bookings.42-2026-07-04` заполнились `guest_chat_id`, `guest_telegram_id`, `guest_username = smartmartin`, `guest_first_name`, `guest_last_name`, `guest_joined_at = guest_opt_in_at = 2026-05-09 17:06:18 UTC`.

### 5.2 Guest Journey Phase B1 — guest D-1 message (2026-05-09 20:20 UTC)

1. **Backup**: `workflows/backups/03_guest_journey_before_phase_b1_guest_d_minus_1_20260509_2318.json`.
2. **Что изменилось**:
   - workflow 03 теперь **гибридный**:
     - если у брони есть `guest_chat_id` и до заезда 1 день — отправляет **гостю** D-1 сообщение через `@GuestGelen_bot` (credential `telegram_guest_bot`), плюс владельцу в supergroup short brief через `@ownergelen_bot`;
     - если `guest_chat_id` нет — продолжает прежнее Phase A: только owner reminder в supergroup;
     - не дублирует одну бронь (либо guest, либо owner — никогда оба).
   - `Get Bookings` SQL расширен: помимо прежних полей читает `guest_chat_id`, `guest_telegram_id`, `guest_username`, `guest_first_name`, `guest_last_name`, `guest_opt_in_at`.
   - `Calculate Touchpoints` понимает каналы (`channel: 'guest' | 'owner'`) и отдельный ключ idempotency `guest_d_minus_1_checkin`.
   - `Select Message` формирует две версии: `message_text` (гостю или владельцу) и `owner_brief_text` (краткий статус для supergroup при guest send).
   - В графе появились ноды `If Channel Guest`, `Send Guest D-1`, `Send Owner Brief`. Mark Sent работает на обоих путях.
   - **Остальные touchpoints** (D-0 morning/evening, выезд, отзыв) пока owner-only.
3. **Тест отправки**: exec **#126**, success, 2 сек. Использовалась временная бронь `manual-journey-b1-test-tomorrow` (apartment 40, checkin завтра, `guest_chat_id` скопирован из реальной 42-2026-07-04). Прошли все ноды: `Calculate Touchpoints → Select Message → If Channel Guest (true) → Send Guest D-1 → Send Owner Brief → Mark Sent`. Гостю в личку доставлено приветствие с реквизитами брони и ссылкой Homereserve. Владельцу в supergroup — короткий brief «Гостю отправлено D-1 сообщение по брони …, объект …, даты …, Telegram: @smartmartin, guest_chat_id: есть». В `bookings.journey_sent` записан ключ `guest_d_minus_1_checkin: 2026-05-09 20:20:39+00`.
4. **Идемпотентность**: exec **#127**, success, <1 сек. `Hourly Check → Load Owner Chat → Get Bookings → Calculate Touchpoints (items_out: 0) → конец`. `Send Guest D-1`, `Send Owner Brief`, `Mark Sent` **не запускались**. `journey_sent` неизменён.
5. **Cleanup**: тестовая бронь `manual-journey-b1-test-tomorrow` удалена (`DELETE 1`). В `bookings` снова только 18 строк `realtycalendar-ical`. Бронь `42-2026-07-04` остаётся единственной с `guest_chat_id IS NOT NULL`.
6. **Active workflows**: 01 ✅ / 02 ✅ / 03 ✅ / 09 ✅ — все четыре `active=true`. Workflows 01, 02, 09 не правились в этом этапе (их `updatedAt` не сдвигался).
7. **Следующие возможные фазы**:
   - **B2**: D-0 morning guest message (утреннее напоминание про время заезда, инструкция от двери / wifi / парковка).
   - **B3**: вечерний check-in «всё ли хорошо?» — после фактического заезда.
   - **B4**: checkout / D-1 выезд reminder для гостя (правила выезда, время до 12:00, обратная связь).
   - **B5**: review request — на следующий день после выезда, с ссылкой на отзыв.
   - **`message_templates` table**: вынести шаблоны из JS-кода `Select Message` в Postgres-таблицу `message_templates(key, channel, lang, body, active)`, чтобы редактировать тексты без правки workflow JSON.

### 5.3 Guest Journey Phase B2 — guest D-0 morning message (2026-05-09 20:38 UTC)

1. **Backup**: `workflows/backups/03_guest_journey_before_phase_b2_guest_d0_morning_20260509_2336.json`.
2. **Что добавлено**:
   - Touchpoint `guest_d_0_morning_checkin`. Условие: `days_to_checkin === 0` **и** `guest_chat_id IS NOT NULL` **и** `journey_sent` ещё не содержит этот ключ.
   - Если `guest_chat_id` нет — продолжает работать прежний `owner_d_0_morning_checkin`.
   - Параллельно (для всех) — `owner_d_0_evening_checkin` (Phase A). На этом этапе вечерний touchpoint остаётся owner-only.
   - Текст гостю: «Доброе утро [Имя]! Сегодня ваш заезд в Акваторинг. Бронь: объект …, даты …. Заезд обычно с 14:00. Если время приезда меняется или нужен уточняющий вопрос — напишите здесь. Ссылка для просмотра объекта: https://homereserve.ru/m66FXMW0XO/list-preview. До встречи!». `appendAttribution: false`.
   - Owner brief: «Гостю отправлено сообщение в день заезда по брони …: объект …, даты …. Telegram: @username. guest_chat_id: есть».
3. **Тест**: временная бронь `manual-journey-b2-test-today` (apartment 40, checkin сегодня, `guest_chat_id` скопирован из 42-2026-07-04). exec **#129**, success, 8 секунд. `Calculate Touchpoints` сгенерировал 2 события: `guest_d_0_morning_checkin` (channel=guest) + `owner_d_0_evening_checkin` (channel=owner) — оба прошли через свои ветки `If Channel Guest`. Гостю доставлено утреннее сообщение по шаблону, владельцу — short brief; параллельно владельцу пришло вечернее напоминание Phase A.
4. **Идемпотентность**: exec **#130**, success, <1 сек. `Calculate Touchpoints items_out: 0`. Send-ноды и Mark Sent не запускались. `journey_sent` неизменён.
5. **Cleanup**: `manual-journey-b2-test-today` удалён, `bookings` снова содержит только 18 строк realtycalendar-ical.
6. **Workflow 03 active=true**, workflows 01/02/09 не тронуты.

### 5.4 Guest Journey Phase B3 — guest D-0 evening check-in (2026-05-09 20:46 UTC)

1. **Backup**: `workflows/backups/03_guest_journey_before_phase_b3_guest_d0_evening_20260509_2343.json`.
2. **Что добавлено**:
   - Touchpoint `guest_d_0_evening_checkin`. Условие: `days_to_checkin === 0` **и** `guest_chat_id IS NOT NULL` **и** `journey_sent` ещё не содержит этот ключ.
   - **При наличии `guest_chat_id` старый `owner_d_0_evening_checkin` заменяется** парой `guest_d_0_evening_checkin` (гостю) + owner short brief. Если `guest_chat_id` нет — продолжает прежний owner-only `owner_d_0_evening_checkin`.
   - Текст гостю: «Добрый вечер [Имя]! Надеюсь, вы хорошо заселились. Всё ли в порядке с номером? Если что-то нужно — напишите здесь, я передам владельцу. Желаем приятного отдыха в Акваторинге!». **Без Homereserve link**, коротко, без продажи. `appendAttribution: false`.
   - Owner brief: «Гостю отправлен вечерний check-in по брони …: объект …, даты …. Telegram: @username. guest_chat_id: есть».
3. **Тест**: временная бронь `manual-journey-b3-test-today` с предзаполненным `journey_sent.guest_d_0_morning_checkin`, чтобы Calculate Touchpoints не сгенерировал утренний event и проверка изолированно протестировала evening. exec **#131**, success, 6 секунд. Сгенерировано **ровно 1 событие** — `guest_d_0_evening_checkin`. Гостю доставлено вечернее «всё ли в порядке?», владельцу — short brief. `journey_sent` дополнен ключом `guest_d_0_evening_checkin`.
4. **Идемпотентность**: exec **#132**, success, <1 сек. `Calculate Touchpoints items_out: 0`. Send-ноды и Mark Sent не запускались.
5. **Cleanup**: `manual-journey-b3-test-today` удалён, `bookings` снова содержит только 18 строк realtycalendar-ical.
6. **Workflow 03 active=true**, workflows 01/02/09 не тронуты.

### 5.5 Guest Journey Phase B4 — guest D-1 checkout reminder (2026-05-09 21:10 UTC)

1. **Backup**: `workflows/backups/03_guest_journey_before_phase_b4_guest_d_minus_1_checkout_20260509_2357.json`.
2. **Что изменилось**:
   - Добавлен touchpoint `guest_d_minus_1_checkout`. Условие: `days_to_checkout === 1` **и** `guest_chat_id IS NOT NULL` **и** `journey_sent` ещё не содержит этот ключ.
   - Если `guest_chat_id` нет — остаётся прежний `owner_d_minus_1_checkout` (Phase A).
   - **При наличии `guest_chat_id` старый `owner_d_minus_1_checkout` заменяется** парой `guest_d_minus_1_checkout` (гостю) + owner short brief владельцу. Никаких дублей.
   - Текст гостю: «Здравствуйте [Имя]! Напоминаю, что завтра день выезда из Акваторинга. Бронь: объект …, даты …. Выезд обычно до 12:00. Если нужен поздний выезд или есть вопрос по завершению проживания — напишите здесь, я передам владельцу. Спасибо, что выбрали Акваторинг!». **Без Homereserve link**, без продажи, спокойный тон.
   - Owner brief: «Гостю отправлено напоминание о завтрашнем выезде по брони …: объект …, даты …. Telegram: @username. guest_chat_id: есть».
3. **Тест**: временная бронь `manual-journey-b4-test-checkout-tomorrow` (apartment 40, checkin = today-2, checkout = today+1, `guest_chat_id` скопирован из 42-2026-07-04). exec **#136**, success, 6 секунд. `Calculate Touchpoints` сгенерировал ровно 1 событие `guest_d_minus_1_checkout` (channel=guest, chat_id=281361614). Гостю в личку доставлено напоминание про завтрашний выезд по шаблону, владельцу — short brief. `journey_sent` получил ключ `guest_d_minus_1_checkout: 2026-05-09 21:10:24+00`.
4. **Идемпотентность**: exec **#137**, success, 82 ms. `Calculate Touchpoints` сгенерировал **0 событий**. Send-ноды и Mark Sent не запускались. `journey_sent` неизменён.
5. **Cleanup**: `manual-journey-b4-test-checkout-tomorrow` удалён (`DELETE 1`). В `bookings` снова только 18 строк realtycalendar-ical.
6. **Race-condition note** (для эксплуатации): первый ручной run #133 + scheduled run #134 в 21:00:41 UTC сработали почти одновременно с моим reimport/reactivate. ScheduleTrigger использовал старый in-memory snapshot Calculate Touchpoints (без поля `channel`), поэтому в `journey_sent` параллельно с `guest_d_minus_1_checkout` (#133) сел дополнительный `owner_d_minus_1_checkout` (#134). Это **не** текущий runtime bug — в свежем run #136 на чистом journey_sent код обновился корректно. Правило на будущее: **не патчить workflow 03 вблизи `:00` hourly trigger** или временно ставить scheduleTrigger на паузу перед reimport.
7. **Active workflows**: 01 ✅ / 02 ✅ / 03 ✅ / 09 ✅. Workflows 01, 02, 09 не правились (updatedAt не сдвигался).

### 5.6 Guest Journey Phase B5 — guest D+1 review request (2026-05-09 21:34 UTC)

1. **Backup**: `workflows/backups/03_guest_journey_before_phase_b5_guest_d_plus_1_review_20260510_0031.json`.
2. **Что изменилось**:
   - Добавлен touchpoint `guest_d_plus_1_review`. Условие: `days_to_checkout === -1` **и** `guest_chat_id IS NOT NULL` **и** `journey_sent` ещё не содержит этот ключ.
   - Если `guest_chat_id` нет — остаётся прежний `owner_d_plus_1_review` (Phase A).
   - **При наличии `guest_chat_id` старый `owner_d_plus_1_review` заменяется** парой `guest_d_plus_1_review` (гостю) + owner short brief владельцу. Никаких дублей.
   - Текст гостю: «Здравствуйте [Имя]! Спасибо, что выбрали Акваторинг. Надеемся, отдых прошёл хорошо. Если всё понравилось, будем благодарны за короткий отзыв — это очень помогает нам развивать гостевой дом. Если что-то было не так или остался вопрос — напишите здесь, я передам владельцу. Будем рады видеть вас снова!». **Без Homereserve link**, без давления, без «5 звёзд», без продажи.
   - Owner brief: «Гостю отправлена просьба об отзыве по брони …: объект …, даты …. Telegram: @username. guest_chat_id: есть».
3. **Тест**: временная бронь `manual-journey-b5-test-review` (apartment 40, checkin = today−4, checkout = today−1). exec **#145**, success, 4 секунды. Сгенерировано ровно 1 событие `guest_d_plus_1_review` (channel=guest, chat_id=281361614, d_co=−1). Гостю в личку доставлено мягкое сообщение благодарности с просьбой отзыва, владельцу — short brief. `journey_sent` получил ключ `guest_d_plus_1_review`.
4. **Идемпотентность**: exec **#146**, success, 65 ms. `events=0`, send-data items=0. Send-ноды и Mark Sent не запускались.
5. **Cleanup**: `manual-journey-b5-test-review` удалён. В `bookings` снова только 18 строк realtycalendar-ical.
6. **Race-condition**: патч был сделан в 21:31 UTC (29 минут до :00 hourly trigger), затем в 21:35 — без перекрытия с scheduleTrigger. В отличие от Phase B4 #134 race-condition не повторился.
7. **Active workflows**: 01 ✅ / 02 ✅ / 03 ✅ / 09 ✅. Workflows 01, 02, 09 не правились (updatedAt не сдвигался).

---

## 6. База данных

PostgreSQL 16 в контейнере `gelendzhik-postgres`, БД `n8n_gelendzhik`, пользователь `n8n_user`.

| Таблица | Размер | Состояние |
|---|---|---|
| `apartments` | 4 строки | seed + обновлённые `ical_url` для всех 4 объектов |
| `bookings` | 18 строк | все `source='realtycalendar-ical'`, `status='confirmed'`, обновляются каждые 30 минут через workflow 01 |
| `system_vars` | 5 строк | `last_poll`, `last_ical_sync`, `last_pricing_update`, `system_version`, `owner_chat_id` (последний — добавлен в Phase A workflow 03) |
| `availability_cache` | 4 строки | seed, blocked_dates пустые (workflow 01 туда не пишет) |
| `price_history` | 0 строк | пустая, ждёт workflow 04 |
| `conversation_log` | 0 строк | пустая, **пока не используется**. Создана для будущей связки гость-бот ↔ AI; в Phase A/B не задействована |

**Схема `bookings`** не менялась: PK `id varchar(50)`, поля `apartment_id, apartment_name, guest_name, guest_phone, guest_email, checkin_at, checkout_at, nights (generated), total_amount, net_amount, commission_pct, source, status, journey_sent jsonb, notes, created_at, updated_at`.

**Удалённые тестовые данные**:
- `manual-test-40-2026-05-15`, `manual-test-50-2026-05-20` (Phase 0).
- `manual-journey-test-tomorrow` (Phase A workflow 03).

---

## 7. Credentials

**Существующие** (в n8n БД, зашифрованы):
| ID | Type | Используется |
|---|---|---|
| `gelendzhik_db` | postgres | workflows 01, 02, 03 |
| `telegram_owner_bot` | telegramApi | workflows 02 (приём + ответ), 03 (отправка владельцу) |
| `polza_header_auth` | httpHeaderAuth | workflow 02 (Authorization: Bearer для polza.ai) |

**Отсутствующие** (упомянуты в неактивных workflows):
| ID | Type | Для какого workflow | Что нужно |
|---|---|---|---|
| `telegram_guest_bot` | telegramApi | 03 (если выйдем в Phase B), будущий guest-onboarding bot | токен есть в `.env` (`TELEGRAM_GUEST_BOT_TOKEN`), credential не создан |
| `realty_calendar_v1` | httpHeaderAuth | 04 — Daily Pricing | API key от RC, в `.env` отсутствует |
| `google_service_account` | googleApi | 08 — RC Webhooks Handler (запись в Google Sheets) | JSON service account отсутствует |

**В `.env` есть, но не задействованы**:
- `EVOLUTION_API_KEY`, `EVOLUTION_SERVER_URL` — placeholders для WhatsApp через Evolution API (workflow для WA пока не существует).

---

## 8. Инфраструктура

- **Docker / Colima**: один профиль `colima default` (x86_64, 2 CPU, 4 GiB, runtime docker). Активные контейнеры: `gelendzhik-postgres` (healthy), `gelendzhik-n8n`. Контейнеры `gelendzhik-whisper`, `gelendzhik-qdrant`, `gelendzhik-npm` остановлены ради экономии памяти.
- **Production-канал — Cloudflare named tunnel** (с 2026-05-09 11:35 UTC):
  - **Public URL**: `https://owner.aquatoring.ru`.
  - **Tunnel name**: `gelendzhik-owner-n8n`, UUID `5837a87f-a190-4363-8129-88232de199aa`.
  - **Credentials**: `~/.cloudflared/5837a87f-a190-4363-8129-88232de199aa.json` (хранится только локально, в репозиторий не коммитится).
  - **Конфиг**: `~/.cloudflared/config.yml`, ingress `owner.aquatoring.ru → http://localhost:5678`, fallback `http_status:404`.
  - **DNS**: CNAME `owner.aquatoring.ru → 5837a87f-...199aa.cfargotunnel.com` (управляется Cloudflare zone после делегирования NS Timeweb → `katelyn.ns.cloudflare.com`, `ridge.ns.cloudflare.com`).
  - **Запуск**: `nohup cloudflared tunnel run gelendzhik-owner-n8n > /tmp/cloudflared_named_owner.log 2>&1 &` (фоновый процесс на хосте). Перезапускать после ребута Mac или потери сети.
  - **Telegram webhook** теперь стабильно указывает на `https://owner.aquatoring.ru/webhook/c9a5874f34e45e4d/telegramtrigger/webhook`. `last_error_message: null`, `pending: 0`.
- **Cloudflare quick-tunnel**: ❌ **остановлен** 2026-05-09 11:35 UTC. Был временным решением до получения домена. URL `packing-court-christine-academy.trycloudflare.com` больше не используется и не возвращается в строй.
- **Watchdog (`cf_watchdog.sh`)**: ❌ **выведен из эксплуатации** 2026-05-09 11:35 UTC. Process убит, скрипт переименован в `infrastructure/cf_watchdog.sh.disabled`, лог архивирован в `/tmp/cf_watchdog.log.archived`. С named tunnel и стабильным URL автоматическая ротация трицуклаудфлэйр-доменов больше не нужна.
- **Домен `aquatoring.ru`**: ✅ **Active в Cloudflare**. NS делегированы с Timeweb на Cloudflare (`katelyn.ns.cloudflare.com`, `ridge.ns.cloudflare.com`). MX/TXT и DNS-записи `aquatoring.ru` (root) и `www` не трогали — они импортированы Cloudflare из Timeweb.
- **`WEBHOOK_URL` внутри контейнера n8n**: значение в `.env` теперь стабильно — `WEBHOOK_URL=https://owner.aquatoring.ru/`. Контейнер `gelendzhik-n8n` пересоздан в момент перехода (`docker compose up -d n8n`), новое значение подхвачено. Старый риск рассинхрона env (когда watchdog менял .env, но контейнер держал старый URL) исчез вместе с quick-tunnel.

---

## 9. Что нельзя трогать без backup

| Сущность | Где лежат backups |
|---|---|
| Workflow 01 — RC iCal Sync | `workflows/backups/01_ical_sync_*.json` |
| Workflow 02 — Owner Bot | `workflows/backups/02_owner_bot_*.json` |
| Workflow 03 — Guest Journey | `workflows/backups/03_guest_journey_*.json` |
| Таблица `bookings` | бэкап через `pg_dump -t bookings` (на момент снимка отдельного snapshot нет) |
| Telegram webhook | переустанавливать только через `setWebhook` напрямую или через `deactivate→activate` workflow 02; не дёргать «на всякий случай» |
| `apartments.ical_url` | `infrastructure/backups/apartments_ical_urls_before_*.sql` |

Любая правка должна:
1. Сохранить snapshot до изменения (`cp` JSON или `pg_dump`).
2. Проводиться через manual-test перед активацией.
3. Иметь явную команду на откат.

---

## 10. Следующие этапы

| # | Этап | Зависимости / готовность |
|---|---|---|
| 1 | Дождаться следующих scheduled runs workflow 03 в окнах, где есть бронь D-1/D-0/D+1 | автоматически, без действий — ближайший realtycalendar-ical D-1 ≈ 3 июля 2026 |
| 2 | ✅ **Сделано 2026-05-09**: домен `aquatoring.ru` Active, named tunnel `gelendzhik-owner-n8n`, public URL `https://owner.aquatoring.ru`, Telegram webhook переключён, quick-tunnel остановлен, watchdog выведен из эксплуатации |
| 2a | ✅ **Сделано 2026-05-09**: deterministic overlap fix в Build Context — даты парсятся регулярками, пересечения считаются Code-нодой, Polza получает готовый блок РАСЧЁТ ДОСТУПНОСТИ. Подтверждено live-test #110. Подробности в разделе **4.1 Owner Bot availability overlap fix**. |
| 3 | Phase B0..B5 ✅ **сделано 2026-05-09**: B0 (5.1), B1 (5.2), B2 (5.3), B3 (5.4), B4 (5.5), B5 (5.6). Owner Bot parser fix ✅ **сделано 2026-05-10** (4.2). Phase B полностью закрыта. |
| 3a | `message_templates` T1 ✅ **сделано 2026-05-10**: таблица создана, 15 шаблонов засеяно. Workflow 03 ещё на hardcoded текстах. Подробности в разделе **7. Message templates (T1)**. |
| 3b | `message_templates` T2 ✅ **сделано 2026-05-10**: workflow 03 читает шаблоны из БД, render() подставляет плейсхолдеры, hardcoded fallback сохранён. Подробности в разделе **8. Message templates (T2)**. |
| 3c | `message_templates` T3 — убрать hardcoded fallback из `Select Message` | только после первого scheduled run с реальной RC-бронью в D±1 окне (≈ 3 июля 2026) |
| 4 | Vercel frontend / админ-панель | для редактирования шаблонов (Phase C), просмотра журнала, ручного добавления контактов гостей |
| 5 | Workflow 08 — RC Webhooks Handler | требует стабильный публичный URL (Phase 2), регистрацию webhook в админке RC, credential `google_service_account` для Google Sheets |
| 6 | Editable templates (Phase C) | после T3: шаблоны редактируются только через SQL/админку |
| 7 | Workflow 04 — Daily Pricing | требует `realty_calendar_v1` credential (RC API key) |
| 8 | Workflow 05 — Weekly Report | можно включить как только устаканится база, использует `gelendzhik_db` + `telegram_owner_bot` (оба уже есть) |
| 9 | Voice-ветка workflow 02 | поднять контейнер `gelendzhik-whisper`, проверить связку `Whisper STT → Normalize Input → Polza AI`. Требует расширения памяти colima (4 → 8 GiB), иначе при включении трёх контейнеров одновременно docker daemon валится |

---

---

## 7. Message templates (T1) — 2026-05-10

> **Update 2026-05-10**: T1 выполнен. Таблица `message_templates` создана в Postgres, засеяны 15 шаблонов workflow 03. Workflow 03 **не изменён** — продолжает работать на hardcoded текстах до T2.

### 7.1 Схема таблицы

```sql
CREATE TABLE message_templates (
  key        TEXT PRIMARY KEY,
  channel    TEXT NOT NULL,   -- 'guest' | 'owner'
  lang       TEXT NOT NULL DEFAULT 'ru',
  body       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Trigger `trg_message_templates_updated_at` автоматически обновляет `updated_at` при UPDATE.

### 7.2 Migration file

`infrastructure/migrations/20260510_create_message_templates.sql` — идемпотентная миграция (`CREATE TABLE IF NOT EXISTS` + `ON CONFLICT (key) DO UPDATE`). Rollback: `DROP TABLE message_templates;`.

### 7.3 Seeded templates (15)

| key | channel |
|---|---|
| `guest_d_minus_1_checkin` | guest |
| `guest_d_0_morning_checkin` | guest |
| `guest_d_0_evening_checkin` | guest |
| `guest_d_minus_1_checkout` | guest |
| `guest_d_plus_1_review` | guest |
| `owner_d_minus_1_checkin` | owner |
| `owner_d_0_morning_checkin` | owner |
| `owner_d_0_evening_checkin` | owner |
| `owner_d_minus_1_checkout` | owner |
| `owner_d_plus_1_review` | owner |
| `owner_brief_guest_d_minus_1_checkin_sent` | owner |
| `owner_brief_guest_d_0_morning_checkin_sent` | owner |
| `owner_brief_guest_d_0_evening_checkin_sent` | owner |
| `owner_brief_guest_d_minus_1_checkout_sent` | owner |
| `owner_brief_guest_d_plus_1_review_sent` | owner |

### 7.4 Placeholders (9 уникальных)

`{{guest_first_name}}` `{{apartment_id}}` `{{apartment_name}}` `{{checkin_at}}` `{{checkout_at}}` `{{guest_name}}` `{{guest_username}}` `{{booking_id}}` `{{source}}` `{{homereserve_url}}`

Конвенции для T2 render():
- `{{guest_first_name}}` → `, Иван` (с запятой и пробелом) или `` если пустое
- `{{apartment_name}}` → ` (Студия)` (с пробелом и скобками) или `` если пустое

### 7.5 Состояние после T1

- **Workflow 03**: `active=true`, не изменён — тексты берёт из hardcoded JS объектов `M` и `ownerBriefMap`
- **Workflows 01/02/09**: `active=true`, не тронуты
- **bookings**: 19 строк, все `realtycalendar-ical`
- **Webhooks**: owner (`c9a5874f34e45e4d/telegramtrigger/webhook`) и guest (`guestonboard1234/guesttelegramtrigger/webhook`) зарегистрированы

### 7.6 Следующий этап — T2 ✅ выполнен, см. раздел 8.

---

## 8. Message templates (T2) — 2026-05-10

> **Update 2026-05-10**: T2 выполнен. Workflow 03 переключён на чтение шаблонов из `message_templates`. Hardcoded fallback сохранён. Все тесты прошли.

### 8.1 Что изменилось в workflow 03

- Добавлена нода **`Load Templates`** (Postgres, `onError: continueRegularOutput`, position [300, 450]) — запускается параллельно с `Load Owner Chat` от `Hourly Check`:
  ```sql
  SELECT key, channel, body FROM message_templates WHERE active = TRUE AND lang = 'ru';
  ```
- В **`Select Message`** добавлены:
  - `render(body, ctx)` — подставляет 10 плейсхолдеров `{{name}}` из `renderCtx`
  - `tplMap` — Map из output `$('Load Templates').all()` (try-catch, пустой при ошибке)
  - `fromDB(key)` — возвращает `{ text, source: 'message_templates' }` или `null`
  - Разрешение: `fromDB(event_key)` → DB template; иначе `M[event_key]` / `ownerBriefMap` с `template_source: 'fallback_hardcoded'`
  - `owner_brief_key = 'owner_brief_' + event_key + '_sent'` — отдельный ключ для brief

- Backup перед T2: `workflows/backups/03_guest_journey_before_message_templates_t2_20260510_2132.json`

### 8.2 render() — контекст подстановки

| Placeholder | Значение |
|---|---|
| `{{guest_first_name}}` | `, Иван` (с запятой) или `` |
| `{{apartment_name}}` | ` (Стандарт)` (со скобками) или `` |
| `{{apartment_id}}` | `40` |
| `{{checkin_at}}` / `{{checkout_at}}` | `2026-07-04` |
| `{{guest_name}}` | полное имя или `гость не указан` |
| `{{guest_username}}` | `@smartmartin` или `` |
| `{{booking_id}}` | `42-2026-07-04` |
| `{{source}}` | `realtycalendar-ical` |
| `{{homereserve_url}}` | `https://homereserve.ru/m66FXMW0XO/list-preview` |
| `{{guest_chat_id}}` | строка или `` |

### 8.3 Результаты тестов

**Test A (guest event, exec #197)**:
- Бронь `manual-templates-t2-guest-d1` (apt 40, завтра, `guest_chat_id=281361614`)
- `template_source = 'message_templates'` ✅
- Гостю отправлено: `«Здравствуйте, Дмитрий!\nЗавтра ваш заезд в Акваторинг...»` — все `{{}}` подставлены ✅
- Owner brief: `«Гостю отправлено D-1 сообщение по брони ... @smartmartin»` из DB ✅
- `journey_sent.guest_d_minus_1_checkin` записан ✅

**Test B (owner fallback, exec #197)**:
- Бронь `manual-templates-t2-owner-d1` (apt 41, без `guest_chat_id`)
- `template_source = 'message_templates'` ✅
- Владельцу: `«Завтра заезд: объект №41 (Делюкс)...»` из DB ✅
- `journey_sent.owner_d_minus_1_checkin` записан ✅

**Idempotency (exec #198)**:
- Re-run, оба `journey_sent` заполнены → `Calculate Touchpoints items_out: 0` → ни одной отправки ✅

**Fallback test (exec #199)**:
- Временно `active=false` для `guest_d_minus_1_checkin`
- `template_source = 'fallback_hardcoded'` ✅
- Workflow не упал, сообщение отправлено из hardcoded JS ✅
- Шаблон восстановлен (`active=true`) после теста

### 8.4 Состояние после T2

- **Workflow 03**: `active=true`, читает шаблоны из `message_templates`, `template_source` в execution data
- **Workflows 01/02/09**: `active=true`, не тронуты
- **bookings**: 19 строк, все `realtycalendar-ical`, тестовые `manual-templates-t2-*` удалены
- **message_templates**: 15 строк, все `active=true`
- **Webhooks**: owner и guest — healthy

### 8.5 Следующий этап T3

Дождаться первого scheduled run с реальной RC-бронью в окне D±1 (≈ 3 июля 2026), убедиться что `template_source='message_templates'` в execution, затем удалить объекты `M` и `ownerBriefMap` из `Select Message` (заменить на `throw Error` при отсутствии ключа).

*Снимок зафиксирован 2026-05-09, обновлён 2026-05-10.*

---

## 9. Admin Panel A1 — n8n Admin API read-only (2026-05-10)

> **Update 2026-05-10**: A1 выполнен. Workflow 10 активирован, endpoint работает, все 5 smoke-тестов прошли.

### 9.1 Что сделано

- Создан новый workflow **`10 — Admin API`** (id `82575887-be9e-4267-8e8e-2d760de2a986`)
- Webhook: `POST https://owner.aquatoring.ru/webhook/adminapi1234/admin`
- Auth: заголовок `X-Admin-Token`, токен хранится в `system_vars.key='admin_api_token'`
- Локальная копия токена: `infrastructure/.admin_api_token` (chmod 600)
- Backup system_vars: `infrastructure/backups/system_vars_before_admin_api_<TS>.sql`
- Backup workflow: `workflows/backups/10_admin_api_initial_20260510_2334.json`

### 9.2 Actions

| action | HTTP | Что возвращает |
|---|---|---|
| `health` | 200 | bookings_count, rc_bookings_count, latest_rc_sync, templates_count, guest_connected_count |
| `bookings` | 200 | 19 броней: id, apartment_*, checkin/checkout, guest_name, guest_username, guest_connected (bool), deep_link |
| `templates` | 200 | 15 шаблонов: key, channel, lang, body, active, updated_at |
| неверный token | 401 | `{"ok":false,"error":"unauthorized"}` |
| unknown action | 400 | `{"ok":false,"error":"unknown_action"}` |

### 9.3 Security

- `guest_chat_id`, `guest_telegram_id`, `guest_phone`, `guest_email` **не отдаются**
- `guest_connected` — только boolean
- Токен в system_vars, не в env/docker-compose
- Vercel не имеет прямого доступа к Postgres

### 9.4 Smoke tests (2026-05-10 23:3x UTC)

- T1 unauthorized: HTTP 401 ✅
- T2 health: HTTP 200, bookings=19, templates=15, guest_connected=1 ✅
- T3 bookings: HTTP 200, count=19, no guest_chat_id, deep_link present, guest_connected bool ✅
- T4 templates: HTTP 200, count=15, channels={guest:5, owner:10} ✅
- T5 unknown: HTTP 400 ✅

### 9.5 Состояние после A1

- **Workflow 10**: `active=true`, webhook зарегистрирован
- **Workflows 01/02/03/09**: `active=true`, не тронуты
- **Webhooks owner/guest bot**: не изменены

### 9.6 Admin Panel A2 — local Next.js app (2026-05-10)

**Путь**: `admin/` (только эта папка + `admin/README.md`, при необходимости docs).

**Стек**: Next.js App Router · TypeScript · Tailwind · `iron-session` · server-side POST на Admin API с заголовком `X-Admin-Token` (токен не уходит в клиентский бандл).

**Реализовано**:
- `/` → редирект на `/bookings` при валидной сессии, иначе `/login`
- `/login` — пароль (`ADMIN_PASSWORD`), httpOnly cookie
- `/bookings` — `adminApi("bookings")`, таблица (в т.ч. `guest_connected` boolean, `journey_sent`, `deep_link`), фильтры upcoming / past / all (по умолчанию upcoming), client-кнопка копирования deep link
- `/templates` — `adminApi("templates")`, 15 шаблонов, группы guest / owner, read-only, пометка про A4
- `/health` — `adminApi("health")`, карточки + зелёный/красный индикатор
- `GET /logout` — сброс сессии → `/login`
- `middleware` + `requireAuth()` на защищённых роутов

**Локальный URL**: `http://localhost:3000`

**Read-only**: данные только через Admin API; шаблоны не редактируются.

**Smoke (2026-05-10)**:
- `npm run build` — успех ✅
- Прямой вызов Admin API с теми же секретами, что в `.env.local` (без логирования токена): **19** броней, **15** шаблонов, `health` согласован ✅
- Поиск утечки: строка с токеном только в `admin/lib/adminApi.ts` (сервер) ✅
- Интерактивный вход с реальным паролем не автоматизирован в этом прогоне; форма и API `/api/login` готовы к ручной проверке.

**Следующий этап — A3**: деплой на Vercel — задать env (`ADMIN_API_URL`, `ADMIN_API_TOKEN`, `ADMIN_PASSWORD`, `SESSION_PASSWORD` ≥ 32), убедиться что cookie `secure` в production и токен не в `NEXT_PUBLIC_*`.

### 9.7 Admin Panel A3 — Vercel custom domain (2026-05-11)

**Vercel project**: `arenaborba/aquatoring-admin`

**Production URL / alias**: `https://aquatoring-admin.vercel.app`

**Custom domain**: `https://admin.aquatoring.ru`

**Env vars configured in Vercel Production**: yes — `ADMIN_API_URL`, `ADMIN_API_TOKEN`, `ADMIN_PASSWORD`, `SESSION_SECRET` (names only; values not logged).

**Vercel domain status**:
- `admin.aquatoring.ru` added to linked project `aquatoring-admin` via Vercel CLI.
- Vercel required DNS record: `A admin.aquatoring.ru 76.76.21.21` (recommended).
- DNS was not changed from this run: available Wrangler auth showed zone read access, but no DNS edit command/scope; public DNS for `admin.aquatoring.ru` still did not resolve at verification time.

**Smoke (2026-05-11)**:
- `https://admin.aquatoring.ru/login`: not reachable yet — public DNS does not resolve until Cloudflare `admin` record is created.
- Forced Vercel IP check with `--resolve admin.aquatoring.ru:443:76.76.21.21`: TLS failed before DNS verification/certificate readiness.
- Production alias `https://aquatoring-admin.vercel.app/login`: HTTP 200, login page rendered.
- Production alias wrong password `POST /api/login`: HTTP 401.
- Authenticated smoke on production alias with local `ADMIN_PASSWORD` (password not logged): login HTTP 200, `/bookings` HTTP 200, `/templates` HTTP 200, `/health` HTTP 200.
- `/health` showed `bookings_count=19`, `templates_count=15`.
- Token leak check passed on login HTML: no `ADMIN_API_TOKEN` literal and no actual `ADMIN_API_TOKEN` value found.

**Boundaries**:
- `owner.aquatoring.ru` not touched.
- n8n, workflows 01/02/03/09/10, Postgres, Cloudflare named tunnel `gelendzhik-owner-n8n`, Telegram webhooks, root `aquatoring.ru`, `www`, MX/TXT were not changed.

**Manual Cloudflare step still required**:
- In Cloudflare DNS zone `aquatoring.ru`, create/update only record `admin`:
  - Type: `A`
  - Name: `admin`
  - IPv4 address: `76.76.21.21`
  - Proxy status: DNS only (grey cloud) unless Vercel later explicitly verifies with proxied mode
  - TTL: Auto
