# Адаптация под нового клиента (15 минут)

## Что получить от клиента
1. RC agency_id + API-токен + iCal URLs
2. Объекты: название, цена, вместимость
3. 2 Telegram-бота (токены от @BotFather) + chat_id
4. Claude API ключ (console.anthropic.com)
5. Google Service Account JSON
6. Имя, адрес, стиль общения
7. Местные рестораны, пляжи, маршруты

## Что заменить
1. .env — все токены и ID (3 мин)
2. ai/prompts/*.txt — имя, адрес, объекты (3 мин)
3. ai/pricing/seasons_*.json — цены, коэффициенты (3 мин)
4. database/init.sql — INSERT apartments (2 мин)
5. knowledge_base/*.csv — местные данные (5 мин)

## Запуск
```bash
sudo infrastructure/setup.sh
# Импорт workflows → Credentials → Activate
```
