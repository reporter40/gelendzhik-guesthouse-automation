# Phase C1 — Revenue Recommendations Plan

> Статус: **ПЛАН / В РАБОТЕ**
> Дата начала: 2026-05-13
> Предыдущий этап: Phase C0 (gap_windows, competitor_prices, /revenue read-only)

---

## 1. Цель этапа

Расширить Revenue Intelligence до **advisory mode**:
- Ручной ввод цен конкурентов через `/revenue` форму.
- Автоматический расчёт ценовых рекомендаций на основе gap_windows + competitor_prices + base_price.
- Отображение рекомендаций в Admin Panel с бейджами статуса.
- Owner Bot умеет отвечать на вопросы о ценах.
- **Никакой записи в RealtyCalendar и никаких изменений реальных цен** (это C2).

---

## 2. Таблицы БД

### 2.1 `pricing_recommendations` (новая)

| Колонка | Тип | Описание |
|---|---|---|
| id | UUID PK | gen_random_uuid() |
| apartment_id | VARCHAR(20) NOT NULL | ID объекта |
| date_from | DATE NOT NULL | Начало периода |
| date_to | DATE NOT NULL | Конец периода |
| nights | INTEGER NOT NULL | Длительность |
| current_price | NUMERIC NULL | Текущая базовая цена |
| market_min | NUMERIC NULL | Мин. цена конкурентов |
| market_median | NUMERIC NULL | Медиана конкурентов |
| market_avg | NUMERIC NULL | Средняя по рынку |
| market_max | NUMERIC NULL | Макс. цена конкурентов |
| recommended_price | NUMERIC NOT NULL | Рекомендованная цена |
| recommendation_type | TEXT NOT NULL | gap_special_price / raise_price / lower_price / hold_price |
| reason | TEXT NOT NULL | Объяснение рекомендации |
| confidence | NUMERIC NULL | 0.0–1.0 (уверенность) |
| source | TEXT NOT NULL DEFAULT 'c1_rules' | Источник расчёта |
| status | TEXT NOT NULL DEFAULT 'draft' | draft / approved / applied / rejected |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

### 2.2 `competitor_prices` (уже существует, ничего не меняем)

---

## 3. Admin API — новые/расширенные actions

### Расширение `revenue`

Добавить в `summary`:
- `competitor_count` — число конкурентов в БД
- `market_min`, `market_median`, `market_avg`, `market_max` — по ближайшим датам (±30 дней)
- `recommendations_count` — число draft рекомендаций

### Новый action `revenue_add_competitor_price`

POST body:
```json
{
  "action": "revenue_add_competitor_price",
  "source": "Авито",
  "title": "Домик у моря",
  "url": "https://avito.ru/...",
  "location": "Геленджик",
  "max_guests": 4,
  "rooms": 2,
  "date_from": "2026-07-01",
  "date_to": "2026-07-31",
  "price_per_night": 5500,
  "rating": 4.8,
  "reviews_count": 42,
  "notes": "Ближайший конкурент"
}
```

Ответ: `{ "ok": true, "id": "...", "message": "competitor price added" }`

### Новый action `pricing_recommendations`

Возвращает список `pricing_recommendations` из БД (status=draft, date_from >= today).

---

## 4. Workflow 12 — Pricing Recommender

**Trigger:** scheduleTrigger, daily в 08:00 МСК (или manual)
**Входные данные:** gap_windows (open), competitor_prices, apartments (base_price)
**Выход:** INSERT/UPSERT pricing_recommendations

### Правила расчёта

