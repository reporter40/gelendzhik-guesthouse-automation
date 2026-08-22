# Referral Funnel Runbook (D2)

Операционное руководство для **ручного** referral-контура в админке `/revenue`.  
Эпик D2 закрыт документацией; автоматизация ссылок, трекинга, выплат и бронирований **не входит** в scope.

---

## Purpose

Дать администратору воспроизводимый процесс:

1. Проверить, что referral economics по строке рекомендации **экономически допустима**.
2. Отправить **текст-приглашение** бывшему гостю (вручную, без автоссылок).
3. **Зафиксировать** потенциальный referral lead в audit log.
4. **Найти, отфильтровать и экспортировать** referral leads для внутренней работы.

Все шаги — в существующем UI и audit log; без новой таблицы и без CRM.

---

## What this feature does

| Capability | Where |
|------------|--------|
| Расчёт referral economics (5% reward, 5% guest discount vs market) | `admin/lib/referral-direct-economics.ts` → preview на строке |
| Internal finance preview | `ReferralEconomicsPreview` под Direct Offer |
| Copy draft для **бывшего** гостя (Telegram / WhatsApp / Short) | `ReferralOfferCopyPanel` |
| Ручная запись referral lead | `ManualReferralLeadPanel` → Admin API `manual_referral_lead` |
| Audit viewer + summary | `RevenueAuditLogTable`, `ApprovalsPanel` журнал |
| Фильтры audit + KPI | All / Referral leads / Property context / Other |
| Export referral leads | Copy / Download CSV, Copy TSV |
| Deep link + scroll | `/revenue?auditFilter=referral` → фильтр + `#audit-log` |

**Отдельно от D1:** Direct Offer (D1.x) — текст для **нового** гостя; referral copy не смешивается с `generateDirectOffer` и D1.9 presets.

---

## What this feature does NOT do

- Does **not** create referral links or short URLs.
- Does **not** create referral codes or coupons.
- Does **not** track clicks or opens.
- Does **not** track bookings automatically.
- Does **not** automate payouts to former guests.
- Does **not** create or confirm bookings.
- Does **not** change RealtyCalendar export or `rc_net_price` formulas in workflows.
- Does **not** change core pricing formulas (`direct_price`, WF12 calculate).
- Does **not** replace accounting, tax, or legal payout process.
- Does **not** act as CRM (no statuses, pipelines, reminders).

---

## Business economics

Исходные поля строки рекомендации (для market):

- `expected_aggregator_guest_price` → иначе `recommended_guest_price` → `recommended_price` → `market_median`
- `rc_net_price` — net для сравнения с агрегатором

Параметры по умолчанию:

- `referral_commission_rate` = 0.05 (5% бывшему гостю от суммы брони по рекомендации)
- `direct_discount_rate` = 0.05 (5% скидка новому гостю vs market)

**Формулы** (`calculateReferralDirectEconomics`):

```
referralPrice              = round(marketGuestPrice × (1 − 0.05))
referralReward             = round(referralPrice × 0.05)
referralOwnerNet           = referralPrice − referralReward
referralGuestSavings       = marketGuestPrice − referralPrice
referralOwnerGainVsAggregator = referralOwnerNet − rcNetPrice
```

**Не использовать** `referralPrice = direct_price / 0.95` — это поднимает цену почти до market и убивает скидку гостю.

### Пример (1 ночь)

| Поле | Значение |
|------|----------|
| marketGuestPrice | 10 000 ₽ |
| rc_net_price | 8 475 ₽ |
| referralPrice | 9 500 ₽ |
| referralReward | 475 ₽ |
| referralOwnerNet | 9 025 ₽ |
| referralGuestSavings | 500 ₽ |
| referralOwnerGainVsAggregator | 550 ₽ |

Условия **valid** preview (все должны выполняться):

- `referralPrice < marketGuestPrice`
- `referralOwnerNet > rc_net_price`
- `referralReward > 0`
- `referralGuestSavings > 0`

Иначе preview показывает warnings; copy panel и log panel для строки **не показываются** (только economics preview с предупреждением).

