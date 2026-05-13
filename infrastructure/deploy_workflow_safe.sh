#!/usr/bin/env bash
# =============================================================================
# deploy_workflow_safe.sh — Безопасный деплой n8n workflow на VPS
#
# Проблема: n8n import:workflow (v2.20.6) сбрасывает:
#   - workflow_entity.active = false
#   - workflow_entity.activeVersionId = NULL
# Этот скрипт автоматически исправляет оба поля после импорта.
#
# Использование:
#   ./deploy_workflow_safe.sh <workflow.json> "<workflow_name>" [--dry-run]
#
# Примеры:
#   ./deploy_workflow_safe.sh workflows/10_admin_api.json "10 — Admin API"
#   ./deploy_workflow_safe.sh workflows/10_admin_api.json "10 — Admin API" --dry-run
# =============================================================================

set -euo pipefail

# ── КОНФИГУРАЦИЯ ─────────────────────────────────────────────────────────────
VPS_HOST="178.105.139.57"
SSH_USER="root"
SSH_KEY="${HOME}/.ssh/aquatoring_prod_hetzner"
POSTGRES_CONTAINER="gelendzhik-postgres"
N8N_CONTAINER="gelendzhik-n8n"
DB_NAME="n8n_gelendzhik"
DB_USER="n8n_user"
COMPOSE_DIR="/opt/gelendzhik-guesthouse-automation/infrastructure"
ADMIN_API_URL="https://owner.aquatoring.ru/webhook/adminapi1234/admin"
ADMIN_API_TOKEN_FILE="${BASH_SOURCE[0]%/*}/.admin_api_token"
N8N_LOGIN_URL="https://owner.aquatoring.ru/rest/login"
N8N_LOGIN_EMAIL="owner@aquatoring.ru"

# ── ЦВЕТА ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

# ── АРГУМЕНТЫ ────────────────────────────────────────────────────────────────
WF_FILE="${1:-}"
WF_NAME="${2:-}"
DRY_RUN=false

for arg in "${@:3}"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
done

usage() {
  echo "Usage: $0 <workflow_json> '<workflow_name>' [--dry-run]"
  echo "  --dry-run  Показать план действий без изменений на VPS"
  exit 1
}

[[ -z "$WF_FILE" || -z "$WF_NAME" ]] && usage

# ── ХЕЛПЕРЫ ──────────────────────────────────────────────────────────────────
log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${RESET} $*"; }
ok()   { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${RESET} $*"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${RESET} $*"; }
err()  { echo -e "${RED}[$(date +%H:%M:%S)] ✗${RESET} $*" >&2; }
dry()  { echo -e "${YELLOW}[DRY-RUN]${RESET} $*"; }
step() { echo -e "\n${BOLD}── Step $* ────────────────────────────────────${RESET}"; }
sep()  { echo -e "${CYAN}─────────────────────────────────────────────────${RESET}"; }

ssh_run() {
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
    "$SSH_USER@$VPS_HOST" "$@"
}

# psql_query: выполнить SQL через stdin (избегаем проблем с кавычками в -c)
# Возвращает результат без пробелов/переносов
psql_query() {
  local sql="$1"
  # Передаём SQL через stdin SSH → docker exec -i → psql stdin
  ssh_run "docker exec -i $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -t -A" \
    <<< "$sql" 2>/dev/null | tr -d '\n' | xargs
}

# psql_exec: выполнить SQL через stdin; выводит результат; провалится если psql вернул ERROR
psql_exec() {
  local sql="$1"
  local out
  out=$(ssh_run "docker exec -i $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME" \
    <<< "$sql" 2>&1)
  local rc=$?
  echo "$out"
  # Если psql напечатал ERROR — завершить с ошибкой
  if echo "$out" | grep -q '^ERROR:'; then
    err "psql ERROR в запросе:"
    err "  SQL: $sql"
    return 1
  fi
  return $rc
}

