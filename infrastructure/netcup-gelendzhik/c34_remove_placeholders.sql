-- После c34: убрать 3 кандидата-заглушки с выдуманными URL (*placeholder*), чтобы их не было в админке
-- и WF13 не ходил по фальшивым адресам. Удаляются только заглушки без наблюдений.
DELETE FROM competitor_sources cs
 WHERE cs.status = 'candidate' AND cs.url ILIKE '%placeholder%'
   AND NOT EXISTS (SELECT 1 FROM competitor_price_observations o WHERE o.competitor_source_id = cs.id);
