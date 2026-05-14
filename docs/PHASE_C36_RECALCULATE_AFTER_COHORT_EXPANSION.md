# Phase C3.6 — Recalculate Recommendations After Cohort Expansion

**Date:** 14 мая 2026  
**Context:** После Phase C3.5, в которой для объекта №50 было найдено 9 конкурентов-кандидатов (3 approved/active) в когорте `large_family_house_territory`, пересчитываем `pricing_recommendations` с актуальными рыночными данными.

---

## Контекст: что было до пересчёта

### Состояние до (BEFORE — snapshot перед запуском)

| apt | date_from  | nights | curr_price | mkt_median | rec_price | confidence | status        | type              | cohort                    |
|-----|------------|--------|-----------|-----------|-----------|-----------|--------------|-------------------|--------------------------|
| 40  | 2026-07-18 | 3      | 4 000     | 6 500     | 6 175     | 0.60      | draft        | raise_price       | standard_family_2room    |
| 41  | 2026-07-24 | 1      | 4 500     | 6 500     | 6 175     | 0.60      | draft        | raise_price       | standard_family_2room    |
| 42  | 2026-07-25 | 1      | 4 500     | 6 500     | 6 175     | 0.60      | draft        | raise_price       | standard_family_2room    |
| 50  | 2026-07-15 | 2      | 7 000     | **6 500** | 6 300     | 0.60      | apply_failed | gap_special_price | ❌ **wrong cohort!**      |

**Проблема:** Объект №50 сравнивался с когортой `standard_family_2room` (2-комнатные, 4–5 гостей), хотя его когорта — `large_family_house_territory` (крупные объекты 6–8 гостей). Рыночная медиана 6 500 ₽ занижена в 1.7 раза. Рекомендация предлагала снизить цену с 7 000 до 6 300 ₽ — это ошибочный сигнал.

### Когорты до пересчёта

| Когорта                     | active_count | needs_attention | market_median |
|-----------------------------|:------------:|:---------------:|:-------------:|
| standard_family_2room       | 3            | false           | 6 500 ₽       |
| large_family_house_territory| 3            | false           | 11 000 ₽      |
| gelendzhik_background_market| 0            | —               | —             |

---

## Действия в Phase C3.6

### Шаг 1. Backup на VPS

```
/opt/backups/c36_recalc_20260514_214209/tables.sql
```

Содержит: `pricing_recommendations`, `competitor_sources`, `competitor_price_observations`, `competitor_cohorts` — full INSERT dump с `pg_dump --data-only --column-inserts`.

### Шаг 2. Snapshot текущих рекомендаций (BEFORE)

Зафиксирован через прямой SQL-запрос (см. таблицу выше).

### Шаг 3. Миграция схемы: расширение CHECK constraint

**Файл:** `database/migrations/20260514_c36_expand_rec_types.sql`

В workflow 12 (после рефакторинга C3.4) используются новые типы рекомендаций:
- `gap_fill_aggressive` — заполнение окна 1 ночь (скидка 10%)
- `gap_fill_moderate` — заполнение окна 2 ночи (скидка 7%)
- `gap_fill_soft` — заполнение окна 3 ночи (скидка 5%)
- `discount_no_market` — скидка от базы при отсутствии рыночных данных

Эти типы не были добавлены в `pricing_recommendations_type_check` при C3.4. Выполнено **не деструктивное** расширение — добавлены 4 новых значения, все существующие данные сохранены.

### Шаг 4. Пересчёт — replica Workflow 12

**Скрипт:** `scripts/c36_recalculate_recommendations.py`

Скрипт точно воспроизводит логику n8n Workflow 12:
1. Загружает открытые gap windows (все 4 — jul 15–17, jul 18–21, jul 24–25, jul 25–26)
2. Загружает фоновый рынок (background median = 6 000 ₽)
3. Загружает когортно-взвешенные данные конкурентов
4. Рассчитывает рекомендации с confidence-логикой
5. Upsert только `status='draft'` записей