# ── НАЧАЛО ───────────────────────────────────────────────────────────────────
sep
echo -e "${BOLD}n8n Workflow Safe Deploy${RESET}"
echo "  Файл:      $WF_FILE"
echo "  Workflow:  $WF_NAME"
echo "  VPS:       $SSH_USER@$VPS_HOST"
echo "  Режим:     $([ "$DRY_RUN" == "true" ] && echo "DRY-RUN (только просмотр)" || echo "PRODUCTION")"
sep

# ── STEP 1: Проверить файл ───────────────────────────────────────────────────
step "1: Проверить workflow файл"

if [[ ! -f "$WF_FILE" ]]; then
  err "Файл не найден: $WF_FILE"
  exit 1
fi

# Python парсинг JSON
WF_PARSE=$(python3 - "$WF_FILE" <<'PYEOF'
import json, sys
try:
    with open(sys.argv[1]) as f:
        wf = json.load(f)
    nodes = wf.get('nodes', [])
    name = wf.get('name', '')
    # Find webhook node
    webhook_node = next((n for n in nodes if n.get('type') == 'n8n-nodes-base.webhook'), None)
    wh_path = webhook_node.get('parameters', {}).get('path', '') if webhook_node else ''
    wh_id   = webhook_node.get('id', '')                           if webhook_node else ''
    wh_name = webhook_node.get('name', '')                         if webhook_node else ''
    wh_method = webhook_node.get('parameters', {}).get('httpMethod', 'GET') if webhook_node else ''
    # JSON name vs arg name check
    print(f"OK|{name}|{len(nodes)}|{wh_path}|{wh_id}|{wh_name}|{wh_method}")
except Exception as e:
    print(f"ERROR|{e}|0||||| ")
PYEOF
)

if [[ "$WF_PARSE" == ERROR* ]]; then
  err "Ошибка парсинга JSON: ${WF_PARSE#ERROR|}"
  exit 1
fi

IFS='|' read -r _ JSON_NAME NODE_COUNT WH_PATH WH_NODE_ID WH_NODE_NAME WH_METHOD <<< "$WF_PARSE"

ok "Файл OK: $NODE_COUNT нод"
log "  JSON name:  \"$JSON_NAME\""
log "  Arg name:   \"$WF_NAME\""

if [[ "$JSON_NAME" != "$WF_NAME" ]]; then
  warn "Имя в JSON (\"$JSON_NAME\") не совпадает с аргументом (\"$WF_NAME\")"
  warn "Используем аргумент для поиска в БД: \"$WF_NAME\""
fi

HAS_WEBHOOK=false
if [[ -n "$WH_PATH" ]]; then
  HAS_WEBHOOK=true
  ok "HTTP Webhook обнаружен:"
  log "  path:   $WH_PATH"
  log "  method: $WH_METHOD"
  log "  nodeId: $WH_NODE_ID"
fi

# ── STEP 2: Backup текущего состояния из production БД ───────────────────────
step "2: Backup текущего состояния на VPS"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups/wf_deploy_${TIMESTAMP}"

if [[ "$DRY_RUN" == "true" ]]; then
  dry "mkdir -p $BACKUP_DIR"
  dry "pg_dump workflow_entity, workflow_published_version, workflow_publish_history"
  dry "→ $BACKUP_DIR/before_deploy.sql"
else
  log "Создаём backup на VPS: $BACKUP_DIR"
  ssh_run "mkdir -p $BACKUP_DIR"

  # Backup rows по имени workflow (передаём SQL через stdin)
  safe_name="${WF_NAME//\'/\'\'}"
  # Backup сохраняется на VPS (редиректим вывод удалённо через bash -c)
  ssh_run bash -s <<BACKUP_EOF
docker exec -i $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -t -A \
  -c "COPY (SELECT row_to_json(t) FROM (SELECT * FROM workflow_entity WHERE name = '${safe_name}') t) TO STDOUT" \
  > $BACKUP_DIR/workflow_entity.json 2>/dev/null || true
