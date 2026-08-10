import type { Queryable } from '../database/connection.ts';
import type { AdminStats, SignupDay } from '../models/admin-stats.model.ts';
import type { User } from '../models/user.model.ts';

const ROLES: readonly User['role'][] = ['user', 'coach', 'admin'];
const STATUSES: readonly User['status'][] = ['active', 'suspended', 'deleted'];

/**
 * @param rows - `{group, count}` pairs from a `GROUP BY` query.
 * @param keys - Every key that should appear in the result, even at 0 —
 *   a role/status with no rows must still show up as `0`, not be silently
 *   absent from the response.
 * @returns Every key mapped to its count.
 */
function toCountMap<K extends string>(rows: { group: K; count: string }[], keys: readonly K[]): Record<K, number> {
    const counts = new Map(rows.map((row) => [row.group, Number(row.count)]));
    return Object.fromEntries(keys.map((key) => [key, counts.get(key) ?? 0])) as Record<K, number>;
}

export class AdminStatsRepository {
    readonly #db: Queryable;

    /** @param db - The connection (or transaction-scoped client) to query. */
    public constructor(db: Queryable) {
        this.#db = db;
    }

    /**
     * The aggregate queries behind `GET /admin/stats` (#102, UC-66) — every
     * number here is a `GROUP BY`/`count(*)` over the whole table, never a
     * per-row loop in application code.
     *
     * @returns The full stats payload.
     */
    public async getStats(): Promise<AdminStats> {
        const [byRole, byStatus, activeDietPlans, mealLogs7d, mealLogs30d, signups] = await Promise.all([
            this.#db.query<{ group: User['role']; count: string }>(
                'SELECT role AS group, count(*) AS count FROM users GROUP BY role',
            ),
            this.#db.query<{ group: User['status']; count: string }>(
                'SELECT status AS group, count(*) AS count FROM users GROUP BY status',
            ),
            this.#db.query<{ count: string }>('SELECT count(*) AS count FROM diet_plans WHERE ends_at IS NULL'),
            this.#db.query<{ count: string }>(
                "SELECT count(*) AS count FROM meal_logs WHERE logged_at >= now() - interval '7 days'",
            ),
            this.#db.query<{ count: string }>(
                "SELECT count(*) AS count FROM meal_logs WHERE logged_at >= now() - interval '30 days'",
            ),
            this.#db.query<{ date: string; count: string }>(
                `SELECT date_trunc('day', created_at)::date::text AS date, count(*) AS count
                 FROM users
                 WHERE created_at >= now() - interval '30 days'
                 GROUP BY date
                 ORDER BY date`,
            ),
        ]);

        const signupsLast30Days: SignupDay[] = signups.rows.map((row) => ({
            date: row.date,
            count: Number(row.count),
        }));

        return {
            usersByRole: toCountMap(byRole.rows, ROLES),
            usersByStatus: toCountMap(byStatus.rows, STATUSES),
            activeDietPlans: Number(activeDietPlans.rows[0]?.count ?? 0),
            mealLogsLast7Days: Number(mealLogs7d.rows[0]?.count ?? 0),
            mealLogsLast30Days: Number(mealLogs30d.rows[0]?.count ?? 0),
            signupsLast30Days,
        };
    }
}
