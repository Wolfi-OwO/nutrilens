-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0007 — Food catalog from USDA SR Legacy.
--
-- A denormalized reference table of ~7,793 foods from USDA SR Legacy (2018-04).
-- Every food is keyed on its fdc_id (immutable, from the USDA dataset), carrying
-- the per-100 g macronutrient values (kcal, protein, carbs, fat).
--
-- Macronutrient columns are REAL (nullable, not NOT NULL) for precise per-100g
-- values and to distinguish "not reported by USDA" (NULL) from "zero amount".
-- This is reference data, not a user's own recorded meal; absence of a nutrient
-- is meaningful. By contrast, meal_log_items' macro columns are INTEGER NOT NULL
-- CHECK (>= 0) because they represent a user's deliberate choice: zero is a real
-- value there, not a missing datum.
--
-- Full-text search (tsvector + GIN) on description + category for ranking and
-- pg_trgm for fuzzy matching (e.g. typos in user queries). Both are present,
-- so queries can be ranked by relevance.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE food_catalog (
    fdc_id          INTEGER PRIMARY KEY,
    description     TEXT NOT NULL,
    category        TEXT,
    calories_kcal   REAL,
    protein_grams   REAL,
    carb_grams      REAL,
    fat_grams       REAL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigram extension for fuzzy matching support (typos, phonetic similarity).
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Full-text search: tsvector GIN index on description and category for ranking
-- by relevance. The 'english' config provides stemming (e.g. "running" matches
-- "run"), stop-word removal, etc. Dropped in migration 0010 as unused (zero
-- scans observed on live database).
CREATE INDEX idx_food_catalog_fts ON food_catalog
    USING GIN (to_tsvector('english', description || ' ' || COALESCE(category, '')));

-- Trigram index for fuzzy matching (typos, partial names).
CREATE INDEX idx_food_catalog_trgm ON food_catalog
    USING GIN (description gin_trgm_ops);

-- Index on category for filtering by dataset or food type. Dropped in migration
-- 0010 as unused (zero scans observed on live database).
CREATE INDEX idx_food_catalog_category ON food_catalog(category);

-- Trigger to auto-update updated_at on any change.
CREATE TRIGGER trg_food_catalog_updated_at BEFORE UPDATE ON food_catalog
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