---

## Admin workflow

1. Открыть **`/revenue`** (нужен вход в admin).
2. В таблице рекомендаций найти строку с **`direct_price > 0`** и валидной referral economics.
3. Раскрыть блок под строкой → проверить **«Referral economics · internal»** (цены, reward, gain vs aggregator).
4. В блоке **«Referral invitation · for former guest»** скопировать Telegram / WhatsApp / Short.
5. **Вручную** отправить текст бывшему гостю (мессенджер на усмотрение; API Telegram/WhatsApp не подключены).
6. Если есть конкретная рекомендация (кто кого) — раскрыть **«Log manual referral»**.
7. Заполнить: referrer (имя или контакт), referred guest (имя или контакт), notes (опционально).
8. Нажать **Save referral lead** → ожидать *«Referral lead saved to audit log.»*
9. Прокрутить к секции **«Экспорт и аудит действий»** (или открыть deep link ниже).
10. В audit UI выбрать фильтр **Referral leads** или открыть `/revenue?auditFilter=referral`.
11. Проверить summary вида `Referral lead: … → …, reward …`.
12. При необходимости **Copy referral CSV** / **Download referral CSV** (все referral leads из загруженного лога, не только текущий фильтр таблицы рекомендаций).

---

## UI locations

| UI block | Path / condition |
|----------|------------------|
| Referral economics preview | `/revenue` → строка с `direct_price > 0` |
| Referral invitation copy | Только при `isReferralEconomicallyValid` |
| Log manual referral | Только при valid economics |
| Audit log + filters | `/revenue` → «Экспорт и аудит действий» (`#audit-log`) |
| Журнал в таблице рекомендаций | `ApprovalsPanel` — краткий summary + бейдж `↗ referral` |

---

## Audit log events

Запись создаётся через Admin API:

- **Request:** `action: manual_referral_lead`, `mode: save`
- **Audit row:** `action` / `reason`: `manual_referral_lead_logged`
- **actor:** `admin_api`
- **source:** `admin_panel`
- **recommendation_id:** `NULL` (не выдумывается)
- **apartment_id / date_from / date_to:** из payload, если есть

**metadata** (jsonb):

| Field | Description |
|-------|-------------|
| `event_type` | `manual_referral_lead` |
| `economics_available` | `true` / `false` |
| `referrer_name` / `referrer_contact` | Кто рекомендует |
| `referred_guest_name` / `referred_guest_contact` | Кого рекомендуют |
| `apartment_id` / `apartment_name` | Контекст объекта |
| `date_from` / `date_to` | Период рекомендации |
| `referral_price` | При `economics_available` |
| `referral_reward` | Ориентир reward |
| `referral_owner_net` | |
| `referral_guest_savings` | |
| `referral_owner_gain_vs_aggregator` | |
| `notes` | Свободный текст |

Просмотр: фильтр **Referral leads**, collapsible details, export CSV.

---

## Export workflow

1. Убедиться, что в audit log есть записи `manual_referral_lead_logged` (KPI **Referral leads: N** > 0).
2. В панели над audit-таблицей:
   - **Copy referral CSV** — в буфер обмена
   - **Download referral CSV** — файл `referral-leads-YYYY-MM-DD.csv`
   - **Copy referral TSV** — tab-separated для Excel
3. Export берёт **все** referral leads из текущей загрузки audit API (~50 последних записей), независимо от активного фильтра таблицы.

Колонки CSV: `created_at`, `referrer`, `referrer_contact`, `referred_guest`, `referred_guest_contact`, `apartment_id`, `apartment_name`, `date_from`, `date_to`, `referral_price`, `referral_reward`, `referral_owner_net`, `referral_guest_savings`, `referral_owner_gain_vs_aggregator`, `notes`.

---

## Deep links

| URL | Behavior |
|-----|----------|
| `/revenue` | Обычная страница, фильтр All |
| `/revenue?auditFilter=referral` | Фильтр Referral leads + smooth scroll к `#audit-log` |
| `/revenue?auditFilter=property_context` | Фильтр PCS |
| `/revenue?auditFilter=other` | Прочие события |
| `/revenue?auditFilter=unknown` | Invalid → All, scroll всё равно к audit |

