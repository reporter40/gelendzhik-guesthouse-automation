# Акваторинг — локальная админ-панель (A2)

Next.js App Router + TypeScript + Tailwind + **iron-session**. Данные только через **Admin API** (POST + `X-Admin-Token`), **без** прямого доступа к Postgres и **без** утечки токена в браузер.

## Запуск локально

Из каталога `admin/`:

```bash
npm install
cp .env.example .env.local
# Заполните .env.local (см. ниже). ADMIN_API_TOKEN — из ../infrastructure/.admin_api_token (не коммить).
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) — редирект на `/login` (если не залогинены) или на `/bookings`.

```bash
npm run build   # проверка прод-сборки
npm run start   # после build
```

## Переменные окружения (`admin/.env.local`)

| Переменная | Описание |
|------------|----------|
| `ADMIN_API_URL` | URL webhook Admin API, например `https://owner.aquatoring.ru/webhook/adminapi1234/admin` |
| `ADMIN_API_TOKEN` | Секрет из `infrastructure/.admin_api_token` (совпадает с `system_vars.admin_api_token`). **Только на сервере** — не префикс `NEXT_PUBLIC_`. |
| `ADMIN_PASSWORD` | Локальный пароль для формы входа |
| `SESSION_PASSWORD` | Секрет для шифрования cookie iron-session (**≥ 32 символов**). Альтернатива: `SESSION_SECRET` (тоже ≥ 32). |

Файл `.env.local` **не коммитится**. Токен и пароли не логируются приложением.

## Страницы

| Путь | Назначение |
|------|------------|
| `/` | Редирект: сессия есть → `/bookings`, нет → `/login` |
| `/login` | Форма пароля → httpOnly cookie; доступна даже при stale/invalid cookie |
| `/bookings` | Таблица броней из `action: bookings`, фильтры upcoming / past / all, кнопка копирования guest deep link |
| `/templates` | 15 шаблонов, группировка guest / owner, **read-only** |
| `/health` | Карточки счётчиков из `action: health` |
| `/logout` | GET — сброс сессии, редирект на `/login` |

Защита: редирект **`/`** через server component по **наличию** cookie имени сессии; **`/login`** всегда показывает форму, чтобы stale/invalid cookie не создавал loop; **`requireAuth()`** (iron-session на Node) на `/bookings`, `/templates`, `/health`. Глобального `middleware.ts` нет — чтобы не упираться в Edge/`MIDDLEWARE_INVOCATION_FAILED` на Vercel.

## Read-only

- Брони и шаблоны — только просмотр через Admin API.
- Редактирование шаблонов и т.д. — **этап A4**.

## Деплой на Vercel

Полная инструкция, выбор правильного **Vercel team / имени проекта** и сброс ошибочной привязки: **`VERCEL.md`** в этой же папке. Каталог **`.vercel/`** локальный и уже в **`admin/.gitignore`** — в git не попадает.

## Следующие этапы

- **A3** — деплой фронта на Vercel: задать те же env в проекте Vercel (без `NEXT_PUBLIC_` для токена), проверить cookie `secure` в production.
- **A4** — редактирование шаблонов (после появления безопасного write-API или отдельного workflow).

## Безопасность

- `ADMIN_API_TOKEN` используется только в `lib/adminApi.ts` (server-side `fetch`).
- В HTML и клиентских бандлах токен не встречается при штатной сборке — не добавляйте `NEXT_PUBLIC_*` для секретов.
