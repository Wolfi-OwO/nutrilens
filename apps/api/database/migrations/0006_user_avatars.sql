-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0006 — Profile avatars.
--
-- Three independent, nullable sources rather than one column:
--   avatar_upload         — the user's own upload, sharp-normalized to a
--                            fixed-size webp. Always wins (an explicit
--                            choice beats an automatic import).
--   avatar_provider_url   — GitHub's avatar_url / Google's picture claim,
--                            stored verbatim. Both are already public,
--                            provider-hosted, cache-friendly URLs — there is
--                            no reason to download and store those bytes
--                            ourselves.
--   avatar_provider_image — Microsoft's OIDC userinfo has no picture URL at
--                            all; a photo there only exists via a separate,
--                            best-effort Microsoft Graph binary call (often
--                            404s for personal accounts — see
--                            lib/oauth-providers.ts's `fetchAvatarImage`),
--                            so its result is stored as bytes, like an
--                            upload, not a URL.
--
-- Removing an uploaded avatar must be able to fall back to a still-present
-- provider avatar rather than jumping straight to the frontend's generated-
-- initials fallback — that's why these three are separate columns instead
-- of one column being overwritten in place. Precedence is applied in
-- application code (user.model.ts's `toAvatarUrl`), not SQL.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE users
    ADD COLUMN avatar_upload BYTEA NULL,
    ADD COLUMN avatar_provider_url TEXT NULL,
    ADD COLUMN avatar_provider_image BYTEA NULL;
