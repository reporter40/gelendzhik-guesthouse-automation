# Перенос боевого контура Mac → netcup (октябрь 2026)

Сервер: netcup `152.53.225.111`, Debian 13, `ssh -i ~/.ssh/netcup -o IdentitiesOnly=yes root@152.53.225.111`.
Каталог: `/opt/gelendzhik` (конфиги — `infrastructure/netcup-gelendzhik/` в репо).
Наружу: тот же Cloudflare-туннель `5837a87f-…` → `owner.aquatoring.ru`. Домен, вебхуки ботов
и адрес Admin API в Vercel **не меняются** — меняется только origin туннеля.

Сосед на сервере: Telegram-мост, gw2, wa-core, vk-core и системный Caddy (80/443).
Контур гостевого дома их не трогает: n8n слушает только `127.0.0.1:5678`, Postgres — только docker-сеть.

## Состояние на 14.10.2026, 16:30 МСК (после переключения)

| Что | Статус | Чем проверено |
|---|---|---|
| Боевой контур на netcup, Мак: n8n остановлен, туннель Мака отключён насовсем (`launchctl disable` + plist переименован) | ✅ | `cloudflared tunnel info` — один коннектор 152.53.225.111 |
| 01, 02, 03, 09, 10 активны; ошибок после 15:02 нет | ✅ | `execution_entity` (независимая приёмка qc-inspector) |
| WF02 голос: Download Voice → Polza STT | ✅ | запуск 3218: голосовое распознано, ответ отправлен |
| WF01 по cron `15,45 * * * *` (не сбивается рестартами) | ✅ | запуск 16:15 на новой версии |
| Admin API + админка Vercel: 16/16 read снаружи, 15/15 write на изолированном тесте | ✅ | `admin_smoke.sh`, `admin_write_smoke.sh`, страницы /bookings /revenue /health |
| Ребут сервера — всё поднялось само | ✅ | ребут 15:01 МСК, бот ответил в 15:02 |
| Ночной бэкап 03:30 МСК, 14 дней; пробное восстановление последнего дампа в отдельную базу | ✅ / первый ночной — 15.10 | `restore_check`: строки совпали, база удалена |
| Копия бэкапов вне сервера: Мак забирает ежедневно в 10:00 (`com.aquatoring.netcup-backup-pull`) | ✅ | запуск через launchd, exit 0 |
| Внешний сторож: GitHub Actions `watchdog` → канал владельца. Расписание GitHub не срабатывало 70+ мин, поэтому Мак запускает его каждые 10 мин (`com.aquatoring.watchdog-kick`, `infrastructure/mac/`) | ✅ | тест-оповещение `telegram ok: True`; запуск из launchd 16:00Z success |
| WF09 (гостевой бот) реальным сообщением на netcup | ⬜ | нужен тест владельца |
| Тестовая бронь через 03 | ⬜ | нужен тест владельца |

Известное: 4 «брони» RC 30.09→01.04.2027 — это заморозка RealtyCalendar (в iCal неотличима от брони); уйдёт на этапе 2.
Прошедшие июльские окна и 3 черновика рекомендаций закрыты 14.10 (причина в журнале аудита), чтобы админка не показывала ложную срочность.

## Переключение (только после «да» Дмитрия)

Переменные для удобства:
```bash
NC="ssh -i ~/.ssh/netcup -o IdentitiesOnly=yes root@152.53.225.111"
```

1. **Мак: остановить обработку.** Контейнер n8n останавливаем целиком (флаги активности в базе Мака
   остаются как есть — это и есть точка отката). Туннель на Маке выгружаем, чтобы он не делил трафик с netcup.
   ```bash
   docker stop gelendzhik-n8n
   launchctl unload ~/Library/LaunchAgents/com.aquatoring.cloudflared.plist
   ```
