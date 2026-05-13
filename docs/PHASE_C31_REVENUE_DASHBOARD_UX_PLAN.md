# Phase C3.1 — Revenue Dashboard UX: "Что делать сегодня"

**Статус:** В работе (2026-05-13)  
**Фаза:** C3.1 (продолжение C3-lite, C2.x)  
**Цель:** Сделать /revenue понятной для владельца, а не для разработчика.

---

## Контекст

После фаз C2.x у нас есть полный revenue-контур:
- `gap_windows` — маленькие окна между бронями
- `competitor_sources` + `competitor_price_observations` — данные рынка
- `market_history` — история наблюдений
- `pricing_recommendations` — рекомендации со статусами: `draft → approved → exported → manually_applied / apply_failed / rejected`
- `pricing_action_audit_log` — лог всех действий
- Admin API (workflow 10) — все операции через POST /webhook/adminapi1234/admin

**Текущая боль:** страница `/revenue` отображает данные, но не говорит владельцу **что делать прямо сейчас**.

---

## Pain Points, которые решаем

| Боль | Решение |
|------|---------|
| "Что за таблицы? С чего начать?" | Блок "Что сделать сегодня" наверху |
| "Какие рекомендации требуют действий?" | Карточки с priority и CTA |
| "Сколько денег я теряю прямо сейчас?" | KPI карточки с человеческими лейблами |
| "Что нужно перенести в RealtyCalendar?" | Отдельная карточка `exported` |
| "Данные конкурентов свежие?" | Карточка stale observations |
| "Что пошло не так?" | Карточка apply_failed → anchor к audit |

---

## Новый Admin API action: `revenue_dashboard`

### SQL-запрос

Один запрос к PostgreSQL, возвращает:

- Счётчики по статусам рекомендаций: `draft`, `approved`, `exported`, `manually_applied`, `apply_failed`
- Статистику gap_windows: `total_gaps`, `total_estimated_loss`
- Статистику конкурентов: `active_competitors`, `market_median`, `stale_obs`, `fresh_obs`
- Top-3 gap windows (по потере)
- Top-5 recommendations (по приоритету статуса)
- Последние 5 записей audit log

### Response

```json
{
  "ok": true,
  "summary": { ... },
  "today_actions": [
    {
      "id": "string",
      "priority": "high|medium|low",
      "type": "gap|approve|export|market|failed|info",
      "title": "string",
      "description": "string",
      "amount": 35000,
      "cta_label": "string",
      "target": "#gaps"
    }
  ],
  "top_gaps": [...],
  "top_recommendations": [...],
  "latest_audit": [...]
}
```

### Логика приоритетов today_actions

**HIGH (срочно):**
1. `apply_failed > 0` → "Есть ошибки применения" → `#audit-log`
2. `exported > 0` → "Применить вручную в RealtyCalendar" → `#manual-export`
3. `total_gaps > 0` → "Закрыть маленькие окна" → `#gaps`

**MEDIUM (важно):**
4. `approved > 0` → "Одобренная цена ждёт экспорта" → `#recommendations`
5. `draft > 0` → "Одобрить рекомендации" → `#recommendations`
6. `stale_obs > 0` → "Данные конкурентов устарели" → `#competitors`
7. `market_median` > base → "Рынок выше базы" → `#market`

**LOW / INFO:**
8. Нет срочных действий → "Всё в норме" → info

---

## Новые UI компоненты

### TodayActionsPanel.tsx

Верхний блок с карточками. Требования:
- Заголовок: "Что сделать сегодня"
- Priority badges: `Срочно` (red), `Важно` (amber), `Можно позже` (blue)
- Каждая карточка: badge + title + description + amount (₽ если есть) + CTA кнопка
- CTA скроллит к якорю (`#gaps`, `#recommendations`, `#competitors`, `#audit-log`, `#manual-export`)
- Empty state: "Срочных действий нет. Система в норме."
- Skeleton loading при загрузке

### RevenueKpiCards.tsx

Улучшенные KPI карточки сверху:
- "Потенциальная потеря" (₽) — красный акцент если > 0
- "Маленьких окон" — акцент если > 0
- "Медиана рынка" (₽/сут)
- "Ждут решения" (draft + approved) — акцент если > 0
- "Готово к ручному применению" (exported) — оранжевый если > 0
- "Ошибки применения" (apply_failed) — красный если > 0

---

## Порядок секций на /revenue

1. `TodayActionsPanel` — "Что сделать сегодня"
2. `RevenueKpiCards` — KPI
3. `#gaps` — Маленькие окна
4. `#recommendations` — Ценовые рекомендации + ApprovalPanel
5. `#manual-export` — Экспорт и аудит
6. `#competitors` — Конкуренты + наблюдения
7. `#market` — История рынка
8. Критерии отбора
9. Технические детали (устаревший CompetitorForm)

---

## Что не трогаем

- workflows 01/03/09
- workflow 13
- message_templates
- Telegram webhooks
- Cloudflare DNS
- RealtyCalendar (не пишем)
- Реальные цены
- Существующие actions в workflow 10
- Текущие таблицы БД

---

## Definition of Done

- [x] `revenue_dashboard` action добавлен в workflow 10
- [x] `fetchRevenueDashboard()` в adminApi.ts
- [x] `TodayActionsPanel.tsx` отображает today_actions
- [x] `RevenueKpiCards.tsx` заменяет старые summary карточки
- [x] page.tsx реорганизован с новым порядком секций
- [x] anchor IDs добавлены: `#gaps`, `#recommendations`, `#competitors`, `#audit-log`, `#manual-export`
- [x] TypeScript build без ошибок
- [x] today_actions возвращает непустой список при production данных
- [x] Старые actions workflow 10 не сломаны
- [x] Production deploy с backup

---

## Файлы

### Созданные
- `docs/PHASE_C31_REVENUE_DASHBOARD_UX_PLAN.md` (этот файл)
- `admin/app/revenue/TodayActionsPanel.tsx`
- `admin/app/revenue/RevenueKpiCards.tsx`

### Изменённые
- `workflows/10_admin_api.json` (добавлен `revenue_dashboard` action)
- `admin/lib/adminApi.ts` (новые типы + `fetchRevenueDashboard`)
- `admin/app/revenue/page.tsx` (реорганизован, новые компоненты)
- `admin/app/revenue/actions.ts` (при необходимости)

### Backup
- `workflows/backups/10_admin_api_before_c31_revenue_dashboard_<timestamp>.json`
