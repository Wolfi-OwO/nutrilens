-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0016 — Provenance on store_locations, and the two constraints that
-- keep OpenStreetMap data structurally separate from the purchased Geolocet
-- data (issue #212).
--
-- WHY THIS COLUMN EXISTS — it is a licensing requirement, not bookkeeping.
--
-- store_locations already holds ~1,235 Spar stores from Geolocet, a one-time
-- PURCHASED, proprietary dataset (scripts/import-geolocet-spar-data.mjs).
-- Issue #212 adds ~5,380 Austrian supermarkets from OpenStreetMap, which is
-- ODbL 1.0. ODbL §4.4/§4.6 oblige publishing the Derivative Database on
-- request. Two consequences follow, and both are load-bearing:
--
--  1. The ODbL extract must be producible by a single `WHERE source = 'osm'`.
--     Without a provenance column there is no way to hand out the OSM half
--     without handing out the purchased half with it — and the Geolocet
--     licence forbids republishing that. Two licences, mutually
--     unsatisfiable, is the failure mode this column prevents.
--  2. Nothing derived from Geolocet may end up inside the OSM set, or the
--     Geolocet rows become part of an ODbL Derivative Database themselves.
--     That is what the constraints below enforce.
--
-- Mirrors food_catalog_names.source from 0015 — same idea, same free-form TEXT
-- (deliberately not an enum: a new data source must be an INSERT, never a
-- migration + deploy).
--
-- ADDITIVE AND FAST ON PURPOSE. The container runs
-- `run-migrations && node dist/server.js` and scales to zero on Azure
-- Container Apps, so a slow or failing migration is a crash loop on every
-- cold start, not a rollback. That has bitten twice. Everything here is
-- catalog-only or a scan of ~1,235 rows: no table rewrite (ADD COLUMN with a
-- constant DEFAULT has been metadata-only since PG11), no data load. Loading
-- OSM data is scripts/import-osm-supermarkets.ts, run by hand.
-- ─────────────────────────────────────────────────────────────────────────────

-- Every row that exists today came from Geolocet, so the DEFAULT does the
-- backfill in one metadata-only step.
ALTER TABLE store_locations
    ADD COLUMN source TEXT NOT NULL DEFAULT 'geolocet';

-- ... and then the default changes, because leaving it at 'geolocet' would
-- silently stamp a purchased-data provenance on every row inserted through
-- StoreLocationRepository#create from here on. A wrong provenance is worse
-- than none: it would either pull app-created rows into a Geolocet-licensed
-- bucket or, in the other direction, hide them from the ODbL extract. Rows
-- created through the API/repository are exactly 'manual' — hand-entered, no
-- external dataset behind them.
ALTER TABLE store_locations
    ALTER COLUMN source SET DEFAULT 'manual';

-- ── The conflation firewall ─────────────────────────────────────────────────
--
-- The OSM importer must never read, match or update a non-OSM row. "The
-- script is careful" is not good enough for a licence question, so the
-- database enforces it with two independent mechanisms:
--
-- (1) This partial unique index. The importer's upsert infers THIS index as
--     its ON CONFLICT arbiter (`ON CONFLICT (discounter_id, external_store_id)
--     WHERE source = 'osm'`). Postgres restricts arbitration to rows matching
--     the index predicate, so its DO UPDATE branch cannot see, let alone
--     modify, a row with source <> 'osm'. Idempotent re-import within the OSM
--     set, structurally blind to everything outside it.
CREATE UNIQUE INDEX idx_store_locations_osm_external_id
    ON store_locations (discounter_id, external_store_id)
    WHERE source = 'osm';

-- (2) This CHECK. The partial index above governs which row the upsert may
--     UPDATE; it does nothing about the pre-existing table-wide
--     UNIQUE (discounter_id, external_store_id) from 0013, which is still
--     evaluated on every insert. An OSM element id colliding with a Geolocet
--     store id under the same discounter (OSM has 1,088 Spar entries; Geolocet
--     has ~1,235) would raise a unique violation and block the import.
--
--     So OSM ids are namespaced — external_store_id is 'osm:node/123', not
--     'node/123' — and this constraint makes that mandatory in one direction
--     and impossible in the other: an OSM row MUST carry the prefix, any
--     other row MUST NOT. Two rows from different sources can then never
--     produce the same key, whatever id format a future purchased dataset
--     invents. The OSM element id itself is recoverable by stripping 'osm:'.
--
--     This validates the existing ~1,235 Geolocet rows on creation (a
--     sub-millisecond scan) and will fail loudly rather than silently if any
--     of them already starts with 'osm:' — which would mean the namespace
--     assumption is wrong and needs a different separator, not a quiet import.
ALTER TABLE store_locations
    ADD CONSTRAINT chk_store_locations_osm_id_namespace CHECK (
        CASE
            WHEN source = 'osm' THEN external_store_id IS NOT NULL AND external_store_id LIKE 'osm:%'
            ELSE external_store_id IS NULL OR external_store_id NOT LIKE 'osm:%'
        END
    );

-- No index on `source` alone. The ODbL §4.6 extract is an offline, whole-set
-- dump where a sequential scan is the plan Postgres would pick anyway (the OSM
-- rows are the majority of the table), and migration 0010 already deleted four
-- indexes measured at 0 scans. Add one when a query is measured needing it.
