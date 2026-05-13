#!/usr/bin/env python3
"""
Phase C2.0 — patch workflow 10 to add pricing_recommendation_approve,
pricing_recommendation_reject, and pricing_action_audit_log actions.
"""

import json, copy, uuid

WF_PATH = "workflows/10_admin_api.json"

with open(WF_PATH) as f:
    wf = json.load(f)

nodes = wf["nodes"]
conns = wf["connections"]

# ─── helpers ──────────────────────────────────────────────────────────────────
def node_id():
    return str(uuid.uuid4())

CRED = {"id": "gelendzhik_db", "name": "gelendzhik_postgres"}

def pg_node(name, query, pos, cred=CRED):
    return {
        "id": node_id(),
        "name": name,
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": pos,
        "credentials": {"postgres": cred},
        "parameters": {
            "operation": "executeQuery",
            "query": query,
            "options": {},
        },
    }

def code_node(name, js, pos):
    return {
        "id": node_id(),
        "name": name,
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": pos,
        "parameters": {"jsCode": js},
    }

def if_node(name, field, value, pos):
    return {
        "id": node_id(),
        "name": name,
        "type": "n8n-nodes-base.if",
        "typeVersion": 2,
        "position": pos,
        "parameters": {
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
                "conditions": [{
                    "id": str(uuid.uuid4()),
                    "leftValue": f"={{{{ $('Webhook').first().json.body.{field} }}}}",
                    "rightValue": value,
                    "operator": {"type": "string", "operation": "equals"},
                }],
                "combinator": "and",
            }
        },
    }

def respond_node(name, body_json, pos):
    return {
        "id": node_id(),
        "name": name,
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1,
        "position": pos,
        "parameters": {
            "respondWith": "json",
            "responseBody": body_json,
            "options": {},
        },
    }

# ─── Fix Pricing Recs Query: add pr.id ────────────────────────────────────────
for n in nodes:
    if n["name"] == "Pricing Recs Query":
        q = n["parameters"]["query"]
        if "pr.id" not in q:
            # Insert pr.id::text as id after SELECT
            q = q.replace(
                "SELECT apartment_id,",
                "SELECT pr.id::text AS id, apartment_id,",
                1,
            )
            n["parameters"]["query"] = q
            print("Patched Pricing Recs Query to include pr.id")

# ─── New nodes ────────────────────────────────────────────────────────────────

# Approve flow: Y=1840–1940
n_if_approve = if_node(
    "If Approve", "action", "pricing_recommendation_approve", [880, 1840]
)

PREP_APPROVE_JS = r"""
const body = ($('Webhook').first().json.body) || $input.first().json || {};
const rec_id = (body.recommendation_id || '').trim();
const reason = (body.reason || 'Одобрено владельцем').replace(/'/g, "''");
if (!rec_id) {
  return [{ json: { ok: false, error: 'recommendation_id is required' } }];
}
return [{ json: { q_rec_id: rec_id, q_reason: reason } }];
"""
n_prep_approve = code_node("Prep Approve", PREP_APPROVE_JS, [1100, 1790])

APPROVE_SQL = """WITH old_rec AS (
  SELECT id, status, current_price, recommended_price, apartment_id,
         date_from, date_to
  FROM pricing_recommendations
  WHERE id = '{{ $json.q_rec_id }}'
),
upd AS (
  UPDATE pricing_recommendations
  SET status = 'approved', updated_at = now()
  WHERE id = '{{ $json.q_rec_id }}' AND status IN ('draft', 'rejected')
  RETURNING id, apartment_id, date_from, date_to, current_price, recommended_price
),
audit_ins AS (
  INSERT INTO pricing_action_audit_log
    (recommendation_id, action, previous_status, new_status,
     apartment_id, date_from, date_to, old_price, new_price,
     reason, actor, source)
  SELECT upd.id, 'approve', old_rec.status, 'approved',
         upd.apartment_id, upd.date_from, upd.date_to,
         upd.current_price, upd.recommended_price,
         '{{ $json.q_reason }}', 'admin', 'admin_panel'
  FROM upd, old_rec
  WHERE (SELECT count(*) FROM upd) > 0
  RETURNING id AS audit_id
)
SELECT
  (SELECT count(*) FROM upd)::integer AS rows_updated,
  (SELECT id FROM upd LIMIT 1)::text AS rec_id,
  (SELECT id FROM audit_ins LIMIT 1)::text AS audit_id,
  (SELECT status FROM old_rec LIMIT 1) AS previous_status"""

