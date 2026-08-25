-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0012 — Discounters table.
--
-- Reference data for the grocery discounters this app compares prices and
-- stores across (issue #184). store_locations (0013) references this
-- table's id, so it must exist first.
--
-- api_endpoint / data_refresh_frequency_days describe how each discounter's
-- own data gets refreshed once a real source exists — most don't yet: Spar's
-- store data is a one-time Geolocet purchase (no live API), Billa has no
-- public API at all (research findings, issue #184: Apify scraping at
-- €50-100/mo or a direct partnership, both deferred to Phase 2). Both
-- columns stay NULL until a real integration lands.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE discounters (
    id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                          TEXT NOT NULL UNIQUE,
    name                          TEXT NOT NULL,
    country_code                  CHAR(2) NOT NULL,
    website_url                   TEXT,
    api_endpoint                  TEXT,
    data_refresh_frequency_days   INTEGER NOT NULL DEFAULT 14,
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_discounters_updated_at BEFORE UPDATE ON discounters
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed the five discounters this app tracks. Spar gets real store locations
-- via scripts/import-geolocet-spar-data.mjs; the rest stay placeholder rows
-- (no store_locations) until their own data source lands.
INSERT INTO discounters (code, name, country_code) VALUES
    ('spar', 'Spar', 'AT'),
    ('billa', 'Billa', 'AT'),
    ('hofer', 'Hofer', 'AT'),
    ('lidl', 'Lidl', 'AT'),
    ('penny', 'Penny', 'AT');