2. **Финальный дамп и повторное восстановление на netcup.**
   ```bash
   B=~/gelendzhik-guesthouse-automation/infrastructure/backups/2026-10-14_final
   mkdir -p $B && chmod 700 $B
   docker exec gelendzhik-postgres pg_dump -U n8n_user -d n8n_gelendzhik -Fc > $B/n8n_gelendzhik.dump
   scp -i ~/.ssh/netcup -o IdentitiesOnly=yes $B/n8n_gelendzhik.dump root@152.53.225.111:/root/backups/final.dump
   $NC 'cd /opt/gelendzhik && docker compose stop n8n &&
     docker exec gelendzhik-postgres dropdb -U n8n_user n8n_gelendzhik_old 2>/dev/null;
     docker exec gelendzhik-postgres psql -U n8n_user -d postgres -c "ALTER DATABASE n8n_gelendzhik RENAME TO n8n_gelendzhik_old" &&
     docker exec gelendzhik-postgres createdb -U n8n_user n8n_gelendzhik &&
     docker exec -i gelendzhik-postgres pg_restore -U n8n_user -d n8n_gelendzhik --no-owner --exit-on-error < /root/backups/final.dump &&
     docker exec gelendzhik-postgres psql -U n8n_user -d n8n_gelendzhik -c "UPDATE workflow_entity SET active=false, \"activeVersionId\"=NULL" &&
     docker exec -i gelendzhik-postgres psql -U n8n_user -d n8n_gelendzhik -v ON_ERROR_STOP=1 < patch_wf02_polza_stt.sql &&
     docker compose up -d n8n'
   ```
   Сверить число строк Мак ↔ netcup: `bookings`, `apartments`, `message_templates`, `pricing_recommendations`.
3. **Вебхуки ботов.** Адрес остаётся `https://owner.aquatoring.ru/webhook/...` — менять не нужно.
   Проверить `getWebhookInfo` по обоим ботам; решение по `drop_pending_updates` — за Дмитрием.
4. **Запустить туннель на netcup** (с этого момента трафик идёт на netcup):
   ```bash
   $NC 'cd /opt/gelendzhik && docker compose --profile tunnel up -d cloudflared && sleep 10 && docker logs --tail 20 gelendzhik-cloudflared'
   cloudflared tunnel info 5837a87f-a190-4363-8129-88232de199aa   # коннектор должен быть с netcup
   curl -s -o /dev/null -w "%{http_code}\n" https://owner.aquatoring.ru/healthz   # 200
   ```
5. **Включить процессы по одному** (версии — из `activation_map.tsv`), после каждого — рестарт n8n
   и проверка, что остальные активны:
   ```bash
   $NC 'cd /opt/gelendzhik && docker exec gelendzhik-n8n n8n publish:workflow --id=<ID> --versionId=<VERSION> && docker compose restart n8n'
   ```
   Порядок: 10 → 01 → 09 → 02 → 03 (03 последним: пишет гостям).
6. Vercel: менять ничего не нужно (Admin API на том же `owner.aquatoring.ru`). Проверить `/admin`.

## Откат

```bash
# netcup: остановить приём
$NC 'cd /opt/gelendzhik && docker compose stop cloudflared n8n'
# Мак: вернуть как было
launchctl load ~/Library/LaunchAgents/com.aquatoring.cloudflared.plist
docker start gelendzhik-n8n
curl -s localhost:5678/healthz
```
Новые строки, появившиеся на netcup после переключения (`bookings.updated_at`, `conversation_log`,
`pricing_*` позже времени переключения), выгрузить `pg_dump --data-only -t <таблица>` / `COPY` и перенести на Мак.

⚠️ На 14.10 туннель на Маке **не держит соединение** (`cloudflared tunnel info` — нет активных подключений,
снаружи 530). Откат вернёт локальную работу Мака, но внешний доступ через Мак останется таким же сломанным, как сейчас.

## После суток стабильной работы

- остановить контейнеры на Маке (`docker stop gelendzhik-n8n gelendzhik-postgres`);
- выключить автозапуск: `launchctl unload ~/Library/LaunchAgents/com.aquatoring.colima.plist`
  (cloudflared уже выгружен на шаге 1);
