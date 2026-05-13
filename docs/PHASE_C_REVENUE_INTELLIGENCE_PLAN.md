# Phase C — Revenue Intelligence Plan

> Статус: **C0 РЕАЛИЗОВАН локально, требует деплоя на VPS + Vercel**
> Дата начала: 2026-05-12 | Дата завершения C0: 2026-05-13
> Предыдущий этап: Phase B5 (Guest Journey) + Admin Panel A2/A3 + VPS Migration

---

## 1. Цель этапа

Дать владельцу гостевого дома **read-only инструмент анализа доходности**:
- видеть маленькие «дыры» в календаре между бронями (1–3 ночи) которые сложно продать;
- видеть календарь цен (текущие vs базовые vs рекомендованные);
- получать рекомендации по ценам на основе сезона, загруженности, дня недели;
- вручную вносить данные конкурентов для сравнения;
- **не писать в RealtyCalendar автоматически** на этом этапе;
- **не закрывать даты автоматически** на этом этапе.

---

## 2. Roadmap

```
C0 — Read-only анализ (текущий этап)
     ├── Схема БД: gap_windows, competitor_prices
     ├── Workflow 11 — Gap Analyzer (scheduled, read-only)
     ├── Admin panel: страница /revenue
     └── Owner Bot: ответы на вопросы про дыры и цены

C1 — Ценовые рекомендации (следующий)
     ├── Workflow 12 — Price Recommender (scheduled)
     ├── price_history заполняется рекомендациями
     ├── Admin panel: /prices (просмотр + ручная корректировка)
     └── Owner Bot: «на эти выходные рекомендую поставить X»

C2 — Полуавтоматическая публикация (будущее, требует отдельного go)
     ├── Workflow 04 — Daily Pricing (активировать из inactive)
     ├── Интеграция RC Pricing API (credentials realty_calendar_v1)
     ├── Ручное подтверждение перед записью в RC
     └── Хранение истории применённых изменений
```

---

## 3. Таблицы БД (C0)

### 3.1 `gap_windows` — маленькие окна между бронями

```sql
CREATE TABLE IF NOT EXISTS gap_windows (
    id               SERIAL PRIMARY KEY,
    apartment_id     VARCHAR(20) NOT NULL REFERENCES apartments(id),
    gap_start        DATE NOT NULL,        -- день после checkout предыдущей брони
    gap_end          DATE NOT NULL,        -- день до checkin следующей брони
    gap_nights       INTEGER GENERATED ALWAYS AS (gap_end - gap_start) STORED,
    prev_booking_id  VARCHAR(50),          -- id брони до окна
    next_booking_id  VARCHAR(50),          -- id брони после окна
    revenue_loss_est INTEGER,              -- оценочные потери (gap_nights * base_price)
    status           VARCHAR(20) DEFAULT 'open',  -- open | noted | ignored
    detected_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (apartment_id, gap_start)
);

CREATE INDEX IF NOT EXISTS idx_gap_windows_apt ON gap_windows(apartment_id);
CREATE INDEX IF NOT EXISTS idx_gap_windows_start ON gap_windows(gap_start);
CREATE INDEX IF NOT EXISTS idx_gap_windows_nights ON gap_windows(gap_nights);
```

**Логика обнаружения окна:**
- Для каждого апартамента отсортировать брони по `checkin_at`.
- Найти пары (prev_booking, next_booking) где `next.checkin_at > prev.checkout_at`.
- Разрыв `gap_nights = next.checkin_at - prev.checkout_at`.
- Если `gap_nights BETWEEN 1 AND 3` — окно считается «маленьким» (труднопродаваемым).
- `revenue_loss_est = gap_nights * apartments.base_price`.

**Порог:** настраивается через `system_vars.gap_window_threshold_nights` (default=3).

---

### 3.2 `competitor_prices` — ручной ввод цен конкурентов