**Специальный шаг:** Запись apt #50 с `status=apply_failed` сброшена в `draft` перед upsert, чтобы пересчёт с правильной когортой был применён. Логика обоснована:
- Backup сделан заранее
- Прежняя рекомендация содержала неверные рыночные данные (wrong cohort)
- `apply_failed` статус означал «не удалось применить в RealtyCalendar» — не «одобрено вручную»

---

## Состояние после пересчёта (AFTER)

| apt | date_from  | nights | curr | mkt_median | rec_price | confidence | status | type                | source                          |
|-----|------------|--------|------|-----------|-----------|-----------|--------|---------------------|--------------------------------|
| 40  | 2026-07-18 | 3      | 4 000| 6 500      | 6 175     | **0.78**  | draft  | gap_fill_soft       | cohort:standard_family_2room   |
| 41  | 2026-07-24 | 1      | 4 500| 6 500      | 5 850     | **0.78**  | draft  | gap_fill_aggressive | cohort:standard_family_2room   |
| 42  | 2026-07-25 | 1      | 4 500| 6 500      | 5 850     | **0.78**  | draft  | gap_fill_aggressive | cohort:standard_family_2room   |
| **50** | **2026-07-15** | **2** | **7 000** | **11 000** | **10 230** | **0.72** | **draft** | **gap_fill_moderate** | **cohort:large_family_house_territory** |

---

## Изменения по объекту №50

| Параметр            | ДО              | ПОСЛЕ             | Изменение              |
|---------------------|-----------------|-------------------|------------------------|
| Когорта             | (не назначена)  | large_family_house_territory | ✅ Правильная когорта |
| market_median       | 6 500 ₽         | **11 000 ₽**      | +69%                   |
| recommended_price   | 6 300 ₽         | **10 230 ₽**      | +62%                   |
| confidence          | 0.60            | **0.72**          | +20%                   |
| status              | apply_failed    | **draft**         | Сброшено для пересчёта |
| recommendation_type | gap_special_price | **gap_fill_moderate** | Новая типология  |
| reason              | "Рекомендация по конкурентам: Курзальная 19..." | **"Объект №50, кластер крупные объекты 6–8 гостей. Рыночная медиана: 11000 ₽. Источников: 3 (свежих: 3)."** | Правильный текст |
| source              | c1_rules / wrong | **cohort:large_family_house_territory** | ✅ |

### Причина роста confidence для №50: 0.40 → 0.72

Логика `confidence_cap` в workflow 12:
```js
if (largeSources < APT_50_MIN_SOURCES) {   // 3 < 3 → FALSE
  confidence = 0.40;                         // cap снят
} else if (market.freshCount >= 2) {         // 3 >= 2 → TRUE
  confidence = 0.72;                         // ✅
}
```

После C3.5: `large_family_house_territory` имеет 3 active sources, 3 fresh observations → cap снят, confidence = 0.72.

---

## Изменения по confidence

| apt | Было | Стало | Изменение |
|-----|------|-------|-----------|
| 40  | 0.60 | 0.78  | +30% — все 3 конкурента fresh (< 14 дней) |
| 41  | 0.60 | 0.78  | +30% — аналогично |
| 42  | 0.60 | 0.78  | +30% — аналогично |
| 50  | 0.60 | 0.72  | +20% — правильный cohort + 3 fresh sources |

Рост confidence для 40/41/42 объясняется: old recs (pre-C3.4) создавались при `fresh_count=0` или `=1` (stale данные), после C3.5 все наблюдения fresh, что увеличивает confidence с 0.60 до 0.78.

---

## Market median по когортам

| Когорта                      | Активных | Свежих | Median | Min    | Max    |
|------------------------------|:--------:|:------:|-------:|-------:|-------:|
| standard_family_2room        | 3        | 3      | 6 500 ₽| 5 500 ₽| 6 750 ₽|
| large_family_house_territory | 3        | 3      |11 000 ₽|10 000 ₽|13 000 ₽|
| gelendzhik_background_market | 0        | 0      | —      | —      | —      |

