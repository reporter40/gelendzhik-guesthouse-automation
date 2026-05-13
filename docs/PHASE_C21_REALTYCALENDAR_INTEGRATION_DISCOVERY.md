# Phase C2.1 — RealtyCalendar Integration Discovery

> **Тип:** Discovery / Read-only  
> **Дата:** 2026-05-13  
> **Предыдущий:** C2.0 (Pricing Approval + Audit Log)  
> **Следующий:** C2.5 (Apply → RealtyCalendar) — требует подтверждения владельца  
>
> **СТРОГИЙ ЗАПРЕТ:** Этот документ — только исследование. Никаких POST/PUT/PATCH в RealtyCalendar. Никаких изменений цен. Никаких закрытий дат.

---

## 1. Что уже известно

### 1.1 Как сейчас работает iCal Sync

**Workflow 01 — RC iCal Sync** (`active=true`, каждые 30 мин):

```
Every 30 Minutes
  → Load Apartments For Sync (SELECT id, lot_id, name, ical_url, base_price FROM apartments)
  → Fetch iCal (GET {ical_url}, responseFormat=text, timeout=30s)
  → Parse (Code: DTSTART/DTEND → ISO dates, apartment_id per lot)
  → Expand Events (Code: deduplicate by apartment_id+start)
  → Upsert Booking (INSERT … ON CONFLICT DO UPDATE)
```

**Поток данных (read-only от RC):**
- RC отдаёт стандартный iCal (RFC 5545) `VEVENT` с `DTSTART`, `DTEND`, `SUMMARY`
- Данные: только занятость (blocked dates), НЕ цены, НЕ availability status
- iCal содержит полные занятые периоды (бронирования + закрытые даты владельцем)

### 1.2 Объекты и их идентификаторы

| apartment_id | Название  | lot_id   | base_price | max_guests |
|---|---|---|---|---|
| `40` | Номер 40 | `302043` | 4 000 ₽ | 4 |
| `41` | Номер 41 | `302052` | 4 500 ₽ | 5 |
| `42` | Номер 42 | `310322` | 4 500 ₽ | 5 |
| `50` | Номер 50 | `310313` | 7 000 ₽ | 7 |

**Ключевой факт:** `lot_id` — это идентификатор объекта в RealtyCalendar (не `apartment_id`).  
В workflow 04 API-запрос строится как `https://realtycalendar.ru/api/v1/lots/{lot_id}/prices`.

### 1.3 iCal URL-формат

```
https://realtycalendar.ru/apartments/export.ics?q=<BASE64(lot_id)>%0A
```

Пример: lot_id=`302043` → base64 `MzAyMDQz` → `?q=MzAyMDQz%0A`  
URL требует авторизованного токена в параметре `q` (base64 от lot_id — это закрытый URL, accessible без дополнительного auth header).

### 1.4 Что есть в базе данных

**apartments** (4 строки, все active=true):
- Поля: `id, name, lot_id, ical_url, base_price, max_guests, rooms, description, checkin_instructions, wifi_name, wifi_password`
- `lot_id` — ключ для RC API
- `ical_url` — рабочий, обновляется 18+ строк bookings каждые 30 мин

**bookings** (19 строк, все `source='realtycalendar-ical'`, `status='confirmed'`):
- Поля: все RC-поля + 7 guest_* полей (Phase B0)
- НЕТ поля `rc_id` — бронирования идентифицируются по составному ключу `{apartment_id}-{checkin_date}`
- `total_amount / net_amount` — NULL для iCal-броней (цены RC не отдаёт через iCal)

**pricing_recommendations** (4 строки, все `status='draft'`):
- Gap windows July 2026: apt40 (18-21 Jul), apt41 (24-25), apt42 (25-26), apt50 (15-17)
- Поля: `id(uuid), apartment_id, date_from, date_to, nights, current_price, recommended_price, recommendation_type, status`

**system_vars** — `RC_AGENCY_ID` присутствует в `.env` (имя переменной найдено, значение не печаталось)

---

## 2. Что неизвестно

### 2.1 RC API для записи цен

