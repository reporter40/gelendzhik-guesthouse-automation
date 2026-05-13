# Phase C1.5 — Competitor Market Monitoring Plan

> Статус: **ПЛАН / В РАБОТЕ**
> Дата начала: 2026-05-13
> Предыдущий этап: C1 (pricing_recommendations, competitor_prices form)

---

## 1. Цель модуля

Создать структурированную базу прямых конкурентов с:
- критериями отбора из аналитического отчёта (PDF 2026-05-13);
- seed-данными по 3 активным конкурентам;
- историей наблюдений цен (`competitor_price_observations`);
- расчётом рыночной медианы с учётом similarity_score;
- рекомендациями, основанными на взвешенных рыночных данных;
- **без автоматического изменения цен и без записи в RealtyCalendar**.

---

## 2. Профиль собственных объектов

**Адрес:** ул. Курзальная, 40, Геленджик (район Толстый мыс)

| Параметр | Значение |
|---|---|
| Тип | 4 единицы: 2 домика + 2 этажа под ключ |
| Комнаты | 2 комнаты, отдельный вход |
| Площадь | 35–50 м² |
| Вместимость | 4–6 гостей |
| Кухня | Отдельная кухня / летняя кухня с плитой, холодильником |
| Пляж | 5–7 мин пешком (~600 м) |
| Центр | 1,1 км |
| Остановка | ~270 м |
| Цена | 5 000–7 500 ₽/сутки (высокий сезон) |
| Аудитория | Семьи с детьми, пары, компании 4–6 чел. |

---

## 3. Критерии отбора конкурентов

### Жёсткие фильтры (все должны совпадать):

| Критерий | Фильтр |
|---|---|
| Локация | Геленджик, предпочтительно Толстый мыс / центр |
| Пляж | ≤ 700 м (5–7 мин пешком) |
| Центр | ≤ 1,5 км |
| Транспорт | Остановка ≤ 300 м |
| Тип жилья | Двухкомнатный домик / этаж / квартира под ключ |
| Вход | Отдельный, без общих коридоров |
| Площадь | 30–55 м² |
| Гости | 4–6 (допускается +1–2 доп. места) |
| Кухня | Собственная / летняя, с плитой и холодильником |
| Удобства | Кондиционер, Wi-Fi, ТВ, санузел с душем |
| Цена | ~5 000–7 500 ₽/сутки (исключить < 2 000 и > 10 000) |
| Аудитория | Семейный тихий отдых (исключить молодёжные/корпоративные) |

### Как считать similarity_score:

```
score = (
  location_match * 30  +   # 30 points: same district/beach ≤ 700m
  type_match     * 20  +   # 20 points: same type (domik/etazh/kvartira)
  capacity_match * 15  +   # 15 points: 4-6 guests
  kitchen_match  * 15  +   # 15 points: private kitchen
  amenities_match * 10 +   # 10 points: AC+WiFi+TV+shower
  price_match    * 10      # 10 points: 5000-7500 range
)
```

Итого максимум 100. Порог: ≥ 80 для включения в расчёт медианы.

---

## 4. Seed Competitors из PDF-отчёта

### ✅ Активные конкуренты (similarity_score ≥ 80)

| # | Название | Платформа | Score | Цена ₽/сут |
|---|---|---|---|---|
| 1 | Двухкомнатная квартира на Курзальной 19 | gelendzhik.travel | 95% | 6 000–7 500 |
| 2 | Этаж под ключ на Октябрьской | gelendzhik.travel | 93% | 5 000–6 000 |
| 3 | Двухкомнатная квартира ул. Полевая 29 | travelandia.ru | 85% | 6 000–7 000 |

### ❌ Исключённые

| # | Название | Причина |
|---|---|---|
| 4 | Жильё на Полевой 53а | Общая кухня, площадь 10–20 м², формат комнат, не автономный |

---

## 5. Источники мониторинга и ограничения ToS

| Платформа | Разрешённый метод | Статус |
|---|---|---|
| gelendzhik.travel | safe_fetch (HTTP GET, нет авторизации, нет капчи) | допустимо |
| travelandia.ru | safe_fetch (нет авторизации) | допустимо с задержками |
| Авито (avito.ru) | manual_review_required (защита от ботов, CAPTCHA) | только вручную |
| Booking.com | manual_review_required (строгие ToS) | только вручную |
| Airbnb | manual_review_required (строгие ToS + авторизация) | только вручную |

