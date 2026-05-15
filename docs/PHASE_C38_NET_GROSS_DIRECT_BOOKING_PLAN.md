# Phase C3.8 — Net / Gross Pricing + Direct Booking Strategy

**Дата:** 2026-05-15  
**Статус:** реализовано в коде и workflow (миграция + WF02 / WF10 / WF12 + Admin UI).

## 1. Проблема net / gross

Цены конкурентов и рыночные ориентиры в revenue-движке считаются как **цену, которую видит гость** на площадках (guest-facing / gross для гостя).

В **RealtyCalendar** для канала агрегаторов задаётся **net price**: база «до наценки канала». Агрегатор добавляет свою комиссию / наценку к гостю (в модели проекта по умолчанию **≈18%**).

Если подставить гостевую цель **10&nbsp;230 ₽** напрямую в RC как net, гость на агрегаторе увидит примерно **10&nbsp;230 × 1.18 ≈ 12&nbsp;071 ₽**, что **выше рынка** и ломает смысл рекомендаций.

## 2. Формула агрегатора (модель)

Параметр `aggregator_markup_percent` (например **18**) задаёт долю наценки **поверх net**:

\[
\text{guest\_price} \approx \text{rc\_net\_price} \times \Bigl(1 + \frac{\text{aggregator\_markup\_percent}}{100}\Bigr)
\]

Обратное преобразование от цели для гостя к net:

\[
\text{rc\_net\_price} = \operatorname{round}\Bigl(\frac{\text{recommended\_guest\_price}}{1 + \frac{\text{aggregator\_markup\_percent}}{100}}\Bigr)
\]

Контрольное восстановление «ожидаемой цены гостя на агрегаторе» после округления net:

\[
\text{expected\_aggregator\_guest\_price} = \operatorname{round}\bigl(\text{rc\_net\_price} \times (1 + \frac{\text{markup}}{100})\bigr)
\]

## 3. Почему market price ≠ RealtyCalendar price

- **Market / медиана конкурентов** → гость на OTА / сайте конкурента.  
- **RC net** → входная ставка для календаря под агрегатор; итог для гостя = net × (1 + markup).

Рекомендация «держаться рынка» формулируется в плоскости **гостя**; в RC нужно выставлять **net**, чтобы после наценки канала получить ту же ординату.

## 4. Поля данных

| Поле | Смысл |
|------|--------|
| `recommended_price` | Совместимость: **guest-facing цель** (как раньше). |
| `recommended_guest_price` | Явная цель для гостя (= прежняя логика рекомендации). |
| `rc_net_price` | Что выставлять в RealtyCalendar (net под агрегатор). |
| `aggregator_markup_percent` | Доля наценки канала на этом расчёте (snapshot). |
| `expected_aggregator_guest_price` | Ожидаемая цена гостя после наценки при данном net. |
| `direct_price` | Прямая продажа без посредника: скидка от гостевой цели (`direct_discount_percent`). |
| `direct_savings_for_guest` | Экономия гостя vs агрегатор: `expected_aggregator_guest_price − direct_price`. |
| `direct_owner_gain` | Доп. выручка владельца при прямой продаже vs канал: `direct_price − rc_net_price`. |
| `pricing_channel` | Экономика канала (`aggregator_adjusted` по умолчанию). |

## 5. Прямая продажа (direct)

\[
\text{direct\_price} = \operatorname{round}\bigl(\text{recommended\_guest\_price} \times (1 - \frac{\text{direct\_discount\_percent}}{100})\bigr)
\]

Параметры в `system_vars`: `direct_discount_percent` (например **3** или **5**), `direct_booking_enabled` — флаг для будущих автоматизаций / UX.

## 6. Объект №50 (пример)

При `recommended_guest_price = 10 230`, markup **18%**, скидка прямой **5%**:

| Величина | Значение |
|----------|----------|
| `rc_net_price` | ≈ **8 670** |
| `expected_aggregator_guest_price` | ≈ **10 231** |
| `direct_price` | ≈ **9 719** |
| `direct_savings_for_guest` | ≈ **512** |
| `direct_owner_gain` | ≈ **1 049** |

Текст reason дополняется пояснением вида:  
*«Цена 10 230 ₽ — ориентир для гостя. Для RealtyCalendar с учётом 18% наценки агрегатора рекомендуется поставить 8 670 ₽.»*

## 7. Экспорт в RC (`pricing_recommendation_export_rc`)

- `prices_obj` заполняется **net** (`rc_net_price`), если колонка есть; иначе fallback на legacy `recommended_price`.  
- Ответ API включает блок guest / net / direct для прозрачности.

## 8. Стратегия прямых продаж

- Позиционировать прямую цену как **выгоднее для гостя** при сохранении **лучшего net для владельца**, без автоматической отправки сообщений.  
- CTA «Сгенерировать предложение» / «Скопировать текст для Telegram» — **заглушки** до отдельной фазы.

## 9. Запреты Phase C3.8

Не выполнялись и не входят в scope: запись в RealtyCalendar, изменение реальных цен/закрытие дат, webhooks Telegram, DNS Cloudflare, `message_templates`, деструктивные миграции, активация workflow 13.
