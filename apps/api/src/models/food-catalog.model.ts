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
    eanCode: string | null;
    /**
     * The localized alias this result matched, or `null` when it matched on the
     * English `description`/`category`. Search runs over every language at once,
     * so without this a German user typing "Semmel" gets back "Roll, NS as to
     * major flour" with nothing tying the result to the word they typed.
     * Populated only by {@link FoodCatalogRepository.search}; the single-row
     * lookups have no query text to have matched, so they report `null`.
     */
    matchedName: string | null;
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
    ean_code: string | null;
    matched_name: string | null;
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
        eanCode: row.ean_code,
        matchedName: row.matched_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
