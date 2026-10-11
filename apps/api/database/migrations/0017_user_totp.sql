-- Migration 0017 — optional TOTP two-factor authentication (issue #154).
--
-- A separate table rather than columns on users: users is read by a dozen
-- queries that list explicit columns, and none of them should ever be able to
-- select a secret by accident. The secret is stored encrypted (AES-256-GCM,
-- key from the environment), never in clear text, and recovery codes only as
-- SHA-256 hashes. Additive and empty at creation.
CREATE TABLE IF NOT EXISTS user_totp (
    user_id         uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    secret_encrypted text NOT NULL,
    enabled         boolean NOT NULL DEFAULT false,
    recovery_hashes text[] NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    enabled_at      timestamptz
);
