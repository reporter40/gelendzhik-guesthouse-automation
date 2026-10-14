#!/usr/bin/env python3
"""Ошибка запуска n8n: exec_error.py <pg-container: gelendzhik-postgres or pg-test> <execution_id> [...]  (раскрывает flatted-формат execution_data)"""
import json, subprocess, sys
container = sys.argv[1]; db = "n8n_gelendzhik"
for eid in sys.argv[2:]:
    raw = subprocess.run(["docker", "exec", container, "psql", "-U", "n8n_user", "-d", db, "-At", "-c",
                          f'select data from execution_data where "executionId"={int(eid)}'], capture_output=True, text=True).stdout
    a = json.loads(raw)
    def R(v, d=0):
        if d > 30: return "…"
        if isinstance(v, str) and v.isdigit() and int(v) < len(a): return R(a[int(v)], d + 1)
        if isinstance(v, dict): return {k: R(x, d + 1) for k, x in v.items()}
        if isinstance(v, list): return [R(x, d + 1) for x in v]
        return v
    rd = R(a[0]).get("resultData", {})
    err = rd.get("error") or {}
    node = err.get("node", {})
    print(f"#{eid} last={rd.get('lastNodeExecuted')} node={node.get('name') if isinstance(node, dict) else node}")
    print("   ", str(err.get("message"))[:300])
    if err.get("description"): print("   ", str(err.get("description"))[:300])
