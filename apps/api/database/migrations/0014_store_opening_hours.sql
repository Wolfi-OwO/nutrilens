-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0014 — Store opening hours.
--
-- One row per (store, day-of-week) span, not one row per store — a store
-- with a midday closure gets two rows for that day rather than a single
-- range that can't express the gap. day_of_week follows JS's own
-- Date#getDay() (0 = Sunday ... 6 = Saturday), the value the frontend and
-- any date math in this app already produce, so no remapping is needed at
-- either the API boundary or the DB.
--
-- No updated_at: opening hours are replaced wholesale (delete-then-reinsert
-- per store) rather than edited field-by-field, so there's nothing an
-- update trigger would ever fire on.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE store_opening_hours (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id      UUID NOT NULL REFERENCES store_locations(id) ON DELETE CASCADE,
    day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    opens_at      TIME NOT NULL,
    closes_at     TIME NOT NULL CHECK (closes_at > opens_at),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_store_opening_hours_store_id ON store_opening_hours(store_id);
