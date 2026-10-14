-- WF02 Owner Bot: распознавание голосовых через Polza.ai вместо контейнера Whisper.
-- Применять на netcup ПОСЛЕ финального восстановления и ДО публикации WF02.
-- Меняет узел "Whisper STT" и в workflow_entity, и в workflow_history (activeVersionId
-- из activation_map.tsv), т.к. n8n исполняет версию из workflow_history.
-- Ответ Polza {"text": "..."} совпадает с форматом whisper-asr (output=json),
-- остальные узлы не меняются. Откат: workflows/backups/02_owner_bot_before_polza_stt_20261014.json
BEGIN;
CREATE TEMP TABLE new_node AS SELECT $j${
  "parameters": {
    "method": "POST",
    "url": "https://polza.ai/api/v1/audio/transcriptions",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendBody": true,
    "contentType": "multipart-form-data",
    "bodyParameters": {"parameters": [
      {"parameterType": "formBinaryData", "name": "file", "inputDataFieldName": "data"},
      {"name": "model", "value": "openai/whisper-large-v3-turbo"},
      {"name": "language", "value": "ru"}
    ]},
    "options": {"timeout": 60000}
  },
  "credentials": {"httpHeaderAuth": {"id": "polza_header_auth", "name": "Polza Header Auth"}},
  "id": "w1", "name": "Whisper STT", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.1, "position": [550, 150]
}$j$::jsonb AS node;

UPDATE workflow_entity w SET nodes = (
  SELECT json_agg(CASE WHEN n->>'name' = 'Whisper STT' THEN (SELECT node FROM new_node)::json ELSE n END)
  FROM json_array_elements(w.nodes::json) n)
WHERE w.id = 'c9a5874f34e45e4d';

UPDATE workflow_history h SET nodes = (
  SELECT json_agg(CASE WHEN n->>'name' = 'Whisper STT' THEN (SELECT node FROM new_node)::json ELSE n END)
  FROM json_array_elements(h.nodes::json) n)
WHERE h."workflowId" = 'c9a5874f34e45e4d' AND h."versionId" = '534ee819-b4f5-467d-b1d1-819a65b05895';

SELECT 'entity', count(*) FROM workflow_entity w, json_array_elements(w.nodes::json) n
  WHERE w.id='c9a5874f34e45e4d' AND n->>'name'='Whisper STT' AND n::text LIKE '%polza.ai/api/v1/audio%'
UNION ALL
SELECT 'history', count(*) FROM workflow_history h, json_array_elements(h.nodes::json) n
  WHERE h."versionId"='534ee819-b4f5-467d-b1d1-819a65b05895' AND n->>'name'='Whisper STT' AND n::text LIKE '%polza.ai/api/v1/audio%';
COMMIT;