**Известно из workflow 04 (inactive):**
```
POST https://realtycalendar.ru/api/v1/lots/{lot_id}/prices
Body: { "prices": { "YYYY-MM-DD": <price_number>, ... } }
Credential: realty_calendar_v1 (httpHeaderAuth) — ТИП ЗАГОЛОВКА НЕИЗВЕСТЕН
```

**Неизвестно:**
- [ ] Имя HTTP-заголовка авторизации (вероятно `Authorization: Bearer ...` или `X-API-Key: ...`)
- [ ] Является ли ключ `RC_AGENCY_ID` из `.env` API-токеном или agency ID?
- [ ] Нужен ли отдельный `api_key` в дополнение к `agency_id`?
- [ ] Есть ли документация API (публичная или на сайте RC для партнёров)?
- [ ] Поддерживается ли `GET /api/v1/lots/{lot_id}/prices` для верификации?
- [ ] Есть ли sandbox/test environment у RC?
- [ ] Как выглядит успешный ответ vs ошибка?
- [ ] Есть ли rate limiting?

### 2.2 RC API для управления доступностью (закрытие/открытие дат)

**Неизвестно:**
- [ ] Существует ли `POST /api/v1/lots/{lot_id}/close` или `/availability`?
- [ ] Как отличить "закрыто владельцем" от "бронирование" в iCal SUMMARY?
- [ ] Есть ли endpoint для установки min_stay?
- [ ] Возможно ли частичное применение (только некоторые даты)?

### 2.3 Credential realty_calendar_v1

**Факт:** В n8n `credentials_entity` **нет записи** `realty_calendar_v1`.
Существующие credentials в n8n:
- `gelendzhik_db` (postgres)
- `Polza Header Auth` (httpHeaderAuth)
- `Telegram Owner Bot` (telegramApi)
- `Telegram Guest Bot` (telegramApi)

Credential `realty_calendar_v1`, упомянутый в workflow 04, **не создан**. Workflow 04 поэтому не активируемый "из коробки".

### 2.4 Переменная RC_AGENCY_ID

В `.env` файле присутствует переменная `RC_AGENCY_ID` (только имя, значение не проверялось).  
**Неизвестно:**
- Является ли значение `RC_AGENCY_ID` API-ключом для доступа к RC API?
- Или это только идентификатор агентства для аналитики?
- Нужен ли отдельный токен, который нужно получить у RC?

---

## 3. Варианты интеграции

### Вариант A — Official RC REST API (предпочтительный)

**Что есть:** Workflow 04 уже содержит готовый вызов:
```
POST https://realtycalendar.ru/api/v1/lots/{lot_id}/prices
{ "prices": { "2026-07-18": 3800, "2026-07-19": 3800, "2026-07-20": 3800 } }
```

**Преимущества:**
- Официальный путь, поддерживается RC
- Можно применять точечно (только нужные даты)
- Аудируемый (RC сохраняет историю изменений на своей стороне)

**Что нужно от владельца:**
1. Подтвердить, что `RC_AGENCY_ID` из `.env` — это API-ключ (или получить отдельный api_key)
2. Уточнить формат заголовка авторизации
3. Протестировать GET-запрос на `/api/v1/lots/302043/prices` (read-only) для верификации

**Блокеры:**
- Нет credential в n8n
- Неизвестен точный формат auth

---

### Вариант B — Browser Automation через Playwright (fallback)

**Сценарий:** Если RC API недоступен или требует специальных соглашений — автоматизация браузера через сайт RC.

**Преимущества:**
- Не требует API-ключа
- Работает через стандартный веб-интерфейс

**Недостатки:**
- Хрупкость при изменении UI RC
- Возможный конфликт с ToS RC
- Нужен контейнер Playwright на VPS (доп. ресурсы)
- Сложнее логировать и откатывать
- Требует хранения логина/пароля RC в конфиденциальных переменных

**Оценка:** Использовать только если API полностью недоступен.

---

### Вариант C — Semi-manual export (безопасный fallback)

