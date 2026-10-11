-- Migration 0018 — what was drunk, not just how many glasses (issue #209).
--
-- Each row snapshots the nutrition and hydration at logging time, so a later change to
-- the catalog in code never rewrites history. Additive and empty at creation: the drink
-- catalog lives in code (src/lib/drink-catalog.ts), so there is no data load here.
CREATE TABLE IF NOT EXISTS drink_logs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    drink_type   text NOT NULL,
    volume_ml    integer NOT NULL CHECK (volume_ml BETWEEN 1 AND 5000),
    logged_at    timestamptz NOT NULL DEFAULT now(),
    kcal         real NOT NULL,
    carbs_g      real NOT NULL,
    sugar_g      real NOT NULL,
    alcohol_g    real NOT NULL,
    hydration_ml real NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drink_logs_user_logged_at_idx ON drink_logs (user_id, logged_at DESC);
