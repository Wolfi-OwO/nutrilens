import type { User } from './user.model.ts';

/** One point in the daily-signups series (#102). */
export interface SignupDay {
    /** `YYYY-MM-DD`, UTC. */
    date: string;
    count: number;
}

/** The `GET /admin/stats` response shape (#102, UC-66). */
export interface AdminStats {
    usersByRole: Record<User['role'], number>;
    usersByStatus: Record<User['status'], number>;
    activeDietPlans: number;
    mealLogsLast7Days: number;
    mealLogsLast30Days: number;
    signupsLast30Days: SignupDay[];
}