**Сценарий:** Система готовит файл изменений цен для владельца, владелец применяет вручную.

**Формат:**
```
Объект 40 (lot 302043): 18-21 июля → 3 800 ₽/ночь
Объект 50 (lot 310313): 15-17 июля → 6 300 ₽/ночь
```

**Преимущества:**
- Абсолютно безопасен
- Нет риска неверного применения
- Работает без API

**Недостатки:**
- Ручной труд владельца
- Задержка между одобрением и применением

**Оценка:** Использовать как промежуточный шаг до стабилизации API, или как резервный канал при ошибке API.

---

## 4. Безопасная модель C2.5

### 4.1 Принципы

1. **Только approved рекомендации** — никогда не применять `draft` или `rejected`
2. **Один объект за один запрос** — не bulk-apply несколько объектов одним вызовом
3. **Preview перед apply** — показать владельцу что именно будет отправлено в RC
4. **Audit log до и после** — записать состояние до, запрос к RC, ответ RC, состояние после
5. **Verification read-back** — после apply сделать GET `/api/v1/lots/{lot_id}/prices` и сравнить с тем, что было установлено
6. **Rollback command** — явный метод восстановления предыдущей цены (применить `current_price` к тем же датам)
7. **Telegram уведомление** — сообщить владельцу в supergroup о каждом apply

### 4.2 Псевдо-pipeline для C2.5

```
ApplyAction(recommendation_id)
  1. Load rec: проверить status='approved', apartment_id, date_from, date_to, recommended_price
  2. Load lot_id from apartments WHERE id = rec.apartment_id
  3. Build prices_obj: { date: price for each date in [date_from, date_to) }
  4. AUDIT LOG: action='pre_apply_check', status='pending'
  5. POST RC API: /api/v1/lots/{lot_id}/prices → { prices: prices_obj }
  6. IF RC error: AUDIT LOG action='apply_failed', status stays 'approved', alert owner
  7. IF RC success:
       a. UPDATE pricing_recommendations SET status='applied', applied_at=now()
       b. AUDIT LOG: action='apply', old_price=current_price, new_price=recommended_price
       c. GET RC prices for verification (optional, if GET is supported)
       d. Telegram notify: "Цена применена: объект {apt}, даты {from}–{to}, {old}→{new} ₽"
  8. ROLLBACK available: store old prices in audit log for reversal
```

### 4.3 Rollback

```sql
-- Rollback хранится в audit_log:
-- old_price = current_price (до apply)
-- Для отката: применить old_price к тем же датам через API
```

Команда отката в Admin API: `pricing_recommendation_rollback` (C2.5 action):
- Найти `apply` запись в audit_log по `recommendation_id`
- Применить `old_price` в RC API
- Обновить `status = 'rolled_back'`
- Audit log записать `action='rollback'`

---

## 5. Таблица рисков

| Риск | Вероятность | Серьёзность | Митигация |
|---|---|---|---|
| **Неверная цена** (опечатка в recommended_price) | Средняя | Высокая | Preview UI, подтверждение перед apply, rollback |
| **Неверный объект** (wrong lot_id) | Низкая | Критическая | Проверка lot_id через read-back из apartments до отправки |
| **Неверные даты** (off-by-one в prices_obj) | Средняя | Высокая | Явный список дат в preview, `date_from <= d < date_to` |
| **RC API недоступен** | Средняя | Средняя | onError: continueRegularOutput, AUDIT LOG action='apply_failed', retry не автоматический |
| **Partial apply** (часть дат применилась, часть нет) | Низкая | Высокая | Batch в одном запросе (один prices_obj на один rec), verification read-back |
| **Невозможность rollback** | Низкая | Высокая | Хранить old_price в audit_log ВСЕГДА до apply |
| **RC API key expired/invalid** | Неизвестно | Критическая | Проверить auth заранее GET-запросом |
| **Конкурентное изменение** (владелец поменял цену в RC вручную, мы перетираем) | Средняя | Средняя | GET read-back перед apply, если расхождение — предупредить |
| **Случайное закрытие дат** | Низкая | Критическая | API `/prices` и API `/close_dates` — РАЗНЫЕ эндпоинты, только `prices` в C2.5 |

