-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0001 — Initial schema.
--
-- Matches the domain class diagram in
-- organizational/application-overview.md exactly (User, DietPlan, MealLog,
-- MealLogItem, WeightEntry). Enum classes (ROLE, STATUS, GOAL, LOG_SOURCE)
-- become CHECK-constrained lowercase text, not native Postgres ENUM types,
-- for portability and easy evolution via later migrations.
--
-- Conventions: snake_case identifiers, plural table names, every table has
-- created_at / updated_at (UTC) with an updated_at trigger.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext"; -- case-insensitive email

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── User ─────────────────────────────────────────────────────────────────────

CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          CITEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    display_name   TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'coach', 'admin')),
    status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── DietPlan ─────────────────────────────────────────────────────────────────

CREATE TABLE diet_plans (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    daily_calorie_target  INTEGER NOT NULL CHECK (daily_calorie_target > 0),
    protein_target_grams  INTEGER NOT NULL CHECK (protein_target_grams >= 0),
    carb_target_grams     INTEGER NOT NULL CHECK (carb_target_grams >= 0),
    fat_target_grams      INTEGER NOT NULL CHECK (fat_target_grams >= 0),
    goal                  TEXT NOT NULL CHECK (goal IN ('lose_weight', 'maintain', 'gain_weight')),
    starts_at             TIMESTAMPTZ NOT NULL,
    ends_at               TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX idx_diet_plans_user ON diet_plans(user_id);

-- ── MealLog ──────────────────────────────────────────────────────────────────

-- DietPlan "1" -- "0..*" MealLog: every meal log belongs to exactly one plan.
CREATE TABLE meal_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    diet_plan_id    UUID NOT NULL REFERENCES diet_plans(id) ON DELETE CASCADE,
    source          TEXT NOT NULL CHECK (source IN ('ai_photo', 'manual_search', 'barcode')),
    logged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_calories  INTEGER NOT NULL DEFAULT 0 CHECK (total_calories >= 0),
    protein_grams   INTEGER NOT NULL DEFAULT 0 CHECK (protein_grams >= 0),
    carb_grams      INTEGER NOT NULL DEFAULT 0 CHECK (carb_grams >= 0),
    fat_grams       INTEGER NOT NULL DEFAULT 0 CHECK (fat_grams >= 0),
    user_corrected  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_meal_logs_user ON meal_logs(user_id);
CREATE INDEX idx_meal_logs_diet_plan ON meal_logs(diet_plan_id);
CREATE INDEX idx_meal_logs_logged_at ON meal_logs(logged_at);

-- ── MealLogItem ──────────────────────────────────────────────────────────────

-- MealLog "1" -- "1..*" MealLogItem: at least one item per log is an
-- application-layer invariant (enforced when creating a log), not a DB
-- constraint — Postgres has no simple "at least one child row" check.
CREATE TABLE meal_log_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_log_id     UUID NOT NULL REFERENCES meal_logs(id) ON DELETE CASCADE,
    food_name       TEXT NOT NULL,
    portion_grams   REAL NOT NULL CHECK (portion_grams > 0),
    confidence      REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    calories        INTEGER NOT NULL CHECK (calories >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_meal_log_items_meal_log ON meal_log_items(meal_log_id);

-- ── WeightEntry ──────────────────────────────────────────────────────────────

CREATE TABLE weight_entries (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weight_kg      REAL NOT NULL CHECK (weight_kg > 0),
    recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- `recorded_at::date` alone isn't usable in an index: the cast depends on
    -- the session's TimeZone setting, so Postgres rejects it as non-IMMUTABLE.
    -- Pinning to UTC via AT TIME ZONE makes the expression a fixed function
    -- of its input, which is what IMMUTABLE actually requires.
    recorded_date  DATE GENERATED ALWAYS AS ((recorded_at AT TIME ZONE 'UTC')::date) STORED,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_weight_entries_user ON weight_entries(user_id);
-- One entry per user per day (UTC), per issue #23's acceptance criteria.
CREATE UNIQUE INDEX idx_weight_entries_user_day ON weight_entries(user_id, recorded_date);

-- ── updated_at triggers ──────────────────────────────────────────────────────

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_diet_plans_updated_at BEFORE UPDATE ON diet_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_meal_logs_updated_at BEFORE UPDATE ON meal_logs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
