import { z } from 'zod';

// Structural validation only — physiological bounds (20-400 kg) stay in
// WeightEntryService.
export const createWeightEntryBodySchema = z.object({
    weightKg: z.number(),
    recordedAt: z.string().optional(),
    overwrite: z.boolean().optional(),
});

export const updateWeightEntryBodySchema = z.object({
    weightKg: z.number().optional(),
    recordedAt: z.string().optional(),
});

export const listWeightEntriesQuerySchema = z.object({
    from: z.string().optional(),
    to: z.string().optional(),
});
