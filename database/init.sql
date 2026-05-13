-- Gelendzhik Automation — PostgreSQL Schema
-- Автоматически при первом запуске postgres

CREATE TABLE IF NOT EXISTS availability_cache (
    apartment_id VARCHAR(20) PRIMARY KEY,
    apartment_name VARCHAR(100),
    lot_id VARCHAR(20),
    blocked_dates JSONB NOT NULL DEFAULT '[]',
    events_count INTEGER DEFAULT 0,
    previous_snapshot JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
    id VARCHAR(50) PRIMARY KEY,
    apartment_id VARCHAR(20) NOT NULL,
    apartment_name VARCHAR(100),
    guest_name VARCHAR(200),
    guest_phone VARCHAR(30),
    guest_email VARCHAR(200),
    checkin_at DATE NOT NULL,
    checkout_at DATE NOT NULL,
    nights INTEGER GENERATED ALWAYS AS (checkout_at - checkin_at) STORED,
    total_amount INTEGER,
    net_amount INTEGER,
    commission_pct NUMERIC(5,2) DEFAULT 0,
    source VARCHAR(100),
    status VARCHAR(50) DEFAULT 'booking',
    journey_sent JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_history (
    apartment_id VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    price INTEGER NOT NULL,
    base_price INTEGER NOT NULL,
    multiplier NUMERIC(4,2),
    season VARCHAR(50),
    is_weekend BOOLEAN DEFAULT FALSE,
    is_holiday BOOLEAN DEFAULT FALSE,
    notes TEXT,
    set_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (apartment_id, date)
);

CREATE TABLE IF NOT EXISTS system_vars (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_log (
    id SERIAL PRIMARY KEY,
    guest_phone VARCHAR(30),
    channel VARCHAR(20) DEFAULT 'telegram',
    user_message TEXT,
    ai_response TEXT,
    intent VARCHAR(100),
    action_taken VARCHAR(200),
    booking_created BOOLEAN DEFAULT FALSE,
    upsell_offered VARCHAR(100),
    upsell_accepted BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apartments (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    lot_id VARCHAR(20) NOT NULL,
    ical_url TEXT,
    base_price INTEGER NOT NULL,
    max_guests INTEGER,
    rooms INTEGER DEFAULT 2,
    description TEXT,
    checkin_instructions TEXT,
    wifi_name VARCHAR(100),
    wifi_password VARCHAR(100),
    active BOOLEAN DEFAULT TRUE
);

-- Seed data
INSERT INTO system_vars (key, value, description) VALUES
('last_poll', '2025-01-01T00:00:00Z', 'Последний polling RC API'),
('last_ical_sync', '2025-01-01T00:00:00Z', 'Последняя синхронизация iCal'),
('last_pricing_update', '2025-01-01T00:00:00Z', 'Последний пересчёт цен'),
('system_version', '1.0.0', 'Версия системы')
ON CONFLICT DO NOTHING;

INSERT INTO apartments (id, name, lot_id, ical_url, base_price, max_guests, rooms, description) VALUES
('40', 'Номер 40', '302043', 'https://realtycalendar.ru/ical/302043.ics', 4000, 4, 2, '2 комнаты, отдельный дворик, до 4 гостей'),
('41', 'Номер 41', '302052', 'https://realtycalendar.ru/ical/302052.ics', 4500, 5, 2, '2 комнаты, отдельный дворик, до 5 гостей'),
('42', 'Номер 42', '310322', 'https://realtycalendar.ru/ical/310322.ics', 4500, 5, 2, '2 комнаты, отдельный дворик, до 5 гостей'),
('50', 'Номер 50', '310313', 'https://realtycalendar.ru/ical/310313.ics', 7000, 7, 2, '2 комнаты, отдельный дворик, до 7 гостей')
ON CONFLICT DO NOTHING;

INSERT INTO availability_cache (apartment_id, apartment_name, lot_id) VALUES
('40', 'Номер 40', '302043'),
('41', 'Номер 41', '302052'),
('42', 'Номер 42', '310322'),
('50', 'Номер 50', '310313')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_bookings_checkin ON bookings(checkin_at);
CREATE INDEX IF NOT EXISTS idx_bookings_source ON bookings(source);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_apartment ON bookings(apartment_id);
CREATE INDEX IF NOT EXISTS idx_price_hist_apt_date ON price_history(apartment_id, date);
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversation_log(guest_phone);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversation_log(created_at);

-- message_templates: editable workflow 03 message bodies (added 2026-05-10)
CREATE TABLE IF NOT EXISTS message_templates (
  key        TEXT PRIMARY KEY,
  channel    TEXT NOT NULL,
  lang       TEXT NOT NULL DEFAULT 'ru',
  body       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_active
  ON message_templates(active) WHERE active;

CREATE OR REPLACE FUNCTION update_message_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_message_templates_updated_at ON message_templates;
CREATE TRIGGER trg_message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION update_message_templates_updated_at();
