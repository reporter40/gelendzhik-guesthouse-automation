# Перенос боевого контура Mac → netcup (октябрь 2026)

Сервер: netcup `152.53.225.111`, Debian 13, `ssh -i ~/.ssh/netcup -o IdentitiesOnly=yes root@152.53.225.111`.
Каталог: `/opt/gelendzhik` (конфиги — `infrastructure/netcup-gelendzhik/` в репо).
Наружу: тот же Cloudflare-туннель `5837a87f-…` → `owner.aquatoring.ru`. Домен, вебхуки ботов
и адрес Admin API в Vercel **не меняются** — меняется только origin туннеля.

Сосед на сервере: Telegram-мост, gw2, wa-core, vk-core и системный Caddy (80/443).
Контур гостевого дома их не трогает: n8n слушает только `127.0.0.1:5678`, Postgres — только docker-сеть.

## Состояние на 14.10.2026 (до переключения)

| Что | Статус |
|---|---|
| Docker 29.9.0 + compose v5.6.0, автозапуск | ✅ |
| Postgres 16 + n8n **2.19.2** (pinned), `restart: unless-stopped` | ✅ работают |
| Дамп с Мака восстановлен, строки сверены (bookings 47, apartments 4, message_templates 15, pricing_recommendations 4) | ✅ |
| `N8N_ENCRYPTION_KEY` = ключ Мака (env и `/home/node/.n8n/config` совпадают) | ✅ |
| Все процессы сняты с активности до первого старта; список активных — `/opt/gelendzhik/activation_map.tsv` | ✅ |
| WF10 активен **только на netcup для проверки**, `health` с токеном → 200, креды Postgres расшифровываются | ✅ |
| WF02: Whisper → Polza.ai (`patch_wf02_polza_stt.sql`), проверено на копии | ✅ |
| Ночной бэкап 03:30 МСК, 14 дней, `/root/backups/daily`; пробное восстановление в отдельную базу | ✅ |
| cloudflared (профиль `tunnel`) — образ скачан, конфиг и креды на месте, **не запущен** | ⏸ |
| Прогон копий WF01/WF12 | ❌ не выполнен (заблокирован ограничением прав агента) |
| Внешний сторож healthchecks.io | ⏳ нужен аккаунт |
| Копия бэкапа вне сервера | ⏳ ждёт решения |

Активные на Маке процессы (их же включаем на netcup): 01 RC iCal Sync, 02 Owner Bot, 03 Guest Journey,
09 Guest Onboarding, 10 Admin API.

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
