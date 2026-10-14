-- WF02 Owner Bot: скачивание голосового перед распознаванием.
-- Причина: TelegramTrigger (download=true) в n8n 2.19 скачивает только photo/document/video,
-- для message.voice бинарника нет → "Whisper STT" падает "expects binary file 'data'".
-- Добавляем узел Telegram file:get (download) между "Is Voice?" (true) и "Whisper STT".
-- Меняет workflow_entity и активную версию в workflow_history. Идемпотентно.
-- После применения: рестарт n8n (активная версия читается при активации).
BEGIN;
CREATE TEMP TABLE dl_node AS SELECT $j${
  "parameters": {
    "resource": "file",
    "fileId": "={{ $json.message.voice.file_id }}",
    "download": true,
    "additionalFields": {}
  },
  "credentials": {"telegramApi": {"id": "telegram_owner_bot", "name": "Telegram Owner Bot"}},
  "id": "dlvoice1", "name": "Download Voice", "type": "n8n-nodes-base.telegram", "typeVersion": 1.1,
  "position": [450, 150]
}$j$::jsonb AS node;

CREATE TEMP TABLE targets AS
  SELECT 'entity'::text AS t, id::text AS key FROM workflow_entity WHERE id = 'c9a5874f34e45e4d'
  UNION ALL
  SELECT 'history', "versionId" FROM workflow_history
   WHERE "workflowId" = 'c9a5874f34e45e4d'
     AND "versionId" = (SELECT "activeVersionId" FROM workflow_entity WHERE id = 'c9a5874f34e45e4d');

-- узел
UPDATE workflow_entity w SET nodes = (w.nodes::jsonb || jsonb_build_array((SELECT node FROM dl_node)))::json
 WHERE w.id = 'c9a5874f34e45e4d'
   AND NOT EXISTS (SELECT 1 FROM json_array_elements(w.nodes::json) n WHERE n->>'name' = 'Download Voice');
UPDATE workflow_history h SET nodes = (h.nodes::jsonb || jsonb_build_array((SELECT node FROM dl_node)))::json
 WHERE h."versionId" IN (SELECT key FROM targets WHERE t = 'history')
   AND NOT EXISTS (SELECT 1 FROM json_array_elements(h.nodes::json) n WHERE n->>'name' = 'Download Voice');

-- связи: Is Voice?[true] → Download Voice → Whisper STT
UPDATE workflow_entity w SET connections = jsonb_set(
    jsonb_set(w.connections::jsonb, '{Is Voice?,main,0}', '[{"node":"Download Voice","type":"main","index":0}]'),
    '{Download Voice}', '{"main":[[{"node":"Whisper STT","type":"main","index":0}]]}')::json
 WHERE w.id = 'c9a5874f34e45e4d';
UPDATE workflow_history h SET connections = jsonb_set(
    jsonb_set(h.connections::jsonb, '{Is Voice?,main,0}', '[{"node":"Download Voice","type":"main","index":0}]'),
    '{Download Voice}', '{"main":[[{"node":"Whisper STT","type":"main","index":0}]]}')::json
 WHERE h."versionId" IN (SELECT key FROM targets WHERE t = 'history');

-- проверка: в обеих местах есть узел и правильная связь
SELECT 'entity' AS where_, count(*) FILTER (WHERE n->>'name' = 'Download Voice') AS node,
       (SELECT connections::jsonb #>> '{Is Voice?,main,0,0,node}' FROM workflow_entity WHERE id = 'c9a5874f34e45e4d') AS isvoice_true
  FROM workflow_entity w, json_array_elements(w.nodes::json) n WHERE w.id = 'c9a5874f34e45e4d'
UNION ALL
SELECT 'history', count(*) FILTER (WHERE n->>'name' = 'Download Voice'),
       (SELECT connections::jsonb #>> '{Is Voice?,main,0,0,node}' FROM workflow_history WHERE "versionId" IN (SELECT key FROM targets WHERE t='history'))
  FROM workflow_history h, json_array_elements(h.nodes::json) n WHERE h."versionId" IN (SELECT key FROM targets WHERE t = 'history');
COMMIT;
