#!/usr/bin/env python3
"""Генерирует SQL, который кладёт workflow из JSON-файла репозитория новой версией в n8n 2.x.

n8n исполняет версию из workflow_history по activeVersionId, поэтому прямой UPDATE
workflow_entity.nodes не работает. Скрипт:
  1) вставляет новую строку workflow_history (новый versionId, старые версии не трогает — откат);
  2) обновляет черновик workflow_entity (nodes, connections, versionId).
Публикация (activeVersionId) — отдельно: `n8n publish:workflow --id=<id> --versionId=<new>` + рестарт.

Использование (печатает SQL в stdout, versionId — в stderr):
  wf_version_sql.py workflows/10_admin_api.json <workflow_id> | ssh ... psql -v ON_ERROR_STOP=1
"""
import json
import os
import sys
import uuid


def lit(s: str) -> str:
    tag = "$wf$"
    assert tag not in s
    return f"{tag}{s}{tag}"


def main() -> None:
    path, wf_id = sys.argv[1], sys.argv[2]
    wf = json.load(open(path, encoding="utf-8"))
    nodes = json.dumps(wf["nodes"], ensure_ascii=False)
    conns = json.dumps(wf["connections"], ensure_ascii=False)
    vid = str(uuid.uuid4())
    label = ("repo " + os.path.basename(path))[:120].replace("'", "")
    print("BEGIN;")
    print(
        'INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,autosaved) '
        f"VALUES ('{vid}','{wf_id}','repo-deploy',{lit(nodes)}::json,{lit(conns)}::json,'{label}',false);"
    )
    print(
        f"UPDATE workflow_entity SET nodes={lit(nodes)}::json, connections={lit(conns)}::json, "
        f"\"versionId\"='{vid}', \"updatedAt\"=now() WHERE id='{wf_id}';"
    )
    print(
        f"DO $$ BEGIN IF (SELECT count(*) FROM workflow_entity WHERE id='{wf_id}' AND \"versionId\"='{vid}') <> 1 "
        "THEN RAISE EXCEPTION 'workflow not updated'; END IF; END $$;"
    )
    print("COMMIT;")
    print(vid, file=sys.stderr)


if __name__ == "__main__":
    main()
