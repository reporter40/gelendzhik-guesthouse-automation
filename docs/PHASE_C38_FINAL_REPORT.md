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
