# n8n 3.x: совместимость и безопасный порядок перехода

Дата статической проверки: 2 ноября 2026  
Проверенный commit: a78416212cc4d22b6f4f2d32258cc6799c676167  
Production: версия и состояние контейнера не подтверждены. В репозитории нет runtime-вывода или image digest. Упоминание n8n 2.20.6 в N8N_WORKFLOW_SAFE_DEPLOY.md описывает старое поведение импорта, а не текущую версию.

## Результат аудита экспорта

Проверены 15 нумерованных workflow, smoke-test, test-import, пять сохранённых копий owner-bot, копия revenue notifications, основной и WhatsApp Compose, setup script, .env template, backup script и deployment docs.

В проверенных workflow JSON не найдено узлов, удаляемых в v3: Function, Function Item, Item Lists, Cron, Interval, legacy OpenAI, LangChain Code, старые AI Agent modes, HTML Extract, iCalendar, старых binary file nodes, Workflow Trigger или AI Transform. Расписания используют Schedule Trigger. Это статический результат по репозиторию, а не подтверждение production-состояния, credentials или фактического выполнения. Production может иметь дополнительные workflow, настройки и community nodes.

Compose запускает n8n в Docker с PostgreSQL, имеет один n8n container, без Redis/worker/queue mode. Изменение ручных запусков в queue mode относится к этой конфигурации только если production отличается от репозитория.

| Область | Наблюдение и проверка |
|---|---|
| Бронирования, workflow 01 | iCal HTTP → Code parse/expand → PostgreSQL upsert. HTTP и upsert продолжают regular output при ошибке; проверить, что частичный сбой не выглядит как успешная синхронизация, и повторный запуск не создаёт дубли/пропуски. |
| Голос владельца, workflow 02 | Telegram voice → HTTP/Whisper и AI → Code → Telegram reply. Проверить binary data в filesystem режиме, размер voice-файла, ответ при сбое Whisper/AI и повторную доставку. |
| Сообщения, workflows 03/08/09 | Schedule Trigger, отправки Telegram, webhooks, запись статусов. Проверить таймзону Europe/Moscow, идемпотентность и порядок отправки/записи статуса. Только тестовый chat и webhook. |
| Цена, workflows 04/12/14 | Daily Pricing обновляет RealtyCalendar через HTTP; Pricing Recommender пишет рекомендации в PostgreSQL; Revenue Notifications отправляет сводку. В staging подменить внешний endpoint, сравнить контрольный расчёт и убедиться, что тест не меняет реальные цены. |
| Ошибки, workflow 07 и continue-on-error nodes | Проверить запись error execution, запуск Error Trigger и уведомление владельцу; отдельно сверить ошибки, продолжающие regular output, с ожидаемыми статусами. |
| Code node | Код использует циклы по данным, но не видно долгих сетевых вызовов внутри Code. В v3 таймаут task runner по умолчанию падает с 300 до 60 секунд. Замерить длительность на максимальном ожидаемом объёме; не менять лимит без измерения. |
| Binary storage | Workflow 02 принимает аудио. Compose монтирует named volume n8n_data в /home/node/.n8n и не задаёт режим binary явно. Проверить фактическое значение и свободное место. При режиме default v3 переводит данные на filesystem; также проверить переименование binaryData в storage. |
| Security/credentials | Compose задаёт master N8N_ENCRYPTION_KEY. В workflow JSON не видно community nodes. Проверить Migration Report и инстансные настройки. В v3 encryption key rotation включается по умолчанию: после записи данных новым форматом старые версии n8n не смогут их читать. |
| Backup | database/backup.sh сохраняет PostgreSQL, но не n8n_data, .env/master key или точный image. Одного этого недостаточно для отката. |

## Сначала подтвердить production-версию

Выполнить на VPS только читающие команды и сохранить вывод в change record:

    cd /opt/gelendzhik-guesthouse-automation/infrastructure
    docker exec gelendzhik-n8n n8n --version
    docker inspect --format='image_ref={{.Config.Image}} image_id={{.Image}} status={{.State.Status}}' gelendzhik-n8n
    docker compose ps

Сверить версию CLI, image ref/id и статус. Не выводить секреты среды. Если команды недоступны — записать версию как неизвестную и не угадывать её по README, latest или примеру 2.20.6.

## Фиксация Docker Compose

