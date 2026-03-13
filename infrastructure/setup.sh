#!/bin/bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠️${NC} $1"; }

INSTALL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo "═══════════════════════════════════════════════════"
echo " 🏠 Gelendzhik Guesthouse Automation Installer"
echo " n8n 2.x + PostgreSQL + Qdrant + Whisper"
echo "═══════════════════════════════════════════════════"
echo ""

# 1. Системные пакеты
log "Установка системных пакетов..."
apt-get update -qq
apt-get install -y -qq curl git htop nano ufw fail2ban ca-certificates gnupg > /dev/null 2>&1

# 2. Docker
if ! command -v docker &> /dev/null; then
    log "Установка Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker && systemctl start docker
else
    log "Docker: $(docker --version)"
fi

# 3. Firewall
log "Настройка Firewall..."
ufw allow 22/tcp > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 443/tcp > /dev/null 2>&1
ufw allow 81/tcp > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1

# 4. .env
cd "$INSTALL_DIR/infrastructure"
if [ ! -f .env ]; then
    log "Генерация .env..."
    PG_PASS=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)
    N8N_KEY=$(openssl rand -hex 32)
    cp "$INSTALL_DIR/.env.template" .env
    sed -i "s/CHANGE_ME_strong_password_here/$PG_PASS/" .env
    sed -i "s/CHANGE_ME_64_hex_chars_here/$N8N_KEY/" .env
    log "✅ .env создан (пароли сгенерированы)"
    warn "Заполните API ключи: nano $INSTALL_DIR/infrastructure/.env"
else
    log ".env существует — пропускаем"
fi

# 5. Запуск
log "Запуск контейнеров..."
docker compose up -d

log "Ожидание PostgreSQL (30 сек)..."
sleep 30

# 6. Статус
log "Статус контейнеров:"
docker compose ps

# 7. Cron бэкап
if [ -f "$INSTALL_DIR/database/backup.sh" ]; then
    chmod +x "$INSTALL_DIR/database/backup.sh"
    (crontab -l 2>/dev/null | grep -v "backup.sh"; echo "0 3 * * * $INSTALL_DIR/database/backup.sh >> $INSTALL_DIR/backups/cron.log 2>&1") | crontab -
    mkdir -p "$INSTALL_DIR/backups"
    log "Cron бэкап: ежедневно 03:00"
fi

# 8. Итог
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo ""
echo "═══════════════════════════════════════════════════"
echo -e " ${GREEN}✅ УСТАНОВКА ЗАВЕРШЕНА!${NC}"
echo "═══════════════════════════════════════════════════"
echo " n8n: http://${SERVER_IP}:5678"
echo " NPM: http://${SERVER_IP}:81"
echo " Whisper: http://${SERVER_IP}:9000"
echo " Qdrant: http://${SERVER_IP}:6333"
echo ""
echo " Далее:"
echo " 1. nano infrastructure/.env → API ключи"
echo " 2. docker compose restart"
echo " 3. NPM → домен + SSL"
echo " 4. n8n → импорт workflows/"
echo "═══════════════════════════════════════════════════"
