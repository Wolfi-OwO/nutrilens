-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0011 — Add EAN/UPC barcode column to food_catalog.
--
-- Foundation for barcode scanning (Feature 6) and multi-ingredient search
-- (Feature 5). Nullable: only entries enriched from Open Food Facts carry a
-- barcode; the ~7,793 USDA-sourced rows have none. UNIQUE (not a primary key)
-- so a lookup miss is just "no row", not a schema violation, and so the same
-- barcode can never be attached to two catalog entries by mistake.
--
-- VARCHAR(20) covers EAN-13 (13 digits) and UPC-A (12 digits) with headroom;
-- GS1's own barcode formats top out well under 20 characters.
--
-- Data source for enrichment: Open Food Facts (https://openfoodfacts.org),
-- ODbL + CC-BY-SA licensed — attribution required, tracked in PRIVACY.md.
-- Enrichment itself (populating this column) is a separate, later job; this
-- migration only adds the schema.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE food_catalog
    ADD COLUMN ean_code VARCHAR(20);

-- Plain UNIQUE index, no WHERE clause needed: Postgres never treats two NULLs
-- as equal, so multiple un-enriched (NULL) rows are already allowed.
CREATE UNIQUE INDEX idx_food_catalog_ean_code ON food_catalog(ean_code);
