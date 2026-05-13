# Phase C1.6 — Revenue QA / Human Review Checklist

> Дата: 2026-05-13  
> Статус: **LIVE — PRODUCTION**  
> Режим: **Read-only / Advisory. Никаких изменений цен, никакой записи в RealtyCalendar.**

---

## 1. Текущее состояние производства (snapshot 2026-05-13)

### Admin API

| Action | Статус | Ключевые значения |
|---|---|---|
| `health` | ✅ ok | bookings=19, templates=15 |
| `revenue` | ✅ ok | gaps=4, estimated_loss=35 000 ₽ |
| `competitor_sources` | ✅ ok | total=4, active=3, excluded=1 |
| `competitor_market_summary` | ✅ ok | median=6 500, min=5 500, max=6 750 |
| `pricing_recommendations` | ✅ ok | count=4 (все draft) |

### Gap windows (июль 2026)

| Апарт | Окно | Ночей | Потеря ₽ | Рекомендация |
|---|---|---|---|---|
| №50 | 15 июл → 17 июл | 2 | 14 000 | Спеццена на 2 ночи |
| №40 | 18 июл → 21 июл | 3 | 12 000 | Короткий заезд или min stay |
| №41 | 24 июл → 25 июл | 1 | 4 500 | Короткое окно / разрешить 1 ночь |
| №42 | 25 июл → 26 июл | 1 | 4 500 | Короткое окно / разрешить 1 ночь |

**Итого:** 4 окна, ~35 000 ₽ потенциальных потерь.

### Рыночные данные (seed from PDF, 2026-05-13)

| Конкурент | Score | ₽/сут | Confidence | Метод |
|---|---|---|---|---|
| Квартира на Курзальной 19 | 95% | 6 750 | 0.85 | seed_from_pdf_report |
| Этаж под ключ на Октябрьской | 93% | 5 500 | 0.80 | seed_from_pdf_report |
| Квартира ул. Полевая 29 | 85% | 6 500 | 0.65 | seed_from_pdf_report |

**Рыночная медиана: 6 500 ₽/сут** (min 5 500, avg 6 250, max 6 750)

### Ценовые рекомендации (текущие, source: c1_rules)

| Апарт | Период | Тип | Рек. цена ₽ | Уверенность | Статус |
|---|---|---|---|---|---|
| №50 | 15–17 июл | gap_special_price | 6 300 | 0.45 | draft |
| №40 | 18–21 июл | gap_special_price | 3 800 | 0.45 | draft |
| №41 | 24–25 июл | gap_special_price | 3 825 | 0.45 | draft |
| №42 | 25–26 июл | gap_special_price | 3 825 | 0.45 | draft |

> **Проблема C1.6:** Рекомендации для №40/41/42 (3 825–3 800 ₽) выглядят заниженными по сравнению с рынком (6 500 ₽). Это потому что workflow 12 ещё не запускался с C1.5-логикой (weighted median). После повторного запуска WF12 рекомендации должны вырасти до ~5 200–6 175 ₽.

---

## 2. Как проверить /revenue

### Шаги

1. Открыть `https://admin.aquatoring.ru`
2. Войти под паролем из `.admin_api_token`
3. Перейти в **Revenue Intelligence**

### Что должно быть видно

**Summary cards (6 карточек):**
- Маленьких окон: `4`
- Потери ₽: `35 000`
- Конкурентов: `3`
- Медиана рынка ₽: `6 500`
- Рекомендации: `4`
- 1+2+3 ночи: `2+1+1`

**Market summary block (индиго):**
- Минимум: 5 500
- Медиана: 6 500
- Среднее: 6 250
- Максимум: 6 750
- Активных источников: 3 / Исключено: 1

**Критерии отбора** (карточка с иконками): 8 блоков с критериями.

**Прямые конкуренты (таблица наблюдений):**
- 3 строки с конкурентами
- Метка "seed/PDF ⚠️" на всех (так и должно быть, данные freshness < 14 дней)

**Ценовые рекомендации:**
- 4 строки, все `draft`
- Тип: `Спеццена`

**Gap Windows:** 4 строки по апартаментам

---

## 3. QA-сценарий: добавить 3 обновлённых цены конкурентов вручную

