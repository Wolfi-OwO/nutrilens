-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0003 — Per-item macros on meal_log_items.
--
-- 0001 gave meal_log_items only `calories`, but FR-022 requires an AI
-- prediction (and, symmetrically, a manual entry) to carry macros per item,
-- not just per meal. Without per-item macros, a meal_log's aggregate
-- protein/carb/fat_grams would have to be trusted from the client — the
-- opposite of issue #22's "totals derived server-side" requirement. Adding
-- these lets every meal_log total be a straight sum over its items.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE meal_log_items
    ADD COLUMN protein_grams INTEGER NOT NULL DEFAULT 0 CHECK (protein_grams >= 0),
    ADD COLUMN carb_grams    INTEGER NOT NULL DEFAULT 0 CHECK (carb_grams >= 0),
    ADD COLUMN fat_grams     INTEGER NOT NULL DEFAULT 0 CHECK (fat_grams >= 0);
