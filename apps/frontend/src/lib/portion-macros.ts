import type { PerHundredGramMacros } from '../types/api.ts';

/**
 * Scales per-100 g macros to a portion size, rounding to the nearest integer.
 * Each field is rounded independently; null inputs propagate as null.
 *
 * The meal_log_items schema enforces INTEGER NOT NULL on all macro columns,
 * so this is the single point where per-100 g precision is converted to
 * the integer-only storage format.
 *
 * @param per100g - Macros per 100 g (may have null fields for unreported nutrients)
 * @param portionGrams - Portion size in grams (must be > 0)
 * @returns Macros for the portion, rounded to integers, with null preserved
 */
export function scaleToPortion(per100g: PerHundredGramMacros, portionGrams: number): PerHundredGramMacros {
	const scale = portionGrams / 100;

	return {
		calories: per100g.calories !== null ? Math.round(per100g.calories * scale) : null,
		proteinGrams: per100g.proteinGrams !== null ? Math.round(per100g.proteinGrams * scale) : null,
		carbGrams: per100g.carbGrams !== null ? Math.round(per100g.carbGrams * scale) : null,
		fatGrams: per100g.fatGrams !== null ? Math.round(per100g.fatGrams * scale) : null,
	};
}