> Цель: обновить рыночные данные через Admin API с реальными ценами, проверить что медиана пересчитается.

### Что нужно сделать владельцу:

**Шаг 1.** Зайти на каждый сайт и посмотреть актуальные цены на **июль 2026**:

| # | Объект | URL | Проверить цену на |
|---|---|---|---|
| 1 | Квартира на Курзальной 19 | https://gelendzhik.travel/kvartiri/kv-na-kurzalnoj-19.html | 15–21 июля 2026 |
| 2 | Этаж под ключ на Октябрьской | https://gelendzhik.travel/vse-zhilyo/etazh/na-oktyabrskoy.html | 15–21 июля 2026 |
| 3 | Квартира Полевая 29 | https://travelandia.ru/gelendzhik/kvartiry/dvuhkomnatnaya-kvartira-13-3353/ | 15–21 июля 2026 |

**Шаг 2.** Добавить каждую цену через форму **"Добавить цену конкурента вручную"** на `/revenue`  
ИЛИ через curl:

```bash
# Замени PRICE на реальную цену, ID на UUID конкурента из competitor_sources
curl -sS \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $(cat infrastructure/.admin_api_token)" \
  -d '{
    "action": "competitor_source_update_manual",
    "competitor_source_id": "<UUID из competitor_sources>",
    "price_per_night": <ЦЕНА>,
    "stay_date_from": "2026-07-15",
    "stay_date_to": "2026-07-21",
    "notes": "ручная проверка июль 2026"
  }' \
  https://owner.aquatoring.ru/webhook/adminapi1234/admin
```

**Шаг 3.** Узнать UUID конкурентов:

```bash
curl -sS \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $(cat infrastructure/.admin_api_token)" \
  -d '{"action":"competitor_sources"}' \
  https://owner.aquatoring.ru/webhook/adminapi1234/admin | python3 -c "
import sys, json
d = json.load(sys.stdin)
for c in d.get('competitor_sources', []):
    if c.get('status') == 'active':
        print(c['id'], '—', c['name'])
"
```

---

## 4. Что должно измениться после добавления новых наблюдений

### Сразу после добавления:

- `competitor_price_observations` получит 3 новые строки с `collection_method = 'manual_input'`
- `competitor_sources.last_checked_at` обновится у каждого источника
- `competitor_market_summary` вернёт обновлённые min/median/avg/max

### Как проверить:

```bash
curl -sS \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $(cat infrastructure/.admin_api_token)" \
  -d '{"action":"competitor_market_summary"}' \
  https://owner.aquatoring.ru/webhook/adminapi1234/admin
```

Ожидаем увидеть:
- `fresh_observations_14d` вырастет (> 3)
- `market_median` изменится если цены отличаются от seed

### После пересчёта рекомендаций (запустить workflow 12 вручную):

- `pricing_recommendations` обновятся с `source='c15_weighted_rules'`
- `confidence` вырастет до 0.60–0.75 (свежие данные)
- `market_median` в рекомендациях будет актуальным
- Рекомендуемые цены для июля должны быть около **5 200–6 175 ₽/сут** вместо текущих 3 800–6 300 ₽

---

## 5. Критические ошибки

| Симптом | Критичность | Действие |
|---|---|---|
| `/revenue` не загружается (500) | 🔴 Критично | Проверить n8n логи: `docker logs gelendzhik-n8n --tail=50` |
| `health: ok: false` | 🔴 Критично | Перезапустить n8n: `docker compose restart n8n` |
| `revenue` API возвращает `ok: false` | 🟡 Важно | Проверить workflow 10 в n8n |
| `competitor_sources` возвращает пустой список | 🟡 Важно | Проверить migration 20260513_c15_competitor_sources.sql |
| Рекомендации не обновляются | 🟠 Некритично | Запустить workflow 12 вручную |
| `stale_warning` появился в market_summary | 🟠 Некритично | Добавить актуальные цены конкурентов вручную |
| Workflow 13 Competitor Monitor активировался | 🔴 Критично | Немедленно деактивировать в n8n UI (C3 ещё не начат) |
| Рекомендуемая цена > 10 000 ₽ | 🟡 Важно | Проверить market data в competitor_prices |
| Цена автоматически изменилась в RealtyCalendar | 🔴 СТОП | Немедленно проверить workflow 04 (должен быть inactive) |

