#!/usr/bin/env bash
# Изолированный тестовый контур на netcup: свой Postgres (pg-test) + n8n-test в отдельной сети gtest-net.
# Боевые контейнеры и боевая база недостижимы: у pg-test сетевые имена postgres/gelendzhik-postgres,
# поэтому креды n8n (host=postgres) внутри теста указывают на копию.
#   test_stack.sh up                  — копия боевой базы → pg-test, все процессы выключены, n8n-test на 127.0.0.1:5690
#   test_stack.sh sql <file>          — применить SQL к тестовой базе
#   test_stack.sh psql <args...>      — psql к тестовой базе
#   test_stack.sh publish <id> <ver>  — опубликовать версию в n8n-test и перезапустить
#   test_stack.sh down                — удалить тестовый контур
set -euo pipefail
cd /opt/gelendzhik
set -a; . ./.env; set +a
DB=n8n_gelendzhik
TPSQL() { docker exec -i pg-test psql -U n8n_user -d "$DB" -v ON_ERROR_STOP=1 -q "$@"; }
wait_health() { for _ in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5690/healthz | grep -q 200 && return 0; sleep 3; done; echo "n8n-test not healthy"; return 1; }

case "$1" in
  up)
    docker rm -f n8n-test pg-test >/dev/null 2>&1 || true
    docker network create gtest-net >/dev/null 2>&1 || true
    docker run -d --name pg-test --network gtest-net --network-alias postgres --network-alias gelendzhik-postgres \
      -e POSTGRES_DB="$DB" -e POSTGRES_USER=n8n_user -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" postgres:16-alpine >/dev/null
    for _ in $(seq 1 30); do docker exec pg-test pg_isready -U n8n_user -d "$DB" -h localhost >/dev/null 2>&1 && break; sleep 2; done
    sleep 2
    docker exec gelendzhik-postgres pg_dump -U n8n_user -Fc "$DB" | docker exec -i pg-test pg_restore -U n8n_user -d "$DB" --no-owner
    TPSQL -c 'UPDATE workflow_entity SET active=false, "activeVersionId"=NULL'
    TPSQL -c "INSERT INTO system_vars(key,value) VALUES ('test_db_marker','pg-test') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value"
    docker run -d --name n8n-test --network gtest-net -p 127.0.0.1:5690:5678 \
      -e DB_TYPE=postgresdb -e DB_POSTGRESDB_HOST=pg-test -e DB_POSTGRESDB_DATABASE="$DB" \
      -e DB_POSTGRESDB_USER=n8n_user -e DB_POSTGRESDB_PASSWORD="$POSTGRES_PASSWORD" \
      -e N8N_ENCRYPTION_KEY="$N8N_ENCRYPTION_KEY" -e GENERIC_TIMEZONE=Europe/Moscow -e TZ=Europe/Moscow \
      -e N8N_DIAGNOSTICS_ENABLED=false -e WEBHOOK_URL=http://127.0.0.1:5690/ \
      docker.n8n.io/n8nio/n8n:2.19.2 >/dev/null
    wait_health
    echo "up: pg-test, active=$(TPSQL -At -c 'select count(*) from workflow_entity where active')"
    ;;
  sql)  TPSQL < "$2" ;;
  psql) shift; TPSQL "$@" ;;
  publish)
    docker exec n8n-test n8n publish:workflow --id="$2" --versionId="$3" 2>&1 | grep -iE "publishing|error" || true
    docker restart n8n-test >/dev/null
    wait_health
    # healthz отвечает раньше, чем зарегистрированы вебхуки активных процессов — ждём, пока уйдут 404
    for _ in $(seq 1 30); do
      [ "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:5690/webhook/adminapi1234/admin)" != 404 ] && break; sleep 2
    done
    ;;
  down)
    docker rm -f n8n-test pg-test >/dev/null 2>&1 || true
    docker network rm gtest-net >/dev/null 2>&1 || true
    echo "down"
    ;;
esac