docker exec -i $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -t -A \
  -c "COPY (SELECT row_to_json(t) FROM (
    SELECT wpv.* FROM workflow_published_version wpv
    JOIN workflow_entity we ON we.id = wpv.\"workflowId\"
    WHERE we.name = '${safe_name}'
  ) t) TO STDOUT" \
  > $BACKUP_DIR/workflow_published_version.json 2>/dev/null || true
docker exec -i $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -t -A \
  -c "COPY (SELECT row_to_json(t) FROM (
    SELECT wph.* FROM workflow_publish_history wph
    JOIN workflow_entity we ON we.id = wph.\"workflowId\"
    WHERE we.name = '${safe_name}'
    ORDER BY wph.\"createdAt\" DESC LIMIT 20
  ) t) TO STDOUT" \
  > $BACKUP_DIR/workflow_publish_history.json 2>/dev/null || true
BACKUP_EOF
  ok "Backup сохранён: $BACKUP_DIR"
fi

# ── STEP 3: Получить текущее состояние workflow ──────────────────────────────
step "3: Чтение текущего состояния workflow в БД"

WF_CURRENT=$(psql_query "SELECT id || '|' || active || '|' || COALESCE(\"versionId\",'') || '|' || COALESCE(\"activeVersionId\",'') FROM workflow_entity WHERE name = '${WF_NAME//\'/\'\'}' LIMIT 1" 2>/dev/null || echo "")

if [[ -z "$WF_CURRENT" ]]; then
  warn "Workflow \"$WF_NAME\" не найден в БД (будет создан при импорте)"
  WF_ID=""
  WF_WAS_ACTIVE="unknown"
  WF_OLD_VERSION_ID=""
  WF_OLD_ACTIVE_VERSION_ID=""
else
  IFS='|' read -r WF_ID WF_WAS_ACTIVE WF_OLD_VERSION_ID WF_OLD_ACTIVE_VERSION_ID <<< "$WF_CURRENT"
  ok "Workflow найден:"
  log "  id:              $WF_ID"
  log "  active:          $WF_WAS_ACTIVE"
  log "  versionId:       $WF_OLD_VERSION_ID"
  log "  activeVersionId: $WF_OLD_ACTIVE_VERSION_ID"
fi

# Определяем, должен ли workflow быть active после деплоя
# Если был active=true ИЛИ это новый деплой webhook-workflow → activate
SHOULD_BE_ACTIVE=false
if [[ "$WF_WAS_ACTIVE" == "t" || "$WF_WAS_ACTIVE" == "true" || ( -z "$WF_ID" && "$HAS_WEBHOOK" == "true" ) ]]; then
  SHOULD_BE_ACTIVE=true
fi
log "  После деплоя active: $SHOULD_BE_ACTIVE"

# ── STEP 4: Скопировать JSON на VPS ─────────────────────────────────────────
step "4: Копировать JSON на VPS"

VPS_TMP_PATH="/tmp/wf_deploy_${TIMESTAMP}.json"

if [[ "$DRY_RUN" == "true" ]]; then
  dry "scp $WF_FILE $SSH_USER@$VPS_HOST:$VPS_TMP_PATH"
else
  scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$WF_FILE" "$SSH_USER@$VPS_HOST:$VPS_TMP_PATH"
  ok "JSON скопирован: $VPS_TMP_PATH"
fi

# ── STEP 5: n8n import:workflow ──────────────────────────────────────────────
step "5: n8n import:workflow"

if [[ "$DRY_RUN" == "true" ]]; then
  dry "docker cp $VPS_TMP_PATH $N8N_CONTAINER:/tmp/wf_import.json"
  dry "docker exec $N8N_CONTAINER n8n import:workflow --input=/tmp/wf_import.json"
  dry "→ workflow_entity.active станет false, activeVersionId станет NULL"
