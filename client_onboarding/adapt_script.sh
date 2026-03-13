#!/bin/bash
echo "═══════════════════════════════════════════════════"
echo " Адаптация системы под нового клиента"
echo "═══════════════════════════════════════════════════"
echo ""
read -p "RC Agency ID: " RC_ID
read -p "Домен (n8n.example.ru): " DOMAIN

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cp "$REPO_DIR/.env.template" "$REPO_DIR/infrastructure/.env"

sed -i "s/RC_AGENCY_ID=79366/RC_AGENCY_ID=$RC_ID/" "$REPO_DIR/infrastructure/.env"
sed -i "s|WEBHOOK_URL=https://n8n.YOUR_DOMAIN.ru/|WEBHOOK_URL=https://$DOMAIN/|" "$REPO_DIR/infrastructure/.env"
sed -i "s|realtycalendar.ru/booking/79366|realtycalendar.ru/booking/$RC_ID|" "$REPO_DIR/infrastructure/.env"

PG_PASS=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)
N8N_KEY=$(openssl rand -hex 32)
sed -i "s/CHANGE_ME_strong_password_here/$PG_PASS/" "$REPO_DIR/infrastructure/.env"
sed -i "s/CHANGE_ME_64_hex_chars_here/$N8N_KEY/" "$REPO_DIR/infrastructure/.env"

echo ""
echo "✅ .env адаптирован: $REPO_DIR/infrastructure/.env"
echo "📌 Заполните вручную: API ключи, промпты, knowledge_base"
