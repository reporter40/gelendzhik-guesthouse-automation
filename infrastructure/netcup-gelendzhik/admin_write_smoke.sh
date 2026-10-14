#!/usr/bin/env bash
# Смоук пишущих действий Admin API — ТОЛЬКО на изолированном тестовом контуре (n8n-test :5690, pg-test).
# Тексты с апострофами — проверка экранирования SQL.
set -uo pipefail
U=http://127.0.0.1:5690/webhook/adminapi1234/admin
T=$(docker exec gelendzhik-postgres psql -U n8n_user -d n8n_gelendzhik -At -c "SELECT value FROM system_vars WHERE key='admin_api_token'")
TQ() { docker exec -i pg-test psql -U n8n_user -d n8n_gelendzhik -At -v ON_ERROR_STOP=1 -c "$1"; }
[ "$(TQ "select value from system_vars where key='test_db_marker'")" = pg-test ] || { echo "НЕ тестовая база — стоп"; exit 2; }
fail=0
call() { # name expect_ok(json-bool) payload
  r=$(curl -s -m 30 -X POST $U -H 'Content-Type: application/json' -H "x-admin-token: $T" -d "$3" -w '\n%{http_code}')
  code=$(echo "$r" | tail -1); js=$(echo "$r" | sed '$d')
  got=$(printf '%s' "$js" | python3 -c 'import sys,json
try: print(str(json.load(sys.stdin).get("ok")).lower())
except Exception: print("badjson")')
  st=PASS; [ "$got" = "$2" ] || { st=FAIL; fail=1; }
  printf '%-4s %-46s %s ok=%s  %s\n' "$st" "$1" "$code" "$got" "$(printf '%s' "$js" | head -c 140)"
}
R1=$(TQ "select id from pricing_recommendations where status='draft' order by id limit 1")
R2=$(TQ "select id from pricing_recommendations where status='draft' order by id offset 1 limit 1")
SRC=$(TQ "select id from competitor_sources where status='active' limit 1")
C1=$(TQ "insert into competitor_sources(name,url,status,source_platform,discovery_status) values ('TEST cand A','https://example.test/a','candidate','manual','candidate') returning id" | head -1)
C2=$(TQ "insert into competitor_sources(name,url,status,source_platform,discovery_status) values ('TEST cand B','https://example.test/b','candidate','manual','candidate') returning id" | head -1)

call "approve R1 (reason с апострофом)"        true "{\"action\":\"pricing_recommendation_approve\",\"recommendation_id\":\"$R1\",\"reason\":\"O'Brien одобрил\"}"
call "export_rc R1"                            true "{\"action\":\"pricing_recommendation_export_rc\",\"recommendation_id\":\"$R1\"}"
call "mark_manual_applied R1 (апостроф)"       true "{\"action\":\"pricing_recommendation_mark_manual_applied\",\"recommendation_id\":\"$R1\",\"reason\":\"внёс в RC'\"}"
call "approve R2"                              true "{\"action\":\"pricing_recommendation_approve\",\"recommendation_id\":\"$R2\",\"reason\":\"ok\"}"
call "export_rc R2"                            true "{\"action\":\"pricing_recommendation_export_rc\",\"recommendation_id\":\"$R2\"}"
call "mark_apply_failed R2 (апостроф)"         true "{\"action\":\"pricing_recommendation_mark_apply_failed\",\"recommendation_id\":\"$R2\",\"reason\":\"RC'ошибка\"}"
call "approve несуществующей → ok=false"       false "{\"action\":\"pricing_recommendation_approve\",\"recommendation_id\":\"00000000-0000-0000-0000-000000000000\",\"reason\":\"x\"}"
call "add_competitor_observation (апостроф)"   true "{\"action\":\"add_competitor_observation\",\"competitor_source_id\":\"$SRC\",\"stay_date_from\":\"2027-06-01\",\"stay_date_to\":\"2027-06-03\",\"price_per_night\":5000,\"notes\":\"цена с сайта d'Arc\"}"
call "revenue_add_competitor_price (апостроф)" true "{\"action\":\"revenue_add_competitor_price\",\"source\":\"manual\",\"title\":\"Дом O'Hara\",\"url\":\"https://example.test/o\",\"location\":\"Геленджик\",\"max_guests\":4,\"rooms\":2,\"date_from\":\"2027-06-01\",\"date_to\":\"2027-06-03\",\"price_per_night\":4800,\"notes\":\"it's test\"}"
call "approve_candidate C1"                    true "{\"action\":\"competitor_source_approve_candidate\",\"source_id\":\"$C1\"}"
call "reject_candidate C2 (апостроф)"          true "{\"action\":\"competitor_source_reject_candidate\",\"source_id\":\"$C2\",\"reason\":\"не тот район, isn't\"}"
call "approve_candidate повторно → ok, «уже»"  true "{\"action\":\"competitor_source_approve_candidate\",\"source_id\":\"$C1\"}"
call "property_context_settings save"          true "{\"action\":\"property_context_settings\",\"mode\":\"save\",\"property_context_map\":{\"40\":\"дворик O'Neil\"},\"default_property_context\":\"гостевой дом\"}"
call "property_context_settings get"           true "{\"action\":\"property_context_settings\",\"mode\":\"get\"}"
call "manual_referral_lead save"               true "{\"action\":\"manual_referral_lead\",\"mode\":\"save\",\"apartment_id\":40,\"source\":\"referral\",\"referrer_name\":\"Д'Артаньян\",\"referred_guest_name\":\"О'Генри\",\"referral_price\":10000,\"amount\":10000}"
echo "--- в базе: rec R1=$(TQ "select status from pricing_recommendations where id='$R1'") R2=$(TQ "select status from pricing_recommendations where id='$R2'") C1=$(TQ "select status from competitor_sources where id='$C1'") C2=$(TQ "select status from competitor_sources where id='$C2'")"
exit $fail
