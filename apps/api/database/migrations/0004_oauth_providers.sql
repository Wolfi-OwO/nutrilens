-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0004 — OAuth login (issue #153).
--
-- password_hash becomes nullable: an OAuth-only account never sets a
-- password. auth_providers is a separate table, not columns on users,
-- because one user can link more than one provider (sign up with GitHub,
-- later also link Google) — a fixed set of nullable columns on `users`
-- can't express that without adding a new column per provider forever.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE auth_providers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider          TEXT NOT NULL CHECK (provider IN ('github', 'google', 'microsoft')),
    provider_user_id  TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- One provider account links to at most one nutrilens user...
    UNIQUE (provider, provider_user_id),
    -- ...and a user links a given provider at most once (no reason to link
    -- the same GitHub account to the same nutrilens account twice).
    UNIQUE (user_id, provider)
);

CREATE INDEX idx_auth_providers_user_id ON auth_providers(user_id);