---

## 6. Команды быстрой диагностики

```bash
# Проверка всех ключевых actions
TOKEN=$(cat /Users/Orlova/gelendzhik-guesthouse-automation/infrastructure/.admin_api_token)
BASE="https://owner.aquatoring.ru/webhook/adminapi1234/admin"

# Health
curl -sS -H "X-Admin-Token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"health"}' $BASE | python3 -m json.tool | head -10

# Revenue summary
curl -sS -H "X-Admin-Token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"revenue"}' $BASE | python3 -c "
import sys,json; d=json.load(sys.stdin); s=d.get('summary',{})
print('gaps:', s.get('total_gaps'), 'loss:', s.get('total_estimated_loss'),
      'competitors:', s.get('active_competitors_count'), 'median:', s.get('latest_market_median_from_sources'))
"

# Market summary
curl -sS -H "X-Admin-Token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"competitor_market_summary"}' $BASE | python3 -c "
import sys,json; d=json.load(sys.stdin); m=d.get('market',{})
print('median:', m.get('market_median'), 'fresh_obs:', m.get('fresh_observations_14d'), 'stale:', m.get('stale_warning'))
"

# Pricing recommendations
curl -sS -H "X-Admin-Token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"pricing_recommendations"}' $BASE | python3 -c "
import sys,json; d=json.load(sys.stdin)
print('count:', d.get('count'))
for r in d.get('data',[]): print(' apt=%s rec=%s conf=%s' % (r.get('apartment_id'), r.get('recommended_price'), r.get('confidence')))
"
```

---

## 7. Как улучшить рекомендации (без применения цен)

### Запустить workflow 12 вручную для пересчёта:

```bash
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 '
docker exec gelendzhik-postgres psql -U n8n_user -d n8n_gelendzhik -c "
SELECT id, name FROM workflow_entity WHERE name LIKE '"'"'12%'"'"';"
'
```

Затем в n8n UI (`https://owner.aquatoring.ru`):
1. Открыть **Workflows**
2. Найти `12 — Pricing Recommender`
3. Нажать **Execute Workflow** (ручной запуск без активации)
4. После выполнения проверить `pricing_recommendations` через API

### Ожидаемые рекомендации после пересчёта с C1.5 weighted median (6 500 ₽):

| Апарт | Окно | Рек. цена (сейчас) | Рек. цена (после WF12) | Уверенность |
|---|---|---|---|---|
| №50 | 2 ночи | 6 300 ₽ | ~5 850 ₽ (median×0.90) | 0.60 |
| №40 | 3 ночи | 3 800 ₽ | ~6 175 ₽ (median×0.95) | 0.60 |
| №41 | 1 ночь | 3 825 ₽ | ~5 200 ₽ (median×0.80) | 0.60 |
| №42 | 1 ночь | 3 825 ₽ | ~5 200 ₽ (median×0.80) | 0.60 |

> Разница обусловлена тем, что текущие рекомендации (source: c1_rules) не имели рыночных данных — confidence был 0.45. После запуска WF12 с C1.5-логикой используется weighted median конкурентов.

---

## 8. Что НЕ делать

- **Не активировать workflow 04** (Daily Pricing) — он меняет реальные цены
- **Не активировать workflow 13** (Competitor Monitor) — C3, не готов
- **Не нажимать "Применить" в рекомендациях** — кнопка disabled, C2 ещё не реализован
- **Не менять Telegram webhook** — бот работает
- **Не менять Cloudflare DNS** — tunnel работает
- **Не удалять competitor_sources** — seed данные, восстановить сложно

---

## 9. Следующие шаги (C2)

1. Запустить workflow 12 вручную и проверить обновлённые рекомендации
2. Добавить 2–3 актуальных наблюдения цен конкурентов вручную (июль 2026)
3. После одобрения владельцем — реализовать C2:
   - Кнопка Approve → `status='approved'`
   - Кнопка Apply → POST в RealtyCalendar (только approved)
   - Audit log
