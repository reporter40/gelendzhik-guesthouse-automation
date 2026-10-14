#!/usr/bin/env bash
# Этап 2 «спящим»: миграция + кред Avito + процессы 16/17/18. Источников нет → ничего не синхронизируется и не пишется.
#   deploy_stage2.sh test|prod   (кред Avito ожидается в /root/avito_cred.json, удаляется после импорта)
set -euo pipefail
cd /opt/gelendzhik
MODE="$1"
if [ "$MODE" = test ]; then PG=pg-test; N8N=n8n-test; PORT=5690; else PG=gelendzhik-postgres; N8N=gelendzhik-n8n; PORT=5678; fi
PSQL() { docker exec -i "$PG" psql -U n8n_user -d n8n_gelendzhik -v ON_ERROR_STOP=1 -q "$@"; }
echo "[1/4] миграция"; PSQL < 20261014_stage2_availability.sql 2>&1 | grep -v NOTICE || true
echo "      источников: $(PSQL -At -c 'select count(*) from avail_source')"
echo "[2/4] кред Avito"
if [ -f /root/avito_cred.json ]; then
  docker cp /root/avito_cred.json "$N8N":/tmp/c.json; rm -f /root/avito_cred.json
  docker exec -u 0 "$N8N" chown node /tmp/c.json
  docker exec "$N8N" n8n import:credentials --input=/tmp/c.json 2>&1 | grep -iE "success|error"
  docker exec -u 0 "$N8N" rm -f /tmp/c.json
fi
echo "[3/4] процессы"
for f in 16_availability_sync 17_availability_export 18_availability_watchdog; do
  docker cp $f.json "$N8N":/tmp/$f.json; docker exec "$N8N" n8n import:workflow --input=/tmp/$f.json 2>&1 | grep -iE "success|error"
done
for w in availsync0000016 availexport00017 availwatchdog018; do docker exec "$N8N" n8n publish:workflow --id=$w 2>&1 | grep -iE "publishing|error"; done
echo "[4/4] рестарт"
if [ "$MODE" = prod ]; then
  m=$(TZ=Europe/Moscow date +%M); m=$((10#$m))
  if ! { [ $m -ge 5 ] && [ $m -le 25 ]; } && ! { [ $m -ge 35 ] && [ $m -le 55 ]; }; then echo "вне окна рестарта (минута $m) — процессы импортированы, рестарт не сделан"; exit 3; fi
  for _ in $(seq 1 30); do r=$(PSQL -At -c "select count(*) from execution_entity where status in ('running','new')"); [ "$r" = 0 ] && break; sleep 5; done
  [ "$r" = 0 ] || { echo "есть идущие запуски — стоп"; exit 4; }
  docker stop -t 40 "$N8N" >/dev/null && docker compose up -d n8n >/dev/null 2>&1
else
  docker restart -t 40 "$N8N" >/dev/null
fi
for _ in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$PORT/healthz | grep -q 200 && break; sleep 3; done
sleep 8
echo "      активны: $(PSQL -At -c "select string_agg(left(name,2),' ' order by name) from workflow_entity where active")"
