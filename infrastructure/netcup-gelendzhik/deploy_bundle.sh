#!/usr/bin/env bash
# Пакет «админка + надёжное расписание» (14.10.2026). Один и тот же скрипт для теста и боя.
#   deploy_bundle.sh test   — применить к изолированному pg-test / n8n-test
#   deploy_bundle.sh prod   — применить к боевой базе (рестарт n8n только в окно :05–:25/:35–:55, без running-запусков)
# Шаги: миграции c23,c34(одной транзакцией)+удаление заглушек,c36,c38 → версии WF10 и WF01 → публикация → рестарт.
# Откат: см. docs/MIGRATION_NETCUP_2026-10.md, раздел «Откат пакета админки».
set -euo pipefail
cd /opt/gelendzhik
MODE="$1"; WF10_VER="$2"; WF01_VER="$3"
WF10=82575887-be9e-4267-8e8e-2d760de2a986; WF01=4a846531ec22acc6
if [ "$MODE" = test ]; then
  PG=pg-test; N8N=n8n-test; PORT=5690
else
  PG=gelendzhik-postgres; N8N=gelendzhik-n8n; PORT=5678
fi
PSQL() { docker exec -i "$PG" psql -U n8n_user -d n8n_gelendzhik -v ON_ERROR_STOP=1 -q "$@"; }

echo "[1/4] миграции ($MODE)"
PSQL < 20260513_c23_manual_apply.sql >/dev/null
PSQL -1 < 20260514_c34_market_cohorts.sql >/dev/null
PSQL < c34_remove_placeholders.sql
PSQL < 20260514_c36_expand_rec_types.sql >/dev/null
PSQL < 20260515_c38_net_gross_pricing.sql >/dev/null
echo "      cohorts=$(PSQL -At -c 'select count(*) from competitor_cohorts') placeholders=$(PSQL -At -c "select count(*) from competitor_sources where url ilike '%placeholder%'")"

echo "[2/4] версии процессов"
PSQL < bundle_wf10.sql
PSQL < bundle_wf01.sql

echo "[3/4] публикация"
docker exec "$N8N" n8n publish:workflow --id=$WF10 --versionId="$WF10_VER" 2>&1 | grep -iE "publishing|error" || true
docker exec "$N8N" n8n publish:workflow --id=$WF01 --versionId="$WF01_VER" 2>&1 | grep -iE "publishing|error" || true

echo "[4/4] рестарт"
if [ "$MODE" = prod ]; then
  m=$(TZ=Europe/Moscow date +%M); m=$((10#$m))
  if ! { [ $m -ge 5 ] && [ $m -le 25 ]; } && ! { [ $m -ge 35 ] && [ $m -le 55 ]; }; then echo "вне окна рестарта (минута $m) — стоп"; exit 3; fi
  for _ in $(seq 1 30); do
    r=$(PSQL -At -c "select count(*) from execution_entity where status in ('running','new')"); [ "$r" = 0 ] && break; sleep 5
  done
  [ "$r" = 0 ] || { echo "есть идущие запуски — стоп"; exit 4; }
  docker stop -t 40 "$N8N" >/dev/null && docker compose up -d n8n >/dev/null
else
  docker restart -t 40 "$N8N" >/dev/null
fi
for _ in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$PORT/healthz | grep -q 200 && break; sleep 3; done
for _ in $(seq 1 30); do [ "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:$PORT/webhook/adminapi1234/admin)" != 404 ] && break; sleep 2; done
echo "      активны: $(PSQL -At -c "select string_agg(left(name,2),' ' order by name) from workflow_entity where active")"
echo "      WF10=$(PSQL -At -c "select \"activeVersionId\" from workflow_entity where id='$WF10'")  WF01=$(PSQL -At -c "select \"activeVersionId\" from workflow_entity where id='$WF01'")"