---

## 6. Definition of Done для C2.5

### Обязательное перед релизом C2.5:

- [ ] **Credential `realty_calendar_v1` создан** в n8n с рабочим токеном RC API
- [ ] **GET-тест пройден**: `GET https://realtycalendar.ru/api/v1/lots/302043/prices` вернул данные без ошибки авторизации
- [ ] **Dry-run mode** реализован: `{ "dry_run": true }` в запросе не применяет цены, только логирует что было бы отправлено
- [ ] **Preview endpoint** в Admin API: `pricing_recommendation_preview_apply` — возвращает JSON с prices_obj без POST
- [ ] **Test action на небоевом периоде**: применить рекомендацию на прошедшие даты (если RC принимает) или на будущие даты с последующим rollback-тестом
- [ ] **Apply log**: каждый вызов RC API логируется в `pricing_action_audit_log` с `action='apply'`
- [ ] **Verification**: после apply — GET текущих цен из RC, сравнение с тем что отправили
- [ ] **Rollback plan**: команда `pricing_recommendation_rollback` в Admin API протестирована
- [ ] **Telegram уведомление**: владелец получает сообщение о каждом apply/rollback
- [ ] **UI кнопка Apply разблокирована** только для `status='approved'`, только после подтверждения preview

### Порядок активации C2.5:
1. Получить RC API credentials от владельца
2. Создать credential `realty_calendar_v1` в n8n (VPS)
3. Тест GET read-only на `/api/v1/lots/{lot_id}/prices`
4. Реализовать preview + dry-run
5. Первый apply на тестовой рекомендации → verify → rollback
6. Сообщить владельцу результат, получить подтверждение на production use

---

## 7. Текущее состояние (snapshot 2026-05-13)

### Готово для C2.5:
- Таблица `pricing_recommendations` — ✅ (4 gap window recs, все `draft`)
- Таблица `pricing_action_audit_log` — ✅ (схема C2.0, хранит old_price/new_price)
- `lot_id` для всех 4 объектов — ✅ (в `apartments.lot_id`)
- API endpoint pattern — ✅ (найден в workflow 04: `/api/v1/lots/{lot_id}/prices`)
- Admin UI кнопка Apply — ✅ (disabled, помечена "C2.5")

### НЕ готово:
- RC API credential — ❌ (отсутствует в n8n)
- RC API token/key — ❌ (нет `RC_API_KEY` или `RC_API_TOKEN` в `.env`, только `RC_AGENCY_ID`)
- Подтверждение формата auth header — ❌
- Тест GET RC `/prices` endpoint — ❌
- Знание о sandbox/test режиме RC — ❌

### Вопросы к владельцу (БЛОКЕРЫ для C2.5):
1. **RC_AGENCY_ID** из `.env` — это API-ключ? Или нужен отдельный ключ?
2. Какой заголовок использует RC API для авторизации (`Authorization: Bearer ...`? `X-Api-Key`? Другой)?
3. Есть ли у RC тестовый/sandbox режим?
4. Можно ли сделать `GET /api/v1/lots/302043/prices` для проверки без изменений?
5. Разрешает ли владелец автоматически применять цены из approved рекомендаций или каждое применение требует ручного подтверждения?

---

## 8. Быстрая справка: известные RC endpoints

| Endpoint | Метод | Статус | Источник |
|---|---|---|---|
| `https://realtycalendar.ru/apartments/export.ics?q={base64_lot_id}%0A` | GET | **РАБОТАЕТ** (workflow 01, 19 броней) | workflow 01 |
| `https://realtycalendar.ru/api/v1/lots/{lot_id}/prices` | POST | **НЕ ТЕСТИРОВАН** (credential отсутствует) | workflow 04 (inactive) |
| Любые другие endpoints (availability, close, min_stay) | — | **НЕИЗВЕСТНЫ** | — |

---

*Discovery выполнен 2026-05-13. Изменений в БД, workflows, DNS или RealtyCalendar не производилось.*
