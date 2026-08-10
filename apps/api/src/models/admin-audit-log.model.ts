import type { DatabaseRow } from '../database/connection.ts';

export type AdminAuditAction = 'role_change' | 'status_change';

/** The `admin_audit_log` domain shape (issue #103). */
export interface AdminAuditLogEntry {
    id: string;
    actorId: string;
    targetUserId: string;
    action: AdminAuditAction;
    previousValue: string;
    newValue: string;
    createdAt: Date;
}

/** The raw `admin_audit_log` table row shape (snake_case columns), as returned by pg. */
export interface AdminAuditLogRow extends DatabaseRow {
    id: string;
    actor_id: string;
    target_user_id: string;
    action: AdminAuditAction;
    previous_value: string;
    new_value: string;
    created_at: Date;
}

/**
 * Maps a raw `admin_audit_log` row to the domain {@link AdminAuditLogEntry} shape.
 *
 * @param row - The raw database row.
 * @returns The mapped domain object.
 */
export function toAdminAuditLogEntry(row: AdminAuditLogRow): AdminAuditLogEntry {
    return {
        id: row.id,
        actorId: row.actor_id,
        targetUserId: row.target_user_id,
        action: row.action,
        previousValue: row.previous_value,
        newValue: row.new_value,
        createdAt: row.created_at,
    };
}
