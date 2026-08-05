import type { DatabaseRow } from '../database/connection.ts';

export type MealLogSource = 'ai_photo' | 'manual_search' | 'barcode';

/** A single food item within a {@link MealLog}. */
export interface MealLogItem {
    id: string;
    mealLogId: string;
    foodName: string;
    portionGrams: number;
    /** 0–1. Always 1 for a manually entered item; an AI prediction's own score otherwise. */
    confidence: number;
    calories: number;
    proteinGrams: number;
    carbGrams: number;
    fatGrams: number;
    createdAt: Date;
}

/** The `meal_log_items` domain shape, plus its owning log's user/plan — used for ownership checks. */
export interface MealLog {
    id: string;
    userId: string;
    dietPlanId: string;
    source: MealLogSource;
    loggedAt: Date;
    /** Derived server-side as the sum of `items[].calories` — never accepted from a client. */
    totalCalories: number;
    proteinGrams: number;
    carbGrams: number;
    fatGrams: number;
    /** Whether the user edited an AI prediction before saving it (UC-21 step 6). */
    userCorrected: boolean;
    createdAt: Date;
    updatedAt: Date;
    items: MealLogItem[];
}

/** The raw `meal_logs` table row shape (snake_case columns), as returned by pg. */
export interface MealLogRow extends DatabaseRow {
    id: string;
    user_id: string;
    diet_plan_id: string;
    source: MealLogSource;
    logged_at: Date;
    total_calories: number;
    protein_grams: number;
    carb_grams: number;
    fat_grams: number;
    user_corrected: boolean;
    created_at: Date;
    updated_at: Date;
}

/** The raw `meal_log_items` table row shape (snake_case columns), as returned by pg. */
export interface MealLogItemRow extends DatabaseRow {
    id: string;
    meal_log_id: string;
    food_name: string;
    portion_grams: number;
    confidence: number;
    calories: number;
    protein_grams: number;
    carb_grams: number;
    fat_grams: number;
    created_at: Date;
}

/**
 * @param row - The raw database row.
 * @returns The mapped domain object.
 */
export function toMealLogItem(row: MealLogItemRow): MealLogItem {
    return {
        id: row.id,
        mealLogId: row.meal_log_id,
        foodName: row.food_name,
        portionGrams: row.portion_grams,
        confidence: row.confidence,
        calories: row.calories,
        proteinGrams: row.protein_grams,
        carbGrams: row.carb_grams,
        fatGrams: row.fat_grams,
        createdAt: row.created_at,
    };
}

/**
 * @param row - The raw database row.
 * @param items - The log's items, already mapped.
 * @returns The mapped domain object.
 */
export function toMealLog(row: MealLogRow, items: MealLogItem[]): MealLog {
    return {
        id: row.id,
        userId: row.user_id,
        dietPlanId: row.diet_plan_id,
        source: row.source,
        loggedAt: row.logged_at,
        totalCalories: row.total_calories,
        proteinGrams: row.protein_grams,
        carbGrams: row.carb_grams,
        fatGrams: row.fat_grams,
        userCorrected: row.user_corrected,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        items,
    };
}
