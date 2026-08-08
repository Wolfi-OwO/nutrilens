import { z } from 'zod';

// Structural validation only — physiological bounds (800-6000 kcal, etc.)
// stay in DietPlanService, which is where the domain reasoning for them lives.
export const createDietPlanBodySchema = z.object({
    dailyCalorieTarget: z.number(),
    proteinTargetGrams: z.number(),
    carbTargetGrams: z.number(),
    fatTargetGrams: z.number(),
    goal: z.string(),
});

export const updateDietPlanBodySchema = z.object({
    dailyCalorieTarget: z.number().optional(),
    proteinTargetGrams: z.number().optional(),
    carbTargetGrams: z.number().optional(),
    fatTargetGrams: z.number().optional(),
    endsAt: z.string().optional(),
});
