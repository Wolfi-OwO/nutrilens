import { z } from 'zod';

// Structural only; the drink id and the volume bounds are checked in DrinkLogService.
export const createDrinkLogBodySchema = z.object({
    drinkType: z.string(),
    volumeMl: z.number(),
    loggedAt: z.string().optional(),
});

export const listDrinkLogsQuerySchema = z.object({
    from: z.string(),
    to: z.string(),
});
