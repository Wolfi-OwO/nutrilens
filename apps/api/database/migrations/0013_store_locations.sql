-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0013 — Store locations, with PostGIS geolocation.
--
-- One row per physical store. `location` is geography(Point, 4326) rather
-- than plain lat/lon columns so "stores near me" can use ST_DWithin against
-- a GiST index instead of a per-row haversine scan (research findings, issue
-- #184: geography, not earthdistance — geography does the sphere math
-- itself, so ST_DWithin's third argument is plain meters, no projection).
-- SRID 4326 is WGS84, the lat/lon system GPS and every consumer-facing map
-- already uses.
--
-- geography (not geometry) is used because distance/ST_DWithin queries
-- against geometry are in whatever unit the SRID's plane uses (nonsense for
-- 4326, which is degrees), while geography always measures in meters
-- regardless of SRID — the whole reason to pick it for a "stores within N
-- km" query.
--
-- external_store_id is the source dataset's own id for the store, where the
-- source has one (Geolocet does). UNIQUE per discounter so re-running an
-- import is idempotent (ON CONFLICT DO UPDATE, see
-- StoreLocationRepository#upsert) instead of duplicating rows on every run.
-- Nullable, and Postgres never treats two NULLs as equal, so discounters
-- with no external id yet (Billa, Hofer, ...) can still hold many NULL rows
-- once they get data.
-- ─────────────────────────────────────────────────────────────────────────────

-- Do NOT "simplify" this back to CREATE EXTENSION IF NOT EXISTS postgis.
--
-- postgis is an UNTRUSTED extension, so only superusers (on Azure Flexible
-- Server: members of azure_pg_admin) may execute CREATE EXTENSION on it at
-- all. Azure's privilege hook runs BEFORE Postgres evaluates IF NOT EXISTS,
-- so the bare statement fails even when the extension is already installed.
-- Measured on nutrilens_production as the app role nutrilens_prod_app, with
-- postgis already present and allowlisted:
--
--   CREATE EXTENSION IF NOT EXISTS postgis;
--   ERROR 42501: Because postgis isn't a trusted extension, only members of
--                "azure_pg_admin" are allowed to ...
--
-- That crash-looped the production deploy. Checking pg_extension first means
-- CREATE EXTENSION is never reached where PostGIS is preinstalled (production;
-- CI and local dev, which use the postgis/postgis image), so the hook never
-- fires. On a database genuinely lacking PostGIS it still runs — and still
-- fails loudly if the role cannot create it, which is what we want.
--
-- pg_trgm/pgcrypto/citext in the earlier migrations need no such guard: they
-- are trusted extensions (PG13+), creatable by any role with CREATE on the
-- database.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        CREATE EXTENSION postgis;
    END IF;
END
$$;

CREATE TABLE store_locations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discounter_id       UUID NOT NULL REFERENCES discounters(id),
    external_store_id   TEXT,
    name                TEXT,
    address             TEXT,
    city                TEXT,
    postal_code         TEXT,
    location            geography(Point, 4326) NOT NULL,
    phone               TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    last_verified_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (discounter_id, external_store_id)
);

CREATE INDEX idx_store_locations_discounter_id ON store_locations(discounter_id);

-- GiST index: what turns ST_DWithin's "stores within N meters" and the KNN
-- `<->` distance-ordering operator into an index scan instead of a
-- sequential scan over every store. Required to hit the <100ms NFR at
-- 1,000+ stores (issue #184).
CREATE INDEX idx_store_locations_geo ON store_locations USING GIST(location);

CREATE TRIGGER trg_store_locations_updated_at BEFORE UPDATE ON store_locations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
