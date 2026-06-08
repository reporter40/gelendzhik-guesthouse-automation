-- Marketing posts queue для workflow 15 (Content Autopost)
CREATE TABLE IF NOT EXISTS marketing_posts (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(80) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued', -- queued | posted | skipped
    scheduled_for TIMESTAMPTZ,
    posted_at TIMESTAMPTZ,
    telegram_message_id BIGINT,
    telegram_chat_id BIGINT,
    utm_campaign VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marketing_posts_status ON marketing_posts(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_marketing_posts_slug ON marketing_posts(slug);

-- Каталог поинт-каналов для аналитики
CREATE TABLE IF NOT EXISTS marketing_channels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    platform VARCHAR(30) NOT NULL,        -- telegram, vk, instagram, yandex_maps, ...
    telegram_chat_id BIGINT,
    utm_source VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO marketing_channels (name, platform, utm_source) VALUES
    ('Курзальная 40 (свой)', 'telegram', 'tg_own')
ON CONFLICT DO NOTHING;
