# Phase C2.2 — RC API Auth Verification

> **Тип:** Подготовка + read-only auth test  
> **Дата:** 2026-05-13  
> **Предыдущий:** C2.1 (RealtyCalendar Integration Discovery)  
> **Следующий:** C2.5 (Apply → RealtyCalendar) — только после успешной верификации auth  
>
> **СТРОГИЙ ЗАПРЕТ:** Никаких POST `/prices`. Никаких изменений цен. Никаких закрытий дат.  
> Разрешён только GET для проверки авторизации.

---

## 1. Найденный endpoint

Из анализа `workflows/04_daily_pricing.json` (workflow неактивен):

```
POST https://realtycalendar.ru/api/v1/lots/{lot_id}/prices
Content-Type: application/json
Body: { "prices": { "YYYY-MM-DD": <price>, ... } }
Credential: realty_calendar_v1 (httpHeaderAuth)
```

**Для auth verification используется только GET:**
```
GET https://realtycalendar.ru/api/v1/lots/{lot_id}/prices
```

---

## 2. Известные lot_id

| apartment_id | Название  | lot_id   | base_price |
|---|---|---|---|
| `40` | Номер 40 | `302043` | 4 000 ₽ |
| `41` | Номер 41 | `302052` | 4 500 ₽ |
| `42` | Номер 42 | `310322` | 4 500 ₽ |
| `50` | Номер 50 | `310313` | 7 000 ₽ |

Тестовый lot для первой проверки: **`302043`** (Номер 40).

---

## 3. Текущие блокеры

| # | Блокер | Статус |
|---|---|---|
| 1 | RC API token/key — отсутствует в `.env` | ❌ Нет `RC_API_KEY` / `RC_API_TOKEN` |
| 2 | `realty_calendar_v1` credential — не создан в n8n | ❌ Нет в `credentials_entity` |
| 3 | Формат auth header — неизвестен | ❌ Нужно у RC |
| 4 | Наличие GET endpoint для read-only check | ❓ Не проверено |
| 5 | Sandbox / test режим RC | ❓ Неизвестно |

`RC_AGENCY_ID` в `.env` — **присутствует**, но неизвестно: это API-ключ или только идентификатор агентства.

---

## 4. Данные, необходимые от RealtyCalendar

Для перехода к C2.5 нужно получить от RC (поддержка или личный кабинет):

1. **API token** — ключ для авторизации запросов к `/api/v1/`
2. **Формат заголовка** — один из вариантов:
   - `Authorization: Bearer <token>`
   - `X-Api-Key: <token>`
   - `X-Agency-Id: <agency_id>` + `X-Api-Key: <token>`
   - другой формат
3. **Подтверждение GET endpoint** — возвращает ли `GET /api/v1/lots/{lot_id}/prices` текущие цены?
4. **Наличие sandbox** — есть ли тестовый lot_id или тестовое окружение?
5. **Rate limits** — сколько запросов в минуту/час разрешено?
6. **Документация API** — ссылка на официальную документацию (если есть)

---

## 5. Безопасный порядок проверки

### Шаг 1 — Получить credentials (вне системы)
- Получить API token от RealtyCalendar через поддержку или личный кабинет
- Уточнить формат заголовка авторизации
- **Не сохранять в коде / git**

### Шаг 2 — Проверить GET (read-only, нет side effects)
Запустить нужный вариант curl из раздела 6 вручную с реальным токеном:
```bash
export RC_API_TOKEN="<real_token_here>"
# Затем запустить Вариант A, B или C из раздела 6
```

**Ожидаемый успешный ответ:**
- HTTP 200 + JSON с ценами, **или**
- HTTP 200 + пустой объект `{}` (нет цен, но auth успешна), **или**
- HTTP 404 (lot не найден) — auth работает, проблема в lot_id

**Признак неверного auth:**
- HTTP 401 Unauthorized
- HTTP 403 Forbidden

### Шаг 3 — Сохранить credentials безопасно
- Добавить `RC_API_TOKEN=...` в `infrastructure/.env` (не коммитить)
- Создать credential `realty_calendar_v1` в n8n через UI (не через git)

### Шаг 4 — Верификация через Admin API (опционально)
Добавить `rc_api_health` action в workflow 10 (C2.5 задача) для read-only проверки через Admin API:
```
GET https://realtycalendar.ru/api/v1/lots/302043/prices
→ { "ok": true, "rc_auth": "ok", "lot": "302043", "prices_count": N }
```

### Шаг 5 — Только после успешного GET — переход к C2.5
- Реализовать preview endpoint
- Реализовать dry-run
- Первый apply на тестовой рекомендации + immediate rollback

---

## 6. Подготовленные curl-команды (НЕ ЗАПУСКАТЬ без реального токена)

