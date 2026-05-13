# Phase C2.3 — RealtyCalendar Semi-manual Export

> **Статус:** РЕАЛИЗОВАН (2026-05-13)  
> **Дата:** 2026-05-13  
> **Предыдущий:** C2.2 (RC API Auth Verification — закрыт по официальному ответу RC)  
> **Следующий:** C3 full (competitor monitoring) — параллельно с C2.3

---

## 1. Контекст — Официальный ответ RealtyCalendar

Получен официальный ответ службы поддержки RealtyCalendar (2026-05-13):

> **"API не предоставляем и нет такой возможности, открытого API у нас также нет."**

**Последствия:**
- `POST /api/v1/lots/{lot_id}/prices` — не использовать (API не предоставляется)
- C2.5 Apply via RC API — **ОТМЕНЁН НАВСЕГДА**
- Browser automation для применения цен — не делать без отдельного юридического/операционного решения
- Единственный безопасный путь: **ручное применение владельцем** с помощью экспортированного JSON

---

## 2. Архитектура — Semi-manual export

```
Admin Panel
   ↓ [approved recommendation]
   ↓ "Export for RealtyCalendar"
   ↓
pricing_recommendation_export_rc
   → prices_obj = { "2026-07-15": 6175, ... }
   → manual_instruction = "Открой RealtyCalendar → Цены → ..."
   → status: approved → exported
   → audit log: action=export_rc_manual
   ↓
Admin Panel показывает:
   [prices_obj копируемый JSON]
   [инструкция]
   [кнопка "Mark as manually applied"]
   [кнопка "Mark failed"]
   ↓
Владелец открывает RealtyCalendar вручную
Вводит цены из prices_obj
   ↓
"Mark as manually applied" нажата
   → status: manually_applied
   → audit log: action=manual_applied
```

---

## 3. Новые статусы

Добавлены к `pricing_recommendations.status`:

| Статус | Описание |
|---|---|
| `draft` | Сгенерировано workflow 12 |
| `approved` | Одобрено владельцем |
| `rejected` | Отклонено |
| `applied` | (legacy) |
| `exported` | Export JSON создан, ожидает ручного применения |
| `manually_applied` | Владелец подтвердил применение в RC |
| `apply_failed` | Применение не удалось (помечено вручную) |

---

## 4. Admin API actions

### 4.1 `pricing_recommendation_export_rc`

**Условие:** `status = 'approved'`

**Логика dates:**
- `date_from` — первая ночь (check-in)
- `date_to` — дата checkout (утро)
- Ночи к ценообразованию: от `date_from` до `date_to - 1 день` включительно
- Пример: date_from=2026-07-15, date_to=2026-07-18 (3 ночи) → keys: "2026-07-15", "2026-07-16", "2026-07-17"

**Ответ:**
```json
{
  "ok": true,
  "recommendation_id": "...",
  "apartment_id": "40",
  "lot_id": "302043",
  "date_from": "2026-07-15",
  "date_to": "2026-07-18",
  "nights": 3,
  "recommended_price": 6175,
  "prices_obj": {
    "2026-07-15": 6175,
    "2026-07-16": 6175,
    "2026-07-17": 6175
  },
  "manual_instruction": "..."
}
```

**Audit:** `action=export_rc_manual`, `new_status=exported`, `metadata.prices_obj`

### 4.2 `pricing_recommendation_mark_manual_applied`

**Условие:** `status IN ('exported', 'approved')`  
**Результат:** `status = 'manually_applied'`  
**Audit:** `action=manual_applied`

### 4.3 `pricing_recommendation_mark_apply_failed`

**Условие:** любой `status`  
**Результат:** `status = 'apply_failed'`  
**Audit:** `action=manual_apply_failed`

---

## 5. UI — ApprovalsPanel

| Статус | Кнопки |
|---|---|
| `draft` | Одобрить / Отклонить |
| `approved` | Export for RealtyCalendar / Отклонить |
| `exported` | Mark as manually applied / Mark failed / Copy JSON / Copy instruction |
| `manually_applied` | (только просмотр) |
| `apply_failed` | Одобрить снова |
| `rejected` | Одобрить |

Apply (API) button: **убрана** → текст `"API unavailable"` disabled.

---

## 6. Файлы

| Файл | Действие |
|---|---|
| `docs/PHASE_C21_REALTYCALENDAR_INTEGRATION_DISCOVERY.md` | UPDATED — RC closure note |
| `docs/PHASE_C22_RC_API_AUTH_VERIFICATION.md` | UPDATED — phase closed |
| `docs/PHASE_C23_RC_SEMI_MANUAL_EXPORT_PLAN.md` | NEW |
| `database/migrations/20260513_c23_manual_apply.sql` | NEW — CHECK constraint expansion |
| `workflows/10_admin_api.json` | MODIFIED — 3 новых actions |
| `admin/lib/adminApi.ts` | MODIFIED — новые типы и функции |
| `admin/app/revenue/actions.ts` | MODIFIED — 3 новых server actions |
| `admin/app/revenue/ApprovalsPanel.tsx` | MODIFIED — export / mark UI |

---

## 7. Строгие запреты

- ❌ POST/PUT/PATCH/DELETE в RealtyCalendar
- ❌ Использование закрытого API
- ❌ Browser automation без отдельного решения
- ❌ Автоматическое изменение цен
- ❌ Автоматическое закрытие дат
- ❌ Изменение Telegram webhooks / Cloudflare DNS
- ❌ Активация workflow 13
- ❌ Трогать workflows 01/03/09
- ❌ Изменение message_templates

---

*Создан 2026-05-13.*