else
  log "Копируем JSON в контейнер n8n..."
  ssh_run "docker cp $VPS_TMP_PATH $N8N_CONTAINER:/tmp/wf_import.json"
  log "Запускаем n8n import:workflow..."
  IMPORT_OUT=$(ssh_run "docker exec $N8N_CONTAINER n8n import:workflow --input=/tmp/wf_import.json 2>&1" || true)
  log "  import output: $IMPORT_OUT"
  ok "import:workflow выполнен"
fi

# ── STEP 6: Найти workflow и новую версию ────────────────────────────────────
step "6: Найти workflow и получить новый versionId"

if [[ "$DRY_RUN" == "true" ]]; then
  dry "SELECT id, versionId, activeVersionId, active FROM workflow_entity WHERE name = '${WF_NAME}'"
  dry "SELECT versionId FROM workflow_history WHERE workflowId = <WF_ID> ORDER BY createdAt DESC LIMIT 1"
  log ""
  log "После импорта скрипт автоматически восстановит:"
  log "  workflow_entity.active = true"
  log "  workflow_entity.activeVersionId = <новый versionId>"
  log "  workflow_published_version.publishedVersionId = <новый versionId>"
  log "  workflow_publish_history: INSERT activated event"
  [[ "$HAS_WEBHOOK" == "true" ]] && log "  webhook_entity: проверить/вставить строку для path=$WH_PATH"
  log ""
  ok "Dry-run завершён. Реальных изменений нет."
  sep
  echo -e "\n${BOLD}ПЛАН ДЕЙСТВИЙ SUMMARY${RESET}"
  echo "  1. ✓ Файл: $WF_FILE ($NODE_COUNT нод)"
  echo "  2. ✓ Backup: $BACKUP_DIR (не создавался в dry-run)"
  echo "  3. ✓ БД до: active=$WF_WAS_ACTIVE, versionId=${WF_OLD_VERSION_ID:-'(новый)'}"
  echo "  4. ✓ scp → $VPS_TMP_PATH"
  echo "  5. ✓ n8n import:workflow"
  echo "  6. ✓ Восстановить active=true, activeVersionId, published version"
  [[ "$HAS_WEBHOOK" == "true" ]] && echo "  7. ✓ Проверить webhook_entity ($WH_PATH)"
  echo "  8. ✓ docker compose restart n8n"
  echo "  9. ✓ Проверки: docker ps, n8n login, admin API health"
  echo ""
  echo -e "${GREEN}Для реального деплоя уберите --dry-run${RESET}"
  sep
  exit 0
fi

# Найти workflow ID после импорта
NEW_WF_STATE=$(psql_query "SELECT id || '|' || COALESCE(\"versionId\",'') FROM workflow_entity WHERE name = '${WF_NAME//\'/\'\'}' LIMIT 1" 2>/dev/null || echo "")

if [[ -z "$NEW_WF_STATE" ]]; then
  err "Workflow не найден после импорта. Имя: \"$WF_NAME\""
  err "Проверьте, что поле 'name' в JSON совпадает с переданным аргументом."
  exit 1
fi

IFS='|' read -r WF_ID NEW_VERSION_ID <<< "$NEW_WF_STATE"
ok "Workflow найден после импорта:"
log "  id:         $WF_ID"
log "  versionId:  $NEW_VERSION_ID"

# Получить последнюю запись из workflow_history (она создаётся при импорте)
LATEST_HISTORY_VER=$(psql_query "SELECT \"versionId\" FROM workflow_history WHERE \"workflowId\" = '$WF_ID' ORDER BY \"createdAt\" DESC LIMIT 1" 2>/dev/null || echo "")

if [[ -n "$LATEST_HISTORY_VER" ]]; then
  log "  latest history versionId: $LATEST_HISTORY_VER"
  # Используем latest history version как основу
  FINAL_VERSION_ID="$LATEST_HISTORY_VER"
else
  log "  (workflow_history пуста, используем versionId из workflow_entity)"
  FINAL_VERSION_ID="$NEW_VERSION_ID"
fi

# ── STEP 7: Восстановить active, versionId, activeVersionId ─────────────────
step "7: Восстановить workflow_entity.active и activeVersionId"

