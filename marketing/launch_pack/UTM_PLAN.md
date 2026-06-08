# UTM-схема для трекинга прямых лидов

База: `https://realtycalendar.ru/booking/79366`

## Готовые ссылки (копипаст)

| Источник | Ссылка |
|----------|--------|
| Свой TG-канал (закреп) | `https://realtycalendar.ru/booking/79366?utm_source=tg_own&utm_medium=pinned` |
| Свой TG-канал (пост) | `https://realtycalendar.ru/booking/79366?utm_source=tg_own&utm_medium=channel&utm_campaign=auto` |
| Telegram-партнёр (закуп) | `https://realtycalendar.ru/booking/79366?utm_source=tg_partner&utm_medium=post&utm_campaign=ПАРТНЁР` |
| Яндекс.Карты | `https://realtycalendar.ru/booking/79366?utm_source=yandex_maps&utm_medium=listing` |
| 2GIS | `https://realtycalendar.ru/booking/79366?utm_source=2gis&utm_medium=listing` |
| Google Maps | `https://realtycalendar.ru/booking/79366?utm_source=google_maps&utm_medium=listing` |
| VK-группа (комментарий) | `https://realtycalendar.ru/booking/79366?utm_source=vk&utm_medium=comment&utm_campaign=НАЗВАНИЕ_ГРУППЫ` |
| Сарафан через бота | `https://realtycalendar.ru/booking/79366?utm_source=guest_referral&utm_medium=bot&utm_campaign=СНОВА10` |

## Конвенция

- `utm_source` — где разместили ссылку (где гость её увидел).
- `utm_medium` — формат (post, listing, comment, bot).
- `utm_campaign` — детали (название группы, акция, дата).
- `utm_content` — для A/B (две картинки одной кампании).

## Как читать в admin dashboard

После того как RC начнёт ловить UTM:
- `admin.aquatoring.ru/revenue` → группировка по utm_source.
- Сводка в Telegram-боте: «За неделю TG-канал дал 4 брони (12К ₽ комиссии не отдано Booking)».

## Что считается прямой бронью

Любая, где `utm_source != ''` И НЕ `aggregator`, `booking_com`, `airbnb`,
`avito_sutochno`. См. `admin/lib/direct-offer-from-recommendation.ts`.