```sql
CREATE TABLE IF NOT EXISTS competitor_prices (
    id               SERIAL PRIMARY KEY,
    competitor_name  VARCHAR(100) NOT NULL,  -- «Вилла Анна», «Дача Морская» etc.
    apartment_type   VARCHAR(50),            -- «2-комнатная», «студия» etc.
    check_date       DATE NOT NULL,
    price_per_night  INTEGER NOT NULL,
    source           VARCHAR(50) DEFAULT 'manual',  -- manual | avito | booking
    notes            TEXT,
    recorded_by      VARCHAR(50) DEFAULT 'owner',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitor_date ON competitor_prices(check_date);
CREATE INDEX IF NOT EXISTS idx_competitor_name ON competitor_prices(competitor_name);
```

---

### 3.3 `price_history` — уже существует, использовать для рекомендаций

Таблица уже создана в `init.sql`. В C0 заполняется только рекомендациями (без записи в RC). В C2 будет хранить применённые изменения.

**Добавить поле `is_recommendation BOOLEAN DEFAULT TRUE`** — отличает рекомендацию от применённого значения. (Миграция в C1, не сейчас.)

---

## 4. Workflow (C0)

### Workflow 11 — Gap Analyzer (новый, inactive до готовности)

**Trigger:** scheduleTrigger, daily в 07:00 МСК  
**Что делает:**
1. `Load Bookings` — читает `bookings` на 90 дней вперёд, сортирует по `apartment_id, checkin_at`.
2. `Find Gaps` — Code-нода, для каждого апартамента попарно сравнивает брони, вычисляет разрывы.
3. `Filter Small Gaps` — только `gap_nights BETWEEN 1 AND threshold` (читает `system_vars.gap_window_threshold_nights`).
4. `Upsert gap_windows` — INSERT ... ON CONFLICT (apartment_id, gap_start) DO UPDATE.
5. `Notify Owner` (опционально, C1) — если обнаружено новое окно, слать brief в `@ownergelen_bot`.

**Не делает:** не меняет цены, не закрывает даты, не пишет в RC.

---

### Workflow 02 — Owner Bot (расширение, C0)

Добавить в `Build Context` дополнительный блок данных:

```
GAP WINDOWS (маленькие окна):
- Номер 40: 15–16 июля (1 ночь), потери ~4000 ₽
- Номер 42: 20–22 июля (2 ночи), потери ~9000 ₽
```

Polza сможет отвечать на вопросы типа «какие дыры есть в июле?».

**Изменения минимальны:** только дополнительный Postgres-запрос в `Load Bookings Window` и добавление блока в `Build Context`. Не ломает существующую логику.

---

## 5. Страницы Admin Panel (C0)

### `/revenue` — Revenue Intelligence Dashboard

**Компоненты:**
- `GapWindowsTable` — таблица маленьких окон: апартамент, даты, ночей, потери. Сортировка по потерям.
- `PriceCalendar` — read-only сетка 60 дней: колонки = апартаменты, строки = даты. Ячейка: текущая занятость + base_price.
- `CompetitorPricesForm` — форма ручного добавления данных конкурентов (POST).

**API endpoints (добавить в workflow 10 Admin API):**
- `{"action":"gap_windows"}` → список из `gap_windows` WHERE `gap_start >= today` AND `status != 'ignored'` ORDER BY `revenue_loss_est DESC`.
- `{"action":"price_calendar","days":60}` → матрица дат × апартаменты с занятостью и ценами.
- `{"action":"competitor_prices"}` → список из `competitor_prices` за последние 30 дней.
- `{"action":"add_competitor_price", ...}` → INSERT в `competitor_prices`.

---

## 6. Как считать маленькие окна

```
Для каждого apartment_id:
  bookings_sorted = SELECT * FROM bookings
    WHERE apartment_id = X AND checkin_at >= today
    ORDER BY checkin_at

  FOR i IN 0..len-2:
    prev = bookings_sorted[i]
    next = bookings_sorted[i+1]
    gap = next.checkin_at - prev.checkout_at  -- в днях

    IF gap >= 1 AND gap <= threshold:
      UPSERT gap_windows SET
        gap_start = prev.checkout_at,
        gap_end = next.checkin_at,
        prev_booking_id = prev.id,
        next_booking_id = next.id,
        revenue_loss_est = gap * apartments[X].base_price,
        status = 'open'  -- только если не было manual 'ignored'
```

