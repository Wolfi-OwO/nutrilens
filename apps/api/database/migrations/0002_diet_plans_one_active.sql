-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0002 — At most one active diet plan per user.
--
-- UC-10 step 5: creating a plan deactivates any prior active plan. The
-- service does that as "archive, then insert" inside a transaction, but
-- without a DB-level constraint two concurrent creates for the same user
-- could each archive the same row and both insert a new active plan. A
-- partial unique index (mirrors weight_entries' one-per-day index in
-- 0001) makes the second insert fail instead, which the service turns into
-- a 409.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX idx_diet_plans_one_active_per_user ON diet_plans(user_id) WHERE ends_at IS NULL;
