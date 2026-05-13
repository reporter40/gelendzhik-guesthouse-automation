# n8n Workflow Safe Deploy

**Статус:** Реализовано (2026-05-13)  
**Скрипт:** `infrastructure/deploy_workflow_safe.sh`

---

## Проблема: n8n import:workflow сбрасывает активацию

### Симптомы

После выполнения `n8n import:workflow` на n8n 2.20.6:

1. **`workflow_entity.active = false`** — workflow деактивирован, даже если до импорта был `true`.
2. **`workflow_entity.activeVersionId = NULL`** — TypeORM relation `activeVersion` не разрешается.
3. **Вебхук не отвечает (HTTP 404)** — n8n не находит маршрут, потому что `active=false`.
4. **"Active version not found"** в логах n8n — потому что `activeVersionId IS NULL`.

### Причина

`n8n import:workflow` (CLI) реализован как "инструмент восстановления", а не как "деплой активного workflow":

- Он создаёт новую запись в `workflow_history` с новым `versionId`.
- Обновляет `workflow_entity.versionId` (draft version).
- **НЕ устанавливает** `workflow_entity.activeVersionId`.
- **НЕ устанавливает** `workflow_entity.active = true`.
- **НЕ создаёт** запись `workflow_published_version`.
- **НЕ добавляет** event `activated` в `workflow_publish_history`.

### Затронутые таблицы

| Таблица | Поле | До импорта | После импорта | Нужно |
|---------|------|-----------|---------------|-------|
| `workflow_entity` | `active` | `true` | `false` ⚠ | `true` |
| `workflow_entity` | `versionId` | `old-uuid` | `new-uuid` ✓ | `new-uuid` |
| `workflow_entity` | `activeVersionId` | `old-uuid` | `NULL` ⚠ | `new-uuid` |
| `workflow_published_version` | `publishedVersionId` | `old-uuid` | (не изменено) ⚠ | `new-uuid` |
| `workflow_publish_history` | (event) | `activated` | (не добавлено) | `activated` |
| `webhook_entity` | (row) | present | (может пропасть) | present |

---

## Решение: deploy_workflow_safe.sh

Скрипт выполняет полный цикл деплоя и автоматически исправляет все поля после `import:workflow`.

### Использование

```bash
# Из корня репозитория:
./infrastructure/deploy_workflow_safe.sh workflows/10_admin_api.json "10 — Admin API"

# Dry-run (только показать план, без изменений):
./infrastructure/deploy_workflow_safe.sh workflows/10_admin_api.json "10 — Admin API" --dry-run
```

### Шаги скрипта

| Шаг | Действие |
|-----|---------|
| 1 | Проверить, что JSON файл существует и корректен |
| 2 | Backup: сохранить текущее состояние workflow в `/root/backups/wf_deploy_TIMESTAMP/` |
| 3 | Прочитать текущее состояние workflow из БД (`active`, `versionId`, `activeVersionId`) |
| 4 | `scp` JSON на VPS в `/tmp/` |
| 5 | `docker exec n8n n8n import:workflow` |
| 6 | Найти workflow в БД по name, получить новый `versionId` из `workflow_history` |
| 7 | Восстановить: `active=true`, `versionId`, `activeVersionId`, `workflow_published_version`, `workflow_publish_history` |
| 8 | Проверить/восстановить `webhook_entity` |
| 9 | `docker compose restart n8n` + `sleep 10` |
| 10 | Проверки: `docker compose ps`, `/rest/login`, Admin API health |

### Dry-run

В режиме `--dry-run` скрипт:
- Подключается к VPS и читает текущее состояние БД.
- **Не вносит никаких изменений**.
- Показывает полный план действий.
- Выводит итоговый отчёт.

```
[10:15:30] ── Step 1: Проверить workflow файл ────
[10:15:30] ✓ Файл OK: 86 нод
[10:15:30]   JSON name:  "10 — Admin API"
[10:15:30] ✓ HTTP Webhook обнаружен: path=adminapi1234/admin
[DRY-RUN] scp workflows/10_admin_api.json root@178.105.139.57:/tmp/wf_deploy_...
[DRY-RUN] docker cp ... gelendzhik-n8n:/tmp/wf_import.json
[DRY-RUN] docker exec gelendzhik-n8n n8n import:workflow --input=/tmp/wf_import.json
[DRY-RUN] → workflow_entity.active станет false, activeVersionId станет NULL
...
✓ Dry-run завершён. Реальных изменений нет.
```

---

## Ручные команды (если скрипт недоступен)

### Полный ручной деплой workflow 10

