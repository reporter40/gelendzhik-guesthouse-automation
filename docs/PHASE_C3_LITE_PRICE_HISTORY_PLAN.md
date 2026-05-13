# Phase C3-lite — Price History & Monitoring UI

> **Статус:** В работе  
> **Дата:** 2026-05-13  
> **Предыдущий:** C2.2 (RC API Auth Verification — заблокирован)  
> **Следующий:** C3 full (automated competitor monitoring — workflow 13)
>
> **СТРОГИЙ ЗАПРЕТ:** Не писать в RealtyCalendar. Не менять цены. Не активировать WF13.

---

## 1. Цель

Улучшить revenue-модуль без записи в RealtyCalendar:
- история рыночных цен конкурентов по датам наблюдений;
- fresh/stale статусы для каждого источника;
- ручной ввод новых наблюдений;
- мини-таблица рыночной медианы по дням;
- подготовка к будущему автоматическому мониторингу.

---

## 2. Новые Admin API actions

### 2.1 `market_history`

Группирует `competitor_price_observations` по дню наблюдения:

```sql
SELECT
  observed_at::date       AS obs_date,
  COUNT(*)                AS count,
  COUNT(*) FILTER (WHERE (NOW()-observed_at) <= INTERVAL '14 days') AS fresh_count,
  COUNT(*) FILTER (WHERE (NOW()-observed_at) > INTERVAL '14 days') AS stale_count,
  MIN(price_per_night)::float     AS min_price,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_night)::float AS median_price,
  AVG(price_per_night)::float     AS avg_price,
  MAX(price_per_night)::float     AS max_price
FROM competitor_price_observations
WHERE price_per_night IS NOT NULL
GROUP BY observed_at::date
ORDER BY observed_at::date DESC
LIMIT 30
```

Ответ: `{ ok: true, action: 'market_history', count: N, data: [...] }`

### 2.2 `add_competitor_observation`

Добавляет новое наблюдение цены конкурента вручную:

```
Input: { competitor_source_id, stay_date_from, stay_date_to, price_per_night, notes? }
collection_method = 'manual'
confidence = 0.7
observed_at = now()
```

### 2.3 `competitor_price_observations` (enhanced)

Добавлены необязательные фильтры в body запроса:
- `competitor_source_id` — только по одному источнику
- `date_from` — stay_date_from >=
- `date_to` — stay_date_to <=
- `limit` — max записей (default 50)
- `latest_only` — DISTINCT ON competitor_source_id, только последнее по каждому

---

## 3. Frontend изменения

### 3.1 `MarketHistoryPanel` компонент

Таблица + текстовый sparkline медианы по дням:

```
Дата наблюдения | Всего | Fresh | Stale | Min ₽ | Медиана ₽ | Avg ₽ | Max ₽
2026-05-13       |   3   |   3   |   0   | 4 500  | 5 200     | 5 100 | 5 800
```

Бар-чарт медианы — pure CSS (div с width proportional to max median).

### 3.2 `FreshnessBlock`

Показывает:
- fresh (≤ 14 дней): N источников
- stale (> 14 дней): N источников
- last observed: YYYY-MM-DD

### 3.3 `ManualObservationForm`

`<details>` форма с:
- `<select>` конкурент (из `competitor_sources` active)
- Дата от / до
- ₽/ночь
- Заметки

POST via server action `addObservationAction` → Admin API `add_competitor_observation`.

---

## 4. Файлы

| Файл | Действие |
|---|---|
| `docs/PHASE_C3_LITE_PRICE_HISTORY_PLAN.md` | NEW |
| `workflows/10_admin_api.json` | MODIFIED |
| `admin/lib/adminApi.ts` | MODIFIED |
| `admin/app/revenue/actions.ts` | MODIFIED |
| `admin/app/revenue/MarketHistoryPanel.tsx` | NEW |
| `admin/app/revenue/ManualObservationForm.tsx` | NEW |
| `admin/app/revenue/page.tsx` | MODIFIED |

---

## 5. Строгие запреты (C3-lite)

- ❌ Не писать в RealtyCalendar
- ❌ Не менять цены в RC
- ❌ Не активировать workflow 13
- ❌ Не трогать workflows 01/03/09
- ❌ Не менять Telegram webhooks / Cloudflare DNS
- ❌ Не менять message_templates

---

## 6. Definition of Done

- [ ] `market_history` action работает в production
- [ ] `add_competitor_observation` сохраняет наблюдение
- [ ] `competitor_price_observations` поддерживает фильтры
- [ ] `/revenue` UI показывает историю рынка
- [ ] Build проходит без ошибок
- [ ] Старые actions health/revenue/pricing_recommendations не сломаны

---

*Создан 2026-05-13.*
