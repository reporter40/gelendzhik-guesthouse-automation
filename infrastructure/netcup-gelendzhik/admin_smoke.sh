#!/usr/bin/env bash
# Смоук всех read-действий Admin API. usage: admin_smoke.sh <base_url>  (токен одинаков в боевой и тестовой базе)
U="$1/webhook/adminapi1234/admin"
T=$(docker exec gelendzhik-postgres psql -U n8n_user -d n8n_gelendzhik -At -c "SELECT value FROM system_vars WHERE key='admin_api_token' LIMIT 1;")
fail=0
for a in health bookings templates revenue revenue_dashboard revenue_notifications_status pricing_recommendations pricing_action_audit_log competitor_sources competitor_price_observations competitor_market_summary market_history competitor_cohorts competitor_candidates cohort_market_summary property_context_settings; do
  body="{\"action\":\"$a\"}"; [ "$a" = property_context_settings ] && body='{"action":"property_context_settings","mode":"get"}'
  r=$(curl -s -m 30 -X POST "$U" -H 'Content-Type: application/json' -H "x-admin-token: $T" -d "$body" -w '\n%{http_code}')
  code=$(echo "$r" | tail -1); js=$(echo "$r" | sed '$d')
  ok=$(printf '%s' "$js" | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin); print("ok" if d.get("ok") is True else "NOTOK:"+str(d)[:120])
except Exception as e: print("BADJSON:"+repr(sys.stdin)[:0])' 2>/dev/null)
  [ "$code" = 200 ] && [ "$ok" = ok ] || fail=1
  printf '%-32s %s %s\n' "$a" "$code" "$ok"
  [ "$ok" = ok ] || printf '      body[%s]: %s\n' "${#js}" "$(printf '%s' "$js" | head -c 250)"
done
exit $fail
