import type { Queryable } from '../database/connection.ts';
import { toAdminAuditLogEntry } from '../models/admin-audit-log.model.ts';
import type { AdminAuditAction, AdminAuditLogEntry, AdminAuditLogRow } from '../models/admin-audit-log.model.ts';

const COLUMNS = 'id, actor_id, target_user_id, action, previous_value, new_value, created_at';

export interface CreateAuditLogEntryInput {
    actorId: string;
    targetUserId: string;
    action: AdminAuditAction;
    previousValue: string;
    newValue: string;
}

export interface ListAuditLogResult {
    entries: AdminAuditLogEntry[];
    total: number;
}

export class AdminAuditLogRepository {
    readonly #db: Queryable;

    /** @param db - The connection (or transaction-scoped client) to query. */
    public constructor(db: Queryable) {
        this.#db = db;
    }

    /**
     * Writes one entry. Called from inside the same transaction as the
     * role/status change it records — see
     * `UserService.changeUserRoleStatus` — never on its own.
     *
     * @param input - The actor, target, and what changed.
     * @returns The written entry.
     */
    public async create(input: CreateAuditLogEntryInput): Promise<AdminAuditLogEntry> {
        const { rows } = await this.#db.query<AdminAuditLogRow>(
            `INSERT INTO admin_audit_log (actor_id, target_user_id, action, previous_value, new_value)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING ${COLUMNS}`,
            [input.actorId, input.targetUserId, input.action, input.previousValue, input.newValue],
        );
        const row = rows[0];
        if (!row) {
            throw new Error('Insert did not return a row.');
        }
        return toAdminAuditLogEntry(row);
    }

    /**
     * @param page - 1-indexed.
     * @param pageSize - Already validated and capped.
     * @returns The requested page, newest first, plus the total entry count.
     */
    public async list(page: number, pageSize: number): Promise<ListAuditLogResult> {
        const { rows } = await this.#db.query<AdminAuditLogRow & { total_count: string }>(
            `SELECT ${COLUMNS}, count(*) OVER() AS total_count
             FROM admin_audit_log
             ORDER BY created_at DESC
             LIMIT $1 OFFSET $2`,
            [pageSize, (page - 1) * pageSize],
        );
        return {
            entries: rows.map(toAdminAuditLogEntry),
            total: rows[0] ? Number(rows[0].total_count) : 0,
        };
    }
}