Compose собирает тег как 2.<minor>.<patch>; major фиксирован на 2, minor и patch обязательны. После подтверждения работающей версии внести её компоненты в серверный infrastructure/.env. Например, для 2.39.1 это minor 39 и patch 1 — только пример формата, не выбранная версия. Серверный .env не коммитить.

Проверить итоговый образ без обновления контейнера:

    docker compose config --images
    docker compose config -q

Правка не запускает команды на VPS и не меняет production.

## Подготовка и staging

1. Снять список активных workflow, последнее успешное выполнение ключевых сценариев, services и имена переменных среды (без секретных значений).
2. Обновить тестовую копию до свежей версии 2.x, затем проверить Settings → Migration Report — обе вкладки: workflow issues и instance issues. Если отчёт недоступен, сначала обновить тестовую копию до версии, поддерживающей отчёт.
3. Перед v3 сделать полный согласованный backup PostgreSQL, named volume n8n_data, серверного .env/master key с правами 600 и текущего точного image tag/digest. Проверить читаемость dump и архива volume; выполнить пробное восстановление на отдельной копии.
4. Поднять staging на v3 beta/stable с копией данных. Не подключать тестовую копию к реальным гостевым чатам, RealtyCalendar, WhatsApp или публичным webhook.
5. Проверить: iCal sync без изменения брони и повторный sync; voice → Whisper → owner reply; тестовое onboarding/D-1 сообщение; pricing с mock endpoint; рекомендации и контрольные цены; Error Trigger + Telegram alert; повтор booking event; restart и расшифровку credentials; ручной запуск ключевых workflows.
6. Для каждого Code node измерить длительность при максимальном ожидаемом объёме. Разобрать все Migration Report findings, новые ошибки и предупреждения. Переводить production только после подтверждения владельцем всех пунктов.

## Backup и откат

Проводить в окне обслуживания. Пример ниже останавливает только n8n на время согласованного snapshot; каталог хранится root-only. Укажите путь каталога backup, который существует только на сервере:

    cd /opt/gelendzhik-guesthouse-automation/infrastructure
    BACKUP_DIR="/root/backups/n8n-pre-v3-$(date +%Y%m%d_%H%M%S)"
    install -d -m 700 "$BACKUP_DIR"
    docker inspect --format='{{.Config.Image}} {{.Image}}' gelendzhik-n8n > "$BACKUP_DIR/n8n-image.txt"
    docker compose stop n8n
    docker exec gelendzhik-postgres pg_dump -U n8n_user -d n8n_gelendzhik -Fc > "$BACKUP_DIR/postgres.dump"
    docker run --rm --volumes-from gelendzhik-n8n -v "$BACKUP_DIR:/backup" alpine sh -c 'tar -czf /backup/n8n_data.tar.gz -C /home/node/.n8n .'
    cp .env "$BACKUP_DIR/.env"
    chmod 600 "$BACKUP_DIR/.env" "$BACKUP_DIR/postgres.dump" "$BACKUP_DIR/n8n_data.tar.gz"
    docker compose start n8n

После выполнения проверьте exit status каждой команды, ненулевой размер обоих архивов и содержимое tar. Убедитесь, что тот же master N8N_ENCRYPTION_KEY сохранён в защищённой копии .env. Перед тестированием v3 выполните пробное восстановление всего набора на отдельный сервер/volume.

У n8n нет прямого downgrade после того, как v3 сохранил credential data в новом формате. Для отката остановить n8n и восстановить согласованный snapshot до обновления: PostgreSQL, n8n_data volume, тот же master N8N_ENCRYPTION_KEY и старый точный image tag/digest. Не запускать старый 2.x против базы, в которую уже писал v3. Не удалять backup до успешного пробного восстановления. Существующий database/backup.sh делает только PostgreSQL dump и эту процедуру не заменяет.

## Production-гейт

Статический аудит не подтверждает выполнение. Для решения об upgrade нужны runtime version/image ID, Migration Report на актуальном 2.x, полный проверенный backup и успешный staging. Стабильный v3 следует проверять отдельно от beta.

Источники: n8n 3.0 breaking changes (https://docs.n8n.io/3-0-breaking-changes/), announcement (https://blog.n8n.io/introducing-n8n-v3/), encryption key rotation/rollback (https://docs.n8n.io/deploy/host-n8n/configure-n8n/security/rotate-encryption-keys/).
