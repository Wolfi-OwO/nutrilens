-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0009 — Support for user deletion and data export (GDPR Art. 17, 20).
--
-- Changes admin_audit_log to anonymise actor_id and target_user_id (set to NULL)
-- rather than cascade-delete when a user is deleted. This preserves audit history
-- while respecting the right to erasure: a deleted user's actions remain in the
-- log with their userId anonymised (NULL), not erased entirely.
--
-- The alternative of hard-deleting audit rows would lose historical accountability
-- for who changed what, violating audit-trail integrity. Setting to NULL retains
-- "an action happened at this time with these value changes" while removing the
-- link to the deleted user.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE admin_audit_log
    DROP CONSTRAINT admin_audit_log_actor_id_fkey,
    DROP CONSTRAINT admin_audit_log_target_user_id_fkey,
    ALTER COLUMN actor_id DROP NOT NULL,
    ALTER COLUMN target_user_id DROP NOT NULL,
    ADD CONSTRAINT admin_audit_log_actor_id_fkey
        FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT admin_audit_log_target_user_id_fkey
        FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL;
