# Phase C3.8 — Отчёт (Net/Gross + Direct Booking)

## Формулы

- \( \textit{recommended\_guest\_price} \) — гостевая цель (= прежняя логика `recommended_price`).
- \( \textit{rc\_net\_price} = \mathrm{round}(\textit{recommended\_guest\_price} / (1 + \textit{aggregator\_markup\_percent}/100)) \)
- \( \textit{expected\_aggregator\_guest\_price} = \mathrm{round}(\textit{rc\_net\_price} \cdot (1 + \textit{markup}/100)) \)
- \( \textit{direct\_price} = \mathrm{round}(\textit{recommended\_guest\_price} \cdot (1 - \textit{direct\_discount\_percent}/100)) \)
- \( \textit{direct\_savings\_for\_guest} = \textit{expected\_aggregator\_guest\_price} - \textit{direct\_price} \)
- \( \textit{direct\_owner\_gain} = \textit{direct\_price} - \textit{rc\_net\_price} \)

Default `system_vars`: `aggregator_markup_percent=18`, `direct_discount_percent=5`, `direct_booking_enabled=true`.

## Поля БД (`pricing_recommendations`)

`recommended_guest_price`, `rc_net_price`, `aggregator_markup_percent`, `expected_aggregator_guest_price`, `direct_price`, `direct_savings_for_guest`, `direct_owner_gain`, `pricing_channel` (default `aggregator_adjusted`).  
`recommended_price` сохраняется как guest-facing для совместимости.

## №50 (пример при 10 230 ₽ guest, 18%, 5% direct)

| Метрика | ≈ значение |
|---------|------------|
| rc_net_price | 8 670 |
| expected_aggregator_guest_price | 10 231 |
| direct_price | 9 719 |
| direct_savings_for_guest | 512 |
| direct_owner_gain | 1 049 |

## Export RC

- `prices_obj`: **net** (`rc_net_price`), fallback на legacy `recommended_price` если `rc_net_price` null.
- Аудит `new_price`: **exported net** (`COALESCE(rc_net_price, recommended_price)`).

## Workflows

- **12**: `Load Pricing Vars` + расчёт в `Calculate Recommendations`, расширенный `Upsert`; `Load Gap Windows` теперь отдаёт `status`.
- **10**: `pricing_recommendations`, `revenue` (+ `pricing_recommendations` в ответе), `revenue_dashboard`, `pricing_recommendation_export_rc`.
- **02**: `Load Pricing Recs` + контекст net/gross/direct в `Build Context`.

## Admin UI

- Таблица рекомендаций: рынок, гость, RC net, прямая, выгода.
- Экспорт: крупные блоки net / ожидаемая гостевая / прямая + пояснение про RC.
- Блок «Прямая продажа» + отключённые CTA.

## Что не трогали

RealtyCalendar write, реальные цены/даты, Telegram webhooks, Cloudflare DNS, `message_templates`, workflow 13, деструктивные миграции.

## Production (чеклист оператора)

Бэкап БД + JSON WF02/10/12 → `psql -f database/migrations/20260515_c38_net_gross_pricing.sql` → импорт workflow в n8n → ручной прогон WF12 → деплой admin → смоук: health, revenue, pricing_recommendations, export_rc, dashboard, `/revenue`.

Коммит: см. `git log -1` после merge.

---

## C3.8B Rollout to all apartments (2026-05-15)

**Цель:** единая схема net/gross/direct и `aggregator_markup_percent = 18` для всех активных рекомендаций (№40/41/42/50), без записи в RealtyCalendar.

### Бэкап перед проверкой

- VPS: `/root/backups/c38b_finish_rollout_20260515_173229/`
- Файлы: `pricing_recommendations.csv`, `pricing_action_audit_log.csv`, `system_vars.csv`, `workflow_10_entity.json`, `workflow_12_entity.json`.

### Способ пересчёта

- **WF12 из UI в этой сессии не запускался** (CLI по-прежнему не стартует Schedule-only workflow).
- **SQL backfill не применялся:** после бэкапа диагностика показала, что все 4 строки уже удовлетворяют C3.8B (нет NULL в net/gross/direct, `aggregator_markup_percent = 18`, `rc_net_price = round(guest/1.18)`).
- При появлении новых рекомендаций или дрейфа полей — либо ручной прогон WF12 в n8n, либо одноразовый safe backfill только C3.8-полей (см. план в репо / чеклист оператора).

### Таблица production (все объекты)

| apartment_id | recommended_guest_price (= guest) | rc_net_price | expected_aggregator_guest_price | direct_price | direct_savings_for_guest | direct_owner_gain | status |
|--------------|-------------------------------------|--------------|----------------------------------|--------------|--------------------------|-------------------|--------|
| 40 | 6 175 | 5 233 | 6 175 | 5 866 | 309 | 633 | draft |
| 41 | 5 850 | 4 958 | 5 850 | 5 558 | 292 | 600 | draft |
| 42 | 5 850 | 4 958 | 5 850 | 5 558 | 292 | 600 | draft |
| 50 | 10 230 | 8 669 | 10 229 | 9 719 | 510 | 1 050 | draft |

Инварианты: `recommended_price = recommended_guest_price`, `pricing_channel = aggregator_adjusted`.

### RealtyCalendar и export

- **RealtyCalendar не трогали:** ни API-записи цен, ни закрытия дат.
- **Live `pricing_recommendation_export_rc` не вызывали:** все строки в `draft`; вызов меняет статус в БД (`approved → exported`).
- Логика **WF10 Format Export RC** без изменений: `prices_obj[дата] = rc_net_price` по каждой ночи между `date_from` и последней ночью перед `date_to` (checkout не включается). Пример без мутаций для №40 (3 ночи, net 5 233):  
  `{"2026-07-18":5233,"2026-07-19":5233,"2026-07-20":5233}`.

### Смоук Admin API (production)

- `health`, `revenue`, `pricing_recommendations`, `revenue_dashboard` → **HTTP 200**, `ok: true`; `pricing_recommendations` возвращает **4** строки для №40–42 и №50 с полным набором net/gross/direct полей.