if [[ "$SHOULD_BE_ACTIVE" == "true" ]]; then
  log "Обновляем workflow_entity..."
  psql_exec "UPDATE workflow_entity SET active = true, \"versionId\" = '$FINAL_VERSION_ID', \"activeVersionId\" = '$FINAL_VERSION_ID', \"updatedAt\" = NOW() WHERE id = '$WF_ID'"
  ok "workflow_entity обновлён: active=true, versionId/activeVersionId=$FINAL_VERSION_ID"

  # Проверить/создать workflow_published_version
  EXISTING_WPV=$(psql_query "SELECT \"workflowId\" FROM workflow_published_version WHERE \"workflowId\" = '$WF_ID' LIMIT 1" 2>/dev/null || echo "")
  if [[ -z "$EXISTING_WPV" ]]; then
    psql_exec "INSERT INTO workflow_published_version (\"workflowId\", \"publishedVersionId\", \"createdAt\", \"updatedAt\") VALUES ('$WF_ID', '$FINAL_VERSION_ID', NOW(), NOW())"
    ok "workflow_published_version создана"
  else
    psql_exec "UPDATE workflow_published_version SET \"publishedVersionId\" = '$FINAL_VERSION_ID', \"updatedAt\" = NOW() WHERE \"workflowId\" = '$WF_ID'"
    ok "workflow_published_version обновлена"
  fi

  # Добавить activated event в workflow_publish_history
  # Схема: id (serial), workflowId, versionId, event (NOT action!), userId, createdAt
  psql_exec "INSERT INTO workflow_publish_history (\"workflowId\", \"versionId\", event, \"userId\", \"createdAt\") VALUES ('$WF_ID', '$FINAL_VERSION_ID', 'activated', (SELECT id FROM \"user\" LIMIT 1), NOW())"
  ok "workflow_publish_history: activated event добавлен"
else
  log "Workflow не был active, пропускаем активацию (оставляем active=false)"
fi

# ── STEP 8: Проверить/восстановить webhook_entity ────────────────────────────
step "8: Проверить webhook_entity"

if [[ "$HAS_WEBHOOK" == "true" && "$SHOULD_BE_ACTIVE" == "true" ]]; then
  EXISTING_WH=$(psql_query "SELECT webhookPath FROM webhook_entity WHERE \"workflowId\" = '$WF_ID' AND \"webhookPath\" = '$WH_PATH' LIMIT 1" 2>/dev/null || echo "")
  if [[ -n "$EXISTING_WH" ]]; then
    ok "webhook_entity уже существует: path=$WH_PATH"
  else
    warn "webhook_entity не найден для path=$WH_PATH — создаём"
    # Схема: PK (webhookPath, method), нет id. bash 3.2 совместимо (нет ${^^})
    WH_METHOD_UPPER=$(echo "$WH_METHOD" | tr '[:lower:]' '[:upper:]')
    psql_exec "INSERT INTO webhook_entity (\"workflowId\", \"webhookPath\", method, node, \"pathLength\") VALUES ('$WF_ID', '$WH_PATH', '$WH_METHOD_UPPER', '$WH_NODE_NAME', (length('$WH_PATH') - length(replace('$WH_PATH', '/', '')) + 1)) ON CONFLICT (\"webhookPath\", method) DO NOTHING"
    ok "webhook_entity создана: $WH_PATH"
  fi
fi

# ── STEP 9: Перезапустить n8n ────────────────────────────────────────────────
step "9: Перезапустить n8n"

log "docker compose restart n8n..."
ssh_run "cd $COMPOSE_DIR && docker compose restart n8n" 2>&1
log "Ждём 10 секунд пока n8n поднимется..."
sleep 10
ok "n8n перезапущен"

# ── STEP 10: Проверки ────────────────────────────────────────────────────────
step "10: Проверки"

