# 🏠 Guesthouse AI Automation System

**Персональная AI-система управления гостевым домом на открытом коде.**

Self-hosted · n8n 2.x + Claude API + PostgreSQL + Qdrant · ~750-1300₽/мес вместо 8000-25000₽

## Что умеет система

- 🤖 AI-консьерж 24/7 для гостей (Telegram/WhatsApp)
- 🎤 Голосовое управление для владельца через Telegram
- 📅 Синхронизация занятости с RealtyCalendar каждые 30 мин
- 💰 Динамическое ценообразование (сезоны, праздники, выходные, загрузка)
- 📬 Автоматическая воронка гостя: 7 точек касания
- 📊 Еженедельные AI-отчёты с инсайтами
- 🔔 Мониторинг и алерты при сбоях
- 🏷️ Допродажи: SUP, дайвинг, видеофильм

## Быстрый старт (15 минут)

```bash
git clone https://github.com/YOUR_USER/gelendzhik-guesthouse-automation.git
cd gelendzhik-guesthouse-automation/infrastructure
cp ../.env.template .env
nano .env  # заполнить свои данные
cd ..
chmod +x infrastructure/setup.sh
sudo infrastructure/setup.sh
```

## Структура
- `infrastructure/`: Docker Compose, setup скрипт, env шаблон
- `database/`: PostgreSQL схема, бэкап скрипт
- `workflows/`: n8n JSON workflows (импорт в 1 клик)
- `ai/prompts/`: Системные промпты AI-агентов
- `ai/pricing/`: Алгоритм динамических цен
- `knowledge_base/`: Рестораны, пляжи, маршруты (CSV)
- `google_sheets/`: Формулы для дашборда
- `marketing/`: Шаблоны постов, виджет бронирования
- `docs/`: Документация
- `client_onboarding/`: Пакет тиражирования для клиентов

## Стек
| Компонент | Технология | Лицензия | Стоимость |
| :--- | :--- | :--- | :--- |
| Оркестратор | n8n 2.x | Fair-code | $0 (self-hosted) |
| AI основной | Claude Sonnet 4.6 | Proprietary | $3-8/мес |
| AI резерв | Ollama | MIT | $0 |
| БД | PostgreSQL 16 | BSD | $0 |
| Вектора | Qdrant | Apache 2.0 | $0 |
| Голос | Whisper ASR | MIT | $0 |
| Интерфейс | Telegram Bot API | — | $0 |
| WhatsApp | Evolution API | MIT | $0 |

## Документация
- [Развёртывание](docs/DEPLOYMENT.md)
- [Адаптация под клиента](docs/CUSTOMIZATION.md)
- [Настройка RealtyCalendar](docs/RC_SETUP.md)
- [Тарифы тиражирования](docs/PRICING_TIERS.md)

## Лицензия
- n8n workflows (JSON): собственность автора
- Инфраструктура: на основе открытых компонентов
- n8n платформа: fair-code (бесплатно для personal/business use)
- Для SaaS-тиражирования: использовать Activepieces (MIT)

Создано для гостевого дома «Курзальная 40», Геленджик. RC #79366 · Дмитрий Мартышенко
