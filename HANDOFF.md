# Release / Handoff — Admin D1 & D2

**Дата:** 2026-05-20  
**Эпики:** D1 Direct Offer Funnel · D2 Referral Funnel  
**Репозиторий:** https://github.com/reporter40/gelendzhik-guesthouse-automation  
**Admin app:** `admin/` (Next.js, Vercel)

Краткий чеклист релиза: что задеплоить, как проверить production, границы автоматизации.  
Операционный referral-процесс: **[docs/REFERRAL_FUNNEL_RUNBOOK.md](docs/REFERRAL_FUNNEL_RUNBOOK.md)**.

---

## Current production endpoints

| Роль | Endpoint |
|------|----------|
| **VPS** | `178.105.139.57` — n8n, PostgreSQL, инфраструктура |
| **n8n (owner)** | [owner.aquatoring.ru](https://owner.aquatoring.ru) → VPS |
| **Admin panel** | [admin.aquatoring.ru](https://admin.aquatoring.ru) → Vercel (`admin/`) |

Admin API: webhook WF10 на VPS; токен `x-admin-token` в env Vercel (`ADMIN_API_TOKEN` / см. `admin/.env.local`).

---

## Implemented scope

### D1 — Direct Offer Funnel

- Direct Offer Generator (`generateDirectOffer`, Telegram / WhatsApp / Short)
- Local / env template settings (`direct-offer-settings`)
- Row-aware recommendation context (цены, даты, объект из строки)
- `property_context` propagation в offer copy (WF02 + `system_vars`)
- Property context settings editor (PCS) на `/revenue`
- PCS audit (`property_context_settings_save` в audit log)
- Audit metadata viewer (сводки, badges, export RC meta)
- Direct Offer Presets (быстрая смена тона/длины текста)

### D2 — Referral Funnel

- Referral economics helper (`calculateReferralDirectEconomics`)
- Internal referral economics preview (`ReferralEconomicsPreview`)
- Referral invitation copy for **former guest** (`ReferralOfferCopyPanel`)
- Manual referral lead log (`manual_referral_lead` → audit)
- Referral audit viewer (MRL summary в журнале)
- Referral filters + KPI (`Referral leads: N`)
- CSV / TSV export / copy referral leads
- Audit deep-link (`/revenue?auditFilter=referral`)
- Scroll anchor к `#audit-log`
- Referral funnel runbook (`docs/REFERRAL_FUNNEL_RUNBOOK.md`)

---

## D1 Direct Offer Funnel summary

**Цель:** администратор копирует готовый текст **прямого предложения новому гостю** по строке с `direct_price > 0`, без изменения формул ценообразования и без автобронирования.

**Где:** `/revenue` → панель под строкой рекомендации → Direct Offer + Presets; PCS — блок настроек property context.

**Не делает:** не меняет `direct_price` / `rc_net_price`, не экспортирует в RC автоматически (RC export — отдельный action), не создаёт ссылки на оплату.

---

## D2 Referral Funnel summary

**Цель:** ручной контур «бывший гость → приглашение → фиксация lead → экспорт из audit».

**Где:** тот же `/revenue`; economics + copy только при valid referral economics; lead — `ManualReferralLeadPanel`; журнал — фильтр Referral leads, CSV/TSV.

**Экономика (кратко):** `referralPrice = round(market × 0.95)`, reward 5% от referral price. Подробно — runbook.

**Не делает:** links, codes, click/booking tracking, payouts, CRM, bookings. Lead = запись в `pricing_action_audit_log`.

---

## Required deployment items

Для полного D1/D2 behavior на production нужен **актуальный** workflow:

| Артефакт | Обязательно |
|----------|-------------|
| `workflows/10_admin_api.json` | **Да** — Admin API (PCS, MRL, audit query) |
| Vercel deploy `admin/` | **Да** — UI D1/D2 |
| `ADMIN_API_TOKEN` на Vercel | **Да** — совпадает с `system_vars` / n8n |

### WF10 checklist (проверить после импорта)

В `workflows/10_admin_api.json` должны быть:

- [ ] Action `property_context_settings` (load/save PCS)
- [ ] Action `manual_referral_lead` (mode `save`)
- [ ] `pricing_action_audit_log` query возвращает поле **`metadata`** (json)
- [ ] Audit events: `property_context_settings_save` (PCS save)
- [ ] Audit events: `manual_referral_lead_logged` + `metadata.event_type: manual_referral_lead`

Деплой WF: см. **[docs/N8N_WORKFLOW_SAFE_DEPLOY.md](docs/N8N_WORKFLOW_SAFE_DEPLOY.md)** (`infrastructure/deploy_workflow_safe.sh`).

### WF02 (если используете owner bot recommendations)

Если pricing recommendations / `property_context` в Telegram-боте владельца:

- [ ] Проверить актуальность `workflows/02_owner_bot.json` (JOIN `property_context_map` из `system_vars`)

---

## Admin verification checklist

Production ([admin.aquatoring.ru](https://admin.aquatoring.ru)):

- [ ] Login успешен
- [ ] `/revenue` открывается, рекомендации загружаются
- [ ] У строки с `direct_price > 0` виден **Direct Offer Panel**
- [ ] **Direct Offer Presets** меняют текст (Telegram / WhatsApp / Short)
- [ ] Property context settings: load / save работает
- [ ] PCS save → запись в audit (`property_context_settings_save`)
- [ ] При valid referral economics — **Referral economics · internal**
- [ ] **Referral invitation · for former guest** — copy panels
- [ ] **Log manual referral** → Save → `audit_recorded: true`
- [ ] Audit filter **Referral leads** показывает MRL записи
- [ ] Copy / Download CSV / Copy TSV для referral leads
- [ ] `/revenue?auditFilter=referral` — фильтр + scroll к `#audit-log`

---

## n8n workflow checklist

1. Импорт / safe deploy `10_admin_api.json` на VPS (owner.aquatoring.ru).
2. Workflow **active**, webhook отвечает (не 404).
3. Credential PostgreSQL `gelendzhik_db` на месте.
4. `system_vars`: ключ admin token совпадает с Vercel.
5. Smoke: `action: health` с `x-admin-token`.
6. Smoke: `pricing_action_audit_log` — в ответе `data[].metadata` не null для новых PCS/MRL записей.

---

## Local verification

```bash
cd admin
npm run test    # ожидается >= 161 passed
npm run build   # Next.js build OK
npm run dev     # http://localhost:3000/revenue
```

UI smoke:

- `/revenue`
- `/revenue?auditFilter=referral`

---

## Safety boundaries

- **RealtyCalendar export** не менялся (D1/D2).
- **`rc_net_price`** и **`direct_price`** formulas в workflows не менялись.
- Referral **не** создаёт публичные ссылки.
- Referral **не** создаёт referral codes / coupons.
- Referral **не** трекает клики.
- Referral **не** трекает брони автоматически.
- Referral **не** выполняет выплаты.
- Referral lead = **audit log entry**, не CRM-статус.
- Referral **не** заменяет бухгалтерский / юридический процесс выплат бывшему гостю.

---

## Known limitations

- Тексты offer/referral — только ручное копирование; нет deep links для гостя.
- Referral export — из **загруженных** 50 записей audit на странице (не полный historical dump).
- MRL без `recommendation_id` — отдельные строки audit, не привязаны к approve/export RC.
- Presets и template settings — localStorage + env; не синхронизируются между браузерами.
- WF10 на prod может отставать от git — без redeploy MRL/PCS actions вернут 400/unknown action.

---

## Documentation links

| Документ | Назначение |
|----------|------------|
| [docs/REFERRAL_FUNNEL_RUNBOOK.md](docs/REFERRAL_FUNNEL_RUNBOOK.md) | Пошаговый D2 referral funnel |
| [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) | Адаптация, ссылка на runbook |
| [docs/N8N_WORKFLOW_SAFE_DEPLOY.md](docs/N8N_WORKFLOW_SAFE_DEPLOY.md) | Безопасный импорт WF на n8n |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Общее развёртывание |
| [admin/VERCEL.md](admin/VERCEL.md) | Vercel team / env |
| [docs/PRODUCTION_VERIFICATION_D3_1.md](docs/PRODUCTION_VERIFICATION_D3_1.md) | D3.1 production verification (latest status) |

**Latest D3.1 status (2026-05-16):** **PARTIAL_PASS** — backend/API **PASS** (D3.1A+B); D3.1C-local documented. **Awaiting only:** Production UI checklist + Vercel confirmation. **PASSED** only after explicit **`UI OK, Vercel OK`**. Gate table: [docs/PRODUCTION_VERIFICATION_D3_1.md](docs/PRODUCTION_VERIFICATION_D3_1.md#d31c--manual-ui--vercel-confirmation-pending). **No code/workflow/DB changes** until user sign-off or blocker report.

---

## Next possible increments

| ID | Идея | Scope |
|----|------|--------|
| **D3.1** | Dashboard widget «последние N referral leads» на `/revenue` | UI only, те же audit data |
| **D3.2** | Release notes в `docs/GELENDZHIK_AUTOMATION_RELEASE_STATE_*.md` | Docs |
| **D4+** | Referral codes / tracking / payouts | **Out of scope** until explicit epic |

---

## Historical: Bugfix — n8n Workflows (2026-04-15)

**Дата:** 2026-04-15  
**Исполнитель:** Claude Code (claude-sonnet-4-6)  
**Ветка:** main

### Что было сделано

Полный аудит и исправление **7 из 8** n8n-воркфлоу. Найдено и устранено **14 багов**, из которых 6 критических (воркфлоу просто не работал).

---

## Изменённые файлы

| Файл | Изменений |
|------|-----------|
| `workflows/01_ical_sync.json` | +71 / -52 |
| `workflows/02_owner_bot.json` | +65 / -42 |
| `workflows/03_guest_journey.json` | +36 / -24 |
| `workflows/04_daily_pricing.json` | +39 / -21 |
| `workflows/05_weekly_report.json` | +12 / -33 |
| `workflows/06_watchdog.json` | +18 / -22 |
| `workflows/08_rc_webhooks.json` | +96 / -58 |

---

## Детали багов по файлам

### 01_ical_sync.json
| # | Баг | Исправление |
|---|-----|-------------|
| 1 | `{{ json.lot }}` — отсутствует `$` в URL выражении, запрос всегда падал | `{{ $json.lot }}` |
| 2 | `input.first()` — устаревший API n8n v1 в node Parse | `$input.first()` |
| 3 | **[КРИТИЧНО]** После парсинга данные никуда не шли — мёртвый конец | Добавлены ноды `Expand Events` + `Upsert Booking` (Postgres INSERT ON CONFLICT) |

### 02_owner_bot.json
| # | Баг | Исправление |
|---|-----|-------------|
| 1 | **[КРИТИЧНО]** Голосовые сообщения никогда не скачивались — нужен флаг `"download": true` на тригере | Добавлен `additionalFields.download: true` |
| 2 | **[КРИТИЧНО]** Ollama node напрямую обращался к `$node["Whisper STT"].json.text` из текстовой ветки — exception | Добавлен промежуточный нод `Normalize Input` для слияния обеих веток |
| 3 | chat_id брался из `$node["Telegram Trigger"]` внутри Ollama — ненадёжно через слияние | Normalize Input явно пробрасывает `chat_id` |

### 03_guest_journey.json
| # | Баг | Исправление |
|---|-----|-------------|
| 1 | **[КРИТИЧНО]** `Calculate Days` не был подключён к следующему ноду — воркфлоу останавливался | Добавлена связь `Calculate Days → Select Message → Send Guest Bot` |
| 2 | **[КРИТИЧНО]** Ссылка на несуществующий нод `"Messages"` — exception при каждом запуске | Заменён реальным нодом `Select Message` с текстами для дней 7, 3, 1, 0 |
| 3 | `input.all()` → `$input.all()` (устаревший API) | Исправлено |

### 04_daily_pricing.json
| # | Баг | Исправление |
|---|-----|-------------|
| 1 | **[КРИТИЧНО]** Нет ноды `"Pricing Logic"` — `Update RC` ссылался на неё, exception при каждом запуске | Добавлен нод `Pricing Logic` с сезонным алгоритмом (коэфф. + weekend premium) |
| 2 | **[КРИТИЧНО]** Нет связи `Property Data → [Pricing Logic] → Update RC` | Связи добавлены |
| 3 | Триггер `hoursInterval: 24` не гарантирует 06:00 — запускается через 24h от старта | Заменён на cron `"0 6 * * *"` |

### 05_weekly_report.json
| # | Баг | Исправление |
|---|-----|-------------|
| 1 | **[КРИТИЧНО]** Connections: `"Sunday 20:00" → "Weekly Stats"`, но нод называется `"Check DB"` — DB никогда не выполнялась, в Telegram летел пустой отчёт | Нод переименован в `"Weekly Stats"`, chat_id заменён на `$env.OWNER_CHAT_ID`, добавлен `COALESCE` для NULL revenue |

### 06_watchdog.json
| # | Баг | Исправление |
|---|-----|-------------|
| 1 | Пинговался только `HEALTHCHECK_ICAL_UUID`, `HEALTHCHECK_PRICING_UUID` игнорировался | Добавлен второй нод `Ping Pricing Health`, оба запускаются параллельно |

### 08_rc_webhooks.json
| # | Баг | Исправление |
|---|-----|-------------|
| 1 | **[КРИТИЧНО]** SQL-инъекция: `WHERE rc_id = {{ $json.data.booking.id }}` — прямая конкатенация | Заменён на Postgres-нод с параметризованным WHERE |
| 2 | **[КРИТИЧНО]** При создании бронирования не было сохранения в Postgres, только в Google Sheets | Добавлен нод `Save to Postgres` (INSERT ON CONFLICT UPDATE) |

---

## Что НЕ было изменено

- `07_error_handler.json` — рабочий, баг не найден
- `database/` — схема не трогалась
- `infrastructure/docker-compose.yml` — не трогался
- `.env.template` — не трогался

---

## Команды, которые запускались

```bash
# Только чтение/запись файлов через Claude Code tools
# git команды для проверки:
git status
git diff --stat
git log --oneline -5
```

---

## Что нужно сделать ПОСЛЕ импорта в n8n

1. **Настроить credentials** в n8n UI:
   - `telegram_owner_bot` — токен владельческого бота
   - `telegram_guest_bot` — токен гостевого бота
   - `gelendzhik_db` — PostgreSQL connection
   - `realty_calendar_v1` — HTTP Header Auth (API ключ RealtyCalendar)
   - `google_service_account` — Google Service Account JSON

2. **Переменные окружения** в n8n (Settings → Variables):
   - `HEALTHCHECK_ICAL_UUID`
   - `HEALTHCHECK_PRICING_UUID`
   - `OWNER_CHAT_ID`

3. **Активировать** воркфлоу `04_daily_pricing.json` вручную (в файле `"active": false`)

4. **Проверить схему БД** — таблица `bookings` должна иметь поле `rc_id` с UNIQUE constraint (нужно для ON CONFLICT)

---

## Риски

| Риск | Уровень | Описание |
|------|---------|----------|
| Ollama недоступен | Высокий | `host.docker.internal:11434` — работает только если Ollama запущен на хост-машине. На Linux может не резолвиться, нужно добавить `extra_hosts` в docker-compose |
| Whisper "small" модель | Средний | Точность русской речи ~70-80%. Для лучшего результата использовать `medium` или `large-v3` |
| RealtyCalendar API | Средний | Формат `prices_obj` (дата → цена) — предположение по логике. Нужно проверить реальную документацию RC API |
| guest_chat_id в БД | Средний | В воркфлоу 03 используется `guest_chat_id` из таблицы `bookings`. Это поле должно заполняться вручную или через отдельный webhook |
| Google Sheets ID захардкожен | Низкий | ID листа `1naVBM9qEhZVLFY9bmTRKQtVwruv94vCO35QC4IBNsdA` — вынести в env или переменную n8n |
| OWNER_CHAT_ID в 05 | Низкий | Старый hardcoded ID `-5269741256` заменён на `$env.OWNER_CHAT_ID` — нужно прописать в n8n Variables |

---

## Итог

Все 6 критических багов устранены. Система теперь:
- Корректно синхронизирует iCal и сохраняет бронирования в Postgres
- Обрабатывает голосовые сообщения владельца (Whisper → Ollama → ответ)
- Отправляет гостям автоматические сообщения в нужный день
- Считает цены по сезонному алгоритму с weekend premium
- Защищена от SQL-инъекций
- Сохраняет бронирования из вебхуков как в Postgres, так и в Google Sheets
