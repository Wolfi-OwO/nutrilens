import type { DatabaseRow } from '../database/connection.ts';

/** The `food_catalog` domain shape, as used throughout the application. */
export interface FoodCatalogEntry {
    fdcId: number;
    description: string;
    category: string | null;
    caloriesKcal: number | null;
    proteinGrams: number | null;
    carbGrams: number | null;
    fatGrams: number | null;
    dataType: 'sr_legacy' | 'survey_food' | 'foundation_food';
    createdAt: Date;
    updatedAt: Date;
}

/** The raw `food_catalog` table row shape (snake_case columns), as returned by pg. */
export interface FoodCatalogRow extends DatabaseRow {
    fdc_id: number;
    description: string;
    category: string | null;
    calories_kcal: number | null;
    protein_grams: number | null;
    carb_grams: number | null;
    fat_grams: number | null;
    data_type: 'sr_legacy' | 'survey_food' | 'foundation_food';
    created_at: Date;
    updated_at: Date;
}

/**
 * Maps a raw `food_catalog` row to the domain {@link FoodCatalogEntry} shape.
 *
 * @param row - The raw database row.
 * @returns The mapped domain object.
 */
export function toFoodCatalogEntry(row: FoodCatalogRow): FoodCatalogEntry {
    return {
        fdcId: row.fdc_id,
        description: row.description,
        category: row.category,
        caloriesKcal: row.calories_kcal,
        proteinGrams: row.protein_grams,
        carbGrams: row.carb_grams,
        fatGrams: row.fat_grams,
        dataType: row.data_type,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
