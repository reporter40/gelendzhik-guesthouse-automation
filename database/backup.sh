#!/bin/bash
BACKUP_DIR="$(cd "$(dirname "$0")/../backups" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONTAINER="gelendzhik-postgres"
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"
echo "[$(date)] Starting backup..."

docker exec "$CONTAINER" pg_dump -U n8n_user -d n8n_gelendzhik --format=custom \
> "$BACKUP_DIR/backup_${TIMESTAMP}.dump" 2>/dev/null

if [ $? -eq 0 ]; then
    gzip "$BACKUP_DIR/backup_${TIMESTAMP}.dump"
    SIZE=$(du -h "$BACKUP_DIR/backup_${TIMESTAMP}.dump.gz" | cut -f1)
    echo "[$(date)] OK: backup_${TIMESTAMP}.dump.gz ($SIZE)"
    find "$BACKUP_DIR" -name "backup_*.dump.gz" -mtime +$KEEP_DAYS -delete
else
    echo "[$(date)] ERROR: Backup failed!"
fi
