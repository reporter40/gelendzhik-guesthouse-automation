# Развёртывание системы

## Требования
- Ubuntu 22.04/24.04
- Минимум 4GB RAM, 2 vCPU, 40GB SSD
- Домен с DNS A-записью на IP сервера

## Быстрый старт
```bash
cd infrastructure
cp ../.env.template .env
nano .env  # заполнить API ключи
chmod +x setup.sh
sudo ./setup.sh
```

## После запуска
1. http://IP:81 → NPM → добавить домен → SSL Let's Encrypt
2. https://n8n.domain.ru → пройти онбординг
3. n8n → Credentials → добавить Telegram, Claude, PostgreSQL, Google Sheets
4. n8n → Import Workflow → вставить JSON из workflows/
5. Активировать workflows

## Порядок импорта workflows
01_ical_sync.json — основа, запустить первым
02_owner_bot.json — Telegram бот владельца
03_guest_journey.json — воронка гостей
04_daily_pricing.json — ценообразование
05_weekly_report.json — еженедельный отчёт
06_watchdog.json — мониторинг
07_error_handler.json — обработка ошибок
