# Launch Pack — Direct Booking Channel (0 ₽)

Цель: запустить органический канал прямых лидов без агрегаторов
(Booking 18%, Airbnb 15%, Avito 6%) → твои 4 двора с двориками.

Время на setup владельца: **30-40 минут** (4 SMS-OTP + копипаст из файлов).
Дальше — автопостер (workflow 15 в n8n).

---

## Шаг 1 — Telegram-канал (5 минут)

1. Telegram → меню → **Создать канал** → публичный.
2. **Имя:** `Курзальная 40 — Геленджик у моря`
3. **@username:** `@kurzal40` (если занят: `@kurzal40_gelen`, `@dmitriy_gelendzhik`)
4. **Описание:** скопировать из `BIO.md`.
5. **Аватар:** твой логотип / фото дома (есть в `marketing/icon` если что).
6. **Закреп:** скопировать из `PINNED.md`.

Когда создашь — пришли мне `@username` канала, добавлю его в workflow 15
для автопостинга.

## Шаг 2 — Яндекс.Бизнес (10 минут)

1. `https://yandex.ru/sprav/add` → SMS-OTP.
2. Заполнить из `YANDEX_BUSINESS.md` — все поля скопированы.
3. Загрузить 10 фото (см. `PHOTO_CHECKLIST.md`).
4. Категория: **Гостевой дом**.
5. После модерации (1-3 дня) карточка появится в Яндекс.Картах и
   поиске «гостевой дом Геленджик».

## Шаг 3 — 2GIS (10 минут)

1. `https://account.2gis.ru/add-org` → SMS-OTP.
2. Из `2GIS_BUSINESS.md`.
3. Те же фото.
4. Модерация 1-2 дня.

## Шаг 4 — Google Business Profile (10 минут + postcard ~14 дней)

1. `https://business.google.com` → создать.
2. Из `GOOGLE_BUSINESS.md`.
3. Verification — Google пришлёт открытку с кодом на физический адрес
   Курзальная 40 (~10-14 дней). Без неё карточка не активна.
4. Если нужно ускорить — Phone Verification (Google иногда даёт).

---

## Шаг 5 — что делает за тебя система

После того как канал создан + ты прислал `@username`:

- **Workflow 15 (Content Autopost):** 3 раза/неделю генерит и постит пост.
- 20 готовых черновиков в `posts/` как стартовая база.
- UTM-схема в `UTM_PLAN.md` — каждый канал отдельный source.
- Admin dashboard → revenue/conversion по каналам.

## UTM-схема

Все ссылки идут на `${DIRECT_BOOKING_URL}` из `.env` + параметры:

| Канал | utm_source | utm_medium |
|-------|------------|------------|
| Свой TG-канал | tg_own | channel |
| Закуп в чужих TG | tg_partner | post |
| Яндекс.Карты | yandex_maps | listing |
| 2GIS | 2gis | listing |
| Google Maps | google_maps | listing |
| VK-группы | vk | comment |
| Сарафан (бот) | guest_referral | bot |

Ready URL-list в `UTM_PLAN.md`.