```bash
# 1. Скопировать JSON на VPS
scp -i ~/.ssh/aquatoring_prod_hetzner workflows/10_admin_api.json \
    root@178.105.139.57:/tmp/wf_import.json

# 2. Импортировать в n8n
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
    "docker cp /tmp/wf_import.json gelendzhik-n8n:/tmp/wf_import.json && \
     docker exec gelendzhik-n8n n8n import:workflow --input=/tmp/wf_import.json"

# 3. Получить ID и новый versionId
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
    "docker exec gelendzhik-postgres psql -U n8n_user -d n8n_gelendzhik -t -A -c \
    \"SELECT id, \\\"versionId\\\", \\\"activeVersionId\\\", active FROM workflow_entity WHERE name = '10 — Admin API'\""

# Сохранить WF_ID и NEW_VER из вывода

# 4. Восстановить workflow_entity
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
    "docker exec gelendzhik-postgres psql -U n8n_user -d n8n_gelendzhik -c \
    \"UPDATE workflow_entity SET active=true, \\\"activeVersionId\\\"='NEW_VER', \\\"updatedAt\\\"=NOW() WHERE id='WF_ID'\""

# 5. Обновить workflow_published_version
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
    "docker exec gelendzhik-postgres psql -U n8n_user -d n8n_gelendzhik -c \
    \"INSERT INTO workflow_published_version (\\\"workflowId\\\", \\\"publishedVersionId\\\", \\\"createdAt\\\", \\\"updatedAt\\\") \
     VALUES ('WF_ID', 'NEW_VER', NOW(), NOW()) \
     ON CONFLICT (\\\"workflowId\\\") DO UPDATE SET \\\"publishedVersionId\\\"='NEW_VER', \\\"updatedAt\\\"=NOW()\""

# 6. Добавить activated event в workflow_publish_history
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
    "docker exec gelendzhik-postgres psql -U n8n_user -d n8n_gelendzhik -c \
    \"INSERT INTO workflow_publish_history (id, \\\"workflowId\\\", \\\"versionId\\\", action, \\\"userId\\\", \\\"createdAt\\\") \
     VALUES (gen_random_uuid(), 'WF_ID', 'NEW_VER', 'activated', (SELECT id FROM \\\"user\\\" LIMIT 1), NOW())\""

# 7. Перезапустить n8n
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
    "cd /opt/gelendzhik-guesthouse-automation/infrastructure && docker compose restart n8n"

# 8. Проверить
sleep 10
curl -s https://owner.aquatoring.ru/rest/login | head -c 100
```

### Проверить состояние webhook

```bash
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
    "docker exec gelendzhik-postgres psql -U n8n_user -d n8n_gelendzhik -t -c \
    \"SELECT \\\"webhookPath\\\", method, node FROM webhook_entity WHERE \\\"workflowId\\\"='WF_ID'\""
```

---

## Rollback

### Автоматический (из backup скрипта)

Backup сохраняется в `/root/backups/wf_deploy_TIMESTAMP/` на VPS.

```bash
# Посмотреть бэкапы
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 "ls /root/backups/"

# Прочитать backup
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
    "cat /root/backups/wf_deploy_TIMESTAMP/workflow_entity.json"
```

### Ручной rollback (восстановить активацию)

Если workflow перестал отвечать после деплоя:

```bash
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 "docker exec gelendzhik-postgres psql -U n8n_user -d n8n_gelendzhik -c \"
  -- Шаг 1: найти последний versionId
  SELECT id, \\\"versionId\\\", \\\"activeVersionId\\\", active 
  FROM workflow_entity WHERE name = '10 — Admin API';

  -- Шаг 2: найти последнюю версию в history
  SELECT \\\"versionId\\\", \\\"createdAt\\\" 
  FROM workflow_history 
  WHERE \\\"workflowId\\\" = 'WF_ID'
  ORDER BY \\\"createdAt\\\" DESC LIMIT 3;
\""

# Затем применить Step 4-7 из раздела "Ручные команды" выше
```

### Откат к предыдущей версии workflow

```bash
# Найти нужный versionId в workflow_history
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
    "docker exec gelendzhik-postgres psql -U n8n_user -d n8n_gelendzhik -c \
    \"SELECT \\\"versionId\\\", \\\"createdAt\\\" FROM workflow_history WHERE \\\"workflowId\\\"='WF_ID' ORDER BY \\\"createdAt\\\" DESC LIMIT 5\""

# Установить предыдущую версию
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
    "docker exec gelendzhik-postgres psql -U n8n_user -d n8n_gelendzhik -c \
    \"UPDATE workflow_entity SET \\\"versionId\\\"='OLD_VER', \\\"activeVersionId\\\"='OLD_VER', \\\"updatedAt\\\"=NOW() WHERE id='WF_ID'; \
      UPDATE workflow_published_version SET \\\"publishedVersionId\\\"='OLD_VER', \\\"updatedAt\\\"=NOW() WHERE \\\"workflowId\\\"='WF_ID'\""

# Перезапустить n8n
ssh -i ~/.ssh/aquatoring_prod_hetzner root@178.105.139.57 \
    "cd /opt/gelendzhik-guesthouse-automation/infrastructure && docker compose restart n8n"
```

---

## Конфигурация скрипта

| Переменная | Значение |
|-----------|---------|
| `VPS_HOST` | `178.105.139.57` |
| `SSH_USER` | `root` |
| `SSH_KEY` | `~/.ssh/aquatoring_prod_hetzner` |
| `POSTGRES_CONTAINER` | `gelendzhik-postgres` |
| `N8N_CONTAINER` | `gelendzhik-n8n` |
| `DB_NAME` | `n8n_gelendzhik` |
| `DB_USER` | `n8n_user` |
| `COMPOSE_DIR` | `/opt/gelendzhik-guesthouse-automation/infrastructure` |
| `ADMIN_API_TOKEN_FILE` | `infrastructure/.admin_api_token` |

---

## История

- **2026-05-13** — Создан по результатам отладки деплоя Phase C2.3.
  Корневая причина: `n8n import:workflow` v2.20.6 не обновляет `activeVersionId`,
  что ломает TypeORM relation `activeVersion` и делает вебхуки недоступными.
