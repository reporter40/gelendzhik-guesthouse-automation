# Phase C3.3 — Revenue Notifications QA + Operations Panel

**Статус:** В работе (2026-05-14)
**Зависит от:** C3.2 (workflow 14 активирован)

---

## Цель

Добавить наблюдаемость и QA-контроль для Revenue Notifications:
- Видеть статус workflow 14 прямо в админке `/revenue`
- Понимать: уведомление было отправлено или пропущено anti-spam
- Видеть hash текущего состояния (изменился ли)
- Иметь читаемый блок "Revenue уведомления" для владельца

---

## Что проверяем

| Проверка | Источник | Ожидание |
|---------|---------|---------|
| workflow 14 active | `workflow_entity.active` | `true` |
| `activeVersionId` заполнен | `workflow_entity.activeVersionId` | UUID |
| n8n container | `docker compose ps` | Up |
| Anti-spam last_sent_at | `system_vars` | ISO timestamp |
| Anti-spam last_hash | `system_vars` | hex строка |
| Execution после 09:00 | `execution_entity` | status=success |

---

## Как работает anti-spam

1. Workflow 14 запускается в **09:00 МСК (06:00 UTC)**
2. Загружает `system_vars`: `revenue_notification_last_sent_at`, `revenue_notification_last_hash`
3. Строит сообщение из текущих данных БД
4. Вычисляет hash содержимого (djb2)
5. **Пропускает отправку** если: `same_hash AND last_sent < 24h назад`
6. **Отправляет** если: hash изменился ИЛИ прошло >24 часа
7. После отправки — обновляет `system_vars`

---

## Expected behavior после 09:00 МСК (06:00 UTC)

- Если данные не изменились с последнего controlled send (13.05.2026 21:42 UTC):
  - К 06:00 UTC 14.05 прошло > 8 часов, но < 24 часов
  - hash `65c76bea` тот же → **anti-spam заблокирует**
  - Уведомление не придёт — это **корректное поведение**

- Если к 06:00 UTC 15.05 данные всё ещё те же:
  - Прошло > 24 часов → **отправит несмотря на same hash**
  - Это тоже корректно (ежедневный дайджест)

- Если данные изменились (новые gaps, failed, exported):
  - Новый hash → **отправит сразу**

---

## Что считать ошибкой

- `workflow_entity.active = false` после перезапуска
- Execution status = `error` в `execution_entity`
- Anti-spam state не обновился после успешной отправки
- n8n container `Exited`
- `activeVersionId = NULL`

---

## Что не трогаем

- Workflows 01, 02, 03, 09, 10 (кроме добавления read-only action)
- Telegram webhooks (не меняем)
- Cloudflare DNS (не меняем)
- RealtyCalendar (не пишем)
- message_templates (не меняем)
- Реальные цены и даты (не меняем)
- Workflow 13 (не активируем)

---

## Admin API action: `revenue_notifications_status`

Новый action в workflow 10 (read-only):

```json
{
  "ok": true,
  "workflow": {
    "id": "14",
    "name": "14 — Revenue Notifications",
    "active": true,
    "schedule": "daily_09_msk",
    "schedule_utc": "06:00"
  },
  "anti_spam": {
    "last_sent_at": "2026-05-13T21:42:06Z",
    "last_hash": "65c76bea",
    "within_24h": false,
    "next_allowed_at": "2026-05-14T21:42:06Z",
    "status": "ready"
  },
  "latest_dashboard": {
    "today_actions_count": 4,
    "high_count": 2,
    "medium_count": 2,
    "low_count": 0,
    "current_hash": "65c76bea"
  },
  "last_execution": {
    "status": "unknown",
    "started_at": null,
    "finished_at": null,
    "sent": null,
    "skip_reason": null
  }
}
```

---

## UI блок RevenueNotificationsPanel

Порядок блоков на `/revenue`:
1. Hero / Revenue Intelligence
2. TodayActionsPanel
3. **RevenueNotificationsPanel** ← новый
4. KPI cards
5. Остальные секции

---

## Definition of Done

- [x] `docs/PHASE_C33_REVENUE_NOTIFICATIONS_QA_PLAN.md`
- [x] `workflow 10` — новый action `revenue_notifications_status`
- [x] `admin/lib/adminApi.ts` — новые типы + `fetchRevenueNotificationsStatus()`
- [x] `admin/app/revenue/RevenueNotificationsPanel.tsx`
- [x] `/revenue` page — блок добавлен на 3-ю позицию
- [x] Build OK, deploy OK
- [x] Commit + push
- [ ] Проверить завтра после 09:00 МСК: execution status + new anti-spam state
