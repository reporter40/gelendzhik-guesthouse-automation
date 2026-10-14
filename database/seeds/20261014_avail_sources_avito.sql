-- Источники этапа 2: объявления Avito ↔ номера (подтверждено Дмитрием 14.10.2026).
-- Только чтение броней; запись в Avito управляется system_vars.avito_push_enabled.
INSERT INTO avail_source (platform, apartment_id, kind, avito_item_id, label, enabled)
VALUES ('avito','40','avito_api',7731210163,'Avito 2-к Курзальная 40 (7731210163)',true),
       ('avito','41','avito_api',7731175501,'Avito 2-к Курзальная 40 (7731175501)',true)
ON CONFLICT (platform, apartment_id, kind) DO UPDATE SET avito_item_id=EXCLUDED.avito_item_id, label=EXCLUDED.label, enabled=true;
