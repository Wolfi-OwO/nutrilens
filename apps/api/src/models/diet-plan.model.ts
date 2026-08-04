import type { DatabaseRow } from '../database/connection.ts';

export type DietPlanGoal = 'lose_weight' | 'maintain' | 'gain_weight';

/** The `diet_plans` domain shape, as used throughout the application. */
export interface DietPlan {
    id: string;
    userId: string;
    dailyCalorieTarget: number;
    proteinTargetGrams: number;
    carbTargetGrams: number;
    fatTargetGrams: number;
    goal: DietPlanGoal;
    startsAt: Date;
    /** `null` while the plan is active — see UC-12, "archiving" sets this. */
    endsAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

/** The raw `diet_plans` table row shape (snake_case columns), as returned by pg. */
export interface DietPlanRow extends DatabaseRow {
    id: string;
    user_id: string;
    daily_calorie_target: number;
    protein_target_grams: number;
    carb_target_grams: number;
    fat_target_grams: number;
    goal: DietPlanGoal;
    starts_at: Date;
    ends_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

/**
 * Maps a raw `diet_plans` row to the domain {@link DietPlan} shape.
 *
 * @param row - The raw database row.
 * @returns The mapped domain object.
 */
export function toDietPlan(row: DietPlanRow): DietPlan {
    return {
        id: row.id,
        userId: row.user_id,
        dailyCalorieTarget: row.daily_calorie_target,
        proteinTargetGrams: row.protein_target_grams,
        carbTargetGrams: row.carb_target_grams,
        fatTargetGrams: row.fat_target_grams,
        goal: row.goal,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
