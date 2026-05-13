# Деплой админки на Vercel (Акваторинг / Gelendzhik guesthouse)

## Scope и team в Vercel

Это **отдельное приложение** репозитория `gelendzhik-guesthouse-automation` — локальная **Next.js-админка** для дома «Акваторинг» (Admin API `owner.aquatoring.ru`).

- Деплоить нужно только в **тот Vercel Team / аккаунт**, который относится к **этому** проекту.
- Если `npx vercel deploy` отправляет сборку под **«arenaborba»** или другое имя проекта без отношения к гостевому дому — значит локально уже был **`vercel link`** в эту связку CLI. На git это **не распространяется**: каталог **`admin/.vercel/`** в `.gitignore` и **не попадает** в репозиторий.
- После любого **`git clone`** линка **нет** заводского; ошибочный проект связан только **на машине**, где ты когда-то связал этот же каталог с чужим team.

## Правильная привязка (первая настройка или сброс)

Из каталога **`admin/`**:

1. **Сбросить локальную привязку** (если она указала не тот team/project):

   ```bash
   rm -rf .vercel
   ```

2. Войти в нужный аккаунт Vercel (если нужно):

   ```bash
   npx vercel@latest login
   ```

3. **Создать/выбрать проект явно:**

   ```bash
   npx vercel@latest link
   ```

   - Выбери **Scope / Team**, который ты используешь для **Aquatoring / этого гостевого дома**.
   - Имя проекта логично задать вроде **`aquatoring-admin`** или **`gelendzhik-admin`**, чтобы не путать с другими приложениями (напр. Arenaborba).

4. Продакшен:

   ```bash
   npm run build
   npx vercel@latest deploy --prod --yes
   ```

**В монорепозитории с Git-подключением к Vercel:** в UI задай **Root Directory** = **`admin`** (эта папка — корень приложения Next.js).

---

## Переменные окружения (имена только; значения только в Dashboard)

[Vercel → Project → Settings → Environment Variables → Production]

- `ADMIN_API_URL`
- `ADMIN_API_TOKEN`
- `ADMIN_PASSWORD`
- `SESSION_PASSWORD` или `SESSION_SECRET` (≥ 32 символов)

Значения как у локального `admin/.env.local`; файл **никогда не коммитится**.

Без них страницы с вызовом Admin API упадут или будут без данных.

---

## Без middleware на Edge (`MIDDLEWARE_INVOCATION_FAILED`)

Файла **`middleware.ts` нет** — редиректы и вход:

- **`/`** — `app/page.tsx`
- **`/login`** — форма всегда доступна; `app/login/layout.tsx` не редиректит по cookie presence
- **`/bookings`**, **`/templates`**, **`/health`** — `requireAuth()` (iron-session на Node)

Имя cookie: **`lib/session-cookie.ts`** = **`lib/session-config.ts`** для iron-session. Stale/invalid cookie очищается через `/logout` или новым успешным логином.

---

## Свой домен (напр. admin.aquatoring.ru)

В настройках проекта Vercel → **Domains**; в DNS провайдере записи как покажет Vercel.