- данные на Маке не удалять — резерв.

## Пакет «админка + надёжное расписание» (14.10.2026)

Что входит (`infrastructure/netcup-gelendzhik/deploy_bundle.sh`, один скрипт для теста и боя):
- миграции c23, c34 (одной транзакцией, `psql -1`), удаление 3 кандидатов-заглушек c34 (`c34_remove_placeholders.sql`), c36, c38;
- WF10 Admin API = `workflows/10_admin_api.json` (версия из репо + исправления: лишняя скобка в property_context в 3 запросах,
  `alwaysOutputData` у всех Postgres-узлов + фильтр пустых строк и `{success:true}` в Format-узлах, экранирование кавычек
  в 4 запросах, кандидаты берут `source_id`/`reason` из тела вебхука — раньше всегда было пусто);
- WF01: расписание `15,45 * * * *` вместо «каждые 30 мин» (интервал сбрасывался при каждом рестарте);
- compose: `N8N_GRACEFUL_SHUTDOWN_TIMEOUT=30`, `stop_grace_period: 45s`.

Проверено до боя на изолированном контуре (`test_stack.sh`: свой Postgres в сети gtest-net, боевая база недостижима —
подтверждено расхождением числа шаблонов 14/15): `admin_smoke.sh` 16/16 read, `admin_write_smoke.sh` 15/15 write
(в т.ч. апострофы сохраняются без искажений), vitest admin: 160/161 (1 падение — тест WF02-файла, падает и без пакета).

### Откат пакета
```bash
# WF10 → прежняя боевая версия
docker exec gelendzhik-n8n n8n publish:workflow --id=82575887-be9e-4267-8e8e-2d760de2a986 --versionId=f0e381b9-cc57-4b34-8157-01268bdaba6f
# WF01 → прежняя версия (интервал 30 мин)
docker exec gelendzhik-n8n n8n publish:workflow --id=4a846531ec22acc6 --versionId=4eacbe4b-7a67-432a-a521-8621af645ea0
docker stop -t 40 gelendzhik-n8n && docker compose up -d n8n
```
Схему не откатываем: c34/c38 только добавляют, старые WF10/WF02 берут явные списки колонок.
Данные c34/c38 (когорты, пересчёт 4 рекомендаций) — только из дампа до пакета (`/root/backups/daily/` за 14.10 до 15:40 МСК),
восстанавливать в отдельную базу и переносить выборочно, не поверх боевой.

## Решения этапа 2

- 14.10.2026: домен ссылок выгрузки календарей — `owner.aquatoring.ru` (решение Дмитрия). Площадки забирают iCal со своих серверов, пометка Safe Browsing на aquatoring.ru им не мешает.
- 14.10.2026: проба записи в Avito (даты 20–21.11.2026, согласованы Дмитрием) на архивном объявлении 1229923694:
  `POST /core/v1/accounts/85983062/items/1229923694/bookings` с `{"source":"pms","bookings":[{"date_start":"2026-11-20","date_end":"2026-11-21","type":"manual"}]}` → 200 success;
  снятие тем же методом с `"bookings":[]` → 200 success. Чтения закрытых дат в API нет (GET bookings отдаёт только брони Avito,
  страница объявления с сервера — 439). Заменяет ли запись весь календарь — не подтверждено; пустой список принимается,
  что согласуется с полной заменой. Поэтому WF16 всегда шлёт полный список занятости по объявлению.
  Одно чтение по 7731175501 упало по таймауту 30 с, повтор — успешно: разовый сбой сети Avito.
- 14.10.2026, активное объявление 7731210163 (согласовано Дмитрием, других закрытых дат нет): запись
  `[{"date_start":"2026-11-20","date_end":"2026-11-21","type":"manual"}]` → 200; Дмитрий в приложении Avito: «20 ноября закрыто, 21 свободно» —
  открытый конец периода подтверждён (date_end = день выезда, свободен). Снятие `"bookings":[]` в 20:49 МСК → 200.
