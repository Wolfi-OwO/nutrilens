import type { AdminAuditLogEntry } from '../models/admin-audit-log.model.ts';
import type { AdminStats } from '../models/admin-stats.model.ts';
import type { AdminAuditLogRepository } from '../repository/admin-audit-log.repository.ts';
import type { AdminStatsRepository } from '../repository/admin-stats.repository.ts';

export interface AuditLogPage {
    entries: AdminAuditLogEntry[];
    total: number;
}

/**
 * The cross-domain admin-dashboard reads (#102, #103, UC-66/UC-68) — stats
 * spanning users/diet_plans/meal_logs, and the audit log. Role/status
 * changes themselves stay on `UserService` (`PATCH /users/:id` is a users
 * endpoint, not an `/admin/*` one) since that's where the guards and the
 * `users` table's invariants already live.
 */
export class AdminService {
    readonly #stats: AdminStatsRepository;
    readonly #auditLog: AdminAuditLogRepository;

    /**
     * @param stats - The data-access layer for the stats aggregate queries.
     * @param auditLog - The data-access layer for `admin_audit_log`.
     */
    public constructor(stats: AdminStatsRepository, auditLog: AdminAuditLogRepository) {
        this.#stats = stats;
        this.#auditLog = auditLog;
    }

    /**
     * @returns The `GET /admin/stats` payload (#102, UC-66).
     */
    public async getStats(): Promise<AdminStats> {
        return this.#stats.getStats();
    }

    /**
     * @param page - 1-indexed.
     * @param pageSize - Already validated and capped.
     * @returns The requested page of audit entries, newest first (#103, UC-68).
     */
    public async listAuditLog(page: number, pageSize: number): Promise<AuditLogPage> {
        return this.#auditLog.list(page, pageSize);
    }
}
