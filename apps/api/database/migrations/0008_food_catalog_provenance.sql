-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0008 — Add data_type column to food_catalog for dataset provenance.
--
-- Tracks which USDA dataset each food entry originated from:
-- - 'sr_legacy': USDA SR Legacy (2018-04), raw ingredients and branded products
-- - 'survey_food': USDA Survey Foods (2024-10-31), prepared dishes from dietary surveys
-- - 'foundation_food': USDA Foundation Foods (2026-04-30), higher-quality nutrient data
--
-- This column is immutable after insert and is essential for understanding data
-- quality and source variability: prepared dishes (survey_food) are ranked higher
-- than raw ingredients for matching common meal names like "pizza" or "hamburger".
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE food_catalog
    ADD COLUMN data_type TEXT NOT NULL DEFAULT 'sr_legacy';

CREATE INDEX idx_food_catalog_data_type ON food_catalog(data_type);