| Условие | recommendation_type | Формула | confidence |
|---|---|---|---|
| gap nights=1, нет market | gap_special_price | base_price * 0.85 | 0.45 |
| gap nights=1, есть market | gap_special_price | max(base_price * 0.85, market_median * 0.80) | 0.70 |
| gap nights=2, нет market | gap_special_price | base_price * 0.90 | 0.45 |
| gap nights=2, есть market | gap_special_price | max(base_price * 0.90, market_median * 0.90) | 0.70 |
| gap nights=3, нет market | gap_special_price | base_price * 0.95 | 0.50 |
| gap nights=3, есть market | gap_special_price | market_median * 0.95 или base_price | 0.65 |
| market_median > base_price * 1.20 | raise_price | market_median * 0.90 | 0.65 |
| market_median < base_price * 0.80 + близкое окно | lower_price | market_median * 1.05 | 0.60 |

---

## 5. Страница /revenue (обновление)

- **Summary cards**: total_gaps, total_estimated_loss, competitor_count, market_median, recommendations_count
- **Gap Windows table** — без изменений
- **Competitor Prices** — активная форма добавления + таблица
- **Pricing Recommendations** — таблица с бейджами draft/approved/applied/rejected
- Кнопки approve/apply — **disabled**, пометка «C2»

---

## 6. Owner Bot (02) — новый контекст

Блок в context_text:
```
ЦЕНОВЫЕ РЕКОМЕНДАЦИИ:
- Номер X, дата_от — дата_до: рекомендуется ₽Y (тип, причина)
...
Если рекомендаций нет — "Ценовых рекомендаций на ближайшие 90 дней нет."
```

Бот умеет отвечать на:
- «Что поднять в цене?» → рекомендации типа raise_price
- «Какие окна продать спецценой?» → gap_special_price
- «Какая рекомендованная цена на июль?» → фильтр по дате
- «Почему такая цена?» → поле reason

---

## 7. Roadmap

```
C1 — Advisory recommendations (текущий этап)
     ├── Таблица pricing_recommendations
     ├── Форма ручного ввода competitor_prices
     ├── Workflow 12 — Pricing Recommender (scheduled, inactive)
     ├── Admin API: revenue_add_competitor_price + pricing_recommendations
     └── Owner Bot: контекст рекомендаций

C2 — Apply recommendations (следующий)
     ├── Кнопка approve → status='approved'
     ├── Кнопка apply → POST в RealtyCalendar API
     ├── Audit log изменений цен
     └── Telegram уведомление владельцу
```

---

## 8. Строгие запреты (те же, что и C0)

- Не писать в RealtyCalendar
- Не закрывать даты
- Не менять цены автоматически
- Не менять Telegram webhooks
- Не менять Cloudflare DNS
- Не трогать workflows 01/03/09
- Не менять message_templates без diff review
- Не делать destructive migration без backup

---

## 9. Список файлов C1

```
database/migrations/
  20260512_c1_pricing_recommendations.sql  ← NEW

workflows/
  12_pricing_recommender.json              ← NEW (inactive)
  10_admin_api.json                        ← UPDATED (revenue_add_competitor_price + pricing_recommendations)
  02_owner_bot.json                        ← UPDATED (pricing_recommendations context)
  backups/
    10_admin_api_before_c1_pricing_<TS>.json
    02_owner_bot_before_c1_pricing_context_<TS>.json

admin/
  app/revenue/
    page.tsx                               ← UPDATED (form + recommendations table)
    actions.ts                             ← NEW (Server Action: addCompetitorPrice)
  lib/
    adminApi.ts                            ← UPDATED (new types + actions)

docs/
  PHASE_C1_REVENUE_RECOMMENDATIONS_PLAN.md ← этот файл
```

---

## 10. Тесты готовности C1

- [ ] `pricing_recommendations` таблица создана
- [ ] competitor_prices form: POST через Server Action работает
- [ ] Admin API `revenue_add_competitor_price` → 200
- [ ] Admin API `pricing_recommendations` → список
- [ ] Admin API `revenue` summary включает competitor_count, market_median, recommendations_count
- [ ] Workflow 12 JSON валиден, active=false
- [ ] Owner Bot context включает pricing_recommendations
- [ ] `/revenue` page билдится, форма включена
- [ ] health/bookings/templates не сломаны
- [ ] Никаких изменений в RealtyCalendar