**Граничные случаи:**
- Окно в прошлом (gap_start < today) — пропустить.
- Первая бронь апартамента без предыдущей — не окно.
- Последняя бронь апартамента без следующей — не окно (нет верхней границы).

---

## 7. Как считать рекомендации по ценам (C1, не сейчас)

Формула (черновик для C1):

```
base = apartments.base_price
season_mult:
  июнь–август = 1.4
  май, сентябрь = 1.1
  октябрь–апрель = 0.85
weekend_mult:
  пятница, суббота = 1.15
  остальные = 1.0
occupancy_mult:
  если в эту неделю > 80% объектов заняты = 1.2
  если > 60% = 1.1
  иначе = 1.0
gap_discount:
  если дата внутри gap_window с gap_nights <= 2 = 0.85  -- скидка на дыры

recommended_price = round(base * season_mult * weekend_mult * occupancy_mult * gap_discount / 100) * 100
```

Все мультипликаторы вынести в `system_vars` для ручной настройки.

---

## 8. Запрещённые действия в C0

| Действие | Статус |
|---|---|
| Запись в RealtyCalendar (цены, закрытие дат) | ЗАПРЕЩЕНО до C2 |
| Автоматическое изменение цен | ЗАПРЕЩЕНО до C2 |
| Автоматическое закрытие дат | ЗАПРЕЩЕНО |
| Изменение Telegram webhooks | ЗАПРЕЩЕНО |
| Изменение Cloudflare DNS | ЗАПРЕЩЕНО |
| ALTER TABLE bookings/apartments | Только с явным backup |
| Активация workflows 04/05/06/07/08 | ЗАПРЕЩЕНО до C2 |
| Изменение message_templates без diff review | ЗАПРЕЩЕНО |
| Деплой на VPS без local test | ЗАПРЕЩЕНО |

---

## 9. Порядок реализации C0

### Шаг 1 — Миграция БД (local, без VPS пока)
```
database/migrations/20260512_c0_revenue.sql
```
Создать `gap_windows`, `competitor_prices`. Добавить `system_vars`: `gap_window_threshold_nights = 3`.  
**Тест локально:** `docker exec gelendzhik-postgres psql ...`

### Шаг 2 — Workflow 11 (Gap Analyzer)
Создать `workflows/11_gap_analyzer.json`.  
Тест: manual run, проверить `gap_windows` таблицу.  
Бэкап перед активацией.

### Шаг 3 — Расширить workflow 02 (Owner Bot context)
Backup `02_owner_bot.json` → `workflows/backups/02_..._before_gap_context_<TS>.json`.  
Добавить Postgres-нода `Load Gap Windows` + блок в `Build Context`.  
Тест: отправить вопрос про дыры в календаре.

### Шаг 4 — Admin API (workflow 10)
Добавить actions: `gap_windows`, `price_calendar`, `competitor_prices`, `add_competitor_price`.  
Тест через `curl -d '{"action":"gap_windows"}'`.

### Шаг 5 — Admin panel `/revenue` страница
Файлы в `admin/app/revenue/`.  
Компоненты: `GapWindowsTable`, `PriceCalendar`, `CompetitorPricesForm`.  
Тест локально.

### Шаг 6 — Deploy VPS + Vercel
После успешного local test:
- rsync на VPS, применить миграцию.
- Обновить workflow 10 и 02 через n8n import.
- `git push main` для Vercel.

---

## 10. Файловая структура изменений C0

