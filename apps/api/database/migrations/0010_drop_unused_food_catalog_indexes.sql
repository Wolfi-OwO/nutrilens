-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0010 — Drop unused food_catalog indexes.
--
-- Measured index usage on production (pg_stat_user_indexes):
--   idx_food_catalog_fts:      0 scans, 4.8 MB
--   idx_food_catalog_category: 0 scans, 456 KB
--
-- Both have zero scans. The search path uses ILIKE + word_similarity trigram
-- fallback (idx_food_catalog_trgm, 107 scans), never full-text search or
-- category filters. Dropping these reclaims 5.3 MB and eliminates write
-- overhead on every INSERT to food_catalog.
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS idx_food_catalog_fts;
DROP INDEX IF EXISTS idx_food_catalog_category;
