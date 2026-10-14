#!/usr/bin/env bash
# Ночной бэкап базы n8n_gelendzhik. Cron: /etc/cron.d/gelendzhik-backup (03:30 МСК).
# Хранит 14 дней в /root/backups/daily. Копию вне сервера забирает Мак (rsync по ключу).
set -euo pipefail
umask 077
DIR=/root/backups/daily
mkdir -p "$DIR"
TS=$(date +%Y-%m-%d_%H%M)
OUT="$DIR/n8n_gelendzhik_$TS.dump"
docker exec gelendzhik-postgres pg_dump -U n8n_user -d n8n_gelendzhik -Fc > "$OUT.part"
# дамп должен читаться, иначе не считаем его бэкапом
docker exec -i gelendzhik-postgres pg_restore -l < "$OUT.part" > /dev/null
mv "$OUT.part" "$OUT"
find "$DIR" -name 'n8n_gelendzhik_*.dump' -mtime +14 -delete
echo "$(date -Is) ok $OUT $(stat -c %s "$OUT")" >> "$DIR/backup.log"