```
database/
  migrations/
    20260512_c0_revenue.sql    ✅ СОЗДАН: gap_windows, competitor_prices, system_vars seed

workflows/
  11_gap_analyzer.json          ✅ СОЗДАН (inactive, готов к импорту на VPS)
  backups/
    02_owner_bot_before_c0_gap_context_20260513_084442.json  ✅ backup
    10_admin_api_before_c0_revenue_20260513_084542.json       ✅ backup
  02_owner_bot.json             ✅ ОБНОВЛЁН: Load Gap Windows + gap context block
  10_admin_api.json             ✅ ОБНОВЛЁН: If Revenue → Revenue Query → Respond Revenue

admin/
  app/
    revenue/
      page.tsx                  ✅ СОЗДАН (summary cards, gap table, competitor table)
  components/
    Nav.tsx                     ✅ ОБНОВЛЁН: добавлена ссылка Revenue
  lib/
    adminApi.ts                 ✅ ОБНОВЛЁН: AdminAction += "revenue", RevenueData types

docs/
  PHASE_C_REVENUE_INTELLIGENCE_PLAN.md  ← этот файл
```

---

## 11. Определение готовности C0

- [x] `gap_windows` таблица создана локально, 4 gap windows найдено
- [x] Owner Bot код обновлён для чтения gap_windows
- [x] Admin panel `/revenue` страница создана и билдится без ошибок
- [x] Admin API action `revenue` возвращает JSON (локально: ok=true, 4 gaps, ₽35К потери)
- [x] `competitor_prices` таблица создана (форма disabled, ввод в C1)
- [x] Ни одна из запрещённых операций не выполнялась
- [x] `bookings` count = 19, `message_templates` не тронуты
- [x] Backups workflow сделаны перед каждым изменением
- [ ] VPS: миграция c0_revenue.sql применена
- [ ] VPS: workflow 10 обновлён в n8n
- [ ] VPS: workflow 02 обновлён в n8n
- [ ] VPS: workflow 11 импортирован в n8n (inactive)
- [ ] Vercel: admin app задеплоен с /revenue страницей

---

## 12. Команды деплоя на VPS

### 1. Применить миграцию на VPS
```bash
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
  'docker exec gelendzhik-postgres psql -U n8n_user -d n8n_gelendzhik \
   -f /opt/gelendzhik-guesthouse-automation/database/migrations/20260512_c0_revenue.sql'
```
*(Предварительно rsync файла миграции на VPS)*

### 2. rsync workflows на VPS
```bash
rsync -avz --progress \
  -e "ssh -i ~/.ssh/aquatoring_prod_hetzner" \
  /Users/Orlova/gelendzhik-guesthouse-automation/workflows/ \
  root@178.105.139.57:/opt/gelendzhik-guesthouse-automation/workflows/
```

### 3. Обновить workflow 10 и 02 в VPS n8n через SQL
```bash
# Сначала убедись что workflow IDs на VPS совпадают
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
  "docker exec gelendzhik-postgres psql -U n8n_user -d n8n_gelendzhik -t \
   -c \"SELECT id, name FROM workflow_entity WHERE name LIKE '%Admin%' OR name LIKE '%Bot%'\""
```

### 4. Задеплоить Vercel frontend
```bash
cd /Users/Orlova/gelendzhik-guesthouse-automation/admin
git push origin main  # Vercel auto-deploys
```

---

## 13. Результаты локальных тестов C0 (2026-05-13)

| Проверка | Результат |
|---|---|
| Миграция `gap_windows` | ✅ таблица создана |
| Миграция `competitor_prices` | ✅ таблица создана |
| `system_vars` gap threshold | ✅ добавлена запись |
| Gap windows найдено (SQL) | ✅ 4 окна: №40 (3н ₽12К), №41 (1н ₽4.5К), №42 (1н ₽4.5К), №50 (2н ₽14К) |
| Total estimated loss | ✅ ₽35 000 |
| Admin API `revenue` (HTTP) | ✅ 200 OK, ok=true |
| Admin API возвращает gap_windows | ✅ 4 записи |
| Admin API возвращает summary | ✅ total_gaps=4, one_night=2, two=1, three=1 |
| Next.js build `/revenue` | ✅ без ошибок TypeScript |
| Workflow 02 backup создан | ✅ |
| Workflow 10 backup создан | ✅ |
| Workflow 11 JSON создан | ✅ (inactive) |
| Nav.tsx обновлён | ✅ |
| Существующие /health /bookings /templates | ✅ не тронуты |