n_approve_db = pg_node("Approve DB Exec", APPROVE_SQL, [1320, 1790])

FORMAT_APPROVE_JS = r"""
const row = $input.first().json;
if (!row || row.rows_updated === 0 || row.rows_updated === '0') {
  return [{ json: { ok: false, error: 'Recommendation not found or status is not draft/rejected', rows_updated: row.rows_updated } }];
}
return [{ json: { ok: true, action: 'pricing_recommendation_approve', rec_id: row.rec_id, audit_id: row.audit_id, previous_status: row.previous_status, new_status: 'approved' } }];
"""
n_format_approve = code_node("Format Approve", FORMAT_APPROVE_JS, [1540, 1790])
n_respond_approve = respond_node(
    "Respond Approve",
    '={{ JSON.stringify($json) }}',
    [1760, 1790],
)

# Reject flow: Y=2040
n_if_reject = if_node(
    "If Reject", "action", "pricing_recommendation_reject", [880, 2040]
)

PREP_REJECT_JS = r"""
const body = ($('Webhook').first().json.body) || $input.first().json || {};
const rec_id = (body.recommendation_id || '').trim();
const reason = (body.reason || 'Отклонено владельцем').replace(/'/g, "''");
if (!rec_id) {
  return [{ json: { ok: false, error: 'recommendation_id is required' } }];
}
return [{ json: { q_rec_id: rec_id, q_reason: reason } }];
"""
n_prep_reject = code_node("Prep Reject", PREP_REJECT_JS, [1100, 1990])

REJECT_SQL = """WITH old_rec AS (
  SELECT id, status, current_price, recommended_price, apartment_id,
         date_from, date_to
  FROM pricing_recommendations
  WHERE id = '{{ $json.q_rec_id }}'
),
upd AS (
  UPDATE pricing_recommendations
  SET status = 'rejected', updated_at = now()
  WHERE id = '{{ $json.q_rec_id }}' AND status IN ('draft', 'approved')
  RETURNING id, apartment_id, date_from, date_to, current_price, recommended_price
),
audit_ins AS (
  INSERT INTO pricing_action_audit_log
    (recommendation_id, action, previous_status, new_status,
     apartment_id, date_from, date_to, old_price, new_price,
     reason, actor, source)
  SELECT upd.id, 'reject', old_rec.status, 'rejected',
         upd.apartment_id, upd.date_from, upd.date_to,
         upd.current_price, upd.recommended_price,
         '{{ $json.q_reason }}', 'admin', 'admin_panel'
  FROM upd, old_rec
  WHERE (SELECT count(*) FROM upd) > 0
  RETURNING id AS audit_id
)
SELECT
  (SELECT count(*) FROM upd)::integer AS rows_updated,
  (SELECT id FROM upd LIMIT 1)::text AS rec_id,
  (SELECT id FROM audit_ins LIMIT 1)::text AS audit_id,
  (SELECT status FROM old_rec LIMIT 1) AS previous_status"""

n_reject_db = pg_node("Reject DB Exec", REJECT_SQL, [1320, 1990])

FORMAT_REJECT_JS = r"""
const row = $input.first().json;
if (!row || row.rows_updated === 0 || row.rows_updated === '0') {
  return [{ json: { ok: false, error: 'Recommendation not found or status is not draft/approved', rows_updated: row.rows_updated } }];
}
return [{ json: { ok: true, action: 'pricing_recommendation_reject', rec_id: row.rec_id, audit_id: row.audit_id, previous_status: row.previous_status, new_status: 'rejected' } }];
"""
n_format_reject = code_node("Format Reject", FORMAT_REJECT_JS, [1540, 1990])
n_respond_reject = respond_node(
    "Respond Reject",
    '={{ JSON.stringify($json) }}',
    [1760, 1990],
)

# Audit log flow: Y=2240
n_if_audit = if_node(
    "If Audit Log", "action", "pricing_action_audit_log", [880, 2240]
)