# 10a. docker compose ps
log "10a. docker compose ps:"
DOCKER_PS=$(ssh_run "cd $COMPOSE_DIR && docker compose ps --format 'table {{.Name}}\t{{.Status}}'" 2>&1 || true)
echo "$DOCKER_PS"
if echo "$DOCKER_PS" | grep -i "gelendzhik-n8n" | grep -qi "Up\|running\|healthy"; then
  ok "n8n контейнер: running"
else
  warn "n8n контейнер не running — проверьте docker compose ps на VPS"
fi

# 10b. curl n8n /rest/login
log "10b. curl n8n /rest/login:"
# -s без -f чтобы не получать 000 при 4xx ответах
LOGIN_RESP=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" "$N8N_LOGIN_URL" 2>/dev/null || echo "000")
if [[ "$LOGIN_RESP" == "200" || "$LOGIN_RESP" == "401" ]]; then
  ok "n8n login endpoint: HTTP $LOGIN_RESP (n8n жив)"
else
  warn "n8n login endpoint: HTTP $LOGIN_RESP"
fi

# 10c. Admin API health (только для workflow 10)
if echo "$WF_NAME" | grep -q "Admin API\|10"; then
  log "10c. Admin API health check:"
  # Получить токен
  if [[ -f "$ADMIN_API_TOKEN_FILE" ]]; then
    ADMIN_TOKEN=$(cat "$ADMIN_API_TOKEN_FILE" | tr -d '\n')
    HEALTH_RESP=$(curl -sf --max-time 15 -w "\n%{http_code}" \
      -H "Content-Type: application/json" \
      -H "X-Admin-Token: $ADMIN_TOKEN" \
      -d '{"action":"health_check"}' \
      "$ADMIN_API_URL" 2>/dev/null || echo -e "\n000")
    HEALTH_CODE=$(echo "$HEALTH_RESP" | tail -1)
    HEALTH_BODY=$(echo "$HEALTH_RESP" | head -1)
    if [[ "$HEALTH_CODE" == "200" ]]; then
      ok "Admin API health: HTTP 200"
      log "  body: $HEALTH_BODY"
    else
      warn "Admin API health: HTTP $HEALTH_CODE"
      [[ -n "$HEALTH_BODY" ]] && log "  body: $HEALTH_BODY"
    fi
  else
    warn "Токен не найден: $ADMIN_API_TOKEN_FILE — пропускаем Admin API health"
  fi
fi

# ── ФИНАЛЬНЫЙ ОТЧЁТ ──────────────────────────────────────────────────────────
sep
echo -e "\n${BOLD}DEPLOY REPORT${RESET}"
echo "  Время:     $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Workflow:  $WF_NAME"
echo "  WF ID:     $WF_ID"
echo "  Version:   $FINAL_VERSION_ID"
echo "  Active:    $SHOULD_BE_ACTIVE"
echo "  Backup:    $BACKUP_DIR"
[[ "$HAS_WEBHOOK" == "true" ]] && echo "  Webhook:   $WH_PATH ($WH_METHOD)"
echo "  n8n:       $N8N_LOGIN_URL → HTTP $LOGIN_RESP"
echo ""

# Итог
FAILED=false
# 200/401 = n8n жив; всё остальное — предупреждение
[[ "$LOGIN_RESP" != "200" && "$LOGIN_RESP" != "401" ]] && FAILED=true

if [[ "$FAILED" == "false" ]]; then
  echo -e "${GREEN}${BOLD}✓ DEPLOY УСПЕШЕН${RESET}"
  echo ""
  echo "Rollback (если нужен):"
  echo "  psql: UPDATE workflow_entity SET active=false WHERE id='$WF_ID';"
  echo "  Или:  восстановить из $BACKUP_DIR"
else
  echo -e "${RED}${BOLD}✗ DEPLOY ЗАВЕРШЁН С ПРЕДУПРЕЖДЕНИЯМИ${RESET}"
  echo "Проверьте логи выше."
  echo "Rollback: восстановить из $BACKUP_DIR"
fi
sep
