import { z } from 'zod';

const timeOfDaySchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'must be HH:MM or HH:MM:SS');

// Structural validation only — that closesAt is actually after opensAt is
// enforced by the store_opening_hours CHECK constraint (migration 0014).
export const createStoreOpeningHourBodySchema = z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    opensAt: timeOfDaySchema,
    closesAt: timeOfDaySchema,
});