Алиасы: `referral` ≡ `referral_leads`. При смене фильтра кнопками URL обновляется через `router.replace` без reload.

---

## Safety boundaries

- **Pricing / RC:** WF12, `direct_price`, `rc_net_price`, RC export — не менялись в D2.
- **Guest-facing direct offer:** D1.9 presets и `generateDirectOffer` — не менялись.
- **No auto payout:** Reward в UI — ориентир; выплата вне системы.
- **No PII automation:** Контакты только то, что ввёл администратор вручную.
- **Audit only storage:** Нет отдельной таблицы `referral_leads`; только `pricing_action_audit_log`.
- **Invalid economics:** Нельзя сохранить lead через UI без valid economics (API всё же принимает save без economics fields при ручном API-call).

---

## Local verification

```bash
cd admin
npm run test    # ожидаемо >= 161 passed
npm run build   # successful
npm run dev
```

**UI checks:**

- http://localhost:3000/revenue — строка с direct price → referral blocks
- http://localhost:3000/revenue?auditFilter=referral — scroll к audit + фильтр Referral leads
- Save referral lead → запись в audit
- Copy/Download CSV при N > 0

**Gate:** tests ≥ 161, build successful.

---

## Deploy checklist

- [ ] `cd admin && npm run test && npm run build` green on target branch
- [ ] Admin app deployed (Vercel / host)
- [ ] **WF10** (`workflows/10_admin_api.json`) deployed in n8n, если `manual_referral_lead` ещё не на проде (D2.3)
- [ ] `ADMIN_API_URL` + `ADMIN_API_TOKEN` в env admin
- [ ] `/revenue` loads, audit log returns `metadata` on entries
- [ ] `manual_referral_lead` save returns `{ ok: true, audit_recorded: true }`
- [ ] Referral CSV copy/download works in browser (secure context for clipboard)

---

## Known limitations

- Audit API отдаёт **последние ~50** записей — старые referral leads могут не попасть в export.
- Export и фильтры — **client-side** только по загруженным данным.
- Нет статусов lead (new / paid / booked).
- Нет напоминаний и нет связи с реальной бронью в RC.
- Deep link scroll — один раз при mount; не при каждом клике фильтра.
- Пустой audit log: deep link scroll работает (`AuditDeepLinkScroll`), copy panel referral — нет строк рекомендаций.

---

## Next possible increments (D3+)

Не входят в D2; идеи для следующих эпох:

| ID | Idea |
|----|------|
| D3.0 | Закрытие эпика D2 в release notes + ссылка на этот runbook в HANDOFF |
| D3.1 | Dashboard widget: «последние 3 referral leads» (read-only из audit) |
| D3.2 | Payout checklist (manual statuses **вне** audit, или отдельный doc) |
| D3.3 | Шаблон сообщения для **нового** гостя по referral (отдельно от D1 Direct Offer) |

**Не планировать в ближайшем scope:** referral URLs, webhook tracking, автоматические выплаты, booking engine.

---

## Code map (D2.0–D2.8)

| Sprint | Main artifacts |
|--------|----------------|
| D2.0 | `admin/lib/referral-direct-economics.ts` |
| D2.1 | `ReferralEconomicsPreview.tsx` |
| D2.2 | `referral-offer-generator.ts`, `ReferralOfferCopyPanel.tsx` |
| D2.3 | `manual-referral-lead.ts`, WF10 `manual_referral_lead`, `ManualReferralLeadPanel` |
| D2.4 | `audit-metadata.ts` (MRL viewer) |
| D2.5 | `audit-log-summary.ts`, filters in `RevenueAuditLogTable` |
| D2.6 | `referral-lead-export.ts` |
| D2.7 | `parseAuditFilter`, URL sync |
| D2.8 | `scrollToAuditLogAnchor`, `AuditDeepLinkScroll` |

---

*Last updated: D2.9 — Referral Funnel Runbook.*
