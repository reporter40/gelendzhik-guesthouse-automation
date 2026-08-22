# Адаптация под нового клиента (15 минут)

## Что получить от клиента
1. RC agency_id + API-токен + iCal URLs
2. Объекты: название, цена, вместимость
3. 2 Telegram-бота (токены от @BotFather) + chat_id
4. Claude API ключ (console.anthropic.com)
5. Google Service Account JSON
6. Имя, адрес, стиль общения
7. Местные рестораны, пляжи, маршруты

## Что заменить
1. .env — все токены и ID (3 мин)
2. ai/prompts/*.txt — имя, адрес, объекты (3 мин)
3. ai/pricing/seasons_*.json — цены, коэффициенты (3 мин)
4. database/init.sql — INSERT apartments (2 мин)
5. knowledge_base/*.csv — местные данные (5 мин)

## Контекст объекта для Direct Offer (D1.5)

Бренд / подпись **`property_context`** в строках `pricing_recommendations` задаётся через **`system_vars`**, без правки SQL в workflow.

**Приоритет:** `property_context_map[apartment_id]` → `default_property_context` → `NULL`.

Пример upsert (`key` — первичный ключ в `system_vars`):

```sql
INSERT INTO system_vars (key, value, description)
VALUES (
  'property_context_map',
  '{"50":"Акваторинг"}',
  'JSON map: apartment_id -> property_context for direct offers'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description;

INSERT INTO system_vars (key, value, description)
VALUES (
  'default_property_context',
  'Акваторинг',
  'Fallback property context for direct offers'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description;
```

**Рекомендуется (D1.6):** задавать карту и fallback через админку **`/revenue` → блок «Direct offer · Property context»** (`action: property_context_settings`): JSON валидируется до записи в `system_vars`, битая строка через UI не попадает в БД.

**Аудит (D1.7):** успешное сохранение PCS через Admin API пишет строку в **`pricing_action_audit_log`** (`action` / `reason`: `property_context_settings_save`, полный снимок и diff — в колонке **`metadata`** jsonb: previous/next карта и default, `added_keys`, `changed_keys`, `removed_keys`, размеры). Для штатной эксплуатации используйте экран `/revenue`, а не правку `system_vars` вручную.

**Аварийный / ручной режим:** при необходимости SQL в консоли возможен, но **сырой невалидный JSON** в `property_context_map` может сломать запросы `/revenue`, пока значение не исправят или не очистят; **прямой SQL- seed / UPDATE обходит аудит PCS** — только для аварий или миграций данных.

- Если строки `property_context_map` нет или `value` пустой — запрос не падает, сработает `default_property_context`.
- **Непустой** `value` должен быть **валидным JSON-объектом**; иначе при чтении карты запрос `/revenue` упадёт на `::jsonb` — исправьте JSON или очистите `value`.
- Экспорт в RealtyCalendar поле `property_context` не использует.

## Referral funnel (D2)

Ручной контур «бывший гость рекомендует → фиксация в audit → экспорт CSV» описан в отдельном runbook:

**[Referral funnel runbook](REFERRAL_FUNNEL_RUNBOOK.md)** (`docs/REFERRAL_FUNNEL_RUNBOOK.md`)

Кратко: economics preview и copy — на `/revenue` под строкой с `direct_price`; запись lead — `manual_referral_lead_logged` в `pricing_action_audit_log`; фильтр и экспорт — `?auditFilter=referral`. Ссылки, коды, трекинг и автоматические выплаты **не** входят в scope.

## Запуск
```bash
sudo infrastructure/setup.sh
# Импорт workflows → Credentials → Activate
```