> ⚠️ Переменные `$RC_API_TOKEN` и `$RC_AGENCY_ID` должны быть установлены вручную перед запуском.  
> Эти команды **НЕ должны запускаться автоматически**. Только вручную после получения токена.

### Вариант A — Bearer token

```bash
# Вариант A: Authorization: Bearer
export RC_API_TOKEN="<your_token_here>"

curl -sS -i \
  -H "Authorization: Bearer $RC_API_TOKEN" \
  "https://realtycalendar.ru/api/v1/lots/302043/prices"
```

### Вариант B — X-Api-Key header

```bash
# Вариант B: X-Api-Key header
export RC_API_TOKEN="<your_token_here>"

curl -sS -i \
  -H "X-Api-Key: $RC_API_TOKEN" \
  "https://realtycalendar.ru/api/v1/lots/302043/prices"
```

### Вариант C — Agency ID + Api Key (двойной header)

```bash
# Вариант C: X-Agency-Id + X-Api-Key
export RC_AGENCY_ID="<agency_id_from_env>"
export RC_API_TOKEN="<your_token_here>"

curl -sS -i \
  -H "X-Agency-Id: $RC_AGENCY_ID" \
  -H "X-Api-Key: $RC_API_TOKEN" \
  "https://realtycalendar.ru/api/v1/lots/302043/prices"
```

### Диагностический вариант — проверить все lot_id

```bash
# После подтверждения auth — проверить все 4 объекта
export RC_API_TOKEN="<your_token_here>"
HEADER="Authorization: Bearer"   # или X-Api-Key в зависимости от варианта

for lot in 302043 302052 310322 310313; do
  echo "=== lot $lot ==="
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
    -H "$HEADER $RC_API_TOKEN" \
    "https://realtycalendar.ru/api/v1/lots/$lot/prices"
done
```

---

## 7. Письмо в поддержку RealtyCalendar

> Готов к отправке. Подставить реальный email поддержки RC.

---

**Кому:** support@realtycalendar.ru _(уточнить актуальный адрес)_  
**Тема:** Интеграция API — вопрос по авторизации и GET endpoint для цен

---

Здравствуйте!

Мы управляем гостевым домом «Акваторинг» в Геленджике и используем RealtyCalendar для управления бронированиями (4 объекта: lot_id 302043, 302052, 310322, 310313).

Мы разрабатываем систему автоматизации ценообразования и хотим интегрировать её с RC API для применения рекомендуемых цен после ручного одобрения владельцем.

Нам нужна помощь по следующим вопросам:

**1. API token / ключ доступа**  
Как получить API-ключ для доступа к `/api/v1/`?  
Находится ли он в личном кабинете RC или нужно запросить отдельно?

**2. Формат авторизации**  
Какой HTTP-заголовок используется для авторизации?
- `Authorization: Bearer <token>` ?
- `X-Api-Key: <token>` ?
- Другой формат?

**3. GET endpoint для верификации**  
Доступен ли `GET /api/v1/lots/{lot_id}/prices` для чтения текущих цен?  
Мы хотим использовать его для проверки корректности авторизации без изменения данных.

**4. Sandbox / тестовый режим**  
Есть ли тестовое окружение или тестовый lot_id, на котором можно безопасно проверять API без риска изменить боевые данные?

**5. Документация**  
Есть ли официальная документация API (Swagger, Postman-коллекция или PDF)?

**Наши lot_id объектов:**
- 302043, 302052, 310322, 310313

Заранее спасибо за помощь!

С уважением,  
[Имя владельца]  
Гостевой дом «Акваторинг», Геленджик

---

## 8. Строгие запреты (C2.2)

- ❌ POST `/api/v1/lots/{lot_id}/prices` — не выполнять
- ❌ Любые другие POST/PUT/PATCH к RC API
- ❌ Изменение iCal URL в `apartments`
- ❌ Закрытие / открытие дат
- ❌ Изменение workflows 01/02/03/09
- ❌ Активация workflow 13
- ❌ Изменение Telegram webhooks / Cloudflare DNS
- ❌ Изменение `message_templates`
- ❌ Сохранение фейкового токена в коде или `.env`
- ❌ Создание credential `realty_calendar_v1` без реального токена

---

## 9. Критерии завершения C2.2

- [x] Документ создан
- [ ] Письмо отправлено в RC поддержку
- [ ] RC ответил с инструкцией по авторизации
- [ ] GET-тест выполнен вручную (Вариант A/B/C) → HTTP 200 или HTTP 404
- [ ] Формат auth header подтверждён
- [ ] `RC_API_TOKEN=...` добавлен в `infrastructure/.env`
- [ ] Credential `realty_calendar_v1` создан в n8n

После всех пунктов → переход к **C2.5 Apply → RealtyCalendar**.

---

*Документ создан 2026-05-13. Никаких изменений в системе не производилось.*