**Правило:** Если сайт требует авторизацию, использует CAPTCHA или явно запрещает парсинг в robots.txt/ToS — использовать `collection_method = 'manual_review_required'`.

---

## 6. Данные для сбора

Для каждого конкурента:
- `price_per_night` за конкретный период
- `min_stay` (минимальный срок)
- `availability_status` (доступен / занят / manual_review)
- `raw_price_text` (исходный текст с сайта)
- `confidence` (0.0–1.0)
- `collection_method` (seed_from_pdf_report / safe_fetch / manual_input)
- `observed_at` (время наблюдения)

---

## 7. Расчёт market_min/median/avg/max

```sql
-- Только active sources с similarity_score >= 80
-- Взвешенная медиана: вес = similarity_score / 100
SELECT
  MIN(cpo.price_per_night)                            AS market_min,
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY cpo.price_per_night)                     AS market_median,
  AVG(cpo.price_per_night)                            AS market_avg,
  MAX(cpo.price_per_night)                            AS market_max,
  COUNT(DISTINCT cs.id)                               AS source_count
FROM competitor_price_observations cpo
JOIN competitor_sources cs ON cs.id = cpo.competitor_source_id
WHERE cs.status = 'active'
  AND cs.similarity_score >= 80
  AND cpo.stay_date_from BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
```

Freshness check: если `observed_at` > 14 дней назад — снижать confidence.

---

## 8. Как рекомендации учитывают рыночные данные

```
1. Собрать active competitor sources (similarity ≥ 80)
2. Собрать observations за период gap_window
3. Взвешенная медиана = avg(price × similarity/100)
4. Правила C1 остаются, но market_median теперь точнее:
   - gap 1н: max(base * 0.85, weighted_median * 0.80)
   - gap 2н: max(base * 0.90, weighted_median * 0.90)
   - gap 3н: max(base * 0.95, weighted_median * 0.95)
5. Если observations устаревшие (>14 дней): confidence -= 0.15
6. Если нет observations вообще: confidence = 0.35
```

---

## 9. Таблицы БД C1.5

### `competitor_sources` — справочник конкурентов
### `competitor_price_observations` — история наблюдений
### `competitor_monitoring_rules` — правила мониторинга

---

## 10. Roadmap

```
C1.5 — Competitor Market Monitoring (текущий этап)
├── competitor_sources (seed 3 active + 1 excluded)
├── competitor_price_observations (seed prices)
├── competitor_monitoring_rules
├── Admin API: competitor_sources, observations, market_summary
├── Workflow 12: взвешенная медиана
├── Workflow 13: Competitor Monitor (inactive, safe_fetch шаблон)
├── Owner Bot: контекст конкурентов
└── /revenue: таблица конкурентов + наблюдения

C2 — Apply Recommendations
├── Кнопка Approve → status='approved'
├── Кнопка Apply → POST RealtyCalendar
├── Audit log
└── Telegram уведомление

C3 — Auto Monitoring
├── Workflow 13 активировать
├── Автоматический safe_fetch для gelendzhik.travel / travelandia.ru
├── Уведомления о значительных изменениях цен конкурентов
└── Дашборд с историей цен (графики)
```

---

## 11. Строгие запреты

- Не писать в RealtyCalendar
- Не менять цены автоматически
- Не закрывать даты
- Не логиниться на чужие сайты
- Не обходить CAPTCHA
- Не нарушать ToS платформ
- Не делать агрессивный scraping (без задержек)
- Не менять Telegram webhooks
- Не менять Cloudflare DNS
- Не трогать workflows 01/03/09
- Не менять message_templates без diff review

---

## 12. Созданные файлы C1.5

```
database/migrations/
  20260513_c15_competitor_sources.sql        ← NEW

workflows/
  13_competitor_monitor.json                 ← NEW (inactive)
  12_pricing_recommender.json                ← UPDATED (weighted median)
  10_admin_api.json                          ← UPDATED (competitor actions)
  02_owner_bot.json                          ← UPDATED (competitor context)
  backups/
    10_admin_api_before_c15_competitor_monitoring_<TS>.json
    12_pricing_recommender_before_c15_sources_<TS>.json
    02_owner_bot_before_c15_competitor_context_<TS>.json

admin/
  app/revenue/
    page.tsx                                 ← UPDATED (competitor sources block)
  lib/
    adminApi.ts                              ← UPDATED (new types)

docs/
  PHASE_C15_COMPETITOR_MARKET_MONITORING_PLAN.md ← этот файл
```
