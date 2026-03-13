# n8n Workflows
Импорт: n8n → + → ⋮ → Import from JSON → вставить содержимое файла → Save

## Файлы
| # | Файл | Назначение |
| :--- | :--- | :--- |
| 01 | 01_ical_sync.json | Синхронизация iCal каждые 30 мин |
| 02 | 02_owner_bot.json | Telegram бот владельца (голос + Claude) |
| 03 | 03_guest_journey.json | 7 точек касания с гостем |
| 04 | 04_daily_pricing.json | Пересчёт цен ежедневно 06:00 |
| 05 | 05_weekly_report.json | Дайджест каждое воскресенье 20:00 |
| 06 | 06_watchdog.json | Мониторинг здоровья системы |
| 07 | 07_error_handler.json | Глобальный обработчик ошибок |

## После импорта
1. Открыть каждый node с ⚠️
2. Привязать Credentials (Telegram, PostgreSQL, Claude, Sheets)
3. Заменить плейсхолдеры (OWNER_CHAT_ID и т.д.)
4. Активировать (переключатель Active вверху справа)
