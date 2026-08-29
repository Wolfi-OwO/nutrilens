-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0015 — Localized names for food_catalog entries (issue #208).
--
-- The reported symptom: typing "Semmel" into the live app returns "No matches —
-- enter it manually below." The catalog is ~13,588 rows, all USDA, all English,
-- and has no language column anywhere. A German/Austrian speaker cannot reach
-- any of it by the word they actually use.
--
-- WHY A TRANSLATIONS TABLE AND NOT A `lang` COLUMN ON food_catalog — this is the
-- decision most likely to be second-guessed, so it is recorded here:
--
--  1. Nutrition is not language-dependent. "Semmel" and "bread roll" are the
--     same 100 g of food. A `lang` column on food_catalog forces a full
--     duplicate of the nutrition row per language: same kcal, same macros,
--     N copies to keep in sync, and every macro correction becomes an N-row
--     update instead of a one-row update.
--  2. It is not merely wasteful, it is impossible. Migration 0011 added
--     `CREATE UNIQUE INDEX idx_food_catalog_ean_code ON food_catalog(ean_code)`.
--     One barcoded product with five language names would be five rows sharing
--     one ean_code — a unique violation on the first Italian name added. The
--     duplicate-row design cannot coexist with barcode lookup at all.
--
-- `lang` is free-form BCP-47 text, deliberately NOT an enum and NOT a CHECK
-- constraint: adding Italian must be an INSERT, never a migration + deploy.
-- Regional tags ('de-AT' vs 'de') fall out of BCP-47 for free, which matters
-- here because the seed data is Austrian-weighted ("Semmel", "Paradeiser",
-- "Erdäpfel"), not standard-German.
--
-- `source` carries provenance so hand-written rows stay separable from any
-- future bulk import: 'curated' for the reviewed seed list, 'off' for anything
-- pulled from Open Food Facts. That separation is a licensing requirement, not
-- a nicety — the OFF database is ODbL v1.0 and its contents DbCL v1.0
-- (attribution tracked in PRIVACY.md, same as the barcode enrichment in 0011),
-- and a row of unknown origin cannot be attributed or removed on request.
-- OFF product images are CC-BY-SA and are NOT used here — names and nutrition
-- facts only.
--
-- The primary key is (fdc_id, lang, name), not a surrogate id: the natural key
-- IS the uniqueness rule the importer needs for ON CONFLICT DO NOTHING, and one
-- food legitimately has several names in the same language ("Semmel",
-- "Kaisersemmel", "Weckerl" all reach a bread roll).
--
-- EMPTY TABLE ON PURPOSE — no data load in this or any migration file. The
-- container runs `run-migrations && node dist/server.js`, and the app scales to
-- zero on Azure Container Apps, so a slow or failing migration is not a
-- rollback, it is a crash loop on every cold start. That has already bitten
-- twice. Seeding is scripts/import-food-names.ts, run by hand against a live
-- database, never on the deploy path.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE food_catalog_names (
    fdc_id      INTEGER NOT NULL REFERENCES food_catalog(fdc_id) ON DELETE CASCADE,
    lang        TEXT NOT NULL,
    name        TEXT NOT NULL,
    source      TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (fdc_id, lang, name)
);

-- Trigram GIN, matching idx_food_catalog_trgm on description, because the alias
-- lookup runs the same two operators the English path already runs: ILIKE
-- '%...%' in the first pass and word_similarity/<% in the trigram fallback.
-- Neither can use a B-tree.
--
-- Deliberately NOT a tsvector/'german' text-search config. Migration 0010
-- dropped idx_food_catalog_fts after measuring 0 scans and 4.8 MB wasted, and
-- `tsvector` appears in zero .ts files — the search path has never used full-text
-- search. Adding a German FTS index would be re-creating the index that was just
-- measured unused, in a second language.
--
-- No CREATE EXTENSION line: pg_trgm is already installed by migration 0007, and
-- unlike postgis (see 0013's guard) it is a TRUSTED extension, so no privilege
-- workaround is needed here.
CREATE INDEX idx_food_catalog_names_trgm ON food_catalog_names
    USING GIN (name gin_trgm_ops);
