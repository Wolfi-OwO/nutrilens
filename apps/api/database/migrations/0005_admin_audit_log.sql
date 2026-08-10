-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0005 — Admin audit log (issue #103).
--
-- Every role/status change an admin makes writes one row here, in the same
-- transaction as the change itself (UserService.changeUserRoleStatus) — a
-- change that "succeeded" with no audit row, or vice versa, is structurally
-- impossible, not just conventionally avoided.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE admin_audit_log (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action           TEXT NOT NULL CHECK (action IN ('role_change', 'status_change')),
    previous_value   TEXT NOT NULL,
    new_value        TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GET /admin/audit-log lists newest-first — this is the access pattern the
-- index needs to serve, not id or actor/target lookups.
CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