Данные свежие (наблюдения добавлены 13–14 мая 2026, возраст < 14 дней → `recency_weight = 1.0`).

---

## Что НЕ применялось в RealtyCalendar

Все 4 рекомендации имеют `status = 'draft'`. Ни одна не была:
- применена автоматически
- передана в RealtyCalendar
- изменена в системе бронирования

Для применения требуется ручное Approve + Export RC в интерфейсе `/revenue` → ApprovalsPanel.

---

## Рекомендации, требующие ручного review

### Приоритет HIGH — объект №50

**Рек:** повысить цену с 7 000 до 10 230 ₽/ночь  
**Окно:** 2026-07-15 — 2026-07-17 (2 ночи)  
**Обоснование:** Рыночная медиана крупных объектов = 11 000 ₽; gap_factor 0.93 × 11 000 = 10 230 ₽  
**Confidence:** 0.72 (medium-high)  
**Действие:** Проверить актуальность конкурентных цен, при согласии — Approve → Export RC

### Приоритет MEDIUM — объект №40

**Рек:** gap_fill_soft → 6 175 ₽ (окно 3 ночи, 18–21 июля)  
**Текущая цена:** 4 000 ₽/ночь  
**Медиана рынка:** 6 500 ₽  
**Действие:** Скидочное окно можно закрыть по рыночной цене

### Приоритет MEDIUM — объекты №41, №42

**Рек:** gap_fill_aggressive → 5 850 ₽ (1 ночь)  
**Текущая цена:** 4 500 ₽/ночь  
**Медиана рынка:** 6 500 ₽  
**Действие:** 1-ночные окна требуют гибкого min_stay в RealtyCalendar

---

## Проверки Admin API

| Endpoint                | Статус | Ключевые результаты                                      |
|-------------------------|--------|----------------------------------------------------------|
| `pricing_recommendations` | ✅ OK | 4 рекомендации, apt #50 mkt=11000, conf=0.72            |
| `cohort_market_summary`   | ✅ OK | apt #50: needs_attention=false, active=3, median=11000   |
| `revenue`                 | ✅ OK | recommendations_count=4, market_median=10000             |
| `revenue_dashboard`       | ✅ OK | draft=4, apply_failed=0, stale=0, fresh=8               |

---

## Дополнительное изменение: ApprovalsPanel.tsx

Добавлены метки для новых типов рекомендаций в `REC_TYPE_LABELS`:
- `gap_fill_aggressive` → "⚡ Агрессивно"
- `gap_fill_moderate` → "↗ Умеренно"
- `gap_fill_soft` → "→ Мягко"
- `discount_no_market` → "↓ Скидка (нет рынка)"

---

## Файлы фазы

| Файл | Описание |
|------|----------|
| `database/migrations/20260514_c36_expand_rec_types.sql` | Расширение CHECK constraint для новых типов рекомендаций |
| `scripts/c36_recalculate_recommendations.py` | Standalone replica Workflow 12 для ручного запуска |
| `admin/app/revenue/ApprovalsPanel.tsx` | Добавлены UI-метки для gap_fill_* типов |
| `/opt/backups/c36_recalc_20260514_214209/tables.sql` | Backup на VPS (pricing + competitor tables) |

---

## Следующие шаги (рекомендации)

1. **Ручной review рекомендаций в `/revenue`** — особенно apt #50 (+62% к цене)
2. **Обновить цены конкурентов** — текущие наблюдения введены вручную (май 2026); пиковый сезон может изменить цены
3. **Phase C3.7** (опционально) — автоматический мониторинг конкурентов `large_family_house_territory` (сейчас `signal_quality = medium` из-за отсутствия автоматического сбора)
4. **Workflow 12 schedule** — остаётся без изменений (daily 08:00); после исправления constraint теперь сможет корректно работать при scheduled runs
