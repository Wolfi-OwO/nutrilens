import { z } from 'zod';

// Structural validation only — trimming, the confidence range, and
// non-negative-integer macro checks stay in MealLogService's parseItems,
// which is where that reasoning already lives and is tested.
const mealLogItemBodySchema = z.object({
    foodName: z.string(),
    portionGrams: z.number(),
    confidence: z.number().optional(),
    calories: z.number(),
    proteinGrams: z.number().optional(),
    carbGrams: z.number().optional(),
    fatGrams: z.number().optional(),
});

export const createMealLogBodySchema = z.object({
    source: z.string(),
    loggedAt: z.string().optional(),
    userCorrected: z.boolean().optional(),
    items: z.array(mealLogItemBodySchema).min(1),
});

export const updateMealLogBodySchema = z.object({
    loggedAt: z.string().optional(),
    userCorrected: z.boolean().optional(),
    items: z.array(mealLogItemBodySchema).min(1).optional(),
});
