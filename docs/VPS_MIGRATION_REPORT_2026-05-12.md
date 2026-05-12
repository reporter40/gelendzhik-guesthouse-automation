# VPS Migration Report — 2026-05-12

## Summary

Backend-контур (PostgreSQL, n8n, Cloudflare Tunnel, Admin API) успешно перенесён с локального Mac на Hetzner VPS.

---

## VPS Details

| Parameter | Value |
|---|---|
| IP | 178.105.139.57 |
| Hostname | aquatoring-prod-01 |
| OS | Ubuntu 24.04 LTS |
| Location | Nuremberg (NBG1) |
| Plan | CX23 (2 vCPU, 4 GB RAM, 40 GB SSD) |
| Project path | `/opt/gelendzhik-guesthouse-automation` |

---

## Installed Software

| Software | Version |
|---|---|
| Docker | 29.4.3 |
| Docker Compose plugin | v5.1.3 |
| cloudflared | 2026.3.0 |

---

## Service Status (post-migration)

| Service | Container / Unit | Status |
|---|---|---|
| PostgreSQL 16 | gelendzhik-postgres | Up, healthy |
| n8n latest | gelendzhik-n8n | Up, port 5678 |
| Cloudflare Tunnel | cloudflared.service (systemd) | active (running), 4 connections registered |

---

## Verification Results

| Check | Result |
|---|---|
| `owner.aquatoring.ru/rest/login` | HTTP 401 (expected — n8n alive) |
| Admin API health | HTTP 200, `ok=true` |
| bookings count | 19 |
| templates count | 15 |
| `admin.aquatoring.ru/health` | HTTP 307 → /login (expected) |
| `admin.aquatoring.ru/bookings` | HTTP 307 → /login (expected) |
| `admin.aquatoring.ru/templates` | HTTP 307 → /login (expected) |

---

## What Was NOT Changed

- Mac n8n и Postgres — не выключались, продолжают работать
- Workflows 01/02/03/09/10 — не изменялись
- Telegram webhooks — не менялись
- Cloudflare DNS — не менялся (туннель `gelendzhik-owner-n8n` переиспользован)
- Vercel frontend (`admin.aquatoring.ru`) — не изменялся
- PostgreSQL schema — не менялась
- `message_templates` — не трогались
- `.env` и credentials — не раскрывались в логах

---

## Operational Commands

### Проверка VPS (containers + cloudflared)
```bash
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
  'docker ps && systemctl status cloudflared --no-pager -l'
```

### Проверка n8n через туннель
```bash
curl -I https://owner.aquatoring.ru/rest/login
```

### Проверка Admin API health
```bash
cd /Users/Orlova/gelendzhik-guesthouse-automation
curl -sS -i \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $(cat infrastructure/.admin_api_token)" \
  -d '{"action":"health"}' \
  https://owner.aquatoring.ru/webhook/adminapi1234/admin
```

### Логи cloudflared
```bash
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
  'journalctl -u cloudflared -n 120 --no-pager'
```

### Логи n8n
```bash
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
  'cd /opt/gelendzhik-guesthouse-automation/infrastructure && docker compose logs --tail=120 n8n'
```

### Логи Postgres
```bash
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
  'cd /opt/gelendzhik-guesthouse-automation/infrastructure && docker compose logs --tail=120 postgres'
```

### Перезапуск backend
```bash
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
  'cd /opt/gelendzhik-guesthouse-automation/infrastructure && docker compose up -d postgres n8n && systemctl restart cloudflared'
```

---

## Next Safe Steps

1. Вручную войти в https://admin.aquatoring.ru и убедиться, что после логина отображаются страницы `/health`, `/bookings`, `/templates` с реальными данными.
2. После **24 часов стабильной работы** VPS-контура — остановить Mac cloudflared и локальные production-контейнеры, если они больше не нужны.
3. **Не удалять** Mac backup (`infrastructure/backups/migration_20260511_104306`).
4. **Не удалять** локальную копию проекта на Mac.

---

## SSH Key for VPS

```
~/.ssh/aquatoring_prod_hetzner  (passphrase-free, for VPS only)
```

Public key fingerprint: `SHA256:2hH1hEfKQORUKNs6rLtcKJ/ELJ1F2vLxAh67rNWqsZk`
