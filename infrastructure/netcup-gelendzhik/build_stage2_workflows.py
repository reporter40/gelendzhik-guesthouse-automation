#!/usr/bin/env python3
"""Собирает JSON процессов этапа 2 (синхронизация занятости) из кода.

  workflows/16_availability_sync.json      — опрос iCal-площадок/Google и Avito API, запись в Avito (по флагу)
  workflows/17_availability_export.json    — iCal-выгрузка для площадок /webhook/avail/ical/<platform>/<apt>-<token>.ics
  workflows/18_availability_watchdog.json  — сторож: пересечения, устаревшие источники, защита → владельцу

Вся логика дат/отмен/защит/выгрузки — в SQL (database/migrations/20261014_stage2_availability.sql, тесты
database/tests/stage2_availability_test.sql). Разбор iCal — lib/ical_parse.js (тесты lib/ical_parse.test.js).
n8n только качает, разбирает и вызывает функции.
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
PG = {"postgres": {"id": "gelendzhik_db", "name": "Gelendzhik DB"}}
AVITO = {"oAuth2Api": {"id": "avito_oauth", "name": "Avito OAuth2"}}
TG = {"telegramApi": {"id": "telegram_owner_bot", "name": "Telegram Owner Bot"}}

ICAL_PARSE = open(os.path.join(HERE, "lib", "ical_parse.js"), encoding="utf-8").read()
ICAL_PARSE = re.sub(r"\nif \(typeof module.*\n?$", "\n", ICAL_PARSE)

# Безопасная подстановка строки в SQL внутри Code-узла
SQL_HELPERS = r"""
const q = (s) => "'" + String(s ?? '').replace(/'/g, "''") + "'";
const applySql = (sourceId, complete, events, keepPast, error) => complete
  ? `SELECT avail_apply_snapshot(${Number(sourceId)}, ${q(JSON.stringify(events))}::jsonb, true, ${keepPast ? 'true' : 'false'}) AS r`
  : `SELECT avail_mark_error(${Number(sourceId)}, ${q(error)}) AS r`;
"""


def node(name, ntype, version, params, pos, **extra):
    n = {"parameters": params, "name": name, "type": ntype, "typeVersion": version, "position": pos,
         "id": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:36]}
    n.update(extra)
    return n


def pg(name, query, pos, **extra):
    return node(name, "n8n-nodes-base.postgres", 2.5, {"operation": "executeQuery", "query": query, "options": {}},
                pos, credentials=PG, **extra)


def code(name, js, pos, mode="runOnceForAllItems"):
    return node(name, "n8n-nodes-base.code", 2, {"mode": mode, "jsCode": js}, pos)


def link(*names):
    c = {}
    for a, b in zip(names, names[1:]):
        c.setdefault(a, {"main": [[]]})["main"][0].append({"node": b, "type": "main", "index": 0})
    return c


def merge_conns(*cs):
    out = {}
    for c in cs:
        for k, v in c.items():
            if k in out:
                out[k]["main"][0].extend(v["main"][0])
            else:
                out[k] = json.loads(json.dumps(v))
    return out


def wf(wid, name, nodes, connections):
    return {"id": wid, "name": name, "nodes": nodes, "connections": connections, "active": False,
            "settings": {"executionOrder": "v1", "timezone": "Europe/Moscow",
                         "saveDataErrorExecution": "all"},
            "pinData": {}, "meta": {"generatedBy": "infrastructure/netcup-gelendzhik/build_stage2_workflows.py"}}


# ── WF16 ─────────────────────────────────────────────────────────────────────────────────────────
PARSE_ICAL_JS = ICAL_PARSE + SQL_HELPERS + r"""
const sources = $('Load iCal Sources').all();
return $input.all().map((it, i) => {
  const src = sources[i].json;
  const j = it.json || {};
  const status = Number(j.statusCode || 0);
  if (j.error || status !== 200) {
    const err = j.error ? (j.error.message || JSON.stringify(j.error)) : `HTTP ${status}`;
    return { json: { source_id: src.id, sql: applySql(src.id, false, [], false, err) } };
  }
  const r = parseIcal(typeof j.body === 'string' ? j.body : String(j.data ?? ''));
  if (!r.ok) return { json: { source_id: src.id, sql: applySql(src.id, false, [], false, r.error) } };
  return { json: { source_id: src.id, events: r.events.length, sql: applySql(src.id, true, r.events, false) } };
});
"""

MAP_AVITO_JS = SQL_HELPERS + r"""
const sources = $('Load Avito Sources').all();
return $input.all().map((it, i) => {
  const src = sources[i].json;
  const j = it.json || {};
  const status = Number(j.statusCode || 0);
  const list = j.body && Array.isArray(j.body.bookings) ? j.body.bookings : null;
  if (j.error || status !== 200 || !list) {
    const err = j.error ? (j.error.message || JSON.stringify(j.error)) : `HTTP ${status}: ${JSON.stringify(j.body || '').slice(0, 200)}`;
    return { json: { source_id: src.id, sql: applySql(src.id, false, [], true, err) } };
  }
  const events = list
    .filter(b => b && (b.status === 'active' || b.status === 'pending'))
    .map(b => ({ uid: 'avito-' + b.avito_booking_id, check_in: b.check_in, check_out: b.check_out,
                 summary: `Avito ${b.status}${b.guest_count ? ', гостей ' + b.guest_count : ''}` }));
  // keepPast=true: Avito не отдаёт брони с заездом в прошлом — их не удаляем.
  // Все брони (включая отменённые) — в bookings для 03 Guest Journey и отчётов.
  const sql = applySql(src.id, true, events, true).replace(' AS r', ' AS r') +
    `, avito_upsert_bookings(${q(src.apartment_id)}, ${q(JSON.stringify(list))}::jsonb) AS bookings_upserted`;
  return { json: { source_id: src.id, events: events.length, sql } };
});
"""

RECORD_PUSH_JS = r"""
const q = (s) => "'" + String(s ?? '').replace(/'/g, "''") + "'";
const due = $('Avito Push Due').all();
return $input.all().map((it, i) => {
  const d = due[i].json;
  const j = it.json || {};
  const status = Number(j.statusCode || 0);
  const ok = !j.error && status === 200 && j.body && j.body.result === 'success';
  const err = ok ? null : (j.error ? (j.error.message || JSON.stringify(j.error)) : `HTTP ${status}: ${JSON.stringify(j.body || '').slice(0, 300)}`);
  const sql = `INSERT INTO avito_push_state (avito_item_id, apartment_id, last_hash, last_pushed_at, last_status, last_error)
    VALUES (${Number(d.avito_item_id)}, ${q(d.apartment_id)}, ${ok ? q(d.hash) : 'NULL'}, now(), ${q(ok ? 'ok' : 'error')}, ${err ? q(err) : 'NULL'})
    ON CONFLICT (avito_item_id) DO UPDATE SET last_hash = COALESCE(EXCLUDED.last_hash, avito_push_state.last_hash),
      last_pushed_at = now(), last_status = EXCLUDED.last_status, last_error = EXCLUDED.last_error`;
  return { json: { sql } };
});
"""

TODAY = "{{ $now.setZone('Europe/Moscow').toFormat('yyyy-MM-dd') }}"
HORIZON = "{{ $now.setZone('Europe/Moscow').plus({ days: 365 }).toFormat('yyyy-MM-dd') }}"
FULL_RESP = {"response": {"response": {"fullResponse": True, "neverError": True}}, "timeout": 30000}

wf16_nodes = [
    node("Every 5 Minutes", "n8n-nodes-base.scheduleTrigger", 1.2,
         {"rule": {"interval": [{"field": "cronExpression", "expression": "*/5 * * * *"}]}}, [0, 300]),
    # iCal-площадки и Google-календари
    pg("Load iCal Sources", "SELECT id, platform, apartment_id, ical_url FROM avail_source WHERE enabled AND kind = 'ical' ORDER BY id", [240, 100]),
    node("Fetch iCal", "n8n-nodes-base.httpRequest", 4.2,
         {"url": "={{ $json.ical_url }}",
          "options": {"response": {"response": {"fullResponse": True, "neverError": True, "responseFormat": "text"}},
                      "timeout": 30000}},
         [480, 100], onError="continueRegularOutput"),
    code("Parse iCal", PARSE_ICAL_JS, [720, 100]),
    pg("Apply iCal Snapshot", "={{ $json.sql }}", [960, 100]),
    # Avito API: брони
    pg("Load Avito Sources", "SELECT s.id, s.apartment_id, s.avito_item_id, v.value AS account_id FROM avail_source s "
       "JOIN system_vars v ON v.key = 'avito_account_id' WHERE s.enabled AND s.kind = 'avito_api' ORDER BY s.id", [240, 300]),
    node("Fetch Avito Bookings", "n8n-nodes-base.httpRequest", 4.2,
         {"url": "=https://api.avito.ru/realty/v1/accounts/{{ $json.account_id }}/items/{{ $json.avito_item_id }}/bookings?date_start="
                 + TODAY + "&date_end=" + HORIZON + "&with_unpaid=true",
          "authentication": "genericCredentialType", "genericAuthType": "oAuth2Api", "options": FULL_RESP},
         [480, 300], credentials=AVITO, onError="continueRegularOutput"),
    code("Map Avito Bookings", MAP_AVITO_JS, [720, 300]),
    pg("Apply Avito Snapshot", "={{ $json.sql }}", [960, 300]),
    # запись занятости в календарь Avito (только при avito_push_enabled = true и изменившемся хэше)
    pg("Avito Push Due",
       "SELECT s.avito_item_id, s.apartment_id, v.value AS account_id, p->'body' AS body, p->>'hash' AS hash "
       "FROM avail_source s JOIN system_vars v ON v.key = 'avito_account_id' "
       "CROSS JOIN LATERAL avito_push_payload(s.avito_item_id) p "
       "LEFT JOIN avito_push_state st ON st.avito_item_id = s.avito_item_id "
       "WHERE s.enabled AND s.kind = 'avito_api' "
       "AND (SELECT value FROM system_vars WHERE key = 'avito_push_enabled') = 'true' "
       "AND (st.last_hash IS DISTINCT FROM p->>'hash' OR st.last_status IS DISTINCT FROM 'ok')", [240, 500]),
    node("Push Avito Calendar", "n8n-nodes-base.httpRequest", 4.2,
         {"method": "POST",
          "url": "=https://api.avito.ru/core/v1/accounts/{{ $json.account_id }}/items/{{ $json.avito_item_id }}/bookings",
          "authentication": "genericCredentialType", "genericAuthType": "oAuth2Api",
          "sendBody": True, "specifyBody": "json", "jsonBody": "={{ JSON.stringify($json.body) }}", "options": FULL_RESP},
         [480, 500], credentials=AVITO, onError="continueRegularOutput"),
    code("Record Push", RECORD_PUSH_JS, [720, 500]),
    pg("Save Push State", "={{ $json.sql }}", [960, 500]),
]
wf16_conns = merge_conns(
    link("Every 5 Minutes", "Load iCal Sources", "Fetch iCal", "Parse iCal", "Apply iCal Snapshot"),
    link("Every 5 Minutes", "Load Avito Sources", "Fetch Avito Bookings", "Map Avito Bookings", "Apply Avito Snapshot"),
    link("Every 5 Minutes", "Avito Push Due", "Push Avito Calendar", "Record Push", "Save Push State"),
)

# ── WF17 ─────────────────────────────────────────────────────────────────────────────────────────
EXPORT_PARSE_JS = r"""
const p = ($json.params) || {};
const platform = String(p.platform || '');
const m = String(p.file || '').match(/^([0-9]{1,6})-([0-9a-f]{32})\.ics$/);
if (!/^[a-z]{2,20}$/.test(platform) || !m) return { json: { sql: "SELECT NULL::text AS ics" } };
return { json: { sql: `SELECT avail_export_ics('${platform}', '${m[1]}', '${m[2]}') AS ics` } };
"""
wf17_nodes = [
    node("iCal Request", "n8n-nodes-base.webhook", 2,
         {"httpMethod": "GET", "path": "ical/:platform/:file", "responseMode": "responseNode", "options": {}},
         [0, 300], webhookId="avail"),
    code("Parse Path", EXPORT_PARSE_JS, [220, 300], mode="runOnceForEachItem"),
    pg("Build iCal", "={{ $json.sql }}", [440, 300], alwaysOutputData=True),
    node("Token OK?", "n8n-nodes-base.if", 2,
         {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose"},
                         "conditions": [{"id": "ics", "leftValue": "={{ $json.ics }}", "rightValue": "",
                                         "operator": {"type": "string", "operation": "notEmpty", "singleValue": True}}],
                         "combinator": "and"}, "options": {}}, [660, 300]),
    node("Respond iCal", "n8n-nodes-base.respondToWebhook", 1.1,
         {"respondWith": "text", "responseBody": "={{ $json.ics }}",
          "options": {"responseCode": 200, "responseHeaders": {"entries": [
              {"name": "Content-Type", "value": "text/calendar; charset=utf-8"},
              {"name": "Cache-Control", "value": "no-cache"}]}}}, [880, 200]),
    node("Respond 404", "n8n-nodes-base.respondToWebhook", 1.1,
         {"respondWith": "text", "responseBody": "Not found", "options": {"responseCode": 404}}, [880, 400]),
]
wf17_conns = link("iCal Request", "Parse Path", "Build iCal", "Token OK?")
wf17_conns["Token OK?"] = {"main": [[{"node": "Respond iCal", "type": "main", "index": 0}],
                                    [{"node": "Respond 404", "type": "main", "index": 0}]]}

# ── WF18 ─────────────────────────────────────────────────────────────────────────────────────────
wf18_nodes = [
    node("Every 10 Minutes", "n8n-nodes-base.scheduleTrigger", 1.2,
         {"rule": {"interval": [{"field": "cronExpression", "expression": "2-59/10 * * * *"}]}}, [0, 300]),
    pg("Alerts Due", "SELECT a.alert_key, a.message, (SELECT value FROM system_vars WHERE key = 'owner_chat_id') AS chat_id "
       "FROM avail_alerts_due() a", [240, 300]),
    node("Notify Owner", "n8n-nodes-base.telegram", 1.2,
         {"chatId": "={{ $json.chat_id }}", "text": "={{ $json.message }}",
          "additionalFields": {"appendAttribution": False}}, [480, 300], credentials=TG),
]
wf18_conns = link("Every 10 Minutes", "Alerts Due", "Notify Owner")

OUT = {
    "16_availability_sync.json": wf("availsync0000016", "16 — Availability Sync (iCal + Avito)", wf16_nodes, wf16_conns),
    "17_availability_export.json": wf("availexport00017", "17 — Availability iCal Export", wf17_nodes, wf17_conns),
    "18_availability_watchdog.json": wf("availwatchdog018", "18 — Availability Watchdog", wf18_nodes, wf18_conns),
}
for fname, data in OUT.items():
    with open(os.path.join(REPO, "workflows", fname), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("wrote", fname, len(data["nodes"]), "nodes")