AUDIT_SQL = """SELECT
  al.id::text,
  al.recommendation_id::text,
  al.action,
  al.previous_status,
  al.new_status,
  al.apartment_id,
  to_char(al.date_from, 'YYYY-MM-DD') AS date_from,
  to_char(al.date_to,   'YYYY-MM-DD') AS date_to,
  al.old_price::float,
  al.new_price::float,
  al.reason,
  al.actor,
  al.source,
  to_char(al.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
FROM pricing_action_audit_log al
ORDER BY al.created_at DESC
LIMIT 50"""

n_audit_query = pg_node("Audit Log Query", AUDIT_SQL, [1100, 2190])

FORMAT_AUDIT_JS = r"""
const rows = $input.all().map(i => i.json);
return [{ json: { ok: true, action: 'pricing_action_audit_log', count: rows.length, data: rows } }];
"""
n_format_audit = code_node("Format Audit Log", FORMAT_AUDIT_JS, [1320, 2190])
n_respond_audit = respond_node(
    "Respond Audit Log",
    '={{ JSON.stringify($json) }}',
    [1540, 2190],
)

# ─── Add all new nodes ────────────────────────────────────────────────────────
new_nodes = [
    n_if_approve, n_prep_approve, n_approve_db, n_format_approve, n_respond_approve,
    n_if_reject,  n_prep_reject,  n_reject_db,  n_format_reject,  n_respond_reject,
    n_if_audit,   n_audit_query,  n_format_audit, n_respond_audit,
]
for nn in new_nodes:
    nodes.append(nn)
print(f"Added {len(new_nodes)} new nodes")

# ─── Rewire connections ───────────────────────────────────────────────────────
# 1. Change "If Competitor Update Manual" false output: Respond 400 → If Approve
c_update = conns.get("If Competitor Update Manual", {})
for out_list in c_update.get("main", []):
    for t in out_list:
        if t["node"] == "Respond 400":
            t["node"] = n_if_approve["name"]
            print("Rewired: If Competitor Update Manual false → If Approve")

# 2. If Approve: true → Prep Approve; false → If Reject
conns[n_if_approve["name"]] = {"main": [
    [{"node": n_prep_approve["name"], "type": "main", "index": 0}],
    [{"node": n_if_reject["name"],    "type": "main", "index": 0}],
]}

# 3. Prep Approve → Approve DB Exec
conns[n_prep_approve["name"]] = {"main": [[{"node": n_approve_db["name"], "type": "main", "index": 0}]]}

# 4. Approve DB Exec → Format Approve
conns[n_approve_db["name"]] = {"main": [[{"node": n_format_approve["name"], "type": "main", "index": 0}]]}

# 5. Format Approve → Respond Approve
conns[n_format_approve["name"]] = {"main": [[{"node": n_respond_approve["name"], "type": "main", "index": 0}]]}

# 6. If Reject: true → Prep Reject; false → If Audit Log
conns[n_if_reject["name"]] = {"main": [
    [{"node": n_prep_reject["name"], "type": "main", "index": 0}],
    [{"node": n_if_audit["name"],    "type": "main", "index": 0}],
]}

# 7. Prep Reject → Reject DB Exec
conns[n_prep_reject["name"]] = {"main": [[{"node": n_reject_db["name"], "type": "main", "index": 0}]]}

# 8. Reject DB Exec → Format Reject
conns[n_reject_db["name"]] = {"main": [[{"node": n_format_reject["name"], "type": "main", "index": 0}]]}

# 9. Format Reject → Respond Reject
conns[n_format_reject["name"]] = {"main": [[{"node": n_respond_reject["name"], "type": "main", "index": 0}]]}

# 10. If Audit Log: true → Audit Log Query; false → Respond 400
conns[n_if_audit["name"]] = {"main": [
    [{"node": n_audit_query["name"], "type": "main", "index": 0}],
    [{"node": "Respond 400",        "type": "main", "index": 0}],
]}

# 11. Audit Log Query → Format Audit Log
conns[n_audit_query["name"]] = {"main": [[{"node": n_format_audit["name"], "type": "main", "index": 0}]]}

# 12. Format Audit Log → Respond Audit Log
conns[n_format_audit["name"]] = {"main": [[{"node": n_respond_audit["name"], "type": "main", "index": 0}]]}

wf["nodes"] = nodes
wf["connections"] = conns

with open(WF_PATH, "w") as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

print(f"\nWorkflow 10 patched. Total nodes: {len(nodes)}")
print("New actions: pricing_recommendation_approve, pricing_recommendation_reject, pricing_action_audit_log")
