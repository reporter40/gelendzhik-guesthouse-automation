# Phase C3.2 — Owner Revenue Notifications

**Статус:** В работе (2026-05-14)  
**Фаза:** C3.2 (продолжение C3.1 Revenue Dashboard)  
**Цель:** Telegram-уведомления владельцу о важных revenue-событиях.

---

## Что делает workflow 14

1. Срабатывает каждый день в 09:00 MSK (06:00 UTC)
2. Читает данные из БД (тот же SQL что `revenue_dashboard`)
3. Вычисляет `today_actions` (high / medium)
4. Строит сообщение для Telegram
5. Проверяет anti-spam (hash + timestamp)
6. Если нужно — отправляет в owner group
7. Сохраняет `last_sent_at` и `last_hash` в `system_vars`

---

## Anti-spam механизм

Используем `system_vars`:

| key | значение |
|-----|---------|
| `revenue_notification_last_sent_at` | ISO timestamp последней отправки |
| `revenue_notification_last_hash` | MD5-like hash содержимого last_actions |

**Логика:**
- Если нет high/medium actions → не отправляем
- Если hash совпадает И last_sent < 24 часов назад → не отправляем (дублирование)
- Иначе → отправляем и обновляем hash + timestamp

---

## Формат сообщения

```
📊 Акваторинг Revenue: что сделать сегодня

🔴 Срочно:
• Есть ошибки применения: 1 рекомендация не применена
• Маленькие окна: 4 окна, потеря 35 000 ₽ (№50: 2 ночи 15–17 июл)
• Готово к ручному применению: 1 цена ждёт переноса в RealtyCalendar

🟡 Важно:
• Одобрить рекомендации: 3 рекомендации ждут решения
• Рынок выше базы: медиана 6 500 ₽/сут (+1 000 ₽)

👉 https://admin.aquatoring.ru/revenue
```

---

## Источники данных

- `gap_windows` — total_gaps, top gap
- `pricing_recommendations` — status counts
- `competitor_price_observations` + `competitor_sources` — market_median, stale_obs
- `system_vars` — owner_chat_id, anti-spam vars

---

## Узлы workflow 14

| Нод | Тип | Действие |
|-----|-----|---------|
| Daily 09:00 MSK | scheduleTrigger | trigger |
| Load Vars | postgres | SELECT system_vars |
| Revenue Data Query | postgres | dashboard SQL |
| Build Notification | code | build message + hash |
| If Should Notify | if | hash changed OR > 24h AND has actions |
| Send Telegram | telegram | send to owner_chat_id |
| Save State | postgres | UPDATE system_vars |
| Silent Exit | noOp | если нечего отправлять |

---

## Ограничения

- `active = false` при создании — активировать отдельно вручную
- Не трогает workflow 03 (Guest Journey)
- Не изменяет message_templates
- Не пишет в RealtyCalendar
- Только читает БД (кроме system_vars anti-spam state)

---

## Definition of Done

- [x] `docs/PHASE_C32_OWNER_REVENUE_NOTIFICATIONS_PLAN.md`
- [x] `workflows/14_revenue_notifications.json` (active=false)
- [x] Anti-spam через system_vars
- [x] Dry-run: сообщение строится корректно
- [x] Controlled send: 1 тестовое сообщение доставлено
- [x] Anti-spam: повторный вызов не отправляет
- [x] После теста: `active` оставить false, дать владельцу активировать
