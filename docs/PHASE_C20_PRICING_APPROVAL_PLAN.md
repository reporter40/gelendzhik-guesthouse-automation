# Phase C2.0 — Pricing Approval + Audit Log

> Статус: **В РАБОТЕ**  
> Дата: 2026-05-13  
> Предыдущий: C1.7 (recalc)  
> Следующий: C2.5 (Apply → RealtyCalendar)

---

## 1. Цель

Добавить слой одобрения ценовых рекомендаций:
- `Approve` → статус `draft` → `approved`
- `Reject` → статус `draft/approved` → `rejected`
- Все действия пишутся в `pricing_action_audit_log`
- **Никаких изменений в RealtyCalendar** — только внутренняя БД

---

## 2. Статусная машина

```
draft  ──Approve──→  approved  ──(C2.5)──→  applied
  ↑         ↑            │
  │      Re-draft         └──Reject──→  rejected
  └────────────────────────────────────────────┘
```

| Статус | Описание | Действия |
|---|---|---|
| `draft` | Свежая рекомендация | Approve / Reject |
| `approved` | Одобрена владельцем | Reject |
| `rejected` | Отклонена | — (только просмотр) |
| `applied` | Применена в RealtyCalendar (C2.5) | — |

---

## 3. Таблица audit log

```sql
pricing_action_audit_log (
  id uuid pk,
  recommendation_id uuid → pricing_recommendations(id) ON DELETE SET NULL,
  action text,          -- 'approve' | 'reject' | 'apply' | 'recalculate'
  previous_status text,
  new_status text,
  apartment_id integer,
  date_from date,
  date_to date,
  old_price numeric,    -- current_price до действия
  new_price numeric,    -- recommended_price
  reason text,
  actor text default 'admin',
  source text default 'admin_panel',
  metadata jsonb,
  created_at timestamptz
)
```

---

## 4. Admin API actions

| Action | Метод | Описание |
|---|---|---|
| `pricing_recommendation_approve` | POST body `{recommendation_id, reason?}` | draft/rejected → approved |
| `pricing_recommendation_reject` | POST body `{recommendation_id, reason?}` | draft/approved → rejected |
| `pricing_action_audit_log` | GET | Последние 50 событий |

---

## 5. UI на /revenue

### Таблица рекомендаций

Для каждой строки:
- badge статуса (draft/approved/rejected/applied)
- `[Approve]` — активна при status=draft или rejected
- `[Reject]` — активна при status=draft или approved
- `[Apply ↗ RealtyCalendar]` — **disabled**, подпись "C2.5"

### Audit Log блок

Таблица последних действий:
- Время / Апарт / Действие / Статус до→после / Цена / Причина

---

## 6. Строгие запреты

- **Не писать в RealtyCalendar**
- Не менять реальные цены
- Не закрывать даты
- Не менять webhooks/DNS/01/03/09/templates
- Не активировать WF13

---

## 7. Roadmap

```
C2.0 — Approval + Audit Log ← текущий этап
C2.5 — Apply → RealtyCalendar (POST price to RC API, после отдельного решения)
C3.0 — Auto Monitor (WF13 activate, safe_fetch)
```
